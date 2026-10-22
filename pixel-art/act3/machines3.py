"""Act III's machines and chutes (docs/endgame.md, Milestone 7), drawn here pixel by pixel.

- chem_vat 16x16, 4 facings (rows east, south, west, north = the output side), 4 frames at 8 fps:
  chemistry's family look. A squat, straight-walled steel vat with a brass hoop, a flat glass lid
  over lily-green liquid that bubbles, a copper pipe with a red valve out of the output side. Told
  from the kiln (a tall pale clay dome) and the refinery (a tall column) by being wide, low and
  flat-topped, with the only big green on the floor on top.
- greenhouse 32x32, 4 facings, 4 frames at 6 fps: a hipped glass house with white glazing bars on
  a white plinth, lettuces and staked tomato vines behind the glass, a sprinkler's drops falling,
  the heads nodding and a grow light flickering under the brass ridge. The output is a brass
  hatch on the facing side (an end wall east and west, a door at the front for south, a ridge
  hatch for north). On the Mk2 skid.
- chute_mouth 16x16, 4 facings, 4 frames at 8 fps: a brass downpipe from the tile's top edge
  (items arrive from above: ink chevrons on it point down and march down a row a frame) into a
  steel hopper box whose spout opens on the output side. On the skid.
- factory_chute 16x16, 1 facing, 4 frames at 8 fps: a hatch in the Factory's riveted plate
  (tile_factory's steel), hazard-striped, a funnel down to a dark throat, a gold down-arrow
  sinking into it.

Every facing keeps the top-right 4x4 calm (the status pip). Light from the top-left in all four
facings: the output side moves, the shading is redrawn, never flipped.
"""
from c3 import (B0, B1, B2, B3, INK, INK1, INK2, L1, L2, L3, P, S0, S1, S2, S3, S4, get, hline, new, outline,
                put, rect, seat, ship, vline)

DIRS = ["east", "south", "west", "north"]
CU3, CU2, CU1, CU0 = P["copper3"], P["copper2"], P["copper1"], P["copper0"]
PIPE_KEY = {"k": INK, "C": CU3, "x": CU1, "c": CU2, "K": INK1, "v": P["red"]}


def paint(img, ox, oy, rows, key):
    for j, row in enumerate(rows):
        for i, ch in enumerate(row):
            if ch in key:
                put(img, ox + i, oy + j, key[ch])


# ================================================================ the Chem Vat
# the vat, 11 px wide (local x 0..10), rows 3..14 of the tile; bubbles are added per frame
VAT = [
    "..kkkkkkk..",
    ".kRRRRRrrk.",
    "kRlLLLLggqk",
    "kRLLtLLggqk",
    "krLLLLgggqk",
    "kqgGGGGGGQk",
    "kWqqqqqqqQk",
    "kWSSSSSssdk",
    "kWSSSSSssdk",
    "kRrrrrqqQQk",
    "kWSSSSssddk",
    ".kkkkkkkkk.",
]
VAT_KEY = {"k": INK, "R": B3, "r": B2, "q": B1, "Q": B0, "l": P["lily"], "L": P["moss5"], "g": P["moss4"],
           "G": P["moss3"], "t": P["teal"], "W": S4, "S": S3, "s": S2, "d": S1}
# bubbles (local x, row) by frame: each rises a row and pops (lamp3) in turn
BUBBLES = [[(3, 6), (7, 4)], [(4, 5), (7, 7), (6, 3, "pop")], [(4, 3, "pop"), (6, 6)], [(2, 7), (6, 5), (8, 6)]]


def vat_body(img, ox, f):
    paint(img, ox, 3, VAT, VAT_KEY)
    for b in BUBBLES[f % 4]:
        x, y = ox + b[0], 3 + b[1]
        if len(b) == 3:
            put(img, x, y, L3)
        else:
            put(img, x, y, P["bone"])
            put(img, x + 1, y, P["moss4"])


