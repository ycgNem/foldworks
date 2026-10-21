"""The ore outcrops (the ore revamp, DECISIONS.md "The ore revamp", 2026-10-21).

Each ore is one 32x32 outcrop drawn for exactly its 2x2 patch (patches are always 2x2), seen in
the game's high 3/4 view with the light from the top-left: lit tops, shadowed front faces, a cast
shadow down-right on the deck. The outcrop breaks up through a hole in the planks, so the deck
shows round it and the patch never reads as a square tile. The four ores are told apart by
silhouette first, colour second:

- iron:   blocky banded-iron slabs, flat tops (blue metallic hematite, lit rims in steel) and dark
          front faces striped by thin rust-red jasper layers; silver glints.
- copper: a bubbly verdigris/malachite crust (teal, ringed like malachite) with bright native
          copper nuggets breaking out of it: the most colourful thing on the deck.
- coal:   a black seam cracked up through the planks: tall jagged faceted anthracite shards with
          a cool sheen on their lit edges, splinters round the hole, embers deep in the cracks.
- sand:   a barchan dune (a crescent: long windward slope, steep slip face, horns downwind) in
          pale gold with wind ripples and two shells; no outline, no rocks.

Every outcrop is a height field rendered back to front (each pixel's colour chosen from the ore's
ramp by the surface's facing and, for iron and copper, its layer), then finished by hand rules
(outlines, ridge sheen, rims, splinters, shells). Outputs, per ore:
- src/art/tile_ore_<ore>.png: frame 0 the whole outcrop at 16x16 (for screens that show one
  tile of an ore, e.g. the Survey Office), then the outcrop in four 16x16 quadrants (TL, TR, BL,
  BR), transparent where the deck shows; its JSON also lists "glints" (points in the 32x32 for src/render/orefx.ts)
  and, for coal, "embers".
- src/art/tile_ore_<ore>_spill.png: 16 frames of 16x16, the 4x4 tiles round and under the patch
  (frame = (dy + 1) * 4 + (dx + 1), dx, dy in -1..2 from the patch's top-left; the middle four
  are empty, their scatter is in the outcrop itself): pebbles, stains, cracks and drift that
  ground.ts bakes onto the neighbouring deck. Never far (4 px), never dense.
Run `python ores.py` from this folder; it writes contact sheets to out/ (ores_look*.png,
ores_alone@8x.png).
"""
import math
from collections import deque

from PIL import Image

from common import P, OUT, new, draw, export, scale, rgb, rng
from terrain import deck_tile

S = 32
L = (-0.55, -0.62, 0.56)      # towards the light: up-left on the ground, and above
_n = math.sqrt(sum(c * c for c in L))
L = tuple(c / _n for c in L)


def field(fn):
    return [[fn(x + 0.5, y + 0.5) for x in range(S)] for y in range(S)]


def diffuse(H, x, y):
    def h(xx, yy):
        xx, yy = min(max(xx, 0), S - 1), min(max(yy, 0), S - 1)
        return H[yy][xx][0]
    dx = (h(x + 1, y) - h(x - 1, y)) / 2
    dy = (h(x, y + 1) - h(x, y - 1)) / 2
    n = (-dx, -dy, 1.0)
    m = math.sqrt(sum(c * c for c in n))
    return sum(a * b for a, b in zip(n, L)) / m


