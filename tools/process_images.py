#!/usr/bin/env python3
"""Cut out / slice / downscale raw GPT images into game-ready webp files.
Usage: python3 tools/process_images.py [name ...]   (default: everything present in raw/)
"""
import sys, json
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "art_source" / "raw"
IMG = ROOT / "game" / "img"
sys.path.insert(0, str(ROOT / "tools"))
from assets import A

def cutout(im, bg="white", tol=34):
    """Remove background connected to the image border. Returns RGBA."""
    if im.mode == "RGBA" and (np.asarray(im)[..., 3] < 10).mean() > 0.05:
        return im  # already transparent
    im = im.convert("RGB")
    a = np.asarray(im).astype(np.int16)
    if bg == "green":
        r, g, b = a[..., 0], a[..., 1], a[..., 2]
        near = (g > 150) & (g - np.maximum(r, b) > 60)
    else:
        near = (a.min(axis=2) > 255 - tol) & ((a.max(axis=2) - a.min(axis=2)) < 28)
    h, w = near.shape
    m = np.zeros((h + 2, w + 2), np.uint8)
    m[1:-1, 1:-1] = near * 255
    m[0, :] = m[-1, :] = m[:, 0] = m[:, -1] = 255
    mi = Image.fromarray(m, "L").copy()
    ImageDraw.floodfill(mi, (0, 0), 128, thresh=0)
    bgmask = (np.asarray(mi)[1:-1, 1:-1] == 128)
    alpha = np.where(bgmask, 0, 255).astype(np.float32)
    # soften: pixels next to background get alpha from how "non-background" they are
    fg = Image.fromarray((~bgmask).astype(np.uint8) * 255, "L")
    inner = np.asarray(fg.filter(ImageFilter.MinFilter(5))) > 0
    edge = (~bgmask) & (~inner)
    if bg == "green":
        r, g, b = a[..., 0], a[..., 1], a[..., 2]
        spill = np.clip((g - np.maximum(r, b)) / 120.0, 0, 1)
        alpha[edge] = (255 * (1 - spill))[edge]
        # despill: clamp green to max(r,b) near edges
        a2 = a.copy()
        gg = np.minimum(a[..., 1], np.maximum(a[..., 0], a[..., 2]) + 10)
        a2[..., 1] = np.where(edge | (spill > 0.2), gg, a[..., 1])
        a = a2
    else:
        dark = (255 - a.min(axis=2)).astype(np.float32)
        alpha[edge] = np.clip(dark * 4.0, 0, 255)[edge]
    rgba = np.dstack([np.clip(a, 0, 255).astype(np.uint8), alpha.astype(np.uint8)])
    return Image.fromarray(rgba, "RGBA")

def runs(profile, min_gap, min_len):
    """Return [start,end) runs where profile>0, merging gaps smaller than min_gap."""
    on = profile > 0
    out, s = [], None
    for i, v in enumerate(on):
        if v and s is None: s = i
        if not v and s is not None:
            out.append([s, i]); s = None
    if s is not None: out.append([s, len(on)])
    merged = []
    for r in out:
        if merged and r[0] - merged[-1][1] < min_gap: merged[-1][1] = r[1]
        else: merged.append(r)
    return [r for r in merged if r[1] - r[0] >= min_len]

def bbox_crop(im, pad=6):
    al = np.asarray(im)[..., 3]
    ys, xs = np.nonzero(al > 20)
    if len(xs) == 0: return im
    x0, x1, y0, y1 = xs.min(), xs.max() + 1, ys.min(), ys.max() + 1
    return im.crop((max(0, x0 - pad), max(0, y0 - pad), min(im.width, x1 + pad), min(im.height, y1 + pad)))

def split_row(im, n=None, min_gap=12):
    al = np.asarray(im)[..., 3]
    prof = (al > 20).sum(axis=0)
    prof = np.where(prof > 2, prof, 0)
    rs = runs(prof, min_gap, 20)
    if n and len(rs) > n:  # merge smallest gaps until n
        while len(rs) > n:
            gaps = [rs[i + 1][0] - rs[i][1] for i in range(len(rs) - 1)]
            i = int(np.argmin(gaps)); rs[i][1] = rs[i + 1][1]; del rs[i + 1]
    return [bbox_crop(im.crop((a, 0, b, im.height))) for a, b in rs]

