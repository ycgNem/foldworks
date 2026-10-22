# Foldworks — Design model

Every number in `src/data/` derives from a section here. Each has a `derivation` string naming
that section, and the data validation test enforces it. **These are first-pass numbers.** The
Milestone 1–2 pace tests will move them. Change a number here first, explain the change in
`DECISIONS.md`, then change the data. Never tune silently.

Sections 1–14 are the slice (Milestones 1–2). Section 15 sketches the later systems. Section 16
is the 100-hour pacing model, and every milestone after the gate is measured against it.

## 1. Units

- **Tick**: 20 Hz (50 ms). The player sees rates **per minute**; data stores seconds per craft.
- **Tile**: 16 px. Workshop machines are 1×1 in the slice; Mk2+ footprints come in Act II.
- **Item on a belt**: an 8×8 px icon. At most 1 item per belt tile.
- **Numbers**: every amount of coin or items is a `Num` (`src/engine/num.ts`), from day one.
  Display: `1,234` → `12.3K` → `4.56M` …, with scientific, engineering and letters notations as a
  setting (§20).
- **Clicks**: pace math assumes **4 clicks/s sustained** while actively clicking and a
  **12 clicks/s** ceiling (faster clicks are ignored, so autoclickers buy nothing).

## 2. The loop, per minute (Act I)

