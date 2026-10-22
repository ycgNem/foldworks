// HUD overlap audit (from Trotline's harness): the game's key states at three window sizes. For
// each shot the UI's audit (src/ui/audit.ts) lists texts that clash, overflow their panel or get
// painted over; shots with issues also get a <name>.issues.png with the problems boxed. Output:
// e2e/out/screens/ (report.md and PNGs). Needs the dev server. Usage: npm run screens
// (node e2e/screens.mjs <state> ... runs only those states.)
// `act2Setup` (exported for e2e/look.mjs) builds an Act II game through window.__app: research,
// land, coin, reputation, designs pushed into g.s.designs, and Factory-floor modules placed by
// commands, then puts the app in one of the ACT2 states.
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';
import { launch, openGame, frames, HOVER_WAIT } from './launch.mjs';

/** Runs in the page. state: orders2 | codex | survey | mega | megaDone | fgrade | faudit | factory2 | fbox | modules2 */
export async function act2Setup(state) {
  const a = window.__app;
  a.newGame(11);
  a.freeze();
  a.toasts = [];
  a.trophyPops = [];
  const g = a.game;
  const N = g.s.coin.constructor;
  g.s.coin = N.of(2.5e6);
  g.s.earned = N.of(9.8e6);
  g.s.land = ['A', 'B', 'C', 'D', 'E', 'F'];
  g.s.upgrades.push('bellows');
  const act1 = ['pressing', 'surveyEast', 'copperSmelting', 'wireDrawing', 'gearcutting', 'splitters', 'buffers', 'gizmoTheory', 'slagBricks', 'folding'];
  const act2 = ['coalSeams', 'steelmaking', 'overdrive', 'steamPower', 'surveying', 'glassworks', 'crushing', 'concrete', 'refining', 'machineKits', 'circuits', 'heavyMachines', 'tuning', 'motors', 'nestedFolds', 'greatDrill'];
  g.s.research.done = [...act1, ...act2];
  g.s.flags.push('factoryOpen', 'factorySeen', 'sliceEnd', 'ordersSeen');
  g.s.orders.done = ['boardwalk', 'lampPosts', 'gizmoFestival', 'calibration'];
  g.s.orders.rep = { bramble: 3, unit7: 1, voltaire: 0 };
  g.s.orders.active = 'lensArray';
  g.s.orders.progress = { lensArray: { glass: N.of(212), circuit: N.of(18) }, streetlamps: { circuit: N.of(40) } };
  g.s.parts = N.of(14);
  g.s.claimBlocks = { ironOre: 1 };
  g.s.codex = ['ironIngot', 'ironPlate', 'gear', 'gizmo', 'copperWire', 'coal', 'steel', 'glass'];
  const del = { ironOre: 900, ironIngot: 5200, copperIngot: 800, ironPlate: 12000, copperWire: 6400, gear: 2100, gizmo: 640, slagBrick: 300, coal: 1500, steel: 900, glass: 420, circuit: 22 };
  for (const [k, v] of Object.entries(del)) g.s.delivered[k] = N.of(v);
  g.s.income = Array(60).fill(140);
  const gr = (letter, score, mult) => ({ letter, score, u: Math.min(1, score + 0.05), w: 1, c: 0.8, mult });
  const D = (id, name, parts, ins, outs, grade, bill, stamped, spare, extra = {}) => ({ id, name, box: { x: 16, y: 1, w: 4, h: 3 }, parts, ins, outs, grade, bill, stamped, spare, ...extra });
  const P = (kind, dx, recipe = null) => ({ kind, dx, dy: 0, rot: 0, recipe });
  g.s.designs = [
    D(1, 'Iron plates x37/min', [P('miner', 0, 'mineIron'), P('smelter', 1), P('press', 2)], {}, { ironPlate: 0.62, slag: 0.12 }, gr('S', 0.93, 1.25), 250, 2, 2),
    D(2, 'Steel works', [P('miner', 0, 'mineCoal'), P('smelter', 1), P('smelter', 2), P('boiler', 3)], { ironIngot: 0.5 }, { steel: 0.5, slag: 0.25 }, gr('A', 0.84, 1.1), 1820, 1, 0),
    D(3, 'Glass x30/min', [P('miner', 0, 'mineSand'), P('miner', 1, 'mineSand'), P('kiln', 2), P('generator', 3), P('pole', 4)], {}, { glass: 0.5 }, gr('B', 0.7, 1), 1155, 0, 2),
    D(4, 'Circuits', [P('assembler', 0), P('press', 1)], { copperWire: 1.5, plastic: 0.5, glass: 0.5 }, { circuit: 0.2 }, gr('A', 0.82, 1.1), 4300, 0, 1),
    D(5, 'Gears x54/min II', [], {}, { gear: 0.9 }, gr('S', 0.95, 1.25), 2100, 0, 1, { depth: 2, box: { x: 2, y: 1, w: 4, h: 2 }, fparts: [{ kind: 'module', design: 1, dx: 0, dy: 0, rot: 0 }, { kind: 'module', design: 6, dx: 0, dy: 1, rot: 0 }, { kind: 'trunk', design: 0, dx: 1, dy: 0, rot: 0 }] }),
    D(6, 'Copper wire', [P('miner', 0, 'mineCopper'), P('smelter', 1), P('press', 2)], {}, { copperWire: 1, slag: 0.12 }, gr('C', 0.55, 0.9), 250, 1, 2),
    D(7, 'Gravel from slag', [P('press', 0), P('press', 1)], { slag: 0.5 }, { gravel: 0.25 }, gr('B', 0.68, 1), 300, 0, 1),
    D(8, 'Concrete x20/min', [P('miner', 0, 'mineSand'), P('press', 1), P('mixer', 2), P('generator', 3), P('pole', 4)], {}, { concrete: 0.33 }, gr('A', 0.86, 1.1), 1210, 0, 1),
    D(9, 'Gear cutter', [P('press', 0), P('press', 1)], { ironPlate: 0.6 }, { gear: 0.3 }, gr('A', 0.84, 1.1), 200, 0, 2),
    D(10, 'Gizmo works', [P('press', 0), P('assembler', 1), P('assembler', 2)], { ironIngot: 0.4, copperWire: 0.8 }, { gizmo: 0.4 }, gr('A', 0.88, 1.1), 1150, 0, 1),
    D(11, 'Iron ingots', [P('miner', 0, 'mineIron'), P('smelter', 1), P('heap', 2)], {}, { ironIngot: 0.5, slag: 0.12 }, gr('S', 0.92, 1.25), 125, 0, 1),
  ];
  g.s.nextDesign = 12;
  g.s.mega = { stage: 0, progress: { drillBit: N.of(14), concrete: N.of(620), steel: N.of(410) } };
  if (state === 'megaDone') g.s.mega = { stage: 1, progress: {} };
  a.renderer.ground = null;
  a.fitCamera(true);
  // the Factory floor (12x8: Dock at 10,1, Hopper at 10,5, the Bay's corner at 0,6)
  a.setFloor('factory', true);
  const act = (c) => { const r = a.act(c); if (!r.ok) throw new Error(JSON.stringify(c) + ' ' + r.why); };
  const row = (design, y, x1 = 9) => { act({ k: 'fplace', design, x: 2, y, rot: 0 }); for (let x = 3; x <= x1; x++) act({ k: 'ftrunk', x, y, rot: 0 }); };
  const festival = state === 'festival' || state === 'festivalFloor';
  if (festival) {
    // the slice's last stretch: Bramble's Gizmo Festival, only Factory Dock deliveries count
    g.s.research.done = act1.slice();
    g.s.land = ['A', 'B', 'C', 'D'];
    g.s.flags = g.s.flags.filter((f) => f !== 'sliceEnd');
    g.s.orders.done = ['boardwalk', 'lampPosts'];
    g.s.orders.rep = { bramble: 2, unit7: 0, voltaire: 0 };
    g.s.orders.active = 'gizmoFestival';
    g.s.orders.progress = { gizmoFestival: { gizmo: N.of(137) } };
    // their slag handled inside (a heap in the box), so the chain runs clean
    g.s.designs = g.s.designs.filter((d) => [6, 10, 11].includes(d.id)).map((d) => ({ ...d, outs: Object.fromEntries(Object.entries(d.outs).filter(([k]) => k !== 'slag')) }));
    g.s.coin = N.of(18400);
  }
  if (state === 'fgrade' || state === 'faudit') {
    // a nested fold needs a chain inside its box: plates feeding a gear cutter
    act({ k: 'fplace', design: 1, x: 2, y: 1, rot: 0 });
    act({ k: 'ftrunk', x: 3, y: 1, rot: 0 });
    act({ k: 'fplace', design: 9, x: 4, y: 1, rot: 0 });
    for (let x = 5; x <= 9; x++) act({ k: 'ftrunk', x, y: 1, rot: 0 });
    row(6, 2);
  } else if (festival) {
    // ingots -> the Gizmo works, wire joining from below, Gizmos into the Factory Dock
    act({ k: 'fplace', design: 11, x: 1, y: 1, rot: 0 });
    for (let x = 2; x <= 5; x++) act({ k: 'ftrunk', x, y: 1, rot: 0 });
    act({ k: 'fplace', design: 10, x: 6, y: 1, rot: 0 });
    for (let x = 7; x <= 9; x++) act({ k: 'ftrunk', x, y: 1, rot: 0 });
    act({ k: 'fplace', design: 6, x: 1, y: 2, rot: 0 });
    for (let x = 2; x <= 4; x++) act({ k: 'ftrunk', x, y: 2, rot: 0 });
    act({ k: 'ftrunk', x: 5, y: 2, rot: 3 });
  } else {
    row(1, 1);
    row(5, 2);
    // copper wire: its front joins row 2 at (9,2); its slag leaves by a side trunk into a gravel module
    row(6, 3, 8);
    act({ k: 'ftrunk', x: 9, y: 3, rot: 3 });
    act({ k: 'ftrunk', x: 2, y: 4, rot: 1 });
    act({ k: 'ftrunk', x: 2, y: 5, rot: 0 });
    act({ k: 'fplace', design: 7, x: 3, y: 5, rot: 0 });
    for (let x = 4; x <= 9; x++) act({ k: 'ftrunk', x, y: 5, rot: 0 });
    // concrete into the Megaproject Bay
    act({ k: 'fplace', design: 8, x: 4, y: 7, rot: 2 });
    act({ k: 'ftrunk', x: 3, y: 7, rot: 2 });
    act({ k: 'ftrunk', x: 2, y: 7, rot: 2 });
  }
  a.step(20 * 3);
  a.step(20 * 8);
  a.game.events.drain();
  a.panel = null;
  if (state === 'fgrade' || state === 'faudit') {
    act({ k: 'faudit', x: 2, y: 1, w: 3, h: 1 });
    a.step(state === 'fgrade' ? 20 * 71 : 20 * 34);
    if (state === 'faudit') a.game.events.drain();
  }
  // the slice-end card at rest: the payout counted up and landed, the Gizmos in, the tiles shown
  if (state === 'sliceEnd2') { g.s.flags = g.s.flags.filter((f) => f !== 'sliceEnd'); a.panel = 'sliceEnd'; a.gradeAt = a.ui.time - 2.6; a.hud.rain = []; g.s.earned = N.of(89100); g.s.tick = 20 * 1903; }
  if (state === 'orders2') {
    // the screen opens, then a fill lands: Unit 7 cheers and its tab opens
    a.panel = 'orders';
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    g.s.orders.done.push('lensArray');
    g.s.orders.active = 'streetlamps';
    g.s.orders.rep.unit7 = 2;
    g.s.orders.rep.voltaire = 1;
  }
  if (state === 'festival') a.panel = 'orders';
  if (state === 'research2') {
    g.s.research.done = g.s.research.done.filter((r) => !['circuits', 'heavyMachines', 'tuning', 'motors', 'nestedFolds', 'greatDrill', 'machineKits'].includes(r));
    g.s.research.selected = 'circuits';
    g.s.research.progress = { circuits: { copperWire: N.of(310), glass: N.of(44) } };
    a.hud.treePage = 2;
    a.panel = 'research';
  }
  if (state === 'factoryOD') {
    // Overdrive on the Factory floor: one trunk group running hot, another cooling down
    a.act({ k: 'fclick', x: 2, y: 3 });
    const cooling = g.s.factory.ents.find((e) => e.kind === 'module' && e.x === 2 && e.y === 1);
    if (cooling) { cooling.od = 0; cooling.cool = 20 * 18; }
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  }
  if (state === 'codex') a.panel = 'codex';
  if (state === 'survey') a.panel = 'survey';
  if (state === 'mega') a.panel = 'mega';
  if (state === 'megaDone') { a.panel = 'mega'; a.gradeAt = a.ui.time; a.hud.confetti = 0; }
  if (state === 'modules2') a.panel = 'modules';
  a.toasts = [];
  a.trophyPops = [];
  a.refusal = null;
  a.lookAt(6, 4);
  // the Workshop in Act II at the default camera, and Bramble's Town at its stages
  const TOWN = { townStart: [], townLamps: ['boardwalk', 'lampPosts'], townFestival: ['boardwalk', 'lampPosts', 'gizmoFestival'] };
  if (state in TOWN) {
    g.s.orders.done = TOWN[state];
    g.s.orders.rep = { bramble: TOWN[state].length, unit7: 0, voltaire: 0 };
    g.s.orders.active = null;
    if (state === 'townStart') { g.s.land = ['A', 'B', 'C', 'D']; g.s.flags = g.s.flags.filter((f) => f !== 'sliceEnd'); }
  }
  if (state === 'townAct2') {
    g.s.orders.done = ['boardwalk', 'lampPosts', 'gizmoFestival', 'calibration', 'streetlamps', 'lensArray', 'promenade'];
    g.s.orders.rep = { bramble: 3, unit7: 2, voltaire: 2 };
    g.s.orders.active = 'turbine';
  }
  if (state === 'act2ws' || state in TOWN || state === 'townAct2') {
    a.setFloor('workshop', true);
    a.renderer.ground = null;
    a.fitCamera(true);
    // the setup's sales sent coins flying from the Factory floor: let the shot start clean
    a.renderer.fx.flyers = [];
    a.renderer.fx.pops = [];
  }
  // hover Mayor Bramble's house: the town's one-line tooltip
  if (state === 'townAct2') return { hover: [3, -2] };
  // the nested-fold box is dragged with the real mouse (the caller holds the button down)
  if (state === 'fbox') { a.setMode({ k: 'fold' }); return { drag: [[2, 1], [4, 3]] }; }
  return null;
}

