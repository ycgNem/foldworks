"""ui_audit (12x12 x4, fps 4): the audit badge's stopwatch, ticking a quarter turn a frame.

Silhouette first: a round body with a crown on top and a side button, which nothing else in the
UI has. A 7x7 bone face in a brass rim (gold lit top-left, brass0 bottom-right), the ink hand
stepping 12, 3, 6, 9 o'clock, and the elapsed sweep filling in copper2 behind it (a full face on frame 3, cleared on frame 0), so even a
still frame says "time is being measured". The crown is pressed down a pixel on frame 0, the
moment the audit starts each loop.
"""
import math
from common_m5 import P, new

k, bone, gold, hot = P["ink"], P["bone"], P["gold"], P["hot"]
b0, b1, h2, h3, c1, c2 = P["brass0"], P["brass1"], P["hull2"], P["hull3"], P["copper1"], P["copper2"]
CX, CY = 5, 6


def ring4(pts):
    out = set()
    for (x, y) in pts:
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            if (x + dx, y + dy) not in pts:
                out.add((x + dx, y + dy))
    return out


FACE = {(x, y) for y in range(3, 10) for x in range(2, 9)} - {(2, 3), (8, 3), (2, 9), (8, 9)}
RIM = (ring4(FACE) | {(2, 3), (8, 3), (2, 9), (8, 9)}) - FACE
EDGE = ring4(FACE | RIM)


def draw(s, f):
    press = 1 if f == 0 else 0
    # the crown on top (pressed flat on frame 0) and the side button at one o'clock
    if press:
        s.px(5, 0, k)
    else:
        s.px(4, 0, k); s.px(5, 0, h3); s.px(6, 0, k)
    for (x, y) in ((9, 1), (10, 1), (10, 2)):
        s.px(x, y, k)
    s.px(9, 2, c1)
    for (x, y) in EDGE:
        if 0 <= x < 12 and 0 <= y < 12:
            s.px(x, y, k)
    for (x, y) in RIM:
        lit = (x - CX) + (y - CY) < -1
        dark = (x - CX) + (y - CY) > 1
        s.px(x, y, gold if lit else (b0 if dark else b1))
    s.px(3, 2, hot)                                            # a glint on the rim
    # the face: the elapsed sweep in copper2, clockwise from 12 o'clock
    end = (f + 1) * 90
    for (x, y) in FACE:
        a = math.degrees(math.atan2(x - CX, -(y - CY))) % 360
        swept = (x, y) != (CX, CY) and (0 < a <= end or (x == CX and y < CY))
        s.px(x, y, c2 if swept else bone)
    # the hand, 3 px, and its hub
    dx, dy = ((1, 0), (0, 1), (-1, 0), (0, -1))[f]       # the hand leads the sweep
    for i in range(1, 4):
        s.px(CX + dx * i, CY + dy * i, k)
    s.px(CX, CY, b0)


def build():
    s = new(12, 12, 4)
    for f in range(4):
        s.frame(f + 1)
        draw(s, f)
    s.frame(1)
    return s
