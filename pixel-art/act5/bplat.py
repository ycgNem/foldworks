"""Beyond, the fifth floor (docs/endgame.md, Milestone 10: `HIGH.beyond`, depth-4 modules, its own
carriers, Dock, Hopper and Bay): the highest platform of all, above the weather and the day. The
Factory is riveted pale steel, the District white plate and brass, the World sunlit cloud-white and
gold; **Beyond is night**: deep blue plate (iron0, lit iron1) sown with tiny stars, a gold star
where the plaza's inlays cross, polished silver trim (the steel ramp at its lightest) instead of
gold, warm lamp caps on the kerb posts (the only warm light up there), skylights onto black and
stars (almost no sky below: the cloud sea is gone), a dark face with silver portholes onto the
night, a silver truss. It floats on **star pods**, not rotors: a silver can holding a little caged
star, a ring orbiting it (the higher you go, the less a propeller makes sense).

Frame-compatible with the World's sheets (names and order as pixel-art/act3/dplat.py and act4's
wplat.py), so the District renderer is reused with a prefix:

- beyond_deck 16x16 x16 (plain_nw .. vent_se, tread0, tread1, floor0, floor1)
- beyond_edge 16x16 x28 (m0..m15, in_*, cut_*, seam_deck, seam_tread, seam_n, seam_s)
- beyond_under 16x16 x9 (face_l face face_r face_splice truss_l truss truss_r face_lr face2)
- beyond_rotor 64x32 x4, fps 8, anchor (32, 0): the star pod under the truss (as world_rotor)
- beyond_rotor_side 48x32 x8, fps 8, anchor (45, 15), names w0..w3 e0..e3: a star pod on an
  outrigger (an extra sheet: without it the renderer falls back to fplat_rotor_side's propellers)
- beyond_module 16x16 x4, fps 6, "icon": [4, 6]: the depth-4 module building (an extra sheet, as
  world_module): brass columns and band (the module cue) under a night-glass dome with stars and
  a silver ring orbiting it; the window well is the same 8x8 at x+4, y+6
- beyond_dock, beyond_hopper 32x32 x3 fps 3; beyond_bay 32x32 x5 fps 6 (empty stage1 stage2 run1
  run2): the Bay builds an armillary sphere with a star at its heart.

`python bplat.py` writes them and out/bplat_look@2x.png (Beyond beside the World, from the real
sheets, couriers and barges flying, modules with items5 in their wells).
"""
import math

from PIL import Image

from c5 import (INK, INK1, INK2, L1, L2, L3, OUT, P, SRC_ART, get, hline, hsh, load, new, outline, put, rect, rgb,
                scale, ship, vline)
import dests3  # noqa: E402  (pixel-art/act3, on the path through c4)
import dplat  # noqa: E402
import mods3  # noqa: E402

T = 16
# the swap: dplat's/dests3's colour globals (read at call time) -> Beyond's
BEYOND = {
    "S1": P["ink1"], "S2": P["ink1"], "S3": P["steel0"], "S4": P["iron0"], "W0": P["iron1"],
    "B0": P["steel1"], "B1": P["steel2"], "B2": P["steel3"], "B3": P["steel4"],
    "GL0": P["ink"], "GL1": P["ink1"], "GL2": P["ink2"], "GL3": P["cloud3"], "CL1": P["slag1"], "CL2": P["violet"],
}
SILVER = [P["steel1"], P["steel2"], P["steel3"], P["steel4"]]


def swap(mod, colours):
    saved = {k: getattr(mod, k) for k in colours if hasattr(mod, k)}
    for k, v in colours.items():
        if hasattr(mod, k):
            setattr(mod, k, v)
    return saved


def is_c(img, x, y, *names):
    p = get(img, x, y)
    return p[3] and any(p[:3] == rgb(P[n]) for n in names)


