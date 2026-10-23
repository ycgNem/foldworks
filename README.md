# Foldworks

A pixel-art incremental factory game for the browser. You start on a small floating island with
a hand furnace and an ore patch you mine by clicking. You build lines of miners, belts, smelters
and presses, and once a line runs well you draw a box round it and **fold** it into a single tile:
a *module* that makes what the line made, at the rate it was audited at. You stamp copies of your
modules and build the next, bigger floor out of them. By the end you are shipping impossible
inventions to Mayor Bramble, a frog with a town on the next island over.

Everything is drawn on one Canvas 2D with integer zoom (16 px tiles, its own bitmap fonts), the
sim is a deterministic 20 Hz model kept apart from the renderer, and saves stay in your browser.

## The game

**Five acts, five floors.** Each floor is built out of modules folded on the floor below.

| Act | Floor | What you learn |
|---|---|---|
| I | **Workshop** | routing: miners, belts, smelters, slag, the first fold |
| II | **Factory** | ratios, power and byproducts, with modules joined by trunk belts |
| III | **District** | composing modules: groups of modules joined by skiff routes, distance matters |
| IV | **World** | islands with their own rules (Pebble, Cinder, Rime, the Old Works), barges |
| V | **Beyond** | bending the rules: tier 5, couriers, the Endless Ledger |

**Three resets**, always your choice and always previewed first:

1. **Reorganize** (from about 4-6 h): clear the floors for **Patents**, spent on head starts,
   rules and automation. Your designs go into the Patent Drawer and come back.
2. **Relocate** (from about 35-45 h): fly the town to another island for **Legacy**, which
   automates the first layer.
3. **The Last Fold** (from about 80 h): fold the whole World into one tile, the **Seed** of the
   next universe, for **Kernels**, which change the base rules.

Along the way: four customers (Mayor Bramble, Unit 7, Dame Voltaire and the Committee), research
paid in items delivered to the Hopper, Megaprojects that survive every reset, a Codex, trophies,
Challenges and honest offline progress (a report of what was made and where a line jammed).

## How to play

The goal card on the left always says what to do next, and the lesson cards explain each new
thing the first time it happens. When something stops, its status pip says why (working, starved,
blocked, no power, stopped), its hover report says by how much, and **Stuck?** (`G`) finds the
dearest problem on the floor and takes you to it.

### Mouse

| | |
|---|---|
| Left click | mine ore by hand, build the thing in hand, select a machine (its report pins open) |
| Left drag | lay a line of belts, or draw the fold or audit box with the Fold tool |
| Right tap | open the **Workbench Wheel** at the cursor (with a tool in hand: drop it first) |
| Right or middle drag | pan |
| Wheel | zoom |

### Keys

Every key can be rebound on the **Keys** page of the notebook (click a key, press its new one).

| Key | Action |
|---|---|
| `W` `A` `S` `D` / arrows | pan |
| `E` or `=` / `Z` or `-` | zoom in / out |
| `Q` or `Space` | the Workbench Wheel |
| `1`-`9` | pick from the wheel |
| `R` | rotate |
| `X` | the Remove tool |
| `F` | the Fold tool |
| `Tab` | switch floor |
| `T` | research |
| `O` | orders |
| `I` | modules |
| `G` | where am I stuck? |
| `L` | the flow overlay |
| `H` | hide the HUD |
| `P` | pause |
| `M` | sound on or off |
| `Esc` | cancel |
| `/` or `F1` | options and keys |

Options also has the UI scale, number notation, sound levels, lesson cards, export and import
(a save string you can paste into any browser) and the damaged-save recovery.

## Running it

