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
