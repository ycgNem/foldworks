"""Foldworks palette test (ROADMAP Milestone 0, last bullet).

Two candidate palettes, the same six sprites drawn in each by shared parametric drawing
functions (the palette is the only input that changes, except the ground texture, which is
part of each direction), plus a contact sheet and a mock scene per candidate.

    python build.py            # regenerates everything in this folder

Outputs (all regenerated, never hand-edited):
    contact.png                  both candidates side by side, 1x and 4x, scenes at 1x and 3x
    palette_A.json, palette_B.json   ordered [{name, hex}]
    out/<A|B>/*.png              1x strips per sprite (frames left to right) + 8x previews,
                                 ore_patch_0..3 (quadrants) + ore_patch_2x2, items.png
    out/<A|B>/scene_1x.png, scene_3x.png (+ _deutan, _protan, _lightness), scene.gif
    out/check_*.png              zooms and silhouettes used in the critique loops
    out/report.json              size, frame count and colour count per sprite
"""
import sys
import json
import math
from pathlib import Path

HERE = Path(__file__).resolve().parent
_local = HERE.parents[1] / ".claude/skills/pixel-art-studio/scripts"
sys.path.insert(0, str(_local if _local.exists() else Path.home() / ".claude/skills/pixel-art-studio/scripts"))
from pixelstudio import Sprite, hex2rgba, rgba2hex  # noqa: E402
from PIL import Image, ImageDraw, ImageFont  # noqa: E402

OUT = HERE / "out"

# ---------------------------------------------------------------------------------------
# Palettes. The same 31 slot names in the same order in both (one of the 32 left free), so
# every sprite is a palette swap. Ramps go dark -> light with cool shadows, warm highlights.
# The five pip colours are reserved for status and never used in sprite art.
# ---------------------------------------------------------------------------------------

SLOTS = [
    # name        role
    ("ink",      "outlines, UI background, the darkest value"),
    ("shadow",   "cast shadow, recessed wells, coal, land you don't own (with ink hatch)"),
    ("bone",     "text, the brightest neutral"),
    ("ground0",  "floor: cracks, dents, the stain under an ore patch"),
    ("ground1",  "floor: base"),
    ("ground2",  "floor: pebbles / blueprint grid line"),
    ("hull0",    "machine steel: shadow side, belt bed, slag shade"),
    ("hull1",    "machine steel: base"),
    ("hull2",    "machine steel: lit side"),
    ("hull3",    "machine steel: highlight, glints"),
    ("iron0",    "iron: shade"),
    ("iron1",    "iron: base"),
    ("iron2",    "iron: light"),
    ("copper0",  "copper / rust / firebrick: shade"),
    ("copper1",  "copper: base, crates"),
    ("copper2",  "copper: light (salmon)"),
    ("slag",     "slag: muddy purple-grey"),
    ("brass0",   "brass / gold: shade"),
    ("brass1",   "brass / gold: base (gizmo, coin, module frame)"),
    ("glow",     "furnace glow"),
    ("hot",      "white-hot core, brass and glow highlight"),
    ("teal0",    "glass / later act: shade"),
    ("teal1",    "glass / later act: light"),
    ("moss",     "Bramble's green (dark), circuit board"),
    ("leaf",     "Bramble's green (light): lily pads, plants"),
    ("violet",   "late-act exotic accent (sunsets, pocket weather)"),
    ("pipGreen", "status: working (reserved: never used in sprite art)"),
    ("pipYellow", "status: starved (reserved)"),
    ("pipRed",   "status: blocked (reserved)"),
    ("pipGrey",  "status: unconnected, an unlit LED (reserved)"),
    ("pipBlue",  "status: unpowered, Act II (reserved)"),
]

CANDIDATES = {
    "A": {
        "title": "Foundry",
        "blurb": "warm plum-brown darks, packed-earth floor, rust/copper/brass, furnace glow, olive accent",
        "ground_style": "earth",
        "hex": {
            "ink": "#1d1420", "shadow": "#3a2532", "bone": "#f2e6cf",
            "ground0": "#4a3431", "ground1": "#62473b", "ground2": "#7e624c",
            "hull0": "#463f50", "hull1": "#78737c", "hull2": "#a9a29f", "hull3": "#dccfb8",
            "iron0": "#333a5a", "iron1": "#5c6d93", "iron2": "#96a9c6",
            "copper0": "#722d2a", "copper1": "#c4633b", "copper2": "#ec9e78",
            "slag": "#74586e",
            "brass0": "#7a5418", "brass1": "#c99a3a",
            "glow": "#f5952a", "hot": "#ffeca0",
            "teal0": "#2a6566", "teal1": "#6fc1ae",
            "moss": "#5a6a2e", "leaf": "#9cb446", "violet": "#9a4a88",
            "pipGreen": "#66cc50", "pipYellow": "#ffe466", "pipRed": "#c8362e",
            "pipGrey": "#3d3c42", "pipBlue": "#4a8fe2",
        },
    },
    "B": {
        "title": "Cyanotype",
        "blurb": "indigo/slate darks, teal blueprint floor with a tile grid, saturated items that pop",
        "ground_style": "grid",
        "hex": {
            "ink": "#0b1020", "shadow": "#1b2642", "bone": "#eaf2ee",
            "ground0": "#173a47", "ground1": "#1f4b58", "ground2": "#2b6170",
            "hull0": "#3c4252", "hull1": "#6c7486", "hull2": "#a8b0bc", "hull3": "#cdd5d2",
            "iron0": "#28407a", "iron1": "#4f80d0", "iron2": "#94c2f6",
            "copper0": "#8e2f2c", "copper1": "#ec6a3c", "copper2": "#ffb08a",
            "slag": "#725e86",
            "brass0": "#8f5a14", "brass1": "#f3c13c",
            "glow": "#ff9a2c", "hot": "#fff4c4",
            "teal0": "#148a8e", "teal1": "#5fe6dc",
            "moss": "#2a7a46", "leaf": "#a2da58", "violet": "#b24ad6",
            "pipGreen": "#40d068", "pipYellow": "#ffeb52", "pipRed": "#d0303e",
            "pipGrey": "#33363f", "pipBlue": "#4594f2",
        },
    },
}

for _k, _c in CANDIDATES.items():
    assert [n for n, _ in SLOTS] == list(_c["hex"].keys()), _k
    assert len(set(h.lower() for h in _c["hex"].values())) == len(SLOTS), "duplicate hex in " + _k
    assert len(SLOTS) <= 32