export const ACT2 = ['orders2', 'codex', 'survey', 'mega', 'megaDone', 'fgrade', 'faudit', 'factory2', 'fbox', 'modules2', 'sliceEnd2', 'festival', 'festivalFloor', 'research2', 'factoryOD', 'act2ws', 'townStart', 'townLamps', 'townFestival', 'townAct2'];

/** Runs in the page: the Workshop with fold audits. audits3: three audits, the iron line in
 * chunk C graded and two smelter/press lines in chunk D still measuring. gradeSplus: the iron
 * line's grade card, its grade pushed to S+ (the art and the card at the top grade). */
export async function workshopSetup(state) {
  const a = window.__app;
  a.newGame(5);
  a.freeze();
  a.grant(1e6);
  const g = a.game;
  g.s.land = ['A', 'B', 'C', 'D'];
  g.s.research.done = ['pressing', 'surveyEast', 'copperSmelting', 'wireDrawing', 'gearcutting', 'splitters', 'buffers', 'gizmoTheory', 'slagBricks', 'folding'];
  g.s.upgrades.push('bellows');
  g.s.flags.push('ordersSeen');
  g.s.ents = g.s.ents.filter((e) => e.kind === 'dock' || e.kind === 'hopper' || e.kind === 'furnace');
  g.rebuild();
  a.renderer.ground = null;
  const act = (c) => { const r = a.act(c); if (!r.ok) throw new Error(JSON.stringify(c) + ' ' + r.why); };
  act({ k: 'place', kind: 'miner', x: 2, y: 11, rot: 0 });
  act({ k: 'place', kind: 'smelter', x: 3, y: 11, rot: 0 });
  act({ k: 'place', kind: 'belt', x: 3, y: 12, rot: 1 });
  act({ k: 'place', kind: 'heap', x: 3, y: 13, rot: 1 });
  act({ k: 'place', kind: 'belt', x: 4, y: 11, rot: 0 });
  for (let y = 11; y > 2; y--) act({ k: 'place', kind: 'belt', x: 5, y, rot: 3 });
  act({ k: 'place', kind: 'belt', x: 5, y: 2, rot: 0 });
  if (state === 'audits3') {
    // two more lines in chunk D: a smelter into a press, out to a belt
    for (const y of [10, 13]) {
      act({ k: 'place', kind: 'smelter', x: 10, y, rot: 0 });
      act({ k: 'place', kind: 'press', x: 11, y, rot: 0 });
      act({ k: 'place', kind: 'belt', x: 12, y, rot: 0 });
    }
  }
  a.step(30 * 20);
  act({ k: 'audit', x: 2, y: 11, w: 2, h: 2 });
  if (state === 'audits3') {
    a.step(20 * 40);
    act({ k: 'audit', x: 10, y: 10, w: 2, h: 1 });
    a.step(20 * 18);
    act({ k: 'audit', x: 10, y: 13, w: 2, h: 1 });
    a.step(20 * 13);
    a.game.events.drain();
    a.panel = null;
    a.fitCamera(true);
  } else {
    a.step(20 * 71);
    a.game.events.drain();
    const au = g.s.audits[0];
    const r = au.result;
    r.grade = { ...r.grade, letter: 'S+', score: 0.98, u: 0.99, w: 1, c: 0.95, mult: 1.35 };
    r.advice = ['Flawless: every machine busy, waste handled, nothing wasted on space.'];
    a.gradeId = au.id;
    a.panel = 'grade';
    // the stamp has landed: the card at rest, its burst and confetti under way
    a.gradeAt = a.ui.time - 0.5;
    a.hud.stamped = false;
    a.nameDraft = null;
  }
  a.toasts = [];
  a.trophyPops = [];
  a.refusal = null;
  return null;
}

