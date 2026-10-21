"""The Factory's sky platform (docs/sky-island.md, production): a riveted steel deck held up by brass
rotors, higher up than the island. The Workshop is grown (grass, paving, earth); the Factory is
built: pale steel plate with brass trim on top, a dark girder face and a truss under it, brass
rotor pods hung under the south edge and on outriggers off the side faces.

Every frame is drawn here, pixel by pixel; `python fplat.py` (from this folder) writes the strips
and sidecars to out/ (with @4x looks) and copies them to src/art/, and writes out/fplat_look.png
(+@3x), a 12x8 Factory platform put together the way src/render/factory.ts bakes it.

The sheets (src/render/factory.ts is their only reader):
- fplat_deck 16x16 x14: the plaza's 32x32 plates by quadrant (plain, hatch, vent: plain_nw..
  vent_se), the walk's tread (tread0, tread1).
- fplat_edge 16x16 x28: OVERLAYS drawn over the deck. 0..15 the brass-capped kerb by 4-bit mask
  (N=1 E=2 S=4 W=8 = platform there; 15 is empty), 16..19 the kerb round a concave corner
  (in_nw, in_ne, in_sw, in_se: the diagonal neighbour is sky), 20..23 the cut masks for a convex
  corner (cut_nw..cut_se: opaque = clear the deck there), 24..27 a bolted splice strip along a
  tile's west edge where an annex block meets the hall (seam_deck, seam_tread, seam_n, seam_s).
- fplat_under 16x16 x8: the south face (face_l, face, face_r, face_splice), the truss under it
  (truss_l, truss, truss_r), and a face end cap for a wing's west/east underside (face_lr).
- fplat_rotor 48x24 x4 fps 12, anchor (24, 0): a brass pod hung under the truss, its rotor disc
  under it seen from a little above, two blades turning.
- fplat_rotor_side 48x32 x8 fps 12 (w0..w3, e0..e3), anchor on the face (w: (45, 15), e: (2, 15)):
  an outrigger bracket off a side face, a brass can on its end, a rotor turning on top.
"""
import json
import math
import shutil

from PIL import Image

from common import OUT, P, SRC_ART, T, export, frame_of, get, hsh, new, on_bg, outline, put, rect, scale

INK, INK1, INK2 = P["ink"], P["ink1"], P["ink2"]
S0, S1, S2, S3, S4 = (P[f"steel{i}"] for i in range(5))
B0, B1, B2, B3 = (P[f"brass{i}"] for i in range(4))
L2, L3 = P["lamp2"], P["lamp3"]
CL0, CL1, CL2, CL3 = (P[f"cloud{i}"] for i in range(4))


def hline(img, x0, x1, y, c):
    for x in range(x0, x1 + 1):
        put(img, x, y, c)


def vline(img, x, y0, y1, c):
    for y in range(y0, y1 + 1):
        put(img, x, y, c)


def rivet(img, x, y, lit=S4, dark=S1, body=None):
    """A 2x2 rivet head lit from the top-left: lit, body, body, shadow."""
    put(img, x, y, lit)
    put(img, x + 1, y, body or lit)
    put(img, x, y + 1, body or lit)
    put(img, x + 1, y + 1, dark)


