import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/admin/users — list every registered user with full admin detail.
 *
 * Returns rows enriched from auth.users with last_sign_in_at + banned_until
 * so the admin dashboard can show login activity and suspension state.
 *
 * Auth: requires a Supabase session whose email is in the admin allow-list.
 * Without auth → 403. Without Supabase config → 200 with empty list (local dev).
 */

const ADMIN_EMAILS = (process.env.NEXT_PUBLIC_ADMIN_EMAILS ?? "liatcohen88@gmail.com,loliat8891@gmail.com")
  .split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);

async function requireAdmin(req: NextRequest): Promise<string | null> {
  const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!URL || !ANON) return null;
  const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!token) return null;
  const anon = createClient(URL, ANON, { auth: { persistSession: false } });
  const { data, error } = await anon.auth.getUser(token);
  if (error || !data.user?.email) return null;
  const email = data.user.email.toLowerCase();
  return ADMIN_EMAILS.includes(email) ? email : null;
}

export async function GET(req: NextRequest) {
  const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!URL || !SERVICE) {
    return NextResponse.json({ users: [], configured: false }, { status: 200 });
  }
  const adminEmail = await requireAdmin(req);
  if (!adminEmail) {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }

  const admin = createClient(URL, SERVICE, { auth: { persistSession: false } });

  const { data: profiles, error: pErr } = await admin
    .from("profiles")
    .select("id, email, display_name, credits, created_at")
    .order("created_at", { ascending: false });
  if (pErr) {
    return NextResponse.json({ users: [], configured: true, error: pErr.message }, { status: 500 });
  }

  // Enrich with auth.users (last_sign_in_at, banned_until). Service role
  // can call admin.listUsers; we fold the auth view onto profiles by id.
  const authByid = new Map<string, { last_sign_in_at: string | null; banned_until: string | null }>();
  try {
    const { data: u } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    for (const user of u?.users ?? []) {
      authByid.set(user.id, {
        last_sign_in_at: user.last_sign_in_at ?? null,
        banned_until: (user as unknown as { banned_until?: string | null }).banned_until ?? null,
      });
    }
  } catch { /* non-fatal — profiles alone is enough to render the table */ }

  const users = (profiles ?? []).map((p) => ({
    ...p,
    last_sign_in_at: authByid.get(p.id)?.last_sign_in_at ?? null,
    banned_until: authByid.get(p.id)?.banned_until ?? null,
  }));

  return NextResponse.json({ users, configured: true });
}
