"""The Dock, the Hopper, their Factory versions, the crate, the slag heap and the pole, from the
32 px PixelLab review pack (raw/b32, prompts.md), plus the town's houses, stall and lamps.
Finished here: outline cleaned, fitted to the footprint, a baked shadow, lights that flicker."""
from PIL import Image

from common import P, RAW, new, clean_edges, export, recolor, draw, from_rows
from machines import strip_rim, harden, union_box, drop_shadow

GLOW = [P["lamp0"], P["lamp1"], P["lamp2"], P["lamp3"]]
TEALS = [P["water3"], P["water4"], P["teal"]]


def cand(i):
    return Image.open(RAW / "b32" / f"frame_{i}.png").convert("RGBA")


def lights(im, f, ramp=GLOW):
    """Lantern flicker: frame f steps the light ramp by +1, 0, -1, 0."""
    shift = [0, 1, 0, -1][f % 4]
    if not shift:
        return im
    m = {c: ramp[max(0, min(len(ramp) - 1, i + shift))] for i, c in enumerate(ramp)}
    return recolor(im, m)


def fit32(im, w=32, h=32, shadow=True):
    b = im.getbbox()
    c = im.crop(b)
    if c.width > w or c.height > h:
        s = min((w - 1) / c.width, (h - 1) / c.height)
        c = harden(c.resize((round(c.width * s), round(c.height * s)), Image.NEAREST))
    cv = new(w, h)
    cv.alpha_composite(c, ((w - c.width) // 2, h - c.height - (1 if shadow else 0)))
    cv = clean_edges(cv)
    return drop_shadow(cv) if shadow else cv


def shrink16(im, box=15, w=16, h=16):
    s0 = strip_rim(im)
    b = s0.getbbox()
    c = s0.crop(b)
    s = min(box / c.width, (h - 1) / c.height)
    c = harden(c.resize((max(1, round(c.width * s)), max(1, round(c.height * s))), Image.NEAREST))
    cv = new(w, h)
    cv.alpha_composite(c, ((box - c.width) // 2, h - 1 - c.height))
    return drop_shadow(clean_edges(cv))


def heap_frames():
    """Five fill levels (0, 25, 50, 75, 100%), hand-drawn: a plank bin in 3/4 view (its open top
    dark inside) and a purple slag mound that rises out of it."""
    out = []
    for k in range(5):
        im = new(16, 16)
        # the bin: open top (rows 6-8), front face (rows 9-13), feet (row 14)
        for x in range(1, 15):
            for y in range(6, 9):
                draw(im, [(x, y)], P["ink1"] if 1 < x < 14 and 6 < y else P["wood3"])
            for y in range(9, 14):
                draw(im, [(x, y)], P["wood1"] if y in (11,) else P["wood2"])
            draw(im, [(x, 9)], P["wood4"])
        draw(im, [(2, 14), (3, 14), (12, 14), (13, 14)], P["wood0"])
        draw(im, [(x, 5) for x in range(1, 15)] + [(0, y) for y in range(6, 14)] + [(15, y) for y in range(6, 14)]
             + [(x, 14) for x in (1, 4, 5, 6, 7, 8, 9, 10, 11, 14)] + [(x, 15) for x in (2, 3, 12, 13)], P["ink"])
        draw(im, [(5, y) for y in range(10, 13)] + [(10, y) for y in range(10, 13)], P["wood1"])
        if k:
            h = [0, 2, 4, 6, 8][k]
            top = 8 - h
            for y in range(top, 9):
                t = (y - top + 0.5) / (h + 0.5)
                half = 1 + int(5.5 * t ** 0.6)
                for x in range(8 - half, 8 + half):
                    c = P["slag1"] if (x + y) % 3 else P["slag0"]
                    if x < 8 - half + 2 and y < top + h // 2 + 1:
                        c = P["violet"]
                    draw(im, [(x, y)], c)
                draw(im, [(8 - half - 1, y), (8 + half, y)], P["ink"])
            draw(im, [(x, top - 1) for x in range(7, 9)], P["ink"])
            draw(im, [(6, top + 1), (9, top + 2), (5, min(8, top + 3))], P["violet"])
        out.append(drop_shadow(im))
    return out


def heap_frames_from_draft():
    """Five fill levels (0, 25, 50, 75, 100%): the bin from the draft, its rocks revealed from the
    bottom up."""
    # the draft's rocks are grey: slag is purple (the item's colour), so they are recoloured
    full = recolor(shrink16(cand(18)), {P["steel1"]: P["slag0"], P["steel2"]: P["slag1"], P["steel3"]: P["violet"],
                                        P["steel4"]: P["violet"]})
    a = full.load()
    rock = {P["slag0"], P["slag1"], P["violet"], P["steel1"], P["steel2"], P["steel3"], P["steel4"], P["ink2"]}
    rock_rgb = {tuple(int(c[i:i + 2], 16) for i in (1, 3, 5)) for c in rock}
    pts = [(x, y) for y in range(16) for x in range(16) if a[x, y][3] and a[x, y][:3] in rock_rgb]
    if not pts:
        return [full] * 5
    top, bot = min(y for _, y in pts), max(y for _, y in pts)
    out = []
    for k in range(5):
        f = full.copy()
        cut = bot - (bot - top + 1) * k / 4
        fp = f.load()
        for x, y in pts:
            if y <= cut:
                fp[x, y] = tuple(int(P["ink1"][i:i + 2], 16) for i in (1, 3, 5)) + (255,) if y >= top + 4 else (0, 0, 0, 0)
        out.append(clean_edges(f) if k == 0 else f)
    return out


def town(im, w=32, h=32):
    """A town piece standing in the water: fitted to the bottom with a ripple line at its feet
    (the waterline rule: every standing sprite ends in two water rows)."""
    cv = fit32(im, w, h - 2, shadow=False)
    out = new(w, h)
    out.alpha_composite(cv, (0, 0))
    b = cv.getbbox()
    if b:
        draw(out, [(x, h - 2) for x in range(b[0], b[2]) if x % 4 != 1], P["water3"])
        draw(out, [(x, h - 1) for x in range(b[0] + 2, b[2] - 2) if x % 5 in (0, 1)], P["water2"])
    return out


def build():
    dock = fit32(cand(0))
    export("dock", [dock, lights(dock, 1)], 2)
    lily = fit32(cand(3))
    export("dock_lily", [lily, lights(lily, 1)], 2)
    hop = fit32(cand(5))
    export("hopper", [hop, lights(hop, 1, TEALS), lights(hop, 3, TEALS)], 3)
    fd = fit32(cand(6))
    export("factory_dock", [fd, lights(fd, 1)], 2)
    fh = fit32(cand(7))
    export("factory_hopper", [fh, lights(fh, 1, TEALS), lights(fh, 3, TEALS)], 3)
    export("crate", [shrink16(cand(17))])
    export("heap", heap_frames())
    # the pole overhangs the tile above by 8 px; four identical facings so it is never turned
    pole = shrink16(cand(16), box=15, w=16, h=24)
    export("pole", [[pole]] * 4, 0, anchor=(0, 8), facings=4)
    # the town (town_house order: hut, gable, lily, tall, brick, bramble)
    export("town_house", [town(cand(i)) for i in (8, 9, 10, 11, 12, 13)], 0,
           extra={"order": ["hut", "gable", "lily", "tall", "brick", "bramble"]})
    stall = town(cand(14))
    export("town_stall", [lights(stall, f) for f in range(4)], 6)
    lamp = town(cand(15), 16, 32)
    export("town_lamp", [lights(lamp, f) for f in range(4)], 6)


if __name__ == "__main__":
    build()
