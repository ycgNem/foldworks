"""A mock Workshop built from the exported sheets in out/, the way the game draws them (deck
variants by hash, deposits by quadrant, water frames by (3x + 5y) mod 4, shore frames by side,
machines by facing row). For looking at the art at 1x and 3x before the game's own shots.
Run: python mock.py  -> out/mock.png, out/mock@3x.png"""
import json

from PIL import Image

from common import OUT, P, T, rgb, scale

W, H = 26, 16
FX0, FY0, FW, FH = 2, 3, 22, 12      # the floor rectangle inside the mock


def frames(name):
    p = OUT / f"{name}.png"
    if not p.exists():
        return None, None
    img = Image.open(p).convert("RGBA")
    m = json.loads((OUT / f"{name}.json").read_text())
    w, h = m["frame"]
    per = img.width // w
    fr = [img.crop(((i % per) * w, (i // per) * h, (i % per) * w + w, (i // per) * h + h)) for i in range(m["frames"])]
    return fr, m


def hsh(x, y, s=0):
    h = (x * 374761393 + y * 668265263 + s * 2147483647) & 0xFFFFFFFF
    h = ((h ^ (h >> 13)) * 1274126177) & 0xFFFFFFFF
    return ((h ^ (h >> 16)) & 0xFFFFFFFF) / 4294967296


def machine(name, rot, f=0):
    fr, m = frames(name)
    if fr is None:
        return None, None
    fac = m.get("facings")
    if fac:
        n = m["frames"] // fac
        return fr[rot * n + (f % n)], m
    img = fr[f % len(fr)]
    return img.rotate(-90 * rot), m


def build(placements=None, t=0):
    img = Image.new("RGBA", (W * T, H * T), rgb(P["water1"]) + (255,))
    water, _ = frames("tile_water")
    shore, _ = frames("tile_shore")
    deck, _ = frames("tile_floor")
    land = lambda x, y: FX0 <= x < FX0 + FW and FY0 <= y < FY0 + FH  # noqa: E731
    ores = {(4, 6, 2, 2): "iron", (4, 10, 3, 3): "copper", (15, 5, 2, 2): "coal", (19, 10, 2, 2): "sand"}
    oretiles = {}
    for (ox, oy, ow, oh), k in ores.items():
        q, _ = frames(f"tile_ore_{k}")
        for y in range(oy, oy + oh):
            for x in range(ox, ox + ow):
                oretiles[(x, y)] = q[((x - ox) % 2) + 2 * ((y - oy) % 2)]
    for y in range(H):
        for x in range(W):
            if land(x, y):
                tile = oretiles.get((x, y)) or deck[int(hsh(x, y, 91) * len(deck))]
                img.alpha_composite(tile, (x * T, y * T))
            else:
                img.alpha_composite(water[(t + x * 3 + y * 5) & 3], (x * T, y * T))
                for i, (dx, dy) in enumerate(((0, -1), (1, 0), (0, 1), (-1, 0))):
                    if land(x + dx, y + dy):
                        img.alpha_composite(shore[i], (x * T, y * T))
    # land not owned: the game darkens, cools and hatches it in code (ground.ts); approximated here
    ov = Image.new("RGBA", img.size, (0, 0, 0, 0))
    for y in range(FY0, FY0 + FH):
        for x in range(19, FX0 + FW):
            for j in range(T):
                for i in range(T):
                    a = 158 if (i + j + x + y) % 6 else 200
                    ov.putpixel((x * T + i, y * T + j), rgb(P["ink1"]) + (a,))
    img.alpha_composite(ov)
    for (name, x, y, rot) in (placements or []):
        spr, m = machine(name, rot, t)
        if spr is None:
            continue
        if name in ("belt", "belt_turn", "trunk"):
            img.alpha_composite(spr, (x * T, y * T))
            continue
        ax, ay = (m.get("anchor") or [0, 0])
        img.alpha_composite(spr, (x * T - ax, y * T - ay))
    return img


LINE = ([("belt", x, 7, 0) for x in range(6, 10)] + [("belt", x, 7, 0) for x in range(11, 14)]
        + [("miner", 5, 7, 0), ("smelter", 10, 7, 0), ("press", 14, 7, 0), ("belt", 15, 7, 0)]
        + [("assembler", 16, 7, 0), ("belt", 17, 7, 0)]
        + [("miner", 6, 11, 0), ("belt", 7, 11, 0), ("belt", 8, 11, 0), ("smelter", 9, 11, 1),
           ("furnace", 10, 9, 2), ("boiler", 12, 12, 0), ("steam_engine", 13, 12, 0), ("generator", 15, 12, 3),
           ("kiln", 17, 12, 1), ("mixer", 11, 9, 3), ("refinery", 13, 10, 2), ("pole", 14, 9, 0),
           ("crate", 18, 9, 0), ("heap", 18, 5, 0), ("splitter", 12, 5, 0), ("merger", 13, 5, 0),
           ("dock", 20, 6, 0), ("hopper", 20, 12, 0)])

if __name__ == "__main__":
    m = build(LINE)
    m.save(OUT / "mock.png")
    scale(m, 3).save(OUT / "mock@3x.png")
    print(m.size)
