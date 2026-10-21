"""Ribbons and bookmarks in the five role colours (moss, copper, teal, violet, brass).

h180_ribbon: 15 frames of 8x14, per colour [left forked end, middle tile, right forked end].
  The band is rows 0-11 (ink edge, a lit row, eight body rows, a shade row, ink edge); the forked
  ends hang 2 px lower, behind the band, darker, joined to it by a lit fold. The middle tile is
  plain so a title sits on it; it tiles horizontally.
h180_bookmark: 5 frames of 10x16, hanging bookmarks (menu tabs): a flat top (it tucks under the
  page edge), a lit left column, an 8x8 plain field for an icon (x 1-8, y 3-10), a forked tail."""
from kit import Px, export

INK = "ink"
# dark -> light, four steps each
RAMPS = {
    "moss": ["moss1", "moss2", "moss3", "moss4"],
    "copper": ["copper0", "copper1", "copper2", "copper3"],
    "teal": ["water2", "water3", "water4", "teal"],
    "violet": ["ink2", "slag0", "slag1", "violet"],
    "brass": ["brass0", "brass1", "brass2", "brass3"],
}
ORDER = ["moss", "copper", "teal", "violet", "brass"]
W, H = 8, 14


def band(c, x0, x1, r):
    D, S, M, L = r
    c.hl(x0, x1, 0, INK)
    c.hl(x0, x1, 1, L)
    c.rect(x0, 2, x1, 9, M)
    c.hl(x0, x1, 10, S)
    c.hl(x0, x1, 11, INK)


def middle(r):
    c = Px(W, H)
    band(c, 0, 7, r)
    return c


def left_end(r):
    D, S, M, L = r
    c = Px(W, H)
    # the tail, behind and 2 px lower: rows 2-13, x 0-5, its fork bitten in from the left
    depth = {6: 1, 7: 2, 8: 2, 9: 1}
    for y in range(3, 13):
        x0 = 1 + depth.get(y, 0)
        c.hl(x0, 5, y, S)
    c.hl(1, 5, 3, M)            # its lit top
    c.hl(1, 5, 12, D)           # and its dark underside
    c.outline(INK)
    # the band's end: rows 0-11 at x 5-7, its own left edge at x 5
    band(c, 5, 7, r)
    c.vl(5, 0, 11, INK)
    c.p(5, 0, None)
    # the fold where the band turns under into the tail: a dark wedge with one lit pixel
    c.p(6, 12, D)
    c.p(7, 12, D)
    c.p(7, 13, INK)
    c.p(6, 13, INK)
    c.p(5, 12, L)
    return c


def ribbon_frames():
    out = []
    for k in ORDER:
        r = [RAMPS[k][0], RAMPS[k][1], RAMPS[k][2], RAMPS[k][3]] if k != "violet" else \
            ["slag0", "slag1", "violet", "violet"]
        le = left_end(r)
        out += [le, middle(r), le.flip()]
    return out


def bookmark(r):
    D, S, M, L = r
    c = Px(10, 16)
    tail = {11: (4, 5), 12: (3, 6), 13: (2, 7), 14: (1, 8)}   # the fork's bite, widening down
    for y in range(0, 15):
        for x in range(1, 9):
            if y in tail and tail[y][0] <= x <= tail[y][1]:
                continue
            c.p(x, y, M)
    c.vl(1, 0, 13, L)
    c.vl(8, 0, 13, S)
    for y, (a, b) in tail.items():
        if a - 1 >= 1:
            c.p(a - 1, y, S)
    c.hl(1, 8, 0, D)            # the shadow of the page edge it hangs from
    # outline the sides and the fork, not the top (it tucks under the page)
    pts = []
    for y in range(1, 16):
        for x in range(10):
            if c.on(x, y):
                continue
            if any(c.on(x + dx, y + dy) for dx, dy in ((-1, 0), (1, 0), (0, -1), (0, 1))):
                pts.append((x, y))
    for x, y in pts:
        c.p(x, y, INK)
    c.vl(0, 0, 0, INK)
    c.vl(9, 0, 0, INK)
    return c


def build():
    export("h180_ribbon", ribbon_frames(), extra={
        "order": [f"{k}:{p}" for k in ORDER for p in ("left", "middle", "right")],
        "band": [0, 11], "note": "the band is rows 0-11; the ends hang 2 px lower"})
    export("h180_bookmark", [bookmark(RAMPS[k]) for k in ORDER], extra={"order": ORDER, "icon": [1, 3, 8, 8]})


if __name__ == "__main__":
    build()
