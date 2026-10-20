// Milestone 6, idle and offline (DESIGN.md §12, §15, §20): stopping a line (the 'pause' command),
// Inspiration clicking, the Night Shift and offline efficiency, and the offline model's timeline:
// jams with their time and machine, heaps filling in an extrapolated segment, the 7-day cap,
// Sparks paused, and the forecast being the same computation on a copy of the game.
import { describe, expect, it } from 'vitest';
import { Game, type Cmd } from '../src/sim/Game';
import { N, Num } from '../src/engine/num';
import { RESEARCH, RESEARCH_IDS } from '../src/data/research';
import { CHUNKS } from '../src/data/land';
import { RULES } from '../src/data/rules';
import { IDLE, IDLE_UPGRADES } from '../src/data/idle';
import { TICK_RATE } from '../src/engine/time';
import { fingerprint, restore } from '../src/sim/snapshot';
import { runOffline, forecast, offlineEfficiency, copyGame, OfflineRun } from '../src/sim/offline';
import { inspiredFrac } from '../src/sim/systems/inspire';
import { researchFrac } from '../src/sim/systems/research';
import { idleUpgradeGain } from '../src/sim/systems/pause';
import type { ModuleDesign } from '../src/sim/world';

function must(g: Game, c: Cmd) {
  const r = g.act(c);
  if (!r.ok) throw new Error(`${JSON.stringify(c)}: ${r.why}`);
}

/** The starting furnace with the Bellows and a Miner feeding it: ingots to the Dock, slag into the
 * starting heap under it (and a second heap east of that one when `heaps` is 2). */
function furnaceLine(heaps = 1, history = false) {
  const g = new Game(7, { keepHistory: history });
  g.s.coin = N(1e6);
  g.s.upgrades.push('bellows');
  must(g, { k: 'place', kind: 'miner', x: 2, y: 3, rot: 0 });
  if (heaps === 2) must(g, { k: 'place', kind: 'heap', x: 4, y: 4, rot: 0 });
  return g;
}

