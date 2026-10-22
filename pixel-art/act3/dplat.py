"""The District's sky platform (docs/endgame.md, Milestone 7): higher than the Factory's, brighter
and more elegant. The Factory is riveted pale steel with a dark girder face; the District is
white-painted plate trimmed in polished brass, glass skylights let the sky through the plaza,
the face under the south edge is a white girder with brass portholes, the truss is slim, and the
rotor pods are slim white-and-brass cans with three thin blades that turn faster.

Same sheets, names and order as pixel-art/sky/fplat.py, so src/render/factory.ts's edge logic can
be reused with the District's sheets:

- dist_deck 16x16 x16: the plaza's 32x32 plates by quadrant (plain, skylight, vent: plain_nw ..
  vent_se; frames 0-11 sit where fplat_deck's plain/hatch/vent do), the walk (tread0, tread1), then
  the build floor where modules stand (floor0, floor1: the quietest tiles, a mid grey a step under
  the plaza so the buildable area reads, a soft 16 px grid, a brass stud at one corner).
- dist_edge 16x16 x28: m0..m15 (the kerb by 4-bit mask, N=1 E=2 S=4 W=8 = platform there), in_nw..
  in_se (concave corners), cut_nw..cut_se (convex corner cut masks: opaque = clear the deck), the
  splices seam_deck, seam_tread, seam_n, seam_s. Overlays, exactly as fplat_edge.
- dist_under 16x16 x9: face_l face face_r face_splice truss_l truss truss_r face_lr face2.
- dist_rotor 48x24 x4 fps 16, anchor (24, 0): a slim pod hung under the truss, three thin blades.
- dist_rotor_side 48x32 x8 fps 16 (w0..w3, e0..e3), anchor (45, 15): the outriggers on the side
  faces, as fplat_rotor_side.

`python dplat.py` writes them and out/dplat_look.png (+@3x), a 12x10 District put together the way
factory.ts bakes the Factory's platform.
"""
import math

from PIL import Image

from c3 import (B0, B1, B2, B3, INK, INK1, INK2, L2, L3, OUT, P, S0, S1, S2, S3, S4, clear, get, hline, hsh, new,
                on_bg, outline, put, rect, scale, ship, vline)

W0 = P["cloud2"]          # the white paint's lit edge
CL1, CL2 = P["cloud1"], P["cloud2"]
GL0, GL1, GL2, GL3 = P["sky1"], P["sky2"], P["sky3"], P["sky4"]
T = 16


