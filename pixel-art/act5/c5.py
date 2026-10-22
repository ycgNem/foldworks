"""Shared helpers for Act V's art (docs/endgame.md, Milestone 10, "The contract for building
Milestone 10": its file names are shared with the sim agent and used exactly).

Everything comes from pixel-art/act4/c4.py (which loads pixel-art/sky/ common.py and pal.py, and
pixel-art/act3/c3.py: put/rect/outline/grid/skid/seat), loaded by path so the `common`/`pal`
modules never collide. No colour is added: every Act V sprite is drawn in palette B extended's 69
art colours (CLAUDE.md asks before the palette changes; the night, the stars and the glow all
have ramps in it already: ink, slag, violet, iron, steel, lamp, cloud, sun).

`ship()` writes the strip and sidecar to out/ and src/art/, refuses an off-palette or
semi-transparent pixel, and refuses any src/art name that is not one of Act V's own (NAMES, plus
the Endless Ledger's machine skins `skin_<skin>_<machine>`).
"""
import json
import re
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
ACT4 = HERE.parent / "act4"
if str(ACT4) not in sys.path:
    sys.path.insert(0, str(ACT4))

import c4  # noqa: E402  (puts pixel-art/sky and pixel-art/act3 on the path)
from c4 import (ART_SET, B0, B1, B2, B3, INK, INK1, INK2, L0, L1, L2, L3, P, S0, S1, S2, S3, S4, bayer, box, clear,  # noqa: E402,F401
                col, colours, flip, get, grid, hline, hsh, load, new, on_bg, outline, put, rect, remap, rgb, scale,
                seat, sheet, skid, stamp, vline, vnoise)
import common as sc  # noqa: E402

OUT = HERE / "out"
OUT.mkdir(exist_ok=True)
SRC_ART = c4.SRC_ART

NAMES = {"seed", "items5", "beyond_deck", "beyond_edge", "beyond_under", "beyond_rotor", "beyond_rotor_side",
         "beyond_module", "beyond_dock", "beyond_hopper", "beyond_bay", "courier", "lastfold"}
SKIN = re.compile(r"^skin_[a-z]+_[a-z0-9_]+$")
INV = {rgb(v): k for k, v in P.items()}


def check(name, img):
    bad = {p[:3] for p in img.getdata() if p[3] and p[:3] not in ART_SET}
    if bad:
        raise ValueError(f"{name}: {len(bad)} colours off the palette, e.g. {list(bad)[:4]}")
    if any(0 < p[3] < 255 for p in img.getdata()):
        raise ValueError(f"{name}: semi-transparent pixels")


def ship(name, frames, fps=0, anchor=(0, 0), extra=None, bg=None, look=6, rows=None, src=True):
    """frames: one row of equal frames, or `rows` (facings, a list of lists, one row each).
    Writes out/<name>.png + .json, out/<name>@<look>x.png, and the same pair to src/art/."""
    if rows:
        fw, fh = rows[0][0].size
        n = max(len(r) for r in rows)
        img = new(fw * n, fh * len(rows))
        for j, r in enumerate(rows):
            for i, f in enumerate(r):
                img.alpha_composite(f, (i * fw, j * fh))
        count = sum(len(r) for r in rows)
        flat = [f for r in rows for f in r]
    else:
        img = sheet(frames)
        fw, fh = frames[0].size
        count = len(frames)
        flat = frames
    check(name, img)
    meta = {"frame": [fw, fh], "frames": count, "anchor": list(anchor), "fps": fps}
    if extra:
        meta.update(extra)
    dirs = [OUT]
    if src:
        if name not in NAMES and not SKIN.match(name):
            raise ValueError(f"{name} is not one of Act V's names; src/art/ is not written")
        dirs.append(SRC_ART)
    for d in dirs:
        img.save(d / f"{name}.png")
        (d / f"{name}.json").write_text(json.dumps(meta) + "\n", newline="\n")
    if rows:
        lk = on_bg(img, bg or P["pave2"])
    else:
        lk = sc.sheet_spaced(flat, bg or P["pave2"])
    scale(lk, look).save(OUT / f"{name}@{look}x.png")
    print(f"  {name}: {count} x {fw}x{fh}, {colours(img)} colours")
    return img


def frames_of(name, row=None):
    """A shipped sheet's frames (row-major), from src/art."""
    f, _ = load(name)
    return f


def save_look(name, img, k=4):
    img.save(OUT / f"{name}@1x.png")
    scale(img, k).save(OUT / f"{name}@{k}x.png")


def disc_px(cx, cy, r):
    """Pixels of a filled disc (centre may be fractional)."""
    pts = []
    for y in range(int(cy - r) - 1, int(cy + r) + 2):
        for x in range(int(cx - r) - 1, int(cx + r) + 2):
            if (x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2 <= r * r:
                pts.append((x, y))
    return pts
