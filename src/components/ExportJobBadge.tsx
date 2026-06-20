"use client";

/**
 * Global background-export badge. Mounted once in the root layout so it shows
 * on EVERY page — the render runs server-side, and the user can navigate away
 * (to the dashboard, credits, etc.) without "losing" the export (Liat: "כשאני
 * עובר עמודים הייצוא ברקע נעלם, חשבתי שנמחק").
 *
 * It owns the whole client side of a background render: it picks up the job
 * (from a `vm-export-started` window event fired by the export button, or from
 * localStorage on reload), polls /api/render-status for progress, and delivers
 * the MP4 (share-sheet → gallery on mobile / download on desktop) when done.
 * Clicking the badge expands details (which file, % done).
 */

import { useEffect, useRef, useState, useCallback } from "react";
import { toast } from "@/components/Toaster";

const LS_KEY = "vm_export_job";

type JobState = {
  id: string;
  filename: string;
  status: "rendering" | "done";
  progress: number;
};

async function authHeader(): Promise<Record<string, string>> {
  try {
    const { browserClient } = await import("@/lib/supabase");
    const token = (await browserClient()?.auth.getSession())?.data.session?.access_token;
    return token ? { authorization: `Bearer ${token}` } : {};
  } catch { return {}; }
}

function canShareVideoFiles(): boolean {
  try {
    const n = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
    if (typeof n.share !== "function" || typeof n.canShare !== "function") return false;
    return n.canShare({ files: [new File([new Uint8Array([0])], "p.mp4", { type: "video/mp4" })] });
  } catch { return false; }
}

// Real mobile-device check — NOT "does the browser support sharing files".
// Desktop Chrome/Edge on Windows 11 ALSO implement navigator.share({files})
// (it pops the Windows share panel), so canShareVideoFiles() alone wrongly
// treated Liat's desktop as a phone → showed "שמור לגלריה" instead of just
// downloading ("עדיין במחשב!!!"). On desktop we always download to the computer.
function isMobileDevice(): boolean {
  try {
    const uaData = (navigator as Navigator & { userAgentData?: { mobile?: boolean } }).userAgentData;
    if (uaData && typeof uaData.mobile === "boolean") return uaData.mobile; // Chromium: authoritative
    const ua = navigator.userAgent || "";
    if (/Android|iPhone|iPod/i.test(ua)) return true;
    if (/iPad/i.test(ua)) return true;
    // iPadOS 13+ reports as "Macintosh" — distinguish by touch support.
    if (/Macintosh/i.test(ua) && navigator.maxTouchPoints > 1) return true;
    return false;
  } catch { return false; }
}

// Use the gallery share-sheet ONLY on a real mobile device that supports it.
// (Not named use* — it's a plain helper, not a React hook.)
function gallerySaveMode(): boolean {
  return isMobileDevice() && canShareVideoFiles();
}

