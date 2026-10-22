# The rest of the game: Milestones 7-14 (2026-10-21)

The owner: *"finish the rest of the milestones/game run autonomously, no itch.io page, use up to
250 credits if needed."* This is the plan and the code and art contract for everything after
Milestone 6: Act III (the District), the second gate, Act IV (Worlds and Relocate), Act V (the
Last Fold), the long tail, sound, onboarding and release. Numbers here are first passes; each one
moves into `DESIGN.md` with its derivation when it is built and measured (CLAUDE.md: never tune
silently). PixelLab: 250 generations at most (floor 1,100.9 remaining), never USD.

Nothing here changes CLAUDE.md's ask-before list: the tile size, palette (colours are appended,
none moved), tick rate, currency list (coin, items, reputation, Patents, Legacy, Kernels: all in
`PLAN.md` already), floor list (Workshop, Factory, District, World, and the Kernel tree's fifth
floor that `DESIGN.md` §15 names), reset layers (Reorganize, Relocate, the Last Fold) and the
milestone order stay as written. Within a milestone, tracks run in parallel; milestones finish in
order, and the second gate is reviewed before Act IV is built.

## The shape, in one paragraph per act

- **Act III, the District (15-40 h): composing modules.** Folded groups (depth-2 modules) go up
  to a third floor, the **District**, a sky platform higher than the Factory. There are no trunks
  there: modules are joined by **skiff routes**, little brass rotor boats that fly crates between
  modules. A route's throughput is its skiffs times their load over the round trip, so distance
  matters: a feeder placed beside its consumer needs one skiff, across the platform three. Tier 3
  products (chemicals, bearings, servos, sensors, processors, robot arms, the absurd Autonomous
  Sandwich Engineer) are designed on the Workshop as always, fed from the Factory by a **Chute**
  that drops modules' output down onto a Workshop belt. Two new machines (the Chem Vat, the
  Greenhouse) and two new modes (Recycling, Byproduct). Megaprojects #2 and #3 (the Floating
  City, the Scrap Transmuter) are built at the District's Bay. Scenarios (puzzle boards with
  personal bests) and Challenges (restricted runs with permanent rewards) open after the first
  Reorganize. District groups fold again (depth 3) at the act's end.
- **Act IV, Worlds and Relocate (40-80 h): adapting to biome rules.** The fourth floor, the
  **World**, takes depth-3 modules. **Relocate** (layer 2) flies the town to another island on
  the horizon: Patents, the tree and the record on file reset, **Legacy** is banked, and the new
  island's Workshop has its own rule (Pebble Isle: half the land; Cinder Isle: vents that heat
  machines and melt belts beside them; Rime: machines need warmth from a Heater or their
  neighbours; the Old Works: rubble and ruined machines to repair, some of them whole lines).
  Each island has one exotic deposit and its own tier 4 product. Legacy automates layer 1
  (auto-reorganize, the regrader, contract runners). Megaprojects #4 and #5 want every island's
  product, so all four are visited.
- **Act V, Beyond and the Last Fold (80-100+ h): bending the rules.** The **Last Fold** audits
  the whole World floor and folds it into one tile, the **Seed**, which becomes the first machine
  of a new universe. **Kernels** buy base-rule changes: belts that carry two, a port on every
  side, a bigger box, a fifth floor (**Beyond**), a new recipe table. **Infinite orders** (the
  Endless Ledger) and tier 5 impossible inventions keep a next goal forever.

## Milestone 7: Act III, the District

### Floors as data
`Floor` becomes `'workshop' | 'factory' | 'district' | 'world'` (`'beyond'` with the Kernel
node). The District and the World are **high floors**: one implementation
(`src/sim/systems/high.ts`), per-floor constants in `src/data/floors.ts`. A high floor's state:

