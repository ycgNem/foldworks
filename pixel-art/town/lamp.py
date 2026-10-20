"""town_lamp: a lamp post on a piling, 16x32, 4 frames of a lit flicker (fps 6).

An iron shepherd's crook on a fat wooden piling, a brass lantern hanging from the hook (so the
silhouette says "lamp post" at 1x, not "pole"), and its light laid on the water under it. The
flicker moves the flame's hot core and the reflection's dashes; the shape never moves.
"""
from common_town import new, ascii_, KEY, INK, SH, G0, G1, G2, H0, H1, H2, B0, B1, GOLD, GLOW, HOT, I0, T0

LANTERN = [
    "...k...",
    "..kYk..",
    ".kYYYk.",
    "kYYYYyk",
    "kY...yk",
    "kY...yk",
    "kY...yk",
    "kyyyyyk",
    ".kyyyk.",
    "..kok..",
    "...k...",
]
# the flame's 3x3 core per frame (H hot, g gold, o glow)
FLAME = [
    ["HHo", "HgH", "oHo"],
    ["HHH", "gHg", "oHo"],
    ["oHH", "HHg", "ooH"],
    ["HHo", "HHH", "ogo"],
]
# the reflection on the water: (dx, dy, colour) per frame, under the lantern
REFL = [
    [(0, 0, "o"), (-1, 1, "y"), (1, 1, "o"), (2, 1, "y"), (-2, 2, "y"), (0, 2, "o"), (3, 2, "y")],
    [(0, 0, "o"), (1, 0, "y"), (-1, 1, "o"), (0, 1, "y"), (2, 1, "y"), (-1, 2, "y"), (1, 2, "o")],
    [(0, 0, "y"), (-1, 1, "y"), (0, 1, "o"), (1, 1, "o"), (-2, 2, "o"), (2, 2, "y")],
    [(0, 0, "o"), (1, 1, "o"), (-1, 1, "y"), (-1, 2, "o"), (1, 2, "y"), (3, 2, "o")],
]


def draw(s, f):
    # the piling: 4 px of wood, lit left, a brass band, from row 22 to the water
    for y in range(22, 29):
        s.px(3, y, G2)
        s.px(4, y, G1)
        s.px(5, y, G1)
        s.px(6, y, G0)
    s.line(3, 22, 6, 22, G2)
    s.px(5, 25, G0)
    s.px(4, 27, G0)
    # the iron post and its crook
    for y in range(4, 22):
        s.px(4, y, H2)
        s.px(5, y, H0)
    s.line(4, 20, 5, 20, B1)
    s.line(4, 21, 5, 21, B0)
    ascii_(s, 4, 1, [
        "..1111..",
        ".12..01.",
        "12....0.",
        "2.......",
    ])
    s.px(10, 2, H0)
    s.px(11, 3, H0)
    # outline everything drawn so far (the lantern brings its own ink)
    s.outline(INK)
    ascii_(s, 8, 4, LANTERN)
    for j, row in enumerate(FLAME[f]):
        ascii_(s, 10, 8 + j, [row])
    # waterline ripples round the piling
    for x in (1, 2, 7, 8):
        s.px(x, 30, P_I0)
    s.px(1, 30, T0)
    s.px(3, 30, SH)
    s.px(6, 30, SH)
    s.px(2, 31, P_I0)
    s.px(7, 31, P_I0)
    # the lantern's light on the water
    for dx, dy, ch in REFL[f]:
        s.px(11 + dx, 29 + dy, KEY["o"] if ch == "o" else KEY["y"])


P_I0 = I0


def build():
    s = new(16, 32, 4)
    for f in range(4):
        s.frame(f + 1)
        draw(s, f)
    s.frame(1)
    return s