describe('stopping a line (DESIGN.md §20)', () => {
  it('a stopped machine takes nothing, makes nothing and holds its buffers; started again it runs', () => {
    const g = furnaceLine();
    g.step(30 * TICK_RATE);
    const f = g.entAt(3, 3)!;
    must(g, { k: 'pause', x: 3, y: 3, on: true });
    const crafts = f.crafts, held = JSON.stringify(f.inBuf);
    g.step(30 * TICK_RATE);
    expect(f.crafts).toBe(crafts);
    expect(JSON.stringify(f.inBuf)).toBe(held);
    expect(f.state).toBe('idle');
    expect(f.why).toBe('paused');
    // its Miner backs up behind it (blocked), never pushing ore in
    expect(g.entAt(2, 3)!.state).toBe('blocked');
    must(g, { k: 'pause', x: 3, y: 3, on: false });
    g.step(10 * TICK_RATE);
    expect(f.crafts).toBeGreaterThan(crafts);
  });

  it('stopping the line stops its Miners too (named by any machine, or by the heap it fills)', () => {
    const g = furnaceLine();
    g.step(10 * TICK_RATE);
    must(g, { k: 'pause', x: 3, y: 4, line: true, on: true });
    expect(g.entAt(2, 3)!.paused).toBe(true);
    expect(g.entAt(3, 3)!.paused).toBe(true);
    const crafts = g.entAt(2, 3)!.crafts;
    g.step(20 * TICK_RATE);
    expect(g.entAt(2, 3)!.crafts).toBe(crafts);
    expect(g.entAt(2, 3)!.why).toBe('paused');
  });

  it('a splitter routes a stopped machine\'s share to its other side', () => {
    const g = new Game(3);
    g.s.coin = N(1e6);
    g.s.land = CHUNKS.map((c) => c.id);
    g.s.research.done = [...RESEARCH_IDS];
    g.s.ents = g.s.ents.filter((e) => e.kind === 'dock' || e.kind === 'hopper' || e.kind === 'furnace');
    g.rebuild();
    // a miner on the copper patch into a splitter whose sides feed two smelters
    must(g, { k: 'place', kind: 'miner', x: 11, y: 3, rot: 1 });
    must(g, { k: 'place', kind: 'splitter', x: 11, y: 4, rot: 1 });
    must(g, { k: 'place', kind: 'smelter', x: 12, y: 4, rot: 0 });
    must(g, { k: 'place', kind: 'smelter', x: 10, y: 4, rot: 2 });
    must(g, { k: 'place', kind: 'heap', x: 12, y: 5, rot: 0 });
    must(g, { k: 'place', kind: 'heap', x: 10, y: 5, rot: 0 });
    // crates take the ingots
    must(g, { k: 'place', kind: 'crate', x: 13, y: 4, rot: 0 });
    must(g, { k: 'place', kind: 'crate', x: 9, y: 4, rot: 2 });
    must(g, { k: 'pause', x: 10, y: 4, on: true });
    g.step(90 * TICK_RATE);
    const a = g.entAt(12, 4)!, b = g.entAt(10, 4)!;
    expect(b.crafts).toBe(0);
    expect(Object.values(b.inBuf).reduce((x, y) => x + y, 0)).toBe(0);
    // the miner's 30/min all go to the running smelter (minus the first moments)
    expect(a.crafts).toBeGreaterThan(38);
  });

  it('is a logged command: a replay of the history stops the same line at the same tick', () => {
    const g = furnaceLine(1, true);
    g.step(200);
    must(g, { k: 'pause', x: 3, y: 3, line: true, on: true });
    g.step(300);
    must(g, { k: 'pause', x: 2, y: 3, on: false });
    g.step(200);
    // the setup was not commands: replay the history onto the same setup
    expect(g.history!.some((l) => l.c.k === 'pause')).toBe(true);
    const h = new Game(7, { keepHistory: true });
    h.s.coin = N(1e6);
    h.s.upgrades.push('bellows');
    for (const l of g.history!) {
      while (h.s.tick < l.t) h.tick();
      h.act(l.c);
    }
    while (h.s.tick < g.s.tick) h.tick();
    expect(fingerprint(h)).toBe(fingerprint(g));
  });

  it('a stopped module runs at 0 and takes nothing; the trunks into it back up', () => {
    const g = new Game(1);
    g.first('factoryOpen');
    const d: ModuleDesign = { id: 1, name: 'Ingots', box: { x: 0, y: 0, w: 1, h: 1 }, parts: [{ kind: 'smelter', dx: 0, dy: 0, rot: 0, recipe: null }], ins: {}, outs: { ironIngot: 0.5 }, grade: { letter: 'B', score: 0.7, u: 1, w: 1, c: 1, mult: 1 }, bill: 60, stamped: 0, spare: 1 };
    g.s.designs.push(d);
    g.s.coin = N(1000);
    must(g, { k: 'fplace', design: 1, x: 2, y: 2, rot: 0 });
    for (let x = 3; x < 10; x++) must(g, { k: 'ftrunk', x, y: 2, rot: 0 });
    g.step(20 * TICK_RATE);
    const got0 = g.s.delivered.ironIngot?.toNumber() ?? 0;
    expect(got0).toBeGreaterThan(5);
    must(g, { k: 'pause', x: 2, y: 2, floor: 'factory', on: true });
    g.step(5 * TICK_RATE);
    const got1 = g.s.delivered.ironIngot?.toNumber() ?? 0;
    g.step(30 * TICK_RATE);
    expect(g.s.delivered.ironIngot?.toNumber() ?? 0).toBe(got1);
    const m = g.s.factory.ents.find((e) => e.kind === 'module')!;
    expect(m.state).toBe('idle');
    expect(m.why).toBe('paused');
  });
});

