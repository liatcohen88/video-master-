/**
 * GET /api/whatsapp/result?jobId=...
 * Server-to-server (WhatsApp bot only). Stream the finished MP4 for a render
 * job. Secret-guarded; served from THIS server (not Supabase) so WhatsApp
 * deliveries don't add Supabase egress.
 */
import { NextRequest, NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import { botSecretOk } from "@/lib/apiAuth";
import { resultTokenValid } from "@/lib/whatsappHeadless";
import { getJob, jobOutputPath, outputReady } from "@/lib/renderJobs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const jobId = req.nextUrl.searchParams.get("jobId") || "";
  if (!jobId) return NextResponse.json({ error: "missing jobId" }, { status: 400 });

  // Accept EITHER the bot secret (server-to-server) OR a valid capability token
  // in the URL (so a WhatsApp user can click the download link directly).
  const token = req.nextUrl.searchParams.get("token");
  if (!botSecretOk(req) && !resultTokenValid(jobId, token)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const job = await getJob(jobId);
  if (!job) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (job.status !== "done" || !outputReady(job.id)) {
    return NextResponse.json({ error: "not ready" }, { status: 409 });
  }

  const bytes = await readFile(jobOutputPath(job.id));
  const asciiName = job.filename.replace(/[^\x20-\x7E]+/g, "").trim() || "master-video.mp4";
  const utf8Name = encodeURIComponent(job.filename);
  return new NextResponse(new Uint8Array(bytes), {
    status: 200,
    headers: {
      "Content-Type": "video/mp4",
      "Content-Disposition": `inline; filename="${asciiName}"; filename*=UTF-8''${utf8Name}`,
      "Content-Length": String(bytes.length),
    },
  });
}
