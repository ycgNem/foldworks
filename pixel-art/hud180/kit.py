"""Shared hand for the paper-and-ink HUD art (docs/hud-180.md): palette B by name, a tiny pixel
canvas, the export to src/art/ (<name>.png strip + <name>.json, the art-director contract) and a
9-slice assembler that tiles edges and centres exactly as src/app/chrome.ts `nine()` does, so the
contact sheet shows what the game will draw.

Every sprite is drawn pixel by pixel in the build scripts beside this file; no PNG is edited.
"""
import json
import math
import sys
from pathlib import Path

from PIL import Image

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent / "revamp"))
from pal import B, ART  # noqa: E402  (the one palette; never a new colour)

OUT = HERE / "out"
OUT.mkdir(exist_ok=True)
SRC_ART = HERE.parents[1] / "src" / "art"
RAW = HERE / "raw"


def rgb(h):
    h = h.lstrip("#")
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


ART_RGB = {rgb(h) for h in ART}


def col(c):
    """A palette name, a hex string, an (r,g,b[,a]) tuple, or None (erase)."""
    if c is None:
        return (0, 0, 0, 0)
    if isinstance(c, str):
        return rgb(B[c] if c in B else c) + (255,)
    return tuple(c[:3]) + (255,)


class Px:
    """A w x h RGBA canvas with the few operations the HUD pieces need."""

    def __init__(self, w, h):
        self.w, self.h = w, h
        self.im = Image.new("RGBA", (w, h), (0, 0, 0, 0))
        self.a = self.im.load()

    def p(self, x, y, c):
        if 0 <= x < self.w and 0 <= y < self.h:
            self.a[x, y] = col(c)

    def g(self, x, y):
        if 0 <= x < self.w and 0 <= y < self.h:
            return self.a[x, y]
        return (0, 0, 0, 0)

    def on(self, x, y):
        return self.g(x, y)[3] > 0

    def is_(self, x, y, c):
        return self.g(x, y) == col(c)

    def rect(self, x0, y0, x1, y1, c):
        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 1):
                self.p(x, y, c)

    def hl(self, x0, x1, y, c):
        for x in range(x0, x1 + 1):
            self.p(x, y, c)

    def vl(self, x, y0, y1, c):
        for y in range(y0, y1 + 1):
            self.p(x, y, c)

    def line(self, x0, y0, x1, y1, c):
        n = max(abs(x1 - x0), abs(y1 - y0), 1)
        for i in range(n + 1):
            self.p(round(x0 + (x1 - x0) * i / n), round(y0 + (y1 - y0) * i / n), c)

    def rows(self, rows, key, ox=0, oy=0):
        for y, r in enumerate(rows):
            for x, ch in enumerate(r):
                if ch in key:
                    self.p(ox + x, oy + y, key[ch])

    def disc(self, cx, cy, r, c, only=None):
        for y in range(self.h):
            for x in range(self.w):
                if (x - cx) ** 2 + (y - cy) ** 2 <= r * r:
                    if only is None or self.on(x, y) == (only == "opaque"):
                        self.p(x, y, c)

    def replace(self, a, b):
        ca, cb = col(a), col(b)
        for y in range(self.h):
            for x in range(self.w):
                if self.a[x, y] == ca:
                    self.a[x, y] = cb

    def outline(self, c="ink", diag=False):
        """1 px outline outside the opaque shape."""
        nb = [(-1, 0), (1, 0), (0, -1), (0, 1)] + ([(-1, -1), (1, -1), (-1, 1), (1, 1)] if diag else [])
        pts = [(x, y) for y in range(self.h) for x in range(self.w)
               if not self.on(x, y) and any(self.on(x + dx, y + dy) for dx, dy in nb)]
        for x, y in pts:
            self.p(x, y, c)

    def paste(self, other, ox=0, oy=0):
        im = other.im if isinstance(other, Px) else other
        self.im.alpha_composite(im, (ox, oy)) if ox >= 0 and oy >= 0 and ox + im.width <= self.w \
            and oy + im.height <= self.h else self.im.paste(im, (ox, oy), im)
        self.a = self.im.load()

    def copy(self):
        o = Px(self.w, self.h)
        o.im = self.im.copy()
        o.a = o.im.load()
        return o

    def flip(self):
        o = Px(self.w, self.h)
        o.im = self.im.transpose(Image.FLIP_LEFT_RIGHT)
        o.a = o.im.load()
        return o

    def shift(self, dx, dy):
        o = Px(self.w, self.h)
        o.im.paste(self.im, (dx, dy))
        o.a = o.im.load()
        return o


