"""The sky island style test's mocks (docs/sky-island.md, phase 1): the Workshop and the Factory
composed from the game's real sprites (src/art/: machines, belts, the Dock and Hopper, ores, the
town) and this folder's new pieces, at the game's zoom, nearest neighbour.

out/mock_workshop_A.png, _B.png, _C.png   1280x720 = the world at zoom 2, one per paving option
out/mock_workshop_A_low.png              the same, scrolled down to the cliffs and underside
out/mock_factory.png                     the Factory platform in a higher sky, zoom 2
out/mock_zoomout.png                     zoom 1, the whole island (chunks A-C owned)

The island is assembled the way island.py's docstring says the code should (Island below):
edge tiles by mask; the cliff copied per pixel column under the south silhouette; the underside
in tiers by tile column; one ink outline round the whole body; the tip under the deepest tiles.
The ore outcrops still bake the deck's shadow colours (wood0-3) round their holes: the mock
remaps those to the paving or the meadow (the re-seat production will do). The town sprites are
used as they are (stilts and water lines and all). A paper floor tag and the Purse sign are
cropped from e2e/out/screens/1280x720-audits3.png and pasted at screen scale to judge contrast.
Run `python mock.py` from this folder (after the other scripts).
"""
import json
import math
from pathlib import Path

from PIL import Image

from common import P, T, OUT, SRC_ART, new, put, rgb, get, scale, hsh, load_art, frame_of, outline, draw, rect
import ground
import island
import sky
import props
import fplat

SHOTS = Path(r"C:\Users\jacks\Documents\foldworks\e2e\out\screens")
if not (SHOTS / "1280x720-audits3.png").exists():
    SHOTS = SRC_ART.parents[1] / "e2e" / "out" / "screens"


# ---------------------------------------------------------------- art from src/art
def sheet_frames(name):
    img, meta = load_art(name)
    fw, fh = meta["frame"]
    cols = img.width // fw
    rows = img.height // fh
    return [[img.crop((c * fw, r * fh, c * fw + fw, r * fh + fh)) for c in range(cols)] for r in range(rows)], meta


def named(name, key):
    fr, meta = sheet_frames(name)
    order = meta.get("order") or meta.get("names")
    return fr[0][order.index(key)]


