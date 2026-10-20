"""Mk1 machines, 16x16, facing right (the output chute is on the right edge, rows 5..10).

Families by silhouette and motion (STYLE.md): the miner is a round cutter in a hazard ring,
the smelter a firebrick block with a chimney and a glowing mouth, the press a blue gantry
whose ram stamps, the assembler a low green-matted bench with two brass arms that meet, and
the Hand Furnace a squat stone beehive with a crank wheel. Frame 0 is the idle pose. All four
corners' 4x4 stay calm (the pip sits in the top-right one; the game rotates machines).
"""
import math
from fw import mk, blit, box, export, c, disk, ring_of


def chute(s, inner=("hull2", "shadow", "shadow", "hull0"), x0=12):
    """The output chute: an ink-lipped slot on the right edge, rows 5..10."""
    s.rect(x0, 5, 15, 10, c("ink"))
    for i, col in enumerate(inner):
        s.line(x0 + 1, 6 + i, 15, 6 + i, c(col))


# --------------------------------------------------------------------------- miner

def draw_miner(s, f):
    cx, cy = 7.5, 8.0
    pts = {}
    for y in range(16):
        for x in range(16):
            dx, dy = x + 0.5 - cx, y + 0.5 - cy
            pts[(x, y)] = (math.hypot(dx, dy), math.atan2(dy, dx))
    chute(s, ("hull2", "shadow", "shadow", "hull0"))
    for (x, y), (r, th) in pts.items():
        if r >= 7.3:
            continue
        if r >= 6.4:
            s.px(x, y, c("ink"))
            continue
        if r >= 5.2:
            # the housing ring: hazard stripes, lit from the top-left
            seg = int(((th + math.pi) / (2 * math.pi)) * 10 + 0.5) % 2
            lit = -(math.cos(th) + math.sin(th)) * 0.7071
            if seg == 0:
                s.px(x, y, c("hot") if lit > 0.6 else (c("brass1") if lit > -0.45 else c("brass0")))
            else:
                s.px(x, y, c("hull0") if lit > 0.3 else c("ink"))
            continue
        if r >= 4.4:
            s.px(x, y, c("ink"))
            continue
        # the cutter: three curved arms turning 30 degrees a frame
        v = (3 * th / (2 * math.pi) + 0.24 * r - 0.25 * f) % 1.0
        if r < 1.2:
            s.px(x, y, c("brass1"))
        elif v < 0.30:
            s.px(x, y, c("hull3") if v < 0.12 else c("hull2"))
        elif v < 0.45:
            s.px(x, y, c("hull1"))
        else:
            s.px(x, y, c("shadow"))
    s.px(7, 7, c("hot"))
    # the chute again over the ring, so it reads as attached to the housing
    s.rect(13, 5, 15, 10, c("ink"))
    s.line(13, 6, 15, 6, c("hull2"))
    s.line(13, 7, 15, 7, c("shadow"))
    s.line(13, 8, 15, 8, c("shadow"))
    s.line(13, 9, 15, 9, c("hull0"))
    # a crumb of ore riding out (motion cue): working frames only
    if f:
        x = 12 + f
        s.px(x, 7, c("hull3"))
        s.px(x, 8, c("hull1"))


# --------------------------------------------------------------------------- smelter

def draw_smelter(s, f):
    # body
    box(s, 1, 3, 14, 14, "copper0", "copper1", "shadow", chamfer=1)
    # steel band across the top
    s.line(2, 4, 13, 4, c("hull2"))
    s.px(2, 4, c("hull3"))
    s.line(2, 5, 13, 5, c("hull0"))
    # bricks
    for y in range(6, 13):
        row, within = (y - 6) // 2, (y - 6) % 2
        for x in range(2, 9):
            if within == 1:
                col = "shadow" if y == 13 else "copper0"
            else:
                j = (x - 2 + row * 2) % 4
                col = "copper0" if j == 3 else ("copper2" if j == 0 and x < 6 else "copper1")
            s.px(x, y, c(col))
    s.line(2, 13, 13, 13, c("shadow"))
    # chimney (top-left of centre) with a breathing ember
    blit(s, 3, 0, [
        "#####",
        "#s.s#",
        "#210#",
        "#210#",
    ])
    ember = ["copper0", "glow", "hot", "glow"][f]
    s.px(5, 1, c(ember))
    # the mouth: an arch on the output side, glow spilling into the chute
    s.rect(9, 5, 15, 11, c("ink"))
    s.px(9, 5, c("hull0"))
    glow = [
        # idle: banked coals
        ["rrrrrr", "rorror", "oxoorr", "xoxoxo", "rxrxrr"],
        ["xxxxxx", "xzzxxo", "zzzzxx", "xzzxxo", "oxoxoo"],
        ["xxxxxo", "xzzzxx", "xzzzzx", "zzzxxo", "xoxoxo"],
        ["xxxxxx", "xxzzxo", "xzzzxx", "xzzxxx", "oxoxoo"],
    ][f]
    for j, row in enumerate(glow):
        for i, ch in enumerate(row):
            s.px(10 + i, 6 + j, c(ch))
    s.px(10, 6, c("ink"))
    s.px(10, 10, c("copper0") if f == 0 else c("glow"))
    # lip of the chute
    s.line(14, 5, 15, 5, c("ink"))
    s.line(14, 11, 15, 11, c("ink"))


