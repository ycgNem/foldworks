"""The sky behind the island (docs/sky-island.md, layer 1; the style test): the gradient spec and
its reference render, cloud puffs, far islets (pre-hazed) and a flapping bird.

The gradient is code (src/render/sky.ts bakes it per screen size): flat bands of the sky ramp,
top to bottom, each change an 8 px ordered-dither seam (Bayer 4x4, so it never reads as a stripe
and never as noise), and a sun glow in the top-left corner as concentric dithered rings. SPEC is
the whole recipe; `gradient()` renders it exactly as the code should, for the mock.

Run `python sky.py` from this folder. Outputs to pixel-art/sky/out/.
"""
import json
import math

from common import P, new, draw, put, rect, export, rng, hsh, vnoise, scale, get, rgb, bayer, OUT, outline
from PIL import Image

# ---------------------------------------------------------------- the gradient
# stops: (fraction of the screen height where this colour starts, colour). Sun: centre as a
# fraction of (W, H), then rings (radius as a fraction of H, colour), innermost first.
SPEC = {
    "workshop": {
        "stops": [(0.0, "sky0"), (0.22, "sky1"), (0.50, "sky2"), (0.74, "sky3"), (0.90, "sky4")],
        "sun": {"at": [0.08, -0.05], "rings": [(0.07, "sun"), (0.12, "sky4"), (0.19, "sky3"), (0.29, "sky2")]},
        "seam": 8,
        "clouds": {"far": {"parallax": 0.15, "speed": 2, "y": [0.55, 0.85]},
                   "near": {"parallax": 0.35, "speed": 5, "y": [0.70, 1.0]},
                   "sea": {"parallax": 0.5, "y": 0.86}},
        "islets": {"parallax": 0.1, "y": [0.62, 0.80], "count": 4},
    },
    "factory": {
        # higher up: a deeper zenith over more of the screen, the cloud sea closer below
        "stops": [(0.0, "sky0"), (0.40, "sky1"), (0.66, "sky2"), (0.84, "sky3")],
        "sun": {"at": [0.08, -0.05], "rings": [(0.06, "sun"), (0.10, "sky4"), (0.16, "sky3"), (0.24, "sky2")]},
        "seam": 8,
        "clouds": {"far": {"parallax": 0.15, "speed": 2, "y": [0.45, 0.70]},
                   "near": {"parallax": 0.35, "speed": 5, "y": [0.60, 1.0]},
                   "sea": {"parallax": 0.5, "y": 0.74, "gap": [0.30, 0.46]}},
        "islets": {"parallax": 0.1, "y": [0.55, 0.70], "count": 2},
    },
}


def gradient(W, H, floor="workshop"):
    s = SPEC[floor]
    img = Image.new("RGBA", (W, H))
    px = img.load()
    stops = [(int(f * H), rgb(P[c])) for f, c in s["stops"]]
    seam = s["seam"]
    sun = s["sun"]
    sx, sy = sun["at"][0] * W, sun["at"][1] * H
    rings = [(r * H, rgb(P[c])) for r, c in sun["rings"]]
    for y in range(H):
        # the band colour with a dithered seam over the last `seam` rows before each stop
        c = stops[0][1]
        for y0, cc in stops:
            if y >= y0:
                c = cc
        for x in range(W):
            cx = c
            for i, (y0, cc) in enumerate(stops):
                if y0 - seam <= y < y0:
                    t = (y - (y0 - seam) + 0.5) / (seam + 1)
                    cx = cc if bayer(x, y) < t else stops[i - 1][1]
                    break
            # the sun's rings (over the bands)
            d = math.hypot(x - sx, (y - sy))
            for k, (r, rc) in enumerate(rings):
                if d < r - seam:
                    cx = rc
                    break
                if d < r:
                    # dither into the next ring out (or the band, past the last ring)
                    outer = rings[k + 1][1] if k + 1 < len(rings) else cx
                    t = (r - d) / seam
                    cx = rc if bayer(x, y) < t else outer
                    break
            px[x, y] = cx + (255,)
    return img


