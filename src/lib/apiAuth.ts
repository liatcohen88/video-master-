/**
 * Shared API-auth helpers. Use from every protected route so we have ONE
 * place to fix when the auth model changes (e.g. cookie-based SSR session,
 * MFA enforcement, IP blocklists).
 *
 * Pattern:
 *   const user = await requireUser(req);
 *   if (user instanceof NextResponse) return user;  // 401 → bail
 *   // ... user.id is safe to use
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Server-side admin allowlist. Falls back to the SAME hardcoded default as the
// client gate (src/app/admin/page.tsx) so the two can't drift: if ADMIN_EMAILS
// isn't set in the server env, a logged-in admin still passes requireAdmin
// instead of getting a confusing 403. Override via env for new admins.
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS
  ?? process.env.NEXT_PUBLIC_ADMIN_EMAILS
  ?? "liatcohen88@gmail.com,loliat8891@gmail.com")
  .split(",")
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);

export type AuthedUser = {
  id: string;
  email: string;
  isAdmin: boolean;
};

/**
 * Resolve the bearer token from `Authorization: Bearer <jwt>`. Returns null
 * if absent; the caller decides what to do (anonymous-allowed vs not).
 */
function tokenFromReq(req: NextRequest): string | null {
  const h = req.headers.get("authorization") ?? "";
  const m = h.match(/^Bearer\s+(.+)$/i);
  if (m) return m[1].trim();
  // Cookie fallback (for the SSR migration; harmless today).
  return req.cookies.get("sb-access-token")?.value ?? null;
}

/**
 * Verify the request is from an authenticated user. Returns the user, or
 * a 401 NextResponse the route should return immediately.
 *
 * Pass `{ requireAdmin: true }` to also check the email is in ADMIN_EMAILS.
 */
export async function requireUser(
  req: NextRequest,
  opts: { requireAdmin?: boolean } = {},
): Promise<AuthedUser | NextResponse> {
  const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!URL || !ANON) {
    // Misconfigured server — don't let traffic through.
    return NextResponse.json({ error: "auth backend not configured" }, { status: 503 });
  }

  // Bot delegation: a trusted server-to-server caller (the WhatsApp bot's
  // /api/whatsapp/process orchestrator) can act on behalf of an already-resolved
  // user by presenting the shared secret + the target user id. Guarded by the
  // secret; never grants admin. Lets the existing render pipeline run headlessly
  // for a WhatsApp user without minting a real JWT.
  const botSecret = process.env.MV_BOT_SECRET;
  if (botSecret && req.headers.get("x-mv-bot-secret") === botSecret) {
    const uid = req.headers.get("x-mv-user-id");
    if (uid) return { id: uid, email: "", isAdmin: false };
  }

  const token = tokenFromReq(req);
  if (!token) {
    return NextResponse.json({ error: "לא מחובר" }, { status: 401 });
  }

  const anon = createClient(URL, ANON, { auth: { persistSession: false } });
  const { data, error } = await anon.auth.getUser(token);
  if (error || !data.user) {
    return NextResponse.json({ error: "פג תוקף ההתחברות" }, { status: 401 });
  }

  const email = (data.user.email ?? "").toLowerCase();
  const isAdmin = email !== "" && ADMIN_EMAILS.includes(email);

  if (opts.requireAdmin && !isAdmin) {
    return NextResponse.json({ error: "אין הרשאת מנהל" }, { status: 403 });
  }

  return { id: data.user.id, email, isAdmin };
}

/**
 * True when a request carries the shared WhatsApp-bot secret. Use to guard the
 * server-to-server /api/whatsapp/* endpoints (the bot is the only caller).
 */
export function botSecretOk(req: NextRequest): boolean {
  const s = process.env.MV_BOT_SECRET;
  return !!s && req.headers.get("x-mv-bot-secret") === s;
}
