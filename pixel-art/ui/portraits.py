"""The cast's portraits (PLAN.md pillar 5): Mayor Bramble (48x48 x2 + 24x24), Unit 7 and Dame
Voltaire (48x48 x2). Frame 1 eyes open, frame 2 a blink; fps 0, the game blinks them. Each
character is built in parts on stacked layers, every part outlined in ink on its own layer so
parts in front keep a clean line. Light from the top-left: the shifted-shape recipe (base,
then the lighter shape restacked up-left, then the dark shape down-right, clipped with only=).
Transparent background: the card's inset well sits behind them.
"""
import math
from common import P, new, ell, ring, ascii_, export, sheet, up, OUT, frame_of
from PIL import Image

k, sh, bone = P["ink"], P["shadow"], P["bone"]
g0, g1, g2 = P["ground0"], P["ground1"], P["ground2"]
h0, h1, h2, h3 = P["hull0"], P["hull1"], P["hull2"], P["hull3"]
i0, i1, i2 = P["iron0"], P["iron1"], P["iron2"]
c0, c1, c2 = P["copper0"], P["copper1"], P["copper2"]
b0, b1, gold, hot, glow = P["brass0"], P["brass1"], P["gold"], P["hot"], P["glow"]
t0, t1 = P["teal0"], P["teal1"]
moss, leaf, violet, slag = P["moss"], P["leaf"], P["violet"], P["slag"]


class Parts:
    def __init__(self, s, tag):
        self.s, self.tag, self.names = s, tag, []

    def part(self, name):
        nm = f"{self.tag}_{name}"
        self.s.layer(nm)
        if nm not in self.names:
            self.names.append(nm)
        return self.s

    def done(self):
        for nm in self.names:
            self.s.use(layer=nm)
            self.s.outline(k)
        self.s.use(layer="main")


# ===================================================================== Mayor Bramble
def bramble_big(s, blink):
    pp = Parts(s, f"b{s.current_frame}")
    # --- body: a navy mayor's coat, a red sash, a gold medal, a bone collar and a bow tie
    b = pp.part("body")
    b.polygon([(4, 47), (7, 41), (15, 36), (33, 36), (41, 41), (44, 47)], i0)
    b.polygon([(6, 46), (8, 41), (15, 37), (22, 37), (14, 47)], i1, only=i0)
    b.line(8, 41, 15, 37, i2)
    b.polygon([(19, 36), (29, 36), (24, 44)], bone)
    b.line(27, 37, 24, 43, h3)
    b.polygon([(9, 40), (14, 37), (39, 47), (31, 47)], c1)        # the sash
    b.line(14, 37, 39, 47, c2)
    b.line(9, 41, 30, 47, c0)
    ell(b, 30.0, 43.0, 2.2, 2.2, gold)                            # the medal
    b.px(29, 42, hot); b.px(31, 44, b0)
    b.rect(22, 37, 26, 39, violet)                                # bow tie
    b.px(24, 38, slag); b.px(22, 37, P["copper2"])
    # --- head: one wide frog head with two eye domes
    h = pp.part("head")
    ell(h, 24.0, 27.5, 17.5, 10.5, moss)
    ell(h, 13.5, 18.0, 6.6, 6.6, moss)
    ell(h, 34.5, 18.0, 6.6, 6.6, moss)
    ell(h, 23.0, 26.0, 16.5, 9.2, leaf, only=moss)                # lit shape, shifted up-left
    ell(h, 12.8, 17.2, 5.6, 5.6, leaf, only=moss)
    ell(h, 33.8, 17.2, 5.6, 5.6, leaf, only=moss)
    ell(h, 24.0, 36.5, 10.0, 3.6, hot, only=leaf)                 # pale throat
    ell(h, 24.0, 36.8, 10.0, 3.6, h3, only=moss)
    for (x, y) in ((10, 13), (11, 12), (12, 12), (31, 12), (32, 12), (10, 22), (11, 21)):
        h.px(x, y, hot)                                            # glints
    # mouth: a wide, pleased smile
    mouth = [(9, 29), (10, 30), (11, 31), (12, 31), (13, 32), (14, 32), (15, 33), (16, 33)]
    mouth += [(x, 33) for x in range(17, 32)]
    mouth += [(48 - 1 - x, y) for (x, y) in mouth[:8]]
    for (x, y) in mouth:
        h.px(x, y, k)
    for x in range(17, 31):
        h.px(x, 34, moss)
    for (x, y) in ((11, 28), (12, 28), (12, 29), (35, 28), (36, 28), (35, 29)):
        h.px(x, y, c2)                                             # cheeks
    h.px(21, 25, k); h.px(27, 25, k)                               # nostrils
    # eyes
    for (cx, px_) in ((13.5, 14), (34.5, 35)):
        if not blink:
            ell(h, cx, 18.5, 4.3, 4.3, bone)
            h.rect(px_ - 1, 16, px_ + 1, 21, k)
            h.px(px_ - 1, 17, bone)                                 # catchlight
            h.px(px_ + 1, 21, None) if False else None
            h.line(int(cx) - 3, 14, int(cx) + 3, 14, moss)          # a heavy, contented lid
            h.line(int(cx) - 2, 15, int(cx) + 2, 15, moss)
            h.line(int(cx) - 2, 15, int(cx) + 2, 15, moss)
        else:
            ell(h, cx, 18.5, 4.3, 4.3, moss)
            ell(h, cx - 0.5, 17.5, 4.0, 3.6, leaf, only=moss)
            for dx in range(-3, 4):
                h.px(int(cx) + dx, 19 + (1 if abs(dx) < 2 else 0), k)
    # --- a tiny top hat, set at a jaunty angle
    t = pp.part("hat")
    t.rect(17, 14, 31, 15, sh)                                     # brim
    t.line(17, 14, 30, 14, h0)
    t.px(16, 13, sh); t.px(32, 13, sh)
    t.rect(21, 4, 29, 8, sh)                                       # crown, upper half nudged right
    t.rect(20, 9, 28, 13, sh)
    t.line(21, 4, 21, 8, h0); t.line(20, 9, 20, 12, h0)
    t.line(22, 4, 28, 4, h0)
    t.rect(20, 11, 28, 12, b1)                                     # band
    t.line(20, 11, 27, 11, gold)
    t.px(26, 9, leaf); t.px(27, 10, leaf); t.px(25, 10, moss)       # a sprig in the band
    t.px(21, 5, slag)
    pp.done()


