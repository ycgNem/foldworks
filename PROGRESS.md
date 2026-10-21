# Progress

What exists, what is stubbed, what is next. Updated at the end of every session.

## Status (2026-10-21): the 180 (text and HUD turned away from Last Watt) and the ore revamp

The owner: the ores made the game look bland, and "all the text in this game mirrors" Last Watt
(their tower defense, `Documents/candlepower`, grown from the same engine layer): "do a 180 to that
game's format, revamp completely". Asked how far, they picked **text and the whole HUD**, then
"make all the rest of the decisions by yourself and run autonomously then commit". Built on
branch `hud-180` by agents in worktrees in two phases (fonts, kit, art, words; then the screen,
the wheel, the book's pages, the fold's paperwork), merged and integrated by the lead.
DECISIONS.md: "The ore revamp" and "The 180: text and HUD turned away from Last Watt". The plan
and every rule: `docs/hud-180.md`. The look: STYLE.md "UI: paper and ink".

### What this session added

- **The ores** (`pixel-art/revamp/ores.py`, `src/render/orefx.ts`): outcrops instead of square
  patches (each ore its own rock and colour, a spill tile around the edge, glints), redrawn after a
  first pass read iron as steel crates and copper as a tomato bush. The title scene got the new iron
  outcrop under its miner.
- **Three fonts drawn for Foldworks** (Reed, Bullfrog, Pip), **ink on paper** colour roles with a
  contrast test, **rich text** (icons, keycaps, coin chips, colour spans, status chips inline) and
  **the paper kit** (tags on strings, speech bubbles, ribbons, the ledger book, stamps, paper
  meters and buttons), 29 pieces of UI art and **the Inspector's portraits**. PixelLab: 0
  generations.
- **The words**: blurbs became icon equations and rows; every goal is a line in a character's
  mouth (Bramble, the Inspector, Voltaire, the Committee, a customer) with its bar and chips; land
  chunks have names.
- **The screen**: no top strip, no hotbar. The floor runs edge to edge; **the Purse** (top-left) is
  the one loud number; **the trouble bell** under it; **the lift** (W/F) top-right with **slips**
  under it; **the speaker's corner** bottom-left with the toolbox; **the notebook and the Gazette**
  bottom-right. **The floor carries the numbers**: tags on the Dock (coin/min, the order, what
  flows in), the Hopper (node, %, what flows in), grids and the Bay; land for sale on signs.
  **Reports are tags** on strings, pinned ones docked at the side.
- **The Workbench Wheel** replaces the build bar: a right tap, `Q` or `Space` opens it at the
  cursor; petals fan their items. Zoom out moved from `Q` to `Z`.
- **Every page is the ledger book**: research in pencil, a statistics ledger, a trophy sticker
  page, a drawn keyboard on a new Keys page, Unit 7's Codex of pinned specimens, deed slips for
  claims, orders in customers' bubbles, the Patent Office, the Drawer's folded cards, Reorganize as
  the Committee's contract, the offline report as a letter from Bramble, the overnight forecast on
  the Inspector's clipboard, the grade as a red rubber stamp on his report.
- **World doors**: Unit 7's observatory opens the Codex, Voltaire's pavilion the orders.
- **e2e**: the harness drives the new screen (the wheel by mouse in `smoke`, `01b-wheel` in
  `shots`, the Keys and Gazette states in `screens`); new `e2e/wheelcheck.mjs` and
  `e2e/gallery.mjs` (the kit gallery, `gallery.html`, dev only).

### Measured

