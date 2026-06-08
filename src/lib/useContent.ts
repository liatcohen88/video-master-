"use client";

import { useEffect, useState } from "react";
import {
  getContent, CONTENT_DEFAULTS, type ContentKey,
} from "./contentStore";

/**
 * React hook for editable content. Returns the current value (or the
 * shipped default during SSR) and re-renders whenever any admin edit
 * fires the `content-change` event.
 */
export function useContent<K extends ContentKey>(key: K): (typeof CONTENT_DEFAULTS)[K] {
  const [v, setV] = useState<(typeof CONTENT_DEFAULTS)[K]>(CONTENT_DEFAULTS[key]);
  useEffect(() => {
    setV(getContent(key));
    const handler = () => setV(getContent(key));
    window.addEventListener("content-change", handler);
    return () => window.removeEventListener("content-change", handler);
  }, [key]);
  return v;
}
