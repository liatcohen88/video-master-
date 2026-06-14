import { NextRequest, NextResponse } from "next/server";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { removeBackground } from "@/lib/imageBackgroundRemoval";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Take a previously-uploaded logo (URL like "/custom-logos/123-name.png")
 * and produce a background-removed copy. The new PNG is saved next to
 * the original with a "-nobg.png" suffix and the new URL is returned.
 *
 * SVG inputs are returned unchanged because they already support alpha.
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const src = typeof body?.src === "string" ? body.src : null;

  if (!src) {
    return NextResponse.json({ error: "פרמטר src חסר" }, { status: 400 });
  }

  // 1) Data-URL path (new: logos are stored as data URLs in project state
  //    because Coolify's container filesystem wipes /public on every
  //    redeploy). Decode, run BG removal, return a new data URL.
  if (src.startsWith("data:")) {
    const mimeMatch = src.match(/^data:([^;]+);base64,(.*)$/);
    if (!mimeMatch) {
      return NextResponse.json({ error: "data URL לא תקין" }, { status: 400 });
    }
    const [, mime, b64] = mimeMatch;
    if (mime.includes("svg")) {
      return NextResponse.json({ url: src }); // SVG already has alpha
    }
    try {
      const inBuf = Buffer.from(b64, "base64");
      const outBuf = await removeBackground(inBuf);
      const outB64 = outBuf.toString("base64");
      return NextResponse.json({ url: `data:image/png;base64,${outB64}` });
    } catch (err: unknown) {
      return NextResponse.json(
        { error: err instanceof Error ? err.message : String(err) },
        { status: 500 },
      );
    }
  }

  // 2) Legacy /custom-logos/* file path (kept for back-compat with any
  //    project snapshots saved before the data-URL migration).
  if (!src.startsWith("/custom-logos/")) {
    return NextResponse.json({ error: "פרמטר src לא חוקי" }, { status: 400 });
  }
  if (src.toLowerCase().endsWith(".svg")) {
    return NextResponse.json({ url: src });
  }

  const filename = src.replace("/custom-logos/", "");
  const sourcePath = join(process.cwd(), "public", "custom-logos", filename);
  const dir = join(process.cwd(), "public", "custom-logos");
  await mkdir(dir, { recursive: true });

  let sourceBuf: Buffer;
  try {
    sourceBuf = await readFile(sourcePath);
  } catch {
    return NextResponse.json({ error: "הקובץ לא נמצא בשרת" }, { status: 404 });
  }

  try {
    const result = await removeBackground(sourceBuf);
    const nobgName = filename.replace(/\.[a-zA-Z0-9]+$/, "") + "-nobg.png";
    const nobgPath = join(dir, nobgName);
    await writeFile(nobgPath, result);
    return NextResponse.json({ url: `/custom-logos/${nobgName}` });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