def render(H, colour, ground, outline_col=P["ink"], gap_col=P["ink1"], shadow_len=7, soft=False):
    """H[y][x] = (height, material, object id). colour(kind, mat, level, z, x, y) -> hex for a top
    ('top', level = facing to the light) or a front face ('face', level = depth below the top).
    ground(x, y, shadowed) -> hex or None for the floor round the outcrop. Returns (img, info),
    info mapping each drawn pixel to (kind, mat, obj, x, y, z)."""
    img = new(S, S)
    info = {}
    # the floor first, with the outcrop's shadow cast down-right
    for y in range(S):
        for x in range(S):
            if H[y][x][0] > 0.25:
                continue
            sh = any(0 <= x - k and 0 <= y - k and H[y - k][x - k][0] > k * 0.85 for k in range(1, shadow_len))
            c = ground(x, y, sh)
            if c:
                draw(img, [(x, y)], c)
                info[(x, y)] = ("ground", None, -1, x, y, 0)
    # then the outcrop, back row to front row; each cell is a column from its top down to its foot
    for y in range(S):
        for x in range(S):
            h, mat, obj = H[y][x][:3]
            if h <= 0.25:
                continue
            hi = max(1, int(round(h)))
            top = y - hi
            if 0 <= top:
                lev = H[y][x][3] if len(H[y][x]) > 3 else diffuse(H, x, y)
                draw(img, [(x, top)], colour("top", mat, lev, h, x, y))
                info[(x, top)] = ("top", mat, obj, x, y, h)
            for sy in range(max(0, top + 1), y + 1):
                z = y - sy
                draw(img, [(x, sy)], colour("face", mat, sy - top, z, x, y))
                info[(x, sy)] = ("face", mat, obj, x, y, z)
    # a gap line where a nearer object stands in front of a farther one
    for (x, y), (kind, mat, obj, gx, gy, z) in list(info.items()):
        if kind != "top" or y == 0:
            continue
        up = info.get((x, y - 1))
        if up and up[0] != "ground" and up[2] != obj and up[4] < gy - 1:
            draw(img, [(x, y - 1)], gap_col)
    # the outline: floor pixels touching the outcrop
    if outline_col:
        edge = []
        for (x, y), v in list(info.items()):
            if v[0] == "ground":
                continue
            for dx, dy in ((-1, 0), (1, 0), (0, -1), (0, 1)):
                q = (x + dx, y + dy)
                if 0 <= q[0] < S and 0 <= q[1] < S and (q not in info or info[q][0] == "ground"):
                    edge.append((q, dx, dy))
        if soft:   # sand: no ink, only a contact shadow under it and to its right
            edge = [e for e in edge if (e[1], e[2]) in ((1, 0), (0, 1))]
        for q, _, _ in edge:
            draw(img, [q], outline_col)
            info[q] = ("outline", None, -1, q[0], q[1], 0)
    return img, info


def blob_mask(cx, cy, rx, ry, seed, wob=0.16, lobes=5):
    """An irregular blob (the hole in the deck): an ellipse with a few lobes and bites."""
    r = rng(seed)
    ph = [r.random() * 6.283 for _ in range(4)]
    m = set()
    for y in range(S):
        for x in range(S):
            dx, dy = (x + 0.5 - cx) / rx, (y + 0.5 - cy) / ry
            a = math.atan2(dy, dx)
            rr = 1 + wob * (math.sin(a * lobes + ph[0]) * 0.6 + math.sin(a * (lobes + 3) + ph[1]) * 0.4)
            if dx * dx + dy * dy <= rr * rr:
                m.add((x, y))
    return m


def hole_ground(mask, inside, deep, rim, lip):
    """The floor of a hole in the deck: the plank thickness shows on its far (north) edge as a
    wood face, the near edge is a dark lip; inside is the ore's bed."""
    def g(x, y, sh):
        if (x, y) not in mask:
            return P["wood2"] if sh else None
        if (x, y - 1) not in mask or (x, y - 2) not in mask:
            return rim if (x, y - 1) not in mask else P["wood0"]
        if any((x + dx, y + dy) not in mask for dx, dy in ((-1, 0), (1, 0), (0, 1))):
            return lip
        return deep if sh else inside(x, y)
    return g


def nearest_top(info, gx, gy, kinds, mats=None):
    best, bd = None, 99
    for (x, y), v in info.items():
        if v[0] in kinds and (mats is None or v[1] in mats):
            d = abs(x - gx) + abs(y - gy)
            if d < bd:
                best, bd = (x, y), d
    return best if bd < 5 else None


