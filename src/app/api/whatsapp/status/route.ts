/**
 * GET /api/whatsapp/status?jobId=...
 * Server-to-server (WhatsApp bot only). Poll a render job by id (the secret is
 * the auth — no per-user check needed since the bot owns the whole flow).
 * Returns { status, progress, resultUrl, editorUrl }.
 */
import { NextRequest, NextResponse } from "next/server";
import { botSecretOk } from "@/lib/apiAuth";
import { resultToken } from "@/lib/whatsappHeadless";
import { getJob, outputReady } from "@/lib/renderJobs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://master-video.co.il").replace(/\/$/, "");

export async function GET(req: NextRequest) {
  if (!botSecretOk(req)) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const jobId = req.nextUrl.searchParams.get("jobId") || "";
  if (!jobId) return NextResponse.json({ error: "missing jobId" }, { status: 400 });

  const job = await getJob(jobId);
  if (!job) return NextResponse.json({ status: "failed", error: "not found" });

  // Guard the race where status flips to done before the bytes are flushed.
  const status = job.status === "done" && !outputReady(job.id) ? "rendering" : job.status;

  return NextResponse.json({
    status,
    progress: status === "done" ? 100 : (job.progress ?? 0),
    resultUrl: status === "done"
      ? `${SITE_URL}/api/whatsapp/result?jobId=${encodeURIComponent(job.id)}&token=${resultToken(job.id)}`
      : undefined,
    editorUrl: `${SITE_URL}/?waedit=${encodeURIComponent(job.id)}&token=${resultToken(job.id)}`,
  });
}
