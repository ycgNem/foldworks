"""town_stall: a Gizmo Festival stall on the Boardwalk, 32x32, 4 frames (fps 6).

Two posts under a striped awning (festival red and bone, a scalloped hem that flutters), a
plank counter with a violet banner, three Gizmos for sale on it (the item's look: a brass box,
a teal eye, an antenna whose tip blinks in turn), the stallholder frog peeking over the goods,
and a pennant on top that swings in the wind. It stands on the promenade's deck behind the
railing (src/render/town.ts puts its bottom row on the deck), so its legs hide behind the rail.
Daylight: lit left, shade right, no lanterns.
"""
from common_town import new, ascii_, P

INK = P["ink"]
STRIPE = (P["red"], P["bone"])
STRIPE_SH = (P["copper0"], P["pave2"])


def awning(s, f):
    """Rows 6-11: a sloping striped awning, its scalloped hem on rows 12-13."""
    for y in range(6, 12):
        inset = (11 - y) // 3      # the top is a little narrower: a slope seen from the front
        for x in range(2 + inset, 30 - inset):
            k = ((x - 2) // 3) % 2
            c = STRIPE[k]
            if y == 6:
                c = P["cloud3"] if k else P["copper2"]
            elif x >= 26 - inset or y == 11:
                c = STRIPE_SH[k]
            s.px(x, y, c)
    # the hem: one scallop per stripe; in the wind every other one lifts, alternating
    for i, x0 in enumerate(range(2, 29, 3)):
        lift = (i + f) % 2 == 0 and f in (1, 3)
        k = i % 2
        for dx in range(3):
            x = x0 + dx
            if x > 29:
                continue
            s.px(x, 12, STRIPE_SH[k] if x > 25 else STRIPE[k])
            if dx == 1 and not lift:
                s.px(x, 13, STRIPE_SH[k])


def pennant(s, f):
    """A pole on the awning's ridge with a swinging pennant."""
    s.line(16, 1, 16, 5, P["wood2"])
    s.px(16, 1, P["lamp2"])
    lean = [0, 1, 0, -1][f]
    rows = {0: ["LLl", "Ll."], 1: ["LLLl", "Ll.."], -1: ["LL.", "L..."]}[lean]
    ascii_(s, 17, 2, rows, key={"L": P["moss5"], "l": P["moss3"]})


def gizmo(s, x, y, blink):
    """A Gizmo, 4 px wide: an antenna with a glowing tip, a brass box with a teal eye."""
    ascii_(s, x, y, [
        "..t." if blink else "..H.",
        "..Y.",
        "zZzY",
        "ztYy",
        "zYYy",
    ], key={"t": P["teal"], "H": P["lamp3"], "Y": P["brass1"], "z": P["brass2"],
            "Z": P["brass3"], "y": P["brass0"]})


def draw(s, f):
    # posts
    for x in (3, 27):
        for y in range(7, 31):
            s.px(x, y, P["wood4"])
            s.px(x + 1, y, P["wood2"])
    # the counter: a lit top, plank front, a violet banner with gold studs
    s.rect(2, 18, 29, 19, P["wood5"])
    s.line(2, 19, 29, 19, P["wood4"])
    s.rect(3, 20, 28, 28, P["wood3"])
    for x in range(6, 28, 4):
        s.line(x, 20, x, 28, P["wood2"])
    s.line(3, 20, 3, 28, P["wood4"])
    s.line(28, 20, 28, 28, P["wood1"])
    s.rect(3, 21, 28, 23, P["violet"])
    s.line(3, 23, 28, 23, P["slag1"])
    for x in range(5, 28, 3):
        s.px(x, 22, P["lamp2"])
    for x in (5, 26):
        s.line(x, 29, x, 30, P["wood2"])
    # the stallholder: a frog's head over the counter
    ascii_(s, 12, 14, [
        ".LL..LL.",
        "LBkLLkBL",
        "LLLLLLLL",
        "llllllll",
    ], key={"k": P["ink"], "L": P["moss5"], "l": P["moss4"], "B": P["bone"]})
    # three Gizmos on the counter, their antenna tips blinking in turn
    for i, gx in enumerate((6, 21, 25)):
        gizmo(s, gx, 13, blink=(f != i))
    awning(s, f)
    pennant(s, f)
    s.outline(INK)


def build():
    s = new(32, 32, 4)
    for f in range(4):
        s.frame(f + 1)
        draw(s, f)
    s.frame(1)
    return s
