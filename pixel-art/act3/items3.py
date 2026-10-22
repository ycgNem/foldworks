"""Tier 3 item icons (docs/endgame.md, Milestone 7): items3.png, 19 cells of 8x8 in ITEM_IDS order
after items2. Silhouette first, colour second (DESIGN.md §17; STYLE.md "Items"): ink outline, light
from the top-left, every one a shape no earlier icon has.

    solvent       a stoppered flask, lily-green liquid with a bubble
    sludge        a dark goo puddle with a bubble ring and a glob: waste, like slag but wet
    rubber        a black tyre standing, its tread ticks on the rim, the sky through its hub
    battery       a gold cell lying down, a dark negative end, a steel terminal nub
    fertilizer    a tied burlap sack with a green sprout printed on it
    bearing       a silver ring with a dotted race of balls and a brass inner ring
    gearbox       a steel housing with a brass gear's teeth standing out of its top, a shaft
    produce       a lettuce head, frilly leaves, a pale heart
    sensor        an eye-lens on a dark chip with legs
    processor     a dark square chip with silver pins on all four sides and a brass die
    servo         a blue box with a white horn arm on its spline
    sandwich      bread, lettuce, tomato, cheese, bread
    clockworkFrog a tin frog squatting, a brass wind-up key in its back
    weatherBalloon a pale balloon on a line, a little brass instrument box
    umbrella      a red canopy with bone panels, a crook handle
    robotArm      an orange jointed arm on a base, a claw open at its end
    liftRotor     a two-blade rotor on a brass hub, foreshortened, red tips
    transmuterCoil a coil column on a base with a violet-glowing orb
    sandwichEngineer a tiny round-headed robot with big lamp eyes and an antenna, holding up a
                  sandwich, a little proud of it
"""
from PIL import Image, ImageDraw

from c3 import OUT, P, SRC_ART, grid, new, on_bg, scale, ship

ORDER = ["solvent", "sludge", "rubber", "battery", "fertilizer", "bearing", "gearbox", "produce", "sensor",
         "processor", "servo", "sandwich", "clockworkFrog", "weatherBalloon", "umbrella", "robotArm", "liftRotor",
         "transmuterCoil", "sandwichEngineer"]

K = {"k": P["ink"], "K": P["ink1"], "j": P["ink2"]}


def icon(rows, **key):
    return grid(rows, {**K, **{k: P[v] for k, v in key.items()}}, 8, 8)


