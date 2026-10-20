"""Effects and Sparks in the lantern style (phase 3), hand-drawn by code. Lantern light is warm
and stepped: lamp3 at the heart, lamp2, lamp1, lamp0 outward, embers that cool as they drift.
Overlays keep the read: nothing bright in a module's icon well (x, y 3..12) or in any top-right
5x5 (the pip), and the middle of a machine stays clear.

    fx_burst          32x32 x6  15 fps   the grade stamp's flash: a hot core, rays, a ring, embers
    fx_confetti        4x4  x8           paper flakes; pairs of frames are one flake face-on and
                                         edge-on (the HUD cycles frames, so flakes flutter)
    fx_fold           32x32 x8  16 fps   the fold: a sheet with glowing creases, corners in, an
                                         envelope, a brass seal, a flash, sparkles
    fx_overdrive      16x16 x4  12 fps   Overdrive's ring: an ember rim with marching hot dashes,
    fx_overdrive_big  32x32 x4  12 fps   sparks climbing the sides, the pip corner left calm
    module_glow       16x16 x4   8 fps   a working module: four small lanterns on its brass band breathe
    module_od         16x16 x4   8 fps   a module at 3x: the band glows copper-hot, heads marching
    fold_corner        8x8  x4           the fold box's brass corner brackets (TL, TR, BL, BR)
    spark_vein        16x16 x4   8 fps   a Spark: a ink-outlined star of lantern light and two motes
    spark_inspector   16x16 x2   2 fps   the Inspector Spark: a frog inspector with a clipboard and
                                         a lantern that flickers
"""
import math

from common import P, new, draw, rect, export, from_rows, scale, on_bg, OUT

INK = P["ink"]
L0, L1, L2, L3 = P["lamp0"], P["lamp1"], P["lamp2"], P["lamp3"]


def put(img, x, y, c):
    if 0 <= x < img.width and 0 <= y < img.height:
        draw(img, [(x, y)], c)


# ---------------------------------------------------------------- burst
def burst(f):
    img = new(32, 32)
    cx = cy = 15.5
    ring_r = [5, 8, 11, 13, 14, 15][f]
    ring_c = [L3, L2, L1, L1, L0, None][f]
    core = [3.2, 5.0, 4.0, 2.5, 0, 0][f]
    ray = [(4, 8), (5, 13), (8, 15), (11, 15), None, None][f]
    for y in range(32):
        for x in range(32):
            d = math.hypot(x + 0.5 - cx, y + 0.5 - cy)
            if ring_c and ring_r - 1 < d <= ring_r and (f < 3 or (x + y) % 3):
                put(img, x, y, ring_c)
            if d <= core:
                put(img, x, y, L3 if d < core - 1.5 else L2)
    if ray:
        for k in range(8):
            a = k * math.pi / 4
            long = k % 2 == 0
            r0, r1 = ray[0], ray[1] if long else ray[1] - 3
            for r in range(r0, r1 + 1):
                if f == 3 and r % 3 == 0:
                    continue
                x, y = int(cx + math.cos(a) * r), int(cy + math.sin(a) * r)
                put(img, x, y, L3 if r < (r0 + r1) / 2 and f < 2 else L2 if f < 3 else L1)
    # embers: twelve fixed headings, drifting out and cooling
    if f >= 2:
        for k in range(12):
            a = k * math.pi / 6 + 0.26
            r = 9 + (f - 2) * 2 + (k % 3)
            x, y = int(cx + math.cos(a) * r), int(cy + math.sin(a) * r + (f - 2))
            put(img, x, y, [L3, L2, L1, L0][f - 2])
    return img


# ---------------------------------------------------------------- confetti
def confetti():
    out = []
    for face, edge in ((P["lamp2"], P["lamp0"]), (P["moss5"], P["moss3"]), (P["violet"], P["slag1"]),
                       (P["teal"], P["water3"])):
        a = new(4, 4)
        rect(a, 0, 1, 2, 3, face)
        put(a, 0, 1, P["bone"])
        put(a, 2, 3, edge)
        b = new(4, 4)
        draw(b, [(1, 1), (2, 2), (3, 3)], edge)
        put(b, 0, 0, face)
        out += [a, b]
    return out


# ---------------------------------------------------------------- the fold
PAPER, BACK, SHADE = P["bone"], P["wood5"], P["steel4"]


