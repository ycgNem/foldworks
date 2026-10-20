"""The HUD mock: 640x360 UI pixels (1280x720 at UI scale 2), assembled ONLY from the exported
src/art/ui_*.png pieces (9-slices drawn in tile mode), the world sprites the other art pass
exported (used read-only, for the store illustrations) and the game's own bitmap font.
Writes out/mock.png (1x), out/mock_2x.png, out/mock_layout.json (every rect the lead needs),
and the research-tree screen mock out/mock_research.png (+ _2x).
"""
import json
import math
from common import P, ART, OUT, nine, text, text_w, up, frame_of, ICONCH
from PIL import Image

k, sh, bone = P["ink"], P["shadow"], P["bone"]
fog, gold = P["hull2"], P["gold"]

A = {}


def art(name):
    if name not in A:
        im = Image.open(ART / f"{name}.png").convert("RGBA")
        meta = json.loads((ART / f"{name}.json").read_text())
        A[name] = (im, meta)
    return A[name]


def fr(name, i=0):
    im, meta = art(name)
    return frame_of(im, meta["frame"][0], i)


def nine_(name, w, h, i=0):
    im, meta = art(name)
    return nine(fr(name, i), meta["slice"], w, h)


ICONS = json.loads((ART / "ui_icons.json").read_text())["names"]


def icon(name):
    return fr("ui_icons", ICONS.index(name))


LAYOUT = []


class M:
    def __init__(self, W, H, bg):
        self.im = Image.new("RGBA", (W, H), bg)

    def put(self, img, x, y, tag=None):
        self.im.alpha_composite(img, (x, y))
        if tag:
            LAYOUT.append({"what": tag, "x": x, "y": y, "w": img.width, "h": img.height})

    def nine(self, name, x, y, w, h, i=0, tag=None):
        self.put(nine_(name, w, h, i), x, y, tag)

    def fill(self, x, y, w, h, col):
        self.im.paste(Image.new("RGBA", (w, h), col), (x, y))

    def text(self, *a, **kw):
        return text(self.im, *a, **kw)