# ---------------------------------------------------------------------------------------
# Colour science for the checks (OKLab lightness, CVD simulation)
# ---------------------------------------------------------------------------------------


def _lin(c):
    c = c / 255.0
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def _unlin(c):
    c = max(0.0, min(1.0, c))
    v = 12.92 * c if c <= 0.0031308 else 1.055 * c ** (1 / 2.4) - 0.055
    return int(round(v * 255))


def oklab(rgb):
    r, g, b = (_lin(v) for v in rgb[:3])
    l_ = 0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b
    m_ = 0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b
    s_ = 0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b
    l_, m_, s_ = (math.copysign(abs(v) ** (1 / 3), v) for v in (l_, m_, s_))
    return (0.2104542553 * l_ + 0.7936177850 * m_ - 0.0040720468 * s_,
            1.9779984951 * l_ - 2.4285922050 * m_ + 0.4505937099 * s_,
            0.0259040371 * l_ + 0.7827717662 * m_ - 0.8086757660 * s_)


def L(hexc):
    return oklab(hex2rgba(hexc))[0]


# Machado et al. 2009, severity 1.0, applied in linear RGB
CVD = {
    "deutan": ((0.367322, 0.860646, -0.227968), (0.280085, 0.672501, 0.047413), (-0.011820, 0.042940, 0.968881)),
    "protan": ((0.152286, 1.052583, -0.204868), (0.114503, 0.786281, 0.099216), (-0.003882, -0.048116, 1.051998)),
    "tritan": ((1.255528, -0.076749, -0.178779), (-0.078411, 0.930809, 0.147602), (0.004733, 0.691367, 0.303900)),
}


def cvd_rgb(rgb, kind):
    m = CVD[kind]
    lr = [_lin(v) for v in rgb[:3]]
    return tuple(_unlin(sum(m[i][j] * lr[j] for j in range(3))) for i in range(3))


def cvd_image(im, kind):
    out = im.convert("RGB").copy()
    px = out.load()
    cache = {}
    for y in range(out.height):
        for x in range(out.width):
            c = px[x, y]
            if c not in cache:
                cache[c] = cvd_rgb(c, kind)
            px[x, y] = cache[c]
    return out


def lightness_image(im):
    out = im.convert("RGB").copy()
    px = out.load()
    cache = {}
    for y in range(out.height):
        for x in range(out.width):
            c = px[x, y]
            if c not in cache:
                v = int(round(max(0.0, min(1.0, oklab(c)[0])) * 255))
                cache[c] = (v, v, v)
            px[x, y] = cache[c]
    return out


def dE(c1, c2):
    a, b = oklab(c1), oklab(c2)
    return math.sqrt(sum((a[i] - b[i]) ** 2 for i in range(3)))


# ---------------------------------------------------------------------------------------
# Drawing helpers
# ---------------------------------------------------------------------------------------

KEY = {
    "#": "ink", "s": "shadow", "W": "bone",
    "g": "ground0", "G": "ground1", "h": "ground2",
    "0": "hull0", "1": "hull1", "2": "hull2", "3": "hull3",
    "a": "iron0", "b": "iron1", "e": "iron2",
    "r": "copper0", "o": "copper1", "p": "copper2",
    "n": "slag", "l": "leaf", "V": "violet",
    "u": "brass0", "y": "brass1", "x": "glow", "z": "hot",
    "t": "teal0", "T": "teal1", "v": "moss",
    "Q": "pipGreen", "Y": "pipYellow", "R": "pipRed", "q": "pipGrey", "B": "pipBlue",
}


class Pal(dict):
    """name -> hex, plus the ordered list."""

    def __init__(self, cand):
        super().__init__(cand["hex"])
        self.order = [n for n, _ in SLOTS]
        self.title = cand["title"]
        self.ground_style = cand["ground_style"]

    @property
    def hexes(self):
        return [self[n] for n in self.order]


def new(w, h, P, frames=1, ms=150):
    s = Sprite(w, h, palette=P.hexes)
    for _ in range(frames - 1):
        s.add_frame(copy=False)
    s.set_duration(ms, "all")
    s.frame(1)
    return s


def blit(s, P, x0, y0, rows, key=None, only=None):
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


def box(s, P, x0, y0, x1, y1, fill, light, dark, hi=None, chamfer=1, outline="ink"):
    """Bevelled box lit from the top-left, ink outline, rounded by `chamfer` px."""
    s.rect(x0, y0, x1, y1, P[outline])
    s.rect(x0 + 1, y0 + 1, x1 - 1, y1 - 1, P[fill])
    s.line(x0 + 1, y0 + 1, x1 - 1, y0 + 1, P[light])
    s.line(x0 + 1, y0 + 1, x0 + 1, y1 - 1, P[light])
    s.line(x0 + 1, y1 - 1, x1 - 1, y1 - 1, P[dark])
    s.line(x1 - 1, y0 + 1, x1 - 1, y1 - 1, P[dark])
    s.px(x1 - 1, y0 + 1, P[fill])
    s.px(x0 + 1, y1 - 1, P[fill])
    if hi:
        s.px(x0 + 1, y0 + 1, P[hi])
    for c in range(chamfer):
        # cut a diagonal of `c+1` px at each corner, then re-ink the new edge
        for (cx, cy, dx, dy) in ((x0, y0, 1, 1), (x1, y0, -1, 1), (x0, y1, 1, -1), (x1, y1, -1, -1)):
            for i in range(c + 1):
                s.px(cx + dx * i, cy + dy * (c - i), None)
            if c + 1 < chamfer:
                continue
            for i in range(c + 2):
                px_, py_ = cx + dx * i, cy + dy * (c + 1 - i)
                if s.get(px_, py_) is not None:
                    s.px(px_, py_, P[outline])


# ---------------------------------------------------------------------------------------
# Ground, unowned land, ore patch
# ---------------------------------------------------------------------------------------

EARTH_SPECKS = [
    # (slot, [pixels]) per variant: small clusters, kept off the tile edges
    [("ground0", [(3, 4), (4, 4), (4, 5)]), ("ground0", [(11, 11), (12, 11)]),
     ("ground2", [(10, 3), (11, 3)]), ("ground2", [(4, 12), (5, 12), (5, 13)]),
     ("ground0", [(8, 8)]), ("ground2", [(13, 7)])],
    [("ground0", [(10, 5), (11, 5), (11, 6)]), ("ground0", [(3, 12), (4, 12)]),
     ("ground2", [(5, 3), (6, 3)]), ("ground2", [(12, 12), (12, 13)]),
     ("ground0", [(7, 9)])],
    [("ground0", [(6, 6), (7, 6)]), ("ground0", [(12, 3), (12, 4)]),
     ("ground2", [(2, 9), (3, 9), (3, 10)]), ("ground2", [(10, 12), (11, 12)])],
]