# --------------------------------------------------------------------------- press

RAM_Y = [4, 6, 8, 6]


def draw_press(s, f):
    # the gantry: two blue legs and a crossbeam
    box(s, 1, 1, 11, 4, "iron1", "iron2", "iron0", hi="hull3", chamfer=1)
    s.px(3, 2, c("hull3"))
    s.px(9, 2, c("hull3"))
    for x0 in (1, 9):
        box(s, x0, 4, x0 + 2, 13, "iron1", "iron2", "iron0", chamfer=0)
    s.line(2, 4, 2, 4, c("iron2"))
    s.line(10, 4, 10, 4, c("iron2"))
    # the back plate between the legs, so the ram reads against shadow
    s.rect(4, 5, 8, 10, c("shadow"))
    s.line(4, 5, 8, 5, c("ink"))
    for y in (7, 9):
        s.px(4, y, c("hull0"))
        s.px(8, y, c("hull0"))
    # bed and die
    box(s, 0, 11, 12, 14, "hull1", "hull2", "hull0", chamfer=1)
    s.rect(4, 11, 8, 12, c("shadow"))
    s.line(4, 11, 8, 11, c("ink"))
    # the workpiece on the die (flattened in the impact frame)
    if f == 2:
        s.line(3, 11, 9, 11, c("iron2"))
    else:
        s.line(5, 10, 7, 10, c("ink"))
        s.line(5, 11, 7, 11, c("iron2"))
    # rod and ram
    ry = RAM_Y[f]
    s.line(6, 4, 6, ry, c("hull3"))
    s.line(5, 5, 5, ry, c("ink"))
    s.line(7, 5, 7, ry, c("ink"))
    box(s, 3, ry, 9, ry + 2, "hull2", "hull3", "hull0", chamfer=0)
    s.px(4, ry + 1, c("hull3"))
    if f == 2:
        # sparks on impact
        for x, y in ((3, 10), (9, 10), (2, 9), (10, 9)):
            s.px(x, y, c("hot"))
    chute(s, ("hull2", "shadow", "shadow", "hull0"))
    s.line(12, 5, 12, 10, c("ink"))


# --------------------------------------------------------------------------- assembler

# the top arm per frame (the bottom arm is its mirror): shoulder, elbow, hand
SHOULDER = (5, 2)
ELBOW = [(9, 2), (9, 3), (8, 3), (9, 3)]
HANDS = [(11, 5), (10, 6), (8, 6), (10, 6)]


def seg(x0, y0, x1, y1):
    n = max(abs(x1 - x0), abs(y1 - y0), 1)
    return [(round(x0 + (x1 - x0) * t / n), round(y0 + (y1 - y0) * t / n)) for t in range(n + 1)]


def limb(a, b):
    """A 2-px-thick segment: (pixel, is_lit_side) pairs."""
    pts = {}
    steep = abs(b[1] - a[1]) > abs(b[0] - a[0])
    for x, y in seg(*a, *b):
        pts[(x, y)] = True
        q = (x + 1, y) if steep else (x, y + 1)
        pts.setdefault(q, False)
    return pts


