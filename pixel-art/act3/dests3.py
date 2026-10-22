"""The District's destinations (docs/endgame.md, Milestone 7): 32x32 each, the District's versions
of factory_dock, factory_hopper and mega_bay, in the platform's white paint and polished brass.

- dist_dock x3 (fps 3): a white landing pad with a brass kerb, a painted landing ring, a skiff
  moored on cradle blocks with crates aboard (the Dock's cue: its cargo and the moss pennant with
  the gold coin, "sell"), a brass mooring post with a lantern; the pennant flutters, the chase
  lights in the pad's front face run.
- dist_hopper x3 (fps 3): the Hopper's brass-rimmed teal funnel (its cue, as on every floor) over a
  white-painted box with a brass trim and the glowing flask, on a white plinth with brass feet;
  the flask and lamps pulse.
- dist_bay x5 (fps 6, names empty, stage1, stage2, run1, run2): a white gantry with a brass beam
  and a crane over a landing pad. empty: the hook and the ring; stage1: a scaffold round the
  lower half of a brass hull; stage2: the hull whole, its rotor folded; run1/run2: lit, the
  rotor turning, glints. One bay builds both of the District's megaprojects, so what it holds is a
  brass hull, not either of them.

The top-right 4x4 stays calm; light from the top-left.
"""
import math

from c3 import (B0, B1, B2, B3, INK, INK1, INK2, L0, L1, L2, L3, P, S1, S2, S3, S4, box, get, hline, new, outline,
                put, rect, ship, vline)

W0 = P["cloud2"]


# ================================================================ shared bits
def pad(img, y0=6, y1=27):
    """A white landing pad with a brass kerb (lit top and left), its front face below: a brass
    band, a white face, ink foot."""
    rect(img, 0, y0, 31, y1, INK)
    rect(img, 1, y0 + 1, 30, y1 - 1, S4)
    hline(img, 1, 30, y0 + 1, B3)
    vline(img, 1, y0 + 1, y1 - 1, B3)
    hline(img, 2, 30, y0 + 2, B2)
    vline(img, 2, y0 + 2, y1 - 1, B2)
    hline(img, 2, 30, y1 - 1, B1)
    vline(img, 30, y0 + 2, y1 - 1, B1)
    hline(img, 3, 29, y0 + 3, W0)
    vline(img, 3, y0 + 3, y1 - 2, W0)
    # the front face
    rect(img, 0, y1 + 1, 31, y1 + 3, INK)
    hline(img, 1, 30, y1 + 1, S3)
    hline(img, 1, 30, y1 + 2, S2)


def chase(img, y, f, n=3):
    """Small lamps along the pad's front face, one in n lit, running east a lamp a frame."""
    for i, x in enumerate(range(3, 30, 3)):
        put(img, x, y, L3 if (i - f) % n == 0 else L0)


def ring(img, cx, cy, rx, ry, c=B2, dash=True):
    """A painted landing ring on the pad: dashes of brass."""
    for i in range(48):
        a = i / 48 * 2 * math.pi
        if dash and i % 4 == 3:
            continue
        put(img, round(cx + math.cos(a) * rx), round(cy + math.sin(a) * ry), c)


def pennant(img, f):
    """The Dock's pennant (destinations.py's): a pole at the north-west corner, moss green with a
    gold coin; its swallowtail flutters."""
    rect(img, 1, 0, 3, 13, INK)
    vline(img, 2, 1, 12, B3)
    w = [9, 8, 9][f % 3]
    for y in range(1, 7):
        for x in range(3, 3 + w):
            if x == 2 + w and y in (3, 4):
                continue
            put(img, x, y, P["moss5"] if y < 4 else P["moss3"])
    for x in range(3, 3 + w):
        put(img, x, 0, INK)
        put(img, x, 7, INK)
    for y in (1, 2, 5, 6):
        put(img, 3 + w, y, INK)
    put(img, 2 + w, 3, INK)
    put(img, 2 + w, 4, INK)
    for x, y in ((6, 2), (7, 2), (5, 3), (8, 3), (5, 4), (8, 4), (6, 5), (7, 5)):
        put(img, x, y, B1)
    for x, y in ((6, 3), (7, 3), (6, 4), (7, 4)):
        put(img, x, y, L2)
    put(img, 6, 3, L3)


def lantern(img, f, x, y):
    """A brass mooring post with a lantern on it, flickering."""
    rect(img, x - 1, y + 3, x + 1, y + 9, INK)
    vline(img, x, y + 3, y + 8, B2)
    rect(img, x - 2, y - 1, x + 2, y + 3, INK)
    g = [(L2, L3), (L1, L2), (L2, L3)][f % 3]
    rect(img, x - 1, y, x + 1, y + 2, g[0])
    put(img, x, y + 1, g[1])
    put(img, x, y - 2, INK)


