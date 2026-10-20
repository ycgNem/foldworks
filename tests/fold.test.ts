// Folding and the Factory floor (ROADMAP.md Milestone 2, DESIGN.md §10-§11): the audit's port
// counts and grade, refusals, the fold itself (machines in, belts refunded), stamp costs, unfold,
// modules as rate functions on trunk belts, the slice's end, and the v1 -> v2 save migration.
import { describe, expect, it } from 'vitest';
import { Game, type Cmd } from '../src/sim/Game';
import { N } from '../src/engine/num';
import { RESEARCH_IDS } from '../src/data/research';
import { CHUNKS } from '../src/data/land';
import { RULES } from '../src/data/rules';
import { TICK_RATE } from '../src/engine/time';
import { auditTicks, foldRefusal } from '../src/sim/systems/audits';
import { stampCost } from '../src/sim/systems/modules';
import { restore, savePayload } from '../src/sim/snapshot';
import { migrate } from '../src/engine/save';
import { runOffline } from '../src/sim/offline';
import type { Dir } from '../src/sim/world';

/** Everything unlocked, all land, plenty of coin, and only the fixed buildings on the floor. */
function sandbox(seed = 1) {
  const g = new Game(seed);
  g.s.coin = N(1e7);
  g.s.land = CHUNKS.map((c) => c.id);
  g.s.research.done = [...RESEARCH_IDS];
  g.s.upgrades.push('bellows');
  g.s.ents = g.s.ents.filter((e) => e.kind === 'dock' || e.kind === 'hopper' || e.kind === 'furnace');
  g.rebuild();
  return g;
}

function must(g: Game, c: Cmd) {
  const r = g.act(c);
  if (!r.ok) throw new Error(`${JSON.stringify(c)}: ${r.why}`);
}

function belt(g: Game, x0: number, y0: number, n: number, rot: Dir) {
  const dx = [1, 0, -1, 0][rot], dy = [0, 1, 0, -1][rot];
  for (let i = 0; i < n; i++) must(g, { k: 'place', kind: 'belt', x: x0 + dx * i, y: y0 + dy * i, rot });
}

/**
 * An iron line on chunk C's patch: a Miner at (2,11) into a Smelter at (3,11), ingots out east to
 * the Dock. Slag leaves the Smelter's south side: into a heap inside the box (slagPort = false), or
 * onto a belt that leaves the box to a heap outside (slagPort = true). The box is (2,11) 2x2.
 */
function ironLine(slagPort: boolean) {
  const g = sandbox();
  must(g, { k: 'place', kind: 'miner', x: 2, y: 11, rot: 0 });
  must(g, { k: 'place', kind: 'smelter', x: 3, y: 11, rot: 0 });
  if (slagPort) {
    must(g, { k: 'place', kind: 'belt', x: 3, y: 12, rot: 1 });
    must(g, { k: 'place', kind: 'heap', x: 3, y: 13, rot: 1 });
  } else must(g, { k: 'place', kind: 'heap', x: 3, y: 12, rot: 1 });
  // ingots: east along row 11 to x=5, north up x=5 to row 2, east into the Dock at (6,2)
  belt(g, 4, 11, 1, 0);
  belt(g, 5, 11, 9, 3);
  belt(g, 5, 2, 1, 0);
  return g;
}

function auditAndWait(g: Game, box = { x: 2, y: 11, w: 2, h: 2 }) {
  g.step(30 * TICK_RATE); // let the line fill first
  must(g, { k: 'audit', ...box });
  g.step(auditTicks());
  return g.s.audit!;
}

