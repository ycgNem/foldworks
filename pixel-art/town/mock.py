"""The town as src/render/town.ts lays it out, on the island's meadow (the Workshop) and on the sky
platform's deck (the Factory), from the sprites in src/art (so it shows exactly what the game
loads). A quick look between game runs; the game's own screenshots are the judge.

    python mock.py          -> out/mock_town_ws_{1,2,3}x.png, out/mock_town_factory_2x.png

Mirrors town.ts: rows FAR -3, BACK -2, WALK -1; the deck first, then shadows (ink at 22%), then
the pieces by row and z; stalls' bottoms on the deck's row 10, frogs' feet on row 7, lamps on
row 14; grass tufts at the buildings' feet on the meadow only. Ground tiles: the sky style test's
meadow and paving C (pixel-art/sky/out), the Factory's fplat_deck.
"""
from pathlib import Path
from PIL import Image
from common_town import load, up, OUT, P, hex2rgba, ROOT

T = 16
SKY_OUT = ROOT / "pixel-art" / "sky" / "out"
FAR, BACK, WALK = -3, -2, -1
LAMPS = [2, 7, 12, 15, 20, 23]
STALLS = [5, 10, 18]
HOUSE_VARIANTS = ['gable', 'lily', 'tall', 'brick', 'hut', 'gable', 'lily', 'tall', 'brick']
SLOTS = [(8, BACK), (21, BACK), (5, FAR), (10, FAR), (18, FAR), (-3, BACK), (24, BACK)]
STALL_FOOT, FROG_FOOT, LAMP_FOOT = 10, 7, 14


def frames(path):
    im = Image.open(path).convert("RGBA")
    n = im.width // T
    return [im.crop((i * T, 0, (i + 1) * T, T)) for i in range(n)]


def sheet(name):
    fr, meta = load(name)
    return fr, meta


def named(name, key):
    fr, meta = sheet(name)
    if isinstance(key, int):
        return fr[key % len(fr)]
    return fr[meta.get("order", []).index(key)]


def pieces(fw, rep):
    p = [("town_house", "hut", 0, BACK, 2, 2), ("town_house", "bramble", 3, BACK, 2, 2)]
    x1 = min(fw, 24)
    for x in range(-1, x1 + 1):
        fr = "end_w" if x == -1 else "end_e" if x == x1 else "h"
        p.append(("town_boardwalk", fr, x, WALK, 1, 3))
        p.append(("town_rail", fr, x, WALK, 1, 7))
    for x in LAMPS:
        if x < fw + 3:
            p.append(("town_lamp", (x * 3) % 4, x, WALK, 1, 8))
    for i, x in enumerate(STALLS):
        if x + 2 <= fw + 3:
            p.append(("town_stall", i, x, WALK, 2, 4))
    p.append(("town_unit7", 0, 13, BACK, 2, 2))
    p.append(("town_voltaire", 0, 16, BACK, 2, 2))
    for i in range(rep):
        x, r = SLOTS[i]
        if x + 2 <= fw + 3:
            p.append(("town_house", HOUSE_VARIANTS[i], x, r, 2, 1 if r == FAR else 2))
    p.sort(key=lambda q: (q[3], q[5], q[2]))
    return p


def foot(im):
    for y in range(im.height - 1, -1, -1):
        xs = [x for x in range(im.width) if im.getpixel((x, y))[3]]
        if xs:
            return xs[0], xs[-1], y
    return 0, im.width - 1, im.height - 1


