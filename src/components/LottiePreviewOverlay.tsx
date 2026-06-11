"use client";

import { useEffect, useState, useMemo } from "react";
import dynamic from "next/dynamic";
import { LOTTIE_ICONS } from "@/lib/lottieRegistry";
import { stripLottieBg } from "@/lib/lottieBgStrip";
import { useContent } from "@/lib/useContent";

// lottie-react touches window.location at import — load client-only.
const Lottie = dynamic(() => import("lottie-react"), { ssr: false });

type LottieElement = {
  iconId: string;
  time: number;
  durationSec: number;
  position: "top-right" | "top-left" | "bottom-right" | "bottom-left" | "top-center";
  color?: string;
  sizeRatio?: number;
};

const POS: Record<string, { left: string; top: string }> = {
  "top-right": { left: "78%", top: "20%" },
  "top-left": { left: "22%", top: "20%" },
  "bottom-right": { left: "78%", top: "75%" },
  "bottom-left": { left: "22%", top: "75%" },
  "top-center": { left: "50%", top: "15%" },
};

/** Recursively recolor a Lottie JSON, intelligently.
 *
 *  OLD behavior: blasted every fill AND every stroke with the user's color,
 *  destroying multi-color art (e.g. a rocket with red body + grey window
 *  came out fully red). That's what Liat was hitting.
 *
 *  NEW behavior: pick ONE "primary" color to swap — the largest-area,
 *  most-saturated fill — and leave secondary colors (greys/whites/blacks
 *  used for outlines, eyes, details) untouched. The chosen original color
 *  is mapped to the user color; everything else keeps its design intent.
 */
function tint(data: unknown, hex?: string): unknown {
  if (!hex) return data;
  const c = hex.replace("#", "");
  const r = parseInt(c.substring(0, 2), 16) / 255;
  const g = parseInt(c.substring(2, 4), 16) / 255;
  const b = parseInt(c.substring(4, 6), 16) / 255;
  const clone = JSON.parse(JSON.stringify(data)) as unknown;

  // 1) Collect all fills with their RGB → pick the dominant one.
  type Spot = { col: Record<string, unknown>; rgb: [number, number, number] };
  const fills: Spot[] = [];
  const collect = (n: unknown) => {
    if (Array.isArray(n)) return n.forEach(collect);
    if (n && typeof n === "object") {
      const o = n as Record<string, unknown>;
      if (o.ty === "fl" && o.c && typeof o.c === "object") {
        const col = o.c as Record<string, unknown>;
        if (Array.isArray(col.k) && col.k.length >= 3) {
          fills.push({
            col,
            rgb: [Number(col.k[0]) || 0, Number(col.k[1]) || 0, Number(col.k[2]) || 0],
          });
        }
      }
      Object.values(o).forEach(collect);
    }
  };
  collect(clone);
  if (fills.length === 0) return clone;

  // 2) Score each fill: penalize near-black/white/grey (low saturation),
  //    reward saturated colors. Highest-scoring = "the brand color of the icon".
  const score = ([rr, gg, bb]: [number, number, number]) => {
    const mx = Math.max(rr, gg, bb), mn = Math.min(rr, gg, bb);
    return mx - mn; // chroma proxy → 0 = grey, 1 = pure hue
  };
  let primary = fills[0];
  for (const f of fills) if (score(f.rgb) > score(primary.rgb)) primary = f;
  const [pr, pg, pb] = primary.rgb;
  // Only replace fills whose color is very close to the primary (within a
  // small RGB distance) — that way a multi-color icon keeps its accents.
  const TOL = 0.12;
  const close = (rgb: [number, number, number]) =>
    Math.abs(rgb[0] - pr) < TOL && Math.abs(rgb[1] - pg) < TOL && Math.abs(rgb[2] - pb) < TOL;

  for (const f of fills) {
    if (close(f.rgb)) {
      f.col.k = [r, g, b, (f.col.k as number[])[3] ?? 1];
    }
  }
  return clone;
}

/**
 * Renders all currently-visible Lottie elements on top of the preview video,
 * animated (lottie-react). Mirrors the export positions/sizes exactly.
 */
export default function LottiePreviewOverlay({
  elements, currentTime, containerHeight,
}: {
  elements: LottieElement[];
  currentTime: number;
  containerHeight: number;
}) {
  const [jsons, setJsons] = useState<Record<string, unknown>>({});
  const bgRemoved = useContent("lottie.bgRemoved") as Record<string, true>;

  // Load each referenced JSON once
  const neededIds = useMemo(
    () => Array.from(new Set(elements.map((e) => e.iconId))),
    [elements],
  );
  useEffect(() => {
    neededIds.forEach((id) => {
      const icon = LOTTIE_ICONS.find((i) => i.id === id);
      if (!icon || jsons[id]) return;
      fetch(icon.jsonPath)
        .then((r) => r.json())
        .then((j) => setJsons((prev) => ({ ...prev, [id]: j })))
        .catch(() => {});
    });
  }, [neededIds, jsons]);

  const visible = elements.filter(
    (e) => currentTime >= e.time && currentTime < e.time + e.durationSec,
  );

  return (
    <>
      {visible.map((el, i) => {
        const rawJson = jsons[el.iconId];
        if (!rawJson) return null;
        const json = bgRemoved?.[el.iconId] ? stripLottieBg(rawJson) : rawJson;
        return (
          <LottieOne
            key={`${el.iconId}-${el.time}-${el.color ?? ""}-${bgRemoved?.[el.iconId] ? "nb" : ""}-${i}`}
            json={json}
            color={el.color}
            position={el.position}
            sizeRatio={el.sizeRatio ?? 0.18}
            containerHeight={containerHeight}
          />
        );
      })}
    </>
  );
}

/**
 * Render one Lottie. Memoizes the (tinted) animationData by source+color so
 * `lottie-react` doesn't see a fresh object every parent re-render — that's
 * what caused the icon to look "stuck on frame 0" during playback.
 */
function LottieOne({
  json, color, position, sizeRatio, containerHeight,
}: {
  json: unknown;
  color?: string;
  position: keyof typeof POS;
  sizeRatio: number;
  containerHeight: number;
}) {
  const tinted = useMemo(() => (color ? tint(json, color) : json), [json, color]);
  const pos = POS[position] ?? POS["top-right"];
  const size = Math.max(48, containerHeight * sizeRatio);
  return (
    <div
      className="absolute pointer-events-none"
      style={{
        left: pos.left,
        top: pos.top,
        width: size,
        height: size,
        transform: "translate(-50%, -50%)",
      }}
    >
      <Lottie animationData={tinted as object} loop autoplay style={{ width: "100%", height: "100%" }} />
    </div>
  );
}
