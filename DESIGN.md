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
  Display: `1,234` → `12.3K` → `4.56M` …, with scientific notation as a setting.
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
the item), red = blocked (names the item), grey = unconnected. Hovering shows
"Smelter 3: starved of iron ore 41% of the last minute; feeding miner makes 30/min, this smelter
wants 30/min, the belt is shared with smelter 2."

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
  - **Lucky Vein**: an ore patch tile glitters. Click it and that patch's miners run at 3× for
    60 s. It only appears on a patch that has a working miner.
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
  | Lamp Posts | 150 gears + 300 wire | 4,500 coin + 1 rep | 1.6× value |
  | The Gizmo Festival | 40 Gizmos | 8,000 coin + 1 rep + the Folding hint | 2.5×: the run-up to the fold |

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
   two kinds of machine** (a module is a line, not a part: a lone miner in a 1×1 box graded S)
   and no Dock, Hopper or Hand Furnace, and every building in it wholly. Belts crossing the box
   edge become the module's **ports** (in or out, by belt direction). Power never crosses the
   box (§18). While a box is audited, Lucky Veins and Overdrive don't touch it, so a boost is
   never folded in for good.
2. **Audit.** The box keeps running for **70 s** of sim time (10 s warm-up + a 60 s window) while
   you play on. The game measures, per item: rate in through ports, rate out through ports, and
   items made inside (miners count as made inside). Over the window it also tracks each
   machine's busy fraction and where the byproducts ended up.
3. **Grade.** `score = 0.6·U + 0.2·W + 0.2·C`
   - **U** = mean busy fraction of the machines in the box.
   - **W** = byproducts leaving through ports or used inside ÷ byproducts made (1 if none are
     made). A machine blocked by its byproduct counts the byproducts it would have made, so a
     line jammed by slag scores W = 0, not 1. A heap inside the box is waste: as a module it
     would never fill.
   - **C** = min(1, (machine tiles ÷ box tiles) ÷ 0.6).

   | Grade | Score | Rate multiplier |
   |---|---|---|
   | S | ≥ 0.90 | ×1.25 |
   | A | ≥ 0.80 | ×1.10 |
   | B | ≥ 0.65 | ×1.00 |
   | C | ≥ 0.50 | ×0.90 |
   | D | < 0.50 | ×0.75 |

   *Derivation: a balanced 4-smelter/3-press plate line with slag handled reaches A or S. The
   same machines with an unbalanced ratio or slag backing up land at C. That 25–50% gap is
   bigger than one extra machine's worth, so balancing beats buying.*
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
  **blocked** in proportion. The same status pips apply.
- **The slice ends here**: modules making **three different products** run on the Factory
  floor, **at least one feeding another**, each at half speed or better for 30 s straight, all
  reaching the Factory Dock. Then Bramble's closing line and a "Milestone reached" card.
  *Derivation (Milestone 1–2 review): three copies of one module beside the Dock ended the
  slice 15 s after the first fold; the floor has to be a puzzle first (§14 question 3).*

## 12. Offline (slice)

- On load (or when a hidden tab comes back), elapsed time `t` (capped at 24 h in the slice) is
  computed as:
  1. **Replay**: up to **1 h** of real ticks headless (72,000 ticks, about a second), both floors,
     through the same systems: Workshop lines item by item, modules as rates. Heaps fill and lines
     jam during it as they would live.
  2. **Extrapolate** the rest from what reached each Dock and Hopper in the replay's last 5 minutes,
     at **offline efficiency 0.5**, paid through the same functions (orders first, then sales;
     research credit; Machine Kits to the parts bank).
- **Report**: coin earned, items delivered to the Hopper, research and orders finished, the first
  jam in the replay with its time and machine ("47m: Hand Furnace blocked by slag", with a button
  that jumps to it), and the Slag Heap that fills next.
- *Measured* (§13 check 12, planner after its slice end, seed 1000): left open and idle, the slice
  factory earns 126K in its first hour, then 48K, then 40.5K an hour from hour 3 on (11 of 23
  Workshop machines jammed on full heaps; the modules never jam, since the Factory Dock scraps
  slag). 8 h offline pays 331K (the replayed hour, then 7 h × 0.5 of the replay's last 5 minutes),
  0.79 of the 417K that 8 h open and idle pays.

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
9. **Slice end** (the rule in `sliceEndParts`): modules making three different products, one feeding
   another, all reaching the Factory Dock, by **45 min** (planner mean), and no sooner than **4 min**
   after Folding is researched (three 70 s audits, one at a time, and 30 s of running). The greedy
   and Dock-only bots reach it too, by 60 min. *Revised in round 3 from 60–90 min; see below.*
10. **No dead air**: in the first 35 min (or until the slice ends, if sooner), no stretch longer
    than **3 min** passes with nothing bought, researched, filled or folded (the greedy bot).
11. **Hopper versus Dock**: a player who sends everything to the Dock still reaches Folding by
    **60 min** (the Hopper is a choice, not a trap), but at least **5 min** behind the planner.
12. **Offline** (rewritten in round 3: §12's ×0.5 and the old "less than 2 h of active" contradicted
    each other, since 8 h at ×0.5 is already 4 h): 8 h offline after the slice end pays no more
    than (a) leaving the game open and idle for the same 8 h, measured by a live run of the bot's
    state with no inputs, and (b) **4.5 h** of the planner's measured active rate (its coin per hour
    over the 10 minutes after its slice end): the first hour replayed in full plus 7 h at ×0.5.

