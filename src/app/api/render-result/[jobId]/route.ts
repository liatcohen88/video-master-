/**
 * GET /api/render-result/[jobId]
 * Stream the finished MP4 for a background render job. Owner-only.
 */
import { NextRequest, NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import { requireUser } from "@/lib/apiAuth";
import { getJob, jobOutputPath, outputReady } from "@/lib/renderJobs";

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
  if (!job) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (job.userId !== user.id) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  if (job.status !== "done" || !outputReady(job.id)) {
    return NextResponse.json({ error: "not ready" }, { status: 409 });
  }

  const bytes = await readFile(jobOutputPath(job.id));
  return new NextResponse(new Uint8Array(bytes), {
    status: 200,
    headers: {
      "Content-Type": "video/mp4",
      "Content-Disposition": `attachment; filename="${job.filename}"`,
      "Content-Length": String(bytes.length),
    },
  });
}
