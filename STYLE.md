# Foldworks — Style

Rewritten for the art revamp (DECISIONS.md, "The art revamp: Lantern Bayou", 2026-10-20; phase 3
added the skid, the destinations, effects and every recipe redrawn in B). Owned
by the `art-director`. The game's look in one line: **a lantern-lit plank deck on a dusk bayou;
the deck is warm and calm, machines are blue-grey steel seen from above and in front, and the
colour goes to what matters (ore, items, fire, brass modules, coin, the lanterns of the frog
town round the floors).**

The build scripts live in `pixel-art/revamp/`, one module per family, each run as
`python <script>.py` from that folder: `terrain.py`, `machines.py`, `routers.py`, `items.py`,
`buildings.py`, `destinations.py`, `modules.py`, `cast_draw.py` then `portraits.py`, `town_draw.py`,
`fx.py`, `pictures.py`, `ui_art.py` then `ui.py` (it appends the Milestone 5-6 icons).
`recolor_old.py` was the one-off A→B pass before the redraw; every sprite the game loads is now
built by one of the scripts above. `prompts.md` logs every PixelLab job and its cost.

## Palette: B, "Lantern Bayou" (51 colours + 5 pips)

`src/data/palette.ts` is the source of truth (`PALETTE` for the art scripts and the import
snapper, `C` for code); `pixel-art/revamp/pal.py` mirrors it for the Python scripts.