# ---------------------------------------------------------------- iron
def iron():
    mask = blob_mask(16, 16.5, 14.8, 14.4, 11, 0.12, 4)
    # three big slabs and their rubble: (cx, cy, rx, ry, height, tilt x, tilt y), chamfered flat
    # tops tipped a little, so the layers cross them as thin lines
    rocks = [
        (10.0, 12.5, 8.0, 6.0, 9.0, -0.10, 0.06),
        (23.5, 10.5, 6.0, 4.8, 6.0, 0.10, -0.04),
        (19.5, 22.5, 8.5, 6.0, 7.5, 0.06, 0.10),
        (6.5, 24.5, 4.0, 3.5, 3.5, -0.10, 0.0),
        (28.0, 21.5, 2.4, 2.2, 2.4, 0, 0),
        (11.5, 28.5, 2.4, 1.8, 1.6, 0, 0),
    ]

    def hf(x, y):
        best = (0, None, -1)
        for i, (cx, cy, rx, ry, h0, tx, ty) in enumerate(rocks):
            dx, dy = (x - cx) / rx, (y - cy) / ry
            d = (abs(dx) ** 3.0 + abs(dy) ** 3.0) ** (1 / 3.0)          # a blocky superellipse
            if d >= 1:
                continue
            h = h0 * min(1, (1 - d) / 0.2) + tx * (x - cx) + ty * (y - cy)
            if h > best[0]:
                best = (h, "iron", i)
        return best
    H = field(hf)

    def band(z, x):
        # banded iron: layers 1 px thick, wavering along the rock, every 4th a rust-red jasper
        # and one a blue hematite seam; 0 jasper, 2 seam, else plain dark hematite
        return int(math.floor(z + 0.7 * math.sin(x * 0.55) + 0.4 * math.sin(x * 0.21 + 1))) % 4

    def rust(z, x, w):
        return band(z, x) == 0 and (w >= 1 or (z + 0.7 * math.sin(x * 0.55) + 0.4 * math.sin(x * 0.21 + 1)) % 1 < w)

    def colour(kind, mat, lev, z, x, y):
        if kind == "top":
            if rust(z, x, 0.4) and lev > 0.4:
                return P["copper1"]
            return P["iron2"] if lev > 0.8 else P["iron1"] if lev > 0.45 else P["iron0"] if lev > 0.2 else P["steel0"]
        # front faces: dark hematite striped by its rust layers
        if rust(z, x, 1.0):
            return P["copper1"] if lev == 1 else P["copper0"]
        if band(z, x) == 2:
            return P["iron1"] if lev == 1 else P["iron0"]
        return P["steel1"] if lev == 1 else P["steel0"] if lev < 6 else P["ink1"]

    def inside(x, y):
        return P["earth1"] if (x * 5 + y * 3) % 7 else P["earth2"]
    img, info = render(H, colour, hole_ground(mask, inside, P["earth0"], P["wood1"], P["earth0"]))
    # hand finish: the slabs' lit back-left rims (cleavage edges catching the light) in steel3
    for (x, y), v in info.items():
        if v[0] != "top":
            continue
        up, lf = info.get((x, y - 1)), info.get((x - 1, y))
        rim = (not up or up[0] in ("ground", "outline")) or (not lf or lf[0] in ("ground", "outline"))
        if rim and img.getpixel((x, y))[:3] in (rgb(P["iron1"]), rgb(P["iron2"])):
            draw(img, [(x, y)], P["steel3"])
    glints = []
    for gx, gy in ((5, 4), (12, 3), (20, 4), (14, 15), (6, 19), (25, 15)):
        p = nearest_top(info, gx, gy, ("top",))
        if p:
            glints.append(p)
    draw(img, glints[:2], P["steel4"])
    return img, glints, [], mask


