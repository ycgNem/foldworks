"""Logistics pieces, the module frame, the Sparks, and the 2x2 buildings (Dock, Hopper and
their Factory-floor and Lily Pad versions)."""
import math
from fw import mk, blit, box, export, c, disk, ring_of, lump, new
from machines import chute, seg


# --------------------------------------------------------------------------- slag heap
# 5 frames = fill 0, 25, 50, 75, 100 % (picked by code, not animated)

HEAP_LUMPS = [
    # each fill level adds lumps (cx, cy, rx, ry); drawn back (high) to front (low)
    [(7.5, 9.6, 2.6, 1.7)],
    [(4.8, 9.6, 2.2, 1.6), (10.6, 9.7, 2.2, 1.5), (7.6, 7.9, 2.5, 1.8)],
    [(3.9, 8.6, 1.8, 1.6), (11.3, 8.4, 1.8, 1.6), (5.8, 6.6, 2.3, 1.8), (9.6, 6.4, 2.3, 1.8), (7.5, 5.0, 2.2, 1.7)],
    [(5.4, 4.4, 2.0, 1.6), (10.0, 4.2, 2.0, 1.5), (7.6, 2.8, 2.4, 1.8), (7.4, 1.3, 1.5, 1.1)],
]


def draw_heap(s, f):
    # the bin, seen from above and a little in front
    s.rect(1, 4, 14, 14, c("ink"))
    s.line(2, 5, 13, 5, c("hull2"))
    s.line(2, 5, 2, 10, c("hull2"))
    s.line(13, 5, 13, 10, c("hull1"))
    s.rect(3, 6, 12, 10, c("shadow"))
    s.line(3, 6, 12, 6, c("ink"))
    # front wall
    s.line(2, 11, 13, 11, c("hull2"))
    s.rect(2, 12, 13, 13, c("hull1"))
    s.line(2, 13, 13, 13, c("hull0"))
    for x in (3, 12):
        s.px(x, 12, c("hull3"))
    # the hatch it empties from (the front, on the right)
    s.rect(14, 6, 15, 9, c("ink"))
    s.line(14, 7, 15, 7, c("hull0"))
    s.line(14, 8, 15, 8, c("shadow"))
    if f == 0:
        # an empty bin: a few crumbs
        s.px(5, 9, c("slag"))
        s.px(9, 10, c("slag"))
        return
    lumps = [l for lv in HEAP_LUMPS[:f] for l in lv]
    # one ink silhouette round the whole pile, then the lumps shaded inside it
    tmp = new(16, 16)
    union = set()
    for cx, cy, rx, ry in lumps:
        union |= set(lump(tmp, cx, cy, rx, ry, ("hull0", "slag", "violet"), outline=None, bounds=(2, 0, 13, 10)))
    for x, y in ring_of(union):
        if 2 <= x <= 13 and y <= 10:
            s.px(x, y, c("ink"))
    for cx, cy, rx, ry in sorted(lumps, key=lambda l: l[1]):
        pts = lump(s, cx, cy, rx, ry, ("hull0", "slag", "violet"), outline=None, bounds=(2, 0, 13, 10))
        # a crease where this lump sits on the one behind it
        for x, y in pts:
            if (x, y - 1) in union and (x, y - 1) not in pts and pts[(x, y)] > 0.2:
                s.px(x, y - 1, c("shadow"))
    if f == 4:
        # overflowing: crumbs down the front wall
        for x, y in ((4, 11), (10, 11), (11, 12)):
            s.px(x, y, c("slag"))
        s.px(5, 11, c("violet"))
        s.px(4, 12, c("ink"))


# --------------------------------------------------------------------------- buffer crate

def draw_crate(s, f):
    chute(s, ("hull2", "shadow", "shadow", "hull0"), x0=13)
    s.rect(1, 2, 14, 14, c("ink"))
    # lid: two planks
    s.rect(2, 3, 13, 5, c("copper1"))
    s.line(2, 3, 13, 3, c("copper2"))
    s.line(2, 5, 13, 5, c("copper0"))
    s.line(2, 4, 2, 4, c("copper2"))
    # front: vertical slats with dark gaps
    s.rect(2, 6, 13, 13, c("copper0"))
    for x in (2, 3, 5, 6, 8, 9, 11, 12):
        s.line(x, 7, x, 12, c("copper1"))
        s.px(x, 7, c("copper2") if x % 3 != 1 else c("copper1"))
    for x in (4, 7, 10, 13):
        s.line(x, 7, x, 12, c("shadow"))
    # steel straps and corner brackets
    s.line(2, 6, 13, 6, c("hull1"))
    s.line(2, 13, 13, 13, c("hull0"))
    for x, y in ((2, 6), (13, 6), (2, 13), (13, 13)):
        s.px(x, y, c("hull2"))
    s.px(2, 6, c("hull3"))
    # a stencilled arrow on the front: which way it passes things on
    blit(s, 7, 8, ["W.", "WW", "W."])
    # chamfer the corners
    for x, y in ((1, 2), (14, 2), (1, 14), (14, 14)):
        s.px(x, y, None)


