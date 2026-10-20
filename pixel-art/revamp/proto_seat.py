"""Prototype: how a Mk1 machine sits on the deck (phase 3 readability). Variants side by side on
real deck tiles at 1x and 4x: A the phase-2 1 px wood1 shadow, B a 2 px cast shadow in wood0,
C a dark steel skid under the machine plus the cast shadow, D an ink1 contact pool."""
from PIL import Image

import machines as M
from common import P, new, draw, rgb, OUT, SRC_ART, scale

NAMES = ["smelter", "furnace", "kiln", "press", "assembler", "boiler", "miner", "refinery"]


def body(name):
    spec = M.MACHINES[name]
    keep = M.drop_shadow
    M.drop_shadow = lambda im, col=None: im
    try:
        fs = M.shrink(M.facings(spec), lift=M.lift_map(spec.get("lift")), inner=spec.get("inner"))
    finally:
        M.drop_shadow = keep
    return fs["east"][0], fs["south"][0]


def mask(im):
    a = im.load()
    return {(x, y) for y in range(im.height) for x in range(im.width) if a[x, y][3]}


def cast(im, col, dx=(1, 2), dy=(1, 2)):
    m = mask(im)
    out = new(*im.size)
    pts = {(x + i, y + j) for x, y in m for i in range(dx[0], dx[1] + 1) for j in range(dy[0], dy[1] + 1)
           if 0 <= x + i < im.width and 0 <= y + j < im.height}
    draw(out, pts - m, col)
    out.alpha_composite(im)
    return out


def skid(im):
    """A dark steel skid plate under the machine: rows 12-15, inset 1, ink rim, steel1 lit edge."""
    out = new(16, 16)
    for y in range(11, 16):
        for x in range(0, 16):
            edge = y in (11, 15) or x in (0, 15)
            corner = (x in (0, 15)) and (y in (11, 15))
            if corner:
                continue
            draw(out, [(x, y)], P["ink"] if edge else (P["steel1"] if y == 12 else P["steel0"]))
    draw(out, [(2, 13), (13, 13)], P["steel2"])
    out.alpha_composite(cast(im, P["ink1"], (1, 1), (1, 1)))
    return out


def pool(im):
    out = new(16, 16)
    m = mask(im)
    bottom = max(y for _, y in m)
    xs = [x for x, y in m if y >= bottom - 1]
    x0, x1 = min(xs) - 1, max(xs) + 2
    for x in range(max(0, x0), min(16, x1)):
        for y in (bottom, bottom + 1):
            if y < 16 and not (y == bottom + 1 and x in (x0, x1 - 1)):
                draw(out, [(x, y)], P["wood0"])
    out.alpha_composite(cast(im, P["wood0"], (1, 1), (1, 1)))
    return out


def main():
    deck = Image.open(SRC_ART / "tile_floor.png").convert("RGBA")
    tiles = [deck.crop((i * 16, 0, i * 16 + 16, 16)) for i in range(4)]
    variants = [
        lambda im: M.drop_shadow(im),
        lambda im: cast(im, P["wood0"], (1, 2), (1, 2)),
        skid,
        pool,
    ]
    W, H = len(NAMES) * 2 * 18 + 4, len(variants) * 18 + 4
    img = Image.new("RGBA", (W, H))
    for r, v in enumerate(variants):
        for c, n in enumerate(NAMES):
            e, s = body(n)
            for k, im in enumerate((e, s)):
                x, y = 2 + (c * 2 + k) * 18, 2 + r * 18
                for tx in range(-1, 2):
                    for ty in range(-1, 2):
                        pass
                img.alpha_composite(tiles[(c + k + r) % 4], (x, y))
                img.alpha_composite(v(im), (x, y))
    # deck between cells
    bg = Image.new("RGBA", img.size)
    for y in range(0, H, 16):
        for x in range(0, W, 16):
            bg.alpha_composite(tiles[(x // 16 + y // 16) % 4], (x, y))
    bg.alpha_composite(img)
    bg.save(OUT / "proto_seat@1x.png")
    scale(bg, 4).save(OUT / "proto_seat@4x.png")


if __name__ == "__main__":
    main()