ICONS = {
    # a round-bottomed flask with a ground-glass stopper (plastic is a conical bottle with a wide neck)
    "solvent": icon([
        "..kkk...",
        "..kbk...",
        "..kkkk..",
        "..kbsk..",
        ".kbLlLk.",
        "kbLLLLdk",
        "kLLLLddk",
        ".kkkkkk.",
    ], b="bone", s="steel3", L="lily", l="lamp3", d="moss4"),
    # a low wet puddle with a glob rising and a bubble ring: waste, wetter and greener than slag
    "sludge": icon([
        "........",
        "........",
        "..kk....",
        ".kMmk.kk",
        "kmmmkkRk",
        "kmEmmmkk",
        "kEmmEmdk",
        ".kkkkkk.",
    ], m="earth2", M="moss4", E="moss2", d="earth1", R="lily"),
    # dark grey rubber, a lit shoulder top-left and tread ticks, so it still reads on a dark belt
    "rubber": icon([
        "..kkkk..",
        ".kSSjtk.",
        "kSjkkjjk",
        "kSk..kjk",
        "ktk..kjk",
        "kjjkkjtk",
        ".ktjjtk.",
        "..kkkk..",
    ], S="steel2", j="steel0", t="ink2"),
    "battery": icon([
        "...kk...",
        "..kSsk..",
        ".kyYYOk.",
        ".kyYcOk.",
        ".kycYOk.",
        ".kyYYOk.",
        ".kjjjjk.",
        ".kkkkkk.",
    ], Y="lamp2", y="lamp3", O="lamp1", S="steel4", s="steel2", c="copper1", j="ink2"),
    "fertilizer": icon([
        "..k.kk..",
        "...kk...",
        "..kBBk..",
        "..kHWk..",
        ".kHWGwk.",
        "kHWGGWwk",
        "kWWWwwwk",
        ".kkkkkk.",
    ], H="wood5", W="wood4", w="wood3", G="moss3", B="brass1"),
    "bearing": icon([
        "..kkkk..",
        ".kWSWSk.",
        "kWbBBbSk",
        "kSB..Bdk",
        "kWB..Bdk",
        "kSbBBbdk",
        ".kSdSdk.",
        "..kkkk..",
    ], W="steel4", S="steel3", d="steel2", b="ink1", B="brass2"),
    # a brass gear standing half out of a steel housing, its hub on the lid
    # a steel housing with its shafts out of both sides and the brass gear's teeth in its lid
    "gearbox": icon([
        "........",
        ".kkkkkk.",
        ".kbjbjk.",
        "kkBBBBkk",
        "SkWWWWkS",
        "skSSSSks",
        ".kSSSdk.",
        ".kkkkkk.",
    ], B="brass1", b="brass3", j="brass0", W="steel4", S="steel3", s="steel2", d="steel2"),
    "produce": icon([
        ".k.kk.k.",
        "kGkllkGk",
        "kgGlLlgk",
        "kGgLLlGk",
        "kgGgLgGk",
        "kdgGgGdk",
        ".kdgdgk.",
        "..kkkk..",
    ], G="grass2", g="grass1", L="lily", l="grass3", d="grass0"),
    "sensor": icon([
        "..kkkk..",
        ".ktTTtk.",
        "kTTbkTTk",
        "kTTkkTTk",
        ".ktTTtk.",
        "kkkkkkkk",
        "kjjSjjjk",
        "k.k..k.k",
    ], T="water4", t="teal", b="bone", j="steel1", S="steel3"),
    "processor": icon([
        "..S.S...",
        ".kkkkkk.",
        "Skjjjjks",
        ".kjBbjk.",
        "Skjbbjks",
        ".kjjjjk.",
        ".kkkkkk.",
        "..s.s...",
    ], j="steel0", B="brass3", b="brass2", S="steel4", s="steel2"),
    "servo": icon([
        ".....kk.",
        "....kWWk",
        "...kWWk.",
        ".kkkSkk.",
        "kIiIIIk.",
        "kIkiiIk.",
        "kiiiiik.",
        ".kkkkk..",
    ], W="bone", S="steel3", I="iron2", i="iron1"),
    # half a sandwich, cut on the diagonal, its layers showing
    # sliced bread, crust and soft middle, lettuce frilling out of both sides, tomato, cheese
    "sandwich": icon([
        "........",
        ".kkkkkk.",
        "kHbbbbHk",
        "GgGGgGGg",
        "kRrRRrRk",
        "kYYyYYYk",
        "kHbbbbHk",
        ".kkkkkk.",
    ], H="wood4", b="bone", G="grass3", g="grass1", R="red", r="copper1", Y="lamp2", y="lamp1"),
    # a tin frog squatting, bug eyes, a brass wind-up key in its back
    "clockworkFrog": icon([
        "..k.k...",
        ".kbkbk..",
        "kMMMMMkB",
        "kMllMmkB",
        "kMMMMmkB",
        "kmMmmmBk",
        "kkmkkmkk",
        "........",
    ], M="moss4", m="moss3", l="lily", b="bone", B="brass2"),
    # a striped balloon on a line, the instrument box under it
    # a pale weather balloon, its line, the brass instrument box with a teal dial
    "weatherBalloon": icon([
        "..kkkk..",
        ".kbbBBk.",
        "kbbBBBdk",
        "kbBBBddk",
        ".kBddk..",
        "..kk....",
        "...kkk..",
        "..kStk..",
    ], b="bone", B="steel4", d="steel3", S="brass2", t="teal"),
    "umbrella": icon([
        "...kk...",
        ".kkRRkk.",
        "kRRbRRrk",
        "kRbRRbrk",
        "kkRkkrkk",
        "k..kk..k",
        "..kWk...",
        "..kk....",
    ], R="red", r="copper0", b="bone", W="wood3"),
    "robotArm": icon([
        ".kkk....",
        "kOOOk.kk",
        "kOSkOkSk",
        ".kkkOk.k",
        "...kOk..",
        "..kSSk..",
        ".kjjjjk.",
        ".kkkkkk.",
    ], O="lamp1", S="steel3", j="steel1"),
    # a helicopter rotor: two long flat blades on a brass hub, the can under it
    "liftRotor": icon([
        "........",
        "kkkk.kkk",
        "kRSSkSSk",
        "kkkkBkkk",
        "...kBk..",
        "..kBbBk.",
        "..kBBjk.",
        "...kkk..",
    ], R="red", S="steel4", B="brass2", b="brass3", j="brass1"),
    "transmuterCoil": icon([
        "l.kkk.l.",
        ".kVvVk..",
        ".kvlvk..",
        "..kkk...",
        ".kCCCk..",
        ".kcccK..",
        ".kCCCk..",
        "kSSSSSk.",
    ], V="violet", v="slag1", l="lamp3", C="copper2", c="copper0", S="steel3", K="ink"),
    # the Autonomous Sandwich Engineer: a round-headed little robot, big lamp eyes, an antenna,
    # holding its sandwich up beside its head
    # the Autonomous Sandwich Engineer: a little robot holding its sandwich up over its head,
    # arms up, lamp eyes and a grin
    "sandwichEngineer": icon([
        ".kkkkkk.",
        "kHbbbbHk",
        "GgRrYGgG",
        "kkSkkSkk",
        ".kSSSSk.",
        ".kLSSLk.",
        ".kSjjSk.",
        "..k..k..",
    ], S="steel3", L="lamp2", j="ink2", H="wood4", b="bone", G="grass3", g="grass1", R="red", r="copper1", Y="lamp2"),
}


