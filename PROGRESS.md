# Progress

What exists, what is stubbed, what is next. Updated at the end of every session.

## Status (2026-10-20): Milestones 0–2 built, the Milestone 3 gate passed with conditions, Milestone 4 (Act II) built and reviewed

The owner asked for Milestones 0–4 in one autonomous session. Milestones 0, 1 and 2 are built.
The critic's Milestone 1–2 review and the Milestone 3 gate reviews (idle-critic: pass with
conditions; pacing-auditor: fail on three checks) have been acted on (DECISIONS.md); every Act I
pace test passes again. The slice now ends with Bramble's Gizmo Festival. Act II's sim, UI and
art are in, its bot plays from the slice end to the Great Drill's stage 1 (~3:52), and the
critic's Milestone 4 review has been acted on (DECISIONS.md, "The Milestone 4 review").

### What exists

- **Engine** (`src/engine/`):
  - the 20 Hz fixed-step loop with fast-forward;
  - input;
  - saves (v4) with ordered migrations and `FW1.` export strings;
  - procedural audio;
  - `Num`, the big-number type.
- **Sim** (`src/sim/`, pure, deterministic, seed + commands replay exactly):
  - **The Workshop, item by item:** miners, belts, smelters, presses, assemblers, the Hand
    Furnace (crank, then Bellows), Slag Heaps, splitters, mergers, crates.
  - **Economy and events:** the Dock and Bramble's orders; the Hopper and research; Sparks
    (Lucky Vein; the Inspector, which pays in kind); statistics; trophies.
  - **Folding (§10):**
    - the 70 s audit with ports, U/W/C and the grade (S+ to D), plus a projected grade while it
      runs; up to three audits at once; stock already in the box taken off its outputs;
    - plain-English advice from the whole window on every grade, each line with its worth;
    - Fold, Stamp (priced per product), Unfold; a module is two kinds of machine or a chain.
  - **The Factory floor (§11):** modules as rate functions on 8/s trunks, byproducts out of a
    side trunk, the Factory Dock and Hopper; the slice ends when the Gizmo Festival (400 Gizmos,
    Factory Dock only) is filled.
  - **Offline v1 (§12):** an hour replayed in full, the rest extrapolated at ×0.5, the first jam
    and the next heap to fill reported, background-tab time counted.
  - **Act II (§18):**
    - power grids (poles, boilers and steam engines, generators, proportional brownouts, fuel by
      load);
    - Mk2 2×2 machines at 4×, the modes (Efficient, Overclocked, Precision), Overdrive (the
      clicked machine's whole line, or a module and every module trunked to it);
    - deposit claims and the Survey Office; Machine Kits for stamps (the parts bank);
    - Unit 7 and Dame Voltaire with their orders and reputation rewards, the Codex;
    - the Megaproject Bay with the Great Drill's stage 1 (+50% to miners and modules with
      miners inside);
    - nested folds (depth 2, a chain of modules inside the box) on the Factory floor;
    - power never crossing a fold box.
- **Data** (`src/data/`):
  - 24 items (12 of them Act II), 21 recipes, 26 research nodes on two tree pages, 3 customers,
    8 orders, 6 land chunks;
  - claims prices, megaprojects, sparks, trophies, rules and the gazette;
  - every number with a derivation naming a DESIGN.md section (tested).
- **Render and app** (`src/render/`, `src/app/`):
  - **The full-screen HUD the owner asked for:** a ticker, a left column (goal, coin,
    production), a right store column, a bottom bar with floor tabs and menus.
  - **Full-screen menus:** research tree, orders, stats, trophies, options, modules, the grade
    card with its stamp, the offline card, the slice-end card.
  - **Workshop and Factory renderers:** water and shore backdrop, the flow heat map, fold boxes,
    coin pops, confetti.
  - Act II's UI: store tabs, power visuals, the Megaproject panel (the Great Drill under
    construction, per-item meters and ETAs), the research card, Factory Overdrive glows.
  - Juice: up to three audit badges with countdowns, the S+ card (rays, gold-leaf rain, fanfare),
    the paper fold animation, the first-Miner fountain, the Bellows card, line and group
    Overdrive bursts, the Festival walked through in the goal card, the Gizmo parade and the
    slice-end celebration card, coin cascades on every order, banners for Codex firsts, the first
    Mk2 and each reputation level.
  - **Bramble's Town** on the water around both floors, growing as orders are filled (houses, the
    boardwalk, lamps, festival stalls and frogs, Unit 7's observatory, Voltaire's pavilion).
  - The camera fills the view at an integer zoom and pans.
