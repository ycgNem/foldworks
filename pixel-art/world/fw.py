"""Foldworks world art: shared palette, drawing helpers and the export contract.

The palette is read from src/data/palette.ts (the `A` slot table), so the art can never drift
from the game. Every sprite is a pixelstudio Sprite; frames are drawn by parametric functions.
"""
import sys
import re
import json
import math
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
_local = ROOT / ".claude/skills/pixel-art-studio/scripts"
sys.path.insert(0, str(_local if _local.exists() else Path.home() / ".claude/skills/pixel-art-studio/scripts"))
from pixelstudio import Sprite, hex2rgba, rgba2hex  # noqa: E402,F401
from PIL import Image  # noqa: E402

ART = ROOT / "src/art"
OUT = HERE / "out"

# --------------------------------------------------------------------------- palette

def _read_palette():
    src = (ROOT / "src/data/palette.ts").read_text(encoding="utf-8")
    block = src[src.index("const A = {"):]
    block = block[:block.index("} as const")]
    pairs = re.findall(r"(\w+):\s*'(#[0-9a-fA-F]{6})'", block)
    return {k: v.lower() for k, v in pairs}


P = _read_palette()
assert len(P) == 32, len(P)
PIPS = ("pipGreen", "pipYellow", "pipRed", "pipGrey", "pipBlue")
ART_SLOTS = [k for k in P if k not in PIPS]          # the 27 colours sprite art may use
HEXES = [P[k] for k in P]

KEY = {
    "#": "ink", "s": "shadow", "W": "bone",
    "g": "ground0", "G": "ground1", "h": "ground2",
    "0": "hull0", "1": "hull1", "2": "hull2", "3": "hull3",
    "a": "iron0", "b": "iron1", "e": "iron2",
    "r": "copper0", "o": "copper1", "p": "copper2",
    "n": "slag", "V": "violet",
    "u": "brass0", "y": "brass1", "$": "gold",
    "x": "glow", "z": "hot",
    "t": "teal0", "T": "teal1",
    "v": "moss", "l": "leaf",
}


def c(ch_or_name):
    """A palette hex from a key char or a slot name."""
    if ch_or_name in P:
        return P[ch_or_name]
    return P[KEY[ch_or_name]]


# --------------------------------------------------------------------------- sprites

def new(w, h, frames=1, ms=125):
    s = Sprite(w, h, palette=HEXES)
    for _ in range(frames - 1):
        s.add_frame(copy=False)
    s.set_duration(ms, "all")
    s.frame(1)
    return s


def mk(w, h, n, draw, ms=125):
    """A sprite of n frames; draw(s, f) paints frame f (0-based) into the selected frame."""
    s = new(w, h, n, ms)
    for f in range(n):
        s.frame(f + 1)
        draw(s, f)
    s.frame(1)
    return s


def blit(s, x0, y0, rows, key=None, only=None):
    """ASCII art: KEY chars paint, '.' and ' ' skip, '_' erases."""
    k = dict(KEY)
    if key:
        k.update(key)
    for y, row in enumerate(rows):
        for x, ch in enumerate(row):
            if ch in ". ":
                continue
            if ch == "_":
                s.px(x0 + x, y0 + y, None)
                continue
            s.px(x0 + x, y0 + y, P[k[ch]], only=only)


def box(s, x0, y0, x1, y1, fill, light, dark, hi=None, chamfer=1, outline="ink"):
    """Bevelled box lit from the top-left, ink outline, corners cut by `chamfer` px."""
    s.rect(x0, y0, x1, y1, c(outline))
    s.rect(x0 + 1, y0 + 1, x1 - 1, y1 - 1, c(fill))
    s.line(x0 + 1, y0 + 1, x1 - 1, y0 + 1, c(light))
    s.line(x0 + 1, y0 + 1, x0 + 1, y1 - 1, c(light))
    s.line(x0 + 1, y1 - 1, x1 - 1, y1 - 1, c(dark))
    s.line(x1 - 1, y0 + 1, x1 - 1, y1 - 1, c(dark))
    s.px(x1 - 1, y0 + 1, c(fill))
    s.px(x0 + 1, y1 - 1, c(fill))
    if hi:
        s.px(x0 + 1, y0 + 1, c(hi))
    for k in range(chamfer):
        for (cx, cy, dx, dy) in ((x0, y0, 1, 1), (x1, y0, -1, 1), (x0, y1, 1, -1), (x1, y1, -1, -1)):
            for i in range(k + 1):
                s.px(cx + dx * i, cy + dy * (k - i), None)
            if k + 1 < chamfer:
                continue
            for i in range(k + 2):
                px_, py_ = cx + dx * i, cy + dy * (k + 1 - i)
                if s.get(px_, py_) is not None:
                    s.px(px_, py_, c(outline))


