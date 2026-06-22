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
import { touch, liveList } from "@/lib/presenceStore";

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

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const sessionId = typeof body?.sessionId === "string" ? body.sessionId.slice(0, 64) : "";
    const path = typeof body?.path === "string" ? body.path.slice(0, 120) : "/";
    if (sessionId) touch(sessionId, path, countryOf(req));
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
