"""Looks for Milestone 11's skins.

    out/look_<skin>.png      the base sheet above the skin sheet, every frame, 4x (8x for small ones)
    out/contact_skins.png    every skin beside its base: frame 0 of each facing at 1x, then at 4x,
                             on the Workshop paving (pave2), labelled
    pips(): the top-right pip corner (5x5) of every facing: no new brightness, no new animation
"""
import json
from pathlib import Path

from PIL import Image, ImageDraw

import m11

HERE = Path(__file__).resolve().parent
OUT = HERE / "out"
SRC = m11.SRC_ART
PAVE = (185, 173, 151, 255)
DECK = (107, 114, 144, 255)   # steel2: the high floors' plate, for the carriers and modules


def load(name):
    img = Image.open(SRC / f"{name}.png").convert("RGBA")
    meta = json.loads((SRC / f"{name}.json").read_text())
    return img, meta


def facing_frames(name, idx=0):
    img, meta = load(name)
    fw, fh = meta["frame"]
    per = max(1, img.width // fw)
    n = meta["frames"]
    fac = meta.get("facings", 1)
    k = n // fac
    out = []
    for r in range(fac):
        i = r * k + idx
        out.append(img.crop(((i % per) * fw, (i // per) * fh, (i % per) * fw + fw, (i // per) * fh + fh)))
    return out


def on(img, bg):
    b = Image.new("RGBA", img.size, bg)
    b.alpha_composite(img)
    return b


def look(name, base):
    a, _ = load(base)
    b, _ = load(name)
    k = 8 if a.width * a.height <= 64 * 32 else 4
    w, hh = a.width + 4, a.height * 2 + 6
    im = Image.new("RGBA", (w, hh), PAVE)
    im.alpha_composite(a, (2, 2))
    im.alpha_composite(b, (2, a.height + 4))
    im.resize((w * k, hh * k), Image.NEAREST).save(OUT / f"look_{name[5:]}.png")


def contact(shipped, path, cols=2):
    """One cell per skin: label; base and skin frame 0 per facing at 1x; the same at 4x."""
    cells = []
    for name, base in shipped:
        bf = facing_frames(base)
        sf = facing_frames(name)
        fw, fh = bf[0].size
        bg = DECK if base in ("skiff", "barge", "courier") or base.endswith("_module") else PAVE
        k = 4 if fw <= 16 and fh <= 24 else 2
        n = len(bf)
        one_w = n * (fw + 2)
        w = max(one_w * 2 + 8 + n * (fw * k + 4) * 2, 260)
        hgt = 12 + max(fh + 4, fh * k + 4)
        cell = Image.new("RGBA", (w, hgt), (40, 36, 52, 255))
        d = ImageDraw.Draw(cell)
        d.text((2, 0), f"{name}  <- {base}", fill=(238, 226, 198, 255))
        y = 12
        x = 2
        for frs in (bf, sf):
            for fr in frs:
                cell.alpha_composite(on(fr, bg), (x, y))
                x += fw + 2
            x += 6
        for frs in (bf, sf):
            for fr in frs:
                big = on(fr, bg).resize((fw * k, fh * k), Image.NEAREST)
                cell.alpha_composite(big, (x, y))
                x += fw * k + 4
            x += 8
        cells.append(cell)
    cw = max(c.width for c in cells)
    rows = [cells[i:i + cols] for i in range(0, len(cells), cols)]
    H = sum(max(c.height for c in r) + 4 for r in rows)
    sheet = Image.new("RGBA", (cw * cols + 4 * cols, H), (24, 20, 32, 255))
    y = 0
    for r in rows:
        x = 0
        for c in r:
            sheet.alpha_composite(c, (x, y))
            x += cw + 4
        y += max(c.height for c in r) + 4
    sheet.save(path)
    return sheet


def lum(p):
    r, g, b = p[:3]
    return 0.2126 * r + 0.7152 * g + 0.0722 * b


def pips(shipped):
    """The pip corner (top-right 5x5 of the tile; a Pole's tile starts at its anchor) of every frame:
    no pixel brighter than the base's brightest there, and no more variation over a facing's frames."""
    bad = []
    for name, base in shipped:
        a, meta = load(base)
        b, _ = load(name)
        fw, fh = meta["frame"]
        ay = meta["anchor"][1] if base == "pole" else 0
        if base in ("skiff", "barge", "courier", "dock", "dock_lily", "hopper", "belt", "belt_turn"):
            continue                       # no pip on carriers, belts or the destinations
        per = max(1, a.width // fw)
        n = meta["frames"]
        fac = meta.get("facings", 1)
        k = n // fac
        for r in range(fac):
            def corner(img, i):
                ox, oy = (i % per) * fw, (i // per) * fh
                return [img.getpixel((ox + x, oy + ay + y)) for y in range(0, 6) for x in range(fw - 6, fw)]
            ca = [corner(a, r * k + i) for i in range(k)]
            cb = [corner(b, r * k + i) for i in range(k)]
            la = max((lum(p) for c in ca for p in c if p[3]), default=0)
            lb = max((lum(p) for c in cb for p in c if p[3]), default=0)
            va = sum(1 for j in range(len(ca[0])) if len({c[j] for c in ca}) > 1)
            vb = sum(1 for j in range(len(cb[0])) if len({c[j] for c in cb}) > 1)
            if lb > max(la, 175) + 1 or vb > va:  # cloud0 (168) is the palest a white skin keeps there
                bad.append(f"{name} facing {r}: corner lum {lb:.0f} (base {la:.0f}), moving px {vb} (base {va})")
    return bad
