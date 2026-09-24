"""PAPERLIGHT sound effects (mono)."""
import numpy as np
from synth import SR, fft_filter, tvec, musicbox, glock, toypiano, piano, kalimba, pad, kick, snare, hz, midi, \
    make_ir, convolve_stereo

R = np.random.default_rng(99)


def nz(n):
    return R.uniform(-1, 1, n)


def cat(parts, gaps):
    """place arrays at start times (sec)"""
    end = max(int(g * SR) + len(p) for p, g in zip(parts, gaps))
    out = np.zeros(end)
    for p, g in zip(parts, gaps):
        s = int(g * SR)
        out[s:s + len(p)] += p
    return out


def verb(x, rt=1.0, wet=0.25):
    ir = make_ir(rt, 5000, 0.01)
    st = convolve_stereo(np.array([np.pad(x, (0, int(rt * SR))), np.pad(x, (0, int(rt * SR)))]), ir)
    return np.pad(x, (0, int(rt * SR))) + wet * st.mean(axis=0)


def blip(f, dur=0.045, shape='sine', bright=0.0, drop=0.0):
    t = tvec(dur)
    fr = f * (1 - drop * t / dur)
    ph = 2 * np.pi * np.cumsum(fr) / SR
    if shape == 'sine':
        y = np.sin(ph) + bright * np.sin(2 * ph)
    elif shape == 'tri':
        y = 2 / np.pi * np.arcsin(np.sin(ph))
    elif shape == 'square':
        y = fft_filter(np.sign(np.sin(ph)), hi=2500) * 0.6
    env = np.minimum(1, t / 0.004) * np.exp(-t / (dur * 0.45))
    env[-int(0.005 * SR):] *= np.linspace(1, 0, int(0.005 * SR))
    return y * env


def swoosh(dur, lo, hi, f_from=600, f_to=4000, amp=1.0):
    n = int(dur * SR)
    t = np.arange(n) / SR
    # time-varying band via crossfade of two filtered noises
    a = fft_filter(nz(n), lo=f_from * 0.6, hi=f_from * 1.6)
    b = fft_filter(nz(n), lo=f_to * 0.6, hi=f_to * 1.6)
    k = t / t[-1]
    env = np.sin(np.pi * k) ** 1.5
    return (a * (1 - k) + b * k) * env * amp


def arp(inst, notes, step, vel=0.7, **kw):
    parts = [inst(hz(midi(n)), step * 2, vel, **kw) for n in notes]
    return cat(parts, [i * step for i in range(len(notes))])


