# The 180's HUD art (paper, ink, wood, brass)

Notes for STYLE.md (the lead folds them into a "UI" section). The plan is `docs/hud-180.md`.

Build: `python build.py` (from this folder) runs `paper.py`, `ribbons.py`, `wood.py`,
`inspector.py`, then `sheet.py`, writing every sprite to `src/art/` and `out/`, and the contact
sheet `out/sheet.png` (1x on the deck and on the water, then the deck scene at 4x),
`out/sheet1x.png`, `out/parts.png` (every frame at 6x with its size and slice) and
`out/zoom_*.png`. `look.py` zooms any sprite. `kit.py` holds the palette access, the export
(palette and alpha checked) and `nine()`, the same tiling as `src/app/chrome.ts`.
`tiny.py` is a 3x5 caps font for lettering inside the art (the Gazette's masthead) and the sheet's
fake text; it is not a game font. No PixelLab generations were used.

## The rules

- **Paper** is `bone`, lit `lamp3` on its top-left inner edge, shaded `wood5` on its bottom-right
  inner edge, edged `wood2`. **Ink** is `ink`. The tag's shadow is `ink1`, 1 px straight down-right
  (2 px with a checker second row when it lifts); a shadow ignores the deckle.
- **Centres are plain.** Every 9-slice's centre is one flat colour (paper `bone`, the sign `wood2`,
  the chip `lamp3`, the ribbon's body), so ink text sits on nothing. Texture lives in the edges:
  deckle bites, tape, lips, page stacks, end grain.
- **Edges tile.** A 9-slice edge repeats with its own period (the tag's every 12 px, the sign's
  every 12, the book's every 8), so a feature in an edge repeats too. Edge features are either
  continuous (grain lines, page edges) or uneven bites (the deckle: a 1 px and a 2 px bite per
  period) so they read as torn paper, not perforation. Nothing that must appear once (a clip, a
  knot, a nail) lives outside a corner.
- **Wood** is the deck's ramp (`wood0-5`); the Purse sign is `wood2` so lantern-gold digits with an
  ink outline pop. **Brass** is the module brass `brass0-3`, `lamp2`/`lamp3` only on glints and lit
  states. **Leather** (the ledger and the notebook) is oxblood: `copper0` lit `copper1`, shaded `wood0`.
- **Raised things cast a 1 px `ink1` shadow** under them (petals, item discs, the notebook, the
  toolbox, the Gazette), so a button reads as a button and not as a coin.
- **Role colours** for ribbons and bookmarks, dark to light: moss `moss1-4`, copper `copper0-3`,
  teal `water2-4` + `teal`, violet `ink2` `slag0` `slag1` `violet`, brass `brass0-3`. Light text
  (`bone`) on the ribbon body.
- Nothing here looks like Last Watt's dark slate boxes with a 1 px border and a gold caps title:
  the HUD is warm paper and wood sitting on the floor with shadows, and its only dark fills are
  the lift's button holes and the hat on the Inspector.

## The Inspector

Hand-drawn (`inspector.py`), lit by a Lambert dome from the top-left with the cast's lantern rim
light on the right. Told apart from Bramble (bright frog, top hat, blue coat, sash) by: an olive
skin a step darker (`moss1-4`, a `lily` throat), a black bowler with a brass band, a monocle on a
brass chain, a brown drooping moustache (it perks up at the ends in the cheer frames), half-lidded
eyes, a grey suit (`steel0-3`) with a wing collar and a red bow tie, and the clipboard held up at
the bottom right. Cheer: eyes open, brows up, the moustache curls up, the monocle drops out on its
chain; frame 1 bounces 1 px (as Bramble's). The 24x24 is drawn for its size.

## The manifest as shipped (all in `src/art/`, 1x strips, anchor [0,0] unless said)

| Name | Frame | Frames | Slice / extras |
|---|---|---|---|
| `h180_tag` | 20x20 | 2 (rest, hover) | slice [4,4,4,4]; frame 0's paper is x/y 1-18 with a 1 px shadow; frame 1's paper is 0-17 (1 px up-left, `lift: [-1,-1]`) with a 2 px shadow |
| `h180_hole` | 5x5 | 1 | anchor [2,2] (the hole's centre: the string starts there) |
| `h180_bubble` | 16x16 | 1 | slice [4,4,4,4]; ink outline, 2 px round corners, lit top row, shaded bottom row and right column |
| `h180_bubble_tail` | 8x8 | 4 | order downLeft, downRight, left, right; `overlap: 2`: a down tail's top 2 rows lie on the bubble's bottom 2 rows (it opens the outline); left: its right 2 columns on the bubble's left 2; right: its left 2 columns on the bubble's right 2 |
| `h180_ribbon` | 8x14 | 15 | per colour (moss, copper, teal, violet, brass): left end, middle tile, right end; the band is rows 0-11 (`band: [0,11]`, body rows 2-9), the forked ends hang 2 px lower |
| `h180_bookmark` | 10x16 | 5 | moss, copper, teal, violet, brass; `icon: [1,3,8,8]` a plain field for an 8x8 icon; the top row tucks under the page edge |
| `h180_sign` | 24x16 | 1 | slice [6,5,6,5]; nails in the corners (where the ropes tie on) |
| `h180_rope` | 3x8 | 1 | tiles vertically |
| `h180_book` | 24x24 | 2 (left, right page) | slice [8,5,8,7] for both; the leather and page stack on the outer side, the gutter on the spine side; the two pages meet at the spine edge to edge |
| `h180_keycap` | 9x10 | 2 (up, down) | slice [3,2,3,3]; up: face rows 1-6 (letter at y 2), down: face 1 px lower |
| `h180_mouse` | 7x10 | 3 | LMB, RMB, WHEEL (the hot part `copper2`) |
| `h180_button`, `h180_button_gold` | 12x12 | 4 | normal, hover, down, disabled; slice [4,4,4,5]; down and disabled are 1 px lower with no base |
| `h180_chip` | 9x9 | 1 | slice [4,4,4,4]; `lamp3` pill, `wood2` edge |
| `h180_slip` | 16x16 | 1 | slice [5,5,5,5]; clear tape over both top corners |
| `h180_clipboard` | 20x22 | 1 | slice [10,8,4,4]; the steel clip lives in the top-left corner (a 9-slice cannot centre it); paper centre x 10-15, y 8-17 |
| `h180_pushpin` | 7x7 | 2 | pin, shadow only; anchor [2,2] (the head's centre) |
| `h180_bell` | 16x16 | 4 | rest, left, rest, right; fps 6; anchor [8,0] (the hook) |
| `h180_lift` | 44x26 | 1 | `pivot: [22,15]` (the needle's hub), `holes: [[2,9],[32,9]]` (top-left of each 10x10 button), `ticks` at 180/120/60/0 degrees (W, F, District, World; the needle sweeps the top half) |
| `h180_liftbtn` | 10x10 | 6 | W, Wlit, F, Flit, locked (padlock), hover (a `lamp2` ring drawn over either button) |
| `h180_notebook` | 24x24 | 2 | closed, hover (lifted 1 px, a longer shadow, a lit corner) |
| `h180_newspaper` | 36x26 | 3 | folded, lift (corner up), turn (page half over); `headline: [3,12,30,8]` the blank band for the code's headline |
| `h180_toolbox` | 20x16 | 2 | normal, hover (lid up 1 px, a screwdriver peeks out) |
| `h180_hub` | 28x28 | 2 | normal, hover (a lantern ring); `well: [6,6,16,16]` the plain recess for the last building |
| `h180_petal` | 18x18 | 4 | normal, hover, active, locked (steel + padlock); the disc is rows 0-16 centred on (9, 8.5), the face inside the bevel is plain for an icon |
| `h180_disc` | 18x18 | 4 | normal, hover, afford (gold rim), locked (dim paper); same geometry as the petals |
| `h180_lilypad` | 56x14 | 1 | `portrait: [4,-42]` where a 48x48 portrait's top-left goes relative to the pad |
| `h180_tick` | 12x12 | 1 | `moss1` stamp with bare specks |
| `h180_circle` | 22x22 | 1 | `red` pencil, the overlap `copper0` |
| `portrait_inspector` | 48x48 | 2 | face, blink |
| `portrait_inspector_cheer` | 48x48 | 2 | cheer, cheer bounced 1 px up |
| `portrait_inspector_small` | 24x24 | 1 | |

Every sheet with named frames carries an `order` list in its JSON (`src/render/sprites.ts` reads
it as the sheet's frame names).
