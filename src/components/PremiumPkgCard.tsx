"use client";

import Link from "next/link";
import { Check } from "lucide-react";
import { useContent } from "@/lib/useContent";
import MasterCoin from "@/components/MasterCoin";

export type Pkg = {
  id: string;
  credits: number;
  priceIls: number;
  label: string;
  highlight: string;
};

type Props = {
  pkg: Pkg;
  onBuy?: (id: string) => void;
  busy?: boolean;
};

/**
 * Minimal package card. Since EVERY package unlocks the SAME features and
 * only the amount differs, the card shows ONLY what differs — coin, big
 * credit number, "≈ X videos", price, CTA. The shared feature list is
 * rendered ONCE beneath the whole grid via <SharedFeatures/>.
 */
export default function PremiumPkgCard({ pkg, onBuy, busy }: Props) {
  const currency = (useContent("brand.currencyName") as string) || "קרדיטים";
  const fakeRegularPrice = Math.round(pkg.priceIls * 1.6);
  const videos = Math.max(1, Math.round(pkg.credits / 10)); // entry (subtitles) rate
  const isPopular   = pkg.highlight === "הכי נמכר";
  const isBestValue = pkg.highlight === "הכי משתלם";
  const featured    = isPopular || isBestValue;

  const ctaClass =
    "block w-full py-3 rounded-xl text-center font-black text-base text-white " +
    "bg-gradient-to-r from-violet-500 to-pink-500 hover:from-violet-400 hover:to-pink-400 " +
    "shadow-lg shadow-brand/30 transition-all hover:shadow-xl hover:scale-[1.02] disabled:opacity-60 disabled:cursor-not-allowed";

  return (
    <div className={`relative transition-all h-full ${featured ? "z-10" : "hover:-translate-y-1"}`}>
      {/* Small highlight pill (only on featured tiers) */}
      {pkg.highlight && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-20 whitespace-nowrap">
          <div className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wide shadow-lg
            ${isBestValue
              ? "bg-gradient-to-r from-fuchsia-500 to-pink-500 text-white shadow-fuchsia-500/40"
              : "bg-gradient-to-r from-violet-500 to-purple-500 text-white shadow-violet-500/40"}`}>
            {pkg.highlight}
          </div>
        </div>
      )}

      <div className={`relative bg-bg-card rounded-2xl border p-6 h-full flex flex-col items-center text-center
        ${featured ? "border-brand/50 shadow-2xl shadow-brand/15" : "border-white/10 hover:border-white/25"}`}>

        {/* Plan label */}
        <div className="text-xs font-bold uppercase tracking-widest text-brand-light/90 mb-4 mt-1">
          {pkg.label}
        </div>

        {/* Coin */}
        <MasterCoin size={38} className="mb-3 drop-shadow-[0_2px_8px_rgba(251,191,36,0.35)]" />

        {/* HERO — credits */}
        <div className="flex items-baseline justify-center gap-1.5">
          <span className="text-5xl font-black text-white leading-none tracking-tight">{pkg.credits}</span>
        </div>
        <div className="text-xs text-white/50 font-bold mt-1">{currency}</div>
        <div className="text-[11px] text-white/35 mt-1">≈ {videos} סרטונים</div>

        {/* spacer pushes price+cta to the bottom so all cards align */}
        <div className="flex-1" />

        {/* Price */}
        <div className="flex items-baseline justify-center gap-2 mt-5">
          <span className="text-[13px] text-red-400/60 line-through font-bold">₪{fakeRegularPrice}</span>
          <span className="text-3xl font-black text-white leading-none">₪{pkg.priceIls}</span>
        </div>
        <div className="text-[10px] text-white/35 mb-4">כולל מע&quot;מ · תשלום חד-פעמי</div>

        {onBuy ? (
          <button onClick={() => onBuy(pkg.id)} disabled={busy} className={ctaClass}>
            {busy ? "מעבד..." : "👈 לקנייה"}
          </button>
        ) : (
          <Link href="/credits" className={ctaClass}>
            👈 לקנייה
          </Link>
        )}
      </div>
    </div>
  );
}

/**
 * The features shared by ALL packages — render ONCE below the grid instead of
 * repeating on every card. Keeps the cards clean.
 */
export function SharedFeatures() {
  const items = [
    "כתוביות אוטומטיות בעברית",
    "אנימציות ויראליות — Pop, Slide, Type",
    "גישה לכל הסגנונות והעדכונים",
    "לא פג לעולם",
  ];
  return (
    <div className="mt-6 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-white/70">
      {items.map((it, i) => (
        <span key={i} className="flex items-center gap-1.5">
          <Check className="w-4 h-4 text-emerald-400 shrink-0" />
          {it}
        </span>
      ))}
    </div>
  );
}
