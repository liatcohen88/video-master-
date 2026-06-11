"use client";

import { useEffect, useState } from "react";
import { Play, X, History } from "lucide-react";
import { loadCurrentVideo, clearCurrentVideo, storedToFile, listSnapshots, type StoredVideo, type ProjectSnapshot } from "@/lib/projectStorage";

type Props = {
  onResume: (file: File, snapshot?: ProjectSnapshot) => void;
};

/**
 * Banner shown at the top of the upload area when a previously-edited
 * video is still cached in IndexedDB. One click → restore the video AND
 * its latest snapshot, jumping straight back into editing mode.
 *
 * Also exposes a "history" disclosure listing all available snapshots
 * (timestamps + label) so user can roll back to an older state.
 */
export default function ResumeProjectBanner({ onResume }: Props) {
  const [stored, setStored]       = useState<StoredVideo | null>(null);
  const [snapshots, setSnapshots] = useState<ProjectSnapshot[]>([]);
  const [open, setOpen]           = useState(false);
  const [historyOpen, setHistOpen] = useState(false);

  useEffect(() => {
    (async () => {
      const v = await loadCurrentVideo();
      if (v) {
        setStored(v);
        setOpen(true);
        const snaps = await listSnapshots();
        // Only snapshots that belong to THIS video
        setSnapshots(snaps.filter((s) => s.videoHash === v.hash));
      }
    })();
  }, []);

  if (!open || !stored) return null;

  const ageSec = Math.round((Date.now() - stored.storedAt) / 1000);
  const ageLabel =
    ageSec < 60        ? "לפני פחות מדקה" :
    ageSec < 3600      ? `לפני ${Math.round(ageSec / 60)} דקות` :
    ageSec < 86400     ? `לפני ${Math.round(ageSec / 3600)} שעות` :
                         `לפני ${Math.round(ageSec / 86400)} ימים`;

  function fmtTime(at: number) {
    const d = new Date(at);
    return d.toLocaleString("he-IL", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit" });
  }

  function resume(snap?: ProjectSnapshot) {
    if (!stored) return;
    onResume(storedToFile(stored), snap);
    setOpen(false);
  }

  async function discard() {
    await clearCurrentVideo();
    setOpen(false);
  }

  const sizeMB = (stored.size / (1024 * 1024)).toFixed(1);

  return (
    <div dir="rtl" className="mb-6 rounded-2xl border-2 border-brand/50 bg-gradient-to-br from-brand/15 to-pink-500/10 p-5 shadow-lg shadow-brand/10 animate-card-up">
      <div className="flex items-start gap-4">
        <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-gradient-to-br from-brand to-pink-500 flex items-center justify-center shadow">
          <Play className="w-6 h-6 text-white" />
        </div>

        <div className="flex-1 min-w-0">
          <h3 className="text-lg font-black text-white mb-1">המשך עריכה מאיפה שהפסקת</h3>
          <p className="text-sm text-white/70 mb-1">
            יש לנו את הסרטון שלך שמור (<span className="font-bold">{stored.name}</span> • {sizeMB} MB)
          </p>
          <p className="text-xs text-white/50">נשמר {ageLabel}</p>

          <div className="flex flex-wrap items-center gap-2 mt-4">
            <button
              onClick={() => resume(snapshots[0])}
              className="px-5 py-2.5 bg-gradient-to-r from-brand to-pink-500 hover:opacity-90 text-white font-bold rounded-xl text-sm shadow-md shadow-brand/30 transition">
              ▶ המשך עריכה
            </button>

            {snapshots.length > 0 && (
              <button
                onClick={() => setHistOpen(!historyOpen)}
                className="px-4 py-2.5 bg-white/10 hover:bg-white/15 text-white text-sm rounded-xl border border-white/15 flex items-center gap-1.5 transition">
                <History className="w-4 h-4" />
                גרסאות קודמות ({snapshots.length})
              </button>
            )}

            <button
              onClick={discard}
              className="mr-auto px-3 py-2 text-white/40 hover:text-white/80 text-xs flex items-center gap-1 transition">
              <X className="w-3.5 h-3.5" /> מחק שמור
            </button>
          </div>

          {historyOpen && snapshots.length > 0 && (
            <div className="mt-4 max-h-64 overflow-y-auto rounded-xl border border-white/10 bg-black/30 divide-y divide-white/5">
              {snapshots.map((s) => (
                <button
                  key={s.id}
                  onClick={() => resume(s)}
                  className="w-full px-4 py-3 text-right hover:bg-brand/15 flex items-center justify-between gap-3 transition">
                  <div className="min-w-0">
                    <div className="text-sm font-bold text-white">{s.label}</div>
                    <div className="text-xs text-white/50">
                      {fmtTime(s.at)} • {s.payload.subtitles.length} כתוביות
                    </div>
                  </div>
                  <span className="text-xs text-brand font-bold flex-shrink-0">שחזר ←</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <style jsx>{`
        @keyframes card-up { from { transform: translateY(-10px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        .animate-card-up { animation: card-up 320ms cubic-bezier(0.16, 1, 0.3, 1); }
      `}</style>
    </div>
  );
}
