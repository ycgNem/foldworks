"""The Last Fold's moment (docs/endgame.md, Milestone 10: reset layer 3): a full-screen sequence,
the World floor folding inward into one glowing tile, the tile falling to a new empty island and
landing as the Seed. The arc is day, night, a flash, dawn: the World under its deep sky; the audit's
gold box closes round it; its edges lift and fold in, again and again (the platform shrinks and
warms each time, the sky darkens to night so the glow carries the picture); one tile of light; a
flash; dawn on a new universe, a little island over the cloud sea with an empty plot; the tile
falls, lands, and is the Seed, humming.

lastfold 128x72 (16:9; the game draws it at a whole-number cover scale, 8x at 1024x576), 16 frames
with their own durations (`durations`, ms; fps 0), names in `names`; frames 14-15 loop (`loop`)
until the game cuts to the new Workshop; `events` name the frames to hang sound and shake on; the
Seed stands at `seedAt` (its 16x16 frame's top-left) in frames 14-15.

Drawn from the real sheets where they exist: the Seed's frames come from src/art/seed.png; the
island's grass, paving and rock use the sky island's ramps; the World platform is a miniature of
world_deck's colours (cloud plate, gold trim) at 8 px a tile.
"""
import json
import math

from PIL import Image

from c5 import OUT, P, SRC_ART, bayer, hsh, new, put, rect, rgb, scale, ship, hline, vline

W, H = 128, 72
TS = 8                       # a miniature tile
CX, CY = 64, 28              # the platform's centre
SIZES = [(10, 6), (10, 6), (8, 6), (8, 4), (6, 4), (4, 2), (2, 2), (1, 1)]
NAMES = ["world", "audit", "fold1", "fold2", "fold3", "fold4", "fold5", "fold6", "tile", "flash", "dawn", "fall1",
         "fall2", "land", "seed1", "seed2"]
DURATIONS = [800, 650, 170, 170, 170, 170, 170, 240, 550, 160, 420, 110, 110, 280, 600, 600]
MODULES = {(1, 1), (3, 2), (6, 1), (8, 3), (2, 4), (5, 4), (4, 2), (7, 4), (6, 3), (4, 3), (5, 2)}
SEED_AT = (56, 39)


def C(n):
    return rgb(P[n]) + (255,)


# ================================================================ skies
def sky_day(img):
    for y in range(H):
        for x in range(W):
            t = y / H
            c = "sky0" if t + (bayer(x, y) - 0.5) * 0.12 < 0.55 else "sky1"
            img.putpixel((x, y), C(c))
    # the cloud sea far below
    for x in range(W):
        top = 64 + round(math.sin(x / 7) * 1.5 + math.sin(x / 3.1))
        for y in range(top, H):
            img.putpixel((x, y), C("cloud0" if y < top + 2 else "cloud1"))


def sky_dusk(img, k):
    """k 0..1: the deep sky going to night (iron0 then ink), stars coming out."""
    for y in range(H):
        for x in range(W):
            t = y / H + (bayer(x, y) - 0.5) * 0.2
            c = ("iron0" if t < 0.6 else "sky0") if k < 0.5 else ("ink1" if t < 0.55 else "ink2")
            img.putpixel((x, y), C(c))
            h = hsh(x, y, 9)
            if k >= 0.5 and h % 61 == 0:
                img.putpixel((x, y), C("cloud2" if h % 3 else "sky3"))
            elif k < 0.5 and h % 149 == 0:
                img.putpixel((x, y), C("sky3"))


def sky_flash(img):
    for y in range(H):
        for x in range(W):
            d = math.hypot(x - CX, (y - CY) * 1.4) / 70 + (bayer(x, y) - 0.5) * 0.15
            img.putpixel((x, y), C("cloud3" if d < 0.35 else "sun" if d < 0.6 else "sky4" if d < 0.85 else "sky3"))


def sky_dawn(img):
    for y in range(H):
        for x in range(W):
            t = y / H + (bayer(x, y) - 0.5) * 0.1
            c = "sky1" if t < 0.22 else "sky2" if t < 0.48 else "sky3" if t < 0.7 else "sky4"
            img.putpixel((x, y), C(c))
    # a low sun on the left, warm round it
    for (x, y) in [(x, y) for y in range(44, 62) for x in range(4, 30)]:
        d = math.hypot(x - 16, y - 54)
        if d < 4:
            img.putpixel((x, y), C("cloud3"))
        elif d < 7 + bayer(x, y) * 1.5:
            img.putpixel((x, y), C("sun"))