# ================================================================ the Dock
def dock(f):
    img = new(32, 32)
    pad(img)
    chase(img, 29, f)
    ring(img, 15, 18, 11, 6)
    # cradle blocks under the skiff
    for x in (9, 20):
        rect(img, x - 1, 21, x + 2, 23, INK)
        rect(img, x, 21, x + 1, 22, P["wood3"])
    # the skiff: a brass hull bow-east, a lit rail, crates aboard
    hull = {15: (6, 25), 16: (5, 26), 17: (5, 26), 18: (6, 25), 19: (7, 23)}
    for y, (a, b) in hull.items():
        hline(img, a - 1, b + 1, y, INK)
    put(img, 27, 14, INK)
    put(img, 27, 13, INK)
    put(img, 26, 14, B3)
    for y, (a, b) in hull.items():
        hline(img, a, b, y, B3 if y == 15 else B2 if y < 18 else B1)
    put(img, 9, 17, L2)
    put(img, 21, 17, L2)
    hline(img, 8, 22, 20, INK)
    # cargo: a copper crate, a brass crate, a bone sack, a wooden crate
    box(img, 7, 10, 11, 15, P["copper2"])
    hline(img, 8, 10, 11, P["copper3"])
    hline(img, 8, 10, 14, P["copper1"])
    box(img, 11, 9, 16, 15, P["wood4"])
    hline(img, 12, 15, 10, P["wood5"])
    vline(img, 13, 11, 14, P["wood2"])
    box(img, 16, 10, 20, 15, B2)
    hline(img, 17, 19, 11, B3)
    vline(img, 18, 12, 14, B1)
    box(img, 20, 12, 23, 15, P["bone"])
    put(img, 21, 12, S3)
    # the rotor on a short mast, stopped, its blades along the hull
    vline(img, 15, 6, 9, S2)
    put(img, 15, 8, INK)
    hline(img, 8, 22, 6, S4)
    put(img, 8, 6, P["red"])
    put(img, 22, 6, P["red"])
    put(img, 15, 6, B2)
    # the mooring rope to the post
    hline(img, 26, 27, 16, P["wood4"])
    lantern(img, f, 29, 10)
    pennant(img, f)
    return img


# ================================================================ the Hopper
def hopper(f):
    """dest. hopper: the teal funnel and brass mouth over a white box on a white plinth."""
    img = new(32, 32)
    teal_lit, teal, teal_dark = P["teal"], P["water4"], P["water3"]
    # the plinth: white, brass feet
    rect(img, 3, 27, 28, 30, INK)
    hline(img, 4, 27, 27, W0)
    hline(img, 4, 27, 28, S4)
    hline(img, 4, 27, 29, S3)
    for x in (4, 25):
        rect(img, x, 29, x + 2, 31, INK)
        hline(img, x + 1, x + 1, 30, B2)
    # the box
    box(img, 6, 18, 25, 27, S4)
    hline(img, 7, 24, 19, W0)
    vline(img, 24, 20, 26, S3)
    hline(img, 7, 24, 26, S3)
    hline(img, 6, 25, 18, INK)
    hline(img, 7, 24, 20, B2)
    liquid = [P["water4"], P["teal"], P["bone"]][f % 3]
    flask = {21: (15, 16), 22: (15, 16), 23: (14, 17), 24: (13, 18), 25: (13, 18)}
    for y, (a, b) in flask.items():
        hline(img, a - 1, b + 1, y, INK)
    for y, (a, b) in flask.items():
        hline(img, a, b, y, P["bone"] if y < 23 else liquid)
    hline(img, 12, 19, 26, INK)
    lamp = [P["teal"], P["water4"], P["teal"]][f % 3]
    for lx in (8, 21):
        box(img, lx, 22, lx + 2, 24, lamp)
    # the funnel
    for i, y in enumerate(range(9, 19)):
        a, b = 2 + i, 29 - i
        hline(img, a, b, y, INK)
        if b - a > 2:
            for x in range(a + 1, b):
                t = (x - a) / (b - a)
                put(img, x, y, teal_lit if t < 0.3 else teal if t < 0.75 else teal_dark)
    for x in range(6, 26, 3):
        put(img, x, 12, B3)
    hline(img, 5, 26, 11, teal_dark)
    hline(img, 8, 23, 16, B2)
    # the mouth
    box(img, 1, 2, 28, 9, INK1)
    hline(img, 1, 28, 2, INK)
    hline(img, 2, 27, 3, B3)
    hline(img, 2, 27, 8, B1)
    vline(img, 2, 4, 7, B2)
    vline(img, 27, 4, 7, B1)
    hline(img, 3, 26, 4, teal)
    hline(img, 4, 25, 5, teal_dark)
    hline(img, 6, 23, 6, P["water2"])
    for x, y in ((3, 5), (3, 6), (4, 6), (26, 5), (26, 6), (25, 6)):
        put(img, x, y, INK2)
    hline(img, 10, 19, 7, INK)
    put(img, 9, 7, P["water1"])
    put(img, 20, 7, P["water1"])
    return img


