"""Paper and ink: the tag, its punched hole, the speech bubble and its tails, the toast slip, the
chip, keycaps and the mouse, paper and brass buttons, the Inspector's clipboard, the pushpin, the
green stamp tick and the red pencil circle.

Paper is `bone`, lit with `lamp3` on its top-left inner edge, shaded `wood5` on its bottom-right
inner edge and edged `wood2`; ink is `ink`. Centres are plain bone so ink text sits on nothing;
the texture (deckle notches, tape, lips) lives in the edges. Every 9-slice edge is drawn so that
it tiles: features repeat with the edge's period and every prefix of an edge meets the next corner.

python build.py (runs every script)"""
import math

from kit import Px, export

INK, EDGE, HI, LO, PAPER = "ink", "wood2", "lamp3", "wood5", "bone"
SHADOW = "ink1"


# ------------------------------------------------------------------ the tag
# deckle notches along each edge, as positions in the 20 px source (the edge tile is 4..15, so
# they repeat every 12 px: a 1 px and a 2 px bite, uneven so they read as torn, not perforated)
NOTCH = {"top": (6, 11, 12), "bottom": (8, 9, 14), "left": (7, 8, 13), "right": (6, 11, 12)}


def paper_box(c, x0, y0, x1, y1, deckle=True, notch=NOTCH):
    """A paper rectangle with a 1 px wood2 edge, cut corners, lit top-left, shaded bottom-right.
    Deckled: at each notch the edge steps in by 1 px (the paper there is bitten away)."""
    c.rect(x0 + 1, y0 + 1, x1 - 1, y1 - 1, PAPER)
    c.hl(x0 + 1, x1 - 1, y0, EDGE)
    c.hl(x0 + 1, x1 - 1, y1, EDGE)
    c.vl(x0, y0 + 1, y1 - 1, EDGE)
    c.vl(x1, y0 + 1, y1 - 1, EDGE)
    c.hl(x0 + 1, x1 - 1, y0 + 1, HI)
    c.vl(x0 + 1, y0 + 1, y1 - 1, HI)
    c.hl(x0 + 1, x1 - 1, y1 - 1, LO)
    c.vl(x1 - 1, y0 + 2, y1 - 1, LO)
    c.p(x0 + 1, y1 - 1, HI)
    if deckle:
        for x in notch["top"]:
            c.p(x, y0, None)
            c.p(x, y0 + 1, EDGE)
        for x in notch["bottom"]:
            c.p(x, y1, None)
            c.p(x, y1 - 1, EDGE)
        for y in notch["left"]:
            c.p(x0, y, None)
            c.p(x0 + 1, y, EDGE)
        for y in notch["right"]:
            c.p(x1, y, None)
            c.p(x1 - 1, y, EDGE)


def drop(c, x0, y0, x1, y1, d, colour=SHADOW, checker=False):
    """A straight shadow d px down-right of the box (x0,y0)-(x1,y1): it ignores the deckle, as a
    shadow on the floor would blur the bites away."""
    for y in range(y0 + d, y1 + d + 1):
        for x in range(x0 + d, x1 + d + 1):
            if (x > x1 or y > y1) and not c.on(x, y) and (not checker or (x + y) % 2 == 0):
                if not ((x == x1 + d and y == y0 + d) or (x == x0 + d and y == y1 + d)):
                    c.p(x, y, colour)


def tag(lift):
    c = Px(20, 20)
    if lift:     # hovered: the paper rises 1 px up-left and its shadow grows
        paper_box(c, 0, 0, 17, 17)
        drop(c, 0, 0, 17, 17, 1)
        drop(c, 0, 0, 17, 17, 2, checker=True)
    else:
        paper_box(c, 1, 1, 18, 18)
        drop(c, 1, 1, 18, 18, 1)
    return c


def hole():
    """The punched hole and its reinforcing ring (a lamp3 card washer, wood2 edge)."""
    c = Px(5, 5)
    c.rows([
        ".eee.",
        "eHHre",
        "eH.re",
        "errre",
        ".eee.",
    ], {"e": EDGE, "H": HI, "r": LO})
    c.p(2, 2, INK)
    return c


