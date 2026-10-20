# B, "Lantern Bayou": PixelLab prompts and settings

Palette: new, 48 colours (`palette.hex`, `palette.json`, `palette_swatch.png`; the source of truth
is `../palettes.py`): violet-leaning night inks, five teal-green waters, six mosses, five warm
woods, four earths, five cool steels, iron, copper, four lantern lights, four brasses, slag, bone,
lily, red.

## Generations (phase 1, this direction: 27)

| What | Tool | Settings | Cost | Id |
|---|---|---|---|---|
| Water to grass | `create_topdown_tileset` standard | lower "deep teal-green bayou water at dusk with soft ripples", upper "lush mossy bayou grass with small ferns", transition "dark mud bank with reeds" 0.25, 16 px, high top-down, lineless, medium shading, medium detail | 3 | `f5d1896f-8dc3-4f59-972a-2ab7302a7f8b` |
| Grass to floor | standard, chained | upper "warm worn wooden plank deck floor, dark brown boards", transition 0 | 3 | `f31a1448-5f5e-490e-a99a-e569d0982915` |
| 16 px set | `create_1_direction_object` size 16, palette B | base "cosy factory game sprite, lantern-lit bayou workshop at dusk, warm wood, brass and glowing lanterns, readable silhouette" + the same 32 descriptions as A (lantern: "small paper lantern on a post, glowing") | 10 | `baf0b477-bfc6-4c43-a027-758cf9b4e6bf` |
| 32 px set | size 32, palette B | same 24 descriptions as A with lanterns added to docks and houses | 10 | `72bde145-7f60-45ca-a194-1da13c9b393d` |
| Bramble 48x48 | `create_image_pixflux`, forced palette B | A's prompt + "warm lantern light from the side" | 1 | `4d753619-a3d5-4825-84a2-1a370aab34b9` |

## What is PixelLab's and what is hand work

- PixelLab, B's own: bank shapes, smelter (B16 #5), Dock (B32 #2, the lantern market), lamp, reeds,
  lilies, the portrait (its bowler was raised into a top hat by `lib.hat_lift`).
- **B's dark palette made PixelLab's drafts muddy**: the 32 px houses came out brown-on-brown with
  a dark blot of water baked under them, and the miner was a smudge. The houses and the miner in
  the scene are A's drafts from the same prompts, swapped into B colour by colour (`A_TO_B`).
- Hand: plank floor (boards, seams, the odd darker old board), water with lantern streaks, moss,
  ore patch, belt, icons, module tile, shadows, lantern light pools, unowned land.
