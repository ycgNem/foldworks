"""The two destinations, hand-drawn (phase 3 readability): the Dock sells, the Hopper researches,
and at 1x each must read as *the* place items go, never as another machine.

- **Dock**: a slip of open water cut into the floor, a skiff moored in it loaded with crates, a
  green pennant with a gold coin. Water is the one thing on the deck that is not wood or steel, so
  the Dock is found at a glance; the coin says "sell".
- **Hopper**: a wide brass-rimmed funnel painted research teal (the research tree's light) over a
  steel box with a glowing flask on its front. Teal and the funnel's open mouth are its cues.
- Each has a Factory version (steel and hazard stripes instead of planks) and the Dock has the
  Lily Pad Dock (Bramble's third reputation reward: pads and a lotus in the slip, a frog flag).

32x32, top-left light, 3/4 view; the top-right 4x4 is left calm. Frames: the Dock's water and
lantern move (2), the Hopper's flask and lamps pulse (3)."""
from common import P, new, draw, rect, export, scale, OUT
from machines import skid

INK = P["ink"]


def box(img, x0, y0, x1, y1, fill, edge=INK):
    rect(img, x0, y0, x1, y1, edge)
    if x1 - x0 > 1 and y1 - y0 > 1:
        rect(img, x0 + 1, y0 + 1, x1 - 1, y1 - 1, fill)


