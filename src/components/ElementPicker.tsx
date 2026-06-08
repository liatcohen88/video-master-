"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { Smile, Sparkles } from "lucide-react";
import { LOTTIE_ICONS } from "@/lib/lottieRegistry";

const Lottie = dynamic(() => import("lottie-react"), { ssr: false });

const EMOJI_CATEGORIES: { name: string; emojis: string[] }[] = [
  { name: "פופולרי",     emojis: ["💎","🔥","⚡","✨","💥","🌟","💯","🚀","💪","👑","🎯","🎉"] },
  { name: "כסף ועסקים", emojis: ["💰","💵","💸","💳","📈","📊","💼","🏦","🤑","💲","🪙","💎"] },
  { name: "רגשות",       emojis: ["❤️","💕","😍","🥰","😎","🤩","😱","🤯","😂","🥹","😭","🙏"] },
  { name: "פעולה",       emojis: ["👆","👇","👈","👉","👍","👎","👏","🙌","✋","🤝","💪","👀"] },
  { name: "אובייקטים",  emojis: ["🎁","🛒","📱","💻","⌚","📷","🎬","🎵","🎮","🏆","🥇","💡"] },
  { name: "סמלים",       emojis: ["❓","❗","‼️","⭕","✅","❌","⚠️","📌","🔔","🔒","🔓","💡"] },
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
  const [tab, setTab] = useState<"emoji" | "lottie">("emoji");
  const ref = useRef<HTMLDivElement>(null);
  const [jsons, setJsons] = useState<Record<string, unknown>>({});

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

  useEffect(() => {
    if (!open || tab !== "lottie") return;
    LOTTIE_ICONS.forEach((icon) => {
      if (jsons[icon.id]) return;
      fetch(icon.jsonPath).then((r) => r.json())
        .then((j) => setJsons((p) => ({ ...p, [icon.id]: j })))
        .catch(() => {});
    });
  }, [open, tab, jsons]);

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
      {/* Tabs */}
      <div className="flex border-b border-white/10">
        <button
          onClick={() => setTab("emoji")}
          className={`flex-1 py-2.5 text-sm font-medium flex items-center justify-center gap-1.5 border-b-2 -mb-px
            ${tab === "emoji" ? "border-brand text-white" : "border-transparent text-white/50 hover:text-white/80"}`}
        >
          <Smile className="w-4 h-4" /> אמוג'י
        </button>
        <button
          onClick={() => setTab("lottie")}
          className={`flex-1 py-2.5 text-sm font-medium flex items-center justify-center gap-1.5 border-b-2 -mb-px
            ${tab === "lottie" ? "border-brand text-white" : "border-transparent text-white/50 hover:text-white/80"}`}
        >
          <Sparkles className="w-4 h-4" /> אנימציה
        </button>
      </div>

      <div className="overflow-y-auto p-3 flex-1">
        {tab === "emoji" && EMOJI_CATEGORIES.map((cat) => (
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

        {tab === "lottie" && (
          <div className="grid grid-cols-3 gap-2">
            {LOTTIE_ICONS.map((icon) => (
              <button key={icon.id}
                onClick={() => { onSelect({ kind: "lottie", iconId: icon.id, color: icon.defaultColor }); onClose(); }}
                className="bg-bg-input border border-white/10 rounded-lg p-1.5 hover:border-brand/50 transition-all">
                <div className="w-full aspect-square">
                  {jsons[icon.id] ? (
                    <Lottie animationData={jsons[icon.id] as object} loop style={{ width: "100%", height: "100%" }} />
                  ) : (
                    <div className="w-full h-full bg-bg-card rounded animate-pulse" />
                  )}
                </div>
                <div className="text-[10px] text-white/60 mt-0.5 truncate text-center">{icon.name}</div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
