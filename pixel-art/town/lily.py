"""town_lily: swamp decorations to scatter on the water, 16x16, 6 variants (fps 0).

Lily pads are seen from above-front, so they are wider than tall: leaf top, moss rim on the
bottom-right (their thickness against the light), a notch cut toward the centre, moss veins.
Reeds and cattails stand up from a ripple. No ink outline on pads (the water is ink already);
reed stalks get ink only where they cross each other.
Order: pad, pads, flower, reeds, cattails, buds.
"""
from common_town import new, ell, I0, T0, SH, MOSS, LEAF, C0, C1, C2, BONE, HOT, B1, G1, H3

ORDER = ["pad", "pads", "flower", "reeds", "cattails", "buds"]


def pad(s, cx, cy, rx, ry, notch=1):
    """A pad centred on pixel edges (cx, cy). notch: +1 opens to the right-front, -1 left-front."""
    ell(s, cx, cy + 0.6, rx, ry, MOSS)
    ell(s, cx - 0.3, cy, rx - 0.4, ry - 0.5, LEAF)
    # the notch: a thin wedge from the centre to the front rim
    x, y = int(cx), int(cy)
    for k in range(0, int(ry) + 2):
        xx = x + (k + 1) // 2 * notch
        s.px(xx, y + k, None)
        if k >= 2:
            s.px(xx - notch, y + k, None)
    # veins: two short moss lines from the centre
    s.px(x - 2, y - 1, MOSS)
    s.px(x - 3, y - 1, MOSS) if rx > 3.5 else None
    s.px(x + 1 - (notch < 0) * 3, y - 1, MOSS)
    # a wet glint on the lit rim
    s.px(int(cx - rx * 0.55), int(cy - ry * 0.6), HOT if rx > 4 else LEAF)


def ripple_under(s, x0, x1, y):
    for x in range(x0, x1 + 1):
        if (x - x0) % 3 != 2:
            s.px(x, y, I0)
    s.px(x0, y, T0)


def reed(s, x, ytop, ybot, head=False, lean=0):
    for y in range(ytop, ybot + 1):
        xx = x + (lean if y < ytop + (ybot - ytop) // 3 else 0)
        s.px(xx, y, LEAF if y < ytop + 2 else MOSS)
    if head:
        hx = x + lean
        s.px(hx, ytop - 3, LEAF)
        s.px(hx, ytop - 2, C0)
        s.px(hx, ytop - 1, C0)
        s.px(hx - 1, ytop - 1, C1) if False else None
        s.px(hx, ytop, C1)


def draw(s, name):
    if name == "pad":
        pad(s, 8, 8, 6, 4, 1)
    elif name == "pads":
        pad(s, 6, 6, 4.5, 3, 1)
        pad(s, 11, 11, 4, 2.6, -1)
        pad(s, 3.5, 12, 2.5, 1.6, 1)
    elif name == "flower":
        pad(s, 8, 10, 6, 3.6, 1)
        # a lotus: bone petals, peach (copper2) tips, a hot heart
        for (x, y, c) in ((7, 4, BONE), (5, 6, BONE), (6, 5, C2), (8, 5, BONE), (9, 6, BONE), (10, 6, C2),
                          (6, 7, BONE), (7, 7, C2), (8, 7, BONE), (9, 7, BONE), (7, 6, HOT), (8, 6, B1),
                          (6, 6, BONE), (7, 5, BONE), (9, 5, C2), (5, 7, C2), (10, 7, BONE),
                          (6, 8, C1), (7, 8, C1), (8, 8, C1), (9, 8, C1)):
            s.px(x, y, c)
    elif name == "reeds":
        for (x, yt, lean) in ((5, 3, -1), (7, 1, 0), (8, 5, 0), (10, 2, 1), (11, 6, 0)):
            reed(s, x, yt, 13, lean=lean)
        ripple_under(s, 3, 13, 14)
        s.px(6, 14, SH)
        s.px(9, 14, SH)
    elif name == "cattails":
        for (x, yt, lean, head) in ((4, 6, 0, True), (6, 3, -1, False), (8, 4, 0, True), (10, 7, 1, False),
                                    (11, 5, 0, True)):
            reed(s, x, yt, 13, head=head, lean=lean)
        ripple_under(s, 2, 13, 14)
        s.px(5, 14, SH)
        s.px(9, 14, SH)
    elif name == "buds":
        pad(s, 5, 9, 3.6, 2.4, 1)
        pad(s, 11, 6, 3, 2, -1)
        pad(s, 11, 12, 2.6, 1.6, 1)
        # a closed bud on a stalk
        s.px(8, 12, MOSS)
        s.px(8, 11, MOSS)
        s.px(8, 10, C2)
        s.px(8, 9, BONE)
        s.px(7, 10, C2)
        s.px(9, 10, C1)
        ripple_under(s, 6, 10, 13)


def build():
    s = new(16, 16, len(ORDER))
    for i, name in enumerate(ORDER):
        s.frame(i + 1)
        draw(s, name)
    s.frame(1)
    return s
