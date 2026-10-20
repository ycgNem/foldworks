"""The town over the real swamp: tile_water / tile_shore / tile_floor from src/art, the town's
sprites from src/art (so this shows exactly what the game loads). Writes out/mock_town_1x.png,
_2x.png, _3x.png (frame 0), out/mock_town_2x.gif (4 frames) and out/mock_town_grow_1x.png (the
town at three stages of growth side by side)."""
from PIL import Image
from common_town import load, up, OUT, hex2rgba, P

T = 16
W, H = 22, 14
LAND = {(tx, ty) for tx in range(15, 22) for ty in range(2, 13)}


def F(name):
    return load(name)[0]


def ground(img, t):
    water, shore, floor = F("tile_water"), F("tile_shore"), F("tile_floor")
    for ty in range(H):
        for tx in range(W):
            if (tx, ty) in LAND:
                img.alpha_composite(floor[(tx * 7 + ty * 3) % len(floor)], (tx * T, ty * T))
            else:
                img.alpha_composite(water[(t + tx * 3 + ty * 5) % 4], (tx * T, ty * T))
    for ty in range(H):
        for tx in range(W):
            if (tx, ty) in LAND:
                continue
            for side, (dx, dy) in enumerate(((0, -1), (1, 0), (0, 1), (-1, 0))):
                if (tx + dx, ty + dy) in LAND:
                    img.alpha_composite(shore[side], (tx * T, ty * T))


def town(img, t, stage=3):
    bw = F("town_boardwalk")
    bwn = load("town_boardwalk")[1]["order"]
    house, hn = F("town_house"), load("town_house")[1]["order"]
    lamp, stall, frog = F("town_lamp"), F("town_stall"), F("town_frog")
    u7, volt = F("town_unit7"), F("town_voltaire")
    lily, ln = F("town_lily"), load("town_lily")[1]["order"]

    def put(im, tx, ty, dx=0, dy=0, flip=False):
        if flip:
            im = im.transpose(Image.FLIP_LEFT_RIGHT)
        img.alpha_composite(im, (tx * T + dx, ty * T + dy))

    # scatter first (under everything)
    for (name, tx, ty) in (("pad", 1, 11), ("pads", 3, 12), ("reeds", 0, 7), ("flower", 9, 12),
                           ("cattails", 13, 1), ("buds", 12, 12), ("pad", 7, 1), ("reeds", 14, 6),
                           ("pads", 0, 2), ("cattails", 2, 10)):
        put(lily[ln.index(name)], tx, ty)
    # back row: the customers' buildings
    if stage >= 3:
        put(u7[t], 1, 3)
        put(volt[t], 10, 1)
    # houses behind the boardwalk
    homes = [("bramble", 5), ("hut", 3)] if stage >= 1 else []
    if stage >= 2:
        homes += [("gable", 8), ("tall", 10)]
    if stage >= 3:
        homes += [("brick", 12)]
    for name, tx in homes:
        put(house[hn.index(name)], tx, 7)
    # the boardwalk
    if stage >= 1:
        row = {tx: "h" for tx in range(3, 15)}
        row[2] = "end_w"
        if stage >= 3:
            row[7] = "tee_s"
        for tx, name in row.items():
            put(bw[bwn.index(name)], tx, 9)
        if stage >= 3:
            put(bw[bwn.index("v")], 7, 10)
            put(bw[bwn.index("end_s")], 7, 11)
    # lamps on the boardwalk's back edge
    if stage >= 2:
        for tx in (7, 14):
            put(lamp[(t + tx) % 4], tx, 7, dy=0)
    # festival stalls south of the walk, frogs on it
    if stage >= 3:
        put(stall[t], 5, 10)
        put(stall[(t + 2) % 4], 8, 10)
        for (x, fl, ph) in ((60, False, 0), (100, True, 2), (150, False, 1), (200, True, 3)):
            img.alpha_composite((frog[(t + ph) % 4].transpose(Image.FLIP_LEFT_RIGHT) if fl else frog[(t + ph) % 4]),
                                (x + t * (-1 if fl else 1), 9 * T + 9 - 15))


def scene(t, stage=3):
    img = Image.new("RGBA", (W * T, H * T), hex2rgba(P["ink"]))
    ground(img, t)
    town(img, t, stage)
    return img


def main():
    sc = [scene(t) for t in range(4)]
    sc[0].save(OUT / "mock_town_1x.png")
    up(sc[0], 2).save(OUT / "mock_town_2x.png")
    up(sc[0], 3).save(OUT / "mock_town_3x.png")
    frames = [up(s, 2).convert("RGB") for s in sc]
    frames[0].save(OUT / "mock_town_2x.gif", save_all=True, append_images=frames[1:], duration=160, loop=0)
    stages = [scene(0, k) for k in (1, 2, 3)]
    g = Image.new("RGBA", (W * T * 3 + 8, H * T), hex2rgba(P["shadow"]))
    for i, s in enumerate(stages):
        g.alpha_composite(s, (i * (W * T + 4), 0))
    g.save(OUT / "mock_town_grow_1x.png")


if __name__ == "__main__":
    main()
