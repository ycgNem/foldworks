"""Looks for the critique loop: Act IV's sprites beside the ones they must read apart from, at 1x
and enlarged, on the floors they stand on; and the pip-corner check.
python review4.py [machines|items|pips|world|megas] -> out/review4_*.png"""
import json
import sys

from PIL import Image

from c4 import OUT, P, SRC_ART, new, on_bg, scale


def frames(name, row=0):
    img = Image.open(SRC_ART / f"{name}.png").convert("RGBA")
    meta = json.loads((SRC_ART / f"{name}.json").read_text())
    fw, fh = meta["frame"]
    n = img.width // fw
    return [img.crop((i * fw, row * fh, i * fw + fw, row * fh + fh)) for i in range(n)]


def named(name, n):
    meta = json.loads((SRC_ART / f"{name}.json").read_text())
    return frames(name)[meta["names"].index(n)]


def floor(w, h, tile, idx=None):
    t = frames(tile)
    if idx is not None:
        t = [t[i] for i in idx]
    out = new(w, h)
    for y in range(0, h, 16):
        for x in range(0, w, 16):
            out.alpha_composite(t[(x // 16 * 3 + y // 16 * 5) % len(t)], (x, y))
    return out


def atop(machine, overlay):
    """The overlay composited source-atop: only where the machine is opaque."""
    ov = overlay.crop((0, 0, machine.width, machine.height))
    m = machine.copy()
    a = machine.split()[3]
    o = Image.new("RGBA", machine.size)
    o.paste(ov, (0, 0), ov)
    oa = o.split()[3]
    from PIL import ImageChops
    o.putalpha(ImageChops.multiply(oa, a))
    m.alpha_composite(o)
    return m


def save(name, img, k=4):
    img.save(OUT / f"review4_{name}@1x.png")
    scale(img, k).save(OUT / f"review4_{name}@{k}x.png")


def machines():
    # row 1: on Rime's paving: heater frames, beside smelter/furnace/kiln/boiler, then machines with frost
    # row 2: on Cinder's paving and ash: vents, a machine beside a vent
    # row 3: on the Old Works: rubble x6, ruined machines (Mk1 and Mk2)
    W = 16 * 16
    out = new(W, 16 * 8)
    out.alpha_composite(floor(W, 32, "isle_rime_tile_pave"), (0, 0))
    out.alpha_composite(floor(W, 32, "isle_rime_tile_grass"), (0, 32))
    row = [*frames("heater")] + [frames(n)[0] for n in ("smelter", "furnace", "kiln", "boiler")]
    fo = frames("frost_overlay")
    for n in ("smelter", "miner", "assembler"):
        row.append(atop(frames(n)[0], fo[0]))
        row.append(atop(frames(n)[0], fo[1]))
    for i, m in enumerate(row):
        out.alpha_composite(m, (i * 16, 8))
    big = [frames("smelter_mk2")[0], atop(frames("smelter_mk2")[0], fo[2]), atop(frames("assembler_mk2")[0], fo[3])]
    for i, m in enumerate(big):
        out.alpha_composite(m, (i * 40 + 8, 32))
    out.alpha_composite(frames("heater")[0], (140, 40))
    out.alpha_composite(atop(frames("miner")[0], fo[0]), (156, 40))
    # cinder
    out.alpha_composite(floor(W, 32, "isle_cinder_tile_pave"), (0, 64))
    out.alpha_composite(floor(W // 2, 32, "isle_cinder_tile_grass"), (W // 2, 64))
    for i, v in enumerate(frames("vent")):
        out.alpha_composite(v, (8 + i * 20, 72))
        out.alpha_composite(v, (W // 2 + 8 + i * 20, 72))
    out.alpha_composite(frames("smelter")[0], (100, 72))
    out.alpha_composite(frames("vent")[0], (116, 72))
    out.alpha_composite(frames("ore_cinderite")[1], (W // 2 + 96, 64))
    out.alpha_composite(frames("ore_cinderite")[2], (W // 2 + 112, 64))
    out.alpha_composite(frames("ore_cinderite")[3], (W // 2 + 96, 80))
    out.alpha_composite(frames("ore_cinderite")[4], (W // 2 + 112, 80))
    # old works
    out.alpha_composite(floor(W, 32, "isle_oldworks_tile_pave"), (0, 96))
    for i, r in enumerate(frames("rubble")):
        out.alpha_composite(r, (i * 18, 104))
    ro = frames("ruin_overlay")
    for i, n in enumerate(("smelter", "miner", "assembler", "press")):
        out.alpha_composite(frames(n)[0], (112 + i * 34, 100))
        out.alpha_composite(atop(frames(n)[0], ro[i]), (128 + i * 34, 100))
    save("machines", out, 4)
    b = new(120, 40)
    b.alpha_composite(floor(120, 48, "isle_oldworks_tile_pave").crop((0, 0, 120, 40)))
    b.alpha_composite(frames("assembler_mk2")[0], (4, 4))
    b.alpha_composite(atop(frames("assembler_mk2")[0], ro[4]), (40, 4))
    b.alpha_composite(atop(frames("smelter_mk2")[0], ro[5]), (78, 4))
    save("ruin_mk2", b, 5)


def items():
    """Every tier 4 icon (and tier 3 for comparison) on a belt, on the District's and the World's
    build floors, in a Workshop, District and World module's well."""
    belt = frames("belt")[0]
    icons = []
    for name, n in (("items3", 19), ("items4", 15)):
        im = Image.open(SRC_ART / f"{name}.png").convert("RGBA")
        icons += [im.crop((i * 8, 0, i * 8 + 8, 8)) for i in range(n)]
    icons = icons[19 - 6:]          # the last six of tier 3, then tier 4
    wd = named("world_deck", "floor0") if (SRC_ART / "world_deck.json").exists() else frames("dist_deck")[14]
    rows = [("belt", belt, (4, 4)), ("dist", frames("dist_deck")[14], (4, 4)), ("world", wd, (4, 4)),
            ("module", frames("module")[0], (4, 4)), ("dmod", frames("dist_module")[0], (4, 6)),
            ("wmod", frames("world_module")[0], (4, 6))]
    out = new(len(icons) * 16, len(rows) * 16)
    for j, (_, bg, (ix, iy)) in enumerate(rows):
        for i, ic in enumerate(icons):
            out.alpha_composite(bg, (i * 16, j * 16))
            out.alpha_composite(ic, (i * 16 + ix, j * 16 + iy))
    save("items", on_bg(out, P["pave2"]), 4)


def pips():
    """The top-right 4x4 of every frame: no lamp-bright pixel and no change between frames."""
    bright = {(0xff, 0xf0, 0xa6), (0xff, 0xbe, 0x48), (0xff, 0xff, 0xff)}
    for name in ("heater", "vent", "rubble", "world_dock", "world_hopper", "world_bay"):
        if not (SRC_ART / f"{name}.json").exists():
            continue
        meta = json.loads((SRC_ART / f"{name}.json").read_text())
        fw, fh = meta["frame"]
        fr = frames(name)
        cells = [tuple(f.crop((fw - 4, 0, fw, 4)).getdata()) for f in fr]
        moving = len(set(cells)) > 1 and name != "rubble"
        hot = any(p[3] and p[:3] in bright for c in cells for p in c)
        print(f"  {name}: {'MOVES ' if moving else ''}{'BRIGHT' if hot else ''}" if (moving or hot) else f"  {name}: calm")
    for name, sizes in (("ruin_overlay", (16, 16, 16, 16, 32, 32)), ("frost_overlay", (16, 16, 32, 32))):
        for f, n in zip(frames(name), sizes):
            c = f.crop((n - 5, 0, n, 5))
            print(f"  {name} {n}: {'calm' if not any(p[3] for p in c.getdata()) else 'PIXELS IN PIP'}")


if __name__ == "__main__":
    for n in (sys.argv[1:] or ["machines", "items", "pips"]):
        globals()[n]()