Click or mine ore → smelt → press or assemble → belt to the **Dock** (coin) or the **Hopper**
(research) → buy machines, land and research → fold the line → stamp it on the Factory floor.
A healthy minute in Act I has one purchase or one decision (`§16`'s next-goal rule).

## 3. Items and recipes (slice)

Item values are what the Dock pays (Mayor Bramble's standing order). Each step adds value, and
a longer chain earns more per machine-second, so depth beats breadth.

| Item | Made by | Recipe | Time | Value | Derivation |
|---|---|---|---|---|---|
| Iron ore | Miner, hand | — | 2.0 s (miner) | 1 | base unit |
| Copper ore | Miner, hand | — | 2.0 s (miner) | 1 | base unit |
| Iron ingot | Smelter | 1 iron ore | 2.0 s | 3 | 3× ore: smelting is the first, big reward |
| Copper ingot | Smelter | 1 copper ore | 2.0 s | 3 | same as iron |
| Slag | Smelter (byproduct) | 1 per 4 ingots | — | 0 (Dock refuses it) | §4 Byproducts |
| Iron plate | Press | 1 iron ingot | 1.5 s | 5 | +2 per press step |
| Copper wire | Press | 1 copper ingot → 2 wire | 1.5 s | 2 each | 4 per ingot: +1 over the ingot |
| Gear | Assembler | 2 iron plates | 2.0 s | 14 | 10 in → 14 (+40%) |
| Slag brick | Press | 4 slag | 3.0 s | 6 | research 9: waste becomes value |
| **Gizmo** | Assembler | 1 gear + 2 wire | 4.0 s | 80 | 18 in → 80 (×4.4): the first product |

*Gizmo flavor text: "Does something. Bramble isn't sure what. Bramble loves it."*

**Ratios this creates** (the Act I puzzles):
- Miner 30/min : Smelter 30/min → **1 : 1**.
- Smelter 30/min : Press 40/min → **4 smelters : 3 presses** for plates.
- Gear needs 60 plates/min per assembler → **1.5 presses per gear assembler**.
- A Gizmo assembler (15/min) needs 15 gears/min (½ a gear assembler) and 30 wire/min (3/8 of a press at 80 wire/min, ½ a copper smelter).
- *Re-derived (Milestone 4, from the critic's review):* the Gizmo was 1 gear + 3 wire, which with
  gear = 2 plates and wire 1 → 2 copied the shape of Factorio's electronic circuit. Two wire keeps
  the iron side the bigger build (pillar: the gear line is the hard part) and makes the copper
  line a single smelter-and-press pair, so the Gizmo line fits one fold box once chunk B's patch
  is near enough. Gear = 2 plates and wire 1 → 2 stay: §3's value steps (+40%, +1 per ingot)
  derive them, and they are conventions several factory games share, not one game's shape.

## 4. Machines and logistics (slice)

| Thing | Size | Cost (coin) | Behaviour | Derivation |
|---|---|---|---|---|
| Hand Furnace | 1×1 | starts placed | smelter that needs cranking: each click on it = 0.25 s of progress | §6 |
| Bellows (upgrade) | — | 25 | makes the Hand Furnace a normal 2.0 s smelter | §16: first purchase at 20–40 s |
| Miner Mk1 | 1×1 on ore | 40 | 1 ore / 2.0 s (30/min) | §16: first miner < 2 min |
| Smelter Mk1 | 1×1 | 60 | recipe chosen on the machine | §3 |
| Press Mk1 | 1×1 | 150 | research 1 | §3 |
| Assembler Mk1 | 1×1 | 500 | research 5 | §3 |
| Belt Mk1 | 1×1 | 1 / tile | 2 tiles/s, 1 item per tile → **120 items/min** | 4 miners fill one belt |
| Splitter / Merger | 1×1 | 20 | alternates outputs / inputs; skips a blocked side | research 6 |
| Buffer Crate | 1×1 | 30 | holds 50, passes through first-in first-out | research 7 |
| Slag Heap | 1×1 | 25 | holds 400 slag (≈53 min of one smelter's 7.5/min); full → feeding smelters block; empties out of its front into a belt or a brick press | §4 Byproducts |
| Dock | 2×2 | starts placed | takes anything except slag; pays its value at once | §7 |
| Hopper | 2×2 | starts placed | takes anything; counts toward research | §8 |

**Machine buffers**: input holds 2 crafts' worth, output holds 4 items. A full output is
**blocked**, an empty input is **starved**. Machines pull from belts that face into them and
push onto the belt their output side faces. Rotation is R.

**Machine prices are flat** (no growth per purchase, see the not-list). In the Workshop,
growth is limited by **land** (§9), research gates (§8) and the coin per machine-second
of what you make. On the Factory floor it is limited by stamp costs (§10).

**Byproducts.** Each smelter makes 1 slag per 4 ingots into a separate slag output. If the slag
output is full, the smelter stops ("blocked: slag"). That's the first bottleneck lesson: route
slag to a Slag Heap or, after research 9, to a press making bricks.

**Status pips** (pillar 3): every machine draws one. Green = working, yellow = starved (names
the item), red = blocked (names the item), grey = unconnected. Hovering shows the status and its
cause ("Smelter 3: starved of iron ore 41%"); clicking pins the whole report: "feeding miner makes
30/min, this smelter wants 30/min, the belt is shared with smelter 2."

## 5. Floors (slice)

- **Workshop**: the design bench. It stays live for the whole game. The slice map has four
  8×8 land chunks (§9) with 2×2 ore patches: iron in chunk A, copper in chunk B, a second iron
  patch in chunk C.
- **Factory floor**: unlocked by the first fold. A 12×8 grid where each tile holds a module, a
  trunk belt (8 items/s, i.e. 480/min) or a Factory Dock or Hopper. It's described in §11.

The player switches floors with Tab or the floor tabs. Both floors run all the time.

## 6. Clicking and Sparks

- **Hand-mining**: clicking an ore patch tile puts 1 ore into a machine next to it (the Hand
  Furnace at the start), which holds up to 4. With no machine next to it, the click does nothing.
- **Cranking**: clicking the Hand Furnace adds 0.25 s of progress (8 clicks per ingot before the
  Bellows). At 4 clicks/s, about 9 clicks per ingot earns **≈1.3 coin/s**, so the 25-coin Bellows
  takes **≈20 s**. That matches §16's first purchase target.
- **After the Bellows**, the furnace runs itself at 2.0 s per ingot and needs 1 ore click per 2 s
  (1.5 coin/s). The first Miner (40 coin) takes **≈27 s** and ends the clicking.
- **Sparks** (slice set). One every 3–6 min (uniform), visible for 20 s, on the Workshop floor:
  - **Lucky Vein**: an ore patch tile glitters. Click it and that patch's miners **and every
    machine of the line they feed** run at 3× for 60 s. It only appears on a patch that has a
    working miner. *(Milestone 3 gate audit: boosting only the miners did nothing in a balanced
    1:1 line; the extra ore just backed up.)*
  - **Inspector**: walks up to a line (the busiest connected group of machines). Click and they
    grade it with §10's audit formula and hand **60 s of that line's measured output × the
    grade multiplier to research, as items** (the selected node first, then the bank). This
    rewards a good line, not a lucky click. *Paid in kind, not coin (Milestone 1–2 review): a
    coin windfall sized by current output is the shape of Cookie Clicker's golden cookie.*
  - Missing a Spark costs nothing. Sparks pause while the tab is hidden (no offline Sparks).

## 7. The Dock, orders and Mayor Bramble

- **Standing order**: the Dock buys every item except slag at its §3 value. It's always open.
- **Special orders** (Bramble's slice set). Each one is optional and never timed, and only one
  is active at a time:

  | Order | Wants | Pays | Derivation |
  |---|---|---|---|
  | The Boardwalk | 80 iron plates | 600 coin + 1 rep | 1.5× value: worth routing a line to it. 80, not 200 (round 3) or 400 (first draft): a player who accepts it the moment Pressing offers it has one plate line on the Dock, so every coin of income stops until it is filled; at 30 plates/min, 200 was 6.7 min with no coin at all (the greedy bot's longest stretch, §13 check 10), 80 is 2.7 min |
  | Lamp Posts | 60 gears + 200 wire | 2,000 coin + 1 rep | 1.6× value. 60 gears, not 150 (pacing round 4): one order runs at a time, and its gears are research's until Folding, so at 150 it held the order slot, and the Gizmo Festival behind it, ~9 min after Folding |
  | The Gizmo Festival | 400 Gizmos, **Factory Dock only** | 64,000 coin + 1 rep | 2×. Offered with Folding; filling it ends the slice (§11). Only Factory Dock deliveries count, so it needs Gizmo modules fed by ingot (or gear) and wire modules: the Factory floor built, not the Workshop's Gizmo assembler |

  Items delivered to the Dock fill the active order first, then sell.
- **Reputation (Bramble)**: 1 rep → plates sell for +20%. 2 rep → one free Buffer Crate a
  minute up to 5 (logistics help). 3 rep → the Lily Pad Dock skin.

## 8. The Hopper and research (slice)

Research nodes cost item deliveries. The Hopper takes anything (slag only while the selected node
still needs slag); each node fills from matching
deliveries while it's **selected** (one at a time). Items delivered with nothing selected are
banked by type for the next node.

| # | Node | Cost (delivered) | Unlocks | Derivation |
|---|---|---|---|---|
| 1 | Pressing | 30 iron ingots | Press, iron plate | §16: first research ≈ 5 min |
| 2 | Survey East | 40 iron plates | buy land chunk B (copper) | |
| 3 | Copper Smelting | 80 copper ore | copper ingot recipe | ×2 (below) |
| 4 | Wire Drawing | 120 copper ingots | copper wire on the Press | ×2 |
| 5 | Gearcutting | 160 iron plates | Assembler, gear | ×2 |
| 6 | Splitters & Mergers | 100 gears | Splitter, Merger | ×2 |
| 7 | Buffers | 200 plates + 40 gears | Buffer Crate | ×2 |
| 8 | Gizmo Theory | 120 gears + 300 wire | Gizmo recipe, Bramble's Gizmo Festival, land chunk C | ×2 |
| 9 | Slag Bricks | 200 slag | slag brick on the Press | §4: waste becomes an input; ×2 |
| 10 | **Folding** | 50 Gizmos + 500 gears | the Fold tool, land chunk D | §16: first fold ≤ 40 min; ×2, then 500 gears (round 3, below) |

**Why nodes 3–10 are ×2 the first draft** (2026-10-20, pace tests). At the first-draft costs the
planner bot researched Folding at **19:01** (mean of 50 seeds) and the Dock-only bot only **3.5 min**
later: once chunks A and B are built (~16 min) the lines make research items far faster than the
nodes ask for them (Folding's 200 gears were 4.4 min of the planner's 45 gears/min into the Hopper),
so feeding the Hopper only when stuck cost almost nothing. One uniform factor k on nodes 3–10 was
scanned over [1, 2.5] (20 seeds each, chunk C at 4,000 after Gizmo Theory, Boardwalk 200):

| k | planner Folding | Dock-only behind | greedy longest no-decision stretch |
|---|---|---|---|
| 1 | 19:07 | 3.4 min | 379 s |
| 1.5 | 23:22 | 6.6 min | ~380 s |
| 2 | 26:52 | 10.3 min | ~370 s |
| 2.5 | 29:17 | 15.4 min | ~330 s |

k = 2 puts the planner's Folding in the middle of the 22–30 min window (50 seeds: **26:42**, range
23:49–29:05) with the Dock-only player **10.5 min** behind; k = 2.5 would meet the first draft's
15-minute gap but leaves the planner at the edge of the window (worst seed 31:25). No k brings the
greedy bot's longest stretch under 3 min (§13 check 10): its long stretches are saving for chunk C
and the Boardwalk, not research.

**Round 3: Folding 400 → 500 gears, with chunk C at 1,000** (2026-10-20, 10 seeds a cell, then 50).
After the sim changes since round 2 (the Inspector pays research in kind; the Gizmo is 1 gear + 2
wire) the Dock-only player was only **4.1 min** behind (planner 27:13, Dock-only 31:20; §13 check 11
wants 5). The planner's chunk C was the reason: saving 4,000 at 180–540 coin/min (Lamp Posts holds
the Dock's gears and wire, research takes the rest) put chunk C at **27:44**, after Folding
(27:31), so its four Hopper gear lines never fed it. At 1,000 chunk C lands at **22:28** and those
lines (60 gears/min) carry Folding; more gears on Folding then widen the gap, because the planner
has four lines on the Hopper and the Dock-only player turns one when it is stuck:

| chunk C | Folding gears | planner Folding | Dock-only behind | greedy longest stretch |
|---|---|---|---|---|
| 4,000 | 400 | 27:31 | 4.0 min | 492 s |
| 2,000 | 400 | 26:58 | 4.6 min | 283 s (Boardwalk 200) |
| 2,000 | 600 | 29:02 | 8.7 min | 283 s (Boardwalk 200) |
| 1,000 | 500 | 27:16 | 7.5 min | 163 s (Boardwalk 80) |
| 1,000 | 600 | 28:12 | 9.6 min | 163 s (Boardwalk 80) |

500 keeps the planner in the middle of the 22–30 window (50 seeds: **27:07**, 26:08–28:18) with the
Dock-only player **7.1 min** behind, the smallest step that clears 5 with room; 600 gives ~9.5 min
but moves the planner a minute nearer the window's edge for no check that needs it. Lamp Posts (150 gears + 300 wire) was scanned at 60 + 150 and 100 + 200 and changed nothing
the checks measure (the bots send their gears to research while it wants them), so it stays.

Delivering to the Hopper instead of the Dock costs the item's coin value. That opportunity
cost is the point.

## 9. Land

The Workshop starts with chunk **A** (8×8: an iron patch with the Hand Furnace beside it, a
3-tile belt from the furnace to the Dock, and the Hopper). Chunk **B** (east, copper patch) costs 1,000 after Survey East. Chunk **C** (south,
second iron patch) costs 1,000 after **Gizmo Theory**: the thing to save for and build in the
stretch before Folding is its gear lines (~3,000 of machines, bought one at a time), not the land.
At 4,000 the save took 8–10 min of 180–540 coin/min (§13 check 10's worst dead air) and landed after
Folding, so the lines never fed it (§8, round 3). The planner builds four gear lines on it that feed
the Hopper's south side; after Folding it folds one pair's miners and smelters into "Iron ingots" and
their presses and assembler into "Gear works" (§13 check 9). Chunk **D** (southeast, empty) costs
12,000 after Folding; no bot needs it in the slice. The full
slice Workshop is 16×16. Placing on land you don't own is refused with "Buy this chunk: N coin".

## 10. Folding (the signature mechanic)

1. **Select.** The Fold tool drags a box, at most 8×8 in the slice. It must contain **at least
   two kinds of machine, or one machine feeding another** (a module is a line, not a part: a lone
   miner in a 1×1 box graded S; an all-assembler line such as circuits into motors is a line)
   and no Dock, Hopper or Hand Furnace, and every building in it wholly. Belts crossing the box
   edge become the module's **ports** (in or out, by belt direction). Power never crosses the
   box (§18). While a box is audited, Lucky Veins and Overdrive don't touch it, so a boost is
   never folded in for good. *The final round:* that includes an Overdrive clicked before the
   audit began. Its 3× stops at the audit's first tick for every machine, Miner and module in the
   box, and its timer and cooldown run on. This holds for the Workshop, for nested boxes, and with
   Quick Audits' 5 s warm-up, which is shorter than Overdrive's 10 s. It was leaking: a line
   overdriven just before its audit folded at up to 3× its rate.
2. **Audit.** The box keeps running for **70 s** of sim time (10 s warm-up + a 60 s window) while
   you play on. The game measures, per item: rate in through ports, rate out through ports, and
   items made inside (miners count as made inside). Over the window it also tracks each
   machine's busy fraction and where the byproducts ended up. **Stock already in the box** is
   counted when the window opens: what of it drains out as the same item comes off that output,
   and the rest of what drains (more than 3 of an item: belts settling) is an **input** the module
   will need. *Derivation (Milestone 3 gate, Milestone 4 review): a crate of Gizmos draining out
   graded as a Gizmo factory, and a crate of steel feeding a kit assembler folded into kits made
   from nothing.* The Great Drill's boost never reaches a machine being audited (it would be
   counted twice once the module runs boosted).
3. **Grade.** `score = 0.6·U + 0.2·W + 0.2·C`
   - **U** = mean busy fraction of the machines in the box.
   - **W** = byproducts leaving through ports or used inside ÷ byproducts made (1 if none are
     made). A machine blocked by its byproduct counts the byproducts it would have made, so a
     line jammed by slag scores W = 0, not 1. A heap inside the box is waste: as a module it
     would never fill.
   - **C** = min(1, (machine tiles ÷ box tiles) ÷ 0.6).

   | Grade | Score | Rate multiplier |
   |---|---|---|
   | S+ | ≥ 0.97, and its byproducts used inside the box (80%), or none made | ×1.35 |
   | S | ≥ 0.90 | ×1.25 |
   | A | ≥ 0.80 | ×1.10 |
   | B | ≥ 0.65 | ×1.00 |
   | C | ≥ 0.50 | ×0.90 |
   | D | < 0.50 | ×0.75 |

   *Derivation: a balanced 4-smelter/3-press plate line with slag handled reaches A (0.873).
   Slag backing up lands at D. A realistic one-machine imbalance (4:2 or 3:3) lands at B
   (0.73–0.80), one grade step (×1.10 → ×1.00) plus the machine it didn't need; feeding every
   ingot to one press lands at D. So balancing is worth a grade step and a machine, and slag is
   worth the whole grade. (Measured at the Milestone 3 gate; the earlier claim of a 25–50% gap
   for any imbalance was too strong.)*
4. **Fold.** The machines go into the module, the belts are refunded, and the box empties. The
   module is a 1×1 item with a name you choose (the default is its main output, e.g. "Plates
   ×28/min"), its port list, and its rates × the grade multiplier.
5. **Unfold.** A module in inventory can be unfolded back onto the Workshop if the box fits
   on free land. That's how you edit a design.
6. **Stamp.** Copying a module costs `bill × (1 + 0.5·n)`, where *bill* is the sum of the
   machine (and power building) prices inside and *n* is the number of copies already made
   **of anything with the same main product**: every stamp of every such design, plus every
   fold of it after the first (so re-folding the same line never resets the price). The
   increase is linear, not geometric. *Derivation: the 5th copy costs 3× the first, so a new,
   better-graded module soon beats another copy of an old one, and designing stays the
   engine (pillar 1).* The Factory floor's 96 tiles are the other limit.
7. **Modules with miners inside** hold deposit claims, one per ore per copy (§18 Land and
   deposits); a stamp beyond your claims is refused with the reason.

## 11. The Factory floor (slice portion)

- 12×8 tiles. Modules are 1×1 here, with one input side (accepts any of the module's input
  items) and one output side (emits its outputs round-robin). Rotation is R.
- **Byproducts leave by a side**: a trunk at a module's left or right side pointing away from
  it carries the module's byproducts (slag, oil), the way a Workshop machine's byproduct
  leaves by a side (§4). With no side trunk they go out of the front with the rest, and a
  module that doesn't take them refuses them. *Derivation (Milestone 1–2 review): without it,
  the only module that could feed another was one hiding its slag in a heap.*
- **Trunk belts**: 8 items/s (480/min), 2 coin per tile. A **Factory Dock** and a **Factory
  Hopper** at the floor's edge, which work like the Workshop's.
- Modules run as rate functions, not crafts: each tick a module consumes its inputs at rate
  if they're available (fractional amounts banked), produces at rate, and is **starved** or
  **blocked** in proportion. The same status pips apply. A byproduct with nowhere to go blocks
  it; of its products it runs while any one has room, and a full one **spills** (the hover says
  so). *Derivation (Act II's bot): a glass-and-plastic module feeding circuits, which take the two
  in another ratio than it makes them, stopped for good when the plastic backed up.*
- **The slice ends here**: when **Bramble's Gizmo Festival** is filled, 400 Gizmos delivered to
  the **Factory Dock** (§7). Then Bramble's closing line and a "Milestone reached" card. A Gizmo
  module needs a Gizmo line folded with at least one other kind of machine (a module is a line,
  §10) and modules feeding it ingots or gears and wire at matched rates, so the floor is a puzzle
  and a build: one Gizmo chain makes ~0.27 Gizmos/s (25 min for the Festival), so the player stamps
  more chains while claims (§18) and coin allow. *Derivation (the Milestone 3 gate): the earlier
  rule (three products chained for 30 s) was met by the audit timer alone, 4:18 after Folding;
  before that, three copies of one module beside the Dock ended the slice 15 s after the first
  fold (Milestone 1–2 review).*

## 12. Offline (finished in Milestone 6; the numbers' derivations are in §20)

- On load, or when a hidden tab comes back with time the background pump could not run (§20),
  elapsed time `t` (capped at **7 days**; the slice had 24 h) is computed as:
  1. **Replay**: up to **1 h** of real ticks headless (72,000 ticks), every floor, through the same
     systems: Workshop lines item by item, modules as rates. Heaps fill and lines jam during it as
     they would live. **The compute budget** (§20) shortens it on a big factory: a tick's cost is
     estimated from the number of things that tick, and the replay takes three quarters of about
     5 s of ticks (4 min at least), so an Act II factory replays about 20 minutes and a 15 h one
     about 6.
  2. **Extrapolate the rest in segments.** Rates come from what reached each Dock, Hopper and the
     Megaproject Bay over the last 5 minutes of live ticks, and from each rising Slag Heap's fill
     rate. A segment runs until the next thing that would change those rates: **a heap filling**,
     **the Bay getting all it wants of an item**, **the active order filling** (the Dock stops
     taking what it took only for that order: the Committee's slag or oil) or **the selected
     research finishing** (the Hopper stops taking slag for it). Then that heap is set full (or the
     want met, the order or node topped up by the last fraction of an item), **4 minutes are
     replayed live** (60 s for the jam to spread, 3 min to measure the new rates), and the next
     segment starts. A jam inside a measuring window opens it again from that moment (at most 8
     times in one live stretch), so a line that stopped while being measured is not paid on. Lines run at the same physical speed as live, so heaps fill and
     lines jam at the same times whether the game was open or closed; what they deliver while
     extrapolated counts at the **offline efficiency**, paid through the same functions as live
     (orders first, then sales; research credit; Machine Kits to the parts bank; the Bay's stage),
     in 15-minute slices so an order or a node lands on the timeline near its time.
  3. **Efficiency**: `offlineEfficiency(g)` (`src/sim/offline.ts`): **0.5**, plus the Night Shift
     bought with coin (+0.05 twice, §20), plus Milestone 5's Patent nodes, never past **0.75**. The
     replayed hour and the re-measures pay in full, as open: a closed game pays **100% for the
     first hour and e for the rest**, which every screen says in those words.
- **No Sparks while away** (§6): the run tells the sim the tab is hidden.
- **The report** is a timeline: **one row per line that stopped** (a jam is a machine or module
  blocked **10 s straight**, so belt traffic is not a jam; a cascade is one line: the Workshop's
  item-flow lines, the Factory's trunk-joined modules), naming the **root cause** (the first
  machine to block and why: "its Slag Heap filled", "its copper ingots had nowhere to go", "the
  Dock stopped taking slag (The Pile filled)"), **how many machines it stopped** and **a fix the
  player can build** ("9 more Slag Heaps keep it running 8h", "a belt taking copper ingots to the
  Dock"), with a button that jumps to the root; each **heap filling** that stopped nothing; **orders
  filled**; **research finished**; the **Megaproject**'s stages and its wants met. **On the high
  floors** (since the Acts IV-V review): a District, World or Beyond module that ran under half
  speed 10 s straight is a row like a Workshop line (copies of one group stopped the same way are
  one row, "Motors II's line stopped: Servos II takes no more motors (7 modules, 5 copies)"), with
  the District's starved report's cause and fix ("its gears wait on the skiffs", fix "1 more skiff
  on the Gears II route"); **a route short of carriers** (under 90% of its want, the Dispatcher's
  test) is a row naming it and how many carriers it is short ("The Concrete II to Dock route was
  short of 2 skiffs the whole time", fix "2 more skiffs carry all its steel", a chip "carries
  42%"), with a Go button that pins the route. **The Standing Committee never Reorganizes while
  away**: its number reached is a row, "The Committee would have reorganized at 28 Patents", and
  it fires at its next check once you are back. A `~` marks a time
  worked out from the rates rather than replayed. Then the totals: coin, items into the Hopper,
  Machine Kits banked, what the Bay was given, what sold most. Its footer says how the number was
  made ("Paid: the first 1h 04m at 100% (as if open), the other 6h 56m at 50%"; on a big factory
  "the first 6m 35s at 100%, the other 7h 53m at 55%"), so it is a number the player can check
  (pillar 4).
- **The forecast** (§20, "safe for overnight") is this same run on a copy of the game.
- *Measured* (§13 check 12 and §20's stage table): at every stage measured (the slice end, run 1
  at 1–5 h, the campaign's runs 2, 3 and 4 to 13.9 h of play, seeds 1000 and 8919), 8 h offline
  pays 0.56–0.61 of 8 h open and idle at 0.5 and 0.78–0.81 at the 0.75 ceiling; the 7 h after the
  first pay 0.50–0.54 and
  0.75–0.77 of what open idle pays in them. *Re-measured with the compute budget* (§20; check 12
  (b) now read after the replayed window): the slice end replays 31 min and pays 0.56 / 0.78 of
  open idle, the rest at 0.52–0.53 / 0.76–0.77 (both seeds); run 1 at 1 h and 2 h replays 22 and
  20 min and pays 0.56 and 0.53 at 0.5 (the rest at 0.53 and 0.51), 0.78 and 0.76 at 0.75 (0.77,
  0.75); the Night Shift now pays back in 0.96 and 1.65 nights (more of a night is paid at e).
  Runs 2–4 (the other pace-idle files) were not re-run in this change. Open and idle the factory earns less every hour as
  heaps fill (the slice factory: 126K in its first hour, then 48K, then 40.5K an hour once 11 of 23
  Workshop machines have jammed).

## 13. Derived checks (these become pace tests)

Each check runs headless with a scripted bot over 50 seeds (Spark timing is the only random
part of the slice) and asserts the mean, with the spread logged.

1. **First purchase**: an active bot (4 clicks/s) buys the Bellows in **20–40 s**.
2. **Hands-free**: the first Miner by **2:00**.
3. **First research** (Pressing) by **6:00**.
4. **Land**: chunk B bought by **12:00**.
5. **First Gizmo** by **20:00**.
6. **Folding researched** at **22–30 min** (planner mean; none later than 35:00), and the first
   fold done by **40:00**.
7. **Balance beats buying**: the balanced plate line folds at **A or better**, and the
   unbalanced line with the same machines folds at **C or worse**.
8. **Slag lesson**: a smelter line with no slag route stalls within **3 min**.
9. **Slice end**: Bramble's Gizmo Festival filled (400 Gizmos at the Factory Dock, §7, §11), by
   **45 min** (planner mean), and no sooner than **6 min** after Folding is researched (three
   audits at once, then the floor built and 400 Gizmos made). The greedy and Dock-only bots reach
   it too, by 60 min. *Revised in round 3 from 60–90 min, and in round 4 to the Festival; see below.*
10. **No dead air**: in the first 35 min (or until the slice ends, if sooner), the greedy bot's
    longest stretch with nothing bought, researched, filled or folded is **3 min** or less on a
    typical seed (the mean over seeds of each seed's longest stretch) and **5 min** or less on 9
    seeds in 10 (the p90). *Reworded in the Milestone 5-6 review round:* it read "no stretch longer
    than 3 min" while the test asserted the mean, and the worst seeds wait about 4 min; both
    bounds are now asserted.
11. **Hopper versus Dock**: a player who sends everything to the Dock still reaches Folding by
    **60 min** (the Hopper is a choice, not a trap), but at least **5 min** behind the planner.
12. **Offline** (rewritten in round 3: §12's ×0.5 and the old "less than 2 h of active" contradicted
    each other, since 8 h at ×0.5 is already 4 h; restated for any efficiency e in the Milestone
    5–6 review round): 8 h offline, at e = 0.5 and at the 0.75 ceiling, (a) pays no more than
    leaving the game open and idle for the same 8 h (a live run of the state with no inputs) and at
    least e of it, and (b) pays the first hour as open idle pays it and **the other 7 h at e − 0.03
    to e + 0.05 of what open idle pays in them** (the re-measures pay in full: the + 0.05; whole
    items floored per credit slice: the − 0.03). At e = 0.5 this is the old bound, 1 h + 7 h × 0.5 =
    4.5 h, with the factory's own idle hours in place of the planner's active rate; at 0.75 the old
    form read 5.52 h of active and meant nothing. A second form, "at most (1 + 7e) h of the first
    idle hour", was tried and is wrong: where the factory is still settling, open idle earns more
    in later hours than in the first (60K in the first hour at run 1's 3 h stage, 67K an hour
    after), so it fails by up to 13% while offline pays exactly what the model says. Checked at the
    slice end (`tests/pace-offline.test.ts`) and at every stage of §20's table.

**Measured** (round 4, 2026-10-20, `tests/pace-*.test.ts`, 50 seeds unless noted, mean (range)):
Bellows 0:21; first Miner 0:47; Pressing 1:47 (Dock-only 3:13); chunk B 9:20 (7:38–10:28); first
Gizmo 16:13 (14:41–17:50); Folding 23:19 (21:03–26:03); first fold 24:35 (22:18–27:18); slice end
31:43 (29:32–34:32), 8:23 after Folding (7:30–8:44), with "Iron ingots" S+ (1.00), "Copper wire" S
(0.95) and "Gizmo works" A (0.89) on seed 1000; greedy slice end 28:55 and Dock-only 39:09
(36:19–44:23) (10 seeds each); check 7: balanced A 0.873 (U 1.00, W 1.00, C 0.37), wrong ratio D
0.474 (U 0.34), slag backing up D 0.073 (U 0, W 0); check 8: jam 38 s after the line starts; check
10: greedy's longest stretch 171 s (104–244, p90 243); check 11: Dock-only Folding 32:26 (29:30–38:01), 9.1
min behind; check 12 (2 seeds): 8 h offline = 3.97 h of active earning, 0.59 of 8 h open and idle (Milestone 6's segmented model: 3.94 h, 0.58–0.59, §20; the review round's restatement: see §20's slice-end row).
Every check holds; no test is `it.fails`.

**Round 4: the Festival ends the slice** (2026-10-20, after the Milestone 3 gate). The gate found
the old rule met by the audit timer alone, so the slice now ends when the Gizmo Festival is filled
at the Factory Dock. What the bots do, and what moved:
- The Hand Furnace starts with its Slag Heap, so the first minutes lose no clicks to a jam: chunk B
  10:47 → 9:20, Folding 27:07 → 23:19.
- After Folding they audit three lines at once (`RULES.maxAudits`) and fold "Copper wire", "Iron
  ingots" and "Gizmo works". A module must box two kinds of machine (§10), so the Gizmo module is
  L1's press, gear assembler and Gizmo assembler: ingots and wire in, graded A (U 0.75: one gear
  assembler makes gears for two Gizmo assemblers, the ratio left for the player to fix).
- On the floor one Gizmo chain (ingots and wire into a Gizmo module) makes ~0.27 Gizmos/s, 25 min
  for the Festival alone. The bots stamp four more chains as coin comes in (stamps cost bill ×
  (1 + 0.5 per copy), linear), five in all, which uses every copper claim (3 + 2 for chunk B's
  deposit, §18): the floor phase is a build (folds, 15 modules, ~30 trunk tiles, 12 stamps), then
  ~5 min of the Festival filling, 8:23 in all.
- Lamp Posts (150 gears) held the one order slot, and the Festival behind it, ~9 min after
  Folding, since its gears are research's until then: it is 60 gears + 200 wire now (§7). The
  planner and Dock-only player take their orders in turn (Boardwalk, Festival, Lamp Posts); the
  greedy player takes Lamp Posts when offered and sends L1's gears to it before research.
- Check 12's margin is smaller (3.97 h of the 4.5 h ceiling, was 1.78): the slice-end factory
  sells ~1.4 Gizmos/s at the Factory Dock, ~477K coin/h, and the offline ×0.5 applies to the same
  rate.

**Why check 9 is no longer 60–90 min** (round 3). The window came from §16's table when the slice
ended with three stamped copies of one module, and the planner reached that at ~29 min. Under the
new rule the cheapest honest route (what the planner and the other bots do) is three folds right
after Folding: "Copper wire" from the last copper line, then the chunk C pair's miners and
smelters as "Iron ingots", the same machines rebuilt (200 coin) so the presses and assembler left
behind can be audited as "Gear works". On the floor the ingots feed the gear works, the ingot
module's slag leaves by a side trunk into the Dock, and the wire and gears go into the Dock. It
costs ~210 coin (the rebuild and four trunk tiles at 2) and takes three audits back to back: the
slice ends **4:18** after Folding, 2:53 after the first fold (the old rule: 15 s). Nothing in the
Act I numbers can hold it to 60 min: research 1–10 and Bramble's orders all land before Folding, and
Folding has its own window (22–30, check 6); chunks C and D are not needed after Folding (a 30,000
chunk D would only be skipped). So the window is revised to what the rule guarantees, a floor phase
of at least three audits, with 45 min as the ceiling. Stretching the floor phase toward §16's
90 min needs a lever on the Factory floor itself (DESIGN.md §10–§11, the lead's): for example a
coin price on placing a module, trunk belts priced like machines rather than belts, or the Gizmo
required among the three products (its module needs gears and wire at matched rates from two
others).
## 14. What the slice must answer

1. **Is the first fold the best moment of the first hour?** Does the player want to build and
   fold a second line straight away?
2. **Does the Workshop make you think about layout** (ratios, slag, land), not just about
   buying the next thing?
3. **Does going from clicking to automation feel good, and does the hour end with the player
   wanting the Factory floor?**

If any answer is no, change the model here before building more.

## 15. Later systems (model sketches, not slice)

- **Power (Act II)**: coal → steam → electric. Machines draw kW; a brownout slows the whole
  grid proportionally, never randomly. Overclocked mode = 1.5× speed at 2.2× power.
- **Machine modes**: Efficient 0.75× speed, 0.5× power. Precision 0.8× speed with +25%
  yield on the main output. Recycling (Act III) halves byproducts. Byproduct mode doubles them.
- **Byproducts as inputs (Act II)**: slag → gravel → concrete; smoke → carbon via scrubbers.
  Zero-waste lines get W = 1, which pushes grades to S.
- **Parts costs (Milestone 4)**: from the Factory floor on, stamps also cost machine parts
  (Machine Kits made by your own lines), so production feeds expansion.
- **Deposit claims (open)**: either stamping a source module uses a claim bought on a survey
  map, or source modules deplete. Decide in Milestone 4, with a `DECISIONS.md` entry.
- **Reorganize (layer 1)**: `patents = floor((run lifetime coin / 1e9) ^ 0.4)`. Target: 12–20
  Patents at the first sensible reset (4–6 h). The preview shows the gain now and at the next
  ×2 of lifetime coin.
- **Relocate (layer 2)**: Legacy from megaprojects completed and the best fold grade per floor.
  Biome worlds each change one rule (island: land ×0.5; volcanic: free heat, belts degrade;
  frozen: machines need heat; ruins: broken machines to repair).
- **The Last Fold (layer 3)**: fold the whole World floor into one tile. Kernels from
  log10 of the World's total output value. Kernels buy base-rule changes (an extra port per
  module, a fifth floor, belt physics).
- **Megaprojects**: staged deliveries to a Megaproject Bay on the highest floor reached.
  Progress persists across every reset. Each completion changes one rule for good (the Great
  Drill: ore patches never run out, if depletion is chosen; the Floating City: +1 Factory floor
  row; the Scrap Transmuter: byproducts sell at 25% of the item that made them).
- **Trophies (slice preview)**: a short shelf of cosmetic trophies (first sale, first Gizmo,
  1,000 coin, a Spark caught...) shows progress from the first minute; Milestone 11 gives each a
  small, specific bonus tied to what earned it.
- **Overdrive / Inspiration / Sparks II**: Overdrive 3× for 10 s with a 30 s cooldown per
  machine. Inspiration: 1 click = 0.1% of the selected node's remaining cost, capped at 30% of
  each node (clicking helps but never replaces the line). Built in Milestone 6: a click on a
  Hopper from Act II on (§20).

## 16. The 100-hour pacing model

**Targets** (cumulative play by a competent player, active about 40% of the time):

| By | Reached |
|---|---|
| 40 min | first fold (measured: 24:35, planner bot, §13 round 4) |
| 90 min | slice end: the Gizmo Festival filled at the Factory Dock (measured: 31:43; §13 check 9 is revised to ≤ 45 min) |
| 3 h | Act II: power, steel, glass, circuits |
| 5 h | first Reorganize (12–20 Patents) |
| 11 h | District floor (Act III; measured 10:01, the second gate moved it from 15 h: the Great Drill stands at about 9.5 h) |
| 25 h | the first Act III megaproject stage (the Floating City's Platform; measured 15:48) |
| 40 h | first Relocate |
| 60 h | four biome worlds visited |
| 80 h | the Last Fold available |
| 100 h | first Kernel spend; infinite orders, challenges and the codex continue |

**Rules every milestone is measured against** (the pacing auditor checks them):

1. **Next goal**: at any point, the cheapest meaningful goal (research node, purchase,
   megaproject stage, reset worth taking) is ≤ 3 min of active play away in Acts I–II,
   ≤ 10 min in Act III+, or ≤ 1 h idle.
2. **Dead air**: the greedy bot never spends more than 15 min active with no new unlock or
   decision before hour 40, or more than 30 min after.
3. **Resets get faster**: each reset's run passes the previous run's peak income in ≤ ⅓ of
   that run's length.
4. **Active over idle**: active play (building, Overdrive, Sparks, special orders) earns 2–3×
   idle play **with the game open**. Never more than 4×, so idling is never punished; never less
   than 1.5×, so playing is always worth it. *Restated in the Milestone 5–6 review round:* the
   band is active against **open** idle. A closed game is bounded apart (§12, §13 check 12):
   **offline never pays more than open idle** for the same time, and at efficiency e pays at least
   about e of it. The 4× ceiling does not apply to a closed game: at e = 0.5 a closed game is
   inherently ~2× below open idle, so active ÷ closed passes 4 whenever active ÷ open idle passes 2,
   which is the band's own middle.
5. **New thinking per act**: each act adds at least one problem the last act didn't have
   (routing → ratios and power → composing modules → biome rules → bending rules). Adding
   an ore with a bigger number doesn't count.
6. **No forced resets**: progress without resetting slows but never stops. The bot that never
   resets still reaches Act III by 30 h.

**Rules 1 and 2, measured in Acts I-II** (re-read in the Milestone 5-6 final round, seeds 1000 and
8919; the Act II bot in `tests/pace-act2-run.test.ts` and the campaign bot's three runs):
- **Rule 2 holds up to the Bay floor, and is open while the Bay fills.** It is read without Sparks
  and, from the final round, without *belt relays*. A relay is the bot lifting a belt and laying it
  again to clear an item its end never takes: the Concrete boiler's feed belt, every 16 s.
  - The review round counted relays as decisions, and that hid the wait. Its 9.2-9.3 min
    (12.4-12.5 now, relays included) was relays every 16 s while the Bay filled.
  - From the slice end to the Bay floor, the longest stretch without a build, research, order,
    fold or purchase is 12.4-12.5 min (≤ 15; tested). In campaign runs 2 and 3 it is at most rule 1's
    10-12 min below.
  - While the Bay fills it is 39-48 min, the same wait as rule 1's below. Logged as open, not
    tested.
- **Rule 1 is not met.** It is read as the longest wait between goals reached: research, land,
  folds, orders, modules placed, annex blocks, claims blocks and the Drill's stage. (Annex and
  claims count from the final round; the test's goal list had left them out.)
  - From the slice end to the Bay floor that wait is 12.5 min in run 1 and 10-12 min in runs 2
    and 3.
  - While the Bay fills it is 39.5-41.4 min in run 1. That covers Shiny Things, then Nested Boxes'
    research, then the nested Gizmo works II and its two annex blocks.
  - In later runs the bot now buys its annex blocks and claims before the Bay floor, as soon as
    they are affordable (§19). After the Bay floor their waits run 27-35 min (run 2) and 84-93 min
    (run 3, the last, which plays to its cap with its plan done).
  - Run 1's wait while the Bay fills is research and the Drill's own parts. Nothing on the floor
    is left to buy: the bot buys every claim and block its plan can use.
- **Rule 4** at every stage measured: §20.

## 17. Readability at 1×

At 1× zoom, a player must tell apart within a second:
- An ore patch versus bare ground versus land not owned.
- A working, starved, blocked or unpowered machine (the pip plus a motion cue: working
  machines animate, stopped ones don't). Since Milestone 13 each pip has a shape as well as a
  colour (a dot, a funnel, a square, two bars, a bolt, a ring), so a colourblind player tells them
  apart by the outline (STYLE.md, Palette).
- What item is on a belt (8×8 icons with distinct silhouettes, not only colours).
- A module versus a machine (modules are framed and show their main output's icon).
- The fold box and its ports (in = arrows pointing inward, out = outward).
- A Spark versus decoration.

## 18. Act II: the Factory (Milestone 4, 1.5–5 h)

New thinking: **ratios and power**. Act I asked where things go; Act II asks how many of each, and
what they run on.

### Land and deposits
- The Workshop widens east to 24×16: **chunk E** (x 16–23, y 0–7) with a coal and a sand
  deposit, 60,000 coin, after *Coal Seams*; **chunk F** (x 16–23, y 8–15) with coal and iron,
  120,000, after *Steam Power*. *Derivation: measured, the slice-end factory earns about
  12,500/min played (7,200 idle), not the 2,500 first assumed; E is about 5 minutes of it, F about
  10 minutes of the early Act II factory (≈12,000/min). At 15,000 and 40,000 they were 1.2 and
  3.3 minutes (the Milestone 4 review).*
- **Deposit claims, not depletion** (decided here, `DECISIONS.md`). Ore never runs out. A
  *source* design (miners inside, no inputs) may have as many stamped copies of each ore as you
  hold claims for that ore. Everyone starts with 3 claims per ore plus 2 per Workshop deposit of
  that ore they own; the **Survey Office** (research *Surveying*) sells more, 4 at a time
  (iron and copper 25,000, sand 40,000, coal 60,000: 2–5 minutes of Act II income; each later
  block of 4 costs 1.5× the last of
  its ore, linear in blocks bought: `price × (1 + 0.5·b)`, the stamp rule again). *Derivation:
  claims keep the Workshop's ore patches meaningful after folding (pillar 2: land matters),
  without the chore of re-folding depleted lines.*

### Items and recipes (tier 2)
| Item | Value | Made by | From | Time |
|---|---|---|---|---|
| Coal | 2 | Miner | coal deposit | 2.0 s |
| Sand | 1 | Miner | sand deposit | 2.0 s |
| Steel | 22 | Smelter | iron ingot + coal, 1 slag per 2 | 3.0 s |
| Glass | 12 | Kiln | 2 sand | 2.0 s |
| Gravel | 2 | Press | 2 slag | 1.0 s |
| Concrete | 32 | Mixer | 2 gravel + sand | 3.0 s |
| Plastic | 24 | Refinery | 2 coal, 1 oil per 2 | 4.0 s |
| Oil | 3 | (Refinery byproduct) | | |
| Circuit | 180 | Assembler | 3 wire + plastic + glass | 5.0 s |
| Machine Kit | parts | Assembler | 2 steel + 2 gears | 4.0 s |
| Motor | 640 | Assembler | steel + 4 copper wire + circuit | 8.0 s |
| Drill Bit | megaproject | Assembler | 4 steel + motor + 2 concrete | 12 s |

*Derivation: each step pays about 3–6× its inputs' value (circuit 4.3×, motor 3.0×, glass 6×,
concrete 6.4×). Act II goods out-earn the slice's Gizmo per module tile (the Milestone 4 review: a
Gizmo chain is 3 modules at 0.27 Gizmos/s × 80, 7.3 coin/s a module): an S-grade module of a
full-speed line earns Steel 9.2 coin/s, Glass 7.5, Plastic 7.5, Concrete 13, a Circuits chain 15
a module. Thin lines fold into thin modules: the Act II bot's one-miner lines measure Steel 8.1
(A), Plastic 5.7 (C), Glass 2.3 (D), so a player who widens a line before folding is paid for it.
The motor's recipe was 2 steel + gear + circuit, re-derived (windings, not the shape of another
game's engine unit). Per machine-second a deeper chain earns more, so a deeper line is always
worth building; slag now has two outlets (gravel,
bricks) and the refinery's oil is a byproduct with a use (boiler fuel), so zero-waste lines
are possible and earn W = 1.*

### Power
- **Boiler** (1,200 coin): burns 1 coal or 1 oil every 4 s while the grid needs it, and steams
  the **Steam Engine** in front of it (2,000 coin), which makes **300 kW**. **Generator** (2,600):
  one tile, burns 1 coal every 3 s for **200 kW**. *Derivation: the boiler pair gets 1,200 kJ from
  a coal at 150 kW a tile, the generator 600 kJ at 200 kW a tile: efficiency against compactness,
  which is exactly what the fold grade's C weighs. Prices are set against Act II income (about
  12,000/min), not against Mk1 machines: a power plant is about half a minute.*
- **Pole** (150): powers everything within 2 tiles (a 5×5 square) and joins poles within 6 tiles
  into one grid. Producers join a grid the same way.
- Draw: Kiln 60 kW, Mixer 80, Refinery 120, Smelter Mk2 150, Press Mk2 120, Assembler Mk2 200.
  **Mk1 machines need no power** (Act I keeps working untouched).
- **Brownout**: when a grid's demand passes its supply, every machine on it runs at
  supply ÷ demand of its speed, never randomly (§15). Fuel burns in proportion to the load. An
  unpowered machine shows a blue pip and says why.
- A fold box must hold the power its machines use: **power never crosses a fold box**. A box
  whose machines are on a grid with a producer or pole outside it is refused, with the reason.
  The folded module then simply takes coal (or oil) in through a port.

### Machines: Mk2 and modes
- **Mk2** smelter, press and assembler are 2×2, powered, and craft their Mk1 family's recipes at
  **4× speed** (6,000, 9,000 and 20,000 coin). *Derivation: 4× fills exactly one Mk1 belt (a Mk2
  smelter's 120 ingots/min); four tiles for four machines' work, paid back by fewer belts and
  ports and by modes. Priced at half a minute to 1.7 minutes of Act II income; the earlier 230,
  580 and 1,950 were set against Mk1 prices and were a rounding error of the coin piling up (the
  Milestone 4 review). Kiln 3,000, Mixer 4,000, Refinery 9,000 likewise.*
- **Modes** (research *Tuning*, powered machines only): **Efficient** 0.75× speed at 0.5×
  power; **Overclocked** 1.5× speed at 2.2× power; **Precision** 0.8× speed, +25% of the main
  output (§15).
- **Overdrive** (research *Overdrive*): click a machine to run it 3× for 10 s, then it cools
  for 30 s (§15). Any machine, Mk1 included. *Derivation: each machine can be overdriven 10 s in
  every 40, so a line clicked in step runs at most (10 × 3 + 30) ÷ 40 = 1.5×: +50% while
  active (an earlier "+67%" was wrong, the Milestone 3 gate audit). It is one of Act II's
  active levers with building, orders and Sparks; §16 rule 4 is measured on all of them
  together.*

### Customers
- **Unit 7** (met with *Coal Seams*): a collecting robot. Orders: *Calibration Weights* (300
  steel → 13,000), *Lens Array* (400 glass + 60 circuits → 34,000), *One of Everything* (20 each
  of steel, glass, concrete, plastic, 10 circuits and 5 motors → 14,500). Reputation: 1 opens **the Codex** (every item with its
  story; a first delivery of each pays 30 × its value once; 100× was a 71K one-off burst, a single motor
  paying 42K); 2 teaches **Recycled Glass**
  (Kiln: 3 gravel → glass, 2.5 s); 3 adds +10% to Precision's yield.
- **Dame Voltaire** (met with *Steam Power*): the swamp's electricity baroness. Orders:
  *Streetlamps* (150 circuits + 300 glass → 64,000), *Concrete Promenade* (800 concrete →
  56,000), *The Grand Turbine* (40 motors + 600 steel → 85,000). Reputation: 1 lets boilers
  burn oil at 2× heat; 2 gives steam engines +25%; 3 extends pole reach by 1.
- *Derivation: each order pays about 1.5–2.5× its items' Dock value (§7's rule), and every
  reputation reward is a rule a player plans around, not a flat multiplier.*

### Machine Kits (parts costs for stamps)
- Stamping a design that holds any Act II machine (powered, Mk2 or a power building) also costs
  **Machine Kits**: 1 + floor(bill ÷ 500). Kits delivered to a Hopper go to the parts bank,
  not to research; the Dock refuses them. *Derivation: production feeds expansion (§15);
  slice-era designs stay coin-only so Act I never stalls on parts.*

### Nested folds (depth 2)
- Research *Nested Folds*: the Fold tool works on the Factory floor. A box up to 6×6 of modules
  and trunks is audited the same way (70 s; U = the modules' mean run fraction, W =
  byproducts leaving by a trunk or used inside, C = module tiles ÷ box tiles ÷ 0.6) and folds
  into a **depth-2 module**: one tile with the group's measured rates × its own grade. Its
  stamp bill is the sum of its modules' bills. *Derivation: a depth-2 fold of an S group runs
  1.25 × 1.25 = 1.56× the raw lines in one tile, which is what makes the 96-tile Factory floor
  enough for Act II, and the District (Act III) the floor where they go.*

### Megaproject #1: the Great Drill (stage 1)
- Research *The Great Drill* (40 motors + 200 concrete) puts the **Megaproject Bay** (2×2) on
  the Factory floor. Stage 1 wants **650 Drill Bits and 2,800 steel**, delivered by trunk (the
  concrete is in the bits, 2 each). Done, it lets every
  Miner and every source module run **+50%** for good. **Megaproject progress survives every
  reset** (stored apart from the run's state for Milestone 5). Stages 2 and 3 arrive with
  later floors. *Derivation: from the slag the Act II bot's Bay floor turns into bits: a Drill
  Bit is 2 concrete, 8 slag; the floor's Concrete module takes about 35 slag/min (a Steel and an
  Iron ingots copy), so bits come at 5–6 a minute while the Bay's Steel also runs and about 2.5
  after; 650 bits and 2,800 steel take the bot about 1.9 h from the Bay floor (S+1:46 to
  S+3:41-3:47), inside the S+4 h target with room for a slower player. +50% on ore is the biggest
  single boost of the act, earned, permanent, and visible on every miner.* *Re-paced in the final
  round (it was 450 and 2,000):* the bot drains its slag into a brick press now, so it reaches the
  Bay 20 minutes sooner. At 450 and 2,000 the first Reorganize then came at 3:37-3:41, under §19's
  4-6 h. At 650 and 2,800 it comes at 4:21-4:24 with 14 Patents. Steel
  is 4.3 a bit, still over stages 2 and 3's 4, so the steel is in before the bits.

### Rules settled while building it (Milestone 4)
- A Boiler or Generator holds 4 fuel (`RULES.fuelCap`) and takes it from any side but a boiler's
  front. Demand is the kW of every powered machine mid-craft; a grid's machines run at
  supply ÷ demand; fuel burns at demand ÷ supply of the full rate. Overdrive doesn't change a
  machine's draw.
- A Mk2 hands its output out of either front tile, taking turns, and its byproduct out of any
  side tile.
- Claims are held by **every design with miners inside**, one per ore per copy (not only by
  designs with no inputs, or one token input would dodge the rule). Folding is never refused
  for claims; stamping is. A depth-2 design holds its modules' claims and needs Machine Kits if
  any module inside does.
- The Codex pays for each item's first Dock delivery after Unit 7's rep 1.
- The Megaproject Bay appears once its 2×2 at the Factory floor's bottom-left corner is clear,
  and takes only what its stage still wants.
- A nested fold needs at least two modules; a depth-2 module can't be folded again.

### Pacing targets (Act II)
Measured from the slice end **S** (the Gizmo Festival filled, about 0:31), not from the clock: the
slice ends far earlier than §16's 90-minute budget, and every Act II number is set against the
factory the player actually has then. Encoded in `tests/pace-act2-run.test.ts` (the Act I planner
to S, then the Act II bot in `src/sim/bot2.ts`, seeds 1000 and 8919, 5 h):

| Goal | Target | Measured |
|---|---|---|
| Steel | ≤ S+25 min | S+18 |
| Power | ≤ S+35 min | S+23–24 |
| Circuits | ≤ S+60 min | S+48–50 |
| Concrete fold | ≤ S+80 min | S+59–61 |
| Drill works fold | (logged) | S+1:45–1:48 |
| Great Drill stage 1 (650 bits, 2,800 steel) | ≤ S+4 h | S+3:42–3:44 |
| Reorganize at 5 h | 12–20 Patents | 14 (4 h: 14) |

*Measured in the Milestone 5-6 final round*; the rules are read as in §16:
- **Rule 2** (dead air): the longest stretch without a decision is 12.4-12.5 min to the Bay floor
  (≤ 15), not counting Sparks or belt relays. While the Bay fills it is open (§16).
- **Rule 4** (active over idle): from the same 2:00 state, 30 min of the bot earns 1.60× an idle
  30 min on seed 1000. The bot builds, clicks Sparks and uses Overdrive on Workshop machines and on
  Factory module groups, at most 4 clicks a second. Seed 8919 reads **1.46, open**: its Bay floor
  is laid at 2:16, inside the window, and clears the Gizmo chains for it. Overdrive on the Factory
  floor is what lifts the reading: the money after the slice is there (1.37× without it, the
  Milestone 4 reading).
- **Rule 1** (next goal): up to the Bay floor, a goal lands at least every 12.5 min. Goals are
  research, land, a fold, a module, the stage, an annex block or a claims block. While the Bay
  fills (about 1.9 h), the goals are the last research nodes and the stage, 39-41 min apart. Not
  met; Milestone 4's open item.
- **Rule 5** (new thinking): ratios and power. The bot's own build shows them: every Act II line
  is a ratio problem (one steel line's slag sets the concrete rate; a kiln on one sand miner
  works half the time), and every mixed belt into a machine needs a splitter with an overflow;
  on the Factory floor, a module's outputs must be consumed in the ratio it makes them, or the
  surplus fills its buffer and stops the rest, so byproducts go to a sink that never waits.
- Lifetime coin (the Milestone 4 reading): 1.8M at 4 h, 2.0–2.05M at 5 h. Income about
  12,500/min from S to the Bay floor, 4,300/min after (the Gizmo chains are cleared for it; with
  the annex, from the review round, 5-6K).

## 19. Reorganize (Milestone 5, 5-15 h)

Reset layer 1. The player ends a run on purpose and banks **Patents** for what the run built; the
Patent tree spends them on a faster, different next run. Pillar 4: it is always a choice, made
from a card that says exactly what it gives, keeps and loses (`src/app/reorganize.ts`), and a
player who never resets keeps progressing (§16 rule 6). *Rewritten in the Milestone 5-6 review
round (DECISIONS.md): Patents are filed, not re-earned.*

### Filing: the Patents formula

    Patents = floor( 0.5 x SUM over products of max(0, best value this run - value on file)
                   + Great Drill Patents delivered this run
                   + log2(1 + bills standing and running / 25,000) )

    value of a design = steps folded x grade multiplier x rate tier

- **The record on file** (`meta.patented`, kept through every reset): each product's best value
  so far, with its steps, grade, tier and the run that filed it. A Reorganize files this run's
  best design of each product, and only a rise is kept (`fileDesigns`). A run is paid only for the
  rise: folding the same line again files nothing, so a reset loop dries up after its first run,
  and runs 2 and 3 earn only by pushing further.
- **Steps folded** are the recipe steps the box holds: the product's depth from raw ore (by its
  shallowest recipe, as `chainSteps` reads it: an ingot, glass (from sand) and plastic (from oil)
  1; plate, wire, steel, slag brick (slag is the smelter's byproduct, so it sits at the ingot's 1)
  and gravel 2; gear, concrete and circuit 3; Gizmo and motor 4; Drill Bit 5) less the deepest item
  its ports take in, at least 1.
  A Drill Bit assembler fed steel, concrete and circuits from outside is 2 steps; the whole chain
  in one nested box is 5. Byproducts never count.
- **Grade**: §10's multiplier, C 0.9 to S+ 1.35 (D 0.75). The audit's lesson carries to the reset.
- **Rate tier**: the module's scale in Mk1 machines' worth of its product's last recipe, a tier
  for each x4 (a Mk2 machine's speed, §18): under 4 x1, 4 x1.5, 16 x2, 64 x2.5 (`tierStep` 4,
  `tierBonus` 0.5). A bigger line is progress, never four times the Patents.
- **Megaproject term.** Each Great Drill stage is worth Patents (stage 1: 5, stage 2: 6, stage 3:
  8), paid in proportion as its parts are delivered in this run. Progress is kept, so never twice.
- **Bills term (minor).** log2(1 + bills / 25,000). *Rewritten in the final round: it counts
  measured work, not a second of it.* Each building's bill is weighted by the work it did over
  the last **5 whole minutes** (`billsWindow`, kept as minute buckets on each building):
  - a crafting machine by its time crafting, times its grid's satisfaction squared, so a starved
    or browned-out machine counts for almost nothing;
  - a Miner by its time digging, and a power producer (with its boiler) by its burn share;
  - a Pole by its grid's use, at most a quarter of the consumers it carries;
  - a belt, splitter, merger, crate or trunk only if it carried an item in the window;
  - a Factory module by its stamp bill times its run fraction, and a District module the same
    way (the second gate's Act III bot: a run after the one that filed Act III's designs stood on
    a full District and still previewed under 1 Patent, so its Reorganize was refused, §21 Pacing).
  Coin on hand counts for nothing, a building left idle for nothing, and one bought a minute
  before a reset counts a fifth, so a hoard is never burned for Patents. The slice-end factory
  stands on about 10K (0.5), the Act II bot's 4 h factory on about 33K (1.2). It replaced the
  works term (coin invested), which paid for spending anything. Two farms fail the pace tests
  (`tests/final-round.test.ts`):
  - 239 refineries (2.15M coin) on one generator at 0.7% of their power add +0.09 Patents to the
    slice-end factory and +0.04 to the 4 h one;
  - 119 generators (309K coin) count 3,783 with one fuelled and 3,777 with all of them fuelled
    for one kiln.
  The card's "run N more coin of buildings" goal is gone: it was the farm's instruction.
- A reset needs at least 1 Patent (`patentMin`) and no audit running.

**Calibration.** k = 0.5 was set so the designed first run files 12-20 at a 4-6 h reset: the Act
II bot's nine products are worth about 17 units (ingots 1 x S 1.25, wire 2 x S, Gizmos 4 x B,
steel, concrete and circuits 2 each, plastic and glass 1, Drill Bits 2 at D), about 8 Patents;
the Drill's stage 1 adds 5 and the bills term about 1. Measured: 14 (below: designs about 8.5, the
Drill its 5, bills about 1.2).

**Not derivative of a shipped prestige formula** (checked; DECISIONS.md, Milestone 5 and the
review round): Cookie Clicker's heavenly chips and Antimatter Dimensions' infinity points are a
root or a log of currency earned. Here currency counts for nothing; the main term files the best
folded value of each product (recipe depth, audit grade, scale), and pays the rise over the record.

**The preview** (`previewPatents`, pure) gives the Patents now, each term, one line a product
(this run's best, what is on file, the Patents it files; marked **new**, **better** or **on
file**), and the goals that raise it, biggest first: fold a product not folded yet, refold one at
S+, fold one a step deeper, fold a bigger line (with the rate at the next tier), finish the Drill
stage, and fill Committee orders to open the next one (the bills goal, "run N more coin of
buildings", was dropped in the final round: it told the player to farm). The Reorganize card
shows it all, with the runs so far.

### What is kept, what is lost

Kept (`meta`, plus the fields that already lived in the run's state): Patents and the tree, the
record on file, the Patent Drawer and its queue, Great Drill progress (`mega`), reputation, the
Codex, the coin Night Shift (§20), trophies and lifetime statistics (coin earned, items delivered,
folds), the run history. Lost: both floors, coin and items, land (back to chunk A), the Factory
annex, deposit claims, research, module designs, orders filled this run. The tick and the seeded
RNG run on: the command log stays one ordered history and replays across resets (a test checks
it); `meta.runStart` marks a run's first tick.

### The Patent tree (`src/data/patents.ts`, 29 nodes, 40 Patents in all)

Flat prices with prerequisites, never a growing price; no "+X% everything" node. A price is about
a Patent per 10-15 min of a run the node saves. Four branches:

- **Head starts (13 nodes, 15 Patents).** Bellows on the Bench 1; A Miner on the Patch 1; Old
  Notebooks 1 (Pressing, Surveying East); Copper Deeds 1 (chunk B, Copper Smelting, Wire Drawing);
  Gear Patterns 1 (Gearcutting, Splitters, Buffers); The Gizmo Patent 1; Folding, Remembered 1;
  Founders' Grant 1 (2,000 coin); Overdrive by Habit 1; Coal Rights 1 (Coal Seams, chunk E); Steel
  Charter 1 (Steelmaking, Steam Power, chunk F); Glass and Gravel Notes 2; Circuit Patent 2. A
  head start applies at once in the run it is bought in, and at the start of every later run; it
  gives only the research it names, not the tree before it.
- **Rules (7 nodes, 10).** Surveyor's Charter 2 (a copy of a source design graded S or S+ holds
  half a claim on each ore it digs: twice the copies of a well-folded source line, none more of a
  sloppy one); Wider Fold Box 1 (10x10, was 8x8); Quick Audits 1 (5 s warm-up + 40 s, was 10 +
  60); More Auditors 1 (5 at once, was 3); Side Intakes 2 (a module also takes from a trunk
  pointing into its left side); Nested Boxes 2 (8x8 nested folds, was 6x6); Fresh Dies 1 (a line
  refolded at a better grade than every earlier design of its product starts its stamp price
  over; still linear). Stamping Dies, Cool Hands and Deep Heaps are gone: each was a number, and
  Deep Heaps ended Act I's slag puzzle.
- **Automation (6 nodes, 8).** The Shovel Frog 1; Lab Assistant 1; Order Clerk 1; Stamp Press 2;
  The Draughtsman 2 (unfolds the Drawer's queue, below); A Deeper Drawer 1 (12 kept designs).
- **Offline (3 nodes, 7).** Graveyard Shift 2, Night Watch 2, Lights Left On 3: **+0.05 each**.
  0.5 + the coin Night Shift's 0.1 (§20) + 0.15 = 0.75 exactly, the ceiling; a node bought at the
  ceiling is refused (`patentRefusal`). `offlineEfficiency(g)` is the one place
  `src/sim/offline.ts` reads it.

The campaign bot buys in a fixed priority (`PATENT_PRIORITY`): the Surveyor's Charter and the
Bellows first, Overdrive by Habit, the Act I head starts in order, quality of life, then Act II's
head starts. *Measured in the final round (seed 1000):* run 1's 14 Patents buy 13 nodes, run 2's
7 buy 5 more and run 3's 9 buy 4 more. That is 22 of the 29 nodes, and 30 of the 40 Patents, by
9.9 h of play, so most of the tree is bought in 5-15 h. A fourth run files only 1 Patent in 5 h:
every product is on file, the Drill is done, and only the bills term is left. The tree's last 10
Patents wait for the next floor's goals (Milestone 7). The fourth run does not finish it, as the
review round expected.

### The Patent Drawer

A Workshop design folded in a run can be **kept** (8 slots, `drawerSlots`; A Deeper Drawer adds
4): its box, its parts and recipes, its product, grade and rate. In any later run a kept design
**unfolds** in one action back onto the box it came from (the land and the ore lie the same in
every run): every machine and belt placed at once for its bill, ready to audit and fold again (§10
Unfold). It refuses, with the reason, while its land is not owned, a recipe is not researched,
something stands in the box, or the coin is short. **The Draughtsman** unfolds the designs the
player queues, in their order, one every 5 s at most; one waiting only on coin holds the queue
(the coin is saved for it), one waiting on land, research or room is passed over for now. Eight
slots for the nine products the Act II bot folds: which lines to keep is a choice.

**Refolding a kept design** (the final round). A kept design unfolded and left unchanged refolds
after a **10 s check** at its kept grade, not a full 70 s audit (40 s with Quick Audits). When an
audit starts, the box must match a kept card exactly (`keptMatch`):
- the same box, parts, turns and recipes;
- every machine in normal mode;
- nothing paused.
During the check, every machine must run at no less than its kept busy fraction less 0.1
(`refoldSlack`), and the kept product must leave the box. If the check passes, the fold uses the
kept card: the grade, and the ins and outs per Mk1 machine's worth, which the game stores when it
keeps the design. If anything differs, or the check fails, the full audit just goes on.

It can't be gamed:
- The card is the grade the same layout earned in a full audit, and the check only confirms the
  layout runs, so a refold never grades better than the audit did.
- A layout changed in any part (a belt turned, a machine overclocked, a miner paused) gets a full
  audit.
- A design imported from a share string has no card, so it gets a full audit.
- 10 s is the full audit's own warm-up. A check that fails has lost nothing.

The Act II and campaign bots now use the Drawer (`src/sim/bot2.ts`):
- they keep each Workshop design they fold;
- with the Draughtsman, they queue the kept designs in plan order;
- in a later run, they unfold a kept design whenever its box is empty and the plan wants exactly
  its parts.
Measured on both seeds, the bot keeps 7 designs in run 1. Runs 2 and 3 each unfold 5 of them,
and the check refolds 5–6 a run: Plastic and Plastic II share one box, so it refolds twice. No
unfolds come from the Draughtsman (`d` 0): the bot's own unfold reaches each box first.

**Share strings** `FWD1.<data>.<checksum>`: a kept design's box, name and layout as a w x h grid
of cell bytes (kind code + 1 + 32 x turn; 127 for the rest of a 2x2), then a recipe byte for each
crafting machine; squeezed by a small LZSS coder (12-bit distance, 4-bit length), written in
base64url, with an FNV-1a checksum. Pure TypeScript (no CompressionStream). The kind and recipe
tables are append-only. Import refuses with the reason in words (not an FWD1 string, a damaged
checksum, a newer version, a box over 16x16, an unknown building or recipe, overlapping parts,
a recipe on a machine that cannot make it, extra or missing data). Save v7 replaces v6's
blueprints and ghosts (a blueprint had no product or grade to keep).

### The Factory annex

Up to **3 blocks of 2x8 tiles** east of the Factory floor (18x8 at most), the n-th block 150,000
x n (150K, 300K, 450K: linear), after Steam Power; sold from the Upgrades tab and drawn on the
floor (a brass seam at the old east wall; the next block outlined with its price). Lost at a
Reorganize, like land. *Derivation:* the Bay floor needs the 12x8's middle, and without room the
coin chains were cleared for it, so income fell to a third for the rest of the run while coin
piled up; the first block is 12 minutes of Act II income for a Gizmo chain beside the Factory
Dock, the three about half of what a run piles up by 4 h. East, not south, so the Floating City's
+1 row (§15, Milestone 7) is never pre-empted. The Act II bot buys block 1 at 1:11-1:14 in run 1
and lays a Gizmo chain in it; blocks 2 and 3 hold copies of the nested Gizmo works II once Nested
Boxes and the Bay are in (3:44-3:45 in run 1). *The final round:* in later runs the bot buys each
block as soon as it is affordable, before the Bay floor: 0:19-0:29, 0:38-0:48 and 1:09-1:20 into
the run (it was 0:18-0:42, then 2:14-2:59, since a block skipped while short was skipped for good).

**Deposit claims** (the final round). Before stamping or placing a copy that lacks claims, the
bot buys a block of claims for that ore at the Survey Office, if the block costs at most half the
coin on hand. Before, it never bought claims: it cleared a chain or left the copy out. Surveying
is researched at 1:16-1:19 in run 1 and 1:01-1:06 later. The bot buys a copper and an iron block
in run 1 (for the annex's Gizmo works II copies) and one copper block in each later run, which
leaves claims to spare (iron 7 of 9 and copper 7 of 9 held at 1.5 h). Claims are not what caps
a later run; room is (rule 3, below).

### The Committee (three raccoons in a trench coat)

The fourth customer, met with the Great Drill research in the first run (its orders are goals
while the Bay fills: §16 rule 1), or after the first Reorganize once Folding is done in that run.
Its orders want what nobody else does and pay coin (2x what the goods fetch) and 1 reputation,
kept through every reset. The Dock takes an item it normally refuses (slag, oil) while the active
order wants it. Sized so 1-2 are fillable a run from the floor a run builds anyway:

| Order | Wants | Pays | Needs |
|---|---|---|---|
| The Pile | 800 slag | 1,600 | Folding (about 20 min of the Bay floor's slag at the Factory Dock) |
| Shiny Things | 1,200 wire + 600 ingots | 8,400 | Steam Power (what an Act II Factory Dock receives anyway, about 16 min) |
| Midnight Oil | 150 oil | 900 | Refining (about 20 min of one Plastic module's oil) |
| The Brick Throne | 100 slag bricks | 1,200 | Slag Bricks |
| Gravel Garden | 300 gravel | 1,200 | Crushing |
| The Lining | 200 plastic + 10 motors | 22,400 | Motors |

Its reputation rewards are rules: **Coat Pockets** (rep 1: module buffers hold 6 s of each rate,
was 2), **The Night Crew** (rep 2: while you are away, every Slag Heap loses a slag every 10 s;
offline only, so it never ends Act I's slag puzzle in the open game), **the Great Drill's stage
2** (rep 3), **Pocketed Kits** (rep 4: a stamp needs 1 Machine Kit fewer), **stage 3** (rep 5).
Two orders a run put stage 2 in the second run and stage 3 in the third. Raccoon Bearings, the
first draft's currency, are gone (DECISIONS.md, the review round).

### The Great Drill, stages 2 and 3

| Stage | Wants | Opens | Patents | Reward, for good |
|---|---|---|---|---|
| 1 | 650 bits, 2,800 steel | the Great Drill research | 5 | Miners and modules with miners +50% (§18) |
| 2, the Bore | 250 bits, 1,000 steel | Committee reputation 3 | 6 | Miners dig from any tile beside an ore patch: a patch feeds three times the miners |
| 3, Breakthrough | 300 bits, 1,200 steel | Committee reputation 5 | 8 | Chunk D gains a deep iron and a deep copper deposit |

Steel is 4 a bit (under stage 1's 4.3), so the steel is in before the bits: with the bits full
first, the bot's Bay floor jammed on its own slag. **The Bay never jams**: it takes steel and
Drill Bits always, and what its stage can't count (the stage closed, or that part full) goes on to
the Dock and sells (bits are scrapped), so a stage waiting on the Committee never stops the Bay
floor behind it. The Drill screen shows the gate ("opens at their reputation 3, now 2"), each
part's rate a minute with its time to go, and the Drill Bits a minute with the slowest input.
Progress survives every reset.

### Measured pace (`tests/pace-reorganize.test.ts`, the campaign bot, seeds 1000 and 8919)

Run 1 is the Act I planner to the Festival, then the Act II policy. It resets when four things
hold:
- its plan is done;
- the preview grew under 0.25 in 20 min;
- no Committee order is filling;
- it holds at least 12 Patents (4 in later runs).
Runs 2 and 3 buy Patents first, then play the same way. *Re-measured in the final round:* the bot
now buys claims and its annex blocks as soon as it can afford them, keeps and unfolds kept designs,
and runs a brick press for Surveying. The Drill's stage 1 is now 650 bits and 2,800 steel.

| | seed 1000 | seed 8919 |
|---|---|---|
| Run 1: reset at, Patents | 4:24, 14 | 4:21, 14 |
| Run 1 peak (coin/min over 5 min) | 14,812 | 14,318 |
| Run 2: reset at, Patents | 3:02, 7 | 2:50, 7 |
| Run 2 passes run 1's peak at (limit: a third of run 1) | 0:27 (1:28) | 0:16 (1:27) |
| Run 2 peak | 21,086 | 21,155 |
| Run 3 passes run 2's peak at (limit: a third of run 2) | 1:22 (1:00), open | 1:22 (0:56), open |
| Run 3 peak | 21,434 | 21,203 |
| Run 3's card at its 4 h cap | 9 | 9 |
| Slice end (hand-over) in runs 1, 2, 3 | 0:31, 0:09, 0:12 | 0:30, 0:10, 0:10 |
| Great Drill stage after runs 1, 2, 3 | 1, 2, 3 | 1, 2, 3 |
| Surveying researched in runs 1, 2, 3 | 1:19, 1:06, 1:01 | 1:16, 1:04, 1:02 |
| Claims blocks bought in runs 1, 2, 3 | copper + iron; copper; copper | the same |
| Annex blocks bought, run 1 | 1:14, 3:44, 3:44 | 1:11, 3:45, 3:45 |
| Annex blocks bought, run 2 | 0:26, 0:47, 1:19 | 0:25, 0:47, 1:19 |
| Annex blocks bought, run 3 | 0:20, 0:39, 1:11 | 0:19, 0:38, 1:09 |
| Coin on hand at 4, 5, 6, 7 h of play | 0.74M, 0.15M, 0.30M, 1.05M | 0.72M, 0.18M, 0.37M, 1.10M |

- **The first reset is worth taking at 4-6 h** with 12-20 Patents: 4:21-4:24, 14 on both seeds.
- **Runs 2 and 3 earn only by pushing further.** Run 2's 7 are the Drill's stage 2 (6) and the
  bills term. Run 3's 9 are stage 3 (8) and the bills. Nothing is paid twice. A fourth run files
  only about 1 in 5 h (§19 tree, above).
- **A reset loop never beats the designed run.** Measured as Patents banked per hour over the same
  hours of play (seed 1000, the designed runs 1 and 2, 7:26). The designed run banks 14 + 7, which
  is 2.83 an hour (seed 8919 reads 2.92 in the scratch measure). The loops:

  | Loop | Runs | Patents | Per hour |
  |---|---|---|---|
  | Reset at every slice end | 8 | 9 | 1.21 |
  | Reset at every 1 h | 7 | 8 | 1.08 |
  | Reset at every 2 h | 4 | 10 | 1.35 |
  | **The burn loop** (the final round): reset at 35 min, all coin burned before each reset | 2 | 3 | 0.40 |

  The burn loop spends all its coin before each reset: one refinery, assembler, press or smelter
  on every free tile it owns, and a Pole every few tiles. It then waits 6 min, so the bills window
  sees the new buildings. It files 3 Patents in its first run and 0 in its second, which then
  cannot reset (a reset needs 1 Patent). The buildings stand starved and unconnected, so they bill
  nothing.
  A loop files its products once (3 Patents, 7 at 2 h with steel and the Drill works), then earns
  about 1 a run from the bills term alone.
- **Rule 3** holds for run 2 against run 1 on both seeds, with margin (about a fifth of the
  limit).
  - *Re-measured in the final round,* run 3 against run 2 misses on both seeds: 1:22 against
    limits of 1:00 and 0:56. Run 3's peak only equals run 2's (21.4K and 21.2K against 21.1K and
    21.2K a minute).
  - Run 3 reaches that peak once its third annex block holds a Gizmo works II copy (1:09-1:11).
    Both runs fill the same floor.
  - Claims are not the cap. The bot buys one copper block a later run and holds claims to spare.
    So the critic's "the bot never buys claims" was true, but it was not what held run 3 back.
  - Open (`RULE3_OPEN`), for the lead. The levers are room kept through a Reorganize (the annex)
    or more of it.
- **Rule 6** (seed 1000, never resetting, 7 h): the preview climbs 3.6, 7.5, 10.6 and 14.3 at 1-4
  h, then holds at 14.6-14.7 to 7 h. Coin earned is 0.33M, 1.09M, 1.58M, 1.98M, 2.80M, 3.66M and
  4.52M at 1-7 h, and stage 1 stands by 5 h. Progress slows and never stops. The flat preview is
  the pressure toward a reset, not a wall.
- **Rule 1 and rule 2** while the Bay fills: §16.
- Honest: at most 4 clicks in any second in every run. The campaign takes about 2 min a seed.

### Open after the final round

- **Rule 3, run 3 against run 2, both seeds** (above). The cap is room, not claims.
- **Coin still piles up**: 0.7-1.1M on hand at 4 and 7 h of play, and over 2M by 11 h.
  - The bot buys what its plan can use: claims, annex blocks and its copies. After that, nothing on
    the floor turns the coin into progress.
  - The bills term counts measured work, so the hoard can't be burned for Patents either (the burn
    loop above).
  - What should take the coin is the next floor's content, the lead's call.
- **Rule 1 and rule 2 while the Bay fills** (§16): the wait is 39-48 min.
- **A fourth run files about 1 Patent** (above).

## 20. Idle and offline (Milestone 6)

Pillar 4 finished: time away is paid honestly and the report says how, the player can make a
factory safe before leaving, a hidden tab keeps running, and a save never costs more than 30 s.
Numbers live in `src/data/idle.ts` (and `RULES.offlineEff`, `RULES.offlineCapHours`), each with its
derivation here.

### Offline efficiency and the cap
- **The cap: 7 days** (the slice had 24 h). A holiday week is paid; a month away is not.
- **Efficiency** is one function, `offlineEfficiency(g)` in `src/sim/offline.ts`: **0.5** (PLAN.md),
  plus the **Night Shift** (below), plus Milestone 5's Patent nodes, never past **0.75**. The
  sources overlap (the Patent offline nodes alone can reach the ceiling), so a Night Shift purchase
  that would add nothing is refused with the reason, and the screen shows what each would add now.
  The ceiling is checked by the pace tests: 8 h offline at 0.75 still pays no more than 8 h open
  and idle at every stage measured (0.78–0.80 of it, below).
- **What "efficiency" means to the player**: the first hour away runs as if open and pays 100%;
  only the time after it pays e. Every screen says it in those words ("the first 1h 04m at 100% (as
  if open), the other 6h 56m at 50%"); an absence under an hour pays 100% throughout.
- **The Night Shift** (one-off coin purchases, flat prices, an Act II coin sink):

  | Upgrade | Price | Efficiency | Offered with | Derivation |
  |---|---|---|---|---|
  | Night Foreman | 150,000 | +0.05 | Steam Power (done by 1 h) | a night pays +0.05 × the 7 h of open idle after the first: at 1 h the factory idles 3.22M in 8 h, 446K of it the first hour, so 0.05 × 2.77M = 139K a night, paid back in 1.1 nights |
  | Night Shift Rota | 250,000 | +0.05 | Circuits (done by 2 h) | at 2 h, 3.17M in 8 h, 396K the first hour: 139K a night, paid back in 1.8 nights (400,000 took 2.9) |

  *Re-derived in the review round* from measured open idle (6,600–8,000 coin/min before the Bay
  floor, 1,100–1,400 after it), not the 7,200–12,500/min the first prices assumed (that was active
  income). `tests/pace-idle-early.test.ts` checks a payback of at most 2 nights at the first stage
  each is offered. Bought after the Bay floor they pay ~59K a night (runs 2–3 idle 1.35M in 8 h):
  the reset agent's Factory annex, which keeps coin chains running there, should raise that, and
  the test re-measures it on the merged build.

### The model and the report (§12)
- **Lines run at live speed offline; deliveries count at the efficiency.** So heaps fill and lines
  jam at the same times open or closed, and the report's times are the times the player would
  have seen. The replay (1 h) and every re-measure (4 min) pay in full, as live; only the
  extrapolated time is scaled. Every piece pays at most what live would, so offline ≤ open idle
  holds by construction, and the pace test checks it.
- **Segments**: a segment ends when a heap fills, the Megaproject Bay is given all it wants of an
  item, the active order fills or the selected research finishes: the things that change a
  factory's rates while nobody touches it (crates fill in minutes, inside the replay; module
  buffers in seconds; an order or a node changes what the Dock or the Hopper takes). After it,
  **60 s** live for the jam to spread (a belt of 8 tiles drains in 4 s, a machine buffer in a craft
  or two) and **3 min** to measure the new rates; a jam inside those 3 minutes opens them again
  (at most 8 times), so a stopped line's last deliveries are never paid on. Segments are bounded by
  the heaps, Bay wants, orders and nodes there are; the bots' factories need 0–5 for 8 h at every
  stage measured.
- **A jam** is a machine or module blocked **10 s straight** (a full belt blocks a machine for a
  tick or two: traffic, not a jam). Machines already jammed when the player left are counted
  apart ("already jammed"), not reported as news. **A cascade is one row**: the jams of one line (a
  Workshop item-flow line, or Factory modules joined by trunks) are reported together, naming the
  first machine to block and why, how many machines the line lost, and a fix to build: for a heap,
  how many more Slag Heaps keep it running the whole time away (its slag rate × the time, less the
  room it had, over 400), or a gravel Press once Crushing is in; for an output with nowhere to go,
  a belt to the Dock (a Crate for what the Dock refuses, a Hopper for Machine Kits); for the Dock
  refusing an item after its order filled, a Crate or a machine that uses it.
- **Credit slices of 15 min**: an order filled or a node finished while extrapolated lands on the
  timeline within 15 min of when it would have (`~` marks such a time).
- **The timeline keeps 40 entries**, nearest the start (a week away fills it with the first
  morning's jams; the totals cover the rest).
- **Segments end at a crate or the Chute's stock filling too** (since the compute budget): with a
  replay of minutes, a Buffer Crate (50) or the Factory Chute's stock (20 an item) that fills after
  it would otherwise be paid on as if its line ran on. Their fill rates are measured in the window
  like a heap's; the segment ends when one fills, it is set full, and the live minutes after let
  its line back up (a jam row if a machine stops).
- **The run is spread over frames** (20 ms a frame, the clock read every 100 ticks), with a
  progress bar, never a frozen page. Measured in Chrome on the Act II bot's 2 h factory (179
  Workshop buildings, 48 Factory pieces): an 8 h offline run takes **3.0–3.6 s** while the page
  draws (longest frame 54–58 ms, the same as an ordinary frame there); in node the same run is
  2.5–3.1 s at every stage from 1 h to 5 h (the review round, with the order and research
  segments and the windows opened again: 3–6 s in node with eight test files running side by side,
  across runs 1–3; Chrome not re-measured).

### The compute budget (the Acts IV-V review)
The review measured an 8 h offline run at **24-38 s** on the 15 h and 40 h checkpoints (the full
hour replayed at 0.84-1.17 ms a tick; `jobMsPerFrame` had assumed 0.05 ms and "about 5 s"). The
replay is now shortened by a **deterministic** budget (`src/sim/offline.ts` `tickCostMs`,
`src/data/idle.ts`): nothing in `src/sim/` reads a clock, so the window is the same in every replay
and on every machine, and a forecast is still the morning's report.
- **A tick's cost** is estimated from what ticks: **0.008 ms**, plus **0.0005 ms** a Workshop piece
  (belts, Miners, machines, splitters, crates, heaps), **0.0012 ms** a Factory piece (modules and
  trunks) and **0.0018 ms** a high-floor piece (modules and routes on the District, the World and
  Beyond). *Calibrated* in node on the owner's PC (best of 3 × 1,500 ticks, with other agents'
  work running, as the PC usually is) on the five campaign checkpoints, each also with its high
  floors, its Workshop, or everything stripped, so each part is measured apart:

  | Checkpoint | Workshop / Factory / high pieces | measured ms a tick | estimated |
  |---|---|---|---|
  | 1 h | 164 / 40 / 0 | 0.130 | 0.138 |
  | 5 h | 171 / 48 / 0 | 0.163 | 0.151 |
  | 15 h | 208 / 18 / 242 | 0.634 | 0.569 |
  | 30 h | 208 / 18 / 72 | 0.291 | 0.263 |
  | 40 h | 208 / 18 / 108 | 0.327 | 0.328 |

- **The budget**: the live ticks of one run (the replay, its windows opened again, each segment's
  settle and measure) may cost about **5,000 ms** at that estimate. The first replay takes
  **three quarters** of it (an hour at most, **4 min** at least: a settle and a full measuring
  window), its last 5 minutes (or all of it, when shorter) measured as before. Each segment after a
  heap fills keeps its **60 s** settle (physical: the jam spreading) and measures for what the
  budget has left, **3 min** down to **1 min** at least. A small factory (the slice, Act I) still
  replays the whole hour; the Act II bot's factory replays about 20 min; a 15 h District about
  6.5 min.
- **Honesty with a shorter window**: the replayed part pays in full and the rest at e, as before,
  so a shorter replay pays a little less (more of the time at e), never more. A heap filling was
  already a segment; **a crate or the Chute's stock filling** is one too now (above), so a line that
  stops after a short replay is still not paid on. Jams inside a measuring window still open it
  again (at most 8 times, at the window's current length). Check 12 (b) is restated on the replayed
  window: it pays as open idle does, the rest at e − 0.03 to e + 0.05 of what open idle pays in it
  (`tests/pace-idle-helpers.ts` measures open idle over the same window).
- **Measured, before and after** (node, the owner's PC, other agents running; 8 h away, the
  report's coin at each checkpoint's own efficiency):

  | Checkpoint | before: s / replayed | after: s / replayed | segments before / after | coin before / after |
  |---|---|---|---|---|
  | 1 h | 11.1 s / 1h 26m | 7.5-7.8 s / 47m 16s | 5 / 10 | 1.98M / 1.82M |
  | 5 h | 13.1 s / 1h 08m | 6.1-6.4 s / 29m 34s | 2 / 3 | 2.63M / 2.44M |
  | 15 h | 41.6 s / 1h 01m | 5.1-6.6 s / 6m 38s-7m 29s | 0 / 0-1 | 131M / 120M |
  | 30 h | 20.5 s / 1h | 4.6-5.2 s / 11m 52s | 0 / 0 | 38.8M / 36.8M |
  | 40 h | 24.4 s / 1h | 4.2-4.4 s / 9m 32s | 0 / 0 | 77.5M / 73.6M |

  (Two runs after, the second with a pace test running beside it; between them a window opened
  again went back to 3 min at most, as before the budget, which gave the 15 h run one segment.)

  In Chrome, with the page drawing (`e2e/out/offshot.mjs`, my own server): 15 h **3.3-4.1 s**, 40 h
  **3.4-4.1 s** (the 15 h one with a District route cut to one skiff). A factory needing many segments goes past 5 s (the 1 h checkpoint's 10 segments, two
  minutes each at the floor: 7.8 s); the windows' floors are kept for honesty. "Replayed" counts
  the re-measures. The coin falls 5-8%: the minutes no longer replayed pay at e instead of 100%.

### Safe for overnight: the forecast and stopping a line
- **The forecast is the offline model on a copy of the game** (`forecast(g, hours)`), for 1, 8
  (the default, a night) or 24 h: the jams it shows are the ones the morning's report would show,
  at the same times, and the coin is what closing the game would pay. The live game is never
  touched (a test checks the fingerprint), and it runs on while the forecast is computed (8 h
  forecast: about 6 s in Chrome with the factory running).
- **Stopping** (`{ k: 'pause', x, y, floor?, line?, on }`, a logged command): a stopped machine or
  Miner takes nothing, makes nothing and draws no power; it keeps what is in its buffers; a
  splitter routes its share to its other sides as around any full machine. A stopped module runs at
  0 and takes nothing. `line: true` stops every machine of the line (named by any machine in it,
  or by the heap it fills) or every module joined by trunks. The pip goes grey and the report says
  "Stopped by you". **What it is for**: a jam is a line stopped by surprise with its heap full; a
  stop is the same line stopped on purpose with its heap's room kept for when you are back, so the
  morning starts with 53 minutes of running (one smelter's 400 slag) instead of a line to unjam
  first. It also takes a line out of the forecast's jams, so a "safe for overnight" factory is one
  the player chose, line by line. It earns nothing while stopped, and the forecast says so in coin.
  **The overnight screen offers "Stop line" only where it keeps something** (a line stopped by its
  heap filling; the tip says how long the kept room runs when you are back); a line that would stop
  for any other reason keeps nothing by stopping, so its row offers the fix instead. A stop or a
  start re-runs the forecast at once.

### Inspiration (§15)
- From the slice end (Act II), a click on a Hopper (either floor) credits the selected node with
  **0.1% of what it still needs**, item by item, as items delivered, up to **30% of each item's
  cost** per node. A capped click is quiet (no refusal, no research screen opening under a fast
  clicker). It counts against the 12 clicks/s cap.
- *Derivation*: of the remaining cost, so each click gives less: 30% takes
  ln(0.7) / ln(0.999) = 357 clicks, 89 s at the sustained 4 clicks/s (§1), 30 s at the cap. Active
  play helps research a little and can never replace the line (pillar 1).
- The Hopper was the target because it is where research is paid, and a click there needs no new
  building. Before Act II a Hopper click still opens research.

### Notation and readability
- `Num.format` writes four notations, chosen in Options and kept in localStorage (a player
  setting, never sim state): **standard** (12.3K … 999Dc, then scientific past 1e36),
  **scientific** (1.23e4), **engineering** (12.3e3, exponents in threes) and **letters** (the named
  suffixes to Dc, then aa, ab … zz, aaa … one per thousand). All four write plain whole numbers
  with commas below 10,000 and floor (never more than you have).
- **One helper** (`src/engine/fmt.ts`): amounts, rates per minute (480, 37.5, 0.75), power
  (300 kW, 1,200 kW, 12.5 MW), shares (41%), multipliers (x1.25) and durations (4m 10s, 2h 05m,
  3d 4h). The HUD's coin counter, rates and kW, the coin pops, the hover report and the store's
  per-minute figures go through it, so the notation reaches them and no `toFixed` noise
  ("1.20M", "37.50") reaches the player.

### The background tab
- A hidden tab gets no animation frames. The sim keeps running on a **1 s timer** (what browsers
  allow a hidden tab), each pump running the ticks owed since the last within **40 ms**, or up to
  **4%** of the time since the last pump when the browser has throttled the timer (Chrome: once a
  minute after 5 min hidden; 1,200 ticks at 0.05 ms is 60 ms of the 2.4 s allowed), never more than
  **250 ms** at once. A pump **2 min late** means the tab or the machine slept: that gap is time
  away (the offline model), not ticks owed. Sparks pause (`visible: false`).
- **On return**: up to **60 s** owed is run live, **40 extra ticks a frame** (about 2 ms), so it
  clears in half a second with no stutter; more goes through the offline path, as a closed game.
- *Measured* (Chrome, the Act II bot's 2 h factory, 20 s hidden): 20 pumps, 400 ticks (20 a
  second, as live), **1.0–1.4 ms of work a second (0.10–0.14% of a core)**, the longest pump
  2–4 ms; owed on return 0; the 90 frames after the return were no longer than ordinary frames.
  In node a tick of the Act II factory costs 0.031–0.040 ms (1 h to 5 h): 0.6–0.8 ms per hidden
  second, a hidden hour about 2.5 s of work.

### Saves
- **Autosave every 30 s of real time** (not sim time: fast-forward would save every frame), and on
  `visibilitychange` (hidden), `pagehide` and `beforeunload`. Closing loses nothing when any of
  those fires, and at most 30 s when none does (a crash); the save-cadence test checks both.
- **Three rolling backups**, at most one every **10 min**, taken from the save being replaced and
  only if it loads: a save broken by a bug is at most 10–30 min behind a good one, and a broken save
  never pushes a good backup out. Out of room, the oldest backup goes first.
- **Corruption recovery**: on load the save is parsed, migrated and rebuilt (`checkSave`); if any
  step fails, the raw string is kept aside (Options can copy it), the newest backup that loads is
  used, and the player is told in plain words ("Your last save could not be loaded (it was cut
  short or garbled). Loaded the backup from 12 minutes ago; the damaged one is kept in Options.").
- Size: the Act II bot's save is 81–102 KB of JSON from 1 h to 5 h (128 KB as an export string at
  2 h), and checking one loads takes 3–4 ms; four copies fit well inside a browser's 5 MB.
- **Save size (Milestone 14; the target is under 200 KB)**: late saves outgrew it as JSON (the
  Act III bot's 40 h checkpoint 168 KB, 229 KB as an FW1 export string; every floor full 485 KB,
  647 KB as an export). Since Milestone 14 a slot holds the JSON deflated (`FWZ1.`, base64url, a
  checksum) and an export string is `FW2.` the same way: the 40 h checkpoint is **31 KB**, every
  floor full (the dense 24x16 Workshop, the widest Factory, 168 / 200 / 172 modules on the
  District, World and Beyond) **33 KB**, packed in about 10 ms (`tests/savesize.test.ts`; in the
  page, `e2e/saves.mjs`: a staged World and Beyond with every high floor full, 322 KB of JSON,
  is a 25 KB slot). A slot of plain JSON and an FW1 string still load; no payload changed, so no
  migration (DECISIONS.md "Milestone 14").
- **Saves v5**: the state gains `inspire` (Inspiration given per node); `paused` on machines and
  modules and the Night Shift in `upgrades` need no migration (absent means none).

### Measured (pace tests, `tests/pace-idle-*.test.ts` and `tests/pace-offline.test.ts`)
Each stage is a saved state of a bot's factory:
- **Active** is what the bot earned in the next 30 min.
- **Idle** is the same state left open with no input (live, tick by tick, Sparks off) for 30 min,
  1 h and 8 h.
- **Offline** is the same state closed for 8 h (`runOffline`), at e = 0.5 and at the 0.75 ceiling.

Run 1 is the Act II bot. Runs 2, 3 and 4 are the campaign bot after a Reorganize with its Patents
spent: 13 nodes bought for run 2, 5 more for run 3, 4 more for run 4.
*From the final round*, run 4 is measured too. Runs 1-3 play and reset as the campaign plays them,
then run 4 plays 5 h from 9.8-9.9 h of play. Its stages stand at 10.8-13.9 h. With 8 h offline
measured at each, the stages run to past 12 h, and the run itself to 14.8-14.9 h.

"Share" is check 12 (b): what the 7 h after the first pay, as a fraction of what open idle pays in
them. It must be e − 0.03 to e + 0.05. Seeds 1000 and 8919 read the same to two places wherever
both were measured (Sparks are the only random part, and idle has none), so one row stands for
both unless the seed is named. Measured in the final round:

| Stage (hours of play, seed 1000) | active 30 min | idle 30 min | active / idle | idle 1 h | 8 h idle | offline at 0.5 (of idle, share) | at 0.75 (of idle, share) | segments |
|---|---|---|---|---|---|---|---|---|
| Slice end (+10 min) | 80K (10 min) | 73–82K (10 min) | 0.98–1.09 | 437–490K | 3.22–3.27M | 1.88–1.94M (0.58–0.59, 0.52) | 2.55–2.61M (0.79–0.80, 0.76) | (not logged) |
| Run 1, 1 h | 379K (8919: 376K) | 250K (248K) | 1.52 (1.52) | 491–493K | 3.28M | 1.98–2.00M (0.60–0.61, 0.53–0.54) | 2.63–2.64M (0.80–0.81, 0.77) | 5–7 |
| Run 1, 2 h | 317K | 198K | 1.60 | 396K | 3.17M | 1.80M (0.57, 0.51) | 2.48M (0.78, 0.75) | 1 |
| Run 1, 3 h | 171K | 108K | 1.58 (1.59) | 221K | 2.28M | 1.27M (0.56, 0.51) | 1.78M (0.78, 0.76) | 3 |
| Run 1, 4 h | 390K | 234K | 1.66 | 520K | 4.55M | 2.54M (0.56, 0.50) | 3.55M (0.78, 0.75) | 0 |
| Run 1, 5 h | 427K (429K) | 281K (280K) | 1.52 (1.53) | 566–567K | 4.60M | 2.58M (0.56, 0.50) | 3.59M (0.78, 0.75) | 0 |
| Run 2, 1 h (5.4 h) | 526K (528K) | 329K (328K) | 1.60 (1.61) | 655–657K | 5.24M | 2.95M (0.56, 0.50) | 4.10M (0.78, 0.75) | 0 |
| Run 2, 2 h (6.4 h) | 352K | 238K (235K) | **1.48** (1.50) | 464–470K | 3.68–3.72M | 2.07–2.09M (0.56, 0.50) | 2.87–2.90M (0.78, 0.75) | 0 |
| Run 2, 3 h (7.4 h) | 545K (522K) | 232K (349K) | 2.35 (**1.49**) | 463K (700K) | 3.71M (5.60M) | 2.09M (3.15M) (0.56, 0.50) | 2.90M (4.38M) (0.78, 0.75) | 0 |
| Run 3, 1 h (8.4 h) | 518K (533K) | 328K | 1.58 (1.63) | 655K | 5.24M | 2.95M (0.56, 0.50) | 4.09–4.10M (0.78, 0.75) | 0 |
| Run 3, 3 h (10.4 h) | 534K (532K) | 353K | 1.51 (1.51) | 706–707K | 5.64–5.66M | 3.18M (0.56, 0.50) | 4.41–4.42M (0.78, 0.75) | 0 |
| Run 4, 1 h (10.9 h) | 359K (355K) | 367K (366K) | **0.98 (0.97)** | 724K | 5.72M | 3.22M (0.56, 0.50) | 4.47M (0.78, 0.75) | 0 |
| Run 4, 2 h (11.9 h) | 436K (400K) | 226K (228K) | 1.93 (1.75) | 452–457K | 3.61–3.66M | 2.03–2.05M (0.56, 0.50) | 2.82–2.85M (0.78, 0.75) | 0 |
| Run 4, 3 h (12.9 h) | 511K (523K) | 345K (349K) | **1.48** (1.50) | 692–698K | 5.54–5.59M | 3.12–3.14M (0.56, 0.50) | 4.33–4.37M (0.78, 0.75) | 0 |
| Run 4, 4 h (13.9 h) | 514K (523K) | 346K (349K) | **1.49** (1.50) | 692–699K | 5.54–5.59M | 3.12–3.14M (0.56, 0.50) | 4.33–4.37M (0.78, 0.75) | 0 |

- **Offline is honest at every stage, both seeds, both efficiencies.** It pays 0.56-0.61 of open
  idle at 0.5 and 0.78-0.81 at 0.75. It is never more than open idle and never less than e of it.
  The 7 h after the first pay 0.50-0.54 and 0.75-0.77 of open idle's (check 12, restated). An 8 h
  offline run takes 7-10 s in node at every stage with the suite running beside it, in 0-7
  segments.
- **Rule 4 holds at 20 of the 26 readings** (active 1.50-2.35× open idle). It is **open** at six,
  listed in `RULE4_OPEN` with the reason and logged, not failed. *Re-read in the final round:* run
  3 at 1 h now passes on both seeds (1.58 and 1.63, was 0.77 and 0.72). Its annex blocks now come
  before the Bay floor, so the Gizmo chains the Bay clears keep selling. The six open readings:
  - **Run 4 at 1 h, both seeds** (0.98× and 0.97×): the Bay floor is laid in this half hour (the
    head starts bring it to about 1:10), and the campaign clears the Gizmo chains for it. This is
    run 3's old dip, one run later.
  - **Seed 1000's run 2 at 2 h and run 4 at 3 h and 4 h, and seed 8919's run 2 at 3 h**
    (1.48-1.49×; the other seed reads 1.50 or more). The bot only clicks Overdrive here, waiting on
    research or with its plan done. Overdrive is 3× for 10 s, then 30 s cooling, so
    (30 + 30) ÷ 40 = 1.5× for a line kept in it (§18). That is the band's floor exactly, and a line
    whose inputs can't keep up at 3× reads just under it.
  - The Act II bot's 2 h reading on seed 8919 (1.46×) is open for a third reason. Its Bay floor
    is laid at 2:16, inside the window (§18).
  - *Tried and rejected:*
    - A 20 s cooldown (the review round) moved the first reset out of 4–6 h.
    - A 25 s cooldown (the final round, 1.57× for a line kept in Overdrive) made seed 8919 worse.
      Its 2 h reading fell to 1.42, its longest wait between goals before the Bay floor rose to
      17.0 min (the bound is 15), and its run 3 never passed run 2's peak.
    - Rule 4's 1.5 floor is not lowered. The lever is the lead's call: Overdrive's duty cycle and
      the band's floor are the same number.
- **At the slice end rule 4 reads 0.98–1.09**: the planner's ten minutes after the Festival build
  nothing, so they earn what the untouched factory does. Logged, not tested: the slice's end is a
  pause by design, and the measure that matters there is check 12.
- **Open idle after the Bay floor** is 3,600–11,700 coin/min with the annex (runs 1–4 from 3 h).
  The Night Shift's prices are derived from the stages where it is offered (above). The payback
  test re-measures them, and it still passes.

## 21. Act III: the District (Milestone 7, 15-40 h)

New thinking: **composing modules**. Act II asked how many of each and what they run on; Act III
asks where each group stands and how its goods get to the next one. The plan and the contracts:
`docs/endgame.md`. Built and measured in Milestone 7; the measured pace is at the end.

### The District
- **A third floor** (research *Zoning*), a sky platform above the Factory. It holds **depth-2
  modules only** (groups folded on the Factory, §18 Nested folds); a depth-3 module (folded here)
  goes up to the World (§22). Every module is one tile, as on the Factory.
- **12x10 to start** (120 tiles, 1.25x the Factory's 96, each tile a group of two to six modules),
  with **three lots of 2x10** east of it bought at 1M x n (linear, the annex pattern, §19; 45-55
  min of the 18-21K a minute the floor makes when the District opens), and a fourth kept for good
  by the Floating City's second stage (20x10 at most). The Dock and the Hopper
  stand on the east edge like the Factory's; the Bay at the south-west corner once a Megaproject
  of this floor is researched.
- **No trunks: skiff routes.** A route flies one item from a module's output buffer to a module
  that takes it, or to the Dock, the Hopper or the Bay. Its throughput, items a second:

      skiffs x load / (2 x distance / speed + dwell)

  District skiffs fly **2 tiles/s**, carry **1 item** a trip and spend **1 s** at the two ends;
  distance is between tile centres, as the crow flies, never less than 1. So a skiff moves **0.5
  items/s** to a module beside it, **0.17** five tiles off, **0.08** across the floor. *Derivation:*
  **ship value, not bulk.** Depth-2 flows run from 0.06 to about 1.1 a second; a bulk feeder
  (glass, steel, solvent at 0.5-1 a second) placed across the floor needs six to twelve skiffs, so
  it must stand beside what it feeds, while a Servo group (0.1-0.2 a second, 3,600 coin each) flies
  across the floor on two. Where a group stands is the act's decision (rule 5), and the price of a
  skiff is what a bad layout costs every run. (The second gate: at 4 a trip one skiff carried every
  depth-2 flow even across the floor, 120 routes held 120 skiffs, and distance never bound.) A skiff
  is **40,000 coin, flat** (no price per skiff owned): about 2 min of the floor's income when the
  District opens, 27 s at 15 h and 12 s at 30 h (89K and 195K a minute, measured), so a bad layout
  costs at the act's start and a dozen skiffs is a choice later; refunded when taken off; a route
  holds up to 12.
  Routes from one output share it in turn. At most **120 routes** a floor and **20 more a lot**
  bought (the second gate: at 120 flat the cap was the real wall at 30 h with half the tiles used,
  and the lots were worth nothing), shown on the tool strip (`routes 96/140`), so the floor stays
  readable (PLAN.md not-list).
- **The waste chute.** On a high floor a module's waste (slag, oil, sludge) with no route out of it
  goes down to the floor's Dock on its own, sold or scrapped there as the Dock does. *Derivation:*
  the byproduct lesson is learned on the Workshop and the Factory; on a floor of groups the second
  gate found half the routes at 30 h carrying waste to the Dock, the act's biggest chore and the
  route cap's filler (pillar 2: the chore becomes the floor's). A waste an input wants is still
  routed by hand (fertilizer from sludge).
- **The District takes its own folds.** Depth-2 groups and the depth-3 modules folded here (§21
  District folds) both stand on it: a fold packs a group's routes into one tile's ports, the
  answer to a crowded floor (pillar 1: designing beats buying). The World takes depth 3 (§22).
- **Everything else is the Factory's**: modules run as rate functions (`stepModule`), starved or
  blocked in proportion; a byproduct with no route blocks its module (the slag lesson, one floor
  up); Overdrive on a module runs every module joined to it by routes; a click on the Hopper is
  Inspiration; claims and Machine Kits are held by the groups inside (§18), on every floor.
- **The readout** on every route: its skiffs, what it carries now, what its source makes of the
  item (the "wanted"), and its length.

### District folds (research *District Folds*)
A box up to 8x8 of at least two depth-2 modules, every one joined to the others by a route inside
the box (one group, not a pile: §18's rule), audited for 70 s (45 with Quick Audits) like a nested
fold: U the modules' mean run fraction, W the byproducts flown out of the box or to a module inside
over those made (and those a blocked module would have made), C module tiles over box tiles over
0.6. Routes crossing the box edge are its ports; routes inside are its logistics, and their skiffs
are refunded with the fold (like trunk tiles, §18). The design's bill is its groups' bills. It is a
**depth-3 module**, for the World floor (§22). It unfolds back onto the District, routes and all.

### The Chute (research *Chutes*)
Tier 3 lines are still designed on the Workshop (pillar 1: the Workshop is the design bench, §5),
but their inputs are tier 2 goods the Workshop has no room to make. The **Factory Chute** (one on
the Factory floor, 5,000 coin, refunded when lifted) takes whatever trunks bring it and drops it to
the Workshop; a **Chute Mouth** (Workshop, 400 coin) set to an item pushes that item out of its
front, one at a time as fast as the belt takes it (120/min). The stock between them holds **20 of
each item** (10 s of a full belt: enough to ride out a module's round robin; full, it backs the
trunk up at once and the pip says so). **A fold box may not hold a Chute Mouth** (it would make
items from nothing as far as the box can see), so a tier 3 line is audited with its Chute Mouths
outside the box feeding it through ports, and folds into a module with those inputs. On the
Factory the same feeder modules then feed the new module, and the group nests (§18) for the
District.

### Tier 3 (19 items)
Values are about 3-4x their inputs' at the Dock (§18's rule), so a deeper chain earns more per
machine-second; steps are `chainSteps` (§19), so tier 3 products file Patents a step deeper.

| Item | Made by | From | Time | Value | Steps |
|---|---|---|---|---|---|
| Solvent | Chem Vat | 2 oil + sand, sludge 1 per 2 | 2 s | 30 | 2 |
| Sludge | (Chem Vat byproduct) | | | 0, refused | 2 |
| Rubber | Chem Vat | plastic + solvent → 2 | 3 s | 80 | 3 |
| Battery | Chem Vat | 2 copper ingots + solvent + plastic | 5 s | 240 | 3 |
| Fertilizer | Chem Vat | 2 sludge + gravel | 2 s | 12 | 3 |
| Bearing | Press | steel → 2 | 2 s | 30 | 3 |
| Gearbox | Assembler | 2 gears + 2 bearings + steel | 6 s | 360 | 4 |
| Produce | Greenhouse | fertilizer → 3 | 6 s | 10 | 4 |
| Sensor | Assembler | 2 glass + circuit + rubber | 6 s | 1,000 | 4 |
| Processor | Assembler | 3 circuits + 2 solvent | 8 s | 2,200 | 4 |
| Servo | Assembler | motor + gearbox + circuit | 10 s | 3,600 | 5 |
| Sandwich | Assembler | 3 produce + plastic | 4 s | 200 | 5 |
| Clockwork Frog | Assembler | gearbox + 2 bearings + rubber | 8 s | 1,800 | 5 |
| Weather Balloon | Assembler | 3 rubber + sensor + battery | 10 s | 4,600 | 5 |
| Self-Folding Umbrella | Assembler | servo + 2 rubber + plastic + steel | 12 s | 12,000 | 6 |
| Robot Arm | Assembler | 2 servos + sensor + 2 steel | 16 s | 24,000 | 6 |
| Lift Rotor | Assembler | 2 motors + 2 gearboxes + 4 steel | 12 s | Megaproject part | 5 |
| Transmuter Coil | Assembler | processor + 2 batteries + 4 rubber | 14 s | Megaproject part | 5 |
| **Autonomous Sandwich Engineer** | Assembler Mk2 only | robot arm + processor + 10 sandwiches + battery | 30 s | 90,000 | 7 |

*Derivation:* oil, the refinery's byproduct and Act II's boiler fuel, becomes the input of the act's
chemistry, and the Chem Vat's own waste (sludge) with the smelter's (gravel) becomes fertilizer:
byproducts are the routing layer that changes most over time (PLAN.md). The Engineer needs a 2x2's
faces for four inputs and a buffer for twenty sandwiches, so it is a Mk2 recipe (`mk2`).

### Machines
- **Chem Vat** (1x1, 100 kW, 12,000 coin, *Chemistry*): four recipes; priced a little over the
  Refinery's 9,000 (§18), against the Act III factory's income.
- **Greenhouse** (2x2, 150 kW, 25,000, *Hydroponics*): a Mk2 smelter's draw, about an Assembler
  Mk2's price.

### Modes (research *Recycling*)
**Recycling**: a byproduct every twice as many crafts (half the waste) at 0.9x speed. **Byproduct**:
every half as many (twice the waste, never more than one a craft) at 1.1x speed, for a line whose
waste is another's input (gravel from slag, fertilizer from sludge). Powered machines only, like
§18's modes; a kept design refolds after the short check only in normal mode (§19).

### Research, page 3
Seventeen nodes (`src/data/research.ts`, `act: 3`), every one waiting for **the Great Drill's stage
3** (`drill: 3`): Act III opens once Act II's spine is finished, about the third run (§19). Zoning
is paid in what the Act II floor already makes (200 motors, 300 circuits, 300 concrete, measured below); Chutes
(2,500 steel, 100 motors) next; then each tier 3 node in the goods of the node before it.

### Megaprojects #2 and #3 (`src/data/megaprojects.ts` `MEGAS`, state `s.megas`)
Built at the District Bay, kept through every reset like the Great Drill (§18). The Bay takes what
any open project still wants, the first project first; what none counts goes on to the Dock (the
Bay never jams, §19). Each stage pays its Patents in proportion as it is delivered, as the Drill's.

| Project, stage | Wants | Reward, for good | Patents |
|---|---|---|---|
| The Floating City 1, the Platform | 120 lift rotors, 1,500 concrete | the Factory floor's ninth row | 6 |
| The Floating City 2, the Spires | 150 lift rotors, 300 sandwiches, 2,500 glass | a fourth District lot | 8 |
| The Scrap Transmuter 1 | 80 transmuter coils, 3,000 steel | every Dock buys slag, oil and sludge at 25% of what made them | 8 |
| The Scrap Transmuter 2 | 150 coils, 120 processors | a byproduct with nowhere to go sells where it stands instead of blocking | 10 |

*Derivation:* the Floating City's row is §15's (+1 Factory row), the Transmuter's 25% is §15's;
"what made them" is the cheapest main output a recipe makes beside the byproduct (slag 0.75, a
quarter of an ingot: under the 1 a slag gravel earns, so crushing still pays; oil 6; sludge 7.5).
Each stage is about an hour of two groups of its parts at the Bay (the second gate cut them: at
4,000 concrete, 8,000 steel and 6,000 glass a stage was 2.6-4 h of one group; concrete is
slag-bound, 4 slag each, and the whole run-3 floor makes about 2.8 slag a second). A project with a
stage standing keeps its Bay open in every later run without its research (its progress is kept;
the second gate found every run re-paying the research before the Bay counted anything). The
Transmuter's second stage ends the byproduct lesson for good, at the end of the act that finishes it.

### Orders and reputation (Act III, `src/data/orders.ts`)
Ten orders, each about 2x what its goods fetch at the Dock (§7's rule; 1.96-2.2x as priced):

| Order | Customer | Wants | Pays |
|---|---|---|---|
| Picnic on the Rim | Bramble | 300 sandwiches | 120,000 |
| The Clockwork Chorus | Bramble | 100 clockwork frogs | 380,000 |
| Umbrellas for the Mayor | Bramble | 30 self-folding umbrellas | 720,000 |
| Calibrated Senses | Unit 7 | 200 sensors | 420,000 |
| The Specimen Drawer | Unit 7 | ten of eight tier 3 goods | 160,000 |
| The Servo Ballet | Voltaire | 120 servos | 900,000 |
| The Weather Gala | Voltaire | 60 weather balloons | 600,000 |
| The Sludge Pond | the Committee | 2,000 sludge | 30,000 (waste, paid as a sink) |
| Spare Parts | the Committee | 600 bearings, 200 gearboxes | 180,000 |
| The Engineer | the Committee | 1 Autonomous Sandwich Engineer | 200,000 |

Each pays a reputation point; the act's rewards come at reputation 4 (Bramble's Skiff Club: a
skiff carries one more; Unit 7: the Chute holds 60 an item; Voltaire: the Chem Vat and Greenhouse
draw half their power) and the Committee's 6 (Pocket Skiffs: a route's first skiff is free),
each a rule, never a multiplier (`src/data/rules.ts`).

### Patents (Act III, `src/data/patents.ts`)
Ten nodes, priced as Act II's (§19): about a Patent for every 10-15 minutes of a run a node saves.

| Node | Branch | Cost | Effect |
|---|---|---|---|
| Zoning Charter | head start | 3 | Zoning and Chutes known (about 25-30 min of Act II goods) |
| District Deeds | head start | 3 | the District opens with its first lot (1M coin, 45-55 min) |
| Chemistry Notes | head start | 3 | Chemistry, Vulcanizing, Batteries |
| The Bearing Patent | head start | 2 | Bearings, Servos |
| Sense and Logic | head start | 3 | Sensors, Processors, Recycling, Hydroponics |
| The Robotics Patent | head start | 3 | Robotics, Sandwiches |
| Long Skiffs | rule | 2 | skiffs fly 3 tiles/s, was 2 |
| The Bigger Nest | rule | 2 | the nested fold box 10x10 |
| Ward Boundaries | rule | 2 | the District fold box 10x10 |
| The Dispatcher | automation | 3 | a skiff onto the route furthest short of its want, every 10 s |

*Derivation:* Long Skiffs is a rule about distance, not a multiplier on output: at 3 tiles/s a
route five tiles long carries 1 / (10/3 + 1) = 0.23 a skiff, was 1 / (5 + 1) = 0.17, and a route
beside its consumer gains less (0.5 to 0.6), because the dwell is unchanged. The Dispatcher buys
at the full price, only for a route carrying under 90% of what it is wanted and only while a skiff
costs under 5% of the coin on hand (20 skiffs' worth), so it never spends a save; pillar 2: the
act's chore, placing skiffs, becomes a machine's.

### Challenges (`src/data/challenges.ts`, `src/sim/systems/challenges.ts`)
A Challenge is taken at a Reorganize, from the second one on: the next run holds its rule until
its goal is met, and its reward is kept for good (`meta.challenges`). Patents are filed as for any
run; giving a Challenge up costs nothing but the reward. A won Challenge isn't taken again.

| Challenge | Rule | Goal | Reward, for good |
|---|---|---|---|
| No Splitters | no Splitters built | the Gizmo Festival | every high floor holds 20 more routes |
| Hands Off | no click counts (starts with the Bellows and 60 coin) | 200 Gizmos delivered this run | the Dispatcher works without its Patent |
| Lean Power | Steam Engines and Generators make half | 300 circuits delivered this run | they make 10% more |
| Three Kinds | three kinds of machine on the Workshop (the Hand Furnace free; a Mk2 is its family) | a fold graded S | the nested and District fold boxes a tile larger |
| Small Boxes | fold boxes 4x4 | the Gizmo Festival | fold boxes a tile larger each way |

*Derivation:* every goal is something done this run (an order, a delivery, a fold), never a
research a head start already knows (the second gate: Hands Off and Lean Power, with Folding and
Circuits as goals, were won in 2 s). Every reward is small, specific and tied to what earned it,
and matters in Act III (the second gate: free Splitters and 10% off Workshop machines were worth
nothing by then): routing room for routing discipline, automation for a player who proved they
need none (the Dispatcher, a 3-Patent node), a tenth of the power plant, a tile of the deeper fold
boxes and of the Workshop's (what one Patent node gives, §19). Hands Off's 60 coin is the first
Miner and its belt (§4), so the run can start without a click. DECISIONS.md: Challenges are an Antimatter
Dimensions convention (flagged when PLAN.md listed them); here the goals are factory goals and the
rewards rules, never a multiplier on everything.

### Scenarios (`src/data/scenarios.ts`, `src/sim/scenario.ts`)
A Scenario is a separate game in its own save slot, open after the first Reorganize: a board fixes
the land (none for sale), the research (every node of Act I, or of Acts I and II but the Great
Drill), the coin and one twist; there is no Reorganize. Its score is the best fold of one product
this game: the design's grade-applied rate of it per minute, or per tile of the fold box. The app
keeps the personal bests in local storage (never the sim).

| Board | Land | Twist | Scored by |
|---|---|---|---|
| Tiny Island | chunks A and B, 6,000 coin | two chunks | Gizmos a minute per tile of box |
| Rich Ore, Little Power | A, C, E, F, 250,000 | Miners 2x, power producers 0.5x | glass a minute |
| Scarce Belts | all six, 600,000 | 40 belt tiles in all | circuits a minute |

*Derivation:* Tiny Island is §10's compactness read as a number (chunk A alone has no copper, so
the board is A and B); Rich Ore makes sand free and kW dear, scored in glass from the powered Kiln
(steel was planned, but a Mk1 smelter draws no power: the second gate);
Scarce Belts' 40 tiles are two-thirds of an Act II circuit line's (§18), so machines face each other
and feed by side intake. The coin is each board's lines twice over at §4 and §18 prices.

### Pacing (measured, Milestone 7; re-measured under the second gate's rules)
§16's targets for Act III: the District at about **11 h** (moved from 15 h at the second gate:
the Great Drill stands at about 9.5 h, and holding Zoning to 15 h would add Act II's dead air),
the first Act III megaproject stage by 25 h, rules 1 (a goal every 10 min of active play), 2 (no
15 min without a decision) and 5 to 40 h for the planner bot. Measured by the campaign bot with the
Act III policy (`src/sim/bot3.ts`, `tests/pace-act3.test.ts`, seed 1000, 40 h of play). A run
before Act III resets when the Reorganize preview stalls; an Act III run resets once its District
is full (`ACT3_FULL`: the plan through and nothing placed or bought for 10 minutes, every tile or
every route taken and every lot bought), or at the run's cap.

| Measure | Target | Measured (the second gate's rules) | Before (Milestone 7) |
|---|---|---|---|
| District open (Zoning researched) | about 11 h | **10:01** (hand-over 9:53, run 3) | 10:01 |
| Floating City stage 1 | by 25 h | **11:30** (run 3) | 15:48 (run 4) |
| Rule 1 over Act III | 10 min | **20.1** min at worst (run 3 10.0, run 4 10.4, run 5 20.1 from 28:29, five minutes after its hand-over; run 6 6.0) | 42.5 in run 4; 18.5 h from 21.5 h |
| Rule 2 over Act III | 15 min | **17.3** min at worst | the same |
| District modules | 20+ | **139** at most (every route and lot taken; 46 at 40 h, two hours into run 6) | 49 at 40 h |
| Routes; between modules (rule 5) | some | 176-180 on a full floor; up to 38 between modules | 119 of 120; 14 between |
| Skiffs (rule 5) | more than one a route somewhere | 224 on 179 routes (1.25 a route), at most 3 on one | one each |
| Lots bought | as the floor fills | all three, every Act III run | none |
| Chemistry (Act III bot) | the act's chain | **Chemistry 10:03, Robotics 12:03** (run 3; Solvent, Rubber, Processors folded) | none |
| District folds | some | **none** (open, below: no Sensors design) | none |
| A sim tick with the biggest District | under 4 ms (e2e/perf.mjs) | **0.95 ms (139 groups)** | 0.24 ms (49) |

The runs: 1 0:00-4:24 (14 Patents), 2 4:24-7:26 (7), 3 7:26-16:52 (29, Act III from 9:53), 4 16:52-26:07 (6, Act III from 19:13), 5 26:07-35:33 (5, Act III from 28:24), 6 35:33-40:00 (Act III from 37:47).

**Re-measured with chemistry** (the chemistry corner, 2026-10-22, the same test): the District
10:01, the City's stage 1 11:33, Chemistry and Robotics paid in run 3 (10:03, 12:03 in the Act IV
campaign), 128 District groups at most (0.95 ms a tick), rule 1 and 2 at 10.4-10.5 min in three Act
III stretches and **18.8 and 17.3 min from 36:22** in the last (run 6, 6 minutes after its
hand-over: the same early-run wait as before's 20.1, still not looked into). Runs 1 0:00-4:24, 2
4:24-7:26, 3 7:26-16:45 (33 Patents), 4 16:45-25:21 (6), 5 25:21-34:00 (6), 6 34:00-40:00.

Lessons:
- **The waste chute and 1 a trip halve the routes and make distance cost.** With waste going to
  the Dock on its own the bot flies one route a product (a second only for a second product), so
  a District with every lot holds about 140 groups when its 180 routes are taken: the route cap
  (120 and 20 a lot) binds before the 168 tiles, and a lot is bought as either runs out. The placer still stands every copy on the
  free tile nearest what its product feeds, so most routes need one skiff; the far ones (a Motors
  group feeding a Servos group four or five tiles off, 0.33 a skiff against 0.09 wanted) need one
  too, because depth-2 flows are small. Skiffs past one a route come where a consumer is served by
  a feeder placed for another one (three at most on one route); no route was ever left under 90% of its want for
  long, because a skiff (40,000, 3-12 s of the floor's income at 15-30 h) is bought every 5 s
  while one is short. Rule 5's new thinking is where a group stands; the skiff bill is small.
- **The District files Patents through the bills term.** Before, only the Workshop's and the
  Factory's bills counted (§19), so a run after the one that filed Act III's designs previewed
  under 1 Patent on a full District and its Reorganize was refused: the campaign idled 5 h to its
  horizon. A District module now counts as a Factory module does (its stamp bill times its
  measured work): a full District of about 140 groups stands on about 1.4M of bills, about +5
  Patents (log-damped, so a bigger floor never pays in proportion).
- **A full District is a reset moment.** Every Act III run now builds its District out in about
  7 h from its hand-over (a copy every 3 minutes, a lot as the room or the routes run out), resets
  (29 Patents in run 3, then 5-6), and plays Acts I-II again with the head starts (the Charter, District Deeds,
  the Bearing Patent): each run's Act III stretch is goal-dense from its hand-over to its full
  floor, and rule 1's worst wait is the gap between a full floor and the 10-minute reset.
- **No numbers moved.** Every target that this player can reach holds with Act III's data as the
  second gate left it; the open items below are content this player does not build.

**Open** (measured, not yet met, `[pace] OPEN` in the test):
- **Rules 1 and 2 at the start of run 5: 20.1 and 17.3 min from 28:29**, five minutes after its
  Act III hand-over, as the plan opens the District (the cause not looked into yet; the same
  campaign without the route-full rule measured 9.9 at worst, so it looks like the run's path, not
  a wall). The other stretches wait at most 10.4 min, the full floor's 10-minute reset.
- **Chemistry reaches Robotics, not District Folds** (re-measured with the chemistry corner,
  `src/sim/bot3.ts`, DECISIONS.md "The Act III bot's chemistry and the Act IV bot"). The sand was
  never the wall: a Solvent design folds a sand Miner with the Chem Vat. The bot now folds Solvent,
  Rubber and Processors in a powered corner of chunk E (each holding its own solvent vat), nests
  Rubber II and Processors II, and pays Chemistry (10:03), Vulcanizing, Processors, Sensors and
  Robotics (12:03) in run 3. Its Sensors line (chunk D, Chute-fed) starves for rubber: the Rubber II
  group feeding the Chute sends its spare plastic down with the rubber, the plastic stock fills and
  stops it. So no Sensors design, no Sensors II or Arms II, no robot arms, and District Folds (20
  arms, 120 sensors) is out of reach; a chemistry step waiting an hour ends the plan, so the District
  grows and resets as before. Batteries, Hydroponics, Sandwiches, umbrellas and the Engineer are not
  taught (the City's stage 2, the Transmuter and Relocation need them).
- **Act III orders beyond the Servo Ballet.** Spare Parts (600 bearings) needs a bearings source the
  bot can fold: a lone press may not fold, and the Gearboxes line's press feeds its own assembler.
- **Rules 1 and 2 outside Act III**: Act II's Bay-floor wait (39.5 min at 2:48, §16) is unchanged.

## 22. Act IV: Worlds and Relocate (Milestone 9, 40-80 h)

New thinking: **a fold is only as good as the ground it was folded on.** Acts I-III taught one
Workshop; Act IV moves the town to islands whose Workshops have one rule each, so the line that
folds best is a different line on each. Reset layer 2, **Relocate**, banks **Legacy** for what a
world built, and the Legacy tree hands the chores of layer 1 to the town (pillar 2). The plan and
the contract ids: `docs/endgame.md`. Data: `src/data/worlds.ts`, `legacy.ts`, the Act IV blocks
of `items.ts`, `recipes.ts`, `research.ts`, `orders.ts`, `megaprojects.ts`, `floors.ts` and
`rules.ts`. Sim: `src/sim/systems/islands.ts`, `worlds.ts`, `src/sim/relocate.ts`, `legacy.ts`,
and the Legacy automation in `systems/automation.ts`. Tests: `tests/act4.test.ts`.

### The islands
The island the town is on is `meta.world` (absent on older saves: Home). Every island's Workshop
is the same 24x16 of six chunks at the same prices (§9, §18) with the same Workshop deposits;
each adds **one rule**, **one exotic deposit** (2x2, value 4: an ore, a little dearer than coal or
sand because there is one patch of it) and its **tier 4 goods**. The ground is fixed per island
and laid again at each run's start, like the start layout, so a kept design unfolds onto it as it
was folded.

| island | rule | exotic (where) | tier 4 |
|---|---|---|---|
| Home | none | none | none |
| Pebble Isle | chunks C, D, F are **sky** (not land, not for sale); Miners dig **1.5x** | skyglass (9, 5), chunk B | skyglass lens, horizon lens |
| Cinder Isle | **12 vents**: a machine beside one needs **no power**, a Generator or Boiler beside one burns **no fuel**; no belt, splitter, merger or crate stands **beside** one | cinderite (4, 13), chunk C | cinder alloy, sunset dye, Portable Sunset Generator |
| Rime | a powered machine runs at **half speed** unless a **working Boiler, Steam Engine or Generator within 2** tiles (3 with Thermals) or **2 working machines touch** it | rime crystal (11, 13), chunk D | frost alloy, storm cell, Pocket Weather |
| the Old Works | **rubble** on about half the free land, cleared tile by tile (and **stays cleared** on the island); **ruined machines**, repaired for **a quarter** of their price, two of them whole lines | relic (14, 1), chunk B | relic gear |

Why each rule changes what a good fold looks like (the record each island keeps,
`meta.worldRecords`, is beaten by a layout that would not work elsewhere):
- **Pebble.** Half the land and one deposit of each ore, but each deposit feeds half again the
  machines: two Miners fill three Smelters (1.5 x 2 = 3 ore a 2 s, three Smelters' worth), a
  ratio no other island's line has, and the same box folds 1.5x the rate (a tier up sooner,
  §19 Filing). Pebble's chunk-A-and-B Workshop is about the slice's (§9), so Act II's steel waits
  on its one iron deposit unless Sky Moorings (a Legacy node) brings F back.
- **Cinder.** A vent cluster is power-free and belt-free: machines beside a vent feed each other
  face to face (no belt stands there), so the best Cinder fold is a compact cluster with no plant
  in its box (C high, no Generator's coal as an input). Twelve vents, two a chunk, none beside the
  start layout's belts. The rule is "beside": the four tiles on the faces of a footprint, so a
  2x2 machine has eight tiles that can touch a vent.
- **Rime.** Powered machines want company: two working machines touching, or the factory's own
  **power plant**: a working Boiler, Steam Engine or Generator warms every powered machine within
  **2 tiles** (a 5x5, a Pole's reach, §18; `RULES.plantReach`), **3** once Thermals is researched (a
  7x7, `RULES.thermalsReach`). A line laid out for full speed elsewhere runs at half its ratios, so
  a good Rime fold packs its machines together **round its own plant**: the plant goes inside the
  fold box, beside the machines it feeds, instead of off in a corner on a Pole (which carries power,
  not heat). The plant warms only while it works (it has fuel and its grid has demand), so a cold
  line's first craft is slow and its plant warms it from then on. No building exists only to heat:
  heat is the plant's waste, and it costs nothing a line did not already pay for. The plant's
  warmth is read from this tick's power (power runs before the islands' stage) and the machines'
  from the last tick's states (`runIslands`, before the machines run), so a cluster starting cold
  warms itself within a second. (Until the Acts IV-V review a Heater, 3,000 coin, burning coal,
  warmed a 5x5: Factorio Space Age's Aquilo heating towers again. Dropped, DECISIONS.md.)
- **the Old Works.** Rubble on about half the free tiles (a fixed hash of the tile, never on a
  deposit, the start layout or a ruin), cleared for 5 + the chunk's price / 64 a tile (A 5, B
  and C 21, D 193, E 943, F 1,880: half again a chunk's price to clear it all, as the chunk's
  price per tile). A tile cleared **stays clear** on the island: the island keeps the record
  (`meta.cleared`, per island, for the universe), so a Reorganize, or a Relocate away and back,
  lays only the rubble never cleared; a new universe (a Last Fold) lays it all again, and an island
  never cleared has it all. So the 80,632 coin of the island's rubble is paid once a universe, not
  once a run (the review: 146 tiles at every run's start, and an auto-Reorganize stranded the
  Regrader's designs behind it). Clearing is a press on rubble or a **drag** across it: every tile of
  rubble the cursor passes clears, each for its price, until the coin runs out; the tag at the
  cursor counts the tiles and the coin and prices the tile under it. Fourteen ruined machines: eight in two whole lines (iron plates in C, copper
  wire in B, their belts and heaps whole) and six loose, some of them Act II's (a Smelter Mk2, an
  Assembler Mk2). A repair costs `ceil(price x 0.25)` and needs **no research** for the machine (it keeps its
  recipe), so the island's first hour can fold lines the others have not reached; a big ruin still
  needs a grid. A ruin takes nothing, makes nothing, draws nothing, can't be in a fold box and is
  removed for no refund.

Island research (`world` on the node) is offered only on its island: Thermals on Rime, each
island's own chain on it. The rules are read by the systems through `islands.ts` helpers, as
Challenges are (`islandMiners`, `coldFactor`, `g.vented`, `islandTileRefusal`), and they run the
same in offline replay (the same `tick`).

### Tier 4: the islands' goods
Values are **3-4x their inputs** (tier 3 was about 3x, §21), so an island's goods are what its
World floor sells, and every tier 4 good sells only where its island's research is (the research is
reset by every Reorganize and is offered only there).

| good | recipe (machine, seconds) | value | x inputs |
|---|---|---|---|
| skyglass lens | 2 skyglass + glass (Kiln, 3) | 70 | 3.5 |
| horizon lens | 2 lenses + sensor (Assembler, 8) | 4,000 | 3.5 |
| cinder alloy | cinderite + steel, slag 1 per 2 (Smelter, 3) | 90 | 3.5 |
| sunset dye | 2 cinderite + solvent (Chem Vat, 3) | 130 | 3.4 |
| Portable Sunset Generator | 4 dye + an Autonomous Sandwich Engineer + 2 cinder alloy (Assembler Mk2, 30) | 300,000 | 3.3 |
| frost alloy | rime crystal + steel + solvent (Chem Vat, 4) | 200 | 3.6 |
| storm cell | frost alloy + battery (Chem Vat, 6) | 1,500 | 3.4 |
| Pocket Weather | 2 storm cells + weather balloon + umbrella (Assembler Mk2, 24) | 64,000 | 3.3 |
| relic gear | relic + 2 gears + bearing (Assembler, 4) | 220 | 3.4 |
| Lighthouse lamp, anchor chain | parts for Megaprojects #4 and #5 (sell for nothing) | 0 | - |

### Research, page 4
Fourteen nodes, `act: 4`, after the Great Drill's stage 3 like Act III's. **Charting** (30 robot
arms, 150 sensors, 60 processors after District Folds: 20-30 min of the District that researched
District Folds) opens the World floor. Each island has its chain, paid in its exotic (600 of it,
about 13 min of one Pebble Miner, 20 of a Home one): Skyglass Cutting and Horizon Optics on
Pebble; Cinder Smelting, Sunset Dyes and Sunset Engineering on Cinder; Thermals (500 coal, 150
steel, with Act II's first powered machines: the plant's warmth reaches 3 tiles, was 2),
Frost Works, Storm Cells and Pocket Weather on Rime; Relic Study on the Old Works. The Lighthouse,
the Sky Anchor and **Relocation** (3 Sandwich Engineers and 20 umbrellas: the end of Act III's
chain) open with Charting on any island.

### The World floor
- The fourth floor (research Charting), **16x12** (192 tiles, 1.6x the District's 120) with three
  lots of 2x12 at **10M x n** (linear: 10-20 min of the 0.5-1M a minute an Act IV floor makes) and
  a fourth kept for good by the Lighthouse's stage 3. Dock, Hopper and Bay as on the District.
- It takes **depth-3 modules only** (the District's folds). The District takes depth 2 and its own
  depth 3 (the second gate); the World does **not** take its own depth-4 folds: a fold on the World
  is the Last Fold, Act V's (`hfoldRefusal` asks for research `lastFold`). Decided so that a World
  module is always a District group of groups, and the floor stays a floor of composition, not the
  next stack of the same.
- **Barges, ship value not bulk** (the second gate's principle for the District's skiffs, §21):
  **3 tiles/s, 2 a trip, 1.5 s** at the ends. Beside its consumer a barge moves **0.92 a second**,
  five tiles off **0.41**, across the floor with its lots **0.16**. Depth-3 flows are 0.02-0.3 a
  second for finished goods (an Engineer group, a Robot Arm group) and 0.5-1 for an island's bulk
  (alloys, lenses), so bulk stands beside what it feeds and finished goods fly anywhere. A barge
  is **250,000** (flat; 15-30 s of an Act IV floor's income), 12 at most a route.
- The rest is the District's: 120 routes and 20 a lot, waste with no route down the chute to the
  Dock, Overdrive by click, the Dispatcher, pause (a module, or every module joined to it by
  routes: `{ k: 'pause', floor: 'world', ... }`), offline tallies (`wdock`, `wbay`).

### Filing a deeper fold (the second gate)
A depth-3 fold files **one step more** than the steps its box holds (`designValue`: steps +
(depth - 2) x `highFoldSteps`), since its routes are logistics folded away as a nested fold's
trunks are (§18). So a District fold of a chain is worth more than the Factory's nested fold of the
same chain, the Patent preview grows with Act III's folds, and the World's bests count a step
deeper again for Legacy.

### Megaprojects #4 and #5
Built at the **World Bay**, four stages each, **one stage on each island**, in **any order**: the
Bay builds the stage of the island the town is on (`megaStageOf`). Each stage wants 150 of the
project's part (a Lamp or a Chain: a group at 0.1-0.2 a second, 15-25 min) and one island's good
(about 40 min of its group). Progress is kept through every reset; a stage left half built waits
on its island (`held`) and comes back when the town does. Each stage is worth 10 Patents to the
run that finishes it and 3 Legacy to the world. Rewards are rules, kept for good:

| | Pebble | Cinder | Rime | the Old Works |
|---|---|---|---|---|
| **the Lighthouse** (lamp 150 +) | horizon lens 200: barges **4 tiles/s** | sunset dye 800: skiffs and barges **dwell half** | storm cell 300: the World's **first lot for good** | relic gear 800: a route counts **at most 6 tiles** |
| **the Sky Anchor** (chain 150 +) | lens 1,200: the **annex kept** through a Reorganize | cinder alloy 1,200: **District lots kept** | frost alloy 800: **World lots kept** | relic gear 800: annex and lots kept through a **Relocate** too |

The Anchor is §19's open lever for rule 3 (room kept through a reset) and the Lighthouse the
high floors' logistics answer; neither is a multiplier on income.

### Relocate (layer 2)
`{ k: 'relocate', world }`, from a card that says what it gives, keeps and loses (pillar 4).
**Allowed** once research Relocation is done and the World floor has stood in this world, to an
island other than this one, with no audit running, when the preview is at least 1 Legacy.

- **Kept:** Legacy and the Legacy tree; every Megaproject's stages and progress; reputation; the
  Codex and Field Notes; the Patent Drawer; trophies, lifetime statistics, Challenges won; the
  worlds' records. (A Last Fold keeps the tree's Automation branch for good too, §23.)
- **Lost:** everything a Reorganize loses (§19), and the **Patents** (unspent and the tree: Old
  Habits keeps the nodes chosen), the **record on file** (every product files again on the new
  island), and the room the Sky Anchor kept through Reorganizes (until its last stage).

**Legacy**, banked at the move:

    Legacy = floor( (sum over the Workshop, Factory, District and World of
                     the best value folded there this world) / 4
                    + 3 x Megaproject stages counted
                    + 5 for an island not visited before )

    World's term = (sum over the distinct designs at work on the World, by product and
                    depth, of each one's best value) / 4          (RULES.legacyWorldDesigns)

    stages counted = the stages done this world
                   + at the first Relocate of a universe from an island, the stages that
                     stood on it when the universe began                    (meta.inherited)

A floor's best value is its best design's steps x grade x rate tier, as filing (§19): the
Workshop's best depth-1 fold, the Factory's best nested fold, the District's best fold of groups.
The World's is not its best module (that was the District's best counted again, the Acts IV-V
review): it is the **summed value of the distinct designs put to work** there (60 s straight at
half speed or better: placing one is not enough), each product and depth once at its best, **over
4**. A copy adds nothing to Legacy (copies are what the Last Fold's Kernels count, at a quarter,
§23). "This world" is since the last Relocate: its bests are kept through its Reorganizes
(`meta.here`), so Legacy is the whole world's, not the last run's. No coin, no root of a currency,
no log: it counts the best of what was folded on each floor, what was built, and where the town has
been.

**Stages count once a universe.** A Megaproject is kept through every reset, the Last Fold too, so
in universe 2 every stage already stands and none is "done this world": a Relocate there paid only
its folds and the island, about 14 (the review). The Last Fold hands the next universe the stages
standing, by the island whose Relocate banks them (`stagesStanding`: the Great Drill's, the City's
and the Transmuter's are Home's, where every universe begins; each stage of #4 and #5 its own
island's), and the first Relocate from each island in that universe counts its share, then forgets
it. So universe 2's Relocates pay what universe 1's did, island by island: 21 for Home's seven at
the first, 6 for an island's two at its first visit, nothing twice.

The numbers: a world built to its World floor holds about 30-40 of value (four floors at 7-10:
steps x grade x tier) and so **8-10 Legacy from its folds**. The World's 7-10 is its kinds: a
well-built World runs **4-5 kinds** of District group (an Engineer group, a Robot Arm group, the
island's two or three tier 4 goods, the Lamp or the Chain) at 7-10 each, 30-45, over 4 is 7.5-11;
one kind alone is 2. The first Relocate (from Home, about 40-45 h, the World just open with 2-3
kinds: its term 4-6) banks folds 7-9, the Home world's seven stages (the Great Drill's three, the
City's and the Transmuter's two each: 21) and 5 for a new island: **about 33-35**, a third of the
tree. A first visit to each island: folds 8-12, two stages (one of each project) 6, the new island
5: **about 20**. A revisit: **8-18**. The tree is 103 Legacy, so it is bought out after the four
islands (35 + 3 x 20 = 95) and a revisit, about 75-80 h. **Each later universe's first Relocate is
the same 33-35** (Home's seven stages inherited, the islands unvisited again; with Kept Islands its
folds count the records from the first run), and its island visits the same 20; but a universe
after the first owns the Automation branch already (56 of the 103), so its Legacy buys the 47 of
head starts and softeners and has room to spare. Divisor, stage, World and island weights:
`RULES.legacy*`.

### The Legacy tree
Seventeen nodes in three branches, **flat prices** with prerequisites (no geometric curve, no
"+X% everything", PLAN.md); 103 Legacy in all. Pillar 2: Legacy automates layer 1. Pillar 1:
every node changes how the next world plays (the gate: reset 3 felt like reset 1, a Patent preview
of about 0 at 30-40 h).

| node | Legacy | needs | effect |
|---|---|---|---|
| the Patent Purse | 4 | - | every island starts with 10 Patents (most of §19's head starts) |
| Old Habits | 5 | - | keep 4 Patent nodes you choose through a Relocate (`{ k: 'habit', id }`) |
| Second Nature | 7 | Old Habits | keep 12 (a third of the Patent tree) |
| the Town Archive | 8 | the Purse | every run starts knowing Act I's research |
| Standing Charts | 7 | the Archive | once the World floor stood in this world, later runs here know Charting |
| the Patent Clerk | 6 | - | buys open Patent nodes in the tree's order as Patents allow, every 5 s |
| the Standing Committee | 10 | the Clerk | Reorganizes by itself when the preview reaches the number set (`{ k: 'standing', at }`; never in a Challenge, waits for audits; **never while away**, the tab hidden or the game closed: the offline report says when it would have, and it fires at its next check once you are back) |
| the Regrader | 9 | - | kept designs unfold, audit and fold by themselves at a run's start (the 10 s refold check when the layout suits the island) |
| the Town Plan | 9 | the Regrader | keep 2 town layouts (`keepPlan`, `forgetPlan`): the District and every high floor standing (the World, Beyond), each tile and route by floor; each run places them again from spare copies of the best design of each tile's product and depth, routes and skiffs (or barges) paid, on every high floor that stands |
| Contract Runners | 7 | - | every order on offer fills from every Dock at once |
| the Skiff Guild | 5 | - | a route starts with a second skiff or barge, free, that stays with it |
| A Longer Drawer | 4 | - | the Patent Drawer holds 4 more |
| the Group Drawer | 6 | the Longer Drawer | the Drawer keeps nested Factory designs as their group's layout; they unfold from spare copies of this run's designs |
| Sky Moorings | 4 | - | Pebble's chunk F is land again |
| Heat Shields | 4 | - | on Cinder crates, splitters and mergers stand beside a vent (belts still melt) |
| Warm Hands | 4 | - | on Rime one working machine touching is warmth enough |
| Salvage Crews | 4 | - | on the Old Works ruins repair for nothing and clear the rubble around them |

The automation runs in the automation stage (right after the input commands), every 5 s (10 s
for the Committee), never as a logged command, so a replay does the same. **The Automation branch
(the eight nodes from the Clerk to the Group Drawer) is kept through every Last Fold for good**
(pillar 2: what was automated stays automated; the Acts IV-V review found the Clerk, the Committee,
the Regrader, the Town Plan and the Runners all back to manual in universe 2), with the Committee's
number and the Town Plan's layouts. The head starts and the softeners go, but those Kept Legacy
keeps (§23), and the Town Archive, which the Seed keeps (it knows Acts I-II's research).

### Orders and reputation, Act IV
Eight orders, two a customer, each wanting one island's goods at about **2.1x** their Dock value
(as Act III's, §21), so each island has two customers' orders. Rep thresholds, the existing four
customers (no new customer):
- **Bramble 5, Harbour Rights:** each island's exotic deposit holds 2 claims more (a deposit's
  own 2, §18, again).
- **Unit 7 5, Field Notes:** an island's exotic and tier 4 goods pay the Codex's 30x again on each
  island they are first delivered on (`meta.fieldNotes`).
- **Voltaire 5, High-Tension Lines:** Poles join at 8 tiles, was 6.
- **the Committee 7, Rubble Rousers:** on the Old Works a tile cleared clears the rubble touching
  it.

### Offline and saves
Island rules and the World floor run in offline replay through the same `tick`; the extrapolated
part uses the replay's measured rates (rules included), with the World's Dock and Bay tallied apart
(`wdock`, `wbay`) and Megaprojects #4 and #5 filled through `megaStageOf`. `SAVE_VERSION` 9: an
older save is on Home with no Legacy, no node, Home the only island visited, this world begun at
the save's first run. `SAVE_VERSION` 12 (the islands and the chores, after the review): every
Heater standing is lifted and refunded its 3,000 (none for a free one), Heaters leave the designs,
the Drawer and the command log, and the rubble already cleared on the Old Works is the island's
record (`meta.cleared`). The determinism fingerprint covers the island, the rubble, the record,
the cold machines and the Town Plan's layouts.

### Pacing targets (§16)
- **Relocate first at 40-45 h**, when the World floor stands and Relocation is researched.
- **Four islands by 60 h** (Home and three more): each island's climb back to its World floor in
  **6-8 h**, faster than Home's 40 because Megaprojects, reputation, the Drawer and the Codex are
  kept and the tree takes the chores (the Purse and the Archive skip Act I, the Clerk spends, the
  Regrader refolds, the Town Plan rebuilds the District, the Committee resets).
- **The island rules hold to 80 h:** every rule has a softener in the tree, but none removes its
  rule (Pebble keeps C and D as sky, Cinder's belts still melt, Rime's lone machine still wants its
  plant beside it, the Old Works' ruins still want repairing and its rubble is paid once a
  universe); a run on a fifth visit still plays differently from Home.
- **Measured below** (the Act IV bot): the campaign does not reach the World yet.
### Pacing (measured, the Act IV bot)
Measured by the campaign bot with the Act IV policy (`src/sim/bot4.ts` over `src/sim/bot3.ts`,
`tests/pace-act4.test.ts`, seed 1000, `FOLD_ACT4_HOURS` = 40 h of play, 25 min of wall time; 80 h
did not fit the time box). The Act IV policy is written and wired (research page 4, the World by
the District's rules, Relocate when the preview pays, Legacy in a priority, the Old Works' rubble),
but the campaign never reaches it: Charting wants District Folds, which wants robot arms and
sensors the Act III bot cannot yet make (§21 Pacing, Open).

| Measure | Target | Measured (seed 1000, 40 h) |
|---|---|---|
| District open | about 11 h | 10:01 (run 3) |
| Chemistry, Robotics | (Act III) | 10:03, 12:03 (run 3) |
| District Folds, Charting, the World | before the first Relocate | **never** (open) |
| First Relocate | 40-45 h | **none** (open: no World, and Relocation wants 3 Engineers and 20 umbrellas) |
| Four islands | by 60 h | **Home only** (open) |
| Megaproject stages | | the City's stage 1 at 11:41; no Act IV stage |
| Legacy | the tree by 75-80 h | none banked |
| Rule 1 per Act III stretch | 10 min | 10.4, 10.7, 10.4, 7.3 min (each the full-floor reset's 10-minute wait) |
| Rule 2 per Act III stretch | 15 min | 10.4, 10.7, 10.4, 6.5 min |
| Tick, the biggest floor | under 4 ms | 0.93 ms (a District of 130 groups; no World stood) |

The runs: 1 0:00-4:24 (14 Patents), 2 4:24-7:26 (7), 3 7:26-16:36 (33, Act III from 9:53), 4
16:36-25:37 (6, from 18:51), 5 25:37-34:36 (6, from 27:48), 6 34:36-40:00 (from 36:49). No number
moved: every Act IV target is unmeasured for want of the Act III chain, not shown wrong.

**Open** (`[pace4] OPEN` in the test): the Sensors line's rubber (then Arms, District Folds,
Charting), the Act IV targets above, and the islands' layouts (the Act I-II bots lay Home's
lines; Pebble's sky chunks, Cinder's vents and the Old Works' ruins will refuse some of them).

### Derivative, flagged and re-derived (CLAUDE.md)
- **A prestige tree of automation bought with the second reset's currency** resembles Antimatter
  Dimensions' Eternity upgrades and its autobuyers (auto-Crunch at a number: the Standing
  Committee). Re-derived from the game's own chores: each node takes one action the player did in
  Acts I-III (spending Patents, choosing when to Reorganize, refolding a kept design, placing the
  District, filling orders, buying skiffs), flat prices with prerequisites, and no multiplier.
- **Islands with one rule each** resemble Factorio: Space Age's planets. Re-derived from the fold:
  each rule changes which layout folds best (ratio, power, adjacency, land), the record is per
  island and per floor, and there is no travel, no logistics between islands, no new science.
- **Rime's Heater was Space Age's Aquilo** (machines freeze unless heated; heating towers burn
  fuel and warm a radius), missed by the first flags and found by the Acts IV-V review. Re-derived:
  no heating building; warmth is company (two working machines touching) and the waste heat of the
  plant the line already runs on, so Rime's lesson is "fold the plant into the line", a layout
  rule of this game's fold box, not a heating network to fuel and lay out.
- **Megaprojects in any order across islands** are this game's own Megaprojects (§18, §21) spread
  over islands; the reward table is rules, not output.
- **Rubble cleared tile by tile** resembles any land-clearing tycoon; it is priced from the chunk
  (§9), so it is the chunk's price again, not a new curve.

## 23. Act V: Beyond and the Last Fold (Milestone 10, 80-100+ h)

New thinking: **bending the rules.** Acts I-IV taught the rules a layout is built under (a belt's
120 a minute, a module's back and front, an 8x8 box, four floors, one recipe a product, the night's
0.75). Act V folds the whole World into one tile and spends what it was worth on **changing those
rules**, so every line the player knows is drawn again in the next universe. Reset layer 3, **the
Last Fold**, banks **Kernels**; the Kernel tree buys base-rule changes; **Beyond**, the fifth floor,
takes the World's own folds; **tier 5** is what the islands make for it; the **Endless Ledger** keeps a
next goal forever. The plan and the contract ids: `docs/endgame.md` (Milestone 10). Data:
`src/data/kernels.ts` (the tree, the Ledger, the grade bonus), the Act V blocks of `items.ts`,
`recipes.ts`, `research.ts`, `floors.ts`, `machines.ts` and `rules.ts`. Sim: `src/sim/lastfold.ts`,
`src/sim/kernels.ts`, `src/sim/systems/seed.ts`, `src/sim/systems/ledger.ts`, and the Act V parts of
`systems/high.ts`, `belts.ts`, `modules.ts`, `transfer.ts`, `offline.ts`. Tests: `tests/act5.test.ts`.

### The Last Fold (layer 3)
- **Research The Last Fold** (`lastFold`, Act V page, `act: 5`) is offered once **every stage of the
  Lighthouse and the Sky Anchor** stands (the research's `megas`; both are built across the four islands,
  done by about 75-80 h, §22) and Charting is known. It costs 6 Engineers, 60 robot arms and 40
  umbrellas: what every island's World floor makes, about 1-1.5 h of an Act IV floor's Engineer and Arm
  groups. So the Last Fold is **available at about 80 h** (§16). It also opens depth-4 folds on the
  World (once Beyond stands: a World group has nowhere to go before).
- **The whole-World audit** (`{ k: 'lastFoldAudit' }`): every module on the World at once, the
  high-floor audit (§21) over the whole floor (`haudit.last`): the warm-up and window of every audit
  (§10, 10 + 60 s), the World locked while it runs. Inside is "a module"; what reaches the Dock, Hopper
  or Bay is the World's output; byproducts down the waste chute count as handled. U, W and C as a fold's
  (§10); **C counts the floor's free tiles** (less the Dock, Hopper and Bay), so a full World grades
  better. Its card offers the reset (`{ k: 'lastFold' }`), or `hauditCancel`. A plain `hfold` refuses it.
- **Kernels**, banked at the fold (`previewKernels`, the card's lines and goals):

      Kernels = floor( value / 10 ) + the grade bonus (S+ 5, S 4, A 3, B 2, C 1, D 0)

      value = sum over each kind (product and depth) at work of
                its best module's value + 1/4 x each further copy's value   (RULES.kernelCopyShare)

  A module's value is steps folded x grade x rate tier, as filing (§19); it is **at work** on the World
  when the audit found it at half speed or better, on Beyond when it has run 60 s straight at half
  speed or better (`legacyRunSeconds`, §22). A depth-4 module counts the World group folded into it
  (`lastFoldValue`: the sum of its parts), so folding a group up to Beyond never loses Kernels. Before
  the audit the preview counts modules by their 60 s and no grade. **A copy counts a quarter** (the
  Acts IV-V review: summing every module made 100 minimal Engineer chains 100 Kernels, twice the
  51-Kernel tree): a stamp still pays (growth by stamps, PLAN.md), but a new kind of group pays four
  times a copy of one already there, so the World is filled with different lines, not one line a
  hundred times. 100 copies of an Engineer chain (10) are now 10 + 99 x 2.5 = 257, **25 Kernels**,
  half the tree. (The critic's other rule, value x min(1, scale / tierStep), was not taken: it
  discounts small lines, not copies, and the rate tier already pays scale.)
- **The numbers.** A depth-3 group is worth 6-9 (a Robot Arm group fed steel: 4 steps + 1 for its
  depth x S 1.25 = 6.25; a whole Engineer chain, 7 + 1 at S, 10: §22's "7-10"). A World of 25 groups at
  about 8 runs about **7 kinds** (the Engineer, Arm, Servo and Sensor groups, the last island's two
  tier 4 goods, the Lamp or the Chain): 7 x 8 = 56 in full and 18 copies x 2 = 36, **92 of value, 9
  Kernels**, and a B adds 2: **about 11 at the first Last Fold** (was 22 under the old sum: that
  number no longer holds). It buys **two nodes**: the Ledger and Beyond (10), so the first universe's
  reward is the fifth floor and a next goal forever; Wide Belts waits for the second. The 51-Kernel tree
  lasts to about the fourth Last Fold, which eases the review's kept-open item (nothing to buy after
  the third). The bonus is one Kernel a letter: a grade, not a multiplier, so a bigger World always
  counts for more than a better-graded small one, and filling the World (C) is what raises the grade.
  No coin, no root, no log of a currency: §15's sketch ("log10 of the World's output value") is
  replaced, as Patents and Legacy count folds, never coin.
- **What raises it** on the card is the audit's own advice, weakest part first (`advice[0]`: "21 of
  190 tiles are modules", "Robot Arm II ran 40% (starved of steel)"), not "run the World better"
  (the review: it said so with C at 11%); then each idle module (a copy at a quarter) and a new kind of
  group (about +0.8).
- **Kept:** Kernels and the Kernel tree; every Megaproject (so the next universe's Last Fold research
  is open as soon as Charting is), and its stages standing count for Legacy once more, at the first
  Relocate from their island (§22); reputation, the Codex and Field Notes, trophies, the counters and
  lifetime statistics, the run history; the Patent Drawer; Challenges won; the Night Shift; the Endless
  Ledger and its cosmetics; **the Legacy tree's Automation branch** for good, with the Committee's
  number and the Town Plan's layouts (§22, the review); **Acts I-II's research** in every run (the
  Seed's head start, below), and so the Town Archive. With **Kept Islands** the worlds' records, with
  **Kept Legacy** up to four chosen head starts or softeners (`{ k: 'keepLegacy', id }`; an Automation
  node or the Archive is refused: kept already).
- **Lost:** everything a Relocate loses (§22: every floor, coin, items, land, Act III's research on,
  designs, claims, Patents and the Patent tree, the record on file, the room the Sky Anchor kept), plus
  **Legacy** (unspent, and the head starts and softeners not kept), **the worlds' records** and **the
  islands visited** (each is new again: +5 Legacy each, §22).
- **The Seed's head start** (`RULES.seedActs`, `applyHeadStarts`): every run of a universe after the
  first knows **Acts I-II's 26 research nodes** (the Archive's ten and the Factory's sixteen, to the
  Great Drill's). The review: universe 2 replayed Acts I-II's research on every island with every
  Megaproject done, so its Acts II-III had no spine and Beyond opened at about 105-115 h. Act III's
  chemistry and the District are still researched in every run, so a run still climbs; what goes is
  the first 4-5 h of research a first universe needed, which the Purse's ten Patents only half bought
  back. The model (not measured: no Act V bot): an island's climb to its World 1-2 h shorter, the second
  universe's World at about 20-30 h, not 25-35.
- **The new universe starts on Home** (decided): the Seed is planted where the town began, on the
  island with no rule, so the new base rules are met on plain ground first; and every island is a first
  visit again. The Seed's card (`meta.seeds`: universe, grade, value, Kernels, modules, the top product,
  the island folded on) is kept for good.
- **The Seed** (kind `seed`, 1x1, at (4, 6) in chunk A, not removable, in every run's start layout once
  a Last Fold is taken): every **4 s** it digs one of each raw ore out of its four sides, **iron out of
  the side it faces, then copper, coal and sand clockwise**, each handed to whatever takes it there (a
  belt, a machine, the Dock) and held while that side refuses. 15 a minute each, half a Miner (§4): a
  little of each, so the new universe's chunk A has copper, coal and sand before chunk B or E (Copper
  Smelting's 80 ore from the Seed alone), and Miners are still the supply. Rotating it turns which side
  gets which ore. It never goes in a fold box (it makes ore out of nothing, as a Chute Mouth, §21); its
  pip is working while any side takes its ore, blocked when all four hold one, and `why` names the first
  ore waiting. The Old Works' rubble never lies on its tile.

### The Kernel tree
Ten nodes in three branches, **flat prices**, one prerequisite; 51 Kernels in all. Every node is a
rule the universe is built under; none is "+X% everything" (PLAN.md). Read through `krules`.

| node | Kernels | needs | the rule |
|---|---|---|---|
| Wide Belts | 8 | - | a belt tile carries **2 items**, at least half a tile apart: **240 a minute** (§4's 120): a Miner line feeds a Mk2 from one belt and a box holds half the belts it did |
| Every Side a Port | 6 | - | a Factory module takes in from a trunk on **any side** and gives out of **any side** a trunk leads away from (all its outputs, as the front): modules pack face to face in a nested box |
| the Bigger Box | 5 | - | the Workshop fold box is **12x12** (a chunk and a half: a tier 3 line with its feeds and its plant), under the Drawer's 16x16 share string |
| the Second Cookbook | 6 | - | five **alternate recipes** (below) |
| Beyond | 8 | - | the **fifth floor** (with research The Last Fold in the run) and the islands' tier 5 research |
| the Endless Ledger | 2 | - | **infinite orders** (below); the cheapest node, so the first Last Fold always buys it |
| Seedling | 3 | - | the Seed digs every **2 s** a side (a Miner's pace) |
| Long Nights | 3 | - | the offline ceiling **0.85** (was 0.75, §20) and **+0.1** toward it: a closed game still pays less than open idle (§16 rule 4) |
| Kept Islands | 4 | - | the worlds' records survive a Last Fold, and an island's record stands as a floor's best of a world begun there (its Legacy counts from the first visit, about 8-10 a world, §22) |
| Kept Legacy | 6 | Kept Islands | keep **4** head starts or softeners you choose through a Last Fold (as Old Habits keeps four Patent nodes through a Relocate); the Automation branch is kept anyway, the Archive by the Seed |

The first Last Fold's ~11 buys the Ledger and Beyond (10); the second (about 105-110 h, a universe
rebuilt with its Megaprojects, reputation, Drawer, Codex, Automation and Acts I-II's research kept,
and Beyond's depth-4 modules counting their parts) about 15-20, Wide Belts and two more; the tree is
bought out at about the fourth.

### The Second Cookbook
Learned with the Kernel and the research of the product (`alt` on the recipe; `recipeKnown`). Each is
a different **shape** of line for a product already made, never counted for chain steps (filing is the
same in every universe: `chainSteps` and `designScale` skip them).

| recipe | machine | in -> out | time | the shape it changes |
|---|---|---|---|---|
| Steel from ore | Smelter | 2 iron ore + coal -> steel, a slag every craft | 4 s | no ingot step; twice steel's slag to route |
| Glass from slag | Kiln | 2 slag + sand -> glass | 2.5 s | a steel line's slag feeds its own Kiln: zero waste without a Press |
| Circuit on a brick | Assembler | 4 wire + 2 slag bricks -> circuit | 6 s | no plastic, no glass: no Refinery or Kiln in the box |
| Plastic from oil | Refinery | 3 oil -> plastic | 4 s | a Refinery's oil feeds a second: no oil out of the box |
| Cast gearbox | Assembler | 3 steel + 2 gears -> gearbox | 8 s | no bearings: no bearing Press |

### Beyond (the fifth floor)
- `HIGH.beyond`: research The Last Fold **and** the Kernel node Beyond. **14x10** of **depth-4 modules
  only** (140 tiles: a module is a World group of 2-6 groups), two lots of 2x10 at **100M x n** (linear:
  10-50 min of the 2-10M a minute an Act V floor makes), Dock and Hopper on the east edge, a Bay
  position at the south-west (no project builds there: below). **Nothing folds on Beyond**: the top of
  the world (the whole World's fold is the Last Fold).
- **Couriers, ship value not bulk** (the second gate's principle a third time): **4 tiles/s, 1 a trip,
  2 s** at the ends: beside its consumer **0.4 a second**, five tiles off 0.22, across the floor with
  its lots 0.09, against depth-4 flows of 0.005-0.05 a second for tier 5 goods and 0.1-0.5 for the tier 4
  bulk between groups. Tier 4 stands beside what it feeds; tier 5 flies anywhere on one courier. A
  courier is **2,500,000** (flat: 15-75 s of an Act V floor's income), 12 at most a route. The
  Lighthouse's Beacon (dwell half) and Light (6 tiles) reach Beyond; its Lens Room (speed) is the
  World's barges' only. The rest is the District's (routes, the waste chute, Overdrive, pause, the
  Dispatcher).
- **Depth-4 folds** happen on the World (research The Last Fold, Beyond open): a World group folds as a
  District group does (§21), one step more again for filing (`highFoldSteps`, §22).

### Tier 5: the impossible inventions
`ITEM_IDS` after tier 4, in the contract's order. Each is made on **one island** from its tier 4 goods,
Assembler Mk2 only, at **3.4-3.5x its inputs** (§18's rule), taught by that island's Act V research
(each offered only there, with the Kernel Beyond, after the island's deep node and The Last Fold; paid
in the island's deep good, 20-40 min of its group). The lines are designed on the Workshop with Chute
Mouths as tier 3 and 4 are (§21), folded up the floors, and sold at Beyond's Dock.

| good | island | recipe (Mk2, base seconds) | value |
|---|---|---|---|
| a Map of Everywhere | Pebble | 4 horizon lenses + 2 processors (30) | 70,000 |
| the Infinite Staircase | Pebble | 20 skyglass lenses + 4 servos + 10 steel (24) | 56,000 |
| a Very Small Sun | Cinder | a Sunset Generator + 6 cinder alloy + 4 dye (60) | 1,050,000 |
| Bottled Tuesday | Rime | Pocket Weather + 4 storm cells + a processor (40) | 250,000 |
| the Everlasting Sandwich | Rime | an Engineer + 10 sandwiches + 4 frost alloy (40) | 320,000 |
| the Quiet Engine | the Old Works | 8 relic gears + 2 servos + 2 gearboxes (20) | 34,000 |
| the Pocket Island | the Old Works | 20 relic gears + a robot arm + 10 fertilizer (40) | 100,000 |
| **the Folded Universe Replica** | every island, its own way | Pebble 12 maps + 4 staircases; Cinder a Sun + 2 processors; Rime 3 Tuesdays + a Sandwich; the Old Works 8 Islands + 8 Engines (120) | 3,600,000 |

Research (Act V page): **Cartography of Everywhere** (Pebble: 100 horizon lenses, 100 processors),
**Star Forging** (Cinder: 4 Sunset Generators, 400 cinder alloy), **Weather Bottling** (Rime: 6 Pocket
Weathers, 100 storm cells), **Relic Engines** (the Old Works: 600 relic gears, 60 servos).

### The Endless Ledger (infinite orders)
With its Kernel node, order **n** (from 0) wants **(n + 1) x the base** of the n-th product in turn:
Gizmos 300, steel 600, circuits 200, motors 60, sensors 40, servos 20, robot arms 6, Engineers 2 (each
base 10-20 min of one module of it). **Linear** (no curve: CLAUDE.md), **never timed** (pillar 4), from
**any Dock** (after the special orders, before the sale: `fillOrder`), completed with the orders
(`runOrders`), so offline fills it through the same code. It pays **twice its items' Dock value** (the
special orders' 2.1x, §18: it takes what would have sold, so one value back and one more), and **every
tenth order a cosmetic**: the skins `gilded` (Miners), `candy` (Presses), `starlit` (Assemblers), then
numbered ribbons (`ribbon4`, `ribbon5`...), so there is always a next one (`meta.cosmetics`). Its count
and progress are kept through every reset.

**The turn takes the late goods** (the review of 2026-10-22: "it asks only for Act I-III goods; order 24
pays 8.64M at 117M/min, about 4 s of income"). After the eight comes every good of `LEDGER_LATE` the
Codex holds **and the town can make where it is**: processors, clockwork frogs and umbrellas anywhere;
an island's tier 4 and tier 5 goods only on that island (its research is offered only there, §22); the
Replica on any island but Home. So the turn is a pure function of the Codex and the island
(`ledgerTurn`), deterministic, and the Ledger never waits on a Relocate. Each late good's base is 10-20
min of one group of it, as the eight's (skyglass lenses and cinder alloy 600, frost alloy and relic gears
400, processors, horizon lenses and storm cells 60, clockwork frogs 40, Quiet Engines 20, Staircases 15,
Maps 12, umbrellas 10, Pocket Islands 8, Pocket Weathers and Bottled Tuesdays 6, Everlasting Sandwiches
4, Sunset Generators and Very Small Suns 2, the Replica 1). The open order's product is **fixed when it
opens** (`meta.ledger.item`, written by the sim in `runLedger`, never by a screen), so a good logged
mid-order never changes it; after a Relocate to where it can't be made, the order becomes the eight's
product for its number. A late order pays what its goods are worth: order 30 on Pebble Isle wants 342
Maps of Everywhere and pays 47.8M; a Replica at order 32 pays 223M (a minute or two of an Act V floor,
against the eight's seconds).

**Every tenth order pays more than a cosmetic**, to the 120th (`LEDGER_REWARDS`): orders 10, 30, 50, 70,
90 and 110 open a **lore page** (the Ledger's six folios, `CODEX_PAGES` group `ledger`, in Unit 7's voice:
it reads the Committee's ledger over a shoulder, finds the warehouse, finds Unit 6's first order), and
orders 20, 40, 60, 80, 100 and 120 pay a **rule** of Acts IV-V's own kinds (§24): barges +0.25 tiles/s
(20, 100), couriers 0.2 s quicker at the ends (40, 120), World and Beyond lots 5% cheaper (60), Ledger
orders 5% less (80). The rules sum with the shelf's under the same caps. After the 120th the ribbons go
on alone. Still linear (an order wants (n + 1) x its base, less the `ledger` share, rounded up) and never
timed.

### Offline and saves
Beyond runs in offline replay through the same `tick`; its Dock and Bay are tallied apart (`bdock`,
`bbay`) like the World's, and the extrapolated part pays their measured rates at the offline efficiency
through `fillOrder` (the Ledger included). The Seed and wide belts run in the replay as they do live.
`SAVE_VERSION` 10: an older save has no Kernel, no node, no Last Fold (no Seed: the first universe), no
Legacy node kept, the Ledger at its first order and no cosmetic. The determinism test replays a
whole-World audit, a Last Fold and Kernel nodes from the command log.

### Pacing targets (§16)
- **The Last Fold available at about 80 h**: the Lighthouse and the Sky Anchor done on the fourth
  island (75-80 h, §22), then its research (1-1.5 h).
- **The first Kernel spend at about 85-100 h**: the fold is worth 0.1 Kernel a unit of value standing,
  so a player fills the World (each new kind of group about +0.8, a copy +0.2, the grade +1 a letter)
  before folding; the spend follows the fold at once.
- **A next goal forever**: the Ledger's open order (10-20 min of one line at first), a cosmetic every
  tenth, tier 5 research on each island, Beyond's lots, and the tree's next node. **Open:** at a fixed
  factory the Ledger's wait grows linearly (order n wants n + 1 bases); it stays inside §16 rule 1's hour
  idle only while the factory grows with it (stamps, Beyond's modules). Not measured: there is no Act V
  bot yet; these are the model's numbers.
- **Resets get faster (rule 3)**: a universe keeps its Megaprojects (the Great Drill's +50% and deep
  seams, the Factory's ninth row, every Lighthouse and Anchor rule), reputation, the Codex and the
  Drawer, the Legacy tree's Automation and Acts I-II's research (the Seed), and the Kernels bend the
  rules in its favour; the second universe's climb to its World is the model's 20-30 h against the
  first's 80 (not measured).

### Not built (decided)
- **No Megaproject #6** at Beyond's Bay. A sixth project would need a reward that is a rule and a reason
  to build at Beyond rather than sell there; tier 5 already has its Dock, the Ledger and the Replica, and
  every candidate reward was a multiplier on income. Beyond's Bay position is reserved (its art exists);
  `placeHBay` places it only when a project's floor is Beyond.

### Derivative, flagged and re-derived (CLAUDE.md)
- **A third prestige layer with its own tree** resembles Antimatter Dimensions' Reality (its Perks and
  Glyphs) and Universal Paperclips' last stage (the universe folded into the next). Re-derived from the
  game's own fold: the reset *is* the signature mechanic applied to the whole top floor (the same audit,
  the same U, W, C), Kernels count the folds standing on the same steps x grade x tier scale as Patents
  and Legacy (no log of a currency), and the tree changes the rules a layout is built under (belt
  capacity, ports, box size, recipes, floors), never a multiplier.
- **Infinite orders** resemble shapez's endless freeplay levels and Factorio's infinite research.
  Re-derived: linear amounts (shapez's and Factorio's grow geometrically), a fixed turn of the game's own
  products, never timed, paying the Dock value back twice (no multiplier), cosmetics every tenth.
- **Wide Belts** resemble Factorio's two-lane belts. Re-derived: one lane holding two items a tile (no
  lanes, no side-loading), a change to §4's belt ratio, bought as a rule.
- **Alternate recipes** resemble Satisfactory's alternates. Re-derived: five, each turning a byproduct
  into an input or removing a step (the byproduct lesson of Acts I-II), one Kernel node, no hard-drive
  hunt, never counted for filing.
- **The Seed** resembles a roguelite's carried-over starting item. Re-derived from the fold: it is the
  World folded into one tile, it digs the four raw ores the Workshop is built from, and its sides are a
  routing puzzle (which ore leaves which side).

## 24. The long tail (Milestone 11, 60 h+)

New thinking: **nothing new to learn, everything to master.** By 60 h every rule of the game is on
the table; the long tail is the set of goals that ask the player to use them well, and each one pays
back a small rule about the thing it asked for, so the reward is felt in the act it was earned in.
Data: `src/data/trophies.ts` (the shelf and its caps), `src/data/codex.ts` (completion and the lore
pages), `src/data/cosmetics.ts` (every skin), the Milestone 11 blocks of `src/data/challenges.ts` and
`src/data/scenarios.ts`. Sim: `src/sim/longtail.ts` (`trules`, `craftSpeed`, `freeBuild`,
`codexCompletion`, `codexPages`, `grantCosmetics`, `setSkin`, `boardRecord`, `takeBoards`), and the
rule helpers at the foot of `src/sim/systems/challenges.ts`. Tests: `tests/longtail.test.ts`.

### The Trophy Shelf
**205 trophies, 18 of them hidden** (shown as "???" until earned: `trophyFace`). They cover every act
and layer: the slice's 29 and Acts II-III's 26 from before; then the long deliveries (every run
counted: `meta.lifetime.delivered` plus this run, Act I's gears to Act IV's Sunset Generators), the
firsts of Acts II-V, the Codex tier by tier, Reorganize and the Drawer, Relocate and the islands, the
Megaprojects, the District and Beyond, the Last Fold and the Kernel tree, the Endless Ledger, grades
and audits, Challenges, every Scenario board, skins, reputation, lifetime coin and the shelf itself.
Trophies are kept through every reset (their `trophy:<id>` flags), so their bonuses are too; they are
checked once a second at the end of the tick (`checkTrophies`), offline replay included.

**Trophy bonuses.** Every trophy carries one small bonus about what earned it (`bonus`), one of sixteen
kinds, summed over the trophies that give it (and the Ledger's rules, §23) and **capped** (`TROPHY_CAPS`),
so a full shelf is a set of small rules and never a reward that grows with the count. The table is as
re-balanced after the review of 2026-10-22 (the uncapped sums had run to 3x their caps: routes 120 against
40, skiffs 13 against 4, the Drawer 21 against 6; Act IV-V trophies paid start coin or a kind already
full); the last column is every trophy's and Ledger rule's sum against the cap, **never above 1.5x**
(`tests/longtail.test.ts` checks it):

| kind | what it does | one trophy | the cap | derivation |
|---|---|---|---|---|
| `speed` | Workshop machines crafting that product run faster | +5% | +10% a product | a long delivery is 3-7 h of one line (each trophy says which); a twentieth of a line is one machine in twenty, folded into the module with the rest of the audit |
| `free` | the first n of a Workshop building on the map are free; a free one refunds nothing (removed or folded) | 1-4 machines, 10-20 belts | none | one machine's price, a few minutes of the act's income: the Miner 40, the Slag Heap 25 (the first slag jam's own cure: "Slag Happens"), the Chem Vat 12,000; never in a Scenario |
| `skiffs` | every route takes more skiffs | +1 | +4 (12 -> 16) | a route trophy's (§21: twelve skiffs carry a far feeder); Act III's five: 5 (1.25x) |
| `routes` | every high floor holds more routes | +5 or +10 | +40 | a third of the 120 (§21); Act III's eight: 45 (1.13x) |
| `drawer` | the Patent Drawer holds more designs | +1 | +6 (8 -> 14) | under A Deeper Drawer's 4 plus the Legacy's (§19, §22): which lines to keep stays a choice; eight trophies: 8 (1.33x) |
| `sparkLife` | Sparks stay longer | +2 or +3 s | +10 s (20 -> 30) | §6's 20 s, for a player who catches them; six: 14 s (1.4x) |
| `heap` | Slag Heaps hold more | +50 | +200 | 400 is about 53 min of one smelter (§4): +50 is 7 min; five: 250 (1.25x) |
| `startCoin` | every run after a reset starts with more coin (a head start: `granted`) | 10-5,000 | 20,000 | each about the act's first purchase when it is earned (the Bellows' 15 ... the Patent tree's 5,000); the cap an Act II-III run's first heavy machines (a Mixer, a Refinery, a Smelter Mk2: 19,000, §18); 27 trophies, Acts I-III's only: 25,065 (1.25x; was 68,465 uncapped) |
| `cool` | Overdrive cools sooner | 2-3 s | 10 s (30 -> 20) | still twice its 10 s run (§18); five: 12 s (1.2x) |
| `repair` | the Old Works' ruins repair cheaper | 10% | 30% | off §22's quarter; four: 40% (1.33x) |
| `chute` | the Chute holds more of each item | +5 or +10 | +40 (20 -> 60) | Specimen Jars' level (§21); seven: 40 (1x) |
| `barge` | the World's barges fly faster | +0.25 tiles/s | +1 (3 -> 4) | the Lighthouse's Lens Room's step again (§22), so a World with both flies at 5; three trophies and two Ledger rules: 1.25 (1.25x) |
| `courier` | Beyond's couriers load and unload quicker | 0.2 s | 1 s (2 -> 1) | the District's skiffs' 1 s (§21): beside its consumer a courier moves 0.4 a second, at the cap 0.67, which is where Beyond's tier 4 bulk stands (§23); five trophies and two Ledger rules: 1.4 s (1.4x) |
| `lot` | the World's and Beyond's lots cost less | 5% | 40% | 10M and 100M x n stay linear (§22-23), Zoning Freeze's 20% for the District (§24) twice; ten trophies and a Ledger rule: 55% (1.38x) |
| `ledger` | every Endless Ledger order wants less | 5% | 35% | an order still grows by two thirds of its base (§23); nine trophies and a Ledger rule: 50% (1.43x) |
| `cosmetic` | a skin | one | none | the firsts with no rule worth giving (Warm Hands: the Bellows ends cranking within a minute) |

**Acts IV-V's trophies pay Acts IV-V's rules** (the review of 2026-10-22: Act V's trophies paid start
coin, the Last Fold, Perfect Fold and Full Shelf 10,000 each, or a kind long full, the Kernel tree +10
routes, the Ledger's 100th and 500th a skiff, and the ribbon said "yours for good"). Each pays one of the
four new kinds above about the thing that earned it (the Lighthouse, four Relocates and all fifteen
Challenges the barges; the World, the Sky Anchor, Relocate, Legacy, the Standing Committee and the
Codex's tier 4 the high lots; Beyond, the Last Fold, Perfect Fold, the Kernel tree and the Codex's tier 5
the couriers; the Ledger's four, the Kernels' two, Third Time, Collection Complete and Full Shelf the
Ledger), or the good's own craft (a tier 4 good's first and its long delivery are its 10%; each tier 5
first is +5% on that impossible invention), the Old Works' repairs, a free machine where it is wanted (a
Generator on Rime, whose power plant warms a line, §22) or a skin. Never start coin, never an Acts I-III
kind. **A bonus already at its cap says so**: `bonusCapped` (the other trophies earned and the Ledger's
rules paid already reach the cap) puts a lock on the sticker, "its bonus, capped" and "capped: the shelf
already gives the most" on the sticker in hand, and the same words on the ribbon when it is earned.

*Derivation:* PLAN.md asks for "a small, specific bonus" per trophy; DECISIONS.md forbids a pooled
multiplier. Each bonus is a rule the player already knows (§4 prices, §6 Sparks, §18 Overdrive, §19
the Drawer, §21 routes and the Chute, §22 the Old Works), moved a notch, and each cap keeps the sum of
a kind under what one Patent, Legacy or Kernel node gives. **Pacing:** the slice's own trophies (first
Miner, first jam, 100 ingots, 500 plates...) are earned in the first hour of the first run, so their
bonuses are inside the slice pace tests (first purchase 20-40 s, Miner by 2:00, first fold by 40:00,
slice end by 45:00, the first Reorganize at 4-6 h with 12-20 Patents); `startCoin` begins at the
second run. **No craft speed and no Overdrive cooling is earned in the first run** (the second
gate's rule 3 lesson again, re-learnt here): with +5% on ingots, plates, wire and Gizmos from the
slice's delivery trophies, and the long Act I deliveries at 10,000 gears and 5,000 Gizmos (the
campaign bot makes those by 2.6 h and 1.1 h), run 1's peak rose 9% (14.8K to 16.2K a minute) and seed
1000's run 2 passed it at 0:59 against a limit of 0:42. So the slice's delivery trophies give a
machine free instead, the Act I long deliveries count 50,000-100,000 (runs later), the Overdrive and
hidden click trophies count ten times further, and Bar Hopping (100 ingots, minutes in) gives a
Smelter rather than heap room (§12's offline lesson is a furnace filling the first heap's 400 in
53 min). Everything else lands past 5 h.

*Measured* (with the shelf's bonuses, the five pace tests): the Bellows at 0:21, the first Miner at
0:47, the first fold at 23:12 mean, the slice end at 30:00 mean (greedy 27:37, Dock-only 38:11); the
first Reorganize at 4:22 and 4:17 with 14 Patents (seeds 1000 and 8919), run 1's peak 15.2K and 14.5K a
minute (was 14.8K and 14.3K), run 2 passing it at 0:16 on both seeds (was 0:27 and 0:16; limit about
0:43), run 3 passing run 2's at 1:11 and 1:19 (still open, §19: limits 0:55).

### The Codex
**Completion** (`codexCompletion`): the items first delivered (`s.codex`, Unit 7's collection: an item
is logged once Unit 7's rep 1 pays the Codex, §18) out of every item the Codex logs (a Dock value above
nothing: 56), by tier: 9, 10, 16, 13 and 8. Five trophies complete a tier each, two count the whole.

**Lore pages** (`CODEX_PAGES`; `codexPages`, a pure function of the state): one a tier, one a floor and
one an island, written by Unit 7 in its own voice (capitals, third person, as the orders' pitches and
the Gazette's "UNIT 7 REPORTS"), each opened by a first the sim already keeps through every reset:

| page | opened by |
|---|---|
| Specimens I-V (a tier each) | an item of that tier in the Codex |
| the Workshop | the trophy Open for Business (the first sale) |
| the Factory | the first fold (`folds` counter) |
| the District, the World, Beyond | the first module placed there (`districtPlaced`, `worldPlaced`, `beyondPlaced`) |
| Home | the first Relocate (a place is only seen once it is left) |
| Pebble Isle, Cinder Isle, Rime, the Old Works | a visit (the `visit:<island>` counter, which a Last Fold keeps where `meta.visited` is not) |
| the Ledger, Folios I-VI | Endless Ledger orders 10, 30, 50, 70, 90 and 110 (`meta.ledger.n`, kept for good; §23). The Codex's lore list shows the open folios and the next one only |
| **Unit 7: Collection Complete** | the first Last Fold |

**Unit 7's ending** closes the Codex: the World folded into one tile is the last specimen, the
collection is complete, and Unit 7 opens a new, empty drawer; its gratitude line ("UNIT 7 IS OFTEN
PLEASED. THIS IS MORE.", §18 Customers) is the last words.

### Challenges, 6-15 (`src/data/challenges.ts`)
As §21's five: one rule a run, the goal something done this run (an order, a delivery, a fold, a
count from the run's start), the reward a small rule that matters in the act it is won in. Acts III
and IV's are offered only once that floor has stood in some run (`needs`).

| Challenge | act | rule | goal | reward, for good |
|---|---|---|---|---|
| Clean Hands | II | no Slag Heaps built | 400 concrete delivered | gravel and concrete craft 10% faster |
| Old Faithful | II | no Mk2 machines | 100 motors delivered | Mk2 machines 15% cheaper |
| Hand-Made | II | no stamping | 8 modules standing on the Factory | a design's first stamp takes no Machine Kits |
| The Strict Inspector | II | every fold a letter lower | a fold graded A (an S before) | S+ needs 70% of byproducts used inside (was 80%) |
| Belt Budget | II | 60 belt tiles on the Workshop | 1,000 steel delivered | C full at 0.55 machine tiles a box tile (was 0.6) |
| Headwinds | III | District skiffs at half speed | 30 robot arms delivered | District skiffs +0.5 tiles/s |
| Short Haul | III | District routes at most 5 tiles | 10 Sandwich Engineers delivered | every route takes 2 more skiffs |
| Zoning Freeze | III | no District lots | the Specimen Drawer (Unit 7) | District lots 20% cheaper |
| Rough Seas | IV | World barges carry 1 a trip | 10 modules standing on the World | barges carry one more |
| Light Fleet | IV | 3 skiffs, barges or couriers a route | a Megaproject stage this run | dwell x0.75 on every high floor |

*Derivation:* each row's own derivation string in the data names its numbers (§10, §18, §21, §22). The
goals are 15-60 min of the act's lines (§16 rule 1); each reward is under one Patent or Legacy node's
worth, and none is a multiplier on income. Every Challenge won also pays a skin.

### Scenarios, 4-8 (`src/data/scenarios.ts`)
| board | land | research | coin | twist | scored by |
|---|---|---|---|---|---|
| Pocket Workshop | A, B | Act I | 8,000 | fold boxes 4x4 | Gizmos a minute |
| Slag Mountain | A, C, E, F | Acts I-II | 300,000 | no Slag Heaps | concrete a minute per tile |
| The Antique Shop | all six | Acts I-II | 800,000 | Mk1 machines only | motors a minute |
| Night Market | A, E, F | Acts I-II | 400,000 | power producers 0.75x | plastic a minute per kW |
| Thin Vein | A, B | Act I | 8,000 | Miners 0.5x | gears a minute per tile |

*Derivation:* three are Challenges as boards (Small Boxes, Clean Hands, Old Faithful, §21): the same
rule, scored as a number instead of won once. Night Market scores per kW drawn by the box's machines
in Normal mode (`designKwOf`), so Efficient mode (0.75x speed at 0.5x power, §18) scores 1.5x. Thin
Vein halves §4's 30 ore a minute, so the patch is the limit and the score is per tile. The coin is each
board's lines twice over at §4 and §18 prices.

### The efficiency boards
Every board keeps **three personal bests besides its score**: its product a minute **per tile** of the
fold box, **per kW** its machines draw (0 while no fold is powered), and **waste**, the share of
byproducts the audit found unhandled (1 - W, §10; lower is better). Each is the best over every fold
of the board's product, so the four may come from four designs (`BoardRecord`, `mergeBoard`). A
Scenario game notes its own (`meta.boards`, once a second); the town takes them with the `boards`
command when the player comes back (`takeBoards`: checked, field by field, only a better value kept)
and keeps them through every reset, in the save. **Local only**: a public board stays in `IDEAS.md`
until there is a reason for a server.

### Cosmetics (`src/data/cosmetics.ts`)
One list of 41 and the Ledger's numbered ribbons: the Ledger's three skins (§23), eight from
reputation (each customer at rep 3 and 5), fifteen from Challenges, fifteen from trophies. A skin
dresses one or more kinds (`slots`: a Workshop building, `module`, or the high floors' `skiff`,
`barge`, `courier`); a decoration is a skin of the Dock or Hopper. Owned: `meta.cosmetics` (granted
once a second by `grantCosmetics`, the Ledger's by the Ledger, never in a Scenario); worn:
`meta.skins[kind]`, chosen by `{ k: 'skin', kind, id }` (null: plain). The art is `skin_<id>_<kind>`
sheets (`skinSprite`). Purely cosmetic: no system reads the choice.

### Saves
`SAVE_VERSION` 11: an older save has no skin worn and no board on file; its trophies keep their flags,
so their bonuses apply at once, and the cosmetics its Challenges, reputation and trophies have earned
are granted within a second of loading. The determinism fingerprint covers the shelf, the cosmetics
and skins, the boards, the free buildings and the Challenges.

### Derivative, flagged and re-derived (CLAUDE.md)
- **Achievements with bonuses** resemble Antimatter Dimensions' achievement rewards and Cookie
  Clicker's milk. Re-derived: each bonus is a rule about the thing that earned it, and every kind is
  capped, so the shelf never multiplies income by its own size (milk's whole idea).
- **Challenges** resemble Antimatter Dimensions' (§21). Re-derived as before: factory goals, rule
  rewards, no multiplier; three of the new ten are also Scenario boards, scored instead of won.
- **Efficiency boards** resemble Zachtronics' histograms (cost, cycles, area). Re-derived from the
  fold audit: the three numbers are the audit's own (rate per tile is C, waste is W, per kW is §18's
  power), local, no histogram of other players.

## 25. Performance (measured, Milestone 14)

The target (ROADMAP.md Milestone 14): 200 modules on a floor and a dense 16x16 Workshop at 60 fps
on a mid laptop. A frame has 16.7 ms; the sim's share is under 4 ms (Milestone 2's budget: a 20 Hz
tick lands in a third of the frames). `npm run perf` builds each floor at its worst with the whole
floor in view at 1920x1080 (nothing culled): the dense Workshop (50 min of planner play, then every
free tile of the 16x16 belted and every belt carrying an item: 250 things, 196 items); the Factory
at its widest (18x9, 118 modules, 32 trunk tiles into the Dock and the Hopper); and every lot of
the District, World and Beyond with 168 / 213 / 172 modules and 168 / 180 / 160 routes (336-360
skiffs, the route cap). "Frame" is the JavaScript of one frame (render and HUD); "fps" is the
headless page's rate (unthrottled, so above 60 when there is room). Measured 2026-10-22 on a Ryzen
9 7945HX laptop under heavy load from other agents (the CPU at 80%+): a quiet mid laptop is
roughly as fast, a slow one 2-3x slower, which the numbers after leave room for.

| Floor | Frame before (GPU) | fps before | Frame after (GPU) | fps after | SwiftShader before → after |
|---|---|---|---|---|---|
| Workshop, dense 16x16 | 13.8 ms | 67 | **2.4 ms** | 193 | 14.8 ms, 11 fps → 3.2 ms, 30 fps |
| Factory, 118 modules | 15.3 ms | 56 | **4.0 ms** | 109 | 15.8 ms, 8 fps → 5.4 ms, 19 fps |
| District, 168 modules | 25.3 ms | 24 | **5.0 ms** | 102 | 24.8 ms, 2 fps → 7.6 ms, 18 fps |
| World, 213 modules | 23.1 ms | 22 | **5.1 ms** | 92 | 23.4 ms, 2 fps → 7.6 ms, 18 fps |
| Beyond, 172 modules | 23.7 ms | 29 | **4.8 ms** | 97 | 26.2 ms, 3 fps → 7.6 ms, 19 fps |

- **Where the frame went**: the HUD, not the floor (on the Workshop the floor drew in under 2 ms of
  the 14). 6,300 canvas calls a frame on the Workshop: 9-slice panels tiled in 4 px pieces (3,100
  drawImage), pips a pixel at a time (1,400 fillRect), text a glyph at a time (500); on a full
  high floor, 30,000 one-pixel fillRects of flight lines more, which SwiftShader rasterized at 2-3
  fps. After: 1,480 calls on the Workshop.
- **The fixes** (DECISIONS.md "Milestone 14"; none changes a pixel): `src/ui/bake.ts` bakes a
  9-slice at a size, a string in a face and colour, and a pip shape in a colour, on the second
  asking, the most recently used kept within a pixel budget; a high floor's flight lines are one
  baked layer per march offset, repainted only when a route, its state or the selection changes;
  the HUD's reset previews (`previewPatents`, `relocateNow`, each a walk over every module) are
  answered once a tick (`src/app/pertick.ts`).
- **SwiftShader** (no GPU at all) is raster-bound on the high floors at 1920x1080 (18-19 fps with a
  5-8 ms frame): 500-900 sprite draws scaled 4x. A machine with no GPU canvas is outside the target.
- **The sim**: a tick of the whole game with every floor full is **0.86-0.96 ms** (the worst sample
  1.55 ms; budget 4 ms, so it passes); the dense Workshop alone 0.06 ms. Profiled (1,000 ticks):
  `runFloor` (`src/sim/systems/high.ts`) is 80% of it, of which its own body 0.27 ms, `routeCap`
  0.15 ms (with `hent` 0.07), `stepModule` 0.14 ms for 540 modules. **Fixed after Milestone 11
  merged** (`runFloor`): the route groups are built once per route list and layout
  (`routeGroups`, kept until a route is added or dropped or `hversion` moves), a skiff's numbers
  once a floor a tick instead of per route (`skiffStats` asked `prules`, `megaDone` and the
  Challenges' rules every time), the waste chute's "has a route" read from the groups' per-source
  item sets, and the Dock found with the layout cache. With the save-size test's full late game
  (every floor full, 2,000 ticks, a busy CPU) the tick went **1.52 ms -> 0.90 ms**, and the game's
  fingerprint after them is the same to the character (the same sums in the same order).
- **Cold load** (`npm run perf -- load`): the production build (a local `vite preview`) is 6
  requests, 0.66 MB over the wire (1.5 MB of script with every sheet under 4 KB inlined), **0.8 s**
  to the title. The dev server is 1,057 requests (1.3-1.5 s warm, 40-90 s on a cold server); that
  is a dev-only cost, so no atlas packing at build time.
- Saves: §20 "Save size".
