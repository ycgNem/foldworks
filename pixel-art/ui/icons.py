"""ui_icons.png (20 x 16x16 toolbar / tab icons) and the spinning coins (ui_coin 16x16,
ui_coin_small 8x8). Each icon is built from parts; every part gets its own 1-px ink outline on
its own layer, so where parts cross (hammer over wrench) the ink line keeps them apart.
Order is fixed by the HUD: see ICON_ORDER.
"""
import math
from common import P, KEY, new, ell, ring, ascii_, export, sheet, up, strip, OUT, frame_of, text
from PIL import Image

k, bone = P["ink"], P["bone"]
g0, g1, g2 = P["ground0"], P["ground1"], P["ground2"]
h0, h1, h2, h3 = P["hull0"], P["hull1"], P["hull2"], P["hull3"]
b0, b1, gold, hot, glow = P["brass0"], P["brass1"], P["gold"], P["hot"], P["glow"]
c0, c1, c2 = P["copper0"], P["copper1"], P["copper2"]
t0, t1 = P["teal0"], P["teal1"]
moss, leaf = P["moss"], P["leaf"]

ICON_ORDER = ["build", "research", "orders", "stats", "trophies", "options", "fold", "flow",
              "remove", "rotate", "factory", "workshop", "coin", "heart", "clock", "lock", "star",
              "play", "pause", "fastforward",
              # Milestone 4 (Act II), appended: the first 20 never move
              "power", "heavy", "codex", "survey", "mega", "kit", "claim", "overdrive", "mode"]


def tline(s, x0, y0, x1, y1, col, w=2):
    """A thick Bresenham line: a w x w stamp at every step."""
    n = max(abs(x1 - x0), abs(y1 - y0))
    for i in range(n + 1):
        x = round(x0 + (x1 - x0) * i / max(n, 1))
        y = round(y0 + (y1 - y0) * i / max(n, 1))
        s.rect(x, y, x + w - 1, y + w - 1, col)


class Parts:
    """Draw parts on stacked layers; `done()` outlines each one in ink, bottom first."""

    def __init__(self, s):
        self.s, self.n = s, 0
        self.names = []

    def part(self):
        self.n += 1
        name = f"p{self.s.current_frame}_{self.n}"
        self.s.layer(name)
        self.names.append(name)
        return self.s

    def done(self):
        for nm in self.names:
            self.s.use(layer=nm)
            self.s.outline(k)
        self.s.use(layer="main")


# --------------------------------------------------------------------- the 20 icons
def i_build(s, pp):
    w = pp.part()  # wrench, top-left to bottom-right
    tline(w, 4, 4, 11, 11, h2)
    ell(w, 4.0, 4.0, 3.2, 3.2, h2)
    for (x, y) in ((2, 2), (3, 2), (2, 3), (3, 3), (1, 1), (2, 1), (1, 2)):
        w.px(x, y, None)  # the open jaw
    ell(w, 12.5, 12.5, 2.3, 2.3, h2)
    w.px(12, 12, h0)
    w.line(5, 6, 11, 12, h1)  # shade under the shaft
    w.px(5, 2, h3); w.px(6, 3, h3); w.px(2, 5, h3)
    h = pp.part()  # hammer: wooden handle up-right, steel head
    tline(h, 3, 12, 9, 6, g2)
    h.line(4, 13, 10, 7, g1)
    h.rect(7, 2, 13, 4, h2)
    h.line(7, 2, 12, 2, h3)
    h.line(8, 4, 13, 4, h1)
    h.line(13, 3, 13, 4, h1)
    h.rect(9, 5, 10, 5, g2)
    h.px(6, 3, h1); h.px(6, 4, h1)  # the claw side
    h.px(7, 2, bone)


def i_research(s, pp):
    f = pp.part()
    f.rect(6, 1, 9, 2, g2)            # cork
    f.px(6, 1, P["hull3"])
    f.rect(6, 3, 9, 6, h3)            # neck (glass)
    f.polygon([(6, 6), (9, 6), (13, 12), (13, 14), (2, 14), (2, 12)], h3)
    f.polygon([(3, 10), (12, 10), (13, 12), (13, 14), (2, 14), (2, 12)], t1)   # liquid
    f.line(4, 10, 11, 10, P["teal1"])
    f.line(2, 14, 13, 14, t0)
    f.line(12, 11, 13, 13, t0)
    f.line(9, 7, 13, 12, P["hull2"], only=P["hull3"])
    f.line(6, 3, 6, 6, bone)          # glass glint
    f.line(5, 8, 3, 11, bone, only=P["hull3"])
    f.px(6, 12, bone); f.px(9, 11, bone); f.px(8, 13, P["hot"])  # bubbles
    f.px(7, 1, g1); f.px(8, 1, g1)


