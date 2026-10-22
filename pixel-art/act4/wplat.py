"""The World's sky platform (docs/endgame.md, Milestone 9): the highest platform, higher and
brighter still than the District's. The Factory is riveted pale steel, the District white plate
and polished brass; the World is sunlit cloud-white plate (cloud2, lit cloud3, grooves cloud0/1)
trimmed in gold (brass2-3, lamp3 gleams), its kerb posts lit like lamps, its skylights looking
down into the deep sky far below (sky0-2, the cloud sea a long way down), the face under the
south edge white with gold portholes, a gilded truss, and grander rotors: wide four-bladed fans
on gold-domed pods with a ring of lamps.

Frame-compatible with the District's sheets (names and order as pixel-art/act3/dplat.py), so
src/render/district.ts's DistrictPlatform can be reused with a sheet prefix:

- world_deck 16x16 x16 (names plain_nw .. vent_se, tread0, tread1, floor0, floor1)
- world_edge 16x16 x28 (m0..m15, in_*, cut_*, seam_deck, seam_tread, seam_n, seam_s)
- world_under 16x16 x9 (face_l face face_r face_splice truss_l truss truss_r face_lr face2)
- world_rotor 64x32 x4, fps 16, anchor (32, 0): the grander pod under the truss (bigger than
  dist_rotor's 48x24; the code reads w, h and the anchor from the sidecar)
- world_rotor_side 48x32 x8, fps 16, anchor (45, 15), names w0..w3 e0..e3 (as dist_rotor_side)
- world_dock, world_hopper 32x32 x3 fps 3; world_bay 32x32 x5 fps 6 (names empty stage1 stage2
  run1 run2: the bay holds a gilded beacon pylon going up, for both of the World's megaprojects)

They are drawn by dplat.py's and dests3.py's own functions with the World's colours swapped into
those modules (their colour names are module globals read at call time), then the World's own
pieces: the rotor, the beacon, lamp posts.
"""
import math

from PIL import Image

from c4 import INK, OUT, P, get, hline, new, outline, put, rect, scale, ship, vline  # noqa: I001 (puts act3 on the path)
import dests3  # noqa: E402
import dplat  # noqa: E402

T = 16
WORLD = {
    "S1": P["steel3"], "S2": P["cloud0"], "S3": P["cloud1"], "S4": P["cloud2"], "W0": P["cloud3"],
    "B0": P["brass1"], "B1": P["brass2"], "B2": P["brass3"], "B3": P["lamp3"],
    "GL0": P["sky0"], "GL1": P["sky1"], "GL2": P["sky2"], "GL3": P["sky4"], "CL1": P["cloud1"], "CL2": P["cloud2"],
}


def swap(mod, colours):
    saved = {k: getattr(mod, k) for k in colours if hasattr(mod, k)}
    for k, v in colours.items():
        if hasattr(mod, k):
            setattr(mod, k, v)
    return saved


def world_sheets():
    saved = swap(dplat, WORLD)
    old_bands = dplat.BANDS
    W = WORLD
    dplat.BANDS = {"N": [INK, W["B0"], W["B2"], W["B1"], W["W0"], W["S3"]],
                   "W": [INK, W["B0"], W["B2"], W["B1"], W["W0"], W["S3"]],
                   "S": [P["brass0"], W["B0"], W["B2"], W["B1"], W["S4"]],
                   "E": [INK, P["brass0"], W["B0"], W["B1"], W["S3"]]}
    try:
        deck, names, edge, under, _rot, side = dplat.frames_all()
    finally:
        dplat.BANDS = old_bands
        swap(dplat, saved)
    deck = [plate_star(f, n) for f, n in zip(deck, names)]
    return deck, names, edge, under, side


def plate_star(f, name):
    """The plain plates' inlay cross gets a gold star at its heart (the four quarters meet there),
    the build floor's stud is a gold rivet."""
    f = f.copy()
    if name.startswith("plain_"):
        q = name[-2:]
        # the plate's centre is at the quarters' shared corner: (15|16, 15|16) of the 32x32
        cx = 15 if q[1] == "e" else 16          # local x of the centre column in this quarter
        cy = 15 if q[0] == "s" else 16
        lx = 0 if q[1] == "e" else 15
        ly = 0 if q[0] == "s" else 15
        for (dx, dy, c) in ((0, 0, "lamp3"), (0, 1, "brass3"), (1, 0, "brass3"), (0, 2, "brass2"), (2, 0, "brass2")):
            x = lx + (dx if lx == 0 else -dx)
            y = ly + (dy if ly == 0 else -dy)
            put(f, x, y, P[c])
    return f


