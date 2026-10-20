# The UI redesign (2026-10-20)

The owner, after playing the Milestone 4 build: **"it's crowded but not in a good way."** The
earlier direction (a full, dense, Cookie Clicker / Clicker Heroes screen with dopamine) still
stands. What changes is *how* it is full: organized density, one thing shouting at a time, and
the factory as the star.

## What's wrong now (from the 1280×720 and 1920×1080 screenshots)

1. **Everything wears the same heavy frame.** Thirteen wood-and-brass boxes with rivets and title
   bars: six stacked cards on the left, nine store rows on the right, fifteen bottom buttons, the
   ticker. Nothing is more important than anything else, so the eye has nowhere to land.
2. **The floor is squeezed.** The two columns take ~47% of the width; the map, the thing the
   player built, gets the leftover middle, under a floating "Foldworks Workshop" label.
3. **Static text in prime space.** "Shipping" (a list of sales), "Mayor Bramble" (a quote),
   "Research: nothing selected", and the pip counts sit on screen all the time, at the same
   weight as the coin counter.
4. **The store column is 70% padding.** A row 54 px tall for "Belt · 1 · 120/min"; locked rows
   are `???` boxes that take as much room as the ones you can buy.
5. **One bottom row of fifteen equal buttons**: tools, floor tabs and nine menus look alike.
6. **Two text sizes fight**: the huge coin digits and very small body text, nothing between.

## What successful games do (cross-referenced)

| Game | What it does well | What Foldworks takes |
|---|---|---|
| **Cookie Clicker** | one huge counter; the store lights a row when you can afford it; a news ticker; big full-screen menus | the counter as the single loudest thing; *affordable* lights a slot gold; the Gazette, but quieter |
| **shapez / shapez 2** | the map is the screen; one goal card top-left with its progress; a numbered building bar at the bottom | the floor gets ~75% of the screen; a Goal card with a bar; a hotbar with number keys |
| **Timberborn, Against the Storm** | a bottom bar of *categories*, each opening a row of building icons; a thin top bar of resources; orders on the side with portraits | category tabs over a slot row; a thin top bar; the customer's order as a compact card with the portrait |
| **Factorio** | problems shown as icons on the entity *and* a small alert list you click to jump | pips stay on machines; a "line health" chip (green/yellow/red counts) in the top bar that jumps to the next problem |
| **Mindustry** | a compact grid of building icons, tooltip carries the detail | slots are small; the detail lives in a rich hover card |
| **Dorfromantik** | quests drawn *on the map* as flags with a number | the active order flies a flag over the Dock with its progress; the research node shows a ring over the Hopper |
| **Balatro** | one or two big numbers, everything else calm; every change bounces in step with a sound | number rolls and bumps, flying coins into the counter, a chime per goal; calm chrome so the juice reads |
| **Melvor Idle, Antimatter Dimensions** | full-screen menus share one template (tabs, content, detail) | every full-screen menu uses one template |

These are genre conventions (a hotbar, a top resource bar, tabbed menus), used by many games; no
layout, art or wording is copied from any one of them (`DECISIONS.md`).

## The new screen

Sizes are in UI pixels (the canvas is ~640×360 UI px at 1280×720 and 1920×1080; 512×320 at
1024×640).

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ ◉ 1.58M  +7.0K/min  │ ⚙3 ⚠2 ⛔1 │  [Workshop][Factory]  │ ⚗ 📜 ▦ 📖 📊 🏆 ⚙ │  top bar, 20
├──────────────┬───────────────────────────────────────────────┬───────────────┤
│ ★ GOAL       │                                               │  toasts       │
│ Build a      │                                               │  (stack,      │
│ Boiler ▓▓▓░  │                                               │   fade out)   │
│              │               THE FLOOR                       │               │
│ 🐸 ORDER      │        (town on the water around it,          │               │
│ Lens Array   │         flag over the Dock, ring over         │               │
│ ▓▓▓▓░ 212/400│         the Hopper, pips, coin pops)          │               │
│              │                                               │   hover card  │
│ ⚗ RESEARCH   │                                               │  (near mouse  │
│ Copper ▓░ 0% │                                               │   or here)    │
├──────────────┴──┬────────────────────────────────────────┬───┴───────────────┤
│ ↻  ✕  ▣fold  ≈  │ [Logistics][Production][Power][Mods]   │                   │
│ tools           │ [1▪][2▪][3▪][4▪][5▪][6▪][7🔒][8🔒][9🔒] │                   │ build bar
└─────────────────┴────────────────────────────────────────┴───────────────────┘
  ~ SWAMP GAZETTE: the frog council has one member ~                             crawl, 9
