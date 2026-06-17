"use client";

import { useContext, useEffect, useState } from "react";
import {
  getContent, hydrateFromCloud, CONTENT_DEFAULTS, type ContentKey,
} from "./contentStore";
import { ContentContext } from "./ContentProvider";

/**
 * React hook for editable content. The initial value comes from the
 * ContentProvider — which the root layout seeds SSR-side with Liat's
 * latest overrides from Supabase. That kills the ~1.5s "flash of default
 * copy" we used to show on every fresh page load.
 *
 * After mount, we still subscribe to `content-change` so admin edits
 * propagate live in this tab.
 */
export function useContent<K extends ContentKey>(key: K): (typeof CONTENT_DEFAULTS)[K] {
  const ctx = useContext(ContentContext);
  const initial = (ctx?.[key] as (typeof CONTENT_DEFAULTS)[K] | undefined) ?? CONTENT_DEFAULTS[key];
  const [v, setV] = useState<(typeof CONTENT_DEFAULTS)[K]>(initial);
  useEffect(() => {
    // Catch any value that arrived between SSR and mount (admin window
    // already had localStorage; new visitor's SSR snapshot was canonical).
    setV(getContent(key));
    void hydrateFromCloud(); // idempotent — refreshes against live server
    const handler = () => setV(getContent(key));
    window.addEventListener("content-change", handler);
    return () => window.removeEventListener("content-change", handler);
  }, [key]);
  return v;
}
