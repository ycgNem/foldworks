"""Foldworks world sprites (the slice set, then Act II).

    python build.py            # regenerates src/art/<name>.png + .json and everything in out/

Every pixel is placed by the drawing functions in tiles.py, items.py, machines.py,
buildings.py and act2.py; this script exports them, checks every pixel against the game
palette (src/data/palette.ts, pip colours excluded), and renders the previews and the contact
sheet used in the critique loops. Never hand-edit an exported PNG: edit the script and rerun.
"""
import json
import sys
from fw import OUT, HERE, EXPORTED, REPORT, frames_of, up, Image, P, hex2rgba
import tiles
import items
import machines
import buildings
import scene
import act2

ONLY = set(sys.argv[1:])


def bg_tile(kind):
    if kind == "floor":
        return frames_of(EXPORTED["tile_floor"][0])[0]
    if kind == "factory":
        return frames_of(EXPORTED["tile_factory"][0])[0]
    if kind == "belt":
        return frames_of(EXPORTED["belt"][0])[0]
    if kind == "ore":
        return frames_of(EXPORTED["tile_ore_iron"][0])[0]
    return None


def tiled(kind, w, h):
    t = bg_tile(kind)
    im = Image.new("RGBA", (w, h), (40, 40, 44, 255))
    if t is None:
        return im
    for y in range(0, h, t.height):
        for x in range(0, w, t.width):
            im.alpha_composite(t, (x, y))
    return im


def previews():
    for name, (spr, bgk) in EXPORTED.items():
        fr = frames_of(spr)
        w, h = fr[0].size
        if name.startswith("items"):
            # each icon on a belt tile (where the player sees it) and on the dark UI
            row = Image.new("RGBA", (len(fr) * 20, 40), hex2rgba(P["ground0"]))
            belt0 = bg_tile("belt")
            for i, im in enumerate(fr):
                b = belt0.copy()
                b.alpha_composite(im, (4, 4))
                row.alpha_composite(b, (i * 20, 0))
                row.alpha_composite(im, (i * 20 + 4, 26))
            up(row, 8).save(OUT / ("%s_8x.png" % name))
            up(row, 1).save(OUT / ("%s_1x.png" % name))
            continue
        gap = 2
        row = tiled(bgk, len(fr) * (w + gap), h)
        for i, im in enumerate(fr):
            row.alpha_composite(im, (i * (w + gap), 0))
        up(row, 8).save(OUT / ("%s_8x.png" % name))


def main():
    OUT.mkdir(exist_ok=True)
    tiles.build()
    items.build()
    machines.build()
    buildings.build()
    act2.build()
    previews()
    scene.build()
    with open(OUT / "report.json", "w") as fh:
        json.dump(REPORT, fh, indent=1)
    for n, r in REPORT.items():
        print("%-18s %2dx%-2d frames %d fps %2d colours %d" % (n, r["size"][0], r["size"][1], r["frames"], r["fps"], r["colours"]))


if __name__ == "__main__":
    main()