def strip(frames):
    fw, fh = frames[0].w, frames[0].h
    out = Image.new("RGBA", (fw * len(frames), fh), (0, 0, 0, 0))
    for i, f in enumerate(frames):
        assert (f.w, f.h) == (fw, fh), "frames differ in size"
        out.alpha_composite(f.im, (i * fw, 0))
    return out


def check(img, name):
    bad = {p[:3] for p in img.getdata() if p[3] and p[:3] not in ART_RGB}
    semi = {p[3] for p in img.getdata() if 0 < p[3] < 255}
    assert not bad, f"{name}: off-palette colours {bad}"
    assert not semi, f"{name}: semi-transparent pixels"


EXPORTED = {}


def export(name, frames, fps=0, anchor=(0, 0), slice_=None, extra=None):
    """src/art/<name>.png (1x strip) + <name>.json, and a copy in out/."""
    if isinstance(frames, Px):
        frames = [frames]
    img = strip(frames)
    check(img, name)
    meta = {"frame": [frames[0].w, frames[0].h], "frames": len(frames), "anchor": list(anchor), "fps": fps}
    if slice_:
        meta["slice"] = list(slice_)
    if extra:
        meta.update(extra)
    for d in (OUT, SRC_ART):
        img.save(d / f"{name}.png")
        (d / f"{name}.json").write_text(json.dumps(meta) + "\n", newline="\n")
    EXPORTED[name] = (frames, meta)
    return frames


def nine(frame, w, h, sl):
    """The game's 9-slice: corners as they are, edges and centre tiled (never stretched)."""
    l, t, r, b = sl
    src = frame.im if isinstance(frame, Px) else frame
    sw, sh = src.size
    cw, ch = sw - l - r, sh - t - b
    iw, ih = w - l - r, h - t - b
    out = Image.new("RGBA", (w, h), (0, 0, 0, 0))

    def part(sx, sy, pw0, ph0, dx, dy, dw, dh):
        if dw <= 0 or dh <= 0 or pw0 <= 0 or ph0 <= 0:
            return
        for yy in range(0, dh, ph0):
            for xx in range(0, dw, pw0):
                pw, ph = min(pw0, dw - xx), min(ph0, dh - yy)
                piece = src.crop((sx, sy, sx + pw, sy + ph))
                out.alpha_composite(piece, (dx + xx, dy + yy))

    part(0, 0, l, t, 0, 0, l, t)
    part(l, 0, cw, t, l, 0, iw, t)
    part(sw - r, 0, r, t, w - r, 0, r, t)
    part(0, t, l, ch, 0, t, l, ih)
    part(l, t, cw, ch, l, t, iw, ih)
    part(sw - r, t, r, ch, w - r, t, r, ih)
    part(0, sh - b, l, b, 0, h - b, l, b)
    part(l, sh - b, cw, b, l, h - b, iw, b)
    part(sw - r, sh - b, r, b, w - r, h - b, r, b)
    return out


def scale(img, k):
    return img.resize((img.width * k, img.height * k), Image.NEAREST)


def rot(x, y, cx, cy, ang):
    c, s = math.cos(ang), math.sin(ang)
    return cx + (x - cx) * c - (y - cy) * s, cy + (x - cx) * s + (y - cy) * c
