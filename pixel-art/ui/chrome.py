"""The HUD chrome: panels, wells, buttons, tabs, store rows, the ticker strip, research nodes and
the stamp ring. Every 9-slice is drawn ring by ring (outside in) with its own top-left /
bottom-right colour pair, so light always comes from the top-left; grain and studs are placed
so the edge and centre pieces TILE seamlessly (the game should tile them, not stretch them).
"""
import math
from common import P, new, ell, ring, export, nine, text, sheet, up, strip, OUT, frame_of
from PIL import Image

k, s_, bone = P["ink"], P["shadow"], P["bone"]
g0, g1, g2 = P["ground0"], P["ground1"], P["ground2"]
h0, h1, h2, h3 = P["hull0"], P["hull1"], P["hull2"], P["hull3"]
b0, b1, gold, hot, glow = P["brass0"], P["brass1"], P["gold"], P["hot"], P["glow"]
t0, t1 = P["teal0"], P["teal1"]
i0 = P["iron0"]


def bring(s, x0, y0, x1, y1, tl, br, tr=None, bl=None):
    """One 1-px ring: top and left in `tl`, bottom and right in `br`; the two off-light
    corners (top-right, bottom-left) take `tr`/`bl` (default: tl)."""
    s.line(x0, y0, x1 - 1, y0, tl)
    s.line(x0, y0, x0, y1 - 1, tl)
    s.line(x0 + 1, y1, x1, y1, br)
    s.line(x1, y0 + 1, x1, y1, br)
    s.px(x1, y0, tr or tl)
    s.px(x0, y1, bl or tl)


def round_corners(s, w, h, r=1):
    pts = [(0, 0)] if r == 1 else [(0, 0), (1, 0), (0, 1)]
    for (x, y) in pts:
        for (X, Y) in ((x, y), (w - 1 - x, y), (x, h - 1 - y), (w - 1 - x, h - 1 - y)):
            s.px(X, Y, None)


# ------------------------------------------------------------------ dark-wood panel
def panel():
    W = 32
    s = new(W, W)
    rings = [
        (k, k),          # 0 outline
        (b1, b0),        # 1-2 a rounded brass rod: lit half on the outside top-left
        (b0, b1),
        (k, k),          # 3 a hairline between rod and wood
        (g2, g0),        # 4-6 the wood frame, bevelled
        (g1, g1),
        (g1, g1),
        (k, g2),         # 7 the recess: shadow cast on the face top-left, lit lip bottom-right
    ]
    for i, (tl, br) in enumerate(rings):
        bring(s, i, i, W - 1 - i, W - 1 - i, tl, br)
    # the face: dark wood, irregular grain on a 16x16 tile
    s.rect(8, 8, 23, 23, s_)
    grain = [(1, 0, 6), (1, 11, 14), (4, 3, 9), (6, 13, 15), (6, 0, 1), (9, 6, 12),
             (12, 1, 4), (12, 9, 10), (14, 12, 15), (14, 0, 0), (15, 5, 8)]
    for (yy, xa, xb) in grain:
        s.line(8 + xa, 8 + yy, 8 + xb, 8 + yy, g0)
    for (xx, yy) in [(4, 4), (13, 10)]:  # two knots
        s.px(8 + xx, 8 + yy, k)
    # grain dashes in the frame (period 16 along each edge so they tile)
    for x in range(8, 24):
        if (x * 7) % 16 in (0, 1, 2):
            s.px(x, 5, g0)
        if (x * 5) % 16 in (3, 4):
            s.px(x, W - 1 - 5, g0)
    for y in range(8, 24):
        if (y * 7) % 16 in (5, 6, 7):
            s.px(5, y, g0)
        if (y * 5) % 16 in (9, 10):
            s.px(W - 1 - 5, y, g0)
    # corner plates with a rivet (lit top-left in every corner)
    for (cx, cy) in ((1, 1), (W - 7, 1), (1, W - 7), (W - 7, W - 7)):
        s.rect(cx, cy, cx + 5, cy + 5, b1)
        s.line(cx, cy, cx + 4, cy, gold)
        s.line(cx, cy, cx, cy + 4, gold)
        s.line(cx + 1, cy + 5, cx + 5, cy + 5, b0)
        s.line(cx + 5, cy + 1, cx + 5, cy + 5, b0)
        s.px(cx, cy, hot)
        # plate outline where it meets the wood
        inner_x = cx + 6 if cx < 8 else cx - 1
        inner_y = cy + 6 if cy < 8 else cy - 1
        for t in range(6):
            s.px(inner_x, cy + t, k)
            s.px(cx + t, inner_y, k)
        s.px(inner_x, inner_y, k)
        # rivet: 2x2 dome + cast shadow
        rx, ry = cx + 2, cy + 2
        s.px(rx, ry, hot); s.px(rx + 1, ry, gold); s.px(rx, ry + 1, gold); s.px(rx + 1, ry + 1, b0)
        s.px(rx + 2, ry + 2, b0)
    round_corners(s, W, W)
    return s


