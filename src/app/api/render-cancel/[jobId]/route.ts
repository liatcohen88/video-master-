/**
 * POST /api/render-cancel/[jobId]
 * Cancel a background render and refund the user's credits (Liat: "אפשרות לבטל
 * יצוא וזה מחזיר את כל הקרדיטים"). Only the job's owner may cancel it.
 *
 * - Signals the in-flight render to abort (no-op if it's still queued or already
 *   finished — the queued runner checks isCancelRequested() and skips it).
 * - Marks the job "cancelled" and refunds via the persistent spend ledger
 *   (idempotent with the in-process catch + the status-poll reconcile path).
 */
import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/apiAuth";
import { getJob, updateJob, requestRenderCancel } from "@/lib/renderJobs";
import { reconcileSpend } from "@/lib/renderSpends";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ jobId: string }> },
) {
  const user = await requireUser(req);
  if (user instanceof NextResponse) return user;

  const { jobId } = await params;
  const job = await getJob(jobId);
  // If the job meta still exists, enforce ownership. If it's already gone
  // (cleaned / restart), we still allow the refund below — reconcileSpend only
  // refunds a spend row that belongs to THIS user, so it's safe.
  if (job && job.userId !== user.id) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  // Already finished? Nothing to cancel (and don't refund a delivered export).
  if (job && (job.status === "done" || job.status === "cancelled")) {
    return NextResponse.json({ ok: true, alreadyDone: job.status === "done", refunded: 0 });
  }

  // Abort the in-flight render (if running) and flag it so a queued runner skips it.
  requestRenderCancel(jobId);
  await updateJob(jobId, { status: "cancelled" });
  const refunded = await reconcileSpend(jobId, user.id).catch(() => 0);

  return NextResponse.json({ ok: true, refunded });
}
