"""title_scene: the title screen's key art for the sky island (docs/sky-island.md), 320x180 x8 at
8 fps. The game draws it at the smallest whole-number scale that covers the screen, centred and
cropped (src/app/hud.ts drawTitleScene); at 1024x640 only scene x 32..288, y 10..170 shows, so
everything that matters sits inside that.

Composition (scene px): a morning sky (sky.py's gradient, the sun's glow top-left) with the logo
(y 14..54) and the tagline ribbon (y 56..64) on its calm band; the buttons (x 125..195 from y 104)
on open sky between two islands; the last line's slip on the cloud sea along the bottom.
- the Workshop island at the left: the grass rim, a paved plot with the working line in an L (a
  miner on the iron outcrop, a furnace, a belt turning south into the Dock, ingots riding it), a
  brass module with an ingot in its well beside it (the line folded: the tagline's promise), a
  frog worker, trees and bushes on the rim, its cliff with ore veins, two waterfalls off its lip,
  its tiered underside sinking into the cloud sea;
- the town's island at the right: Mayor Bramble out on the open grass raising his top hat (it
  goes up against the sky), his house and a gable house re-seated on stone footings, the town's
  red pennant, a townsperson, a waterfall, the cliff, the tiered underside and its rocky tip;
- a hazed windmill islet on the horizon under the buttons (off their axis), puffs in the
  corners, a flock of birds over the gap, the horizon warmed to the sun's colour (morning).
Nothing tall stands under the logo or the ribbon (x 50..270 above y 66): trees only at x < 50.

Motion (8 frames, a 1 s loop): the waterfalls run (isle_fall's 4-frame loop twice) and foam
where they meet the clouds, the belt turn runs and two ingots ride it into the Dock, the miner
drills, the furnace's mouth flickers, the module's band breathes, the pennant waves, the birds
flap and bob, the front puffs of the cloud sea breathe a pixel, the frog worker steps, Bramble
blinks and raises his hat. Nothing drifts across the frame (it could not loop in 8 frames).

Pieces: pixel-art/sky/ (the island's cliff and underside textures, the tip, the falls and foam,
the grass and paving tiles, deco, trees and bushes, clouds, islets, the bird, the gradient) and
src/art/ (the miner, furnace, belt turn, Dock, module, ingot, iron outcrop on paving, town houses,
frog). Bramble's whole figure, the pennant and the islands' shapes are drawn here (the game's
island is tile-built and too big for 320x180; this one follows its rules per pixel column: lip,
cliff, tiers, tip, one ink outline). Run `python build.py` from this folder: it writes
src/art/title_scene.png + .json and the looks in out/ (frame 0 at 1x and 4x, frame 5 at 4x, a
GIF, the motion sheets, Bramble at 10x, the 1024x640 crop). `node shot.mjs` (with BASE set to a
dev server) shoots the real title with a save at the three window sizes into out/game-*.png.
"""
import json
import math
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent / "sky"))

from PIL import Image  # noqa: E402

from common import P, T, new, draw, put, rgb, hsh, vnoise, scale, frame_of, ART_SET, sheet, bayer  # noqa: E402
import island  # noqa: E402
import sky  # noqa: E402
import props  # noqa: E402
import ground  # noqa: E402

OUT = HERE / "out"
OUT.mkdir(exist_ok=True)
SRC_ART = HERE.parents[1] / "src" / "art"
W, H, N = 320, 180, 8
SEA = 162          # the cloud sea's top row (puffs rise a little above it)


def C(name):
    return rgb(P[name]) + (255,)


# ---------------------------------------------------------------- sprites from src/art
def art(name, i=0, row=0):
    return frame_of(name, i, row)


def named(name, key):
    meta = json.loads((SRC_ART / f"{name}.json").read_text())
    return frame_of(name, (meta.get("order") or meta.get("names")).index(key))


WATER = {rgb(P[k]) for k in ("water0", "water1", "water2", "water3", "water4")}


