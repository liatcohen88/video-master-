import { createClient } from "@supabase/supabase-js";

/**
 * Server-side fetch of CMS overrides — used by the root layout so the very
 * first HTML byte already contains Liat's edited copy. Eliminates the ~1.5s
 * "flash of defaults" where users saw old/built-in text before the client
 * hydrateFromCloud() call replaced it.
 *
 * Returns {} if Supabase isn't configured or if the read errors — caller
 * should treat that as "use defaults".
 */
export async function loadOverridesServer(): Promise<Record<string, unknown>> {
  const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!URL || !ANON) return {};
  try {
    const sb = createClient(URL, ANON, { auth: { persistSession: false } });
    const { data, error } = await sb.from("content_overrides").select("key,value");
    if (error || !data) return {};
    const out: Record<string, unknown> = {};
    for (const row of data) out[row.key] = row.value;
    return out;
  } catch {
    return {};
  }
}