def draw_ground(s, P, variant=0):
    s.rect(0, 0, 15, 15, P["ground1"])
    if P.ground_style == "earth":
        for slot, pts in EARTH_SPECKS[variant % len(EARTH_SPECKS)]:
            for x, y in pts:
                s.px(x, y, P[slot])
    else:  # blueprint: a 1 px grid line on the tile's top and left edges, + a centre tick
        s.line(0, 0, 15, 0, P["ground2"])
        s.line(0, 0, 0, 15, P["ground2"])
        v = variant % 3
        if v == 1:
            for x, y in ((5, 9), (6, 9), (11, 4)):
                s.px(x, y, P["ground0"])
        elif v == 2:
            for x, y in ((9, 11), (9, 12), (4, 5)):
                s.px(x, y, P["ground0"])


def ground_tile(P, variant=0):
    s = new(16, 16, P)
    draw_ground(s, P, variant)
    return s


def unowned_tile(P):
    s = new(16, 16, P)
    s.rect(0, 0, 15, 15, P["shadow"])
    for y in range(16):
        for x in range(16):
            if (x + y) % 4 == 0:
                s.px(x, y, P["ink"])
    return s


# An ore patch is 2x2 tiles. It is drawn as one 32x32 deposit and cut into quadrants, so
# lumps can cross the inner seams and the patch never reads as four copies of a stamp.
# The game picks the quadrant from the tile's offset inside its patch.
# Lumps are (cx, cy, rx, ry), drawn top to bottom so nearer lumps overlap farther ones.
PATCH_LUMPS = [
    (28, 5, 1.7, 1.4), (17, 6, 2.5, 2.0), (9, 8, 3.4, 2.8), (24, 9.5, 3.2, 2.6),
    (5.5, 15, 2.2, 1.8), (15, 15, 3.6, 3.0), (24, 18, 2.6, 2.2), (9, 22, 3.1, 2.5),
    (19, 23.5, 2.4, 2.0), (26, 25.5, 3.0, 2.4), (5, 26.5, 1.8, 1.5), (14, 28, 2.1, 1.6),
]
STAIN_R = 6  # corner radius of the darker earth under the patch


def _lump_pixels(cx, cy, rx, ry, size):
    pts = {}
    for y in range(size):
        for x in range(size):
            u, v = (x + 0.5 - cx) / rx, (y + 0.5 - cy) / ry
            if u * u + v * v <= 1.0:
                pts[(x, y)] = -(u + v) * 0.7071  # > 0 faces the top-left light
    return pts


