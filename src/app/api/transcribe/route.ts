import { NextRequest, NextResponse } from "next/server";
import { spawn } from "node:child_process";
import { writeFile, mkdir, unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

export const runtime = "nodejs";
export const maxDuration = 600;

// 25 MB is OpenAI's hard limit for /audio/transcriptions. Above that we'd
// need to slice the audio with ffmpeg first (future work — flag in error).
const OPENAI_MAX_BYTES = 25 * 1024 * 1024;

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const file = formData.get("video") as File | null;
  const maxWordsPerLine = parseInt(
    (formData.get("maxWordsPerLine") as string) || "2",
  );
  // model param kept for API compatibility but only used by the local Python
  // path. OpenAI side always uses whisper-1.
  const model = (formData.get("model") as string) || "small";

  if (!file) {
    return NextResponse.json({ error: "No video file" }, { status: 400 });
  }

  // Preferred path: OpenAI Whisper API. Costs ~$0.006/minute, no infra to run.
  if (process.env.OPENAI_API_KEY) {
    try {
      const result = await transcribeWithOpenAI(file, maxWordsPerLine);
      return NextResponse.json(result);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return NextResponse.json({ error: msg }, { status: 500 });
    }
  }

  // Local-dev fallback: spawn the existing Python script (Whisper / faster-whisper).
  // Will fail gracefully with a Hebrew message if Python is not installed.
  return await transcribeWithLocalPython(file, maxWordsPerLine, model);
}

// ── OpenAI Whisper API path ──────────────────────────────────────────
async function transcribeWithOpenAI(file: File, maxWordsPerLine: number) {
  if (file.size > OPENAI_MAX_BYTES) {
    throw new Error(
      `הקובץ גדול מדי (${(file.size / 1024 / 1024).toFixed(1)} MB). ` +
      "OpenAI Whisper מוגבל ל-25 MB. אנחנו עובדים על חיתוך אוטומטי לחלקים — בינתיים נסי סרטון קצר יותר.",
    );
  }

  const form = new FormData();
  form.append("file", file, file.name);
  form.append("model", "whisper-1");
  form.append("language", "he");
  form.append("response_format", "verbose_json");
  // Word-level timestamps so we can re-chunk into the editor's "N words per line" format
  form.append("timestamp_granularities[]", "word");
  // Hebrew prompt nudges OpenAI to transcribe in Hebrew script (not transliterated)
  form.append("prompt", "תמלול בעברית: ");

  const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    body: form,
  });
  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`OpenAI Whisper failed (${res.status}): ${errBody.slice(0, 300)}`);
  }

  const data = (await res.json()) as {
    language?: string;
    duration?: number;
    text?: string;
    words?: { word: string; start: number; end: number }[];
  };

  const rawWords = (data.words ?? []).map((w) => ({
    word: w.word.trim(),
    start: Math.round(w.start * 1000) / 1000,
    end: Math.round(w.end * 1000) / 1000,
  })).filter((w) => w.word.length > 0);

  const cleaned = cleanFillers(rawWords);
  const subtitles = chunkIntoSubtitles(cleaned, maxWordsPerLine);

  return {
    language: data.language ?? "he",
    duration: Math.round((data.duration ?? 0) * 1000) / 1000,
    model: "whisper-1",
    subtitles,
  };
}

// Port of the Python cleanup logic: drop hesitation fillers + collapse
// consecutive duplicate words (real stutter or Whisper re-output).
const FILLERS = new Set([
  "אמ", "אם", "אה", "אהה", "אהמ", "ממ", "מממ", "ההה",
  "um", "uh", "uhh", "umm", "hmm", "er", "ehm",
]);

function cleanFillers(words: { word: string; start: number; end: number }[]) {
  const out: typeof words = [];
  let prevLow: string | null = null;
  for (const w of words) {
    const stripped = w.word.replace(/[^\p{L}\p{N}]/gu, "");
    const low = stripped.toLowerCase();
    if (!stripped) {
      // Pure punctuation — attach to the previous word so it doesn't dangle
      if (out.length > 0) out[out.length - 1] = { ...out[out.length - 1], word: out[out.length - 1].word + w.word, end: w.end };
      continue;
    }
    if (FILLERS.has(low)) continue;
    if (prevLow !== null && low === prevLow) {
      out[out.length - 1] = { ...out[out.length - 1], end: w.end };
      continue;
    }
    out.push(w);
    prevLow = low;
  }
  return out;
}