# ================================================================ the Bay
def gantry(img, f, lit=False):
    """A white gantry: two columns with brass bands, a brass-trimmed white beam, a crane trolley."""
    for x0 in (1, 26):
        rect(img, x0, 3, x0 + 4, 27, INK)
        rect(img, x0 + 1, 4, x0 + 3, 26, S4)
        vline(img, x0 + 1, 4, 26, W0)
        vline(img, x0 + 3, 4, 26, S3)
        for y in (9, 16, 23):
            hline(img, x0 + 1, x0 + 3, y, B2)
            put(img, x0 + 1, y, B3)
    rect(img, 0, 1, 31, 6, INK)
    hline(img, 1, 30, 2, W0)
    rect(img, 1, 3, 30, 4, S4)
    hline(img, 1, 30, 5, B2)
    for x in range(3, 30, 4):
        put(img, x, 3, B3)
    # the beacon (left of centre, so the pip corner stays calm)
    put(img, 14, 0, (L3 if f % 2 == 0 else L1) if lit else P["red"])
    put(img, 15, 0, INK)


def bay_floor(img):
    rect(img, 0, 26, 31, 31, INK)
    hline(img, 1, 30, 26, B3)
    hline(img, 1, 30, 27, B2)
    rect(img, 1, 28, 30, 29, S4)
    hline(img, 1, 30, 30, S3)
    # the back wall between the columns: pale sky through a glass screen
    rect(img, 6, 7, 25, 25, P["sky3"])
    for y in range(7, 26):
        for x in range(6, 26):
            if (x + y) % 9 == 0:
                put(img, x, y, P["sky4"])
    hline(img, 6, 25, 22, P["cloud1"])
    hline(img, 6, 25, 23, P["cloud2"])
    rect(img, 6, 24, 25, 25, S3)
    hline(img, 6, 25, 24, S4)


def hook(img, y1, sway=0):
    vline(img, 15, 6, y1, S2)
    put(img, 15 + sway, y1 + 1, B2)
    put(img, 16 + sway, y1 + 2, B2)
    put(img, 15 + sway, y1 + 3, B1)
    put(img, 14 + sway, y1 + 2, B1)
    rect(img, 13, 6, 18, 7, S2)
    hline(img, 13, 18, 6, S3)


def hull(img, cy, top_y, full, lit=False, f=0):
    """A brass hull (a fat round pod, riveted) centred x 15.5; full=False draws only the lower
    half under a scaffold."""
    cx = 15.5
    rx, ry = 7.5, 6.5
    for y in range(cy - 7, cy + 8):
        for x in range(7, 25):
            dx, dy = (x + 0.5 - cx - 0.5) / rx, (y + 0.5 - cy) / ry
            d = dx * dx + dy * dy
            if d > 1 or (not full and y < cy):
                continue
            lam = -dx * 0.6 - dy * 0.8
            put(img, x, y, B3 if lam > 0.45 else B2 if lam > -0.15 else B1 if lam > -0.65 else B0)
    # a rivet band and portholes
    for x in range(9, 23):
        if get(img, x, cy + 1)[3]:
            put(img, x, cy + 1, B0 if x % 3 else B3)
    # one round porthole under the band (two would make a face)
    rect(img, 15, cy + 3, 16, cy + 4, L2 if lit else INK1)
    put(img, 15, cy + 3, L3 if lit else INK2)
    for x, y in ((14, cy + 3), (14, cy + 4), (17, cy + 3), (17, cy + 4), (15, cy + 2), (16, cy + 2), (15, cy + 5),
                 (16, cy + 5)):
        put(img, x, y, B0)
    if full:
        # the folded rotor on top, and its mast
        vline(img, 15, cy - 9, cy - 7, S2)
        if lit:
            k = [7, 4, 1, 4][f % 4]
            hline(img, 15 - k, 16 + k, cy - 9, S4)
            put(img, 15 - k, cy - 9, P["red"])
            put(img, 16 + k, cy - 9, P["red"])
        else:
            hline(img, 13, 18, cy - 9, S4)
        put(img, 15, cy - 9, B2)


def bay(stage, f=0):
    img = new(32, 32)
    bay_floor(img)
    gantry(img, f, lit=stage == "run")
    ring(img, 15, 25, 8, 1, c=L2 if stage == "run" else B1, dash=True)
    if stage == "empty":
        hook(img, 13)
    elif stage == "stage1":
        hook(img, 9)
        hull(img, 18, 11, full=False)
        # scaffold poles and a plank either side
        for x in (8, 23):
            vline(img, x, 12, 24, P["wood3"])
        hline(img, 7, 24, 14, P["wood4"])
        hline(img, 7, 24, 15, P["wood2"])
    else:
        lit = stage == "run"
        hull(img, 17, 10, full=True, lit=lit, f=f)
        if lit:
            for gx, gy in (((10, 12), (22, 20)), ((21, 11), (9, 21)))[f % 2]:
                put(img, gx, gy, L3)
    img = outline(img, INK)
    return img


def build():
    ship("dist_dock", [dock(f) for f in range(3)], 3, look=6)
    ship("dist_hopper", [hopper(f) for f in range(3)], 3, look=6)
    ship("dist_bay", [bay("empty"), bay("stage1"), bay("stage2"), bay("run", 0), bay("run", 1)], 6, look=6,
         extra={"names": ["empty", "stage1", "stage2", "run1", "run2"]})


if __name__ == "__main__":
    build()
