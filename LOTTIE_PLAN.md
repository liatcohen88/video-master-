# Lottie Integration Plan — וידאו מאסטר

## Goal
Let the user pick animated Lottie icons (or have AI auto-pick by keyword), set
a color, and choose how many seconds each icon shows — exactly like the emoji
flow today. Must appear identically in the **live preview** AND the **exported
MP4**.

## Why Lottie is harder than emoji
- Emoji = a single static PNG → trivial to overlay in FFmpeg.
- Lottie = a JSON animation (vector keyframes). FFmpeg can't read it directly.
- So for export we must first **rasterize the Lottie to a transparent video**
  (sequence of PNG frames or a WebM/MOV with alpha), then overlay it.

## Architecture (mirrors the PNG overlay system we just built)

### Live preview (easy — 3-4 h)
1. `npm i lottie-react` (or `@lottiefiles/react-lottie-player`).
2. Curate ~30-40 Lottie JSONs from lottiefiles.com (free) into
   `public/lottie/<id>.json`. Pick universally useful ones:
   money 💰, fire 🔥, arrow ⬆️, like 👍, star ⭐, check ✅, bell 🔔,
   location 📍, clock ⏰, heart ❤️, rocket 🚀, confetti 🎉, etc.
3. New module `src/lib/lottieRegistry.ts` — same shape as `keywordElements.ts`:
   `{ id, name, jsonPath, keywords: RegExp[], defaultColor }`.
4. New `LottieOverlay` component in `VideoPreview.tsx` — renders
   `<Lottie animationData={json} />` at the element's position, looping for its
   duration. Color override via lottie-colorify or by patching the JSON's
   color arrays at load time.
5. Reuse the existing element pipeline: detection, position, X-to-disable,
   click-to-change, duration control (already built for emoji).

### Export (the real work — 1 day)
**Option A — Pre-render each Lottie to alpha WebM once (RECOMMENDED).**
- One-time build script using `@lottiefiles/lottie-js` + `@napi-rs/canvas`:
  render each Lottie JSON frame-by-frame to PNG, then `ffmpeg` them into a
  VP9/alpha WebM (`-c:v libvpx-vp9 -pix_fmt yuva420p`). Cache in
  `cache/lottie-webm/<id>-<color>.webm`.
- At export: add the WebM as an FFmpeg input and overlay it with the same
  `enable='between(t,start,end)'` timing as emoji. Loop with `-stream_loop`.
- Color variants rendered on demand and cached.
- **Pros:** fast exports, pixel-perfect, integrates with current compositor.
- **Cons:** need a Lottie→canvas renderer (the `lottie-web` canvas renderer can
  run under @napi-rs/canvas with a small DOM shim, or use `puppeteer` once at
  build time to capture frames).

**Option B — Rasterize on every export with headless Chromium (puppeteer).**
- Simpler code, but +150 MB Chromium download and +10-30 s per export.
- Fallback only if Option A's canvas shim proves fiddly.

### Recommended path
1. Ship **preview-only Lottie** first (low risk, instant WOW for the user).
2. For export, start with Option A. Build the pre-render script for the curated
   set so the common icons are cached. Uncached/odd-color combos fall back to a
   static PNG of the first frame (so export never breaks).

## UI additions
- In `EffectsPanel` add a "אלמנטים מונפשים (Lottie)" gallery: grid of looping
  Lottie previews, click to add, color picker, duration input. Same UX as the
  emoji picker we built.
- AI auto-pick: when `contextualElements` is on, match keywords → Lottie just
  like emoji. User can swap a chosen Lottie for an emoji or vice-versa.

## Data model (extend VideoEffects)
```ts
lottieElements?: Array<{
  id: string;            // registry id
  time: number;
  durationSec: number;
  position: "top-right"|"top-left"|"bottom-right"|"bottom-left"|"top-center";
  color?: string;        // override
}>;
```

## Estimated effort
- Preview-only: ~half a day.
- Full export (Option A): ~1 day including the pre-render script + caching.

## Risk notes
- The Lottie→canvas renderer under Node is the only unknown. If it fights us,
  fall back to puppeteer (Option B) which is guaranteed to work.
- Always keep a static-PNG fallback so a missing/failed Lottie never breaks an
  export.
