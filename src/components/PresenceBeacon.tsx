"use client";

/**
 * Fires a lightweight heartbeat to /api/presence so the admin can see who's
 * online right now (Shopify-style live visitors). One ping on mount, one on
 * every route change, then every 20s while the tab is open. Per-tab session id
 * lives in sessionStorage. Admin pages are excluded so Liat watching the
 * dashboard doesn't inflate her own visitor count.
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

export default function PresenceBeacon() {
  const pathname = usePathname();

  useEffect(() => {
    if (!pathname || pathname.startsWith("/admin")) return;
    const ping = () => {
      fetch("/api/presence", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sessionId: sessionId(), path: pathname }),
        keepalive: true,
      }).catch(() => {});
    };
    ping();
    const id = window.setInterval(ping, 20_000);
    return () => window.clearInterval(id);
  }, [pathname]);

  return null;
}
