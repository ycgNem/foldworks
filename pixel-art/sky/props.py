"""Rim props (docs/sky-island.md, layer 4; the style test): trees, bushes and a fence for the
grass rim round the plot (never on the plot). Chunky, ink1-outlined like the town's sprites, lit
from the top-left, each casting a soft grass0/grass1 shadow down-right on the meadow.

prop_tree 32x32 x4 (anchor at the trunk foot): oak, pine, apple, blossom.
prop_bush 16x16 x4: bush, boulder, flower bed, stump.
prop_fence 16x16 x4: h, v, post, gate.
Run `python props.py` from this folder.
"""
import math

from common import P, new, draw, put, rect, export, rng, hsh, vnoise, get, rgb, outline, scale

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


def tree(kind):
    img = new(32, 32)
    G = (P["grass0"], P["grass1"], P["grass2"], P["grass3"])
    body = new(32, 32)
    if kind == 0:      # oak: a broad round crown of three lobes
        trunk(body, 14, 19, 28)
        crown = new(32, 32)
        blobs(crown, [(10, 15, 7), (21, 14, 7.5), (16, 9, 8), (16, 17, 7)], G, seed=1)
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
        blobs(crown, [(11, 14, 7), (21, 14, 7), (16, 10, 8)], G, seed=2)
        body.alpha_composite(crown)
        for (fx, fy) in ((10, 13), (19, 9), (22, 16), (14, 17), (17, 13)):
            draw(body, [(fx, fy), (fx + 1, fy), (fx, fy + 1), (fx + 1, fy + 1)], P["red"])
            put(body, fx, fy, P["copper3"])
    else:              # blossom: a peach and cream crown on a dark trunk
        trunk(body, 14, 19, 28)
        crown = new(32, 32)
        BL = (P["copper1"], P["copper2"], P["copper3"], P["bone"])
        blobs(crown, [(10, 14, 6.5), (21, 13, 7), (16, 9, 7.5), (16, 16, 6)], BL, seed=3)
        body.alpha_composite(crown)
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
    else:              # a stump with its rings
        rect(body, 4, 8, 11, 13, P["wood2"])
        draw(body, [(4, y) for y in range(8, 14)], P["wood3"])
        draw(body, [(11, y) for y in range(8, 14)], P["wood1"])
        for x in range(4, 12):
            put(body, x, 7, P["wood4"])
            put(body, x, 8, P["wood5"] if 5 <= x <= 10 else P["wood4"])
        draw(body, [(6, 8), (7, 8), (8, 8), (9, 8)], P["wood4"])
        put(body, 7, 8, P["wood3"])
        draw(body, [(3, 13), (12, 13)], P["wood1"])
        put(body, 9, 10, P["grass1"])
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
    export("prop_tree", [tree(k) for k in range(4)], anchor=(16, 29), bg=P["grass2"],
           extra={"names": ["oak", "pine", "apple", "blossom"]})
    export("prop_bush", [bush(k) for k in range(4)], bg=P["grass2"], look_scale=6,
           extra={"names": ["bush", "boulder", "flowerbed", "stump"]})
    export("prop_fence", [fence(k) for k in range(4)], bg=P["grass2"], look_scale=6,
           extra={"names": ["h", "v", "post", "gate"]})


if __name__ == "__main__":
    build()
