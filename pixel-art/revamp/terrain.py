"""Lantern Bayou ground: the Workshop deck, the water and its deck edge, ore deposits, the Factory
plate, belts and trunks. All hand-built (pixel-art-studio rules): the deck is geometry, and a
generated tileset would not tile with itself across four random variants. The water and bank
colours come from phase 1's PixelLab bayou tileset (revamp-test/raw/B_water_grass.png).

Light from the top-left. The deck is a raised boardwalk over the bayou: its edge tiles
(tile_shore, drawn on the water next to the floor) show plank ends and pilings in the water.
"""
import math

from common import P, T, new, draw, rect, export, rng, rgb, get
from PIL import Image


# ---------------------------------------------------------------- the deck (tile_floor)
# Wide boards (8 px, two per tile) running east-west; soft seams (wood2 on wood3, never ink) so
# belts and machines out-read the floor. Each variant puts board ends in other places.
DECK = [
    {"ends": [], "knots": [(10, 3)], "grain": 1},
    {"ends": [], "knots": [(4, 11)], "grain": 2},
    {"ends": [(11, 1)], "knots": [], "grain": 3},
    {"ends": [(4, 0)], "knots": [], "grain": 4},
]


def deck_tile(v):
    V = DECK[v]
    r = rng(100 + V["grain"])
    img = new(T, T)
    rect(img, 0, 0, 15, 15, P["wood3"])
    for b in (0, 1):
        y0 = b * 8
        # the gap under each board, and a lit pixel or two on its top edge
        for x in range(16):
            draw(img, [(x, y0 + 7)], P["wood2"])
        draw(img, [((v * 5 + b * 9 + k) % 16, y0) for k in range(3)], P["wood4"])
        # grain: one long thin dash per board
        gx, gy, n = r.randrange(16), y0 + r.choice((2, 3, 4)), r.randint(4, 7)
        draw(img, [((gx + i) % 16, gy) for i in range(n)], P["wood2"])
    for ex, b in V["ends"]:
        y0 = b * 8
        for y in range(y0, y0 + 7):
            draw(img, [(ex, y)], P["wood2"])
        draw(img, [(ex + 1, y0 + 1), (ex + 1, y0 + 5)], P["wood1"])
    for kx, ky in V["knots"]:
        draw(img, [(kx, ky), (kx + 1, ky)], P["wood2"])
        draw(img, [(kx, ky - 1)], P["wood4"])
    # a faint corner mark where four tiles meet, so placement reads
    draw(img, [(0, 0), (15, 0), (0, 15)], P["wood2"])
    return img


# ---------------------------------------------------------------- ore deposits (32x32 in quadrants)
ORES = {
    # pocket, lump dark, mid, light, glint, accent (and its chance)
    "iron": (P["earth0"], P["iron0"], P["iron1"], P["iron2"], P["steel4"], P["copper1"], 0.25),
    "copper": (P["earth0"], P["copper0"], P["copper1"], P["copper2"], P["copper3"], P["teal"], 0.45),
    "coal": (P["earth0"], P["ink"], P["ink2"], P["steel1"], P["steel3"], P["lamp1"], 0.12),
    "sand": (P["earth1"], P["wood3"], P["wood4"], P["wood5"], P["bone"], P["earth2"], 0.0),
}


