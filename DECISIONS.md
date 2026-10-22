# Decisions

Every design decision with its reason, newest at the bottom. Format: date, decision, why, what
it rules out.

## Project setup (2026-10-20)

- 2026-10-20: **Name: Foldworks** (working title), replacing "Pocket Foundry". Why: the name comes from
  the signature mechanic, folding. Alternates: Byproduct, Tinyworks, Slag & Spark.
- 2026-10-20: **2D pixel art on the Trotline / Sprocket & Sprout engine layer**: TypeScript
  strict, Vite, Canvas 2D, 16 px tiles, integer zoom. Why: same framework as the owner's other
  games and the owner's TypeScript-for-everything rule (2026-10-16). Rules out Three.js.
- 2026-10-20: **Folding is the signature mechanic**: a working line folds into a one-tile module
  at its measured rate × an audit grade. Why: it gives "Pocket" a meaning, scales the factory
  without simulating every belt, gives the zoom-out progression (floors), and grades layout
  quality (pillars 1 and 3).
- 2026-10-20: **Sim tick is 20 Hz, not the 60 Hz of the other games.** Why: an incremental game
  fast-forwards and replays offline time headless; 20 Hz triples the speed of both, and belts at
  2 tiles/s don't need finer steps. The renderer interpolates. Ask before changing it.
- 2026-10-20: **One `Num` big-number type for every amount**, from Milestone 0. Why: retrofitting
  big numbers into an incremental game is the classic rewrite. Whether to wrap
  `break_infinity.js` or write our own is decided in Milestone 0.
- 2026-10-20: **Currencies: coin, reputation (per customer), and one per reset layer (Patents,
  Legacy, Kernels).** Research is item deliveries to the Hopper, not a currency. A new currency
  needs an entry here naming the pillar it serves.
- 2026-10-20: **Machine prices are flat; stamp costs grow linearly** (`bill × (1 + 0.5·n)`).
  Why: the not-list (no Cookie Clicker building curve); growth should come from designing
  better modules, land and floors. The pacing auditor watches whether this flattens the
  mid-game; if it does, the fix is a model change written here, not a hidden multiplier.
- 2026-10-20: **Megaproject progress survives every reset.** Why: the 100-hour game needs a spine
  that a reset doesn't erase (pillar 4).
- 2026-10-20: **No daily rewards, login streaks, timed events, ads or premium currency.** Why:
  pillar 4.
- 2026-10-20: **Community blueprint server and public scoreboards deferred**; blueprints are
  share strings. Why: no backend in scope; strings cover most of the value.
- 2026-10-20: **Agents**: `idle-critic` (the incremental/factory reviewer the owner asked for),
  `pacing-auditor`, `art-director`, `qa-screens`, following the other projects' agent set.
- 2026-10-20: **Dev server port 5210**; it collides with none of the other projects.

### Flagged as derivative (CLAUDE.md standing instruction; owner to decide)

- **The Hopper** (research paid in item deliveries to a central building) is Builderment's and
  shapez's hub. Kept because it is the best-known way to make research ask for specific lines,
  and the Dock/Hopper split (coin vs. research, chosen per belt) is our own twist. The critic
  should check it doesn't drift further toward Builderment (its tech tree, its item list).
- **Sparks** are the genre's golden-cookie role. Re-derived from the factory: the Inspector
  grades a real line and pays by its measured output; the Lucky Vein lands on a patch with a
  working miner. No floating random buff.
- **The Trophy Shelf** (achievements with small bonuses) is the role Cookie Clicker's milk
  plays. Each trophy gets a specific bonus tied to what earned it, never a pooled
  multiplier.
- **Challenges and autobuyers** are Antimatter Dimensions conventions. Allowed as genre
  conventions; names, numbers and order are this game's own.
- **The zoom-out through floors** echoes Universal Paperclips' stage changes. Ours are
  floors you build out of your own modules, not a text stage change.

## Milestone 0 — Foundation (2026-10-20)

- 2026-10-20: **`Num` is our own, not a wrap of `break_infinity.js`.** A hybrid: values below 1e15
  are plain doubles (so whole coin and item counts stay exact: 21 + 3 is 24, never
  23.999999999999996, and "can I afford it?" never lies), above that a mantissa in [1, 10) and an
  integer exponent that goes far past 1e308. Formatting floors (the display never shows more than
  you have): commas below 10,000, three significant digits with K…Dc suffixes, scientific past
  1e36. Why: exactness where the early game lives, no dependency, and every format rule in one
  place (`src/engine/num.ts`, `tests/num.test.ts`). Rules out: a break_infinity drop-in later
  without changing `Num` only.
- 2026-10-20: **Machine buffer slots are small plain counts, not `Num`.** A machine's input
  buffer (2 crafts' worth), output (4) and byproduct (4) are bounded slot counts; "every amount is
  a Num" covers stocks: coin, deliveries, the research bank, order progress, module stores. The
  purity test greps `src/sim/` for amount-like fields typed `number`.
- 2026-10-20: **Saves are a snapshot plus the commands since it.** Each save writes a fresh
  snapshot of the state (so the log is empty after a save); loading restores it and replays any
  logged commands. Tests check both the snapshot round trip and that seed + the whole command
  log from tick 0 replays to the identical state. Export strings are `FW1.<base64url>.<checksum>`.
- 2026-10-20: **Palette A, "Foundry", picked** (the owner asked Claude to run autonomously, so
  the lead picked the art director's recommendation; the owner can still swap to B, which is in
  `pixel-art/palette-test/`). Why: chroma only where the player looks (blue iron on warm earth
  reads by hue and lightness), brass modules are the clearest module-vs-machine cue, the warm
  plum darks suit a cosy 100-hour workshop. hull1/hull2 lifted one step; a 32nd slot `gold` for
  coin numbers. Pips: yellow 0.92 > green 0.76 > blue 0.64 > red 0.55 > grey 0.36 OKLab L.
- 2026-10-20: **Machine art turns with its rotation, light included.** Mk1 machines are drawn
  facing right and rotated in 90° steps; the top-left light turns with them. Subtle at 1×–2×;
  accepted for Mk1 to keep one strip per machine. Revisit for Mk2 (four directions if it shows).
- 2026-10-20: **The owner's direction: a full-screen, menu-dense UI** (Cookie Clicker / Clicker
  Heroes references, mid-session message). The HUD becomes framed panels on every side: a store
  column of large illustrated rows, tabs, a news ticker, a rolling counter, a research tree
  screen. Flagged as derivative (CLAUDE.md standing instruction): **the store column of big rows
  and the news ticker are Cookie Clicker's UI patterns.** Kept because the owner asked for this
  presentation, and re-derived so they serve this game's model: store rows have flat prices
  (no count-based price curve, PLAN.md not-list) and show what each machine makes per minute;
  the ticker is the *Swamp Gazette*, whose headlines report the player's own factory (its jams,
  its records, Bramble's orders), not random jokes alone. The research tree screen echoes
  Cookie Clicker's ascension tree in look only; its nodes are this game's item-delivery research.

## Milestone 1 — The Workshop (2026-10-20)

- 2026-10-20: **Slag Heap capacity 100 → 400** (DESIGN.md §4). With 100 the planner bot's heaps
  filled at about 13 minutes and every line stalled at once; 400 is about 53 minutes of one
  smelter, long enough to make a heap a plan rather than a chore, short enough that slag still
  needs a real answer later (bricks, ports). Rules out: infinite heaps.
- 2026-10-20: **Click priority** on a tile: a Spark first, then shovelling a byproduct out of a
  machine blocked by it, then cranking the Hand Furnace (until the Bellows), then hand-mining ore.
  Every counted click is capped at 12 a second (DESIGN.md §1). Why: the click that clears a jam
  must never be swallowed by the click that mines.
- 2026-10-20: **The Hopper takes slag only while the selected research still needs it** (the
  pacing bot found the loophole). A heap draining into the Hopper never filled, which made the
  heap's capacity meaningless, and the banked slag paid for Slag Bricks for free. **A Slag Heap
  holding slag can't be removed** (the full refund would empty it for free); it drains out its
  front.
- 2026-10-20: **Trophies are cosmetic in the slice** (29 of them, DESIGN.md §15 preview), each
  tied to a factory counter (deliveries, machines, jams cleared, S grades). Their small bonuses
  arrive with the Trophy Shelf proper. Why: no bonus may land before the model that prices it.
- 2026-10-20: **Bots.** `planner` follows a written plan (the order a strong player builds in),
  `greedy` buys the cheapest affordable useful thing and accepts every order, `dockOnly` sends
  everything to the Dock and feeds the Hopper only with what the node it is stuck on needs. All
  click at most 4/s, catch Sparks 2 s late, and replay exactly from seed + command history (a test
  checks it). Why: honest bots make the pace tests a statement about players, not about cheats.
- 2026-10-20: **Screens do not pause the game.** The research tree, orders, stats, trophies and
  options cover the floor while the factory keeps running, as an incremental game should; Help
  merged into Options. Toasts wait while a screen is open.
- 2026-10-20: **A drag starts on the tile the button went down on**, not where the mouse is by the
  next frame (a fast belt drag lost its first tile; found by the smoke test).

## Milestone 2 — The first fold (2026-10-20)

- 2026-10-20: **What the audit counts** (DESIGN.md §10). U is the mean busy share of every
  machine in the box, miners included. W is (byproducts that left through a port + byproducts
  consumed by a machine inside) ÷ byproducts made; **slag dumped into a heap inside the box counts
  as waste**, because a module has no heap that fills: W rewards routing slag out or using it,
  which is where Act II's zero-waste lines start. C counts machine tiles (miners included), not
  belts or logistics. Rates are counted at the box edge over the 60 s window. Why: each part
  measures something the player can see and change, and the card says which.
- 2026-10-20: **The grade multiplier scales a module's inputs as well as its outputs.** An S
  module runs 1.25× faster and eats 1.25× more, so ratios between modules stay what was measured.
- 2026-10-20: **At a fold, belts and other non-machines in the box are refunded; at an unfold
  they are bought again.** Machines go into the module (the stamp bill counts only machines).
  **Unfold puts the design back where it was folded**, if that ground is free; no placement
  ghost in the slice.
- 2026-10-20: **On the Factory floor a module takes in at its back and hands out of its front**,
  one route each; a module refuses what isn't one of its inputs, so a smelter module's slag
  blocks a press module (the report says so). **The Factory Dock scraps slag for 0** (the Workshop
  Dock refuses it), so a module with a slag port can still end at the Dock. Trunks carry 8
  items/s per tile, shared by every route through it, round-robin over a module's outputs.
  Module buffers hold 2 s of each rate (`RULES.moduleBuffer`, new, §11). Why: rate functions
  stay simple and legible; splitters on the Factory floor wait for Act II.
- 2026-10-20: **The slice ends** when three modules running at more than a quarter of their rate
  feed the Factory Dock, directly or through other modules (flag and event `sliceEnd`, Bramble's
  card).
- 2026-10-20: **Offline v1**: the first 10 minutes (12,000 ticks) replay in full through the same
  systems; only the extrapolated rest is paid at ×0.5, from what reached each Dock and Hopper in
  the replay's last 5 minutes. The report names the first machine or module that went blocked in
  the replay, with a button to go to it. The app reads the clock; the sim never does.
- 2026-10-20: **Esc never cancels an audit** (70 s lost to a stray key); Cancel is on the audit
  badge and the grade card. While a box is audited, edits inside it are refused with the reason.
- 2026-10-20: **Saves v2**: the state gains the audit, the module designs and the Factory floor;
  `MIGRATIONS[1]` fills them in for v1 saves.

### Flagged as derivative (Milestone 2)

- **Letter grades S/A/B/C/D** are a convention of rhythm and action games, not of the listed
  games; kept because the five bands map onto §10's multiplier table and read at a glance.
- **A factory inside one tile** echoes Factorissimo (a Factorio mod with factory buildings you
  walk into). Ours differs at the root: the line becomes a measured rate function with a grade,
  it is never entered again (unfold rebuilds it), and copies cost a linear stamp bill. Kept: it
  is the signature mechanic the plan is built on.

## The Milestone 1–2 review (idle-critic, 2026-10-20)

The critic played the build (by hand and with the planner bot) and found the slice ending 15 s
after the first fold, modules that could not chain, free S grades, and offline paying more
than staying online. Every fix below is in the sim with a test.

- 2026-10-20: **The slice ends with a factory, not three copies by the Dock.** Modules making
  **three different products** must be running, **at least one module feeding another**, each
  at half speed or better for **30 s straight**, all reaching the Factory Dock (`sliceEndParts`
  in `modules.ts`). Why: §14's third question ("does the hour end wanting the Factory floor?")
  needs the floor to be a puzzle before the slice can end. This replaces the earlier rule
  (three modules over a quarter speed), which ended the slice at 23:52, 15 s after the first fold.
- 2026-10-20: **Modules have a byproduct side.** Slag and oil leave a module through a side
  trunk that points away from it, as a Workshop machine's byproduct does (§4). With no side
  trunk they leave through the front with the rest. Why: before this, the only module that
  could feed another was one whose slag stayed inside, the very thing the grade card marks
  down. The card's advice ("belt it out through a port") now leads to a module that chains.
- 2026-10-20: **A heap inside the box still counts as waste (W).** The critic asked for W to
  measure where slag ends up, not where the box edge is drawn. A heap inside a fold never fills
  in a module, because a module is a rate function, so folding it in would make waste disposal
  free forever. Slag sent out through a port has to be dealt with on the Factory floor (the
  Factory Dock scraps it for nothing; a brick or gravel module uses it). So the grade rewards
  handing waste on. Kept, with this reason.
- 2026-10-20: **W counts the slag a jammed line would have made.** A line blocked by its slag
  makes none during the window, which used to give it W = 1. Now the ticks a machine spends
  blocked by its byproduct add the byproducts it would have made. The same applies to Factory
  audits.
- 2026-10-20: **Stamp prices count copies per product, not per design.** n in bill × (1 + 0.5 n)
  is every stamp of every design with the same main product, plus every fold of that product
  after the first. Why: re-folding the same line reset the price, so the best play was a
  re-fold chore. Folding is still allowed: it pays the machines' price directly.
- 2026-10-20: **A fold needs at least two kinds of machine** (miner, smelter, press, assembler,
  kiln and so on; Mk1 and Mk2 of a family count as one kind). Why: a lone miner in a 1×1 box
  graded S and stamped forever, and a module is meant to be a line.
- 2026-10-20: **Boosts never get folded in.** A miner being audited ignores a Lucky Vein, and an
  audited machine can't be overdriven. Why: a vein during the window folded an 111/min ore
  module, 3× the real line, for good.
- 2026-10-20: **The audit shows a projected grade while it runs** (`projectAudit`). The advice
  names what held each machine back across the whole window, not its state at the end. "Fed
  by" lists only machines whose output the target uses.
- 2026-10-20: **The Factory Hopper takes slag only while the selected research wants it**, the
  same rule as the Workshop Hopper. Why: without it, the slag-banking loophole closed in
  Milestone 1 reopened.
- 2026-10-20: **Offline replays up to an hour** (72,000 ticks, about a second), not 10 minutes,
  so heaps fill and lines jam during the replay as they would live. The report also names the
  heap that fills next. **A hidden tab's time away is now offline progress** when the tab comes
  back (it was lost). §12's ×0.5 and §13 check 12 contradicted each other: 8 h at ×0.5 is
  already 4 h. Check 12 is rewritten in DESIGN.md §13.
- 2026-10-20: **The Inspector pays in kind.** It now hands 60 s of the line's output × the grade
  to research, as items, not coin. Why: the critic flagged the coin payout as the shape of
  Cookie Clicker's golden-cookie "Lucky!" (a share of current output as a coin windfall). Items
  to research also serve pillar 2 (the Hopper).
- 2026-10-20: **The Gizmo is 1 gear + 2 wire** (it was + 3 wire). See the derivative flags below.

### Flagged as derivative (the Milestone 1–2 review)

