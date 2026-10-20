"""portrait_unit7_cheer and portrait_voltaire_cheer (48x48 x2, fps 4): the order-complete card's
celebrating versions, related to portrait_unit7 / portrait_voltaire the way
portrait_bramble_cheer is to portrait_bramble: the same body, head and costume (drawn by the same
recipe as pixel-art/ui/portraits.py), the face turned to joy, arms thrown up, and frame 2 the top
of a bounce (head, arms and props 1 px up) with the sparkle props swapped.

    Unit 7    the lens becomes a happy ^ eye, the speaker grille an LED grin, blush LEDs; both
              claw arms up; the antenna bulb blazes with alternating rays.
    Voltaire  eyes shut in delight, brows high, a laugh; her monocle pops out and swings on its
              chain; one gloved arm up, waving a lace handkerchief that flutters.
"""
import math
from common_m4 import P, new, ell, ring, ascii_

k, sh, bone = P["ink"], P["shadow"], P["bone"]
g0, g1, g2 = P["ground0"], P["ground1"], P["ground2"]
h0, h1, h2, h3 = P["hull0"], P["hull1"], P["hull2"], P["hull3"]
i0, i1, i2 = P["iron0"], P["iron1"], P["iron2"]
c0, c1, c2 = P["copper0"], P["copper1"], P["copper2"]
b0, b1, gold, hot, glow = P["brass0"], P["brass1"], P["gold"], P["hot"], P["glow"]
t0, t1 = P["teal0"], P["teal1"]
moss, leaf, violet, slag = P["moss"], P["leaf"], P["violet"], P["slag"]


class Parts:
    """Parts on stacked layers; done() shifts the bouncing ones, then outlines each in ink."""

    def __init__(self, s, tag):
        self.s, self.tag, self.names = s, tag, []

    def part(self, name):
        nm = f"{self.tag}_{name}"
        self.s.layer(nm)
        if nm not in self.names:
            self.names.append(nm)
        return self.s

    def done(self, shifts=None):
        for nm in self.names:
            self.s.use(layer=nm)
            key = nm.split("_", 1)[1]
            if shifts and key in shifts:
                self.s.shift(*shifts[key])
            self.s.outline(k)
        self.s.use(layer="main")


def tline(s, pts, w, col):
    for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
        n = max(abs(x1 - x0), abs(y1 - y0), 1)
        for i in range(n + 1):
            x = round(x0 + (x1 - x0) * i / n)
            y = round(y0 + (y1 - y0) * i / n)
            s.rect(x, y, x + w - 1, y + w - 1, col)


