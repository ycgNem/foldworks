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

---

## What was built (2026-10-20)

The brief above, as implemented on the UI redesign branch. Decisions and their reasons are in
`DECISIONS.md` ("The UI redesign"); this section is the reference for STYLE.md's UI section.

### The regions (`src/app/layout.ts`)

All sizes in UI px. The UI scale is `floor(min(w/480, h/300))`: 640x360 at 1280x720 and
1920x1080, 512x320 at 1024x640. "Wide" is 600 UI px and up.

| Region | Where | Size |
|---|---|---|
| top bar | `top` | full width, 20 tall |
| card rail | `rail` | x 4, from y 24 to 4 above the band; 128 wide (116 narrow) |
| toasts and pinned report | `side` | right edge, 4 in; 156 wide (136 narrow) |
| build bar band | `band` | full width, 46 tall, above the crawl; the bar is centred in it |
| Gazette crawl | `crawl` | full width, 10 tall, at the bottom |
| floor view (camera) | `center` | right of the rail, between the top bar and the band |
| full-screen menus | `overlay` | 2 in from the sides, from the top bar to the crawl |

The old names (`ticker`, `left`, `right`, `bottom`) remain as aliases of crawl, rail, side and
band, so code written against them still runs.

### Top bar (`src/app/topbar.ts`)

Left to right: the spinning coin and the counter in 2x digits (1x when the number is too wide),
the rate (`+7.0K/min`, leaf); then, once each exists, Machine Kits (kit icon, count), power
(bolt, demand/supply kW in green/amber/blue, a bar when there is room), counters registered by
other files; the line-health chip (hidden until the first Miner). The floor tabs (Workshop,
Factory; icons alone when short of room; hidden until Folding is researched) are centred in the
room left. The menus are 18x16 icon keys from the right: Research, Orders, Modules, Codex,
Survey, Megaproject as they open, a divider, Stats, Trophies, Options. Hovering the counter drops
down the coin card (number, rate, sparkline, earnings, Shipping per minute).

### Card rail (`src/app/rail.ts`)

Goal (gold), Order (the customer's colour), Research (teal), Megaproject (glow). A card is a
plate with its accent top edge, a 13 px title row (an 8 px icon, the title in small capitals,
`-`/`+` to fold) and its body 6 px in. The Goal card holds the Bellows bar and Buy button at the
start and slides in, flashes and chimes (`codex` at 0.35 volume, pitch 1.5) when the goal
changes. "N orders offered" and "Pick research (T)" are one-line pills (accent plates with a
blinking dot). The order flag and research ring are drawn on the map by `diegetic()`.

### Build bar (`src/app/buildbar.ts`)

Tabs (11 tall, the store's: Build, Power, Heavy as they unlock, Upgrades; on the Factory floor,
Modules) sit on the slot plate's top edge. Slots are 24x25: the sprite at 1x (2x2 machines at
half size), the hotkey top-left and the price under it in the small font. Edge colours: gold
(brass1, gold on hover) affordable, hull0 not, teal1 in your hand; a 1 px pulsing gold ring
around the slot the goal names. The hover card (184 wide, above the slot): the sprite at 2x in
a well, name and key, price, rate, then the description lines. The tools plate (Rotate, Remove,
Fold, Flow; 22 px keys with their letter) sits left of it, under a small "TOOLS" label.

### Panels, type and colour

- `plate(ui, x, y, w, h, { accent, hover, kind, blocking, alpha, fill })`: the HUD panel.
  `plateRaw(ctx, ...)` draws the same without UI bookkeeping (tooltips, floating cards).
- `frame(ui, x, y, w, h)`: the ornate panel, for full-screen menus and celebration cards only.
- `section(ui, ...)` and `card(ui, ..., title, accent, icon)`: flat wells inside menus.
- Text: big digits (`ui.text(s, x, y, c, { scale: 2 })`), the normal 7 px font, and the 5 px small
  font (`ui.small(s, x, y, c)` or `ui.text(..., { small: true })`; capitals and figures,
  lowercase drawn as capitals). Secondary text in `hull2`, tertiary in `hull1`.
- Accents: gold coin and buy; teal research and "on"; leaf orders (Bramble), teal Unit 7, hot
  Voltaire; copper heat and jams; violet Patents and resets; blue power.
- Spacing: a 4 px grid; 4 px between plates; 6 px padding inside cards.

### The menu template (`src/app/widgets.ts`)

