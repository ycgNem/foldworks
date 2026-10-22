"""Shared helpers for Act III's art (docs/endgame.md, Milestone 7, "Art").

The drawing helpers and the palette come from pixel-art/sky/ (its common.py: put/rect/outline/
export; its pal.py: palette B extended, 69 art colours, pips never), loaded by path so the two
`common`/`pal` modules never collide. `ship()` writes the strip and sidecar to out/ and src/art/,
and refuses to overwrite any src/art file that is not one of Act III's own (NAMES below).

`skid()`/`seat()` repeat pixel-art/revamp/machines.py's (STYLE.md: every machine stands on its
skid; Mk1 rows 12-15, Mk2 rows 25-31, an ink1 shadow of the body cast down-right onto it).
"""
import json
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
SKY = HERE.parent / "sky"
if str(SKY) not in sys.path:
    sys.path.insert(0, str(SKY))

from PIL import Image  # noqa: E402

import common as sc  # noqa: E402  (pixel-art/sky/common.py)
from pal import P  # noqa: E402  (pixel-art/sky/pal.py: B + the sky's colours)

new, put, rect, get, outline, scale, on_bg, sheet = sc.new, sc.put, sc.rect, sc.get, sc.outline, sc.scale, sc.on_bg, sc.sheet
recolor, flip, hsh, col, ART_SET = sc.recolor, sc.flip, sc.hsh, sc.col, sc.ART_SET
OUT = HERE / "out"
OUT.mkdir(exist_ok=True)
SRC_ART = HERE.parents[1] / "src" / "art"

INK, INK1, INK2 = P["ink"], P["ink1"], P["ink2"]
S0, S1, S2, S3, S4 = (P[f"steel{i}"] for i in range(5))
B0, B1, B2, B3 = (P[f"brass{i}"] for i in range(4))
L0, L1, L2, L3 = (P[f"lamp{i}"] for i in range(4))

# every sprite Act III ships (the only src/art names this folder may write)
NAMES = {"chem_vat", "greenhouse", "chute_mouth", "factory_chute", "items3", "dist_deck", "dist_edge", "dist_under",
         "dist_rotor", "dist_rotor_side", "dist_module", "world_module", "skiff", "barge", "dist_dock", "dist_hopper",
         "dist_bay", "mega_city", "mega_transmuter"}


def hline(img, x0, x1, y, c):
    for x in range(min(x0, x1), max(x0, x1) + 1):
        put(img, x, y, c)


def vline(img, x, y0, y1, c):
    for y in range(min(y0, y1), max(y0, y1) + 1):
        put(img, x, y, c)


def box(img, x0, y0, x1, y1, fill, edge=None):
    rect(img, x0, y0, x1, y1, edge or INK)
    if x1 - x0 > 1 and y1 - y0 > 1:
        rect(img, x0 + 1, y0 + 1, x1 - 1, y1 - 1, fill)


def clear(img, x, y):
    if 0 <= x < img.width and 0 <= y < img.height:
        img.putpixel((x, y), (0, 0, 0, 0))


def grid(rows, key, w=None, h=None):
    """A sprite from rows of characters; key maps a character to a colour ('.' and ' ' are empty)."""
    h = h or len(rows)
    w = w or max(len(r) for r in rows)
    img = new(w, h)
    for y, row in enumerate(rows):
        for x, ch in enumerate(row):
            if ch in key and key[ch]:
                put(img, x, y, key[ch])
    return img


def stamp(dst, src, x, y):
    dst.alpha_composite(src, (x, y))
    return dst


def colours(img):
    return len({p[:3] for p in img.getdata() if p[3]})


# ---------------------------------------------------------------- the machines' skid
def skid(size=16):
    out = new(size, size)
    top = 12 if size == 16 else 25
    x1 = size - 2
    for y in range(top, size):
        for x in range(0, x1 + 1):
            if x in (0, x1) and y in (top, size - 1):
                continue
            rim = y in (top, size - 1) or x in (0, x1)
            put(out, x, y, INK if rim else S1 if y == top + 1 else S0)
    bolts = [(2, top + 2), (x1 - 2, top + 2)] if size == 16 else \
        [(3, top + 2), (x1 - 3, top + 2), (3, size - 3), (x1 - 3, size - 3)]
    for x, y in bolts:
        put(out, x, y, S2)
    for y in range(top + 1, size):
        put(out, x1 + 1, y, P["wood0"])
    return out


def seat(im):
    out = skid(im.width)
    a = im.load()
    sh = new(*im.size)
    for y in range(im.height):
        for x in range(im.width):
            if a[x, y][3] and x + 1 < im.width and y + 1 < im.height:
                put(sh, x + 1, y + 1, INK1)
    out.alpha_composite(sh)
    out.alpha_composite(im)
    return out


# ---------------------------------------------------------------- export
def ship(name, frames, fps=0, anchor=(0, 0), extra=None, bg=None, look=6, rows=None, src=True):
    """frames: one row of equal frames, or rows (facings) when `rows` is given (a list of lists).
    Writes out/<name>.png + .json, out/<name>@<look>x.png, and the same pair to src/art/."""
    if rows:
        fw, fh = rows[0][0].size
        n = max(len(r) for r in rows)
        img = new(fw * n, fh * len(rows))
        for j, r in enumerate(rows):
            for i, f in enumerate(r):
                img.alpha_composite(f, (i * fw, j * fh))
        count = sum(len(r) for r in rows)
    else:
        img = sheet(frames)
        fw, fh = frames[0].size
        count = len(frames)
    bad = {p[:3] for p in img.getdata() if p[3] and p[:3] not in ART_SET}
    if bad:
        raise ValueError(f"{name}: {len(bad)} colours off the palette, e.g. {list(bad)[:4]}")
    if any(0 < p[3] < 255 for p in img.getdata()):
        raise ValueError(f"{name}: semi-transparent pixels")
    meta = {"frame": [fw, fh], "frames": count, "anchor": list(anchor), "fps": fps}
    if extra:
        meta.update(extra)
    dirs = [OUT]
    if src:
        if name not in NAMES:
            raise ValueError(f"{name} is not one of Act III's names; src/art/ is not written")
        dirs.append(SRC_ART)
    for d in dirs:
        img.save(d / f"{name}.png")
        (d / f"{name}.json").write_text(json.dumps(meta) + "\n", newline="\n")
    lk = on_bg(img, bg or P["pave2"])
    scale(lk, look).save(OUT / f"{name}@{look}x.png")
    print(f"  {name}: {img.width}x{img.height}, {count} frames of {fw}x{fh}, {colours(img)} colours")
    return img
