"""Mock scenes of the islands from the real sprites, put together the way src/render/island.ts and
ground.ts bake the Home island (a port of their rules: monotone coasts, edge tiles by mask, the
cliff strip sampled per pixel column under the top surface's silhouette, the underside tapering
to the tip, one ink outline, waterfalls, props by hash, then the plot's chunks as paving or meadow
with their edges, seams and plot lines, ore outcrops with their spill).

Each island resolves every sheet through the variant rule (isletools.vname), falling back to
Home's, exactly as the renderer is meant to. `python islandmock.py` writes
out/mock_isles@1x.png (Home and the four islands side by side at 1x), out/mock_<world>@2x.png and
out/mock_<world>_plot@3x.png (a crop of the plot and the lip at 3x).
"""
import json
import math
from pathlib import Path

from PIL import Image

from c4 import OUT, P, SRC_ART, new, rgb, scale
from isletools import vname

T = 16
RIM = {"n": 6, "s": 3, "w": 4, "e": 4}
CLIFF = 4
DEPTH = 9
CHUNKS = {"A": (0, 0), "B": (8, 0), "E": (16, 0), "C": (0, 8), "D": (8, 8), "F": (16, 8)}
HOME_PATCHES = [("iron", 1, 2), ("copper", 11, 2), ("iron", 2, 11), ("coal", 17, 2), ("sand", 20, 5), ("coal", 18, 11),
                ("iron", 21, 13)]
EXOTIC = {"pebble": ("ore_skyglass", 5, 4), "cinder": ("ore_cinderite", 13, 10), "rime": ("ore_rime", 13, 10),
          "oldworks": ("ore_relic", 13, 10)}
VEIN_OF = {"pebble": "skyglass", "cinder": "cinderite", "rime": "rime", "oldworks": "relic"}

_cache = {}


