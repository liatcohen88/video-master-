/**
 * GET /api/admin/stats — REAL dashboard numbers from Supabase (not the local
 * demo seed). Admin-only. Replaces the placeholder ₪325/ליאת-יוסי demo so Liat
 * sees what actually came in before launch.
 *
 *   totalRevenue   — SUM(revenue_txns.amount_ils)
 *   activeUsers    — COUNT(profiles)
 *   videosLast24h  — COUNT(user_videos created in the last 24h)
 *   successRate    — done / (done + failed) across user_videos
 *   recent         — latest 5 user_videos
 */

import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/apiAuth";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const user = await requireUser(req, { requireAdmin: true });
  if (user instanceof NextResponse) return user;

  const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!URL || !SERVICE) {
    return NextResponse.json({ configured: false }, { status: 200 });
  }
  const admin = createClient(URL, SERVICE, { auth: { persistSession: false } });

  // Revenue — pull all confirmed payments once; sum + return the list so the
  // admin revenue tab shows REAL payers (not the ליאת/יוסי/עמיר demo seed).
  let totalRevenue = 0;
  let txns: {
    id: string; userName: string; amountIls: number;
    creditsBought: number; package: string; createdAt: string;
  }[] = [];
  try {
    const { data } = await admin
      .from("revenue_txns")
      .select("id, user_name, amount_ils, credits_bought, package, created_at")
      .order("created_at", { ascending: false })
      .limit(1000);
    const rows = data ?? [];
    totalRevenue = rows.reduce((a, r) => a + Number(r.amount_ils ?? 0), 0);
    txns = rows.map((r) => ({
      id: String(r.id),
      userName: (r.user_name as string) || "—",
      amountIls: Number(r.amount_ils ?? 0),
      creditsBought: Number(r.credits_bought ?? 0),
      package: (r.package as string) || "starter",
      createdAt: r.created_at as string,
    }));
  } catch { /* table may not exist yet → 0 */ }

  // Active users — total registered profiles.
  let activeUsers = 0;
  try {
    const { count } = await admin.from("profiles").select("*", { count: "exact", head: true });
    activeUsers = count ?? 0;
  } catch { /* ignore */ }

  // Videos — pull recent rows once, derive 24h count + success rate + feed.
  let videosLast24h = 0;
  let successRate = 100;
  let recent: { title: string; status: string; creditsUsed: number; mode: string; at: string }[] = [];
  try {
    const { data } = await admin
      .from("user_videos")
      .select("title, status, credits_used, mode, created_at")
      .order("created_at", { ascending: false })
      .limit(200);
    const rows = data ?? [];
    const dayAgo = Date.now() - 24 * 3600 * 1000;
    videosLast24h = rows.filter((r) => new Date(r.created_at as string).getTime() > dayAgo).length;
    const done = rows.filter((r) => r.status === "done").length;
    const failed = rows.filter((r) => r.status === "failed").length;
    successRate = done + failed === 0 ? 100 : Math.round((done / (done + failed)) * 100);
    recent = rows.slice(0, 5).map((r) => ({
      title: (r.title as string) || "סרטון",
      status: (r.status as string) || "processing",
      creditsUsed: Number(r.credits_used ?? 0),
      mode: (r.mode as string) || "",
      at: r.created_at as string,
    }));
  } catch { /* ignore */ }

  return NextResponse.json({
    configured: true,
    totalRevenue,
    txns,
    activeUsers,
    videosLast24h,
    successRate,
    recent,
  });
}
