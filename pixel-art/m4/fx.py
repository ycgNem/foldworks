"""fx_overdrive (16x16 x4) and fx_overdrive_big (32x32 x4), fps 12: drawn over a machine while
it is overdriven (3x speed for 10 s).

A rounded ring hugging the tile's edge, so the middle stays clear and the machine underneath
reads as usual:
  - the outer ring in `glow` orange, with hot/gold dashes marching clockwise (2 px a frame at
    16, 3 px at 32; the dash period divides the loop, so 4 frames loop seamlessly);
  - an inner ring of copper/glow flecks that flicker (heat shimmer), one px in;
  - flame licks on the top edge that alternate;
  - sparks rising up the two sides (a hot head with a gold tail), offset in phase.
"""
import math
from common_m4 import P, new


def ring_pixels(n, inset, r):
    """Pixels on the boundary of a rounded square inset by `inset`, as a set, ordered by angle
    (clockwise from the top), so a dash pattern can march along it."""
    pts = []
    a0, a1 = inset, n - 1 - inset
    for y in range(a0, a1 + 1):
        for x in range(a0, a1 + 1):
            # distance outside the inner rounded rect
            cx = min(max(x, a0 + r), a1 - r)
            cy = min(max(y, a0 + r), a1 - r)
            d = math.hypot(x - cx, y - cy)
            on_edge = (x in (a0, a1) or y in (a0, a1)) if d == 0 else (r - 0.5 <= d <= r + 0.5)
            if d <= r + 0.5 and on_edge:
                pts.append((x, y))
    c = (n - 1) / 2
    pts.sort(key=lambda p: math.atan2(p[0] - c, -(p[1] - c)) % math.tau)
    return pts


def draw(s, f, n):
    big = n == 32
    glow, hot, gold, c1, c0, b1 = P["glow"], P["hot"], P["gold"], P["copper1"], P["copper0"], P["brass1"]
    outer = ring_pixels(n, 0, 3 if big else 2)
    dashes = 10 if big else 7              # whole dashes round the loop: seamless at any length
    L = len(outer)
    for i, (x, y) in enumerate(outer):
        ph = (i * dashes / L - f / 4) % 1.0      # 0..1 along one dash period, marching clockwise
        col = hot if ph < 0.13 else (gold if ph < (0.27 if big else 0.25) else glow)
        s.px(x, y, col)
    inner = ring_pixels(n, 1, 2 if big else 1)
    for i, (x, y) in enumerate(inner):
        h = (i * 7 + f * 5) % 6
        if big:
            if h < 3:
                s.px(x, y, c1 if h else glow)
        else:
            if h < 2:
                s.px(x, y, c1 if h else glow)
    if big:
        inner2 = ring_pixels(n, 2, 1)
        for i, (x, y) in enumerate(inner2):
            if (i * 5 + f * 3) % 9 == 0:
                s.px(x, y, c0 if (i + f) % 2 else c1)
    # flame licks along the top edge (they lick down into the tile: the sprite cannot grow)
    licks = [(4, 10), (7, 13)] if not big else [(6, 12, 19, 25), (9, 15, 22, 28)]
    for x in licks[f % 2]:
        s.px(x, 1, hot)
        s.px(x, 2 if big else 1, gold if big else hot)
        if big:
            s.px(x - 1, 2, glow)
            s.px(x, 3, glow)
    # sparks rising up both sides
    if big:
        lanes = [(3, 0), (28, 2), (5, 1), (26, 3)]
        span = 24
    else:
        lanes = [(2, 0), (13, 2)]
        span = 12
    for (x, ph) in lanes:
        t = (f + ph) % 4
        y = (n - 3) - (t * span) // 4 - (2 if big else 1)
        s.px(x, y, hot)
        s.px(x, y + 1, gold)
        if big:
            s.px(x, y + 2, glow)


def build(n):
    s = new(n, n, 4)
    for f in range(4):
        s.frame(f + 1)
        draw(s, f, n)
    s.frame(1)
    return s
