/**
 * Persistent spend ledger for renders — so credits are ALWAYS refunded when a
 * render dies, even if the whole container restarts mid-render (the in-process
 * refund in render-remotion's catch never runs in that case; the audit + Liat's
 * lost export both hit this).
 *
 * Flow:
 *   - render-remotion records a row {job_id, user_id, amount, status:'spent'}
 *     right after charging.
 *   - on success → settleSpend (status 'done', no refund).
 *   - on failure / death → reconcileSpend ATOMICALLY flips 'spent'→'refunded'
 *     and refunds exactly once (the where-status='spent' guard makes it
 *     idempotent: a second caller finds no 'spent' row and refunds nothing).
 *   - sweepStaleSpends() catches jobs that died without anyone polling.
 *
 * Server-only (service-role Supabase). Table: public.render_spends.
 */

import { adminClient } from "./supabase";
import { refundCredits } from "./serverCredits";

/** A 'spent' row older than this whose render never settled is presumed dead. */
const STALE_MS = 25 * 60 * 1000;

export async function recordSpend(jobId: string, userId: string, amount: number): Promise<void> {
  if (amount <= 0) return;
  const supa = adminClient();
  if (!supa) return;
  try {
    await supa.from("render_spends").upsert(
      { job_id: jobId, user_id: userId, amount, status: "spent" },
      { onConflict: "job_id" },
    );
  } catch (e) {
    console.error("[renderSpends.record] failed:", e);
  }
}

/** Render finished OK — mark settled so it's never refunded. */
export async function settleSpend(jobId: string): Promise<void> {
  const supa = adminClient();
  if (!supa) return;
  try {
    await supa.from("render_spends").update({ status: "done" }).eq("job_id", jobId).eq("status", "spent");
  } catch (e) {
    console.error("[renderSpends.settle] failed:", e);
  }
}

/** Refund a dead/failed render's credits ONCE. Returns the refunded amount
 *  (0 if nothing to refund — already settled/refunded/missing). Idempotent. */
export async function reconcileSpend(jobId: string, userId: string): Promise<number> {
  const supa = adminClient();
  if (!supa) return 0;
  try {
    // Atomic claim: only the caller that flips 'spent'→'refunded' gets the row
    // back, so concurrent pollers can't double-refund.
    const { data } = await supa
      .from("render_spends")
      .update({ status: "refunded" })
      .eq("job_id", jobId)
      .eq("user_id", userId)
      .eq("status", "spent")
      .select("amount")
      .maybeSingle();
    const amount = Number(data?.amount ?? 0);
    if (amount > 0) {
      await refundCredits(userId, amount);
      return amount;
    }
    return 0;
  } catch (e) {
    console.error("[renderSpends.reconcile] failed:", e);
    return 0;
  }
}

/** Refund any 'spent' rows older than STALE_MS that never settled (the render
 *  died and the user never came back to poll). Best-effort; idempotent. */
export async function sweepStaleSpends(): Promise<void> {
  const supa = adminClient();
  if (!supa) return;
  try {
    const cutoff = new Date(Date.now() - STALE_MS).toISOString();
    const { data } = await supa
      .from("render_spends")
      .select("job_id,user_id")
      .eq("status", "spent")
      .lt("created_at", cutoff)
      .limit(50);
    for (const r of data ?? []) {
      await reconcileSpend(r.job_id as string, r.user_id as string);
    }
  } catch (e) {
    console.error("[renderSpends.sweep] failed:", e);
  }
}
