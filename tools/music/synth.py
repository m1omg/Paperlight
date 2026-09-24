"""Tiny offline numpy synth + sequencer for PAPERLIGHT.

Everything is rendered offline to float arrays and encoded with ffmpeg (libvorbis).
Instruments are functions  inst(freq, dur_seconds, vel, **kw) -> mono np.ndarray  (may ring past dur).
"""
import subprocess
import numpy as np

SR = 44100
rng = np.random.default_rng(20260922)

# ----------------------------------------------------------------- pitch helpers
_NOTE = {'C': 0, 'D': 2, 'E': 4, 'F': 5, 'G': 7, 'A': 9, 'B': 11}


def midi(n):
    if isinstance(n, (int, float, np.integer)):
        return n
    name = n[0].upper()
    i, acc = 1, 0
    while i < len(n) and n[i] in '#b':
        acc += 1 if n[i] == '#' else -1
        i += 1
    return 12 * (int(n[i:]) + 1) + _NOTE[name] + acc


def hz(m):
    return 440.0 * 2 ** ((m - 69) / 12.0)


def mel(s, default=1.0):
    """'A4:2 C5 | r:1 Bb4' -> ([(beat, midi, dur)], total_beats).  Duration is sticky."""
    out, t, d = [], 0.0, default
    for tok in s.replace('|', ' ').split():
        if ':' in tok:
            n, ds = tok.split(':')
            d = float(ds)
        else:
            n = tok
        if n.lower() != 'r':
            out.append((t, midi(n), d))
        t += d
    return out, t


QUAL = {'': [0, 4, 7], 'm': [0, 3, 7], '7': [0, 4, 7, 10], 'm7': [0, 3, 7, 10], 'maj7': [0, 4, 7, 11],
        'm7b5': [0, 3, 6, 10], 'sus4': [0, 5, 7], 'sus2': [0, 2, 7], 'dim': [0, 3, 6], 'add9': [0, 4, 7, 14],
        'm9': [0, 3, 7, 10, 14], '6': [0, 4, 7, 9], 'm6': [0, 3, 7, 9], '7sus4': [0, 5, 7, 10],
        'maj9': [0, 4, 7, 11, 14], 'aug': [0, 4, 8], 'm(maj7)': [0, 3, 7, 11]}


def chord(name, octave=4, trans=0):
    """'Bbmaj7' -> (root_midi, [chord tones midi])  in given octave."""
    root = name[0]
    i = 1
    if i < len(name) and name[i] in '#b':
        root += name[i]
        i += 1
    q = name[i:]
    r = midi(f"{root}{octave}") + trans
    return r, [r + x for x in QUAL[q]]


def voicing(name, lo=55, trans=0):
    """Close voicing of chord tones placed at/above midi `lo`."""
    r, tones = chord(name, 4, trans)
    out = []
    for t in tones:
        while t < lo:
            t += 12
        while t >= lo + 12:
            t -= 12
        out.append(t)
    return sorted(out)


# ----------------------------------------------------------------- dsp helpers
def fft_filter(x, lo=None, hi=None, order=2, pad=2048):
    n = len(x)
    xp = np.concatenate([x, np.zeros(pad)])
    X = np.fft.rfft(xp)
    f = np.fft.rfftfreq(len(xp), 1 / SR)
    H = np.ones_like(f)
    if hi:
        H /= np.sqrt(1 + (f / hi) ** (2 * order))
    if lo:
        with np.errstate(divide='ignore'):
            H /= np.sqrt(1 + (lo / np.maximum(f, 1e-3)) ** (2 * order))
    return np.fft.irfft(X * H, n=len(xp))[:n]