# ================================================================ the deck
def stars(f, name, seed, every=41):
    """Tiny stars sown on the plate's open fill (never on a rivet, inlay or bevel): one in ~40
    pixels, mostly cool white, now and then warm."""
    f = f.copy()
    for y in range(2, 15):
        for x in range(2, 15):
            if not is_c(f, x, y, "iron0"):
                continue
            if not all(is_c(f, x + dx, y + dy, "iron0") for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))):
                continue
            h = hsh(x, y, seed)
            if h % every == 0:
                put(f, x, y, P["cloud2"] if h % 3 else P["sky3"])
            elif h % 173 == 1:
                put(f, x, y, P["lamp3"])
    return f


def plate_star(f, name):
    """The plain plates' inlay cross gets a gold star at its heart (the World's gold star, which
    Beyond keeps: the stars are the only gold up here)."""
    f = f.copy()
    q = name[-2:]
    lx = 0 if q[1] == "e" else 15
    ly = 0 if q[0] == "s" else 15
    for (dx, dy, c) in ((0, 0, "lamp3"), (0, 1, "lamp2"), (1, 0, "lamp2"), (0, 2, "brass2"), (2, 0, "brass2")):
        x = lx + (dx if lx == 0 else -dx)
        y = ly + (dy if ly == 0 else -dy)
        put(f, x, y, P[c])
    return f


def floor_tile(v):
    """The build floor where modules stand: one flat slate (steel1) a step lighter and greyer than
    the plaza's night blue, so the buildable area reads, a soft 16 px grid (lit north-west edge
    steel2, shaded south-east steel0), a silver stud; v 1 a hairline seam. No stars: it is the
    quietest tile on the floor so modules and couriers win."""
    img = new(16, 16)
    rect(img, 0, 0, 15, 15, P["steel1"])
    hline(img, 0, 15, 0, P["steel2"])
    vline(img, 0, 0, 15, P["steel2"])
    hline(img, 1, 15, 15, P["steel0"])
    vline(img, 15, 1, 15, P["steel0"])
    put(img, 0, 0, P["steel4"])
    put(img, 1, 1, P["steel0"])
    if v == 1:
        for x in range(3, 13, 2):
            put(img, x, 8, P["steel0"])
    return img


def beyond_sheets():
    saved = swap(dplat, BEYOND)
    old_bands = dplat.BANDS
    W = BEYOND
    dplat.BANDS = {"N": [INK, W["B0"], W["B3"], W["B2"], W["W0"], W["S3"]],
                   "W": [INK, W["B0"], W["B3"], W["B2"], W["W0"], W["S3"]],
                   "S": [INK1, W["B0"], W["B3"], W["B1"], W["S4"]],
                   "E": [INK, INK1, W["B0"], W["B1"], W["S3"]]}
    try:
        deck, names, edge, under, _rot, _side = dplat.frames_all()
    finally:
        dplat.BANDS = old_bands
        swap(dplat, saved)
    out = []
    for i, (f, n) in enumerate(zip(deck, names)):
        if n.startswith("plain_"):
            f = plate_star(f, n)
        if n.startswith(("plain_", "skylight_", "vent_")):
            f = stars(f, n, 11 + i)
        elif n.startswith("tread"):
            f = stars(f, n, 11 + i, every=97)
        out.append(f)
    out[names.index("floor0")] = floor_tile(0)
    out[names.index("floor1")] = floor_tile(1)
    out = [skylight_stars(f, n) for f, n in zip(out, names)]
    under = [face_stars(f) for f in under]
    return out, names, edge, under


def skylight_stars(f, name):
    """The skylights look down on night, not sky: a few stars and a violet wisp in the dark glass."""
    if not name.startswith("skylight_"):
        return f
    f = f.copy()
    for y in range(16):
        for x in range(16):
            if is_c(f, x, y, "ink", "ink1", "ink2") and hsh(x, y, len(name), 5) % 17 == 0:
                put(f, x, y, P["cloud2"] if hsh(x, y) % 2 else P["sky4"])
    return f