# ================================================================ the deck
def plate(kind):
    """A 32x32 plaza plate, white-painted: a fine groove west and north, a lit bevel, a soft shade
    south and east, a small brass rivet in each corner. plain: two faint brass inlay lines;
    skylight: a glass panel in a brass frame, the sky under the platform showing through with a
    glint; vent: a round brass grille."""
    img = new(32, 32)
    rect(img, 0, 0, 31, 31, S4)
    hline(img, 0, 31, 0, S2)
    vline(img, 0, 0, 31, S2)
    hline(img, 1, 31, 1, W0)
    vline(img, 1, 1, 31, W0)
    hline(img, 2, 31, 31, S3)
    vline(img, 31, 2, 31, S3)
    for x, y in ((3, 3), (27, 3), (3, 27), (27, 27)):
        put(img, x, y, B3)
        put(img, x + 1, y, B2)
        put(img, x, y + 1, B2)
        put(img, x + 1, y + 1, B1)
    if kind == "plain":
        # a pale brass inlay cross, broken in the middle: quiet, but it says "made with care"
        for i in list(range(8, 14)) + list(range(18, 24)):
            put(img, i, 15, S3)
            put(img, i, 16, W0)
            put(img, 15, i, S3)
            put(img, 16, i, W0)
        put(img, 15, 15, B2)
        put(img, 16, 16, B1)
        put(img, 16, 15, B3)
        put(img, 15, 16, B2)
    elif kind == "skylight":
        # a glass panel 16x16 in a brass frame: the sky below, lighter toward the top-left, a glint
        x0, y0, x1, y1 = 8, 8, 23, 23
        rect(img, x0 - 1, y0 - 1, x1 + 1, y1 + 1, B1)
        hline(img, x0 - 1, x1 + 1, y0 - 1, B3)
        vline(img, x0 - 1, y0 - 1, y1 + 1, B2)
        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 1):
                t = ((x - x0) + (y - y0)) / 30
                put(img, x, y, GL2 if t < 0.35 else GL1 if t < 0.75 else GL0)
        # glazing bars (white) dividing four panes, and a glint
        hline(img, x0, x1, 15, S4)
        vline(img, 15, y0, y1, S4)
        hline(img, x0, x1, 16, S3)
        vline(img, 16, y0, y1, S3)
        for d in range(3):
            put(img, x0 + 2 + d, y0 + 4 - d, GL3)
        put(img, x0 + 10, y0 + 12, GL3)
        put(img, x0 + 11, y0 + 11, GL3)
        # the far cloud sea seen through the bottom-right pane
        for x in range(18, 23):
            put(img, x, 21, CL1)
        put(img, 19, 20, CL2)
    elif kind == "vent":
        # a round brass grille: a ring, five slots
        cx, cy = 15.5, 15.5
        for y in range(9, 23):
            for x in range(9, 23):
                d = math.hypot(x + 0.5 - cx - 0.5, y + 0.5 - cy - 0.5)
                if d <= 6.5:
                    if d > 5.3:
                        a = math.atan2(y - cy, x - cx)
                        put(img, x, y, B3 if math.sin(a + 0.8) < -0.3 else B2 if math.sin(a + 0.8) < 0.4 else B1)
                    else:
                        put(img, x, y, S2 if (y % 2) else INK2)
        for x in range(11, 21):
            if get(img, x, 12)[3] and get(img, x, 12)[:3] == (0x32, 0x29, 0x44):
                pass
    return img


def quarters(img):
    return [img.crop((x, y, x + 16, y + 16)) for y in (0, 16) for x in (0, 16)]


def tread(v):
    """The walk round the build floor: white tread plate, a fine raised dot pattern, a seam south
    and east; v 1 adds a brass deck plate (a small name plate with two screws)."""
    img = new(16, 16)
    rect(img, 0, 0, 15, 15, S4)
    for j, y in enumerate(range(2, 16, 4)):
        for x in range(1 + (j % 2) * 4, 16, 8):
            put(img, x, y, W0)
            put(img, x + 1, y + 1, S3)
    hline(img, 0, 15, 15, S3)
    vline(img, 15, 0, 15, S3)
    if v == 1:
        rect(img, 4, 6, 10, 8, B2)
        hline(img, 4, 10, 6, B3)
        hline(img, 4, 10, 8, B1)
        put(img, 5, 7, B0)
        put(img, 9, 7, B0)
    return img


def floor(v):
    """The build floor (where modules stand): one flat mid grey a step under the plaza so the
    buildable area reads, a soft 16 px grid (a lit north-west edge, a shaded south-east), and a
    tiny brass stud at the north-west corner; v 1 has a hairline seam across the middle."""
    img = new(16, 16)
    rect(img, 0, 0, 15, 15, S3)
    hline(img, 0, 15, 0, S4)
    vline(img, 0, 0, 15, S4)
    hline(img, 1, 15, 15, S2)
    vline(img, 15, 1, 15, S2)
    put(img, 0, 0, B3)
    put(img, 1, 1, B1)
    if v == 1:
        for x in range(3, 13, 2):
            put(img, x, 8, P["cloud0"])
    return img


# ================================================================ the kerb (rim overlays)
R = 6.0
# outer to inner: ink, a polished brass rail, then the white kerb stone and its shade on the deck
BANDS = {
    "N": [INK, B1, B3, B2, W0, S3],
    "W": [INK, B1, B3, B2, W0, S3],
    "S": [B0, B1, B3, B2, S4],
    "E": [INK, B0, B1, B2, S3],
}


