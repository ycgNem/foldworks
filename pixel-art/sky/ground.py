"""The sky island's ground (docs/sky-island.md, the style test): the owned floor in three options
for the lead to pick, the chunk seam, the meadow, its sparse overlays and the for-sale plot
outline. Light from the top-left. Every pixel placed by rule (no generator: a floor must tile with
itself across random variants, which only geometry guarantees).

The ground is calm: one fill colour carries each tile, detail is 1-2 px and sparse, nothing on the
floor is brighter than pave3 or darker than pave0, so machines (dark steel skids), belts (ink and
steel) and items win at 1x.

Outputs (pixel-art/sky/out/): tile_pave_A / _B / _C (4 variants each), tile_pave_seam (N E S W),
tile_grass (4), tile_grass_deco (8), tile_plot (9: NW N NE W none E SW S SE).
Run `python ground.py` from this folder.
"""
from common import P, T, new, draw, put, rect, export, rng, hsh, vnoise, scale, on_bg, sheet
from PIL import Image


# ---------------------------------------------------------------- option A: paving slabs
# Garden flagstones: every tile is bordered by grout on its top and left (so the build grid
# always reads), and split inside into slabs a different way per variant (one big slab, two
# long ones, a long one and two squares, four squares), so a floor of them never reads as a brick
# wall. Grout pave0 on tile edges, pave1 inside (quieter); each slab's top edge catches the light
# (pave3, broken) and its bottom row is pave1 (proud of the grout). Detail: a crack, a chip, a
# tuft of grass in the grout.
SLABS = [
    [(0, 0, 16, 16)],
    [(0, 0, 16, 8), (0, 8, 16, 8)],
    [(0, 0, 8, 16), (8, 0, 8, 8), (8, 8, 8, 8)],
    [(0, 0, 8, 8), (8, 0, 8, 8), (0, 8, 8, 8), (8, 8, 8, 8)],
]


def pave_A(v):
    img = new(T, T)
    rect(img, 0, 0, 15, 15, P["pave2"])
    for (x0, y0, w, h) in SLABS[v]:
        edge = P["pave0"]
        inner = P["pave1"]
        # grout above and left of the slab: pave0 on the tile's own edge, pave1 inside it
        for x in range(x0, x0 + w):
            put(img, x, y0, edge if y0 == 0 else inner)
        for y in range(y0, y0 + h):
            put(img, x0, y, edge if x0 == 0 else inner)
        # lit top edge, broken; shaded bottom row
        for k, x in enumerate(range(x0 + 1, x0 + w)):
            if (k + v + y0) % 7 not in (4, 5):
                put(img, x, y0 + 1, P["pave3"])
            put(img, x, y0 + h - 1, P["pave1"])
    r = rng(300 + v)
    for _ in range(2):
        x, y = r.randrange(3, 14), r.randrange(3, 13)
        put(img, x, y, P["pave1"])
    if v == 0:      # a hairline crack across the big slab
        draw(img, [(5, 3), (6, 4), (6, 5), (7, 6), (8, 6), (9, 7)], P["pave1"])
        put(img, 7, 5, P["pave3"])
    elif v == 1:    # a chipped slab end
        draw(img, [(14, 9), (15, 9), (15, 10)], P["pave1"])
    elif v == 2:    # a tuft of grass in the grout
        draw(img, [(8, 8), (8, 9)], P["grass1"])
        put(img, 9, 8, P["grass2"])
        put(img, 7, 9, P["grass0"])
    elif v == 3:    # a darker, older square
        rect(img, 9, 10, 14, 14, P["pave1"])
        draw(img, [(x, 9) for x in range(9, 16)], P["pave2"])
    return img


# ---------------------------------------------------------------- option B: riveted plate
# One light plate per tile, a 1 px seam on its top and left, a bevel (lit top-left, shaded
# bottom-right) and four flush rivets. Reads as a building plot laid out tile by tile.
def pave_B(v):
    img = new(T, T)
    rect(img, 0, 0, 15, 15, P["pave2"])
    draw(img, [(x, 0) for x in range(16)] + [(0, y) for y in range(16)], P["pave0"])
    draw(img, [(x, 1) for x in range(1, 15)] + [(1, y) for y in range(1, 15)], P["pave3"])
    draw(img, [(x, 15) for x in range(1, 16)] + [(15, y) for y in range(1, 16)], P["pave1"])
    for x, y in ((3, 3), (12, 3), (3, 12), (12, 12)):
        put(img, x, y, P["pave3"])
        put(img, x + 1, y + 1, P["pave0"])
        put(img, x + 1, y, P["pave1"])
    if v == 1:      # a scuff
        draw(img, [(6, 9), (7, 9), (8, 10), (9, 10)], P["pave1"])
    elif v == 2:    # a drain grate
        rect(img, 6, 6, 9, 9, P["pave0"])
        draw(img, [(7, 6), (7, 7), (7, 8), (7, 9)], P["pave1"])
        draw(img, [(6, 10), (7, 10), (8, 10), (9, 10), (10, 10), (10, 6), (10, 7), (10, 8), (10, 9)], P["pave3"])
    elif v == 3:    # a faint weld line
        draw(img, [(5, 8), (6, 8), (7, 8), (8, 8), (9, 8), (10, 8)], P["pave1"])
    return img


