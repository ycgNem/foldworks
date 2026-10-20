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
