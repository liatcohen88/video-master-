import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Supabase OAuth callback. After Google/Apple sign-in, Supabase redirects
 * here with a `?code=...` query param. We exchange it for a session, set
 * the session cookies, then bounce the user to `/dashboard`.
 *
 * If env vars are missing, we just redirect home — the OAuth flow can't
 * have started anyway.
 */
/**
 * Only allow same-origin relative redirect targets. `new URL(next, base)`
 * ignores `base` when `next` is absolute, so a raw `?next=https://evil.com`
 * (or `//evil.com`) would bounce the just-logged-in user off-site (phishing).
 * Accept only a path that starts with a single "/" and isn't "//" or "/\".
 */
function safeNext(next: string | null): string {
  if (!next || !next.startsWith("/")) return "/dashboard";
  if (next.startsWith("//") || next.startsWith("/\\")) return "/dashboard";
  return next;
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const next = safeNext(url.searchParams.get("next"));

  const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const SUPA_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!code || !SUPA_URL || !SUPA_ANON) {
    return NextResponse.redirect(new URL("/login?err=oauth_missing", req.url));
  }

  const sb = createClient(SUPA_URL, SUPA_ANON, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error } = await sb.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(new URL(`/login?err=${encodeURIComponent(error.message)}`, req.url));
  }
  return NextResponse.redirect(new URL(next, req.url));
}
