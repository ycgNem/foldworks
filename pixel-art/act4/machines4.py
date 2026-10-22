"""Act IV's Workshop pieces (docs/endgame.md, the contract for Milestone 9), pixel by pixel.

- heater 16x16, one facing (it has no output side), 4 frames at 8 fps, on the standard skid: Rime's
  Heater. A squat cast-iron radiator stove: a row of five upright fins with the fire glowing
  between them (the lamp ramp stepped +1/0/-1/0, hotter at the foot), a coal hopper on the cap at
  the left, a brass name plate. Told from the smelter (a brick box with a chimney), the furnace
  (a round pot with a crank), the boiler and the kiln by its comb of fins. The top-right 4x4 stays
  calm (no bright pixel, no motion).
- vent 16x16, 4 frames at 6 fps: Cinder Isle's vent tile. A crater of black basalt rocks round a
  glowing throat (lamp3 at its heart), steam wisps rising and drifting off it in turn. No skid
  (it is ground, not a machine); a ring, not domes (cinderite) and not a Spark (no star, no motes
  of light).
- rubble 16x16 x6 (names slab, bricks, girder, mixed, pipes, heap): the Old Works' rubble, a pile
  on its tile to clear for coin: broken slabs, bricks, a bent rusted girder, pipe ends, a dirt
  heap; each an ink1-outlined pile casting its shadow down-right, filling about 12x10 of the tile.
- ruin_overlay 32x32 x6 (names s0 s1 s2 s3 b0 b1): cracks, grime, rust runs and moss to draw over
  a ruined machine. s* are for a 16x16 machine (only their top-left 16x16 is drawn), b* for a
  32x32. Drawn to be composited **source-atop** over the machine's own frame (on a scratch canvas)
  so it clings to the machine's silhouette; nothing in the top-right 5x5 of its size (the pip).
- frost_overlay 32x32 x4 (names s0 s1 b0 b1): rime on a machine running cold, same use: a ragged
  snow band over the machine's top with short icicles, snow along its skid's top edge, frost
  crystals in its corners.
"""
import math

from c4 import (B1, B2, B3, INK, INK1, INK2, L0, L1, L2, L3, P, S0, S1, S2, S3, S4, get, hline, hsh, new, outline,
                put, rect, seat, ship, vline)
from isletools import h01

# ================================================================ the Heater
FIN_X = (3, 5, 7, 9, 11)
GLOW = [P["copper0"], L0, L1, L2, L3]


def heater(f):
    img = new(16, 16)
    step = [1, 0, -1, 0][f]
    # the body: rows 4..11, x 2..12; a cap plate on row 3
    rect(img, 2, 3, 12, 11, INK)
    rect(img, 3, 4, 11, 10, S0)
    for y in range(4, 11):
        # the fire between the fins: hotter at the foot
        base = 1 + (y - 4) * 3 // 6
        for x in (4, 6, 8, 10):
            k = max(0, min(4, base + step + (1 if x in (6, 8) and y >= 8 else 0)))
            put(img, x, y, GLOW[k])
    for x in FIN_X:
        vline(img, x, 4, 10, S2)
        put(img, x, 4, S4)
        put(img, x, 5, S3)
        put(img, x, 10, S1)
    # the cap: lit plate, a hopper of coal at the left
    hline(img, 2, 12, 1, INK)
    hline(img, 3, 11, 2, S3)
    hline(img, 3, 11, 3, S2)
    vline(img, 2, 1, 3, INK)
    vline(img, 12, 1, 3, INK)
    put(img, 3, 2, S4)
    # the coal hopper on the cap's left: an ink box, coal lumps with a lit one
    rect(img, 2, 0, 6, 1, INK)
    put(img, 3, 1, INK2)
    put(img, 4, 1, S1)
    put(img, 5, 1, INK2)
    img2 = img
    # a brass name plate on the foot rail
    hline(img2, 3, 11, 11, S1)
    rect(img2, 6, 11, 8, 11, B2)
    put(img2, 6, 11, B3)
    # little feet
    put(img2, 3, 12, INK)
    put(img2, 11, 12, INK)
    return seat(img2)


