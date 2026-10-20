"""town_voltaire: Dame Voltaire's turbine pavilion, 32x48, 4 frames (fps 8).

Grand and art-nouveau, in her colours (violet ironwork, bone stone, teal glass, gold): a teal
glass bell dome with brass ribs, violet whiplash brackets curling off the cornice, a cream
facade with three arched warm windows and a door under a gold lightning bolt, and on a brass
mast above the dome a three-bladed turbine that turns 30 degrees a frame (one third of a turn
over the loop, so with three blades the loop is seamless). Standard town footing: deck top row
39, pilings 42-44, waterline 46-47.
"""
import math
from common_town import (new, ascii_, ell, piling, ripple, deck, KEY, INK, SH, BONE, G0, G1, G2, H0, H1, H2,
                         H3, I0, I1, I2, C0, C1, C2, SLAG, VIO, B0, B1, GOLD, GLOW, HOT, T0, T1, MOSS, LEAF)

PILES = (5, 15, 25)
HUB = (16, 7)  # the hub's centre pixel


def rotor(s, f):
    """Three blades from the hub, 30 degrees per frame, each 2 px wide near the hub, tip violet."""
    cx, cy = HUB
    pts = {}
    for b in range(3):
        a = math.radians(f * 30 + b * 120 - 90)
        ux, uy = math.cos(a), math.sin(a)
        nx, ny = -uy, ux
        for t10 in range(10, 66):
            t = t10 / 10
            x, y = round(cx + ux * t), round(cy + uy * t)
            pts[(x, y)] = VIO if t > 5.0 else BONE
            if t < 4.0:
                x2, y2 = round(cx + ux * t + nx * 0.9), round(cy + uy * t + ny * 0.9)
                pts.setdefault((x2, y2), H2)
    return pts


def draw(s, f):
    # dome: a teal glass bell (the top of a tall ellipse)
    ell(s, 16, 26, 9, 11.5, T0)
    s.rect(0, 26, 31, 47, None)
    deck(s, 2, 29, 39)
    for x in PILES:
        piling(s, x, 42, 44)
    # facade: bone stone with hull3 courses, lit left edge
    s.rect(7, 27, 24, 38, H3)
    s.line(7, 27, 7, 38, BONE)
    for y in (30, 34):
        s.line(8, y, 24, y, H2)
    s.line(24, 27, 24, 38, H2)
    # mast
    s.line(15, 9, 15, 14, B1)
    s.line(16, 9, 16, 14, B0)
    s.outline(INK)
    # dome ribs (brass) and glints (teal1)
    for x in (16,):
        s.line(x, 15, x, 25, B1)
    for (x0, x1) in ((12, 10), (20, 22)):
        for y in range(16, 26):
            t = (y - 16) / 9
            s.px(round(x0 + (x1 - x0) * t), y, B1)
    for (x, y) in ((11, 18), (10, 20), (12, 17), (14, 16), (9, 22)):
        s.px(x, y, T1)
    s.line(8, 25, 23, 25, B0)
    # cornice: a violet band with gold studs, whiplash brackets curling off each end
    s.line(5, 26, 26, 26, VIO)
    for x in range(7, 25, 3):
        s.px(x, 26, GOLD)
    ascii_(s, 3, 25, [
        ".vv",
        "v..",
        "v.v",
        ".v.",
    ])
    ascii_(s, 26, 25, [
        "vv.",
        "..v",
        "v.v",
        ".v.",
    ])
    # arched windows between violet pillars
    for wx in (9, 20):
        ascii_(s, wx - 1, 28, [
            ".kkk.",
            "kHook",
            "kHook",
            "koook",
            "kkkkk",
        ])
    for px_ in (12, 19):
        s.line(px_, 28, px_, 38, VIO)
        s.px(px_, 28, GOLD)
    # the door under a gold bolt
    ascii_(s, 14, 27, [
        "..gg",
        ".gg.",
        "gggg",
        ".gg.",
        "gg..",
    ])
    ascii_(s, 13, 32, [
        ".kkkk.",
        "kHoook",
        "koooyk",
        "koooyk",
        "koooyk",
        "koooyk",
        "kkkkkk",
    ])
    s.px(15, 34, B1)
    # turbine (its own outline)
    pts = rotor(s, f)
    ring = set()
    for (x, y) in pts:
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            q = (x + dx, y + dy)
            if q not in pts:
                ring.add(q)
    for (x, y) in ring:
        if 0 <= x < 32 and 0 <= y < 48 and (s.get(x, y) is None or y < 14):
            s.px(x, y, INK)
    for (x, y), col in pts.items():
        if 0 <= x < 32 and 0 <= y < 48:
            s.px(x, y, col)
    cx, cy = HUB
    ascii_(s, cx - 1, cy - 1, [
        "kgk",
        "gHg",
        "kgk",
    ])
    # a crackle of power at the mast's foot on alternate frames
    if f % 2:
        s.px(13, 12, T1)
        s.px(19, 11, HOT)
    for x in PILES:
        ripple(s, x, 46)


def build():
    s = new(32, 48, 4)
    for f in range(4):
        s.frame(f + 1)
        draw(s, f)
    s.frame(1)
    return s
