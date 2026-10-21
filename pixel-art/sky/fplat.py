"""The Factory's sky platform (docs/sky-island.md; a SKETCH for the style test): the girder rim
round the plate floor, the girder face and truss under its south edge, and the brass rotor pods
that hold it up. The machines' steel and the modules' brass: the Factory is built, not grown.

fplat_edge 16x16 x16 by 4-bit mask (N=1 E=2 S=4 W=8 = platform there): a rim walkway of steel
tread with a brass handrail along every open side, posts every 8 px.
fplat_under 16x16 x6: girder face x2, truss x2, truss left end, truss right end.
fplat_rotor 48x24 x4: a brass pod hung from two struts, its rotor spinning under it (fps 12).
Run `python fplat.py` from this folder.
"""
import math

from common import P, new, draw, put, rect, export, get, outline, scale, rgb
from PIL import Image


def tread(img):
    rect(img, 0, 0, 15, 15, P["steel2"])
    for y in range(1, 16, 4):
        for x in range((y // 4 % 2) * 2, 16, 4):
            draw(img, [(x, y), (x + 1, y - 1)], P["steel1"])
            put(img, x + 1, y, P["steel3"])


def edge(mask):
    N, E, S, W = mask & 1, mask & 2, mask & 4, mask & 8
    img = new(16, 16)
    tread(img)
    # the outer edge: an ink lip and a lit steel3 plate edge on every open side
    if not N:
        draw(img, [(x, 0) for x in range(16)], P["ink"])
        draw(img, [(x, 1) for x in range(16)], P["steel3"])
    if not W:
        draw(img, [(0, y) for y in range(16)], P["ink"])
        draw(img, [(1, y) for y in range(16)], P["steel3"])
    if not E:
        draw(img, [(15, y) for y in range(16)], P["ink"])
        draw(img, [(14, y) for y in range(16)], P["steel1"])
    if not S:
        draw(img, [(x, 15) for x in range(16)], P["steel1"])
    # the handrail: brass, 2 px, posts every 8 px, on the open sides (inset 3 px)

    def rail_h(y):
        for x in range(16):
            put(img, x, y, P["brass2"])
            put(img, x, y + 1, P["brass1"])
        for px in (3, 11):
            put(img, px, y + 2, P["brass1"])
            put(img, px, y + 3, P["brass0"])
            put(img, px, y - 1, P["brass3"])

    def rail_v(x):
        for y in range(16):
            put(img, x, y, P["brass2"])
            put(img, x + 1, y, P["brass1"])
        for py in (3, 11):
            put(img, x - 1, py, P["brass3"])
            put(img, x + 2, py, P["brass0"])

    if not N:
        rail_h(3)
    if not S:
        rail_h(11)
    if not W:
        rail_v(3)
    if not E:
        rail_v(11)
    return img


def girder(v):
    """The platform's south face: an I-beam end-on, a lit top flange, a web with brass rivets and
    a bolted splice plate, the bottom flange."""
    img = new(16, 16)
    rect(img, 0, 0, 15, 2, P["steel3"])
    draw(img, [(x, 0) for x in range(16)], P["steel4"])
    rect(img, 0, 3, 15, 11, P["steel1"])
    draw(img, [(x, 3) for x in range(16)], P["ink2"])
    rect(img, 0, 12, 15, 14, P["steel2"])
    draw(img, [(x, 12) for x in range(16)], P["steel3"])
    draw(img, [(x, 15) for x in range(16)], P["ink"])
    for x in (2, 6, 10, 14):
        put(img, x, 7, P["brass2"])
        put(img, x + 1, 8, P["ink2"])
    if v == 1:
        rect(img, 4, 5, 11, 10, P["steel2"])
        draw(img, [(x, 5) for x in range(4, 12)], P["steel3"])
        for x, y in ((5, 6), (10, 6), (5, 9), (10, 9)):
            put(img, x, y, P["brass3"])
    return img


def truss(kind):
    """A Warren truss in front of the sky: top and bottom chords, diagonals; transparent gaps."""
    img = new(16, 16)
    for x in range(16):
        put(img, x, 0, P["steel2"])
        put(img, x, 1, P["steel1"])
        put(img, x, 13, P["steel2"])
        put(img, x, 14, P["steel1"])
        put(img, x, 15, P["ink"])
    for k in range(2, 13):
        a = k - 1
        for (x, c) in ((a // 1, P["steel2"]), (a + 1, P["steel1"])):
            if 0 <= x < 16:
                put(img, x, k, c)
        for (x, c) in ((15 - a, P["steel2"]), (14 - a, P["steel1"])):
            if 0 <= x < 16:
                put(img, x, k, c)
    for x in (0, 15):
        for y in range(16):
            put(img, x, y, P["steel1"] if x else P["steel2"])
    if kind == "left":
        for y in range(16):
            for x in range(0, max(0, 15 - y)):
                img.putpixel((x, y), (0, 0, 0, 0))
        for y in range(16):
            x = max(0, 15 - y)
            put(img, x, y, P["steel2"])
            put(img, min(15, x + 1), y, P["steel1"])
    elif kind == "right":
        for y in range(16):
            for x in range(min(16, y + 1), 16):
                img.putpixel((x, y), (0, 0, 0, 0))
        for y in range(16):
            x = min(15, y)
            put(img, x, y, P["steel1"])
            put(img, max(0, x - 1), y, P["steel2"])
    return outline(img, P["ink"]).crop((0, 0, 16, 16)) if kind != "mid" else img


def rotor(f):
    """48x24: two struts from the top edge to a brass pod (a rounded nacelle lit top-left, a lamp
    window), a hub under it and a rotor spinning flat (seen edge-on: the blades' length changes
    frame to frame), a puff of downdraft under the tips."""
    W, H = 48, 24
    img = new(W, H)
    # struts
    for y in range(0, 6):
        for x in (15, 32):
            put(img, x, y, P["steel2"])
            put(img, x + 1, y, P["steel1"])
    # the pod: an ellipse 24x10 centred (24, 10)
    for y in range(4, 16):
        for x in range(10, 38):
            dx, dy = (x + 0.5 - 24) / 13, (y + 0.5 - 10) / 6
            d = dx * dx + dy * dy
            if d <= 1:
                lam = -dx * 0.5 - dy * 0.8 + 0.25
                c = P["brass3"] if lam > 0.75 else P["brass2"] if lam > 0.2 else P["brass1"] if lam > -0.5 else P["brass0"]
                put(img, x, y, c)
    # a band of rivets and a lamp window
    for x in range(12, 37):
        if get(img, x, 11)[3]:
            put(img, x, 11, P["brass0"] if x % 3 else P["brass3"])
    rect(img, 21, 7, 26, 9, P["ink1"])
    draw(img, [(22, 8), (23, 8), (24, 8), (25, 8)], P["lamp2"])
    put(img, 22, 8, P["lamp3"])
    # the hub
    rect(img, 22, 16, 25, 18, P["steel2"])
    draw(img, [(22, 16), (23, 16)], P["steel3"])
    draw(img, [(x, 18) for x in range(22, 26)], P["steel1"])
    # the blades: frame-dependent lengths left and right (a two-blade rotor turning)
    lens = [(20, 20), (14, 8), (4, 4), (8, 14)][f]
    for k in range(1, lens[0] + 1):
        put(img, 22 - k, 18, P["steel3"] if k < lens[0] - 1 else P["steel4"])
        put(img, 22 - k, 19, P["steel1"])
    for k in range(1, lens[1] + 1):
        put(img, 25 + k, 18, P["steel3"] if k < lens[1] - 1 else P["steel4"])
        put(img, 25 + k, 19, P["steel1"])
    body = outline(img, P["ink"])
    # after the outline (they are air, not metal): the swept disc as a faint dotted line the
    # full span, and short downdraft streaks under it moving down
    for x in range(2, 46):
        if not get(body, x, 18)[3] and (x + f) % 3 == 0:
            put(body, x, 18, P["cloud1"])
    for i, x in enumerate((6, 14, 33, 41)):
        y = 21 + (f + i) % 3
        put(body, x, y, P["cloud2"])
        if y + 1 < H:
            put(body, x, y + 1, P["cloud1"])
    return body


def build():
    export("fplat_edge", [edge(m) for m in range(16)], bg=P["sky1"])
    export("fplat_under", [girder(0), girder(1), truss("mid"), truss("mid"), truss("left"), truss("right")],
           bg=P["sky1"], extra={"names": ["girder0", "girder1", "truss0", "truss1", "truss_l", "truss_r"]})
    export("fplat_rotor", [rotor(f) for f in range(4)], fps=12, anchor=(24, 0), bg=P["sky1"])


if __name__ == "__main__":
    build()