# ------------------------------------------------------------------ the speech bubble
def bubble():
    c = Px(16, 16)
    c.rect(1, 1, 14, 14, PAPER)
    c.hl(2, 13, 0, INK)
    c.hl(2, 13, 15, INK)
    c.vl(0, 2, 13, INK)
    c.vl(15, 2, 13, INK)
    for x, y in ((1, 1), (14, 1), (1, 14), (14, 14)):
        c.p(x, y, INK)
    c.hl(2, 13, 1, HI)          # the lit top
    c.hl(2, 13, 14, LO)         # the shaded bottom
    c.vl(14, 2, 13, LO)
    return c


DOWN_LEFT = [         # row 0 lies on the bubble's shade row, row 1 on its outline row
    ".bbbbbb.",
    "kbbbbbbk",
    "kbbbbbk.",
    "kbbbbk..",
    "kbbbk...",
    "kbbk....",
    "kbk.....",
    "kk......",
]


def tails():
    """Four tails that open the bubble's outline where they join (overlap 2 px into it):
    down-left, down-right (their top 2 rows on the bubble's bottom 2), left (its right 2 columns on
    the bubble's left 2), right (its left 2 columns on the bubble's right 2)."""
    key = {"k": INK, "b": PAPER, "s": PAPER}
    dl = Px(8, 8)
    dl.rows(DOWN_LEFT, key)
    dr = dl.flip()
    # left: column 7 lies on the bubble's inside, column 6 on its outline; the tip points left-down
    lf = Px(8, 8)
    for y, row in enumerate(DOWN_LEFT):
        for x, ch in enumerate(row):
            if ch in key:
                lf.p(7 - y, 7 - x, key[ch])
    rt = lf.flip()
    # shade by the light (top-left): paper with ink to its right or below turns wood5, except
    # the rows/columns that lie over the bubble (they carry its own fill)
    skip = [lambda x, y: y == 0, lambda x, y: y == 0, lambda x, y: x == 7, lambda x, y: x == 0]
    for t, sk in zip((dl, dr, lf, rt), skip):
        pts = [(x, y) for y in range(8) for x in range(8)
               if t.is_(x, y, PAPER) and not sk(x, y) and (t.is_(x + 1, y, INK) or t.is_(x, y + 1, INK))]
        for x, y in pts:
            t.p(x, y, LO)
    return [dl, dr, lf, rt]


# ------------------------------------------------------------------ the toast slip
def slip():
    """A plain paper slip (no deckle: it is cut clean) with two strips of clear tape over its
    top corners; a 1 px shadow down-right."""
    c = Px(16, 16)
    paper_box(c, 0, 1, 14, 14, deckle=False)
    drop(c, 0, 1, 14, 14, 1)
    tape = [  # clear tape, steel4 with steel3 torn ends, across each top corner
        "..ts",
        ".tTs",
        "tTTs",
        "TTs.",
        "ts..",
    ]
    key = {"T": "steel4", "t": "steel3", "s": "steel3"}
    c.rows(tape, key, 0, 0)
    t2 = Px(4, 5)
    t2.rows(tape, key)
    c.paste(t2.flip(), 11, 0)
    return c


# ------------------------------------------------------------------ the chip
def chip():
    c = Px(9, 9)
    c.rows([
        "..eeeee..",
        ".eHHHHHe.",
        "eHHHHHHHe",
        "eHHHHHHHe",
        "eHHHHHHHe",
        "eHHHHHHHe",
        "eHHHHHHHe",
        ".eLLLLLe.",
        "..eeeee..",
    ], {"e": EDGE, "H": HI, "L": LO})
    return c


# ------------------------------------------------------------------ keys
def keycap(down):
    c = Px(9, 10)
    if not down:
        c.rows([
            ".kkkkkkk.",
            "kHHHHHHHk",
            "kbbbbbbbk",
            "kbbbbbbbk",
            "kbbbbbbbk",
            "kbbbbbbbk",
            "kbbbbbbbk",
            "kLLLLLLLk",
            "kDDDDDDDk",
            ".kkkkkkk.",
        ], {"k": INK, "H": HI, "b": PAPER, "L": LO, "D": "wood4"})
    else:
        c.rows([
            ".........",
            ".kkkkkkk.",
            "kbbbbbbbk",
            "kbbbbbbbk",
            "kbbbbbbbk",
            "kbbbbbbbk",
            "kbbbbbbbk",
            "kbbbbbbbk",
            "kDDDDDDDk",
            ".kkkkkkk.",
        ], {"k": INK, "b": PAPER, "D": "wood4"})
    return c


