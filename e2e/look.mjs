// A quick look: open the game at a size, put it into a named state, and save one PNG.
// node e2e/look.mjs <state> [w] [h]   (states: start, mid, research, orders, stats, trophies, options,
// audit, grade, gradeC, factory, modules, sliceEnd, offline, and Act II's: orders2, codex, survey, mega,
// megaDone, fgrade, faudit, factory2, fbox, modules2, sliceEnd2, festival, festivalFloor, research2,
// factoryOD, act2ws, townStart, townLamps, townFestival, townAct2; the Workshop's audits3 and gradeSplus; foldAnim writes a strip of frames of a fold)
// Writes e2e/out/look/<state>-<w>x<h>.png. For eyeballing while working; npm run screens is the audit.
import fs from 'node:fs';
import { launch, openGame, frames } from './launch.mjs';
import { act2Setup, ACT2, dragTiles, workshopSetup, WORKSHOP, m5Setup, M5, idleSetup } from './screens.mjs';

const [arg = 'start', w = '1280', h = '720'] = process.argv.slice(2);
// ---- the Workbench Wheel (src/app/wheel.ts): open on a base state, a petal fanned, an item hovered
// wheel (the start: Build and Tools), wheelTools, wheel2 (Act II, an affordable Power item),
// wheel2lock (Act II, a locked Heavy item), wheel2up (Upgrades), wheelFactory (a design hovered),
// wheelHub (the hub's last building), wheelEdge (opened by a right tap near the screen's corner)
const WHEELS = {
  wheel: { base: 'start', petal: 'build', item: 'miner' },
  wheelTools: { base: 'start', petal: 'tools', item: 'fold' },
  wheel2: { base: 'act2ws', petal: 'power', item: 'generator' },
  wheel2lock: { base: 'act2ws', petal: 'heavy', item: 'smelterMk2', lock: ['heavyMachines', 'refining'] },
  wheel2up: { base: 'act2ws', petal: 'upgrades', item: null },
  wheelFactory: { base: 'factory2', petal: 'modules', item: 'design' },
  wheelHub: { base: 'act2ws', petal: 'build', item: 'hub', held: 'press' },
  wheelEdge: { base: 'start', petal: null, item: null, tap: [0.08, 0.8] },
};
const wheel = WHEELS[arg] ?? null;
const state = wheel ? wheel.base : arg;
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
if (state === 'parade') {
  // the Festival fills: the coin cascade, the reputation banner, the Gizmo parade into the
  // Factory Dock, then the slice-end card (a strip of frames)
  await page.evaluate(act2Setup, 'festivalFloor');
  await page.evaluate(() => {
    const a = window.__app;
    const g = a.game;
    a.panel = null;
    a.fitCamera(true);
    g.s.orders.progress.gizmoFestival.gizmo = g.s.coin.constructor.of(398);
    for (let i = 0; i < 20 * 60 && !g.s.orders.done.includes('gizmoFestival'); i++) a.step(1);
    a.step(20);
  });
  fs.mkdirSync('e2e/out/look', { recursive: true });
  let n = 0;
  for (const f of [8, 30, 70, 130, 260]) {
    await frames(page, f - n);
    n = f;
    await page.screenshot({ path: `e2e/out/look/parade-${f}-${w}x${h}.png` });
  }
  console.log('e2e/out/look/parade-*.png');
  if (errors.length) console.log(errors.join(' | '));
  await browser.close();
  process.exit(0);
}
if (state === 'firsts') {
  // the banners for firsts: a Codex entry, the first Mk2 and a reputation level, stacked
  await page.evaluate(act2Setup, 'act2ws');
  await page.evaluate(() => {
    const a = window.__app;
    const g = a.game;
    g.s.counters.mk2Built = 0;
    a.act({ k: 'place', kind: 'smelterMk2', x: 10, y: 10, rot: 0 });
    const d = g.s.ents.find((e) => e.kind === 'dock');
    g.emit({ type: 'codex', id: 'glass', value: 360, x: d.x, y: d.y });
    g.s.orders.done.push('lensArray');
    g.s.orders.rep.unit7 = 2;
    g.emit({ type: 'order', id: 'lensArray', value: 24000 });
    a.step(1);
  });
  await frames(page, 24);
  fs.mkdirSync('e2e/out/look', { recursive: true });
  await page.screenshot({ path: `e2e/out/look/firsts-${w}x${h}.png` });
  console.log(`e2e/out/look/firsts-${w}x${h}.png`);
  if (errors.length) console.log(errors.join(' | '));
  await browser.close();
  process.exit(0);
}
// ---- the 180, menus B: the Milestone 5 pages (reorg, patents, patentsHover, drawer, committee,
// annex, mega2) and the idle ones (offline2: a 9 h report, offlineRun: one under way, overnight:
// the forecast with a stopped line), borrowed from e2e/screens.mjs
const IDLE_LOOK = { offline2: 'report', offlineRun: 'running', overnight: 'overnight' };
if (M5.includes(state) || IDLE_LOOK[state]) {
  const r = M5.includes(state) ? await page.evaluate(m5Setup, state) : await page.evaluate(idleSetup, IDLE_LOOK[state]);
  if (r?.hoverId) {
    await frames(page, 2);
    const p = await page.evaluate((id) => { const a = window.__app; const q = a.ui.ids.get(id); return q ? a.uiToCss(q.x + q.w / 2, q.y + q.h / 2) : null; }, r.hoverId);
    if (p) await page.mouse.move(p.x, p.y);
  }
  await frames(page, 6);
  fs.mkdirSync('e2e/out/look', { recursive: true });
  const out = `e2e/out/look/${state}-${w}x${h}.png`;
  await page.screenshot({ path: out });
  console.log(out);
  if (errors.length) console.log(errors.join(' | '));
  await browser.close();
  process.exit(0);
}
// ---- end of the menus B block