# ---------------------------------------------------------------- copper
def copper():
    mask = blob_mask(16, 16.5, 15.8, 15.0, 22, 0.14, 5)
    r = rng(5)
    # the crust: a cluster of bubbles (botryoidal malachite), bigger in the middle
    bubbles = [(16, 15, 9, 5.5), (9, 12, 6, 4.5), (23, 11, 6, 4.0), (10, 22, 6, 4.5), (22, 22, 7, 5.0),
               (16, 26, 5, 3.0), (4, 18, 3.5, 2.0), (28, 18, 3.5, 2.5), (15, 7, 4.5, 3.0)]
    for _ in range(10):
        bubbles.append((r.uniform(5, 27), r.uniform(9, 27), r.uniform(2.0, 3.2), r.uniform(1.5, 2.5)))
    # the native copper: knobbly nuggets standing out of the crust
    nuggets = [(12, 13, 3.3, 3.6), (14, 15.5, 2.2, 2.4), (21, 19, 3.0, 3.4), (24, 21, 2.0, 2.0),
               (7, 20, 2.4, 2.4), (19, 9, 2.2, 2.4), (26, 13, 1.7, 1.6), (15, 24, 2.0, 2.0)]

    def hf(x, y):
        h = 0
        for cx, cy, rr, hh in bubbles:
            d2 = ((x - cx) ** 2 + (y - cy) ** 2) / (rr * rr)
            if d2 < 1:
                h = max(h, hh * math.sqrt(1 - d2))
        best = (h, "crust", 0)
        for i, (cx, cy, rr, hh) in enumerate(nuggets):
            d2 = ((x - cx) ** 2 + (y - cy) ** 2) / (rr * rr)
            if d2 < 1:
                v = h * 0.6 + hh * (1 - d2) ** 0.6 + 1.0
                if v > best[0]:
                    best = (v, "cu", 10 + i)
        return best
    H = field(hf)

    def colour(kind, mat, lev, z, x, y):
        if mat == "cu":
            if kind == "top":
                return P["copper3"] if lev > 0.78 else P["copper2"] if lev > 0.45 else P["copper1"]
            return P["copper1"] if lev == 1 else P["copper0"]
        if kind == "top":
            ring = int(z * 1.6) % 3 == 0           # malachite's rings: z contours a step darker
            k = 3 if lev > 0.8 else 2 if lev > 0.58 else 1 if lev > 0.3 else 0
            if ring and k > 0:
                k -= 1
            return (P["water2"], P["water3"], P["water4"], P["teal"])[k]
        # a south-facing slope too steep to show as top: its own light, a step darker (no stripes)
        fl = diffuse(H, x, y) - 0.3
        return P["water4"] if fl > 0.58 else P["water3"] if fl > 0.25 else P["water2"] if fl > -0.1 else P["water1"]

    def inside(x, y):
        return P["earth1"] if (x * 3 + y * 5) % 9 else P["water2"]   # verdigris-stained earth
    img, info = render(H, colour, hole_ground(mask, inside, P["earth0"], P["wood1"], P["earth0"]),
                       gap_col=P["water1"])
    # each nugget casts a 1 px shadow on the crust (right and below) and has a hot specular
    for (x, y), v in list(info.items()):
        if v[1] == "cu" and v[0] in ("top", "face"):
            for dx, dy in ((1, 0), (0, 1)):
                q = info.get((x + dx, y + dy))
                if q and q[1] == "crust":
                    draw(img, [(x + dx, y + dy)], P["copper0"])
    glints = []
    for cx, cy, rr, hh in nuggets:
        p = nearest_top(info, cx - rr * 0.4, cy - rr * 0.5 - hh, ("top",), ("cu",))
        if p:
            glints.append(p)
    draw(img, glints[:4], P["lamp2"])
    return img, glints, [], mask


