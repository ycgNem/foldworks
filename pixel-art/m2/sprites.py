"""Milestone 2 sprites: swamp water and its banks, the toast and tooltip boxes, the Fold tool's
corner brackets, confetti and the stamp's burst, Mayor Bramble cheering, the 8x8 UI icons and
the running module's rim light. Every pixel is placed here; build.py exports and previews.
"""
import math
from common_m2 import P, new, ell, ring, ascii_, bring, fr, KEY

k, sh, bone = P["ink"], P["shadow"], P["bone"]
g0, g1, g2 = P["ground0"], P["ground1"], P["ground2"]
h0, h1, h2, h3 = P["hull0"], P["hull1"], P["hull2"], P["hull3"]
i0, i1, i2 = P["iron0"], P["iron1"], P["iron2"]
c0, c1, c2 = P["copper0"], P["copper1"], P["copper2"]
b0, b1, gold, hot, glow = P["brass0"], P["brass1"], P["gold"], P["hot"], P["glow"]
t0, t1 = P["teal0"], P["teal1"]
moss, leaf, violet, slag = P["moss"], P["leaf"], P["violet"], P["slag"]


# ===================================================================== 1. tile_water
# Ink water. Every feature sits inside x1..14, y1..14, so the tile is seamless in both axes
# whatever frame its neighbours show (the game may offset the frame per tile for variety).
# A ripple is a shallow arc: its crest row in iron0, a teal0 highlight sliding along the crest,
# and on a "glinting" ripple a single teal1 sparkle on one frame of the four.
STREAKS = [  # (x, y, length, phase, glint): horizontal reflections, calm and sparse
    (1, 2, 6, 0, True),
    (10, 5, 4, 2, False),
    (4, 9, 7, 1, False),
    (11, 12, 4, 3, True),
    (2, 14, 3, 2, False),
]
MURK = [(13, 1), (7, 6), (1, 11)]  # static shadow motes, deeper down


def draw_water(s, f):
    s.rect(0, 0, 15, 15, k)
    for (x, y) in MURK:
        s.px(x, y, sh)
    for (x, y, n, ph, glint) in STREAKS:
        p = (f + ph) % 4
        x0, x1 = x, x + n - 1
        if p == 3:                       # the rest frame: the streak draws in a pixel at each end
            x0, x1 = x0 + 1, x1 - 1
        for xx in range(x0, x1 + 1):
            s.px(xx, y, i0)
        if p < 3 and n >= 4:
            hx = x + 1 + (p * (n - 3)) // 2      # the glint slides left to right along it
            s.px(hx, y, t0)
            if glint and p == 1:
                s.px(hx, y, t1)


def water():
    s = new(16, 16, 4)
    for f in range(4):
        s.frame(f + 1)
        draw_water(s, f)
    s.frame(1)
    return s


# ===================================================================== 2. tile_shore
# Drawn ON a water tile beside land. Frame = side the land is on: 0 N, 1 E, 2 S, 3 W.
# u runs along the coast (0..15), v is the distance from the land edge into the water.
# The bank profile has period 16 and equal depth at both ends, so a straight coast tiles.
DEPTH = [5, 5, 6, 6, 5, 4, 4, 5, 6, 7, 7, 6, 5, 5, 4, 5]
SPECK = [(2, 0), (7, 1), (12, 0), (10, 3), (5, 2), (14, 1)]


def _map(side, u, v):
    if side == 0:
        return u, v
    if side == 1:
        return 15 - v, u
    if side == 2:
        return 15 - u, 15 - v
    return v, 15 - u


