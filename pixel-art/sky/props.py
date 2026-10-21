"""Rim props (docs/sky-island.md, layer 4; the style test): trees, bushes and a fence for the
grass rim round the plot (never on the plot). Chunky, ink1-outlined like the town's sprites, lit
from the top-left, each casting a soft grass0/grass1 shadow down-right on the meadow.

prop_tree 32x32 x4 (anchor at the trunk foot): oak, pine, apple, blossom.
prop_bush 16x16 x4: bush, boulder, flower bed, stump.
prop_fence 16x16 x4: h, v, post, gate.
Run `python props.py` from this folder.
"""
import math

from pathlib import Path

from PIL import Image

from common import P, new, draw, put, rect, export, rng, hsh, vnoise, get, rgb, outline, scale, recolor, flip

L = (-0.55, -0.7, 0.45)
_n = math.sqrt(sum(c * c for c in L))
L = tuple(c / _n for c in L)


def blobs(img, balls, ramp, rim=None, seed=0, leafy=True):
    """Union of spheres, shaded lit-top-left into a 4-step ramp; leafy edges get a bite pattern."""
    W, H = img.size
    nz = vnoise(seed + 77, 2.2)
    for y in range(H):
        for x in range(W):
            best = None
            for (cx, cy, r) in balls:
                dx, dy = x + 0.5 - cx, y + 0.5 - cy
                d2 = dx * dx + dy * dy
                rr = r * r
                if leafy:
                    rr *= 0.86 + 0.28 * nz(x, y)
                if d2 <= rr:
                    z = math.sqrt(max(0.0, rr - d2))
                    key = z + cy * 0.25
                    if best is None or key > best[0]:
                        best = (key, dx / r, dy / r, z / r)
            if best is None:
                continue
            _, nx, ny, nzz = best
            lam = nx * L[0] + ny * L[1] + nzz * L[2]
            if leafy:
                lam += (nz(x * 1.7, y * 1.7) - 0.5) * 0.35
            i = 3 if lam > 0.72 else 2 if lam > 0.38 else 1 if lam > 0.02 else 0
            put(img, x, y, ramp[i])


def clumps(img, cx, cy, rx, ry, ramp, seed, n=9, rmin=3.2, rmax=4.6, fruit=None):
    """A crown made of leaf clumps (the production trees): small spheres jittered inside an
    ellipse, drawn back to front (the higher a clump, the further back), each shaded on its own
    (lit top-left, shaded bottom-right) plus a crown-wide term, so the whole is lit top-left too;
    a dark crease where a clump sits in front of another, a scalloped silhouette."""
    r = rng(seed)
    pts = []
    # a jittered ring and a centre, so the crown is full and its edge is lumpy
    for i in range(n):
        if i == 0:
            px, py = cx, cy
        else:
            a = (i / (n - 1)) * 2 * math.pi + r.uniform(-0.3, 0.3)
            k = r.uniform(0.55, 0.85)
            px, py = cx + math.cos(a) * rx * k, cy + math.sin(a) * ry * k
        pts.append((px, py, r.uniform(rmin, rmax)))
    # lower clumps first: the higher a clump, the nearer the eye (the view is from above), so each
    # sits over the ones under it and its underside throws a dark crease on them
    pts.sort(key=lambda p: -p[1])
    owner = {}
    W, H = img.size
    for idx, (px, py, rr) in enumerate(pts):
        g = -((px - cx) / rx) * 0.22 - ((py - cy) / ry) * 0.32
        for y in range(int(py - rr) - 1, int(py + rr) + 2):
            for x in range(int(px - rr) - 1, int(px + rr) + 2):
                dx, dy = x + 0.5 - px, y + 0.5 - py
                d2 = dx * dx + dy * dy
                if d2 > rr * rr or not (0 <= x < W and 0 <= y < H):
                    continue
                z = math.sqrt(rr * rr - d2) / rr
                lam = (dx / rr) * L[0] + (dy / rr) * L[1] + z * L[2]
                v = lam * 0.75 + g + 0.12
                i = 3 if v > 0.62 else 2 if v > 0.3 else 1 if v > -0.02 else 0
                # the clump's underside over the clump below: a dark crease, a step lighter
                # than the crown's own shadow at its edge
                if d2 > (rr - 1.3) ** 2 and dy > -0.3 * rr and (x, y) in owner:
                    i = 0 if dy > 0.4 * rr else min(i, 1)
                put(img, x, y, ramp[i])
                owner[(x, y)] = idx
    if fruit:
        for (fx, fy) in fruit:
            if (fx, fy) in owner:
                draw(img, [(fx, fy), (fx + 1, fy), (fx, fy + 1), (fx + 1, fy + 1)], P["red"])
                put(img, fx, fy, P["copper3"])
                put(img, fx + 1, fy + 1, P["copper0"])


