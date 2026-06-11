"use client";

import { useEffect, useMemo, useState, useRef } from "react";
import { Eye, ImagePlus, Pencil, Volume2, VolumeX, X } from "lucide-react";
import type { Subtitle } from "@/lib/types";
import { detectElements } from "@/lib/keywordElements";
import { detectBrands, brandLogoCdnUrl } from "@/lib/brandLogos";
import { DEFAULT_SFX_FOR_KIND, getSfxAsset } from "@/lib/sfxLibrary";
import EmojiPicker from "./EmojiPicker";
import SfxPicker from "./SfxPicker";

type PosId = "top-right" | "top-left" | "bottom-right" | "bottom-left" | "top-center" | "bottom-center";

type Props = {
  subtitles: Subtitle[];
  elementOverrides?: Record<string, string>;
  disabledElements?: string[];
  elementSfxOverrides?: Record<string, string>;
  /** Per-element px size + position overrides — Liat wants every auto-detected
   *  element treated like a manual emoji (tap to resize, reposition). */
  elementSizePx?: Record<string, number>;
  elementPosition?: Record<string, PosId>;
  brandSizePx?: Record<string, number>;
  brandPosition?: Record<string, PosId>;
  onOverrideChange?: (key: string, emoji: string) => void;
  onDisable?: (key: string) => void;
  onSfxOverrideChange?: (key: string, sfxId: string | undefined) => void;
  onElementSizeChange?: (key: string, px: number | undefined) => void;
  onElementPositionChange?: (key: string, pos: PosId | undefined) => void;
  onBrandSizeChange?: (key: string, px: number | undefined) => void;
  onBrandPositionChange?: (key: string, pos: PosId | undefined) => void;
};

/** Key for a brand occurrence (matches what VideoPreview / exportCompositor use). */
function brandKey(brandId: string, time: number): string {
  return `${brandId}-${Math.round(time * 10)}`;
}

const POSITIONS: { id: PosId; icon: string; title: string }[] = [
  { id: "top-left",      icon: "↖", title: "שמאל למעלה" },
  { id: "top-center",    icon: "↑", title: "מרכז למעלה" },
  { id: "top-right",     icon: "↗", title: "ימין למעלה" },
  { id: "bottom-left",   icon: "↙", title: "שמאל למטה" },
  { id: "bottom-center", icon: "↓", title: "מרכז למטה" },
  { id: "bottom-right",  icon: "↘", title: "ימין למטה" },
];

/** Stable key for an element event = category + rounded time */
export function elementKey(categoryId: string, time: number): string {
  return `${categoryId}-${Math.round(time * 10)}`;
}

/**
 * Live "AI detected" panel — shows which brand logos and keyword emojis
 * the AI matched in the subtitles. Updates as subtitles are edited.
 *
 * Clicking an emoji opens a picker so the user can swap "⚡" for "💎" etc.
 */
