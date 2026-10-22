// Performance (Milestone 14): every floor built to its worst case, then the game runs at normal
// speed while the frame (render + HUD) and the tick (sim) are timed. The target (ROADMAP.md
// Milestone 14) is 200 modules on each floor and a dense 16x16 Workshop at 60 fps on a mid laptop:
// a frame's whole budget is 16.7 ms, and the sim's share of it is under 4 ms (Milestone 2).
//
// Scenarios (all by default, or name some):
//   workshop  50 min of planner play on the 16x16 Workshop, then every free tile belted and every
//             belt carrying an item (the worst case for belts and for drawing items)
//   factory   the Factory at its widest (18x9 with the three annex blocks and the City's row): two
//             trunk rows into the Dock and the Hopper, every other free tile a module feeding them
//   district, world, beyond
//             every lot bought, every free tile a module (up to 200), each flying its output to the
//             Dock or the Hopper (as many routes as the floor allows)
// Each runs with the whole floor in view at 1920x1080 (nothing culled: the dearest view).
//
// Usage: npm run perf [-- workshop factory ...]   GPU=hw for the real GPU (default SwiftShader).
// Writes e2e/out/perf/<gpu>.json and a screenshot of each floor (e2e/out/perf/<gpu>-<name>.png).
// Needs the dev server (BASE=...) or vite preview.
import fs from 'node:fs';
import { launch, openGame, BASE, LOAD_TIMEOUT } from './launch.mjs';
import { act5Setup } from './screens.mjs';

const ALL = ['load', 'workshop', 'factory', 'district', 'world', 'beyond'];
const only = process.argv.slice(2).filter((s) => ALL.includes(s));
const want = only.length ? only : ALL;
const out = 'e2e/out/perf';
fs.mkdirSync(out, { recursive: true });
const { browser, gpu } = await launch();

// a cold load (a fresh context: nothing cached): requests, bytes and the time to the title
let load = null;
if (want.includes('load')) {
  const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const p = await ctx.newPage();
  let requests = 0, bytes = 0;
  p.on('requestfinished', async (q) => { requests++; try { bytes += (await q.sizes()).responseBodySize; } catch {} });
  const t0 = Date.now();
  await p.goto(BASE, { timeout: LOAD_TIMEOUT });
  const dom = Date.now() - t0;
  await p.waitForFunction(() => window.__app && window.__app.ready, null, { timeout: LOAD_TIMEOUT, polling: 50 });
  load = { ms: Date.now() - t0, domMs: dom, requests, kb: Math.round(bytes / 1024) };
  await ctx.close();
}
const { page, errors } = await openGame(browser, { w: 1920, h: 1080 });

/** Runs in the page: the dense 16x16 Workshop. */
function workshopDense(minutes) {
  const a = window.__app;
  a.newGame(1);
  a.freeze();
  a.attachBot('planner');
  a.botTicks(minutes * 60 * 20);
  a.game.events.drain();
  a.attachBot(null);
  const g = a.game;
  a.grant(1e9);
  for (const id of ['B', 'C', 'D']) { g.s.research.done.push('surveyEast', 'folding'); a.act({ k: 'land', id }); }
  // a serpentine belt over every free tile of the 16x16 (chunks A-D)
  const W = 16, H = 16;
  for (let y = 0; y < H; y++)
    for (let x0 = 0; x0 < W; x0++) {
      const x = y % 2 ? W - 1 - x0 : x0;
      const rot = x0 === W - 1 ? 1 : y % 2 ? 2 : 0;
      if (!g.entAt(x, y)) a.act({ k: 'place', kind: 'belt', x, y, rot });
    }
  for (const e of g.belts) e.item = 'ironOre';
  a.setFloor('workshop', true);
  return { ents: g.s.ents.length, belts: g.belts.length, machines: g.machines.length + g.miners.length, items: g.belts.filter((e) => e.item).length };
}