def draw_shore(s, side):
    lit = side in (1, 2)   # banks facing the top-left light (land east or south) catch it
    for u in range(16):
        d = DEPTH[u]
        for v in range(d + 1):
            if v <= d - 3:
                col = g0                                   # the bank top: wet mud
            elif v == d - 2:
                col = g2 if lit else sh                    # the slope down to the water
            elif v == d - 1:
                col = g1 if lit else sh
            else:
                if (u * 5 + side) % 7 in (0, 1, 3, 5):    # the waterline, broken
                    col = t0 if lit else i0
                else:
                    continue
            x, y = _map(side, u, v)
            s.px(x, y, col)
    for (u, v) in SPECK:
        if v <= DEPTH[u] - 3:
            x, y = _map(side, u, v)
            s.px(x, y, g1)
    # reeds stand up in screen space whatever the side: a clump and a lone stalk at the water
    def stalk(u, hgt, col, head=False):
        x, y = _map(side, u, DEPTH[u] - 1)
        for j in range(hgt):
            if 0 <= y - j < 16 and 0 <= x < 16:
                s.px(x, y - j, moss if j == 0 else col)
        if head and 0 <= y - hgt < 16:
            s.px(x, y - hgt + 1, c0)
            s.px(x, y - hgt + 2, c0)
            if y - hgt >= 0:
                s.px(x, y - hgt, leaf)
    ua = [3, 12, 4, 11][side]
    stalk(ua - 1, 3, leaf)
    stalk(ua, 5, leaf, head=True)
    stalk(ua + 1, 2, moss)
    # one lily pad afloat, the notch toward the bank; a bloom on the lit banks
    lu = [9, 7, 8, 6][side]
    lx, ly = _map(side, lu, DEPTH[lu] + 2)
    lx = min(max(lx, 2), 11)
    ly = min(max(ly, 2), 12)
    pad = [".mmm.", "mlllm", "mllmm", ".mmm."]
    for j, row in enumerate(pad):
        for i, ch in enumerate(row):
            if ch != ".":
                s.px(lx + i - 1, ly + j - 1, moss if ch == "m" else leaf)
    s.px(lx + 2, ly + 1, k)                          # the notch, a dark slit to the centre
    s.px(lx + 3, ly + 1, None)
    if lit:
        s.px(lx, ly, c2)
        s.px(lx - 1, ly, bone)


def shore():
    s = new(16, 16, 4)
    for f in range(4):
        s.frame(f + 1)
        draw_shore(s, f)
    s.frame(1)
    return s


# ===================================================================== 3. ui_toast (9-slice)
def toast():
    W = 24
    s = new(W, W)
    rings = [(k, k), (b1, b0), (b0, b1), (k, k)]
    for i, (tl, br) in enumerate(rings):
        bring(s, i, i, W - 1 - i, W - 1 - i, tl, br)
    s.rect(4, 4, W - 5, W - 5, i0)                 # navy enamel face
    s.line(4, 4, W - 5, 4, i1)                     # lit inner bevel
    s.line(4, 5, 4, W - 6, i1)
    s.line(5, W - 5, W - 5, W - 5, k)             # shaded floor
    for (x, y) in ((3, 2), (9, 7), (1, 9), (6, 4)):
        s.px(6 + x, 6 + y, h0)                     # enamel flecks on a 12x12 tile
    # top-left: a brass plate carrying a lit lamp (the corner piece, 6x6)
    for (cx, cy, lamp) in ((0, 0, True), (0, W - 6, False)):
        s.rect(cx, cy, cx + 5, cy + 5, k)
        s.rect(cx + 1, cy + 1, cx + 4, cy + 4, b1)
        s.line(cx + 1, cy + 1, cx + 3, cy + 1, gold)
        s.line(cx + 1, cy + 1, cx + 1, cy + 3, gold)
        s.line(cx + 2, cy + 4, cx + 4, cy + 4, b0)
        s.line(cx + 4, cy + 2, cx + 4, cy + 4, b0)
        if lamp:
            s.rect(cx + 2, cy + 2, cx + 3, cy + 3, glow)
            s.px(cx + 2, cy + 2, hot)
            s.px(cx + 3, cy + 3, c1)
        else:
            s.px(cx + 2, cy + 2, hot); s.px(cx + 3, cy + 2, gold)
            s.px(cx + 2, cy + 3, gold); s.px(cx + 3, cy + 3, b0)
        s.px(cx, cy, None)
    s.px(0, 0, None); s.px(0, W - 1, None)
    s.px(W - 1, 0, None); s.px(W - 1, W - 1, None)
    return s