| Ramp | Colours | Use |
|---|---|---|
| `ink` `ink1` `ink2` | 3 | outlines, night, the darkest UI; violet-leaning so the dark reads as dusk |
| `water0-4` | 5 | the bayou round every floor; town waterlines; `water3` is A's `teal0` |
| `moss0-5` `lily` | 7 | swamp plants, Mayor Bramble, the Dock's pennant, orders (`moss3`/`moss5` are A's `moss`/`leaf`) |
| `wood0-5` | 6 | the Workshop deck (`wood3-5`), pilings and frames (`wood0-2`, A's `ground0-2`) |
| `earth0-3` | 4 | ore beds, unowned land |
| `steel0-4` | 5 | machine bodies, the Factory's plate floor, buttons (`steel1-4` are A's `hull0-3`) |
| `iron0-2` `copper0-3` | 7 | iron and copper ore, ingots, plates, wire; firebrick |
| `lamp0-3` | 4 | heat and lantern light; `lamp1` is `glow`, `lamp3` is `hot`, `lamp2` is `gold` (coin) |
| `brass0-3` | 4 | modules, coin frames, rivets (`brass1-2` are A's `brass0-1`) |
| `slag0-1` `violet` `teal` `bone` `red` | 6 | slag and bricks; Patents, plastic; glass and research; text and highlights; danger |
| `pipGreen` `pipYellow` `pipRed` `pipGrey` `pipBlue` | 5 | **status pips only**, unchanged from palette A. Never in sprite art. |

Rules:
- **Every palette-A slot name still exists** in `C`, mapped to the B colour that plays its role,
  so code and the code-drawn HUD plates keep working (`pal.ROLES`). New code may use the B names.
- **The deck is light and quiet**: 8 px boards in `wood3-4`, seams in `wood2`, few board ends.
  Seams never run as bright lines, so belts (dark steel with lit chevrons) and items win.
- **Chroma only where the player looks.** Steel is low-chroma blue-grey; ore, items, fire and
  pips carry the saturated colour.
- Every pixel snaps to the palette (`scripts/lib/pixel.mjs`; `common.export` checks). No
  semi-transparent pixels in sprites; fades are done by code.
- Pips differ by lightness as well as hue (yellow > green > blue > red > grey in OKLab L), and
  code adds shape: blocked pips blink.

## Sizes and grid

- Tiles 16×16; machines Mk1 16×16, Mk2 32×32; the Dock, Hopper and their Factory versions 32×32;
  the Pole 16×24 (it overhangs the tile above; anchor `[0, 8]`).
- Item icons 8×8 in `items.png` (the first 10) and `items2.png` (the rest), `src/data/items.ts`
  order.
- Portraits: 48×48 for cards (frame 0 face, frame 1 blink; `_cheer` frame 1 is the top of a
  bounce), 24×24 `_small` for rows. UI icons 16×16 and 8×8.
- Integer zoom only (1×–4×); `imageSmoothingEnabled = false` everywhere.

## 3/4 view and facings

- Machines are drawn **from above and in front** (high top-down 3/4): a lit top, a front face.
  Light from the top-left.
- **Every machine stands on its skid** (phase 3 readability, `machines.skid`/`seat`): a dark
  blue-grey steel plate (rows 12–15 of a Mk1 tile, 25–31 of a Mk2) with an ink rim, a lit
  `steel1` top edge and two bolts; the body casts a 1 px `ink1` shadow down-right onto it and
  the skid casts a `wood0` shadow to its right. Cool and dark against the warm planks, it says
  "machine" at 1× before the body is read. The crate and the slag heap (a steel skip) stand on it
  too; the Dock and Hopper do not (they are destinations, not machines).
- **Facing contract**: a machine sheet with `"facings": 4` in its JSON has four rows, **east,
  south, west, north** (the output side), frames left to right. `src/render/sprites.ts` picks the
  row by the entity's rotation and never rotates the bitmap, so the light stays top-left in all
  four. Every machine ships facings now, the splitter and merger included; only belts and
  trunks turn by code.
- **Told apart by silhouette and value, not by glow alone**: the smelter is a brick box with a
  chimney, the hand furnace an orange round pot with a crank, the kiln a pale grey fired-clay
  dome with teal glass. The splitter and merger are router boxes whose top-plate chevrons point
  out (splitter: a bright diamond) or in (merger: dim chevrons, one bright way out).
- **The pip corner stays calm**: the top-right 4×4 of every facing has no bright detail and no
  animation.
- Mk1 machines are fitted to 15×15 inside the tile (east and west share a scale so they are the
  same size turned round); a long, low facing may grow up to 1.35× and is cropped at the back.
- Families by silhouette and motion: miners a conical drill that spins; smelters, furnaces,
  boilers, kilns, generators and refineries a lit mouth that flickers (the lamp ramp stepped
  +1/0/−1/0); presses a ram that strokes; assemblers arms that reach; the mixer a turning drum;
  the steam engine its flywheel. **Working machines animate; stopped ones hold frame 0.** Mk2 is
  the same machine at 32×32 with more detail.

## Items

By shape first: ore = lumps, ingots = slanted bars, plates = flat squares, gears = teeth with a
hole, wire = a coil, slag = a crumbly lump, bricks = a coursed block, the Gizmo = its own odd box
with an antenna, steel = an I-beam end-on, glass = a pane with a shine, concrete = a cinder block
with two holes, plastic = a little moulded bottle, oil = a drop, the machine kit = a crate with a
gear stamp, the drill bit = a spiral cone. Colour is the second cue.

## Modules

A bold 2 px brass band lit from the top-left, rivets on three corners (never the top-right: the
pip), a deep `ink1` well for the output icon (code draws it at x+4, y+4) and the fold seam as a
dog-eared paper corner bottom-left. `module_glow` and `module_od` heat the band, never the well.

## The destinations

The Dock and the Hopper must read as *the* places items go, never as more machines
(`destinations.py`, hand-drawn): the **Dock** is a slip of open water cut into the floor with a
skiff of crates moored in it and a moss-green pennant with a gold coin (water is the only thing on
the deck that is neither wood nor steel); the **Hopper** is a brass-rimmed funnel painted research
teal, open mouth lit on its far slope, over a box with a glowing flask. Factory versions swap
planks for steel and hazard stripes; the Lily Pad Dock floats pads and a lotus in the slip under a
frog flag.

## Effects and Sparks

Lantern light is warm and stepped: `lamp3` at the heart, then `lamp2`, `lamp1`, `lamp0` outward;
embers cool as they drift (`fx.py`). Overlays never touch a module's icon well (3..12) or any
top-right 5×5. Sparks keep an ink outline so they are never read as decoration: the vein Spark is
a star of lantern light with two motes, the Inspector a frog in a bowler with a clipboard and a
flickering lantern.

## Floors and ground

- **Workshop**: the plank deck on pilings over the bayou; the shore's north face shows plank
  ends and pilings, the south a mossy lip. Ore patches are 32×32 seamless deposits (lumps 4–6 px,
  each ore its own lump shape and colour) on an `earth` bed. Unowned land is darker earth.
- **Factory**: riveted `steel` plates, two variants; belts and trunks sit on it as on the deck.
- **Water** animates in 4 frames, phase-shifted per tile.

## The town (Bramble's Town)

Night water, so the town is read by **warm lantern windows** and lit rims. Everything standing
in the water ends in two waterline rows (a `water3` ripple and a `water2` shadow), so any two town
sprites bottom-aligned on a row share a waterline. Houses (`town_house` order: hut, gable, lily,
tall, brick, bramble) are 32×32; the stall's and the lamps' lanterns flicker. Unit 7's tower,
Voltaire's pavilion, the frogs, lilies and the boardwalk are their Milestone 4 recipes in B: every
ripple and glint in the water ramp, decks and boardwalk in the Workshop deck's lighter boards
(wood1 seams and faces, wood3 boards, wood4 rims). The shore stands on 3 px outlined pilings with
a moss band, a ripple ring and a broken reflection.

## Portraits

Bramble keeps his Milestone 1 face with PixelLab's richer shading over it (img2img). The
Committee is three raccoons in one trench coat: the one in the hat, a second peeking between the
lapels and a third one's ringed tail out of the hem (the last two drawn by hand, so the joke
reads), and its 24×24 is drawn for its size, not halved. Unit 7 and Dame Voltaire are their
hand-drawn recipes run in B by role (`cast_draw.py`): Voltaire's skin is peach light over
terracotta (`copper3` over `copper2`), Unit 7 keeps its screen face in five-step steel. Both catch
**the lantern**: a warm rim light on the last pixel inside their right-hand outline (`lamp0`
on darks, `lamp1` on mids, `lamp2` on lights).
**Cheer portraits** keep the body and costume; the face turns to joy and frame 1 bounces 1 px.

