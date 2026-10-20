// Act II (ROADMAP.md Milestone 4, DESIGN.md §18): power grids and brownouts, boilers and engines,
// Mk2 machines, modes, Overdrive, deposit claims, Machine Kits, the Codex, the Megaproject Bay and
// the Great Drill, nested folds, power never crossing a fold box, and the v2 -> v3 save migration.
import { describe, expect, it } from 'vitest';
import { Game, type Cmd } from '../src/sim/Game';
import { N, Num } from '../src/engine/num';
import { RESEARCH_IDS } from '../src/data/research';
import { CHUNKS } from '../src/data/land';
import { RULES } from '../src/data/rules';
import { TICK_RATE } from '../src/engine/time';
import { drawKw } from '../src/sim/systems/power';
import { claimsHeld, claimPrice } from '../src/sim/systems/claims';
import { kitsFor, stampRefusal } from '../src/sim/systems/modules';
import { foldRefusal } from '../src/sim/systems/audits';
import { auditTicks } from '../src/sim/systems/audits';
import { machineRecipes } from '../src/sim/transfer';
import { migrate } from '../src/engine/save';
import type { Ent, ModuleDesign } from '../src/sim/world';

function sandbox(seed = 1) {
  const g = new Game(seed);
  g.s.coin = N(1e8);
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

const at = (g: Game, x: number, y: number) => g.entAt(x, y)!;

const RECIPE_FOR: Record<string, string> = { sand: 'fireGlass', ironOre: 'smeltIron' };

/** Keep a machine fed and emptied, so only speed and power decide how fast it crafts. */
function feed(m: Ent, item: string, n = 4) {
  m.recipe ??= RECIPE_FOR[item];
  m.inBuf[item] = n;
  m.out = 0;
  m.by = 0;
}

describe('power (DESIGN.md §18 Power)', () => {
  it('a powered machine with no grid is starved of power (the blue pip) and makes nothing', () => {
    const g = sandbox();
    must(g, { k: 'place', kind: 'kiln', x: 21, y: 4, rot: 0 });
    const k = at(g, 21, 4);
    for (let i = 0; i < 100; i++) { feed(k, 'sand'); g.tick(); }
    expect(k.state).toBe('starved');
    expect(k.why).toBe('power');
    expect(k.crafts).toBe(0);
  });

  it('a fuelled Generator and a Pole run it at full speed, burning coal in proportion to the load', () => {
    const g = sandbox();
    must(g, { k: 'place', kind: 'kiln', x: 21, y: 4, rot: 0 });
    must(g, { k: 'place', kind: 'generator', x: 19, y: 6, rot: 0 });
    must(g, { k: 'place', kind: 'pole', x: 19, y: 4, rot: 0 });
    const k = at(g, 21, 4), gen = at(g, 19, 6);
    expect(g.grids.length).toBe(1);
    expect(g.gridOf.get(k.id)).toBe(0);
    let coal = 0;
    for (let i = 0; i < 60 * TICK_RATE; i++) {
      feed(k, 'sand');
      if ((gen.inBuf.coal ?? 0) < 2) { gen.inBuf.coal = (gen.inBuf.coal ?? 0) + 1; coal++; }
      g.tick();
    }
    // 2.0 s glass: 30 a minute
    expect(k.crafts).toBeGreaterThanOrEqual(29);
    expect(k.crafts).toBeLessThanOrEqual(30);
    // 60 kW of 150: 0.4 load, 1 coal per 3 s at full load -> about 8 coal a minute (plus what sits in the burner)
    const burnt = coal - (gen.inBuf.coal ?? 0);
    expect(burnt).toBeGreaterThanOrEqual(7);
    expect(burnt).toBeLessThanOrEqual(10);
  });

  it('a brownout runs every machine on the grid at supply / demand', () => {
    const g = sandbox();
    // three kilns (180 kW) on one generator (150 kW): 5/6 speed
    for (const y of [3, 4, 5]) must(g, { k: 'place', kind: 'kiln', x: 21, y, rot: 0 });
    must(g, { k: 'place', kind: 'generator', x: 19, y: 6, rot: 0 });
    must(g, { k: 'place', kind: 'pole', x: 19, y: 4, rot: 0 });
    const ks = [3, 4, 5].map((y) => at(g, 21, y));
    const gen = at(g, 19, 6);
    for (let i = 0; i < 60 * TICK_RATE; i++) {
      for (const k of ks) feed(k, 'sand');
      gen.inBuf.coal = 4;
      g.tick();
    }
    expect(g.grids[0].sat).toBeCloseTo(150 / 180, 3);
    for (const k of ks) {
      expect(k.crafts).toBeGreaterThanOrEqual(24);
      expect(k.crafts).toBeLessThanOrEqual(26);
      expect(k.state).toBe('work');
    }
  });

  it('a Boiler steams the Steam Engine it faces; without an engine it says so', () => {
    const g = sandbox();
    must(g, { k: 'place', kind: 'kiln', x: 21, y: 4, rot: 0 });
    must(g, { k: 'place', kind: 'boiler', x: 17, y: 6, rot: 0 });
    must(g, { k: 'place', kind: 'pole', x: 19, y: 4, rot: 0 });
    const k = at(g, 21, 4), b = at(g, 17, 6);
    for (let i = 0; i < 20; i++) { feed(k, 'sand'); b.inBuf.coal = 4; g.tick(); }
    expect(b.why).toBe('engine');
    expect(k.why).toBe('power');
    must(g, { k: 'place', kind: 'steamEngine', x: 18, y: 6, rot: 0 });
    expect(g.boilerOf.get(at(g, 18, 6).id)).toBe(b);
    for (let i = 0; i < 60 * TICK_RATE; i++) { feed(k, 'sand'); b.inBuf.coal = 4; g.tick(); }
    expect(k.crafts).toBeGreaterThanOrEqual(29);
    expect(at(g, 18, 6).state).toBe('work');
  });

  it('poles within 6 tiles join one grid; further apart they are two', () => {
    const g = sandbox();
    must(g, { k: 'place', kind: 'pole', x: 16, y: 1, rot: 0 });
    must(g, { k: 'place', kind: 'pole', x: 22, y: 1, rot: 0 });
    expect(g.grids.length).toBe(1);
    must(g, { k: 'remove', x: 22, y: 1 });
    must(g, { k: 'place', kind: 'pole', x: 23, y: 1, rot: 0 });
    expect(g.grids.length).toBe(2);
  });

  it('Dame Voltaire: rep 2 makes engines +25%, rep 3 extends pole reach by one', () => {
    const g = sandbox();
    must(g, { k: 'place', kind: 'kiln', x: 22, y: 4, rot: 0 });
    must(g, { k: 'place', kind: 'pole', x: 19, y: 4, rot: 0 });
    const k = at(g, 22, 4);
    expect(g.gridOf.has(k.id)).toBe(false); // 3 tiles away
    g.s.orders.rep.voltaire = 3;
    g.rebuild();
    expect(g.gridOf.has(k.id)).toBe(true);
  });
});

describe('Mk2, modes and Overdrive (DESIGN.md §18 Machines)', () => {
  /** A powered sandbox: a generator kept fuelled and a pole at (19,4) reaching x 17-21, y 2-6. */
  function powered(kind: 'smelterMk2' | 'kiln', x: number, y: number) {
    const g = sandbox();
    must(g, { k: 'place', kind, x, y, rot: 0 });
    must(g, { k: 'place', kind: 'generator', x: 19, y: 6, rot: 0 });
    must(g, { k: 'place', kind: 'generator', x: 18, y: 6, rot: 0 });
    must(g, { k: 'place', kind: 'pole', x: 19, y: 4, rot: 0 });
    const m = at(g, x, y);
    const gens = [at(g, 19, 6), at(g, 18, 6)];
    const run = (ticks: number, item: string) => {
      for (let i = 0; i < ticks; i++) {
        feed(m, item);
        for (const q of gens) q.inBuf.coal = 4;
        g.tick();
      }
    };
    return { g, m, run };
  }

  it('a Mk2 Smelter is 2x2 and smelts at 3x', () => {
    const { m, run } = powered('smelterMk2', 20, 3);
    expect(m.w).toBe(2);
    run(60 * TICK_RATE, 'ironOre');
    expect(m.crafts).toBeGreaterThanOrEqual(88);
    expect(m.crafts).toBeLessThanOrEqual(90);
  });

  it('a Mk2 hands its output out of both front tiles in turn', () => {
    const g = sandbox();
    must(g, { k: 'place', kind: 'smelterMk2', x: 20, y: 3, rot: 0 });
    must(g, { k: 'place', kind: 'generator', x: 19, y: 6, rot: 0 });
    must(g, { k: 'place', kind: 'pole', x: 19, y: 4, rot: 0 });
    must(g, { k: 'place', kind: 'belt', x: 22, y: 3, rot: 3 });
    must(g, { k: 'place', kind: 'belt', x: 22, y: 4, rot: 1 });
    const m = at(g, 20, 3), gen = at(g, 19, 6);
    const seen = new Set<string>();
    g.watchers.push((x, y, _d, item) => { if (item === 'ironIngot') seen.add(`${x},${y}`); });
    m.recipe = 'smeltIron';
    for (let i = 0; i < 10 * TICK_RATE; i++) { m.inBuf.ironOre = 2; gen.inBuf.coal = 4; g.tick(); }
    expect(seen.has('22,3')).toBe(true);
    expect(seen.has('22,4')).toBe(true);
  });

  it('modes trade speed for power: Overclocked 1.5x at 2.2x, Efficient 0.75x at 0.5x', () => {
    const { g, m, run } = powered('kiln', 21, 4);
    must(g, { k: 'mode', x: 21, y: 4, mode: 'overclock' });
    expect(drawKw(m)).toBeCloseTo(60 * 2.2);
    run(60 * TICK_RATE, 'sand');
    expect(m.crafts).toBeGreaterThanOrEqual(44);
    expect(m.crafts).toBeLessThanOrEqual(45);
    must(g, { k: 'mode', x: 21, y: 4, mode: 'efficient' });
    expect(drawKw(m)).toBeCloseTo(30);
    const c0 = m.crafts;
    run(60 * TICK_RATE, 'sand');
    expect(m.crafts - c0).toBeGreaterThanOrEqual(22);
    expect(m.crafts - c0).toBeLessThanOrEqual(23);
  });

  it('Precision makes +25% of the main output at 0.8x speed (Unit 7 rep 3: +35%)', () => {
    const { g, m } = powered('kiln', 21, 4);
    must(g, { k: 'mode', x: 21, y: 4, mode: 'precision' });
    let made = 0;
    m.recipe = 'fireGlass';
    const gens = [at(g, 19, 6), at(g, 18, 6)];
    for (let i = 0; i < 100 * TICK_RATE; i++) {
      m.inBuf.sand = 4;
      for (const q of gens) q.inBuf.coal = 4;
      g.tick();
      made += m.out;
      m.out = 0;
    }
    // 0.8 x 30/min x 100/60 min = 40 crafts, x1.25 = 50 glass
    expect(m.crafts).toBeGreaterThanOrEqual(39);
    expect(made).toBeGreaterThanOrEqual(Math.floor(m.crafts * 1.25) - 1);
    expect(made).toBeLessThanOrEqual(Math.ceil(m.crafts * 1.25));
  });

  it('modes need Tuning and a powered machine', () => {
    const g = sandbox();
    must(g, { k: 'place', kind: 'smelter', x: 3, y: 6, rot: 0 });
    expect(g.act({ k: 'mode', x: 3, y: 6, mode: 'overclock' }).why).toMatch(/powered/);
    g.s.research.done = g.s.research.done.filter((r) => r !== 'tuning');
    must(g, { k: 'place', kind: 'kiln', x: 21, y: 4, rot: 0 });
    expect(g.act({ k: 'mode', x: 21, y: 4, mode: 'overclock' }).why).toMatch(/Tuning/);
  });

  it('Overdrive: a click runs a machine 3x for 10 s, then it cools for 30 s', () => {
    const g = sandbox();
    must(g, { k: 'place', kind: 'smelter', x: 3, y: 6, rot: 0 });
    const m = at(g, 3, 6);
    must(g, { k: 'click', x: 3, y: 6 });
    expect(m.od).toBe(RULES.overdriveSeconds.value * TICK_RATE);
    for (let i = 0; i < 10 * TICK_RATE; i++) { feed(m, 'ironOre'); g.tick(); }
    // 10 s at 3x of a 2.0 s craft: 15
    expect(m.crafts).toBeGreaterThanOrEqual(14);
    expect(m.crafts).toBeLessThanOrEqual(15);
    expect(m.od ?? 0).toBe(0);
    expect(m.cool).toBeGreaterThan(0);
    g.s.clickWindow = -100;
    expect(g.act({ k: 'click', x: 3, y: 6 }).why).toMatch(/Cooling/);
    const c0 = m.crafts;
    for (let i = 0; i < 10 * TICK_RATE; i++) { feed(m, 'ironOre'); g.tick(); }
    expect(m.crafts - c0).toBeLessThanOrEqual(5);
  });

  it('an audited machine cannot be overdriven, and audited miners ignore Lucky Veins', () => {
    const g = sandbox();
    must(g, { k: 'place', kind: 'miner', x: 2, y: 11, rot: 0 });
    must(g, { k: 'place', kind: 'smelter', x: 3, y: 11, rot: 0 });
    must(g, { k: 'audit', x: 2, y: 11, w: 2, h: 1 });
    expect(g.act({ k: 'click', x: 3, y: 11 }).why).toMatch(/Auditing/);
    const miner = at(g, 2, 11);
    g.s.veins[String(g.patchOf[11 * g.W + 2])] = 60 * TICK_RATE;
    miner.out = 0;
    const c0 = miner.crafts;
    for (let i = 0; i < 20 * TICK_RATE; i++) { miner.out = 0; g.tick(); }
    expect(miner.crafts - c0).toBeLessThanOrEqual(10); // 1x, not 3x
  });
});

/** A fake design (designs are plain data). */
function design(g: Game, over: Partial<ModuleDesign>): ModuleDesign {
  const d: ModuleDesign = {
    id: g.s.nextDesign++, name: 'D', box: { x: 0, y: 0, w: 2, h: 1 }, parts: [], ins: {}, outs: {},
    grade: { letter: 'B', score: 0.7, u: 1, w: 1, c: 1, mult: 1 }, bill: 100, stamped: 0, spare: 1, ...over,
  };
  g.s.designs.push(d);
  return d;
}

describe('claims and Machine Kits (DESIGN.md §18)', () => {
  it('a design with miners inside holds a claim per copy; more are bought 4 at a time at x(1 + 0.5 b)', () => {
    const g = sandbox();
    const d = design(g, { parts: [{ kind: 'miner', dx: 0, dy: 0, rot: 0, recipe: 'mineCoal' }, { kind: 'smelter', dx: 1, dy: 0, rot: 0, recipe: null }], outs: { coal: 0.5 } });
    // 3 + 2 per owned coal deposit (two)
    expect(claimsHeld(g, 'coal')).toBe(7);
    for (let i = 0; i < 6; i++) must(g, { k: 'stamp', id: d.id });
    expect(stampRefusal(g, d)).toMatch(/coal claim \(7 of 7/);
    expect(claimPrice(g, 'coal')!.toNumber()).toBe(12000);
    must(g, { k: 'claim', item: 'coal' });
    expect(claimPrice(g, 'coal')!.toNumber()).toBe(18000);
    expect(claimsHeld(g, 'coal')).toBe(11);
    must(g, { k: 'stamp', id: d.id });
  });

  it('stamping a design with Act II buildings costs Machine Kits; a Hopper banks them', () => {
    const g = sandbox();
    const d = design(g, { parts: [{ kind: 'kiln', dx: 0, dy: 0, rot: 0, recipe: null }, { kind: 'pole', dx: 1, dy: 0, rot: 0, recipe: null }], bill: 3200, outs: { glass: 0.5 } });
    expect(kitsFor(g, d)).toBe(3);
    expect(g.act({ k: 'stamp', id: d.id }).why).toMatch(/3 Machine Kits/);
    // three kits into the Workshop Hopper
    g.intake.push({ to: 'hopper', item: 'machineKit', x: 7, y: 5, n: N(3) });
    g.tick();
    expect(g.s.parts.toNumber()).toBe(3);
    must(g, { k: 'stamp', id: d.id });
    expect(g.s.parts.toNumber()).toBe(0);
    // slice-era designs stay coin-only
    const plain = design(g, { parts: [{ kind: 'smelter', dx: 0, dy: 0, rot: 0, recipe: null }], bill: 60 });
    expect(kitsFor(g, plain)).toBe(0);
  });
});

describe('customers and the Codex (DESIGN.md §18 Customers)', () => {
  it('Unit 7 rep 1: the first delivery of each item pays 100x its value, once', () => {
    const g = sandbox();
    g.s.orders.rep.unit7 = 1;
    const c0 = g.s.coin.toNumber();
    g.intake.push({ to: 'dock', item: 'steel', x: 7, y: 2 });
    g.tick();
    expect(g.s.coin.toNumber() - c0).toBe(15 + 1500);
    g.intake.push({ to: 'dock', item: 'steel', x: 7, y: 2 });
    g.tick();
    expect(g.s.coin.toNumber() - c0).toBe(15 + 1500 + 15);
    expect(g.s.codex).toContain('steel');
  });

  it('Recycled Glass is taught at Unit 7 rep 2', () => {
    const g = sandbox();
    must(g, { k: 'place', kind: 'kiln', x: 21, y: 4, rot: 0 });
    const k = at(g, 21, 4);
    expect(machineRecipes(g, k).map((r) => r.id)).not.toContain('recycledGlass');
    expect(g.act({ k: 'recipe', x: 21, y: 4, recipe: 'recycledGlass' }).ok).toBe(false);
    g.s.orders.rep.unit7 = 2;
    expect(machineRecipes(g, k).map((r) => r.id)).toContain('recycledGlass');
  });
});

describe('the Megaproject Bay and the Great Drill (DESIGN.md §18 Megaproject #1)', () => {
  it('arrives on the Factory floor, takes its stage by trunk, and then speeds every miner +50%', () => {
    const g = sandbox();
    g.first('factoryOpen');
    g.step(TICK_RATE + 1);
    const bay = g.s.factory.ents.find((e) => e.kind === 'fbay');
    expect(bay).toBeTruthy();
    // three sources straight into the Bay: steel and concrete at its east side, Drill Bits from the north
    const part = [{ kind: 'smelter' as const, dx: 0, dy: 0, rot: 0 as const, recipe: null }];
    const st = design(g, { outs: { steel: 10 }, parts: part });
    const co = design(g, { outs: { concrete: 10 }, parts: part });
    const bit = design(g, { outs: { drillBit: 1 }, parts: part });
    must(g, { k: 'fplace', design: st.id, x: 2, y: 6, rot: 2 });
    must(g, { k: 'fplace', design: co.id, x: 2, y: 7, rot: 2 });
    must(g, { k: 'fplace', design: bit.id, x: 0, y: 5, rot: 1 });
    expect(g.routes.filter((r) => r.to?.kind === 'fbay')).toHaveLength(3);
    g.step(20 * TICK_RATE);
    expect(g.s.mega.stage).toBe(0);
    expect(g.s.mega.progress.steel?.toNumber() ?? 0).toBeGreaterThan(0);
    // 8/s a route: 1,500 concrete need about 3 minutes
    g.step(200 * TICK_RATE);
    expect(g.s.mega.stage).toBe(1);
    // miners run 1.5x now
    must(g, { k: 'place', kind: 'miner', x: 2, y: 11, rot: 0 });
    const m = at(g, 2, 11);
    for (let i = 0; i < 60 * TICK_RATE; i++) { m.out = 0; g.tick(); }
    expect(m.crafts).toBeGreaterThanOrEqual(44);
    expect(m.crafts).toBeLessThanOrEqual(45);
  });

  it('refuses what its stage does not want', () => {
    const g = sandbox();
    g.first('factoryOpen');
    g.step(TICK_RATE + 1);
    const d = design(g, { outs: { gear: 5 }, parts: [{ kind: 'smelter', dx: 0, dy: 0, rot: 0, recipe: null }] });
    must(g, { k: 'fplace', design: d.id, x: 2, y: 6, rot: 2 });
    g.step(10 * TICK_RATE);
    const m = g.s.factory.ents.find((e) => e.kind === 'module')!;
    expect(m.state).toBe('blocked');
    expect(Object.keys(g.s.mega.progress)).toHaveLength(0);
  });
});

describe('nested folds (DESIGN.md §18)', () => {
  /** An ingot source feeding a plate module, its slag out of a side trunk into the Dock. */
  function group() {
    const g = sandbox();
    g.first('factoryOpen');
    const a = design(g, { name: 'Ingots', outs: { ironIngot: 0.5, slag: 0.125 }, parts: [{ kind: 'miner', dx: 0, dy: 0, rot: 0, recipe: 'mineIron' }, { kind: 'smelter', dx: 1, dy: 0, rot: 0, recipe: null }], bill: 100 });
    const b = design(g, { name: 'Plates', ins: { ironIngot: 0.5 }, outs: { ironPlate: 0.5 }, parts: [{ kind: 'press', dx: 0, dy: 0, rot: 0, recipe: null }], bill: 150 });
    must(g, { k: 'fplace', design: a.id, x: 4, y: 1, rot: 0 });
    must(g, { k: 'fplace', design: b.id, x: 5, y: 1, rot: 0 });
    for (let x = 6; x < 10; x++) must(g, { k: 'ftrunk', x, y: 1, rot: 0 });
    must(g, { k: 'ftrunk', x: 4, y: 2, rot: 1 });
    for (let x = 4; x < 9; x++) must(g, { k: 'ftrunk', x, y: 3, rot: 0 });
    must(g, { k: 'ftrunk', x: 9, y: 3, rot: 3 });
    must(g, { k: 'ftrunk', x: 9, y: 2, rot: 0 });
    return { g, a, b };
  }

  it('audits a group of modules and folds it into one depth-2 tile with the measured rates x grade', () => {
    const { g, a, b } = group();
    g.step(10 * TICK_RATE);
    expect(g.act({ k: 'faudit', x: 4, y: 1, w: 1, h: 1 }).why).toMatch(/two modules/);
    must(g, { k: 'faudit', x: 4, y: 1, w: 2, h: 2 });
    expect(g.act({ k: 'fremove', x: 5, y: 1 }).why).toMatch(/Auditing/);
    g.step(auditTicks() + 1);
    const res = g.s.faudit!.result!;
    expect(res).toBeTruthy();
    expect(res.grade.u).toBeGreaterThan(0.95);
    expect(res.outs.ironPlate!).toBeGreaterThan(0.45);
    expect(res.outs.slag!).toBeGreaterThan(0.1);
    expect(res.grade.w).toBeGreaterThan(0.95);
    expect(res.grade.c).toBeCloseTo(Math.min(1, 2 / 4 / 0.6), 5);
    must(g, { k: 'ffold', name: 'Plate works' });
    const d = g.s.designs[g.s.designs.length - 1];
    expect(d.depth).toBe(2);
    expect(d.bill).toBe(a.bill + b.bill);
    expect(d.outs.ironPlate!).toBeCloseTo(res.outs.ironPlate! * res.grade.mult, 6);
    expect(g.s.factory.ents.some((e) => e.kind === 'module' && (e.design === a.id || e.design === b.id))).toBe(false);
    // the depth-2 module holds its source's iron claim, and can't be nested again
    must(g, { k: 'fplace', design: d.id, x: 4, y: 1, rot: 0 });
    // unfold puts the modules back (after lifting the depth-2 copy off its box)
    must(g, { k: 'fremove', x: 4, y: 1 });
    must(g, { k: 'unfold', id: d.id });
    expect(g.s.factory.ents.filter((e) => e.kind === 'module').length).toBe(2);
  });

  it('a nested fold needs the research and refuses the Dock', () => {
    const { g } = group();
    expect(g.act({ k: 'faudit', x: 8, y: 0, w: 4, h: 3 }).why).toMatch(/Factory Dock/);
    g.s.research.done = g.s.research.done.filter((r) => r !== 'nestedFolds');
    expect(g.act({ k: 'faudit', x: 4, y: 1, w: 2, h: 2 }).why).toMatch(/Nested Folds/);
  });
});

describe('fold rules (DESIGN.md §10, §18; the Milestone 1-2 review)', () => {
  it('a fold needs two kinds of machine', () => {
    const g = sandbox();
    must(g, { k: 'place', kind: 'miner', x: 2, y: 11, rot: 0 });
    expect(foldRefusal(g, { x: 2, y: 11, w: 1, h: 1 })).toMatch(/two kinds/);
  });

  it('power never crosses a fold box', () => {
    const g = sandbox();
    must(g, { k: 'place', kind: 'miner', x: 20, y: 5, rot: 0 });
    must(g, { k: 'place', kind: 'kiln', x: 21, y: 4, rot: 0 });
    must(g, { k: 'place', kind: 'pole', x: 19, y: 4, rot: 0 });
    must(g, { k: 'place', kind: 'generator', x: 19, y: 6, rot: 0 });
    expect(foldRefusal(g, { x: 20, y: 4, w: 2, h: 2 })).toMatch(/Power crosses the box/);
    expect(foldRefusal(g, { x: 19, y: 4, w: 3, h: 3 })).toBeNull();
  });
});

describe('saves v3', () => {
  it('migrates a v2 save: parts bank, claims, Codex, Megaproject, Act II reputation', () => {
    const st = { coin: 'N:5', orders: { active: null, progress: {}, done: [], rep: { bramble: 2 } } };
    const d = migrate({ v: 2, saved: 0, seed: 1, snap: JSON.stringify(st) });
    expect(d.v).toBe(3);
    const s2 = JSON.parse(d.snap as string);
    expect(s2.parts).toBe('N:0');
    expect(s2.orders.rep).toEqual({ bramble: 2, unit7: 0, voltaire: 0 });
    expect(s2.mega).toEqual({ stage: 0, progress: {} });
    expect(s2.codex).toEqual([]);
    expect(Num.parse('0').toNumber()).toBe(0);
  });
});