def reseat(img):
    """A town sprite off its bayou: the water-line rows dropped, each stilt foot on a little stone
    footing (pave1 lit pave3, ink under), a grass1 shadow down-right on the meadow."""
    img = img.copy()
    px = img.load()
    w, h = img.size
    for y in range(h):
        for x in range(w):
            if px[x, y][3] and px[x, y][:3] in WATER:
                px[x, y] = (0, 0, 0, 0)
    # the lowest opaque row: put a footing under every run of it
    bottom = max((y for y in range(h) for x in range(w) if px[x, y][3]), default=h - 1)
    out = new(w, h + 2)
    out.alpha_composite(img)
    runs, run = [], []
    for x in range(w):
        if px[x, bottom][3]:
            run.append(x)
        elif run:
            runs.append(run)
            run = []
    if run:
        runs.append(run)
    for r in runs:
        a, b = r[0] - 1, r[-1] + 1
        for x in range(a, b + 1):
            put(out, x, bottom + 1, P["pave3"] if x == a else P["pave1"])
            put(out, x, bottom + 2, P["ink"])
        put(out, a - 1, bottom + 1, P["ink"])
        put(out, b + 1, bottom + 1, P["ink"])
    return out


# ---------------------------------------------------------------- Bramble, the whole frog
BRAMBLE = [
    "........kkkk........",
    ".......khHhhk.......",
    ".......khHhhk.......",
    ".......khhhhk.......",
    "..kkk..koyook..kkk..",
    ".kwwwkkkkkkkkkkwwwk.",
    ".kweekGGGGGGGGkeewk.",
    ".kweekGGGGGGGGkeewk.",
    ".kGwwGGGGGGGGGGwwGk.",
    "kGGGGGGGGGGGGGGGGGgk",
    "kGGGGGGGGGGGGGGGGGgk",
    "kgGkGGGGGGGGGGGGkGgk",
    "kggGkkkkkkkkkkkkGggk",
    ".kggggggggggggggggk.",
    "..kkwwwwwwwwwwwwkk..",
    "..kCskwwwwwwwwwkcck.",
    ".kCCCsSCCwwCCCCccck.",
    ".kCCCCsSCCCCCCCccck.",
    "kgkCCCCsSCCCyCCcckgk",
    "kgkCCCCCsSCyYyCcckgk",
    ".k.kCCCCCsSCyCccck.k",
    "...kcccccccSScccck..",
    "...kkmgkkkkkkmgkk...",
    "...kmggk....kmggk...",
    "...kkkkk....kkkkk...",
]
BKEY = {"k": P["ink"], "h": P["steel0"], "H": P["steel1"], "o": P["copper2"], "y": P["lamp2"],
        "Y": P["lamp3"], "G": P["moss5"], "g": P["moss4"], "m": P["moss3"], "w": P["bone"],
        "e": P["ink"], "C": P["iron1"], "c": P["iron0"], "s": P["copper2"], "S": P["copper1"]}


def from_rows(rows, key):
    img = new(len(rows[0]), len(rows))
    for y, row in enumerate(rows):
        for x, ch in enumerate(row):
            if ch in key:
                put(img, x, y, key[ch])
    return img


