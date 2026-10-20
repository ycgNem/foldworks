"""mega_stage1 (48x48 x10, fps 4): the Megaproject panel's picture of the Great Drill, stage 1,
under construction. Drawn at 48 so the panel shows it at a whole 8x (384 px) at 1280x720.

Named frames, two per state (a/b alternate at 4 fps for life: welding sparks, the work lamp, the
swinging load, the beacon):
    p0a p0b   0-25 %   the site: pad, crane gantry, the empty bore pit with its gold target
                       ring, crates and a cone; the drill bit swings in on the hook
    p1a p1b   25-50 %  the bit stands in the pit; scaffolding goes up; the brass collar comes down
    p2a p2b   50-75 %  collar on; the copper motor housing half built, its wiring showing; a frog
                       in a hard hat welds it from the scaffold (sparks)
    p3a p3b   75-100 % the motor head is on and capped; the frog bolts the last plate; the work
                       lamp on the gantry blinks
    run1 run2 done     the scaffold is gone, the beacon flashes, the vents glow, the pit glows hot,
                       dust and sparks fly: the Drill is running
(The UI shows frame index 2 * floor(progress * 4) + (t % 2), capped at 7, and run1/run2 once the
stage is complete.)

The look follows mega_bay (blue lattice gantry, concrete pad with a hazard front, a steel spiral
bit, brass collar, copper motor head) at 1.5x the detail, set against a dusk sky over the swamp
town's roofs so the picture is a scene, not a sprite on a plate.
"""
import math
from common_m5 import P, new, fw

c = fw.c
W = H = 48
NAMES = ["p0a", "p0b", "p1a", "p1b", "p2a", "p2b", "p3a", "p3b", "run1", "run2"]


def px(s, x, y, slot):
    if 0 <= x < W and 0 <= y < H:
        s.px(x, y, c(slot))


