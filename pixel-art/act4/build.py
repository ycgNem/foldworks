"""Act IV's art (docs/endgame.md, Milestone 9, "The contract for building Milestone 9"):
`python build.py` from this folder rebuilds every sprite, writes each to out/ (with an enlarged
look) and to src/art/ (<name>.png at 1x, frames in one row, and the <name>.json sidecar), then the
looks and the pip-corner check.

    items4.py     items4 (the 15 tier 4 icons, contract order, with names) + out/items4_sheet.png
    machines4.py  heater, vent, rubble, ruin_overlay, frost_overlay
    ores4.py      ore_skyglass, ore_cinderite, ore_rime, ore_relic (+ _spill) + out/ores4_look@4x.png
    isles.py      the four island looks: isle_<pebble|cinder|rime|oldworks>_* (isletools.vname)
    wplat.py      world_deck, world_edge, world_under, world_rotor, world_rotor_side, world_dock,
                  world_hopper, world_bay + out/wplat_look@2x.png (beside the District)
    mega4.py      mega_lighthouse, mega_anchor
    ui4.py        world, legacy, relocate appended to ui_icons / ui_icons_small (36, 37, 38)
    islandmock.py the island assembler (a port of island.ts + ground.ts) for the mocks
    look4.py      out/look4_*: every island with its rule on the ground, beside Home
    review4.py    out/review4_*: machines, overlays and icons on their floors; the pip check

Every pixel is placed by these scripts or derived by rule from Home's own sheets; no PixelLab
(prompts.md logs that). Palette B extended, 69 colours, none added; c4.ship refuses an
off-palette or semi-transparent pixel and any src/art name that is not Act IV's.
"""
import importlib
import subprocess
import sys

if __name__ == "__main__":
    for mod in ("items4", "machines4", "ores4", "isles", "wplat", "mega4"):
        print(mod)
        importlib.import_module(mod).build()
    subprocess.run([sys.executable, "ui4.py"], check=True)
    import look4
    import review4
    look4.build()
    review4.machines()
    review4.items()
    review4.pips()