# --------------------------------------------------------------------------- splitter / merger

def arrow(s, side, outward, col, hi):
    """A 3-deep arrow in the border band on `side`, pointing out of or into the centre."""
    for depth, w in ((0, 6), (1, 4), (2, 2)):
        d = depth if outward else 2 - depth
        for i in range(w):
            k = 8 - w // 2 + i
            if side == "right":
                x, y = 12 + d, k
            elif side == "left":
                x, y = 3 - d, k
            elif side == "up":
                x, y = k, 3 - d
            else:
                x, y = k, 12 + d
            s.px(x, y, c(col if depth < 2 else hi))


def draw_router(s, kind):
    box(s, 0, 0, 15, 15, "hull1", "hull2", "hull0", hi="hull3", chamfer=2)
    # a plus of dark channels: four ports open at the tile edges, the item well in the middle
    s.rect(0, 3, 15, 12, c("ink"))
    s.rect(3, 0, 12, 15, c("ink"))
    s.rect(0, 4, 15, 11, c("shadow"))
    s.rect(4, 0, 11, 15, c("shadow"))
    s.rect(4, 4, 11, 11, c("hull0"))
    s.line(4, 4, 11, 4, c("shadow"))
    s.line(4, 4, 4, 11, c("shadow"))
    # rivets on the four corner blocks
    for x, y in ((1, 1), (13, 1), (1, 13), (13, 13)):
        s.px(x, y, c("hull3"))
        s.px(x + 1, y + 1, c("hull0"))
    for x, y in ((0, 0), (15, 0), (0, 15), (15, 15)):
        s.px(x, y, None)
    if kind == "splitter":
        arrow(s, "left", False, "hull2", "bone")
        for side in ("right", "up", "down"):
            arrow(s, side, True, "brass1", "hot")
    else:
        for side in ("left", "up", "down"):
            arrow(s, side, False, "hull2", "bone")
        arrow(s, "right", True, "brass1", "hot")


# --------------------------------------------------------------------------- module frame

def draw_module(s, f):
    box(s, 0, 0, 15, 15, "brass1", "hot", "brass0", chamfer=1)
    s.line(2, 2, 13, 2, c("brass1"))
    s.line(2, 2, 2, 13, c("brass1"))
    s.line(2, 13, 13, 13, c("brass0"))
    s.line(13, 2, 13, 13, c("brass0"))
    for x, y in ((2, 2), (13, 13)):
        s.px(x, y, c("hot"))
    s.px(13, 2, c("brass0"))
    # the well: exactly x4..11, y4..11 (the game draws the 8x8 output icon here)
    s.rect(3, 3, 12, 12, c("ink"))
    s.rect(4, 4, 11, 11, c("shadow"))
    s.line(4, 11, 11, 11, c("hull0"))
    s.line(11, 4, 11, 11, c("hull0"))
    # the fold: the bottom-left corner dog-eared, showing the paler back of the sheet
    blit(s, 0, 11, [
        "_#..",
        "_#z#",
        "__#z",
        "___#",
        "____",
    ])
    s.px(1, 11, c("ink"))
    s.px(4, 15, c("ink"))


# --------------------------------------------------------------------------- Sparks

STARS = [(4, 4), (11, 6), (6, 11), (12, 12)]
PHASE = [0, 2, 1, 3]


def star(s, x, y, size):
    if size == 0:
        return
    if size == 1:
        s.px(x, y, c("hot"))
        return
    if size == 2:
        for dx, dy in ((0, -1), (0, 1), (-1, 0), (1, 0)):
            s.px(x + dx, y + dy, c("gold"))
        s.px(x, y, c("bone"))
        return
    # size 3: a four-point star with an ink halo so it reads over pale ground
    pts = {(x, y)} | {(x + dx, y) for dx in (-2, -1, 1, 2)} | {(x, y + dy) for dy in (-2, -1, 1, 2)}
    for p in ring_of(pts):
        if s.get(*p) is None:
            s.px(p[0], p[1], c("ink"))
    for dx in (-2, 2):
        s.px(x + dx, y, c("gold"))
    for dy in (-2, 2):
        s.px(x, y + dy, c("gold"))
    for dx, dy in ((-1, 0), (1, 0), (0, -1), (0, 1)):
        s.px(x + dx, y + dy, c("hot"))
    s.px(x, y, c("bone"))


