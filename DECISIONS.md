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
