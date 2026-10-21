# Handoff: finish a lyric video for a well-known song (run on Liat's computer)

The cloud session that built this folder had no internet access: it couldn't get the song,
and had no speech model for syncing the lyrics automatically. A session on the computer can
do both, as long as the user supplies:

- **the song file**, already on the computer. Don't download it from YouTube, Spotify or similar.
- **the lyrics**, pasted by the user into `lyric-video/lyrics.txt`: one sung line per row,
  optional section rows like `[פזמון]` or `[Chorus]`.

## Steps

1. `git fetch origin lyric-video && git checkout lyric-video`. Don't merge this branch into `main`:
   main auto-deploys the live site.
2. Tools, inside `lyric-video/`:
   - `npm i playwright && npx playwright install chromium`, so render.cjs finds playwright locally.
   - ffmpeg on PATH. On Windows: `winget install Gyan.FFmpeg`.
   - Python 3.10+ with numpy, plus `pip install stable-ts demucs` for automatic sync.
3. Sync: `python align.py <song.mp3> lyrics.txt he > data.js` (`en` for an English song).
   Spot-check a few line times against the song.
4. Opener text: add `window.SONG = {...}` at the top of data.js, and options inside `window.LYRICS`.
   See `data.original.js` (Hebrew, right to left) and `data.clementine.js` (English, left to right).
   - `SONG`: `title`, `dir`, `words` (the two slam words), `hero` (the word whose letters drop), `lock`, `posters` (3 × `{kicker, name}`).
   - `LYRICS`: `keywords` (`good` / `bad` / `hero` regexes), `title` (`{l1: [a, b], l2}`), `upper`, `holes`.
   - A line can also carry its own `world`: `yellow`, `red`, `dusk`, `wall` or `night`.
5. Render:
   - Stills to check: `node render.cjs stills=2,9,20,40 dir=out/stills`.
   - Full video: `node render.cjs out=out/final.mp4 workers=3 img=jpeg preset=medium audio=<song.mp3>`.

The 8-second intro stretches or shrinks to end just before the first sung line. Everything else
(worlds, word animation, beat bumps, outro) comes from the data; see README.md.
