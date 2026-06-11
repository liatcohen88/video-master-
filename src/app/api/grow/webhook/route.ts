/**
 * Grow (גראו / Meshulam) webhook — server-to-server payment notification.
 *
 * Grow POSTs here after a payment. We:
 *  1. Parse the body (form-urlencoded or JSON).
 *  2. Verify it's really from Grow (shared secret in a custom field;
 *     production should ALSO re-verify via Grow's API — see grow.ts).
 *  3. If approved, credit the buyer's account.
 *  4. Always return 200 fast — Grow retries on non-2xx.
 *
 * ⚠️ TODAY there is no server-side user store: credits live in the browser's
 * localStorage (client-side), so a server webhook has nowhere to write them.
 * This handler therefore LOGS the verified payment and is ready to credit the
 * moment a real DB (Supabase) + deployment exist. The Supabase code is stubbed
 * below — uncomment after migration.
 *
 * To set the webhook URL in Grow's dashboard once deployed:
 *   https://YOUR-DOMAIN/api/grow/webhook
 */

import { NextRequest, NextResponse } from "next/server";
import { parseGrowWebhook, verifyGrowWebhook, isApproved } from "@/lib/grow";
import { adminClient } from "@/lib/supabase";

export const runtime = "nodejs";

/**
 * Credit a buyer in Supabase (idempotent). Finds the profile by email,
 * records the revenue row (unique on provider+txn so duplicate webhook
 * deliveries don't double-credit), then atomically adds the credits.
 * Returns "credited" | "duplicate" | "no-user" | "no-db".
 */
async function creditViaSupabase(opts: {
  email?: string; userId?: string; credits: number;
  txnId?: string; amountIls?: number; packageId?: string;
}): Promise<string> {
  const supa = adminClient();
  if (!supa) return "no-db";

  // Resolve the profile: prefer explicit userId, else look up by email.
  let userId = opts.userId;
  if (!userId && opts.email) {
    const { data } = await supa.from("profiles").select("id").eq("email", opts.email).maybeSingle();
    userId = data?.id;
  }
  if (!userId) return "no-user";

  // Record revenue first — the unique (provider, provider_txn_id) index makes
  // a repeated delivery fail here, so we skip the credit and report duplicate.
  const { error: revErr } = await supa.from("revenue_txns").insert({
    user_id: userId,
    email: opts.email ?? null,
    provider: "grow",
    provider_txn_id: opts.txnId ?? null,
    amount_ils: opts.amountIls ?? 0,
    credits_bought: opts.credits,
    package_id: opts.packageId ?? null,
  });
  if (revErr) {
    if (revErr.code === "23505") return "duplicate"; // unique violation
    throw new Error(`revenue insert failed: ${revErr.message}`);
  }

  const { error: addErr } = await supa.rpc("add_credits", { p_user_id: userId, p_credits: opts.credits });
  if (addErr) throw new Error(`add_credits failed: ${addErr.message}`);
  return "credited";
}

export async function POST(req: NextRequest) {
  const contentType = req.headers.get("content-type");
  const raw = await req.text();

  const hook = parseGrowWebhook(raw, contentType);

  // 1. Authenticity — reject anything we can't verify so nobody mints credits.
  if (!verifyGrowWebhook(hook)) {
    console.warn("[grow webhook] verification failed", {
      hasSecret: Boolean(hook.secret),
      txId: hook.transactionId,
    });
    return NextResponse.json({ error: "verification failed" }, { status: 401 });
  }

  // 2. Only act on approved charges.
  if (!isApproved(hook)) {
    console.log("[grow webhook] non-approved status", hook.statusCode);
    return NextResponse.json({ ok: true, status: "ignored" });
  }

  console.log("[grow webhook] approved payment", {
    transactionId: hook.transactionId,
    sum: hook.sum,
    packageId: hook.packageId,
    credits: hook.credits,
  });

  // 3. Credit the buyer in Supabase (no-op if Supabase isn't configured yet).
  //    Email comes from a custom field or Grow's payer fields.
  const email = hook.raw["data[payerEmail]"] ?? hook.raw["payerEmail"] ?? hook.raw[`data[customFields][cField5]`];
  try {
    const result = await creditViaSupabase({
      email,
      userId: hook.userId,
      credits: Number(hook.credits ?? 0),
      txnId: hook.transactionId,
      amountIls: hook.sum,
      packageId: hook.packageId,
    });
    console.log("[grow webhook] credit result:", result);
  } catch (e) {
    console.error("[grow webhook] credit error:", e);
    // Return 500 so Grow retries — better than silently losing a credit.
    return NextResponse.json({ error: "credit failed" }, { status: 500 });
  }

  // RECOMMENDED before crediting in production: independently re-verify the
  // charge via Grow's verify-transaction API (GROW_API_KEY + transactionId),
  // so a leaked webhook secret alone can't grant credits.

  return NextResponse.json({ ok: true });
}

// Some Grow setups send a GET "ping" to validate the URL on save — answer it.
export async function GET() {
  return NextResponse.json({ ok: true, endpoint: "grow-webhook" });
}
