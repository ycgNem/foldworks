"""Looks for the critique loop: Act III's sprites beside the ones they must read apart from, at 1x
and enlarged, on the floors they stand on. python review.py -> out/review_*.png"""
import json

from PIL import Image

from c3 import OUT, P, SRC_ART, new, on_bg, scale


def frames(name, row=0):
    img = Image.open(SRC_ART / f"{name}.png").convert("RGBA")
    meta = json.loads((SRC_ART / f"{name}.json").read_text())
    fw, fh = meta["frame"]
    n = img.width // fw
    return [img.crop((i * fw, row * fh, i * fw + fw, row * fh + fh)) for i in range(n)]


def facings0(name):
    return [frames(name, r)[0] for r in range(4)]


def floor(w, h, tile):
    t = frames(tile)
    out = new(w, h)
    for y in range(0, h, 16):
        for x in range(0, w, 16):
            out.alpha_composite(t[(x // 16 + y // 16) % len(t)], (x, y))
    return out


def lay(items, tile, gap=4):
    """items: images laid left to right on a tiled floor."""
    w = sum(i.width + gap for i in items) + gap
    h = max(i.height for i in items) + 2 * gap
    w, h = (w + 15) // 16 * 16, (h + 15) // 16 * 16
    out = floor(w, h, tile)
    x = gap
    for i in items:
        out.alpha_composite(i, (x, gap))
        x += i.width + gap
    return out


def save(name, img, k=4):
    img.save(OUT / f"review_{name}@1x.png")
    scale(img, k).save(OUT / f"review_{name}@{k}x.png")


def machines():
    old = [frames("kiln")[0], frames("refinery")[0], frames("smelter")[0], frames("assembler")[0], frames("mixer")[0]]
    new_ = facings0("chem_vat") + facings0("chute_mouth")
    big = [frames("smelter_mk2")[0], frames("assembler_mk2")[0]] + facings0("greenhouse")
    a = lay(old + new_, "tile_pave")
    b = lay(big, "tile_pave")
    out = new(max(a.width, b.width), a.height + b.height)
    out.alpha_composite(a, (0, 0))
    out.alpha_composite(b, (0, a.height))
    save("machines", out, 3)


def items():
    """Every icon on a belt at 1x and 3x (the belt's own frame 0), then on the District's build floor
    and in a District module's window."""
    belt = frames("belt")[0]
    icons = []
    for name, n in (("items", 10), ("items2", 12), ("items3", 19)):
        im = Image.open(SRC_ART / f"{name}.png").convert("RGBA")
        icons += [im.crop((i * 8, 0, i * 8 + 8, 8)) for i in range(n)]
    cols = 21
    rows = (len(icons) + cols - 1) // cols
    out = new(cols * 16, rows * 16 * 3)
    for i, ic in enumerate(icons):
        x, y = (i % cols) * 16, (i // cols) * 48
        out.alpha_composite(belt, (x, y))
        out.alpha_composite(ic, (x + 4, y + 4))
        out.alpha_composite(frames("dist_deck")[14], (x, y + 16))
        out.alpha_composite(ic, (x + 4, y + 20))
        out.alpha_composite(frames("dist_module")[0], (x, y + 32))
        out.alpha_composite(ic, (x + 4, y + 38))
    save("items", on_bg(out, P["pave2"]), 3)


def pips():
    """The top-right 4x4 of every frame of every facing sheet: no lamp-bright pixel and no change
    between a facing's frames."""
    bright = {(0xff, 0xf0, 0xa6), (0xff, 0xbe, 0x48), (0xff, 0xff, 0xff)}
    for name in ("chem_vat", "greenhouse", "chute_mouth", "factory_chute", "dist_module", "world_module",
                 "dist_dock", "dist_hopper", "dist_bay"):
        meta = json.loads((SRC_ART / f"{name}.json").read_text())
        fw, fh = meta["frame"]
        nrow = 4 if meta.get("facings") else 1
        for r in range(nrow):
            fr = frames(name, r)
            cells = [tuple(f.crop((fw - 4, 0, fw, 4)).getdata()) for f in fr]
            moving = len(set(cells)) > 1
            hot = any(p[3] and p[:3] in bright for c in cells for p in c)
            print(f"  {name} row {r}: {'MOVES ' if moving else ''}{'BRIGHT' if hot else ''}" or "ok")
            if not moving and not hot:
                print(f"  {name} row {r}: calm")


if __name__ == "__main__":
    import sys
    for n in (sys.argv[1:] or ["machines"]):
        globals()[n]()
