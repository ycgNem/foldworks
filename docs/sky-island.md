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
`C` and in `pixel-art/sky/pal.py`. **Fixed at the style test** (the first proposal is struck below:
with it a deuteranope saw meadow and paving as the same beige; `pal.py` tests that now):

| ramp | slots | proposed |
|---|---|---|
| sky | `sky0`..`sky4` (zenith to horizon) | `#3570cc` `#4f8ae0` `#76aaec` `#a2cbf4` `#d2e9fa` |
| cloud | `cloud0`..`cloud3` (deep shade to lit) | `#93add6` `#bdd2ee` `#e4eefa` `#ffffff` |
| grass | `grass0`..`grass3` | `#275f35` `#3b8539` `#58a843` `#8bcb57` |
| paving | `pave0`..`pave3` (grout to lit) | `#7a7064` `#9c9080` `#b9ad97` `#d2c6ac` |
| sun | `sun` (horizon glow) | `#ffe6b8` |

Rules: the paving must stay apart from the paper (`bone` `#eee2c6`) so floor tags read on it, and
dark enough that steel base plates and belts pop; grass is brighter than `moss` (moss stays the
swampy accent); the sky's lightest step sits under the horizon only.

## Art contract (names the code looks for; every piece optional, code draws a fallback)

All in `src/art/` as `<name>.png` + `<name>.json` (`{frame:[w,h], frames, anchor, fps, names?}`),
made by scripts in `pixel-art/sky/`.

As built (production, 2026-10-21; `src/render/skyart.ts` resolves every name, with a code-drawn
fallback of the same frame size and order; bakes rebuild when art appears).

| name | frame | frames | how it is drawn |
|---|---|---|---|
| `tile_pave` | 16x16 | 4 | owned floor (paving C), picked by hash |
| `tile_pave_edge` | 16x16 | 4 (N E S W) | grass in the grout on an owned chunk's edge tiles where the neighbour is not owned land |
| `tile_pave_seam` | 16x16 | 4 (N E S W) | between two owned lots only, once per border (each lot draws its east and south) |
| `tile_grass` | 16x16 | 4 | meadow (for-sale land) and the rim, by hash |
| `tile_grass_deco` | 16x16 | 8 | flowers, tufts, pebbles on ~13% of rim and ~9% of meadow tiles |
| `tile_plot` | 16x16 | 9 | the plot outline on for-sale chunk edges, frame = row*3 + col (4 unused) |
| `isle_edge` | 16x16 | 16 | the rim's edge into the sky, a whole tile by 4-bit mask (N=1 E=2 S=4 W=8 = land there); 15 is `tile_grass` |
| `isle_cliff` | 16x16 | 12 | row*4 + variant (lip, mid, low), assembled into one 64x48 strip sampled at world x mod 64, per pixel column under the silhouette, 4 tiles under a lip; the lowest exposure in each pixel column runs to the underside |
| `isle_vein` | 16x16 | 16 (`names` iron0..3 copper0..3 coal0..3 sand0..3) | the floor's ores on the first mid row, clipped to the rock |
| `isle_under` | 16x16 | 16 | kind*4 + (x mod 4): fill, bottom (3 px bounce light), left slope, right slope; depth 1 tile at the ends to 9 in the middle |
| `isle_under_deco` | 16x16 | 8 | crystals, roots, an iron node, a pale boulder, a hollow, moss on ~30% of fill cells |
| `isle_tip` | 48x32 | 1 | anchor [24, 0], under the two middle columns of the deepest row |
| `isle_fall_top` | 16x16 | 4 | the spring and channel on a south lip tile whose mask is exactly N, E, W |
| `isle_fall_head` | 16x16 | 4 | the water bowing over the lip, on the first cliff row |
| `isle_fall` | 16x32 | 4 (fps 8) | tiled down to the cloud cushion |
| `isle_fall_foam` | 32x16 | 4 | where the fall meets the cloud sea |
| `sky_cloud` | 64x32 | 6 | 0-1 big, 2-3 medium, 4-5 small; the far layer uses 2-5 at 90% alpha |
| `sky_islet` | 64x48 | 4 | far islands on the horizon |
| `sky_bird` | 8x8 | 4 (fps 8) | a flock crossing for 16 s of every 41 |
| `sky_below` | 48x32 | 1 | the Workshop island hazed, seen from the Factory's sky through the gap in the cloud sea |
| `prop_tree` | 32x32 | 4 (oak, pine, apple, blossom) | anchor (16, 29) at the foot (tile x + 8, y + 14) |
| `prop_bush` | 16x16 | 4 | bushes, rocks, a flower bed, a stump |
| `prop_fence` | 16x16 | 4 | frame 0 along straight south-lip runs |
| `tile_ore_<ore>` | 16x16 | 9 | 0 the whole outcrop (the Survey Office), 1-4 the quadrants on paving, 5-8 on meadow (`seats`) |
| `tile_ore_<ore>_spill` | 16x16 | 32 | 0-15 the 4x4 apron on paving, 16-31 on meadow |
| `fplat_deck` | 16x16 | 14 | the plaza's 32 px plates (`plain|hatch|vent` x `_nw|_ne|_sw|_se`), then `tread0`, `tread1` |
| `fplat_edge` | 16x16 | 28 | overlays on the deck: `m0..m15` by mask, `in_*` concave corners, `cut_*` (destination-out), the annex `seam_*` |
| `fplat_under` | 16x16 | 9 | `face_l face face_r face_splice truss_l truss truss_r face_lr face2` |
| `fplat_rotor` | 48x24 | 4 (fps 12) | anchor (24, 0), hung at the truss's bottom, about one every 5 tiles |
| `fplat_rotor_side` | 48x32 | 8 (`w0..3 e0..3`, fps 12) | the outriggers on the side faces, anchor (45, 15) west, mirrored east |
| `town_*` | as before | as before | the town's sprites, re-seated on footings |
| `title_scene` | 320x180 | 8 | the title key art: the island at morning |

