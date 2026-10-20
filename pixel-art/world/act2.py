"""Act II machines (second priority): power (boiler, steam engine, pole, generator), the kiln,
the mixer, the refinery, and the Mk2 smelter, press and assembler at 32x32 (the Mk1 silhouettes,
bigger and more detailed). Same rules as machines.py: face right, frame 0 idle, corners calm.
Power machines put out steam or current, so their right edge is a pipe flange or a socket on
rows 5..10 instead of an item chute.
"""
import math
from fw import mk, blit, box, export, c, disk, ring_of, lump
from machines import chute, seg, limb


def flange(s, col="brass1", x0=13):
    """A pipe stub with a bolted flange on the right edge, rows 5..10."""
    s.rect(x0, 6, 15, 9, c("ink"))
    s.line(x0, 7, 15, 7, c(col))
    s.line(x0, 8, 15, 8, c("brass0" if col == "brass1" else "hull0"))
    s.rect(14, 5, 15, 10, c("ink"))
    s.line(15, 6, 15, 9, c("hull2"))
    s.line(14, 6, 14, 9, c("hull1"))


# --------------------------------------------------------------------------- boiler

def draw_boiler(s, f):
    # firebox (brick) below
    box(s, 2, 9, 12, 14, "copper0", "copper1", "shadow", chamfer=1)
    s.rect(4, 11, 10, 13, c("ink"))
    fire = ["rrorror", "xoxzxox", "zxxzxzx", "xzxxzxo"][f]
    for i, ch in enumerate(fire):
        s.px(4 + i, 12, c(ch))
        if ch in "zx" and f:
            s.px(4 + i, 11, c("copper0" if ch == "x" else "glow"))
    # the water tank: a horizontal drum lit along its top
    box(s, 1, 2, 13, 10, "iron1", "iron2", "iron0", hi="hull3", chamfer=2)
    s.line(3, 3, 11, 3, c("hull3"))
    s.line(2, 8, 12, 8, c("iron0"))
    for x in (4, 10):
        s.line(x, 3, x, 8, c("iron0"))
        s.px(x, 4, c("iron2"))
    # pressure gauge: the needle climbs while it works
    blit(s, 6, 4, ["###", "#W#", "###"])
    s.px(7, 5, c(["bone", "glow", "copper1", "glow"][f]))
    flange(s, "brass1")
    # a puff of steam from the safety valve (centre top, clear of the corners)
    s.px(7, 1, c("hull2"))
    s.px(7, 0, c("ink"))
    if f in (1, 2):
        s.px(6 + f - 1, 0, c("bone"))


# --------------------------------------------------------------------------- steam engine

def draw_steam_engine(s, f):
    box(s, 1, 11, 13, 14, "hull1", "hull2", "hull0", chamfer=1)     # bed
    # flywheel on the left: rim, four spokes that turn 22.5 degrees a frame
    cx, cy, R = 5.0, 7.0, 4.6
    rim = disk(cx, cy, R)
    for x, y in ring_of(rim):
        s.px(x, y, c("ink"))
    for x, y in rim:
        r = math.hypot(x + 0.5 - cx, y + 0.5 - cy)
        s.px(x, y, c("hull2") if r > R - 1.2 and (x + 0.5 - cx) + (y + 0.5 - cy) < 0 else (c("hull1") if r > R - 1.2 else c("shadow")))
    a0 = f * math.pi / 8
    for k in range(4):
        a = a0 + k * math.pi / 2
        for t in (1, 2, 3):
            s.px(int(cx + t * math.cos(a)), int(cy + t * math.sin(a)), c("hull3") if k % 2 == 0 else c("hull2"))
    s.px(int(cx), int(cy), c("brass1"))
    # crank pin on the wheel drives the rod into the cylinder
    pa = a0 * 4
    px_, py_ = int(round(cx + 2.6 * math.cos(pa))), int(round(cy + 2.6 * math.sin(pa)))
    # the cylinder (brass) on the right
    box(s, 8, 4, 13, 10, "brass1", "hot", "brass0", chamfer=1)
    s.line(9, 7, 12, 7, c("brass0"))
    rod_x = 9 + [0, 1, 2, 1][f]
    for x, y in seg(px_, py_, rod_x, 7):
        s.px(x, y, c("hull3"))
    s.px(px_, py_, c("hot"))
    flange(s, "hull2")


