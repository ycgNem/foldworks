"""Ground tiles (Workshop earth, ore deposits, Factory plate) and the belts and trunks.

Belts are drawn from a distance field: d = distance from the item path, s = distance along it.
A straight belt's path is y = 8; a turn's path is the L from the top edge's middle to the right
edge's middle (the exact path the game moves items on), so items never hang off the bed. The
chevron phase uses the angle about the inner corner, so slats fan smoothly round the curve and
meet the straight belts' slats at both edges.
"""
import math
from fw import new, mk, blit, export, c, lump, ring_of, Image

# --------------------------------------------------------------------------- Workshop floor

# pebbles: (x, y) top-left of a 2-px pebble (lit top-left, shade below-right)
FLOOR_VARIANTS = [
    {"pebbles": [(4, 5), (10, 10)], "specks": [(11, 4), (6, 12), (13, 8)], "dark": [(8, 7), (3, 10)], "crack": None},
    {"pebbles": [(9, 4)], "specks": [(4, 9), (12, 12)], "dark": [(5, 4), (11, 9), (7, 12)],
     "crack": [(3, 12), (4, 12), (5, 11), (6, 11), (7, 10)]},
    {"pebbles": [(5, 10), (11, 6)], "specks": [(8, 3), (3, 6)], "dark": [(12, 11), (7, 7)], "crack": None},
    {"pebbles": [(7, 8)], "specks": [(3, 4), (12, 4), (10, 12), (4, 12)], "dark": [(10, 6)],
     "crack": [(11, 2), (11, 3), (12, 4), (12, 5)]},
]


def draw_floor(s, v):
    V = FLOOR_VARIANTS[v]
    s.rect(0, 0, 15, 15, c("ground1"))
    # a faint plus where four tiles meet, so placement reads (each tile draws its share)
    for x, y in ((0, 0), (1, 0), (0, 1), (15, 0), (0, 15)):
        s.px(x, y, c("ground0"))
    for x, y in V["dark"]:
        s.px(x, y, c("ground0"))
    for x, y in V["specks"]:
        s.px(x, y, c("ground2"))
    for x, y in V["pebbles"]:
        s.px(x, y, c("ground2"))
        s.px(x + 1, y, c("ground2"))
        s.px(x, y + 1, c("ground2"))
        s.px(x + 1, y + 1, c("ground0"))
        s.px(x + 2, y + 1, c("ground0"))
        s.px(x + 1, y + 2, c("ground0"))
    if V["crack"]:
        for x, y in V["crack"]:
            s.px(x, y, c("ground0"))


def floor_tiles():
    return mk(16, 16, 4, draw_floor)


# --------------------------------------------------------------------------- ore deposits
# A deposit is one 32x32 drawing cut into quadrants (top-left, top-right, bottom-left,
# bottom-right), so lumps cross the inner seams and the patch never reads as a stamp.

STAIN_R = 6


def stain(s, col="ground0"):
    R = STAIN_R
    for y in range(32):
        for x in range(32):
            cx = min(max(x, R), 31 - R)
            cy = min(max(y, R), 31 - R)
            dd = (x - cx) ** 2 + (y - cy) ** 2
            if dd > R * R:
                continue
            edge = x in (0, 31) or y in (0, 31) or dd > (R - 1) ** 2
            if edge and (x + y) % 2:
                continue
            s.px(x, y, c(col))


IRON_LUMPS = [
    (28, 5, 1.7, 1.4), (17, 6, 2.5, 2.0), (9, 8, 3.4, 2.8), (24, 9.5, 3.2, 2.6),
    (5.5, 15, 2.2, 1.8), (15, 15, 3.6, 3.0), (24, 18, 2.6, 2.2), (9, 22, 3.1, 2.5),
    (19, 23.5, 2.4, 2.0), (26, 25.5, 3.0, 2.4), (5, 26.5, 1.8, 1.5), (14, 28, 2.1, 1.6),
]
COPPER_LUMPS = [
    (8, 6, 3.0, 2.4), (20, 5, 2.2, 1.8), (27, 8, 2.0, 1.7), (14, 12, 3.8, 3.0),
    (5, 16, 2.0, 1.7), (24, 16, 3.3, 2.7), (11, 21, 2.6, 2.1), (19, 24, 3.4, 2.7),
    (6, 26, 2.4, 1.9), (27, 26, 2.0, 1.7), (14, 28.5, 1.8, 1.4),
]
COAL_LUMPS = [
    (7, 7, 3.2, 2.6), (18, 6, 2.6, 2.1), (26, 9, 2.8, 2.3), (12, 14, 2.4, 2.0),
    (21, 15, 3.6, 2.9), (5, 19, 2.6, 2.1), (13, 22, 3.2, 2.6), (24, 24, 3.0, 2.5),
    (6, 27, 2.0, 1.6), (17, 28, 1.9, 1.5), (28, 18, 1.6, 1.4),
]


