"""Item icons, 8x8, hand-drawn for Lantern Bayou. Silhouette first (STYLE.md): ore is lumps,
ingots slanted bars, plates flat bevelled squares, wire a coil, gears teeth round a hole, slag a
crumbly heap, bricks a brick, the Gizmo its own odd box with an antenna. Colour second.
items.png holds ITEM_IDS 0-9, items2.png 10-21 (src/data/items.ts order)."""
from common import P, from_rows, export, scale, on_bg, new, OUT
from PIL import Image

o = P["ink"]

ORE = [
    ".ooo.oo.",
    "o322o21o",
    "o2211o0o",
    "o21100o.",
    ".o100a0o",
    "o2o1000o",
    "o10oo0o.",
    ".oo..oo.",
]
INGOT = [
    "........",
    "....ooo.",
    "..oo332o",
    "oo22221o",
    "o112210o",
    "o00110o.",
    ".oo00o..",
    "...oo...",
]
PLATE = [
    "........",
    ".oooooo.",
    "o333332o",
    "o322221o",
    "o322221o",
    "o221110o",
    ".oooooo.",
    "........",
]
WIRE = [
    "..oooo..",
    ".o2112o.",
    "o2o00o1o",
    "o1o33o0o",
    "o2o00o1o",
    "o1o33o0o",
    ".o2112o.",
    "..oooo..",
]
GEAR = [
    "..o..o..",
    ".o3oo3o.",
    "o322221o",
    ".21oo10.",
    ".21oo10.",
    "o211100o",
    ".o0oo0o.",
    "..o..o..",
]
SLAG = [
    "........",
    "...oo...",
    "..o21o..",
    ".o2110o.",
    "o21o010o",
    "o1100a0o",
    ".o0000o.",
    "..oooo..",
]
BRICK = [
    "........",
    "........",
    ".oooooo.",
    "o332322o",
    "o1o1221o",
    "o211o10o",
    ".oooooo.",
    "........",
]
GIZMO = [
    "......a.",
    ".....o.o",
    ".oooo.o.",
    "o3322o..",
    "o2bb10o.",
    "o2bb100o",
    "o11000o.",
    ".ooooo..",
]
SAND = [
    "........",
    "........",
    "...oo...",
    "..o32o..",
    ".o3221o.",
    "o322110o",
    "o211100o",
    ".oooooo.",
]
STEEL = [   # an I-beam end-on, bright
    "........",
    "oooooooo",
    "o333332o",
    "oo0220oo",
    ".o0210o.",
    "oo1210oo",
    "o111000o",
    "oooooooo",
]
GLASS = [   # a pane with a shine
    ".oooooo.",
    "o222221o",
    "o232111o",
    "o221311o",
    "o211131o",
    "o211113o",
    "o111110o",
    ".oooooo.",
]
GRAVEL = [
    "........",
    "...oo...",
    "..o21o..",
    ".oo10oo.",
    "o21oo21o",
    "o10oo10o",
    ".oo..oo.",
    "........",
]
CONCRETE = [  # a cinder block with two holes
    "........",
    ".oooooo.",
    "o333332o",
    "o2oo2o1o",
    "o2oo2o1o",
    "o211110o",
    ".oooooo.",
    "........",
]
PLASTIC = [  # a little moulded bottle
    "...oo...",
    "..o32o..",
    "..oo1o..",
    ".o3221o.",
    "o322110o",
    "o321110o",
    "o211100o",
    ".oooooo.",
]
CIRCUIT = [
    "o.o.o.o.",
    "oooooooo",
    "o2121a2o",
    "o1oooo1o",
    "o2o33o2o",
    "o1oooo1o",
    "o212b21o",
    "oooooooo",
]
KIT = [   # a crate with a gear stamp
    "oooooooo",
    "o222221o",
    "o2o33o1o",
    "o2o33o1o",
    "o222221o",
    "o000000o",
    "o211110o",
    "oooooooo",
]
MOTOR = [
    "........",
    ".ooooo..",
    "o33322oo",
    "o2bbb1o3",
    "o2bbb1o3",
    "o11100oo",
    ".ooooo..",
    "..o..o..",
]
OIL = [   # a drop
    "...o....",
    "..o2o...",
    "..o21o..",
    ".o2110o.",
    "o31100o.",
    "o21000o.",
    ".o000o..",
    "..ooo...",
]
DRILLBIT = [  # a spiral cone, point down-right
    "oooo....",
    "o33oo...",
    "o3o22o..",
    "oo21o1o.",
    ".o2o10o.",
    "..o10o0o",
    "...oo0oo",
    ".....oo.",
]
COAL = [
    "........",
    "..ooo...",
    ".o3a1oo.",
    "o2110a1o",
    "o1100o0o",
    "o10oo10o",
    ".oo..oo.",
    "........",
]


