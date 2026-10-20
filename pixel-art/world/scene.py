"""Mock Workshop and Factory scenes built only from the exported sprites (plus the 4x4 status
pips and the not-owned shading the game draws in code), and the contact sheet."""
from PIL import ImageDraw, ImageFont
from fw import OUT, HERE, EXPORTED, frames_of, up, Image, P, hex2rgba

T = 16


def fr(name, i=0):
    spr = EXPORTED[name][0]
    return frames_of(spr)[i % spr.n_frames]


def rot(im, r, flip=False):
    # r quarter turns clockwise, like drawRot (which mirrors vertically first for the other turn)
    if flip:
        im = im.transpose(Image.FLIP_TOP_BOTTOM)
    return {0: im, 1: im.transpose(Image.ROTATE_270), 2: im.transpose(Image.ROTATE_180), 3: im.transpose(Image.ROTATE_90)}[r % 4]


def icon(set_, i):
    return fr(set_, i)


def pip(img, x, y, colour, blink=False):
    col = hex2rgba(P[colour])
    ink = hex2rgba(P["ink"])
    for yy in range(4):
        for xx in range(4):
            if xx in (0, 3) and yy in (0, 3):
                continue
            img.putpixel((x + xx, y + yy), col if (1 <= xx <= 2 and 1 <= yy <= 2) else ink)


def unowned(img, x0, y0, w, h):
    """The game's code shading for land you don't own (ground.ts): darken, cool, hatch."""
    ov = Image.new("RGBA", (w, h), hex2rgba(P["shadow"])[:3] + (158,))
    img.alpha_composite(ov, (x0, y0))
    hatch = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    hc = hex2rgba(P["hull0"])[:3] + (140,)
    for y in range(h):
        for x in range(w):
            if (x + y) % 6 == 0:
                hatch.putpixel((x, y), hc)
    img.alpha_composite(hatch, (x0, y0))


ITEM1 = ["ironOre", "copperOre", "ironIngot", "copperIngot", "slag", "ironPlate", "copperWire", "gear", "slagBrick", "gizmo"]


