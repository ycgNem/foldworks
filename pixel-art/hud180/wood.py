"""Wood, brass and leather: the Purse sign and its rope, the ledger book's pages, the trouble bell,
the lift (case and buttons), the notebook, the Swamp Gazette, the toolbox, the wheel's hub, petals
and item discs, and Bramble's lily pad.

Wood is the deck's ramp (`wood0-5`), brass the module brass (`brass0-3`, lantern gold only on
glints), leather the ledger's oxblood (`copper0` lit `copper1`, shaded `wood0`)."""
import math

from kit import Px, export
import tiny

INK = "ink"
PAPER, HI, LO, EDGE = "bone", "lamp3", "wood5", "wood2"


def rounded(c, x0, y0, x1, y1, fill, edge=INK, r=1):
    c.rect(x0 + 1, y0 + 1, x1 - 1, y1 - 1, fill)
    c.hl(x0 + r, x1 - r, y0, edge)
    c.hl(x0 + r, x1 - r, y1, edge)
    c.vl(x0, y0 + r, y1 - r, edge)
    c.vl(x1, y0 + r, y1 - r, edge)
    if r == 2:
        for x, y in ((x0 + 1, y0 + 1), (x1 - 1, y0 + 1), (x0 + 1, y1 - 1), (x1 - 1, y1 - 1)):
            c.p(x, y, edge)


def ring(c, cx, cy, r0, r1, colour, only_on=None):
    for y in range(c.h):
        for x in range(c.w):
            d = math.hypot(x + 0.5 - cx, y + 0.5 - cy)
            if r0 <= d < r1 and (only_on is None or c.on(x, y)):
                c.p(x, y, colour)


def disc_lit(c, cx, cy, r, ramp, rim=1.6):
    """A lit disc: ink outline, a rim lit top-left and shaded bottom-right, a flat face."""
    D, S, M, L = ramp
    for y in range(c.h):
        for x in range(c.w):
            dx, dy = x + 0.5 - cx, y + 0.5 - cy
            d = math.hypot(dx, dy)
            if d < r - 1:
                c.p(x, y, M)
                if d >= r - 1 - rim:
                    lit = (-dx - dy) / max(d, 0.01)
                    c.p(x, y, L if lit > 0.35 else S if lit < -0.35 else M)
            elif d < r:
                c.p(x, y, INK)


# ------------------------------------------------------------------ the Purse sign and rope
def sign():
    """A plank: ink edge, a lit top, end grain at both ends, grain streaks and nail heads in the
    edges, a plain wood2 centre for the gold number. Slice [6, 5, 6, 5]: the edges tile every 12."""
    c = Px(24, 16)
    rounded(c, 0, 0, 23, 15, "wood2")
    c.hl(1, 22, 1, "wood4")
    c.hl(1, 22, 2, "wood3")
    c.hl(1, 22, 14, "wood0")
    c.hl(1, 22, 13, "wood1")
    # end grain: a darker band and a ring at each end
    for x in (1, 22):
        c.vl(x, 2, 13, "wood1")
    c.vl(2, 3, 12, "wood3")
    c.vl(21, 3, 12, "wood1")
    # grain: long lines along the plank in the top and bottom edges (they tile without gaps)
    c.hl(5, 18, 3, "wood3")
    c.hl(5, 18, 12, "wood1")
    # nails at the four corners (where the ropes tie on)
    for x, y in ((3, 3), (20, 3), (3, 11), (20, 11)):
        c.p(x, y, "steel3")
        c.p(x + 1, y, "steel1")
        c.p(x, y + 1, "steel1")
        c.p(x + 1, y + 1, INK)
    return c


def rope():
    """A twisted rope, 3 px wide, tiling vertically every 8."""
    c = Px(3, 8)
    for y in range(8):
        for x in range(3):
            s = (x + y) % 4
            c.p(x, y, ["wood5", "wood4", "wood2", "wood1"][s] if x != 2 else ["wood4", "wood2", "wood1", "wood1"][s])
    return c


