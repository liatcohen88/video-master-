"""Original song "הטוב, הרע ואני" — lyrics, melody, arrangement and sound design,
synthesized with numpy only (no samples, no generation credits).

    python3 compose.py out/song.wav data.original.js

Writes the stereo mix and the lyric timeline (one note per syllable, so every
word's time is exact) for the lyric engine. The first 8 s are sound design
for the visual intro; the song itself is 100 BPM in A minor, whistle-led.
"""
import json
import sys
import wave

import numpy as np

SR = 44100
BPM = 100
BEAT = 60 / BPM
BAR = 4 * BEAT
S0 = 8.0                     # the groove starts when the intro visuals end
END_BAR = 21                 # lyrics end at the start of bar 21
DUR = S0 + END_BAR * BAR + 4.5
N = int(DUR * SR)
rng = np.random.default_rng(7)

dry = np.zeros((2, N))
wet = np.zeros((2, N))


def bt(bar, sixteenth=0.0):
    return S0 + bar * BAR + sixteenth * BEAT / 4


_NOTE = {'C': 0, 'C#': 1, 'D': 2, 'D#': 3, 'E': 4, 'F': 5, 'F#': 6, 'G': 7, 'G#': 8, 'A': 9, 'A#': 10, 'B': 11}


def hz(name):
    return 440.0 * 2 ** ((12 * (int(name[-1]) + 1) + _NOTE[name[:-1]] - 69) / 12)


def tt(dur):
    return np.arange(int(dur * SR)) / SR


def fade(x, a=0.002, r=0.01):
    x = np.array(x, dtype=float)
    na, nr = min(len(x), int(a * SR)), min(len(x), int(r * SR))
    if na:
        x[:na] *= np.linspace(0, 1, na)
    if nr:
        x[-nr:] *= np.linspace(1, 0, nr)
    return x


def fft_filter(x, resp, pad=4096):
    n = len(x)
    xp = np.concatenate([x, np.zeros(pad)])
    f = np.fft.rfftfreq(len(xp), 1 / SR)
    return np.fft.irfft(np.fft.rfft(xp) * resp(f), len(xp))[:n]


def lowpass(x, fc, order=2):
    return fft_filter(x, lambda f: 1 / np.sqrt(1 + (f / fc) ** (2 * order)))


def highpass(x, fc, order=2):
    return fft_filter(x, lambda f: 1 / np.sqrt(1 + (fc / np.maximum(f, 1e-3)) ** (2 * order)))


def bandpass(x, lo, hi, order=2):
    return highpass(lowpass(x, hi, order), lo, order)


def noise(dur):
    return rng.uniform(-1, 1, int(dur * SR))


def smooth_env(a, ms=6):
    k = max(1, int(ms / 1000 * SR))
    c = np.cumsum(np.concatenate([np.zeros(k), a]))
    return (c[k:] - c[:-k]) / k


def place(x, t, gain=1.0, pan=0.0, send=0.0):
    """Mono sound into the stereo mix at time t (constant-power pan)."""
    i = int(round(t * SR))
    x = np.asarray(x, dtype=float)
    if i < 0:
        x, i = x[-i:], 0
    x = x[:max(0, N - i)] * gain
    if not len(x):
        return
    l, r = np.cos((pan + 1) * np.pi / 4), np.sin((pan + 1) * np.pi / 4)
    dry[0, i:i + len(x)] += x * l
    dry[1, i:i + len(x)] += x * r
    if send:
        wet[0, i:i + len(x)] += x * l * send
        wet[1, i:i + len(x)] += x * r * send


def place_st(xl, xr, t, gain=1.0, send=0.0):
    i = int(round(t * SR))
    n = min(len(xl), N - i)
    if n <= 0:
        return
    dry[0, i:i + n] += xl[:n] * gain
    dry[1, i:i + n] += xr[:n] * gain
    if send:
        wet[0, i:i + n] += xl[:n] * gain * send
        wet[1, i:i + n] += xr[:n] * gain * send


