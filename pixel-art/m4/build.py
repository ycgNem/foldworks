"""Foldworks Milestone 4 (Act II) art:   python build.py

Exports to src/art/ (1x strip + JSON sidecar, palette-checked by common_m4.export):
    mega_bay                 32x32 x6  names empty, stage1, stage2, stage3, run1, run2   (bay.py)
    fx_overdrive             16x16 x4  fps 12                                           (fx.py)
    fx_overdrive_big         32x32 x4  fps 12                                           (fx.py)
    portrait_unit7_cheer     48x48 x2  fps 4                                            (cheers.py)
    portrait_voltaire_cheer  48x48 x2  fps 4                                            (cheers.py)

The nine Act II UI icons (power, heavy, codex, survey, mega, kit, claim, overdrive, mode) are
appended to the existing atlases by their own builders, so the first 20 icons stay untouched:
    ui_icons        pixel-art/ui/icons.py  (the 16x16 drawings are in ui/icons_m4.py)
    ui_icons_small  pixel-art/m2/build.py  (the 8x8 drawings are in m2/sprites.py SMALL / RAW)
This script reads those atlases back for the contact sheet; run those two first after a change.

Writes contact.png (everything new, at 1x on the left and 3x on the right), out/contact_1x.png,
out/mock_factory_{1,3}x.png (the bay running among modules on the Factory floor, the overdrive
rings on a Mk1 and a Mk2 machine), and per-sprite previews.
"""
import bay
import fx
import cheers
from common_m4 import P, export, OUT, up, frames, hex2rgba, text, Image, checker

BG = "#2b2330"


def mock(t=0):
    """A slice of the Factory floor: the bay, modules around it, two overdriven machines."""
    W, H = 8, 5
    img = Image.new("RGBA", (W * 16, H * 16), hex2rgba(P["ink"]))
    tf = frames("tile_factory")
    for ty in range(H):
        for tx in range(W):
            img.alpha_composite(tf[0], (tx * 16, ty * 16))
    mod, glow, items = frames("module")[0], frames("module_glow"), frames("items")
    for (tx, ty, it) in ((0, 0, 5), (4, 0, 7), (4, 1, 9), (0, 3, 5), (1, 3, 7)):
        img.alpha_composite(mod, (tx * 16, ty * 16))
        img.alpha_composite(items[it % len(items)], (tx * 16 + 4, ty * 16 + 4))
        img.alpha_composite(glow[(t + tx) % 4], (tx * 16, ty * 16))
    bayf = frames("mega_bay")
    img.alpha_composite(bayf[4 + t % 2], (1 * 16, 1 * 16))
    sm = frames("smelter")
    ov = frames("fx_overdrive")
    img.alpha_composite(sm[t % 4], (5 * 16, 3 * 16))
    img.alpha_composite(ov[t % 4], (5 * 16, 3 * 16))
    sm2 = frames("smelter_mk2")
    ovb = frames("fx_overdrive_big")
    img.alpha_composite(sm2[t % 4], (6 * 16, 1 * 16))
    img.alpha_composite(ovb[t % 4], (6 * 16, 1 * 16))
    return img


def contact():
    """Every new sprite, every frame: a 1x column and a 3x column, labelled."""
    rows = []
    for name in ("mega_bay", "fx_overdrive", "fx_overdrive_big", "portrait_unit7_cheer",
                 "portrait_voltaire_cheer", "ui_icons", "ui_icons_small"):
        fr = frames(name)
        if name.startswith("ui_icons"):
            fr = fr[20:]
        rows.append((name, fr))
    gap = 4
    w1 = max(sum(f.width + gap for f in fr) for _, fr in rows) + gap
    w3 = max(sum(f.width * 3 + gap for f in fr) for _, fr in rows) + gap
    H = sum(max(f.height for f in fr) * 3 + 16 for _, fr in rows) + gap
    W = w1 + w3 + 8
    out = Image.new("RGBA", (W, H), hex2rgba(BG))
    y = gap
    for name, fr in rows:
        h3 = max(f.height for f in fr) * 3
        text(out, name + (" (new 9)" if name.startswith("ui_icons") else ""), gap, y, P["hull2"])
        y += 10
        x = gap
        for f in fr:
            out.alpha_composite(f, (x, y))
            x += f.width + gap
        x = w1 + 8
        for f in fr:
            out.alpha_composite(up(f, 3), (x, y))
            x += f.width * 3 + gap
        y += h3 + 6
    out.save(OUT.parent / "contact.png")
    return out


def main():
    export(bay.build(), "mega_bay", 6, names=bay.NAMES)
    export(fx.build(16), "fx_overdrive", 12, scale=12)
    export(fx.build(32), "fx_overdrive_big", 12)
    export(cheers.build(cheers.unit7_cheer), "portrait_unit7_cheer", 4)
    export(cheers.build(cheers.voltaire_cheer), "portrait_voltaire_cheer", 4)
    contact()
    for t in range(2):
        m = mock(t)
        if t == 0:
            m.save(OUT / "mock_factory_1x.png")
            up(m, 3).save(OUT / "mock_factory_3x.png")
        else:
            up(m, 3).save(OUT / "mock_factory_3x_t1.png")


if __name__ == "__main__":
    main()
