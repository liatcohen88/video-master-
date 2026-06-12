import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

/**
 * Account self-delete. The user POSTs with their auth cookie; we verify
 * via the anon client (RLS lets them read only their own row), then
 * delete via the service-role client.
 */
export async function POST(req: NextRequest) {
  const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!URL || !ANON || !SERVICE) {
    return NextResponse.json({ error: "מערכת ההרשמה לא מוגדרת" }, { status: 500 });
  }

  const authHeader = req.headers.get("authorization") ?? "";
  const accessToken = authHeader.replace(/^Bearer\s+/i, "") || req.cookies.get("sb-access-token")?.value;
  if (!accessToken) {
    return NextResponse.json({ error: "לא מחובר" }, { status: 401 });
  }

  const anon = createClient(URL, ANON, { auth: { persistSession: false } });
  const { data: userData, error: userErr } = await anon.auth.getUser(accessToken);
  if (userErr || !userData.user) {
    return NextResponse.json({ error: "פג תוקף ההתחברות" }, { status: 401 });
  }
  const userId = userData.user.id;

  const admin = createClient(URL, SERVICE, { auth: { persistSession: false } });
  // Remove auth user — cascades profile row via FK if set up; if not, delete both.
  await admin.from("profiles").delete().eq("id", userId);
  const { error: delErr } = await admin.auth.admin.deleteUser(userId);
  if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
