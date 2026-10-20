"""Beat/onset analysis for syncing the lyric animation to the song (numpy only).

    python3 analyze_audio.py song.mp3 > out/audio.json

Output: duration, bpm, beat times, onset times (peak-picked spectral flux) and a
coarse loudness envelope, all in seconds.
"""
import json
import subprocess
import sys

import numpy as np

SR, HOP, WIN = 22050, 512, 2048


def load(path):
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', path, '-ac', '1', '-ar', str(SR), '-f', 'f32le', '-'],
                         check=True, capture_output=True).stdout
    return np.frombuffer(raw, dtype=np.float32)


def onset_envelope(y):
    y = np.pad(y, WIN // 2)  # centre the frames so frame i sits at i * HOP
    n = 1 + (len(y) - WIN) // HOP
    frames = np.lib.stride_tricks.as_strided(y, (n, WIN), (y.strides[0] * HOP, y.strides[0]))
    mag = np.abs(np.fft.rfft(frames * np.hanning(WIN), axis=1))
    logmag = np.log1p(100 * mag)
    flux = np.maximum(0, np.diff(logmag, axis=0)).sum(axis=1)
    flux = np.concatenate([[0], flux])
    flux -= np.convolve(flux, np.ones(16) / 16, mode='same')  # remove slow trend
    flux = np.maximum(flux, 0)
    return flux / (flux.max() + 1e-9), np.sqrt((frames ** 2).mean(axis=1))


def smooth(x, sigma=1.5):
    k = np.arange(-4, 5)
    g = np.exp(-0.5 * (k / sigma) ** 2)
    return np.convolve(x, g / g.sum(), mode='same')


def tempo(env, lo=70, hi=180):
    fps = SR / HOP
    ac = np.correlate(env, env, mode='full')[len(env) - 1:]
    lags = np.arange(int(fps * 60 / 240), int(fps * 60 / 40) + 1)
    # strongest periodicity, mildly biased toward ~120 bpm, then folded into [lo, hi]
    bpm = 60 * fps / lags
    score = ac[lags] * np.exp(-0.5 * (np.log2(bpm / 120) / 1.0) ** 2)
    k = int(np.argmax(score))
    lag = float(lags[k])
    if 0 < k < len(lags) - 1:  # parabolic refinement to a fractional lag
        y0, y1, y2 = ac[lags[k] - 1], ac[lags[k]], ac[lags[k] + 1]
        den = y0 - 2 * y1 + y2
        if den < 0:
            lag += 0.5 * (y0 - y2) / den
    best = 60 * fps / lag
    while best < lo:
        best *= 2
    while best > hi:
        best /= 2
    return best


def track_beats(env, bpm, tightness=100):
    """Dynamic-programming beat tracker (Ellis 2007)."""
    fps = SR / HOP
    period = 60 * fps / bpm
    score = env.copy()
    back = np.full(len(env), -1)
    window = np.arange(-int(2 * period), -int(period / 2) + 1)
    cost = -tightness * np.log(-window / period) ** 2
    for i in range(len(env)):
        prev = i + window
        ok = prev >= 0
        if not ok.any():
            continue
        cand = score[prev[ok]] + cost[ok]
        j = np.argmax(cand)
        score[i] = env[i] + cand[j]
        back[i] = prev[ok][j]
    i = int(np.argmax(score[-int(period):]) + len(env) - int(period))
    beats = []
    while i >= 0:
        beats.append(i)
        i = back[i]
    return np.array(beats[::-1]) / fps


def peaks(env, thresh=0.25, min_gap=0.08):
    fps = SR / HOP
    out, last = [], -1e9
    for i in range(1, len(env) - 1):
        if env[i] > thresh and env[i] >= env[i - 1] and env[i] > env[i + 1] and (i - last) / fps >= min_gap:
            out.append(i / fps)
            last = i
    return out


def main():
    y = load(sys.argv[1])
    env, rms = onset_envelope(y)
    env_s = smooth(env)
    bpm = tempo(env_s)
    beats = track_beats(env_s, bpm)
    fps = SR / HOP
    step = max(1, int(fps * 0.05))
    loud = rms[::step]
    json.dump({
        'duration': round(len(y) / SR, 3),
        'bpm': round(bpm, 2),
        'beats': [round(float(b), 3) for b in beats],
        'onsets': [round(t, 3) for t in peaks(env)],
        'loudness_step': round(step / fps, 4),
        'loudness': [round(float(v), 4) for v in loud / (loud.max() + 1e-9)],
    }, sys.stdout)


if __name__ == '__main__':
    main()