# ------------------------------------------------------------------ the ledger book
LEATHER = ("wood0", "copper0", "copper1")


def page_left():
    """The left page of the open ledger: oxblood leather showing round it (x 0-2, top 0-2, bottom
    21-23), a stack of page edges (x 3-6, bottom 18-20), the page (plain bone), the gutter's shadow
    (x 20-23). Slice [8, 5, 8, 7] (the same for both pages)."""
    c = Px(24, 24)
    sh, le, lt = LEATHER
    # the cover: ink edge, round outer corners, lit top-left, dark bottom
    c.rect(0, 0, 23, 23, le)
    c.hl(1, 23, 0, INK)
    c.hl(1, 23, 23, INK)
    c.vl(0, 1, 22, INK)
    c.p(1, 1, INK)
    c.p(1, 22, INK)
    c.hl(2, 23, 1, lt)
    c.vl(1, 2, 21, lt)
    c.hl(2, 23, 22, sh)
    # the page block: rows 3-21, x 3-23 (it runs into the spine)
    c.rect(3, 3, 23, 21, PAPER)
    c.hl(3, 23, 3, EDGE)            # the block's top edge
    c.vl(3, 3, 21, EDGE)            # its outer edge
    c.hl(3, 23, 21, EDGE)           # its bottom edge
    # the stack under the top page: two more page edges outside and below it
    c.vl(4, 4, 20, LO)
    c.vl(6, 4, 18, EDGE)
    c.hl(4, 23, 20, LO)
    c.hl(6, 23, 18, EDGE)
    # the top page: lit along its top and outer edge, shaded along its bottom
    c.hl(7, 23, 4, HI)
    c.vl(7, 4, 17, HI)
    c.hl(7, 23, 17, LO)
    # the gutter: the page curves down into the spine
    c.vl(20, 5, 16, LO)
    c.vl(21, 4, 17, LO)
    c.vl(22, 4, 20, "wood4")
    c.vl(23, 3, 21, EDGE)
    return c


# ------------------------------------------------------------------ the trouble bell
BELL = [2, 2, 3, 3, 3, 4, 4, 4, 5, 6]      # half-widths from the crown (row 3) to the lip (row 12)


def bell(swing):
    """A brass bell on a steel hook; swing is -1, 0, 1 (the bell's mouth swings, the hook stays)."""
    c = Px(16, 16)
    # the hook: a bracket from the top with a ring
    c.rows([
        "......kkkk......",
        "......kSsk......",
        ".......kk.......",
    ], {"k": INK, "S": "steel3", "s": "steel1"})
    k = 0.28 * swing
    body = Px(16, 16)
    for i, hw in enumerate(BELL):
        y = 3 + i
        cx = 7.5 + k * (y - 2)
        x0, x1 = round(cx - hw + 0.5), round(cx + hw - 0.5)
        for x in range(x0, x1 + 1):
            t = (x - x0) / max(1, x1 - x0)
            body.p(x, y, "brass3" if t < 0.3 else "brass2" if t < 0.72 else "brass1")
        if i == 0:
            body.p(x0 + 1, y, "lamp3")
    # the lip: a darker band at the mouth
    y = 12
    cx = 7.5 + k * (y - 2)
    hw = BELL[-1]
    x0, x1 = round(cx - hw + 0.5), round(cx + hw - 0.5)
    body.hl(x0, x1, y, "brass1")
    body.p(x0, y, "brass2")
    body.p(x0 + 1, 5, "lamp3")
    body.p(round(7.5 + k * 3) - 1, 6, "lamp3")
    body.outline(INK)
    c.paste(body)
    # the clapper under the mouth, swinging the other way (it lags)
    cx = round(7.5 + k * 11 - swing)
    c.p(cx, 14, "brass1")
    c.p(cx, 15, INK)
    c.p(cx - 1, 14, INK)
    c.p(cx + 1, 14, INK)
    c.p(cx, 13, "brass0") if not c.is_(cx, 13, INK) else None
    return c


