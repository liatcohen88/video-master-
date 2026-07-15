/**
 * POST /api/whatsapp/process   (multipart: video, phone, mode, model)
 * Server-to-server (WhatsApp bot only, guarded by the shared secret).
 *
 * Orchestrates the headless pipeline WITHOUT touching the live editor/export
 * paths: it calls the SAME /api/transcribe and /api/render-remotion endpoints
 * internally (localhost) — render-remotion runs under bot-delegated auth
 * (x-mv-bot-secret + x-mv-user-id), so the user's credits are charged and the
 * shared render-slot semaphore is respected exactly like a browser export.
 *
 *   resolve phone → user  →  transcribe (Hebrew or translate)  →
 *   build default project for the mode  →  render  →  { jobId }
 */
import { NextRequest, NextResponse } from "next/server";
import { botSecretOk } from "@/lib/apiAuth";
import { resolveUserByPhone, buildHeadlessProject, coerceMode, normalizePhone, connectToken } from "@/lib/whatsappHeadless";
import { getCreditBalance } from "@/lib/serverCredits";
import { flattenWords, buildSubtitles } from "@/lib/subtitleSettings";
import type { Subtitle } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 300;

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://master-video.co.il").replace(/\/$/, "");
const INTERNAL_URL = (process.env.MV_INTERNAL_URL || `http://127.0.0.1:${process.env.PORT || 3001}`).replace(/\/$/, "");
const BOT_SECRET = process.env.MV_BOT_SECRET || "";

export async function POST(req: NextRequest) {
  if (!botSecretOk(req)) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const inForm = await req.formData();
  const file = inForm.get("video") as File | null;
  const phone = (inForm.get("phone") as string) || "";
  const mode = coerceMode(inForm.get("mode") as string);
  const model = (inForm.get("model") as string) || "";
  if (!file) return NextResponse.json({ error: "missing video" }, { status: 400 });
  if (!phone) return NextResponse.json({ error: "missing phone" }, { status: 400 });

  // 1. Attribute to an account.
  const user = await resolveUserByPhone(phone);
  if (!user) {
    const p = normalizePhone(phone);
    return NextResponse.json(
      { error: "not_linked", connectUrl: `${SITE_URL}/connect-whatsapp?phone=${encodeURIComponent(p)}&token=${connectToken(p)}` },
      { status: 404 },
    );
  }

  // 2. Fast-fail on an empty balance (render-remotion also gates via spendCredits).
  let balance = 0;
  try { balance = await getCreditBalance(user.userId); } catch { balance = 0; }
  if (balance <= 0) {
    return NextResponse.json({ error: "no_credits", buyUrl: `${SITE_URL}/pricing` }, { status: 402 });
  }

  const { style, effects, settings } = buildHeadlessProject(mode);
  const videoBuf = Buffer.from(await file.arrayBuffer());
  const videoType = file.type || "video/mp4";
  const videoName = file.name || "input.mp4";

  // 3. Transcribe (internal). model "translate-he" → English→Hebrew; else Hebrew.
  let subtitles: unknown[];
  let durationSec = 10;
  try {
    const tForm = new FormData();
    tForm.append("video", new Blob([videoBuf], { type: videoType }), videoName);
    tForm.append("maxWordsPerLine", String(settings.maxWordsPerLine));
    tForm.append("model", model);
    const tRes = await fetch(`${INTERNAL_URL}/api/transcribe`, { method: "POST", body: tForm });
    const tData = await tRes.json().catch(() => ({}));
    if (!tRes.ok) {
      return NextResponse.json({ error: tData.error || "transcribe_failed" }, { status: 502 });
    }
    subtitles = Array.isArray(tData.subtitles) ? tData.subtitles : [];
    durationSec = Number(tData.duration) || 10;
  } catch (e) {
    console.error("[whatsapp/process] transcribe error:", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "transcribe_failed" }, { status: 502 });
  }
  if (!subtitles.length) {
    return NextResponse.json({ error: "no_speech" }, { status: 422 });
  }

  // Smart re-chunk — the SAME engine the editor uses (punctuation + silence
  // breaks, auto-commas, min-words merge, stretch). The transcribe route only
  // does a dumb fixed-size chunk; without this pass the WhatsApp output broke
  // lines mid-sentence and had no commas (Liat 15/7: "שיבין מתי לעבור שורה").
  try {
    const base = flattenWords(subtitles as Subtitle[]);
    if (base.length) subtitles = buildSubtitles(base, settings);
  } catch (e) {
    console.error("[whatsapp/process] rechunk failed (keeping raw):", e instanceof Error ? e.message : e);
  }

  // 4. Render (internal) under bot-delegated auth → jobId.
  try {
    const rForm = new FormData();
    rForm.append("video", new Blob([videoBuf], { type: videoType }), videoName);
    rForm.append("subtitles", JSON.stringify(subtitles));
    rForm.append("style", JSON.stringify(style));
    rForm.append("effects", JSON.stringify(effects));
    rForm.append("mode", mode);
    rForm.append("durationSec", String(durationSec));
    const rRes = await fetch(`${INTERNAL_URL}/api/render-remotion`, {
      method: "POST",
      headers: { "x-mv-bot-secret": BOT_SECRET, "x-mv-user-id": user.userId },
      body: rForm,
    });
    const rData = await rRes.json().catch(() => ({}));
    if (rRes.status === 402) {
      return NextResponse.json({ error: "no_credits", buyUrl: `${SITE_URL}/pricing` }, { status: 402 });
    }
    if (!rRes.ok || !rData.jobId) {
      return NextResponse.json({ error: rData.error || "render_failed" }, { status: 502 });
    }
    return NextResponse.json({ jobId: rData.jobId });
  } catch (e) {
    console.error("[whatsapp/process] render error:", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "render_failed" }, { status: 502 });
  }
}
