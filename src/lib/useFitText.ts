import { useLayoutEffect, useRef } from "react";

/**
 * Shrink-to-fit caption text.
 *
 * We keep every caption on ONE line (whiteSpace:"nowrap") so the words-per-line
 * setting maps to a single visual row. But a long line then overflowed the
 * video frame and got CLIPPED at the edges (Liat: "הוא מסתיר את הכתובית... כי
 * הבאת הוראה לא לרדת שורה"). This hook scales the font DOWN just enough so the
 * line always fits the frame width — like CapCut/TikTok captions. Nothing wraps,
 * nothing is hidden.
 *
 * Imperative (sets el.style.fontSize directly) so there's no extra React render
 * and it re-applies after every layout. Used by BOTH the live preview and the
 * Remotion export (both render in a real browser) so they stay in parity.
 *
 * @param baseFontPx the design font size for the caption
 * @param key        changes whenever the caption text/size changes → re-measure
 */
export function useFitText<T extends HTMLElement = HTMLDivElement>(
  baseFontPx: number,
  key: unknown,
) {
  const ref = useRef<T>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    const parent = el?.parentElement;
    if (!el || !parent) return;
    // Measure the natural one-line width at the full design size.
    el.style.fontSize = `${baseFontPx}px`;
    const avail = parent.clientWidth * 0.94; // small safety margin from edges
    const natural = el.scrollWidth;
    if (natural > avail && natural > 0) {
      const fitted = Math.max(8, Math.floor(baseFontPx * (avail / natural)));
      el.style.fontSize = `${fitted}px`;
    }
  }, [baseFontPx, key]);
  return ref;
}