def draw_spark_vein(s, f):
    sizes = [0, 1, 3, 2]
    for i, (x, y) in enumerate(STARS):
        star(s, x, y, sizes[(f + PHASE[i]) % 4])


def draw_inspector(s, f):
    b = 1 if f else 0   # a little bob
    rows = [
        "................",
        "......####......",
        ".....#0000#.....",
        ".....#s00s#.....",
        ".....#yyyy#.....",
        "...##########...",
        "....#pppppp#....",
        "....#W#pp#W#....",
        "....#ppppppp#...",
        ".....#u##u#.....",
        "....#abbbbba#...",
        "...#ab$abbba#...",
        "...#ab#abbba#...",
        "....#abyaba#....",
        ".....#a#a#......",
        ".....##.##......",
    ]
    blit(s, 0, 0, rows[:14] if b else rows)
    if b:
        blit(s, 0, 1, rows[:14])
        blit(s, 0, 14, [".....#a#a#......", ".....##.##......"])
    # clipboard in the right hand
    cy = 9 + (0 if f == 0 else 1)
    blit(s, 10, cy, [
        "#####",
        "#W2W#",
        "#WWW#",
        "#W#W#" if f else "#WWW#",
        "#####",
    ])
    if f:
        s.px(12, cy + 2, c("hot") if False else c("ink"))


# --------------------------------------------------------------------------- the Dock

FLAG = [
    ["#######.",
     "#llllll#",
     "#lvvlll#",
     "#lvvvll#",
     "#llllv#.",
     "######.."],
    ["######..",
     "#lllll##",
     "#lvvllll",
     "#lvvvll#",
     "#llllll#",
     ".#######"],
]


def deck(s):
    """A weathered boardwalk with plank seams and nail heads."""
    box(s, 1, 4, 30, 30, "hull1", "hull2", "hull0", hi="hull3", chamfer=1)
    for y in range(7, 29, 3):
        s.line(2, y, 29, y, c("hull0"))
    for y, xs in ((6, (9, 21)), (9, (14, 26)), (12, (6, 18)), (15, (11, 24)), (18, (8, 20)),
                  (21, (15, 27)), (24, (5, 17)), (27, (12, 23))):
        for x in xs:
            s.px(x, y, c("hull0"))
            s.px(x - 1, y, c("hull2"))
    for y in range(5, 29, 3):
        s.px(3 + (y * 7) % 23, y, c("shadow"))


def grate(s, x0, y0, x1, y1):
    box(s, x0, y0, x1, y1, "shadow", "brass1", "brass0", hi="hot", chamfer=0)
    for x, y in ((x0, y0), (x1, y0), (x0, y1), (x1, y1)):
        s.px(x, y, c("hull1"))
    s.rect(x0 + 2, y0 + 2, x1 - 2, y1 - 2, c("ink"))
    for y in range(y0 + 3, y1 - 1, 2):
        s.line(x0 + 3, y, x1 - 3, y, c("hull0"))


def crates(s):
    box(s, 22, 19, 28, 25, "copper1", "copper2", "copper0", chamfer=0)
    s.line(23, 20, 27, 24, c("copper0"))
    box(s, 23, 24, 29, 29, "copper1", "copper2", "copper0", chamfer=0)
    s.line(24, 25, 28, 28, c("copper0"))


def coin_sign(s, f):
    # a coin on a post: the Dock pays
    s.line(26, 6, 26, 13, c("ink"))
    s.line(27, 7, 27, 13, c("hull2"))
    blit(s, 23, 1, [
        ".#####.",
        "#$$$$y#",
        "#$zy$u#",
        "#$yu$u#",
        "#$$$$u#",
        ".#####.",
    ])
    if f:
        s.px(24, 2, c("bone"))


def water(s, x0, y0, x1, y1, f):
    s.rect(x0, y0, x1, y1, c("iron0"))
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1):
            if (x * 3 + y * 5 + f * 4) % 17 == 0:
                s.px(x, y, c("teal0"))
            elif (x * 7 + y * 3 + f * 6) % 23 == 0:
                s.px(x, y, c("iron1"))


