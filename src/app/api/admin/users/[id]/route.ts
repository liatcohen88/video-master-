import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * PATCH /api/admin/users/[id]
 *
 * Body:
 *   { addCredits?: number }     — bump or subtract user's masters
 *   { banned?: boolean }        — true = ban indefinitely, false = lift ban
 *   { displayName?: string }    — rename
 *
 * Auth: requires Supabase session whose email is in the admin allow-list.
 */

const ADMIN_EMAILS = (process.env.NEXT_PUBLIC_ADMIN_EMAILS ?? "liatcohen88@gmail.com,loliat8891@gmail.com")
  .split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);

async function requireAdmin(req: NextRequest): Promise<string | null> {
  const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!SUPA_URL || !ANON) return null;
  const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!token) return null;
  const anon = createClient(SUPA_URL, ANON, { auth: { persistSession: false } });
  const { data, error } = await anon.auth.getUser(token);
  if (error || !data.user?.email) return null;
  const email = data.user.email.toLowerCase();
  return ADMIN_EMAILS.includes(email) ? email : null;
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!SUPA_URL || !SERVICE) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });
  }
  const adminEmail = await requireAdmin(req);
  if (!adminEmail) return NextResponse.json({ error: "Admin only" }, { status: 403 });

  const { id } = await params;
  if (!id) return NextResponse.json({ error: "Missing user id" }, { status: 400 });

  const body = await req.json().catch(() => ({})) as {
    addCredits?: number;
    banned?: boolean;
    displayName?: string;
  };

  const admin = createClient(SUPA_URL, SERVICE, { auth: { persistSession: false } });

  // 1) Credits — read current, write current + delta. Clamped to >= 0.
  if (typeof body.addCredits === "number" && Number.isFinite(body.addCredits) && body.addCredits !== 0) {
    const { data: row, error: rErr } = await admin
      .from("profiles").select("credits").eq("id", id).single();
    if (rErr) return NextResponse.json({ error: rErr.message }, { status: 500 });
    const next = Math.max(0, (row?.credits ?? 0) + body.addCredits);
    const { error: uErr } = await admin
      .from("profiles").update({ credits: next }).eq("id", id);
    if (uErr) return NextResponse.json({ error: uErr.message }, { status: 500 });
  }

  // 2) Rename display name
  if (typeof body.displayName === "string") {
    const { error: nErr } = await admin
      .from("profiles").update({ display_name: body.displayName }).eq("id", id);
    if (nErr) return NextResponse.json({ error: nErr.message }, { status: 500 });
  }

  // 3) Ban / unban — Supabase auth admin API. Ban duration of "876000h" (100yr)
  // is the documented "indefinite" pattern; "none" lifts the ban.
  if (typeof body.banned === "boolean") {
    const { error: bErr } = await admin.auth.admin.updateUserById(id, {
      ban_duration: body.banned ? "876000h" : "none",
    });
    if (bErr) return NextResponse.json({ error: bErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

/**
 * DELETE /api/admin/users/[id]
 *
 * Permanently removes a user — auth record + profile row — so the email is
 * freed and the person can sign up again from scratch (Liat: "אפשרות למחוק
 * משתמש לגמרי שיכול להירשם שוב").
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!SUPA_URL || !SERVICE) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });
  }
  const adminEmail = await requireAdmin(req);
  if (!adminEmail) return NextResponse.json({ error: "Admin only" }, { status: 403 });

  const { id } = await params;
  if (!id) return NextResponse.json({ error: "Missing user id" }, { status: 400 });

  const admin = createClient(SUPA_URL, SERVICE, { auth: { persistSession: false } });

  // Remove the profile row first (in case there's no ON DELETE CASCADE), then
  // the auth user. Profile-delete errors are non-fatal — the auth delete is
  // what frees the email.
  await admin.from("profiles").delete().eq("id", id);
  const { error } = await admin.auth.admin.deleteUser(id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