def stft_band(x, fc_at, width=0.6, W=1024, H=256):
    """Noise through a band whose centre moves over time (fc_at(p), p in 0..1)."""
    n = len(x)
    win = np.hanning(W)
    pad = np.concatenate([np.zeros(W), x, np.zeros(W)])
    out, norm = np.zeros(len(pad)), np.zeros(len(pad))
    freqs = np.maximum(np.fft.rfftfreq(W, 1 / SR), 1)
    for s in range(0, len(pad) - W, H):
        p = min(1, max(0, (s - W / 2) / max(1, n)))
        resp = np.exp(-0.5 * (np.log2(freqs / fc_at(p)) / width) ** 2)
        out[s:s + W] += np.fft.irfft(np.fft.rfft(pad[s:s + W] * win) * resp, W) * win
        norm[s:s + W] += win ** 2
    return (out / np.maximum(norm, 1e-6))[W:W + n]


# ---------------------------------------------------------------- instruments
def pluck(freq, dur, t60=1.6, bright=0.6, seed=0):
    """Karplus-Strong string, vectorised one period at a time."""
    r = np.random.default_rng(seed)
    n = int(dur * SR)
    p = max(2, int(round(SR / freq - 0.5)))
    exc = r.uniform(-1, 1, p)
    k = max(1, int((1 - bright) * 8))
    if k > 1:
        exc = np.convolve(exc, np.ones(k) / k, mode='same')
    exc -= exc.mean()
    out = np.zeros(n)
    out[:min(p, n)] = exc[:min(p, n)]
    g = 10 ** (-3 / (t60 * freq))
    i = p
    while i < n:
        e = min(i + p, n)
        a = out[i - p:e - p]
        b = out[i - p - 1:e - p - 1] if i - p - 1 >= 0 else np.concatenate(([0.0], out[i - p:e - p - 1]))
        out[i:e] = g * 0.5 * (a + b)
        i = e
    return fade(out, 0.0005, 0.03)


CHORDS = {
    'Am': ['A2', 'E3', 'A3', 'C4', 'E4'],
    'G': ['G2', 'B2', 'D3', 'G3', 'B3', 'G4'],
    'F': ['F2', 'C3', 'F3', 'A3', 'C4', 'F4'],
    'E': ['E2', 'B2', 'E3', 'G#3', 'B3', 'E4'],
    'C': ['C3', 'E3', 'G3', 'C4', 'E4'],
}
BASS = {'Am': ('A1', 'E2'), 'G': ('G1', 'D2'), 'F': ('F1', 'C2'), 'E': ('E1', 'B1'), 'C': ('C2', 'G2')}
CHOIR = {'Am': ['A3', 'C4', 'E4', 'A4'], 'G': ['G3', 'B3', 'D4', 'G4'], 'F': ['F3', 'A3', 'C4', 'F4'],
         'E': ['E3', 'G#3', 'B3', 'E4'], 'C': ['G3', 'C4', 'E4', 'G4']}
_seed = [0]


def strum(chord, t, down=True, upper=True, gain=0.22, t60=0.5, spread=0.011):
    notes = CHORDS[chord][-4:] if upper else CHORDS[chord]
    order = notes if down else notes[::-1][:3]
    for k, nm in enumerate(order):
        _seed[0] += 1
        x = pluck(hz(nm), t60 * 1.4 + 0.08, t60=t60, bright=0.8 if down else 0.65, seed=_seed[0])
        place(x, t + k * spread, gain * (1 if down else 0.6) * rng.uniform(0.85, 1.05), pan=-0.35 + 0.05 * k, send=0.15)


def bass(name, t, dur=0.55, gain=0.5):
    f = hz(name)
    _seed[0] += 1
    x = lowpass(pluck(f, dur + 0.15, t60=1.1, bright=0.15, seed=_seed[0]), 900)
    t_ = np.arange(len(x)) / SR
    x = x + 0.7 * np.sin(2 * np.pi * f * t_) * np.exp(-t_ * 3.5) * np.minimum(1, t_ / 0.004)
    place(fade(x, 0.003, 0.06), t, gain, 0.0, 0.05)


def twang(name, t, dur=0.32, gain=0.3):
    _seed[0] += 1
    f = hz(name)
    x = pluck(f, dur + 0.35, t60=1.0, bright=0.95, seed=_seed[0])
    x = np.tanh(2.6 * x) * (1 + 0.28 * np.sin(2 * np.pi * 6.2 * np.arange(len(x)) / SR))
    x = lowpass(x, 4200)
    place(fade(x, 0.001, 0.08), t, gain, 0.35, 0.3)
    place(fade(lowpass(x, 2500), 0.001, 0.08), t + 0.11, gain * 0.32, -0.3, 0.3)   # slapback