# ---------------------------------------------------------------- option C: painted concrete
# Flat concrete with sparse aggregate and a faint build grid: a dotted line along each tile's top
# and left in pave1 and a small cross where four tiles meet. The calmest of the three.
def pave_C(v):
    img = new(T, T)
    rect(img, 0, 0, 15, 15, P["pave2"])
    for k in range(0, 16, 2):
        put(img, k, 0, P["pave1"])
        put(img, 0, k, P["pave1"])
    draw(img, [(0, 0), (1, 0), (0, 1), (15, 0), (0, 15)], P["pave0"])
    # aggregate: a few pale and dark grains, away from the grid line
    r = rng(500 + v)
    for i in range(5):
        x, y = r.randrange(2, 15), r.randrange(2, 15)
        put(img, x, y, P["pave3"] if i % 2 else P["pave1"])
    if v == 1:      # a hairline crack
        draw(img, [(9, 3), (9, 4), (10, 5), (10, 6), (11, 7)], P["pave1"])
    elif v == 2:    # a faint stain
        draw(img, [(5, 10), (6, 10), (7, 10), (4, 11), (5, 11), (6, 11), (7, 11), (8, 11), (5, 12), (6, 12), (7, 12)], P["pave1"])
        put(img, 6, 11, P["pave0"])
    elif v == 3:    # a trowel line, lit
        draw(img, [(4, 6), (5, 6), (6, 6), (7, 6), (8, 6)], P["pave3"])
    return img


PAVES = {"A": pave_A, "B": pave_B, "C": pave_C}


# ---------------------------------------------------------------- the chunk seam (owned land)
def seam(side):
    """A thin bolted strip along one edge of the tile (frames N, E, S, W), so lots read as lots on
    owned land: a 2 px strip of pave0 with a lit pave3 bolt every 8 px and a pave1 shadow."""
    img = new(T, T)
    for x in range(16):
        put(img, x, 0, P["pave0"])
        put(img, x, 1, P["pave0"] if x % 8 != 3 else P["pave3"])
        put(img, x, 2, P["pave1"] if x % 8 != 3 else P["pave0"])
    if side == "N":
        return img
    return img.rotate({"E": -90, "S": 180, "W": 90}[side])


def pave_edge(side):
    """The paving's edge where it meets land you don't own (meadow or the rim), frames N, E, S, W:
    an overlay (clear elsewhere) of grass creeping into the grout along that side: two tufts and
    a blade or two in the edge's joint, a crumb of broken grout. Drawn for N, turned for the rest
    (the tufts lean the same way in all four: they are tiny, nobody can tell)."""
    img = new(T, T)
    # the joint along the edge (the meadow side): grout darkened where the grass has got in
    for x in (2, 3, 9, 10, 11):
        put(img, x, 0, P["pave1"])
    # tuft 1: three blades, the lit tip on the left one, a root in the joint
    draw(img, [(2, 1), (3, 1), (4, 1)], P["grass1"])
    draw(img, [(2, 0), (4, 0)], P["grass2"])
    put(img, 3, 0, P["grass0"])
    put(img, 2, 2, P["grass1"])
    put(img, 1, 0, P["grass3"])
    # tuft 2, smaller
    draw(img, [(10, 0), (11, 1)], P["grass1"])
    put(img, 9, 0, P["grass2"])
    put(img, 11, 0, P["grass3"])
    # a single blade further along, and a crumb of grout
    put(img, 14, 1, P["grass1"])
    put(img, 14, 0, P["grass2"])
    put(img, 6, 1, P["pave1"])
    if side == "N":
        return img
    return img.rotate({"E": -90, "S": 180, "W": 90}[side])


