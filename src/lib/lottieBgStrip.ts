/**
 * Strip the background from a Lottie JSON without breaking the icon.
 *
 * Three places a "background" can hide in Bodymovin JSON:
 *  1. root `bg` — solid hex color the comp clears to. Easiest: delete it.
 *  2. Layer with `ty: 1` (solid color layer) covering the whole canvas —
 *     filter the layer out.
 *  3. First shape layer whose shapes contain only a single rectangle filling
 *     the whole comp + one fill — this is the LottieFiles "tile" background.
 *     We detect by checking if the bounding rect equals the comp bounds.
 *
 * Returns a deep-cloned JSON so the original (cached) reference stays clean.
 */
export function stripLottieBg(data: unknown): unknown {
  if (!data || typeof data !== "object") return data;
  const clone = JSON.parse(JSON.stringify(data)) as Record<string, unknown>;

  // 1) root bg color
  delete clone.bg;

  const compW = Number(clone.w) || 0;
  const compH = Number(clone.h) || 0;

  if (!Array.isArray(clone.layers)) return clone;

  type Layer = Record<string, unknown> & { ty?: number; shapes?: unknown[]; ind?: number };
  const layers = clone.layers as Layer[];

  // 2) Drop solid-color layers (ty=1). They're almost always the bg.
  let next = layers.filter((l) => l.ty !== 1);

  // 3) Drop shape layers that look like a full-canvas rect fill.
  next = next.filter((layer) => {
    if (layer.ty !== 4 || !Array.isArray(layer.shapes)) return true;
    // If the layer contains ONLY one group with one rect + one fill that
    // covers the whole comp, it's a background tile. Anything more complex
    // (multiple shapes, paths, masks) — keep it; it's the actual icon.
    const shapes = layer.shapes;
    if (shapes.length !== 1) return true;
    const grp = shapes[0] as Record<string, unknown>;
    if (grp.ty !== "gr" || !Array.isArray(grp.it)) return true;
    const items = grp.it as Array<Record<string, unknown>>;
    const rect = items.find((x) => x.ty === "rc");
    if (!rect) return true;
    const sizeProp = rect.s as Record<string, unknown> | undefined;
    const k = sizeProp?.k;
    if (!Array.isArray(k) || k.length < 2) return true;
    const [w, h] = [Number(k[0]) || 0, Number(k[1]) || 0];
    // Allow 1% slack — some tools export 1080 as 1079.99.
    const covers = compW > 0 && compH > 0
      && Math.abs(w - compW) < compW * 0.02
      && Math.abs(h - compH) < compH * 0.02;
    return !covers;
  });

  clone.layers = next;
  return clone;
}
