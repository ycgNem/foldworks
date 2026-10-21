"""The Boardwalk (Bramble's order: "My frogs keep falling off the edge!"), on the sky island: a
wooden promenade along the plot's north edge with a railing, so the frogs stroll instead.

town_boardwalk: 16x16 deck tiles, 13 named variants (fps 0). The deck is a plank band (rows 3-12
across a horizontal tile, columns 3-12 down a vertical one) that runs to the tile edge on every
connected side, so tiles join seamlessly. Long boards run along the walk (3 px each, staggered
ends; boards across it read as a fence behind the rail at 1x), the far edge lit, the near edge
a 2 px timber fascia, the ink outline round it all, a two-tread step down off each end. No
stilts, no water: it sits on the ground (meadow or steel deck).
Names: h, v; corner_ws, end_e; corner_es, corner_wn, corner_en, end_w, end_n, end_s; tee_s
(W+E+S), tee_n (W+E+N), cross. src/render/town.ts lays end_w, h... h, end_e on the row above the
plot; the rest are kept for the frame order (and any future turn).

town_rail: 16x16, 3 named variants (fps 0): h, end_w, end_e. The railing on the deck's near
(plot) side, drawn after the frogs, the stalls and the deck so the frogs walk behind it: a low
lit rail on rows 9-10 (the frogs' feet are on row 7, so they show whole above it), short posts
every 8 px down to the fascia, the ends a stout newel post with an iron cap (the order wanted
"Iron, flat": the caps and brackets are iron).

town_tuft: 16x8, 4 variants (fps 0): grass clumps the Workshop puts at the corners of a house's
footing, so a house sits in its meadow instead of on it (no outline: grass on grass). The
Factory's deck gets none.
"""
from common_town import new, ascii_, P

ORDER = ["h", "v", "corner_ws", "end_e", "corner_es", "corner_wn", "corner_en",
         "end_w", "end_n", "end_s", "tee_s", "tee_n", "cross"]
ARMS = {
    "h": "we", "v": "ns", "corner_ws": "ws", "end_e": "w", "corner_es": "es", "corner_wn": "wn",
    "corner_en": "en", "end_w": "e", "end_n": "s", "end_s": "n", "tee_s": "wes", "tee_n": "wen", "cross": "nswe",
}
RAIL_ORDER = ["h", "end_w", "end_e"]
A0, A1 = 3, 12   # the band's first and last pixel across the tile
INK = P["ink"]
# the end tiles stop the deck short of the outer edge, with a wooden step down
END_IN = 3


def mask(name):
    arms = ARMS[name]
    m = set()
    lo, hi = A0, A1
    for y in range(A0, A1 + 1):
        for x in range(A0, A1 + 1):
            m.add((x, y))
    for a in arms:
        for t in range(16):
            for k in range(A0, A1 + 1):
                if a == "w" and t < A0:
                    m.add((t, k))
                if a == "e" and t > A1:
                    m.add((t, k))
                if a == "n" and t < A0:
                    m.add((k, t))
                if a == "s" and t > A1:
                    m.add((k, t))
    # the horizontal ends: the deck runs from the connected side to END_IN px off the far edge
    if name == "end_w":
        m |= {(x, y) for x in range(END_IN, A0) for y in range(A0, A1 + 1)}
    if name == "end_e":
        m |= {(x, y) for x in range(A1 + 1, 16 - END_IN) for y in range(A0, A1 + 1)}
    return m, arms


def inside(m, arms, x, y):
    if (x, y) in m:
        return True
    if x < 0 and "w" in arms and A0 <= y <= A1:
        return True
    if x > 15 and "e" in arms and A0 <= y <= A1:
        return True
    if y < 0 and "n" in arms and A0 <= x <= A1:
        return True
    if y > 15 and "s" in arms and A0 <= x <= A1:
        return True
    return False


def draw(s, name):
    m, arms = mask(name)
    vert_only = name in ("v", "end_n", "end_s")

    def board_v(x, y):
        # a vertical band (n/s arm) has its boards across it, i.e. horizontal seams
        return vert_only or (A0 <= x <= A1 and ((y < A0 and "n" in arms) or (y > A1 and "s" in arms)))

    # the fascia: 2 rows under every open bottom edge of the deck
    face = set()
    for (x, y) in m:
        if not inside(m, arms, x, y + 1):
            for d in (1, 2):
                if y + d <= 15:
                    face.add((x, y + d))
    solid = m | face
    for (x, y) in m:
        # long boards along the walk, a seam between every 3 px board, staggered board ends
        col = P["wood4"]
        if board_v(x, y):
            band = (x - A0) // 3
            if (x - A0) % 3 == 2 or y == (5 + band * 6) % 16:
                col = P["wood3"]
        else:
            band = (y - A0) // 3
            if (y - A0) % 3 == 2 or x == (5 + band * 6) % 16:
                col = P["wood3"]
        if not inside(m, arms, x, y - 1):
            col = P["wood5"]
        elif not inside(m, arms, x - 1, y):
            col = P["wood5"]
        elif not inside(m, arms, x + 1, y):
            col = P["wood3"]
        s.px(x, y, col)
    for (x, y) in face:
        top = (x, y - 1) in m
        s.px(x, y, P["wood2"] if top else P["wood1"])
        if x % 8 in (3, 4):
            s.px(x, y, P["wood1"] if top else P["wood0"])
    # the outline: an ink ring round deck + fascia inside the tile (open arms run off the edge)
    for y in range(16):
        for x in range(16):
            if (x, y) in solid:
                continue
            if any((x + dx, y + dy) in solid for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))):
                s.px(x, y, INK)
    # the ends: a two-tread wooden step down off the outer end
    if name == "end_w":
        steps(s, END_IN - 1, -1)
    if name == "end_e":
        steps(s, 16 - END_IN, +1)