# ================================================================ the deck
def plate(kind):
    """A 32x32 plaza plate: a groove round it (ink2 on the west and north, where the plate before
    it ends), a lit bevel, a soft shade on its south and east, a brass rivet in each corner.
    kind 'plain' has a faint cross of tread in the middle, 'hatch' a recessed lid with a brass
    ring pull, 'vent' a louvred grille."""
    img = new(32, 32)
    rect(img, 0, 0, 31, 31, S3)
    hline(img, 0, 31, 0, S1)
    vline(img, 0, 0, 31, S1)
    hline(img, 1, 31, 1, S4)
    vline(img, 1, 1, 31, S4)
    hline(img, 2, 31, 31, S2)
    vline(img, 31, 2, 31, S2)
    for x, y in ((3, 3), (27, 3), (3, 27), (27, 27)):
        put(img, x, y, B3)
        put(img, x + 1, y, B2)
        put(img, x, y + 1, B2)
        put(img, x + 1, y + 1, B0)
        put(img, x + 2, y + 1, S2)
        put(img, x + 1, y + 2, S2)
    if kind == "plain":
        # a few raised lozenges round the middle: tread worn smooth where people walk
        for x, y in ((12, 11), (18, 11), (15, 14), (12, 17), (18, 17), (21, 14), (9, 14)):
            put(img, x, y, S4)
            put(img, x + 1, y - 1, S4)
            put(img, x + 1, y, S2)
    elif kind == "hatch":
        # a recessed lid 14x14: dark seam, lit lip below-right (it sits lower), two hinges, a ring
        x0, y0, x1, y1 = 9, 9, 22, 22
        rect(img, x0, y0, x1, y1, S2)
        hline(img, x0, x1, y0, S1)
        vline(img, x0, y0, y1, S1)
        hline(img, x0 + 1, x1, y1, S4)
        vline(img, x1, y0 + 1, y1, S4)
        hline(img, x0 + 1, x1 - 1, y0 + 1, S3)
        vline(img, x0 + 1, y0 + 1, y1 - 1, S3)
        for hy in (12, 18):
            put(img, x0 + 2, hy, S1)
            put(img, x0 + 3, hy, S1)
        # the ring pull, brass
        for dx, dy in ((0, -1), (1, -1), (-1, 0), (2, 0), (-1, 1), (2, 1), (0, 2), (1, 2)):
            put(img, 16 + dx, 15 + dy, B2 if dy < 1 else B1)
        put(img, 16, 14, B3)
    elif kind == "vent":
        # a louvred grille 16x10: five slats, each lit on top and dark under
        x0, y0, x1, y1 = 8, 11, 23, 20
        rect(img, x0, y0, x1, y1, S1)
        for y in range(y0 + 1, y1, 2):
            hline(img, x0 + 1, x1 - 1, y, S3)
            hline(img, x0 + 1, x1 - 1, y + 1, S0)
        hline(img, x0, x1, y1 + 1, S4)
        vline(img, x1 + 1, y0, y1 + 1, S4)
        hline(img, x0, x1, y0 - 1, S2)
    return img


def quarters(img):
    return [img.crop((x, y, x + 16, y + 16)) for y in (0, 16) for x in (0, 16)]


def tread(v):
    """The walk round the hall: tread plate, the same pale steel as the plaza, a fine raised
    lozenge pattern (two orientations, alternating) and a faint seam on the south and east."""
    img = new(16, 16)
    rect(img, 0, 0, 15, 15, S3)
    for j, y in enumerate(range(2, 16, 4)):
        for i, x in enumerate(range(1 + (j % 2) * 4, 16, 8)):
            if j % 2:
                put(img, x, y, S4)
                put(img, x + 1, y - 1, S4)
                put(img, x + 1, y, S2)
            else:
                put(img, x, y - 1, S4)
                put(img, x + 1, y, S4)
                put(img, x, y, S2)
    hline(img, 0, 15, 15, S2)
    vline(img, 15, 0, 15, S2)
    if v == 1:
        # a pair of countersunk bolts where the tread plate is fixed down
        for x in (2, 12):
            put(img, x, 12, S2)
            put(img, x + 1, 13, S4)
    return img


# ================================================================ the kerb (rim overlays)
R = 6.0  # a convex corner's radius
# band colours, outer to inner, by the side the band runs along. North and west kerbs cast a shade
# onto the deck inside them (light from the top-left); the south kerb's outer band is the lip the
# girder face hangs from (no ink: the face carries on below it).
BANDS = {
    "N": [INK, B1, B3, B2, S2],
    "W": [INK, B1, B3, B2, S2],
    "S": [B0, B1, B2, B3],
    "E": [INK, B0, B1, B2],
}


