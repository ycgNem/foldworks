"""Act V's art (docs/endgame.md, Milestone 10, "The contract for building Milestone 10"):
`python build.py` from this folder rebuilds every sprite, writes each to out/ (with an enlarged
look) and to src/art/ (<name>.png at 1x, frames in one row, and the <name>.json sidecar), then the
looks and the pip-corner check.

    seed.py      seed (16x16 x4, 4 fps: the World folded into a floating island over a brass dish)
    items5.py    items5 (the 8 tier 5 icons, contract order, with names) + out/items5_sheet.png
    courier.py   courier (16x12 x4, 8 fps, anchor (8, 11): a paper crane carrying a parcel)
    bplat.py     beyond_deck, beyond_edge, beyond_under, beyond_rotor, beyond_rotor_side,
                 beyond_module, beyond_dock, beyond_hopper, beyond_bay + out/bplat_look@2x.png
                 (Beyond beside the World, from the real sheets)
    lastfold.py  lastfold (128x72 x16, per-frame durations, loop 14-15) + out/lastfold_sheet@2x.png
    skins.py     skin_gilded_miner, skin_candy_press(_mk2), skin_starlit_assembler(_mk2)
    ui5.py       kernel, beyond, lastFold, ledger appended to ui_icons / ui_icons_small (39-42)
    review5.py   out/review5_*: items on belts, floors and module wells; the Seed on the paving;
                 the skins beside their bases; the pip check

Every pixel is placed by these scripts (or recoloured by rule from the base machine sheets for the
skins); no PixelLab (prompts.md logs that). Palette B extended, 69 colours, none added; c5.ship
refuses an off-palette or semi-transparent pixel and any src/art name that is not Act V's.
"""
import importlib

import review5

if __name__ == "__main__":
    for mod in ("seed", "items5", "courier", "bplat", "lastfold", "skins", "ui5"):
        print(mod)
        m = importlib.import_module(mod)
        m.build()
        if mod == "bplat":
            m.look()
    review5.items()
    review5.seed()
    review5.skins()
    review5.pips(["seed", "beyond_module", "beyond_dock", "beyond_hopper", "beyond_bay", "skin_gilded_miner",
                  "skin_candy_press", "skin_candy_press_mk2", "skin_starlit_assembler", "skin_starlit_assembler_mk2",
                  "miner", "press", "assembler", "press_mk2", "assembler_mk2"])