- **Gear = 2 plates, wire 1 → 2, Gizmo = 1 gear + 3 wire** together had the shape of Factorio's
  gear wheel, copper cable and electronic circuit. The Gizmo is re-derived to 1 gear + 2 wire
  (DESIGN.md §3). Gear = 2 plates and wire 1 → 2 stay: §3's value steps derive them, and they are
  conventions several factory games share (Satisfactory's wire is also 1 → 2), not one game's
  recipe shape.
- **The store rows' large faded owned-count** is Cookie Clicker's building list. It is replaced
  by a small count badge on the icon (Milestone 4 UI).
- **The Inspector's "60 s of output" coin payout** had the shape of the golden cookie's "Lucky!".
  It now pays in kind (see above).

## Milestone 4 — Act II: the Factory (2026-10-20)

The owner asked for Milestone 4 in the same session as Milestones 0–3, so Act II's work started
before the Milestone 3 gate was formally reviewed. The gate review (idle-critic and
pacing-auditor) runs on the fixed slice, and Act II is built in parallel. Recorded here because
CLAUDE.md's standing instruction says to build nothing from Milestone 4 before that gate.

- 2026-10-20: **Power model** (DESIGN.md §18). Poles join everything within 2 tiles (the max
  norm, to any tile of a 2×2) into a grid, and Poles within 6 tiles of each other share one.
  Demand is the kW of every powered machine mid-craft (its mode applied). Supply is every
  fuelled producer's output. Every machine on the grid runs at supply ÷ demand (capped at 1).
  Fuel burns at demand ÷ supply of full rate. A powered machine on no grid, or with no supply,
  is starved with the reason "power" (the blue pip). Mk1 machines and miners need no power.
  Overdrive doesn't change a machine's draw: it rewards clicking, and §16 rule 4 needs it.
- 2026-10-20: **A Mk2 (2×2) hands its output out of either front tile, taking turns**, and its
  byproduct out of any side tile. Why: one rule like the Mk1's, with no hidden "output tile" to
  learn.
- 2026-10-20: **Claims are held by any design with miners inside**, one per ore per copy, not
  only by "source" designs with no inputs. Why: adding one token input would otherwise dodge the
  rule. Folding is never refused for claims (the line was already digging there); stamping is.
  Depth-2 designs hold their modules' claims.
- 2026-10-20: **The stamp bill counts power buildings as well as machines** (Boiler, Steam
  Engine, Generator, Pole). A folded line takes its power plant inside it, and copying the module
  copies the plant. Belts are still refunded at the fold and paid again at Unfold.
- 2026-10-20: **The Codex pays for the first Dock delivery of each item after Unit 7's rep 1**,
  whether or not that item was sold before. Why: a burst of firsts to chase, and the Codex is a
  reason to make one of everything.
- 2026-10-20: **The Megaproject Bay arrives with research, once its 2×2 at the Factory floor's
  bottom-left corner is clear.** It takes only what its current stage still wants, by trunk.
  Megaproject progress lives in `State.mega` for now; Milestone 5 moves it outside the run so
  it survives resets.
- 2026-10-20: **Nested folds** use the same grade formula, with fractional flows measured on the
  trunk routes crossing the box edge. A nested fold needs at least two modules, and a depth-2
  module can't be folded again.
- 2026-10-20: **Saves v3**: parts bank, claim blocks, the Codex, the Megaproject, the Factory
  audit and Act II reputation; `MIGRATIONS[2]` fills them in.

### Pacing round 3 (after the review fixes)

- 2026-10-20: **§13 check 9's window is revised from 60–90 min to "by 45 min on average, and at
  least 4 min after Folding".** Under the three-product rule, the cheapest honest route is three
  folds back to back (about 210 coin), and no Act I number lands after Folding (which has its
  own 22–30 min window). Measured: the planner gets there at 31:26, 4:18 after Folding and 2:53
  after its first fold. Greedy takes 29:51 and Dock-only 38:47. Why accept it: the slice no
  longer ends with the Factory floor unexplored (three folds and a chain on the floor), and
  Act II now follows straight on, so a slice end at about 30 min sends the player into the next
  act rather than to a stop. §16's "90 min" row now means Act II is under way. Levers if
  playtesting says the floor phase is still too short: a coin price for placing a module, or a
  Gizmo required among the three products.
- 2026-10-20: **Chunk C: 4,000 → 1,000 coin.** Saving 4,000 at 180–540 coin/min landed after
  Folding, so its gear lines never fed it, and the wait was the worst dead air (check 10). It is
  now bought early, and its four gear lines are built one at a time.
- 2026-10-20: **The Boardwalk: 200 plates → 80, 1,500 coin → 600** (still 1.5× their value).
  Taken at about 4 min, when one plate line feeds the Dock, it stopped all coin income for
  6.7 min at 200; at 80, 2.7 min.
- 2026-10-20: **Folding: 400 → 500 gears.** It puts the Dock-only player 7.1 min behind the
  planner (check 11; the Inspector and Gizmo changes had cut that to 4.1), with the planner at
  27:07, inside the 22–30 window.
- 2026-10-20: **Check 12 is two tests:** 8 h offline pays at most (a) what leaving the game open
  and idle for the same 8 h pays, and (b) 4.5 h of the active rate. Measured: 0.79 of (a) and
  1.78 h. Idle heaps fill: the open factory makes 126K in its first hour, then a flat 40.5K an
  hour once 11 of 23 Workshop machines jam.

### Act II's Workshop UI (Milestone 4)

- 2026-10-20: **Toasts live at the bottom of the left column, never over the board** (the
  review: two toasts covered half the Factory floor at 1024×640). They slide in with a colour
  flash and an icon.
- 2026-10-20: **The store's owned count is a small badge on the icon.** This closes the Cookie
  Clicker flag on the large faded count.
- 2026-10-20: **Store tabs (Build, Power, Heavy) appear when something in them is unlocked.** A
  tab gaining a new unlock blinks gold until opened. Keys 1–9 pick from the open tab.
- 2026-10-20: **When the bottom bar is short of room, the menus' labels go first, then the
  tools'.** The floor tabs always show.
- 2026-10-20: **Refusal popups float above the layout** and are left out of the overlap audit
  (they are transient and placed under the cursor).
- 2026-10-20: **Power is drawn, not just reported.** Sagging wires between linked Poles, with a
  pulse on live ones (amber in a brownout), a reach overlay while placing or hovering any grid
  building, a flicker and amber bolt on brownout, and the blue pip and bolt with no power. A
  supply/demand readout sits under the status strip.

### Act II's screens (Milestone 4)

- 2026-10-20: **Every full-screen menu's header links to the others** (Orders, Modules, Codex,
  Survey, Drill, each once unlocked), and the Factory store column has quick links. Why: the
  owner's "menus and menus and things you can click on"; no menu is a dead end.
- 2026-10-20: **Orders has a tab per customer met**, with a portrait that cheers after a fill,
  reputation and rewards (reached ones lit, the next one showing what it takes). A price board
  of every item, its value and how many sold, fills the rest of the screen.
- 2026-10-20: **The audit badge shows a projected grade with live U/W/C bars** on both floors.
  Why: the critic called the 70 s wait dead air; now there is a number to watch move.
- 2026-10-20: **Twelve Act II trophies.** "First power" counts the first grid with power
  flowing (`gridsLit`), and "first Mk2" counts any Mk2 (`mk2Built`), both new counters.

## The Milestone 3 gate (2026-10-20)

The pacing-auditor's gate audit: the Workshop stretch (0–28 min) passes every check with tight
seed spreads and honest bots; the gate failed on three things (check 11, the floor phase being
only the audit timer, and §16 rule 4 after the slice). Fixed or decided:

- 2026-10-20: **A Lucky Vein runs the whole line its patch feeds at 3× for 60 s**, not just the
  patch's miners. Why: in a balanced 1:1 line the extra ore only backed up, so catching a Spark
  earned nothing and active play after the slice earned exactly what idle play did (rule 4 at
  1.00). Boosts still never reach an audited machine.
- 2026-10-20: **The Codex pays 30× an item's value for its first delivery** (it was 100×). At
  100× it was a ~71K one-off burst, and a single motor paid 42K, 0.7 of the whole Grand Turbine
  order. Still a burst worth chasing.
- 2026-10-20: **§13 check 7 accepted as measured.** A realistic one-machine imbalance (4:2 or
  3:3) grades B, one step under a balanced A, not C. §10's derivation is rewritten: balancing
  is worth a grade step and a machine, and handling slag is worth the whole grade.
- 2026-10-20: **Overdrive's ceiling is +50%** (10 s at 3× in every 40 s), not the "+67%" §18 said.
  §16 rule 4 in Act II is measured on building, orders, Sparks and Overdrive together.

### Flagged as derivative (the Milestone 3 gate)

- **Machine Kits paid per stamp and made by your own lines** have the shape of shapez's blueprint
  cost (pasting a blueprint costs a shape your factory makes). Ours differs: kits are needed
  only for designs holding Act II buildings, they scale with the design's bill
  (1 + floor(bill ÷ 1,500)), and Machine Kits are one recipe among Act II's products. ROADMAP.md
  Milestone 4 names Machine Kits explicitly, so they stay for now. **For the owner:** the
  alternative that re-derives "production feeds expansion" (§15) without a dedicated item is
  for a stamp to consume the steel and gears its Act II machines are made of, delivered to the
  Factory Hopper.

### The gate's blocking findings, fixed (2026-10-20)

The idle-critic's gate verdict was "pass with conditions"; its four blocking findings and the
auditor's slice-end and rule-4 levers are settled here.

- 2026-10-20: **An audit takes stock already in the box off its outputs.** Items held in crates,
  buffers and belts when the window opens are counted; whatever of them leaves during the window
  is subtracted from the outputs (the same item first, then by value). Why: a crate of Gizmos
  draining out of a box graded as a Gizmo factory and folded into one (finding 1).
- 2026-10-20: **A brownout lowers U.** A machine's busy time counts at the speed power let it
  run, and a machine jammed on slag counts the slag it would have made against W. Why: an
  underpowered line graded the same as a powered one.
- 2026-10-20: **A grade S+ (≥ 0.97, ×1.35) sits above S**, and every grade gets advice, each line
  worth what it would add ("+0.12 → A"), with the bottleneck named. Why: S was the default for
  any tidy line, so a perfect line had nothing left to reach (finding 3). A new top grade, not a
  currency, floor or reset.
- 2026-10-20: **Up to three Workshop audits at once** (`RULES.maxAudits`), boxes never
  overlapping, each folded or cancelled by id. Why: the slice's three folds were three 70 s waits
  in a row (finding 10). Saves migrate v3 → v4 (`audit` → `audits[]`).
- 2026-10-20: **A nested fold needs a chain inside its box**: at least one module in it must feed
  another in it. Why: two unrelated modules boxed together stacked ×1.25 on both for nothing
  (finding 4). The depth-2 bill is the sum of its modules' bills.
- 2026-10-20: **Overdrive runs the clicked machine's whole line**, and on the Factory floor a
  click overdrives a module and every module joined to it by trunks. Why: one machine at 3×
  only starved or backed up its neighbours; the auditor measured 1.03× over idle (rule 4).
  Audited machines are never overdriven.
- 2026-10-20: **The slice ends when Bramble's Gizmo Festival is filled** (400 Gizmos, paying
  64,000, only Factory Dock deliveries count). Why: "three products chained for 30 s" was met
  by the audit timer alone, so the floor phase had no build in it. Gizmos at rate need a Gizmo
  module fed by gear and wire modules: the Factory floor has to be built.
- 2026-10-20: **The Hand Furnace starts with a Slag Heap under it.** Why: hand-smelting jammed
  before the first Miner and the critic lost 100 s of clicks to it; the slag lesson now comes
  with the first built line, where a heap is a decision rather than a chore.
- 2026-10-20: **Machine Kits: 1 + floor(bill ÷ 500)** (was ÷ 1,500). Why: at 1,500 a stamp took
  2–3 kits, about 3% of its price in goods, a chore with no weight.

### Flagged as derivative (the gate fixes and Act II; owner to decide)

- **Power** (boilers and steam engines that must touch, poles with a square reach and a link
  distance, a satisfaction ratio that slows every machine on the grid) has the shape of
  Factorio's steam stage. ROADMAP.md Milestone 4 names boilers, engines, poles and generators,
  so it stays; ours differs in that power gates only Act II buildings, fuel is Coal from your own
  lines, and a brownout is graded (U drops). **For the owner:** a re-derivation that keeps the
  roadmap's pillar is power as a per-module upkeep paid in Coal at the Factory Hopper.
- **The Motor** (steel + gears + wire) resembles Factorio's engine unit; it is re-derived as
  1 steel + 4 copper wire + 1 circuit, so it reads as a wound coil on a board.
- **Plastic from coal** follows the common factory-game chain; it stays as one Act II recipe.
- **The Megaproject Bay** (a fixed building that eats staged deliveries for a floor-wide reward)
  resembles shapez's hub levels and Factorio's rocket silo. Ours is staged by Bramble's orders
  and pays a +50% drill boost, not a win. Kept; the owner may rename or re-theme it.

### Pacing round 4 (the Festival slice end, 2026-10-20)

- 2026-10-20: **Lamp Posts wants 60 gears + 200 wire and pays 2,000** (was 150 + 300 for 4,500).
  Why: one order runs at a time and Lamp Posts' gears are research's until Folding, so it held the
  order slot, and the Gizmo Festival behind it, ~9 min after Folding.
- 2026-10-20: **The starting Slag Heap faces east**, into a second heap a player puts beside it,
  never onto a belt below it (a heap empties out of its front).
- 2026-10-20: **§13 check 9 is the Festival**: filled by 45 min (planner mean), no sooner than 6 min
  after Folding. Measured 31:43, 8:23 after Folding; all 26 Act I pace tests pass (DESIGN.md §13,
  "Round 4").
- 2026-10-20: **The bots audit up to three lines at once**, fold only once every running audit is
  graded (a fold takes away machines another audit may be measuring), audit a line only while it
  runs, and name designs instead of indexing them. The planner and Dock-only player take orders in
  plan order; the greedy player sends L1's gears to its active order before research.
- 2026-10-20: **A fold needs two kinds of machine, or one machine in the box feeding another.**
  Why: the Act II bot found the old rule refused an all-assembler line (circuits into motors),
  which is a line by any reading; a lone miner, or two machines side by side that don't feed each
  other, are still refused.

## The Milestone 4 review (idle-critic, 2026-10-20)

Fixed in the sim:
- 2026-10-20: **Stock drawn down inside an audited box becomes the module's input** (the same
  item still nets off its output). Why: the value-based discount let 0-value items through: a
  crate of steel feeding a kit assembler folded into Machine Kits (and Drill Bits) from nothing.
  Drawdowns of 3 or fewer of an item are belts settling and are ignored.
- 2026-10-20: **S+ needs the line's byproducts used inside the box** (80%), or none made. Why:
  S moved up a grade instead of being fixed: a miner and a smelter with a heap outside graded S+,
  while the real multi-stage Gizmo works got A. S+ now asks for the zero-waste line (bricks,
  gravel) that §15 and Act II's slag → concrete chain promise.
- 2026-10-20: **A copy isn't placed on the Factory floor past the claims held.** Why: a re-folded
  copy got around them (copper at 6/5). Folding stays free of claims; placing is checked.
- 2026-10-20: **No premium on re-folding a product.** The critic proposed charging the stamp
  premium on every fold after a product's first. Not done: a re-fold costs the machines again
  plus a 70 s audit, and stamping is the convenience of skipping both; with claims now checked at
  placement, re-folding gets around nothing that matters.
- 2026-10-20: **A nested fold boxes one connected group**: every module in the box joined to the
  others by trunks inside it. Why: one internal pair let strangers ride along and take a second
  grade multiplier.
- 2026-10-20: **The Great Drill never boosts what is being audited** (miners and Factory modules).
  Why: its +50% was measured into a fold and then applied again to the module holding miners.
- 2026-10-20: **One-off payouts (orders, Codex firsts) don't count in the coin-per-minute rate**;
  the hover report shows a brownout's real speed, and a crate feeding a machine.

Handed on: the economy (Act II goods out-earn a Gizmo chain per tile, Act II prices rebased to
the measured ~7.2K coin/min, coin goals between research nodes) to the Act II bot's round; the
Next card, the module hover, the S+ banner, the slice-end card, Bramble's town and the missing
fanfares to UI wave 3. Patents from lifetime coin alone let an idle slice factory earn ~14 against
the Act II bot's 15: **the Patents formula is reopened for Milestone 5** (products, grades and
Megaproject progress are candidates).

### Flagged as derivative (the Milestone 4 review; owner to decide)

