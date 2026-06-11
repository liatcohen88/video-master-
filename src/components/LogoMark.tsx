"use client";

import { useEffect, useState } from "react";
import { useContent } from "@/lib/useContent";

/**
 * Brand logo with cinema-grade animation system.
 *
 * Now loads /logo.png by default (Liat's actual artwork). The animation
 * choreography wraps the image — since a raster file can't be exploded
 * into per-piece SVG paths, we instead build the drama AROUND it:
 * particles converge from outside, glow ring explodes, image bursts in
 * with elastic bounce.
 *
 * If `brand.logoUrl` is set in CMS, that overrides the default file.
 *
 * Modes:
 *   "static"     — no animation (header, footer)
 *   "breathing"  — gentle scale pulse + glow halo (idle wait)
 *   "spinning"   — full rotation + pulse (heavy work — render/transcribe)
 *   "reveal"     — full ~2.5s assembly: particles converge → flash →
 *                  logo bursts in → glow ring expands → idle pulse loop
 *                  (use for splash screens + premium loading)
 */

const DEFAULT_LOGO = "/logo.png";

type Props = {
  size?: number;
  mode?: "static" | "breathing" | "spinning" | "reveal";
  className?: string;
};

/**
 * Auto-trim transparent padding from the logo (client-side canvas).
 * Logo exports often ship with big transparent borders that visually push
 * the mark away from the wordmark in headers. We crop to the visible
 * bounding box once per src (cached) — works for the default file AND for
 * admin-uploaded data-URL logos stored in CMS.
 */
const trimCache = new Map<string, string>();
function useTrimmedLogo(src: string): string {
  const [trimmed, setTrimmed] = useState<string>(() => trimCache.get(src) ?? src);
  useEffect(() => {
    if (trimCache.has(src)) { setTrimmed(trimCache.get(src)!); return; }
    let cancelled = false;
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const c = document.createElement("canvas");
        c.width = img.naturalWidth; c.height = img.naturalHeight;
        const ctx = c.getContext("2d");
        if (!ctx) return;
        ctx.drawImage(img, 0, 0);
        const { data, width, height } = ctx.getImageData(0, 0, c.width, c.height);
        let minX = width, minY = height, maxX = -1, maxY = -1;
        for (let y = 0; y < height; y++) {
          for (let x = 0; x < width; x++) {
            if (data[(y * width + x) * 4 + 3] > 8) { // visible pixel
              if (x < minX) minX = x;
              if (x > maxX) maxX = x;
              if (y < minY) minY = y;
              if (y > maxY) maxY = y;
            }
          }
        }
        if (maxX < minX || maxY < minY) { trimCache.set(src, src); return; } // fully transparent
        const w = maxX - minX + 1, h = maxY - minY + 1;
        // Skip when padding is negligible (<8% per axis) — not worth a re-encode.
        if (w > width * 0.92 && h > height * 0.92) { trimCache.set(src, src); return; }
        const out = document.createElement("canvas");
        out.width = w; out.height = h;
        out.getContext("2d")!.drawImage(img, minX, minY, w, h, 0, 0, w, h);
        const url = out.toDataURL("image/png");
        trimCache.set(src, url);
        if (!cancelled) setTrimmed(url);
      } catch { /* tainted canvas — keep original */ }
    };
    img.src = src;
    return () => { cancelled = true; };
  }, [src]);
  return trimmed;
}

