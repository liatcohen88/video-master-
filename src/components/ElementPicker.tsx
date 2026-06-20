"use client";

import { useEffect, useRef, useState } from "react";
import { Search, Smile, Tag } from "lucide-react";
import { appleEmojiUrl, twemojiUrl } from "@/lib/twemoji";
import { EMOJI_CATEGORIES } from "@/lib/emojiData";
import { emojiMatches } from "@/lib/emojiKeywords";
import { resolveBrandLogos, brandLogoCdnUrl, type BrandLogo } from "@/lib/brandLogos";
// Lottie picker hidden from end-users (per Liat 2026-06-11) — animations
// quality isn't where we want it for the launch. Lottie metadata/admin
// stays intact in code so we can flip it back on with one line later.
// import dynamic from "next/dynamic";
// import { Sparkles } from "lucide-react";
// import { LOTTIE_ICONS } from "@/lib/lottieRegistry";
// const Lottie = dynamic(() => import("lottie-react"), { ssr: false });

export type PickedElement =
  | { kind: "emoji"; emoji: string }
  | { kind: "lottie"; iconId: string; color?: string }
  | { kind: "brand"; brandId: string; color?: string };

type Props = {
  open: boolean;
  onSelect: (el: PickedElement) => void;
  onClose: () => void;
  anchorRect?: DOMRect | null;
};

type Tab = "emoji" | "brand";

// Hebrew query → brand match. Reuses the brand's own detection patterns so
// typing "אינסטגרם" / "טסלה" finds Instagram / Tesla, plus name/slug match.
function brandMatches(b: BrandLogo, q: string): boolean {
  const query = q.trim();
  if (!query) return true;
  const ql = query.toLowerCase();
  if (
    b.name.toLowerCase().includes(ql) ||
    b.id.toLowerCase().includes(ql) ||
    b.slug.toLowerCase().includes(ql)
  ) return true;
  return b.patterns.some((p) => {
    try { return new RegExp(p.source, p.flags.replace("g", "")).test(query); }
    catch { return false; }
  });
}

export default function ElementPicker({ open, onSelect, onClose, anchorRect }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<Tab>("emoji");

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

  // Reset query when switching tabs so an emoji search doesn't hide all brands.
  useEffect(() => { setQuery(""); }, [tab]);

  if (!open) return null;

  // Hebrew keyword search ("רכב" → 🚗) — empty query shows all categories.
  const filtered = EMOJI_CATEGORIES
    .map((cat) => ({ ...cat, emojis: cat.emojis.filter((e) => emojiMatches(e, query)) }))
    .filter((cat) => cat.emojis.length > 0);

  const brands = resolveBrandLogos().filter((b) => brandMatches(b, query));

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
      {/* Tabs — אמוג'ים | לוגו מותגים */}
      <div className="flex gap-1 p-2 border-b border-white/10">
        <button
          onClick={() => setTab("emoji")}
          className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-medium transition-colors
            ${tab === "emoji" ? "bg-brand/25 text-white ring-1 ring-brand/40" : "text-white/60 hover:bg-white/5"}`}
        >
          <Smile className="w-3.5 h-3.5" /> אמוג&apos;ים
        </button>
        <button
          onClick={() => setTab("brand")}
          className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-medium transition-colors
            ${tab === "brand" ? "bg-brand/25 text-white ring-1 ring-brand/40" : "text-white/60 hover:bg-white/5"}`}
        >
          <Tag className="w-3.5 h-3.5" /> לוגו מותגים
        </button>
      </div>

      {/* Search */}
      <div className="relative px-3 pt-2.5">
        <Search className="w-3.5 h-3.5 absolute right-5 top-1/2 -translate-y-1/2 text-white/40 pointer-events-none" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={tab === "emoji" ? "חיפוש אמוג'י (רכב, כלב, אהבה…)" : "חיפוש מותג (אינסטגרם, טסלה…)"}
          className="w-full bg-white/5 border border-white/10 rounded-md text-xs px-3 py-1.5 pr-8 placeholder-white/30 focus:outline-none focus:border-white/30"
          dir="rtl"
          autoFocus
        />
      </div>

      <div className="overflow-y-auto p-3 flex-1">
        {tab === "emoji" && (
          <>
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
                          missing. */}
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
          </>
        )}

        {tab === "brand" && (
          <>
            {brands.length === 0 && (
              <div className="text-center text-xs text-white/40 py-6">לא נמצא מותג ל-״{query}״</div>
            )}
            <div className="grid grid-cols-3 gap-1.5">
              {brands.map((b) => (
                <button key={b.id}
                  onClick={() => { onSelect({ kind: "brand", brandId: b.id, color: b.color }); onClose(); }}
                  className="flex flex-col items-center gap-1 p-2 rounded-lg hover:bg-white/10 transition-colors"
                  title={b.name}>
                  {/* Render each logo on a light card — same look as on-video —
                      so white/black logos stay visible against the dark picker. */}
                  <span className="flex items-center justify-center rounded-md bg-white/95 w-12 h-12 shrink-0">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={brandLogoCdnUrl(b)} alt={b.name} width={30} height={30}
                      loading="lazy" className="w-[30px] h-[30px] block object-contain"
                      onError={(ev) => { ev.currentTarget.style.display = "none"; }} />
                  </span>
                  <span className="text-[9px] text-white/55 truncate max-w-full leading-tight">{b.name}</span>
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
