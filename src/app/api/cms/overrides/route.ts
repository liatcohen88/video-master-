import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Cloud-backed CMS overrides.
 *
 * GET  → returns every override as { key: value } map. PUBLIC — visitors
 *        need this to render Liat-edited copy. Cached lightly at the edge.
 * POST → upserts one { key, value } pair. Requires a Supabase session whose
 *        email is in the ADMIN allow-list. Uses the service role to bypass RLS.
 * DEL  → deletes a single key (admin-only). Used by the "איפוס" button.
 */

const ADMIN_EMAILS = (process.env.NEXT_PUBLIC_ADMIN_EMAILS ?? "liatcohen88@gmail.com,loliat8891@gmail.com")
  .split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);

function env() {
  return {
    URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    ANON: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    SERVICE: process.env.SUPABASE_SERVICE_ROLE_KEY,
  };
}

async function getAdminEmail(req: NextRequest): Promise<string | null> {
  const { URL, ANON } = env();
  if (!URL || !ANON) return null;
  const authHeader = req.headers.get("authorization") ?? "";
  const accessToken = authHeader.replace(/^Bearer\s+/i, "");
  if (!accessToken) return null;
  const anon = createClient(URL, ANON, { auth: { persistSession: false } });
  const { data, error } = await anon.auth.getUser(accessToken);
  if (error || !data.user?.email) return null;
  const email = data.user.email.toLowerCase();
  return ADMIN_EMAILS.includes(email) ? email : null;
}

export async function GET() {
  const { URL, ANON } = env();
  if (!URL || !ANON) {
    // Supabase not configured — return empty so the app falls back to defaults.
    return NextResponse.json({ overrides: {}, configured: false });
  }
  const sb = createClient(URL, ANON, { auth: { persistSession: false } });
  const { data, error } = await sb.from("content_overrides").select("key,value");
  if (error) {
    return NextResponse.json({ overrides: {}, configured: true, error: error.message }, { status: 200 });
  }
  const overrides: Record<string, unknown> = {};
  for (const row of data ?? []) overrides[row.key] = row.value;
  return NextResponse.json(
    { overrides, configured: true },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function POST(req: NextRequest) {
  const { URL, SERVICE } = env();
  if (!URL || !SERVICE) {
    return NextResponse.json({ error: "Supabase service role not configured" }, { status: 500 });
  }
  const adminEmail = await getAdminEmail(req);
  if (!adminEmail) {
    return NextResponse.json({ error: "אין הרשאת אדמין" }, { status: 403 });
  }

  let body: { key?: string; value?: unknown };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  if (!body.key || typeof body.key !== "string") {
    return NextResponse.json({ error: "Missing key" }, { status: 400 });
  }
  if (body.value === undefined) {
    return NextResponse.json({ error: "Missing value" }, { status: 400 });
  }

  const admin = createClient(URL, SERVICE, { auth: { persistSession: false } });
  // Look up the admin's user-id so we can stamp updated_by. Best-effort.
  let updatedBy: string | null = null;
  const { data: u } = await admin.auth.admin.listUsers({ page: 1, perPage: 50 });
  updatedBy = u?.users?.find((x) => x.email?.toLowerCase() === adminEmail)?.id ?? null;

  const { error } = await admin.from("content_overrides").upsert({
    key: body.key,
    value: body.value,
    updated_at: new Date().toISOString(),
    updated_by: updatedBy,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const { URL: SUPA_URL, SERVICE } = env();
  if (!SUPA_URL || !SERVICE) return NextResponse.json({ error: "Supabase service role not configured" }, { status: 500 });
  const adminEmail = await getAdminEmail(req);
  if (!adminEmail) return NextResponse.json({ error: "אין הרשאת אדמין" }, { status: 403 });

  const key = new URL(req.url).searchParams.get("key");
  if (!key) return NextResponse.json({ error: "Missing key" }, { status: 400 });

  const admin = createClient(SUPA_URL, SERVICE, { auth: { persistSession: false } });
  const { error } = await admin.from("content_overrides").delete().eq("key", key);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