export default function LogoMark({ size = 56, mode = "static", className = "" }: Props) {
  const customLogoUrl = useContent("brand.logoUrl");
  const logoSrc = useTrimmedLogo(customLogoUrl || DEFAULT_LOGO);

  // Wrapper-level continuous animations
  const wrapClass =
    mode === "breathing" ? "lm-breathe" :
    mode === "spinning"  ? "lm-spin"    :
    mode === "reveal"    ? "lm-reveal-container" : "";

  return (
    <div
      className={`relative inline-flex items-center justify-center ${wrapClass} ${className}`}
      style={{ width: size, height: size }}
      aria-hidden={mode !== "static"}
    >
      {/* ── Particle layer — converging during reveal, floating idle after ── */}
      {(mode === "reveal" || mode === "breathing") && (
        <div className="absolute inset-0 pointer-events-none overflow-visible" aria-hidden>
          {Array.from({ length: 12 }).map((_, i) => (
            <span key={i}
                  className={`lm-particle lm-particle-${i % 8} ${mode === "reveal" ? "lm-particle-converge" : "lm-particle-float"}`}
                  style={{ animationDelay: mode === "reveal" ? `${0.05 * i}s` : `${0.3 * i}s` }} />
          ))}
        </div>
      )}

      {/* ── Glow ring — explosive ripple at the moment of arrival ── */}
      {mode === "reveal" && (
        <>
          <span className="lm-ring lm-ring-1" aria-hidden />
          <span className="lm-ring lm-ring-2" aria-hidden />
        </>
      )}

      {/* ── Persistent soft halo behind the image ── */}
      {mode !== "static" && (
        <span className="lm-halo" aria-hidden />
      )}

      {/* ── The actual logo image ── */}
      <img
        src={logoSrc}
        alt=""
        className={
          mode === "reveal"     ? "lm-img lm-img-reveal"
          : mode === "spinning" ? "lm-img lm-img-spin-pulse"
          : mode === "breathing" ? "lm-img lm-img-breathe"
          : "lm-img"
        }
        style={{ width: "100%", height: "100%", objectFit: "contain", position: "relative", zIndex: 1 }}
      />

      {/* ── Scan line — drawn ACROSS the logo during reveal ── */}
      {mode === "reveal" && <span className="lm-scanline" aria-hidden />}

      {/* ── Blueprint wireframe brackets — drawn while logo is "loading" ── */}
      {mode === "reveal" && (
        <svg className="lm-wireframe" viewBox="0 0 200 200" fill="none" aria-hidden>
          <path d="M 90,42 L 62,42 Q 42,42 42,62 L 42,72"
                stroke="#A855F7" strokeWidth="1.5" strokeLinecap="round" fill="none"
                strokeDasharray="4 4" pathLength="1" className="lm-wire-line lm-wire-1" />
          <path d="M 42,134 L 42,138 Q 42,158 62,158 L 90,158"
                stroke="#A855F7" strokeWidth="1.5" strokeLinecap="round" fill="none"
                strokeDasharray="4 4" pathLength="1" className="lm-wire-line lm-wire-2" />
          <path d="M 110,42 L 138,42 Q 158,42 158,62 L 158,90"
                stroke="#EC4899" strokeWidth="1.5" strokeLinecap="round" fill="none"
                strokeDasharray="4 4" pathLength="1" className="lm-wire-line lm-wire-3" />
          <path d="M 158,110 L 158,138 Q 158,158 138,158 L 110,158"
                stroke="#EC4899" strokeWidth="1.5" strokeLinecap="round" fill="none"
                strokeDasharray="4 4" pathLength="1" className="lm-wire-line lm-wire-4" />
          <path d="M 82,72 L 82,128 L 134,100 Z"
                stroke="#EC4899" strokeWidth="1.5" fill="none"
                strokeDasharray="4 4" pathLength="1" className="lm-wire-line lm-wire-5" />
        </svg>
      )}

      <LogoStyles />
    </div>
  );
}