def cloud_sea(img, front):
    """The cloud sea along the bottom: a back row (cloud1/2) or a front row (cloud2/3 lit tops)."""
    base = 63 if not front else 67
    for x in range(W):
        top = base + round(math.sin(x / (6 if front else 9) + (1 if front else 0)) * 2 + math.sin(x / 2.7) * 0.7)
        for y in range(top, H):
            c = ("cloud3" if y == top else "cloud2") if front else ("cloud2" if y == top else "cloud1")
            img.putpixel((x, y), C(c))


# ================================================================ the World, folding
def stage_colours(s):
    """The plate's fill, lit edge and groove at fold stage s: cloud-white warming to gold."""
    return [("cloud2", "cloud3", "cloud0"), ("cloud2", "cloud3", "cloud0"), ("cloud2", "cloud3", "cloud1"),
            ("cloud3", "cloud3", "brass3"), ("sun", "cloud3", "brass3"), ("lamp3", "cloud3", "brass2"),
            ("lamp3", "cloud3", "lamp2"), ("lamp2", "lamp3", "lamp1")][s]


def plat_rect(w, h):
    x0 = CX - w * TS // 2
    y0 = CY - h * TS // 2
    return x0, y0, x0 + w * TS - 1, y0 + h * TS - 1


def tile(img, x, y, s, module, glint=False):
    fill, lit, groove = stage_colours(s)
    rect(img, x, y, x + TS - 1, y + TS - 1, P[fill])
    hline(img, x, x + TS - 1, y, P[lit])
    vline(img, x, y, y + TS - 1, P[lit])
    hline(img, x + 1, x + TS - 1, y + TS - 1, P[groove])
    vline(img, x + TS - 1, y + 1, y + TS - 1, P[groove])
    if module and s < 6:
        # a world module seen from above: a brass frame, a dark well with a spark of its product
        rect(img, x + 1, y + 1, x + 6, y + 6, P["brass2"])
        hline(img, x + 1, x + 6, y + 1, P["brass3"])
        rect(img, x + 2, y + 2, x + 5, y + 5, P["ink1"])
        prod = ["copper2", "sky3", "violet", "grass3", "lamp2", "teal"][hsh(x, y) % 6]
        put(img, x + 3, y + 3, P[prod])
        put(img, x + 4, y + 4, P["ink2"])
        if glint:
            put(img, x + 2, y + 2, P["lamp3"])