export const WORKSHOP = ['audits3', 'gradeSplus'];

/** Milestone 6 states (run in the page): a small factory that jams (the starting furnace and a
 * Miner, two copper lines with heaps in chunk B), then a real offline run of 9 h 25 m (report),
 * an offline run under way (running), or the overnight forecast done with one line stopped. */
export async function idleSetup(kind) {
  {
    const a = window.__app;
    a.newGame(7);
    a.freeze();
    a.toasts = [];
    const g = a.game;
    a.grant(1e6);
    g.s.land = ['A', 'B'];
    g.s.research.done = ['pressing', 'surveyEast', 'copperSmelting', 'wireDrawing', 'buffers', 'steamPower', 'circuits'];
    g.s.upgrades.push('bellows');
    const act = (c) => { const r = a.act(c); if (!r.ok) throw new Error(JSON.stringify(c) + ' ' + r.why); };
    act({ k: 'place', kind: 'miner', x: 2, y: 3, rot: 0 });
    // two copper lines: miner -> smelter -> belt to the Dock's east side, slag into a heap
    for (const y of [2, 3]) {
      act({ k: 'place', kind: 'miner', x: 12, y, rot: 0 });
      act({ k: 'place', kind: 'smelter', x: 13, y, rot: 0 });
      act({ k: 'place', kind: 'heap', x: 13, y: y === 2 ? 1 : 4, rot: 0 });
    }
    for (const y of [2, 3]) for (let x = 14; x < 16; x++) act({ k: 'place', kind: 'crate', x, y, rot: 0 });
    a.step(20 * 30);
    const off = await import('/src/sim/offline.ts');
    if (kind === 'report') {
      a.offline = off.runOffline(g, 9 * 3600 + 25 * 60);
      a.panel = 'offline';
    } else if (kind === 'running') {
      a.startOffline(8 * 3600);
      a.offlineJob.step(30000);
    } else {
      const m = await import('/src/app/overnight.ts');
      m.startForecast(a, 8);
      const st = m.overnightState();
      while (!st.job.step(5000)) { /* run it out */ }
      st.result = st.job.report;
      st.job = null;
      act({ k: 'pause', x: 12, y: 3, line: true, on: true });
      // a stop re-runs the forecast (the screen does it on its next frame): run that one out too
      m.startForecast(a, 8);
      while (!st.job.step(5000)) { /* run it out */ }
      st.result = st.job.report;
      st.job = null;
      a.panel = 'overnight';
    }
    // the trophies the setup earned slide in over everything: not part of these screens
    g.events.drain();
    a.trophyPops = [];
    a.toasts = [];
  }
}

/** Hold the mouse down from one tile to another (a drag left unfinished for the screenshot). */
export async function dragTiles(page, [[x0, y0], [x1, y1]]) {
  const p0 = await page.evaluate(([x, y]) => window.__app.tileToCss(x, y), [x0, y0]);
  const p1 = await page.evaluate(([x, y]) => window.__app.tileToCss(x, y), [x1, y1]);
  await page.mouse.move(p0.x, p0.y);
  await frames(page, 2);
  await page.mouse.down();
  await frames(page, 2);
  await page.mouse.move(p1.x, p1.y, { steps: 4 });
}

/** Runs in the page (Milestone 5; the Milestone 5-6 review round): the Reorganize card (new, better
 * and on-file lines), the Patent Office, the Patent Drawer with a kept design selected, the Factory
 * annex, the Committee's tab and the Great Drill's stage 2 waiting on the Committee. */
export async function m5Setup(state) {
  const a = window.__app;
  a.newGame(13);
  a.freeze();
  const g = a.game;
  const N = g.s.coin.constructor;
  g.s.coin = N.of(312000);
  g.s.earned = N.of(1.62e6);
  g.s.land = ['A', 'B', 'C', 'D', 'E'];
  g.s.upgrades.push('bellows');
  g.s.research.done = ['pressing', 'surveyEast', 'copperSmelting', 'wireDrawing', 'gearcutting', 'splitters', 'buffers', 'gizmoTheory', 'slagBricks', 'folding', 'coalSeams', 'steelmaking', 'steamPower', 'refining', 'greatDrill'];
  g.s.flags.push('factoryOpen', 'factorySeen', 'sliceEnd', 'ordersSeen');
  const gr = (letter, mult) => ({ letter, score: 0.8, u: 0.85, w: 1, c: 0.8, mult });
  const P = (kind, dx, dy, rot = 0, recipe = null) => ({ kind, dx, dy, rot, recipe });
  const D = (id, name, outs, grade, ins = {}, parts = []) => ({ id, name, box: { x: 16, y: 1, w: 4, h: 3 }, parts, ins, outs, grade, bill: 300, stamped: 0, spare: 1 });
  g.s.designs = [
    D(1, 'Iron plates', { ironPlate: 0.6 }, gr('S', 1.25), {}, [P('miner', 0, 0), P('smelter', 1, 0, 0, 'smeltIron'), P('press', 2, 0, 0, 'pressPlate'), P('belt', 3, 0)]),
    D(2, 'Gizmo works', { gizmo: 0.3 }, gr('A', 1.1), { ironIngot: 0.6, copperWire: 0.6 }),
    D(3, 'Copper wire', { copperWire: 1 }, gr('B', 1)), D(4, 'Steel', { steel: 0.4 }, gr('A', 1.1)), D(5, 'Gears', { gear: 0.5 }, gr('C', 0.9)),
  ];
  g.s.nextDesign = 6;
  g.s.megaPatents = 2.4;
  g.s.mega = { stage: 1, progress: { drillBit: N.of(40), steel: N.of(210) } };
  g.s.orders.rep.committee = 2;
  const m = g.s.meta;
  m.history = [{ run: 1, ticks: 20 * 3600 * 4.2, patents: 15, earned: N.of(2.1e6), peakPerMin: 13300 }];
  m.runs = 1;
  m.patents = N.of(9);
  m.patentsEarned = N.of(15);
  m.nodes = ['bellows', 'starterLine', 'notebooks', 'surveyCharter', 'shovelFrog', 'overdriveHabit'];
  // the record on file: Gizmos as now (on file), wire below this run's (better), plates new
  m.patented = { gizmo: { value: 2.2, steps: 2, grade: 'A', tier: 0, run: 1 }, copperWire: { value: 1.6, steps: 2, grade: 'D', tier: 0, run: 1 }, steel: { value: 2.2, steps: 2, grade: 'A', tier: 0, run: 1 } };
  m.drawer = [
    { id: 1, name: 'Iron plate line', x: 2, y: 11, w: 5, h: 3, parts: [P('miner', 0, 0), P('smelter', 1, 0, 0, 'smeltIron'), P('press', 2, 0, 0, 'pressPlate'), P('belt', 3, 0), P('belt', 4, 0), P('belt', 1, 1, 1), P('heap', 1, 2)], product: 'ironPlate', grade: 'S', rate: 0.6, run: 1 },
    { id: 2, name: 'Gizmo works with a very long name indeed', x: 4, y: 3, w: 7, h: 4, parts: [P('assembler', 0, 0, 0, 'gizmo'), P('assembler', 0, 2, 0, 'gizmo'), ...[1, 2, 3, 4, 5, 6].map((x) => P('belt', x, 1))], product: 'gizmo', grade: 'A', rate: 0.3, run: 1 },
    { id: 3, name: 'Wire', x: 12, y: 0, w: 4, h: 1, parts: [P('miner', 0, 0), P('smelter', 1, 0, 0, 'smeltCopper'), P('press', 2, 0, 0, 'drawWire'), P('belt', 3, 0)], product: 'copperWire', grade: 'B', rate: 1, run: 1 },
  ];
  m.nextKept = 4;
  m.queue = [3];
  a.renderer.ground = null;
  a.setFloor('workshop', true);
  a.fitCamera(true);
  a.toasts = [];
  a.trophyPops = [];
  if (state === 'reorg') a.panel = 'reorganize';
  if (state === 'patents') a.panel = 'patents';
  // a node you can buy, hovered: its numbers, what it changes this run, its price
  if (state === 'patentsHover') { a.panel = 'patents'; return { hoverId: 'patent_quickAudit' }; }
  if (state === 'drawer') {
    a.panel = 'drawer';
    (await import('/src/app/drawer.ts')).selectDrawer({ k: 'kept', id: 1 });
  }
  if (state === 'annex') {
    // two annex blocks bought, a Gizmo chain in the first, the third block for sale beyond the wall
    g.s.annex = 2;
    g.rebuildFactory();
    for (const [x, y, rot] of [[13, 1, 2], [12, 0, 2], [11, 0, 1], [12, 2, 2]]) g.act({ k: 'ftrunk', x, y, rot });
    for (const [d, x, y, rot] of [[2, 12, 1, 2], [3, 13, 0, 1], [1, 13, 2, 3]]) g.act({ k: 'fplace', design: d, x, y, rot });
    a.setFloor('factory', true);
    a.fitCamera(true);
  }
  if (state === 'committee') {
    a.panel = 'orders';
    (await import('/src/app/orders.ts')).cheerFor(a, 'committee', 0);
  }
  // stage 1 stands; stage 2 waits on the Committee's reputation 3 (now 2: The Pile and the Brick
  // Throne filled, Shiny Things under way). A shut stage counts nothing, so its progress is empty
  // (the final round: the old state showed stage 2 bars part-filled, which the game cannot make),
  // and the Bay stands in its corner, as it does once Great Drill is researched
  if (state === 'mega2') {
    g.s.mega = { stage: 1, progress: {} };
    g.s.orders.done = ['thePile', 'brickThrone'];
    g.s.orders.active = 'shinyThings';
    g.s.orders.progress = { shinyThings: { copperWire: N.of(830), ironIngot: N.of(240) } };
    a.step(2);
    g.events.drain();
    a.toasts = [];
    a.trophyPops = [];
    a.panel = 'mega';
    a.gradeAt = a.ui.time - 30;
  }
  return null;
}

