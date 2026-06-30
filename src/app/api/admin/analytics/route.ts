/**
 * GET /api/admin/analytics?range=today|yesterday|7d|30d  (or &from=YYYY-MM-DD&to=YYYY-MM-DD)
 * REAL site traffic for the admin panel from our own site_visits table (written
 * by /api/presence) + signups from profiles. Admin-only. All real, no demo
 * (Liat: "כמה שיותר מידע על משתמשים שהכל יהיה אמיתי ללא פייק").
 *
 * Returns core metrics + breakdowns by device / top pages / referrer / country
 * + a 7-day visitor trend.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/apiAuth";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function ilDay(offsetDays = 0): string {
  const base = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Jerusalem" });
  if (!offsetDays) return base;
  const [y, m, d] = base.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + offsetDays);
  return dt.toISOString().slice(0, 10);
}
function ilDayOf(iso: string): string {
  return new Date(iso).toLocaleDateString("en-CA", { timeZone: "Asia/Jerusalem" });
}
const isDay = (s: string | null): s is string => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s);

type Row = { session_id: string; day: string; path: string; device: string | null; referrer: string | null; country: string | null };

/** Unique-session counts grouped by a field, top N, as [{key,count}]. */
function topBy(rows: Row[], field: keyof Row, n = 6, skipEmpty = false) {
  const m = new Map<string, Set<string>>();
  for (const r of rows) {
    const k = (r[field] as string) || (skipEmpty ? "" : "—");
    if (skipEmpty && !k) continue;
    if (!m.has(k)) m.set(k, new Set());
    m.get(k)!.add(r.session_id);
  }
  return [...m.entries()].map(([key, set]) => ({ key, count: set.size }))
    .sort((a, b) => b.count - a.count).slice(0, n);
}

export async function GET(req: NextRequest) {
  const user = await requireUser(req, { requireAdmin: true });
  if (user instanceof NextResponse) return user;

  const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!SB_URL || !SERVICE) return NextResponse.json({ configured: false }, { status: 200 });
  const admin = createClient(SB_URL, SERVICE, { auth: { persistSession: false } });

  const sp = req.nextUrl.searchParams;
  const today = ilDay();
  let startDay = today, endDay = today, range = sp.get("range") || "today";

  const from = sp.get("from"), to = sp.get("to");
  if (isDay(from) && isDay(to)) {
    range = "custom";
    startDay = from <= to ? from : to;
    endDay = from <= to ? to : from;
  } else if (range === "yesterday") { startDay = ilDay(-1); endDay = ilDay(-1); }
  else if (range === "7d")  { startDay = ilDay(-6); }
  else if (range === "30d") { startDay = ilDay(-29); }

  // Window wide enough for BOTH the selected range and the 7-day trend.
  const fetchFrom = startDay < ilDay(-6) ? startDay : ilDay(-6);

  let inRange: Row[] = [];
  const trendMap = new Map<string, Set<string>>();
  try {
    const { data } = await admin
      .from("site_visits")
      .select("session_id, day, path, device, referrer, country")
      .gte("day", fetchFrom).lte("day", endDay)
      .limit(200000);
    const rows = (data ?? []) as Row[];
    inRange = rows.filter((r) => r.day >= startDay && r.day <= endDay);
    for (const r of rows) {
      if (!trendMap.has(r.day)) trendMap.set(r.day, new Set());
      trendMap.get(r.day)!.add(r.session_id);
    }
  } catch { /* table missing → zeros (run 20260630_site_visits.sql) */ }

  const visitors = new Set(inRange.map((r) => r.session_id)).size;
  const pageViews = inRange.length;

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
  const trend = Array.from({ length: 7 }, (_, i) => {
    const day = ilDay(-(6 - i));
    return { day, visitors: trendMap.get(day)?.size ?? 0 };
  });

  return NextResponse.json({
    configured: true,
    range, startDay, endDay,
    visitors, pageViews, signups, conversionRate,
    trend,
    byDevice: topBy(inRange, "device", 4),
    topPages: [...inRange.reduce((m, r) => m.set(r.path, (m.get(r.path) ?? 0) + 1), new Map<string, number>()).entries()]
      .map(([key, count]) => ({ key, count })).sort((a, b) => b.count - a.count).slice(0, 6),
    byReferrer: topBy(inRange, "referrer", 6),
    byCountry: topBy(inRange, "country", 6, true),
  });
}