# ---------------------------------------------------------------- the meadow
def grass(v):
    """Bright meadow: grass2 fill, a few dark tufts (grass1, a grass0 root) and lit blade tips
    (grass3). Sparse and short, so the rim's props and the plot outline are what you see."""
    img = new(T, T)
    rect(img, 0, 0, 15, 15, P["grass2"])
    r = rng(700 + v)
    spots = [(r.randrange(1, 15), r.randrange(2, 15)) for _ in range(2 + v % 2)]
    for i, (x, y) in enumerate(spots):
        # a tuft: two short blades in grass1 leaning apart, the lit tip on the left blade
        draw(img, [(x, y), (x + 2, y), (x + 1, y - 1)], P["grass1"])
        put(img, x + 1, y, P["grass0"])
        if i % 2 == 0:
            put(img, x, y - 1, P["grass3"])
    # a lit patch: three pixels of grass3 in a soft diagonal
    lx, ly = r.randrange(2, 12), r.randrange(2, 12)
    if v in (0, 2):
        draw(img, [(lx, ly), (lx + 1, ly), (lx + 2, ly + 1)], P["grass3"])
    return img


def grass_deco(i):
    """Sparse overlays for the rim and the meadow (transparent elsewhere): 0 daisies, 1 buttercups,
    2 tall tuft, 3 pebble, 4 clover, 5 violets, 6 red poppy, 7 a mushroom."""
    img = new(T, T)

    def flower(x, y, petal, heart=P["lamp2"]):
        draw(img, [(x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)], petal)
        put(img, x, y, heart)
        put(img, x, y + 2, P["grass1"])

    if i == 0:
        flower(5, 6, P["bone"])
        flower(10, 10, P["bone"])
        put(img, 9, 11, P["grass0"])
    elif i == 1:
        for x, y in ((4, 9), (8, 6), (11, 10)):
            draw(img, [(x, y), (x + 1, y)], P["lamp2"])
            put(img, x, y - 1, P["lamp3"])
            put(img, x, y + 1, P["grass1"])
    elif i == 2:
        draw(img, [(6, 12), (6, 11), (5, 10), (5, 9), (8, 12), (8, 11), (9, 10), (9, 8), (7, 12), (7, 10)], P["grass1"])
        draw(img, [(5, 8), (9, 7), (7, 9)], P["grass3"])
        draw(img, [(6, 13), (7, 13), (8, 13)], P["grass0"])
    elif i == 3:
        draw(img, [(6, 10), (7, 10), (8, 10)], P["steel3"])
        draw(img, [(5, 11), (6, 11), (7, 11), (8, 11), (9, 11)], P["earth3"])
        draw(img, [(6, 12), (7, 12), (8, 12), (9, 12)], P["grass0"])
        put(img, 6, 10, P["steel4"])
        draw(img, [(11, 7), (12, 7)], P["earth3"])
        draw(img, [(11, 8), (12, 8)], P["grass0"])
    elif i == 4:
        for x, y in ((5, 7), (10, 11)):
            draw(img, [(x, y), (x + 1, y), (x - 1, y + 1), (x, y + 1), (x + 1, y + 1), (x + 2, y + 1), (x, y + 2), (x + 1, y + 2)], P["grass1"])
            draw(img, [(x, y), (x - 1, y + 1)], P["grass3"])
            put(img, x + 1, y + 2, P["grass0"])
    elif i == 5:
        flower(6, 8, P["violet"], P["lamp3"])
        flower(11, 5, P["slag1"], P["lamp2"])
        put(img, 3, 12, P["violet"])
    elif i == 6:
        draw(img, [(7, 7), (8, 7), (6, 8), (7, 8), (8, 8), (9, 8), (7, 9), (8, 9)], P["red"])
        draw(img, [(7, 7)], P["copper3"])
        put(img, 8, 8, P["ink1"])
        draw(img, [(8, 10), (8, 11)], P["grass1"])
        put(img, 9, 11, P["grass3"])
    elif i == 7:
        draw(img, [(6, 8), (7, 8), (8, 8), (5, 9), (6, 9), (7, 9), (8, 9), (9, 9)], P["red"])
        draw(img, [(6, 8)], P["copper3"])
        put(img, 8, 9, P["bone"])
        put(img, 6, 9, P["bone"])
        draw(img, [(7, 10), (7, 11)], P["bone"])
        draw(img, [(6, 12), (7, 12), (8, 12), (9, 11)], P["grass0"])
    return img


# ---------------------------------------------------------------- the for-sale plot outline
# Frames NW N NE W (none) E SW S SE, drawn on the meadow inside a chunk's border: a chalk line
# (bone dashes 3 on 2 off, a grass0 shadow under each) one pixel in from the chunk edge, and a
# survey stake with an orange ribbon at each corner. Dashes run continuous across tiles (period 5
# never meets a tile edge badly: the phase is taken from the world coordinate by the code; these
# frames assume phase 0 at each tile's start, 16 = 3 dashes + a gap).
DASH = [1, 1, 1, 0, 0, 1, 1, 1, 0, 0, 1, 1, 1, 0, 0, 0]


