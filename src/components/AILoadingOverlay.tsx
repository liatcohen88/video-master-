"use client";

import LogoMark from "./LogoMark";
import { useContent } from "@/lib/useContent";

type Props = {
  /** Main headline — e.g. "AI מתמלל לך את הסרטון" */
  title: string;
  /** Optional secondary line — current pipeline stage */
  subtitle?: string;
  /** Small reassuring footnote. Defaults to the CMS aiLoader.defaultHint;
   *  pass a custom string for other operations, or "" to hide it entirely. */
  hint?: string;
};

/**
 * Full-screen overlay shown while the heavy AI pipeline is running
 * (transcription + analysis). Spinning brand logo + animated dots +
 * customizable title so the caller can switch wording per edit mode
 * ("מתמלל" vs "מתמלל ועורך"). The default hint comes from the CMS so
 * admin can rephrase without a deploy.
 */
export default function AILoadingOverlay({ title, subtitle, hint }: Props) {
  const cmsHint = useContent("aiLoader.defaultHint") as string;
  const stayWarn = useContent("aiLoader.stayWarning") as string;
  const finalHint = hint !== undefined ? hint : cmsHint;
  return (
    <div
      dir="rtl"
      className="fixed inset-0 z-[140] flex items-center justify-center bg-bg/85 backdrop-blur-md animate-fade-in px-4"
    >
      {/* Floating popup card instead of bare overlay text — gives a clear
          "something is happening, hold on" surface (Liat: "חיווי ויראלי
          במקום loader חיוור"). Pulses gently to feel alive. */}
      <div className="relative max-w-md w-full bg-bg-panel border border-brand/40 rounded-3xl px-6 py-8 shadow-2xl shadow-brand/40 animate-popup-in flex flex-col items-center gap-6 text-center">
        {/* Brand logo — full reveal animation (particles + scan + glow) */}
        <div className="relative">
          <div className="absolute inset-0 -m-6 rounded-full bg-gradient-to-br from-brand/30 to-pink-500/20 blur-2xl animate-pulse-glow" />
          <LogoMark size={110} mode="reveal" />
        </div>

        {/* Title — dots inline-after as a single non-breaking unit so RTL
            doesn't push them to the opposite side of the line. */}
        <div>
          <h2 className="text-2xl md:text-3xl font-black text-white mb-2 leading-snug">
            {title}
            <span className="inline-block whitespace-nowrap mr-1 align-baseline">
              <span className="loader-dot">.</span>
              <span className="loader-dot">.</span>
              <span className="loader-dot">.</span>
            </span>
          </h2>
          {subtitle && (
            <p className="text-sm text-white/60">{subtitle}</p>
          )}
        </div>

        {/* Indeterminate progress shimmer */}
        <div className="w-72 h-1.5 rounded-full bg-white/10 overflow-hidden">
          <div className="h-full w-1/3 bg-gradient-to-r from-brand to-pink-500 rounded-full animate-shimmer" />
        </div>

        {finalHint && (
          <p className="text-[11px] text-white/40 max-w-xs leading-relaxed">{finalHint}</p>
        )}

        {/* Stay-on-page warning — Liat: "אולי כדאי גם במייצא לך את הסרטון
            ובמתמלל שנוסיף איזו שורה שנא לא לצאת מהדף כי זה לא עובד אם
            יוצאים, זה מראה שגיאה". Shown on both transcribe AND export
            loaders since both use this overlay. */}
        {stayWarn && (
          <p className="text-xs text-amber-300/90 bg-amber-500/10 border border-amber-400/30 rounded-lg px-3 py-2 max-w-xs leading-relaxed">
            {stayWarn}
          </p>
        )}
      </div>

      <style jsx global>{`
        @keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
        @keyframes popup-in {
          from { opacity: 0; transform: scale(0.92) translateY(8px); }
          to   { opacity: 1; transform: scale(1) translateY(0); }
        }
        .animate-popup-in { animation: popup-in 320ms cubic-bezier(0.16, 1, 0.3, 1) both; }
        @keyframes pulse-glow {
          0%, 100% { opacity: 0.6; transform: scale(1); }
          50%      { opacity: 1;   transform: scale(1.1); }
        }
        @keyframes shimmer {
          0%   { transform: translateX(-100%); }
          100% { transform: translateX(400%); }
        }
        @keyframes loader-dot-bounce {
          0%, 80%, 100% { opacity: 0.2; transform: translateY(0); }
          40%           { opacity: 1;   transform: translateY(-4px); }
        }
        .animate-fade-in   { animation: fade-in 220ms ease-out; }
        .animate-pulse-glow{ animation: pulse-glow 2s ease-in-out infinite; }
        .animate-shimmer   { animation: shimmer 1.5s ease-in-out infinite; }
        .loader-dot        { animation: loader-dot-bounce 1.4s ease-in-out infinite; display: inline-block; }
        .loader-dot:nth-child(2) { animation-delay: 0.15s; }
        .loader-dot:nth-child(3) { animation-delay: 0.3s;  }
      `}</style>
    </div>
  );
}