export default function AiDetectedPanel({
  subtitles, elementOverrides = {}, disabledElements = [],
  elementSfxOverrides = {},
  elementSizePx = {}, elementPosition = {},
  brandSizePx = {}, brandPosition = {},
  onOverrideChange, onDisable, onSfxOverrideChange,
  onElementSizeChange, onElementPositionChange,
  onBrandSizeChange, onBrandPositionChange,
}: Props) {
  // Which chip currently has its inline edit popover open. Single instance
  // means selecting one auto-closes the previous — no confusion about which
  // size/position you're editing.
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const allElements = useMemo(() => detectElements(subtitles), [subtitles]);
  const elements = useMemo(
    () => allElements.filter(
      (e) => !disabledElements.includes(elementKey(e.category.id, e.time)),
    ),
    [allElements, disabledElements],
  );
  const brands = useMemo(() => detectBrands(subtitles), [subtitles]);

  const [pickerOpen, setPickerOpen] = useState<string | null>(null);
  const [sfxPickerOpen, setSfxPickerOpen] = useState<string | null>(null);
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null);
  const buttonRefs = useRef<Map<string, HTMLButtonElement>>(new Map());

  // Debug: which subtitles contain mentions of known brand keywords?
  // Useful when the user says "I said Instagram" but no logo appeared.
  const brandTextScan = useMemo(() => {
    if (brands.length > 0) return null; // skip when detection worked
    const heHints = [
      "אינסטה", "אינסטגרם", "אלי", "טיקטוק", "גוגל",
      "יוטיוב", "אפל", "פייסבוק", "אמזון", "טסלה",
    ];
    const enHints = [
      "ali", "insta", "tik", "google", "youtube",
      "apple", "facebook", "amazon", "tesla", "netflix",
    ];
    const samples: string[] = [];
    for (const sub of subtitles) {
      if (samples.length >= 3) break;
      const lower = sub.text.toLowerCase();
      const hit =
        heHints.some((h) => sub.text.includes(h)) ||
        enHints.some((h) => lower.includes(h));
      if (hit) samples.push(sub.text);
    }
    return samples;
  }, [subtitles, brands.length]);

  if (elements.length === 0 && brands.length === 0 && !brandTextScan?.length) {
    return null;
  }

  function openPicker(key: string, btn: HTMLButtonElement) {
    setPickerOpen(key);
    setAnchorRect(btn.getBoundingClientRect());
  }

  return (
    <div className="bg-gradient-to-br from-bg-card via-bg-panel to-bg-card border border-white/10 rounded-2xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <div className="p-1.5 rounded-lg bg-brand/20">
          <Eye className="w-4 h-4 text-brand-light" />
        </div>
        <h3 className="text-sm font-bold flex-1">
          AI זיהה ({elements.length + brands.length} פריטים)
        </h3>
      </div>

      {brands.length > 0 && (
        <div className="mb-3">
          <div className="text-[11px] uppercase tracking-wider text-white/40 font-semibold mb-2">
            🏷️ לוגואי מותגים
          </div>
          <div className="flex flex-wrap gap-2">
            {brands.map((b, i) => {
              const bKey = brandKey(b.brand.id, b.time);
              const editing = editingKey === `brand:${bKey}`;
              const curPx = brandSizePx[bKey];
              const curPos = brandPosition[bKey] ?? "top-right";
              return (
                <div key={`${b.brand.id}-${i}`} className="relative">
                  <button
                    onClick={() => setEditingKey(editing ? null : `brand:${bKey}`)}
                    className={`flex items-center gap-2 bg-white rounded-lg px-2 py-1.5 shadow-md hover:ring-2 hover:ring-brand/40 transition ${
                      editing ? "ring-2 ring-brand" : ""
                    }`}
                    title="לחיצה לעריכת גודל ומיקום"
                  >
                    <img src={brandLogoCdnUrl(b.brand)} alt={b.brand.name}
                      width={20} height={20} style={{ width: 20, height: 20 }} />
                    <span className="text-xs font-bold" style={{ color: `#${b.brand.color}` }}>
                      {b.brand.name}
                    </span>
                    <span className="text-[10px] text-black/40 font-mono">{b.time.toFixed(1)}s</span>
                    {(curPx || brandPosition[bKey]) && (
                      <span className="text-[9px] text-brand-dark/70 bg-brand/15 rounded-sm px-1">
                        {curPx ? `${curPx}px` : "✓"}
                      </span>
                    )}
                  </button>
                  {editing && (
                    <ElementEditorPopover
                      onClose={() => setEditingKey(null)}
                      sizePx={curPx}
                      position={curPos}
                      onSize={(px) => onBrandSizeChange?.(bKey, px)}
                      onPosition={(p) => onBrandPositionChange?.(bKey, p)}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Debug: when brand detection comes up empty but brand-looking words
          appear in the transcript, show them so the user can see the actual
          spelling Whisper produced */}
      {brands.length === 0 && brandTextScan && brandTextScan.length > 0 && (
        <div className="mb-3 p-2.5 bg-amber-500/10 border border-amber-500/20 rounded-lg">
          <div className="text-[11px] text-amber-200 font-bold mb-1">
            🔍 זיהיתי שמות מותג בכתוביות אבל לא הצלחתי להתאים ללוגו:
          </div>
          {brandTextScan.map((t, i) => (
            <div key={i} className="text-[11px] text-amber-100/70 mt-0.5 italic">
              &ldquo;{t}&rdquo;
            </div>
          ))}
          <div className="text-[10px] text-amber-200/60 mt-1.5">
            ערכי את הכתוביות אם השם נכתב אחרת ממה שאמרת.
          </div>
        </div>
      )}

      {elements.length > 0 && (
        <div>
          <div className="text-[11px] uppercase tracking-wider text-white/40 font-semibold mb-2 flex items-center gap-1">
            <ImagePlus className="w-3 h-3" />
            אלמנטים לפי מילים
            <span className="text-white/30 mr-1 normal-case tracking-normal">
              · לחיצה לשינוי
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {elements.map((e, i) => {
              const key = elementKey(e.category.id, e.time);
              const customEmoji = elementOverrides[key];
              const displayEmoji = customEmoji ?? e.category.emoji;

              return (
                <div
                  key={`${e.category.id}-${i}`}
                  className={`
                    relative flex items-center bg-gradient-to-br ${e.category.previewBg}
                    rounded-lg shadow-md overflow-hidden
                  `}
                >
                  <button
                    ref={(el) => { if (el) buttonRefs.current.set(key, el); }}
                    onClick={(ev) => onOverrideChange && openPicker(key, ev.currentTarget)}
                    disabled={!onOverrideChange}
                    className={`
                      flex items-center gap-1.5 px-2 py-1.5
                      ${onOverrideChange ? "hover:bg-white/10 cursor-pointer" : ""}
                    `}
                    title="לחיצה לשינוי emoji"
                  >
                    <span className="text-lg leading-none">{displayEmoji}</span>
                    <span className="text-xs font-medium text-white whitespace-nowrap">
                      {e.matchedText}
                    </span>
                    <span className="text-[10px] text-white/60 font-mono">
                      {e.time.toFixed(1)}s
                    </span>
                    {onOverrideChange && (
                      <Pencil className="w-2.5 h-2.5 text-white/60 ml-0.5" />
                    )}
                  </button>
                  {onSfxOverrideChange && (
                    <button
                      onClick={(ev) => {
                        setSfxPickerOpen(key);
                        setAnchorRect(ev.currentTarget.getBoundingClientRect());
                      }}
                      className="px-1.5 py-1.5 hover:bg-white/20 text-white/70 hover:text-white border-l border-white/10"
                      title="החלפת צליל SFX"
                    >
                      {elementSfxOverrides[key] === "none"
                        ? <VolumeX className="w-3 h-3" />
                        : <Volume2 className="w-3 h-3" />}
                    </button>
                  )}
                  {onDisable && (
                    <button
                      onClick={() => onDisable(key)}
                      className="px-1.5 py-1.5 hover:bg-red-500/40 text-white/70 hover:text-white border-l border-white/10"
                      title="מחיקת האמוג'י לגמרי"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                  {/* Size + position controls — opens a popover under the
                      chip with px input and 6 corner buttons. Same UX as
                      brand chips below. */}
                  {(onElementSizeChange || onElementPositionChange) && (
                    <button
                      onClick={() => setEditingKey(editingKey === `el:${key}` ? null : `el:${key}`)}
                      className={`px-1.5 py-1.5 hover:bg-white/20 text-white/70 hover:text-white border-l border-white/10 ${
                        editingKey === `el:${key}` ? "bg-white/20 text-white" : ""
                      }`}
                      title="גודל ומיקום"
                    >
                      <span className="text-[9px] font-mono">{elementSizePx[key] ?? "px"}</span>
                    </button>
                  )}
                  {customEmoji && (
                    <span className="absolute -top-1 -right-1 bg-white text-black text-[8px] rounded-full w-3.5 h-3.5 flex items-center justify-center font-bold pointer-events-none">
                      ✓
                    </span>
                  )}
                  {editingKey === `el:${key}` && (
                    <ElementEditorPopover
                      onClose={() => setEditingKey(null)}
                      sizePx={elementSizePx[key]}
                      position={elementPosition[key] ?? "top-right"}
                      onSize={(px) => onElementSizeChange?.(key, px)}
                      onPosition={(p) => onElementPositionChange?.(key, p)}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {sfxPickerOpen && onSfxOverrideChange && (() => {
        const ev = elements.find(
          (e) => elementKey(e.category.id, e.time) === sfxPickerOpen,
        );
        const defaultId = ev ? DEFAULT_SFX_FOR_KIND[ev.category.sfx] : undefined;
        const defaultAsset = defaultId ? getSfxAsset(defaultId) : null;
        return (
          <SfxPicker
            open={true}
            currentSfxId={elementSfxOverrides[sfxPickerOpen]}
            defaultLabel={
              defaultAsset ? `ברירת מחדל (${defaultAsset.label})` : "ברירת מחדל"
            }
            onSelect={(id) => onSfxOverrideChange(sfxPickerOpen, id)}
            onClose={() => setSfxPickerOpen(null)}
            anchorRect={anchorRect}
          />
        );
      })()}

      {pickerOpen && onOverrideChange && (
        <EmojiPicker
          open={true}
          currentEmoji={
            elementOverrides[pickerOpen] ??
            elements.find((e) => elementKey(e.category.id, e.time) === pickerOpen)?.category.emoji ??
            ""
          }
          onSelect={(emoji) => onOverrideChange(pickerOpen, emoji)}
          onClose={() => setPickerOpen(null)}
          anchorRect={anchorRect}
        />
      )}
    </div>
  );
}

/** Inline popover under an auto-detected chip — px size + 6 corner buttons.
 *  Lives in absolute position so it floats over the layout without pushing
 *  other chips around. Click anywhere outside closes via the parent's
 *  setEditingKey(null) wired by the chip itself, but we also catch a
 *  global click here for safety. */
function ElementEditorPopover({
  onClose, sizePx, position, onSize, onPosition,
}: {
  onClose: () => void;
  sizePx?: number;
  position: PosId;
  onSize: (px: number | undefined) => void;
  onPosition: (p: PosId | undefined) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    // Defer so the click that opened us doesn't immediately close us.
    const id = window.setTimeout(() => document.addEventListener("mousedown", onClick), 0);
    return () => {
      window.clearTimeout(id);
      document.removeEventListener("mousedown", onClick);
    };
  }, [onClose]);

  return (
    <div
      ref={ref}
      className="absolute top-full mt-2 right-0 z-40 bg-bg-card border border-white/15 rounded-xl shadow-2xl shadow-black/60 p-3 min-w-[220px]"
      dir="rtl"
    >
      <div className="text-[10px] text-white/40 mb-1">גודל (PX)</div>
      <div className="flex items-center gap-1 mb-3">
        <input
          type="number" min={12} max={512} step={1} placeholder="auto"
          value={typeof sizePx === "number" ? sizePx : ""}
          onChange={(e) => {
            const raw = e.target.value;
            onSize(raw === "" ? undefined : Math.max(12, parseInt(raw, 10) || 0));
          }}
          className="flex-1 bg-bg-input border border-white/10 rounded px-2 py-1.5 text-sm font-mono text-center text-white focus:outline-none focus:border-brand/50"
        />
        <span className="text-[10px] text-white/40">PX</span>
        {typeof sizePx === "number" && (
          <button onClick={() => onSize(undefined)}
            className="text-[10px] text-white/50 hover:text-white px-1.5"
            title="ברירת מחדל">
            ✕
          </button>
        )}
      </div>
      <div className="text-[10px] text-white/40 mb-1">מיקום</div>
      <div className="grid grid-cols-3 gap-1">
        {POSITIONS.map((p) => (
          <button
            key={p.id}
            onClick={() => onPosition(p.id)}
            className={`py-1.5 rounded text-sm border transition-colors ${
              position === p.id
                ? "border-brand bg-brand/25 text-white"
                : "border-white/10 bg-bg-input text-white/50 hover:border-white/30"
            }`}
            title={p.title}
          >
            {p.icon}
          </button>
        ))}
      </div>
      <button onClick={onClose}
        className="w-full mt-3 text-[10px] text-white/40 hover:text-white py-1">
        סגור
      </button>
    </div>
  );
}
