"""Shared helpers for the sky island style test (docs/sky-island.md). Same contract as
pixel-art/revamp/common.py (<name>.png 1x strip + <name>.json sidecar), but this phase writes to
pixel-art/sky/out/ only: nothing goes to src/art/ until the lead picks.
"""
import json
import math
import random
from pathlib import Path

from PIL import Image

from pal import ART, P

HERE = Path(__file__).resolve().parent
OUT = HERE / "out"
OUT.mkdir(exist_ok=True)
SRC_ART = HERE.parents[1] / "src" / "art"
T = 16


def rgb(h):
    h = h.lstrip("#")
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


ART_RGB = [rgb(h) for h in ART]
ART_SET = set(ART_RGB)


def dist(a, b):
    rm = (a[0] + b[0]) / 2
    dr, dg, db = a[0] - b[0], a[1] - b[1], a[2] - b[2]
    return (2 + rm / 256) * dr * dr + 4 * dg * dg + (2 + (255 - rm) / 256) * db * db


_near = {}


def nearest(c, pool=None):
    pool = pool or ART_RGB
    key = (c, id(pool))
    if key not in _near:
        _near[key] = min(pool, key=lambda p: dist(c, p))
    return _near[key]


def snap(img, alpha=128, pool=None):
    img = img.convert("RGBA")
    out = Image.new("RGBA", img.size, (0, 0, 0, 0))
    pi, po = img.load(), out.load()
    for y in range(img.height):
        for x in range(img.width):
            r, g, b, a = pi[x, y]
            if a >= alpha:
                po[x, y] = nearest((r, g, b), pool) + (255,)
    return out


def new(w, h):
    return Image.new("RGBA", (w, h), (0, 0, 0, 0))


def col(c):
    return rgb(c) + (255,) if isinstance(c, str) else tuple(c)[:3] + (255,)


def draw(img, pts, c):
    px = img.load()
    cc = col(c)
    for x, y in pts:
        if 0 <= x < img.width and 0 <= y < img.height:
            px[x, y] = cc


def put(img, x, y, c):
    if 0 <= x < img.width and 0 <= y < img.height:
        img.load()[x, y] = col(c)


def rect(img, x0, y0, x1, y1, c):
    draw(img, [(x, y) for y in range(y0, y1 + 1) for x in range(x0, x1 + 1)], c)


def get(img, x, y):
    if 0 <= x < img.width and 0 <= y < img.height:
        return img.getpixel((x, y))
    return (0, 0, 0, 0)


def opaque(img, x, y):
    return get(img, x, y)[3] > 0


def outline(img, c=None, diag=False):
    """1 px outline outside the opaque shape."""
    c = c or P["ink"]
    w, h = img.size
    out = new(w, h)
    a = img.load()
    nb = [(-1, 0), (1, 0), (0, -1), (0, 1)] + ([(-1, -1), (1, -1), (-1, 1), (1, 1)] if diag else [])
    pts = []
    for y in range(h):
        for x in range(w):
            if a[x, y][3]:
                continue
            if any(0 <= x + dx < w and 0 <= y + dy < h and a[x + dx, y + dy][3] for dx, dy in nb):
                pts.append((x, y))
    draw(out, pts, c)
    out.alpha_composite(img)
    return out


def recolor(img, mapping):
    m = {rgb(k): rgb(v) for k, v in mapping.items()}
    out = img.copy()
    px = out.load()
    for y in range(out.height):
        for x in range(out.width):
            p = px[x, y]
            if p[3] and p[:3] in m:
                px[x, y] = m[p[:3]] + (255,)
    return out


def flip(img):
    return img.transpose(Image.FLIP_LEFT_RIGHT)


def scale(img, k):
    return img.resize((img.width * k, img.height * k), Image.NEAREST)


def on_bg(img, bg):
    out = Image.new("RGBA", img.size, rgb(bg) + (255,))
    out.alpha_composite(img)
    return out


