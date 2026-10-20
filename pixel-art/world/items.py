"""Item icons, 8x8, silhouette first (STYLE.md): ore = lumps, ingots = bars, plates = flat
squares, gears = teeth and a hole, wire = a coil on a spool, slag = a holed cake, the Gizmo = its
own odd box. Ink outline, light from the top-left. Colour is the second cue, never the only one.
"""
from fw import new, blit, export

ITEMS1 = ["ironOre", "copperOre", "ironIngot", "copperIngot", "slag", "ironPlate", "copperWire",
          "gear", "slagBrick", "gizmo"]
ITEMS2 = ["coal", "sand", "steel", "glass", "gravel", "concrete", "plastic", "circuit",
          "machineKit", "motor", "oil", "drillBit"]

ICONS = {
    # ---------------------------------------------------------------- Act I
    "ironOre": [            # four round blue lumps
        "..##.##.",
        ".#eb#eb#",
        "#3bba#a#",
        "#bba#eb#",
        ".#a#eba#",
        "#eb#baa#",
        "#ba#aa#.",
        ".##.##..",
    ],
    "copperOre": [          # one craggy nugget with a verdigris streak
        "...##...",
        ".##po#..",
        "#ppoo###",
        "#poorpo#",
        ".#oTror#",
        "#ooTTrr#",
        "#rorrr#.",
        ".#####..",
    ],
    "ironIngot": [          # a slanted bar, top face lit
        "........",
        "..######",
        ".#3eeee#",
        "#3eeeb##",
        "#bbbbba#",
        "#bbbba#.",
        "#aaaa#..",
        "######..",
    ],
    "copperIngot": [  # a symmetric trapezoid bar (iron's is slanted)
        "........",
        "........",
        "..####..",
        ".#zppo#.",
        "#poooor#",
        "#ooooor#",
        "#rrrrrr#",
        "########",
    ],
    "slag": [               # a holed, drippy cake
        "........",
        "..####..",
        ".#VVnn#.",
        "#Vn#nn0#",
        "#nnnn#0#",
        "#n0nn00#",
        ".#0##0#.",
        "..#..#..",
    ],
    "ironPlate": [          # a flat square with a diagonal sheen and a thick edge
        "........",
        ".######.",
        "#3eeeeb#",
        "#ebbbeb#",
        "#ebbebb#",
        "#ebebba#",
        "#aaaaaa#",
        ".######.",
    ],
    "copperWire": [         # wire coiled on a little steel spool, loose end up
        ".#...p#.",
        "#2####o#",
        "#2pppo2#",
        "#2orrr2#",
        "#2pppo2#",
        "#2orrr1#",
        "#2####1#",
        ".#....#.",
    ],
    "gear": [               # eight teeth and a real hole
        ".3.32.1.",
        "33332211",
        ".33##21.",
        "32#..#10",
        "32#..#10",
        ".21##10.",
        "22211100",
        ".2.10.0.",
    ],
    "slagBrick": [          # a squared brick, stamped
        "........",
        "........",
        ".######.",
        "#VVVVVn#",
        "#nnnnnn#",
        "#n0nn0n#",
        "#000000#",
        ".######.",
    ],
    "gizmo": [  # a brass box, a dial, a red button, an antenna, little feet
        "....#x#.",
        ".....#..",
        ".######.",
        "#zWWWyy#",
        "#yW#Woy#",
        "#yWW#uu#",
        ".######.",
        ".#....#.",
    ],
    # ---------------------------------------------------------------- Act II
    "coal": [               # black lumps with steel glints
        "...###..",
        "..#s2s#.",
        ".#s3ss##",
        "#ss#s2s#",
        "#s2ss#s#",
        "#ss#s0s#",
        ".#ssss#.",
        "..####..",
    ],
    "sand": [               # a pale pile
        "........",
        "........",
        "...##...",
        "..#WW#..",
        ".#W33h#.",
        "#W33h3h#",
        "#3h3hhg#",
        "########",
    ],
    "steel": [              # the ingot shape, dark, with a bright sheen
        "........",
        "..######",
        ".#bbW1b#",
        "#bbWb1##",
        "#a1aaa0#",
        "#1aaa0#.",
        "#0000#..",
        "######..",
    ],
    "glass": [              # a pale teal pane with reflections
        "...#####",
        "..#WTTT#",
        "..#TWTt#",
        ".#TTTWt#",
        ".#TWTtt#",
        "#TTWtt#.",
        "#tttt#..",
        "#####...",
    ],
    "gravel": [             # a little heap of round grey pebbles
        "...###..",
        "..#321#.",
        ".##210##",
        "#32##32#",
        "#210#21#",
        "#10##10#",
        ".######.",
        "........",
    ],
    "concrete": [  # a cinder block: two holes
        "........",
        "########",
        "#323323#",
        "#2ss2ss#",
        "#2ss2ss#",
        "#212221#",
        "#111111#",
        "########",
    ],
    "plastic": [  # three colourful pellets
        "........",
        ".##..##.",
        "#WV##zx#",
        "#VV##xo#",
        ".##..##.",
        "..##....",
        ".#WT#...",
        "..##....",
    ],
    "circuit": [            # green board, brass traces, pins
        "........",
        "########",
        "#vyvvlv#",
        "#vy##yv#",
        "#yy##vv#",
        "#vlvyyv#",
        "########",
        ".#.#.#..",
    ],
    "machineKit": [         # a little red toolbox with a handle and a latch
        "..####..",
        "..#..#..",
        "########",
        "#pooooo#",
        "#oooyoo#",
        "########",
        "#rrrrrr#",
        "########",
    ],
    "motor": [              # steel caps, copper windings, a shaft out the side
        "........",
        ".#####..",
        "#32221#.",
        "#popor##",
        "#opopr3#",
        "#popor##",
        "#10000#.",
        ".#####..",
    ],
    "oil": [  # a dark drop with an oil-slick sheen
        "...#....",
        "..#s#...",
        ".#sVs#..",
        "#sTVss#.",
        "#Vsss0#.",
        "#ss000#.",
        ".#000#..",
        "..###...",
    ],
    "drillBit": [  # a fluted bit: brass shank, spiral flutes, a point
        "..####..",
        "..#yy#..",
        "..#uu#..",
        ".#0310#.",
        ".#1031#.",
        ".#3103#.",
        "..#31#..",
        "...##...",
    ],
}


def icon(name):
    s = new(8, 8)
    rows = [r[:8] for r in ICONS[name]]
    assert len(rows) == 8, name
    blit(s, 0, 0, rows)
    return s


def strip_sprite(names):
    s = new(8, 8, len(names))
    for i, n in enumerate(names):
        s.frame(i + 1)
        blit(s, 0, 0, [r[:8] for r in ICONS[n]])
    s.frame(1)
    return s


def build():
    export("items", strip_sprite(ITEMS1), 0, preview_bg="belt")
    export("items2", strip_sprite(ITEMS2), 0, preview_bg="belt")
