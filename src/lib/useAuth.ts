"use client";

/**
 * useAuth — single source of truth for "who's logged in?" across the app.
 *
 * Backed by Supabase when env vars are set. When they're not (early dev),
 * we fall back to the localStorage profile from userStore so the existing
 * UI keeps working unchanged.
 */

import { useEffect, useState } from "react";
import { browserClient, isSupabaseConfigured, type Profile } from "./supabase";
import { getProfile as getLocalProfile } from "./userStore";

export type AuthState =
  | { status: "loading"; profile: null }
  | { status: "guest"; profile: null }
  | { status: "user"; profile: Profile };

export function useAuth(): AuthState & {
  signOut: () => Promise<void>;
} {
  const [state, setState] = useState<AuthState>({ status: "loading", profile: null });

  useEffect(() => {
    let cancelled = false;

    async function load() {
      // Fallback: no Supabase wired → use the local mock profile so the
      // existing SiteHeader / dashboard keep rendering during dev.
      if (!isSupabaseConfigured()) {
        const p = getLocalProfile();
        if (!cancelled) {
          setState({
            status: "user",
            profile: {
              id: "local",
              email: p.email,
              display_name: p.name,
              credits: 25,
              created_at: p.joinedAt,
            },
          });
        }
        return;
      }

      const sb = browserClient();
      if (!sb) return;

      const { data: { session } } = await sb.auth.getSession();
      if (!session?.user) {
        if (!cancelled) setState({ status: "guest", profile: null });
        return;
      }

      // Fetch the profile row (created by the on-signup trigger).
      const { data: profile } = await sb
        .from("profiles")
        .select("*")
        .eq("id", session.user.id)
        .single();

      if (!cancelled && profile) {
        setState({ status: "user", profile: profile as Profile });
      } else if (!cancelled) {
        // Session exists but profile not yet (trigger lag) — treat as user
        // with bare data so the UI doesn't flash logged-out.
        setState({
          status: "user",
          profile: {
            id: session.user.id,
            email: session.user.email ?? "",
            display_name: session.user.email?.split("@")[0] ?? null,
            credits: 25,
            created_at: new Date().toISOString(),
          },
        });
      }
    }

    load();

    // Subscribe to auth-state changes so login/logout in another tab is
    // reflected here too.
    const sb = browserClient();
    const sub = sb?.auth.onAuthStateChange(() => {
      load();
    });

    return () => {
      cancelled = true;
      sub?.data?.subscription?.unsubscribe();
    };
  }, []);

  async function signOut() {
    const sb = browserClient();
    if (sb) await sb.auth.signOut();
    setState({ status: "guest", profile: null });
    // Hard reload so all components re-render against the new session.
    if (typeof window !== "undefined") window.location.href = "/";
  }

  return { ...state, signOut };
}