# ================================================================ the grander rotor
def blades4(img, cx, cy, rx, ry, ang):
    """Four broad blades (two pixels wide), white with gold tips, through the hub."""
    for b in range(4):
        a = ang + b * math.pi / 2
        for k in range(3, int(rx) + 1):
            t = k / rx
            x = cx + math.cos(a) * rx * t
            y = cy + math.sin(a) * ry * t
            c = P["lamp2"] if t > 0.88 else P["cloud2"] if math.sin(a) < 0 else P["cloud3"]
            put(img, round(x), round(y), c)
            put(img, round(x + 0.5 * math.sin(a)), round(y + 0.5), P["cloud1"] if t <= 0.88 else P["brass2"])


def disc(img, cx, cy, rx, ry, f, front):
    n = 80
    for i in range(n):
        a = i / n * 2 * math.pi
        if (math.sin(a) >= 0) != front or (i + f * 4) % 5 >= 3:
            continue
        x, y = round(cx + math.cos(a) * rx), round(cy + math.sin(a) * ry)
        if not get(img, x, y)[3]:
            put(img, x, y, P["cloud2"] if math.sin(a) > 0 else P["cloud1"])


def rotor(f):
    """64x32: two struts down to a fat pod with a gold dome on top and a ring of lamps round its
    waist (one lit in turn), a gold collar, four broad blades sweeping a wide disc."""
    img = new(64, 32)
    cx, cy, rx, ry = 32, 25, 30, 4
    ang = f * math.pi / 8
    disc(img, cx, cy, rx, ry, f, False)
    body = new(64, 32)
    for x in (27, 36):
        vline(body, x, 0, 6, P["cloud2"])
        vline(body, x + 1, 0, 6, P["cloud0"])
    # the pod: a round can lit on its left, gold bands, a lamp ring
    top, h, r = 6, 13, 7
    for y in range(top, top + h + 1):
        for x in range(cx - r, cx + r + 1):
            u = (x + 0.5 - cx) / (r + 0.5)
            if abs(u) > 1:
                continue
            put(body, x, y, P["cloud3"] if u < -0.5 else P["cloud2"] if u < 0.2 else P["cloud1"] if u < 0.7 else P["cloud0"])
    # the gold dome on top
    for y in range(top - 3, top + 1):
        for x in range(cx - r, cx + r + 1):
            dx, dy = (x + 0.5 - cx) / (r + 0.5), (y + 0.5 - (top + 1)) / 4
            if dx * dx + dy * dy <= 1:
                put(body, x, y, P["brass3"] if dx < -0.2 else P["brass2"] if dx < 0.5 else P["brass1"])
    put(body, cx - 3, top - 2, P["lamp3"])
    hline(body, cx - r, cx + r, top + 1, P["brass2"])
    hline(body, cx - r, cx + r, top + h - 1, P["brass2"])
    hline(body, cx - r, cx + r, top + h, P["brass1"])
    for i, x in enumerate(range(cx - r + 1, cx + r, 3)):
        put(body, x, top + 6, P["lamp3"] if (i - f) % 4 == 0 else P["lamp1"])
    # the collar and the hub
    rect(body, cx - 2, top + h + 1, cx + 1, top + h + 4, P["brass2"])
    put(body, cx - 2, top + h + 1, P["brass3"])
    body = outline(body, INK)
    img.alpha_composite(body)
    blades4(img, cx, cy, rx, ry, ang)
    disc(img, cx, cy, rx, ry, f, True)
    put(img, cx - 1, cy, P["lamp3"])
    put(img, cx, cy, P["brass2"])
    return img