/** Runs in the page, after act5Setup('beyond'): the Factory and the three high floors filled. */
async function fillFloors() {
  const a = window.__app;
  const g = a.game;
  const { HIGH } = await import('/src/data/floors.ts');
  const { FACTORY, ANNEX } = await import('/src/data/land.ts');
  const gr = { letter: 'A', score: 0.86, u: 0.9, w: 1, c: 0.8, mult: 1.1 };
  let nid = Math.max(0, ...g.s.designs.map((d) => d.id)) + 1;
  const D = (name, outs, depth) => {
    const d = { id: nid++, name, box: { x: 2, y: 2, w: 4, h: 3 }, parts: [], ins: {}, outs, grade: gr, bill: 1000, stamped: 0, spare: 999, depth, fparts: [], hfloor: depth >= 3 ? (depth === 4 ? 'world' : 'district') : undefined, hparts: [], hroutes: [] };
    g.s.designs.push(d);
    return d;
  };
  const designs = {
    factory: [D('Gizmo works', { gizmo: 0.5 }, 1), D('Steel works', { steel: 1 }, 2)],
    district: [D('Steel works II', { steel: 2 }, 2), D('Glass II', { glass: 1.5 }, 2)],
    world: [D('Steel works III', { steel: 1.6 }, 3), D('Skyglass Lenses III', { skyglassLens: 0.8 }, 3)],
    beyond: [D('Storm Front IV', { stormCell: 0.4 }, 4), D('Processors IV', { processor: 0.4 }, 4)],
  };
  g.s.nextDesign = nid;
  const info = {};
  // ---- the Factory: every annex block, the City's ninth row; trunks along rows 1 and 5 into the
  // Dock and the Hopper (from both sides), every other free tile a module
  g.s.annex = ANNEX.blocks;
  g.s.megas.city.stage = Math.max(1, g.s.megas.city.stage);
  g.rebuild();
  const fw = g.fw, fh = g.fh;
  const dockX = FACTORY.dock.x;
  let trunks = 0, fmods = 0;
  for (const y of [1, 2, 5, 6]) for (let x = 0; x < fw; x++) {
    if (g.fentAt(x, y)) continue;
    if (y === 1 || y === 5) if (a.act({ k: 'ftrunk', x, y, rot: x < dockX ? 0 : 2 }).ok) trunks++;
  }
  for (let y = 0; y < fh; y++) for (let x = 0; x < fw; x++) {
    if (g.fentAt(x, y)) continue;
    // face the nearest trunk row
    const rot = y === 0 || y === 4 ? 1 : y === 2 || y === 6 ? 3 : y < 4 ? 3 : 0;
    const d = designs.factory[(x + y) % 2];
    if (a.act({ k: 'fplace', design: d.id, x, y, rot }).ok) fmods++;
  }
  info.factory = { w: fw, h: fh, modules: fmods, trunks };
  // ---- the high floors: every lot, every free tile a module flying to the Dock or the Hopper
  for (const f of ['district', 'world', 'beyond']) {
    const st = g.s[f];
    if (!st) { info[f] = { missing: true }; continue; }
    const H = HIGH[f];
    st.lots = H.lots;
    const w = H.w + H.lotCols * H.lots;
    let mods = 0, routes = 0, refused = '';
    for (let y = 0; y < H.h && mods < 200; y++) for (let x = 0; x < w && mods < 200; x++) {
      if (st.ents.some((e) => x >= e.x && x < e.x + e.w && y >= e.y && y < e.y + e.h)) continue;
      const d = designs[f][(x + y) % 2];
      const r = a.act({ k: 'hplace', floor: f, design: d.id, x, y });
      if (!r.ok) { refused = r.why; continue; }
      mods++;
      const to = y < H.h / 2 ? H.dock : H.hopper;
      const rr = a.act({ k: 'route', floor: f, fx: x, fy: y, tx: to.x, ty: to.y, item: Object.keys(d.outs)[0] });
      if (rr.ok) routes++;
    }
    info[f] = { w, h: H.h, modules: st.ents.filter((e) => e.kind === 'module').length, routes: st.routes.length, skiffs: st.routes.reduce((n, r) => n + r.skiffs, 0), refused };
  }
  a.step(20 * 20);
  a.game.events.drain();
  return info;
}

/** Runs in the page: show a floor whole, with the setup's flourishes cleared. */
function showFloor(f) {
  const a = window.__app;
  a.setFloor(f, true);
  a.fitCamera(true);
  if (f !== 'workshop' && f !== 'factory') { const DS = a.districtUI; DS.game = a.game; DS.floor = f; DS.route = null; DS.pick = null; DS.from = null; DS.sel = null; DS.hoverRoute = null; }
  a.panel = null;
  // no lesson card over the floor (the setup's firsts would queue a few)
  a.onboarding?.lessons?.hold(true);
  a.toasts = [];
  a.trophyPops = [];
  a.hud.celebs = [];
  a.hud.rain = [];
  a.hud.confetti = 0;
  a.game.events.drain();
  const fx = a.renderer.fx;
  fx.flyers = []; fx.pops = []; fx.parts = []; fx.rings = [];
  a.unfreeze();
}

