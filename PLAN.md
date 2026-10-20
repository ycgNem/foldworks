# Foldworks — Plan

*Working title. It replaces "Pocket Foundry" (the owner's first pitch, kept in
`docs/original-pitch.md`). Check itch.io, Steam and the domain before the first public build.
Other names on the table: Byproduct, Tinyworks, Slag & Spark.*

## The hook

A pixel-art incremental factory game for the browser. You start with a hand furnace and an
ore patch you mine by clicking, and you end up shipping impossible inventions to a frog mayor.
In between you build production lines on a grid, Builderment-style: miners, belts, smelters,
presses, assemblers.

**The signature mechanic is folding.** Once a line runs well, you draw a box around it and
**fold** it into a single tile, a *module*. The module produces at the rate the line actually
achieved: what entered and left the box during an audit window, scaled by an audit grade.
Folding frees the floor so you can build the next line. You can **stamp** copies of a module,
and you place modules on the next floor up, where they are the building blocks.

The floors are the acts: **Workshop → Factory → District → World**. Each floor is a new grid
at a bigger scale, built out of modules folded on the floor below. The numbers go up, and so
does the visible scope.

Folding also solves an engineering problem. A browser can't simulate 40,000 belt tiles, but
ten modules standing in for 4,000 tiles each cost almost nothing. Each module is a known rate
function, which also makes offline progress cheap to compute.

## Pillars

1. **Build first, idle second.** Numbers go up because a factory you built works. Nothing is
   a "buy building #400" button with no layout behind it. Even the idle half is lines you
   designed, folded and stamped.
2. **Every system gets automated eventually.** Whatever you do by hand in one act becomes a
   reward you automate in the next: clicking, then building, then stamping, then contracts,
   then resets. Each new floor hands the previous floor's chores to a machine.
3. **Bottlenecks are puzzles, not mysteries.** Every machine says what it is waiting for. The
   game always names what is starved, blocked, unpowered or overflowing, and by how much.
4. **Respect the player's time.** No daily logins, no expiring orders, no energy timers.
   Offline progress is honest (a reported number you can check). Resets are always the
   player's choice, with a preview of what they grant.
5. **The absurdity escalates.** Products go from iron gears to the Autonomous Sandwich
   Engineer and the Portable Sunset Generator. Each one gets a pixel icon and a line of flavor
   text, and every customer is a character.

## Currencies (the ceiling, see `DECISIONS.md`)

| Currency | Kind | Comes from | Spent on |
|---|---|---|---|
| Coin | stock | items delivered to the **Dock** (standing and special orders) | machines, belts, land, stamps (with parts, from Milestone 4) |
| Items | typed stocks and flows | your lines | delivered to the Dock (coin), the **Hopper** (research) or fed to other machines |
| Reputation | one track per customer | filling that customer's orders | that customer's unique rewards (recipes, machines, skins, lore) |
| Patents | reset currency (layer 1) | **Reorganize** | the Patent tree: head starts, rules, automation |
| Legacy | reset currency (layer 2) | **Relocate** to a new world | automation of layer 1, world rules |
| Kernels | reset currency (layer 3) | **The Last Fold** | changes to the base rules |

**Research isn't a currency.** Research nodes cost item deliveries to the Hopper
(e.g. "Steel Smelting: 200 plates, 50 gears"), so research makes you build particular lines.
Inspiration (Act II+) is a small trickle of Hopper credit earned by clicking, and it counts as
items delivered.

## The loop

1. **Extract**: click the ore patch (Act I only), then build miners.
2. **Process**: belts carry ore to smelters, presses and assemblers. Byproducts (slag, later
   smoke, sludge, scrap) need somewhere to go.
3. **Deliver**: every belt ends at the **Dock** (coin, reputation) or the **Hopper** (research).
   Choosing which one a line feeds is the core routing decision.
4. **Expand**: buy land chunks, new machines and higher tiers.
5. **Fold and stamp**: fold a proven line into a module, stamp copies, place them on the next
   floor.
6. **Reset** when it pays: Reorganize, then Relocate, then the Last Fold.

## What clicking does

| Act | The click |
|---|---|
| I | Hand-mine ore (1 per click) and hand-crank the furnace. The first purchase, the Bellows, ends the cranking. |
| II | **Overdrive**: click a machine for 3× speed for 10 s (it then cools down). Clicking a jam clears it. |
| III+ | Clicks build up **Inspiration** (Hopper credit). Active play is rewarded but never required. |
| Always | **Sparks**: random events on the map (a Lucky Vein, a visiting Inspector, a Gremlin carrying off a gear). Click one for a bonus; miss it and nothing happens. |

## Customers (the cast)

- **Mayor Bramble**: a frog building a swamp town. Wants steady basics. The first customer.
- **Unit 7**: a lonely collector robot. Wants one of every product, so it doubles as the codex.
- **Dame Voltaire**: an aristocrat inventor. Wants complex, precise products and pays in
  alternate recipes.
