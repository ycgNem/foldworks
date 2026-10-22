"""Act V's UI icons, appended to the UI atlases (append-only, STYLE.md "Atlases"; the way act4's
ui4.py appended world, legacy and relocate): kernel (a violet seed folded down its middle, a gold
heart glowing in it), beyond (a roundel of night: a crescent moon, stars, a tiny silver platform
on its star pod), lastFold (a square folded in from its four corners into a diamond, the creases
crossing on a burst of light), ledger (the Endless Ledger: a fat leather ledger, gilt page edges,
an infinity sign in gold on its cover). 16x16 in ui_icons, redrawn for 8x8 in ui_icons_small (not
squeezed). Not wired in TypeScript: found by the atlas JSON's `names`.

`python ui5.py` from this folder. Re-running replaces these four by name and moves nothing.
"""
import json
import math

from PIL import Image

from c5 import INK, OUT, P, SRC_ART, check, grid, hline, new, outline, put, rect, rgb, scale, sheet, vline

NEW = ["kernel", "beyond", "lastFold", "ledger"]


def kernel16():
    img = new(16, 16)
    # a teardrop seed, point up: round bottom (centre 7.5, 9.5, r 5), tapering to (7.5, 1.5)
    for y in range(16):
        for x in range(16):
            px, py = x + 0.5, y + 0.5
            if py >= 9.5:
                inside = (px - 8) ** 2 + (py - 9.5) ** 2 <= 5.2 ** 2
            else:
                hw = 5.2 * (py - 1.2) / 8.3
                inside = abs(px - 8) <= hw
            if inside:
                lam = (-(px - 8) * 0.6 - (py - 9) * 0.5) / 5
                c = "bone" if lam > 0.55 else "violet" if lam > 0.1 else "slag1" if lam > -0.45 else "slag0"
                put(img, x, y, P[c])
    # the crease down the middle (it is folded), and a glowing heart low in it
    for y in range(3, 14):
        put(img, 8, y, P["slag0"] if y < 8 or y > 11 else P["lamp1"])
    for (x, y, c) in ((7, 9, "lamp2"), (8, 9, "lamp3"), (7, 10, "lamp3"), (8, 10, "lamp2"), (9, 10, "lamp1"),
                      (8, 11, "lamp2"), (7, 11, "lamp1")):
        put(img, x, y, P[c])
    put(img, 5, 7, P["cloud3"])
    return outline(img, INK)


def beyond16():
    img = new(16, 16)
    cx, cy, r = 7.5, 7.0, 6.6
    for y in range(16):
        for x in range(16):
            d = math.hypot(x + 0.5 - cx - 0.5, y + 0.5 - cy - 0.5)
            if d <= r:
                put(img, x, y, P["ink2"] if y < 8 else P["iron0"])
    # stars
    for (x, y, c) in ((10, 3, "cloud3"), (12, 6, "sky3"), (4, 9, "cloud2"), (11, 9, "cloud2"), (7, 2, "sky3"),
                      (9, 6, "lamp3")):
        put(img, x, y, P[c])
    # the crescent moon, top-left
    for y in range(16):
        for x in range(16):
            a = (x + 0.5 - 5.5) ** 2 + (y + 0.5 - 5.5) ** 2 <= 3.3 ** 2
            b = (x + 0.5 - 7.3) ** 2 + (y + 0.5 - 4.4) ** 2 <= 3.0 ** 2
            if a and not b:
                put(img, x, y, P["bone"])
    # the tiny platform: a silver deck, a dark face, the star pod's glow under it
    hline(img, 3, 12, 11, P["steel4"])
    hline(img, 3, 12, 12, P["steel2"])
    put(img, 7, 13, P["lamp2"])
    put(img, 8, 13, P["lamp3"])
    put(img, 8, 14, P["lamp1"])
    for x in (5, 10):
        put(img, x, 10, P["brass2"])     # two modules on it
    img = outline(img, INK)
    return img


def lastfold16():
    img = new(16, 16)
    # a diamond (the square with its four corners folded to the centre): four triangular flaps,
    # each lit by its side, creases on the diagonals, a burst of light where they meet
    c = 7.5
    for y in range(16):
        for x in range(16):
            dx, dy = x + 0.5 - c - 0.5, y + 0.5 - c - 0.5
            if abs(dx) + abs(dy) <= 7.0:
                if abs(dx) >= abs(dy):
                    col = "bone" if dx < 0 else "pave2"
                else:
                    col = "pave3" if dy < 0 else "pave1"
                put(img, x, y, P[col])
                if abs(abs(dx) - abs(dy)) < 0.6:
                    put(img, x, y, P["pave0"])
    img = outline(img, INK)
    for (x, y, col) in ((8, 8, "cloud3"), (7, 8, "lamp3"), (9, 8, "lamp3"), (8, 7, "lamp3"), (8, 9, "lamp3"),
                        (6, 8, "lamp2"), (10, 8, "lamp2"), (8, 6, "lamp2"), (8, 10, "lamp2"), (7, 7, "lamp2"),
                        (9, 9, "lamp2"), (7, 9, "lamp2"), (9, 7, "lamp2")):
        put(img, x, y, P[col])
    return img