def bramble(f):
    """Bramble standing, 24x32 (his feet on row 30): big domed eyes, his small top hat, the blue
    coat with the copper sash and the gold medal. Frame 2 blinks; frames 4-6 he lifts the hat off
    his head and holds it up at his side, his arm straight up in its sleeve (the hat 4 px up, 5 at
    the top of the gesture), so the greeting reads at 1x against the sky."""
    rows = [list(r) for r in BRAMBLE]
    if f == 2:                                   # blink: the lids come down
        for x in (2, 3, 4, 15, 16, 17):
            rows[5][x] = rows[6][x] = "g"
            rows[7][x] = "k"
    img = new(24, 32)
    if f not in (4, 5, 6):
        img.alpha_composite(from_rows(["".join(r) for r in rows], BKEY), (0, 6))
        return img
    lift = 5 if f == 5 else 4
    hat = from_rows([r[6:14] for r in BRAMBLE[:5]] + ["kkkkkkkk"], BKEY)
    rows[4] = list("..kkk..........kkk..")               # the head, bare (row 5 is its crown)
    for y in (18, 19, 20):                               # the hand leaves his side
        rows[y][18] = rows[y][19] = "."
        rows[y][17] = "k"
    img.alpha_composite(from_rows(["".join(r) for r in rows[4:]], BKEY), (0, 10))
    brim = 11 - lift
    img.alpha_composite(hat, (13, brim - 5))
    arm = {}
    for y in range(brim + 1, 23):                        # the sleeve, wrist to shoulder
        arm[(20, y)] = "C"
        arm[(21, y)] = "c"
    for (x, y) in ((20, brim - 1), (21, brim - 1), (20, brim), (21, brim)):
        arm[(x, y)] = "g"                                # the hand on the brim
    arm[(20, brim - 1)] = "G"
    for (x, y), ch in arm.items():
        put(img, x, y, BKEY[ch])
    for (x, y) in list(arm):
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            q = (x + dx, y + dy)
            if q not in arm and 0 <= q[0] < 24 and 0 <= q[1] < 32 and not img.getpixel(q)[3]:
                put(img, q[0], q[1], P["ink"])
    return img


# ---------------------------------------------------------------- the town flag
def flag(f):
    """16x28: a brass-capped pole, the town's red pennant with a gold coin, waving (4 frames)."""
    img = new(16, 28)
    for y in range(3, 28):
        put(img, 1, y, P["wood4"])
        put(img, 2, y, P["wood2"])
    draw(img, [(0, 3 + k) for k in range(25)] + [(3, 3 + k) for k in range(25)], P["ink"])
    draw(img, [(1, 1), (2, 1), (1, 2), (2, 2)], P["brass2"])
    put(img, 1, 1, P["brass3"])
    draw(img, [(0, 1), (0, 2), (3, 1), (3, 2), (1, 0), (2, 0)], P["ink"])
    ph = [0, 1, 2, 1][f % 4]
    pts = {}
    for x in range(4, 15):
        k = x - 4
        wave = round(math.sin((k - ph * 2) * 0.7) * 1.2)
        hgt = 8 - (k * 4) // 11
        y0 = 3 + (8 - hgt) // 2 + wave
        for y in range(y0, y0 + hgt):
            pts[(x, y)] = P["copper2"] if (y - y0) < 2 else P["copper1"] if (y - y0) < hgt - 2 else P["copper0"]
            if (k - ph * 2) % 6 in (0, 1) and (y - y0) >= 2:
                pts[(x, y)] = P["copper0"]
    for (x, y), c in pts.items():
        put(img, x, y, c)
    # the coin on the pennant
    cy = 3 + 3 + round(math.sin((3 - ph * 2) * 0.7) * 1.2)
    draw(img, [(7, cy), (8, cy), (7, cy + 1), (8, cy + 1)], P["lamp2"])
    put(img, 7, cy, P["lamp3"])
    # outline the cloth
    cloth = set(pts) | {(7, cy), (8, cy), (7, cy + 1), (8, cy + 1)}
    for (x, y) in list(cloth):
        for dx, dy in ((1, 0), (0, 1), (0, -1)):
            q = (x + dx, y + dy)
            if q not in cloth and q[0] > 3:
                put(img, q[0], q[1], P["ink"])
    return img