def kerb_d(x, y, mask, notch=None):
    """fplat.kerb_d: (distance in from the nearest open edge, that edge's side)."""
    cx, cy = x + 0.5, y + 0.5
    cands = []
    if notch:
        ox = 0 if notch[1] == "w" else 16
        oy = 0 if notch[0] == "n" else 16
        dx, dy = abs(cx - ox), abs(cy - oy)
        return math.hypot(dx, dy), (notch[1].upper() if dx < dy else notch[0].upper())
    if not mask & 1:
        cands.append((cy, "N"))
    if not mask & 4:
        cands.append((16 - cy, "S"))
    if not mask & 8:
        cands.append((cx, "W"))
    if not mask & 2:
        cands.append((16 - cx, "E"))
    for a, b, bit_a, bit_b in (("N", "W", 1, 8), ("N", "E", 1, 2), ("S", "W", 4, 8), ("S", "E", 4, 2)):
        if mask & bit_a or mask & bit_b:
            continue
        ccx = R if b == "W" else 16 - R
        ccy = R if a == "N" else 16 - R
        inx = cx < ccx if b == "W" else cx > ccx
        iny = cy < ccy if a == "N" else cy > ccy
        if inx and iny:
            ddx, ddy = cx - ccx, cy - ccy
            cands.append((R - math.hypot(ddx, ddy), a if abs(ddy) >= abs(ddx) else b))
    if not cands:
        return 99, None
    return min(cands)


def kerb(mask, notch=None):
    img = new(16, 16)
    for y in range(16):
        for x in range(16):
            d, side = kerb_d(x, y, mask, notch)
            if side is None or d < 0:
                continue
            k = int(d)
            if k < len(BANDS[side]):
                put(img, x, y, BANDS[side][k])
    # small brass post caps on the rail every 8 px: a lit dot and its shade
    if not notch:
        for i in (4, 12):
            if not mask & 1 and get(img, i, 2)[3]:
                put(img, i, 1, B3)
                put(img, i, 2, L3)
                put(img, i + 1, 2, B1)
            if not mask & 8 and get(img, 2, i)[3]:
                put(img, 1, i, B3)
                put(img, 2, i, L3)
                put(img, 2, i + 1, B1)
            if not mask & 4 and get(img, i, 13)[3]:
                put(img, i, 13, L3)
                put(img, i + 1, 13, B1)
            if not mask & 2 and get(img, 13, i)[3]:
                put(img, 13, i, B3)
                put(img, 13, i + 1, B0)
    return img


def cut(corner):
    mask = {"nw": 15 & ~(1 | 8), "ne": 15 & ~(1 | 2), "sw": 15 & ~(4 | 8), "se": 15 & ~(4 | 2)}[corner]
    img = new(16, 16)
    for y in range(16):
        for x in range(16):
            d, _ = kerb_d(x, y, mask)
            if d < 0:
                put(img, x, y, INK)
    return img


def seam(kind):
    """A splice strip on a tile's west edge where a lot was bolted on: a fine joint, a brass strap
    3 px wide with two screws. deck/tread run full height; seam_n stops under the north kerb,
    seam_s above the south one."""
    img = new(16, 16)
    y0, y1 = (6, 15) if kind == "n" else (0, 10) if kind == "s" else (0, 15)
    vline(img, 0, y0, y1, S2)
    vline(img, 1, y0, y1, B3)
    vline(img, 2, y0, y1, B2)
    vline(img, 3, y0, y1, B1)
    for y in ((y0 + 3, y0 + 8) if kind in ("n", "s") else (4, 12)):
        if y <= y1:
            put(img, 2, y, B0)
    return img


