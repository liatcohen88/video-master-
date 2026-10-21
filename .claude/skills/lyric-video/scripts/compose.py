"""Original song "הטוב, הרע ואני" — lyrics, melody, arrangement and sound design,
synthesized with numpy only (no samples, no generation credits).

    python3 compose.py out/song.wav data.original.js

Writes the stereo mix and the lyric timeline (one note per syllable, so every
word's time is exact) for the lyric engine. The first 8 s are sound design
for the visual intro; the song itself is 100 BPM in A minor, whistle-led.
"""
import json
import sys

import synth as S
from synth import (CHOIR, CHORDS, BASS, anvil, bass, bell, bt, choir, clink, crackle, creak, drone, gunshot, hoof, hz,
                   impact, kick, melody, opener_sfx, partials, ricochet, rim, rms_db, setup, shaker, slap, snare, strum, ting, tok, tom,
                   twang, whip, whistle, whoosh, wind, write)

S0 = 8.0                     # the groove starts when the intro visuals end
END_BAR = 21                 # lyrics end at the start of bar 21
BAR_LEN = 4 * 60 / 100


# ---------------------------------------------------------------- the song
CH = [
    ([('הטוב,', 2), ('הרע', 2), ('ואני', 3)], [2, 2, 2, 4, 1, 1, 4], ['A5', 'C6', 'C6', 'F6', 'E6', 'C6', 'A5']),
    ([('שלושה', 2), ('צללים', 3), ('על', 1), ('החול', 2)], [2] * 8, ['B5', 'D6', 'D6', 'B5', 'G5', 'A5', 'B5', 'D6']),
    ([('כל', 1), ('אחד', 2), ('שורק', 2), ('לבד', 2)], [2, 2, 2, 2, 4, 2, 2], ['E6', 'E6', 'D6', 'C6', 'G5', 'A5', 'C6']),
    ([('עד', 1), ('שהשמש', 4), ('נופלת', 3)], [2, 1, 1, 2, 2, 2, 2, 4], ['B5', 'C6', 'B5', 'A5', 'G#5', 'B5', 'D6', 'E6']),
]
LYRICS = [
    (1, 'בית 1', 'yellow', [('עיר', 1), ('של', 1), ('אבק', 2), ('בצהריים', 5)], [2, 2, 2, 2, 2, 2, 1, 1, 2], ['E5', 'E5', 'A5', 'B5', 'C6', 'B5', 'A5', 'G5', 'A5']),
    (2, 'בית 1', 'yellow', [('פעמון', 3), ('ישן', 2), ('מצלצל', 3)], [2] * 8, ['D6', 'C6', 'B5', 'G5', 'A5', 'B5', 'A5', 'G5']),
    (3, 'בית 1', 'yellow', [('הטוב', 2), ('עומד', 2), ('עם', 1), ('כוכב', 2)], [2, 4, 2, 2, 2, 2, 2], ['C6', 'A5', 'A5', 'C6', 'D6', 'C6', 'A5']),
    (4, 'בית 1', 'yellow', [('והרע', 3), ('מחייך', 3), ('בשקט', 3)], [2, 2, 4, 2, 1, 1, 1, 1, 2], ['B5', 'B5', 'E6', 'D6', 'C6', 'B5', 'A5', 'G#5', 'B5']),
    *[(5 + k, 'פזמון', 'dusk', *c) for k, c in enumerate(CH)],
    (10, 'בית 2', 'wall', [('דלתות', 2), ('הסלון', 3), ('נפתחות', 3)], [2] * 8, ['E5', 'E5', 'A5', 'B5', 'C6', 'B5', 'A5', 'A5']),
    (11, 'בית 2', 'wall', [('כולם', 2), ('מחכים', 3), ('לצהריים', 5)], [2, 2, 1, 1, 2, 1, 1, 2, 2, 2], ['D6', 'C6', 'B5', 'B5', 'G5', 'G5', 'A5', 'B5', 'A5', 'G5']),
    (12, 'דו-קרב', 'red', [('הטוב', 2), ('שולף,', 2), ('הרע', 2), ('שולף', 2)], [2] * 8, ['C6', 'A5', 'G5', 'F5', 'C6', 'A5', 'G5', 'F5']),
    (13, 'בדרך', 'night', [('ואני', 3), ('כבר', 1), ('רכבתי', 3), ('משם', 2)], [1, 1, 2, 2, 2, 2, 2, 2, 2], ['B5', 'B5', 'E6', 'D6', 'C6', 'B5', 'A5', 'G#5', 'E5']),
    *[(14 + k, 'פזמון', 'dusk', *c) for k, c in enumerate(CH)],
    (18, 'סיום', 'dusk', *CH[0]),
    (19, 'סיום', 'dusk', [('והשמש', 4), ('שוקעת', 3), ('במערב', 4)], [2, 2, 2, 2, 4, 2, 2, 4, 4, 2, 6], ['B5', 'B5', 'D6', 'D6', 'E6', 'D6', 'B5', 'C6', 'B5', 'A5', 'A5']),
]
BARS = ['Am', 'Am', 'G', 'F', 'E', 'F', 'G', 'C', 'E', 'Am', 'Am', 'G', 'F', 'E', 'F', 'G', 'C', 'E', 'F', 'G', 'Am']
CHORUS = set(range(5, 9)) | set(range(14, 19))