export const M5 = ['reorg', 'patents', 'patentsHover', 'drawer', 'annex', 'committee', 'mega2'];

/** Runs in the page (Milestone 7, DESIGN.md §21): an Act III game on the District. 23 groups
 * (depth-2 designs pushed into g.s.designs) placed and joined by 20-odd skiff routes into the
 * District Dock, the Hopper and the Floating City's Bay, some of them short of skiffs (the far
 * Lift Rotor route and the Sensor route), run for half a minute so the routes carry. States:
 * district (the floor at rest), districtRoute (a short route's card open), districtHover (a
 * starved group hovered), districtPick (the Route tool's item list), districtBox (a fold box
 * dragged with the real mouse), districtAudit (an audit under way, its clipboard), districtGrade
 * (the District fold's grade card), districtOpen (the floor just opened, empty, a group in hand),
 * districtPerf (the dense floor alone, for e2e/perf.mjs). */
export async function districtSetup(state) {
  const a = window.__app;
  a.newGame(21);
  a.freeze();
  a.toasts = [];
  a.trophyPops = [];
  const g = a.game;
  const N = g.s.coin.constructor;
  g.s.coin = N.of(4.8e7);
  g.s.earned = N.of(3.1e8);
  g.s.land = ['A', 'B', 'C', 'D', 'E', 'F'];
  g.s.upgrades.push('bellows');
  const act1 = ['pressing', 'surveyEast', 'copperSmelting', 'wireDrawing', 'gearcutting', 'splitters', 'buffers', 'gizmoTheory', 'slagBricks', 'folding'];
  const act2 = ['coalSeams', 'steelmaking', 'overdrive', 'steamPower', 'surveying', 'glassworks', 'crushing', 'concrete', 'refining', 'machineKits', 'circuits', 'heavyMachines', 'tuning', 'motors', 'nestedFolds', 'greatDrill'];
  const act3 = ['zoning', 'chutes', 'chemistry', 'bearings', 'vulcanizing', 'batteries', 'servos', 'sensors', 'processors', 'recycling', 'hydroponics', 'sandwiches', 'robotics', 'floatingCity', 'districtFolds'];
  g.s.research.done = [...act1, ...act2, ...(state === 'districtOpen' ? ['zoning'] : act3)];
  g.s.research.selected = state === 'districtOpen' ? null : 'scrapTransmuter';
  g.s.mega = { stage: 3, progress: {} };
  g.s.flags.push('factoryOpen', 'factorySeen', 'sliceEnd', 'ordersSeen');
  g.s.orders.done = ['boardwalk', 'lampPosts', 'gizmoFestival', 'calibration', 'streetlamps', 'lensArray'];
  g.s.orders.rep = { bramble: 3, unit7: 2, voltaire: 2, committee: 5 };
  g.s.income = Array(60).fill(52000);
  g.s.ents = g.s.ents.filter((e) => e.kind === 'dock' || e.kind === 'hopper' || e.kind === 'furnace');
  g.rebuild();
  // Act II's spine stands (so the goal speaks of the District): power lit, a Mk2, its products sold
  for (const [k, v] of Object.entries({ steel: 9000, glass: 4000, circuit: 900, motor: 400, concrete: 3000 })) g.s.delivered[k] = N.of(v);
  for (const c of [{ k: 'place', kind: 'boiler', x: 16, y: 4, rot: 0 }, { k: 'place', kind: 'steamEngine', x: 17, y: 4, rot: 0 }, { k: 'place', kind: 'pole', x: 18, y: 3, rot: 0 }, { k: 'place', kind: 'kiln', x: 19, y: 1, rot: 3 }, { k: 'place', kind: 'smelterMk2', x: 20, y: 6, rot: 0 }]) a.act(c);
  a.act({ k: 'recipe', x: 19, y: 1, recipe: 'fireGlass' });
  const boiler = g.entAt(16, 4), kiln = g.entAt(19, 1);
  if (boiler) boiler.inBuf.coal = 4000;
  if (kiln) kiln.inBuf.sand = 400;
  const gr = (letter, mult) => ({ letter, score: 0.8, u: 0.9, w: 1, c: 0.8, mult });
  let nid = 1;
  const D = (name, ins, outs, letter = 'A', mult = 1.1) => ({ id: nid++, name, box: { x: 2, y: 1, w: 4, h: 3 }, parts: [], ins, outs, grade: gr(letter, mult), bill: 40000, stamped: 0, spare: 6, depth: 2, fparts: [] });
  const T = {
    steel: D('Steel works II', {}, { steel: 2.0 }, 'S', 1.25),
    bearing: D('Bearings II', { steel: 0.8 }, { bearing: 1.6 }),
    gear: D('Gear cutters II', {}, { gear: 1.4 }, 'S', 1.25),
    gearbox: D('Gearboxes II', { gear: 0.5, bearing: 0.5, steel: 0.25 }, { gearbox: 0.25 }),
    motor: D('Motors II', {}, { motor: 0.4 }, 'B', 1),
    rotor: D('Lift Rotors II', { motor: 0.2, gearbox: 0.2, steel: 0.4 }, { liftRotor: 0.1 }),
    concrete: D('Concrete II', {}, { concrete: 1.2 }, 'A', 1.1),
    glass: D('Glass II', {}, { glass: 1.5 }, 'S', 1.25),
    circuit: D('Circuits II', { glass: 0.6 }, { circuit: 0.4 }),
    plastic: D('Plastic and oil II', {}, { plastic: 1.0, oil: 0.3 }, 'B', 1),
    rubber: D('Rubber II', { plastic: 0.5 }, { rubber: 0.8 }, 'C', 0.9),
    sensor: D('Sensors II', { glass: 0.4, circuit: 0.2, rubber: 0.2 }, { sensor: 0.1 }),
  };
  // a District fold (depth 3) with spares: the tool strip lists it after the groups, marked III
  const deep = D('Gearbox works III', {}, { gearbox: 0.6 }, 'A', 1.1);
  deep.depth = 3;
  deep.spare = 2;
  g.s.designs = [...Object.values(T), deep];
  g.s.nextDesign = nid;
  // the Factory floor has its groups too (they are what goes up)
  a.act({ k: 'fplace', design: T.steel.id, x: 2, y: 1, rot: 0 });
  a.act({ k: 'fplace', design: T.glass.id, x: 2, y: 3, rot: 0 });
  if (state === 'districtOpen') {
    a.step(2);
    g.events.drain();
    a.setFloor('district', true);
    a.fitCamera(true);
    a.toasts = [];
    a.hud.celebs = [];
    const DS = a.districtUI;
    DS.game = g;
    DS.route = null; DS.pick = null; DS.from = null; DS.sel = null; DS.hoverRoute = null; DS.page = 0;
    a.pickModule(T.gearbox.id);
    return { hover: [5, 4] };
  }
  a.step(2); // Zoning done: the District opens; the Floating City's research brings the Bay
  a.step(20);
  const act = (c) => { const r = a.act(c); if (!r.ok) throw new Error(JSON.stringify(c) + ' ' + r.why); };
  const put = (d, x, y) => act({ k: 'hplace', floor: 'district', design: d.id, x, y });
  const fly = (fx, fy, tx, ty, item, skiffs = 1) => {
    act({ k: 'route', floor: 'district', fx, fy, tx, ty, item });
    const st = g.s.district;
    const r = st.routes[st.routes.length - 1];
    for (let i = 1; i < skiffs; i++) act({ k: 'skiff', floor: 'district', id: r.id, n: 1 });
  };
  // the north: steel, bearings, gears into gearboxes; motors; lift rotors to the Bay, far off
  put(T.steel, 1, 1); put(T.bearing, 2, 1); put(T.gear, 3, 2); put(T.steel, 1, 3); put(T.gearbox, 4, 1);
  put(T.motor, 5, 3); put(T.rotor, 6, 2);
  fly(1, 1, 2, 1, 'steel'); fly(2, 1, 4, 1, 'bearing'); fly(3, 2, 4, 1, 'gear'); fly(1, 3, 4, 1, 'steel');
  fly(4, 1, 6, 2, 'gearbox'); fly(5, 3, 6, 2, 'motor'); fly(1, 3, 6, 2, 'steel');
  fly(6, 2, 0, 8, 'liftRotor'); // across the floor: one skiff is short (the warning colour)
  // concrete beside the Bay
  put(T.concrete, 2, 8); put(T.concrete, 2, 9);
  fly(2, 8, 0, 8, 'concrete'); fly(2, 9, 0, 8, 'concrete');
  // the south: glass into circuits, plastic into rubber, all three into sensors, sensors to the Hopper
  put(T.glass, 5, 7); put(T.glass, 6, 8); put(T.circuit, 6, 7); put(T.plastic, 4, 6); put(T.rubber, 5, 6); put(T.sensor, 7, 6);
  fly(5, 7, 6, 7, 'glass'); fly(6, 8, 7, 6, 'glass'); fly(6, 7, 7, 6, 'circuit'); fly(4, 6, 5, 6, 'plastic'); fly(5, 6, 7, 6, 'rubber');
  fly(4, 6, 10, 1, 'oil'); // the plastic's oil, sold at the Dock (a byproduct with no route blocks it)
  fly(7, 6, 10, 5, 'sensor');
  // sellers beside the Dock and Hopper
  put(T.steel, 9, 1); put(T.bearing, 9, 2); put(T.gear, 8, 3); put(T.glass, 9, 4); put(T.circuit, 9, 6); put(T.glass, 8, 7);
  fly(9, 1, 10, 1, 'steel', 2); fly(9, 2, 10, 2, 'bearing'); fly(8, 3, 10, 2, 'gear'); fly(9, 4, 10, 5, 'glass'); fly(8, 7, 9, 6, 'glass'); fly(9, 6, 10, 6, 'circuit');
  // gears from across the floor to the Dock on one skiff: short of skiffs (the bottleneck, orange)
  fly(3, 2, 10, 1, 'gear');
  // a group joined to nothing (it backs up: the red pip)
  put(T.motor, 3, 4);
  if (state === 'districtPerf') {
    // fill the rest of the floor with sellers into the Dock and Hopper (the dense case)
    for (let y = 0; y < 10; y++) for (let x = 0; x < 10; x++) {
      if (g.s.district.ents.some((e) => x >= e.x && x < e.x + e.w && y >= e.y && y < e.y + e.h)) continue;
      const d = (x + y) % 2 ? T.glass : T.steel;
      if (d.spare < 1) d.spare = 6;
      put(d, x, y);
      fly(x, y, y < 5 ? 10 : 10, y < 5 ? 1 : 5, (x + y) % 2 ? 'glass' : 'steel');
    }
  }
  a.step(20 * 30);
  // the Workshop's kiln keeps the grid lit (its glass has nowhere to go in this setup: emptied)
  const kl = g.entAt(19, 1);
  if (kl) { kl.out = 0; kl.inBuf.sand = 400; }
  a.step(3);
  g.events.drain();
  a.toasts = [];
  a.trophyPops = [];
  a.refusal = null;
  // the setup's own firsts (the District opening, Codex entries) are not part of these screens
  a.hud.celebs = [];
  a.hud.rain = [];
  a.setFloor('district', true);
  a.fitCamera(true);
  a.renderer.fx.flyers = [];
  a.renderer.fx.pops = [];
  const DS = a.districtUI;
  // the District's UI state belongs to this game (else its first frame lets it go)
  DS.game = g;
  DS.route = null; DS.pick = null; DS.from = null; DS.sel = null; DS.hoverRoute = null; DS.page = 0;
  const find = (fx, fy, item) => { const st = g.s.district; const from = st.ents.find((e) => e.x === fx && e.y === fy); return st.routes.filter((r) => r.from === from.id && r.item === item).pop(); };
  if (state === 'districtRoute') DS.route = find(3, 2, 'gear').id;
  // the group joined to nothing: blocked, and its tag says no route takes its motors
  if (state === 'districtHover') return { hover: [3, 4] };
  // a starved group pinned: what it needs of each input against what its routes bring, and why
  if (state === 'districtStarved') {
    const m = g.s.district.ents.find((e) => e.kind === 'module' && e.state === 'starved' && e.x === 7 && e.y === 6) ?? g.s.district.ents.find((e) => e.kind === 'module' && e.state === 'starved');
    if (m) DS.sel = m.id;
  }
  if (state === 'districtPick') {
    a.setMode({ k: 'route' });
    DS.pick = { fx: 4, fy: 6, tx: 10, ty: 1, items: ['plastic', 'oil'] };
    DS.from = { x: 4, y: 6 };
  }
  if (state === 'districtBox') { a.setMode({ k: 'fold' }); return { drag: [[4, 6], [7, 8]] }; }
  if (state === 'districtAudit' || state === 'districtGrade') {
    act({ k: 'haudit', floor: 'district', x: 4, y: 6, w: 4, h: 3 });
    a.step(state === 'districtGrade' ? 20 * 72 : 20 * 40);
    // keep the Workshop's grid lit through the wait (the setup's kiln has nowhere to send glass)
    const k2 = g.entAt(19, 1);
    if (k2) { k2.out = 0; k2.inBuf.sand = 400; }
    if (boiler) boiler.inBuf.coal = 400;
    a.step(3);
    g.events.drain();
    a.toasts = [];
    a.hud.celebs = [];
    a.renderer.fx.flyers = [];
    a.renderer.fx.pops = [];
    a.renderer.fx.parts = [];
    if (state === 'districtGrade') { a.panel = 'fgrade'; a.gradeAt = a.ui.time - 1; a.hud.stamped = true; a.nameDraft = null; a.hud.confetti = 0; }
  }
  return null;
}

