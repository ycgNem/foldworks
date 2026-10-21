"""The island's south face (isle_cliff), drawn as one texture 64 px wide (the 4 variants side
by side, periodic in x: the code picks variant = world tile x mod 4, so the face never seams) and
three rows tall: top (the lip: a scalloped turf overhang, topsoil, roots), mid (repeats downwards:
two courses of chunky rounded blocks) and low (one darker course turning under). Light from the
top-left: every block lit on its top and left, shaded on its bottom and right, dark gaps; warm
(wood) and grey-brown (earth) stone mixed, so the face reads as strata without stripes.
"""
import math

from common import P, new, draw, put, get, rng, hsh, vnoise, rgb

CW = 64


def _blocks(seed, y0, h, widths, warm):
    """A course of blocks from y0, h tall, across the 64 px period (wrapping)."""
    out = []
    r = rng(seed)
    start = r.randrange(0, 8)
    x = start
    while x < start + CW:
        w = r.choice(widths)
        if x + w > start + CW - 4:
            w = start + CW - x
        dy = r.choice((0, 0, 1))
        out.append((x, y0 + dy, w, h - dy, warm if r.random() < 0.75 else not warm, r.random()))
        x += w
    return out


def cliff_texture():
    W, H = CW, 48
    img = new(W, H)
    r = rng(950)
    # --- top: topsoil, then the turf overhang over it
    soil = vnoise(951, 5)
    for x in range(W):
        for y in range(16):
            n = soil(x, y) if x < W - 5 else soil(x - W, y)   # crude wrap: the last 5 columns borrow from the start
            c = P["wood3"] if n > 0.35 else P["wood2"]
            if y >= 13 + (hsh(952, (x // 4) % 16) % 2):
                c = P["earth2"]
            put(img, x, y, c)
    for _ in range(10):                          # pebbles in the soil
        x, y = r.randrange(0, W - 1), r.randrange(8, 12)
        draw(img, [(x, y), (x + 1, y)], P["earth3"])
        put(img, x, y - 1, P["wood4"])
        put(img, x + 1, y + 1, P["wood1"])
    x, lobes = 0, []
    while x < W:
        w = r.choice((5, 6, 7, 8))
        if x + w > W - 4:
            w = W - x
        lobes.append((x, w, r.choice((3, 4, 5, 5, 6))))
        x += w
    for (lx, w, dep) in lobes:
        for i in range(w):
            xx = (lx + i) % W
            t = (i + 0.5) / w
            d = int(round(dep * math.sqrt(max(0.0, 1 - (2 * t - 1) ** 2)))) + 1
            for y in range(d + 1):
                c = P["grass2"] if y == 0 else P["grass1"]
                if y == d:
                    c = P["grass0"]
                put(img, xx, y, c)
            put(img, xx, d + 1, P["wood1"])          # the turf's shadow on the soil
            if d + 2 < 8:
                put(img, xx, d + 2, P["wood2"])
        put(img, (lx + 1) % W, 0, P["grass3"])
        put(img, (lx + 2) % W, 1, P["grass2"])
    for k in range(7):                           # roots hanging out of the soil
        xx = (k * 9 + r.randrange(0, 5)) % W
        ln = r.randint(4, 9)
        for j in range(ln):
            put(img, xx % W, 5 + j, P["wood0"] if j < ln - 1 else P["wood1"])
            if r.random() < 0.25:
                xx += r.choice((-1, 1))
    # --- mid and low: rock cells (periodic Voronoi), see rocks() below
    rocks(img)
    return img
    courses = [
        (16, 8, (6, 8, 9, 11, 13), True, 960),
        (24, 8, (7, 9, 10, 12, 14), False, 961),
        (32, 9, (8, 10, 12, 14), False, 962),
    ]
    tones = {True: (P["wood4"], P["wood3"], P["wood2"], P["wood1"]),
             False: (P["earth3"], P["earth2"], P["earth1"], P["earth0"])}
    for (y0, h, widths, warm, seed) in courses:
        for (bx, by, bw, bh, wm, q) in _blocks(seed, y0, h, widths, warm):
            lit, body, shade, gap = tones[wm]
            if y0 >= 32:
                lit, body, shade, gap = P["earth2"], P["earth1"], P["earth0"], P["ink2"]
            # the gap row above the block (the course line) fills the dy step too
            for i in range(bw):
                for yy in range(y0, by):
                    put(img, (bx + i) % W, yy, gap)
            for i in range(bw):
                for j in range(bh):
                    xx, yy = (bx + i) % W, by + j
                    if yy >= y0 + h:
                        continue
                    el, er, et, eb = i == 0, i == bw - 1, j == 0, j == bh - 1
                    corner = (el or er) and (et or eb)
                    if er or eb or corner or (et and y0 > 16):
                        c = gap
                    elif et:
                        c = shade
                    elif j == 1 or (i == 1 and j < bh - 2):
                        c = lit
                    elif j == bh - 2 or i == bw - 2:
                        c = shade
                    else:
                        c = body
                    put(img, xx, yy, c)
            if bw >= 11 and q < 0.6:                 # a crack across a wide block
                cx = bx + bw // 2 + (1 if q < 0.3 else -1)
                for j in range(2, bh - 2):
                    put(img, (cx + (j > bh // 2)) % W, by + j, shade)
            if q > 0.8 and y0 < 32:                  # moss on the odd block top
                for i in range(2, min(bw - 2, 5)):
                    put(img, (bx + i) % W, by + 1, P["grass1"])
                put(img, (bx + 2) % W, by + 1, P["grass2"])
    # --- the low course turns under: its last rows darken into the underside
    e1 = rgb(P["earth1"])
    for x in range(W):
        for y in range(43, 48):
            if y >= 45:
                put(img, x, y, P["ink2"] if (x * 3 + y) % 7 else P["earth0"])
            elif get(img, x, y)[:3] == e1:
                put(img, x, y, P["earth0"])
    return img


def _cells(seed, n, h, wrap_y):
    r = rng(seed)
    pts = []
    for i in range(n):
        # stratified in x so cells are evenly spread, jittered
        x = (i + r.uniform(0.15, 0.85)) * CW / n
        y = r.uniform(1, h - 1)
        pts.append((x, y, r.random()))
    return pts


def _voronoi(pts, h, wrap_y, sx=0.55):
    """Per pixel (cell index, d2 - d1) over a CW x h domain, periodic in x (and y if wrap_y)."""
    grid = {}
    for y in range(h):
        for x in range(CW):
            best = []
            for i, (px, py, _) in enumerate(pts):
                for ox in (-CW, 0, CW):
                    for oy in ((-h, 0, h) if wrap_y else (0,)):
                        dx, dy = (x + 0.5 - px - ox) * sx, (y + 0.5 - py - oy)
                        best.append((dx * dx + dy * dy, i))
            best.sort()
            d1, i1 = best[0]
            d2 = next(d for d, i in best if i != i1)
            grid[(x, y)] = (i1, math.sqrt(d2) - math.sqrt(d1))
    return grid


def _shade_cells(img, y0, grid, pts, h, wrap_y, tones, gapw=0.55):
    def cell(x, y):
        if wrap_y:
            return grid[(x % CW, y % h)][0]
        if 0 <= y < h:
            return grid[(x % CW, y)][0]
        return -1

    # each cell's extent, measured in unwrapped coordinates around its seed point
    ext = {}
    for (x, y), (i, _) in grid.items():
        px, py, _ = pts[i]
        dx = (x + 0.5 - px + CW / 2) % CW - CW / 2
        dy = y + 0.5 - py
        if wrap_y:
            dy = (dy + h / 2) % h - h / 2
        e = ext.setdefault(i, [0, 0, 0, 0, 0, 0])
        e[0] += dx
        e[1] += dy
        e[2] += 1
        e[3] = max(e[3], abs(dx))
        e[4] = max(e[4], abs(dy))
    for y in range(h):
        for x in range(CW):
            i, gap = grid[(x, y)]
            lit, body, shade, dark = tones(pts[i][2], y)
            if gap < gapw:
                c = dark
            else:
                px, py, _ = pts[i]
                e = ext[i]
                cx, cy = e[0] / e[2], e[1] / e[2]
                dx = (x + 0.5 - px + CW / 2) % CW - CW / 2 - cx
                dy = y + 0.5 - py - cy
                if wrap_y:
                    dy = (dy + h / 2) % h - h / 2
                # a pillowy rock face: lit towards the top-left, shaded towards the bottom-right
                v = -(dx / max(2.0, e[3]) * 0.55 + dy / max(2.0, e[4]) * 0.85)
                dn, rt = cell(x, y + 1) != i, cell(x + 1, y) != i
                up, lf = cell(x, y - 1) != i, cell(x - 1, y) != i
                if dn or (rt and v < 0.2):
                    c = shade
                elif up or lf or v > 0.55:
                    c = lit
                elif v < -0.45:
                    c = shade
                else:
                    c = body
            put(img, x, y0 + y, c)


def rocks(img):
    warm = (P["wood4"], P["wood3"], P["wood2"], P["wood1"])
    grey = (P["earth3"], P["earth2"], P["earth1"], P["earth0"])
    dark = (P["earth2"], P["earth1"], P["earth0"], P["ink2"])

    def mid_tones(q, y):
        return warm if q < 0.45 else grey

    def low_tones(q, y):
        return grey if q < 0.3 else dark

    mp = _cells(960, 11, 16, True)
    _shade_cells(img, 16, _voronoi(mp, 16, True), mp, 16, True, mid_tones)
    lp = _cells(961, 8, 13, False)
    _shade_cells(img, 32, _voronoi(lp, 13, False), lp, 13, False, low_tones)
    # moss on a few lit cell tops in the mid row, a crack or two
    r = rng(963)
    for _ in range(4):
        x = r.randrange(0, CW)
        for y in range(16, 32):
            if get(img, x, y)[:3] in (rgb(P["wood4"]), rgb(P["earth3"])):
                draw(img, [(x, y), ((x + 1) % CW, y)], P["grass1"])
                put(img, (x + 2) % CW, y, P["grass2"])
                break
    # the low course turns under: its last rows darken into the underside
    for x in range(CW):
        for y in range(45, 48):
            put(img, x, y, P["ink2"] if (x * 3 + y) % 7 else P["earth0"])
        if get(img, x, 44)[:3] == rgb(P["earth1"]):
            put(img, x, 44, P["earth0"])


def under_texture():
    """The underside's rock, 64x16, periodic in x and y (fill tiles repeat any way): the same
    pillowy cells as the face, smaller and in the shadow ramp (earth1 lit, earth0, ink2, ink1
    gaps), since the underside faces down and away from the sun."""
    img = new(CW, 16)
    # two tones of cell, so the underside reads as rocks, not one dark mass: the paler (earth2
    # lit) about half of them
    pale = (P["earth2"], P["earth1"], P["earth0"], P["ink2"])
    shadow = (P["earth1"], P["earth0"], P["ink2"], P["ink1"])
    pts = _cells(970, 12, 16, True)

    def tones(q, y):
        return pale if q < 0.45 else shadow
    _shade_cells(img, 0, _voronoi(pts, 16, True, sx=0.7), pts, 16, True, tones)
    return img


_UTEX = None


def utexture():
    global _UTEX
    if _UTEX is None:
        _UTEX = under_texture()
    return _UTEX


_TEX = None


def texture():
    global _TEX
    if _TEX is None:
        _TEX = cliff_texture()
    return _TEX


def cliff(row, v):
    y0 = {"top": 0, "mid": 16, "low": 32}[row]
    return texture().crop((v * 16, y0, v * 16 + 16, y0 + 16))