```ts
interface HighFloor {
  ents: FEnt[];          // modules (kind 'module'), its Dock 'fdock', Hopper 'fhopper', Bay 'fbay'
  nextId: number;
  routes: SkiffRoute[];  // skiff routes between its things
  nextRoute: number;
  lots: number;          // lots of floor bought this run (the annex pattern: linear prices)
}
interface SkiffRoute { id: number; from: number; to: number; item: ItemId; skiffs: number;
                       flow: number /* items/s moved, smoothed: the readout */; want: number }
// State gains: district?: HighFloor; world?: HighFloor (absent until opened)
```

- **Depth gates**: the Factory takes depth 1 and 2 (as now), the District depth 2, the World
  depth 3. A module is 1x1 on every floor.
- **Modules run exactly as on the Factory** (`stepModule`, extracted from `runModules`: inputs
  at rate from the buffer, outputs into it, starved/blocked in proportion, byproducts block, a
  full product spills). Overdrive, pausing, the Drill's boost, the bills term and the pips are
  shared.
- **Skiff routes** replace trunks. A route carries one item from a module's output buffer to a
  module (that takes it), the floor's Dock, Hopper or Bay. Throughput, items/s:

      skiffs x load / (2 x distance / speed + dwell)

  District first pass: speed 2 tiles/s, load 4, dwell 1 s, distance Euclidean between tile
  centres. Beside (1 tile): 4 / 2 = 2.0 a skiff; 5 tiles: 0.67; across a 12-wide floor: 0.32.
  A route starts with 1 skiff; each skiff is bought at a flat price (first pass 15,000 on the
  District, priced against Act III income) and refunded when removed. At most 12 skiffs a route.
  Several routes from one output share it in turn. The readout per route: `3 skiffs · 1.4/s of
  2.1 wanted · 6.2 tiles`.
- **Commands**: `hplace` (a module design onto a high floor), `hremove`, `route` (from, to, item:
  pays one skiff), `skiff` (+1/-1 on a route), `unroute`, `hclick` (Overdrive a module and its
  route group; a click on the Hopper is Inspiration), `haudit`/`hauditCancel`/`hfold` (depth-3
  folds on the District, research *District Folds*), `hlot` (the next lot).
- **The District** (research *Zoning*): 12x10 to start, three lots of 2x10 to the east (16x10,
  then 18x10 with the Floating City's second stage), Dock at the east edge, Hopper beside it, the
  Bay (megaprojects #2, #3) at the south-west corner once their research is done.
- **Depth-3 folds** (research *District Folds*): a box up to 8x8 of at least two depth-2 modules
  joined by routes inside it. Routes crossing the box edge are its ports; routes inside are the
  group's logistics (their skiffs are refunded, like trunk tiles). U, W, C as nested folds (C =
  module tiles / box tiles / 0.6). The design's bill is its modules' bills.

### The Chute (research *Chutes*)
A **Factory Chute** (1x1 on the Factory floor, a trunk ends in it) drops what it receives down
to the Workshop. A **Chute Mouth** (1x1 Workshop building, 400 coin) is set to an item like a
machine's recipe and pushes that item out of its front from the dropped stock, one at a time at
belt speed. The stock between them (`s.chute: Partial<Record<ItemId, number>>`, fractional
items) holds at most 20 of each item; a full stock stops the Chute taking that item (its trunk
backs up, the pip says so). A fold box may not hold a Chute Mouth (it would make items from
nothing), so a tier 3 line is audited with its Chute Mouths outside the box, feeding it through
ports: the Workshop stays the design bench, and the Factory feeds it.

### Tier 3 (about 20 items, first-pass numbers)
Values are about 3-4x their inputs' (§18's rule); steps are `chainSteps`.

