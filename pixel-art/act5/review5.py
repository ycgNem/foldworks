"""Looks for the critique loop: Act V's sprites from the real sheets, at 1x and enlarged, on the
floors they stand on, beside what they must read apart from; and the pip-corner check.
python review5.py [items|seed|skins|pips] -> out/review5_*.png"""
import json
import sys

from PIL import Image

from c5 import OUT, P, SRC_ART, new, on_bg, scale


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


def save(name, img, k=4):
    img.save(OUT / f"review5_{name}@1x.png")
    scale(img, k).save(OUT / f"review5_{name}@{k}x.png")


def icons(sheet, n):
    im = Image.open(SRC_ART / f"{sheet}.png").convert("RGBA")
    return [im.crop((i * 8, 0, i * 8 + 8, 8)) for i in range(n)]


def items():
    """Every tier 5 icon (after the last tier 4 ones for comparison) on a belt, on the World's and
    Beyond's build floors, in a Workshop, World and Beyond module's well."""
    belt = frames("belt")[0]
    ics = icons("items4", 15)[-7:] + icons("items5", 8)
    rows = [("belt", belt, (4, 4)), ("world", named("world_deck", "floor0"), (4, 4)),
            ("module", frames("module")[0], (4, 4)), ("wmod", frames("world_module")[0], (4, 6))]
    if (SRC_ART / "beyond_deck.json").exists():
        rows.append(("beyond", named("beyond_deck", "floor0"), (4, 4)))
    if (SRC_ART / "beyond_module.json").exists():
        rows.append(("bmod", frames("beyond_module")[0], (4, 6)))
    out = new(len(ics) * 16 + 8, len(rows) * 16)
    for j, (_, bg, (ix, iy)) in enumerate(rows):
        for i, ic in enumerate(ics):
            x = i * 16 + (8 if i >= 7 else 0)
            out.alpha_composite(bg, (x, j * 16))
            out.alpha_composite(ic, (x + ix, j * 16 + iy))
    save("items", on_bg(out, P["pave2"]), 5)
    # a belt line carrying the eight, as a player sees it at 1x and 3x
    bf = frames("belt")
    line = new(16 * 10, 16)
    for i in range(10):
        line.alpha_composite(bf[i % len(bf)] if False else bf[0], (i * 16, 0))
    for i, ic in enumerate(icons("items5", 8)):
        line.alpha_composite(ic, (i * 19 + 4, 4))
    save("belt", on_bg(line, P["pave2"]), 3)


def pip(img, x, y, c):
    """The code's working pip (a round dot, src/render/pips.ts) at the tile's top-right, x+10, y+1."""
    from c5 import put
    for (dx, dy) in ((1, 0), (2, 0), (3, 0), (0, 1), (4, 1), (0, 2), (4, 2), (0, 3), (4, 3), (1, 4), (2, 4), (3, 4)):
        put(img, x + 10 + dx, y + 1 + dy, P["ink"])
    for (dx, dy) in ((1, 1), (2, 1), (3, 1), (1, 2), (2, 2), (3, 2), (1, 3), (2, 3), (3, 3)):
        img.putpixel((x + 10 + dx, y + 1 + dy), c)


def seed():
    """The Seed on the Workshop's paving and on the meadow, its four frames, beside the Mk1 machines
    it must read apart from (miner, smelter, heater), with and without a pip; a little line of
    belts leaving its four sides."""
    W, H = 16 * 14, 16 * 5
    out = floor(W, H, "tile_pave")
    out.alpha_composite(floor(W, 32, "tile_grass"), (0, H - 32))
    sd = frames("seed")
    for i, f in enumerate(sd):
        out.alpha_composite(f, (16 + i * 24, 16))
        out.alpha_composite(f, (16 + i * 24, H - 24))
    for i, n in enumerate(("miner", "smelter", "heater", "assembler")):
        out.alpha_composite(frames(n)[0], (120 + i * 24, 16))
    # the Seed with its pip, and four belts leaving its sides
    s = sd[0].copy()
    pip(s, 0, 0, (0x66, 0xcc, 0x50, 255))
    out.alpha_composite(s, (16 * 9, 48 - 8))
    bt = frames("belt")[0]
    for (dx, dy) in ((1, 0), (-1, 0)):
        out.alpha_composite(bt, (16 * 9 + dx * 16, 40 + dy * 16))
    out.alpha_composite(s, (16 * 12, 40))
    save("seed", out, 4)


def skins():
    """Each skin beside its base on the Workshop paving, all four facings (frame 0 and 2), and the
    Mk2 ones; then a little line: a gilded miner on iron feeding a candy press."""
    pairs = [("miner", "skin_gilded_miner"), ("press", "skin_candy_press"), ("assembler", "skin_starlit_assembler")]
    W, H = 16 * 20, 16 * 9
    out = floor(W, H, "tile_pave")
    for j, (b, s) in enumerate(pairs):
        for r in range(4):
            for k, n in enumerate((b, s)):
                out.alpha_composite(frames(n, r)[0], (8 + r * 40 + k * 18, 8 + j * 24))
            out.alpha_composite(frames(s, r)[2], (8 + r * 40 + 36 - 18, 8 + j * 24)) if False else None
    for k, n in enumerate(("press_mk2", "skin_candy_press_mk2", "assembler_mk2", "skin_starlit_assembler_mk2")):
        out.alpha_composite(frames(n)[0], (8 + k * 40, 84))
    for i, f in enumerate(frames("skin_starlit_assembler")[:4]):
        out.alpha_composite(f, (176 + i * 18, 84))
    for i, f in enumerate(frames("skin_gilded_miner")[:4]):
        out.alpha_composite(f, (176 + i * 18, 104))
    for i, f in enumerate(frames("skin_candy_press")[:4]):
        out.alpha_composite(f, (176 + i * 18, 122))
    save("skins", out, 4)


def pips(names):
    """The top-right 4x4 of every frame: no lamp-bright or white pixel and no change between frames."""
    bright = {(0xff, 0xf0, 0xa6), (0xff, 0xbe, 0x48), (0xff, 0xff, 0xff)}
    for name in names:
        if not (SRC_ART / f"{name}.json").exists():
            continue
        meta = json.loads((SRC_ART / f"{name}.json").read_text())
        fw, fh = meta["frame"]
        img = Image.open(SRC_ART / f"{name}.png").convert("RGBA")
        rows = img.height // fh
        bad = []
        for r in range(rows):
            fr = frames(name, r)
            cells = [tuple(f.crop((fw - 4, 0, fw, 4)).getdata()) for f in fr]
            if len(set(cells)) > 1:
                bad.append(f"row {r} MOVES")
            if any(p[3] and p[:3] in bright for c in cells for p in c):
                bad.append(f"row {r} BRIGHT")
        print(f"  pip {name}: {'calm' if not bad else ', '.join(bad)}")


if __name__ == "__main__":
    for n in (sys.argv[1:] or ["items"]):
        globals()[n]()
