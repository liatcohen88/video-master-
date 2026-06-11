"use client";

import { useEffect, useRef, useState } from "react";
import { Search } from "lucide-react";
import { useContent } from "@/lib/useContent";
import { emojiMatches } from "@/lib/emojiKeywords";

export const EMOJI_CATEGORIES: { name: string; emojis: string[] }[] = [
  { name: "פופולרי",      emojis: ["💎","🔥","⚡","✨","💥","🌟","💯","🚀","💪","👑","🎯","🎉","🤯","😱","👀","🙌","✅","❤️"] },
  { name: "כסף ועסקים",  emojis: ["💰","💵","💸","💳","📈","📊","💼","🏦","🤑","💲","🪙","🧾","🏷️","🛍️","💎","📉","🏧","💹"] },
  { name: "רגשות",        emojis: ["❤️","🧡","💛","💚","💙","💜","🖤","💕","💗","😍","🥰","😎","🤩","😱","🤯","😂","🤣","🥹","😭","🙏","😅","🥳"] },
  { name: "פנים",         emojis: ["😀","😃","😄","😁","😊","🙂","😉","😏","😬","🙄","😴","🤔","🤨","😐","🤐","🤫","🤭","😜","😝","🤪","😤","🥺"] },
  { name: "ידיים ופעולה", emojis: ["👆","👇","👈","👉","👍","👎","👏","🙌","✋","🤝","💪","👀","🤙","🤞","✌️","🤟","👌","🫶","👋","🫰","🙏","💅"] },
  { name: "אובייקטים",   emojis: ["🎁","🛒","📱","💻","⌚","📷","🎬","🎵","🎮","🏆","🥇","💡","📦","✉️","📢","🔑","🛎️","🎤","🎧","📺","⏰","🔋"] },
  { name: "טבע וזמן",     emojis: ["☀️","🌙","⭐","🌈","⛅","🌧️","❄️","🌊","🌸","🌹","🌺","🍀","🔥","💧","⚡","🎇","🌴","🦋","🐶","🐱","🦄","🌍"] },
  { name: "אוכל",         emojis: ["🍕","🍔","🍟","🌭","🍿","🥤","☕","🍩","🍪","🎂","🍰","🍫","🍦","🍓","🍌","🥑","🍷","🍻","🥗","🍜","🌮","🧋"] },
  { name: "סמלים",        emojis: ["❓","❗","‼️","⭕","✅","❌","⚠️","📌","🔔","🔒","🔓","💡","➡️","⬅️","♾️","🔝","🆕","🆓","💢","🚫"] },
];

type Props = {
  open: boolean;
  currentEmoji: string;
  onSelect: (emoji: string) => void;
  onClose: () => void;
  anchorRect?: DOMRect | null;
};

export default function EmojiPicker({
  open, currentEmoji, onSelect, onClose, anchorRect,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  const extras = useContent("emoji.extras") as Record<string, string[]>;
  const hidden = useContent("emoji.hidden") as string[];
  const hiddenSet = new Set(hidden ?? []);
  useEffect(() => { if (!open) setQuery(""); }, [open]);

  // Merge: built-in categories + admin extras (appended), minus hidden ones,
  // then apply search filter against the Hebrew keyword map. When the user
  // types "ציוץ" we surface 🐦 / 🐤 across all categories.
  const categories = EMOJI_CATEGORIES
    .map((cat) => {
      const merged = [...cat.emojis, ...(extras?.[cat.name] ?? [])]
        .filter((e) => !hiddenSet.has(e))
        .filter((e) => emojiMatches(e, query) || (!query.trim() ? true : cat.name.includes(query)));
      return { name: cat.name, emojis: Array.from(new Set(merged)) };
    })
    .filter((c) => c.emojis.length > 0);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
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

  if (!open) return null;

  // Position the picker near the clicked emoji, but clamp to viewport.
  const style: React.CSSProperties = {};
  if (anchorRect) {
    style.position = "fixed";
    style.top = `${Math.min(anchorRect.bottom + 8, window.innerHeight - 360)}px`;
    style.left = `${Math.max(8, Math.min(anchorRect.left - 60, window.innerWidth - 280))}px`;
    style.zIndex = 100;
  }

  return (
    <div
      ref={ref}
      style={style}
      className="bg-bg-card border border-white/15 rounded-2xl shadow-2xl shadow-black/60 p-3 w-[300px] max-h-[400px] overflow-y-auto"
      dir="rtl"
    >
      <div className="text-xs text-white/40 mb-2 text-center">
        בחרי אמוג'י חדש (נוכחי: {currentEmoji})
      </div>

      {/* Search bar — Hebrew keyword search ("ציוץ" → 🐦, "אש" → 🔥, etc.) */}
      <div className="relative mb-3">
        <Search className="w-3.5 h-3.5 absolute right-2.5 top-1/2 -translate-y-1/2 text-white/40 pointer-events-none" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="חיפוש אמוג'י (אש, אהבה, ציוץ, כסף)..."
          className="w-full bg-white/5 border border-white/10 rounded-md text-xs px-3 py-1.5 pr-8 placeholder-white/30 focus:outline-none focus:border-white/30"
          dir="rtl"
          autoFocus
        />
      </div>

      {categories.length === 0 && (
        <div className="text-center text-xs text-white/40 py-6">
          לא נמצאו אמוג'ים ל-״{query}״
        </div>
      )}

      {categories.map((cat) => (
        <div key={cat.name} className="mb-3">
          <div className="text-[10px] uppercase tracking-wider text-white/30 mb-1 px-1">
            {cat.name}
          </div>
          <div className="grid grid-cols-6 gap-1">
            {cat.emojis.map((e) => (
              <button
                key={e}
                onClick={() => {
                  onSelect(e);
                  onClose();
                }}
                className={`
                  text-2xl p-1.5 rounded-md hover:bg-white/10 transition-colors
                  ${e === currentEmoji ? "bg-brand/30 ring-2 ring-brand" : ""}
                `}
              >
                {e}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
