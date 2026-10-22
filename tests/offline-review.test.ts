// The offline fixes after the Acts IV-V review (DECISIONS.md "Fixes after the review: offline",
// DESIGN.md §20): the Standing Committee never Reorganizes while away and the report says when it
// would have; the report sees the high floors (a module that stopped, a route short of carriers);
// and the replay is shortened by a deterministic compute budget, a tick's cost estimated from the
// number of things that tick.
import { describe, expect, it } from 'vitest';
import { Game, type Cmd } from '../src/sim/Game';
import { N, Num } from '../src/engine/num';
import { RESEARCH_IDS } from '../src/data/research';
import { CHUNKS } from '../src/data/land';
import { HIGH } from '../src/data/floors';
import { RULES } from '../src/data/rules';
import { IDLE } from '../src/data/idle';
import { LEGACY, type LegacyId } from '../src/data/legacy';
import { TICK_RATE } from '../src/engine/time';
import { runOffline, tickCostMs, tickLoad, OfflineRun } from '../src/sim/offline';
import { previewPatents } from '../src/sim/reorganize';
import { routeCap, routeWant, skiffRateNow, routeDist, hent } from '../src/sim/systems/high';
import { standingDue } from '../src/sim/systems/automation';
import type { ModuleDesign } from '../src/sim/world';

function sandbox(seed = 1) {
  const g = new Game(seed);
  g.s.coin = N(1e9);
  g.s.land = CHUNKS.map((c) => c.id);
  g.s.research.done = [...RESEARCH_IDS];
  g.s.upgrades.push('bellows');
  g.s.mega.stage = 3;
  g.s.flags.push('factoryOpen');
  g.s.ents = g.s.ents.filter((e) => e.kind === 'dock' || e.kind === 'hopper' || e.kind === 'furnace');
  g.rebuild();
  g.step(1);
  return g;
}

function must(g: Game, c: Cmd) {
  const r = g.act(c);
  if (!r.ok) throw new Error(`${JSON.stringify(c)}: ${r.why}`);
}

function design(g: Game, over: Partial<ModuleDesign>): ModuleDesign {
  const d: ModuleDesign = {
    id: g.s.nextDesign++, name: 'D', box: { x: 0, y: 0, w: 2, h: 1 }, parts: [], ins: {}, outs: {},
    grade: { letter: 'B', score: 0.7, u: 1, w: 1, c: 1, mult: 1 }, bill: 1000, stamped: 0, spare: 40, depth: 2, ...over,
  };
  g.s.designs.push(d);
  return d;
}

function legacy(g: Game, ...ids: LegacyId[]) {
  g.s.meta.legacy = (g.s.meta.legacy ?? Num.ZERO).add(ids.reduce((t, id) => t + LEGACY[id].cost, 0));
  for (const id of ids) must(g, { k: 'legacy', id });
}

const DK = HIGH.district.dock;