def ledger16():
    img = new(16, 16)
    # a fat book seen from the front-left: leather cover (copper0 lit copper1), page edges on the
    # right and bottom (bone with gilt), a spine band, the infinity in gold on the cover
    rect(img, 2, 1, 12, 13, P["copper0"])
    vline(img, 2, 1, 13, P["copper1"])
    hline(img, 2, 12, 1, P["copper1"])
    vline(img, 3, 2, 12, P["wood0"])                 # the spine's hinge
    for y in range(2, 15):
        put(img, 13, y, P["bone"] if y % 2 else P["pave3"])
    for x in range(3, 14):
        put(img, x, 14, P["bone"] if x % 2 else P["pave3"])
    put(img, 13, 14, P["brass2"])
    # the infinity
    inf = [(5, 7), (6, 6), (7, 6), (8, 7), (9, 8), (10, 8), (11, 7), (10, 6), (9, 6), (8, 7), (7, 8), (6, 8)]
    for (x, y) in inf:
        put(img, x, y, P["lamp2"])
    put(img, 6, 6, P["lamp3"])
    put(img, 10, 6, P["lamp3"])
    # gilt corner caps
    for (x, y) in ((4, 2), (12, 2), (4, 12), (12, 12)):
        put(img, x, y, P["brass2"])
    put(img, 6, 11, P["brass1"])
    hline(img, 6, 10, 11, P["brass1"])
    return outline(img, INK)


SMALL = {
    "kernel": [
        "...oo...",
        "..oVso..",
        ".oVVsso.",
        ".oVsYso.",
        "oVsYyYso",
        "oVsYYsso",
        ".osssso.",
        "..oooo..",
    ],
    "beyond": [
        ".oooooo.",
        "oBnnnwno",
        "oBBnnnno",
        "onBnwnno",
        "onnnnnio",
        "oSSSSSSo",
        ".ooYYoo.",
        "...oo...",
    ],
    "lastFold": [
        "...oo...",
        "..obPo..",
        ".obbPPo.",
        "obbyYPPo",
        "oppYyqqo",
        ".oppqqo.",
        "..opqo..",
        "...oo...",
    ],
    "ledger": [
        ".ooooooo",
        "oCrrrrrW",
        "oCYYrYYW",
        "oCYrYrYW",
        "oCYYrYYW",
        "oCrrrrrW",
        "oCrrrrrW",
        ".oWWWWWo",
    ],
}
SKEY = {"o": P["ink"], "V": P["bone"], "s": P["slag1"], "Y": P["lamp2"], "y": P["lamp3"], "B": P["bone"],
        "n": P["ink2"], "w": P["cloud3"], "i": P["iron0"], "S": P["steel3"], "b": P["bone"], "P": P["pave3"],
        "p": P["pave2"], "q": P["pave1"], "C": P["copper1"], "r": P["copper0"], "W": P["bone"]}
SKEY_V = dict(SKEY)
BIG = {"kernel": kernel16, "beyond": beyond16, "lastFold": lastfold16, "ledger": ledger16}


def small(k):
    key = dict(SKEY)
    if k == "kernel":
        key["V"] = P["violet"]
    return grid(SMALL[k], key, 8, 8)


def append(name, size, make):
    meta = json.loads((SRC_ART / f"{name}.json").read_text())
    names = list(meta["names"])
    img = Image.open(SRC_ART / f"{name}.png").convert("RGBA")
    frames = [img.crop((i * size, 0, i * size + size, size)) for i in range(meta["frames"])]
    for k in NEW:
        icon = make(k)
        assert icon.size == (size, size), (k, icon.size)
        if k in names:
            frames[names.index(k)] = icon
        else:
            names.append(k)
            frames.append(icon)
    out = sheet(frames)
    check(name, out)
    meta.update({"frames": len(frames), "names": names})
    out.save(SRC_ART / f"{name}.png")
    (SRC_ART / f"{name}.json").write_text(json.dumps(meta) + "\n", newline="\n")
    print(f"  {name}: {[(k, names.index(k)) for k in NEW]} of {len(names)}")
    return [frames[names.index(k)] for k in NEW]


def build():
    big = append("ui_icons", 16, lambda k: BIG[k]())
    sm = append("ui_icons_small", 8, small)
    look = Image.new("RGBA", (len(NEW) * 20 + 4, 32), rgb(P["bone"]) + (255,))
    for i, (b, s) in enumerate(zip(big, sm)):
        look.alpha_composite(b, (4 + i * 20, 2))
        look.alpha_composite(s, (8 + i * 20, 21))
    scale(look, 6).save(OUT / "ui5@6x.png")
    dark = Image.new("RGBA", look.size, rgb(P["wood2"]) + (255,))
    dark.alpha_composite(look.crop((0, 0, 0, 0)) if False else Image.new("RGBA", look.size))
    for i, (b, s) in enumerate(zip(big, sm)):
        dark.alpha_composite(b, (4 + i * 20, 2))
        dark.alpha_composite(s, (8 + i * 20, 21))
    scale(dark, 6).save(OUT / "ui5_wood@6x.png")


if __name__ == "__main__":
    build()
