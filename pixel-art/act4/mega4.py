"""The World's megaprojects for the Megaproject page (docs/endgame.md, Milestone 9): 48x48
pictures in the World Bay's gold-and-cloud gantry (mega3.py's frame and sky with the World's
colours swapped in: cloud-white columns banded in gold, a gold beam, the deep sky of the highest
floor), four stages each.

Frames (names): p0a p0b (nothing built), p1a p1b (stage 1 of 4 done), p2a p2b, p3a p3b, p4a p4b
(all four done, not yet lit), run1 run2 (finished and working). fps 4. Two frames a stage: a
crane hook sways, a flag flutters, lamps chase.

- mega_lighthouse, the Lighthouse at the Edge: a rocky point of island juts in from the left over
  the cloud sea. p0 a survey stake with a red flag and stacked crates; p1 the round stone base
  on the point, a scaffold; p2 the tower half up, white with red bands, scaffold at its top; p3
  the tower whole, its brass gallery and an empty lamp room; p4 the gold Fresnel lens in the lamp
  room under a red dome and finial, dark; run the lamp blazing, its two beams sweeping out over
  the sky (left, then right), glints on the sea of cloud.
- mega_anchor, the Sky Anchor: the island's rim at the top of the picture, the cloud sea below.
  p0 the anchor point marked on the rim, a coil of chain; p1 the winch (a brass drum on a steel
  frame) on the rim; p2 the chain paid out halfway down; p3 the great anchor hung on the chain's
  end above the clouds; p4 the anchor's flukes sunk into the cloud sea, the chain taut; run the
  anchor's runes glowing gold, a glint running down the chain, the island holding still.
"""
import math

from c4 import INK, INK1, INK2, L0, L1, L2, L3, P, hline, new, put, rect, ship, vline  # noqa: I001
import mega3  # noqa: E402

COLOURS = {"S1": P["steel3"], "S2": P["cloud0"], "S3": P["cloud1"], "S4": P["cloud2"], "W0": P["cloud3"],
           "B0": P["brass1"], "B1": P["brass2"], "B2": P["brass3"], "B3": P["lamp3"]}
B0, B1, B2, B3 = P["brass0"], P["brass1"], P["brass2"], P["brass3"]
S1, S2, S3, S4 = P["steel1"], P["steel2"], P["steel3"], P["steel4"]


def world(fn):
    """Run fn with mega3's colours swapped for the World's."""
    saved = {k: getattr(mega3, k) for k in COLOURS}
    for k, v in COLOURS.items():
        setattr(mega3, k, v)
    try:
        return fn()
    finally:
        for k, v in saved.items():
            setattr(mega3, k, v)



# ================================================================ shared pieces
# the picture's inside is y 8..40 (mega3: the beam covers rows 0-8, the floor 41-47); the cloud
# sea's top is about y 34
GRASS = 31          # the lighthouse point's grass line


def point(img):
    """A rocky point of island jutting in from the left, a grass top, its rock tapering under."""
    for y in range(GRASS, 41):
        reach = 31 - max(0, (y - GRASS - 2)) * 3
        for x in range(0, max(0, reach)):
            if y == GRASS:
                c = P["grass3"]
            elif y == GRASS + 1:
                c = P["grass2"] if x % 4 else P["grass1"]
            else:
                c = P["earth2"] if (x + y) % 5 else P["earth1"]
                if x > reach - 3:
                    c = P["earth0"]
                if (x * 3 + y) % 7 == 0 and x < reach - 2:
                    c = P["earth3"]
            put(img, x, y, c)


def crate(img, x, y, c=P["wood4"]):
    rect(img, x, y, x + 3, y + 3, c)
    hline(img, x, x + 3, y, P["wood5"])
    put(img, x + 1, y + 2, P["wood2"])
    put(img, x + 2, y + 1, P["wood2"])


CX = 15.5           # the lighthouse's axis


def base(img):
    """The round stone base on the point."""
    for y in range(GRASS - 3, GRASS + 1):
        for x in range(8, 24):
            if abs(x + 0.5 - CX) <= 7 - (1 if y == GRASS - 3 else 0):
                put(img, x, y, P["pave3"] if x < 12 else P["pave2"] if x < 19 else P["pave1"])
    hline(img, 9, 22, GRASS - 3, P["bone"])


