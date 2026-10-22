"""Shared helpers for Act IV's art (docs/endgame.md, Milestone 9, "The contract for building
Milestone 9": its file names are shared with the sim agent and used exactly).

The drawing helpers and the palette come from pixel-art/sky/ (common.py: put/rect/outline/export;
pal.py: palette B extended, 69 art colours, pips never), and the skid and grid helpers from
pixel-art/act3/c3.py, loaded by path so the `common`/`pal` modules never collide. No colour is
added: every Act IV sprite is drawn in the 69 (CLAUDE.md asks before the palette changes; snow,
ice, ash and lava all have ramps in it already).

`ship()` writes the strip and sidecar to out/ and src/art/, refuses an off-palette or
semi-transparent pixel, and refuses any src/art name that is not one of Act IV's own (NAMES, plus
the island variants `isle_<world>_*`).
"""
import json
import re
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
SKY = HERE.parent / "sky"
ACT3 = HERE.parent / "act3"
for p in (str(SKY), str(ACT3)):
    if p not in sys.path:
        sys.path.insert(0, p)

from PIL import Image  # noqa: E402

import common as sc  # noqa: E402  (pixel-art/sky/common.py)
from pal import P  # noqa: E402  (pixel-art/sky/pal.py)
import c3  # noqa: E402  (pixel-art/act3/c3.py: skid, seat, grid, box)

new, put, rect, get, outline, scale, on_bg, sheet = sc.new, sc.put, sc.rect, sc.get, sc.outline, sc.scale, sc.on_bg, sc.sheet
recolor, flip, hsh, col, rgb, ART_SET, bayer, vnoise = sc.recolor, sc.flip, sc.hsh, sc.col, sc.rgb, sc.ART_SET, sc.bayer, sc.vnoise
hline, vline, box, clear, grid, stamp, colours, skid, seat = c3.hline, c3.vline, c3.box, c3.clear, c3.grid, c3.stamp, c3.colours, c3.skid, c3.seat
OUT = HERE / "out"
OUT.mkdir(exist_ok=True)
SRC_ART = HERE.parents[1] / "src" / "art"

INK, INK1, INK2 = P["ink"], P["ink1"], P["ink2"]
S0, S1, S2, S3, S4 = (P[f"steel{i}"] for i in range(5))
B0, B1, B2, B3 = (P[f"brass{i}"] for i in range(4))
L0, L1, L2, L3 = (P[f"lamp{i}"] for i in range(4))

WORLDS = ["pebble", "cinder", "rime", "oldworks"]

# every sprite Act IV ships (the only src/art names this folder may write)
NAMES = {"items4", "heater", "vent", "rubble", "ruin_overlay", "frost_overlay",
         "ore_skyglass", "ore_cinderite", "ore_rime", "ore_relic",
         "ore_skyglass_spill", "ore_cinderite_spill", "ore_rime_spill", "ore_relic_spill",
         "world_deck", "world_edge", "world_under", "world_rotor", "world_rotor_side", "world_dock", "world_hopper",
         "world_bay", "mega_lighthouse", "mega_anchor"}
ISLE = re.compile(r"^isle_(pebble|cinder|rime|oldworks)_[a-z_]+$")


def hexrgb(h):
    return rgb(h)


def load(name, src=True):
    """A shipped sheet's frames (row-major) and its sidecar."""
    d = SRC_ART if src else OUT
    img = Image.open(d / f"{name}.png").convert("RGBA")
    meta = json.loads((d / f"{name}.json").read_text())
    fw, fh = meta["frame"]
    cols = img.width // fw
    frames = []
    for i in range(meta["frames"]):
        x, y = (i % cols) * fw, (i // cols) * fh
        frames.append(img.crop((x, y, x + fw, y + fh)))
    return frames, meta


def check(name, img):
    bad = {p[:3] for p in img.getdata() if p[3] and p[:3] not in ART_SET}
    if bad:
        raise ValueError(f"{name}: {len(bad)} colours off the palette, e.g. {list(bad)[:4]}")
    if any(0 < p[3] < 255 for p in img.getdata()):
        raise ValueError(f"{name}: semi-transparent pixels")


def ship(name, frames, fps=0, anchor=(0, 0), extra=None, bg=None, look=6, src=True):
    """One row of equal frames -> out/<name>.png + .json, out/<name>@<look>x.png, and src/art/."""
    img = sheet(frames)
    fw, fh = frames[0].size
    check(name, img)
    meta = {"frame": [fw, fh], "frames": len(frames), "anchor": list(anchor), "fps": fps}
    if extra:
        meta.update(extra)
    dirs = [OUT]
    if src:
        if name not in NAMES and not ISLE.match(name):
            raise ValueError(f"{name} is not one of Act IV's names; src/art/ is not written")
        dirs.append(SRC_ART)
    for d in dirs:
        img.save(d / f"{name}.png")
        (d / f"{name}.json").write_text(json.dumps(meta) + "\n", newline="\n")
    lk = sc.sheet_spaced(frames, bg or P["pave2"])
    scale(lk, look).save(OUT / f"{name}@{look}x.png")
    print(f"  {name}: {len(frames)} x {fw}x{fh}, {colours(img)} colours")
    return img


def remap(img, mapping):
    """Recolour by palette name -> palette name (None clears the pixel)."""
    m = {rgb(P[k]): (rgb(P[v]) + (255,) if v else (0, 0, 0, 0)) for k, v in mapping.items()}
    out = img.copy()
    px = out.load()
    for y in range(out.height):
        for x in range(out.width):
            p = px[x, y]
            if p[3] and p[:3] in m:
                px[x, y] = m[p[:3]]
    return out


def is_(img, x, y, *names):
    p = get(img, x, y)
    return p[3] and any(p[:3] == rgb(P[n]) for n in names)


def name_at(img, x, y):
    p = get(img, x, y)
    if not p[3]:
        return None
    return INV.get(p[:3])


INV = {rgb(v): k for k, v in P.items()}