describe('Inspiration (DESIGN.md §15)', () => {
  /** a fresh game past the slice end, Pressing (30 iron ingots) selected */
  function inspired() {
    const g = new Game(2, { keepHistory: true });
    g.first('sliceEnd');
    must(g, { k: 'research', id: 'pressing' });
    return g;
  }

  it('is off before Act II: a Hopper click does nothing (and opens research, as before)', () => {
    const g = new Game(2);
    must(g, { k: 'research', id: 'pressing' });
    const r = g.act({ k: 'click', x: 6, y: 4 });
    expect(r.ok).toBe(false);
    expect(r.why).toBe('nothing to click');
  });

  it('1 click = 0.1% of what the node still needs, counted as items delivered', () => {
    const g = inspired();
    must(g, { k: 'click', x: 6, y: 4 });
    expect(g.s.research.progress.pressing!.ironIngot!.toNumber()).toBeCloseTo(30 * 0.001, 9);
    must(g, { k: 'click', x: 7, y: 5 });
    expect(g.s.research.progress.pressing!.ironIngot!.toNumber()).toBeCloseTo(0.03 + (30 - 0.03) * 0.001, 9);
    expect(researchFrac(g, 'pressing')).toBeGreaterThan(0);
  });

  it('respects the 12 clicks/s cap', () => {
    const g = inspired();
    let ok = 0;
    for (let i = 0; i < 20; i++) if (g.act({ k: 'click', x: 6, y: 4 }).ok) ok++;
    expect(ok).toBe(RULES.clickCap.value);
  });

  it('stops at 30% of each node: the line delivers the rest', () => {
    const g = inspired();
    for (let s = 0; s < 120; s++) {
      for (let i = 0; i < 12; i++) g.act({ k: 'click', x: 6, y: 4 });
      g.step(TICK_RATE);
    }
    const p = g.s.research.progress.pressing!.ironIngot!.toNumber();
    expect(p).toBeCloseTo(30 * IDLE.inspireCap.value, 6);
    expect(inspiredFrac(g, 'pressing')).toBeCloseTo(IDLE.inspireCap.value, 6);
    expect(g.done('pressing')).toBe(false);
    // a capped click is quiet: ok, nothing more given
    g.step(TICK_RATE);
    expect(g.act({ k: 'click', x: 6, y: 4 }).ok).toBe(true);
    expect(g.s.research.progress.pressing!.ironIngot!.toNumber()).toBeCloseTo(9, 6);
  });

  it('needs a node selected, says so', () => {
    const g = new Game(2);
    g.first('sliceEnd');
    const r = g.act({ k: 'click', x: 6, y: 4 });
    expect(r.ok).toBe(false);
    expect(r.why).toMatch(/Select a research node/);
  });

  it('the Factory Hopper takes Inspiration clicks too (fclick), under the same cap', () => {
    const g = inspired();
    g.first('factoryOpen');
    let ok = 0;
    for (let i = 0; i < 15; i++) if (g.act({ k: 'fclick', x: 10, y: 5 }).ok) ok++;
    expect(ok).toBe(12);
    expect(g.s.research.progress.pressing!.ironIngot!.toNumber()).toBeGreaterThan(0.3);
  });

  it('replays exactly (a sim command) and survives a save', () => {
    const g = inspired();
    for (let i = 0; i < 30; i++) { g.act({ k: 'click', x: 6, y: 4 }); g.step(3); }
    const h = new Game(2, { keepHistory: true });
    h.first('sliceEnd');
    for (const l of g.history!) {
      while (h.s.tick < l.t) h.tick();
      h.act(l.c);
    }
    while (h.s.tick < g.s.tick) h.tick();
    expect(h.s.research.progress.pressing!.ironIngot!.toString()).toBe(g.s.research.progress.pressing!.ironIngot!.toString());
    const c = copyGame(g);
    expect(c.s.inspire.pressing!.ironIngot!.toString()).toBe(g.s.inspire.pressing!.ironIngot!.toString());
  });

  it('fills every node of a two-item cost item by item', () => {
    const g = new Game(2);
    g.first('sliceEnd');
    g.s.research.done = ['pressing', 'surveyEast', 'copperSmelting', 'wireDrawing', 'gearcutting', 'splitters'];
    must(g, { k: 'research', id: 'buffers' });
    must(g, { k: 'click', x: 6, y: 4 });
    const cost = RESEARCH.buffers.cost as Record<string, number>;
    for (const [item, n] of Object.entries(cost)) expect(g.s.research.progress.buffers![item as 'gear']!.toNumber()).toBeCloseTo(n * 0.001, 9);
  });
});