def shadow(img, cx, cy, rx, ry):
    for y in range(img.height):
        for x in range(img.width):
            if ((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2 <= 1 and not get(img, x, y)[3]:
                put(img, x, y, P["grass1"])


def trunk(img, x, y0, y1, w=3):
    for y in range(y0, y1 + 1):
        put(img, x, y, P["wood3"])
        for k in range(1, w - 1):
            put(img, x + k, y, P["wood2"])
        put(img, x + w - 1, y, P["wood1"])
    put(img, x - 1, y1, P["wood2"])
    put(img, x + w, y1, P["wood1"])


RAW = Path(__file__).resolve().parent / "raw"


def oak_draft():
    """PixelLab draft 2 (prompts.md #2: a bushy oak, palette forced to grass, wood, ink1, moss1),
    finished here: snapped to those colours, the dirt patch under it cleared (the meadow gets our
    own soft shadow instead), the root flare kept. Its five clusters with dark gaps were what the
    hand-drawn crowns lacked."""
    from common import snap
    src = Image.open(RAW / "pl_tree2.png").convert("RGBA")
    pool = [rgb(P[c]) for c in ("ink1", "grass0", "grass1", "grass2", "grass3", "wood1", "wood2", "wood3", "moss1")]
    img = snap(src, pool=pool)
    w3 = rgb(P["wood3"])
    for y in range(27, 32):
        for x in range(32):
            p = img.getpixel((x, y))
            if p[3] and p[:3] == w3:
                img.putpixel((x, y), (0, 0, 0, 0))
    return img


def tree(kind):
    img = new(32, 32)
    if kind in (0, 3):
        body = oak_draft()
        if kind == 3:
            # the blossom tree: the oak's silhouette turned round, its leaves peach and cream
            body = recolor(flip(body), {P["grass3"]: P["bone"], P["grass2"]: P["copper3"], P["grass1"]: P["copper2"],
                                        P["grass0"]: P["copper1"], P["moss1"]: P["copper0"]})
            for (x, y) in ((7, 30), (23, 30), (26, 29)):
                put(img, x, y, P["copper3"])
        shadow(img, 18, 29.5, 10, 2.2)
        img.alpha_composite(body)
        return img
    G = (P["grass0"], P["grass1"], P["grass2"], P["grass3"])
    body = new(32, 32)
    if kind == 0:      # oak: a broad round crown of leaf clumps
        trunk(body, 14, 19, 28)
        # a fork showing between the clumps
        draw(body, [(13, 19), (12, 18), (18, 19), (19, 18)], P["wood2"])
        crown = new(32, 32)
        clumps(crown, 16, 12, 10.5, 8.5, G, seed=1, n=10)
        body.alpha_composite(crown)
    elif kind == 1:    # pine: three stacked tiers, darker, a lit left edge
        trunk(body, 14, 24, 29, 3)
        D = (P["moss1"], P["grass0"], P["grass1"], P["grass2"])
        for (ty, hw, hh) in ((22, 11, 8), (16, 9, 7), (10, 6, 7)):
            for y in range(ty - hh, ty + 1):
                t = (y - (ty - hh)) / hh
                half = max(1, int(round(hw * t + 0.5)))
                for x in range(15 - half, 17 + half):
                    lit = x < 16 - half * 0.3
                    edge = y == ty
                    c = D[3] if lit and (x + y) % 3 and not edge else D[2] if lit else D[1]
                    if edge:
                        c = D[0] if not lit else D[1]
                    put(body, x, y, c)
        put(body, 15, 2, D[3])
        put(body, 16, 2, D[2])
    elif kind == 2:    # apple: the oak's crown rounder, red fruit with a lit pixel
        trunk(body, 14, 20, 28)
        crown = new(32, 32)
        clumps(crown, 16, 12, 9.5, 8, G, seed=2, n=8, rmin=3.4, rmax=4.8,
               fruit=((10, 12), (19, 8), (22, 15), (13, 16), (17, 12)))
        body.alpha_composite(crown)
    else:              # blossom: a peach and cream crown of small clumps on a dark trunk
        trunk(body, 14, 19, 28)
        crown = new(32, 32)
        BL = (P["copper1"], P["copper2"], P["copper3"], P["bone"])
        clumps(crown, 16, 12, 10, 8, BL, seed=3, n=11, rmin=2.8, rmax=4.0)
        # a few petals fallen on the grass under it
        body.alpha_composite(crown)
        for (x, y) in ((8, 29), (22, 30), (25, 28)):
            put(img, x, y, P["copper3"])
    body = outline(body, P["ink1"])
    shadow(img, 19, 28.5, 9, 2.6)
    img.alpha_composite(body)
    return img


def bush(kind):
    img = new(16, 16)
    body = new(16, 16)
    G = (P["grass0"], P["grass1"], P["grass2"], P["grass3"])
    if kind == 0:
        blobs(body, [(5, 10, 4.2), (10, 9, 4.6), (8, 7, 4)], G, seed=11)
    elif kind == 1:    # a boulder: faceted grey stone, lit top-left
        S = (P["steel1"], P["steel2"], P["steel3"], P["steel4"])
        blobs(body, [(7, 10, 5), (10, 11, 3.5)], S, seed=12, leafy=False)
        draw(body, [(5, 8), (6, 8)], P["steel4"])
        draw(body, [(9, 12), (10, 12)], P["steel1"])
        put(body, 7, 7, P["moss4"])
    elif kind == 2:    # a flower bed: a wooden border, soil and flowers
        rect(body, 2, 9, 13, 13, P["wood3"])
        draw(body, [(x, 9) for x in range(2, 14)], P["wood4"])
        draw(body, [(x, 13) for x in range(2, 14)], P["wood1"])
        rect(body, 3, 10, 12, 12, P["earth1"])
        for i, (fx, c) in enumerate(((4, "red"), (7, "lamp2"), (10, "violet"))):
            draw(body, [(fx, 7), (fx + 1, 8), (fx - 1, 8), (fx, 9)], P[c])
            put(body, fx, 8, P["lamp3"] if c != "lamp2" else P["copper2"])
            put(body, fx, 10, P["grass1"])
            put(body, fx + 1, 11, P["grass2"])
    else:              # a round stump: an elliptic cut top with rings, a bark side, two roots
        cx, top, rx, ry = 7.5, 8.0, 4.6, 2.2
        for y in range(5, 15):
            for x in range(1, 15):
                dx = (x + 0.5 - cx) / rx
                if abs(dx) > 1:
                    continue
                ytop = top - ry * math.sqrt(1 - dx * dx)
                ybot = top + 4 + ry * math.sqrt(1 - dx * dx)
                if ytop <= y + 0.5 <= ybot:
                    # the bark: lit left, shaded right, vertical fissures
                    c = P["wood3"] if dx < -0.45 else P["wood1"] if dx > 0.5 else P["wood2"]
                    if x in (6, 10) and y > top:
                        c = P["wood1"]
                    put(body, x, y, c)
        # the cut top: an ellipse of pale wood with two rings and the heart
        for y in range(5, 11):
            for x in range(2, 14):
                e = ((x + 0.5 - cx) / (rx - 0.4)) ** 2 + ((y + 0.5 - top) / (ry - 0.2)) ** 2
                if e <= 1:
                    put(body, x, y, P["wood5"] if e > 0.55 else P["wood4"] if e > 0.18 else P["wood3"])
        put(body, 7, 8, P["wood2"])
        draw(body, [(1, 13), (2, 13), (2, 12), (13, 13), (12, 12)], P["wood2"])
        put(body, 1, 12, P["wood3"])
        put(body, 10, 12, P["moss4"])
        put(body, 11, 11, P["moss3"])
    body = outline(body, P["ink1"])
    shadow(img, 10, 14, 5.5, 1.6)
    img.alpha_composite(body)
    return img


def fence(kind):
    """Rim-edge fence in the town's wood: posts 3 px, two rails; v is seen end-on from above (a
    run of posts north-south), the gate has a brass latch."""
    img = new(16, 16)
    body = new(16, 16)

    def post(x, y0=5, y1=13):
        for y in range(y0, y1 + 1):
            put(body, x, y, P["wood4"])
            put(body, x + 1, y, P["wood3"])
            put(body, x + 2, y, P["wood2"])
        put(body, x, y0, P["wood5"])
        put(body, x + 1, y0, P["wood4"])

    if kind == 0:      # h: two rails across, a post in the middle
        for y, c in ((7, "wood4"), (8, "wood2"), (10, "wood4"), (11, "wood2")):
            draw(body, [(x, y) for x in range(16)], P[c])
        post(6)
    elif kind == 1:    # v: a rail running north-south seen from above
        for x, c in ((7, "wood4"), (8, "wood3"), (9, "wood2")):
            draw(body, [(x, y) for y in range(16)], P[c])
        post(6, 3, 10)
    elif kind == 2:    # a corner post
        post(6, 4, 13)
        draw(body, [(6, 3), (7, 3), (8, 3)], P["wood4"])
    else:              # a gate: rails with a diagonal brace and a brass latch
        for y, c in ((7, "wood4"), (8, "wood2"), (11, "wood4"), (12, "wood2")):
            draw(body, [(x, y) for x in range(2, 14)], P[c])
        for k in range(5):
            put(body, 3 + k * 2, 11 - k, P["wood3"])
            put(body, 4 + k * 2, 11 - k, P["wood3"])
        post(0, 5, 13)
        post(13, 5, 13)
        draw(body, [(11, 9), (12, 9)], P["brass2"])
        put(body, 11, 9, P["brass3"])
    body = outline(body, P["ink1"])
    for x in range(16):
        if get(body, x, 13)[3] and not get(img, x, 14)[3]:
            put(img, x + 1, 14, P["grass1"])
    img.alpha_composite(body)
    return img


def build():
    export("prop_tree", [tree(k) for k in range(4)], anchor=(16, 29), bg=P["grass2"], src=True,
           extra={"names": ["oak", "pine", "apple", "blossom"]})
    export("prop_bush", [bush(k) for k in range(4)], bg=P["grass2"], look_scale=6, src=True,
           extra={"names": ["bush", "boulder", "flowerbed", "stump"]})
    export("prop_fence", [fence(k) for k in range(4)], bg=P["grass2"], look_scale=6, src=True,
           extra={"names": ["h", "v", "post", "gate"]})


if __name__ == "__main__":
    build()
