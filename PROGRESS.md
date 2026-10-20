# Progress

What exists, what is stubbed, what is next. Updated at the end of every session.

## Status (2026-10-20, Milestone 0: foundation)

What exists:
- **Engine** (`src/engine/`, from Trotline's engine layer, renamed and recoloured): the 20 Hz
  fixed-step loop with fast-forward (`loop.ts`, `time.ts`), input with Foldworks' actions
  (`input.ts`), rng, the event queue, saves with versioned migrations and `FW1.` export strings
  (`save.ts`), procedural audio with Foldworks' sound set (`audio/`), and **`Num`**
  (`num.ts`: exact below 1e15, mantissa/exponent above, formatting with commas, suffixes and
  scientific).
- **UI kit** (`src/ui/`): the bitmap font (with Foldworks' icon glyphs), the IMGUI kit and the
  overlap audit.
- **Sim** (`src/sim/`): `Game` with the fixed system order and the command log (`act`, `queue`,
  history), the world state (`world.ts`), the snapshot save (`snapshot.ts`), and the Workshop
  systems already working: miners, belts (downstream-first order, 120/min), machines (buffers,
  crafting, starved/blocked with the item named, slag byproduct, shovelling), the Hand Furnace
  crank, hand-mining, the Dock (orders first, then sales), the Hopper (research with selection and
  banking), Bramble's orders and reputation, Sparks (Lucky Vein, Inspector), statistics, and the
  line analysis behind the hover report. Modules and audits are stubs (Milestone 2).
- **Data** (`src/data/`): items, recipes, machines, research, orders, land, sparks, rules, all
  with derivation strings; palette A.
- **Render** (`src/render/`): camera with integer zoom and pan, the ground baked per land chunk,
  sprites with code placeholders (art from `src/art/` replaces them as it lands), belt items
  interpolated between ticks, status pips, ghosts, effects (coin pops, flying coins, particles,
  rings, shake).
- **App** (`src/app/`): title screen, play screen, a first HUD (coin counter that rolls up, the
  build bar, the Bellows button, research/orders/help panels, toasts, the next-goal line, the
  hover report), `window.__app` with freeze, step, fast-forward (`ff`), grant and helpers.
- **Tests** (165 green): Num, engine (saves, export strings, events, font coverage, audit),
  data validation (cross-references, reachability, derivations), purity (no browser APIs, no
  clock, no Math.random, amounts in Num), the Workshop sim (throughput, conservation over 10,000
  ticks, determinism, snapshot restore, the crank, the click cap, the slag lesson).
- **Harness** (`e2e/`): `launch.mjs`, `screens.mjs` (overlap audit at three sizes). `scripts/`:
  art import, contact sheets, the PNG/pixel helpers.
- **Art**: the palette test (`pixel-art/palette-test/`), STYLE.md. Placeholders everywhere else.

Stubbed / not started: shots, smoke, bot and perf e2e scripts; the pace tests; the real art; the
full-screen HUD the owner asked for; modules, the Fold tool, the Factory floor, offline.

Next: Milestone 1 (the owner asked for Milestones 0-4 in one autonomous session).