def whistle(notes, gain=0.34, send=0.32):
    """Whistled melody. notes: [(t, dur, freq)] — each one a syllable, re-articulated when legato."""
    t_start = notes[0][0] - 0.05
    t_end = notes[-1][0] + notes[-1][1] + 0.4
    n = int((t_end - t_start) * SR)
    f, a, since = np.zeros(n), np.zeros(n), np.zeros(n)
    prev_f = notes[0][2]
    for j, (t0, d, fr) in enumerate(notes):
        s, e = int((t0 - t_start) * SR), int((t0 + d - t_start) * SR)
        legato = j > 0 and t0 - (notes[j - 1][0] + notes[j - 1][1]) < 0.03
        seg = np.full(e - s, fr)
        if legato:
            k = min(int(0.04 * SR), e - s)
            seg[:k] = fr + (prev_f - fr) * np.exp(-np.arange(k) / (k / 4))
            amp = np.ones(e - s)
            dip = min(int(0.05 * SR), e - s)
            amp[:dip] = 0.4 + 0.6 * (np.arange(dip) / dip) ** 0.7
        else:
            amp = np.ones(e - s)
            k = min(int(0.03 * SR), e - s)
            amp[:k] = np.linspace(0, 1, k)
        f[s:e], a[s:e], since[s:e] = seg, amp, np.arange(e - s) / SR
        nxt = notes[j + 1][0] if j + 1 < len(notes) else None
        if nxt is None or nxt - (t0 + d) > 0.03:
            rr = min(int(0.11 * SR), n - e)
            f[e:e + rr], a[e:e + rr] = fr, np.linspace(1, 0, rr) ** 1.6
            since[e:e + rr] = d + np.arange(rr) / SR
        prev_f = fr
    t_ = np.arange(n) / SR
    vib = 1 + 0.009 * np.sin(2 * np.pi * 5.7 * t_) * np.clip((since - 0.15) / 0.25, 0, 1)
    ph = 2 * np.pi * np.cumsum(f * vib) / SR
    a = smooth_env(a, 5)
    tone = np.sin(ph) + 0.05 * np.sin(2 * ph) + 0.015 * np.sin(3 * ph)
    breath = highpass(rng.uniform(-1, 1, n), 2600) * 0.035
    place((tone + breath) * a, t_start, gain, 0.0, send)


FORMANT_A = [(730, 95, 1.0), (1090, 120, 0.5), (2440, 170, 0.22)]


def choir(names, t, dur, gain=0.05, attack=0.45, release=0.9):
    n = int((dur + release) * SR)
    t_ = np.arange(n) / SR
    env = np.minimum(1, t_ / attack) * np.where(t_ < dur, 1.0, np.exp(-(t_ - dur) * 5))
    xl, xr = np.zeros(n), np.zeros(n)
    for ni, nm in enumerate(names):
        f0 = hz(nm)
        for vi, cents in enumerate((-9, 0, 8)):
            fv = f0 * 2 ** (cents / 1200)
            ph = 2 * np.pi * np.cumsum(fv * (1 + 0.004 * np.sin(2 * np.pi * (5.0 + 0.35 * vi) * t_ + vi * 2.1))) / SR
            voice = np.zeros(n)
            h = 1
            while h * fv < 4200:
                fh = h * fv
                amp = sum(w * np.exp(-0.5 * ((fh - fc) / bw) ** 2) for fc, bw, w in FORMANT_A) + 0.06 / h
                voice += amp * np.sin(h * ph + rng.uniform(0, 6.28))
                h += 1
            pan = (vi - 1) * 0.55 + (ni - 1.5) * 0.08
            xl += voice * np.cos((pan + 1) * np.pi / 4)
            xr += voice * np.sin((pan + 1) * np.pi / 4)
    place_st(xl * env, xr * env, t, gain, 0.45)


# ---------------------------------------------------------------- drums & sound design
def kick(t, gain=0.55):
    t_ = tt(0.35)
    x = np.sin(2 * np.pi * np.cumsum(45 + 85 * np.exp(-t_ * 28)) / SR) * np.exp(-t_ * 9)
    x[:88] += rng.uniform(-0.4, 0.4, 88)
    place(fade(x, 0.0005, 0.02), t, gain, 0.0, 0.03)


def rim(t, gain=0.2, pan=0.12):
    t_ = tt(0.15)
    x = bandpass(rng.uniform(-1, 1, len(t_)), 1200, 6000) * np.exp(-t_ * 42) + 0.5 * np.sin(2 * np.pi * 190 * t_) * np.exp(-t_ * 30)
    place(fade(x), t, gain, pan, 0.12)