**Measured** (round 3, 2026-10-20, `tests/pace-*.test.ts`, 50 seeds unless noted, mean (range)):
Bellows 0:21; first Miner 0:47; Pressing 1:48 (Dock-only 3:29); chunk B 10:47 (10:05–11:13); chunk C
22:28 (10 seeds, 21:59–22:59); first Gizmo 18:09 (17:27–18:36); Folding 27:07 (26:08–28:18); first
fold 28:32 (27:45–29:28), "Copper wire" graded S (0.95); slice end 31:26 (30:38–32:22), 4:18 after
Folding (4:02–4:37), with "Iron ingots" S (1.00) feeding "Gear works" S (0.91); greedy slice end 29:51
and Dock-only 38:47 (36:17–42:49) (10 seeds each); check 7: balanced A 0.873 (U 1.00, W 1.00, C 0.37),
wrong ratio D 0.474 (U 0.34), slag backing up D 0.073 (U 0, W 0); check 8: jam 38 s after the line
starts; check 10: greedy's longest stretch 162 s (150–163); check 11: Dock-only Folding 34:15
(30:58–38:46), 7.1 min behind; check 12 (2 seeds): 8 h offline = 1.78 h of active earning, 0.79 of
8 h open and idle. Every check holds; no test is `it.fails`.

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
  each node (clicking helps but never replaces the line).

## 16. The 100-hour pacing model

**Targets** (cumulative play by a competent player, active about 40% of the time):

| By | Reached |
|---|---|
| 40 min | first fold (measured: 28:32, planner bot) |
| 90 min | slice end: Factory floor running (measured: 31:26 under the three-product rule; §13 check 9 is revised to ≤ 45 min) |
| 3 h | Act II: power, steel, glass, circuits |
| 5 h | first Reorganize (12–20 Patents) |
| 15 h | District floor (Act III) |
| 25 h | first megaproject complete |
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
   idle play. Never more than 4×, so idling is never punished; never less than 1.5×, so
   playing is always worth it.
5. **New thinking per act**: each act adds at least one problem the last act didn't have
   (routing → ratios and power → composing modules → biome rules → bending rules). Adding
   an ore with a bigger number doesn't count.
6. **No forced resets**: progress without resetting slows but never stops. The bot that never
   resets still reaches Act III by 30 h.

## 17. Readability at 1×