# --------------------------------------------------------------------------- power pole

def draw_pole(s, f):
    # a wooden pole with a cross-arm, seen from above and in front; a shadow on the ground
    s.line(9, 14, 12, 14, c("ground0"))
    s.rect(6, 5, 9, 14, c("ink"))
    s.rect(7, 5, 8, 13, c("brass0"))
    s.line(7, 5, 7, 13, c("ground2"))
    s.px(7, 9, c("brass1"))
    # cross-arm
    s.rect(2, 4, 13, 7, c("ink"))
    s.line(3, 5, 12, 5, c("ground2"))
    s.line(3, 6, 12, 6, c("brass0"))
    # insulators (glass) and wire stubs
    for x in (4, 11):
        blit(s, x - 1, 2, ["###", "#T#", "#t#"])
    s.px(4, 2, c("bone"))
    s.px(11, 2, c("bone"))


# --------------------------------------------------------------------------- generator

def draw_generator(s, f):
    box(s, 1, 3, 13, 12, "hull1", "hull2", "hull0", hi="hull3", chamfer=2)
    # two copper coils and a rotor between them
    for y0 in (4, 9):
        s.rect(3, y0, 11, y0 + 2, c("ink"))
        for x in range(4, 11):
            s.px(x, y0 + 1, c("copper1") if x % 2 else c("copper2"))
    s.rect(4, 6, 10, 9, c("ink"))
    s.rect(5, 7, 9, 8, c("shadow"))
    # the rotor's two bright bars sweep across
    for i in range(2):
        x = 5 + (f * 1 + i * 2) % 5
        s.px(x, 7, c("hull3"))
        s.px(x, 8, c("hull2"))
    # a little arc of current when working
    if f:
        s.px(4 + f * 2, 6, c("teal1"))
    # the cable socket: output current
    s.rect(12, 5, 15, 10, c("ink"))
    s.line(13, 6, 15, 6, c("hull2"))
    s.rect(13, 7, 15, 8, c("shadow"))
    s.px(14, 7, c("teal1") if f % 2 else c("teal0"))
    s.line(13, 9, 15, 9, c("hull0"))


# --------------------------------------------------------------------------- kiln (glass)

def draw_kiln(s, f):
    # a bottle kiln: wide base narrowing to a short neck, pale brick, teal glass glow
    cx = 7.0
    pts = {}
    for y in range(1, 15):
        half = 6.2 if y >= 7 else 2.4 + (y - 1) * 0.65
        for x in range(16):
            u = (x + 0.5 - cx) / half
            if abs(u) <= 1:
                pts[(x, y)] = u
    for x, y in ring_of(set(pts)):
        if 0 <= y < 16:
            s.px(x, y, c("ink"))
    for (x, y), u in pts.items():
        course = y % 3 == 0
        col = "ground2" if u < -0.3 else ("hull1" if u > 0.45 else "hull2")
        if course:
            col = "hull1" if u < 0.45 else "hull0"
        s.px(x, y, c(col))
    # neck glow (heat haze, teal)
    s.rect(6, 0, 8, 1, c("ink"))
    s.px(7, 1, c("teal1") if f else c("teal0"))
    # the mouth: molten glass, teal-white
    s.rect(9, 7, 15, 11, c("ink"))
    glow = [["tttt", "tTtt", "tttt"], ["TTTt", "TWTT", "tTTt"], ["TTTT", "WWTT", "TTTt"], ["TTTt", "TWWT", "tTTt"]][f]
    for j, row in enumerate(glow):
        for i, ch in enumerate(row):
            s.px(10 + i, 8 + j, c(ch))
    s.line(14, 8, 15, 8, c("teal1") if f else c("teal0"))
    s.line(14, 9, 15, 9, c("hull0"))
    s.line(14, 10, 15, 10, c("shadow"))