def chem_vat(d, f):
    img = new(16, 16)
    if d == "east":
        vat_body(img, 1, f)
        paint(img, 12, 9, ["..kk", "vkck", "CCcK", "xxcK", "kkck", ".kk."], PIPE_KEY)
    elif d == "west":
        vat_body(img, 4, f)
        paint(img, 0, 9, ["kk..", "kckv", "KcCC", "Kcxx", "kckk", ".kk."], PIPE_KEY)
    elif d == "south":
        vat_body(img, 2, f)
        # the pipe comes out of the front wall and down over the skid to the south edge
        paint(img, 5, 11, [".kkkkv", "kCCxk.", "kCcxkk", "kcccck", "kKKKKk"], PIPE_KEY)
    else:
        # north: the pipe leaves the back of the vat and rises behind the lid to the north edge
        paint(img, 4, 0, ["kKKKKk", "kcccck", ".kCcxkv", ".kCcxk"], PIPE_KEY)
        vat_body(img, 2, f)
    return seat(img)


# ================================================================ the Greenhouse (2x2)
GLASS_HI, GLASS, GLASS_LO = P["sky4"], P["sky3"], P["teal"]
BAR, BAR_LO = P["bone"], P["steel3"]
G0, G1, G2, G3 = (P[f"grass{i}"] for i in range(4))


def lettuce(img, x, y, f, k):
    """A leafy head 4 wide standing on row y, lit top-left; its top nods on its own beat."""
    up = 1 if (f + k) % 4 == 1 else 0
    for dx, dy, c in ((0, -1, G2), (1, -1, G3), (2, -1, G2), (3, -1, G1), (0, 0, G1), (1, 0, G2), (2, 0, G1),
                      (3, 0, G0)):
        put(img, x + dx, y + dy, c)
    put(img, x + 1, y - 2 - up, G3)
    put(img, x + 2, y - 2 - up, G2)
    put(img, x + 1, y - 1, P["lily"])


def vine(img, x, y0, y1, f, k):
    """A staked tomato vine: a cane, leaves either side, two red fruit."""
    vline(img, x, y0, y1, P["wood3"])
    for y in range(y0, y1, 2):
        put(img, x - 1, y + (1 if (f + k) % 4 == 2 else 0), G2)
        put(img, x + 1, y + 1, G1)
    put(img, x + 1, y0 + 2, P["red"])
    put(img, x - 1, y0 + 5, P["red"])


def roof_span(y, ridge, eave, rx0, rx1, ex0, ex1):
    t = (y - ridge) / (eave - ridge)
    return t, round(rx0 - t * (rx0 - ex0)), round(rx1 + t * (ex1 - rx1))


