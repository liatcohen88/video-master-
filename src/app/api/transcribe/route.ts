import { NextRequest, NextResponse } from "next/server";
import { spawn, spawnSync } from "node:child_process";
import { writeFile, mkdir, unlink, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import ffmpegStatic from "ffmpeg-static";
import { rateLimit } from "@/lib/rateLimit";

// Nix store paths shift between builds, but PyAV / ctranslate2 / libsndfile
// inside the venv only link via DT_NEEDED (the loader walks LD_LIBRARY_PATH).
// On first spawn we locate the relevant nix-store lib dirs and cache them.
let cachedLdPath: string | null = null;
function nixLibPath(): string {
  if (cachedLdPath !== null) return cachedLdPath;
  const find = (lib: string) => {
    try {
      const r = spawnSync("find", ["/nix/store", "-name", lib, "-not", "-path", "*/share/*"], { encoding: "utf8" });
      const first = (r.stdout || "").split("\n").find(Boolean);
      return first ? dirname(first) : "";
    } catch { return ""; }
  };
  const dirs = [
    find("libz.so.1.3.1"),
    find("libstdc++.so.6.0.32"),
    find("libstdc++.so.6.0.33"),
    find("libgcc_s.so.1"),
  ].filter(Boolean);
  cachedLdPath = Array.from(new Set(dirs)).join(":");
  return cachedLdPath;
}

export const runtime = "nodejs";
export const maxDuration = 600;

// 25 MB is OpenAI's hard limit for /audio/transcriptions. Above that we'd
// need to slice the audio with ffmpeg first (future work — flag in error).
const OPENAI_MAX_BYTES = 25 * 1024 * 1024;

// Hard cap on the RAW upload (before audio extraction). This route is
// anonymous (guest preview) and buffers the whole file into RAM, so without
// a ceiling a single multi-GB POST can OOM the box. 300MB comfortably covers
// a short reel; the extracted audio is checked against OPENAI_MAX_BYTES later.
const MAX_UPLOAD_BYTES = 300 * 1024 * 1024;

export async function POST(req: NextRequest) {
  // Security (audit C2): IP-based rate-limit. We deliberately do NOT
  // require auth here — guest visitors are supposed to upload + transcribe
  // + preview BEFORE the signup gate fires on export. The cap is tight
  // enough that a single IP can't drain OpenAI ($0.006/min × 60 = ~$0.36
  // worst case per hour) while still letting an honest guest test the
  // product without friction.
  const limited = rateLimit(req, { key: "transcribe", max: 10, windowSec: 60 * 60 });
  if (limited) return limited;

  const formData = await req.formData();
  const file = formData.get("video") as File | null;
  const maxWordsPerLine = parseInt(
    (formData.get("maxWordsPerLine") as string) || "2",
  );
  // model param kept for API compatibility but only used by the local Python
  // path. OpenAI side always uses whisper-1.
  const model = (formData.get("model") as string) || "small";

  if (!file) {
    return NextResponse.json({ error: "לא נמצא קובץ וידאו" }, { status: 400 });
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return NextResponse.json({ error: "הקובץ גדול מדי (מקס׳ 300MB)" }, { status: 413 });
  }

  // Preferred path: OpenAI Whisper API. Costs ~$0.006/minute, no infra to run.
  if (process.env.OPENAI_API_KEY) {
    try {
      const result = await transcribeWithOpenAI(file, maxWordsPerLine);
      return NextResponse.json(result);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[transcribe] OpenAI error:", msg);
      // Pass through our own Hebrew messages (e.g. the 25MB notice); hide raw
      // English/SDK errors behind a friendly generic line.
      const userMsg = /[֐-׿]/.test(msg)
        ? msg
        : "התמלול נכשל. אפשר לנסות שוב או עם סרטון אחר.";
      return NextResponse.json({ error: userMsg }, { status: 500 });
    }
  }

  // Local-dev fallback: spawn the existing Python script (Whisper / faster-whisper).
  // Will fail gracefully with a Hebrew message if Python is not installed.
  return await transcribeWithLocalPython(file, maxWordsPerLine, model);
}

// Extract a tiny mono 16kHz MP3 from the uploaded video with ffmpeg, so the
// OpenAI upload is ~10-20x smaller (much faster transcription) AND even long
// videos fit under OpenAI's 25MB limit. Whisper wants 16kHz mono anyway.
// Returns null on any failure → caller falls back to the original file.
async function extractAudioForWhisper(file: File): Promise<File | null> {
  const ff = ffmpegStatic as unknown as string | null;
  if (!ff) return null;
  const dir = join(tmpdir(), `vm-tx-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
  try {
    await mkdir(dir, { recursive: true });
    const inPath = join(dir, "in");
    const outPath = join(dir, "audio.mp3");
    await writeFile(inPath, Buffer.from(await file.arrayBuffer()));
    await new Promise<void>((resolve, reject) => {
      const p = spawn(ff, ["-y", "-i", inPath, "-vn", "-ac", "1", "-ar", "16000", "-b:a", "64k", outPath], { stdio: "ignore" });
      p.on("error", reject);
      p.on("close", (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg exited ${code}`))));
    });
    const buf = await readFile(outPath);
    if (!buf.length) return null;
    return new File([new Uint8Array(buf)], "audio.mp3", { type: "audio/mpeg" });
  } catch {
    return null;
  } finally {
    rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}

