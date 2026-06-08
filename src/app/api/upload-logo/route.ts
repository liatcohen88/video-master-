import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";

export const runtime = "nodejs";

/**
 * Save a user-uploaded logo image to the public folder and return a URL.
 * Used by the EffectsPanel custom-logo uploader.
 *
 * Accepts: PNG, SVG, JPEG. Max ~5MB.
 */
export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const file = formData.get("logo") as File | null;
  if (!file) {
    return NextResponse.json({ error: "אין קובץ" }, { status: 400 });
  }

  // 5MB cap to keep things sane
  if (file.size > 5 * 1024 * 1024) {
    return NextResponse.json(
      { error: "קובץ גדול מדי (מקסימום 5MB)" },
      { status: 413 },
    );
  }

  // Validate extension
  const ext = (file.name.match(/\.[a-zA-Z0-9]+$/)?.[0] ?? "").toLowerCase();
  const allowed = [".png", ".svg", ".jpg", ".jpeg", ".webp"];
  if (!allowed.includes(ext)) {
    return NextResponse.json(
      { error: `סוג קובץ לא נתמך (${ext}). השתמשי ב-PNG, SVG או JPG.` },
      { status: 415 },
    );
  }

  const dir = join(process.cwd(), "public", "custom-logos");
  await mkdir(dir, { recursive: true });

  const filename = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, "_")}`;
  const filepath = join(dir, filename);
  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(filepath, buffer);

  return NextResponse.json({
    url: `/custom-logos/${filename}`,
    serverPath: filepath,
  });
}