def bramble_small(s):
    pp = Parts(s, "bs")
    b = pp.part("body")
    b.polygon([(3, 23), (6, 20), (18, 20), (21, 23)], i0)
    b.line(6, 20, 9, 20, i1)
    b.line(6, 21, 18, 23, c1)
    b.px(11, 21, bone); b.px(12, 21, bone); b.px(12, 22, bone)
    h = pp.part("head")
    ell(h, 12.0, 15.0, 9.5, 5.6, moss)
    ell(h, 6.5, 10.5, 3.6, 3.6, moss)
    ell(h, 17.5, 10.5, 3.6, 3.6, moss)
    ell(h, 11.5, 14.2, 8.8, 4.8, leaf, only=moss)
    ell(h, 6.0, 10.0, 3.0, 3.0, leaf, only=moss)
    ell(h, 17.0, 10.0, 3.0, 3.0, leaf, only=moss)
    for (x, y) in ((5, 11), (6, 11), (17, 11), (18, 11)):
        h.px(x, y, bone)
    h.px(6, 11, k); h.px(17, 11, k)
    h.px(5, 10, moss); h.px(6, 10, moss); h.px(17, 10, moss); h.px(18, 10, moss)
    for x in range(6, 18):
        h.px(x, 17 if 8 <= x <= 15 else 16, k)
    h.px(5, 15, k); h.px(18, 15, k)
    h.px(6, 15, c2); h.px(17, 15, c2)
    h.px(4, 8, hot)
    t = pp.part("hat")
    t.rect(9, 8, 15, 8, sh)
    t.rect(10, 3, 14, 7, sh)
    t.line(10, 6, 14, 6, b1)
    t.line(10, 3, 10, 5, h0)
    pp.done()


