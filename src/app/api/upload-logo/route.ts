import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { requireUser } from "@/lib/apiAuth";

export const runtime = "nodejs";

/**
 * Save a user-uploaded logo image to the public folder and return a URL.
 * Used by the EffectsPanel custom-logo uploader.
 *
 * Hardened (post-security-audit C5):
 * - REQUIRES authentication (was anonymous).
 * - Drops SVG from the allowlist. SVG can carry inline <script> which would
 *   then execute in the master-video.co.il origin when opened directly,
 *   pivoting into a session-stealing XSS. PNG/JPG/WEBP only.
 * - Re-encodes every upload through sharp to strip EXIF, hidden payloads,
 *   and decompression-bomb headers (sharp enforces limitInputPixels).
 * - 5MB cap unchanged.
 * - Filename has a random component to avoid same-ms collisions.
 *
 * Note: the live client stores logos as data URLs (see remove-logo-bg
 * route's data-URL branch) because Coolify's container filesystem wipes
 * /public on every redeploy. This route is legacy / migration fallback;
 * kept for back-compat with snapshots saved before the data-URL move.
 */
export async function POST(req: NextRequest) {
  const user = await requireUser(req);
  if (user instanceof NextResponse) return user;

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

  // Validate extension — SVG INTENTIONALLY EXCLUDED (XSS vector).
  const ext = (file.name.match(/\.[a-zA-Z0-9]+$/)?.[0] ?? "").toLowerCase();
  const allowed = [".png", ".jpg", ".jpeg", ".webp"];
  if (!allowed.includes(ext)) {
    return NextResponse.json(
      { error: `סוג קובץ לא נתמך (${ext}). השתמשי ב-PNG, JPG או WEBP.` },
      { status: 415 },
    );
  }

  // Re-encode through sharp to strip metadata + neutralise image bombs.
  let safeBuffer: Buffer;
  try {
    const sharp = (await import("sharp")).default;
    const inBuf = Buffer.from(await file.arrayBuffer());
    safeBuffer = await sharp(inBuf, { limitInputPixels: 50_000_000 })
      .png({ compressionLevel: 8 })
      .toBuffer();
  } catch {
    return NextResponse.json({ error: "קובץ תמונה פגום" }, { status: 415 });
  }

  const dir = join(process.cwd(), "public", "custom-logos");
  await mkdir(dir, { recursive: true });

  // Random suffix prevents same-millisecond collisions between users.
  const rnd = (await import("node:crypto")).randomBytes(4).toString("hex");
  const filename = `${Date.now()}-${rnd}.png`;
  const filepath = join(dir, filename);
  await writeFile(filepath, safeBuffer);

  return NextResponse.json({
    url: `/custom-logos/${filename}`,
    serverPath: filepath,
  });
}
