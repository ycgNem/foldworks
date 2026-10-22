"""The four island looks (docs/endgame.md, Milestone 9: Pebble Isle, Cinder Isle, Rime, the Old
Works): variant sheets of the Workshop island's ground, rim, cliff, underside, falls and props,
named by isletools.vname (`isle_<world>_<Home sheet minus a leading isle_>`), each with exactly
its Home sheet's frames, order, anchor, fps and names, so src/render/island.ts and ground.ts can
swap a whole sheet set per island and fall back to Home's for any sheet an island does not ship.

Every variant starts from Home's own frames (src/art, built by pixel-art/sky/) and is redrawn by
rules plus hand-drawn pieces, so each island keeps the Home island's geometry (the edge tiles'
silhouettes, the cliff's strata rows, the underside's taper) and changes its materials:

- **Pebble Isle** (`pebble`, half the land): a windswept, pebbly isle. Meadow strewn with pebbles,
  a shingle beach round the rim, a pale conglomerate cliff (pebbles set in its strata), skyglass
  crystals in the cliff and the underside, birches and stone cairns. Its owned paving is Home's.
- **Cinder Isle** (`cinder`): ash ground (warm dark earth flecked with pale ash, a few dim
  cracks), a lava rim glowing round the coast and dribbling over the lip, a basalt cliff and
  underside cut by magma cracks, lava falls instead of water, charred trees, basalt columns and
  iron railings. Owned paving is Home's with soot flecks.
- **Rime** (`rime`): snow for the meadow and the rim, an ice rim, icicles under the lip, a
  frozen blue-grey cliff with snow on its ledges, ice crystals underneath, pale icy falls, snowy
  pines, a snow frog. Owned paving keeps its colour with rime in the grout.
- **The Old Works** (`oldworks`): broken, overgrown paving (cracks, chips, weeds), a crumbling
  kerb of old stone round the rim, brick courses and rusted pipes in the cliff, vines over the
  lip, gears and pipes in the underside, broken pillars, a chimney stack, a half-buried gear.

Readability (DESIGN.md §17) on every island: owned land stays the calm paving and land for sale
differs from it in hue and lightness (ash much darker, snow much lighter, meadow as Home);
nothing on the ground uses lamp3 or a star shape (a Spark's language); the plot's dashed line is
redrawn dark on snow, where Home's bone dashes would vanish.
"""
import math

from c4 import INK, INK1, INK2, P, get, new, outline, put, rect, ship, hline, vline
from isletools import (HOME_SHEETS, frames_strip, h01, home, nm, ore_seats, remap, sky_dist, snow_cap, unstrip,
                       vname)

# ---------------------------------------------------------------- ramps
ASH = {"grass0": "ink2", "grass1": "earth0", "grass2": "earth1", "grass3": "pave0"}
OLD = {"grass0": "moss1", "grass1": "moss2", "grass2": "moss4", "grass3": "moss5"}
SNOW = {"grass0": "cloud0", "grass1": "cloud1", "grass2": "cloud2", "grass3": "cloud3"}
BASALT = {"earth0": "ink1", "earth1": "ink2", "earth2": "steel0", "earth3": "steel1", "wood0": "ink",
          "wood1": "ink1", "wood2": "earth0", "wood3": "earth1", "wood4": "earth2", "ink2": "ink1"}
COLDROCK = {"earth0": "steel0", "earth1": "steel1", "earth2": "steel2", "earth3": "cloud0", "wood0": "ink1",
            "wood1": "steel0", "wood2": "steel1", "wood3": "steel2", "wood4": "cloud1"}
PALESTONE = {"wood4": "pave3", "wood3": "pave2", "wood2": "pave1", "wood1": "pave0", "wood0": "earth1",
             "earth3": "pave1", "earth2": "pave0", "earth1": "earth2", "earth0": "earth1"}
FOLIAGE = {"grass0", "grass1", "grass2", "grass3", "moss1", "moss2", "moss3", "moss4", "bone", "copper3", "copper2",
           "copper1", "red"}


def P_(n):
    return P[n]


def dot(img, x, y, n):
    put(img, x, y, P[n])


def ok(img, x, y):
    return 0 <= x < img.width and 0 <= y < img.height and get(img, x, y)[3]


# ---------------------------------------------------------------- shared drawings
def pebble(img, x, y, size, lit="pave3", mid="pave2", dark="pave0", shadow=None):
    """A little rounded pebble, lit top-left, its shadow down-right (only on opaque ground)."""
    pts = [(0, 0), (1, 0)] if size == 1 else [(0, 0), (1, 0), (2, 0), (0, 1), (1, 1), (2, 1)] if size == 2 else \
        [(1, 0), (2, 0), (0, 1), (1, 1), (2, 1), (3, 1), (1, 2), (2, 2)]
    w = max(p[0] for p in pts)
    hgt = max(p[1] for p in pts)
    if shadow:
        for px, py in pts:
            if ok(img, x + px + 1, y + py + 1):
                dot(img, x + px + 1, y + py + 1, shadow)
    for px, py in pts:
        if ok(img, x + px, y + py):
            c = lit if (px + py) <= (1 if size > 1 else 0) else dark if (px == w or py == hgt) and size > 1 else mid
            dot(img, x + px, y + py, c)


def crack(img, x, y, n, seed, cols=("lamp0",), core=None, dy=0.35):
    """A wandering crack from (x, y), n steps east-ish."""
    fx, fy = x + 0.5, y + 0.5
    a = (h01(seed, 1) - 0.5) * 1.2
    for i in range(n):
        ix, iy = int(fx), int(fy)
        if ok(img, ix, iy):
            dot(img, ix, iy, core if core and 1 <= i < n - 1 and i % 3 == 1 else cols[i % len(cols)])
        a += (h01(seed, i, 2) - 0.5) * 1.1
        fx += math.cos(a)
        fy += math.sin(a) * dy * 2
    return img


def overhang_bottom(img, x):
    """The last row of the lip's grass (or whatever replaced it) in a cliff-top frame column."""
    last = -1
    for y in range(img.height):
        if nm(img, x, y) in ("grass0", "grass1", "grass2", "grass3"):
            last = y
    return last


