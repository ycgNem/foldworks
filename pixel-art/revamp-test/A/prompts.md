# A, "Foundry, remastered": PixelLab prompts and settings

Palette: `src/data/palette.ts` palette A, the 27 art colours (the 5 pip colours are code-drawn and
were left out). `palette.hex` / `palette.json` here. Shared files: `../palettes.py`, `../lib.py`,
`../fetch.py` (downloads into `../raw/`), `../contact.py`.

## Generations (phase 1, this direction: 27)

| What | Tool | Settings | Cost | Id |
|---|---|---|---|---|
| Water to grass | `create_topdown_tileset` standard | lower "dark night swamp water, deep blue and teal with faint ripples", upper "dark mossy swamp grass bank", transition "muddy reed bank" 0.25, 16 px, high top-down, lineless, medium shading, medium detail | 3 | `1c928a8c-86e7-4e7c-9d2e-ea9c917b70b6` |
| Grass to floor | `create_topdown_tileset` standard, chained (`lower_base_tile_id` = the grass above) | upper "packed brown earth workshop floor with small pebbles and scuffs", transition 0 | 3 | `85ec24d7-8bb3-4b2f-8a12-6e35233a42c2` |
| 16 px set (64 candidates) | `create_1_direction_object` size 16, top-down, palette A | base "cosy factory game sprite, dark steel and warm brass, workshop at night, readable silhouette" + 32 item descriptions (4 miners, 4 smelters, 2 belts, 3 module frames, ores, ingots, gears, wire, plate, ore patches, slag, press, assembler, crate, lantern, reeds, lily) | 10 | `0bf07fda-f6e7-43bd-a66c-2af83bcaaf60` |
| 32 px set (64 candidates) | `create_1_direction_object` size 32, top-down, palette A | base "...swamp workshop at night..." + 24 descriptions (6 docks, 6 stilt houses, 3 big miners, 3 big smelters, 2 hoppers, 2 frog mayors, 2 module blocks) | 10 | `428b026e-310d-4cdb-a602-f3e385606f8f` |
| Bramble 48x48 | `create_image_pixflux` 48x48, transparent, single colour black outline, medium shading/detail, facing south, forced palette = palette A swatch | "character portrait bust of a friendly green frog mayor wearing a black top hat, a red sash across his chest and a shiny gold badge, big eyes, smiling, facing the viewer" | 1 | `9913092b-f9ad-4bb8-be85-775157c61f22` |

Standard tilesets refuse `palette` (pro only, 15 each), so both sets were recoloured by hand in
`build.py` (`lib.remap_by_groups`: classify each colour by hue, rank by lightness, split onto a
palette ramp at chosen shares).

## What is PixelLab's and what is hand work

- PixelLab: the shore and bank shapes and their edge shading, the miner (A16 #0), the smelter
  (A16 #6), the Dock (A32 #0), the houses (A32 #7, #6, #11), lamp, reeds, lily, the portrait.
- Hand (in `build.py` / `../lib.py`): the water, grass and earth interiors re-textured with global
  noise (no 16 px repeat), ragged grass edges with a shadow lip, the ore patch, the belt, the three
  8x8 item icons, the module tile (PixelLab's frames were too thin), contact shadows, light pools,
  ripples at the houses' feet, the unowned land (one step darker, hatched, dashed edge).