def hoof(t, high=True, gain=0.13, pan=0.0):
    t_ = tt(0.09)
    f1 = 840 if high else 620
    x = np.sin(2 * np.pi * f1 * t_) * np.exp(-t_ * 70) + 0.4 * np.sin(2 * np.pi * f1 * 1.72 * t_) * np.exp(-t_ * 95)
    x[:130] += rng.uniform(-0.5, 0.5, 130)
    place(fade(x), t, gain, pan, 0.08)


def shaker(t, gain=0.05, pan=0.3):
    t_ = tt(0.09)
    x = highpass(rng.uniform(-1, 1, len(t_)), 5000) * np.minimum(1, t_ / 0.012) * np.exp(-t_ * 45)
    place(fade(x), t, gain, pan, 0.05)


def tom(t, gain=0.35, f0=92):
    t_ = tt(0.6)
    x = np.sin(2 * np.pi * np.cumsum(f0 + 45 * np.exp(-t_ * 20)) / SR) * np.exp(-t_ * 6.5)
    x += 0.25 * lowpass(rng.uniform(-1, 1, len(t_)), 700) * np.exp(-t_ * 25)
    place(fade(x), t, gain, -0.05, 0.2)


def snare(t, gain=0.2):
    t_ = tt(0.2)
    x = bandpass(rng.uniform(-1, 1, len(t_)), 900, 7000) * np.exp(-t_ * 26) + 0.45 * np.sin(2 * np.pi * 200 * t_) * np.exp(-t_ * 28)
    place(fade(x), t, gain, 0.05, 0.15)


def whoosh(t, dur=0.3, f0=350, f1=2600, gain=0.25, pan=0.0):
    x = stft_band(noise(dur), lambda p: f0 * (f1 / f0) ** p, 0.55)
    x *= np.sin(np.pi * np.linspace(0, 1, len(x))) ** 1.4 / (np.abs(x).max() + 1e-9)
    place(x, t, gain, pan, 0.25)


def whip(t, gain=0.42):
    whoosh(t - 0.16, 0.17, 700, 4500, gain * 0.5, -0.15)
    t_ = tt(0.13)
    x = highpass(rng.uniform(-1, 1, len(t_)), 1500) * np.exp(-t_ * 55)
    x[:60] *= 2.5
    place(fade(x, 0.0002, 0.02), t, gain, 0.08, 0.3)


def anvil(t, gain=0.16, f0=1180):
    t_ = tt(1.6)
    x = sum(a * np.sin(2 * np.pi * f0 * r * t_ + i) * np.exp(-t_ * dk)
            for i, (r, a, dk) in enumerate([(1, 1, 2.2), (2.76, 0.55, 3.5), (5.4, 0.35, 5), (8.93, 0.2, 7)]))
    x[:88] += rng.uniform(-0.7, 0.7, 88)
    place(fade(x, 0.0003, 0.1), t, gain, 0.15, 0.35)


def bell(t, gain=0.22, f0=None):
    f0 = f0 or hz('E4')
    t_ = tt(5.0)
    x = sum(a * np.sin(2 * np.pi * f0 * r * t_ + i * 1.3) * np.exp(-t_ * dk)
            for i, (r, a, dk) in enumerate([(0.5, 0.6, 0.5), (1, 1, 0.8), (1.19, 0.5, 1.1), (1.5, 0.4, 1.3), (2, 0.35, 1.6), (2.5, 0.25, 2.2), (2.97, 0.2, 2.6), (4.2, 0.12, 3.4)]))
    place(fade(x, 0.002, 0.3), t, gain, -0.2, 0.5)


def impact(t, gain=0.6, dark=False):
    t_ = tt(1.2)
    sub = np.sin(2 * np.pi * np.cumsum(32 + 52 * np.exp(-t_ * 6)) / SR) * np.exp(-t_ * 3.2)
    hit = lowpass(rng.uniform(-1, 1, len(t_)), 1700 if dark else 3400) * np.exp(-t_ * 22)
    place(fade(sub + 0.55 * hit, 0.0005, 0.2), t, gain, 0.0, 0.35)


