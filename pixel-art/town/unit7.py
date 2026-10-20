"""town_unit7: Unit 7's observatory, 32x48, 4 frames (fps 4).

Unit 7 collects "one of everything", so its tower is its own head on a stilt: the portrait's
riveted hull-steel box with the dark screen, the teal eye and the gold 7, standing on a riveted
shaft whose shop window shows a shelf of tiny items (one of each colour of the item set). On
top, a radar dish turns through four views (left, front, right, back) and the eye follows it;
the bent antenna's bulb blinks (on, bright, off, off). Standard town footing: deck top row 39,
pilings 42-44, waterline 46-47.
"""
from common_town import (new, ascii_, piling, ripple, deck, KEY, INK, SH, BONE, G0, G1, G2, H0, H1, H2, H3,
                         I0, I1, I2, C0, C1, C2, SLAG, VIO, B0, B1, GOLD, GLOW, HOT, T0, T1, MOSS, LEAF)

PILES = (6, 15, 24)
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


def rivet_box(s, x0, y0, x1, y1):
    s.rect(x0, y0, x1, y1, H1)
    s.line(x0, y0, x1, y0, H2)
    s.line(x0, y0, x0, y1, H2)
    s.px(x0, y0, H3)
    s.line(x1, y0 + 1, x1, y1, H0)
    s.line(x0 + 1, y1, x1, y1, H0)


def draw(s, f):
    deck(s, 3, 28, 39)
    for x in PILES:
        piling(s, x, 42, 44)
    # the shaft: riveted steel plates
    rivet_box(s, 10, 26, 21, 38)
    for y in (30, 35):
        s.line(11, y, 20, y, H0)
    for (x, y) in ((11, 27), (20, 27), (11, 37), (20, 37)):
        s.px(x, y, H3)
    # the head: hull frame, ears, a dark screen
    rivet_box(s, 6, 12, 25, 26)
    s.rect(4, 17, 5, 21, H0)
    s.px(4, 17, H2)
    s.rect(26, 17, 27, 21, H0)
    for (x, y) in ((7, 13), (24, 13), (7, 25), (24, 25)):
        s.px(x, y, H3 if x < 16 else H2)
    # the antenna mast and the dish's mast
    s.line(15, 9, 15, 11, H2)
    s.line(16, 9, 16, 11, H0)
    s.line(24, 4, 24, 11, H2)
    s.px(23, 4, H2)
    s.outline(INK)
    # screen (inside the outline, so after it)
    s.rect(8, 14, 23, 24, I0)
    s.rect(9, 15, 22, 23, SH)
    s.line(9, 15, 22, 15, I0)
    # the eye: a teal ring with a pupil that follows the dish
    for (x, y) in ((11, 17), (12, 17), (13, 17), (10, 18), (14, 18), (10, 19), (14, 19), (10, 20),
                   (14, 20), (11, 21), (12, 21), (13, 21)):
        s.px(x, y, T1)
    s.rect(11, 18, 13, 20, T0)
    dx = EYE_DX[f]
    s.px(12 + dx, 19, I2)
    s.px(12 + dx, 18, BONE)
    # the 7, and status lines
    ascii_(s, 18, 16, [
        "gggg",
        "...g",
        "..g.",
        "..g.",
    ])
    s.line(17, 21, 21, 21, I1)
    s.line(17, 22, 19, 22, I0)
    s.px(21, 22, C1 if f % 2 == 0 else I0)
    # the shop window: a shelf of one of everything
    ascii_(s, 11, 31, [
        "kkkkkkkkkk",
        "kIpCgx3YTk",
        "kyyyyyyyyk",
        "kl.cH.oJ.k",
    ], key={**KEY, "p": C2, "x": SLAG})
    s.line(11, 35, 20, 35, INK)
    # the door
    s.rect(14, 36, 17, 38, INK)
    s.rect(15, 36, 16, 38, T0)
    s.px(15, 36, T1)
    # the dish on top, and the antenna's bulb
    ascii_(s, 11, 1, DISH[f])
    on, core = BULB[f]
    ascii_(s, 23, 0, [
        ".kk.",
        "k" + on + core + "k",
        "k" + on + on + "k",
        ".kk.",
    ], key={**KEY, "c": C0})
    for x in PILES:
        ripple(s, x, 46)


def build():
    s = new(32, 48, 4)
    for f in range(4):
        s.frame(f + 1)
        draw(s, f)
    s.frame(1)
    return s