- **Art** (`src/art/`, drawn with the pixel-art-studio scripts in `pixel-art/`):
  - every Act I and Act II machine and item, tiles, ore, portraits (with cheer frames);
  - the UI 9-slices and icon atlases (29 icons + 4 research icons), the Megaproject Bay and the
    Great Drill's 10-frame build, Overdrive glows, the S+ grade, the fold animation, the audit
    stopwatch, the research lab scene, the town (8 sheets), the logo.
  - PixelLab is not used yet (the owner's call).
- **Tests** (`npm test`):
  - Num, engine, data validation, purity;
  - the Workshop sim, folding and the Factory floor, Act II (`tests/act2.test.ts`);
  - the pace suite (`tests/pace-*.test.ts`, bots under honest limits, §13 checks 1–12, all
    green), and the Act II bot's suite (`tests/pace-act2-run.test.ts`: steel, power, circuits,
    Concrete, the Great Drill, rules 2 and 4, Patents; rule 1 while the Bay fills is todo).
- **Harness** (`e2e/`): `screens` (overlap audit at three sizes), `shots`, `smoke` (the fold
  flow by mouse), `bot`, `perf` (0.013 ms a tick on a dense floor), `look` (named states).

### Measured (planner bot, 50 seeds)

Bellows 0:21 · first Miner 0:47 · Pressing 1:47 · chunk B 9:20 · first Gizmo 16:13 ·
Folding 23:19 · first fold 24:35 · slice end (the Festival) 31:43, 8:23 after Folding ·
greedy's longest dead air 171 s · Dock-only 9.1 min behind · 8 h offline = 3.97 h of active
rate, 0.59 of staying open idle. Act II (two seeds, from the slice end ~0:31): steel 0:49,
power 0:57, circuits 1:26, Concrete fold 1:37, Great Drill stage 1 3:52; active/idle 1.7–1.8×;
longest gap between decisions 6 min; 14 Patents at 5 h (divisor 2,500, formula reopened).

### Stubbed / not done

- Act II pacing: rule 1 fails for ~40 min while the Megaproject Bay fills; coin piles up with too
  few sinks (~1.8M at 5 h); the bot doesn't use nested folds yet; its Bay floor is hand-laid.
- Owner decisions waiting (DECISIONS.md "Flagged as derivative"): power, machine modes, Machine
  Kits, the Megaproject's theme. The Patents formula is reopened for Milestone 5.
- The owner's evening of play for the Milestone 3 gate.
- Milestones 5+ are not started (Reorganize, District, Relocate, the Last Fold).

### Next

The owner plays the slice and Act II and rules on the flagged items. Then Milestone 5
(Reorganize): its Patents formula, coin sinks for Act II's late hour, and rule 1 while the Bay
fills.

### Start here next session

- **Live build:** https://ycgnem.github.io/foldworks/ (deployed from `main` by the Pages
  workflow on every push). Local: `Play.bat`, or the dev server on port 5210.
- **Last commit:** "Milestone 4: the critic's review acted on, Act II's bot to the Great
  Drill, Bramble's Town". Tests: 412 passed, 1 todo (rule 1 while the Bay fills, in
  `tests/pace-act2-run.test.ts`). `npm run screens` is clean at all three sizes.
- **Bots:** `src/sim/bot.ts` plays Act I to the Gizmo Festival (planner, greedy, Dock-only);
  `src/sim/bot2.ts` takes over at the slice end and plays Act II to the Great Drill (its Bay floor
  is hand-laid in `BAY_PLAN`).
- **Waiting on the owner:** the evening of play (the Milestone 3 gate), and the derivative flags in
  DECISIONS.md (power, machine modes, Machine Kits, the Megaproject).
- **Proposed follow-up:** "Act II late hour: goals while the Bay fills" (rule 1, coin sinks, the
  bot using nested folds). Milestone 5 waits for the owner's review.
- **Art:** pixel-art-studio scripts in `pixel-art/` (`ui`, `m4`, `m5`, `town`, ...); PixelLab not
  used yet (the owner's call); never SpriteCook.
