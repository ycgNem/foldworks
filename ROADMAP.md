# Foldworks — Roadmap

Every milestone ends with the Definition of Done in `CLAUDE.md`, a review by `idle-critic`,
and a `pacing-auditor` pass for any milestone that changes numbers. **Nothing from
Milestone 4 onward starts until Milestone 3's gate is marked passed below.** Ideas that don't
belong to the current milestone go to `IDEAS.md`.

"Covers" is the stretch of a player's first playthrough that the milestone builds, measured
against `DESIGN.md` §16.

| # | Milestone | Covers | Phase |
|---|---|---|---|
| 0 | Foundation | — | Slice |
| 1 | The Workshop | 0–35 min | Slice |
| 2 | The first fold | 35–90 min | Slice |
| 3 | **The gate** | — | Slice |
| 4 | Act II: the Factory | 1.5–5 h | Core game |
| 5 | Reorganize (layer 1) | 5–15 h | Core game |
| 6 | Idle and offline, finished | all | Core game |
| 7 | Act III: the District | 15–40 h | Core game |
| 8 | **Second gate**: the 40-hour review | — | Core game |
| 9 | Act IV: Worlds and Relocate (layer 2) | 40–80 h | Long game |
| 10 | Act V: Beyond and the Last Fold (layer 3) | 80–100+ h | Long game |
| 11 | The long tail | 60 h+ | Long game |
| 12 | Sound and juice | all | Polish |
| 13 | Onboarding, UX and accessibility | all | Polish |
| 14 | Balance, performance and release | all | Release |

---

## Milestone 0 — Foundation

**Goal:** a repo that boots, renders a grid, saves, tests and deploys, with no game rules yet.

Scope:
- Extract the engine layer from Trotline (`C:\Users\jacks\Documents\trotline`): `src/engine/`
  (loop, input, rng, events, save and migrations, time, audio), `src/ui/` (bitmap font, IMGUI
  kit, overlap audit), the camera and chunked-ground patterns from `src/render/`, `scripts/`
  (art import, contact sheets), and the `e2e/` harness (`launch`, `screens`, `shots`, `smoke`,
  `bot`). Strip every Trotline name, string and asset. Nothing from its `sim/`, `data/` or `app/`.
- Change the loop to the **20 Hz** tick (`DECISIONS.md`).
- **`src/engine/num.ts`**: the big-number type (mantissa + exponent), with add, sub, mul, div,
  pow, compare, log10, floor and format (`1.23K` … `4.56e123`). Unit tests cover the formatting
  boundaries and arithmetic to 1e308 and beyond. Decide in `DECISIONS.md` whether to wrap
  `break_infinity.js` (pinned) or keep our own; either way the game sees only `Num`.
- `src/sim/` skeleton: `Game` with a fixed system order, a command log (`Game.act`), seed +
  commands saves, `SAVE_VERSION` 1, and export/import save strings.
- The Workshop grid render: chunk A at 16 px, integer zoom 1×–4×, pan, a HUD strip with
  placeholder coin, and a title screen.
- `window.__app` debug handle: the game, freeze, step, fast-forward (×10, ×100, ×1000) and grant.
- The palette test: `art-director` draws six sprites (an ore patch, a miner, a smelter, a belt
  with three item icons, the Dock, a module frame) in two candidate palettes on a contact
  sheet. **The owner picks; then `STYLE.md` is written.**

Exit: `npm run dev` shows chunk A with an ore patch and the Hand Furnace placeholder;
`npm test` green (engine, Num, purity); `npm run screens` produces a report; the GitHub Pages
workflow publishes; `PROGRESS.md` and `DECISIONS.md` have their first entries.

## Milestone 1 — The Workshop (0–35 min)

**Goal:** the click-to-automation hour, up to researching Folding. `DESIGN.md` §2–§9 exactly.

Order of work, each step tested before the next:
1. **Items and recipes** as typed data with `derivation` strings, plus the data validation test
   (cross-references, derivations, every recipe reachable from ore).
2. **Placement**: build menu, rotate, remove (full refund in the slice), land ownership,
   chunk purchase.
3. **Belts**: movement at 20 Hz, 1 item per tile, insertion and extraction, splitter, merger,
   Buffer Crate. Unit tests: throughput 120/min, no item duplication or loss over 10,000 ticks,
   deterministic replay.