def ar(n, a, r_len, total):
    """attack/release envelope: linear attack `a` s, hold until n samples, cosine release r_len s"""
    env = np.ones(total)
    na = min(max(1, int(a * SR)), total)
    env[:na] = np.linspace(0, 1, na)
    nr = max(1, int(r_len * SR))
    if n < total:
        rel = 0.5 * (1 + np.cos(np.linspace(0, np.pi, min(nr, total - n))))
        env[n:n + len(rel)] *= rel
        env[n + len(rel):] = 0
    return env


def tvec(dur):
    return np.arange(int(dur * SR)) / SR


def noise(n):
    return rng.uniform(-1, 1, n)


# ----------------------------------------------------------------- instruments
def musicbox(f, dur, vel=0.8, detune=0.0, ring=2.6):
    f = f * 2 ** (detune / 1200)
    t = tvec(ring)
    y = np.sin(2 * np.pi * f * t) * np.exp(-t / 1.1)
    y += 0.30 * np.sin(2 * np.pi * f * 2.0 * t + 0.3) * np.exp(-t / 0.35)
    y += 0.18 * np.sin(2 * np.pi * f * 5.95 * t) * np.exp(-t / 0.06)
    y += 0.08 * np.sin(2 * np.pi * (f * 1.003) * t) * np.exp(-t / 1.1)  # tiny chorus/beat
    click = noise(len(t)) * np.exp(-t / 0.003) * 0.15
    y = (y + fft_filter(click, lo=3000)) * (1 - np.exp(-t / 0.0015))
    return y * vel * 0.55


def glock(f, dur, vel=0.8, ring=2.2):
    t = tvec(ring)
    y = (np.sin(2 * np.pi * f * t) * np.exp(-t / 0.9) + 0.35 * np.sin(2 * np.pi * f * 2.76 * t) * np.exp(-t / 0.3)
         + 0.18 * np.sin(2 * np.pi * f * 5.40 * t) * np.exp(-t / 0.1) + 0.08 * np.sin(2 * np.pi * f * 8.93 * t) * np.exp(-t / 0.04))
    return y * (1 - np.exp(-t / 0.001)) * vel * 0.55


def toypiano(f, dur, vel=0.8):
    ring = min(max(dur + 0.3, 0.6), 2.0)
    t = tvec(ring)
    y = (np.sin(2 * np.pi * f * t + 1.2 * np.sin(2 * np.pi * f * t) * np.exp(-t / 0.08)) * np.exp(-t / 0.7)
         + 0.25 * np.sin(2 * np.pi * f * 3.9 * t) * np.exp(-t / 0.12) + 0.12 * np.sin(2 * np.pi * f * 6.3 * t) * np.exp(-t / 0.05))
    y += fft_filter(noise(len(t)) * np.exp(-t / 0.004), lo=2000) * 0.12
    y *= ar(int((dur + 0.05) * SR), 0.001, 0.25, len(t))
    return y * vel * 0.5


