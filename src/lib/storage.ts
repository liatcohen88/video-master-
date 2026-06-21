/**
 * Supabase Storage helpers (server-side, service-role).
 *
 * Why: uploads previously went to the container's public/ dir, which is
 * EPHEMERAL on Coolify — wiped on every redeploy and not reliably served in
 * production (so admin SFX uploads read as "not active"). Supabase Storage is
 * persistent + CDN-served, and the public URL works in BOTH the live preview
 * and the headless Remotion export (remotionAsset passes absolute URLs through).
 *
 * One public bucket "uploads" holds everything under folders:
 *   uploads/sfx/sfx_<id>.mp3      — admin-uploaded sound effects
 *   uploads/avatars/<userId>.<ext> — user profile pictures
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export const UPLOADS_BUCKET = "uploads";

/** Service-role client (server only). Returns null if env isn't configured. */
export function storageAdmin(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !service) return null;
  return createClient(url, service, { auth: { persistSession: false } });
}

let ensured = false;
/** Create the public "uploads" bucket once if it doesn't exist (idempotent). */
export async function ensureUploadsBucket(admin: SupabaseClient): Promise<void> {
  if (ensured) return;
  try {
    const { data } = await admin.storage.getBucket(UPLOADS_BUCKET);
    if (!data) {
      await admin.storage.createBucket(UPLOADS_BUCKET, {
        public: true,
        fileSizeLimit: "10MB",
      });
    }
    ensured = true;
  } catch {
    // Best-effort — if creation races another instance, the upload below
    // will still succeed against the existing bucket.
    ensured = true;
  }
}

/** Public URL for a path inside the uploads bucket. */
export function uploadsPublicUrl(admin: SupabaseClient, path: string): string {
  return admin.storage.from(UPLOADS_BUCKET).getPublicUrl(path).data.publicUrl;
}