function chunkIntoSubtitles(
  words: { word: string; start: number; end: number }[],
  chunkSize: number,
) {
  const subs: { id: string; start: number; end: number; text: string; words: typeof words }[] = [];
  for (let i = 0; i < words.length; i += chunkSize) {
    const chunk = words.slice(i, i + chunkSize);
    if (chunk.length === 0) continue;
    subs.push({
      id: String(subs.length + 1),
      start: chunk[0].start,
      end: chunk[chunk.length - 1].end,
      text: chunk.map((w) => w.word).join(" "),
      words: chunk,
    });
  }
  return subs;
}

// ── Local Python fallback (dev / future self-hosted Whisper) ────────────
async function transcribeWithLocalPython(file: File, maxWordsPerLine: number, model: string) {
  const tempDir = join(tmpdir(), "subtitles-studio");
  await mkdir(tempDir, { recursive: true });
  const ext = (file.name.match(/\.[a-zA-Z0-9]+$/)?.[0] || ".mp4").toLowerCase();
  const tempPath = join(tempDir, `${Date.now()}-video${ext}`);
  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(tempPath, buffer);

  const NATIVE_CRASH_CODES = new Set([3221225794, -1073741819]);
  const fallbackModels = [model];
  if (model !== "medium") fallbackModels.push("medium");
  if (model !== "small") fallbackModels.push("small");

  try {
    let lastErr: unknown = null;
    for (const m of fallbackModels) {
      try {
        const result = await runPython(tempPath, maxWordsPerLine, m);
        return NextResponse.json(result);
      } catch (err: unknown) {
        lastErr = err;
        const msg = err instanceof Error ? err.message : String(err);
        const crashed = [...NATIVE_CRASH_CODES].some((c) => msg.includes(String(c)));
        if (!crashed) throw err;
      }
    }
    const message = lastErr instanceof Error ? lastErr.message : String(lastErr);
    return NextResponse.json(
      { error: `כל המודלים קרסו. ${message}` },
      { status: 500 },
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  } finally {
    await unlink(tempPath).catch(() => {});
  }
}

function runPython(videoPath: string, maxWordsPerLine: number, model: string) {
  return new Promise<unknown>((resolve, reject) => {
    // 1) PYTHON_PATH env (set explicitly), 2) the venv we install in nixpacks.toml,
    // 3) system python (dev machines / Windows). Nixpacks [variables] aren't
    // always present at runtime, so the hard-coded /opt path is the reliable one.
    const python = process.env.PYTHON_PATH || "/opt/whisper-venv/bin/python3" || "python";
    const scriptPath = join(process.cwd(), "scripts", "transcribe.py");
    const proc = spawn(python, [
      scriptPath, videoPath, "--model", model, "--language", "he",
      "--max-words-per-line", String(maxWordsPerLine),
    ], { env: { ...process.env, PYTHONIOENCODING: "utf-8", PYTHONUTF8: "1" } });

    let stdout = ""; let stderr = "";
    proc.stdout.setEncoding("utf8");
    proc.stderr.setEncoding("utf8");
    proc.stdout.on("data", (d: string) => (stdout += d));
    proc.stderr.on("data", (d: string) => (stderr += d));

    proc.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(`Transcription failed (code ${code}): ${stderr.slice(-500)}`));
        return;
      }
      try { resolve(JSON.parse(stdout)); }
      catch { reject(new Error(`Invalid JSON from Python: ${stdout.slice(0, 200)}`)); }
    });
    proc.on("error", (e) => {
      if ((e as NodeJS.ErrnoException).code === "ENOENT") {
        reject(new Error(
          "תמלול לא זמין כרגע — Whisper לא הותקן על השרת ו-OPENAI_API_KEY לא הוגדר. " +
          "פני למפתחת.",
        ));
        return;
      }
      reject(new Error(`Failed to spawn Python: ${e.message}`));
    });
  });
}
