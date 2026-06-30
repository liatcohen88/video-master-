/**
 * /api/presence — live-visitor heartbeat + admin read.
 *
 *   POST  { sessionId, path }   → record a visitor heartbeat (open, anonymous)
 *   GET                         → admin-only live snapshot (count + pages)
 *
 * Backed by an in-memory store (src/lib/presenceStore) — single-container only.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/apiAuth";
import { touch, liveList, markVisitLogged } from "@/lib/presenceStore";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function countryOf(req: NextRequest): string | null {
  // Set by Cloudflare / Vercel / some proxies. Absent on bare Coolify → null.
  return (
    req.headers.get("cf-ipcountry") ??
    req.headers.get("x-vercel-ip-country") ??
    req.headers.get("x-country") ??
    null
  );
}

const BOT_RE = /bot|crawler|spider|crawling|facebookexternalhit|preview|monitor|headless|lighthouse|pingdom|uptime|curl|wget|python-requests|axios/i;

/** Asia/Jerusalem calendar day as YYYY-MM-DD (so "today" = IL midnight). */
function ilDay(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Jerusalem" });
}

// Persist a real human page-visit to site_visits (best-effort). Deduped per
// process + by the table PK, skips bots and /admin so the analytics counts
// reflect actual visitors. No-op if Supabase isn't configured / table missing —
// the live count still works regardless.
async function logVisit(sessionId: string, path: string, country: string | null) {
  const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!URL || !SERVICE) return;
  const day = ilDay();
  if (!markVisitLogged(`${sessionId}|${path}|${day}`)) return;
  try {
    const admin = createClient(URL, SERVICE, { auth: { persistSession: false } });
    await admin.from("site_visits").upsert(
      { session_id: sessionId, path, day, country },
      { onConflict: "session_id,path,day", ignoreDuplicates: true },
    );
  } catch { /* table missing / offline — analytics is best-effort */ }
}

export async function POST(req: NextRequest) {
  try {
    const ua = req.headers.get("user-agent") || "";
    if (BOT_RE.test(ua)) return NextResponse.json({ ok: true }); // never count bots
    const body = await req.json().catch(() => ({}));
    const sessionId = typeof body?.sessionId === "string" ? body.sessionId.slice(0, 64) : "";
    const path = typeof body?.path === "string" ? body.path.slice(0, 120) : "/";
    if (sessionId && !path.startsWith("/admin")) {
      const country = countryOf(req);
      touch(sessionId, path, country);          // live "who's online now"
      void logVisit(sessionId, path, country);  // historical analytics (DB)
    }
  } catch {
    /* never fail a heartbeat */
  }
  return NextResponse.json({ ok: true });
}

export async function GET(req: NextRequest) {
  const user = await requireUser(req, { requireAdmin: true });
  if (user instanceof NextResponse) return user;
  return NextResponse.json(liveList());
}