# ---------------------------------------------------------------- clouds
def cloud(puffs, W=64, H=32, flat=None, seed=0):
    """Puffs: (cx, cy, r). Sphere shading lit from the top-left, quantised to the cloud ramp:
    cloud3 lit caps, cloud2 body, cloud1 the turned-away side, cloud0 the flat underside; a
    cloud1 crease where a front puff overlaps the one behind. No outline (they sit on sky)."""
    img = new(W, H)
    L = (-0.45, -0.75, 0.5)
    n = math.sqrt(sum(c * c for c in L))
    L = tuple(c / n for c in L)
    base = flat if flat is not None else max(cy + r * 0.55 for cx, cy, r in puffs)
    owner = {}
    for y in range(H):
        for x in range(W):
            best, bz, bi = None, -1, -1
            for i, (cx, cy, r) in enumerate(puffs):
                dx, dy = x + 0.5 - cx, (y + 0.5 - cy) * 1.15
                d2 = dx * dx + dy * dy
                if d2 <= r * r and y + 0.5 <= base:
                    z = math.sqrt(r * r - d2)
                    # front puffs (lower, larger) win
                    key = z + cy * 0.6
                    if key > bz:
                        bz, best, bi = key, (dx / r, dy / r, z / r), i
            if best is None:
                continue
            owner[(x, y)] = bi
            lam = best[0] * L[0] + best[1] * L[1] + best[2] * L[2]
            if base - (y + 0.5) < 2.2:
                c = "cloud0" if base - (y + 0.5) < 1.2 else "cloud1"
            elif lam > 0.78:
                c = "cloud3"
            elif lam > 0.42:
                c = "cloud2"
            elif lam > 0.1:
                c = "cloud1"
            else:
                c = "cloud0"
            put(img, x, y, P[c])
    # creases: where a pixel's owner differs from the one above-left and that one is behind
    for (x, y), i in owner.items():
        up = owner.get((x, y - 1))
        if up is not None and up != i and puffs[i][1] > puffs[up][1]:
            c = get(img, x, y)[:3]
            if c in (rgb(P["cloud3"]), rgb(P["cloud2"])):
                put(img, x, y, P["cloud1"])
    return img


CLOUDS = [
    # big
    [(14, 20, 9), (26, 14, 12), (40, 16, 10), (51, 21, 8), (33, 22, 9)],
    [(12, 21, 8), (24, 17, 10), (37, 12, 11), (49, 19, 9)],
    # medium
    [(18, 22, 7), (29, 17, 9), (40, 21, 7)],
    [(20, 21, 6), (30, 16, 8), (41, 18, 7), (48, 23, 5)],
    # small
    [(26, 23, 5), (34, 20, 6)],
    [(28, 24, 4), (35, 22, 5), (41, 25, 3)],
]


def clouds():
    out = []
    for i, p in enumerate(CLOUDS):
        base = max(cy + r * 0.62 for cx, cy, r in p)
        out.append(cloud(p, flat=min(31, base), seed=i))
    return out