At 1× zoom, a player must tell apart within a second:
- An ore patch versus bare ground versus land not owned.
- A working, starved, blocked or unpowered machine (the pip plus a motion cue: working
  machines animate, stopped ones don't).
- What item is on a belt (8×8 icons with distinct silhouettes, not only colours).
- A module versus a machine (modules are framed and show their main output's icon).
- The fold box and its ports (in = arrows pointing inward, out = outward).
- A Spark versus decoration.

## 18. Act II: the Factory (Milestone 4, 1.5–5 h)

New thinking: **ratios and power**. Act I asked where things go; Act II asks how many of each, and
what they run on.

### Land and deposits
- The Workshop widens east to 24×16: **chunk E** (x 16–23, y 0–7) with a coal and a sand
  deposit, 15,000 coin, after *Coal Seams*; **chunk F** (x 16–23, y 8–15) with coal and iron,
  40,000, after *Steam Power*. *Derivation: E costs about 6 minutes of a slice-end factory's
  income (≈2,500/min), F about 8 minutes of an early Act II one (≈5,000/min).*
- **Deposit claims, not depletion** (decided here, `DECISIONS.md`). Ore never runs out. A
  *source* design (miners inside, no inputs) may have as many stamped copies of each ore as you
  hold claims for that ore. Everyone starts with 3 claims per ore plus 2 per Workshop deposit of
  that ore they own; the **Survey Office** (research *Surveying*) sells more, 4 at a time
  (iron and copper 5,000, sand 8,000, coal 12,000; each later block of 4 costs 1.5× the last of
  its ore, linear in blocks bought: `price × (1 + 0.5·b)`, the stamp rule again). *Derivation:
  claims keep the Workshop's ore patches meaningful after folding (pillar 2: land matters),
  without the chore of re-folding depleted lines.*

### Items and recipes (tier 2)
| Item | Value | Made by | From | Time |
|---|---|---|---|---|
| Coal | 2 | Miner | coal deposit | 2.0 s |
| Sand | 1 | Miner | sand deposit | 2.0 s |
| Steel | 15 | Smelter | iron ingot + coal, 1 slag per 2 | 3.0 s |
| Glass | 8 | Kiln | 2 sand | 2.0 s |
| Gravel | 2 | Press | 2 slag | 1.0 s |
| Concrete | 22 | Mixer | 2 gravel + sand | 3.0 s |
| Plastic | 16 | Refinery | 2 coal, 1 oil per 2 | 4.0 s |
| Oil | 3 | (Refinery byproduct) | | |
| Circuit | 110 | Assembler | 3 wire + plastic + glass | 5.0 s |
| Machine Kit | parts | Assembler | 2 steel + 2 gears | 4.0 s |
| Motor | 420 | Assembler | 2 steel + gear + circuit | 8.0 s |
| Drill Bit | megaproject | Assembler | 4 steel + motor + 2 concrete | 12 s |

*Derivation: each step pays about 1.5–4× its inputs' value, more for longer chains (circuit 3.4×,
motor 2.6×), so a deeper line is always worth building; slag now has two outlets (gravel,
bricks) and the refinery's oil is a byproduct with a use (boiler fuel), so zero-waste lines
are possible and earn W = 1.*

### Power
- **Boiler** (120 coin): burns 1 coal or 1 oil every 4 s while the grid needs it, and steams the
  **Steam Engine** in front of it (200 coin), which makes **300 kW**. **Generator** (260): one
  tile, burns 1 coal every 3 s for **150 kW**. *Derivation: the boiler pair gets 1,200 kJ from a
  coal, the generator 450 kJ: efficiency against compactness, which is exactly what the fold
  grade's C weighs.*
- **Pole** (15): powers everything within 2 tiles (a 5×5 square) and joins poles within 6 tiles
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
  **3× speed** (600, 1,200 and 4,000 coin). *Derivation: 3× fits one Mk1 belt (a Mk2 smelter's
  90 ingots/min under the belt's 120); four tiles for three machines' work is worse density
  than Mk1, paid back by fewer belts and ports and by modes.*
- **Modes** (research *Tuning*, powered machines only): **Efficient** 0.75× speed at 0.5×
  power; **Overclocked** 1.5× speed at 2.2× power; **Precision** 0.8× speed, +25% of the main
  output (§15).
- **Overdrive** (research *Overdrive*): click a machine to run it 3× for 10 s, then it cools
  for 30 s (§15). Any machine, Mk1 included. *Derivation: one player clicking a 6-machine line
  about every 5 s keeps a third of it overdriven: +67% while active, the main lever behind
  §16 rule 4 (active 2–3× idle) in Act II.*

### Customers
- **Unit 7** (met with *Coal Seams*): a collecting robot. Orders: *Calibration Weights* (300
  steel → 9,000), *Lens Array* (400 glass + 60 circuits → 24,000), *One of Everything* (one of
  every item made so far → 30,000). Reputation: 1 opens **the Codex** (every item with its
  story; a first delivery of each pays 100 × its value once); 2 teaches **Recycled Glass**
  (Kiln: 3 gravel → glass, 2.5 s); 3 adds +10% to Precision's yield.
- **Dame Voltaire** (met with *Steam Power*): the swamp's electricity baroness. Orders:
  *Streetlamps* (150 circuits + 300 glass → 40,000), *Concrete Promenade* (800 concrete →
  45,000), *The Grand Turbine* (40 motors + 600 steel → 60,000). Reputation: 1 lets boilers
  burn oil at 2× heat; 2 gives steam engines +25%; 3 extends pole reach by 1.
- *Derivation: each order pays about 1.5–2.5× its items' Dock value (§7's rule), and every
  reputation reward is a rule a player plans around, not a flat multiplier.*

### Machine Kits (parts costs for stamps)
- Stamping a design that holds any Act II machine (powered, Mk2 or a power building) also costs
  **Machine Kits**: 1 + floor(bill ÷ 1,500). Kits delivered to a Hopper go to the parts bank,
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
- Research *The Great Drill* puts the **Megaproject Bay** (2×2) on the Factory floor. Stage 1
  wants 40 Drill Bits, 1,500 concrete and 600 steel, delivered by trunk. Done, it lets every
  Miner and every source module run **+50%** for good. **Megaproject progress survives every
  reset** (stored apart from the run's state for Milestone 5). Stages 2 and 3 arrive with
  later floors. *Derivation: stage 1 is about the last hour of Act II's output; +50% on ore is
  the biggest single boost of the act, earned, permanent, and visible on every miner.*

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
- Steel by about 1:45, power by 2:15, circuits by 3:00 (§16: "3 h: power, steel, glass,
  circuits"), the Great Drill's stage 1 by about 4:30, and the first sensible Reorganize point
  at about 5 h: lifetime coin enough for 12–20 Patents (§15's formula, rescaled in Milestone 4
  to this economy, `DECISIONS.md`).
