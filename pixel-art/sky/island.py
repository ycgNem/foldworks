"""The island's body (docs/sky-island.md, the style test): the rim's edge into the sky, the south
cliff face, ore veins in it, the underside tapering in tiers, the rocky tip, the waterfalls and
their foam. Light from the top-left; the 3/4 view shows the south face only.

How the code puts them together (the mock does exactly this, see mock.py `Island`):
- isle_edge (16 frames by 4-bit mask, N=1 E=2 S=4 W=8 = land there) replaces the grass on every
  land tile that has sky on a side: an organic lip (2-4 px in from the tile's open side, pinned
  to 2 px at tile corners so neighbours meet), a grass0 outline, a lit grass3 lip on the sides
  that face the light (N, W) and a shaded grass1 lip on E. Open S has no inset: the cliff hangs
  from it.
- the cliff is drawn per PIXEL column under the island's south silhouette: for each world x, the
  lowest land pixel is the lip; the column of isle_cliff (top, then mid rows, then low) is copied
  from there down. So the cliff follows every rounded corner and step, and its strata bend with
  the lip. Its left and right ends get a 1 px ink outline (code), the left end lit, the right
  shaded (two pixels, code).
- isle_under hangs under the cliff, tile by tile, in tiers that step in toward the tip:
  fill, bottom (open below), left slope, right slope; the tip under the deepest tiles.
- waterfalls: isle_fall_top on a south edge tile (a spring and its channel through the lip),
  then isle_fall segments down the face and into the sky, then isle_fall_foam where they reach
  the cloud sea.

Run `python island.py` from this folder. Outputs to pixel-art/sky/out/.
"""
import math

from common import P, T, new, draw, put, rect, export, rng, hsh, vnoise, wnoise, scale, on_bg, sheet, get, OUT, rgb
from PIL import Image

import ground
from cliff import cliff, texture as cliff_texture, utexture, CW  # noqa: F401


# ---------------------------------------------------------------- the rim's edge (isle_edge)
def lip(seed, t):
    """Inset of an open side at position t (0..15): 2 at the tile corners, 2-4 inside."""
    bump = math.sin(math.pi * t / 15)
    # knots every 5 px, linearly interpolated: a lip that swells and dips, no one-pixel teeth
    k, f = divmod(t, 5)
    a, b = (hsh(seed, k) % 100) / 100, (hsh(seed, k + 1) % 100) / 100
    n = a + (b - a) * f / 5
    return 2 + int(round(bump * (0.4 + 1.8 * n)))


G0 = rgb(P["grass0"])


def edge(mask, v=0):
    N, E, S, W = mask & 1, mask & 2, mask & 4, mask & 8
    img = ground.grass(v)
    land = [[True] * 16 for _ in range(16)]
    seed = mask * 7 + v * 131
    R = 6   # corner radius
    for y in range(16):
        for x in range(16):
            ok = True
            if not N and y < lip(seed + 1, x):
                ok = False
            if not W and x < lip(seed + 2, y):
                ok = False
            if not E and x > 15 - lip(seed + 3, y):
                ok = False
            # rounded corners where two open sides meet
            for open_a, open_b, cx, cy in ((not N, not W, R, R), (not N, not E, 15 - R, R),
                                           (not S, not W, R, 15 - R), (not S, not E, 15 - R, 15 - R)):
                if open_a and open_b:
                    inx = (x < cx) if cx == R else (x > cx)
                    iny = (y < cy) if cy == R else (y > cy)
                    if inx and iny and math.hypot(x - cx, y - cy) > R - (0 if (cy != R) else 2) + 0.3:
                        ok = False
            land[y][x] = ok

    def L(x, y):
        if 0 <= x < 16 and 0 <= y < 16:
            return land[y][x]
        # beyond the tile: land where the mask says so
        if y < 0:
            return bool(N) and 0 <= x < 16
        if y > 15:
            return bool(S) and 0 <= x < 16
        if x < 0:
            return bool(W)
        return bool(E)

    px = img.load()
    for y in range(16):
        for x in range(16):
            if not land[y][x]:
                px[x, y] = (0, 0, 0, 0)
    for y in range(16):
        for x in range(16):
            if not land[y][x]:
                continue
            nb = {(dx, dy): L(x + dx, y + dy) for dx, dy in ((0, -1), (0, 1), (-1, 0), (1, 0))}
            if not all(nb.values()):
                put(img, x, y, P["grass0"])
    # the lips just inside the outline: lit facing N and W, shaded facing E
    for y in range(16):
        for x in range(16):
            if not land[y][x] or get(img, x, y)[:3] == G0:
                continue
            up = get(img, x, y - 1)[:3] == G0 if y > 0 else False
            lf = get(img, x - 1, y)[:3] == G0 if x > 0 else False
            rt = get(img, x + 1, y)[:3] == G0 if x < 15 else False
            if up or lf:
                put(img, x, y, P["grass3"])
            elif rt:
                put(img, x, y, P["grass1"])
    if not S:
        # the south lip rolls over towards the viewer: a lit row, then the cliff takes over
        for x in range(16):
            if land[15][x] and get(img, x, 15)[:3] != G0:
                put(img, x, 14, P["grass3"] if get(img, x, 14)[3] else P["grass3"])
                put(img, x, 15, P["grass1"])
        # keep the side outline down to the bottom row
        for x in range(16):
            for y in (14, 15):
                if land[y][x] and ((x > 0 and not land[y][x - 1]) or (x < 15 and not land[y][x + 1])):
                    put(img, x, y, P["grass0"])
    return img


