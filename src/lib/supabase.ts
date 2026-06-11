/**
 * Supabase clients — the server-side store of truth for users + credits
 * (מאסטרים). Replaces the localStorage-only credit balance so a payment
 * webhook can actually credit an account.
 *
 * Two clients, two trust levels:
 *   - browserClient(): uses the public ANON key. Safe to ship to the browser.
 *     Used for auth (email magic link) and reading the logged-in user's own
 *     profile (Row Level Security limits each user to their own row).
 *   - adminClient(): uses the SERVICE ROLE key. SERVER ONLY — never import
 *     into a client component. Bypasses RLS so the Grow webhook can credit
 *     any user. Guard every use behind server runtime.
 *
 * Everything degrades gracefully: if env vars are missing, the factory
 * functions return null and the app keeps running on localStorage exactly
 * as before. Nothing breaks until you actually wire Supabase.
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;

export function isSupabaseConfigured(): boolean {
  return Boolean(URL && ANON);
}

let _browser: SupabaseClient | null = null;

/** Browser/anon client — auth + reading own profile. null if unconfigured. */
export function browserClient(): SupabaseClient | null {
  if (!URL || !ANON) return null;
  if (_browser) return _browser;
  _browser = createClient(URL, ANON, {
    auth: { persistSession: true, autoRefreshToken: true },
  });
  return _browser;
}

/**
 * Service-role client — SERVER ONLY. Used by the payment webhook to credit
 * a user's balance. Throws if called where the service key isn't present.
 */
export function adminClient(): SupabaseClient | null {
  if (!URL || !SERVICE) return null;
  return createClient(URL, SERVICE, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export type Profile = {
  id: string;
  email: string;
  display_name: string | null;
  credits: number;
  created_at: string;
};