# ================================================================ the vent
def vent(f):
    img = new(16, 16)
    cx, cy = 7.5, 9.5
    # scorched ground round it, out to the tile's edge: the vent claims its tile at a glance
    for y in range(16):
        for x in range(16):
            dx, dy = (x + 0.5 - cx) / 8.2, (y + 0.5 - cy) / 6.6
            d = math.hypot(dx, dy)
            if 0.8 < d <= 1.08 and h01(x, y, 91) < 0.55 - (d - 0.8):
                put(img, x, y, P["earth0"] if h01(x, y, 92) < 0.6 else P["ink2"])
    rim = new(16, 16)
    # the crater rim: a ring of basalt lumps, lit on their tops
    for y in range(16):
        for x in range(16):
            dx, dy = (x + 0.5 - cx) / 6.9, (y + 0.5 - cy) / 5.0
            d = math.hypot(dx, dy)
            if 0.55 < d <= 1.0:
                lump = h01(int(math.atan2(dy, dx) * 3 + 10), 3) > 0.3
                if d > 0.93 and not lump:
                    continue
                top = dy < -0.2
                put(rim, x, y, P["steel2"] if top and d > 0.85 else P["steel1"] if top else P["ink2"] if dy < 0.3 else P["ink1"])
            elif d <= 0.55:
                # the throat: glowing, its heart lamp3, breathing with the frame
                k = 4 if d < 0.2 else 3 if d < 0.35 else 2 if d < 0.48 else 1
                k = max(1, min(4, k + [0, 1, 0, -1][f] * (1 if d > 0.2 else 0)))
                put(rim, x, y, GLOW[k])
    img.alpha_composite(outline(rim, INK))
    # steam wisps rising off it: three puffs at different heights, each climbing and drifting
    for i in range(3):
        t = (f + i * 4 / 3) % 4
        y = int(7 - t * 2.0 - i * 0.5)
        x = int(6 + i * 2 + t * 0.8 - 1)
        if y < 0:
            continue
        for (dx, dy, c) in ((0, 0, "cloud2"), (1, 0, "cloud1"), (0, -1, "cloud1"), (1, -1, "cloud0")):
            if t < 3 or (dx, dy) == (0, 0):
                xx, yy = x + dx, y + dy
                # stay out of the top-right 4x4 (the tile's pip corner, as everywhere)
                if not (xx >= 12 and yy < 4):
                    put(img, xx, yy, P[c])
    return img


# ================================================================ rubble
def chunk(img, x, y, w, h, ramp, seed, round_=True):
    """A broken block, lit top-left: ramp (lit, mid, dark, shade)."""
    for yy in range(h):
        for xx in range(w):
            if round_ and (xx, yy) in ((0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1)) and h01(seed, xx, yy) < 0.7:
                continue
            c = ramp[0] if (yy == 0 or xx == 0) else ramp[3] if (yy == h - 1 or xx == w - 1) else ramp[1]
            if c == ramp[1] and h01(seed, xx, yy, 5) < 0.15:
                c = ramp[2]
            put(img, x + xx, y + yy, P[c])


SLAB = ("pave3", "pave2", "pave1", "pave0")
BRICK = ("copper2", "copper1", "copper0", "copper0")
RUST = ("copper2", "copper1", "copper0", "ink2")
STEEL = ("steel3", "steel2", "steel1", "steel0")
DIRT = ("earth3", "earth2", "earth1", "earth0")


def mound(img, seed, ramp=DIRT, top=5):
    """The heap every pile sits on: a lumpy dirt mound lit from the top-left, about 12x9."""
    for y in range(top, 14):
        for x in range(1, 15):
            w = 6.3 + (h01(seed, y, 1) - 0.5) * 1.2
            if (x - 7.5) ** 2 / (w * w) + (y - 13) ** 2 / ((13 - top) ** 2) <= 1:
                lam = -(x - 7.5) / 6 - (y - 10) / 4
                put(img, x, y, P[ramp[0] if lam > 0.7 else ramp[1] if lam > 0 else ramp[2] if lam > -0.8 else ramp[3]])


