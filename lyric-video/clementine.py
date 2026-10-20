"""'Oh My Darling, Clementine' (traditional, 1884; public domain) as a country-trap
remix: the whistle sings the tune one note per syllable over banjo rolls, 808s,
claps and trap hi-hats. Writes the mix and the lyric timeline for the engine.

    python3 clementine.py out/clementine.wav data.clementine.js
"""
import json
import sys

import synth as S
from synth import (CHOIR, anvil, banjo, bell, bt, choir, clap, eight08, hat, hz, kick, melody, opener_sfx, riser, rms_db,
                   setup, sub_drop, whip, whistle, wind, write)

BPM = 96
S0 = 8.0
END_BAR = 17

# the tune in G major, one note per syllable; 8- and 7-syllable lines alternate
TUNE = [
    (['G5', 'G5', 'G5', 'D5', 'B5', 'B5', 'B5', 'G5'], [3, 1, 3, 1, 3, 1, 3, 1]),   # oh my darling, oh my darling
    (['G5', 'B5', 'D6', 'D6', 'C6', 'B5', 'A5'], [3, 1, 3, 1, 3, 1, 4]),            # oh my darling Clementine
    (['A5', 'B5', 'C6', 'C6', 'B5', 'A5', 'B5', 'G5'], [3, 1, 3, 1, 3, 1, 3, 1]),   # you are lost and gone forever
    (['G5', 'B5', 'A5', 'D5', 'F#5', 'A5', 'G5'], [3, 1, 3, 1, 3, 1, 4]),           # dreadful sorry Clementine
]
LINE_CHORDS = [['G', 'G'], ['G', 'D7'], ['D7', 'G'], ['G', 'D7']]

VERSE1 = [
    [('In', 1), ('a', 1), ('cavern,', 2), ('in', 1), ('a', 1), ('canyon', 2)],
    [('Excavating', 4), ('for', 1), ('a', 1), ('mine', 1)],
    [('Dwelt', 1), ('a', 1), ('miner,', 2), ('forty-niner', 4)],
    [('And', 1), ('his', 1), ('daughter', 2), ('Clementine', 3)],
]
CHORUS = [
    [('Oh', 1), ('my', 1), ('darling,', 2), ('oh', 1), ('my', 1), ('darling', 2)],
    [('Oh', 1), ('my', 1), ('darling,', 2), ('Clementine', 3)],
    [('You', 1), ('are', 1), ('lost', 1), ('and', 1), ('gone', 1), ('forever', 3)],
    [('Dreadful', 2), ('sorry,', 2), ('Clementine', 3)],
]
VERSE2 = [
    [('Drove', 1), ('she', 1), ('ducklings', 2), ('to', 1), ('the', 1), ('water', 2)],
    [('Every', 2), ('morning', 2), ('just', 1), ('at', 1), ('nine', 1)],
    [('Hit', 1), ('her', 1), ('foot', 1), ('against', 2), ('a', 1), ('splinter', 2)],
    [('Fell', 1), ('into', 2), ('the', 1), ('foaming', 2), ('brine', 1)],
]
SECTIONS = [
    (1, 'Verse 1', VERSE1, ['night', 'night', 'wall', 'wall']),
    (5, 'Chorus', CHORUS, ['dusk'] * 4),
    (9, 'Verse 2', VERSE2, ['yellow', 'yellow', 'red', 'red']),
    (13, 'Chorus', CHORUS, ['dusk'] * 4),
]
BANJO = {'G': ['G4', 'B4', 'D5'], 'D7': ['F#4', 'A4', 'C5']}
ROOT = {'G': 'G1', 'D7': 'D2'}
ROLL = [0, 1, 2, 0, 1, 2, 0, 1]            # banjo forward roll over eight 16ths


def part_of(b):
    if b == 0:
        return 'lead'
    if b == END_BAR:
        return 'outro'
    if 5 <= b <= 8 or 13 <= b <= 16:
        return 'chorus'
    return 'soft' if b in (9, 10) else 'verse'


def bar_groove(b, prev_root):
    t, q = bt(b), S.BEAT
    part = part_of(b)
    chords = LINE_CHORDS[(b - 1) % 4] if 1 <= b < END_BAR else ['G', 'G']
    if part == 'outro':
        eight08('G1', t, 2.6, 0.42, glide_from=prev_root)
        kick(t, 0.5)
        clap(t, 0.2)
        choir(CHOIR['G'], t, 2.6, gain=0.05, release=1.6)
        for s in range(8):
            banjo(BANJO['G'][ROLL[s]], t + s * q / 4, 0.09 * (1 - s / 10))
        whistle([(t, 0.75 * q, hz('F#5')), (t + 0.75 * q, 0.25 * q, hz('A5')), (t + q, 2.4 * q, hz('G5'))], gain=0.3)
        bell(t + 2 * q, 0.2, hz('G3'))
        return 'G1'
    chorus = part == 'chorus'
    for half, ch in enumerate(chords):
        for s in range(8):
            banjo(BANJO[ch][ROLL[s]], t + (half * 2 + s / 4) * q, (0.1 if chorus else 0.085) * (1.15 if s % 4 == 0 else 0.85))
        if chorus:
            choir(CHOIR[ch], t + half * 2 * q, 2 * q - 0.05, gain=0.042, attack=0.3, release=0.5)
    if part == 'lead':
        for e in range(8):
            hat(t + e * q / 2, 0.02 + 0.035 * e / 8)
        riser(t + q, 3 * q)
        eight08('G1', t + 3 * q, 0.9 * q, 0.38, glide_from='D1')
        return 'G1'
    # 808 and kick: root on 1, a push on the "a" of 2, the second chord on 3
    r1, r2 = ROOT[chords[0]], ROOT[chords[1]]
    if part != 'soft':
        eight08(r1, t, 1.6 * q, 0.42, glide_from=prev_root if prev_root != r1 else None)
        eight08(r1, t + 1.75 * q, 0.3 * q, 0.34)
        eight08(r2, t + 2 * q, 1.4 * q, 0.42, glide_from=r1 if r2 != r1 else None)
        for beat in (0, 1.75, 2.5):
            kick(t + beat * q, 0.5 if beat == 0 else 0.42)
    for beat in (1, 3):
        clap(t + beat * q, 0.17 if part == 'soft' else 0.26)
    steps = 16 if chorus else 8
    for s in range(steps):
        hat(t + s * 4 * q / steps, (0.055 if s % 2 else 0.04) if chorus else (0.05 if s % 2 else 0.035))
    if chorus and b % 2 == 0:                # trap roll into the next bar
        for k in range(6):
            hat(t + 3.5 * q + k * q / 12, 0.025 + 0.035 * k / 6, pan=-0.2)
    if chorus:
        hat(t + 3.5 * q, 0.04, open_=True)
    return r2 if part != 'soft' else prev_root