def face_stars(f):
    """The portholes onto the night: their glass (ink1 after the swap) gets a star."""
    f = f.copy()
    for y in range(16):
        for x in range(16):
            if is_c(f, x, y, "ink1") and is_c(f, x - 1, y, "ink1") and is_c(f, x, y - 1, "ink1") and x == 8 and y == 6:
                put(f, x, y, P["cloud2"])
    return f


# ================================================================ star pods
def caged_star(img, cx, cy, f, r=3):
    """A small star in a silver cage: a blaze (lamp3 heart, lamp2, lamp1 rim) breathing a step,
    four rays out through the bars."""
    k = [0, 1, 0, -1][f % 4]
    for y in range(cy - r - 1, cy + r + 2):
        for x in range(cx - r - 1, cx + r + 2):
            d = math.hypot(x + 0.5 - cx - 0.5, y + 0.5 - cy - 0.5)
            if d <= r - 0.2:
                put(img, x, y, P["lamp3"] if d < r * 0.45 + 0.3 * k else P["lamp2"] if d < r * 0.8 else P["lamp1"])
    for (dx, dy) in ((0, -1), (1, 0), (0, 1), (-1, 0)):
        for s in range(r, r + 2 + (1 if k > 0 else 0)):
            put(img, cx + dx * s, cy + dy * s, P["lamp2"] if s == r else P["sun"])


def orbit(img, cx, cy, rx, ry, f, front, n=48, dots=6):
    """A thin silver ring tilted round the star, drawn in back and front halves; `dots` gold beads
    ride it and move a step a frame (the turning)."""
    for i in range(n):
        a = i / n * 2 * math.pi
        if (math.sin(a) >= 0) != front:
            continue
        x, y = round(cx + math.cos(a) * rx), round(cy + math.sin(a) * ry)
        put(img, x, y, P["steel4"] if front and math.cos(a) < 0 else P["steel3"] if front else P["steel1"])
    for j in range(dots):
        a = (j / dots + f / (dots * 4)) * 2 * math.pi
        if (math.sin(a) >= 0) != front:
            continue
        put(img, round(cx + math.cos(a) * rx), round(cy + math.sin(a) * ry), P["lamp2"] if front else P["brass1"])


def star_pod(img, cx, top, f, rx=22, ry=4):
    """The pod: a silver can (lit left), a lamp band, an open cage under it with the star, the ring
    round the cage."""
    sy = top + 15
    orbit(img, cx, sy, rx, ry, f, False)
    body = new(img.width, img.height)
    r, h = 6, 9
    for y in range(top, top + h + 1):
        for x in range(cx - r, cx + r + 1):
            u = (x + 0.5 - cx) / (r + 0.5)
            if abs(u) > 1:
                continue
            put(body, x, y, P["steel4"] if u < -0.5 else P["steel3"] if u < 0.1 else P["steel2"] if u < 0.6 else P["steel1"])
    # a dome cap and a band of dark windows with one warm one (it is lived in)
    hline(body, cx - r, cx + r, top, P["steel2"])
    for x in range(cx - r + 1, cx + r, 2):
        put(body, x, top + 4, P["ink2"])
    put(body, cx - 2, top + 4, L2)
    hline(body, cx - r, cx + r, top + h, P["steel1"])
    # the cage: four silver bars down from the can to a ring under the star
    for x in (cx - 4, cx - 1, cx + 2, cx + 5):
        for y in range(top + h + 1, sy + 5):
            if abs(x - cx - 0.5) + 0 <= 6:
                put(body, x, y, P["steel3"] if x < cx else P["steel2"])
    hline(body, cx - 4, cx + 5, sy + 5, P["steel2"])
    put(body, cx - 4, sy + 5, P["steel3"])
    body = outline(body, INK)
    img.alpha_composite(body)
    caged_star(img, cx, sy, f)
    orbit(img, cx, sy, rx, ry, f, True)