# ================================================================ under the south edge
def face(kind):
    """The south face, 16 px deep: the kerb's brass lip, a groove, a white-painted web with a lit
    top, a brass porthole (glass and a lamp glint) every other tile, a shaded bottom flange, an ink
    foot. face_l / face_r end it, face_lr is a one-tile face (a wing), face_splice a brass strap."""
    img = new(16, 16)
    hline(img, 0, 15, 0, B3)
    hline(img, 0, 15, 1, B1)
    hline(img, 0, 15, 2, INK2)
    rect(img, 0, 3, 15, 11, S4)
    hline(img, 0, 15, 3, W0)
    hline(img, 0, 15, 11, S3)
    rect(img, 0, 12, 15, 13, S3)
    hline(img, 0, 15, 12, S4)
    hline(img, 0, 15, 14, S2)
    hline(img, 0, 15, 15, INK)
    # a thin brass band along the web
    for x in range(0, 16):
        put(img, x, 9, B2 if x % 4 else B3)
    if kind in ("mid", "l", "r", "lr"):
        # a porthole: a brass ring, sky glass, a warm lamp glint inside
        ring = [(6, 4), (7, 4), (8, 4), (9, 4), (5, 5), (10, 5), (5, 6), (10, 6), (5, 7), (10, 7), (6, 8), (7, 8),
                (8, 8), (9, 8)]
        for x, y in ring:
            put(img, x, y, B3 if (x < 8 and y < 7) else B1)
        rect(img, 6, 5, 9, 7, GL1)
        put(img, 6, 5, GL3)
        put(img, 7, 5, GL2)
        put(img, 9, 7, L2)
        for x in (6, 7, 8, 9):
            put(img, x, 9, B1)
    if kind == "splice":
        rect(img, 4, 4, 11, 10, B2)
        hline(img, 4, 11, 4, B3)
        vline(img, 4, 4, 10, B3)
        hline(img, 5, 11, 10, B0)
        vline(img, 11, 5, 10, B1)
        for x, y in ((6, 6), (9, 6), (6, 8), (9, 8)):
            put(img, x, y, B0)
    if kind in ("l", "lr"):
        vline(img, 0, 0, 15, INK)
        vline(img, 1, 1, 13, W0)
        put(img, 1, 0, B3)
        put(img, 1, 14, S2)
        put(img, 1, 15, INK)
        clear(img, 0, 15)
    if kind in ("r", "lr"):
        vline(img, 15, 0, 15, INK)
        vline(img, 14, 1, 14, S3)
        put(img, 14, 0, B1)
        put(img, 14, 15, INK)
        clear(img, 15, 15)
    return img


def truss(kind):
    """A slim truss under the face: thin brass chords, white struts in a Warren web, sky through
    it; the ends slope in."""
    img = new(16, 16)
    hline(img, 0, 15, 0, S3)
    hline(img, 0, 15, 1, S2)
    hline(img, 0, 15, 10, B3)
    hline(img, 0, 15, 11, B1)
    hline(img, 0, 15, 12, INK)
    for k in range(2, 10):
        t = (k - 2) / 7
        xa = round(1 + t * 6)
        xb = round(14 - t * 6)
        put(img, xa, k, S4)
        put(img, xb, k, S3)
    vline(img, 0, 2, 9, S4)
    put(img, 7, 9, B2)
    put(img, 8, 9, B2)
    if kind == "l":
        for y in range(16):
            for x in range(0, 13 - y):
                clear(img, x, y)
        for y in range(13):
            x = 13 - y
            put(img, x - 1, y, INK)
            put(img, x, y, S4)
    elif kind == "r":
        for y in range(16):
            for x in range(y + 3, 16):
                clear(img, x, y)
        for y in range(13):
            x = y + 2
            put(img, x, y, S3)
            put(img, x + 1, y, INK)
    return img