def split_grid(im, rows, cols):
    al = np.asarray(im)[..., 3]
    prof = (al > 20).sum(axis=1); prof = np.where(prof > 2, prof, 0)
    rband = runs(prof, 12, 20)
    while len(rband) > rows:
        gaps = [rband[i + 1][0] - rband[i][1] for i in range(len(rband) - 1)]
        i = int(np.argmin(gaps)); rband[i][1] = rband[i + 1][1]; del rband[i + 1]
    pieces = []
    for a, b in rband:
        pieces += split_row(im.crop((0, a, im.width, b)), cols)
    return pieces

def fit(im, maxw, maxh):
    s = min(maxw / im.width, maxh / im.height, 1.0)
    return im.resize((max(1, round(im.width * s)), max(1, round(im.height * s))), Image.LANCZOS)

def save(im, rel, q=90):
    p = IMG / rel
    p.parent.mkdir(parents=True, exist_ok=True)
    im.save(p.with_suffix(".webp"), "WEBP", quality=q, method=6)
    return p.with_suffix(".webp")

def seamless(im):
    """Crossfade-wrap a texture so it tiles."""
    a = np.asarray(im.convert("RGB")).astype(np.float32)
    h, w, _ = a.shape
    sh = np.roll(np.roll(a, h // 2, 0), w // 2, 1)
    y = np.abs(np.linspace(-1, 1, h))[:, None]; x = np.abs(np.linspace(-1, 1, w))[None, :]
    # weight for the shifted copy: high near the original's edges
    wgt = np.clip((np.maximum(x, y) - 0.55) / 0.4, 0, 1)[..., None]
    out = a * (1 - wgt) + sh * wgt
    return Image.fromarray(out.astype(np.uint8))

report = {}

def process(name):
    size, bg, _ = A[name]
    src = RAW / f"{name}.png"
    if not src.exists(): return
    im = Image.open(src)
    if name.startswith("char_") and name != "char_owl":
        cut = cutout(im, bg)
        parts = split_row(cut, 4)
        report[name] = len(parts)
        names = ["down", "left", "right", "up"]
        for i, p in enumerate(parts[:4]):
            save(fit(p, 160, 144), f"chars/{name[5:]}_{names[i]}")
    elif name == "char_owl":
        save(fit(bbox_crop(cutout(im)), 160, 144), "chars/owl_down")
    elif name == "npcs":
        parts = split_grid(cutout(im), 2, 3); report[name] = len(parts)
        for i, p in enumerate(parts):
            save(fit(p, 160, 144), f"chars/npc{i}")
    elif name.startswith("face_"):
        if name == "face_owl":
            save(fit(bbox_crop(cutout(im)), 256, 256), "faces/owl_0"); return
        w, h = im.size
        for i, (x, y) in enumerate([(0, 0), (1, 0), (0, 1), (1, 1)]):
            q = im.crop((x * w // 2, y * h // 2, (x + 1) * w // 2, (y + 1) * h // 2))
            c = bbox_crop(cutout(q))
            if c.height > c.width * 1.1:  # full-body portrait: keep the head & shoulders
                c = c.crop((0, 0, c.width, int(c.width * 0.95)))
            save(fit(c, 256, 256), f"faces/{name[5:]}_{i}")
    elif name.startswith("en_") or name.startswith("boss_"):
        cut = bbox_crop(cutout(im, bg))
        save(fit(cut, 560, 640), f"enemies/{name}")
    elif name.startswith("bb_") or name.startswith("cg_") or name == "title":
        save(fit(im.convert("RGB"), 1280, 1280), f"bg/{name}", q=86)
    elif name.startswith("tex_"):
        save(fit(seamless(im), 512, 512), f"tex/{name[4:]}", q=86)
    elif name.startswith("props_") or name.startswith("deco_") or name == "icons":
        parts = split_grid(cutout(im), 3, 3); report[name] = len(parts)
        for i, p in enumerate(parts):
            save(fit(p, 320, 320), f"props/{name}_{i}")

if __name__ == "__main__":
    todo = sys.argv[1:] or [n for n in A if (RAW / f"{n}.png").exists()]
    for n in todo:
        process(n); print("ok", n, report.get(n, ""), flush=True)
    bad = {k: v for k, v in report.items() if (k.startswith("char_") and v != 4) or (k == "npcs" and v != 6)
           or ((k.startswith("props_") or k.startswith("deco_") or k == "icons") and v != 9)}
    print("SLICE PROBLEMS:", bad)
