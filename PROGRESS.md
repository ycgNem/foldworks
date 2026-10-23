# Progress

What exists, what is stubbed, what is next. Updated at the end of every session.

## Start here (2026-10-22): every milestone built, on `main`

Milestones 0-14 are built and merged into `main` (pushed 2026-10-22). Acts I-V, all three reset
layers (Reorganize, Relocate, the Last Fold), the long tail (205 trophies, the Codex and Unit 7's
ending, 15 Challenges, 8 scenarios, 41 skins, photo mode), sound, onboarding, and release work
(60+ fps on every full floor, ~31 KB saves, CI, the README). Every decision and its reason is in
DECISIONS.md; every number's derivation is in DESIGN.md.

### Play it
1. Double-click **`Play.bat`** (it uses the portable Node, installs on the first run, and opens
   http://127.0.0.1:5210). The first load takes 40-90 s: the dev server serves ~1,050 files.
2. A new game starts at Act I. **To start at 15 h** (the second gate's checkpoint: run 3, a District
   of 108 pieces, 46.3M coin): Options -> **Import save**, and paste the whole of
   **`docs/checkpoint-15h.txt`** (one line). The 1, 5, 30 and 40 h checkpoints the bots write are in
   `e2e/out/checkpoints/` on this PC (not in the repo; the old format, which still loads).
3. Keys are on the Options -> Keys page (rebindable); `G` or **Stuck?** finds what is stopping you;
   `H` or **Photo** is photo mode.

### Owed to the owner
- **Play from the 15 h checkpoint**: the second gate's condition (ROADMAP.md Milestone 8).
- **Listen**: the mix and ambience (Milestone 12) were never heard by anyone.
- **Decide the derivative flags** (each "Flagged as derivative (owner to decide)" list in
  DECISIONS.md). The largest debt is Factorio's, as one set: the tier 3 chemistry, wide belts and
  islands with rules (Rime was already re-derived away from Space Age's Aquilo). Also: the Legacy
  automation and the third layer (Antimatter Dimensions), infinite orders (shapez), alternate
  recipes (Satisfactory), trophy bonuses (AD, Cookie Clicker), efficiency boards (Zachtronics).
- **GitHub Pages** is already live: the deploy workflow (`.github/workflows/deploy.yml`) builds and
  publishes on every push to `main` (typecheck, the fast tests, the build). No itch.io page and no
  desktop build.

### What is measured and what is not
- **Measured by bots** (seed 1000): Acts I-III to 40 h (DESIGN.md §21 Pacing: the District at
  ~10 h, the Floating City's first stage by ~11 h); performance (§25: 92-193 fps, a full game's
  tick 0.9 ms); save size (§20); offline compute (~5 s for 8 h away).
- **Act IV opens when Act III's Megaprojects stand** (the City and the Transmuter: a decision of
  the last bot pass, because without it the World opened at 11:46 and the first Relocate came at
  18:00 against §22's 40-45 h). The bot builds the City's first stage and most of its second and
  the Transmuter's research, but **can't finish the two projects**: its Factory bench runs out of
  room for the last two groups (Sandwiches II, Coils II; both chains work when they fit). So **Act
  IV and Act V pacing is unmeasured** (model estimates in §22-§23), and the bot's longest Act III
  waits are 18-40 min (§16 wants 10). The next step is a sixth bot pass: room on the bench for
  those two groups, then re-measure the first Relocate and the island climb.
- **Estimated only**: everything from the World on (the first Relocate, the climb, the Last Fold,
  Beyond), and the new Challenges' goal times (§24).

### Where things are
PLAN.md (what and why), DESIGN.md (every number: §16 pacing rules, §21-§25 Acts III-V, the long
tail, performance), ROADMAP.md (milestones and the two gates), DECISIONS.md (every decision, the
derivative flags, both reviews), STYLE.md (the look), docs/endgame.md (the Act IV-V contracts and
the art as built), README.md (how to run, test and build). The status sections below are the
session-by-session history, newest first.

## Status (2026-10-22, late night): Milestone 11's screens, built

Built in a worktree off `m9-worlds` (the skin art merged in), app, UI and e2e code, the skin lookup
and the photo export in `src/render/` (`skins.ts`, `photo.ts`, and a dozen lines where the
renderer picks a building's, belt's, module's or carrier's sheet). DECISIONS.md "Milestone 11's
screens". **The Trophy Shelf** (`src/app/shelf.ts`): an index of nine groups with counts, the
group's stickers ("?" for hidden), the closest still to earn, the sticker in hand with its bonus,
**Bonuses** (every kind summed against its cap) and the **Wardrobe** (every kind a skin dresses,
wear one, what is still to earn); a trophy's ribbon says its bonus. **The Codex**
(`src/app/codexbook.ts`): Tiers I-V and the Lore (16 pages, open ones readable, shut ones with
their hint); **Unit 7's ending** has its own night-sky moment after the first Last Fold
(`src/app/ending.ts`). **Challenges** (`src/app/challenges.ts`): all fifteen by act with rule, goal,
reward, needs and progress, opened from the Reorganize card's strip and the Challenge slip (which
shows the goal's count); `SHORT` has real entries. **Scenarios**: eight boards, each board's
efficiency board (score, per tile, per kW, waste), the bests handed to the town with `boards` on the
way back, the older localStorage store retired into them. **Skins** drawn wherever the base sheet is
(Workshop buildings, belts, the Seed, the Dock and Hopper, modules on every floor, skiffs, barges,
couriers), worn from a building's report ("Skin: ..." key) or the Wardrobe. **Photo mode**: a
"Photo" key and H hide the HUD; Snap 1x/2x downloads a PNG of the whole floor. The wheel shows FREE
for a trophy's free building. Checks: `tsc` clean; Vitest (non-pace) 1241 passed; `npm run screens`
clean at three sizes with 21 new states (`TAIL` in `e2e/screens.mjs`, `tailSetup`); the shots'
long-tail section (20-27b) looked at; `node e2e/tailshots.mjs [w h] [state...]` shoots the long
tail's states alone. **Open:** no bot plays a Challenge or a Scenario board, so the boards' numbers
on screen are set by the e2e states; the ending's typing speed and Bonuses' order are first cuts.

## Status (2026-10-22, late night): Milestone 14's performance, save size and release

Built in a worktree off `m9-worlds` while Milestone 11's sim and data were built elsewhere: no
`src/sim/`, `src/data/` or `SAVE_VERSION` change. DESIGN.md "Performance (measured, Milestone 14)"
and §20 "Save size"; DECISIONS.md "Milestone 14".

### What exists
- **`npm run perf`** builds each floor at its worst (the dense 16x16 Workshop; the widest Factory,
  118 modules and 32 trunk tiles; every lot and 168 / 213 / 172 modules on the District, World and
  Beyond with 160-180 routes) and times the frame, the rAF rate and the tick, with `GPU=hw` or
  SwiftShader; `-- load` times a cold load. JSON in `e2e/out/perf/<gpu>.json`, a PNG per floor.
- **The frame, 4-6x cheaper with the same pixels**: baked 9-slices, strings and pips
  (`src/ui/bake.ts`), the high floors' flight lines as one baked layer per march offset
  (`src/render/district.ts`), the HUD's reset previews once a tick (`src/app/pertick.ts`). With the
  GPU: Workshop 13.8 → 2.4 ms a frame, Factory 15.3 → 4.0, District 25.3 → 5.0, World 23.1 → 5.1,
  Beyond 23.7 → 4.8 (see DESIGN.md for SwiftShader and the tick).
- **Packed saves**: slots `FWZ1.` and export strings `FW2.` (raw DEFLATE, `src/engine/deflate.ts`),
  old slots and FW1 strings still load; a late save is 25-33 KB (was 168-485 KB of JSON).
  `tests/savesize.test.ts` (the codec against Node's zlib, a full late game under 200 KB that
  round-trips), `e2e/saves.mjs` (packed slots, an old plain slot continuing, the size in the page).
- **Production build**: `npm run build` passes; a cold load of the preview is 6 requests, 0.66 MB
  transferred, 0.8 s to the title; `npm run smoke` passes against it. No atlas needed.
- **CI**: `.github/workflows/ci.yml` (typecheck, fast tests, build on every push and PR),
  `deploy.yml` (the same gate, then GitHub Pages on a push to `main`), `pace.yml` (the pace tests
  nightly and on demand, the checkpoints kept as an artifact). Nothing pushed.
- **README.md** rewritten for the whole game: the five acts, the three resets, controls, running
  it, the scripts, tests and e2e tools, the docs map, credits.

### Stubbed / not done
- Sim hotspots reported, not fixed (Milestone 11 owns `src/sim/`): `runFloor` in
  `src/sim/systems/high.ts` is 80% of a 0.9 ms tick with every floor full (DESIGN.md's
  Performance section has the proposed fixes). Under the 4 ms budget either way.
- Measured on a Ryzen 9 7945HX laptop under heavy load from other agents, not a mid laptop: the
  numbers carry a 2-3x margin for one. SwiftShader (no GPU at all) still drops the high floors to
  18-19 fps at 1920x1080: a machine without GPU canvas is outside the target.
- No itch.io page, no desktop build (the owner: no itch.io; DECISIONS.md "Milestone 14").
- GitHub Pages is live only once `main` is pushed and Pages' source is set to GitHub Actions.

### Next
Merge into `m9-worlds`; fix the sim hotspots after Milestone 11 lands; the pace sim to 100 h with
the Act IV and V bots.

## Status (2026-10-22, evening): the bots' fifth pass (Charting behind Act III's Megaprojects)

Built in a worktree off `m9-worlds` (5405898), time-boxed (3 h). DECISIONS.md "The fifth pass";
DESIGN.md §21 and §22 (Research, page 4; Pacing). Changed: `src/data/research.ts` (Charting's `megas`
only), `src/sim/bot3.ts`, `src/sim/bot4.ts` and the docs; no other data or sim number.

- **Charting needs the Floating City and the Scrap Transmuter complete** (decided): Act IV opens when
  Act III's Megaprojects stand. Tests and e2e setups already set both projects complete.
- **The bot builds toward both projects**: a Glassworks (Kiln on its own plant) and Glass II for the
  City's glass, a foldable Sandwich works and Sandwiches II for its sandwiches, the Scrap Transmuter
  research (batteries from the battery vat again, oil from a re-laid Plastic feed), a Coils corner line
  and Coils II, the Concrete II steel and Processors II processors to the District Bay; a full
  District still delivering to its Bay is not reset; a copy the Bay wants lifts a sell-only copy on a
  full floor; the servos feed is lifted while the late groups nest (its trunks walled the bench off
  from the Dock); slot lines fold only with their Chute inputs in stock (the circuit-less Servos
  design); a bearing press for the Sky Anchor; the Engineer and umbrellas after the projects.
- **The Relocate rule waits for the preview to stop rising** (45 minutes) or the World to stand full,
  not a flat 20 Legacy (decided; not exercised: no Relocate is reached).
- **Measured** (seed 1000, 40 h; pace-act3 7 passed, pace-act4 5 passed): the City's glass and rotors
  and the Transmuter's steel are delivered; its sandwiches and coils are not, so **no World and no
  Relocate by 40 h**. Rules 1-2 worse (pace-act4 up to 40.5 min, pace-act3 up to 19.1).
- **Next**: room on the Factory bench for Sandwiches II and Coils II (both chains worked in scratch
  runs when laid), the Coils line's rubber starvation, then re-measure the World and the first Relocate.

## Status (2026-10-22, afternoon): the bots' fourth pass (Relocation's chain; the first Relocate)

Built in a worktree off `m9-worlds`, time-boxed (3 h). DECISIONS.md "The fourth pass"; DESIGN.md
§21 and §22 Pacing (measured). Only `src/sim/bot2.ts` (a log), `bot3.ts`, `bot4.ts`, `campaign.ts`
and the docs changed; no data or sim number.

- **Relocation's whole chain is made, in the chemistry corner**: the corner's solvent vat keeps its
  sludge (Byproduct mode once Recycling is known) for Hydroponics, then feeds a fertilizer vat, a
  Greenhouse and a sandwich Assembler (Sandwiches, Sandwich Engineering), then an **Assembler Mk2
  Engineer line** (its battery vat behind a Splitter, processors from a Processors II Chute feeder,
  its own robot-arm chain), then umbrellas on a second Mk2. The third pass's "oil" was room: the
  Factory feeds' copies were dropped for no route (now logged, `Act2Bot.dropped`).
- **Measured** (seed 1000; pace-act4 40 h and once 60 h): Relocation researched **15:59**, the
  **first Relocate 18:00** (Home to Rime, 20 Legacy: the Purse, the Archive, the Clerk), the climb
  on Rime to its World in **4.6 h** (22:36), a second Relocate 29:18 (to the Old Works, 8 Legacy).
  Rules 1-2 per stretch 7.1, 6.0 and 7.8 min (were up to 19.9). Pace-act3 (the Act III-only
  campaign) got worse: 10.9, 19.9, 19.9 and 10.3 min (were 10.2-10.8), open.
- **Open**: the Old Works stops the Act I planner (ruins and rubble in Home's layouts: run 5 never
  reaches its slice end); the first Relocate is 22-27 h early against §22 and banks 20, not ~35
  (for the owner: DECISIONS.md); pace-act3's run 4 folded a Servos design without circuits and
  waited on Floating City (the full-floor reset now comes once a plan step has waited an hour; the
  cause is not found); the Factory's battery feed finds no room (the Lighthouse waits); floor bests.

## Status (2026-10-22, morning): the Act III bot's third pass (the idle windows; batteries)

Built in a worktree off `m9-worlds`, time-boxed (3 h). DECISIONS.md "The third pass"; DESIGN.md
§21 and §22 Pacing (measured). Only `src/sim/bot3.ts`, `src/sim/bot4.ts` and the docs changed;
no data or sim number.

- **The idle windows were the bot's**: the slot lines' output side-loaded into a corridor running
  full with the lab's banked goods, so they stood blocked and were given up (now two Buffer Crates
  in the output column); a standing line (the arms line) held the full-floor reset off for hours
  (no longer counted); the District now grows while the plan waits 20 minutes; a given-up line is
  retried once when research waits on its product; the Solvent line folds once research has its
  solvent; an empty Chute input gets a feeder; research nothing can pay is passed over.
- **Measured** (seed 1000, 40 h; pace-act3 7 passed, pace-act4 5 passed): Charting and the World
  at **11:46** (was 15:41), the World up to 63 modules (1.32 ms a tick); every Act III stretch
  10.2-10.8 min at worst in pace-act3 (was 68.7 and 324), pace-act4 at most 9.0 except one 19.9
  min in run 5 (was 154).
- **Relocation's chain, first links**: Copper ingots fold on chunk D's second copper patch and feed
  the Chute; Batteries research is paid and the Batteries line folds (12:28-12:36).
- **Open**: no Relocate. The Factory's Batteries and Solvent copies need oil, and their Plastic
  copies were not laid (coal claims, room or kits): the Lighthouse stands at 15 of 200 batteries,
  Hydroponics at 0 of 300 sludge; sandwiches, umbrellas (four inputs), the Engineer (Mk2, powered)
  and bearings for the Sky Anchor are not taught. Pace-act4's run 5 wait (19.9 min from 33:50) is
  not looked into.

## Status (2026-10-22, late night): the Act III bot's chemistry, the Act IV bot

Built in a worktree off `m9-worlds`, time-boxed. DECISIONS.md "The Act III bot's chemistry and
the Act IV bot"; DESIGN.md §21 and §22 Pacing (measured).

- **bot3.ts builds chemistry**: the lab's concrete corner becomes a powered chemistry slot (its own
  oil-fired plant inside the fold box); Solvent folds there (a sand Miner with the Chem Vat: the
  sand was never the wall), then Rubber and Processors (each with its own solvent vat); Sensors and
  Robot arms are chunk D lines; Factory feeds put oil, rubber, servos and sensors down the Chute;
  groups Rubber II, Processors II, Sensors II and Arms II; District folds (depth 3) by the floor's
  own refusal; chemistry never holds the District (an hour's wait ends it). Its District code
  takes a floor (`floorWork`), so the World runs by the same rules.
- **bot4.ts (new)**: Act IV research, the World (depth-3 copies, barges, lots), Relocate when it
  pays (`relocateTo`), Legacy in a priority, Old Habits, the Old Works' rubble; wired in
  `campaign.ts` as `act4` (opt-in), `tests/pace-act4.test.ts` (+ helpers; FOLD_ACT4_HOURS, default
  40).
- **Measured** (seed 1000, 40 h; `tests/pace-act3.test.ts` 7 passed and `tests/pace-act4.test.ts`
  4 passed, about 25 min each): the District at 10:01, the City's stage 1 at 11:33-11:41, Chemistry
  10:03 and Robotics 12:03 (run 3), up to 128-130 District groups (0.93-0.95 ms a tick), rules 1 and
  2 at 10.4-10.7 min in each Act III stretch but one (pace-act3's run 6: 18.8 and 17.3 min just
  after its hand-over, as before). Checkpoint saves regenerated by pace-act3.
- **Second pass** (after merging `m9-worlds`; DECISIONS.md "The second pass"): groups buy and
  save for the coal claims they wait on (the District stamps nothing new meanwhile), the oil feed is
  lifted once the corner's last line folds, a research drain sends the Hopper what the research
  wants from the Chute, Sensors and Robot arms are two-machine lines (a lone assembler can't fold),
  the arms line stands unfolded (Arms II never fit the bench), two Servos II feeds, a line's give-up
  clock stands while its Chute input is empty. **The campaign reaches District Folds 15:02,
  Charting and the World 15:41** (run 3), 4 District folds, 19 World modules (0.65 ms a tick).
  pace-act4 5 passed (40 h, 21 min), pace-act3 7 passed.
- **Open**: rules 1 and 2 got worse: a 69-min wait in the chemistry corner's first hour (11:07,
  waiting on Floating City research) and an idle of 2.5-5.5 h in a later Act III run (pace-act4
  run 5 from 37:25, pace-act3 run 4 from 25:42): not yet found (a 9-hour wait on "no design Gears
  II" is fixed). No Relocate: Relocation wants 3
  Sandwich Engineers and 20 umbrellas, and batteries, sandwiches and umbrellas are not taught (nor
  the Lighthouse's batteries). Runs 3-4 end at the 12-hour cap. Coal claims may be a number that
  blocks honest play (owner's call). The islands' layouts are untested; 80 h was not run.

## Status (2026-10-22, night): the second gate's fixes, Act IV's sim and islands, Act V's sim

Built on `m9-worlds` (not yet merged into `main`), autonomously, overnight. DECISIONS.md "The
second gate", "Milestone 9: Act IV's sim", "Act IV's islands on the Workshop", "Milestone 10:
Act V's sim", "Milestone 12".

### What exists
- **The second gate's fixes (Milestone 8)**: District skiffs carry 1 a trip at 40,000 coin (ship
  value, not bulk), 20 more routes a lot, the waste chute, depth 3 on the District, the Drill's
  boost in a route's want, Act III research and Megaproject bills cut to their derivations,
  Challenges re-goaled to things done this run with rewards that matter in Act III, and the
  District UI fixes (routes n/max on the strip, the starved report, the coach, skiff crowding).
- **Act IV's sim (Milestone 9)**: four islands (Pebble, Cinder, Rime, the Old Works) with their
  rules, tier 4, the World floor and its barges, Megaprojects #4 (the Lighthouse) and #5 (the Sky
  Anchor), Relocate and Legacy with its 17-node tree (`src/sim/worlds.ts`, `legacy.ts`,
  `islands.ts`, `relocate.ts`; tests/act4.test.ts).
- **Act IV's islands on the Workshop**: each island's ground and props, Pebble's sky chunks,
  vents, rubble (click to Clear), ruins (Repair), frost and the Heater, the island slip under the
  Purse, a lesson card per island.
- **Act V's sim (Milestone 10)**: the Last Fold (the whole-World audit and its reset), Kernels and
  the 10-node Kernel tree, the Seed, Beyond (couriers, depth 4), tier 5, the second cookbook, wide
  belts, the Endless Ledger (`src/sim/lastfold.ts`, `kernels.ts`, `systems/seed.ts`,
  `systems/ledger.ts`; tests/act5.test.ts). SAVE_VERSION 10.
- **Sound (Milestone 12)**: the mix, ambience per floor, reset stings, sound options.
- Act IV and Act V art (`pixel-art/act4`, `pixel-art/act5`), 0 PixelLab generations.
- **Act V's screens (Milestone 10's UI)**: Beyond on the lift (a four-point star key) with its
  night sky, `beyond_*` platform, couriers, depth-4 modules, lots, tool strip, reports and floor
  tags; the Last Fold (research page 5, the World's labelled "Last Fold" key, the audit slip under
  the tool strip, the grade card with the bank, kept and lost and the Kept Legacy picker, the
  two-click "Fold the World", the full-screen sequence with the third reset sound, the landing on
  the new universe); the Kernel tree page (Rules, Further, Kept); the Seed on the Workshop (side
  arrows in each ore's ink, ore chips on hover, a report with the labelled Turn button); the
  Endless Ledger page (the order, next in turn, the cosmetic shelf with skin previews); wide belts
  drawing their second item; tier-5 icons; lesson cards for the first Last Fold card, Beyond and
  the Seed; Act V states in `npm run screens` and shots 14-19 in `npm run shots`
  (`src/app/lastfold.ts`, `kernels.ts`, `endless.ts`).

### Stubbed / not done
- (Milestone 11's screens since: skins are worn from a report or the Wardrobe.) Beyond's
  Bay position stays empty (no Megaproject #6). Beyond's lots, tool strip and route cards are
  the District's widgets over `g.s.beyond`.
- No Act IV or Act V bot: Act IV and V pacing are model estimates (DESIGN.md §22, §23). The Act
  III bot is being re-measured under the gate's new numbers.
- The owner's own play from the 15 h checkpoint (the second gate's condition).

### Next
Merge the World UI, Act V's screens and the Act III re-measure; mark the second gate passed with
conditions; build the Act IV and Act V bots; Milestone 11's long tail (its sim and data being built);
Milestone 14 (pace to 100 h, perf, saves, README, GitHub Pages; no itch.io, no desktop build).

## Status (2026-10-22, night): Milestone 11's skin art drawn

`pixel-art/m11-skins/` (`python build.py`, 0 PixelLab generations) draws every cosmetic's sheets:
69 `src/art/skin_<id>_<base>` drop-in replacements (belts with their turn sheet, modules one per
floor, the Dock and Hopper decorations), the looks and `out/contact_skins.png`. The kind to base
sheet mapping the renderer lookup needs is in docs/endgame.md, "Milestone 11 skins as built".
**Open:** the renderer's lookup and the picker (another agent); a look at them in the game's own
screenshots once wired.

## Status (2026-10-22, late): Milestone 11, the long tail's sim and data, built

Built in a worktree off `m9-worlds`, sim, data, tests and docs only (the screens are another
agent's). DESIGN.md §24, DECISIONS.md "Milestone 11: the long tail's sim". **205 trophies** (18
hidden, "???" until earned), each with a small bonus of one of twelve capped kinds (`trules` in
`src/sim/longtail.ts`: a product's craft +5%, the first n of a building free, skiffs and routes,
Drawer slots, Spark life, heap room, start coin, Overdrive cooling, repairs, Chute room, a skin);
**the Codex**'s completion by tier and **16 lore pages** in Unit 7's voice, the last its ending at the
first Last Fold; **15 Challenges** (ten new across Acts II-IV, each wired through `ruled`/`won` and
the rule helpers at the foot of `systems/challenges.ts`); **8 Scenarios** (five new) and the
**efficiency boards** (bests per tile, per kW and waste, in `meta.boards`, handed to the town by the
`boards` command); **41 cosmetics** plus the Ledger's ribbons in one list, granted from reputation,
Challenges and trophies, worn with `{ k: 'skin', kind, id }`. `SAVE_VERSION` 11. Tests:
`tests/longtail.test.ts` (38) and the long tail's cross-references in `tests/data.test.ts`; the
slice pace tests and `pace-reorganize` pass (slice end 30:00 mean; run 2 passes run 1's peak at 0:16
on both seeds, after the first cut's run-1 craft speeds were moved later: DECISIONS.md). **Open:** the screens (the shelf with bonuses and
"???", the Codex pages, the Challenge list's new ten and their `needs`, the boards' three bests, the
skin picker) and the `skin_<id>_<kind>` art; the slip placeholders in `src/app/act3.ts` `SHORT` were
added for the typecheck. No Act III-IV bot plays a Challenge yet, so the new goals' times are the
model's.

## Status (2026-10-22, later): Milestone 13, onboarding, UX and accessibility, built

Built in a worktree off `m9-worlds` while Act IV's sim and the District's UI were worked on
elsewhere: app and render code only, no sim, data or save change. DECISIONS.md "Milestone 13".

### What exists

- **Lesson cards on firsts** (`src/app/lessons.ts`): nine (a starved machine, a slag jam, the first
  fold, the Factory floor, a trunk, a brownout, a Reorganize, a District route, a short route), a
  card pinned at the top centre with the thing's sprite, two or three lines and OK. From the sim's
  events and a look at the state twice a second; once per save (by seed, with the settings); queued;
  never over a celebration, a page, the wheel or an offline run; an old save is read for what it has
  already learnt (`pastLessons`). **Options → Lesson cards** turns them off.
- **"Where am I stuck?"** (`src/app/stuck.ts`): a **Stuck?** button beside the trouble bell (and
  `G`). `findStuck` traces every stopped thing on the floor on screen to its cause (a starved machine
  to the stopped feeder, a blocked one to the slower machine after it; slag, fronts, power; Factory
  trunk routes; District routes under 90% of their want) and charges each cause the output lost;
  the dearest wins. The camera pans there, its report is pinned, the Inspector says in one line what
  to do (and the coin a minute it costs). Nothing stuck: what the next goal needs.
- **Rates in tooltips** (`src/app/rates.ts`): the wheel's item cards carry the rate at the first
  known recipe (or a power building's kW); a machine's hover reads its rate now "of" its rate at its
  recipe and mode; research nodes say how long the rest takes at what is delivered now, per item and
  in total; an order's items and its % say the same.
- **Keys** (`src/app/keys.ts`, moved from `screens.ts`; `src/engine/input.ts` `cleanBinds`,
  `rebind`, `keyAliases`): click a key on the drawn keyboard, press its new key (Esc keeps it); the
  action holding that key takes the old one (a swap); Reset keys; kept in `foldworks_settings`; every
  `{k:X}` keycap in every string draws as the key now bound (`{k:=X}` draws literally).
- **UI scale** (`src/app/access.ts`, `settings.ts` `uiScaleFor`): Options → UI scale: Auto (the
  largest whole scale with 480x300 UI px, as before) or 1x up to the largest leaving 480x270 (4x at
  1920x1080; 2x at 1024x640 and 1280x720), independent of the floor's zoom.
- **Pips with shapes** (`src/render/pips.ts`): working a round dot, starved a funnel, blocked a
  square (blinking), stopped two bars, no power a bolt, idle a ring, 5x5 in an ink outline, on the
  Workshop, the Factory, the District and the Chute Mouths; status chips in every report carry the
  same shape; `{pip:x}` in rich text; a legend on the Keys page.

### Measured

`npm run typecheck` clean; `npx vitest run --exclude "tests/pace-*"` green with
`tests/onboarding.test.ts` (bindings cleaned, swapped, kept and aliased; the UI scale; the
stuck-finder's choice on sandbox states: a slag-choked furnace named over the press it starves, a
short District route, nothing stuck; lessons' memory). `npm run screens` clean at three sizes with
new states (`lessonCard`, `lessonStart`, `lessonDistrict`, `stuckAnswer`, `stuckFactory`,
`stuckDistrict`, `keysRebind`, `keysMoved`, `keysMovedHud`, `uiScaleMax`, `uiScaleOptions`,
`uiScaleSmall`); `npm run smoke` green.

### Open

- The District's pinned report (`src/app/district.ts` `pinned`) does not keep off the lot's Buy
  button: a group pinned at the floor's east edge covers it (the `stuckDistrict` state buys every lot
  to show the answer clean). For the District UI's owner.
- The wheel's 1-9 slot numbers are drawn as digits, not through the keycap aliases.
- The owner's look at the lesson cards' words and the pip shapes at 1x.

## Status (2026-10-22): Milestone 7, Act III (the District), built

The owner: *"finish the rest of the milestones/game run autonomously, no itch.io page, use up to
250 credits if needed"*, then *"make sure things get moving"*. The plan for Milestones 7-14 is
`docs/endgame.md`. Built on branch `m7-district` (the lead's sim core, then four agents in
worktrees: the art, the District's screen, Act III's other screens, the Act III bot), merged into
`main`. DESIGN.md §21; DECISIONS.md "Milestone 7".

### What exists

- **The District** (`src/sim/systems/high.ts`, `src/data/floors.ts`): a third floor of depth-2
  modules opened by research Zoning; 12x10 plus three 2-column lots (2M x n coin), its own Dock,
  Hopper and the Bay for Megaprojects #2-#3. Modules run as on the Factory. **Skiff routes**
  carry one item each, `skiffs x load / (2 x dist / speed + dwell)` (speed 2, load 4, dwell 1 s;
  15,000 coin a skiff, refunded; 12 a route). **District folds** (depth 3, research District Folds).
  The World floor's numbers are in the same data for Milestone 9.
- **The Chute**: the Factory Chute (a trunk ends in it) fills `s.chute` (20 an item); the Workshop
  Chute Mouth pushes a chosen item out (never inside a fold box). Tier 3 lines are designed on the
  Workshop from Factory goods.
- **Tier 3**: 19 items (solvent to the Autonomous Sandwich Engineer, an Assembler Mk2 recipe), the
  Chem Vat and the Greenhouse, Recycling and Byproduct modes, 17 research nodes on page 3 (each
  needs the Great Drill's stage 3), Act III orders and rewards (Bramble, Unit 7, Voltaire 4, the
  Committee 6), ten Act III Patents (head starts, Long Skiffs, the Bigger Nest, Ward Boundaries,
  the Dispatcher), 14 trophies.
- **Megaprojects #2 and #3** (`MEGAS`): the Floating City (a ninth Factory row, a fourth District
  lot) and the Scrap Transmuter (waste sells at 25%, then never blocks), kept through resets.
- **Challenges v1** (5, `src/data/challenges.ts`): taken at a Reorganize from the second on; small
  permanent rewards. **Scenarios v1** (3 boards, `src/data/scenarios.ts`): separate games, own
  save slots, personal bests in local storage.
- **Offline** tallies each floor's Dock and Bay apart; **SAVE_VERSION 8**.
- **The screens**: the District renderer and tools (a labelled strip: Route, Remove, Fold, the
  groups), flying skiffs, short routes in orange with a route card (`+ skiff`, `- skiff`), Buy lot,
  the District fold's clipboard and grade card, Act III goals; the Chem Vat, Greenhouse, Chute
  Mouth (report with item picker) and Factory Chute; research page 3; the Megaproject page's three
  tabs; Challenges on the Reorganize card and a slip while one runs; Scenarios from Options.
- **The second gate's District UI** (DECISIONS.md "The second gate: the District's UI"): the
  route cap on the strip, starved reports that count need against flow and name the fix, a coach
  that speaks of the District only (and skips Act I-II teaching once it stands), skiffs that keep
  off the modules, the Dock's and Hopper's tags in the east margin, research opening on the newest
  act, depth-3 folds on the strip. New screens state `districtStarved` (a starved group pinned).
- **Art** (`pixel-art/act3/`): every Act III sprite, 0 PixelLab generations.

### Measured

`npm run typecheck` clean; `npx vitest run --exclude "tests/pace-*"` 734 passed (the full suite
with the Act I-II pace tests passed 755 before the last sim batch; the long pace tests now run in
the background so the work keeps moving, per the owner). `npm run screens` clean at three sizes
after two HUD fixes (a goal chip wider than the bubble; the Gazette slip under a third clipboard).
A District of 96 groups and 98 routes costs 0.11 ms of sim a tick (budget 4 ms). **The Act III
bot** (`src/sim/bot3.ts`, `tests/pace-act3.test.ts`, 7 passed in ~30 min, seed 1000), re-measured
under the second gate's rules (DESIGN.md §21 Pacing): the District opens at 10:01, the Floating
City's stage 1 at 11:30; each Act III run fills its District (about 140 groups on 180 routes, every
lot, 1.25 skiffs a route) in about 7 h and resets; rules 1 and 2 hold at 10-10.4 min in three of
four Act III stretches; a tick with 139 groups 0.95 ms; checkpoint saves at 1, 5, 15, 30, 40 h in
`e2e/out/checkpoints/` (regenerated by the test). District modules now count in the bills term.

### Open

- The Act III bot builds no chemistry: solvent needs sand, and the only sand patch is the lab's
  (no Chute can carry sand), so District Folds, the City's stage 2 and the Transmuter are out of
  its reach; run 5 waits 20.1 min just after its hand-over (rule 1, not looked into); seed 8919
  not run.
- No pause on the District (the pause command takes the Factory only; with the World).
- Dark tier 3 icons lose
  contrast in module wells (a lighter well or rim would fix it).
- The owner's look at Act III, and the derivative flags in DECISIONS.md.

## Status (2026-10-21, later): after the owner's first play (building, hovers, the notebook)

The owner: a right click to get the Miner is nobody's first guess; hover tags took too much room
("a lil overstimulating"); the notebook "with half the game in it" was too discreet.
DECISIONS.md: "After the owner's first play".

### What changed

- **The Build button** (`src/app/wheel.ts` `toolboxButton`, `layout.ts` `build`): 48x36 on
  Bramble's head, the toolbox over "Build", a `Q` keycap; gold while the goal points into the
  wheel. **A left click on empty paving** opens the wheel there after the Bellows (`app.ts`).
- **Grab in the bubble** (`rail.ts`): a goal naming a building gets "Grab a Miner {coin}"; with it
  in hand the bubble shows how to put it down; from the Factory floor it takes the lift down first.
  A slip after the first Miner names the quick ways in.
- **Hover tags** (`hud.ts` `hoverReport`, `tags.ts` `briefOf`, `ui.ts` `tipAlpha`): a 0.45 s rest
  (0.12 s while warm), a 0.1 s fade, and a brief tag (name in Reed, chips, causes, rate, one verb).
  **Options → Hover tags**: Brief / Full / Off (`settings.ts`). The pinned report is unchanged.
- **The notebook's bookmarks** (`topbar.ts` `bookmarks`): its main pages as labelled ribbons up the
  left edge over the Build button, with live % and the red dot; the rest stay in the book.
- **e2e**: hovers rest `HOVER_WAIT` before a shot; `wheelcheck` covers the paving click and the
  Grab button, and its stale off-screen tile is fixed.

### Measured

No sim, data number or save changed (`src/sim/` untouched). `npm run typecheck` clean; `npm test`
38 files, 662 passed and 1 todo (as before); `npm run screens` clean at three sizes; `npm run
smoke` green; `node e2e/wheelcheck.mjs` all ok (its "click outside" check had been failing on
`main` since the sky island); `npm run shots` reaches every moment.

### Open

- The owner's look at the left column and the brief tags; the derivative flags in DECISIONS.md.
- The earlier sections' open items still stand.

## Status (2026-10-21, later): the sky island (the world redesigned)

The owner: "full redesign the way the gameplay/game looks, the planks and worlds … the surrounding
ocean isn't gonna cut it … Cookie Clicker combined with those factory Roblox games, tycoon things,
Miner's Haven … 300 PixelLab limit, run autonomously". They picked **a floating sky island** and
**palette B extended**. Built on branch `sky-island` (a style test, then agents in worktrees for the
renderer, the ground and island, the Factory platform, the town and the title), merged by the lead.
The plan and the as-built contract: `docs/sky-island.md`. DECISIONS.md: "The sky island".

### What exists

- **Palette B + 18 sky colours** (sky, cloud, grass, paving, sun) appended after the pips;
  machines, items, cast and HUD unchanged. `pixel-art/sky/pal.py` tests the ramps (colour-blind
  separation of meadow and paving included).
- **The Workshop is a floating island**: owned land paved (concrete with a build grid, grass in the
  grout at the meadow), land for sale meadow with its plot marked out; buying a lot paves it in a
  wave. A grass rim with trees, bushes, fences and flowers; the south cliff with the floor's ores
  as veins; an underside tapering to a point; waterfalls into the cloud sea; a parallax sky with
  clouds, far islets and birds (`src/render/sky.ts`, `island.ts`, `skyart.ts`, `ground.ts`).
- **The Factory is a sky platform**: a riveted plaza for the town, tread round the hall, brass
  kerbs, a girder face and truss with rotor pods, outriggers with rotors on the sides, annex
  splices (`src/render/factory.ts`); its sky is higher, the Workshop island small far below.
- **The town on footings**: every house redrawn in daylight on stone, Unit 7's plinth, Voltaire's
  steps, the Boardwalk a railed promenade (`pixel-art/town/`, `src/render/town.ts`).
- **The title scene**: the Workshop island and the town's island framing the logo, Bramble raising
  his hat (`pixel-art/title/`).
- **Ores re-seated** on paving and meadow (`pixel-art/sky/ores_reseat.py`).
- **Buildings drop in** and land with a squash (`renderer.ts`). The Festival sheet's strip is sky.
- **Words**: strings that put the town in a swamp rewritten (ids unchanged).
- **e2e**: `e2e/skylook.mjs` (the island at 1x, 2x, 3x); `screens` waits on the clock in a hover
  chain (the wheel's fan had been caught mid-slide).

### Measured

No sim, data number or save changed (`src/sim/` untouched). `npm test` 38 files, 662 passed and 1
todo (the pace suite as before); `npm run screens` clean at three sizes; `npm run smoke` green;
`npm run shots` reaches every moment. **Perf** (swiftshader, 1920x1080, the dense floor): sim
0.035 ms a tick; render + HUD 3.08 ms a frame at steady state. `e2e/perf.mjs` now waits for the
setup's celebrations to settle: read mid-shower (dust from 196 belts laid, three lots paving in)
the same floor showed 11 ms, which was the old method's 7.75 ms plus the bigger land-buy effects.

### Open

- **Derivative flags for the owner** (DECISIONS.md, the sky island): a floating island base
  (Roblox *Islands*, Skyblock), the plot paving itself in (the tycoon genre), rotor pods
  (steampunk). Nothing from Cookie Clicker or Miner's Haven is used.
- **Not redrawn for the sky**: the Megaproject and research pictures (still the bayou's night),
  the Dock's water slip (it reads as a canal in the paving). The pause key still does nothing.
- **PixelLab**: 2 of the 300 generations used; ~205 more left the account during the work from
  another session (not this one).
- The earlier sections' open items still stand.

### Start here next session

- **Branch:** `sky-island` merged into `main` locally; not pushed until the owner says so.
- **Art:** `pixel-art/sky/` (`python build.py`: ground, island, sky, props, ores re-seat; run it
  after `pixel-art/revamp/ores.py`), `pixel-art/sky/fplat.py`, `pixel-art/town/build.py`,
  `pixel-art/title/build.py`. The revamp scripts no longer write the sprites these took over.
- **Looks:** `node e2e/skylook.mjs`, `node pixel-art/title/shot.mjs` (both with `BASE`).

## Earlier status (2026-10-21): the 180 (text and HUD turned away from Last Watt) and the ore revamp

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