# ---------------------------------------------------------------- the Dock
def pier(img, factory):
    """The rim round the slip: planks (or riveted steel plates), a front face with pilings (or a
    hazard-striped kick plate), the ink outline."""
    top, lit, mid, dark, face = ((P["steel3"], P["steel4"], P["steel2"], P["steel1"], P["steel0"]) if factory
                                 else (P["wood2"], P["wood3"], P["wood1"], P["wood0"], P["wood0"]))
    box(img, 0, 4, 31, 27, top)
    # boards (or plates): seams every 4 rows on the rim, lit top edge
    for y in range(5, 27):
        for x in range(1, 31):
            if y == 5:
                draw(img, [(x, y)], lit)
            elif (y - 5) % 4 == 0:
                draw(img, [(x, y)], mid)
    if factory:
        draw(img, [(x, y) for x in (2, 29) for y in (7, 24)], P["steel1"])        # rivets
    else:
        draw(img, [(x, 9) for x in (6, 19)] + [(x, 17) for x in (3, 27)] + [(x, 21) for x in (12, 24)], dark)
    # front face
    rect(img, 0, 28, 31, 30, INK)
    if factory:
        for x in range(1, 31):
            draw(img, [(x, 28), (x, 29)], P["lamp2"] if ((x // 2) % 2) else P["ink1"])
    else:
        rect(img, 1, 28, 30, 29, face)
        draw(img, [(x, 28) for x in range(1, 31)], dark)
        for px in (3, 15, 27):                                                 # pilings
            rect(img, px, 28, px + 1, 31, P["wood1"])
            draw(img, [(px, 31), (px + 1, 31)], INK)
            draw(img, [(px - 1, y) for y in (30, 31)] + [(px + 2, y) for y in (30, 31)], INK)


def slip(img, f, lily=False):
    """The water: a shadowed inner wall at the top and left, ripples that drift one pixel a frame."""
    x0, y0, x1, y1 = 5, 9, 26, 24
    rect(img, x0 - 1, y0 - 1, x1 + 1, y1 + 1, INK)
    rect(img, x0, y0, x1, y0 + 1, P["wood0"])                                  # the far wall
    for y in range(y0 + 2, y1 + 1):
        for x in range(x0, x1 + 1):
            c = P["water1"] if (x == x0 or y == y0 + 2) else P["water2"]
            if (x + 2 * y + f * 2) % 9 == 0 and x > x0 + 1:
                c = P["water3"]
            if (x + 2 * y + f * 2) % 9 == 1 and x > x0 + 1 and y % 3 == 0:
                c = P["water4"]
            draw(img, [(x, y)], c)
    if lily:
        for (cx, cy) in ((8, 20), (23, 12), (22, 22)):
            pad = [(cx + dx, cy + dy) for dx in range(-2, 3) for dy in (-1, 0, 1) if abs(dx) + abs(dy) < 3]
            draw(img, pad, P["moss4"])
            draw(img, [(cx - 2, cy), (cx - 1, cy - 1)], P["moss5"])
            draw(img, [(cx + 1, cy), (cx + 2, cy)], P["water2"])               # the notch
        draw(img, [(23, 11), (22, 11), (24, 11)], P["violet"])                 # lotus
        draw(img, [(23, 10)], P["bone"])


def skiff(img, factory):
    """A boat moored in the slip, bow to the east, loaded with crates."""
    hull_top, hull, hull_dark = ((P["steel3"], P["steel2"], P["steel1"]) if factory
                                 else (P["wood4"], P["wood2"], P["wood1"]))
    rows = {14: (9, 21), 15: (8, 23), 16: (8, 24), 17: (8, 23), 18: (9, 22), 19: (10, 20)}
    for y, (a, b) in rows.items():
        rect(img, a - 1, y, b + 1, y, INK)
    for y, (a, b) in rows.items():
        c = hull_top if y == 14 else hull if y < 18 else hull_dark
        rect(img, a, y, b, y, c)
    rect(img, 9, 15, 22, 16, P["wood1"] if not factory else P["steel1"])     # inside the hull
    draw(img, [(x, 20) for x in range(10, 21)], INK)
    draw(img, [(x, 21) for x in range(11, 20)], P["water1"])                   # its shadow
    # cargo: a copper crate, a brass crate, a bone sack
    box(img, 10, 11, 13, 15, P["copper2"])
    draw(img, [(11, 12), (12, 12)], P["copper3"])
    draw(img, [(11, 14), (12, 14)], P["copper1"])
    box(img, 14, 10, 18, 15, P["brass2"])
    draw(img, [(15, 11), (16, 11), (17, 11)], P["brass3"])
    draw(img, [(16, y) for y in (12, 13, 14)], P["brass1"])
    box(img, 19, 12, 21, 15, P["bone"])
    draw(img, [(20, 12)], P["steel3"])
    # mooring line to the west bollard
    draw(img, [(7, 14), (8, 14)], P["wood4"])


def bollards(img):
    for (x, y) in ((3, 7), (27, 7), (3, 25), (27, 25)):
        box(img, x - 1, y - 1, x + 1, y + 1, P["steel3"])
        draw(img, [(x, y)], P["steel4"])


def pennant(img, f, lily=False):
    """A pole at the north-west corner; the flag is moss green with a gold coin (or Bramble's frog
    face on the Lily Pad Dock). The flag's tail flutters."""
    rect(img, 1, 0, 3, 13, INK)
    rect(img, 2, 1, 2, 12, P["wood4"])
    fl, fd = (P["moss5"], P["moss3"])
    w = 9 if f == 0 else 8
    for y in range(1, 7):
        for x in range(3, 3 + w):
            if x == 2 + w and y in (3, 4):
                continue                                                       # the swallowtail
            draw(img, [(x, y)], fl if y < 4 else fd)
    draw(img, [(x, 0) for x in range(3, 3 + w)] + [(x, 7) for x in range(3, 3 + w)], INK)
    draw(img, [(3 + w, y) for y in (1, 2, 5, 6)] + [(2 + w, 3), (2 + w, 4)], INK)
    if lily:
        draw(img, [(5, 2), (8, 2)], P["bone"])
        draw(img, [(5, 3), (8, 3)], INK)
        draw(img, [(5, 5), (6, 5), (7, 5), (8, 5)], P["moss1"])
    else:
        draw(img, [(6, 2), (7, 2), (5, 3), (8, 3), (5, 4), (8, 4), (6, 5), (7, 5)], P["brass1"])
        draw(img, [(6, 3), (7, 3), (6, 4), (7, 4)], P["lamp2"])
        draw(img, [(6, 3)], P["lamp3"])


def lantern(img, f, x=29, y=9):
    """A lantern on a short post at the east rim, flickering."""
    rect(img, x - 1, y + 3, x + 1, y + 8, INK)
    draw(img, [(x, yy) for yy in range(y + 3, y + 8)], P["wood3"])
    rect(img, x - 2, y - 1, x + 2, y + 3, INK)
    glow = [P["lamp2"], P["lamp3"]] if f == 0 else [P["lamp1"], P["lamp2"]]
    rect(img, x - 1, y, x + 1, y + 2, glow[0])
    draw(img, [(x, y + 1)], glow[1])
    draw(img, [(x, y - 2)], INK)


def dock(f, factory=False, lily=False):
    img = new(32, 32)
    pier(img, factory)
    bollards(img)
    slip(img, f, lily)
    skiff(img, factory)
    pennant(img, f, lily)
    lantern(img, f)
    return img


# ---------------------------------------------------------------- the Hopper
def hopper(f, factory=False):
    """A brass-rimmed teal funnel on a steel box, on the machines' skid."""
    img = skid(32)
    teal_lit, teal, teal_dark = P["teal"], P["water4"], P["water3"]
    # the box under the funnel: rows 18-27
    box(img, 6, 18, 25, 27, P["steel2"])
    rect(img, 7, 19, 24, 19, P["steel3"])
    rect(img, 24, 20, 24, 26, P["steel1"])
    # the flask sign on its front, pulsing
    liquid = [P["water4"], P["teal"], P["bone"]][f % 3]
    flask = {20: (15, 16), 21: (15, 16), 22: (14, 17), 23: (13, 18), 24: (13, 18), 25: (13, 18)}
    for y, (a, b) in flask.items():
        rect(img, a - 1, y, b + 1, y, INK)
    for y, (a, b) in flask.items():
        rect(img, a, y, b, y, P["bone"] if y < 23 else liquid)
    draw(img, [(x, 26) for x in range(12, 20)], INK)
    draw(img, [(14, 24)], P["bone"])
    # lamps either side
    lamp = [P["teal"], P["water4"], P["teal"]][f % 3]
    for lx in (8, 22):
        box(img, lx, 21, lx + 2, 23, lamp)
    # the funnel: a trapezoid narrowing from row 9 to row 18
    for i, y in enumerate(range(9, 19)):
        a, b = 2 + i, 29 - i
        rect(img, a, y, b, y, INK)
        if b - a > 2:
            for x in range(a + 1, b):
                t = (x - a) / (b - a)
                c = teal_lit if t < 0.3 else teal if t < 0.75 else teal_dark
                draw(img, [(x, y)], c)
    draw(img, [(x, 12) for x in range(6, 26, 3)], P["steel4"])                # rivet band
    draw(img, [(x, 11) for x in range(5, 27)], teal_dark)
    if factory:
        for x in range(8, 24):
            draw(img, [(x, 16)], P["lamp2"] if (x // 2) % 2 else P["ink1"])
    # the mouth: a brass rim seen from above, dark inside, the throat at its middle
    box(img, 1, 2, 28, 9, P["ink1"])
    rect(img, 1, 2, 28, 2, INK)
    rect(img, 2, 3, 27, 3, P["brass3"])
    rect(img, 2, 8, 27, 8, P["brass1"])
    rect(img, 2, 4, 2, 7, P["brass2"])
    rect(img, 27, 4, 27, 7, P["brass1"])
    # inside: the far slope faces us and catches the light, the near ones fall away to the throat
    rect(img, 3, 4, 26, 4, teal)
    rect(img, 4, 5, 25, 5, teal_dark)
    rect(img, 6, 6, 23, 6, P["water2"])
    draw(img, [(3, 5), (3, 6), (4, 6), (26, 5), (26, 6), (25, 6)], P["ink2"])
    rect(img, 10, 7, 19, 7, INK)                                               # the throat
    draw(img, [(9, 7), (20, 7)], P["water1"])
    return img


def build():
    export("dock", [dock(0), dock(1)], 2)
    export("dock_lily", [dock(0, lily=True), dock(1, lily=True)], 2)
    export("factory_dock", [dock(0, factory=True), dock(1, factory=True)], 2)
    export("hopper", [hopper(f) for f in range(3)], 3)
    export("factory_hopper", [hopper(f, factory=True) for f in range(3)], 3)


if __name__ == "__main__":
    build()
