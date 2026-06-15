"use client";

/**
 * Mobile picture-in-picture wrapper for the live VideoPreview.
 *
 * Behavior on mobile (< lg):
 *   - At top of page: preview renders in NORMAL flow at full width (same
 *     as before MobilePip existed).
 *   - When the user scrolls past it, the preview snaps to a fixed PiP
 *     card in the top-right corner — small, draggable, persisted position.
 *
 * Detection: a 1px sentinel right above the preview. Once IntersectionObserver
 * reports the sentinel has left the top of the viewport, we'\''re in PiP mode.
 * That keeps the breadcrumb badges + full controls visible while the user is
 * actually looking at the preview, and only shrinks to PiP once it'\''s gone.
 *
 * On desktop (lg+) `lg:contents` flattens the wrapper entirely — no PiP,
 * preview lays out in the original grid.
 *
 * Liat: "שהמסך הזה יופיע לאחר המסך הראשי הגדול כשהוא נעלם! לא במקומו!"
 */

import { useEffect, useRef, useState } from "react";
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
  const cardRef = useRef<HTMLDivElement>(null);
  const [isPip, setIsPip] = useState(false);
  const [pos, setPos] = useState<Pos | null>(null);
  const dragRef = useRef<{ startX: number; startY: number; originX: number; originY: number } | null>(null);

  // Sentinel watcher: only enter PiP mode once the user has scrolled past
  // the natural preview position. rootMargin: "-1px 0 0 0" makes the
  // sentinel "leave" the viewport as soon as it crosses the top edge.
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      ([entry]) => { setIsPip(!entry.isIntersecting); },
      { rootMargin: "0px 0px 0px 0px", threshold: 0 },
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

  // The wrapper is ALWAYS in normal flow. When isPip is true on mobile,
  // we apply data-vm-pip on the wrapper so a CSS rule (in globals.css)
  // re-positions the inner card as fixed PiP + tightens the inner layout
  // (hides the breadcrumb badges row). Desktop is `lg:contents` so all of
  // this is a no-op.
  const cardStyle: React.CSSProperties = isPip && pos
    ? { position: "fixed", top: pos.y, left: pos.x, width: PIP_WIDTH, zIndex: 30 }
    : {};

  return (
    <>
      {/* 1px sentinel — its visibility tells us whether we'\''re scrolled past
          the natural preview spot. Stays in document flow on mobile only. */}
      <div ref={sentinelRef} aria-hidden className="lg:hidden h-px w-full -mt-px" />
      <div
        ref={cardRef}
        data-vm-pip={isPip ? "1" : "0"}
        onPointerDown={isPip ? onPointerDown : undefined}
        onPointerMove={isPip ? onPointerMove : undefined}
        onPointerUp={isPip ? onPointerUp : undefined}
        onPointerCancel={isPip ? onPointerUp : undefined}
        className={[
          // Desktop: this wrapper disappears, children render in the parent grid.
          "lg:contents",
          // Mobile, when in PiP mode only: card chrome.
          isPip ? "max-lg:rounded-xl max-lg:overflow-hidden max-lg:shadow-xl max-lg:shadow-black/60 max-lg:ring-1 max-lg:ring-white/15 max-lg:cursor-move max-lg:touch-none max-lg:select-none max-lg:bg-bg" : "",
        ].join(" ")}
        style={cardStyle}
      >
        {/* Drag handle bar — only when in PiP mode. */}
        {isPip && (
          <div className="hidden max-lg:flex items-center justify-center gap-1 h-5 bg-black/85 text-white/50 text-[10px]">
            <GripVertical className="w-3 h-3" />
            <span>גרירה</span>
          </div>
        )}
        {children}
      </div>
    </>
  );
}