def deposit(kind):
    """One 32x32 deposit, seamless with itself (lumps wrap), on dark earth broken by deck boards."""
    pocket, d0, d1, d2, glint, acc, pacc = ORES[kind]
    S = 32
    img = new(S, S)
    r = rng({"iron": 1, "copper": 2, "coal": 3, "sand": 4}[kind])
    # bed: dark earth with a grain of lighter grit
    for y in range(S):
        for x in range(S):
            draw(img, [(x, y)], P["earth1"] if (x * 7 + y * 13) % 11 else P["earth2"])
    lumps = []
    for gy in range(0, S, 8):
        for gx in range(0, S, 8):
            if r.random() < 0.2:
                continue
            lumps.append((gx + 3 + r.randint(-1, 1) + (gy // 8 % 2) * 4, gy + 3 + r.randint(-1, 1),
                          r.choice((4, 5, 5, 6)) if kind != "sand" else r.choice((5, 6, 6))))

    def wrap(pts):
        return [(x % S, y % S) for x, y in pts]

    for x, y, s in lumps:   # pockets (shadow round each lump, offset down-right)
        pts = [(x + i, y + j) for j in range(-s // 2, s // 2 + 2) for i in range(-s // 2, s // 2 + 2)
               if ((i - 0.5) / (s / 2 + 0.9)) ** 2 + ((j - 0.7) / (s / 2 + 0.6)) ** 2 <= 1]
        draw(img, wrap(pts), pocket)
    for x, y, s in lumps:
        body = [(x + i, y + j) for j in range(-s // 2, s // 2 + 1) for i in range(-s // 2, s // 2 + 1)
                if (i / (s / 2 + 0.4)) ** 2 + (j / (s / 2 + 0.2)) ** 2 <= 1]
        draw(img, wrap(body), d1)
        draw(img, wrap([(px, py) for px, py in body if (px - x) + (py - y) >= s // 2]), d0)
        draw(img, wrap([(px, py) for px, py in body if (px - x) + (py - y) <= -(s // 2)]), d2)
        draw(img, wrap([(x - s // 2 + 1, y - s // 2 + 1)]), glint)
        if r.random() < pacc:
            draw(img, wrap([(x + 1, y)]), acc)
    if kind == "sand":     # sand is drifts, not rocks: ripple lines across
        for y in range(2, S, 6):
            for x in range(S):
                if (x + y * 3) % 9 < 5:
                    draw(img, [(x, (y + (x // 6) % 2) % S)], P["wood5"])
    return img


def quadrants(img):
    return [img.crop((0, 0, 16, 16)), img.crop((16, 0, 32, 16)), img.crop((0, 16, 16, 32)), img.crop((16, 16, 32, 32))]


# ---------------------------------------------------------------- water and the deck's edge
def water_tile(f):
    """Deep bayou water; ripple dashes stay inside the tile so any frames sit side by side.
    Frames double as variants: the game shows tile (t + 3x + 5y) mod 4."""
    img = new(T, T)
    rect(img, 0, 0, 15, 15, P["water1"])
    r = rng(7)
    dashes = [(r.randrange(1, 11), r.randrange(1, 15), r.randint(2, 4)) for _ in range(5)]
    for i, (x, y, n) in enumerate(dashes):
        sx = x + ((f + i) % 4 in (1, 2))           # ripples drift a pixel and back
        draw(img, [(sx + k, y) for k in range(n)], P["water2"])
        if n >= 3 and (f + i) % 4 == 1:
            draw(img, [(sx + 1, y)], P["water3"])
    if f == 2:
        draw(img, [(12, 4)], P["water4"])
    if f == 0:
        draw(img, [(4, 11)], P["water4"])
    return img


def shore_north():
    """The deck's front edge seen from the water south of it: plank ends, a dark face, two
    pilings with moss, their reflections and a ripple line. (Land is to the north.)"""
    img = new(T, T)
    for x in range(16):
        draw(img, [(x, 0)], P["wood1"])                       # plank end face
        draw(img, [(x, 1)], P["wood0"] if x % 8 else P["ink"])  # board joints show as dark notches
        draw(img, [(x, 2)], P["ink"])                          # the deck's shadow on the water
        if x % 3:
            draw(img, [(x, 3)], P["water0"])
    for px in (3, 11):                                       # pilings into the water
        rect(img, px, 2, px + 1, 6, P["wood1"])
        draw(img, [(px, y) for y in range(2, 7)], P["wood2"])
        draw(img, [(px - 1, 7), (px, 7), (px + 1, 7), (px + 2, 7)], P["water3"])
        draw(img, [(px, 8), (px + 1, 8)], P["water2"])
        draw(img, [(px + 1, 3), (px + 1, 4)], P["moss3"])
    return img


def shore_west_side(mirror=False):
    """The deck's side edge (land to the east): a thin end grain and its shadow."""
    img = new(T, T)
    for y in range(16):
        draw(img, [(15, y)], P["wood1"])
        draw(img, [(14, y)], P["ink"] if y % 8 else P["wood0"])
        if y % 4 != 1:
            draw(img, [(13, y)], P["water0"])
    for py in (5, 13):
        rect(img, 12, py, 13, py + 1, P["wood1"])
        draw(img, [(11, py + 1), (10, py + 1)], P["water3"])
    return img.transpose(Image.FLIP_LEFT_RIGHT) if mirror else img


def shore_south():
    """Land to the south: the back edge of the deck seen from the water above; moss and a
    ripple line where the boards meet the water."""
    img = new(T, T)
    for x in range(16):
        draw(img, [(x, 15)], P["moss2"] if x % 5 else P["moss3"])
        if (x * 7) % 5 < 3:
            draw(img, [(x, 14)], P["moss1"])
        if x % 4 != 2:
            draw(img, [(x, 13)], P["water3"] if x % 4 == 0 else P["water2"])
    draw(img, [(6, 13), (6, 12), (7, 11)], P["moss4"])   # a reed
    draw(img, [(7, 10)], P["wood3"])
    return img


# ---------------------------------------------------------------- the Factory floor
def factory_tile(v):
    img = new(T, T)
    rect(img, 0, 0, 15, 15, P["steel1"])
    draw(img, [(x, 0) for x in range(16)] + [(0, y) for y in range(16)], P["steel0"])
    draw(img, [(x, 1) for x in range(1, 16)] + [(1, y) for y in range(1, 16)], P["steel2"])
    for y in range(4, 14, 4):           # tread: short diagonal dashes
        for x in range(4 + (y // 4 % 2) * 2, 13, 4):
            draw(img, [(x, y), (x + 1, y - 1)], P["steel0"])
    for x, y in ((3, 3), (12, 3), (3, 12), (12, 12)):
        draw(img, [(x, y)], P["steel3"])
        draw(img, [(x + 1, y + 1)], P["ink2"])
    if v == 1:
        rect(img, 5, 5, 10, 10, P["ink"])
        for y in (6, 8, 10):
            draw(img, [(x, y) for x in range(6, 10)], P["ink2"])
        draw(img, [(x, 10) for x in range(5, 11)] + [(10, y) for y in range(5, 11)], P["steel2"])
        draw(img, [(7, 7)], P["water3"])   # a glint of bayou under the grate
    return img


# ---------------------------------------------------------------- belts and trunks
def straight_field(px, py):
    return abs(py - 8.0), px


def turn_field(px, py):
    """Distance from the L path (8,0)->(8,8)->(16,8) rounded by the quarter circle about (16,0);
    s along it from the angle (the game's item path; see pixel-art/world/tiles.py)."""
    if px <= 8 and py >= 8:
        d = math.hypot(px - 8, py - 8)
    elif px <= 8:
        d = 8 - px
    elif py >= 8:
        d = py - 8
    else:
        d = min(px - 8, 8 - py)
    rr = math.hypot(16 - px, py)
    d = min(d, abs(8 - rr))
    s = 16 * math.atan2(py, 16 - px) / (math.pi / 2)
    return d, s


def belt_frame(f, field):
    """Steel rails with bolts, a dark rubber bed with slats that move 2 px a frame, and a lit
    chevron every 8 px pointing downstream so a belt's direction reads when it is empty."""
    img = new(T, T)
    for y in range(T):
        for x in range(T):
            d, s = field(x + 0.5, y + 0.5)
            if d >= 6:
                continue
            if d >= 5:
                c = P["ink"]
            elif d >= 4:
                c = P["steel4"] if (s % 8) < 1 else P["steel3"]
            elif d >= 3:
                c = P["ink1"]
            else:
                off = 2 - int(d)                 # chevron: the slat leads at the middle
                q = (s - 2 * f - off) % 8
                c = P["steel2"] if q < 1 else P["steel1"] if q < 2 else P["ink1"] if q < 3 else P["ink2"]
            draw(img, [(x, y)], c)
    return img


def trunk_frame(f, field):
    """The Factory's trunk: a wide brass-railed bed of rollers under a fast double chevron."""
    img = new(T, T)
    for y in range(T):
        for x in range(T):
            d, s = field(x + 0.5, y + 0.5)
            if d >= 8:
                continue
            if d >= 7:
                c = P["ink"]
            elif d >= 6:
                c = P["lamp3"] if (s % 8) < 1 else P["brass2"]
            elif d >= 5:
                c = P["brass1"]
            else:
                c = P["steel2"] if (s - f) % 4 < 2 else P["steel1"]
                q = (s - 4 * f - (3 - int(d))) % 16
                if d < 4 and (q < 2 or 5 <= q < 7):
                    c = P["brass2"] if (q < 1 or 5 <= q < 6) else P["lamp3"]
            draw(img, [(x, y)], c)
    return img


def build():
    export("tile_floor", [deck_tile(v) for v in range(4)])
    for k in ORES:
        export(f"tile_ore_{k}", quadrants(deposit(k)))
    export("tile_water", [water_tile(f) for f in range(4)], 4)
    export("tile_shore", [shore_north(), shore_west_side(), shore_south(), shore_west_side(mirror=True)])
    export("tile_factory", [factory_tile(0), factory_tile(1)])
    export("belt", [belt_frame(f, straight_field) for f in range(4)], 16)
    export("belt_turn", [belt_frame(f, turn_field) for f in range(4)], 16)
    export("trunk", [trunk_frame(f, straight_field) for f in range(4)], 16)
    export("trunk_turn", [trunk_frame(f, turn_field) for f in range(4)], 16)


if __name__ == "__main__":
    build()
