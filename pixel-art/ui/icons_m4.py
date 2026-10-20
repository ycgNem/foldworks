"""The nine Milestone 4 (Act II) toolbar icons, appended to ui_icons after the first 20 (icons.py
imports M4_FNS; the order of ICON_ORDER there is the contract). Same recipe as icons.py: every
part on its own layer through `pp.part()`, outlined in ink by `pp.done()`, light from the
top-left, a 1 px margin left for the outline. Each one reads by silhouette first:

    power      a lightning bolt              heavy   an anvil with a gear behind it
    codex      a violet book with a teal gem survey  a stake with a pennant in a mound
    mega       a big spiral drill bit        kit     a crate with a wrench across it
    claim      a pickaxe over an ore heap    overdrive  a flame with an up-chevron in its core
    mode       a knob pointing at one of three ticks
"""
import math
from common import P, ell, ring, ascii_

k, bone, sh = P["ink"], P["bone"], P["shadow"]
g0, g1, g2 = P["ground0"], P["ground1"], P["ground2"]
h0, h1, h2, h3 = P["hull0"], P["hull1"], P["hull2"], P["hull3"]
i0, i1, i2 = P["iron0"], P["iron1"], P["iron2"]
b0, b1, gold, hot, glow = P["brass0"], P["brass1"], P["gold"], P["hot"], P["glow"]
c0, c1, c2 = P["copper0"], P["copper1"], P["copper2"]
t0, t1 = P["teal0"], P["teal1"]
moss, leaf, violet, slag = P["moss"], P["leaf"], P["violet"], P["slag"]


def tline(s, x0, y0, x1, y1, col, w=2):
    n = max(abs(x1 - x0), abs(y1 - y0))
    for i in range(n + 1):
        x = round(x0 + (x1 - x0) * i / max(n, 1))
        y = round(y0 + (y1 - y0) * i / max(n, 1))
        s.rect(x, y, x + w - 1, y + w - 1, col)


def shade(s, test, col, only=None):
    """Recolour every drawn pixel of the current cel where test(x, y) holds."""
    for y in range(16):
        for x in range(16):
            v = s.get(x, y)
            if v and v[3] and test(x, y):
                if only is None or "#%02x%02x%02x" % v[:3] == only:
                    s.px(x, y, col)


def i_power(s, pp):
    b = pp.part()
    b.polygon([(8, 1), (12, 1), (9, 6), (13, 6), (5, 14), (7, 8), (3, 8)], gold)
    shade(b, lambda x, y: x + y >= 17 or (y >= 9 and x >= 7), b1)      # the far side
    b.line(8, 1, 4, 7, hot)                                          # lit edges
    b.line(9, 6, 11, 6, hot)
    b.px(8, 1, bone); b.px(9, 1, hot); b.px(10, 1, hot)
    b.px(6, 12, b0); b.px(5, 13, b0); b.px(12, 7, b0)


def i_heavy(s, pp):
    g = pp.part()                                    # a brass gear rising behind the anvil
    cx, cy = 10.0, 4.0
    for i in range(8):
        a = i * math.pi / 4
        x, y = cx + 3.9 * math.cos(a), cy + 3.9 * math.sin(a)
        g.rect(round(x - 1), round(y - 1), round(x - 1) + 1, round(y - 1) + 1, b1)
    ell(g, cx, cy, 3.1, 3.1, b1)
    shade(g, lambda x, y: x + y < 13, gold)
    shade(g, lambda x, y: x + y > 15, b0)
    ell(g, cx, cy, 1.1, 1.1, None)
    a = pp.part()                                    # the anvil
    ascii_(a, 0, 1, [
        "................",
        "................",
        "................",
        "................",
        "................",
        "................",
        "....33333333333.",
        ".33222222222221.",
        "...12222222211..",
        "......2221......",
        "......2211......",
        ".....222111.....",
        "...2222211110...",
        "...1111111000...",
    ])
    a.px(4, 7, bone)