# ---------------------------------------------------------------- an island
class Isle:
    """A floating island drawn per pixel column: a rounded top surface (superellipse, wobbly
    edges), the south cliff hanging `ch` px from each column's front edge (pixel-art/sky's cliff
    texture: the lip row, then the low row), the underside tapering to the rocky tip, one ink
    outline round the body. ground(x, y) picks each top pixel's colour; `flats` are front-edge
    runs held level for a waterfall's spring tile."""

    def __init__(self, cx, cy, hw, hd, p=4.0, ch=20, ud=22, seed=0, flats=(), tip=True):
        self.cx, self.cy, self.hw, self.hd, self.ch, self.ud = cx, cy, hw, hd, ch, ud
        nb, nf = vnoise(seed, 9), vnoise(seed + 5, 7)
        self.back, self.front = {}, {}
        for x in range(math.floor(cx - hw), math.ceil(cx + hw) + 1):
            t = (x + 0.5 - cx) / hw
            if abs(t) >= 1:
                continue
            dy = hd * (1 - abs(t) ** p) ** (1 / p)
            if dy < 1.5:
                continue
            self.back[x] = round(cy - dy + (nb(x, 0) - 0.5) * 3)
            self.front[x] = round(cy + dy * 0.98 + (nf(x, 0) - 0.5) * 2)
        for (a, b) in flats:
            v = max(self.front[x] for x in range(a, b + 1))
            for x in range(a, b + 1):
                self.front[x] = v
        self.xs = sorted(self.back)
        self.tip = tip
        self.seed = seed

    def top_mask(self):
        return {(x, y) for x in self.xs for y in range(self.back[x], self.front[x] + 1)}

    def under_depth(self):
        """Per column: the underside's depth below the cliff, ud in the middle 32 px (where the
        tip hangs), tapering to 2 at the ends, monotone towards the middle."""
        d = {}
        tw = 7          # tiers: columns step in groups, like the game's tile tiers but finer
        for x in self.xs:
            k = math.floor((x + 0.5 - self.cx) / tw + 0.5)       # the tier, 0 under the middle
            u = min(1.0, max(0.0, (abs(k) * tw - 10) / (self.hw - 10)))
            lump = (hsh(self.seed, k) % 3) - 1
            d[x] = max(2, 3 * round((self.ud * (1 - u) ** 0.9) / 3) + lump)
        left = [x for x in self.xs if x + 0.5 <= self.cx]
        right = [x for x in reversed(self.xs) if x + 0.5 > self.cx]
        for side in (left, right):
            for a, b in zip(side, side[1:]):
                d[b] = max(d[b], d[a])
        return d

    def body(self, ground_at):
        img = new(W, H)
        mask = self.top_mask()
        tex = island.cliff_texture()
        utex = island.utexture()
        ud = self.under_depth()
        rock = set()
        # cliff and underside, per pixel column
        for x in self.xs:
            if not 0 <= x < W:
                continue
            f = self.front[x]
            tx = x % island.CW
            for k in range(self.ch):
                left = self.ch - k
                sy = k if k < 16 else (32 + 16 - left)
                put(img, x, f + 1 + k, tex.getpixel((tx, sy)))
                rock.add((x, f + 1 + k))
            u0 = f + 1 + self.ch
            for k in range(ud[x]):
                put(img, x, u0 + k, utex.getpixel((tx, k % 16)))
                rock.add((x, u0 + k))
            # bounce light from the cloud sea on the lowest rock pixel, a lit left flank
            yb = u0 + ud[x] - 1
            put(img, x, yb, P["steel2"])
            if (x + self.seed) % 3:
                put(img, x, yb - 1, P["steel1"])
        for x in self.xs:
            if x - 1 in self.xs and x + 0.5 < self.cx:
                # the left slope faces the light: where this column is deeper than its left neighbour
                ya = self.front[x - 1] + 1 + self.ch + ud[x - 1]
                yb = self.front[x] + 1 + self.ch + ud[x]
                for y in range(ya, yb - 1):
                    put(img, x, y, P["earth2"] if y == ya else P["earth1"])
        # roots and a crystal hanging from the underside
        for i, x in enumerate(self.xs[3:-3:9]):
            yb = self.front[x] + 1 + self.ch + ud[x]
            ln = 2 + hsh(self.seed, x) % 4
            for y in range(yb, yb + ln):
                put(img, x, y, P["wood1"] if y < yb + ln - 1 else P["moss3"])
                rock.add((x, y))
        if self.tip:
            tp = island.tip()
            deep = max(self.front[x] + 1 + self.ch + ud[x] for x in self.xs)
            tx0 = round(self.cx) - 24
            img.alpha_composite(tp, (tx0, deep - 2))
            for y in range(tp.height):
                for x in range(tp.width):
                    if tp.getpixel((x, y))[3]:
                        rock.add((tx0 + x, deep - 2 + y))
        # the top surface
        for (x, y) in mask:
            if 0 <= x < W and 0 <= y < H:
                put(img, x, y, ground_at(x, y))
        # its rim: a grass0 edge, lit lips facing N and W, shaded facing E; the front lip rolls over
        g0 = rgb(P["grass0"])
        edge = set()
        for (x, y) in mask:
            if (x, y - 1) not in mask or (x - 1, y) not in mask or (x + 1, y) not in mask:
                edge.add((x, y))
        for (x, y) in edge:
            put(img, x, y, P["grass0"])
        for (x, y) in mask:
            if (x, y) in edge:
                continue
            if y == self.front[x]:
                put(img, x, y, P["grass1"])
            elif y == self.front[x] - 1:
                put(img, x, y, P["grass3"])
            elif (x, y - 1) in edge or (x - 1, y) in edge:
                put(img, x, y, P["grass3"])
            elif (x + 1, y) in edge:
                put(img, x, y, P["grass1"])
        self.mask, self.rock, self.depth = mask, rock, ud
        return img

    def outline(self, img):
        """One ink outline round the whole body (4-neighbour, outside)."""
        a = img.load()
        solid = self.mask | self.rock
        pts = set()
        for (x, y) in solid:
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                q = (x + dx, y + dy)
                if q not in solid:
                    pts.add(q)
        for (x, y) in pts:
            if 0 <= x < W and 0 <= y < H and not a[x, y][3]:
                a[x, y] = C("ink")
        for (x, y) in pts:
            if 0 <= x < W and 0 <= y < H and a[x, y][:3] != rgb(P["ink"]) and (x, y) not in solid:
                a[x, y] = C("ink")

    def vein(self, img, ore, x, v):
        """An ore vein in the cliff face, on its lower rows, clipped to the rock (not the lip's grass)."""
        vi = island.vein(ore, v)
        y0 = self.front[x + 8] + 6
        for j in range(16):
            for i in range(16):
                p = vi.getpixel((i, j))
                X, Y = x + i, y0 + j
                if p[3] and (X, Y) in self.rock and Y > self.front.get(X, 999) + 5:
                    put(img, X, Y, p)

    def falls(self, img, fx, f, sea=SEA):
        """A waterfall from the front edge at fx (a flat run fx..fx+15): the spring tile, the head
        over the lip, segments down to the cloud sea (the foam is drawn with the sea)."""
        fr = self.front[fx + 8]
        img.alpha_composite(island.fall_top(f % 4), (fx, fr - 15))
        img.alpha_composite(island.fall_head(f % 4), (fx, fr + 1))
        seg = island.fall(f % 4)
        y = fr + 17
        while y < sea + 6:
            img.alpha_composite(seg.crop((0, 0, 16, min(32, sea + 6 - y))), (fx, y))
            y += 32


