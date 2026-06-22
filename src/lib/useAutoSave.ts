"use client";

import { useEffect, useRef, useState } from "react";

const PREFIX = "vm_project_v1.";

/**
 * Persist any JSON-serializable React state to localStorage with a debounce.
 *
 *   const [subs, setSubs] = useAutoSavedState("subtitles", []);
 *
 * On mount: returns the saved value (or default if none). On every
 * change: debounces 600ms then writes. Emits a window "project-saved"
 * event so an indicator elsewhere can flash "נשמר".
 *
 * Caveats: doesn't persist `File` objects, blobs, or anything not
 * structured-cloneable. Video file itself must be re-uploaded on refresh.
 */
export function useAutoSavedState<T>(
  key: string,
  initial: T,
  debounceMs = 600,
): [T, (v: T | ((prev: T) => T)) => void, { wasRestored: boolean }] {
  const fullKey = PREFIX + key;
  const [val, setVal] = useState<T>(initial);
  const [wasRestored, setWasRestored] = useState(false);
  const hydratedRef = useRef(false);
  const timerRef = useRef<number | null>(null);
  // Always-fresh copy of the value so the exit-flush below writes the LATEST
  // edit without re-subscribing the listener on every keystroke.
  const valRef = useRef(val);
  valRef.current = val;

  // Initial hydrate (on mount only)
  useEffect(() => {
    try {
      const raw = localStorage.getItem(fullKey);
      if (raw !== null) {
        const parsed = JSON.parse(raw) as T;
        setVal(parsed);
        setWasRestored(true);
      }
    } catch {
      // corrupted entry — ignore and keep default
    }
    hydratedRef.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fullKey]);

  // Debounced write on every change (after hydration)
  useEffect(() => {
    if (!hydratedRef.current) return;
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => {
      try {
        localStorage.setItem(fullKey, JSON.stringify(val));
        window.dispatchEvent(new CustomEvent("project-saved", { detail: { key, at: Date.now() } }));
      } catch {
        // Quota exceeded or non-serializable — best-effort, no crash.
      }
    }, debounceMs);
    return () => { if (timerRef.current !== null) window.clearTimeout(timerRef.current); };
  }, [val, fullKey, debounceMs, key]);

  // Flush-on-exit: if the user navigates away / closes the tab / backgrounds
  // the app WITHIN the 600ms debounce window, the pending edit would be lost.
  // Write the latest value synchronously on pagehide + when the tab is hidden
  // so the very last edit is always persisted before unload.
  useEffect(() => {
    const flush = () => {
      if (!hydratedRef.current) return;
      try { localStorage.setItem(fullKey, JSON.stringify(valRef.current)); } catch { /* ignore */ }
    };
    const onVisibility = () => { if (document.visibilityState === "hidden") flush(); };
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("pagehide", flush);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [fullKey]);

  return [val, setVal, { wasRestored }];
}

/** Clear ALL saved project state (used by "start fresh") */
export function clearAutoSavedProject() {
  if (typeof window === "undefined") return;
  for (const k of Object.keys(localStorage)) {
    if (k.startsWith(PREFIX)) localStorage.removeItem(k);
  }
}