| Item | Made by | From | Time | Value | Steps |
|---|---|---|---|---|---|
| Solvent | Chem Vat | 2 oil + sand · sludge 1 per 2 | 2 s | 30 | 2 |
| Sludge | (Chem Vat byproduct) | | | 0, refused | 2 |
| Rubber | Chem Vat | plastic + solvent → 2 | 3 s | 80 | 3 |
| Battery | Chem Vat | 2 copper ingots + solvent + plastic | 5 s | 240 | 3 |
| Fertilizer | Chem Vat | 2 sludge + gravel | 2 s | 12 | 3 |
| Bearing | Press | steel → 2 | 2 s | 30 | 3 |
| Gearbox | Assembler | 2 gears + 2 bearings + steel | 6 s | 360 | 4 |
| Produce | Greenhouse (2x2) | fertilizer → 3 | 6 s | 10 | 4 |
| Sensor | Assembler | 2 glass + circuit + rubber | 6 s | 1,000 | 4 |
| Processor | Assembler | 3 circuits + 2 solvent | 8 s | 2,200 | 4 |
| Servo | Assembler | motor + gearbox + circuit | 10 s | 3,600 | 5 |
| Sandwich | Assembler | 3 produce + plastic | 4 s | 200 | 5 |
| Clockwork Frog | Assembler | gearbox + 2 bearings + rubber | 8 s | 1,800 | 5 |
| Weather Balloon | Assembler | 3 rubber + sensor + battery | 10 s | 2,600 | 5 |
| Self-Folding Umbrella | Assembler | servo + 2 rubber + plastic + steel | 12 s | 12,000 | 6 |
| Robot Arm | Assembler | 2 servos + sensor + 2 steel | 16 s | 24,000 | 6 |
| Lift Rotor | Assembler | 2 motors + 2 gearboxes + 4 steel | 12 s | megaproject | 5 |
| Transmuter Coil | Assembler | processor + 2 batteries + 4 rubber | 14 s | megaproject | 5 |
| **Autonomous Sandwich Engineer** | Assembler Mk2 | robot arm + processor + 10 sandwiches + battery | 30 s | 90,000 | 7 |

Machines: **Chem Vat** (1x1, 100 kW, 12,000 coin, *Chemistry*), **Greenhouse** (2x2, 150 kW,
25,000, *Hydroponics*). The ASE is assembled only by the Assembler Mk2 (a recipe flag `mk2`).

### Modes (research *Recycling*)
**Recycling**: byproducts every 2x as many crafts (half the waste), 0.9x speed. **Byproduct**: a
byproduct every half as many crafts (double), 1.1x speed: for lines where the waste is an input
(fertilizer from sludge, gravel from slag). Powered machines only, like the Act II modes.

### Research, page 3 (Act III; every node needs the Great Drill's stage 3 to stand)
Zoning · Chutes · Chemistry · Bearings · Vulcanizing · Batteries · Servos · Sensors ·
Processors · Robotics · Recycling · Hydroponics · Sandwiches · Sandwich Engineering · The
Floating City · The Scrap Transmuter · District Folds. Costs are tier 2 then tier 3 items, set
so the planner bot opens the District at about 15 h of play (§16).

### Megaprojects #2 and #3 (state `megas: { city?, transmuter? }`, kept through every reset)
- **The Floating City** (District Bay): stage 1 *the Platform* (lift rotors, concrete): the
  Factory floor gains its ninth row for good; stage 2 *the Spires* (lift rotors, sandwiches,
  glass): the District gains a fourth lot for good.
- **The Scrap Transmuter**: stage 1 (transmuter coils, steel): every Dock pays for byproducts at
  25% of what their recipe's main output sells for; stage 2 (coils, processors): a module whose
  byproduct has nowhere to go transmutes it at that price instead of blocking.

### Orders (Act III), Patents (Act III nodes), the Committee and Unit 7
Each customer gets two or three Act III orders (a picnic on the rim, umbrellas for the mayor, a
servo ballet, the Committee's one Autonomous Sandwich Engineer, Unit 7's tier 3 specimen drawer)
and rewards at reputation 4-6, each a rule. About 12 Patent nodes for Act III: head starts for
its research, the Group Drawer (keep nested designs), the Dispatcher (adds a skiff where a route
runs short), District deeds, a longer skiff.

### Scenarios v1 (after the first Reorganize; local personal bests)
Puzzle boards played in a separate game (`new Game(seed, { scenario })`, its own save slot): a
board fixes the land, the deposits, research, starting coin and one twist; the goal is the best
fold of one product. Records (grade score, output a tile, a kW, waste) are kept in the app's
local storage, never the sim. v1: **Tiny Island** (chunk A only, best Gizmo works), **Rich Ore,
Little Power** (miners 2x, power 0.5x, best Steel per kW), **Scarce Belts** (40 belt tiles, best
Circuits).

