/**
 * GET /api/admin/analytics?range=today|yesterday|7d|30d
 * REAL site traffic for the admin panel from our own site_visits table (written
 * by /api/presence) + signups from profiles. Admin-only. Replaces the demo
 * traffic numbers (Liat: "חייב אנליטקס מתאים... כמה נכנסו היום אתמול").
 *
 * Returns: { configured, range, visitors, pageViews, signups, conversionRate,
 *            trend: [{day, visitors}] (last 7 days) }
 */

import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/apiAuth";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Asia/Jerusalem calendar day (YYYY-MM-DD) for `today - offsetDays`. */
function ilDay(offsetDays = 0): string {
  const base = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Jerusalem" });
  if (!offsetDays) return base;
  const [y, m, d] = base.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + offsetDays);
  return dt.toISOString().slice(0, 10);
}

/** IL calendar day for a timestamp (so signups bucket by IL midnight too). */
function ilDayOf(iso: string): string {
  return new Date(iso).toLocaleDateString("en-CA", { timeZone: "Asia/Jerusalem" });
}

export async function GET(req: NextRequest) {
  const user = await requireUser(req, { requireAdmin: true });
  if (user instanceof NextResponse) return user;

  const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!URL || !SERVICE) return NextResponse.json({ configured: false }, { status: 200 });
  const admin = createClient(URL, SERVICE, { auth: { persistSession: false } });

  const range = (req.nextUrl.searchParams.get("range") || "today") as
    "today" | "yesterday" | "7d" | "30d";
  const today = ilDay();
  let startDay = today, endDay = today;
  if (range === "yesterday") { startDay = ilDay(-1); endDay = ilDay(-1); }
  else if (range === "7d")   { startDay = ilDay(-6); }
  else if (range === "30d")  { startDay = ilDay(-29); }

  // Pull a window wide enough for BOTH the selected range and the 7-day trend.
  const fetchFrom = startDay < ilDay(-6) ? startDay : ilDay(-6);

  let visitors = 0, pageViews = 0;
  const trendMap = new Map<string, Set<string>>(); // day → set of sessions
  try {
    const { data } = await admin
      .from("site_visits")
      .select("session_id, day")
      .gte("day", fetchFrom)
      .lte("day", endDay)
      .limit(100000);
    const rows = data ?? [];
    const inRange = rows.filter((r) => (r.day as string) >= startDay && (r.day as string) <= endDay);
    pageViews = inRange.length;
    visitors = new Set(inRange.map((r) => r.session_id as string)).size;
    for (const r of rows) {
      const d = r.day as string;
      if (!trendMap.has(d)) trendMap.set(d, new Set());
      trendMap.get(d)!.add(r.session_id as string);
    }
  } catch { /* table missing → zeros (run the 20260630_site_visits.sql migration) */ }

  // Signups in range — bucket profiles by their IL creation day.
  let signups = 0;
  try {
    const { data } = await admin.from("profiles").select("created_at").limit(100000);
    signups = (data ?? []).filter((p) => {
      if (!p.created_at) return false;
      const d = ilDayOf(p.created_at as string);
      return d >= startDay && d <= endDay;
    }).length;
  } catch { /* ignore */ }

  const conversionRate = visitors > 0 ? Math.round((signups / visitors) * 100) : 0;

  // 7-day trend (oldest→newest), unique visitors per day.
  const trend = Array.from({ length: 7 }, (_, i) => {
    const day = ilDay(-(6 - i));
    return { day, visitors: trendMap.get(day)?.size ?? 0 };
  });

  return NextResponse.json({
    configured: true,
    range,
    visitors,
    pageViews,
    signups,
    conversionRate,
    trend,
  });
}