```

- **Top bar** (20 tall, full width, a plate, no rivets): the coin counter on the left, the
  *one* loud element (gold, the big digits, rolling and bumping; the rate under or beside it;
  hover shows the old Shipping list). Then once they exist: Patents, Machine Kits, power
  (supply/demand kW). The **line health chip** (green/yellow/red counts; click jumps to the next
  problem, the old "find"). The **floor tabs** in the middle. The **menus** on the right as
  icon-only buttons with a badge dot when something is new (the label and key are in the tooltip).
- **Left rail** (≈120 wide, floating cards with a gap between them, not one framed column):
  - **Goal** (the old "Next"): one sentence, a progress bar when it has one, and its reward.
    It flashes and chimes when done, then slides in the next. At the very start the Bellows is
    the goal, with a Buy button on the card.
  - **Order**: the customer's 24 px portrait, the order's name, one bar per item. Hidden when no
    order is active (an "Orders: 2 offered" pill instead).
  - **Research**: the selected node, its bar; "Pick research (T)" when none is selected.
  - **Megaproject** (Act II): the stage and its bars, once the Bay exists.
  - Each card collapses to its title line when clicked; nothing else lives here.
- **Right side**: no column. Toasts stack from the top-right corner and fade; the hover report
  card anchors bottom-right (or follows the mouse when there is room).
- **Bottom: the build bar**, centred. Category tabs (Logistics, Production, Power, Factory or
  Modules on the Factory floor, Upgrades) over one row of square slots (≈26×26, the sprite at
  1×, the hotkey number in the corner, the price under it). Locked slots show a padlock over a
  dark silhouette, not a `???` row. A slot you can afford gets a gold edge; a new one a dot.
  Hover gives the rich card the old store rows had (sprite at 2×, name, price, rate, a line of
  description). Left of it, the **tools** (Rotate, Remove, Fold, Flow) as icon buttons with
  their keys; the Fold button keeps its audit badge.
- **The Gazette** becomes a thin crawl along the very bottom edge (9 tall, dim text, no frame);
  a headline that matters (an order filled) brightens for its first pass.
- **The floor** fills everything in between. The floor name label goes (the tab says it).

## Panel language: two weights, not one

- **Plate** (every HUD element): ink fill at ~88% opacity, a 1 px outline, a 1 px lighter top
  edge, 2 px corner notches. No wood, no rivets. Calm, so the world and the numbers carry colour.
- **Ornate** (full-screen menus, celebration cards, the grade card, the reset preview): the
  wood-and-brass 9-slice with rivets. Rare on purpose, so opening a menu *feels* like opening
  something.
- **Accent colour carries meaning**: gold = coin and "you can buy this", teal = research, moss =
  orders and customers, copper = heat and jams, violet = Patents and resets.
- Spacing on a 4 px grid; 4 px gaps between cards; 6 px padding inside.
- Text: three sizes only: the big digits (coin, grades), the normal font, and the small font for
  secondary lines. Secondary text in `hull2`, never smaller than the small font.

## Full-screen menus: one template

Header bar (icon, title, the menu's tabs, close ×, Esc) · content · an optional detail panel on
the right (the research tree's node card is the model). Research, Orders, Modules, Codex, Survey,
Megaproject, Stats, Trophies, Options, and the Milestone 5–6 screens (Reorganize, Patents,
Blueprints, the offline report) all use it.

## Keep all the juice

Coin pops on sales and flying coins into the counter; the counter's roll and bump; confetti,
banners, the S+ card, the fold animation, Overdrive glows, the town growing. The redesign moves
chrome out of the way so these read; it removes none of them.

## Diegetic touches (on the map, not in panels)

- The active order's flag over the Dock: the customer's colour, a small progress bar.
- A progress ring over the Hopper for the selected research node.
- Jams: the red pip already blinks; the line health chip's click pans to it.