/** Time the running game: every frame's render + HUD (wrapping the loop's frame), the rAF
 * intervals, and the sim's tick timed directly (40 ticks, so a 60 Hz frame's share of the 20 Hz
 * sim is not averaged away). */
async function measure(ms = 3000) {
  // the setup's own celebrations settle first (measured mid-shower a dense floor read 11 ms a frame
  // in software rendering that settles to about 2.2 ms)
  await page.waitForFunction(() => { const f = window.__app.renderer.fx; return !f.parts.length && !f.rings.length && !f.flyers.length && !f.pops.length; }, null, { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(1500);
  return page.evaluate(async (ms) => {
    const a = window.__app;
    const L = a.loop;
    const frame = L.frame;
    const fr = [], iv = [];
    let last = 0;
    L.frame = (dt, al) => {
      const t0 = performance.now();
      if (last) iv.push(t0 - last);
      last = t0;
      frame(dt, al);
      fr.push(performance.now() - t0);
    };
    await new Promise((r) => setTimeout(r, ms));
    L.frame = frame;
    const ticks = [];
    for (let i = 0; i < 10; i++) {
      const t0 = performance.now();
      for (let k = 0; k < 40; k++) a.game.tick();
      ticks.push((performance.now() - t0) / 40);
      await new Promise((r) => setTimeout(r, 30));
    }
    const q = (xs, p) => { const s = [...xs].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(p * s.length))] ?? 0; };
    const avg = (xs) => xs.reduce((s, x) => s + x, 0) / Math.max(1, xs.length);
    return {
      frames: fr.length,
      frameMs: avg(fr), frameP95: q(fr, 0.95), frameMax: Math.max(...fr),
      fps: 1000 / avg(iv), intervalP95: q(iv, 0.95),
      tickMs: avg(ticks), tickMax: Math.max(...ticks),
    };
  }, ms);
}

const results = {};
const lines = [`Perf (${gpu}), 1920x1080, the whole floor in view, ${BASE}`];
if (load) lines.push(`cold load: ${(load.ms / 1000).toFixed(2)} s to the title (${(load.domMs / 1000).toFixed(2)} s to the page's load event), ${load.requests} requests, ${load.kb} KB`);
const say = (name, info, m) => {
  results[name] = { info, ...m };
  const d = (x, n = 2) => x.toFixed(n);
  lines.push(`${name.padEnd(9)} ${JSON.stringify(info)}`);
  lines.push(`          frame ${d(m.frameMs)} ms (p95 ${d(m.frameP95)}, max ${d(m.frameMax)}), ${d(m.fps, 0)} fps (rAF p95 ${d(m.intervalP95, 1)} ms); tick ${d(m.tickMs, 3)} ms (worst ${d(m.tickMax, 3)})  ${m.tickMs < 4 && m.frameMs + m.tickMs < 16.7 ? 'PASS' : 'FAIL'}`);
};
if (want.includes('workshop')) {
  const info = await page.evaluate(workshopDense, 50);
  await page.evaluate(showFloor, 'workshop');
  say('workshop', info, await measure());
  await page.screenshot({ path: `${out}/${gpu}-workshop.png` });
}
const high = want.filter((f) => f !== 'workshop' && f !== 'load');
if (high.length) {
  await page.evaluate(act5Setup, 'beyond');
  await page.evaluate(() => window.__app.freeze());
  const info = await page.evaluate(fillFloors);
  for (const f of high) {
    await page.evaluate(showFloor, f);
    say(f, info[f], await measure());
    await page.screenshot({ path: `${out}/${gpu}-${f}.png` });
    await page.evaluate(() => window.__app.freeze());
  }
}
console.log(lines.join('\n'));
fs.writeFileSync(`${out}/${gpu}.json`, JSON.stringify({ date: new Date().toISOString(), gpu, base: BASE, load, results }, null, 2));
if (errors.length) console.log(errors.join('\n'));
await browser.close();
const bad = Object.values(results).some((r) => r.tickMs >= 4 || r.frameMs + r.tickMs >= 16.7);
process.exit(bad ? 1 : 0);
