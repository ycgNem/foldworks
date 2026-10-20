// A quick look: open the game at a size, put it into a named state, and save one PNG.
// node e2e/look.mjs <state> [w] [h]   (states: start, mid, research, orders, stats, trophies, options,
// audit, grade, gradeC, factory, modules, sliceEnd, offline, and Act II's: orders2, codex, survey, mega,
// megaDone, fgrade, faudit, factory2, fbox, modules2, sliceEnd2, festival, festivalFloor, research2,
// factoryOD; the Workshop's audits3 and gradeSplus; foldAnim writes a strip of frames of a fold)
// Writes e2e/out/look/<state>-<w>x<h>.png. For eyeballing while working; npm run screens is the audit.
import fs from 'node:fs';
import { launch, openGame, frames } from './launch.mjs';
import { act2Setup, ACT2, dragTiles, workshopSetup, WORKSHOP } from './screens.mjs';

const [state = 'start', w = '1280', h = '720'] = process.argv.slice(2);
const { browser } = await launch();
const { page, errors } = await openGame(browser, { w: +w, h: +h });
await page.evaluate(() => window.__app.newGame(1));
const mid = async () => {
  await page.evaluate(() => {
    const a = window.__app;
    a.freeze();
    a.grant(3000);
    a.act({ k: 'upgrade', id: 'bellows' });
    a.act({ k: 'place', kind: 'miner', x: 1, y: 2, rot: 0 });
    a.act({ k: 'place', kind: 'belt', x: 2, y: 2, rot: 1 });
    a.act({ k: 'place', kind: 'belt', x: 2, y: 3, rot: 0 });
    a.step(20 * 90);
  });
};
/** a sandboxed fold: chunk C's iron line (tests/fold.test.ts ironLine), audited to a grade */
const foldSetup = async (slagPort) => {
  await page.evaluate((slagPort) => {
    const a = window.__app;
    const g = a.game;
    a.freeze();
    a.grant(1e6);
    g.s.land = ['A', 'B', 'C', 'D'];
    g.s.research.done = ['pressing', 'surveyEast', 'copperSmelting', 'wireDrawing', 'gearcutting', 'splitters', 'buffers', 'gizmoTheory', 'slagBricks', 'folding'];
    g.s.upgrades.push('bellows');
    g.s.ents = g.s.ents.filter((e) => e.kind === 'dock' || e.kind === 'hopper' || e.kind === 'furnace');
    g.rebuild();
    const act = (c) => { const r = a.act(c); if (!r.ok) throw new Error(JSON.stringify(c) + ' ' + r.why); };
    act({ k: 'place', kind: 'miner', x: 2, y: 11, rot: 0 });
    act({ k: 'place', kind: 'smelter', x: 3, y: 11, rot: 0 });
    if (slagPort) { act({ k: 'place', kind: 'belt', x: 3, y: 12, rot: 1 }); act({ k: 'place', kind: 'heap', x: 3, y: 13, rot: 1 }); }
    else act({ k: 'place', kind: 'heap', x: 3, y: 12, rot: 1 });
    act({ k: 'place', kind: 'belt', x: 4, y: 11, rot: 0 });
    for (let y = 11; y > 2; y--) act({ k: 'place', kind: 'belt', x: 5, y, rot: 3 });
    act({ k: 'place', kind: 'belt', x: 5, y: 2, rot: 0 });
    a.step(30 * 20);
    act({ k: 'audit', x: 2, y: 11, w: 2, h: 2 });
    a.lookAt(4, 8);
  }, slagPort);
};
let held = null;
if (WORKSHOP.includes(state)) await page.evaluate(workshopSetup, state);
else if (state === 'foldAnim') {
  // the fold, frame by frame: the graded S+ line folds (crease, corners, squeeze, flash, pop)
  await page.evaluate(workshopSetup, 'gradeSplus');
  await page.evaluate(() => { const a = window.__app; a.panel = null; a.hud.celebs = []; a.hud.rain = []; a.hud.flakes = []; a.hud.confetti = 0; a.renderer.cam.zoom = 3; a.lookAt(3, 12); });
  await frames(page, 30);
  await page.evaluate(() => { const a = window.__app; a.act({ k: 'fold', name: null, id: a.gradeId }); });
  fs.mkdirSync('e2e/out/look', { recursive: true });
  let n = 0;
  for (const f of [4, 10, 18, 30, 46, 62, 80]) {
    await frames(page, f - n);
    n = f;
    await page.screenshot({ path: `e2e/out/look/foldAnim-${f}-${w}x${h}.png` });
  }
  console.log('e2e/out/look/foldAnim-*.png');
  await browser.close();
  process.exit(0);
}
else if (ACT2.includes(state)) { held = await page.evaluate(act2Setup, state); if (held?.drag) await dragTiles(page, held.drag); }
else if (state === 'audit') { await foldSetup(true); await page.evaluate(() => window.__app.step(20 * 30)); }
else if (state === 'grade' || state === 'gradeC') { await foldSetup(state === 'grade'); await page.evaluate(() => window.__app.step(20 * 70)); }
else if (['factory', 'modules', 'sliceEnd', 'offline'].includes(state)) {
  await foldSetup(true);
  await page.evaluate((st) => {
    const a = window.__app;
    a.step(20 * 70);
    a.act({ k: 'fold', name: null });
    const d = a.game.s.designs[0];
    a.act({ k: 'stamp', id: d.id });
    a.act({ k: 'stamp', id: d.id });
    a.panel = null;
    a.setFloor('factory');
    for (const y of [0, 1, 2]) {
      a.act({ k: 'fplace', design: d.id, x: 2, y, rot: 0 });
      for (let x = 3; x < 10; x++) a.act({ k: 'ftrunk', x, y, rot: 0 });
    }
    a.act({ k: 'ftrunk', x: 9, y: 0, rot: 1 });
    if (st !== 'sliceEnd') a.game.s.flags.push('sliceEnd');
    a.step(20 * 20);
    if (st !== 'sliceEnd') a.game.events.drain();
    if (st === 'modules') a.togglePanel('modules');
    if (st === 'offline') {
      a.setFloor('workshop', true);
      a.offline = { away: 3 * 3600 + 720, counted: 3 * 3600 + 720, replayed: 600, extrapolated: 3 * 3600 + 120, coin: a.game.s.coin.constructor.of(48210), hopper: a.game.s.coin.constructor.of(320), research: ['buffers'], orders: ['boardwalk'], firstJam: { t: 214, x: 3, y: 3, floor: 'workshop', name: 'Hand Furnace', why: 'slag' } };
      a.panel = 'offline';
    }
  }, state);
}
else if (state !== 'start') await mid();
if (['research', 'orders', 'stats', 'trophies', 'options'].includes(state)) await page.evaluate((s) => window.__app.togglePanel(s), state);
await frames(page, state === 'megaDone' ? 40 : 6);
fs.mkdirSync('e2e/out/look', { recursive: true });
const out = `e2e/out/look/${state}-${w}x${h}.png`;
await page.screenshot({ path: out });
console.log(out);
if (errors.length) console.log(errors.join('\n'));
await browser.close();