describe('the Standing Committee while away (the Acts IV-V review, blocking 1)', () => {
  /** The critic's case, built: the Clerk and the Committee bought, its number reached. */
  function committee() {
    const g = sandbox();
    legacy(g, 'patentClerk', 'standingCommittee');
    must(g, { k: 'standing', at: 1 });
    design(g, { outs: { gear: 1 }, grade: { letter: 'S', score: 0.95, u: 1, w: 1, c: 1, mult: 2 } });
    expect(previewPatents(g).now).toBeGreaterThanOrEqual(1);
    expect(standingDue(g)).not.toBeNull();
    return g;
  }

  it('never Reorganizes in an offline replay; the report says when it would have, and at how many Patents', () => {
    const g = committee();
    const runs = g.s.meta.runs, designs = g.s.designs.length, coin = g.s.coin;
    const rep = runOffline(g, 8 * 3600);
    expect(g.s.meta.runs).toBe(runs);
    expect(g.s.designs.length).toBe(designs);
    // the time away was paid into this run, not a fresh one (the critic's "coin -21.3M")
    expect(rep.coin.gte(0)).toBe(true);
    expect(g.s.coin.gte(coin)).toBe(true);
    expect(rep.committee).not.toBeNull();
    expect(rep.committee!.patents).toBeGreaterThanOrEqual(1);
    expect(rep.committee!.at).toBe(1);
    expect(rep.committee!.t).toBeLessThanOrEqual(RULES.standingEvery.value);
    const row = rep.timeline.find((e) => e.kind === 'committee');
    expect(row?.text).toMatch(/would have reorganized at \d+ Patents/);
    // back in the game (visible again), it fires at its next check
    expect(g.s.visible).toBe(true);
    g.step(RULES.standingEvery.value * TICK_RATE + 1);
    expect(g.s.meta.runs).toBe(runs + 1);
  });

  it('holds in a hidden tab too, and fires once the tab is seen again', () => {
    const g = committee();
    const runs = g.s.meta.runs;
    must(g, { k: 'visible', v: false });
    g.step(5 * RULES.standingEvery.value * TICK_RATE);
    expect(g.s.meta.runs).toBe(runs);
    must(g, { k: 'visible', v: true });
    g.step(RULES.standingEvery.value * TICK_RATE + 1);
    expect(g.s.meta.runs).toBe(runs + 1);
  });

  it('no Committee, or its number not reached: no row', () => {
    const g = sandbox();
    design(g, { outs: { gear: 1 }, grade: { letter: 'S', score: 0.95, u: 1, w: 1, c: 1, mult: 2 } });
    expect(runOffline(g, 3600).committee).toBeNull();
    const h = committee();
    must(h, { k: 'standing', at: 1000 });
    expect(runOffline(h, 3600).committee).toBeNull();
  });
});