# ================================================================ PEBBLE ISLE
def pebble_isle():
    out = {}
    # meadow: Home's grass with pebbles strewn on it (1-3 a tile, never at a tile's edge)
    g, _ = home("tile_grass")
    gr = []
    for v, f in enumerate(g):
        f = f.copy()
        for k in range(1 + v % 3):
            x, y = 2 + int(h01(v, k, 11) * 10), 2 + int(h01(v, k, 12) * 10)
            pebble(f, x, y, 1 + (k + v) % 2, shadow="grass1")
        gr.append(f)
    out["tile_grass"] = gr
    out["tile_grass_deco"] = pebble_deco()
    # paving edge: grass in the grout, with a pebble or two
    pe, _ = home("tile_pave_edge")
    out["tile_pave_edge"] = []
    for i, f in enumerate(pe):
        f = f.copy()
        x, y = [(6, 1), (13, 7), (9, 13), (1, 5)][i]
        pebble(f, x, y, 1, shadow=None)
        out["tile_pave_edge"].append(f)
    # the rim: a shingle beach along the coast (pebbles 1-3 px in from the sky)
    e, _ = home("isle_edge")
    edges = []
    for m, f in enumerate(e):
        f = f.copy()
        d = sky_dist(f, m)
        for (x, y), k in d.items():
            if not (0 <= x < 16 and 0 <= y < 16):
                continue
            if k == 1:
                dot(f, x, y, "earth3")
            elif k <= 3:
                # pebbles in 2x2 cells, four tones, the lit one top-left of each cell
                cx, cy = (x + 7 * m) // 2, (y + 3 * m) // 2
                t = h01(cx, cy, 31)
                base = "pave1" if t < 0.35 else "pave2" if t < 0.7 else "steel3" if t < 0.85 else "earth3"
                lit = (x + 7 * m) % 2 == 0 and (y + 3 * m) % 2 == 0
                dot(f, x, y, "pave3" if lit and base != "earth3" else base)
            elif k == 4 and h01(x, y, m, 32) < 0.35:
                dot(f, x, y, "pave1")
        edges.append(f)
    out["isle_edge"] = edges
    # the cliff: pale conglomerate, rounded pebbles set in its strata
    c, meta = home("isle_cliff")
    cl = [remap(f, PALESTONE) for f in c]
    for row in range(3):
        strip = frames_strip(cl[row * 4:row * 4 + 4])
        for k in range(14 if row else 8):
            x = int(h01(row, k, 41) * 62)
            y = (7 if row == 0 else 1) + int(h01(row, k, 42) * (8 if row == 0 else 13))
            if nm(strip, x, y) in ("pave0", "pave1", "pave2", "earth2", "earth1"):
                pebble(strip, x, y, 2 if k % 3 else 1, lit="bone", mid="pave3", dark="pave1", shadow="earth1")
        # skyglass glinting in the strata, two or three a strip on the mid rows
        if row == 1:
            skyglass_bit(strip, 37, 6, 1)
        cl[row * 4:row * 4 + 4] = unstrip(strip, 4)
    out["isle_cliff"] = cl
    out["isle_vein"] = veins(lambda f, v: skyglass_vein(f, v), "skyglass")
    # the underside: the same rock a step paler, skyglass crystals in place of the teal ones
    u, _ = home("isle_under")
    out["isle_under"] = [remap(f, {"earth1": "earth2", "earth0": "earth1", "earth2": "earth3", "teal": "sky3",
                                   "moss3": "sky2"}) for f in u]
    ud, _ = home("isle_under_deco")
    out["isle_under_deco"] = [remap(f, {"teal": "sky3", "water3": "sky1", "sky4": "cloud3", "earth2": "earth3",
                                        "steel2": "sky2"}) for f in ud]
    t, _ = home("isle_tip")
    tip = remap(t[0], {"earth1": "earth2", "earth0": "earth1", "earth2": "earth3", "teal": "sky3"})
    skyglass_bit(tip, 30, 9, 0)
    skyglass_bit(tip, 17, 6, 1)
    out["isle_tip"] = [tip]
    # props: a pine as Home's, a birch, a cairn, a windswept oak (Home's oak, its crown combed east)
    tr, _ = home("prop_tree")
    out["prop_tree"] = [windswept(tr[0]), tr[1], birch(tr[0]), cairn()]
    bu, _ = home("prop_bush")
    out["prop_bush"] = [pebble_pile(), bu[1], skyglass_cluster(), bu[2]]
    return out


def skyglass_bit(img, x, y, k):
    """A small skyglass crystal set in rock: two prisms, pale, a sky shade, an ink outline."""
    pts = [(1, 0), (1, 1), (1, 2), (0, 2), (2, 1), (2, 2), (0, 3), (1, 3), (2, 3)] if k % 2 == 0 else \
        [(0, 1), (0, 2), (1, 0), (1, 1), (1, 2), (2, 2), (0, 3), (1, 3), (2, 3), (3, 3)]
    sh = new(8, 8)
    for px, py in pts:
        put(sh, px + 1, py + 1, P["sky3"] if px == 0 or py == 0 else P["sky1"] if py == 3 else P["cloud3"] if px == 1 else P["sky2"])
    sh = outline(sh, P["ink"])
    img.alpha_composite(sh, (x - 1, y - 1)) if 0 <= x - 1 and x + 7 <= img.width + 8 else None


def veins(draw_exotic, ex):
    """Home's sixteen vein frames, then four of the island's exotic."""
    v, _ = home("isle_vein")
    out = [f.copy() for f in v]
    for k in range(4):
        f = new(16, 16)
        draw_exotic(f, k)
        out.append(f)
    return out


def skyglass_vein(f, k):
    """A cluster of skyglass prisms breaking out of the rock, like Home's ore nuggets."""
    sh = new(16, 16)
    x0, y0 = [(2, 3), (4, 2), (1, 5), (3, 4)][k]
    prisms = [(0, 4, 2, 5), (3, 1, 2, 8), (6, 3, 2, 6), (8, 6, 2, 3)][: 3 + k % 2]
    for i, (px, py, w, h) in enumerate(prisms):
        for yy in range(h):
            for xx in range(w):
                c = "cloud3" if xx == 0 and yy < h - 1 else "sky2" if yy == h - 1 else "sky3"
                put(sh, x0 + px + xx, y0 + py + yy, P[c])
        put(sh, x0 + px, y0 + py - 1, P["cloud3"])   # a point
    sh = outline(sh, P["ink"])
    f.alpha_composite(sh)


