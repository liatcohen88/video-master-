/**
 * Admin Lottie upload — saves a .json animation the admin uploads into
 * public/lottie/ so it loads exactly like the built-in registry entries.
 *
 * Validates: file is parseable JSON and looks like a Lottie (has the `v`,
 * `layers` keys Bodymovin emits). Rejects raster-only animations (any layer
 * with an `assets` PNG) so the color override + headless rasterizer don't
 * silently fail later — that's the same trap fire.json originally hit.
 *
 * Metadata (display name, default color) lives client-side in CMS key
 * "lottie.custom".
 */

import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";

export const runtime = "nodejs";

const MAX_BYTES = 600 * 1024; // 600KB — vector Lottie JSONs are tiny

export async function POST(req: NextRequest) {
  const fd = await req.formData();
  const file = fd.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "חסר קובץ" }, { status: 400 });
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "קובץ גדול מדי (מקס׳ 600KB)" }, { status: 400 });
  }
  if (!/\.json$/i.test(file.name)) {
    return NextResponse.json({ error: "רק קבצי JSON של Lottie" }, { status: 400 });
  }

  const raw = await file.text();
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "JSON לא תקין" }, { status: 400 });
  }
  if (!parsed || typeof parsed !== "object") {
    return NextResponse.json({ error: "מבנה JSON לא תקין" }, { status: 400 });
  }
  const obj = parsed as Record<string, unknown>;
  if (!("v" in obj) || !("layers" in obj)) {
    return NextResponse.json({ error: "לא נראה כמו Lottie (חסר v / layers)" }, { status: 400 });
  }
  // Reject raster-only Lottie (image assets) — won't tint and won't export.
  const assets = obj.assets;
  if (Array.isArray(assets)) {
    const hasRasterOnly = assets.some((a) => {
      const x = a as Record<string, unknown>;
      return typeof x.p === "string" && /^data:image\/(png|jpe?g)/i.test(x.p);
    });
    if (hasRasterOnly) {
      return NextResponse.json({
        error: "Lottie מבוסס תמונה (PNG) — לא נתמך. הורידי גרסה וקטורית.",
      }, { status: 400 });
    }
  }

  const id = `custom${Date.now()}`;
  const dir = join(process.cwd(), "public", "lottie");
  await mkdir(dir, { recursive: true });
  const filePath = join(dir, `${id}.json`);
  await writeFile(filePath, raw);

  return NextResponse.json({
    ok: true,
    id,
    url: `/lottie/${id}.json`,
    originalName: file.name,
  });
}
