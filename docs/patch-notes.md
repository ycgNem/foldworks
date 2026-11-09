# Patch notes

## The Playability Update (2026-11-08)

A full review of the game came first: a design critic, a first-time player, a bug hunt and visual QA at nine
window sizes. It is in [playability-review.md](playability-review.md). In short: the first 20 minutes were
good, but folding, the thing that makes Foldworks special, arrived at minute 73. Resets replayed the
tutorial. The story never ended. The long game had turned into bookkeeping. This update fixes all four.

### Fold in the first minutes
- **Folding is the second research** (40 iron plates, right after Pressing). The bot's first fold went
  from 24:35 to 5:17. The first-time player's was at minute 73.
- **The fold box grows with research.** It is 3×3 at Folding, 5×5 at Gearcutting and 8×8 at Gizmo Theory.
  Each node lets you fold a bigger line.
- **The first fold is a win by itself.** It goes to work beside the Factory Dock on its own, so there is
  no income gap. Your first copy (stamp) is free, and one card with one button ("Stamp a copy · free")
  walks you through it.
- **Research no longer stops your income.** Until your first fold, the Hopper pays like the Dock. If
  income ever reaches 0 while your lines feed the Hopper, Bramble says so and names the fix.
- **The Hopper is honest.** Bramble says "Wrong snack!" when it gets an item the selected research
  doesn't take, and "hungry!" when the bar hasn't moved for 10 s. The research page names what is
  going to the bank.
- **The research page:** a click on a node always does the same thing, and the frog's suggestion chips
  open the right node. The confusing ★ is gone.
- Lesson cards come one at a time, 25 s apart.
- **Goals always point at something you can do now.** Before, the frog asked for Surveying for 15
  minutes while it was still off the page. A long research fill says how long it takes and which
  stamp shortens it.
- The slice (Act I) ends at 20:36 for the bot, down from 31:43.

### A Reorganize keeps what you learned
- **From your second run on, every Act I-II research is known from the first tick.** The Factory floor is
  open from the start.
- **The Drawer's designs come back already built**, at their grade and rates, with one free copy each.
- **An order you filled is never asked for again.** The Town keeps every order you ever filled, so it is
  the record of everything you built. The Committee's orders still repeat, because they gate the Great
  Drill.
- **The Patent tree was re-cut** around what a returning run still has to rebuild by hand: land deeds,
  claims kept on file, spare dies, the Filing Cabinet (a bigger Drawer) and the Floor Plan (the
  Draughtsman lays your last Factory floor again).
- **Dies on file**, a Patent sink that grows with your Drawer: 1 Patent buys one more starting copy of a
  kept design, up to 4 per design.
- **The Reorganize card tells you what you get.** It shows "back to X/min in ~N min", what you keep, what
  you lose and what comes back built. When the tree is bought out it says plainly that there is nothing
  to buy.
- At the 15 h checkpoint, a Reorganize used to drop income from 573K/min to 90/min. Now the next run makes
  2.1K/min at 5 minutes and 13K/min at 9.
- Old saves are refunded every removed head start at its old price.

### An ending
- **Finishing the Floating City ends the story.** It lifts off the island, the Swamp Gazette prints a
  special, the customers have their say, and the credits roll with your own numbers. Then "The story
  isn't over": the World floor and Acts IV-V are the post-game.
- The ending can be replayed from a new Codex page. The trophy for it is now called "Lift-off".
- **The Spires want rotors, glass and steel**: 1,800 rotors, 30,000 glass and 24,000 steel (no more
  sandwiches, the chain no bot could finish). Charting needs the City alone; the Transmuter is
  optional.
- **The Great Drill's first stage comes in three parts**: the Scaffold, the Engine House and the Cab.
  Each one changes the Bay's picture, puts a crew house in the Town and makes the Gazette. The longest
  Act II wait went from ~40 to ~17 minutes.
- The bot now finishes the City at about 13 h of its own play, in its third run. That is about
  19-21 h for a person playing for the first time. Before, it never got there in 40 h.

### The District routes itself
- **Placing a group flies its routes on its own**: products to whoever needs them, inputs from the nearest
  feeders, and skiffs to carry each rate. At 15 h, 137 of 165 routes had been drawn by hand.
- **Only problems show a dot.** Roofs are tinted by product tier, and busy floors quiet their routes.
- **Rates read per minute** on every high floor.
- **The strip shows each floor's real limits**: routes, tiles and the next skiff's price, with a hint when
  one of them binds.
- **Coin matters again.** A skiff costs 40K plus 2K per skiff you own (linear), and District lots cost
  4M each.

### Easier hands
- **Drag empty ground to pan.** WASD and the arrow keys glide; the mouse wheel always zooms about the
  cursor.
- **Shift+R turns the other way.** The ghost carries a gold arrow showing which way it faces.
- **Right-click drops what's in your hand**, even over a tag.
- **The build wheel names things**, and each item shows its number key.
- **Touch works**: drags pan and build. A phone held upright gets a "turn your phone" card.

