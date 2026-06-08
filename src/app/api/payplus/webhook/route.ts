/**
 * PayPlus IPN (server-to-server payment notification).
 *
 * PayPlus POSTs here after a successful or failed payment. We:
 *  1. Verify the HMAC signature so we KNOW the request is from PayPlus
 *     (otherwise anyone could fake "payment success" and steal credits).
 *  2. If status_code === "000" (approved), credit the user.
 *  3. Always return 200 quickly — PayPlus retries on non-2xx.
 *
 * TODAY (no auth backend yet): we log the event and the client polls
 * `/credits` to see the updated balance. After Lovable migration with
 * Supabase Auth, this handler will:
 *    UPDATE profiles SET credits = credits + N WHERE id = userId;
 *    INSERT INTO revenue_txns (...);
 *
 * The signed user id comes back in `more_info` which we set in checkout.
 */

import { NextRequest, NextResponse } from "next/server";
import {
  verifyAndParseWebhook, isWebhookApproved, extractMoreInfo,
} from "@/lib/payplus";

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

  const info = extractMoreInfo(payload);
  console.log("[payplus webhook] approved payment", {
    packageId: info.packageId,
    credits: info.credits,
    userId: info.userId,
    amount: payload.amount,
    transactionUid: payload.transaction_uid,
  });

  // TODO (Supabase migration): credit the user + insert revenue row.
  // const supa = createServerClient();
  // await supa.rpc("add_credits", { p_user_id: info.userId, p_credits: info.credits });
  // await supa.from("revenue_txns").insert({
  //   user_id: info.userId,
  //   stripe_session_id: null,
  //   payplus_transaction_uid: payload.transaction_uid,
  //   amount_ils: Number(payload.amount ?? 0),
  //   credits_bought: info.credits,
  //   package_id: info.packageId,
  // });

  return NextResponse.json({ ok: true });
}