# ---------------------------------------------------------------- the ground on the islands
GRASS = [ground.grass(v) for v in range(4)]
PAVE = [ground.pave_C(v) for v in range(4)]
DECO = [ground.grass_deco(i) for i in range(8)]


def ground_fn(gx, gy, plot, deco_rate=5, seed=0, no_deco=()):
    """ground_at(x, y) for an island whose tile grid starts at (gx, gy); plot = (c0, r0, c1, r1)
    tile rect (inclusive) of paving; deco on 1 in deco_rate meadow tiles."""
    cache = {}

    def tile(c, r):
        if (c, r) not in cache:
            if plot and plot[0] <= c <= plot[2] and plot[1] <= r <= plot[3]:
                t = PAVE[hsh(c, r, 11 + seed) % 4].copy()
            else:
                t = GRASS[hsh(c, r, 7 + seed) % 4].copy()
                if hsh(c, r, 9 + seed) % deco_rate == 0 and (c, r) not in no_deco:
                    t.alpha_composite(DECO[hsh(c, r, 3 + seed) % 8])
            cache[(c, r)] = t
        return cache[(c, r)]

    def at(x, y):
        c, r = (x - gx) // T, (y - gy) // T
        return tile(c, r).getpixel(((x - gx) % T, (y - gy) % T))
    return at


