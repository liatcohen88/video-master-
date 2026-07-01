import { createClient } from "@supabase/supabase-js";
import { unstable_cache } from "next/cache";

/**
 * Server-side fetch of CMS overrides — used by the root layout so the very
 * first HTML byte already contains Liat's edited copy. Eliminates the ~1.5s
 * "flash of defaults" where users saw old/built-in text before the client
 * hydrateFromCloud() call replaced it.
 *
 * Wrapped in unstable_cache (tag "content-overrides", 60s TTL) — this was a
 * live Supabase query on EVERY request in the root layout (so on every page),
 * which forced the whole app to render dynamically per-request and became a
 * real bottleneck under concurrent load (verified: 60-80 simultaneous
 * homepage loads → 15-25s response times, CPU pegged at ~300%). Caching it
 * lets Next.js serve the page from its static/ISR cache instead of
 * re-querying Supabase and re-rendering on every single hit. The CMS save
 * endpoint calls revalidateTag("content-overrides") so edits still show up
 * immediately instead of waiting out the 60s window.
 *
 * Returns {} if Supabase isn't configured or if the read errors — caller
 * should treat that as "use defaults".
 */
async function fetchOverrides(): Promise<Record<string, unknown>> {
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

export const loadOverridesServer = unstable_cache(fetchOverrides, ["content-overrides"], {
  tags: ["content-overrides"],
  revalidate: 60,
});
