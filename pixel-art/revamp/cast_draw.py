"""Unit 7's and Dame Voltaire's portraits and cheers, redrawn in Lantern Bayou from their own
hand-drawn recipes (pixel-art/ui/portraits.py, pixel-art/m4/cheers.py: every part, outline and
pose stays theirs), with the palette fitted to B by role, not by nearest colour:

- Voltaire's skin goes back to what it was drawn as, a peach light over terracotta (A's copper2 is
  B's copper3, A's copper1 is between B's copper1 and copper2), so she is not orange;
- Unit 7's steel uses B's five-step steel ramp, its screen the deep iron blue, the lens teal.

Those recipes read the old palette module, so this script runs them against a stand-in `common`
module (the same helpers, B colours) and writes their frames to raw/cast/ for portraits.py to
finish (the lantern rim light, the blink, the small versions) and export.
Run from this folder: python cast_draw.py"""
import math
import sys
import types
from pathlib import Path

from PIL import Image

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
sys.path.insert(0, str(Path.home() / ".claude/skills/pixel-art-studio/scripts"))
from pixelstudio import Sprite  # noqa: E402

import pal  # noqa: E402

B = pal.B
# palette A's slot names -> the B colour each plays in these portraits
ROLE = dict(pal.ROLES)
ROLE.update({
    "copper0": B["copper1"], "copper1": B["copper2"], "copper2": B["copper3"],   # skin, peach
    "slag": B["slag1"], "gold": B["lamp2"], "hot": B["lamp3"], "glow": B["lamp1"],
})
ART = list(B.values())
KEY = {
    ".": None, "k": ROLE["ink"], "s": ROLE["shadow"], "b": ROLE["bone"],
    "d": ROLE["ground0"], "W": ROLE["ground1"], "w": ROLE["ground2"],
    "0": ROLE["hull0"], "1": ROLE["hull1"], "2": ROLE["hull2"], "3": ROLE["hull3"],
    "i": ROLE["iron0"], "I": ROLE["iron1"], "J": ROLE["iron2"],
    "c": ROLE["copper0"], "C": ROLE["copper1"], "p": ROLE["copper2"],
    "x": ROLE["slag"], "y": ROLE["brass0"], "Y": ROLE["brass1"], "o": ROLE["glow"], "H": ROLE["hot"],
    "t": ROLE["teal0"], "T": ROLE["teal1"], "m": ROLE["moss"], "l": ROLE["leaf"], "v": ROLE["violet"],
    "g": ROLE["gold"],
}


def new(w, h, n=1):
    s = Sprite(w, h, palette=ART)
    for _ in range(n - 1):
        s.add_frame(copy=False)
    s.frame(1)
    return s


def ascii_(s, x0, y0, rows, key=None, only=None):
    key = key or KEY
    for j, row in enumerate(rows):
        for i, ch in enumerate(row):
            if ch in ". ":
                continue
            s.px(x0 + i, y0 + j, key[ch], only=only)


def ell(s, cx, cy, rx, ry, color, only=None):
    for y in range(int(cy - ry) - 1, int(cy + ry) + 2):
        for x in range(int(cx - rx) - 1, int(cx + rx) + 2):
            dx = (x + 0.5 - cx) / max(rx, 0.01)
            dy = (y + 0.5 - cy) / max(ry, 0.01)
            if dx * dx + dy * dy <= 1.0:
                s.px(x, y, color, only=only)


def ring(s, cx, cy, r0, r1, color, only=None):
    for y in range(int(cy - r1) - 1, int(cy + r1) + 2):
        for x in range(int(cx - r1) - 1, int(cx + r1) + 2):
            d = math.hypot(x + 0.5 - cx, y + 0.5 - cy)
            if r0 < d <= r1:
                s.px(x, y, color, only=only)


def _unused(*a, **k):
    raise RuntimeError("not used here")


shim = types.ModuleType("common")
shim.P, shim.KEY, shim.new, shim.ascii_, shim.ell, shim.ring = ROLE, KEY, new, ascii_, ell, ring
shim.export = shim.sheet = shim.up = shim.frame_of = _unused
shim.OUT = HERE / "out"
sys.modules["common"] = shim
sys.modules["common_m4"] = shim


def load(path):
    g = {"__name__": "old_" + path.stem, "__file__": str(path)}
    exec(compile(path.read_text(encoding="utf-8"), str(path), "exec"), g)
    return g


def frames(s):
    return [s.composite(i + 1) for i in range(s.n_frames)]


def main():
    out = HERE / "raw" / "cast"
    out.mkdir(parents=True, exist_ok=True)
    por = load(ROOT / "pixel-art" / "ui" / "portraits.py")
    che = load(ROOT / "pixel-art" / "m4" / "cheers.py")
    for who in ("unit7", "voltaire"):
        s = new(48, 48, 2)
        for f in range(2):
            s.frame(f + 1)
            por[who](s, blink=(f == 1))
        for i, im in enumerate(frames(s)):
            im.save(out / f"{who}_{i}.png")
        cs = che["build"](che[f"{who}_cheer"])
        for i, im in enumerate(frames(cs)):
            im.save(out / f"{who}_cheer_{i}.png")
    print("cast frames ->", out)


if __name__ == "__main__":
    main()