- **The Committee**: three raccoons in a trench coat. Wants weird things and pays in rare
  components.

Standing orders never expire. Special orders are bigger, optional and never timed.
**Megaprojects** (the Great Drill, the Floating City, the Scrap Transmuter) are multi-stage
builds whose progress **survives every reset**. Each one completed changes a rule for good.

## Machines

- **Modes**: Efficient (less fuel or power, slower), Overclocked (faster, more power),
  Precision (better yield, slower). From Act III: Recycling (less waste) and Byproduct (more
  waste, for when waste is an input).
- **Tiers**: Mk1 to Mk3. Higher tiers are bigger, faster and hungrier, a trade-off rather
  than a strict upgrade.
- **Adjacency**: a smelter beside a heat exchanger runs on free heat. This rewards tight
  layouts on limited land.

## Byproducts

Most recipes also make waste. In Act I slag is a nuisance: a smelter whose slag has nowhere
to go stops. In Act II slag becomes an input (slag → gravel → concrete). By Act III,
zero-waste lines fold into modules with a better audit grade. Byproducts are the layer of
routing puzzles that changes the most over time.

## Acts and floors

| Act | Floor | Rough hours | New thinking | Products |
|---|---|---|---|---|
| I | Workshop | 0–3 | routing | iron, copper, coal, plates, gears, wire |
| II | Factory | 3–15 | ratios, power, byproducts | steel, glass, circuits, plastic |
| III | District | 15–40 | composing modules, logistics | robotics, chemicals, the Autonomous Sandwich Engineer |
| IV | World | 40–80 | adapting to biome rules | exotic alloys, Pocket Weather, the Portable Sunset Generator |
| V | Beyond | 80+ | optimizing and bending the rules | impossible inventions |

## The three reset layers

1. **Reorganize → Patents** (first available around 4–6 h, then every 1–3 h). Clears the
   floors and keeps blueprints, the codex, megaprojects and reputation. Patents buy head
   starts, rules and automation, never a bare "+10% everything".
2. **Relocate → Legacy** (first available around 35–45 h). Move to a new world (a biome with
   its own rules) and reset Patents. Legacy automates layer 1 (auto-reorganize rules, contract
   runners, blueprint drones).
3. **The Last Fold → Kernels** (first available around 80 h). Fold your entire world into one
   tile, which becomes the first machine of the next universe. Kernels change the base rules.

## The long tail (hours 60–100+)

- Challenges with permanent rewards (no splitters, scarce power, three machine types only).
- Infinite orders: a scaling series of orders with cosmetic milestones.
- The **Trophy Shelf**: hundreds of achievements, each with a small, specific bonus.
- The **Codex**: every product with an icon and flavor text. Unit 7 collects it.
- **Blueprints** shared as copy-paste strings, with no server.
- Decorations and machine skins from reputation and challenges.

## Offline

Offline production starts at 50% efficiency, and the Patent tree raises it. On return, a
report says what was made, what sold, and where and when a line jammed, with a button that
jumps to the jam. Offline is computed from the module rates plus a short live replay of
unfolded lines, never a guess.

## The not-list

- **Not Cookie Clicker.** No building-count shop with a fixed growth rate per purchase. Growth
  comes from layouts, folds and stamps. Sparks must be re-derived from the factory (an
  Inspector who grades a real line, a vein on a real patch), not a floating cookie with a
  random buff.
- **Not Factorio in a browser.** No combat, no pollution enemies, no trains as a core system,
  no blueprint book UI copied from it. Logistics stays readable on one screen per floor.
- **Not Builderment with a reskin.** The Hopper takes research deliveries; that's the borrowed
  part and it is flagged (`DECISIONS.md`). No copied tech tree, item list, map shape or
  numbers.
- **Not Universal Paperclips.** The zoom-out is floors you build, not a text stage change.
- **Not Antimatter Dimensions.** No dimension-stacking multipliers. Challenges and autobuyers
  are allowed as genre conventions; their names, numbers and order are this game's own.
- No daily rewards, no login streaks, no timed events in the core game, no ads, no premium
  currency.
- Nothing past Milestone 2 before the Milestone 3 gate (`ROADMAP.md`).

## Tech (decided)

TypeScript strict + Vite, one Canvas 2D at 16 px tiles with integer zoom and
`imageSmoothingEnabled = false`. A fixed **20 Hz** pure simulation (`DECISIONS.md`), decoupled
from the rAF renderer. Immediate-mode UI drawn on the canvas with a bitmap font. Big numbers
through one `Num` type from day one. Web Audio. localStorage saves with versioned migrations
and export/import strings. Vitest for the sim and pace tests, Playwright for screenshots and
bot play, GitHub Pages deploys. The engine layer is extracted from Trotline
(`C:\Users\jacks\Documents\trotline`, which took it from Sprocket & Sprout); nothing from its
`sim/`, `data/` or `app/`. Art is drawn with the pixel-art-studio skill in a new palette.
