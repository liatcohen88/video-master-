"use client";

import { useEffect, useRef } from "react";

const EMOJI_CATEGORIES: { name: string; emojis: string[] }[] = [
  {
    name: "פופולרי",
    emojis: ["💎", "🔥", "⚡", "✨", "💥", "🌟", "💯", "🚀", "💪", "👑", "🎯", "🎉"],
  },
  {
    name: "כסף ועסקים",
    emojis: ["💰", "💵", "💸", "💳", "📈", "📊", "💼", "🏦", "🤑", "💲", "🪙", "💎"],
  },
  {
    name: "רגשות",
    emojis: ["❤️", "💕", "😍", "🥰", "😎", "🤩", "😱", "🤯", "😂", "🥹", "😭", "🙏"],
  },
  {
    name: "פעולה",
    emojis: ["👆", "👇", "👈", "👉", "👍", "👎", "👏", "🙌", "✋", "🤝", "💪", "👀"],
  },
  {
    name: "אובייקטים",
    emojis: ["🎁", "🛒", "📱", "💻", "🖱️", "⌚", "📷", "🎬", "🎵", "🎮", "🏆", "🥇"],
  },
  {
    name: "סמלים",
    emojis: ["❓", "❗", "‼️", "⭕", "✅", "❌", "⚠️", "📌", "🔔", "🔒", "🔓", "💡"],
  },
  {
    name: "טבע",
    emojis: ["🌅", "🌊", "🌈", "🌸", "🌺", "🍀", "🌿", "🌍", "🌎", "☀️", "🌙", "⭐"],
  },
  {
    name: "אוכל",
    emojis: ["🍕", "🍔", "🍩", "☕", "🍷", "🍾", "🍰", "🍫", "🍓", "🥑", "🍎", "🍌"],
  },
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
      {EMOJI_CATEGORIES.map((cat) => (
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
