"""town_house: the frog town's houses on the sky island, 32x32, one variant per frame (fps 0).

Order (src/render/town.ts picks by name): hut, gable, lily, tall, brick, bramble.

Every house stands on the same footing so they share a ground line: a stone foundation whose
lit cap is row 27 (faces 28-30), the ink outline on row 31, and a stone step (or a two-tier
stair) in front of the door. Walls stop on row 26, a step in from the foundation's ends, so the
foundation shows as a ledge. Daylight from the top-left: lit left edges and slopes, the roof's
shadow along the wall's top, glass that reflects the sky.

Silhouettes first, so they tell apart at 1x: the hut is a thatch dome, the gable a copper
triangle with a chimney, the lily house a wide flat pad with a flower on top, the tall house a
narrow blue tower in a tin hat, the brick cottage a turf hump, and the Mayor's house the widest,
two storeys under a teal hip roof with his flag.
"""
from common_town import (new, ascii_, ell, window, door, stone_base, step, planks_v, siding, P, KEY)

ORDER = ["hut", "gable", "lily", "tall", "brick", "bramble"]
INK = P["ink"]
F_TOP, F_BOT = 27, 30   # the foundation's cap row and its last row (row 31 is the outline)
WALL_BOT = 26


def stair(s, x0, x1):
    """A two-tier stone stair from a door spanning x0..x1: a top slab one wider each side on rows
    27-28, a lower slab two wider on rows 29-30."""
    step(s, x0 - 2, x1 + 2, 29, rows=2)
    step(s, x0 - 1, x1 + 1, 27, rows=2)


def eave_shadow(s, x0, x1, y, col):
    s.line(x0, y, x1, y, col)


def finish(s):
    s.outline(INK)


# ------------------------------------------------------------------ hut: thatch dome
def hut(s):
    # walls first (the thatch's fringe overlaps their top), then the dome, then the foundation
    planks_v(s, 8, 18, 23, WALL_BOT, P["wood3"], P["wood2"], lit=P["wood4"], step_=3, off=1)
    s.line(23, 18, 23, WALL_BOT, P["wood2"])
    s.line(22, 18, 22, WALL_BOT, P["wood2"])
    s.line(8, 20, 23, 20, P["wood2"])
    # thatch: a dome of golden straw, lit top-left, shaded right, a ragged fringe
    cx = 16.0
    for r in range(3, 20):
        t = (19.5 - r) / 17.0
        hw = 12.5 * max(0.0, 1 - t * t) ** 0.5
        a, b = int(round(cx - hw)), int(round(cx + hw)) - 1
        for x in range(a, b + 1):
            nx = (x + 0.5 - cx) / max(hw, 1)
            c = P["brass2"]
            if nx < -0.15 and r < 17 and nx + (17 - r) / 30 > -0.9:
                c = P["brass3"]
            if nx > 0.5 or (r >= 17 and nx > 0.2):
                c = P["brass1"]
            s.px(x, r, c)
    # straw strokes: short vertical dashes, staggered by row band
    for (x, y0, n) in ((6, 15, 3), (9, 12, 3), (12, 15, 3), (11, 8, 2), (14, 11, 3), (17, 14, 3),
                       (16, 6, 2), (19, 9, 3), (21, 13, 3), (24, 15, 3), (8, 17, 2), (26, 16, 2)):
        for k in range(n):
            if s.get(x, y0 + k) is not None:
                s.px(x, y0 + k, P["brass1"] if x > 15 else P["brass2"])
    for x in range(4, 28):
        if x % 3 == 1:
            s.px(x, 19, None)
    s.line(5, 18, 26, 18, P["brass1"])
    for x in range(6, 26, 3):
        s.px(x, 17, P["brass1"])
    # a knot of straw at the top, tied with a cord
    ascii_(s, 14, 1, [
        ".Zz.",
        "zZzY",
        "cccb",
    ])
    stone_base(s, 7, 24, F_TOP, F_BOT, seed=1)
    # the door (arched) and two little windows
    door(s, 14, 21, 17, WALL_BOT, arch=True)
    window(s, 10, 22, 2, 2)
    window(s, 20, 22, 2, 2)
    step(s, 13, 18, 28)
    # a pot of reeds on the ground beside the house
    ascii_(s, 25, 23, [
        ".n.l",
        "nl.n",
        ".nn.",
        "RpPR",
        "RppR",
        ".RR.",
    ])
    finish(s)


