import { NextResponse } from "next/server";
import { adminClient } from "@/lib/supabase";

export const runtime = "nodejs";

/**
 * GET /api/admin/users — list every registered user.
 *
 * Reads the `profiles` table via the SERVICE ROLE key (bypasses RLS) so the
 * admin dashboard can show signups across all accounts. Service role is
 * server-side only — never reaches the browser.
 *
 * Returns 503 with `[]` when Supabase isn't configured (e.g. local dev with
 * no env vars) so the admin UI just shows "אין משתמשים עדיין" instead of an
 * error.
 */
export async function GET() {
  const sb = adminClient();
  if (!sb) {
    return NextResponse.json(
      { users: [], configured: false },
      { status: 200 },
    );
  }

  const { data, error } = await sb
    .from("profiles")
    .select("id, email, display_name, credits, created_at")
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json(
      { users: [], configured: true, error: error.message },
      { status: 500 },
    );
  }

  return NextResponse.json({ users: data ?? [], configured: true });
}
