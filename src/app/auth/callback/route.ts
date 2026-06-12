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
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next") ?? "/dashboard";

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
