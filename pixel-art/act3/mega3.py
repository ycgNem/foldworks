"""The District's megaprojects for the Megaproject page (docs/endgame.md, Milestone 7): 48x48
pictures in the District Bay's white gantry (mega_stage1 shows the Great Drill in the Factory
bay's blue one), its inside open to the day sky at that height, the cloud sea low behind.

Frames (names as mega_stage1's, two frames a stage): p0a p0b (nothing built yet), p1a p1b
(stage 1 done), p2a p2b (stage 2 done), run1 run2 (finished and working). fps 4.

- mega_city, the Floating City: p0, the site (a crane hook swaying, girder bundles on the bay
  floor, a skiff bringing a crate, the platform's ring marked out in the air with buoys); p1, the
  Platform (a white disc with a brass rim held up by three rotor pods, a little crane on it); p2,
  the Spires (a tall white spire with a teal cupola and gold finial, two towers, houses with
  copper roofs, windows dark); run, the town in the sky lit (windows, flags, a skiff calling).
- mega_transmuter, the Scrap Transmuter: p0, the foundation (a brass ring, a scrap heap, a coil
  on the hook); p1, the furnace (a round-bellied brass alembic wrapped in copper coils, a chute
  from the scrap heap, its door dim); p2, the coil tower and its glass orb on top; run, the orb
  glows violet, arcs crackle, the door burns, scrap goes in on the left and coins pop out on the
  right with glints.
"""
import math

from c3 import (B0, B1, B2, B3, INK, INK1, INK2, L0, L1, L2, L3, P, S1, S2, S3, S4, box, hline, new, outline,
                put, rect, ship, vline)
from common import bayer  # noqa: E402  (pixel-art/sky/common.py, on the path through c3)

W0 = P["cloud2"]
N = 48
IX0, IX1, IY0, IY1 = 7, 40, 8, 40       # the inside


# ================================================================ the frame and the sky
def sky(img, deep=False):
    ramp = [P["sky0"], P["sky1"], P["sky2"], P["sky3"]] if deep else [P["sky1"], P["sky2"], P["sky3"], P["sky4"]]
    for y in range(IY0, IY1 + 1):
        t = (y - IY0) / (IY1 - IY0) * (len(ramp) - 1)
        for x in range(IX0, IX1 + 1):
            i = int(t)
            fr = t - i
            c = ramp[min(i + 1, len(ramp) - 1)] if fr > bayer(x, y) else ramp[i]
            put(img, x, y, c)
    # the cloud sea, low: lit tops, soft shade
    for x in range(IX0, IX1 + 1):
        h = 34 + round(1.5 * math.sin(x * 0.45) + math.sin(x * 0.17 + 1))
        for y in range(h, IY1 + 1):
            put(img, x, y, P["cloud3"] if y == h else P["cloud2"] if y < h + 2 else P["cloud1"])
    # a far islet
    for x in range(30, 37):
        put(img, x, 31, P["sky3"] if not deep else P["sky2"])
    put(img, 31, 30, P["sky3"] if not deep else P["sky2"])


def frame(img, f, lit):
    """The District Bay at 48: white columns banded in brass, a white beam with brass rivets, a
    beacon, a brass-kerbed white floor with a row of lamps."""
    for x0 in (0, 41):
        rect(img, x0, 2, x0 + 6, 47, INK)
        rect(img, x0 + 1, 3, x0 + 5, 46, S4)
        vline(img, x0 + 1, 3, 46, W0)
        vline(img, x0 + 5, 3, 46, S3)
        vline(img, x0 + 4, 3, 46, S3 if x0 == 41 else S4)
        for y in range(11, 41, 8):
            hline(img, x0 + 1, x0 + 5, y, B2)
            put(img, x0 + 1, y, B3)
            put(img, x0 + 5, y, B1)
    rect(img, 0, 1, 47, 8, INK)
    hline(img, 1, 46, 2, W0)
    rect(img, 1, 3, 46, 6, S4)
    hline(img, 1, 46, 6, S3)
    hline(img, 1, 46, 7, B2)
    for x in range(3, 46, 5):
        put(img, x, 4, B3)
        put(img, x + 1, 5, B1)
    put(img, 20, 0, (L3 if f % 2 == 0 else L2) if lit else P["red"])
    put(img, 21, 0, INK)
    # the floor
    rect(img, 0, 41, 47, 47, INK)
    hline(img, 1, 46, 41, B3)
    hline(img, 1, 46, 42, B2)
    rect(img, 1, 43, 46, 45, S4)
    hline(img, 1, 46, 43, W0)
    hline(img, 1, 46, 46, S3)
    for i, x in enumerate(range(4, 46, 4)):
        put(img, x, 44, (L3 if (i + f) % 3 == 0 else L1) if lit else L0)


