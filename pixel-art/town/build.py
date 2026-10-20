"""Bramble's Town art:   python build.py

Exports to src/art/ (1x strip + JSON sidecar, palette-checked, anchors [0, 0]):
    town_house      32x32 x6  fps 0   frog houses on stilts (order: hut gable lily tall brick bramble)
    town_boardwalk  16x16 x10 fps 0   boardwalk tiles over water (named, see boardwalk.py)
    town_lamp       16x32 x4  fps 6   a lamp post on a piling, lit flicker
    town_stall      32x32 x4  fps 6   a festival stall with bunting and Gizmos
    town_frog       16x16 x4  fps 8   a frog townsperson walking right (flip at draw time for left)
    town_unit7      32x48 x4  fps 4   Unit 7's observatory: turning dish, blinking antenna
    town_voltaire   32x48 x4  fps 8   Dame Voltaire's turbine pavilion
    town_lily       16x16 x6  fps 0   lily pads and reeds to scatter (named)
Writes out/<name>_1x.png and _<k>x.png previews, out/mock_town_*.png (the town over the real
water and shore tiles) and contact.png.
"""
import sys
import houses
import boardwalk
import lamp
import stall
import frog
import lily
import unit7
import voltaire
from common_town import export

ONLY = set(sys.argv[1:])


def main():
    if not ONLY or "house" in ONLY:
        export(houses.build(), "town_house", 0, order=houses.ORDER, scale=8)
    if not ONLY or "boardwalk" in ONLY:
        export(boardwalk.build(), "town_boardwalk", 0, order=boardwalk.ORDER, scale=8)
    if not ONLY or "lamp" in ONLY:
        export(lamp.build(), "town_lamp", 6, scale=8)
    if not ONLY or "stall" in ONLY:
        export(stall.build(), "town_stall", 6, scale=8)
    if not ONLY or "frog" in ONLY:
        export(frog.build(), "town_frog", 8, scale=12)
    if not ONLY or "unit7" in ONLY:
        export(unit7.build(), "town_unit7", 4, scale=6)
    if not ONLY or "voltaire" in ONLY:
        export(voltaire.build(), "town_voltaire", 8, scale=6)
    if not ONLY or "lily" in ONLY:
        export(lily.build(), "town_lily", 0, order=lily.ORDER, scale=8)


if __name__ == "__main__":
    main()