def i_orders(s, pp):
    c = pp.part()
    c.rect(2, 6, 13, 14, g2)
    c.line(2, 6, 13, 6, P["copper2"])
    c.line(2, 10, 13, 10, g1)
    c.line(2, 14, 13, 14, g0)
    c.line(13, 7, 13, 14, g1)
    c.line(2, 7, 2, 13, g1)
    for (x, y) in ((4, 8), (11, 12), (5, 12)):
        c.px(x, y, g1)
    r = pp.part()  # the ribbon and bow
    r.rect(7, 6, 8, 14, leaf)
    r.line(8, 7, 8, 14, moss)
    ascii_(r, 2, 1, [
        ".lll....lll.",
        "l...l..l...m",
        "l....ll....m",
        ".mmmmHlmmmm.",
        "....m..m....",
    ])
    r.px(3, 2, leaf); r.px(4, 3, leaf); r.px(10, 2, leaf); r.px(11, 3, moss)


def i_stats(s, pp):
    for (x0, h, cols) in ((2, 5, (P["iron2"], P["iron1"], P["iron0"])),
                          (6, 8, (c2, c1, c0)),
                          (10, 12, (hot, gold, b1))):
        b = pp.part()
        b.rect(x0, 14 - h, x0 + 3, 14, cols[1])
        b.line(x0, 14 - h, x0, 14, cols[0])
        b.line(x0, 14 - h, x0 + 3, 14 - h, cols[0])
        b.line(x0 + 3, 15 - h, x0 + 3, 14, cols[2])


def i_trophy(s, pp):
    t = pp.part()
    ring(t, 3.0, 6.0, 1.2, 2.6, gold)       # handles
    ring(t, 13.0, 6.0, 1.2, 2.6, b1)
    t.rect(4, 2, 11, 6, gold)
    ell(t, 8.0, 6.5, 4.0, 4.0, gold)
    t.rect(7, 10, 8, 11, b1)
    t.rect(4, 12, 11, 14, g2)
    t.line(4, 12, 11, 12, P["copper2"])
    t.line(4, 14, 11, 14, g0)
    t.rect(6, 13, 9, 13, b1)                 # name plate
    t.line(10, 3, 10, 7, b1); t.line(11, 2, 11, 5, b1); t.px(9, 9, b1); t.px(10, 8, b1)
    t.line(5, 2, 5, 5, hot); t.px(6, 2, hot)
    t.line(4, 2, 11, 2, hot)
    t.px(7, 4, bone)


def i_options(s, pp):
    c = pp.part()
    for i in range(8):
        a = i * math.pi / 4
        x, y = 8 + 5.6 * math.cos(a), 8 + 5.6 * math.sin(a)
        c.rect(round(x - 1.5), round(y - 1.5), round(x - 1.5) + 2, round(y - 1.5) + 2, h2)
    ell(c, 8.0, 8.0, 5.2, 5.2, h2)
    # shade by side
    for y in range(16):
        for x in range(16):
            if c.get(x, y):
                if x + y > 18:
                    c.px(x, y, h1)
                if x + y < 10:
                    c.px(x, y, h3)
    ell(c, 8.0, 8.0, 2.0, 2.0, None)
    for (x, y) in ((6, 6),):
        c.px(x, y, h1)


def i_fold(s, pp):
    p = pp.part()
    p.rect(2, 2, 13, 13, bone)
    p.line(2, 13, 13, 13, h2)
    p.line(13, 6, 13, 13, h2)
    for j in range(5):  # the folded-away corner
        for i in range(5 - j):
            p.px(13 - i, 2 + j, None)
    for (x, y) in ((4, 11), (6, 9), (8, 7)):  # the crease, dashed in brass
        p.px(x, y, b1); p.px(x + 1, y - 1, b1)
    f = pp.part()  # the flap, folded down
    for j in range(5):
        for i in range(j + 1):
            f.px(9 + i, 2 + j, P["hull3"] if i < j else gold)
    f.line(9, 2, 9, 6, h2)
    f.line(9, 6, 13, 6, h2)
    f.px(10, 5, h2)
    f.px(9, 2, P["hull3"])


