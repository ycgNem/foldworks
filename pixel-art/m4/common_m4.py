"""Shared hand for the Milestone 4 (Act II) art (pixel-art/m4/).

Reuses, read-only, the world art's drawing helpers (pixel-art/world/fw.py: bevelled boxes, ASCII
blits, discs, the palette read from src/data/palette.ts) and the UI art's (pixel-art/ui/common.py:
symmetric ellipses, rings, the parts-on-layers outline recipe's palette keys). Its own export
writes src/art/<name>.png + .json with the same contract and the same check as every other
export: opaque or clear pixels, art colours only (no pip colours).
"""
import sys
import json
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
sys.path.insert(0, str(ROOT / "pixel-art" / "world"))
sys.path.insert(0, str(ROOT / "pixel-art" / "ui"))

import fw  # noqa: E402
from common import (P, KEY, ART_PAL, new, ell, ring, ascii_, strip, check_palette, checker, up,  # noqa: E402,F401
                    frame_of, hex2rgba, text, text_w, nine)
from PIL import Image  # noqa: E402

ART = ROOT / "src" / "art"
OUT = HERE / "out"
OUT.mkdir(parents=True, exist_ok=True)

REPORT = {}


def export(s, name, fps=0, names=None, scale=8):
    im = strip(s)
    ncol = check_palette(im, name)
    im.save(ART / f"{name}.png")
    meta = {"frame": [s.w, s.h], "frames": s.n_frames, "anchor": [0, 0], "fps": fps}
    if names:
        assert len(names) == s.n_frames
        meta["names"] = list(names)
    (ART / f"{name}.json").write_text(json.dumps(meta) + "\n", encoding="utf-8")
    bg = checker(im.width, im.height, sq=4)
    bg.alpha_composite(im)
    bg.save(OUT / f"{name}_1x.png")
    big = checker(im.width * scale + (s.n_frames - 1) * scale, im.height * scale, sq=scale * 2)
    for i in range(s.n_frames):
        big.alpha_composite(up(s.composite(i + 1), scale), (i * (s.w * scale + scale), 0))
    big.save(OUT / f"{name}_{scale}x.png")
    REPORT[name] = {"frame": [s.w, s.h], "frames": s.n_frames, "colours": ncol, "fps": fps,
                    **({"names": list(names)} if names else {})}
    (OUT / "report.json").write_text(json.dumps(REPORT, indent=1), encoding="utf-8")
    print(f"{name}: {s.w}x{s.h} x{s.n_frames}  colours {ncol}")
    return im


def load(name):
    im = Image.open(ART / f"{name}.png").convert("RGBA")
    meta = json.loads((ART / f"{name}.json").read_text(encoding="utf-8"))
    return im, meta


def frames(name):
    im, meta = load(name)
    w, h = meta["frame"]
    return [im.crop((i * w, 0, (i + 1) * w, h)) for i in range(meta["frames"])]