def rubble(kind):
    img = new(16, 16)
    mound(img, RUBBLE.index(kind) * 7 + 3, top=6 if kind != "heap" else 5)
    if kind == "slab":
        chunk(img, 2, 6, 7, 4, SLAB, 1)
        chunk(img, 7, 3, 6, 6, SLAB, 2)
        chunk(img, 4, 9, 5, 3, SLAB, 3)
        chunk(img, 10, 9, 3, 2, BRICK, 4, round_=False)
    elif kind == "bricks":
        for i, (x, y) in enumerate(((3, 9), (7, 10), (5, 7), (9, 7), (11, 10), (7, 4), (4, 5), (10, 4))):
            chunk(img, x, y, 3, 2, BRICK, 10 + i, round_=False)
    elif kind == "girder":
        chunk(img, 9, 8, 4, 4, SLAB, 21)
        # a bent I-beam jutting up out of the heap, rusted
        for i in range(10):
            x, y = 3 + i, 9 - i // 2 - (i // 4)
            put(img, x, y, P["copper2"] if i % 3 else P["copper1"])
            put(img, x, y + 1, P["copper0"])
            put(img, x, y + 2, P["ink2"])
    elif kind == "mixed":
        chunk(img, 2, 7, 5, 4, SLAB, 30)
        chunk(img, 7, 8, 3, 2, BRICK, 31, round_=False)
        chunk(img, 8, 4, 5, 4, SLAB, 32)
        chunk(img, 5, 10, 4, 2, STEEL, 33)
    elif kind == "pipes":
        chunk(img, 6, 9, 5, 3, SLAB, 40)
        for (x, y) in ((3, 6), (7, 4), (10, 7), (4, 10)):
            # a pipe end: a ring, a dark bore
            for (dx, dy, c) in ((0, 0, "steel3"), (1, 0, "steel2"), (2, 0, "copper1"), (0, 1, "steel2"), (1, 1, "ink"),
                                (2, 1, "steel1"), (0, 2, "copper1"), (1, 2, "steel1"), (2, 2, "copper0")):
                put(img, x + dx, y + dy, P[c])
    else:  # heap
        chunk(img, 5, 6, 3, 2, SLAB, 50)
        chunk(img, 9, 9, 3, 2, BRICK, 51, round_=False)
        put(img, 7, 10, P["steel2"])
    img = outline(img, INK1)
    # its shadow cast down-right on the ground
    sh = new(16, 16)
    for y in range(16):
        for x in range(16):
            if img.getpixel((x, y))[3] and x + 1 < 16 and y + 1 < 16 and not img.getpixel((x + 1, y + 1))[3]:
                put(sh, x + 1, y + 1, P["ink2"])
    sh.alpha_composite(img)
    # keep the pip corner calm
    for y in range(4):
        for x in range(12, 16):
            sh.putpixel((x, y), (0, 0, 0, 0))
    return sh


RUBBLE = ["slab", "bricks", "girder", "mixed", "pipes", "heap"]


# ================================================================ overlays (source-atop over a machine)
def calm(img, n):
    """Clear the top-right 5x5 of an n x n machine (the pip)."""
    for y in range(5):
        for x in range(n - 5, n):
            img.putpixel((x, y), (0, 0, 0, 0))


