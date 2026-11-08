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
- **Research no longer stops your income.** Until Pressing is done, the Hopper pays like the Dock.
- **The Hopper is honest.** Bramble says "Wrong snack!" when it gets an item the selected research
  doesn't take, and "hungry!" when the bar hasn't moved for 10 s. The research page names what is
  going to the bank.
- **The research page:** a click on a node always does the same thing, and the frog's suggestion chips
  open the right node. The confusing ★ is gone.
- Lesson cards come one at a time, 25 s apart.
- The slice (Act I) ends at 21:35 for the bot, down from 31:43.

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
- **The Spires want rotors, glass and steel** (no more sandwiches, the chain no bot could finish).
  Charting needs the City alone; the Transmuter is optional.
- **The Great Drill's first stage comes in three parts**: the Scaffold, the Engine House and the Cab.
  Each one changes the Bay's picture, puts a crew house in the Town and makes the Gazette. The longest
  Act II wait went from ~40 to ~17 minutes.
- The bot now reaches the City at about 12.5 h. Before, it never got there in 40 h.

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