describe('the Night Shift and offline efficiency (DESIGN.md §20)', () => {
  it('starts at 0.5, each upgrade adds its points after its research, capped at 0.75', () => {
    const g = new Game(1);
    expect(offlineEfficiency(g)).toBe(0.5);
    g.s.coin = N(1e7);
    expect(g.act({ k: 'idleUpgrade', id: 'nightForeman' }).why).toMatch(/Steam Power/);
    g.s.research.done.push('steamPower', 'circuits');
    must(g, { k: 'idleUpgrade', id: 'nightForeman' });
    expect(offlineEfficiency(g)).toBeCloseTo(0.55, 9);
    expect(g.act({ k: 'idleUpgrade', id: 'nightForeman' }).ok).toBe(false);
    must(g, { k: 'idleUpgrade', id: 'nightRota' });
    expect(offlineEfficiency(g)).toBeCloseTo(0.6, 9);
    expect(g.s.coin.toNumber()).toBe(1e7 - IDLE_UPGRADES.reduce((s, u) => s + u.cost, 0));
    g.s.upgrades.push('nightForeman', 'nightRota', 'nightForeman');
    expect(offlineEfficiency(g)).toBeLessThanOrEqual(IDLE.offlineEffMax.value);
  });

  it('the Patents\' offline nodes and the Night Shift reach the 0.75 ceiling together, and no further', () => {
    const g = new Game(1);
    g.s.coin = N(1e7);
    g.s.research.done.push('steamPower', 'circuits');
    // the Patent tree's three offline nodes (+0.05 each since the reset-layer review round) and
    // the Night Foreman reach 0.70; the Rota then tops it up to the ceiling
    g.s.meta.nodes.push('nightShift', 'nightWatch', 'lightsOn');
    expect(offlineEfficiency(g)).toBeCloseTo(0.65, 9);
    must(g, { k: 'idleUpgrade', id: 'nightForeman' });
    must(g, { k: 'idleUpgrade', id: 'nightRota' });
    expect(offlineEfficiency(g)).toBeCloseTo(IDLE.offlineEffMax.value, 9);
    // (0.5 + 0.15 + 0.1 is the ceiling exactly, so with everything bought nothing is left to refuse;
    // the refusals in idleUpgradeRefusal and patentRefusal guard a ceiling reached early, which
    // these numbers no longer allow)
    // one step short of it: the upgrade adds only what is left under the ceiling, and is sold
    g.s.upgrades = g.s.upgrades.filter((u) => u !== 'nightForeman' && u !== 'nightRota');
    g.s.meta.nodes = ['nightShift'];
    const gain = idleUpgradeGain(g, 'nightForeman');
    expect(gain).toBeGreaterThan(0);
    expect(offlineEfficiency(g) + gain).toBeLessThanOrEqual(IDLE.offlineEffMax.value + 1e-9);
    must(g, { k: 'idleUpgrade', id: 'nightForeman' });
  });
});