def build_song():
    lines = []
    for bar, label, world, words, durs, notes in LYRICS:
        assert sum(n for _, n in words) == len(durs) == len(notes), (bar, words)
        assert sum(durs) in (16, 32), (bar, sum(durs))
        mel = melody(bar, durs, notes)
        legato = [(t, d * (0.86 if k == len(mel) - 1 else 1.0), f) for k, (t, d, f) in enumerate(mel)]
        whistle(legato, gain=0.36 if bar in CHORUS else 0.33)
        out, si = [], 0
        for w, ns in words:
            out.append({'text': w, 't': round(mel[si][0], 3)})
            si += ns
        lines.append({'t': round(bt(bar), 3), 'text': ' '.join(w for w, _ in words), 'label': label, 'world': world, 'words': out})

    # rhythm section, bar by bar
    for b, ch in enumerate(BARS):
        t = bt(b)
        root, fifth = BASS[ch]
        chorus = b in CHORUS
        duel = b == 12
        last = b == 20
        if last:
            bass(root, t, dur=2.2, gain=0.5)
            strum(ch, t, upper=False, gain=0.24, t60=2.4, spread=0.03)
            kick(t, 0.6)
            choir(CHOIR[ch], t, 3.6, gain=0.06, release=1.6)
            continue
        if duel:   # stop-time: one hit, then the two guns being cocked
            bass(root, t, dur=1.2, gain=0.55)
            kick(t, 0.6)
            for s16 in (6, 14):
                partials(bt(b, s16), [(3100, 1, 60), (5200, 0.5, 80)], 0.12, 0.14, 0.25, 0.15)
                partials(bt(b, s16 + 0.5), [(2300, 1, 70)], 0.1, 0.1, -0.25, 0.15)
            for k in range(32):     # nervous tremolo guitar
                twang('F3' if k % 2 else 'C4', bt(b, k / 2), 0.1, 0.05 + 0.06 * k / 32)
            continue
        bass(root, t, gain=0.5)
        bass(fifth, t + 2 * S.BEAT, gain=0.45)
        kick(t, 0.6 if chorus else 0.45)
        kick(t + 2 * S.BEAT, 0.5 if chorus else 0.38)
        rim(t + S.BEAT, 0.2)
        rim(t + 3 * S.BEAT, 0.2)
        if chorus:
            for beat in range(4):
                strum(ch, t + beat * S.BEAT, down=True, upper=False, gain=0.2, t60=0.9)
                strum(ch, t + (beat + 0.5) * S.BEAT, down=False, gain=0.18, t60=0.6)
            for e8 in range(8):
                shaker(t + e8 * S.BEAT / 2, 0.05 if e8 % 2 else 0.035)
            tom(t, 0.3)
            choir(CHOIR[ch], t, S.BAR - 0.1, gain=0.05)
        else:
            for beat in (1, 3):
                strum(ch, t + beat * S.BEAT, down=True, gain=0.24, t60=0.45)
            strum(ch, t + 3.5 * S.BEAT, down=False, gain=0.2, t60=0.35)
            gallop = 2 if b == 13 else 1
            for beat in range(4):
                for s16 in ((0, 2, 3) if gallop == 1 else (0, 1, 2, 3)):
                    hoof(t + (beat + s16 / 4) * S.BEAT, high=s16 != 2, gain=0.11 if s16 else 0.14, pan=-0.2 + 0.4 * (s16 % 2))
    # accents that match the video's keyword effects (bullet hole on הרע, sparkle on הטוב / ואני)
    for line in lines:
        for w in line['words']:
            bare = ''.join(ch for ch in w['text'] if '\u05d0' <= ch <= '\u05ea')
            if bare in ('הרע', 'והרע'):
                gunshot(w['t'], 0.14, pan=0.25, echo=False)
            elif bare in ('הטוב', 'והטוב', 'אני', 'ואני'):
                ting(w['t'] + 0.1, 0.05)
    anvil(bt(5), 0.14)
    anvil(bt(14), 0.14)
    for b in (1, 10):
        whip(bt(b), 0.4)
    gunshot(bt(13, 15), 0.22, pan=-0.6, distant=True)
    ricochet(bt(13, 15) + 0.08, 0.06, pan=-0.5)

    # lead-in riff (bar 0) and turnaround (bar 9)
    for s16, d, nm in ((0, 2, 'A3'), (2, 2, 'C4'), (4, 2, 'D4'), (6, 2, 'E4'), (8, 2, 'G4'), (10, 2, 'E4'), (12, 1, 'D4'), (13, 1, 'C4'), (14, 2, 'A3')):
        twang(nm, bt(0, s16), d * S.BEAT / 4 + 0.15, 0.28)
    whistle(melody(9, [2, 2, 2, 2, 4, 4], ['E6', 'D6', 'C6', 'B5', 'A5', 'E5']), gain=0.3)
    for s16, nm in ((8, 'A3'), (10, 'C4'), (12, 'E4'), (14, 'A4')):
        twang(nm, bt(9, s16), 0.4, 0.22)
    bell(bt(END_BAR), 0.24, hz('A3'))
    return lines


