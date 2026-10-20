# CLAUDE.md — Foldworks

You are building **Foldworks**, a pixel-art incremental factory game where you fold working
production lines into single-tile modules and build each bigger floor out of them. Read
`PLAN.md` (what and why), `DESIGN.md` (every number and its derivation), `ROADMAP.md` (what to
build now), `STYLE.md` (how it looks, once written) and `PROGRESS.md` (what exists) at the start
of every session, in that order. `DECISIONS.md` holds every design decision with its reason; add
to it, never silently contradict it. `docs/original-pitch.md` and `docs/concept-v1.md` are
history; they lose any conflict.

## Stack (decided, don't relitigate)

TypeScript strict · Vite · one HTML5 Canvas 2D with `imageSmoothingEnabled = false`, 16 px
tiles, integer zoom · fixed **20 Hz** pure simulation decoupled from a rAF renderer ·
immediate-mode UI drawn on the canvas with the bitmap font · one `Num` big-number type for
every amount of coin and items · Web Audio (procedural + jsfxr bank) · localStorage saves with
versioned migrations and export strings · Vitest for the sim and pace tests · Playwright +
headless Chromium for screenshots, UI checks and bot play · GitHub Pages via the workflow.

The engine layer comes from Trotline (`C:\Users\jacks\Documents\trotline`), which took it from
Sprocket & Sprout: `src/engine/`, `src/ui/`, the render patterns, `scripts/` and the `e2e/`
harness. **Nothing from its `sim/`, `data/` or `app/` is to be copied, adapted or consulted.**

## Architecture rules

- `src/sim/` is pure: no DOM, canvas, audio, timers or `Date.now()`. Time comes in as ticks.
  Presentation effects are events on the game's event queue, drained by the renderer.
- One system per file in `src/sim/systems/`, run in a fixed order from `Game.ts`:
  input commands → miners → belts → machines → modules → docks and hoppers → orders →
  research → sparks → audits → stats.
- **Two simulation levels, kept apart**: Workshop machines and belts are simulated item by
  item; modules are rate functions (per-tick fractional consumption and production). A
  module never holds individual items on a belt inside itself.
- **Every amount is a `Num`.** No raw `number` for coin or item stocks anywhere in `src/sim/`
  (a test greps for it). Rates and timers may be `number`.
- All content is typed data in `src/data/` (items, recipes, machines, research, orders,
  customers, sparks, land, floors, flavor text). A validation test checks every
  cross-reference, that every recipe is reachable from raw resources, and that **every numeric
  stat has a `derivation` string** naming a section of `DESIGN.md`.
- The sim is deterministic: seed + command log replays to the same state (a test checks it).
  Offline progress uses the same code paths, run headless.
- Rendering: baked static ground chunks per floor; dynamic sprites (items on belts, machine
  animations) culled to the view; one draw per item icon from an atlas.
- Saves: seed + commands + periodic snapshots, `SAVE_VERSION` + ordered migrations, from
  Milestone 0.

## Definition of done (every milestone, every PR-sized change)

1. `npm run typecheck` clean, `npm test` green (sim tests, data validation, purity, pace tests).
2. `npm run screens` run and the report inspected: no overlapping or cut-off text.
3. For anything the player sees: a Playwright screenshot taken and **looked at** (Read the PNG).
4. For anything that changes a number: the derivation updated in `DESIGN.md`, and the pace test
   that encodes the lesson still passes (or is updated, with the new reasoning written down).
5. `PROGRESS.md` updated (what exists, what is stubbed, what is next). `DECISIONS.md` updated if
   a decision was made. Commit with a message that says what and why.

## Standing instructions

- **Vertical slice first.** Until `ROADMAP.md` Milestone 3's gate is marked passed, build nothing
  from Milestone 4 onward. Add ideas to `IDEAS.md` instead.
- **Flag anything derivative.** If a mechanic, number, name or UI pattern you are about to write
  resembles a specific shipped game (Cookie Clicker, Builderment, Factorio, shapez, Antimatter
  Dimensions, Universal Paperclips above all), stop and say so in chat and in `DECISIONS.md`,
  then re-derive it from the model or drop it. The not-list in `PLAN.md` is a floor.
- **No geometric price curves on purchases.** Growth comes from layouts, folds, stamps and land
  (`DESIGN.md` §4, §10). A new cost curve needs a `DECISIONS.md` entry.
- **No new currency, floor, reset layer or tree** without a `DECISIONS.md` entry naming the
  pillar it serves.
- **Pillar 3 is not polish.** Every machine and module ships with its status pip and hover
  report in the same change that adds it.
- **Pacing is tested, not guessed.** Any change to costs, rates or unlocks runs the pace tests;
  anything past the slice is checked against `DESIGN.md` §16's rules.
- **Readability over detail.** At 1× zoom a player must tell apart the things in `DESIGN.md` §17.
- Play the build with the bot before asking for a review; send screenshots of the moments that
  matter (first click, first miner line, the first slag jam, the first fold, the audit card,
  the Factory floor).
- Ask before changing: the tile size, the palette, the tick rate, the currency list, the floor
  list, the reset layers, or the milestone order. Everything else: decide, write it down, move on.

## Agents (in `.claude/agents/`)

- `idle-critic`: blunt incremental and factory game designer. Reviews pacing, the
  click → automate → fold → reset arc, prestige math, offline honesty, number readability,
  bottleneck legibility and anything derivative. Runs at every milestone and at both gates.
  Plays the build with fast-forward, does the rate arithmetic itself.
- `pacing-auditor`: reads `src/data/*`, recomputes `DESIGN.md` §13 and §16 from the current
  numbers, runs the pace tests and the bot, and reports every pacing rule that no longer holds.
- `art-director`: owns `STYLE.md`, draws every sprite with the pixel-art-studio skill, exports
  to `src/art/`, checks them in the game's own screenshots at 1×.
- `qa-screens`: runs the screenshot and overlap checks and reports.

## Environment notes

Windows. Node is a portable copy at `C:\Users\jacks\tools\node-v22.20.0-win-x64`, not on PATH
(`Play.bat` adds it; in a terminal prepend it to PATH). The dev server runs on port **5210**
(`.claude/launch.json`); never kill a server you didn't start. Python 3.13 with Pillow is on PATH
for the pixel-art-studio build scripts. Art tools: pixel-art-studio for basically everything;
PixelLab only within a stated cap; never SpriteCook. Secrets (API tokens) never go in a file in
the repo.
