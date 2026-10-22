"""Module skins: one sheet per floor, because each floor draws its own module sheet in its place
(src/render/factory.ts: `module`, 16x16 x1; src/render/district.ts drawModule: `hart(floor,
'module')` = `dist_module` on the District, `world_module` on the World, `beyond_module` on Beyond,
16x16 x4, 6 fps, the icon at (4, 6)). So a module skin <id> ships

    skin_<id>_module  skin_<id>_dist_module  skin_<id>_world_module  skin_<id>_beyond_module

each a full replacement of that sheet (the floor's roof or dome kept, so the floor still reads;
the brass band, the module's cue, is what changes). The icon well (x 3..12) stays ink1 and its
icon spot untouched; the top-right pip corner stays calm; the Factory's `module_glow` and
`module_od` overlays still fit (the band keeps its place).

Band geometry: x 1..14 (lit columns 1-2 on the left, shade 13-14 on the right); rows 1..14 on the
Factory, rows 5..14 on the high floors (their roof or dome above); the dog-ear fold bottom-left.
"""
from draw import rm, shape
from m11 import skin

SHEETS = ["module", "dist_module", "world_module", "beyond_module"]
BRASS = ("brass0", "brass1", "brass2", "brass3")


def top(f):
    return 1 if f.meta["frames"] == 1 else 5


def band(f, x, y):
    """Is (x, y) on the brass band (not the well, not the outline)?"""
    t = top(f)
    if not (1 <= x <= 14 and t <= y <= 14):
        return False
    return not (3 <= x <= 12 and t + 2 <= y <= 12)


def well_ok(f, x, y):
    return not (3 <= x <= 12 and top(f) + 1 <= y <= 13)


# ------------------------------------------------------------------ triad
def triad(f):
    """Three stripes on every module: a frog (green) down the left, a press (steel) along the
    bottom, a furnace (copper) down the right below the pip corner; the brass top stays."""
    t = top(f)
    for x in range(1, 15):
        for y in range(t, 15):
            n = f.name(x, y)
            if n not in BRASS or not band(f, x, y) or f.pip(x, y):
                continue
            lit = n in ("brass3", "brass2")
            if x <= 2 and y < 13:
                f.put(x, y, "moss5" if x == 1 else "moss3")
            elif y >= 13:
                f.put(x, y, "steel3" if y == 13 else "steel1")
            elif x >= 13 and y > t + 1:
                f.put(x, y, "copper2" if x == 13 else "copper0")


# ------------------------------------------------------------------ pocket square
def pocket_square(f):
    """A module with a folded handkerchief in its top pocket: a pocket slit on the band's upper
    left and a bone-and-red square poking out of it, two points up."""
    t = top(f)
    y = t + 2 if t == 1 else t + 1
    shape(f, 1, y - 1, ["r.b.", "brbr", "kkkk"], {"r": "red", "b": "bone", "k": "ink1"}, avoid_pip=True)
    f.put(1, y - 2, "ink") if t == 1 else None


# ------------------------------------------------------------------ whittled
def whittled(f):
    """Carved by hand: the band in pale wood with its grain, knife facets, the maker's initials
    cut into the bottom edge."""
    f.recolour(rm(brass3="wood5", brass2="wood4", brass1="wood3", brass0="wood2"))
    t = top(f)
    for x in range(1, 15):
        for y in range(t, 15):
            n = f.name(x, y)
            if n in ("wood4", "wood5") and band(f, x, y) and (x * 3 + y) % 7 == 0:
                f.put(x, y, "wood3")
    # the initials: two little ink cuts on the bottom band, left of centre
    for x, y in ((5, 14), (6, 13), (8, 13), (8, 14), (9, 14)):
        if f.name(x, y) in ("wood2", "wood3"):
            f.put(x, y, "wood1")


# ------------------------------------------------------------------ gold seal
def gold_seal(f):
    """The Inspector's own seal: the band gilded a step brighter and a red-ribboned gold seal on
    the bottom-right corner."""
    f.recolour(rm(brass1="brass2", brass2="lamp2", brass3="lamp3"))
    shape(f, 10, 11, [".kkk.", "kGgGk", "kgLgk", "kGgGk", ".rkr.", ".r.r."],
          {"k": "ink", "G": "brass2", "g": "lamp2", "L": "lamp3", "r": "red"}, avoid_pip=True)


