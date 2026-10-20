"""town_house: frog houses on stilts over the swamp, 32x32, one variant per frame (fps 0).

Every house shares the same footing so they can stand in a row: a plank deck whose lit top is
row 23 (face rows 24-25), 2 px pilings from row 26 to 28, the ink line under them on row 29 and
the waterline ripples on rows 30-31. Roofs carry the variety (thatch, copper tiles, a lily pad,
tin, turf, the Mayor's slate with his sash); walls change material with them, and every house
has at least one warm window so the town reads as lived-in at 1x.
"""
from common_town import (new, ell, ascii_, piling, ripple, window, planks_v, deck, gable, KEY,
                         INK, SH, BONE, G0, G1, G2, H0, H1, H2, H3, I0, I1, I2, C0, C1, C2, SLAG, VIO,
                         B0, B1, GOLD, GLOW, HOT, T0, T1, MOSS, LEAF)

ORDER = ["hut", "gable", "lily", "tall", "brick", "bramble"]
DECK_Y = 23
PILE_Y0, PILE_Y1 = 26, 28


def footing(s, x0, x1, piles):
    deck(s, x0, x1, DECK_Y)
    for x in piles:
        piling(s, x, PILE_Y0, PILE_Y1)


def finish(s, piles):
    s.outline(INK)
    for x in piles:
        ripple(s, x, PILE_Y1 + 2)


