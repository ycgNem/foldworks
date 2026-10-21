"""Shared hand for Bramble's Town (pixel-art/town/), the sky island edition (docs/sky-island.md).

The town used to stand on stilts in the bayou; now it stands on the island's grass rim north of
the plot (the Workshop) and on the sky platform's riveted steel north deck (the Factory). The
same sprites draw on both, so every footing is neutral: stone and timber, never grass or water.
A grass tuft overlay (town_tuft) and the shadow under every piece are added by src/render/town.ts
(the shadow is a translucent code-drawn band, so it is right on grass and on steel alike).

Conventions (STYLE.md, "The town"):
- Every standing sprite's last row is its ink outline; the row above it is the bottom of its
  footing (a stone or timber foundation, a step at the door). Bottom-aligned on a tile row, any
  two pieces stand on the same ground line.
- Daylight from the top-left (the sky's sun glow is top-left): lit left edges and roof slopes,
  shade on the right, glass that reflects the sky (sky2 with a white glint), warm wood and roofs
  kept from Lantern Bayou. Lanterns still glow (they are lanterns).
- Ink outline outside every standing object, so it reads at 1x on bright meadow and grey steel.

Palette: every colour of src/data/palette.ts but the five pips (read from the file, so the
script can never drift from it). Colours are named as in `C` (Lantern Bayou names + the sky's).
"""
import sys
import re
import json
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
_local = ROOT / ".claude/skills/pixel-art-studio/scripts"
sys.path.insert(0, str(_local if _local.exists() else Path.home() / ".claude/skills/pixel-art-studio/scripts"))
from pixelstudio import Sprite, hex2rgba  # noqa: E402,F401
from PIL import Image  # noqa: E402

ART = ROOT / "src" / "art"
OUT = HERE / "out"
OUT.mkdir(parents=True, exist_ok=True)

# ---------------------------------------------------------------- palette (from palette.ts)
_src = (ROOT / "src" / "data" / "palette.ts").read_text(encoding="utf-8")


def _block(name):
    b = re.search(r"const %s = \{(.*?)\} as const;" % name, _src, re.S).group(1)
    return dict(re.findall(r"(\w+):\s*'(#[0-9a-fA-F]{6})'", b))


_LB, _SKY, _A = _block("LB"), _block("SKY"), _block("A")
P = {**_LB, **_SKY}
PIPS = {_A[k].lower() for k in ("pipGreen", "pipYellow", "pipRed", "pipGrey", "pipBlue")}
_pal = re.search(r"export const PALETTE = \[(.*?)\] as const;", _src, re.S).group(1)
PALETTE = [h.lower() for h in re.findall(r"'(#[0-9a-fA-F]{6})'", _pal)]
ART_PAL = [h for h in PALETTE if h not in PIPS]
assert set(h.lower() for h in P.values()) <= set(ART_PAL), "a named colour is not in PALETTE"

globals().update({k: v for k, v in P.items()})  # ink, wood0.., pave0.., grass0.., sky2, cloud3...
INK1, INK2 = P["ink1"], P["ink2"]
WHITE = P["cloud3"]

# one-letter keys for ASCII maps ('.' and ' ' skip)
KEY = {
    ".": None, " ": None,
    "k": P["ink"], "K": P["ink1"], "Q": P["ink2"],
    "a": P["wood0"], "b": P["wood1"], "c": P["wood2"], "d": P["wood3"], "e": P["wood4"], "f": P["wood5"],
    "0": P["steel0"], "1": P["steel1"], "2": P["steel2"], "3": P["steel3"], "4": P["steel4"],
    "6": P["pave0"], "7": P["pave1"], "8": P["pave2"], "9": P["pave3"],
    "i": P["iron0"], "I": P["iron1"], "J": P["iron2"],
    "r": P["copper0"], "R": P["copper1"], "p": P["copper2"], "P": P["copper3"],
    "h": P["lamp0"], "o": P["lamp1"], "g": P["lamp2"], "H": P["lamp3"],
    "y": P["brass0"], "Y": P["brass1"], "z": P["brass2"], "Z": P["brass3"],
    "M": P["moss1"], "m": P["moss2"], "n": P["moss3"], "N": P["moss4"], "l": P["moss5"], "L": P["lily"],
    "x": P["slag0"], "X": P["slag1"], "v": P["violet"], "t": P["teal"],
    "u": P["water2"], "U": P["water3"], "T": P["water4"],
    "B": P["bone"], "!": P["red"], "W": P["cloud3"], "w": P["cloud2"], "~": P["sky2"], "=": P["sky3"],
    "E": P["earth3"], "D": P["earth2"],
    "G": P["grass1"], "F": P["grass2"], "V": P["grass3"], "j": P["grass0"],
}


def new(w, h, n=1):
    s = Sprite(w, h, palette=ART_PAL)
    for _ in range(n - 1):
        s.add_frame(copy=False)
    s.frame(1)
    return s


