/**
 * WhatsApp Business Cloud API webhook (Phase 2 — the OFFICIAL platform).
 *
 * GET  — Meta's one-time verification handshake (hub.challenge echo).
 * POST — inbound events. Full conversation logic lives HERE on the server
 *        (not on Liat's PC): video in → style menu (interactive list) →
 *        internal /api/whatsapp/process (transcribe + render, credits charged)
 *        → poll job → send the finished MP4 back via the Graph API.
 *
 * Design notes:
 * - Meta requires a fast 200; heavy work runs in a fire-and-forget task held
 *   in a module-level Set (same pattern as render-remotion's runningJobs).
 * - Conversation state is in-memory (single container). A mid-conversation
 *   deploy loses pending menus — acceptable for the pilot; users just resend.
 * - Media: inbound video via Graph media_id → url → bytes (Bearer auth both
 *   steps). Outbound MP4 via {video:{link}} pointing at our tokenized
 *   /api/whatsapp/result URL (served from this box, no Supabase egress).
 * - Copy is gender-neutral per the site-wide rule.
 */
import { NextRequest, NextResponse } from "next/server";
import { resolveUserByPhone, normalizePhone, connectToken } from "@/lib/whatsappHeadless";
import { getCreditBalance } from "@/lib/serverCredits";
import { getJob, outputReady } from "@/lib/renderJobs";
import { resultToken } from "@/lib/whatsappHeadless";

export const runtime = "nodejs";
export const maxDuration = 300;

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://master-video.co.il").replace(/\/$/, "");
const INTERNAL_URL = (process.env.MV_INTERNAL_URL || `http://127.0.0.1:${process.env.PORT || 3001}`).replace(/\/$/, "");
const GRAPH = "https://graph.facebook.com/v21.0";
const TOKEN = () => process.env.WA_CLOUD_TOKEN || "";
const PHONE_ID = () => process.env.WA_CLOUD_PHONE_ID || "";
const VERIFY_TOKEN = () => process.env.WA_VERIFY_TOKEN || "";
const BOT_SECRET = () => process.env.MV_BOT_SECRET || "";

// ── Voice notes → text (free: no credits, no render) ─────────────────
// Transcription is the cheap half of the pipeline (~$0.006/min on OpenAI, or
// $0 with WA_VOICE_ENGINE=local on the box's own faster-whisper), so it is NOT
// charged in מאסטרים. The caps below are what keeps it that way.
const VOICE_ENABLED = () => (process.env.WA_VOICE_ENABLED || "true") !== "false";
const VOICE_ENGINE = () => process.env.WA_VOICE_ENGINE || "";
const VOICE_REQUIRE_LINK = () => (process.env.WA_VOICE_REQUIRE_LINK || "true") !== "false";
const VOICE_DAILY_MAX = () => Math.max(1, Number(process.env.WA_VOICE_DAILY_MAX || 40));
// Numbers that skip the linked-account gate entirely (Liat's own phone by
// default) — so the owner can use the bot before linking anything.
const voiceAllowList = () =>
  new Set(
    (process.env.WA_VOICE_ALLOW || process.env.MV_OWNER_PHONE || "0507766429")
      .split(",")
      .map((x) => normalizePhone(x))
      .filter(Boolean),
  );

// Per-phone daily cap. In-memory like the rest of this file's state — a deploy
// resets it, which only ever makes us MORE generous.
const voiceQuota = new Map<string, { day: string; n: number }>();
function voiceQuotaExceeded(from: string): boolean {
  const day = new Date().toISOString().slice(0, 10);
  const prev = voiceQuota.get(from);
  const rec = prev && prev.day === day ? prev : { day, n: 0 };
  if (rec.n >= VOICE_DAILY_MAX()) {
    voiceQuota.set(from, rec);
    return true;
  }
  rec.n += 1;
  voiceQuota.set(from, rec);
  return false;
}

