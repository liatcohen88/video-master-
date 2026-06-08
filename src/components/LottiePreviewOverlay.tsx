"use client";

import { useEffect, useState, useMemo } from "react";
import dynamic from "next/dynamic";
import { LOTTIE_ICONS } from "@/lib/lottieRegistry";

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

/** Recursively tint a Lottie JSON's fills/strokes (matches server applyColor). */
function tint(data: unknown, hex?: string): unknown {
  if (!hex) return data;
  const c = hex.replace("#", "");
  const r = parseInt(c.substring(0, 2), 16) / 255;
  const g = parseInt(c.substring(2, 4), 16) / 255;
  const b = parseInt(c.substring(4, 6), 16) / 255;
  const clone = JSON.parse(JSON.stringify(data));
  const walk = (n: unknown) => {
    if (Array.isArray(n)) return n.forEach(walk);
    if (n && typeof n === "object") {
      const o = n as Record<string, unknown>;
      if ((o.ty === "fl" || o.ty === "st") && o.c && typeof o.c === "object") {
        const col = o.c as Record<string, unknown>;
        if (Array.isArray(col.k) && col.k.length >= 3) col.k = [r, g, b, (col.k[3] as number) ?? 1];
      }
      Object.values(o).forEach(walk);
    }
  };
  walk(clone);
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
        const json = jsons[el.iconId];
        if (!json) return null;
        const pos = POS[el.position] ?? POS["top-right"];
        const size = Math.max(48, containerHeight * (el.sizeRatio ?? 0.18));
        const tinted = el.color ? tint(json, el.color) : json;
        return (
          <div
            key={`${el.iconId}-${el.time}-${i}`}
            className="absolute pointer-events-none"
            style={{
              left: pos.left,
              top: pos.top,
              width: size,
              height: size,
              transform: "translate(-50%, -50%)",
            }}
          >
            <Lottie animationData={tinted as object} loop style={{ width: "100%", height: "100%" }} />
          </div>
        );
      })}
    </>
  );
}