def i_flow(s, pp):
    for (y0, col, dk) in ((5, t1, t0), (10, P["iron2"], P["iron1"])):
        a = pp.part()
        pts = [(x, y0 + round(1.4 * math.sin((x - 1) * 0.85))) for x in range(1, 11)]
        for (x, y) in pts:
            a.rect(x, y, x, y + 1, col)
            a.px(x, y + 1, dk)
        ex, ey = 10, pts[-1][1]
        for j in range(4):
            a.line(ex + j, ey - 3 + j, ex + j, ey + 4 - j, col)
        a.line(ex, ey + 1, ex + 3, ey + 1, col)
        a.line(ex, ey + 4, ex + 1, ey + 3, dk)


def i_remove(s, pp):
    x = pp.part()
    tline(x, 2, 2, 12, 12, c1, 3)
    tline(x, 12, 2, 2, 12, c1, 3)
    for i in range(10):
        x.px(2 + i, 2 + i, c2)
        x.px(12 - i + 2, 2 + i + 2, c0)
    x.px(2, 12, c2); x.px(12, 2, c2); x.px(3, 3, P["hot"])


def i_rotate(s, pp):
    r = pp.part()
    for y in range(16):
        for x in range(16):
            dx, dy = x + 0.5 - 8, y + 0.5 - 8.5
            d = math.hypot(dx, dy)
            ang = math.degrees(math.atan2(dy, dx))
            if 3.6 < d <= 6.2 and not (-80 < ang < -10):
                r.px(x, y, gold if d > 5.0 and dx + dy < 2 else b1)
    for j in range(5):  # arrowhead pointing right at the top
        r.line(9 + j, 0 + j, 9 + j, 6 - j, gold if j < 2 else b1)
    r.line(9, 6, 11, 6, b0)
    for y in range(16):
        for x in range(16):
            if r.get(x, y) and x + y > 19:
                r.px(x, y, b0)


def i_factory(s, pp):
    f = pp.part()
    f.rect(11, 3, 13, 9, c1)            # chimney
    f.line(11, 5, 13, 5, c0); f.line(11, 8, 13, 8, c0); f.px(12, 3, c2)
    f.rect(1, 8, 14, 14, h1)
    for i in range(3):                  # saw-tooth roof
        x = 1 + i * 4
        for j in range(4):
            f.line(x, 7 - j, x + j, 7 - j, h2)
            f.line(x, 8 - j, x, 7, h2)
        f.line(x + 1, 7, x + 3, 4, h2)
        f.line(x + 1, 7 - 0, x + 3, 7, h1)
        f.px(x, 4, h3)
    f.rect(2, 10, 9, 11, glow)
    f.line(2, 10, 9, 10, hot)
    f.px(4, 10, h0); f.px(7, 10, h0); f.px(4, 11, h0); f.px(7, 11, h0)
    f.rect(11, 11, 13, 14, h0)          # door
    f.line(1, 14, 14, 14, h0)
    sm = pp.part()                      # smoke
    sm.rect(12, 0, 14, 1, h3); sm.px(14, 2, h2); sm.px(10, 1, h2)


def i_workshop(s, pp):
    b = pp.part()
    b.rect(1, 7, 14, 9, g2)             # bench top
    b.line(1, 7, 14, 7, P["copper2"])
    b.line(1, 9, 14, 9, g0)
    b.rect(2, 10, 3, 14, g1); b.rect(12, 10, 13, 14, g1)
    b.line(4, 12, 11, 12, g1)
    b.px(3, 10, g0); b.px(13, 10, g0)
    v = pp.part()                       # a vise on the bench
    v.rect(3, 3, 7, 6, h2)
    v.line(3, 3, 7, 3, h3)
    v.rect(5, 4, 5, 6, h0)
    v.line(8, 4, 9, 4, h1); v.px(9, 3, h1); v.px(9, 5, h1)
    g = pp.part()                       # a gear lying on it
    ell(g, 12.0, 5.0, 2.4, 2.4, b1)
    g.px(12, 2, b1); g.px(12, 7, b1); g.px(9, 5, b1); g.px(14, 5, b1)
    g.px(11, 4, gold); g.px(12, 5, b0)


