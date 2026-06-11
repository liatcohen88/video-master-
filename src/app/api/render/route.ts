import { NextRequest, NextResponse } from "next/server";
import { spawn } from "node:child_process";
import { writeFile, mkdir, rm, readFile, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildFilterChain, cinematicColorFilter } from "@/lib/ffmpegFilter";
import { buildColorFilterFfmpeg } from "@/lib/colorFilterFfmpeg";
import {
  detectSilences,
  buildKeepIntervals,
  buildSelectExpression,
  retimeSubtitles,
  retimeTimestamp,
  type SilentRange,
} from "@/lib/silenceCut";
import {
  collectSfxTriggers,
  buildSfxFileInputs,
  buildSfxAudioGraph,
} from "@/lib/sfxMixer";
import {
  buildExportOverlays,
  buildOverlayFilterChain,
} from "@/lib/exportCompositor";
import type { Subtitle, SubtitleStyle, VideoEffects } from "@/lib/types";
import { DEFAULT_EFFECTS } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 1800;

import { getFfmpegPath, getFfprobePath } from "@/lib/ffmpegBinaries";
const ffmpegPath = getFfmpegPath;
const ffprobePath = getFfprobePath;

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const file = formData.get("video") as File | null;
  const bgMusicFile = formData.get("bgMusic") as File | null;
  const subtitlesJson = formData.get("subtitles") as string | null;
  const styleJson = formData.get("style") as string | null;
  const effectsJson = formData.get("effects") as string | null;

  if (!file || !subtitlesJson || !styleJson) {
    return NextResponse.json({ error: "Missing video/subtitles/style" }, { status: 400 });
  }

  let subtitles: Subtitle[];
  let style: SubtitleStyle;
  let effects: VideoEffects;
  try {
    subtitles = JSON.parse(subtitlesJson);
    style = JSON.parse(styleJson);
    effects = effectsJson ? JSON.parse(effectsJson) : DEFAULT_EFFECTS;
  } catch {
    return NextResponse.json({ error: "Invalid JSON in subtitles/style/effects" }, { status: 400 });
  }

  const baseTmp = join(tmpdir(), "subtitles-studio");
  const timestamp = Date.now();
  const workDir = join(baseTmp, `job-${timestamp}`);
  await mkdir(workDir, { recursive: true });
  const ext = (file.name.match(/\.[a-zA-Z0-9]+$/)?.[0] || ".mp4").toLowerCase();
  const inputPath = join(workDir, `input${ext}`);
  const outputPath = join(workDir, "output.mp4");

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(inputPath, buffer);

    // Background music: client uploads it as a separate field because the
    // editor stores it as a blob: URL the server can't fetch. Optional.
    let bgMusicPath: string | null = null;
    if (bgMusicFile && bgMusicFile.size > 0) {
      const bgExt = (bgMusicFile.name.match(/\.[a-zA-Z0-9]+$/)?.[0] || ".mp3").toLowerCase();
      bgMusicPath = join(workDir, `bgmusic${bgExt}`);
      await writeFile(bgMusicPath, Buffer.from(await bgMusicFile.arrayBuffer()));
    }

    const { width, height, duration } = await probeVideo(inputPath);

    // ── Silence cut (real) ────────────────────────────────────────────
    let finalSubtitles = subtitles;
    let silenceCut: { video: string; audio: string } | null = null;
    let appliedSilences: SilentRange[] = [];
    if (effects.cutSilence) {
      const silences = await detectSilences(
        ffmpegPath(), inputPath,
        effects.silenceThresholdDb, effects.silenceMinDurationSec,
      );
      if (silences.length > 0) {
        const keep = buildKeepIntervals(silences, duration);
        if (keep.length > 0) {
          const sel = buildSelectExpression(keep);
          silenceCut = {
            video: `select='${sel}',setpts=N/FRAME_RATE/TB`,
            audio: `aselect='${sel}',asetpts=N/SR/TB`,
          };
          finalSubtitles = retimeSubtitles(subtitles, silences);
          appliedSilences = silences;
        }
      }
    }

    // Re-time emphasis moments through the silence cut
    const emphasisRetimed = appliedSilences.length > 0
      ? (effects.emphasisMoments ?? []).map((t) => retimeTimestamp(t, appliedSilences))
      : (effects.emphasisMoments ?? []);

    // ── Geometric base filters (crop / scale / zoom) ──────────────────
    const chain = buildFilterChain(effects, width, height, duration);
    const baseVideoFilters: string[] = [...chain.videoFilters];
    if (effects.cinematicColor) {
      baseVideoFilters.push(...cinematicColorFilter(emphasisRetimed));
    }
    baseVideoFilters.push(...buildColorFilterFfmpeg(effects));

    // ── Build overlays: ONE baked track MOV (subs+emoji+brand) + logos + Lottie
    const overlaysEffects: VideoEffects = { ...effects, emphasisMoments: emphasisRetimed };
    const { trackMov, pngOverlays: overlays, lottieOverlays } = await buildExportOverlays({
      workDir,
      subtitles: finalSubtitles,
      style,
      effects: overlaysEffects,
      outputWidth: chain.outputWidth,
      outputHeight: chain.outputHeight,
      durationSec: duration,
      ffmpegPath: ffmpegPath(),
    });

    // ── SFX triggers (audio) ──────────────────────────────────────────
    // Aggregates auto-detected keyword elements + manual emojis + timed
    // logos + Lottie elements into a single list of (time, mp3 file) pairs.
    const sfxTriggers = collectSfxTriggers(
      { ...effects, emphasisMoments: emphasisRetimed },
      finalSubtitles,
      appliedSilences,
    );

    // ── Assemble FFmpeg command ───────────────────────────────────────
    // input 0            = video
    // inputs 1..S         = SFX MP3 files (from public/sfx/)
    // input  S+1          = overlay-track MOV (if any) — subs+emoji+brand baked
    // inputs next..       = custom-logo PNGs
    // inputs next..       = Lottie MOVs
    const args: string[] = ["-y", "-i", inputPath];
    if (sfxTriggers.length > 0) {
      args.push(...buildSfxFileInputs(sfxTriggers));
    }
    if (trackMov) args.push("-i", trackMov);
    for (const ov of overlays) args.push("-i", ov.pngPath);
    for (const lot of lottieOverlays) args.push("-i", lot.movPath);
    // Background music — `-stream_loop -1` makes ffmpeg loop the file if it's
    // shorter than the video; we trim back to duration in the audio graph.
    if (bgMusicPath) {
      args.push("-stream_loop", "-1", "-i", bgMusicPath);
    }

    const parts: string[] = [];
    // Base video chain (silence cut → crop/scale/zoom/color)
    const vBase: string[] = [];
    if (silenceCut) vBase.push(silenceCut.video);
    vBase.push(...baseVideoFilters);
    parts.push(`[0:v]${vBase.length ? vBase.join(",") : "copy"}[vbase]`);

    let finalLabel = "vbase";
    let inputCursor = 1 + sfxTriggers.length;

    // ONE overlay-track MOV (subtitles + emoji + brand) — single fast overlay
    if (trackMov) {
      const trackIdx = inputCursor++;
      parts.push(`[${finalLabel}][${trackIdx}:v]overlay=0:0:format=auto[vtrack]`);
      finalLabel = "vtrack";
    }

    // Custom-logo PNG overlays (few)
    const overlayInputStart = inputCursor;
    const { parts: ovParts, finalLabel: pngFinal } = buildOverlayFilterChain(
      overlays, finalLabel, overlayInputStart,
    );
    parts.push(...ovParts);
    finalLabel = pngFinal;
    inputCursor += overlays.length;

    // Lottie overlays (video inputs) — delay each so its t=0 aligns with start
    const lottieInputStart = inputCursor;
    lottieOverlays.forEach((lot, i) => {
      const inIdx = lottieInputStart + i;
      const delayed = `lot${i}`;
      const next = `lov${i}`;
      parts.push(`[${inIdx}:v]setpts=PTS+${lot.start.toFixed(3)}/TB[${delayed}]`);
      parts.push(
        `[${finalLabel}][${delayed}]overlay=x='${lot.x}':y='${lot.y}':` +
          `enable='between(t,${lot.start.toFixed(3)},${lot.end.toFixed(3)})':format=auto[${next}]`,
      );
      finalLabel = next;
    });
    // Advance the cursor past the Lottie inputs — required so the bgMusic
    // input index below points to the right ffmpeg input. Was latent before
    // bgMusic existed because nothing read inputCursor after this loop.
    inputCursor += lottieOverlays.length;

    // bgMusic input index — it's the LAST input we appended.
    const bgMusicIdx = bgMusicPath ? inputCursor : -1;
    if (bgMusicPath) inputCursor++;

    // Audio chain
    const videoVol = Math.max(0, Math.min(1, effects.videoVolume ?? 1));
    const bgVol = Math.max(0, Math.min(1, effects.bgMusicVolume ?? 0.25));
    const hasAudioGraph = silenceCut || sfxTriggers.length > 0 || bgMusicPath || videoVol !== 1;
    let aoutLabel = "aout";
    if (hasAudioGraph) {
      // Apply video-track volume FIRST so subsequent silence-cut keeps it scaled.
      // When videoVol === 1, skip the explicit volume filter to keep the graph
      // clean and avoid losing the silence-cut benefit.
      const v0Filter = silenceCut
        ? silenceCut.audio
        : (videoVol !== 1 ? `volume=${videoVol.toFixed(3)}` : "anull");
      parts.push(`[0:a]${v0Filter}[abase]`);

      // Background music: trim to video duration so the looped track doesn't
      // bleed past the end, then scale to user's volume.
      let bgLabel: string | null = null;
      if (bgMusicPath) {
        bgLabel = "abg";
        parts.push(
          `[${bgMusicIdx}:a]atrim=0:${duration.toFixed(3)},asetpts=N/SR/TB,` +
            `volume=${bgVol.toFixed(3)}[${bgLabel}]`,
        );
      }

      if (sfxTriggers.length > 0) {
        const { parts: sfxParts, outLabel } = buildSfxAudioGraph(
          sfxTriggers, "abase", /* sfxInputStartIdx */ 1, bgLabel,
          effects.sfxMasterVolume ?? 1,
        );
        parts.push(...sfxParts);
        aoutLabel = outLabel;
      } else if (bgLabel) {
        // Just bg music + video — no SFX. Mix the two directly.
        // Weights keep speech (3) clearly above music (1).
        parts.push(`[abase][${bgLabel}]amix=inputs=2:duration=first:dropout_transition=0:weights='3 1':normalize=1[aout]`);
      } else {
        parts.push(`[abase]acopy[aout]`);
      }
    }
    args.push("-filter_complex", parts.join(";"));
    args.push("-map", `[${finalLabel}]`);
    args.push("-map", hasAudioGraph ? `[${aoutLabel}]` : "0:a?");

    args.push(
      // fast + crf 19: noticeable quality bump over veryfast/crf 20 (especially
      // on subtitle edges and gradient backgrounds), ~30-50% slower encode.
      // Sweet spot for Reels/social where text legibility matters most.
      "-c:v", "libx264", "-preset", "fast", "-crf", "19", "-threads", "0",
      "-pix_fmt", "yuv420p", "-movflags", "+faststart",
      // tune=film keeps psy-rd higher → cleaner gradients in faces/skies;
      // overrides veryfast's heavy denoising that washes out detail.
      "-tune", "film",
      "-c:a", "aac", "-b:a", "192k",
      outputPath,
    );

    await runFfmpeg(args);

    const output = await readFile(outputPath);
    const now = new Date();
    const dateStamp = `${now.getDate()}-${now.getMonth() + 1}-${now.getFullYear()}`;
    return new NextResponse(output as unknown as BodyInit, {
      headers: {
        "Content-Type": "video/mp4",
        "Content-Disposition": `attachment; filename="video-master-${dateStamp}.mp4"`,
        "Content-Length": String(output.length),
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  } finally {
    await rm(workDir, { recursive: true, force: true }).catch(() => {});
  }
}

function probeVideo(path: string): Promise<{ width: number; height: number; duration: number }> {
  return new Promise(async (resolve, reject) => {
    try {
      const s = await stat(path);
      if (s.size === 0) return reject(new Error("קובץ הקלט ריק"));
    } catch (e) {
      return reject(new Error(`קובץ הקלט לא נמצא: ${(e as Error).message}`));
    }
    // -show_streams gives us side_data_list (Display Matrix) + tags.rotate so
    // we can return the DISPLAY orientation, not the raw coded one. Phone
    // clips are often stored landscape (e.g. 1280x720) with a 90° rotation
    // flag; ffmpeg auto-rotates them to portrait on decode, so the overlay
    // track MUST be rendered at the rotated (portrait) size or it lands off to
    // the side and gets clipped. This is THE fix for "subtitles on the side".
    const proc = spawn(ffprobePath(), [
      "-hide_banner", "-loglevel", "error",
      "-select_streams", "v:0",
      "-show_streams", "-show_format",
      "-of", "json", path,
    ]);
    let out = "", err = "";
    proc.stdout.on("data", (d) => (out += d));
    proc.stderr.on("data", (d) => (err += d));
    proc.on("close", (code) => {
      if (code !== 0) return reject(new Error(`ffprobe נכשל (${code}): ${err.slice(-300)}`));
      try {
        const j = JSON.parse(out);
        const st = (j.streams ?? []).find((s: { codec_type?: string }) => s.codec_type === "video") ?? j.streams?.[0];
        if (!st) return reject(new Error("אין זרם וידאו בקלט"));
        let width = Number(st.width);
        let height = Number(st.height);
        // Resolve net display rotation from tags.rotate AND Display Matrix side data
        let rot = 0;
        if (st.tags?.rotate) rot = parseInt(st.tags.rotate, 10) || 0;
        if (Array.isArray(st.side_data_list)) {
          for (const sd of st.side_data_list) {
            if (sd?.rotation !== undefined && sd?.rotation !== null) {
              const r = parseInt(String(sd.rotation), 10);
              if (!Number.isNaN(r)) rot = r;
            }
          }
        }
        rot = ((Math.round(rot) % 360) + 360) % 360;
        if (rot === 90 || rot === 270) { const t = width; width = height; height = t; }
        resolve({ width, height, duration: parseFloat(j.format?.duration ?? "0") });
      } catch (e) {
        reject(new Error(`כשל פענוח ffprobe: ${(e as Error).message}`));
      }
    });
    proc.on("error", (e) => reject(new Error(`spawn ffprobe נכשל: ${e.message}`)));
  });
}

function runFfmpeg(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const startedAt = Date.now();
    console.log(`[render] ffmpeg starting (${args.length} args)`);
    const proc = spawn(ffmpegPath(), args);
    let err = "";
    let lastProgressAt = Date.now();
    proc.stderr.on("data", (d) => {
      err += d.toString();
      // ffmpeg writes progress to stderr; touching this keeps the watchdog alive
      lastProgressAt = Date.now();
    });
    // Watchdog: if ffmpeg goes silent for 60s, kill it — better than hanging forever.
    const watchdog = setInterval(() => {
      if (Date.now() - lastProgressAt > 60_000) {
        clearInterval(watchdog);
        proc.kill("SIGKILL");
        console.error("[render] ffmpeg killed by watchdog (60s no progress)");
      }
    }, 5_000);
    proc.on("close", (code) => {
      clearInterval(watchdog);
      const took = Math.round((Date.now() - startedAt) / 1000);
      console.log(`[render] ffmpeg exit ${code} after ${took}s`);
      if (code === 0) return resolve();
      reject(new Error(`ffmpeg נכשל (${code}, ${took}s): ${err.slice(-800)}`));
    });
    proc.on("error", (e) => {
      clearInterval(watchdog);
      reject(new Error(`spawn ffmpeg נכשל: ${e.message}`));
    });
  });
}