def song():
    lines = []
    for bar0, label, verse, worlds in SECTIONS:
        for k, words in enumerate(verse):
            notes, rhythm = TUNE[k]
            assert sum(n for _, n in words) == len(notes) == len(rhythm), words
            mel = melody(bar0 + k, rhythm, notes)
            whistle([(t, d * (0.86 if j == len(mel) - 1 else 1.0), f) for j, (t, d, f) in enumerate(mel)],
                    gain=0.36 if label == 'Chorus' else 0.33)
            out, si = [], 0
            for w, ns in words:
                out.append({'text': w, 't': round(mel[si][0], 3)})
                si += ns
            lines.append({'t': round(bt(bar0 + k), 3), 'text': ' '.join(w for w, _ in words), 'label': label,
                          'world': worlds[k], 'words': out})
    prev = 'D1'
    for b in range(END_BAR + 1):
        prev = bar_groove(b, prev)
    for b in (4, 12):                         # rise into each chorus, drop on its first beat
        riser(bt(b, 8), 2 * S.BEAT)
    for b in (5, 13):
        sub_drop(bt(b), 0.45)
        anvil(bt(b), 0.12)
    whip(bt(1), 0.36)
    whip(bt(13), 0.36)
    return lines


def main():
    wav_path, data_path = sys.argv[1], sys.argv[2]
    setup(S0 + END_BAR * 4 * 60 / BPM + 4.5, BPM, S0, seed=11)
    scale = ['G5', 'A5', 'B5', 'C6', 'D6', 'E6', 'F#6', 'G6', 'A6', 'B6']
    q = S.BEAT
    opener_sfx('G', ['G1', 'D2'], [(2.98 + i * 0.05 + 0.16, hz(n)) for i, n in enumerate(scale)],
               [(4.32, 0.75 * q * 0.5, hz('G6')), (4.32 + 0.375 * q, 0.125 * q, hz('G6')), (4.32 + 0.5 * q, 0.375 * q, hz('G6')),
                (4.32 + 0.875 * q, 0.55, hz('D6'))], 'G3', S0)
    lines = song()
    wind()
    mix = write(wav_path)
    for name, a, b in (('intro', 0, 8), ('verse1', bt(1), bt(5)), ('chorus1', bt(5), bt(9)), ('verse2', bt(9), bt(13)),
                       ('chorus2', bt(13), bt(17)), ('outro', bt(17), S.DUR)):
        print(f'{name:8s} rms {rms_db(mix, a, b):6.1f} dBFS', file=sys.stderr)

    beats = [round(bt(0) + k * q, 3) for k in range(int((S.DUR - S0) / q))]
    onsets = sorted({w['t'] for l in lines for w in l['words']} | set(beats))
    data = {
        'lines': lines, 'end': round(bt(END_BAR), 3),
        'audio': {'bpm': BPM, 'beats': beats, 'onsets': onsets, 'duration': round(S.DUR, 3)},
        'keywords': {'good': '^darling$', 'bad': '^(lost|brine)$', 'hero': '^clementine$'},
        'title': {'l1': ['OH MY', 'DARLING'], 'l2': 'CLEMENTINE'},
        'dir': 'ltr', 'upper': True, 'holes': False,
    }
    song_cfg = {
        'title': 'Oh My Darling, Clementine', 'dir': 'ltr', 'hero': 'CLEMENTINE', 'heroSize': 300, 'letterGap': 0.05,
        'words': ['OH MY', 'DARLING'], 'lock': ['OH MY', 'DARLING'],
        'posters': [{'kicker': 'THE BALLAD OF', 'name': 'CLEMENTINE'}, {'kicker': 'GOLD RUSH', 'name': '1849'},
                    {'kicker': 'FOLK SONG', 'name': '1884'}],
    }
    with open(data_path, 'w', encoding='utf-8') as f:
        f.write("// 'Oh My Darling, Clementine' (traditional, public domain): timeline from clementine.py.\n")
        f.write('window.SONG = ' + json.dumps(song_cfg, ensure_ascii=False) + ';\n')
        f.write('window.LYRICS = ' + json.dumps(data, ensure_ascii=False) + ';\n')
    print(f'{len(lines)} lines, {S.DUR:.1f}s -> {wav_path}, {data_path}', file=sys.stderr)


if __name__ == '__main__':
    main()
