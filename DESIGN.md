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
| **Gizmo** | Assembler | 1 gear + 3 wire | 4.0 s | 80 | 20 in → 80 (×4): the first product |

*Gizmo flavor text: "Does something. Bramble isn't sure what. Bramble loves it."*

**Ratios this creates** (the Act I puzzles):
- Miner 30/min : Smelter 30/min → **1 : 1**.
- Smelter 30/min : Press 40/min → **4 smelters : 3 presses** for plates.
- Gear needs 60 plates/min per assembler → **1.5 presses per gear assembler**.
- A Gizmo assembler (15/min) needs 15 gears/min (½ a gear assembler) and 45 wire/min (1.1 presses, 0.56 copper smelters).

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
    grade it with §10's audit formula and pay **60 s of that line's measured output value ×
    the grade multiplier**. This rewards a good line, not a lucky click.
  - Missing a Spark costs nothing. Sparks pause while the tab is hidden (no offline Sparks).

## 7. The Dock, orders and Mayor Bramble

- **Standing order**: the Dock buys every item except slag at its §3 value. It's always open.
- **Special orders** (Bramble's slice set). Each one is optional and never timed, and only one
  is active at a time:

  | Order | Wants | Pays | Derivation |
  |---|---|---|---|
  | The Boardwalk | 400 iron plates | 3,000 coin + 1 rep | 1.5× value: worth routing a line to it |
  | Lamp Posts | 150 gears + 300 wire | 4,500 coin + 1 rep | 1.6× value |
  | The Gizmo Festival | 40 Gizmos | 8,000 coin + 1 rep + the Folding hint | 2.5×: the run-up to the fold |

  Items delivered to the Dock fill the active order first, then sell.
- **Reputation (Bramble)**: 1 rep → plates sell for +20%. 2 rep → one free Buffer Crate a
  minute up to 5 (logistics help). 3 rep → the Lily Pad Dock skin.

## 8. The Hopper and research (slice)

Research nodes cost item deliveries. The Hopper takes anything; each node fills from matching
deliveries while it's **selected** (one at a time). Items delivered with nothing selected are
banked by type for the next node.

| # | Node | Cost (delivered) | Unlocks | Derivation |
|---|---|---|---|---|
| 1 | Pressing | 30 iron ingots | Press, iron plate | §16: first research ≈ 5 min |
| 2 | Survey East | 40 iron plates | buy land chunk B (copper) | |
| 3 | Copper Smelting | 40 copper ore | copper ingot recipe | |
| 4 | Wire Drawing | 60 copper ingots | copper wire on the Press | |
| 5 | Gearcutting | 80 iron plates | Assembler, gear | |
| 6 | Splitters & Mergers | 50 gears | Splitter, Merger | |
| 7 | Buffers | 100 plates + 20 gears | Buffer Crate | |
| 8 | Gizmo Theory | 60 gears + 150 wire | Gizmo recipe, Bramble's Gizmo Festival | |
| 9 | Slag Bricks | 100 slag | slag brick on the Press | §4: waste becomes an input |
| 10 | **Folding** | 25 Gizmos + 200 gears | the Fold tool, land chunks C–D | §16: first fold ≤ 40 min |

Delivering to the Hopper instead of the Dock costs the item's coin value. That opportunity
cost is the point.

## 9. Land

The Workshop starts with chunk **A** (8×8: an iron patch with the Hand Furnace beside it, a
3-tile belt from the furnace to the Dock, and the Hopper). Chunk **B** (east, copper patch) costs 1,000 after Survey East. Chunks **C** (south,
second iron patch) and **D** (southeast, empty) cost 4,000 and 12,000 after Folding. The full
slice Workshop is 16×16. Placing on land you don't own is refused with "Buy this chunk: N coin".

## 10. Folding (the signature mechanic)

1. **Select.** The Fold tool drags a box, at most 8×8 in the slice. It must contain at least
   one machine and no Dock, Hopper or Hand Furnace. Belts crossing the box edge become the
   module's **ports** (in or out, by belt direction).
2. **Audit.** The box keeps running for **70 s** of sim time (10 s warm-up + a 60 s window) while
   you play on. The game measures, per item: rate in through ports, rate out through ports, and
   items made inside (miners count as made inside). Over the window it also tracks each
   machine's busy fraction and where the byproducts ended up.
3. **Grade.** `score = 0.6·U + 0.2·W + 0.2·C`
   - **U** = mean busy fraction of the machines in the box.
   - **W** = byproducts leaving through ports or used inside ÷ byproducts made (1 if none are made).
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
   machine prices inside and *n* is the number of copies of that module already made. The
   increase is linear, not geometric. *Derivation: the 5th copy costs 3× the first, so a new,
   better-graded module soon beats another copy of an old one, and designing stays the
   engine (pillar 1).* The Factory floor's 96 tiles are the other limit.
7. **Source modules** (with miners inside) take no inputs. In the slice they're unlimited. A
   deposit-claim rule is an open question for Milestone 4 (§15).

## 11. The Factory floor (slice portion)

- 12×8 tiles. Modules are 1×1 here, with one input side (accepts any of the module's input
  items) and one output side (emits its outputs round-robin). Rotation is R.
- **Trunk belts**: 8 items/s (480/min), 2 coin per tile. A **Factory Dock** and a **Factory
  Hopper** at the floor's edge, which work like the Workshop's.
- Modules run as rate functions, not crafts: each tick a module consumes its inputs at rate
  if they're available (fractional amounts banked), produces at rate, and is **starved** or
  **blocked** in proportion. The same status pips apply.
- **The slice ends here**: three modules on the Factory floor feeding the Factory Dock, plus
  Bramble's closing line and a "Milestone reached" card. Unlocks past this point are stubbed
  until the gate.

## 12. Offline (slice)

- On load, elapsed time `t` (capped at 24 h in the slice) is computed as:
  1. **Unfolded Workshop lines**: replay up to 10 min of real ticks headless (12,000 ticks,
     budget < 300 ms), then extrapolate each Dock/Hopper's measured rates for the rest.
  2. **Modules**: rate × remaining time, limited by their inputs as solved by a steady-state
     pass over the Factory floor graph.
  3. Multiply by **offline efficiency 0.5**.
- **Report**: coin earned, items delivered to the Hopper, orders filled, and the first jam
  in the replay with its time and machine ("2h 40m: smelter 2 blocked by slag"), plus a button
  that jumps to that machine.

## 13. Derived checks (these become pace tests)

Each check runs headless with a scripted bot over 50 seeds (Spark timing is the only random
part of the slice) and asserts the mean, with the spread logged.

1. **First purchase**: an active bot (4 clicks/s) buys the Bellows in **20–40 s**.
2. **Hands-free**: the first Miner by **2:00**.
3. **First research** (Pressing) by **6:00**.
4. **Land**: chunk B bought by **12:00**.
5. **First Gizmo** by **20:00**.
6. **Folding researched** by **35:00**, and the first fold done by **40:00**.
7. **Balance beats buying**: the balanced plate line folds at **A or better**, and the
   unbalanced line with the same machines folds at **C or worse**.
8. **Slag lesson**: a smelter line with no slag route stalls within **3 min**.
9. **Slice end**: three modules on the Factory floor by **60–90 min** for the planner bot.
10. **No dead air**: in the first 90 min, no active stretch longer than **3 min** passes with
    nothing affordable or researchable (the greedy bot).
11. **Hopper versus Dock**: a player who sends everything to the Dock still reaches Folding by
    **60 min** (the Hopper is a choice, not a trap), but 15+ minutes behind the planner.
12. **Offline**: 8 h offline after the slice end gives less than 2 h of the planner bot's
    active earning rate.

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
- **Overdrive / Inspiration / Sparks II**: Overdrive 3× for 10 s with a 30 s cooldown per
  machine. Inspiration: 1 click = 0.1% of the selected node's remaining cost, capped at 30% of
  each node (clicking helps but never replaces the line).

## 16. The 100-hour pacing model

**Targets** (cumulative play by a competent player, active about 40% of the time):

| By | Reached |
|---|---|
| 40 min | first fold |
| 90 min | slice end: Factory floor running |
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
