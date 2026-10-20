"""Foldworks Milestone 2 art: python build.py

Exports to src/art/ (1x strip + JSON sidecar, palette-checked) and writes previews and mock
scenes to out/:
    tile_water, tile_shore, ui_toast, ui_tip, fold_corner, fx_confetti, fx_burst,
    portrait_bramble_cheer, ui_icons_small, module_glow
    out/mock_swamp_{1,2,3}x.png   a Workshop and a Factory plot ringed by water and banks
    out/mock_ui_{1,2}x.png        toast, tooltip, fold box, stamp + burst + confetti, the cheer
                                  card, inline small icons, the running module glow
"""
import sprites as S
from common_m2 import (P, export, OUT, up, fr, load, nine, text, text_w, hex2rgba, Image,
                       frame_of, checker)

T = 16


def frames(name):
    im, meta = load(name)
    w, h = meta["frame"]
    return [im.crop((i * w, 0, (i + 1) * w, h)) for i in range(meta["frames"])]


def pip(img, x, y, colour):
    col, ink = hex2rgba(P[colour]), hex2rgba(P["ink"])
    for yy in range(4):
        for xx in range(4):
            if xx in (0, 3) and yy in (0, 3):
                continue
            img.putpixel((x + xx, y + yy), col if (1 <= xx <= 2 and 1 <= yy <= 2) else ink)


