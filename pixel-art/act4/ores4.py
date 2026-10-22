"""The four exotic deposits (docs/endgame.md, the contract for Milestone 9): ore_skyglass (Pebble
Isle), ore_cinderite (Cinder Isle), ore_rime (Rime), ore_relic (the Old Works), drawn the way the
existing ore patches are (STYLE.md "Ore deposits"; pixel-art/revamp/ores.py, re-seated by
pixel-art/sky/ores_reseat.py): one 32x32 outcrop for its 2x2 patch in the 3/4 view, lit from the
top-left, breaking up through a ragged hole in the ground, rendered by the ore revamp's own
height-field renderer (`render`, `blob_mask`, `hole_ground`, loaded from revamp/ores.py) and
finished by hand rules; then a spill apron and the seats.

Told apart by silhouette first (and from Home's four):
- skyglass: a radiating cluster of slender glass spires, far taller and thinner than coal's
  shards, pale (cloud3 lit, sky shades), sun glints; glass chips in the spill.
- cinderite: three or four round pillow-lava domes of black basalt cracked by glowing seams, a
  magma pool glowing in the gaps between them; ash and scorch in the spill.
- rime: a low snow mound with chunky teal ice blocks standing out of it, flat frosted tops; frost
  in the spill.
- relic: a great old brass gear standing upright, half sunk in the earth, a violet eye at its
  hub, verdigris, beside a broken stone column stump; brass bits and stone chips in the spill.

Outputs (the tile_ore_* contract under the contract's names):
- ore_<x>.png 16x16 x9: 0 the whole outcrop at 16x16 (the Survey Office), 1-4 the quadrants (TL TR
  BL BR) on paving, 5-8 the same on the island's own meadow (Pebble grass, Cinder ash, Rime snow,
  Old Works olive grass); JSON "glints" (points in the 32x32 for orefx.ts), "seats".
- ore_<x>_spill.png 16x16 x32: 0-15 the 4x4 apron on paving (frame = (dy+1)*4 + (dx+1)), 16-31 on
  the meadow.
"""
import importlib.util
import math
import sys
from collections import deque
from pathlib import Path

from PIL import Image

from c4 import OUT, P, new, put, rgb, scale, ship, outline

HERE = Path(__file__).resolve().parent
REVAMP = HERE.parent / "revamp"


def _load_revamp(mod):
    """revamp/<mod>.py with revamp's own common/pal/terrain (the names collide with the sky's)."""
    names = ("common", "pal", "terrain")
    saved = {k: sys.modules.pop(k) for k in names if k in sys.modules}
    sys.path.insert(0, str(REVAMP))
    try:
        spec = importlib.util.spec_from_file_location(f"revamp_{mod}", REVAMP / f"{mod}.py")
        m = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(m)
    finally:
        sys.path.remove(str(REVAMP))
        for k in names:
            sys.modules.pop(k, None)
        sys.modules.update(saved)
    return m


RO = _load_revamp("ores")
S = 32
L = RO.L
render, blob_mask, hole_ground, field, diffuse, nearest_top, mini = (RO.render, RO.blob_mask, RO.hole_ground, RO.field,
                                                                     RO.diffuse, RO.nearest_top, RO.mini)


def draw(img, pts, c):
    for x, y in pts:
        if 0 <= x < img.width and 0 <= y < img.height:
            put(img, x, y, c)


def rng(seed):
    import random
    return random.Random(seed)


def facet_light(hx, hy):
    n = (-hx, -hy, 1.0)
    m = math.sqrt(sum(k * k for k in n))
    return sum(p * q for p, q in zip(n, L)) / m