# ---------------------------------------------------------------- the sky
GRAD = sky.gradient(W, H, "workshop")
CLOUDS = sky.clouds()
ISLETS = [sky.islet(v) for v in range(4)]


def backdrop():
    img = GRAD.copy()
    # morning: the horizon right over the cloud sea warms to the sun's colour, a band with the
    # gradient's own 8-row ordered-dither seam above it (sky.py), mostly showing between the puffs
    a = img.load()
    seam, band = 144, 152
    for y in range(seam, SEA + 2):
        t = (y - seam + 0.5) / (band - seam)
        for x in range(W):
            if y >= band or bayer(x, y) < t:
                a[x, y] = C("sun")
    # far islets on the horizon (pre-hazed), the windmill one off the buttons' axis
    for (x, y, v) in ((144, 118, 2), (196, 128, 1), (-18, 122, 3)):
        img.alpha_composite(ISLETS[v], (x, y))
    # high puffs in the corners (clear of the logo and the tagline), lower ones behind the islands
    for (x, y, k) in ((-22, 4, 4), (276, 16, 3), (290, 50, 5), (2, 48, 5), (100, 88, 5),
                      (170, 140, 4), (236, 138, 2), (60, 136, 2)):
        img.alpha_composite(CLOUDS[k], (x, y))
    return img


def birds(img, f):
    """A flock of four crossing the open sky between the tagline and the buttons, bobbing."""
    for i, (bx, by) in enumerate(((150, 80), (158, 76), (163, 83), (171, 79))):
        dy = round(math.sin((f + i * 2) * math.pi / 4) * 1.2)
        dx = round(math.cos((f + i * 2) * math.pi / 4) * 0.8)
        img.alpha_composite(sky.bird((f + i) % 4), (bx + dx, by + dy))


def cloud_sea(f, shadows=()):
    """The sea of clouds along the bottom: three staggered rows of big puffs, the front puffs
    breathing a pixel (out of step), a calm lit body under them for the last line's slip.
    shadows: (x0, x1) spans where an island above shades the puff tops a step."""
    lay = new(W, H)
    rows = [(-16, (2, 3, 4), (26, 40)), (-6, (0, 1, 2, 3), (34, 50)), (6, (0, 1), (40, 56))]
    for row, (dy, kinds, step) in enumerate(rows):
        x = -30 - (hsh(row, 5) % 20)
        i = 0
        while x < W:
            h = hsh(row, i, 17)
            k = kinds[h % len(kinds)]
            bob = 0
            if row == 2 and (i % 2 == 0):
                bob = [0, 0, 1, 1, 1, 0, 0, 0][(f + i * 3) % 8]
            elif row == 1 and i % 3 == 1:
                bob = [0, 0, 0, 0, 1, 1, 1, 0][(f + i) % 8]
            lay.alpha_composite(CLOUDS[k], (x, SEA + dy + (h >> 8) % 7 - bob))
            x += step[0] + (h >> 4) % (step[1] - step[0])
            i += 1
    cb = C("cloud2")
    a = lay.load()
    for y in range(SEA + 22, H):
        for x in range(W):
            if not a[x, y][3]:
                a[x, y] = cb
    # the islands' shade on the cloud tops right under them
    down = {rgb(P["cloud3"]): C("cloud2"), rgb(P["cloud2"]): C("cloud1")}
    for (x0, x1, y1) in shadows:
        for y in range(SEA - 20, y1):
            for x in range(max(0, x0), min(W, x1)):
                p = a[x, y]
                if p[3] and p[:3] in down:
                    a[x, y] = down[p[:3]]
    return lay