# ---------------------------------------------------------------- the cliff (isle_cliff)
# A strip 16 wide, rows top (lip/overhang), mid, low; 4 variants each, every boundary pinned at
# the tile edges so any variant sits beside any other and mid repeats downwards.
def wob(seed, x, amp):
    """A wobble pinned to 0 at x = 0 and x = 16."""
    return int(round(amp * math.sin(math.pi * x / 16) * ((hsh(seed) % 3) - 1)))


def cliff_v1(row, v):
    """The first try (strata as stripes and ruled cracks: read as a layer cake). Kept for the
    record; cliff.py replaces it."""
    img = new(T, T)
    r = rng(900 + v * 10 + {"top": 0, "mid": 1, "low": 2}[row])
    s = 900 + v * 17
    if row == "top":
        for x in range(16):
            # the grass overhang: one rolled row, then tufts hanging 1-4 px
            drip = 1 + (hsh(s, x) % 3 if (x + v) % 5 else 3)
            put(img, x, 0, P["grass1"])
            for y in range(1, 1 + drip):
                put(img, x, y, P["grass0"] if y < drip else P["grass1"] if (x + y + v) % 4 == 0 else P["grass0"])
            # under the overhang: topsoil in shadow
            for y in range(1 + drip, 5):
                put(img, x, y, P["wood1"])
            # topsoil, warm, lit at its top, a darker band near the bottom
            band = 11 + wob(s + 1, x, 1)
            for y in range(5, 16):
                c = P["wood3"]
                if y == 5:
                    c = P["wood2"]
                elif y in (6,) and (x + v) % 3:
                    c = P["wood4"]
                elif y == band:
                    c = P["wood2"]
                elif y > band:
                    c = P["earth3"] if y < 15 else P["earth2"]
                put(img, x, y, c)
        # roots hanging from the overhang
        for k in range(2):
            rx = (3 + v * 5 + k * 7) % 14 + 1
            ln = r.randint(3, 6)
            xx = rx
            for y in range(4, 4 + ln):
                put(img, xx, y, P["wood0"] if y < 4 + ln - 1 else P["wood1"])
                if r.random() < 0.3:
                    xx += r.choice((-1, 1))
                    xx = max(0, min(15, xx))
        # pebbles in the topsoil
        for _ in range(2):
            x, y = r.randrange(1, 14), r.randrange(7, 10)
            draw(img, [(x, y), (x + 1, y)], P["earth3"])
            put(img, x, y - 1, P["wood4"])
            put(img, x + 1, y + 1, P["wood1"])
    elif row == "mid":
        # strata: a grey-brown layer, a warm layer, a grey-brown layer; boundaries wobble
        b1 = [4 + wob(s + 2, x, 1) for x in range(16)]
        b2 = [10 + wob(s + 3, x, 1) for x in range(16)]
        for x in range(16):
            for y in range(16):
                if y < b1[x]:
                    c = P["earth3"] if y > 0 else P["earth2"]
                elif y == b1[x]:
                    c = P["wood2"]
                elif y < b2[x]:
                    c = P["wood4"] if y == b1[x] + 1 and (x + v) % 4 else P["wood3"]
                elif y == b2[x]:
                    c = P["earth1"]
                else:
                    c = P["earth3"] if y == b2[x] + 1 else P["earth2"]
                put(img, x, y, c)
        # a vertical crack with a lit left edge (the face breaks into rough columns)
        cx = 4 + (v * 7) % 9
        for y in range(1, 15):
            xx = cx + (1 if y > 8 and v % 2 else 0)
            put(img, xx, y, P["earth1"] if y != b1[xx] else P["wood1"])
            if get(img, xx - 1, y)[3]:
                put(img, xx - 1, y, P["earth3"] if y > b2[xx] or y < b1[xx] else P["wood4"])
        # specks
        for _ in range(3):
            x, y = r.randrange(0, 16), r.randrange(0, 16)
            if y not in (b1[x], b2[x]):
                put(img, x, y, P["earth1"] if y < b1[x] or y > b2[x] else P["wood2"])
    else:  # low: darker rock that begins to turn under
        for x in range(16):
            for y in range(16):
                if y < 3:
                    c = P["earth2"]
                elif y < 11:
                    c = P["earth1"]
                elif y < 14:
                    c = P["earth0"]
                else:
                    c = P["ink2"]
                put(img, x, y, c)
            put(img, x, 2 + wob(s + 4, x, 1), P["earth1"])
        # lumps: rounded rocks with a lit top-left
        for k in range(3):
            lx, ly = (2 + v * 3 + k * 6) % 14, 4 + (k * 3 + v) % 5
            draw(img, [(lx, ly), (lx + 1, ly), (lx + 2, ly)], P["earth2"])
            put(img, lx, ly, P["earth3"])
            draw(img, [(lx, ly + 2), (lx + 1, ly + 2), (lx + 2, ly + 2), (lx + 3, ly + 1)], P["earth0"])
        cx = 6 + (v * 5) % 7
        for y in range(4, 15):
            put(img, cx + (y > 9), y, P["ink2"] if y > 11 else P["earth0"])
    return img