# ================================================================ skyglass
def skyglass():
    mask = blob_mask(16, 17, 13.5, 12.8, 41, 0.2, 4)
    # spires: (cx, cy, half-width, height, lean x, lean y): slender diamond pyramids, tall
    spires = [(15, 16, 2.6, 19.0, 0.0, 0.0), (10, 15, 2.0, 13.0, -0.25, -0.1), (20, 13, 2.0, 14.0, 0.2, -0.2),
              (11, 22, 2.2, 10.0, -0.2, 0.25), (21, 21, 2.3, 11.0, 0.25, 0.2), (16, 25, 1.7, 7.0, 0.0, 0.3),
              (7, 19, 1.4, 6.0, -0.3, 0.1), (25, 17, 1.4, 6.5, 0.3, 0.0), (17, 10, 1.3, 7.5, 0.0, -0.3)]

    def hf(x, y):
        best = (0, None, -1, 0)
        for i, (cx, cy, a, h0, lx, ly) in enumerate(spires):
            u, v = (x - cx) / a, (y - cy) / (a * 0.8)
            d = abs(u) + abs(v)
            if d < 1:
                h = h0 * (1 - d) ** 0.9
                if h > best[0]:
                    su, sv = (1 if u >= 0 else -1), (1 if v >= 0 else -1)
                    lev = facet_light(-h0 * su / a, -h0 * sv / (a * 0.8))
                    best = (h, "glass", i, lev)
        return best
    H = field(hf)
    RAMP = [P["sky1"], P["sky3"], P["sky4"], P["cloud2"], P["cloud3"]]

    def colour(kind, mat, lev, z, x, y):
        lv = H[y][x][3] - (0.15 if kind == "face" else 0)
        k = 4 if lv > 0.85 else 3 if lv > 0.6 else 2 if lv > 0.3 else 1 if lv > -0.1 else 0
        if kind == "face" and 0 < k < 3:
            k += 1              # glass: light passes through the steep faces
        # a vertical streak of light inside the glass every few columns: it reads as clear
        if kind == "face" and (x + H[y][x][2]) % 4 == 0 and k < 3:
            k += 1
        return RAMP[k]

    def inside(x, y):
        return P["earth3"] if (x * 3 + y * 5) % 9 == 0 else P["earth2"]
    img, info = render(H, colour, hole_ground(mask, inside, P["earth1"], P["wood1"], P["earth1"]), gap_col=P["sky1"])
    glints = []
    for gx, gy in ((15, 0), (9, 4), (20, 3), (12, 12), (22, 12), (17, 19)):
        p = nearest_top(info, gx, gy, ("top",), ("glass",))
        if p and p not in glints:
            glints.append(p)
    draw(img, glints[:3], P["cloud3"])
    return img, glints, info


# ================================================================ cinderite
def cinderite():
    mask = blob_mask(16, 17, 14.4, 13.6, 52, 0.18, 4)
    domes = [(11, 13, 6.8, 6.0, 7.0), (21, 14, 5.6, 5.0, 5.8), (16, 22, 7.2, 5.8, 6.5), (7, 22, 3.6, 3.2, 3.2),
             (25, 22, 3.2, 3.0, 3.0)]

    def hf(x, y):
        best = (0, None, -1, 0)
        for i, (cx, cy, rx, ry, h0) in enumerate(domes):
            dx, dy = (x - cx) / rx, (y - cy) / ry
            d2 = dx * dx + dy * dy
            if d2 < 1:
                h = h0 * math.sqrt(1 - d2)
                if h > best[0]:
                    g = h0 / max(0.15, math.sqrt(1 - d2))
                    best = (h, "basalt", i, facet_light(g * dx / rx, g * dy / ry))
        return best
    H = field(hf)

    def colour(kind, mat, lev, z, x, y):
        lv = H[y][x][3] - (0.25 if kind == "face" else 0)
        return P["steel2"] if lv > 0.88 else P["steel1"] if lv > 0.62 else P["steel0"] if lv > 0.3 else P["ink2"] if lv > 0.0 else P["ink1"]

    def inside(x, y):
        # the magma pool between the domes
        return P["lamp1"] if (x + y) % 5 else P["lamp2"]
    img, info = render(H, colour, hole_ground(mask, inside, P["lamp0"], P["wood1"], P["copper0"]), gap_col=P["lamp0"])
    # glowing seams across the domes' tops: wandering lines, hot cores
    r = rng(61)
    cracks = []
    for i, (cx, cy, rx, ry, h0) in enumerate(domes[:3]):
        for _ in range(2):
            a = r.uniform(0, 6.283)
            x, y = cx + r.uniform(-2, 2), cy - h0 * 0.8 + r.uniform(-1, 2)
            for k in range(int(rx * 1.2)):
                p = (int(x), int(y))
                v = info.get(p)
                if v and v[0] == "top" and v[2] == i:
                    cracks.append((p, k))
                a += r.uniform(-0.6, 0.6)
                x, y = x + math.cos(a), y + math.sin(a) * 0.6
    for (p, k) in cracks:
        draw(img, [p], P["lamp2"] if k % 3 == 1 else P["lamp1"])
    glints = [p for p, k in cracks if k % 3 == 1][:4]
    draw(img, glints[:2], P["lamp3"])
    return img, glints, info