BOAT = [
    ".###########.",
    "#pzpppppppo##",
    "#oruurrruuro#",
    ".#ooooooooo#.",
    "..#########..",
]


def draw_dock(s, f):
    # Bramble's swamp along the front, the pier over it
    s.rect(0, 20, 31, 31, c("ink"))
    water(s, 1, 21, 30, 30, f)
    for x in (0, 31):
        s.px(x, 31, None)
    box(s, 1, 3, 30, 24, "hull1", "hull2", "hull0", hi="hull3", chamfer=1)
    for y in range(6, 23, 3):
        s.line(2, y, 29, y, c("hull0"))
    for y, xs in ((5, (9, 21)), (8, (14, 26)), (11, (6, 18)), (14, (11, 24)), (17, (8, 20)), (20, (15, 27)), (23, (5, 17))):
        for x in xs:
            s.px(x, y, c("hull0"))
            s.px(x - 1, y, c("hull2"))
    # pilings under the front edge
    for x in (3, 9, 27):
        blit(s, x, 24, ["###", "#0#", "#s#", "###"])
    # a rowboat tied up, bobbing
    by = 26 + f
    blit(s, 13, by, BOAT[:5 - f])
    s.line(12, by + 1, 11, 26, c("brass0"))
    # the intake grate
    grate(s, 7, 8, 20, 21)
    # crates
    box(s, 22, 12, 28, 18, "copper1", "copper2", "copper0", chamfer=0)
    s.line(23, 13, 27, 17, c("copper0"))
    box(s, 23, 17, 29, 23, "copper1", "copper2", "copper0", chamfer=0)
    s.line(24, 18, 28, 22, c("copper0"))
    # flag pole, top-left
    s.line(3, 0, 3, 12, c("ink"))
    s.line(4, 1, 4, 12, c("hull2"))
    s.px(3, 0, c("brass1"))
    s.px(4, 0, c("brass1"))
    blit(s, 5, 0, FLAG[f])
    coin_sign(s, f)


# --------------------------------------------------------------------------- Lily Pad Dock

PADS = [(3, 3, 2.6), (28, 6, 2.2), (2, 16, 2.0), (29, 20, 2.3), (6, 29, 2.4), (25, 29, 2.0), (16, 30, 1.8)]


def draw_dock_lily(s, f):
    # swamp water all round, then a smaller round-cornered deck on it
    box(s, 0, 0, 31, 31, "iron0", "iron1", "iron0", chamfer=3)
    for y in range(2, 30):
        for x in range(2, 30):
            if (x * 3 + y * 5 + f * 4) % 17 == 0:
                s.px(x, y, c("teal0"))
            elif (x * 7 + y * 3 + f * 6) % 29 == 0:
                s.px(x, y, c("iron1"))
    box(s, 5, 6, 26, 26, "hull1", "hull2", "hull0", hi="hull3", chamfer=2)
    for y in range(9, 25, 3):
        s.line(6, y, 25, y, c("hull0"))
    for y, xs in ((8, (12, 21)), (11, (9, 18)), (14, (15, 23)), (17, (8, 19)), (20, (13, 22)), (23, (10, 17))):
        for x in xs:
            s.px(x, y, c("hull0"))
    grate(s, 10, 11, 21, 22)
    # lily pads with notches; a flower on one
    for i, (x, y, r) in enumerate(PADS):
        pts = disk(x + 0.5, y + 0.5, r)
        pts = {p for p in pts if 0 <= p[0] < 32 and 0 <= p[1] < 32}
        for p in ring_of(pts):
            if 0 <= p[0] < 32 and 0 <= p[1] < 32 and s.get(*p) is not None and s.get(*p)[:3] != (0, 0, 0):
                pass
        for (px_, py_) in pts:
            s.px(px_, py_, c("leaf") if (px_ - x) + (py_ - y) < 0 else c("moss"))
        # notch toward the centre
        s.px(x + (1 if x < 16 else -1), y, c("iron0"))
        s.px(x, y, c("moss"))
    blit(s, 27, 19, [".p.", "pzp", ".p."])
    # Bramble's statue, top-left: a frog on a plinth with a brass crown
    blit(s, 1, 1, [
        "..#.#.#...",
        "..#y#y#...",
        ".##yyy##..",
        "#lWl#lWl#.",
        "#l#lll#l#.",
        "#llllllll#",
        "#vlrrrrlv#" if f == 0 else "#vlWWWWlv#",
        "#vvllllvv#",
        ".#v#vv#v#.",
        "##########",
        "#22222221#",
        "#11111110#",
        "##########",
    ])
    if f:
        s.px(3, 4, c("ink"))
        s.px(7, 4, c("ink"))