// ---- the 180's screen (docs/hud-180.md; the screen agent's states, phase 2) ----
// jam180: a slag jam, the furnace's report pinned, the bell ringing; jamHover: the same, hovered;
// power180: a busy Act II Workshop with grids and floor tags, a kiln pinned, a boiler hovered;
// page180: a page open with the section tabs; gazette180: the Gazette's page; reorg180: the
// Committee's slip under the Purse
const H180 = ['jam180', 'jamHover', 'power180', 'page180', 'gazette180', 'reorg180', 'title180', 'purse180', 'bell180', 'refuse180'];
if (H180.includes(state)) {
  const hover = await page.evaluate((st) => {
    const a = window.__app;
    const g = a.game;
    if (st === 'title180') { a.screen = 'title'; return null; }
    if (st !== 'power180') {
      a.freeze();
      a.grant(70);
      a.act({ k: 'upgrade', id: 'bellows' });
      const f = g.machines.find((m) => m.kind === 'furnace');
      a.act({ k: 'place', kind: 'miner', x: f.x - 1, y: f.y, rot: 0 });
      a.step(20 * 60);
      f.state = 'blocked';
      f.why = 'slag';
      f.by = 5;
      f.hist = 'w'.repeat(20) + 'x'.repeat(40);
      a.game.events.drain();
      a.renderer.fx.flyers = [];
      a.renderer.fx.pops = [];
      a.toasts = [];
      a.trophyPops = [];
      a.hud.bellAt = a.ui.time;
      a.selected = st === 'jam180' ? f.id : null;
      if (st === 'jam180') a.toast('Blocked: slag!', 'Smelting leaves slag, and it has nowhere to go.', '#c8362e');
      if (st === 'page180') a.panel = 'research';
      if (st === 'gazette180') { for (let i = 0; i < 9; i++) a.gazette.next(g); a.panel = 'gazette'; }
      if (st === 'reorg180') g.s.megaPatents = 12;
      if (st === 'refuse180') { a.refusal = { text: 'Not enough coin: a Smelter costs 60', t: 2 }; return [f.x + 2, f.y + 1]; }
      return st === 'jamHover' ? [f.x, f.y] : st === 'purse180' ? 'purse' : st === 'bell180' ? 'nextProblem' : null;
    }
    // power180: the act2power state of e2e/screens.mjs, with Tuning
    a.freeze();
    a.grant(2.4e6);
    g.s.land = ['A', 'B', 'C', 'D', 'E', 'F'];
    g.s.upgrades.push('bellows');
    g.s.research.done = ['pressing', 'surveyEast', 'copperSmelting', 'wireDrawing', 'gearcutting', 'splitters', 'buffers', 'gizmoTheory', 'slagBricks', 'folding', 'coalSeams', 'steelmaking', 'overdrive', 'steamPower', 'glassworks', 'crushing', 'concrete', 'refining', 'machineKits', 'tuning'];
    g.s.research.selected = 'circuits';
    g.s.research.progress = { circuits: { copperWire: g.s.coin.constructor.of(310), glass: g.s.coin.constructor.of(44) } };
    g.s.flags.push('factoryOpen', 'factorySeen', 'sliceEnd', 'ordersSeen');
    g.s.orders.done = ['boardwalk', 'lampPosts', 'gizmoFestival', 'calibration'];
    g.s.orders.rep = { bramble: 3, unit7: 1, voltaire: 1 };
    g.s.orders.active = 'lensArray';
    g.s.orders.progress = { lensArray: { glass: g.s.coin.constructor.of(212), circuit: g.s.coin.constructor.of(18) } };
    g.s.parts = g.s.coin.constructor.of(14);
    g.s.income = Array(60).fill(140);
    a.renderer.ground = null;
    g.rebuild();
    const act = (c) => { const r = a.act(c); if (!r.ok) throw new Error(JSON.stringify(c) + ' ' + r.why); };
    act({ k: 'place', kind: 'boiler', x: 16, y: 4, rot: 0 });
    act({ k: 'place', kind: 'steamEngine', x: 17, y: 4, rot: 0 });
    act({ k: 'place', kind: 'pole', x: 18, y: 3, rot: 0 });
    act({ k: 'place', kind: 'pole', x: 22, y: 3, rot: 0 });
    for (const x of [19, 20, 21, 22, 23]) act({ k: 'place', kind: 'kiln', x, y: 1, rot: 3 });
    act({ k: 'place', kind: 'mixer', x: 23, y: 4, rot: 0 });
    act({ k: 'recipe', x: 23, y: 4, recipe: 'mixConcrete' });
    for (const x of [19, 20, 21, 22, 23]) { act({ k: 'recipe', x, y: 1, recipe: 'fireGlass' }); g.entAt(x, 1).inBuf.sand = 4; }
    act({ k: 'place', kind: 'miner', x: 1, y: 2, rot: 0 });
    g.entAt(16, 4).inBuf.coal = 8;
    const m = g.entAt(23, 4);
    m.inBuf.gravel = 4; m.inBuf.sand = 2;
    a.step(20 * 3);
    g.entAt(16, 4).inBuf.coal = 8;
    for (const x of [19, 20, 21, 22, 23]) g.entAt(x, 1).inBuf.sand = 4;
    a.step(10);
    a.game.events.drain();
    a.toasts = [];
    a.panel = null;
    a.setFloor('workshop', true);
    a.fitCamera(true);
    a.selected = g.entAt(21, 1).id;
    a.renderer.fx.flyers = [];
    a.renderer.fx.pops = [];
    return [16, 4];
  }, state);
  if (typeof hover === 'string') {
    await frames(page, 3);
    const p = await page.evaluate((id) => { const a = window.__app; const q = a.ui.ids.get(id); return q ? a.uiToCss(q.x + q.w / 2, q.y + q.h / 2) : null; }, hover);
    if (p) await page.mouse.move(p.x, p.y);
  } else if (hover) { const p = await page.evaluate(([x, y]) => window.__app.tileToCss(x, y), hover); await page.mouse.move(p.x, p.y); }
}
// ---- end of the 180's states ----
if (H180.includes(state)) { /* set up above */ }
else if (WORKSHOP.includes(state)) await page.evaluate(workshopSetup, state);
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
else if (ACT2.includes(state)) {
  held = await page.evaluate(act2Setup, state);
  if (held?.drag) await dragTiles(page, held.drag);
  else if (held?.hover) { const p = await page.evaluate(([x, y]) => window.__app.tileToCss(x, y), held.hover); await page.mouse.move(p.x, p.y); }
}
// ---- the 180's fold look states (fold.ts): an audit still warming up, the Modules page with no
// designs yet, and three audits with the camera panned away so their clipboards hang as tags at
// the view's edge
else if (state === 'auditWarm') { await foldSetup(true); await page.evaluate(() => window.__app.step(20 * 4)); }
else if (state === 'modulesEmpty') { await foldSetup(true); await page.evaluate(() => { const a = window.__app; a.game.s.audits = []; a.togglePanel('modules'); }); }
else if (state === 'auditEdge') { await page.evaluate(workshopSetup, 'audits3'); await page.evaluate(() => { const a = window.__app; a.renderer.cam.zoom = 4; a.lookAt(16, 3); }); }
// ---- end of the fold look states
else if (state === 'audit') { await foldSetup(true); await page.evaluate(() => window.__app.step(20 * 30)); }
else if (state === 'grade' || state === 'gradeC') { await foldSetup(state === 'grade'); await page.evaluate(() => window.__app.step(20 * 70)); }
else if (['factory', 'modules', 'sliceEnd', 'offline'].includes(state)) {
  await foldSetup(true);
  await page.evaluate(async () => { window.__offline = await import('/src/sim/offline.ts'); });
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
      // a real offline run (Milestone 6's report needs its timeline and totals)
      a.offline = window.__offline.runOffline(a.game, 3 * 3600 + 720);
      a.panel = 'offline';
    }
  }, state);
}
else if (state !== 'start') await mid();
if (['research', 'orders', 'stats', 'trophies', 'options'].includes(state)) await page.evaluate((s) => window.__app.togglePanel(s), state);
// ---- the 180, menus A: the notebook's Keys page (the drawn keyboard), over the mid game
if (state === 'keys') await page.evaluate(() => { window.__app.panel = 'keys'; });
// ---- end menus A
await frames(page, state === 'megaDone' ? 40 : state === 'gradeSplus' ? 36 : 6);
if (wheel) {
  await page.evaluate(async (wl) => {
    const a = window.__app;
    a.panel = null;
    a.toasts = [];
    if (wl.lock) { a.game.s.research.done = a.game.s.research.done.filter((r) => !wl.lock.includes(r)); a.game.rebuild(); }
    if (wl.held) a.pickBuild(wl.held);
  }, wheel);
  await frames(page, 2);
  if (wheel.held) { await page.evaluate(() => window.__app.setMode({ k: 'idle' })); await frames(page, 2); }
  const cssOf = (r) => page.evaluate((r) => window.__app.uiToCss(r.x + r.w / 2, r.y + r.h / 2), r);
  const mark = (id) => page.evaluate((id) => { const r = window.__app.ui.ids.get(id); return r ? { ...r } : null; }, id);
  if (wheel.tap) {
    const vp = page.viewportSize();
    await page.mouse.move(vp.width * wheel.tap[0], vp.height * wheel.tap[1]);
    await frames(page, 2);
    await page.mouse.down({ button: 'right' });
    await frames(page, 2);
    await page.mouse.up({ button: 'right' });
    await frames(page, 12);
  } else {
    await page.evaluate(() => { const a = window.__app; a.openWheelAt(a.ui.w / 2 - 40, a.ui.h / 2); });
    await frames(page, 4);
  }
  if (wheel.petal) {
    const r = await mark('wheel_' + wheel.petal);
    if (r) { const p = await cssOf(r); await page.mouse.move(p.x, p.y); await frames(page, 14); }
    else console.log('no petal mark', wheel.petal);
  }
  if (wheel.item) {
    const id = wheel.item === 'hub' ? 'wheel_hub' : wheel.item === 'design' ? await page.evaluate(() => 'wheel_item_module_' + window.__app.game.s.designs[0]?.id) : 'wheel_item_' + wheel.item;
    // over the gap to the arc first (the petal stays fanned), then onto the item
    const r = await mark(id);
    if (r) { const p = await cssOf(r); await page.mouse.move(p.x, p.y, { steps: 4 }); await frames(page, 14); }
    else console.log('no item mark', id);
  }
  console.log(await page.evaluate(() => [...window.__app.ui.ids.keys()].filter((k) => k.startsWith('wheel') || k === 'toolbox').join(' ')));
}
fs.mkdirSync('e2e/out/look', { recursive: true });
const out = `e2e/out/look/${arg}-${w}x${h}.png`;
await page.screenshot({ path: out });
console.log(out);
if (errors.length) console.log(errors.join('\n'));
await browser.close();
