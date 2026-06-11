/**
 * Multi-video AI editor endpoint.
 *
 * Receives N videos + a script. Transcribes each video, aligns script
 * segments to source video clips (script-first: clip length = reading time,
 * sequential footage when no speech match), cuts each clip, normalizes them
 * all to a common canvas, then joins them — either with a HARD CUT (concat
 * demuxer) or with BEAUTIFUL TRANSITIONS (xfade crossfades).
 *
 * To make the "add transitions" toggle fast, the client can send back the
 * previously-computed `picks` JSON; when present we SKIP transcription +
 * alignment and only re-cut + re-join. This keeps the toggle near-instant
 * (no Whisper) instead of re-running the whole pipeline.
 */

import { NextRequest, NextResponse } from "next/server";
import { spawn } from "node:child_process";
import { writeFile, mkdir, rm, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  alignScriptToVideos,
  buildOutputSubtitles,
  readingDurationSec,
  type ClipPick,
  type VideoTranscript,
} from "@/lib/multiVideo";
import type { Subtitle } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 1800;

// Curated, tasteful transition rotation — smooth and professional, not cheesy.
const TRANSITIONS = ["fade", "smoothleft", "circleopen", "smoothright", "slideup"];
const TRANSITION_DUR = 0.4; // seconds of crossfade between clips