function LogoStyles() {
  return (
    <style jsx global>{`
      /* ── Container wrappers (continuous) ── */
      @keyframes lm-breathe-wrap {
        0%,100% { transform: scale(1); }
        50%     { transform: scale(1.05); }
      }
      .lm-breathe { animation: lm-breathe-wrap 2.6s ease-in-out infinite; }

      @keyframes lm-spin-wrap {
        from { transform: rotate(0deg); }
        to   { transform: rotate(360deg); }
      }
      .lm-spin { animation: lm-spin-wrap 3.5s linear infinite; }

      /* ── The image itself ── */
      .lm-img { display: block; }

      @keyframes lm-img-breathe {
        0%,100% { filter: drop-shadow(0 0 6px rgba(168, 85, 247, 0.5)); }
        50%     { filter: drop-shadow(0 0 16px rgba(236, 72, 153, 0.7)); transform: scale(1.04); }
      }
      .lm-img-breathe { animation: lm-img-breathe 2.4s ease-in-out infinite; }

      @keyframes lm-img-spin-pulse {
        0%,100% { transform: scale(1);    filter: drop-shadow(0 0 8px rgba(168, 85, 247, 0.6)); }
        50%     { transform: scale(1.08); filter: drop-shadow(0 0 20px rgba(236, 72, 153, 0.85)); }
      }
      .lm-img-spin-pulse { animation: lm-img-spin-pulse 1.6s ease-in-out infinite; }

      /* The big reveal — scan-line "paints" the logo from left to right.
         Step 1: image starts fully clipped from left (invisible).
         Step 2: clip retracts as scan line sweeps across (~1.4s).
         Step 3: brief flash, scale bounce, then idle pulse forever.
         Plus occasional flicker like "still establishing connection". */
      @keyframes lm-img-scan-reveal {
        0%   { clip-path: inset(0 0 0 100%); opacity: 0; transform: scale(0.95); filter: blur(4px); }
        5%   { opacity: 1; }
        70%  { clip-path: inset(0 0 0 0%); opacity: 1; transform: scale(0.95); filter: blur(0); }
        82%  { transform: scale(1.18); filter: drop-shadow(0 0 24px rgba(236, 72, 153, 1)); }
        92%  { transform: scale(0.96); }
        100% { transform: scale(1); clip-path: inset(0 0 0 0%); opacity: 1; filter: drop-shadow(0 0 14px rgba(236, 72, 153, 0.7)); }
      }
      @keyframes lm-img-reveal-idle {
        0%,100% { transform: scale(1);    filter: drop-shadow(0 0 12px rgba(236, 72, 153, 0.55)); }
        50%     { transform: scale(1.05); filter: drop-shadow(0 0 22px rgba(236, 72, 153, 0.85)); }
      }
      @keyframes lm-img-flicker {
        0%, 100%  { opacity: 1; }
        45%, 55%  { opacity: 1; }
        47%       { opacity: 0.6; }
        49%       { opacity: 1; }
        51%       { opacity: 0.7; }
        53%       { opacity: 1; }
      }
      .lm-img-reveal {
        clip-path: inset(0 0 0 100%);
        animation:
          lm-img-scan-reveal 1.8s cubic-bezier(0.34, 1.56, 0.64, 1) 0s both,
          lm-img-reveal-idle 2.4s ease-in-out 1.9s infinite,
          lm-img-flicker     5s linear 2.5s infinite;
      }

      /* ── Scan line that sweeps across during reveal ── */
      @keyframes lm-scanline-sweep {
        0%   { left: 0%;   opacity: 0; }
        8%   { opacity: 1; }
        70%  { left: 100%; opacity: 1; }
        100% { left: 100%; opacity: 0; }
      }
      .lm-scanline {
        position: absolute;
        top: 5%;
        bottom: 5%;
        width: 3px;
        background: linear-gradient(to bottom, transparent 0%, #EC4899 30%, #A855F7 50%, #EC4899 70%, transparent 100%);
        box-shadow:
          0 0 12px 2px #EC4899,
          0 0 30px 6px #A855F7,
          0 0 60px 10px rgba(236, 72, 153, 0.6);
        z-index: 3;
        pointer-events: none;
        animation: lm-scanline-sweep 1.5s ease-out 0.1s both;
      }

      /* ── Blueprint wireframe — visible only while logo is "building" ── */
      @keyframes lm-wire-draw {
        0%   { stroke-dashoffset: 1; opacity: 0; }
        15%  { opacity: 0.9; }
        70%  { opacity: 0.9; }
        100% { stroke-dashoffset: 0; opacity: 0; }
      }
      .lm-wireframe {
        position: absolute;
        inset: 0;
        z-index: 2;
        width: 100%;
        height: 100%;
        pointer-events: none;
        filter: drop-shadow(0 0 4px rgba(168, 85, 247, 0.6));
      }
      .lm-wire-line { stroke-dasharray: 1; stroke-dashoffset: 1; }
      .lm-wire-1 { animation: lm-wire-draw 1.4s ease-in-out 0.0s  both; }
      .lm-wire-2 { animation: lm-wire-draw 1.4s ease-in-out 0.15s both; }
      .lm-wire-3 { animation: lm-wire-draw 1.4s ease-in-out 0.3s  both; }
      .lm-wire-4 { animation: lm-wire-draw 1.4s ease-in-out 0.45s both; }
      .lm-wire-5 { animation: lm-wire-draw 1.4s ease-in-out 0.6s  both; }

      /* ── Soft halo (always-on background glow) ── */
      .lm-halo {
        position: absolute;
        inset: -20%;
        background: radial-gradient(circle, rgba(168, 85, 247, 0.35) 0%, rgba(236, 72, 153, 0.1) 40%, transparent 70%);
        filter: blur(8px);
        z-index: 0;
        animation: lm-halo-pulse 2.6s ease-in-out infinite;
      }
      @keyframes lm-halo-pulse {
        0%,100% { opacity: 0.5; transform: scale(0.95); }
        50%     { opacity: 0.85; transform: scale(1.1); }
      }

      /* ── Explosive glow ring (one-shot at the moment the logo lands) ── */
      .lm-ring {
        position: absolute;
        inset: 50%;
        width: 0;
        height: 0;
        border-radius: 50%;
        border: 3px solid;
        opacity: 0;
        z-index: 2;
        pointer-events: none;
      }
      .lm-ring-1 {
        border-color: rgba(236, 72, 153, 0.9);
        animation: lm-ring-burst 1.0s ease-out 1.0s both;
      }
      .lm-ring-2 {
        border-color: rgba(168, 85, 247, 0.7);
        animation: lm-ring-burst 1.2s ease-out 1.15s both;
      }
      @keyframes lm-ring-burst {
        0%   { inset: 50%; opacity: 0; border-width: 8px; }
        20%  { opacity: 1; }
        100% { inset: -30%; opacity: 0; border-width: 1px; }
      }

      /* ── Particles ── */
      .lm-particle {
        position: absolute;
        width: 6px;
        height: 6px;
        border-radius: 50%;
        background: radial-gradient(circle, #EC4899 0%, #7C3AED 60%, transparent 100%);
        box-shadow: 0 0 8px #EC4899AA, 0 0 16px #7C3AED66;
        opacity: 0;
        z-index: 0;
      }

      /* Reveal mode — converge from outside toward center */
      @keyframes lm-particle-converge {
        0%   { opacity: 0; }
        15%  { opacity: 1; }
        70%  { opacity: 1; transform: translate(0, 0) scale(1.5); }
        80%  { opacity: 1; transform: translate(0, 0) scale(0.2); }
        100% { opacity: 0; transform: translate(0, 0) scale(0); }
      }
      .lm-particle-converge {
        animation: lm-particle-converge 1.1s ease-in 0s both;
      }
      /* 8 directions for converging particles */
      .lm-particle-0 { top: 50%; left: -10%;  transform: translate(60%, -50%) scale(0.2); animation-name: lm-conv-0; }
      .lm-particle-1 { top: 10%; left: 10%;   transform: translate(0, 0)     scale(0.2); animation-name: lm-conv-1; }
      .lm-particle-2 { top: -10%; left: 50%;  transform: translate(-50%, 60%) scale(0.2); animation-name: lm-conv-2; }
      .lm-particle-3 { top: 10%; left: 90%;   transform: translate(-100%, 0) scale(0.2); animation-name: lm-conv-3; }
      .lm-particle-4 { top: 50%; left: 110%;  transform: translate(-160%, -50%) scale(0.2); animation-name: lm-conv-4; }
      .lm-particle-5 { top: 90%; left: 90%;   transform: translate(-100%, -100%) scale(0.2); animation-name: lm-conv-5; }
      .lm-particle-6 { top: 110%; left: 50%;  transform: translate(-50%, -160%) scale(0.2); animation-name: lm-conv-6; }
      .lm-particle-7 { top: 90%; left: 10%;   transform: translate(0, -100%) scale(0.2); animation-name: lm-conv-7; }

      @keyframes lm-conv-0 { 0% { transform: translate(60%,-50%)  scale(0.2); opacity: 0; } 30% { opacity: 1; } 75% { transform: translate(700%, -50%) scale(1.5); opacity: 1; } 100% { transform: translate(700%, -50%) scale(0); opacity: 0; } }
      @keyframes lm-conv-1 { 0% { transform: translate(0,0)       scale(0.2); opacity: 0; } 30% { opacity: 1; } 75% { transform: translate(400%, 400%) scale(1.5); opacity: 1; } 100% { transform: translate(400%, 400%) scale(0); opacity: 0; } }
      @keyframes lm-conv-2 { 0% { transform: translate(-50%,60%)  scale(0.2); opacity: 0; } 30% { opacity: 1; } 75% { transform: translate(-50%, 700%) scale(1.5); opacity: 1; } 100% { transform: translate(-50%, 700%) scale(0); opacity: 0; } }
      @keyframes lm-conv-3 { 0% { transform: translate(-100%,0)   scale(0.2); opacity: 0; } 30% { opacity: 1; } 75% { transform: translate(-500%, 400%) scale(1.5); opacity: 1; } 100% { transform: translate(-500%, 400%) scale(0); opacity: 0; } }
      @keyframes lm-conv-4 { 0% { transform: translate(-160%,-50%) scale(0.2); opacity: 0; } 30% { opacity: 1; } 75% { transform: translate(-800%, -50%) scale(1.5); opacity: 1; } 100% { transform: translate(-800%, -50%) scale(0); opacity: 0; } }
      @keyframes lm-conv-5 { 0% { transform: translate(-100%,-100%) scale(0.2); opacity: 0; } 30% { opacity: 1; } 75% { transform: translate(-500%, -500%) scale(1.5); opacity: 1; } 100% { transform: translate(-500%, -500%) scale(0); opacity: 0; } }
      @keyframes lm-conv-6 { 0% { transform: translate(-50%,-160%) scale(0.2); opacity: 0; } 30% { opacity: 1; } 75% { transform: translate(-50%, -800%) scale(1.5); opacity: 1; } 100% { transform: translate(-50%, -800%) scale(0); opacity: 0; } }
      @keyframes lm-conv-7 { 0% { transform: translate(0,-100%)    scale(0.2); opacity: 0; } 30% { opacity: 1; } 75% { transform: translate(400%, -500%) scale(1.5); opacity: 1; } 100% { transform: translate(400%, -500%) scale(0); opacity: 0; } }

      /* Idle breathing — particles drift upward gently */
      @keyframes lm-particle-float {
        0%   { transform: translateY(0)    scale(0); opacity: 0; }
        15%  { transform: translateY(-10%) scale(1); opacity: 0.9; }
        100% { transform: translateY(-140%) scale(0.2); opacity: 0; }
      }
      .lm-particle-float {
        bottom: 20%;
        top: auto;
        animation: lm-particle-float 3.5s ease-out infinite;
      }
    `}</style>
  );
}
