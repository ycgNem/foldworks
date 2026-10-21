"""Bramble's Town art, the sky island edition:   python build.py [house boardwalk rail lamp ...]

Exports to src/art/ (1x strip + JSON sidecar, palette-checked, anchors [0, 0]):
    town_house      32x32 x6  fps 0   frog houses on stone footings (order: hut gable lily tall brick bramble)
    town_boardwalk  16x16 x13 fps 0   the promenade's deck (named, see boardwalk.py; the game uses h, end_w, end_e)
    town_rail       16x16 x3  fps 0   the promenade's railing, drawn in front of the frogs (order: h end_w end_e)
    town_lamp       16x32 x4  fps 6   a lamp post on the promenade, its lantern flickering
    town_stall      32x32 x4  fps 6   a Gizmo Festival stall, its awning and pennants in the wind
    town_frog       16x16 x4  fps 8   a frog townsperson walking right (flipped at draw time for left)
    town_unit7      32x48 x4  fps 4   Unit 7's observatory on a riveted plinth: turning dish, blinking antenna
    town_voltaire   32x48 x4  fps 8   Dame Voltaire's turbine pavilion on marble steps
    town_tuft       16x8  x4  fps 0   grass tufts the Workshop puts at a house's foot (the Factory's deck has none)
town_lily (lily.py) is out of use since the swamp went: the file stays, nothing draws it.
Writes out/<name>_1x.png (on meadow, and on steel) and _<k>x.png previews; mock.py composes the
town on the island's meadow and the Factory's deck.
"""
import sys
import houses
import boardwalk
import lamp
import stall
import frog
import unit7
import voltaire
from common_town import export

ONLY = set(sys.argv[1:])


def want(k):
    return not ONLY or k in ONLY


def main():
    if want("house"):
        export(houses.build(), "town_house", 0, order=houses.ORDER, scale=8)
    if want("boardwalk"):
        export(boardwalk.build(), "town_boardwalk", 0, order=boardwalk.ORDER, scale=8)
    if want("rail"):
        export(boardwalk.build_rail(), "town_rail", 0, order=boardwalk.RAIL_ORDER, scale=8)
    if want("tuft"):
        export(boardwalk.build_tuft(), "town_tuft", 0, scale=8)
    if want("lamp"):
        export(lamp.build(), "town_lamp", 6, scale=8)
    if want("stall"):
        export(stall.build(), "town_stall", 6, scale=8)
    if want("frog"):
        export(frog.build(), "town_frog", 8, scale=12)
    if want("unit7"):
        export(unit7.build(), "town_unit7", 4, scale=6)
    if want("voltaire"):
        export(voltaire.build(), "town_voltaire", 8, scale=6)


if __name__ == "__main__":
    main()