# --------------------------------------------------------------------------- the Hopper

FUN = (1, 0, 30, 19)        # outer rim
THROAT = (12, 7, 19, 12)    # the hole


def draw_hopper(s, f):
    box(s, 0, 2, 31, 31, "hull0", "hull1", "shadow", chamfer=2)
    X0, Y0, X1, Y1 = FUN
    TX0, TY0, TX1, TY1 = THROAT
    s.rect(X0, Y0, X1, Y1, c("ink"))
    # four sloping faces; inside a funnel the far walls are in shade and the near walls
    # catch the top-left light (it's concave), which is what makes it read as a hole
    for y in range(Y0 + 1, Y1):
        for x in range(X0 + 1, X1):
            if TX0 <= x <= TX1 and TY0 <= y <= TY1:
                continue
            a = (x - X0) / (TX0 - X0)
            b = (X1 - x) / (X1 - TX1)
            t_ = (y - Y0) / (TY0 - Y0)
            e = (Y1 - y) / (Y1 - TY1)
            face = min((a, "L"), (b, "R"), (t_, "T"), (e, "B"))[1]
            col = {"T": "iron0", "L": "iron1", "R": "iron1", "B": "iron2"}[face]
            if face == "L" and a > 0.55:
                col = "iron0"
            if face == "R" and b < 0.45:
                col = "iron2"
            s.px(x, y, c(col))
    for (ax, ay), (bx, by) in (((X0 + 1, Y0 + 1), (TX0, TY0)), ((X1 - 1, Y0 + 1), (TX1, TY0)),
                               ((X0 + 1, Y1 - 1), (TX0, TY1)), ((X1 - 1, Y1 - 1), (TX1, TY1))):
        s.line(ax, ay, bx, by, c("iron0"))
    # the rim: a convex lip, lit on its top and left
    s.line(X0 + 1, Y0 + 1, X1 - 1, Y0 + 1, c("hull3"))
    s.line(X0 + 1, Y0 + 1, X0 + 1, Y1 - 1, c("iron2"))
    s.line(X1 - 1, Y0 + 2, X1 - 1, Y1 - 1, c("iron0"))
    s.line(X0 + 2, Y1 - 1, X1 - 1, Y1 - 1, c("iron0"))
    for x in (4, 10, 16, 22, 27):
        s.px(x, Y0 + 1, c("bone"))
    # the throat, with something dropping in
    s.rect(TX0, TY0, TX1, TY1, c("ink"))
    s.rect(TX0 + 1, TY0 + 1, TX1 - 1, TY1 - 1, c("shadow"))
    s.line(TX0 + 1, TY1 - 1, TX1 - 1, TY1 - 1, c("ink"))
    if f == 1:
        blit(s, 14, 7, [".##.", "#eb#", "#ba#", ".##."])
    elif f == 2:
        blit(s, 15, 9, ["#b", "ba"])
    # the research desk under it
    box(s, 2, 19, 29, 30, "brass0", "brass1", "shadow", chamfer=1)
    s.line(3, 21, 28, 21, c("brass0"))
    # screen: a teal CRT with a graph that steps up
    box(s, 4, 20, 14, 28, "hull1", "hull2", "hull0", chamfer=1)
    s.rect(6, 22, 12, 26, c("teal0"))
    graph = [[26, 25, 25, 24, 24, 23, 23], [26, 25, 24, 24, 23, 23, 22], [25, 25, 24, 23, 23, 22, 22]][f]
    for i, y in enumerate(graph):
        s.px(6 + i, y, c("teal1"))
    s.px(6 + (2 * f + 4) % 7, graph[(2 * f + 4) % 7], c("bone"))
    # a sheet of notes and a pencil
    s.rect(16, 21, 21, 27, c("ink"))
    s.rect(17, 22, 20, 26, c("bone"))
    s.line(17, 23, 19, 23, c("hull1"))
    s.line(17, 25, 20, 25, c("hull1"))
    s.line(22, 22, 25, 25, c("brass1"))
    s.px(26, 26, c("ink"))
    # a lamp that blinks
    lamp = ["teal1", "bone", "teal0"][f]
    blit(s, 24, 26, ["###", "#.#", "###"])
    s.px(25, 27, c(lamp))