# ===================================================================== Unit 7
def unit7(s, blink):
    pp = Parts(s, f"u{s.current_frame}")
    b = pp.part("body")
    b.polygon([(5, 47), (9, 41), (17, 38), (31, 38), (39, 41), (43, 47)], h0)
    b.polygon([(7, 46), (9, 41), (17, 39), (22, 39), (12, 47)], h1, only=h0)
    b.rect(17, 41, 31, 47, h1)                                     # chest plate
    b.line(17, 41, 31, 41, h2)
    b.line(31, 42, 31, 47, h0)
    b.polygon([(33, 38), (37, 39), (16, 47), (11, 47)], g2)        # the collector's satchel strap
    b.line(35, 39, 15, 47, g1)
    b.px(25, 44, b1)
    b.rect(20, 34, 28, 38, h0)                                     # neck
    for y in (35, 37):
        b.line(20, y, 28, y, k)
    h = pp.part("head")
    h.rect(10, 11, 38, 34, h0)
    h.rect(9, 12, 39, 33, h0)
    h.rect(10, 11, 36, 32, h1, only=h0)
    h.rect(9, 12, 36, 31, h1, only=h0)
    h.line(11, 11, 35, 11, h2); h.line(9, 13, 9, 30, h2); h.px(10, 12, h3)
    h.rect(7, 19, 8, 26, h0); h.line(7, 19, 7, 25, h2)              # ear bolts
    h.rect(40, 19, 41, 26, h0); h.line(40, 19, 40, 25, h1)
    h.rect(13, 16, 35, 29, i0)                                     # face plate
    h.rect(14, 17, 34, 28, P["iron0"])
    h.line(13, 16, 35, 16, k); h.line(13, 16, 13, 29, k)
    h.line(14, 29, 35, 29, h2); h.line(35, 17, 35, 29, h2)
    # lens
    ring(h, 21.0, 22.5, 4.6, 6.0, h2)
    ring(h, 21.0, 22.5, 4.6, 6.0, h3, only=None) if False else None
    for y in range(14, 32):
        for x in range(12, 30):
            d = math.hypot(x + 0.5 - 21.0, y + 0.5 - 22.5)
            if 4.6 < d <= 6.0 and (x + y) > 43:
                h.px(x, y, h1)
            elif 4.6 < d <= 6.0 and (x + y) < 39:
                h.px(x, y, h3)
    if not blink:
        ell(h, 21.0, 22.5, 4.6, 4.6, t0)
        ell(h, 21.5, 24.0, 3.0, 3.0, t1)                          # looking a little down
        h.rect(21, 24, 22, 25, i0)                                 # pupil
        h.px(23, 26, bone)
        h.px(18, 20, bone); h.px(19, 20, bone); h.px(18, 21, bone)
        h.line(17, 19, 24, 19, h1)                                 # a half-shut shutter: wistful
    else:
        ell(h, 21.0, 22.5, 4.6, 4.6, h1)
        h.line(17, 22, 25, 22, k)
        h.line(17, 21, 25, 21, h2)
    h.rect(29, 20, 30, 21, glow); h.px(29, 20, hot)                 # status light
    for y in (25, 27):
        h.line(27, y, 33, y, k)                                    # speaker grille
    h.rect(12, 13, 16, 15, h2)                                     # a riveted patch
    h.px(12, 13, k); h.px(16, 13, k); h.px(12, 15, k); h.px(16, 15, k)
    h.px(37, 31, c0); h.px(36, 32, c0); h.px(37, 32, c1)            # a rust spot
    h.px(34, 13, h0); h.px(35, 14, h0)                             # a dent
    ascii_(h, 30, 12, ["###", "..#", ".#.", ".#."], key={"#": gold})  # its serial number
    a = pp.part("antenna")
    a.line(30, 10, 30, 6, h2)
    a.line(31, 5, 33, 4, h2)
    a.line(34, 4, 35, 5, h2)
    ell(a, 37.0, 6.5, 1.8, 1.8, glow)
    a.px(36, 5, hot)
    a.rect(28, 9, 32, 10, h1)
    pp.done()