def kerb_d(x, y, mask, notch=None):
    """(d, side) for a pixel's centre: d its distance in from the nearest open edge (negative
    outside the rounded corners), side the edge's name. `notch`: a concave corner instead
    ('nw' 'ne' 'sw' 'se': the diagonal is sky)."""
    cx, cy = x + 0.5, y + 0.5
    cands = []
    if notch:
        ox = 0 if notch[1] == "w" else 16
        oy = 0 if notch[0] == "n" else 16
        dx, dy = abs(cx - ox), abs(cy - oy)
        d = math.hypot(dx, dy)
        side = (notch[1].upper() if dx < dy else notch[0].upper())
        return d, side
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
            bands = BANDS[side]
            k = int(d)
            if k < len(bands):
                put(img, x, y, bands[k])
    # rivets on the brass cap every 8 px along each straight open side (dark dots on the lit band)
    if not notch:
        for i in (3, 11):
            if not mask & 1 and get(img, i, 2)[3]:
                put(img, i, 2, B0)
                put(img, i + 1, 2, B1)
            if not mask & 8 and get(img, 2, i)[3]:
                put(img, 2, i, B0)
                put(img, 2, i + 1, B1)
            if not mask & 4 and get(img, i, 14)[3]:
                put(img, i, 14, B3)
                put(img, i + 1, 13, B0)
            if not mask & 2 and get(img, 13, i)[3]:
                put(img, 13, i, B3)
                put(img, 14, i + 1, B0)
    return img


def cut(corner):
    """Opaque where the deck is cleared at a convex corner (both its sides open)."""
    mask = {"nw": 15 & ~(1 | 8), "ne": 15 & ~(1 | 2), "sw": 15 & ~(4 | 8), "se": 15 & ~(4 | 2)}[corner]
    img = new(16, 16)
    for y in range(16):
        for x in range(16):
            d, _ = kerb_d(x, y, mask)
            if d < 0:
                put(img, x, y, INK)
    return img


def seam(kind):
    """A bolted splice strip on a tile's west edge (where an annex block was bolted on): a darker
    joint, a lit strap 3 px wide, two bolts. deck/tread run the full height; seam_n stops under
    the north kerb, seam_s above the south one."""
    img = new(16, 16)
    y0, y1 = (5, 15) if kind == "n" else (0, 11) if kind == "s" else (0, 15)
    vline(img, 0, y0, y1, S1)
    vline(img, 1, y0, y1, S4)
    vline(img, 2, y0, y1, S3)
    vline(img, 3, y0, y1, S2)
    for y in (y0 + 3, y0 + 9) if kind in ("n", "s") else (4, 12):
        if y + 1 <= y1:
            put(img, 1, y, B3)
            put(img, 2, y, B2)
            put(img, 2, y + 1, B0)
    return img


# ================================================================ under the south edge
def face(kind):
    """The platform's south face, 16 px deep: the kerb's brass front, a groove, a steel web with
    a lit top and brass rivets, stiffeners every 16 px, the bottom flange in shade, an ink foot.
    face_l / face_r end the face (lit west end, dark east end), face_lr is a one-tile face with
    both ends (a wing's underside), face_splice carries a bolted splice plate."""
    img = new(16, 16)
    hline(img, 0, 15, 0, B2)
    hline(img, 0, 15, 1, B0)
    hline(img, 0, 15, 2, INK2)
    rect(img, 0, 3, 15, 11, S2)
    hline(img, 0, 15, 3, S3)
    hline(img, 0, 15, 11, S1)
    rect(img, 0, 12, 15, 13, S1)
    hline(img, 0, 15, 12, S2)
    hline(img, 0, 15, 14, S0)
    hline(img, 0, 15, 15, INK)
    # brass rivets along the web, every 4 px
    for x in range(1, 16, 4):
        put(img, x, 7, B3)
        put(img, x + 1, 7, B2)
        put(img, x + 1, 8, S1)
    if kind in ("mid", "l", "r"):
        # a stiffener every other tile: a lit flat bar standing on the web
        vline(img, 7, 4, 10, S3)
        vline(img, 8, 4, 10, S1)
        put(img, 7, 4, S4)
        put(img, 7, 7, B3)
        put(img, 8, 7, B1)
    if kind == "splice":
        rect(img, 4, 4, 11, 10, S3)
        hline(img, 4, 11, 4, S4)
        vline(img, 4, 4, 10, S4)
        hline(img, 5, 11, 10, S1)
        vline(img, 11, 5, 10, S1)
        for x, y in ((5, 5), (9, 5), (5, 8), (9, 8)):
            put(img, x, y, B3)
            put(img, x + 1, y + 1, B0)
    if kind in ("l", "lr"):
        vline(img, 0, 0, 15, INK)
        vline(img, 1, 1, 13, S3)
        put(img, 1, 0, B3)
        put(img, 1, 14, S1)
        put(img, 1, 15, INK)
        clear_px(img, 0, 15)
    if kind in ("r", "lr"):
        vline(img, 15, 0, 15, INK)
        vline(img, 14, 1, 14, S0)
        put(img, 14, 0, B1)
        put(img, 14, 15, INK)
        clear_px(img, 15, 15)
    return img


