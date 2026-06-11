"use client";

import { useEffect, useState } from "react";
import { Bookmark, BookmarkCheck } from "lucide-react";
import { saveSnapshot, type ProjectSnapshot } from "@/lib/projectStorage";
import { toast } from "@/components/Toaster";

type Props = {
  /** Pull a fresh snapshot payload at click time (callback so we always grab latest state) */
  buildSnapshot: () => Omit<ProjectSnapshot, "id" | "at" | "label">;
  /** ms — autosave snapshot interval. Default 5 min. Pass 0 to disable autosave. */
  autoSaveMs?: number;
};

/**
 * "💾 שמור גרסה" — manual checkpoint. Also runs an interval timer that
 * snapshots automatically every `autoSaveMs`, keeping the latest 10
 * (trim happens inside saveSnapshot). Toast notifies the user.
 */
export default function SaveSnapshotButton({ buildSnapshot, autoSaveMs = 5 * 60 * 1000 }: Props) {
  const [justSaved, setJustSaved] = useState(false);

  async function snapshot(label: string, silent = false) {
    try {
      const payload = buildSnapshot();
      await saveSnapshot({ ...payload, at: Date.now(), label });
      if (!silent) {
        setJustSaved(true);
        toast.success(`גרסה נשמרה: ${label}`);
        setTimeout(() => setJustSaved(false), 1500);
      }
    } catch {
      if (!silent) toast.error("שמירה נכשלה");
    }
  }

  // Auto-snapshot every N minutes
  useEffect(() => {
    if (!autoSaveMs) return;
    const id = window.setInterval(() => {
      const stamp = new Date().toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" });
      snapshot(`אוטומטי ${stamp}`, /* silent */ true);
    }, autoSaveMs);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoSaveMs]);

  return (
    <button
      onClick={() => {
        const stamp = new Date().toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" });
        snapshot(`ידני ${stamp}`);
      }}
      title="שמור צילום מצב של הפרויקט — תוכלי לחזור אליו אחר כך"
      className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-brand/30 text-white text-xs font-medium flex items-center gap-1.5 transition border border-white/15">
      {justSaved ? <BookmarkCheck className="w-3.5 h-3.5 text-emerald-400" /> : <Bookmark className="w-3.5 h-3.5" />}
      {justSaved ? "נשמר!" : "שמור גרסה"}
    </button>
  );
}