describe('the fold audit', () => {
  it('runs 70 s, counts ports, and grades a line whose slag leaves by a port as S', () => {
    const g = ironLine(true);
    const a = auditAndWait(g);
    expect(RULES.auditWarmup.value + RULES.auditWindow.value).toBe(70);
    expect(a.result).not.toBeNull();
    const r = a.result!;
    // a Miner and a Smelter at 30/min: 0.5 ingots/s out, 1 slag per 4 ingots out the port
    expect(r.outs.ironIngot!).toBeGreaterThan(0.45);
    expect(r.outs.ironIngot!).toBeLessThan(0.55);
    expect(r.outs.slag!).toBeGreaterThan(0.1);
    expect(r.ins).toEqual({});
    expect(r.grade.u).toBeGreaterThan(0.95);
    expect(r.grade.w).toBe(1);
    // 2 machine tiles in 4: C = 0.5 / 0.6
    expect(r.grade.c).toBeCloseTo(0.5 / 0.6, 5);
    expect(r.grade.letter).toBe('S');
  });

  it('marks slag dumped in a heap inside the box as waste, and says so', () => {
    const g = ironLine(false);
    const r = auditAndWait(g).result!;
    expect(r.byMade).toBeGreaterThan(0);
    expect(r.grade.w).toBe(0);
    expect(r.grade.letter).toBe('B');
    expect(r.advice.some((l) => /slag/.test(l))).toBe(true);
  });

  it('refuses boxes it cannot fold, with reasons', () => {
    const g = ironLine(true);
    expect(foldRefusal(g, { x: 0, y: 8, w: 9, h: 2 })).toMatch(/at most 8x8/);
    expect(foldRefusal(g, { x: 6, y: 1, w: 2, h: 2 })).toMatch(/Dock/);
    expect(foldRefusal(g, { x: 9, y: 9, w: 2, h: 2 })).toMatch(/No machines/);
    g.s.research.done = g.s.research.done.filter((r) => r !== 'folding');
    expect(foldRefusal(g, { x: 2, y: 11, w: 2, h: 2 })).toMatch(/Folding/);
  });

  it('locks the box while it runs, and can be cancelled', () => {
    const g = ironLine(true);
    must(g, { k: 'audit', x: 2, y: 11, w: 2, h: 2 });
    expect(g.act({ k: 'remove', x: 3, y: 11 }).why).toMatch(/Auditing/);
    expect(g.act({ k: 'rotate', x: 3, y: 11 }).ok).toBe(false);
    expect(g.act({ k: 'place', kind: 'belt', x: 3, y: 12, rot: 0 }).ok).toBe(false);
    must(g, { k: 'auditCancel' });
    expect(g.s.audit).toBeNull();
    must(g, { k: 'rotate', x: 3, y: 12 });
  });
});

describe('fold, stamp, unfold', () => {
  it('folds the line into a module: machines inside, belts refunded, box empty', () => {
    const g = ironLine(true);
    auditAndWait(g);
    const before = g.s.coin;
    must(g, { k: 'fold', name: null });
    expect(g.s.audit).toBeNull();
    expect(g.s.designs).toHaveLength(1);
    const d = g.s.designs[0];
    expect(d.spare).toBe(1);
    expect(d.bill).toBe(100); // Miner 40 + Smelter 60
    expect(g.s.coin.sub(before).toNumber()).toBe(1); // one belt refunded
    expect(d.outs.ironIngot!).toBeCloseTo(g.s.designs[0].outs.ironIngot!, 9);
    expect(d.outs.ironIngot! / 0.5).toBeGreaterThan(1.2); // x1.25 for an S
    expect(d.name).toMatch(/Iron ingot/);
    for (let y = 11; y < 13; y++) for (let x = 2; x < 4; x++) expect(g.entAt(x, y)).toBeNull();
    expect(g.flag('factoryOpen')).toBe(true);
  });

  it('stamps copies at bill x (1 + 0.5 n): the 5th costs 3x the first', () => {
    const g = ironLine(true);
    auditAndWait(g);
    must(g, { k: 'fold', name: 'Ingots' });
    const d = g.s.designs[0];
    const costs: number[] = [];
    for (let i = 0; i < 5; i++) {
      costs.push(stampCost(g, d).toNumber());
      must(g, { k: 'stamp', id: d.id });
    }
    expect(costs).toEqual([100, 150, 200, 250, 300]);
    expect(d.spare).toBe(6);
  });

  it('unfolds a spare copy back where it was folded', () => {
    const g = ironLine(true);
    auditAndWait(g);
    must(g, { k: 'fold', name: null });
    const d = g.s.designs[0];
    must(g, { k: 'unfold', id: d.id });
    expect(d.spare).toBe(0);
    expect(g.entAt(2, 11)?.kind).toBe('miner');
    expect(g.entAt(3, 11)?.kind).toBe('smelter');
    expect(g.entAt(3, 12)?.kind).toBe('belt');
    expect(g.act({ k: 'unfold', id: d.id }).why).toMatch(/No spare/);
  });
});