- **Machine modes** (Efficient, Overclocked, Precision) map onto Factorio's efficiency, speed and
  productivity modules, under Satisfactory's "overclock" name. ROADMAP.md Milestone 4 names the
  three modes, so they stay. **For the owner:** a re-derivation from Foldworks' own model is
  byproduct modes: in place of Precision's +25% yield, a *Thrift* mode (half the slag, 0.8×
  speed) and a *Recycling* mode (takes slag back in with its ore), which make the slag puzzle the
  thing a mode changes.

### UI wave 3 (the Milestone 4 review's juice and fullness, 2026-10-20)

- 2026-10-20: **The default camera zoom fills the view** (integer zoom; the floor pans by
  right-drag, WASD or resting the mouse at an edge, with faint arrows where there is more). Why:
  at 1280×720 the 24×16 Act II Workshop drew at 1× in a quarter of the screen.
- 2026-10-20: **Bramble's Town grows on the water around both floors as orders are filled**: two
  houses at the start, a boardwalk for The Boardwalk, lamps for Lamp Posts, stalls, bunting and
  walking frogs for the Gizmo Festival, Unit 7's observatory and Voltaire's pavilion with their
  first orders, a house per order filled. Each piece arrives with a burst, a sound and a Gazette
  line, and hovers with what it is from and when (orders.doneAt, kept in the save). Why: the owner
  wants the screen full and alive, and orders had no lasting trace. A record of progress, not a
  currency or a mechanic: it changes no number.
- 2026-10-20: **The slice end is a celebration**: the Festival's Gizmos parade along the trunks into
  the Factory Dock, then the card counts the 64,000 up with Bramble cheering. Coin cascades from
  the Dock on every order filled; Codex firsts, the first Mk2 and each reputation level get a
  banner and a fanfare. Heap alerts show once per heap and sit under the Act II goal after the
  slice end.

### Act II pacing (the bot)

- 2026-10-20: **Act II's targets are measured from the slice end S (the Gizmo Festival, about
  0:31), not the clock.** Why: the slice ends about an hour before §16's 90-minute budget, and
  every Act II number has to be set against the factory the player actually has then. Steel by
  S+25 min, power S+35, circuits S+60, the Concrete fold S+80, the Great Drill's stage 1 by S+4 h
  (DESIGN.md §18 Pacing targets; `tests/pace-act2-run.test.ts`). Serves pillar 1 (pacing is
  tested). Rule 1 is not met while the Bay fills (goals about 40 min apart): an open item.
- 2026-10-20: **Act II coin prices are set against measured income (about 12,500/min from the
  slice end), not against Act I prices**: chunk E 15,000 → 60,000, F 40,000 → 120,000; claim
  blocks iron and copper 5,000 → 25,000, sand 8,000 → 40,000, coal 12,000 → 60,000; Boiler
  1,200, Steam Engine 2,000, Generator 2,600, Pole 150, Kiln 3,000, Mixer 4,000, Refinery 9,000;
  Mk2 Smelter, Press and Assembler 6,000, 9,000, 20,000 (4× speed; generator 200 kW). Why: the
  Milestone 4 review found E at 2.1 minutes of income, a claims block 41 s and coin piling up
  unspent. No Dock saturation mechanic (the lead's decision). Machine Kits count bills, so ten
  times the machine prices is ten times the kits per stamp: **proposed** `kitDivisor` 500 → 5,000
  to keep kits per stamp where they were (RULES are the lead's).
- 2026-10-20: **Act II goods out-earn the Gizmo per module tile**: steel 15 → 22, glass 8 → 12,
  plastic 16 → 24, concrete 22 → 32, circuit 110 → 180, motor 420 → 640, and every Act II order's
  payout re-derived at about 2.1–2.2× its goods (Calibration 13,000, Lens Array 34,000, One of
  Everything 14,500, Streetlamps 64,000, Promenade 56,000, Turbine 85,000). Why: a Gizmo chain is
  3 modules at 0.27/s × 80, 7.3 coin/s a module; an S-grade module of a full-speed Act II line
  now beats it (Steel 9.2, Glass and Plastic 7.5, Concrete 13, a Circuits chain 15 a module).
  The bot's one-miner lines fold thin and fall under it (Plastic 5.7, Glass 2.3), which pays a
  player for widening a line before folding.
- 2026-10-20: **Research costs**: Coal Seams 600 gears, Steelmaking 300 coal + 300 gears, Steam
  Power 500 coal + 400 gears (no item that only the next chunk can make); Concrete 500 gravel +
  400 sand → 200 + 200, The Great Drill 60 motors + 600 concrete → 40 + 200. Why: one steel
  line's slag (0.17–0.3/s) is the only gravel in the Workshop; the old costs put Concrete 1.5 h
  after Crushing and the Great Drill's concrete over 3 h of it.
- 2026-10-20: **The Great Drill's stage 1 wants 450 Drill Bits and 2,000 steel** (was 40 bits,
  1,500 concrete, 600 steel). Why: set from the bot's Bay floor (a Drill Bit is 2 concrete, 8
  slag; the floor turns about 35 slag/min into bits), so stage 1 lands at S+3:20–3:23, inside the
  S+4 h target. Concrete left the wants: a floor that sends concrete both to the Drill works and
  to the Bay needs two Concrete copies (Machine Kits), and the concrete is in every bit.
- 2026-10-20: **Patents divisor 2,500** (`RULES.patentDivisor`): 5 h of the bot is 2.0–2.05M
  lifetime coin, 14 Patents (4 h 13, twice the coin 19). Provisional: the formula is reopened for
  Milestone 5.
- 2026-10-20: **The Act II bot clears the Act I Gizmo chains from the Factory floor when the
  Great Drill's floor needs the room** (`fremove`, newest chain first), the lead's call. Income
  falls from about 12,500/min to 4,300/min while the Bay fills; the bot then places Iron ingots
  and Copper wire copies on the Dock's free sides.

Findings for the sim and design (not changed here):
- **A module whose outputs are consumed in another ratio than it makes them stalls for good**:
  a Glass & plastic module feeding a Circuits module (measured at 0.12 glass to 0.075 plastic)
  fills its plastic buffer, stops, and starves the Circuits module of glass. Any audit's measured
  ratio is off by a few items, so every multi-output module feeding one consumer deadlocks
  eventually. The bot folds the glass and plastic works twice, once with each half stopped, to
  get single-output designs. Proposal: a blocked output should not stop a module's other outputs
  (or let a trunk carry the surplus on to the Dock).
- **Byproduct loops deadlock the same way**: a module that waits on Concrete must not send its
  slag into that Concrete (Concrete full of slag waiting for oil stops the Steel that feeds the
  Drill works that Concrete waits on). The bot's Bay floor sends those byproducts to the Dock.
- **Rule 1 while the Bay fills**: the last 1.5 h of Act II has three goals (Tuning, Nested Folds,
  the stage). Candidates: the stage's items as separate visible goals, Surveying at an Act II
  cost (its 100 slag bricks need a brick press nobody builds in Act II) so claims become a goal,
  and orders reachable from the Bay floor.

### After Act II's bot (2026-10-20)

- 2026-10-20: **A module with several products runs while any one has room; a full one spills.**
  Why: Act II's bot found a multi-output module deadlocked for good whenever its consumer took the
  products in another ratio (and audit noise makes every measured ratio slightly off). A
  byproduct with nowhere to go still blocks: that is the slag lesson.
- 2026-10-20: **Machine Kits: 1 + floor(bill ÷ 5,000)** (was ÷ 500). Why: Act II machine prices rose
  10× against the measured income, and kits per stamp should not.
- Open: rule 1 (a goal within reach every 3 min) fails for ~40 min while the Megaproject Bay
  fills (Act II pacing, the bot); coin piles up (~1.8M at 5 h) with too few sinks; the bot doesn't
  use nested folds yet. Carried to Milestone 5's planning.

## The UI redesign (2026-10-20)

The owner, after the Milestone 4 build: "Redo UI, it's crowded but not in a good way,
cross-reference successful games and cook up for me." The full, dense, dopamine-rich direction
(Cookie Clicker, Clicker Heroes) stands; the *kind* of density changes. The brief, the
cross-referenced games and what was built: `docs/ui-redesign.md`. This replaces the HUD layout
of the owner's earlier full-screen direction (above, Milestone 0) and of the Act II Workshop UI
notes (Milestone 4); each superseded note is named below.

- 2026-10-20: **Two panel weights.** Every HUD piece is a *plate* drawn in code from the palette
  (ink at 90%, a 1 px outline, a lighter or accent top edge, notched corners; `plate()` in
  `src/app/chrome.ts`). The ornate wood-and-brass 9-slice (`frame()`, the art's `ui_panel`) is
  kept for full-screen menus and celebration cards only. Why: thirteen identical heavy frames
  gave the eye nowhere to land; rare ornament makes opening a menu feel like opening something.
  Inside menus, `card()` is now a flat section (no wood inside wood).
- 2026-10-20: **The floor is the star.** The camera frames the area right of the card rail,
  between the top bar and the build bar (`layout.ts` `center`); the water and town draw across
  the whole canvas behind the HUD. At 1280x720 the floor view is ~80% of the width (it was
  ~53%). Supersedes "the floor in the frame between" the two columns.
- 2026-10-20: **A thin top bar (20 px) carries the global state**: the coin counter (the one
  loud thing: big gold digits that roll, bump, glint and sweep; the rate beside it), Machine
  Kits and power once they exist, the line-health chip, the floor tabs and the menus. Why: a
  resource bar at the top is where every player of the genre looks first.
- 2026-10-20: **Shipping moved into the coin counter's drop-down** (hover the counter: the whole
  number, the rate, the income sparkline, earnings, and every item shipped with its per-minute
  rate). Why: a list of sales on screen all the time at the same weight as the counter was the
  brief's "static text in prime space". Stats keeps the full delivered list.
- 2026-10-20: **The status strip became the line-health chip** (green/yellow/red/blue counts,
  red edge blinking while anything struggles; a click jumps to the worst problem and opens its
  report, the old "find"). Hidden until the first Miner: the first minute has one goal.
- 2026-10-20: **Power reads demand/supply** ("380/300 kW", amber in a brownout, a bar when there
  is room). Why: "used of available" is the convention players read without a legend; the
  tooltip names both. Supersedes the readout under the status strip.
- 2026-10-20: **Floor tabs appear once Folding is researched.** Before that there is one floor
  and nothing to choose; the floor's name plate went (the tab says it).
- 2026-10-20: **The menus are icon keys on the right of the top bar**, with a dot when something
  waits inside (blinking gold until first opened, steady red for news); the name and key are in
  the tooltip. Game screens first, then Stats, Trophies, Options after a divider. Supersedes the
  bottom bar of fifteen equal buttons and its label-dropping rule.
- 2026-10-20: **Floating cards on the left rail**, 4 px apart, each a plate with its accent edge
  and a small-caps title: Goal, Order, Research, Megaproject. A click on the title folds a card
  to that line; a click on its body opens its screen. Nothing else lives in the rail.
- 2026-10-20: **The Goal card is the old "Next"**, and at the start it carries the Bellows (a bar
  to 25 coin, then a gold Buy button). When the goal changes (its text without its live
  numbers) the card slides in, flashes and chimes. A goal that names a screen, a floor or a
  tool opens it from its card. Supersedes the Bellows card at the top of the store.
- 2026-10-20: **The Order card** shows the customer's portrait, the order's name and one bar per
  item ("Factory Dock only" when it counts there alone); with no active order, a one-line pill
  "N orders offered" instead. **The Research card** shows the node and its bar; with none
  selected, a "Pick research (T)" pill. Pills are plates in their accent colour, not gold
  buttons (gold is for buying), and give way when the goal already names their screen. The
  Research card waits for the Bellows: the first minute has one goal.
- 2026-10-20: **The build bar** is centred at the bottom: category tabs over one row of square
  slots (sprite at 1x, hotkey, price), a gold edge when affordable, a red dot when new, a
  padlock over a dark silhouette when locked; the rich detail (sprite at 2x, price, rate,
  description, what you own) in a hover card above the slot. Left of it the tools: Rotate,
  Remove, Fold (with its audit count) and Flow, with their keys. Supersedes the store column of
  54 px rows and the "???" locked rows.
- 2026-10-20: **The build bar's categories are the store's tabs (Build, Power, Heavy) plus
  Upgrades** (the Bellows and land), not the brief's Logistics/Production split. Why: keys 1-9
  pick from the open tab and the goal texts name them ("a Miner (2)", "a Boiler (Power tab)");
  splitting Build would renumber the keys the first minute teaches. The nine basic buildings fit
  one row. Changes the brief.
- 2026-10-20: **On the Factory floor the build bar has one tab, Modules**: the trunk belt (1) and
  the designs (2-9), each slot with its spare count and grade; a shift-click stamps a copy, and a
  last slot opens the Modules screen when there are more than eight. Supersedes the Factory
  store column and its quick links (the Survey Office, Codex and Drill are top-bar menus).
- 2026-10-20: **Prices on slots are gold when affordable and grey when not** (they were red).
  Why: at the start nothing is affordable, and a row of red read as an error.
- 2026-10-20: **Toasts stack from the top-right corner, newest on top**, sliding in with a colour
  flash and fading out; trophies just earned stack under them. No column behind them; they
  float (the overlap audit treats them as transient). Supersedes "toasts live at the bottom of
  the left column".
- 2026-10-20: **The pinned report anchors bottom-right above the build bar**, its top edge in its
  status pip's colour, and moves left of the floor when it would cover what it reports on.
  Hover reports stay tooltips at the mouse, in the plate style.
- 2026-10-20: **The Swamp Gazette is a crawl along the bottom edge** (10 px: the brief said 9,
  but the font's descenders need 10), dim, with no frame; breaking news (the town growing, an
  order filled: a new "EXTRA!" headline) runs bright for its first pass. Supersedes the ticker
  across the top.
