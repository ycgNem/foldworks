"""The contact sheet: out/sheet.png (the assembled HUD pieces at 1x over the game's floors, then the
same at 4x) and out/parts.png (every exported frame at 6x, labelled).

The 9-slices are assembled with kit.nine (the same tiling as src/app/chrome.ts nine()), on the
Workshop deck (wood3 boards, wood2 seams) and the bayou (water1). Text on the paper is faked with
the 3x5 tiny font in ink, only so the sheet shows whether text sits on the centres cleanly."""
import json

from PIL import Image, ImageDraw

from kit import OUT, Px, nine, scale, col, rgb
import tiny


def load(name):
    m = json.loads((OUT / f"{name}.json").read_text())
    im = Image.open(OUT / f"{name}.png").convert("RGBA")
    w, h = m["frame"]
    return [im.crop((i * w, 0, i * w + w, h)) for i in range(m["frames"])], m


def deck(w, h):
    c = Px(w, h)
    c.rect(0, 0, w - 1, h - 1, "wood3")
    for y in range(0, h, 8):
        c.hl(0, w - 1, y, "wood2")
        off = (y // 8) * 13
        for x in range(off % 40, w, 40):
            c.vl(x, y, min(y + 7, h - 1), "wood2")
        c.hl(0, w - 1, y + 1, "wood4")
    return c.im


def water(w, h):
    c = Px(w, h)
    c.rect(0, 0, w - 1, h - 1, "water1")
    for y in range(3, h, 9):
        for x in range((y * 7) % 23, w, 23):
            c.hl(x, x + 3, y, "water2")
    return c.im


def put(dst, im, x, y):
    dst.alpha_composite(im, (x, y))


def say(dst, s, x, y, colour="ink"):
    c = Px(tiny.width(s) + 1, 6)
    tiny.text(c, s, 0, 0, colour)
    put(dst, c.im, x, y)


def fake_digits(dst, s, x, y, gold="lamp2"):
    """Big gold digits with an ink outline: the tiny font doubled, then outlined (the Purse)."""
    c = Px(tiny.width(s) * 2 + 4, 14)
    tiny.text(c, s, 0, 0, gold)
    big = Px(c.w * 2, c.h * 2)
    for yy in range(c.h):
        for xx in range(c.w):
            if c.on(xx, yy):
                big.rect(xx * 2 + 1, yy * 2 + 1, xx * 2 + 2, yy * 2 + 2, gold)
    big.outline("ink", diag=True)
    put(dst, big.im, x, y)


def string(dst, x0, y0, x1, y1, colour="wood1"):
    """The tag's string: a sagging 1 px line from the hole to its anchor."""
    c = Px(dst.width, dst.height)
    n = max(abs(x1 - x0), abs(y1 - y0), 1)
    for i in range(n + 1):
        t = i / n
        x = x0 + (x1 - x0) * t
        y = y0 + (y1 - y0) * t + 4 * t * (1 - t)
        c.p(round(x), round(y), colour)
    dst.alpha_composite(c.im)


def scene(bg):
    W, H = 480, 380
    im = deck(W, H) if bg == "deck" else water(W, H)
    F = {}
    for n in ("h180_tag", "h180_hole", "h180_bubble", "h180_bubble_tail", "h180_ribbon", "h180_bookmark",
              "h180_sign", "h180_rope", "h180_book", "h180_keycap", "h180_mouse", "h180_button",
              "h180_button_gold", "h180_chip", "h180_slip", "h180_clipboard", "h180_pushpin", "h180_bell",
              "h180_lift", "h180_liftbtn", "h180_notebook", "h180_newspaper", "h180_toolbox", "h180_hub",
              "h180_petal", "h180_disc", "h180_lilypad", "h180_tick", "h180_circle", "portrait_inspector",
              "portrait_inspector_small", "portrait_inspector_cheer", "portrait_bramble"):
        try:
            F[n] = load(n)
        except FileNotFoundError:
            pass

    def nn(name, f, x, y, w, h):
        fr, m = F[name]
        put(im, nine(fr[f], w, h, m["slice"]), x, y)

    # --- the Purse: a sign on two ropes, its rate tag hanging under it
    if "h180_sign" in F and "h180_rope" in F:
        rope = F["h180_rope"][0][0]
        for rx in (14, 98):
            for yy in range(0, 10, rope.height):
                put(im, rope.crop((0, 0, rope.width, min(rope.height, 10 - yy))), rx, yy)
        nn("h180_sign", 0, 4, 8, 112, 34)
        fake_digits(im, "1.58M", 30, 13)
    if "h180_tag" in F:
        nn("h180_tag", 0, 20, 50, 64, 18)
        put(im, F["h180_hole"][0][0], 24, 56)
        string(im, 26, 58, 30, 41)
        say(im, "+7.0K/MIN", 32, 56, "brass0")

    # --- a 120x48 tag (a report) and its hovered twin
    if "h180_tag" in F:
        for i, (x, y) in enumerate(((140, 10), (280, 10))):
            nn("h180_tag", i, x, y, 120, 48)
            put(im, F["h180_hole"][0][0], x + 5 - i, y + 5 - i)
            string(im, x + 7 - i, y + 7 - i, x - 10, y - 8)
            say(im, "HAND FURNACE", x + 14 - i, y + 6 - i)
            if "h180_chip" in F:
                nn("h180_chip", 0, x + 8 - i, y + 15 - i, 40, 9)
                say(im, "CHOKED", x + 12 - i, y + 17 - i, "copper0")
            say(im, "ORE > INGOT 27/MIN", x + 8 - i, y + 28 - i)
            if "h180_keycap" in F:
                nn("h180_keycap", 0, x + 8 - i, y + 36 - i, 9, 10)
                say(im, "X", x + 11 - i, y + 38 - i)
                say(im, "SELL", x + 20 - i, y + 39 - i)
                if "h180_mouse" in F:
                    put(im, F["h180_mouse"][0][0], x + 44 - i, y + 36 - i)
                    say(im, "SHOVEL", x + 54 - i, y + 39 - i)
        if "h180_pushpin" in F:
            put(im, F["h180_pushpin"][0][0], 280 + 104, 10 + 2)
    # --- the bubble (160x40) with a tail toward Bramble, and smaller ones with each tail
    if "h180_bubble" in F:
        bx, by = 64, 262
        if "h180_lilypad" in F:
            put(im, F["h180_lilypad"][0][0], 0, 356)
        if "portrait_inspector" in F:
            put(im, F["portrait_inspector"][0][0], 4, 314)
        elif "portrait_bramble" in F:
            put(im, F["portrait_bramble"][0][0], 4, 314)
        nn("h180_bubble", 0, bx, by, 160, 40)
        tails = F["h180_bubble_tail"][0]
        put(im, tails[0], bx + 6, by + 40 - 2)
        say(im, "SEVENTY SECONDS. DO CARRY ON.", bx + 8, by + 8)
        say(im, "AN S. I SHALL TELL NO ONE.", bx + 8, by + 18)
        if "h180_keycap" in F:
            nn("h180_keycap", 1, bx + 8, by + 26, 9, 10)
            say(im, "F", bx + 11, by + 29)
        # each tail on a small bubble
        for i, (dx, dy) in enumerate(((0, 0), (40, 0), (88, 0), (128, 0))):
            x, y = 236 + dx, 342 + dy
            nn("h180_bubble", 0, x + (8 if i == 2 else 0), y, 30, 16)
            t = tails[i]
            if i == 0:
                put(im, t, x + 4, y + 14)
            elif i == 1:
                put(im, t, x + 18, y + 14)
            elif i == 2:
                put(im, t, x + 8 - 6, y + 4)
            else:
                put(im, t, x + 30 - 2, y + 4)
            say(im, "HI!", x + 9 + (8 if i == 2 else 0), y + 5)
    # --- ribbons, assembled
    if "h180_ribbon" in F:
        rib = F["h180_ribbon"][0]
        for k in range(5):
            x, y, w = 140 + (k % 3) * 112, 70 + (k // 3) * 20, 96
            put(im, rib[k * 3], x, y)
            for xx in range(x + 8, x + w - 8, 8):
                put(im, rib[k * 3 + 1].crop((0, 0, min(8, x + w - 8 - xx), 14)), xx, y)
            put(im, rib[k * 3 + 2], x + w - 8, y)
            say(im, ["ORDERS", "JAMMED", "RESEARCH", "PATENTS", "TROPHY!"][k], x + 14, y + 4, "bone")
    # --- buttons, chips, keys
    if "h180_button" in F:
        for i in range(4):
            nn("h180_button", i, 140 + i * 42, 112, 38, 14)
            say(im, ["BUY", "HOVER", "DOWN", "LOCK"][i], 145 + i * 42, 116 + (1 if i == 2 else 0))
            nn("h180_button_gold", i, 140 + i * 42, 130, 38, 14)
            say(im, ["SIGN", "HOVER", "DOWN", "LOCK"][i], 145 + i * 42, 134 + (1 if i == 2 else 0))
    if "h180_chip" in F:
        for i, (s, cl) in enumerate((("WORKING", "moss1"), ("STARVED", "copper1"), ("NO POWER", "iron0"),
                                     ("+25", "brass0"))):
            w = tiny.width(s) + 8
            x = 312 + sum(tiny.width(t) + 12 for t, _ in ((("WORKING", 0), ("STARVED", 0), ("NO POWER", 0))[:i]))
            if i < 3:
                nn("h180_chip", 0, x, 114, w, 9)
                say(im, s, x + 4, 116, cl)
    if "h180_keycap" in F:
        for i, s in enumerate("TQRXF"):
            nn("h180_keycap", 0, 312 + i * 12, 130, 9, 10)
            say(im, s, 315 + i * 12, 132)
        nn("h180_keycap", 0, 376, 130, 25, 10)
        say(im, "SPACE", 378, 132)
        for i in range(3):
            put(im, F["h180_mouse"][0][i], 408 + i * 10, 130)
    # --- the slip (toasts), the clipboard (audit tag), tick and circle
    if "h180_slip" in F:
        nn("h180_slip", 0, 340, 46, 120, 20)
        say(im, "NEW ORDER: GIZMOS", 350, 54)
    if "h180_clipboard" in F:
        nn("h180_clipboard", 0, 140, 152, 60, 44)
        say(im, "AUDIT", 152, 162)
        say(im, "1:10", 152, 172)
        if "h180_tick" in F:
            put(im, F["h180_tick"][0][0], 180, 168)
    if "h180_circle" in F:
        put(im, F["h180_circle"][0][0], 206, 160)
    # --- the bell, the lift, the notebook, the newspaper, the toolbox
    x = 238
    for n in ("h180_bell", "h180_lift", "h180_notebook", "h180_newspaper", "h180_toolbox"):
        if n in F:
            fr = F[n][0]
            for i, f in enumerate(fr):
                put(im, f, x, 152 + i * (f.height + 2))
            x += fr[0].width + 6
    if "h180_lift" in F and "h180_liftbtn" in F:
        lf, m = F["h180_lift"]
        holes = m.get("holes", [[3, 8], [31, 8]])
        lx = 238 + 16 + 6
        bt = F["h180_liftbtn"][0]
        put(im, bt[1], lx + holes[0][0], 152 + holes[0][1])
        put(im, bt[2], lx + holes[1][0], 152 + holes[1][1])
        # the needle (code-drawn in the game): from the pivot toward W
        px, py = m.get("pivot", [22, 13])
        c = Px(lf[0].width, lf[0].height)
        c.line(px, py, px - 6, py - 3, "ink")
        put(im, c.im, lx, 152)
    # --- the wheel: hub, petals in a ring, discs fanned out
    if "h180_hub" in F:
        cx, cy = 420, 300
        hub = F["h180_hub"][0][0]
        put(im, hub, cx - 14, cy - 14)
        if "h180_petal" in F:
            import math
            pet = F["h180_petal"][0]
            for i in range(5):
                a = -math.pi / 2 + i * 2 * math.pi / 5
                put(im, pet[[0, 2, 0, 1, 3][i]], round(cx + 30 * math.cos(a)) - 9, round(cy + 30 * math.sin(a)) - 9)
        if "h180_disc" in F:
            dsc = F["h180_disc"][0]
            for i in range(4):
                a = -2.5 + i * 0.36
                put(im, dsc[i], round(cx + 58 * math.cos(a)) - 9, round(cy + 58 * math.sin(a)) - 9)
    # --- the book: a 300x200 spread with bookmarks along the top
    return im, F


def book_scene(bg):
    W, H = 340, 230
    im = deck(W, H) if bg == "deck" else water(W, H)
    try:
        fr, m = load("h180_book")
    except FileNotFoundError:
        return im
    x0, y0 = 20, 18
    put(im, nine(fr[0], 150, 200, m["slice"]), x0, y0)
    put(im, nine(fr[1], 150, 200, m["slice"]), x0 + 150, y0)
    try:
        bm, _ = load("h180_bookmark")
        for i in range(5):
            put(im, bm[i], x0 + 160 + i * 14, y0 - 2)
    except FileNotFoundError:
        pass
    say(im, "RESEARCH", x0 + 16, y0 + 12)
    for r in range(6):
        c = Px(110, 1)
        c.hl(0, 109, 0, "wood5")
        put(im, c.im, x0 + 14, y0 + 34 + r * 14)
        say(im, ["BELLOWS 25", "COAL SEAMS", "STEEL", "GLASS", "KILN", "MK2 PRESS"][r], x0 + 16, y0 + 27 + r * 14)
    say(im, "THE BELLOWS", x0 + 168, y0 + 12)
    say(im, "MORE AIR, MORE IRON.", x0 + 168, y0 + 24, "wood1")
    try:
        t, _ = load("h180_tick")
        c, _ = load("h180_circle")
        put(im, t[0], x0 + 100, y0 + 24)
        put(im, c[0], x0 + 96, y0 + 47)
    except FileNotFoundError:
        pass
    return im


def parts():
    names = sorted(p.stem for p in OUT.glob("*.json") if p.stem.startswith(("h180_", "portrait_inspector")))
    k = 6
    rows = []
    for n in names:
        fr, m = load(n)
        rows.append((n, fr, m))
    W = 1500
    x, y, rowh = 8, 8, 0
    placed = []
    for n, fr, m in rows:
        w = sum(f.width * k + 6 for f in fr)
        h = fr[0].height * k + 16
        if x + w > W:
            x, y, rowh = 8, y + rowh + 8, 0
        placed.append((n, fr, m, x, y))
        x += w + 18
        rowh = max(rowh, h)
    H = y + rowh + 8
    out = Image.new("RGBA", (W, H), rgb("#9e6a42") + (255,))
    d = ImageDraw.Draw(out)
    for n, fr, m, x, y in placed:
        d.text((x, y), f"{n} {m['frame'][0]}x{m['frame'][1]} x{m['frames']}" + (f" s{m['slice']}" if 'slice' in m else ""),
               fill=(19, 14, 28))
        xx = x
        for f in fr:
            put(out, scale(f, k), xx, y + 12)
            xx += f.width * k + 6
    out.save(OUT / "parts.png")


def build():
    a, _ = scene("deck")
    b, _ = scene("water")
    ba = book_scene("deck")
    bb = book_scene("water")
    one = Image.new("RGBA", (a.width * 2 + 8 + ba.width * 0, a.height + ba.height + 8), rgb("#130e1c") + (255,))
    put(one, a, 0, 0)
    put(one, b, a.width + 8, 0)
    put(one, ba, 0, a.height + 8)
    put(one, bb, a.width + 8, a.height + 8)
    one.save(OUT / "sheet1x.png")
    # the sheet: 1x on top, then 4x crops of each quarter so each piece is seen up close
    big = scale(a, 4)
    sheet = Image.new("RGBA", (max(one.width, big.width), one.height + 8 + big.height), rgb("#130e1c") + (255,))
    put(sheet, one, 0, 0)
    put(sheet, big, 0, one.height + 8)
    sheet.save(OUT / "sheet.png")
    for i, (x0, y0) in enumerate(((0, 0), (240, 0), (0, 190), (240, 190))):
        scale(a.crop((x0, y0, x0 + 240, y0 + 190)), 4).save(OUT / f"zoom_deck_{i}.png")
        scale(b.crop((x0, y0, x0 + 240, y0 + 190)), 4).save(OUT / f"zoom_water_{i}.png")
    scale(ba.crop((0, 0, 200, 130)), 4).save(OUT / "zoom_book.png")
    parts()


if __name__ == "__main__":
    build()