# ================================================================ rime crystal
def rime():
    mask = blob_mask(16, 17, 14.2, 13.4, 73, 0.16, 5)
    blocks = [(12, 14, 3.6, 12.0, 0.35), (20, 15, 3.0, 9.0, -0.3), (15, 22, 3.2, 8.0, 0.1), (24, 21, 2.4, 5.5, 0.5),
              (8, 21, 2.5, 6.0, -0.5)]

    def hf(x, y):
        dx, dy = (x - 16) / 13.0, (y - 18) / 11.5
        d2 = dx * dx + dy * dy
        best = (0, None, -1, 0)
        if d2 < 1:
            h = 2.0 * (1 - d2)
            best = (h, "snow", 99, facet_light(6.4 * dx / 13.0, 6.4 * dy / 11.5))
        for i, (cx, cy, s, h0, ang) in enumerate(blocks):
            c, sn = math.cos(ang), math.sin(ang)
            u = ((x - cx) * c + (y - cy) * sn) / s
            v = (-(x - cx) * sn + (y - cy) * c) / (s * 0.85)
            if max(abs(u), abs(v)) < 1 and h0 > best[0]:
                best = (h0, "ice", i, 0.9)
        return best
    H = field(hf)

    def colour(kind, mat, lev, z, x, y):
        cell = H[y][x]
        if mat == "snow":
            lv = cell[3] - (0.3 if kind == "face" else 0)
            return P["cloud3"] if lv > 0.85 else P["cloud2"] if lv > 0.55 else P["cloud1"] if lv > 0.2 else P["cloud0"]
        bx, s = blocks[cell[2]][0], blocks[cell[2]][2]
        if kind == "top":
            return P["cloud3"] if x < bx - s * 0.3 else P["cloud2"] if x < bx + s * 0.5 else P["sky4"]
        # the faces by where they sit across the block: a lit west edge, teal, a shaded east
        if z < 1:
            return P["water3"]
        u = (x + 0.5 - bx) / s
        c = P["sky4"] if u < -0.55 else P["teal"] if u < 0.35 else P["water4"]
        if c == P["teal"] and (x * 2 + z) % 7 == 0:
            c = P["sky4"]       # a fracture catching the light
        return c

    def inside(x, y):
        return P["sky3"] if (x + y * 2) % 7 == 0 else P["cloud0"]
    img, info = render(H, colour, hole_ground(mask, inside, P["sky1"], P["wood1"], P["cloud0"]), gap_col=P["water3"])
    glints = []
    for gx, gy in ((12, 4), (20, 7), (15, 15), (24, 16)):
        p = nearest_top(info, gx, gy, ("top",), ("ice",))
        if p and p not in glints:
            glints.append(p)
    return img, glints, info


