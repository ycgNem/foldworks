# Foldworks — Style

Rewritten for the art revamp (DECISIONS.md, "The art revamp: Lantern Bayou", 2026-10-20). Owned
by the `art-director`. The game's look in one line: **a lantern-lit plank deck on a dusk bayou;
the deck is warm and calm, machines are blue-grey steel seen from above and in front, and the
colour goes to what matters (ore, items, fire, brass modules, coin, the lanterns of the frog
town round the floors).**

The build scripts live in `pixel-art/revamp/` (one module per family, `build_all`-style:
`terrain.py`, `machines.py`, `items.py`, `buildings.py`, `modules.py`, `portraits.py`, `ui.py`,
and `recolor_old.py` for everything not redrawn yet). `prompts.md` there logs every PixelLab job
and its cost.

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

- Machines are drawn **from above and in front** (high top-down 3/4): a lit top, a front face,
  a 1 px `wood1` shadow down-right baked in. Light from the top-left.
- **Facing contract**: a machine sheet with `"facings": 4` in its JSON has four rows, **east,
  south, west, north** (the output side), frames left to right. `src/render/sprites.ts` picks the
  row by the entity's rotation and never rotates the bitmap, so the light stays top-left in all
  four. Sheets without `facings` are rotated by code as before (belts, splitter, merger).
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
tall, brick, bramble) are 32×32; the stall's and the lamps' lanterns flicker. Unit 7's tower and
Voltaire's pavilion keep their Milestone 4 drawings, recoloured.

## Portraits

Bramble keeps his Milestone 1 face with PixelLab's richer shading over it (img2img). The
Committee is three raccoons in one trench coat: the one in the hat, a second peeking between the
lapels and a third one's ringed tail out of the hem (the last two drawn by hand, so the joke
reads at 24×24). Unit 7 and Dame Voltaire keep their hand-drawn portraits, recoloured.
**Cheer portraits** keep the body and costume; the face turns to joy and frame 1 bounces 1 px.

## Atlases

**UI icon atlases are append-only.** Code finds icons by the JSON `names` list; new icons go on
the end and nothing moves. `ui_icons` / `ui_icons_small` 29–33: patents (a sealed deed), blueprint
(a plan on blue), reset (a turning violet arrow), overnight (a moon and a lantern), bearings (the
Committee's Raccoon Bearings, a steel ring with balls).

## UI

See `docs/ui-redesign.md`.

## Tools

pixel-art-studio for everything (`pixel-art/<slug>/*.py`, never a hand-edited PNG). PixelLab only
within the session's stated cap, logged in the slug's `prompts.md` with each job's cost; its
drafts are finished by hand in the scripts (rim stripped, fitted, outline cleaned, shadow baked,
animation added). Never SpriteCook. Export contract: `.claude/agents/art-director.md`, plus the
facing contract above.