def town(world, ox, oy, fw, meadow, rep=7, frog_t=0.0):
    placed = []
    for (name, fr, x, row, w, z) in pieces(fw, rep):
        im = named(name, fr)
        px = ox + x * T + (w * T - im.width) // 2
        py = oy + (row + 1) * T - im.height
        if name == "town_stall":
            py = oy + row * T + STALL_FOOT + 1 - im.height
        if name == "town_lamp":
            py = oy + row * T + LAMP_FOOT + 1 - im.height
        placed.append((name, im, px, py, x, row))
    frog = named("town_frog", 0)
    for i in range(4):
        span = max(4, min(fw, 24)) * T
        d = (frog_t * (9 + i * 3) + i * 97 + 40 * i) % (span * 2)
        flip = d >= span
        fx = -T + round(span * 2 - d if flip else d)
        im = frog.transpose(Image.FLIP_LEFT_RIGHT) if flip else frog
        placed.append(("town_frog", im, ox + fx, oy + WALK * T + FROG_FOOT + 1 - im.height, 0, WALK))
    placed.sort(key=lambda q: (q[5], {"town_boardwalk": 3, "town_stall": 4, "town_frog": 6, "town_rail": 7, "town_lamp": 8}.get(q[0], 2)))
    for q in placed:
        if q[0] == "town_boardwalk":
            world.alpha_composite(q[1], (q[2], q[3]))
    shade = Image.new("RGBA", world.size, (0, 0, 0, 0))
    ink = hex2rgba(P["ink"])[:3] + (56,)
    for (name, im, px, py, x, row) in placed:
        if name in ("town_boardwalk", "town_rail", "town_lamp"):
            continue
        a, b, bot = foot(im)
        for xx in range(px + a + 1, px + b + 2):
            shade.putpixel((xx, py + bot + 1), ink)
        if b - a + 1 > 6:
            for xx in range(px + a + 3, px + b):
                shade.putpixel((xx, py + bot + 2), ink)
    world.alpha_composite(shade)
    tufts = sheet("town_tuft")[0]
    for (name, im, px, py, x, row) in placed:
        if name == "town_boardwalk":
            continue
        world.alpha_composite(im, (px, py))
        if meadow and name in ("town_house", "town_unit7", "town_voltaire"):
            a, b, bot = foot(im)
            h = (x * 7 + row * 3 + 40) % 4
            ty = py + bot + 1 - 8
            world.alpha_composite(tufts[h], (px + a - 7, ty))
            if (x + row) % 3:
                world.alpha_composite(tufts[(h + 1) % 4].transpose(Image.FLIP_LEFT_RIGHT), (px + b - 8, ty))


def workshop():
    grass = frames(SKY_OUT / "tile_grass.png")
    pave = frames(SKY_OUT / "tile_pave_C.png")
    W, H = 32, 8
    ox, oy = 4 * T, 6 * T
    world = Image.new("RGBA", (W * T, H * T), hex2rgba(P["sky3"]))
    for ty in range(H):
        for tx in range(W):
            gx, gy = tx - 4, ty - 6
            t = pave[(tx * 3 + ty) % len(pave)] if (gy >= 0 and 0 <= gx < 24) else grass[(tx * 7 + ty * 5) % len(grass)]
            world.alpha_composite(t, (tx * T, ty * T))
    town(world, ox, oy, 24, True)
    return world


def factory():
    deck = Image.open(ROOT / "src" / "art" / "fplat_deck.png").convert("RGBA")
    dk = [deck.crop((i * T, 0, (i + 1) * T, T)) for i in range(deck.width // T)]
    W, H = 22, 8
    ox, oy = 4 * T, 6 * T
    world = Image.new("RGBA", (W * T, H * T), hex2rgba(P["sky2"]))
    for ty in range(H):
        for tx in range(W):
            world.alpha_composite(dk[(tx % 2) + 2 * (ty % 2)], (tx * T, ty * T))   # plain_nw..se
    town(world, ox, oy, 12, False, rep=3)
    return world


def main():
    ws = workshop()
    for k in (1, 2, 3):
        up(ws, k).save(OUT / f"mock_town_ws_{k}x.png")
    up(factory(), 2).save(OUT / "mock_town_factory_2x.png")
    print("mock: out/mock_town_ws_{1,2,3}x.png, out/mock_town_factory_2x.png")


if __name__ == "__main__":
    main()
