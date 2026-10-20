"""Shared hand for Bramble's Town (pixel-art/town/): the swamp town that grows in the water
around the Workshop as the player fills orders.

Reuses, read-only, the UI art's helpers (pixel-art/ui/common.py: the palette read from
src/data/palette.ts, new(), ell(), ascii_ with its one-letter KEY, strip(), check_palette(),
checker(), up(), text()). Its own export writes src/art/<name>.png + .json with the same
contract as every other sheet (1x strip, transparent, art colours only, no pip colours, no
semi-transparent pixels) and an `order` list of variant names for variant sheets.

Town conventions (STYLE.md, "Bramble's Town"):
- Everything stands in the swamp: the last two rows of every standing sprite are its waterline
  (ripples round each piling), so any two town sprites put on the same row of tiles share one
  waterline. Pilings are wood (ground1 lit, ground0 shade) with an ink outline.
- Light from the top-left; ink outline outside every standing object (on the ink water it melts
  away, so every edge that must read is lit from inside: ground2/hull2/leaf rims).
- Warm windows: glow with a hot corner. They are the town's colour at night and the reason it
  reads as "lived in" at 1x.
"""
import sys
import json
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
sys.path.insert(0, str(ROOT / "pixel-art" / "ui"))

from common import (P, KEY, new, ell, ascii_, strip, check_palette, checker, up, text,  # noqa: E402,F401
                    hex2rgba)
from PIL import Image  # noqa: E402

ART = ROOT / "src" / "art"
OUT = HERE / "out"
OUT.mkdir(parents=True, exist_ok=True)

INK, SH, BONE = P["ink"], P["shadow"], P["bone"]
G0, G1, G2 = P["ground0"], P["ground1"], P["ground2"]
H0, H1, H2, H3 = P["hull0"], P["hull1"], P["hull2"], P["hull3"]
I0, I1, I2 = P["iron0"], P["iron1"], P["iron2"]
C0, C1, C2 = P["copper0"], P["copper1"], P["copper2"]
SLAG, VIO = P["slag"], P["violet"]
B0, B1, GOLD = P["brass0"], P["brass1"], P["gold"]
GLOW, HOT = P["glow"], P["hot"]
T0, T1 = P["teal0"], P["teal1"]
MOSS, LEAF = P["moss"], P["leaf"]

REPORT = {}


def export(s, name, fps=0, order=None, scale=8, extra=None):
    im = strip(s)
    ncol = check_palette(im, name)
    im.save(ART / f"{name}.png")
    meta = {"frame": [s.w, s.h], "frames": s.n_frames, "anchor": [0, 0], "fps": fps}
    if order:
        assert len(order) == s.n_frames, (name, len(order), s.n_frames)
        meta["order"] = list(order)
    if extra:
        meta.update(extra)
    (ART / f"{name}.json").write_text(json.dumps(meta) + "\n", encoding="utf-8")
    bg = checker(im.width, im.height, sq=4)
    bg.alpha_composite(im)
    bg.save(OUT / f"{name}_1x.png")
    big = checker(im.width * scale + (s.n_frames - 1) * scale, im.height * scale, sq=scale * 2)
    for i in range(s.n_frames):
        big.alpha_composite(up(s.composite(i + 1), scale), (i * (s.w * scale + scale), 0))
    big.save(OUT / f"{name}_{scale}x.png")
    REPORT[name] = {"frame": [s.w, s.h], "frames": s.n_frames, "colours": ncol, "fps": fps,
                    **({"order": list(order)} if order else {})}
    (OUT / "report.json").write_text(json.dumps(REPORT, indent=1), encoding="utf-8")
    print(f"{name}: {s.w}x{s.h} x{s.n_frames}  fps {fps}  colours {ncol}")
    return im


def load(name):
    im = Image.open(ART / f"{name}.png").convert("RGBA")
    meta = json.loads((ART / f"{name}.json").read_text(encoding="utf-8"))
    w, h = meta["frame"]
    return [im.crop((i * w, 0, (i + 1) * w, h)) for i in range(meta["frames"])], meta


# ------------------------------------------------------------------ shared parts

def piling(s, x, y0, y1):
    """A 2 px wooden piling from y0 to y1 (inclusive): lit left column, shaded right."""
    s.rect(x, y0, x, y1, G1)
    s.rect(x + 1, y0, x + 1, y1, G0)


def ripple(s, x, y, wide=False):
    """The waterline round a 2 px piling whose outline's bottom row is y-1 (x = its left column).
    Row y: a ring of iron0 either side, a teal glint on the lit side; row y+1: a broken echo."""
    for xx in (x - 2, x - 1, x + 2, x + 3):
        s.px(xx, y, I0)
    s.px(x - 2, y, T0)
    s.px(x, y, SH)
    s.px(x + 1, y, SH)
    if wide:
        s.px(x + 4, y, I0)
        s.px(x - 3, y + 1, I0)
    s.px(x - 1, y + 1, I0)
    s.px(x + 3, y + 1, I0)


def window(s, x, y, w=3, h=3, cross=False, sill=None):
    """A warm window, (x, y) the top-left of the glass. Ink frame around; glow glass with a hot
    corner (lamplight inside); an optional ink mullion cross and a sill colour under it."""
    s.rect(x - 1, y - 1, x + w, y + h, INK)
    s.rect(x, y, x + w - 1, y + h - 1, GLOW)
    s.px(x, y, HOT)
    if w >= 3 and h >= 3:
        s.px(x + 1, y, HOT)
        s.px(x, y + 1, HOT)
    if cross:
        mx, my = x + w // 2, y + h // 2
        s.line(mx, y, mx, y + h - 1, INK)
        s.line(x, my, x + w - 1, my, INK)
    if sill:
        s.line(x - 1, y + h, x + w, y + h, sill)


def planks_v(s, x0, y0, x1, y1, base, seam, lit=None, step=3, off=0):
    """A wall of vertical boards: base fill, seam colour every `step` px, lit left column."""
    s.rect(x0, y0, x1, y1, base)
    for x in range(x0 + off, x1 + 1, step):
        if x > x0:
            s.line(x, y0, x, y1, seam)
    if lit:
        s.line(x0, y0, x0, y1, lit)


def deck(s, x0, x1, y, depth=2):
    """A plank platform seen from the front-top: one lit top row, `depth` rows of front face."""
    s.line(x0, y, x1, y, G2)
    for k in range(1, depth + 1):
        s.line(x0, y + k, x1, y + k, G1 if k == 1 else G0)
    for x in range(x0 + 2, x1, 4):
        s.px(x, y + 1, G0)


def gable(s, cx, y_top, half0, rows, fill, lit, dark, ridge=None):
    """A symmetric gable roof: row i spans cx-half0-i .. cx+half0+i-1 (cx on a pixel edge).
    Lit left slope, dark right slope edge, fill between."""
    for i in range(rows):
        a, b = cx - half0 - i, cx + half0 + i - 1
        s.line(a, y_top + i, b, y_top + i, fill)
        s.px(a, y_top + i, lit)
        s.px(b, y_top + i, dark)
    if ridge:
        s.line(cx - half0, y_top, cx + half0 - 1, y_top, ridge)