describe('the Factory floor', () => {
  function factory() {
    const g = ironLine(true);
    auditAndWait(g);
    must(g, { k: 'fold', name: null });
    return { g, d: g.s.designs[0] };
  }

  it('runs a module as a rate: its ingots reach the Factory Dock along a trunk', () => {
    const { g, d } = factory();
    must(g, { k: 'fplace', design: d.id, x: 2, y: 2, rot: 0 });
    for (let x = 3; x < 10; x++) must(g, { k: 'ftrunk', x, y: 2, rot: 0 });
    expect(g.routes[0].to?.kind).toBe('fdock');
    // the Workshop belts left outside the box still carry a few ingots: let them land first
    g.step(20 * TICK_RATE);
    const ing0 = g.s.delivered.ironIngot?.toNumber() ?? 0;
    const coin0 = g.s.coin.toNumber();
    g.step(60 * TICK_RATE);
    const per = d.outs.ironIngot! * 60;
    const got = (g.s.delivered.ironIngot?.toNumber() ?? 0) - ing0;
    expect(got).toBeGreaterThan(per - 2);
    expect(got).toBeLessThan(per + 1);
    expect(g.s.coin.toNumber() - coin0).toBeGreaterThan((per - 2) * 3);
    const m = g.s.factory.ents.find((e) => e.kind === 'module')!;
    expect(m.state).toBe('work');
  });

  it('blocks a module whose trunk goes nowhere, and names the item', () => {
    const { g, d } = factory();
    must(g, { k: 'fplace', design: d.id, x: 2, y: 2, rot: 0 });
    g.step(10 * TICK_RATE);
    const m = g.s.factory.ents.find((e) => e.kind === 'module')!;
    expect(m.state).toBe('blocked');
    expect(m.why).toBeTruthy();
  });

  it('caps a trunk at 8 items/s', () => {
    const { g, d } = factory();
    g.s.claimBlocks.ironOre = 10; // 21 copies of an iron source need claims (DESIGN.md §18)
    for (let i = 0; i < 20; i++) must(g, { k: 'stamp', id: d.id });
    // 18 modules (about 0.78 items/s each) on both sides of one trunk: more than 8/s
    for (let x = 1; x < 10; x++) must(g, { k: 'fplace', design: d.id, x, y: 3, rot: 3 });
    for (let x = 1; x < 10; x++) must(g, { k: 'fplace', design: d.id, x, y: 1, rot: 1 });
    for (let x = 1; x < 10; x++) must(g, { k: 'ftrunk', x, y: 2, rot: 0 });
    g.step(30 * TICK_RATE);
    const end = g.fentAt(9, 2)!;
    expect(end.flow).toBeLessThanOrEqual(8 + 1e-6);
    expect(end.flow).toBeGreaterThan(7.5);
  });

  it('does not end the slice for three copies of one module beside the Dock', () => {
    const { g, d } = factory();
    must(g, { k: 'stamp', id: d.id });
    must(g, { k: 'stamp', id: d.id });
    for (const y of [0, 1, 2]) {
      must(g, { k: 'fplace', design: d.id, x: 2, y, rot: 0 });
      for (let x = 3; x < 10; x++) must(g, { k: 'ftrunk', x, y, rot: 0 });
    }
    must(g, { k: 'ftrunk', x: 9, y: 0, rot: 1 });
    g.step(60 * TICK_RATE);
    expect(g.flag('sliceEnd')).toBe(false);
  });

  /** Three designs making three products, chained ingots -> plates -> gears into the Dock; the
   * source's slag leaves by a side trunk of its own (the module byproduct side). */
  function chain() {
    const { g, d } = factory();
    const a = d.outs.ironIngot!;
    const mk = (id: number, name: string, ins: Record<string, number>, outs: Record<string, number>) => {
      g.s.designs.push({ ...d, id, name, ins, outs, parts: [{ kind: 'press', dx: 0, dy: 0, rot: 0, recipe: null }], bill: 150, stamped: 0, spare: 1 });
      g.s.nextDesign = id + 1;
    };
    mk(2, 'Plates', { ironIngot: a * 0.9 }, { ironPlate: a * 0.9 });
    mk(3, 'Gears', { ironPlate: a * 0.8 }, { gear: a * 0.4 });
    must(g, { k: 'fplace', design: d.id, x: 2, y: 1, rot: 0 });
    must(g, { k: 'fplace', design: 2, x: 3, y: 1, rot: 0 });
    must(g, { k: 'fplace', design: 3, x: 4, y: 1, rot: 0 });
    for (let x = 5; x < 10; x++) must(g, { k: 'ftrunk', x, y: 1, rot: 0 });
    // slag: out of the source's south side, along row 3, up and into the Dock's lower half
    must(g, { k: 'ftrunk', x: 2, y: 2, rot: 1 });
    for (let x = 2; x < 9; x++) must(g, { k: 'ftrunk', x, y: 3, rot: 0 });
    must(g, { k: 'ftrunk', x: 9, y: 3, rot: 3 });
    must(g, { k: 'ftrunk', x: 9, y: 2, rot: 0 });
    return g;
  }

  it("sends a module's byproducts out of its side trunk, so it can feed another module", () => {
    const g = chain();
    g.step(40 * TICK_RATE);
    const src = g.s.factory.ents.find((e) => e.kind === 'module' && e.design === 1)!;
    expect(src.why).not.toBe('slag'); // held back only by the press module's pace, never by slag
    expect(src.fAvg).toBeGreaterThan(0.7);
    expect(g.routes.some((r) => r.by && r.from === src && r.to?.kind === 'fdock')).toBe(true);
    expect((g.s.delivered.gear?.toNumber() ?? 0)).toBeGreaterThan(0);
  });

  it('ends the slice when three products run chained into the Factory Dock for 30 s', () => {
    const g = chain();
    g.events.drain();
    g.step(50 * TICK_RATE);
    expect(g.flag('sliceEnd')).toBe(true);
    expect(g.events.drain().some((e) => e.type === 'sliceEnd')).toBe(true);
  });

  it('saves and restores the Factory floor exactly', () => {
    const { g, d } = factory();
    must(g, { k: 'fplace', design: d.id, x: 2, y: 2, rot: 0 });
    for (let x = 3; x < 10; x++) must(g, { k: 'ftrunk', x, y: 2, rot: 0 });
    g.step(200);
    const p = savePayload(g, 0);
    const h = restore(p);
    g.step(400);
    h.step(400);
    expect(JSON.stringify(h.s)).toBe(JSON.stringify(g.s));
  });
});