def i_codex(s, pp):
    p = pp.part()                                    # the page block, seen at the fore-edge
    p.rect(4, 3, 14, 14, bone)
    for y in (5, 7, 9, 11, 13):
        p.line(13, y, 14, y, h3)
    p.line(4, 14, 14, 14, h3)
    c = pp.part()                                    # the cover and its spine
    c.rect(1, 1, 12, 13, violet)
    c.rect(1, 1, 3, 13, slag)
    c.line(4, 1, 4, 13, sh)
    c.line(5, 1, 12, 1, c2)                          # lit top edge
    c.line(5, 13, 12, 13, slag)
    c.line(12, 2, 12, 12, slag)
    for y in (3, 11):                                # spine bands
        c.line(1, y, 3, y, b1)
    c.rect(11, 1, 12, 2, gold); c.px(12, 1, hot)     # brass corners
    c.rect(11, 12, 12, 13, b1)
    # the gem: a teal lozenge in a gold setting
    ascii_(c, 5, 3, [
        "..gg..",
        ".gTTg.",
        "gTbTtg",
        "gTTtty",
        ".gtty.",
        "..yy..",
    ])
    c.px(7, 10, b1); c.px(8, 10, b1)


def i_survey(s, pp):
    m = pp.part()                                    # a mound of turned earth
    ell(m, 7.5, 13.5, 5.6, 2.2, g1)
    shade(m, lambda x, y: y <= 12 and x < 8, g2)
    shade(m, lambda x, y: y >= 14 or x > 10, g0)
    st = pp.part()                                   # the stake, pointed into the mound
    st.rect(6, 2, 7, 12, g2)
    st.line(7, 3, 7, 12, g1)
    st.px(6, 2, h3)
    st.px(6, 13, g1)
    st.rect(5, 4, 8, 4, b1)                          # a brass band (the survey mark)
    st.px(5, 4, gold)
    f = pp.part()                                    # the pennant, snapping right
    ascii_(f, 8, 1, [
        "CCCC...",
        "pCCCCC.",
        "pCCCCCC",
        "CCCCcc.",
        "Ccc....",
    ])
    f.px(8, 1, P["copper2"])


def i_mega(s, pp):
    d = pp.part()
    d.rect(6, 1, 9, 3, b1)                           # the shank
    d.line(6, 1, 6, 3, gold)
    d.line(9, 1, 9, 3, b0)
    d.rect(3, 4, 12, 5, gold)                        # collar
    d.line(3, 5, 12, 5, b1)
    d.px(3, 4, hot); d.px(12, 5, b0); d.px(12, 4, b1)
    for y in range(6, 15):                           # the bit: a cone with spiral flutes
        half = 4.8 * (14.6 - y) / 8.6
        for x in range(16):
            u = x + 0.5 - 8
            if abs(u) <= half + 0.01:
                band = (x + y) % 4
                col = h3 if band < 2 else (h1 if band == 2 else h0)
                if u > half * 0.3 and col == h3:
                    col = h2
                d.px(x, y, col)
    d.px(7, 14, h2); d.px(8, 14, h1)


def i_kit(s, pp):
    c = pp.part()                                    # the crate
    c.rect(1, 5, 12, 14, g2)
    for y in (8, 11):
        c.line(1, y, 12, y, g1)                      # plank joints
    c.rect(1, 5, 2, 14, g1); c.rect(11, 5, 12, 14, g1)   # corner posts
    c.line(1, 5, 12, 5, P["copper2"])                # lit top edge
    c.line(1, 14, 12, 14, g0)
    c.line(12, 6, 12, 14, g0)
    for (x, y) in ((2, 6), (11, 6), (2, 13), (11, 13)):
        c.px(x, y, h3)                               # nails
    w = pp.part()                                    # the wrench, lying across it
    tline(w, 5, 12, 11, 6, h2)
    ell(w, 12.5, 4.5, 3.0, 3.0, h2)
    for (x, y) in ((13, 2), (14, 2), (13, 3), (14, 3), (12, 3), (13, 4), (14, 1), (15, 2)):
        w.px(x, y, None)                             # the open jaw, facing up-right
    ell(w, 4.5, 12.5, 2.1, 2.1, h2)
    w.px(4, 12, None)
    w.line(7, 11, 11, 7, h3)
    w.line(6, 13, 12, 7, h1)
    w.px(11, 3, h3); w.px(10, 4, h3)