# ------------------------------------------------------------------ the lift
LIFT_W, LIFT_H = 44, 26
PIVOT = (22, 15)
HOLES = [(2, 9), (32, 9)]       # top-left of each 10x10 button


def lift():
    """The floor dial: a wooden case with a brass face between two button holes. The needle is
    code's (from PIVOT); four ticks on the face for Workshop, Factory, District and World (180,
    120, 60 and 0 degrees: the needle sweeps the top half)."""
    c = Px(LIFT_W, LIFT_H)
    rounded(c, 0, 2, 43, 25, "wood2", r=2)
    c.hl(2, 41, 3, "wood4")
    c.vl(1, 4, 23, "wood3")
    c.hl(2, 41, 24, "wood0")
    c.vl(42, 4, 23, "wood1")
    # a little peaked crown over the dial (the case's top)
    c.rows([
        "..kkkkkkkkkk..",
        ".kWWWWWWWWWWk.",
        "kwwwwwwwwwwwwk",
    ], {"k": INK, "W": "wood4", "w": "wood3"}, 15, 0)
    # button holes: dark recesses
    for hx, hy in HOLES:
        c.rect(hx, hy, hx + 9, hy + 9, "ink1")
        c.hl(hx + 1, hx + 8, hy, INK)
        c.vl(hx, hy + 1, hy + 8, INK)
        c.p(hx, hy, "wood2")
        c.p(hx + 9, hy, "wood2")
        c.p(hx, hy + 9, "wood2")
        c.p(hx + 9, hy + 9, "wood2")
        c.hl(hx + 1, hx + 8, hy + 10, "wood4")      # the lit lip under each hole
    # the brass face
    face = Px(LIFT_W, LIFT_H)
    disc_lit(face, PIVOT[0] + 0.5, PIVOT[1] + 0.5, 10, ("brass0", "brass1", "brass2", "brass3"), rim=1.4)
    c.paste(face)
    # the dial's arc and its ticks
    for deg in (180, 120, 60, 0):
        a = math.radians(deg)
        for r in (6.5, 7.5):
            c.p(round(PIVOT[0] + r * math.cos(a)), round(PIVOT[1] - r * math.sin(a)), "brass0")
    # the hub of the needle
    c.rect(PIVOT[0] - 1, PIVOT[1] - 1, PIVOT[0], PIVOT[1], INK)
    c.p(PIVOT[0] - 1, PIVOT[1] - 1, "steel3")
    # a lantern glint on the face
    c.p(PIVOT[0] - 6, PIVOT[1] - 5, "lamp3")
    return c


def liftbtn(kind):
    """10x10 round buttons for the lift: W, W lit, F, F lit, locked (a padlock), hover (a lantern
    ring drawn over either button)."""
    c = Px(10, 10)
    if kind == "hover":
        ring(c, 5, 5, 4.2, 5.0, "lamp2")
        return c
    if kind == "locked":
        disc_lit(c, 5, 5, 5, ("steel0", "steel1", "steel2", "steel3"), rim=1.2)
        c.rows([
            "..kkk.",
            ".k...k",
            ".k...k",
            "kkkkkkk",
            "kBBBBBk",
            "kBBkBBk",
            "kBBBBBk",
            "kkkkkkk",
        ], {"k": INK, "B": "brass2"}, 2, 1)
        c.p(3, 5, "brass3")
        return c
    lit = kind.endswith("lit")
    ramp = ("lamp0", "lamp1", "lamp2", "lamp3") if lit else ("brass0", "brass1", "brass2", "brass3")
    disc_lit(c, 5, 5, 5, ramp, rim=1.2)
    glyph = {"W": ["10001", "10001", "10101", "11011", "10001"],
             "F": ["1111", "1000", "1110", "1000", "1000"]}[kind[0]]
    for yy, row in enumerate(glyph):
        for xx, v in enumerate(row):
            if v == "1":
                c.p(3 + xx - (1 if kind[0] == "W" else 0), 3 + yy, INK)
    return c