- 2026-10-20: **Diegetic touches on the map**: the active order's flag over the Dock it fills at
  (the customer's colour, waving, with a small progress bar), and a progress ring with the
  node's icon over the Hopper for the selected research. Drawn under the HUD, outside the overlap
  audit (they are world markers, like the goal arrow).
- 2026-10-20: **Three text sizes**: the big digits (the counter, grades), the normal font, and a
  new 5 px small font (capitals and figures) for card titles, keys, prices, units and secondary
  numbers. Spacing on a 4 px grid: 4 px between cards, 6 px inside them.
- 2026-10-20: **Accent colours carry meaning**: gold is coin and "you can buy this", teal research
  (and a tool that is on), leaf orders and customers (each customer has their own colour on
  their card and flag), copper heat and jams, violet Patents and resets, blue power.
- 2026-10-20: **Every full-screen menu uses one template** (`menuTemplate()` in `widgets.ts`): the
  ornate frame, a header bar (icon, title in the accent colour, the menu's tabs, Esc and a close
  key), the content, and an optional detail panel on the right (the research tree's node card is
  the model). The header's tabs are the screen's group (Orders, Modules, Codex, Survey, Drill;
  Stats, Trophies, Options; the research tree's Workshop and Act II pages). Menus cover the
  floor and the build bar; the top bar stays, so the coin keeps counting.
- 2026-10-20: **Buttons and tabs are code-drawn in the plate language** (a dark key with a lighter
  top edge; gold for buy-or-do, teal for on). The art's `ui_button`, `ui_tab`, `ui_row`,
  `ui_toast`, `ui_tip` and `ui_ticker` are no longer drawn; `ui_panel`, `ui_panel_light`,
  `ui_inset`, the icons, the coin, portraits, grades and nodes are. Why: the HUD must restyle with
  the palette (the art revamp may change it) and stay calm under the juice.
- 2026-10-20: **Other files can add menus, counters and screens** (`registerMenu`,
  `registerCounter` in `topbar.ts`, `registerScreen` in `screens.ts`), so Milestones 5 and 6 add
  Patents, Blueprints and the rest without editing the HUD.
- 2026-10-20: **All the juice stays**: coin pops and coins flying into the counter, its roll,
  bump, glints and sweep; confetti, banners (now centred between the rail and the toasts), the
  S+ card, the fold animation, Overdrive glows, the town growing.

### Flagged as derivative (the UI redesign)

- **A top resource bar, a numbered hotbar under category tabs, floating objective cards, tabbed
  full-screen menus and a news crawl are genre conventions** (shapez, Timberborn, Factorio,
  Cookie Clicker, Mindustry, Against the Storm and Melvor Idle all use variants). No layout, art
  or wording is copied from any one of them.
- Closer to one game: **the line-health chip's click-to-jump is Factorio's alert behaviour**, and
  **the order flag over the Dock echoes Dorfromantik's quest flags**. Kept: the chip counts this
  game's own status pips and opens this game's plain-English report; the flag shows an order's
  progress on the Dock that fills it, which nothing else on the map did.
## Milestone 6 — Idle and offline (2026-10-20)

Built in parallel with Milestone 5 (Reorganize, Patents) on the lead's instruction; the two meet
at `offlineEfficiency(g)` and the save version, which the lead renumbers at the merge.

- 2026-10-20: **Time away counts up to 7 days** (`RULES.offlineCapHours` 24 → 168, ROADMAP.md
  Milestone 6). Why: a holiday week should be paid; a month away is not a factory left running.
- 2026-10-20: **Offline efficiency is one function, `offlineEfficiency(g)`**: 0.5, plus the Night
  Shift, plus Patents (Milestone 5), capped at 0.75 (`IDLE.offlineEffMax`). Why: one place that
  every caller (the offline run, the forecast, the overnight screen) reads; the cap is the number
  the pace test proves honest.
- 2026-10-20: **The Night Shift: two coin upgrades, +0.05 each (150,000 after Steam Power, 400,000
  after Circuits), flat prices.** Why: Act II coin piles up with too few sinks (1.8M at 4 h), and a
  small, permanent offline gain is a sink that serves pillar 4; each pays back in one or two
  nights (DESIGN.md §20). Kept to 0.6 so Patents own the rest of the road. A new command
  (`idleUpgrade`), not the Bellows' `upgrade`, so the Bellows' toast and store row are untouched.
- 2026-10-20: **Offline, lines run at live speed and deliveries count at the efficiency.** Why:
  the jams and heap fills the report names happen at the times the player would have seen them,
  and offline ≤ open idle holds piece by piece (replays pay as live, extrapolation pays less). The
  alternative (lines at half speed) would put jams twice as late as live and make the forecast
  wrong.
- 2026-10-20: **Extrapolation runs in segments that end when a heap fills or the Megaproject Bay is
  given all it wants of an item**, each followed by 4 minutes replayed live (60 s for the jam to
  spread, 3 min to measure). Why: v1 extrapolated 23 h from the replay's last 5 minutes, so a line
  that jammed in hour 2 was paid for 22 more hours; with a 7-day cap that error would have been
  the whole report. The Bay's intake and the Factory Dock (Factory-only orders) are now measured
  too. No cap on segments: they are bounded by the heaps and Bay wants on the floor.
- 2026-10-20: **A jam is a machine or module blocked 10 s straight**; the timeline names every one
  (not only the first), each heap filling, orders, research and the Megaproject, with a jump-to
  per jam and heap. Why: a belt that is briefly full blocks a machine for a tick (traffic, not a
  jam), and the slice's card named only the first jam.
- 2026-10-20: **Offline runs and forecasts are spread over frames** (20 ms a frame, a progress
  bar). Why: an Act II factory's hour-long replay is 3–5 s of ticks, and a frozen page on return
  is the stutter the roadmap rules out.
- 2026-10-20: **The forecast is the offline model on a copy of the game.** Why: the evening's
  forecast and the morning's report must agree (pillar 4); one computation guarantees it, and a
  copy keeps the live game deterministic.
- 2026-10-20: **"Stop" (`pause`) is a logged sim command**: a stopped machine or Miner takes
  nothing, makes nothing, draws no power and keeps its buffers; splitters route around it; a
  stopped module runs at 0 and takes nothing; a whole line (by any machine or by its heap) or a
  trunk-joined group at once. Why: the lead asked for a stop that is useful and real. Its use is
  keeping a heap's room for when you are back and choosing, line by line, what runs overnight;
  it earns nothing while stopped, and the forecast shows that in coin. Not built: a "bypass" mode
  that passes inputs through unprocessed (it would make every machine a belt).
- 2026-10-20: **Inspiration: a click on a Hopper, from the slice end on.** 0.1% of the selected
  node's remaining cost per item, up to 30% of each item per node (`State.inspire`), under the
  12 clicks/s cap. Why the Hopper: it is where research is paid, so the click is where the line
  delivers, and it needs no new building. Why the slice end: PLAN.md and the roadmap put
  Inspiration with Act II+. A capped click is quiet (ok, nothing given) so a fast clicker does
  not toggle the research screen. The Factory Hopper takes it through `fclick`.
- 2026-10-20: **Notation is a player setting outside the sim** (localStorage `foldworks_settings`,
  `setNotation` in `num.ts`): standard, scientific, engineering, letters. Why: it changes how
  numbers are written, never a number, so it must not ride in a save or an export string.
- 2026-10-20: **One number helper, `src/engine/fmt.ts`**, for amounts, rates, kW, shares,
  multipliers and durations; the HUD's counter and rates, the coin pops, kW and the hover report
  go through it. Why: the readability pass; four copies of "K/M with toFixed" ignored the notation.
- 2026-10-20: **The background tab keeps the sim running on a 1 s timer** (40 ms a pump, up to 4%
  of the time since the last when throttled, at most 250 ms), a pump 2 min late counts the gap as
  time away, and on return up to 60 s owed is caught up live at 40 ticks a frame, more through the
  offline path. Why: a hidden tab is a game left open (pillar 4: it should pay as open, not at the
  offline efficiency, which is what v1 did by running the offline model on every return), with
  Sparks paused (§6). Measured at 0.10–0.14% of a core.
- 2026-10-20: **Autosave by the real clock (30 s), plus `visibilitychange`, `pagehide` and
  `beforeunload`; three rolling backups at most one per 10 min, only from a save that loads;
  corruption recovery to the newest good backup with the bad string kept aside and a plain-words
  toast.** Why: the roadmap's exit (never lose more than 30 s) and a save is the one thing an
  incremental game must never lose. Autosave was counted in sim time, so fast-forward saved every
  frame and a frozen game never.
- 2026-10-20: **Saves v5**: `inspire` per research node; `paused` and the Night Shift need no
  migration. Milestone 5 may add its own step; the lead renumbers.
- 2026-10-20: **The pace test measures every stage from 1 h to 5 h** (`tests/pace-idle-*.test.ts`,
  seed 1000, split in two files that run side by side): rule 4 holds (1.53–3.94) and 8 h offline
  pays no more than 8 h open and idle at 0.5 and at 0.75. Two margins are close (1.53 at 1 h, 3.94
  at 3 h) and are reported, not tuned: the Act II bot's own build decides them.

### Flagged as derivative (Milestone 6; owner to decide)

- **Letter notation (aa, ab … after the named suffixes)** is a convention of many idle games,
  mobile ones above all. Kept as one of four settings because players of the genre expect it; it
  is not the default.
- **Offline progress at a reduced efficiency, raised by upgrades** is the genre's convention (Cookie
  Clicker's "Twin Gates of Transcendence" heavenly upgrades raise offline production; many idle
  games sell "offline earnings" boosts). Ours is re-derived from the model: offline is the same
  sim (a replay and measured rates), the efficiency is a stated number on a report the player can
  check, and the Night Shift is two flat purchases capped at 0.6, never a bought multiplier on
  live production.
- **Clicking a building to speed research** (Inspiration) resembles the genre's "click the big
  thing" loop. Ours credits only the selected node, as items, with a falling share and a 30% cap,
  and it is clicked at the Hopper the lines already feed.
- **Autosave plus rolling backups and export strings** are common practice (Antimatter
  Dimensions and others keep backups); kept because it is good practice, not a mechanic.
## Milestone 5 — Reorganize (2026-10-20)

- 2026-10-20: **Patents = floor(0.5 x the chain steps of each distinct product folded this run x
  its best grade + the Great Drill Patents delivered this run + log2(1 + invested / 100,000)).**
  Why: a reset should pay for what the run understood and folded (pillar 1), not for coin; the
  grade carries the audit's lesson to the reset; distinct products, not copies, so stamping more
  of one line is not the way to Patents. Coin is the minor, logarithmic term, so the 1.8M hoard at
  5 h is worth about 4 Patents if put into the factory, never the bulk. Milestone 4's provisional
  coin-based `patentDivisor` is gone. Calibration and measurements: DESIGN.md §19.
- 2026-10-20: **What a Reorganize keeps lives in `meta`, except four fields that already lived in
  the run's state and stay there**: `mega`, `codex`, `orders.rep` and the trophy flags (plus
  `counters`, `ordersSeen`, `factorySeen`). Why: moving them would touch every reader of them in
  the app and the sim for no gain; the reset carries them over by name (`carry` in
  src/sim/reorganize.ts, listed in `KEPT`).
- 2026-10-20: **The tick and the RNG run on across a reset; `meta.runStart` marks a run's start.**
  Why: the command log stays one ordered history, so seed + log replays across resets (tested).
- 2026-10-20: **A head start applies at once when bought, and at the start of every later run; it
  gives only the research it names, not the tree before it.** Why: buying one mid-run should do
  something now (pillar 4); and the campaign bot found that giving the prerequisites too handed
  Act II its steel research for free.
- 2026-10-20: **The Patent tree has flat prices with prerequisites** (31 nodes, 82 Patents in all),
  no growing price (CLAUDE.md: no geometric price curves) and no "+X% everything" node
  (PLAN.md's not-list). Its automation branch serves pillar 2 (the chores of layer 0 become
  machines: shovelling, picking research, accepting orders, stamping, building from blueprints).
- 2026-10-20: **New currency: Raccoon Bearings** (the Committee's pay; kept through every reset;
  spent only by the Great Drill's stages 2 and 3). Pillars: 5 (every customer is a character: the
  Committee pays in what a coat full of raccoons would have) and 1 (bearings come from lines you
  built to make what nobody else wants: slag, oil, gravel). It is not in PLAN.md's currency table:
  **the owner should confirm it** (CLAUDE.md asks before changing the currency list).
- 2026-10-20: **The Committee is the fourth customer**, met with the Great Drill research in the
  first run (its bearings go to the Bay, and its orders are goals while the Bay fills: §16 rule
  1), or after the first Reorganize once Folding is done. Its orders pay no coin, only bearings and
  reputation; its reputation rewards are rules (module buffers 6 s, a slag-eating night crew, one
  Machine Kit fewer per stamp).
- 2026-10-20: **The Dock takes an item it normally refuses while the active order wants it** (slag
  for The Pile, oil for Midnight Oil). Why: the Committee wants waste; making it go to the Dock is
  the puzzle, not a new building.
- 2026-10-20: **The Great Drill's stages 2 and 3 take nothing until their bearings are in, and
  want 4 steel a bit** (stage 2: 250 bits, 1,000 steel, 4 bearings, 6 Patents; stage 3: 400 bits,
  1,600 steel, 8 bearings, 8 Patents). Why: without the gate the first run filled stage 2 with
  items and the preview passed 20 at 5 h; with more steel than 4.4 a bit the bot's Bay floor jammed
  on its own slag once the bits were full. Rewards change rules for good (miners beside a patch;
  deep deposits in chunk D).
- 2026-10-20: **Offline efficiency is read through `offlineEfficiency(g)`** (0.5 + the offline
  branch, 0.75 at most). The one read in src/sim/offline.ts changed; nothing else there.
- 2026-10-20: **Blueprint share strings are our own format** (FWB1: a cell-byte grid plus recipe
  bytes, LZSS, base64url, FNV-1a checksum, append-only tables), pure TypeScript so the sim stays
  pure. The Blueprint Book is a list of named layouts with a mini map and four buttons, not a grid
  of icon slots.
- 2026-10-20: **The Act II bot (bot2) changes for later runs**: it takes only Bramble's Factory-floor
  order (the Festival) of the slice's orders; after 10 minutes without progress on its order it
  takes a Committee order its floor can fill (The Pile when a module outputs slag, Midnight Oil
  when one outputs oil); the gravel line's sand miner turns away while nothing wants sand, and the
  second coal miner rests once stage 1 runs miners +50% (both flooded the corridor in run 2); a
  fold whose audit measured no output is cancelled and audited again. The campaign bot resets when
  its plan is done, the preview grew under 0.25 in 20 minutes, no Committee order is filling, and
  it has at least 12 Patents (run 1) or 4 (later runs).
- 2026-10-20: **Bug fixed: a Reorganize rebuilt nothing of the old run's lookups**, so the old
  floor's grid stayed under the new one (a head-start Miner was not placed where an old building
  had stood). The reset now rebuilds both floors' lookups before placing anything.

### Flagged as derivative (Milestone 5; owner to decide)

- **The Builder Dragonfly and ghosts resemble Factorio's construction robots and ghost entities**
  (planned buildings drawn as outlines, built by flying drones as materials allow). Kept because
  blueprints are the reset's head start and building them by hand is the chore pillar 2 hands to
  a machine. Differences: one Patent-bought helper on the Workshop only, building at a fixed
  2 s pace with coin (no logistics network, no item delivery, no range), themed to the swamp.
- **Blueprint share strings resemble Factorio's blueprint strings** (compressed layout text you
  paste between saves). The format is our own; the idea of a pasteable layout string is the same.
- **The Patent tree resembles Cookie Clicker's heavenly upgrades and Antimatter Dimensions'
  infinity/eternity upgrade trees** (a reset currency spent on permanent nodes with
  prerequisites). Differences: flat prices, no multiplier nodes; most nodes are head starts
  measured in minutes saved or rule changes to folding and audits.
- **The automation nodes resemble autobuyers** (Antimatter Dimensions above all): the Lab
  Assistant, Order Clerk and Stamp Press do a chore on a timer. Kept for pillar 2; they act on this
  game's own chores (research picks, orders, stamping kept-spare designs).