describe('saves from before Milestone 2', () => {
  it('migrate v1 -> v2 with an empty Factory floor', () => {
    const g = new Game(3);
    g.step(100);
    const p = savePayload(g, 0);
    const st = JSON.parse(p.snap);
    delete st.audit;
    delete st.designs;
    delete st.nextDesign;
    delete st.factory;
    const v1 = { ...p, snap: JSON.stringify(st), v: 1 };
    const d = migrate(v1) as unknown as typeof p;
    const h = restore(d);
    expect(h.s.factory.ents.map((e) => e.kind)).toEqual(['fdock', 'fhopper']);
    expect(h.s.designs).toEqual([]);
    h.step(100);
  });
});

describe('offline v1', () => {
  it('replays an hour, extrapolates the rest at half rate, and reports', () => {
    const g = ironLine(true);
    auditAndWait(g);
    must(g, { k: 'fold', name: null });
    const d = g.s.designs[0];
    must(g, { k: 'fplace', design: d.id, x: 2, y: 2, rot: 0 });
    for (let x = 3; x < 10; x++) must(g, { k: 'ftrunk', x, y: 2, rot: 0 });
    g.step(20 * TICK_RATE);
    const r = runOffline(g, 2 * 3600);
    expect(r.replayed).toBe(3600);
    expect(r.extrapolated).toBe(2 * 3600 - 3600);
    // ingots: 3,600 s at the full rate, then 3,600 s at half, 3 coin each
    const rate = d.outs.ironIngot!;
    const expectCoin = (3600 * rate + 3600 * rate * 0.5) * 3;
    expect(r.coin.toNumber()).toBeGreaterThan(expectCoin * 0.95);
    expect(r.coin.toNumber()).toBeLessThan(expectCoin * 1.05);
    expect(r.firstJam).toBeNull();
  });

  it('names the first jam in the replay', () => {
    const g = sandbox();
    must(g, { k: 'place', kind: 'miner', x: 2, y: 11, rot: 0 });
    must(g, { k: 'place', kind: 'smelter', x: 3, y: 11, rot: 0 });
    belt(g, 4, 11, 1, 0);
    belt(g, 5, 11, 9, 3);
    belt(g, 5, 2, 1, 0);
    const r = runOffline(g, 3600);
    expect(r.firstJam).not.toBeNull();
    expect(r.firstJam!.name).toMatch(/Smelter/);
    expect(r.firstJam!.why).toBe('slag');
    expect(r.firstJam!.t).toBeLessThan(180);
  });

  it('caps time away at 24 h', () => {
    const g = sandbox();
    const r = runOffline(g, 100 * 3600);
    expect(r.counted).toBe(24 * 3600);
  });
});