def sheet(name):
    if name not in _cache:
        p = SRC_ART / f"{name}.png"
        if not p.exists():
            _cache[name] = None
            return None
        img = Image.open(p).convert("RGBA")
        meta = json.loads((SRC_ART / f"{name}.json").read_text())
        fw, fh = meta["frame"]
        cols = img.width // fw
        frames = [img.crop(((i % cols) * fw, (i // cols) * fh, (i % cols) * fw + fw, (i // cols) * fh + fh))
                  for i in range(meta["frames"])]
        _cache[name] = (frames, meta)
    return _cache[name]


def art(world, base):
    if world != "home":
        v = sheet(vname(world, base))
        if v:
            return v
    return sheet(base)


def hh(a, b=0, c=0):
    x = (a * 374761393 + b * 668265263 + c * 2147483647) & 0xFFFFFFFF
    x = ((x ^ (x >> 13)) * 1274126177) & 0xFFFFFFFF
    x ^= x >> 16
    return x / 4294967296


def island(world, fw, fh, owned, extra=None):
    """The island and its plot, baked to one image in world px with its top-left at (ox, oy)."""
    Y0, Y1 = -RIM["n"], fh + RIM["s"] - 1
    rowsL, rowsR = {}, {}
    for y in range(Y0, Y1 + 1):
        if y < 0:
            d = -y
            base = 3 if d <= 3 else 2 if d == 4 else 1 if d == 5 else -2
            mw, me = base + (0 if hh(y, 1, 401) < 0.5 else 1), base + (0 if hh(y, 2, 401) < 0.5 else 1)
        elif y < fh:
            bulge = math.sin(math.pi * (y + 3) / (fh + 5))
            mw = 3 + round(1.8 * bulge * bulge + hh(y // 2, 3, 401) * 0.9 - 0.45)
            me = 3 + round(1.8 * bulge * bulge + hh(y // 2, 4, 401) * 0.9 - 0.45)
        else:
            d = y - fh + 1
            mw = 2 if d == 1 else 1 if d == 2 else -2 - int(hh(d, 5, 401) * 2)
            me = 2 if d == 1 else 1 if d == 2 else -2 - int(hh(d, 6, 401) * 2)
        rowsL[y], rowsR[y] = mw, me
    for y in (-3, -2, -1):                 # the town's rows are land
        rowsL[y] = max(rowsL[y], 3)
        rowsR[y] = max(rowsR[y], 3)

    def hull(m):
        widest = Y0
        for y in range(Y0, Y1 + 1):
            if m[y] > m[widest] or (m[y] == m[widest] and abs(y - fh / 2) < abs(widest - fh / 2)):
                widest = y
        for y in range(Y0 + 1, widest + 1):
            m[y] = max(m[y], m[y - 1])
        for y in range(Y1 - 1, widest - 1, -1):
            m[y] = max(m[y], m[y + 1])
    hull(rowsL)
    hull(rowsR)
    X0, X1 = -RIM["w"] - 2, fw + RIM["e"] + 2
    land = set()
    for y in range(Y0, Y1 + 1):
        for x in range(-rowsL[y], fw + rowsR[y]):
            if X0 <= x < X1:
                land.add((x, y))
    for x in range(X0, X1):
        if (x, Y1) in land and hh((x + 40) // 3, 0, 402) < 0.3:
            land.discard((x, Y1))
    for x in range(X0, X1):
        if (x, Y1) in land and (x - 1, Y1) not in land and (x + 1, Y1) not in land:
            land.discard((x, Y1))
    for x in range(X0, X1):
        if (x, Y1) in land and ((x - 1, Y1) not in land or (x + 1, Y1) not in land) and not ((x - 2, Y1) in land or (x + 2, Y1) in land):
            land.discard((x, Y1))
    L = lambda x, y: (x, y) in land  # noqa: E731
    inPlot = lambda x, y: 0 <= x < fw and 0 <= y < fh  # noqa: E731

    def bottom(x):
        for y in range(Y1, Y0 - 1, -1):
            if L(x, y):
                return y
        return -999

    def mask(x, y):
        return (1 if L(x, y - 1) else 0) | (2 if L(x + 1, y) else 0) | (4 if L(x, y + 1) else 0) | (8 if L(x - 1, y) else 0)
    xs = [x for x in range(X0, X1) if bottom(x) > -999]
    xl, xr = min(xs), max(xs)
    fallX = []
    cand = sorted(range(xl + 1, xr), key=lambda a: hh(a, 7, 331))
    for x in cand:
        if len(fallX) >= 2:
            break
        b = bottom(x)
        if b < fh or mask(x, b) != (1 | 2 | 8):
            continue
        if any(abs(o - x) < 6 for o in fallX):
            continue
        fallX.append(x)
    cx, hw = (xl + xr + 1) / 2, (xr - xl + 1) / 2
    foot = {x: bottom(x) + 1 + CLIFF for x in range(xl, xr + 1)}
    ub, ubot = {}, {}
    for x in range(xl, xr + 1):
        u = foot[x]
        for k in range(-2, 3):
            v = foot.get(x + k, -999)
            if v - foot[x] == 1:
                u = max(u, v)
        t = max(0.0, 1 - abs(x + 0.5 - cx) / hw)
        ub[x] = u
        ubot[x] = u + 1 + round((DEPTH - 1) * t ** 1.8)
    x = xl + 1
    while x + 0.5 <= cx:
        ubot[x] = max(ubot[x], ubot[x - 1])
        x += 1
    x = xr - 1
    while x + 0.5 > cx:
        ubot[x] = max(ubot[x], ubot[x + 1])
        x -= 1
    deep = max(ubot.values())
    deepX = [x for x in range(xl, xr + 1) if ubot[x] == deep]
    mid = (min(deepX) + max(deepX) + 1) / 2
    tipCols = {math.floor(mid) - 1, math.floor(mid)}
    PADX = 3 * T
    bedY = deep * T + 22
    W, H = (X1 - X0) * T + PADX * 2, (deep - Y0) * T + 32 + 56
    ox, oy = X0 * T - PADX, Y0 * T

    def TT(x, y):
        return x * T - ox, y * T - oy
    edge, _ = art(world, "isle_edge")
    grass, _ = art(world, "tile_grass")
    deco, _ = art(world, "tile_grass_deco")
    sil = new(W, H)
    solid_block = Image.new("RGBA", (T, T), (0, 0, 0, 255))
    for (x, y) in land:
        px, py = TT(x, y)
        m = mask(x, y)
        sil.alpha_composite(solid_block if (m == 15 or inPlot(x, y)) else edge[m % len(edge)], (px, py))
    sa = sil.split()[3].load()

    def solid(px, py):
        return 0 <= px < W and 0 <= py < H and sa[px, py] > 0
    body = new(W, H)
    cliff, _ = art(world, "isle_cliff")
    strip = new(64, 48)
    for r in range(3):
        for v in range(4):
            strip.alpha_composite(cliff[r * 4 + v], (v * 16, r * 16))
    for x in range(xl, xr + 1):
        endLow = ub[x] * T - oy
        for i in range(T):
            px = x * T + i - ox
            sx = (x * T + i) % 64
            lowest = -1
            for py in range(H - 2, -1, -1):
                if solid(px, py) and not solid(px, py + 1):
                    lowest = py
                    break
            for py in range(H - 1):
                if not solid(px, py) or solid(px, py + 1):
                    continue
                y0 = py + 1
                end = max(endLow, y0 + T) if py == lowest else y0 + CLIFF * T
                ln = end - y0
                if ln <= 0:
                    continue
                topLen = min(16, ln)
                body.alpha_composite(strip.crop((sx, 0, sx + 1, topLen)), (px, y0))
                rest = ln - topLen
                if rest > 0:
                    lowLen = min(16, rest)
                    yy = y0 + topLen
                    midLen = rest - lowLen
                    while midLen > 0:
                        h = min(16, midLen)
                        body.alpha_composite(strip.crop((sx, 16, sx + 1, 16 + h)), (px, yy))
                        yy += h
                        midLen -= h
                    body.alpha_composite(strip.crop((sx, 48 - lowLen, sx + 1, 48)), (px, yy))
    # veins (source-atop: only onto rock)
    vein, vmeta = art(world, "isle_vein")
    names = vmeta.get("names", [])
    ores = ["iron", "copper", "coal", "sand"] + ([VEIN_OF[world]] if world in VEIN_OF else [])
    for x in range(xl, xr + 1):
        if hh(x, 0, 312) >= 0.28:
            continue
        ore = ores[int(hh(x, 0, 315) * len(ores))]
        n = ore + str(int(hh(x, 0, 316) * 4))
        if n in names:
            px, py = TT(x, bottom(x) + 2)
            v = vein[names.index(n)]
            region = body.crop((px, py + 2, px + 16, py + 18))
            vv = new(16, 16)
            vv.alpha_composite(v)
            ra = region.split()[3]
            va = vv.split()[3]
            from PIL import ImageChops
            vv.putalpha(ImageChops.multiply(va, ra))
            region.alpha_composite(vv)
            body.paste(region, (px, py + 2))
    under, _ = art(world, "isle_under")
    udeco, _ = art(world, "isle_under_deco")

    def cell(x, r):
        return xl <= x <= xr and ub[x] <= r < ubot[x]
    for x in range(xl, xr + 1):
        for r in range(ub[x], ubot[x]):
            if cell(x, r + 1) or (r == deep - 1 and x in tipCols):
                kind = 0
            elif not cell(x - 1, r):
                kind = 2
            elif not cell(x + 1, r):
                kind = 3
            else:
                kind = 1
            px, py = TT(x, r)
            body.alpha_composite(under[(kind * 4 + x % 4) % len(under)], (px, py))
            if kind == 0 and hh(x, r, 330) < 0.3:
                body.alpha_composite(udeco[int(hh(x, r, 331) * len(udeco))], (px, py))
    tip, tmeta = art(world, "isle_tip")
    body.alpha_composite(tip[0], (round(mid * T - ox - tmeta["anchor"][0]), deep * T - oy - tmeta["anchor"][1]))
    body = ink_outline(body)
    c = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    bed(c, (xl - 2) * T - ox, (xr + 3) * T - ox, bedY - oy, xl * T - ox, (xr + 1) * T - ox)
    c.alpha_composite(body)
    falls = {(x, bottom(x)) for x in fallX}
    ftop = art(world, "isle_fall_top")[0]
    for (x, y) in sorted(land, key=lambda t: (t[1], t[0])):
        if inPlot(x, y):
            continue
        m = mask(x, y)
        px, py = TT(x, y)
        if m == 15:
            c.alpha_composite(grass[int(hh(x, y, 317) * len(grass))], (px, py))
            if hh(x, y, 318) < 0.13:
                c.alpha_composite(deco[int(hh(x, y, 319) * len(deco))], (px, py))
        elif (x, y) not in falls:
            c.alpha_composite(edge[m % len(edge)], (px, py))
    # props
    props = []
    taken = set()
    nearPlot = lambda x, y: -1 <= x <= fw and -1 <= y <= fh  # noqa: E731
    town = lambda x, y: -3 <= y <= -1 and -3 <= x <= fw + 2  # noqa: E731
    nearFall = lambda x, y: any(abs(f - x) <= 1 and y >= bottom(f) - 1 for f in fallX)  # noqa: E731
    for y in range(Y0, Y1 + 1):
        for x in range(X0, X1):
            if not L(x, y) or nearPlot(x, y) or nearPlot(x, y - 1) or town(x, y) or town(x, y - 1) or nearFall(x, y):
                continue
            if not (L(x, y + 1) and L(x - 1, y) and L(x + 1, y) and L(x, y - 1)):
                continue
            if hh(x, y, 321) > 0.34:
                continue
            if any(p[0] == "tree" and abs(p[1] - x) <= 1 and abs(p[2] - y) <= 1 for p in props):
                continue
            props.append(("tree", x, y, int(hh(x, y, 322) * 4)))
            taken |= {(x, y), (x, y - 1)}
    for y in range(Y0, Y1 + 1):
        for x in range(X0, X1):
            if not L(x, y) or inPlot(x, y) or town(x, y) or nearFall(x, y) or (x, y) in taken or (x, y + 1) in taken:
                continue
            m = mask(x, y)
            if m == (1 | 2 | 8) and hh((x + 100) // 4, 0, 323) < 0.4 and not nearPlot(x, y):
                props.append(("fence", x, y, 0))
                continue
            if m == 15 and not nearPlot(x, y) and hh(x, y, 324) < 0.08:
                props.append(("bush", x, y, int(hh(x, y, 325) * 4)))
    tree, tm = art(world, "prop_tree")
    bush, _ = art(world, "prop_bush")
    fence, _ = art(world, "prop_fence")
    for kind, x, y, f in sorted(props, key=lambda p: (p[2], p[1])):
        px, py = TT(x, y)
        if kind == "tree":
            c.alpha_composite(tree[f % len(tree)], (px + T // 2 - tm["anchor"][0], py + 14 - tm["anchor"][1]))
        elif kind == "fence":
            c.alpha_composite(fence[0], (px, py + 2))
        else:
            c.alpha_composite(bush[f % len(bush)], (px, py))
    # the plot
    plot_ground(c, world, fw, fh, owned, ox, oy, extra)
    # falls (frame 0)
    head = art(world, "isle_fall_head")[0]
    fall, fmeta = art(world, "isle_fall")
    foam, _ = art(world, "isle_fall_foam")
    for x in fallX:
        fx, fy = x * T - ox, bottom(x) * T - oy
        c.alpha_composite(ftop[0], (fx, fy))
        c.alpha_composite(head[0], (fx, fy + T))
        y = fy + 2 * T
        y1 = bedY + 6 - oy
        while y < y1:
            h = min(fall[0].height, y1 - y)
            c.alpha_composite(fall[0].crop((0, 0, fall[0].width, h)), (fx + (T - fall[0].width) // 2, y))
            y += fall[0].height
        c.alpha_composite(foam[0], (fx + T // 2 - foam[0].width // 2, y1 - foam[0].height // 2))
    return c, ox, oy


def plot_ground(c, world, fw, fh, owned, ox, oy, extra):
    pave, _ = art(world, "tile_pave")
    grass, _ = art(world, "tile_grass")
    deco, _ = art(world, "tile_grass_deco")
    seam, _ = art(world, "tile_pave_seam")
    pedge, _ = art(world, "tile_pave_edge")
    plot, _ = art(world, "tile_plot")
    patches = [(f"tile_ore_{k}", x, y) for k, x, y in HOME_PATCHES if y < fh]
    if world in EXOTIC and sheet(EXOTIC[world][0]):
        patches.append(EXOTIC[world])
    ore_at = {}
    for i, (n, x, y) in enumerate(patches):
        for dy in (0, 1):
            for dx in (0, 1):
                ore_at[(x + dx, y + dy)] = (i, dx, dy)

    def own(x, y):
        for k, (cx, cy) in CHUNKS.items():
            if cx <= x < cx + 8 and cy <= y < cy + 8:
                return k in owned
        return False
    for k, (cx, cy) in CHUNKS.items():
        if cy >= fh:
            continue
        o = k in owned
        nb = (1 if own(cx + 4, cy - 1) else 0) | (2 if own(cx + 8, cy + 4) else 0) | (4 if own(cx + 4, cy + 8) else 0) | (8 if own(cx - 1, cy + 4) else 0)
        for ty in range(8):
            for tx in range(8):
                x, y = cx + tx, cy + ty
                px, py = x * T - ox, y * T - oy
                fl = pave if o else grass
                c.alpha_composite(fl[int(hh(x, y, 91) * len(fl)) % len(fl)], (px, py))
                if not o and (x, y) not in ore_at and hh(x, y, 93) < 0.09:
                    c.alpha_composite(deco[int(hh(x, y, 94) * len(deco)) % len(deco)], (px, py))
                if (x, y) in ore_at:
                    i, dx, dy = ore_at[(x, y)]
                    s, _ = art(world, patches[i][0])
                    seat = 4 if (not o and len(s) >= 9) else 0
                    c.alpha_composite(s[1 + dx + 2 * dy + seat], (px, py))
                else:
                    for i, (n, pxp, pyp) in enumerate(patches):
                        ddx, ddy = x - pxp, y - pyp
                        if -1 <= ddx <= 2 and -1 <= ddy <= 2 and art(world, n + "_spill"):
                            sp, _ = art(world, n + "_spill")
                            c.alpha_composite(sp[(ddy + 1) * 4 + (ddx + 1) + (16 if not o and len(sp) >= 32 else 0)], (px, py))
                n_, s_, w_, e_ = ty == 0, ty == 7, tx == 0, tx == 7
                if o:
                    for on, bit, f in ((n_, 1, 0), (e_, 2, 1), (s_, 4, 2), (w_, 8, 3)):
                        if not on or (nb & bit and bit in (1, 8)):
                            continue
                        a = seam if nb & bit else pedge
                        c.alpha_composite(a[f % len(a)], (px, py))
                elif n_ or s_ or w_ or e_:
                    f = (0 if n_ else 6 if s_ else 3) + (0 if w_ else 2 if e_ else 1)
                    c.alpha_composite(plot[f % len(plot)], (px, py))
    if extra:
        extra(c, ox, oy)


def ink_outline(img):
    a = img.split()[3].load()
    W, H = img.size
    out = img.copy()
    o = out.load()
    ink = rgb(P["ink"]) + (255,)
    for y in range(H):
        for x in range(W):
            if a[x, y]:
                continue
            if (x > 0 and a[x - 1, y]) or (x < W - 1 and a[x + 1, y]) or (y > 0 and a[x, y - 1]) or (y < H - 1 and a[x, y + 1]):
                o[x, y] = ink
    return out


def bed(c, x0, x1, y, sx0, sx1):
    cs = []
    w = x1 - x0
    i, x = 0, x0 + 6
    while x < x1 - 6:
        t = (x - x0) / w
        r = 6 + 9 * math.sin(t * math.pi) + hh(i, 0, 341) * 4
        cs.append((x, y + 12 - r * 0.35 + hh(i, 1, 342) * 3, r))
        x += r * 0.95
        i += 1

    def inside(px, py):
        return any((px + 0.5 - a) ** 2 + (py + 0.5 - b) ** 2 <= r * r for a, b, r in cs)
    px_ = c.load()
    for py in range(int(y - 12), int(y + 36)):
        for px in range(int(x0), int(x1)):
            if not (0 <= px < c.width and 0 <= py < c.height) or not inside(px, py):
                continue
            shade = sx0 <= px < sx1 and py < y + 10
            col = "cloud1" if shade else "cloud2"
            if not inside(px, py - 2) or not inside(px + 1, py - 1):
                col = "cloud2" if shade else "cloud3"
            elif not inside(px - 1, py + 3):
                col = "cloud0" if shade else "cloud1"
            px_[px, py] = rgb(P[col]) + (255,)


def sky_bg(w, h):
    img = Image.new("RGBA", (w, h))
    ramp = [P["sky1"], P["sky2"], P["sky3"], P["sky4"]]
    from c4 import bayer
    pp = img.load()
    for y in range(h):
        t = y / h * (len(ramp) - 1)
        i = int(t)
        f = t - i
        for x in range(w):
            col = ramp[min(i + 1, len(ramp) - 1)] if f > bayer(x, y) else ramp[i]
            pp[x, y] = rgb(col) + (255,)
    return img


def scene(world, owned=("A", "B", "C", "D", "E"), extra=None):
    fw, fh = 24, (8 if world == "pebble" else 16)
    own = tuple(o for o in owned if not (world == "pebble" and o in "CDF"))
    img, ox, oy = island(world, fw, fh, set(own), extra)
    out = sky_bg(img.width, img.height)
    out.alpha_composite(img)
    return out, ox, oy


def build(extra_for=None):
    worlds = ["home", "pebble", "cinder", "rime", "oldworks"]
    shots = []
    for w in worlds:
        img, ox, oy = scene(w, extra=(extra_for or {}).get(w))
        shots.append((w, img, ox, oy))
        scale(img, 2).save(OUT / f"mock_{w}@2x.png")
        # the plot and the lip at 3x: chunks A-E and the south rim
        crop = img.crop((-ox - 3 * T, -oy - 3 * T, -ox + 24 * T + 3 * T, -oy + (11 if w != "pebble" else 9) * T + 4 * T))
        scale(crop, 3).save(OUT / f"mock_{w}_plot@3x.png")
    Wt = sum(s[1].width for s in shots) + 8 * (len(shots) + 1)
    Ht = max(s[1].height for s in shots) + 16
    sheet_ = Image.new("RGBA", (Wt, Ht), rgb(P["sky1"]) + (255,))
    x = 8
    for w, img, _, _ in shots:
        sheet_.alpha_composite(img, (x, 8))
        x += img.width + 8
    sheet_.save(OUT / "mock_isles@1x.png")
    print("mock_isles@1x.png", sheet_.size)


if __name__ == "__main__":
    build()
