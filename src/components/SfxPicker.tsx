"use client";

import { useEffect, useRef, useState } from "react";
import { Volume2, VolumeX, Play, Search } from "lucide-react";
import { listSfxByCategory, getSfxAsset, SFX_CATEGORY_LABEL } from "@/lib/sfxLibrary";
import { playSfxCapped, type CappedPlayHandle } from "@/lib/playSfxCapped";
import { useContent } from "@/lib/useContent";

type Props = {
  open: boolean;
  /** Currently-selected sfx id ("none" = muted, undefined = default) */
  currentSfxId?: string;
  /** Label shown in the default option (e.g. "ברירת מחדל (whoosh)") */
  defaultLabel?: string;
  onSelect: (sfxId: string | undefined) => void;
  onClose: () => void;
  anchorRect?: DOMRect | null;
};


export default function SfxPicker({
  open, currentSfxId, defaultLabel, onSelect, onClose, anchorRect,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const handleRef = useRef<CappedPlayHandle | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const labelOverrides = useContent("sfx.labels");
  const hiddenSfx = useContent("sfx.hidden") as Record<string, true>;
  const categoryOrder = useContent("sfx.categoryOrder") as string[];
  const customCategories = useContent("sfx.customCategories") as Array<{ id: string; label: string }>;
  const categoryLabels = useContent("sfx.categoryLabels") as Record<string, string>;
  // Per-SFX category moves Liat sets in admin (e.g. takes "Sound Effect #5"
  // out of "clicks" and into "notifications"). Was missing here, so the
  // picker showed sounds in their ORIGINAL category regardless of moves.
  const categoryOverrides = useContent("sfx.categoryOverrides") as Record<string, string>;
  const labelFor = (id: string, fallback: string) => labelOverrides[id] ?? fallback;
  const catTitle = (c: string) => {
    if (categoryLabels?.[c]) return categoryLabels[c];
    const custom = customCategories?.find((x) => x.id === c);
    if (custom) return custom.label;
    return SFX_CATEGORY_LABEL[c as keyof typeof SFX_CATEGORY_LABEL] ?? c;
  };
  // Reset search whenever the picker re-opens so it's never sticky.
  useEffect(() => { if (!open) setQuery(""); }, [open]);
  // Hebrew/English substring match over the displayed label. We compare in
  // lowercase + trim so partial words like "ציוץ" match "ציוץ ציפור".
  function matches(label: string): boolean {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return label.toLowerCase().includes(q);
  }

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    function handleEsc(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleEsc);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleEsc);
    };
  }, [open, onClose]);

  // Stop any audio when the picker closes
  useEffect(() => {
    if (!open && audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
      setPlayingId(null);
    }
  }, [open]);

  if (!open) return null;

  const style: React.CSSProperties = {};
  if (anchorRect) {
    style.position = "fixed";
    style.top = `${Math.min(anchorRect.bottom + 8, window.innerHeight - 460)}px`;
    style.left = `${Math.max(8, Math.min(anchorRect.left - 80, window.innerWidth - 340))}px`;
    style.zIndex = 100;
  }

  function play(id: string) {
    if (handleRef.current) handleRef.current.stop();
    const url = getSfxAsset(id)?.url;
    if (!url) return;
    const h = playSfxCapped(url, 0.7);
    h.audio.addEventListener("ended", () => setPlayingId((p) => (p === id ? null : p)), { once: true });
    handleRef.current = h;
    setPlayingId(id);
  }

  const groups = listSfxByCategory({
    order: categoryOrder,
    customCategoryIds: (customCategories ?? []).map((c) => c.id),
    categoryOverrides: categoryOverrides ?? {},
  });

  const currentLabel =
    currentSfxId === "none"
      ? "ללא צליל"
      : currentSfxId
        ? labelFor(currentSfxId, getSfxAsset(currentSfxId)?.label ?? currentSfxId)
        : (defaultLabel ?? "ברירת מחדל");

  return (
    <div
      ref={ref}
      style={style}
      className="bg-bg-card border border-white/15 rounded-2xl shadow-2xl shadow-black/60 p-3 w-[330px] max-h-[460px] overflow-y-auto"
      dir="rtl"
    >
      <div className="text-xs text-white/40 mb-2 text-center">
        בחרי צליל (נוכחי: <span className="text-white/70">{currentLabel}</span>)
      </div>

      {/* Search */}
      <div className="relative mb-3">
        <Search className="w-3.5 h-3.5 absolute right-2.5 top-1/2 -translate-y-1/2 text-white/40 pointer-events-none" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="חיפוש צליל (למשל: ציוץ, פיצוץ, מעבר)..."
          className="w-full bg-white/5 border border-white/10 rounded-md text-xs px-3 py-1.5 pr-8 placeholder-white/30 focus:outline-none focus:border-white/30"
          dir="rtl"
          autoFocus
        />
      </div>

      {/* Default + mute */}
      <div className="flex gap-1.5 mb-3">
        <button
          onClick={() => { onSelect(undefined); onClose(); }}
          className={`flex-1 px-2 py-1.5 rounded-md text-xs font-medium border
            ${currentSfxId === undefined ? "bg-brand/30 border-brand text-white" : "bg-white/5 border-white/10 text-white/70 hover:bg-white/10"}`}
        >
          {defaultLabel ?? "ברירת מחדל"}
        </button>
        <button
          onClick={() => { onSelect("none"); onClose(); }}
          className={`flex-1 px-2 py-1.5 rounded-md text-xs font-medium border flex items-center justify-center gap-1
            ${currentSfxId === "none" ? "bg-red-500/30 border-red-400 text-white" : "bg-white/5 border-white/10 text-white/70 hover:bg-white/10"}`}
        >
          <VolumeX className="w-3 h-3" /> ללא צליל
        </button>
      </div>

      {(() => {
        const filtered = groups
          .map((g) => ({
            ...g,
            items: g.items
              // Admin-hidden SFX never appear in the picker.
              .filter((a) => !hiddenSfx?.[a.id])
              .filter((a) => matches(labelFor(a.id, a.label))
                || matches(catTitle(g.category))),
          }))
          .filter((g) => g.items.length > 0);
        if (filtered.length === 0) {
          return (
            <div className="text-center text-xs text-white/40 py-6">
              לא נמצאו צלילים ל-״{query}״
              <div className="text-[10px] text-white/30 mt-1">תוכלי לעדכן שמות צלילים ב-/admin → SFX</div>
            </div>
          );
        }
        return filtered.map((g) => (
        <div key={g.category} className="mb-3">
          <div className="text-[10px] uppercase tracking-wider text-white/30 mb-1 px-1">
            {catTitle(g.category)}
          </div>
          <div className="grid grid-cols-1 gap-1">
            {g.items.map((a) => {
              const selected = currentSfxId === a.id;
              return (
                <div
                  key={a.id}
                  className={`flex items-center gap-1 rounded-md border transition-colors
                    ${selected ? "bg-brand/20 border-brand/60" : "bg-white/5 border-transparent hover:bg-white/10"}`}
                >
                  <button
                    onClick={() => play(a.id)}
                    className="p-1.5 hover:bg-white/10 rounded-md text-white/70"
                    title="השמע"
                  >
                    {playingId === a.id
                      ? <Volume2 className="w-3.5 h-3.5 text-brand-light animate-pulse" />
                      : <Play className="w-3.5 h-3.5" />}
                  </button>
                  <button
                    onClick={() => { onSelect(a.id); onClose(); }}
                    className="flex-1 text-right text-xs px-1 py-1.5 text-white/80"
                  >
                    {labelFor(a.id, a.label)}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
        ));
      })()}
    </div>
  );
}