# ================================================================ relic
def relic():
    mask = blob_mask(16, 18, 14.2, 12.6, 84, 0.2, 4)
    # a broken column stump (a short fluted drum) behind, on the right
    def hf(x, y):
        dx, dy = (x - 24) / 4.2, (y - 13) / 3.4
        if dx * dx + dy * dy < 1:
            return (6.5 - (1.5 if x > 24 else 0) * (x - 24) / 4, "stone", 1, facet_light(1.6 * dx, 1.6 * dy))
        dx, dy = (x - 6.5) / 2.8, (y - 24) / 2.2
        if dx * dx + dy * dy < 1:
            return (2.2, "stone", 2, facet_light(1.2 * dx, 1.2 * dy))
        return (0, None, -1, 0)
    H = field(hf)

    def colour(kind, mat, lev, z, x, y):
        lv = H[y][x][3] - (0.25 if kind == "face" else 0)
        if kind == "face" and x % 2 == 0:
            lv -= 0.2           # flutes
        return P["bone"] if lv > 0.85 else P["pave3"] if lv > 0.55 else P["pave2"] if lv > 0.2 else P["pave1"] if lv > -0.2 else P["pave0"]

    def inside(x, y):
        return P["earth0"] if (x * 5 + y) % 6 else P["earth1"]
    img, info = render(H, colour, hole_ground(mask, inside, P["ink1"], P["wood1"], P["earth0"]), gap_col=P["ink"])
    # the gear standing upright in front, its lower third sunk in the earth (cut at y 27)
    g = new(S, S)
    cx, cy, R = 14.0, 17.5, 9.2
    for y in range(S):
        for x in range(S):
            if y > 26:
                continue
            dx, dy = x + 0.5 - cx, y + 0.5 - cy
            d = math.hypot(dx, dy)
            a = math.atan2(dy, dx)
            tooth = math.cos(a * 9 + 0.3) > 0.25
            if d <= R - 1.6 or (d <= R + 0.6 and tooth):
                lam = (-dx * 0.7 - dy * 0.7) / R
                c = P["brass3"] if lam > 0.45 else P["brass2"] if lam > -0.1 else P["brass1"] if lam > -0.55 else P["brass0"]
                if 3.0 < d < 5.6:
                    c = P["brass1"] if lam > 0 else P["brass0"]          # the web, recessed
                    if abs(math.sin(a * 2)) < 0.25:
                        c = P["brass2"]                                  # spokes
                if d <= 3.0:
                    c = P["brass2"] if lam > 0 else P["brass1"]          # the hub
                if d <= 1.4:
                    c = P["violet"]
                put(g, x, y, c)
    put(g, 13, 16, P["bone"])
    # verdigris crusting its lower teeth
    for (x, y) in ((6, 22), (7, 24), (8, 25), (19, 25), (21, 23), (22, 21), (5, 20), (20, 24)):
        if g.getpixel((x, y))[3]:
            put(g, x, y, P["water3"] if (x + y) % 2 else P["water4"])
    g = outline(g, P["ink"])
    # where it meets the earth: a dark lip across, so it reads as sunk, not cut
    for x in range(S):
        if g.getpixel((x, 26))[3]:
            put(g, x, 27, P["ink1"])
    img.alpha_composite(g)
    glints = [(9, 12), (12, 10), (24, 9)]
    draw(img, glints[:1], P["lamp3"])
    return img, glints, info


# ================================================================ spill and seats
def outcrop_mask(img):
    return {(x, y) for y in range(S) for x in range(S) if img.getpixel((x, y))[3]}


