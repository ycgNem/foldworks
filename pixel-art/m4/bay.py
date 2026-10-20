"""mega_bay (32x32 x6): the Megaproject Bay on the Factory floor, and the Great Drill built in it.

    empty   the bare pad: a concrete slab with a hazard-striped front edge, a blue crane gantry
            (two posts and a beam with a trolley), the bore pit with a gold dashed target ring,
            and the empty hook hanging on its cable.
    stage1  about a third: the spiral bit stands in the pit; the hook lowers the brass collar;
            a parts crate and a traffic cone on the pad say "site".
    stage2  about two thirds: bit + collar + the lower motor housing with its wiring showing;
            the hook lowers the cap.
    stage3  complete and idle: the copper motor head is capped and hooked to the trolley, its
            vents dark, the beacon on the beam unlit.
    run1/2  the Great Drill running: flutes turn (a 2 px phase shift reads as spin), vents and
            the beacon flash hot, the pit glows, dust puffs at the lip and sparks fly.

Reads as "the big special thing" among 16x16 modules by size (a full 2x2), by being the only
floor object with a tall structure (the gantry frames it like a doorway) and by its colours:
blue steel, a copper-and-gold drill, a hazard front. The top-right 4x4 holds only the beam's
plain end (calm for the pip).
"""
import math
from common_m4 import P, new, ell, fw

c = fw.c
k = P["ink"]


def px(s, x, y, slot):
    if 0 <= x < 32 and 0 <= y < 32:
        s.px(x, y, c(slot))


# ----------------------------------------------------------------------------- the pad
def pad(s):
    fw.box(s, 0, 4, 31, 31, "hull1", "hull2", "hull0", hi="hull3", chamfer=2)
    # the front face: hazard stripes (brass and ink), a dark foot
    for y in (27, 28, 29):
        for x in range(1, 31):
            px(s, x, y, "brass1" if (x - y) % 4 < 2 else "ink")
    s.line(1, 26, 30, 26, c("hull0"))
    s.line(2, 30, 29, 30, c("shadow"))
    for x in (1, 30):
        px(s, x, 27, "hull0"); px(s, x, 28, "hull0"); px(s, x, 29, "hull0")
    # concrete: slab seams and a little grit
    s.line(2, 17, 29, 17, c("hull0"))
    s.line(2, 18, 29, 18, c("hull2"))
    s.line(2, 9, 29, 9, c("hull0"))
    s.line(2, 10, 29, 10, c("hull2"))
    for (x, y) in ((8, 13), (22, 14), (12, 21), (25, 23), (7, 24), (19, 12), (27, 20), (9, 7)):
        px(s, x, y, "hull0")
    for (x, y) in ((9, 13), (23, 14), (6, 20), (26, 12), (23, 7)):
        px(s, x, y, "hull2")


def pit(s, glow=0):
    """The bore: a dark ellipse with a steel lip. glow 0 cold, 1/2 two hot phases."""
    cx, cy = 16.0, 23.5
    for y in range(19, 28):
        for x in range(4, 28):
            u, v = (x + 0.5 - cx) / 8.6, (y + 0.5 - cy) / 3.2
            d = u * u + v * v
            if d <= 1.0:
                if d > 0.62:
                    col = "hull0" if v < 0 else "hull2"          # lip: far side in shade, near side lit
                else:
                    col = "ink" if v < -0.15 else "shadow"
                    if glow and d < 0.45 and v > -0.4:
                        col = ("copper0", "glow", "hot")[min(2, int((0.45 - d) * 6.5) + (glow - 1))]
                px(s, x, y, col)


def target(s):
    """The gold dashed ring painted round the empty pit."""
    cx, cy = 16.0, 23.0
    pts = []
    for i in range(64):
        a = i / 64 * math.tau
        pts.append((int(cx + 10.6 * math.cos(a)), int(cy + 4.4 * math.sin(a))))
    seen = []
    for p in pts:
        if p not in seen:
            seen.append(p)
    for i, (x, y) in enumerate(seen):
        if 6 <= x <= 25 and 10 <= y <= 26 and i % 4 < 2:
            px(s, x, y, "brass1")
    for (x, y) in ((16, 15), (16, 16), (15, 17), (16, 17), (17, 17)):
        px(s, x, y, "brass1")                                    # an arrow pointing in
    px(s, 16, 15, "gold")


