# Playability review (2026-11-08)

The owner asked for a full, honest review of playability, how long someone would play and enjoy it, bugs and
simplicity, and then for improvements, radical ones included. Four reviewers looked at the built game (the
production build of `main` at 1d0e84c):
- a design critic (the idle-critic agent): the whole arc, with the bots' measurements;
- a first-time player who decided only from the screen and played ~80 game-minutes;
- a bug hunt: the suites, exploratory play and code reading;
- visual QA at nine viewports, with the 15 h save.

The lead also played the opening and the 15 h checkpoint.

## Verdict

**The first 10-20 minutes are good. Everything that makes Foldworks special arrives too late, and the long game
turns into bookkeeping.**

- **The opening sells it.** The title, the first click, the crank, the first sale, the Bellows by ~25 s, the
  Miner by ~50 s, the first slag jam explained by its hover report, and the Boardwalk building itself in town.
  Two reviewers independently called the audit/grade card "the best screen in the game".
- **The hook is hidden.**
  - The title promises "Build a line. Fold it into a tile." The planner bot, which knows the plan, folds first
    at 21:45; a first-time player folded at **minute 73**.
  - The real "aha" (stamp a copy, income doubles) came at minute 78.
  - From minute 17 to 70 the loop was "pick a research node, wait on a Hopper bar"; Folding asks 500 gears and
    50 Gizmos at ~15 gears a minute.
  - The playtester would have quit at minute 35-45.
- **The resets replay the tutorial.**
  - Signing the 15 h save's Reorganize dropped income from 573K/min to 90/min.
  - The first orders (the Boardwalk, Lamp Posts) came back, and every run spends 2.3-2.5 h getting back to Act III.
  - The Patent tree is bought out by ~17 h, after which layer 1 has nothing to give.
- **The mid-game is an invisible economy.** At 15 h: 46M coin on hand, a skiff costs 4 s of income, and the real
  limits (routes, claims, tiles) sit in a strip. The District is 108 near-identical huts joined by 137 hand-drawn
  routes under a carpet of pips.
- **Acts IV-V are unreachable as built.** Act IV needs both Act III Megaprojects, which the bot can't finish
  by 40 h. No one would get there; no one has measured it.
- **Complexity.** About 12 concepts by 5 min (fine), ~30 by 1 h, ~60 by 5 h, ~90 by 15 h. At 15 h about 22 things
  are on screen at once (8 rail tabs, a bell reading 61, two banners, the ticker, the bubble, floor tags on the
  tiles). PLAN.md capped the currencies at six; a player tracks about eleven.

## How long would someone play?

| Point | Still playing (critic's estimate) | What makes people leave there |
|---|---|---|
| 2 min | ~85% | a dense HUD; otherwise the opening is strong |
| 10 min | ~60% | a decent belt game with a lot of text; no folding yet |
| 30 min | ~35% | the 500-gear Folding grind, no open orders, a camera that won't move |
| 2 h | ~15% | Act II arrives all at once (power, Mk2, modes, claims, Machine Kits), then a ~40 min Bay wait |
| 10 h | ~4% | the first Reorganize replays the tutorial |
| 40 h | <1% | the Patent tree is empty; Act III doesn't end |

A fan of the genre enjoys 1-3 sessions (2-5 h). The playtester: "After 10 minutes, yes. After an hour, honestly,
probably not."

## Bugs found (all fixed, commit 036479a)

1. **Two open tabs overwrote each other's save.** A forgotten tab put a 9M town back to 1,000 coin. Now one tab
   plays at a time, and the other says so.
2. **One click on New game wiped a 15 h save.** Now it asks once.
3. **The offline report was not modal.** Pressing Esc mid-run and reorganizing paid the time away into the new run
   ("+-67.4M").
4. **The Standing Committee's automatic Reorganize stranded the player** on a District that no longer existed,
   unsaid and unsaved.
5. **Design share strings (FWD1) broke for every Act III line.**
6. **Importing a save kept the old floor, tool and panels.** Forged strings showed raw JavaScript errors.
7. **A trackpad zoomed the whole range in one gesture.** Quick clicks were lost.
8. **On a phone, a swipe left the page** and touch drags did nothing.
9. **Free reputation crates refunded 30 coin**, once a minute forever.
10. **The Last Fold counted an island's Megaproject progress toward Home's.**
11. **A save with every backup damaged loaded silently as a new game.**

## What is being changed

Five agents work in parallel (one area each), then a second wave:

1. **The fold in the first minutes.** Folding moves early in the research order, the box grows with research, and
   the first fold is one staged moment and an immediate win. Research stops eating the whole income, the Hopper
   says when it gets the wrong item, and the research panel's suggestion chips no longer open the wrong node.
2. **Resets that slingshot.** A Reorganize keeps Acts I-II research and the Drawer's designs. Old orders stay
   filled, and the Patents get a sink that scales (or say plainly that nothing is left).
3. **Act III ends, with an ending.** Charting no longer needs both Megaprojects. The Floating City's completion is
   a staged finale with credits (Acts IV-V become the post-game), and Act II's Bay wait is split into sub-goals.
4. **The District reads.**
   - Auto-routing on placement.
   - Pips only for problems, and groups you can tell apart.
   - Rates per minute.
   - The floor's real limit shown, and prices that make coin matter.
5. **The HUD and the camera.**
   - Drag to pan, keys that pan, zoom to the cursor, and Shift+R to rotate the other way.
   - Names on the build wheel; right-click drops the item in hand.
   - Bookmarks that stop shouting NEW, labelled floor buttons, and the ticker shrunk.
   - Floor tags off the tiles; trophy banners batched.
   - A readable phone layout, or a plain "turn your phone" card.
6. **Second wave: cut what doesn't carry its weight.** Machine Kits (3,955 banked unused at 15 h), machine modes
   (flagged as derivative of Factorio's modules) and Inspiration. The Lucky Vein, Cookie Clicker's golden cookie
   in all but name, gets re-derived or dropped.

Each change is measured with the bots and pace tests, and written up in DESIGN.md and DECISIONS.md.

## Flagged as derivative (new)
- **The Lucky Vein**: a random clickable spawn giving x3 for 60 s is Cookie Clicker's golden cookie into Frenzy.
- **Per-customer heart rows**: Stardew Valley's friendship hearts (mild; a cozy convention).
- **Picking a Challenge on the reset card**: Antimatter Dimensions' challenge entry at the prestige moment.
