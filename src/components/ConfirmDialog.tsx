"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, X } from "lucide-react";

/**
 * Programmatic confirm dialog. Returns a Promise<boolean>.
 *
 *   import { confirm } from "@/components/ConfirmDialog";
 *   const ok = await confirm({
 *     title: "למחוק את הסרטון?",
 *     body: "הפעולה לא ניתנת לביטול",
 *     confirmLabel: "מחקי",
 *     destructive: true,
 *   });
 *
 * Mount <ConfirmDialogRoot /> once at app root (layout).
 */

type ConfirmOptions = {
  title: string;
  body?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
};

type PendingConfirm = ConfirmOptions & {
  resolve: (ok: boolean) => void;
};

let pendingSetter: ((p: PendingConfirm | null) => void) | null = null;

export function confirm(opts: ConfirmOptions): Promise<boolean> {
  return new Promise((resolve) => {
    if (!pendingSetter) {
      // No mounted root — fall back to native confirm
      resolve(window.confirm(opts.title + (opts.body ? "\n\n" + opts.body : "")));
      return;
    }
    pendingSetter({ ...opts, resolve });
  });
}

export default function ConfirmDialogRoot() {
  const [pending, setPending] = useState<PendingConfirm | null>(null);

  useEffect(() => {
    pendingSetter = setPending;
    return () => { pendingSetter = null; };
  }, []);

  // ESC to cancel, Enter to confirm
  useEffect(() => {
    if (!pending) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") { pending!.resolve(false); setPending(null); }
      else if (e.key === "Enter") { pending!.resolve(true); setPending(null); }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pending]);

  if (!pending) return null;

  function done(ok: boolean) {
    pending!.resolve(ok);
    setPending(null);
  }

  return (
    <div dir="rtl" className="fixed inset-0 z-[180] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="relative max-w-sm w-[88vw] bg-bg-card border border-white/15 rounded-2xl p-6 shadow-2xl shadow-black/60 animate-pop">
        <button onClick={() => done(false)} className="absolute top-3 left-3 text-white/40 hover:text-white">
          <X className="w-4 h-4" />
        </button>

        <div className={`inline-flex p-2.5 rounded-xl mb-3 ${pending.destructive ? "bg-red-500/15 text-red-300" : "bg-brand/15 text-brand-light"}`}>
          <AlertTriangle className="w-5 h-5" />
        </div>
        <h3 className="text-lg font-bold mb-1.5">{pending.title}</h3>
        {pending.body && <p className="text-sm text-white/60 mb-5 leading-relaxed">{pending.body}</p>}

        <div className="flex gap-2 justify-end">
          <button onClick={() => done(false)}
            className="px-4 py-2 rounded-lg text-sm bg-white/10 hover:bg-white/15 text-white">
            {pending.cancelLabel ?? "ביטול"}
          </button>
          <button onClick={() => done(true)}
            className={`px-4 py-2 rounded-lg text-sm font-bold text-white
              ${pending.destructive ? "bg-red-500 hover:bg-red-600" : "bg-brand hover:bg-brand/80"}`}>
            {pending.confirmLabel ?? "אישור"}
          </button>
        </div>

        <style jsx>{`
          @keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
          @keyframes pop     { from { opacity: 0; transform: scale(0.92); } to { opacity: 1; transform: scale(1); } }
          .animate-fade-in { animation: fade-in 180ms ease-out; }
          .animate-pop     { animation: pop 220ms cubic-bezier(0.16, 1, 0.3, 1); }
        `}</style>
      </div>
    </div>
  );
}
