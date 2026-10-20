"""town_boardwalk: 16x16 boardwalk-over-water tiles (fps 0, named variants).

The deck is a 6 px wide plank band (rows 5-10 across a horizontal tile, columns 5-10 down a
vertical one) that runs to the tile edge on every connected side, so tiles join seamlessly.
Wherever the deck's bottom edge is open to the water, a 1 px front face (ground0) and pilings
below it show; the lit rim (ground2) is on the deck's top and left edges, the shade (ground0)
on its right. Planks run across the direction of travel, seams every 4 px (period 16).

Names: h, v; corner_ws (from the west, turning south), end_e (comes from the west, ends at the
east with a mooring post); then the other corners and ends for free turns: corner_es, corner_wn,
corner_en, end_w, end_n, end_s; tee_s (W+E+S), tee_n (W+E+N) and cross (all four).
"""
from common_town import new, ripple, INK, SH, G0, G1, G2, B1, I0, T0, H1, H2

ORDER = ["h", "v", "corner_ws", "end_e", "corner_es", "corner_wn", "corner_en",
         "end_w", "end_n", "end_s", "tee_s", "tee_n", "cross"]
ARMS = {
    "h": "we", "v": "ns", "corner_ws": "ws", "end_e": "w", "corner_es": "es", "corner_wn": "wn",
    "corner_en": "en", "end_w": "e", "end_n": "s", "end_s": "n", "tee_s": "wes", "tee_n": "wen", "cross": "nswe",
}
A0, A1 = 5, 10  # the band's first and last pixel across the tile


def mask(arms):
    m = set()
    for y in range(A0, A1 + 1):
        for x in range(A0, A1 + 1):
            m.add((x, y))
    for a in arms:
        for t in range(0, 16):
            for k in range(A0, A1 + 1):
                if a == "w" and t < A0:
                    m.add((t, k))
                if a == "e" and t > A1:
                    m.add((t, k))
                if a == "n" and t < A0:
                    m.add((k, t))
                if a == "s" and t > A1:
                    m.add((k, t))
    return m


def inside(m, x, y, arms):
    """Deck membership with the tile edges continued along connected arms."""
    if (x, y) in m:
        return True
    if x < 0 and "w" in arms and A0 <= y <= A1:
        return True
    if x > 15 and "e" in arms and A0 <= y <= A1:
        return True
    if y < 0 and "n" in arms and A0 <= x <= A1:
        return True
    if y > 15 and "s" in arms and A0 <= x <= A1:
        return True
    return False


def draw(s, name):
    arms = ARMS[name]
    m = mask(arms)
    vertical_band = lambda x, y: A0 <= x <= A1 and ((y < A0 and "n" in arms) or (y > A1 and "s" in arms))
    # front face under open bottom edges, then the outline ring
    face = {(x, y + 1) for (x, y) in m if not inside(m, x, y + 1, arms) and y + 1 <= 15}
    solid = m | face
    for (x, y) in m:
        horiz = not vertical_band(x, y)
        if name in ("v", "end_n", "end_s"):
            horiz = False
        col = G1
        if horiz and x % 4 == 3:
            col = G0
        if not horiz and y % 4 == 3:
            col = G0
        if not inside(m, x - 1, y, arms) or not inside(m, x, y - 1, arms):
            col = G2
        elif not inside(m, x + 1, y, arms):
            col = G0
        s.px(x, y, col)
    for (x, y) in face:
        s.px(x, y, G0 if (x % 4) != 1 else SH)
        if y + 1 <= 15 and (x, y + 1) not in solid:
            pass
    # outline: the ink ring round deck+face, inside the tile only (open arms run off the edge)
    for y in range(16):
        for x in range(16):
            if (x, y) in solid:
                continue
            if any((x + dx, y + dy) in solid for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))):
                s.px(x, y, INK)
    # pilings under exposed faces: one under each 8 px of open front
    xs = sorted({x for (x, y) in face})
    piles = []
    for (x, y) in sorted(face):
        if x % 8 == 2 and y + 3 <= 15 and (x + 1, y) in face:
            piles.append((x, y))
    for (x, y) in piles:
        for yy in range(y + 1, min(y + 3, 15)):
            s.px(x, yy, G1)
            s.px(x + 1, yy, G0)
            s.px(x - 1, yy, INK)
            s.px(x + 2, yy, INK)
        if y + 3 <= 15:
            s.px(x, y + 3, INK)
            s.px(x + 1, y + 3, INK)
        if y + 4 <= 15:
            ripple(s, x, y + 4)
    # vertical runs: a piling top either side of the band, where the water is free
    if "n" in arms or "s" in arms:
        for (cx, cy) in ((A0 - 3, 11), (A1 + 3, 1)):
            free = all((cx + dx, cy + dy) not in solid and s.get(cx + dx, cy + dy) is None
                       for dx in (-1, 0, 1) for dy in (-1, 0, 1, 2))
            if free:
                post(s, cx, cy, 2)
    # the end's mooring post with a brass cap, on the outer corner of the dead end
    if name.startswith("end_"):
        side = name[4]
        cx, cy = {"e": (A1, A0 - 2), "w": (A0, A0 - 2), "n": (A1, A0 - 2), "s": (A1, A1 - 2)}[side]
        post(s, cx, cy, 3, cap=True)


def post(s, cx, cy, h, cap=False):
    """A 1 px piling top standing at (cx, cy) h px tall, ink round it, a ripple at its foot."""
    for dy in range(-1, h + 1):
        for dx in (-1, 1):
            s.px(cx + dx, cy + dy, INK)
    s.px(cx, cy - 1, INK)
    s.px(cx, cy, B1 if cap else G2)
    for dy in range(1, h):
        s.px(cx, cy + dy, G1 if dy == 1 and cap else G0)
    if not cap:
        s.px(cx, cy + h, SH)
        s.px(cx - 1, cy + h, I0)
        s.px(cx + 1, cy + h, I0)
    else:
        s.px(cx, cy + h, INK)


def build():
    s = new(16, 16, len(ORDER))
    for i, name in enumerate(ORDER):
        s.frame(i + 1)
        draw(s, name)
    s.frame(1)
    return s
