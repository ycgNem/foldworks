"""Tier 4 item icons (docs/endgame.md, the contract for Milestone 9): items4.png, 15 cells of 8x8 in
ITEM_IDS order after tier 3, with `names`. Silhouette first, colour second (DESIGN.md §17; STYLE.md
"Items"): ink outline, light from the top-left, every one a shape no earlier icon has. The Act III
review found dark icons lost in dark wells, so every dark body here carries a lit rim (a steel3 or
lamp edge on its top-left inside the outline) or a glow that reads on ink1.

    skyglass        a cluster of pale glass prisms, two points, a sky tint in the shade
    cinderite       a round black lava bomb split by glowing orange cracks, its shoulder lit
    rimeCrystal     a teal ice diamond (a rhombus) with a white frost cap
    relic           a pale stone tablet, rounded top, a violet rune glowing in it, moss at its foot
    skyglassLens    a magnifying lens: a brass ring of sky glass with a glint, a wooden handle
    cinderAlloy     two crimson ingots stacked crosswise, a seam of ember between them
    frostAlloy      a pale silver bar with icicles hanging from it
    relicGear       an old brass gear, verdigris in its teeth, a violet eye, one tooth broken off
    stormCell       a squat glass jar with a brass lid holding a grey cloud and a yellow bolt
    sunsetDye       a terracotta pot brimming with dye in sunset bands, a drip down its side
    horizonLens     a brass spyglass lying diagonally, its big lens up-right catching the sky
    pocketWeather   a pocket watch case open on a tiny sky: a sun, a cloud, rain
    sunsetGenerator the Portable Sunset Generator: a little suitcase with the sun setting out of it
    lighthouseLamp  a Fresnel lantern: a brass cap, ribbed glass blazing gold, a brass base
    anchorChain     a ship's anchor on a ring, two chain links trailing off the ring
"""
from PIL import Image, ImageDraw

from c4 import OUT, P, SRC_ART, grid, new, on_bg, scale, ship

ORDER = ["skyglass", "cinderite", "rimeCrystal", "relic", "skyglassLens", "cinderAlloy", "frostAlloy", "relicGear",
         "stormCell", "sunsetDye", "horizonLens", "pocketWeather", "sunsetGenerator", "lighthouseLamp", "anchorChain"]

K = {"k": P["ink"], "K": P["ink1"]}


def icon(rows, **key):
    return grid(rows, {**K, **{k: P[v] for k, v in key.items()}}, 8, 8)


