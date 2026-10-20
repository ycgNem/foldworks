"""Shared helpers for the revamp style test: palette snap, tileset recolour, Wang terrain painting,
outlines, contact shadows, light pools, hand-drawn belts and 8x8 item icons, the scene layout.

Every direction's build.py imports this and passes its own palette roles, so the three scenes
share one layout and differ only in their art. Deterministic: randomness only from seeded RNGs.
"""
import colorsys
import json
import random
from pathlib import Path

from PIL import Image

CLASSES = []   # terrain class names, shared by every recoloured tileset in one build
ROOT = Path(__file__).resolve().parent
RAW = ROOT / "raw"
T = 16


# --------------------------------------------------------------------------- colour
def rgb(h):
    h = h.lstrip("#")
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


def lum(c):
    r, g, b = c[:3]
    return 0.299 * r + 0.587 * g + 0.114 * b


def dist(a, b):
    # redmean-weighted RGB distance: cheap, and good enough for snapping to a hand-picked palette
    rm = (a[0] + b[0]) / 2
    dr, dg, db = a[0] - b[0], a[1] - b[1], a[2] - b[2]
    return (2 + rm / 256) * dr * dr + 4 * dg * dg + (2 + (255 - rm) / 256) * db * db


def nearest(c, pal):
    return min(pal, key=lambda p: dist(c, p))


def snap(img, pal_hex, alpha=128):
    """Every opaque pixel to the nearest palette colour; alpha hardened to 0/255."""
    pal = [rgb(h) for h in pal_hex]
    img = img.convert("RGBA")
    out = Image.new("RGBA", img.size, (0, 0, 0, 0))
    cache = {}
    px, po = img.load(), out.load()
    for y in range(img.height):
        for x in range(img.width):
            r, g, b, a = px[x, y]
            if a < alpha:
                continue
            k = (r, g, b)
            if k not in cache:
                cache[k] = nearest(k, pal)
            po[x, y] = cache[k] + (255,)
    return out


def hue_group(c):
    r, g, b = [v / 255 for v in c[:3]]
    h, s, v = colorsys.rgb_to_hsv(r, g, b)
    return h * 360, s, v


def remap_by_groups(img, classify, ramps, cuts):
    """Recolour a generated tileset: classify(colour) -> group name; within a group, colours are
    ranked by lightness and the group's pixel mass is split at `cuts[group]` (cumulative shares)
    onto `ramps[group]` (dark to light). So I choose the ramp and how much of each step shows."""
    img = img.convert("RGBA")
    counts = {}
    for n, c in img.getcolors(100000):
        if c[3] < 128:
            continue
        counts[c[:3]] = counts.get(c[:3], 0) + n
    groups = {}
    for c, n in counts.items():
        groups.setdefault(classify(c), []).append((lum(c), c, n))
    mapping = {}
    for g, items in groups.items():
        items.sort()
        total = sum(n for _, _, n in items)
        acc = 0
        ramp = [rgb(h) for h in ramps[g]]
        cut = cuts[g]
        for _, c, n in items:
            mid = (acc + n / 2) / total
            acc += n
            i = sum(1 for t in cut if mid > t)
            mapping[c] = ramp[min(i, len(ramp) - 1)]
    out = img.copy()
    cls = Image.new("RGBA", img.size, (0, 0, 0, 0))   # class id in the red channel, for retexture
    for n in sorted(ramps):
        if n not in CLASSES:
            CLASSES.append(n)
    names = CLASSES
    px, pc = out.load(), cls.load()
    for y in range(out.height):
        for x in range(out.width):
            r, g, b, a = px[x, y]
            if a >= 128:
                px[x, y] = mapping[(r, g, b)] + (255,)
                pc[x, y] = (names.index(classify((r, g, b))) + 1, 0, 0, 255)
            else:
                px[x, y] = (0, 0, 0, 0)
    out.info["classes"] = names
    out.classimg = cls
    return out