# ---------------------------------------------------------------- far islets (pre-hazed)
def islet(v):
    """64x48, a far island already hazed towards the sky: a teal top (grass in haze), blue-grey
    cliff and underside (cloud1 lit, cloud0 and sky2 in shade), a thread of waterfall on two of them, a
    tiny silhouette on top (trees, a hut, a windmill, a lighthouse)."""
    W, H = 64, 48
    img = new(W, H)
    r = rng(3000 + v)
    widths = [44, 36, 28, 40]
    w = widths[v]
    cx = 32 + (v % 2) * 2 - 1
    top = 18 + (v % 3)
    x0, x1 = cx - w // 2, cx + w // 2
    # the top surface: an ellipse band 6 px tall
    for x in range(x0, x1 + 1):
        t = (x - cx) / (w / 2)
        yt = top - int(round(3 * math.sqrt(max(0, 1 - t * t))))
        for y in range(yt, top + 2):
            put(img, x, y, P["teal"] if y < top or (x < cx) else P["water4"] if y == top + 1 else P["teal"])
        put(img, x, yt, P["sky4"] if x < cx else P["teal"])
    # the cliff: 5 px of hazed face, lit left (cloud1), shaded right (cloud0), one stratum line
    for x in range(x0, x1 + 1):
        for y in range(top + 2, top + 7):
            put(img, x, y, P["cloud1"] if x < cx + w // 6 else P["cloud0"])
        put(img, x, top + 4 + ((x // 5) % 2), P["cloud0"] if x < cx + w // 6 else P["sky2"])
    # the underside: a tapering point, lit left (cloud0), the rest sky2 (deepest haze)
    # lumpy: the taper steps in tiers every 4-5 rows and each side wobbles, a boulder or two hang
    depth = 18 + v * 2
    for y in range(top + 7, min(H, top + 7 + depth)):
        t = (y - top - 7) / depth
        tier = ((y - top - 7) // 5) * 5 / depth
        base = (w / 2) * (1 - (t * 0.35 + tier * 0.65)) ** 1.5
        wl = base + (hsh(3100 + v, y // 2) % 3) - 1
        wr = base + (hsh(3200 + v, y // 2) % 3) - 1
        for x in range(W):
            dx = x + 0.5 - cx - t * 3
            if -wl <= dx <= wr:
                c = P["cloud0"] if dx < -wl * 0.3 else P["sky2"]
                if (y - top - 7) % 5 == 0 and dx > -wl + 1:
                    c = P["sky2"] if c == P["cloud0"] else P["sky1"]
                put(img, x, y, c)
    for (bx, by) in ((cx - w // 4, top + 9 + v), (cx + w // 5, top + 12)):
        for y in range(by, by + 3):
            for x in range(bx - 1, bx + 2):
                if not get(img, x, y)[3]:
                    put(img, x, y, P["sky2"] if x > bx - 1 else P["cloud0"])
    # waterfall threads
    if v in (0, 3):
        fx = cx + w // 3 - 2
        for y in range(top + 1, H - 2):
            put(img, fx, y, P["cloud2"] if (y // 3) % 2 else P["sky4"])
    # silhouettes on top (cloud0, a hazed dark)
    if v == 0:      # three round trees
        for (tx, s) in ((cx - 12, 4), (cx - 6, 3), (cx + 8, 4)):
            for y in range(-s, s + 1):
                for x in range(-s, s + 1):
                    if x * x + y * y <= s * s:
                        put(img, tx + x, top - 3 - s + y, P["cloud0"] if x + y > 1 else P["teal"])
            put(img, tx, top - 2, P["cloud0"])
    elif v == 1:    # a hut with a roof
        rect(img, cx - 3, top - 7, cx + 3, top - 2, P["cloud1"])
        for k in range(5):
            draw(img, [(cx - 4 + k, top - 8 - k), (cx + 4 - k, top - 8 - k)], P["cloud0"])
        rect(img, cx - 2, top - 11, cx + 2, top - 9, P["cloud0"])
        put(img, cx, top - 4, P["lamp3"])
    elif v == 2:    # a windmill
        rect(img, cx - 1, top - 12, cx + 1, top - 2, P["cloud1"])
        for k in range(-5, 6):
            put(img, cx + k, top - 12 + k, P["cloud0"])
            put(img, cx + k, top - 12 - k, P["cloud0"])
    else:           # a lighthouse with a lit lamp and a tree
        rect(img, cx - 2, top - 14, cx + 1, top - 2, P["cloud2"])
        for y in (top - 10, top - 6):
            draw(img, [(cx - 2, y), (cx - 1, y), (cx, y), (cx + 1, y)], P["cloud0"])
        rect(img, cx - 2, top - 16, cx + 1, top - 15, P["lamp3"])
        put(img, cx - 1, top - 17, P["cloud0"])
        for y in range(-3, 4):
            for x in range(-3, 4):
                if x * x + y * y <= 9:
                    put(img, cx - 12 + x, top - 5 + y, P["cloud0"] if x + y > 1 else P["teal"])
    return img


# ---------------------------------------------------------------- the Workshop, far below
def below():
    """48x32: the Workshop island seen from the Factory's sky, far down through a gap in the cloud
    sea, hazed: a teal rim round a pale paved plot (the player's own lots, so it is theirs), a dot
    row of town roofs on its north, its cone of rock in haze, two waterfall threads."""
    W, H = 48, 32
    img = new(W, H)
    cx = 24
    # the cone
    for y in range(9, 30):
        t = (y - 9) / 21
        hw = 19 * (1 - t) ** 1.25 + (1 if (y // 3) % 2 else 0) * (1 - t)
        for x in range(W):
            dx = x + 0.5 - cx - t * 2
            if abs(dx) <= hw:
                put(img, x, y, P["cloud0"] if dx < -hw * 0.25 else P["sky1"])
    # the cliff band
    for x in range(cx - 20, cx + 21):
        for y in (9, 10):
            put(img, x, y, P["cloud1"] if x < cx + 6 else P["cloud0"])
    # the top: a rounded rim of teal (grass in haze) round the pale plot
    for y in range(1, 10):
        hw = round(21 * math.sqrt(max(0.0, 1 - ((y - 5.2) / 4.8) ** 2)))
        for x in range(cx - hw, cx + hw):
            put(img, x, y, P["teal"])
    for y in range(3, 8):
        for x in range(cx - 12, cx + 12):
            put(img, x, y, P["pave3"] if y == 3 else P["pave2"])
    for x in range(cx - 12, cx + 12, 8):
        for y in range(3, 8):
            put(img, x, y, P["pave1"])
    for x in range(cx - 14, cx + 14, 3):
        put(img, x, 1, P["copper2"] if (x // 3) % 2 else P["cloud0"])
    put(img, cx - 4, 5, P["steel2"])
    put(img, cx + 3, 4, P["steel2"])
    # waterfall threads
    for fx in (cx - 8, cx + 7):
        for y in range(10, H):
            put(img, fx, y, P["cloud2"] if (y // 2) % 2 else P["sky4"])
    return img


# ---------------------------------------------------------------- a bird
def bird(f):
    """8x8, 4 frames: wings up, level, down, level. ink2 with a steel1 body pixel."""
    img = new(8, 8)
    shapes = [
        [(1, 2), (2, 3), (3, 4), (4, 4), (5, 3), (6, 2)],
        [(0, 4), (1, 3), (2, 3), (3, 4), (4, 4), (5, 3), (6, 3), (7, 4)],
        [(1, 5), (2, 5), (3, 4), (4, 4), (5, 5), (6, 5)],
        [(0, 3), (1, 3), (2, 4), (3, 4), (4, 4), (5, 4), (6, 3), (7, 3)],
    ]
    draw(img, shapes[f], P["ink2"])
    put(img, 3, 4, P["slag0"])
    return img


def build():
    export("sky_cloud", clouds(), bg=P["sky1"], src=True, extra={"sizes": ["big", "big", "medium", "medium", "small", "small"]})
    export("sky_islet", [islet(v) for v in range(4)], bg=P["sky3"], src=True)
    export("sky_below", [below()], bg=P["sky2"], src=True, look_scale=6)
    export("sky_bird", [bird(f) for f in range(4)], fps=8, bg=P["sky3"], look_scale=8, src=True, anchor=(4, 4))
    (OUT / "sky_spec.json").write_text(json.dumps(SPEC, indent=1) + "\n", newline="\n")
    g = gradient(320, 180, "workshop")
    g.save(OUT / "sky_gradient_workshop.png")
    scale(g, 4).save(OUT / "sky_gradient_workshop@4x.png")
    gradient(320, 180, "factory").save(OUT / "sky_gradient_factory.png")


if __name__ == "__main__":
    build()