def coin_body(s, cx, cy, rx, ry, hole=1, sparkle=False, small=False):
    """A brass washer-coin seen at a turn: rx shrinks as it spins."""
    if rx < 1.2:  # edge-on: a bar
        x = int(cx) - 1
        s.rect(x, int(cy - ry) + 1, x + 1, int(cy + ry) - 1, b1)
        s.line(x, int(cy - ry) + 1, x, int(cy + ry) - 1, gold)
        s.line(x + 1, int(cy - ry) + 1, x + 1, int(cy + ry) - 1, b0)
        return
    ell(s, cx, cy, rx, ry, b0)
    ell(s, cx - (0.5 if rx > 2 else 0), cy - 0.5, rx - 0.6, ry - 0.6, b1, only=P["brass0"])
    if rx > 3:
        ell(s, cx - 0.5, cy - 0.5, rx - 1.8, ry - 1.8, gold)
        ell(s, cx + 0.3, cy + 0.3, rx - 2.6, ry - 2.6, b1, only=P["gold"])
    elif rx > 1.8:
        ell(s, cx - 0.5, cy - 0.5, rx - 1.2, ry - 1.4, gold, only=P["brass1"])
    # the square hole, squashed with the spin
    hw = max(0, round(hole * rx / max(ry, 0.01)))
    if rx > 1.8:
        x0 = int(cx - hw / 2 - 0.5) if hw > 1 else int(cx) - (0 if small else 1)
        x0 = int(round(cx - max(hw, 1) / 2))
        y0 = int(round(cy - hole / 2))
        s.rect(x0, y0, x0 + max(hw, 1) - 1, y0 + hole - 1, None)
    # rim glint
    if rx > 3:
        s.px(int(cx - rx * 0.55), int(cy - ry * 0.55), hot)


def i_coin(s, pp):
    c = pp.part()
    coin_body(c, 8.0, 8.0, 6.5, 6.5, hole=2)


def i_heart(s, pp):
    h = pp.part()
    ascii_(h, 0, 0, [
        "................",
        "................",
        "...pCC....CCC...",
        "..pHCCC..CCCCC..",
        ".pHCCCCCCCCCCCC.",
        ".pCCCCCCCCCCCCc.",
        ".CCCCCCCCCCCCCc.",
        ".CCCCCCCCCCCCcc.",
        "..CCCCCCCCCCcc..",
        "...CCCCCCCCcc...",
        "....CCCCCCcc....",
        ".....CCCCcc.....",
        "......CCcc......",
        ".......cc.......",
    ])
    h.px(10, 3, P["copper2"])


def i_clock(s, pp):
    c = pp.part()
    c.rect(7, 0, 8, 1, b1)
    ell(c, 8.0, 8.5, 6.4, 6.4, b1)
    ell(c, 8.0, 8.5, 4.9, 4.9, bone)
    for y in range(16):
        for x in range(16):
            col = c.get(x, y)
            if col and col[:3] == (0xc9, 0x9a, 0x3a) and x + y > 18:
                c.px(x, y, b0)
            if col and col[:3] == (0xc9, 0x9a, 0x3a) and x + y < 11:
                c.px(x, y, gold)
    c.line(8, 8, 8, 5, k); c.line(8, 8, 10, 8, k)
    for (x, y) in ((8, 4), (12, 8), (8, 12), (4, 8)):
        c.px(x, y, h1)
    c.px(7, 0, hot)
    c.px(11, 11, P["hull3"]); c.px(10, 12, P["hull3"])


def i_lock(s, pp):
    sh = pp.part()
    ring(sh, 8.0, 6.5, 2.4, 4.6, h2)
    sh.rect(3, 7, 12, 8, None)
    for y in range(16):
        for x in range(16):
            if sh.get(x, y) and x > 8:
                sh.px(x, y, h1)
    sh.px(5, 3, h3); sh.px(4, 4, h3)
    b = pp.part()
    b.rect(3, 7, 12, 14, b1)
    b.line(3, 7, 12, 7, gold)
    b.line(3, 7, 3, 14, gold)
    b.line(4, 14, 12, 14, b0)
    b.line(12, 8, 12, 14, b0)
    b.rect(7, 9, 8, 10, k); b.px(7, 11, k); b.px(8, 11, k); b.px(7, 12, k)
    b.px(3, 7, hot)


def i_star(s, pp):
    st = pp.part()
    pts = []
    for i in range(10):
        a = -math.pi / 2 + i * math.pi / 5
        r = 7.4 if i % 2 == 0 else 3.1
        pts.append((8 + r * math.cos(a), 8.6 + r * math.sin(a)))
    st.polygon([(round(x), round(y)) for x, y in pts], gold)
    for y in range(16):
        for x in range(16):
            if st.get(x, y) and (x > 8 and y > 8 or y > 11):
                st.px(x, y, b1)
    st.px(7, 3, hot); st.px(7, 4, hot); st.px(6, 6, hot); st.px(4, 6, hot)


