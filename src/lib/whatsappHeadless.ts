/**
 * Server-side helpers for the WhatsApp video bot's headless pipeline.
 *
 * The browser editor builds a project interactively (transcribe → auto-style →
 * user tweaks → export). The WhatsApp flow has no UI, so we build a complete,
 * valid project from per-mode defaults instead: MODE_DEFAULT_EFFECTS +
 * MODE_DEFAULT_SETTINGS + a solid default subtitle style. The result feeds the
 * SAME render pipeline the editor uses, so preview/export parity is free.
 */

import { createHmac, timingSafeEqual } from "node:crypto";
import type { EditMode, SubtitleStyle, VideoEffects, SubtitleSettings } from "@/lib/types";
import { MODE_DEFAULT_EFFECTS, MODE_DEFAULT_SETTINGS } from "@/lib/types";
import { adminClient } from "@/lib/supabase";

/**
 * Capability token for a render result's download URL. Lets us hand a WhatsApp
 * user a clickable link to their MP4 without exposing the bot secret or making
 * the result world-readable: token = HMAC(jobId, secret). Unguessable without
 * the secret; the result endpoint accepts either this token or the secret.
 */
export function resultToken(jobId: string): string {
  const secret = process.env.MV_BOT_SECRET || "";
  return createHmac("sha256", secret).update(jobId).digest("hex").slice(0, 32);
}
export function resultTokenValid(jobId: string, token: string | null | undefined): boolean {
  if (!token) return false;
  const expected = resultToken(jobId);
  const a = Buffer.from(expected);
  const b = Buffer.from(token);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Signed token for the phone→account connect link. The bot delivers the link
 * only to that phone over WhatsApp, so possessing a valid token ~proves control
 * of the number — this stops a logged-in user from linking someone ELSE's phone
 * to their account by tampering with the ?phone= param.
 */
export function connectToken(phone: string): string {
  const secret = process.env.MV_BOT_SECRET || "";
  return createHmac("sha256", secret).update(`connect:${normalizePhone(phone)}`).digest("hex").slice(0, 32);
}
export function connectTokenValid(phone: string, token: string | null | undefined): boolean {
  if (!token) return false;
  const expected = connectToken(phone);
  const a = Buffer.from(expected);
  const b = Buffer.from(token);
  return a.length === b.length && timingSafeEqual(a, b);
}

// A known-good default subtitle style (matches the site's "viral" preset).
// MODE_PRESETS is not used — its keys are mismatched to EditMode (a pre-existing
// bug), so we keep an explicit, type-checked default here.
export const DEFAULT_HEADLESS_STYLE: SubtitleStyle = {
  fontFamily: "Rubik",
  fontSize: 72,
  fontWeight: 900,
  color: "#ffffff",
  strokeColor: "#000000",
  strokeWidth: 6,
  backgroundColor: "#000000",
  backgroundOpacity: 0,
  // Bottom, NOT middle — middle sat right on the speaker's face in the first
  // real WhatsApp delivery (Liat 15/7: "המלל כשהוא כאן הוא ממש מסתיר").
  position: "bottom",
  positionOffset: 0,
  textAlign: "center",
  highlightColor: "#facc15",
  shadow: true,
};

const VALID_MODES: EditMode[] = ["subtitles_only", "basic_effects", "podcast", "advanced_effects"];
export function coerceMode(mode: string | null | undefined): EditMode {
  return VALID_MODES.includes(mode as EditMode) ? (mode as EditMode) : "subtitles_only";
}

export function buildHeadlessProject(mode: EditMode): {
  style: SubtitleStyle;
  effects: VideoEffects;
  settings: SubtitleSettings;
} {
  return {
    style: { ...DEFAULT_HEADLESS_STYLE },
    effects: { ...MODE_DEFAULT_EFFECTS[mode] },
    // Force punctuation + stretch ON for every WhatsApp delivery regardless of
    // the mode defaults (advanced_effects ships them off) — headless users get
    // no editor to toggle them, and Liat wants them always on (15/7).
    settings: { ...MODE_DEFAULT_SETTINGS[mode], addPunctuation: true, stretchSubtitles: true },
  };
}

/**
 * Canonical phone form for matching a WhatsApp sender to a stored account:
 * digits only, Israeli country code / leading zero stripped → the 9-digit
 * subscriber part (e.g. "0507766429", "972507766429" → "507766429"). Storing +
 * comparing the canonical form makes the match robust to formatting.
 */
export function normalizePhone(phone: string | null | undefined): string {
  let p = String(phone ?? "").replace(/[^0-9]/g, "");
  if (p.startsWith("972")) p = p.slice(3);
  if (p.startsWith("0")) p = p.slice(1);
  return p;
}

/**
 * Resolve a WhatsApp phone to a Master Video account. Returns the user id +
 * a display name, or null if no account has linked this number.
 */
export async function resolveUserByPhone(
  phone: string,
): Promise<{ userId: string; name: string | null } | null> {
  const admin = adminClient();
  if (!admin) return null;
  const canonical = normalizePhone(phone);
  if (!canonical) return null;

  const { data, error } = await admin
    .from("profiles")
    .select("*")
    .eq("whatsapp_phone", canonical)
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;

  const row = data as Record<string, unknown>;
  const name =
    (typeof row.full_name === "string" && row.full_name) ||
    (typeof row.name === "string" && row.name) ||
    (typeof row.display_name === "string" && row.display_name) ||
    null;
  const userId = (row.id ?? row.user_id) as string | undefined;
  if (!userId) return null;
  return { userId, name };
}