def greenhouse(d, f):
    img = new(32, 32)
    ex0, ex1 = 2, 29                 # eaves
    rx0, rx1 = 9, 22                 # ridge
    ridge, eave, sill, foot = 5, 14, 23, 28
    # ---- the hipped glass roof: a trapezoid from the ridge out to the eaves, lit glass high up
    for y in range(ridge, eave + 1):
        t, a, b = roof_span(y, ridge, eave, rx0, rx1, ex0, ex1)
        for x in range(a, b + 1):
            put(img, x, y, GLASS_HI if t < 0.25 else GLASS if t < 0.7 else GLASS_LO)
        put(img, a, y, BAR)              # the hips: white bars down to the eave corners
        put(img, b, y, BAR_LO)
        # the hip ends' panes run the other way: a short diagonal bar in each
        if 0.3 < t < 0.8:
            put(img, a + 3, y, BAR_LO)
            put(img, b - 3, y, BAR_LO)
    for x in range(rx0 + 2, rx1, 4):    # rafters on the front slope
        vline(img, x, ridge + 1, eave, BAR)
    _, a, b = roof_span(ridge + 5, ridge, eave, rx0, rx1, ex0, ex1)
    hline(img, a + 1, b - 1, ridge + 5, BAR_LO)  # a purlin
    for x in range(ex0 + 3, ex1 - 2, 3):  # plant tops hazy through the low panes
        if get(img, x, eave - 1)[:3] != (0xee, 0xe2, 0xc6):
            put(img, x, eave - 1, G3)
            put(img, x + 1, eave - 1, G2)
    # the ridge: a brass cap; grow lamps under it flicker
    hline(img, rx0, rx1, ridge, B2)
    hline(img, rx0 + 1, rx1 - 1, ridge - 1, B3)
    put(img, rx1, ridge, B1)
    for i, lx in enumerate((rx0 + 4, rx1 - 4)):
        put(img, lx, ridge + 1, [L2, L3, L2, L1][(f + i * 2) % 4])
    # the gutter
    hline(img, ex0, ex1, eave + 1, BAR)
    hline(img, ex0, ex1, eave + 2, B1)
    # ---- the front wall: panes, a planter of lettuces and staked vines behind the glass
    for y in range(eave + 3, sill + 1):
        for x in range(ex0, ex1 + 1):
            put(img, x, y, GLASS if y < eave + 5 else GLASS_LO)
    hline(img, ex0, ex1, sill, P["wood2"])
    hline(img, ex0, ex1, sill - 1, P["earth1"])
    k = 0
    for x in range(ex0 + 2, ex1 - 2, 5):
        lettuce(img, x, sill - 2, f, k)
        k += 1
    for x in range(ex0 + 7, ex1 - 2, 10):
        vine(img, x, eave + 4, sill - 2, f, k)
        k += 1
    # sprinkler drops falling through the air above the plants
    for i, sx in enumerate(range(ex0 + 4, ex1 - 2, 6)):
        put(img, sx, eave + 3 + ((f + i * 2) % 4), P["bone"])
    for x in range(ex0, ex1, 9):        # mullions
        vline(img, x, eave + 3, sill, BAR)
    vline(img, ex1, eave + 3, sill, BAR_LO)
    # the plinth: white-painted, lit top, shaded face, two vents
    hline(img, ex0, ex1, sill + 1, BAR)
    rect(img, ex0, sill + 2, ex1, foot, S3)
    hline(img, ex0, ex1, foot, S2)
    vline(img, ex1, sill + 2, foot, S2)
    for vx in (ex0 + 3, ex1 - 6):
        hline(img, vx, vx + 3, sill + 3, S1)
    # ---- the output: a brass hatch with a dark slot on the facing side
    if d == "east":
        rect(img, ex1 - 2, 17, ex1 + 2, 24, B2)
        vline(img, ex1 + 2, 17, 24, B1)
        hline(img, ex1 - 2, ex1 + 2, 17, B3)
        rect(img, ex1, 19, ex1 + 2, 22, INK1)
        put(img, ex1 - 1, 20, L2)
    elif d == "west":
        rect(img, ex0 - 2, 17, ex0 + 2, 24, B2)
        vline(img, ex0 - 2, 17, 24, B3)
        hline(img, ex0 - 2, ex0 + 2, 17, B3)
        rect(img, ex0 - 2, 19, ex0, 22, INK1)
        put(img, ex0 + 1, 20, L2)
    elif d == "south":
        cx = (ex0 + ex1) // 2
        rect(img, cx - 3, eave + 4, cx + 3, foot, B2)
        rect(img, cx - 2, eave + 5, cx + 2, foot, INK1)
        vline(img, cx, eave + 5, foot, B1)
        put(img, cx - 1, 21, L2)
        put(img, cx + 1, 21, L2)
        hline(img, cx - 3, cx + 3, eave + 4, B3)
        hline(img, cx - 4, cx + 4, foot + 1, S4)
    else:
        cx = (rx0 + rx1) // 2
        rect(img, cx - 3, 0, cx + 3, ridge - 1, B2)
        hline(img, cx - 3, cx + 3, 0, B3)
        rect(img, cx - 2, 1, cx + 2, 2, INK1)
        vline(img, cx + 3, 0, ridge - 1, B1)
    img = outline(img, INK)
    return seat(img)


# ================================================================ the Chute Mouth (Workshop)
def downpipe(img, cx, y1, f):
    """A brass pipe 4 px wide (cx-2..cx+1) from the top edge down to row y1, lit left; ink
    chevrons pointing down march a row a frame; a flange where it meets the box."""
    for y in range(0, y1 + 1):
        put(img, cx - 2, y, B3)
        put(img, cx - 1, y, B2)
        put(img, cx, y, B2)
        put(img, cx + 1, y, B1)
    for k in range(-1, 3):
        y = k * 4 + f
        for (dx, dy) in ((-2, 0), (1, 0), (-1, 1), (0, 1)):
            if 0 <= y + dy < y1 - 1:
                put(img, cx + dx, y + dy, INK)
    hline(img, cx - 3, cx + 2, y1 - 1, B3)
    hline(img, cx - 3, cx + 2, y1, B1)