# ------------------------------------------------------------------ the notebook
def notebook(hover):
    """A closed leather notebook (the ledger's oxblood), its page block on the right and bottom,
    an elastic band, three ribbon bookmarks hanging out of the bottom (moss, teal, brass)."""
    c = Px(24, 24)
    dy = -1 if hover else 0
    sh, le, lt = LEATHER
    # its shadow on the floor (longer when it lifts)
    c.rect(3, 4, 22, 18 + (1 if hover else 0), "ink1")
    # three ribbon bookmarks hanging out under the cover, forked at the ends
    for x, ln, (m, d) in zip((5, 9, 13), (5, 6, 4), (("moss4", "moss2"), ("teal", "water3"), ("brass3", "brass1"))):
        rib = Px(24, 24)
        rib.vl(x, 15 + dy, 16 + dy + ln, m)
        rib.vl(x + 1, 15 + dy, 16 + dy + ln, d)
        rib.p(x + (ln % 2), 16 + dy + ln, None)
        rib.outline(INK)
        c.paste(rib)
    # the page block (right and bottom edges show), then the cover over it
    block = Px(24, 24)
    block.rect(3, 3 + dy, 21, 17 + dy, PAPER)
    block.vl(21, 4 + dy, 17 + dy, LO)
    block.hl(4, 21, 17 + dy, LO)
    block.vl(20, 4 + dy, 16 + dy, EDGE)
    block.hl(4, 20, 16 + dy, EDGE)
    block.outline(INK)
    c.paste(block)
    cover = Px(24, 24)
    rounded(cover, 1, 1 + dy, 19, 15 + dy, le, r=2)
    cover.hl(3, 17, 2 + dy, lt)
    cover.vl(2, 3 + dy, 13 + dy, lt)
    cover.hl(3, 18, 14 + dy, sh)
    cover.vl(18, 3 + dy, 13 + dy, sh)
    # a paper label on the cover with an ink title rule and a pencil rule
    cover.rect(5, 5 + dy, 12, 9 + dy, PAPER)
    cover.hl(5, 12, 5 + dy, HI)
    cover.hl(6, 11, 6 + dy, INK)
    cover.hl(6, 10, 8 + dy, "wood1")
    cover.hl(5, 12, 10 + dy, sh)
    # the elastic band, over the cover's right side
    cover.vl(15, 1 + dy, 15 + dy, "ink2")
    cover.p(15, 2 + dy, "steel1")
    if hover:   # the lantern catches the lifted cover's corner
        cover.p(3, 3 + dy, "copper3")
        cover.p(4, 2 + dy, "copper3")
        cover.p(3, 4 + dy, "copper2")
    c.paste(cover)
    return c


# ------------------------------------------------------------------ the Swamp Gazette
NEWS_W, NEWS_H = 36, 26
HEADLINE = [3, 12, 30, 8]     # x, y, w, h where code writes the headline


