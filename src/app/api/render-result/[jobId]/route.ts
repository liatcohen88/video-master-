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
  // The download filename is Hebrew ("מאסטר וידאו…") — putting it RAW in a
  // Content-Disposition header throws "Cannot convert argument to a ByteString"
  // (header values are Latin-1 only), which made the result 500 and the export
  // "fail" at the very end after a successful render (Liat). Use RFC 5987:
  // an ASCII fallback + a percent-encoded UTF-8 filename* that browsers prefer.
  const asciiName = job.filename.replace(/[^\x20-\x7E]+/g, "").trim() || "master-video.mp4";
  const utf8Name = encodeURIComponent(job.filename);
  return new NextResponse(new Uint8Array(bytes), {
    status: 200,
    headers: {
      "Content-Type": "video/mp4",
      "Content-Disposition": `attachment; filename="${asciiName}"; filename*=UTF-8''${utf8Name}`,
      "Content-Length": String(bytes.length),
    },
  });
}
