"use client";

import { useContent } from "@/lib/useContent";

/**
 * Brand logo. By default renders the built-in SVG (play button inside
 * dashed/solid brackets, purple→pink gradient). If `brand.logoUrl` is
 * set in the admin CMS (data URL or remote URL), renders that image
 * instead — animation modes still wrap it (breathing/spinning).
 *
 * Modes:
 *   "static"    — no animation (header)
 *   "breathing" — gentle scale pulse, the triangle glows (idle loading)
 *   "spinning"  — the dashed left bracket orbits 360° while triangle pulses
 *                 (heavy processing — transcription / rendering)
 */

type Props = {
  size?: number;
  mode?: "static" | "breathing" | "spinning";
  className?: string;
};

export default function LogoMark({ size = 56, mode = "static", className = "" }: Props) {
  const customLogoUrl = useContent("brand.logoUrl");
  const wrapClass =
    mode === "breathing" ? "logo-breathe" :
    mode === "spinning"  ? "logo-spin-wrap" : "";

  // If admin uploaded a custom logo via CMS, use it instead of the SVG.
  // Animation modes still apply via the wrapper class.
  if (customLogoUrl) {
    return (
      <div className={`relative inline-flex items-center justify-center ${wrapClass} ${className}`}
           style={{ width: size, height: size }}>
        <img src={customLogoUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
        <style jsx>{`
          @keyframes breathe { 0%,100% { transform: scale(1); } 50% { transform: scale(1.08); } }
          @keyframes spin360 { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
          .logo-breathe { animation: breathe 2.4s ease-in-out infinite; }
          .logo-spin-wrap { animation: spin360 3.5s linear infinite; }
        `}</style>
      </div>
    );
  }

  return (
    <div className={`relative inline-flex items-center justify-center ${wrapClass} ${className}`}
         style={{ width: size, height: size }}>
      <svg viewBox="0 0 200 200" fill="none" style={{ width: "100%", height: "100%" }}>
        <defs>
          <linearGradient id="brandGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#7C3AED" />
            <stop offset="100%" stopColor="#EC4899" />
          </linearGradient>
          <filter id="brandGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="4" />
          </filter>
        </defs>

        {/* Outer brackets group — spins in "spinning" mode */}
        <g className={mode === "spinning" ? "logo-spin-brackets" : ""}
           style={{ transformOrigin: "100px 100px" }}>
          {/* Left dashed bracket */}
          <path d="M 80,40 L 60,40 Q 40,40 40,60 L 40,80" stroke="url(#brandGrad)" strokeWidth="14" strokeLinecap="round" fill="none"/>
          <path d="M 40,100 L 40,102" stroke="url(#brandGrad)" strokeWidth="14" strokeLinecap="round" fill="none"/>
          <path d="M 40,118 L 40,120" stroke="url(#brandGrad)" strokeWidth="14" strokeLinecap="round" fill="none"/>
          <path d="M 40,140 Q 40,160 60,160 L 80,160" stroke="url(#brandGrad)" strokeWidth="14" strokeLinecap="round" fill="none"/>

          {/* Right solid bracket */}
          <path d="M 120,40 L 140,40 Q 160,40 160,60 L 160,80" stroke="url(#brandGrad)" strokeWidth="14" strokeLinecap="round" fill="none"/>
          <path d="M 160,120 L 160,140 Q 160,160 140,160 L 120,160" stroke="url(#brandGrad)" strokeWidth="14" strokeLinecap="round" fill="none"/>
        </g>

        {/* Play triangle — always at center, optionally pulses */}
        <g className={mode !== "static" ? "logo-pulse-triangle" : ""}
           style={{ transformOrigin: "100px 100px" }}>
          <path d="M 85,75 L 85,125 L 130,100 Z" fill="url(#brandGrad)" filter={mode !== "static" ? "url(#brandGlow)" : undefined} opacity={mode !== "static" ? 0.5 : 0}/>
          <path d="M 85,75 L 85,125 L 130,100 Z" fill="url(#brandGrad)"/>
        </g>
      </svg>

      <style jsx>{`
        @keyframes breathe {
          0%, 100% { transform: scale(1); }
          50%      { transform: scale(1.08); }
        }
        @keyframes spin360 {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
        @keyframes pulseTri {
          0%, 100% { transform: scale(1); opacity: 1; }
          50%      { transform: scale(1.15); opacity: 0.85; }
        }
        .logo-breathe {
          animation: breathe 2.4s ease-in-out infinite;
        }
        .logo-spin-wrap :global(.logo-spin-brackets) {
          animation: spin360 3.5s linear infinite;
        }
        .logo-spin-wrap :global(.logo-pulse-triangle),
        .logo-breathe :global(.logo-pulse-triangle) {
          animation: pulseTri 1.4s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}