def _transport(s, pp, shapes):
    for poly in shapes:
        t = pp.part()
        if poly[0] == "rect":
            _, x0, y0, x1, y1 = poly
            t.rect(x0, y0, x1, y1, b1)
            t.line(x0, y0, x1, y0, gold); t.line(x0, y0, x0, y1, gold)
            t.line(x1, y0 + 1, x1, y1, b0); t.line(x0 + 1, y1, x1, y1, b0)
            t.px(x0, y0, hot)
        else:
            x0, x1, y0, y1 = poly
            h = (y1 - y0) / 2
            for x in range(x0, x1 + 1):
                f = (x - x0) / max(x1 - x0, 1)
                a = round(y0 + h * f)
                b = round(y1 - h * f)
                t.line(x, a, x, b, b1)
                t.px(x, a, gold)
                t.px(x, b, b0)
            t.line(x0, y0, x0, y1, gold)
            t.px(x0, y0, hot)


def i_play(s, pp):
    _transport(s, pp, [(4, 12, 2, 13)])


def i_pause(s, pp):
    _transport(s, pp, [("rect", 3, 2, 6, 13), ("rect", 9, 2, 12, 13)])


def i_ff(s, pp):
    _transport(s, pp, [(1, 7, 3, 12), (8, 14, 3, 12)])


# --------------------------------------------------------------------- Milestone 4 (Act II) icons
from icons_m4 import M4_FNS  # noqa: E402

FNS = [i_build, i_research, i_orders, i_stats, i_trophy, i_options, i_fold, i_flow, i_remove,
       i_rotate, i_factory, i_workshop, i_coin, i_heart, i_clock, i_lock, i_star, i_play, i_pause, i_ff]
FNS += M4_FNS
assert len(FNS) == len(ICON_ORDER), (len(FNS), len(ICON_ORDER))


def icons():
    s = new(16, 16, len(FNS))
    for i, fn in enumerate(FNS):
        s.frame(i + 1)
        pp = Parts(s)
        fn(s, pp)
        pp.done()
    return s


# --------------------------------------------------------------------- spinning coins
def coin(size):
    s = new(size, size, 6)
    c = size / 2
    R = size / 2 - 1.5 if size == 16 else size / 2 - 0.5
    for f in range(6):
        s.frame(f + 1)
        pp = Parts(s)
        p = pp.part()
        th = f * math.pi / 6
        rx = max(R * abs(math.cos(th)), 0.6)
        coin_body(p, c, c, rx, R, hole=2 if size == 16 else 1, small=(size == 8))
        if size == 16:
            pp.done()
        else:
            s.use(layer=pp.names[0]); s.outline(k); s.use(layer="main")
        if f == 0:  # a sparkle
            s.layer("spark")
            if size == 16:
                sx, sy = 12, 3
                s.px(sx, sy, bone)
                for (dx, dy) in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    s.px(sx + dx, sy + dy, hot)
                s.px(sx + 2, sy, hot); s.px(sx, sy - 2, hot)
            else:
                s.px(6, 1, bone); s.px(7, 1, hot); s.px(6, 0, hot)
            s.use(layer="main")
    return s


def build():
    out = {}
    s = icons()
    out["ui_icons"] = (export(s, "ui_icons", 0, extra={"names": ICON_ORDER}), s)
    s = coin(16)
    out["ui_coin"] = (export(s, "ui_coin", 10), s)
    s = coin(8)
    out["ui_coin_small"] = (export(s, "ui_coin_small", 10, scale=12), s)
    # check sheet: icons at 1x on panel wood and on a steel button, and at 6x
    im = out["ui_icons"][0]
    N = len(FNS)
    W = N * 18 + 4
    bg = Image.new("RGBA", (W, 60), (0x3a, 0x25, 0x32, 255))
    for i in range(N):
        bg.alpha_composite(frame_of(im, 16, i), (2 + i * 18, 2))
    btn = Image.open(OUT.parent.parents[1] / "src/art/ui_button.png") if (OUT.parent.parents[1] / "src/art/ui_button.png").exists() else None
    if btn:
        from common import nine
        for i in range(N):
            bg.alpha_composite(nine(frame_of(btn, 16, 0), (4, 4, 4, 5), 18, 20), (2 + i * 18, 22))
            bg.alpha_composite(frame_of(im, 16, i), (3 + i * 18, 23))
    bg.save(OUT / "icons_check_1x.png")
    up(bg, 3).save(OUT / "icons_check_3x.png")
    return out


if __name__ == "__main__":
    build()
