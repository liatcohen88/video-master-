import { NextRequest, NextResponse } from "next/server";
import { spawn } from "node:child_process";
import { writeFile, mkdir, unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

export const runtime = "nodejs";
export const maxDuration = 600;

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const file = formData.get("video") as File | null;
  const maxWordsPerLine = parseInt(
    (formData.get("maxWordsPerLine") as string) || "2",
  );
  const model = (formData.get("model") as string) || "small";

  if (!file) {
    return NextResponse.json({ error: "No video file" }, { status: 400 });
  }

  // Save to temp file (sanitize filename to avoid Hebrew/special chars in path)
  const tempDir = join(tmpdir(), "subtitles-studio");
  await mkdir(tempDir, { recursive: true });
  const ext = (file.name.match(/\.[a-zA-Z0-9]+$/)?.[0] || ".mp4").toLowerCase();
  const tempPath = join(tempDir, `${Date.now()}-video${ext}`);
  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(tempPath, buffer);

  // Native crashes (Windows Access Violation = 3221225794) kill the Python
  // process before any try/except can run, so the in-Python fallback chain
  // can't help. We retry at THIS layer with progressively smaller models.
  const NATIVE_CRASH_CODES = new Set([3221225794, -1073741819]);
  const fallbackModels = [model];
  if (model !== "medium") fallbackModels.push("medium");
  if (model !== "small") fallbackModels.push("small");

  try {
    let lastErr: unknown = null;
    for (const m of fallbackModels) {
      try {
        const result = await runTranscription(tempPath, maxWordsPerLine, m);
        return NextResponse.json(result);
      } catch (err: unknown) {
        lastErr = err;
        const msg = err instanceof Error ? err.message : String(err);
        // Only fall through on a native crash / OOM — not on real errors
        const crashed = [...NATIVE_CRASH_CODES].some((c) => msg.includes(String(c)));
        if (!crashed) throw err; // genuine error — surface it immediately
        // else: loop continues to the next smaller model
      }
    }
    const message = lastErr instanceof Error ? lastErr.message : String(lastErr);
    return NextResponse.json(
      { error: `כל המודלים קרסו (זיכרון נמוך). נסי לסגור טאבים. ${message}` },
      { status: 500 },
    );
  } finally {
    await unlink(tempPath).catch(() => {});
  }
}

function runTranscription(videoPath: string, maxWordsPerLine: number, model: string) {
  return new Promise<unknown>((resolve, reject) => {
    const python = process.env.PYTHON_PATH || "python";
    const scriptPath = join(process.cwd(), "scripts", "transcribe.py");

    const proc = spawn(python, [
      scriptPath,
      videoPath,
      "--model", model,
      "--language", "he",
      "--max-words-per-line", String(maxWordsPerLine),
    ], {
      env: {
        ...process.env,
        // Force Python to output UTF-8 (Windows defaults break Hebrew)
        PYTHONIOENCODING: "utf-8",
        PYTHONUTF8: "1",
      },
    });

    let stdout = "";
    let stderr = "";
    // Explicitly decode as UTF-8 (default is system locale on Windows)
    proc.stdout.setEncoding("utf8");
    proc.stderr.setEncoding("utf8");
    proc.stdout.on("data", (d: string) => (stdout += d));
    proc.stderr.on("data", (d: string) => (stderr += d));

    proc.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(`Transcription failed (code ${code}): ${stderr.slice(-500)}`));
        return;
      }
      try {
        resolve(JSON.parse(stdout));
      } catch {
        reject(new Error(`Invalid JSON from Python: ${stdout.slice(0, 200)}`));
      }
    });

    proc.on("error", (e) => {
      // ENOENT = Python not installed on the host. On the launch server we
      // ship a slim Node image without Python+Whisper, so transcription is
      // unavailable until we install Whisper or wire an external API. Tell
      // the user something they can act on instead of the raw spawn error.
      if ((e as NodeJS.ErrnoException).code === "ENOENT") {
        reject(new Error(
          "תמלול לא זמין כרגע — Whisper עדיין לא הותקן על השרת. " +
          "אנחנו עובדים על זה בדקות הקרובות. את יכולה להמשיך לערוך עם כתוביות שתעתיקי ידנית בינתיים.",
        ));
        return;
      }
      reject(new Error(`Failed to spawn Python: ${e.message}`));
    });
  });
}