def gunshot(t, gain=0.5, pan=0.0, echo=True, distant=False):
    t_ = tt(0.5)
    nz = rng.uniform(-1, 1, len(t_))
    x = 0.8 * lowpass(nz, 5500) * np.exp(-t_ * 38) + 0.6 * highpass(nz, 2500) * np.exp(-t_ * 120)
    x += 0.9 * np.sin(2 * np.pi * (70 + 60 * np.exp(-t_ * 30)) * t_) * np.exp(-t_ * 22)
    x[:35] *= 3
    if distant:
        x = lowpass(x, 1800)
    place(fade(x, 0.0002, 0.05), t, gain, pan, 0.6 if distant else 0.45)
    if echo:
        for dt, g, fc, p in ((0.21, 0.32, 3200, 0.35), (0.47, 0.2, 2200, -0.35), (0.8, 0.11, 1500, 0.2)):
            place(lowpass(x, fc), t + dt, gain * g, p, 0.5)


def ricochet(t, gain=0.16, f0=3400, f1=1250, dur=0.55, pan=0.4):
    t_ = tt(dur)
    x = np.sin(2 * np.pi * np.cumsum(f1 + (f0 - f1) * np.exp(-t_ * 5)) / SR) * np.minimum(1, t_ / 0.01) * np.exp(-t_ * 4)
    place(fade(x, 0.001, 0.05), t, gain, pan, 0.4)


def creak(t, dur=0.3, gain=0.16):
    n = int(dur * SR)
    x = np.zeros(n)
    pos = 0.0
    while True:
        pos += 1 / (28 + 40 * pos / dur + rng.uniform(-6, 6))
        if pos >= dur:
            break
        x[int(pos * SR)] = rng.uniform(0.6, 1)
    t_ = tt(0.03)
    res = np.sin(2 * np.pi * 560 * t_) * np.exp(-t_ * 90) + 0.5 * np.sin(2 * np.pi * 1210 * t_) * np.exp(-t_ * 120)
    place(fade(np.convolve(x, res)[:n], 0.005, 0.05), t, gain, 0.2, 0.25)


def partials(t, parts, dur, gain, pan=0.0, send=0.3):
    t_ = tt(dur)
    x = sum(a * np.sin(2 * np.pi * f * t_) * np.exp(-t_ * dk) for f, a, dk in parts)
    place(fade(x, 0.0005, 0.05), t, gain, pan, send)


def clink(t, gain=0.12):
    partials(t, [(2150, 1, 30), (3920, 0.6, 40), (5610, 0.35, 55)], 0.25, gain, 0.1)


def ting(t, gain=0.09):
    partials(t, [(4200, 1, 9), (6280, 0.6, 12), (8370, 0.4, 16), (10500, 0.25, 20)], 0.6, gain, 0.3, 0.5)


def tok(t, freq, gain=0.2):
    partials(t, [(freq, 1, 45), (freq * 2.7, 0.35, 70)], 0.18, gain, 0.0, 0.2)


def slap(t, gain=0.4):
    t_ = tt(0.25)
    x = lowpass(rng.uniform(-1, 1, len(t_)), 2600) * np.exp(-t_ * 55) + 0.8 * np.sin(2 * np.pi * (110 + 60 * np.exp(-t_ * 40)) * t_) * np.exp(-t_ * 20)
    place(fade(x, 0.0005, 0.05), t, gain, rng.uniform(-0.2, 0.2), 0.2)


def crackle(t, dur, gain=0.12):
    n = int(dur * SR)
    x = np.zeros(n)
    for _ in range(int(dur * 60)):
        i = rng.integers(0, n - 200)
        x[i:i + 60] += rng.uniform(-1, 1, 60) * np.exp(-np.arange(60) / 12) * rng.uniform(0.3, 1)
    x += 0.3 * bandpass(rng.uniform(-1, 1, n), 800, 4000) * np.linspace(0.2, 1, n)
    place(fade(x, 0.01, 0.05), t, gain, -0.1, 0.25)


def drone(names, t, dur, gain=0.06, cutoff=500, trem=7.5):
    t_ = tt(dur)
    x = np.zeros(len(t_))
    for nm in names:
        f = hz(nm)
        x += 2 * ((f * t_) % 1) - 1          # sawtooth
    x = lowpass(x, cutoff) * (1 - 0.35 * (0.5 + 0.5 * np.sin(2 * np.pi * trem * t_)))
    env = np.minimum(1, t_ / 0.4) * np.minimum(1, (dur - t_) / 0.5)
    place(x * env, t, gain, 0.0, 0.3)


