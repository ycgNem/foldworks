"""module_od (16x16 x4, fps 8, loops): an overdriven Factory module, drawn over src/art/module.png.

Same family as fx_overdrive (a ring of marching hot dashes, a heat flicker one pixel in, flame
licks, rising sparks) but shaped to the module and hotter-redder, so it says "this brass box is
running hot" rather than "a machine with a ring on it":
  - the marching dashes run along the brass frame's outer band (the module's own bright bevel),
    copper-red with glow bodies and hot heads, covering about half the band, so brass still
    shows between them;
  - heat flecks (copper0/copper1/glow) flicker on the inner band;
  - two flame licks rise from the top edge into the ink outline, alternating;
  - a spark climbs each side.
Kept clear on purpose: the icon well and its ink rim (x, y 3..12), so the output icon reads,
and the top-right 5x5 where the renderer draws the status pip.
"""
import sys
from pathlib import Path
from common_m5 import P, new, frames, ROOT

sys.path.insert(0, str(ROOT / "pixel-art" / "m4"))
from fx import ring_pixels  # noqa: E402

MOD = frames("module")[0]


def on_module(x, y):
    return 0 <= x < 16 and 0 <= y < 16 and MOD.getpixel((x, y))[3] > 0


def free(x, y):
    """Pixels the overlay may touch: on the module, outside the well, away from the pip."""
    if 3 <= x <= 12 and 3 <= y <= 12:
        return False
    if x >= 11 and y <= 4:
        return False
    return True


def draw(s, f):
    glow, hot, gold = P["glow"], P["hot"], P["gold"]
    c0, c1 = P["copper0"], P["copper1"]

    def put(x, y, col):
        if free(x, y) and (on_module(x, y) or y < 0):
            s.px(x, y, col)

    band = [p for p in ring_pixels(16, 1, 1) if on_module(*p)]
    L = len(band)
    dashes = 6
    for i, (x, y) in enumerate(band):
        ph = (i * dashes / L - f / 4) % 1.0           # marching clockwise, seamless over 4 frames
        if ph < 0.12:
            put(x, y, hot)
        elif ph < 0.30:
            put(x, y, glow)
        elif ph < 0.46:
            put(x, y, c1)
    inner = [p for p in ring_pixels(16, 2, 0) if on_module(*p)]
    for i, (x, y) in enumerate(inner):
        h = (i * 7 + f * 5) % 9
        if h == 0:
            put(x, y, glow)
        elif h == 1:
            put(x, y, c1)
        elif h == 2 and (x + y) % 2:
            put(x, y, c0)
    # flame licks from the top edge, two places, alternating
    for x in ((3, 8), (5, 10))[f % 2]:
        put(x, 0, glow)
        put(x, 1, hot)
        put(x - 1, 1, glow)
    # sparks climbing the sides (left lane x=0..1, right lane x=14..15 below the pip)
    for (x, ph, top) in ((1, 0, 2), (14, 2, 6)):
        t = (f + ph) % 4
        y = 13 - t * (13 - top) // 3
        put(x, y, hot)
        put(x, y + 1, glow)


def build():
    s = new(16, 16, 4)
    for f in range(4):
        s.frame(f + 1)
        draw(s, f)
    s.frame(1)
    return s