describe('the offline report sees the high floors (the Acts IV-V review)', () => {
  it('a route short of skiffs is a row naming the route and how many skiffs it is short, as the District says', () => {
    const g = sandbox();
    const d = design(g, { name: 'Steel works II', outs: { steel: 1 } });
    // across the floor from the Dock on one skiff: it carries a fraction of the 1 a second made
    must(g, { k: 'hplace', floor: 'district', design: d.id, x: 0, y: DK.y });
    must(g, { k: 'route', floor: 'district', fx: 0, fy: DK.y, tx: DK.x, ty: DK.y, item: 'steel' });
    const r = g.s.district!.routes[0];
    const a = hent(g, 'district', r.from)!, b = hent(g, 'district', r.to)!;
    const need = Math.ceil(routeWant(g, 'district', r) / skiffRateNow(g, 'district', routeDist(a, b)));
    expect(routeCap(g, 'district', r)).toBeLessThan(0.9 * routeWant(g, 'district', r));
    g.step(5 * TICK_RATE);
    const rep = runOffline(g, 8 * 3600);
    const line = rep.lines.find((l) => l.route);
    expect(line).toBeTruthy();
    expect(line!.floor).toBe('district');
    expect(line!.root.name).toBe('Steel works II to Dock');
    expect(line!.route!.short).toBe(Math.min(need, 1000) - r.skiffs);
    expect(line!.cause).toBe(`short of ${need - r.skiffs} skiffs`);
    const row = rep.timeline.find((e) => e.kind === 'route');
    expect(row?.text).toMatch(/Steel works II to Dock route was short of \d+ skiffs the whole time/);
    expect(row?.floor).toBe('district');
    expect(row?.line).toBe(rep.lines.indexOf(line!));
  });

  it('a District module that stops while away is a row: its cause and a fix, named like the District\'s report', () => {
    const g = sandbox();
    // a gear group routed into one that takes a tenth of them: it backs up as soon as the buffer fills
    const a = design(g, { name: 'Gears II', outs: { gear: 1 } });
    const b = design(g, { name: 'Servos II', ins: { gear: 0.1 }, outs: { servo: 0.1 } });
    must(g, { k: 'hplace', floor: 'district', design: a.id, x: DK.x - 2, y: DK.y });
    must(g, { k: 'hplace', floor: 'district', design: b.id, x: DK.x - 1, y: DK.y });
    must(g, { k: 'route', floor: 'district', fx: DK.x - 2, fy: DK.y, tx: DK.x - 1, ty: DK.y, item: 'gear' });
    must(g, { k: 'route', floor: 'district', fx: DK.x - 1, fy: DK.y, tx: DK.x, ty: DK.y, item: 'servo' });
    for (const r of g.s.district!.routes) for (let i = 0; i < 4; i++) must(g, { k: 'skiff', floor: 'district', id: r.id, n: 1 });
    const rep = runOffline(g, 3600);
    const line = rep.lines.find((l) => l.floor === 'district' && !l.route);
    expect(line).toBeTruthy();
    expect(line!.root.name).toBe('Gears II');
    expect(line!.cause).toBe('Servos II takes no more gears');
    expect(line!.fix).toBe('a route taking the rest of its gears to the Dock');
    const row = rep.timeline.find((e) => e.kind === 'jam' && e.floor === 'district');
    expect(row?.text).toMatch(/Gears II's line stopped: Servos II takes no more gears \(1 module\)/);
  });
});

describe('the compute budget (the Acts IV-V review: the replay cost 24-38 s)', () => {
  it('a tick\'s cost is estimated from what ticks, never a clock', () => {
    const g = sandbox();
    const c0 = tickCostMs(g);
    expect(c0).toBeCloseTo(IDLE.tickBaseMs.value + tickLoad(g).workshop * IDLE.tickWorkshopMs.value, 9);
    const d = design(g, { outs: { steel: 1 } });
    must(g, { k: 'hplace', floor: 'district', design: d.id, x: 0, y: 0 });
    must(g, { k: 'route', floor: 'district', fx: 0, fy: 0, tx: DK.x, ty: DK.y, item: 'steel' });
    expect(tickLoad(g).high).toBe(2);
    expect(tickCostMs(g)).toBeCloseTo(c0 + 2 * IDLE.tickHighMs.value, 9);
  });

  it('a small factory still replays the whole first hour', () => {
    const g = sandbox();
    must(g, { k: 'place', kind: 'miner', x: 2, y: 3, rot: 0 });
    const run = new OfflineRun(g, 8 * 3600);
    expect(run.firstReplay).toBe(3600);
    run.step();
    expect(run.report!.replayed).toBeGreaterThanOrEqual(3600);
  });

  it('a big floor replays a shorter window, the same one every time, and the budget holds', () => {
    const big = () => {
      const g = sandbox();
      g.s.district!.lots = 3;
      const d = design(g, { outs: { steel: 0.05 }, spare: 1000 });
      // a District packed with groups, each routed to the Dock, and a stack more listed as ticking
      for (let y = 0; y < HIGH.district.h; y++)
        for (let x = 0; x < 10; x++) {
          if (g.act({ k: 'hplace', floor: 'district', design: d.id, x, y }).ok) g.act({ k: 'route', floor: 'district', fx: x, fy: y, tx: DK.x, ty: DK.y, item: 'steel' });
        }
      return g;
    };
    const g = big();
    const n = tickLoad(g).high;
    expect(n).toBeGreaterThan(150);
    const run = new OfflineRun(g, 8 * 3600);
    const ms = tickCostMs(g);
    const afford = Math.floor((IDLE.replayBudgetMs.value / ms) * IDLE.replayShare.value);
    expect(run.firstReplay).toBe(Math.max(IDLE.replayMinSeconds.value * TICK_RATE, Math.min(3600 * TICK_RATE, afford)) / TICK_RATE);
    expect(run.firstReplay).toBeLessThan(3600);
    run.step();
    const rep = run.report!;
    expect(rep.budget.tickMs).toBeCloseTo(ms, 9);
    // paid honestly: the replayed part in full, the rest at e, all of the time away accounted for
    expect(rep.replayed + rep.extrapolated).toBeCloseTo(8 * 3600, 3);
    expect(rep.replayed).toBeLessThan(3600);
    // the same window and the same pay on a second run (deterministic: no clock)
    const again = runOffline(big(), 8 * 3600);
    expect(again.replayed).toBe(rep.replayed);
    expect(again.coin.eq(rep.coin)).toBe(true);
  });
});
