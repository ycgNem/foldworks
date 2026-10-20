"""Run the Milestone 1-5 hand-drawn recipes (pixel-art/ui, m2, m4, town, ...) in Lantern Bayou.

Those scripts drew every part by hand against palette A's slot names, read from the old
palette.ts; they no longer import. Here they run against a stand-in `common` module (the same
helpers: ellipses, rings, ASCII maps, pixelstudio sprites) whose `P` maps each A slot name to the
B colour chosen *for that piece* (`role`), so a redraw keeps the recipe's shapes, outlines and
poses and gets B's ramps by role, not by nearest colour. Frames come back as PIL images.

    from recipes import shim, load, frames
    shim(role)                       # before loading any recipe
    mod = load(ROOT / "pixel-art/ui/portraits.py")
"""
import math
import sys
import types
from pathlib import Path

from PIL import Image

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
sys.path.insert(0, str(Path.home() / ".claude/skills/pixel-art-studio/scripts"))
from pixelstudio import Sprite, hex2rgba  # noqa: E402

import pal  # noqa: E402

B = pal.B
ART = list(B.values())


def role(**over):
    """palette A's slot names -> B colours: pal.ROLES, then per-piece overrides (A name=B name)."""
    r = dict(pal.ROLES)
    r.update({"slag": B["slag1"], "gold": B["lamp2"], "hot": B["lamp3"], "glow": B["lamp1"]})
    r.update({k: B[v] for k, v in over.items()})
    return r


def _key(P):
    return {
        ".": None, "k": P["ink"], "s": P["shadow"], "b": P["bone"],
        "d": P["ground0"], "W": P["ground1"], "w": P["ground2"],
        "0": P["hull0"], "1": P["hull1"], "2": P["hull2"], "3": P["hull3"],
        "i": P["iron0"], "I": P["iron1"], "J": P["iron2"],
        "c": P["copper0"], "C": P["copper1"], "p": P["copper2"],
        "x": P["slag"], "y": P["brass0"], "Y": P["brass1"], "o": P["glow"], "H": P["hot"],
        "t": P["teal0"], "T": P["teal1"], "m": P["moss"], "l": P["leaf"], "v": P["violet"],
        "g": P["gold"],
    }


def new(w, h, n=1):
    s = Sprite(w, h, palette=ART)
    for _ in range(n - 1):
        s.add_frame(copy=False)
    s.frame(1)
    return s


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


def strip(s):
    im = Image.new("RGBA", (s.w * s.n_frames, s.h), (0, 0, 0, 0))
    for i in range(s.n_frames):
        im.alpha_composite(s.composite(i + 1), (i * s.w, 0))
    return im


def up(im, k):
    return im.resize((im.width * k, im.height * k), Image.NEAREST)


def _unused(*a, **k):
    raise RuntimeError("a recipe's own export is not used: revamp scripts export")


def shim(P):
    """Install the stand-in `common` (and its aliases) for recipes about to be loaded."""
    m = types.ModuleType("common")
    key = _key(P)

    def ascii_(s, x0, y0, rows, key_=None, only=None, **kw):
        k = kw.get("key", key_) or key
        for j, row in enumerate(rows):
            for i, ch in enumerate(row):
                if ch in ". ":
                    continue
                s.px(x0 + i, y0 + j, k[ch], only=only)

    m.P, m.KEY, m.new, m.ascii_, m.ell, m.ring, m.strip, m.up = P, key, new, ascii_, ell, ring, strip, up
    m.hex2rgba, m.ART_PAL = hex2rgba, ART
    m.export = m.sheet = m.frame_of = m.check_palette = m.checker = m.text = m.text_w = m.nine = _unused
    m.OUT, m.ROOT = HERE / "out", ROOT
    for name in ("common", "common_m4", "common_m5", "common_m2"):
        sys.modules[name] = m
    return m


def load(path, name=None, replace=(), inject=None):
    """Execute a recipe file as module `name` (default: its stem) and register it. `replace` is a
    list of (old, new) source edits (each must match), `inject` names put in before it runs."""
    path = Path(path)
    m = types.ModuleType(name or path.stem)
    m.__file__ = str(path)
    m.__dict__.update(inject or {})
    sys.modules[m.__name__] = m
    src = path.read_text(encoding="utf-8")
    for old, new_ in replace:
        assert old in src, (path.name, old)
        src = src.replace(old, new_)
    exec(compile(src, str(path), "exec"), m.__dict__)
    return m


def load_fw(P):
    """pixel-art/world/fw.py (the world art's helpers: bevelled boxes, ASCII blits, lumps) with its
    palette read from `P` (A slot names -> B) instead of the old palette.ts, any B colour allowed."""
    return load(ROOT / "pixel-art" / "world" / "fw.py", "fw", replace=[
        ("P = _read_palette()", "P = {k: v.lower() for k, v in __ROLE__.items()}"),
        ("assert len(P) == 32, len(P)", "pass"),
        ("HEXES = [P[k] for k in P]", "HEXES = [h.lower() for h in __ART__]"),
    ], inject={"__ROLE__": P, "__ART__": ART})


def frames(s):
    return [s.composite(i + 1) for i in range(s.n_frames)]