// ── Conversation state (in-memory; single container) ─────────────────
type Convo = {
  step: "await_choice";
  mediaId: string;
  mimeType: string;
  updatedAt: number;
};
const convos = new Map<string, Convo>();
const CONVO_TTL_MS = 30 * 60 * 1000;
function gcConvos() {
  const now = Date.now();
  for (const [k, v] of convos) if (now - v.updatedAt > CONVO_TTL_MS) convos.delete(k);
}

// Hold fire-and-forget tasks so GC doesn't collect them mid-flight.
const bgTasks = new Set<Promise<void>>();
function runBg(fn: () => Promise<void>) {
  const t = fn().catch((e) => console.error("[cloud-webhook] bg task:", e instanceof Error ? e.message : e));
  bgTasks.add(t);
  t.finally(() => bgTasks.delete(t));
}

// ── Outbound senders (Graph API) ─────────────────────────────────────
async function waSend(payload: Record<string, unknown>) {
  const res = await fetch(`${GRAPH}/${PHONE_ID()}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${TOKEN()}`, "Content-Type": "application/json" },
    body: JSON.stringify({ messaging_product: "whatsapp", ...payload }),
  });
  if (!res.ok) {
    console.error("[cloud-webhook] send failed:", res.status, (await res.text()).slice(0, 300));
  }
}
const sendText = (to: string, body: string) => waSend({ to, type: "text", text: { body } });

// The style menu — a real interactive list (the whole point of the official API).
function sendMenu(to: string) {
  return waSend({
    to,
    type: "interactive",
    interactive: {
      type: "list",
      body: { text: "🎬 קיבלנו את הסרטון! איך לערוך אותו?" },
      action: {
        button: "בחירת סגנון",
        sections: [{
          title: "סגנונות עריכה",
          rows: [
            { id: "1", title: "כתוביות בלבד", description: "תמלול + כתוביות מעוצבות" },
            { id: "2", title: "פודקאסט", description: "כתוביות + אפקטים עדינים" },
            { id: "3", title: "אפקטים מתקדמים", description: "זום, אמוג'י, סאונד — הכל" },
            { id: "4", title: "תרגום לעברית", description: "וידאו באנגלית → כתוביות בעברית" },
          ],
        }],
      },
    },
  });
}

const CHOICES: Record<string, { mode: string; model: string; label: string }> = {
  "1": { mode: "subtitles_only",   model: "",             label: "כתוביות בלבד" },
  "2": { mode: "podcast",          model: "",             label: "פודקאסט" },
  "3": { mode: "advanced_effects", model: "",             label: "אפקטים מתקדמים" },
  "4": { mode: "subtitles_only",   model: "translate-he", label: "תרגום לעברית" },
};

const HELP =
  "היי! זה הבוט של *מאסטר וידאו* 🎬\n\n" +
  "• *סרטון* → מחזירים אותו ערוך עם כתוביות\n" +
  "• *הקלטה קולית* → מחזירים אותה בטקסט, בחינם 🎧\n\n" +
  "פקודות:\n• *מאסטרים* — כמה מאסטרים נשארו\n• *לקנות* — קניית מאסטרים\n• *עזרה* — התפריט הזה\n\n" +
  "אפשר לשלוח סרטון או הקלטה עכשיו 👇";

// ── Media download (Graph: media_id → url → bytes) ───────────────────
async function downloadMedia(mediaId: string): Promise<{ buf: Buffer; mime: string } | null> {
  try {
    const metaRes = await fetch(`${GRAPH}/${mediaId}`, { headers: { Authorization: `Bearer ${TOKEN()}` } });
    const meta = (await metaRes.json()) as { url?: string; mime_type?: string };
    if (!meta.url) return null;
    const binRes = await fetch(meta.url, { headers: { Authorization: `Bearer ${TOKEN()}` } });
    if (!binRes.ok) return null;
    return { buf: Buffer.from(await binRes.arrayBuffer()), mime: meta.mime_type || "video/mp4" };
  } catch (e) {
    console.error("[cloud-webhook] media download:", e instanceof Error ? e.message : e);
    return null;
  }
}

