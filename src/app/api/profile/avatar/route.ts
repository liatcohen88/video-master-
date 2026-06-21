/**
 * Profile-picture upload → Supabase Storage.
 *
 * Any authenticated user uploads an image; it's stored at
 * uploads/avatars/<userId>.<ext> (upsert — one avatar per user) and the
 * public URL is returned. The client then mirrors the URL into the user's
 * auth metadata (avatar_url) so it shows across devices, and into the local
 * userStore for instant display.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/apiAuth";
import { storageAdmin, ensureUploadsBucket, uploadsPublicUrl, UPLOADS_BUCKET } from "@/lib/storage";

export const runtime = "nodejs";

const MAX_BYTES = 2 * 1024 * 1024; // 2MB
const EXT_BY_TYPE: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

export async function POST(req: NextRequest) {
  const user = await requireUser(req);
  if (user instanceof NextResponse) return user;

  const admin = storageAdmin();
  if (!admin) return NextResponse.json({ error: "Storage not configured" }, { status: 500 });

  const fd = await req.formData();
  const file = fd.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "חסר קובץ" }, { status: 400 });
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "תמונה גדולה מדי (מקס׳ 2MB)" }, { status: 400 });
  }
  const ext = EXT_BY_TYPE[file.type];
  if (!ext) return NextResponse.json({ error: "פורמט לא נתמך — JPG / PNG / WEBP" }, { status: 400 });

  await ensureUploadsBucket(admin);

  const path = `avatars/${user.id}.${ext}`;
  const { error } = await admin.storage
    .from(UPLOADS_BUCKET)
    .upload(path, Buffer.from(await file.arrayBuffer()), {
      contentType: file.type,
      upsert: true, // one avatar per user — overwrite the old one
    });
  if (error) {
    console.error("[profile/avatar] storage error:", error.message);
    return NextResponse.json({ error: "העלאת התמונה נכשלה. אפשר לנסות שוב." }, { status: 500 });
  }

  // Cache-bust so the new image shows immediately (same path on re-upload).
  const url = `${uploadsPublicUrl(admin, path)}?v=${Date.now()}`;
  return NextResponse.json({ ok: true, url });
}