def sheet_img(cut, crease=False, seal=False):
    """The sheet with its four corners folded in by `cut` px (a diamond at cut 14)."""
    img = new(32, 32)
    lo, hi = 2, 29
    for y in range(lo, hi + 1):
        for x in range(lo, hi + 1):
            dx = min(x - lo, hi - x)
            dy = min(y - lo, hi - y)
            if dx + dy < cut - 1:
                continue
            c = PAPER
            if dx + dy < cut + 1 and cut:
                c = INK                                                         # the fold line
            elif cut and dx + dy < cut + 1 + cut // 2 and (dx + dy) % 2 == 0 and cut < 14:
                c = BACK                                                        # the turned corner
            if not cut and (x == hi or y == hi):
                c = SHADE
            put(img, x, y, c)
    if not cut:
        rect(img, lo - 1, lo - 1, hi + 1, lo - 1, INK)
        rect(img, lo - 1, hi + 1, hi + 1, hi + 1, INK)
        rect(img, lo - 1, lo - 1, lo - 1, hi + 1, INK)
        rect(img, hi + 1, lo - 1, hi + 1, hi + 1, INK)
    if crease:
        for i in range(lo, hi + 1):
            put(img, 15, i, L2)
            put(img, 16, i, L1)
            put(img, i, 15, L2)
            put(img, i, 16, L1)
    if cut >= 14:
        paper = img.load()
        for i in range(-12, 13):                                                # the envelope's X
            for (x, y) in ((15 + i, 15 + i), (16 + i, 15 - i)):
                if 0 <= x < 32 and 0 <= y < 32 and paper[x, y][3] and paper[x, y][:3] != (19, 14, 28):
                    put(img, x, y, SHADE)
    if seal:
        for y in range(13, 19):
            for x in range(13, 19):
                if math.hypot(x - 15.5, y - 15.5) <= 3:
                    put(img, x, y, P["brass2"])
        draw(img, [(14, 14), (15, 14)], P["brass3"])
        draw(img, [(15, 15), (16, 16)], L2)
    return img


def star(img, cx, cy, r, core=L3, arm=L2, outline=False):
    pts = [(cx, cy)]
    for i in range(1, r + 1):
        pts += [(cx + i, cy), (cx - i, cy), (cx, cy + i), (cx, cy - i)]
    if outline:
        ring_ = set()
        for (x, y) in pts:
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1), (1, 1), (-1, -1), (1, -1), (-1, 1)):
                ring_.add((x + dx, y + dy))
        draw(img, [p for p in ring_ if p not in pts], INK)
    draw(img, pts, arm)
    draw(img, [(cx, cy)] + ([(cx + 1, cy), (cx - 1, cy), (cx, cy + 1), (cx, cy - 1)] if r > 2 else []), core)


def fold(f):
    if f == 0:
        return sheet_img(0, crease=True)
    if f in (1, 2, 3):
        return sheet_img([5, 10, 14][f - 1])
    if f == 4:
        return sheet_img(14, seal=True)
    img = new(32, 32)
    if f == 5:
        star(img, 15, 15, 9)
        for k in range(4):
            a = k * math.pi / 2 + math.pi / 4
            for r in range(3, 7):
                put(img, int(15.5 + math.cos(a) * r), int(15.5 + math.sin(a) * r), L1)
    else:
        spots = [(5, 6), (26, 5), (4, 25), (27, 26), (15, 2), (16, 29), (2, 15), (29, 16)]
        for i, (x, y) in enumerate(spots):
            if f == 6 or i % 2 == 0:
                star(img, x, y, 2 if f == 6 else 1, L3, L2 if f == 6 else L1)
    return img


# ---------------------------------------------------------------- overdrive ring
def perimeter(n):
    pts = [(x, 0) for x in range(n)] + [(n - 1, y) for y in range(1, n)] + \
        [(x, n - 1) for x in range(n - 2, -1, -1)] + [(0, y) for y in range(n - 2, 0, -1)]
    return [p for p in pts if p not in ((0, 0), (n - 1, 0), (0, n - 1), (n - 1, n - 1))]