// ── The full pipeline for one video ──────────────────────────────────
async function processVideo(from: string, choice: { mode: string; model: string; label: string }, convo: Convo) {
  await sendText(from, "🎨 מכינים את הסרטון שלכם... זה ייקח בערך דקה. נעדכן כאן כשמוכן ✨");

  const media = await downloadMedia(convo.mediaId);
  if (!media) {
    await sendText(from, "לא הצלחנו לקרוא את הסרטון. אפשר לנסות לשלוח שוב? 🙏");
    return;
  }

  // Hand off to the existing secret-guarded orchestrator (same box).
  let jobId: string;
  try {
    const form = new FormData();
    form.append("video", new Blob([new Uint8Array(media.buf)], { type: media.mime }), "whatsapp-video.mp4");
    form.append("phone", from);
    form.append("mode", choice.mode);
    form.append("model", choice.model);
    const res = await fetch(`${INTERNAL_URL}/api/whatsapp/process`, {
      method: "POST",
      headers: { "x-mv-bot-secret": BOT_SECRET() },
      body: form,
    });
    const data = (await res.json().catch(() => ({}))) as Record<string, string>;
    if (res.status === 402) {
      await sendText(from, `נגמרו המאסטרים 😢\nלרכישה 👇\n${data.buyUrl || `${SITE_URL}/pricing`}`);
      return;
    }
    if (res.status === 404) {
      await sendText(from, `כמעט שם! ✨ צריך פעם אחת לחבר את המספר לחשבון מאסטר וידאו 👇\n${data.connectUrl || SITE_URL}\n\nאחרי החיבור — פשוט שלחו את הסרטון שוב 🎬`);
      return;
    }
    if (res.status === 422) {
      await sendText(from, "לא זיהינו דיבור בסרטון 🤔 נסו סרטון עם דיבור ברור.");
      return;
    }
    if (!res.ok || !data.jobId) throw new Error(data.error || `status ${res.status}`);
    jobId = data.jobId;
  } catch (e) {
    console.error("[cloud-webhook] process:", e instanceof Error ? e.message : e);
    await sendText(from, "אופס, משהו השתבש בהכנת הסרטון. לא חויבתם — אפשר לנסות שוב 🙏");
    return;
  }

  // Poll the render job, then deliver.
  const started = Date.now();
  const MAX_MS = 10 * 60 * 1000;
  let lastPing = 0;
  while (Date.now() - started < MAX_MS) {
    await new Promise((r) => setTimeout(r, 5000));
    const job = await getJob(jobId);
    if (!job) break;
    const status = job.status === "done" && !outputReady(job.id) ? "rendering" : job.status;
    if (status === "done") {
      const tok = resultToken(jobId);
      const url = `${SITE_URL}/api/whatsapp/result?jobId=${encodeURIComponent(jobId)}&token=${tok}`;
      // Send the actual video (Meta fetches the link; 16MB cap) + a DEEP editor
      // link that reopens THIS exact project (source video + captions + style).
      await waSend({ to: from, type: "video", video: { link: url, caption: "הסרטון שלכם מוכן! ✨🎬" } });
      await sendText(from, `✏️ לעריכה ושכלול של הסרטון הזה במאסטר וידאו:\n${SITE_URL}/?waedit=${encodeURIComponent(jobId)}&token=${tok}`);
      notifyOwner(`🎬 סרטון נוצר מוואטסאפ (רשמי)\nמאת: ${from}\nמצב: ${choice.label}`);
      return;
    }
    if (status === "failed" || status === "cancelled") {
      await sendText(from, "אופס, העריכה לא הצליחה הפעם. לא חויבתם — אפשר לנסות שוב 🙏");
      return;
    }
    if (typeof job.progress === "number" && job.progress > 0 && Date.now() - lastPing > 60000) {
      lastPing = Date.now();
      await sendText(from, `עדיין עובדים על זה... ${job.progress}% 🎬`);
    }
  }
  await sendText(from, "העריכה לוקחת קצת יותר מהצפוי — נשלח לכאן ברגע שהסרטון מוכן 🙏");
}