**The island's margins** (`RIM` n 6, s 3, w 4, e 4): each side is at least the town's minimum (3 on
rows -3..-1), bulges 3-5 tiles in the plot rows, then follows the monotone hull; the last row is
cut into lobes of at least 3 tiles. Every town slot is land (rows -3..-1 from x -3 to fw + 2; the
row-99 houses on rows fh..fh + 1, x 2..11). Props keep out of the town's zones and the plot (trees
a tile further). **The Factory platform** (`PLAT` in `factory.ts`): the plaza 2 tiles wider than
the hall each side, the walk 2 tiles west, 3 east, 2 south; annex blocks splice on east.

## Decided at the style test (the lead, 2026-10-21)

The mocks: `pixel-art/sky/out/mock_workshop_{A,B,C}.png`, `mock_zoomout.png`, `mock_factory.png`,
`compare_paving.png`. `pixel-art/sky/mock_island.py` is the reference for how the island is put
together; the code follows it.

- **Paving C** (painted concrete, one flat fill, a dotted build grid, a small cross where four
  tiles meet), the calmest floor: machines, belts, items and paper tags win on it at 1x and 2x.
  A (flagstones) had more charm and the busiest joints; B (riveted plate) blurred into the
  Factory's steel. Tiles that border the meadow get a grass tuft in the grout.
- **The cliff** is one 64 px periodic texture: variant = world tile x mod 4 (never a hash), drawn
  per pixel column under the top surface's silhouette so the face follows the edge's rounded
  corners; land further south hides cliff behind it; the top row is the lip, the mid row repeats
  down to the underside, the low row ends it. Strata sit on the same pixel rows in every variant.
- **The underside**: 16 frames (fill, bottom, left slope, right slope; 4 variants each, variant =
  x mod 4). Each column's depth runs from 1 tile at the island's ends to 9 in the middle, never
  shallower than the next column outward; the tip hangs under the two deepest columns (anchor
  [24, 0]). More crystals and roots by hash and a lighter bounce band keep its middle from
  reading as one dark mass.
- **The outline is monotone**: each coast steps only outward going south down to the widest
  rows, then only inward (else a cliff hangs like a pillar beside the land). Organic comes from
  the corner rounding and a wobbly lip.
- **Waterfalls**: `isle_fall_top` (16x16 x4, the spring and its channel on the south edge tile),
  `isle_fall_head` (16x16 x4, the water bowing over the lip, over the cliff's top tile),
  `isle_fall` tiled down, the foam at the cloud sea's top with the fall continuing behind it.
- **Veins** on the first mid row of a column's face, clipped to the rock.
- **The sky's gradient** is baked at world-pixel size (W/zoom x H/zoom) and scaled up, so its
  dither matches the world's pixels (8 px Bayer seams).
- **The town** sprites end in two water-line rows (puddles on grass): every one is re-seated on
  footings; `town_lily` goes. **The ores** bake the deck's shadow colours (wood0-3): they are
  remapped onto paving and meadow.
- **The Factory platform**: brass trim on the north deck, rotors on the side faces too, the town
  on proper footings.

### Flagged as derivative
- A floating sky island as your base, other islands on the horizon: Roblox *Islands* (once
  Skyblock) and Minecraft's Skyblock maps. Our art and our own rules; the concept is the owner's
  pick, recorded in DECISIONS.md.
- Brass rotor pods under a sky platform: the steampunk family (*BioShock Infinite*'s Columbia).
  Generic.
- Puff clouds: no outline, eyes or face (not Mario's).

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
