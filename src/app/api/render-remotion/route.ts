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
import { mkdir, rm, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { requireUser } from "@/lib/apiAuth";
import { rateLimit } from "@/lib/rateLimit";
import { spendCredits, refundCredits } from "@/lib/serverCredits";
import { calcDynamicCost } from "@/lib/credits";
import type { Subtitle, SubtitleStyle, VideoEffects, EditMode } from "@/lib/types";
import { DEFAULT_EFFECTS } from "@/lib/types";
import { renderViaRemotion } from "@/lib/remotionRender";

export const runtime = "nodejs";
export const maxDuration = 1800;

const MAX_VIDEO_BYTES = 200 * 1024 * 1024;

export async function POST(req: NextRequest) {
  const user = await requireUser(req);
  if (user instanceof NextResponse) return user;
  const limited = rateLimit(req, { key: `render-remotion:${user.id}`, max: 3, windowSec: 60 });
  if (limited) return limited;

  const formData = await req.formData();
  const file = formData.get("video") as File | null;
  if (!file) return NextResponse.json({ error: "Missing video" }, { status: 400 });
  if (file.size > MAX_VIDEO_BYTES) {
    return NextResponse.json({ error: "קובץ גדול מדי (מקס׳ 200MB)" }, { status: 413 });
  }

  const subtitlesJson = formData.get("subtitles") as string | null;
  const styleJson = formData.get("style") as string | null;
  const effectsJson = formData.get("effects") as string | null;
  if (!subtitlesJson || !styleJson) {
    return NextResponse.json({ error: "Missing subtitles/style" }, { status: 400 });
  }

  let subtitles: Subtitle[];
  let style: SubtitleStyle;
  let effects: VideoEffects;
  try {
    subtitles = JSON.parse(subtitlesJson);
    style = JSON.parse(styleJson);
    effects = effectsJson ? JSON.parse(effectsJson) : DEFAULT_EFFECTS;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const mode = (formData.get("mode") as EditMode) || "subtitles_only";
  const durationSec = Number(formData.get("durationSec")) || 10;

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
    // "original": keep the source aspect, cap the long edge at 1920 so the
    // render stays a sane size.
    const longEdge = Math.max(natW, natH);
    const k = longEdge > 1920 ? 1920 / longEdge : 1;
    canvasW = evenize(natW * k);
    canvasH = evenize(natH * k);
  }

  const cost = calcDynamicCost(mode, effects);
  const spent = await spendCredits(user.id, cost.total);
  if (!spent.ok) return NextResponse.json({ error: "אין מספיק מאסטרים" }, { status: 402 });

  // The renderer creates a per-request publicDir next to outPath, writes
  // the input video into it, then bundles with publicDir so Remotion
  // serves the video at <bundle>/<filename>.
  const workDir = join(tmpdir(), `remotion-${Date.now()}-${user.id}`);
  await mkdir(workDir, { recursive: true });
  const videoFileName = `input-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.mp4`;
  const outPath = join(workDir, "out.mp4");
  const videoBuffer = Buffer.from(await file.arrayBuffer());

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
      outPath,
    });
    const bytes = await readFile(outPath);
    return new NextResponse(bytes, {
      status: 200,
      headers: {
        "Content-Type": "video/mp4",
        "Content-Disposition": 'attachment; filename="master-video.mp4"',
      },
    });
  } catch (err) {
    console.error("[render-remotion] failed", err);
    // Refund credits so a server-side failure doesn't cost the user.
    await refundCredits(user.id, cost.total);
    return NextResponse.json(
      {
        error: "הייצוא נכשל. אנחנו על זה — נסי שוב בעוד דקה.",
        engine: "remotion",
        detail: String(err),
      },
      { status: 500 },
    );
  } finally {
    rm(workDir, { recursive: true, force: true }).catch(() => {});
  }
}
