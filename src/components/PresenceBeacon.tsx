"use client";

/**
 * Fires a lightweight heartbeat to /api/presence so the admin can see who's
 * online right now (Shopify-style live visitors). One ping on mount (always —
 * a page load is a real visit, logged to historical analytics regardless of
 * whether the tab is foregrounded), then recurring pings every 20s ONLY while
 * the tab is actually the visible/foreground one (Page Visibility API).
 *
 * Why: a tab opened and forgotten in the background used to keep refreshing
 * its "last seen" forever, inflating "מבקרים עכשיו" with visitors who aren't
 * really there (Liat found the live count showing people while Microsoft
 * Clarity's real-activity view showed none). Gating the heartbeat on
 * visibility means a backgrounded tab simply stops pinging and ages out of
 * the live window (45s, see presenceStore.ts) within ~45s of being
 * un-focused — while the one-time historical visit log is unaffected.
 *
 * Per-tab session id lives in sessionStorage. Admin pages are excluded so
 * Liat watching the dashboard doesn't inflate her own visitor count.
 */

import { useEffect } from "react";
import { usePathname } from "next/navigation";

function sessionId(): string {
  try {
    let s = sessionStorage.getItem("vm_sid");
    if (!s) {
      s = Math.random().toString(36).slice(2) + Date.now().toString(36);
      sessionStorage.setItem("vm_sid", s);
    }
    return s;
  } catch {
    return "anon";
  }
}

/** Referring host this tab arrived from ('direct' if none / same-site). */
function referrerHost(): string {
  try {
    const r = document.referrer;
    if (!r) return "direct";
    const h = new URL(r).hostname;
    if (h === location.hostname) return "direct"; // internal navigation
    return h.replace(/^www\./, "");
  } catch { return "direct"; }
}

export default function PresenceBeacon() {
  const pathname = usePathname();

  useEffect(() => {
    if (!pathname || pathname.startsWith("/admin")) return;
    const ref = referrerHost();
    const ping = () => {
      fetch("/api/presence", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sessionId: sessionId(), path: pathname, ref }),
        keepalive: true,
      }).catch(() => {});
    };
    ping(); // initial — always counts the page load as a real visit
    // Recurring heartbeat only while this tab is genuinely the visible one —
    // an open-but-backgrounded tab shouldn't keep counting as "live".
    const id = window.setInterval(() => {
      if (document.visibilityState === "visible") ping();
    }, 20_000);
    // Coming back to this tab refreshes presence immediately instead of
    // waiting up to 20s for the next tick.
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") ping();
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [pathname]);

  return null;
}
