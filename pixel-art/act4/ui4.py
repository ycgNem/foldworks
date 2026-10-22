"""Act IV's UI icons, appended to the UI atlases (append-only, STYLE.md "Atlases"; the way
pixel-art/act3/ui3.py appended district and chute): world (a sky globe of floating green
islands on a brass stand), legacy (a gold medal in a laurel wreath with a red ribbon), relocate
(a floating island flying to another along a dashed arrow). 16x16 in ui_icons, redrawn for 8x8 in
ui_icons_small (not squeezed). Not wired in TypeScript (another agent does that): they are found
by the atlas JSON's `names`.

`python ui4.py` from this folder. Re-running replaces these three by name and moves nothing.
"""
import json
import math

from PIL import Image

from c4 import INK, OUT, P, SRC_ART, check, grid, new, on_bg, outline, put, scale, sheet

NEW = ["world", "legacy", "relocate"]


def world16():
    img = new(16, 16)
    cx, cy, r = 7.5, 6.5, 5.6
    for y in range(16):
        for x in range(16):
            dx, dy = x + 0.5 - cx, y + 0.5 - cy
            if dx * dx + dy * dy <= r * r:
                lam = (-dx * 0.6 - dy * 0.8) / r
                c = P["sky3"] if lam > 0.35 else P["sky2"] if lam > -0.2 else P["sky1"] if lam > -0.6 else P["sky0"]
                put(img, x, y, c)
    # islands (continents): green blobs with a lit top
    for (x0, y0, w) in ((4, 3, 3), (3, 4, 4), (8, 6, 3), (9, 7, 4), (5, 9, 2), (4, 8, 2)):
        for i in range(w):
            put(img, x0 + i, y0, P["grass2"] if (x0 + y0) % 2 else P["grass3"])
    put(img, 5, 3, P["grass3"])
    put(img, 9, 6, P["grass3"])
    put(img, 4, 2, P["cloud3"])           # a glint
    put(img, 5, 2, P["cloud3"])
    # a cloud band across it
    for x in range(3, 9):
        if x % 3:
            put(img, x, 6, P["cloud2"])
    img = outline(img, INK)
    # the brass stand
    for (x, y, c) in ((7, 13, "brass2"), (8, 13, "brass1"), (5, 14, "brass3"), (6, 14, "brass2"), (7, 14, "brass2"),
                      (8, 14, "brass2"), (9, 14, "brass1"), (10, 14, "brass1")):
        put(img, x, y, P[c])
    for x in range(4, 12):
        put(img, x, 15, INK)
    put(img, 4, 14, INK)
    put(img, 11, 14, INK)
    put(img, 6, 13, INK)
    put(img, 9, 13, INK)
    return img


def legacy16():
    img = new(16, 16)
    cx, cy = 7.5, 7.0
    # the wreath: leaves round an open ring, both sides, from the ribbon up
    for a_deg in range(110, 340, 6):
        for side in (-1, 1):
            x = cx + side * 6.0 * math.sin(math.radians(a_deg - 90))
            y = cy + 6.0 * math.cos(math.radians(a_deg - 90))
            put(img, round(x), round(y), P["moss3"])
    # leaves sticking out of the ring
    for k in range(5):
        a = math.radians(-140 + k * 30)
        for side in (-1, 1):
            x = cx + side * 6.6 * math.cos(a)
            y = cy + 6.6 * math.sin(a) * -1 + 1
            put(img, round(x), round(y), P["moss5"])
    # the medal
    for y in range(16):
        for x in range(16):
            dx, dy = x + 0.5 - cx - 0.5, y + 0.5 - cy
            if dx * dx + dy * dy <= 3.6 * 3.6:
                lam = (-dx * 0.6 - dy * 0.8) / 3.6
                put(img, x, y, P["lamp3"] if lam > 0.5 else P["lamp2"] if lam > -0.1 else P["brass2"] if lam > -0.6 else P["brass1"])
    # its rim struck a step darker, a glint on its face
    for y in range(16):
        for x in range(16):
            dx, dy = x + 0.5 - cx - 0.5, y + 0.5 - cy
            if 2.6 * 2.6 < dx * dx + dy * dy <= 3.6 * 3.6 and dx + dy > 0:
                put(img, x, y, P["brass1"])
    put(img, 6, 5, P["cloud3"])
    put(img, 7, 5, P["lamp3"])
    put(img, 6, 6, P["lamp3"])
    # the ribbon under it
    for (x, y) in ((6, 12), (7, 12), (9, 12), (10, 12), (5, 13), (6, 13), (10, 13), (11, 13), (5, 14), (11, 14)):
        put(img, x, y, P["red"])
    put(img, 8, 12, P["copper0"])
    return outline(img, INK)