It runs in any modern browser. The published build goes to GitHub Pages on every push to `main`
(`.github/workflows/deploy.yml`; the repo's Settings → Pages → Source must be "GitHub Actions").

On this PC, double-click **`Play.bat`**: it uses the portable Node at
`%USERPROFILE%\tools\node-v22.20.0-win-x64` when Node isn't installed, installs the tools on the
first run and opens the game at http://127.0.0.1:5210.

To start 15 hours in (Act III, a District standing): Options → **Import save**, then paste the
whole of `docs/checkpoint-15h.txt`. Where the project stands and what is still open: the top of
`PROGRESS.md`.

From a terminal (Git Bash), put the portable Node on the PATH first:

```bash
export PATH="/c/Users/jacks/tools/node-v22.20.0-win-x64:$PATH"
npm install
npm run dev          # http://127.0.0.1:5210 (a cold first load takes 40-90 s: ~1,050 modules unbundled)
npm run build        # typecheck, then the production build in dist/ (one script, about 6 requests)
npm run preview      # serve dist/ at http://127.0.0.1:4210
```

### Scripts

| Script | What it does |
|---|---|
| `npm run dev` | the Vite dev server on port 5210 |
| `npm run build` | `tsc --noEmit`, then `vite build` into `dist/` |
| `npm run typecheck` | TypeScript, strict |
| `npm test` | every Vitest test, the pace tests included (slow: minutes) |
| `npx vitest run --exclude "tests/pace-*"` | the fast tests only (about 20 s) |
| `npm run smoke` | boots the game in Chromium and plays the first minutes, a save, a reload, an export, a fold |
| `npm run screens` | the HUD overlap audit: the game's key states at three window sizes, `e2e/out/screens/report.md` |
| `npm run shots` | the moments that matter, played by the planner bot, `e2e/out/shots/` |
| `npm run bot` | a bot policy plays one seed in the real game, `-- [policy=planner] [minutes=45] [seed=1]` |
| `npm run perf` | every floor at its worst case (200 modules a floor, the dense Workshop), frame and tick timed; `-- load` times a cold load |
| `npm run art` | imports the art sheets into `src/art/` |
| `npm run contact` | contact sheets of the art |

The e2e scripts need a running server: they use http://127.0.0.1:5210/ unless `BASE` says
otherwise (for example `BASE=http://127.0.0.1:4210/` for the production preview). They render with
SwiftShader by default so pixels compare across machines; `GPU=hw` uses the real GPU.
`LOAD_TIMEOUT` (ms) waits longer for a cold dev server. Other tools in `e2e/`: `saves.mjs`
(backups, the offline report, damaged-save recovery, save size), `idle.mjs` (background tabs and
offline runs), `wheelcheck.mjs`, `look.mjs <state>` (one PNG of a named state), `act2.mjs`,
`artlook.mjs`, `skylook.mjs` and `gallery.mjs` (art and UI kit shots).

### Tests

`tests/` holds the Vitest suites: the sim and each act's systems, data validation (every
cross-reference, every recipe reachable, every number with a `derivation` naming its section of
`DESIGN.md`), purity (no DOM, clock or raw-number amounts in `src/sim/`), determinism (seed +
command log replays to the same state), saves and migrations, the save codec and the 200 KB
limit, and the **pace tests** (`tests/pace-*.test.ts`), where bots play hours of the game headless
and every pacing rule in `DESIGN.md` §16 is checked against the current numbers.

CI (`.github/workflows/`): `ci.yml` runs the typecheck, the fast tests and the build on every push
and pull request; `pace.yml` runs the pace tests nightly and on demand; `deploy.yml` builds and
publishes to GitHub Pages on a push to `main`.

## Docs

| File | What it is |
|---|---|
| `PLAN.md` | the game: the hook, the pillars, currencies, acts, resets, the not-list |
| `DESIGN.md` | every number and its derivation, the pacing model, measured performance |
| `DECISIONS.md` | every design decision with its reason |
| `ROADMAP.md` | Milestones 0-14 and the two gates |
| `STYLE.md` | how it looks: the palette, the sprites, the HUD |
| `PROGRESS.md` | what exists, what is stubbed, what is next |
| `IDEAS.md` | ideas parked for later |
| `CLAUDE.md` | how Claude Code works in this repo |
| `docs/` | the HUD, sky-island and endgame plans; the original pitch and first concept (history) |

## Credits

- Design, code and pixel art made for this game. Every sprite is placed pixel by pixel by the
  build scripts in `pixel-art/` (Python and Pillow), a few machine and portrait drafts started in
  PixelLab and were finished by hand; the three bitmap faces (Reed, Bullfrog, Pip) are drawn in
  `src/ui/font.ts`.
- Sound: synthesized in Web Audio, with a bank of effects made with
  [jsfxr](https://github.com/chr15m/jsfxr) (the Unlicense).
- The engine layer (loop, input, saves, UI kit, e2e harness) comes from the owner's earlier
  games, Sprocket & Sprout and Trotline.
- Built with TypeScript, Vite, Vitest and Playwright.