# ------------------------------------------------------------------ parchment card
def paper():
    W = 24
    s = new(W, W)
    rings = [(k, k), (b1, b0), (k, k), (P["hull3"], P["hull2"]), (bone, P["hull3"]), (bone, bone)]
    for i, (tl, br) in enumerate(rings):
        bring(s, i, i, W - 1 - i, W - 1 - i, tl, br)
    s.rect(6, 6, 17, 17, bone)
    for (x, y) in [(2, 3), (9, 1), (5, 9), (11, 7), (1, 11)]:  # fibres on a 12x12 tile
        s.px(6 + x, 6 + y, h3)
    # brass photo corners (triangles) with a pin
    for (cx, cy, fx, fy) in ((1, 1, 1, 1), (W - 2, 1, -1, 1), (1, W - 2, 1, -1), (W - 2, W - 2, -1, -1)):
        for j in range(5):
            for i in range(5 - j):
                s.px(cx + fx * i, cy + fy * j, b1)
        for i in range(5):
            s.px(cx + fx * i, cy + fy * (4 - i), b0 if fy < 0 or fx < 0 else k)  # hypotenuse edge
        s.px(cx + fx * 1, cy + fy * 1, hot)
        # the light: top/left edges of each triangle gold
        if fy > 0:
            s.line(cx, cy, cx + fx * 3, cy, gold)
        if fx > 0:
            s.line(cx, cy, cx, cy + fy * 3, gold)
    round_corners(s, W, W)
    return s


# ------------------------------------------------------------------ recessed well
def inset():
    W = 12
    s = new(W, W)
    rings = [(b0, b1), (k, k), (k, s_)]
    for i, (tl, br) in enumerate(rings):
        bring(s, i, i, W - 1 - i, W - 1 - i, tl, br, tr=k, bl=k)
    s.rect(3, 3, 8, 8, k)
    s.px(0, 0, None); s.px(W - 1, 0, None); s.px(0, W - 1, None); s.px(W - 1, W - 1, None)
    s.px(W - 1, 0, None)
    return s


# ------------------------------------------------------------------ buttons
def _button(s, face, hi, glint, lip, side, stud, pressed=False, shine=None):
    W = 16
    top = 1 if pressed else 0
    lip_rows = 1 if pressed else 2
    # outline box
    s.rect(1, top, W - 2, 15, k)
    s.rect(0, top + 1, W - 1, 14, k)
    # body
    body_bot = 15 - 1 - lip_rows
    s.rect(1, top + 1, W - 2, body_bot, face)
    if pressed:
        s.line(1, top + 1, W - 2, top + 1, lip)      # inner shadow on top
        s.line(1, top + 1, 1, body_bot, lip)
    else:
        s.line(2, top + 1, W - 3, top + 1, hi)
        s.line(1, top + 2, 1, body_bot - 1, hi)
        s.px(1, top + 1, glint)
        s.line(W - 2, top + 2, W - 2, body_bot, side)
        s.line(2, body_bot, W - 2, body_bot, side)
        if shine:  # a diagonal sheen in the top-left corner piece
            s.px(3, top + 2, shine); s.px(2, top + 3, shine)
    # the lip (the button's front edge)
    s.rect(1, body_bot + 1, W - 2, 14, lip)
    # studs, one in each corner piece
    sy0, sy1 = top + 2 + (1 if pressed else 0), 11
    for (x, y) in ((3, sy0), (W - 4, sy0), (3, sy1), (W - 4, sy1)):
        s.px(x, y, stud)
    for (X, Y) in ((0, top), (W - 1, top), (0, 15), (W - 1, 15)):
        s.px(X, Y, None)