def _crag(pts, cx, cy, seed):
    """Knock a few rim pixels off a lump so it reads as a nugget, not a pebble."""
    out = dict(pts)
    for i, (x, y) in enumerate(sorted(pts)):
        rim = any((x + dx, y + dy) not in pts for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)))
        if rim and ((x * 7 + y * 13 + seed) % 5 == 0):
            out.pop((x, y), None)
    return out


def iron_patch():
    s = new(32, 32)
    stain(s)
    for cx, cy, rx, ry in IRON_LUMPS:
        lump(s, cx, cy, rx, ry, ("iron0", "iron1", "iron2"), glint="hull3")
    # rust flecks: iron ore is rusty (items.ts flavour), a warm note in the blue
    for x, y in ((11, 9), (25, 11), (16, 17), (10, 24), (27, 27)):
        s.px(x, y, c("copper0"))
    return s


def copper_patch():
    s = new(32, 32)
    stain(s)
    for i, (cx, cy, rx, ry) in enumerate(COPPER_LUMPS):
        lump(s, cx, cy, rx, ry, ("copper0", "copper1", "copper2"), glint="hot")
    # verdigris: green-blue crust on the shaded side of the bigger nuggets
    for x, y in ((9, 8), (10, 7), (15, 14), (16, 14), (16, 13), (25, 18), (26, 17), (20, 26), (21, 25), (7, 27)):
        s.px(x, y, c("teal1"))
    for x, y in ((10, 8), (17, 14), (26, 18), (21, 26)):
        s.px(x, y, c("teal0"))
    return s


def coal_patch():
    s = new(32, 32)
    stain(s, "shadow")
    for cx, cy, rx, ry in COAL_LUMPS:
        pts = lump(s, cx, cy, rx, ry, ("ink", "shadow", "hull0"), glint="hull3")
        # facets: a steel glint next to the highlight, so coal shines
        if rx >= 2.4 and pts:
            bx, by = max(pts.items(), key=lambda kv: kv[1])[0]
            s.px(bx + 1, by, c("hull1"))
            s.px(bx, by + 1, c("hull1"))
    return s


SAND_MOUNDS = [
    # (cx, cy, rx, ry): soft dunes, back to front; earth shows round the edges
    (16, 5, 6.5, 3.6), (8, 9, 6.0, 4.6), (23, 10, 6.4, 4.8), (14, 16, 8.0, 5.6),
    (6, 22, 5.0, 4.0), (25, 22, 5.6, 4.6), (15, 26, 7.0, 4.2),
]


def sand_patch():
    s = new(32, 32)
    stain(s)
    owned = {}
    for cx, cy, rx, ry in SAND_MOUNDS:
        pts = {}
        for y in range(32):
            for x in range(32):
                u, v = (x + 0.5 - cx) / rx, (y + 0.5 - cy) / ry
                if u * u + v * v <= 1.0:
                    pts[(x, y)] = (-(u + v) * 0.7071, v)
        # a soft dark rim (earth-brown, not ink): sand has no hard edge
        for p in ring_of(set(pts)):
            if p not in owned and 0 <= p[0] < 32 and 0 <= p[1] < 32:
                s.px(p[0], p[1], c("ground0"))
        for (x, y), (k, v) in pts.items():
            col = "bone" if k > 0.62 else ("hull3" if k > -0.35 else "ground2")
            s.px(x, y, c(col))
            owned[(x, y)] = True
        # wind ripples across each dune: a shade line under a crest line
        for x in range(int(cx - rx) + 1, int(cx + rx)):
            y = int(round(cy + 0.15 * ry + 1.0 * math.sin((x + cx) * 0.7)))
            if (x, y) in pts and (x, y - 1) in pts and pts[(x, y)][0] > -0.5 and (x + int(cy)) % 7:
                s.px(x, y, c("ground2"))
    # grains and pebbles
    for x, y in ((9, 6), (20, 9), (12, 13), (27, 15), (5, 20), (18, 21), (23, 26), (11, 27)):
        if (x, y) in owned:
            s.px(x, y, c("ground2"))
    for x, y in ((25, 7), (7, 17), (19, 28)):
        s.px(x, y, c("hull1"))
        s.px(x + 1, y, c("hull0"))
    return s