def clear_px(img, x, y):
    if 0 <= x < img.width and 0 <= y < img.height:
        img.putpixel((x, y), (0, 0, 0, 0))


def truss(kind):
    """The truss under the face (inset a tile each end): a top chord, a bottom chord, a Warren
    web of diagonals with the sky through it, gusset plates where they meet. Ends slope in."""
    img = new(16, 16)
    # chords
    hline(img, 0, 15, 0, S1)
    hline(img, 0, 15, 1, S0)
    hline(img, 0, 15, 11, S3)
    hline(img, 0, 15, 12, S2)
    hline(img, 0, 15, 13, S1)
    hline(img, 0, 15, 14, INK)
    # the web: a V from each top corner to the bottom middle, and from the bottom ends up
    for k in range(2, 11):
        t = (k - 2) / 8
        xa = round(1 + t * 6)
        xb = round(14 - t * 6)
        put(img, xa, k, S3)
        put(img, xa + 1, k, S1)
        put(img, xb, k, S2)
        put(img, xb + 1, k, S1)
    vline(img, 0, 2, 10, S2)
    vline(img, 15, 2, 10, S1)
    # gussets: brass-bolted plates at the panel points
    for gx, gy in ((7, 9), (0, 1)):
        put(img, gx, gy, B2)
        put(img, gx + 1, gy, B1)
    if kind == "l":
        for y in range(16):
            for x in range(0, 15 - y):
                clear_px(img, x, y)
        for y in range(15):
            x = 15 - y
            put(img, x - 1, y, INK)
            put(img, x, y, S3)
            if x + 1 < 16:
                put(img, x + 1, y, S1)
    elif kind == "r":
        for y in range(16):
            for x in range(y + 1, 16):
                clear_px(img, x, y)
        for y in range(15):
            x = y
            if x - 1 >= 0:
                put(img, x - 1, y, S2)
            put(img, x, y, S1)
            put(img, x + 1, y, INK)
    clear_px(img, 0, 15)
    for x in range(16):
        if get(img, x, 14)[3] == 0:
            continue
    return img


# ================================================================ rotors
def blades(img, cx, cy, rx, ry, ang, tip=B2):
    """Two blades through the hub at angle `ang`, foreshortened onto an ellipse rx x ry; the lit
    top edge steel4, the blade steel2, brass tips."""
    for s in (1, -1):
        for k in range(3, int(rx) + 1):
            t = k / rx
            x = round(cx + s * math.cos(ang) * rx * t)
            y = round(cy + s * math.sin(ang) * ry * t)
            near_tip = t > 0.82
            put(img, x, y, tip if near_tip else S4)
            put(img, x, y + 1, B1 if near_tip else S2)


def disc(img, cx, cy, rx, ry, f, front=True):
    """The swept disc as a dotted ellipse in cloud tints (air, not metal), its dashes moving with
    the blades: the front half drawn after the hub, the back half before."""
    n = 56
    for i in range(n):
        a = i / n * 2 * math.pi
        if (math.sin(a) >= 0) != front:
            continue
        if (i + f * 2) % 4 >= 2:
            continue
        x, y = round(cx + math.cos(a) * rx), round(cy + math.sin(a) * ry)
        if not get(img, x, y)[3]:
            put(img, x, y, CL2 if math.sin(a) > 0 else CL1)


