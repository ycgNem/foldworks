"""Foldworks juice-round art (the owner's 'full, juicy' pass):   python build.py

Exports to src/art/ (1x strip + JSON sidecar, palette-checked):
    fx_fold        32x32 x8   fps 16   the fold moment, scaled over the fold box     (fxfold.py)
    module_od      16x16 x4   fps 8    overdrive overlay for a Factory module         (moduleod.py)
    ui_audit       12x12 x4   fps 4    the audit badge's ticking stopwatch           (audit.py)
    mega_stage1    48x48 x10  fps 4    the Great Drill stage 1 being built (named)  (mega.py)
    ui_research    16x16 x4   fps 0    research node icons that had none (named)     (research_icons.py)
    research_lab   64x48 x4   fps 6    the research card's picture: a bubbling lab   (lab.py)
The S+ grade frame lives with the other grades in pixel-art/ui/letters.py (ui_grade frame 6).
Writes out/contact.png (every sprite at 1x and 2x), out/mock_*.png and per-sprite previews.
"""
import fxfold
import moduleod
import audit
import mega
import research_icons
import lab
from common_m5 import export, frames, P, Image, hex2rgba, up, OUT, text


def mock_modules():
    """Factory floor, four modules with icons: plain, working (module_glow), overdriven x2."""
    W, H = 6, 2
    tf = frames("tile_factory")[0]
    mod, glow, od, items = frames("module")[0], frames("module_glow"), frames("module_od"), frames("items")
    shots = []
    for t in range(4):
        img = Image.new("RGBA", (W * 16, H * 16))
        for ty in range(H):
            for tx in range(W):
                img.alpha_composite(tf, (tx * 16, ty * 16))
        for i, (tx, ty, it, kind) in enumerate(((0, 0, 5, ""), (2, 0, 7, "glow"), (4, 0, 9, "od"),
                                                 (1, 1, 2, "od"), (3, 1, 6, "glow"), (5, 1, 3, "od"))):
            img.alpha_composite(mod, (tx * 16, ty * 16))
            img.alpha_composite(items[it % len(items)], (tx * 16 + 4, ty * 16 + 4))
            if kind == "glow":
                img.alpha_composite(glow[t], (tx * 16, ty * 16))
            if kind == "od":
                img.alpha_composite(od[(t + i) % 4], (tx * 16, ty * 16))
            # the renderer's pip
            px = img.load()
            for yy in range(5):
                for xx in range(5):
                    px[tx * 16 + 11 + xx, ty * 16 + yy] = hex2rgba(P["ink"])
            for yy in range(3):
                for xx in range(3):
                    px[tx * 16 + 12 + xx, ty * 16 + 1 + yy] = (0x66, 0xcc, 0x50, 255)
        shots.append(img)
    row = Image.new("RGBA", (W * 16 * 4 + 12, H * 16), hex2rgba(P["ink"]))
    for t, im in enumerate(shots):
        row.alpha_composite(im, (t * (W * 16 + 4), 0))
    row.save(OUT / "mock_modules_1x.png")
    up(row, 4).save(OUT / "mock_modules_4x.png")


def contact():
    """Every new sprite, every frame: a 1x row and a 2x row, labelled, on panel wood."""
    names = ["ui_grade", "fx_fold", "module_od", "ui_audit", "mega_stage1", "ui_research", "research_lab"]
    rows = []
    for name in names:
        fr = frames(name)
        if name == "ui_grade":
            fr = [fr[0], fr[5]]
        rows.append((name, fr))
    gap = 4
    W = max(sum(f.width * 2 + gap for f in fr) for _, fr in rows) + gap
    H = sum(max(f.height for f in fr) * 3 + 20 for _, fr in rows) + gap
    out = Image.new("RGBA", (W, H), hex2rgba(P["shadow"]))
    y = gap
    for name, fr in rows:
        h = max(f.height for f in fr)
        text(out, name + ("  (S and S+)" if name == "ui_grade" else ""), gap, y, P["hull2"])
        y += 10
        x = gap
        for f in fr:
            out.alpha_composite(f, (x, y))
            x += f.width + gap
        y += h + 4
        x = gap
        for f in fr:
            out.alpha_composite(up(f, 2), (x, y))
            x += f.width * 2 + gap
        y += h * 2 + 6
    out.save(OUT.parent / "contact.png")
    up(out, 2).save(OUT / "contact_2x.png")


def main():
    export(fxfold.build(), "fx_fold", 16)
    export(moduleod.build(), "module_od", 8, scale=12)
    mock_modules()
    export(audit.build(), "ui_audit", 4, scale=16)
    export(mega.build(), "mega_stage1", 4, names=mega.NAMES, scale=4)
    export(research_icons.build(), "ui_research", 0, names=research_icons.NAMES, scale=8)
    export(lab.build(), "research_lab", 6, scale=6)
    contact()


if __name__ == "__main__":
    main()