// ── OpenAI Whisper API path ──────────────────────────────────────────
async function transcribeWithOpenAI(file: File, maxWordsPerLine: number) {
  // Shrink to a tiny audio track first (faster upload + bypasses the 25MB
  // video cliff). On any extraction failure we send the original file.
  const audio = await extractAudioForWhisper(file);
  const upload = audio ?? file;
  if (upload.size > OPENAI_MAX_BYTES) {
    throw new Error(
      `הקובץ גדול מדי (${(upload.size / 1024 / 1024).toFixed(1)} MB). ` +
      "התמלול מוגבל ל-25 MB. אפשר לנסות סרטון קצר יותר.",
    );
  }

  const form = new FormData();
  form.append("file", upload, upload.name);
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
  // Punctuation that Whisper sometimes prepends to the NEXT word ("אותך",
  // ".זה") instead of suffixing the previous one. Pull these back onto the
  // previous word so the chunker can't split them onto a new subtitle.
  const LEAD_PUNCT = /^[.,!?;:׃]+/;
  for (const rawW of words) {
    let text = rawW.word.trim();
    const leadMatch = text.match(LEAD_PUNCT);
    if (leadMatch && out.length > 0) {
      out[out.length - 1] = { ...out[out.length - 1], word: out[out.length - 1].word + leadMatch[0] };
      text = text.slice(leadMatch[0].length).trimStart();
    }
    if (!text) continue;
    const w = { ...rawW, word: text };
    const stripped = text.replace(/[^\p{L}\p{N}]/gu, "");
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

  // Crash signals we treat as "try a smaller model" rather than surfacing.
  // - 3221225794 / -1073741819: Windows access violations
  // - "code null": Linux OOM killer / SIGKILL — what kills Whisper on CX23 when
  //   the large model + PyAV decoder + Node exceed available RAM mid-transcribe
  const NATIVE_CRASH_CODES = new Set([3221225794, -1073741819]);
  // Build the fallback chain, but ALWAYS skip the user's selection if it's the
  // large/turbo model and drop straight to small as the second try — large
  // succeeded loading but got OOM-killed during transcribe on 8GB RAM, so
  // retrying it again would just OOM again.
  const isLarge = /large|turbo|ivrit-ai/.test(model);
  const fallbackModels = [model];
  if (!isLarge && model !== "medium") fallbackModels.push("medium");
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
        const oomKilled = msg.includes("code null");
        const crashed = oomKilled || [...NATIVE_CRASH_CODES].some((c) => msg.includes(String(c)));
        if (!crashed) throw err;
      }
    }
    const message = lastErr instanceof Error ? lastErr.message : String(lastErr);
    return NextResponse.json(
      { error: `כל המודלים קרסו (חוסר זיכרון). כדאי לנסות סרטון קצר יותר. ${message}` },
      { status: 500 },
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[transcribe] error:", msg);
    const userMsg = /[֐-׿]/.test(msg) ? msg : "התמלול נכשל. אפשר לנסות שוב.";
    return NextResponse.json({ error: userMsg }, { status: 500 });
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
    const extraLd = nixLibPath();
    const proc = spawn(python, [
      scriptPath, videoPath, "--model", model, "--language", "he",
      "--max-words-per-line", String(maxWordsPerLine),
    ], {
      env: {
        ...process.env,
        PYTHONIOENCODING: "utf-8",
        PYTHONUTF8: "1",
        // Prepend the Nix-store lib dirs we discovered so PyAV / ctranslate2
        // can resolve libz, libstdc++, libgcc_s at load time.
        LD_LIBRARY_PATH: [extraLd, process.env.LD_LIBRARY_PATH].filter(Boolean).join(":"),
      },
    });

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
          "יש לפנות לתמיכה.",
        ));
        return;
      }
      reject(new Error(`Failed to spawn Python: ${e.message}`));
    });
  });
}