def rotor(f):
    """64x32 under the truss: two silver struts down to the star pod (anchor (32, 0))."""
    img = new(64, 32)
    st = new(64, 32)
    for x in (28, 35):
        vline(st, x, 0, 4, P["steel3"])
        vline(st, x + 1, 0, 4, P["steel1"])
    img.alpha_composite(outline(st, INK))
    star_pod(img, 32, 4, f, rx=26, ry=3)
    return img


def rotor_side(f, east):
    """48x32 off a side face: a slim silver beam on a brace, a bolted root plate, the pod on its end
    (anchor (45, 15) on the west face; drawn per side so the light stays top-left)."""
    img = new(48, 32)

    def X(u):
        return (2 + u) if east else (45 - u)
    body = new(48, 32)
    for u in range(0, 20):
        x = X(u)
        put(body, x, 13, P["steel4"])
        put(body, x, 14, P["steel3"])
        put(body, x, 15, P["steel1"])
    for k in range(0, 9):
        put(body, X(k + 3), 25 - k, P["steel3"])
    for y in range(11, 28):
        put(body, X(0), y, P["steel4"] if not east else P["steel3"])
        put(body, X(1), y, P["steel3"] if not east else P["steel2"])
        put(body, X(2), y, P["steel2"])
    for y in (13, 23):
        put(body, X(1), y, P["steel0"])
    img.alpha_composite(outline(body, INK))
    pod = new(48, 32)
    star_pod(pod, X(26), 1, f + (2 if east else 0), rx=12, ry=3)
    img.alpha_composite(pod)
    return img


# ================================================================ the module
BMOD = [
    ".......kk.......",
    ".....kkNNkk.....",
    "...kkNnwnnNkk...",
    ".SSkNnnnsnnNkSs.",
    ".kNnsnnnnnwnnNk.",
    "kQQQQQQQQQQQQqbk",
    "kQqQkkkkkkkkqqbk",
    "kQqQKKKKKKKKjqbk",
    "kqQQKKKKKKKKjqbk",
    "kQqQKKKKKKKKjqbk",
    "kqQQKKKKKKKKjqok",
    "kQqQKKKKKKKKjqok",
    "fFqQKKKKKKKKjqok",
    "ffFQKKKKKKKKjqok",
    "fffFbbbbbbbbbbok",
    "kkkWWWWWWWWWWWwk",
]
BKEY = {"N": P["slag1"], "n": P["ink2"], "w": P["cloud2"], "s": P["violet"], "S": P["steel4"]}


def module_frame(f):
    """A depth-4 module: brass columns and band (STYLE.md's module cue), a night-glass dome with
    stars, a silver ring round it; working: a star in the dome twinkles, a glint rides the ring and
    one runs round the window frame. Frame 0 still; the top-right 4x4 never changes."""
    img = mods3.grid(BMOD, {**mods3.KEY, **BKEY}, 16, 16)
    tw = [(7, 2), (9, 4), (5, 4), (8, 3)][f % 4]
    if f:
        put(img, tw[0], tw[1], P["lamp3"])
    gx = [2, 4, 9, 11][f % 4]
    if f:
        put(img, gx, 3, P["lamp3"])
    g = mods3.FRAME_GLINT[f % 4]
    if g and f:
        put(img, g[0], g[1], L3)
    return img


# ================================================================ dock, hopper, bay
def courier_at_rest(img, x0, y0):
    """The courier (courier.py's paper crane) folded at rest on its cradle, its parcel beside it."""
    import courier
    c = courier.frame(2)
    img.alpha_composite(c, (x0, y0))


