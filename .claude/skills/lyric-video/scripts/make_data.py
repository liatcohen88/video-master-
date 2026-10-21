"""Build data.js for the lyric engine from the sync page's saved document.

    python3 make_data.py out/sync.json [song.mp3] > data.js

sync.json is the `sync/current` document of the sync page (lines with tapped
times, end, and the browser's beat analysis). When the song file is given, the
beat grid is recomputed from it with analyze_audio.py instead.
"""
import bisect
import json
import sys


def snap(t, onsets, window=0.12):
    """Pull a tapped line start onto the nearest onset, if one is close."""
    if not onsets:
        return t
    i = bisect.bisect_left(onsets, t)
    near = [o for o in onsets[max(0, i - 1):i + 1] if abs(o - t) <= window]
    return min(near, key=lambda o: abs(o - t)) if near else t


def main():
    doc = json.load(open(sys.argv[1], encoding='utf-8'))
    doc = doc.get('data', doc)  # accept either the bare document or a wrapped read
    audio = doc.get('audio') or {}
    if len(sys.argv) > 2:
        import analyze_audio as aa
        y = aa.load(sys.argv[2])
        env, _ = aa.onset_envelope(y)
        env_s = aa.smooth(env)
        bpm = aa.tempo(env_s)
        audio = {
            'name': sys.argv[2], 'duration': round(len(y) / aa.SR, 3), 'bpm': round(bpm, 2),
            'beats': [round(float(b), 3) for b in aa.track_beats(env_s, bpm)],
            'onsets': [round(t, 3) for t in aa.peaks(env)],
        }
    onsets = sorted(audio.get('onsets') or [])
    lines = []
    for line in doc['lines']:
        if line.get('t') is None or not str(line.get('text', '')).strip():
            continue
        lines.append({'t': round(snap(float(line['t']), onsets), 3), 'text': line['text'].strip(), 'label': line.get('label', '')})
    out = {'lines': lines, 'end': doc.get('end'), 'audio': audio}
    sys.stdout.write('window.LYRICS = ' + json.dumps(out, ensure_ascii=False) + ';\n')
    print(f'{len(lines)} lines, end {doc.get("end")}, bpm {audio.get("bpm")}', file=sys.stderr)


if __name__ == '__main__':
    main()
