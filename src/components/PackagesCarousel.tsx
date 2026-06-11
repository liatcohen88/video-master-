"use client";

import { useRef, useEffect, useState } from "react";
import PremiumPkgCard, { type Pkg } from "./PremiumPkgCard";

/**
 * Mobile hero-center carousel for credit packages. The card closest to the
 * strip's center gets full size + full opacity; siblings shrink and fade.
 * Opens centered on the "הכי נמכר" package. Mouse-drag-to-scroll for narrow
 * desktop windows (touch scrolls natively).
 *
 * Tip: pair with a `hidden md:grid` 4-up grid for the desktop layout —
 * this component is `md:hidden` by default.
 */
export default function PackagesCarousel({
  packages, onBuy, busyId,
}: {
  packages: readonly Pkg[];
  onBuy?: (id: string) => void;
  busyId?: string | null;
}) {
  const popularRef = useRef<HTMLDivElement>(null);
  const stripRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);
  const popularIdx = Math.max(0, packages.findIndex((p) => p.highlight === "הכי נמכר"));
  const [activeIdx, setActiveIdx] = useState(popularIdx);
  const drag = useRef<{ startX: number; startScroll: number; active: boolean }>({ startX: 0, startScroll: 0, active: false });

  function updateActive() {
    const el = stripRef.current;
    if (!el) return;
    const stripCenter = el.getBoundingClientRect().left + el.clientWidth / 2;
    let best = 0, bestDist = Infinity;
    cardRefs.current.forEach((card, i) => {
      if (!card) return;
      const r = card.getBoundingClientRect();
      const d = Math.abs(r.left + r.width / 2 - stripCenter);
      if (d < bestDist) { bestDist = d; best = i; }
    });
    setActiveIdx(best);
  }

  useEffect(() => {
    popularRef.current?.scrollIntoView({ inline: "center", block: "nearest" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      ref={stripRef}
      onScroll={updateActive}
      onPointerDown={(e) => {
        if (e.pointerType !== "mouse") return;
        const el = stripRef.current; if (!el) return;
        drag.current = { startX: e.clientX, startScroll: el.scrollLeft, active: true };
        el.setPointerCapture(e.pointerId);
      }}
      onPointerMove={(e) => {
        const el = stripRef.current;
        if (!el || !drag.current.active) return;
        el.scrollLeft = drag.current.startScroll - (e.clientX - drag.current.startX);
      }}
      onPointerUp={() => { drag.current.active = false; }}
      onPointerCancel={() => { drag.current.active = false; }}
      className="md:hidden flex items-center gap-3 overflow-x-auto snap-x snap-proximity pb-4 pt-6 scrollbar-hide touch-pan-x overscroll-x-contain cursor-grab active:cursor-grabbing select-none"
    >
      <div className="shrink-0 w-[10vw]" aria-hidden />
      {packages.map((p, i) => {
        const isActive = i === activeIdx;
        const isPopular = p.highlight === "הכי נמכר";
        return (
          <div
            key={p.id}
            ref={(el) => {
              cardRefs.current[i] = el;
              if (isPopular && el) (popularRef as React.MutableRefObject<HTMLDivElement | null>).current = el;
            }}
            className={`snap-center shrink-0 w-[68%] transition-all duration-300
              ${isActive ? "opacity-100 scale-100 z-10" : "opacity-50 scale-90"}`}
          >
            <PremiumPkgCard pkg={p} onBuy={onBuy} busy={busyId === p.id} />
          </div>
        );
      })}
      <div className="shrink-0 w-[10vw]" aria-hidden />
    </div>
  );
}
