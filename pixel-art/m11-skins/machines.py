"""The Workshop buildings' skins (src/data/cosmetics.ts is the brief for each look).

Each is the base sheet recoloured by ramp (never the skid, the ink, the lamps that say "working",
or the workpieces) plus a few pixels placed by hand relative to the body's box in that facing.
Facings: rows east, south, west, north (south shows the front)."""
from draw import RAMPS, body_bbox, body_px, h, rm, shape
from m11 import skin

R = RAMPS


# ------------------------------------------------------------------ chrome (smelter, Mk2)
def chrome(f):
    """UNIT 7 polished it: the brick and the iron frame turned to mirror steel, a diagonal glint."""
    f.recolour(rm(steel0="steel1", steel1="steel2", steel2="steel4", wood2="steel3", copper0="steel2",
                  wood0="steel1", brass3="cloud3"))
    big = f.w == 32
    per = 11 if big else 8
    for x, y, n in list(body_px(f)):
        if f.pip(x, y):
            continue
        k = (x + y + f.row * 3) % per
        if n == "steel3" and k == 0:
            f.put(x, y, "cloud3")
        elif n == "steel3" and k == 1:
            f.put(x, y, "steel4")
        elif n == "steel4" and k == 0:
            f.put(x, y, "cloud3")
    # Unit 7's reflection: two teal eyes on the mirror, looking back (Mk2 only: room for it)
    if big:
        bb = body_bbox(f)
        if bb:
            x0, y0, x1, y1 = bb
            cx = x0 + 5
            cy = y0 + (y1 - y0) // 2
            for dx in (0, 3):
                if f.name(cx + dx, cy) in ("steel3", "steel4", "cloud3", "steel2"):
                    f.put(cx + dx, cy, "teal")


# ------------------------------------------------------------------ filigree (steam engine, generator)
CURL = ["bb.", "..b", "bb."]


def filigree(f):
    """Brass curls on every pipe, darling: plum lacquer, gold piping along every top edge, a scroll
    on the broadest face."""
    lac = ("slag0", "slag1")
    f.recolour(rm(steel0="slag0", steel1="slag1", steel2="slag1", ink1="ink2", wood0="earth0"))
    for x, y, n in list(body_px(f)):
        if f.pip(x, y) or n not in lac:
            continue
        up = f.name(x, y - 1)
        if up in (None, "ink", "ink2") and f.name(x, y + 1) in lac:
            f.put(x, y, "brass2" if n == "slag1" else "brass1")
    # one scroll where a 3x3 of lacquer is free (searched from the lower left, away from the pip)
    for y in range(f.h - 5, 2, -1):
        done = False
        for x in range(1, f.w - 6):
            if all(f.name(x + i, y + j) in lac and not f.on_skid(x + i, y + j) for i in range(3) for j in range(3)):
                shape(f, x, y, CURL, {"b": "brass2"})
                done = True
                break
        if done:
            break