def overdrive(f, n):
    img = new(n, n)
    calm = lambda x, y: x >= n - 5 and y <= 4
    for i, (x, y) in enumerate(perimeter(n)):
        if calm(x, y):
            continue
        k = (i + f * 2) % 6
        put(img, x, y, L3 if k == 0 else L2 if k == 1 else L0)
    for i, (x, y) in enumerate(perimeter(n - 2)):
        x, y = x + 1, y + 1
        if calm(x, y):
            continue
        if (i * 7 + f * 3) % 11 == 0:
            put(img, x, y, P["copper1"])
    # sparks climbing the sides
    for side in (2, n - 3):
        for j in range(2 if n == 16 else 4):
            y = (n - 3) - ((f * 3 + j * (n // 2)) % (n - 4))
            if not calm(side, y):
                put(img, side, y, L2 if j % 2 == 0 else L3)
    return img


# ---------------------------------------------------------------- modules
def module_glow(f):
    img = new(16, 16)
    light = [L0, L1, L2, L1][f]
    for (x, y) in ((7, 1), (8, 1), (1, 7), (1, 8), (14, 7), (14, 8), (7, 14), (8, 14), (1, 1), (1, 14),
                   (14, 14)):
        put(img, x, y, light)
    if f == 2:
        draw(img, [(7, 1), (1, 7), (14, 8), (8, 14)], L3)
    return img


def band():
    """The module's brass band (rings 1 and 2), clockwise, without the pip's 5x5."""
    pts = []
    for r in (1, 2):
        n = 16 - 2 * r
        pts += [(x + r, y + r) for (x, y) in perimeter(n)] + [(r, r), (15 - r, 15 - r), (r, 15 - r)]
    return [(x, y) for (x, y) in pts if not (x >= 11 and y <= 4)]


def module_od(f):
    img = new(16, 16)
    for i, (x, y) in enumerate(band()):
        k = (i + f * 3) % 7
        put(img, x, y, L3 if k == 0 else L2 if k == 1 else P["copper2"] if (x + y) % 2 else P["copper1"])
    return img


def fold_corner():
    base = new(8, 8)
    rect(base, 0, 0, 7, 3, INK)
    rect(base, 0, 0, 3, 7, INK)
    rect(base, 1, 1, 6, 2, P["brass2"])
    rect(base, 1, 1, 2, 6, P["brass2"])
    draw(base, [(x, 1) for x in range(1, 7)] + [(1, y) for y in range(1, 7)], P["brass3"])
    put(base, 1, 1, L3)
    put(base, 2, 2, P["brass1"])
    tl = base
    tr = base.transpose(0)          # FLIP_LEFT_RIGHT
    bl = base.transpose(1)          # FLIP_TOP_BOTTOM
    br = tr.transpose(1)
    return [tl, tr, bl, br]


# ---------------------------------------------------------------- Sparks
def spark_vein(f):
    img = new(16, 16)
    big = [3, 2, 3, 4][f]
    star(img, 7, 8, big, L3, L2, outline=True)
    motes = [((3, 3), (12, 12)), ((4, 2), (12, 11)), ((5, 3), (11, 12)), ((4, 4), (12, 13))][f]
    for (x, y) in motes:
        star(img, x, y, 1, L3, L1, outline=True)
    return img


INSPECTOR = [
    "................",
    "......kkkk......",
    ".....kddddk.....",
    "....kkkkkkkk....",
    "...kmGGGGGGmk...",
    "...kGwkGGwkGk...",
    "...kmGGGGGGmk...",
    "....kmkkkkmk....",
    ".....kkmmkk.....",
    "....kIIIIIIkkk..",
    "..kkIiJIIIIkbbk.",
    ".kLkIiIIIIIkbsk.",
    ".kOkIiIIIIIkbbk.",
    "..kkkIiIIIk.kk..",
    "....kmk.kmk.....",
    "....kkk.kkk.....",
]


def spark_inspector(f):
    key = {"k": INK, "d": P["ink2"], "m": P["moss3"], "G": P["moss5"], "w": P["bone"], "I": P["iron1"],
           "i": P["iron0"], "J": P["iron2"], "b": P["bone"], "s": P["steel3"],
           "L": L3 if f == 0 else L2, "O": L2 if f == 0 else L1}
    img = from_rows(INSPECTOR, key)
    if f == 1:   # the pencil taps the clipboard
        put(img, 13, 11, INK)
    return img


def build():
    export("fx_burst", [burst(f) for f in range(6)], 15)
    export("fx_confetti", confetti(), 0)
    export("fx_fold", [fold(f) for f in range(8)], 16)
    export("fx_overdrive", [overdrive(f, 16) for f in range(4)], 12)
    export("fx_overdrive_big", [overdrive(f, 32) for f in range(4)], 12)
    export("module_glow", [module_glow(f) for f in range(4)], 8)
    export("module_od", [module_od(f) for f in range(4)], 8)
    export("fold_corner", fold_corner(), 0)
    export("spark_vein", [spark_vein(f) for f in range(4)], 8)
    export("spark_inspector", [spark_inspector(f) for f in range(2)], 2)


if __name__ == "__main__":
    build()