def button(gold_=False):
    s = new(16, 16, 3)
    if not gold_:
        specs = [dict(face=h0, hi=h1, glint=h2, lip=i0, side=i0, stud=b1),
                 dict(face=h1, hi=h2, glint=h3, lip=h0, side=h0, stud=gold),
                 dict(face=h0, hi=h1, glint=h2, lip=i0, side=i0, stud=b0, pressed=True)]
    else:
        specs = [dict(face=b1, hi=gold, glint=hot, lip=b0, side=b0, stud=hot, shine=hot),
                 dict(face=gold, hi=hot, glint=bone, lip=b0, side=b1, stud=bone, shine=bone),
                 dict(face=b1, hi=gold, glint=hot, lip=b0, side=b0, stud=gold, pressed=True)]
    for f, spec in enumerate(specs):
        s.frame(f + 1)
        _button(s, **spec)
    return s


# ------------------------------------------------------------------ tabs
def tab():
    W, H = 16, 16
    s = new(W, H, 2)
    # frame 1: inactive -- lower (top at y=3), darker, rests on the panel (rows 12-15 empty)
    s.frame(1)
    s.rect(1, 3, W - 2, 11, k)
    s.rect(0, 4, W - 1, 11, k)
    s.rect(1, 4, W - 2, 11, g0)
    s.line(2, 4, W - 3, 4, b0)
    s.line(1, 5, 1, 11, b0)
    s.line(W - 2, 5, W - 2, 11, s_)
    s.rect(2, 5, W - 3, 11, g0)
    s.line(2, 5, W - 3, 5, g1)
    # frame 2: active -- full height, the panel's frame profile, open at the bottom: drawn
    # after the panel with its bottom 4 rows over the panel's top 4 rows (ink, brass, ink)
    s.frame(2)
    s.rect(1, 0, W - 2, H - 1, k)
    s.rect(0, 1, W - 1, H - 1, k)
    s.rect(1, 1, W - 2, H - 1, b1)
    s.rect(2, 2, W - 3, H - 1, b0)
    s.line(W - 2, 2, W - 2, H - 1, b0)
    s.line(W - 3, 3, W - 3, H - 1, b1)
    s.rect(3, 3, W - 4, H - 1, k)
    s.rect(4, 4, W - 5, H - 1, g1)
    s.line(4, 4, W - 5, 4, g2)
    s.line(4, 4, 4, H - 1, g2)
    s.px(1, 1, gold); s.px(2, 1, gold); s.px(1, 2, gold)
    for (X, Y) in ((0, 0), (W - 1, 0)):
        s.px(X, Y, None)
    return s


# ------------------------------------------------------------------ store row plaque
def row():
    W = 24
    s = new(W, W, 3)
    looks = [
        dict(trim=(b1, b0), bevel=(g2, g0), face=g1, lip=s_, stud=gold, grain=g0),
        dict(trim=(gold, b1), bevel=(h3, g1), face=g2, lip=g0, stud=hot, grain=g1),
        dict(trim=(h1, h0), bevel=(h0, k), face=s_, lip=k, stud=h1, grain=k),
    ]
    for f, L in enumerate(looks):
        s.frame(f + 1)
        bring(s, 0, 0, W - 1, W - 1, k, k)
        bring(s, 1, 1, W - 2, W - 3, *L["trim"])
        bring(s, 2, 2, W - 3, W - 4, *L["bevel"])
        s.line(1, W - 2, W - 2, W - 2, L["lip"])   # the plaque's thickness
        s.rect(3, 3, W - 4, W - 5, L["face"])
        # grain on the 12x12 centre tile (x 6..17, y 6..17) and in the edge pieces
        for (yy, xa, xb) in [(1, 0, 4), (4, 7, 11), (7, 2, 6), (10, 9, 11), (10, 0, 0)]:
            s.line(6 + xa, 6 + yy, 6 + xb, 6 + yy, L["grain"])
        for (x, y) in ((3, 3), (W - 4, 3), (3, W - 6), (W - 4, W - 6)):
            s.px(x, y, L["stud"])
        round_corners(s, W, W)
    return s


