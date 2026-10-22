// The moments that matter (CLAUDE.md): the planner bot plays seed 1 inside the real game and the
// script stops at each moment, lets the frame settle and saves a screenshot to e2e/out/shots/.
// Each later milestone adds its moments here (the fold box, the audit card, the Factory floor,
// the offline report). Needs the dev server. Usage: npm run shots [-- 1920 1080]
import fs from 'node:fs';
import { launch, openGame, frames, hoverTile } from './launch.mjs';
import { districtSetup, dragTiles } from './screens.mjs';

const [w = 1280, h = 720] = process.argv.slice(2).map(Number);
const OUT = 'e2e/out/shots';
fs.mkdirSync(OUT, { recursive: true });

const { browser } = await launch();
const { page, errors } = await openGame(browser, { w, h });
await page.evaluate(() => { const a = window.__app; a.newGame(1); a.freeze(); a.attachBot('planner'); });
// the mouse rests over the floor, as a player's would (not on the coin counter at 0,0)
await page.mouse.move(Math.floor(w * 0.6), Math.floor(h * 0.45));

const log = [];
/** Run the bot until `until` (a JS expression over g, the Game) holds, at most `max` game seconds. */
async function until(expr, max) {
  return page.evaluate(([expr, max]) => {
    const a = window.__app;
    const f = new Function('g', 'return (' + expr + ');');
    const n = a.botTicks(max * 20, f);
    // drop the toasts of everything that happened on the way; the last second's stay
    a.game.events.drain();
    a.toasts = [];
    a.trophyPops = [];
    a.botTicks(20);
    return { ticks: n, t: a.game.s.tick / 20, ok: !!f(a.game) };
  }, [expr, max]);
}
async function shot(name, note) {
  await frames(page, 8);
  const file = `${OUT}/${name}.png`;
  await page.screenshot({ path: file });
  const t = await page.evaluate(() => window.__app.game.s.tick / 20);
  log.push(`- ${name} at ${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}: ${note}`);
  console.log(`${name}  t=${t.toFixed(1)}s`);
}
/** Hover the first entity of a kind matching a filter, so its report shows. */
async function hoverFirst(filter) {
  const p = await page.evaluate((filter) => {
    const g = window.__app.game;
    const f = new Function('e', 'return (' + filter + ');');
    const e = g.s.ents.find(f);
    return e ? { x: e.x, y: e.y } : null;
  }, filter);
  if (p) { await page.evaluate(([x, y]) => window.__app.lookAt(x + 0.5, y + 0.5), [p.x, p.y]); await frames(page, 2); await hoverTile(page, p.x, p.y); }
  return p;
}

// 1. the first click: the furnace has ore and an ingot is on its way
let r = await until('g.s.counters.clicks >= 1', 30);
await page.evaluate(() => window.__app.step(4));
await shot('01-first-click', 'the first hand-mined ore goes into the Hand Furnace');

// 1b. the Workbench Wheel open at the cursor, the Build petal fanned, the Miner's tag (the 180:
// building from the hand, no numbered hotbar)
await page.evaluate(() => window.__app.openWheelAt());
for (const id of ['wheel_build', 'wheel_item_miner']) {
  await frames(page, 8);
  const p = await page.evaluate((id) => { const a = window.__app; const q = a.ui.ids.get(id); return q ? a.uiToCss(q.x + q.w / 2, q.y + q.h / 2) : null; }, id);
  if (p) await page.mouse.move(p.x, p.y);
}
await shot('01b-wheel', 'the Workbench Wheel, the Miner hovered');
await page.keyboard.press('Escape');
await page.mouse.move(Math.floor(w * 0.6), Math.floor(h * 0.45));

// 2. the Bellows
r = await until("g.s.upgrades.includes('bellows')", 120);
await shot('02-bellows', `Bellows bought (${r.ok ? 'ok' : 'NOT REACHED'})`);

// 3. the first miner line, running a while so belts carry items
r = await until("g.s.ents.some((e) => e.kind === 'miner')", 240);
await page.evaluate(() => window.__app.botTicks(20 * 20));
await shot('03-first-miner-line', `the first Miner feeding the furnace (${r.ok ? 'ok' : 'NOT REACHED'})`);

// 5. the research tree with something under way
r = await until('g.s.research.done.length >= 2', 900);
await page.evaluate(() => window.__app.togglePanel('research'));
await shot('05-research-tree', `the tree after ${r.ok ? 'two nodes' : 'NOT REACHED'}`);
await page.evaluate(() => { window.__app.panel = null; });