def can(img, cx, top, rx, h, ry=3):
    """A brass can standing up (seen from a little above): a lit top ellipse, a body shaded
    round its curve, a rivet band, an ink rim at the foot."""
    for y in range(top, top + h + ry + 1):
        for x in range(cx - rx, cx + rx + 1):
            u = (x + 0.5 - cx) / (rx + 0.5)
            if abs(u) > 1:
                continue
            foot = top + h + ry * math.sqrt(max(0, 1 - u * u))
            head = top + ry - ry * math.sqrt(max(0, 1 - u * u))
            if y < head or y > foot:
                continue
            put(img, x, y, B3 if u < -0.45 else B2 if u < 0.25 else B1 if u < 0.75 else B0)
    # the top ellipse
    for y in range(top, top + 2 * ry + 1):
        for x in range(cx - rx, cx + rx + 1):
            dx, dy = (x + 0.5 - cx) / (rx + 0.5), (y + 0.5 - top - ry) / (ry + 0.5)
            if dx * dx + dy * dy <= 1:
                put(img, x, y, B3 if dx + dy < -0.3 else B2)
    # a rivet band two thirds down
    by = top + ry + (h * 2) // 3
    for x in range(cx - rx, cx + rx + 1):
        u = (x + 0.5 - cx) / (rx + 0.5)
        if abs(u) <= 1 and get(img, x, by)[3]:
            put(img, x, by, B0 if (x - cx) % 3 else B3)