# ---------------------------------------------------------------- the two islands
# The Workshop island. Its tile grid starts at (32, 72) so the whole line sits inside the 1024x640
# crop (scene x >= 32) and ends well left of the buttons (x 125): the plot is tiles 0..3 x 0..2
# (x 32..96, y 72..120); the iron outcrop on tiles 0..1 x 0..1, the miner on its top-right tile,
# the furnace east of it, a belt turning south into the Dock (tiles 2..3 x 1..2).
LG = (32, 72)
LEFT = Isle(cx=50, cy=97, hw=68, hd=30, p=4.2, ch=24, ud=40, seed=3, flats=((98, 113), (6, 21)), tip=False)
LEFT_FALLS = (98, 6)
# the town's island
RIGHT = Isle(cx=260, cy=95, hw=58, hd=18, p=3.2, ch=18, ud=34, seed=11, flats=((262, 277),))
RIGHT_FALLS = (262,)


def turn_path():
    """Item top-left positions from the furnace's mouth round the belt turn (it enters west and
    leaves south, about its south-west corner) into the Dock: 16 steps, 2 a frame, so two items
    spaced 8 apart loop in 8 frames."""
    gx, gy = LG
    x0, y0 = gx + 3 * T, gy                       # the turn tile's top-left
    # item centres: along the row (y0 + 8), round the arc about (x0, y0 + 16), down the column
    cs = [(x0 - 4 + i, y0 + 8) for i in range(4)]
    for i in range(9):
        a = math.pi / 2 * i / 8
        cs.append((x0 + 8 * math.sin(a), y0 + 16 - 8 * math.cos(a)))
    cs += [(x0 + 8, y0 + 16 + i) for i in range(1, 4)]
    return [(round(x) - 4, round(y) - 4) for x, y in cs]


