/**
 * Server-side credit-spend endpoint. Used by client flows that aren't a
 * single API-route round-trip (e.g. /multi: result is cached locally,
 * the user clicks "download" later — the server deducts credits THERE
 * via this endpoint).
 *
 * For single-call flows (e.g. /api/render), the spend happens inside
 * that route's handler — don't call this from /api/render or you'll
 * double-charge.
 *
 * Closes audit C1 alongside the /api/render inline spend: localStorage
 * credits are no longer trusted; this is the only path that decrements
 * the real balance.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/apiAuth";
import { rateLimit } from "@/lib/rateLimit";
import { spendCredits } from "@/lib/serverCredits";
import { CREDIT_COSTS } from "@/lib/credits";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const user = await requireUser(req);
  if (user instanceof NextResponse) return user;
  const limited = rateLimit(req, { key: `credits-spend:${user.id}`, max: 20, windowSec: 60 });
  if (limited) return limited;

  const { amount, reason } = (await req.json().catch(() => ({}))) as {
    amount?: number; reason?: string;
  };

  // Server-authoritative pricing for KNOWN reasons — NEVER trust the client's
  // amount for a priced action (a tampered request could pay 1 for a 20-job).
  // Unknown reasons fall back to the clamped client amount (back-compat).
  const SERVER_COST: Record<string, number> = {
    "multi-edit-download": CREDIT_COSTS.multi_video,
    "srt-export": CREDIT_COSTS.srt_export,
  };
  const required = reason && SERVER_COST[reason] != null
    ? SERVER_COST[reason]
    : (typeof amount === "number" ? Math.floor(amount) : NaN);
  if (!Number.isFinite(required) || required <= 0 || required > 1000) {
    return NextResponse.json({ error: "סכום לא חוקי" }, { status: 400 });
  }

  const result = await spendCredits(user.id, required);
  if (!result.ok) {
    if (result.reason === "insufficient") {
      return NextResponse.json(
        { error: `אין מספיק מאסטרים (צריך ${required}, יש לך ${result.balance})`, code: "INSUFFICIENT", balance: result.balance },
        { status: 402 },
      );
    }
    return NextResponse.json({ error: "מערכת התשלום לא זמינה" }, { status: 503 });
  }

  console.log("[credits.spend]", { userId: user.id, reason, required, newBalance: result.balance });
  return NextResponse.json({ ok: true, balance: result.balance });
}
