/**
 * POST /api/buy — initiate a credit-package purchase.
 *
 * Why this exists: Grow's hosted payment page doesn't collect the
 * buyer's email in its minimal flow, and Grow URLs don't reliably
 * round-trip query parameters. So before sending the buyer to Grow we
 * write a `pending_payments` row tying their user_id to the expected
 * amount. When Grow's webhook fires later, /api/grow/webhook matches
 * the incoming amount against the most recent unfulfilled pending row
 * and credits that user.
 *
 * Auth: caller MUST supply an Authorization: Bearer <supabase access
 * token> header. Anonymous buyers cannot start a purchase — they get
 * gated to login first.
 *
 * Response: { redirectUrl, pendingId } on success.
 */

import { NextRequest, NextResponse } from "next/server";
import { browserClient as anonClient, adminClient } from "@/lib/supabase";
import { CREDIT_PACKAGES } from "@/lib/credits";
import { rateLimit } from "@/lib/rateLimit";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  // Abuse: max 10 buy starts per IP per minute.
  const limited = rateLimit(req, { key: "buy", max: 10, windowSec: 60 });
  if (limited) return limited;

  const { packageId } = await req.json().catch(() => ({}));
  const pkg = CREDIT_PACKAGES.find((p) => p.id === packageId);
  if (!pkg) {
    return NextResponse.json({ error: "חבילה לא מזוהה" }, { status: 400 });
  }
  if (!pkg.payUrl) {
    return NextResponse.json({ error: "החבילה הזו עדיין לא מחוברת לסליקה. ננסה את חבילת ההתחלה." }, { status: 503 });
  }

  // Verify the caller is authenticated.
  const authHeader = req.headers.get("authorization") ?? "";
  const accessToken = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!accessToken) {
    return NextResponse.json({ error: "צריך להתחבר כדי לקנות חבילה" }, { status: 401 });
  }

  const anon = anonClient();
  const supa = adminClient();
  if (!anon || !supa) {
    return NextResponse.json({ error: "מערכת לא מוגדרת" }, { status: 500 });
  }

  const { data: userData, error: userErr } = await anon.auth.getUser(accessToken);
  if (userErr || !userData?.user) {
    return NextResponse.json({ error: "התחברות לא תקפה" }, { status: 401 });
  }
  const userId = userData.user.id;

  // Write the pending row. service-role bypasses RLS so we can insert.
  const { data: pending, error: insErr } = await supa
    .from("pending_payments")
    .insert({
      user_id: userId,
      package_id: pkg.id,
      amount_ils: pkg.priceIls,
      credits: pkg.credits,
    })
    .select("id")
    .single();
  if (insErr) {
    console.error("[buy] pending insert failed:", insErr.message);
    return NextResponse.json({ error: "כשל בהכנת התשלום" }, { status: 500 });
  }

  return NextResponse.json({ redirectUrl: pkg.payUrl, pendingId: pending.id });
}
