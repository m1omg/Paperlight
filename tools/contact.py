#!/usr/bin/env python3
"""Make labelled contact sheets of processed art for visual review.
Usage: python3 tools/contact.py <subdir> <out.png> [max_h]"""
import sys
from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent / "game" / "img"
sub, out = sys.argv[1], sys.argv[2]
mh = int(sys.argv[3]) if len(sys.argv) > 3 else 120
files = sorted((ROOT / sub).glob("*.webp"))
tiles = []
for f in files:
    im = Image.open(f).convert("RGBA")
    s = mh / im.height
    im = im.resize((max(1, int(im.width * s)), mh))
    tiles.append((f.stem, im))
cols = 6 if mh <= 160 else 3
cw = max(t[1].width for t in tiles) + 10 if tiles else 100
rows = (len(tiles) + cols - 1) // cols
sheet = Image.new("RGB", (cols * cw, rows * (mh + 22)), (70, 80, 110))
d = ImageDraw.Draw(sheet)
for i, (name, im) in enumerate(tiles):
    x, y = (i % cols) * cw, (i // cols) * (mh + 22)
    # checker so transparency problems show up
    sheet.paste(im, (x + 5, y + 2), im)
    d.text((x + 5, y + mh + 6), name, fill=(255, 255, 255))
sheet.save(out)
print(len(tiles), "tiles ->", out)