### A calmer screen
- **Labelled floor buttons** top right replace the "D W F" dial.
- **The trouble bell is the one place for trouble.** It counts causes, not machines; a click steps
  through them, and G jumps to the worst. "Stuck?" merged into it. At 15 h the bell used to read 61; now
  it reads nothing, because nothing that matters is stuck.
- **Trophies arriving together become one ribbon** ("28 trophies!").
- The Gazette folds to its icon after your first five minutes, except for breaking news.
- Bookmarks show only pages with something live. Power tags show only below 100%.
- Floor tags move off the land you build on. Photo mode moved to Options (H still works).
- This card, "What's new", shows once after an update and again from Options.

### Fewer things to track
The review counted about eleven currency-like things to keep in your head by 15 h. These went:
- **Machine Kits are gone.** A copy of an Act II design costs coin only, as in Act I.
- **Machine modes are gone**, and with them the Tuning and Recycling research. They were Factorio's
  modules in other clothes and added a knob to every machine.
- Their rewards moved. Hand-Made: a design's first copy is free. Unit 7's Sorting Crates: a Buffer
  Crate holds 100. The Committee's Pocketed Claims: a Survey Office block is 5 claims.
- **Inspiration is gone.** Clicking a Hopper no longer adds research; a click opens the research page.
  Research comes from what you deliver.
- **The Lucky Vein is gone.** It was Cookie Clicker's golden cookie. The Inspector is the one Spark
  left: it grades one of your real lines and pays half a minute of that line's output. Its trophies
  are renamed to match (Spot Check, Regular Visitor, First-Name Terms).
- **Challenges and Scenarios wait for the ending.** They open once the Floating City lifts off, on
  their own page in Options. The Reorganize card no longer offers a Challenge.
- Old saves lose the cut things and keep everything else.

### The second playtest
A second first-time player tried the merged build. What they hit, fixed:
- **The 15 h Factory no longer jams.** A full Factory Chute stopped 10 of 11 modules. Now what the
  Chute can't hold sells at the Factory Dock.
- **The Reorganize card's estimate is honest.** It read "back in ~455 min" at the 15 h checkpoint,
  from a run measured under the old rules. Now it reads "~15 min", and it never shows a time past
  30 minutes.
- **Two-input modules explain themselves.** A module's report says what it needs at its back and how
  to feed it. PACED means a slower module downstream holds it back. A starved module names its
  feeder, and the iron module says which trunk carries its slag away.
- **Placed belts show which way they face**, and that R turns them.
- **One thing at a time.** Hover tips wait 0.4 s and keep clear of the button under the cursor.
  Toasts and banners queue instead of stacking.
- Smaller fixes:
  - A fold box's refusal shows at the box.
  - The text says "an iron" where it said "a iron".
  - Copy prices read "250, then +50 each".
  - The District Dock lights only its six busiest routes.
  - The build wheel opens on Build.
  - Lessons a save already earned count as seen.
  - Zooming out stops where the island fits.
  - The wheel shows module names in full.
  - The fold report and the bell suggest the same fix.

### The balance pass
After every change was in, the pacing tests (a bot plays the game for up to 40 h on two seeds) were
run on the whole build, and each one that failed was fixed:
- **Time away pays what it should.** A heap that emptied while you were away wasn't counted, so
  8 h away paid a little under half of what the factory makes while you watch. Now it pays just
  over half, and just over three quarters with the Patent tree's offline upgrades.
- **The City's Spires want more** (above). With every cut in, the City came at about 15 h for a
  person, too early for the 18-25 h aim. It now comes at about 19-21 h.
- The bot plays a returning run better: it nests its kept designs before laying the Bay floor. Its
  second run gets back to its first run's best income in 21 minutes, and a long run still earns more
  Patents an hour than resetting early and often (3.59 against at most 2.39). No Patent formula
  changed.
- The bot now reaches Act IV in a measured run (Charting at 13.5 h, the first Relocate at about
  15 h).

### Fixes
- Two open tabs no longer overwrite each other's save. The other tab says so and offers "Play here
  instead".
- New game over an existing save asks first.
- The offline report is modal: no more "+-67.4M" from reorganizing mid-report.
- The Standing Committee's automatic Reorganize no longer strands you on a floor that is gone.
- Design share strings (FWD1) work for every line, Act III included.
- Importing a save resets the floor, tool and panels. A damaged string says so instead of showing a
  JavaScript error.
- A trackpad no longer zooms the whole range in one swipe. Quick clicks are no longer lost.
- On a phone, a swipe no longer leaves the page.
- Free reputation crates no longer refund 30 coin a minute forever.
- The Last Fold no longer counts an island's Megaproject toward Home's.
- A save whose backups are all damaged says so, instead of silently starting a new game.
- The Spires' goal line names what they actually want.
- Starting a new game or importing a save while an offline catch-up runs no longer freezes the new
  game.
- A toast no longer shows raw markup ("k:SHIFTk:LMB").