// ── Voice note pipeline: audio in → text back ────────────────────────
// Extension matters: the transcribe route hands the file to ffmpeg/PyAV, which
// pick their demuxer by name when the container isn't obvious.
function audioExt(mime: string): string {
  const m = mime.toLowerCase();
  if (m.includes("ogg") || m.includes("opus")) return ".ogg";
  if (m.includes("mpeg") || m.includes("mp3")) return ".mp3";
  if (m.includes("mp4") || m.includes("m4a") || m.includes("aac")) return ".m4a";
  if (m.includes("amr")) return ".amr";
  if (m.includes("wav")) return ".wav";
  return ".ogg";
}

// WhatsApp caps a text body at 4096 chars. Split a long transcript on a
// sentence/line break so a message never ends mid-word.
const WA_TEXT_MAX = 3500;
function splitTranscript(text: string): string[] {
  const clean = text.trim();
  const parts: string[] = [];
  let rest = clean;
  while (rest.length > WA_TEXT_MAX) {
    const window = rest.slice(0, WA_TEXT_MAX);
    let cut = Math.max(
      window.lastIndexOf("\n"),
      window.lastIndexOf(". "),
      window.lastIndexOf("! "),
      window.lastIndexOf("? "),
      window.lastIndexOf("׃ "),
    );
    if (cut < WA_TEXT_MAX * 0.5) cut = window.lastIndexOf(" ");
    // A boundary found in the first few characters would slice off a sliver and
    // loop ~forever on a long transcript — take the full window instead.
    cut = cut > WA_TEXT_MAX * 0.1 ? cut + 1 : WA_TEXT_MAX;
    const part = rest.slice(0, cut).trim();
    if (part) parts.push(part);
    rest = rest.slice(cut).trim();
  }
  if (rest) parts.push(rest);
  if (parts.length <= 1) return [`📝 *תמלול:*\n\n${parts[0] ?? clean}`];
  return parts.map((part, i) => `📝 *תמלול* (${i + 1}/${parts.length})\n\n${part}`);
}

async function processVoice(from: string, mediaId: string, mimeType: string) {
  await sendText(from, "🎧 קיבלנו את ההקלטה — מתמללים, רגע אחד...");

  const media = await downloadMedia(mediaId);
  if (!media) {
    await sendText(from, "לא הצלחנו לקרוא את ההקלטה. אפשר לנסות לשלוח שוב? 🙏");
    return;
  }

  try {
    const mime = media.mime || mimeType || "audio/ogg";
    const form = new FormData();
    form.append("audio", new Blob([new Uint8Array(media.buf)], { type: mime }), `voice${audioExt(mime)}`);
    form.append("phone", from);
    if (VOICE_ENGINE()) form.append("engine", VOICE_ENGINE());

    const res = await fetch(`${INTERNAL_URL}/api/whatsapp/voice`, {
      method: "POST",
      headers: { "x-mv-bot-secret": BOT_SECRET() },
      body: form,
    });
    const data = (await res.json().catch(() => ({}))) as { text?: string; summary?: string; error?: string };
    if (res.status === 422) {
      await sendText(from, "לא זיהינו דיבור בהקלטה 🤔 אפשר לנסות שוב עם הקלטה ברורה יותר.");
      return;
    }
    if (!res.ok || !data.text) throw new Error(data.error || `status ${res.status}`);

    for (const part of splitTranscript(data.text)) await sendText(from, part);
    if (data.summary) await sendText(from, `📌 *בקצרה:*\n${data.summary}`);
  } catch (e) {
    console.error("[cloud-webhook] voice:", e instanceof Error ? e.message : e);
    await sendText(from, "אופס, התמלול לא הצליח הפעם. אפשר לנסות לשלוח את ההקלטה שוב 🙏");
  }
}