def label_sheet(cells, names, k=8, cols=5, bg=P["pave2"]):
    """A contact sheet: each icon at k x on the paving, its name under it; plus a 1x strip."""
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
    ship("items3", cells, 0, extra={"names": ORDER}, look=8)
    sheet = label_sheet(cells, ORDER)
    # the 1x row on paving and on the Factory's steel, and the old icons beside them
    strip = new(len(cells) * 10 + 4, 24)
    for i, c in enumerate(cells):
        strip.alpha_composite(c, (2 + i * 10, 2))
    sheet.alpha_composite(scale(on_bg(strip, P["pave2"]), 2), (8, sheet.height - 38))
    sheet.save(OUT / "items3_sheet.png")
    # every icon so far, 1x and 3x, on paving and on steel: items, items2, items3
    allc = []
    for name, n in (("items", 10), ("items2", 12)):
        im = Image.open(SRC_ART / f"{name}.png").convert("RGBA")
        allc += [im.crop((i * 8, 0, i * 8 + 8, 8)) for i in range(n)]
    allc += cells
    W = len(allc) * 10 + 2
    cmp_ = Image.new("RGBA", (W, 24), (0, 0, 0, 0))
    for i, c in enumerate(allc):
        cmp_.alpha_composite(c, (1 + i * 10, 2))
    a = on_bg(cmp_, P["pave2"])
    b = on_bg(cmp_, P["steel1"])
    both = Image.new("RGBA", (W, 48))
    both.alpha_composite(a, (0, 0))
    both.alpha_composite(b, (0, 24))
    both.save(OUT / "items_all@1x.png")
    scale(both, 3).save(OUT / "items_all@3x.png")


if __name__ == "__main__":
    build()