def dock(f):
    """A night landing pad: dests3's pad, chase lights and ring in Beyond's colours, a paper-crane
    courier landed on cradle blocks with its parcel, the moss pennant with the gold coin (the Dock's
    "sell" cue on every floor), a lamp post."""
    img = new(32, 32)
    dests3.pad(img)
    dests3.chase(img, 29, f)
    dests3.ring(img, 15, 18, 11, 6)
    for x in (10, 19):
        rect(img, x - 1, 21, x + 2, 23, INK)
        rect(img, x, 21, x + 1, 22, P["steel3"])
    # crates waiting on the pad (the cargo cue)
    dests3.box(img, 21, 13, 26, 18, P["wood4"])
    hline(img, 22, 25, 14, P["wood5"])
    vline(img, 23, 15, 17, P["wood2"])
    dests3.box(img, 23, 9, 27, 13, P["copper2"])
    hline(img, 24, 26, 10, P["copper3"])
    courier_at_rest(img, 6, 9)
    dests3.lantern(img, f, 29, 18)
    dests3.pennant(img, f)
    return img


def bay_floor(img):
    """The Bay's floor and back wall: the night behind a glass screen, stars, a violet wisp."""
    rect(img, 0, 26, 31, 31, INK)
    hline(img, 1, 30, 26, P["steel4"])
    hline(img, 1, 30, 27, P["steel3"])
    rect(img, 1, 28, 30, 29, P["iron0"])
    hline(img, 1, 30, 30, P["steel0"])
    rect(img, 6, 7, 25, 25, P["ink1"])
    for y in range(7, 26):
        for x in range(6, 26):
            h = hsh(x, y, 77)
            if h % 23 == 0:
                put(img, x, y, P["cloud2"] if h % 2 else P["sky3"])
    for x in range(6, 26):
        put(img, x, 19 + round(math.sin(x / 3) * 1), P["slag0"])
    rect(img, 6, 24, 25, 25, P["steel0"])
    hline(img, 6, 25, 24, P["steel2"])


def sphere(img, cy, top_y, full, lit=False, f=0):
    """The Beyond Bay's work in hand (replaces dests3.hull): an armillary sphere on a stand,
    centre x 15.5; full=False, only its lower rings in a scaffold; full, the whole sphere dark; lit,
    a star at its heart and the rings turning."""
    cx, cy = 15.5, 15
    # the stand
    rect(img, 14, 21, 17, 24, P["steel2"])
    hline(img, 14, 17, 21, P["steel4"])
    hline(img, 11, 20, 24, P["steel3"])
    rng = range(48)
    for i in rng:
        a = i / 48 * 2 * math.pi
        # the meridian (a circle), the equator (a flat ellipse) and a tilted ecliptic
        for (rx, ry, tilt, c) in ((6.5, 6.5, 0, "steel3"), (6.5, 2.0, 0, "brass2"), (6.5, 2.5, 0.5, "steel4")):
            if not full and math.sin(a) < -0.2 and ry > 6:
                continue
            ang = a + (f * 0.4 if lit and tilt else 0)
            x = cx + math.cos(ang) * rx
            y = cy + math.sin(ang) * ry + math.cos(ang) * rx * tilt * 0.6
            if not full and y < cy - 1:
                continue
            put(img, round(x - 0.5), round(y - 0.5), P[c])
    if full:
        if lit:
            caged_star(img, 15, 14, f, r=2)
        else:
            rect(img, 15, 14, 16, 15, P["ink2"])
            put(img, 15, 14, P["steel1"])
        put(img, 15, 7, P["steel4"])
        put(img, 16, 7, P["steel2"])


def dests():
    saved3 = swap(dests3, {"S1": P["steel0"], "S2": P["ink1"], "S3": P["steel0"], "S4": P["iron0"],
                           "W0": P["iron1"], "B0": P["steel1"], "B1": P["steel2"], "B2": P["steel3"],
                           "B3": P["steel4"]})
    old_hull, old_floor = dests3.hull, dests3.bay_floor
    dests3.hull, dests3.bay_floor = sphere, bay_floor
    try:
        dk = [dock(f) for f in range(3)]
        hp = [dests3.hopper(f) for f in range(3)]
        by = [dests3.bay("empty"), dests3.bay("stage1"), dests3.bay("stage2"), dests3.bay("run", 0),
              dests3.bay("run", 1)]
    finally:
        dests3.hull, dests3.bay_floor = old_hull, old_floor
        swap(dests3, saved3)
    # the pip corner stays calm: nothing white or lamp-bright in the top-right 4x4
    calm = {rgb(P["cloud3"]): P["cloud1"], rgb(P["lamp3"]): P["steel4"], rgb(P["lamp2"]): P["steel3"]}
    for im in dk + hp + by:
        for y in range(4):
            for x in range(28, 32):
                p = im.getpixel((x, y))
                if p[3] and p[:3] in calm:
                    put(im, x, y, calm[p[:3]])
    return dk, hp, by