# ---------------------------------------------------------------- ore veins on the cliff
def vein(ore, v):
    """16x16 overlays for a cliff mid tile: the island's ores showing in its face."""
    img = new(T, T)
    r = rng(1200 + v + {"iron": 0, "copper": 10, "coal": 20, "sand": 30}[ore])
    cx, cy = 5 + (v * 3) % 6, 5 + (v * 5) % 6
    if ore == "coal":
        # a black seam band across the tile, glints of sheen
        for x in range(16):
            y0 = 6 + wob(1300 + v, x, 1)
            for y in range(y0, y0 + 3 + (x + v) % 2):
                put(img, x, y, P["ink1"])
            put(img, x, y0 - 1, P["ink"])
            if (x + v) % 5 == 0:
                put(img, x, y0, P["steel2"])
        put(img, 3 + v * 3, 7, P["steel3"])
        return img
    if ore == "sand":
        for x in range(2, 14):
            h = 2 if 4 < x < 11 else 1
            for y in range(cy, cy + h):
                put(img, x, y, P["wood5"] if y == cy else P["brass2"])
        put(img, 7, cy, P["lamp3"])
        return img
    # iron and copper: a cluster of angular nodes set in the rock (diamond-ish facets, outlined
    # ink), lit top-left in the ore's own colours as on the deposits: iron rust facets over a dark
    # hematite body with a silver glint, copper verdigris over its dark green with a copper fleck
    tones = {"iron": (P["ink2"], P["copper0"], P["copper1"], P["copper2"]),
             "copper": (P["water1"], P["water2"], P["water3"], P["teal"])}[ore]
    cx, cy = 4 + (v * 3) % 5, 4 + (v * 5) % 5
    nodes = [(cx + 1, cy + 2, 3.2), (cx + 6, cy + 4, 2.2), (cx + 2, cy + 7, 1.8)] + ([(cx + 7, cy, 1.6)] if v % 2 else [])
    shape = {}
    for (lx, ly, rr) in nodes:
        for y in range(int(ly - rr) - 1, int(ly + rr) + 2):
            for x in range(int(lx - rr) - 1, int(lx + rr) + 2):
                dx, dy = x + 0.5 - lx, y + 0.5 - ly
                if abs(dx) * 0.9 + abs(dy) * 1.1 <= rr:          # a faceted (diamond) node
                    lev = -(dx * 0.6 + dy * 0.8) / rr                # towards the light
                    shape[(x, y)] = 3 if lev > 0.45 else 2 if lev > 0.0 else 1 if lev > -0.45 else 0
    for (x, y), lev in shape.items():
        put(img, x, y, tones[lev])
    for (x, y) in list(shape):
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            if (x + dx, y + dy) not in shape:
                put(img, x + dx, y + dy, P["ink"])
    put(img, cx, cy + 1, P["steel4"] if ore == "iron" else P["copper3"])
    if ore == "copper":
        put(img, cx + 6, cy + 3, P["copper2"])
        put(img, cx + 2, cy + 6, P["copper2"])
    else:
        put(img, cx + 5, cy + 3, P["lamp0"])
    return img