def ruin(n, v):
    """Cracks, grime, rust runs and moss for an n x n machine (variant v)."""
    img = new(n, n)
    k = n / 16
    seed = 500 + v * 17 + n
    # grime: a sparse ink1 dither, thicker low down
    for y in range(n):
        for x in range(n):
            p = 0.14 + 0.24 * (y / n)
            if ((x + y * 3) % 4 == 0 or (x * 3 + y) % 5 == 0) and h01(x, y, seed) < p * 2.0:
                put(img, x, y, P["ink1"])
    # cracks: two or three wandering ink lines with a lit lip
    for c in range(2 if n == 16 else 3):
        fx, fy = 2 + h01(seed, c, 1) * (n - 7), 2 + h01(seed, c, 2) * (n * 0.5)
        a = 0.9 + (h01(seed, c, 3) - 0.5) * 1.4
        for i in range(int(5 * k + 2)):
            ix, iy = int(fx), int(fy)
            put(img, ix, iy, INK)
            if i % 2 == 0:
                put(img, ix - 1, iy, P["steel3"])
            a += (h01(seed, c, i) - 0.5) * 1.2
            fx += math.cos(a)
            fy += math.sin(a)
    # rust runs from a rivet or seam, downward
    for r in range(2 if n == 16 else 4):
        x = int(2 + h01(seed, r, 7) * (n - 8))
        y = int(2 + h01(seed, r, 8) * (n * 0.35))
        for i in range(int(3 * k + 1 + h01(seed, r, 9) * 3)):
            put(img, x, y + i, P["copper1"] if i == 0 else P["copper0"])
    # moss at the foot (over the skid's top and the body's base), a tuft climbing
    foot = 12 if n == 16 else 25
    for x in range(n - 1):
        if h01(seed, x, 11) < 0.55:
            put(img, x, foot, P["moss3"])
            if h01(seed, x, 12) < 0.5:
                put(img, x, foot - 1, P["moss4"])
                if h01(seed, x, 13) < 0.35:
                    put(img, x, foot - 2, P["moss3"])
            if h01(seed, x, 14) < 0.3:
                put(img, x, foot + 1, P["moss2"])
    # ivy up one side
    side = 1 if v % 2 == 0 else n - 3
    for y in range(int(n * 0.35), foot):
        if h01(seed, y, 15) < 0.6:
            put(img, side + (y % 2), y, P["moss4"] if y % 3 else P["grass1"])
    calm(img, n)
    return img


def frost(n, v):
    img = new(n, n)
    seed = 700 + v * 31 + n
    k = n / 16
    # a ragged snow band over the top of whatever is there (source-atop keeps it on the machine)
    band = int(3 * k)
    for x in range(n):
        h = band + int(h01(seed, x, 1) * 2 * k)
        for y in range(h):
            put(img, x, y, P["cloud3"] if y < h - 1 - (1 if k > 1 else 0) else P["cloud2"])
        if h01(seed, x, 2) < 0.28:
            ln = 1 + int(h01(seed, x, 3) * 3 * k)
            for i in range(ln):
                put(img, x, h + i, P["sky4"] if i < ln - 1 else P["sky3"])
    # snow along the skid's top edge
    top = 12 if n == 16 else 25
    for x in range(n - 1):
        put(img, x, top, P["cloud3"])
        if h01(seed, x, 4) < 0.5:
            put(img, x, top + 1, P["cloud2"])
    # frost crystals: small sky4/cloud3 crosses here and there
    for c in range(3 if n == 16 else 7):
        x = int(2 + h01(seed, c, 5) * (n - 5))
        y = int(band + 2 + h01(seed, c, 6) * (top - band - 4))
        for dx, dy in ((0, 0), (1, 0), (-1, 0), (0, 1), (0, -1)):
            put(img, x + dx, y + dy, P["cloud3"] if (dx, dy) == (0, 0) else P["sky4"])
    calm(img, n)
    return img


def cell32(img16):
    c = new(32, 32)
    c.alpha_composite(img16)
    return c


def build():
    ship("heater", [heater(f) for f in range(4)], 8, look=8)
    ship("vent", [vent(f) for f in range(4)], 6, look=8)
    ship("rubble", [rubble(k) for k in RUBBLE], 0, extra={"names": RUBBLE}, look=8)
    ship("ruin_overlay", [cell32(ruin(16, v)) for v in range(4)] + [ruin(32, v) for v in range(2)], 0,
         extra={"names": ["s0", "s1", "s2", "s3", "b0", "b1"], "composite": "source-atop"}, look=6)
    ship("frost_overlay", [cell32(frost(16, v)) for v in range(2)] + [frost(32, v) for v in range(2)], 0,
         extra={"names": ["s0", "s1", "b0", "b1"], "composite": "source-atop"}, look=6)


if __name__ == "__main__":
    build()