def newspaper(f):
    """The folded Gazette: GAZETTE in ink under a frog-flag rule, a blank band for the headline,
    two columns of grey text below. f 1: the bottom-right corner lifts; f 2: the page half turned."""
    c = Px(NEWS_W, NEWS_H)
    # the paper (the folded back half shows as a darker sheet down-right), its shadow
    c.rect(2, 2, 35, 25, "ink1")
    rounded(c, 1, 1, 34, 24, LO, edge=EDGE, r=1)
    rounded(c, 0, 0, 33, 23, PAPER, edge=EDGE, r=1)
    c.hl(1, 32, 1, HI)
    # masthead
    tiny.text(c, "GAZETTE", 3, 3, INK)
    c.hl(2, 31, 9, INK)
    c.hl(2, 31, 10, "wood4")
    # (the headline band y 12-19 stays blank)
    # columns of text, as grey rules
    for y in (20, 22):
        for x0, x1 in ((3, 14), (18, 30)):
            c.hl(x0, x1 - (y % 3), y, "wood4")
    if f == 1:   # the corner lifts: a fold showing the back of the page
        for i in range(6):
            for j in range(6 - i):
                c.p(33 - j, 23 - i, None) if False else None
        tri = [(33 - j, 23 - i) for i in range(6) for j in range(6 - i)]
        for x, y in tri:
            c.p(x, y, "ink1")
        for i in range(6):
            for j in range(6 - i):
                c.p(33 - 6 + 1 + i, 23 - 6 + 1 + j, LO) if (i + j) < 6 else None
        c.line(28, 23, 33, 18, EDGE)
        c.line(28, 18, 28, 23, EDGE)
        c.line(28, 18, 33, 18, EDGE)
    if f == 2:   # the page half over: its back narrows toward the spine on the left
        for x in range(17, 34):
            t = (x - 17) / 16
            inset = round(t * 3)
            for y in range(0 + inset, 24 - inset):
                c.p(x - 0, y, LO if x < 32 - inset else EDGE)
            c.p(x, inset, EDGE)
            c.p(x, 23 - inset, EDGE)
        c.vl(17, 0, 23, EDGE)
        c.vl(18, 1, 22, HI)
        for y in (5, 8, 11, 14, 17):
            c.hl(20, 28 - (y % 4), y, "wood4")
    return c


# ------------------------------------------------------------------ the toolbox
def toolbox(hover):
    """A red tin toolbox with a steel handle and a brass latch; a wrench pokes out of it. Hover:
    the lid lifts a pixel and a screwdriver peeks out too."""
    c = Px(20, 16)
    dy = -1 if hover else 0
    c.rect(2, 15, 19, 15, "ink1")      # floor shadow
    c.vl(19, 6, 15, "ink1")
    # the body
    rounded(c, 1, 7, 18, 14, "red")
    c.hl(2, 17, 8, "copper2")
    c.hl(2, 17, 13, "copper0")
    c.vl(17, 9, 12, "copper0")
    c.rect(8, 9, 11, 11, "brass2")          # the latch
    c.hl(8, 11, 11, "brass0")
    c.p(8, 9, "brass3")
    c.rect(8, 9, 11, 9, "brass3") if False else None
    # the tools in the lid gap
    if hover:
        c.rows(["k", "Y", "Y", "k"], {"k": INK, "Y": "lamp1"}, 5, 2)
        c.vl(5, 5, 6, "steel3")
    c.rows([
        "kk.kk",
        "kSkSk",
        ".kSk.",
        ".kSk.",
    ], {"k": INK, "S": "steel3"}, 12, 1 + dy)
    # the lid
    rounded(c, 0, 5 + dy, 19, 7 + dy, "copper1")
    c.hl(1, 18, 6 + dy, "copper2")
    # the handle
    c.rows([
        "kkkkkk",
        "kSSSSk",
        "k....k",
    ], {"k": INK, "S": "steel3"}, 7, 2 + dy)
    c.p(8, 3 + dy, "steel4")
    return c


# ------------------------------------------------------------------ the wheel
def hub(hover):
    """The wheel's wooden hub: a disc of end grain (rings), a lit rim, brass tacks; the centre is a
    plain darker recess for the last building picked (16x16 drawn at 6,6)."""
    c = Px(28, 28)
    disc_lit(c, 14, 14, 14, ("wood1", "wood2", "wood3", "wood4"), rim=3)
    for r0 in (11.4,):
        for y in range(28):
            for x in range(28):
                d = math.hypot(x + 0.5 - 14, y + 0.5 - 14)
                if r0 <= d < r0 + 0.8 and c.on(x, y) and (x * 7 + y * 3) % 11 > 3:
                    c.p(x, y, "wood2" if (x + y) < 28 else "wood1")
    ring(c, 14, 14, 9.5, 10.5, "wood1", only_on=True)
    ring(c, 14, 14, 0, 9.5, "wood2", only_on=True)
    for x, y in ((14, 2), (25, 14), (14, 25), (2, 14)):
        c.p(x - 1 if x > 14 else x, y if y < 14 else y - 1 if y > 14 else y, "brass2")
    if hover:
        ring(c, 14, 14, 12.3, 13.1, "lamp2", only_on=True)
    return c