def quadrants(patch):
    whole = patch.composite(1)
    out = new(16, 16, 4)
    for i in range(4):
        out.frame(i + 1)
        q = whole.crop(((i % 2) * 16, (i // 2) * 16, (i % 2) * 16 + 16, (i // 2) * 16 + 16))
        out._img().alpha_composite(q)
    out.frame(1)
    return out


def with_floor_under(patch, variant_fn=None):
    """Ore tiles are opaque ground tiles: floor first, the deposit on top."""
    base = new(32, 32)
    for i in range(4):
        t = new(16, 16)
        draw_floor(t, (i * 3) % 4)
        base._img().alpha_composite(t.composite(1), ((i % 2) * 16, (i // 2) * 16))
    base._img().alpha_composite(patch.composite(1))
    return base


# --------------------------------------------------------------------------- Factory floor

def draw_factory(s, v):
    s.rect(0, 0, 15, 15, c("hull0"))
    # seams on the top and left: each tile is one plate
    s.line(0, 0, 15, 0, c("shadow"))
    s.line(0, 0, 0, 15, c("shadow"))
    s.line(1, 1, 15, 1, c("hull1"))
    s.line(1, 1, 1, 15, c("hull1"))
    # tread: short diagonal dashes, a calm texture
    for y in range(3, 14, 4):
        for x in range(3 + (y // 4 % 2) * 2, 14, 4):
            if 3 <= x <= 12:
                s.px(x, y, c("shadow"))
                s.px(x + 1, y - 1 if (x // 2) % 2 else y + 1, c("shadow"))
    for x, y in ((2, 2), (13, 2), (2, 13), (13, 13)):
        s.px(x, y, c("hull2"))
        s.px(x + 1, y + 1, c("ink"))
    if v == 1:
        # a drain grate in the middle
        s.rect(5, 5, 10, 10, c("ink"))
        for y in (6, 8, 10):
            s.line(6, y, 9, y, c("shadow"))
        s.line(5, 5, 10, 5, c("shadow"))
        s.line(10, 6, 10, 10, c("hull1"))
        s.line(5, 10, 10, 10, c("hull1"))


def factory_tiles():
    return mk(16, 16, 2, draw_factory)


# --------------------------------------------------------------------------- belts

def straight_field(px, py, cl=8.0):
    return abs(py - cl), px


def turn_field(px, py):
    """Distance from the L path (8,0)->(8,8)->(16,8); s from the angle about (16,0)."""
    if px <= 8 and py >= 8:
        d = math.hypot(px - 8, py - 8)
    elif px <= 8:
        d = 8 - px
    elif py >= 8:
        d = py - 8
    else:
        d = min(px - 8, 8 - py)
    r = math.hypot(16 - px, py)
    # union with the true quarter-circle belt about (16, 0): rounds the inner corner, and
    # agrees with the L at both tile edges, so straight neighbours still meet seamlessly
    d = min(d, abs(8 - r))
    s = 16 * math.atan2(py, 16 - px) / (math.pi / 2)
    return d, s


def draw_belt(s, f, field, size=16):
    for y in range(size):
        for x in range(size):
            d, sp = field(x + 0.5, y + 0.5)
            if d >= 6:
                continue
            if d >= 5:
                s.px(x, y, c("ink"))
                continue
            if d >= 4:
                # rails: static, bolts every 8 px
                bolt = (sp % 8) < 1
                s.px(x, y, c("hull3") if bolt else c("hull2"))
                continue
            if d >= 3:
                s.px(x, y, c("shadow"))
                continue
            off = 2 - int(d)
            q = (sp - 2 * f - off) % 8
            if q < 1:
                col = "hull1"
            elif q < 2:
                col = "hull2"
            elif q < 3:
                col = "shadow"
            else:
                col = "hull0"
            s.px(x, y, c(col))


def belt():
    return mk(16, 16, 4, lambda s, f: draw_belt(s, f, lambda px, py: straight_field(px, py)))


def belt_turn():
    return mk(16, 16, 4, lambda s, f: draw_belt(s, f, turn_field))


def draw_trunk(s, f, field):
    for y in range(16):
        for x in range(16):
            d, sp = field(x + 0.5, y + 0.5)
            if d >= 8:
                continue
            if d >= 7:
                s.px(x, y, c("ink"))
                continue
            if d >= 6:
                rivet = (sp % 8) < 1
                s.px(x, y, c("hot") if rivet else c("brass1"))
                continue
            if d >= 5:
                s.px(x, y, c("brass0"))
                continue
            # rollers across the bed (period 4) under a fast double chevron (period 16)
            rq = (sp - f) % 4
            roll = "hull1" if rq < 2 else "hull0"
            off = 3 - int(d)
            q = (sp - 4 * f - off) % 16
            if d < 4 and (q < 2 or 5 <= q < 7):
                roll = "brass1" if (q < 1 or 5 <= q < 6) else "hot"
            s.px(x, y, c(roll))


def trunk():
    return mk(16, 16, 4, lambda s, f: draw_trunk(s, f, lambda px, py: straight_field(px, py)))


def trunk_turn():
    return mk(16, 16, 4, lambda s, f: draw_trunk(s, f, turn_field))


def build():
    export("tile_floor", floor_tiles(), 0, preview_bg=None)
    for name, fn in (("iron", iron_patch), ("copper", copper_patch), ("coal", coal_patch), ("sand", sand_patch)):
        export("tile_ore_" + name, quadrants(with_floor_under(fn())), 0, preview_bg=None)
    export("tile_factory", factory_tiles(), 0, preview_bg=None)
    export("belt", belt(), 16)
    export("belt_turn", belt_turn(), 16)
    export("trunk", trunk(), 16, preview_bg="factory")
    export("trunk_turn", trunk_turn(), 16, preview_bg="factory")