### Challenges v1 (in the main game; permanent rewards)
Taken from the Reorganize contract: the next run is restricted until its goal is met, then the
reward is kept for good (`meta.challenges`); Patents are filed as for any run. v1: **No
Splitters** (goal: the Gizmo Festival), **Hands Off** (no clicks count; starts with the
Bellows), **Lean Power** (power producers make half; goal: Circuits), **Three Kinds** (three
kinds of machine at most on the Workshop; goal: a fold at S), **Small Boxes** (fold boxes 4x4;
goal: the Festival). Each reward is small and tied to what earned it.

### Art (art-director, `pixel-art/act3/`, exports to `src/art/`)
Chem Vat and Greenhouse (four facings, work animation, on their skids, like `kiln`); the Chute
Mouth (Workshop) and the Factory Chute; `items3.png` (the 19 tier 3 icons in `ITEM_IDS` order);
the District platform (`dist_deck`, `dist_edge`, `dist_under`, its rotor pods; higher and
brighter than the Factory's), the District's module building (`dist_module`: a 16x16 block with
a brass frame and a 6x6 window for the main output's icon, plus a 2-frame lit/working cycle),
`skiff` (a 10x8 brass rotor boat with a crate, 2-4 frame rotor), the District Dock, Hopper and
Bay; the Floating City and Scrap Transmuter pictures for the Megaproject page; Act III's
research icons if the tree uses them.

### Bot and pace (DESIGN.md §16, rules 1, 2, 5 to 40 h)
`src/sim/bot3.ts`: the Act III policy after the Act II plan in later runs. It designs tier 3
lines on the Workshop with Chute Mouths (one generic layout per recipe), feeds the Chute from
Factory modules, nests, places groups on the District with routes, and builds the megaprojects.
`tests/pace-act3.test.ts` measures the District's opening (~15 h), the gaps between goals and the
dead air to 40 h.

## Milestone 8: the second gate
The idle-critic plays Acts I-III with fast-forward and checkpoints (1, 5, 15, 30, 40 h); the
pacing-auditor runs the 40-hour pace sim. Findings are fixed or answered in `DECISIONS.md`; the
gate is marked passed with conditions (the owner's play from the 15 h checkpoint is owed, as at
the first gate).

## Milestone 9: Act IV, Worlds and Relocate
- **The World floor** (research *Charting*, Act IV page): 16x12, depth-3 modules, routes flown by
  **barges** (load 12, speed 3, a dearer price), its own Dock, Hopper and Bay (#4, #5).
- **Relocate** (`{ k: 'relocate', world }`): available once the World floor stands and the run
  holds at least 1 Legacy. Lost: everything a Reorganize loses, plus Patents (unspent and the
  tree) and the record on file. Kept: Legacy and its tree, megaprojects, reputation, the Codex,
  the Drawer (designs may not suit the new rule), trophies, lifetime statistics, the worlds'
  records. **Legacy** = floor(best value per floor this world (Workshop, Factory, District,
  World: steps x grade x tier, as filing) / 4 + 3 x megaproject stages done this world + 5 for an
  island not visited before). Not a root of a currency.
- **The Legacy tree** (~16 nodes, flat prices): the Standing Committee (auto-Reorganize when the
  preview passes a number you set), the Regrader (kept designs unfold and refold by themselves at
  a run's start), Contract Runners (special orders take from every Dock's sales), Old Habits
  (keep Patent nodes through a Relocate), a Patent purse to start each island, the Group Drawer
  for good, the Skiff Guild (routes start with 2 skiffs), and one softener per island rule.
- **Islands** (`src/data/worlds.ts`, a world id in the state): **Home** (no rule), **Pebble Isle**
  (chunks C, D, F are sky: half the land; deposits richer), **Cinder Isle** (vent tiles: a
  machine beside one needs no power and burns no fuel; belts can't be laid beside one), **Rime**
  (a powered machine runs at half speed unless a Heater is within 2 tiles or 2 working machines
  touch it), **the Old Works** (rubble on half the land, cleared for coin; ruined machines
  repaired for a quarter of their price; two ruins are whole lines). Each has one exotic deposit:
  skyglass, cinderite, rime crystal, relics.
- **Tier 4** (~12): Skyglass Lens, Cinder Alloy, Frost Alloy, Relic Gear, Storm Cell, Sunset Dye,
  Horizon Lens, **Pocket Weather**, **the Portable Sunset Generator**, the Sky Anchor's and the
  Lighthouse's parts.
- **Megaprojects #4 (the Lighthouse at the Edge) and #5 (the Sky Anchor)**, four stages each,
  one per island's product: every island is visited (§16: four by 60 h).

### The contract for building Milestone 9 (2026-10-22: the sim and the art in parallel)
Ids every agent shares. Numbers are first passes; the sim agent sets them with derivations.

- **Islands** (`src/data/worlds.ts`, `WorldId = 'home' | 'pebble' | 'cinder' | 'rime' |
  'oldworks'`; the island this world is on is `s.meta.world`, absent = `'home'`):
  - `home`: no rule.
  - `pebble` (Pebble Isle): chunks C, D and F are sky, not land (nothing is built there); Miners
    dig 1.5x. Exotic deposit: **skyglass**.
  - `cinder` (Cinder Isle): **vent** tiles (fixed per island); a machine with a vent beside it (4
    sides) needs no power and burns no fuel; no belt can be laid on a tile beside a vent. Exotic:
    **cinderite**.
  - `rime` (Rime): a powered machine runs at half speed unless a **Heater** (a new 1x1 Workshop
    building, kind `heater`, burns coal; research *Thermals*) is within 2 tiles, or two working
    machines touch it. Exotic: **rime crystal** (`rimeCrystal`).
  - `oldworks` (the Old Works): **rubble** on half the land (cleared tile by tile for coin, command
    `clear`); **ruined machines** (an Ent flag `ruined`) repaired for a quarter of their price
    (command `repair`); two ruins are whole lines. Exotic: **relics** (`relic`).
- **Tier 4 items** (`ITEM_IDS` order after tier 3): the four exotics `skyglass`, `cinderite`,
  `rimeCrystal`, `relic` (mined from their deposits), then `skyglassLens`, `cinderAlloy`,
  `frostAlloy`, `relicGear` (one per island, made from its exotic), `stormCell`, `sunsetDye`,
  `horizonLens`, `pocketWeather`, `sunsetGenerator` (the Portable Sunset Generator),
  `lighthouseLamp`, `anchorChain` (Megaproject parts, refused at the Dock).
- **Megaprojects #4 and #5** (`MEGAS.lighthouse`, the Lighthouse at the Edge; `MEGAS.anchor`, the
  Sky Anchor): built at the World's Bay, four stages each, each stage wanting one island's
  product (so all four islands are visited).
- **The World floor**: `HIGH.world` (already in `src/data/floors.ts`), opened by research
  *Charting* (Act IV page, `act: 4`); barges (`HIGH.world` speed 3, load 12).
- **Relocate** (layer 2): command `{ k: 'relocate', world: WorldId }`; **Legacy** (`s.meta.legacy`,
  a Num) and its tree (`src/data/legacy.ts`, nodes in `s.meta.legacyNodes`); islands visited in
  `s.meta.visited`; each island's best fold records in `s.meta.worldRecords`. SAVE_VERSION 9.
- **Art files** (`src/art/`): `items4` (the 15 tier 4 icons, 8x8, in that order, with `names`),
  `heater` (16x16, one facing, 4 frames), the exotic deposits `ore_skyglass`, `ore_cinderite`,
  `ore_rime`, `ore_relic` (as the existing ore patches are drawn), `vent` (16x16, animated),
  `rubble` (16x16 variants), `ruin_overlay` (cracks and moss over any 16x16 or 32x32 machine),
  `frost_overlay` (rime on a machine running cold), the island looks (Pebble's sky gaps, Cinder's
  ash ground and lava rim, Rime's snow and ice, the Old Works' broken paving), the World platform
  (`world_deck`, `world_edge`, `world_under`, `world_rotor`, grander than the District's;
  `world_dock`, `world_hopper`, `world_bay`), `mega_lighthouse` and `mega_anchor` (48x48, frames
  `p0a p0b p1a p1b p2a p2b p3a p3b p4a p4b run1 run2`), UI icons `world`, `legacy`, `relocate`.

### Act IV art as built (2e312bc, `pixel-art/act4/`, 0 PixelLab generations): what the code needs
Every sheet is `src/art/<name>.png` (1x, frames in one row) with a `<name>.json` sidecar; anchor
[0,0] unless stated.
- `items4`: 8x8, 15 frames with `names`, the contract's order.
- `heater`: 16x16, one facing, 4 frames, 8 fps, on the standard skid.
- `vent`: 16x16, 4 frames, 6 fps; ground, not a machine (no skid).
- `rubble`: 16x16, 6 frames (`slab bricks girder mixed pipes heap`).
- `ruin_overlay` (6 frames `s0 s1 s2 s3 b0 b1`) and `frost_overlay` (4 frames `s0 s1 b0 b1`): 32x32
  cells; `s*` fill the top-left 16x16 (for 16x16 machines), `b*` the whole cell (32x32 machines).
  Draw at the machine's top-left composited **source-atop** over the machine's own frame on a
  scratch canvas (sidecar `"composite": "source-atop"`); the pip corner is left clear.
- Exotic deposits `ore_skyglass`, `ore_cinderite`, `ore_rime`, `ore_relic`: laid out like
  `tile_ore_*` (16x16, 9 frames: 0 the outcrop, 1-4 quadrants TL TR BL BR on paving, 5-8 on that
  island's meadow; `glints`, `seats` in the sidecar); spills `ore_<x>_spill` (32 frames: 0-15 on
  paving, 16-31 on meadow, frame = (dy+1)*4+(dx+1)). `ground.ts` needs `ORE_ART` entries;
  `orefx.ts` globs `tile_ore_*.json` only, so widen it to `ore_*` for their glints.
- **Island looks**: `isle_<world>_` + the Home sheet's name with a leading `isle_` stripped
  (`isle_edge` → `isle_cinder_edge`, `tile_grass` → `isle_cinder_tile_grass`, `prop_tree` →
  `isle_cinder_prop_tree`, `tile_ore_iron` → `isle_cinder_tile_ore_iron`); every variant copies the
  Home sheet's frame size, count, order, anchor, fps and names; **a missing variant falls back to
  Home's sheet**. `*_vein` variants have Home's 16 names then `skyglass0..3` / `cinderite0..3` /
  `rime0..3` / `relic0..3`. Cinder and Rime have their own falls (`fall_top fall_head fall
  fall_foam`: lava on Cinder). **Pebble's half land is the renderer's job** (bake chunks A, B, E
  only; C, D, F are sky).
- **The World platform**: `world_deck` (16 frames), `world_edge` (28), `world_under` (9) with the
  `dist_*` names and order (the District renderer is reused with a prefix), `world_rotor` **64x32**,
  4 frames, 16 fps, anchor **(32, 0)**, `world_rotor_side` (48x32, 8 frames `w0..w3 e0..e3`, anchor
  (45, 15)), `world_dock`, `world_hopper` (32x32, 3 frames, 3 fps), `world_bay` (32x32, 5 frames
  `empty stage1 stage2 run1 run2`, as `dist_bay`).
- `mega_lighthouse`, `mega_anchor`: 48x48, 12 frames, 4 fps (`p0a p0b p1a p1b p2a p2b p3a p3b p4a
  p4b run1 run2`).
- UI icons `world` 36, `legacy` 37, `relocate` 38 in `ui_icons` (16x16) and `ui_icons_small` (8x8).

## Milestone 10: Act V, Beyond and the Last Fold
- **The Last Fold** (research *The Last Fold*, both #4 and #5 done): audit the whole World floor;
  its grade and value give **Kernels** (floor(value / 10) + grade bonus, first pass); everything
  a Relocate resets, plus Legacy and its tree and the worlds' records, resets; megaprojects, the
  Codex, trophies, reputation, the Drawer and Kernels are kept. The new universe's Workshop starts
  with **the Seed** (a 1x1 that hums and digs a little of each raw ore out of its four sides).
- **The Kernel tree** (~10 nodes): Wide Belts (2 items a belt tile), Every Side a Port, the
  Bigger Box (12x12), Beyond (the fifth floor, depth 4), the Second Cookbook (alternate recipes),
  Long Nights (offline ceiling 0.85), Kept Islands (worlds' records kept), and more.
- **Infinite orders** (the Endless Ledger): order n wants (n + 1) x a base amount of a product in
  turn, linear, never timed; every tenth pays a cosmetic.
- **Tier 5** (~8): impossible inventions (Bottled Tuesday, A Map of Everywhere, a Very Small Sun,
  the Pocket Island, the Quiet Engine, the Folded Universe Replica).

### The contract for building Milestone 10 (2026-10-22: the sim and the art in parallel)
Ids every agent shares; numbers are first passes the sim agent derives in DESIGN.md §23.
- **The Last Fold** (reset layer 3): research `lastFold` (Act V page, `act: 5`), open once both
  Act IV Megaprojects (`lighthouse`, `anchor`) are complete. Command `{ k: 'lastFoldAudit' }`
  audits every module on the World floor at once (the high-floor audit over the whole floor);
  its grade card offers `{ k: 'lastFold' }`, the reset. **Kernels** (`s.meta.kernels`, a Num) are
  paid from the audit's value and grade. Kept: every Megaproject, the Codex, trophies, reputation,
  the Drawer, Challenges won, Kernels and the Kernel tree. Lost: everything a Relocate loses, plus
  Legacy, its tree and the worlds' records. The new universe's Workshop starts with **the Seed**
  (kind `seed`, 1x1, not removable): it hums and digs a little of each raw ore out of its four
  sides.
- **The Kernel tree** (`src/data/kernels.ts`, nodes in `s.meta.kernelNodes`, ~10, flat prices):
  `wideBelts` (a belt tile carries 2), `everySide` (a module takes and gives on every side),
  `biggerBox` (the Workshop fold box 12x12), `beyond` (opens the fifth floor), `secondCookbook`
  (alternate recipes), `longNights` (the offline ceiling 0.85), `keptIslands` (the worlds' records
  kept through a Last Fold), `keptLegacy` (chosen Legacy nodes kept), `seedling` (the Seed digs
  more), `endlessLedger` (infinite orders). Rules, never "+X% everything".
- **Beyond** (the fifth floor, `HIGH.beyond`): depth-4 modules (folded on the World), its own
  carriers (`courier`: the high-floor routes), Dock, Hopper and Bay.
- **The Endless Ledger** (infinite orders): order n wants (n + 1) x a base amount of a product in
  turn, linear, never timed; every tenth pays a cosmetic (a machine skin id).
- **Tier 5** (`ITEM_IDS` after tier 4): `bottledTuesday`, `mapOfEverywhere`, `verySmallSun`,
  `pocketIsland`, `quietEngine`, `foldedUniverse` (the Folded Universe Replica),
  `everlastingSandwich`, `infiniteStaircase`; made on Beyond's modules' groups from tier 4 goods.
- **Art files** (`src/art/`): `seed` (16x16, 4 frames, a hum), `items5` (8 icons, contract order,
  with `names`), the Beyond platform (`beyond_deck`, `beyond_edge`, `beyond_under`,
  `beyond_rotor`, `beyond_dock`, `beyond_hopper`, `beyond_bay`, frame-compatible with `world_*`;
  the highest platform: starlit, almost no sky below), `courier` (Beyond's carrier, 4 frames),
  `lastfold` (the Last Fold's moment: the World folding into one tile, a strip of frames for a
  full-screen sequence), UI icons `kernel`, `beyond`, `lastFold`, `ledger`.

### Act V art as built (`pixel-art/act5/`, `python build.py`, 0 PixelLab generations): what the code needs
Every sheet is `src/art/<name>.png` (1x, frames in one row unless `facings`) with a `<name>.json`
sidecar; anchor [0,0] unless stated. Nothing is wired in TypeScript yet.
- `seed`: 16x16, 4 frames, 4 fps, one facing, on the standard skid; frame 0 is the still pose (a
  stopped Seed holds it); the pip corner is empty in every frame.
- `items5`: 8x8, 8 frames with `names`, the contract's order.
- The Beyond platform, frame-compatible with `world_*` (the District renderer with a prefix):
  `beyond_deck` (16, the `dist_deck` names), `beyond_edge` (28), `beyond_under` (9),
  `beyond_rotor` **64x32, 4 frames, 8 fps, anchor (32, 0)** (a star pod, not a rotor),
  `beyond_rotor_side` (48x32, 8 frames `w0..w3 e0..e3`, 8 fps, anchor (45, 15); without it the
  renderer would fall back to `fplat_rotor_side`'s propellers), `beyond_module` (16x16, 4 frames,
  6 fps, `"icon": [4, 6]`, as `world_module`), `beyond_dock`, `beyond_hopper` (32x32, 3 frames,
  3 fps), `beyond_bay` (32x32, 5 frames `empty stage1 stage2 run1 run2`, 6 fps: an armillary
  sphere). Beyond's backdrop is the code's: night (`ink` to `ink1`, stars), no cloud sea.
- `courier`: 16x12, 4 frames (wing up, level, down, level), 8 fps, anchor (8, 11), facing right
  (flip it for leftward legs, as the skiff).
- `lastfold`: 128x72, 16 frames, `fps` 0 with per-frame `durations` (ms, 5.4 s in all), `names`
  (`world audit fold1..fold6 tile flash dawn fall1 fall2 land seed1 seed2`), `loop` [14, 15] (hold
  until the cut to the new Workshop), `events` (audit 1, folds 2-7, tile 8, flash 9, fall 11, land
  13: for sound and shake), `seedAt` [56, 39]. Drawn full-screen at a whole-number cover scale.
- Skins (every tenth Ledger order): `skin_gilded_miner`, `skin_candy_press`,
  `skin_candy_press_mk2`, `skin_starlit_assembler`, `skin_starlit_assembler_mk2`: the base
  sheet's exact layout, fps and `facings`, plus `"skin"` and `"base"` in the sidecar; skin ids
  `gilded`, `candy`, `starlit`. Draw `skin_<id>_<kind>` in place of `<kind>` when it exists.
- UI icons `kernel` 39, `beyond` 40, `lastFold` 41, `ledger` 42 in `ui_icons` and `ui_icons_small`.

## Milestone 11: the long tail
150+ trophies with small specific bonuses (generated tiers over deliveries and counters, plus
hidden ones); the Codex completed with lore pages and Unit 7's ending; challenges to 15 and
scenarios to 8; cosmetics (machine skins and decorations from reputation and challenges); a photo
mode exporting a PNG of a floor; local efficiency boards per scenario.

## Milestone 12: sound and juice
Procedural voices per machine family, belts, the fold's signature sound, an audit chime per
grade, Sparks, orders, resets (all three layers), skiffs; mute, volume per bus, reduced motion.

## Milestone 13: onboarding, UX and accessibility
Lesson cards on firsts (starved machine, slag jam, first fold, first route, first Relocate),
rates in every tooltip, rebindable keys, UI scale, colourblind-safe pips (shapes as well as
colours), and a "where am I stuck?" button that names the current bottleneck.

## Milestone 14: balance, performance and release
The pace sim to 100 h (`npm run pace100`, headless, the late game compressed through modules);
200 modules a floor at 60 fps; saves under 200 KB; the README; GitHub Pages at the final name. No
itch.io page (the owner). No desktop build (not wanted).
