/**
 * Parallel render endpoint — same FormData contract as /api/render, but
 * pipes through Remotion (headless Chromium) instead of an FFmpeg filter
 * graph. Lives at a separate URL so the existing path keeps serving paying
 * customers while we validate parity effect-by-effect.
 *
 * To gradually roll this out, set EXPORT_ENGINE=remotion in the env and add
 * a tiny dispatcher in the client (export page) that picks the URL by env.
 * For now, this is opt-in by hitting the URL directly during QA.
 *
 * The actual render is delegated to `renderViaRemotion`; this route just
 * handles auth, rate-limit, file I/O, and credit accounting — identical to
 * the FFmpeg route so we don't double-charge on engine switch.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/apiAuth";
import { rateLimit } from "@/lib/rateLimit";
import { spendCredits } from "@/lib/serverCredits";
import { recordSpend, settleSpend, reconcileSpend, sweepStaleSpends } from "@/lib/renderSpends";
import { calcDynamicCost } from "@/lib/credits";
import type { Subtitle, SubtitleStyle, VideoEffects, EditMode } from "@/lib/types";
import { DEFAULT_EFFECTS } from "@/lib/types";
import { makeCancelSignal } from "@remotion/renderer";
import { renderViaRemotion } from "@/lib/remotionRender";
import {
  createJob, updateJob, jobOutputPath, cleanupOldJobs,
  registerRenderCancel, unregisterRenderCancel, isCancelRequested,
} from "@/lib/renderJobs";

export const runtime = "nodejs";
export const maxDuration = 1800;

// Upload cap, env-tunable. 200MB was too small for 90-second HD phone videos
// (Liat hit "קובץ גדול מדי" on a normal export). The renderer downscales to
// 1280px anyway, so a bigger raw input only needs upload + disk-staging
// headroom. Default 600MB; raise MAX_UPLOAD_MB after the server upgrade.
const MAX_VIDEO_BYTES = (Number(process.env.MAX_UPLOAD_MB) || 600) * 1024 * 1024;
const MAX_UPLOAD_MB = Number(process.env.MAX_UPLOAD_MB) || 600;

// Hold references to in-flight background renders so the Node GC doesn't
// collect the un-awaited promise. The process is long-lived (next start), so
// these keep running after the HTTP response returns.
const runningJobs = new Set<Promise<void>>();

// Serialize renders: this box is a 4-core machine that ALSO serves the live
// site. Running several headless-Chromium renders at once would saturate the
// CPU and freeze the site for everyone. A single-slot queue means each job
// waits its turn — fine, since the user isn't blocked (they get a jobId
// instantly and a "queued/rendering" badge). The chain never breaks: a failed
// job's rejection is swallowed so the next one still runs.
let renderQueue: Promise<unknown> = Promise.resolve();
function enqueueRender(fn: () => Promise<void>): Promise<void> {
  const run = renderQueue.then(fn, fn);
  renderQueue = run.catch(() => {});
  return run;
}

export async function POST(req: NextRequest) {
  const user = await requireUser(req);
  if (user instanceof NextResponse) return user;
  const limited = rateLimit(req, { key: `render-remotion:${user.id}`, max: 3, windowSec: 60 });
  if (limited) return limited;

  const formData = await req.formData();
  const file = formData.get("video") as File | null;
  if (!file) return NextResponse.json({ error: "לא נמצא קובץ וידאו" }, { status: 400 });
  if (file.size > MAX_VIDEO_BYTES) {
    return NextResponse.json({ error: `קובץ גדול מדי (מקס׳ ${MAX_UPLOAD_MB}MB)` }, { status: 413 });
  }

  const subtitlesJson = formData.get("subtitles") as string | null;
  const styleJson = formData.get("style") as string | null;
  const effectsJson = formData.get("effects") as string | null;
  if (!subtitlesJson || !styleJson) {
    return NextResponse.json({ error: "חסרים נתוני כתוביות/עיצוב" }, { status: 400 });
  }

  let subtitles: Subtitle[];
  let style: SubtitleStyle;
  let effects: VideoEffects;
  try {
    subtitles = JSON.parse(subtitlesJson);
    style = JSON.parse(styleJson);
    effects = effectsJson ? JSON.parse(effectsJson) : DEFAULT_EFFECTS;
  } catch {
    return NextResponse.json({ error: "נתונים לא תקינים" }, { status: 400 });
  }

  const mode = (formData.get("mode") as EditMode) || "subtitles_only";
  const durationSec = Number(formData.get("durationSec")) || 10;

  // Background music: the client uploads the actual audio bytes as a file
  // (the in-browser bgMusicUrl is a blob: object URL the server can't fetch,
  // and dies on page reload). Stage it like the video and point
  // effects.bgMusicUrl at the staged filename so the composition loads it
  // via staticFile() — the proven path. If no file came through (e.g. the
  // user reloaded and the blob went stale), drop bgMusicUrl entirely so the
  // composition skips it instead of trying to load a dead reference.
  const bgMusicFile = formData.get("bgMusic") as File | null;
  let bgMusicBuffer: Buffer | undefined;
  let bgMusicFileName: string | undefined;
  if (bgMusicFile && bgMusicFile.size > 0 && bgMusicFile.size <= MAX_VIDEO_BYTES) {
    // Give the staged file a real audio extension — Remotion/FFmpeg sniff the
    // container partly from it; an extension-less file can fail to decode.
    const ext = ({
      "audio/mpeg": "mp3", "audio/mp3": "mp3", "audio/mp4": "m4a",
      "audio/aac": "aac", "audio/wav": "wav", "audio/x-wav": "wav",
      "audio/ogg": "ogg", "audio/webm": "webm", "audio/flac": "flac",
    } as Record<string, string>)[bgMusicFile.type] || "mp3";
    bgMusicFileName = `bgmusic-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    bgMusicBuffer = Buffer.from(await bgMusicFile.arrayBuffer());
    effects.bgMusicUrl = bgMusicFileName;
  } else if (typeof effects.bgMusicUrl === "string" && effects.bgMusicUrl.startsWith("blob:")) {
    effects.bgMusicUrl = undefined;
  }

  // Canvas dimensions = the chosen aspect crop, so the export frame matches
  // what the preview shows. "original" uses the source video's natural
  // dimensions (sent by the client), falling back to 9:16. Even-rounded
  // because H.264 requires even width/height.
  const evenize = (n: number) => Math.max(2, Math.round(n / 2) * 2);
  const { ASPECT_RATIO_INFO } = await import("@/lib/types");
  const aspectInfo = ASPECT_RATIO_INFO[effects.aspectRatio ?? "original"];
  const natW = Number(formData.get("naturalWidth")) || 0;
  const natH = Number(formData.get("naturalHeight")) || 0;
  let canvasW = 1080;
  let canvasH = 1920;
  if (aspectInfo?.width && aspectInfo?.height) {
    canvasW = aspectInfo.width;
    canvasH = aspectInfo.height;
  } else if (natW > 0 && natH > 0) {
    canvasW = natW;
    canvasH = natH;
  }
  // SPEED: render at 720p-class (long edge ≤ 1280) instead of 1080p. This is
  // the single biggest no-cost lever on a GPU-less box — render time scales
  // with pixel count, so ~halving the pixels ~halves the render. 1280×720
  // is standard HD for reels/TikTok/IG (they re-compress anyway), and every
  // subtitle/emoji/logo size is height-relative so the look is unchanged.
  // Liat: "תמצא הכל בקוד שיהיה כמה שיותר מהיר" (no paid scaling).
  const MAX_LONG_EDGE = 1280;
  const longEdge = Math.max(canvasW, canvasH);
  const k = longEdge > MAX_LONG_EDGE ? MAX_LONG_EDGE / longEdge : 1;
  canvasW = evenize(canvasW * k);
  canvasH = evenize(canvasH * k);

  const cost = calcDynamicCost(mode, effects);
  const spent = await spendCredits(user.id, cost.total);
  if (!spent.ok) return NextResponse.json({ error: "אין מספיק מאסטרים" }, { status: 402 });

  const videoFileName = `input-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.mp4`;
  const videoBuffer = Buffer.from(await file.arrayBuffer());

  // Suggested download filename (date-stamped). new Date() is fine here — this
  // is a request handler, not a replayable workflow.
  const d = new Date();
  const filename = `video-master-${d.getDate()}-${d.getMonth() + 1}-${d.getFullYear()}.mp4`;

  // Create the job and kick the render off in the BACKGROUND so the user gets
  // an instant response instead of waiting minutes on a spinner. The render
  // writes straight into the job folder; the client polls /api/render-status
  // and downloads from /api/render-result when done.
  const job = await createJob(user.id, filename);
  // Persistent spend ledger: refund survives even a container restart mid-render
  // (the in-process catch below can't run then). Idempotent with settle/reconcile.
  await recordSpend(job.id, user.id, cost.total);
  cleanupOldJobs().catch(() => {});
  sweepStaleSpends().catch(() => {}); // refund earlier renders that died unnoticed

  const task = enqueueRender(async () => {
    // Cancelled while still QUEUED (before this slot ran)? Skip the render
    // entirely; the cancel endpoint already refunded.
    if (isCancelRequested(job.id)) {
      await updateJob(job.id, { status: "cancelled" });
      await reconcileSpend(job.id, user.id).catch(() => {});
      return;
    }
    await updateJob(job.id, { status: "rendering" });
    // A cancel signal the /api/render-cancel route can trigger to abort an
    // in-flight render (Liat: "אפשרות לבטל יצוא וזה מחזיר את כל הקרדיטים").
    const { cancelSignal, cancel } = makeCancelSignal();
    registerRenderCancel(job.id, cancel);
    try {
      await renderViaRemotion({
        inputProps: {
          videoSrc: videoFileName,
          subtitles,
          style,
          effects,
          width: canvasW,
          height: canvasH,
          durationSec,
          fps: 30,
        },
        videoBuffer,
        videoFileName,
        bgMusicBuffer,
        bgMusicFileName,
        outPath: jobOutputPath(job.id),
        cancelSignal,
        onProgress: ({ renderedFrames, totalFrames }) => {
          // Heartbeat ~every 15 frames (keeps the job from being flagged stale)
          // and report % so the client badge can show real progress.
          if (renderedFrames % 15 === 0) {
            const progress = totalFrames > 0
              ? Math.min(99, Math.round((renderedFrames / totalFrames) * 100))
              : 0;
            updateJob(job.id, { status: "rendering", progress }).catch(() => {});
          }
        },
      });
      await updateJob(job.id, { status: "done" });
      await settleSpend(job.id); // render OK → mark settled (no refund owed)
    } catch (err) {
      if (isCancelRequested(job.id)) {
        // User cancelled → renderMedia rejected on the cancel signal. The
        // cancel endpoint already refunded; just record the final status.
        await updateJob(job.id, { status: "cancelled" });
      } else {
        console.error("[render-remotion] job failed", job.id, err);
        // Refund exactly once via the persistent ledger (idempotent with the
        // status-poll + stale-sweep reconcile paths) so a failure never costs
        // the user — even if THIS process dies before the refund.
        await reconcileSpend(job.id, user.id).catch(() => {});
        await updateJob(job.id, { status: "failed", error: "הייצוא נכשל" });
      }
    } finally {
      unregisterRenderCancel(job.id);
    }
  });
  runningJobs.add(task);
  task.finally(() => runningJobs.delete(task));

  return NextResponse.json({ jobId: job.id }, { status: 202 });
}