# ------------------------------------------------------------------ arc light (pole)
def arclight(f):
    """Poles that crackle a little at dusk: a steel mast, glass insulators, a lamp on top, a spark."""
    f.recolour(rm(earth2="steel2", wood1="steel1", earth1="steel0", wood3="water4", wood4="teal", steel4="cloud3"))
    bb = body_bbox(f)
    if not bb:
        return
    x0, y0, x1, y1 = bb
    # the lamp: the mast's top cap glows
    top = [(x, y) for x, y in f.opaque() if y == y0 and f.name(x, y) != "ink"]
    if top:
        cx = sorted(top)[len(top) // 2][0]
        f.put(cx, y0, "lamp3")
        if f.name(cx, y0 - 1) is None or f.name(cx, y0 - 1) == "ink":
            f.put(cx, y0 - 1, "lamp2")
    # the spark: a little bolt jumping off the left end of the crossarm (the pip is on the right)
    ins = [(x, y) for x, y in f.opaque() if f.name(x, y) in ("teal", "water4") and x < f.w // 2]
    if ins:
        ix, iy = min(ins)
        for dx, dy, c in ((1, -4, "iron2"), (0, -3, "lamp3"), (1, -2, "lamp3"), (0, -1, "teal")):
            x, y = ix + dx, iy + dy
            if 0 <= x < f.w and 0 <= y < f.h and f.name(x, y) is None:
                f.put(x, y, c)


# ------------------------------------------------------------------ trench coat (crate)
def trenchcoat(f):
    """A Buffer Crate in a coat and a hat. Nobody asks what is in it."""
    f.recolour(rm(earth2="wood4", wood2="wood3", earth1="wood3", earth0="wood2", lamp0="wood4",
                  steel1="wood2", steel2="wood3"))
    # the coat's belt across the front, a brass buckle
    for x in range(1, 15):
        if f.name(x, 10) and f.name(x, 10) != "ink":
            f.put(x, 10, "wood1")
    shape(f, 7, 9, ["bb", "bb"], {"b": "brass2"}, avoid_pip=False)
    f.put(8, 10, "brass1")
    # lapels: a dark V down from the lid, buttons
    for d in range(3):
        f.put_over(5 + d, 6 + d, "wood2")
        f.put_over(10 - d, 6 + d, "wood2")
    f.put_over(5, 12, "ink1")
    f.put_over(10, 12, "ink1")
    # the hat: a dark fedora on the lid, its band in wood
    shape(f, 2, 0, ["..kkkkkkk..",
                    "..kSSSSsk..",
                    "..kbbbbbk..",
                    "kkkkkkkkkkk",
                    "kSSSSSSSssk",
                    ".kkkkkkkkk."],
          {"k": "ink", "S": "steel2", "s": "steel1", "b": "red"}, avoid_pip=False)


# ------------------------------------------------------------------ contraband (splitter, merger)
def contraband(f):
    """Unmarked, unpainted: bare primer brown, the stencil scratched off. The chevrons stay."""
    f.recolour(rm(steel2="earth2", steel3="earth3", steel1="earth1", steel0="earth0"))
    bb = body_bbox(f)
    if bb:
        x0, y0, x1, y1 = bb
        y = y1 - 2
        for x in range(x0 + 3, x0 + 7):
            if f.name(x, y) in ("earth1", "earth2", "earth0") and (x + y) % 3:
                f.put(x, y, "ink2")


# ------------------------------------------------------------------ mittens, ember (furnace)
MITT = [".kk..", "kmmk.", "kmmkk", "kmmmk", "kcck.", ".kk.."]


def mittens(f):
    """The Hand Furnace in knitted mittens: blue wool mittens, a bone cuff, a knitted band."""
    bb = body_bbox(f)
    if not bb:
        return
    x0, y0, x1, y1 = bb
    my = y0 + (y1 - y0) // 2 - 1
    key = {"k": "ink", "m": "iron1", "c": "bone"}
    shape(f, x0 - 2, my, [r[::-1] for r in MITT], key)
    shape(f, x1 - 2, my, MITT, key)
    # a highlight on each mitten (top-left lit)
    f.put(x0, my + 1, "iron2")
    if not f.pip(x1 - 1, my + 1):
        f.put(x1 - 1, my + 1, "iron2")
    # the knit band round the pot, just under the rim: a bone zigzag in red wool
    by = y0 + 3
    for x in range(x0 + 2, x1 - 1):
        for dy in (0, 1):
            n = f.name(x, by + dy)
            if n in ("copper1", "copper2", "copper0", "copper3", "wood1", "wood2", "wood3") and not f.pip(x, by + dy):
                f.put(x, by + dy, "bone" if (x + dy) % 2 == 0 else "red")


def ember(f):
    """The first furnace, glowing a little brighter: the copper runs hot, embers in the cracks."""
    f.recolour(rm(copper2="lamp1", copper1="lamp0", copper0="copper1", copper3="lamp2", wood2="copper1"))
    for x, y, n in list(body_px(f)):
        if f.pip(x, y) or n not in ("lamp0", "copper1"):
            continue
        if h(x, y, f.row, 5) % 9 == 0:
            f.put(x, y, "lamp2" if (f.i + x) % 2 else "lamp3")
    bb = body_bbox(f)
    if bb:
        x0, y0, x1, y1 = bb
        # sparks rising off the top (left of the pip corner), one step a frame
        for k, sx in enumerate((x0 + 3, x0 + 6)):
            sy = y0 - 1 - ((f.i + k * 2) % 3)
            if 0 <= sy and f.name(sx, sy) is None and not f.pip(sx, sy):
                f.put(sx, sy, "lamp2" if (f.i + k) % 2 else "lamp1")


# ------------------------------------------------------------------ thrifty (boiler)
PATCH = ["sss", "sts", "sss"]


def thrifty(f):
    """A patched Boiler that has never wasted a lump: dull copper, three patches, bone stitches."""
    f.recolour(rm(copper3="copper2"))
    bb = body_bbox(f)
    if not bb:
        return
    x0, y0, x1, y1 = bb
    spots = [(x0 + 2, y0 + 4, "steel2", "steel3"), (x0 + (x1 - x0) // 2 + 1, y0 + 7, "wood3", "wood4"),
             (x0 + 4, y1 - 4, "moss3", "moss4")]
    for px, py, a, b in spots:
        ok = sum(1 for j in range(3) for i in range(3)
                 if f.name(px + i, py + j) not in (None, "ink", "ink1") and not f.on_skid(px + i, py + j))
        if ok < 7:
            continue
        for j in range(3):
            for i in range(3):
                x, y = px + i, py + j
                if f.pip(x, y) or f.name(x, y) in (None, "ink") or f.on_skid(x, y):
                    continue
                f.put(x, y, b if j == 0 else a)
        for x, y in ((px - 1, py), (px + 3, py + 2), (px + 1, py + 3)):
            if f.name(x, y) not in (None, "ink") and not f.pip(x, y) and not f.on_skid(x, y):
                f.put(x, y, "bone")


# ------------------------------------------------------------------ spotless (mixer)
STAR = [".s.", "sSs", ".s."]


def spotless(f):
    """A Mixer so clean you could eat concrete off it: a white drum, bright steel, a twinkle."""
    f.recolour(rm(lamp2="cloud3", lamp1="cloud2", copper2="cloud1", copper1="cloud0", copper0="steel2",
                  steel0="steel1", steel1="steel2", steel2="steel3", steel3="steel4", wood2="steel2", wood0="steel1",
                  wood3="steel3"))
    bb = body_bbox(f)
    if not bb:
        return
    x0, y0, x1, y1 = bb
    spots = [(x0 - 1, y0), (x0 + 2, y1 - 5)]
    sx, sy = spots[f.i % 2]
    if f.i % 4 != 3:
        shape(f, sx, sy, STAR, {"s": "sky4", "S": "cloud3"})


# ------------------------------------------------------------------ vintage (smelter, press, assembler)
def vintage(f):
    """Riveted, dented, beloved: old machine-shop green, brass rivets, a dent, a spot of rust."""
    f.recolour(rm(R["steel"], ["moss0", "moss1", "moss2", "moss3", "moss4"]))
    bb = body_bbox(f)
    if not bb:
        return
    x0, y0, x1, y1 = bb
    step = 3 if f.w == 16 else 4
    green = ("moss2", "moss3", "moss4", "moss1", "moss0")
    for x in range(x0 + 1, x1, step):
        for y in (y0 + 1,):
            if f.name(x, y) in green and not f.pip(x, y):
                f.put(x, y, "brass2")
    # rivets down the lower left too
    for y in range(y0 + 3, y1 - 1, step):
        x = x0 + 1
        if f.name(x, y) in green and not f.pip(x, y):
            f.put(x, y, "brass1")
    # the dent: a dark pixel with its lit lip; the rust: one spot low on the right
    dx, dy = x0 + (x1 - x0) // 2, y0 + (y1 - y0) // 2 + 1
    if f.name(dx, dy) in green:
        f.put(dx, dy, "moss1")
        if f.name(dx + 1, dy + 1) in green:
            f.put(dx + 1, dy + 1, "moss5")
    rx, ry = x1 - 2, y1 - 2
    if f.name(rx, ry) in green and not f.on_skid(rx, ry):
        f.put(rx, ry, "copper1")


# ------------------------------------------------------------------ circuitry (assembler)
def circuitry(f):
    """Green, with tiny gold tracks that go nowhere: a circuit board in teal-green, brass traces."""
    f.recolour(rm(R["steel"], ["water0", "water1", "water2", "water3", "water4"]))
    board = ("water2", "water3", "water1", "water0")
    for x, y, n in list(body_px(f)):
        if f.pip(x, y) or n not in board:
            continue
        # a pad every few pixels, a trace running right then down from it, ending nowhere
        gx, gy = (x + f.row) % 5, (y + 2 * f.row) % 4
        if gx == 0 and gy == 0:
            f.put(x, y, "lamp3" if n == "water3" else "brass3")
        elif gy == 0 and gx in (1, 2):
            f.put(x, y, "brass3" if n == "water3" else "brass2")
        elif gx == 2 and gy == 1:
            f.put(x, y, "brass2")


# ------------------------------------------------------------------ pinstripe, apron (assembler Mk2)
def pinstripe(f):
    """A big Assembler in a sharp suit: charcoal, chalk pinstripes, a white shirt and a red tie."""
    f.recolour(rm(steel0="ink2", steel1="steel0", steel2="steel1", steel3="steel2", steel4="steel3"))
    for x, y, n in list(body_px(f)):
        if f.pip(x, y):
            continue
        if n in ("ink2", "steel0") and x % 3 == 0:
            f.put(x, y, "steel1" if n == "ink2" else "steel2")
    bb = body_bbox(f)
    if not bb:
        return
    x0, y0, x1, y1 = bb
    cx = (x0 + x1) // 2 - 2
    ty = y0 + 3
    if f.row == 3:
        return                                   # the north facing shows the suit's back
    # the shirt's V and the tie, over the front
    shape(f, cx - 2, ty, ["ww.ww",
                          ".wrw.",
                          "..r..",
                          ".rRr.",
                          ".rRr.",
                          "..r.."], {"w": "bone", "r": "red", "R": "copper1"}, only="opaque")


def apron(f):
    """A chef's apron, a little mustard on it, its strings round the waist."""
    bb = body_bbox(f)
    if not bb:
        return
    x0, y0, x1, y1 = bb
    cx = (x0 + x1) // 2 - 1
    top = y0 + (y1 - y0) // 3
    # the strings across the waist
    for x in range(x0 + 1, x1):
        if f.name(x, top) in ("steel0", "steel1", "steel2", "steel3") and not f.pip(x, top):
            f.put(x, top, "bone")
    # the bib and skirt
    for y in range(top - 3, y1 - 1):
        half = 2 if y < top else 4
        for x in range(cx - half, cx + half + 1):
            n = f.name(x, y)
            if n not in ("steel0", "steel1", "steel2", "steel3") or f.pip(x, y) or f.on_skid(x, y):
                continue
            c = "cloud3" if x == cx - half else "pave3" if x == cx + half else "bone"
            if y == y1 - 2:
                c = "pave2"
            f.put(x, y, c)
    # the pocket and the mustard
    for x in range(cx - 2, cx + 1):
        if f.name(x, top + 3) == "bone":
            f.put(x, top + 3, "pave3")
    for x, y in ((cx + 2, top + 2), (cx + 3, top + 2), (cx + 2, top + 3)):
        if f.name(x, y) in ("bone", "pave3"):
            f.put(x, y, "lamp2" if (x, y) != (cx + 2, top + 3) else "brass2")


# ------------------------------------------------------------------ drill bit (miner)
DRILL = [["..t..", ".kak.", ".bbk.", "kbcbk", "kssk."],
         ["..t..", ".kbk.", ".akk.", "kcbbk", "kssk."]]


def drillbit(f):
    """A Miner with a little Great Drill on its hat: a brass spiral cone that turns with the bit."""
    bb = body_bbox(f)
    if not bb:
        return
    x0, y0, x1, y1 = bb
    steel = [(x, y) for x, y, n in body_px(f) if n in ("steel1", "steel2", "steel3") and y <= y0 + 3]
    if not steel:
        return
    xs = sorted(x for x, _ in steel)
    cx = xs[len(xs) // 3]
    top = min(y for x, y in steel if x == cx)
    pic = DRILL[(f.i // 1) % 2]
    shape(f, cx - 2, max(0, top - 3), pic, {"t": "lamp3", "a": "brass3", "b": "brass2", "c": "brass1", "k": "ink",
                                           "s": "steel3"})


# ------------------------------------------------------------------ lily pad (heap)
def lilypad(f):
    """A Slag Heap on a lily pad: a green pad with its notch, a lotus at the rim, a ripple."""
    f.recolour(rm(steel4="moss5", steel3="moss4", steel2="moss3", steel1="moss2", steel0="moss1"))
    # the pad's notch, cut into the front face
    for y in range(9, 13):
        for x in (7, 8):
            if f.name(x, y) in ("moss3", "moss2", "moss4", "moss5", "moss1") and y >= 10 - (0 if x == 7 else 1):
                f.put(x, y, "water2" if y > 10 else "ink")
    # pad veins
    for x, y in ((4, 11), (11, 11), (3, 12), (12, 12)):
        if f.name(x, y) in ("moss3", "moss2"):
            f.put(x, y, "moss4")
    # the lotus on the left rim (the pile never reaches it)
    shape(f, 1, 4, [".v.", "vlv", ".g."], {"v": "violet", "l": "lamp3", "g": "moss5"}, avoid_pip=False)
    shape(f, 0, 4, ["k...k", ".....", "k...k"], {"k": ""}, avoid_pip=False)


# ------------------------------------------------------------------ seedling (seed)
LEAF = [["..kk.", ".kLlk", "kgLk.", "kk..."],
        ["...kk", "..kLk", ".kLlk", "kgkk."]]


def seedling(f):
    """The Seed with a single green leaf: it grows out of the island's side below the pip corner,
    a lily-green blade on a moss stem, nodding with the hum."""
    rock = [(x, y) for x, y in f.opaque() if 7 <= y <= 9 and f.name(x, y) not in (None,)]
    if not rock:
        return
    # the island's right edge at row 8 (its ink rim)
    edge = max(x for x, y in rock if y == 8 and x < 12)
    pic = LEAF[1 if f.i % 4 in (1, 2) else 0]
    shape(f, edge, 6 if pic is LEAF[0] else 5, pic, {"k": "ink", "L": "lily", "l": "moss5", "g": "moss3"}, avoid_pip=False)


def build():
    skin("chrome", "smelter", chrome)
    skin("chrome", "smelter_mk2", chrome)
    skin("filigree", "steam_engine", filigree)
    skin("filigree", "generator", filigree)
    skin("arcLight", "pole", arclight, on_skid=False)
    skin("trenchcoat", "crate", trenchcoat, on_skid=True)
    skin("contraband", "splitter", contraband)
    skin("contraband", "merger", contraband)
    skin("mittens", "furnace", mittens)
    skin("ember", "furnace", ember)
    skin("thrifty", "boiler", thrifty)
    skin("spotless", "mixer", spotless)
    skin("vintage", "smelter", vintage)
    skin("vintage", "press", vintage)
    skin("vintage", "assembler", vintage)
    skin("circuitry", "assembler", circuitry)
    skin("pinstripe", "assembler_mk2", pinstripe)
    skin("apron", "assembler_mk2", apron)
    skin("drillbit", "miner", drillbit)
    skin("lilypad", "heap", lilypad, on_skid=True)
    skin("seedling", "seed", seedling, on_skid=True)


if __name__ == "__main__":
    build()
