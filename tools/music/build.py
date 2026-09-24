#!/usr/bin/env python3
"""Render PAPERLIGHT music + SFX to game/audio.  Usage: python3 build.py [track ...] [--no-sfx] [--sfx-only]"""
import json
import sys
import time
from pathlib import Path
import numpy as np

sys.path.insert(0, str(Path(__file__).parent))
import synth  # noqa: E402
from synth import SR, master, write_ogg, read_audio  # noqa: E402
import songs  # noqa: E402
import sfx  # noqa: E402

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'game' / 'audio'
BGM, SE = OUT / 'bgm', OUT / 'se'

# target loudness (dBFS RMS) — quieter moods are meant to sit lower
TARGET = dict(title=-21, house=-23, house_night=-26, meadow=-19, village=-19, forest=-22, battle=-18, boss=-18,
              unfinished=-23, hush=-21, speak=-19, owl=-21, ending=-20, gameover=-23, victory=-18, soothed=-20,
              chapter=-21)


def db(x):
    return 20 * np.log10(np.sqrt(np.mean(x ** 2)) + 1e-12)


def main():
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    BGM.mkdir(parents=True, exist_ok=True)
    SE.mkdir(parents=True, exist_ok=True)
    man_path = OUT / 'manifest.json'
    man = json.loads(man_path.read_text()) if man_path.exists() else {'bgm': {}, 'se': []}
    if '--sfx-only' not in sys.argv:
        for name, fn in songs.TRACKS.items():
            if args and name not in args:
                continue
            t0 = time.time()
            x, loop = fn()
            x = master(x, 0.86)
            if not loop:   # trim jingle tail below -60 dB, short fade
                a = np.max(np.abs(x), axis=0)
                idx = np.nonzero(a > 0.001)[0]
                end = min(x.shape[1], idx[-1] + int(0.05 * SR)) if len(idx) else x.shape[1]
                x = x[:, :end]
                f = min(int(0.3 * SR), end // 3)
                x[:, -f:] *= np.linspace(1, 0, f)
            write_ogg(BGM / f'{name}.ogg', x, q=4)
            r = db(x)
            vol = float(np.clip(10 ** ((TARGET[name] - r) / 20), 0.05, 1.0))
            man['bgm'][name] = {'loop': loop, 'vol': round(vol, 3)}
            print(f'{name:12s} {x.shape[1] / SR:6.1f}s rms {r:6.1f} dB vol {vol:.2f}  ({time.time() - t0:.1f}s)',
                  flush=True)
    if '--no-sfx' not in sys.argv:
        S = sfx.make()
        for name, y in S.items():
            y = y - np.mean(y)
            y = y / (np.max(np.abs(y)) + 1e-9)
            idx = np.nonzero(np.abs(y) > 0.004)[0]          # trim tail below ~ -48 dB
            y = y[:min(len(y), idx[-1] + int(0.01 * SR))]
            fade = min(len(y) // 4, int(0.06 * SR) if len(y) > 0.3 * SR else int(0.008 * SR))
            y[-fade:] *= np.linspace(1, 0, fade)
            y = y / (np.max(np.abs(y)) + 1e-9) * 0.7   # ~ -3 dBFS
            write_ogg(SE / f'{name}.ogg', y, q=5)
        man['se'] = sorted(S)
        print(f'{len(S)} sfx written')
    man_path.write_text(json.dumps(man, indent=1))


if __name__ == '__main__':
    main()