def i_claim(s, pp):
    o = pp.part()                                    # an ore heap: iron and copper lumps
    ell(o, 10.0, 12.0, 5.2, 3.0, i1)
    ell(o, 9.2, 11.2, 4.0, 2.0, i2, only=i1)
    ell(o, 13.0, 11.5, 2.3, 2.2, c1)
    o.px(12, 11, P["copper2"]); o.px(14, 13, c0)
    o.px(8, 11, bone); o.px(7, 14, i0); o.px(11, 14, i0); o.px(10, 13, i0)
    hd = pp.part()                                   # the handle
    tline(hd, 2, 13, 9, 6, g2)
    hd.line(3, 14, 10, 7, g1)
    p = pp.part()                                    # the pick head: a crescent across the top
    for y in range(16):
        for x in range(16):
            d = math.hypot(x + 0.5 - 3.5, y + 0.5 - 12.5)
            ang = math.degrees(math.atan2(y + 0.5 - 12.5, x + 0.5 - 3.5))
            if 9.0 < d <= 10.8 and -96 < ang < -6:
                p.px(x, y, h2 if d > 9.9 else h1)
    p.px(4, 2, h3); p.px(5, 2, h3); p.px(14, 11, h1)
    p.rect(8, 5, 10, 6, b1)                          # the collar where head meets handle
    p.px(8, 5, gold)


def i_overdrive(s, pp):
    f = pp.part()
    ascii_(f, 0, 0, [
        "........o.......",
        ".......oo.......",
        "......ooC.....o.",
        "......oCC....oC.",
        ".....oCHCo..oCC.",
        "....oCHHHCooCCC.",
        "...oCHHbHHCCCCC.",
        "..oCCHHbbHHCCCC.",
        "..oCoHHHHHHoCCc.",
        "..oCooHHHHooCCc.",
        "..oCCoooooCCCCc.",
        "..oCCCCCCCCCCcc.",
        "...cCCCCCCCCcc..",
        "....ccCCCCCcc...",
        "......cccc......",
    ])
    ch = pp.part()                                   # the chevron: a bold up-arrow in front
    for j in range(4):
        for t in range(2):
            ch.px(8 - j - 1, 9 + j + t, gold)
            ch.px(8 + j, 9 + j + t, gold)
    ch.px(7, 9, hot); ch.px(8, 9, hot)
    ch.px(6, 10, hot); ch.px(5, 11, hot); ch.px(4, 12, hot)
    ch.px(11, 13, b1); ch.px(11, 12, b1); ch.px(10, 12, b1)


def i_mode(s, pp):
    # three position ticks on an arc, then a knurled knob (a short cylinder seen from above and
    # in front) whose pointer aims at the right-hand tick
    for (x, y, col, dk) in ((1, 5, leaf, moss), (7, 1, gold, b1), (13, 5, c1, c0)):
        t = pp.part()
        t.rect(x, y, x + 1, y + 1, col)
        t.px(x + 1, y + 1, dk)
    kb = pp.part()
    ell(kb, 8.0, 11.5, 5.5, 3.0, h1)                 # the skirt
    kb.rect(3, 8, 12, 11, h1)
    for x in range(3, 13):                           # knurling
        if x % 2 == 0:
            kb.line(x, 10, x, 13, h0 if x > 7 else h2)
    ell(kb, 8.0, 8.5, 5.5, 3.0, h2)                  # the cap
    ell(kb, 7.5, 8.0, 4.0, 2.0, h3, only=h2)
    kb.line(8, 8, 11, 7, k)                          # the pointer, a groove to the cap's edge
    kb.px(7, 8, k)
    kb.px(12, 7, hot)
    kb.px(4, 7, bone)


M4_FNS = [i_power, i_heavy, i_codex, i_survey, i_mega, i_kit, i_claim, i_overdrive, i_mode]
