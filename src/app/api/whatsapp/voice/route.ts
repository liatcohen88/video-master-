/**
 * POST /api/whatsapp/voice   (multipart: audio, phone, engine?)
 * Server-to-server (WhatsApp bot only, guarded by the shared secret).
 *
 * Voice note in → plain text out. Deliberately OUTSIDE the paid editing
 * pipeline: no render, no credits. Transcription alone is either fractions of
 * an agora (OpenAI whisper-1, ~$0.006/min) or literally free when engine=local
 * runs the faster-whisper venv that already ships on this box (nixpacks.toml).
 *
 * Long recordings also come back with a short bullet summary, because the
 * point of the bot is "tell me what was said" — not a wall of text.
 */
import { NextRequest, NextResponse } from "next/server";
import { botSecretOk } from "@/lib/apiAuth";

export const runtime = "nodejs";
export const maxDuration = 600;

const INTERNAL_URL = (process.env.MV_INTERNAL_URL || `http://127.0.0.1:${process.env.PORT || 3001}`).replace(/\/$/, "");
const BOT_SECRET = () => process.env.MV_BOT_SECRET || "";

// Below this a transcript is short enough to just read — a summary would be
// longer than the thing it summarizes.
const SUMMARY_MIN_CHARS = 1200;

type TranscribeResponse = {
  text?: string;
  duration?: number;
  subtitles?: { text?: string }[];
  error?: string;
};

export async function POST(req: NextRequest) {
  if (!botSecretOk(req)) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const form = await req.formData();
  const file = form.get("audio") as File | null;
  if (!file) return NextResponse.json({ error: "missing audio" }, { status: 400 });
  const engine = ((form.get("engine") as string) || "").toLowerCase();

  // Reuse the SAME transcription endpoint the site and the video bot use —
  // it is format-agnostic (ffmpeg strips to mono 16kHz mp3 before upload), so
  // a WhatsApp ogg/opus voice note goes through untouched.
  let data: TranscribeResponse;
  try {
    const tForm = new FormData();
    tForm.append("video", file, file.name || "voice.ogg");
    tForm.append("maxWordsPerLine", "12");
    if (engine) tForm.append("engine", engine);
    const res = await fetch(`${INTERNAL_URL}/api/transcribe`, {
      method: "POST",
      headers: { "x-mv-bot-secret": BOT_SECRET() },
      body: tForm,
    });
    data = (await res.json().catch(() => ({}))) as TranscribeResponse;
    if (!res.ok) {
      return NextResponse.json({ error: data.error || "transcribe_failed" }, { status: 502 });
    }
  } catch (e) {
    console.error("[whatsapp/voice] transcribe error:", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "transcribe_failed" }, { status: 502 });
  }

  const text = (data.text || (data.subtitles ?? []).map((s) => s.text ?? "").join(" "))
    .replace(/\s+/g, " ")
    .trim();
  if (!text) return NextResponse.json({ error: "no_speech" }, { status: 422 });

  const summary = text.length >= SUMMARY_MIN_CHARS ? await summarize(text) : "";
  return NextResponse.json({ text, duration: Number(data.duration) || 0, summary });
}

/**
 * 2-4 bullet Hebrew summary via gpt-4o-mini (~fractions of a cent).
 * Best-effort: any failure just means the transcript ships without it.
 */
async function summarize(text: string): Promise<string> {
  if (!process.env.OPENAI_API_KEY) return "";
  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0.2,
        messages: [
          {
            role: "system",
            content:
              "You summarize a Hebrew voice-message transcript for the person who received it. " +
              "Reply in Hebrew only, as 2-4 short bullet lines starting with '• '. " +
              "Capture what was said and any request, decision, date or number mentioned. " +
              "Use gender-neutral Hebrew phrasing. No preface, no title, no closing line.",
          },
          // Cap the prompt: a very long recording still summarizes from its
          // first ~12k chars instead of blowing up the request.
          { role: "user", content: text.slice(0, 12000) },
        ],
      }),
    });
    if (!res.ok) throw new Error(`summary failed (${res.status})`);
    const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    return (data.choices?.[0]?.message?.content ?? "").trim();
  } catch (e) {
    console.error("[whatsapp/voice] summary failed:", e instanceof Error ? e.message : e);
    return "";
  }
}