def ascii_(s, x0, y0, rows, key=None, only=None):
    """Draw an ASCII pixel map; '.' and ' ' are skipped, never erased."""
    key = key or KEY
    for j, row in enumerate(rows):
        for i, ch in enumerate(row):
            if ch in ". ":
                continue
            s.px(x0 + i, y0 + j, key[ch], only=only)


def ell(s, cx, cy, rx, ry, color, only=None):
    """Filled ellipse centred on (cx, cy) in pixel-edge coordinates: symmetric at every size."""
    for y in range(int(cy - ry) - 1, int(cy + ry) + 2):
        for x in range(int(cx - rx) - 1, int(cx + rx) + 2):
            dx = (x + 0.5 - cx) / max(rx, 0.01)
            dy = (y + 0.5 - cy) / max(ry, 0.01)
            if dx * dx + dy * dy <= 1.0:
                s.px(x, y, color, only=only)


# ---------------------------------------------------------------- export

REPORT = {}


def strip(s):
    im = Image.new("RGBA", (s.w * s.n_frames, s.h), (0, 0, 0, 0))
    for i in range(s.n_frames):
        im.alpha_composite(s.composite(i + 1), (i * s.w, 0))
    return im


def check_palette(im, name):
    ok = {tuple(int(h[i:i + 2], 16) for i in (1, 3, 5)) for h in ART_PAL}
    cols = set()
    for px in im.getdata():
        if px[3] == 0:
            continue
        assert px[3] == 255, f"{name}: semi-transparent pixel {px}"
        assert px[:3] in ok, f"{name}: off-palette colour {px}"
        cols.add(px[:3])
    return len(cols)


def up(im, k):
    return im.resize((im.width * k, im.height * k), Image.NEAREST)


def on(im, bg):
    out = Image.new("RGBA", im.size, hex2rgba(bg))
    out.alpha_composite(im)
    return out


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
    # previews: 1x on the meadow and on the steel deck; big on the meadow with a gap per frame
    two = Image.new("RGBA", (im.width, im.height * 2 + 2), hex2rgba(P["grass2"]))
    two.alpha_composite(im, (0, 0))
    deckbg = Image.new("RGBA", (im.width, im.height), hex2rgba(P["steel2"]))
    deckbg.alpha_composite(im)
    two.alpha_composite(deckbg, (0, im.height + 2))
    two.save(OUT / f"{name}_1x.png")
    gap = scale
    big = Image.new("RGBA", (s.n_frames * (s.w * scale + gap), s.h * scale), hex2rgba(P["grass2"]))
    for i in range(s.n_frames):
        big.alpha_composite(up(s.composite(i + 1), scale), (i * (s.w * scale + gap), 0))
    big.save(OUT / f"{name}_{scale}x.png")
    REPORT[name] = {"frame": [s.w, s.h], "frames": s.n_frames, "colours": ncol, "fps": fps,
                    **({"order": list(order)} if order else {})}
    rep = OUT / "report.json"
    old = json.loads(rep.read_text(encoding="utf-8")) if rep.exists() else {}
    old.update(REPORT)
    rep.write_text(json.dumps(old, indent=1), encoding="utf-8")
    print(f"{name}: {s.w}x{s.h} x{s.n_frames}  fps {fps}  colours {ncol}")
    return im


def load(name):
    im = Image.open(ART / f"{name}.png").convert("RGBA")
    meta = json.loads((ART / f"{name}.json").read_text(encoding="utf-8"))
    w, h = meta["frame"]
    return [im.crop((i * w, 0, (i + 1) * w, h)) for i in range(meta["frames"])], meta


# ---------------------------------------------------------------- shared parts

