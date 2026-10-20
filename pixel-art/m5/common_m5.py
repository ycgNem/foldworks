"""Shared hand for the juice round's art (pixel-art/m5/): the Milestone 4 helpers (common_m4,
which itself reuses pixel-art/world/fw.py and pixel-art/ui/common.py) plus a contact sheet and
a scaled-overlay mock. Exports go through common_m4.export: 1x strip + JSON sidecar in src/art/,
palette-checked (art colours only, no pip colours, no semi-transparent pixels)."""
import sys
import json
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
sys.path.insert(0, str(ROOT / "pixel-art" / "m4"))

import common_m4 as _m4  # noqa: E402
from common_m4 import P, new, ell, ring, ascii_, fw, frames, up, hex2rgba, text, checker, Image, ART  # noqa: E402,F401
from common import strip, check_palette  # noqa: E402

OUT = HERE / "out"
OUT.mkdir(parents=True, exist_ok=True)
REPORT = {}


def export(s, name, fps=0, names=None, scale=8, anchor=(0, 0), extra=None):
    """Like common_m4.export, with an anchor and extra keys, previews written to m5/out."""
    im = strip(s)
    ncol = check_palette(im, name)
    im.save(ART / f"{name}.png")
    meta = {"frame": [s.w, s.h], "frames": s.n_frames, "anchor": list(anchor), "fps": fps}
    if names:
        assert len(names) == s.n_frames, (name, len(names), s.n_frames)
        meta["names"] = list(names)
    if extra:
        meta.update(extra)
    (ART / f"{name}.json").write_text(json.dumps(meta) + "\n", encoding="utf-8")
    bg = checker(im.width, im.height, sq=4)
    bg.alpha_composite(im)
    bg.save(OUT / f"{name}_1x.png")
    big = checker(im.width * scale + (s.n_frames - 1) * scale, im.height * scale, sq=scale * 2)
    for i in range(s.n_frames):
        big.alpha_composite(up(s.composite(i + 1), scale), (i * (s.w * scale + scale), 0))
    big.save(OUT / f"{name}_{scale}x.png")
    REPORT[name] = {"frame": [s.w, s.h], "frames": s.n_frames, "colours": ncol, "fps": fps,
                    "anchor": list(anchor), **({"names": list(names)} if names else {})}
    (OUT / "report.json").write_text(json.dumps(REPORT, indent=1), encoding="utf-8")
    print(f"{name}: {s.w}x{s.h} x{s.n_frames}  fps {fps}  colours {ncol}")
    return im
