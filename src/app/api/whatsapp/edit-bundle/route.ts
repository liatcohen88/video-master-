/**
 * GET /api/whatsapp/edit-bundle?jobId=...&token=...&what=project|source
 * Serves the saved WhatsApp project (JSON) or its SOURCE video (MP4) so the
 * editor deep-link can reopen the exact project that was rendered. Guarded by
 * the same HMAC capability token as the result download — the link was
 * delivered only to the sender's WhatsApp.
 */
import { NextRequest, NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { botSecretOk } from "@/lib/apiAuth";
import { resultTokenValid } from "@/lib/whatsappHeadless";
import { jobOutputPath } from "@/lib/renderJobs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const jobId = req.nextUrl.searchParams.get("jobId") || "";
  const what = req.nextUrl.searchParams.get("what") || "project";
  if (!jobId) return NextResponse.json({ error: "missing jobId" }, { status: 400 });

  const token = req.nextUrl.searchParams.get("token");
  if (!botSecretOk(req) && !resultTokenValid(jobId, token)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const dir = dirname(jobOutputPath(jobId));
  try {
    if (what === "source") {
      const bytes = await readFile(join(dir, "wa-source.mp4"));
      return new NextResponse(new Uint8Array(bytes), {
        status: 200,
        headers: {
          "Content-Type": "video/mp4",
          "Content-Length": String(bytes.length),
          "Cache-Control": "private, max-age=3600",
        },
      });
    }
    const json = await readFile(join(dir, "wa-project.json"), "utf8");
    return new NextResponse(json, {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch {
    // Folder was cleaned (old job) or files never persisted.
    return NextResponse.json({ error: "expired" }, { status: 404 });
  }
}