def wind():
    x = stft_band(noise(DUR), lambda p: 380 + 240 * np.sin(2 * np.pi * 0.07 * p * DUR) + 110 * np.sin(2 * np.pi * 0.19 * p * DUR + 1), 0.5)
    t_ = np.arange(len(x)) / SR
    level = np.interp(t_, [0, 0.6, 7.6, 9.0, DUR - 6.5, DUR - 4.0, DUR - 0.6, DUR], [0, 1, 1, 0.35, 0.35, 0.9, 0.9, 0])
    x *= (0.6 + 0.4 * np.sin(2 * np.pi * 0.11 * t_)) * level / (np.abs(x).max() + 1e-9)
    place(x, 0.0, 0.16, -0.15, 0.1)


# ---------------------------------------------------------------- the song
def melody(bar, durs, notes):
    """[(t, dur, freq)] from 16th-note durations starting at a bar."""
    out, pos = [], 0
    for d, nm in zip(durs, notes):
        out.append((bt(bar, pos), d * BEAT / 4, hz(nm)))
        pos += d
    return out


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
        bass(fifth, t + 2 * BEAT, gain=0.45)
        kick(t, 0.6 if chorus else 0.45)
        kick(t + 2 * BEAT, 0.5 if chorus else 0.38)
        rim(t + BEAT, 0.2)
        rim(t + 3 * BEAT, 0.2)
        if chorus:
            for beat in range(4):
                strum(ch, t + beat * BEAT, down=True, upper=False, gain=0.2, t60=0.9)
                strum(ch, t + (beat + 0.5) * BEAT, down=False, gain=0.18, t60=0.6)
            for e8 in range(8):
                shaker(t + e8 * BEAT / 2, 0.05 if e8 % 2 else 0.035)
            tom(t, 0.3)
            choir(CHOIR[ch], t, BAR - 0.1, gain=0.05)
        else:
            for beat in (1, 3):
                strum(ch, t + beat * BEAT, down=True, gain=0.24, t60=0.45)
            strum(ch, t + 3.5 * BEAT, down=False, gain=0.2, t60=0.35)
            gallop = 2 if b == 13 else 1
            for beat in range(4):
                for s16 in ((0, 2, 3) if gallop == 1 else (0, 1, 2, 3)):
                    hoof(t + (beat + s16 / 4) * BEAT, high=s16 != 2, gain=0.11 if s16 else 0.14, pan=-0.2 + 0.4 * (s16 % 2))
    anvil(bt(5), 0.14)
    anvil(bt(14), 0.14)
    for b in (1, 10):
        whip(bt(b), 0.4)
    gunshot(bt(13, 15), 0.22, pan=-0.6, distant=True)
    ricochet(bt(13, 15) + 0.08, 0.06, pan=-0.5)

    # lead-in riff (bar 0) and turnaround (bar 9)
    for s16, d, nm in ((0, 2, 'A3'), (2, 2, 'C4'), (4, 2, 'D4'), (6, 2, 'E4'), (8, 2, 'G4'), (10, 2, 'E4'), (12, 1, 'D4'), (13, 1, 'C4'), (14, 2, 'A3')):
        twang(nm, bt(0, s16), d * BEAT / 4 + 0.15, 0.28)
    whistle(melody(9, [2, 2, 2, 2, 4, 4], ['E6', 'D6', 'C6', 'B5', 'A5', 'E5']), gain=0.3)
    for s16, nm in ((8, 'A3'), (10, 'C4'), (12, 'E4'), (14, 'A4')):
        twang(nm, bt(9, s16), 0.4, 0.22)
    bell(bt(END_BAR), 0.24, hz('A3'))
    return lines