def door(s, x, y0, w=2, y1=22, knob=True):
    s.rect(x, y0, x + w - 1, y1, G0)
    s.line(x, y0, x + w - 1, y0, SH)
    if knob:
        s.px(x + w - 1, (y0 + y1) // 2 + 1, B1)
    s.rect(x - 1, y0 - 1, x + w, y0 - 1, INK)
    s.line(x - 1, y0, x - 1, y1, INK)
    s.line(x + w, y0, x + w, y1, INK)


# ------------------------------------------------------------------ 0. hut: reed thatch dome
def hut(s):
    piles = (8, 15, 22)
    # thatch dome: the top half of an ellipse, brass with brass0 straw lines
    ell(s, 16, 15.5, 10.5, 10, B1)
    s.rect(0, 16, 31, 31, None)
    footing(s, 5, 26, piles)
    planks_v(s, 9, 16, 22, 22, G1, G0, lit=G2, step=3)
    # three tiers of straw: each tier's last row is brass0 with a ragged fringe hanging into
    # the tier below; the right third of the dome sits in shade
    for yb in (8, 11, 15):
        for x in range(0, 32):
            if s.get(x, yb):
                s.px(x, yb, B0)
                if x % 2 == 0 and s.get(x, yb + 1) and yb < 15:
                    s.px(x, yb + 1, B0)
    for y in range(5, 16):
        for x in range(20, 28):
            if s.get(x, y) and (x - 20) + (y - 5) // 2 > 4 and (x + y) % 2 == 0:
                s.px(x, y, B0)
    for x in range(7, 26, 2):
        s.px(x, 16, B0)
    # sunlit straw on the top-left of each tier
    for (x, y) in ((11, 6), (12, 6), (13, 5), (9, 9), (10, 9), (8, 12), (9, 12)):
        s.px(x, y, P_HOT_STRAW)
    # sprout on top
    s.px(16, 4, LEAF)
    s.px(15, 3, LEAF)
    s.px(17, 2, LEAF)
    s.px(16, 3, MOSS)
    # round window and door
    window(s, 11, 18, 3, 2)
    door(s, 17, 18)
    finish(s, piles)


P_HOT_STRAW = "#ffeca0"  # hot: the sunlit straw (same slot as the windows' hot)


# ------------------------------------------------------------------ 1. gable: copper tiles
def gable_house(s):
    piles = (8, 15, 22)
    footing(s, 6, 25, piles)
    planks_v(s, 10, 14, 21, 22, G2, G1, lit=None, step=3, off=1)
    s.line(10, 14, 21, 14, G0)
    gable(s, 16, 6, 1, 9, C1, C2, C0)
    # tile courses: every other row a darker band with gaps
    for y in range(8, 15, 2):
        for x in range(0, 32):
            if s.get(x, y) and s.get(x, y)[:3] != (0xec, 0x9e, 0x78) and (x + y // 2) % 3 == 0:
                s.px(x, y, C0)
    s.line(5, 14, 26, 14, C0)
    # brick chimney behind the right slope
    s.rect(19, 3, 21, 8, C0)
    s.line(19, 3, 21, 3, SLAG)
    s.px(20, 5, SLAG)
    s.px(19, 7, SLAG)
    s.px(20, 2, H1)  # a wisp of smoke
    s.px(21, 1, H0)
    window(s, 11, 16, 2, 3, sill=G0)
    window(s, 19, 16, 2, 3, sill=G0)
    door(s, 15, 17)
    finish(s, piles)


# ------------------------------------------------------------------ 2. lily: a pad for a roof
def lily(s):
    piles = (8, 15, 22)
    footing(s, 6, 25, piles)
    planks_v(s, 10, 13, 21, 22, G1, G0, lit=G2, step=4, off=2)
    # the pad: a wide flat ellipse, its rim curling down; a V notch at the front-right
    ell(s, 16, 11, 13, 4, MOSS)
    ell(s, 16, 10, 12.5, 3.2, LEAF)
    for y in range(9, 16):
        for x in range(19, 23):
            d = y - 9
            if 20 + d // 2 <= x <= 20 + d // 2 + (1 if d > 2 else 0) and s.get(x, y):
                s.rect(x, y, x, y, None)
    # veins
    for (x, y) in ((10, 10), (12, 9), (8, 11), (22, 9), (24, 10), (14, 8)):
        s.px(x, y, MOSS)
    s.px(16, 9, MOSS)
    # a lotus on top, slightly left
    ascii_(s, 11, 4, [
        "..b..",
        ".bpb.",
        "bpHpb",
        ".CpC.",
    ])
    window(s, 12, 15, 3, 3, cross=True)
    door(s, 17, 17)
    s.rect(18, 22, 19, 22, G0)
    finish(s, piles)


# ------------------------------------------------------------------ 3. tall: teal boards, tin roof
def tall(s):
    piles = (9, 15, 21)
    footing(s, 7, 24, piles)
    planks_v(s, 11, 8, 20, 22, T0, I0, lit=T1, step=3, off=1)
    # floor band between storeys
    s.line(11, 14, 20, 14, G1)
    s.line(11, 15, 20, 15, G0)
    gable(s, 16, 1, 1, 7, H2, H3, H0)
    for y in range(2, 8):
        for x in range(0, 32):
            if s.get(x, y) and s.get(x, y)[:3] == (0xb4, 0xad, 0xa9) and x % 3 == 1:
                s.px(x, y, H1)
    # stovepipe with a cap
    s.rect(19, 0, 19, 4, H0)
    s.px(18, 0, H1)
    s.px(20, 0, H0)
    window(s, 14, 9, 3, 3, cross=True, sill=G1)
    window(s, 12, 17, 2, 3)
    door(s, 17, 17)
    # a little balcony rail on the upper floor
    s.line(10, 12, 10, 13, G2)
    s.line(21, 12, 21, 13, G0)
    finish(s, piles)


# ------------------------------------------------------------------ 4. brick: slag bricks, turf roof
def brick(s):
    piles = (8, 15, 22)
    footing(s, 6, 25, piles)
    # slag-brick walls (the swamp town loves a brick)
    s.rect(9, 12, 22, 22, SLAG)
    for y in range(12, 23):
        if y % 2 == 1:
            s.line(9, y, 22, y, SH)
        else:
            for x in range(9 + (y // 2) % 2 * 2, 23, 4):
                s.px(x, y, SH)
    s.line(9, 13, 9, 22, H1)
    for x in range(10, 23, 2):
        s.px(x, 13, H1)
    # turf roof: a flat slab with grass hanging over the edge, tufts and a flower
    s.rect(7, 9, 24, 11, MOSS)
    s.line(7, 9, 24, 9, LEAF)
    s.line(8, 8, 23, 8, LEAF)
    for x in range(8, 24, 3):
        s.px(x, 12, MOSS)
    for x in (9, 13, 20):
        s.px(x, 7, LEAF)
    s.px(21, 6, LEAF)
    s.px(17, 6, C2)
    s.px(17, 7, MOSS)
    window(s, 11, 15, 3, 3, cross=True, sill=B1)
    door(s, 17, 16)
    finish(s, piles)


# ------------------------------------------------------------------ 5. bramble: the Mayor's house
def bramble(s):
    piles = (3, 10, 20, 27)
    footing(s, 1, 30, piles)
    # navy boards (his coat), iron2 light on the left
    planks_v(s, 4, 13, 27, 22, I1, I0, lit=I2, step=3, off=1)
    # slate roof
    gable(s, 16, 4, 6, 9, H0, H1, SH)
    for y in range(5, 13, 2):
        for x in range(0, 32):
            if s.get(x, y) and s.get(x, y)[:3] == (0x46, 0x3f, 0x50) and (x + y) % 4 == 0:
                s.px(x, y, SH)
    s.line(2, 12, 29, 12, SH)
    # his sash across the roof: copper, light edge on top, a gold badge in the middle
    for i in range(0, 14):
        x, y = 8 + i * 1.0, 5 + i * 0.5
        s.px(int(x), int(y), C1)
        s.px(int(x), int(y) + 1, C0)
        s.px(int(x), int(y) - 1, C2) if i % 3 == 0 and int(y) - 1 > 4 else None
    ascii_(s, 14, 7, [
        ".g.",
        "gHg",
        ".Y.",
    ])
    # top-hat chimney: ink crown, brass band, a brim
    s.rect(21, 0, 25, 5, SH)
    s.line(21, 0, 21, 3, H1)
    s.line(21, 0, 25, 0, H0)
    s.px(21, 0, H2)
    s.line(21, 4, 25, 4, B1)
    s.px(21, 4, GOLD)
    s.line(20, 5, 26, 5, H0)
    s.px(20, 5, H1)
    # windows and the grand double door
    window(s, 6, 15, 4, 4, cross=True, sill=B1)
    window(s, 22, 15, 4, 4, cross=True, sill=B1)
    door(s, 14, 15, w=4, knob=False)
    s.line(16, 15, 16, 22, INK)
    s.px(15, 19, GOLD)
    s.px(17, 19, GOLD)
    s.line(13, 13, 18, 13, B1)  # a brass plaque over the door
    s.px(13, 13, B0)
    # a pennant on the gable end
    s.line(29, 2, 29, 11, H2)
    ascii_(s, 30, 2, [
        "l",
        "l",
        "m",
    ])
    finish(s, piles)


DRAW = {"hut": hut, "gable": gable_house, "lily": lily, "tall": tall, "brick": brick, "bramble": bramble}


def build():
    s = new(32, 32, len(ORDER))
    for i, name in enumerate(ORDER):
        s.frame(i + 1)
        DRAW[name](s)
    s.frame(1)
    return s
