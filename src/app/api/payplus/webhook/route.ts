/**
 * PayPlus IPN (server-to-server payment notification).
 *
 * Flow:
 *  1. HMAC-verify the body so we KNOW the request came from PayPlus
 *     (otherwise anyone could fake "payment success" and steal credits).
 *  2. If status_code === "000" (approved), credit the user.
 *  3. Always return 200 quickly — PayPlus retries on non-2xx.
 *
 * The credits granted are recomputed SERVER-SIDE from the paid amount via
 * creditsForAmount() — we never trust a `credits` field round-tripped
 * through more_info, because the client controls more_info before the
 * webhook fires. Otherwise an attacker would pay ₪1 and claim 1M credits.
 *
 * The user's email is stamped into more_info at checkout time so this
 * handler can find their Supabase profile to credit.
 */

import { NextRequest, NextResponse } from "next/server";
import {
  verifyAndParseWebhook, isWebhookApproved, extractMoreInfo,
} from "@/lib/payplus";
import { creditUserByEmail, creditsForAmount } from "@/lib/fulfillment";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  // PayPlus sends signature in a header — name varies by docs version,
  // accept any of the common variants.
  const sig =
    req.headers.get("x-payplus-signature") ??
    req.headers.get("payplus-signature") ??
    req.headers.get("signature");

  const raw = await req.text();
  const payload = await verifyAndParseWebhook(raw, sig);
  if (!payload) {
    // Signature mismatch OR not configured. Return 401 so PayPlus retries
    // (in case of transient cert issues) and we don't accidentally credit.
    console.warn("[payplus webhook] signature failed", { sig });
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }

  if (!isWebhookApproved(payload)) {
    console.log("[payplus webhook] non-approved status", payload.status_code);
    return NextResponse.json({ ok: true, status: "ignored" });
  }

  const info = extractMoreInfo(payload) as { packageId?: string; userId?: string; email?: string };
  // Recompute credits from the AMOUNT PayPlus says was paid — never trust
  // a credits field round-tripped through more_info. creditsForAmount maps
  // the paid ILS to the matching package size.
  const amountIls = Number(payload.amount ?? 0);
  const credits = creditsForAmount(amountIls);
  console.log("[payplus webhook] approved payment", {
    packageId: info.packageId,
    creditsResolved: credits,
    amountIls,
    transactionUid: payload.transaction_uid,
    email: info.email ? info.email.slice(0, 3) + "***" : "(missing)",
  });

  if (!info.email) {
    // No email means we can't find the profile. Log and return 200 (don't
    // make PayPlus retry forever — this is a checkout-flow bug, not a
    // transient failure).
    console.error("[payplus webhook] missing email in more_info — cannot credit");
    return NextResponse.json({ ok: true, status: "no-email" });
  }

  const result = await creditUserByEmail({
    email: info.email,
    credits,
    amountIls,
    provider: "payplus",
    txnId: payload.transaction_uid,
    packageId: info.packageId,
  });

  console.log("[payplus webhook] fulfillment result", { result });
  return NextResponse.json({ ok: true, status: result });
}
