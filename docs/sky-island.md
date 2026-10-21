# The sky island: the world redesign (2026-10-21)

The owner: *"full redesign the way the gameplay/game looks, the planks and worlds … the
surrounding ocean isn't gonna cut it, I'm thinking Cookie Clicker combined with those factory
Roblox games, tycoon things, Miner's Haven … 300 PixelLab limit, run autonomously."* Asked, they
picked **a floating sky island** and **palette B extended** (its 51 colours kept, so machines and
items stay as they are; new colours added for the world). Machines, items, the Dock, the Hopper,
the cast and the HUD keep their art ("you can use the same models").

## What we take from the references (and what we don't)

The feel, not the pieces (CLAUDE.md: flag anything derivative; Cookie Clicker heads the not-list):

- **Tycoon bases (Roblox factory tycoons, Miner's Haven)**: a plot you can see whole, that visibly
  grows as you buy it; bright, chunky, saturated, readable from far; your base floats in an open
  world with other plots on the horizon; buying land is an event (the plot builds itself in).
  Not taken: Roblox studs and baseplates, Miner's Haven's droppers, upgraders and neon conveyor
  look, buy-pads you walk onto.
- **Cookie Clicker**: warmth, constant gentle motion behind the play, every action answered by a
  pop. Not taken: the big cookie, milk, the building rows, its wallpaper backgrounds.

## The look in one line

**A bright, sunlit island of grass and warm paving floating over a sea of clouds, its cliff
sides striped with the ores it holds and waterfalls pouring off into the clouds, other islands
drifting on the horizon; the plot you own is paved, the land for sale is meadow with a plot
marked out on it; the Factory is a riveted sky platform held up by brass rotors, higher up.**

## Layers (back to front)

1. **The sky** (screen space, `src/render/sky.ts`): a vertical gradient (zenith to a pale, warm
   horizon), a soft sun glow top-left; two cloud layers that drift slowly sideways and move with
   the camera at parallax 0.15 and 0.35; far islets on the horizon (parallax 0.1, tiny, hazed
   toward the sky colour, one or two with a waterfall thread); an occasional bird flock or a
   balloon crossing. The Factory's sky is higher: a deeper zenith, the cloud sea closer below, and
   the Workshop island visible far below through a gap.
2. **The island body** (world space, `src/render/island.ts`, baked to a canvas per floor and
   size): the grass **rim** around the plot (wide enough on the north for the town, organic edge,
   never a rectangle), the **cliff face** under the south edge (3/4 view: the south face shows,
   4-5 tiles tall: a grass overhang at the lip, earth strata, roots, the island's ores as veins
   with glints), the **underside** tapering in tiers to a rocky point, **waterfalls** (animated)
   from notches in the south lip into the clouds, and a shadow on the clouds below.
3. **The ground** (`src/render/ground.ts`, baked per chunk): **owned** chunks are paving,
   **for sale** chunks are meadow with a plot marked out (corner stakes and a dashed line), chunk
   seams on owned land a thin bolted strip, so lots read as lots.
4. **The town** on the north rim (houses on footings, not stilts; the boardwalk becomes a paved
   promenade with lamps), trees, bushes, flowers and fences scattered on the rim (never on the
   plot).
5. Everything that was there: ores, belts, machines, the Dock, the Hopper, FX, floor tags, HUD.

## Palette: B extended ("Lantern Bayou, with the sky")

Appended after the pips in `PALETTE` (indices never move; `theme.ts` reads `PALETTE[40]`), named in
`C` and in `pixel-art/sky/pal.py`. Proposed (the style test tunes them, then they are fixed):

| ramp | slots | proposed |
|---|---|---|
| sky | `sky0`..`sky4` (zenith to horizon) | `#3a78d4` `#5893e3` `#7fb2ee` `#a9d0f5` `#d4ebfb` |
| cloud | `cloud0`..`cloud3` (deep shade to lit) | `#9cb4da` `#c3d6ef` `#e6f0fb` `#ffffff` |
| grass | `grass0`..`grass3` | `#2f6e36` `#4c9a3e` `#73c14e` `#a3dd68` |
| paving | `pave0`..`pave3` (grout to lit) | `#7d7468` `#a3988a` `#c4b8a5` `#ddd2bd` |
| sun | `sun` (horizon glow) | `#ffe9c2` |

Rules: the paving must stay apart from the paper (`bone` `#eee2c6`) so floor tags read on it, and
dark enough that steel base plates and belts pop; grass is brighter than `moss` (moss stays the
swampy accent); the sky's lightest step sits under the horizon only.

## Art contract (names the code looks for; every piece optional, code draws a fallback)

All in `src/art/` as `<name>.png` + `<name>.json` (`{frame:[w,h], frames, anchor, fps, names?}`),
made by scripts in `pixel-art/sky/`.

| name | frame | frames | what |
|---|---|---|---|
| `tile_pave` | 16x16 | 4+ | owned floor variants (the code picks by hash) |
| `tile_pave_seam` | 16x16 | 4 | a chunk seam strip on owned land, edge N, E, S, W |
| `tile_grass` | 16x16 | 4+ | meadow variants (for-sale land and the rim) |
| `tile_grass_deco` | 16x16 | 8+ | sparse overlays: flowers, tufts, a pebble (rim and meadow) |
| `tile_plot` | 16x16 | 9 | the plot outline on for-sale land: corners NW N NE W (none) E SW S SE |
| `isle_edge` | 16x16 | 16 | the rim's edge into the sky, by 4-bit neighbour mask (N=1 E=2 S=4 W=8 = land there) |
| `isle_cliff` | 16x16 | 12 | the south face: rows top (lip/overhang), mid, low, each 4 variants |
| `isle_vein` | 16x16 | 4 per ore | ore veins on the cliff (`names`: iron0..3, copper0..3, coal0..3, sand0..3) |
| `isle_under` | 16x16 | 12 | the underside: left edge, fill, right edge, 4 variants each |
| `isle_tip` | 48x32 | 1 | the rocky point at the bottom |
| `isle_fall` | 16x32 | 4 | a waterfall segment, animated (fps 8); `isle_fall_foam` 32x16 x4 where it meets clouds |
| `sky_cloud` | 64x32 | 6 | cloud puffs (big, medium, small x2) |
| `sky_islet` | 64x48 | 4 | far islands (pre-hazed) |
| `sky_bird` | 8x8 | 4 | a flapping bird (fps 8) |
| `prop_tree` | 32x32 | 4 | trees for the rim (anchor at the trunk foot) |
| `prop_bush` | 16x16 | 4 | bushes, rocks, a flower bed |
| `prop_fence` | 16x16 | 4 | rim-edge fence (h, v, post, gate) |
| `town_*` | as now | as now | the town's sprites, re-seated on footings (same names and frames) |
| `fplat_edge` | 16x16 | 16 | the Factory platform's girder rim, by 4-bit mask |
| `fplat_under` | 16x16 | 6 | the platform's truss underside |
| `fplat_rotor` | 48x24 | 4 | a brass rotor pod under the platform, spinning (fps 12) |
| `tile_ore_*` | as now | as now | the ores, re-seated on paving and grass (the outcrop's corners no longer show planks) |
| `title_scene` | 320x180 | 8 | the title key art: the island at morning |

## Code contract

- `sky.ts`: `drawSky(ctx, W, H, cam, time, floor)` in screen space before the world transform.
  The gradient is baked to a canvas per size; clouds are sprites (or code-drawn soft blobs).
- `island.ts`: `Island` bakes the rim, cliff, underside and the town's ground for a floor of
  `w x h` tiles plus `RIM` margins; rebakes on size or land change; waterfalls and foam animate
  live on top. Exposes `bounds()` (world px) for the camera.
- `renderer.ts`: `backdrop()` becomes sky + island; the camera clamp lets the player scroll down
  to see the cliffs (about 6 tiles below the plot) and keeps the town rows on top.
- `ground.ts`: owned paving, for-sale meadow with the plot outline; the code-drawn fallback is in
  the new colours, so the game looks right before the art lands.
- **Buying land paves the plot**: the meadow turns to paving in a wave from the sign outwards
  (~0.7 s), dust puffs and a coin shower, a thump. Presentation only (the sim is untouched).
- Nothing in `src/sim/` changes. No numbers change.

## Words

The town is no longer in a swamp: strings that mention water, sinking, stilts or the bayou are
rewritten for the sky (*"My frogs keep falling off!"* for the Boardwalk). The Gazette keeps its
name (the Swamp Gazette moved up with the town: a joke it can tell).

## Phases

1. **Style test** (art): the ramps tuned, the key pieces drawn, a 1280x720 mock of the Workshop
   and one of the Factory made from the real sprites. The lead picks; the ramps are fixed.
   **In parallel, code**: sky, island, ground and camera with code-drawn fallbacks.
2. **Production** (art agents in parallel, disjoint files): ground and island; town and rim
   props; the Factory platform; the title scene. Words sweep.
3. **Integration** (lead): wire, screens, shots, bot, docs, commit.

PixelLab: 300 generations for the whole redesign (floor 1,396.9 remaining).
