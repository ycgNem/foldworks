"""Shared helpers for the Lantern Bayou revamp: palette access, drawing, cleanup of PixelLab
drafts, and the export to src/art/ (<name>.png + <name>.json, the contract in
.claude/agents/art-director.md, plus "facings": 4 for machines drawn in four directions:
rows east, south, west, north; animation frames left to right; "frames" counts all cells).
"""
import json
import random
from pathlib import Path

from PIL import Image

from pal import ART, B

HERE = Path(__file__).resolve().parent
RAW = HERE / "raw"
OUT = HERE / "out"
OUT.mkdir(exist_ok=True)
SRC_ART = HERE.parents[1] / "src" / "art"
T = 16
P = B


def rgb(h):
    h = h.lstrip("#")
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


ART_RGB = [rgb(h) for h in ART]


def lum(c):
    return 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2]


def dist(a, b):
    rm = (a[0] + b[0]) / 2
    dr, dg, db = a[0] - b[0], a[1] - b[1], a[2] - b[2]
    return (2 + rm / 256) * dr * dr + 4 * dg * dg + (2 + (255 - rm) / 256) * db * db


_near = {}


def nearest(c):
    if c not in _near:
        _near[c] = min(ART_RGB, key=lambda p: dist(c, p))
    return _near[c]


def snap(img, alpha=128):
    img = img.convert("RGBA")
    out = Image.new("RGBA", img.size, (0, 0, 0, 0))
    pi, po = img.load(), out.load()
    for y in range(img.height):
        for x in range(img.width):
            r, g, b, a = pi[x, y]
            if a >= alpha:
                po[x, y] = nearest((r, g, b)) + (255,)
    return out


def new(w, h):
    return Image.new("RGBA", (w, h), (0, 0, 0, 0))


def draw(img, pts, col):
    px = img.load()
    c = rgb(col) + (255,) if isinstance(col, str) else tuple(col)[:3] + (255,)
    for x, y in pts:
        if 0 <= x < img.width and 0 <= y < img.height:
            px[x, y] = c


def rect(img, x0, y0, x1, y1, col):
    draw(img, [(x, y) for y in range(y0, y1 + 1) for x in range(x0, x1 + 1)], col)


def get(img, x, y):
    if 0 <= x < img.width and 0 <= y < img.height:
        return img.getpixel((x, y))
    return (0, 0, 0, 0)


def from_rows(rows, key):
    h, w = len(rows), max(len(r) for r in rows)
    img = new(w, h)
    for y, row in enumerate(rows):
        for x, ch in enumerate(row):
            if ch in key and key[ch]:
                draw(img, [(x, y)], key[ch])
    return img


def outline(img, col=None, diag=False):
    """1 px outline outside the opaque shape."""
    col = col or P["ink"]
    w, h = img.size
    out = new(w, h)
    a = img.load()
    nb = [(-1, 0), (1, 0), (0, -1), (0, 1)] + ([(-1, -1), (1, -1), (-1, 1), (1, 1)] if diag else [])
    for y in range(h):
        for x in range(w):
            if a[x, y][3]:
                continue
            if any(0 <= x + dx < w and 0 <= y + dy < h and a[x + dx, y + dy][3] for dx, dy in nb):
                draw(out, [(x, y)], col)
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


def fit(img, w, h, valign="bottom", dy=0):
    """The sprite's opaque box centred on a w x h canvas, standing on the bottom row."""
    bb = img.getbbox()
    out = new(w, h)
    if not bb:
        return out
    s = img.crop(bb)
    x = (w - s.width) // 2
    y = (h - s.height if valign == "bottom" else (h - s.height) // 2) + dy
    out.alpha_composite(s, (x, y)) if 0 <= x and 0 <= y and x + s.width <= w and y + s.height <= h else \
        out.paste(s, (x, y), s)
    return out


def halve(img, ox=1, oy=1):
    """A 32 px draft to 16 px: nearest-neighbour from each 2x2 block's lower-right pixel (keeps
    the draft's own colours and edges; mixing would muddy them), alpha hardened."""
    img = img.convert("RGBA").crop((ox, oy, img.width, img.height))
    h = img.resize((img.width // 2, img.height // 2), Image.NEAREST)
    a = h.split()[3].point(lambda v: 255 if v >= 128 else 0)
    h.putalpha(a)
    return h


def clean_edges(img, dark_l=60):
    """Outer edge: every opaque pixel touching transparency that is darkish becomes ink, and a
    light one gets an ink pixel outside it, so the silhouette has one crisp 1 px outline."""
    img = img.copy()
    w, h = img.size
    a = img.load()
    edge, out = [], []
    for y in range(h):
        for x in range(w):
            if not a[x, y][3]:
                continue
            for dx, dy in ((-1, 0), (1, 0), (0, -1), (0, 1)):
                xx, yy = x + dx, y + dy
                if not (0 <= xx < w and 0 <= yy < h) or not a[xx, yy][3]:
                    if lum(a[x, y]) < dark_l:
                        edge.append((x, y))
                    elif 0 <= xx < w and 0 <= yy < h:
                        out.append((xx, yy))
    draw(img, edge, P["ink"])
    draw(img, out, P["ink"])
    return img


def despeckle(img, keep=None):
    """Lone pixels whose colour differs from all 4 neighbours (which agree) take that colour."""
    img = img.copy()
    px = img.load()
    w, h = img.size
    for y in range(1, h - 1):
        for x in range(1, w - 1):
            p = px[x, y]
            if not p[3] or (keep and p[:3] in keep):
                continue
            nb = [px[x - 1, y], px[x + 1, y], px[x, y - 1], px[x, y + 1]]
            if all(q[3] for q in nb) and all(q == nb[0] for q in nb) and nb[0] != p:
                px[x, y] = nb[0]
    return img


# ---------------------------------------------------------------- export
def sheet(rows):
    """rows: list of rows of equal-size frames -> one image."""
    fw, fh = rows[0][0].size
    n = max(len(r) for r in rows)
    out = new(fw * n, fh * len(rows))
    for j, r in enumerate(rows):
        for i, f in enumerate(r):
            out.alpha_composite(f.convert("RGBA"), (i * fw, j * fh))
    return out


def export(name, rows, fps=0, anchor=(0, 0), facings=None, extra=None, check=True, to_src=True):
    """Write OUT/<name>.png + .json (and src/art/ when to_src). rows is a list of frame lists (one
    row unless facings). Every pixel must be from the art palette (pips never)."""
    if isinstance(rows[0], Image.Image):
        rows = [rows]
    img = sheet(rows)
    if check:
        bad = {p[:3] for p in img.getdata() if p[3] and p[:3] not in set(ART_RGB)}
        if bad:
            img = snap(img)
    fw, fh = rows[0][0].size
    meta = {"frame": [fw, fh], "frames": sum(len(r) for r in rows), "anchor": list(anchor), "fps": fps}
    if facings:
        meta["facings"] = facings
    if extra:
        meta.update(extra)
    for d in ([OUT, SRC_ART] if to_src else [OUT]):
        img.save(d / f"{name}.png")
        (d / f"{name}.json").write_text(json.dumps(meta) + "\n", newline="\n")
    scale(on_bg(img, P["wood2"]), 4).save(OUT / f"{name}@4x.png")
    return img


def rng(seed):
    return random.Random(seed)