# ================================================================ rotors
def blades3(img, cx, cy, rx, ry, ang, tip=P["red"]):
    """Three thin blades through the hub at `ang` (120 degrees apart), foreshortened onto an
    ellipse rx x ry: white, lit, with red tips (a slim, quick rotor)."""
    for b in range(3):
        a = ang + b * 2 * math.pi / 3
        for k in range(2, int(rx) + 1):
            t = k / rx
            x = round(cx + math.cos(a) * rx * t)
            y = round(cy + math.sin(a) * ry * t)
            put(img, x, y, tip if t > 0.86 else S4 if math.sin(a) < 0 else W0)


def disc(img, cx, cy, rx, ry, f, front=True):
    """The swept disc: a dotted ellipse in cloud tints, its dashes moving fast with the blades."""
    n = 60
    for i in range(n):
        a = i / n * 2 * math.pi
        if (math.sin(a) >= 0) != front:
            continue
        if (i + f * 3) % 4 >= 2:
            continue
        x, y = round(cx + math.cos(a) * rx), round(cy + math.sin(a) * ry)
        if not get(img, x, y)[3]:
            put(img, x, y, CL2 if math.sin(a) > 0 else CL1)


def pod(img, cx, top, rx, h):
    """A slim white can with brass bands, seen from a little above: lit on its left, a brass cap."""
    for y in range(top, top + h + 1):
        for x in range(cx - rx, cx + rx + 1):
            u = (x + 0.5 - cx) / (rx + 0.5)
            if abs(u) > 1:
                continue
            put(img, x, y, W0 if u < -0.5 else S4 if u < 0.2 else S3 if u < 0.7 else S2)
    for x in range(cx - rx, cx + rx + 1):
        u = (x + 0.5 - cx) / (rx + 0.5)
        if abs(u) <= 1:
            put(img, x, top, B3 if u < 0 else B2)
            put(img, x, top + h - 1, B2 if u < 0.3 else B1)
            put(img, x, top + h, B1 if u < 0.3 else B0)
    # a round lamp port, warm
    put(img, cx - 1, top + h // 2, L3)
    put(img, cx, top + h // 2, L2)


def rotor(f):
    """48x24 under the truss: one thin strut down to a slim pod, the hub, three blades turning a
    third of a turn over the four frames (it reads as faster than the Factory's two blades)."""
    img = new(48, 24)
    cx, cy, rx, ry = 24, 19, 22, 3
    ang = f * math.pi * 2 / 3 / 4 * 1.0 + f * math.pi / 6
    disc(img, cx, cy, rx, ry, f, front=False)
    body = new(48, 24)
    vline(body, 23, 0, 4, S4)
    vline(body, 24, 0, 4, S2)
    pod(body, 24, 4, 4, 10)
    rect(body, 23, 15, 24, 17, S3)
    put(body, 23, 15, S4)
    body = outline(body, INK)
    img.alpha_composite(body)
    blades3(img, cx, cy, rx, ry, ang)
    disc(img, cx, cy, rx, ry, f, front=True)
    put(img, 23, 19, B3)
    put(img, 24, 19, B1)
    return img


def rotor_side(f, east):
    """48x32 off a side face: a slim white beam on a thin brace, a bolted brass root plate, a pod
    on its end and a three-blade rotor on top. Drawn per side so the light stays top-left."""
    img = new(48, 32)

    def X(u):
        return (2 + u) if east else (45 - u)
    cx = X(26)
    disc(img, cx, 5, 21, 4, f, front=False)
    body = new(48, 32)
    for u in range(0, 22):
        x = X(u)
        put(body, x, 13, W0)
        put(body, x, 14, S4)
        put(body, x, 15, S3)
    for k in range(0, 10):
        put(body, X(k + 3), 25 - k, S4)
    for y in range(11, 28):
        put(body, X(0), y, B3 if not east else B2)
        put(body, X(1), y, B2 if not east else B1)
        put(body, X(2), y, B1)
    for y in (13, 23):
        put(body, X(1), y, B0)
    pod(body, cx, 8, 4, 11)
    vline(body, cx - 1, 5, 8, S4)
    vline(body, cx, 5, 8, S2)
    body = outline(body, INK)
    img.alpha_composite(body)
    blades3(img, cx, 5, 21, 4, f * math.pi / 6 + (0.5 if east else 0))
    disc(img, cx, 5, 21, 4, f, front=True)
    put(img, cx - 1, 4, B3)
    put(img, cx, 4, B1)
    return img


# ================================================================ export
DECK_KINDS = ["plain", "skylight", "vent"]
EDGE_NAMES = [f"m{m}" for m in range(16)] + ["in_nw", "in_ne", "in_sw", "in_se", "cut_nw", "cut_ne", "cut_sw",
                                             "cut_se", "seam_deck", "seam_tread", "seam_n", "seam_s"]
UNDER_NAMES = ["face_l", "face", "face_r", "face_splice", "truss_l", "truss", "truss_r", "face_lr", "face2"]


def frames_all():
    deck, names = [], []
    for k in DECK_KINDS:
        deck += quarters(plate(k))
        names += [f"{k}_{c}" for c in ("nw", "ne", "sw", "se")]
    deck += [tread(0), tread(1), floor(0), floor(1)]
    names += ["tread0", "tread1", "floor0", "floor1"]
    edge = [kerb(m) for m in range(16)] + [kerb(15, n) for n in ("nw", "ne", "sw", "se")] + \
        [cut(c) for c in ("nw", "ne", "sw", "se")] + [seam("deck"), seam("tread"), seam("n"), seam("s")]
    under = [face("l"), face("mid"), face("r"), face("splice"), truss("l"), truss("mid"), truss("r"), face("lr"),
             face("plain")]
    rot = [rotor(f) for f in range(4)]
    side = [rotor_side(f, False) for f in range(4)] + [rotor_side(f, True) for f in range(4)]
    return deck, names, edge, under, rot, side


def build():
    deck, names, edge, under, rot, side = frames_all()
    sky = P["sky2"]
    ship("dist_deck", deck, extra={"names": names}, bg=sky, look=4)
    ship("dist_edge", edge, extra={"names": EDGE_NAMES}, bg=sky, look=4)
    ship("dist_under", under, extra={"names": UNDER_NAMES}, bg=sky, look=4)
    ship("dist_rotor", rot, fps=16, anchor=(24, 0), bg=sky, look=4)
    ship("dist_rotor_side", side, fps=16, anchor=(45, 15), bg=sky, look=4,
         extra={"names": [f"w{i}" for i in range(4)] + [f"e{i}" for i in range(4)]})
    look(deck, names, edge, under, rot, side)


# ================================================================ the look: a 12x10 District
def look(deck, deck_names, edge, under, rot, side, fw=12, fh=10, modules=True):
    """The platform as factory.ts bakes the Factory's (plaza north, walk round the build floor,
    kerbs, face, truss, rotors), on the District's sky, with a few modules and skiffs on it if
    their art exists."""
    NX0, NX1, Y0 = -4, fw + 5, -5
    BX0, BX1, Y1 = -2, fw + 3, fh + 2

    def on(x, y):
        if y < Y0 or y >= Y1:
            return False
        x0, x1 = (NX0, NX1) if y < 0 else (BX0, BX1)
        return x0 <= x < x1

    X0, X1 = NX0 - 3, NX1 + 3
    img = Image.new("RGBA", ((X1 - X0) * T, (Y1 - Y0 + 4) * T), (0, 0, 0, 0))
    ox, oy = X0 * T, Y0 * T
    D = dict(zip(deck_names, deck))
    E = dict(zip(EDGE_NAMES, edge))
    U = dict(zip(UNDER_NAMES, under))

    def at(im, x, y, op=None):
        px, py = x * T - ox, y * T - oy
        if op == "cut":
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
                at(D[f"floor{1 if hsh(x, y, 5) % 7 == 0 else 0}"], x, y)
                continue
            if y < 0:
                qx, qy = x % 2, y % 2
                px, py = x - qx, y - qy
                whole = all(on(px + a, py + b) for a in (0, 1) for b in (0, 1)) and py + 1 < 0
                kind = DECK_KINDS[[0, 0, 1, 0, 0, 2, 0][hsh(x // 2, y // 2, 7) % 7]] if whole else "plain"
                at(D[f"{kind}_{'ns'[qy]}{'we'[qx]}"], x, y)
            else:
                at(D[f"tread{1 if hsh(x, y, 3) % 6 == 0 else 0}"], x, y)
    for y in range(Y0, Y1):
        for x in range(X0, X1):
            if not on(x, y) or (0 <= x < fw and 0 <= y < fh):
                continue
            m = (on(x, y - 1) and 1) | (on(x + 1, y) and 2) | (on(x, y + 1) and 4) | (on(x - 1, y) and 8)
            for c, bits in (("nw", 9), ("ne", 3), ("sw", 12), ("se", 6)):
                if not m & bits:
                    at(E["cut_" + c], x, y, "cut")
            at(E[f"m{m}"], x, y)
            for c, (dx, dy, bits) in (("nw", (-1, -1, 9)), ("ne", (1, -1, 3)), ("sw", (-1, 1, 12)),
                                      ("se", (1, 1, 6))):
                if (m & bits) == bits and not on(x + dx, y + dy):
                    at(E["in_" + c], x, y)
    span = BX1 - BX0 - 2
    n = max(2, round(span / 5))
    for i in range(n):
        x = round((BX0 + 1 + (i + 0.5) * span / n) * T)
        img.alpha_composite(rot[i % 4], (x - 24 - ox, (Y1 + 2) * T - 4 - oy))
    for row in (2, fh - 2):
        img.alpha_composite(side[0], (BX0 * T - 45 - ox, row * T + 8 - 15 - oy))
        img.alpha_composite(side[5], (BX1 * T - 2 - ox, row * T + 8 - 15 - oy))
    if modules:
        _furnish(img, ox, oy)
    out = on_bg(img, P["sky1"])
    out.save(OUT / "dplat_look.png")
    scale(out, 3).save(OUT / "dplat_look@3x.png")


def _furnish(img, ox, oy):
    """Modules, routes' skiffs, the Dock, Hopper and Bay if their art is built (a mock only)."""
    from c3 import SRC_ART
    import json

    def load(name, i=0):
        p = SRC_ART / f"{name}.png"
        if not p.exists():
            return None
        im = Image.open(p).convert("RGBA")
        fw, fh = json.loads((SRC_ART / f"{name}.json").read_text())["frame"]
        return im.crop((i * fw, 0, i * fw + fw, fh))

    mod = load("dist_module")
    items = Image.open(SRC_ART / "items3.png").convert("RGBA") if (SRC_ART / "items3.png").exists() else None
    if mod:
        for k, (x, y) in enumerate(((1, 1), (2, 4), (5, 2), (7, 6), (3, 7), (8, 3))):
            img.alpha_composite(load("dist_module", k % 4), (x * T - ox, y * T - oy))
            if items:
                ic = items.crop(((k * 3 % 19) * 8, 0, (k * 3 % 19) * 8 + 8, 8))
                img.alpha_composite(ic, (x * T + 4 - ox, y * T + 5 - oy))
    sk = load("skiff")
    if sk:
        for (x, y) in ((3.4, 2.6), (6.2, 4.4), (4.6, 6.1)):
            img.alpha_composite(sk, (int(x * T) - ox, int(y * T) - oy))
    for name, (x, y) in (("dist_dock", (10, 2)), ("dist_hopper", (10, 5)), ("dist_bay", (0, 8))):
        s = load(name)
        if s:
            img.alpha_composite(s, (x * T - ox, y * T - oy))


if __name__ == "__main__":
    build()