export const DISTRICT = ['district', 'districtRoute', 'districtHover', 'districtStarved', 'districtPick', 'districtBox', 'districtAudit', 'districtGrade', 'districtOpen'];

// ---------------------------------------------------------------- Act III (Milestone 7: the player-facing pieces)
/** Runs in the page (Act III's pieces on the Workshop, the Factory and the pages, DESIGN.md §21):
 * act3ws (a Chem Vat, a Greenhouse and three Chute Mouths: pushing, pushing, empty), act3mouth (a
 * Chute Mouth's pinned report with its item picker), act3factory (the Factory Chute fed by two
 * modules, its steel full: the red pip), act3chuteHover (its hover tag), research3 (Act III's tree
 * page waiting on the Great Drill's stage 3), research3open (the page open, a node under way),
 * megaCity (the Floating City, stage 1 built and stage 2 under way), megaTransmuter, orders3 and
 * codex3 (Act III's orders and tier 3 specimens), act3modes (a Chem Vat's pinned report with the six
 * modes). */
export async function act3Setup(state) {
  const a = window.__app;
  // the game's own instance of a module: after a hot update Vite serves it as path?t=..., and a
  // bare import would load a second copy whose state the game never reads
  const mod = async (p) => { for (const c of ['/src/app/hud.ts', '/src/app/screens.ts', '/src/app/app.ts']) { const m = (await (await fetch(c)).text()).match(new RegExp(`["'](${p.replace(/\./g, '\\.')}\\?[^"']*)["']`)); if (m) return import(m[1]); } return import(p); };
  a.newGame(21);
  a.freeze();
  const g = a.game;
  const N = g.s.coin.constructor;
  g.s.coin = N.of(8.2e6);
  g.s.earned = N.of(4.1e7);
  g.s.land = ['A', 'B', 'C', 'D', 'E', 'F'];
  g.s.upgrades.push('bellows');
  const { RESEARCH_LIST } = await import('/src/data/research.ts');
  const early = RESEARCH_LIST.filter((d) => (d.act ?? 1) < 3).map((d) => d.id);
  const act3 = ['zoning', 'chutes', 'chemistry', 'bearings', 'vulcanizing', 'batteries', 'processors', 'hydroponics', 'recycling'];
  g.s.research.done = [...early, ...act3];
  g.s.flags.push('factoryOpen', 'factorySeen', 'sliceEnd', 'ordersSeen');
  g.s.mega = { stage: 3, progress: {} };
  g.s.meta.runs = 3;
  g.s.orders.done = ['boardwalk', 'lampPosts', 'gizmoFestival', 'calibration', 'lensArray', 'streetlamps', 'promenade', 'turbine', 'thePile', 'brickThrone', 'shinyThings'];
  g.s.orders.rep = { bramble: 4, unit7: 3, voltaire: 2, committee: 5 };
  g.s.orders.active = null;
  g.s.income = Array(60).fill(52000);
  const gr = (letter, mult) => ({ letter, score: 0.86, u: 0.9, w: 1, c: 0.82, mult });
  const D = (id, name, ins, outs, grade) => ({ id, name, box: { x: 16, y: 1, w: 4, h: 3 }, parts: [], ins, outs, grade, bill: 4000, stamped: 0, spare: 3 });
  g.s.designs = [
    D(1, 'Steel x30/min', {}, { steel: 0.5 }, gr('A', 1.1)),
    D(2, 'Motors', {}, { motor: 0.08 }, gr('S', 1.25)),
    D(3, 'Plastic', {}, { plastic: 0.3 }, gr('B', 1)),
    D(4, 'Circuits', {}, { circuit: 0.2 }, gr('A', 1.1)),
  ];
  g.s.nextDesign = 5;
  a.renderer.ground = null;
  g.rebuild();
  const act = (c) => { const r = a.act(c); if (!r.ok) throw new Error(JSON.stringify(c) + ' ' + r.why); };
  // the Factory: steel and motors trunked into the Chute, plastic to the Dock
  a.setFloor('factory', true);
  act({ k: 'fplace', design: 1, x: 2, y: 1, rot: 0 });
  for (let x = 3; x <= 5; x++) act({ k: 'ftrunk', x, y: 1, rot: 0 });
  act({ k: 'fchute', x: 6, y: 1 });
  act({ k: 'fplace', design: 2, x: 2, y: 3, rot: 0 });
  for (let x = 3; x <= 5; x++) act({ k: 'ftrunk', x, y: 3, rot: 0 });
  act({ k: 'ftrunk', x: 6, y: 3, rot: 3 });
  act({ k: 'ftrunk', x: 6, y: 2, rot: 3 });
  act({ k: 'fplace', design: 3, x: 2, y: 5, rot: 0 });
  for (let x = 3; x <= 9; x++) act({ k: 'ftrunk', x, y: 5, rot: 0 });
  // the Workshop: a boiler and engine, two Poles, a Chem Vat making solvent, a Greenhouse, and
  // three Chute Mouths (motors, steel, rubber: the last with nothing in the Chute)
  a.setFloor('workshop', true);
  act({ k: 'place', kind: 'boiler', x: 16, y: 4, rot: 0 });
  act({ k: 'place', kind: 'steamEngine', x: 17, y: 4, rot: 0 });
  act({ k: 'place', kind: 'pole', x: 18, y: 3, rot: 0 });
  act({ k: 'place', kind: 'pole', x: 22, y: 3, rot: 0 });
  act({ k: 'place', kind: 'chemVat', x: 19, y: 1, rot: 3 });
  act({ k: 'recipe', x: 19, y: 1, recipe: 'mixSolvent' });
  act({ k: 'place', kind: 'heap', x: 20, y: 1, rot: 0 });
  act({ k: 'place', kind: 'greenhouse', x: 21, y: 1, rot: 3 });
  act({ k: 'recipe', x: 21, y: 1, recipe: 'growProduce' });
  act({ k: 'place', kind: 'kiln', x: 19, y: 4, rot: 0 });
  act({ k: 'recipe', x: 19, y: 4, recipe: 'fireGlass' });
  for (const [y, it] of [[7, 'motor'], [8, 'steel'], [9, 'rubber']]) {
    act({ k: 'place', kind: 'chuteMouth', x: 15, y, rot: 0 });
    act({ k: 'recipe', x: 15, y, recipe: it });
    for (let x = 16; x <= 19; x++) act({ k: 'place', kind: 'belt', x, y, rot: 0 });
  }
  const feed = () => {
    g.entAt(16, 4).inBuf.coal = 8;
    Object.assign(g.entAt(19, 1).inBuf, { oil: 8, sand: 4 });
    Object.assign(g.entAt(21, 1).inBuf, { fertilizer: 4 });
    Object.assign(g.entAt(19, 4).inBuf, { sand: 4 });
  };
  feed();
  a.step(20 * 6);
  feed();
  g.s.chute = { ...(g.s.chute ?? {}), motor: 7.4, steel: 20 };
  a.step(12);
  if (state === 'act3modes') g.entAt(19, 1).mode = 'recycling';
  g.events.drain();
  // the setup's own firsts (the District opening, Codex entries) are not part of these screens
  a.hud.celebs = [];
  a.hud.rain = [];
  a.toasts = [];
  a.trophyPops = [];
  a.refusal = null;
  a.panel = null;
  a.renderer.fx.flyers = [];
  a.renderer.fx.pops = [];
  a.fitCamera(true);
  a.lookAt(18, 5);
  if (state === 'act3mouth') a.selected = g.entAt(15, 7).id;
  if (state === 'act3modes') a.selected = g.entAt(19, 1).id;
  if (state === 'act3hoverMouth') return { hover: [15, 9] };
  if (state === 'act3factory' || state === 'act3chuteHover') {
    g.s.chute.steel = 20; // full: the red pip
    a.setFloor('factory', true);
    a.fitCamera(true);
    if (state === 'act3chuteHover') return { hover: [6, 1] };
  }
  if (state === 'act3wheel') { a.openWheelAt(); return { hoverIds: ['wheel_heavy', 'wheel_item_chemVat'] }; }
  if (state === 'act3wheelF') { a.setFloor('factory', true); a.fitCamera(true); a.openWheelAt(); return { hoverIds: ['wheel_trunk', 'wheel_item_fchute'] }; }
  if (state === 'research3' || state === 'research3open') {
    // research3open opens the page on its own: the tree opens on the newest act under way (Act III)
    if (state === 'research3') (await mod('/src/app/screens.ts')).setTreePage(a, 3);
    else {
      // the last page looked at was Act II's, and the tree is shut for a frame or two first
      a.hud.treePage = 2;
      a.panel = null;
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    }
    if (state === 'research3') {
      g.s.mega = { stage: 2, progress: {} };
      g.s.research.done = early;
    } else {
      g.s.research.selected = 'sensors';
      g.s.research.progress = { sensors: { rubber: N.of(212), circuit: N.of(530) } };
    }
    a.panel = 'research';
  }
  if (state === 'megaCity' || state === 'megaTransmuter') {
    g.s.research.done.push('servos', 'floatingCity', 'scrapTransmuter');
    g.s.megas = {
      city: { stage: 1, progress: { liftRotor: N.of(86), sandwich: N.of(410), glass: N.of(2650) } },
      transmuter: { stage: 0, progress: { transmuterCoil: N.of(12), steel: N.of(5200) } },
    };
    (await mod('/src/app/act2screens.ts')).setMegaTab(state === 'megaCity' ? 'city' : 'transmuter');
    a.panel = 'mega';
    a.gradeAt = a.ui.time - 30;
  }
  if (state === 'orders3') {
    g.s.research.done.push('servos', 'sensors', 'robotics', 'sandwiches');
    g.s.orders.active = 'specimens';
    g.s.orders.progress = { specimens: { rubber: N.of(10), battery: N.of(4), bearing: N.of(10), gearbox: N.of(2), sensor: N.of(7) } };
    a.panel = 'orders';
    (await mod('/src/app/orders.ts')).cheerFor(a, 'unit7', 0);
  }
  if (state === 'codex3') {
    g.s.codex = ['ironIngot', 'ironPlate', 'gear', 'gizmo', 'copperWire', 'coal', 'steel', 'glass', 'circuit', 'motor', 'plastic', 'concrete', 'solvent', 'rubber', 'battery', 'bearing', 'gearbox', 'sensor', 'processor', 'sandwich', 'clockworkFrog'];
    a.panel = 'codex';
  }
  return null;
}