# ================================================================ dock, hopper, bay
def beacon(img, cy, top_y, full, lit=False, f=0):
    """The World Bay's work in hand (replaces dests3.hull): a gilded beacon pylon, a tapering white
    tower with gold bands; full=False shows only its lower half in a scaffold; full, a lamp cage
    on top, dark until lit; lit, the lamp blazes and a beam swings (two frames)."""
    base, tip = 25, 8
    for y in range(tip if full else 16, base + 1):
        t = (y - tip) / (base - tip)
        hw = 2 + t * 4
        for x in range(32):
            u = (x + 0.5 - 15.5) / hw
            if abs(u) <= 1:
                put(img, x, y, P["cloud3"] if u < -0.4 else P["cloud2"] if u < 0.3 else P["cloud1"])
        if y % 5 == 0:
            for x in range(round(15.5 - hw), round(15.5 + hw)):
                put(img, x, y, P["brass3"] if x < 15 else P["brass2"])
    if full:
        rect(img, 13, tip - 4, 18, tip - 1, P["brass1"])
        rect(img, 14, tip - 3, 17, tip - 1, P["lamp2"] if lit else P["ink2"])
        if lit:
            put(img, 15, tip - 2, P["lamp3"])
            put(img, 16, tip - 3, P["lamp3"])
        hline(img, 13, 18, tip - 5, P["brass3"])
        put(img, 15, tip - 6, P["brass2"])


def lamp_post(img, x, y, f, k=0):
    vline(img, x, y, y + 8, INK)
    vline(img, x + 1, y + 1, y + 8, P["brass3"])
    vline(img, x + 2, y, y + 8, INK)
    rect(img, x, y - 3, x + 2, y - 1, INK)
    put(img, x + 1, y - 2, P["lamp3"] if (f + k) % 3 else P["lamp2"])


DESTS = {"S1": P["steel3"], "S2": P["cloud0"], "S3": P["cloud1"], "S4": P["cloud2"], "W0": P["cloud3"],
         "B0": P["brass1"], "B1": P["brass2"], "B2": P["brass3"], "B3": P["lamp3"]}


def dests():
    saved = swap(dests3, DESTS)
    old_hull = dests3.hull
    dests3.hull = beacon
    try:
        dock = [dests3.dock(f) for f in range(3)]
        hopper = [dests3.hopper(f) for f in range(3)]
        bay = [dests3.bay("empty"), dests3.bay("stage1"), dests3.bay("stage2"), dests3.bay("run", 0),
               dests3.bay("run", 1)]
    finally:
        dests3.hull = old_hull
        swap(dests3, saved)
    # the World's dock: a lamp post at the pad's south-west corner (the north-east is the pip's)
    for f, im in enumerate(dock):
        lamp_post(im, 3, 19, f)
    # the bay lit: a beam of light swinging off the beacon, over the sky behind
    for k, im in enumerate(bay[3:]):
        for i in range(10):
            x = 17 + i if k == 0 else 14 - i
            y = 4 - i // 3
            if 6 <= x <= 25 and y >= 7 - 4 and not (x >= 27):
                put(im, x, max(y + 3, 7), P["lamp3"] if i < 4 else P["sun"])
    # the pip corner stays calm: no cloud3 or lamp3 in the top-right 4x4
    calm = {P["cloud3"]: P["cloud2"], P["lamp3"]: P["brass3"]}
    for im in dock + hopper + bay:
        for y in range(4):
            for x in range(28, 32):
                p = im.getpixel((x, y))
                hx = "#%02x%02x%02x" % p[:3]
                if p[3] and hx in calm:
                    put(im, x, y, calm[hx])
    return dock, hopper, bay


# ================================================================ build and look
EDGE_NAMES = dplat.EDGE_NAMES
UNDER_NAMES = dplat.UNDER_NAMES


def build():
    deck, names, edge, under, side = world_sheets()
    rot = [rotor(f) for f in range(4)]
    sky = P["sky1"]
    ship("world_deck", deck, extra={"names": names}, bg=sky, look=4)
    ship("world_edge", edge, extra={"names": EDGE_NAMES}, bg=sky, look=4)
    ship("world_under", under, extra={"names": UNDER_NAMES}, bg=sky, look=4)
    ship("world_rotor", rot, fps=16, anchor=(32, 0), bg=sky, look=4)
    ship("world_rotor_side", side, fps=16, anchor=(45, 15), bg=sky, look=4,
         extra={"names": [f"w{i}" for i in range(4)] + [f"e{i}" for i in range(4)]})
    dock, hopper, bay = dests()
    ship("world_dock", dock, 3, look=6)
    ship("world_hopper", hopper, 3, look=6)
    ship("world_bay", bay, 6, extra={"names": ["empty", "stage1", "stage2", "run1", "run2"]}, look=6)
    look(deck, names, edge, under, rot, side)


