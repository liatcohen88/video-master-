/**
 * Order fulfillment — turn a confirmed payment into credited מאסטרים.
 * Shared by the payment webhooks (Make/Grow). Server-only (uses the Supabase
 * service-role client). Degrades gracefully if Supabase isn't configured.
 */
import { adminClient } from "./supabase";
import { CREDIT_PACKAGES } from "./credits";
import { notifyAdminPayment } from "./notifyAdmin";

/** Map a paid amount (₪) to the number of credits that package grants. */
export function creditsForAmount(amountIls: number): number {
  const exact = CREDIT_PACKAGES.find((p) => p.priceIls === amountIls);
  if (exact) return exact.credits;
  // Fallback: best package at or below the paid amount.
  const below = [...CREDIT_PACKAGES]
    .filter((p) => p.priceIls <= amountIls)
    .sort((a, b) => b.priceIls - a.priceIls)[0];
  return below?.credits ?? 0;
}

export type FulfillResult = "credited" | "duplicate" | "no-user" | "no-db" | "no-credits";

/**
 * Credit a user (found by email) for a payment. Idempotent: the unique
 * (provider, provider_txn_id) index on revenue_txns prevents double-credit
 * when a webhook is delivered twice.
 */
export async function creditUserByEmail(opts: {
  email?: string;
  credits: number;
  amountIls: number;
  provider: string;          // 'make' | 'grow' | 'payplus'
  txnId?: string;
  packageId?: string;
}): Promise<FulfillResult> {
  if (!opts.credits || opts.credits <= 0) return "no-credits";
  const supa = adminClient();
  if (!supa) return "no-db";

  if (!opts.email) return "no-user";
  const { data: profile } = await supa
    .from("profiles").select("id").eq("email", opts.email.toLowerCase().trim()).maybeSingle();
  if (!profile?.id) return "no-user";

  const { error: revErr } = await supa.from("revenue_txns").insert({
    user_id: profile.id,
    email: opts.email,
    provider: opts.provider,
    provider_txn_id: opts.txnId ?? null,
    amount_ils: opts.amountIls,
    credits_bought: opts.credits,
    package_id: opts.packageId ?? null,
  });
  if (revErr) {
    if (revErr.code === "23505") return "duplicate"; // unique violation
    throw new Error(`revenue insert failed: ${revErr.message}`);
  }

  const { error: addErr } = await supa.rpc("add_credits", { p_user_id: profile.id, p_credits: opts.credits });
  if (addErr) throw new Error(`add_credits failed: ${addErr.message}`);

  // Heads-up to the admin on every successful payment (WhatsApp via CallMeBot).
  // Fire-and-forget on the long-lived server process so it never delays the
  // webhook's ack to the payment provider. No-op until the CallMeBot env is set.
  void notifyAdminPayment({ amountIls: opts.amountIls, credits: opts.credits, packageId: opts.packageId });
  return "credited";
}
