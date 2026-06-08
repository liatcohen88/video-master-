/**
 * Multi-video AI editor endpoint.
 *
 * Receives N videos + a script. Transcribes each video, aligns script
 * segments to source video clips by word-overlap, extracts each picked
 * clip with ffmpeg, concats them, then re-runs through the existing
 * render route to burn subtitles + apply effects.
 *
 * The actual subtitle burning + style is handled in a second pass by
 * the client (POST to /api/render with the concatenated MP4 + the
 * computed script-as-subtitles). This route returns the bare concat plus
 * the subtitle structure so the user can preview/edit before final burn.
 */

import { NextRequest, NextResponse } from "next/server";
import { spawn } from "node:child_process";
import { writeFile, mkdir, rm, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  alignScriptToVideos,
  buildOutputSubtitles,
  type ClipPick,
  type VideoTranscript,
} from "@/lib/multiVideo";
import type { Subtitle } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 1800;

function ffmpegPath(): string {
  return process.env.FFMPEG_PATH || "ffmpeg";
}
function ffprobePath(): string {
  return ffmpegPath().replace(/ffmpeg(\.exe)?$/i, (m) => m.replace("ffmpeg", "ffprobe"));
}

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const script = (formData.get("script") as string) || "";
  if (!script.trim()) {
    return NextResponse.json({ error: "חסר תסריט" }, { status: 400 });
  }

  // Accept video files under multiple `video` keys
  const files = formData.getAll("video").filter((v): v is File => v instanceof File);
  if (files.length < 2) {
    return NextResponse.json({ error: "צריך לפחות 2 סרטונים" }, { status: 400 });
  }
  if (files.length > 8) {
    return NextResponse.json({ error: "מקסימום 8 סרטונים" }, { status: 400 });
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

    // 2. Transcribe each video in parallel (Python whisper)
    const transcribed = await Promise.all(
      localPaths.map(async (p, idx) => {
        const subs = await transcribe(p);
        const dur = await probeDuration(p);
        const t: VideoTranscript = { videoIdx: idx, durationSec: dur, subtitles: subs };
        return t;
      }),
    );

    // 3. Align script → clip picks
    const picks = alignScriptToVideos(script, transcribed);
    if (picks.length === 0) {
      return NextResponse.json({ error: "התסריט ריק אחרי פילוח" }, { status: 400 });
    }

    // 4. Cut + concat
    const concatOut = join(workDir, "concat.mp4");
    await cutAndConcat(localPaths, picks, concatOut);

    // 5. Read result
    const buffer = await readFile(concatOut);
    const subs = buildOutputSubtitles(picks);

    // Returns a multipart-ish payload: JSON header with picks/subs +
    // base64 video. Cleaner than splitting into two requests for MVP.
    return NextResponse.json({
      videoBase64: buffer.toString("base64"),
      subtitles: subs,
      picks,
      durationSec: subs.length > 0 ? subs[subs.length - 1].end : 0,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  } finally {
    await rm(workDir, { recursive: true, force: true }).catch(() => {});
  }
}

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

function probeDuration(path: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const proc = spawn(ffprobePath(), [
      "-hide_banner", "-loglevel", "error",
      "-show_entries", "format=duration",
      "-of", "default=noprint_wrappers=1:nokey=1",
      path,
    ]);
    let out = "";
    proc.stdout.on("data", (d) => (out += d.toString()));
    proc.on("close", (code) => {
      if (code !== 0) return reject(new Error(`ffprobe נכשל (${code})`));
      resolve(parseFloat(out.trim()) || 0);
    });
  });
}

async function cutAndConcat(
  sources: string[], picks: ClipPick[], outputPath: string,
): Promise<void> {
  const concatList: string[] = [];
  const workDir = join(outputPath, "..");

  // Cut each pick into a separate clip — re-encode so concat demuxer
  // works regardless of source codecs (cheaper than full re-encode of the
  // joined output because each clip is small).
  for (let i = 0; i < picks.length; i++) {
    const p = picks[i];
    const clipPath = join(workDir, `clip-${String(i).padStart(3, "0")}.mp4`);
    await runFfmpeg([
      "-y",
      "-ss", p.srcStart.toFixed(3),
      "-i", sources[p.videoIdx],
      "-t", (p.srcEnd - p.srcStart).toFixed(3),
      // Normalize: same SAR, fps, audio codec, so the demuxer concat works.
      "-vf", "scale=trunc(iw/2)*2:trunc(ih/2)*2,setsar=1,fps=30",
      "-c:v", "libx264", "-preset", "veryfast", "-crf", "20",
      "-c:a", "aac", "-b:a", "192k", "-ar", "48000",
      clipPath,
    ]);
    concatList.push(`file '${clipPath.replace(/\\/g, "/")}'`);
  }

  const listPath = join(workDir, "concat-list.txt");
  await writeFile(listPath, concatList.join("\n"));

  await runFfmpeg([
    "-y", "-f", "concat", "-safe", "0", "-i", listPath,
    "-c", "copy", outputPath,
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