def under(c, cy=8.5, r=8.5):
    """The disc's shadow on the floor: an ink1 crescent 1 px under its bottom edge."""
    for y in range(c.h):
        for x in range(c.w):
            if math.hypot(x + 0.5 - 9, y + 0.5 - cy - 1) < r and math.hypot(x + 0.5 - 9, y + 0.5 - cy) >= r:
                c.p(x, y, "ink1")


def petal(state):
    """18x18 brass disc buttons: normal, hover (lantern-lit), active (pressed in, a gold ring),
    locked (steel, a padlock). The disc is 17 px across on rows 0-16 and casts a 1 px shadow on
    row 17; its face (inside the bevel, about 12 px across, centred on 9, 8.5) is plain for an icon."""
    c = Px(18, 18)
    CX, CY, R = 9, 8.5, 8.5
    if state == "locked":
        under(c)
        disc_lit(c, CX, CY, R, ("steel0", "steel1", "steel2", "steel3"), rim=1.6)
        c.rows([
            "..kkk..",
            ".k...k.",
            ".k...k.",
            "kkkkkkk",
            "kBBBBBk",
            "kBBkBBk",
            "kBBkBBk",
            "kBBBBBk",
            "kkkkkkk",
        ], {"k": INK, "B": "brass2"}, 6, 4)
        c.p(7, 8, "brass3")
        return c
    ramp = {"normal": ("brass0", "brass1", "brass2", "brass3"),
            "hover": ("brass1", "brass2", "brass3", "lamp3"),
            "active": ("brass0", "brass3", "brass1", "brass0")}[state]
    under(c)
    disc_lit(c, CX, CY, R, ramp, rim=1.6)
    if state != "active":       # a bevel: the face sits a step in from its rim
        ring(c, CX, CY, 6.0, 6.8, ramp[1], only_on=True)
        for y in range(18):
            for x in range(18):
                if c.is_(x, y, ramp[1]) and math.hypot(x + 0.5 - CX, y + 0.5 - CY) < 6.8 and (x + y) > 17:
                    c.p(x, y, ramp[3])
    else:                       # pressed: a lantern ring round the face
        ring(c, CX, CY, 6.0, 6.8, "lamp2", only_on=True)
    return c


def disc(state):
    """18x18 paper item discs: normal, hover, affordable (a gold rim), locked (dim paper). Like
    the petals: 17 px across on rows 0-16, a 1 px shadow on row 17."""
    c = Px(18, 18)
    CX, CY = 9, 8.5
    ramp = {"normal": (EDGE, LO, PAPER, HI), "hover": (EDGE, LO, HI, HI),
            "afford": (EDGE, LO, PAPER, HI), "locked": ("wood2", "wood3", "wood4", LO)}[state]
    under(c)
    for y in range(18):
        for x in range(18):
            dx, dy = x + 0.5 - CX, y + 0.5 - CY
            d = math.hypot(dx, dy)
            if d < 7.5:
                lit = (-dx - dy) / max(d, 0.01)
                c.p(x, y, ramp[2])
                if d >= 6.3:
                    c.p(x, y, ramp[3] if lit > 0.4 else ramp[1] if lit < -0.4 else ramp[2])
            elif d < 8.5:
                c.p(x, y, ramp[0] if state != "afford" else INK)
    if state == "afford":
        ring(c, CX, CY, 6.5, 7.5, "brass2", only_on=True)
        for y in range(18):
            for x in range(18):
                if c.is_(x, y, "brass2") and (x + y) < 13:
                    c.p(x, y, "brass3")
    return c