def hook(img, y1, sway):
    rect(img, 21, 8, 26, 9, S2)
    hline(img, 21, 26, 8, S3)
    vline(img, 23, 10, y1, S2)
    x = 23 + sway
    put(img, x, y1 + 1, B2)
    put(img, x + 1, y1 + 2, B2)
    put(img, x, y1 + 3, B1)
    put(img, x - 1, y1 + 2, B1)


def girders(img, x0, y):
    """A bundle of brass girders on the bay floor."""
    for k in range(3):
        hline(img, x0 + k, x0 + 9 + k, y - k * 2, B2)
        hline(img, x0 + k, x0 + 9 + k, y - k * 2 + 1, B0)
        put(img, x0 + k, y - k * 2, B3)


def skiff(img, x, y, f, crate=True):
    """A small skiff (as skiff.png) at x, y = the keel's centre."""
    rows = ["....kQqk....", ".....kk.....", ".kkkkkkkk...", ".kHWWWWHk...", ".kWwwwwWk.kk", "kQQQQQQQQQQk",
            "kqqqqqLqqqk.", ".kbbbbbbbk..", "..kkkkkkk..."]
    key = {"k": INK, "Q": B3, "q": B2, "b": B1, "H": P["wood5"], "W": P["wood4"], "w": P["wood3"], "L": L2}
    ox, oy = x - 6, y - 9
    for j, r in enumerate(rows):
        for i, ch in enumerate(r):
            if not crate and j in (2, 3, 4) and ch in "HWwk" and i < 9:
                continue
            if ch in key:
                put(img, ox + i, oy + 1 + j, key[ch])
    k = [5, 3, 1, 3][f % 4]
    hline(img, ox + 5 - k, ox + 5 + k, oy, S4)
    put(img, ox + 5 - k, oy, P["red"])
    put(img, ox + 5 + k, oy, P["red"])


# ================================================================ the Floating City
def platform(img, f, cy=29):
    """A floating disc: a white top (an ellipse, lit far edge), a brass rim, a shallow underside
    in shade, three rotor pods under it turning."""
    cx, rx, ry = 23.5, 15, 4
    # the underside: a shallow cone
    for y in range(cy, cy + 7):
        half = round(rx * (1 - (y - cy) / 7) ** 0.8)
        for x in range(round(cx - half), round(cx + half) + 1):
            put(img, x, y, S2 if x < cx else S1)
    # the rotor pods under it
    for px in (12, 23, 35):
        rect(img, px - 1, cy + 5, px + 1, cy + 8, B2)
        put(img, px - 1, cy + 5, B3)
        k = [4, 2, 4, 2][f % 4] if f % 2 == 0 else 2
        hline(img, px - k, px + k, cy + 9, S4)
        put(img, px - k, cy + 9, P["red"])
        put(img, px + k, cy + 9, P["red"])
    # the rim and top
    for y in range(cy - ry - 1, cy + 2):
        for x in range(round(cx - rx - 1), round(cx + rx + 2)):
            dx, dy = (x + 0.5 - cx) / (rx + 0.5), (y + 0.5 - cy + 0.5) / (ry + 0.5)
            d = dx * dx + dy * dy
            if d <= 1:
                put(img, x, y, W0 if dy < -0.4 else S4)
            elif d <= 1.35 and dy > -0.2:
                put(img, x, y, B2 if dx < 0.3 else B1)
    hline(img, round(cx - rx + 2), round(cx + rx - 2), cy + 2, B1)