# --------------------------------------------------------------------------- Factory floor buildings

def hazard(s, x0, y0, x1, y1, phase=0):
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1):
            s.px(x, y, c("brass1") if ((x + y + phase) // 3) % 2 == 0 else c("ink"))


def draw_factory_dock(s, f):
    box(s, 0, 0, 31, 31, "hull1", "hull2", "hull0", hi="hull3", chamfer=2)
    # hazard frame round the loading bay
    s.rect(3, 3, 28, 28, c("ink"))
    hazard(s, 4, 4, 27, 6)
    hazard(s, 4, 25, 27, 27)
    hazard(s, 4, 7, 6, 24)
    hazard(s, 25, 7, 27, 24)
    # the bay: rollers into a big brass-rimmed hatch
    box(s, 7, 7, 24, 24, "shadow", "brass1", "brass0", hi="hot", chamfer=0)
    s.rect(9, 9, 22, 22, c("ink"))
    for y in range(10, 22, 3):
        s.line(10, y, 21, y, c("hull1"))
        s.line(10, y + 1, 21, y + 1, c("hull0"))
    # a coin stamp in the middle of the hatch
    blit(s, 12, 12, [".######.", "#$$$$$y#", "#$zy$$u#", "#$y$$$u#", "#$$$$uu#", "#$$uuuu#", ".######."])
    # beacons on two corners that blink in turn
    for i, (x, y) in enumerate(((0, 0), (28, 28))):
        on = (f + i) % 2 == 0
        blit(s, x, y, ["####", "#zx#" if on else "#ro#", "#xx#" if on else "#rr#", "####"])


def draw_factory_hopper(s, f):
    box(s, 0, 0, 31, 31, "hull0", "hull1", "shadow", chamfer=2)
    # a riveted silo funnel, top-down
    cx, cy = 13.5, 13.5
    for y in range(1, 28):
        for x in range(1, 27):
            r = math.hypot(x + 0.5 - cx, y + 0.5 - cy)
            lit = -((x + 0.5 - cx) + (y + 0.5 - cy)) / (r + 0.01)
            if r > 12.5:
                continue
            if r > 11.5:
                col = "ink"
            elif r > 10.0:
                col = "iron2" if lit > 0.2 else "iron1"
            elif r > 7:
                col = "iron1" if lit > -0.3 else "iron0"
            elif r > 4:
                col = "iron0"
            elif r > 3:
                col = "ink"
            else:
                col = "shadow"
            s.px(x, y, c(col))
    for k in range(8):
        a = k * math.pi / 4
        s.px(int(cx + 10.8 * math.cos(a)), int(cy + 10.8 * math.sin(a)), c("bone"))
    # a ladder up the side
    for y in range(4, 24, 2):
        s.line(27, y, 29, y, c("hull2"))
    s.line(26, 3, 26, 24, c("ink"))
    s.line(30, 3, 30, 24, c("ink"))
    # a console with blinking lights along the bottom
    box(s, 3, 25, 28, 30, "hull1", "hull2", "hull0", chamfer=1)
    for i in range(6):
        on = (i + f) % 3 == 0
        s.px(6 + i * 3, 27, c(["teal1", "leaf", "glow"][i % 3]) if on else c("shadow"))
        s.px(6 + i * 3, 28, c("ink"))
    s.px(5, 27, c("ink"))


def build():
    export("heap", mk(16, 16, 5, draw_heap), 0)
    export("crate", mk(16, 16, 1, draw_crate), 0)
    export("splitter", mk(16, 16, 1, lambda s, f: draw_router(s, "splitter")), 0)
    export("merger", mk(16, 16, 1, lambda s, f: draw_router(s, "merger")), 0)
    export("module", mk(16, 16, 1, draw_module), 0)
    export("spark_vein", mk(16, 16, 4, draw_spark_vein), 8, preview_bg="ore")
    export("spark_inspector", mk(16, 16, 2, draw_inspector), 2)
    export("dock", mk(32, 32, 2, draw_dock), 2)
    export("dock_lily", mk(32, 32, 2, draw_dock_lily), 2)
    export("hopper", mk(32, 32, 3, draw_hopper), 3)
    export("factory_dock", mk(32, 32, 2, draw_factory_dock), 2, preview_bg="factory")
    export("factory_hopper", mk(32, 32, 3, draw_factory_hopper), 3, preview_bg="factory")