# ===================================================================== 4. ui_tip (9-slice)
def tip():
    W = 12
    s = new(W, W)
    s.rect(0, 0, W - 1, W - 1, b1)
    s.rect(1, 1, W - 2, W - 2, k)
    for (cx, cy, dx, dy) in ((0, 0, 1, 1), (W - 1, 0, -1, 1), (0, W - 1, 1, -1), (W - 1, W - 1, -1, -1)):
        s.px(cx, cy, None)
        s.px(cx + dx, cy, None)
        s.px(cx, cy + dy, None)
        s.px(cx + dx, cy + dy, b1)
    return s


# ===================================================================== 5. fold_corner
# 8x8 L-brackets, frames TL TR BL BR. Each frame's outer corner is the box corner: TL is drawn
# at the box's (x0, y0), TR at (x1 - 7, y0), BL at (x0, y1 - 7), BR at (x1 - 7, y1 - 7).
def corner(s, fx, fy):
    def P_(x, y):
        return (7 - x if fx else x, 7 - y if fy else y)

    cells = {}
    for x in range(8):
        for y in range(4):
            cells[(x, y)] = k
    for x in range(4):
        for y in range(8):
            cells[(x, y)] = k
    # brass bands: horizontal arm rows 1-2, vertical arm columns 1-2
    for x in range(1, 7):
        for y in (1, 2):
            cells[(x, y)] = "h"
    for y in range(1, 7):
        for x in (1, 2):
            cells[(x, y)] = "v"
    for (x, y), v in cells.items():
        X, Y = P_(x, y)
        if v == k:
            s.px(X, Y, k)
            continue
        if v == "h":
            # rows in screen space: the upper row is lit
            upper = (Y == min(P_(x, 1)[1], P_(x, 2)[1]))
            col = gold if upper else b1
            if x == 6:
                col = b1 if upper else b0
        else:
            left = (X == min(P_(1, y)[0], P_(2, y)[0]))
            col = gold if left else b1
            if y == 6:
                col = b1 if left else b0
        s.px(X, Y, col)
    # the corner rivet: a hot glint up-left, a brass shade down-right (screen space)
    xs = [P_(1, 1)[0], P_(2, 2)[0]]
    ys = [P_(1, 1)[1], P_(2, 2)[1]]
    x0, x1 = min(xs), max(xs)
    y0, y1 = min(ys), max(ys)
    s.px(x0, y0, hot); s.px(x1, y0, gold); s.px(x0, y1, gold); s.px(x1, y1, b0)


def fold_corners():
    s = new(8, 8, 4)
    for f, (fx, fy) in enumerate(((0, 0), (1, 0), (0, 1), (1, 1))):
        s.frame(f + 1)
        corner(s, fx, fy)
    s.frame(1)
    return s


# ===================================================================== 6. fx_confetti
FLAKES = [
    ["HggY", "gYYy", "....", "...."],        # gold slip
    ["...p", "..Cc", ".Cc.", "Cc.."],        # copper ribbon, twisting
    ["..T.", ".TTt", "Ttt.", ".t.."],        # teal tilted square
    ["l...", "ll..", "llm.", "lmmm"],        # leaf triangle
    [".vv.", "vvvx", "vvxx", ".xx."],        # violet disc
    ["JJI.", "JII.", "III.", "...."],        # iron square
    ["o...", ".o..", "o...", ".o.."],        # glow streamer
    [".H..", "HgH.", ".H..", "...."],        # a sparkle
]


def confetti():
    s = new(4, 4, len(FLAKES))
    for f, rows in enumerate(FLAKES):
        s.frame(f + 1)
        ascii_(s, 0, 0, rows)
    s.frame(1)
    return s


