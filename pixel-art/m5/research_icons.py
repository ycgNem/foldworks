"""ui_research (16x16 x4, named): icons for the research nodes that only had a borrowed one.

The other Act II nodes already have a fitting icon in ui_icons that src/app/screens.ts NODE_ICON
does not use yet (surveying -> 'survey', overdrive -> 'overdrive', steamPower -> 'power',
heavyMachines -> 'heavy', tuning -> 'mode', greatDrill -> 'mega'); these four had nothing:

    surveyEast   a folded map with a gold arrow leaving it to the right (east)
    splitters    one belt in from the left, forking into two belts with gold chevron heads
    buffers      the wooden buffer crate with brass corners, an iron and a copper ingot on top
    nestedFolds  a module inside a module inside a module, each brass frame dog-eared: a fold of folds

Same recipe as pixel-art/ui/icons.py: each part on its own layer, ink-outlined by Parts.done(),
light from the top-left, a 1 px margin for the outline.
"""
import math
import sys
from common_m5 import P, new, ell, ROOT

sys.path.insert(0, str(ROOT / "pixel-art" / "ui"))
from icons import Parts  # noqa: E402
from icons_m4 import shade  # noqa: E402

k, bone, sh = P["ink"], P["bone"], P["shadow"]
g0, g1, g2 = P["ground0"], P["ground1"], P["ground2"]
h0, h1, h2, h3 = P["hull0"], P["hull1"], P["hull2"], P["hull3"]
i0, i1, i2 = P["iron0"], P["iron1"], P["iron2"]
b0, b1, gold, hot = P["brass0"], P["brass1"], P["gold"], P["hot"]
c0, c1, c2 = P["copper0"], P["copper1"], P["copper2"]
leaf, moss, t1 = P["leaf"], P["moss"], P["teal1"]

NAMES = ["surveyEast", "splitters", "buffers", "nestedFolds"]


def i_survey_east(s, pp):
    m = pp.part()                                    # the map: three panels, folds in shade
    m.rect(1, 3, 10, 13, bone)
    m.line(4, 3, 4, 13, h3)
    m.line(7, 3, 7, 13, h3)
    m.line(1, 13, 10, 13, h3)
    for (x, y) in ((2, 4), (3, 5)):                  # a pond and the shoreline
        m.px(x, y, t1)
    m.px(2, 5, P["teal0"])
    for (x, y) in ((2, 11), (3, 10), (5, 10), (6, 9), (8, 8)):   # the dashed route, copper
        m.px(x, y, c1)
    m.px(5, 6, moss); m.px(6, 6, leaf); m.px(9, 11, moss)
    a = pp.part()                                    # the arrow, east, leaving the map
    a.rect(8, 7, 11, 8, gold)
    for j in range(4):
        a.line(11 + j, 4 + j, 11 + j, 11 - j, gold)
    a.line(8, 8, 13, 8, b1)
    a.px(14, 8, b1); a.px(13, 9, b1); a.px(12, 10, b1)
    a.px(11, 4, hot); a.px(8, 7, hot)


def i_splitters(s, pp):
    b = pp.part()                                    # a 2 px belt in, forking into two
    b.rect(1, 7, 6, 8, h2)
    b.line(1, 8, 6, 8, h1)
    for i in range(5):
        b.rect(6 + i, 6 - i, 7 + i, 7 - i, h2)       # up-right
        b.rect(6 + i, 8 + i, 7 + i, 9 + i, h2)       # down-right
        b.px(7 + i, 9 + i, h1)
    b.px(6, 7, h3); b.px(2, 7, h3)
    a = pp.part()                                    # two chevron heads in gold
    for (x0, y0, dy) in ((9, 1, 1), (9, 14, -1)):
        a.line(x0, y0, x0 + 4, y0, gold)
        a.line(x0 + 4, y0, x0 + 4, y0 + 4 * dy, gold)
        a.line(x0 + 1, y0 + dy, x0 + 3, y0 + dy, gold)
        a.line(x0 + 3, y0 + dy, x0 + 3, y0 + 3 * dy, gold)
        a.px(x0, y0, hot)
    c = pp.part()                                    # an iron ingot riding in
    c.rect(1, 4, 3, 5, i1)
    c.px(1, 4, i2); c.px(2, 4, i2); c.px(3, 5, i0)


def i_buffers(s, pp):
    c = pp.part()                                    # the crate
    c.rect(1, 6, 14, 14, g2)
    for y in (8, 11):
        c.line(2, y, 13, y, g1)
    c.line(1, 14, 14, 14, g0)
    c.line(14, 6, 14, 14, g1)
    c.line(2, 7, 12, 13, g1)                         # the brace
    c.line(2, 6, 13, 6, P["copper2"])
    for (x, y) in ((1, 6), (14, 6), (1, 14), (14, 14)):
        c.px(x, y, b1)
    c.px(1, 6, gold)
    i = pp.part()                                    # an iron ingot on the lid
    i.polygon([(2, 4), (7, 4), (8, 2), (3, 2)], i1)
    i.line(3, 2, 7, 2, i2)
    i.line(2, 4, 7, 4, i0)
    j = pp.part()                                    # and a copper one leaning on it
    j.polygon([(8, 4), (13, 4), (12, 1), (9, 1)], c1)
    j.line(9, 1, 12, 1, c2)
    j.line(8, 4, 13, 4, c0)


def frame_sq(s, x0, y0, x1, y1, outer=True):
    """A brass module frame with its dog-eared bottom-left corner."""
    s.rect(x0, y0, x1, y1, b1)
    s.line(x0, y0, x1, y0, gold)
    s.line(x0, y0, x0, y1, gold)
    s.line(x1, y0 + 1, x1, y1, b0)
    s.line(x0 + 1, y1, x1, y1, b0)
    s.px(x0, y1, None)
    s.px(x0 + 1, y1, b0)
    s.px(x0, y1 - 1, b0)


def i_nested(s, pp):
    a = pp.part()
    frame_sq(a, 1, 1, 14, 14)
    a.rect(3, 3, 12, 12, None)
    b = pp.part()
    frame_sq(b, 4, 4, 11, 11)
    b.rect(6, 6, 9, 9, None)
    c = pp.part()
    c.rect(7, 7, 8, 8, gold)
    c.px(7, 7, hot)


FNS = [i_survey_east, i_splitters, i_buffers, i_nested]


def build():
    s = new(16, 16, len(FNS))
    for i, fn in enumerate(FNS):
        s.frame(i + 1)
        pp = Parts(s)
        fn(s, pp)
        pp.done()
    s.frame(1)
    return s
