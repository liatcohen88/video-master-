"use client";

import { useEffect, useRef } from "react";
// Lottie picker hidden from end-users (per Liat 2026-06-11) — animations
// quality isn't where we want it for the launch. Lottie metadata/admin
// stays intact in code so we can flip it back on with one line later.
// import dynamic from "next/dynamic";
// import { Sparkles } from "lucide-react";
// import { LOTTIE_ICONS } from "@/lib/lottieRegistry";
// const Lottie = dynamic(() => import("lottie-react"), { ssr: false });

const EMOJI_CATEGORIES: { name: string; emojis: string[] }[] = [
  { name: "פופולרי",     emojis: ["💎","🔥","⚡","✨","💥","🌟","💯","🚀","💪","👑","🎯","🎉","🤯","😱","👀","🙌","✅","❤️"] },
  { name: "כסף ועסקים", emojis: ["💰","💵","💸","💳","📈","📊","💼","🏦","🤑","💲","🪙","🧾","🏷️","🛍️","💎","📉","🏧","💹"] },
  { name: "רגשות",       emojis: ["❤️","🧡","💛","💚","💙","💜","🖤","💕","💗","😍","🥰","😎","🤩","😱","🤯","😂","🤣","🥹","😭","🙏","😅","😇","🥳","😮"] },
  { name: "פנים",        emojis: ["😀","😃","😄","😁","😊","🙂","😉","😏","😬","🙄","😴","🤔","🤨","😐","😶","🤐","🤫","🤭","😜","😝","🤪","😤","😡","🥺"] },
  { name: "ידיים ופעולה",emojis: ["👆","👇","👈","👉","👍","👎","👏","🙌","✋","🤝","💪","👀","🤙","🤞","✌️","🤟","👌","🫶","👋","🫰","🙏","💅"] },
  { name: "אוכל",        emojis: ["🍕","🍔","🍟","🌭","🍿","🥤","☕","🍩","🍪","🎂","🍰","🍫","🍦","🍓","🍌","🥑","🍷","🍻","🥗","🍜","🌮","🧋"] },
  { name: "אובייקטים",  emojis: ["🎁","🛒","📱","💻","⌚","📷","🎬","🎵","🎮","🏆","🥇","💡","📦","✉️","📢","🔑","🛎️","🎤","🎧","📺","⏰","🔋"] },
  { name: "טבע וזמן",    emojis: ["☀️","🌙","⭐","🌈","⛅","🌧️","❄️","🌊","🌸","🌹","🌺","🍀","🔥","💧","⚡","🎇","🌴","🦋","🐶","🐱","🦄","🌍"] },
  { name: "סמלים",       emojis: ["❓","❗","‼️","⭕","✅","❌","⚠️","📌","🔔","🔒","🔓","💡","➡️","⬅️","⬆️","⬇️","♾️","🔝","🆕","🆓","💢","🚫"] },
];

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
        בחרי אמוג'י להוספה לכתובית
      </div>

      <div className="overflow-y-auto p-3 flex-1">
        {EMOJI_CATEGORIES.map((cat) => (
          <div key={cat.name} className="mb-3">
            <div className="text-[10px] uppercase tracking-wider text-white/30 mb-1 px-1">{cat.name}</div>
            <div className="grid grid-cols-6 gap-1">
              {cat.emojis.map((e) => (
                <button key={e}
                  onClick={() => { onSelect({ kind: "emoji", emoji: e }); onClose(); }}
                  className="text-2xl p-1.5 rounded-md hover:bg-white/10">
                  {e}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