def window(s, x, y, w=3, h=3, frame=None, cross=False, sill=None, shutters=None):
    """A daylight window, (x, y) the top-left of the glass: an ink frame round it, sky-blue glass
    (sky2) with a white glint top-left and the lower-right pane a step darker (sky1), an optional
    mullion cross, sill and shutters (a colour for 1 px shutters either side)."""
    s.rect(x - 1, y - 1, x + w, y + h, frame or P["ink"])
    s.rect(x, y, x + w - 1, y + h - 1, P["sky2"])
    s.rect(x + w // 2, y + h // 2, x + w - 1, y + h - 1, P["sky1"])
    s.px(x, y, WHITE)
    if w >= 3 and h >= 3:
        s.px(x + 1, y, P["sky3"])
        s.px(x, y + 1, P["sky3"])
    if cross:
        mx, my = x + w // 2, y + h // 2
        s.line(mx, y, mx, y + h - 1, frame or P["ink"])
        s.line(x, my, x + w - 1, my, frame or P["ink"])
    if sill:
        s.line(x - 1, y + h, x + w, y + h, sill)
    if shutters:
        s.line(x - 2, y - 1, x - 2, y + h - 1, shutters)
        s.line(x + w + 1, y - 1, x + w + 1, y + h - 1, shutters)


def door(s, x0, y0, x1, y1, base=None, lit=None, knob=None, arch=False):
    """A plank door from (x0, y0) to (x1, y1), ink frame outside it (so y1 + 1 is the threshold
    the step meets): boards in `base` with a lit left board and a brass knob."""
    base, lit = base or P["wood2"], lit or P["wood3"]
    s.rect(x0 - 1, y0 - 1, x1 + 1, y1, P["ink"])
    s.rect(x0, y0, x1, y1, base)
    s.line(x0, y0, x0, y1, lit)
    for x in range(x0 + 2, x1 + 1, 2):
        s.line(x, y0 + 1, x, y1, P["wood1"])
    if arch:
        s.px(x0, y0, P["ink"])
        s.px(x1, y0, P["ink"])
    s.px(x1 - 1 if x1 - x0 >= 2 else x1, (y0 + y1) // 2 + 1, knob or P["brass2"])


def stone_base(s, x0, x1, top, bot=30, seed=0):
    """A stone foundation from row `top` to `bot` (inclusive), x0..x1: warm grey stones (pave
    ramp) in two staggered courses, lit cap on the top row, lit left end, shaded right end. The
    caller's outline adds the ink round it (row bot + 1 is the ground line)."""
    s.rect(x0, top, x1, bot, P["pave2"])
    s.line(x0, top, x1, top, P["pave3"])
    rows = list(range(top + 1, bot + 1))
    # mortar: one course line every 2 rows, joints staggered every 4-5 px
    for j, y in enumerate(rows):
        if j % 2 == 1 and y < bot:
            s.line(x0, y, x1, y, P["pave1"])
    for j, y in enumerate(rows):
        if j % 2 == 0:
            off = (seed * 3 + (j // 2) * 3) % 5
            for x in range(x0 + 2 + off, x1 - 1, 5):
                s.px(x, y, P["pave0"])
    s.line(x0, top, x0, bot, P["pave3"])
    s.line(x1, top + 1, x1, bot, P["pave1"])
    s.line(x0 + 1, bot, x1, bot, P["pave1"])


def step(s, cx0, cx1, y, rows=3):
    """A stone step sticking out in front of a door, over the foundation's face: its lit top
    face from row y (rows - 1 rows of it), a shaded front on the last row, ink at both ends. The
    door's threshold (the foundation's cap under it) is darkened so the slab reads in front."""
    s.line(cx0 + 1, y - 1, cx1 - 1, y - 1, P["pave1"])
    s.rect(cx0, y, cx1, y + rows - 2, P["pave3"])
    s.px(cx0, y, WHITE)
    s.line(cx0, y + rows - 1, cx1, y + rows - 1, P["pave1"])
    s.px(cx1, y + rows - 2, P["pave2"])
    for yy in range(y, y + rows):
        s.px(cx0 - 1, yy, P["ink"])
        s.px(cx1 + 1, yy, P["ink"])


def ink_ring(s, rects):
    """Ink on every empty pixel 4-adjacent to the given rects (x0, y0, x1, y1, inclusive): an
    outline for a part added after the sprite's own outline pass, without thickening the rest."""
    cells = {(x, y) for (x0, y0, x1, y1) in rects for x in range(x0, x1 + 1) for y in range(y0, y1 + 1)}
    for (x, y) in cells:
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            q = (x + dx, y + dy)
            if q not in cells and s.get(*q) is None and 0 <= q[0] < s.w and 0 <= q[1] < s.h:
                s.px(q[0], q[1], P["ink"])


def sill_beam(s, x0, x1, y):
    """A timber sill on the foundation: lit top wood4, face wood2."""
    s.line(x0, y, x1, y, P["wood4"])
    s.line(x0, y + 1, x1, y + 1, P["wood2"])
    s.px(x0, y, P["wood5"])


def planks_v(s, x0, y0, x1, y1, base, seam, lit=None, step_=3, off=0):
    """A wall of vertical boards: base fill, a seam every `step_` px, lit left column."""
    s.rect(x0, y0, x1, y1, base)
    for x in range(x0 + off, x1 + 1, step_):
        if x > x0:
            s.line(x, y0, x, y1, seam)
    if lit:
        s.line(x0, y0, x0, y1, lit)


def siding(s, x0, y0, x1, y1, base, seam, lit=None, step_=2):
    """Horizontal clapboards: a seam line every `step_` rows, lit left column."""
    s.rect(x0, y0, x1, y1, base)
    for y in range(y0 + 1, y1 + 1, step_):
        s.line(x0, y, x1, y, seam)
    if lit:
        s.line(x0, y0, x0, y1, lit)


# legacy palette-A role names, so the retired lily.py still imports (town_lily is out of use)
INK, SH, BONE = P["ink"], P["ink1"], P["bone"]
G0, G1, G2 = P["wood1"], P["wood3"], P["wood4"]
H0, H1, H2, H3 = P["steel1"], P["steel2"], P["steel3"], P["steel4"]
I0, I1, I2 = P["iron0"], P["iron1"], P["iron2"]
C0, C1, C2 = P["copper0"], P["copper1"], P["copper2"]
SLAG, VIO = P["slag1"], P["violet"]
B0, B1, GOLD = P["brass1"], P["brass2"], P["lamp2"]
GLOW, HOT = P["lamp1"], P["lamp3"]
T0, T1 = P["water3"], P["teal"]
MOSS, LEAF = P["moss3"], P["moss5"]
