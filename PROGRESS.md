# Progress

What exists, what is stubbed, what is next. Updated at the end of every session.

## Status (2026-10-20): Milestones 0–2 built, the Milestone 3 gate passed with conditions, Milestone 4 (Act II) nearly done

The owner asked for Milestones 0–4 in one autonomous session. Milestones 0, 1 and 2 are built.
The critic's Milestone 1–2 review and the Milestone 3 gate reviews (idle-critic: pass with
conditions; pacing-auditor: fail on three checks) have been acted on (DECISIONS.md); every Act I
pace test passes again. The slice now ends with Bramble's Gizmo Festival. Act II's sim, UI and
art are in; its bot reaches circuits but not yet the Great Drill (being finished).

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
    Overdrive bursts, the Festival walked through in the goal card.
- **Art** (`src/art/`, drawn with the pixel-art-studio scripts in `pixel-art/`):
  - every Act I and Act II machine and item, tiles, ore, portraits (with cheer frames);
  - the UI 9-slices and icon atlases (29 icons + 4 research icons), the Megaproject Bay and the
    Great Drill's 10-frame build, Overdrive glows, the S+ grade, the fold animation, the audit
    stopwatch, the research lab scene, the logo.
  - PixelLab is not used yet (the owner's call).
- **Tests** (`npm test`):
  - Num, engine, data validation, purity;
  - the Workshop sim, folding and the Factory floor, Act II (`tests/act2.test.ts`);
  - the pace suite (`tests/pace-*.test.ts`, bots under honest limits, §13 checks 1–12, all
    green), and the Act II bot's suite (`tests/pace-act2-run.test.ts`, 3 checks still todo).
- **Harness** (`e2e/`): `screens` (overlap audit at three sizes), `shots`, `smoke` (the fold
  flow by mouse), `bot`, `perf` (0.013 ms a tick on a dense floor), `look` (named states).

### Measured (planner bot, 50 seeds)

Bellows 0:21 · first Miner 0:47 · Pressing 1:47 · chunk B 9:20 · first Gizmo 16:13 ·
Folding 23:19 · first fold 24:35 · slice end (the Festival) 31:43, 8:23 after Folding ·
greedy's longest dead air 171 s · Dock-only 9.1 min behind · 8 h offline = 3.97 h of active
rate, 0.59 of staying open idle. Act II (two seeds, from the slice end ~0:31): steel ~0:50,
power ~0:56, circuits ~1:21.

### Stubbed / not done

- Act II pacing: the bot stalls before Concrete and the Great Drill (the Factory floor is full
  of the slice's Gizmo chains); rule 1 and rule 4's 1.5× floor are todo tests. Being finished.
- The owner's evening of play for the Milestone 3 gate.
- Milestones 5+ are not started (Reorganize, District, Relocate, the Last Fold).

### Next

Finish the Act II bot (Concrete, nested folds, the Great Drill, Factory Overdrive for rule 4),
then the Milestone 4 critic review and its fixes; commit and push.
