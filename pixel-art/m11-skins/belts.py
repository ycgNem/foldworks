"""Belt skins: each ships `belt` and `belt_turn` (the renderer draws belt_turn where a belt turns).

The base belt (16x16, 4 frames, 16 fps, faces east, turned by code): rows 3 and 12 are the
rails (steel3, a steel4 rivet that moves 4 px a frame with the tread), rows 5-10 the tread (ink2
and ink1) with steel1/steel2 chevrons. The turn sheet has the outer rail on its west and south
edges and turns about its north-east corner.

    straightArrow  a ruler painted down the middle: a wood5 strip with ink2 inch ticks that run
                   with the tread (on the turn it follows the curve), the chevrons kept on top
    brassBelt      polished brass rails and rivets, brass chevrons, a lit brass count-stud where
                   each tile begins (every tile counted)
"""
import math

from draw import rm
from m11 import skin

TREAD = ("ink2", "ink1")


def phase(f):
    """Where the moving rivet sits on the north rail this frame (the tread's offset)."""
    for x in range(f.w):
        if f.name(x, 3) == "steel4":
            return x
    return 4 * f.i


def straight_arrow(f):
    ph = phase(f)
    turn = f.meta is not None and f.w == 16 and _is_turn(f)
    if not turn:
        for x in range(f.w):
            for y in (7, 8):
                if f.name(x, y) not in TREAD:
                    continue
                k = (x - ph) % 8
                if y == 7:
                    f.put(x, y, "wood5")
                else:
                    f.put(x, y, "ink2" if k in (0, 4) else "wood4" if k % 2 == 0 else "wood5")
            if f.name(x, 7) in ("wood5",) and (x - ph) % 8 == 0:
                f.put(x, 7, "wood3")
        return
    # the turn: the ruler along a quarter circle about the north-east corner, radius 7.5..8.5
    cx, cy = 16.0, 0.0
    pts = {}
    for k in range(97):
        a = (math.pi / 2) * k / 96                       # 0 at the north edge, pi/2 at the east edge
        x, y = int(cx - 8 * math.cos(a)), int(cy + 8 * math.sin(a))
        pts.setdefault((x, y), a)
    for (x, y), a in pts.items():
        if f.name(x, y) not in TREAD + ("steel1", "steel2"):
            continue
        s = int(a * 12 / (math.pi / 2) + f.i * 3) % 6      # ticks running with the tread
        f.put(x, y, "ink2" if s == 0 else "wood4" if s == 3 else "wood5")


def _is_turn(f):
    return f.meta.get("_turn", False)


def brass(f):
    f.recolour(rm(steel3="brass2", steel4="brass3", steel2="brass1", steel1="brass0"))
    # the count-stud: a lit brass pixel on each rail where the tile begins (it does not move)
    if not _is_turn(f):
        for y in (3, 12):
            if f.name(0, y) in ("brass2", "brass3"):
                f.put(0, y, "lamp2")
    else:
        for x, y in ((3, 0), (15, 13)):
            if f.name(x, y) in ("brass2", "brass3"):
                f.put(x, y, "lamp2")


def build():
    for sid, fn in (("straightArrow", straight_arrow), ("brassBelt", brass)):
        skin(sid, "belt", fn, on_skid=False, pip=False)
        skin(sid, "belt_turn", lambda f, fn=fn: (f.meta.__setitem__("_turn", True), fn(f)), on_skid=False, pip=False,
             )