def relocate16():
    img = new(16, 16)

    def isle(x0, y0, w, depth):
        for i in range(w):
            put(img, x0 + i, y0, P["grass3"] if i < w // 2 else P["grass2"])
            put(img, x0 + i, y0 + 1, P["grass1"])
        for d in range(depth):
            for i in range(d + 1, w - d - 1):
                put(img, x0 + i, y0 + 2 + d, P["earth2"] if i < w // 2 else P["earth1"])
    isle(0, 10, 6, 3)
    isle(9, 8, 7, 3)
    put(img, 2, 9, P["copper2"])         # a house on the old island
    put(img, 3, 9, P["copper1"])
    put(img, 2, 8, P["red"])
    img = outline(img, INK)
    # the dashed arrow arcing from the old island to the new
    pts = []
    for k in range(13):
        t = k / 12
        x = 3 + t * 8
        y = 8 - 2 * t - math.sin(t * math.pi) * 5
        pts.append((round(x), round(y)))
    for i, (x, y) in enumerate(pts[:-2]):
        if i % 4 != 3:
            put(img, x, y, P["ink1"])
    ax, ay = pts[-2]
    for (dx, dy) in ((0, 0), (-1, -1), (-2, 0), (0, -2), (-1, 0), (0, -1)):
        put(img, ax + dx, ay + dy, P["lamp2"])
    put(img, ax, ay - 2, INK)
    put(img, ax - 2, ay, INK)
    return img


SMALL = {
    "world": [
        "..oooo..",
        ".oSGGso.",
        "oSGGsGso",
        "osssGGDo",
        "oGGssDDo",
        ".osDDDo.",
        "..oooo..",
        ".obbbbo.",
    ],
    "legacy": [
        "m......m",
        "mo.oo.om",
        "mooYYoom",
        "moYyYBom",
        ".oYBBbo.",
        "..oooo..",
        "..r..r..",
        ".r....r.",
    ],
    "relocate": [
        "..ooo...",
        ".o...o..",
        "o...ooo.",
        "o....o..",
        "....oGGo",
        "oGGo.oEo",
        "oEEo....",
        ".oo.....",
    ],
}
SKEY = {"o": P["ink"], "S": P["sky3"], "s": P["sky2"], "D": P["sky1"], "G": P["grass2"], "b": P["brass2"],
        "m": P["moss3"], "Y": P["lamp2"], "y": P["lamp3"], "B": P["brass2"], "r": P["red"], "w": P["bone"],
        "E": P["earth2"]}

BIG = {"world": world16, "legacy": legacy16, "relocate": relocate16}


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
    return frames[-len(NEW):] if all(k in names[-len(NEW):] for k in NEW) else [frames[names.index(k)] for k in NEW]


if __name__ == "__main__":
    big = append("ui_icons", 16, lambda k: BIG[k]())
    small = append("ui_icons_small", 8, lambda k: grid(SMALL[k], SKEY, 8, 8))
    look = Image.new("RGBA", (3 * 20 + 4, 32), tuple(int(P["bone"][i:i + 2], 16) for i in (1, 3, 5)) + (255,))
    for i, (b, s) in enumerate(zip(big, small)):
        look.alpha_composite(b, (4 + i * 20, 2))
        look.alpha_composite(s, (8 + i * 20, 21))
    scale(look, 6).save(OUT / "ui4@6x.png")
