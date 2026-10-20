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