export const ACT3 = ['act3ws', 'act3mouth', 'act3modes', 'act3hoverMouth', 'act3factory', 'act3chuteHover', 'act3wheel', 'act3wheelF', 'research3', 'research3open', 'megaCity', 'megaTransmuter', 'orders3', 'codex3'];

/** Act III's pages after a Reorganize (on m5Setup's run-2 game): the card offering Challenges (Hands
 * Off picked), a Challenge under way (its slip under the Purse), the Scenarios page with a record,
 * and a Scenario board in play (its slip). */
// (the game's own module instance, as act3Setup's mod: inlined, each runs in the page on its own)
export const ACT3_M5 = {
  reorgChallenges: { base: 'reorg', post: async () => { const mod = async (p) => { for (const c of ['/src/app/hud.ts', '/src/app/screens.ts', '/src/app/app.ts']) { const m = (await (await fetch(c)).text()).match(new RegExp(`["'](${p.replace(/\./g, '\\.')}\\?[^"']*)["']`)); if (m) return import(m[1]); } return import(p); }; (await mod('/src/app/reorganize.ts')).pickNextRun('handsOff'); } },
  challengeRun: { base: 'reorg', post: () => { const a = window.__app; a.game.s.challenge = 'noSplitters'; a.panel = null; } },
  scenarios: { base: 'reorg', post: () => { localStorage.setItem('foldworks_scenario_best', JSON.stringify({ tinyIsland: { score: 0.4166, grade: 'A', date: Date.UTC(2026, 9, 18), design: 'Gizmo works' } })); window.__app.panel = 'scenarios'; } },
  scenarioPlay: { base: 'scenarios', post: async () => { const a = window.__app; const mod = async (p) => { for (const c of ['/src/app/hud.ts', '/src/app/screens.ts', '/src/app/app.ts']) { const m = (await (await fetch(c)).text()).match(new RegExp(`["'](${p.replace(/\./g, '\\.')}\\?[^"']*)["']`)); if (m) return import(m[1]); } return import(p); }; (await mod('/src/app/scenarios.ts')).playScenario(a, 'tinyIsland', true); a.freeze(); a.toasts = []; a.panel = null; } },
};
// ---------------------------------------------------------------- (end of Act III's states)