# ---------------------------------------------------------------- coal
def coal():
    mask = blob_mask(16, 17, 14.6, 13.8, 33, 0.22, 3)
    # shards: (cx, cy, half-width u, half-length v, height, angle): faceted diamond pyramids,
    # tall and pointed so the seam's silhouette is jagged
    shards = [
        (10, 13, 5.5, 4.0, 11.0, 0.5), (20, 11, 4.5, 3.8, 9.0, -0.4), (16, 21, 6.0, 4.5, 10.0, 0.15),
        (25, 21, 4.0, 3.5, 7.0, 0.7), (7, 23, 4.0, 3.6, 6.5, -0.6), (27, 13, 2.6, 2.4, 4.0, 0.2),
        (11, 28, 3.0, 2.0, 3.0, 0.3), (21, 28, 2.4, 2.0, 2.6, -0.2), (4, 15, 2.2, 2.2, 3.0, 0.9),
    ]

    def hf(x, y):
        best = (0, None, -1, None)
        for i, (cx, cy, a, b, h0, ang) in enumerate(shards):
            c, s = math.cos(ang), math.sin(ang)
            u = ((x - cx) * c + (y - cy) * s) / a
            v = (-(x - cx) * s + (y - cy) * c) / b
            d = abs(u) + abs(v)
            if d < 1:
                h = h0 * (1 - d)
                if h > best[0]:
                    # each facet is a plane: its light comes from its own normal, so it shades flat
                    su, sv = (1 if u >= 0 else -1), (1 if v >= 0 else -1)
                    hx = -h0 * (su * c / a - sv * s / b)
                    hy = -h0 * (su * s / a + sv * c / b)
                    n = (-hx, -hy, 1.0)
                    m = math.sqrt(sum(k * k for k in n))
                    best = (h, "coal", i, sum(p * q for p, q in zip(n, L)) / m)
        return best
    H = field(hf)

    def colour(kind, mat, lev, z, x, y):
        # flat facets: anthracite is black with a cool, glassy sheen. A steep facet facing south
        # shows as the column under its top: it keeps its own facet's light, a step darker
        if kind == "face":
            lev = H[y][x][3] - 0.2
        return P["steel2"] if lev > 0.93 else P["steel1"] if lev > 0.56 else P["steel0"] if lev > 0.3 else P["ink2"] if lev > 0.1 else P["ink1"] if lev > -0.25 else P["ink"]

    cracks = set()
    r = rng(9)
    for _ in range(7):            # the seam's cracks, wandering across the hole's floor
        x, y = r.uniform(4, 28), r.uniform(6, 29)
        a = r.uniform(0, 6.283)
        for _ in range(9):
            cracks.add((int(x), int(y)))
            a += r.uniform(-0.7, 0.7)
            x, y = x + math.cos(a), y + math.sin(a)

    def inside(x, y):
        return P["ink"] if (x, y) in cracks else P["earth0"]
    img, info = render(H, colour, hole_ground(mask, inside, P["ink"], P["wood1"], P["ink"]), gap_col=P["ink"])
    # ridge sheen: the lit facet's edge against a dark one, 1 px of cool light
    hl = []
    for (x, y), v in info.items():
        if v[0] != "top" or v[1] != "coal":
            continue
        if img.getpixel((x, y))[:3] in (rgb(P["steel0"]), rgb(P["steel1"])):
            for dx, dy in ((1, 0), (0, 1), (1, 1), (-1, 0)):
                q = info.get((x + dx, y + dy))
                if q and q[0] == "top" and q[2] == v[2] and img.getpixel((x + dx, y + dy))[:3] in (rgb(P["ink"]), rgb(P["ink1"])):
                    hl.append((x, y))
                    break
    draw(img, hl, P["steel3"])
    # splinters: the boards the seam broke, teeth of lit wood on the hole's near rim
    for (x, y) in mask:
        if (x, y + 1) not in mask and (x * 7 + y) % 4 == 0 and info.get((x, y), ("ground",))[0] in ("ground", "outline"):
            draw(img, [(x, y)], P["wood3"])
            if info.get((x, y - 1), ("ground",))[0] == "ground":
                draw(img, [(x, y - 1)], P["wood1"])
    # embers: in the cracks between the shards, where the floor still shows
    embers = []
    for (x, y) in sorted(cracks, key=lambda p: (p[1] * 31 + p[0] * 17) % 23):
        v = info.get((x, y))
        if v and v[0] == "ground" and all(abs(x - ex) + abs(y - ey) > 5 for ex, ey in embers):
            embers.append((x, y))
        if len(embers) >= 5:
            break
    draw(img, embers[:3], P["lamp0"])
    glints = []
    for gx, gy in ((7, 3), (18, 3), (13, 11), (24, 14), (5, 17)):
        p = nearest_top(info, gx, gy, ("top",), ("coal",))
        if p:
            glints.append(p)
    return img, glints, embers, mask