# --------------------------------------------------------------------------- texture
def vnoise(w, h, cell, seed):
    """Smooth value noise in 0..1 (bilinear over a seeded lattice), global so tiles never repeat."""
    rng = random.Random(seed)
    gw, gh = w // cell + 2, h // cell + 2
    g = [[rng.random() for _ in range(gw)] for _ in range(gh)]
    out = [[0.0] * w for _ in range(h)]
    for y in range(h):
        fy = y / cell
        y0 = int(fy)
        ty = fy - y0
        ty = ty * ty * (3 - 2 * ty)
        for x in range(w):
            fx = x / cell
            x0 = int(fx)
            tx = fx - x0
            tx = tx * tx * (3 - 2 * tx)
            a = g[y0][x0] * (1 - tx) + g[y0][x0 + 1] * tx
            b = g[y0 + 1][x0] * (1 - tx) + g[y0 + 1][x0 + 1] * tx
            out[y][x] = a * (1 - ty) + b * ty
    return out


BAYER4 = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]]


def retexture(ground, classmap, classes, textures, edge=2, seed=11):
    """Repaint the inside of each terrain class with a hand-built texture (textures[name] is
    fn(x, y, rng) -> hex or None) and keep the generated colours within `edge` px of a class
    border, where PixelLab's bank shading lives. Global coordinates: no 16 px repeat."""
    w, h = ground.size
    cm = classmap.load()
    px = ground.load()
    rng = random.Random(seed)
    for y in range(h):
        for x in range(w):
            c = cm[x, y][0]
            if not c:
                continue
            name = classes[c - 1]
            fn = textures.get(name)
            if not fn:
                continue
            near = False
            for dy in range(-edge, edge + 1):
                for dx in range(-edge, edge + 1):
                    xx, yy = x + dx, y + dy
                    if 0 <= xx < w and 0 <= yy < h and cm[xx, yy][0] != c:
                        near = True
                        break
                if near:
                    break
            if near:
                continue
            col = fn(x, y, rng)
            if col:
                px[x, y] = rgb(col) + (255,)


def ragged_edge(ground, cmap, upper, lower, spill, lip, seed=5, p=0.55):
    """Break a straight class border: the `upper` terrain (grass) spills 1-2 px over `lower`
    (the floor) in little tufts (colours `spill`, dark to light), and the floor just past the
    spill gets a 1 px darker lip `lip` (the bank's shadow)."""
    ui, li = CLASSES.index(upper) + 1, CLASSES.index(lower) + 1
    w, h = ground.size
    cm = cmap.load()
    px = ground.load()
    rng = random.Random(seed)
    edge = []
    for y in range(h):
        for x in range(w):
            if cm[x, y][0] != li:
                continue
            for dx, dy in ((0, -1), (-1, 0), (1, 0), (0, 1)):
                xx, yy = x + dx, y + dy
                if 0 <= xx < w and 0 <= yy < h and cm[xx, yy][0] == ui:
                    edge.append((x, y, dx, dy))
                    break
    grown = set()
    for x, y, dx, dy in edge:
        if rng.random() < p:
            px[x, y] = rgb(spill[rng.randrange(len(spill))]) + (255,)
            grown.add((x, y))
            if rng.random() < 0.4:
                x2, y2 = x - dx, y - dy
                if 0 <= x2 < w and 0 <= y2 < h and cm[x2, y2][0] == li:
                    px[x2, y2] = rgb(spill[-1]) + (255,)
                    grown.add((x2, y2))
    for x, y, dx, dy in edge:
        if dy < 0 or dx != 0:      # the lip falls on the floor below a bank only (light from above)
            for k in (0, 1, 2):
                x2, y2 = x - dx * k, y - dy * k
                if not (0 <= x2 < w and 0 <= y2 < h) or cm[x2, y2][0] != li:
                    break
                if (x2, y2) not in grown:
                    px[x2, y2] = rgb(lip) + (255,)
                    break


