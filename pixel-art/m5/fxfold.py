"""fx_fold (32x32 x8, fps 16, half a second): the fold moment, drawn over the fold box and scaled
by whole numbers to cover it (it reads at any aspect: every shape is built from the box's own
corners and diagonals, so a 3x2-tile box just gets a wider sheet).

    f0  a sheet of paper lands on the box: bone, an ink edge, gold corner brackets, and the crease
        starting: a bright sweep line enters from the left, the diamond crease drawn behind it
    f1  the sweep has crossed; the diamond crease (the lines joining the edge midpoints) is laid
    f2  the four corners start folding in along the crease: each corner leaves (clear) and its
        flap, the paper's back (hull3, a gold fold edge), lies on the sheet
    f3  the flaps at two thirds
    f4  the flaps meet in the middle: a sealed envelope diamond, gold seams to the centre
    f5  the flash: the envelope pops into a hot white burst with eight rays
    f6  a ring of sparkles flying out, a small gold core
    f7  one four-point sparkle and four specks: the last glint

Colours: bone paper, hull3 paper back, hull2 fold shade, gold/brass1 accents, hot/bone flash,
ink edges. Corners and the middle are transparent outside the shapes, so the box shows through
on the last frames.
"""
import math
from common_m5 import P, new

k, bone, gold, hot = P["ink"], P["bone"], P["gold"], P["hot"]
b0, b1, glow = P["brass0"], P["brass1"], P["glow"]
h1, h2, h3 = P["hull1"], P["hull2"], P["hull3"]

N = 32
A, B = 1, 30          # the sheet spans pixels 1..30; ink at 0 and 31


def corner_u(x, y):
    """Distance (in x+y steps) to the nearest sheet corner, and which corner."""
    best = None
    for (cx, cy, sx, sy) in ((A, A, 1, 1), (B, A, -1, 1), (A, B, 1, -1), (B, B, -1, -1)):
        u = (x - cx) * sx + (y - cy) * sy
        if best is None or u < best[0]:
            best = (u, (cx, cy, sx, sy))
    return best


def sheet(s, d, sweep=None, crease=1.0):
    """The paper with its four corners folded in by d (0 = flat). `sweep` is the x of the bright
    crease line moving across; `crease` how much of the diamond is drawn (0..1, left to right)."""
    paper = {}
    for y in range(A, B + 1):
        for x in range(A, B + 1):
            u, _ = corner_u(x, y)
            if u < d:
                continue                                   # the corner has folded away
            if d and u < 2 * d:
                # the flap: the paper's back, lit near its fold edge, darker near its tip
                col = h3
                if u == d:
                    col = gold                             # the fold edge catches the light
                elif u == d + 1:
                    col = hot
                elif u == 2 * d - 1:
                    col = h2                               # the tip's shadow on the sheet
                paper[(x, y)] = col
            else:
                col = bone
                if x == B or y == B:
                    col = h3                               # the sheet's own lower-right edge
                paper[(x, y)] = col
    # the diamond crease (midpoint to midpoint), revealed up to x <= reveal
    reveal = A + (B - A) * crease
    m = (A + B) / 2
    for (x, y), col in list(paper.items()):
        if x > reveal or col != bone:
            continue
        on = abs(abs(x + 0.5 - (m + 0.5)) + abs(y + 0.5 - (m + 0.5)) - (B - A + 1) / 2) < 0.6
        if on:
            paper[(x, y)] = h2 if (x + y) % 2 else b1
    # paper grain
    for (x, y) in ((7, 9), (21, 6), (12, 22), (25, 19), (17, 13), (5, 25), (26, 27)):
        if paper.get((x, y)) == bone:
            paper[(x, y)] = h3
    for (x, y), col in paper.items():
        s.px(x, y, col)
    # the sweep: a bright vertical bar with a gold leading edge
    if sweep is not None:
        for y in range(A, B + 1):
            for dx, col in ((-3, hot), (-2, gold), (-1, glow), (0, glow), (1, gold)):
                if (sweep + dx, y) in paper:
                    s.px(sweep + dx, y, col)
    # the ink edge round whatever is there
    s.outline(k)
    # gold corner brackets while the corners are still there
    if d == 0:
        for (cx, cy, sx, sy) in ((A, A, 1, 1), (B, A, -1, 1), (A, B, 1, -1), (B, B, -1, -1)):
            for i in range(4):
                s.px(cx + sx * i, cy, gold)
                s.px(cx, cy + sy * i, gold)
            s.px(cx, cy, hot)


