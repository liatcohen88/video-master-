"use client";

import { useState } from "react";
import { Wand2, Check, ChevronDown } from "lucide-react";
import { REFERENCE_STYLES, type ReferenceStyle } from "@/lib/referenceStyles";

type Props = {
  /** Apply a preset — caller wires this to set mode/template/effects/settings */
  onApply: (style: ReferenceStyle) => void;
  /** Which preset is currently selected (for the check mark) */
  activeId?: string;
};

/**
 * Compact, accordion-style "תבניות מוכנות" gallery. Lives at the TOP of
 * StylePanel; collapses like the other style sections. Each card shows the
 * preset's color gradient + emoji + name — no description, no inspired-by
 * text (per Liat's request).
 */
export default function ReferenceStyleGallery({ onApply, activeId }: Props) {
  const [open, setOpen] = useState(false);
  const activeStyle = REFERENCE_STYLES.find((s) => s.id === activeId);

  return (
    <div className="w-full">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-3 text-right group"
      >
        <div className="p-2 rounded-lg bg-gradient-to-br from-brand to-accent-pink shrink-0">
          <Wand2 className="w-4 h-4 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-bold text-sm">תבניות מוכנות 🎬</div>
          <div className="text-[11px] text-white/50 truncate">
            {activeStyle ? `נבחר: ${activeStyle.name}` : "לחיצה אחת = כל ההגדרות נטענות"}
          </div>
        </div>
        <ChevronDown
          className={`w-4 h-4 text-white/40 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mt-3">
          {REFERENCE_STYLES.map((style) => (
            <StyleCard
              key={style.id}
              style={style}
              active={activeId === style.id}
              onClick={() => onApply(style)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function StyleCard({
  style, active, onClick,
}: { style: ReferenceStyle; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`
        relative group rounded-xl overflow-hidden text-center
        border-2 transition-all duration-200
        ${active
          ? "border-brand shadow-lg shadow-brand/30 scale-[1.02]"
          : "border-white/10 hover:border-white/30 hover:scale-[1.02]"}
      `}
    >
      <div className={`relative h-16 bg-gradient-to-br ${style.gradient}`}>
        <div className="absolute inset-0 bg-black/15" />
        {active && (
          <div className="absolute top-1 left-1 z-10 bg-brand rounded-full p-1 shadow-lg">
            <Check className="w-2.5 h-2.5 text-white" strokeWidth={3} />
          </div>
        )}
        <div className="absolute inset-0 flex items-center justify-center text-2xl">
          {style.emoji}
        </div>
      </div>
      <div className="px-2 py-1.5 bg-bg-panel">
        <div className="font-bold text-[11px] leading-tight truncate">{style.name}</div>
      </div>
    </button>
  );
}