# ------------------------------------------------------------------ blueprint
def blueprint(f):
    """White lines on blue, like the plan they were: the band in plan blue, a white line drawn
    round the well and along the outer edge, a dimension tick at the bottom."""
    f.recolour(rm(brass3="iron1", brass2="iron1", brass1="iron0", brass0="iron0"))
    t = top(f)
    for x in range(1, 15):
        for y in range(t, 15):
            if not band(f, x, y) or f.pip(x, y):
                continue
            inner = ((x == 2 or x == 13) and t + 1 <= y <= 13) or ((y == t + 1 or y == 13) and 2 <= x <= 13)
            if inner:
                f.put(x, y, "cloud3" if x == 2 or y == t + 1 else "cloud2")
    # dimension ticks on the bottom edge
    for x in (4, 8, 11):
        if f.name(x, 14) in ("iron0", "iron1"):
            f.put(x, 14, "cloud2")


# ------------------------------------------------------------------ origami
def origami(f):
    """Creased like paper cranes: the band in folded orange paper, lit on one side of each crease,
    shaded on the other, the creases running in from the corners."""
    t = top(f)
    for x in range(1, 15):
        for y in range(t, 15):
            n = f.name(x, y)
            if n not in BRASS or not band(f, x, y):
                continue
            # facets: which side of the corner diagonals the pixel lies on
            lit = (x - 1) <= (y - t) if y - t < 8 else (x + y) % 16 < 8
            c = "copper3" if n in ("brass3", "brass2") and lit else "copper2" if n in ("brass3", "brass2") else "copper1"
            if (x - 1) == (y - t) or (14 - x) == (y - t):
                c = "bone"
            if f.pip(x, y):
                c = "copper1"
            f.put(x, y, c)


# ------------------------------------------------------------------ postmark
def postmark(f):
    """Franked: the outline perforated like a stamp, wavy cancellation lines across the band and a
    round date stamp on the bottom-right."""
    t = top(f)
    # perforations: every other pixel of the outer ink edge opened, sides and bottom
    for y in range(t + 1, 15, 2):
        for x in (0, 15):
            if f.name(x, y) == "ink" and not f.pip(x, y):
                f.put(x, y, None)
    for x in range(1, 15, 2):
        if f.name(x, 15) == "ink":
            f.put(x, 15, None)
    # the wavy lines across the top band
    for x in range(1, 15):
        y = t + (0 if (x // 2) % 2 else 1)
        if f.name(x, y) in BRASS and not f.pip(x, y):
            f.put(x, y, "ink2")
    # the date stamp ring
    shape(f, 10, 10, [".kk.", "k..k", "k..k", ".kk."], {"k": "ink2"}, avoid_pip=True)


# ------------------------------------------------------------------ ghostly
def ghostly(f):
    """Pale, quiet modules: the band in cloud-pale blue, the outline gone soft, the lamps out, a
    ghost's hem along the bottom."""
    f.recolour(rm(brass3="cloud2", brass2="cloud1", brass1="cloud0", brass0="steel3",
                  lamp3="cloud2", lamp2="cloud1", lamp1="cloud0", lamp0="steel3", copper2="cloud0", copper1="steel3",
                  copper0="steel2", copper3="cloud1", violet="cloud1", slag1="steel3"))
    for x, y in list(f.opaque()):
        if f.name(x, y) == "ink" and (x in (0, 15) or y in (0, 15)) and well_ok(f, x, y):
            f.put(x, y, "steel1")
    # the hem: scallops cut out of the bottom row
    for x in range(0, 16):
        if x % 4 == 1:
            f.put(x, 15, None)
        if x % 4 in (0, 2) and f.name(x, 15):
            f.put(x, 15, "steel2")


SKINS = [("triad", triad), ("pocketSquare", pocket_square), ("whittled", whittled), ("goldLeaf", gold_seal),
         ("blueprint", blueprint), ("origami", origami), ("postmark", postmark), ("ghostly", ghostly)]


def build():
    for sid, fn in SKINS:
        for b in SHEETS:
            skin(sid, b, fn, on_skid=False)
