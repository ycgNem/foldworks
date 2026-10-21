"""town_unit7: Unit 7's observatory, 32x48, 4 frames (fps 4).

Unit 7 collects "one of everything", so its tower is its own head on a riveted shaft: the
portrait's steel box with the dark screen, the teal eye and the gold 7; the shaft's shop window
shows a shelf of tiny items (one of each colour of the item set). On top, a radar dish turns
through four views (left, front, right, back) and the eye follows it; the bent antenna's bulb
blinks (on, bright, off, off).

On the sky island it lost its stilts: the shaft stands on a two-tier stone plinth (rows 42-46,
ink on 47) with a step at the door, the same footing language as the houses. Everything above
the plinth is the Milestone 4 drawing moved down 3 rows (SHIFT).
"""
from common_town import new, ascii_, stone_base, step, ink_ring, P

INK = P["ink"]
SH = P["ink1"]
BONE = P["bone"]
H0, H1, H2, H3 = P["steel1"], P["steel2"], P["steel3"], P["steel4"]
I0, I1, I2 = P["iron0"], P["iron1"], P["iron2"]
C0, C1, C2 = P["copper0"], P["copper1"], P["copper2"]
T0, T1 = P["water3"], P["teal"]
SHIFT = 3
KEY = {
    ".": None, "k": INK, "o": P["lamp1"], "H": P["lamp3"], "c": C0, "C": C1, "p": C2, "g": P["lamp2"],
    "0": H0, "1": H1, "2": H2, "3": H3, "I": I1, "J": I2, "i": I0, "x": P["slag1"], "Y": P["brass2"],
    "y": P["brass1"], "T": T1, "t": T0, "l": P["moss5"], "b": BONE,
}

DISH = [
    [  # facing left
        "...kkk...",
        "..k33k...",
        ".k32k....",
        "ok32k....",
        "kk32k....",
        ".k32k....",
        "..k33k...",
        "...kkk...",
    ],
    [  # facing us
        "..kkkkk..",
        ".k33333k.",
        "k3322223k",
        "k321o123k",
        "k3221223k",
        "k3322223k",
        ".k33333k.",
        "..kkkkk..",
    ],
    [  # facing right
        "...kkk...",
        "...k33k..",
        "....k23k.",
        "....k23ko",
        "....k23kk",
        "....k23k.",
        "...k33k..",
        "...kkk...",
    ],
    [  # its back
        "..kkkkk..",
        ".k11111k.",
        "k1100001k",
        "k100k001k",
        "k1000001k",
        "k1100001k",
        ".k11111k.",
        "..kkkkk..",
    ],
]
EYE_DX = [-1, 0, 1, 0]
BULB = [("o", "H"), ("H", "H"), ("c", "C"), ("c", "C")]


def asc(s, x, y, rows, key=None):
    ascii_(s, x, y, rows, key=key or KEY)


def rivet_box(s, x0, y0, x1, y1):
    s.rect(x0, y0, x1, y1, H1)
    s.line(x0, y0, x1, y0, H2)
    s.line(x0, y0, x0, y1, H2)
    s.px(x0, y0, H3)
    s.line(x1, y0 + 1, x1, y1, H0)
    s.line(x0 + 1, y1, x1, y1, H0)


def tower(s, f):
    """The Milestone 4 tower, rows 0-38 (the shaft's foot on row 38)."""
    rivet_box(s, 10, 26, 21, 38)
    for y in (30, 35):
        s.line(11, y, 20, y, H0)
    for (x, y) in ((11, 27), (20, 27), (11, 37), (20, 37)):
        s.px(x, y, H3)
    rivet_box(s, 6, 12, 25, 26)
    s.rect(4, 17, 5, 21, H0)
    s.px(4, 17, H2)
    s.rect(26, 17, 27, 21, H0)
    for (x, y) in ((7, 13), (24, 13), (7, 25), (24, 25)):
        s.px(x, y, H3 if x < 16 else H2)
    s.line(15, 9, 15, 11, H2)
    s.line(16, 9, 16, 11, H0)
    s.line(24, 4, 24, 11, H2)
    s.px(23, 4, H2)
    s.outline(INK)
    # screen
    s.rect(8, 14, 23, 24, I0)
    s.rect(9, 15, 22, 23, SH)
    s.line(9, 15, 22, 15, I0)
    # the eye follows the dish
    for (x, y) in ((11, 17), (12, 17), (13, 17), (10, 18), (14, 18), (10, 19), (14, 19), (10, 20),
                   (14, 20), (11, 21), (12, 21), (13, 21)):
        s.px(x, y, T1)
    s.rect(11, 18, 13, 20, T0)
    dx = EYE_DX[f]
    s.px(12 + dx, 19, I2)
    s.px(12 + dx, 18, BONE)
    # the 7 and its status lines
    asc(s, 18, 16, ["gggg", "...g", "..g.", "..g."])
    s.line(17, 21, 21, 21, I1)
    s.line(17, 22, 19, 22, I0)
    s.px(21, 22, C1 if f % 2 == 0 else I0)
    # the shop window: a shelf of one of everything
    asc(s, 11, 31, [
        "kkkkkkkkkk",
        "kIpCgx3YTk",
        "kyyyyyyyyk",
        "klbcH.oJ.k",
    ])
    s.line(11, 35, 20, 35, INK)
    # the door
    s.rect(14, 36, 17, 38, INK)
    s.rect(15, 36, 16, 38, T0)
    s.px(15, 36, T1)
    # the dish, and the antenna's bulb
    asc(s, 11, 1, DISH[f])
    on, core = BULB[f]
    asc(s, 23, 0, [".kk.", "k" + on + core + "k", "k" + on + on + "k", ".kk."])


def plinth(s):
    """Two stone tiers under the shaft and a step at the door (rows 41-46, ink on 47)."""
    stone_base(s, 4, 27, 44, 46, seed=7)
    stone_base(s, 8, 23, 41, 43, seed=8)
    s.line(8, 44, 23, 44, P["pave1"])   # the upper tier's shadow on the lower one's cap
    step(s, 13, 18, 44, rows=3)
    # an iron collar where the shaft meets the stone
    s.line(10, 41, 21, 41, H2)
    s.px(10, 41, H3)
    s.px(21, 41, H0)


def draw(s, f):
    tower(s, f)
    s.shift(0, SHIFT)
    # the shaft's foot was row 38 (41 now) with its outline on 42: the plinth replaces that row
    plinth(s)
    ink_ring(s, [(4, 44, 27, 46), (8, 41, 23, 43)])


def build():
    s = new(32, 48, 4)
    for f in range(4):
        s.frame(f + 1)
        draw(s, f)
    s.frame(1)
    return s
