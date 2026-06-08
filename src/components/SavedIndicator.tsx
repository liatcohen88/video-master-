"use client";

import { useEffect, useState } from "react";
import { Cloud, CloudOff } from "lucide-react";

/**
 * Tiny indicator that flashes "נשמר" whenever the project auto-saves.
 * Listens for the global "project-saved" event from useAutoSavedState.
 */
export default function SavedIndicator() {
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
  const [showFlash, setShowFlash] = useState(false);

  useEffect(() => {
    function onSaved() {
      setLastSavedAt(Date.now());
      setShowFlash(true);
      const t = setTimeout(() => setShowFlash(false), 1400);
      return () => clearTimeout(t);
    }
    window.addEventListener("project-saved", onSaved as EventListener);
    return () => window.removeEventListener("project-saved", onSaved as EventListener);
  }, []);

  // Refresh the "X ago" label every 10s
  const [, tick] = useState(0);
  useEffect(() => {
    if (lastSavedAt === null) return;
    const t = setInterval(() => tick((n) => n + 1), 10_000);
    return () => clearInterval(t);
  }, [lastSavedAt]);

  if (lastSavedAt === null) {
    return (
      <span className="text-[10px] text-white/30 flex items-center gap-1">
        <CloudOff className="w-3 h-3" /> טרם נשמר
      </span>
    );
  }

  const sec = Math.floor((Date.now() - lastSavedAt) / 1000);
  const label =
    sec < 5    ? "נשמר" :
    sec < 60   ? `נשמר לפני ${sec} שניות` :
    sec < 3600 ? `נשמר לפני ${Math.floor(sec / 60)} דקות` :
                 `נשמר לפני ${Math.floor(sec / 3600)} שעות`;

  return (
    <span className={`text-[10px] flex items-center gap-1 transition-colors ${showFlash ? "text-emerald-300" : "text-white/40"}`}>
      <Cloud className={`w-3 h-3 ${showFlash ? "animate-pulse" : ""}`} />
      {label}
    </span>
  );
}
