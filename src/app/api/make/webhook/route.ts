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

export async function POST(req: NextRequest) {
  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch { /* allow form too */ }

  const secret = (body.secret as string) ?? req.headers.get("x-make-secret");
  if (!process.env.MAKE_WEBHOOK_SECRET || secret !== process.env.MAKE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const email = (body.email as string) || undefined;
  const amount = Number(body.amount ?? body.amountIls ?? body.sum ?? 0);
  const credits = body.credits != null ? Number(body.credits) : creditsForAmount(amount);
  const txnId = (body.txnId as string) || (body.transactionId as string) || undefined;

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
