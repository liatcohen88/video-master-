"use client";

import { useState } from "react";
import TemplateGallery from "@/components/TemplateGallery";
import VideoPreview from "@/components/VideoPreview";
import { TEMPLATES } from "@/lib/templates";
import type { Subtitle } from "@/lib/types";

const DEMO_SUBS: Subtitle[] = [
  {
    id: "1",
    start: 0,
    end: 100,
    text: "שלום וברוכים הבאים",
    words: [
      { word: "שלום", start: 0, end: 100 },
      { word: "וברוכים", start: 0, end: 100 },
      { word: "הבאים", start: 0, end: 100 },
    ],
  },
];

export default function TestTemplates() {
  const [tplId, setTplId] = useState(TEMPLATES[0].id);
  const tpl = TEMPLATES.find((t) => t.id === tplId)!;

  return (
    <main className="min-h-screen px-6 py-8 max-w-[1400px] mx-auto space-y-6">
      <h1 className="text-3xl font-bold">בדיקת תבניות</h1>
      <TemplateGallery
        selectedId={tplId}
        onSelect={(t) => setTplId(t.id)}
      />
      <div className="bg-bg-panel p-4 rounded-2xl">
        <div className="aspect-video bg-gradient-to-br from-slate-700 to-slate-900 relative rounded-xl overflow-hidden">
          <div className="absolute inset-0 flex items-center justify-center">
            <div
              style={{
                fontFamily: `'${tpl.style.fontFamily}'`,
                fontSize: `${tpl.style.fontSize * 0.8}px`,
                fontWeight: tpl.style.fontWeight,
                WebkitTextStroke: `${tpl.style.strokeWidth}px ${tpl.style.strokeColor}`,
                background: tpl.style.backgroundOpacity > 0
                  ? `${tpl.style.backgroundColor}${Math.round(tpl.style.backgroundOpacity * 255).toString(16).padStart(2, "0")}`
                  : "transparent",
                padding: tpl.style.backgroundOpacity > 0 ? "8px 18px" : "0",
                borderRadius: "12px",
                textShadow: tpl.style.shadow ? "2px 2px 12px rgba(0,0,0,0.9)" : "none",
                direction: "rtl",
                display: "inline-flex",
                gap: "0.4em",
              }}
            >
              <span style={{ color: tpl.style.color }}>שלום</span>
              <span style={{ color: tpl.style.highlightColor, transform: "scale(1.08)", display: "inline-block" }}>וברוכים</span>
              <span style={{ color: tpl.style.color }}>הבאים</span>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