describe('the offline model (DESIGN.md §12)', () => {
  it('reports a stopped line as one row: its first machine to block, why, a fix, how many it stopped', () => {
    const g = furnaceLine();
    // the starting heap holds 400; at 7.5 slag/min it fills in about 53 min
    const rep = runOffline(g, 2 * 3600);
    // the furnace and its Miner jam: one line, one row (the heap's filling is its cause, not a row)
    const rows = rep.timeline.filter((e) => e.kind === 'jam' || e.kind === 'heap');
    expect(rows).toHaveLength(1);
    const jam = rows[0];
    expect(jam.kind).toBe('jam');
    expect(jam.text).toMatch(/^Hand Furnace's line stopped: its Slag Heap filled \(2 machines\)$/);
    expect(jam.t / 60).toBeGreaterThan(45);
    expect(jam.t / 60).toBeLessThan(60);
    expect(jam.x).toBe(3);
    expect(jam.y).toBe(3);
    expect(jam.why).toBe('slag');
    expect(jam.est).toBeFalsy();
    expect(rep.jams).toBe(2);
    const l = rep.lines[jam.line!];
    expect(l.count).toBe(2);
    expect(l.root.name).toBe('Hand Furnace');
    expect(l.heap).not.toBeNull();
    expect(l.heap!.t).toBeLessThanOrEqual(l.root.t + IDLE.jamSeconds.value + 1);
    // 0.125 slag/s for 2 h is 900 slag, 400 of it room: two more heaps keep it running
    expect(l.fix).toBe('2 more Slag Heaps keep it running 2h');
    expect(l.cause).toBe('its Slag Heap filled');
    expect(l.stopKeeps).toMatch(/53m \d\ds of running/);
    expect(rep.firstJam?.x).toBe(3);
  });

  it('a jam that is not a heap filling buys nothing by stopping, and says what to build instead', () => {
    // the furnace's slag out of its north side by belt into the Dock (row 1), which takes it only for
    // the Committee's order: once The Pile fills, the Dock refuses slag and the line stops
    const g = new Game(7);
    g.s.coin = N(1e6);
    g.s.upgrades.push('bellows');
    must(g, { k: 'place', kind: 'miner', x: 2, y: 3, rot: 0 });
    must(g, { k: 'remove', x: 3, y: 4 });
    must(g, { k: 'place', kind: 'belt', x: 3, y: 2, rot: 3 });
    for (const x of [3, 4, 5]) must(g, { k: 'place', kind: 'belt', x, y: 1, rot: 0 });
    g.s.orders.active = 'thePile';
    // The Pile wants 800 since the reset-layer review round: 100 in, 700 to go
    g.s.orders.progress.thePile = { slag: N(100) };
    const live = copyGame(g);
    // 700 slag at 0.125/s: 450 in the replayed hour, the rest in the first extrapolated segment
    const rep = runOffline(g, 8 * 3600, { eff: 1 });
    expect(rep.orders).toContain('thePile');
    const l = rep.lines.find((x) => x.root.why === 'slag')!;
    expect(l).toBeDefined();
    expect(l.cause).toBe('the Dock stopped taking slag (The Pile filled)');
    expect(l.heap).toBeNull();
    expect(l.stopKeeps).toBeNull();
    expect(l.root.t / 3600).toBeGreaterThan(1.4);
    expect(l.root.t / 3600).toBeLessThan(1.8);
    // the segment ended when the order filled, so the stopped line is not paid on (DESIGN.md §12)
    expect(rep.segments).toBeGreaterThanOrEqual(1);
    live.s.visible = false;
    const e0 = live.s.earned.toNumber();
    live.step(8 * 3600 * TICK_RATE);
    const idle = live.s.earned.toNumber() - e0;
    expect(rep.coin.toNumber()).toBeLessThanOrEqual(idle * 1.01);
    expect(rep.coin.toNumber()).toBeGreaterThan(idle * 0.9);
  });

  it('finds a heap filling past the replay hour, re-measures, and pays the jammed line nothing after', () => {
    const g = furnaceLine(2);
    const live = copyGame(g);
    const rep = runOffline(g, 4 * 3600, { eff: 1 });
    // two heaps: 800 slag, about 107 min; the second fills in an extrapolated segment
    expect(rep.segments).toBeGreaterThanOrEqual(1);
    // both heaps are the one line's cause: one row, at the second heap's filling (worked out from
    // the rates), with the room of both
    expect(rep.timeline.filter((e) => e.kind === 'heap')).toHaveLength(0);
    const jam = rep.timeline.find((e) => e.kind === 'jam' && e.text.startsWith('Hand Furnace'))!;
    expect(jam).toBeDefined();
    expect(jam.t / 60).toBeGreaterThan(90);
    expect(jam.t / 60).toBeLessThan(125);
    expect(jam.est).toBe(true);
    expect(rep.lines[0].heap!.room).toBe(800);
    // at efficiency 1 the model pays what the same 4 h live pays, never more
    const e0 = live.s.earned.toNumber();
    live.s.visible = false;
    live.step(4 * 3600 * TICK_RATE);
    const idle = live.s.earned.toNumber() - e0;
    expect(rep.coin.toNumber()).toBeLessThanOrEqual(idle * 1.01);
    expect(rep.coin.toNumber()).toBeGreaterThan(idle * 0.9);
  });

  it('counts at most 7 days, and no Spark appears while away', () => {
    const g = furnaceLine();
    const rep = runOffline(g, 30 * 86400);
    expect(rep.counted).toBe(RULES.offlineCapHours.value * 3600);
    expect(rep.counted).toBe(7 * 86400);
    expect(g.s.counters.sparks ?? 0).toBe(0);
    expect(g.s.sparks.length).toBe(0);
    expect(g.s.visible).toBe(true);
  });

  it('pays the extrapolated part at the offline efficiency', () => {
    // a Miner whose ore belts straight into the Dock: nothing to jam, 30 ore (30 coin) a minute
    const ore = () => {
      const g = new Game(5);
      g.s.coin = N(1000);
      must(g, { k: 'place', kind: 'miner', x: 2, y: 2, rot: 3 });
      for (let x = 2; x < 6; x++) must(g, { k: 'place', kind: 'belt', x, y: 1, rot: 0 });
      return g;
    };
    const half = runOffline(ore(), 2 * 3600, { eff: 0.5 }).coin.toNumber();
    const full = runOffline(ore(), 2 * 3600, { eff: 1 }).coin.toNumber();
    // the first hour replayed in full (1,800), the second at the efficiency
    expect(full).toBeGreaterThan(3540);
    expect(full).toBeLessThan(3610);
    expect(full - half).toBeGreaterThan(870);
    expect(full - half).toBeLessThan(910);
  });

  it('the forecast is the same computation on a copy: the live game is untouched', () => {
    const g = furnaceLine();
    g.step(60 * TICK_RATE);
    const before = fingerprint(g);
    const job = forecast(g, 2);
    let frames = 0;
    while (!job.step(IDLE.jobChunkTicks.value)) frames++;
    expect(frames).toBeGreaterThan(10);
    expect(fingerprint(g)).toBe(before);
    const rep = runOffline(copyGame(g), 2 * 3600);
    expect(job.report!.coin.toString()).toBe(rep.coin.toString());
    expect(job.report!.timeline.map((e) => e.text + e.t)).toEqual(rep.timeline.map((e) => e.text + e.t));
  });

  it('a stopped line is not a jam in the forecast, and its heap keeps its room', () => {
    const g = furnaceLine();
    must(g, { k: 'pause', x: 3, y: 3, line: true, on: true });
    const rep = forecast(g, 8);
    rep.step();
    expect(rep.report!.jams).toBe(0);
    expect(rep.report!.timeline.filter((e) => e.kind === 'heap')).toHaveLength(0);
  });

  it('runs in slices with the same result as all at once', () => {
    const a = furnaceLine(2), b = furnaceLine(2);
    const ra = runOffline(a, 3 * 3600);
    const run = new OfflineRun(b, 3 * 3600);
    while (!run.step(997)) { /* frames */ }
    expect(run.report!.coin.toString()).toBe(ra.coin.toString());
    expect(fingerprint(a)).toBe(fingerprint(b));
  });

  it('a save made after the run restores to the same state', () => {
    const g = furnaceLine();
    runOffline(g, 3 * 3600);
    const c = restore({ seed: g.s.seed, snap: JSON.stringify(g.s), snapTick: g.s.tick, log: [], tick: g.s.tick });
    expect(fingerprint(c)).toBe(fingerprint(g));
    expect(Num.of(1).format()).toBe('1');
  });
});