# ----------------------------------------------------------------------------- backdrop
def sky(s, lit):
    """Dusk: iron0 high up, slag low, a violet band; stars; the town's roofs on the horizon."""
    for y in range(0, 34):
        for x in range(W):
            if y < 16:
                col = "iron0"
            elif y == 16:
                col = "slag" if x % 2 else "iron0"
            elif y < 23:
                col = "slag"
            elif y == 23:
                col = "violet" if x % 2 else "slag"
            else:
                col = "violet"
            px(s, x, y, col)
    for (x, y, col) in ((10, 3, "hot"), (17, 12, "hull2"), (30, 2, "hull2"), (36, 13, "hot"),
                        (13, 15, "hull2"), (33, 16, "hull2"), (22, 1, "iron2"), (27, 13, "iron2")):
        px(s, x, y, col)
    # the swamp town's roofs and a water tower, in shadow
    roofs = [(0, 27), (5, 25), (9, 28), (12, 24), (16, 26), (20, 23), (24, 26), (29, 24),
             (33, 27), (37, 25), (41, 28), (44, 24), (48, 26)]
    for (x0, y0), (x1, _) in zip(roofs, roofs[1:]):
        for x in range(x0, x1):
            peak = y0 + abs(x - (x0 + x1) // 2) // 2
            for y in range(peak, 34):
                px(s, x, y, "shadow")
    for y in range(18, 24):
        px(s, 31, y, "shadow"); px(s, 35, y, "shadow")
    for x in range(30, 37):
        for y in range(15, 19):
            px(s, x, y, "shadow")
    for (x, y) in ((7, 29), (14, 27), (22, 26), (26, 29), (39, 28), (43, 27)):
        px(s, x, y, "glow")                                     # lit windows


def pad(s):
    fw.box(s, 0, 33, 47, 47, "hull1", "hull2", "hull0", hi="hull3", chamfer=0)
    s.line(1, 38, 46, 38, c("hull0"))
    s.line(1, 39, 46, 39, c("hull2"))
    for (x, y) in ((6, 35), (20, 36), (38, 35), (9, 41), (43, 41), (30, 36)):
        px(s, x, y, "hull0")
    for (x, y) in ((7, 35), (39, 36), (12, 41)):
        px(s, x, y, "hull2")
    for y in (43, 44, 45):                                     # the hazard front
        for x in range(1, 47):
            px(s, x, y, "brass1" if (x - y) % 6 < 3 else "ink")
    s.line(1, 42, 46, 42, c("hull0"))
    s.line(1, 46, 46, 46, c("shadow"))


def pit(s, glow=0):
    cx, cy = 24.0, 38.5
    for y in range(33, 45):
        for x in range(8, 41):
            u, v = (x + 0.5 - cx) / 12.6, (y + 0.5 - cy) / 4.2
            d = u * u + v * v
            if d <= 1.0:
                if d > 0.66:
                    col = "hull0" if v < 0 else "hull2"
                else:
                    col = "ink" if v < -0.15 else "shadow"
                    if glow and d < 0.5 and v > -0.45:
                        col = ("copper0", "glow", "hot")[min(2, int((0.5 - d) * 6.5) + (glow - 1))]
                px(s, x, y, col)


def target(s):
    cx, cy = 24.0, 38.0
    seen = []
    for i in range(96):
        a = i / 96 * math.tau
        p = (int(cx + 15.2 * math.cos(a)), int(cy + 5.6 * math.sin(a)))
        if p not in seen:
            seen.append(p)
    for i, (x, y) in enumerate(seen):
        if 34 <= y <= 42 and i % 4 < 2:
            px(s, x, y, "brass1")


# ----------------------------------------------------------------------------- gantry
def gantry(s, beacon=None, lamp=False):
    for x0 in (1, 40):
        fw.box(s, x0, 6, x0 + 6, 41, "iron1", "iron2", "iron0", chamfer=0)
        for j, y in enumerate(range(9, 39, 6)):                # a truss: one brace per bay, zigzag
            s.line(x0 + 1, y, x0 + 5, y, c("iron0"))
            for i in range(5):
                px(s, x0 + 1 + i if j % 2 else x0 + 5 - i, y + 1 + i, "iron0")
            px(s, x0 + 1, y - 1, "iron2")
        s.rect(x0 - 1, 40, x0 + 7, 42, c("ink"))
        s.line(x0, 40, x0 + 6, 40, c("hull2"))
        s.line(x0, 41, x0 + 6, 41, c("hull0"))
        px(s, x0, 41, "brass1"); px(s, x0 + 6, 41, "brass1")
    fw.box(s, 0, 3, 47, 10, "iron1", "iron2", "iron0", hi="hull3", chamfer=1)
    for x in range(4, 46, 5):
        px(s, x, 5, "iron2"); px(s, x, 7, "iron0")
        px(s, x + 1, 6, "iron0")
    s.line(2, 9, 45, 9, c("iron0"))
    # the trolley
    fw.box(s, 19, 9, 28, 13, "hull2", "hull3", "hull1", chamfer=1)
    px(s, 21, 11, "ink"); px(s, 26, 11, "ink")
    # the beacon
    s.rect(22, 0, 25, 3, c("ink"))
    px(s, 23, 1, beacon or "copper0"); px(s, 24, 1, beacon or "copper0")
    px(s, 23, 2, "copper0" if not beacon else "gold"); px(s, 24, 2, "copper0" if not beacon else "glow")
    # the work lamp on the right post's top (construction only)
    if lamp is not None:
        s.rect(38, 11, 40, 13, c("ink"))
        px(s, 39, 12, "hot" if lamp else "brass0")
        if lamp:
            for (x, y) in ((37, 14), (36, 15), (35, 16), (38, 15), (37, 16)):
                px(s, x, y, "hot" if (x + y) % 2 else "glow")


def cable(s, y1, x=24, dx=0):
    for y in range(14, y1 + 1):
        xx = x + (dx if y > (14 + y1) // 2 else 0)
        px(s, xx - 1, y, "ink")
        px(s, xx, y, "hull2")
        px(s, xx + 1, y, "ink")


def hook(s, y, dx=0):
    fw.blit(s, 22 + dx, y, [
        ".###.",
        "#yyu#",
        ".#y#.",
        "#.y#.",
        "#uy#.",
        ".##..",
    ])


# ----------------------------------------------------------------------------- the drill
def bit(s, phase=0, top=25, bottom=41, dx=0):
    pts = {}
    for y in range(top, bottom + 1):
        half = 7.2 * (bottom + 0.8 - y) / (bottom + 0.8 - top)
        for x in range(W):
            u = x + 0.5 - 24 - dx
            if abs(u) <= half + 0.01:
                pts[(x, y)] = u / max(half, 0.5)
    for (x, y) in fw.ring_of(set(pts)):
        if (x, y) not in pts:
            px(s, x, y, "ink")
    for (x, y), u in pts.items():
        band = (x + y + phase) % 5
        col = ("hull3", "hull2", "hull2", "hull1", "ink")[band]
        if u > 0.3:
            col = {"hull3": "hull2", "hull2": "hull1", "hull1": "hull0"}.get(col, col)
        if u < -0.75 and col == "hull2":
            col = "hull3"
        px(s, x, y, col)


def collar(s, y=22, dx=0):
    fw.box(s, 13 + dx, y, 34 + dx, y + 3, "brass1", "gold", "brass0", hi="hot", chamfer=1)
    for x in (16, 19, 28, 31):
        px(s, x + dx, y + 2, "brass0")
        px(s, x + dx, y + 1, "gold")
    px(s, 23 + dx, y + 1, "hot"); px(s, 24 + dx, y + 1, "gold")


def housing_low(s):
    s.rect(15, 16, 32, 22, c("ink"))
    s.rect(16, 17, 31, 21, c("copper1"))
    s.line(16, 17, 16, 21, c("copper2"))
    s.line(31, 17, 31, 21, c("copper0"))
    s.line(16, 21, 31, 21, c("copper0"))
    s.line(17, 17, 30, 17, c("shadow"))                         # the open top: wires inside
    for x, col in ((18, "teal1"), (21, "copper2"), (24, "leaf"), (27, "teal1"), (29, "copper2")):
        px(s, x, 17, col)
        px(s, x, 16, col)
        px(s, x + (1 if x % 2 else -1), 15, col)
    for x in (18, 29):                                          # rivets
        px(s, x, 19, "brass1")


def head(s, vents=0):
    y0 = 13
    fw.box(s, 15, y0, 32, y0 + 9, "copper1", "copper2", "copper0", hi="hot", chamfer=1)
    fw.box(s, 20, y0 - 1, 27, y0 + 1, "hull2", "hull3", "hull1", chamfer=1)
    cols = [("shadow", "shadow"), ("glow", "hot"), ("hot", "glow")][vents]
    for i, x in enumerate((18, 22, 26, 30)):
        s.rect(x - 1, y0 + 4, x + 1, y0 + 6, c("ink"))
        px(s, x, y0 + 4, cols[i % 2])
        px(s, x, y0 + 5, cols[(i + 1) % 2])
        if vents:
            px(s, x, y0 + 6, "copper1")
    for x in (17, 30):
        px(s, x, y0 + 8, "brass1")
    s.line(16, y0 + 7, 31, y0 + 7, c("copper0"))


# ----------------------------------------------------------------------------- the site
def scaffold(s, top=19):
    """Wooden scaffold between the left post and the drill: two poles, planks, cross braces."""
    for x in (9, 13):
        for y in range(top, 42):
            px(s, x, y, "ground2" if x == 9 else "ground1")
    for y in (top, top + 10):
        for x in range(8, 15):
            px(s, x, y, "ground2")
            px(s, x, y + 1, "ground0")
        px(s, 15, y, "ink"); px(s, 15, y + 1, "ink")
    for i in range(9):
        px(s, 10 + i * 3 // 9, top + 11 + i, "ground0")
    for i in range(9):
        px(s, 12 - i * 3 // 9, top + 2 + i, "ground0")


def frog(s, x0, y0, pose=0):
    """A frog in a gold hard hat, 8x8, facing right, a torch held out to the drill; pose 1 is
    the bob (head down a pixel). Eye white with the pupil forward, a wide frog mouth line."""
    body = [
        "..###...",
        ".#$$z#..",
        "#$$$$$#.",
        "#lWl#Wl#",
        "#llllll#",
        ".#vvvv#2",
        ".#lvvl#2",
        ".#v##v#.",
    ]
    if pose:
        body = [body[0].replace("#", "."), body[0], body[1], body[2], body[3], body[4], body[5], body[7]]
    fw.blit(s, x0, y0, body, key={"2": "hull2"})


def crate(s, x0, y0):
    fw.blit(s, x0, y0, [
        "######",
        "#pppp#",
        "#hGGh#",
        "#GhhG#",
        "#hGGh#",
        "######",
    ])


def cone(s, x0, y0):
    fw.blit(s, x0, y0, [
        "..#..",
        ".#o#.",
        ".#W#.",
        "#ooo#",
        "#####",
    ])


def weld(s, x, y, f):
    pts = [((0, 0, "hot"), (1, -1, "gold"), (-1, -2, "glow"), (2, 1, "gold"), (1, -3, "hot"), (-2, 0, "glow")),
           ((0, 0, "hot"), (2, -1, "glow"), (-1, -1, "gold"), (1, 2, "hot"), (3, -2, "gold"), (-1, 2, "glow"))][f]
    for (dx, dy, col) in pts:
        px(s, x + dx, y + dy, col)


def dust(s, f):
    pts = [((10, 34), (37, 34), (12, 37), (35, 37), (15, 32), (32, 32)),
           ((9, 35), (38, 35), (14, 38), (34, 38), (13, 32), (34, 31))][f]
    for i, (x, y) in enumerate(pts):
        px(s, x, y, ("hull3", "hull2", "ground2")[i % 3])


def sparks(s, f):
    sets = [((11, 28, "hot"), (12, 29, "gold"), (36, 26, "hot"), (35, 27, "glow"), (13, 24, "gold"),
             (37, 31, "glow"), (16, 30, "hot")),
            ((10, 26, "hot"), (11, 27, "glow"), (37, 28, "hot"), (36, 29, "gold"), (34, 23, "gold"),
             (12, 32, "glow"), (31, 30, "hot"))][f]
    for (x, y, col) in sets:
        px(s, x, y, col)


# ----------------------------------------------------------------------------- frames
def draw(s, i):
    name = NAMES[i]
    run = name.startswith("run")
    st = None if run else int(name[1])
    f = (i % 2)
    s.layer("main")
    sky(s, run)
    pad(s)
    s.layer("site")
    pit(s, glow=(f + 1) if run else 0)
    if st == 0:
        target(s)
    if st is not None:
        crate(s, 33, 35)
        cone(s, 15 if st == 0 else 30, 37 if st == 0 else 36)
        if st == 0:
            crate(s, 38, 37)
    s.layer("scaffold")
    if st is not None and st >= 1:
        scaffold(s, 19)
    s.layer("gantry")
    gantry(s, beacon=(("hot" if f == 0 else "glow") if run else None),
           lamp=None if run else (f == 0))
    s.layer("bit")
    swing = (0, 1)[f]
    if st == 0:
        cable(s, 15, dx=swing)
        hook(s, 15, swing)
        bit(s, 0, top=21, bottom=34, dx=swing)                 # coming in on the hook
    elif st is not None or run:
        bit(s, (2 * f) if run else 0)
    s.layer("collar")
    if st == 1:
        cable(s, 15)
        hook(s, 14)
        collar(s, 19)                                          # coming down
    elif (st is not None and st >= 2) or run:
        collar(s)
    s.layer("head")
    if st == 2:
        housing_low(s)
    elif (st is not None and st >= 3) or run:
        head(s, vents=(f + 1) if run else 0)
    s.layer("crew")
    if st is not None and st >= 2:
        frog(s, 7, 11, pose=f)
        weld(s, 16, 17, f)
    if st == 3:
        # the last plate going on: a bolt glint
        px(s, 30, 21 if f == 0 else 20, "hot")
    if run:
        s.layer("fx")
        for x in range(17, 32):
            px(s, x, 41, "hull2")                              # the near lip, over the point
        dust(s, f)
        sparks(s, f)
    s.layer("main")


def build():
    s = new(W, H, len(NAMES))
    for i in range(len(NAMES)):
        s.frame(i + 1)
        draw(s, i)
    s.frame(1)
    return s
