"""The splitter and the merger, hand-drawn in 3/4 view with four facings (phase 3: the last flat
machines). A squat steel router box on the machines' skid; its top plate carries the rule as
brass arrows, so the two are told apart by the arrowheads, not by colour:

- splitter: one way in at the back, the heads point *out* (forward, left, right);
- merger: three ways in, the heads point *in* to the middle and one goes out the front.

The way out (the front) is lit brass3/lamp2, the ways in are dim brass1. Rows east, south, west,
north; one frame each (routers don't animate: their pip and the items say if they work)."""
from PIL import Image

from common import P, new, draw, rect, export, from_rows
from machines import seat

INK = P["ink"]

# 9x9 glyphs facing east; O = the way out (bright), I = the way in (dim), H = a head that points out
SPLIT = [            # chevrons at the edges point out; a hub in the middle
    "....O....",
    "...O.O...",
    "..O...O..",
    "...hhh.O.",
    "IIIhch..O",
    "...hhh.O.",
    "..O...O..",
    "...O.O...",
    "....O....",
]
MERGE = [            # chevrons at the edges point in; one goes out the front
    "..I...I..",
    "...I.I...",
    "....I....",
    "I..hhh.O.",
    ".I.hch..O",
    "I..hhh.O.",
    "....I....",
    "...I.I...",
    "..I...I..",
]
KEY = {"O": P["lamp2"], "I": P["brass1"], "h": P["brass2"], "c": P["brass3"]}


def glyph(rows, rot):
    g = from_rows(rows, KEY)
    return g.rotate(-90 * rot, expand=False) if rot else g


def router(rows, rot):
    img = new(16, 16)
    # body: top plate rows 2-10 (lit edge top and left), front face rows 11-12, outline round both
    rect(img, 1, 1, 14, 13, INK)
    rect(img, 2, 2, 13, 10, P["steel2"])
    rect(img, 2, 2, 13, 2, P["steel3"])
    rect(img, 2, 2, 2, 10, P["steel3"])
    rect(img, 2, 11, 13, 12, P["steel1"])
    draw(img, [(x, 11) for x in range(2, 14)], P["steel0"])
    draw(img, [(3, 12), (12, 12)], P["steel2"])                               # bolts on the face
    # ports: a notch in the rim at the middle of each side that is used, the way out lit
    sides = {0: [(14, 5), (14, 6)], 1: [(7, 13), (8, 13)], 2: [(1, 5), (1, 6)], 3: [(7, 1), (8, 1)]}
    outs = [rot]
    ins = [(rot + 2) % 4]
    side_dirs = [(rot + 1) % 4, (rot + 3) % 4]
    if rows is SPLIT:
        outs += side_dirs
    else:
        ins += side_dirs
    for d in outs:
        draw(img, sides[d], P["lamp2"])
    for d in ins:
        draw(img, sides[d], P["brass1"])
    # the rule on the top plate, centred on (7.5, 6)
    img.alpha_composite(glyph(rows, rot), (3, 2))
    return seat(img)


def build():
    for name, rows in (("splitter", SPLIT), ("merger", MERGE)):
        export(name, [[router(rows, r)] for r in range(4)], 0, facings=4)


if __name__ == "__main__":
    build()