def sheet(frames, n=None):
    fw, fh = frames[0].size
    n = n or len(frames)
    rows = (len(frames) + n - 1) // n
    out = new(fw * n, fh * rows)
    for i, f in enumerate(frames):
        out.alpha_composite(f.convert("RGBA"), ((i % n) * fw, (i // n) * fh))
    return out


def export(name, frames, fps=0, anchor=(0, 0), extra=None, bg=None, look_scale=4, src=False):
    """OUT/<name>.png (1x, frames in one row) + .json, and OUT/<name>@<k>x.png on a backdrop for
    looking; with src, src/art/<name>.png + .json too (what the game loads). Refuses any pixel
    outside the art palette (pips never)."""
    img = sheet(frames)
    bad = {p[:3] for p in img.getdata() if p[3] and p[:3] not in ART_SET}
    if bad:
        raise ValueError(f"{name}: {len(bad)} colours off the palette, e.g. {list(bad)[:4]}")
    semi = [p for p in img.getdata() if 0 < p[3] < 255]
    if semi:
        raise ValueError(f"{name}: semi-transparent pixels")
    fw, fh = frames[0].size
    meta = {"frame": [fw, fh], "frames": len(frames), "anchor": list(anchor), "fps": fps}
    if extra:
        meta.update(extra)
    for d in ([OUT, SRC_ART] if src else [OUT]):
        img.save(d / f"{name}.png")
        (d / f"{name}.json").write_text(json.dumps(meta) + "\n", newline="\n")
    look = sheet_spaced(frames, bg or P["sky2"])
    scale(look, look_scale).save(OUT / f"{name}@{look_scale}x.png")
    return img


def sheet_spaced(frames, bg, gap=2):
    fw, fh = frames[0].size
    out = Image.new("RGBA", (len(frames) * (fw + gap) + gap, fh + 2 * gap), rgb(bg) + (255,))
    for i, f in enumerate(frames):
        out.alpha_composite(f, (gap + i * (fw + gap), gap))
    return out


def rng(seed):
    return random.Random(seed)


def hsh(*v):
    x = 0x9E3779B1
    for n in v:
        x = ((x ^ (n & 0xFFFFFFFF)) * 0x85EBCA6B) & 0xFFFFFFFF
        x ^= x >> 13
        x = (x * 0xC2B2AE35) & 0xFFFFFFFF
        x ^= x >> 16
    return x


def vnoise(seed, sc):
    """Smooth value noise in 0..1 with lattice spacing sc px."""
    def lat(i, j):
        return (hsh(seed, i, j) & 0xFFFF) / 65535

    def f(x, y):
        gx, gy = x / sc, y / sc
        i, j = math.floor(gx), math.floor(gy)
        fx, fy = gx - i, gy - j
        fx, fy = fx * fx * (3 - 2 * fx), fy * fy * (3 - 2 * fy)
        a, b = lat(i, j), lat(i + 1, j)
        c, d = lat(i, j + 1), lat(i + 1, j + 1)
        return (a * (1 - fx) + b * fx) * (1 - fy) + (c * (1 - fx) + d * fx) * fy
    return f


def wnoise(seed, sc, period):
    """Value noise that wraps every `period` px in x (so tile strips repeat)."""
    def lat(i, j):
        return (hsh(seed, i % max(1, period // sc), j) & 0xFFFF) / 65535

    def f(x, y):
        gx, gy = x / sc, y / sc
        i, j = math.floor(gx), math.floor(gy)
        fx, fy = gx - i, gy - j
        fx, fy = fx * fx * (3 - 2 * fx), fy * fy * (3 - 2 * fy)
        a, b = lat(i, j), lat(i + 1, j)
        c, d = lat(i, j + 1), lat(i + 1, j + 1)
        return (a * (1 - fx) + b * fx) * (1 - fy) + (c * (1 - fx) + d * fx) * fy
    return f


BAYER4 = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]]


def bayer(x, y):
    return (BAYER4[y % 4][x % 4] + 0.5) / 16


def load_art(name):
    img = Image.open(SRC_ART / f"{name}.png").convert("RGBA")
    meta = json.loads((SRC_ART / f"{name}.json").read_text())
    return img, meta


def frame_of(name, i=0, row=0):
    img, meta = load_art(name)
    fw, fh = meta["frame"]
    n = img.width // fw
    return img.crop(((i % n) * fw, row * fh, (i % n) * fw + fw, row * fh + fh))


def colours(img):
    return len({p[:3] for p in img.getdata() if p[3]})
