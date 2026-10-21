# Composing with scripts/synth.py

Numpy only: no samples and no network. Call `setup(duration, bpm, s0, seed)` first. `s0` is when
bar 0 starts (8.0, right after the visual opener). Every instrument mixes into the module's stereo
buses at an absolute time; `write(path)` adds reverb, masters to −1 dBFS and saves a 44.1 kHz WAV.

## The building blocks

| call | what it is |
|---|---|
| `bt(bar, sixteenth=0)` | time of a bar or 16th position (bar 0 = s0) |
| `hz('F#5')`, `melody(bar, durs16, notes)` | pitch; `[(t, dur, freq)]` from 16th-note durations |
| `whistle(notes, gain)` | lead "voice": vibrato, glides, a dip to re-articulate each legato syllable |
| `pluck`, `strum(chord, t, down, upper)`, `bass`, `twang`, `banjo` | Karplus-Strong strings |
| `choir(names, t, dur)` | formant "aah" pad (choruses, intro, endings) |
| `kick`, `rim`, `snare`, `tom`, `shaker`, `hoof` (gallop), `whip`, `anvil`, `bell` | western kit |
| `eight08(name, t, dur, glide_from)`, `clap`, `hat(open_)`, `riser`, `sub_drop` | trap kit |
| `gunshot`, `ricochet`, `impact`, `whoosh`, `creak`, `slap`, `tok`, `ting`, `clink`, `crackle`, `drone`, `wind` | sound design |
| `opener_sfx(chord, drone_notes, toks, motif, roll_note, s0)` | every hit of the shared 8-second opener |

Chord tables (`CHORDS`, `BASS`, `CHOIR`) cover Am, G, F, E, C, D, D7 and Em; add any others you need.

## Recipe

1. **Lyrics table**: for each line, list `[(word, syllables), …]`, a melody (one note per syllable)
   and 16th-note durations that add up to 16 per bar (one line per bar reads well at 96–100 BPM). Use
   `assert` to make syllables, notes and durations match. Put stressed syllables on the long notes.
2. **Whistle register**: put the tune between D5 and F6; transpose up an octave from the vocal key.
3. **Word times**: the time of each word's first syllable, `melody(...)[i][0]`. Write them into
   `lines[].words`, so the sync is exact.
4. **Arrangement per bar**:
   - Western "boom-chick" (`compose.py`): bass on beats 1 and 3, chord strums on 2 and 4, horse-hoof gallop, choir in choruses.
   - Country-trap (`clementine.py`): a banjo forward roll in 16ths (`[0,1,2,0,1,2,0,1]` over the chord tones), 808 on the roots with slides, kick on 1, the "a" of 2 and the "and" of 3, claps on 2 and 4, 8th or 16th hats with a sextuplet roll every other chorus bar, a riser and sub drop into each chorus, and a lighter second verse.
5. **Hits that match the visuals**: `opener_sfx` for the opener; small accents on keywords (a short
   `gunshot` on red words, `ting` on gold ones). The engine shows a flash or hole there anyway.
6. **Data**: write `window.SONG` and `window.LYRICS` (see data-format.md) with the beat grid
   `[bt(0) + k * BEAT …]` and onsets equal to the syllable times.

## Checks, because you can't listen

```python
# pitch: dominant frequency in the whistle band at each syllable's middle vs the written note
import numpy as np, wave
w = wave.open('out/song.wav'); sr = w.getframerate()
x = np.frombuffer(w.readframes(w.getnframes()), '<i2').reshape(-1, 2).mean(1) / 32768
for t, d, f in all_notes:   # from melody(...)
    i = int((t + min(d, .25) * .6) * sr); seg = x[i:i + 4096] * np.hanning(4096)
    sp = np.abs(np.fft.rfft(seg)); fr = np.fft.rfftfreq(4096, 1 / sr)
    k = np.argmax(sp * ((fr > 520) & (fr < 1700)))
    cents = 1200 * np.log2(fr[k] / f)    # expect |cents| < 50 everywhere (achieved: median ~1)
```

Also print RMS per section (song parts around −11 to −14 dBFS), make sure the peak is at most −1 dBFS
with no clipped samples, and look at a spectrogram image (the melody line, drum transients, choir
bands). Seeds make every run reproducible; after refactoring, `cmp` the WAVs to prove nothing changed.

## Melodies known to be right (key of C; transpose as needed)

- Clementine (each line 8 or 7 syllables): `C C C G3 E E E C | C E G G F E D | D E F F E D E C | C E D G3 B3 D C`.
- Happy Birthday: `G G A G C5 B | G G A G D5 C5 | G G G5 E5 C5 B A | F5 F5 E5 C5 D5 C5`.
- Jingle Bells (chorus): `E E E | E E E | E G C D E | F F F F F E E E E D D E D G`.
- When the Saints: `C E F G | C E F G | C E F G E C E D | E E D C C E G G F | E F G E C D C`.
