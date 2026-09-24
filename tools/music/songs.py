"""PAPERLIGHT soundtrack — all compositions original.

Leitmotif "Nana's theme": F major, 3/4, a 16-bar lullaby.
"""
import numpy as np
from synth import *  # noqa
import synth

LAST = {}
_Song = Song


class Song(_Song):  # remember the last song for stem diagnostics
    def __init__(self, *a, **k):
        super().__init__(*a, **k)
        LAST['song'] = self

# ---------------------------------------------------------------- leitmotif
THEME = ("A4:2 C5:1 | Bb4:1 A4 G4 | F4:2 G4:1 | A4:3 | D5:2 C5:1 | Bb4:1 A4 Bb4 | C5:1 Bb4 G4 | A4:3 | "
         "F5:2 E5:1 | D5:1 C5 A4 | Bb4:2 D5:1 | C5:3 | A4:1 C5 F5 | E5:2 D5:1 | Bb4:1 G4 E4 | F4:3")
THEME_CH = ['F', 'C7', 'Bb', 'F', 'Dm', 'Gm', 'C7', 'F', 'Dm', 'Am', 'Gm', 'C', 'F', 'Am', 'C7', 'F']
# F-minor ("unfinished") version of the same melody
THEME_MIN = ("Ab4:2 C5:1 | Bb4:1 Ab4 G4 | F4:2 G4:1 | Ab4:3 | Db5:2 C5:1 | Bb4:1 Ab4 Bb4 | C5:1 Bb4 G4 | Ab4:3 | "
             "F5:2 E5:1 | Db5:1 C5 Ab4 | Bb4:2 Db5:1 | C5:3 | Ab4:1 C5 F5 | E5:2 Db5:1 | Bb4:1 G4 E4 | F4:3")
THEME_MIN_CH = ['Fm', 'C7', 'Bbm', 'Fm', 'Db', 'Bbm', 'C7', 'Fm', 'Db', 'Db', 'Bbm', 'C', 'Fm', 'C7', 'C7', 'Fm']