def plot(k):
    img = new(T, T)
    if k == 4:
        return img
    cx, cy = k % 3, k // 3            # 0 = west/north edge, 2 = east/south edge
    top, bottom, left, right = cy == 0, cy == 2, cx == 0, cx == 2

    def hline(y, sh):
        for x in range(16):
            if DASH[x]:
                put(img, x, y, P["bone"])
                put(img, x, y + sh, P["grass1"])

    def vline(x, sh):
        for y in range(16):
            if DASH[y]:
                put(img, x, y, P["bone"])
                put(img, x + sh, y, P["grass1"])

    if top:
        hline(1, 1)
    if bottom:
        hline(14, 1)
    if left:
        vline(1, 1)
    if right:
        vline(14, -1)
    if (top or bottom) and (left or right):
        # clear the dashes round the corner, then the stake
        sx = 1 if left else 12
        sy = 0 if top else 9
        for y in range(sy, sy + 7):
            for x in range(sx - 1, sx + 4):
                if 0 <= x < 16 and 0 <= y < 16:
                    img.putpixel((x, y), (0, 0, 0, 0))
        # stake: a 2 px peg (wood4 lit, wood2 shade) in an ink outline, a ribbon at its top,
        # its shadow on the grass down-right; the chalk lines run into it
        px, py = sx, sy + 1
        rect(img, px, py, px + 2, py + 5, P["ink"])
        draw(img, [(px + 1, py + 1), (px + 1, py + 2), (px + 1, py + 3), (px + 1, py + 4)], P["wood4"])
        put(img, px + 1, py + 4, P["wood2"])
        draw(img, [(px, py + 1), (px + 2, py + 1)], P["lamp1"])
        put(img, px + 2, py + 2, P["lamp0"])
        draw(img, [(px + 3, py + 5), (px + 3, py + 4), (px + 2, py + 6)], P["grass1"])
        if top:
            hline_from = range(px + 4, 16) if left else range(0, px - 1)
            for x in hline_from:
                if DASH[x]:
                    put(img, x, 1, P["bone"])
                    put(img, x, 2, P["grass1"])
        if bottom:
            for x in (range(px + 4, 16) if left else range(0, px - 1)):
                if DASH[x]:
                    put(img, x, 14, P["bone"])
                    put(img, x, 15, P["grass1"])
        yr = range(py + 7, 16) if top else range(0, py - 1)
        for y in yr:
            if DASH[y]:
                lx = 1 if left else 14
                put(img, lx, y, P["bone"])
                put(img, lx + (1 if left else -1), y, P["grass1"])
    return img


def build():
    looks = {}
    for k, fn in PAVES.items():
        frames = [fn(v) for v in range(4)]
        export(f"tile_pave_{k}", frames)
        looks[k] = frames
    # production (the style test's pick): paving C is the game's tile_pave
    export("tile_pave", looks["C"], src=True)
    export("tile_pave_edge", [pave_edge(s) for s in "NESW"], src=True, bg=P["pave2"], look_scale=6)
    export("tile_pave_seam", [seam(s) for s in "NESW"], src=True)
    gr = [grass(v) for v in range(4)]
    export("tile_grass", gr, src=True)
    deco = [grass_deco(i) for i in range(8)]
    export("tile_grass_deco", deco, bg=P["grass2"], src=True)
    pl = [plot(k) for k in range(9)]
    export("tile_plot", pl, bg=P["grass2"], src=True)
    # a contact sheet: each option 6x4 tiles by hash; the meadow with a 4x3 plot; at 1x and 4x
    W = 3 * (6 * 16 + 4) + 4
    out = Image.new("RGBA", (W, 4 * 16 + 8 + 4 * 16 + 4), (40, 40, 60, 255))
    for i, k in enumerate("ABC"):
        for y in range(4):
            for x in range(6):
                out.alpha_composite(looks[k][hsh(x, y) % 4], (4 + i * 100 + x * 16, 4 + y * 16))
    oy = 4 + 64 + 4
    for y in range(4):
        for x in range(18):
            out.alpha_composite(gr[hsh(x, y, 7) % 4], (4 + x * 16, oy + y * 16))
            if hsh(x, y, 9) % 5 == 0:
                out.alpha_composite(deco[hsh(x, y, 3) % 8], (4 + x * 16, oy + y * 16))
    for y in range(4):
        for x in range(4):
            cx = 0 if x == 0 else 2 if x == 3 else 1
            cy = 0 if y == 0 else 2 if y == 3 else 1
            out.alpha_composite(pl[cy * 3 + cx], (4 + (x + 10) * 16, oy + y * 16))
    out.save(OUT_LOOK)
    scale(out, 4).save(OUT_LOOK.with_name("ground_look@4x.png"))


from common import OUT  # noqa: E402
OUT_LOOK = OUT / "ground_look.png"

if __name__ == "__main__":
    build()