# ---------------------------------------------------------------- the underside (isle_under)
# Frames: fill x4, bottom x4 (open below), left slope x4 (open left and below: a 45 degree edge
# from the top-left corner to the bottom-right), right slope x4. Dark rock in shadow (it faces
# down), lit a little on the left, hanging roots and the odd teal crystal.
def under(kind, v):
    img = new(T, T)
    r = rng(1500 + v * 7 + ["fill", "bottom", "left", "right"].index(kind) * 100)
    nf = wnoise(1600, 4, 64)     # continuous across variants placed in order (x mod 4)

    def inside(x, y):
        if kind == "left":
            return x >= y - 1
        if kind == "right":
            return 15 - x >= y - 1
        if kind == "bottom":
            return y <= 11 + (hsh(1700 + v, x // 3) % 3)
        return True

    tex = utexture().crop((v * 16, 0, v * 16 + 16, 16))
    for y in range(16):
        for x in range(16):
            if inside(x, y):
                put(img, x, y, tex.getpixel((x, y)))
    # edges: outline outside of rock, the lit left edge, roots hanging off the bottom
    pts = []
    for y in range(16):
        for x in range(16):
            if inside(x, y):
                continue
            if any(0 <= x + dx < 16 and 0 <= y + dy < 16 and inside(x + dx, y + dy) for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))):
                pts.append((x, y))
    for x, y in pts:
        put(img, x, y, P["ink"])
    # bounce light from the bright cloud sea below: the rock's lowest pixel in each column
    for x in range(16):
        for y in range(15, -1, -1):
            if inside(x, y):
                if y < 15 and not inside(x, y + 1):
                    put(img, x, y, P["steel2"])
                    if inside(x, y - 1) and (x + v) % 3:
                        put(img, x, y - 1, P["steel1"])
                break
    if kind == "left":
        for y in range(16):
            x = max(0, y - 1)
            if inside(x, y):
                put(img, x, y, P["earth2"])
                if inside(x + 1, y):
                    put(img, x + 1, y, P["earth1"])
    if kind in ("bottom", "left", "right"):
        for k in range(2):
            rx = (3 + v * 5 + k * 6) % 13 + 1
            # find the bottom of the rock in this column
            yb = max((y for y in range(16) if inside(rx, y)), default=-1)
            if yb < 0 or yb > 14:
                continue
            ln = r.randint(2, 4)
            for y in range(yb + 1, min(16, yb + 1 + ln)):
                put(img, rx, y, P["wood1"] if y < yb + ln else P["moss3"])
    if v == 2 and kind == "bottom":
        # a teal crystal poking out
        draw(img, [(9, 8), (9, 9), (10, 9), (10, 10)], P["teal"])
        put(img, 9, 8, P["sky4"])
        draw(img, [(8, 10), (11, 11)], P["ink"])
    return img