def draw_assembler(s, f):
    # a dark bench, so the bright steel arms read on it without heavy outlines
    box(s, 1, 3, 14, 12, "hull0", "hull1", "shadow", hi="hull2", chamfer=2)
    # the green work mat with a grid
    s.rect(4, 5, 10, 10, c("ink"))
    s.rect(5, 6, 9, 9, c("moss"))
    for x, y in ((5, 6), (7, 6), (9, 6), (5, 9), (7, 9), (9, 9)):
        s.px(x, y, c("leaf"))
    # the part being built
    blit(s, 6, 7, ["32", "21"])
    # two articulated arms, mirror images: steel segments, brass joints, a gripper
    H, E = HANDS[f], ELBOW[f]
    arm = limb(SHOULDER, E)
    arm.update({k: v for k, v in limb(E, H).items() if k not in arm})
    sh = disk(SHOULDER[0] + 0.5, SHOULDER[1] + 0.5, 1.6)
    grip = [(H[0] - 1, H[1] + 1), (H[0] + 1, H[1] + 1)] if f != 2 else [(H[0], H[1] + 1)]
    allpts = set(arm) | sh | set(grip)
    body = {(x, y) for y in range(16) for x in range(16) if s.get(x, y) is not None}
    for mirror in (False, True):
        def P(x, y):
            return (x, 15 - y) if mirror else (x, y)
        # ink only where the arm stands off the bench; a cast shadow where it is over it
        for x, y in ring_of(allpts):
            q = P(x, y)
            if q not in body:
                s.px(*q, c("ink"))
        for x, y in allpts:
            q = P(x + 1, y + 1)
            if q in body and (x + 1, y + 1) not in allpts:
                s.px(*q, c("ink"))
        for (x, y), lit in arm.items():
            s.px(*P(x, y), c("hull3") if lit != mirror else c("hull2"))
        for x, y in sh:
            s.px(*P(x, y), c("brass1"))
        s.px(*P(SHOULDER[0], SHOULDER[1]), c("hot"))
        s.px(*P(*E), c("brass1"))
        for x, y in grip:
            s.px(*P(x, y), c("bone"))
    if f == 2:
        s.px(9, 7, c("hot"))
        s.px(9, 8, c("hot"))
        s.px(10, 7, c("glow"))
    chute(s, ("hull2", "shadow", "shadow", "hull0"), x0=13)


# --------------------------------------------------------------------------- hand furnace

CRANK = [(3, 6), (0, 9), (3, 12), (6, 9)]


def draw_furnace(s, f):
    cx, cy, R = 7.5, 8.5, 6.2
    pts = {}
    for y in range(16):
        for x in range(16):
            u, v = (x + 0.5 - cx) / R, (y + 0.5 - cy) / (R - 0.4)
            if u * u + v * v <= 1:
                pts[(x, y)] = -(u + v) * 0.7071
    for x, y in ring_of(set(pts)):
        s.px(x, y, c("ink"))
    for (x, y), k in pts.items():
        # stone courses: curved rows of blocks, mortar in hull0
        course = (y - 2) // 3
        if (y - 2) % 3 == 2:
            col = "hull0"
        elif (x + course * 2) % 5 == 0:
            col = "hull0"
        else:
            col = "hull3" if k > 0.5 else ("hull2" if k > 0.0 else ("hull1" if k > -0.55 else "hull0"))
        s.px(x, y, c(col))
    # smoke hole at the crown
    blit(s, 6, 2, ["##", "##"])
    s.px(6, 2, c(["copper0", "glow", "copper1", "glow"][f]))
    # the mouth (output side): small and dim compared with a smelter's
    blit(s, 10, 6, [
        ".###..",
        "#rrr##",
        "#roor.",
        "#rorr.",
        "######",
    ])
    glow = ["copper0", "glow", "hot", "glow"][f]
    s.px(12, 8, c(glow))
    if f:
        s.px(11, 8, c("copper1"))
        s.px(12, 9, c("glow") if f != 2 else c("hot"))
        s.px(13, 8, c("copper1"))
    s.line(14, 7, 15, 7, c("ink"))
    s.line(14, 10, 15, 10, c("ink"))
    s.line(14, 8, 15, 8, c("shadow"))
    s.line(14, 9, 15, 9, c("hull0"))
    # the crank: a brass wheel on the left with a handle that turns
    wheel = disk(3.5, 9.5, 1.7)
    for x, y in ring_of(wheel):
        s.px(x, y, c("ink"))
    for x, y in wheel:
        s.px(x, y, c("brass1"))
    s.px(3, 8, c("hot"))
    hx, hy = CRANK[f]
    spoke = seg(3, 9, hx, hy)
    for x, y in ring_of(set(spoke)):
        if s.get(x, y) is None:
            s.px(x, y, c("ink"))
    for x, y in spoke:
        s.px(x, y, c("hull2"))
    s.px(3, 9, c("brass0"))
    # the wooden knob
    s.px(hx, hy, c("copper1"))


def build():
    export("miner", mk(16, 16, 4, draw_miner), 12)
    export("smelter", mk(16, 16, 4, draw_smelter), 8)
    export("press", mk(16, 16, 4, draw_press), 8)
    export("assembler", mk(16, 16, 4, draw_assembler), 8)
    export("furnace", mk(16, 16, 4, draw_furnace), 8)