# ---------------------------------------------------------------- sand
def sand():
    """A dune heap filling its patch: wind from the west heaps a long gentle slope up to a curved
    crest, a steeper slip face falls away east into the shade, a low hummock fills the near
    corner. Soft: no ink outline, no rocks."""
    def crest(y):
        return 18.0 + 0.035 * (y - 15.5) ** 2

    def hf(x, y):
        t = (y - 16.0) / 15.0
        if abs(t) >= 1:
            return (0, None, -1)
        H0 = 8.5 * (1 - t * t) ** 0.55
        toe = 1.0 + 0.05 * (y - 16.0) ** 2
        xc = crest(y)
        if x < toe:
            h = 0.0
        elif x <= xc:
            u = (x - toe) / (xc - toe)
            h = H0 * math.sin(u * math.pi / 2) ** 1.2
        else:
            h = H0 - (x - xc) ** 1.25 * 1.15
        h = max(h, 3.2 * math.exp(-((x - 25) ** 2 / 14 + (y - 26) ** 2 / 9)))
        h = max(h, 2.0 * math.exp(-((x - 7) ** 2 / 10 + (y - 27) ** 2 / 6)))
        dx, dy = (x - 16) / 15.8, (y - 16.2) / 15.6
        if dx * dx + dy * dy > 1:
            return (0, None, -1)
        return (h - 0.4, "sand", 0)
    H = field(hf)

    def ripple(x, y):
        # ripples on the windward slope run across the wind, bending with the heap
        return (x * 0.8 + 0.9 * math.sin(y * 0.35)) % 4.5 < 0.8 and x < crest(y) - 1

    def colour(kind, mat, lev, z, x, y):
        if kind == "top":
            k = 4 if lev > 0.88 else 3 if lev > 0.7 else 2 if lev > 0.42 else 1 if lev > 0.1 else 0
            if ripple(x, y) and 2 <= k <= 3:
                k -= 1
            return (P["brass1"], P["brass2"], P["wood5"], P["brass3"], P["bone"])[k]
        fl = diffuse(H, x, y) - 0.25
        return P["wood5"] if fl > 0.5 else P["brass2"] if fl > 0.1 else P["brass1"]

    def ground(x, y, sh):
        return P["wood2"] if sh else None
    img, info = render(H, colour, ground, outline_col=P["wood1"], soft=True, shadow_len=6)
    # two shells: a little spiral and a cockle
    sx, sy = 8, 12
    draw(img, [(sx, sy), (sx + 1, sy), (sx + 2, sy + 1)], P["bone"])
    draw(img, [(sx + 1, sy + 1), (sx, sy + 1)], P["copper3"])
    draw(img, [(sx + 1, sy + 2), (sx + 2, sy + 2), (sx, sy + 2)], P["wood2"])
    cx, cy = 14, 25
    draw(img, [(cx, cy), (cx + 1, cy), (cx + 2, cy)], P["copper3"])
    draw(img, [(cx + 1, cy - 1)], P["bone"])
    draw(img, [(cx, cy + 1), (cx + 2, cy + 1)], P["copper2"])
    draw(img, [(cx + 1, cy + 1)], P["bone"])
    draw(img, [(cx - 1, cy + 1), (cx + 3, cy + 1), (cx, cy + 2), (cx + 1, cy + 2), (cx + 2, cy + 2)], P["wood2"])
    glints = []
    for gx, gy in ((6, 10), (11, 7), (16, 4), (13, 14), (9, 19), (17, 11), (6, 22)):
        p = nearest_top(info, gx, gy, ("top",))
        if p:
            glints.append(p)
    mask = {(x, y) for (x, y), v in info.items() if v[0] != "ground"}
    return img, glints, [], mask