# ------------------------------------------------------------------ the lily pad
def lilypad():
    """Bramble's lily pad (56x14): a wide pad seen low, a notch at the front right, veins, a rim of
    shade on its underside and a ripple on the water; a small bone-and-violet lotus at its left.
    The 48x48 portrait stands on it centred (its feet on rows 3-8)."""
    c = Px(56, 14)
    cx, cy, rx, ry = 27.5, 5.6, 26.4, 5.0

    def inside(x, y, oy=0.0):
        u, v = (x + 0.5 - cx) / rx, (y + 0.5 - cy - oy) / ry
        d = u * u + v * v
        if d > 1:
            return None
        ang = math.atan2(v, u)          # the notch: a wedge from the centre to the front right
        if 0.62 < ang < 1.02 and d > 0.04:
            return None
        return u, v, d

    # ripples on the water round the pad
    for x in range(3, 53):
        if (x // 4) % 3 != 2:
            c.p(x, 13, "water3")
    # the pad's thickness: its underside shows 2 px below the top surface
    for y in range(14):
        for x in range(56):
            if inside(x, y, 1.6) and not inside(x, y):
                c.p(x, y, "moss1")
    # the top surface: lit toward the back (top) and the left
    for y in range(14):
        for x in range(56):
            r = inside(x, y)
            if not r:
                continue
            u, v, d = r
            lit = -0.8 * v - 0.4 * u
            c.p(x, y, "moss5" if lit > 0.62 else "moss4" if lit > 0.12 else "moss3" if lit > -0.45 else "moss2")
    # veins from the notch's root, a shade down from the surface they cross
    down = {"moss5": "moss4", "moss4": "moss3", "moss3": "moss2", "moss2": "moss1"}
    for ang in (2.75, 3.3, 3.9, 4.5, 5.15, 5.7, 1.6, 2.2):
        for t in range(4, 30):
            x = round(cx + math.cos(ang) * t * rx / 27)
            y = round(cy + math.sin(ang) * t * ry / 27)
            p = c.g(x, y)
            for k, v in down.items():
                if c.is_(x, y, k) and inside(x, y):
                    c.p(x, y, v)
                    break
    c.outline(INK)
    # a lotus bud at the left end (bone petals, violet tips, a lantern-lit heart)
    bud = Px(56, 14)
    bud.rows([
        "..v..",
        ".vbv.",
        "vbBbv",
        ".vvv.",
    ], {"v": "violet", "b": PAPER, "B": "lamp3"}, 4, 2)
    bud.outline(INK)
    c.paste(bud)
    return c


def build():
    export("h180_sign", sign(), slice_=[6, 5, 6, 5])
    export("h180_rope", rope(), extra={"tile": "vertical"})
    export("h180_book", [page_left(), page_left().flip()], slice_=[8, 5, 8, 7],
           extra={"order": ["left", "right"]})
    export("h180_bell", [bell(0), bell(-1), bell(0), bell(1)], fps=6, anchor=[8, 0],
           extra={"order": ["rest", "left", "rest", "right"]})
    export("h180_lift", lift(), extra={"pivot": list(PIVOT), "holes": [list(h) for h in HOLES],
                                       "ticks": [180, 120, 60, 0]})
    order = ["W", "Wlit", "F", "Flit", "locked", "hover"]
    export("h180_liftbtn", [liftbtn(k) for k in order], extra={"order": order})
    export("h180_notebook", [notebook(False), notebook(True)], extra={"order": ["closed", "hover"]})
    export("h180_newspaper", [newspaper(f) for f in range(3)], extra={"headline": HEADLINE,
                                                                     "order": ["folded", "lift", "turn"]})
    export("h180_toolbox", [toolbox(False), toolbox(True)], extra={"order": ["normal", "hover"]})
    export("h180_hub", [hub(False), hub(True)], extra={"order": ["normal", "hover"], "well": [6, 6, 16, 16]})
    st = ["normal", "hover", "active", "locked"]
    export("h180_petal", [petal(s) for s in st], extra={"order": st})
    sd = ["normal", "hover", "afford", "locked"]
    export("h180_disc", [disc(s) for s in sd], extra={"order": sd})
    export("h180_lilypad", lilypad(), extra={"portrait": [4, -42]})


if __name__ == "__main__":
    build()
