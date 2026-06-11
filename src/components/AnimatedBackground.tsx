"use client";

/**
 * Global animated background. Three composed layers:
 *
 *   1. Mesh gradient — 4 large blurred blobs in brand colors that drift
 *      in slow elliptical orbits. The classic "alive" gradient.
 *
 *   2. Blueprint grid — a subtle SVG grid that gently fades in/out
 *      across the surface, evoking "something being constructed".
 *
 *   3. Floating particles — 20 tiny sparkles drift upward like
 *      embers, drifting in random columns at random speeds.
 *
 * Sits at position:fixed behind everything (z-index 0), so individual
 * pages can keep their own bg-bg sections; this just adds life behind.
 */

export default function AnimatedBackground() {
  // Pre-generated particle positions so SSR + client match
  const particles = Array.from({ length: 22 }, (_, i) => ({
    id: i,
    left: ((i * 47) % 100),     // pseudo-random columns spread evenly
    delay: (i % 7) * 1.2,
    duration: 10 + (i % 5) * 2, // 10–18s drift
    size: 2 + (i % 4),          // 2–5px
  }));

  return (
    <div
      aria-hidden
      className="fixed inset-0 -z-10 overflow-hidden pointer-events-none"
      style={{ background: "#0a0a0f" }}
    >
      {/* Layer 1 — drifting mesh blobs */}
      <div className="absolute -top-1/4 -right-1/4 w-[55vw] h-[55vw] rounded-full ab-blob ab-blob-1"
           style={{ background: "radial-gradient(circle, rgba(124, 58, 237, 0.45) 0%, transparent 65%)" }} />
      <div className="absolute -bottom-1/4 -left-1/4 w-[60vw] h-[60vw] rounded-full ab-blob ab-blob-2"
           style={{ background: "radial-gradient(circle, rgba(236, 72, 153, 0.35) 0%, transparent 65%)" }} />
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[40vw] h-[40vw] rounded-full ab-blob ab-blob-3"
           style={{ background: "radial-gradient(circle, rgba(34, 211, 238, 0.18) 0%, transparent 65%)" }} />
      <div className="absolute bottom-1/4 right-1/3 w-[35vw] h-[35vw] rounded-full ab-blob ab-blob-4"
           style={{ background: "radial-gradient(circle, rgba(168, 85, 247, 0.3) 0%, transparent 65%)" }} />

      {/* Layer 2 — blueprint grid (SVG pattern) */}
      <svg className="absolute inset-0 w-full h-full ab-grid" xmlns="http://www.w3.org/2000/svg" aria-hidden>
        <defs>
          <pattern id="ab-grid-pattern" width="48" height="48" patternUnits="userSpaceOnUse">
            <path d="M 48 0 L 0 0 0 48" fill="none" stroke="rgba(168, 85, 247, 0.08)" strokeWidth="0.6" />
          </pattern>
          <radialGradient id="ab-grid-fade" cx="50%" cy="50%" r="65%">
            <stop offset="0%"   stopColor="white" stopOpacity="1" />
            <stop offset="70%"  stopColor="white" stopOpacity="0.5" />
            <stop offset="100%" stopColor="white" stopOpacity="0" />
          </radialGradient>
          <mask id="ab-grid-mask">
            <rect width="100%" height="100%" fill="url(#ab-grid-fade)" />
          </mask>
        </defs>
        <rect width="100%" height="100%" fill="url(#ab-grid-pattern)" mask="url(#ab-grid-mask)" />
      </svg>

      {/* Layer 3 — floating particles */}
      <div className="absolute inset-0">
        {particles.map((p) => (
          <span
            key={p.id}
            className="ab-particle"
            style={{
              left: `${p.left}%`,
              width: `${p.size}px`,
              height: `${p.size}px`,
              animationDelay: `${p.delay}s`,
              animationDuration: `${p.duration}s`,
            }}
          />
        ))}
      </div>

      {/* Top vignette for legibility */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-transparent to-black/50" />

      <style jsx>{`
        @keyframes ab-blob-1 {
          0%,100% { transform: translate(0, 0)    scale(1); }
          50%     { transform: translate(8vw, 6vh) scale(1.12); }
        }
        @keyframes ab-blob-2 {
          0%,100% { transform: translate(0, 0)     scale(1); }
          50%     { transform: translate(-6vw, -8vh) scale(0.9); }
        }
        @keyframes ab-blob-3 {
          0%,100% { transform: translate(-50%, 0)        scale(1); }
          50%     { transform: translate(-40%, -10vh)    scale(1.15); }
        }
        @keyframes ab-blob-4 {
          0%,100% { transform: translate(0, 0)    scale(0.95); }
          50%     { transform: translate(-10vw, 4vh) scale(1.08); }
        }
        .ab-blob { filter: blur(60px); will-change: transform; }
        .ab-blob-1 { animation: ab-blob-1 22s ease-in-out infinite; }
        .ab-blob-2 { animation: ab-blob-2 28s ease-in-out infinite; }
        .ab-blob-3 { animation: ab-blob-3 18s ease-in-out infinite; }
        .ab-blob-4 { animation: ab-blob-4 24s ease-in-out infinite; }

        @keyframes ab-grid-breathe {
          0%,100% { opacity: 0.4; }
          50%     { opacity: 0.9; }
        }
        .ab-grid {
          opacity: 0.5;
          animation: ab-grid-breathe 10s ease-in-out infinite;
        }

        @keyframes ab-particle-rise {
          0%   { transform: translateY(0)     scale(0); opacity: 0; }
          10%  { transform: translateY(-5vh)  scale(1); opacity: 0.8; }
          90%  { transform: translateY(-95vh) scale(1); opacity: 0.5; }
          100% { transform: translateY(-110vh) scale(0); opacity: 0; }
        }
        .ab-particle {
          position: absolute;
          bottom: -10px;
          border-radius: 50%;
          background: radial-gradient(circle, #EC4899 0%, #7C3AED 60%, transparent 100%);
          box-shadow: 0 0 6px rgba(236, 72, 153, 0.7), 0 0 12px rgba(124, 58, 237, 0.4);
          opacity: 0;
          animation: ab-particle-rise linear infinite;
        }
      `}</style>
    </div>
  );
}