/**
 * Who may use the free transcription. Returns null when allowed, or the reply
 * to send instead. Allow-listed numbers skip the account gate; everyone else
 * needs a linked Master Video account (same gate as video) so the number
 * doesn't become an open, unattributed transcription service.
 */
async function voiceDenyReply(from: string): Promise<string | null> {
  if (!voiceAllowList().has(normalizePhone(from))) {
    if (VOICE_REQUIRE_LINK() && !(await resolveUserByPhone(from))) {
      const p = normalizePhone(from);
      return (
        "כמעט שם! ✨ תמלול הקלטות הוא בחינם — צריך רק פעם אחת לחבר את המספר לחשבון מאסטר וידאו:\n\n" +
        `${SITE_URL}/connect-whatsapp?phone=${encodeURIComponent(p)}&token=${connectToken(p)}\n\n` +
        "אחרי החיבור — פשוט שלחו את ההקלטה שוב 🎧"
      );
    }
  }
  if (voiceQuotaExceeded(from)) {
    return "הגענו למכסת התמלולים להיום 🙏 אפשר להמשיך מחר, או לשלוח סרטון לעריכה.";
  }
  return null;
}

// Owner notification — best-effort WhatsApp to Liat via the same Cloud number.
// (Only works while she's a registered test recipient / after production number.)
function notifyOwner(text: string) {
  const owner = normalizePhone(process.env.MV_OWNER_PHONE || "0507766429");
  if (owner) waSend({ to: `972${owner}`, type: "text", text: { body: text } }).catch?.(() => {});
}

// ── Command handling for plain text ──────────────────────────────────
async function handleText(from: string, text: string) {
  const t = text.trim();
  const st = convos.get(from);

  // Numeric fallback for the menu (in case the list UI isn't used).
  if (st && CHOICES[t]) {
    convos.delete(from);
    await processVideo(from, CHOICES[t], st);
    return;
  }

  if (/מאסטרים|כמה.*(נשאר|יש)|יתרה|balance/i.test(t)) {
    const user = await resolveUserByPhone(from);
    if (!user) {
      const p = normalizePhone(from);
      await sendText(from, `כדי לבדוק יתרה צריך קודם לחבר את המספר לחשבון 👇\n${SITE_URL}/connect-whatsapp?phone=${encodeURIComponent(p)}&token=${connectToken(p)}`);
      return;
    }
    let balance = 0;
    try { balance = await getCreditBalance(user.userId); } catch { /* keep 0 */ }
    const name = user.name ? ` ${user.name}` : "";
    await sendText(from, `שלום${name}! 🎬\nנשארו לך *${balance}* מאסטרים.\n\nלשליחת סרטון לעריכה — פשוט שלחו אותו כאן.`);
    return;
  }
  if (/לקנות|קניי?ה|לרכוש|buy/i.test(t)) {
    await sendText(from, `לרכישת מאסטרים 👇\n${SITE_URL}/pricing`);
    return;
  }
  if (st) { await sendMenu(from); return; } // mid-flow, unrecognized → re-show menu
  await sendText(from, HELP);
}

// ── Webhook endpoints ────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  if (sp.get("hub.mode") === "subscribe" && sp.get("hub.verify_token") === VERIFY_TOKEN() && VERIFY_TOKEN()) {
    return new NextResponse(sp.get("hub.challenge") || "", { status: 200 });
  }
  return NextResponse.json({ error: "verification failed" }, { status: 403 });
}

type WaMessage = {
  from: string;
  id: string;
  type: string;
  text?: { body: string };
  video?: { id: string; mime_type?: string };
  audio?: { id: string; mime_type?: string; voice?: boolean };
  document?: { id: string; mime_type?: string };
  interactive?: { type: string; list_reply?: { id: string }; button_reply?: { id: string } };
};