def piano(f, dur, vel=0.8, bright=1.0, felt=True):
    """felt/upright piano: additive, stretched harmonics, per-partial decay, hammer thump"""
    base_dec = float(np.clip(3.2 * (261.6 / f) ** 0.6, 0.6, 7.0))
    ring = min(dur + 0.4, base_dec * 1.2) if felt else min(dur + 0.6, base_dec * 1.5)
    ring = max(ring, 0.35)
    t = tvec(ring)
    y = np.zeros(len(t))
    nh = int(min(12, 7000 // f))
    for n in range(1, max(nh, 1) + 1):
        fn = f * n * np.sqrt(1 + 0.00025 * n * n)
        amp = (1.0 / n ** 1.25) * np.exp(-(n - 1) * (0.45 if felt else 0.25) / bright) * vel ** (0.12 * (n - 1))
        dec = base_dec / (1 + 0.45 * (n - 1))
        ph = rng.uniform(0, 2 * np.pi)
        y += amp * np.sin(2 * np.pi * fn * t + ph) * np.exp(-t / dec)
        if n <= 2:
            y += amp * 0.5 * np.sin(2 * np.pi * fn * 1.0012 * t + ph * 0.7) * np.exp(-t / dec)
    ham = fft_filter(noise(len(t)) * np.exp(-t / 0.012), hi=1200 if felt else 2500) * 0.25
    y = (y + ham) * (1 - np.exp(-t / (0.004 if felt else 0.002)))
    y *= ar(int(dur * SR), 0.0, 0.18 if felt else 0.12, len(t))
    return y * vel * 0.35


def ks(f, dur, vel=0.8, bright=0.6, decay=0.996, ring=0.25, mute=0.08):
    """Karplus-Strong pluck, vectorised per period, retuned by resampling."""
    total = int(SR * (dur + ring))
    N = max(2, int(SR / f - 0.5))
    f_act = SR / (N + 0.5)
    ratio = f / f_act                       # >1 => need to play faster
    need = int(total * ratio) + N + 2
    out = np.zeros(need + N)
    exc = np.tile(noise(N), 4)
    exc = fft_filter(exc, hi=f * (1.5 + bright * 14), order=1, pad=0)[N:2 * N]   # periodic -> no edge artefacts
    exc += 0.6 * np.sin(2 * np.pi * np.arange(N) / N) * np.std(exc) * 2
    out[:N] = exc / (np.max(np.abs(exc)) + 1e-9)
    for s in range(N, need, N):
        prev = out[s - N:s]
        prev1 = out[s - N - 1:s - 1] if s - N - 1 >= 0 else np.concatenate([[0.0], prev[:-1]])
        e = min(s + N, len(out))
        out[s:e] = (decay * 0.5 * (prev + prev1))[:e - s]
    idx = np.arange(total) * ratio
    y = np.interp(idx, np.arange(len(out)), out)
    y *= ar(int(dur * SR), 0.0, mute, total)
    y -= np.mean(y)
    return y * vel * 0.7


def uke(f, dur, vel=0.8):
    return ks(f, dur, vel, bright=0.75, decay=0.993, ring=0.35, mute=0.15)


def kalimba(f, dur, vel=0.8):
    t = tvec(1.8)
    y = np.sin(2 * np.pi * f * t) * np.exp(-t / 0.8) + 0.25 * np.sin(2 * np.pi * f * 5.95 * t) * np.exp(-t / 0.06)
    y += 0.1 * np.sin(2 * np.pi * f * 3.0 * t) * np.exp(-t / 0.15)
    y += fft_filter(noise(len(t)) * np.exp(-t / 0.003), lo=1500, hi=6000) * 0.2
    return y * (1 - np.exp(-t / 0.0015)) * vel * 0.55


def bass(f, dur, vel=0.8, tone=0.3):
    total = int((dur + 0.08) * SR)
    t = np.arange(total) / SR
    y = np.sin(2 * np.pi * f * t) + tone * np.sin(4 * np.pi * f * t) * np.exp(-t / 0.2) + 0.1 * np.sin(6 * np.pi * f * t) * np.exp(-t / 0.08)
    y *= (0.65 + 0.35 * np.exp(-t / 0.25))
    y = np.tanh(1.6 * y) / np.tanh(1.6)
    y *= ar(int(dur * SR), 0.004, 0.05, total)
    return y * vel * 0.6


def _saw(f, t, vib=0.0, vib_rate=5.0, vib_delay=0.3):
    if vib:
        fm = f * (1 + vib * np.clip(t / max(vib_delay, 1e-3), 0, 1) * np.sin(2 * np.pi * vib_rate * t))
        ph = np.cumsum(fm) / SR
    else:
        ph = f * t
    return 2 * (ph % 1.0) - 1


def pad(f, dur, vel=0.6, attack=0.6, release=1.2, cutoff=1400, voices=3, spread=8):
    total = int((dur + release) * SR)
    t = np.arange(total) / SR
    y = np.zeros(total)
    for v in range(voices):
        det = (v - (voices - 1) / 2) * spread
        y += _saw(f * 2 ** (det / 1200), t + rng.uniform(0, 1))
    y = fft_filter(y / voices, hi=cutoff, order=2)
    y *= ar(int(dur * SR), attack, release, total)
    return y * vel * 0.35


def strings(f, dur, vel=0.6, attack=0.35, release=0.8, cutoff=2600):
    total = int((dur + release) * SR)
    t = np.arange(total) / SR
    y = np.zeros(total)
    for v in range(4):
        y += _saw(f * 2 ** ((v - 1.5) * 6 / 1200), t + rng.uniform(0, 1), vib=0.004, vib_rate=5.2 + 0.3 * v, vib_delay=0.4)
    y = fft_filter(y / 4, lo=180, hi=cutoff, order=2)
    y *= ar(int(dur * SR), attack, release, total)
    return y * vel * 0.33


def lead(f, dur, vel=0.7, duty=0.25, cutoff=4200, vib=0.006, glide_from=None):
    """pulse lead, a little chip-ish but softened"""
    total = int((dur + 0.1) * SR)
    t = np.arange(total) / SR
    fm = f * (1 + vib * np.clip((t - 0.12) / 0.2, 0, 1) * np.sin(2 * np.pi * 5.6 * t))
    if glide_from:
        g = np.exp(-t / 0.03)
        fm = fm * (1 - g) + glide_from * g
    ph = np.cumsum(fm) / SR
    y = np.where((ph % 1.0) < duty, 1.0, -1.0) - (2 * duty - 1)
    y = fft_filter(y, hi=cutoff, order=2)
    env = (0.75 + 0.25 * np.exp(-t / 0.12)) * ar(int(dur * SR), 0.006, 0.07, total)
    return y * env * vel * 0.28


def whistle(f, dur, vel=0.7):
    total = int((dur + 0.12) * SR)
    t = np.arange(total) / SR
    fm = f * (1 + 0.008 * np.clip((t - 0.15) / 0.2, 0, 1) * np.sin(2 * np.pi * 5.8 * t))
    fm *= (1 - 0.03 * np.exp(-t / 0.03))  # little scoop up
    ph = 2 * np.pi * np.cumsum(fm) / SR
    y = np.sin(ph) + 0.05 * np.sin(2 * ph)
    br = fft_filter(noise(total), lo=f * 0.8, hi=f * 1.4, order=2) * 0.25
    y = (y + br) * ar(int(dur * SR), 0.03, 0.1, total)
    return y * vel * 0.4


def flute(f, dur, vel=0.6):
    total = int((dur + 0.2) * SR)
    t = np.arange(total) / SR
    fm = f * (1 + 0.005 * np.clip((t - 0.2) / 0.3, 0, 1) * np.sin(2 * np.pi * 5.0 * t))
    ph = 2 * np.pi * np.cumsum(fm) / SR
    y = np.sin(ph) + 0.2 * np.sin(2 * ph) + 0.05 * np.sin(3 * ph)
    y += fft_filter(noise(total), lo=f, hi=f * 3) * 0.12
    return y * ar(int(dur * SR), 0.08, 0.18, total) * vel * 0.35


# ----------------------------------------------------------------- drums
def kick(vel=0.9, f0=110, f1=45, dec=0.28):
    t = tvec(0.5)
    fr = f1 + (f0 - f1) * np.exp(-t / 0.04)
    y = np.sin(2 * np.pi * np.cumsum(fr) / SR) * np.exp(-t / dec)
    y += fft_filter(noise(len(t)) * np.exp(-t / 0.004), hi=3000) * 0.3
    return np.tanh(1.5 * y) * vel * 0.8


def snare(vel=0.8, dec=0.13, tone=190):
    t = tvec(0.4)
    n = fft_filter(noise(len(t)), lo=1200, hi=7000) * np.exp(-t / dec)
    y = n * 1.2 + 0.5 * np.sin(2 * np.pi * tone * t) * np.exp(-t / 0.05)
    return y * vel * 0.6


def brush(vel=0.6, dec=0.16):
    t = tvec(0.45)
    env = (1 - np.exp(-t / 0.012)) * np.exp(-t / dec)
    return fft_filter(noise(len(t)), lo=900, hi=6000) * env * vel * 0.55


def hat(vel=0.5, dec=0.035):
    t = tvec(max(0.08, dec * 6))
    return fft_filter(noise(len(t)), lo=7000, order=3) * np.exp(-t / dec) * vel * 0.5


def shaker(vel=0.4):
    t = tvec(0.12)
    env = (1 - np.exp(-t / 0.012)) * np.exp(-t / 0.035)
    return fft_filter(noise(len(t)), lo=4000, hi=10000) * env * vel * 0.5


def rim(vel=0.5):
    t = tvec(0.06)
    y = np.sin(2 * np.pi * 1700 * t) * np.exp(-t / 0.01) + fft_filter(noise(len(t)), lo=2000, hi=6000) * np.exp(-t / 0.006)
    return y * vel * 0.4


def tick(vel=0.3, f=3200):
    t = tvec(0.04)
    return (np.sin(2 * np.pi * f * t) * np.exp(-t / 0.004) + fft_filter(noise(len(t)), lo=2500) * np.exp(-t / 0.002)) * vel * 0.5


def crash(vel=0.5, dec=1.2):
    t = tvec(dec * 3)
    return fft_filter(noise(len(t)), lo=4000, hi=12000) * np.exp(-t / dec) * (1 - np.exp(-t / 0.002)) * vel * 0.3


DRUMS = {'k': kick, 's': snare, 'b': brush, 'h': hat, 'H': lambda vel=0.5: hat(vel, 0.18), 'z': shaker, 'r': rim,
         'c': crash}


# ----------------------------------------------------------------- reverb
_IR_CACHE = {}


def make_ir(rt=2.0, damp=5000, predelay=0.018, seed=7):
    key = (rt, damp, predelay, seed)
    if key in _IR_CACHE:
        return _IR_CACHE[key]
    r = np.random.default_rng(seed)
    n = int(rt * SR)
    t = np.arange(n) / SR
    irs = []
    for ch in range(2):
        nz = r.standard_normal(n)
        bright = nz * np.exp(-6.9 * t / (rt * 0.5))
        dark = fft_filter(nz, hi=damp * 0.35) * np.exp(-6.9 * t / rt)
        ir = 0.5 * bright + dark
        ir *= (1 - np.exp(-t / 0.01))
        pd = int(predelay * SR) + ch * 37
        ir = np.concatenate([np.zeros(pd), ir])
        irs.append(ir / np.sqrt(np.sum(ir ** 2)))
    L = max(len(irs[0]), len(irs[1]))
    irs = np.array([np.pad(i, (0, L - len(i))) for i in irs])
    _IR_CACHE[key] = irs
    return irs


def convolve_stereo(x, ir):
    n = x.shape[1] + ir.shape[1] - 1
    nfft = 1 << (n - 1).bit_length()
    out = np.zeros((2, x.shape[1]))
    for ch in range(2):
        Y = np.fft.rfft(x[ch], nfft) * np.fft.rfft(ir[ch], nfft)
        out[ch] = np.fft.irfft(Y, nfft)[:x.shape[1]]
    return out


# ----------------------------------------------------------------- song / mixer
class Song:
    def __init__(self, bpm, beats, tail=5.0, swing=0.0, seed=None):
        self.bpm = bpm
        self.spb = 60.0 / bpm
        self.L = int(round(beats * self.spb * SR))
        self.N = self.L + int(tail * SR)
        self.dry = np.zeros((2, self.N))
        self.send = np.zeros((2, self.N))
        self.swing = swing
        self.stats = {}
        if seed is not None:
            global rng
            rng = np.random.default_rng(seed)

    def sec(self, beat):
        if self.swing:
            frac = beat % 1.0
            if abs(frac - 0.5) < 1e-6:
                beat += self.swing
            elif abs(frac - 0.25) < 1e-6 or abs(frac - 0.75) < 1e-6:
                beat += self.swing * 0.5
        return beat * self.spb

    def add(self, y, start_sec, pan=0.0, rev=0.2, gain=1.0):
        s = int(round(start_sec * SR))
        if s < 0:
            y = y[-s:]
            s = 0
        e = min(self.N, s + len(y))
        if e <= s:
            return
        y = y[:e - s] * gain
        a = (pan + 1) * np.pi / 4
        l, r = np.cos(a) * 1.414, np.sin(a) * 1.414
        self.dry[0, s:e] += y * l * 0.707
        self.dry[1, s:e] += y * r * 0.707
        if rev:
            self.send[0, s:e] += y * l * 0.707 * rev
            self.send[1, s:e] += y * r * 0.707 * rev

    def note(self, inst, beat, m, dur, vel=0.8, pan=0.0, rev=0.2, gain=1.0, jitter=0.004, hum=0.06, **kw):
        st = self.sec(beat) + (rng.normal(0, jitter) if jitter else 0)
        v = float(np.clip(vel * (1 + rng.normal(0, hum)), 0.05, 1.2)) if hum else vel
        y = inst(hz(m), dur * self.spb, v, **kw)
        self.stats[inst.__name__] = self.stats.get(inst.__name__, 0.0) + float(np.sum(y ** 2)) * gain * gain
        self.add(y, max(st, 0.0), pan, rev, gain)

    def seq(self, inst, notes, at=0.0, trans=0, **kw):
        for (b, m, d) in notes:
            self.note(inst, at + b, m + trans, d, **kw)

    def melody(self, inst, s, at=0.0, trans=0, **kw):
        n, tot = mel(s)
        self.seq(inst, n, at, trans, **kw)
        return tot

    def chord(self, inst, name, beat, dur, lo=55, trans=0, strum=0.0, **kw):
        for i, m in enumerate(voicing(name, lo, trans)):
            self.note(inst, beat + i * strum, m, dur, **kw)

    def drum(self, ch, beat, vel=0.8, pan=0.0, rev=0.1, gain=1.0):
        v = float(np.clip(vel * (1 + rng.normal(0, 0.07)), 0.05, 1.2))
        y = DRUMS[ch](v)
        self.stats['drum_' + ch] = self.stats.get('drum_' + ch, 0.0) + float(np.sum(y ** 2)) * gain * gain
        self.add(y, max(self.sec(beat) + rng.normal(0, 0.003), 0), pan, rev, gain)

    def drums(self, at, pattern, step=0.25, gains=None, pans=None, rev=0.08):
        """pattern: dict ch -> string; 'X' accent, 'x' normal, 'o' soft, 'g' ghost, '.' rest"""
        vm = {'X': 1.0, 'x': 0.8, 'o': 0.55, 'g': 0.3}
        for ch, pat in pattern.items():
            pat = pat.replace(' ', '').replace('|', '')
            for i, c in enumerate(pat):
                if c in vm:
                    self.drum(ch, at + i * step, vm[c], (pans or {}).get(ch, 0.0), rev, (gains or {}).get(ch, 1.0))

    # ---------------------------------------------------------- render
    def render(self, rt=2.0, wet=0.3, damp=5000, lp=None, hp=30, wobble=None, crackle=0.0, hiss=0.0, loop=True,
               width=1.0):
        mix = self.dry.copy()
        if wet:
            mix += convolve_stereo(self.send, make_ir(rt, damp)) * wet
        if loop:
            out = mix[:, :self.L].copy()
            tail = mix[:, self.L:]
            k = 0
            while k < tail.shape[1]:
                seg = tail[:, k:k + self.L]
                out[:, :seg.shape[1]] += seg
                k += self.L
        else:
            out = mix
        # mid/side width
        if width != 1.0:
            m_, s_ = (out[0] + out[1]) / 2, (out[0] - out[1]) / 2 * width
            out = np.array([m_ + s_, m_ - s_])
        n = out.shape[1]
        if lp or hp:
            out = np.array([_circ_filter(ch, hp, lp) if loop else fft_filter(ch, hp, lp) for ch in out])
        if wobble:
            depth_ms, rate = wobble
            if loop:
                cyc = max(1, round(rate * n / SR))
                rate = cyc * SR / n
            tt = np.arange(n)
            d = depth_ms * SR / 1000 * (0.5 + 0.5 * np.sin(2 * np.pi * rate * tt / SR))
            src = tt - d
            if loop:
                src = src % n
                for c in range(2):
                    ext = np.concatenate([out[c], out[c][:2]])
                    out[c] = np.interp(src, np.arange(n + 2), ext)
            else:
                for c in range(2):
                    out[c] = np.interp(np.clip(src, 0, n - 1), np.arange(n), out[c])
        if crackle or hiss:
            out += vinyl(n, crackle, hiss, loop)
        return out


def _circ_filter(x, lo, hi, order=2):
    X = np.fft.rfft(x)
    f = np.fft.rfftfreq(len(x), 1 / SR)
    H = np.ones_like(f)
    if hi:
        H /= np.sqrt(1 + (f / hi) ** (2 * order))
    if lo:
        H /= np.sqrt(1 + (lo / np.maximum(f, 1e-3)) ** (2 * order))
    return np.fft.irfft(X * H, n=len(x))


def vinyl(n, crackle, hiss, loop=True):
    out = np.zeros((2, n))
    if hiss:
        h = np.array([_circ_filter(rng.standard_normal(n), 300, 4000) for _ in range(2)])
        out += h * hiss * 0.02
    if crackle:
        cnt = int(n / SR * 9 * crackle)
        pos = rng.integers(0, n - 200, cnt)
        amp = rng.exponential(0.5, cnt) * crackle * 0.02
        for p, a in zip(pos, amp):
            L = rng.integers(8, 60)
            click = rng.standard_normal(L) * np.exp(-np.arange(L) / (L / 4)) * a
            ch = rng.integers(0, 2)
            out[ch, p:p + L] += click
            out[1 - ch, p:p + L] += click * 0.5
    return out


# ----------------------------------------------------------------- mastering / export
def master(x, target_peak=0.9, drive=1.0):
    """gentle soft-knee limiter + peak normalise."""
    x = x - x.mean(axis=1, keepdims=True)
    ref = np.percentile(np.abs(x), 99.95) + 1e-9
    x = x / ref * 0.8 * drive
    thr = 0.8
    a = np.abs(x)
    over = a > thr
    x[over] = np.sign(x[over]) * (thr + (1 - thr) * np.tanh((a[over] - thr) / (1 - thr)))
    return x / (np.max(np.abs(x)) + 1e-9) * target_peak


def write_ogg(path, x, q=4):
    if x.ndim == 1:
        x = x[None, :]
    ch = x.shape[0]
    data = np.clip(x.T, -1, 1).astype('<f4').tobytes()
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-f', 'f32le', '-ar', str(SR), '-ac', str(ch), '-i', '-',
                    '-c:a', 'libvorbis', '-q:a', str(q), str(path)], input=data, check=True)


def read_audio(path):
    p = subprocess.run(['ffmpeg', '-loglevel', 'error', '-i', str(path), '-f', 'f32le', '-ac', '2', '-ar', str(SR), '-'],
                       capture_output=True, check=True)
    return np.frombuffer(p.stdout, dtype='<f4').reshape(-1, 2).T
