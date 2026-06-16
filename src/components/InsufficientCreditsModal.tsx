"use client";

/**
 * "אין מספיק מאסטרים" pre-export popup. Shown the moment the user clicks
 * export with too few credits — BEFORE the render starts, so they aren'\''t
 * waiting through a loader for a doomed request.
 *
 * Two CTAs: "קנה מאסטרים" (links to /credits) and "חזור לעריכה" (just
 * closes the modal). All copy + the buy-link href live in the CMS so
 * Liat can rephrase or repoint from /admin without a deploy.
 *
 * Liat: "כשאין לי קרטידים ואני מיצאת הוא טוען לי חחח שאפילו לא יטען
 * שישר יראה את הפופאפ".
 */

import Link from "next/link";
import { Coins, ArrowLeft, X } from "lucide-react";
import { useContent } from "@/lib/useContent";

export type InsufficientInfo = { need: number; have: number };

export default function InsufficientCreditsModal({
  info, onClose,
}: {
  info: InsufficientInfo | null;
  onClose: () => void;
}) {
  const title  = useContent("credits.insufficient.title") as string;
  const bodyTpl= useContent("credits.insufficient.body") as string;
  const ctaBuy = useContent("credits.insufficient.ctaBuy") as string;
  const hrefBuy= useContent("credits.insufficient.ctaBuyHref") as string;
  const ctaBack= useContent("credits.insufficient.ctaBack") as string;

  if (!info) return null;

  const body = (bodyTpl || "")
    .replace("{{need}}", String(info.need))
    .replace("{{have}}", String(info.have));

  return (
    <div
      dir="rtl"
      className="fixed inset-0 z-[210] bg-black/75 backdrop-blur-sm flex items-center justify-center px-4 py-8 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative bg-bg-panel border border-amber-400/40 rounded-3xl max-w-md w-full p-8 text-center shadow-2xl shadow-amber-500/20 animate-in zoom-in-95 duration-300"
      >
        <button
          onClick={onClose}
          aria-label="סגירה"
          className="absolute top-3 left-3 text-white/40 hover:text-white p-1 rounded-md"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="inline-flex p-4 rounded-full bg-gradient-to-br from-amber-500/30 to-orange-500/20 border border-amber-400/40 mb-4">
          <Coins className="w-10 h-10 text-amber-300" />
        </div>

        <h3 className="text-2xl font-extrabold mb-2 text-white">{title}</h3>
        <p className="text-sm text-white/75 mb-6 leading-relaxed whitespace-pre-line">{body}</p>

        <div className="flex flex-col sm:flex-row gap-2">
          <Link
            href={hrefBuy || "/credits"}
            onClick={onClose}
            className="flex-1 inline-flex items-center justify-center gap-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:opacity-90 text-bg font-extrabold py-3 rounded-xl transition-opacity"
          >
            <Coins className="w-4 h-4" /> {ctaBuy}
          </Link>
          <button
            type="button"
            onClick={onClose}
            className="flex-1 inline-flex items-center justify-center gap-2 bg-white/10 hover:bg-white/15 text-white font-bold py-3 rounded-xl transition-colors border border-white/15"
          >
            <ArrowLeft className="w-4 h-4" /> {ctaBack}
          </button>
        </div>
      </div>
    </div>
  );
}