# ================================================================ build and look
EDGE_NAMES = dplat.EDGE_NAMES
UNDER_NAMES = dplat.UNDER_NAMES


def build():
    deck, names, edge, under = beyond_sheets()
    rot = [rotor(f) for f in range(4)]
    side = [rotor_side(f, False) for f in range(4)] + [rotor_side(f, True) for f in range(4)]
    night = P["ink1"]
    ship("beyond_deck", deck, extra={"names": names}, bg=night, look=4)
    ship("beyond_edge", edge, extra={"names": EDGE_NAMES}, bg=night, look=4)
    ship("beyond_under", under, extra={"names": UNDER_NAMES}, bg=night, look=4)
    ship("beyond_rotor", rot, fps=8, anchor=(32, 0), bg=night, look=4)
    ship("beyond_rotor_side", side, fps=8, anchor=(45, 15), bg=night, look=4,
         extra={"names": [f"w{i}" for i in range(4)] + [f"e{i}" for i in range(4)]})
    ship("beyond_module", [module_frame(f) for f in range(4)], 6, extra={"icon": [4, 6]}, look=8)
    dk, hp, by = dests()
    ship("beyond_dock", dk, 3, look=6, bg=P["steel1"])
    ship("beyond_hopper", hp, 3, look=6, bg=P["steel1"])
    ship("beyond_bay", by, 6, extra={"names": ["empty", "stage1", "stage2", "run1", "run2"]}, look=6,
         bg=P["steel1"])


# ================================================================ the look
def night_sky(w, h, seed=3):
    """Beyond's backdrop for the mocks (code draws the real one): ink to ink1, stars by hash."""
    img = Image.new("RGBA", (w, h), rgb(P["ink"]) + (255,))
    px = img.load()
    for y in range(h):
        for x in range(w):
            t = y / h
            if t > 0.55 or (t > 0.4 and (x + y) % 2 == 0):
                px[x, y] = rgb(P["ink1"]) + (255,)
            hv = hsh(x, y, seed)
            if hv % 97 == 0:
                px[x, y] = rgb(P["cloud2"] if hv % 3 else P["sky3"]) + (255,)
    return img


def bake(D, E, U, R, Sd, fw, fh, ranchor, furnish):
    """The platform as src/render/district.ts bakes it (DPLAT n 4, s 2, w 2, e 3, wing 1)."""
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
        lft = not on(x - 1, b) or bottom(x - 1) < b
        rgt = not on(x + 1, b) or bottom(x + 1) < b
        k = "face_lr" if lft and rgt else "face_l" if lft else "face_r" if rgt else "face" if x % 2 == 0 else "face2"
        at(U[k], x, b + 1)
        if BX0 < x < BX1 - 1:
            at(U["truss_l" if x == BX0 + 1 else "truss_r" if x == BX1 - 2 else "truss"], x, Y1 + 1)
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
        img.alpha_composite(r, (x - ranchor - ox, (Y1 + 2) * T - 3 - oy))
    for row in (2, fh - 2):
        img.alpha_composite(Sd[0], (BX0 * T - 45 - ox, row * T + 8 - 15 - oy))
        img.alpha_composite(Sd[5], (BX1 * T - 2 - ox, row * T + 8 - 15 - oy))
    furnish(img, ox, oy)
    return img


def fr(name, i=0):
    f, _ = load(name)
    return f[i]


