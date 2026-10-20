# הטוב הרע ועודיה — lyric video (Odeya, E-Z & Liad Meir) (code-only, no credits)

- `index.html` — the composition. Deterministic: `window.renderFrame(t)` draws time `t` (seconds); timeline constants live in `T`.
- `render.cjs` — drives headless Chromium frame by frame and pipes PNGs into ffmpeg.
- Fonts load from the repo's `../assets/fonts` (Suez One is the main display face).

Render (global Playwright lives in /opt/node22/lib/node_modules):

    NODE_PATH=/opt/node22/lib/node_modules node render.cjs out=out/preview.mp4            # whole timeline
    NODE_PATH=/opt/node22/lib/node_modules node render.cjs stills=0.3,1.5,5 dir=out/stills # review frames
    NODE_PATH=/opt/node22/lib/node_modules node render.cjs out=out/x.mp4 audio=song.mp3     # with the song

Style: spaghetti-western poster (the title spoofs "The Good, the Bad and the Ugly").
Mustard field + sheriff star for הטוב, blood-red target rings + bullet holes for הרע,
desert sunset with dropping letters for ועודיה; film grain, dust, scratches, gate weave.
