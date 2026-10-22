"""The high floors' carriers: skiffs (the District), barges (the World), couriers (Beyond).

    skiff   12x10 x4, 16 fps, anchor (6, 9): a brass hull, a crate, a propeller on a mast (row 0)
    barge   16x12 x4, 16 fps, anchor (8, 11): a longer hull, two crates, a cab at the bow
    courier 16x12 x4, 8 fps, anchor (8, 11): a paper crane carrying a crate

All face right (the renderer flips them for leftward legs). The skin keeps the hull's outline and
size: the carrier still reads by silhouette and by its motion along the route line.
"""
from draw import rm, shape
from m11 import skin

PROP = ("steel4", "steel3", "red", "cloud1", "steel2")


def clear_prop(f, rows=(0,)):
    for y in rows:
        for x in range(f.w):
            if f.name(x, y) in PROP + ("brass2", "brass3"):
                f.put(x, y, None)


# ------------------------------------------------------------------ skiffs
KITE = [[".r.", "rbr", ".r.", "..s", ".s.", "s.."],
        ["..r.", ".rbr", "..r.", "..s.", ".s..", "s..."]]


def kite(f):
    """Skiffs with a kite sail: sky-blue hull, the propeller gone, a red-and-bone kite pulling ahead
    on a bone line from the mast's reel; the kite tugs a pixel to and fro with the wind."""
    clear_prop(f)
    f.recolour(rm(brass3="sky4", brass2="sky2", brass1="sky1"), where=lambda x, y: y >= 6)
    f.recolour(rm(steel3="wood3", steel2="wood2"), where=lambda x, y: y <= 2)
    # the reel at the mast top
    for x in range(f.w):
        if f.name(x, 1) in ("sky4", "sky2"):
            f.put(x, 1, "wood4")
    k = f.i % 4 in (1, 2)
    shape(f, 8 if not k else 7, 0, KITE[0] if not k else KITE[1], {"r": "red", "b": "bone", "s": None},
          avoid_pip=False)
    # the line from the kite's tail down to the reel
    for x, y in ((8, 1) if not k else (8, 1),):
        if f.name(x, y) is None:
            f.put(x, y, "bone")
    # the tail ribbons, streaming back
    for x, y in ((10, 3), (11, 4)) if not k else ((10, 3), (11, 3)):
        if f.name(x, y) is None:
            f.put(x, y, "red" if (x + f.i) % 2 else "bone")


def tug(f):
    """Stubby, strong, never far from home: a red hull with a white sheer line and black boot top,
    two tyre fenders over the side."""
    f.recolour(rm(brass3="bone", brass2="red", brass1="ink2"), where=lambda x, y: y >= 6)
    for x0 in (2, 7):
        shape(f, x0, 7, ["kk", "sk"], {"k": "ink2", "s": "steel2"}, avoid_pip=False)
    # the bow fender: a rope pudding on the stem
    for x, y in ((10, 6), (10, 7)):
        if f.name(x, y):
            f.put(x, y, "wood4")


def paper_crane(f):
    """Folded from paper: a bone hull with its creases, a crane's neck and head at the bow, a
    folded tail at the stern, a paper pinwheel for a propeller."""
    f.recolour(rm(brass3="bone", brass2="pave3", brass1="pave2", lamp2="pave3"), where=lambda x, y: y >= 6)
    f.recolour(rm(steel4="bone", steel3="pave3", steel2="pave2", brass2="red", brass3="bone"), where=lambda x, y: y <= 2)
    for x, y in ((3, 7), (4, 8), (7, 8), (8, 7)):
        if f.name(x, y) in ("pave3", "pave2"):
            f.put(x, y, "pave1")
    # the neck rises from the bow, the head bent forward at its tip
    shape(f, 9, 1, [".kb", ".kb", "kbk", "kb.", "bk."], {"k": "ink", "b": "bone"}, avoid_pip=False)
    f.put(11, 1, "pave3")
    # the tail at the stern
    shape(f, 0, 3, ["b.", "bk", "kb"], {"k": "ink", "b": "bone"}, avoid_pip=False)