def disk(cx, cy, r):
    """Pixel set of a disc centred on (cx, cy) (pixel centres at +0.5)."""
    pts = set()
    for y in range(int(cy - r - 2), int(cy + r + 2)):
        for x in range(int(cx - r - 2), int(cx + r + 2)):
            if (x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2 <= r * r:
                pts.add((x, y))
    return pts


def ring_of(pts):
    """The 4-neighbour ring just outside a pixel set."""
    out = set()
    for (x, y) in pts:
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            q = (x + dx, y + dy)
            if q not in pts:
                out.add(q)
    return out


def paint(s, pts, col):
    for x, y in pts:
        s.px(x, y, c(col))


def lump(s, cx, cy, rx, ry, ramp, glint=None, outline="ink", bounds=None):
    """A rock lit from the top-left: ramp = (dark, mid, light) slot names."""
    pts = {}
    for y in range(int(cy - ry - 2), int(cy + ry + 2)):
        for x in range(int(cx - rx - 2), int(cx + rx + 2)):
            u, v = (x + 0.5 - cx) / rx, (y + 0.5 - cy) / ry
            if u * u + v * v <= 1.0:
                pts[(x, y)] = -(u + v) * 0.7071
    if bounds:
        pts = {p: d for p, d in pts.items() if bounds[0] <= p[0] <= bounds[2] and bounds[1] <= p[1] <= bounds[3]}
    if outline:
        for p in ring_of(set(pts)):
            s.px(p[0], p[1], c(outline))
    d, m, l = ramp
    for (x, y), k in pts.items():
        s.px(x, y, c(l) if k > 0.42 else (c(d) if k < -0.38 else c(m)))
    if glint and rx >= 2.4 and pts:
        bx, by = max(pts.items(), key=lambda kv: kv[1])[0]
        s.px(bx, by, c(glint))
    return pts


# --------------------------------------------------------------------------- export

def frames_of(spr):
    return [spr.composite(i + 1) for i in range(spr.n_frames)]


def strip(spr):
    fr = frames_of(spr)
    w, h = fr[0].size
    out = Image.new("RGBA", (w * len(fr), h), (0, 0, 0, 0))
    for i, im in enumerate(fr):
        out.alpha_composite(im, (i * w, 0))
    return out


def up(im, k):
    return im.resize((im.width * k, im.height * k), Image.NEAREST) if k != 1 else im


ALLOWED = {hex2rgba(P[k])[:3] for k in ART_SLOTS}


def check(name, spr):
    """Every pixel opaque-or-clear and from the art slots (no pip colours). Returns colour count."""
    cols = set()
    for im in frames_of(spr):
        for r, g, b, a in im.getdata():
            if a:
                assert a == 255, "%s: semi-alpha pixel" % name
                assert (r, g, b) in ALLOWED, "%s: off-palette or pip colour %s" % (name, rgba2hex((r, g, b, 255)))
                cols.add((r, g, b))
    return len(cols)


REPORT = {}
EXPORTED = {}


def export(name, spr, fps, preview_bg="floor"):
    n = check(name, spr)
    ART.mkdir(parents=True, exist_ok=True)
    OUT.mkdir(exist_ok=True)
    strip(spr).save(ART / ("%s.png" % name))
    meta = {"frame": [spr.w, spr.h], "frames": spr.n_frames, "anchor": [0, 0], "fps": fps}
    (ART / ("%s.json" % name)).write_text(json.dumps(meta) + "\n", encoding="utf-8")
    REPORT[name] = {"size": [spr.w, spr.h], "frames": spr.n_frames, "fps": fps, "colours": n}
    EXPORTED[name] = (spr, preview_bg)
    return spr