def tip():
    """The rocky point under the island (48x32): the last of the rock tapering to a point, a lit
    left flank, a teal crystal and a root, a few pebbles falling."""
    W, H = 48, 32
    img = new(W, H)
    nf = vnoise(1900, 4)

    def half(y):
        # half-width at row y: 16 at the top (it hangs under the two deepest underside tiles), a lumpy taper to a point
        t = min(1.0, y / (H - 4))
        return max(0.0, 16.5 * (1 - t) ** 1.1 + (1.5 if 8 < y < 13 else 0) - (1 if 17 < y < 20 else 0))

    cx = 24
    for y in range(H):
        hw = half(y)
        for x in range(W):
            if abs(x + 0.5 - cx - (y / H) * 2) <= hw:
                n = nf(x, y)
                c = P["earth1"] if n > 0.6 else P["earth0"] if n > 0.25 else P["ink2"]
                put(img, x, y, c)
    # the lit left flank and the ink outline
    for y in range(H):
        row = [x for x in range(W) if get(img, x, y)[3]]
        if row:
            put(img, row[0], y, P["earth2"])
            if len(row) > 2:
                put(img, row[0] + 1, y, P["earth1"])
    out = new(W, H)
    a = img.load()
    for y in range(H):
        for x in range(W):
            if a[x, y][3]:
                continue
            if any(0 <= x + dx < W and 0 <= y + dy < H and a[x + dx, y + dy][3] for dx, dy in ((1, 0), (-1, 0), (0, 1))):
                put(out, x, y, P["ink"])
    out.alpha_composite(img)
    img = out
    # a seam, a crystal, a root
    for x in range(8, 40):
        y = 7 + int(math.sin(x / 5) * 1.2)
        if get(img, x, y)[3] and get(img, x, y)[:3] != rgb(P["ink"]):
            put(img, x, y, P["ink1"])
    draw(img, [(29, 12), (29, 13), (30, 13), (30, 14), (31, 14), (30, 15)], P["teal"])
    draw(img, [(29, 12), (30, 13)], P["sky4"])
    draw(img, [(28, 14), (31, 15), (29, 16)], P["ink"])
    draw(img, [(12, 9), (12, 10), (11, 11), (11, 12)], P["wood1"])
    put(img, 11, 13, P["moss3"])
    # two pebbles falling off the point
    draw(img, [(26, 29), (27, 29)], P["earth1"])
    put(img, 26, 28, P["ink"])
    put(img, 23, 31, P["earth0"])
    return img


# ---------------------------------------------------------------- waterfalls
FALL_W = 10   # the water column, centred in the 16 px segment (x 3..12)


def fall(f):
    """A 16x32 segment that tiles downwards; 4 frames, the streaks move 8 px a frame so the loop
    is seamless (32 / 4). Body sky2 with sky3 and cloud2 streaks, a white lit left edge, a deep
    iron1 right edge, a thin spray line outside each edge."""
    img = new(16, 32)
    x0, x1 = 3, 12
    for y in range(32):
        yy = (y - 8 * f) % 32
        for x in range(x0, x1 + 1):
            # streak pattern per column (fixed), scrolled down
            k = x - x0
            ph = (hsh(2100, k) % 32)
            ln = 5 + hsh(2101, k) % 7
            on = (yy + ph) % 32 < ln
            ph2 = (hsh(2102, k) % 32)
            on2 = (yy + ph2) % 32 < 3
            if x == x0:
                c = P["cloud3"] if (yy + 3) % 8 else P["cloud2"]
            elif x == x0 + 1:
                c = P["sky4"] if on else P["sky3"]
            elif x == x1:
                c = P["iron1"]
            elif x == x1 - 1:
                c = P["sky1"] if not on2 else P["sky2"]
            else:
                c = P["sky3"] if on else P["cloud2"] if on2 else P["sky2"]
            put(img, x, y, c)
        # spray: a dot outside each edge every few px, moving with the water
        if (yy * 3 + 1) % 11 == 0:
            put(img, x0 - 1, y, P["cloud2"])
        if (yy * 5 + 2) % 13 == 0:
            put(img, x1 + 1, y, P["sky3"])
    return img