def hud():
    W, H = 640, 360
    m = M(W, H, k)
    # ------------------------------------------------------------ centre: the map area
    MX, MY, MW, MH = 160, 22, 320, 298
    m.fill(MX, MY, MW, MH, P["shadow"])
    for y in range(MY, MY + MH):
        for x in range(MX, MX + MW):
            if (x - MX) % 16 == 0 and (y - MY) % 16 == 0:
                m.im.putpixel((x, y), (0x4a, 0x34, 0x31, 255))
    m.text("map (world view)", MX + MW // 2, MY + MH // 2 - 4, P["ground1"], align="center")
    LAYOUT.append({"what": "map viewport (world draws here)", "x": MX, "y": MY, "w": MW, "h": MH})
    # floor name plate hanging into the map, top-left
    m.nine("ui_panel_light", MX + 6, MY + 4, 92, 22, tag="floor plate (ui_panel_light)")
    m.put(icon("workshop"), MX + 11, MY + 6)
    m.text("Workshop", MX + 30, MY + 10, k)
    # a hover report bubble over the map, to show the tooltip style
    # ------------------------------------------------------------ top: the news ticker
    m.nine("ui_ticker", MX, 2, MW, 16, tag="ticker (ui_ticker, native height 16)")
    m.text("Bramble opens a pond-side bank. Frogs queue for it.", MX + 9, 6, bone)
    # ------------------------------------------------------------ left column
    LX, LW = 2, 154
    m.nine("ui_panel", LX, 2, LW, 74, tag="left: coin panel (ui_panel)")
    m.nine("ui_inset", LX + 8, 10, LW - 16, 30, tag="coin counter well (ui_inset)")
    m.put(fr("ui_coin", 0), LX + 13, 17)
    m.text("1,284,550", LX + 34, 15, gold, sc=2, shadow=k)
    m.text(ICONCH["coin"] + " +12.4 /s", LX + 10, 44, fog)
    m.text("best 3.1K", LX + LW - 10, 44, P["hull1"], align="right")
    m.text(ICONCH["heart"], LX + 10, 57, P["copper1"])
    m.nine("ui_inset", LX + 20, 56, LW - 30, 10, tag="reputation bar (ui_inset)")
    m.fill(LX + 23, 59, 70, 4, P["copper1"])
    m.fill(LX + 23, 59, 70, 1, P["copper2"])
    # orders card
    m.nine("ui_panel", LX, 78, LW, 156, tag="left: orders panel (ui_panel)")
    m.put(icon("orders"), LX + 9, 86)
    m.text("Orders", LX + 28, 90, bone, shadow=k)
    m.text("1 of 3", LX + LW - 10, 90, fog, align="right")
    m.nine("ui_panel_light", LX + 7, 106, LW - 14, 120, tag="order card (ui_panel_light)")
    m.nine("ui_inset", LX + 12, 111, 52, 52, tag="portrait well (ui_inset)")
    m.put(fr("portrait_bramble", 0), LX + 14, 113, tag="portrait 48x48")
    m.text("Mayor", LX + 70, 113, P["ground1"])
    m.text("Bramble", LX + 70, 123, k)
    m.text("wants:", LX + 70, 137, P["ground1"])
    items, _ = art("items")
    m.put(items.crop((5 * 8, 0, 6 * 8, 8)), LX + 70, 149)
    m.text("40 plates", LX + 81, 149, k)
    m.nine("ui_inset", LX + 12, 167, LW - 24, 13, tag="order progress (ui_inset, 13 tall, count drawn on it)")
    m.fill(LX + 15, 170, 84, 7, P["iron1"])
    m.fill(LX + 15, 170, 84, 1, P["iron2"])
    m.text("26 / 40", LX + LW // 2, 170, bone, align="center", shadow=k)
    m.text("\"A boardwalk! A real one!\"", LX + 13, 182, P["moss"])
    m.text("pays", LX + 13, 193, P["ground1"])
    m.text(ICONCH["coin"] + " 250  " + ICONCH["heart"] + " 2", LX + 38, 193, P["brass0"])
    m.nine("ui_button_gold", LX + 12, 204, LW - 24, 18, 0, tag="Deliver (ui_button_gold)")
    m.text("Deliver", LX + LW // 2, 209, k, align="center")
    # goals / milestones
    m.nine("ui_panel", LX, 236, LW, 122, tag="left: goals panel (ui_panel)")
    m.put(icon("star"), LX + 9, 244)
    m.text("Goals", LX + 28, 248, bone, shadow=k)
    goals = [("Smelt 100 ingots", 1.0, True), ("Fold a line", 0.0, False), ("Earn 10K coin", 0.62, False),
             ("Buy a land plot", 0.3, False)]
    for i, (g, f, done) in enumerate(goals):
        y = 266 + i * 22
        m.text(ICONCH["check"] if done else ICONCH["pip"], LX + 11, y, P["leaf"] if done else P["hull1"])
        m.text(g, LX + 22, y, fog if done else bone)
        m.nine("ui_inset", LX + 22, y + 10, LW - 32, 7)
        m.fill(LX + 25, y + 12, int((LW - 38) * f), 3, P["leaf"] if done else gold)
    # ------------------------------------------------------------ right column: the store
    RX, RW = 484, 154
    tabs = ["build", "research", "orders", "stats"]
    m.nine("ui_panel", RX, 14, RW, 344, tag="right: store panel (ui_panel)")
    for i, t in enumerate(tabs):
        x = RX + 6 + i * 36
        if i != 0:
            m.nine("ui_tab", x, 2, 34, 16, 0)
            m.put(icon(t), x + 9, 3)
    m.nine("ui_tab", RX + 6, 2, 34, 16, 1, tag="active tab (ui_tab frame 2, overlaps panel top by 4)")
    m.put(icon("build"), RX + 15, 4)
    m.text("Workshop", RX + RW // 2, 26, bone, shadow=k, align="center")
    # buy-amount toggles
    for i, lab in enumerate(["x1", "x10", "Max"]):
        x = RX + 12 + i * 44
        m.nine("ui_button", x, 38, 42, 16, 2 if i == 0 else 0)
        m.text(lab, x + 21, 42 + (1 if i == 0 else 0), bone if i == 0 else fog, align="center", shadow=k)
    rows = [("Miner", "miner", "15", 12, 0), ("Smelter", "smelter", "40", 6, 1), ("Press", "press", "120", 3, 0),
            ("Assembler", "assembler", "1.2K", 1, 0), ("Splitter", "splitter", "8.5K", 0, 2), ("Module", "module", "50K", 0, 2)]
    for i, (nm, spr, cost, n, state) in enumerate(rows):
        x, y = RX + 8, 60 + i * 32
        m.nine("ui_row", x, y, RW - 16, 30, state, tag=f"store row {i} (ui_row frame {state + 1})" if i < 1 or state else None)
        m.nine("ui_inset", x + 3, y + 3, 24, 24)
        if state == 2:
            m.put(icon("lock"), x + 7, y + 7)
        else:
            m.put(fr(spr, 0), x + 7, y + 7)
        col = bone if state != 2 else P["hull1"]
        m.text(nm if state != 2 else "???", x + 32, y + 5, col, shadow=k)
        m.text(ICONCH["coin"] + " " + cost, x + 32, y + 16, gold if state != 2 else P["hull1"], shadow=k)
        if n:
            m.text(str(n), x + RW - 22, y + 8, P["ground2"] if state == 0 else P["hull3"], sc=2, align="right")
    # upgrades shelf
    y = 256
    m.text("Upgrades", RX + 12, y, fog)
    for i, ic in enumerate(["flow", "fold", "clock", "heart", "star"]):
        x = RX + 12 + i * 27
        m.nine("ui_inset", x, y + 10, 24, 24)
        m.put(icon(ic), x + 4, y + 14)
    m.nine("ui_button_gold", RX + 10, 298, RW - 20, 22, 1, tag="Buy land (ui_button_gold, hover frame)")
    m.text("Buy land  " + ICONCH["coin"] + " 5.0K", RX + RW // 2, 304, k, align="center")
    m.text("next plot: 3x3 tiles", RX + RW // 2, 330, P["hull1"], align="center")
    m.text("land owned 4", RX + RW // 2, 341, P["hull1"], align="center")
    # ------------------------------------------------------------ bottom: the tool bar
    m.nine("ui_panel", MX, 322, MW, 36, tag="bottom: tool bar (ui_panel)")
    tools = [("build", 2), ("remove", 0), ("rotate", 0), ("flow", 0)]
    x = MX + 9
    for t, st in tools:
        m.nine("ui_button", x, 330, 22, 22, st)
        m.put(icon(t), x + 3, 332 + (1 if st == 2 else 0))
        x += 24
    x += 4
    m.nine("ui_button_gold", x, 330, 62, 22, 0, tag="Fold (ui_button_gold)")
    m.put(icon("fold"), x + 4, 332)
    m.text("Fold", x + 24, 337, k)
    x += 66
    for i, (t_, st) in enumerate((("workshop", 2), ("factory", 0))):
        m.nine("ui_button", x + 4 + i * 24, 330, 22, 22, st)
        m.put(icon(t_), x + 7 + i * 24, 332 + (1 if st == 2 else 0))
    x = MX + MW - 9 - 3 * 24
    for i, t in enumerate(["pause", "play", "fastforward"]):
        m.nine("ui_button", x + i * 24, 330, 22, 22, 2 if t == "play" else 0)
        m.put(icon(t), x + i * 24 + 3, 332 + (1 if t == "play" else 0))
    # ------------------------------------------------------------ a floating "+coin" pop and a tooltip
    m.put(fr("ui_coin_small", 0), MX + 200, 150)
    m.text("+40", MX + 210, 150, gold, shadow=k)
    return m.im


def research():
    W, H = 640, 360
    m = M(W, H, k)
    # starfield (code-drawn in the game: palette dots, a few twinkles)
    seed = 7
    for i in range(420):
        seed = (seed * 1103515245 + 12345) & 0x7fffffff
        x = seed % W
        seed = (seed * 1103515245 + 12345) & 0x7fffffff
        y = seed % H
        c = [P["hull0"], P["shadow"], P["iron0"], P["hull1"], P["teal0"]][i % 5]
        m.im.putpixel((x, y), tuple(int(c[j:j + 2], 16) for j in (1, 3, 5)) + (255,))
    for (x, y) in ((70, 60), (590, 300), (420, 40), (120, 320)):
        for dx, dy in ((0, 0), (1, 0), (-1, 0), (0, 1), (0, -1)):
            m.im.putpixel((x + dx, y + dy), (0xff, 0xec, 0xa0, 255) if dx or dy else (0xf2, 0xe6, 0xcf, 255))
    nodes = {
        "a": (290, 180, 3, "workshop"), "b": (215, 125, 3, "flow"), "c": (365, 125, 2, "fold"),
        "d": (140, 185, 1, "clock"), "e": (290, 60, 1, "factory"), "f": (440, 185, 0, "heart"),
        "g": (215, 255, 1, "stats"), "h": (365, 255, 0, "star"), "i": (420, 40, 0, "lock"),
    }
    edges = [("a", "b"), ("a", "c"), ("b", "d"), ("b", "e"), ("c", "e"), ("c", "f"), ("a", "g"), ("a", "h"), ("e", "i")]
    for (p, q) in edges:
        (x0, y0, s0, _), (x1, y1, s1, _) = nodes[p], nodes[q]
        n = int(math.hypot(x1 - x0, y1 - y0))
        lit = s0 in (1, 3) and s1 in (1, 2, 3) or (s0 == 3 and s1 == 3)
        col = P["gold"] if (s0 == 3 and s1 == 3) else (P["brass1"] if lit else P["hull0"])
        for t in range(n):
            if (t // 3) % 2 == 0:
                x = round(x0 + 16 + (x1 - x0) * t / n)
                y = round(y0 + 16 + (y1 - y0) * t / n)
                m.im.putpixel((x, y), tuple(int(col[j:j + 2], 16) for j in (1, 3, 5)) + (255,))
    for key, (x, y, st, ic) in nodes.items():
        m.put(fr("ui_node", st), x, y)
        ico = icon(ic)
        if st == 0:  # locked nodes show their icon dimmed: here, the lock
            ico = icon("lock")
        m.put(ico, x + 8, y + 8)
    # title plate and the info card
    m.nine("ui_ticker", 200, 4, 240, 16)
    m.text("Research", 320, 8, bone, align="center")
    m.nine("ui_panel", 470, 210, 166, 146, tag="research: info panel (ui_panel)")
    m.put(fr("ui_node", 2), 478, 216)
    m.put(icon("fold"), 486, 224)
    m.text("The Fold", 514, 222, bone, shadow=k)
    m.text("Tier I", 514, 233, fog)
    for i, line in enumerate(["Fold a working line", "into a single tile.", "Its rate is what it", "really did."]):
        m.text(line, 480, 252 + i * 10, P["hull3"])
    m.text(ICONCH["flask"] + " 12 research", 480, 296, P["teal1"])
    m.nine("ui_button_gold", 478, 316, 150, 22, 0)
    m.text("Research", 553, 322, k, align="center")
    m.nine("ui_button", 4, 330, 60, 24, 0)
    m.text(ICONCH["left"] if "left" in ICONCH else "<", 14, 337, bone)
    m.text("Back", 38, 337, bone, align="center", shadow=k)
    return m.im


def build():
    im = hud()
    im.save(OUT / "mock.png")
    up(im, 2).save(OUT / "mock_2x.png")
    (OUT / "mock_layout.json").write_text(json.dumps(LAYOUT, indent=1), encoding="utf-8")
    r = research()
    r.save(OUT / "mock_research.png")
    up(r, 2).save(OUT / "mock_research_2x.png")


if __name__ == "__main__":
    build()