def tower(img, top, bottom=GRASS - 4):
    """The lighthouse tower: tapering, white with red bands, lit on its left."""
    for y in range(top, bottom + 1):
        t = (y - 17) / max(1, bottom - 17)
        hw = 2.4 + max(0.0, t) * 2.6
        for x in range(48):
            u = (x + 0.5 - CX) / hw
            if abs(u) <= 1:
                band = ((bottom - y) // 3) % 2 == 1
                if band:
                    c = P["copper2"] if u < -0.4 else P["red"] if u < 0.4 else P["copper0"]
                else:
                    c = P["cloud3"] if u < -0.4 else P["cloud2"] if u < 0.4 else P["cloud0"]
                put(img, x, y, c)


def scaffold(img, x0, x1, y0, y1):
    for x in (x0, x1):
        vline(img, x, y0, y1, P["wood3"])
    for y in range(y0 + 1, y1, 3):
        hline(img, x0, x1, y, P["wood4"])
        put(img, x0 + 1, y + 1, P["wood2"])


TOP = 17            # the tower's top (the gallery)


def lamp_room(img, lens=False, lit=False):
    """Gallery on the tower's top, a 4-row lamp room, a red dome and a gold finial (y 9..17)."""
    cx = 15
    hline(img, cx - 4, cx + 5, TOP, B2)
    hline(img, cx - 4, cx + 5, TOP - 1, B3)
    put(img, cx - 4, TOP - 2, B1)
    put(img, cx + 5, TOP - 2, B1)
    for y in range(TOP - 5, TOP - 1):
        for x in range(cx - 2, cx + 4):
            if x in (cx - 2, cx + 3):
                put(img, x, y, B1)
            elif lens:
                put(img, x, y, (L3 if (x + y) % 2 else L2) if lit else (B3 if (x + y) % 2 else B1))
            else:
                put(img, x, y, INK2 if (x + y) % 3 else P["sky1"])
    hline(img, cx - 2, cx + 3, TOP - 6, P["red"])
    hline(img, cx - 1, cx + 2, TOP - 7, P["copper0"])
    put(img, cx, TOP - 8, B3)
    put(img, cx + 1, TOP - 8, B2)


def beams(img, f):
    """Two beams swinging out of the lamp over the sky: left in frame 0, right in frame 1."""
    ly = TOP - 3
    for k in range(1, 18):
        x = 12 - k if f == 0 else 19 + k
        y = ly - k // 5
        for w in range(-(k // 6), k // 6 + 1):
            if 7 <= x <= 40 and 9 <= y + w <= 33:
                put(img, x, y + w, P["sun"] if k > 8 else L3)


def chain(img, x, y0, y1, glint=None):
    """Chain links down from (x, y0): alternate face-on and edge-on links, lit left."""
    for i, y in enumerate(range(y0, y1, 3)):
        if i % 2 == 0:
            for (dx, dy, c) in ((-1, 0, S4), (0, 0, S3), (1, 0, S2), (-1, 1, S3), (1, 1, S1), (-1, 2, S3), (0, 2, S2),
                                (1, 2, S1)):
                put(img, x + dx, y + dy, c)
        else:
            for dy in range(3):
                put(img, x, y + dy, S3 if dy else S4)
        if glint is not None and i == glint:
            put(img, x - 1, y, L3)


def anchor(cx, top, lit=False):
    """The great anchor, 15 px tall: a ring, a stock, a shank with gold bands, curved arms with
    flukes; gold runes down the shank when lit."""
    sh = new(48, 48)

    def p(x, y, c):
        put(sh, x, y, c)
    for dx, dy in ((0, 0), (1, 0), (-1, 1), (2, 1), (0, 2), (1, 2)):
        p(cx + dx, top + dy, S3 if dx <= 0 else S1)
    for x in range(cx - 3, cx + 5):
        p(x, top + 3, S4 if x < cx else S3)
        p(x, top + 4, S2)
    for y in range(top + 3, top + 14):
        p(cx, y, S4)
        p(cx + 1, y, S2)
    for y in (top + 6, top + 10):
        p(cx, y, B3)
        p(cx + 1, y, B2)
    for i in range(-6, 8):
        x = cx + i
        y = top + 14 - int(round((i - 0.5) ** 2 / 9))
        p(x, y, S3 if i < 1 else S2)
        p(x, y + 1, S1)
    for sx, side in ((cx - 6, -1), (cx + 7, 1)):
        for dy in range(3):
            p(sx + side, top + 8 + dy, S4 if side < 0 else S3)
        p(sx + side * 2, top + 8, S2)
    if lit:
        for y in range(top + 5, top + 13, 2):
            p(cx, y, L3 if y % 4 == 1 else L2)
    return sh


RIM = 10            # the island's rim's grass line in the anchor picture


def rim(img):
    """The island's rim across the top of the picture: grass over a band of rock, its ragged lip."""
    for y in range(RIM, RIM + 7):
        for x in range(7, 41):
            if y == RIM:
                c = P["grass3"]
            elif y == RIM + 1:
                c = P["grass2"]
            elif y == RIM + 2:
                c = P["grass1"] if x % 3 else P["grass0"]
            else:
                c = P["earth2"] if (x * 3 + y) % 6 else P["earth1"]
                if y == RIM + 6 and (x * 7) % 5 < 2:
                    continue
            put(img, x, y, c)


def winch(img, f, turning=False):
    """A brass drum slung under the rim on two steel hangers, its crank; the chain leaves it."""
    y0 = RIM + 7
    for x in (17, 30):
        vline(img, x, RIM + 5, y0 + 3, S2)
        vline(img, x + 1, RIM + 5, y0 + 3, S1)
    for y in range(y0, y0 + 4):
        for x in range(19, 30):
            u = (y - y0) / 3
            put(img, x, y, B3 if u < 0.3 else B2 if u < 0.7 else B1)
    for x in range(20, 29, 3):
        put(img, x + (f % 2 if turning else 0), y0 + 1, B0)
    put(img, 31, y0 + 1 + (f % 2), S3)
    put(img, 32, y0 + 2 - (f % 2), S3)


# ================================================================ the Lighthouse
def lighthouse(stage, f):
    lit = stage == "run"

    def objs(img):
        point(img)
        if stage == 0:
            mega3.hook(img, 22, (0, 1)[f % 2])
            vline(img, 16, GRASS - 7, GRASS - 1, P["wood3"])
            for y in range(GRASS - 7, GRASS - 4):
                for x in range(17, 17 + 4 - (y - GRASS + 7) - (f % 2)):
                    put(img, x, y, P["red"])
            crate(img, 3, GRASS - 4)
            crate(img, 7, GRASS - 4, P["wood3"])
            crate(img, 5, GRASS - 8)
            return
        base(img)
        if stage == 1:
            scaffold(img, 9, 22, GRASS - 9, GRASS - 3)
            crate(img, 1, GRASS - 4)
            mega3.hook(img, GRASS - 12, (0, 1)[f % 2])
            return
        top = {2: 23, 3: TOP, 4: TOP, "run": TOP}[stage]
        tower(img, top)
        if stage == 2:
            scaffold(img, 11, 20, top - 4, top + 3)
            mega3.hook(img, top - 7, (0, 1)[f % 2])
            return
        lamp_room(img, lens=stage != 3, lit=lit)
        if stage == 3:
            mega3.hook(img, 11, (0, 1)[f % 2])

    def fx(img):
        beams(img, f)
        put(img, (30, 40)[f % 2], (35, 34)[f % 2], P["cloud3"])
    return world(lambda: mega3.picture(objs, f, lit, True, fx if lit else None))


# ================================================================ the Sky Anchor
def sky_anchor(stage, f):
    lit = stage == "run"
    CXA = 24

    def objs(img):
        rim(img)
        if stage == 0:
            # the anchor point marked on the rim (two stakes, a red tape), a coil of chain
            for x in (22, 26):
                vline(img, x, RIM - 2, RIM, P["wood3"])
            hline(img, 22, 26, RIM - 2, P["red"] if f % 2 == 0 else P["copper0"])
            for (dx, dy) in ((0, 0), (2, 0), (4, 0), (1, -1), (3, -1)):
                rect(img, 11 + dx, RIM - 2 + dy, 12 + dx, RIM - 1 + dy, S3)
            mega3.hook(img, 20, (0, 1)[f % 2])
            return
        winch(img, f, turning=stage in (2, 3))
        if stage == 1:
            return
        end = {2: 26, 3: 21, 4: 26, "run": 26}[stage]
        glint = (f * 3) % 4 if lit else None
        chain(img, CXA, RIM + 11, end, glint)
        if stage != 2:
            img.alpha_composite(anchor(CXA, end - 1, lit))

    def fx(img):
        # the cloud sea rolls back over the flukes of a sunk anchor
        if stage in (4, "run"):
            for x in range(8, 41):
                h = 35 + round(math.sin(x * 0.6 + f * 1.5))
                for y in range(h, 41):
                    put(img, x, y, P["cloud3"] if y == h else P["cloud2"] if y < h + 2 else P["cloud1"])
        if lit:
            put(img, (14, 33)[f % 2], (31, 30)[f % 2], L3)
            put(img, (34, 12)[f % 2], (34, 35)[f % 2], P["cloud3"])
    return world(lambda: mega3.picture(objs, f, lit, True, fx))


NAMES = ["p0a", "p0b", "p1a", "p1b", "p2a", "p2b", "p3a", "p3b", "p4a", "p4b", "run1", "run2"]
STAGES = [(0, 0), (0, 1), (1, 0), (1, 1), (2, 0), (2, 1), (3, 0), (3, 1), (4, 0), (4, 1), ("run", 0), ("run", 1)]


def build():
    ship("mega_lighthouse", [lighthouse(s, f) for s, f in STAGES], 4, extra={"names": NAMES}, look=4, bg=P["bone"])
    ship("mega_anchor", [sky_anchor(s, f) for s, f in STAGES], 4, extra={"names": NAMES}, look=4, bg=P["bone"])


if __name__ == "__main__":
    build()