# ------------------------------------------------------------------ news ticker slot
def ticker():
    W, H = 24, 16
    s = new(W, H)
    s.rect(0, 0, W - 1, H - 1, k)
    s.line(1, 1, W - 2, 1, b1)
    s.line(1, 2, W - 2, 2, b0)
    s.line(1, 3, W - 2, 3, k)
    s.rect(1, 4, W - 2, 12, s_)
    s.line(1, 13, W - 2, 13, b1)
    s.line(1, 14, W - 2, 14, b0)
    # bulbs along the top rod every 4 px (tiles with the 12-px middle)
    # end plates
    for x0 in (1, W - 5):
        s.rect(x0, 1, x0 + 3, 14, b1)
        s.line(x0, 1, x0 + 3, 1, gold)
        s.line(x0, 1, x0, 13, gold)
        s.line(x0 + 3, 2, x0 + 3, 14, b0)
        s.line(x0 + 1, 14, x0 + 3, 14, b0)
        ex = x0 + 4 if x0 == 1 else x0 - 1
        s.line(ex, 1, ex, 14, k)
        for ry in (3, 11):
            s.px(x0 + 1, ry, hot); s.px(x0 + 2, ry, gold); s.px(x0 + 2, ry + 1, b0)
    # the left plate's lamp (the ticker is "on air")
    s.px(2, 6, k); s.px(3, 6, k); s.px(2, 9, k); s.px(3, 9, k); s.px(1, 7, k); s.px(1, 8, k); s.px(4, 7, k); s.px(4, 8, k)
    s.px(2, 7, hot); s.px(3, 7, glow); s.px(2, 8, glow); s.px(3, 8, P["copper1"])
    for (X, Y) in ((0, 0), (W - 1, 0), (0, H - 1), (W - 1, H - 1)):
        s.px(X, Y, None)
    return s