def make_texture(kind, ramp, w, h, seed, **k):
    """Texture painters. ramp is dark..light. kinds: 'earth' (blotches + pebbles + specks),
    'grass' (patches + tufts), 'water' (dark body + horizontal ripple dashes + glints),
    'planks' (boards along x with seams and grain), 'flags' (paving slabs with mortar)."""
    big = vnoise(w, h, k.get("cell", 22), seed)
    small = vnoise(w, h, 6, seed + 1)
    rnd = random.Random(seed + 2)
    marks = {}
    if kind in ("earth", "flags", "planks"):
        for _ in range(int(w * h * k.get("pebbles", 0.004))):
            x, y = rnd.randrange(w), rnd.randrange(h)
            marks[(x, y)] = ramp[-1]
            marks[(x, y + 1)] = ramp[0]
        for _ in range(int(w * h * k.get("specks", 0.01))):
            marks[(rnd.randrange(w), rnd.randrange(h))] = ramp[0]
    if kind == "grass":
        for _ in range(int(w * h * k.get("tufts", 0.02))):
            x, y = rnd.randrange(w), rnd.randrange(h)
            marks[(x, y)] = ramp[-1]
            marks[(x - 1, y + 1)] = ramp[-2] if len(ramp) > 2 else ramp[-1]
            marks[(x + 1, y + 1)] = ramp[-2] if len(ramp) > 2 else ramp[-1]
            marks[(x, y + 2)] = ramp[0]
    if kind == "water":
        for _ in range(int(w * h * k.get("ripples", 0.006))):
            x, y = rnd.randrange(w), rnd.randrange(h)
            n = rnd.randint(2, 5)
            for i in range(n):
                marks[(x + i, y)] = ramp[2] if i in (1, 2) and n > 3 else ramp[1]
        for _ in range(int(w * h * k.get("glints", 0.0008))):
            marks[(rnd.randrange(w), rnd.randrange(h))] = ramp[-1]
    base = k.get("base", 1)

    def fn(x, y, rng):
        if (x, y) in marks:
            return marks[(x, y)]
        if not (0 <= x < w and 0 <= y < h):
            return None
        v = big[y][x] * 0.7 + small[y][x] * 0.3
        t = (BAYER4[y % 4][x % 4] + 0.5) / 16
        if kind == "planks":
            board = k.get("board", 4)
            run = k.get("run", 24)
            row = y // board
            off = (row * 11) % run
            if y % board == board - 1:
                return ramp[0]                          # the gap between boards
            if (x + off) % run == 0:
                return ramp[0]                          # board ends
            if y % board == 0 and (x // 7 + row) % k.get("edge_every", 1) == 0:
                return ramp[min(base + 1, len(ramp) - 1)]   # lit board edge, broken up
            seg = random.Random(row * 7919 + (x + off) // run * 104729 + seed).random()
            if seg < k.get("dark_boards", 0.0):      # whole boards a shade darker: old timber
                return ramp[max(base - 1, 0)] if (x + y) % 2 or seg < 0.06 else ramp[base]
            if v + (t - 0.5) * 0.25 < k.get("lo", 0.3):
                return ramp[max(base - 1, 0)]
            return ramp[base]
        if kind == "flags":
            sw, sh = k.get("slab", (8, 6))
            row = y // sh
            off = (row % 2) * (sw // 2)
            if y % sh == sh - 1 or (x + off) % sw == sw - 1:
                return ramp[max(base - 1, 0)]           # mortar
            if y % sh == 0 and (x + off) % sw > 1:
                return ramp[min(base + 1, len(ramp) - 1)]
        if kind == "water":
            if v + (t - 0.5) * 0.3 > k.get("hi", 0.8):
                return ramp[1]
            return ramp[0]
        lo, hi = k.get("lo", 0.3), k.get("hi", 0.72)
        d = (t - 0.5) * k.get("dith", 0.08)
        if v + d < lo:
            return ramp[max(base - 1, 0)]
        if v + d > hi:
            return ramp[min(base + 1, len(ramp) - 1)]
        return ramp[base]
    return fn


# --------------------------------------------------------------------------- Wang terrain
def load_wang(name, img=None):
    """{(NW, NE, SW, SE) as 0 lower / 1 upper: tile image} from a PixelLab topdown tileset."""
    meta = json.loads((RAW / f"{name}.json").read_text())
    img = img if img is not None else Image.open(RAW / f"{name}.png").convert("RGBA")
    tiles = {}
    for t in meta["tileset_data"]["tiles"]:
        b = t["bounding_box"]
        key = tuple(1 if t["corners"][k] == "upper" else 0 for k in ("NW", "NE", "SW", "SE"))
        tiles[key] = img.crop((b["x"], b["y"], b["x"] + b["width"], b["y"] + b["height"]))
    return tiles


def paint_terrain(vmap, sets, seed=1, flips=None):
    """vmap: (H+1) rows of (W+1) vertex levels. sets: {(lo, hi): wang dict}. A tile whose four
    corners are all one level uses that level's plain tile, flipped at random (flips[level] =
    'xy', 'x', 'y' or '') so a big floor doesn't show a 16 px repeat."""
    H, W = len(vmap) - 1, len(vmap[0]) - 1
    out = Image.new("RGBA", (W * T, H * T))
    rng = random.Random(seed)
    flips = flips or {}
    for ty in range(H):
        for tx in range(W):
            c = (vmap[ty][tx], vmap[ty][tx + 1], vmap[ty + 1][tx], vmap[ty + 1][tx + 1])
            lo, hi = min(c), max(c)
            if lo == hi:
                key = next(k for k in sets if hi in k)
                wang = sets[key]
                tile = wang[(1, 1, 1, 1)] if hi == key[1] else wang[(0, 0, 0, 0)]
                f = flips.get(hi, "")
                if "x" in f and rng.random() < 0.5:
                    tile = tile.transpose(Image.FLIP_LEFT_RIGHT)
                if "y" in f and rng.random() < 0.5:
                    tile = tile.transpose(Image.FLIP_TOP_BOTTOM)
            else:
                wang = sets[(lo, hi)]
                tile = wang[tuple(1 if v == hi else 0 for v in c)]
            out.alpha_composite(tile, (tx * T, ty * T))
    return out


# --------------------------------------------------------------------------- sprite ops
def outline(img, col, diag=False):
    """1 px outline outside the opaque shape."""
    img = img.convert("RGBA")
    w, h = img.size
    out = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    a = img.load()
    o = out.load()
    nb = [(-1, 0), (1, 0), (0, -1), (0, 1)] + ([(-1, -1), (1, -1), (-1, 1), (1, 1)] if diag else [])
    c = rgb(col) + (255,)
    for y in range(h):
        for x in range(w):
            if a[x, y][3]:
                continue
            for dx, dy in nb:
                xx, yy = x + dx, y + dy
                if 0 <= xx < w and 0 <= yy < h and a[xx, yy][3]:
                    o[x, y] = c
                    break
    out.alpha_composite(img)
    return out


def crop_alpha(img):
    bb = img.getbbox()
    return img.crop(bb) if bb else img


def recolor(img, mapping):
    """Exact colour swaps {'#src': '#dst'}."""
    m = {rgb(k): rgb(v) for k, v in mapping.items()}
    out = img.copy()
    px = out.load()
    for y in range(out.height):
        for x in range(out.width):
            p = px[x, y]
            if p[3] and p[:3] in m:
                px[x, y] = m[p[:3]] + (255,)
    return out


def darken_map(pal_hex, amount=0.38, tint="#20183a"):
    """For each palette colour, the palette colour nearest to it pulled toward a cool shadow tint
    (never itself unless nothing darker exists): what a contact shadow turns it into."""
    pal = [rgb(h) for h in pal_hex]
    t = rgb(tint)
    m = {}
    for c in pal:
        target = tuple(int(c[i] + (t[i] - c[i]) * amount) for i in range(3))
        cands = [p for p in pal if lum(p) < lum(c) - 4] or [c]
        m[c] = nearest(target, cands)
    return m


def lighten_map(pal_hex, light, amount=0.35):
    pal = [rgb(h) for h in pal_hex]
    t = rgb(light)
    m = {}
    for c in pal:
        target = tuple(int(c[i] + (t[i] - c[i]) * amount) for i in range(3))
        cands = [p for p in pal if lum(p) > lum(c) + 4] or [c]
        m[c] = nearest(target, cands)
    return m


def apply_map(canvas, pixels, cmap):
    px = canvas.load()
    for x, y in pixels:
        if 0 <= x < canvas.width and 0 <= y < canvas.height:
            p = px[x, y]
            if p[3]:
                px[x, y] = cmap.get(p[:3], p[:3]) + (255,)


def shadow_pixels(sprite, x, y, dx=1, dy=1, grow=0):
    """The ground pixels a sprite's contact shadow covers: its silhouette moved down-right."""
    a = sprite.load()
    pts = set()
    for sy in range(sprite.height):
        for sx in range(sprite.width):
            if a[sx, sy][3]:
                for gx in range(0, dx + 1):
                    for gy in range(0, dy + 1):
                        pts.add((x + sx + gx, y + sy + gy))
    return pts


def ellipse_pixels(cx, cy, rx, ry, dither=False):
    pts = set()
    for y in range(int(cy - ry), int(cy + ry) + 1):
        for x in range(int(cx - rx), int(cx + rx) + 1):
            d = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2
            if d <= 1 and (not dither or d < 0.55 or (x + y) % 2 == 0):
                pts.add((x, y))
    return pts


def place(canvas, sprite, x, y, shadow=None, sdx=1, sdy=1):
    if shadow is not None:
        pts = shadow_pixels(sprite, x, y, sdx, sdy)
        apply_map(canvas, pts, shadow)
    canvas.alpha_composite(sprite, (x, y))


def frame(name, i):
    return Image.open(RAW / name / f"frame_{i}.png").convert("RGBA")


def scale(img, k):
    return img.resize((img.width * k, img.height * k), Image.NEAREST)


def on_bg(img, bg):
    out = Image.new("RGBA", img.size, rgb(bg) + (255,))
    out.alpha_composite(img)
    return out


# --------------------------------------------------------------------------- hand-drawn parts
def draw(img, pts, col):
    px = img.load()
    c = rgb(col) + (255,)
    for x, y in pts:
        if 0 <= x < img.width and 0 <= y < img.height:
            px[x, y] = c


def from_rows(rows, key):
    """Pixel map from text rows; key maps a character to a colour ('.' = clear)."""
    h, w = len(rows), len(rows[0])
    img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    px = img.load()
    for y, row in enumerate(rows):
        for x, ch in enumerate(row):
            if ch in key and key[ch]:
                px[x, y] = rgb(key[ch]) + (255,)
    return img


# 8x8 item icons, same drawings in every direction; the key letters are roles:
# o outline, 0 dark, 1 mid, 2 light, 3 highlight
ICONS = {
    "iron_ore": [   # lumps: three rounded rocks, one dark seam
        "..ooo...",
        ".o122o..",
        "o12210oo",
        "o1100o2o",
        ".o00o121",
        "o1210110",
        "o01100o.",
        ".oooooo.",
    ],
    "iron_ingot": [  # a slanted bar: lit top face, dark front face
        "........",
        "....ooo.",
        "..oo332o",
        "oo22221o",
        "o112210o",
        "o00110o.",
        ".oo00o..",
        "...oo...",
    ],
    "gear": [       # teeth and a hole
        "..o..o..",
        ".o2oo2o.",
        "o221112o",
        ".21oo10.",
        ".21oo10.",
        "o210000o",
        ".o0oo0o.",
        "..o..o..",
    ],
}


def icon(name, ink, ramp4):
    key = {"o": ink, "0": ramp4[0], "1": ramp4[1], "2": ramp4[2], "3": ramp4[3]}
    return from_rows(ICONS[name], key)


def module_with(module, icon_img, well, paper_dark, paper_light, ink):
    """A module tile: the PixelLab brass frame, a dark well with the output icon, and the fold
    seam as a dog-eared bottom-left corner (the top-right stays calm for the status pip)."""
    m = module.copy()
    m.alpha_composite(Image.new("RGBA", (10, 10), rgb(well) + (255,)), (3, 3))
    m.alpha_composite(icon_img, (4, 4))
    draw(m, [(1, 12), (1, 13), (2, 13), (1, 14), (2, 14), (3, 14)], paper_dark)
    draw(m, [(2, 12), (3, 13), (4, 14)], paper_light)
    draw(m, [(0, 12), (0, 13), (0, 14), (0, 15), (1, 15), (2, 15), (3, 15), (4, 15)], ink)
    return m


def hat_lift(img, crown_row, n):
    """Make a bowler a top hat: repeat the crown's row `crown_row` n more times, pushing the
    portrait below it down n px (the bust's bottom rows fall off the frame, as on a card)."""
    w, h = img.size
    out = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    out.paste(img.crop((0, 0, w, crown_row + 1)), (0, 0))
    row = img.crop((0, crown_row, w, crown_row + 1))
    for i in range(1, n + 1):
        out.paste(row, (0, crown_row + i))
    out.paste(img.crop((0, crown_row + 1, w, h - n)), (0, crown_row + n + 1))
    return out


def module_tile(brass, well, ink, icon_img, paper_dark, paper_light):
    """A hand-drawn module (the PixelLab frames were too thin to beat a machine at 1x): a bold
    2 px brass band lit from the top-left, rivets on three corners (the top-right stays calm for
    the pip), a deep well with the output icon, and the fold seam as a dog-eared bottom-left."""
    b0, b1, b2, b3 = brass
    m = Image.new("RGBA", (T, T), (0, 0, 0, 0))
    for y in range(T):
        for x in range(T):
            ring = min(x, y, 15 - x, 15 - y)
            far = (x == 15 - ring) or (y == 15 - ring)     # bottom or right side of that ring
            if ring == 0:
                c = ink
            elif ring == 1:
                c = b0 if far else b3
            elif ring == 2:
                c = b1 if far else b2
            else:
                c = well
            draw(m, [(x, y)], c)
    draw(m, [(3, y) for y in range(3, 13)] + [(x, 3) for x in range(3, 13)], ink)   # well's lip shadow
    for rx, ry in ((2, 2), (2, 13), (13, 13)):
        draw(m, [(rx, ry)], b3 if (rx, ry) == (2, 2) else b0)
    m.alpha_composite(icon_img, (4, 4))
    draw(m, [(1, 12), (1, 13), (2, 13), (1, 14), (2, 14), (3, 14)], paper_dark)
    draw(m, [(2, 12), (3, 13), (4, 14)], paper_light)
    draw(m, [(0, 12), (0, 13), (0, 14), (0, 15), (1, 15), (2, 15), (3, 15), (4, 15)], ink)
    return m


def belt_tile(roles, phase=0):
    """A 16x16 belt running right: rails top and bottom, a dark tread with slats every 4 px that
    move with `phase`, and a chevron hint so the direction reads when it is empty."""
    ink, rail0, rail1, rail2 = roles["ink"], roles["rail0"], roles["rail1"], roles["rail2"]
    tread0, tread1 = roles["tread0"], roles["tread1"]
    img = Image.new("RGBA", (T, T), (0, 0, 0, 0))
    for x in range(T):
        draw(img, [(x, 2)], ink)
        draw(img, [(x, 3)], rail2)
        draw(img, [(x, 4)], rail1)
        for y in range(5, 12):
            draw(img, [(x, y)], tread0)
        draw(img, [(x, 12)], rail1)
        draw(img, [(x, 13)], rail0)
        draw(img, [(x, 14)], ink)
    for k in range(4):
        sx = (k * 4 + phase) % T
        for y in range(5, 12):
            draw(img, [(sx, y)], tread1)
    # rail bolts every 8 px
    for bx in (3, 11):
        draw(img, [((bx + phase) % T, 3)], rail0)
        draw(img, [((bx + phase) % T, 13)], rail2)
    return img


# --------------------------------------------------------------------------- the mock scene
W_T, H_T = 24, 14          # tiles
SHORE = [3, 3, 3, 3, 3, 3, 3, 3, 3, 4, 4, 4, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3]
UNOWNED_X = 19             # tiles x >= this are land you don't own yet

# the line: ore patch -> miner -> belt -> smelter -> belt -> Dock; a module feeding gears up
ORE_PATCH = (2, 7, 2, 2)   # tile x, y, w, h (the miner stands on its lower-right tile)
MINER = (3, 8)
BELT1 = [(4, 8), (5, 8), (6, 8), (7, 8)]
SMELTER = (8, 8)
BELT2 = [(9, 8), (10, 8), (11, 8), (12, 8)]
DOCK = (13, 7)             # 2x2
BELT_UP = [(13, 10), (13, 9)]
MODULE_GEAR = (13, 11)
MODULE_IDLE = (6, 11)
ITEMS = [("iron_ore", 4, 8, 1), ("iron_ore", 6, 8, -2), ("iron_ingot", 9, 8, 3), ("iron_ingot", 11, 8, 0),
         ("gear", 13, 10, 0)]


def vertex_map():
    H, W = H_T + 1, W_T + 1
    f = [max(SHORE[max(0, x - 1)], SHORE[x], SHORE[min(W - 1, x + 1)]) + 2 for x in range(W)]
    vm = []
    for vy in range(H):
        row = []
        for vx in range(W):
            if vy <= SHORE[vx]:
                row.append(0)
            elif vy >= f[vx] and vx >= 1:
                row.append(2)
            else:
                row.append(1)
        vm.append(row)
    return vm


def ore_patch(roles, w, h, seed=3):
    """Ore lumps pressed into the ground: dark pockets, lit tops toward the top-left, a few glints.
    Hand-placed on a jittered grid so the patch reads as one deposit, not as scattered pebbles."""
    img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    rng = random.Random(seed)
    pocket, d0, d1, d2, d3 = roles["pocket"], roles["ore0"], roles["ore1"], roles["ore2"], roles["ore3"]
    spots = []
    for gy in range(4, h - 4, 7):
        for gx in range(4 + (gy // 7 % 2) * 3, w - 4, 7):
            spots.append((gx + rng.randint(-1, 1), gy + rng.randint(-1, 1), rng.choice([2, 2, 3])))
    cx0, cy0 = w / 2, h / 2
    spots = [s for s in spots if ((s[0] - cx0) / (w / 2)) ** 2 + ((s[1] - cy0) / (h / 2)) ** 2 < 0.95]
    for x, y, r in spots:          # pockets first (the shadow round each lump)
        draw(img, ellipse_pixels(x + 0.5, y + 1, r + 0.9, r * 0.8 + 0.9), pocket)
    for x, y, r in spots:
        body = ellipse_pixels(x, y, r + 0.4, r * 0.8 + 0.3)
        draw(img, body, d1)
        draw(img, [(px, py) for px, py in body if (px - x) + (py - y) >= r - 0.5], d0)
        draw(img, [(px, py) for px, py in body if (px - x) + (py - y) <= -r + 1], d2)
        draw(img, [(x - 1, y - 1)], d3)
    return img


def compose(spec):
    """Build the 384x224 Workshop mock scene from a direction's parts. Ground first, then light
    pools, then contact shadows and standing sprites, back to front."""
    vm = vertex_map()
    w01, w12 = spec["tileset01"], spec["tileset12"]
    ground = paint_terrain(vm, {(0, 1): load_wang(w01[0], w01[1]), (1, 2): load_wang(w12[0], w12[1])},
                           seed=7, flips=spec.get("flips"))
    cmap = paint_terrain(vm, {(0, 1): load_wang(w01[0], w01[1].classimg),
                              (1, 2): load_wang(w12[0], w12[1].classimg)}, seed=7, flips=spec.get("flips"))
    if spec.get("textures"):
        tex = {n: make_texture(*a, ground.width, ground.height, **kw)
               for n, (a, kw) in spec["textures"].items()}
        retexture(ground, cmap, CLASSES, tex, edge=spec.get("tex_edge", 2))
    for args in spec.get("ragged", []):
        ragged_edge(ground, cmap, *args)
    S, L = spec["shadow"], spec.get("light")
    sdx, sdy = spec.get("sdx", 1), spec.get("sdy", 1)

    # unowned land: the same floor one step darker, a sparse diagonal hatch, a dashed edge
    px0 = UNOWNED_X * T
    pts = []
    for y in range(ground.height):
        for x in range(px0, ground.width):
            tx, ty = x // T, y // T
            if ty >= 6 and all(vm[ty + a][tx + b] == 2 for a in (0, 1) for b in (0, 1)):
                pts.append((x, y))
    for _ in range(spec.get("unowned_steps", 1)):
        apply_map(ground, pts, S)
    apply_map(ground, [(x, y) for x, y in pts if (x + y) % 8 == 0], S)
    ymin = min(y for _, y in pts) if pts else 0
    draw(ground, [(px0, y) for y in range(ymin, ground.height) if (y // 2) % 2 == 0], spec["edge"])

    for name, x, y in spec.get("decor", []):       # lily pads, reeds, stones: flat, no shadow
        ground.alpha_composite(spec["sprites"][name], (x, y))
    if spec.get("ripple_col"):                      # rings round the feet of anything in the water
        for name, x, y in spec.get("standing_back", []):
            if not name.startswith("house"):
                continue
            bb = spec["sprites"][name].getbbox()
            fy = y + bb[3]
            draw(ground, [(x + i, fy) for i in range(bb[0] - 2, bb[2] + 2) if i % 4 != 1], spec["ripple_col"])
            draw(ground, [(x + i, fy + 2) for i in range(bb[0] + 1, bb[2] - 1) if i % 5 in (0, 1)],
                 spec["ripple_col"])
    for x, y, n, c1, c2 in spec.get("streaks", []):  # a light's broken reflection on the water
        for i in range(n):
            if i % 2 == 0:
                w2 = 2 if i < n // 2 else 1
                draw(ground, [(x + j - w2 // 2, y + i) for j in range(w2)], c1 if i < n // 2 else c2)

    op = ore_patch(spec["ore_roles"], ORE_PATCH[2] * T - 2, ORE_PATCH[3] * T - 2)
    ground.alpha_composite(op, (ORE_PATCH[0] * T + 1, ORE_PATCH[1] * T + 1))

    for (lx, ly, rx, ry) in spec.get("light_pools", []):
        if L:
            apply_map(ground, ellipse_pixels(lx, ly, rx, ry, dither=True), L)
            apply_map(ground, ellipse_pixels(lx, ly, rx * 0.55, ry * 0.55), L)

    canvas = ground
    belt = spec["belt"]
    for (bx, by) in BELT1 + BELT2:
        place(canvas, belt, bx * T, by * T)
    up = belt.rotate(90)
    for (bx, by) in BELT_UP:
        place(canvas, up, bx * T, by * T)

    sp = spec["sprites"]
    for name, x, y in spec.get("standing_back", []):   # houses, lamps, in feet order
        place(canvas, sp[name], x, y, S, sdx, sdy)
    place(canvas, sp["dock"], DOCK[0] * T, DOCK[1] * T, S, sdx, sdy)
    place(canvas, sp["miner"], MINER[0] * T, MINER[1] * T, S, sdx, sdy)
    place(canvas, sp["smelter"], SMELTER[0] * T, SMELTER[1] * T, S, sdx, sdy)
    place(canvas, sp["module_gear"], MODULE_GEAR[0] * T, MODULE_GEAR[1] * T, S, sdx, sdy)
    place(canvas, sp["module_idle"], MODULE_IDLE[0] * T, MODULE_IDLE[1] * T, S, sdx, sdy)
    for name, tx, ty, off in ITEMS:
        ic = sp[name]
        if (tx, ty) in BELT_UP:
            canvas.alpha_composite(ic, (tx * T + 4, ty * T + 4 + off))
        else:
            canvas.alpha_composite(ic, (tx * T + 4 + off, ty * T + 4))
    for name, x, y in spec.get("standing_front", []):
        place(canvas, sp[name], x, y, S, sdx, sdy)
    return canvas


def parts_sheet(items, bg, sc=4, pad=4):
    """Every part side by side at 1x and at `sc`x on the direction's background."""
    w = sum(i.width for i in items) + pad * (len(items) + 1)
    h = max(i.height for i in items) + pad * 2
    one = Image.new("RGBA", (w, h), rgb(bg) + (255,))
    x = pad
    for i in items:
        one.alpha_composite(i, (x, pad + (h - 2 * pad - i.height)))
        x += i.width + pad
    return one, scale(one, sc)