4. **Machines**: buffers, crafting, starved/blocked states, slag output, the Slag Heap.
5. **Clicking**: hand-mining, the Hand Furnace crank, the Bellows. The 12 clicks/s cap.
6. **The Dock** (standing order, Bramble's three special orders, reputation) and **the Hopper**
   (node selection, banking, the 10 nodes).
7. **Status pips and the hover report** (pillar 3) from day one, not as polish.
8. **Sparks**: Lucky Vein and Inspector.
9. **Pace tests** 1–5, 8, 10 and 11 from `DESIGN.md` §13, and the bot policies `greedy`,
   `planner` and `dock-only`.
10. Placeholder art replaced through `art-director` for every slice machine and item icon.

Exit: a new player can go from the first click to researching Folding in about 35 minutes;
the pace tests pass; screenshots of the first click, the Bellows, the first miner line, a
slag jam with its red pip and hover report, and the Folding research complete are in
`e2e/out/` and have been looked at. `idle-critic` reviews; findings are implemented or
answered in `DECISIONS.md`.

## Milestone 2 — The first fold (35–90 min)

**Goal:** the signature mechanic and the Factory floor. `DESIGN.md` §10–§12.

1. **The Fold tool**: box select, port detection, refusals with reasons (contains a Dock, too
   big, no machines).
2. **The audit**: a 70 s live audit with a progress ring, per-port rates, busy fractions,
   byproduct accounting, and a results card with the grade broken down (U, W, C) and
   "what would raise it".
3. **Modules**: fold, inventory, rename, unfold, stamp (bill × (1 + 0.5·n)).
4. **The Factory floor**: grid, trunk belts, modules as rate functions, Factory Dock and
   Hopper, floor switching, both floors running.
5. **Offline v1**: the headless replay, the steady-state module pass, the report with
   jump-to-jam.
6. **Slice end**: three modules feeding the Factory Dock, then Bramble's closing card.
7. Pace tests 6, 7, 9 and 12, and the bot plays the whole slice.
8. **Performance budget**: the full slice (Workshop 16×16 dense, 30 modules) at < 4 ms of sim
   per frame on a mid laptop. Measured by `npm run perf`.

Exit: the whole slice plays start to finish in 60–90 min; the pace tests pass; screenshots of
the fold box, an audit in progress, an S-grade and a C-grade result card, the Factory floor
with three modules, and the offline report have been looked at.

## Milestone 3 — The gate

`idle-critic` reviews the slice against `DESIGN.md` §14 and the not-list in `PLAN.md`.
`pacing-auditor` checks §13 and the first rows of §16. **The owner plays it for an evening**
before reading either report. Then either the model changes (in `DESIGN.md`, the slice is
revised and reviewed again) or the gate is marked passed here with the date.

**Gate status: passed with conditions, 2026-10-20 (the owner's evening of play still owed).** The
idle-critic passed the slice with four blocking conditions and the pacing-auditor failed it on
three checks; the slice was revised (the Gizmo Festival slice end, several audits at once, stock
taken off audit outputs, S+, nested folds need a chain, line Overdrive, the starting Slag Heap) and
every §13 check passes again (DECISIONS.md, "The Milestone 3 gate" and after). Milestone 4 was
built in the same session on the owner's instruction.

---

## Milestone 4 — Act II: the Factory (1.5–5 h)

New thinking: **ratios and power**.
- **Power**: coal miners, boilers and steam engines, then electric poles and generators.
  kW per machine, proportional brownouts, a power panel with demand vs. supply.
- **Tier 2 items**: steel (iron + coal), glass (sand), circuits (wire + plastic), plastic
  (oil, later). About 12 new items, each with its flavor text.
- **Machine modes**: Efficient, Overclocked, Precision. **Mk2 machines** with 2×2 footprints.
- **Byproducts as inputs**: slag → gravel → concrete; the first zero-waste S-grade lines.
- **Overdrive** clicking (`DESIGN.md` §15).
- **Customers**: Unit 7 (the codex begins) and Dame Voltaire, each with a reputation track
  and alternate recipes.
- **Parts costs for stamps**: Machine Kits made by your own lines.
- **Deposit claims vs. depletion**: decide, with a `DECISIONS.md` entry, then build it.
- **Diagnostics**: the flow overlay (belt saturation heat map) and the line report in plain
  English.
- **Megaproject #1, stage 1** (the Great Drill) as the Act II goal, built to persist across
  resets (needed by Milestone 5).
- Factory-floor folding: fold a group of modules into a depth-2 module (the District
  placement itself comes in Milestone 7).

Exit: a fresh save reaches the first sensible Reorganize point (`DESIGN.md` §16: about 5 h) with
the planner bot; rules 1, 2, 4 and 5 hold for 0–5 h.

## Milestone 5 — Reorganize, layer 1 (5–15 h)

New thinking: **when to reset, and what to keep**.
- The Reorganize flow: a preview (Patents now, Patents at the next ×2), confirmation, and what
  is kept (blueprints, codex, megaprojects, reputation) vs. lost.
- **The Patent tree** (~30 nodes): head starts (start with miners placed), rules (bigger fold
  box, +1 port per module), automation (auto-stamp the cheapest module, auto-fill standing
  orders) and offline efficiency up to 75%. No bare "+X% everything" nodes.
- **Blueprints**: save any Workshop layout; place it as a ghost that builds when affordable;
  share strings (compressed, versioned).
- **Auto-builders**: a blueprint drone that builds ghosts (the pillar-2 reward for layer 1).
- **The Committee** customer (rare components, weird orders).
- Megaproject #1 complete-able across 2–3 runs.

Exit: the bot's runs 2 and 3 pass run 1's peak in ≤ ⅓ of its time (rule 3); the first reset is
worth taking at 4–6 h, and not taking it still progresses (rule 6).

## Milestone 6 — Idle and offline, finished

- Offline efficiency upgrades; a 7-day cap (the slice had 24 h).
- The full offline report: a timeline of jams and orders, with an option to stop lines that
  would jam (so the player can make their factory "safe for overnight").
- **Inspiration** clicking (`DESIGN.md` §15).
- Notation settings (standard, scientific, engineering, letters) and a number-readability pass.
- Background-tab behaviour: the sim keeps running at reduced cost, Sparks pause, and there's no
  catch-up stutter on return.
- Save robustness: autosave every 30 s, three rolling backups, export/import, corruption
  recovery.

Exit: 8 h offline at every stage from 1 h to 15 h matches rule 4's ratios in the pace tests;
closing and reopening never loses more than 30 s of progress.

## Milestone 7 — Act III: the District (15–40 h)

New thinking: **composing modules**.
- **The District floor** (depth 2), built from depth-2 modules.
- **Logistics**: drones between modules on the District (no trains: the not-list), with a
  per-route throughput readout.
- **Tier 3 items**: robotics, chemicals, motors, and the first absurd products (the Autonomous
  Sandwich Engineer). About 20 items.
- **Recycling and Byproduct** modes.
- Megaprojects #2 and #3 (the Floating City, the Scrap Transmuter).
- **Scenarios v1** (unlocked by the first Reorganize): Tiny Island, Rich Ore / Little Power,
  Scarce Belts. Each with its own best-grade record.
- **Challenges v1** (5) with permanent rewards.

Exit: rules 1, 2 and 5 hold to 40 h for the planner bot; a District with 20+ modules runs
inside the performance budget.

## Milestone 8 — Second gate: the 40-hour review

`idle-critic` plays the Act I–III arc with fast-forward and saved checkpoints (1 h, 5 h,
15 h, 30 h, 40 h). It answers: does each act change how you think, is there dead air, does
reset 3 feel different from reset 1? `pacing-auditor` runs the 40-hour pace sim. The owner
plays from the 15 h checkpoint. Mark it passed here, or change the model.

**Gate status: not reached.**

## Milestone 9 — Act IV: Worlds and Relocate, layer 2 (40–80 h)

New thinking: **adapting to biome rules**.
- **The World floor** (depth 3).
- **Relocate**: the Legacy currency and tree. Legacy automates layer 1: auto-reorganize rules
  ("reset when Patents gained ≥ X"), contract runners, auto-unfold-and-regrade.
- **Biome worlds** (4): the Island (land ×0.5), the Volcano (free heat, belts degrade), the
  Frozen Moon (machines need heat), the Ruins (broken machines to repair, with free layouts to
  discover).
- **Tier 4 items**: exotic alloys, Pocket Weather, the Portable Sunset Generator.
- Megaprojects #4 and #5.

Exit: rules hold to 80 h in the pace sim; each biome's best-grade record is beatable with a
layout that wouldn't work in the others.

## Milestone 10 — Act V: Beyond and the Last Fold, layer 3 (80–100+ h)

New thinking: **bending the rules themselves**.
- **The Last Fold**: fold the World into one tile; the Kernel currency; the new universe
  starts with that tile as its first machine.
- **The Kernel tree**: base-rule changes (an extra port, a fifth floor, belts that move two
  items per tile, a new recipe table).
- **Infinite orders**: a scaling series with cosmetic milestones, never ending.
- **Tier 5 items**: impossible inventions with sprawling trees (the final codex entries).

Exit: a player at 100 h still has a next goal under rule 1; the pace sim reaches the first Kernel
spend at 80–100 h.

## Milestone 11 — The long tail (60 h+)

- **The Trophy Shelf**: 150+ achievements, each with a small, specific bonus, plus hidden ones.
- **The Codex**: completion, lore pages, Unit 7's ending.
- **Challenges** to 15, **scenarios** to 8.
- **Cosmetics**: machine skins and decorations from reputation and challenges. A
  photo mode that exports a PNG of a floor.
- **Efficiency boards**: personal bests per scenario (output per tile, per kW, waste).
  Local only; a public board stays in `IDEAS.md` until there's a reason for a server.

## Milestone 12 — Sound and juice

Procedural audio and a jsfxr bank: the click, the crank, belts, each machine family, a fold
(the signature sound), an audit chime per grade, Sparks, orders, a reset. Screen-feel: a fold
animation, coin pops, pip transitions. Mute, volume, reduced motion.

## Milestone 13 — Onboarding, UX and accessibility

Lesson cards triggered by events (the first starved machine, the first slag jam, the first
fold), tooltips with rates everywhere, keybinds, UI scale, colourblind-safe pips (shape as
well as colour), and a "where am I stuck?" button that names the current bottleneck.

## Milestone 14 — Balance, performance and release

- The pace sim plays the whole game to 100 h on every push to main (headless, compressed via
  modules); `pacing-auditor`'s report is clean.
- Performance: 200 modules per floor and a dense 16×16 Workshop at 60 fps on a mid laptop;
  save size under 200 KB.
- README, an itch.io page, GitHub Pages at the final name, a desktop build (Electron, as in
  Pegwork) if wanted.