# ------------------------------------------------------------------ gable: copper roof, chimney
def gable(s):
    stone_base(s, 5, 26, F_TOP, F_BOT, seed=2)
    siding(s, 6, 17, 25, WALL_BOT, P["wood4"], P["wood3"], lit=P["wood5"], step_=2)
    s.line(25, 17, 25, WALL_BOT, P["wood3"])
    # corner posts
    s.line(6, 17, 6, WALL_BOT, P["wood2"])
    s.line(25, 17, 25, WALL_BOT, P["wood1"])
    s.line(7, 17, 7, WALL_BOT, P["wood5"])
    # the chimney (behind the roof's right slope)
    s.rect(20, 3, 23, 10, P["copper1"])
    s.line(20, 3, 20, 10, P["copper2"])
    for y in (5, 7, 9):
        s.line(21, y, 23, y, P["copper0"])
    s.rect(19, 2, 24, 3, P["pave2"])
    s.line(19, 2, 24, 2, P["pave3"])
    # the roof: a steep hip in copper shingles, ridge on row 3
    for r in range(3, 18):
        hw = 1.5 + (r - 3) * 12.0 / 14
        a, b = int(round(15.5 - hw)) + 1, int(round(15.5 + hw))
        s.line(a, r, b, r, P["copper2"])
        # shingle courses: every other row a scalloped darker line
        if r % 2 == 0:
            for x in range(a, b + 1):
                if (x + r // 2) % 3 != 0:
                    s.px(x, r, P["copper1"])
        s.px(a, r, P["copper3"])
        if a + 1 < b:
            s.px(a + 1, r, P["copper3"] if r % 2 else P["copper2"])
        s.px(b, r, P["copper0"])
        if b - 1 > a + 1:
            s.px(b - 1, r, P["copper1"])
    # the lit left half: a lighter wedge
    for r in range(4, 17):
        hw = 1.5 + (r - 3) * 12.0 / 14
        a = int(round(15.5 - hw)) + 1
        for x in range(a + 2, min(15, a + 2 + (r - 3) // 3)):
            if r % 2:
                s.px(x, r, P["copper3"])
    # the eave: a fascia board and its shadow on the wall
    s.line(2, 17, 29, 17, P["copper0"])
    s.line(3, 17, 28, 17, P["copper1"])
    s.line(6, 18, 25, 18, P["wood2"])
    # a dormer window in the roof
    s.rect(13, 9, 18, 13, P["wood4"])
    s.line(13, 9, 18, 9, P["copper1"])
    window(s, 14, 11, 4, 2)
    s.line(12, 9, 19, 9, P["copper0"])
    s.px(12, 10, P["copper0"])
    s.px(19, 10, P["copper0"])
    s.line(13, 8, 18, 8, P["copper2"])
    # walls: door, two windows with shutters
    door(s, 14, 20, 17, WALL_BOT, base=P["copper1"], lit=P["copper2"])
    s.line(15, 20, 15, WALL_BOT, P["copper0"])
    s.line(17, 20, 17, WALL_BOT, P["copper0"])
    window(s, 9, 20, 3, 3, cross=False, shutters=P["moss3"], sill=P["wood2"])
    window(s, 21, 20, 3, 3, cross=False, shutters=P["moss3"], sill=P["wood2"])
    stair(s, 14, 17)
    finish(s)


# ------------------------------------------------------------------ lily: a pad roof, a flower
def lily(s):
    stone_base(s, 8, 23, F_TOP, F_BOT, seed=3)
    # the round wall: bone plaster, shaded like a barrel
    s.rect(9, 15, 22, WALL_BOT, P["bone"])
    s.line(9, 15, 9, WALL_BOT, P["pave3"])
    s.line(10, 15, 10, WALL_BOT, WHITE_ := P["cloud3"])
    for x, c in ((19, P["pave3"]), (20, P["pave3"]), (21, P["pave2"]), (22, P["pave1"])):
        s.line(x, 15, x, WALL_BOT, c)
    s.line(9, 17, 22, 17, P["pave2"])
    # the pad: a wide flat ellipse, lit top-left, its thick rim underneath
    ell(s, 16, 13.5, 15, 4.6, P["moss2"])
    ell(s, 15.6, 12.6, 14.4, 3.9, P["moss4"])
    ell(s, 12.5, 11.6, 9, 2.4, P["moss5"], only=P["moss4"])
    ell(s, 9.5, 11.2, 4, 1.2, P["lily"], only=P["moss5"])
    # veins from the centre
    for (x, y) in ((8, 13), (11, 13), (13, 14), (22, 13), (25, 12), (20, 14), (5, 12), (27, 13)):
        s.px(x, y, P["moss3"])
    # the notch: a V cut toward the front-right
    for (x, y) in ((19, 13), (20, 14), (20, 15), (21, 15), (21, 16)):
        s.px(x, y, P["moss1"])
    s.px(22, 16, None)
    s.px(21, 17, P["moss1"])
    # under the pad: its shadow on the wall
    s.line(9, 18, 22, 18, P["pave2"])
    # the flower: bone petals tipped violet, a gold heart
    ascii_(s, 17, 2, [
        "...vB...",
        ".vBBvBv.",
        "vBBgBBBv",
        "BBgHgBvB",
        ".BBgBBv.",
        "..vBBv..",
    ])
    s.line(20, 8, 20, 9, P["moss3"])
    s.px(21, 9, P["moss2"])
    # a round door and a porthole window
    door(s, 14, 21, 17, WALL_BOT, base=P["moss2"], lit=P["moss3"], arch=True)
    s.line(15, 21, 15, WALL_BOT, P["moss1"])
    s.line(17, 21, 17, WALL_BOT, P["moss1"])
    s.px(16, 23, P["brass3"])
    ascii_(s, 10, 20, [
        ".kkk.",
        "kWJ~k",
        "kJ~Ik",
        ".kkk.",
    ])
    step(s, 13, 18, 28)
    finish(s)


# ------------------------------------------------------------------ tall: blue tower, tin hat
def tall(s):
    stone_base(s, 8, 23, F_TOP, F_BOT, seed=4)
    planks_v(s, 9, 9, 22, WALL_BOT, P["iron1"], P["iron0"], lit=P["iron2"], step_=3, off=0)
    s.line(22, 9, 22, WALL_BOT, P["iron0"])
    s.line(21, 9, 21, WALL_BOT, P["iron0"])
    # floor beams
    for y in (15, 21):
        s.line(9, y, 22, y, P["wood2"])
        s.px(9, y, P["wood3"])
    s.line(9, 10, 22, 10, P["iron0"])
    # the tin hat: a steep pyramid, corrugated
    for r in range(2, 10):
        hw = 2 + (r - 2) * 7.5 / 7
        a, b = int(round(15.5 - hw)) + 1, int(round(15.5 + hw))
        for x in range(a, b + 1):
            s.px(x, r, P["steel4"] if (x % 2 == 0 and x < 17) else P["steel3"])
        s.px(b, r, P["steel1"])
        if b - 1 > a:
            s.px(b - 1, r, P["steel2"])
        s.px(a, r, P["cloud3"] if r < 6 else P["steel4"])
    s.line(6, 9, 25, 9, P["steel2"])
    s.line(7, 9, 24, 9, P["steel3"])
    s.px(6, 9, P["steel4"])
    # a stovepipe with a cap
    s.rect(19, 1, 20, 4, P["steel1"])
    s.px(19, 1, P["steel2"])
    s.line(18, 1, 21, 1, P["steel0"])
    # windows: one up top with a flower box, two on the middle floor, the door
    window(s, 14, 11, 4, 3)
    s.line(13, 14, 18, 14, P["copper1"])
    for x in (14, 16, 18):
        s.px(x, 14, P["red"] if x != 16 else P["lamp2"])
    window(s, 11, 17, 2, 3)
    window(s, 19, 17, 2, 3)
    door(s, 14, 22, 17, WALL_BOT, base=P["wood3"], lit=P["wood4"])
    s.line(16, 22, 16, WALL_BOT, P["wood2"])
    step(s, 13, 18, 28)
    finish(s)


# ------------------------------------------------------------------ brick: turf hump, chimney
def brick(s):
    stone_base(s, 5, 26, F_TOP, F_BOT, seed=5)
    # walls: bricks in staggered courses
    s.rect(6, 15, 25, WALL_BOT, P["copper1"])
    for y in range(15, WALL_BOT + 1):
        if (y - 15) % 2 == 1:
            s.line(6, y, 25, y, P["copper0"])
        else:
            off = 0 if ((y - 15) // 2) % 2 == 0 else 2
            for x in range(6 + off, 26, 4):
                s.px(x, y, P["copper0"])
            for x in range(7 + off, 26, 8):
                s.px(x, y, P["copper2"])
    s.line(6, 15, 6, WALL_BOT, P["copper2"])
    s.line(25, 15, 25, WALL_BOT, P["copper0"])
    # a stone chimney poking out of the turf
    s.rect(20, 2, 23, 8, P["pave2"])
    s.line(20, 2, 20, 8, P["pave3"])
    s.line(23, 2, 23, 8, P["pave1"])
    s.line(21, 4, 23, 4, P["pave1"])
    s.line(20, 6, 22, 6, P["pave1"])
    s.line(19, 2, 24, 2, P["pave3"])
    # the turf roof: a hump of sod, dirt along its eave
    ell(s, 16, 17.5, 14.5, 11, P["moss3"])
    for y in range(18, 32):
        for x in range(32):
            if s.get(x, y) == tuple(int(P["moss3"][i:i + 2], 16) for i in (1, 3, 5)) + (255,):
                s.px(x, y, None)
    s.rect(6, 18, 25, WALL_BOT, P["copper1"])
    for y in range(18, WALL_BOT + 1):
        if (y - 15) % 2 == 1:
            s.line(6, y, 25, y, P["copper0"])
        else:
            off = 0 if ((y - 15) // 2) % 2 == 0 else 2
            for x in range(6 + off, 26, 4):
                s.px(x, y, P["copper0"])
            for x in range(7 + off, 26, 8):
                s.px(x, y, P["copper2"])
    s.line(6, 18, 6, WALL_BOT, P["copper2"])
    s.line(25, 18, 25, WALL_BOT, P["copper0"])
    stone_base(s, 5, 26, F_TOP, F_BOT, seed=5)
    ell(s, 14.5, 14.5, 11.5, 8, P["moss4"], only=P["moss3"])
    ell(s, 12.5, 12.0, 7.5, 4.5, P["moss5"], only=P["moss4"])
    s.line(2, 17, 29, 17, P["earth2"])
    s.line(3, 16, 28, 16, P["moss2"])
    for x in range(3, 29, 4):
        s.px(x, 17, P["earth1"])
        s.px(x + 2, 16, P["moss3"])
    # flowers in the turf
    for (x, y, c) in ((9, 10, P["violet"]), (14, 8, P["bone"]), (19, 11, P["lamp2"]), (7, 14, P["bone"]),
                      (24, 13, P["violet"]), (12, 13, P["lamp2"]), (17, 14, P["bone"]), (26, 15, P["bone"])):
        s.px(x, y, c)
    # the eave's shadow on the bricks
    s.line(6, 18, 25, 18, P["copper0"])
    # an arched door, two windows with moss-green shutters
    door(s, 14, 21, 17, WALL_BOT, base=P["wood2"], lit=P["wood3"], arch=True)
    window(s, 9, 21, 2, 3, shutters=P["moss3"])
    window(s, 21, 21, 2, 3, shutters=P["moss3"])
    step(s, 13, 18, 28)
    finish(s)


# ------------------------------------------------------------------ bramble: the Mayor's house
def bramble(s):
    stone_base(s, 2, 29, F_TOP, F_BOT, seed=6)
    # two storeys of bone plaster in a timber frame
    s.rect(3, 13, 28, WALL_BOT, P["bone"])
    s.line(4, 13, 4, WALL_BOT, P["cloud3"])
    for x in (3, 15, 16, 28):
        s.line(x, 13, x, WALL_BOT, P["wood2"])
    s.line(28, 13, 28, WALL_BOT, P["wood1"])
    s.line(24, 13, 27, 13, P["pave3"])
    for x in (25, 26, 27):
        s.line(x, 14, x, WALL_BOT, P["pave3"])
    s.line(3, 19, 28, 19, P["wood2"])
    s.line(3, 20, 28, 20, P["wood1"])
    s.px(3, 19, P["wood3"])
    # the chimney (stone), left
    s.rect(6, 1, 9, 6, P["pave2"])
    s.line(6, 1, 6, 6, P["pave3"])
    s.line(9, 1, 9, 6, P["pave1"])
    s.line(7, 3, 9, 3, P["pave1"])
    s.line(5, 1, 10, 1, P["pave3"])
    # the flagpole and Bramble's green pennant, right
    s.line(24, 1, 24, 6, P["wood2"])
    s.px(24, 1, P["lamp2"])
    ascii_(s, 25, 1, [
        "LLLl",
        "lLln",
        "nn..",
    ])
    # the hip roof: teal slate, ridge on row 5
    for r in range(5, 13):
        a, b = 6 - (r - 5) * 5 // 7, 25 + (r - 5) * 5 // 7
        a = max(1, a)
        b = min(30, b)
        s.line(a, r, b, r, P["water3"])
        if r % 2 == 0:
            for x in range(a, b + 1):
                if (x + r // 2) % 3 == 0:
                    s.px(x, r, P["water2"])
        s.px(a, r, P["water4"])
        s.px(a + 1, r, P["water4"])
        s.px(b, r, P["water2"])
        s.px(b - 1, r, P["water2"])
    s.line(6, 5, 25, 5, P["teal"])
    s.line(5, 6, 13, 6, P["water4"])
    s.line(4, 8, 9, 8, P["water4"])
    s.line(1, 12, 30, 12, P["water2"])
    s.line(3, 13, 28, 13, P["wood1"])
    # a gold finial on the ridge
    s.px(15, 4, P["lamp2"])
    s.px(16, 4, P["brass2"])
    # upper windows: three, the middle one wide over a little balcony
    window(s, 6, 15, 3, 3, cross=True)
    window(s, 22, 15, 3, 3, cross=True)
    window(s, 13, 15, 6, 3, cross=True)
    s.line(12, 18, 19, 18, P["wood3"])
    for x in range(12, 20, 2):
        s.px(x, 18, P["wood1"])
    # ground floor: two windows, the double door under a gold plaque
    window(s, 6, 22, 3, 3, shutters=P["moss3"])
    window(s, 22, 22, 3, 3, shutters=P["moss3"])
    door(s, 13, 23, 18, WALL_BOT, base=P["moss2"], lit=P["moss3"], knob=P["lamp2"])
    s.line(15, 23, 16, 23, P["moss1"])
    s.line(15, 23, 15, WALL_BOT, P["moss1"])
    s.line(16, 23, 16, WALL_BOT, P["moss1"])
    s.px(17, 25, P["lamp2"])
    s.px(14, 25, P["lamp2"])
    s.rect(13, 21, 18, 21, P["brass2"])
    s.line(14, 21, 17, 21, P["lamp2"])
    s.px(13, 21, P["brass1"])
    s.px(18, 21, P["brass1"])
    stair(s, 13, 18)
    finish(s)


DRAW = {"hut": hut, "gable": gable, "lily": lily, "tall": tall, "brick": brick, "bramble": bramble}


def build():
    s = new(32, 32, len(ORDER))
    for i, name in enumerate(ORDER):
        s.frame(i + 1)
        DRAW[name](s)
    s.frame(1)
    return s