def house(img, x, y, w, lit, roof=None):
    """A little house standing on row y: white walls, a copper roof, a window."""
    roof = roof or P["copper2"]
    rect(img, x, y - 4, x + w - 1, y, S4)
    vline(img, x + w - 1, y - 4, y, S3)
    for i in range(w + 2):
        put(img, x - 1 + i, y - 5, roof)
    for i in range(1, w):
        put(img, x - 1 + i, y - 6, roof if i < w // 2 + 1 else P["copper1"])
    put(img, x + w // 2, y - 7, P["copper1"])
    put(img, x + 1, y - 2, L2 if lit else INK2)
    if w > 3:
        put(img, x + 3, y - 2, L3 if lit else INK2)


def spire(img, x, top, base, lit, f, flag=True):
    """A white spire: a shaft with a lit left edge, a teal cupola, a gold finial, windows."""
    for y in range(top + 4, base + 1):
        put(img, x - 1, y, W0)
        put(img, x, y, S4)
        put(img, x + 1, y, S3)
    for dy, w in ((0, 0), (1, 1), (2, 1), (3, 2)):
        for dx in range(-w, w + 1):
            put(img, x + dx, top + dy, P["teal"] if dx <= 0 else P["water4"])
    put(img, x, top - 1, L2)
    put(img, x, top - 2, B3)
    for y in range(top + 6, base - 1, 4):
        put(img, x, y, L3 if lit and (y // 4 + f) % 3 else INK2 if not lit else L2)
    if flag and lit:
        put(img, x + 1, top - 2, P["red"])
        put(img, x + 2, top - 2 + (f % 2), P["red"])


def mini_skiff(img, x, y, f):
    """A skiff at picture scale (9x6): rotor, mast, a crate, a brass hull bow-east; x, y the keel."""
    k = [4, 2, 1, 2][f % 4]
    hline(img, x - k, x + k, y - 5, S4)
    put(img, x - k, y - 5, P["red"])
    put(img, x + k, y - 5, P["red"])
    put(img, x, y - 4, S2)
    rect(img, x - 2, y - 3, x, y - 2, P["wood4"])
    put(img, x - 2, y - 3, P["wood5"])
    hline(img, x - 4, x + 4, y - 1, B3)
    put(img, x + 4, y - 2, B3)
    hline(img, x - 3, x + 3, y, B1)
    put(img, x + 1, y, L2)


def picture(objects, f, lit, deep, fx=None):
    """Sky, then the objects (their own layer, ink-outlined so they stand off the sky), then light
    effects (no outline), then the bay's frame over all of it."""
    img = new(N, N)
    sky(img, deep)
    obj = new(N, N)
    objects(obj)
    img.alpha_composite(outline(obj, INK))
    if fx:
        fx(img)
    frame(img, f, lit)
    return img


def city(stage, f):
    lit = stage == "run"
    return picture(lambda img: _city(img, stage, f, lit), f, lit, True,
                   (lambda img: city_glints(img, f)) if lit else None)


def _city(img, stage, f, lit):
    if stage == 0:
        hook(img, 22, (0, 1)[f % 2])
        girders(img, 9, 39)
        girders(img, 28, 39)
        # the platform's ring marked out in the air with little buoys
        for i in range(10):
            a = i / 10 * 2 * math.pi
            bx, by = round(23.5 + math.cos(a) * 14), round(29 + math.sin(a) * 4)
            put(img, bx, by, L2 if (i + f) % 2 else B1)
        mini_skiff(img, 14, 20 + (f % 2), f)
    else:
        platform(img, f)
        if stage == 1:
            # a little crane on the platform, swinging a girder
            vline(img, 30, 15, 25, B2)
            hline(img, 22, 33, 15, B2)
            vline(img, 24 + (f % 2), 16, 19, S2)
            hline(img, 21 + (f % 2), 27 + (f % 2), 20, B3)
            house(img, 13, 25, 4, False)
        else:
            house(img, 11, 25, 4, lit)
            house(img, 31, 25, 5, lit, P["copper1"])
            spire(img, 23, 11, 25, lit, f)
            spire(img, 17, 17, 25, lit, f, flag=False)
            spire(img, 29, 15, 24, lit, f, flag=False)
            if lit:
                mini_skiff(img, 34 - (f % 2), 16, f)


def city_glints(img, f):
    for gx, gy in (((12, 14), (36, 31)), ((35, 23), (10, 31)))[f % 2]:
        put(img, gx, gy, L3)


# ================================================================ the Scrap Transmuter
def scrap(img, x0, y):
    """A heap of scrap: slag lumps, a bent iron plate, a gear, rust."""
    pts = [(0, 0, P["slag0"]), (1, 0, P["slag1"]), (2, 0, P["slag0"]), (3, 0, S2), (4, 0, S1), (5, 0, P["earth2"]),
           (6, 0, P["slag0"]), (7, 0, P["earth1"]), (1, -1, P["iron1"]), (2, -1, P["iron2"]), (3, -1, P["slag1"]),
           (4, -1, S3), (5, -1, S2), (6, -1, P["copper1"]), (2, -2, P["slag1"]), (3, -2, P["iron1"]),
           (4, -2, P["copper0"]), (5, -2, S2), (3, -3, S3), (4, -3, P["slag0"])]
    for dx, dy, c in pts:
        put(img, x0 + dx, y + dy, c)


def alembic(img, f, door, coils=True):
    """The furnace: a round brass belly on three feet, a riveted band, a door, copper coils."""
    cx, cy, rx, ry = 23.5, 31, 10, 8
    for y in range(cy - ry, cy + ry + 1):
        for x in range(12, 36):
            dx, dy = (x + 0.5 - cx) / (rx + 0.5), (y + 0.5 - cy) / (ry + 0.5)
            if dx * dx + dy * dy > 1:
                continue
            lam = -dx * 0.6 - dy * 0.8
            put(img, x, y, B3 if lam > 0.5 else B2 if lam > -0.1 else B1 if lam > -0.6 else B0)
    for fx in (16, 23, 31):
        vline(img, fx, cy + ry, 40, B1)
        put(img, fx, 40, B0)
    # a riveted band round the shoulder
    for x in range(12, 36):
        dx, dy = (x + 0.5 - cx) / (rx + 0.5), (cy - 4 + 0.5 - cy) / (ry + 0.5)
        if dx * dx + dy * dy <= 1:
            put(img, x, cy - 4, B0 if x % 3 else B3)
    if coils:
        # three windings of copper round its waist, each a lit and a shaded row
        for y in (cy - 1, cy + 1, cy + 3):
            for x in range(11, 37):
                dx, dy = (x + 0.5 - cx) / (rx + 1.5), (y + 0.5 - cy) / (ry + 0.5)
                if dx * dx + dy * dy <= 1.0:
                    put(img, x, y, P["copper3"] if dx < -0.5 else P["copper2"] if dx < 0.2 else P["copper1"])
                    put(img, x, y + 1, P["copper0"])
    # the door
    rect(img, 21, cy + 1, 26, cy + 5, INK)
    glow = {"dim": (INK1, INK2), "warm": (L0, L1), "hot": ([L1, L2][f % 2], [L2, L3][f % 2])}[door]
    rect(img, 22, cy + 2, 25, cy + 5, glow[0])
    hline(img, 22, 25, cy + 4, glow[1])
    # the neck on top
    rect(img, 21, cy - ry - 3, 26, cy - ry, B2)
    vline(img, 21, cy - ry - 3, cy - ry, B3)
    vline(img, 26, cy - ry - 3, cy - ry, B1)


def tower(img, f, lit):
    """The coil tower on the alembic's neck: a copper coil column and a glass orb on top."""
    for y in range(16, 21):
        for x in range(21, 27):
            c = (P["copper2"] if x < 23 else P["copper1"] if x < 25 else P["copper0"]) if y % 2 else B0
            put(img, x, y, c)
    cx, cy = 23.5, 13
    for y in range(8, 18):
        for x in range(17, 31):
            d = math.hypot(x + 0.5 - cx, y + 0.5 - cy)
            if d <= 4.6:
                if lit:
                    c = L3 if d < 1.6 else P["violet"] if d < 3.2 else P["slag1"]
                else:
                    c = P["slag0"] if d > 3 else INK2
                put(img, x, y, c)
    put(img, 22, 11, P["sky4"] if not lit else P["bone"])
    put(img, 21, 12, P["sky3"] if not lit else L3)


def arcs(img, f):
    """Lightning: short lamp3 zigzags off the orb, a different pair each frame."""
    sets = [[(17, 12), (16, 13), (15, 12), (14, 13), (30, 14), (31, 15), (32, 14)],
            [(18, 16), (17, 17), (16, 16), (29, 10), (30, 9), (31, 10), (32, 9)]]
    for x, y in sets[f % 2]:
        put(img, x, y, L3)


def coins(img, f):
    """Coins popping out of a spout on the right, with glints."""
    rect(img, 34, 34, 37, 36, B2)
    hline(img, 34, 37, 34, B3)
    put(img, 37, 35, INK)
    pos = [[(37, 30), (35, 26), (38, 37)], [(38, 27), (36, 32), (37, 38)]][f % 2]
    for x, y in pos:
        rect(img, x, y, x + 1, y + 1, L2)
        put(img, x, y, L3)
        put(img, x + 1, y + 1, B1)


def transmuter(stage, f):
    lit = stage == "run"

    def fx(img):
        if lit:
            arcs(img, f)
            gx, gy = [(40, 29), (38, 25)][f % 2]
            put(img, gx, gy, L3)
            put(img, 22 - f % 2 * 6, 9 + f % 2 * 2, L3)
    return picture(lambda img: _transmuter(img, stage, f, lit), f, lit, True, fx)


def _transmuter(img, stage, f, lit):
    scrap(img, 8, 40)
    scrap(img, 11, 40)
    if stage == 0:
        # the foundation ring and a coil on the hook
        for x in range(13, 35):
            put(img, x, 40, B2 if x % 2 else B1)
        hline(img, 13, 34, 39, B3)
        hook(img, 20, (0, 1)[f % 2])
        for y in range(22, 27):
            hline(img, 21 + (f % 2), 25 + (f % 2), y, P["copper2"] if y % 2 else P["copper0"])
    else:
        # the chute from the scrap heap into the belly
        for i in range(6):
            put(img, 9 + i, 33 - i // 2, S3)
            put(img, 9 + i, 34 - i // 2, S1)
        alembic(img, f, "hot" if lit else "dim" if stage == 1 else "warm")
        if stage == 2 or lit:
            tower(img, f, lit)
        if stage == 1:
            hook(img, 14, (0, 1)[f % 2])
        if lit:
            coins(img, f)
            # a scrap lump going up the chute
            put(img, 10 + f % 2 * 2, 32 - f % 2, P["slag1"])


def build():
    names = ["p0a", "p0b", "p1a", "p1b", "p2a", "p2b", "run1", "run2"]
    stages = [(0, 0), (0, 1), (1, 0), (1, 1), (2, 0), (2, 1), ("run", 0), ("run", 1)]
    ship("mega_city", [city(s, f) for s, f in stages], 4, extra={"names": names}, look=4, bg=P["bone"])
    ship("mega_transmuter", [transmuter(s, f) for s, f in stages], 4, extra={"names": names}, look=4,
         bg=P["bone"])


if __name__ == "__main__":
    build()