def rotor(f):
    """48x24 under the truss: two struts down to a brass pod (a nacelle lit top-left, a band of
    rivets, a glowing lamp port), the hub, the rotor disc under it seen from a little above."""
    W, H = 48, 24
    img = new(W, H)
    cx, cy, rx, ry = 24, 19, 21, 3
    ang = f * math.pi / 4
    # the back half of the swept disc and the far blade go behind the pod
    disc(img, cx, cy, rx, ry, f, front=False)
    # struts
    for y in range(0, 5):
        put(img, 19 + y // 2, y, S3)
        put(img, 20 + y // 2, y, S1)
        put(img, 28 - y // 2, y, S2)
        put(img, 29 - y // 2, y, S1)
    body = new(W, H)
    # the pod: an ellipse 24x11 centred (24, 9)
    for y in range(3, 16):
        for x in range(11, 38):
            dx, dy = (x + 0.5 - 24) / 12.5, (y + 0.5 - 9.5) / 6
            if dx * dx + dy * dy <= 1:
                lam = -dx * 0.55 - dy * 0.85
                put(body, x, y, B3 if lam > 0.55 else B2 if lam > -0.1 else B1 if lam > -0.7 else B0)
    for x in range(12, 37):
        if get(body, x, 11)[3]:
            put(body, x, 11, B0 if (x % 3) else B3)
    # the lamp port
    rect(body, 21, 6, 26, 8, INK1)
    hline(body, 22, 25, 7, L2)
    put(body, 22, 7, L3)
    # the hub
    rect(body, 22, 16, 25, 18, S2)
    hline(body, 22, 23, 16, S4)
    hline(body, 22, 25, 18, S1)
    body = outline(body, INK)
    img.alpha_composite(body)
    # the blades, then the front half of the disc
    blades(img, cx, cy, rx, ry, ang)
    disc(img, cx, cy, rx, ry, f, front=True)
    put(img, 23, 19, S4)
    put(img, 24, 19, S1)
    return img


def rotor_side(f, east):
    """48x32 off a side face: a bracket (a steel beam on a diagonal brace, a bolted root plate on
    the platform's kerb), a brass can on its end, a mast and a rotor turning on top. Drawn for
    the west face, mirrored for the east (the light stays top-left: shading is redone, not
    flipped)."""
    W, H = 48, 32
    img = new(W, H)
    s = 1 if east else -1  # outward direction in x
    # local x: 0 at the root, growing outward
    def X(u):
        return (2 + u) if east else (45 - u)
    cx = X(26)
    # the back half of the disc
    disc(img, cx, 5, 21, 4, f, front=False)
    body = new(W, H)
    # the beam: 4 px deep from the root to the can, lit top
    for u in range(0, 22):
        x = X(u)
        put(body, x, 13, S4)
        put(body, x, 14, S3)
        put(body, x, 15, S2)
        put(body, x, 16, S1)
    # the brace under it: from low on the root plate up to the beam
    for k in range(0, 11):
        x = X(k + 3)
        y = 26 - k
        put(body, x, y, S3)
        put(body, x, y - 1 if False else y + 1, S1)
    # the root plate on the kerb, bolted
    for y in range(11, 29):
        put(body, X(0), y, S3 if not east else S2)
        put(body, X(1), y, S2 if not east else S1)
        put(body, X(2), y, S1)
    for y in (13, 24):
        put(body, X(1), y, B3)
        put(body, X(1), y + 1, B0)
    # the can on the beam's end, its mast
    can(body, cx, 9, 8, 10, 3)
    rect(body, cx - 1, 5, cx, 9, S2)
    vline(body, cx - 1, 5, 9, S3)
    # a lamp on the can's front
    rect(body, cx - 2, 17, cx + 1, 18, INK1)
    put(body, cx - 1, 17, L3)
    put(body, cx, 17, L2)
    body = outline(body, INK)
    img.alpha_composite(body)
    # the hub cap on the mast top, the blades, the front of the disc
    blades(img, cx, 5, 21, 4, f * math.pi / 4 + (0.4 if east else 0))
    disc(img, cx, 5, 21, 4, f, front=True)
    rect(img, cx - 1, 4, cx, 5, S3)
    put(img, cx - 1, 4, S4)
    return img


# ================================================================ export
DECK_KINDS = ["plain", "hatch", "vent"]
EDGE_NAMES = [f"m{m}" for m in range(16)] + ["in_nw", "in_ne", "in_sw", "in_se", "cut_nw", "cut_ne", "cut_sw", "cut_se",
                                             "seam_deck", "seam_tread", "seam_n", "seam_s"]
UNDER_NAMES = ["face_l", "face", "face_r", "face_splice", "truss_l", "truss", "truss_r", "face_lr", "face2"]


def frames_all():
    deck = []
    names = []
    for k in DECK_KINDS:
        q = quarters(plate(k))
        deck += q
        names += [f"{k}_{c}" for c in ("nw", "ne", "sw", "se")]
    deck += [tread(0), tread(1)]
    names += ["tread0", "tread1"]
    edge = [kerb(m) for m in range(16)] + [kerb(15, n) for n in ("nw", "ne", "sw", "se")] + \
        [cut(c) for c in ("nw", "ne", "sw", "se")] + [seam("deck"), seam("tread"), seam("n"), seam("s")]
    under = [face("l"), face("mid"), face("r"), face("splice"), truss("l"), truss("mid"), truss("r"), face("lr"), face("plain")]
    rot = [rotor(f) for f in range(4)]
    side = [rotor_side(f, False) for f in range(4)] + [rotor_side(f, True) for f in range(4)]
    return deck, names, edge, under, rot, side


def ship(name):
    for ext in ("png", "json"):
        shutil.copyfile(OUT / f"{name}.{ext}", SRC_ART / f"{name}.{ext}")


def build():
    deck, deck_names, edge, under, rot, side = frames_all()
    export("fplat_deck", deck, bg=P["sky1"], extra={"names": deck_names})
    export("fplat_edge", edge, bg=P["sky1"], extra={"names": EDGE_NAMES})
    export("fplat_under", under, bg=P["sky1"], extra={"names": UNDER_NAMES})
    export("fplat_rotor", rot, fps=12, anchor=(24, 0), bg=P["sky1"])
    export("fplat_rotor_side", side, fps=12, anchor=(45, 15), bg=P["sky1"],
           extra={"names": [f"w{i}" for i in range(4)] + [f"e{i}" for i in range(4)]})
    for n in ("fplat_deck", "fplat_edge", "fplat_under", "fplat_rotor", "fplat_rotor_side"):
        ship(n)
    look(deck, deck_names, edge, under, rot, side)


# ================================================================ the look: a 12x8 platform
def look(deck, deck_names, edge, under, rot, side, fw=12, fh=8, annex=0):
    """The platform the way factory.ts bakes it (keep the two in step), the hall's floor from
    src/art/tile_factory, on the Factory's sky."""
    NX0, NX1, Y0 = -4, fw + 5, -5
    BX0, BX1, Y1 = -2, fw + 3, fh + 2

    def on(x, y):
        if y < Y0 or y >= Y1:
            return False
        x0, x1 = (NX0, NX1) if y < 0 else (BX0, BX1)
        if x < x0 or x >= x1:
            return False
        return True

    X0, X1 = NX0 - 3, NX1 + 3
    Wpx, Hpx = (X1 - X0) * T, (Y1 - Y0 + 4) * T
    img = Image.new("RGBA", (Wpx, Hpx), (0, 0, 0, 0))
    ox, oy = X0 * T, Y0 * T
    D = dict(zip(deck_names, deck))
    E = dict(zip(EDGE_NAMES, edge))
    U = dict(zip(UNDER_NAMES, under))

    def at(im, x, y, op=None):
        px, py = x * T - ox, y * T - oy
        if op == "cut":
            a = im.split()[3]
            reg = img.crop((px, py, px + 16, py + 16))
            r = reg.split()
            na = Image.eval(r[3], lambda v: v)
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

    # under: the face below each column's lowest tile, the truss under the body
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
    # the deck
    for y in range(Y0, Y1):
        for x in range(X0, X1):
            if not on(x, y):
                continue
            if 0 <= x < fw and 0 <= y < fh:
                continue
            if y < 0:
                qx, qy = x % 2, y % 2
                px, py = x - qx, y - qy
                whole = all(on(px + a, py + b) for a in (0, 1) for b in (0, 1)) and py + 1 < 0
                kind = DECK_KINDS[[0, 0, 0, 1, 0, 2, 0][hsh(x // 2, y // 2, 7) % 7]] if whole else "plain"
                at(D[f"{kind}_{'ns'[qy]}{'we'[qx]}"], x, y)
            else:
                at(D[f"tread{hsh(x, y, 3) % 5 == 0 and 1 or 0}"], x, y)
    # the kerb: cuts, then overlays, then concave corners
    for y in range(Y0, Y1):
        for x in range(X0, X1):
            if not on(x, y) or (0 <= x < fw and 0 <= y < fh):
                continue
            m = (on(x, y - 1) and 1) | (on(x + 1, y) and 2) | (on(x, y + 1) and 4) | (on(x - 1, y) and 8)
            for c, bits in (("nw", 9), ("ne", 3), ("sw", 12), ("se", 6)):
                if not m & bits:
                    at(E["cut_" + c], x, y, "cut")
            at(E[f"m{m}"], x, y)
            for c, (dx, dy, bits) in (("nw", (-1, -1, 9)), ("ne", (1, -1, 3)), ("sw", (-1, 1, 12)), ("se", (1, 1, 6))):
                if (m & bits) == bits and not on(x + dx, y + dy):
                    at(E["in_" + c], x, y)
    # the hall: its floor
    try:
        fl = [frame_of("tile_factory", i) for i in range(2)]
    except Exception:
        fl = None
    for y in range(fh):
        for x in range(fw):
            if fl:
                at(fl[(x + y) % 2], x, y)
    # rotors: under the truss, and on the side faces
    span = BX1 - BX0 - 2
    n = max(2, round(span / 5))
    for i in range(n):
        x = round((BX0 + 1 + (i + 0.5) * span / n) * T)
        y = (Y1 + 2) * T - 3
        img.alpha_composite(rot[i % 4], (x - 24 - ox, y - oy))
    for row in (2, fh - 2):
        img.alpha_composite(side[0], (BX0 * T - 45 - ox, row * T + 8 - 15 - oy))
        img.alpha_composite(side[5], (BX1 * T - 2 - ox, row * T + 8 - 15 - oy))
    sky = on_bg(img, P["sky1"])
    sky.save(OUT / "fplat_look.png")
    scale(sky, 3).save(OUT / "fplat_look@3x.png")


if __name__ == "__main__":
    build()