// 6. the first order filled, Bramble's card
r = await until('g.s.orders.done.length >= 1', 1800);
await shot('06-first-order', `Bramble's first order filled (${r.ok ? 'ok' : 'NOT REACHED'})`);

// 7. Folding researched: the end of the Workshop's first act
r = await until("g.done('folding')", 3600);
await shot('07-folding', `Folding researched (${r.ok ? 'ok' : 'NOT REACHED'})`);

// 4 (its own game): the first slag jam. The planner builds a Slag Heap before slag can jam, so
// this plays an opening with no heap: Bellows, one Miner into the furnace, the starting heap removed.
await page.evaluate(() => {
  const a = window.__app;
  a.attachBot(null);
  a.newGame(1);
  a.freeze();
  a.grant(70);
  a.act({ k: 'upgrade', id: 'bellows' });
  // the starting Slag Heap holds 53 min of slag (DESIGN §4): take it away to show the jam
  a.act({ k: 'remove', x: 3, y: 4 });
  a.act({ k: 'place', kind: 'miner', x: 1, y: 2, rot: 0 });
  a.act({ k: 'place', kind: 'belt', x: 2, y: 2, rot: 1 });
  a.act({ k: 'place', kind: 'belt', x: 2, y: 3, rot: 0 });
});
r = await until("g.machines.some((m) => m.state === 'blocked' && m.why === 'slag')", 300);
const jam = await hoverFirst("e.state === 'blocked'");
await shot('04-slag-jam', `the Hand Furnace blocked by slag, its report hovered (${r.ok && jam ? 'ok' : 'NOT REACHED'})`);

// 8 (its own game, Milestone 7): the District. 23 groups joined by skiff routes into the Dock, the
// Hopper and the Floating City's Bay, run half a minute so the skiffs carry (e2e/screens.mjs builds it)
const rest = async () => { await page.evaluate(() => { window.__app.hud.goalKey = null; }); await page.mouse.move(Math.floor(w * 0.6), Math.floor(h * 0.92)); };
await page.evaluate(() => window.__app.attachBot(null));
await page.evaluate(districtSetup, 'district');
await rest();
await shot('08-district', 'the District: groups, skiff routes, the orange short route, the Bay');
await page.evaluate(districtSetup, 'districtRoute');
await rest();
await shot('08b-district-route', 'a short route clicked: its card, the readout, + skiff and - skiff with the price');
await page.evaluate(districtSetup, 'districtBox');
await page.evaluate(() => { window.__app.hud.goalKey = null; });
await dragTiles(page, [[4, 6], [7, 8]]);
await shot('08c-district-fold-box', 'a District fold box dragged over the sensor works');
await page.mouse.up();
await page.evaluate(districtSetup, 'districtGrade');
await rest();
await shot('08d-district-grade', "the District fold's grade card");

// ---------------------------------------------------------------- Act III (Milestone 7)
// Set up by screens.mjs's act3Setup (a late game, not the bot's): the Chem Vat, the Greenhouse and
// three Chute Mouths on the Workshop, a Mouth's report with its picker, the Factory Chute full (its
// hover report), Act III's research page and the Floating City under way.
await page.evaluate(() => window.__app.attachBot(null));
for (const [state, name, note] of [
  ['act3ws', '09-act3-workshop', 'Act III on the Workshop: a Chem Vat, a Greenhouse, three Chute Mouths (the last empty)'],
  ['act3mouth', '10-chute-mouth', "a Chute Mouth's report with the item picker"],
  ['act3chuteHover', '11-factory-chute', 'the Factory Chute fed by two modules, steel full, its hover report'],
  ['research3open', '12-research-act3', "Act III's research page, Sensors under way"],
  ['megaCity', '13-floating-city', 'the Floating City: stage 1 built, stage 2 under way'],
]) {
  const { act3Setup } = await import('./screens.mjs');
  const f = await page.evaluate(act3Setup, state);
  await frames(page, 4);
  if (f?.hover) await hoverTile(page, f.hover[0], f.hover[1]);
  await shot(name, note);
  await page.mouse.move(Math.floor(w * 0.6), Math.floor(h * 0.45));
}
// ---------------------------------------------------------------- (end of Act III)