# ------------------------------------------------------------------ research nodes
def node():
    """32x32: a dark disc (r 10) the code draws the 16x16 icon on (centred: icon at +8,+8), a
    bevelled 3-px ring, an ink rim and, for the live states, a halo. (24x24 was asked for, but a
    16x16 icon cannot sit inside a ring that small: it covered the ring and the laurel.)"""
    S = 32
    s = new(S, S, 4)
    c = 16.0
    R_DISC, R_RING, R_RIM = 10.0, 13.0, 14.0
    states = [
        dict(ring=(h1, h0, h0), disc=k, halo=None),
        dict(ring=(gold, b1, b0), disc=s_, halo=(glow, None), glint=hot),
        dict(ring=(t1, t1, t0), disc=s_, halo=(t0, t1), glint=bone),
        dict(ring=(hot, gold, b1), disc=s_, halo=None, glint=bone, laurel=True),
    ]
    for f, st in enumerate(states):
        s.frame(f + 1)
        lit, mid, dark = st["ring"]
        for y in range(S):
            for x in range(S):
                dx, dy = x + 0.5 - c, y + 0.5 - c
                d = math.hypot(dx, dy)
                light = -(dx + dy) / max(d, 0.01) / math.sqrt(2)  # +1 toward top-left
                if d <= R_DISC:
                    col = st["disc"]
                    if d > R_DISC - 1 and light > 0.3:
                        col = k  # the disc's recessed top-left edge
                elif d <= R_RING:
                    band = (d - R_DISC) / (R_RING - R_DISC)  # 0 inner .. 1 outer
                    tone = 2 if light > 0.45 else (1 if light > -0.45 else 0)
                    if band < 0.34:
                        tone = max(0, tone - 1)
                    col = (dark, mid, lit)[tone]
                elif d <= R_RIM:
                    col = k
                elif st["halo"] and d <= R_RIM + 1.0 and st["halo"][1]:
                    col = st["halo"][0]           # a solid inner glow (selected)
                elif st["halo"] and d <= R_RIM + 2.2 and (x + y) % 2 == 0:
                    col = st["halo"][1] or st["halo"][0]
                else:
                    continue
                s.px(x, y, col)
        if st.get("glint"):
            for (x, y) in ((6, 9), (7, 8), (8, 7), (9, 6)):
                s.px(x, y, st["glint"])
        if st.get("laurel"):
            # the ring's lower half becomes a laurel: leaves alternating leaf / moss, tips out
            for y in range(S):
                for x in range(S):
                    dx, dy = x + 0.5 - c, y + 0.5 - c
                    d = math.hypot(dx, dy)
                    if not (R_DISC + 0.1 < d <= R_RIM + 0.8) or dy < 2.0:
                        continue
                    phi = math.degrees(math.atan2(dy, dx))  # 0 (right) .. 180 (left)
                    u = (phi % 18) / 18.0  # position within one leaf
                    if d > R_RIM:
                        if 0.15 < u < 0.6:
                            s.px(x, y, P["leaf"])
                        continue
                    if d > R_RING:
                        if 0.1 < u < 0.7:
                            s.px(x, y, P["leaf"])
                        continue
                    col = P["leaf"] if (d > R_DISC + 1.4 and u < 0.55) else P["moss"]
                    if u > 0.85:
                        col = k
                    s.px(x, y, col)
            # the check badge, bottom-right
            bx, by = 24, 24
            ell(s, bx + 3.0, by + 3.0, 4.0, 4.0, k)
            ell(s, bx + 3.0, by + 3.0, 3.0, 3.0, P["leaf"])
            s.px(bx + 1, by + 1, P["hot"])
            for (x, y) in ((bx + 1, by + 3), (bx + 2, by + 4), (bx + 3, by + 3), (bx + 4, by + 2), (bx + 5, by + 1)):
                s.px(x, y, bone)
    return s


# ------------------------------------------------------------------ rubber-stamp ring
def stamp_ring():
    S = 48
    s = new(S, S)
    c = 24.0
    red, dk = P["copper1"], P["copper0"]
    for y in range(S):
        for x in range(S):
            d = math.hypot(x + 0.5 - c, y + 0.5 - c)
            h = (x * 73856093 ^ y * 19349663) % 100
            if 20.5 < d <= 23.5:
                if h < 9:
                    continue  # worn rubber
                s.px(x, y, dk if (d > 23.0 or h < 20) else red)
            elif 17.0 < d <= 18.4:
                if h < 12:
                    continue
                s.px(x, y, red)
    # eight studs between the rings
    for i in range(8):
        a = i * math.pi / 4 + math.pi / 8
        x, y = c + 19.7 * math.cos(a), c + 19.7 * math.sin(a)
        s.px(int(x), int(y), red)
        s.px(int(x) - 1, int(y), red)
        s.px(int(x), int(y) - 1, red)
        s.px(int(x) - 1, int(y) - 1, dk)
    return s


def build():
    out = {}
    for name, fn, fps, sl in [
        ("ui_panel", panel, 0, (8, 8, 8, 8)),
        ("ui_panel_light", paper, 0, (6, 6, 6, 6)),
        ("ui_inset", inset, 0, (3, 3, 3, 3)),
        ("ui_button", lambda: button(False), 0, (4, 4, 4, 5)),
        ("ui_button_gold", lambda: button(True), 0, (4, 4, 4, 5)),
        ("ui_tab", tab, 0, (5, 5, 5, 4)),
        ("ui_row", row, 0, (6, 6, 6, 6)),
        ("ui_ticker", ticker, 0, (6, 4, 6, 3)),
        ("ui_node", node, 0, None),
        ("ui_stamp_ring", stamp_ring, 0, None),
    ]:
        spr = fn()
        out[name] = (export(spr, name, fps, sl), spr, sl)
    return out