export async function POST(req: NextRequest) {
  let body: { entry?: { changes?: { value?: { messages?: WaMessage[] } }[] }[] };
  try { body = await req.json(); } catch { return NextResponse.json({ ok: true }); }

  gcConvos();
  const messages = body.entry?.flatMap((e) => e.changes ?? []).flatMap((c) => c.value?.messages ?? []) ?? [];

  for (const msg of messages) {
    const from = msg.from; // e.g. "972507766429"
    try {
      if (msg.type === "video" && msg.video?.id) {
        // Gate on linking BEFORE showing the menu (same UX as Phase 1).
        const user = await resolveUserByPhone(from);
        if (!user) {
          const p = normalizePhone(from);
          runBg(() => sendText(from, `כמעט שם! ✨ כדי לקבל את הסרטון ערוך, צריך פעם אחת לחבר את המספר לחשבון מאסטר וידאו:\n\n${SITE_URL}/connect-whatsapp?phone=${encodeURIComponent(p)}&token=${connectToken(p)}\n\nאחרי החיבור — פשוט שלחו את הסרטון שוב 🎬`));
          continue;
        }
        convos.set(from, { step: "await_choice", mediaId: msg.video.id, mimeType: msg.video.mime_type || "video/mp4", updatedAt: Date.now() });
        runBg(() => sendMenu(from));
        continue;
      }
      // Voice note / audio file → transcript (free, no credits, no render).
      if (msg.type === "audio" && msg.audio?.id) {
        if (!VOICE_ENABLED()) {
          runBg(() => sendText(from, HELP));
          continue;
        }
        const deny = await voiceDenyReply(from);
        if (deny) {
          runBg(() => sendText(from, deny));
          continue;
        }
        const { id: mediaId, mime_type: mime } = msg.audio;
        runBg(() => processVoice(from, mediaId, mime || "audio/ogg"));
        continue;
      }
      if (msg.type === "document" && msg.document?.id && /^audio\//i.test(msg.document.mime_type || "")) {
        if (!VOICE_ENABLED()) {
          runBg(() => sendText(from, HELP));
          continue;
        }
        const deny = await voiceDenyReply(from);
        if (deny) {
          runBg(() => sendText(from, deny));
          continue;
        }
        const { id: mediaId, mime_type: mime } = msg.document;
        runBg(() => processVoice(from, mediaId, mime || "audio/ogg"));
        continue;
      }
      if (msg.type === "document" && msg.document?.id && /^video\//i.test(msg.document.mime_type || "")) {
        const user = await resolveUserByPhone(from);
        if (!user) {
          const p = normalizePhone(from);
          runBg(() => sendText(from, `כמעט שם! ✨ צריך פעם אחת לחבר את המספר לחשבון 👇\n${SITE_URL}/connect-whatsapp?phone=${encodeURIComponent(p)}&token=${connectToken(p)}`));
          continue;
        }
        convos.set(from, { step: "await_choice", mediaId: msg.document.id, mimeType: msg.document.mime_type || "video/mp4", updatedAt: Date.now() });
        runBg(() => sendMenu(from));
        continue;
      }
      if (msg.type === "interactive") {
        const choiceId = msg.interactive?.list_reply?.id || msg.interactive?.button_reply?.id || "";
        const st = convos.get(from);
        if (st && CHOICES[choiceId]) {
          convos.delete(from);
          const choice = CHOICES[choiceId];
          runBg(() => processVideo(from, choice, st));
        } else {
          runBg(() => sendText(from, "שלחו סרטון כדי להתחיל 🎬"));
        }
        continue;
      }
      if (msg.type === "text" && msg.text?.body) {
        const text = msg.text.body;
        runBg(() => handleText(from, text));
        continue;
      }
    } catch (e) {
      console.error("[cloud-webhook] message handling:", e instanceof Error ? e.message : e);
    }
  }

  // Always 200 fast — Meta retries aggressively on non-200.
  return NextResponse.json({ ok: true });
}
