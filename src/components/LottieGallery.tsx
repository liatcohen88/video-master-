"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { Volume2, VolumeX, X } from "lucide-react";

const Lottie = dynamic(() => import("lottie-react"), { ssr: false });
import { LOTTIE_ICONS } from "@/lib/lottieRegistry";
import { getSfxAsset } from "@/lib/sfxLibrary";
import SfxPicker from "./SfxPicker";
import type { VideoEffects } from "@/lib/types";

type LottieEl = NonNullable<VideoEffects["lottieElements"]>[number];

const POSITIONS: { id: LottieEl["position"]; icon: string }[] = [
  { id: "top-left", icon: "↖" },
  { id: "top-center", icon: "↑" },
  { id: "top-right", icon: "↗" },
  { id: "bottom-left", icon: "↙" },
  { id: "bottom-right", icon: "↘" },
];

/**
 * Gallery to add animated Lottie icons. Click an animation to add it; then
 * tweak color, duration and position. Mirrors the emoji UX.
 */
export default function LottieGallery({
  elements, onChange,
}: {
  elements: LottieEl[];
  onChange: (els: LottieEl[]) => void;
}) {
  const [jsons, setJsons] = useState<Record<string, unknown>>({});
  const [sfxPickerIdx, setSfxPickerIdx] = useState<number | null>(null);
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null);
  const sfxBtnRefs = useRef<Map<number, HTMLButtonElement>>(new Map());

  useEffect(() => {
    LOTTIE_ICONS.forEach((icon) => {
      if (jsons[icon.id]) return;
      fetch(icon.jsonPath).then((r) => r.json())
        .then((j) => setJsons((p) => ({ ...p, [icon.id]: j }))).catch(() => {});
    });
  }, [jsons]);

  function add(iconId: string) {
    const icon = LOTTIE_ICONS.find((i) => i.id === iconId);
    onChange([
      ...elements,
      {
        iconId,
        time: 0,
        durationSec: 2,
        position: "top-center",
        color: icon?.defaultColor,
        sizeRatio: 0.2,
      },
    ]);
  }
  function update(idx: number, patch: Partial<LottieEl>) {
    onChange(elements.map((e, i) => (i === idx ? { ...e, ...patch } : e)));
  }
  function remove(idx: number) {
    onChange(elements.filter((_, i) => i !== idx));
  }

  return (
    <div className="space-y-3">
      <p className="text-[11px] text-white/40">
        אלמנטים מונפשים — נראים גם בתצוגה וגם בייצוא. מחר נוסיף עוד ~30 שמתאימים.
      </p>

      {/* Gallery */}
      <div className="grid grid-cols-4 gap-2">
        {LOTTIE_ICONS.map((icon) => (
          <button
            key={icon.id}
            onClick={() => add(icon.id)}
            className="bg-bg-input border border-white/10 rounded-lg p-1.5 hover:border-brand/50 hover:scale-105 transition-all"
            title={`הוסף ${icon.name}`}
          >
            <div className="w-full aspect-square">
              {jsons[icon.id] ? (
                <Lottie animationData={jsons[icon.id] as object} loop style={{ width: "100%", height: "100%" }} />
              ) : (
                <div className="w-full h-full bg-bg-card rounded animate-pulse" />
              )}
            </div>
            <div className="text-[10px] text-white/50 mt-0.5 truncate">{icon.name}</div>
          </button>
        ))}
      </div>

      {/* Added elements */}
      {elements.length > 0 && (
        <div className="space-y-2 pt-2 border-t border-white/5">
          {elements.map((el, i) => {
            const icon = LOTTIE_ICONS.find((c) => c.id === el.iconId);
            return (
              <div key={i} className="bg-bg-input border border-white/10 rounded-lg p-2 space-y-2">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 flex-shrink-0">
                    {jsons[el.iconId] && (
                      <Lottie animationData={jsons[el.iconId] as object} loop style={{ width: "100%", height: "100%" }} />
                    )}
                  </div>
                  <span className="text-xs font-medium flex-1">{icon?.name ?? el.iconId}</span>
                  <button
                    ref={(b) => { if (b) sfxBtnRefs.current.set(i, b); }}
                    onClick={(ev) => {
                      setSfxPickerIdx(i);
                      setAnchorRect(ev.currentTarget.getBoundingClientRect());
                    }}
                    className="p-1 text-white/40 hover:text-white"
                    title={el.sfxId === "none" ? "צליל מבוטל" : el.sfxId ? `צליל: ${getSfxAsset(el.sfxId)?.label ?? el.sfxId}` : "ללא צליל — לחצי להוספה"}
                  >
                    {el.sfxId === "none" || !el.sfxId
                      ? <VolumeX className="w-3.5 h-3.5" />
                      : <Volume2 className="w-3.5 h-3.5 text-brand-light" />}
                  </button>
                  <button onClick={() => remove(i)} className="p-1 text-white/40 hover:text-red-300">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
                {/* Position */}
                <div className="grid grid-cols-5 gap-1">
                  {POSITIONS.map((p) => (
                    <button key={p.id} onClick={() => update(i, { position: p.id })}
                      className={`py-1 rounded text-sm border ${el.position === p.id ? "border-brand bg-brand/20" : "border-white/10 bg-bg-card text-white/50"}`}>
                      {p.icon}
                    </button>
                  ))}
                </div>
                {/* Color + timing */}
                <div className="flex items-center gap-2 text-[11px]">
                  <input type="color" value={el.color ?? "#FF6B35"}
                    onChange={(e) => update(i, { color: e.target.value })}
                    className="w-8 h-7 rounded bg-bg-card border border-white/10" title="צבע" />
                  <span className="text-white/40">מ-</span>
                  <input type="number" min={0} step={0.5} value={el.time}
                    onChange={(e) => update(i, { time: parseFloat(e.target.value) || 0 })}
                    className="w-14 bg-bg-card border border-white/10 rounded px-1 py-0.5" />
                  <span className="text-white/40">למשך</span>
                  <input type="number" min={0.5} step={0.5} value={el.durationSec}
                    onChange={(e) => update(i, { durationSec: parseFloat(e.target.value) || 1 })}
                    className="w-14 bg-bg-card border border-white/10 rounded px-1 py-0.5" />
                  <span className="text-white/40">שנ'</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {sfxPickerIdx !== null && (
        <SfxPicker
          open={true}
          currentSfxId={elements[sfxPickerIdx]?.sfxId}
          defaultLabel="ללא צליל"
          onSelect={(id) => update(sfxPickerIdx, { sfxId: id })}
          onClose={() => setSfxPickerIdx(null)}
          anchorRect={anchorRect}
        />
      )}
    </div>
  );
}
