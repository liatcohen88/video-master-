/**
 * GET /api/admin/videos — REAL video jobs from Supabase (user_videos), so the
 * admin "סרטונים" tab shows what users actually rendered instead of the empty
 * local demo store. Admin-only. Each row is joined to the user's display name /
 * email via the profiles table.
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
    // Not configured → tell the client to fall back to its local store.
    return NextResponse.json({ configured: false, videos: [] }, { status: 200 });
  }
  const admin = createClient(URL, SERVICE, { auth: { persistSession: false } });

  let videos: {
    id: string; fileName: string; userName: string; mode: string;
    durationSec: number; creditsUsed: number; status: string; createdAt: string;
  }[] = [];

  try {
    const { data: rows } = await admin
      .from("user_videos")
      .select("id, user_id, title, duration_sec, mode, credits_used, status, created_at")
      .order("created_at", { ascending: false })
      .limit(500);
    const list = rows ?? [];

    // Resolve user names in one batch (id → display_name / email).
    const ids = [...new Set(list.map((r) => r.user_id).filter(Boolean))] as string[];
    const names = new Map<string, string>();
    if (ids.length) {
      try {
        const { data: profs } = await admin
          .from("profiles").select("id, display_name, email").in("id", ids);
        for (const p of profs ?? []) {
          const nm = (p.display_name as string) ||
            ((p.email as string) ? (p.email as string).split("@")[0] : "") || "—";
          names.set(p.id as string, nm);
        }
      } catch { /* profiles table/columns may differ → names stay "—" */ }
    }

    videos = list.map((r) => ({
      id: String(r.id),
      fileName: (r.title as string) || "סרטון",
      userName: names.get(r.user_id as string) || "—",
      mode: (r.mode as string) || "",
      durationSec: Number(r.duration_sec ?? 0),
      creditsUsed: Number(r.credits_used ?? 0),
      status: (r.status as string) || "processing",
      createdAt: r.created_at as string,
    }));
  } catch { /* table may not exist yet → empty list */ }

  return NextResponse.json({ configured: true, videos });
}