def ore_sprite(kind):
    fr, meta = sheet_frames(f"tile_ore_{kind}")
    q = fr[0][1:5]
    o = new(32, 32)
    for i, (x, y) in enumerate(((0, 0), (16, 0), (0, 16), (16, 16))):
        o.alpha_composite(q[i], (x, y))
    sp, _ = sheet_frames(f"tile_ore_{kind}_spill")
    apron = new(64, 64)
    for i, f in enumerate(sp[0]):
        apron.alpha_composite(f, ((i % 4) * 16, (i // 4) * 16))
    return o, apron


def reseat(img, on):
    """The deck's shadow colours round an outcrop, remapped to the ground it now stands on."""
    m = {"pave": {"wood0": "pave0", "wood1": "pave0", "wood2": "pave1", "wood3": "pave2"},
         "grass": {"wood0": "grass0", "wood1": "grass0", "wood2": "grass1", "wood3": "grass2"}}[on]
    mm = {rgb(P[k]): rgb(P[v]) for k, v in m.items()}
    out = img.copy()
    px = out.load()
    for y in range(out.height):
        for x in range(out.width):
            p = px[x, y]
            if p[3] and p[:3] in mm:
                px[x, y] = mm[p[:3]] + (255,)
    return out


def pip(img, x, y, c=None):
    c = rgb(c or "#66cc50")
    rect(img, x + 11, y, x + 15, y + 4, P["ink"])
    rect(img, x + 12, y + 1, x + 14, y + 3, c)
    b = rgb(P["bone"])
    put(img, x + 12, y + 1, tuple(int(c[i] * 0.4 + b[i] * 0.6) for i in range(3)))


from mock_island import Island, rows_to_tiles, WORKSHOP_ROWS, WORKSHOP_FALLS, WORKSHOP_VEINS  # noqa: E402

CHUNKS = {"A": (0, 0), "B": (8, 0), "C": (0, 8), "D": (8, 8), "E": (16, 0), "F": (16, 8)}
ORES = [("iron", 1, 2), ("copper", 11, 2), ("iron", 2, 11), ("coal", 17, 2), ("sand", 20, 5), ("coal", 18, 11), ("iron", 21, 13)]


def chunk_of(x, y):
    if 0 <= x < 24 and 0 <= y < 16:
        return "ABE"[x // 8] if y < 8 else "CDF"[x // 8]
    return None


# ---------------------------------------------------------------- the town and props
FAR, BACK, WALK = -3, -2, -1


def town_pieces():
    p = []
    p.append(("town_house", "hut", 0, BACK, 2, 2))
    p.append(("town_house", "bramble", 3, BACK, 2, 2))
    for x in range(-1, 25):
        p.append(("town_boardwalk", "end_w" if x == -1 else "end_e" if x == 24 else "h", x, WALK, 1, 3))
    for x in (2, 7, 12, 15, 20, 23):
        p.append(("town_lamp", 0, x, WALK, 1, 4))
    for i, x in enumerate((5, 10, 18)):
        p.append(("town_stall", i, x, WALK, 2, 4))
    p.append(("town_unit7", 0, 13, BACK, 2, 2))
    p.append(("town_voltaire", 0, 16, BACK, 2, 2))
    for (x, r, v) in ((8, BACK, "gable"), (21, BACK, "lily"), (5, FAR, "tall"), (10, FAR, "brick"), (18, FAR, "hut")):
        p.append(("town_house", v, x, r, 2, 1 if r == FAR else 2))
    p.sort(key=lambda q: (q[3], q[5], q[2]))
    return p


def draw_town(world, ox, oy):
    for (name, fr, x, row, w, z) in town_pieces():
        if isinstance(fr, str):
            s = named(name, fr)
        else:
            frames, _ = sheet_frames(name)
            s = frames[0][fr % len(frames[0])]
        px = ox + x * T + (w * T - s.width) // 2
        py = oy + (row + 1) * T - s.height
        world.alpha_composite(s, (px, py))
    frog = sheet_frames("town_frog")[0][0][1]
    for fx in (60, 250):
        world.alpha_composite(frog, (ox + fx, oy - T - 6))


PROPS = [
    # (kind, frame, tile x, tile y): trees anchor at the trunk foot
    ("tree", 0, -2, 1), ("tree", 1, -2, 5), ("tree", 2, -2, 9), ("tree", 0, -1, 13), ("tree", 3, -1, 16),
    ("tree", 1, 25, 1), ("tree", 3, 25, 5), ("tree", 0, 24, 9), ("tree", 2, 25, 12), ("tree", 1, 24, 16),
    ("tree", 0, 8, 17), ("tree", 2, 14, 17), ("tree", 3, 20, 18),
    ("bush", 0, -1, 3), ("bush", 1, -3, 6), ("bush", 2, -1, 11), ("bush", 0, 24, 3), ("bush", 3, 25, 14),
    ("bush", 1, 6, 17), ("bush", 0, 11, 16), ("bush", 2, 17, 17), ("bush", 0, 23, 17), ("bush", 1, 26, 7),
    ("bush", 0, -2, -4), ("bush", 2, 25, -4), ("bush", 1, 0, 17),
    ("tree", 1, -3, -2), ("tree", 0, 26, -2),
]


def draw_props(world, ox, oy):
    items = []
    for (kind, fr, tx, ty) in PROPS:
        items.append((ty, kind, fr, tx))
    items.sort()
    for (ty, kind, fr, tx) in items:
        if kind == "tree":
            s = props.tree(fr)
            world.alpha_composite(s, (ox + tx * T + 8 - 16, oy + ty * T + 13 - 29))
        else:
            world.alpha_composite(props.bush(fr), (ox + tx * T, oy + ty * T))
    # a short fence along the south lip, east of the plot
    for i, tx in enumerate(range(21, 24)):
        world.alpha_composite(props.fence(0 if i < 2 else 2), (ox + tx * T, oy + 17 * T + 2))


# ---------------------------------------------------------------- the floor: ground, ores, the line
def ground_tile_fn(opt, owned):
    paves = [ground.PAVES[opt](v) for v in range(4)]
    grass = [ground.grass(v) for v in range(4)]
    plot = [ground.plot(k) for k in range(9)]
    deco = [ground.grass_deco(i) for i in range(8)]
    seam = {s: ground.seam(s) for s in "NESW"}

    def at(x, y):
        c = chunk_of(x, y)
        if c and c in owned:
            t = paves[hsh(x, y, 11) % 4].copy()
            cx0, cy0 = CHUNKS[c]
            # seams on owned land between owned chunks: on the east and south edge of a chunk
            if x == cx0 + 7 and chunk_of(x + 1, y) in owned:
                t.alpha_composite(seam["E"])
            if y == cy0 + 7 and chunk_of(x, y + 1) in owned:
                t.alpha_composite(seam["S"])
            return t
        t = grass[hsh(x, y, 7) % 4].copy()
        if c:
            cx0, cy0 = CHUNKS[c]
            lx, ly = x - cx0, y - cy0
            k = (0 if ly == 0 else 2 if ly == 7 else 1) * 3 + (0 if lx == 0 else 2 if lx == 7 else 1)
            if k != 4:
                t.alpha_composite(plot[k])
            elif hsh(x, y, 9) % 6 == 0:
                t.alpha_composite(deco[hsh(x, y, 3) % 8])
        elif hsh(x, y, 9) % 4 == 0:
            t.alpha_composite(deco[hsh(x, y, 3) % 8])
        return t
    return at


def draw_floor(world, ox, oy, owned, f=1):
    # ores and their spill, re-seated on the ground under them
    for (k, x, y) in ORES:
        c = chunk_of(x, y)
        on = "pave" if c in owned else "grass"
        o, apron = ore_sprite(k)
        world.alpha_composite(reseat(apron, on), (ox + x * T - 16, oy + y * T - 16))
        world.alpha_composite(reseat(o, on), (ox + x * T, oy + y * T))
    if "A" not in owned:
        return
    mf, _ = sheet_frames("miner")
    ff, _ = sheet_frames("furnace")
    belt = sheet_frames("belt")[0][0]
    turn = sheet_frames("belt_turn")[0][0]
    dock = sheet_frames("dock")[0][0]
    hopper = sheet_frames("hopper")[0][0]
    heap = sheet_frames("heap")[0][0]
    items = sheet_frames("items")[0][0]

    def at(img, x, y):
        world.alpha_composite(img, (ox + x * T, oy + y * T))

    at(dock[f % 2], 6, 1)
    at(hopper[f % 3], 6, 4)
    at(belt[f % 4], 4, 3)
    at(belt[f % 4], 5, 3)
    at(turn[f % 4].rotate(90), 6, 3)
    at(heap[2], 3, 4)
    at(mf[0][f % 4], 2, 3)
    at(ff[0][f % 4], 3, 3)
    # a second line: a miner on the iron's top-right tile feeding a belt north-east to the Dock
    at(mf[0][(f + 2) % 4], 2, 2)
    at(belt[f % 4], 3, 2)
    at(belt[f % 4], 4, 2)
    at(belt[f % 4], 5, 2)
    ingot, ore = items[2], items[0]
    for (wx, wy, it) in ((4 * T + 3, 3 * T + 4, ingot), (5 * T + 6, 3 * T + 4, ingot), (6 * T + 4, 3 * T + 1, ingot),
                         (3 * T + 5, 2 * T + 4, ore), (4 * T + 10, 2 * T + 4, ore)):
        world.alpha_composite(it, (ox + wx, oy + wy))
    for (x, y) in ((2, 3), (3, 3), (2, 2)):
        pip(world, ox + x * T, oy + y * T)


# ---------------------------------------------------------------- the sky behind
def sky_layer(W, H, floor="workshop", seed=0, islets=True):
    s = sky.gradient(W, H, floor)
    cl = sky.clouds()
    isl = [sky.islet(v) for v in range(4)]
    if islets:
        spots = [(0.04, 0.60, 0), (0.86, 0.66, 3), (0.72, 0.78, 1), (0.18, 0.80, 2)]
        for (fx, fy, v) in spots[: 4 if floor == "workshop" else 2]:
            s.alpha_composite(isl[v], (int(fx * W), int(fy * H) - 24))
    # far clouds (small and medium, high), then nearer big ones lower
    r = seed
    for i, (fx, fy, k) in enumerate(((0.02, 0.18, 4), (0.30, 0.10, 5), (0.62, 0.22, 3), (0.88, 0.12, 4),
                                     (0.08, 0.42, 2), (0.80, 0.44, 2), (0.45, 0.50, 5),
                                     (0.00, 0.70, 0), (0.70, 0.62, 1), (0.92, 0.84, 0), (0.25, 0.92, 1))):
        s.alpha_composite(cl[k], (int(fx * W), int(fy * H)))
    # a small flock crossing (sky_bird, frames out of step)
    for i, (bx, by) in enumerate(((0.83, 0.20), (0.86, 0.17), (0.88, 0.22), (0.91, 0.19))):
        s.alpha_composite(sky.bird(i % 4), (int(bx * W), int(by * H)))
    return s


def cloud_sea(W, y, seed=0, gap=None):
    """A band of big clouds side by side from y down (in front of the island's tip)."""
    lay = new(W, 200 + y)
    cl = sky.clouds()
    # three staggered rows, back to front; sizes, steps and heights from a hash so it never
    # reads as a scalloped border
    rows = [(-14, (2, 3, 4), (26, 40)), (-4, (0, 1, 2, 3), (34, 52)), (10, (0, 1), (40, 58))]
    rows += [(10 + 14 * k, (0, 1), (36, 50)) for k in range(1, 14 if gap else 3)]
    for row, (dy, kinds, step) in enumerate(rows):
        if y + dy > lay.height:
            break
        x = -30 - (hsh(row, 5) % 20)
        i = 0
        # the gap narrows a little row by row (puffs close in round the hole)
        g = (gap[0] - 30 + row * 2, gap[1] - row * 2) if gap else None
        while x < W:
            h = hsh(row, i, 17)
            k = kinds[h % len(kinds)]
            if not (g and g[0] <= x <= g[1]):
                lay.alpha_composite(cl[k], (x, y + dy + (h >> 8) % 9))
            x += step[0] + (h >> 4) % (step[1] - step[0])
            i += 1
    if not gap:
        # under the front rows the sea is one calm lit body (the puffs are its surface)
        cb = rgb(P["cloud2"]) + (255,)
        for yy in range(y + 52, lay.height):
            for xx in range(W):
                if not lay.getpixel((xx, yy))[3]:
                    lay.putpixel((xx, yy), cb)
    return lay


# ---------------------------------------------------------------- HUD crops
def hud_crops():
    shot = Image.open(SHOTS / "1280x720-audits3.png").convert("RGBA")
    water = {rgb(P[k]) for k in ("water0", "water1", "water2", "water3", "water4")}
    purse = shot.crop((0, 0, 240, 124))
    px = purse.load()
    for y in range(purse.height):
        for x in range(purse.width):
            if px[x, y][:3] in water:
                px[x, y] = (0, 0, 0, 0)
    # the Dock's floor tag: the bone paper's box, its deckle and shadow; the floor round it keyed
    tag_box = (466, 60, 616, 148)
    tag = shot.crop(tag_box)
    tp = tag.load()
    bone = rgb(P["bone"])
    xs = [x for y in range(tag.height) for x in range(tag.width) if tp[x, y][:3] == bone]
    ys = [y for y in range(tag.height) for x in range(tag.width) if tp[x, y][:3] == bone]
    bx0, by0, bx1, by1 = min(xs) - 4, min(ys) - 4, max(xs) + 6, max(ys) + 6
    tag = tag.crop((bx0, by0, bx1, by1))
    tp = tag.load()
    floor = water | {rgb(P[k]) for k in ("wood3", "wood4", "moss3", "moss4", "moss2")}
    for y in range(tag.height):
        for x in range(tag.width):
            if tp[x, y][:3] in floor:
                tp[x, y] = (0, 0, 0, 0)
    return purse, tag


# ---------------------------------------------------------------- compose
def workshop(opt, view=(-128, -50), zoom=2, size=(1280, 720), owned=("A",), name=None, hud=True, f=1):
    VW, VH = size[0] // zoom, size[1] // zoom
    # a world canvas big enough for the island and its sky
    OX, OY = 6 * T, 8 * T            # world px of tile (0, 0) on the canvas
    WW, WH = 36 * T, 42 * T
    isl = Island(rows_to_tiles(WORKSHOP_ROWS), WORKSHOP_VEINS)
    body, top = isl.bake(OX, OY, WW, WH, ground_tile_fn(opt, owned))
    vx, vy = OX + view[0], OY + view[1]
    sea_frac = sky.SPEC["workshop"]["clouds"]["sea"]["y"]
    # the cloud sea: in the zoom-1 view at its screen height; zoomed in, just under the tip
    sea_world = vy + int(VH * sea_frac) if zoom == 1 else isl.deepest_y - 20
    ftop, flay = isl.falls(OX, OY, WW, WH, WORKSHOP_FALLS, f, sea_y=sea_world)
    world = new(WW, WH)
    world.alpha_composite(body)
    world.alpha_composite(top)
    world.alpha_composite(ftop)
    world.alpha_composite(flay)
    draw_floor(world, OX, OY, owned, f)
    draw_props(world, OX, OY)
    draw_town(world, OX, OY)
    view_img = sky_layer(VW, VH, "workshop")
    view_img.alpha_composite(world.crop((vx, vy, vx + VW, vy + VH)))
    # the cloud sea in front of the tip (screen space, it sits at the bottom of the view)
    sea_top = sea_world - vy
    if sea_top < VH:
        sea = cloud_sea(VW, sea_top)
        view_img.alpha_composite(sea.crop((0, 0, VW, VH)))
    out = scale(view_img, zoom)
    if hud:
        purse, tag = hud_crops()
        out.alpha_composite(purse, (0, 0))
        # the Dock's tag pinned beside the Dock, as in the game (screen px at zoom 2)
        dx = (OX + 8 * T - vx) * zoom + 4
        dy = (OY + 1 * T - vy) * zoom - 8
        out.alpha_composite(tag, (dx, dy))
        # the same tag hung on the paving too (chunk A's lower half), to judge paper on paving
        out.alpha_composite(tag, ((OX + 1 * T - vx) * zoom, (OY + 5 * T + 4 - vy) * zoom))
    out.save(OUT / (name or f"mock_workshop_{opt}.png"))
    return out


def compare_paving():
    """The three floors side by side: chunk A and a tile of meadow round it, at zoom 3, the
    Dock tag on each; then the same at zoom 1 (what the zoomed-out player sees)."""
    panels = []
    for opt in "ABC":
        img = Image.open(OUT / f"mock_workshop_{opt}.png").convert("RGBA")
        panels.append(img.crop((240, 90, 560, 410)))
    out = Image.new("RGBA", (3 * 330 + 10, 330 + 10 + 120), rgb(P["ink1"]) + (255,))
    for i, p in enumerate(panels):
        out.alpha_composite(p, (10 + i * 330, 10))
        small = p.resize((p.width // 2, p.height // 2), Image.NEAREST)
        out.alpha_composite(small.crop((0, 0, 160, 110)), (10 + i * 330 + 80, 340))
    out.save(OUT / "compare_paving.png")


FACTORY_W, FACTORY_H = 14, 8      # the 12 and one annex block


def factory():
    zoom = 2
    VW, VH = 640, 360
    view_img = sky_layer(VW, VH, "factory", islets=True)
    # the Workshop far below through a gap in the cloud sea: a hazed islet with a tower
    sea_y = int(VH * sky.SPEC["factory"]["clouds"]["sea"]["y"])
    gap = (int(VW * 0.30), int(VW * 0.46))
    far = sky.islet(3)
    view_img.alpha_composite(far, (gap[0] + 14, sea_y + 18))
    view_img.alpha_composite(cloud_sea(VW, sea_y, gap=gap).crop((0, 0, VW, VH)))
    # the platform: floor 14x8, a rim ring, a north deck 3 rows for the town
    ox, oy = 208, 74
    W = new(VW, VH)
    plates = [frame_of("tile_factory", 0), frame_of("tile_factory", 1)]
    cols = {x: (-3, FACTORY_H) for x in range(-1, FACTORY_W + 1)}

    def plat(x, y):
        c = cols.get(x)
        return bool(c) and c[0] <= y <= c[1]
    for x, (t0, t1) in cols.items():
        for y in range(t0, t1 + 1):
            inside = 0 <= x < FACTORY_W and 0 <= y < FACTORY_H
            if inside:
                t = plates[1 if hsh(x, y, 5) % 9 == 0 else 0]
            else:
                m = (1 if plat(x, y - 1) else 0) | (2 if plat(x + 1, y) else 0) | (4 if plat(x, y + 1) else 0) | (8 if plat(x - 1, y) else 0)
                t = fplat.edge(m)
            W.alpha_composite(t, (ox + x * T, oy + y * T))
    # under the south edge: the girder face, the truss, rotors
    ys = oy + (FACTORY_H + 1) * T
    for x in range(-1, FACTORY_W + 1):
        W.alpha_composite(fplat.girder(1 if x % 4 == 1 else 0), (ox + x * T, ys))
        kind = "left" if x == -1 else "right" if x == FACTORY_W else "mid"
        W.alpha_composite(fplat.truss(kind), (ox + x * T, ys + T))
    for i, rx in enumerate((1, 6.5, 12)):
        W.alpha_composite(fplat.rotor(i % 4), (ox + int(rx * T) - 16, ys + 2 * T - 2))
    # the floor: modules and trunks into the Factory Dock and Hopper (factory2's layout)
    mod = frame_of("module", 0)
    items = sheet_frames("items")[0][0]
    items2 = sheet_frames("items2")[0][0]
    trunk = sheet_frames("trunk")[0][0]
    turn = sheet_frames("trunk_turn")[0][0]
    fdock = frame_of("factory_dock", 0)
    fhop = frame_of("factory_hopper", 0)

    def at(img, x, y):
        W.alpha_composite(img, (ox + x * T, oy + y * T))
    rows = [(1, items[2]), (2, items[7]), (3, items[3]), (5, items[9]), (6, items[6])]
    for (r, icon) in rows:
        at(mod, 2, r)
        W.alpha_composite(icon, (ox + 2 * T + 4, oy + r * T + 4))
        pip(W, ox + 2 * T, oy + r * T)
        for x in range(3, 10):
            at(trunk[(x) % 4], x, r)
            if x % 2 == 1:
                W.alpha_composite(icon, (ox + x * T + 4, oy + r * T + 4))
    for r in (3,):
        # row 3 turns north into the Dock's bottom row
        pass
    at(fdock, 10, 1)
    at(fhop, 10, 5)
    draw_town_factory(W, ox, oy)
    view_img.alpha_composite(W)
    out = scale(view_img, zoom)
    purse, tag = hud_crops()
    out.alpha_composite(purse, (0, 0))
    out.save(OUT / "mock_factory.png")


def draw_town_factory(W, ox, oy):
    # the town's houses on the north deck, standing on it as they do on the Workshop's rim
    for (v, x) in (("hut", 0), ("bramble", 3), ("gable", 7)):
        s = named("town_house", v)
        W.alpha_composite(s, (ox + x * T, oy - T - s.height + 8))
    s = sheet_frames("town_unit7")[0][0][0]
    W.alpha_composite(s, (ox + 11 * T, oy - T - s.height + 8))


def build():
    for opt in "ABC":
        workshop(opt)
    workshop("A", view=(-128, 170), name="mock_workshop_A_low.png", hud=False)
    workshop("C", view=(-128, 170), name="mock_workshop_C_low.png", hud=False)
    # zoom 1: the whole island, three chunks owned
    workshop("C", view=(192 - 640, -130), zoom=1, owned=("A", "B", "C"), name="mock_zoomout.png", hud=False)
    factory()
    compare_paving()


if __name__ == "__main__":
    build()
