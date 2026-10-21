"""town_lamp: a lamp post on the Boardwalk, 16x32, 4 frames of a lantern flicker (fps 6).

A brass-and-glass lantern on a turned wooden post standing on a stone foot, so at 1x it says
"lamp post", not "pole". It stands on the promenade's railing line (src/render/town.ts puts its
bottom row on the deck's fascia), in front of the rail. The lantern is lit even by day (they
are lanterns, and the island is proud of them): warm glass with a hot core that moves; the
shape never moves. The bunting the Festival strings between lamps hangs from the lantern's
hook (sprite row 4, the middle column).
"""
from common_town import new, ascii_, P

LANTERN = [
    "....kk....",
    "...kZYk...",
    "..kZzzYk..",
    ".kzzzzzYk.",
    ".kkkkkkkk.",
    ".kz....Yk.",
    ".kz....Yk.",
    ".kz....Yk.",
    ".kz....Yk.",
    ".kz....Yk.",
    ".kkkkkkkk.",
    "..kYzzYk..",
    "...kkkk...",
]
# the glass's 4x5 inside per frame: W white glint, H lamp3, g lamp2, o lamp1
GLASS = [
    ["WgHg", "gHHg", "gHHo", "ogHo", "oggo"],
    ["WgHg", "gHHH", "gHHg", "ogHo", "oggo"],
    ["Wggg", "gHHg", "HHHg", "ogHg", "oggo"],
    ["WgHg", "gHgg", "gHHg", "oHHo", "oogo"],
]


def draw(s, f):
    # the post: a turned wooden post, lit left, with an iron collar
    for y in range(13, 27):
        s.px(7, y, P["wood4"])
        s.px(8, y, P["wood2"])
    s.px(7, 13, P["wood5"])
    for x in (6, 9):
        for y in range(13, 27):
            s.px(x, y, P["ink"])
    s.rect(6, 19, 9, 20, P["steel3"])
    s.px(6, 19, P["steel4"])
    s.px(9, 20, P["steel2"])
    s.px(5, 19, P["ink"])
    s.px(5, 20, P["ink"])
    s.px(10, 19, P["ink"])
    s.px(10, 20, P["ink"])
    # the stone foot
    ascii_(s, 4, 26, [
        "kkkkkkkk",
        "k999988k",
        "k888887k",
        "k888777k",
        "k777776k",
        "kkkkkkkk",
    ], key={"k": P["ink"], "9": P["pave3"], "8": P["pave2"], "7": P["pave1"], "6": P["pave0"]})
    s.px(4, 26, None)
    s.px(11, 26, None)
    # the lantern
    ascii_(s, 3, 1, LANTERN, key={"k": P["ink"], "Z": P["brass3"], "z": P["brass2"], "Y": P["brass1"]})
    rows = GLASS[f]
    key = {"W": P["cloud3"], "H": P["lamp3"], "g": P["lamp2"], "o": P["lamp1"]}
    for j, row in enumerate(rows):
        for i, ch in enumerate(row):
            s.px(6 + i, 6 + j, key[ch])
    # the hook ring on top (the bunting's anchor)
    s.px(7, 0, P["ink"])
    s.px(8, 0, P["ink"])


def build():
    s = new(16, 32, 4)
    for f in range(4):
        s.frame(f + 1)
        draw(s, f)
    s.frame(1)
    return s
