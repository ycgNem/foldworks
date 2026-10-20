# C, "Daylight Workshop": PixelLab prompts and settings

Palette: new, 47 colours (`palette.hex`, `palette.json`, `palette_swatch.png`; source of truth
`../palettes.py`): two inks, five turquoise waters, five leaf greens, five sandstone floors, three
woods, five clean steels, saturated iron blue, copper, heat, four brasses, red, slag, pink, white.

## Generations (phase 1, this direction: 27)

| What | Tool | Settings | Cost | Id |
|---|---|---|---|---|
| Water to grass | `create_topdown_tileset` standard | lower "bright sunlit turquoise swamp water with small lily pads", upper "sunny bright green grass meadow", transition "sandy reed shore" 0.25, 16 px, high top-down, lineless, medium shading, medium detail | 3 | `46b9f359-a26c-4139-a972-9d1edad65db0` |
| Grass to floor | standard, chained | upper "pale warm sandstone paving slabs, sunlit workshop yard", transition 0 | 3 | `403ccda6-d6cc-4eca-beb6-ae715960a143` |
| 16 px set | `create_1_direction_object` size 16, palette C | base "bright cheerful factory game sprite, sunlit daytime workshop, clean painted steel, crisp saturated colours, readable silhouette" + A's 32 descriptions (miner "painted yellow steel", belt "grey belt with yellow chevrons", lily "with a pink flower") | 10 | `a9b2e607-0499-4e5a-8dff-9dbf70bc11eb` |
| 32 px set | size 32, palette C | A's 24 descriptions, sunny variants (striped awning dock, red tile roof, teal roof, bunting) | 10 | `26d18345-e80a-49a3-8f75-7bed08aea06e` |
| Bramble 48x48 | `create_image_pixflux`, forced palette C | A's prompt with "bright green" and "sunny daylight" | 1 | `68c45ee1-c1d0-4682-9abe-310255808947` |

## What is PixelLab's and what is hand work

- PixelLab, all C's own: shore with foam, bank shapes, the yellow miner (C16 #0), smelter (C16 #5),
  the striped-awning Dock (C32 #2), houses (C32 #7, #8, #11, #9), lamp, reeds, lilies, portrait
  (crown raised 4 rows by `lib.hat_lift`).
- Hand: sandstone slabs, water ripples and glints, grass, ore patch, belt, icons, module tile, hard
  noon shadows (2 px down-right), foam rings round the stilts, unowned land.