def fall_top(f):
    """16x16 on a south edge tile: a spring bubbling from a mossy stone, its channel through the
    grass to the lip and the water pouring over (the segment below starts at the cliff's top)."""
    img = edge(1 | 2 | 8, 1)     # a south edge tile (land N, E, W), its lip kept beside the channel
    # the spring stone (top-left), its pool, the channel down to the lip
    # a small round pool under the stone, a channel 6 px wide widening to the fall's 10 at the lip
    pool = [(x, y) for y in range(2, 8) for x in range(5, 12) if ((x - 8.5) / 3.4) ** 2 + ((y - 4.8) / 2.4) ** 2 <= 1]
    chan = [(x, y) for y in range(6, 16) for x in range(6 - max(0, y - 11), 12 + max(0, y - 11)) if 3 <= x <= 12]
    for x, y in pool + chan:
        put(img, x, y, P["sky1"])
    # banks: grass0 outline round the water
    water = set(pool + chan)
    for x, y in list(water):
        for dx, dy in ((1, 0), (-1, 0), (0, -1)):
            q = (x + dx, y + dy)
            if q not in water and 0 <= q[0] < 16 and 0 <= q[1] < 16:
                put(img, q[0], q[1], P["grass0"])
    # the stone the spring comes out of
    draw(img, [(5, 1), (6, 1), (7, 1), (4, 2), (5, 2), (6, 2), (7, 2), (8, 2)], P["steel3"])
    draw(img, [(5, 1), (4, 2)], P["steel4"])
    draw(img, [(4, 3), (5, 3), (6, 3), (7, 3), (8, 3)], P["steel1"])
    draw(img, [(3, 2), (4, 1), (5, 0), (6, 0), (7, 0), (8, 1), (9, 2), (9, 3)], P["ink"])
    put(img, 7, 1, P["moss4"])
    # flow lines in the channel, moving down; ripples in the pool
    for y in range(4, 16):
        for x in range(4, 12):
            if (x, y) in water:
                ph = (y - 2 * f + x * 5) % 8
                if ph == 0:
                    put(img, x, y, P["sky3"])
                elif ph == 1 and x % 2:
                    put(img, x, y, P["sky2"])
    put(img, 9 + (f % 2), 4, P["cloud3"])
    put(img, 7, 5 - (f % 2), P["sky4"])
    # the lip: the water rolls over the edge (lit row), a dark shade on the right bank
    for x in range(4, 12):
        put(img, x, 15, P["cloud3"] if (x + f) % 3 else P["sky4"])
        put(img, x, 14, P["sky3"] if (x + f) % 2 else P["sky2"])
    put(img, 12, 15, P["iron1"])
    put(img, 3, 15, P["cloud2"])
    return img


def fall_head(f):
    """16x16, the first segment under the lip: the sheet of water still bowed out, wider, a lip
    of foam where it leaves the edge. Drawn over the cliff's top tile."""
    seg = fall(f)
    img = new(16, 16)
    img.alpha_composite(seg.crop((0, 0, 16, 16)))
    for x in range(3, 13):
        put(img, x, 0, P["cloud3"] if (x + f) % 3 else P["sky4"])
        put(img, x, 1, P["sky4"] if (x + f) % 2 else P["cloud2"])
    put(img, 2, 1, P["cloud2"])
    put(img, 13, 1, P["sky3"])
    return img