// ---------------------------------------------------------------- Act V (Milestone 10)
// Set up by screens.mjs's act5Setup: the Last Fold's grade card, the sequence mid-fold, the Kernel
// tree, Beyond with its courier routes, the Seed on a new universe's Workshop (pinned) and the
// Endless Ledger.
for (const [state, name, note] of [
  ['lastFoldCardRest', '14-last-fold-card', "the Last Fold's grade card: the bank, what is kept and lost, the Seed"],
  ['lastFoldSeq', '15-last-fold-sequence', 'the Last Fold mid-sequence: the World folding into the Seed'],
  ['kernels', '16-kernel-tree', 'the Kernel tree: Rules, Further, Kept'],
  ['beyondRoute', '17-beyond', 'Beyond: depth-4 modules, courier routes, a route clicked'],
  ['seedPinned', '18-seed', "the Seed on a new universe's Workshop, pinned, wide belts beside it"],
  ['ledger', '19-endless-ledger', 'the Endless Ledger: the order under way, next in turn, the shelf'],
]) {
  const { act5Setup } = await import('./screens.mjs');
  // lesson cards held off (their own states are in screens.mjs); the mouse off the board
  await page.evaluate(() => window.__app.onboarding.lessons.hold(true));
  await page.mouse.move(2, Math.floor(h * 0.3));
  const f = await page.evaluate(act5Setup, state);
  await frames(page, 4);
  if (f?.hover) await hoverTile(page, f.hover[0], f.hover[1]);
  await shot(name, note);
}
await page.evaluate(() => window.__app.onboarding.lessons.hold(false));
// ---------------------------------------------------------------- (end of Act V)

// ---------------------------------------------------------------- Milestone 11 (the long tail)
// Set up by screens.mjs's tailSetup over its base state (a late game, or a busy Act II Workshop):
// the Trophy Shelf, a Codex lore page, Unit 7's ending, the Challenges page, a Scenario board's
// efficiency board, the skin picker in a Miner's report, skinned machines, photo mode and the PNG
// it exports (saved from the download).
{
  const { runTail } = await import('./screens.mjs');
  await page.evaluate(() => window.__app.onboarding.lessons.hold(true));
  for (const [state, name, note] of [
    ['shelf', '20-trophy-shelf', 'the Trophy Shelf: the index of groups, Act I\'s stickers, the one in hand with its bonus'],
    ['shelfBonuses', '20b-shelf-bonuses', "the shelf's bonuses summed against their caps"],
    ['codexLore', '21-codex-lore', "the Codex's Lore: Unit 7's page on the Factory"],
    ['ending', '22-unit7-ending', "Unit 7's ending, its own moment after the first Last Fold"],
    ['challengeList', '23-challenges', 'the Challenges page: all fifteen by act, Headwinds picked for the next run'],
    ['boardNight', '24-scenario-board', "the Scenarios page: Night Market's efficiency board"],
    ['skinPicker', '25-skin-picker', "a Miner's pinned report with its Skin list open"],
    ['skinned', '26-skinned-machines', 'skinned Workshop machines: gilded Miner, candy and starlit Mk1 and Mk2, filigree Steam Engine'],
    ['skinnedDistrict', '26b-skinned-district', 'the District with ghostly modules and paper-crane skiffs'],
    ['skinnedWorld', '26c-skinned-world', 'the World with blueprint modules and stormproof barges'],
    ['photo', '27-photo-mode', 'photo mode: the HUD hidden, the snap strip'],
  ]) {
    await page.mouse.move(2, Math.floor(h * 0.3));
    await runTail(page, state);
    await frames(page, 6);
    await shot(name, note);
  }
  // the photo itself: snapped at 1x, saved from the download
  const dl = page.waitForEvent('download', { timeout: 30000 }).catch(() => null);
  await page.evaluate(() => window.__app.longtail.snap(1));
  const d = await dl;
  if (d) {
    await d.saveAs(`${OUT}/27b-photo-export.png`);
    const info = await page.evaluate(() => window.__lastPhoto);
    log.push(`- 27b-photo-export: the PNG photo mode exported (${info ? `${info.name}, ${info.w}x${info.h}` : 'saved'})`);
  } else log.push('- 27b-photo-export: NO DOWNLOAD');
  await page.evaluate(() => { window.__app.longtail.photo(false); window.__app.onboarding.lessons.hold(false); });
}
// ---------------------------------------------------------------- (end of Milestone 11)

fs.writeFileSync(`${OUT}/shots.md`, `# Shots at ${w}x${h}\n\n${log.join('\n')}\n\n${errors.length ? '## Console\n\n' + errors.map((e) => '- ' + e).join('\n') : 'No console errors.'}\n`);
console.log(log.join('\n'));
if (errors.length) console.log(errors.join('\n'));
await browser.close();