## The title scene

`title_scene` (320×180, 8 frames, `title_scene.py`) is the revamp's showcase: the bayou at dusk
(sky to dusk violet, far hills in blue-grey haze, a row of stilt houses with lantern windows, the
moon and its streak on teal water), the Workshop deck at the bottom left with a miner on ore, a
smelter and a belt running into the Dock and a brass module glowing, and Bramble in his top hat
on the boardwalk at the right. Reflections shimmer row by row, lanterns flicker, the belt runs.
Composition rule: the sky band (scene y 14–66) carries the logo and tagline, the open water in
the middle (y 104+) the buttons, the dark water along the bottom the last line; the game places
them in scene coordinates at a whole-number cover scale.

## Pictures and UI art

The Megaproject and research scenes sit under the bayou's night (ink violets falling to slag and
violet, the town black against it with lit windows). Brass that is meant to look folded or
struck (the logo, coins, grade letters, the menu frame's rod and plates) uses all four brass
steps, `brass0` at the deepest fold and lantern gold (`lamp2`/`lamp3`) only on the lit face and
glints. The ornate menu frame stays ornate: brass rod, warm wood frame, a night-violet face.

## Atlases

**UI icon atlases are append-only.** Code finds icons by the JSON `names` list; new icons go on
the end and nothing moves. `ui_icons` / `ui_icons_small` 29–33: patents (a sealed deed), blueprint
(a plan on blue), reset (a turning violet arrow), overnight (a moon and a lantern), bearings (the
Committee's Raccoon Bearings, a steel ring with balls).

## UI

See `docs/ui-redesign.md`.

## Tools

pixel-art-studio for everything (`pixel-art/<slug>/*.py`, never a hand-edited PNG). The
Milestone 1-5 hand-drawn recipes still build their pieces: `pixel-art/revamp/recipes.py` runs
them against a stand-in palette module so each piece gets B colours chosen by role (a recipe's
shapes, outlines and poses stay its own). PixelLab only
within the session's stated cap, logged in the slug's `prompts.md` with each job's cost; its
drafts are finished by hand in the scripts (rim stripped, fitted, outline cleaned, shadow baked,
animation added). Never SpriteCook. Export contract: `.claude/agents/art-director.md`, plus the
facing contract above.