def left_island(img, f):
    lg = ground_fn(LG[0], LG[1], (0, 0, 3, 2), deco_rate=3, seed=1)
    body = LEFT.body(lg)
    LEFT.vein(body, "iron", 36, 0)
    LEFT.vein(body, "copper", 82, 1)
    LEFT.vein(body, "coal", -12, 2)
    LEFT.outline(body)
    img.alpha_composite(body)
    for fx in LEFT_FALLS:
        LEFT.falls(img, fx, f)
    gx, gy = LG

    def at(spr, c, r, dx=0, dy=0):
        img.alpha_composite(spr, (gx + c * T + dx, gy + r * T + dy))

    # trees and bushes on the rim, outside the plot; tall ones only left of the logo (x < 50)
    for (k, x, y) in ((1, -4, 82), (3, 14, 70), (0, 34, 64), (2, 10, 110), (1, -14, 104)):
        img.alpha_composite(props.tree(k), (x - 16, y - 29))
    for (k, x, y) in ((2, 58, 57), (0, 84, 58), (1, 98, 70), (0, 20, 112)):
        img.alpha_composite(props.bush(k), (x, y))
    # the iron outcrop, re-seated off the planks onto the paving
    ore = new(32, 32)
    for i, (dx, dy) in enumerate(((0, 0), (16, 0), (0, 16), (16, 16))):
        ore.alpha_composite(art("tile_ore_iron", 1 + i), (dx, dy))
    seat = {"wood0": "pave0", "wood1": "pave0", "wood2": "pave1", "wood3": "pave2"}
    sm = {rgb(P[k]): C(v) for k, v in seat.items()}
    px = ore.load()
    for y in range(32):
        for x in range(32):
            if px[x, y][3] and px[x, y][:3] in sm:
                px[x, y] = sm[px[x, y][:3]]
    at(ore, 0, 0)
    # the line; ingots ride the turn out from under the furnace's mouth and into the Dock
    at(art("belt_turn", f % 4), 3, 0)
    path = turn_path()
    ingot = art("items", 2)
    for k in range(2):
        img.alpha_composite(ingot, path[(2 * f + 8 * k) % 16])
    at(art("dock", (f // 4) % 2), 2, 1)
    at(art("miner", f % 4, row=0), 1, 0)
    at(art("furnace", f % 4, row=0), 2, 0)
    # on the plot's front row, this very line folded into one tile (the tagline's promise): a brass
    # module with an ingot in its well, its band breathing; a frog worker beside it
    at(art("module"), 0, 2)
    at(art("items", 2), 0, 2, 4, 4)
    at(art("module_glow", f % 4), 0, 2)
    at(reseat(art("town_frog", (f // 2) % 4)), 1, 2, 0, -2)


def right_island(img, f):
    rg = ground_fn(200, 80, None, deco_rate=3, seed=2, no_deco=())
    body = RIGHT.body(rg)
    RIGHT.vein(body, "sand", 222, 3)
    RIGHT.vein(body, "iron", 300, 1)
    RIGHT.outline(body)
    img.alpha_composite(body)
    for fx in RIGHT_FALLS:
        RIGHT.falls(img, fx, f)
    # the town on the rim: the mayor's house and a gable house on footings, the town flag
    gable = reseat(named("town_house", "gable"))
    home = reseat(named("town_house", "bramble"))
    img.alpha_composite(props.tree(1), (318 - 16, 92 - 29))
    img.alpha_composite(home, (242, 62))
    img.alpha_composite(gable, (274, 63))
    img.alpha_composite(flag(f), (302, 68))
    img.alpha_composite(props.bush(2), (296, 100))
    # Bramble out on the open grass by his house, his hat against the sky when he raises it,
    # facing the buttons; a townsperson by the gable house
    img.alpha_composite(bramble(f), (214, 74))
    fr = reseat(art("town_frog", 0)).transpose(Image.FLIP_LEFT_RIGHT)
    img.alpha_composite(fr, (282, 96))


def scene(f):
    img = backdrop()
    birds(img, f)
    right_island(img, f)
    left_island(img, f)
    sea = cloud_sea(f, shadows=((-10, 128, SEA + 10), (206, 318, SEA + 6)))
    img.alpha_composite(sea)
    for fx in LEFT_FALLS + RIGHT_FALLS:
        img.alpha_composite(island.foam(f % 4), (fx - 8, SEA - 6))
    return img


# ---------------------------------------------------------------- export
def check(img):
    bad = {p[:3] for p in img.getdata() if p[:3] not in ART_SET}
    if bad:
        raise ValueError(f"{len(bad)} colours off the palette, e.g. {list(bad)[:4]}")
    if any(p[3] != 255 for p in img.getdata()):
        raise ValueError("the scene must be opaque")


def build():
    frames = [scene(f) for f in range(N)]
    strip = sheet(frames)
    check(strip)
    strip.save(SRC_ART / "title_scene.png")
    meta = {"frame": [W, H], "frames": N, "anchor": [0, 0], "fps": 8}
    (SRC_ART / "title_scene.json").write_text(json.dumps(meta) + "\n", newline="\n")
    frames[0].save(OUT / "title_scene_f0.png")
    scale(frames[0], 4).save(OUT / "title_scene_f0@4x.png")
    scale(frames[5], 4).save(OUT / "title_scene_f5@4x.png")
    # the frames as a GIF at 2x for looking at the motion
    big = [scale(fr, 2).convert("P", palette=Image.ADAPTIVE) for fr in frames]
    big[0].save(OUT / "title_scene@2x.gif", save_all=True, append_images=big[1:], duration=125, loop=0)
    # the motion: each island's busy part in all 8 frames, side by side
    for name, box in (("left", (28, 60, 124, 132)), ("right", (204, 60, 300, 170))):
        crops = [fr.crop(box) for fr in frames]
        scale(sheet(crops, 4), 3).save(OUT / f"motion_{name}@3x.png")
    # Bramble's frames (0, blink, the hat going up, the top of it) at 10x over the sky
    br = sheet([bramble(f) for f in (0, 2, 4, 5)])
    bg = Image.new("RGBA", br.size, C("sky2"))
    bg.alpha_composite(br)
    scale(bg, 10).save(OUT / "bramble@10x.png")
    # the 1024x640 crop (scene x 32..288, y 10..170) at 2x
    scale(frames[0].crop((32, 10, 288, 170)), 2).save(OUT / "title_crop1024@2x.png")
    print("colours", len({p[:3] for p in strip.getdata()}))


if __name__ == "__main__":
    build()
