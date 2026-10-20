"""Display lettering: the FOLDWORKS logo (+ its glint sweep) and the fold grade stamps S A B C D.

Letters are designed on a cell grid (7 x 9 cells, 3 px per cell, strokes two cells thick),
corner-rounded by one pixel, then shaded: lit face, a 3-px extruded depth in a darker step, a
2-px ink outline, a drop shadow. The logo carries a fold crease: everything below the crease
line is one step darker and shifted 1 px right, with a bright ridge on the crease itself, as if
the word had been folded and opened again.
"""
import math
from common import P, new, export, sheet, up, OUT, frame_of, checker
from PIL import Image

k, sh, bone = P["ink"], P["shadow"], P["bone"]
b0, b1, gold, hot = P["brass0"], P["brass1"], P["gold"], P["hot"]

L = {
    "F": ["#######", "#######", "##.....", "##.....", "######.", "######.", "##.....", "##.....", "##....."],
    "O": [".#####.", "#######", "##...##", "##...##", "##...##", "##...##", "##...##", "#######", ".#####."],
    "L": ["##.....", "##.....", "##.....", "##.....", "##.....", "##.....", "##.....", "#######", "#######"],
    "D": ["######.", "#######", "##...##", "##...##", "##...##", "##...##", "##...##", "#######", "######."],
    "W": ["##...##", "##...##", "##...##", "##.#.##", "##.#.##", "##.#.##", "#######", "#######", ".##.##."],
    "R": ["######.", "#######", "##...##", "##...##", "#######", "######.", "##.##..", "##..##.", "##...##"],
    "K": ["##...##", "##..##.", "##.##..", "####...", "####...", "##.##..", "##.##..", "##..##.", "##...##"],
    "S": [".######", "#######", "##.....", "######.", ".######", ".....##", ".....##", "#######", "######."],
    # grade letters: 8 cells wide
    "gS": [".######.", "########", "##....##", "##......", ".######.", "......##", "##....##", "########", ".######."],
    "gA": ["..####..", ".######.", "###..###", "##....##", "##....##", "########", "########", "##....##", "##....##"],
    "gB": ["#######.", "########", "##....##", "##...###", "#######.", "##...###", "##....##", "########", "#######."],
    "gC": [".######.", "########", "##....##", "##......", "##......", "##......", "##....##", "########", ".######."],
    "gD": ["######..", "#######.", "##...###", "##....##", "##....##", "##....##", "##...###", "#######.", "######.."],
}


