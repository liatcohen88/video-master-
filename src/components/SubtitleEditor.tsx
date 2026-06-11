"use client";

import { Pencil, Trash2, Plus, Sparkles, X, Volume2, VolumeX, Clock, Smile } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import type { Subtitle } from "@/lib/types";
import { detectElements } from "@/lib/keywordElements";
import { LOTTIE_ICONS } from "@/lib/lottieRegistry";
import { getSfxAsset } from "@/lib/sfxLibrary";
import EmojiPicker from "./EmojiPicker";
import ElementPicker, { type PickedElement } from "./ElementPicker";
import SfxPicker from "./SfxPicker";

const Lottie = dynamic(() => import("lottie-react"), { ssr: false });

type ManualEmojiPos =
  | "top-right" | "top-left" | "bottom-right" | "bottom-left" | "top-center";

const POSITION_LABEL: Record<ManualEmojiPos, string> = {
  "top-right": "↗",
  "top-left": "↖",
  "bottom-right": "↘",
  "bottom-left": "↙",
  "top-center": "↑",
};

type AutoElementOverride = {
  emoji?: string;
  position?: ManualEmojiPos;
  disabled?: boolean;
  sfxId?: string | undefined;       // "none" mutes; undefined resets to default
};

type Props = {
  subtitles: Subtitle[];
  onChange: (subs: Subtitle[]) => void;
  currentTime?: number;
  // Bridges to global effects state for auto-element overrides
  elementOverrides?: Record<string, string>;
  positionOverrides?: Record<string, ManualEmojiPos>;
  disabledElements?: string[];
  elementSfxOverrides?: Record<string, string>;
  onAutoElementChange?: (key: string, override: AutoElementOverride) => void;
  /** When false (e.g. "כתוביות בלבד" mode) emojis/icons are disabled entirely. */
  allowElements?: boolean;
};

function fmt(t: number) {
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  const ms = Math.floor((t - Math.floor(t)) * 100);
  return `${m}:${s.toString().padStart(2, "0")}.${ms.toString().padStart(2, "0")}`;
}

function elementKey(categoryId: string, time: number): string {
  return `${categoryId}-${Math.round(time * 10)}`;
}

const POSITION_CYCLE: ManualEmojiPos[] = [
  "top-right", "top-left", "top-center", "bottom-right", "bottom-left",
];

