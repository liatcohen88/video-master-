"use client";

/**
 * Mobile picture-in-picture wrapper for the live VideoPreview.
 *
 * Liat: "בתצוגה החיה במובייל שיהיה למעלה צד ימין אבל כן ניתן לתזוזה...
 * אבל חשוב שכן יראה בלייב שינויים כמו הסרטון הרגיל!!"
 *
 * Strategy: ONE VideoPreview instance, wrapped here. On desktop (lg+) the
 * wrapper is `display: contents` so it visually disappears and the preview
 * lays out in the normal grid. On mobile it switches to `position: fixed`
 * with a constrained width (~140px) — the preview shrinks proportionally
 * and the existing reactivity (subtitle overlays, effects, currentTime)
 * keeps working as-is because it's the SAME React tree.
 *
 * Drag: pointer handlers on the entire card. The user can grab anywhere
 * and slide it; position is clamped to the viewport and persisted to
 * localStorage so it doesn't reset on refresh.
 */

import { useEffect, useRef, useState } from "react";
import { GripVertical } from "lucide-react";

const STORAGE_KEY = "vm_pip_pos_v1";
const PIP_WIDTH = 140;
const MARGIN = 8;
const DEFAULT_TOP = 64;       // below header
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
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<Pos | null>(null);
  const dragRef = useRef<{ startX: number; startY: number; originX: number; originY: number } | null>(null);

  // Initialize position from storage or default to top-right. Done in effect
  // so SSR doesn't try to read window/localStorage.
  useEffect(() => {
    const saved = readPos();
    if (saved) {
      setPos(saved);
    } else if (typeof window !== "undefined") {
      setPos({
        x: window.innerWidth - PIP_WIDTH - DEFAULT_RIGHT,
        y: DEFAULT_TOP,
      });
    }
  }, []);

  // Keep within viewport on resize.
  useEffect(() => {
    const onResize = () => {
      setPos((p) => {
        if (!p) return p;
        const el = ref.current;
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
    // Don't start a drag from the actual video controls — let the user
    // tap play/pause normally without snagging the card.
    const target = e.target as HTMLElement;
    if (target.closest("video, button, input, a")) return;
    dragRef.current = { startX: e.clientX, startY: e.clientY, originX: pos.x, originY: pos.y };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    e.preventDefault();
  }
  function onPointerMove(e: React.PointerEvent) {
    if (!dragRef.current) return;
    const d = dragRef.current;
    const el = ref.current;
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

  // Render approach:
  // - lg+ (desktop): use Tailwind `lg:contents` so this wrapper visually
  //   disappears and children lay out in the parent grid as before.
  // - mobile: fixed-position card with constrained width and drag handlers.
  // We pass position via inline style only when set; before mount the
  // style is empty (no CSS jump on first paint).
  const style: React.CSSProperties = pos
    ? { top: pos.y, left: pos.x, width: PIP_WIDTH }
    : { top: DEFAULT_TOP, right: DEFAULT_RIGHT, width: PIP_WIDTH };

  return (
    <div
      ref={ref}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      className={[
        // Mobile-only styles. lg:contents flattens the wrapper on desktop.
        "lg:contents",
        "max-lg:fixed max-lg:z-30 max-lg:touch-none max-lg:select-none",
        "max-lg:rounded-xl max-lg:overflow-hidden",
        "max-lg:shadow-xl max-lg:shadow-black/60 max-lg:ring-1 max-lg:ring-white/15",
        "max-lg:cursor-move",
      ].join(" ")}
      style={style}
    >
      {/* Small drag handle bar, visible on mobile only. Gives the user a
          clear "grab here" target without hiding video controls. */}
      <div className="hidden max-lg:flex items-center justify-center gap-1 h-5 bg-black/85 text-white/50 text-[10px]">
        <GripVertical className="w-3 h-3" />
        <span>גרירה</span>
      </div>
      {children}
    </div>
  );
}