def look(deck, deck_names, edge, under, rot, side, fw=16, fh=12):
    """The World as district.ts bakes the District (DPLAT n 4, s 2, w 2, e 3, wing 1), at 16x12, with
    world modules, barges, the Dock, Hopper and Bay, on the World's sky; and the District's beside
    it for comparison (out/wplat_look.png, @2x)."""
    def bake(D, E, U, R, Sd, fw, fh, furnish):
        Pn, Ps, Pw, Pe, wing = 4, 2, 2, 3, 1
        NX0, NX1, BX0, BX1, Y0, Y1 = -Pw - wing, fw + Pe + wing, -Pw, fw + Pe, -Pn, fh + Ps

        def on(x, y):
            if y < Y0 or y >= Y1:
                return False
            return NX0 <= x < NX1 if y < 0 else BX0 <= x < BX1
        X0, X1 = NX0 - 3, NX1 + 3
        img = Image.new("RGBA", ((X1 - X0) * T, (Y1 - Y0 + 4) * T))
        ox, oy = X0 * T, Y0 * T

        def at(im, x, y, cut=False):
            px, py = x * T - ox, y * T - oy
            if cut:
                a = im.split()[3]
                reg = img.crop((px, py, px + 16, py + 16))
                na = reg.split()[3]
                na.paste(0, mask=a)
                reg.putalpha(na)
                img.paste(reg, (px, py))
            else:
                img.alpha_composite(im, (px, py))

        def bottom(x):
            b = Y1 - 1
            while b >= Y0 and not on(x, b):
                b -= 1
            return b
        for x in range(X0, X1):
            b = bottom(x)
            if b < Y0:
                continue
            l = not on(x - 1, b) or bottom(x - 1) < b
            r = not on(x + 1, b) or bottom(x + 1) < b
            k = "face_lr" if l and r else "face_l" if l else "face_r" if r else "face" if x % 2 == 0 else "face2"
            at(U[k], x, b + 1)
            if BX0 < x < BX1 - 1:
                at(U["truss_l" if x == BX0 + 1 else "truss_r" if x == BX1 - 2 else "truss"], x, Y1 + 1)
        from c4 import hsh
        for y in range(Y0, Y1):
            for x in range(X0, X1):
                if not on(x, y):
                    continue
                if 0 <= x < fw and 0 <= y < fh:
                    at(D["floor1" if hsh(x, y, 5) % 8 == 0 else "floor0"], x, y)
                elif y < 0:
                    px, py = x - x % 2, y - y % 2
                    whole = all(on(px + a, py + b) for a in (0, 1) for b in (0, 1)) and py + 1 < 0
                    kind = ["plain", "plain", "skylight", "plain", "vent", "plain", "plain"][hsh(px, py, 7) % 7] if whole else "plain"
                    at(D[f"{kind}_{'ns'[y % 2]}{'we'[x % 2]}"], x, y)
                else:
                    at(D["tread1" if hsh(x, y, 3) % 5 == 0 else "tread0"], x, y)
        for y in range(Y0, Y1):
            for x in range(X0, X1):
                if not on(x, y) or (0 <= x < fw and 0 <= y < fh):
                    continue
                m = (on(x, y - 1) and 1) | (on(x + 1, y) and 2) | (on(x, y + 1) and 4) | (on(x - 1, y) and 8)
                for c, bits in (("nw", 9), ("ne", 3), ("sw", 12), ("se", 6)):
                    if not m & bits:
                        at(E["cut_" + c], x, y, cut=True)
                if m != 15:
                    at(E[f"m{m}"], x, y)
                for c, (dx, dy, bits) in (("nw", (-1, -1, 9)), ("ne", (1, -1, 3)), ("sw", (-1, 1, 12)), ("se", (1, 1, 6))):
                    if (m & bits) == bits and not on(x + dx, y + dy):
                        at(E["in_" + c], x, y)
        span = BX1 - BX0 - 2
        n = max(2, round(span / 5))
        for i in range(n):
            x = round((BX0 + 1 + (i + 0.5) * span / n) * T)
            r = R[i % len(R)]
            img.alpha_composite(r, (x - r.width // 2 - ox, (Y1 + 2) * T - 3 - oy))
        for row in (2, fh - 2):
            img.alpha_composite(Sd[0], (BX0 * T - 45 - ox, row * T + 8 - 15 - oy))
            img.alpha_composite(Sd[5], (BX1 * T - 2 - ox, row * T + 8 - 15 - oy))
        furnish(img, ox, oy)
        return img

    from c4 import load, SRC_ART

    def fr(name, i=0):
        f, _ = load(name)
        return f[i]
    items = []
    for nm_, n in (("items3", 19), ("items4", 15)):
        im = Image.open(SRC_ART / f"{nm_}.png").convert("RGBA")
        items += [im.crop((i * 8, 0, i * 8 + 8, 8)) for i in range(n)]

    def furnish_world(img, ox, oy):
        for k, (x, y) in enumerate(((1, 1), (3, 4), (6, 2), (8, 6), (4, 8), (10, 3), (12, 8), (2, 10), (9, 10))):
            img.alpha_composite(fr("world_module", k % 4), (x * T - ox, y * T - oy))
            img.alpha_composite(items[19 + (k * 2) % 15], (x * T + 4 - ox, y * T + 6 - oy))
        for (x, y, k) in ((4.6, 2.4, 0), (7.1, 4.6, 1), (5.4, 7.2, 2), (10.2, 6.2, 3)):
            img.alpha_composite(fr("barge", k), (int(x * T) - ox, int(y * T) - oy))
        for name, (x, y) in (("world_dock", (14, 2)), ("world_hopper", (14, 5)), ("world_bay", (0, 10))):
            img.alpha_composite(fr(name, 3 if name == "world_bay" else 0), (x * T - ox, y * T - oy))

    def furnish_dist(img, ox, oy):
        for k, (x, y) in enumerate(((1, 1), (3, 4), (6, 2), (8, 6), (4, 8))):
            img.alpha_composite(fr("dist_module", k % 4), (x * T - ox, y * T - oy))
            img.alpha_composite(items[k * 3], (x * T + 4 - ox, y * T + 6 - oy))
        for name, (x, y) in (("dist_dock", (10, 2)), ("dist_hopper", (10, 5)), ("dist_bay", (0, 8))):
            img.alpha_composite(fr(name), (x * T - ox, y * T - oy))
    D = dict(zip(deck_names, deck))
    E = dict(zip(EDGE_NAMES, edge))
    U = dict(zip(UNDER_NAMES, under))
    w = bake(D, E, U, rot, side, fw, fh, furnish_world)
    dd, _ = load("dist_deck")
    de, _ = load("dist_edge")
    du, _ = load("dist_under")
    dr, _ = load("dist_rotor")
    ds, _ = load("dist_rotor_side")
    d = bake(dict(zip(deck_names, dd)), dict(zip(EDGE_NAMES, de)), dict(zip(UNDER_NAMES, du)), dr, ds, 12, 10,
             furnish_dist)
    out = Image.new("RGBA", (w.width + d.width + 24, max(w.height, d.height) + 16))
    from c4 import rgb
    # the World's sky is deeper (higher), the District's as it is
    out.paste(rgb(P["sky0"]) + (255,), (0, 0, w.width + 12, out.height))
    out.paste(rgb(P["sky1"]) + (255,), (w.width + 12, 0, out.width, out.height))
    out.alpha_composite(w, (6, 8))
    out.alpha_composite(d, (w.width + 18, 8))
    out.save(OUT / "wplat_look.png")
    scale(out, 2).save(OUT / "wplat_look@2x.png")
    # the World alone at 3x, the plaza and the first rows
    scale(w.crop((0, 0, w.width, 8 * T)), 3).save(OUT / "wplat_plaza@3x.png")


if __name__ == "__main__":
    build()
