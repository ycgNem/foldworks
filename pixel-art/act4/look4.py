"""The island mocks with each island's rule on the ground, from the real sprites: Pebble Isle's
half island with a Miner on its skyglass; Cinder Isle's vents with a Smelter fed by one; Rime with
a Heater warming its neighbours and frost on the machines out of its reach; the Old Works under
rubble with a ruined line. Each beside Home (islandmock's sheet), at 1x, 2x and a 3x crop.
python look4.py -> out/look4_<world>@2x.png, out/look4_<world>_plot@3x.png, out/look4_isles@1x.png"""
import json

from PIL import Image, ImageChops

import islandmock as im
from c4 import OUT, SRC_ART, scale

T = 16


def fr(name, i=0, row=0):
    img = Image.open(SRC_ART / f"{name}.png").convert("RGBA")
    meta = json.loads((SRC_ART / f"{name}.json").read_text())
    fw, fh = meta["frame"]
    return img.crop((i * fw, row * fh, i * fw + fw, row * fh + fh))


def atop(machine, overlay):
    ov = overlay.crop((0, 0, machine.width, machine.height))
    o = Image.new("RGBA", machine.size)
    o.paste(ov, (0, 0), ov)
    o.putalpha(ImageChops.multiply(o.split()[3], machine.split()[3]))
    m = machine.copy()
    m.alpha_composite(o)
    return m


def items4(i):
    img = Image.open(SRC_ART / "items4.png").convert("RGBA")
    return img.crop((i * 8, 0, i * 8 + 8, 8))


def put(c, ox, oy, img, x, y, dx=0, dy=0):
    c.alpha_composite(img, (x * T - ox + dx, y * T - oy + dy))


def belt_line(c, ox, oy, x0, x1, y, icons):
    b = fr("belt")
    for k, x in enumerate(range(x0, x1 + 1)):
        put(c, ox, oy, b, x, y)
        if k % 2 == 0:
            put(c, ox, oy, items4(icons[(k // 2) % len(icons)]), x, y, 4, 4)


def pebble(c, ox, oy):
    put(c, ox, oy, fr("miner"), 5, 5)
    belt_line(c, ox, oy, 6, 10, 5, [0, 4])
    put(c, ox, oy, fr("press"), 11, 5)


def cinder(c, ox, oy):
    vents = [(4, 10), (10, 4), (19, 9), (6, 6)]
    for x, y in vents:
        put(c, ox, oy, fr("vent", (x + y) % 4), x, y)
    put(c, ox, oy, fr("smelter"), 7, 6)          # beside the vent at (6, 6): no power, no fuel
    put(c, ox, oy, fr("miner"), 13, 10)
    belt_line(c, ox, oy, 14, 17, 10, [1, 5])     # never beside a vent


def rime(c, ox, oy):
    fo = [fr("frost_overlay", i) for i in range(4)]
    put(c, ox, oy, fr("heater", 1), 6, 10)
    for (x, y, n) in ((5, 10, "smelter"), (7, 10, "press"), (6, 11, "assembler")):
        put(c, ox, oy, fr(n), x, y)                # warm: within 2 tiles of the heater
    for (x, y, n) in ((11, 3, "smelter"), (12, 3, "press"), (17, 6, "assembler")):
        put(c, ox, oy, atop(fr(n), fo[(x + y) % 2]), x, y)
    belt_line(c, ox, oy, 8, 10, 10, [2, 6])
    put(c, ox, oy, atop(fr("smelter_mk2"), fo[2]), 2, 3)


def oldworks(c, ox, oy):
    from isletools import h01
    ro = [fr("ruin_overlay", i) for i in range(6)]
    for y in range(8, 16):
        for x in range(0, 16):
            if h01(x, y, 77) < 0.5:
                put(c, ox, oy, fr("rubble", int(h01(x, y, 78) * 6)), x, y)
    for k, (x, n) in enumerate(((3, "miner"), (4, "smelter"), (5, "press"), (6, "assembler"))):
        put(c, ox, oy, atop(fr(n), ro[k]), x, 5)
    put(c, ox, oy, atop(fr("assembler_mk2"), ro[4]), 18, 4)
    belt_line(c, ox, oy, 7, 9, 5, [3, 7])


def build():
    extras = {"pebble": pebble, "cinder": cinder, "rime": rime, "oldworks": oldworks}
    shots = []
    for w in ["home", "pebble", "cinder", "rime", "oldworks"]:
        img, ox, oy = im.scene(w, extra=extras.get(w))
        shots.append(img)
        scale(img, 2).save(OUT / f"look4_{w}@2x.png")
        crop = img.crop((-ox - 3 * T, -oy - 2 * T, -ox + 24 * T + 3 * T, -oy + (10 if w == "pebble" else 17) * T))
        scale(crop, 3).save(OUT / f"look4_{w}_plot@3x.png")
        crop.save(OUT / f"look4_{w}_plot@1x.png")
    W = sum(s.width for s in shots) + 8 * 6
    H = max(s.height for s in shots) + 16
    out = Image.new("RGBA", (W, H), (79, 138, 224, 255))
    x = 8
    for s in shots:
        out.alpha_composite(s, (x, 8))
        x += s.width + 8
    out.save(OUT / "look4_isles@1x.png")


if __name__ == "__main__":
    build()
