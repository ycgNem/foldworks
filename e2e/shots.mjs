// The moments that matter (CLAUDE.md): the planner bot plays seed 1 inside the real game and the
// script stops at each moment, lets the frame settle and saves a screenshot to e2e/out/shots/.
// Each later milestone adds its moments here (the fold box, the audit card, the Factory floor,
// the offline report). Needs the dev server. Usage: npm run shots [-- 1920 1080]
import fs from 'node:fs';
import { launch, openGame, frames, hoverTile } from './launch.mjs';

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

// ---------------------------------------------------------------- Act III (Milestone 7)
// Set up by screens.mjs's act3Setup (a late game, not the bot's): the Chem Vat, the Greenhouse and
// three Chute Mouths on the Workshop, a Mouth's report with its picker, the Factory Chute full (its
// hover report), Act III's research page and the Floating City under way.
await page.evaluate(() => window.__app.attachBot(null));
for (const [state, name, note] of [
  ['act3ws', '08-act3-workshop', 'Act III on the Workshop: a Chem Vat, a Greenhouse, three Chute Mouths (the last empty)'],
  ['act3mouth', '09-chute-mouth', "a Chute Mouth's report with the item picker"],
  ['act3chuteHover', '10-factory-chute', 'the Factory Chute fed by two modules, steel full, its hover report'],
  ['research3open', '11-research-act3', "Act III's research page, Sensors under way"],
  ['megaCity', '12-floating-city', 'the Floating City: stage 1 built, stage 2 under way'],
]) {
  const { act3Setup } = await import('./screens.mjs');
  const f = await page.evaluate(act3Setup, state);
  await frames(page, 4);
  if (f?.hover) await hoverTile(page, f.hover[0], f.hover[1]);
  await shot(name, note);
  await page.mouse.move(Math.floor(w * 0.6), Math.floor(h * 0.45));
}
// ---------------------------------------------------------------- (end of Act III)

fs.writeFileSync(`${OUT}/shots.md`, `# Shots at ${w}x${h}\n\n${log.join('\n')}\n\n${errors.length ? '## Console\n\n' + errors.map((e) => '- ' + e).join('\n') : 'No console errors.'}\n`);
console.log(log.join('\n'));
if (errors.length) console.log(errors.join('\n'));
await browser.close();
