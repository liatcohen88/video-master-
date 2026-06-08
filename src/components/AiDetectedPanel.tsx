"use client";

import { useMemo, useState, useRef } from "react";
import { Eye, ImagePlus, Pencil, Volume2, VolumeX, X } from "lucide-react";
import type { Subtitle } from "@/lib/types";
import { detectElements } from "@/lib/keywordElements";
import { detectBrands, brandLogoCdnUrl } from "@/lib/brandLogos";
import { DEFAULT_SFX_FOR_KIND, getSfxAsset } from "@/lib/sfxLibrary";
import EmojiPicker from "./EmojiPicker";
import SfxPicker from "./SfxPicker";

type Props = {
  subtitles: Subtitle[];
  elementOverrides?: Record<string, string>;
  disabledElements?: string[];
  elementSfxOverrides?: Record<string, string>;
  onOverrideChange?: (key: string, emoji: string) => void;
  onDisable?: (key: string) => void;
  onSfxOverrideChange?: (key: string, sfxId: string | undefined) => void;
};

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
  onOverrideChange, onDisable, onSfxOverrideChange,
}: Props) {
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
            {brands.map((b, i) => (
              <div
                key={`${b.brand.id}-${i}`}
                className="flex items-center gap-2 bg-white rounded-lg px-2 py-1.5 shadow-md"
              >
                <img
                  src={brandLogoCdnUrl(b.brand)}
                  alt={b.brand.name}
                  width={20}
                  height={20}
                  style={{ width: 20, height: 20 }}
                />
                <span
                  className="text-xs font-bold"
                  style={{ color: `#${b.brand.color}` }}
                >
                  {b.brand.name}
                </span>
                <span className="text-[10px] text-black/40 font-mono">
                  {b.time.toFixed(1)}s
                </span>
              </div>
            ))}
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
                  {customEmoji && (
                    <span className="absolute -top-1 -right-1 bg-white text-black text-[8px] rounded-full w-3.5 h-3.5 flex items-center justify-center font-bold pointer-events-none">
                      ✓
                    </span>
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