export default function ExportJobBadge() {
  const [job, setJob] = useState<JobState | null>(null);
  const [expanded, setExpanded] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const dismissRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const blobRef = useRef<Blob | null>(null);

  const clearJob = useCallback(() => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    if (dismissRef.current) { clearTimeout(dismissRef.current); dismissRef.current = null; }
    blobRef.current = null;
    setJob(null);
    setExpanded(false);
    try { localStorage.removeItem(LS_KEY); } catch { /* ignore */ }
  }, []);

  // Hand the bytes to the OS. On mobile the share-sheet → "Save Video" lands in
  // the gallery; on desktop it downloads. MUST stay synchronous (no await
  // before share) so iOS keeps the tap's user-activation.
  const deliver = useCallback(async (blob: Blob, filename: string): Promise<boolean> => {
    const file = new File([blob], filename, { type: "video/mp4" });
    const n = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
    // Mobile only: hand to the OS share-sheet → "Save Video" lands in the gallery.
    // On desktop we deliberately skip share() (even though Windows Chrome supports
    // it) and download straight to the computer.
    if (isMobileDevice() && typeof n.share === "function" && typeof n.canShare === "function" && n.canShare({ files: [file] })) {
      try { await n.share({ files: [file], title: filename }); return true; }
      catch (e) { if (!(e instanceof Error) || e.name !== "AbortError") console.warn("[export] share failed", e); }
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
    return false;
  }, []);

  const fetchBlob = useCallback(async (id: string): Promise<boolean> => {
    try {
      const res = await fetch(`/api/render-result/${id}`, { headers: await authHeader() });
      if (!res.ok) return false;
      blobRef.current = await res.blob();
      return true;
    } catch { return false; }
  }, []);

  // The badge's tap (a real user gesture) → save to gallery / download.
  const saveNow = useCallback(async (id: string, filename: string) => {
    if (!blobRef.current) await fetchBlob(id);
    if (!blobRef.current) { toast.error("ההורדה נכשלה — אפשר לנסות שוב"); return; }
    const shared = await deliver(blobRef.current, filename);
    toast.success(shared ? "✓ יש לבחור 'שמור וידאו' בחלון — והסרטון בגלריה 📸" : "✓ הסרטון ירד לתיקיית ההורדות");
    if (!shared) clearJob(); // desktop: downloaded → dismiss the badge
  }, [deliver, fetchBlob, clearJob]);

  const startPolling = useCallback((id: string, filename: string) => {
    if (pollRef.current) clearInterval(pollRef.current);
    setJob({ id, filename, status: "rendering", progress: 0 });
    const tick = async () => {
      try {
        const res = await fetch(`/api/render-status/${id}`, { headers: await authHeader() });
        if (res.status === 404) { clearJob(); toast.error("הייצוא לא נמצא — אפשר לנסות שוב"); return; }
        if (!res.ok) return; // transient — keep polling
        const data = await res.json() as { status?: string; progress?: number };
        if (data.status === "done") {
          if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
          try { localStorage.removeItem(LS_KEY); } catch { /* ignore */ }
          await fetchBlob(id);
          setJob({ id, filename, status: "done", progress: 100 });
          if (gallerySaveMode()) {
            // Mobile: wait for the user to tap "save to gallery" (share needs a gesture).
            toast.success("🎉 הסרטון מוכן! יש ללחוץ 'שמור לגלריה'");
          } else if (blobRef.current) {
            await deliver(blobRef.current, filename); // desktop → download straight to the computer
            toast.success("✓ הסרטון מוכן וירד למחשב 💻");
            // Keep the badge briefly as a fallback (button "⬇️ הורד שוב") in case the
            // browser blocked the auto-download, then auto-dismiss. Never "save to gallery".
            if (dismissRef.current) clearTimeout(dismissRef.current);
            dismissRef.current = setTimeout(() => clearJob(), 12000);
          }
        } else if (data.status === "failed") {
          clearJob();
          toast.error("הייצוא נכשל — המאסטרים שלך הוחזרו. אפשר לנסות שוב 🙏");
        } else {
          setJob({ id, filename, status: "rendering", progress: typeof data.progress === "number" ? data.progress : 0 });
        }
      } catch { /* network hiccup — keep polling */ }
    };
    pollRef.current = setInterval(tick, 4000);
    void tick();
  }, [clearJob, deliver, fetchBlob]);

  useEffect(() => {
    // Resume an in-flight job after a reload / on any page.
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) {
        const j = JSON.parse(raw) as { id?: string; filename?: string };
        if (j?.id && j?.filename) startPolling(j.id, j.filename);
      }
    } catch { /* ignore */ }
    // The export button fires this after it gets a jobId.
    const onStart = (e: Event) => {
      const d = (e as CustomEvent).detail as { jobId?: string; filename?: string } | undefined;
      if (d?.jobId && d?.filename) {
        try { localStorage.setItem(LS_KEY, JSON.stringify({ id: d.jobId, filename: d.filename })); } catch { /* ignore */ }
        startPolling(d.jobId, d.filename);
      }
    };
    window.addEventListener("vm-export-started", onStart);
    return () => {
      window.removeEventListener("vm-export-started", onStart);
      if (pollRef.current) clearInterval(pollRef.current);
      if (dismissRef.current) clearTimeout(dismissRef.current);
    };
  }, [startPolling]);

  if (!job) return null;

  const pct = Math.max(0, Math.min(100, Math.round(job.progress)));

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[70] max-w-[94vw]" dir="rtl">
      {job.status === "rendering" ? (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="flex items-center gap-3 rounded-2xl bg-bg-card/95 backdrop-blur border border-brand/40 shadow-2xl px-4 py-3 text-right"
        >
          <span className="relative inline-flex w-8 h-8 items-center justify-center shrink-0">
            <span className="absolute inset-0 rounded-full border-2 border-brand border-t-transparent animate-spin" />
            <span className="text-[9px] font-bold text-white tabular-nums">{pct}%</span>
          </span>
          <span className="text-sm">
            <span className="block font-bold text-white">מייצא את הסרטון ברקע…</span>
            <span className="block text-[11px] text-white/50">
              {expanded ? job.filename : "אפשר להמשיך לעבוד — נודיע כשמוכן 🎬"}
            </span>
            {expanded && (
              <span className="mt-1.5 block h-1.5 w-44 max-w-full rounded-full bg-white/15 overflow-hidden">
                <span className="block h-full rounded-full bg-brand transition-[width] duration-500" style={{ width: `${pct}%` }} />
              </span>
            )}
          </span>
        </button>
      ) : (
        <div className="flex items-center gap-3 rounded-2xl bg-emerald-600/95 backdrop-blur border border-emerald-300/40 shadow-2xl px-4 py-3">
          <div className="text-sm">
            <div className="font-bold text-white">✓ הסרטון מוכן!</div>
            <div className="text-[11px] text-white/80 max-w-[40vw] truncate">{job.filename}</div>
          </div>
          <button
            onClick={() => saveNow(job.id, job.filename)}
            className="px-3 py-1.5 rounded-lg bg-white text-emerald-700 text-sm font-bold hover:bg-white/90 whitespace-nowrap"
          >
            {gallerySaveMode() ? "📥 שמור לגלריה" : "⬇️ הורד שוב"}
          </button>
          <button onClick={clearJob} className="p-1 text-white/70 hover:text-white" title="סגור" aria-label="סגור">✕</button>
        </div>
      )}
    </div>
  );
}
