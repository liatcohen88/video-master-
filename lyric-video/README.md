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

Sync to the song (numpy only — tempo, beat grid, onsets, loudness):

    python3 analyze_audio.py song.mp3 > out/audio.json

`render.cjs` splits long timelines across `workers=N` headless browsers (default 3) and concatenates the segments.

Morning pipeline (after the sync page has been used):

1. Read the saved timings: ArtifactData `get` of `sync/current` on the sync page artifact, saved to `out/sync.json`.
2. `python3 make_data.py out/sync.json [song.mp3] > data.js` — snaps each tapped line to the nearest onset.
3. `node render.cjs out=out/full.mp4 workers=3 [audio=song.mp3]` (`img=jpeg preset=medium` for a quick draft).

`data.sample.js` / `data.demo.js` are placeholder timelines for testing (copy one to `data.js`). `data.js` itself is git-ignored.

Songs made entirely in code (`synth.py` is the shared toolkit):

- `clementine.py` — "Oh My Darling, Clementine" (traditional, public domain) as a country-trap remix, English, left to right.
- `compose.py` — "הטוב, הרע ואני", an original song in the same western style.

Each script writes the WAV and a `data.*.js` timeline with exact word times (one note per syllable):

    python3 clementine.py out/clementine.wav data.clementine.js
    cp data.clementine.js data.js
    node render.cjs out=out/clementine_video.mp4 workers=3 img=jpeg preset=medium audio=out/clementine.wav