def platform(img, w, h, s, audit=False, face=True):
    x0, y0, x1, y1 = plat_rect(w, h)
    ox, oy = (10 - w) // 2, (6 - h) // 2
    if face:
        # the gold-trimmed face under the south edge and its rotor pods (whole platform only)
        hline(img, x0, x1, y1 + 1, P["brass3"])
        rect(img, x0, y1 + 2, x1, y1 + 3, P["cloud1"])
        hline(img, x0 - 1, x1 + 1, y1 + 4, P["ink"])
        if s <= 1:
            for k in range(4):
                px = x0 + 10 + k * 20
                vline(img, px, y1 + 5, y1 + 6, P["cloud0"])
                rect(img, px - 2, y1 + 7, px + 2, y1 + 9, P["cloud2"])
                put(img, px - 2, y1 + 7, P["cloud3"])
                put(img, px, y1 + 6, P["brass2"])
                hline(img, px - 7, px + 7, y1 + 10, P["cloud2"] if k % 2 else P["cloud3"])
                put(img, px, y1 + 10, P["lamp2"])
    for j in range(h):
        for i in range(w):
            tile(img, x0 + i * TS, y0 + j * TS, s, (i + ox, j + oy) in MODULES, glint=audit)
    # the kerb: gold rail and an ink rim round it all
    for x in range(x0 - 1, x1 + 2):
        put(img, x, y0 - 1, P["brass3"])
        put(img, x, y1 + 1, P["brass2"]) if not face else None
    for y in range(y0 - 1, y1 + 2):
        put(img, x0 - 1, y, P["brass3"])
        put(img, x1 + 1, y, P["brass1"])
    for x in range(x0 - 2, x1 + 3):
        put(img, x, y0 - 2, P["ink"])
    for y in range(y0 - 2, y1 + 5 if face else y1 + 3):
        put(img, x0 - 2, y, P["ink"])
        put(img, x1 + 2, y, P["ink"])
    if audit:
        # the audit's gold box: dashes marching round, corner brackets
        bx0, by0, bx1, by1 = x0 - 5, y0 - 5, x1 + 5, y1 + 8
        n = 0
        for x in range(bx0, bx1 + 1):
            for y in (by0, by1):
                if (x // 2) % 2 == 0:
                    put(img, x, y, P["lamp2"])
        for y in range(by0, by1 + 1):
            for x in (bx0, bx1):
                if (y // 2) % 2 == 0:
                    put(img, x, y, P["lamp2"])
        for (cx, cy, dx, dy) in ((bx0, by0, 1, 1), (bx1, by0, -1, 1), (bx0, by1, 1, -1), (bx1, by1, -1, -1)):
            for k in range(4):
                put(img, cx + dx * k, cy, P["lamp3"])
                put(img, cx, cy + dy * k, P["lamp3"])
        n += 1
    return x0, y0, x1, y1


def flaps(img, rect_, sides, s):
    """The edges lifting and folding in: on each folding side a strip foreshortened to half a tile
    just outside the settled platform, its gilded underside showing, a bright free edge, the crease
    lit."""
    x0, y0, x1, y1 = rect_
    back, back2, edge = P["brass1"], P["brass2"], P["lamp3"]
    d = TS // 2
    if "lr" in sides:
        for (xa, xb, free) in ((x0 - 1 - d, x0 - 2, x0 - 1 - d), (x1 + 2, x1 + 1 + d, x1 + 1 + d)):
            for x in range(xa, xb + 1):
                for y in range(y0 - 1, y1 + 2):
                    put(img, x, y, edge if x == free else back2 if (y - y0) % TS in (0, 1) else back)
            for y in range(y0 - 2, y1 + 3):
                put(img, xa - 1 if free == xa else xb + 1, y, P["ink"])
        vline(img, x0 - 1, y0 - 1, y1 + 1, P["cloud3"])
        vline(img, x1 + 1, y0 - 1, y1 + 1, P["cloud3"])
    if "tb" in sides:
        for (ya, yb, free) in ((y0 - 1 - d, y0 - 2, y0 - 1 - d), (y1 + 2, y1 + 1 + d, y1 + 1 + d)):
            for y in range(ya, yb + 1):
                for x in range(x0 - 1, x1 + 2):
                    put(img, x, y, edge if y == free else back2 if (x - x0) % TS in (0, 1) else back)
            for x in range(x0 - 2, x1 + 3):
                put(img, x, ya - 1 if free == ya else yb + 1, P["ink"])
        hline(img, x0 - 1, x1 + 1, y0 - 1, P["cloud3"])
        hline(img, x0 - 1, x1 + 1, y1 + 1, P["cloud3"])


def halo(img, cx, cy, r0, r1, f=0):
    """Rings of lantern light round the tile: lamp1 dots, lamp0 further out, dithered."""
    for y in range(cy - r1 - 1, cy + r1 + 2):
        for x in range(cx - r1 - 1, cx + r1 + 2):
            d = math.hypot(x + 0.5 - cx, y + 0.5 - cy)
            if r0 <= d <= r1:
                t = (d - r0) / max(1, r1 - r0)
                if bayer(x + f, y) > t:
                    put(img, x, y, P["lamp2"] if t < 0.3 else P["lamp1"] if t < 0.65 else P["lamp0"])


def rays(img, cx, cy, n, length, inner, c1="lamp3", c2="sun", phase=0.0):
    for k in range(n):
        a = phase + k / n * 2 * math.pi
        for r in range(inner, inner + length):
            x, y = round(cx + math.cos(a) * r), round(cy + math.sin(a) * r * 0.8)
            put(img, x, y, P[c1] if r < inner + length * 0.5 else P[c2])


def glow_tile(img, cx, cy, f=0, size=8):
    """The World as one tile: a gold square with a white-hot heart, an ink rim."""
    x0, y0 = cx - size // 2, cy - size // 2
    rect(img, x0 - 1, y0 - 1, x0 + size, y0 + size, P["ink"])
    rect(img, x0, y0, x0 + size - 1, y0 + size - 1, P["lamp2"])
    hline(img, x0, x0 + size - 1, y0, P["lamp3"])
    vline(img, x0, y0, y0 + size - 1, P["lamp3"])
    hline(img, x0 + 1, x0 + size - 1, y0 + size - 1, P["lamp1"])
    vline(img, x0 + size - 1, y0 + 1, y0 + size - 1, P["lamp1"])
    rect(img, x0 + 2, y0 + 2, x0 + size - 3, y0 + size - 3, P["lamp3"])
    put(img, x0 + 3, y0 + 3, P["cloud3"])
    # the fold's mark: a crease on the diagonal
    for k in range(2, size - 2):
        if k != 3:
            put(img, x0 + k, y0 + size - 1 - k, P["sun"])


# ================================================================ the new island
def island(img):
    """A small floating island at dawn: a grass top with an empty paved plot (the new universe's
    Workshop, waiting), the south cliff in 3/4 view, the underside tapering into the cloud sea."""
    cx, top, rx = 64, 47, 30
    # the underside: a rock cone with two tones, a bounce light along the lip
    for y in range(top + 9, H):
        hw = rx - 2 - (y - top - 9) * 1.6
        for x in range(round(cx - hw), round(cx + hw) + 1):
            u = (x - cx) / max(1, hw)
            c = "earth2" if u < -0.3 else "earth1" if u < 0.5 else "earth0"
            if y == top + 9:
                c = "earth3"
            put(img, x, y, P[c])
    # the cliff face (strata) under the grass
    for y in range(top + 6, top + 10):
        for x in range(cx - rx + 1, cx + rx):
            c = "earth3" if (y + (x // 5)) % 3 == 0 else "earth2"
            if x > cx + rx - 6:
                c = "earth1"
            put(img, x, y, P[c])
    # the grass top: an ellipse lit from the left
    for y in range(top, top + 7):
        for x in range(cx - rx, cx + rx + 1):
            dx, dy = (x - cx) / rx, (y - top - 3) / 3.6
            if dx * dx + dy * dy <= 1:
                c = "grass3" if dx < -0.35 and dy < 0.3 else "grass2" if dx < 0.5 else "grass1"
                if dy > 0.6:
                    c = "grass1"
                put(img, x, y, P[c])
    # the plot: paving with a dotted grid, a pave3 lit edge (empty: nothing is built yet)
    px0, py0, px1, py1 = cx - 12, top + 1, cx + 12, top + 6
    rect(img, px0, py0, px1, py1, P["pave2"])
    hline(img, px0, px1, py0, P["pave3"])
    hline(img, px0, px1, py1, P["pave1"])
    for x in range(px0 + 4, px1, 4):
        put(img, x, py0 + 2, P["pave1"])
        put(img, x, py0 + 4, P["pave1"])
    # a tree and a bush on the rim, a waterfall off the lip
    for (x, y, c) in ((cx - 22, top, "grass1"), (cx - 23, top - 1, "grass2"), (cx - 22, top - 2, "grass3"),
                      (cx - 21, top - 1, "grass2"), (cx - 22, top - 1, "grass3"), (cx + 20, top + 1, "grass1"),
                      (cx + 21, top + 1, "grass1"), (cx + 20, top, "grass2")):
        put(img, x, y, P[c])
    put(img, cx - 22, top + 1, P["wood2"])
    for y in range(top + 6, H - 4):
        put(img, cx + 15, y, P["cloud3"] if y % 3 else P["sky4"])
        put(img, cx + 16, y, P["sky4"])
    # an ink rim round the grass top's silhouette (so it reads against the sky4 horizon)
    pts = []
    for y in range(top - 1, top + 8):
        for x in range(cx - rx - 1, cx + rx + 2):
            dx, dy = (x - cx) / (rx + 1), (y - top - 3) / 4.4
            if 0.86 < dx * dx + dy * dy <= 1.0 and y < top + 4:
                pts.append((x, y))
    for (x, y) in pts:
        if img.getpixel((x, y))[:3] not in (rgb(P["grass1"]), rgb(P["grass2"]), rgb(P["grass3"])):
            put(img, x, y, P["ink2"])


def seed_frames():
    im = Image.open(SRC_ART / "seed.png").convert("RGBA")
    meta = json.loads((SRC_ART / "seed.json").read_text())
    fw, fh = meta["frame"]
    return [im.crop((i * fw, 0, i * fw + fw, fh)) for i in range(meta["frames"])]


# ================================================================ the frames
def frame(i):
    img = Image.new("RGBA", (W, H))
    name = NAMES[i]
    land = (64, 50)
    if name in ("world", "audit"):
        sky_day(img)
        platform(img, 10, 6, 0, audit=name == "audit")
    elif name.startswith("fold"):
        k = int(name[4:])                       # 1..6: the fold from SIZES[k] to SIZES[k+1]
        if k <= 2:
            sky_day(img)
        else:
            sky_dusk(img, 0.0 if k <= 4 else 1.0)
        w, h = SIZES[k + 1]
        r = platform(img, w, h, k + 1, face=k <= 2)
        pw, ph = SIZES[k]
        sides = ("lr" if pw != w else "") + ("tb" if ph != h else "")
        flaps(img, r, sides, k)
        if k >= 4:
            halo(img, CX, CY, max(w, h) * TS // 2 + 4, max(w, h) * TS // 2 + 9)
    elif name == "tile":
        sky_dusk(img, 1.0)
        halo(img, CX, CY, 6, 16)
        rays(img, CX, CY, 8, 6, 9, phase=0.2)
        glow_tile(img, CX, CY)
    elif name == "flash":
        sky_flash(img)
        rays(img, CX, CY, 12, 40, 8, "lamp3", "lamp2")
        glow_tile(img, CX, CY, size=10)
    else:
        sky_dawn(img)
        cloud_sea(img, False)
        island(img)
        cloud_sea(img, True)
        if name == "dawn":
            halo(img, CX, 20, 5, 11)
            glow_tile(img, CX, 20)
        elif name in ("fall1", "fall2"):
            y = 30 if name == "fall1" else 40
            for t in range(1, 14 if name == "fall1" else 20):
                c = "lamp3" if t < 4 else "lamp2" if t < 9 else "lamp1" if t < 14 else "lamp0"
                if t < 9 or bayer(CX, y - t) > (t - 9) / 12:
                    put(img, CX - 1, y - 4 - t, P[c])
                    put(img, CX, y - 4 - t, P[c])
            glow_tile(img, CX, y, size=8 if name == "fall1" else 7)
        elif name == "land":
            halo(img, land[0], land[1], 3, 12)
            rays(img, land[0], land[1], 10, 5, 7, "lamp3", "sun", phase=0.3)
            for (dx, dy) in ((-14, 2), (-11, 4), (12, 3), (15, 1), (-8, 5), (9, 5)):
                put(img, land[0] + dx, land[1] + dy, P["pave3"])
                put(img, land[0] + dx + 1, land[1] + dy, P["bone"])
            glow_tile(img, land[0], land[1] - 3, size=6)
        else:
            sd = seed_frames()
            img.alpha_composite(sd[0 if name == "seed1" else 2], SEED_AT)
            for (dx, dy) in (((-9, -6), (10, -3)), ((-6, -9), (8, -7)))[name == "seed2"]:
                put(img, land[0] + dx, land[1] - 8 + dy, P["lamp3"])
    return img


def build():
    frames = [frame(i) for i in range(len(NAMES))]
    events = {"audit": 1, "folds": [2, 3, 4, 5, 6, 7], "tile": 8, "flash": 9, "fall": 11, "land": 13}
    ship("lastfold", frames, 0, extra={"names": NAMES, "durations": DURATIONS, "loop": [14, 15],
                                       "events": events, "seedAt": list(SEED_AT),
                                       "note": "full-screen: draw at a whole-number cover scale (8x at 1024x576), "
                                               "each frame for its durations[i] ms, then loop frames 14-15"},
         look=4, bg=P["ink"])
    # a contact sheet: every frame at 2x with its name and duration
    cols = 4
    sheet = Image.new("RGBA", (cols * (W * 2 + 8) + 8, 4 * (H * 2 + 8) + 8), C("ink"))
    for i, f in enumerate(frames):
        sheet.alpha_composite(scale(f, 2), (8 + (i % cols) * (W * 2 + 8), 8 + (i // cols) * (H * 2 + 8)))
    sheet.save(OUT / "lastfold_sheet@2x.png")
    return frames


if __name__ == "__main__":
    build()