ICONS = {
    # two glass prisms, the tall one pointed: lit faces white, the turned faces sky, a sun glint
    "skyglass": icon([
        "....k...",
        "...kWk..",
        "..kWWsk.",
        ".kkWWsk.",
        "kWkWssBk",
        "kWsWssBk",
        "kssBsBBk",
        ".kkkkkk.",
    ], W="cloud3", s="sky3", B="sky1"),
    # a round lava bomb: basalt with a lit shoulder (steel3/steel2), cracks glowing lamp1, hot lamp3
    "cinderite": icon([
        "..kkkk..",
        ".kSSsjk.",
        "kSsLjjjk",
        "ksjjLlLk",
        "kLjjjjjk",
        "kjLlLjjk",
        ".kjjjLk.",
        "..kkkk..",
    ], S="steel3", s="steel2", j="ink2", L="lamp1", l="lamp3"),
    # a rhombus of teal ice, frost white on its upper edges
    "rimeCrystal": icon([
        "...kk...",
        ".kkWWkk.",
        "kWWWWWCk",
        "kTTWWCdk",
        "kTtTdddk",
        "kTtTdddk",
        ".kkTddk.",
        "...kk...",
    ], W="cloud3", C="cloud1", T="teal", t="cloud2", d="water4"),
    # a stone tablet with a rounded top and a violet rune, moss at the foot
    "relic": icon([
        "..kkkk..",
        ".kPPPpk.",
        "kPPvvpek",
        "kPvVvpek",
        "kPpvppek",
        "kPpvppek",
        "kmmppmek",
        "kkkkkkkk",
    ], P="pave3", p="pave2", e="pave0", v="violet", V="bone", m="moss4"),
    # a magnifier: brass ring, sky glass with a glint, a wooden handle down-right
    "skyglassLens": icon([
        "..kkkk..",
        ".kRRRrk.",
        "kRWWssrk",
        "kRWsSSrk",
        "kRsSSDrk",
        ".krSDrkk",
        "..kkkkHk",
        "......kH",
    ], R="brass3", r="brass1", W="cloud3", s="sky3", S="sky2", D="sky1", H="wood3"),
    # two crimson ingots stacked crosswise: a short one on a long one, an ember seam between
    "cinderAlloy": icon([
        "........",
        "..kkkk..",
        ".kRRrrk.",
        ".kcccck.",
        "kkLLLLkk",
        "kRRrrrrk",
        "kccccc0k",
        "kkkkkkkk",
    ], R="copper2", r="copper1", c="copper0", L="lamp1", **{"0": "ink2"}),
    # a pale silver bar, frosted, three icicles hanging from it
    "frostAlloy": icon([
        "........",
        ".kkkkkk.",
        "kWWWWWWk",
        "kSSSSSdk",
        "kSddSddk",
        "kTkTkTkk",
        ".k.k.k..",
        "........",
    ], W="cloud3", S="cloud1", d="steel3", T="sky3"),
    # an old brass gear: teeth, verdigris, a violet eye, the bottom-right tooth broken off
    "relicGear": icon([
        ".kkBBkk.",
        "kBkbbkBk",
        "kkbbbbkk",
        "BbbvVbbg",
        "Bbbvvbgg",
        "kkbbbgkk",
        "kBkggkk.",
        ".kkgkk..",
    ], B="brass3", b="brass2", v="violet", V="bone", g="water3"),
    # a squat jar, brass lid, a grey cloud over a dark storm with a yellow bolt; glass rims lit
    "stormCell": icon([
        "..kkkk..",
        ".kBbbBk.",
        "kkkkkkkk",
        "kGGgGgsk",
        "ksgjyjsk",
        "ksjyjjsk",
        "ksjjyjsk",
        ".kkkkkk.",
    ], B="brass3", b="brass2", G="steel4", g="steel3", y="lamp2", j="ink2", s="sky2"),
    # a terracotta pot brimming with dye in sunset bands (gold, orange, red), a drip down its side
    "sunsetDye": icon([
        "........",
        "kkkkkkkk",
        "kyYYOORk",
        "kkkkkkkO",
        ".kTTttkO",
        ".kTttdk.",
        ".ktddd.k",
        "..kkkk..",
    ], y="lamp3", Y="lamp2", O="lamp1", R="red", T="wood4", t="wood3", d="wood2"),
    # a brass spyglass lying diagonally, its big lens up-right catching the sky
    "horizonLens": icon([
        ".....kkk",
        "....kBsk",
        "...kBbWk",
        "..kBbbk.",
        ".kkbbk..",
        "kBkkk...",
        "kbbk....",
        ".kk.....",
    ], B="brass3", b="brass2", s="sky2", W="cloud3"),
    # a pocket watch case on its bow, opened on a tiny sky: a sun, a cloud, rain
    "pocketWeather": icon([
        "...kk...",
        "..kBBk..",
        ".kkkkkk.",
        "kBYsccBk",
        "kBsccCbk",
        "kBsrsrbk",
        ".kBbbbk.",
        "..kkkk..",
    ], B="brass3", b="brass1", Y="lamp2", s="sky3", c="cloud3", C="cloud1", r="sky1"),
    # a little suitcase with its sunset rising out of it: rays, the half sun, the horizon band
    "sunsetGenerator": icon([
        "Y..YY..Y",
        "..kyyk..",
        ".kyYYOk.",
        "kRRRRRRk",
        "kkkkkkkk",
        "kwbwwbdk",
        "kwwwwddk",
        "kkkkkkkk",
    ], Y="lamp2", y="lamp3", O="lamp1", R="red", w="wood3", d="wood2", b="brass3"),
    # a Fresnel lantern: brass cap and base, ribbed glass blazing in stripes
    "lighthouseLamp": icon([
        "...kk...",
        "..kRRk..",
        ".kkkkkk.",
        ".kyLyLk.",
        ".kLyLyk.",
        ".kyLyOk.",
        "kBBbbbBk",
        "kkkkkkkk",
    ], R="red", y="lamp3", L="lamp2", O="lamp1", B="brass3", b="brass2"),
    # an anchor on its ring, two chain links trailing up-right off the ring
    "anchorChain": icon([
        "..kkk.kk",
        "..kSkkSk",
        ".kkkkkk.",
        "kWSSSSk.",
        ".kkSkk..",
        "kSkSkSk.",
        "kSkSkdk.",
        ".kSSdk..",
    ], S="steel3", W="steel4", d="steel2"),
}


def label_sheet(cells, names, k=8, cols=5, bg=P["pave2"]):
    """A contact sheet: each icon at k x on the paving, its name under it."""
    cw, ch = 8 * k + 24, 8 * k + 22
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
    ship("items4", cells, 0, extra={"names": ORDER}, look=8)
    sheet = label_sheet(cells, ORDER)
    strip = new(len(cells) * 10 + 4, 12)
    for i, c in enumerate(cells):
        strip.alpha_composite(c, (2 + i * 10, 2))
    sheet.alpha_composite(scale(on_bg(strip, P["pave2"]), 2), (8, sheet.height - 30))
    sheet.save(OUT / "items4_sheet.png")


if __name__ == "__main__":
    build()