MOUSE = [
    "..kkk..",
    ".kLkRk.",
    "kLLkRRk",
    "kLLkRRk",
    "kkkkkkk",
    "kbbbbbk",
    "kbbbbbk",
    "kbbbbsk",
    ".kbbsk.",
    "..kkk..",
]


def mouse(which):
    hot = "copper2"
    key = {"k": INK, "b": PAPER, "s": LO,
           "L": hot if which == "LMB" else PAPER, "R": hot if which == "RMB" else PAPER}
    c = Px(7, 10)
    c.rows(MOUSE, key)
    if which == "WHEEL":
        c.rows(["..kHk..", ".kbHbk.", "kbbHbbk", "kbbkbbk"], {"k": INK, "b": PAPER, "H": hot})
    return c


# ------------------------------------------------------------------ buttons
BTN = [
    ".kkkkkkkkkk.",
    "kHHHHHHHHHHk",
    "kFFFFFFFFFFk",
    "kFFFFFFFFFFk",
    "kFFFFFFFFFFk",
    "kFFFFFFFFFFk",
    "kFFFFFFFFFFk",
    "kFFFFFFFFFFk",
    "kFFFFFFFFFFk",
    "kSSSSSSSSSSk",
    "kBBBBBBBBBBk",
    ".kkkkkkkkkk.",
]
BTN_DOWN = ["." * 12] + [BTN[0]] + [BTN[2]] * 8 + [BTN[9], BTN[11]]


def button(state, gold=False):
    if gold:
        ramp = dict(H="brass3", F="brass2", S="brass1", B="brass0", k=INK)
        if state == "hover":
            ramp = dict(H="lamp3", F="brass3", S="brass2", B="brass0", k=INK)
    else:
        ramp = dict(H=HI, F=PAPER, S=LO, B=EDGE, k=INK)
        if state == "hover":
            ramp = dict(H=HI, F=HI, S=LO, B=EDGE, k=INK)
    if state == "disabled":
        ramp = dict(H=LO, F=LO, S="wood4", B="wood4", k="brass1" if gold else EDGE)
        rows = BTN_DOWN       # sunk, no base: it cannot be pressed
    else:
        rows = BTN_DOWN if state == "down" else BTN
    c = Px(12, 12)
    c.rows(rows, ramp)
    return c


# ------------------------------------------------------------------ the Inspector's clipboard
def clipboard():
    """A brown board with a steel bulldog clip at its top-left (a 9-slice cannot centre a clip),
    the paper inside it. 20x22, slice [10, 8, 4, 4]: the clip lives in the top-left corner, the
    centre (x 10-15, y 8-17) is plain paper."""
    c = Px(20, 22)
    # the board: wood2, lit top-left, dark bottom-right, ink edge, round corners
    c.rect(1, 3, 18, 20, "wood2")
    c.hl(2, 17, 2, INK)
    c.hl(2, 17, 21, INK)
    c.vl(0, 4, 19, INK)
    c.vl(19, 4, 19, INK)
    for x, y in ((1, 3), (18, 3), (1, 20), (18, 20)):
        c.p(x, y, INK)
    c.hl(2, 17, 3, "wood3")
    c.vl(1, 4, 19, "wood3")
    c.hl(2, 18, 20, "wood1")
    c.vl(18, 4, 19, "wood1")
    # the paper: 2 px of board round it, lit and shaded like a tag, plain in the middle
    c.rect(3, 6, 16, 18, PAPER)
    c.hl(3, 16, 6, HI)
    c.vl(3, 6, 18, HI)
    c.hl(4, 16, 18, LO)
    c.vl(16, 7, 18, LO)
    c.hl(4, 17, 19, "wood1")    # the paper's shadow on the board
    c.vl(17, 7, 19, "wood1")
    # the clip: a steel bulldog clip and its lever ring, over the paper's top edge
    c.rows([
        "...kkkk...",
        "...k..k...",
        ".kkkkkkkk.",
        "kSsssssSSk",
        "kSDDDDDDSk",
        "kSSSSSSSSk",
        ".kSSRRSSk.",
        "..kkkkkk..",
    ], {"k": INK, "S": "steel3", "s": "steel4", "D": "steel1", "R": "steel2"}, 0, 0)
    return c


