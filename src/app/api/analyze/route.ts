import { NextRequest, NextResponse } from "next/server";
import { spawn } from "node:child_process";
import { writeFile, mkdir, unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const file = formData.get("video") as File | null;
  if (!file) {
    return NextResponse.json({ error: "No video file" }, { status: 400 });
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
