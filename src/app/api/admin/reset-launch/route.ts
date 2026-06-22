/**
 * POST /api/admin/reset-launch — wipe operational test data before going live.
 *
 * Admin-only. Deletes ALL rows from the operational tables (user_videos,
 * user_notifications, pending_payments) so the dashboard starts clean at launch.
 *
 * Body (optional): { purgeUsers: true } — also deletes every NON-admin auth
 * user + their profile (test accounts). Admin emails are always preserved.
 * Defaults to false because deleting accounts is irreversible.
 *
 * Revenue is not stored as rows (the webhook only grants credits), so the
 * money figure resets via the dashboard's local-store clear on the client.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/apiAuth";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS
  ?? process.env.NEXT_PUBLIC_ADMIN_EMAILS
  ?? "liatcohen88@gmail.com,loliat8891@gmail.com")
  .split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);

const OPERATIONAL_TABLES = ["user_videos", "user_notifications", "pending_payments"];

export async function POST(req: NextRequest) {
  const user = await requireUser(req, { requireAdmin: true });
  if (user instanceof NextResponse) return user;

  const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!URL || !SERVICE) {
    return NextResponse.json({ error: "Storage not configured" }, { status: 500 });
  }
  const admin = createClient(URL, SERVICE, { auth: { persistSession: false } });

  const body = await req.json().catch(() => ({}));
  const purgeUsers = body?.purgeUsers === true;

  const result: Record<string, string> = {};

  // 1) Operational tables — every row has created_at, so this filter matches
  //    all rows while satisfying Supabase's "delete needs a filter" guard.
  for (const table of OPERATIONAL_TABLES) {
    const { error, count } = await admin
      .from(table)
      .delete({ count: "exact" })
      .gte("created_at", "1970-01-01");
    result[table] = error ? `שגיאה: ${error.message}` : `נמחקו ${count ?? 0}`;
  }

  // 2) Optional: purge non-admin test accounts (auth user + profile).
  if (purgeUsers) {
    let deleted = 0, kept = 0, failed = 0;
    try {
      const { data } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
      for (const u of data?.users ?? []) {
        const email = (u.email ?? "").toLowerCase();
        if (email && ADMIN_EMAILS.includes(email)) { kept++; continue; }
        const { error } = await admin.auth.admin.deleteUser(u.id);
        if (error) { failed++; continue; }
        await admin.from("profiles").delete().eq("id", u.id);
        deleted++;
      }
      result.users = `נמחקו ${deleted}, נשמרו ${kept} מנהלים${failed ? `, ${failed} נכשלו` : ""}`;
    } catch (e) {
      result.users = `שגיאה: ${e instanceof Error ? e.message : String(e)}`;
    }
  } else {
    result.users = "לא נגעתי (purgeUsers=false)";
  }

  return NextResponse.json({ ok: true, result });
}