`menuTemplate(app, r, { title, accent, icon, tabs?, detail? })` draws the ornate frame and the
header bar (a 16 px icon, the title in the accent, the menu's tabs, "ESC" and a close key) and
returns `{ body, detail, free }`: the content rect, the detail panel's rect on the right when
`detail` (px) is given, and the header's free width. With no `tabs` the header shows the screen's
group (Orders/Modules/Codex/Survey/Drill; Stats/Trophies/Options). `screenHeader(app, r, title,
accent, icon)` keeps its signature and draws the same header (content starts at r.y + 22).

### For new screens (Milestones 5 and 6)

    import { menuTemplate } from './widgets';
    import { registerScreen } from './screens';          // the name must be in ScreenName
    import { registerMenu, registerCounter } from './topbar';
    registerScreen('patents', (app, r) => { const { body, detail } = menuTemplate(app, r, { title: 'Patents', accent: C.violet, icon: 'star', detail: 170 }); /* ... */ });
    registerMenu({ id: 'patents', icon: 'star', name: 'Patents', key: 'P', panel: 'patents', tip: 'Spend Patents', show: (app) => app.game.done('...') });
    registerCounter({ id: 'patents', show: (app) => ..., draw: (app, x, y) => app.ui.text(`${n}`, x, y, C.violet) });
    plate(ui, x, y, w, h, { accent: C.violet });   // any HUD panel
    label(ui, 'patents', x, y, C.violet);          // a small-caps title
    ui.small('+3', x, y, C.violet);                // a small figure
    ui.later(() => { /* a floating card, drawn last on the tooltip layer */ });

### Deviations from the brief

- The build bar's categories are the store's tabs plus Upgrades, not Logistics/Production (keys
  1-9 and the goal texts stay stable).
- The crawl is 10 px tall, not 9 (descenders).
- Power reads demand/supply, not supply/demand.
- The floor tabs and the line-health chip appear only when there is something to show (Folding;
  the first Miner), and the Research card after the Bellows: the first screen has one goal.
- A goal that names a screen opens it from its card, and the matching pill gives way.
- The Factory floor's store became a Modules tab in the build bar; stamping from it is a
  shift-click on a design's slot (the Modules screen has the full controls).
- Menus cover the build bar too (only the top bar and the crawl stay).
- Patents is not on the top bar yet: Milestone 5 registers it with `registerCounter`/`registerMenu`.

### The legibility round (after Milestones 5–6, 2026-10-20)

From the idle-critic's review (`DECISIONS.md`, "The Milestone 5–6 review round: UI legibility"):

- **Patent Office** (`src/app/patents.ts`): each node is a 20 px key with its own picture (item
  icon, UI icon or building sprite), its price on a chip at the bottom-right corner (a tick in the
  branch colour when owned) and a short label in small capitals under it, on a dark backing so
  prerequisite lines pass behind. The detail panel (176 wide): the picture and name; the effect in
  numbers against this run ("instead of 70 s"); "THIS RUN" in teal, what buying changes now; the
  price against the bank; "NEEDS" with ticks and crosses; the node's own line and its flavour as
  room allows; the Buy button. Read generically from the data (`effectInfo`).
- **Toasts** (`sideStack` in `src/app/hud.ts`): wrapped to the 156 (136) column, long words cut;
  trophy names on up to two lines; a toast with no room in full shows its title alone. At rest
  they are on the audit's `float` layer (`ui.floating(draw, 'float')`): checked for leaving the
  screen and covering HUD text; sliding in, on `tip` (unchecked).
- **Pinned report**: keeps `TOAST_ROOM` (54) under the top bar for toasts; a tall report widens to
  256, then drops its line report, then cuts with "+N more lines".
- **Hover report**: the status line, feed line and front line agree (a machine on its buffer says
  how long it has left); one brownout line, not three.
- **Icon fallback** (`uiIcon` in `src/app/chrome.ts`): an icon the atlas lacks draws as a 16x16
  code-drawn pictogram (Patents, Blueprints, Reset, Overnight) or a 16 px dark key with its glyph
  centred, never a bare 5 px glyph. The 8x8 (`half`) fallback is still the glyph.
- **Top bar**: "Reorganize +N" only once a reset is worth taking, its tooltip with Patents per hour
  this run and last; counters get the `room` they may use (`CounterDef.draw(app, x, y, room)`). On
  a narrow bar (not `L.wide`): the Orders group's keys fold into Orders (their names in its
  tooltip, any dot on it), the health chip drops zero problem pips, power drops its unit and bar,
  and the Reorganize key is the reset icon and "+N", so the floor tabs keep their place.
- **Rail**: the Megaproject card shortens "Great Drill, stage 1" to "Stage 1" where it must.
- **Screens**: new states `patentsHover` (a buyable node's panel) and `act2toasts` (a tall pinned
  report with toasts and trophies above it); toasts and trophies are shot at rest.

### Screenshots

`npm run screens` (e2e/out/screens/) covers every state at three sizes, now with `jam` (a slag
jam's hover report), `act2power` (a busy Act II Workshop with a brownout and a pinned report),
`slotHover` (a build slot's hover card) and `coinHover` (the coin drop-down). Before/after
pairs worth comparing: `1280x720-start`, `-act2ws`, `-factory2`, `-research2`, `-orders2`.
