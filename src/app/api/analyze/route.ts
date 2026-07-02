import { NextRequest, NextResponse } from "next/server";
import { spawn } from "node:child_process";
import { writeFile, mkdir, unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { rateLimit } from "@/lib/rateLimit";

export const runtime = "nodejs";
export const maxDuration = 300;

// Hard upload cap. This route is anonymous (guest preview) and buffers the
// whole file into RAM via arrayBuffer() before writing to disk — without a
// cap a single multi-GB POST can OOM the small box. 300MB is generous for a
// short reel while staying well under available memory.
const MAX_VIDEO_BYTES = 300 * 1024 * 1024;

export async function POST(req: NextRequest) {
  // Security (audit C2): IP-rate-limit only. Like /transcribe, analyze is
  // part of the guest preview flow (face detect / emphasis) — we don't
  // gate it behind auth, but cap the burn from any single IP.
  const limited = rateLimit(req, { key: "analyze", max: 10, windowSec: 60 * 60 });
  if (limited) return limited;

  const formData = await req.formData();
  const file = formData.get("video") as File | null;
  if (!file) {
    return NextResponse.json({ error: "No video file" }, { status: 400 });
  }
  if (file.size > MAX_VIDEO_BYTES) {
    return NextResponse.json({ error: "הקובץ גדול מדי (מקס׳ 300MB)" }, { status: 413 });
  }

  const tempDir = join(tmpdir(), "subtitles-studio");
  await mkdir(tempDir, { recursive: true });
  const ext = (file.name.match(/\.[a-zA-Z0-9]+$/)?.[0] || ".mp4").toLowerCase();
  const tempPath = join(tempDir, `${Date.now()}-analyze${ext}`);
  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(tempPath, buffer);

  try {
    const result = await runAnalysis(tempPath);
    return NextResponse.json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  } finally {
    await unlink(tempPath).catch(() => {});
  }
}

function runAnalysis(videoPath: string) {
  return new Promise<unknown>((resolve, reject) => {
    const python = process.env.PYTHON_PATH || "python";
    const scriptPath = join(process.cwd(), "scripts", "analyze_video.py");

    const proc = spawn(python, [scriptPath, videoPath], {
      env: { ...process.env, PYTHONIOENCODING: "utf-8", PYTHONUTF8: "1" },
    });

    let stdout = "";
    let stderr = "";
    proc.stdout.setEncoding("utf8");
    proc.stderr.setEncoding("utf8");
    proc.stdout.on("data", (d: string) => (stdout += d));
    proc.stderr.on("data", (d: string) => (stderr += d));

    proc.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(`Analysis failed (code ${code}): ${stderr.slice(-500)}`));
        return;
      }
      try {
        resolve(JSON.parse(stdout));
      } catch {
        reject(new Error(`Invalid JSON from Python: ${stdout.slice(0, 200)}`));
      }
    });
    proc.on("error", (e) => reject(new Error(`Failed to spawn Python: ${e.message}`)));
  });
}