- **The Reorganize card resembles every prestige confirm screen** (Cookie Clicker's Ascend,
  Antimatter Dimensions' Big Crunch: the gain shown before you reset). It is pillar 4 as written;
  ours lists the gain term by term with the goals that raise it, and what is kept and lost.
- **The Patents formula was checked and is not derivative**: CC's heavenly chips and AD's infinity
  points are a root or log of currency earned; ours counts distinct folded products by recipe
  depth and audit grade, with coin as a minor log term.

## The Milestone 5–6 review round: offline (2026-10-20)

The idle-critic and the pacing auditor found Milestone 6's exit unmet: only run 1 at 1–5 h on one
seed was measured, rule 4 was read against a closed game, the offline efficiency's sources
overlapped, a segment ran on past an order filling, and the report listed a cascade as separate
jams. What changed, and why:

- 2026-10-20: **Rule 4 is active against open idle; offline is bounded apart** (the lead's
  decision, DESIGN.md §16 rule 4). Offline never pays more than open idle for the same time and at
  efficiency e pays at least about e of it. Why: at e = 0.5 a closed game is inherently ~2× below
  open idle, so "active ÷ closed ≤ 4" fails whenever active ÷ open idle passes 2, the band's own
  middle; the 4× ceiling protects idlers who keep the game open, and the closed game has its own,
  stricter bound.
- 2026-10-20: **Check 12 restated for any e** (DESIGN.md §13): 8 h away pays the first hour as open
  idle pays it and the other 7 at e − 0.03 to e + 0.05 of what open idle pays in them, checked at
  0.5 and 0.75. Why: the old (b), "≤ 4.5 h of the planner's active rate", was the slice's bound at
  e = 0.5 and read 5.52 h at the 0.75 ceiling, a number with no meaning. "≤ (1 + 7e) h of the first
  idle hour" was tried first and rejected with numbers: open idle can earn more in later hours than
  in the first (60K, then 67K an hour at run 1's 3 h stage), so it failed by up to 13% where the
  model paid exactly what it says. The new form tests the model itself: the replayed hour is the
  open-idle hour tick for tick, and the rest is e of it.
- 2026-10-20: **The stage measurements cover runs 1–3 on both seeds and the slice end**
  (`tests/pace-idle-*.test.ts`, eight files that run side by side; DESIGN.md §20's table). Run 1 is
  the Act II bot (every hour 1–5 on seed 1000; 1, 3, 5 h on 8919); runs 2 and 3 are the campaign
  bot after a Reorganize with its Patents spent (pace-reorganize's options), at 1–3 h of run 2 and
  1 and 3 h of run 3, about 5–12 h of play in all. A run-2 file stops the campaign after run 2, so
  that run plays to its cap instead of resetting: its first hours are the same as the three-run
  campaign's and each stage keeps a half hour of play after it.
- 2026-10-20: **Three stages miss rule 4's band and are listed as open, not hidden**
  (`RULE4_OPEN` in tests/pace-idle-helpers.ts; the offline bounds are still checked there): seed
  8919 run 1 at 3 h (active 4.01× open idle; seed 1000 3.97) and run 2 at 2 h on both seeds (0.54×
  and 0.69×: in that half hour the campaign bot clears 19 Workshop pieces and places 13 modules,
  so its coin goes into the floor and the untouched factory out-earns it). At the slice end rule 4
  reads 0.98–1.09 (the planner builds nothing in its ten minutes after the Festival); logged, not
  tested. Why open: the bot's build and the reset layer's
  economy decide them, both outside this change (the reset agent's Factory annex keeps coin chains
  running past the Bay floor, which is exactly the 3 h dip); the lead re-reads them on the merged
  build. A ratio is read to two decimals, as the table writes it (run 2 at 1 h is 1.4996).
- 2026-10-20: **A segment also ends when the active order would fill or the selected research
  would finish**, and the last fraction of an item is topped up so it fills then. Why: the Dock
  takes a refused item (the Committee's slag or oil) only while an order wants it, and the Hopper
  takes slag only while the node wants it; a segment that ran on past either paid the line behind
  it for the rest of the time away (`tests/idle.test.ts` guards it with a furnace whose slag goes
  to the Dock for The Pile: offline at e = 1 now pays 1.005 of open idle).
- 2026-10-20: **A jam inside a measuring window opens the window again** (at most 8 times in one
  live stretch, `IDLE.remeasureMax`). Why: a line that stopped 4 s into the window left those
  seconds' deliveries in the measured rate, and the next segment paid them for hours (14% over
  open idle in the same test). The replay hour can run a few minutes past the hour for it; the
  footer counts those minutes as paid in full.
- 2026-10-20: **One row per stopped line in the report and the forecast**: the first machine to
  block and why, how many it stopped, and a fix to build ("9 more Slag Heaps keep it running 8h",
  "a belt taking copper ingots to the Dock", "a Crate, or a machine that uses slag"). Lines are the
  Workshop's item-flow lines (`analysis.lines`) and the Factory's trunk-joined modules, fixed for
  the run (nobody builds while away). The heap row merges into its line's row. Why: one copper line
  was four rows at 0:03 with no cause named (the critic's finding); the root cause and the fix are
  what the player acts on.
- 2026-10-20: **"Stop line" is offered only where stopping keeps something**: a line stopped by its
  Slag Heap filling, with the tip saying what it keeps ("its heap keeps its room: 53m 22s of
  running when you are back; it earns nothing while stopped"). Any other stop (nowhere for its
  output, the Dock refusing an item after an order) keeps nothing, so the row offers the fix
  instead. Why: once heaps drain or never fill (a heap-eating rule, a gravel Press), stopping earned
  0 and saved nothing. A stop or a start re-runs the forecast at once.
- 2026-10-20: **Every screen says the effective rate in words**: "the first 1h 04m at 100% (as if
  open), the other 6h 56m at 50%" (`paidHow`). Why: "at 50%" alone was wrong for any absence, and
  for one under an hour the whole time pays 100%.
- 2026-10-20: **`offlineEfficiency(g)` stays the one function (cap 0.75); a Night Shift purchase
  that would add nothing at the cap is refused, saying why**, and the screen shows what each would
  add now (`idleUpgradeGain`). Why: the reset agent's Patent offline nodes (+0.05 ×3) and the coin
  Night Shift (kept through Reorganize) overlap; no coin should buy nothing. The Patent screen's
  own refusal for an offline node at the cap is the reset agent's (src/sim/patents.ts).
- 2026-10-20: **The Night Shift Rota costs 250,000 (was 400,000)**, the Foreman stays 150,000.
  Why: both prices were derived from 7,200–12,500 coin/min, the *active* rate; the factory idles
  6,600–8,000/min before the Bay floor and 1,100–1,400 after it. A night pays +0.05 × the 7 h of
  open idle after the first, measured at the stage each is offered: 139K at 1 h (Steam Power) and
  at 2 h (Circuits), so the Foreman pays back in 1.1 nights and the Rota in 1.8 (it took 2.9). A
  pace test checks ≤ 2 nights. Derived from the pre-Bay idle of this build; the merged build with
  the Factory annex should be re-measured (the test does it).
- 2026-10-20: **The offline tally is Num** (`Tally` in src/sim/offline.ts, the Docks' and the Bay's
  writes): item amounts, per CLAUDE.md. Kept as plain numbers, with the reason: the delivery rates
  (items a second, rates may be numbers) and the carry between credit slices, a fraction of one
  item always below 1 (a remainder of a rate times a time, not a stock).
## The Milestone 5–6 review round: UI legibility (2026-10-20)

From the idle-critic's review of the merged Milestones 5–6 and the UI redesign: the floor and the
first minute read well; the newer screens were sparse or buried. Presentation only: no sim
behaviour, number or data file changed.

- 2026-10-20: **The Patent tree names and prices every node, and its detail panel speaks in
  numbers.** Each node shows a distinct picture (an item icon, a UI icon or a building's sprite;
  the flame and the clock were each used twice), its price on a chip at the corner (a tick when
  owned) and a short label under it, 8 small capitals at most so it fits a column at 1024x640. The
  panel states the effect as numbers against what this run has ("An audit takes 45 s ... instead of
  70 s"), what buying it changes this run ("70 s becomes 45 s the moment you buy it"; a head start
  lists what it adds now), its price against the bank, and its prerequisites ticked or crossed.
  *Why:* the critic could not tell nodes apart or what one bought. The screen reads `effect.k` and
  its fields and `prules()` by field name, with fallbacks (an effect it does not know shows the
  node's own `text`; a node with no icon or label gets one from its effect and its name), so the
  reset agent's rewrite of `src/data/patents.ts` needs no change here.
- 2026-10-20: **Toasts fit the screen and the overlap audit checks them.** Lines wrap to the
  column and a single word wider than it is cut; trophy names wrap to two lines instead of being
  clipped; a toast with no room in full shows its title alone. A toast that has landed is drawn on
  the audit's new `float` layer: it may lie over the floor (by design), but `findIssues` flags it
  when it leaves the screen (`offscreen`) or covers HUD text (`covered`, `clash`). Sliding in, it
  stays on the `tip` layer the audit ignores, and `npm run screens` shoots toasts at rest. *Why:*
  the act2power and jam shots caught toasts mid-slide and trophy names clipped at the edge, and the
  audit skipped toasts entirely.
- 2026-10-20: **A pinned report keeps 54 px of the right side for toasts.** It is anchored above
  the build bar as before but never rises into that room: a tall report first widens (to 256),
  then drops the line report, then cuts with "+N more lines: hover it for the whole report".
  *Why:* a kiln's 13-line report pushed every toast off the stack. Stacking toasts beside the
  report was rejected: the report would jump sideways each time a toast came and went.
- 2026-10-20: **The hover report tells one story.** The status line, the feed line and the front
  line are worked out together: a machine working from its buffer with nothing feeding it says
  "Running on its buffer: about 6s of sand left, then it starves" (or how soon its output fills when
  nothing takes it), and "Nothing feeds it" is then a warning, not a fault; the front line counts
  what waits ("1 of 4 made wait inside; it blocks when full"); a share that rounds to 0% reads
  "just now". The grid's Brownout line replaces the report's "Short of power" under it (three lines
  said the same). Text only (`src/sim/analysis.ts` reads the machine's buffer and speed).
- 2026-10-20: **Icons the atlas lacks are drawn at icon size.** Patents, Blueprints, Reset and
  Overnight (appended after the art) were 5 px glyphs beside 16 px icons; they are now 16x16
  code-drawn pictograms outlined in ink (a sealed certificate, a blue sheet, two chasing arrows, a
  moon), and any other missing icon a dark 16 px key with its glyph centred. Placeholders until the
  art director draws the frames (the atlas is append-only; a drawn frame wins automatically).
- 2026-10-20: **"Reorganize +N" appears on the top bar once a reset is worth taking**: when it
  would bank at least half of what the last run did, or 6 Patents in the first run (half the low
  end of §16's first reset, 12-20). Its tooltip gives this run's Patents and Patents per hour beside
  the last run's. *Why:* "+1" after the first fold invited a reset worth almost nothing. The Patent
  Office's "Reorganize..." button is always there. (The reset agent is re-deriving the formula: the
  6 is a presentation threshold, not a balance number; move it to `RULES` with a derivation if the
  calibration changes.)
- 2026-10-20: **A narrow top bar (under 600 UI px: 1024x640) folds the Orders group's keys into
  the Orders key** (Modules, Codex, Survey, Megaproject are tabs in its header), shows a compact
  line-health chip (green and the problem colours that have any), drops the kW unit and the power
  bar, and draws the Reorganize key as the reset icon and "+N". *Why:* at 1024x640 twelve keys and
  the counters ran into each other and pushed the floor tabs off the bar, so the Factory floor had
  no visible way back. Not a layout change: the same regions, fewer keys.
- 2026-10-20: The Megaproject card shows "Stage 1" where "Great Drill, stage 1" does not fit
  beside its percentage (its title already says Megaproject).

Nothing here is derivative of a shipped game beyond what the UI redesign already lists.

## The art revamp: Lantern Bayou (2026-10-20)

- 2026-10-20: **The owner picked direction B, "Lantern Bayou", from the three-way style test**
  (`pixel-art/revamp-test/`, commit faa0736), and **3/4-view machines with four facings**. This
  supersedes the Milestone 0 entry "Palette A, Foundry, picked" and "Machine art turns with its
  rotation, light included" for every machine sheet that ships facings. Why: the bayou at dusk
  gives the game a place (the frog town, the water round each floor) where A was a floor in a
  void; the lantern light makes the warm cues (fire, coin, windows) carry the scene; 3/4 view
  gives machines a front face for their family cue (the mouth, the ram, the drill, the arms).
- 2026-10-20: **The palette changed (the owner's ask-first item, answered by the pick).**
  `src/data/palette.ts` is B: 51 art colours (phase 1's 48 plus `wood5` for the lit deck board,
  `violet` for Patents and plastic, `teal` for glass and research) and the five pip colours,
  unchanged from A so their lightness order holds. **Every palette-A slot name in `C` is kept**,
  mapped to the B colour that plays its role (`ground0-2` → `wood0-2`, `hull0-3` → `steel1-4`,
  `glow` → `lamp1`, `hot` → `lamp3`, `gold` → `lamp2`, `teal0` → `water3`, and so on; the table
  is `pixel-art/revamp/pal.py` `ROLES`), so code and the HUD plates needed no edit. Sprites not
  redrawn were recoloured A → B role by role (`recolor_old.py`), so nothing in `src/art` uses A.
- 2026-10-20: **Machine sheets may ship four facings** (`"facings": 4` in the JSON; rows east,
  south, west, north; frames left to right). `src/render/sprites.ts` draws the row for the
  entity's rotation without rotating it, so the 3/4 view and the top-left light hold in all four.
  Sheets without `facings` (belts, splitter, merger, modules) still turn by code.
- 2026-10-20: **PixelLab drafted, the scripts finished.** PixelLab drafted the machines (eleven
  8-direction objects at 32 px, five working animations), the docks, hoppers, crate, pole and
  town buildings (one 64-candidate review pack), and the Bramble and Committee portraits
  (img2img over the hand-drawn ones). Every draft is finished in `pixel-art/revamp/*.py`: dark
  rim stripped, fitted to the footprint, outline cleaned, 1 px shadow baked, snapped to the
  palette, fire flicker and blinks animated by hand. Terrain, belts, the 22 item icons, the module
  tile, the heap and the new UI icons are hand-drawn. **Phase 2 used 157 generations** (balance
  2,178.90 → 2,021.90; the phase-1 style test used 81); no USD credit spent. Every job is in
  `pixel-art/revamp/prompts.md`. Unit 7's and Voltaire's img2img portraits lost their identity
  (the screen face, the skin tone) and were dropped for their recoloured hand-drawn ones.
- 2026-10-20: **Phase 3: the whole revamp and a readability pass.** Every machine (Mk1, Mk2, the
  crate and the slag heap) stands on a dark steel skid with a deck-dark shadow, because brown and
  orange bodies vanished on the brown plank deck at 1x (DESIGN.md §17); the kiln became pale fired
  clay so it is told from the smelter and the hand furnace by silhouette and value. The Dock and
  Hopper were redrawn by hand as *destinations*, not machines: the Dock a slip of water with a
  moored skiff and a coin pennant, the Hopper a research-teal funnel (it had read as a grey robot).
  The splitter and merger ship four facings like every other machine; only belts and trunks still
  turn by code. Everything that was only recoloured was redrawn: effects and Sparks by hand in a
  stepped lantern light (the Inspector Spark became a frog inspector with a lantern), and the
  Milestone 1-5 recipes (Unit 7, Voltaire, the town pieces, the pictures, the logo, the UI frames,
  coins, grades, icon atlases) run again through `pixel-art/revamp/recipes.py` with B colours
  chosen by role per piece. Phase 3 used **0 PixelLab generations** (balance 2,021.90 before and
  after).
- 2026-10-20: **The title screen is a key-art scene** (`title_scene`, 320x180 x8 at 8 fps): a
  PixelLab dusk-bayou backdrop regraded into B, with the game's own sprites composed over it by
  hand (the deck with a line into the Dock, a glowing module, Bramble on the boardwalk) and
  animated by hand (shimmer, lantern flicker, the belt). `drawTitle` draws it at the smallest whole
  scale that covers the screen and places the logo, tagline and buttons in scene coordinates on
  its calm areas. 3 PixelLab generations (balance 2,021.90 → 2,018.90).

## The Milestone 5–6 review round: the reset layer (2026-10-20)

The idle-critic and the pacing auditor found that Milestone 5's reset paid again, every run, for
what was already paid: a reset loop at the slice end beat the designed run's Patents per hour.
They also found:

- Raccoon Bearings were a currency with one sink.
- The blueprint drone was a copy of Factorio's.
- The Bay floor's long wait had nothing to do.

The lead decided the fixes below. What was built and measured is in DESIGN.md §19.

- 2026-10-20: **Patents are filed, not re-earned** (the lead's decision 1).
  - The Patent Office keeps each product's best value on file across every run (`meta.patented`).
    A Reorganize pays 0.5 for each unit of the **rise** over what is on file.
  - Value = steps folded × grade multiplier × rate tier.
    - *Steps folded* are the recipe steps the box holds: the product's depth less the deepest item
      its ports take in, at least 1. A Drill Bit assembler fed from outside is 2 steps, not 5.
    - The *rate tier* multiplies by (1 + 0.5 t). There is one tier for each ×4 of scale, counted
      in Mk1 machines' worth (a Mk2's speed).
  - Why: the old formula paid every run again for the same nine products, so the cheapest Patents
    came from resetting at the slice end, over and over. Now folding the same line again files
    nothing. A later run earns only by pushing further: a new product, a better grade, a deeper
    fold, a bigger line, or the Drill.
  - The Reorganize card shows the record, one line per product, marked new, better or on file.
- 2026-10-20: **The bills term replaces the works term**: log2(1 + bills / 25,000), counting the
  bills of the buildings and modules that ran in the last minute.
  - Why: "coin invested" rewarded spending a hoard on anything, and a prestige formula should not
    count coin earned. What stands and runs is the factory itself.
  - The slice-end factory stands on about 14K (0.6 Patents). The Act II bot's 4 h factory stands on
    about 80K (2.1).
  - The megaproject term stays as it was.
- 2026-10-20: **Raccoon Bearings are dropped** (the lead's decision 2), so the currency list is
  PLAN.md's again.
  - **The Great Drill's stages 2 and 3 open at the Committee's reputation 3 and 5**
    (`MEGA[i].rep`).
  - The Committee's orders pay coin (2× what the goods fetch) and 1 reputation.
  - Why: a currency with one sink and no choice was a gate in a costume. Reputation already
    measures the Committee.
  - Its rewards: Coat Pockets at 1, the Night Crew at 2, stage 2 at 3, Pocketed Kits at 4, stage 3
    at 5. With two orders a run, that puts stage 2 in the second run and stage 3 in the third.
  - The Drill screen names the gate ("opens at their reputation 3, now 2"), and the preview lists
    it as a goal.
- 2026-10-20: **The Committee's orders are sized for one run's floor.** Why: the lead's target is
  1–2 fillable orders a run. The bot fills The Pile and Shiny Things every run.
  - The Pile: 800 slag (was 1,500). That is about 20 min of the Bay floor's slag at the Factory
    Dock.
  - Shiny Things: 1,200 wire + 600 ingots after Steam Power (was 300 glass + 600 wire). Glass never
    reached a Dock on any bot floor. Wire and ingots are what an Act II Factory Dock receives anyway,
    about 16 min of it.
  - Midnight Oil: 150 oil (was 600).
- 2026-10-20: **The Night Crew (rep 2) works only while you are away.** Why: in the open game it
  ate Act I's slag puzzle in every later run, and the lead's decision 6 says it must not end it.
- 2026-10-20: **The Megaproject Bay never jams.**
  - It always takes steel and Drill Bits. Whatever its open stage can't count (the stage is
    closed, or that part is full) goes on to the Dock: steel sells, bits are scrapped.
  - Why: a stage waiting on the Committee stopped the whole Bay floor behind a full buffer. Seed
    1000's run 2 deadlocked: the Drill works blocked, so Midnight Oil's oil never moved.
- 2026-10-20: **Stage 3 wants 300 bits and 1,200 steel** (was 400 and 1,600). Why: the third run
  is shorter (head starts), and the lead's target is that the bot finishes the Drill by its end.
  The ratio of 4 steel a bit stays (Milestone 5's slag jam).
- 2026-10-20: **The Patent Drawer replaces blueprints, ghosts and the Builder Dragonfly** (the
  lead's decision 3).
  - A Workshop design folded in a run can be kept: 8 slots, and A Deeper Drawer adds 4.
  - In a later run it unfolds whole onto the box it came from. Every part is placed at once for
    its bill, ready to audit and fold again.
  - **The Draughtsman** (2 Patents) unfolds the designs the player queues, in their order, at most
    one every 5 s, as land, research and coin allow. One waiting only on coin holds the queue.
  - Why: this is re-derived from the game's own verb (Unfold, §10) instead of a construction-drone
    network. The kept design is the reset's head start. Which lines to keep is a choice, since
    there are 8 slots for nine products.
  - Share strings are **FWD1**: a kept design's box, name and layout, using the FWB1 coder's LZSS
    and checksum.
  - Save v7 drops v6's blueprints, ghosts and bearings, with their commands. A blueprint had no
    product or grade to keep.
  - No text the player sees says "blueprint".
- 2026-10-20: **The Factory annex** (the lead's decision 4).
  - Up to 3 blocks of 2×8 tiles east of the Factory floor (18×8 at most). The n-th block costs
    150,000 × n: 150K, 300K, 450K, linear. It needs Steam Power.
  - It is sold from the Upgrades tab and drawn on the floor: a brass seam, and the next block
    outlined with its price. A Reorganize loses it, like land.
  - Why: the Bay floor pushed the coin chains off a 12×8 floor. Income fell to a third for the
    rest of the run, and coin piled up with nothing to buy.
  - It goes east, not south, so it never pre-empts the Floating City's +1 row (§15, Milestone 7).
  - **Open for the lead: should the annex survive a Reorganize?** If it is lost, a later run buys it
    again (450K, coin it has by 1–1.5 h). If it is kept, run 3 starts with room run 2 had to buy,
    which helps rule 3 on seed 1000 (below).
- 2026-10-20: **The Patent tree is repriced to 40 Patents** across its 29 nodes (it was 82, then 55
  after the first re-derivation).
  - Why: with filing, the designed first run banks 15 and runs 2 and 3 about 7–9 each. That is
    about 31 by the end of run 3 (11–12 h): most of the tree in 5–15 h, the lead's target.
  - Each price is about a Patent per 10–15 min of a run that the node saves.
- 2026-10-20: **Rules are re-derived, not just renumbered** (the lead's decision 6).
  - **The Surveyor's Charter** is now a claims rule tied to grade: a copy of a source design
    graded S or S+ holds half a claim. A well-folded source line gets twice the copies; a sloppy one
    gets no more. It was +2 claims on every ore, a multiplier in disguise.
  - **Fresh Dies** replaces **Stamping Dies** (a lower stamp growth). A line refolded at a better
    grade than every earlier design of its product starts its stamp price over. Prices stay linear.
  - **Cool Hands** and **Deep Heaps** are dropped. Each was only a number, and Deep Heaps ended the
    slag puzzle.
  - **The offline nodes give +0.05 each.** There are three: 0.5 + 0.1 from the coin Night Shift +
    0.15 = 0.75 exactly. A node bought at the 0.75 ceiling is refused (`patentRefusal`, at the
    offline agent's request).
  - The node once called Night Shift is now the **Graveyard Shift**, so nobody confuses it with the
    coin Night Shift. The coin Night Shift **survives a Reorganize** (`KEEP_UPGRADE`).
- 2026-10-20: **Rule 1 while the Bay fills.**
  - The Act II bot chases the preview's goals: annex blocks and their chains, Committee orders, a
    nested Gizmo works II, and chunk D for the deep seams.
  - The Drill screen shows bits a minute and the limiting input.
  - Committee orders and annex purchases count as goals.
  - Measured in DESIGN.md §16 and §19.
- 2026-10-20: **Rule 2 is read without Sparks** (the lead's decision 7). A Spark click is a reflex,
  not a decision. The gap is measured on build, research, order, fold and purchase decisions
  (`tests/pace-act2-run.test.ts` logs both measures).
- 2026-10-20: **Tutorial toasts show only in the first run** (the lead's decision 8): first Miner,
  first slag jam, first sale, and the Factory floor opening.
- 2026-10-20: **Bounded buffers stay plain numbers, named in the purity test's allowlist**
  (`BOUNDED` in tests/purity.test.ts).
  - The Num check now also catches `count`, `progress`, `inBuf`, `outBuf` and `Record<…, number>`.
  - The allowlisted fields are each bounded and read every tick:
    - a machine's input buffer (2 crafts);
    - a module's in and out buffers (2–6 s of its rates, fractional);
    - a heap's or crate's count (capacity 400);
    - the offline report's count of stopped machines.
  - Num is for amounts that grow without bound.
- 2026-10-20: **Rule 3 is open for run 3 against run 2 on seed 1000** (`RULE3_OPEN` in
  tests/pace-reorganize.test.ts).
  - Run 3 reaches the same floor as run 2: both fill the annex and the 12×8 floor with the same
    chains. Its peak ties run 2's to within 1%, so it never "passes run 2's peak".
  - On seed 8919 it passes at 28 min (the limit is 60).
  - Why open: a later run's peak is capped by the floor's room, not by speed. It passes as soon as
    there is more room, either from a kept annex (above) or from Milestone 7's Floating City.
- 2026-10-20: **The campaign bot can play a reset loop** (`loopAt`): it resets at the slice end,
  1 h or 2 h, every run, over the designed campaign's horizon. A pace test checks that no loop
  beats the designed run's Patents per hour.

- 2026-10-20: **`RULE4_OPEN` was re-read on this build** (the lead asked for it once the annex and
  campaign changes were in; tests/pace-idle-helpers.ts, DESIGN.md §20).
  - Removed, because they now pass: seed 8919's run 1 at 3 h (4.01×, now 1.59) and seed 1000's
    run 2 at 2 h (0.54×, now 1.52). The annex keeps a Gizmo chain selling past the Bay floor, so
    open idle there is 3,600–5,500 coin/min, not 1,100–1,400.
  - Still open, with a new reason: seed 8919's run 2 at 2 h (1.49×).
  - Newly open:
    - seed 8919's run 2 at 3 h (1.49×);
    - seed 8919's run 3 at 3 h (1.47×);
    - run 3 at 1 h on both seeds (0.77× and 0.72×): the Bay floor rebuild, moved earlier by the head
      starts.
  - Why they stay open: the 1.47–1.49 readings are Overdrive's own arithmetic. 3× for 10 s in every
    40 is exactly 1.5×, the band's floor, so a stage where the bot only clicks reads at the floor
    or just under it.
- 2026-10-20: **Overdrive's 30 s cooldown is kept; 20 s was tried and rejected.**
  - What 20 s did (1.67× for a line kept in Overdrive): it passed every one of the Overdrive-only
    readings (1.61–1.94×).
  - Why it was rejected: it sped seed 8919's run 1 to a 3:52 first reset (outside 4–6 h), left
    its Drill at stage 2 after run 3, and pushed rule 1's longest Act II goal gap to 16.5 min (the
    test's bound is 15).
  - **Open for the lead**: rule 4's floor and Overdrive's duty cycle are the same number. Raising
    one needs the reset window and the Drill re-paced with it.

### Flagged as derivative (the reset layer review round; owner to decide)

- **Founders' Grant (start a run with 2,000 coin)** resembles the start-with-currency upgrades of
  most prestige games (Cookie Clicker's heavenly upgrades, Antimatter Dimensions' starting
  bonuses). Kept: it is one flat node worth about two minutes of the first run, not a multiplier.
- **FWD1 share strings** resemble Factorio's blueprint strings and shapez's shared layouts: a
  pasted string that rebuilds a layout. The format is our own, and it holds one kept design, not a
  layout library.
- **The Draughtsman** resembles an auto-builder: Factorio's construction robots building
  blueprints, or an autobuyer that places what you queued. The differences:
  - It unfolds a kept design back onto the box it was folded from.
  - It works one design at a time, in the player's order, at the full bill.
  - It has no drones, no range and no logistics.
- **The Factory annex** resembles a land or plot purchase: Factorio's map expansion,
  Builderment's land plots, every idle game's "buy more space". The differences:
  - Three linear blocks, on one side only, lost at a reset.
  - The puzzle is the room it gives (the Bay floor or the coin chains), not the number.
- **Filing** (pay only the rise over the best on file) was checked against shipped prestige
  formulas. Antimatter Dimensions' Eternity Challenges and Realities pay for a new best, and
  Universal Paperclips' later stages count records. Ours files the best value per product, which
  only a game of folded products has. Flagged for the owner all the same.

## The Milestone 5–6 final round: UI (2026-10-20)

From the idle-critic's re-review of the Milestones 5–6 build. Presentation only: no sim behaviour,
number or data file changed.

- 2026-10-20: **The floor tabs keep their words; the Reorganize key shrinks first.** The top bar
  now measures what follows the counters (power at its smallest, the line-health chip, both floor
  tabs labelled) and passes counters only the room that leaves, so "Reorganize +N" becomes the
  reset icon and "+N" before "Workshop" and "Factory" lose their labels. Short of room even then
  (1024x640 on the Factory floor), the floor you are on keeps its word and the other its icon;
  icons alone are the last resort. *Why:* at 1280 and 1920 the full "Reorganize +9" left the tabs
  as two look-alike icons. The earlier estimates (a flat 70 px for the chip, 54 for the tabs) were
  replaced by the real widths.
- 2026-10-20: **World tooltips stay off what you are looking at.** `ui.tip` takes a placement:
  rects to avoid (the hovered tile and its neighbours, and the tile the goal points at) and the
  room to stay in (between the top bar and the build bar). It tries beside the avoided area on the
  cursor's row (right, then left), then above, then below, and falls back to the old spot. *Why:*
  in the first minute the ore's tooltip sat on the Hand Furnace just as the goal said to crank it;
  later, hover reports covered the build bar at 1024x640.
- 2026-10-20: **The hover report is short; the pinned report is the whole story.** Hovering a
  machine shows its name, what it is doing (the first-minute instruction too, for the hand
  furnace), the one cause most worth fixing (a fault first, then a power problem, then a warning
  about its own flow before the grid's; blocked by its own byproduct, where that byproduct must
  go), its rate, and what a click does: Overdrive when it is ready ("while it cools, a click pins
  the full report"), else "Click to pin the full report (+N lines)". A Factory module likewise
  (its grade beside its name). The pinned report is unchanged and still anchored above the build
  bar with the toasts' room kept. *Why:* a kiln's hover ran to ~15 lines over a third of the floor.
  The report lines are now built in parts (head, power and Overdrive, the rest) so the hover and
  the pinned card read the same sentences.
- 2026-10-20: **A Great Drill stage shut behind the Committee shows the Committee, not the
  trunks.** The panel names the Committee with its portrait, its reputation now against what the
  stage needs (pips), how many more of its orders open the stage, its orders on offer with their
  progress (the one under way first), and a gold key to its tab on the Orders screen; what the
  stage will want once open and its reward sit under that, quietly. No "not arriving", ETA or
  "Clear the Factory floor's corner" while shut: the Bay counts nothing then. The stage track
  shows the current stage locked in violet. The `mega2` screens state is now one the game can
  produce (stage 1 done, nothing counted for stage 2, the Bay standing, two Committee orders
  filled and a third under way).
- 2026-10-20: Small fits. The Patent label tries "Overdrive" and falls back to "Overdrv" in a
  narrow column (a label may list fallbacks), and the small font's V now tapers over two rows so
  it never reads as U. The Factory camera frames the annex block for sale with the floor (a
  half-tile margin, so the 12x8 keeps its zoom at 1024x640), and the block's label slides into
  view while its outline is cut by the screen edge. The Orders screen's customer tabs keep whole
  names at 1024x640: when any name would be cut, every tab's hearts move onto its portrait's foot.

Nothing here is derivative of a shipped game beyond what the UI redesign already lists (a short
hover card with a click-to-pin detail panel is a genre convention).

## The Milestone 5–6 final round (2026-10-20)

The idle-critic's re-review of the review round found three blocking problems:
- The bills term could be farmed. A building counted in full once it ran a second in the last
  minute, so a field of starved machines, or generators with one fuelled, paid Patents.
- Overdrive leaked into audits. A machine overdriven before its audit began folded at up to 3×
  its rate.
- The bot never bought deposit claims. The critic read that as the cap on rule 3.

The lead asked for those fixes, a run-4 idle stage, a bot that uses the Patent Drawer, a refold
rule for kept designs, and honest re-measures. What was built and measured is in DESIGN.md §10,
§16, §18, §19 and §20.

- 2026-10-20: **The bills term counts measured work, not a second of it.**
  - Each building's bill is weighted by the work it did over the last 5 whole minutes
    (`RULES.billsWindow`, minute buckets on each building):
    - a crafting machine by its crafting time times its grid's satisfaction squared;
    - a Miner by its digging time;
    - a power producer (with its boiler) by its burn share;
    - a Pole by its grid's use, capped at a quarter of the consumers it carries;
    - belts, logistics and trunks only if they carried an item in the window;
    - a module by its stamp bill times its run fraction.
  - Why: a building that stands is not a factory that works. Satisfaction squared makes a
    brownout pay almost nothing. The 5-minute window means a building bought just before a reset
    counts a fifth.
  - Tested (`tests/final-round.test.ts`):
    - 239 refineries on one generator at 0.7% power add +0.09 Patents to the slice-end factory and
      +0.04 to the 4 h one. The bound is 0.5.
    - 119 generators bill the same with one fuelled as with all fuelled for one kiln.
    - Idle buildings count 0.
    - A reset loop at 35 min that burns all its coin into buildings banks 0.40 Patents an hour,
      against the designed run's 2.83 (`tests/pace-reorganize.test.ts`).
  - The card's goal "run N more coin of buildings" is dropped: it was the farm's instructions.
  - The slice-end factory now stands on about 10K of bills (0.5 Patents), the 4 h factory on
    about 33K (1.2). They were 14K and 80K.
- 2026-10-20: **Overdrive never reaches an audited machine, Miner or module**, including one
  clicked before the audit began. Its 3× stops at the audit's first tick, and its timer and
  cooldown run on. This covers the Workshop, nested boxes, and Quick Audits' 5 s warm-up, which
  is shorter than Overdrive's 10 s. Tested both ways. Why: §10 already said so; the code checked
  the click, not the run.
- 2026-10-20: **A kept design unfolded unchanged refolds after a 10 s check, at its kept grade**
  (`RULES.refoldCheck`, `refoldSlack`).
  - When an audit starts on a box that exactly matches a kept card, a check runs before the full
    audit. The box must have the same parts, turns and recipes, every machine in normal mode, and
    nothing paused. The kept card holds the grade and the raw ins and outs, stored at keep time.
  - The check passes when every machine runs at no less than its kept busy fraction less 0.1 and
    the kept product leaves the box. The fold then takes the card. Otherwise the full audit goes
    on.
  - Why it can't be gamed:
    - The card is what a full audit of the same layout graded, so a refold never beats it.
    - Any change to the layout gets a full audit.
    - A design imported from a share string has no card.
    - A check that fails has lost nothing: 10 s is the full audit's own warm-up.
  - Tested: an unchanged line refolds at the same grade, ins and outs. A turned belt, a paused
    miner, an overclocked machine and an imported string each get a full audit.
- 2026-10-20: **The bots use the Patent Drawer and buy claims and annex blocks.**
  - The Act II and campaign bots keep every Workshop design they fold. With the Draughtsman they
    queue the kept designs in plan order. In a later run they unfold a kept design whenever its
    box is empty and the plan wants exactly its parts.
  - Measured: 7 designs kept in run 1, 5 unfolded in each later run, and 5–6 refolds on the check
    a run.
  - Before stamping or placing a copy that lacks claims, the bot buys a claims block if it costs
    at most half the coin on hand.
  - An optional copy or annex block that waits for coin, claims or research now waits beside the
    plan (retried every 10 s) instead of being skipped for good. The campaign's extra chains are
    no longer capped at four.
  - Surveying needs slag bricks. The bot's copper slag heap now empties into a standing brick
    press, whose bricks join the corridor to the Hopper. The press switches off once the bank
    holds the bricks Surveying needs.
  - Surveying's coal is counted as wanted only once Overdrive is researched. Counted from the
    start, it kept the second coal miner flooding the spine, and the steel for Overdrive waited
    behind it for 6–9 min.
  - Overdrive is no longer clicked on a line the bot is about to fold, but only once that line is
    ready to fold. Blocked from the start, the Steel and Circuits lines lost Overdrive for most of
    an hour.
- 2026-10-20: **The Great Drill's stage 1 is 650 bits and 2,800 steel** (it was 450 and 2,000).
  - Why: with the slag drained into bricks, the bot reached the Bay floor 20 min sooner, and the
    first Reorganize came at 3:37–3:41, outside §19's 4–6 h.
  - At 650 and 2,800 the reset comes at 4:21–4:24 with 14 Patents, the Drill's stage 1 at
    S+3:42–3:44 (target ≤ S+4 h), and runs 2 and 3 still finish stages 2 and 3.
  - Steel stays over 4 a bit (4.3), so the steel is in before the bits, as §19 wants.
- 2026-10-20: **Rule 2 is read without belt relays, and is open while the Bay fills.**
  - The bot lifts and relays the Concrete boiler's feed belt every 16 s to clear sand its end never
    takes. Each relay was logged as a "belt" decision.
  - The review round's rule 2 reading (9.2–9.3 min to 5 h) was those relays. Read honestly, the
    wait is 12.4–12.5 min up to the Bay floor (tested, ≤ 15), and 44–48 min while the Bay fills
    (logged as open, the same wait as rule 1's).
  - Relays are now logged as `relay`, and the test excludes them as it excludes Sparks.
- 2026-10-20: **Rule 1's goal list counts annex blocks and claims blocks**, as DESIGN.md §16 says.
  The Act II test's pattern had left them out.
- 2026-10-20: **Rule 3 is open on both seeds, and claims were not the cap.**
  - With the bot buying claims (one copper block a later run, with claims to spare) and its annex
    blocks before the Bay floor, run 3 passes run 2's peak at 1:22 against limits of 1:00 and
    0:56.
  - Run 3's peak only equals run 2's (21.4K and 21.2K against 21.1K and 21.2K a minute). It
    reaches it once its third annex block is filled. Both runs fill the same room.
  - Open for the lead (`RULE3_OPEN`): the levers change what a reset keeps or how much room there
    is.
- 2026-10-20: **Overdrive's 30 s cooldown is kept; 25 s was tried and rejected. Rule 4's 1.5 floor
  is not lowered.**
  - What 25 s did (1.57× for a line kept in Overdrive) made seed 8919 worse:
    - the Act II bot's 2 h rule 4 reading fell from 1.46 to 1.42;
    - its longest wait between goals before the Bay floor rose to 17.0 min (the bound is 15);
    - its run 3 never passed run 2's peak.
  - Rule 4 is open at six of the 26 stage readings (`RULE4_OPEN`):
    - four read 1.48–1.49, where the bot only clicks Overdrive;
    - two are run 4's Bay floor rebuild at 1 h (0.97–0.98).
  - The Act II bot's 2 h reading on seed 8919 is open too (1.46): its Bay floor is laid at 2:16,
    inside the window.
  - Run 3 at 1 h now passes (1.58 and 1.63; it read 0.77 and 0.72).
- 2026-10-20: **The idle suite has a run-4 stage** (`tests/pace-idle-run4-*.test.ts`): runs 1–3 as
  the campaign plays them, then run 4 for 5 h from 9.8–9.9 h of play. 8 h offline is measured at
  each whole hour of it, so the stages stand to 13.9 h and run 4 plays to 14.9 h. Offline is honest
  at every stage, both seeds, both efficiencies.
- 2026-10-20: **The Patent tree is not finished by the fourth run**, and the comment that said so
  is reworded.
  - Measured on seed 1000: 22 of the 29 nodes are bought, and 30 of the 40 Patents banked, by
    9.9 h of play.
  - A fourth run files about 1 Patent in 5 h: everything is on file and the Drill is done, so only
    the bills term is left.
  - The last 10 Patents wait for the next floor's goals (Milestone 7). Open for the lead.
- 2026-10-20: **DESIGN.md §19's step table is corrected** to what `chainSteps` computes. A slag
  brick and gravel are 2 steps, because slag sits at its smelter's 1. Plastic is 1.

### Flagged as derivative (the final round; owner to decide)

- **Weighting the bills by satisfaction** uses the grid model's satisfaction, which resembles
  Factorio's power satisfaction (the power model's resemblance is flagged earlier in this file). The
  new part, a prestige term that counts measured work, has no shipped counterpart that we know of.
- **The refold check** resembles skipping re-verification of a known blueprint. We know of no
  shipped game with that rule; Factorio and shapez blueprints have no audit to skip. Flagged all
  the same, since it touches the Drawer, which is already flagged.
- **Buying deposit claims in blocks** at the Survey Office is unchanged from Milestone 4; only the
  bot's use of it is new.

## The ore revamp (2026-10-21)

The owner: "redo the ores they are making the game seem bland". The deposits were one recipe for
all four ores (a hard-edged square of brown earth with round lumps in a grid, recoloured): it read
as a bathroom tile, and as the square-of-lumps patches of the owner's other game (Last Watt's
emberrock), which Foldworks should stop resembling.

- **Each ore is an outcrop with its own geology and silhouette** (`pixel-art/revamp/ores.py`,
  replacing `deposit()` in `terrain.py`): one 32×32 drawn for its 2×2 patch (patches are always
  2×2) in the machines' 3/4 view, light top-left, breaking up through a ragged hole in the deck.
  Iron: a cluster of angular banded-iron boulders. Copper: one cracked mound of rock under a
  verdigris/malachite skin, native copper in its veins. Coal: tall faceted anthracite shards with a cool sheen, embers in the cracks. Sand: a
  soft dune heap, no outline. Shape first, colour second (DESIGN.md §17); all four read apart at
  1×, on owned and unowned land, and with a Miner on one tile. The minable footprint is unchanged.
- **The square is broken** by drawing the outcrop transparent over the deck (ground.ts now bakes
  the floor tile under every patch tile) and by a per-ore spill sheet baked onto the deck tiles
  round the patch: pebbles, stains, cracks or drift within 4 px of the hole, never on another
  patch (or on water: the ground is baked only inside the Workshop), sparse so it does not read
  as minable.
- **A living touch, not baked**: `src/render/orefx.ts` draws 1–3 px glints from points listed in
  each deposit's JSON (iron a silver cross, copper a gleam, coal a sheen and breathing embers, sand
  a quartz grain), stateless (a hash of patch and time slot), culled to the view, under belts and
  buildings, only on land you own. Never a star with motes, so never a Spark. One import and one
  call in `renderer.ts`.
- **Frame 0 of `tile_ore_*` is now the whole outcrop at 16×16** (frames 1–4 the quadrants), so the
  Survey Office, which draws frame 0, shows the ore rather than its top-left corner.
- **The ground re-bakes when the Great Drill's stage changes**, so the stage-3 deep deposits
  appear on chunk D's deck (the chunk cache was keyed on ownership only).
- **Revision (the lead's look at the first pass)**: iron read as a stack of blue steel crates
  (rectangular blocks with flat blue tops: the machines' shape and colour) and copper as a round
  green bush with orange fruit. Iron is now irregular faceted boulders (convex rocks cut by
  tilted planes, several sizes, some leaning), rust and ochre on the lit facets and in the
  crevices, dark hematite on the rest, blue-grey only on lit ridges and glints. Copper is one
  faceted mound of grey-brown rock under a verdigris skin, with copper as veins along three
  zigzag cracks and small angular nuggets. Their item icons follow. Coal's 16x16 Survey frame
  lifts every step of its sheen one lighter, so it reads on the Office's dark rows.
- **The four ore item icons** match their deposits and stay lumps (an angular slab and chip, a
  crust lump with a nugget, two shards, a low heap); no other item cell changed.
- Palette B only, no colour added. PixelLab: **0 generations** (its service returned a database
  error at the start; everything is hand-built in the script).

## The 180: text and HUD turned away from Last Watt (2026-10-21)

The owner: *"take a look at the game Last Watt, all the text in this game mirrors it, I want to do
a 180 to that game's format, revamp completely."* Last Watt is their tower defense
(`Documents/candlepower`), grown from the same Sprocket & Sprout engine layer, so the two games
shared a font, a panel style, a voice and a screen format. Asked how far, they picked **text and
the whole HUD**; then "make all the rest of the decisions by yourself and run autonomously". The
plan is `docs/hud-180.md` (it replaces `docs/ui-redesign.md`'s screen; that doc's lessons stand).
Built in two phases by parallel agents on branch `hud-180`, merged by the lead.

**What went** (each mirrored Last Watt): the S&S bitmap font; light text on slate boxes with gold
caps titles; mechanics explained in sentences with numbers inside them, colon chains and
semicolons; key hints in brackets; a top strip of counters; a numbered bottom hotbar with prices;
cards of instructions in a column; a two-column help table of keys; square ore patches (the ore
revamp above).

### Phase 1: the letters, the paper, the art, the words
- **Three fonts drawn for Foldworks** (`src/ui/font.ts`): Reed (body: cap 7, x-height 5, 2 px
  verticals, rounded bowls, LINE_H 11), Bullfrog (display: cap 9, 2 px everywhere, soft corners,
  the round lowercase sits 1 px low; BIG_LINE_H 13), Pip (small caps, cap 5, 2 px verticals). Reed
  is ~32% wider than the S&S font, so every layout was re-measured. Bullfrog's capitals don't
  bounce (O read as o). Contact sheet: `pixel-art/fonts/out/fonts.png`, beside a crop of Last Watt.
  The font test strips rich-text markup before checking glyphs.
- **Ink on paper** (`src/ui/theme.ts`): colour roles over palette B (unchanged): `ink`/`inkSoft`
  on `paper` (bone) at 7:1 or more, accent inks at 4.4:1 or more (`warn` is `copper1`: `lamp0`
  failed at 3.8:1; `coin` is Lantern Bayou's `brass0`, read from the palette list, because
  `C.brass0` is palette A's lighter brass). A test checks every pair.
- **Rich text** (`src/ui/rich.ts`): one markup for every string a player reads: item and UI icons
  inline, keycaps (`{k:T}`, `{k:LMB}`), coin chips, colour spans, the display face, and an inline
  status chip (`{chip:role:WORDS}`). Icons never split from the next word; plain strings draw as
  before.
- **The kit** (`src/ui/ui.ts`, `src/ui/paper.ts`, `src/app/chrome.ts`, `src/app/widgets.ts`):
  tags on strings (deckled, a punched hole, a shadow), speech bubbles with tails, ribbons, the
  Purse sign on ropes, the ledger book (`menuTemplate` keeps its signature and draws the book),
  keycaps, chips, paper meters with a target notch, rubber stamps, paper buttons that press 1 px.
  Every old export keeps its signature. A kit gallery (`gallery.html`, dev only; `e2e/gallery.mjs`).
- **The art** (`pixel-art/hud180/`, `src/art/h180_*`): 29 pieces (paper, bubble and tails,
  ribbons in five inks, bookmarks, the Purse sign and rope, the book, keycaps and mouse, buttons,
  chip, slip, clipboard, pushpin, the bell, the lift dial and buttons, notebook, newspaper, toolbox,
  the wheel's hub, petals and discs, lily pad, tick, red-pencil circle) and **the Inspector's
  portraits** (an olive frog in a black bowler with a monocle on a chain, a drooping moustache that
  curls up when he cheers). PixelLab: 0 generations.
- **The words** (`src/data/*`, `src/app/goals.ts`): blurbs and descriptions became icon
  equations and rows (`{i:ironOre} → {i:ironIngot}  30/min out the front · {i:slag} 1 per 4, out
  the sides`); **every goal is a line in a character's mouth** (`Goal.who`: Bramble by default,
  the Inspector for folding and audits, Voltaire for power and Mk2, the Committee for the Drill's
  later stages, a customer for their own orders), with progress as `bar` and numbers as `chips`;
  the voice guide is at the top of `goals.ts`. Land chunks got names (`Chunk B · Copper Bank`,
  `Chunk C · Rust Hollow`, `Chunk E · Coal Flats`, `Chunk F · Ironside`, `Chunk A · the Yard`,
  `Chunk D · the Back Forty`; "Chunk X" stays because a test matches it). Two stale goal numbers
  (steel 15, circuits 110) are now read from the data. Strings in `src/sim/` stay (tests pin
  them); the app turns them into rows and chips where they reach the player.

### Phase 2: the screen
- **No strips, no columns**: the floor runs edge to edge (`layout.ts`); things hang on its
  corners. **The Purse** (top-left, a sign on ropes: the coin in Bullfrog 2x with its roll, bump
  and sparkle; the rate on a tag under it; the Shipping tag on hover; flying coins land on it) is
  the one loud number. Kits show where they are spent, Patents on their pages and on the
  Committee's contract slip (under the Purse when a Reorganize is worth it), power on the floor.
  Every book page shows the coin you hold in its header, since the book covers the Purse.
- **The trouble bell** (under the Purse, only while a line is watched): swings and chimes on a new
  problem; a click goes to the next, worst first, and pins its report (the old line-health chip's
  job). Off-screen problems get red edge arrows, Sparks gold ones.
- **The lift** (top-right): a needle between W and F, F padlocked until the Factory opens, `Tab`.
- **Slips** under the lift for toasts; trophies drop as gold ribbons; banners are ribbons.
- **The speaker's corner** (bottom-left): the goal's speaker on a lily pad with the bubble, its bar
  and chips; the Bellows' Buy button in the bubble; cameos (a customer pitching an order or
  thanking you, Unit 7 logging a Codex first) take the corner for ~6 s, one at a time. Beside it
  the toolbox opens the wheel at the screen's centre.
- **The notebook and the Gazette** (bottom-right): the notebook opens the last page; while a page
  is open its sections hang as bookmark ribbons down the book's edge, and the book lies on a
  dark-wood desk. The Gazette is a folded paper with today's headline on a slip beside it, turning
  every 15 s, an EXTRA! corner for factory news; its page is a newspaper front.
- **The floor carries the numbers** (`floortags.ts`): tags on the Dock (coin/min, the order's
  bars), the Hopper (node and %), where belts enter the Dock or Hopper (item/min), each grid (power
  %), the Bay; land for sale is a sign with a price chip, locked land a quiet padlock on a stake.
  They draw outside the overlap audit (floor, not layout) and never block clicks.
- **Reports are tags** (`tags.ts`): status chip and cause, the recipe and its rate, a bar against
  nominal, feeders, the byproduct's route, power, mode and Overdrive rows, keycap verbs. Hovered:
  the key rows on a string. Pinned: every row, docked at the screen side that shows them all and
  doesn't cover the machine (a full report is ~220 px tall). Built from game state, not from
  `analysis.ts`'s prose; the Factory's old `factoryReport`/`factoryHover` are gone.
- **The Workbench Wheel** (`wheel.ts`; `buildbar.ts` deleted): a right tap on the floor (a drag
  still pans), `Q` or `Space` opens it at the cursor. The hub holds the last pick; petals in a fixed
  clockwise order (Build at the top, then Power, Heavy, Upgrades, Tools; on the Factory, Modules,
  Trunk, Tools) fan their items on twine after a 0.09 s rest. Discs are code-drawn at 24 px (the
  18 px art hid under a 16 px sprite). Locked items keep the old mystery (`???`, a silhouette,
  the research that opens them). Number keys pick within the last petal, never drawn as a row.
  **Zoom out moved from Q to Z**; Pause is `P` (still not implemented, as before).
- **World doors**: the Dock opens Orders, the Hopper Research, the Bay the Megaproject (as
  before), and now Unit 7's observatory opens the Codex and Voltaire's pavilion the orders.
- **The book's pages** (`screens.ts`, `act2screens.ts`, `orders.ts`, `patents.ts`, `drawer.ts`,
  `reorganize.ts`, `offlinereport.ts`, `overnight.ts`, `fold.ts`): the research tree in pencil
  (paper discs, a green stamped tick for done, a red-pencil circle for the selected node, dashed
  graphite for locked); statistics as a ledger; trophies as a sticker page (names shown before
  they are earned: the "almost there" list showed them anyway); a drawn keyboard on a new **Keys**
  page (bindings read live from `input.ts`); Unit 7's Codex of pinned specimens; the Survey's
  claims as deed slips; the Megaproject's wants on the left page and the Bay picture taped on the
  right; orders with each customer's line in a bubble; the Patent Office; the Drawer's designs as
  folded paper cards; **Reorganize as the Committee's contract** (you gain, you keep ticked, you
  lose struck through in red ink, "Sign here"); the offline report as **a letter from Bramble**;
  the overnight forecast on **the Inspector's clipboard**; the audit badge as his clipboard hung
  on a string from its box; the grade card as **his report with the grade rubber-stamped in red
  ink** (every grade the same red; the stamp falls from 3x and lands with the shake, the sound,
  ink drops and confetti; S+ keeps its rays and gold rain), advice as rows each with its worth;
  modules as folded paper cards; the Festival's end on a paper sheet.

### Flagged as derivative (owner to decide)
- A radial build menu (pie menus: The Sims, many builders): a genre convention. Hub, petal ring and
  items on twine are not copied from a specific game.
- A mascot's speech-bubble corner for goals (Animal Crossing's Isabelle, Kairosoft's advisors).
- Diegetic menus (the Dock opens orders), a newspaper headline (re-derived from Cookie Clicker's
  news ticker before), an alert bell (re-derived from Factorio's alerts, as the old chip was),
  edge arrows to off-screen things, pinned tooltips: genre conventions.
- **A red rubber stamp on an inspector's report resembles Papers, Please's visa stamp** in look.
  Here it only reveals a computed grade; the player never stamps anything.
- A drawn keyboard on the help page, a sticker album for trophies: generic metaphors.

### Integration (the lead, after both phases)
- **Line tags joined the Dock's and the Hopper's tags** as an inflow row (the top four items by
  rate, each with its `/min`). A tag at each belt's mouth stacked six deep over the Dock's own tag
  at a busy Dock, so the floor read as clutter.
- **Slips and trophy ribbons wait while a page is open** (the last four and two kept) and arrive
  when it closes: they covered the book's header.
- **The Gazette's slip wraps to two lines before it cuts**: one line cut the punchline of most
  headlines to "...".
- **Clipboards keep clear of the corner pieces** (the bubble, the Purse, the Gazette) at twice the
  cost of the floor, and get a second ring of spots further along each side, so three audits at
  once no longer cover the speaker's bubble or each other.
- **The book's header shows the coin you hold**: the book covers the Purse and pages sell things.
- **No edge-scroll while the mouse is over a HUD piece**, so reaching for the notebook doesn't pan.

## The sky island: the world redesigned (2026-10-21)

The owner: *"full redesign the way the gameplay/game looks, the planks and worlds … the
surrounding ocean isn't gonna cut it, I'm thinking Cookie Clicker combined with those factory
Roblox games, tycoon things, Miner's Haven … 300 PixelLab limit, run autonomously."* Asked the two
things CLAUDE.md reserves or that decide everything else, they picked **a floating sky island**
(over a grassy tycoon plot or an underground mine) and **palette B extended** (over a new palette
or keeping B as it was). The plan and the as-built art and code contract: `docs/sky-island.md`.
The look: STYLE.md, "Floors and ground", "The town". Built on branch `sky-island` by a style test
then five agents in worktrees (renderer code; ground, island, sky and ores; the Factory platform;
the town; the title), merged by the lead. Pillar: the plot you watch grow (the tycoon's pleasure),
and readability (DESIGN.md §17).

- **Palette B extended, not replaced** (an "ask before" item, asked): 18 colours appended after
  the pips (sky, cloud, grass, paving, sun; no index moved). Machines, items, the cast and the HUD
  keep every pixel. The style test darkened the meadow from the first proposal: with it a
  deuteranope saw meadow and paving as one beige; `pixel-art/sky/pal.py` tests that now.
- **Owned land is paving, land for sale is meadow** with its plot marked out: the old "deck
  darkened and hatched" became two materials told apart by hue and lightness. Paving C (painted
  concrete with a dotted build grid) over flagstones (charming, the busiest joints) and a riveted
  plate (it blurred into the Factory's steel). Buying a lot paves it in a wave from the middle.
- **The island** (a rim of grass with the town on the north, the south cliff in 3/4 view with the
  floor's ores as veins, an underside tapering to a point, waterfalls into the cloud sea) and
  **the sky** (a dithered gradient, parallax clouds, far islets, birds) replace the water and the
  shore. **The Factory is a riveted sky platform** held up by brass rotors, higher up.
- **The town stands on footings** on the rim (and on the platform's plaza); the Boardwalk is a
  railed promenade, and the order's pitch became "My frogs keep falling off the edge!". Strings
  that put the town in a swamp were rewritten; ids are unchanged (trophy ids are save keys); the
  Swamp Gazette keeps its name as a joke it can tell.
- **Buildings drop in**: anything that stands up falls 14 px and lands with a squash, its dust and
  thump on the landing (belts are laid flat). Presentation only.
- **No sim or data number changed**; saves are unchanged. The old revamp scripts no longer write
  the sprites the sky island took over (`pixel-art/revamp/common.py` `SUPERSEDED`).
- **PixelLab: 2 generations of the 300 allowed** (two tree drafts: one rejected, one became the oak
  and, turned and recoloured, the blossom), counted from each call's own result (the
  account balance moved by ~205 during the work from another session on the same account).

### Flagged as derivative (owner to decide)
- **A floating sky island as your base, other islands on the horizon**: Roblox *Islands* (once
  Skyblock) and Minecraft's Skyblock maps. The owner's pick; our art and rules.
- **The plot you buy paving itself in**: the tycoon genre's "buy a plot, the floor builds in";
  no buy-pads, no walls rising, no Roblox studs or baseplates, nothing from Miner's Haven (no
  droppers, no upgraders, no neon conveyors), nothing from Cookie Clicker (no cookie, no milk, no
  building rows, no wallpaper).
- **Brass rotor pods under a sky platform**: the steampunk family (*BioShock Infinite*'s
  Columbia). Generic.
- **Squash-and-stretch on placement**: a generic animation principle, common in builders.

## After the owner's first play: building, hovers, the notebook (2026-10-21)

The owner, after playing the sky island build: *"it's not common place info to know to right
click to get the miner, the hovering over things gets annoying with how much space it takes up, a
lil overstimulating, and the notebook with half the game in it is a lil too discreet."* Three
fixes, none on CLAUDE.md's ask-before list (no tile size, palette, tick rate, currency, floor,
reset layer or milestone order changed), no sim, data or save change. Pillars: readability
(DESIGN.md §17) and pillar 3 (a bottleneck is never hidden).

- **Building has a button you can see.** The 20x16 toolbox over Bramble's head became a 48x36
  **Build** button there (the toolbox art over the word in Bullfrog, a `Q` keycap on its corner),
  gold and hopping while the goal points into the wheel. The wheel still opens at the cursor by a
  right tap, `Q` or `Space`; **a left click on empty paving** now opens it there too (the first
  thing a new player tries), but not before the Bellows, while every click in the first minute
  is on the ore and a near miss would pop the wheel. A left click with a report pinned only
  unpins it.
- **A goal that names a building has a Grab button in the bubble** ("Grab a Miner {coin}"), gold
  like the Bellows' Buy button; clicking the bubble does the same. With it in hand the bubble shows
  `in hand · LMB place · R turn · RMB drop`. The first Miner's celebration adds a slip naming the
  quick ways in (right tap, a click on paving, `Q`). The wheel stays the one menu; the button only
  puts the goal's building in your hand. On the Factory floor (Voltaire's Boiler goal shows there)
  Grab takes the lift down to the Workshop first, and the Build button glows only for a goal in
  this floor's wheel, and not once the goal's building is in hand.
- **Hover tags wait and shrink.** A floor tag comes after the mouse rests 0.45 s on its thing
  (0.12 s for the next one while one was up a moment ago, so reading along a line is quick and a
  sweep across the floor shows nothing), fading in over 0.1 s. Machines and modules show a **brief
  tag**: the name in Reed (not Bullfrog), the status chips, the rows in warn or bad ink (the
  causes), the rate, and the one verb the left button does (`more` for pin). No bars, no how-to
  rows (the bubble says those), no R and X keycaps (the simple tags, a belt's or a heap's, drop
  that row too). Past five rows plain rows go first and a cause
  never does, so pillar 3 holds; every row is one click away in the pinned report, which is
  unchanged. A new **Options → Hover tags** setting picks Brief (default), Full (every hover row,
  as before) or Off (nothing until you click), stored with the notation in `foldworks_settings`.
- **The notebook's main pages are bookmarks on the screen**: ribbons tucked under the left edge,
  stacked up from the Build button: Research, Orders, then Modules, Codex, Survey, the
  Megaproject, the Drawer and Patents as they open, each with its icon, its name, a live number
  (research, the order and the Megaproject as %, `PICK` or `NEW` when it wants you) and the red dot.
  Statistics, Trophies, the Gazette, Options, Keys and Overnight stay inside the book (the notebook
  icon opens it; its tag lists them). They went on the left, not over the notebook: on the right,
  at 1024x640 they took 60 px from a pinned report docked there and cut three of its rows.
- **e2e**: `hoverTile` and the screens and look harnesses rest `HOVER_WAIT` (650 ms) on a floor
  thing before a shot; `wheelcheck` covers the paving click, the unpin-first click and the Grab
  button, and its "click outside" check uses a tile still on screen since the sky island's framing
  (it had been failing on `main`).

### Flagged as derivative (owner to decide)
- **A column of labelled menu buttons down the left edge** (here bookmarks, with Build at the
  foot): the Roblox tycoon convention (Miner's Haven among many). Our ribbons, art and pages.
- **Click an empty plot to build on it**: the tycoon and city-builder convention. Generic.
- **A tooltip delay with a warm-up**: every desktop OS. Generic.

## Milestone 7: Act III, the District (2026-10-21)

The owner: *"finish the rest of the milestones/game run autonomously, no itch.io page, use up to
250 credits if needed."* The plan for Milestones 7-14 is `docs/endgame.md`; this is Act III as
built. Nothing on CLAUDE.md's ask-before list changed: the tile size, palette (Act III's art uses
palette B extended as it stands), tick rate, currency list, floor list (the District and the World
are `PLAN.md`'s third and fourth floors), reset layers and milestone order stay as written.
Pillars: 1 (folding: groups of groups fold again), 2 (automation: the Dispatcher, the Chute), 3 (a
bottleneck is never hidden: every route says what it carries of what it is wanted).

### The sim
- **The high floors are one system** (`src/sim/systems/high.ts`) over per-floor data
  (`src/data/floors.ts`): the District now, the World in Milestone 9 with its own numbers. A high
  floor holds only modules, its Dock, Hopper and Bay; modules run exactly as the Factory's
  (`stepModule`, extracted), so Overdrive, pausing, the Drill's boost, bills and pips are shared.
- **Skiff routes, not trunks.** A route carries one item from a module's output to a module, the
  Dock, the Hopper or the Bay, at `skiffs x load / (2 x distance / speed + dwell)`, distance
  Euclidean between centres. District: speed 2, load 4, dwell 1 s; a skiff 15,000 coin, flat,
  refunded when lifted; 12 a route; 120 routes a floor. Several routes from one output share it in
  turn (two passes, the same rotation as the Factory's trunks). Why: distance becomes the act's
  layout lesson (a feeder beside its consumer needs one skiff, across the floor three) without belt
  pathing on a floor of whole groups; a flat price, not a curve (CLAUDE.md).
- **The Bay never jams** (as the Factory's): what no open project counts goes on to the Dock.
- **The Chute holds at most 20 of an item**; a full stock stops the Factory Chute taking that item
  and its trunk backs up (the pip says so). **A fold box may not hold a Chute Mouth**: it would make
  items out of nothing as far as the audit can see, so a tier 3 line is fed through ports.
- **Megaprojects #2 and #3 are kept through every reset**, like the Great Drill. The Floating
  City's rewards are a ninth Factory row and a fourth District lot; the Transmuter's are waste
  bought at 25% of what made it, then a byproduct with nowhere to go sold where it stands.
- **The Autonomous Sandwich Engineer is the Assembler Mk2's alone** (a recipe flag `mk2`), so the
  act's last product asks for the Act II machine tier.
- **Recycling and Byproduct modes** are powered-only like Act II's; Byproduct exists because two
  tier 3 inputs are wastes (fertilizer from sludge, gravel from slag).
- **Ten Act III Patents** (DESIGN.md §21 Patents): head starts, Long Skiffs (a rule about distance,
  not output), the Bigger Nest and Ward Boundaries (boxes), the Dispatcher (one skiff every 10 s at
  most, at full price, only for a route under 90% of its want and only while a skiff is under 5%
  of the coin on hand: it never spends a save). The bots' Patent priority list doesn't name them
  until the Act III bot does, so Act I-II pace is unchanged.
- **Challenges** (DESIGN.md §21): taken at a Reorganize from the second one on; a won Challenge
  isn't taken again; giving one up costs only the reward; its reward is the part its rule took
  away (free Splitters, the Bellows, a tenth of the plant, 10% off machines flat, a tile of box).
- **Scenarios**: Tiny Island became chunks A and B (chunk A has no copper; the plan's "chunk A
  only" couldn't make a Gizmo). Rich Ore, Little Power is scored by steel a minute, not steel per
  kW as planned: a Mk1 smelter draws no power, so per kW would be infinite. No Reorganize and no
  land for sale on a board; the records are the app's (local storage), never the sim's.
- **Offline tallies each floor's Dock and Bay apart** (`dock, fdock, ddock, wdock`, `bay, dbay,
  wbay`): an order for one floor fills only from that floor's Dock, and the District's Bay fills
  its own projects, never the Great Drill (before, away time counted District deliveries as the
  Workshop's and the Drill's). A high floor's Bay counts away only what its projects want; the rest,
  which live play sells at the Dock, isn't paid: offline never pays more than live (§12).
- **SAVE_VERSION 8** with an empty migration: every Act III field is absent until it happens, so
  old saves need nothing, but an older build now refuses a save whose District it would drop.
- **Art** (art-director, 0 PixelLab generations): the module's icon well is 8x8 (the plan said
  6x6) and the skiff 12x10 (10x8), as the brief asked; tier 3 icons by shape, not colour only.

### Flagged as derivative (owner to decide)
- **Flying point-to-point carriers whose throughput falls with distance** are Satisfactory's
  Drone Ports (and Mindustry's mass drivers). Ours are bought per route at a flat price, carry one
  item each, and the formula is the round trip; there is no network, no fuel and no battery.
- **A recycler that turns waste into value** is Factorio Space Age's Recycler. Ours is a
  Megaproject's reward (a sale price, then a rule), not a machine you place.
- **Megaprojects built in stages at a bay** echo Satisfactory's Space Elevator phases and Dyson
  Sphere Program's sphere (already flagged for the Great Drill).
- **Puzzle boards scored by area and rate with personal bests** are Zachtronics' (Opus Magnum's
  histograms) and shapez's puzzle mode. Ours score a fold of one product with the game's own
  grade; no histograms, no leaderboard.
- **Challenges, and the Dispatcher as an autobuyer**, are Antimatter Dimensions conventions
  (flagged since `PLAN.md`); goals are factory goals, rewards small rules.
- **A chute dropping items to the floor below** is generic (every multi-level factory game).
