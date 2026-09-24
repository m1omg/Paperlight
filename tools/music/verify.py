"""Verify audio output: existence, durations, peaks, loop seams, sizes."""
import json, sys
from pathlib import Path
import numpy as np
from synth import read_audio, SR
ROOT = Path(__file__).resolve().parents[2] / 'game' / 'audio'
man = json.loads((ROOT / 'manifest.json').read_text())
tot = 0
print(f"{'bgm':12s} {'dur':>6s} {'peak':>6s} {'rms':>6s} {'seamJump':>8s} {'medStep':>8s}  loop vol")
for name, m in man['bgm'].items():
    p = ROOT / 'bgm' / f'{name}.ogg'
    x = read_audio(p)
    tot += p.stat().st_size
    peak = np.max(np.abs(x))
    rms = 20 * np.log10(np.sqrt(np.mean(x ** 2)))
    seam = np.max(np.abs(x[:, 0] - x[:, -1]))
    step = np.median(np.max(np.abs(np.diff(x, axis=1)), axis=0))
    p99 = np.percentile(np.max(np.abs(np.diff(x, axis=1)), axis=0), 99.9)
    flag = '  <-- CHECK' if (m['loop'] and seam > p99) or peak > 0.99 else ''
    print(f"{name:12s} {x.shape[1]/SR:6.1f} {peak:6.3f} {rms:6.1f} {seam:8.4f} {p99:8.4f}  {m['loop']} {m['vol']}{flag}")
print('se:')
for name in man['se']:
    p = ROOT / 'se' / f'{name}.ogg'
    x = read_audio(p)
    tot += p.stat().st_size
    peak = np.max(np.abs(x))
    print(f"  {name:12s} {x.shape[1]/SR*1000:6.0f} ms  peak {20*np.log10(peak):5.1f} dBFS" + ('  <-- CLIP' if peak > 0.99 else ''))
print(f"total size {tot/1e6:.1f} MB")