# ----------------------------------------------------------------------------- the gantry
def gantry(s, beacon=None):
    # two posts: blue steel, a lattice of dark braces, foot plates on the pad
    for x0 in (1, 26):
        fw.box(s, x0, 3, x0 + 4, 27, "iron1", "iron2", "iron0", chamfer=0)
        for y in range(7, 25, 4):
            px(s, x0 + 2, y, "iron0")
            px(s, x0 + 1, y + 1, "iron0"); px(s, x0 + 3, y + 1, "iron0")
            px(s, x0 + 2, y + 2, "iron0")
        s.rect(x0 - 1, 25, x0 + 5, 27, c("ink"))                 # foot plate
        s.line(x0, 25, x0 + 4, 25, c("hull2"))
        s.line(x0, 26, x0 + 4, 26, c("hull0"))
        px(s, x0, 26, "brass1"); px(s, x0 + 4, 26, "brass1")
    # the beam
    fw.box(s, 0, 1, 31, 6, "iron1", "iron2", "iron0", hi="hull3", chamfer=1)
    for x in range(4, 28, 4):
        px(s, x, 3, "iron2")
        px(s, x, 4, "iron0")
    s.line(2, 5, 29, 5, c("iron0"))
    # the trolley under the beam, centred
    fw.box(s, 12, 5, 19, 8, "hull2", "hull3", "hull1", chamfer=1)
    px(s, 14, 6, "ink"); px(s, 17, 6, "ink")
    # the beacon on top of the beam
    s.rect(14, 0, 17, 1, c("ink"))
    px(s, 15, 0, beacon or "copper0"); px(s, 16, 0, beacon or "copper0")
    if beacon:
        px(s, 15, 1, "gold"); px(s, 16, 1, "glow")


def cable(s, y1, x=16):
    for y in range(9, y1 + 1):
        px(s, x - 1, y, "ink")
        px(s, x, y, "hull2")
        px(s, x + 1, y, "ink")


def hook(s, y):
    """The crane hook: a little brass J hanging at row y."""
    fw.blit(s, 14, y, [
        ".###.",
        "#yyu#",
        ".#y#.",
        "#.y#.",
        "#uy#.",
        ".##..",
    ])


# ----------------------------------------------------------------------------- the drill
def bit(s, phase=0, top=16, bottom=25):
    """The spiral bit: a cone, wide at `top`, a point at `bottom`, flutes in steel."""
    pts = {}
    for y in range(top, bottom + 1):
        half = 5.4 * (bottom + 0.8 - y) / (bottom + 0.8 - top)
        for x in range(32):
            u = x + 0.5 - 16
            if abs(u) <= half + 0.01:
                pts[(x, y)] = u / max(half, 0.5)
    for (x, y) in fw.ring_of(set(pts)):
        if (x, y) not in pts:
            px(s, x, y, "ink")
    for (x, y), u in pts.items():
        band = (x + y + phase) % 4
        col = ("hull3", "hull2", "hull1", "ink")[band]
        if u > 0.3:                                               # the shaded side, one step down
            col = {"hull3": "hull2", "hull2": "hull1", "hull1": "hull0"}.get(col, col)
        px(s, x, y, col)


def collar(s, y=14):
    fw.box(s, 8, y, 23, y + 2, "brass1", "gold", "brass0", hi="hot", chamfer=1)
    for x in (10, 13, 18, 21):
        px(s, x, y + 1, "brass0")
    px(s, 15, y + 1, "hot"); px(s, 16, y + 1, "gold")


def housing_low(s):
    """The motor housing's lower half, open at the top: copper sides, wiring inside."""
    s.rect(9, 11, 22, 14, c("ink"))
    s.rect(10, 11, 21, 13, c("copper1"))
    s.line(10, 11, 10, 13, c("copper2"))
    s.line(21, 11, 21, 13, c("copper0"))
    s.line(11, 11, 20, 11, c("shadow"))                           # the open top: wires
    for x, col in ((12, "teal1"), (14, "copper2"), (16, "leaf"), (18, "teal1"), (20, "copper2")):
        px(s, x, 11, col)
        px(s, x, 10, col)
    s.line(9, 10, 9, 10, c("ink"))
    px(s, 12, 9, "teal1"); px(s, 16, 9, "leaf")