# The four ore icons match their deposits (the ore revamp, ores.py): still lumps by silhouette,
# each its own lump. Iron: an angular banded slab and a chip, blue tops, rust layers in the dark
# face. Copper: a bubbly verdigris crust with a native-copper nugget breaking out of the top.
# Coal: two jagged black shards with a cool sheen on their lit edges and an ember in the crack.
# Sand: a little dune heap, pale gold, its crest bone-bright and one ripple across it.
IRON_ORE = [
    "..ooo...",
    ".o332oo.",
    "o3221o2o",
    "o2211o1o",
    "oaaa0aao",
    "o0000o0o",
    ".oooo.o.",
    "........",
]
IRON_KEY = {"o": o, "3": P["steel3"], "2": P["iron2"], "1": P["iron1"], "0": P["steel0"], "a": P["copper1"]}
COPPER_ORE = [
    "...oo...",
    "..ohCo..",
    ".oTCkoo.",
    "oTttoTto",
    "otTttCto",
    "ottwttwo",
    ".owwwwo.",
    "..oooo..",
]
COPPER_KEY = {"o": o, "h": P["copper3"], "C": P["copper2"], "k": P["copper1"], "T": P["teal"], "t": P["water4"],
              "w": P["water3"]}
COAL_ORE = [
    "..o.....",
    ".oso....",
    ".osmo.o.",
    "osmmkoso",
    "osmkdsmo",
    "osmkdmko",
    ".omkekdo",
    "..oooooo",
]
COAL_KEY = {"o": o, "s": P["steel3"], "m": P["steel1"], "k": P["ink2"], "d": P["ink1"], "e": P["lamp1"]}
SAND_HEAP = [
    "........",
    "........",
    "........",
    "...ooo..",
    ".oo3bbo.",
    "o3r33r3o",
    "o2r22r1o",
    ".oooooo.",
]
SAND_KEY = {"o": o, "b": P["bone"], "3": P["brass3"], "2": P["wood5"], "r": P["brass2"], "1": P["brass1"]}


def ic(rows, r0, r1, r2, r3, a=None, b=None):
    return from_rows(rows, {"o": o, "0": r0, "1": r1, "2": r2, "3": r3, "a": a, "b": b})


IRON = (P["iron0"], P["iron1"], P["iron2"], P["steel4"])
COPPER = (P["copper0"], P["copper1"], P["copper2"], P["copper3"])
STEEL_R = (P["steel1"], P["steel2"], P["steel3"], P["steel4"])

ICONS = {
    "ironOre": from_rows(IRON_ORE, IRON_KEY),
    "copperOre": from_rows(COPPER_ORE, COPPER_KEY),
    "ironIngot": ic(INGOT, *IRON),
    "copperIngot": ic(INGOT, *COPPER),
    "slag": ic(SLAG, P["slag0"], P["slag1"], P["violet"], P["violet"], a=P["lamp1"]),
    "ironPlate": ic(PLATE, *IRON),
    "copperWire": ic(WIRE, P["copper0"], P["copper1"], P["copper2"], P["lamp2"]),
    "gear": ic(GEAR, *STEEL_R),
    "slagBrick": ic(BRICK, P["slag0"], P["slag1"], P["violet"], P["bone"]),
    "gizmo": ic(GIZMO, P["brass1"], P["brass2"], P["brass3"], P["lamp3"], a=P["red"], b=P["teal"]),
    "coal": from_rows(COAL_ORE, COAL_KEY),
    "sand": from_rows(SAND_HEAP, SAND_KEY),
    "steel": ic(STEEL, P["steel0"], P["steel2"], P["steel3"], P["bone"]),
    "glass": ic(GLASS, P["water3"], P["water4"], P["teal"], P["bone"]),
    "gravel": ic(GRAVEL, P["steel1"], P["steel2"], P["steel3"], P["steel4"]),
    "concrete": ic(CONCRETE, P["earth2"], P["earth3"], P["steel3"], P["steel4"]),
    "plastic": ic(PLASTIC, P["slag0"], P["slag1"], P["violet"], P["bone"]),
    "circuit": ic(CIRCUIT, P["moss1"], P["moss3"], P["moss5"], P["brass3"], a=P["lamp2"], b=P["red"]),
    "machineKit": ic(KIT, P["wood1"], P["wood2"], P["wood4"], P["brass3"]),
    "motor": ic(MOTOR, P["steel1"], P["steel2"], P["steel3"], P["steel4"], b=P["copper2"]),
    "oil": ic(OIL, P["ink"], P["ink2"], P["slag0"], P["violet"]),
    "drillBit": ic(DRILLBIT, P["brass1"], P["brass2"], P["brass3"], P["lamp3"]),
}
ORDER = ['ironOre', 'copperOre', 'ironIngot', 'copperIngot', 'slag', 'ironPlate', 'copperWire', 'gear', 'slagBrick', 'gizmo',
         'coal', 'sand', 'steel', 'glass', 'gravel', 'concrete', 'plastic', 'circuit', 'machineKit', 'motor', 'oil', 'drillBit']


def build():
    for row in ICONS.values():
        assert row.size == (8, 8)
    export("items", [ICONS[k] for k in ORDER[:10]])
    export("items2", [ICONS[k] for k in ORDER[10:]])
    # a look at 1x on the deck and on a belt, and at 8x
    sheet = Image.new("RGBA", (len(ORDER) * 10 + 2, 12), (158, 106, 66, 255))
    for i, k in enumerate(ORDER):
        sheet.alpha_composite(ICONS[k], (2 + i * 10, 2))
    scale(sheet, 8).save(OUT / "items_look@8x.png")
    sheet.save(OUT / "items_look.png")


if __name__ == "__main__":
    build()