def item_icons():
    out = []
    for nm, n in (("items4", 15), ("items5", 8)):
        im = Image.open(SRC_ART / f"{nm}.png").convert("RGBA")
        out += [im.crop((i * 8, 0, i * 8 + 8, 8)) for i in range(n)]
    return out


def look():
    items = item_icons()

    def furnish_beyond(img, ox, oy):
        for k, (x, y) in enumerate(((1, 1), (3, 4), (6, 2), (8, 6), (4, 8), (10, 3), (12, 8), (2, 10), (9, 10), (13, 1))):
            img.alpha_composite(fr("beyond_module", k % 4), (x * T - ox, y * T - oy))
            img.alpha_composite(items[15 + k % 8], (x * T + 4 - ox, y * T + 6 - oy))
        for (x, y, k) in ((4.6, 2.4, 0), (7.1, 4.6, 1), (5.4, 7.2, 2), (10.2, 6.2, 3), (11.0, 9.1, 1)):
            img.alpha_composite(fr("courier", k), (int(x * T) - ox, int(y * T) - oy))
        for name, (x, y), k in (("beyond_dock", (14, 2), 0), ("beyond_hopper", (14, 5), 0), ("beyond_bay", (0, 10), 3)):
            img.alpha_composite(fr(name, k), (x * T - ox, y * T - oy))

    def furnish_world(img, ox, oy):
        for k, (x, y) in enumerate(((1, 1), (3, 4), (6, 2), (8, 6), (4, 8), (10, 3), (12, 8), (2, 10), (9, 10))):
            img.alpha_composite(fr("world_module", k % 4), (x * T - ox, y * T - oy))
            img.alpha_composite(items[4 + k % 11], (x * T + 4 - ox, y * T + 6 - oy))
        for (x, y, k) in ((4.6, 2.4, 0), (7.1, 4.6, 1), (5.4, 7.2, 2), (10.2, 6.2, 3)):
            img.alpha_composite(fr("barge", k), (int(x * T) - ox, int(y * T) - oy))
        for name, (x, y), k in (("world_dock", (14, 2), 0), ("world_hopper", (14, 5), 0), ("world_bay", (0, 10), 3)):
            img.alpha_composite(fr(name, k), (x * T - ox, y * T - oy))

    def sheets(prefix):
        d, md = load(f"{prefix}_deck")
        e, _ = load(f"{prefix}_edge")
        u, _ = load(f"{prefix}_under")
        r, mr = load(f"{prefix}_rotor")
        s, _ = load(f"{prefix}_rotor_side")
        return (dict(zip(md["names"], d)), dict(zip(EDGE_NAMES, e)), dict(zip(UNDER_NAMES, u)), r, s,
                mr["anchor"][0])
    D, E, U, R, S, ra = sheets("beyond")
    b = bake(D, E, U, R, S, 16, 12, ra, furnish_beyond)
    D, E, U, R, S, ra = sheets("world")
    w = bake(D, E, U, R, S, 16, 12, ra, furnish_world)
    out = Image.new("RGBA", (w.width + b.width + 24, max(w.height, b.height) + 16))
    out.paste(rgb(P["sky0"]) + (255,), (0, 0, w.width + 12, out.height))
    out.alpha_composite(night_sky(b.width + 12, out.height), (w.width + 12, 0))
    out.alpha_composite(w, (6, 8))
    out.alpha_composite(b, (w.width + 18, 8))
    out.save(OUT / "bplat_look@1x.png")
    scale(out, 2).save(OUT / "bplat_look@2x.png")
    bn = night_sky(b.width, b.height)
    bn.alpha_composite(b)
    scale(bn.crop((0, 0, bn.width, 10 * T)), 3).save(OUT / "bplat_plaza@3x.png")
    scale(bn.crop((0, 9 * T, bn.width, bn.height)), 3).save(OUT / "bplat_south@3x.png")


if __name__ == "__main__":
    build()
    look()
