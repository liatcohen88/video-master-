# engine/data.js

`engine/index.html` loads `data.js` before its own script. When the file is missing, it shows the
original "הטוב הרע ועודיה" opener on its own. Two globals:

```js
window.SONG = { /* opener and credit posters */ };
window.LYRICS = { /* the song part */ };
```

## window.SONG (opener)

| key | meaning | example |
|---|---|---|
| `title` | browser/document title | `"Oh My Darling, Clementine"` |
| `dir` | `rtl` (Hebrew) or `ltr` (English); also flips the letter order and the dust/glint positions | `"ltr"` |
| `words` | the two slam words: yellow scene, then red scene | `["OH MY", "DARLING"]` |
| `hero` | the word whose letters drop onto the sun, one span per letter | `"CLEMENTINE"` |
| `heroSize` | largest font size in px for the hero; it's fitted to 900 px width | `300` (Hebrew 4 letters: `380`) |
| `letterGap` | seconds between letters; keep letters × gap under about 0.5 s | `0.05` for 10 letters, `0.075` default |
| `lock` | the two words that fly in above the hero at 3.98 s | `["OH MY", "DARLING"]` |
| `posters` | three `{kicker, name}` credits on the saloon wall | `[{"kicker":"GOLD RUSH","name":"1849"}, …]` |

The opener's timeline is the `T` object in index.html (8.0 s): first slam 0.16, shot through the
star 1.30, second slam 1.56, three shots and the fall 1.96 to 2.64, sunset and letters 2.64 to 3.7,
lockup clash 4.22, whip pan 5.20, poster slaps 5.68 / 6.42 / 7.04, end 8.0. `synth.opener_sfx`
hits the same times.

## window.LYRICS (song)

```js
window.LYRICS = {
  lines: [
    { t: 10.5, text: "In a cavern, in a canyon", label: "Verse 1", world: "night",
      words: [{ text: "In", t: 10.5 }, { text: "a", t: 10.97 }, /* … */] },
    // …
  ],
  end: 50.5,                       // when the last line is over; the outro title card starts here
  audio: { bpm: 96, beats: [8.0, 8.625, …], onsets: […], duration: 55.0 },
  keywords: { good: "^darling$", bad: "^(lost|brine)$", hero: "^clementine$" },
  title: { l1: ["OH MY", "DARLING"], l2: "CLEMENTINE" },
  dir: "ltr", upper: true, holes: false,
  worlds: { "Bridge": "wall" },    // optional label → world map
};
```

- **lines[].t**: when the line starts, in song time (the video's t = 0 is the audio's 0:00).
- **lines[].words**: optional exact word times. Without them, the engine spreads words over the
  line, weighted by length and snapped to `audio.onsets` within ±90 ms.
- **lines[].world**: optional per-line world; otherwise the section label decides. Labels that
  contain פזמון / chorus / hook / אודיה go to `dusk`; other sections rotate through yellow, red, wall
  and night. Without labels, lines that repeat are treated as the chorus.
- A line stays up until the next line starts, or until its last word plus 2.6 s. A gap of more than
  2.2 s shows the title card (an interlude). After `end` comes the outro: the title card while the sun
  sets, then a fade.
- **keywords** are tested against each word with everything except letters removed, lowercased
  (prefixes like ו/ה are allowed by the regex). `good` turns gold, with a star sparkle. `bad` turns red,
  with a bullet hole and flash unless `holes: false`. `hero` gets a sunset gold with a sparkle.
- **audio.beats** drive a small camera push on every beat. `onsets` are used for snapping.
- **duration** (top level, or `audio.duration`) caps the video length; the default is `end + 4.5`.

## Worlds

| world | background | text | entrance | exit |
|---|---|---|---|---|
| `yellow` | mustard rays, halftone, paper | ink with a red misprint shadow | slam (scale 2.1 → 1, blur) | shrink and fade |
| `red` | blood-red target rings, crosshair | cream, block shadow | slam | shrink and fade |
| `dusk` | sunset sky, striped sun, mesas, cacti | cream, extruded | drop with bounce | fall away |
| `wall` | saloon planks, lamp light | ink on pasted paper strips | stamp with a tilt | shrink and fade |
| `night` | dark sky, moon, ridge | cream with a warm glow | rise | shrink and fade |

A change of world between lines reveals the new one in a circle, with a flash. Each line is fitted
to at most three rows inside 920×660 px, starting large (short lines fill the frame).