def steps(s, x_edge, d):
    """Two treads down from the deck's outer end at column x_edge, going outward (d = -1 west,
    +1 east): the upper tread on rows 8-10, the lower one on rows 11-13, each lit on top."""
    for k, (y0, y1) in enumerate(((8, 10), (11, 13))):
        xs = [x_edge + d * i for i in range(0, 2 + k)]
        for x in xs:
            if not 0 <= x <= 15:
                continue
            s.px(x, y0, P["wood5"])
            for y in range(y0 + 1, y1 + 1):
                s.px(x, y, P["wood2"] if y < y1 else P["wood1"])
        xo = x_edge + d * (2 + k)
        for y in range(y0 - 1, y1 + 2):
            if 0 <= xo <= 15:
                s.px(xo, y, INK)
        for x in xs:
            if 0 <= x <= 15:
                if s.get(x, y0 - 1) is None:
                    s.px(x, y0 - 1, INK)
                s.px(x, y1 + 1, INK)
    s.px(x_edge, 14, INK)
    s.px(x_edge + d, 14, INK)


def build():
    s = new(16, 16, len(ORDER))
    for i, name in enumerate(ORDER):
        s.frame(i + 1)
        draw(s, name)
    s.frame(1)
    return s


# ------------------------------------------------------------------ the railing
POSTS = (3, 11)
RAIL_Y = 9   # the top rail's lit row (row 10 its shade; ink on 8 and 11)
POST_BOT = 13


def rail_run(s, x0, x1):
    """The rail from column x0 to x1: ink above and below, a lit top, its shade under."""
    for x in range(x0, x1 + 1):
        s.px(x, RAIL_Y - 1, INK)
        s.px(x, RAIL_Y, P["wood5"])
        s.px(x, RAIL_Y + 1, P["wood3"])
        s.px(x, RAIL_Y + 2, INK)


def post(s, x):
    """A short post under the rail (columns x, x+1) down to the fascia, an iron bracket on it."""
    for y in range(RAIL_Y + 2, POST_BOT + 1):
        s.px(x, y, P["wood4"])
        s.px(x + 1, y, P["wood2"])
        s.px(x - 1, y, INK)
        s.px(x + 2, y, INK)
    s.px(x, RAIL_Y + 1, P["steel3"])
    s.px(x + 1, RAIL_Y + 1, P["steel2"])


def newel(s, x):
    """The stout end post (columns x..x+2) from row 6, capped in iron, over the rail's end."""
    top = 6
    for y in range(top, POST_BOT + 1):
        s.px(x, y, P["wood4"])
        s.px(x + 1, y, P["wood3"])
        s.px(x + 2, y, P["wood2"])
        s.px(x - 1, y, INK)
        s.px(x + 3, y, INK)
    s.px(x, top, P["wood5"])
    # an iron cap, a pixel wider each side
    s.line(x - 1, top - 3, x + 3, top - 3, INK)
    s.px(x - 2, top - 2, INK)
    s.px(x + 4, top - 2, INK)
    s.line(x - 1, top - 2, x + 3, top - 2, P["steel3"])
    s.px(x - 1, top - 2, P["steel4"])
    s.px(x + 3, top - 2, P["steel2"])
    s.line(x - 1, top - 1, x + 3, top - 1, INK)


def draw_rail(s, name):
    if name == "h":
        rail_run(s, 0, 15)
        for x in POSTS:
            post(s, x)
    elif name == "end_w":
        rail_run(s, 5, 15)
        post(s, 11)
        newel(s, 3)
    elif name == "end_e":
        rail_run(s, 0, 10)
        post(s, 3)
        newel(s, 10)


def build_rail():
    s = new(16, 16, len(RAIL_ORDER))
    for i, name in enumerate(RAIL_ORDER):
        s.frame(i + 1)
        draw_rail(s, name)
    s.frame(1)
    return s


# ------------------------------------------------------------------ grass tufts
TUFTS = [
    [
        "..V.....",
        ".VF.V...",
        "VFGFF.V.",
        "FGjGFVF.",
        "jGjjGjG.",
    ],
    [
        "....V...",
        ".V..FV..",
        ".FVGF.V.",
        "VGFjGFF.",
        "GjjGjjG.",
    ],
    [
        "........",
        "..V..V..",
        ".VFV.FV.",
        "VFGFVGF.",
        "GjGjjjG.",
    ],
    [
        ".....V..",
        "..V.VF..",
        "V.FVFGV.",
        "FVGjFGF.",
        "jGjGjGj.",
    ],
]


def build_tuft():
    s = new(16, 8, len(TUFTS))
    for i, rows in enumerate(TUFTS):
        s.frame(i + 1)
        ascii_(s, 4, 3, rows)
    s.frame(1)
    return s