# --------------------------------------------------------------------------- mixer (concrete)

def draw_mixer(s, f):
    box(s, 1, 11, 12, 14, "hull1", "hull2", "hull0", chamfer=1)       # chassis
    # the drum: a tilted barrel, mouth to the right, spiral fins that turn
    cx, cy = 6.5, 7.0
    pts = {}
    for y in range(16):
        for x in range(16):
            u, v = (x + 0.5 - cx) / 5.6, (y + 0.5 - cy) / 4.4
            if u * u + v * v <= 1:
                pts[(x, y)] = (u, v)
    for x, y in ring_of(set(pts)):
        s.px(x, y, c("ink"))
    for (x, y), (u, v) in pts.items():
        band = int((x * 0.8 + y * 1.4 - f * 1.0) // 2) % 2
        lit = -(u + v)
        if band:
            col = "hot" if lit > 0.9 else ("brass1" if lit > -0.6 else "brass0")
        else:
            col = "brass0" if lit > 0 else "shadow"
        s.px(x, y, c(col))
    # the drum mouth (grey slurry) and the chute
    chute(s, ("hull2", "hull1", "hull1", "hull0"), x0=12)
    s.px(11, 6, c("ink"))
    s.px(11, 7, c("hull1"))
    s.px(11, 8, c("hull2") if f % 2 else c("hull1"))
    s.px(11, 9, c("ink"))


# --------------------------------------------------------------------------- refinery (oil -> plastic)

def draw_refinery(s, f):
    box(s, 1, 2, 13, 13, "hull0", "hull1", "shadow", chamfer=2)
    # a big storage tank (top view) on the left
    t = disk(5.0, 7.5, 3.6)
    for x, y in ring_of(t):
        s.px(x, y, c("ink"))
    for x, y in t:
        k = (x + 0.5 - 5) + (y + 0.5 - 7.5)
        s.px(x, y, c("hull3") if k < -2.5 else (c("hull2") if k < 1.5 else c("hull1")))
    s.px(5, 7, c("ink"))
    s.px(4, 6, c("bone"))
    # a column on the right, with a flare that flickers on top
    s.rect(9, 3, 12, 12, c("ink"))
    s.rect(10, 4, 11, 11, c("hull2"))
    s.line(10, 4, 10, 11, c("hull3"))
    for y in (6, 9):
        s.line(10, y, 11, y, c("hull0"))
    flame = [None, "glow", "hot", "glow"][f]
    if flame:
        s.px(10, 2, c(flame))
        s.px(11, 2, c("copper1"))
    # the pipe between them, with oil pulsing along it (violet-black)
    s.line(8, 10, 9, 10, c("ink"))
    s.px(8, 11, c("violet") if f % 2 else c("shadow"))
    # a red valve wheel
    blit(s, 7, 11, ["#o#", "ooo", "#o#"])
    chute(s, ("hull2", "shadow", "shadow", "hull0"), x0=13)


# --------------------------------------------------------------------------- Mk2 (32x32)

def chute32(s, inner=("hull2", "hull1", "shadow", "shadow", "shadow", "hull0"), x0=26):
    """The Mk2 chute: rows 12..19 on the right edge (centred on the 2x2's middle)."""
    s.rect(x0, 12, 31, 19, c("ink"))
    for i, col in enumerate(inner):
        s.line(x0 + 1, 13 + i, 31, 13 + i, c(col))


def draw_smelter_mk2(s, f):
    box(s, 2, 7, 29, 29, "copper0", "copper1", "shadow", chamfer=2)
    # two steel bands and rivets
    for y, col in ((8, "hull2"), (9, "hull0")):
        s.line(3, y, 28, y, c(col))
    s.line(3, 26, 28, 26, c("hull1"))
    s.line(3, 27, 28, 27, c("hull0"))
    for x in range(5, 28, 5):
        s.px(x, 8, c("hull3"))
        s.px(x, 26, c("hull3"))
    # bricks, offset rows of 4x2
    for y in range(10, 26):
        row, within = (y - 10) // 2, (y - 10) % 2
        for x in range(3, 17):
            j = (x - 3 + row * 2) % 5
            if within == 1:
                col = "copper0"
            else:
                col = "copper0" if j == 4 else ("copper2" if j == 0 else "copper1")
            s.px(x, y, c(col))
    # two chimneys with embers
    for x0, ph in ((5, 0), (11, 2)):
        blit(s, x0, 0, ["#####", "#s.s#", "#210#", "#210#", "#210#", "#210#", "#210#", "#210#"])
        s.px(x0 + 2, 1, c(["copper0", "glow", "hot", "glow"][(f + ph) % 4]))
    # the big arched mouth
    s.rect(17, 11, 31, 22, c("ink"))
    rows = ["..##########", ".#xxxxxxxxxx", "#xxxzzzzxxxx", "#xxzzzzzzxxx", "#xzzzWWzzzxx",
            "#xzzWWWWzzxx", "#xxzzzzzzxxx", "#xoxxzzxxoxo", "#oxoxxoxoxox", ".#rorrorrorr"]
    idle = {"z": "x", "W": "o", "x": "o"}
    for j, row in enumerate(rows):
        for i, ch in enumerate(row):
            if ch == ".":
                continue
            if f == 0 and ch in idle:
                ch = idle[ch] if (i + j) % 3 else "r"
            elif f in (1, 3) and ch == "W" and (i + j + f) % 2:
                ch = "z"
            s.px(18 + i, 12 + j, c(ch))
    s.line(28, 11, 31, 11, c("ink"))
    s.line(28, 22, 31, 22, c("ink"))
    s.line(29, 12, 31, 12, c("hull2"))


RAM32 = [8, 12, 16, 12]


def draw_press_mk2(s, f):
    # back plate between the legs
    s.rect(7, 8, 19, 22, c("shadow"))
    for y in range(10, 22, 3):
        s.line(8, y, 18, y, c("hull0"))
    # gantry: thick blue legs, a deep crossbeam with hydraulic cylinders
    box(s, 2, 2, 24, 8, "iron1", "iron2", "iron0", hi="hull3", chamfer=2)
    for x in (5, 21):
        s.px(x, 4, c("hull3"))
        s.px(x, 6, c("hull3"))
    for x0 in (2, 19):
        box(s, x0, 7, x0 + 5, 26, "iron1", "iron2", "iron0", chamfer=0)
        s.line(x0 + 2, 9, x0 + 2, 24, c("iron0"))
    # hydraulic rams: two brass cylinders, chrome rods
    ry = RAM32[f]
    for x0 in (9, 15):
        s.rect(x0, 3, x0 + 2, 7, c("ink"))
        s.line(x0 + 1, 3, x0 + 1, 7, c("brass1"))
        s.line(x0 + 1, 8, x0 + 1, ry, c("hull3"))
        s.px(x0, 8, c("ink"))
        s.px(x0 + 2, 8, c("ink"))
    box(s, 7, ry, 19, ry + 4, "hull2", "hull3", "hull0", hi="bone", chamfer=1)
    s.line(8, ry + 2, 18, ry + 2, c("hull1"))
    # bed and die with the workpiece
    box(s, 0, 23, 26, 29, "hull1", "hull2", "hull0", chamfer=2)
    s.rect(8, 23, 18, 25, c("ink"))
    s.rect(9, 24, 17, 25, c("shadow"))
    if f == 2:
        s.line(7, 22, 19, 22, c("iron2"))
        for x, y in ((6, 21), (20, 21), (5, 19), (21, 19), (4, 22), (22, 22)):
            s.px(x, y, c("hot"))
    else:
        s.rect(10, 21, 16, 22, c("ink"))
        s.line(11, 21, 15, 21, c("iron2"))
        s.line(11, 22, 15, 22, c("iron1"))
    chute32(s)
    s.line(26, 12, 26, 19, c("ink"))


HANDS32 = [(22, 9), (20, 11), (17, 13), (20, 11)]
ELBOW32 = [(19, 3), (19, 4), (17, 5), (19, 4)]
WRIST32 = [(22, 6), (21, 8), (18, 10), (21, 8)]
SHOULDER32 = (10, 4)


def draw_assembler_mk2(s, f):
    box(s, 2, 6, 29, 25, "hull0", "hull1", "shadow", hi="hull2", chamfer=3)
    # rivets and a hazard edge on the front
    for x in range(6, 27, 5):
        s.px(x, 7, c("hull2"))
        s.px(x, 24, c("hull1"))
    # the work mat with a grid and the part
    s.rect(8, 10, 21, 21, c("ink"))
    s.rect(9, 11, 20, 20, c("moss"))
    for y in range(11, 21, 3):
        for x in range(9, 21, 3):
            s.px(x, y, c("leaf"))
    blit(s, 12, 13, [".####.", "#3322#", "#32#1#", "#3#21#", "#2211#", ".####."])
    S, E, W, H = SHOULDER32, ELBOW32[f], WRIST32[f], HANDS32[f]
    arm = limb(S, E)
    for a, b in ((E, W), (W, H)):
        arm.update({k: v for k, v in limb(a, b).items() if k not in arm})
    sh = disk(S[0] + 0.5, S[1] + 0.5, 2.6)
    el = disk(E[0] + 0.5, E[1] + 0.5, 1.6)
    wr = {W, (W[0] + 1, W[1]), (W[0], W[1] + 1), (W[0] + 1, W[1] + 1)}
    grip = ([(H[0] - 1, H[1] + 1), (H[0] - 1, H[1] + 2), (H[0] + 2, H[1] + 1), (H[0] + 2, H[1] + 2)] if f != 2
            else [(H[0], H[1] + 1), (H[0] + 1, H[1] + 1), (H[0], H[1] + 2), (H[0] + 1, H[1] + 2)])
    allpts = set(arm) | sh | el | wr | set(grip)
    body = {(x, y) for y in range(32) for x in range(32) if s.get(x, y) is not None}
    for mirror in (False, True):
        def P(x, y):
            return (x, 31 - y) if mirror else (x, y)
        for x, y in ring_of(allpts):
            if P(x, y) not in body:
                s.px(*P(x, y), c("ink"))
        for x, y in allpts:
            q = P(x + 1, y + 1)
            if q in body and (x + 1, y + 1) not in allpts:
                s.px(*q, c("ink"))
        for (x, y), lit in arm.items():
            s.px(*P(x, y), c("hull3") if lit != mirror else c("hull2"))
        for x, y in sh:
            s.px(*P(x, y), c("brass1"))
        for x, y in el:
            s.px(*P(x, y), c("brass1"))
        for x, y in wr:
            s.px(*P(x, y), c("brass0"))
        s.px(*P(S[0] - 1, S[1] - 1 if not mirror else S[1] + 1), c("hot"))
        s.px(*P(*E), c("hot"))
        for x, y in grip:
            s.px(*P(x, y), c("bone"))
    if f == 2:
        for x, y in ((18, 15), (18, 16), (19, 15), (19, 16)):
            s.px(x, y, c("hot"))
        s.px(20, 15, c("glow"))
        s.px(20, 16, c("glow"))
    chute32(s, x0=27)


def build():
    export("boiler", mk(16, 16, 4, draw_boiler), 8)
    export("steam_engine", mk(16, 16, 4, draw_steam_engine), 10)
    export("pole", mk(16, 16, 1, draw_pole), 0)
    export("generator", mk(16, 16, 4, draw_generator), 12)
    export("kiln", mk(16, 16, 4, draw_kiln), 8)
    export("mixer", mk(16, 16, 4, draw_mixer), 8)
    export("refinery", mk(16, 16, 4, draw_refinery), 6)
    export("smelter_mk2", mk(32, 32, 4, draw_smelter_mk2), 8)
    export("press_mk2", mk(32, 32, 4, draw_press_mk2), 8)
    export("assembler_mk2", mk(32, 32, 4, draw_assembler_mk2), 8)