def make():
    S = {}
    S['cursor'] = blip(1400, 0.03, bright=0.2) * 0.6
    S['confirm'] = cat([toypiano(hz(midi('E6')), 0.08, 0.8), toypiano(hz(midi('B6')), 0.15, 0.8)], [0, 0.06])
    S['cancel'] = cat([toypiano(hz(midi('G5')), 0.08, 0.6), toypiano(hz(midi('D5')), 0.15, 0.6)], [0, 0.06])
    t = tvec(0.22)
    S['buzzer'] = fft_filter(np.sign(np.sin(2 * np.pi * 110 * t)) + 0.5 * np.sign(np.sin(2 * np.pi * 116 * t)),
                             hi=1800) * np.exp(-t / 0.15) * 0.5
    S['blip'] = blip(620, 0.04, bright=0.15)
    S['blip_button'] = blip(520, 0.035, 'square')
    S['blip_moth'] = blip(980, 0.04, bright=0.05) * 0.8 + fft_filter(nz(int(0.04 * SR)), 3000, 8000) * np.exp(-tvec(0.04) / 0.01) * 0.1
    S['blip_mom'] = blip(330, 0.05, 'tri') * 0.9
    S['blip_owl'] = blip(260, 0.055, 'sine', bright=0.3, drop=0.15)
    S['blip_hush'] = fft_filter(blip(140, 0.06, 'tri') + nz(int(0.06 * SR)) * 0.4 * np.exp(-tvec(0.06) / 0.02), hi=900)
    # door: creak + thud
    n = int(0.6 * SR)
    tt = np.arange(n) / SR
    creak = np.sin(2 * np.pi * np.cumsum(180 + 60 * np.sin(2 * np.pi * 3 * tt)) / SR)
    creak = fft_filter(np.sign(creak) * (np.abs(nz(n)) > 0.7), 300, 2500) * np.sin(np.pi * tt / tt[-1]) * 0.35
    S['door'] = cat([creak, kick(0.7, 90, 50, 0.1) * 0.8], [0, 0.45])
    S['item'] = arp(glock, ['C6', 'E6', 'G6', 'C7'], 0.07, 0.6)
    S['save'] = verb(arp(musicbox, ['F5', 'A5', 'C6', 'F6', 'A6'], 0.09, 0.7), 1.5, 0.3)
    S['heal'] = verb(arp(glock, ['C6', 'D6', 'G6', 'A6', 'D7'], 0.05, 0.45), 1.0, 0.3)
    t = tvec(0.25)
    S['hit'] = kick(0.9, 160, 60, 0.08)[:len(t)] + fft_filter(nz(len(t)), 800, 5000) * np.exp(-t / 0.03) * 0.8
    t = tvec(0.5)
    S['crit'] = cat([S['hit'] * 1.2, arp(glock, ['G6', 'D7'], 0.04, 0.5)], [0, 0.03])
    S['miss'] = swoosh(0.22, 0, 0, 2500, 900, 0.8)
    t = tvec(0.3)
    S['guard'] = (np.sin(2 * np.pi * 420 * t) * np.exp(-t / 0.06) + 0.6 * np.sin(2 * np.pi * 1130 * t) * np.exp(-t / 0.04)
                  + fft_filter(nz(len(t)), 1000, 4000) * np.exp(-t / 0.02)) * 0.6
    t = tvec(0.35)
    S['hurt'] = kick(0.8, 120, 50, 0.1)[:len(t)] + np.sin(2 * np.pi * np.cumsum(500 - 900 * t) / SR) * np.exp(-t / 0.08) * 0.35
    S['soothe'] = verb(cat([musicbox(hz(midi('A5')), 0.2, 0.6), musicbox(hz(midi('F6')), 0.2, 0.5)], [0, 0.12]), 1.0, 0.3)[:int(1.3 * SR)]
    S['soothed'] = verb(cat([arp(musicbox, ['C6', 'F6', 'A6', 'C7'], 0.08, 0.55), pad(hz(midi('F4')), 0.6, 0.4)], [0, 0]), 1.5, 0.35)
    S['scatter'] = cat([fft_filter(nz(int(0.35 * SR)), 1500, 8000) * np.exp(-tvec(0.35) / 0.08) * 0.8,
                        arp(glock, ['E6', 'C6', 'A5', 'F5'], 0.05, 0.35)], [0, 0.03])
    S['encounter'] = cat([swoosh(0.35, 0, 0, 400, 5000, 1.0),
                          arp(toypiano, ['D5', 'A5', 'D6'], 0.05, 0.8), kick(0.9) * 0.8,
                          fft_filter(nz(int(0.5 * SR)), 3000, 11000) * np.exp(-tvec(0.5) / 0.15) * 0.4], [0, 0.3, 0.3, 0.3])
    S['light'] = verb(swoosh(0.5, 0, 0, 800, 6000, 0.6) + np.pad(arp(glock, ['A6', 'E7'], 0.12, 0.35), (0, 0))[:int(0.5 * SR)], 1.0, 0.35)
    S['levelup'] = verb(cat([arp(toypiano, ['C5', 'E5', 'G5', 'C6', 'E6', 'G6'], 0.06, 0.7),
                             arp(glock, ['C7'], 0.2, 0.5)], [0, 0.36]), 1.0, 0.25)
    n = int(0.4 * SR)
    tt = np.arange(n) / SR
    S['page'] = fft_filter(nz(n), 1200, 7000) * (np.sin(np.pi * tt / tt[-1]) ** 2) * (0.6 + 0.4 * np.sin(2 * np.pi * 38 * tt)) * 0.8
    S['together'] = verb(cat([swoosh(0.7, 0, 0, 300, 5000, 0.9), arp(glock, ['F5', 'A5', 'C6', 'F6'], 0.06, 0.5),
                              pad(hz(midi('F3')), 0.8, 0.8, attack=0.05, release=0.6, cutoff=2500),
                              pad(hz(midi('C4')), 0.8, 0.6, attack=0.05, release=0.6, cutoff=2500)], [0, 0.5, 0.5, 0.5]), 1.4, 0.35)
    n = int(0.6 * SR)
    tt = np.arange(n) / SR
    S['eraser'] = fft_filter(nz(n), 400, 3000) * (0.5 + 0.5 * np.sign(np.sin(2 * np.pi * 9 * tt))) * np.sin(np.pi * tt / tt[-1]) * 0.9
    hb = kick(0.9, 70, 40, 0.12)
    S['heartbeat'] = fft_filter(cat([hb, hb * 0.7], [0, 0.28]), hi=400)
    n = int(1.6 * SR)
    tt = np.arange(n) / SR
    ring = (np.sin(2 * np.pi * 440 * tt) + np.sin(2 * np.pi * 480 * tt)) * (np.sin(2 * np.pi * 20 * tt) > 0) * 0.4
    gate = ((tt % 0.8) < 0.4) * 1.0
    S['phone'] = fft_filter(ring * gate, 300, 3500)
    S['tick'] = np.pad(kick(0.2, 3000, 2000, 0.004)[:int(0.03 * SR)], (0, 200)) + fft_filter(nz(int(0.03 * SR) + 200), 2000) * np.exp(-np.arange(int(0.03 * SR) + 200) / SR / 0.003) * 0.4
    S['thud'] = kick(1.0, 90, 40, 0.18) + np.pad(fft_filter(nz(int(0.1 * SR)), 100, 1200) * np.exp(-tvec(0.1) / 0.03) * 0.5, (0, len(kick()) - int(0.1 * SR)))
    S['whoosh'] = swoosh(0.5, 0, 0, 500, 3500, 1.0)
    S['sparkle'] = verb(cat([glock(hz(midi(n)), 0.1, 0.35) for n in ['E7', 'B6', 'G#7', 'C#7', 'F#7']],
                            [0, 0.06, 0.11, 0.18, 0.24]), 0.8, 0.3)
    t = tvec(0.09)
    S['step'] = fft_filter(nz(len(t)), 150, 1800) * np.exp(-t / 0.018) * 0.7 + np.sin(2 * np.pi * 90 * t) * np.exp(-t / 0.02) * 0.3
    n = int(0.6 * SR)
    tt = np.arange(n) / SR
    bubbles = sum(np.sin(2 * np.pi * np.cumsum(np.full(n, f) * (1 + 2 * np.clip(tt - o, 0, None))) / SR)
                  * np.exp(-np.clip(tt - o, 0, None) / 0.03) * (tt >= o) for f, o in [(700, 0.05), (900, 0.12), (1200, 0.2)])
    S['splash'] = fft_filter(nz(n), 300, 5000) * np.exp(-tt / 0.15) * 0.8 + bubbles * 0.2
    t = tvec(2.2)
    f0 = hz(midi('A4'))
    S['bell'] = sum(a * np.sin(2 * np.pi * f0 * r * t) * np.exp(-t / d) for a, r, d in
                    [(1, 1, 1.5), (0.6, 2.0, 0.9), (0.4, 2.4, 0.6), (0.3, 3.0, 0.4), (0.25, 4.2, 0.3), (0.3, 0.5, 2.0)]) * 0.35
    S['shimmer'] = verb(swoosh(1.0, 0, 0, 3000, 9000, 0.4) + cat([glock(hz(midi(n)), 0.2, 0.2) for n in ['C7', 'E7', 'G7', 'B7']],
                                                                 [0.1, 0.3, 0.5, 0.7])[:int(1.0 * SR)], 1.2, 0.35)
    return S
