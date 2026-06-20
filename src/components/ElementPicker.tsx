"use client";

import { useEffect, useRef, useState } from "react";
import { Search } from "lucide-react";
import { appleEmojiUrl, twemojiUrl } from "@/lib/twemoji";
import { EMOJI_CATEGORIES } from "@/lib/emojiData";
import { emojiMatches } from "@/lib/emojiKeywords";
// Lottie picker hidden from end-users (per Liat 2026-06-11) — animations
// quality isn't where we want it for the launch. Lottie metadata/admin
// stays intact in code so we can flip it back on with one line later.
// import dynamic from "next/dynamic";
// import { Sparkles } from "lucide-react";
// import { LOTTIE_ICONS } from "@/lib/lottieRegistry";
// const Lottie = dynamic(() => import("lottie-react"), { ssr: false });

export type PickedElement =
  | { kind: "emoji"; emoji: string }
  | { kind: "lottie"; iconId: string; color?: string };

type Props = {
  open: boolean;
  onSelect: (el: PickedElement) => void;
  onClose: () => void;
  anchorRect?: DOMRect | null;
};

export default function ElementPicker({ open, onSelect, onClose, anchorRect }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (!open) return;
    function click(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) onClose(); }
    function esc(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    document.addEventListener("mousedown", click);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", click);
      document.removeEventListener("keydown", esc);
    };
  }, [open, onClose]);

  if (!open) return null;

  // Hebrew keyword search ("רכב" → 🚗) — empty query shows all categories.
  const filtered = EMOJI_CATEGORIES
    .map((cat) => ({ ...cat, emojis: cat.emojis.filter((e) => emojiMatches(e, query)) }))
    .filter((cat) => cat.emojis.length > 0);

  const style: React.CSSProperties = {};
  if (anchorRect) {
    style.position = "fixed";
    style.top = `${Math.min(anchorRect.bottom + 8, window.innerHeight - 460)}px`;
    style.left = `${Math.max(8, Math.min(anchorRect.left - 100, window.innerWidth - 360))}px`;
    style.zIndex = 100;
  }

  return (
    <div
      ref={ref}
      style={style}
      className="bg-bg-card border border-white/15 rounded-2xl shadow-2xl shadow-black/60 w-[340px] max-h-[460px] flex flex-col"
      dir="rtl"
    >
      <div className="px-3 py-2.5 border-b border-white/10 text-xs text-white/70 text-center">
        בחירת אמוג'י להוספה לכתובית
      </div>

      {/* Search — Hebrew keywords ("רכב", "כלב", "אש"…) */}
      <div className="relative px-3 pt-2.5">
        <Search className="w-3.5 h-3.5 absolute right-5 top-1/2 -translate-y-1/2 text-white/40 pointer-events-none" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="חיפוש אמוג'י (רכב, כלב, אהבה…)"
          className="w-full bg-white/5 border border-white/10 rounded-md text-xs px-3 py-1.5 pr-8 placeholder-white/30 focus:outline-none focus:border-white/30"
          dir="rtl"
          autoFocus
        />
      </div>

      <div className="overflow-y-auto p-3 flex-1">
        {filtered.length === 0 && (
          <div className="text-center text-xs text-white/40 py-6">לא נמצאו אמוג&apos;ים ל-״{query}״</div>
        )}
        {filtered.map((cat) => (
          <div key={cat.name} className="mb-3">
            <div className="text-[10px] uppercase tracking-wider text-white/30 mb-1 px-1">{cat.name}</div>
            <div className="grid grid-cols-6 gap-1">
              {cat.emojis.map((e) => (
                <button key={e}
                  onClick={() => { onSelect({ kind: "emoji", emoji: e }); onClose(); }}
                  className="p-1.5 rounded-md hover:bg-white/10 flex items-center justify-center"
                  title={e}>
                  {/* Apple emoji IMAGE so the picker shows EXACTLY what the
                      preview + export render — not the OS font (Liat: "באלי
                      אמוגים של אפל"). Falls back to Twemoji if a glyph is
                      missing. eslint-disable-next-line @next/next/no-img-element */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={appleEmojiUrl(e)} alt={e} width={26} height={26}
                    loading="lazy" className="w-[26px] h-[26px] block"
                    onError={(ev) => {
                      const img = ev.currentTarget;
                      if (img.dataset.fb !== "1") { img.dataset.fb = "1"; img.src = twemojiUrl(e); }
                    }} />
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
