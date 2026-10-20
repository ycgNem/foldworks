"""research_lab (64x48 x4, fps 6, loops): a picture for the research card's empty lower half.

Bramble's swamp laboratory at night, lit by the research tree's teal:
  - the back wall in shadow with a teal halo behind the big flask, a blueprint of a gear pinned
    up on the left, a shelf of jars on the right;
  - the bench: warm wood (ground1/2) with a dark front;
  - a big round flask of teal brew on a brass tripod over a burner (the flame flickers), bubbles
    rising through it, a puff of vapour leaving the neck;
  - a copper coil from its neck to a small flask of leaf-green brew (a drip falls into it);
  - an iron ingot, a gear and an open notebook on the bench: this is industrial science.
Every motion loops in 4 frames: bubbles climb 3 px a frame over a 12 px column, the drip falls
in 4 steps, the flame alternates, the vapour puff rises and thins.
"""
import math
from common_m5 import P, new, fw

c = fw.c
W, H = 64, 48


def px(s, x, y, slot):
    if 0 <= x < W and 0 <= y < H:
        s.px(x, y, c(slot))


def disc(cx, cy, r):
    return {(x, y) for y in range(int(cy - r) - 1, int(cy + r) + 2) for x in range(int(cx - r) - 1, int(cx + r) + 2)
            if (x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2 <= r * r}


def wall(s):
    for y in range(H):
        for x in range(W):
            px(s, x, y, "shadow")
    for y in range(0, 2):
        for x in range(W):
            px(s, x, y, "ink")
    # wall planks: faint seams
    for x in (10, 27, 44, 58):
        for y in range(2, 34):
            px(s, x, y, "ink" if y % 7 else "shadow")
    # a cool halo behind the flask: a solid iron0 disc with a one-step dithered edge
    for (x, y) in disc(22, 21, 14):
        d = math.hypot(x + 0.5 - 22, y + 0.5 - 21)
        if d < 11.5 or (x + y) % 2 == 0:
            if y >= 2:
                px(s, x, y, "iron0")


def blueprint(s):
    fw.box(s, 2, 5, 15, 17, "iron0", "iron1", "iron0", chamfer=0)
    for (x, y) in disc(8.5, 11.5, 3.6) - disc(8.5, 11.5, 2.4):
        px(s, x, y, "iron2")
    for (x, y) in ((8, 7), (8, 15), (4, 11), (12, 11), (5, 8), (11, 8), (5, 14), (11, 14)):
        px(s, x, y, "iron2")
    s.line(3, 16, 14, 16, c("iron1"))
    px(s, 8, 5, "copper1"); px(s, 8, 4, "ink")                 # the pin


def shelf(s):
    s.rect(44, 12, 62, 13, c("ink"))
    s.line(44, 12, 62, 12, c("ground2"))
    for (x0, h, liq) in ((46, 5, "violet"), (51, 7, "copper1"), (56, 4, "leaf"), (60, 6, "teal1")):
        s.rect(x0 - 1, 12 - h - 1, x0 + 2, 11, c("ink"))
        s.rect(x0, 12 - h, x0 + 1, 11, c("iron2"))
        s.rect(x0, 12 - h // 2, x0 + 1, 11, c(liq))
        px(s, x0, 12 - h, "bone")
        s.rect(x0, 12 - h - 1, x0 + 1, 12 - h - 1, c("ground2"))


def bench(s):
    s.rect(0, 34, 63, 47, c("ink"))
    s.rect(0, 35, 63, 37, c("ground2"))
    s.line(0, 35, 63, 35, c("copper2"))
    s.rect(0, 38, 63, 47, c("ground0"))
    s.line(0, 38, 63, 38, c("ink"))
    for x in (6, 30, 55):                                    # drawer fronts
        s.rect(x, 40, x + 7, 45, c("ground1"))
        s.line(x, 45, x + 7, 45, c("ink"))
        px(s, x + 3, 42, "brass1"); px(s, x + 4, 42, "brass1")
    for (x, y) in ((14, 36), (40, 36), (50, 37), (22, 37)):
        px(s, x, y, "ground1")


def burner(s, f):
    # the tripod (brass) and a little burner
    for (x0, x1) in ((14, 17), (30, 27)):
        s.line(x0, 34, x1, 30, c("brass0"))
    s.line(15, 30, 29, 30, c("brass1"))
    s.rect(19, 33, 25, 34, c("ink"))
    s.line(20, 33, 24, 33, c("hull2"))
    # the flame, between the tripod ring and the burner
    fl = [["..z..", ".zxz.", ".xox."], [".z.z.", "..zx.", ".xxo."]][f % 2]
    fw.blit(s, 20, 30, fl, key={"o": "copper1"})


def flask(s, f):
    """The big round-bottom flask: bulb centred (22, 22), neck up to y 8, teal brew."""
    bulb = disc(22, 22, 7.6)
    neck = {(x, y) for x in range(20, 24) for y in range(8, 16)}
    glass = bulb | neck
    for (x, y) in fw.ring_of(glass):
        if (x, y) not in glass:
            px(s, x, y, "ink")
    for (x, y) in glass:
        px(s, x, y, "teal0" if (x, y) in neck else "teal0")
    # the brew: lower part of the bulb
    for (x, y) in bulb:
        if y >= 20:
            px(s, x, y, "teal1" if y > 20 else "hot")         # meniscus catches the light
    for (x, y) in bulb:
        d = math.hypot(x + 0.5 - 22, y + 0.5 - 22)
        if y > 20 and d > 6.2 and x > 22:
            px(s, x, y, "teal0")                              # shade on the brew's right
    # glass highlights (top-left)
    for (x, y) in ((17, 18), (17, 19), (18, 17), (16, 21), (20, 10), (20, 11), (20, 12)):
        px(s, x, y, "bone")
    px(s, 19, 16, "iron2")
    # the cork
    s.rect(19, 6, 24, 8, c("ink"))
    s.rect(20, 7, 23, 7, c("ground2"))
    px(s, 20, 7, "copper2")
    # bubbles: three lanes, climbing 3 px a frame from y 28 to the surface at 21
    for (x, ph) in ((19, 0), (22, 2), (25, 1)):
        y = 28 - ((f + ph) % 4) * 2
        if y > 20:
            px(s, x, y, "bone")
            if (f + ph) % 4 == 0:
                px(s, x + 1, y, "iron2")
    # a bubble bursting at the surface
    px(s, 21 + (f % 2) * 3, 20, "bone")


def vapour(s, f):
    puffs = [((21, 4), (22, 4), (22, 3)), ((22, 3), (23, 3), (23, 2), (21, 2)), ((23, 2), (24, 2), (24, 1)),
             ((25, 1), (24, 0))][f]
    for i, (x, y) in enumerate(puffs):
        px(s, x, y, "hull3" if i == 0 else "hull2")


def coil(s):
    """Copper tube from the flask's neck over to the small flask, coiling once."""
    path = [(24, 9), (27, 9), (30, 10), (32, 12), (33, 15), (32, 18), (30, 19), (31, 21), (34, 21),
            (36, 19), (37, 16), (39, 14), (42, 14), (45, 16), (46, 20), (46, 24)]
    pts = []
    for (x0, y0), (x1, y1) in zip(path, path[1:]):
        n = max(abs(x1 - x0), abs(y1 - y0))
        for i in range(n + 1):
            pts.append((round(x0 + (x1 - x0) * i / n), round(y0 + (y1 - y0) * i / n)))
    pts = list(dict.fromkeys(pts))
    for (x, y) in fw.ring_of(set(pts)):
        if (x, y) not in pts:
            px(s, x, y, "ink")
    for i, (x, y) in enumerate(pts):
        px(s, x, y, "copper2" if i % 5 == 0 else "copper1")


def small_flask(s, f):
    """A conical flask, x 40..52, y 24..34, leaf-green brew, the drip falling into it."""
    pts = set()
    for y in range(24, 34):
        half = 1 if y < 27 else 1 + (y - 27) * 5 // 6
        for x in range(46 - half, 47 + half):
            pts.add((x, y))
    for (x, y) in fw.ring_of(pts):
        if (x, y) not in pts:
            px(s, x, y, "ink")
    for (x, y) in pts:
        px(s, x, y, "teal0")
        if y >= 30:
            px(s, x, y, "leaf" if y > 30 else "hot")
        if y >= 31 and x >= 48:
            px(s, x, y, "moss")
    px(s, 45, 25, "bone"); px(s, 43, 31, "bone")
    # the drip from the coil's end (46, 24) down to the brew at 30
    dy = (25, 26, 28, 29)[f]
    px(s, 46, dy, "leaf")
    if f == 3:
        px(s, 45, 30, "leaf"); px(s, 47, 30, "leaf")


def props(s):
    # an iron ingot
    fw.blit(s, 3, 31, [
        "..#####.",
        ".#eeeb#.",
        "#bbbbba#",
        "########",
    ])
    # a gear standing on its edge
    cx, cy = 58.0, 30.0
    teeth = set()
    for i in range(8):
        a = i * math.pi / 4 + math.pi / 8
        x, y = cx + 4.6 * math.cos(a), cy + 4.6 * math.sin(a)
        teeth |= {(round(x - 0.5) + dx, round(y - 0.5) + dy) for dx in (0, 1) for dy in (0, 1)}
    body = disc(cx, cy, 3.9) | teeth
    body = {(x, y) for (x, y) in body if y <= 34}
    hole = disc(cx, cy, 1.4)
    for (x, y) in fw.ring_of(body):
        if (x, y) not in body and y <= 34:
            px(s, x, y, "ink")
    for (x, y) in body - hole:
        lit = (x - cx) + (y - cy) < -1.5
        dark = (x - cx) + (y - cy) > 2
        px(s, x, y, "hull3" if lit else ("hull1" if dark else "hull2"))
    for (x, y) in hole:
        px(s, x, y, "ink")
    # the open notebook
    s.rect(26, 33, 41, 35, c("ink"))
    s.rect(27, 33, 33, 34, c("bone"))
    s.rect(34, 33, 40, 34, c("hull3"))
    for x in (28, 30, 35, 37, 39):
        px(s, x, 34, "hull1")
    px(s, 29, 33, "copper1")


def sparkle(s, f):
    if f in (1, 2):
        x, y = (15, 14) if f == 1 else (29, 16)
        px(s, x, y, "bone")
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            px(s, x + dx, y + dy, "teal1")


def draw(s, f):
    s.layer("main")
    wall(s)
    blueprint(s)
    shelf(s)
    bench(s)
    s.layer("rig")
    burner(s, f)
    coil(s)
    s.layer("flask")
    flask(s, f)
    small_flask(s, f)
    s.layer("props")
    props(s)
    vapour(s, f)
    sparkle(s, f)
    s.layer("main")


def build():
    s = new(W, H, 4)
    for f in range(4):
        s.frame(f + 1)
        draw(s, f)
    s.frame(1)
    return s