def workshop(t=0):
    W, H = 18, 11
    img = Image.new("RGBA", (W * T, H * T), hex2rgba(P["ink"]))
    for ty in range(H):
        for tx in range(W):
            img.alpha_composite(fr("tile_floor", (tx * 7 + ty * 3) % 4), (tx * T, ty * T))
    for (ox, oy, name) in ((1, 1, "iron"), (1, 5, "copper"), (14, 7, "coal"), (11, 8, "sand")):
        for q in range(4):
            img.alpha_composite(fr("tile_ore_" + name, q), ((ox + q % 2) * T, (oy + q // 2) * T))
    unowned(img, 16 * T, 0, 2 * T, H * T)

    def put(name, tx, ty, r=0, f=0, flip=False):
        img.alpha_composite(rot(fr(name, f), r, flip), (tx * T, ty * T))

    belts = [  # (tx, ty, rot, turn, item, offset, moving)
        (3, 1, 0, None, "ironOre", 2, True), (4, 1, 0, None, None, 0, True),
        (6, 1, 0, None, "ironIngot", -3, True), (7, 1, 0, None, None, 0, True),
        (9, 1, 0, None, "ironPlate", 0, True), (10, 1, 0, None, None, 0, True),
        (3, 5, 0, None, "copperOre", -1, True), (4, 5, 0, None, None, 0, True),
        (6, 5, 0, None, "copperIngot", 3, True), (7, 5, 1, "turn", None, 0, True),
        (7, 6, 1, None, "copperWire", 0, True), (7, 7, 1, None, "copperWire", -4, True),
        (8, 8, 0, None, "gizmo", 0, True), (9, 8, 0, None, None, 0, True),
        (3, 2, 0, None, None, 0, False), (3, 3, 0, None, "slag", 0, False),
        (5, 3, 1, None, "slag", 0, False),
        (10, 3, 0, None, "gear", 3, True), (11, 3, 0, None, "gear", -2, True),
    ]
    for tx, ty, r, turn, it, off, mv in belts:
        name = "belt_turn" if turn else "belt"
        put(name, tx, ty, r, t if mv else 0, flip=bool(turn))
    for tx, ty, r, turn, it, off, mv in belts:
        if it:
            o = off + (t * 2 if mv else 0)
            o = ((o + 8) % 16) - 8
            dx, dy = {0: (1, 0), 1: (0, 1), 2: (-1, 0), 3: (0, -1)}[r]
            img.alpha_composite(icon("items", ITEM1.index(it)), (tx * T + 4 + dx * o, ty * T + 4 + dy * o))
    machines = [  # name, tx, ty, rot, pip, working
        ("miner", 2, 1, 0, "pipGreen", True), ("smelter", 5, 1, 0, "pipGreen", True),
        ("press", 8, 1, 0, "pipGreen", True),
        ("miner", 2, 2, 0, "pipRed", False), ("smelter", 5, 2, 1, "pipRed", False),
        ("miner", 2, 5, 0, "pipGreen", True), ("furnace", 5, 5, 0, "pipYellow", False),
        ("press", 7, 4, 1, "pipGreen", True),
        ("assembler", 7, 8, 0, "pipGreen", True), ("miner", 2, 6, 0, "pipGrey", False),
        ("assembler", 9, 3, 0, "pipYellow", False),
    ]
    for name, tx, ty, r, p_, w in machines:
        put(name, tx, ty, r, t if w else 0)
    put("heap", 5, 4, 0, 3)
    put("crate", 4, 3, 0)
    put("splitter", 12, 3, 0)
    put("merger", 12, 4, 0)
    for tx, ty, it in ((9, 6, "gear"), (10, 6, "gizmo")):
        put("module", tx, ty)
        img.alpha_composite(icon("items", ITEM1.index(it)), (tx * T + 4, ty * T + 4))
    put("dock", 11, 1, 0, t // 4)
    put("hopper", 10, 8, 0, t // 4)
    put("spark_vein", 1, 6, 0, t // 2)
    put("spark_inspector", 13, 5, 0, t // 4)
    for name, tx, ty, r, p_, w in machines:
        pip(img, tx * T + 12, ty * T, p_)
    return img


def factory(t=0):
    W, H = 10, 6
    img = Image.new("RGBA", (W * T, H * T), hex2rgba(P["ink"]))
    for ty in range(H):
        for tx in range(W):
            img.alpha_composite(fr("tile_factory", (tx * 5 + ty * 3) % 11 == 0), (tx * T, ty * T))

    def put(name, tx, ty, r=0, f=0, flip=False):
        img.alpha_composite(rot(fr(name, f), r, flip), (tx * T, ty * T))
    for tx in range(2, 6):
        put("trunk", tx, 1, 0, t)
    put("trunk_turn", 6, 1, 1, t, flip=True)
    for ty in range(2, 4):
        put("trunk", 6, ty, 1, t)
    put("trunk", 3, 3, 0, t)
    put("trunk", 4, 3, 0, t)
    for tx, ty, it in ((1, 1, "ironPlate"), (1, 2, "gear"), (2, 3, "gizmo"), (5, 3, "copperWire")):
        put("module", tx, ty)
        img.alpha_composite(icon("items", ITEM1.index(it)), (tx * T + 4, ty * T + 4))
    for tx in range(2, 6):
        img.alpha_composite(icon("items", 5 if tx % 2 else 7), (tx * T + 4 + (t * 4) % 16 - 8, 1 * T + 4))
    put("factory_dock", 6, 4, 0, t // 4)
    put("factory_hopper", 8, 1, 0, t // 4)
    return img


def font(size, bold=False):
    for name in (("consolab.ttf" if bold else "consola.ttf"), "arial.ttf"):
        try:
            return ImageFont.truetype("C:/Windows/Fonts/" + name, size)
        except OSError:
            pass
    return ImageFont.load_default()


def contact():
    F, FS = font(16, True), font(12)
    order = list(EXPORTED.keys())
    W = 1500
    sheet = Image.new("RGBA", (W, 6000), (38, 38, 42, 255))
    d = ImageDraw.Draw(sheet)
    y = 10
    d.text((10, y), "Foldworks world sprites  -  palette A Foundry  -  1x row, then 4x", font=F, fill=(235, 230, 220))
    y += 28
    # 1x lineup of everything on the floor
    floor = fr("tile_floor", 0)
    x = 10
    line = Image.new("RGBA", (W - 20, 40))
    for xx in range(0, line.width, 16):
        for yy in range(0, 40, 16):
            line.alpha_composite(floor, (xx, yy))
    for n in order:
        im = fr(n, 0)
        if x + im.width + 4 > line.width:
            break
        line.alpha_composite(im, (x - 10, 4))
        x += im.width + 4
    sheet.alpha_composite(line, (10, y))
    y += 48
    # every sprite as a block (label + its frames at 4x, 3x for 32 px, 5x for items), flowing
    x, rowh = 10, 0
    for n in order:
        spr, bgk = EXPORTED[n]
        frs = frames_of(spr)
        k = 5 if n.startswith("items") else (4 if spr.w <= 16 else 3)
        bw = max(len(frs) * (spr.w * k + 4), int(d.textlength("%s %dx%d x%d" % (n, spr.w, spr.h, spr.n_frames), font=FS)) + 6)
        if n.startswith("items"):
            x, y = 10, y + rowh
            rowh = 0
        if x + bw > W - 10:
            x, y, rowh = 10, y + rowh, 0
        d.text((x, y), "%s %dx%d x%d" % (n, spr.w, spr.h, spr.n_frames), font=FS, fill=(220, 215, 205))
        tile = {"floor": floor, "factory": fr("tile_factory", 0), "belt": fr("belt", 0), "ore": fr("tile_ore_iron", 0)}.get(bgk)
        xx = x
        for im in frs:
            bg = Image.new("RGBA", im.size, hex2rgba(P["shadow"]))
            if tile is not None:
                for ty in range(0, im.height, 16):
                    for tx in range(0, im.width, 16):
                        bg.alpha_composite(tile, (tx, ty))
            bg.alpha_composite(im)
            sheet.alpha_composite(up(bg, k), (xx, y + 16))
            xx += spr.w * k + 4
        x += bw + 18
        rowh = max(rowh, spr.h * k + 26)
    y += rowh + 10
    sc = workshop(0)
    d.text((10, y), "Workshop scene 1x and 2x (pips drawn as the game does)", font=FS, fill=(220, 215, 205))
    y += 16
    sheet.alpha_composite(sc, (10, y))
    sheet.alpha_composite(up(sc, 2), (sc.width + 30, y))
    y += sc.height * 2 + 12
    fc = factory(0)
    sheet.alpha_composite(fc, (10, y))
    sheet.alpha_composite(up(fc, 3), (fc.width + 30, y))
    y += fc.height * 3 + 12
    sheet.crop((0, 0, W, y)).convert("RGB").save(HERE / "contact.png")


def build():
    sc = workshop(0)
    sc.save(OUT / "scene_workshop_1x.png")
    up(sc, 3).save(OUT / "scene_workshop_3x.png")
    gif = [up(workshop(t), 2).convert("RGB") for t in range(8)]
    gif[0].save(OUT / "scene_workshop.gif", save_all=True, append_images=gif[1:], duration=62, loop=0)
    fc = factory(0)
    up(fc, 3).save(OUT / "scene_factory_3x.png")
    contact()
