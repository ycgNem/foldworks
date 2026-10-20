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
import { launch, openGame, frames } from './launch.mjs';

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

const SIZES = [[1280, 720], [1920, 1080], [1024, 640]];
// each state: a function run in the page that puts the app there (frozen); it may return
// { hover: [x, y] } to put the mouse over that tile instead of the board's top edge
const STATES = {
  title: () => { const a = window.__app; a.screen = 'title'; },
  start: () => { const a = window.__app; a.newGame(7); a.freeze(); a.toasts = []; },
  build: () => { const a = window.__app; a.setMode({ k: 'build', kind: 'miner' }); return { hover: [2, 3] }; },
  report: () => {
    const a = window.__app; a.setMode({ k: 'idle' });
    const f = a.game.machines.find((m) => m.kind === 'furnace'); a.selected = f.id;
  },
  hoverReport: () => { const a = window.__app; a.selected = null; return { hover: [3, 3] }; },
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
    a.toast('Research complete: Pressing', 'Unlocked the Press and iron plates.', '#93b6c9');
    a.toast('The Boardwalk: filled!', '+3,000 coin, +1 reputation. "Ribbit! The swamp thanks you."', '#86a64a');
  },
  rich: () => {
    const a = window.__app; const g = a.game; a.toasts = [];
    g.s.coin = g.s.coin.add(123456789); g.s.land = ['A', 'B', 'C', 'D']; g.s.research.done = ['pressing', 'surveyEast', 'copperSmelting', 'wireDrawing', 'gearcutting', 'splitters', 'buffers', 'gizmoTheory', 'slagBricks', 'folding'];
    g.s.upgrades.push('bellows'); g.s.income = Array(60).fill(4321);
    a.renderer.ground = null; a.fitCamera(true);
  },
  huge: () => { const a = window.__app; const g = a.game; g.s.coin = g.s.coin.constructor.parse('4.56e123'); },
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
for (const s of ACT2) STATES[s] = s;
for (const s of WORKSHOP) STATES[s] = { ws: s };

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
      const r = typeof fn === 'string' ? await page.evaluate(act2Setup, fn) : fn.ws ? await page.evaluate(workshopSetup, fn.ws) : fn.idle ? await page.evaluate(idleSetup, fn.idle) : await page.evaluate(fn);
      if (r?.drag) await dragTiles(page, r.drag);
      else if (r?.hover) { const p = await page.evaluate(([x, y]) => window.__app.tileToCss(x, y), r.hover); await page.mouse.move(p.x, p.y); }
      else await page.mouse.move(Math.floor(w / 2), Math.floor(h / 2) + 40);
      await frames(page, state === 'megaDone' ? 40 : state === 'gradeSplus' ? 36 : 4);
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
          const col = { clash: '#ff2d55', overflow: '#ff9500', covered: '#00c7ff' };
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