export default function SubtitleEditor({
  subtitles, onChange, currentTime = 0,
  elementOverrides = {}, positionOverrides = {}, disabledElements = [],
  elementSfxOverrides = {},
  onAutoElementChange,
  allowElements = true,
}: Props) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [pickerForSub, setPickerForSub] = useState<string | null>(null);
  const [pickerForAuto, setPickerForAuto] = useState<string | null>(null);
  const [sfxPickerFor, setSfxPickerFor] = useState<{ subId: string; idx: number } | null>(null);
  const [sfxPickerForAuto, setSfxPickerForAuto] = useState<string | null>(null);
  // SFX picker for a WHOLE subtitle (no emoji/Lottie required) — Liat
  // specifically asked for sound-only attachments via the subtitle row.
  const [sfxPickerForSub, setSfxPickerForSub] = useState<string | null>(null);
  const [sfxPickerAnchor, setSfxPickerAnchor] = useState<DOMRect | null>(null);
  const [pickerAnchor, setPickerAnchor] = useState<DOMRect | null>(null);
  const addBtnRefs = useRef<Map<string, HTMLButtonElement>>(new Map());

  const [lottieJsons, setLottieJsons] = useState<Record<string, unknown>>({});
  // Preload tiny lotties for thumbnails inside the editor when needed
  function ensureLottieLoaded(id: string) {
    if (lottieJsons[id]) return;
    const icon = LOTTIE_ICONS.find((i) => i.id === id);
    if (!icon) return;
    fetch(icon.jsonPath).then((r) => r.json())
      .then((j) => setLottieJsons((p) => ({ ...p, [id]: j }))).catch(() => {});
  }

  // Auto-detected elements globally (so dedup logic stays correct),
  // then grouped by subtitle for inline display.
  const elementsBySub = useMemo(() => {
    // In modes without elements (e.g. subtitles-only) skip auto-detection
    // entirely so no emojis/icons appear or get suggested.
    const all = allowElements ? detectElements(subtitles) : [];
    const map = new Map<string, { categoryId: string; emoji: string; defaultPos: ManualEmojiPos; matched: string; time: number; }[]>();
    for (const el of all) {
      const sub = subtitles.find(
        (s) => el.time >= s.start && el.time <= s.end + 0.01,
      );
      if (!sub) continue;
      const arr = map.get(sub.id) ?? [];
      arr.push({
        categoryId: el.category.id,
        emoji: el.category.emoji,
        defaultPos: el.category.position as ManualEmojiPos,
        matched: el.matchedText,
        time: el.time,
      });
      map.set(sub.id, arr);
    }
    return map;
  }, [subtitles]);

  const update = (id: string, patch: Partial<Subtitle>) => {
    onChange(subtitles.map((s) => {
      if (s.id !== id) return s;
      const next = { ...s, ...patch };
      if (patch.text !== undefined && patch.text !== s.text) {
        const tokens = patch.text.split(/\s+/).filter(Boolean);
        const dur = next.end - next.start;
        next.words = tokens.length === 0 ? [] : tokens.map((word, i) => ({
          word,
          start: next.start + (i / tokens.length) * dur,
          end: next.start + ((i + 1) / tokens.length) * dur,
        }));
      }
      return next;
    }));
  };
  const remove = (id: string) => onChange(subtitles.filter((s) => s.id !== id));
  const add = (afterIndex: number) => {
    const prev = subtitles[afterIndex];
    const next = subtitles[afterIndex + 1];
    const start = prev?.end ?? 0;
    const end = next?.start ?? start + 2;
    const newSub: Subtitle = {
      id: `sub-${Date.now()}`,
      start, end, text: "כתובית חדשה",
    };
    const copy = [...subtitles];
    copy.splice(afterIndex + 1, 0, newSub);
    onChange(copy);
  };

  // Manual element helpers (per-subtitle, stored in Subtitle.manualEmojis
  // — same field is reused for emoji + lottie via the optional lottieIconId)
  const addManualElement = (subId: string, el: PickedElement) => {
    const sub = subtitles.find((s) => s.id === subId);
    if (!sub) return;
    const current = sub.manualEmojis ?? [];
    const next = el.kind === "emoji"
      ? { emoji: el.emoji, position: "top-right" as const, durationSec: 0.9 }
      : { emoji: "", lottieIconId: el.iconId, color: el.color, position: "top-center" as const, durationSec: 2 };
    update(subId, { manualEmojis: [...current, next] });
  };
  const removeManualElement = (subId: string, index: number) => {
    const sub = subtitles.find((s) => s.id === subId);
    if (!sub?.manualEmojis) return;
    update(subId, { manualEmojis: sub.manualEmojis.filter((_, i) => i !== index) });
  };
  const updateManualElement = (subId: string, index: number, patch: Partial<NonNullable<Subtitle["manualEmojis"]>[number]>) => {
    const sub = subtitles.find((s) => s.id === subId);
    if (!sub?.manualEmojis) return;
    update(subId, {
      manualEmojis: sub.manualEmojis.map((e, i) => (i === index ? { ...e, ...patch } : e)),
    });
  };
  const cycleManualPos = (subId: string, index: number) => {
    const sub = subtitles.find((s) => s.id === subId);
    if (!sub?.manualEmojis) return;
    const cur = sub.manualEmojis[index].position;
    const nextPos = POSITION_CYCLE[(POSITION_CYCLE.indexOf(cur) + 1) % POSITION_CYCLE.length];
    updateManualElement(subId, index, { position: nextPos });
  };

  // Auto element helpers (effects.elementOverrides + positionOverrides + disabledElements)
  const disableAuto = (key: string) => {
    onAutoElementChange?.(key, { disabled: true });
  };
  const cycleAutoPos = (key: string, currentPos: ManualEmojiPos) => {
    const next = POSITION_CYCLE[(POSITION_CYCLE.indexOf(currentPos) + 1) % POSITION_CYCLE.length];
    onAutoElementChange?.(key, { position: next });
  };
  const changeAutoEmoji = (key: string, emoji: string) => {
    onAutoElementChange?.(key, { emoji });
  };

  return (
    <details className="bg-bg-panel border border-white/10 rounded-2xl overflow-hidden group">
      <summary className="p-4 border-b border-white/10 flex items-center justify-between cursor-pointer select-none list-none hover:bg-white/[0.02]">
        <div className="min-w-0">
          <h3 className="text-lg font-bold flex items-center gap-2">
            <span className="text-white/40 group-open:rotate-90 transition-transform inline-block">›</span>
            עריכת כתוביות
          </h3>
          <p className="text-[11px] text-white/40 mt-0.5 mr-6">
            {allowElements
              ? "פותחים כדי לערוך טקסט, ולהוסיף אמוג'ים, אלמנטים, סאונדים ומיקום צדדים לכל שורה"
              : "פותחים כדי לערוך את הטקסט והתזמון של כל שורה"}
          </p>
        </div>
        <span className="text-xs text-white/40 shrink-0">{subtitles.length} כתוביות</span>
      </summary>

      <div className="max-h-[500px] overflow-y-auto divide-y divide-white/5">
        {subtitles.length === 0 && (
          <div className="p-8 text-center text-white/40 text-sm">
            עוד אין כתוביות. העלי וידאו ותמללי כדי להתחיל.
          </div>
        )}

        {subtitles.map((sub, idx) => {
          const isActive = currentTime >= sub.start && currentTime <= sub.end;
          const isEditing = editingId === sub.id;
          const autoElements = elementsBySub.get(sub.id) ?? [];

          return (
            <div
              key={sub.id}
              className={`p-3 transition-colors ${isActive ? "bg-brand/10" : "hover:bg-white/[0.02]"}`}
            >
              <div className="flex items-center gap-2 mb-2">
                <div className="text-xs font-mono text-white/40">
                  <span>{fmt(sub.start)}</span>
                  <span className="mx-1">←</span>
                  <span>{fmt(sub.end)}</span>
                </div>
                <div className="flex-1" />
                {/* SFX-only button (no Lottie needed) — Liat liked the original
                    icon-only design. Don't change. */}
                <button
                  onClick={(e) => {
                    setSfxPickerForSub(sub.id);
                    setSfxPickerAnchor(e.currentTarget.getBoundingClientRect());
                  }}
                  className={`p-1.5 rounded-md ${
                    sub.sfxId && sub.sfxId !== "none"
                      ? "bg-cyan-500/15 text-cyan-300 hover:bg-cyan-500/25"
                      : "hover:bg-white/10 text-white/60 hover:text-white"
                  }`}
                  title={sub.sfxId === "none" ? "צליל מבוטל"
                    : sub.sfxId ? `צליל: ${getSfxAsset(sub.sfxId)?.label ?? sub.sfxId}`
                    : "הוסף סאונד אפקט"}
                >
                  {sub.sfxId && sub.sfxId !== "none"
                    ? <Volume2 className="w-3.5 h-3.5" />
                    : <VolumeX className="w-3.5 h-3.5" />}
                </button>
                {allowElements && (
                  <button
                    ref={(el) => { if (el) addBtnRefs.current.set(sub.id, el); }}
                    onClick={(e) => {
                      setPickerForSub(sub.id);
                      setPickerAnchor(e.currentTarget.getBoundingClientRect());
                    }}
                    className="p-1.5 hover:bg-fuchsia-500/20 rounded-md text-white/60 hover:text-fuchsia-300"
                    title="הוסף אמוג'י לכתובית"
                  >
                    <Smile className="w-3.5 h-3.5" />
                  </button>
                )}
                <button
                  onClick={() => setEditingId(isEditing ? null : sub.id)}
                  className="p-1.5 hover:bg-white/10 rounded-md text-white/60 hover:text-white"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => remove(sub.id)}
                  className="p-1.5 hover:bg-red-500/20 rounded-md text-white/60 hover:text-red-400"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>

              {isEditing ? (
                <textarea
                  autoFocus
                  value={sub.text}
                  onChange={(e) => update(sub.id, { text: e.target.value })}
                  onBlur={() => setEditingId(null)}
                  className="w-full bg-bg-input border border-brand/50 rounded-lg p-2 text-sm resize-none"
                  rows={2}
                />
              ) : (
                <div
                  onClick={() => setEditingId(sub.id)}
                  className="text-sm cursor-text leading-relaxed"
                >
                  {sub.text}
                </div>
              )}

              {/* Auto-detected emojis for this subtitle */}
              {autoElements.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {autoElements.map((el) => {
                    const key = elementKey(el.categoryId, el.time);
                    if (disabledElements.includes(key)) return null;
                    const displayEmoji = elementOverrides[key] ?? el.emoji;
                    const pos = positionOverrides[key] ?? el.defaultPos;
                    return (
                      <div
                        key={key}
                        className="flex items-center bg-cyan-500/10 border border-dashed border-cyan-400/40 rounded-md text-[11px]"
                        title={`זוהה אוטומטית: ${el.matched}`}
                      >
                        <button
                          onClick={() => cycleAutoPos(key, pos)}
                          className="px-1.5 py-1 text-cyan-200/70 hover:text-cyan-100 text-sm"
                          title="שינוי מיקום"
                        >
                          {POSITION_LABEL[pos]}
                        </button>
                        <button
                          onClick={(e) => {
                            setPickerForAuto(key);
                            setPickerAnchor(e.currentTarget.getBoundingClientRect());
                          }}
                          className="text-base px-1 hover:scale-110 transition-transform"
                          title="לחיצה לשינוי emoji"
                        >
                          {displayEmoji}
                        </button>
                        <span className="text-[10px] text-cyan-200/50 px-1">
                          {el.matched}
                        </span>
                        <button
                          onClick={(ev) => {
                            setSfxPickerForAuto(key);
                            setPickerAnchor(ev.currentTarget.getBoundingClientRect());
                          }}
                          className="px-1 py-1 border-r border-cyan-400/20 text-cyan-200/70 hover:text-white hover:bg-white/10"
                          title="צליל SFX"
                        >
                          {elementSfxOverrides[key] === "none"
                            ? <VolumeX className="w-2.5 h-2.5" />
                            : <Volume2 className="w-2.5 h-2.5" />}
                        </button>
                        <button
                          onClick={() => disableAuto(key)}
                          className="px-1 py-1 text-cyan-300/60 hover:text-red-300"
                          title="ביטול האמוג'י הזה"
                        >
                          <X className="w-2.5 h-2.5" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Manual elements (emoji + lottie) attached to this subtitle */}
              {sub.manualEmojis && sub.manualEmojis.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {sub.manualEmojis.map((me, mIdx) => {
                    const isLottie = !!me.lottieIconId;
                    if (isLottie) ensureLottieLoaded(me.lottieIconId!);
                    const sfxLabel = me.sfxId === "none" ? "ללא צליל"
                      : me.sfxId ? (getSfxAsset(me.sfxId)?.label ?? me.sfxId)
                      : "ללא צליל";
                    return (
                      <div key={mIdx}
                        className={`flex items-center rounded-md text-[11px] border
                          ${isLottie ? "bg-violet-500/15 border-violet-400/30" : "bg-fuchsia-500/15 border-fuchsia-400/30"}`}>
                        <button
                          onClick={() => cycleManualPos(sub.id, mIdx)}
                          className="px-1.5 py-1 text-white/70 hover:text-white text-sm"
                          title="שינוי מיקום"
                        >
                          {POSITION_LABEL[me.position]}
                        </button>
                        <div className="px-1 flex items-center" style={{ minWidth: 22 }}>
                          {isLottie ? (
                            lottieJsons[me.lottieIconId!] ? (
                              <div className="w-5 h-5">
                                <Lottie animationData={lottieJsons[me.lottieIconId!] as object} loop
                                  style={{ width: "100%", height: "100%" }} />
                              </div>
                            ) : <span className="text-base">✨</span>
                          ) : (
                            <span className="text-base">{me.emoji}</span>
                          )}
                        </div>
                        {/* Duration */}
                        <div className="flex items-center gap-0.5 px-1 border-r border-white/10">
                          <Clock className="w-2.5 h-2.5 text-white/40" />
                          <input
                            type="number" min={0.3} step={0.1}
                            value={me.durationSec ?? (isLottie ? 2 : 0.9)}
                            onChange={(e) => updateManualElement(sub.id, mIdx, { durationSec: parseFloat(e.target.value) || 1 })}
                            className="w-9 bg-transparent text-[10px] text-center text-white/80 focus:outline-none"
                            title="משך בשניות"
                          />
                          <span className="text-[9px] text-white/30">ש'</span>
                        </div>
                        {/* Color picker — Lottie only (emoji is full-color, can't tint) */}
                        {isLottie && (
                          <label
                            className="px-1 py-1 border-r border-white/10 hover:bg-white/10 cursor-pointer relative"
                            title={`צבע: ${me.color ?? "ברירת מחדל"}`}
                          >
                            <span
                              className="block w-3.5 h-3.5 rounded-full border border-white/30"
                              style={{ background: me.color ?? "#FACC15" }}
                            />
                            <input
                              type="color"
                              value={me.color ?? "#FACC15"}
                              onChange={(e) => updateManualElement(sub.id, mIdx, { color: e.target.value })}
                              className="absolute inset-0 opacity-0 cursor-pointer"
                            />
                          </label>
                        )}
                        {/* SFX */}
                        <button
                          onClick={(ev) => {
                            setSfxPickerFor({ subId: sub.id, idx: mIdx });
                            setPickerAnchor(ev.currentTarget.getBoundingClientRect());
                          }}
                          className="px-1.5 py-1 border-r border-white/10 hover:bg-white/10"
                          title={`צליל: ${sfxLabel}`}
                        >
                          {me.sfxId && me.sfxId !== "none"
                            ? <Volume2 className="w-3 h-3 text-brand-light" />
                            : <VolumeX className="w-3 h-3 text-white/40" />}
                        </button>
                        <button
                          onClick={() => removeManualElement(sub.id, mIdx)}
                          className="px-1 py-1 text-white/50 hover:text-red-300"
                          title="הסר"
                        >
                          <X className="w-2.5 h-2.5" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}

              <button
                onClick={() => add(idx)}
                className="mt-2 w-full flex items-center justify-center gap-1 text-xs text-white/30 hover:text-brand-light border border-dashed border-white/10 hover:border-brand/50 rounded-md py-1 transition-colors"
              >
                <Plus className="w-3 h-3" />
                הוסף כתובית
              </button>
            </div>
          );
        })}
      </div>

      {pickerForSub && (
        <ElementPicker
          open={true}
          onSelect={(el) => addManualElement(pickerForSub, el)}
          onClose={() => setPickerForSub(null)}
          anchorRect={pickerAnchor}
        />
      )}

      {pickerForAuto && (
        <EmojiPicker
          open={true}
          currentEmoji={elementOverrides[pickerForAuto] ?? ""}
          onSelect={(emoji) => changeAutoEmoji(pickerForAuto, emoji)}
          onClose={() => setPickerForAuto(null)}
          anchorRect={pickerAnchor}
        />
      )}

      {sfxPickerFor && (() => {
        const sub = subtitles.find((s) => s.id === sfxPickerFor.subId);
        const current = sub?.manualEmojis?.[sfxPickerFor.idx]?.sfxId;
        return (
          <SfxPicker
            open={true}
            currentSfxId={current}
            defaultLabel="ללא צליל"
            onSelect={(id) => updateManualElement(sfxPickerFor.subId, sfxPickerFor.idx, { sfxId: id })}
            onClose={() => setSfxPickerFor(null)}
            anchorRect={pickerAnchor}
          />
        );
      })()}

      {sfxPickerForAuto && (
        <SfxPicker
          open={true}
          currentSfxId={elementSfxOverrides[sfxPickerForAuto]}
          defaultLabel="ברירת מחדל"
          onSelect={(id) => onAutoElementChange?.(sfxPickerForAuto, { sfxId: id })}
          onClose={() => setSfxPickerForAuto(null)}
          anchorRect={pickerAnchor}
        />
      )}

      {sfxPickerForSub && (() => {
        const sub = subtitles.find((s) => s.id === sfxPickerForSub);
        return (
          <SfxPicker
            open={true}
            currentSfxId={sub?.sfxId}
            defaultLabel="ללא צליל"
            onSelect={(id) => update(sfxPickerForSub, { sfxId: id })}
            onClose={() => setSfxPickerForSub(null)}
            anchorRect={sfxPickerAnchor}
          />
        );
      })()}
    </details>
  );
}