def theme_bars(s=THEME):
    """list of 16 bars, each a list of (beat_in_bar, midi, dur)"""
    notes, _ = mel(s)
    bars = [[] for _ in range(16)]
    for b, m, d in notes:
        bars[int(b // 3)].append((b % 3, m, d))
    return bars


def bass_oct(name, trans=0, lo=41):
    r, _ = chord(name, 2, trans)
    while r < lo:
        r += 12
    while r >= lo + 12:
        r -= 12
    return r


def waltz(s, inst, name, at, trans=0, lo=57, vel=0.4, bvel=0.55, bass_dur=3, **kw):
    s.note(inst, at, bass_oct(name, trans), bass_dur, bvel, **kw)
    s.chord(inst, name, at + 1, 0.9, lo, trans, vel=vel, **kw)
    s.chord(inst, name, at + 2, 0.9, lo, trans, vel=vel * 0.85, **kw)


def bassline(s, inst, name, at, pattern, trans=0, lo=36, **kw):
    r, tones = chord(name, 2, trans)
    while r < lo:
        r += 12
    while r >= lo + 12:
        r -= 12
    iv = [t - tones[0] for t in tones]
    sym = {'R': 0, '8': 12, '5': iv[2], '3': iv[1], '7': iv[3] if len(iv) > 3 else 12, '4': 5, '6': 9, '-': -12,
           'b': -2}
    for (b, k, d) in pattern:
        s.note(inst, at + b, r + sym[k], d, **kw)


def prog(chords, bar_beats):
    """chords: list of name or (name, beats) -> list of (name, start, dur)"""
    out, t = [], 0.0
    for c in chords:
        if isinstance(c, tuple):
            out.append((c[0], t, c[1]))
            t += c[1]
        else:
            out.append((c, t, bar_beats))
            t += bar_beats
    return out


def cricket(vel=0.1):
    t = tvec(0.35)
    y = np.sin(2 * np.pi * 4300 * t) * (np.sin(2 * np.pi * 28 * t) > 0.2) * np.exp(-t / 0.2)
    return fft_filter(y, hi=8000) * vel


# ================================================================ tracks
def title():
    s = Song(84, 96, tail=5, seed=11)
    bars = theme_bars()
    for rep in range(2):
        at0 = rep * 48
        for i, ch in enumerate(THEME_CH):
            at = at0 + i * 3
            for b, m, d in bars[i]:
                s.note(musicbox, at + b, m + 12, d, 0.75, pan=0.1, rev=0.35)
            r = bass_oct(ch) + 12
            vc = voicing(ch, 60)
            s.note(musicbox, at, r, 1, 0.38, pan=-0.3, rev=0.3)
            s.note(musicbox, at + 1, vc[1], 1, 0.3, pan=-0.2, rev=0.3)
            s.note(musicbox, at + 2, vc[-1], 1, 0.3, pan=-0.2, rev=0.3)
            s.chord(pad, ch, at, 3, 53, vel=0.22 if rep == 0 else 0.3, pan=0, rev=0.5, jitter=0)
            if rep == 1:
                waltz(s, piano, ch, at, lo=57, vel=0.22, bvel=0.35, pan=-0.1, rev=0.3)
                top = voicing(ch, 72)
                if i % 2 == 0:
                    s.note(glock, at, top[1], 3, 0.25, pan=0.4, rev=0.45)
    out = s.render(rt=2.6, wet=0.38, lp=9000, wobble=(2.2, 0.55), crackle=0.6, hiss=0.4)
    return out, True


def house():
    s = Song(66, 64, tail=5, seed=12)
    chords = ['Am', 'F', 'Dm7', 'E'] * 4
    melody = ("r:2 E5:1 C5:1 | A4:3 r:1 | F4:1 A4:1 D5:1 C5:1 | B4:4 | r:2 C5:1 E5:1 | G5:2 F5:1 E5:1 | "
              "D5:2 C5:1 B4:1 | G#4:3 r:1 | A5:4 | r:2 C6:1 A5:1 | F5:4 | r:2 E5:1 G#5:1 | A5:1.5 G5:0.5 E5:2 | "
              "F5:1 E5:1 C5:2 | D5:1 E5:1 F5:1 A5:1 | G#5:2 B4:2")
    for i, ch in enumerate(chords):
        at = i * 4
        r = bass_oct(ch)
        s.note(piano, at, r, 4, 0.33, pan=-0.2, rev=0.3)
        vc = voicing(ch, 57)
        for k, b in enumerate([1, 2, 3]):
            s.note(piano, at + b, vc[k % len(vc)] if k < 2 else vc[-1] + (0 if len(vc) < 4 else 0), 1.2,
                   0.26, pan=-0.1, rev=0.3)
    s.melody(piano, melody, 0, vel=0.5, pan=0.15, rev=0.35)
    for b in range(64):
        s.add(tick(0.35, 3100 if b % 2 == 0 else 2500), s.sec(b), pan=0.5, rev=0.25, gain=0.35)
    return s.render(rt=2.2, wet=0.32, lp=7000, wobble=(1.0, 0.3), hiss=0.35, crackle=0.15), True


def house_night():
    s = Song(56, 64, tail=6, seed=13)
    chords = ['Dm', 'Dm', 'Bbmaj7', 'Bbmaj7', 'Gm7', 'Gm7', 'Asus4', 'A'] * 2
    for i in range(0, 16, 2):
        ch = chords[i]
        s.chord(pad, ch, i * 4, 8 if chords[i + 1] == ch else 4, 50, vel=0.3, rev=0.6, jitter=0, cutoff=900,
                attack=1.5, release=2.0)
        if chords[i + 1] != ch:
            s.chord(pad, chords[i + 1], i * 4 + 4, 4, 50, vel=0.3, rev=0.6, jitter=0, cutoff=900, attack=1.2,
                    release=2.0)
        s.note(piano, i * 4, bass_oct(ch) - 12 if bass_oct(ch) > 45 else bass_oct(ch), 6, 0.35, rev=0.6, bright=0.6)
    frag1 = "A4:2 C5:2 | Bb4:1.33 A4:1.33 G4:1.34 | F4:3 G4:1 | A4:4"
    frag2 = "D5:3 C5:1 | Bb4:2 A4:2 | G4:4 | A4:4"
    s.melody(piano, frag1, 8, vel=0.38, bright=0.6, pan=0.25, rev=0.8)
    s.melody(piano, frag2, 40, vel=0.36, bright=0.6, pan=-0.25, rev=0.8)
    for b in [28, 30, 58, 61]:
        s.note(musicbox, b, 81 if b < 40 else 77, 1, 0.12, rev=0.9, pan=0.5)
    return s.render(rt=3.8, wet=0.55, lp=4200, wobble=(1.5, 0.2), hiss=0.3), True


MEADOW_A = ("D5:1 B4:0.5 D5:0.5 G5:1 D5:1 | E5:1.5 D5:0.5 B4:2 | C5:1 E5:0.5 G5:0.5 E5:1 C5:1 | D5:3 r:1 | "
            "B4:0.5 C5:0.5 D5:1 G5:1 A5:1 | B5:1.5 A5:0.5 G5:1 E5:1 | E5:1 G5:0.5 E5:0.5 D5:1 C5:1 | B4:2 A4:1 r:1")
MEADOW_B = ("E5:0.5 E5:0.5 E5:1 D5:1 C5:1 | D5:0.5 D5:0.5 D5:1 C5:1 B4:1 | B4:1 D5:1 F#5:1 D5:1 | E5:3 r:1 | "
            "C5:1 E5:1 G5:1 E5:1 | F#5:1 A5:1 F#5:1 D5:1 | G5:1.5 F#5:0.5 E5:1 D5:1 | D5:2 F#5:1 A5:1")


def meadow():
    s = Song(100, 128, tail=4, swing=0.07, seed=14)
    chords = ['G', 'Em', 'C', 'D', 'G', 'Em', 'C', 'D', 'C', 'D', 'Bm', 'Em', 'C', 'D', 'G', 'D']
    bpat = [(0, 'R', 1), (1.5, '5', 0.5), (2, 'R', 1), (3, '8', 0.5), (3.5, '5', 0.5)]
    for rep in range(2):
        at0 = rep * 64
        for i, ch in enumerate(chords):
            at = at0 + i * 4
            bassline(s, ks, ch, at, bpat, vel=0.8, pan=0, rev=0.05, bright=0.35, decay=0.994, gain=0.75)
            for b in [0.5, 1.5, 2.5, 3.5]:
                s.chord(uke, ch, at + b, 0.3, 60, strum=0.012, vel=0.3, pan=-0.35, rev=0.15)
            s.drums(at, {'k': 'x.......x.o.....', 'b': '....x.......x...', 'z': 'g.o.g.o.g.o.g.o.'},
                    gains={'k': 0.6, 'b': 1.5, 'z': 1.6}, pans={'z': 0.4})
        if rep == 0:
            s.melody(toypiano, MEADOW_A, at0, vel=0.75, pan=0.1, rev=0.2)
            s.melody(toypiano, MEADOW_B, at0 + 32, vel=0.75, pan=0.1, rev=0.2)
        else:
            s.melody(glock, MEADOW_A, at0, trans=12, vel=0.5, pan=0.25, rev=0.25)
            s.melody(toypiano, MEADOW_A, at0, vel=0.6, pan=-0.05, rev=0.2)
            s.melody(glock, MEADOW_B, at0 + 32, trans=12, vel=0.5, pan=0.25, rev=0.25)
            s.melody(toypiano, MEADOW_B, at0 + 32, vel=0.6, pan=-0.05, rev=0.2)
            for i, ch in enumerate(chords):
                s.chord(pad, ch, at0 + i * 4, 4, 55, vel=0.18, rev=0.4, jitter=0, cutoff=1800)
    return s.render(rt=1.8, wet=0.26, lp=10000, wobble=(1.5, 0.5), crackle=0.5, hiss=0.3), True


VILLAGE_A = ("C5:0.5 A4:0.5 C5:0.5 F5:1 E5:0.5 D5:0.5 C5:0.5 | D5:1 A4:1 r:0.5 F4:0.5 A4:1 | "
             "Bb4:0.5 D5:0.5 F5:0.5 D5:0.5 G5:1 F5:1 | E5:1.5 C5:0.5 r:2 | A5:0.5 G5:0.5 F5:0.5 C5:0.5 A4:1 F5:1 | "
             "E5:1 C#5:1 E5:0.5 G5:0.5 E5:1 | D5:0.5 E5:0.5 F5:1 A5:1 F5:1 | G5:1 E5:1 F5:2")
VILLAGE_B = ("D5:1 D5:0.5 F5:0.5 Bb5:2 | A5:1 G5:1 E5:1 C5:1 | C5:0.5 E5:0.5 A5:1 G5:1 E5:1 | F5:3 r:1 | "
             "Bb4:1 D5:1 G5:1 F5:1 | E5:1 G5:1 C6:2 | D6:1 C6:1 Bb5:1 G5:1 | E5:2 C5:1 r:1")


def village():
    s = Song(112, 128, tail=4, swing=0.12, seed=15)
    chords = ['F', 'Dm', 'Bb', 'C', 'F', 'A7', 'Dm', ('Bb', 2), ('C', 2),
              'Bb', 'C', 'Am', 'Dm', 'Gm', 'C', 'Bb', 'C7']
    walk = [(0, 'R', 1), (1, '5', 1), (2, '8', 1), (3, '5', 1)]
    for rep in range(2):
        at0 = rep * 64
        for ch, st, du in prog(chords, 4):
            at = at0 + st
            pat = walk if du == 4 else [(0, 'R', 1), (1, '5', 1)]
            bassline(s, ks, ch, at, pat, vel=0.8, bright=0.3, decay=0.992, pan=0.05, rev=0.06, gain=0.85)
            for b, v in [(0, 0.45), (1, 0.35), (1.5, 0.25), (2.5, 0.3), (3, 0.35)]:
                if b < du:
                    s.chord(uke, ch, at + b, 0.35, 60, strum=0.014 if b % 1 == 0 else -0.0, vel=v, pan=-0.3, rev=0.15)
        for bar in range(16):
            s.drums(at0 + bar * 4, {'k': 'x.......x.......', 'r': '....x.......x...', 'z': '..o...o...o...o.'},
                    gains={'k': 0.6, 'r': 2.0, 'z': 1.8}, pans={'r': -0.2, 'z': 0.4})
        s.melody(whistle, VILLAGE_A, at0, vel=0.7, pan=0.15, rev=0.28)
        s.melody(whistle, VILLAGE_B, at0 + 32, vel=0.7, pan=0.15, rev=0.28)
        if rep == 1:
            s.melody(glock, VILLAGE_A, at0, trans=12, vel=0.35, pan=0.35, rev=0.3)
            s.melody(glock, VILLAGE_B, at0 + 32, trans=12, vel=0.35, pan=0.35, rev=0.3)
    return s.render(rt=1.6, wet=0.24, lp=10000, wobble=(1.2, 0.5), crackle=0.45, hiss=0.3), True


def forest():
    s = Song(72, 64, tail=6, seed=16)
    chords = ['Em', 'Em', 'Cmaj7', 'Cmaj7', 'Am7', 'Am7', 'B7sus4', 'B7'] * 2
    pat = [0, 2, 1, 3, None, 2, 1, None]
    for i, ch in enumerate(chords):
        at = i * 4
        vc = voicing(ch, 64)
        vc = vc + [vc[0] + 12]
        for k, p in enumerate(pat):
            if p is not None:
                s.note(kalimba, at + k * 0.5, vc[p % len(vc)], 0.5, 0.45 if k % 4 == 0 else 0.32,
                       pan=-0.4 if k % 2 else 0.3, rev=0.4)
        if i % 2 == 0:
            s.chord(pad, ch, at, 8 if chords[i + 1] == ch else 4, 48, vel=0.28, rev=0.6, jitter=0, cutoff=700,
                    attack=1.5, release=2)
        if chords[i - 1] != ch and i % 2 == 1:
            s.chord(pad, ch, at, 4, 48, vel=0.28, rev=0.6, jitter=0, cutoff=700, attack=1.0, release=2)
        s.note(bass, at, bass_oct(ch, lo=36), 3.5, 0.35, rev=0.2, tone=0.1)
    s.melody(flute, "E5:4 | F#5:4 | G5:6 E5:2 | A5:4 | G5:4 | F#5:4 | D#5:4", 0, vel=0.45, pan=0.2, rev=0.5)
    s.melody(kalimba, "B5:2 G5:1 E5:1 | F#5:3 r:1 | G5:2 E5:1 B4:1 | C5:3 r:1 | E5:1 G5:1 A5:1 C6:1 | B5:4 | "
                      "A5:2 E5:2 | D#5:3 r:1", 32, vel=0.6, pan=0.1, rev=0.5)
    for _ in range(26):
        s.add(cricket(0.08), rng.uniform(0, s.L / SR), pan=rng.uniform(-0.8, 0.8), rev=0.4)
    n = s.L
    wind = fft_filter(rng.standard_normal(n), 150, 900) * 0.05
    tt = np.arange(n) / SR
    wind *= 0.5 + 0.5 * np.sin(2 * np.pi * tt * (3 / (n / SR))) ** 2
    s.add(wind, 0, pan=0, rev=0.2)
    return s.render(rt=3.2, wet=0.45, lp=8000, wobble=(1.0, 0.3), hiss=0.25), True


BATTLE_A = ("D5:0.5 F5:0.5 A5:0.5 G5:0.5 F5:0.5 D5:1 C5:0.5 | D5:1.5 B4:0.5 G4:1 r:1 | "
            "A4:0.5 C5:0.5 D5:0.5 F5:0.5 E5:0.5 D5:0.5 C5:0.5 A4:0.5 | B4:1 D5:1 G5:1.5 r:0.5 | "
            "A5:0.5 A5:0.5 G5:0.5 F5:0.5 G5:1 A5:1 | B5:0.5 A5:0.5 G5:0.5 F5:0.5 D5:2 | "
            "F5:1 D5:0.5 F5:0.5 A5:1 G5:1 | E5:1 C#5:1 A4:1 E5:1")
BATTLE_B = ("G5:0.5 F5:0.5 D5:0.5 Bb4:0.5 D5:1 F5:1 | E5:1.5 G5:0.5 Bb5:1 G5:1 | A5:2 C6:1 A5:1 | "
            "F5:0.5 G5:0.5 A5:0.5 F5:0.5 D5:2 | E5:0.5 G5:0.5 Bb5:0.5 G5:0.5 E5:1 D5:1 | C#5:1 E5:1 G5:1 A5:1 | "
            "F5:0.5 E5:0.5 D5:0.5 C5:0.5 D5:1 A4:1 | C#5:1 E5:1 A5:1 r:1")


def battle():
    s = Song(136, 128, tail=3, seed=17)
    A = ['Dm7', 'G7', 'Dm7', 'G7', 'Dm7', 'G7', 'Bbmaj7', 'A7']
    B = ['Gm7', 'C7', 'Fmaj7', 'Bbmaj7', 'Em7b5', 'A7', 'Dm7', 'A7']
    form = [('A', A, 0), ('B', B, 1), ('A', A, 2), ('B', B, 3)]
    bpat = [(0, 'R', 0.75), (0.75, 'R', 0.25), (1, '8', 0.25), (1.5, '5', 0.5), (2, 'R', 0.5), (2.5, '7', 0.25),
            (2.75, '8', 0.5), (3.25, '5', 0.25), (3.5, '3', 0.25), (3.75, '5', 0.25)]
    for sec, chords, k in form:
        at0 = k * 32
        for i, ch in enumerate(chords):
            at = at0 + i * 4
            bassline(s, bass, ch, at, bpat, vel=0.8, tone=0.45, rev=0.03)
            for b in [0.75, 1.5, 2.75, 3.5]:
                s.chord(piano, ch, at + b, 0.3, 57, vel=0.42, felt=False, pan=-0.25, rev=0.15)
            fill = (i == 7)
            s.drums(at, {'k': 'x..x..x...x..o..',
                         's': '....x..g.g..x..g' if not fill else '....x..g.g..xxox',
                         'h': 'xoxoxoxoxoxoxo.o' if not fill else 'xoxoxoxoxoxo....',
                         'H': '..............x.'},
                    gains={'k': 0.8, 's': 1.7, 'h': 1.0, 'H': 0.8}, pans={'h': 0.3, 'H': 0.3})
            if sec == 'B':
                s.chord(pad, ch, at, 4, 55, vel=0.22, rev=0.3, jitter=0, cutoff=2000, attack=0.2, release=0.4)
        mel_s = BATTLE_A if sec == 'A' else BATTLE_B
        if k == 2:
            s.melody(lead, mel_s, at0, trans=-12, vel=0.65, pan=0.1, rev=0.15, jitter=0.002, gain=2.2)
            s.melody(glock, mel_s, at0, trans=12, vel=0.35, pan=0.3, rev=0.2, jitter=0.002)
        else:
            s.melody(lead, mel_s, at0, vel=0.6, pan=0.1, rev=0.15, jitter=0.002, gain=2.2)
        if k in (0, 2):
            s.add(crash(0.45), s.sec(at0), pan=-0.3, rev=0.1)
    return s.render(rt=1.4, wet=0.18, lp=12000, wobble=(0.7, 0.4), crackle=0.3, hiss=0.2), True


BOSS_A = ("C5:0.5 Eb5:0.5 G5:1 F5:0.5 Eb5:0.5 D5:1 | C5:1 Eb5:1 Ab5:1.5 G5:0.5 | F5:0.5 G5:0.5 F5:0.5 D5:0.5 Bb4:1 D5:1 | "
          "B4:2 D5:1 G5:1 | C6:1 Bb5:0.5 G5:0.5 Eb5:1 G5:1 | Ab5:1.5 G5:0.5 F5:1 Eb5:1 | "
          "D5:0.5 Eb5:0.5 F5:1 Bb5:1 Ab5:1 | G5:3 r:1")
BOSS_B = ("F5:1 Ab5:1 C6:1 Ab5:1 | G5:1.5 Eb5:0.5 C5:2 | Eb5:0.5 F5:0.5 G5:0.5 Ab5:0.5 C6:1 Bb5:1 | B5:2 G5:2 | "
          "Ab5:1 G5:1 F5:1 Eb5:1 | D5:1 F5:1 Bb5:2 | C6:0.5 B5:0.5 C6:0.5 G5:0.5 Eb5:1 C5:1 | D5:1 F5:1 B5:1 G5:1")


def boss():
    s = Song(150, 128, tail=3, seed=18)
    A = ['Cm', 'Ab', 'Bb', 'G'] * 2
    B = ['Fm', 'Cm', 'Ab', 'G', 'Ab', 'Bb', 'Cm', 'G7']
    form = [('A', A, 0), ('B', B, 1), ('A', A, 2), ('B', B, 3)]
    for sec, chords, k in form:
        at0 = k * 32
        for i, ch in enumerate(chords):
            at = at0 + i * 4
            r = bass_oct(ch, lo=36)
            for j in range(8):
                s.note(bass, at + j * 0.5, r + (12 if j in (2, 5, 7) else 0), 0.45, 0.8 if j % 2 == 0 else 0.65,
                       tone=0.6, rev=0.02)
            s.chord(pad, ch, at, 4, 55, vel=0.3, rev=0.25, jitter=0, cutoff=1600, attack=0.05, release=0.3)
            for b in [0, 1.5, 3]:
                s.chord(piano, ch, at + b, 0.4, 60, vel=0.4, felt=False, pan=-0.3, rev=0.15)
            if i % 2 == 0:
                s.note(piano, at, r, 2, 0.6, felt=False, rev=0.2)
            fill = (i == 7)
            s.drums(at, {'k': 'x...x...x...x...' if not fill else 'x...x...x.x.xxxx',
                         's': '....x.......x...' if not fill else '....x.......x.xx',
                         'h': 'gogogogogogogogo', 'H': '..x...x...x...x.'},
                    gains={'k': 0.85, 's': 1.7, 'h': 0.9, 'H': 0.6}, pans={'h': 0.3, 'H': -0.3})
        mel_s = BOSS_A if sec == 'A' else BOSS_B
        s.melody(lead, mel_s, at0, vel=0.62, duty=0.5, cutoff=5000, pan=0.1, rev=0.15, jitter=0.002, gain=2.0)
        if k >= 2:
            s.melody(strings, mel_s, at0, trans=-12, vel=0.4, pan=-0.2, rev=0.25, jitter=0.002, gain=2.0)
        s.add(crash(0.5), s.sec(at0), pan=0.3, rev=0.1)
    return s.render(rt=1.5, wet=0.2, lp=11000, wobble=(0.6, 0.4), crackle=0.2, hiss=0.15), True


def unfinished():
    s = Song(70, 72, tail=7, seed=19)
    bars = theme_bars(THEME_MIN)
    plan = [(0, 0), (1, 1), (2, 2), (3, 3), (6, 4), (7, 5), (8, 6), (9, 7), (12, 8), (13, 9), (14, 10), (15, 11),
            (16, 12), (17, 13), (18, 14)]  # (bar position, theme bar) — last bar of the theme never arrives
    for pos, tb in plan:
        for b, m, d in bars[tb]:
            if pos >= 6 and rng.random() < 0.22:
                continue
            oc = 12 if rng.random() > 0.15 else 24
            s.note(musicbox, pos * 3 + b, m + oc, d, 0.6, detune=rng.uniform(-35, 35), pan=rng.uniform(-0.5, 0.5),
                   rev=0.6, jitter=0.02)
    for pos in range(19, 24):
        s.note(musicbox, pos * 3, midi('F4'), 3, 0.35, detune=rng.uniform(-20, 20), rev=0.7)
    s.note(pad, 0, midi('F2'), 72, 0.3, rev=0.4, jitter=0, cutoff=500, attack=3, release=3)
    s.note(pad, 0, midi('C3'), 72, 0.2, rev=0.4, jitter=0, cutoff=500, attack=3, release=3)
    s.note(pad, 36, midi('Db3'), 24, 0.18, rev=0.6, jitter=0, cutoff=600, attack=4, release=4)
    for _ in range(10):  # pencil scratches
        L = int(rng.uniform(0.2, 0.6) * SR)
        tt = np.arange(L) / SR
        y = fft_filter(rng.standard_normal(L), 2500, 7000) * (0.5 + 0.5 * np.sin(2 * np.pi * rng.uniform(6, 14) * tt)) \
            * np.sin(np.pi * tt / tt[-1]) * 0.05
        s.add(y, rng.uniform(0, s.L / SR - 1), pan=rng.uniform(-0.7, 0.7), rev=0.3)
    return s.render(rt=4.0, wet=0.55, lp=7000, wobble=(4.0, 0.35), crackle=0.8, hiss=0.5), True


def hush():
    s = Song(90, 96, tail=7, seed=20)
    n = s.L
    tt = np.arange(n) / SR
    bar = 4 * s.spb
    env = 0.6 + 0.4 * np.sin(2 * np.pi * tt / (8 * bar)) ** 2
    for b0, b1 in [(10, 12), (18, 20)]:
        a, e = int(b0 * bar * SR), int(b1 * bar * SR)
        fade = int(0.08 * SR)
        env[a:e] = 0
        env[a - fade:a] *= np.linspace(1, 0, fade)
        env[e:e + int(1.5 * SR)] *= np.linspace(0, 1, int(1.5 * SR))
    f0 = hz(midi('C#2'))
    drone = (np.sin(2 * np.pi * f0 * tt) + 0.3 * np.sin(4 * np.pi * f0 * tt) + 0.1 * np.sin(2 * np.pi * f0 * 1.5 * tt))
    s.add(drone * env * 0.22, 0, rev=0.2)
    padsig = np.zeros(n)
    for m in ['C#3', 'G#3', 'E3']:
        pp = pad(hz(midi(m)), n / SR, 0.5, attack=0.1, release=1.0, cutoff=450)[:n]
        padsig[:len(pp)] += pp
    s.add(padsig * env * 0.8, 0, rev=0.5)
    hits = [0, 9, 20, 32, 38, 48, 66, 72, 83, 88]
    for h in hits:
        for m in ['C#1', 'C#2', 'G#2', 'D3']:
            s.note(piano, h, midi(m), 4, 0.85, felt=False, rev=0.6, jitter=0)
    for barn in list(range(2, 10)) + list(range(12, 18)) + list(range(20, 24)):
        s.add(kick(0.7, 80, 36, 0.3), s.sec(barn * 4), rev=0.3, gain=0.8)
        s.add(kick(0.5, 80, 36, 0.3), s.sec(barn * 4 + 0.4), rev=0.3, gain=0.8)
    for barn in [7, 15, 23]:
        s.melody(musicbox, "E6:1 G#6:1 F#6:2", barn * 4, vel=0.35, detune=-15, rev=0.9, pan=0.3)
    for m in ['C#4', 'E4', 'G#4', 'B4']:
        s.note(strings, 48, midi(m), 16, 0.35, attack=6, release=2, rev=0.5)
    return s.render(rt=4.5, wet=0.45, lp=6000, wobble=(1.5, 0.2), hiss=0.3), True


def speak():
    s = Song(92, 96, tail=5, seed=21)
    bars = theme_bars()
    for half in range(2):
        tr = 0 if half == 0 else 2
        at0 = half * 48
        for i, ch in enumerate(THEME_CH):
            at = at0 + i * 3
            ctr = tr
            chn = ch
            if half == 1 and i == 15:
                chn, ctr = 'C7', 0
            for b, m, d in bars[i]:
                if half == 0:
                    s.note(piano, at + b, m + tr, d, 0.62, pan=0.1, rev=0.3)
                else:
                    s.note(strings, at + b, m + tr + 12, d, 0.5, pan=0.15, rev=0.35, attack=0.08)
                    s.note(glock, at + b, m + tr + 12, d, 0.28, pan=0.35, rev=0.35)
                    s.note(piano, at + b, m + tr, d, 0.45, pan=0.05, rev=0.3)
            waltz(s, piano, chn, at, trans=ctr, vel=0.3 if half == 0 else 0.36, bvel=0.5, pan=-0.15, rev=0.3)
            s.chord(strings, chn, at, 3, 50, trans=ctr, vel=0.25 + 0.012 * i + 0.1 * half, rev=0.45, attack=0.5,
                    release=0.6)
            if half == 1:
                s.note(strings, at, bass_oct(chn, ctr, lo=36), 3, 0.35, rev=0.3)
            if half == 0 and i >= 8:
                s.drums(at, {'k': 'x...........', 'b': '....o...o...'}, gains={'k': 0.6, 'b': 1.4})
            if half == 1:
                s.drums(at, {'k': 'x.......x...' if i >= 8 else 'x...........', 'b': '....x...x...',
                             'z': '..o...o...o.'}, gains={'k': 0.75, 'b': 1.6, 'z': 1.6})
        s.add(crash(0.35), s.sec(at0 + (24 if half == 0 else 0)), rev=0.3)
    return s.render(rt=2.6, wet=0.34, lp=12000, wobble=(0.8, 0.3), hiss=0.15, crackle=0.2), True


def owl():
    s = Song(76, 96, tail=5, seed=22)
    bars = theme_bars()
    for rep in range(2):
        at0 = rep * 48
        for i, ch in enumerate(THEME_CH):
            at = at0 + i * 3
            for b, m, d in bars[i]:
                s.note(piano, at + b, m + 12, d, 0.55, pan=0.12, rev=0.35)
            waltz(s, piano, ch, at, vel=0.24, bvel=0.4, pan=-0.15, rev=0.3)
            s.chord(pad, ch, at, 3, 53, vel=0.16, rev=0.5, jitter=0, cutoff=1100)
            if rep == 1:
                first = bars[i][0][1] + 12
                cand = [v for v in voicing(ch, 60) + [x + 12 for x in voicing(ch, 60)] if v <= first - 3]
                if cand:
                    s.note(flute, at, max(cand), 3, 0.33, pan=-0.3, rev=0.45)
    return s.render(rt=2.8, wet=0.36, lp=9000, wobble=(1.0, 0.4), crackle=0.35, hiss=0.25), True


def ending():
    s = Song(80, 108, tail=5, seed=23)
    bars = theme_bars()
    intro = ['F', 'Bb', 'Dm', 'C7']
    for i, ch in enumerate(intro):
        vc = voicing(ch, 65)
        for k in range(6):
            s.note(musicbox, i * 3 + k * 0.5, vc[[0, 1, 2, 1, 2, 0][k]] + 12, 0.5, 0.5, rev=0.4, pan=0.2)
        s.chord(pad, ch, i * 3, 3, 53, vel=0.2, rev=0.5, jitter=0, cutoff=1200)
    for rep in range(2):
        at0 = 12 + rep * 48
        for i, ch in enumerate(THEME_CH):
            at = at0 + i * 3
            for b, m, d in bars[i]:
                if rep == 0:
                    s.note(piano, at + b, m + 12, d, 0.58, pan=0.1, rev=0.35)
                else:
                    s.note(musicbox, at + b, m + 12, d, 0.55, pan=0.25, rev=0.35)
                    s.note(glock, at + b, m + 24, d, 0.22, pan=0.35, rev=0.35)
                    s.note(strings, at + b, m, d, 0.4, pan=-0.2, rev=0.35, attack=0.08)
            waltz(s, piano, ch, at, vel=0.26, bvel=0.42, pan=-0.12, rev=0.3)
            s.chord(strings, ch, at, 3, 50, vel=0.22 if rep == 0 else 0.3, rev=0.45, attack=0.6)
            if rep == 1:
                s.note(ks, at, bass_oct(ch, lo=36), 2, 0.7, bright=0.3, decay=0.994, rev=0.1)
                s.drums(at, {'k': 'x...........', 'b': '....o...o...', 'z': '..g...g...g.'},
                        gains={'k': 0.55, 'b': 1.5, 'z': 1.6})
            elif i % 2 == 1:
                s.note(musicbox, at + 2, voicing(ch, 77)[-1], 1, 0.25, rev=0.5, pan=0.4)
    return s.render(rt=2.4, wet=0.34, lp=11000, wobble=(1.2, 0.45), crackle=0.35, hiss=0.25), True


def gameover():
    s = Song(66, 24, tail=6, seed=24)
    bars = theme_bars(THEME_MIN)
    for pos, tb in enumerate([0, 1, 2, 3, 12, 13, 14, 15]):
        for b, m, d in bars[tb]:
            s.note(musicbox, pos * 3 + b, m + 12, d, 0.55, detune=rng.uniform(-12, 12), rev=0.55, pan=0.1)
        ch = THEME_MIN_CH[tb]
        s.chord(pad, ch, pos * 3, 3, 50, vel=0.22, rev=0.6, jitter=0, cutoff=800, attack=0.8)
    return s.render(rt=3.5, wet=0.5, lp=7000, wobble=(2.5, 0.3), crackle=0.6, hiss=0.4), True


# ---------------------------------------------------------------- jingles (non-looping)
def victory():
    s = Song(150, 10, tail=3, seed=25)
    s.melody(glock, "C6:0.5 E6 G6 C7 A6:0.75 B6:0.25 C7:2", 0, vel=0.6, rev=0.3, pan=0.2)
    s.melody(toypiano, "C5:0.5 E5 G5 C6 A5:0.75 B5:0.25 C6:2", 0, vel=0.7, rev=0.25, pan=-0.1)
    for ch, b, d in [('C', 0, 2), ('F', 2, 0.75), ('G', 2.75, 0.25), ('C', 3, 2)]:
        s.chord(uke, ch, b, d, 55, strum=0.015, vel=0.5, pan=-0.3, rev=0.2)
        s.note(ks, b, bass_oct(ch, lo=36), d, 0.8, bright=0.35)
    s.chord(pad, 'C', 3, 3, 55, vel=0.3, rev=0.4, jitter=0)
    s.drums(0, {'k': 'x...........x...', 'b': '....x...x.......', 'c': '............x...'})
    return s.render(rt=1.8, wet=0.3, lp=11000, loop=False), False


def soothed():
    s = Song(90, 8, tail=3, seed=26)
    s.melody(musicbox, "F5:0.5 A5:0.5 C6:1 Bb5:0.5 A5:0.5 G5:0.5 A5:2.5", 0, vel=0.7, rev=0.45, pan=0.1)
    s.melody(glock, "r:3 A6:2.5", 0, vel=0.3, rev=0.5, pan=0.3)
    s.chord(pad, 'Fadd9', 0, 5, 53, vel=0.3, rev=0.5, jitter=0, attack=0.8)
    s.note(piano, 0, midi('F3'), 5, 0.4, rev=0.4)
    return s.render(rt=2.5, wet=0.4, lp=10000, loop=False), False


def chapter():
    s = Song(90, 8, tail=3.5, seed=27)
    s.melody(glock, "F5:0.25 G5 A5 C6 F6:3", 0.5, vel=0.55, rev=0.5, pan=0.2)
    s.chord(pad, 'Fmaj9', 0, 4.5, 53, vel=0.35, rev=0.5, jitter=0, attack=1.0)
    s.note(piano, 0.5, midi('F2'), 5, 0.5, rev=0.5)
    L = int(1.2 * SR)
    tt = np.arange(L) / SR
    sw = fft_filter(rng.standard_normal(L), 800, 6000) * (tt / tt[-1]) ** 2 * 0.12
    s.add(sw, max(0.0, s.sec(0.5) - 1.2 + 0.02), rev=0.4)
    return s.render(rt=2.5, wet=0.42, lp=11000, loop=False), False


TRACKS = {k: v for k, v in dict(title=title, house=house, house_night=house_night, meadow=meadow, village=village,
                                 forest=forest, battle=battle, boss=boss, unfinished=unfinished, hush=hush,
                                 speak=speak, owl=owl, ending=ending, gameover=gameover, victory=victory,
                                 soothed=soothed, chapter=chapter).items()}