# ===================================================================== Dame Voltaire
def voltaire(s, blink):
    pp = Parts(s, f"v{s.current_frame}")
    b = pp.part("body")
    b.polygon([(5, 47), (10, 41), (18, 38), (30, 38), (38, 41), (43, 47)], violet)
    b.polygon([(28, 39), (38, 41), (43, 47), (30, 47)], slag, only=violet)
    b.line(10, 41, 18, 38, P["copper2"])
    b.rect(21, 33, 27, 38, c2)                                     # neck
    b.line(26, 33, 26, 38, c1)
    for i, x in enumerate(range(16, 33, 2)):                       # a lace ruff
        y = 37 + (i % 2)
        b.rect(x, y, x + 1, y + 2, bone)
        b.px(x + 1, y + 2, h3)
    ell(b, 24.0, 43.0, 2.0, 2.0, gold)                             # brooch
    b.px(24, 43, t1); b.px(23, 42, hot)
    hb = pp.part("hairback")
    ell(hb, 24.0, 25.0, 12.0, 11.0, h2)
    ell(hb, 13.5, 31.0, 3.2, 3.6, h2)
    ell(hb, 34.5, 31.0, 3.2, 3.6, h2)
    ell(hb, 22.5, 23.5, 11.0, 9.5, h3, only=h2)
    ell(hb, 12.8, 30.0, 2.2, 2.6, h3, only=h2)
    hb.px(13, 33, h1); hb.px(35, 33, h1); hb.px(36, 31, h1)
    for (x, y) in ((13, 22), (14, 21), (12, 25), (13, 26), (14, 28), (35, 22), (34, 21), (36, 25),
                   (35, 26), (34, 28), (12, 29), (36, 29)):
        hb.px(x, y, h2)                                            # curls
    hb.px(13, 23, bone); hb.px(12, 26, bone)
    f = pp.part("face")
    ell(f, 24.0, 26.5, 7.6, 9.2, c1)
    ell(f, 23.3, 25.6, 6.8, 8.2, c2, only=c1)
    f.px(19, 27, hot); f.px(20, 28, hot)                           # lit cheek
    # brows: the right one raised, sceptical
    f.line(18, 22, 21, 21, h1); f.line(26, 20, 29, 21, h1)
    if not blink:
        f.line(18, 24, 21, 24, k); f.px(17, 23, k)                 # lashes
        f.line(27, 24, 30, 24, k); f.px(31, 23, k)
        f.px(19, 25, k); f.px(20, 25, i0); f.px(28, 25, k); f.px(29, 25, i0)
    else:
        f.line(18, 25, 21, 25, k); f.px(17, 24, k)
        f.line(27, 25, 30, 25, k); f.px(31, 24, k)
    f.px(24, 28, c1); f.px(24, 29, c1); f.px(25, 29, c0)            # nose
    f.line(22, 31, 25, 31, c0); f.px(26, 30, c0)                   # a smirk
    f.px(23, 32, c1)
    ring(f, 28.5, 24.5, 2.0, 3.2, gold)                            # the monocle
    f.px(26, 22, hot)
    for (x, y) in ((31, 27), (32, 29), (32, 31), (31, 33), (30, 35)):
        f.px(x, y, b1)                                             # its chain
    f.px(16, 31, gold)                                             # earring
    hf = pp.part("fringe")
    hf.polygon([(15, 21), (18, 17), (25, 16), (31, 17), (33, 21), (29, 19), (24, 20), (19, 19)], h3)
    hf.line(19, 19, 25, 17, bone)
    hf.px(30, 19, h2); hf.px(16, 21, h2)
    t = pp.part("hat")
    t.polygon([(14, 15), (14, 8), (17, 5), (29, 3), (32, 5), (33, 12)], violet)
    t.polygon([(26, 4), (29, 3), (32, 5), (33, 12), (27, 13)], slag, only=violet)
    t.line(16, 6, 25, 4, P["copper2"])
    t.polygon([(5, 18), (43, 11), (44, 13), (6, 20)], violet)       # tilted brim
    t.line(5, 18, 43, 11, P["copper2"])
    t.line(7, 20, 44, 13, slag)
    t.polygon([(14, 13), (33, 10), (33, 12), (14, 15)], k)         # band
    # goggles on the band: brass rims, teal lenses
    for cx in (19.5, 27.5):
        cy = 12.5 - (cx - 14) * 0.15
        ell(t, cx, cy, 3.2, 3.2, b1)
        ell(t, cx + 0.3, cy + 0.3, 2.0, 2.0, t0)
        ell(t, cx - 0.2, cy - 0.2, 1.1, 1.1, t1)
        t.px(int(cx) - 2, int(cy) - 2, gold)
        t.px(int(cx), int(cy) - 1, bone)
    pl = pp.part("plume")                                          # an ostrich plume, swept back
    path = [(31.0, 8.0, 2.6), (33.5, 5.5, 2.8), (36.5, 3.8, 2.7), (39.5, 3.2, 2.4), (42.0, 3.6, 2.0),
            (44.0, 5.0, 1.6), (45.3, 6.8, 1.2)]
    for (x, y, r) in path:
        ell(pl, x, y, r, r * 0.9, t0)
    for (x, y, r) in path:
        ell(pl, x - 0.4, y - 0.6, r * 0.8, r * 0.65, t1, only=t0)
    for (x, y) in ((33, 3), (36, 1), (39, 1), (42, 2), (44, 3), (46, 6)):
        pl.px(x, y, bone)                                          # pale barb tips
    for (x, y) in ((35, 6), (38, 5), (41, 5), (43, 6)):
        pl.px(x, y, t0)                                            # barb partings
    pl.line(32, 7, 42, 3, h3)                                      # the quill
    pp.done()


def build():
    out = {}
    for name, fn in (("portrait_bramble", bramble_big), ("portrait_unit7", unit7), ("portrait_voltaire", voltaire)):
        s = new(48, 48, 2)
        for f in range(2):
            s.frame(f + 1)
            fn(s, blink=(f == 1))
        out[name] = (export(s, name, 0), s)
    s = new(24, 24, 1)
    bramble_small(s)
    out["portrait_bramble_small"] = (export(s, "portrait_bramble_small", 0, scale=10), s)
    # check sheet: each in a well at 1x and 4x
    items = []
    for nm in ("portrait_bramble", "portrait_unit7", "portrait_voltaire"):
        im = out[nm][0]
        for f in range(2):
            items.append((nm, frame_of(im, 48, f)))
    items.append(("small", out["portrait_bramble_small"][0]))
    sheet(items, OUT / "portraits_sheet.png", scale=4, label=False)
    sheet(items, OUT / "portraits_sheet_1x.png", scale=1, label=False)
    return out


if __name__ == "__main__":
    build()
