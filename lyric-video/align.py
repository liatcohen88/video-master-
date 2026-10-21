"""Sync pasted lyrics to a song automatically with Whisper (stable-ts), then add the
beat grid, and write data.js for lyrics-engine.js — no tapping needed.

    pip install stable-ts demucs
    python align.py song.mp3 lyrics.txt he > data.js        # "en" for English songs

lyrics.txt: one sung line per row; a row like [Chorus] or [איזי] labels the lines after it.
Needs a Whisper model, downloaded on first run — so run it on a machine with internet
access (written in a sandbox without one, so it hasn't been run end to end yet).
"""
import json
import re
import sys

import analyze_audio as aa


def read_lyrics(path):
    lines, label = [], ''
    for raw in open(path, encoding='utf-8'):
        s = raw.strip()
        if not s:
            continue
        m = re.fullmatch(r'\[(.+)\]', s)
        if m:
            label = m.group(1).strip()
        else:
            lines.append({'text': s, 'label': label})
    return lines


def norm(s):
    return re.sub(r'[^\w]', '', s, flags=re.UNICODE).lower()


def main():
    audio_path, lyrics_path = sys.argv[1], sys.argv[2]
    lang = sys.argv[3] if len(sys.argv) > 3 else 'he'
    import stable_whisper

    lines = read_lyrics(lyrics_path)
    model = stable_whisper.load_model('large-v3')
    result = model.align(audio_path, '\n'.join(l['text'] for l in lines), language=lang, denoiser='demucs')
    aligned = [w for seg in result.segments for w in seg.words]

    # map lyric words to aligned words by character offset, so differences in
    # how the model splits words (prefixes, punctuation) can't shift the lines
    starts, pos = [], 0
    for w in aligned:
        starts.append((pos, w.start))
        pos += len(norm(w.word))
    out, pos, k = [], 0, 0
    for line in lines:
        words = []
        for text in line['text'].split():
            while k + 1 < len(starts) and starts[k + 1][0] <= pos:
                k += 1
            words.append({'text': text, 't': round(float(starts[k][1]), 3)})
            pos += len(norm(text))
        out.append({'t': words[0]['t'], 'text': line['text'], 'label': line['label'], 'words': words})

    y = aa.load(audio_path)
    env, _ = aa.onset_envelope(y)
    env_s = aa.smooth(env)
    bpm = aa.tempo(env_s)
    data = {
        'lines': out,
        'end': round(float(aligned[-1].end) + 0.3, 3),
        'audio': {'bpm': round(bpm, 2), 'beats': [round(float(b), 3) for b in aa.track_beats(env_s, bpm)],
                  'onsets': [round(t, 3) for t in aa.peaks(env)], 'duration': round(len(y) / aa.SR, 3)},
    }
    sys.stdout.write('window.LYRICS = ' + json.dumps(data, ensure_ascii=False) + ';\n')
    print(f'{len(out)} lines aligned, {bpm:.1f} bpm', file=sys.stderr)


if __name__ == '__main__':
    main()
