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
import { writeFile, mkdir, rm, readFile } from "node:fs/promises";
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
  const cost = calcDynamicCost(mode, effects);
  const spent = await spendCredits(user.id, cost, "render-remotion");
  if (!spent) return NextResponse.json({ error: "אין מספיק מאסטרים" }, { status: 402 });

  // Stage the source video on disk so headless Chromium can <video src=...>
  // it via file://. tmpdir() is wiped on container restart — that's fine
  // since each render is independent.
  const workDir = join(tmpdir(), `remotion-${Date.now()}-${user.id}`);
  await mkdir(workDir, { recursive: true });
  const videoPath = join(workDir, "input.mp4");
  const outPath = join(workDir, "out.mp4");
  await writeFile(videoPath, Buffer.from(await file.arrayBuffer()));

  try {
    await renderViaRemotion({
      inputProps: {
        videoSrc: `file://${videoPath}`,
        subtitles,
        style,
        effects,
        width: 1080,
        height: 1920,
        durationSec,
        fps: 30,
      },
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
    // Refund credits — the user paid for a render they didn't get. The
    // client is expected to auto-retry against /api/render (FFmpeg), which
    // will charge again on success.
    await refundCredits(user.id, cost.total);
    return NextResponse.json(
      {
        error: "ייצוא נכשל בנתיב הראשי. ניסיון חוזר אוטומטי...",
        engine: "remotion",
        detail: String(err),
        retry: "/api/render",
      },
      { status: 500 },
    );
  } finally {
    rm(workDir, { recursive: true, force: true }).catch(() => {});
  }
}