def ore_patch(P):
    """The whole 32x32 deposit (on its own floor)."""
    s = new(32, 32, P)
    for i in range(4):
        tile = new(16, 16, P)
        draw_ground(tile, P, i % 3)
        s._img().alpha_composite(tile.composite(1), ((i % 2) * 16, (i // 2) * 16))
    R = STAIN_R
    for y in range(32):
        for x in range(32):
            cx = min(max(x, R), 31 - R)
            cy = min(max(y, R), 31 - R)
            if (x - cx) ** 2 + (y - cy) ** 2 > R * R:
                continue
            edge = x in (0, 31) or y in (0, 31) or (x - cx) ** 2 + (y - cy) ** 2 > (R - 1) ** 2
            if edge and (x + y) % 2:
                continue  # a ragged 1 px rim where the patch meets plain floor
            s.px(x, y, P["ground0"])
    for cx, cy, rx, ry in PATCH_LUMPS:
        pts = _lump_pixels(cx, cy, rx, ry, 32)
        ring = set()
        for (x, y) in pts:
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                q = (x + dx, y + dy)
                if q not in pts and 0 <= q[0] < 32 and 0 <= q[1] < 32:
                    ring.add(q)
        for x, y in ring:
            s.px(x, y, P["ink"])
        for (x, y), d in pts.items():
            s.px(x, y, P["iron2"] if d > 0.42 else (P["iron0"] if d < -0.38 else P["iron1"]))
        if rx >= 2.6:
            bx, by = max(pts.items(), key=lambda kv: kv[1])[0]
            s.px(bx, by, P["hull3"])
    return s


def ore_patch_tiles(P):
    """Quadrants in reading order: top-left, top-right, bottom-left, bottom-right."""
    whole = ore_patch(P).composite(1)
    out = []
    for i in range(4):
        t = new(16, 16, P)
        t._img().alpha_composite(whole.crop(((i % 2) * 16, (i // 2) * 16, (i % 2) * 16 + 16, (i // 2) * 16 + 16)))
        out.append(t)
    return out


# ---------------------------------------------------------------------------------------
# Item icons, 8x8 (ink outline, light from the top-left)
# ---------------------------------------------------------------------------------------

ICONS = {
    "iron_ore": [          # four round lumps: ore is lumpy
        "..##.##.",
        ".#eb#eb#",
        "#3bba#a#",
        "#bba#eb#",
        ".#a#eba#",
        "#eb#baa#",
        "#ba#aa#.",
        ".##.##..",
    ],
    "iron_ingot": [        # a slanted bar
        "........",
        "........",
        "..######",
        ".#3eeeb#",
        "#3eeeb##",
        "#bbbba#.",
        "#aaaa#..",
        "######..",
    ],
    "gear": [              # a square cog with a real hole (the belt shows through)
        ".e.ee.b.",
        "eeeeebbb",
        ".ee##bb.",
        "ee#..#ba",
        "eb#..#ba",
        ".bb##ba.",
        "bbbbbaaa",
        ".b.ba.a.",
    ],
    "copper_ore": [        # one big nugget with veins, not four lumps
        "...###..",
        "..#ppo#.",
        ".#poooo#",
        "#pro#or#",
        "#oorrpo#",
        "#orpoor#",
        ".#rrrr#.",
        "..####..",
    ],
    "copper_ingot": [      # a rounded bar, not slanted
        "........",
        "........",
        "..####..",
        ".#ppoo#.",
        "#poooor#",
        "#oooorr#",
        ".#rrrr#.",
        "..####..",
    ],
    "coal": [              # a faceted black chunk with glints (drawn from shadow + ink)
        "...###..",
        "..#s2s#.",
        ".#s2ss##",
        "#ss#s2s#",
        "#s3ss#s#",
        "#ss#sss#",
        ".#ssss#.",
        "..####..",
    ],
    "slag": [              # a holed, drippy cake
        "........",
        "..####..",
        ".#nn2n#.",
        "#nn#nn0#",
        "#n0nn#0#",
        "#nn00n0#",
        ".#0##0#.",
        "..#..#..",
    ],
    "iron_plate": [
        "........",
        ".######.",
        ".#3eee##",
        ".#ebbbb#",
        ".#ebbbb#",
        ".#ebbba#",
        ".##aaaa#",
        "..#####.",
    ],
    "copper_wire": [
        "..####..",
        ".#2##0#.",
        "#oporpo#",
        "#oporpo#",
        "#oporpo#",
        "#rorrro#",
        ".#2##0#.",
        "..####..",
    ],
    "gizmo": [
        ".#.....#",
        "..#...#.",
        "..#yyy#.",
        ".#yzTyy#",
        "#uyTTyuy",
        ".#yyyuy#",
        "..#u#u#.",
        "...#.#..",
    ],
    "coin": [
        "..####..",
        ".#zyyy#.",
        "#zyuuyy#",
        "#yyuyyu#",
        "#yyuyyu#",
        "#yyuuyu#",
        ".#uuuu#.",
        "..####..",
    ],
    "glass": [
        "..####..",
        "..#WT#..",
        ".#TWTt#.",
        "#TWTTTt#",
        "#TTTTtt#",
        "#TTTttt#",
        ".#tttt#.",
        "..####..",
    ],
    "circuit": [
        "........",
        "########",
        "#vyvv#v#",
        "#vy##yv#",
        "#yy##vv#",
        "#vvvyyv#",
        "########",
        ".#.#.#..",
    ],
    "sunset": [            # draft: the Portable Sunset Generator
        "..#yy#..",
        ".######.",
        "#VVVVVV#",
        "#VxzzxV#",
        "#xozzox#",
        "#oooooo#",
        "#1####1#",
        ".##..##.",
    ],
}

ICON_ORDER = ["iron_ore", "iron_ingot", "gear", "copper_ore", "copper_ingot", "coal", "slag",
              "iron_plate", "copper_wire", "gizmo", "coin", "glass", "circuit", "sunset"]


def draw_icon(s, P, name, x0, y0):
    blit(s, P, x0, y0, ICONS[name])


def icon_sprite(P, name):
    s = new(8, 8, P)
    draw_icon(s, P, name, 0, 0)
    return s


# ---------------------------------------------------------------------------------------
# Machines (face right = output side; all four corners kept calm for the status pip)
# ---------------------------------------------------------------------------------------

def _disk(r_in):
    pts = set()
    for dy in range(-6, 7):
        for dx in range(-6, 7):
            if dx * dx + dy * dy <= r_in * r_in:
                pts.add((dx, dy))
    return pts


DISK_IN = _disk(3.5)
DISK_OUT = _disk(4.5)

def drill_head(s, P, cx, cy, f):
    """Top view of the cutter: three curved arms, 30 degrees per frame (a 4-frame loop)."""
    for dx, dy in DISK_OUT:
        s.px(cx + dx, cy + dy, P["ink"])
    for dx, dy in DISK_IN:
        if dx == 0 and dy == 0:
            continue
        th = math.atan2(dy, dx)
        r = math.hypot(dx, dy)
        v = (3 * th / (2 * math.pi) + 0.25 * r - 0.25 * f) % 1.0
        s.px(cx + dx, cy + dy, P["hull3"] if v < 0.33 else (P["hull1"] if v < 0.6 else P["hull0"]))
    s.px(cx, cy, P["brass1"])


def miner(P):
    s = new(16, 16, P, frames=4, ms=80)
    cx, cy = 7, 8
    for f in range(4):
        s.frame(f + 1)
        box(s, P, 1, 1, 13, 14, "hull1", "hull2", "hull0", hi="hull3")
        # the miner family's brass back plate (the side opposite the output)
        s.line(2, 3, 2, 12, P["brass1"])
        s.line(3, 3, 3, 12, P["brass0"])
        s.px(2, 3, P["hot"])
        # chute on the output side
        s.rect(12, 6, 15, 9, P["ink"])
        s.rect(12, 7, 15, 8, P["shadow"])
        # an ore crumb leaving through the chute (motion cue, 1 px per frame)
        x = 12 + f
        s.px(x, 7, P["iron2"])
        s.px(x, 8, P["iron1"])
        drill_head(s, P, cx, cy, f)
    return s


def smelter(P):
    s = new(16, 16, P, frames=4, ms=160)
    for f in range(4):
        s.frame(f + 1)
        box(s, P, 1, 1, 14, 14, "copper0", "copper1", "shadow", hi="copper2", chamfer=2)
        # steel hoops
        s.line(2, 4, 13, 4, P["hull1"])
        s.line(2, 11, 13, 11, P["hull0"])
        s.px(2, 4, P["hull2"])
        # chimney with an ember that breathes
        blit(s, P, 3, 6, [".##.", "#ss#", "#ss#", ".##."])
        s.px(4, 8, P["glow"] if f in (0, 2) else P["copper0"])
        s.px(5, 7, P["copper0"] if f == 1 else P["shadow"])
        # the mouth on the output side
        blit(s, P, 9, 5, [
            "..####",
            ".#xxxx",
            "#xxxxx",
            "#xxxxx",
            ".#xxxx",
            "..####",
        ])
        core = [
            [(12, 7), (13, 7), (12, 8), (13, 8), (11, 8), (14, 8)],
            [(12, 7), (13, 7), (12, 8), (11, 7)],
            [(12, 7), (13, 7), (12, 8), (13, 8), (11, 8), (11, 7), (14, 7), (14, 8)],
            [(12, 8), (13, 7), (12, 7), (13, 8)],
        ][f]
        for x, y in core:
            s.px(x, y, P["hot"])
        # light spilling over the lip
        s.px(15, 7, P["glow"])
        s.px(15, 8, P["glow"] if f != 1 else P["copper1"])
    return s


def belt(P):
    s = new(16, 16, P, frames=4, ms=125)
    chev = [0, 1, 1, 2, 1, 1, 0]  # a '>' in the slats, so direction reads even when stopped
    for f in range(4):
        s.frame(f + 1)
        s.line(0, 2, 15, 2, P["ink"])
        s.line(0, 3, 15, 3, P["hull2"])
        s.rect(0, 4, 15, 11, P["hull0"])
        s.line(0, 4, 15, 4, P["shadow"])          # the top rail's shadow on the bed
        s.line(0, 12, 15, 12, P["hull1"])
        s.line(0, 13, 15, 13, P["ink"])
        for base in range(-4, 20, 4):
            for i, y in enumerate(range(5, 12)):
                x = base + f + chev[i]
                if 0 <= x < 16:
                    s.px(x, y, P["shadow"])
        for base in range(-8, 24, 8):              # rail bolts
            x = base + f * 2
            if 0 <= x < 16:
                s.px(x, 3, P["hull1"])
                s.px(x, 12, P["hull0"])
    return s


def module(P, icon="gear"):
    s = new(16, 16, P)
    box(s, P, 0, 0, 15, 15, "brass1", "hot", "brass0", chamfer=1)
    # a second bevel ring so the frame is 2 px thick and bold
    s.line(2, 2, 13, 2, P["brass1"])
    s.line(2, 2, 2, 13, P["brass1"])
    s.line(2, 13, 13, 13, P["brass0"])
    s.line(13, 2, 13, 13, P["brass0"])
    # rivets
    for x, y in ((2, 2), (13, 13)):
        s.px(x, y, P["hot"])
    s.px(13, 2, P["brass0"])
    # recessed well with the main output's icon
    s.rect(3, 3, 12, 12, P["ink"])
    s.rect(4, 4, 11, 11, P["shadow"])
    draw_icon(s, P, icon, 4, 4)
    # the fold: the bottom-left corner is dog-eared, showing the paler back of the sheet
    blit(s, P, 0, 11, [
        "_#..",
        "_#3#",
        "__#3",
        "___#",
        "____",
    ], key={"3": "hot"})
    s.px(1, 11, P["ink"])
    s.px(4, 15, P["ink"])
    return s


FLAG = [
    # Bramble's pennant: lily-pad green with a darker pad (notch and all), two frames of wave
    ["#######.",
     "#llllll#",
     "#lvvlll#",
     "#lvvvll#",
     "#llllv#.",
     "######.."],
    ["######..",
     "#lllll##",
     "#lvvllll#",
     "#lvvvll#",
     "#llllll#",
     ".#######"],
]


def dock(P):
    s = new(32, 32, P, frames=2, ms=320)
    for f in range(2):
        s.frame(f + 1)
        # deck: weathered boardwalk planks
        box(s, P, 1, 4, 30, 30, "hull1", "hull2", "hull0", hi="hull3", chamfer=1)
        for y in range(7, 29, 3):
            s.line(2, y, 29, y, P["hull0"])
        for y, xs in ((6, (9, 21)), (9, (14, 26)), (12, (6, 18)), (15, (11, 24)), (18, (8, 20)),
                      (21, (15, 27)), (24, (5, 17)), (27, (12, 23))):
            for x in xs:
                s.px(x, y, P["hull0"])
        # pilings at the corners
        for px_, py_ in ((1, 3), (28, 3), (1, 28), (28, 28)):
            blit(s, P, px_, py_, ["###", "#2#", "###"])
        # the intake: a brass-rimmed drop grate
        box(s, P, 8, 12, 21, 25, "shadow", "brass1", "brass0", hi="hot", chamfer=0)
        for x, y in ((8, 12), (21, 12), (8, 25), (21, 25)):
            s.px(x, y, P["hull1"])
        s.rect(10, 14, 19, 23, P["ink"])
        for y in range(15, 23, 2):
            s.line(11, y, 18, y, P["hull0"])
        # crates, bottom-right
        box(s, P, 22, 18, 28, 24, "copper1", "copper2", "copper0", chamfer=0)
        s.line(23, 19, 27, 23, P["copper0"])
        box(s, P, 23, 24, 29, 29, "copper1", "copper2", "copper0", chamfer=0)
        s.line(24, 25, 28, 28, P["copper0"])
        # flag pole, top-left
        s.line(4, 1, 4, 12, P["ink"])
        s.line(5, 2, 5, 12, P["hull2"])
        s.px(4, 0, P["brass1"])
        s.px(5, 1, P["brass1"])
        blit(s, P, 6, 1, FLAG[f])
    return s


# ---------------------------------------------------------------------------------------
# Sprite set per candidate
# ---------------------------------------------------------------------------------------

def frames_of(spr):
    return [spr.composite(i + 1) for i in range(spr.n_frames)]


def build_set(P):
    S = {
        "ground": [ground_tile(P, v) for v in range(3)],
        "unowned": unowned_tile(P),
        "ore": ore_patch_tiles(P),
        "miner": miner(P),
        "smelter": smelter(P),
        "belt": belt(P),
        "module_gear": module(P, "gear"),
        "module_plate": module(P, "iron_plate"),
        "dock": dock(P),
        "icons": {n: icon_sprite(P, n) for n in ICON_ORDER},
    }
    return S


def check_palette(P, S):
    """Every pixel of every sprite must be a palette colour."""
    allowed = set(hex2rgba(h)[:3] for h in P.hexes)
    used = set()
    sprites = [S["unowned"], S["miner"], S["smelter"], S["belt"], S["module_gear"],
               S["module_plate"], S["dock"]] + S["ground"] + S["ore"] + list(S["icons"].values())
    for spr in sprites:
        for im in frames_of(spr):
            for r, g, b, a in im.get_flattened_data():
                if a:
                    assert a == 255, "semi-alpha pixel"
                    assert (r, g, b) in allowed, "off-palette %s" % rgba2hex((r, g, b, 255))
                    used.add((r, g, b))
    return used


def sprite_colours(spr):
    cols = set()
    for im in frames_of(spr):
        for r, g, b, a in im.get_flattened_data():
            if a:
                cols.add((r, g, b))
    return len(cols)


def strip(spr):
    fr = frames_of(spr)
    w, h = fr[0].size
    out = Image.new("RGBA", (w * len(fr), h), (0, 0, 0, 0))
    for i, im in enumerate(fr):
        out.alpha_composite(im, (i * w, 0))
    return out


def up(im, k):
    return im.resize((im.width * k, im.height * k), Image.NEAREST) if k != 1 else im


# ---------------------------------------------------------------------------------------
# The mock scene: a 12x7 slice of the Workshop
# ---------------------------------------------------------------------------------------

SCENE_GROUND = [
    "GGGGGGGGGGGU",
    "GOOGGGGGGGGU",
    "GOOGGGGGGGGU",
    "GGGGGGGGGGGU",
    "GOOGGGGGGGGU",
    "GOOGGGGGGGGU",
    "UUUUUUUUUUUU",
]
GROUND_VARIANT = [[(x * 7 + y * 3) % 3 for x in range(12)] for y in range(7)]

# (kind, tx, ty, pip, working, extra)
SCENE_OBJECTS = [
    ("belt", 3, 2, None, True, ("iron_ore", -2)),
    ("belt", 4, 2, None, True, ("iron_ore", 3)),
    ("belt", 6, 2, None, True, ("iron_ingot", -4)),
    ("belt", 7, 2, None, True, None),
    ("belt", 8, 2, None, True, ("iron_ingot", 1)),
    ("belt", 5, 3, None, True, ("gear", 0)),
    ("belt", 6, 3, None, True, None),
    ("belt", 7, 3, None, True, ("gear", -3)),
    ("belt", 8, 3, None, True, ("gear", 5)),
    ("belt", 3, 4, None, False, ("iron_ore", 4)),     # stalled: the smelter is blocked
    ("belt", 5, 4, None, False, None),
    ("belt", 3, 5, None, False, None),                # empty: the miner is unpowered
    ("miner", 2, 2, "pipGreen", True, None),
    ("smelter", 5, 2, "pipGreen", True, None),
    ("module_gear", 4, 3, "pipGreen", True, None),
    ("miner", 2, 4, "pipRed", False, None),
    ("smelter", 4, 4, "pipRed", False, None),
    ("miner", 2, 5, "pipBlue", False, None),
    ("smelter", 4, 5, "pipYellow", False, None),
    ("module_plate", 7, 5, "pipGrey", False, None),
    ("dock", 9, 2, None, True, None),
]


def draw_pip(img, x0, y0, colour, ink):
    """What the game's code will draw: a 4x4 LED in the tile's top-right corner."""
    c = hex2rgba(colour)
    k = hex2rgba(ink)
    for y in range(4):
        for x in range(4):
            if x in (0, 3) and y in (0, 3):
                continue
            img.putpixel((x0 + x, y0 + y), c if (1 <= x <= 2 and 1 <= y <= 2) else k)


def compose_scene(P, S, t):
    """t = scene frame (40 ms each). Items move 1 px per frame, like the belt treads."""
    W, H = 12 * 16, 7 * 16
    img = Image.new("RGBA", (W, H), hex2rgba(P["ink"]))
    gr = [frames_of(g)[0] for g in S["ground"]]
    ore = [frames_of(o)[0] for o in S["ore"]]
    un = frames_of(S["unowned"])[0]
    for ty, row in enumerate(SCENE_GROUND):
        for tx, ch in enumerate(row):
            v = GROUND_VARIANT[ty][tx]
            o = ore[(tx % 2) + 2 * (ty % 2)]
            img.alpha_composite({"G": gr[v], "O": o, "U": un}[ch], (tx * 16, ty * 16))
    cache = {k: frames_of(S[k]) for k in ("miner", "smelter", "belt", "module_gear", "module_plate", "dock")}
    icons = {n: frames_of(sp)[0] for n, sp in S["icons"].items()}
    ms = {"miner": 80, "smelter": 160, "module_gear": 1000, "module_plate": 1000, "dock": 320}  # all divide the 640 ms loop
    # belts first, then items, then buildings, then pips
    for kind, tx, ty, pip, working, extra in SCENE_OBJECTS:
        if kind != "belt":
            continue
        fr = cache["belt"][(t % 4) if working else 0]
        img.alpha_composite(fr, (tx * 16, ty * 16))
    for kind, tx, ty, pip, working, extra in SCENE_OBJECTS:
        if kind == "belt" and extra:
            name, off = extra
            o = off + (t if working else 0)
            o = ((o + 8) % 16) - 8
            img.alpha_composite(icons[name], (tx * 16 + 4 + o, ty * 16 + 4))
    for kind, tx, ty, pip, working, extra in SCENE_OBJECTS:
        if kind == "belt":
            continue
        frs = cache[kind]
        i = (t * 40 // ms[kind]) % len(frs) if working else 0
        img.alpha_composite(frs[i], (tx * 16, ty * 16))
    for kind, tx, ty, pip, working, extra in SCENE_OBJECTS:
        if pip:
            draw_pip(img, tx * 16 + 12, ty * 16, P[pip], P["ink"])
    return img


# ---------------------------------------------------------------------------------------
# Contact sheet
# ---------------------------------------------------------------------------------------

def font(size, bold=False):
    for name in (("consolab.ttf" if bold else "consola.ttf"), "arial.ttf"):
        try:
            return ImageFont.truetype("C:/Windows/Fonts/" + name, size)
        except OSError:
            pass
    return ImageFont.load_default()


F_TITLE, F_LABEL, F_SMALL = font(22, True), font(13), font(11)
SHEET_BG = (44, 44, 48)
TEXT = (230, 230, 226)
DIM = (160, 160, 156)
COL_W = 600


def ground_bg(P, S, w, h, k):
    """The candidate's own floor behind a sprite, so each one is judged in context."""
    g = up(frames_of(S["ground"][0])[0], k)
    bg = Image.new("RGBA", (w, h))
    for y in range(0, h, g.height):
        for x in range(0, w, g.width):
            bg.alpha_composite(g, (x, y))
    return bg


def column(key, P, S):
    col = Image.new("RGBA", (COL_W, 2400), SHEET_BG + (255,))
    d = ImageDraw.Draw(col)
    y = 0
    d.text((0, y), "%s  %s" % (key, P.title), font=F_TITLE, fill=TEXT)
    y += 28
    cand = CANDIDATES[key]
    d.text((0, y), cand["blurb"], font=F_SMALL, fill=DIM)
    y += 20

    # --- swatches with names
    cw, ch = 74, 20
    for i, n in enumerate(P.order):
        cx, cy = (i % 8) * cw, y + (i // 8) * (ch + 16)
        d.rectangle([cx, cy, cx + cw - 3, cy + ch - 1], fill=hex2rgba(P[n])[:3])
        d.text((cx, cy + ch + 1), n, font=F_SMALL, fill=TEXT)
    y += 4 * (ch + 16) + 6

    # --- status pips: colour, OKLab lightness, deutan, protan, lightness only
    pips = ["pipGreen", "pipYellow", "pipRed", "pipGrey", "pipBlue"]
    d.text((0, y), "status pips (5x): colour / deuteranopia / protanopia / lightness only", font=F_SMALL, fill=DIM)
    y += 16
    rows = [("colour", lambda c: c), ("deutan", lambda c: cvd_rgb(c, "deutan")),
            ("protan", lambda c: cvd_rgb(c, "protan")),
            ("L only", lambda c: (int(L(rgba2hex(tuple(c) + (255,))) * 255),) * 3)]
    for ri, (lab, fn) in enumerate(rows):
        d.text((0, y + 8), lab, font=F_SMALL, fill=DIM)
        for pi, pn in enumerate(pips):
            c = fn(hex2rgba(P[pn])[:3])
            px0 = 60 + pi * 100
            pip = Image.new("RGBA", (4, 4), (0, 0, 0, 0))
            draw_pip(pip, 0, 0, rgba2hex(tuple(c) + (255,)), P["ink"])
            # on a hull-coloured square like a machine corner
            base = Image.new("RGBA", (6, 6), hex2rgba(P["hull1"]))
            base.alpha_composite(pip, (1, 1))
            col.alpha_composite(up(base, 5), (px0, y))
            if ri == 0:
                d.text((px0 + 34, y + 2), pn[3:], font=F_SMALL, fill=TEXT)
                d.text((px0 + 34, y + 15), "L %.2f" % L(P[pn]), font=F_SMALL, fill=TEXT)
        y += 34
    y += 4

    # --- 1x lineup on the candidate's floor
    d.text((0, y), "1x  (on its own floor)", font=F_LABEL, fill=TEXT)
    y += 18
    belt_items = []
    for n in ("iron_ore", "iron_ingot", "gear"):
        b = frames_of(S["belt"])[0].copy()
        b.alpha_composite(frames_of(S["icons"][n])[0], (4, 4))
        belt_items.append(b)
    lineup = ([frames_of(S["ground"][0])[0], frames_of(S["ore"][0])[0], frames_of(S["unowned"])[0],
               frames_of(S["miner"])[0], frames_of(S["smelter"])[0]] + belt_items +
              [frames_of(S["module_gear"])[0], frames_of(S["dock"])[0]])
    lw = sum(im.width for im in lineup) + 4 * (len(lineup) + 1)
    strip_img = ground_bg(P, S, lw, 40, 1)
    x = 4
    for im in lineup:
        strip_img.alpha_composite(im, (x, 4))
        x += im.width + 4
    col.alpha_composite(strip_img, (0, y))
    y += 46

    # --- 4x sections
    def section(label, imgs, k=4, gap=6):
        nonlocal y
        d.text((0, y), label, font=F_LABEL, fill=TEXT)
        y += 18
        x = 0
        hmax = 0
        for im in imgs:
            big = up(im, k)
            if x + big.width > COL_W:
                x = 0
                y += hmax + gap
                hmax = 0
            bg = ground_bg(P, S, big.width, big.height, k)
            bg.alpha_composite(big)
            col.alpha_composite(bg, (x, y))
            x += big.width + gap
            hmax = max(hmax, big.height)
        y += hmax + 10

    patch = Image.new("RGBA", (32, 32))
    for i, o in enumerate(S["ore"]):
        patch.alpha_composite(frames_of(o)[0], ((i % 2) * 16, (i // 2) * 16))
    section("4x  floor / ore patch (2x2) / not owned / module (gear, plate)",
            [frames_of(S["ground"][0])[0], patch, frames_of(S["unowned"])[0],
             frames_of(S["module_gear"])[0], frames_of(S["module_plate"])[0]])
    section("4x  Miner Mk1, 4 frames (cutter turns 30 deg/frame, ore crumb leaves the chute)",
            frames_of(S["miner"]))
    m0 = frames_of(S["miner"])[0]
    rots = [m0, m0.transpose(Image.ROTATE_90), m0.transpose(Image.ROTATE_180), m0.transpose(Image.ROTATE_270)]
    section("2x  the game's 90-degree rotations (output right / up / left / down)", rots, k=2)
    section("4x  Smelter Mk1, 4 frames (mouth flicker)", frames_of(S["smelter"]))
    bf = frames_of(S["belt"])
    belts4 = []
    for i, n in enumerate(("iron_ore", "iron_ingot", "gear", None)):
        b = bf[i].copy()
        if n:
            b.alpha_composite(frames_of(S["icons"][n])[0], (4, 4))
        belts4.append(b)
    section("4x  belt, 4 frames, carrying iron ore / iron ingot / gear", belts4)
    section("4x  Dock (2x2), 2 frames", frames_of(S["dock"]))
    section("4x  item icons: the 3 above + the other families (draft)",
            [frames_of(S["icons"][n])[0] for n in ICON_ORDER], k=4, gap=8)

    # --- scene
    sc = compose_scene(P, S, 0)
    d.text((0, y), "scene 1x  |  deuteranopia 1x  |  lightness only 1x", font=F_LABEL, fill=TEXT)
    y += 18
    col.alpha_composite(sc, (0, y))
    col.alpha_composite(cvd_image(sc, "deutan").convert("RGBA"), (204, y))
    col.alpha_composite(lightness_image(sc).convert("RGBA"), (408, y))
    y += sc.height + 10
    d.text((0, y), "scene 3x", font=F_LABEL, fill=TEXT)
    y += 18
    col.alpha_composite(up(sc, 3), (0, y))
    y += sc.height * 3 + 6
    for line in ("top line: miner -> smelter -> Dock, all working (green); gear module feeding the Dock",
                 "3rd row: smelter blocked by slag (red), its ore belt stalled; miner blocked too (red)",
                 "4th row: miner unpowered (blue), so its smelter is starved (yellow)",
                 "bottom: a plate module with nothing connected (grey: an unlit LED)",
                 "right column and bottom row: land you don't own"):
        d.text((0, y), line, font=F_SMALL, fill=DIM)
        y += 14
    y += 6
    return col.crop((0, 0, COL_W, y))


# ---------------------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------------------

def checks(sheet):
    """Working images for the critique loops (out/check_*.png); regenerated every build."""
    P = Pal(CANDIDATES["A"])
    S = build_set(P)
    names = ["miner", "smelter", "module_gear", "dock"]
    ims = [frames_of(S[n])[0] for n in names]
    sil = Image.new("RGB", (sum(i.width for i in ims) + 4 * (len(ims) + 1), 36), (232, 228, 218))
    x = 4
    for im in ims:
        m = Image.new("RGB", im.size, (232, 228, 218))
        px = im.load()
        for yy in range(im.height):
            for xx in range(im.width):
                if px[xx, yy][3]:
                    m.putpixel((xx, yy), (34, 36, 46))
        sil.paste(m, (x, 2))
        x += im.width + 4
    up(sil, 6).save(OUT / "check_silhouettes.png")
    rows = []
    for k in CANDIDATES:
        P = Pal(CANDIDATES[k])
        S = build_set(P)
        g = frames_of(S["ground"][0])[0]
        row = Image.new("RGBA", (16 * 3 + 8, 16))
        for i, im in enumerate([frames_of(S["miner"])[0], frames_of(S["smelter"])[0], frames_of(S["module_gear"])[0]]):
            bg = g.copy()
            bg.alpha_composite(im)
            row.alpha_composite(bg, (i * 20, 0))
        rows.append(row)
    out = Image.new("RGBA", (rows[0].width * 8, 16 * 8 * 2 + 8), (40, 40, 40, 255))
    for i, r in enumerate(rows):
        out.alpha_composite(up(r, 8), (0, i * (128 + 8)))
    out.save(OUT / "check_machines_8x.png")
    half = (sheet.width - 3 * 40) // 2
    sheet.crop((40, 440, 40 + half, 1140)).save(OUT / "check_A_4x.png")
    sheet.crop((80 + half, 440, 80 + 2 * half, 1140)).save(OUT / "check_B_4x.png")
    P = Pal(CANDIDATES["A"])
    S = build_set(P)
    crop = (96, 96, 384, 192)
    w, h = crop[2] - crop[0], crop[3] - crop[1]
    strip_ = Image.new("RGB", (w * 2 + 8, h * 2 + 8), (40, 40, 40))
    for i, t in enumerate((0, 1, 2, 15)):
        fr = up(compose_scene(P, S, t), 3).convert("RGB").crop(crop)
        strip_.paste(fr, ((i % 2) * (w + 8), (i // 2) * (h + 8)))
    strip_.save(OUT / "check_gif_frames_A.png")


def main():
    OUT.mkdir(exist_ok=True)
    cols = []
    report = {}
    for key, cand in CANDIDATES.items():
        P = Pal(cand)
        S = build_set(P)
        used = check_palette(P, S)
        od = OUT / key
        od.mkdir(exist_ok=True)
        with open(HERE / ("palette_%s.json" % key), "w") as fh:
            json.dump([{"name": n, "hex": P[n]} for n in P.order], fh, indent=1)
        sizes = {}
        for name in ("miner", "smelter", "belt", "module_gear", "module_plate", "dock", "unowned"):
            spr = S[name]
            strip(spr).save(od / ("%s.png" % name))
            spr.preview(str(od / ("%s_8x.png" % name)), scale=8, bg=P["ground1"])
            sizes[name] = (spr.w, spr.h, spr.n_frames, sprite_colours(spr))
        for i, g in enumerate(S["ground"]):
            strip(g).save(od / ("ground_%d.png" % i))
        for i, o in enumerate(S["ore"]):
            strip(o).save(od / ("ore_patch_%d.png" % i))
        ore_patch(P).save_png(str(od / "ore_patch_2x2.png"))
        sizes["ore_patch"] = (16, 16, 1, sprite_colours(S["ore"][0]))
        icons = Image.new("RGBA", (8 * len(ICON_ORDER), 8))
        for i, n in enumerate(ICON_ORDER):
            icons.alpha_composite(frames_of(S["icons"][n])[0], (i * 8, 0))
            sizes["icon_" + n] = (8, 8, 1, sprite_colours(S["icons"][n]))
        icons.save(od / "items.png")
        up(icons, 8).save(od / "items_8x.png")
        sc = compose_scene(P, S, 0)
        sc.save(od / "scene_1x.png")
        up(sc, 3).save(od / "scene_3x.png")
        cvd_image(up(sc, 3), "deutan").save(od / "scene_3x_deutan.png")
        cvd_image(up(sc, 3), "protan").save(od / "scene_3x_protan.png")
        lightness_image(up(sc, 3)).save(od / "scene_3x_lightness.png")
        gif = [up(compose_scene(P, S, t), 3).convert("RGB") for t in range(16)]
        gif[0].save(od / "scene.gif", save_all=True, append_images=gif[1:], duration=40, loop=0)
        cols.append(column(key, P, S))
        report[key] = {"palette_used": len(used), "sizes": sizes}
        print("== %s %s: %d of %d palette colours used across the set" % (key, P.title, len(used), len(P.order)))
        pips = ["pipGreen", "pipYellow", "pipRed", "pipGrey", "pipBlue"]
        for pn in pips:
            print("   %-9s %s  L=%.3f" % (pn, P[pn], L(P[pn])))
        for kind in ("none", "deutan", "protan", "tritan"):
            worst = (9, None)
            for i in range(len(pips)):
                for j in range(i + 1, len(pips)):
                    a, b = hex2rgba(P[pips[i]])[:3], hex2rgba(P[pips[j]])[:3]
                    if kind != "none":
                        a, b = cvd_rgb(a, kind), cvd_rgb(b, kind)
                    e = dE(a, b)
                    if e < worst[0]:
                        worst = (e, pips[i] + "/" + pips[j])
            print("   min pip dE (OKLab) %-6s %.3f  %s" % (kind, worst[0], worst[1]))
        for name, v in sizes.items():
            print("   %-18s %dx%d  frames %d  colours %d" % ((name,) + v))
    gap = 40
    W = sum(c.width for c in cols) + gap * (len(cols) + 1)
    H = max(c.height for c in cols) + 60
    sheet = Image.new("RGBA", (W, H), SHEET_BG + (255,))
    d = ImageDraw.Draw(sheet)
    d.text((gap, 14), "Foldworks palette test  -  same sprites, two palettes  -  pick one", font=F_TITLE, fill=TEXT)
    x = gap
    for c in cols:
        sheet.alpha_composite(c, (x, 50))
        x += c.width + gap
    sheet.convert("RGB").save(HERE / "contact.png")
    print("contact.png", sheet.size)
    checks(sheet)
    with open(OUT / "report.json", "w") as fh:
        json.dump(report, fh, indent=1)


if __name__ == "__main__":
    main()
