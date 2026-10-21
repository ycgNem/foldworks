"""The Inspector's portraits: the frog in the bowler hat from the Inspector Spark
(src/art/spark_inspector.png), styled like the cast's portraits (STYLE.md "Portraits": bold ink
outline, three or four tones lit from the top-left, the lantern's warm rim light on the last pixel
inside the right-hand outline).

He is told apart from Mayor Bramble (a bright frog in a top hat and a blue coat with a sash) by
an olive skin a step darker, a black bowler, a monocle on a brass chain, a prim moustache, a grey
civil-service suit with a wing collar and a red bow tie, half-lidded eyes, and the clipboard held
up at the bottom right.

    portrait_inspector        48x48 x2   face, blink
    portrait_inspector_cheer  48x48 x2   secretly impressed (brows up, a smile, the monocle popped
                                         out on its chain); frame 1 bounces 1 px
    portrait_inspector_small  24x24 x1   drawn for its size, not halved
"""
import math

from kit import Px, export

INK = "ink"
SK = ("moss1", "moss2", "moss3", "moss4")       # skin, dark -> light
SUIT = ("steel0", "steel1", "steel2", "steel3")
HAT = ("ink", "ink1", "ink2", "steel1")


def ell(x, y, cx, cy, rx, ry):
    return ((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2


def tone(ramp, lit):
    return ramp[3] if lit > 0.55 else ramp[2] if lit > -0.15 else ramp[1] if lit > -0.7 else ramp[0]


LIGHT = (-0.42, -0.5, 0.76)


def sphere(u, v):
    """Lambert light on a dome: (u, v) in -1..1 across the shape, lit from the top-left front."""
    nz = math.sqrt(max(0.0, 1 - min(1.0, u * u + v * v)))
    n = math.sqrt(u * u + v * v + nz * nz) or 1
    return (u * LIGHT[0] + v * LIGHT[1] + nz * LIGHT[2]) / n


def rim(c):
    """The lantern's rim light (as portraits.py): the last pixel inside the right-hand outline."""
    warm = ("lamp0", "lamp1", "lamp2")
    pts = []
    for y in range(c.h):
        for x in range(c.w - 2):
            p = c.g(x, y)
            if not p[3] or c.is_(x, y, INK):
                continue
            if c.is_(x + 1, y, INK) and not c.on(x + 2, y):
                L = 0.299 * p[0] + 0.587 * p[1] + 0.114 * p[2]
                pts.append((x, y, warm[0 if L < 90 else 1 if L < 160 else 2]))
    for x, y, w in pts:
        c.p(x, y, w)


def head(c, cheer=False):
    """The head: a wide frog face with two eye bulges, shaded by a light at the top-left."""
    hcx, hcy, hrx, hry = 24, 28.5, 17.5, 9.6
    eyes = ((13.5, 19.5), (34.5, 19.5))
    er = 6.6
    skin = Px(48, 48)
    for y in range(48):
        for x in range(48):
            dh = ell(x, y, hcx, hcy, hrx, hry)
            de = [math.hypot(x + 0.5 - ex, y + 0.5 - ey) / er for ex, ey in eyes]
            if dh <= 1 or min(de) <= 1:
                if dh <= 1:
                    u, v = (x + 0.5 - hcx) / hrx, (y + 0.5 - hcy) / hry
                else:
                    i = de.index(min(de))
                    u, v = (x + 0.5 - eyes[i][0]) / er, (y + 0.5 - eyes[i][1]) / er
                lit = sphere(u, v)
                skin.p(x, y, SK[3] if lit > 0.86 else SK[2] if lit > 0.42 else SK[1] if lit > 0.12 else SK[0])
    # the pale throat under the mouth
    for y in range(33, 39):
        for x in range(48):
            if skin.on(x, y) and ell(x, y, 24, 37, 10.5, 4.2) <= 1:
                skin.p(x, y, "lily" if y < 36 else "moss4")
    skin.outline(INK)
    c.paste(skin)
    return eyes


def eye(c, ex, ey, lid, blink=False, cheer=False):
    """A frog eye: a bone ball, an ink bar pupil, the upper lid down to `lid` rows (officious)."""
    ex, ey = int(ex), int(ey)
    ball = [(x, y) for y in range(ey - 3, ey + 4) for x in range(ex - 3, ex + 4)
            if math.hypot(x - ex, y - ey) <= 3.3]
    for x, y in ball:
        c.p(x, y, "bone")
    for x, y in ball:
        if y >= ey + 2:
            c.p(x, y, "steel4")
    if blink:
        for x, y in ball:
            c.p(x, y, SK[2] if y < ey + 1 else SK[1])
        c.hl(ex - 3, ex + 3, ey + 1, INK)
        return
    # pupil: a horizontal ink bar with a glint
    c.hl(ex - 2, ex + 1, ey, INK)
    c.hl(ex - 1, ex + 1, ey + 1, INK)
    c.p(ex - 1, ey, "steel4") if False else None
    c.p(ex - 2, ey - 1, "bone")
    # the lid: skin over the top of the ball, its edge in ink
    for x, y in ball:
        if y < ey - 3 + lid:
            c.p(x, y, SK[2])
    edge_y = ey - 3 + lid
    c.hl(ex - 3, ex + 3, edge_y, INK)
    if cheer:   # lids up, brows raised: the ball shows round
        pass


def hat(c, tilt=0):
    """The bowler: a black dome with a lit sheen, a brass band, a curled brim."""
    h = Px(48, 48)
    cx, cy = 24 + tilt, 14
    for y in range(4, 15):
        for x in range(48):
            if ell(x, y, cx, cy, 8.6, 9.0) <= 1 and y <= 13:
                u, v = (x + 0.5 - cx) / 8.6, (y + 0.5 - cy) / 9
                lit = -0.7 * u - 0.6 * v - 0.3
                h.p(x, y, HAT[3] if lit > 0.5 else HAT[2] if lit > 0.05 else HAT[1])
    h.hl(cx - 8, cx + 7, 12, "brass1")        # the band
    h.hl(cx - 8, cx + 7, 13, "brass0")
    h.p(cx - 7, 12, "brass3")
    # the brim, curled up at both ends
    h.hl(cx - 12, cx + 11, 14, HAT[2])
    h.hl(cx - 11, cx + 10, 15, HAT[1])
    h.p(cx - 12, 13, HAT[2])
    h.p(cx + 11, 13, HAT[1])
    h.hl(cx - 10, cx - 4, 14, "steel1")        # the brim's lit edge
    h.outline(INK)
    c.paste(h)


def body(c):
    """Shoulders in a grey suit, a wing collar, a red bow tie, the brass watch chain."""
    b = Px(48, 48)
    for y in range(37, 48):
        half = 13 + (y - 37) * 1.25
        for x in range(48):
            if abs(x + 0.5 - 24) <= half:
                u = (x + 0.5 - 24) / half
                lit = -0.8 * u - 0.1
                b.p(x, y, tone(SUIT, lit))
    # lapels: two darker wedges from the collar out and down
    for y in range(39, 48):
        w = (y - 39) // 2
        b.hl(24 - 6 - w, 24 - 4 - w, y, SUIT[1])
        b.hl(24 + 3 + w, 24 + 5 + w, y, SUIT[0])
    # the shirt front between the lapels
    for y in range(39, 48):
        w = 2 + (y - 39) // 3
        b.hl(24 - w, 23 + w, y, "bone")
    b.outline(INK)
    c.paste(b)


def collar(c):
    """The wing collar's points and the bow tie, over the bottom of the throat."""
    c.rows([
        "kbbk..kbbk",
        ".kbbkkbbk.",
        "..krrrrk..",
        ".krRkkRrk.",
        ".krRkkRrk.",
        "..kkkkkk..",
    ], {"k": INK, "b": "bone", "r": "red", "R": "copper0"}, 19, 37)
    # the shirt's buttons
    c.p(24, 44, "steel3")
    c.p(23, 46, "steel3")


def clipboard(c, dy=0):
    """The clipboard held up at the bottom right, a hand's fingers over its edge."""
    k = Px(48, 48)
    k.rect(33, 37 + dy, 46, 47, "wood2")
    k.hl(33, 46, 37 + dy, "wood3")
    k.rect(35, 40 + dy, 45, 47, "bone")
    k.hl(35, 45, 40 + dy, "lamp3")
    for y in (42, 44, 46):
        k.hl(36, 43 - (y % 3), y + dy, "wood4")
    k.rows(["kkkk", "kSSk", "kssk"], {"k": INK, "S": "steel3", "s": "steel1"}, 38, 36 + dy)
    k.outline(INK)
    c.paste(k)
    # fingers gripping the board's left edge
    c.rows([
        "kk.",
        "Gmk",
        "kkk",
        "Gmk",
        "kkk",
    ], {"k": INK, "G": SK[3], "m": SK[2]}, 32, 41 + dy)


def face(c, eyes, blink=False, cheer=False):
    (lx, ly), (rx, ry) = eyes
    eye(c, lx, ly, 3 if not cheer else 1, blink)
    eye(c, rx, ry, 3 if not cheer else 1, blink)
    # brows: flat and stern, or raised in surprise
    by = int(ly) - 5 if not cheer else int(ly) - 6
    c.hl(int(lx) - 2, int(lx) + 2, by, INK)
    c.hl(int(rx) - 2, int(rx) + 2, by, INK)
    if not cheer:
        c.p(int(lx) + 3, by + 1, INK)
        c.p(int(rx) - 3, by + 1, INK)
    # nostrils
    c.p(21, 26, INK)
    c.p(27, 26, INK)
    # the moustache: a prim brown brush with waxed, curled ends
    if not cheer:   # drooping: not impressed
        c.rows([
            "..kkkkkkkkk..",
            ".kMMMMMMMMMk.",
            "kMMMkkkkkMMMk",
            "kMk.......kMk",
            ".k.........k.",
        ], {"k": INK, "M": "wood1"}, 18, 27)
        c.hl(20, 23, 28, "wood2")
    else:           # it perks up at the ends despite him
        c.rows([
            "k...........k",
            "kMk.kkkkk.kMk",
            ".kMkMMMMMkMk.",
            "..kMMMMMMMk..",
            "...kkkkkkk...",
        ], {"k": INK, "M": "wood1"}, 18, 26)
        c.hl(22, 25, 28, "wood2")
    if not cheer:
        # the mouth: a long straight line, the corners just turned down
        c.hl(12, 36, 33, INK)
        c.p(11, 34, INK)
        c.p(37, 34, INK)
    else:
        # a wide pleased smile
        c.hl(13, 35, 33, INK)
        c.p(12, 32, INK)
        c.p(36, 32, INK)
        c.hl(15, 33, 34, INK)
        c.hl(17, 31, 35, "copper0")
        c.hl(19, 29, 35, "copper1")
        c.hl(17, 31, 36, INK)


def monocle(c, eyes, popped=False):
    (rx, ry) = eyes[1]
    rx, ry = int(rx), int(ry)
    if popped:   # it falls out and swings on its chain by his cheek
        mx, my = rx - 5, ry + 21
    else:
        mx, my = rx, ry
    ring = [(x, y) for y in range(my - 5, my + 6) for x in range(mx - 5, mx + 6)
            if 3.6 <= math.hypot(x - mx, y - my) < 4.6]
    for x, y in ring:
        c.p(x, y, "brass2" if (x - mx) + (y - my) < 0 else "brass1")
    c.p(mx - 2, my - 3, "lamp3")
    c.p(mx - 3, my - 2, "brass3")
    # the chain down to his collar
    pts = [(mx + 3, my + 4), (mx + 3, my + 6), (mx + 2, my + 8), (mx + 1, my + 10), (mx, my + 12)]
    if popped:
        pts = [(mx - 1, my - 5), (mx - 2, my - 6)]
    for x, y in pts:
        if c.on(x, y) and not c.is_(x, y, INK):
            c.p(x, y, "brass2")


def portrait(blink=False, cheer=False, bounce=False):
    c = Px(48, 48)
    body(c)
    eyes = head(c, cheer)
    collar(c)
    hat(c)
    face(c, eyes, blink, cheer)
    monocle(c, eyes, popped=cheer)
    clipboard(c)
    rim(c)
    if bounce:
        c = c.shift(0, -1)
    return c


def small():
    """24x24, drawn for its size: the bowler, two heavy-lidded eyes, the monocle, the drooping
    moustache, the collar and bow tie, the suit, the clipboard's corner."""
    c = Px(24, 24)
    # suit
    b = Px(24, 24)
    for y in range(18, 24):
        half = 7 + (y - 18) * 1.3
        for x in range(24):
            if abs(x + 0.5 - 12) <= half:
                u = (x + 0.5 - 12) / half
                b.p(x, y, tone(SUIT, -0.8 * u - 0.1))
    for y in range(19, 24):
        w = 1 + (y - 19) // 3
        b.hl(12 - w, 11 + w, y, "bone")
    b.outline(INK)
    c.paste(b)
    # head and eye bulges
    sk = Px(24, 24)
    hc, eyes = (12, 13.0, 10.6, 5.4), ((5.5, 8.6), (18.5, 8.6))
    for y in range(24):
        for x in range(24):
            dh = ell(x, y, *hc)
            de = [math.hypot(x + 0.5 - ex, y + 0.5 - ey) / 3.5 for ex, ey in eyes]
            if dh <= 1:
                u, v = (x + 0.5 - hc[0]) / hc[2], (y + 0.5 - hc[1]) / hc[3]
            elif min(de) <= 1:
                i = de.index(min(de))
                u, v = (x + 0.5 - eyes[i][0]) / 3.5, (y + 0.5 - eyes[i][1]) / 3.5
            else:
                continue
            lit = sphere(u, v)
            sk.p(x, y, SK[3] if lit > 0.86 else SK[2] if lit > 0.42 else SK[1] if lit > 0.12 else SK[0])
    sk.hl(9, 14, 17, "lily")
    sk.outline(INK)
    c.paste(sk)
    # eyes: bone balls under heavy lids, ink pupils
    for ex in (5, 18):
        c.hl(ex - 1, ex + 1, 8, INK)          # the lid's edge
        c.hl(ex - 1, ex + 1, 9, "bone")
        c.p(ex, 9, INK)
        c.p(ex + 1 if ex == 5 else ex - 1, 9, INK)
        c.hl(ex - 1, ex + 1, 10, "steel4")
    # the monocle round the right eye
    for x, y in ((16, 8), (16, 9), (16, 10), (17, 11), (18, 11), (19, 11), (20, 10), (20, 9), (20, 8),
                 (17, 7), (18, 7), (19, 7)):
        c.p(x, y, "brass2" if y < 9 or x < 17 else "brass1")
    c.p(17, 7, "lamp3")
    # nostrils, moustache, mouth
    c.p(10, 12, INK)
    c.p(13, 12, INK)
    c.rows([".kkkkkk.", "kMMMMMMk", "k.....k."], {"k": INK, "M": "wood1"}, 8, 13)
    c.p(15, 15, INK)
    c.p(14, 15, None) if False else None
    c.hl(4, 19, 16, INK)
    # the bowler
    h = Px(24, 24)
    h.rows([
        "..QQqq..",
        ".Qqqqqq.",
        "Qqqqqqqq",
        "BBBBBBBB",
    ], {"Q": "steel1", "q": "ink2", "B": "brass1"}, 8, 1)
    h.hl(6, 17, 5, "ink2")
    h.hl(6, 9, 5, "steel1")
    h.outline(INK)
    c.paste(h)
    # collar and bow tie
    c.rows(["kbk.kbk", ".krrrk.", ".kRkRk."], {"k": INK, "b": "bone", "r": "red", "R": "copper0"}, 9, 17)
    # the clipboard's corner at the bottom right
    k = Px(24, 24)
    k.rect(18, 19, 23, 23, "wood2")
    k.rect(19, 20, 23, 23, "bone")
    k.hl(20, 22, 21, "wood4")
    k.hl(19, 21, 19, "steel3")
    k.outline(INK)
    c.paste(k)
    rim(c)
    return c


def build():
    export("portrait_inspector", [portrait(), portrait(blink=True)])
    export("portrait_inspector_cheer", [portrait(cheer=True), portrait(cheer=True, bounce=True)])
    export("portrait_inspector_small", small())


if __name__ == "__main__":
    build()