# ------------------------------------------------------------------ barges
def stormproof(f):
    """A tarpaulin over the cargo, roped down, a slate-grey hull, and a stubborn captain in a
    yellow sou'wester at the cab."""
    f.recolour(rm(wood5="iron2", wood4="iron1", wood3="iron0", brass2="wood4"), where=lambda x, y: 2 <= y <= 6)
    f.recolour(rm(brass3="steel3", brass2="steel2", brass1="steel1"), where=lambda x, y: y >= 7)
    # the tarp's ropes: the old crate straps, and the crate seams hidden under the sheet
    for x, y in list(f.opaque()):
        if 3 <= y <= 6 and 2 <= x <= 10:
            n = f.name(x, y)
            if n == "ink" and x == 6 and 3 <= y <= 5:
                f.put(x, y, "iron0")
    # the captain's sou'wester on the cab
    shape(f, 12, 2, [".Y.", "yYy"], {"y": "lamp2", "Y": "lamp3"}, avoid_pip=False)


FEATHER = [".....bbbbcc.",
           "qqqqqqqqqqcb",
           "..cccccc....",
           ]


def feather(f):
    """So light it floats on the cloud sea's foam: a cloud-white hull, a great white feather for a
    sail where the propeller was, and foam bubbling along the keel."""
    clear_prop(f, rows=(0, 1))
    for x in range(f.w):
        if f.name(x, 2) in ("steel3",):
            f.put(x, 2, "ink")
    f.recolour(rm(brass3="cloud3", brass2="cloud2", brass1="cloud1"), where=lambda x, y: y >= 7)
    f.recolour(rm(wood5="cloud2", wood4="cloud1", wood3="cloud0", brass2="bone"), where=lambda x, y: y < 7)
    sway = 1 if f.i % 4 in (1, 2) else 0
    shape(f, 2 + sway, 0, FEATHER, {"b": "cloud3", "c": "cloud1", "q": "wood3"}, avoid_pip=False)
    # foam along the keel: the bottom edge bubbles, moving aft
    for x in range(f.w):
        if f.name(x, 11) == "ink":
            k = (x + f.i) % 3
            f.put(x, 11, "cloud3" if k == 0 else "cloud1" if k == 1 else "ink")


# ------------------------------------------------------------------ couriers
GLINTS = [(4, 9), (12, 10), (3, 11), (13, 8), (5, 7), (11, 11), (2, 8), (14, 11)]
GC = ["lamp3", "violet", "teal", "sky3"]


def mirror_ball(f):
    """Couriers that throw little lights across Beyond: a silvered crane carrying a mirror ball,
    a few coloured flecks of light around it, different every frame."""
    f.recolour(rm(bone="cloud3", pave3="steel4", pave2="steel3", pave1="steel2"))
    box = [(x, y) for x, y in f.opaque() if f.name(x, y) in ("wood3", "wood4", "wood5", "brass2", "brass3")]
    if box:
        x0, y0 = min(x for x, _ in box), min(y for _, y in box)
        ball = {(0, 0): "cloud3", (1, 0): "steel4", (2, 0): "steel3", (0, 1): "steel3", (1, 1): "cloud2", (2, 1): "steel2"}
        for (dx, dy), c in ball.items():
            f.put(x0 + dx, y0 + dy, c)
        f.put(x0 + (f.i % 3), y0 + (f.i // 2) % 2, "lamp3")
    for k in range(3):
        x, y = GLINTS[(f.i * 3 + k) % len(GLINTS)]
        if f.name(x, y) is None:
            f.put(x, y, GC[(f.i + k) % len(GC)])


def build():
    skin("kite", "skiff", kite, on_skid=False, pip=False)
    skin("tug", "skiff", tug, on_skid=False, pip=False)
    skin("paperCrane", "skiff", paper_crane, on_skid=False, pip=False)
    skin("stormproof", "barge", stormproof, on_skid=False, pip=False)
    skin("feather", "barge", feather, on_skid=False, pip=False)
    skin("mirrorBall", "courier", mirror_ball, on_skid=False, pip=False)