# ---------------------------------------------------------------- scatter round the outcrop
def scatter(kind, mask, deposit):
    """A 64x64 apron with the patch's 32x32 at (16, 16): scatter on deck pixels within 4 px of the
    outcrop's hole (never on the outcrop), thinning out with distance. Returns the deposit with
    its own share merged in, and the 16 spill frames (the middle four empty)."""
    A, O = 64, 16
    dist = {}
    q = deque()
    for (x, y) in mask:
        dist[(x + O, y + O)] = 0
        q.append((x + O, y + O))
    while q:
        p = q.popleft()
        d = dist[p]
        if d >= 6:
            continue
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            n = (p[0] + dx, p[1] + dy)
            if 0 <= n[0] < A and 0 <= n[1] < A and n not in dist:
                dist[n] = d + 1
                q.append(n)
    img = new(A, A)
    r = rng({"iron": 61, "copper": 62, "coal": 63, "sand": 64}[kind])
    dp = deposit.load()

    def free(x, y):
        if not (0 <= x < A and 0 <= y < A):
            return False
        if O <= x < O + S and O <= y < O + S and dp[x - O, y - O][3]:
            return False
        return 1 <= dist.get((x, y), 99) <= 4

    def put(pts, col):
        draw(img, [p for p in pts if free(*p)], col)

    ring = sorted((p for p, d in dist.items() if 1 <= d <= 4), key=lambda p: (p[1] * 64 + p[0]))

    def spots(n, near=3):
        c = [p for p in ring if dist[p] <= near]
        return [c[int(r.random() * len(c))] for _ in range(n)]

    def pebble(x, y, c0, c1, c2=None):
        put([(x - 1, y), (x, y + 1), (x + 1, y + 1), (x + 2, y)], P["ink"])
        put([(x, y), (x + 1, y)], c1)
        if c2:
            put([(x, y)], c2)
        put([(x + 1, y + 1)], c0)

    if kind == "iron":
        for x, y in spots(8, 2):          # rust bleeding into the boards
            put([(x, y), (x + 1, y)], P["wood2"])
            if r.random() < 0.6:
                put([(x + 1, y)], P["copper0"])
        for x, y in spots(4, 3):
            pebble(x, y, P["iron0"], P["iron1"], P["steel3"] if r.random() < 0.5 else None)
    elif kind == "copper":
        for x, y in spots(10, 2):         # verdigris drips
            put([(x, y)], P["water3"])
            if r.random() < 0.5:
                put([(x + 1, y)], P["water2"])
        for x, y in spots(3, 3):
            pebble(x, y, P["water2"], P["water4"])
        for x, y in spots(2, 3):
            pebble(x, y, P["copper1"], P["copper2"], P["copper3"])
    elif kind == "coal":
        for x, y in spots(8, 1):          # cracks running out of the seam along the boards
            a = math.atan2(y - 32, x - 32) + r.uniform(-0.5, 0.5)
            pts, fx, fy = [], x + 0.5, y + 0.5
            for _ in range(r.randint(3, 5)):
                fx, fy = fx + math.cos(a), fy + math.sin(a) * 0.6
                pts.append((int(fx), int(fy)))
            put(pts, P["wood1"])
            put(pts[:1], P["ink1"])
        for x, y in spots(5, 3):          # coal dust
            put([(x, y), (x + 1, y)], P["ink2"])
            put([(x + 1, y + 1)], P["ink1"])
    elif kind == "sand":
        for p in ring:                    # drift blown east, thinning over 4 px
            d = dist[p]
            east = 1.5 if p[0] > 40 else 0.3
            if r.random() < east * (0.55 - d * 0.12):
                put([p], P["wood5"] if r.random() < 0.6 else P["brass2"])
    out = deposit.copy()
    out.alpha_composite(img.crop((O, O, O + S, O + S)))
    frames = []
    for ty in range(4):
        for tx in range(4):
            f = img.crop((tx * 16, ty * 16, tx * 16 + 16, ty * 16 + 16))
            if 1 <= tx <= 2 and 1 <= ty <= 2:
                f = new(16, 16)
            frames.append(f)
    img.paste(new(S, S), (O, O))
    return out, img, frames


# ---------------------------------------------------------------- build and look
KINDS = {"iron": iron, "copper": copper, "coal": coal, "sand": sand}


