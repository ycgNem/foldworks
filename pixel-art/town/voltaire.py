"""town_voltaire: Dame Voltaire's turbine pavilion, 32x48, 4 frames (fps 8).

Grand and art-nouveau, in her colours (violet ironwork, bone stone, teal glass, gold): a teal
glass bell dome with brass ribs, violet whiplash brackets curling off the cornice, a cream
facade with two arched windows and a door under a gold lightning bolt, and on a brass mast above
the dome a three-bladed turbine that turns 30 degrees a frame (one third of a turn over the
loop, so with three blades the loop is seamless).

On the sky island it lost its stilts: the pavilion stands on three marble steps (bone and pale
stone, rows 41-46, ink on 47), wider at each tread, the grandest footing in town. Everything
above is the Milestone 4 drawing moved down 3 rows (SHIFT), its windows now catching the sky.
"""
import math
from common_town import new, ascii_, ell, ink_ring, P

INK = P["ink"]
BONE = P["bone"]
H2, H3 = P["steel3"], P["steel4"]
B0, B1, GOLD = P["brass1"], P["brass2"], P["lamp2"]
T0, T1 = P["water3"], P["teal"]
VIO = P["violet"]
SHIFT = 3
HUB = (16, 7)
KEY = {".": None, "k": INK, "v": VIO, "g": GOLD, "o": P["lamp1"], "H": P["lamp3"], "y": B0,
       "~": P["sky2"], "=": P["sky3"], "W": P["cloud3"], "s": P["sky1"]}


def asc(s, x, y, rows):
    ascii_(s, x, y, rows, key=KEY)


def rotor(f):
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


def pavilion(s, f):
    """The Milestone 4 pavilion, rows 0-38 (the facade's foot on row 38)."""
    ell(s, 16, 26, 9, 11.5, T0)
    s.rect(0, 26, 31, 47, None)
    # facade: bone stone with pale courses, lit left edge
    s.rect(7, 27, 24, 38, H3)
    s.line(7, 27, 7, 38, BONE)
    for y in (30, 34):
        s.line(8, y, 24, y, H2)
    s.line(24, 27, 24, 38, H2)
    s.line(15, 9, 15, 14, B1)
    s.line(16, 9, 16, 14, B0)
    s.outline(INK)
    # dome ribs (brass) and glints (teal)
    s.line(16, 15, 16, 25, B1)
    for (x0, x1) in ((12, 10), (20, 22)):
        for y in range(16, 26):
            t = (y - 16) / 9
            s.px(round(x0 + (x1 - x0) * t), y, B1)
    for (x, y) in ((11, 18), (10, 20), (12, 17), (14, 16), (9, 22)):
        s.px(x, y, T1)
    s.px(13, 16, P["cloud3"])
    s.line(8, 25, 23, 25, B0)
    # cornice: a violet band with gold studs, whiplash brackets curling off each end
    s.line(5, 26, 26, 26, VIO)
    for x in range(7, 25, 3):
        s.px(x, 26, GOLD)
    asc(s, 3, 25, [".vv", "v..", "v.v", ".v."])
    asc(s, 26, 25, ["vv.", "..v", "v.v", ".v."])
    # arched windows between violet pillars: glass that reflects the sky
    for wx in (9, 20):
        asc(s, wx - 1, 28, [
            ".kkk.",
            "kW=~k",
            "k=~sk",
            "k~~sk",
            "kkkkk",
        ])
    for px_ in (12, 19):
        s.line(px_, 28, px_, 38, VIO)
        s.px(px_, 28, GOLD)
    # the door under a gold bolt (lit from inside: she keeps the power on)
    asc(s, 14, 27, ["..gg", ".gg.", "gggg", ".gg.", "gg.."])
    asc(s, 13, 32, [
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
    pts = rotor(f)
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
    asc(s, cx - 1, cy - 1, ["kgk", "gHg", "kgk"])
    if f % 2:
        s.px(13, 12, T1)
        s.px(19, 11, P["lamp3"])


def steps(s):
    """Three marble treads, each wider than the one above: lit top row, bone face, pale shade."""
    treads = [(6, 25, 41, 42), (4, 27, 43, 44), (2, 29, 45, 46)]
    for (x0, x1, y0, y1) in treads:
        s.line(x0, y0, x1, y0, BONE)       # the tread, lit
        s.px(x0, y0, P["cloud3"])
        s.line(x0, y1, x1, y1, P["pave2"])  # the riser, in shade
        s.px(x1, y0, P["pave3"])
        s.px(x1, y1, P["pave1"])
    # veins in the marble
    for (x, y) in ((9, 41), (22, 43), (25, 45), (14, 43), (6, 45)):
        s.px(x, y, P["pave3"])
    ink_ring(s, [(x0, y0, x1, y1) for (x0, x1, y0, y1) in treads])


def draw(s, f):
    pavilion(s, f)
    s.shift(0, SHIFT)
    steps(s)


def build():
    s = new(32, 48, 4)
    for f in range(4):
        s.frame(f + 1)
        draw(s, f)
    s.frame(1)
    return s