def preview(out):
    """Every 9-slice drawn at real UI sizes with real text, at 1x and 3x."""
    W, H = 400, 230
    im = Image.new("RGBA", (W, H), (0x2b, 0x23, 0x30, 255))
    pan = out["ui_panel"][0]
    im.alpha_composite(nine(pan, (8, 8, 8, 8), 150, 120), (4, 22))
    # tabs on the panel
    tb = out["ui_tab"][0]
    for i, x in enumerate((10, 46, 82)):
        f = frame_of(tb, 16, 1 if i == 0 else 0)
        im.alpha_composite(nine(f, (5, 5, 5, 4), 34, 16), (x, 22 - 12))
    text(im, "Build", 27, 14, bone, align="center")
    text(im, "Lab", 63, 16, P["hull2"], align="center")
    text(im, "Stats", 99, 16, P["hull2"], align="center")
    # re-draw the panel top under the active tab: active tab must be drawn after the panel
    im.alpha_composite(nine(frame_of(tb, 16, 1), (5, 5, 5, 4), 34, 16), (10, 22 - 12))
    text(im, "Build", 27, 13, bone, align="center", shadow=k)
    rw = out["ui_row"][0]
    for i in range(3):
        y = 34 + i * 32
        im.alpha_composite(nine(frame_of(rw, 24, i), (6, 6, 6, 6), 134, 30), (12, y))
        inn = out["ui_inset"][0]
        im.alpha_composite(nine(inn, (3, 3, 3, 3), 26, 26), (14, y + 1))
        text(im, ["Miner", "Smelter", "Press"][i], 44, y + 5, bone if i < 2 else P["hull1"], shadow=k)
        text(im, "\u0002 1.25K", 44, y + 16, P["gold"] if i < 2 else P["hull1"], shadow=k)
        text(im, str(12 - i * 5), 140, y + 8, P["ground2"] if i < 2 else P["hull0"], sc=2, align="right")
    # buttons
    bt, bg = out["ui_button"][0], out["ui_button_gold"][0]
    for i in range(3):
        im.alpha_composite(nine(frame_of(bt, 16, i), (4, 4, 4, 5), 46, 18), (162 + i * 50, 22))
        text(im, ["Sell", "Sell", "Sell"][i], 162 + i * 50 + 23, 22 + 5 + (1 if i == 2 else 0), bone, align="center", shadow=k)
        im.alpha_composite(nine(frame_of(bg, 16, i), (4, 4, 4, 5), 46, 18), (162 + i * 50, 44))
        text(im, "Fold", 162 + i * 50 + 23, 44 + 5 + (1 if i == 2 else 0), k, align="center")
    # paper card
    pp = out["ui_panel_light"][0]
    im.alpha_composite(nine(pp, (6, 6, 6, 6), 110, 50), (162, 68))
    text(im, "Mayor Bramble", 170, 76, k)
    text(im, "wants 40 iron plates", 170, 88, P["ground1"])
    # inset counter
    inn = out["ui_inset"][0]
    im.alpha_composite(nine(inn, (3, 3, 3, 3), 110, 24), (162, 124))
    text(im, "1,284", 170, 128, P["gold"], sc=2, shadow=k)
    im.alpha_composite(nine(inn, (3, 3, 3, 3), 110, 8), (162, 152))
    im.paste(Image.new("RGBA", (60, 2), (0x66, 0xcc, 0x50, 255)), (165, 155))
    # ticker
    tk = out["ui_ticker"][0]
    im.alpha_composite(nine(tk, (6, 4, 6, 3), 230, 16), (162, 166))
    text(im, "Bramble opens a pond-side bank; frogs queue for it.", 172, 170, bone)
    # nodes + stamp
    nd = out["ui_node"][0]
    for i in range(4):
        im.alpha_composite(frame_of(nd, 32, i), (300 + (i % 2) * 34, 90 + (i // 2) * 34))
    im.alpha_composite(out["ui_stamp_ring"][0], (344, 26))
    im.save(OUT / "chrome_test_1x.png")
    up(im, 3).save(OUT / "chrome_test_3x.png")


if __name__ == "__main__":
    o = build()
    preview(o)