# ===================================================================== Unit 7
def unit7_cheer(s, hi):
    pp = Parts(s, f"u{s.current_frame}")
    # --- body: identical to portrait_unit7
    b = pp.part("body")
    b.polygon([(5, 47), (9, 41), (17, 38), (31, 38), (39, 41), (43, 47)], h0)
    b.polygon([(7, 46), (9, 41), (17, 39), (22, 39), (12, 47)], h1, only=h0)
    b.rect(17, 41, 31, 47, h1)
    b.line(17, 41, 31, 41, h2)
    b.line(31, 42, 31, 47, h0)
    b.polygon([(33, 38), (37, 39), (16, 47), (11, 47)], g2)
    b.line(35, 39, 15, 47, g1)
    b.px(25, 44, b1)
    b.rect(20, 34, 28, 38, h0)
    for y in (35, 37):
        b.line(20, y, 28, y, k)
    # --- arms: segmented steel, thrown up either side of the head, brass joints
    a = pp.part("arms")
    tline(a, [(8, 41), (4, 33), (4, 22)], 3, h1)
    a.line(4, 22, 4, 33, h2)
    tline(a, [(38, 41), (42, 33), (42, 22)], 3, h1)
    a.line(42, 22, 42, 33, h2)
    for (x, y) in ((4, 28), (42, 28)):
        a.line(x, y, x + 2, y, h0)                    # segment joints
    ell(a, 5.5, 34.0, 2.0, 2.0, b1)                    # elbows
    ell(a, 43.5, 34.0, 2.0, 2.0, b1)
    a.px(5, 33, hot); a.px(43, 33, hot)
    cl = pp.part("claws")
    # two open pincers: a steel palm and two prongs
    for x0 in (2, 40):
        cl.rect(x0, 19, x0 + 6, 21, h2)
        cl.line(x0, 19, x0 + 6, 19, h3)
        cl.rect(x0, 14, x0 + 1, 18, h2)
        cl.rect(x0 + 5, 14, x0 + 6, 18, h2)
        cl.line(x0, 14, x0, 18, h3)
        cl.line(x0 + 6, 15, x0 + 6, 18, h1)
        cl.px(x0 + 3, 20, b1)
    # --- head: the same box, face turned to joy
    h = pp.part("head")
    h.rect(10, 11, 38, 34, h0)
    h.rect(9, 12, 39, 33, h0)
    h.rect(10, 11, 36, 32, h1, only=h0)
    h.rect(9, 12, 36, 31, h1, only=h0)
    h.line(11, 11, 35, 11, h2); h.line(9, 13, 9, 30, h2); h.px(10, 12, h3)
    h.rect(13, 16, 35, 29, i0)
    h.line(13, 16, 35, 16, k); h.line(13, 16, 13, 29, k)
    h.line(14, 29, 35, 29, h2); h.line(35, 17, 35, 29, h2)
    for y in range(14, 32):
        for x in range(12, 30):
            d = math.hypot(x + 0.5 - 21.0, y + 0.5 - 22.5)
            if 4.6 < d <= 6.0:
                h.px(x, y, h1 if (x + y) > 43 else (h3 if (x + y) < 39 else h2))
    # the lens: dark glass with a glowing happy ^ eye
    ell(h, 21.0, 22.5, 4.6, 4.6, i0)
    for (x, y) in ((18, 19), (19, 19), (17, 20), (17, 21)):
        h.px(x, y, t0)                                   # the glass's rim of light
    for (dx, dy) in ((-3, 2), (-2, 1), (-1, 0), (0, -1), (1, 0), (2, 1), (3, 2)):
        h.px(21 + dx, 23 + dy, t1)
        h.px(21 + dx, 24 + dy, t1 if abs(dx) < 3 else t0)
    h.px(21, 22, bone); h.px(20, 23, bone); h.px(22, 23, bone)
    h.px(18, 20, bone)                                   # the glass glint
    # blush LEDs under the lens
    for x in (16, 25):
        h.px(x, 27, c2); h.px(x + 1, 27, c1)
    # the status light, gone gold
    h.rect(29, 20, 30, 21, gold); h.px(29, 20, hot)
    # the grille became an LED grin
    for (x, y) in ((26, 23), (27, 24), (28, 25), (29, 26), (30, 26), (31, 26), (32, 25), (33, 24),
                   (34, 23)):
        h.px(x, y, t1)
    for (x, y) in ((28, 24), (29, 25), (30, 25), (31, 25), (32, 24)):
        h.px(x, y, bone)
    for (x, y) in ((29, 27), (30, 27), (31, 27)):
        h.px(x, y, t0)
    h.rect(12, 13, 16, 15, h2)
    h.px(12, 13, k); h.px(16, 13, k); h.px(12, 15, k); h.px(16, 15, k)
    h.px(37, 31, c0); h.px(36, 32, c0); h.px(37, 32, c1)
    h.px(34, 13, h0); h.px(35, 14, h0)
    ascii_(h, 30, 12, ["###", "..#", ".#.", ".#."], key={"#": gold})
    # ear bolts (in front of the arms' shoulders)
    eb = pp.part("ears")
    eb.rect(7, 19, 8, 26, h0); eb.line(7, 19, 7, 25, h2)
    eb.rect(40, 19, 41, 26, h0); eb.line(40, 19, 40, 25, h1)
    # --- antenna: the bulb blazes
    an = pp.part("antenna")
    an.line(30, 10, 30, 6, h2)
    an.line(31, 5, 33, 4, h2)
    an.line(34, 4, 35, 5, h2)
    ell(an, 37.0, 6.5, 2.2, 2.2, glow)
    an.px(36, 5, hot); an.px(37, 5, hot); an.px(36, 6, hot)
    an.rect(28, 9, 32, 10, h1)
    rays = pp.part("rays")                             # light rays: plus on frame 1, x on frame 2
    if not hi:
        for (x, y) in ((37, 1), (37, 2), (42, 6), (43, 6), (37, 11), (32, 6)):
            rays.px(x, y, gold)
        rays.px(37, 0, hot); rays.px(44, 6, hot)
    else:
        for (x, y) in ((40, 3), (41, 2), (34, 3), (33, 2), (40, 10), (41, 11)):
            rays.px(x, y, gold)
        rays.px(42, 1, hot); rays.px(32, 1, hot)
    sp = pp.part("sparkle")                            # a twinkle that swaps sides
    sx, sy = ((4, 6) if not hi else (45, 15))
    sp.px(sx, sy, bone)
    for (dx, dy) in ((1, 0), (-1, 0), (0, 1), (0, -1)):
        sp.px(sx + dx, sy + dy, hot)
    shifts = None
    if hi:
        shifts = {k_: (0, -1) for k_ in ("head", "ears", "arms", "claws", "antenna", "rays")}
    pp.done(shifts)


