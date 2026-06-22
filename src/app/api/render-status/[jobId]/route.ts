/**
 * GET /api/render-status/[jobId]
 * Poll a background render job. Returns { status, error, filename }.
 * Only the job's owner may read it.
 */
import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/apiAuth";
import { getJob, outputReady } from "@/lib/renderJobs";
import { reconcileSpend } from "@/lib/renderSpends";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ jobId: string }> },
) {
  const user = await requireUser(req);
  if (user instanceof NextResponse) return user;

  const { jobId } = await params;
  const job = await getJob(jobId);
  if (!job) {
    // Job meta is gone (e.g. the container restarted mid-render). Refund the
    // spend if it's still owed and report failed so the client shows the
    // refund message instead of a bare "not found".
    const refunded = await reconcileSpend(jobId, user.id);
    if (refunded > 0) {
      return NextResponse.json({ status: "failed", error: "הייצוא נכשל", refunded });
    }
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  if (job.userId !== user.id) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  // Guard against the (rare) race where status says done but the file isn't
  // flushed yet — report "rendering" until the bytes are actually on disk.
  const status = job.status === "done" && !outputReady(job.id) ? "rendering" : job.status;

  // A failed job → make sure the spend was refunded (idempotent; the in-process
  // catch may not have run if the process died).
  if (status === "failed") await reconcileSpend(job.id, user.id);

  return NextResponse.json({
    status,
    error: job.error ?? null,
    filename: job.filename,
    progress: status === "done" ? 100 : (job.progress ?? 0),
  });
}
