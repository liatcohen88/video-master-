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
 * Imperative (sets el.style.fontSize directly) so there's no extra React render.
 * IMPORTANT: the caption element must NOT set fontSize via JSX — this hook is
 * the SOLE owner of fontSize. If JSX also set it, React would reset it to the
 * base on every re-render (every highlighted word / every export frame) and
 * fight this hook.
 *
 * It re-measures on three triggers, which is what fixes "כתוביות ראשונות קטנות"
 * (the first captions were measured with the wider FALLBACK font before the web
 * font finished loading, got shrunk, and were never re-measured):
 *   1. on mount / when the text or base size changes,
 *   2. when web fonts finish loading (document.fonts.ready),
 *   3. when the container resizes (ResizeObserver).
 *
 * Used by BOTH the live preview and the Remotion export (both render in a real
 * browser) so they stay in parity.
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

    let cancelled = false;

    const measure = () => {
      if (cancelled) return;
      const node = ref.current;
      const p = node?.parentElement;
      if (!node || !p) return;
      const avail = p.clientWidth * 0.94; // small safety margin from edges
      // Layout not ready yet (width 0) — DON'T shrink to a tiny size; a later
      // resize/fonts callback will re-measure once there's a real width. This
      // was the other half of the "first captions tiny" bug.
      if (avail <= 0) return;
      // Always reset to the design size first, so a previously-wrong shrink can
      // grow back once the real font/space is known.
      node.style.fontSize = `${baseFontPx}px`;
      const natural = node.scrollWidth;
      if (natural > avail && natural > 0) {
        const fitted = Math.max(8, Math.floor(baseFontPx * (avail / natural)));
        node.style.fontSize = `${fitted}px`;
      }
    };

    measure();

    // Re-measure once the web fonts are ready (fallback font is wider → first
    // captions were shrunk before the real font loaded).
    try {
      if (typeof document !== "undefined" && "fonts" in document) {
        (document as Document & { fonts: FontFaceSet }).fonts.ready
          .then(measure)
          .catch(() => {});
      }
    } catch { /* ignore */ }

    // Re-measure when the container resizes (effects panel opening, the preview
    // growing after first layout, orientation change, etc.).
    let ro: ResizeObserver | null = null;
    try {
      ro = new ResizeObserver(() => measure());
      ro.observe(parent);
    } catch { /* ResizeObserver unsupported — the measures above still ran */ }

    return () => {
      cancelled = true;
      if (ro) ro.disconnect();
    };
  }, [baseFontPx, key]);
  return ref;
}