def head(s, vents=0, dy=0):
    """The full motor head (rows 8..13 + dy): copper box, three vents, a steel cap."""
    y0 = 8 + dy
    fw.box(s, 9, y0, 22, y0 + 6, "copper1", "copper2", "copper0", hi="hot", chamfer=1)
    fw.box(s, 12, y0 - 1, 19, y0 + 1, "hull2", "hull3", "hull1", chamfer=1)  # the cap, where the hook bites
    cols = [("shadow", "shadow"), ("glow", "hot"), ("hot", "glow")][vents]
    for i, x in enumerate((11, 15, 19)):
        s.rect(x, y0 + 3, x + 1, y0 + 4, c("ink"))
        px(s, x, y0 + 3, cols[i % 2])
        px(s, x + 1, y0 + 3, cols[(i + 1) % 2])
        if vents:
            px(s, x, y0 + 4, "glow")
            px(s, x + 1, y0 + 4, "copper1")
    px(s, 10, y0 + 5, "brass1"); px(s, 21, y0 + 5, "brass1")      # rivets


def cap_hanging(s, y):
    """The cap plate on its way down (stage 2)."""
    fw.box(s, 12, y, 19, y + 2, "hull2", "hull3", "hull1", chamfer=1)


def crate(s, x0=6, y0=8):
    fw.blit(s, x0, y0, [
        "#####",
        "#ppp#",
        "#hGh#",
        "#GhG#",
        "#####",
    ])


def cone(s, x0=22, y0=8):
    fw.blit(s, x0, y0, [
        "..#..",
        ".#o#.",
        ".#W#.",
        "#ooo#",
        "#####",
    ])


def dust(s, f):
    pts = [((6, 22), (25, 21), (7, 25), (24, 25), (10, 20), (22, 19)),
           ((5, 23), (26, 23), (9, 26), (23, 26), (8, 20), (21, 20))][f]
    for i, (x, y) in enumerate(pts):
        px(s, x, y, ("hull3", "hull2", "ground2")[i % 3])
        if i < 2:
            px(s, x + (1 if f else -1), y - 1, "hull2")


def sparks(s, f):
    sets = [((7, 18, "hot"), (8, 19, "gold"), (24, 16, "hot"), (23, 17, "glow"), (9, 15, "gold"),
             (25, 20, "glow")),
            ((6, 16, "hot"), (7, 17, "glow"), (25, 18, "hot"), (24, 19, "gold"), (22, 14, "gold"),
             (8, 21, "glow"))][f]
    for (x, y, col) in sets:
        px(s, x, y, col)


# ----------------------------------------------------------------------------- frames
NAMES = ["empty", "stage1", "stage2", "stage3", "run1", "run2"]


def draw(s, f):
    """Each piece on its own layer, so a piece's chamfered corners never cut a hole in what is
    under it (fw.box clears its corners)."""
    name = NAMES[f]
    run = name.startswith("run")
    r = 1 if name == "run2" else 0
    s.layer("main")
    pad(s)
    s.layer("site")
    pit(s, glow=(r + 1) if run else 0)
    if name == "empty":
        target(s)
    if name in ("stage1", "stage2"):
        crate(s, 5, 11)
        cone(s, 21, 11)
    s.layer("gantry")
    gantry(s, beacon=(("hot" if r == 0 else "glow") if run else None))
    s.layer("bit")
    if name != "empty":
        bit(s, (2 * r) if run else 0)
    s.layer("collar")
    if name == "stage1":
        collar(s, 9)                                              # the collar coming down
    elif name != "empty":
        collar(s)
    s.layer("head")
    if name == "empty":
        cable(s, 12)
        hook(s, 12)
    elif name == "stage1":
        pass                                                      # the collar hangs from the trolley
    elif name == "stage2":
        housing_low(s)
        s.layer("cap")
        cap_hanging(s, 8)
    else:
        head(s, vents=(r + 1) if run else 0)
    if run:
        s.layer("fx")
        # the near lip of the pit, drawn over the bit's point: it is boring in
        for x in range(12, 21):
            px(s, x, 26, "hull2")
        dust(s, r)
        sparks(s, r)
    s.layer("main")


def build():
    s = new(32, 32, 6)
    for f in range(6):
        s.frame(f + 1)
        draw(s, f)
    s.frame(1)
    return s