def build_intro():
    """Sound design for the 8 s visual intro (times match index.html's T)."""
    drone(['A1', 'E2'], 0.0, 2.75, 0.05)
    impact(0.25, 0.55)                       # "הטוב" slams in
    whoosh(0.38, 0.22, 2600, 600, 0.12)      # the star falls...
    clink(0.6, 0.14)                         # ...and lands
    ting(0.95, 0.09)
    gunshot(1.30, 0.5, 0.1)                  # the shot through the star
    ricochet(1.36, 0.12)
    crackle(1.38, 0.2, 0.1)
    impact(1.64, 0.5, dark=True)             # "הרע"
    for t in (1.96, 2.10, 2.24):
        gunshot(t, 0.42, -0.2, echo=t == 2.24)
    creak(2.32, 0.18, 0.14)
    whoosh(2.46, 0.2, 1800, 300, 0.14)
    impact(2.64, 0.55)                       # cut to the desert
    choir(CHOIR['Am'], 2.62, 2.8, gain=0.05, attack=0.5, release=1.0)
    drone(['A1'], 2.62, 3.2, 0.05, cutoff=300, trem=0.0001)
    for i, f in enumerate((hz('A5'), hz('C6'), hz('D6'), hz('E6'))):
        tok(2.98 + i * 0.075 + 0.16, f, 0.16)      # letters landing
    ting(3.78, 0.08)
    whoosh(3.98, 0.24, 500, 3000, 0.16, -0.4)
    whoosh(3.99, 0.24, 500, 3000, 0.16, 0.4)
    anvil(4.22, 0.17)                        # the two words clash
    crackle(4.22, 0.25, 0.07)
    whistle([(4.32, 0.33, hz('E6')), (4.66, 0.14, hz('A5')), (4.81, 0.14, hz('B5')), (4.96, 0.5, hz('C6'))], gain=0.28)
    whoosh(5.18, 0.3, 300, 3500, 0.2)        # whip pan to the wall
    for t in (5.68, 6.42, 7.04):
        slap(t, 0.38)                        # posters
    for k in range(16):                      # gallop and a snare roll lead into the song
        t = 6.0 + k * BEAT / 4 * 2
        if t < 7.9:
            hoof(t, high=k % 2 == 0, gain=0.03 + 0.07 * k / 16)
    for k in range(12):
        snare(7.25 + k * 0.0625, 0.05 + 0.14 * k / 12)
    for k in range(16):
        twang('A3', 7.0 + k * 0.0625, 0.08, 0.03 + 0.07 * k / 16)
    whip(S0, 0.42)


def reverb(rt60=2.1):
    n_ir = int(rt60 * SR)
    t_ = np.arange(n_ir) / SR
    out = []
    for ch in range(2):
        ir = np.random.default_rng(100 + ch).standard_normal(n_ir) * np.exp(-6.91 * t_ / rt60)
        ir = lowpass(ir, 4800)
        ir[:int(0.014 * SR)] = 0
        ir /= np.sqrt(np.sum(ir ** 2))
        L = N + n_ir
        nfft = 1 << (L - 1).bit_length()
        out.append(np.fft.irfft(np.fft.rfft(wet[ch], nfft) * np.fft.rfft(ir, nfft), nfft)[:N])
    return np.array(out)


def main():
    wav_path, data_path = sys.argv[1], sys.argv[2]
    build_intro()
    lines = build_song()
    wind()
    mix = dry + 0.5 * reverb()
    mix = np.array([highpass(ch, 28) for ch in mix])
    mix /= np.abs(mix).max()
    mix = np.tanh(1.6 * mix) / np.tanh(1.6) * 10 ** (-1 / 20)
    fade_n = int(0.8 * SR)
    mix[:, -fade_n:] *= np.linspace(1, 0, fade_n)
    pcm = (np.clip(mix.T, -1, 1) * 32767).astype('<i2')
    with wave.open(wav_path, 'wb') as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(pcm.tobytes())

    def rms(a, b):
        seg = mix[:, int(a * SR):int(b * SR)]
        return 20 * np.log10(np.sqrt((seg ** 2).mean()) + 1e-12)
    for name, a, b in (('intro', 0, 8), ('verse1', bt(1), bt(5)), ('chorus1', bt(5), bt(9)), ('verse2', bt(10), bt(14)), ('chorus2', bt(14), bt(18)), ('outro', bt(18), DUR)):
        print(f'{name:8s} rms {rms(a, b):6.1f} dBFS', file=sys.stderr)

    beats = [round(bt(0) + k * BEAT, 3) for k in range(int((DUR - S0) / BEAT))]
    onsets = sorted({w['t'] for l in lines for w in l['words']} | set(beats))
    data = {
        'lines': lines, 'end': round(bt(END_BAR), 3),
        'audio': {'bpm': BPM, 'beats': beats, 'onsets': onsets, 'duration': round(DUR, 3)},
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
    print(f'{len(lines)} lines, {DUR:.1f}s -> {wav_path}, {data_path}', file=sys.stderr)


if __name__ == '__main__':
    main()