def scatter(kind, deposit):
    """A 64x64 apron with the patch at (16, 16): bits within 4 px of the outcrop, thinning out.
    Painted on deck colours where it is a stain (wood2), so the seats remap it."""
    A, O = 64, 16
    mask = outcrop_mask(deposit)
    dist = {}
    q = deque()
    for (x, y) in mask:
        dist[(x + O, y + O)] = 0
        q.append((x + O, y + O))
    while q:
        p = q.popleft()
        if dist[p] >= 6:
            continue
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            n = (p[0] + dx, p[1] + dy)
            if 0 <= n[0] < A and 0 <= n[1] < A and n not in dist:
                dist[n] = dist[p] + 1
                q.append(n)
    img = new(A, A)
    r = rng({"skyglass": 71, "cinderite": 72, "rime": 73, "relic": 74}[kind])

    def free(x, y):
        if not (0 <= x < A and 0 <= y < A):
            return False
        if O <= x < O + S and O <= y < O + S and (x - O, y - O) in mask:
            return False
        return 1 <= dist.get((x, y), 99) <= 4
    ring = sorted((p for p, d in dist.items() if 1 <= d <= 4), key=lambda p: (p[1] * 64 + p[0]))

    def spots(n, near=3):
        c = [p for p in ring if dist[p] <= near]
        return [c[int(r.random() * len(c))] for _ in range(n)]

    def dot(pts, col):
        draw(img, [p for p in pts if free(*p)], col)
    if kind == "skyglass":
        for x, y in spots(7, 3):
            dot([(x, y)], P["sky3"] if r.random() < 0.6 else P["cloud3"])
            dot([(x + 1, y + 1)], P["sky1"])
        for x, y in spots(3, 3):
            dot([(x, y), (x + 1, y)], P["pave3"])
            dot([(x + 1, y + 1)], P["wood1"])
    elif kind == "cinderite":
        for x, y in spots(9, 2):
            dot([(x, y), (x + 1, y)], P["wood0"])                 # scorch (reseated: dark ground)
        for x, y in spots(5, 3):
            dot([(x, y)], P["ink2"])
            dot([(x + 1, y)], P["steel0"])
        for x, y in spots(2, 1):
            dot([(x, y)], P["lamp0"])
    elif kind == "rime":
        for p in ring:
            if dist[p] <= 3 and r.random() < 0.45 - dist[p] * 0.1:
                dot([p], P["cloud2"] if r.random() < 0.6 else P["cloud1"])
        for x, y in spots(3, 3):
            dot([(x, y)], P["teal"])
            dot([(x, y - 1)], P["cloud3"])
    elif kind == "relic":
        for x, y in spots(6, 2):
            dot([(x, y)], P["water3"])                            # verdigris stains
        for x, y in spots(3, 3):
            dot([(x, y), (x + 1, y)], P["brass2"])
            dot([(x + 1, y + 1)], P["ink"])
        for x, y in spots(3, 3):
            dot([(x, y), (x + 1, y)], P["pave2"])
            dot([(x, y + 1)], P["pave0"])
    out = deposit.copy()
    out.alpha_composite(img.crop((O, O, O + S, O + S)))
    frames = []
    for ty in range(4):
        for tx in range(4):
            f = img.crop((tx * 16, ty * 16, tx * 16 + 16, ty * 16 + 16))
            if 1 <= tx <= 2 and 1 <= ty <= 2:
                f = new(16, 16)
            frames.append(f)
    return out, frames


# the deck colours round each hole (wood0-3), onto paving or onto the island's own meadow
SEATS = {
    "pave": {"wood0": "pave0", "wood1": "pave0", "wood2": "pave1", "wood3": "pave2"},
    "skyglass": {"wood0": "grass0", "wood1": "grass0", "wood2": "grass1", "wood3": "grass2"},
    "cinderite": {"wood0": "ink2", "wood1": "ink2", "wood2": "earth0", "wood3": "earth1"},
    "rime": {"wood0": "cloud0", "wood1": "cloud0", "wood2": "cloud1", "wood3": "cloud2"},
    "relic": {"wood0": "moss1", "wood1": "moss1", "wood2": "moss2", "wood3": "moss4"},
}