# ===================================================================== Dame Voltaire
MONO = [(33.5, 35.5), (35.5, 33.5)]   # where the popped monocle swings to, per frame


def voltaire_cheer(s, hi):
    pp = Parts(s, f"v{s.current_frame}")
    # --- body: identical to portrait_voltaire
    b = pp.part("body")
    b.polygon([(5, 47), (10, 41), (18, 38), (30, 38), (38, 41), (43, 47)], violet)
    b.polygon([(28, 39), (38, 41), (43, 47), (30, 47)], slag, only=violet)
    b.line(10, 41, 18, 38, c2)
    b.rect(21, 33, 27, 38, c2)
    b.line(26, 33, 26, 38, c1)
    for i, x in enumerate(range(16, 33, 2)):
        y = 37 + (i % 2)
        b.rect(x, y, x + 1, y + 2, bone)
        b.px(x + 1, y + 2, h3)
    ell(b, 24.0, 43.0, 2.0, 2.0, gold)
    b.px(24, 43, t1); b.px(23, 42, hot)
    # --- the raised arm (her left, our right): violet sleeve, lace cuff, gloved hand
    a = pp.part("arm")
    tline(a, [(37, 42), (41, 35), (42, 28)], 3, violet)
    tline(a, [(38, 41), (41, 35)], 1, c2)
    a.line(44, 29, 44, 36, slag)
    a.rect(40, 26, 45, 27, bone)                         # lace cuff
    a.px(41, 27, h3); a.px(43, 27, h3)
    hd = pp.part("hand")
    ell(hd, 42.5, 23.5, 2.2, 2.4, bone)                 # a white glove
    hd.px(41, 22, P["bone"]); hd.px(43, 24, h3); hd.px(44, 23, h3)
    # the handkerchief, fluttering: hanging right on frame 1, flicked up on frame 2
    kf = pp.part("kerchief")
    if not hi:
        ascii_(kf, 40, 14, [
            "..bb...",
            ".bbbb..",
            ".bbbbb.",
            "..b3bbb",
            "..3bb3b",
            "...3.3.",
            "..bb...",
        ], key={"b": bone, "3": h3})
    else:
        ascii_(kf, 38, 13, [
            "b......",
            "bbb..b.",
            ".bbbbbb",
            "..bbb3b",
            "...b3b.",
            "....3..",
            "...bb..",
        ], key={"b": bone, "3": h3})
    # --- hair (back), face, fringe, hat and plume: as portrait_voltaire
    hb = pp.part("hairback")
    ell(hb, 24.0, 25.0, 12.0, 11.0, h2)
    ell(hb, 13.5, 31.0, 3.2, 3.6, h2)
    ell(hb, 34.5, 31.0, 3.2, 3.6, h2)
    ell(hb, 22.5, 23.5, 11.0, 9.5, h3, only=h2)
    ell(hb, 12.8, 30.0, 2.2, 2.6, h3, only=h2)
    hb.px(13, 33, h1); hb.px(35, 33, h1); hb.px(36, 31, h1)
    for (x, y) in ((13, 22), (14, 21), (12, 25), (13, 26), (14, 28), (35, 22), (34, 21), (36, 25),
                   (35, 26), (34, 28), (12, 29), (36, 29)):
        hb.px(x, y, h2)
    hb.px(13, 23, bone); hb.px(12, 26, bone)
    f = pp.part("face")
    ell(f, 24.0, 26.5, 7.6, 9.2, c1)
    ell(f, 23.3, 25.6, 6.8, 8.2, c2, only=c1)
    f.px(19, 27, hot); f.px(20, 28, hot)
    # brows: both flown high
    f.line(18, 21, 21, 20, h1); f.line(27, 20, 30, 21, h1)
    # eyes shut in delight: two little upturned arcs with a lash each
    for x0 in (18, 27):
        f.px(x0, 24, k); f.px(x0 + 1, 23, k); f.px(x0 + 2, 23, k); f.px(x0 + 3, 24, k)
    f.px(17, 23, k); f.px(31, 23, k)
    # blush
    f.px(18, 27, c1); f.px(19, 28, c1); f.px(29, 27, c1); f.px(30, 27, c1)
    f.px(24, 26, c1); f.px(24, 27, c1); f.px(25, 27, c0)          # nose
    # the laugh: an open D, bone teeth along the top, a copper tongue
    ascii_(f, 21, 29, [
        "#######",
        "#WWWWW#",
        "#rrrrr#",
        ".#rpr#.",
        "..###..",
    ], key={"#": k, "W": bone, "r": c0, "p": P["copper1"]})
    f.px(16, 31, gold)                                             # earring
    # the monocle's chain, from the eye to where the monocle swings
    mx, my = MONO[1 if hi else 0]
    for i in range(1, 6):
        t = i / 6
        x = 31 + (mx - 31) * t
        y = 25 + (my - 25) * t + math.sin(t * math.pi) * 2.0
        f.px(int(x), int(y), b1 if i % 2 else gold)
    hf = pp.part("fringe")
    hf.polygon([(15, 21), (18, 17), (25, 16), (31, 17), (33, 21), (29, 19), (24, 20), (19, 19)], h3)
    hf.line(19, 19, 25, 17, bone)
    hf.px(30, 19, h2); hf.px(16, 21, h2)
    t = pp.part("hat")
    t.polygon([(14, 15), (14, 8), (17, 5), (29, 3), (32, 5), (33, 12)], violet)
    t.polygon([(26, 4), (29, 3), (32, 5), (33, 12), (27, 13)], slag, only=violet)
    t.line(16, 6, 25, 4, c2)
    t.polygon([(5, 18), (43, 11), (44, 13), (6, 20)], violet)
    t.line(5, 18, 43, 11, c2)
    t.line(7, 20, 44, 13, slag)
    t.polygon([(14, 13), (33, 10), (33, 12), (14, 15)], k)
    for cx in (19.5, 27.5):
        cy = 12.5 - (cx - 14) * 0.15
        ell(t, cx, cy, 3.2, 3.2, b1)
        ell(t, cx + 0.3, cy + 0.3, 2.0, 2.0, t0)
        ell(t, cx - 0.2, cy - 0.2, 1.1, 1.1, t1)
        t.px(int(cx) - 2, int(cy) - 2, gold)
        t.px(int(cx), int(cy) - 1, bone)
    pl = pp.part("plume")
    path = [(31.0, 8.0, 2.6), (33.5, 5.5, 2.8), (36.5, 3.8, 2.7), (39.5, 3.2, 2.4), (42.0, 3.6, 2.0),
            (44.0, 5.0, 1.6), (45.3, 6.8, 1.2)]
    for (x, y, r) in path:
        ell(pl, x, y, r, r * 0.9, t0)
    for (x, y, r) in path:
        ell(pl, x - 0.4, y - 0.6, r * 0.8, r * 0.65, t1, only=t0)
    for (x, y) in ((33, 3), (36, 1), (39, 1), (42, 2), (44, 3), (46, 6)):
        pl.px(x, y, bone)
    for (x, y) in ((35, 6), (38, 5), (41, 5), (43, 6)):
        pl.px(x, y, t0)
    pl.line(32, 7, 42, 3, h3)
    # --- the monocle, popped out and swinging (in front of everything)
    mo = pp.part("monocle")
    ring(mo, mx, my, 1.4, 2.6, gold)
    mo.px(int(mx) - 1, int(my) - 2, hot)
    mo.px(int(mx) + 1, int(my) + 1, b1)
    ell(mo, mx, my, 1.3, 1.3, t1)
    mo.px(int(mx) - 1, int(my) - 1, bone)
    sp = pp.part("sparkle")
    sx, sy = ((7, 28) if not hi else (5, 23))
    sp.px(sx, sy, bone)
    for (dx, dy) in ((1, 0), (-1, 0), (0, 1), (0, -1)):
        sp.px(sx + dx, sy + dy, hot)
    shifts = None
    if hi:
        shifts = {k_: (0, -1) for k_ in ("hairback", "face", "fringe", "hat", "plume", "arm", "hand",
                                         "kerchief")}
    pp.done(shifts)


def build(fn):
    s = new(48, 48, 2)
    for f in range(2):
        s.frame(f + 1)
        fn(s, f)
    s.frame(1)
    return s