def foam(f):
    """32x16, where a fall meets the cloud sea: churning puffs, lit tops, a spray cap. 4 frames,
    the puffs breathe and a pair of droplets bounce."""
    img = new(32, 16)
    puffs = [(9, 10, 5), (16, 8, 6), (23, 10, 5), (13, 12, 4), (20, 12, 4)]
    for i, (cx, cy, r0) in enumerate(puffs):
        rr = r0 + (1 if (f + i) % 4 in (1, 2) else 0) - (1 if (f + i) % 4 == 3 else 0)
        for y in range(16):
            for x in range(32):
                d = math.hypot(x - cx, (y - cy) * 1.2)
                if d <= rr:
                    lit = (x - cx) * 0.6 + (y - cy) < -rr * 0.3
                    shade = (y - cy) > rr * 0.5
                    c = P["cloud3"] if lit else P["cloud1"] if shade else P["cloud2"]
                    if get(img, x, y)[3] and get(img, x, y)[:3] == (255, 255, 255) and not lit:
                        continue
                    put(img, x, y, c)
    # (the fall itself runs on down behind the puffs: the code draws it to the sea's top)
    # droplets
    for i, (dx, dy) in enumerate(((5, 3), (27, 4))):
        yy = dy + [0, -1, -2, -1][(f + i * 2) % 4]
        put(img, dx, yy, P["cloud3"])
        put(img, dx, yy + 1, P["sky3"])
    return img


# ---------------------------------------------------------------- build
def build():
    edges = [edge(m) for m in range(16)]
    export("isle_edge", edges, bg=P["sky2"])
    rows = [cliff(r, v) for r in ("top", "mid", "low") for v in range(4)]
    export("isle_cliff", rows, extra={"rows": ["top", "mid", "low"], "variants": 4})
    vnames, veins = [], []
    for ore in ("iron", "copper", "coal", "sand"):
        for v in range(4):
            vnames.append(f"{ore}{v}")
            veins.append(vein(ore, v))
    export("isle_vein", veins, extra={"names": vnames}, bg=P["earth2"])
    unders = [under(k, v) for k in ("fill", "bottom", "left", "right") for v in range(4)]
    export("isle_under", unders, extra={"kinds": ["fill", "bottom", "left", "right"], "variants": 4})
    export("isle_tip", [tip()], anchor=(24, 0))
    export("isle_fall", [fall(f) for f in range(4)], fps=8)
    export("isle_fall_top", [fall_top(f) for f in range(4)], fps=8)
    export("isle_fall_head", [fall_head(f) for f in range(4)], fps=8)
    export("isle_fall_foam", [foam(f) for f in range(4)], fps=8, bg=P["cloud1"])
    # a look sheet: a little island strip 6 tiles wide, edge over cliff over under, a waterfall
    W, H = 8 * 16, 9 * 16
    out = Image.new("RGBA", (W, H), (0x76, 0xaa, 0xec, 255))
    # row 0: north edge (S and E/W land), row 1: interior, row 2: south edge, then the face
    for x in range(8):
        m = (1 if 1 else 0)
        mN = 2 | 4 | 8
        if x == 0:
            mN, mM, mS = 2 | 4, 1 | 2 | 4, 1 | 2
        elif x == 7:
            mN, mM, mS = 4 | 8, 1 | 4 | 8, 1 | 8
        else:
            mM, mS = 15, 1 | 2 | 8
        out.alpha_composite(edges[mN], (x * 16, 0))
        out.alpha_composite(edges[mM] if mM != 15 else ground.grass(x % 4), (x * 16, 16))
        out.alpha_composite(edges[mS], (x * 16, 32))
        out.alpha_composite(rows[x % 4], (x * 16, 48))
        out.alpha_composite(rows[4 + x % 4], (x * 16, 64))
        out.alpha_composite(rows[8 + x % 4], (x * 16, 80))
    out.alpha_composite(fall_top(0), (3 * 16, 32))
    out.alpha_composite(fall_head(0), (3 * 16, 48))
    for k in range(3):
        out.alpha_composite(fall(0), (3 * 16, 64 + k * 32))
    out.alpha_composite(veins[1], (5 * 16, 64))
    for x in range(1, 7):
        kind = 1 if 2 <= x <= 5 else (2 if x == 1 else 3)
        out.alpha_composite(unders[kind * 4 + x % 4], (x * 16, 96))
    out.alpha_composite(tip(), (40, 112))
    out.save(OUT / "island_look.png")
    scale(out, 5).save(OUT / "island_look@5x.png")


if __name__ == "__main__":
    build()