# ------------------------------------------------------------------ swamp mock
def swamp(t, factory=False):
    W, H = 20, 13
    land = set()
    for ty in range(3, 10):
        for tx in range(3, 13):
            land.add((tx, ty))
    for ty in range(5, 10):
        for tx in range(13, 16):
            land.add((tx, ty))
    land.discard((3, 3))
    img = Image.new("RGBA", (W * T, H * T), hex2rgba(P["ink"]))
    water = frames("tile_water")
    shore = frames("tile_shore")
    floor = frames("tile_factory" if factory else "tile_floor")
    for ty in range(H):
        for tx in range(W):
            if (tx, ty) in land:
                img.alpha_composite(floor[(tx * 7 + ty * 3) % len(floor)] if not factory else floor[0],
                                    (tx * T, ty * T))
            else:
                f = (t + (tx * 3 + ty * 5)) % 4   # per-tile phase offset (optional in the game)
                img.alpha_composite(water[f], (tx * T, ty * T))
    # banks: one frame per land side, drawn after all water
    for ty in range(H):
        for tx in range(W):
            if (tx, ty) in land:
                continue
            for side, (dx, dy) in enumerate(((0, -1), (1, 0), (0, 1), (-1, 0))):
                if (tx + dx, ty + dy) in land:
                    im = shore[side]
                    if side in (0, 2) and (tx * 5 + ty * 3) % 3 == 0:
                        im = im.transpose(Image.FLIP_LEFT_RIGHT)   # variety along N/S coasts
                    img.alpha_composite(im, (tx * T, ty * T))
    if not factory:
        for q in range(4):
            img.alpha_composite(fr("tile_ore_iron", q), ((4 + q % 2) * T, (4 + q // 2) * T))
        mf = frames("miner")
        img.alpha_composite(mf[t % 4], (6 * T, 4 * T)); pip(img, 6 * T + 12, 4 * T, "pipGreen")
        bf = frames("belt")
        for tx in (7, 8):
            img.alpha_composite(bf[t % 4], (tx * T, 4 * T))
        img.alpha_composite(fr("items", 0), (7 * T + 4 + (t * 2) % 8, 4 * T + 4))
        sm = frames("smelter")
        img.alpha_composite(sm[t % 4], (9 * T, 4 * T)); pip(img, 9 * T + 12, 4 * T, "pipGreen")
        mod = fr("module")
        glow = frames("module_glow")
        for (tx, ty, it, run) in ((7, 7, 5, True), (9, 7, 7, False), (14, 6, 9, True)):
            img.alpha_composite(mod, (tx * T, ty * T))
            img.alpha_composite(fr("items", it), (tx * T + 4, ty * T + 4))
            if run:
                img.alpha_composite(glow[t % 4], (tx * T, ty * T))
            pip(img, tx * T + 12, ty * T, "pipGreen" if run else "pipYellow")
    else:
        mod = fr("module")
        glow = frames("module_glow")
        for (tx, ty, it) in ((5, 5, 5), (6, 5, 7), (8, 6, 9)):
            img.alpha_composite(mod, (tx * T, ty * T))
            img.alpha_composite(fr("items", it), (tx * T + 4, ty * T + 4))
            img.alpha_composite(glow[(t + tx) % 4], (tx * T, ty * T))
    return img


# ------------------------------------------------------------------ ui mock
def draw_box_ants(img, x0, y0, x1, y1, t):
    """The code-drawn marching ants between the corner brackets (2 px band, dash 3 gap 2)."""
    gold, ink = hex2rgba(P["gold"]), hex2rgba(P["ink"])
    per = []
    for x in range(x0, x1 + 1):
        per.append((x, y0))
    for y in range(y0 + 1, y1 + 1):
        per.append((x1, y))
    for x in range(x1 - 1, x0 - 1, -1):
        per.append((x, y1))
    for y in range(y1 - 1, y0, -1):
        per.append((x0, y))
    for i, (x, y) in enumerate(per):
        img.putpixel((x, y), gold if (i - t) % 5 < 3 else ink)


def ui_mock(t=0):
    W, H = 400, 230
    img = Image.new("RGBA", (W, H), hex2rgba(P["shadow"]))
    # left: a slice of map with a fold box being dragged over three machines
    floor = frames("tile_floor")
    for ty in range(9):
        for tx in range(10):
            img.alpha_composite(floor[(tx * 7 + ty * 3) % 4], (8 + tx * T, 8 + ty * T))
    bf = frames("belt")
    for tx in range(2, 7):
        img.alpha_composite(bf[0], (8 + tx * T, 8 + 3 * T))
    for (name, tx) in (("miner", 1), ("smelter", 4), ("press", 7)):
        img.alpha_composite(frames(name)[0], (8 + tx * T, 8 + 3 * T))
        pip(img, 8 + tx * T + 12, 8 + 3 * T, "pipGreen")
    bx0, by0, bx1, by1 = 8 + 1 * T - 2, 8 + 2 * T + 6, 8 + 8 * T + 1, 8 + 5 * T - 6
    draw_box_ants(img, bx0, by0, bx1, by1, t)
    cf = frames("fold_corner")
    img.alpha_composite(cf[0], (bx0, by0))
    img.alpha_composite(cf[1], (bx1 - 7, by0))
    img.alpha_composite(cf[2], (bx0, by1 - 7))
    img.alpha_composite(cf[3], (bx1 - 7, by1 - 7))
    # a tooltip on the map
    tipsrc = frames("ui_tip")[0]
    lines = [("Smelter", P["bone"]), ("1.0 ingot/s", P["hull2"]), ("working", P["leaf"])]
    tw = max(text_w(s_) for s_, _ in lines) + 8
    th = 6 + 10 * len(lines)
    tx0, ty0 = 8 + 5 * T + 4, 8 + 4 * T + 6
    img.alpha_composite(nine(tipsrc, (3, 3, 3, 3), tw, th), (tx0, ty0))
    for j, (s_, col) in enumerate(lines):
        text(img, s_, tx0 + 4, ty0 + 3 + j * 10, col)
    # a module glow strip on the map: three modules running
    mod, gl = fr("module"), frames("module_glow")
    for i in range(3):
        x, y = 8 + (1 + i * 2) * T, 8 + 7 * T
        img.alpha_composite(mod, (x, y))
        img.alpha_composite(fr("items", (5, 7, 9)[i]), (x + 4, y + 4))
        img.alpha_composite(gl[(t + i) % 4], (x, y))
        pip(img, x + 12, y, "pipGreen")
    # toasts, stacked top-right
    toastsrc = frames("ui_toast")[0]
    sm = frames("ui_icons_small")
    names = S.ICON_ORDER
    toasts = [("research", "Research complete", P["bone"]), ("coin", "+1,250 coin", P["gold"]),
              ("trophies", "Trophy: First fold", P["bone"])]
    for j, (ic, msg, col) in enumerate(toasts):
        w = text_w(msg) + 8 + 22
        x, y = W - 8 - w, 8 + j * 26
        img.alpha_composite(nine(toastsrc, (6, 6, 6, 6), w, 22), (x, y))
        img.alpha_composite(sm[names.index(ic)], (x + 9, y + 7))
        text(img, msg, x + 20, y + 7, col)
    # the grade stamp with its burst (2x) and confetti
    gx, gy = 196, 100
    burst = frames("fx_burst")[t % 6]
    img.alpha_composite(up(burst, 3), (gx - 24, gy - 24))   # 3x behind the 48 ring
    img.alpha_composite(fr("ui_stamp_ring"), (gx, gy))
    img.alpha_composite(fr("ui_grade", 0), (gx + 8, gy + 8))
    cf = frames("fx_confetti")
    import random
    rnd = random.Random(7)
    for i in range(26):
        img.alpha_composite(cf[i % 8], (gx - 30 + rnd.randrange(108), gy - 20 + rnd.randrange(96)))
    # the cheer card
    card = frames("ui_panel_light")[0]
    cx, cy = W - 8 - 150, 92
    img.alpha_composite(nine(card, (6, 6, 6, 6), 150, 92), (cx, cy))
    inset = fr("ui_inset")
    img.alpha_composite(nine(inset, (3, 3, 3, 3), 54, 54), (cx + 8, cy + 8))
    img.alpha_composite(frames("portrait_bramble_cheer")[t % 2], (cx + 11, cy + 11))
    text(img, "The swamp", cx + 68, cy + 12, P["ink"])
    text(img, "has a", cx + 68, cy + 22, P["ink"])
    text(img, "Factory!", cx + 68, cy + 32, P["copper0"])
    text(img, "- Mayor Bramble", cx + 8, cy + 70, P["ground1"])
    # inline small icons in a row of text on dark wood
    rowy = 200
    x = 8
    for i, n in enumerate(names):
        img.alpha_composite(sm[i], (x, rowy))
        x += 10
    text(img, "Gizmo x3", 8, rowy + 14, P["bone"])
    img.alpha_composite(sm[names.index("coin")], (60, rowy + 13))
    text(img, "250", 70, rowy + 14, P["gold"])
    img.alpha_composite(sm[names.index("heart")], (92, rowy + 13))
    text(img, "2", 102, rowy + 14, P["copper2"])
    img.alpha_composite(sm[names.index("clock")], (114, rowy + 13))
    text(img, "4m 10s", 124, rowy + 14, P["hull2"])
    return img


def main():
    out = {
        "tile_water": (S.water(), 4, None),
        "tile_shore": (S.shore(), 0, None),
        "ui_toast": (S.toast(), 0, (6, 6, 6, 6)),
        "ui_tip": (S.tip(), 0, (3, 3, 3, 3)),
        "fold_corner": (S.fold_corners(), 0, None),
        "fx_confetti": (S.confetti(), 0, None),
        "fx_burst": (S.burst(), 15, None),
        "portrait_bramble_cheer": (S.bramble(), 0, None),
        "ui_icons_small": (S.icons_small(), 0, None),
        "module_glow": (S.module_glow(), 8, None),
    }
    for name, (spr, fps, sl) in out.items():
        extra = {"names": S.ICON_ORDER} if name == "ui_icons_small" else None
        export(spr, name, fps, sl, scale=12 if spr.w <= 8 else 8, extra=extra)
    # mocks
    for t in range(4):
        sw = swamp(t)
        if t == 0:
            for k_ in (1, 2, 3):
                up(sw, k_).save(OUT / f"mock_swamp_{k_}x.png")
            up(swamp(0, True), 2).save(OUT / "mock_factory_2x.png")
    um = ui_mock(0)
    um.save(OUT / "mock_ui_1x.png")
    up(um, 2).save(OUT / "mock_ui_2x.png")
    # animation strips of the water at 4x (4 frames side by side, 3x3 tiles each)
    wf = frames("tile_water")
    strip_ = Image.new("RGBA", (4 * 48 + 3 * 4, 48), (0, 0, 0, 0))
    for f in range(4):
        for ty in range(3):
            for tx in range(3):
                strip_.alpha_composite(wf[f], (f * 52 + tx * 16, ty * 16))
    up(strip_, 4).save(OUT / "water_frames_4x.png")


if __name__ == "__main__":
    main()