# ===================================================================== 7. fx_burst
# 16 tapered rays, long and short alternating; the set turns 7.5 degrees a frame, so six frames
# turn it by one long-to-long period (45 degrees) and the loop is seamless at 15 fps.
def draw_burst(s, f):
    """Sixteen fixed rays (no rotation, so the axis and diagonal rays stay crisp): eight long on
    the axes and diagonals, eight short between them. A hot pulse runs out along each ray over
    the six frames (the short set half a cycle behind) and sparks twinkle past the long tips."""
    C = 16.0
    rays = []
    for i in range(16):
        ang = i * math.pi / 8
        long_ = i % 2 == 0
        rays.append((math.cos(ang), math.sin(ang), 15.0 if long_ else 10.0, 2.1 if long_ else 1.3,
                     0 if long_ else 3))
    for y in range(32):
        for x in range(32):
            dx, dy = x + 0.5 - C, y + 0.5 - C
            r = math.hypot(dx, dy)
            if r < 2.9:
                s.px(x, y, hot)
                continue
            for (cx, cy, L, w0, off) in rays:
                t = dx * cx + dy * cy
                if t <= 0 or t >= L:
                    continue
                d = abs(dx * cy - dy * cx)
                if d > w0 * (1 - t / L) + 0.35:
                    continue
                u = t / L
                pulse = ((f + off) % 6) / 6.0           # where the hot pulse is, 0..1 along
                if abs(u - pulse) < 0.14 or u < 0.25:
                    col = hot
                elif u < 0.65:
                    col = gold
                else:
                    col = glow
                s.px(x, y, col)
                break
    for i in range(0, 16, 2):
        if (i // 2 + f) % 3:
            continue
        cx, cy = math.cos(i * math.pi / 8), math.sin(i * math.pi / 8)
        x, y = int(C + cx * 14.6), int(C + cy * 14.6)
        x = min(max(x, 1), 30); y = min(max(y, 1), 30)
        for (ddx, ddy) in ((0, 0), (1, 0), (-1, 0), (0, 1), (0, -1)):
            s.px(x + ddx, y + ddy, hot if (ddx, ddy) == (0, 0) else gold)


def burst():
    s = new(32, 32, 6)
    for f in range(6):
        s.frame(f + 1)
        draw_burst(s, f)
    s.frame(1)
    return s


# ===================================================================== 8. portrait_bramble_cheer
class Parts:
    def __init__(self, s, tag):
        self.s, self.tag, self.names = s, tag, []

    def part(self, name):
        nm = f"{self.tag}_{name}"
        self.s.layer(nm)
        if nm not in self.names:
            self.names.append(nm)
        return self.s

    def done(self, shifts=None):
        for nm in self.names:
            self.s.use(layer=nm)
            key = nm.split("_", 1)[1]
            if shifts and key in shifts:
                self.s.shift(*shifts[key])
            self.s.outline(k)
        self.s.use(layer="main")


def tline(s, pts, w, col):
    """A thick polyline: a w x w stamp along each segment."""
    for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
        n = max(abs(x1 - x0), abs(y1 - y0), 1)
        for i in range(n + 1):
            x = round(x0 + (x1 - x0) * i / n)
            y = round(y0 + (y1 - y0) * i / n)
            s.rect(x, y, x + w - 1, y + w - 1, col)


def bramble_cheer(s, hi):
    """hi = 0 or 1: frame 1 is the top of the bounce (head 1 px up, arms and hat 2 px up)."""
    pp = Parts(s, f"c{s.current_frame}")
    # --- body: identical coat, sash, medal and bow tie to portrait_bramble
    b = pp.part("body")
    b.polygon([(4, 47), (7, 41), (15, 36), (33, 36), (41, 41), (44, 47)], i0)
    b.polygon([(6, 46), (8, 41), (15, 37), (22, 37), (14, 47)], i1, only=i0)
    b.line(8, 41, 15, 37, i2)
    b.polygon([(19, 36), (29, 36), (24, 44)], bone)
    b.line(27, 37, 24, 43, h3)
    b.polygon([(9, 40), (14, 37), (39, 47), (31, 47)], c1)
    b.line(14, 37, 39, 47, c2)
    b.line(9, 41, 30, 47, c0)
    ell(b, 30.0, 43.0, 2.2, 2.2, gold)
    b.px(29, 42, hot); b.px(31, 44, b0)
    b.rect(22, 37, 26, 39, violet)
    b.px(24, 38, slag); b.px(22, 37, c2)
    # --- head: the same frog head; the eyes squeezed shut with joy, the mouth wide open
    h = pp.part("head")
    ell(h, 24.0, 27.5, 17.5, 10.5, moss)
    ell(h, 13.5, 18.0, 6.6, 6.6, moss)
    ell(h, 34.5, 18.0, 6.6, 6.6, moss)
    ell(h, 23.0, 26.0, 16.5, 9.2, leaf, only=moss)
    ell(h, 12.8, 17.2, 5.6, 5.6, leaf, only=moss)
    ell(h, 33.8, 17.2, 5.6, 5.6, leaf, only=moss)
    ell(h, 24.0, 36.5, 10.0, 3.6, hot, only=leaf)
    ell(h, 24.0, 36.8, 10.0, 3.6, h3, only=moss)
    for (x, y) in ((10, 13), (11, 12), (12, 12), (31, 12), (32, 12), (10, 22), (11, 21)):
        h.px(x, y, hot)
    # happy eyes: ^ ^ arcs in ink on the lit dome
    for cx in (14, 35):
        for (dx, dy) in ((-3, 2), (-2, 1), (-1, 0), (0, 0), (1, 1), (2, 2)):
            h.px(cx + dx - 1 + 1, 18 + dy, k)
        h.px(cx - 4, 21, moss); h.px(cx + 3, 21, moss)
    # the open mouth: a wide D, dark inside, a copper tongue
    top = 30
    for x in range(12, 37):
        h.px(x, top, k)
    rows = [(12, 36), (13, 35), (14, 34), (16, 32), (19, 29)]
    for j, (xa, xb) in enumerate(rows):
        y = top + 1 + j
        h.line(xa, y, xb, y, c0)
        h.px(xa - 1, y, k); h.px(xb + 1, y, k)
    h.line(19, top + 6, 29, top + 6, k)
    h.px(18, top + 5, k); h.px(30, top + 5, k)
    h.line(20, top + 4, 28, top + 4, c1)            # tongue
    h.line(21, top + 3, 27, top + 3, c1)
    h.px(22, top + 3, c2); h.px(23, top + 3, c2)
    h.line(13, top + 1, 35, top + 1, sh)            # the roof of the mouth in shade
    h.px(13, top + 1, c0)
    for (x, y) in ((10, 27), (11, 27), (11, 28), (36, 27), (37, 27), (37, 28)):
        h.px(x, y, c2)                               # cheeks, pushed up by the grin
    h.px(21, 25, k); h.px(27, 25, k)
    # --- arms: navy sleeves thrown up, bone cuffs, green four-toed hands
    a = pp.part("arms")
    tline(a, [(6, 40), (3, 32), (3, 23)], 3, i0)      # left arm, up beside the head
    tline(a, [(6, 39), (3, 31)], 1, i1)
    a.line(3, 23, 3, 31, i1)
    a.rect(2, 21, 6, 22, bone)
    a.line(2, 22, 6, 22, h3)
    tline(a, [(39, 40), (43, 32), (43, 21)], 3, i0)   # right arm, holding the hat aloft
    tline(a, [(40, 39), (43, 31)], 1, i1)
    a.line(43, 21, 43, 31, i1)
    a.rect(42, 19, 46, 20, bone)
    a.line(42, 20, 46, 20, h3)
    hd = pp.part("hands")
    # left hand: open, three long frog fingers with round pads, waving
    ascii_(hd, 1, 11, [
        "ll.ll.ll",
        "ll.ll.ll",
        ".m..m.m.",
        ".m..m.m.",
        "..mmmmm.",
        "..llmmm.",
        "..lmmmm.",
        "...mmm..",
        "...mm...",
        "...mm...",
    ])
    # right hand: gripping the hat's brim
    ell(hd, 44.5, 16.5, 2.4, 2.4, moss)
    hd.px(43, 15, leaf); hd.px(44, 15, leaf)
    hd.rect(42, 12, 43, 13, leaf); hd.rect(45, 12, 46, 13, leaf)
    # --- the top hat, lifted high and tipped back
    t = pp.part("hat")
    t.rect(32, 10, 46, 11, sh)                       # brim
    t.line(32, 10, 45, 10, h0)
    t.rect(36, 2, 44, 9, sh)                         # crown
    t.line(36, 2, 36, 8, h0)
    t.line(37, 2, 43, 2, h0)
    t.rect(36, 7, 44, 8, b1)                         # band
    t.line(36, 7, 43, 7, gold)
    t.px(42, 5, leaf); t.px(43, 6, leaf); t.px(41, 6, moss)
    t.px(37, 3, slag)
    shifts = None
    if hi:
        shifts = {"head": (0, -1), "arms": (0, -1), "hands": (0, -1), "hat": (0, -1)}
    pp.done(shifts)


def bramble():
    s = new(48, 48, 2)
    for f in range(2):
        s.frame(f + 1)
        bramble_cheer(s, f)
    s.frame(1)
    return s


# ===================================================================== 9. ui_icons_small
# 8x8, the same 20 icons as ui_icons in the same order. Each is a 6x6 drawing at (1, 1) given a
# 1 px ink outline (like ui_coin_small); the coin is ui_coin_small's own first frame.
ICON_ORDER = ["build", "research", "orders", "stats", "trophies", "options", "fold", "flow",
              "remove", "rotate", "factory", "workshop", "coin", "heart", "clock", "lock", "star",
              "play", "pause", "fastforward",
              # Milestone 4 (Act II), appended: the first 20 never move
              "power", "heavy", "codex", "survey", "mega", "kit", "claim", "overdrive", "mode"]
SMALL = {
    "build": ["3222y.", "22111.", "..W...", "..W...", "..d...", "..d..."],
    "research": ["..32..", "..32..", ".3TT2.", "3TTTt2", "3TtTt2", ".2222."],
    "orders": [".l..l.", "..ll..", "wwllww", "WWlmWW", "WWlmWW", "ddlmdd"],
    "stats": ["....Hg", "....gY", "..pCgY", "..CcgY", "JICcgY", "IiCcgY"],
    "trophies": ["HggggY", "gggggY", ".ggYy.", "..gy..", "..gy..", ".wWWd."],
    "options": ["..32..", ".3221.", "32kk11", "21kk10", ".2110.", "..10.."],
    "fold": ["bbb2..", "bbb22.", "bbbbb3", "bbbbb3", "bbbbb3", "333332"],
    "flow": ["...T..", "TTTTT.", "...T..", "..J...", ".IIIII", "..I..."],
    "remove": ["pC..pC", ".pC.C.", "..CC..", "..Cc..", ".Cc.Cc", "Cc..Cc"],
    "rotate": [".gggH.", "g...gH", "g..ggg", "g.....", "Y....g", ".YYYY."],
    "factory": ["....1.", "2.2.1.", "221111", "111111", "1o1o10", "000000"],
    "workshop": ["21..g.", "2..gHg", "wwwwgw", "WWWWWW", "d....d", "d....d"],
    "heart": ["......", "pC..CC", "CCCCCc", "CCCCCc", ".CCCc.", "..Cc.."],
    "clock": [".gggg.", "gbkbbY", "gbkbbY", "gbbkkY", "gbbbbY", ".YYYY."],
    "lock": [".2111.", ".2..1.", "HggggY", "gYkkYy", "gYkYYy", "yyyyyy"],
    "star": ["..gg..", "gHgggY", ".gggY.", ".gYgY.", "gY..gY", "......"],
    "play": ["Hg....", "gggg..", "gggggY", "gggggY", "gggY..", "gY...."],
    "pause": ["Hg..Hg", "gY..gY", "gY..gY", "gY..gY", "gY..gY", "yy..yy"],
    "fastforward": ["g..g..", "Hg.Hg.", "gggggY", "ggYggY", "gY.gY.", "y..y.."],
    # Milestone 4 (the 16x16 versions are in pixel-art/ui/icons_m4.py)
    "heavy": [".3333b", "322221", "..221.", "..21..", ".2211.", "221110"],
    "codex": ["xvvvg.", "xvTTvb", "xvTtvb", "xvvvvb", "xvvvvb", ".bbbb3"],
    "survey": [".YCCC.", ".wpCCC", ".wCc..", ".w....", ".W....", "dWWd.."],
    "mega": ["..gY..", "HggggY", "323031", ".3302.", "..30..", "..2..."],
    "overdrive": ["..o...", ".oCo.o", ".oHCoC", "oCHbCC", "oCbHbC", "cbCCCb"],
}
# full 8x8 drawings, ink included (shapes that need the whole cell: odd widths, notches)
RAW = {
    "power": ["...kkkk.",
              "..kHggk.",
              ".kHggk..",
              "kHgggggk",
              "kkkggYk.",
              "..kgYk..",
              ".kYk....",
              ".kk....."],
    "kit": ["kkkkk3k.",
            "k333332.",
            "kkkkk3k.",
            "kppppppk",
            "kWwwwwWk",
            "kWWWWWWk",
            "kdwwwwdk",
            "kkkkkkkk"],
    "claim": [".kkkkk..",
              "k3332Jk.",
              ".kk.kw2k",
              "...kwk2k",
              "..kwkIJk",
              ".kwkIJCk",
              "kwkkIiCk",
              "kkk.kkkk"],
    "mode": ["..kkkk..",
             ".k3232k.",
             "k3322bHk",
             "k232b21k",
             "k23b211k",
             "k122110k",
             ".k1010k.",
             "..kkkk.."],
    "rotate": ["..kkkgk.",
               ".kHgggYk",
               "kgkkkYk.",
               "kgk..kk.",
               "kgk..kgk",
               "kYkkkYgk",
               ".kYYYkk.",
               "..kkk..."],
    "heart": [".kk.kk..",
              "kpCkCCk.",
              "kCCCCck.",
              "kCCCCck.",
              ".kCCck..",
              "..kck...",
              "...k....",
              "........"],
    "star": ["...kk...",
             "..kHgk..",
             "kkkggkkk",
             "kHgggggk",
             ".kgggYk.",
             ".kgYgYk.",
             "kgYkkgYk",
             "kkk..kkk"],
}


def icons_small():
    s = new(8, 8, len(ICON_ORDER))
    coin = fr("ui_coin_small", 0)
    for f, name in enumerate(ICON_ORDER):
        s.frame(f + 1)
        if name == "coin":
            for y in range(8):
                for x in range(8):
                    p = coin.getpixel((x, y))
                    if p[3]:
                        s.px(x, y, "#%02x%02x%02x" % p[:3])
            continue
        if name in RAW:
            ascii_(s, 0, 0, RAW[name])
            continue
        rows = SMALL[name]
        ascii_(s, 1, 1, [r.replace("k", ".") for r in rows])
        s.outline(k)
        # interior ink (holes, hands, keyholes) after the outline
        for j, r in enumerate(rows):
            for i, ch in enumerate(r):
                if ch == "k":
                    s.px(1 + i, 1 + j, k)
    s.frame(1)
    return s


# ===================================================================== 10. module_glow
# Overlay for module.png while running: the ink ring around the well (x3..12, y3..12) lights
# up orange (apart from the brass frame), with three hot dashes marching clockwise 3 px a frame (period 12: seamless in 4).
# The ring's top-right pixel (12, 3) touches the pip corner and stays dark.
def ring_path():
    pts = []
    for x in range(3, 12):
        pts.append((x, 3))
    for y in range(3, 12):
        pts.append((12, y))
    for x in range(12, 3, -1):
        pts.append((x, 12))
    for y in range(12, 3, -1):
        pts.append((3, y))
    return pts   # 36 pixels, clockwise from the top-left


def module_glow():
    s = new(16, 16, 4)
    pts = ring_path()
    for f in range(4):
        s.frame(f + 1)
        for i, (x, y) in enumerate(pts):
            if (x, y) == (12, 3):
                continue
            ph = (i - 3 * f) % 12
            col = hot if ph < 3 else glow
            s.px(x, y, col)
    s.frame(1)
    return s
