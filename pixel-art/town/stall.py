"""town_stall: a Gizmo Festival stall, 32x32, 4 frames of bunting flutter (fps 6).

A plank stall on the town's standard footing (deck top row 23, pilings 26-28, waterline 30-31):
two posts, a striped copper-and-bone awning with a scalloped edge, a frog stallholder's eyes
peeking over a counter of Gizmos (the item's own look: a brass box, a hot eye, an antenna with a
glow tip), and a string of bunting between the post tops whose flags swing in the wind.
"""
import math
from common_town import (new, ascii_, piling, ripple, deck, planks_v, KEY, INK, SH, BONE, G0, G1, G2,
                         H0, H1, H2, H3, I0, I1, I2, C0, C1, C2, VIO, B0, B1, GOLD, GLOW, HOT, T0, T1,
                         MOSS, LEAF)

PILES = (5, 15, 25)
FLAGS = [C1, LEAF, I2, B1, VIO, T1, C2]


def bunting(s, f):
    """The string sags between the post tops (x 3 and 28, row 3); flags hang from it and swing."""
    pts = []
    for x in range(3, 29):
        t = (x - 3) / 25
        sag = 3.2 * math.sin(math.pi * t) + (0.6 * math.sin(math.pi * t) if f in (1, 2) else 0)
        y = 3 + int(round(sag))
        pts.append((x, y))
        s.px(x, y, H3 if x % 2 else H2)
    for i, x in enumerate(range(5, 27, 4)):
        y = dict(pts)[x] + 1
        col = FLAGS[i % len(FLAGS)]
        lean = [0, 1, 0, -1][(f + i) % 4]
        # a 3-wide pennant tapering to a point 2 rows down; the point swings with `lean`
        for dx in (-1, 0, 1):
            s.px(x + dx, y, col)
        s.px(x + (lean if lean else 0), y + 1, col)
        s.px(x - 1 + (1 if lean > 0 else 0), y + 1, col) if lean >= 0 else s.px(x - 1, y + 1, col)


def awning(s):
    # stripes 3 px wide, copper and bone; a lit front edge, a scalloped hem
    for x in range(2, 30):
        col = C1 if ((x - 2) // 3) % 2 == 0 else BONE
        dark = C0 if col == C1 else H2
        s.px(x, 9, col)
        s.px(x, 10, col)
        s.px(x, 11, dark if x % 3 == 1 else col)
        s.px(x, 12, dark)
        if (x - 2) % 3 == 1:
            s.px(x, 13, dark)
    s.line(3, 8, 28, 8, H3)
    s.px(2, 8, None)


def draw(s, f):
    deck(s, 1, 30, 23)
    for x in PILES:
        piling(s, x, 26, 28)
    # posts
    for x in (3, 28):
        s.line(x, 3, x, 22, G2 if x == 3 else G1)
    s.line(4, 9, 4, 22, G0)
    # back wall in shadow under the awning, the stallholder peeking over the counter
    s.rect(5, 13, 27, 17, SH)
    ascii_(s, 13, 14, [
        ".ll.ll.",
        "lWkllWk",
        "lllllll",
    ], key={**KEY, "W": BONE})
    # counter: lit top, plank front with a brass sign board
    s.line(3, 18, 28, 18, G2)
    planks_v(s, 4, 19, 27, 22, G1, G0, lit=G1, step=3, off=2)
    s.rect(11, 19, 20, 21, B1)
    s.line(11, 21, 20, 21, B0)
    s.line(12, 20, 19, 20, B0)
    s.px(12, 20, GOLD)
    s.px(19, 20, GOLD)
    s.px(15, 20, GOLD)
    s.px(16, 20, GOLD)
    awning(s)
    s.outline(INK)
    # Gizmos on the counter (drawn after the outline: each brings its own ink)
    for gx in (6, 22):
        ascii_(s, gx, 13, [
            "..o..",
            "..k..",
            "kkkkk",
            "kYHYk",
            "kyyyk",
        ])
    # one Gizmo blinks its eye
    if f in (1, 3):
        s.px(24, 16, KEY["o"])
    bunting(s, f)
    for x in PILES:
        ripple(s, x, 30)


def build():
    s = new(32, 32, 4)
    for f in range(4):
        s.frame(f + 1)
        draw(s, f)
    s.frame(1)
    return s