const SIZES = [[1280, 720], [1920, 1080], [1024, 640]];
// each state: a function run in the page that puts the app there (frozen); it may return
// { hover: [x, y] } to put the mouse over that tile instead of the board's top edge
const STATES = {
  title: () => { const a = window.__app; a.screen = 'title'; },
  start: () => { const a = window.__app; a.newGame(7); a.freeze(); a.toasts = []; },
  // the first minute: one ore fed by hand, the goal now says to crank the furnace, the ore hovered
  // (its tooltip must leave the Hand Furnace beside it in view: the Milestone 5-6 final round)
  firstClicks: () => { const a = window.__app; a.newGame(7); a.freeze(); a.toasts = []; a.act({ k: 'click', x: 2, y: 3 }); a.refusal = null; a.renderer.fx.pops = []; return { hover: [2, 3] }; },
  build: () => { const a = window.__app; a.setMode({ k: 'build', kind: 'miner' }); return { hover: [2, 3] }; },
  report: () => {
    const a = window.__app; a.setMode({ k: 'idle' });
    const f = a.game.machines.find((m) => m.kind === 'furnace'); a.selected = f.id;
  },
  hoverReport: () => { const a = window.__app; a.selected = null; a.setMode({ k: 'idle' }); return { hover: [3, 3] }; },
  research: () => {
    const a = window.__app; const g = a.game;
    g.s.research.done = ['pressing', 'surveyEast', 'gearcutting']; g.s.research.selected = 'copperSmelting';
    a.panel = 'research';
  },
  orders: () => { const a = window.__app; a.panel = 'orders'; a.game.s.orders.active = 'boardwalk'; },
  options: () => { const a = window.__app; a.panel = 'options'; },
  stats: () => { const a = window.__app; a.panel = 'stats'; },
  trophies: () => { const a = window.__app; a.panel = 'trophies'; },
  toasts: () => {
    const a = window.__app; a.panel = null;
    a.toast('Pressing researched', '{u:research} the Press · {i:ironIngot} → {i:ironPlate}', '#93b6c9');
    a.toast('The Boardwalk filled', '{coin:3,000}  +1 {u:heart}', '#86a64a');
  },
  rich: () => {
    const a = window.__app; const g = a.game; a.toasts = [];
    g.s.coin = g.s.coin.add(123456789); g.s.land = ['A', 'B', 'C', 'D']; g.s.research.done = ['pressing', 'surveyEast', 'copperSmelting', 'wireDrawing', 'gearcutting', 'splitters', 'buffers', 'gizmoTheory', 'slagBricks', 'folding'];
    g.s.upgrades.push('bellows'); g.s.income = Array(60).fill(4321);
    a.renderer.ground = null; a.fitCamera(true);
  },
  huge: () => { const a = window.__app; const g = a.game; g.s.coin = g.s.coin.constructor.parse('4.56e123'); },
  // the 180 (docs/hud-180.md): the Workbench Wheel open at the cursor with an item's info tag,
  // the Purse's Shipping tag, the drawn keyboard and the Gazette's page
  slotHover: () => { const a = window.__app; const g = a.game; g.s.coin = g.s.coin.constructor.of(1234); a.panel = null; a.openWheelAt(); return { hoverIds: ['wheel_build', 'wheel_item_smelter'] }; },
  coinHover: () => { const a = window.__app; a.panel = null; return { hoverId: 'purse' }; },
  keys: () => { const a = window.__app; a.panel = 'keys'; },
  gazette: () => { const a = window.__app; a.panel = 'gazette'; },
  // the first slag jam: a Miner feeding the Hand Furnace, no Slag Heap; the furnace hovered
  jam: () => {
    const a = window.__app;
    a.newGame(7);
    a.freeze();
    const g = a.game;
    a.grant(70);
    a.act({ k: 'upgrade', id: 'bellows' });
    const f = g.machines.find((m) => m.kind === 'furnace');
    a.act({ k: 'place', kind: 'miner', x: f.x - 1, y: f.y, rot: 0 });
    a.step(20 * 60);
    // the jam itself, held for the shot (the frozen game keeps it): slag backed up in the furnace
    f.state = 'blocked';
    f.why = 'slag';
    f.hist = 'w'.repeat(20) + 'x'.repeat(40); // 'x': blocked by its byproduct (stats.ts)
    a.game.events.drain();
    a.renderer.fx.flyers = [];
    a.renderer.fx.pops = [];
    a.toasts = [];
    a.trophyPops = [];
    a.selected = null;
    a.toast('Choked on slag!', '{i:slag} nowhere to go · {k:LMB} shovel or a Slag Heap', '#c8362e');
    return { hover: [f.x, f.y] };
  },
  // a busy Act II Workshop: a boiler and engine, Poles, five kilns and a mixer browning the grid
  // out, a research node and an order under way, a kiln's report pinned
  act2power: () => {
    const a = window.__app;
    a.newGame(1);
    a.freeze();
    const g = a.game;
    a.grant(2.4e6);
    g.s.land = ['A', 'B', 'C', 'D', 'E', 'F'];
    g.s.upgrades.push('bellows');
    g.s.research.done = ['pressing', 'surveyEast', 'copperSmelting', 'wireDrawing', 'gearcutting', 'splitters', 'buffers', 'gizmoTheory', 'slagBricks', 'folding', 'coalSeams', 'steelmaking', 'overdrive', 'steamPower', 'glassworks', 'crushing', 'concrete', 'refining', 'machineKits'];
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
  },
  // Milestone 6: the offline report (a real 9 h run of a small factory), its progress card, the
  // overnight forecast with a stopped line, and the letters notation
  offline2: { idle: 'report' },
  offlineRun: { idle: 'running' },
  overnight: { idle: 'overnight' },
  letters: async () => {
    const a = window.__app; const g = a.game; const num = await import('/src/engine/num.ts');
    num.setNotation('letters'); g.s.coin = g.s.coin.constructor.parse('3.21e41'); a.panel = null;
  },
  lettersOff: async () => { const num = await import('/src/engine/num.ts'); num.setNotation('standard'); window.__app.panel = null; },
};
// a busy Act II Workshop with a tall pinned report, two toasts (one long) and two trophies: the
// toasts keep their room above the report (the UI legibility round)
STATES.act2toasts = {
  base: 'act2power',
  post: () => {
    const a = window.__app;
    a.toast('Circuits researched', '{u:research} 3 {i:copperWire} + {i:plastic} + {i:glass} → {i:circuit}', '#93b6c9', 'flask');
    a.toast('Lens Array filled', '{coin:12,000}  +1 {u:heart} · UNIT 7 BEEPS TWICE', '#6fc1ae');
    a.trophyPops = [{ id: 'estate', t: 0 }, { id: 'letThereBeLight', t: 0 }];
  },
};
// the same Workshop with nothing pinned and a kiln hovered: the compact hover report (the final
// round: the name, what it does, the one cause worth fixing, the rate; the rest pinned by a click),
// beside the kiln and clear of the build bar
STATES.act2hover = { base: 'act2power', post: () => { const a = window.__app; a.selected = null; return { hover: [21, 1] }; } };
// Milestone 13 (onboarding, UX and accessibility): a lesson card (on the Workshop, and on the
// District under its tool strip), the stuck-finder's answer on each floor, the Keys page moving a
// key and after it moved, and the largest UI scale the window takes (the HUD and Options)
STATES.lessonCard = { base: 'act2power', post: () => { const a = window.__app; a.selected = null; a.toasts = []; a.trophyPops = []; a.hud.celebs = []; a.onboarding.lessons.show(a, 'brownout'); } };
STATES.lessonStart = { base: 'start', post: () => { const a = window.__app; a.selected = null; a.toasts = []; a.trophyPops = []; a.hud.celebs = []; a.onboarding.lessons.show(a, 'starved'); } };
STATES.lessonDistrict = { base: 'district', post: () => { const a = window.__app; a.toasts = []; a.trophyPops = []; a.hud.celebs = []; a.onboarding.lessons.show(a, 'shortRoute'); } };
STATES.stuckAnswer = { base: 'act2power', post: () => { const a = window.__app; a.selected = null; a.toasts = []; a.trophyPops = []; a.hud.celebs = []; a.onboarding.whereStuck(); } };
STATES.stuckFactory = { base: 'factory2', post: () => { const a = window.__app; a.toasts = []; a.onboarding.whereStuck(); } };
// (every lot bought: the District's pinned report does not keep off the lot's Buy button, a District
// UI matter noted for its owner, and a module pinned at the floor's east edge sits on it)
STATES.stuckDistrict = { base: 'district', post: () => { const a = window.__app; a.toasts = []; for (let i = 0; i < 3; i++) a.act({ k: 'hlot', floor: 'district' }); a.game.events.drain(); a.toasts = []; a.fitCamera(true); a.onboarding.whereStuck(); } };
STATES.keysRebind = { base: 'act2power', post: () => { const a = window.__app; a.panel = 'keys'; a.onboarding.keys.capture(a, 'KeyF'); } };
STATES.keysMoved = { base: 'act2power', post: () => { const a = window.__app; a.panel = 'keys'; a.onboarding.keys.capture(a, 'KeyF'); a.onboarding.keys.press(a, 'KeyV'); } };
STATES.keysMovedHud = { base: 'act2power', post: () => { const a = window.__app; a.selected = null; a.toasts = []; a.trophyPops = []; a.hud.celebs = []; a.onboarding.keys.capture(a, 'KeyR'); a.panel = 'keys'; a.onboarding.keys.press(a, 'KeyK'); a.panel = null; a.selected = a.game.entAt(21, 1).id; } };
STATES.uiScaleMax = { base: 'act2power', post: () => { window.__app.onboarding.setUiScale(99); } };
STATES.uiScaleOptions = { base: 'act2power', post: () => { const a = window.__app; a.onboarding.setUiScale(99); a.panel = 'options'; } };
STATES.uiScaleSmall = { base: 'act2power', post: () => { window.__app.onboarding.setUiScale(1); } };
for (const s of ACT2) STATES[s] = s;
for (const s of WORKSHOP) STATES[s] = { ws: s };
for (const s of M5) STATES[s] = { m5: s };
for (const s of DISTRICT) STATES[s] = { d: s };
for (const s of ACT3) STATES[s] = { a3: s }; // Act III
Object.assign(STATES, ACT3_M5); // Act III

