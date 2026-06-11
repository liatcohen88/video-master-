"use client";

import LogoMark from "./LogoMark";

type Props = {
  /** Main headline — e.g. "AI מתמלל לך את הסרטון" */
  title: string;
  /** Optional secondary line — current pipeline stage */
  subtitle?: string;
  /** Small reassuring footnote. Defaults to the transcription wording; pass a
   *  custom string for other operations, or "" to hide it entirely. */
  hint?: string;
};

const DEFAULT_HINT = "ה-AI מקשיב ומבין כל מילה. זה ייקח בערך דקה עד שתיים — תלוי באורך הסרטון.";

/**
 * Full-screen overlay shown while the heavy AI pipeline is running
 * (transcription + analysis). Spinning brand logo + animated dots +
 * customizable title so the caller can switch wording per edit mode
 * ("מתמלל" vs "מתמלל ועורך").
 */
export default function AILoadingOverlay({ title, subtitle, hint = DEFAULT_HINT }: Props) {
  return (
    <div
      dir="rtl"
      className="fixed inset-0 z-[140] flex items-center justify-center bg-bg/90 backdrop-blur-md animate-fade-in"
    >
      <div className="flex flex-col items-center gap-7 px-6 text-center max-w-md">
        {/* Brand logo — full reveal animation (particles + scan + glow) */}
        <div className="relative">
          <div className="absolute inset-0 -m-6 rounded-full bg-gradient-to-br from-brand/30 to-pink-500/20 blur-2xl animate-pulse-glow" />
          <LogoMark size={140} mode="reveal" />
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

        {hint && (
          <p className="text-[11px] text-white/40 max-w-xs leading-relaxed">{hint}</p>
        )}
      </div>

      <style jsx global>{`
        @keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
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
