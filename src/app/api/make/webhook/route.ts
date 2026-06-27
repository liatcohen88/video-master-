/**
 * Make.com webhook — the FREE bridge to Grow (and any other processor).
 *
 * Flow:
 *   customer pays in Grow → Make's "watch payments" trigger fires →
 *   Make sends an HTTP POST here with the payer email + amount →
 *   we credit the matching user in Supabase.
 *
 * Using Make avoids Grow's 500₪/month direct-API fee. Set up the Make
 * scenario to POST JSON to:  https://YOUR-DOMAIN/api/make/webhook
 *
 * Body (JSON), from your Make scenario:
 *   {
 *     "secret": "<MAKE_WEBHOOK_SECRET>",   // a random string you choose
 *     "email":  "{{payer email from Grow}}",
 *     "amount": {{paid amount in ₪}},
 *     "txnId":  "{{Grow transaction id}}"   // optional, prevents double-credit
 *   }
 *
 * The package is inferred from the amount (₪10→25, ₪25→50, ₪50→100, ₪100→200).
 * You can also send "credits" explicitly to override.
 *
 * TODAY (no Supabase configured) this verifies + logs and returns 200 so you
 * can wire/test the Make scenario; it starts crediting the moment Supabase is
 * connected and the app is deployed.
 */

import { NextRequest, NextResponse } from "next/server";
import { creditUserByEmail, creditsForAmount } from "@/lib/fulfillment";

export const runtime = "nodejs";

/**
 * Constant-time secret comparison. A plain `a !== b` short-circuits on the
 * first differing byte, leaking the secret's length+prefix to a timing
 * attacker. timingSafeEqual always reads both buffers fully. (Audit C7.)
 */
function secretMatches(provided: string, expected: string): boolean {
  if (provided.length !== expected.length) return false;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { timingSafeEqual } = require("node:crypto") as typeof import("node:crypto");
    return timingSafeEqual(Buffer.from(provided), Buffer.from(expected));
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest) {
  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch { /* allow form too */ }

  const expected = process.env.MAKE_WEBHOOK_SECRET;
  const provided = (body.secret as string) ?? req.headers.get("x-make-secret") ?? "";
  if (!expected || !secretMatches(provided, expected)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const email = (body.email as string) || undefined;
  const amount = Number(body.amount ?? body.amountIls ?? body.sum ?? 0);
  // Credits are recomputed SERVER-SIDE from the amount actually paid. We never
  // trust a `credits` field from the payload — otherwise anyone who learns the
  // webhook secret could pay ₪10 and claim 1,000,000 מאסטרים. (Audit C3.)
  const credits = creditsForAmount(amount);
  const txnId = (body.txnId as string) || (body.transactionId as string) || (body.asmachta as string) || undefined;

  try {
    const result = await creditUserByEmail({
      email, credits, amountIls: amount, provider: "make", txnId,
    });
    console.log("[make webhook]", { email, amount, credits, result });
    return NextResponse.json({ ok: true, result });
  } catch (e) {
    console.error("[make webhook] error:", e);
    return NextResponse.json({ error: "fulfillment failed" }, { status: 500 });
  }
}

// Make sends a GET to validate the URL when you create the webhook.
export async function GET() {
  return NextResponse.json({ ok: true, endpoint: "make-webhook" });
}