def pebble_deco():
    frames = []
    for k in range(8):
        f = new(16, 16)
        if k in (0, 1, 2):            # a scatter of pebbles
            base = new(16, 16)
            for j in range(2 + k):
                x, y = 3 + int(h01(k, j, 51) * 9), 3 + int(h01(k, j, 52) * 9)
                for (px, py, c) in ((0, 0, "pave3"), (1, 0, "pave2"), (0, 1, "pave1"), (1, 1, "pave0")):
                    put(base, x + px, y + py, P[c])
                put(base, x + 2, y + 1, P["grass1"])
            frames.append(base)
            continue
        if k == 3:                    # a skyglass shard glinting in the grass
            skyglass_bit(f, 6, 6, 0)
            put(f, 10, 10, P["grass1"])
        elif k == 4:                  # a little cairn of three stones
            for (x, y, w) in ((6, 10, 4), (7, 8, 3), (7, 6, 2)):
                for i in range(w):
                    put(f, x + i, y, P["pave3"] if i == 0 else P["pave2"])
                    put(f, x + i, y + 1, P["pave1"] if i < w - 1 else P["pave0"])
            f = outline(f, P["ink1"])
            hline(f, 6, 11, 12, P["grass1"])
        elif k == 5:                  # a gull's feather
            for i in range(5):
                put(f, 5 + i, 9 - i // 2, P["bone"])
            put(f, 4, 10, P["steel2"])
            put(f, 9, 7, P["steel3"])
        elif k == 6:                  # daisies
            for (x, y) in ((5, 6), (10, 9)):
                for dx, dy in ((0, -1), (-1, 0), (1, 0), (0, 1)):
                    put(f, x + dx, y + dy, P["bone"])
                put(f, x, y, P["lamp2"])
                put(f, x, y + 2, P["grass0"])
        else:                         # a flat sea-smoothed stone
            for i in range(5):
                put(f, 5 + i, 8, P["pave3"] if i < 2 else P["pave2"])
                put(f, 5 + i, 9, P["pave1"])
            put(f, 6, 7, P["pave2"])
            put(f, 7, 7, P["pave3"])
            hline(f, 6, 10, 10, P["grass1"])
        frames.append(f)
    return frames


def windswept(oak):
    """Home's oak with its crown combed east by the wind: each crown row shifted right by how
    high it is, the trunk leaning a pixel."""
    out = new(32, 32)
    for y in range(32):
        shift = 0 if y >= 22 else (3 if y < 8 else 2 if y < 14 else 1)
        for x in range(32):
            p = oak.getpixel((x, y))
            if p[3] and 0 <= x + shift < 32:
                out.putpixel((x + shift, y), p)
    return out


def birch(oak):
    """A birch: the oak's shape, a white trunk with ink scars, a lighter, sparser crown."""
    b = remap(oak, {"wood1": "bone", "wood2": "steel4", "wood3": "bone", "grass0": "grass1", "grass1": "grass2",
                    "grass2": "grass3"})
    # ink scars on the trunk
    for y in range(18, 29):
        for x in range(12, 21):
            if nm(b, x, y) in ("bone", "steel4") and (x * 3 + y * 5) % 7 == 0:
                put(b, x, y, P["ink1"])
    # the shadow under it stays on the meadow's dark green
    return b


def cairn():
    """A stone cairn: rounded stones stacked in a tapering pile, a skyglass shard on top."""
    img = new(32, 32)
    stones = [(9, 23, 7, 5), (16, 23, 7, 5), (11, 18, 6, 5), (17, 19, 5, 4), (13, 14, 6, 4), (14, 10, 4, 4)]
    for (x, y, w, h) in stones:
        for yy in range(h):
            for xx in range(w):
                dx, dy = (xx + 0.5 - w / 2) / (w / 2), (yy + 0.5 - h / 2) / (h / 2)
                if dx * dx + dy * dy > 1.15:
                    continue
                lam = -dx * 0.6 - dy * 0.8
                put(img, x + xx, y + yy, P["bone"] if lam > 0.55 else P["pave3"] if lam > 0.1 else P["pave2"] if lam > -0.45 else P["pave1"])
    img = outline(img, P["ink1"])
    skyglass_bit(img, 15, 6, 1)
    # a shadow on the meadow, down-right
    sh = new(32, 32)
    for x in range(8, 27):
        for y in (28, 29):
            if not img.getpixel((x, y))[3]:
                put(sh, x, y, P["grass1"])
    sh.alpha_composite(img)
    return sh


def pebble_pile():
    img = new(16, 16)
    for (x, y, s) in ((3, 9, 2), (7, 10, 3), (10, 8, 2), (5, 7, 2), (8, 6, 2)):
        pebble(img, x, y, s, lit="bone", mid="pave3", dark="pave1")
    img = outline(img, P["ink1"])
    for x in range(4, 14):
        if not img.getpixel((x, 14))[3]:
            put(img, x, 14, P["grass1"])
    return img


def skyglass_cluster():
    img = new(16, 16)
    sh = new(16, 16)
    for i, (x, y, h) in enumerate(((4, 6, 7), (7, 3, 10), (10, 7, 6))):
        for yy in range(h):
            put(sh, x, y + yy, P["cloud3"] if yy < h - 2 else P["sky3"])
            put(sh, x + 1, y + yy, P["sky3"] if yy < h - 1 else P["sky1"])
            if i == 1:
                put(sh, x + 2, y + yy + 1, P["sky2"])
    sh = outline(sh, P["ink"])
    for x in range(3, 14):
        put(img, x, 14, P["grass1"])
    img.alpha_composite(sh)
    return img


# ================================================================ CINDER ISLE
def cinder_isle():
    out = {}
    # owned paving: Home's with a few soot flecks
    pv, _ = home("tile_pave")
    out["tile_pave"] = []
    for v, f in enumerate(pv):
        f = f.copy()
        for k in range(3):
            x, y = 2 + int(h01(v, k, 61) * 12), 2 + int(h01(v, k, 62) * 12)
            if nm(f, x, y) == "pave2":
                dot(f, x, y, "pave1")
                if k == 0 and nm(f, x + 1, y) == "pave2":
                    dot(f, x + 1, y, "earth3")
        out["tile_pave"].append(f)
    pe, _ = home("tile_pave_edge")
    out["tile_pave_edge"] = [remap(f, ASH) for f in pe]
    # the ash field: Home's meadow in ash; a dim crack in two of four
    g, _ = home("tile_grass")
    gr = []
    for v, f in enumerate(g):
        f = remap(f, ASH)
        if v in (1, 3):
            crack(f, 2 + v, 5 + v * 2, 7, 700 + v, cols=("ink2", "lamp0", "lamp0", "copper0"))
        gr.append(f)
    out["tile_grass"] = gr
    out["tile_grass_deco"] = cinder_deco()
    pl, _ = home("tile_plot")
    out["tile_plot"] = [remap(f, {"grass1": "ink2"}) for f in pl]
    # the rim: ash, and a lava band glowing round the coast with crust floating on it
    e, _ = home("isle_edge")
    edges = []
    LAVA = {1: "copper0", 2: "lamp0", 3: "lamp1", 4: "lamp2", 5: "lamp1", 6: "lamp0", 7: "copper0"}
    for m, f in enumerate(e):
        f = remap(f, ASH)
        d = sky_dist(f, m)
        for (x, y), k in d.items():
            if not (0 <= x < 16 and 0 <= y < 16) or k not in LAVA:
                continue
            c = LAVA[k]
            crust = h01((x + 5 * m) // 3, (y + 3 * m) // 2, 71)
            if 2 <= k <= 5 and crust > 0.78:
                c = "ink2" if crust > 0.9 else "earth0"
            elif k == 4 and crust < 0.12:
                c = "lamp3"
            dot(f, x, y, c)
        edges.append(f)
    out["isle_edge"] = edges
    # the cliff: basalt, the overhang ash; lava dribbles under the lip, magma cracks in the face
    c, _ = home("isle_cliff")
    cl = [remap(remap(f, ASH), BASALT) for f in c]
    top = frames_strip(cl[0:4])
    for x in range(64):
        if h01(x // 2, 0, 81) < 0.32:
            continue
        y0 = overhang_bottom(top, x)
        if y0 < 0:
            continue
        # the lava rim's edge shows on the overhang's front
        dot(top, x, y0, "lamp1" if h01(x, 82) < 0.5 else "lamp0")
        if h01(x, 0, 83) < 0.3:
            n = 2 + int(h01(x, 84) * 6)
            for i in range(1, n + 1):
                dot(top, x, y0 + i, "lamp2" if i < n - 1 else "lamp1" if i < n else "lamp0")
    cl[0:4] = unstrip(top, 4)
    mid = frames_strip(cl[4:8])
    for k, (x, y) in enumerate(((3, 4), (21, 10), (40, 3), (52, 11))):
        crack(mid, x, y, 9 + k % 3, 900 + k, cols=("lamp0", "lamp1", "lamp1", "lamp0"), core="lamp2")
    cl[4:8] = unstrip(mid, 4)
    low = frames_strip(cl[8:12])
    for k, (x, y) in enumerate(((10, 3), (44, 6))):
        crack(low, x, y, 7, 950 + k, cols=("copper0", "lamp0", "lamp1", "lamp0"))
    cl[8:12] = unstrip(low, 4)
    out["isle_cliff"] = cl
    out["isle_vein"] = veins(cinderite_vein, "cinderite")
    u, _ = home("isle_under")
    und = []
    for i, f in enumerate(u):
        f = remap(f, {**BASALT, "steel2": "copper0", "steel1": "earth0", "moss3": "earth0", "teal": "lamp1",
                      "sky4": "lamp2", "wood1": "ink1"})
        if i == 0:
            crack(f, 2 + i, 4 + i, 8, 960 + i, cols=("lamp0", "lamp1", "lamp0"), core="lamp2")
        und.append(f)
    out["isle_under"] = und
    ud, _ = home("isle_under_deco")
    out["isle_under_deco"] = [remap(f, {"teal": "lamp1", "water3": "lamp0", "sky4": "lamp3", "sky3": "lamp2",
                                        "sky2": "lamp1", "moss3": "earth1", "moss2": "earth0", "moss4": "earth2",
                                        "wood1": "ink2", "wood0": "ink1", "earth2": "steel0", "steel2": "steel1",
                                        "copper0": "ink2", "copper1": "earth1", "earth3": "earth1", "steel4": "steel2"})
                              for f in ud]
    t, _ = home("isle_tip")
    tip = remap(t[0], {**BASALT, "teal": "lamp1", "sky4": "lamp2", "moss3": "earth0"})
    crack(tip, 14, 6, 12, 990, cols=("lamp0", "lamp1", "lamp1"), core="lamp2")
    out["isle_tip"] = [tip]
    # lava falls: the water's frames in the lantern ramp; steam where it meets the cloud sea
    LAVAFALL = {"sky2": "lamp1", "sky3": "lamp2", "iron1": "copper1", "sky1": "lamp0", "cloud3": "lamp3",
                "cloud2": "lamp2", "sky4": "lamp3"}
    for nmn in ("isle_fall", "isle_fall_head"):
        fr, _ = home(nmn)
        out[nmn] = [remap(f, LAVAFALL) for f in fr]
    ft, _ = home("isle_fall_top")
    out["isle_fall_top"] = [remap(remap(f, ASH), {**LAVAFALL, "steel3": "earth1", "steel1": "ink2", "steel4": "earth2",
                                                  "moss4": "earth1"}) for f in ft]
    fo, _ = home("isle_fall_foam")
    foam = []
    for i, f in enumerate(fo):
        f = remap(f, {"cloud3": "cloud2", "sky3": "steel3"})
        for k in range(3):
            x, y = 4 + int(h01(i, k, 97) * 24), 2 + int(h01(i, k, 98) * 6)
            if ok(f, x, y):
                dot(f, x, y, "lamp1" if k else "lamp2")
        foam.append(f)
    out["isle_fall_foam"] = foam
    # props: two charred trees, basalt columns, an obsidian spire; bushes: embers, an ash
    # boulder, a pumice heap, a charred stump; iron railings
    out["prop_tree"] = [dead_tree(0), dead_tree(1), basalt_columns(), obsidian()]
    bu, _ = home("prop_bush")
    out["prop_bush"] = [ember_bush(), remap(bu[1], {"steel4": "pave0", "steel3": "earth2", "steel2": "earth1",
                                                     "steel1": "ink2", **{k: v for k, v in ASH.items()}}),
                        pumice(), remap(bu[3], {"wood5": "earth2", "wood4": "earth1", "wood3": "ink2", "wood2": "ink1",
                                                "wood1": "ink1", **ASH, "earth1": "lamp0"})]
    fe, _ = home("prop_fence")
    out["prop_fence"] = [remap(f, {"wood2": "steel0", "wood3": "steel1", "wood4": "steel2", "wood5": "steel3",
                                   "grass1": "earth0", "brass3": "lamp1", "brass2": "lamp0"}) for f in fe]
    ore_seats(out, ASH)
    return out


def cinderite_vein(f, k):
    sh = new(16, 16)
    x0, y0 = [(3, 4), (5, 3), (2, 5), (4, 4)][k]
    for (cx, cy, r) in [((3, 3, 3.2), (8, 5, 2.4)), ((4, 4, 3.6), (9, 2, 2.0)), ((3, 3, 2.8), (7, 6, 2.6)),
                        ((5, 4, 3.4), (1, 6, 1.8))][k]:
        for y in range(16):
            for x in range(16):
                dx, dy = x + 0.5 - (x0 + cx), y + 0.5 - (y0 + cy)
                if dx * dx + dy * dy <= r * r:
                    lam = (-dx - dy) / r
                    put(sh, x, y, P["steel1"] if lam > 0.9 else P["ink2"])
    crack(sh, x0 + 1, y0 + 3, 8, 1000 + k, cols=("lamp1", "lamp2", "lamp1"))
    sh = outline(sh, P["ink"])
    f.alpha_composite(sh)


def cinder_deco():
    frames = []
    for k in range(8):
        f = new(16, 16)
        if k == 0:                    # pale ash flecks
            for j in range(6):
                dot(f, 3 + int(h01(k, j, 1) * 10), 3 + int(h01(k, j, 2) * 10), "pave0" if j % 2 else "earth2")
        elif k == 1:                  # a dim crack, embers in it
            crack(f, 3, 7, 10, 1101, cols=("ink2", "lamp0", "copper0", "lamp0"))
        elif k == 2:                  # an obsidian shard
            for (x, y, c) in ((7, 6, "steel2"), (7, 7, "ink2"), (8, 7, "steel1"), (6, 8, "ink2"), (7, 8, "ink1"),
                              (8, 8, "ink2"), (9, 8, "ink1"), (8, 5, "steel3")):
                dot(f, x, y, c)
            f = outline(f, P["ink"])
        elif k == 3:                  # a charred tuft
            for (x, y) in ((6, 9), (7, 8), (8, 9), (9, 7), (10, 9), (7, 10), (9, 10)):
                dot(f, x, y, "ink2" if y < 10 else "earth0")
            dot(f, 9, 6, "lamp0")
        elif k == 4:                  # a fire lily: it likes it hot
            for (x, y, c) in ((7, 5, "red"), (8, 5, "lamp1"), (6, 6, "red"), (9, 6, "red"), (7, 6, "lamp1"),
                              (8, 6, "lamp2"), (7, 7, "red"), (8, 7, "copper1"), (8, 8, "moss3"), (8, 9, "moss2"),
                              (9, 9, "moss3"), (8, 10, "moss2")):
                dot(f, x, y, c)
        elif k == 5:                  # cinders, a scatter of dark lumps
            for j in range(4):
                x, y = 3 + int(h01(k, j, 3) * 9), 3 + int(h01(k, j, 4) * 9)
                dot(f, x, y, "steel0")
                dot(f, x + 1, y, "ink2")
                dot(f, x, y + 1, "ink1")
        elif k == 6:                  # a heat-cracked rock
            for y in range(6, 11):
                for x in range(5, 11):
                    if (x - 7.5) ** 2 / 9 + (y - 8.5) ** 2 / 5 <= 1:
                        dot(f, x, y, "earth2" if x + y < 13 else "earth1")
            dot(f, 7, 7, "ink2")
            dot(f, 8, 8, "ink2")
            dot(f, 8, 9, "lamp0")
            f = outline(f, P["ink1"])
        else:                         # a little scorch ring
            for a in range(12):
                x = round(8 + 3.5 * math.cos(a / 12 * 6.283))
                y = round(8 + 2.2 * math.sin(a / 12 * 6.283))
                dot(f, x, y, "ink2" if a % 3 else "earth0")
        frames.append(f)
    return frames


def dead_tree(v):
    """A charred dead tree: a black trunk forking into bare branches, a lit edge on the left of
    each limb, an ember or two at a broken tip. Anchor (16, 29) is the trunk's foot."""
    img = new(32, 32)

    def limb(x, y, a, n, w, depth):
        fx, fy = x, y
        for i in range(n):
            for k in range(w):
                ix, iy = int(round(fx + k * math.cos(a + math.pi / 2))), int(round(fy + k * math.sin(a + math.pi / 2)))
                if 0 <= ix < 32 and 0 <= iy < 32:
                    put(img, ix, iy, P["earth1"] if k == 0 and w > 1 else P["ink2"])
            fx += math.cos(a)
            fy += math.sin(a)
        if depth > 0:
            spread = 0.55 + 0.1 * v
            limb(fx, fy, a - spread, int(n * 0.65), max(1, w - 1), depth - 1)
            limb(fx, fy, a + spread * (0.8 if v else 1.1), int(n * 0.6), max(1, w - 1), depth - 1)
        elif h01(int(fx), int(fy), v) < 0.5 and 0 <= int(fx) < 32 and 0 <= int(fy) < 32:
            put(img, int(fx), int(fy), P["lamp0"])
    limb(15, 29, -math.pi / 2 + (0.08 if v else -0.05), 9 if v == 0 else 11, 3, 3 if v == 0 else 2)
    img = outline(img, P["ink"])
    sh = new(32, 32)
    for x in range(10, 25):
        for y in (29, 30):
            if not img.getpixel((x, y))[3] and abs(x - 17) < 7 - (y - 29) * 2:
                put(sh, x, y, P["ink2"])
    sh.alpha_composite(img)
    return sh


def basalt_columns():
    """A clump of hexagonal basalt columns of three heights: flat lit tops, dark faces."""
    img = new(32, 32)
    for (x, w, h) in ((9, 4, 9), (13, 5, 14), (18, 4, 11), (22, 4, 6)):
        top = 29 - h
        for yy in range(top, 30):
            for xx in range(x, x + w):
                face = yy > top + 1
                c = ("steel1" if xx == x else "steel0" if xx < x + w - 1 else "ink2") if face else ("steel2" if xx < x + w - 1 else "steel1")
                put(img, xx, yy, P[c])
        hline(img, x, x + w - 1, top, P["steel3"])
        if h > 8:
            put(img, x + 1, top + 5, P["ink1"])
    img = outline(img, P["ink"])
    return img


def obsidian():
    """A jagged obsidian spire: black glass with a cool sheen down its lit edge, a glow at its foot."""
    img = new(32, 32)
    for y in range(8, 30):
        t = (y - 8) / 22
        half = 1 + t * 5
        cx = 16 + (1 - t) * 1.5
        for x in range(32):
            dx = x + 0.5 - cx
            if abs(dx) <= half:
                c = "steel2" if dx < -half + 1.2 else "ink2" if dx < 0 else "ink1"
                if dx < -half + 1.2 and y % 5 == 0:
                    c = "steel3"
                put(img, x, y, P[c])
    img = outline(img, P["ink"])
    for x in (12, 20):
        put(img, x, 29, P["lamp0"])
    return img


def ember_bush():
    img = new(16, 16)
    for y in range(6, 14):
        for x in range(2, 14):
            if (x - 7.5) ** 2 / 30 + (y - 10) ** 2 / 12 <= 1:
                put(img, x, y, P["ink2"] if (x + y) % 3 else P["earth0"])
    for (x, y) in ((5, 9), (9, 8), (7, 11), (11, 11)):
        put(img, x, y, P["lamp1"] if (x + y) % 2 else P["lamp0"])
    img = outline(img, P["ink"])
    return img


def pumice():
    img = new(16, 16)
    for (x, y, s) in ((3, 9, 2), (7, 10, 3), (10, 8, 2), (6, 7, 2)):
        pebble(img, x, y, s, lit="pave1", mid="pave0", dark="earth2")
    for (x, y) in ((8, 11), (4, 10), (11, 9)):
        if ok(img, x, y):
            dot(img, x, y, "earth1")
    return outline(img, P["ink1"])


# ================================================================ RIME
def rime_isle():
    out = {}
    pv, _ = home("tile_pave")
    out["tile_pave"] = []
    for v, f in enumerate(pv):
        f = f.copy()
        # rime in the grout: Home's grid dots and crosses frosted here and there
        for y in range(16):
            for x in range(16):
                if nm(f, x, y) == "pave1" and h01(x, y, v, 120) < 0.22:
                    dot(f, x, y, "cloud1")
                elif nm(f, x, y) == "pave0" and h01(x, y, v, 121) < 0.5:
                    dot(f, x, y, "cloud0")
        out["tile_pave"].append(f)
    pe, _ = home("tile_pave_edge")
    out["tile_pave_edge"] = [remap(f, SNOW) for f in pe]
    g, _ = home("tile_grass")
    out["tile_grass"] = [remap(f, SNOW) for f in g]
    out["tile_grass_deco"] = rime_deco()
    # the plot's dashed line in dark rope on snow (bone vanishes there), its shadow cloud0
    pl, _ = home("tile_plot")
    out["tile_plot"] = [remap(f, {"bone": "steel1", "grass1": "cloud0"}) for f in pl]
    # the rim: snow, an ice band along the coast
    e, _ = home("isle_edge")
    edges = []
    ICE = {1: "sky1", 2: "sky2", 3: "sky3"}
    for m, f in enumerate(e):
        f = remap(f, SNOW)
        d = sky_dist(f, m)
        for (x, y), k in d.items():
            if 0 <= x < 16 and 0 <= y < 16 and k in ICE:
                c = ICE[k]
                if k == 3 and h01(x + 3 * m, y, 131) < 0.2:
                    c = "cloud3"
                elif k == 2 and h01(x, y + 5 * m, 132) < 0.15:
                    c = "sky4"
                dot(f, x, y, c)
        edges.append(f)
    out["isle_edge"] = edges
    # the cliff: frozen rock, snow on the lit ledges, icicles hanging under the lip
    c, _ = home("isle_cliff")
    cl = [remap(remap(f, SNOW), COLDROCK) for f in c]
    top = frames_strip(cl[0:4])
    for x in range(64):
        y0 = overhang_bottom(top, x)
        if y0 < 0:
            continue
        dot(top, x, y0, "sky3")
        if h01(x, 141) < 0.45:
            n = 1 + int(h01(x, 142) * 5)
            for i in range(1, n + 1):
                dot(top, x, y0 + i, "cloud3" if i == 1 else "sky4" if i < n else "sky3")
    cl[0:4] = unstrip(top, 4)
    for row in (1, 2):
        s = frames_strip(cl[row * 4:row * 4 + 4])
        sn = s.copy()
        for x in range(64):
            for y in range(1, 16):
                # snow on ledges: a lit stone pixel under a dark groove
                if nm(s, x, y) in ("cloud1", "cloud0", "steel3") and nm(s, x, y - 1) in ("ink2", "ink1", "steel0"):
                    dot(sn, x, y, "cloud2" if h01(x, y, 143) < 0.7 else "cloud3")
        cl[row * 4:row * 4 + 4] = unstrip(sn, 4)
    out["isle_cliff"] = cl
    out["isle_vein"] = veins(rime_vein, "rime")
    COLDUNDER = {"earth1": "steel1", "earth0": "steel0", "earth2": "steel2", "steel2": "sky2", "steel1": "sky1",
                 "moss3": "sky3", "wood1": "steel1", "teal": "sky4"}
    u, _ = home("isle_under")
    out["isle_under"] = [remap(f, COLDUNDER) for f in u]
    ud, _ = home("isle_under_deco")
    out["isle_under_deco"] = [remap(f, {"teal": "cloud3", "water3": "sky3", "sky4": "cloud3", "wood1": "sky3",
                                        "wood0": "sky2", "moss3": "cloud2", "moss2": "sky3", "moss4": "cloud2",
                                        "earth2": "steel2", "copper0": "steel1", "copper1": "steel2",
                                        "earth3": "steel3"}) for f in ud]
    t, _ = home("isle_tip")
    tip = remap(t[0], {**COLDUNDER, "teal": "cloud3"})
    out["isle_tip"] = [tip]
    ICY = {"sky2": "sky3", "sky1": "sky2", "sky3": "cloud1", "iron1": "sky1", "sky4": "cloud2"}
    for nmn in ("isle_fall", "isle_fall_head"):
        fr, _ = home(nmn)
        out[nmn] = [remap(f, ICY) for f in fr]
    ft, _ = home("isle_fall_top")
    out["isle_fall_top"] = [remap(remap(f, SNOW), {**ICY, "steel3": "cloud0", "steel1": "steel2", "moss4": "cloud1"})
                            for f in ft]
    tr, _ = home("prop_tree")
    out["prop_tree"] = [snowy(tr[1], heavy=True), snowy(tr[1]), snowy(tr[0]), snow_frog()]
    bu, _ = home("prop_bush")
    out["prop_bush"] = [snowy(bu[0], heavy=True), remap(bu[1], {"steel4": "cloud3", "steel3": "sky4", "steel2": "sky3",
                                                                "steel1": "sky2", **SNOW}),
                        snowy(bu[2], heavy=True), snowy(bu[3])]
    fe, _ = home("prop_fence")
    out["prop_fence"] = [snowy(f, body={"wood2", "wood3", "wood4", "wood5"}) for f in fe]
    ore_seats(out, SNOW)
    return out


def snowy(img, heavy=False, body=None):
    """Snow on a prop's upward faces; its ground shadow becomes snow-shade."""
    body = body or FOLIAGE | {"wood1", "wood2", "wood3", "wood4", "wood5", "steel1", "steel2", "steel3", "steel4",
                              "earth1"}
    depth = (("cloud3",), ("cloud2",), ("cloud1",)) if heavy else (("cloud3",), ("cloud2",))
    s = snow_cap(img, body, depth)
    return remap(s, {"grass1": "cloud0", "grass0": "cloud0"})


def snow_frog():
    """A snowman made by the town's frogs: a snow frog. Two snow balls, bulging eyes on top, a
    smile, a red scarf; a carrot? No: a stick tongue is too much. Anchor (16, 29)."""
    img = new(32, 32)

    def ball(cx, cy, rx, ry):
        for y in range(32):
            for x in range(32):
                dx, dy = (x + 0.5 - cx) / rx, (y + 0.5 - cy) / ry
                if dx * dx + dy * dy <= 1:
                    lam = -dx * 0.6 - dy * 0.8
                    put(img, x, y, P["cloud3"] if lam > 0.35 else P["cloud2"] if lam > -0.35 else P["cloud1"] if lam > -0.75 else P["cloud0"])
    ball(16, 24.5, 7.5, 5.5)
    ball(16, 16, 6, 4.5)
    # the eyes on top, bulging
    for ex in (12, 19):
        ball(ex + 0.5, 11.5, 2.2, 2.2)
    img = outline(img, P["ink1"])
    for ex in (12, 19):
        put(img, ex, 11, P["ink"])
        put(img, ex + 1, 11, P["ink"])
    # a smile, a red scarf with a tail
    hline(img, 13, 18, 17, P["ink1"])
    put(img, 12, 16, P["ink1"])
    put(img, 19, 16, P["ink1"])
    hline(img, 10, 21, 20, P["red"])
    hline(img, 10, 21, 21, P["copper0"])
    vline(img, 19, 22, 25, P["red"])
    vline(img, 20, 22, 24, P["copper0"])
    # buttons
    put(img, 16, 24, P["ink1"])
    put(img, 16, 26, P["ink1"])
    sh = new(32, 32)
    for x in range(9, 26):
        if not img.getpixel((x, 30))[3]:
            put(sh, x, 30, P["cloud0"])
    sh.alpha_composite(img)
    return sh


def rime_vein(f, k):
    sh = new(16, 16)
    x0, y0 = [(2, 4), (4, 3), (3, 5), (5, 4)][k]
    cubes = [(0, 2, 4), (4, 0, 3), (5, 4, 3), (1, 6, 2)][: 3 + k % 2]
    for (cx, cy, s) in cubes:
        for yy in range(s):
            for xx in range(s):
                c = "cloud3" if yy == 0 else "teal" if xx < s - 1 else "water4"
                put(sh, x0 + cx + xx, y0 + cy + yy, P[c])
    sh = outline(sh, P["ink"])
    f.alpha_composite(sh)


def rime_deco():
    frames = []
    for k in range(8):
        f = new(16, 16)
        if k in (0, 1):               # frog footprints across the snow
            for j in range(3):
                x, y = 3 + j * 4, 4 + j * 3 + (k * 2 if j % 2 else 0) % 4
                for dx, dy in ((0, 0), (1, 0), (2, 0), (1, 1)):
                    dot(f, x + dx, y + dy, "cloud0")
        elif k == 2:                  # a tuft of grass poking through
            for (x, y, c) in ((6, 9, "grass1"), (7, 8, "grass2"), (8, 9, "grass1"), (9, 7, "grass2"), (7, 10, "cloud1"),
                              (8, 10, "cloud1"), (9, 10, "cloud1")):
                dot(f, x, y, c)
        elif k == 3:                  # an ice crystal glinting
            for (x, y, c) in ((7, 7, "sky4"), (8, 7, "sky3"), (7, 8, "sky3"), (8, 8, "sky2"), (7, 6, "cloud3")):
                dot(f, x, y, c)
        elif k == 4:                  # a snow pile
            for y in range(7, 11):
                for x in range(4, 12):
                    if (x - 7.5) ** 2 / 14 + (y - 10) ** 2 / 9 <= 1:
                        dot(f, x, y, "cloud3" if y < 9 and x < 8 else "cloud2" if y < 10 else "cloud1")
        elif k == 5:                  # a snowdrop
            for (x, y, c) in ((8, 6, "bone"), (7, 7, "bone"), (8, 7, "cloud3"), (8, 8, "grass1"), (8, 9, "grass1"),
                              (9, 9, "grass2")):
                dot(f, x, y, c)
        elif k == 6:                  # a lost blue mitten
            for (x, y, c) in ((6, 7, "sky1"), (7, 7, "sky1"), (8, 7, "sky1"), (6, 8, "sky1"), (7, 8, "iron0"),
                              (8, 8, "sky1"), (9, 8, "sky1"), (6, 9, "bone"), (7, 9, "bone"), (8, 9, "bone")):
                dot(f, x, y, c)
            f = outline(f, P["ink1"])
        else:                         # an icy pebble
            for (x, y, c) in ((7, 8, "sky4"), (8, 8, "sky3"), (7, 9, "sky3"), (8, 9, "steel3"), (9, 9, "steel2")):
                dot(f, x, y, c)
        frames.append(f)
    return frames


# ================================================================ THE OLD WORKS
def old_works():
    out = {}
    pv, _ = home("tile_pave")
    tiles = []
    for v, f in enumerate(pv):
        f = f.copy()
        if v == 0:                    # a crack across the slab
            crack(f, 2 + v * 2, 4 + v, 10, 1200 + v, cols=("pave0", "pave0", "pave1"), dy=0.5)
        if v == 1:                    # a chipped corner, earth showing, a weed in it
            for (x, y) in ((11, 11), (12, 11), (11, 12), (12, 12), (13, 12), (12, 13), (13, 13)):
                dot(f, x, y, "earth2" if (x + y) % 2 else "earth1")
            dot(f, 11, 10, "pave0")
            dot(f, 10, 11, "pave0")
            dot(f, 12, 10, "grass1")
            dot(f, 13, 11, "grass2")
        if v == 3:                    # weeds in the grout
            for (x, y, c) in ((0, 7, "grass1"), (1, 6, "grass2"), (15, 3, "grass1"), (7, 15, "grass1"), (8, 14, "grass2")):
                dot(f, x, y, c)
        tiles.append(f)
    out["tile_pave"] = tiles
    pe, _ = home("tile_pave_edge")
    pes = []
    for i, f in enumerate(pe):
        f = f.copy()
        for k in range(5):
            x, y = int(h01(i, k, 1210) * 15), int(h01(i, k, 1211) * 15)
            # more grass in the grout: where it already grows, a pixel further
            if nm(f, x, y) and nm(f, x, y).startswith("grass"):
                for dx, dy in ((1, 0), (0, 1)):
                    if nm(f, x + dx, y + dy) == "pave2":
                        dot(f, x + dx, y + dy, "grass1")
        pes.append(f)
    out["tile_pave_edge"] = pes
    ps, _ = home("tile_pave_seam")
    out["tile_pave_seam"] = [remap(f, {"pave3": "copper1"}) for f in ps]
    g, _ = home("tile_grass")
    gr = []
    for v, f in enumerate(g):
        f = f.copy()
        # the meadow gone to seed: a few seed heads (it turns olive below, with OLD)
        for k in range(2):
            x, y = 1 + int(h01(v, k, 1220) * 13), 2 + int(h01(v, k, 1221) * 12)
            dot(f, x, y, "grass3")
        gr.append(f)
    out["tile_grass"] = gr
    out["tile_grass_deco"] = old_deco()
    # the rim: an old stone kerb along the coast, crumbling (a block missing here and there)
    e, _ = home("isle_edge")
    edges = []
    for m, f in enumerate(e):
        f = f.copy()
        d = sky_dist(f, m)
        for (x, y), k in d.items():
            if not (0 <= x < 16 and 0 <= y < 16) or k > 3:
                continue
            blk = (x + y + 16 * m) // 5
            if h01(blk, m, 1230) < 0.3:
                continue              # a missing block: the grass runs to the edge
            joint = (x + y + 16 * m) % 5 == 0
            c = "pave0" if joint or k == 3 else "pave3" if k == 2 else "pave1"
            if k == 1:
                c = "earth2" if not joint else "pave0"
            if not joint and h01(x, y, m, 1231) < 0.08:
                c = "moss4"
            dot(f, x, y, c)
        edges.append(f)
    out["isle_edge"] = edges
    # the cliff: brick courses and rusted pipes buried in it, vines over the lip
    c, _ = home("isle_cliff")
    cl = [f.copy() for f in c]
    top = frames_strip(cl[0:4])
    for x in range(64):
        y0 = overhang_bottom(top, x)
        if y0 >= 0 and h01(x, 1240) < 0.22:
            n = 3 + int(h01(x, 1241) * 8)
            for i in range(1, n + 1):
                dot(top, x, y0 + i, "moss3" if i % 3 else "grass1")
                if i % 3 == 2 and x + 1 < 64:
                    dot(top, x + 1, y0 + i, "moss4")
    cl[0:4] = unstrip(top, 4)
    mid = frames_strip(cl[4:8])
    bricks(mid, 6, 3, 12, 7)
    bricks(mid, 40, 8, 10, 5)
    pipe(mid, 26, 6)
    pipe(mid, 56, 11, drip=False)
    cl[4:8] = unstrip(mid, 4)
    low = frames_strip(cl[8:12])
    bricks(low, 20, 2, 9, 5)
    cl[8:12] = unstrip(low, 4)
    out["isle_cliff"] = cl
    out["isle_vein"] = veins(relic_vein, "relic")
    ud, _ = home("isle_under_deco")
    out["isle_under_deco"] = [ud[0], ud[2], ud[4], ud[6], under_gear(), under_pipe(), under_chain(), under_plate()]
    t, _ = home("isle_tip")
    tip = t[0].copy()
    pipe(tip, 30, 8, drip=True)
    out["isle_tip"] = [tip]
    tr, _ = home("prop_tree")
    out["prop_tree"] = [ivy(tr[0]), pillar(), chimney(), buried_gear()]
    bu, _ = home("prop_bush")
    out["prop_bush"] = [bu[0], barrel(), brick_pile(), bu[3]]
    fe, _ = home("prop_fence")
    out["prop_fence"] = [broken_fence(fe[0]), fe[1], fe[2], broken_fence(fe[3], gate=True)]
    # the meadow gone wild and olive (moss, not the Home island's bright grass) wherever it shows
    for k in ("tile_grass", "tile_pave_edge", "isle_edge"):
        out[k] = [remap(f, OLD) for f in out[k]]
    out["isle_cliff"][0:4] = [remap(f, OLD) for f in out["isle_cliff"][0:4]]
    pl, _ = home("tile_plot")
    out["tile_plot"] = [remap(f, {"grass1": "moss2"}) for f in pl]
    ft, _ = home("isle_fall_top")
    out["isle_fall_top"] = [remap(f, OLD) for f in ft]
    ore_seats(out, OLD)
    return out


def bricks(img, x0, y0, w, h):
    """A patch of old brick courses set into the rock: 4x2 bricks, ink2 mortar, an ink rim."""
    for y in range(y0, y0 + h):
        for x in range(x0, x0 + w):
            if not ok(img, x, y):
                continue
            row = (y - y0) // 2
            mortar = (y - y0) % 2 == 1 or (x - x0 + (2 if row % 2 else 0)) % 5 == 4
            edge = x in (x0, x0 + w - 1) or y in (y0, y0 + h - 1)
            if edge and h01(x, y, 1250) < 0.4:
                continue
            c = "ink2" if mortar else ("copper1" if (x + row) % 3 == 0 else "slag0" if (x + row) % 3 == 1 else "copper0")
            if not mortar and (y - y0) % 2 == 0 and (x - x0 + (2 if row % 2 else 0)) % 5 == 0:
                c = "copper2" if c == "copper1" else c
            dot(img, x, y, c)


def pipe(img, x, y, drip=True):
    """A rusted pipe end poking out of the rock: a flange ring, a dark bore, rust streaks; a drip."""
    for (dx, dy, c) in ((0, 0, "steel3"), (1, 0, "steel2"), (2, 0, "copper1"), (0, 1, "steel2"), (1, 1, "ink"),
                        (2, 1, "steel1"), (0, 2, "steel1"), (1, 2, "copper0"), (2, 2, "copper1"), (-1, 0, "ink"),
                        (-1, 1, "ink"), (-1, 2, "ink"), (3, 0, "ink"), (3, 1, "ink"), (3, 2, "ink"), (0, -1, "ink"),
                        (1, -1, "ink"), (2, -1, "ink"), (0, 3, "ink"), (1, 3, "ink"), (2, 3, "ink")):
        if ok(img, x + dx, y + dy):
            dot(img, x + dx, y + dy, c)
    for i in range(4, 7):
        if ok(img, x + 1, y + i):
            dot(img, x + 1, y + i, "copper0")
    if drip and ok(img, x + 2, y + 4):
        dot(img, x + 2, y + 4, "sky2")


def relic_vein(f, k):
    """A fragment of old brass gear set in the rock, verdigris on it, a violet glint."""
    sh = new(16, 16)
    cx, cy = [(6, 7), (7, 6), (5, 8), (8, 7)][k]
    r = 3.6
    for y in range(16):
        for x in range(16):
            dx, dy = x + 0.5 - cx, y + 0.5 - cy
            d = math.hypot(dx, dy)
            a = math.atan2(dy, dx)
            tooth = math.cos(a * 8 + k) > 0.3
            if d <= r or (d <= r + 1.3 and tooth):
                if a > 0.6 + k * 0.3 and a < 2.4 + k * 0.3:
                    continue        # broken away
                lam = (-dx - dy) / (r + 1)
                c = "brass3" if lam > 0.5 else "brass2" if lam > -0.2 else "brass1"
                if d < 1.3:
                    c = "ink1"
                if h01(x, y, k, 1260) < 0.12 and d > 1.3:
                    c = "water3"
                put(sh, x, y, P[c])
    put(sh, int(cx), int(cy), P["violet"])
    sh = outline(sh, P["ink"])
    f.alpha_composite(sh)


def old_deco():
    frames = []
    for k in range(8):
        f = new(16, 16)
        if k == 0:                    # an old paving slab, half sunk, its corner chipped
            rect(f, 4, 6, 11, 10, P["pave2"])
            hline(f, 4, 11, 6, P["pave3"])
            hline(f, 4, 11, 10, P["pave0"])
            put(f, 11, 6, P["grass1"])
            put(f, 10, 6, P["grass1"])
            put(f, 7, 8, P["pave0"])
            put(f, 8, 9, P["pave0"])
            f = outline(f, P["ink1"])
        elif k == 1:                  # two broken bricks
            for (x, y) in ((4, 8), (9, 7)):
                for (dx, dy, c) in ((0, 0, "copper2"), (1, 0, "copper1"), (2, 0, "copper1"), (0, 1, "copper1"),
                                    (1, 1, "copper0"), (2, 1, "copper0")):
                    put(f, x + dx, y + dy, P[c])
            f = outline(f, P["ink1"])
        elif k == 2:                  # a rusty cog in the grass
            for y in range(16):
                for x in range(16):
                    d = math.hypot(x + 0.5 - 8, y + 0.5 - 8)
                    a = math.atan2(y - 7.5, x - 7.5)
                    if 1.2 < d <= 2.8 or (d <= 3.8 and math.cos(a * 6) > 0.4):
                        put(f, x, y, P["copper1"] if x + y < 15 else P["copper0"])
            f = outline(f, P["ink1"])
        elif k == 3:                  # a pipe stub
            for x in range(5, 11):
                put(f, x, 8, P["steel3"] if x < 10 else P["steel2"])
                put(f, x, 9, P["steel1"])
            put(f, 7, 9, P["copper0"])
            put(f, 11, 8, P["ink"])
            put(f, 11, 9, P["ink"])
            f = outline(f, P["ink1"])
        elif k == 4:                  # bolts and nuts
            for (x, y) in ((5, 7), (9, 9), (7, 11)):
                put(f, x, y, P["steel3"])
                put(f, x + 1, y, P["steel2"])
                put(f, x + 1, y + 1, P["steel1"])
        elif k == 5:                  # weeds, a dandelion
            for (x, y, c) in ((7, 9, "moss4"), (8, 8, "moss3"), (6, 10, "moss3"), (9, 10, "moss4"), (8, 6, "lamp2"),
                              (8, 7, "moss3")):
                dot(f, x, y, c)
        elif k == 6:                  # a rusted rail end
            for x in range(3, 13):
                put(f, x, 8, P["copper1"] if x % 4 else P["copper2"])
                put(f, x, 9, P["copper0"])
            f = outline(f, P["ink1"])
        else:                         # poppies
            for (x, y) in ((5, 7), (10, 9)):
                put(f, x, y, P["red"])
                put(f, x + 1, y, P["red"])
                put(f, x, y + 1, P["copper0"])
                put(f, x, y + 2, P["moss3"])
        frames.append(f)
    return frames


def under_gear():
    f = new(16, 16)
    for y in range(16):
        for x in range(16):
            d = math.hypot(x + 0.5 - 8, y + 0.5 - 8)
            a = math.atan2(y - 7.5, x - 7.5)
            if 1.5 < d <= 3.5 or (d <= 4.6 and math.cos(a * 8) > 0.35):
                put(f, x, y, P["copper1"] if x + y < 14 else P["copper0"])
    return outline(f, P["ink"])


def under_pipe():
    f = new(16, 16)
    for y in range(3, 14):
        put(f, 7, y, P["steel2"])
        put(f, 8, y, P["steel1"])
        if y % 4 == 0:
            put(f, 6, y, P["steel3"])
            put(f, 9, y, P["steel1"])
    put(f, 8, 9, P["copper0"])
    put(f, 7, 14, P["sky2"])
    return outline(f, P["ink"])


def under_chain():
    f = new(16, 16)
    for i in range(4):
        y = 2 + i * 3
        x = 7 + (i % 2)
        put(f, x, y, P["steel3"])
        put(f, x, y + 1, P["steel1"])
        put(f, x + 1, y + 1, P["copper0"])
    return outline(f, P["ink"])


def under_plate():
    f = new(16, 16)
    rect(f, 4, 6, 11, 10, P["steel1"])
    hline(f, 4, 11, 6, P["steel2"])
    for (x, y) in ((5, 7), (10, 7), (5, 9), (10, 9)):
        put(f, x, y, P["steel3"])
    put(f, 8, 8, P["copper0"])
    put(f, 9, 9, P["copper1"])
    return outline(f, P["ink"])


def ivy(oak):
    """Home's oak with ivy up its trunk."""
    o = oak.copy()
    for y in range(18, 29):
        for x in range(12, 21):
            if nm(o, x, y) in ("wood1", "wood2", "wood3") and h01(x, y, 1270) < 0.3:
                put(o, x, y, P["moss3"] if (x + y) % 2 else P["moss4"])
    return o


def pillar():
    """A broken stone column: a fluted shaft snapped off at a slant, ivy up it, a drum fallen
    beside it. Anchor (16, 29)."""
    img = new(32, 32)
    for y in range(10, 29):
        for x in range(12, 20):
            if y < 10 + (x - 12) // 2:
                continue        # the snapped slant
            c = "pave3" if x == 12 else "pave2" if x < 16 else "pave1" if x < 19 else "pave0"
            if (x - 12) % 2 == 1 and x not in (12, 19):
                c = "pave1" if x < 16 else "pave0"
            put(img, x, y, P[c])
    rect(img, 11, 27, 20, 28, P["pave2"])
    hline(img, 11, 20, 27, P["pave3"])
    for y in range(14, 27):
        if h01(y, 1280) < 0.55:
            put(img, 13 + (y % 3), y, P["moss3"] if y % 2 else P["grass1"])
    # the fallen drum
    for y in range(24, 29):
        for x in range(21, 27):
            if (x - 23.5) ** 2 / 9 + (y - 26.5) ** 2 / 5 <= 1:
                put(img, x, y, P["pave3"] if y < 26 else P["pave1"])
    img = outline(img, P["ink1"])
    sh = new(32, 32)
    for x in range(10, 29):
        if not img.getpixel((x, 29))[3]:
            put(sh, x, 29, P["grass1"])
    sh.alpha_composite(img)
    return sh


def chimney():
    """A brick chimney stack left standing from a works long gone, its top broken, a weed on it."""
    img = new(32, 32)
    for y in range(6, 29):
        for x in range(12, 20):
            if y < 6 + (2 if x > 16 else 0) + (1 if x == 19 else 0):
                continue
            row = (y - 6) // 2
            mortar = (y - 6) % 2 == 1 or (x - 12 + (2 if row % 2 else 0)) % 4 == 3
            c = "ink2" if mortar else ("copper2" if x == 12 else "copper1" if x < 17 else "copper0")
            put(img, x, y, P[c])
    hline(img, 11, 20, 28, P["slag0"])
    hline(img, 11, 20, 27, P["slag1"])
    put(img, 14, 5, P["moss3"])
    put(img, 15, 4, P["moss4"])
    put(img, 13, 5, P["moss4"])
    img = outline(img, P["ink1"])
    sh = new(32, 32)
    for x in range(10, 26):
        if not img.getpixel((x, 29))[3]:
            put(sh, x, 29, P["grass1"])
    sh.alpha_composite(img)
    return sh


def buried_gear():
    """A great iron gear standing half buried in the meadow, rusted, ivy in its spokes."""
    img = new(32, 32)
    cx, cy = 16, 22
    for y in range(32):
        for x in range(32):
            if y > 28:
                continue
            d = math.hypot(x + 0.5 - cx, y + 0.5 - cy)
            a = math.atan2(y + 0.5 - cy, x + 0.5 - cx)
            rim = 7.5 < d <= 10.2 or (d <= 12 and math.cos(a * 10) > 0.35 and d > 7.5)
            spoke = d <= 7.5 and (abs(math.sin(a * 2)) < 0.22 or d < 2.2)
            if rim or spoke:
                lam = math.cos(a + 2.4)
                c = "copper2" if lam > 0.6 else "copper1" if lam > -0.3 else "copper0"
                if d < 2.2:
                    c = "steel1"
                put(img, x, y, P[c])
    for (x, y) in ((10, 18), (11, 19), (21, 20), (14, 14)):
        put(img, x, y, P["moss3"])
    img = outline(img, P["ink1"])
    # the grass it sinks into
    for x in range(3, 30):
        put(img, x, 29, P["grass1"] if x % 3 else P["grass2"])
        if x % 4 == 1:
            put(img, x, 28, P["grass2"])
    return img


def barrel():
    img = new(16, 16)
    for y in range(4, 14):
        for x in range(4, 12):
            c = "copper2" if x == 4 else "copper1" if x < 9 else "copper0"
            if y in (5, 12):
                c = "steel2" if x < 9 else "steel1"
            put(img, x, y, P[c])
    hline(img, 4, 11, 4, P["ink2"])
    put(img, 6, 8, P["copper0"])
    put(img, 9, 10, P["copper2"])
    img = outline(img, P["ink1"])
    return img


def brick_pile():
    img = new(16, 16)
    for (x, y) in ((3, 10), (7, 10), (11, 10), (5, 8), (9, 8), (7, 6)):
        for (dx, dy, c) in ((0, 0, "copper2"), (1, 0, "copper1"), (2, 0, "copper1"), (0, 1, "copper1"),
                            (1, 1, "copper0"), (2, 1, "copper0")):
            put(img, x + dx, y + dy, P[c])
    img = outline(img, P["ink1"])
    return img


def broken_fence(f, gate=False):
    o = f.copy()
    # the middle third of the rails gone, a rail end hanging
    for y in range(16):
        for x in range(6, 10):
            if nm(o, x, y) in ("wood2", "wood3", "wood4", "wood5", "ink1") and not gate:
                o.putpixel((x, y), (0, 0, 0, 0))
    if gate:
        for y in range(16):
            for x in range(16):
                if nm(o, x, y) == "wood4" and h01(x, y, 1290) < 0.3:
                    put(o, x, y, P["wood2"])
    return o


# ================================================================ build
ISLANDS = {"pebble": pebble_isle, "cinder": cinder_isle, "rime": rime_isle, "oldworks": old_works}
EXOTIC = {"pebble": "skyglass", "cinder": "cinderite", "rime": "rime", "oldworks": "relic"}


def build(only=None):
    shipped = {}
    for world, fn in ISLANDS.items():
        if only and world not in only:
            continue
        print(world)
        sheets = fn()
        shipped[world] = []
        for base in HOME_SHEETS:
            if base not in sheets:
                continue
            frames = sheets[base]
            _, meta = home(base)
            assert len(frames) >= meta["frames"], (world, base, len(frames), meta["frames"])
            assert all(f.size == tuple(meta["frame"]) for f in frames), (world, base)
            extra = {k: v for k, v in meta.items() if k not in ("frame", "frames", "anchor", "fps")}
            if base == "isle_vein":
                extra["names"] = list(meta["names"]) + [f"{EXOTIC[world]}{i}" for i in range(4)]
            ship(vname(world, base), frames, meta["fps"], tuple(meta["anchor"]), extra=extra, bg=P["sky2"], look=4)
            shipped[world].append(base)
    return shipped


if __name__ == "__main__":
    import sys
    build(sys.argv[1:] or None)