# ------------------------------------------------------------------ the pushpin
def pushpin(shadow_only):
    head = Px(7, 7)
    head.rows([
        ".kkk...",
        "kHrrk..",
        "krrrk..",
        "kRRRk..",
        ".kkk...",
    ], {"k": INK, "H": "copper3", "r": "red", "R": "copper0"})
    c = Px(7, 7)
    sh = [(x + 2, y + 2) for y in range(7) for x in range(7) if head.on(x, y)]
    for x, y in sh:
        c.p(x, y, SHADOW)
    if not shadow_only:
        c.paste(head)
        c.p(2, 5, "steel3")      # the steel pin's glint between head and shadow
    return c


# ------------------------------------------------------------------ the stamp tick
def tick():
    """A green-ink rubber-stamp tick: a fat check with a few bare specks where the rubber missed."""
    c = Px(12, 12)
    c.rows([
        "...........g",
        "..........gg",
        ".........ggg",
        "........ggg.",
        ".......ggg..",
        "g.....ggg...",
        "gg...ggg....",
        "ggg.ggg.....",
        ".ggggg......",
        "..ggg.......",
        "...g........",
        "............",
    ], {"g": "moss1"})
    for x, y in ((9, 3), (1, 6), (4, 8), (7, 5)):      # where the rubber missed
        c.p(x, y, "moss2")
    return c


# ------------------------------------------------------------------ the red pencil circle
def circle():
    """A loop drawn in one go by a hurried hand: a little wobble, the end overshooting the start
    at the top-right, the overlap pressed harder (copper0)."""
    c = Px(22, 22)
    cx, cy = 10.6, 10.8
    seen = {}
    n = 400
    a0, a1 = math.radians(-70), math.radians(-70 + 360 + 40)
    for i in range(n + 1):
        t = a0 + (a1 - a0) * i / n
        r = 9.4 + 0.5 * math.sin(t * 2.0 + 0.7) + 0.06 * (t - a0)
        x = round(cx + r * math.cos(t) * 1.02)
        y = round(cy + r * math.sin(t) * 0.97)
        seen.setdefault((x, y), []).append(i)
    for (x, y), ii in seen.items():
        over = max(ii) - min(ii) > n * 0.5
        c.p(x, y, "copper0" if over else "red")
    return c


def build():
    export("h180_tag", [tag(False), tag(True)], slice_=[4, 4, 4, 4],
           extra={"lift": [-1, -1], "note": "frame 1 (hover): the paper sits 1 px up-left, its shadow 2 px"})
    export("h180_hole", hole(), anchor=[2, 2])
    export("h180_bubble", bubble(), slice_=[4, 4, 4, 4])
    export("h180_bubble_tail", tails(), extra={
        "order": ["downLeft", "downRight", "left", "right"], "overlap": 2,
        "note": "down tails: top 2 rows over the bubble's bottom 2; left: right 2 columns over its left 2; "
                "right: left 2 columns over its right 2"})
    export("h180_slip", slip(), slice_=[5, 5, 5, 5])
    export("h180_chip", chip(), slice_=[4, 4, 4, 4])
    export("h180_keycap", [keycap(False), keycap(True)], slice_=[3, 2, 3, 3],
           extra={"order": ["up", "down"], "note": "down: the face is 1 px lower"})
    export("h180_mouse", [mouse("LMB"), mouse("RMB"), mouse("WHEEL")], extra={"order": ["LMB", "RMB", "WHEEL"]})
    st = ["normal", "hover", "down", "disabled"]
    export("h180_button", [button(s) for s in st], slice_=[4, 4, 4, 5], extra={"order": st})
    export("h180_button_gold", [button(s, True) for s in st], slice_=[4, 4, 4, 5], extra={"order": st})
    export("h180_clipboard", clipboard(), slice_=[10, 8, 4, 4])
    export("h180_pushpin", [pushpin(False), pushpin(True)], anchor=[2, 2], extra={"order": ["pin", "shadow"]})
    export("h180_tick", tick())
    export("h180_circle", circle())


if __name__ == "__main__":
    build()