def reseat(img, seat, outlined=True):
    import ores_reseat as orr       # pixel-art/sky/ores_reseat.py (its ground_mask)
    m = {rgb(P[k]): rgb(P[v]) for k, v in SEATS[seat].items()}
    out = img.copy()
    px = out.load()
    for (x, y) in orr.ground_mask(img, outlined):
        p = px[x, y]
        if p[3] and p[:3] in m:
            px[x, y] = m[p[:3]] + (255,)
    return out


def quads(o):
    return [o.crop((0, 0, 16, 16)), o.crop((16, 0, 32, 16)), o.crop((0, 16, 16, 32)), o.crop((16, 16, 32, 32))]


def apron(frames):
    a = new(64, 64)
    for i, f in enumerate(frames):
        a.alpha_composite(f, ((i % 4) * 16, (i // 4) * 16))
    return a


def tiles(a):
    return [a.crop(((i % 4) * 16, (i // 4) * 16, (i % 4) * 16 + 16, (i // 4) * 16 + 16)) for i in range(16)]


KINDS = {"skyglass": skyglass, "cinderite": cinderite, "rime": rime, "relic": relic}
FILE = {"skyglass": "ore_skyglass", "cinderite": "ore_cinderite", "rime": "ore_rime", "relic": "ore_relic"}


def build():
    looks = []
    for k, fn in KINDS.items():
        img, glints, _ = fn()
        img, spill = scatter(k, img)
        pave, meadow = reseat(img, "pave"), reseat(img, k)
        sp = apron(spill)
        sp_pave, sp_meadow = reseat(sp, "pave", False), reseat(sp, k, False)
        m = mini(pave)
        ship(FILE[k], [m] + quads(pave) + quads(meadow), extra={"glints": [list(p) for p in glints[:4]],
                                                              "seats": ["pave", "meadow"]}, look=6)
        ship(FILE[k] + "_spill", tiles(sp_pave) + tiles(sp_meadow), extra={"seats": ["pave", "meadow"]}, look=4)
        looks.append((k, pave, meadow, sp_pave, sp_meadow))
    # a look: each on a 4x4 of paving and of its island's meadow, beside Home's four, at 1x and 4x
    from isletools import home, vname
    world = {"skyglass": "pebble", "cinderite": "cinder", "rime": "rime", "relic": "oldworks"}
    sheet_ = Image.new("RGBA", (8 * 68 + 4, 2 * 68 + 4), rgb(P["ink1"]) + (255,))
    for i, (k, pave, meadow, spp, spm) in enumerate(looks):
        for j, (seated, spill, base) in enumerate(((pave, spp, "tile_pave"), (meadow, spm, "tile_grass"))):
            try:
                fr, _ = home(vname(world[k], base))
            except FileNotFoundError:
                fr, _ = home(base)
            sc = new(64, 64)
            for y in range(4):
                for x in range(4):
                    sc.alpha_composite(fr[(x * 3 + y * 5) % len(fr)], (x * 16, y * 16))
            sc.alpha_composite(spill)
            sc.alpha_composite(seated, (16, 16))
            sheet_.alpha_composite(sc, (4 + i * 68, 4 + j * 68))
    for i, o in enumerate(("iron", "copper", "coal", "sand")):
        fr, _ = home(f"tile_ore_{o}")
        sp, _ = home(f"tile_ore_{o}_spill")
        for j, base in enumerate(("tile_pave", "tile_grass")):
            g, _ = home(base)
            sc = new(64, 64)
            for y in range(4):
                for x in range(4):
                    sc.alpha_composite(g[(x * 3 + y * 5) % 4], (x * 16, y * 16))
            sc.alpha_composite(apron(sp[j * 16:j * 16 + 16]))
            for q in range(4):
                sc.alpha_composite(fr[1 + q + 4 * j], (16 + (q % 2) * 16, 16 + (q // 2) * 16))
            sheet_.alpha_composite(sc, (4 + (4 + i) * 68, 4 + j * 68))
    sheet_.save(OUT / "ores4_look.png")
    scale(sheet_, 4).save(OUT / "ores4_look@4x.png")


if __name__ == "__main__":
    build()
