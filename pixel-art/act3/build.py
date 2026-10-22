"""Act III's art (docs/endgame.md, Milestone 7, "Art"): `python build.py` from this folder rebuilds
every sprite, writes each to out/ (with an enlarged look) and to src/art/ (<name>.png at 1x, frames
in rows, and the <name>.json sidecar), then the review looks (out/review_*.png, out/dplat_look.png,
out/items3_sheet.png) and the pip-corner check.

    items3.py     items3 (19 tier 3 icons, ITEM_IDS order) + out/items3_sheet.png
    machines3.py  chem_vat, greenhouse, chute_mouth (4 facings each), factory_chute
    mods3.py      dist_module, world_module, skiff, barge
    dests3.py     dist_dock, dist_hopper, dist_bay
    mega3.py      mega_city, mega_transmuter
    dplat.py      dist_deck, dist_edge, dist_under, dist_rotor, dist_rotor_side + out/dplat_look.png
                  (run last: its look puts the modules, skiffs and destinations on the platform)

Every pixel is placed by these scripts (no PixelLab draft; prompts.md logs that). The palette is
B extended (pixel-art/sky/pal.py); c3.ship refuses an off-palette or semi-transparent pixel and
any src/art name that is not Act III's own.
"""
import dests3
import dplat
import items3
import machines3
import mega3
import mods3
import review

if __name__ == "__main__":
    items3.build()
    machines3.build()
    mods3.build()
    dests3.build()
    mega3.build()
    dplat.build()
    review.machines()
    review.items()
    review.pips()