No sim, data number or save changed (saves still v7; the sim and its tests untouched apart from
strings the app reads). `npm test` 38 files, 662 passed and 1 todo (the pace suite reads as before: run 1 resets at 4:21-4:24 for 14 Patents on both seeds, run 2 passes run 1's peak at 0:16 / 0:27); `npm run screens` clean at three sizes; `npm run smoke` green (the wheel by mouse included); `npm run shots` reaches every moment.

### Open

- **Pause (`P`)** is bound but still does nothing (as before the 180).
- **Some sim strings are still prose** (pinned by sim tests); the app shows them as chips and tips.
  Turning them into data the app writes would let every one go into rows.
- **Voltaire's Boiler goal also shows on the Factory floor** (the goal chain, pre-existing).
- **Derivative flags for the owner** (DECISIONS.md, the 180's list): the radial build menu, the
  mascot's speech corner, diegetic menus, the headline, the alert bell, edge arrows, pinned tips
  (genre conventions) and **the red rubber stamp** (Papers, Please's look; here it only reveals a
  computed grade).
- The earlier session's open items below still stand (rule 3 run 3, rule 4 on Overdrive, the Bay
  stretch, coin after ~7 h).

### Start here next session

- **Branch:** `hud-180` is merged into `main` locally; **not pushed**, so the live build still
  shows the old screen until `main` is pushed.
- **Tests:** `npm test`; `npm run screens`, `npm run smoke`, `npm run shots` (set `BASE` to point
  at another dev server than 5210). Don't edit `src/` while an e2e script runs: Vite reloads the
  page and the run dies with "Execution context was destroyed".
- **UI code:** the kit in `src/ui/` (`font.ts`, `theme.ts`, `rich.ts`, `paper.ts`) and
  `src/app/chrome.ts`, `widgets.ts`; the screen in `layout.ts`, `hud.ts`, `topbar.ts` (the Purse,
  the bell, the lift), `rail.ts` (the speaker's corner), `gazette.ts`, `floortags.ts`, `tags.ts`,
  `wheel.ts`; the pages through `menuTemplate`.
- **Art:** `pixel-art/hud180/` (`python build.py`), `pixel-art/fonts/sheet.py` for the contact
  sheet.
- **Next:** the owner's look at the new screen, then the open items above and Milestone 7.

## Earlier status (2026-10-20, session 2): Milestones 5 and 6 built and reviewed, the UI redone, the art revamped (Lantern Bayou)

The owner asked for Milestones 5 and 6, a complete art revamp with PixelLab (up to 1,000
generations), and a UI redo ("crowded but not in a good way"). Built in parallel tracks on branch
`m5-m6-revamp` (agents in worktrees, merged by the lead), reviewed by the idle-critic and the
pacing-auditor, and revised in a review round (DECISIONS.md: "The UI redesign", "Milestone 6",
"Milestone 5", "The art revamp: Lantern Bayou", and the three "review round" sections).

### What this session added

- **The UI redesign** (`docs/ui-redesign.md`): a thin top bar (the coin counter as the one loud
  number, Kits, power, Patents, the line-health chip, floor tabs, icon menus), floating Goal /
  Order / Research / Megaproject cards, a centred build bar (category tabs over slots, a rich hover
  card), toasts and the pinned report on the right, the Gazette as a bottom crawl, the floor at
  ~80% of the width. Two panel weights: calm code-drawn plates for the HUD, the ornate frame only
  for full-screen menus and celebrations, which all use one template (`menuTemplate`). An order
  flag over the Dock and a research ring over the Hopper. All the juice kept.
- **Milestone 5, Reorganize** (DESIGN.md §19): the Reorganize card (gain by term, keep, lose,
  goals that raise it); **Patents are filed, not re-earned** (each product's best value = steps
  folded x grade x rate tier, paid only for the rise over the record on file, plus the Great Drill
  term and a minor term for the bills standing and running); the Patent tree (29 nodes, 40
  Patents: head starts, rules, automation, offline); **the Patent Drawer** (keep folded designs
  through a reset, unfold them whole for their bill; the Draughtsman unfolds a queue; FWD1 share
  strings) in place of blueprint ghosts and drones; **the Committee** (three raccoons in a coat)
  whose reputation opens the Great Drill's stages 2 and 3 (completable across three runs); **the
  Factory annex** (coin buys Factory-floor land at linear prices: the coin sink, and the coin chains
  keep running beside the Bay floor). The campaign bot plays three runs and spends Patents.
- **Milestone 6, Idle and offline** (DESIGN.md §12, §20): time away up to 7 days; offline
  efficiency 0.5, +0.1 from the coin Night Shift (kept through resets), +0.15 from Patents (0.75
  cap, refusals at the cap); offline run in segments that end when a heap fills, the Bay is
  satisfied, an order fills or research finishes; the report as a timeline grouped by line (cause
  and fix, jump-to); **safe for overnight** (a headless forecast with Stop line / machine, a logged
  command); **Inspiration** (clicking a Hopper credits research, capped at 30% a node); notation
  (standard, scientific, engineering, letters) and one number helper; the background tab keeps the
  sim running cheaply with no catch-up stutter; autosave every 30 s plus on hide/unload, three
  rolling backups, corruption recovery. Saves are v7.
- **The art revamp: Lantern Bayou** (STYLE.md): a new 48-colour palette (every `C` slot name kept);
  3/4-view machines with four facings and work animations, on steel base plates so they read on the
  plank deck; PixelLab terrain (deck, water, shore, ore), hand-drawn items, a new Dock and Hopper,
  portraits (the Committee new; Bramble, Unit 7, Voltaire redrawn), the town, FX and Sparks, the
  Megaproject and research pictures, UI art, and a title key-art scene. **PixelLab: 241 of the
  1,000 generations** (81 style test, 157 the revamp, 3 the title); no USD credit spent.

### Measured (seeds 1000 and 8919, after the final round)

Act I unchanged (DESIGN.md §13). **Reorganize**: run 1 resets at 4:24 / 4:21 for 14 Patents (peak
14.8K / 14.3K coin/min); run 2 at 3:02 / 2:50 for 7 (peak 21.1K / 21.2K); run 3 plays to its 4 h
cap (card 9, peak 21.4K / 21.2K). The Great Drill reaches stage 1, 2, 3 after runs 1, 2, 3 on both
seeds. **Patents per hour** (seed 1000, 7:26): the designed run 2.83; reset loops at every slice
end 1.21, every hour 1.08, every 2 h 1.35; a coin-burning loop 0.40; a brownout farm of 239
refineries adds 0.09. Overdrive never reaches an audited machine. **Rule 3**: run 2 passes run 1's
peak at 0:27 / 0:16 (limits 1:28 / 1:27). **Rule 2** (Sparks and belt relays not counted): 12.4-12.5
min up to the Bay floor. The bot buys claims and annex blocks (all three annex blocks before the Bay
floor in later runs) and keeps 7 designs in the Patent Drawer, unfolding 5 a run (5-6 refold after
the 10 s check). **Offline**: 8 h measured at every stage to ~14 h of play (runs 1-4); it pays
0.56-0.61 of open idle at efficiency 0.5 and 0.78-0.81 at 0.75; check 12 holds everywhere. Saves
lose at most 30 s.

### Open (decisions for the owner, with the measurements)

- **Rule 3, run 3 vs run 2**: run 3 only matches run 2's peak (it passes at 1:22 against a 0:56-1:00
  limit, both seeds). Not claims (the bot buys them now): both runs fill the same room (the 12x8
  floor and three annex blocks). Levers: keep the annex through a Reorganize (a reset-layer
  change: the owner's call), or more room/depth in later runs (nested folds, the District).
- **Rule 4's floor sits on Overdrive's duty cycle**: (10 s x 3 + 30 s) / 40 s = 1.5x exactly, so
  stages where clicking is all there is read 1.48-1.49 (six of 26 stage readings, plus run 4 at
  1 h, 0.97-0.98, the Bay floor rebuild; `RULE4_OPEN`). The floor was not lowered (the critic: that
  would be tuning the test). A 25 s cooldown was tried and rejected (it broke rule 1 before the
  Bay floor and rule 3 on seed 8919).
- **Rules 1 and 2 while the Megaproject Bay fills**: 27-48 min between goals; the plan has nothing
  left to buy then (the `it.todo` in `tests/pace-act2-run.test.ts`). Needs content in that stretch
  (the critic's suggestion: the Bay as a throughput puzzle with its own goals).
- **Coin piles up again after ~7 h** (passes 2M by 11 h), and a fourth run files about 1 Patent:
  everything is on file and the Drill is done. The tree (29 nodes, 40 Patents) is 30/40 bought by
  9.9 h. Both want the next floor's content (Milestone 7, the District).
- **Derivative flags waiting for the owner** (DECISIONS.md, each new section's "Flagged as
  derivative"): the Patent tree's shape (Cookie Clicker's heavenly upgrades, Antimatter
  Dimensions' trees), the automation nodes (autobuyers), the Founders' Grant (start with X coin),
  FWD1 share strings (blueprint strings), the Reorganize card (Ascend / Big Crunch screens), the
  annex (a genre convention), the UI's genre conventions (hotbar, top bar, tabbed menus), and the
  line-health chip (Factorio's alerts). Removed after review: blueprint ghosts and the Builder
  Dragonfly (Factorio's construction robots), Raccoon Bearings (a new currency).

### Start here next session

- **Branch:** everything is on `m5-m6-revamp` (not merged to `main`, so the live build at
  https://ycgnem.github.io/foldworks/ still shows Milestone 4). Local: `Play.bat`, or the dev
  server on port 5210.
- **Tests:** `npm test` 37 files (the pace suite takes ~6-8 min); `npm run screens` clean at three
  sizes; `npm run smoke` green; `npm run shots` reaches every moment.
- **Bots:** `src/sim/bot.ts` (Act I), `src/sim/bot2.ts` (Act II), `src/sim/campaign.ts` (runs
  1-4 with Reorganize, Patents, claims, annex and the Drawer).
- **Art:** `pixel-art/revamp/` builds everything in Lantern Bayou (STYLE.md lists the order);
  PixelLab log in `pixel-art/revamp/prompts.md` (241 generations used of the 1,000 allowed).
- **Next:** the owner's calls above, then Milestone 7 (the District).

## Earlier status (2026-10-20, session 1): Milestones 0–2 built, the Milestone 3 gate passed with conditions, Milestone 4 (Act II) built and reviewed

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

### Where session 1 left off

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
