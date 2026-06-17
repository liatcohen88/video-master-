"use client";

import { createContext, useEffect, useState, type ReactNode } from "react";
import type { Content } from "./contentStore";

/**
 * Holds the SSR-injected overrides snapshot. useContent() consumes this
 * so the first React render (both on the server and during client
 * hydration) returns Liat's actual edited copy — not the shipped default.
 * Without this, every visitor saw a ~1.5s flash of default strings before
 * hydrateFromCloud() fetched the overrides.
 *
 * The provider also keeps the snapshot in sync with later admin edits via
 * the `content-change` event so live updates still flow through.
 */
export const ContentContext = createContext<Content>({});

export default function ContentProvider({
  initial,
  children,
}: {
  initial: Content;
  children: ReactNode;
}) {
  const [overrides, setOverrides] = useState<Content>(initial);

  useEffect(() => {
    // Pick up admin edits + cloud hydrate refreshes.
    function refresh() {
      try {
        const raw = localStorage.getItem("vm_content_v1");
        if (raw) setOverrides(JSON.parse(raw));
      } catch { /* ignore */ }
    }
    window.addEventListener("content-change", refresh);
    refresh();
    return () => window.removeEventListener("content-change", refresh);
  }, []);

  return <ContentContext.Provider value={overrides}>{children}</ContentContext.Provider>;
}
