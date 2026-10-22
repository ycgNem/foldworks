"""Milestone 11's cosmetic skins (docs/endgame.md, "Milestone 11 skins as built"): `python build.py`
from this folder rebuilds every `src/art/skin_<id>_<base>` sheet and its sidecar, then the looks
(out/look_*.png), the contact sheet (out/contact_skins.png) and the pip-corner check.

    machines.py      the Workshop buildings: chrome, filigree, arcLight, trenchcoat, contraband,
                     mittens, ember, thrifty, spotless, vintage, circuitry, pinstripe, apron,
                     drillbit, lilypad, seedling
    belts.py         straightArrow and brassBelt: belt + belt_turn each
    modules.py       triad, pocketSquare, whittled, goldLeaf, blueprint, origami, postmark,
                     ghostly: one sheet per floor (module, dist_module, world_module, beyond_module)
    carriers.py      kite, tug, paperCrane (skiff); stormproof, feather (barge); mirrorBall (courier)
    destinations.py  the decorations: mayoral, bunting, sunburst (dock); specimen, mortarboard,
                     tinfoil (hopper)

Every pixel is the base sheet's, recoloured by a rule, or placed by these scripts; no PixelLab, no
SpriteCook. Palette B extended (69 art colours), none added; m11.skin refuses an off-palette or
semi-transparent pixel.
"""
import sys

import m11
import look11 as review

if __name__ == "__main__":
    import belts
    import carriers
    import destinations
    import machines
    import modules
    only = set(sys.argv[1:])
    for mod in (machines, belts, modules, carriers, destinations):
        if only and mod.__name__ not in only:
            continue
        print(mod.__name__)
        mod.build()
    for name, base in m11.SHIPPED:
        review.look(name, base)
    review.contact(m11.SHIPPED, review.OUT / ("contact_skins.png" if not only else f"contact_{'_'.join(sorted(only))}.png"))
    bad = review.pips(m11.SHIPPED)
    print("pip corner:", "calm in every sheet" if not bad else "\n  " + "\n  ".join(bad))
    print(len(m11.SHIPPED), "sheets")
