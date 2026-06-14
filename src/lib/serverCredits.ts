/**
 * Server-side credit operations. Use from API routes ONLY — never bundle
 * into client code (uses the service-role Supabase client).
 *
 * Why server-side: the audit (C1) showed that browser-localStorage credits
 * are trivially editable from devtools. The only source of truth is the
 * profiles.credits column, decremented atomically via the spend_credits
 * RPC.
 */

import { adminClient } from "./supabase";

export type SpendResult =
  | { ok: true; balance: number }
  | { ok: false; reason: "insufficient" | "no-db"; balance: number };

/**
 * Atomically deduct `amount` credits from the user. Returns the new
 * balance on success, or { ok: false, reason: "insufficient" } if the
 * balance was too low (and DOES NOT decrement in that case — the RPC
 * uses a balance check inside its UPDATE WHERE).
 */
export async function spendCredits(
  userId: string,
  amount: number,
): Promise<SpendResult> {
  const supa = adminClient();
  if (!supa) return { ok: false, reason: "no-db", balance: 0 };

  const { data, error } = await supa.rpc("spend_credits", {
    p_user_id: userId,
    p_amount: amount,
  });
  if (error) {
    // Treat RPC errors as "DB unavailable" rather than crediting silently.
    console.error("[spendCredits] RPC failed:", error.message);
    return { ok: false, reason: "no-db", balance: 0 };
  }

  // Supabase returns the RPC's returned table as an array of rows.
  const row = Array.isArray(data) ? data[0] : data;
  const ok = Boolean(row?.ok);
  const balance = Number(row?.balance ?? 0);
  if (ok) return { ok: true, balance };
  return { ok: false, reason: "insufficient", balance };
}

/**
 * Read the current credit balance for a user without spending. Used to
 * sync the client display after a successful render (since the local
 * cache is now stale).
 */
export async function getCreditBalance(userId: string): Promise<number> {
  const supa = adminClient();
  if (!supa) return 0;
  const { data } = await supa
    .from("profiles")
    .select("credits")
    .eq("id", userId)
    .maybeSingle();
  return Number(data?.credits ?? 0);
}