def build_intro():
    """Sound design for the 8 s visual intro (times match index.html's T)."""
    opener_sfx('Am', ['A1', 'E2'], [(2.98 + i * 0.075 + 0.16, hz(n)) for i, n in enumerate(('A5', 'C6', 'D6', 'E6'))],
               [(4.32, 0.33, hz('E6')), (4.66, 0.14, hz('A5')), (4.81, 0.14, hz('B5')), (4.96, 0.5, hz('C6'))], 'A3', S0)


def main():
    wav_path, data_path = sys.argv[1], sys.argv[2]
    setup(S0 + END_BAR * BAR_LEN + 4.5, 100, S0)
    build_intro()
    lines = build_song()
    wind()
    mix = write(wav_path)
    for name, a, b in (('intro', 0, 8), ('verse1', bt(1), bt(5)), ('chorus1', bt(5), bt(9)), ('verse2', bt(10), bt(14)), ('chorus2', bt(14), bt(18)), ('outro', bt(18), S.DUR)):
        print(f'{name:8s} rms {rms_db(mix, a, b):6.1f} dBFS', file=sys.stderr)

    beats = [round(bt(0) + k * S.BEAT, 3) for k in range(int((S.DUR - S0) / S.BEAT))]
    onsets = sorted({w['t'] for l in lines for w in l['words']} | set(beats))
    data = {
        'lines': lines, 'end': round(bt(END_BAR), 3),
        'audio': {'bpm': S.BPM, 'beats': beats, 'onsets': onsets, 'duration': round(S.DUR, 3)},
        'keywords': {'good': '^ו?ה?טוב$', 'bad': '^ו?ה?רע$', 'hero': '^ו?אני$'},
        'title': {'l1': ['הטוב,', 'הרע'], 'l2': 'ואני'},
    }
    song = {
        'title': 'הטוב, הרע ואני', 'hero': 'ואני', 'heroSize': 380, 'lock': ['הטוב,', 'הרע'],
        'posters': [{'kicker': 'מבוקש', 'name': 'הרע'}, {'kicker': 'השריף', 'name': 'הטוב'}, {'kicker': 'זר בעיר', 'name': 'אני'}],
    }
    with open(data_path, 'w', encoding='utf-8') as f:
        f.write('// Original song "הטוב, הרע ואני": lyrics and exact word times from compose.py.\n')
        f.write('window.SONG = ' + json.dumps(song, ensure_ascii=False) + ';\n')
        f.write('window.LYRICS = ' + json.dumps(data, ensure_ascii=False) + ';\n')
    print(f'{len(lines)} lines, {S.DUR:.1f}s -> {wav_path}, {data_path}', file=sys.stderr)


if __name__ == '__main__':
    main()