def seams(s):
    """The envelope: four triangular flaps meeting in the middle. Neighbouring flaps meet along
    the lines from the centre to the diamond's points (a plus, not an X); the two flaps away
    from the light are a step darker; a gold wax seal sits where they meet."""
    for y in range(N):
        for x in range(N):
            v = s.get(x, y)
            if not v or v[3] == 0 or "#%02x%02x%02x" % v[:3] != h3:
                continue
            if y >= 16 and abs(x - 15.5) < y - 15.5:          # the bottom flap, in shade
                s.px(x, y, h2)
            elif x >= 16 and abs(y - 15.5) < x - 15.5:        # the right flap, in shade too
                s.px(x, y, h2)
    for i in range(2, 14):
        for (x, y) in ((15, 15 - i), (16, 16 + i), (15 - i, 15), (16 + i, 16)):
            v = s.get(x, y)
            if v and v[3] and "#%02x%02x%02x" % v[:3] not in (k, gold, hot):
                s.px(x, y, h1)
    for y in range(12, 20):                                  # the seal: a gold disc, lit top-left
        for x in range(12, 20):
            d = math.hypot(x + 0.5 - 16, y + 0.5 - 16)
            if d <= 3.3:
                s.px(x, y, b0 if d > 2.6 else (b1 if x + y > 31 else gold))
    s.px(14, 14, hot); s.px(15, 14, hot); s.px(14, 15, hot)


def star(s, cx, cy, arm, cols):
    """A four-point star: centre cols[0], then cols[1], cols[2]... along each arm."""
    s.px(cx, cy, cols[0])
    for i in range(1, arm + 1):
        c = cols[min(i, len(cols) - 1)]
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            s.px(cx + dx * i, cy + dy * i, c)


def flash(s):
    c = 15.5
    for y in range(N):
        for x in range(N):
            d = math.hypot(x - c, y - c)
            if d <= 3.2:
                s.px(x, y, bone)
            elif d <= 6.2:
                s.px(x, y, hot)
            elif d <= 7.4:
                s.px(x, y, gold)
    # eight rays: the straight four 2 px thick and long, the diagonals 1 px and shorter
    def ray_col(r):
        return hot if r < 10 else (gold if r < 13 else glow)
    for r in range(7, 16):
        for w in (15, 16):
            for (x, y) in ((15 + r + 1, w), (15 - r, w), (w, 15 - r), (w, 15 + r + 1)):
                if 0 <= x < N and 0 <= y < N:
                    s.px(x, y, ray_col(r))
    for t in range(5, 11):
        for (x, y) in ((16 + t, 16 + t), (15 - t, 15 - t), (16 + t, 15 - t), (15 - t, 16 + t)):
            s.px(x, y, ray_col(t + 3))


def burst_ring(s):
    c = 15.5
    for i in range(8):
        a = i * math.pi / 4 + math.pi / 8
        x, y = round(c + 11 * math.cos(a)), round(c + 11 * math.sin(a))
        if i % 2:
            star(s, x, y, 1, [bone, gold])
        else:
            star(s, x, y, 2, [bone, hot, gold])
    star(s, 15, 15, 2, [bone, hot, gold])
    s.px(16, 16, hot)


def last_glint(s):
    star(s, 15, 15, 3, [bone, hot, gold, b1])
    for (x, y) in ((3, 4), (28, 6), (5, 27), (27, 26)):
        s.px(x, y, gold)


def build():
    s = new(N, N, 8)
    s.frame(1); sheet(s, 0, sweep=11, crease=(11 - A) / (B - A))
    s.frame(2); sheet(s, 0, sweep=25, crease=(25 - A) / (B - A))
    s.frame(3); sheet(s, 5)
    s.frame(4); sheet(s, 10)
    s.frame(5); sheet(s, 15); seams(s)
    s.frame(6); flash(s)
    s.frame(7); burst_ring(s)
    s.frame(8); last_glint(s)
    s.frame(1)
    return s