def quadrants(img):
    return [img.crop((0, 0, 16, 16)), img.crop((16, 0, 32, 16)), img.crop((0, 16, 16, 32)), img.crop((16, 16, 32, 32))]


def mini(img):
    """The whole outcrop at 16x16 (frame 0 of the sheet, for screens that show one tile of the
    ore, like the Survey Office): each 2x2 block takes its most common colour, a lit pixel wins a
    tie and a mixed block keeps its lightest (so highlights survive), an empty block stays empty unless three of four are filled."""
    out = new(16, 16)
    src = img.load()
    for y in range(16):
        for x in range(16):
            px = [src[2 * x + i, 2 * y + j] for j in (0, 1) for i in (0, 1)]
            solid = [p for p in px if p[3]]
            if len(solid) < 3:
                continue
            best = max(set(solid), key=lambda p: (solid.count(p), sum(p[:3])))
            if solid.count(best) < 3:       # a mixed block keeps its lightest pixel: coal's sheen
                best = max(solid, key=lambda p: sum(p[:3]))
            draw(out, [(x, y)], best)
    return out


def deck(w, h):
    out = Image.new("RGBA", (w * 16, h * 16))
    for y in range(h):
        for x in range(w):
            out.alpha_composite(deck_tile((x * 3 + y * 5) % 4), (x * 16, y * 16))
    return out


def unowned(img):
    """ground.ts's treatment of land you don't own, approximated: ink1 at 62% and a hatch."""
    out = img.copy()
    out.alpha_composite(Image.new("RGBA", img.size, rgb(P["ink1"]) + (158,)))
    hp = out.load()
    s = rgb(P["steel1"])
    for y in range(img.height):
        for x in range(img.width):
            if (x - y) % 6 == 0:
                p = hp[x, y]
                hp[x, y] = tuple(int(p[i] * 0.45 + s[i] * 0.55) for i in range(3)) + (255,)
    return out


def build():
    looks = []
    for k, fn in KINDS.items():
        img, glints, embers, mask = fn()
        img, apron, frames = scatter(k, mask, img)
        extra = {"glints": [list(p) for p in glints]}
        if embers:
            extra["embers"] = [list(p) for p in embers]
        export(f"tile_ore_{k}", [mini(img)] + quadrants(img), extra=extra)
        export(f"tile_ore_{k}_spill", frames)
        scene = deck(4, 4)
        scene.alpha_composite(apron)
        scene.alpha_composite(img, (16, 16))
        looks.append((k, img, scene))
    # contact sheet: each ore on the deck with its spill at 1x; then on unowned land; then with a
    # Miner (east facing, frame 0) on its bottom-left tile
    try:
        miner = Image.open(OUT.parent.parents[1] / "src" / "art" / "miner.png").convert("RGBA").crop((0, 0, 16, 16))
    except OSError:
        miner = None
    sheet1 = Image.new("RGBA", (len(looks) * 68 + 4, 3 * 68 + 4), rgb(P["ink"]) + (255,))
    for i, (k, img, scene) in enumerate(looks):
        sheet1.alpha_composite(scene, (4 + i * 68, 4))
        sheet1.alpha_composite(unowned(scene), (4 + i * 68, 72))
        m = scene.copy()
        if miner:
            m.alpha_composite(miner, (16, 32))
        sheet1.alpha_composite(m, (4 + i * 68, 140))
    sheet1.save(OUT / "ores_look.png")
    scale(sheet1, 4).save(OUT / "ores_look@4x.png")
    # each outcrop alone at 8x over its silhouette
    big = Image.new("RGBA", (len(looks) * 34 + 2, 68), rgb(P["wood3"]) + (255,))
    for i, (k, img, scene) in enumerate(looks):
        big.alpha_composite(img, (2 + i * 34, 2))
        sil = Image.new("RGBA", (32, 32))
        sil.paste((19, 14, 28, 255), (0, 0, 32, 32), img)
        big.alpha_composite(sil, (2 + i * 34, 35))
    scale(big, 8).save(OUT / "ores_alone@8x.png")


if __name__ == "__main__":
    build()
