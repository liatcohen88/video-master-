"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, XCircle, Info, Loader2, X } from "lucide-react";

/**
 * Tiny global toast system. Fire from anywhere with:
 *   import { toast } from "@/components/Toaster";
 *   toast.success("נשמר בהצלחה");
 *   toast.error("הייצוא נכשל");
 *   toast.info("טיפ: שמור באמצע");
 *   const id = toast.loading("מייצא...");
 *   toast.dismiss(id);
 *   toast.success("הייצוא הסתיים", { id }); // reuse same toast id
 *
 * Mount <Toaster /> once at the app root (layout).
 */

export type ToastKind = "success" | "error" | "info" | "loading";

type Toast = {
  id: number;
  kind: ToastKind;
  text: string;
  /** Auto-dismiss in ms. null = stays until manually dismissed (loading default) */
  ttl: number | null;
};

let nextId = 1;
const listeners = new Set<(toasts: Toast[]) => void>();
let pool: Toast[] = [];

function emit() {
  for (const fn of listeners) fn([...pool]);
}
function add(t: Omit<Toast, "id">, requestedId?: number): number {
  const id = requestedId ?? nextId++;
  const existing = pool.findIndex((x) => x.id === id);
  if (existing >= 0) pool[existing] = { ...t, id };
  else pool = [...pool, { ...t, id }];
  emit();
  if (t.ttl !== null) {
    setTimeout(() => dismiss(id), t.ttl);
  }
  return id;
}
function dismiss(id: number) {
  pool = pool.filter((x) => x.id !== id);
  emit();
}

export const toast = {
  success: (text: string, opts?: { id?: number; ttl?: number }) =>
    add({ kind: "success", text, ttl: opts?.ttl ?? 3500 }, opts?.id),
  error:   (text: string, opts?: { id?: number; ttl?: number }) =>
    add({ kind: "error", text, ttl: opts?.ttl ?? 5500 }, opts?.id),
  info:    (text: string, opts?: { id?: number; ttl?: number }) =>
    add({ kind: "info", text, ttl: opts?.ttl ?? 3500 }, opts?.id),
  loading: (text: string, opts?: { id?: number }) =>
    add({ kind: "loading", text, ttl: null }, opts?.id),
  dismiss,
};

const KIND_STYLE: Record<ToastKind, { bg: string; border: string; text: string; Icon: React.ComponentType<{ className?: string }> }> = {
  success: { bg: "bg-emerald-500/15", border: "border-emerald-500/30",     text: "text-emerald-100", Icon: CheckCircle2 },
  error:   { bg: "bg-red-500/15",     border: "border-red-500/30",         text: "text-red-100",     Icon: XCircle },
  info:    { bg: "bg-cyan-500/15",    border: "border-cyan-500/30",        text: "text-cyan-100",    Icon: Info },
  loading: { bg: "bg-violet-500/15",  border: "border-violet-500/30",      text: "text-violet-100",  Icon: Loader2 },
};

export default function Toaster() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  useEffect(() => {
    listeners.add(setToasts);
    return () => { listeners.delete(setToasts); };
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div
      dir="rtl"
      className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[200] flex flex-col gap-2 items-center pointer-events-none"
      role="status"
      aria-live="polite"
    >
      {toasts.map((t) => {
        const s = KIND_STYLE[t.kind];
        const Icon = s.Icon;
        return (
          <div key={t.id}
               className={`pointer-events-auto flex items-center gap-2.5 ${s.bg} ${s.border} ${s.text} border backdrop-blur-md rounded-xl px-4 py-2.5 text-sm font-medium shadow-2xl shadow-black/50 max-w-md animate-toast-in`}>
            <Icon className={`w-4 h-4 shrink-0 ${t.kind === "loading" ? "animate-spin" : ""}`} />
            <span className="leading-tight">{t.text}</span>
            <button onClick={() => dismiss(t.id)}
                    className="opacity-50 hover:opacity-100 mr-1 -ml-1"
                    aria-label="סגור">
              <X className="w-3 h-3" />
            </button>
          </div>
        );
      })}
      <style jsx>{`
        @keyframes toast-in {
          from { transform: translateY(20px); opacity: 0; }
          to   { transform: translateY(0);    opacity: 1; }
        }
        .animate-toast-in { animation: toast-in 220ms ease-out; }
      `}</style>
    </div>
  );
}
