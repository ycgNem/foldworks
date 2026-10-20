"""Shared hand for the Milestone 2 art (pixel-art/m2/).

Reuses the UI art's helpers read-only (palette from src/data/palette.ts, the symmetric ellipse,
the 9-slice tile renderer and the game's bitmap font) but keeps its own export so nothing in
pixel-art/ui/out is rewritten. Every export goes through the same palette check: opaque or fully
clear pixels, art colours only (no pip colours).
"""
import sys
import json
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
sys.path.insert(0, str(ROOT / "pixel-art" / "ui"))

from common import (P, KEY, ART_PAL, new, ell, ring, ascii_, strip, check_palette, checker, up,  # noqa: E402,F401
                    nine, text, text_w, frame_of, ICONCH, hex2rgba, Sprite)
from PIL import Image  # noqa: E402

ART = ROOT / "src" / "art"
OUT = HERE / "out"
OUT.mkdir(parents=True, exist_ok=True)

REPORT = {}


def export(s, name, fps=0, slice_=None, scale=8, extra=None):
    """src/art/<name>.png (1x strip) + .json, and out/<name>_1x.png / _<scale>x.png previews."""
    im = strip(s)
    ncol = check_palette(im, name)
    im.save(ART / f"{name}.png")
    meta = {"frame": [s.w, s.h], "frames": s.n_frames, "anchor": [0, 0], "fps": fps}
    if slice_ is not None:
        meta["slice"] = list(slice_)
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
                    **({"slice": list(slice_)} if slice_ else {})}
    (OUT / "report.json").write_text(json.dumps(REPORT, indent=1), encoding="utf-8")
    print(f"{name}: {s.w}x{s.h} x{s.n_frames}  colours {ncol}" + (f"  slice {slice_}" if slice_ else ""))
    return im


def load(name):
    """An existing src/art sprite: (strip image, meta)."""
    im = Image.open(ART / f"{name}.png").convert("RGBA")
    meta = json.loads((ART / f"{name}.json").read_text(encoding="utf-8"))
    return im, meta


def fr(name, i=0):
    im, meta = load(name)
    w, h = meta["frame"]
    return im.crop((i * w, 0, (i + 1) * w, h))


def bring(s, x0, y0, x1, y1, tl, br, tr=None, bl=None):
    """One 1-px ring: top/left in tl, bottom/right in br, off-light corners tr/bl."""
    s.line(x0, y0, x1 - 1, y0, tl)
    s.line(x0, y0, x0, y1 - 1, tl)
    s.line(x0 + 1, y1, x1, y1, br)
    s.line(x1, y0 + 1, x1, y1, br)
    s.px(x1, y0, tr or tl)
    s.px(x0, y1, bl or tl)