def glyph_mask(ch, cell=3):
    rows = L[ch]
    w, h = len(rows[0]) * cell, len(rows) * cell
    m = [[rows[y // cell][x // cell] == "#" for x in range(w)] for y in range(h)]
    # round convex corners by one pixel
    cut = []
    for y in range(h):
        for x in range(w):
            if not m[y][x]:
                continue
            def e(xx, yy):
                return not (0 <= xx < w and 0 <= yy < h and m[yy][xx])
            for dx, dy in ((-1, -1), (1, -1), (-1, 1), (1, 1)):
                if e(x + dx, y) and e(x, y + dy) and e(x + dx, y + dy):
                    cut.append((x, y))
    for x, y in cut:
        m[y][x] = False
    return m, w, h


def dilate(mask, W, H, r=1):
    out = set(mask)
    for (x, y) in mask:
        for dx in range(-r, r + 1):
            for dy in range(-r, r + 1):
                if abs(dx) + abs(dy) <= r + (1 if r > 1 else 0) and 0 <= x + dx < W and 0 <= y + dy < H:
                    out.add((x + dx, y + dy))
    return out


# ===================================================================== logo
LOGO_W, LOGO_H = 220, 40
WORD = "FOLDWORKS"


def logo_face():
    """{(x,y): colour} for the letter faces, crease applied, plus the face mask."""
    gap = 3
    widths = [len(L[c][0]) * 3 for c in WORD]
    total = sum(widths) + gap * (len(WORD) - 1)
    x = (LOGO_W - total) // 2 - 1
    y0 = 4
    face = {}
    for ch, w in zip(WORD, widths):
        m, gw, gh = glyph_mask(ch)
        for yy in range(gh):
            for xx in range(gw):
                if m[yy][xx]:
                    face[(x + xx, y0 + yy)] = None
        x += w + gap

    def crease(px):  # the fold line, rising gently to the right
        return y0 + 14 - (px - 20) * 0.025

    out = {}
    for (px, py) in face:
        below = py > crease(px)
        X = px + (1 if below else 0)
        out[(X, py)] = "lo" if below else "hi"
    return out, crease, y0


def logo():
    face, crease, y0 = logo_face()
    W, H = LOGO_W, LOGO_H
    s = new(W, H)
    fm = set(face)
    depth = set()
    for (x, y) in fm:
        for d in range(1, 4):
            depth.add((x, y + d))
    body = fm | depth
    outline = dilate(body, W, H, 2) - body
    shadow = {(x + 2, y + 2) for (x, y) in (body | outline)} - body - outline
    for (x, y) in shadow:
        if 0 <= x < W and 0 <= y < H:
            s.px(x, y, sh)
    for (x, y) in outline:
        s.px(x, y, k)
    for (x, y) in depth - fm:
        cy = crease(x)
        s.px(x, y, b0)
    for (x, y), half in face.items():
        up_ = (x, y - 1) not in fm
        dn = (x, y + 1) not in fm
        lf = (x - 1, y) not in fm
        cy = crease(x)
        if half == "hi":
            col = gold
            if up_:
                col = hot
            elif lf:
                col = hot if (y - y0) < 4 else gold
            if y >= cy - 1.0:  # the crease ridge: the last row above the fold catches the light
                col = hot
        else:
            col = b1
            if y <= cy + 1.0:
                col = b0  # the crease's shadow
            elif up_ or lf:
                col = gold
        s.px(x, y, col)
    # rivets on a few stems, for the workshop
    return s, face


def logo_glint(face):
    W, H = LOGO_W, LOGO_H
    s = new(W, H, 8)
    fm = set(face)
    for f in range(8):
        s.frame(f + 1)
        x0 = -16 + f * 34
        for (x, y) in fm:
            u = x + (y - 4) * 0.6 - x0
            if 0 <= u < 6:
                s.px(x, y, bone if 2 <= u < 4 else hot)
    return s


# ===================================================================== grades
GRADES = [
    ("gS", (hot, gold, b1, b0)),
    ("gA", (gold, P["leaf"], P["moss"], P["moss"])),
    ("gB", (P["hull3"], P["hull2"], P["hull1"], P["hull0"])),
    ("gC", (P["copper2"], P["copper1"], P["copper1"], P["copper0"])),
    ("gD", (P["copper2"], P["violet"], P["slag"], P["shadow"])),
]


def grades():
    S = 32
    s = new(S, S, 5)
    for f, (ch, (hi, base, lo, edge)) in enumerate(GRADES):
        s.frame(f + 1)
        m, gw, gh = glyph_mask(ch)
        ox, oy = (S - gw) // 2 - 1, 1
        fm = {(ox + x, oy + y) for y in range(gh) for x in range(gw) if m[y][x]}
        depth = {(x, y + 1) for (x, y) in fm} | {(x + 1, y + 1) for (x, y) in fm}
        body = fm | depth
        outline = dilate(body, S, S, 1) - body
        for (x, y) in outline:
            s.px(x, y, k)
        for (x, y) in depth - fm:
            s.px(x, y, edge if ch != "gB" else P["iron0"])
        for (x, y) in fm:
            up_ = (x, y - 1) not in fm
            lf = (x - 1, y) not in fm
            dn = (x, y + 1) not in fm
            col = base
            if y > oy + gh * 0.55:
                col = lo
            if up_ or lf:
                col = hi
            if dn:
                col = edge
            # rubber-stamp wear: a few pale specks in the face
            hsh = (x * 92837111 ^ y * 689287499) % 100
            if not (up_ or lf or dn) and hsh < 7:
                col = lo if col != lo else base
            s.px(x, y, col)
        if ch == "gS":  # sparkles
            for (sx, sy, big) in ((3, 5, True), (28, 25, True), (28, 4, False), (4, 27, False)):
                s.px(sx, sy, bone)
                arms = ((1, 0), (-1, 0), (0, 1), (0, -1))
                for dx, dy in arms:
                    s.px(sx + dx, sy + dy, hot)
                if big:
                    for dx, dy in arms:
                        s.px(sx + 2 * dx, sy + 2 * dy, gold)
    return s


def build():
    out = {}
    s, face = logo()
    out["logo"] = (export(s, "logo", 0, scale=4), s)
    g = logo_glint(face)
    out["logo_glint"] = (export(g, "logo_glint", 12, scale=2), g)
    gr = grades()
    out["ui_grade"] = (export(gr, "ui_grade", 0, extra={"order": ["S", "A", "B", "C", "D"]}), gr)
    # check: the logo with a glint frame laid over it, on the panel wood and on ink
    lg = out["logo"][0]
    im = Image.new("RGBA", (LOGO_W + 8, LOGO_H * 2 + 12), (0x3a, 0x25, 0x32, 255))
    im.paste(Image.new("RGBA", (LOGO_W + 8, LOGO_H + 6), (0x1d, 0x14, 0x20, 255)), (0, LOGO_H + 6))
    im.alpha_composite(lg, (4, 3))
    im.alpha_composite(lg, (4, LOGO_H + 9))
    im.alpha_composite(frame_of(out["logo_glint"][0], LOGO_W, 3), (4, LOGO_H + 9))
    im.save(OUT / "logo_check_1x.png")
    up(im, 4).save(OUT / "logo_check_4x.png")
    return out


if __name__ == "__main__":
    build()
