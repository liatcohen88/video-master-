"use client";

/**
 * Mobile picture-in-picture wrapper for the live VideoPreview.
 *
 * Behavior on mobile (< lg):
 *   - At top of page: preview renders in NORMAL flow at full width.
 *   - When the user scrolls past the BOTTOM of the preview, the card snaps
 *     to a fixed corner card (PiP) — small, draggable, persisted position.
 *
 * On desktop (lg+) `lg:contents` flattens the wrapper entirely.
 *
 * Two subtle bugs this rewrite kills (Liat 2026-06-16: "באג במיני סרטון
 * הוא משגעעע"):
 *
 *   1. Flicker loop. The OLD impl made the wrapper itself `position:fixed`
 *      when PiP activated. That removed its height from the document flow,
 *      so the page shrank by ~H pixels. With the sentinel sitting near the
 *      bottom of the viewport, that shrink moved the sentinel back INTO
 *      view → isPip flipped back to false → wrapper restored its height →
 *      page grew → sentinel went back out → infinite toggle. Fix: keep the
 *      outer wrapper in flow ALWAYS; only the INNER card switches between
 *      static (in-flow) and fixed (PiP). The outer wrapper reserves the
 *      original height via `min-height` while in PiP so the page geometry
 *      stays put.
 *
 *   2. Premature trigger. We want PiP only AFTER the preview is fully
 *      gone, not partway. Sentinel is rendered AFTER children, and a small
 *      negative rootMargin gives a hysteresis buffer so micro-scroll
 *      jitters around the boundary don't cause toggles.
 */

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { GripVertical } from "lucide-react";

const STORAGE_KEY = "vm_pip_pos_v1";
const PIP_WIDTH = 140;
const MARGIN = 8;
const DEFAULT_TOP = 64;
const DEFAULT_RIGHT = 8;

type Pos = { x: number; y: number };

function readPos(): Pos | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw);
    return typeof p?.x === "number" && typeof p?.y === "number" ? p : null;
  } catch { return null; }
}
function writePos(p: Pos) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(p)); } catch {}
}

export default function MobilePip({ children }: { children: React.ReactNode }) {
  const sentinelRef = useRef<HTMLDivElement>(null);
  const outerRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const [isPip, setIsPip] = useState(false);
  const [pos, setPos] = useState<Pos | null>(null);
  // Preserves the wrapper's natural height once PiP yanks the inner card
  // out of flow. Measured from the OUTER wrapper while not in PiP.
  const [reservedH, setReservedH] = useState(0);
  const dragRef = useRef<{ startX: number; startY: number; originX: number; originY: number } | null>(null);

  // Capture the wrapper's natural height every time it changes while NOT
  // in PiP mode. As soon as PiP activates we freeze the last value and use
  // it as min-height so the page doesn't collapse.
  useLayoutEffect(() => {
    if (isPip) return;
    const el = outerRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const update = () => {
      const h = el.offsetHeight;
      if (h > 0) setReservedH(h);
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [isPip]);

  // Sentinel watcher. Sentinel sits AFTER the children. When the user
  // scrolls past the bottom of the preview, sentinel leaves the top of
  // the viewport → isPip=true. rootMargin gives a small hysteresis buffer.
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      ([entry]) => { setIsPip(!entry.isIntersecting); },
      // Negative top margin: sentinel is "still intersecting" until it's
      // 40px above the viewport top. Tiny scroll oscillations don't toggle.
      { rootMargin: "-40px 0px 0px 0px", threshold: 0 },
    );
    io.observe(sentinel);
    return () => io.disconnect();
  }, []);

  // Load saved position the first time we enter PiP mode.
  useEffect(() => {
    if (!isPip || pos) return;
    const saved = readPos();
    if (saved) setPos(saved);
    else if (typeof window !== "undefined") {
      setPos({
        x: window.innerWidth - PIP_WIDTH - DEFAULT_RIGHT,
        y: DEFAULT_TOP,
      });
    }
  }, [isPip, pos]);

  // Keep within viewport on resize.
  useEffect(() => {
    const onResize = () => {
      setPos((p) => {
        if (!p) return p;
        const el = cardRef.current;
        const w = el?.offsetWidth ?? PIP_WIDTH;
        const h = el?.offsetHeight ?? 250;
        return {
          x: Math.max(MARGIN, Math.min(window.innerWidth - w - MARGIN, p.x)),
          y: Math.max(MARGIN, Math.min(window.innerHeight - h - MARGIN, p.y)),
        };
      });
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  function onPointerDown(e: React.PointerEvent) {
    if (!pos) return;
    const target = e.target as HTMLElement;
    if (target.closest("video, button, input, a")) return;
    dragRef.current = { startX: e.clientX, startY: e.clientY, originX: pos.x, originY: pos.y };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    e.preventDefault();
  }
  function onPointerMove(e: React.PointerEvent) {
    if (!dragRef.current) return;
    const d = dragRef.current;
    const el = cardRef.current;
    const w = el?.offsetWidth ?? PIP_WIDTH;
    const h = el?.offsetHeight ?? 250;
    const nx = Math.max(MARGIN, Math.min(window.innerWidth - w - MARGIN, d.originX + (e.clientX - d.startX)));
    const ny = Math.max(MARGIN, Math.min(window.innerHeight - h - MARGIN, d.originY + (e.clientY - d.startY)));
    setPos({ x: nx, y: ny });
  }
  function onPointerUp(e: React.PointerEvent) {
    if (dragRef.current && pos) writePos(pos);
    dragRef.current = null;
    try { (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId); } catch {}
  }

  // Only the INNER card switches to fixed. The OUTER wrapper stays in flow
  // and reserves the original height — that's what kills the flicker loop.
  const cardStyle: React.CSSProperties = isPip && pos
    ? { position: "fixed", top: pos.y, left: pos.x, width: PIP_WIDTH, zIndex: 30 }
    : {};

  const outerStyle: React.CSSProperties = isPip && reservedH > 0
    ? { minHeight: reservedH }
    : {};

  return (
    <>
      <div
        ref={outerRef}
        // Desktop: lg:contents flattens this entirely.
        className="lg:contents"
        style={outerStyle}
      >
        <div
          ref={cardRef}
          data-vm-pip={isPip ? "1" : "0"}
          onPointerDown={isPip ? onPointerDown : undefined}
          onPointerMove={isPip ? onPointerMove : undefined}
          onPointerUp={isPip ? onPointerUp : undefined}
          onPointerCancel={isPip ? onPointerUp : undefined}
          className={[
            "lg:contents",
            isPip ? "max-lg:rounded-xl max-lg:overflow-hidden max-lg:shadow-xl max-lg:shadow-black/60 max-lg:ring-1 max-lg:ring-white/15 max-lg:cursor-move max-lg:touch-none max-lg:select-none max-lg:bg-bg" : "",
          ].join(" ")}
          style={cardStyle}
        >
          {isPip && (
            <div className="hidden max-lg:flex items-center justify-center gap-1 h-5 bg-black/85 text-white/50 text-[10px]">
              <GripVertical className="w-3 h-3" />
              <span>גרירה</span>
            </div>
          )}
          {children}
        </div>
      </div>
      {/* Sentinel — placed AFTER the outer wrapper so it stays at a stable
          document position even while PiP is active (the outer wrapper
          reserves height via min-height, so the sentinel doesn't move when
          the inner card pops out of flow). */}
      <div ref={sentinelRef} aria-hidden className="lg:hidden h-px w-full" />
    </>
  );
}
