/**
 * Admin SFX upload — saves a sound file the admin uploads into public/sfx/
 * using the same naming convention as the built-in library
 * (sfx_<id>.mp3, id = "custom<timestamp>"), so BOTH the live preview
 * (URL /sfx/sfx_<id>.mp3) and the FFmpeg export (sfxFilePath) work
 * without any special-casing.
 *
 * Metadata (label, category) is kept client-side in CMS key "sfx.custom".
 */

import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";

export const runtime = "nodejs";

const MAX_BYTES = 3 * 1024 * 1024; // 3MB — SFX should be short
const OK_TYPES = ["audio/mpeg", "audio/mp3", "audio/wav", "audio/x-wav", "audio/ogg"];

export async function POST(req: NextRequest) {
  const fd = await req.formData();
  const file = fd.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "חסר קובץ" }, { status: 400 });
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "קובץ גדול מדי (מקס׳ 3MB)" }, { status: 400 });
  }
  if (!OK_TYPES.includes(file.type) && !/\.(mp3|wav|ogg)$/i.test(file.name)) {
    return NextResponse.json({ error: "פורמט לא נתמך — רק MP3 / WAV / OGG" }, { status: 400 });
  }

  const id = `custom${Date.now()}`;
  const dir = join(process.cwd(), "public", "sfx");
  await mkdir(dir, { recursive: true });
  // Always store as .mp3-named path to match the library convention; browsers
  // and FFmpeg sniff the real container, so a wav/ogg payload still plays.
  const filePath = join(dir, `sfx_${id}.mp3`);
  await writeFile(filePath, Buffer.from(await file.arrayBuffer()));

  return NextResponse.json({
    ok: true,
    id,
    url: `/sfx/sfx_${id}.mp3`,
    originalName: file.name,
  });
}