def hopper_box(img, x0, x1, top, bot):
    """The chute mouth's steel box: a lit top face, a shaded front face, two bolts."""
    rect(img, x0, top, x1, top + 1, S3)
    hline(img, x0, x1, top, S4)
    rect(img, x0, top + 2, x1, bot, S2)
    vline(img, x1, top + 2, bot, S1)
    hline(img, x0, x1, bot, S1)
    put(img, x0 + 1, top + 3, S4)
    put(img, x1 - 1, top + 3, S1)


def chute_mouth(d, f):
    img = new(16, 16)
    cx = 7
    if d == "north":
        # the spout goes back: a small box behind the pipe, its open mouth up and back
        rect(img, 3, 4, 11, 8, S2)
        hline(img, 3, 11, 4, S3)
        rect(img, 4, 5, 10, 6, INK1)
    hopper_box(img, 2, 12, 8, 13)
    if d == "east":
        # the spout: a short flared funnel out of the box's east side, open at the tile edge
        rect(img, 12, 7, 15, 14, S2)
        hline(img, 12, 15, 7, S4)
        vline(img, 12, 8, 13, S3)
        rect(img, 14, 9, 15, 12, INK1)
        hline(img, 12, 15, 14, S1)
    elif d == "west":
        rect(img, 0, 7, 2, 14, S2)
        hline(img, 0, 2, 7, S4)
        vline(img, 2, 8, 13, S1)
        rect(img, 0, 9, 1, 12, INK1)
        hline(img, 0, 2, 14, S1)
    elif d == "south":
        # the mouth on the front face, its lip, a tongue down to the edge
        rect(img, 4, 10, 10, 13, INK1)
        hline(img, 4, 10, 10, INK)
        hline(img, 3, 11, 14, S4)
        hline(img, 4, 10, 15, S3)
    downpipe(img, cx, 8, f)
    img = outline(img, INK)
    return seat(img)


# ================================================================ the Factory Chute
def factory_chute(f):
    """A hatch in tile_factory's plate: the plate (steel1, a steel0 seam west and north, rivets),
    a hazard-striped frame, a funnel of four slopes falling to a dark throat, a gold down-arrow
    sinking into it a row a frame."""
    img = new(16, 16)
    rect(img, 0, 0, 15, 15, S1)
    hline(img, 0, 15, 0, S0)
    vline(img, 0, 0, 15, S0)
    for x, y in ((2, 2), (13, 2), (2, 13)):
        put(img, x, y, S3)
        put(img, x + 1, y + 1, INK2)
    put(img, 13, 13, S2)
    for i in range(3, 13):
        for (x, y) in ((i, 3), (i, 12), (3, i), (12, i)):
            calm = x >= 12 and y <= 3        # the pip's corner keeps dark
            put(img, x, y, L2 if ((x + y) // 2) % 2 and not calm else INK1)
    for y in range(4, 12):
        for x in range(4, 12):
            dx, dy = x - 7.5, y - 7.5
            if abs(dx) <= 1.5 and abs(dy) <= 1.5:
                put(img, x, y, INK)
            elif abs(dy) >= abs(dx):
                put(img, x, y, S3 if dy < 0 else S0)
            else:
                put(img, x, y, S2 if dx < 0 else S1)
    # the arrow: a 5-wide head pointing down, sinking a row a frame and swallowed by the throat
    head = [(-2, 0), (-1, 0), (0, 0), (1, 0), (2, 0), (-1, 1), (0, 1), (1, 1), (0, 2)]
    ay = 3 + f
    for dx, dy in head:
        x, y = 8 + dx, ay + dy
        if 4 <= y <= 9:
            inside = 6 <= x <= 9 and 6 <= y <= 9
            put(img, x, y, (L1 if f >= 2 else L2) if inside else L3)
    return img


# ================================================================ export
def build():
    ship("chem_vat", None, 8, rows=[[chem_vat(d, f) for f in range(4)] for d in DIRS], extra={"facings": 4}, look=6)
    ship("greenhouse", None, 6, rows=[[greenhouse(d, f) for f in range(4)] for d in DIRS], extra={"facings": 4},
         look=4)
    ship("chute_mouth", None, 8, rows=[[chute_mouth(d, f) for f in range(4)] for d in DIRS], extra={"facings": 4},
         look=6)
    ship("factory_chute", [factory_chute(f) for f in range(4)], 8, look=8)


if __name__ == "__main__":
    build()
