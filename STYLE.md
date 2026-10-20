# Foldworks — Style

Written after the Milestone 0 palette test (`pixel-art/palette-test/`, `DECISIONS.md`
2026-10-20). Owned by the `art-director`. The game's look in one line: **a warm, cosy workshop
floor where only the things that matter carry colour — blue iron, orange copper, glowing heat,
brass modules and coin — framed by a dense, brass-and-wood UI that is always full of things to
read and click.**

## Palette: A, "Foundry" (32 colours)

`src/data/palette.ts` is the source of truth (`PALETTE` for the art scripts, `C` for code).

| Slots | Use |
|---|---|
| `ink` `shadow` `bone` | outlines and the darkest UI; shadow-side darks; text and highlights |
| `ground0-2` | the Workshop floor (packed earth) and wood UI frames |
| `hull0-3` | machine steel (Mk1 bodies), UI buttons |
| `iron0-2` | iron ore, ingots, plates; the Hopper's blue |
| `copper0-2` | copper ore, ingots, wire; firebrick |
| `slag` `violet` | slag and its bricks; rare accents |
| `brass0-1` `gold` | modules, coin, UI frames and their rivets; `gold` is reserved for coin numbers and the best moments |
| `glow` `hot` | heat: smelter mouths, embers, sparks of light |
| `teal0-1` | glass and Act II; the research tree's light |
| `moss` `leaf` | Mayor Bramble, the Dock's pennant, orders |
| `pipGreen` `pipYellow` `pipRed` `pipGrey` `pipBlue` | **status pips only** (working, starved, blocked, unconnected, unpowered). Never in sprite art. |

Rules:
- **Chroma only where the player looks.** The floor is low-chroma earth; machines are neutral
  hull steel with one family accent; items and pips carry the saturated colour.
- Every pixel snaps to the palette (`scripts/lib/pixel.mjs`, the art director's `build.py`
  checks). No semi-transparent pixels in sprites; fades are done by code.
- Pips differ by lightness as well as hue (yellow 0.92 > green 0.76 > blue 0.64 > red 0.55 >
  grey 0.36 in OKLab L), and code adds shape: blocked pips blink.

## Sizes and grid

- Tiles 16×16; machines Mk1 16×16, Mk2 32×32 (Act II); the Dock and Hopper 32×32.
- Item icons 8×8 in `src/art/items.png`, one cell per item in `src/data/items.ts` order.
- Portraits: 48×48 for cards, 24×24 for rows. UI icons 16×16 (buttons) and 8×8 (inline text).
- Integer zoom only (1×–4×); `imageSmoothingEnabled = false` everywhere.

## Light, outline, silhouette

- Light from the top-left; a 1 px `ink` outline outside every standing object; selective inner
  lines in the family's dark.
- Machines face **right** (their output side). The renderer turns them in 90° steps, so the
  light turns with them; it is subtle at 1×–2× and accepted for Mk1 (DECISIONS.md). The top-right
  4×4 is kept calm on every machine (and, because of rotation, every corner) for the pip.
- Families by silhouette and motion: miners have a turning cutter, smelters a glowing mouth and
  a chimney, presses a ram, assemblers arms. Working machines animate; stopped ones hold frame 0.
- Items by shape first: ore = lumps, ingots = slanted bars, plates = flat squares, gears = teeth
  with a hole, wire = a coil, slag = a crumbly lump, the Gizmo = its own odd box with an antenna.
- Modules: a bold brass frame with rivets and a dog-eared fold seam, the output icon in a well.

## UI

The owner's direction (2026-10-20): the screen is **full** — framed panels on every side, a
store column of large illustrated rows, tabs and buttons everywhere, a news ticker, big counters
that roll and bump, pops and flying coins on every sale. Never a bare map with a thin bar.
- Frames: dark wood (`ground0-1`) with brass (`brass0-1`) corners and rivets, 9-slice sprites
  (`src/art/ui_*.png` with a `slice` in the JSON) or code-drawn in the same colours.
- Text: the bitmap font (`src/ui/font.ts`); `bone` on dark, `gold` for coin, `fog` (hull2) for
  secondary lines; numbers through `Num.format`.
- Every clickable thing reacts on hover (lighter fill, a 1 px lift) and on click (a sound, a
  1 px press).

## Act II (Milestone 4) additions

- **The Megaproject Bay** (`mega_bay`, 32×32, named frames `empty`, `stage1`–`stage3`, `run1`,
  `run2`) is the only floor object with a tall structure: a blue-steel crane gantry framing a
  lighter concrete pad with a hazard-striped front. It must out-shout the 16×16 brass modules
  by size and silhouette, not by gold alone. Construction stages grow the drill upward; only
  the run frames light up (vents, beacon, pit glow, sparks).
- **Overdrive** (`fx_overdrive` 16×16, `fx_overdrive_big` 32×32, 4 frames at 12 fps) is a ring
  overlay: a rounded hot rim with marching hot/gold dashes, a flicker of copper one pixel in,
  and sparks rising up the sides. The middle stays clear, so the machine under it still reads.
- **Cheer portraits** keep the base portrait's body and costume. The face turns to joy,
  the arms go up, and one comic prop moves (Unit 7's blazing antenna, Voltaire's popped
  monocle and handkerchief). Frame 2 is the top of a bounce: head and props 1 px up.
- **UI icon atlases are append-only.** Code finds icons by the JSON `names` list, so new icons
  go on the end and the first 20 never move. 16×16 drawings live in
  `pixel-art/ui/icons_m4.py`, 8×8 ones in `pixel-art/m2/sprites.py`.

## Tools

pixel-art-studio for everything (`pixel-art/<slug>/build.py`, every pixel placed on purpose).
PixelLab later, within a stated cap. Never SpriteCook. Export contract: `.claude/agents/art-director.md`.
