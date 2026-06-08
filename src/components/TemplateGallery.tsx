"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { TEMPLATES, type SubtitleTemplate } from "@/lib/templates";
import { fontClassFor } from "@/lib/fonts";

type Props = {
  selectedId: string;
  onSelect: (template: SubtitleTemplate) => void;
};

const CATEGORIES: Array<{
  id: SubtitleTemplate["category"] | "all";
  label: string;
}> = [
  { id: "all", label: "הכל" },
  { id: "viral", label: "ויראלי" },
  { id: "fun", label: "צבעוני" },
  { id: "clean", label: "נקי" },
  { id: "elegant", label: "אלגנטי" },
];

export default function TemplateGallery({ selectedId, onSelect }: Props) {
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]["id"]>("all");

  const filtered = category === "all"
    ? TEMPLATES
    : TEMPLATES.filter((t) => t.category === category);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold">סגנון כתוביות</h3>
        <span className="text-xs text-white/40">{TEMPLATES.length} סגנונות</span>
      </div>

      <div className="flex flex-wrap gap-2">
        {CATEGORIES.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setCategory(cat.id)}
            className={`
              px-4 py-1.5 rounded-full text-sm font-medium transition-all
              ${category === cat.id
                ? "bg-brand text-white shadow-md shadow-brand/30"
                : "bg-bg-panel text-white/60 hover:text-white hover:bg-bg-card border border-white/10"}
            `}
          >
            {cat.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {filtered.map((tpl) => (
          <TemplateCard
            key={tpl.id}
            template={tpl}
            selected={selectedId === tpl.id}
            onClick={() => onSelect(tpl)}
          />
        ))}
      </div>
    </div>
  );
}

function TemplateCard({
  template, selected, onClick,
}: { template: SubtitleTemplate; selected: boolean; onClick: () => void }) {
  const { style } = template;

  // Preview is ~220px tall; production target is 1080px → scale = 0.2
  const previewScale = 0.22;
  const fontPx = style.fontSize * previewScale;
  const strokePx = Math.min(style.strokeWidth * previewScale, fontPx * 0.08);
  const bgHex =
    style.backgroundOpacity > 0
      ? `${style.backgroundColor}${Math.round(style.backgroundOpacity * 255).toString(16).padStart(2, "0")}`
      : "transparent";

  return (
    <button
      onClick={onClick}
      className={`
        relative group rounded-2xl overflow-hidden text-right
        border-2 transition-all duration-200
        ${selected
          ? "border-brand shadow-lg shadow-brand/30 scale-[1.02]"
          : "border-white/10 hover:border-white/30"}
      `}
    >
      <div
        className={`relative aspect-[9/12] bg-gradient-to-br ${template.previewBg} overflow-hidden`}
      >
        <div className="absolute inset-0 bg-black/30" />

        {selected && (
          <div className="absolute top-2 left-2 z-10 bg-brand rounded-full p-1 shadow-lg">
            <Check className="w-3 h-3 text-white" strokeWidth={3} />
          </div>
        )}

        <div
          className="absolute inset-0 flex justify-center p-3"
          style={{
            alignItems:
              style.position === "top"
                ? "flex-start"
                : style.position === "bottom"
                ? "flex-end"
                : "center",
            paddingTop: style.position === "top" ? "10%" : undefined,
            paddingBottom: style.position === "bottom" ? "15%" : undefined,
          }}
        >
          <span
            className={fontClassFor(style.fontFamily)}
            style={{
              fontSize: `${fontPx}px`,
              fontWeight: style.fontWeight,
              paintOrder: "stroke fill",
              WebkitTextStroke: strokePx > 0.2
                ? `${strokePx}px ${style.strokeColor}`
                : undefined,
              background: bgHex,
              padding: style.backgroundOpacity > 0 ? "3px 8px" : "0",
              borderRadius: "4px",
              textShadow: style.shadow ? "1px 1px 4px rgba(0,0,0,0.85)" : "none",
              direction: "rtl",
              unicodeBidi: "plaintext",
              lineHeight: 1.25,
              textAlign: "center",
              display: "inline-block",
              maxWidth: "90%",
            }}
          >
            <span style={{ color: style.color }}>שלום </span>
            <span
              style={{
                color: style.highlightColor,
                display: "inline-block",
                transform: "scale(1.06)",
              }}
            >
              וברוכים
            </span>
            <span style={{ color: style.color }}> הבאים</span>
          </span>
        </div>
      </div>

      <div className="p-3 bg-bg-panel">
        <div className="font-bold text-sm">{template.name}</div>
        <div className="text-xs text-white/50 mt-0.5 line-clamp-1">
          {template.description}
        </div>
      </div>
    </button>
  );
}
