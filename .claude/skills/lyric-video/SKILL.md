---
name: lyric-video
description: Make kinetic-typography lyric videos (קליפ מילים) for Reels entirely in code, with no generation credits. A deterministic HTML/JS composition is rendered frame by frame in headless Chromium and encoded with ffmpeg, in a western-poster style (word slams, bullet holes, desert sunset, saloon-wall posters, film grain). Supports Hebrew right to left and English left to right, syncs every word to the song, and can synthesize the music itself with numpy. Use it whenever someone asks for a lyric video, קליפ מילים, סרטון מילים לשיר, kinetic typography, animated song lyrics for Instagram or TikTok, or wants to continue or change the "הטוב הרע ועודיה" or "Clementine" clips, even if they never say "kinetic typography". It also covers who has to supply lyrics and audio (rights), syncing lyrics without hearing the song, and composing a song in code when there is no audio.
---

# Lyric video, made in code

`engine/index.html` draws any moment of the video as a pure function of time (`window.renderFrame(t)`).
That makes rendering deterministic and lets the work split across parallel headless browsers.
Everything song-specific (words, timings, title, posters) lives in one data file, `engine/data.js`:
a new song needs new data, not new code. Working examples:

- `engine/examples/data.clementine.js`: English, left to right, composed song with exact word times.
- `engine/examples/data.original.js`: Hebrew, right to left, original song.
- `engine/examples/data.demo.js`: style demo, title words only.

The look is a spaghetti-western poster. The 8-second opener slams two words in (mustard with a
sheriff star, then a blood-red target that gets shot), drops the third word's letters onto a striped
sunset, and pastes three credit posters on a saloon wall. The lyrics then play in five "worlds":
`yellow`, `red`, `dusk`, `wall` and `night`. Each has its own word animation.

## 1. Settle the song and its rights first

Lyrics and recordings of real songs are copyrighted, and that decides the whole pipeline, so sort it
out before designing anything.

- **A song the user (or their client) has.** They paste the lyrics and provide the audio file. Don't
  copy lyrics from lyrics sites or download audio from YouTube or Spotify yourself, even "for a
  portfolio". Say that once, plainly, and offer the paths below. Pasted lyrics and a provided file are
  fine to use.
- **A famous public-domain song.** You can do this entirely alone: the lyrics are public, the
  arrangement comes from `scripts/synth.py`, and exact word times come free. Only pick tunes you know
  note for note, such as Clementine, Happy Birthday, Jingle Bells, When the Saints Go Marching In,
  Ode to Joy or Twinkle Twinkle. "Famous" means people will notice a wrong note. If you're unsure of a
  melody (for example Hava Nagila beyond its first phrase), don't guess.
- **An original song.** Same pipeline as public domain; see `scripts/compose.py`.

With no real singer, a whistle "sings" the melody, one note per syllable, and the words land on those
notes. Tell the user that up front; a sung voice would need TTS or music-generation credits.

## 2. Get word timings (you can't hear audio, so never invent them)

| Situation | How | Result |
|---|---|---|
| Song composed in code | The song script knows every syllable's time (see `scripts/clementine.py`) | It writes the data file itself |
| Audio file plus internet (a session on the user's computer) | `python scripts/align.py song.mp3 lyrics.txt he > engine/data.js` (`pip install stable-ts demucs`; `en` for English) | Word-level times plus the beat grid |
| Audio, but no speech model or network | Publish `assets/lyric-sync.html` as an Artifact (below) | Line-level taps plus the browser's beat analysis |

**The tap page.** It's a Hebrew, phone-first page: paste the lyrics, play the song (a local file, or
Spotify in another tab), and tap whenever a line starts. Before publishing, edit its title, eyebrow
and heading for the song. Publish it with `capabilities: {"db": {}}`. After the user says they're
done, read it back: ArtifactData `get`, collection `sync`, document `current`, saved to
`out/sync.json`. Then run `python3 scripts/make_data.py out/sync.json [song.mp3] > engine/data.js`,
which snaps each tap to the nearest musical onset. Taps can be tiring, so offer `align.py` first
whenever the user can run a session on their own computer.

