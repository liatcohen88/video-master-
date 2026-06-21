/**
 * Admin SFX upload → Supabase Storage (persistent + CDN).
 *
 * Was writing to public/sfx/ on the container FS, which is ephemeral on
 * Coolify (wiped each redeploy) → uploaded sounds read as "not active".
 * Now stored in the public "uploads" bucket under sfx/, returning a stable
 * public URL that works in BOTH the live preview and the Remotion export
 * (remotionAsset passes absolute http(s) URLs straight through).
 *
 * Metadata (label, category) is kept client-side in CMS key "sfx.custom".
 */

import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { requireUser } from "@/lib/apiAuth";
import { storageAdmin, ensureUploadsBucket, uploadsPublicUrl, UPLOADS_BUCKET } from "@/lib/storage";

export const runtime = "nodejs";

const MAX_BYTES = 3 * 1024 * 1024; // 3MB — SFX should be short
const OK_TYPES = ["audio/mpeg", "audio/mp3", "audio/wav", "audio/x-wav", "audio/ogg"];

export async function POST(req: NextRequest) {
  // ADMIN ONLY — was anonymous, which let any visitor pollute the shared SFX
  // library or fill storage with junk.
  const user = await requireUser(req, { requireAdmin: true });
  if (user instanceof NextResponse) return user;

  const admin = storageAdmin();
  if (!admin) return NextResponse.json({ error: "Storage not configured" }, { status: 500 });

  const fd = await req.formData();
  const file = fd.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "חסר קובץ" }, { status: 400 });
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "קובץ גדול מדי (מקס׳ 3MB)" }, { status: 400 });
  }
  if (!OK_TYPES.includes(file.type) && !/\.(mp3|wav|ogg)$/i.test(file.name)) {
    return NextResponse.json({ error: "פורמט לא נתמך — רק MP3 / WAV / OGG" }, { status: 400 });
  }

  await ensureUploadsBucket(admin);

  // Random component prevents same-millisecond collisions between admins.
  const id = `custom${Date.now()}_${randomBytes(3).toString("hex")}`;
  const path = `sfx/sfx_${id}.mp3`;
  const { error } = await admin.storage
    .from(UPLOADS_BUCKET)
    .upload(path, Buffer.from(await file.arrayBuffer()), {
      contentType: file.type || "audio/mpeg",
      upsert: false,
    });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    ok: true,
    id,
    url: uploadsPublicUrl(admin, path),
    originalName: file.name,
  });
}
