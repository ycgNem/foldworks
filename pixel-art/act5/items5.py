"""Tier 5 item icons (docs/endgame.md, the contract for Milestone 10): items5.png, 8 cells of 8x8 in
ITEM_IDS order after tier 4, with `names`. The impossible inventions, told apart by silhouette at
1x (DESIGN.md §17; STYLE.md "Items"): ink outline, light from the top-left, each a shape no earlier
icon has. Every dark body carries a lit rim (the Act III review: dark icons vanish in dark wells).

    bottledTuesday       a bottle lying on the diagonal, corked, a calendar leaf (red header) in it
    mapOfEverywhere      a scroll unrolled between two rolls: land, sea and a red X on bone
    verySmallSun         a sun the size of a marble: a round blaze with twelve rays all round
    pocketIsland         a floating island: a tree and a red roof on grass over a rock cone
    quietEngine          a teal engine block with a steel flywheel, asleep (a bone "z" over it)
    foldedUniverse       the Folded Universe Replica: a square of night sky, stars and a galaxy,
                         its corner dog-eared over to show the bone paper back
    everlastingSandwich  the sandwich (lettuce, tomato) under a gold halo
    infiniteStaircase    marble stairs climbing right and on into the stars (dots past the top)
"""
from PIL import Image, ImageDraw

from c5 import OUT, P, grid, new, on_bg, scale, ship

ORDER = ["bottledTuesday", "mapOfEverywhere", "verySmallSun", "pocketIsland", "quietEngine", "foldedUniverse",
         "everlastingSandwich", "infiniteStaircase"]

K = {"k": P["ink"], "K": P["ink1"]}


def icon(rows, **key):
    return grid(rows, {**K, **{k: P[v] for k, v in key.items()}}, 8, 8)


ICONS = {
    # a bottle lying on the diagonal (the plastic bottle and the flasks stand upright), corked
    # up-right, the glass sky-tinted and lit, a calendar leaf inside: a red header over bone
    "bottledTuesday": icon([
        "......kk",
        ".....kCk",
        "....kGkk",
        "..kkGgk.",
        ".kWRRgk.",
        "kWbbbgk.",
        "kGbbgk..",
        ".kkkk...",
    ], C="wood4", W="cloud3", G="sky3", g="sky2", R="red", b="bone"),
    # a scroll unrolled between two rolls: bone sheet, green land, blue sea, a red X
    "mapOfEverywhere": icon([
        "kk....kk",
        "kWkkkkWk",
        "kWbGsbwk",
        "kwGGbsWk",
        "kWbsGbwk",
        "kwsbGrwk",
        "kWkkkkwk",
        "kk....kk",
    ], W="pave3", w="pave1", b="bone", G="grass2", s="sky2", r="red"),
    # a very small sun: a round blaze (lamp3 lit, lamp2, lamp1 shade) with rays on every side
    "verySmallSun": icon([
        "...YY...",
        ".Y.kk.Y.",
        "..kWYk..",
        "YkWYYOkY",
        "YkYYOOkY",
        "..kOOk..",
        ".O.kk.O.",
        "...OO...",
    ], W="lamp3", Y="lamp2", O="lamp1"),
    # a pocket island: a tree and a red-roofed hut on grass, a rock cone under it, a trickle
    "pocketIsland": icon([
        "..kkk...",
        ".kTTtk..",
        "kkkbkkkk",
        "kGGGGggk",
        "kgggggek",
        ".kEEeWk.",
        "..kEek..",
        "...kk...",
    ], T="grass3", t="grass1", b="wood2", G="grass3", g="grass2", E="earth3", e="earth2", W="sky3"),
    # a quiet engine: a teal block with fins, a steel flywheel in front, a sleepy bone "z"
    "quietEngine": icon([
        "...kk...",
        "..kPPk..",
        ".kkVVkk.",
        "kVvVvVvk",
        "kbbbbbbk",
        "kVvVvkSk",
        "kVvVkSsS",
        "kkkkkkSk",
    ], P="bone", V="violet", v="slag1", b="bone", S="steel3", s="steel1"),
    # the Folded Universe Replica: a square of night, a lit violet rim, stars and a gold star, the
    # top-right corner folded down over it showing the paper's bone back
    "foldedUniverse": icon([
        "kkkkk...",
        "kVVVVk..",
        "kVnwnBk.",
        "kVnvnbBk",
        "kVvnYkkk",
        "kVnvsnwk",
        "kVwnnvnk",
        "kkkkkkkk",
    ], V="steel3", n="ink2", v="slag0", s="violet", w="cloud3", Y="lamp2", B="bone", b="pave2"),
    # the everlasting sandwich: bread, lettuce and tomato under a floating gold halo
    "everlastingSandwich": icon([
        "..yYYy..",
        ".Y....Y.",
        ".kyYYyk.",
        "kBBBBBbk",
        "kGRGGRGk",
        "kbbbbbbk",
        ".kkkkkk.",
        "........",
    ], y="lamp3", Y="lamp2", B="wood5", b="wood4", G="moss5", R="red"),
    # an infinite staircase: marble steps climbing right, and on past the top into the stars
    "infiniteStaircase": icon([
        ".....w.w",
        "....kkkk",
        "....kWWk",
        "..kkkMmk",
        "..kWWMmk",
        "kkkMMmmk",
        "kWWMmmmk",
        "kkkkkkkk",
    ], w="cloud3", W="cloud3", M="cloud1", m="steel3"),
}


def label_sheet(cells, names, k=8, cols=4, bg=P["pave2"]):
    """A contact sheet: each icon at k x on the paving, its name under it."""
    cw, ch = 8 * k + 40, 8 * k + 22
    rows = (len(cells) + cols - 1) // cols
    out = Image.new("RGBA", (cols * cw, rows * ch + 40), (40, 36, 52, 255))
    d = ImageDraw.Draw(out)
    for i, (c, n) in enumerate(zip(cells, names)):
        x, y = (i % cols) * cw + 12, (i // cols) * ch + 6
        out.alpha_composite(scale(on_bg(c, bg), k), (x, y))
        d.text((x, y + 8 * k + 3), f"{i} {n}", fill=(238, 226, 198, 255))
    return out


def build():
    cells = [ICONS[n] for n in ORDER]
    ship("items5", cells, 0, extra={"names": ORDER}, look=8)
    sheet = label_sheet(cells, ORDER)
    strip = new(len(cells) * 10 + 4, 12)
    for i, c in enumerate(cells):
        strip.alpha_composite(c, (2 + i * 10, 2))
    sheet.alpha_composite(scale(on_bg(strip, P["pave2"]), 2), (8, sheet.height - 30))
    sheet.save(OUT / "items5_sheet.png")


if __name__ == "__main__":
    build()