`lyrics.txt` has one sung line per row. A row like `[פזמון]` or `[Chorus]` labels the lines after it.
Labels pick the worlds: choruses go to `dusk`, other sections rotate through the rest.

## 3. Configure the video

`engine/data.js` defines `window.SONG` (opener and posters) and `window.LYRICS` (lines, timing, style
switches). The full schema and every option is in `references/data-format.md`. Read it before writing
data by hand. The settings that matter most:

- `SONG.words` holds the two slam words, `SONG.hero` the word whose letters drop, `SONG.posters` the three wall credits.
- `LYRICS.dir` is `rtl` or `ltr`. `upper` gives all caps for English. `keywords` are regexes for the gold, red and sunset words.
- A line's optional `world` overrides its section's world. Its `words: [{text, t}]` gives exact times.

The intro stretches (the wall holds) or squeezes (shorter credits) so that it ends right before the
first sung line.

## 4. Compose the music (public-domain or original songs)

`scripts/synth.py` is a numpy-only toolkit: a Karplus-Strong guitar and banjo, bass, a whistle lead,
a formant choir, a western kit, an 808/clap/hat trap kit, sound design that matches the opener's hits
(`opener_sfx`), reverb, and mastering. `scripts/clementine.py` is the template to copy: a country-trap
remix, 96 BPM, a tune table of one note per syllable, and arrangement written bar by bar. Read
`references/music.md` for the API, arrangement recipes and the checks to run. Because you can't
listen, check the result by measurement: run the pitch check from that file and fix any syllable
that's more than 50 cents off. Also print RMS per section; aim for about −11 to −14 dBFS in the song.

## 5. Preview, then render

Set-up: Node with `playwright` (global or `npm i playwright` in `engine/`), Chromium, ffmpeg, and Python 3 with numpy.
Fonts are bundled in `engine/fonts/`, so the engine works offline.

```bash
cd engine && cp examples/data.clementine.js data.js          # or your own data.js
node render.cjs stills=2,4,9,20,40 dir=out/stills              # check frames first
node render.cjs out=out/video.mp4 workers=3 img=jpeg preset=medium audio=../out/song.wav
```

- When the global playwright isn't found, prefix commands with `NODE_PATH=$(npm root -g)`.
- Tile the stills into a contact sheet (ffmpeg `tile=8x2`) to review many moments in one image.
- Rename stills with zero-padded times so they sort in time order.
- Speed: about 3 frames per second with 3 workers and jpeg/medium (a 55-second video takes about 10 minutes). png/slow is about 2.5× slower and looks nearly the same.
- Long renders: start them in the background, write `exit $?` to the log at the end, and watch the log. Don't use `pgrep`; it matches its own watcher.
- Check that all workers print progress within the first minute. A worker that dies early leaves a gap.

For delivery, make a phone copy: `-c:v libx264 -b:v 8M -maxrate 11M -bufsize 16M -c:a aac -b:a 192k
-movflags +faststart`. AAC can push peaks to 0 dB, so remux the audio with `volume=-1.5dB`. Send the
file to the user, and mention that adding the song from Instagram's music library avoids muted Reels.

## Lessons that cost time once

- The engine builds only after `window` `load`, because `lyrics-engine.js` is a later script. Without that wait, parallel renders crash at random.
- Lyric text sits in its own layer (`z-index` 5) above the world backgrounds. Blend-mode layers inside a world otherwise cover the text.
- Anything inside a zero-width anchor needs `white-space: nowrap` or explicit fitting. The title card once wrapped word by word and ran off screen.
- Long English words (CLEMENTINE) need fitting everywhere: the hero letters, the lockups and the posters.
- In right-to-left mode, extrude text down and to the left. Shadows then fall under the next letter, not over the previous one.
- When the user writes in Hebrew, answer in Hebrew. For Liat's projects, keep user-facing copy gender-neutral (infinitives, plural forms, first-person past and future tense).
- Never push lyric-video work to `main` in the Master Video repo; main auto-deploys the live site. Use a branch.