async function main() {
  const only = process.argv.slice(2);
  const out = 'e2e/out/screens';
  if (!only.length) fs.rmSync(out, { recursive: true, force: true });
  fs.mkdirSync(out, { recursive: true });
  const { browser } = await launch({ gpu: process.env.GPU ?? 'hw' });
  const report = [];
  for (const [w, h] of SIZES) {
    const { page, errors } = await openGame(browser, { w, h });
    await page.evaluate(async () => {
      window.__app.ui.audit = true;
      window.__audit = await import('/src/ui/audit.ts');
    });
    for (const [state, fn] of Object.entries(STATES)) {
      if (only.length && !only.includes(state)) continue;
      const name = `${w}x${h}-${state}`;
      const run = async (f) => (typeof f === 'string' ? await page.evaluate(act2Setup, f) : f.ws ? await page.evaluate(workshopSetup, f.ws) : f.idle ? await page.evaluate(idleSetup, f.idle) : f.m5 ? await page.evaluate(m5Setup, f.m5) : f.d ? await page.evaluate(districtSetup, f.d) : f.a3 ? await page.evaluate(act3Setup, f.a3) : f.base ? (await run(STATES[f.base]), await page.evaluate(f.post)) : await page.evaluate(f));
      // Milestone 13: lesson cards held off (a state asks for its own), the keys and the UI scale
      // as they came (the states that change them come last in a size's run, or put them back here)
      await page.evaluate(() => { const o = window.__app.onboarding; o.lessons.hold(true); o.keys.reset(window.__app); let st = {}; try { st = JSON.parse(localStorage.getItem('foldworks_settings') || '{}'); } catch {} if (st.uiScale) o.setUiScale(0); });
      const r = await run(fn);
      // the goal card slides in when its goal changes: a state set from scratch shows it at rest
      await page.evaluate(() => { window.__app.hud.goalKey = null; });
      if (r?.drag) await dragTiles(page, r.drag);
      else if (r?.hoverIds) {
        // a chain of HUD elements hovered in turn (the wheel: a petal fans, then an item on it)
        // (the fan animates in real time, so wait on the clock as well as on frames: a slow frame
        // rate caught the items still sliding out, their price chips stacked)
        for (const id of r.hoverIds) {
          await frames(page, 8);
          await page.waitForTimeout(350);
          const p = await page.evaluate((id) => { const a = window.__app; const q = a.ui.ids.get(id); return q ? a.uiToCss(q.x + q.w / 2, q.y + q.h / 2) : null; }, id);
          if (p) await page.mouse.move(p.x, p.y);
        }
        await frames(page, 8);
        await page.waitForTimeout(350);
      } else if (r?.hoverId) {
        // a HUD element by its button id (drawn last frame), or the coin counter
        await frames(page, 2);
        const p = await page.evaluate((id) => { const a = window.__app; const q = a.ui.ids.get(id); return q ? a.uiToCss(q.x + q.w / 2, q.y + q.h / 2) : null; }, r.hoverId);
        if (p) await page.mouse.move(p.x, p.y);
      } else if (r?.hover) { const p = await page.evaluate(([x, y]) => window.__app.tileToCss(x, y), r.hover); await page.mouse.move(p.x, p.y); await page.waitForTimeout(HOVER_WAIT); }
      else await page.mouse.move(Math.floor(w / 2), Math.floor(h / 2) + 40);
      // toasts and trophies shown at rest, where they land: sliding in they are not layout yet (the
      // audit skips them then), and a shot mid-slide looks cut off at the edge
      const land = () => { const a = window.__app; for (const t of a.toasts) t.t = Math.max(t.t, 0.3); for (const p of a.trophyPops) p.t = Math.max(p.t, 0.3); };
      await page.evaluate(land);
      await frames(page, 2);
      await page.evaluate(land);
      await frames(page, state === 'megaDone' ? 38 : state === 'gradeSplus' ? 34 : state === 'toasts' ? 38 : 2);
      await page.screenshot({ path: `${out}/${name}.png` });
      if (r?.drag) await page.mouse.up();
      const { issues, k } = await page.evaluate(() => {
        const ui = window.__app.ui;
        return { issues: window.__audit.findIssues(ui.lastAudit, { w: ui.w, h: ui.h }), k: ui.scale / (window.devicePixelRatio || 1) };
      });
      report.push({ name, issues });
      if (issues.length) {
        await page.evaluate(({ issues, k }) => {
          const root = document.createElement('div');
          root.id = '__auditOverlay';
          root.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:99';
          const col = { clash: '#ff2d55', overflow: '#ff9500', covered: '#00c7ff', offscreen: '#bf5af2' };
          for (const i of issues)
            for (const [r, dashed] of [[i.rect, false], [i.otherRect, true]]) {
              if (!r) continue;
              const b = document.createElement('div');
              b.style.cssText = `position:absolute;left:${r.x * k}px;top:${r.y * k}px;width:${r.w * k}px;height:${r.h * k}px;outline:2px ${dashed ? 'dashed' : 'solid'} ${col[i.type]}`;
              root.appendChild(b);
            }
          document.body.appendChild(root);
        }, { issues, k });
        await page.screenshot({ path: `${out}/${name}.issues.png` });
        await page.evaluate(() => document.getElementById('__auditOverlay')?.remove());
      }
      console.log(`${issues.length ? '!' : ' '} ${name}${issues.length ? `  (${issues.length}: ${issues.map((i) => i.type + ' "' + i.text + '"').join('; ')})` : ''}`);
    }
    if (errors.length) report.push({ name: `${w}x${h} console`, issues: errors.map((e) => ({ type: 'console', text: e })) });
    await page.close();
  }
  const md = ['# HUD overlap audit', '', ...report.map((r) => `- ${r.issues.length ? '**' + r.name + '**' : r.name}: ${r.issues.length ? r.issues.map((i) => `${i.type} "${i.text}"${i.other ? ' vs ' + i.other : ''}`).join('; ') : 'clean'}`)];
  fs.writeFileSync(`${out}/report${only.length ? '-partial' : ''}.md`, md.join('\n') + '\n');
  const bad = report.filter((r) => r.issues.length).length;
  console.log(`\n${bad ? bad + ' shot(s) with issues' : 'all clean'}; report: ${out}/report.md`);
  if (bad) process.exitCode = 1;
  await browser.close();
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) await main();