import { getFfmpegPath, getFfprobePath } from "@/lib/ffmpegBinaries";
const ffmpegPath = getFfmpegPath;
const ffprobePath = getFfprobePath;

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const script = (formData.get("script") as string) || "";
  const transitionsMode = ((formData.get("transitions") as string) || "none").toLowerCase();
  const withTransitions = transitionsMode === "auto";
  const picksJson = formData.get("picks") as string | null;
  // When the user manually re-assigns which video fills a segment, the old
  // srcStart/srcEnd belong to a DIFFERENT video and are stale — recompute.
  const recompute = (formData.get("recomputeTiming") as string) === "1";

  // Accept video files under multiple `video` keys
  const files = formData.getAll("video").filter((v): v is File => v instanceof File);
  if (files.length < 2) {
    return NextResponse.json({ error: "צריך לפחות 2 סרטונים" }, { status: 400 });
  }
  if (files.length > 8) {
    return NextResponse.json({ error: "מקסימום 8 סרטונים" }, { status: 400 });
  }

  // When picks aren't supplied we need a script to compute them.
  let prevPicks: ClipPick[] | null = null;
  if (picksJson) {
    try { prevPicks = JSON.parse(picksJson) as ClipPick[]; } catch { prevPicks = null; }
  }
  if (!prevPicks && !script.trim()) {
    return NextResponse.json({ error: "חסר תסריט" }, { status: 400 });
  }

  const workDir = join(tmpdir(), "multi-edit", String(Date.now()));
  await mkdir(workDir, { recursive: true });

  try {
    // 1. Save all inputs
    const localPaths: string[] = [];
    for (let i = 0; i < files.length; i++) {
      const ext = (files[i].name.match(/\.[a-zA-Z0-9]+$/)?.[0] || ".mp4").toLowerCase();
      const p = join(workDir, `src-${i}${ext}`);
      await writeFile(p, Buffer.from(await files[i].arrayBuffer()));
      localPaths.push(p);
    }

    // 2. Probe every source once (duration + audio presence + dimensions)
    const infos = await Promise.all(localPaths.map((p) => probeInfo(p)));

    // Common canvas = first source's dimensions (keeps the user's intended
    // orientation; everything else is scaled+padded to fit). Guarantees
    // identical dims so BOTH concat methods + xfade work reliably.
    const canvasW = even(infos[0].width || 1080);
    const canvasH = even(infos[0].height || 1920);

    // 3. Compute picks — reuse cached ones (fast toggle) or align fresh.
    let picks: ClipPick[];
    if (prevPicks && prevPicks.length > 0) {
      picks = prevPicks;
      // Manual re-assignment: clamp each pick's time window to its (possibly
      // new) video, distributing multiple segments on the same video via a
      // moving cursor so they don't all start at 0.
      if (recompute) {
        const cursors = infos.map(() => 0);
        picks = picks.map((p) => {
          const want = readingDurationSec(p.scriptText);
          const dur = infos[p.videoIdx]?.duration ?? 0;
          let start = cursors[p.videoIdx] ?? 0;
          if (start + Math.min(1, want) >= dur) start = 0;
          const end = Math.min(dur, start + want);
          cursors[p.videoIdx] = end;
          return { ...p, srcStart: start, srcEnd: end, matchScore: 0, matchedSubText: "(בחירה ידנית)" };
        });
      }
    } else {
      const transcribed: VideoTranscript[] = await Promise.all(
        localPaths.map(async (p, idx) => {
          const subs = await transcribe(p);
          return { videoIdx: idx, durationSec: infos[idx].duration, subtitles: subs };
        }),
      );
      picks = alignScriptToVideos(script, transcribed);
      if (picks.length === 0) {
        return NextResponse.json({ error: "התסריט ריק אחרי פילוח" }, { status: 400 });
      }
    }

    // 4. Cut each pick into a normalized clip (common canvas + guaranteed audio)
    const clips = await cutClips(localPaths, infos, picks, workDir, canvasW, canvasH);

    // 5. Join — hard cut or xfade transitions
    const finalOut = join(workDir, "final.mp4");
    if (withTransitions && clips.length >= 2) {
      await concatXfade(clips, finalOut);
    } else {
      await concatHard(clips, workDir, finalOut);
    }

    // 6. Read result + extract one thumbnail per source video (for the
    //    manual clip picker in the UI). Cheap single-frame grabs.
    const buffer = await readFile(finalOut);
    const subs = buildOutputSubtitles(picks);
    const hardDur = subs.length > 0 ? subs[subs.length - 1].end : 0;
    const durationSec = withTransitions && clips.length >= 2
      ? Math.max(0, hardDur - (clips.length - 1) * TRANSITION_DUR)
      : hardDur;

    const thumbnails = await Promise.all(
      localPaths.map((p, i) => extractThumb(p, workDir, i, infos[i].duration)),
    );

    return NextResponse.json({
      videoBase64: buffer.toString("base64"),
      subtitles: subs,
      picks,
      thumbnails,
      durationSec,
      transitions: withTransitions ? "auto" : "none",
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  } finally {
    await rm(workDir, { recursive: true, force: true }).catch(() => {});
  }
}

/* ──────────────────────────── Transcription ──────────────────────────── */

function transcribe(videoPath: string): Promise<Subtitle[]> {
  return new Promise((resolve, reject) => {
    const python = process.env.PYTHON_PATH || "python";
    const scriptPath = join(process.cwd(), "scripts", "transcribe.py");
    const proc = spawn(python, [
      scriptPath, videoPath,
      "--model", "small",
      "--language", "he",
      "--max-words-per-line", "8",
    ], {
      env: { ...process.env, PYTHONIOENCODING: "utf-8", PYTHONUTF8: "1" },
    });
    let out = "", err = "";
    proc.stdout.setEncoding("utf8"); proc.stderr.setEncoding("utf8");
    proc.stdout.on("data", (d) => (out += d));
    proc.stderr.on("data", (d) => (err += d));
    proc.on("close", (code) => {
      if (code !== 0) return reject(new Error(`whisper נכשל (${code}): ${err.slice(-300)}`));
      try {
        const j = JSON.parse(out) as { subtitles?: Subtitle[] };
        resolve(j.subtitles ?? []);
      } catch {
        reject(new Error(`JSON לא תקין מ-whisper: ${out.slice(0, 200)}`));
      }
    });
    proc.on("error", (e) => reject(new Error(`spawn python נכשל: ${e.message}`)));
  });
}

/* ──────────────────────────── Probing ──────────────────────────── */

type SourceInfo = { duration: number; hasAudio: boolean; width: number; height: number };

function probeInfo(path: string): Promise<SourceInfo> {
  return new Promise((resolve) => {
    const proc = spawn(ffprobePath(), [
      "-v", "error",
      "-show_entries", "stream=codec_type,width,height",
      "-show_entries", "format=duration",
      "-of", "json",
      path,
    ]);
    let out = "";
    proc.stdout.on("data", (d) => (out += d.toString()));
    proc.on("close", () => {
      try {
        const j = JSON.parse(out) as {
          streams?: { codec_type?: string; width?: number; height?: number }[];
          format?: { duration?: string };
        };
        const streams = j.streams ?? [];
        const v = streams.find((s) => s.codec_type === "video");
        const hasAudio = streams.some((s) => s.codec_type === "audio");
        resolve({
          duration: parseFloat(j.format?.duration ?? "0") || 0,
          hasAudio,
          width: v?.width ?? 0,
          height: v?.height ?? 0,
        });
      } catch {
        resolve({ duration: 0, hasAudio: false, width: 0, height: 0 });
      }
    });
    proc.on("error", () => resolve({ duration: 0, hasAudio: false, width: 0, height: 0 }));
  });
}

/* ──────────────────────────── Thumbnails ──────────────────────────── */

/** Grab one representative frame (~30% in) and return it as a base64 data URL. */
async function extractThumb(src: string, workDir: string, idx: number, dur: number): Promise<string> {
  const at = Math.min(Math.max(0.5, dur * 0.3), Math.max(0.5, dur - 0.2));
  const thumbPath = join(workDir, `thumb-${idx}.jpg`);
  try {
    await runFfmpeg([
      "-y", "-ss", at.toFixed(2), "-i", src,
      "-frames:v", "1", "-vf", "scale=200:-1", "-q:v", "5",
      thumbPath,
    ]);
    const b = await readFile(thumbPath);
    return `data:image/jpeg;base64,${b.toString("base64")}`;
  } catch {
    return ""; // best-effort — UI falls back to a numbered placeholder
  }
}

/* ──────────────────────────── Cutting + joining ──────────────────────────── */

type Clip = { path: string; dur: number };

function even(n: number): number {
  const r = Math.round(n);
  return r % 2 === 0 ? r : r + 1;
}

/**
 * Cut each pick to a clip normalized to a common WxH canvas (scale to fit +
 * black pad), 30fps, square pixels, AAC stereo audio (silent track injected
 * for sources that have none — so xfade's acrossfade never fails).
 */
async function cutClips(
  sources: string[],
  infos: SourceInfo[],
  picks: ClipPick[],
  workDir: string,
  W: number, H: number,
): Promise<Clip[]> {
  const clips: Clip[] = [];
  const vf =
    `scale=${W}:${H}:force_original_aspect_ratio=decrease,` +
    `pad=${W}:${H}:(ow-iw)/2:(oh-ih)/2:black,setsar=1,fps=30,format=yuv420p`;

  for (let i = 0; i < picks.length; i++) {
    const p = picks[i];
    const dur = Math.max(0.2, p.srcEnd - p.srcStart);
    const clipPath = join(workDir, `clip-${String(i).padStart(3, "0")}.mp4`);
    const hasAudio = infos[p.videoIdx]?.hasAudio;

    const args: string[] = ["-y", "-ss", p.srcStart.toFixed(3), "-i", sources[p.videoIdx]];
    if (!hasAudio) {
      // Inject a silent stereo track so every clip has audio (xfade-safe).
      args.push("-f", "lavfi", "-i", "anullsrc=channel_layout=stereo:sample_rate=48000");
    }
    args.push(
      "-t", dur.toFixed(3),
      "-vf", vf,
      "-map", "0:v:0",
      "-map", hasAudio ? "0:a:0" : "1:a:0",
      "-c:v", "libx264", "-preset", "veryfast", "-crf", "20",
      "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-ac", "2",
      "-shortest",
      clipPath,
    );
    await runFfmpeg(args);
    clips.push({ path: clipPath, dur });
  }
  return clips;
}

/** Hard-cut join via the concat demuxer (clips are already normalized). */
async function concatHard(clips: Clip[], workDir: string, outputPath: string): Promise<void> {
  const list = clips.map((c) => `file '${c.path.replace(/\\/g, "/")}'`).join("\n");
  const listPath = join(workDir, "concat-list.txt");
  await writeFile(listPath, list);
  await runFfmpeg([
    "-y", "-f", "concat", "-safe", "0", "-i", listPath,
    "-c", "copy", outputPath,
  ]);
}

/**
 * Crossfade join via chained xfade (video) + acrossfade (audio). Builds a
 * filter_complex that overlaps each successive clip by TRANSITION_DUR using
 * a rotating set of tasteful transitions.
 */
async function concatXfade(clips: Clip[], outputPath: string): Promise<void> {
  const td = TRANSITION_DUR;
  const inputs: string[] = [];
  for (const c of clips) inputs.push("-i", c.path);

  const filters: string[] = [];
  let vLabel = "0:v";
  let aLabel = "0:a";
  let cumDur = clips[0].dur;

  for (let i = 1; i < clips.length; i++) {
    const offset = Math.max(0, cumDur - td);
    const tr = TRANSITIONS[(i - 1) % TRANSITIONS.length];
    const vOut = `v${i}`;
    const aOut = `a${i}`;
    filters.push(
      `[${vLabel}][${i}:v]xfade=transition=${tr}:duration=${td.toFixed(3)}:offset=${offset.toFixed(3)}[${vOut}]`,
    );
    filters.push(
      `[${aLabel}][${i}:a]acrossfade=d=${td.toFixed(3)}[${aOut}]`,
    );
    vLabel = vOut;
    aLabel = aOut;
    cumDur = cumDur + clips[i].dur - td;
  }

  await runFfmpeg([
    "-y",
    ...inputs,
    "-filter_complex", filters.join(";"),
    "-map", `[${vLabel}]`,
    "-map", `[${aLabel}]`,
    "-c:v", "libx264", "-preset", "veryfast", "-crf", "20",
    "-c:a", "aac", "-b:a", "192k", "-ar", "48000",
    "-movflags", "+faststart",
    outputPath,
  ]);
}

function runFfmpeg(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn(ffmpegPath(), args);
    let err = "";
    proc.stderr.on("data", (d) => (err += d.toString()));
    proc.on("close", (code) => {
      if (code === 0) return resolve();
      reject(new Error(`ffmpeg נכשל (${code}): ${err.slice(-400)}`));
    });
    proc.on("error", (e) => reject(new Error(`spawn ffmpeg: ${e.message}`)));
  });
}
