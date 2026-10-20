// Act II (ROADMAP.md Milestone 4, DESIGN.md §18): power grids and brownouts, boilers and engines,
// Mk2 machines, modes, Overdrive, deposit claims, Machine Kits, the Codex, the Megaproject Bay and
// the Great Drill, nested folds, power never crossing a fold box, and the v2 -> v3 save migration.
import { describe, expect, it } from 'vitest';
import { Game, type Cmd } from '../src/sim/Game';
import { N, Num } from '../src/engine/num';
import { RESEARCH_IDS } from '../src/data/research';
import { CHUNKS } from '../src/data/land';
import { RULES, GRADES, gradeFor } from '../src/data/rules';
import { TICK_RATE } from '../src/engine/time';
import { drawKw } from '../src/sim/systems/power';
import { claimsHeld, claimPrice } from '../src/sim/systems/claims';
import { kitsFor, stampRefusal } from '../src/sim/systems/modules';
import { foldRefusal, splusGate } from '../src/sim/systems/audits';
import { auditTicks } from '../src/sim/systems/audits';
import { machineRecipes } from '../src/sim/transfer';
import { migrate, SAVE_VERSION } from '../src/engine/save';
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
    // 60 kW of 200: 0.3 load, 1 coal per 3 s at full load -> about 6 coal a minute (plus what sits in the burner)
    const burnt = coal - (gen.inBuf.coal ?? 0);
    expect(burnt).toBeGreaterThanOrEqual(5);
    expect(burnt).toBeLessThanOrEqual(8);
  });

  it('a brownout runs every machine on the grid at supply / demand', () => {
    const g = sandbox();
    // four kilns (240 kW) on one generator (200 kW): 5/6 speed
    for (const y of [2, 3, 4, 5]) must(g, { k: 'place', kind: 'kiln', x: 21, y, rot: 0 });
    must(g, { k: 'place', kind: 'generator', x: 19, y: 6, rot: 0 });
    must(g, { k: 'place', kind: 'pole', x: 19, y: 4, rot: 0 });
    const ks = [2, 3, 4, 5].map((y) => at(g, 21, y));
    const gen = at(g, 19, 6);
    for (let i = 0; i < 60 * TICK_RATE; i++) {
      for (const k of ks) feed(k, 'sand');
      gen.inBuf.coal = 4;
      g.tick();
    }
    expect(g.grids[0].sat).toBeCloseTo(200 / 240, 3);
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

  it('a Mk2 Smelter is 2x2 and smelts at 4x', () => {
    const { m, run } = powered('smelterMk2', 20, 3);
    expect(m.w).toBe(2);
    run(60 * TICK_RATE, 'ironOre');
    // 4x a 2.0 s smelt: 120 a minute, one Mk1 belt
    expect(m.crafts).toBeGreaterThanOrEqual(118);
    expect(m.crafts).toBeLessThanOrEqual(120);
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
    miner.boost = 60 * TICK_RATE;
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

describe('the Lucky Vein (DESIGN.md §6)', () => {
  it('runs every machine of the line its patch feeds at 3x for 60 s, not just the miners', () => {
    const g = sandbox();
    must(g, { k: 'place', kind: 'miner', x: 2, y: 11, rot: 0 });
    must(g, { k: 'place', kind: 'smelter', x: 3, y: 11, rot: 0 });
    must(g, { k: 'place', kind: 'heap', x: 3, y: 12, rot: 1 });
    must(g, { k: 'place', kind: 'press', x: 4, y: 11, rot: 0 });
    must(g, { k: 'place', kind: 'crate', x: 5, y: 11, rot: 0 });
    g.step(10 * TICK_RATE);
    at(g, 5, 11).store = [];
    g.s.sparks.push({ kind: 'vein', x: 2, y: 11, life: 400 });
    g.s.clickWindow = -100;
    must(g, { k: 'click', x: 2, y: 11 });
    const sm = at(g, 3, 11), pr = at(g, 4, 11);
    expect(sm.boost).toBe(RULES.veinSeconds.value * TICK_RATE);
    expect(pr.boost).toBe(RULES.veinSeconds.value * TICK_RATE);
    const c0 = sm.crafts;
    g.step(20 * TICK_RATE);
    // a 2.0 s smelt at 3x: about 30 in 20 s (fed by the 3x miner beside it)
    expect(sm.crafts - c0).toBeGreaterThanOrEqual(26);
  });
});

describe('claims and Machine Kits (DESIGN.md §18)', () => {
  it('a design with miners inside holds a claim per copy; more are bought 4 at a time at x(1 + 0.5 b)', () => {
    const g = sandbox();
    const d = design(g, { parts: [{ kind: 'miner', dx: 0, dy: 0, rot: 0, recipe: 'mineCoal' }, { kind: 'smelter', dx: 1, dy: 0, rot: 0, recipe: null }], outs: { coal: 0.5 } });
    // 3 + 2 per owned coal deposit (two)
    expect(claimsHeld(g, 'coal')).toBe(7);
    for (let i = 0; i < 6; i++) must(g, { k: 'stamp', id: d.id });
    expect(stampRefusal(g, d)).toMatch(/coal claim \(7 of 7/);
    expect(claimPrice(g, 'coal')!.toNumber()).toBe(60000);
    must(g, { k: 'claim', item: 'coal' });
    expect(claimPrice(g, 'coal')!.toNumber()).toBe(90000);
    expect(claimsHeld(g, 'coal')).toBe(11);
    must(g, { k: 'stamp', id: d.id });
  });

  it('stamping a design with Act II buildings costs Machine Kits; a Hopper banks them', () => {
    const g = sandbox();
    const d = design(g, { parts: [{ kind: 'kiln', dx: 0, dy: 0, rot: 0, recipe: null }, { kind: 'pole', dx: 1, dy: 0, rot: 0, recipe: null }], bill: 32000, outs: { glass: 0.5 } });
    expect(kitsFor(g, d)).toBe(7); // 1 + floor(32,000 / 5,000)
    expect(g.act({ k: 'stamp', id: d.id }).why).toMatch(/7 Machine Kits/);
    // seven kits into the Workshop Hopper
    g.intake.push({ to: 'hopper', item: 'machineKit', x: 7, y: 5, n: N(7) });
    g.tick();
    expect(g.s.parts.toNumber()).toBe(7);
    must(g, { k: 'stamp', id: d.id });
    expect(g.s.parts.toNumber()).toBe(0);
    // slice-era designs stay coin-only
    const plain = design(g, { parts: [{ kind: 'smelter', dx: 0, dy: 0, rot: 0, recipe: null }], bill: 60 });
    expect(kitsFor(g, plain)).toBe(0);
  });
});

describe('customers and the Codex (DESIGN.md §18 Customers)', () => {
  it('Unit 7 rep 1: the first delivery of each item pays 30x its value, once', () => {
    const g = sandbox();
    g.s.orders.rep.unit7 = 1;
    const c0 = g.s.coin.toNumber();
    g.intake.push({ to: 'dock', item: 'steel', x: 7, y: 2 });
    g.tick();
    expect(g.s.coin.toNumber() - c0).toBe(22 + 660);
    g.intake.push({ to: 'dock', item: 'steel', x: 7, y: 2 });
    g.tick();
    expect(g.s.coin.toNumber() - c0).toBe(22 + 660 + 22);
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
    // the stage's 650 Drill Bits at 1/s need 11 minutes (2,800 steel at 8/s about 6)
    g.step(680 * TICK_RATE);
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

describe('the Milestone 3 gate fixes', () => {
  /** Two short miner+smelter lines on chunk C's iron, ingots out to crates. */
  function twoLines() {
    const g = sandbox();
    for (const y of [11, 12]) {
      must(g, { k: 'place', kind: 'miner', x: 2, y, rot: 0 });
      must(g, { k: 'place', kind: 'smelter', x: 4, y, rot: 0 });
      must(g, { k: 'place', kind: 'belt', x: 3, y, rot: 0 });
      must(g, { k: 'place', kind: 'belt', x: 5, y, rot: 0 });
      must(g, { k: 'place', kind: 'crate', x: 6, y, rot: 0 });
    }
    must(g, { k: 'place', kind: 'heap', x: 4, y: 13, rot: 1 });
    must(g, { k: 'place', kind: 'heap', x: 4, y: 10, rot: 3 });
    return g;
  }

  it('audits up to three lines at once, and folds the graded one named', () => {
    const g = twoLines();
    g.step(10 * TICK_RATE);
    must(g, { k: 'audit', x: 2, y: 11, w: 4, h: 1 });
    expect(g.act({ k: 'audit', x: 2, y: 11, w: 3, h: 2 }).why).toMatch(/overlaps/);
    must(g, { k: 'audit', x: 2, y: 12, w: 4, h: 1 });
    expect(g.s.audits).toHaveLength(2);
    g.step(auditTicks() + 1);
    expect(g.s.audits.every((a) => a.result)).toBe(true);
    const second = g.s.audits[1].id;
    must(g, { k: 'fold', name: 'B', id: second });
    expect(g.s.audits).toHaveLength(1);
    expect(g.s.designs[0].name).toBe('B');
  });

  it('takes stock already in the box off the outputs: a crate of Gizmos is not production', () => {
    const g = twoLines();
    // a crate of 50 Gizmos inside the box, draining out of it during the window
    must(g, { k: 'place', kind: 'crate', x: 5, y: 9, rot: 0 });
    must(g, { k: 'place', kind: 'belt', x: 6, y: 9, rot: 0 });
    must(g, { k: 'place', kind: 'crate', x: 7, y: 9, rot: 0 });
    at(g, 5, 9).store = new Array(50).fill('gizmo');
    must(g, { k: 'audit', x: 2, y: 9, w: 5, h: 3 });
    g.step(auditTicks() + 1);
    const res = g.s.audits[0].result!;
    expect(res.outs.gizmo ?? 0).toBeLessThan(0.01);
  });

  it('a brownout lowers U: work counts at the speed power allowed', () => {
    const g = sandbox();
    must(g, { k: 'place', kind: 'miner', x: 20, y: 5, rot: 0 });
    must(g, { k: 'place', kind: 'kiln', x: 21, y: 5, rot: 0 });
    must(g, { k: 'place', kind: 'kiln', x: 21, y: 6, rot: 0 });
    must(g, { k: 'place', kind: 'kiln', x: 21, y: 4, rot: 0 });
    must(g, { k: 'place', kind: 'generator', x: 19, y: 6, rot: 0 });
    must(g, { k: 'place', kind: 'pole', x: 19, y: 4, rot: 0 });
    // the generator alone can't carry five kilns' worth (300 kW on 200)
    must(g, { k: 'place', kind: 'kiln', x: 20, y: 3, rot: 0 });
    must(g, { k: 'place', kind: 'kiln', x: 20, y: 4, rot: 0 });
    const ks = [at(g, 21, 5), at(g, 21, 6), at(g, 21, 4), at(g, 20, 3), at(g, 20, 4)];
    const gen = at(g, 19, 6);
    must(g, { k: 'audit', x: 19, y: 3, w: 3, h: 4 });
    for (let i = 0; i < auditTicks() + 2; i++) {
      for (const k of ks) feed(k, 'sand');
      gen.inBuf.coal = 4;
      g.tick();
    }
    const kilnU = ks.map((k) => g.s.audits[0].result!.busy[k.id]);
    for (const u of kilnU) expect(u).toBeLessThan(0.7);
  });

  it('S+ sits above S, and every grade gets advice', () => {
    expect(GRADES[0].letter).toBe('S+');
    expect(gradeFor(0.98).letter).toBe('S+');
    expect(gradeFor(0.95).letter).toBe('S');
    const g = twoLines();
    g.step(20 * TICK_RATE);
    must(g, { k: 'audit', x: 2, y: 11, w: 4, h: 1 });
    g.step(auditTicks() + 1);
    expect(g.s.audits[0].result!.advice.length).toBeGreaterThan(0);
  });

  it('Overdrive runs the clicked machine\'s whole line', () => {
    const g = twoLines();
    g.step(5 * TICK_RATE);
    g.s.clickWindow = -100;
    must(g, { k: 'click', x: 4, y: 11 });
    expect(at(g, 4, 11).od).toBeGreaterThan(0);
    expect(at(g, 2, 11).od).toBeGreaterThan(0); // its miner too
    expect(at(g, 4, 12).od ?? 0).toBe(0); // not the other line
  });

  it('a Factory module and the modules joined to it can be overdriven', () => {
    const g = sandbox();
    g.first('factoryOpen');
    const a = design(g, { outs: { ironIngot: 0.5 }, parts: [{ kind: 'miner', dx: 0, dy: 0, rot: 0, recipe: 'mineIron' }, { kind: 'smelter', dx: 1, dy: 0, rot: 0, recipe: null }] });
    const b = design(g, { ins: { ironIngot: 0.5 }, outs: { ironPlate: 0.5 }, parts: [{ kind: 'press', dx: 0, dy: 0, rot: 0, recipe: null }] });
    must(g, { k: 'fplace', design: a.id, x: 4, y: 1, rot: 0 });
    must(g, { k: 'fplace', design: b.id, x: 5, y: 1, rot: 0 });
    for (let x = 6; x < 10; x++) must(g, { k: 'ftrunk', x, y: 1, rot: 0 });
    must(g, { k: 'fclick', x: 5, y: 1 });
    expect(g.fentAt(4, 1)!.od).toBeGreaterThan(0);
    expect(g.fentAt(5, 1)!.od).toBeGreaterThan(0);
    expect(g.act({ k: 'fclick', x: 5, y: 1 }).why).toMatch(/already/);
  });

  it('a nested fold needs one module inside feeding another', () => {
    const g = sandbox();
    g.first('factoryOpen');
    const a = design(g, { outs: { ironPlate: 0.5 }, parts: [{ kind: 'press', dx: 0, dy: 0, rot: 0, recipe: null }] });
    const b = design(g, { outs: { copperWire: 0.5 }, parts: [{ kind: 'press', dx: 0, dy: 0, rot: 0, recipe: null }] });
    must(g, { k: 'fplace', design: a.id, x: 4, y: 1, rot: 0 });
    must(g, { k: 'fplace', design: b.id, x: 4, y: 2, rot: 0 });
    expect(g.act({ k: 'faudit', x: 4, y: 1, w: 1, h: 2 }).why).toMatch(/feed another/);
  });

  it('the Hand Furnace starts with a Slag Heap, so hand-smelting never jams', () => {
    const g = new Game(1);
    expect(g.entAt(3, 4)?.kind).toBe('heap');
  });
});

describe('the Milestone 4 review fixes', () => {
  it('a module with two products runs while either has room; the full one spills', () => {
    const g = sandbox();
    g.first('factoryOpen');
    const gp = design(g, { outs: { glass: 0.5, plastic: 0.5 }, parts: [{ kind: 'kiln', dx: 0, dy: 0, rot: 0, recipe: null }, { kind: 'refinery', dx: 1, dy: 0, rot: 0, recipe: null }] });
    const c = design(g, { ins: { glass: 0.5 }, outs: { circuit: 0.1 }, parts: [{ kind: 'assembler', dx: 0, dy: 0, rot: 0, recipe: null }] });
    must(g, { k: 'fplace', design: gp.id, x: 4, y: 1, rot: 0 });
    must(g, { k: 'fplace', design: c.id, x: 5, y: 1, rot: 0 });
    for (let x = 6; x < 10; x++) must(g, { k: 'ftrunk', x, y: 1, rot: 0 });
    g.step(60 * TICK_RATE);
    // the circuit module takes no plastic: it backs up, but glass keeps flowing
    const m = g.fentAt(4, 1)!;
    expect(m.fAvg).toBeGreaterThan(0.5);
    expect(m.spill).toBe('plastic');
    expect(g.fentAt(5, 1)!.fAvg).toBeGreaterThan(0.5);
  });

  it('stock drawn down inside the box becomes an input, whatever it is worth', () => {
    const g = sandbox();
    // a crate of ingots -> press -> assembler, no belt in: the module needs ingots, not nothing
    must(g, { k: 'place', kind: 'crate', x: 2, y: 9, rot: 0 });
    must(g, { k: 'place', kind: 'press', x: 3, y: 9, rot: 0 });
    must(g, { k: 'place', kind: 'assembler', x: 4, y: 9, rot: 0 });
    must(g, { k: 'place', kind: 'belt', x: 5, y: 9, rot: 0 });
    must(g, { k: 'place', kind: 'crate', x: 6, y: 9, rot: 0 });
    at(g, 2, 9).store = new Array(50).fill('ironIngot');
    must(g, { k: 'audit', x: 2, y: 9, w: 3, h: 1 });
    g.step(auditTicks() + 1);
    const res = g.s.audits[0].result!;
    expect(res.outs.gear ?? 0).toBeGreaterThan(0.1);
    expect(res.ins.ironIngot ?? 0).toBeGreaterThan(0.4);
  });

  it('S+ needs the byproducts used inside the box: slag routed to a heap caps a line at S', () => {
    expect(splusGate(GRADES[0], 0.99, 10, 9).letter).toBe('S+');
    expect(splusGate(GRADES[0], 0.99, 10, 2).letter).toBe('S');
    expect(splusGate(GRADES[0], 0.99, 0, 0).letter).toBe('S+');
    const g = sandbox();
    must(g, { k: 'place', kind: 'miner', x: 2, y: 11, rot: 0 });
    must(g, { k: 'place', kind: 'belt', x: 3, y: 11, rot: 0 });
    must(g, { k: 'place', kind: 'smelter', x: 4, y: 11, rot: 0 });
    must(g, { k: 'place', kind: 'belt', x: 5, y: 11, rot: 0 });
    must(g, { k: 'place', kind: 'crate', x: 6, y: 11, rot: 0 });
    must(g, { k: 'place', kind: 'heap', x: 4, y: 12, rot: 1 });
    g.step(10 * TICK_RATE);
    must(g, { k: 'audit', x: 2, y: 11, w: 3, h: 1 });
    g.step(auditTicks() + 1);
    const res = g.s.audits[0].result!;
    expect(res.grade.score).toBeGreaterThanOrEqual(0.97);
    expect(res.grade.letter).toBe('S');
    expect(res.advice[0]).toMatch(/One step to S\+/);
  });

  it('a copy is not placed past the claims held, however it was made', () => {
    const g = sandbox();
    g.first('factoryOpen');
    const held = claimsHeld(g, 'copperOre');
    const d = design(g, { spare: held + 1, outs: { copperIngot: 0.5 }, parts: [{ kind: 'miner', dx: 0, dy: 0, rot: 0, recipe: 'mineCopper' }, { kind: 'smelter', dx: 1, dy: 0, rot: 0, recipe: null }] });
    for (let i = 0; i < held; i++) must(g, { k: 'fplace', design: d.id, x: i % 10, y: 4 + Math.floor(i / 10), rot: 0 });
    expect(g.act({ k: 'fplace', design: d.id, x: 0, y: 7, rot: 0 }).why).toMatch(/Out of copper claims/);
  });

  it('a nested fold boxes one group: a stranger riding along is refused', () => {
    const g = sandbox();
    g.first('factoryOpen');
    const a = design(g, { outs: { ironPlate: 0.5 }, parts: [{ kind: 'press', dx: 0, dy: 0, rot: 0, recipe: null }] });
    const b = design(g, { ins: { ironPlate: 0.5 }, outs: { gear: 0.25 }, parts: [{ kind: 'assembler', dx: 0, dy: 0, rot: 0, recipe: null }] });
    const c = design(g, { outs: { copperWire: 0.5 }, parts: [{ kind: 'press', dx: 0, dy: 0, rot: 0, recipe: null }] });
    must(g, { k: 'fplace', design: a.id, x: 4, y: 1, rot: 0 });
    must(g, { k: 'fplace', design: b.id, x: 5, y: 1, rot: 0 });
    must(g, { k: 'fplace', design: c.id, x: 4, y: 2, rot: 0 });
    expect(g.act({ k: 'faudit', x: 4, y: 1, w: 2, h: 2 }).why).toMatch(/isn't joined/);
    expect(g.act({ k: 'faudit', x: 4, y: 1, w: 2, h: 1 }).ok).toBe(true);
  });

  it('the Great Drill never boosts a miner being audited', () => {
    const g = sandbox();
    g.s.mega.stage = 1;
    for (const y of [11, 12]) {
      must(g, { k: 'place', kind: 'miner', x: 2, y, rot: 0 });
      must(g, { k: 'place', kind: 'belt', x: 3, y, rot: 0 });
      must(g, { k: 'place', kind: 'smelter', x: 4, y, rot: 0 });
    }
    must(g, { k: 'audit', x: 2, y: 11, w: 3, h: 1 });
    const p0 = [at(g, 2, 11).prog, at(g, 2, 12).prog];
    g.tick();
    const d = [(at(g, 2, 11).prog - p0[0] + 40) % 40, (at(g, 2, 12).prog - p0[1] + 40) % 40];
    expect(d[0]).toBeCloseTo(1);
    expect(d[1]).toBeCloseTo(1 + RULES.drillBoost.value);
  });
});

describe('fold rules (DESIGN.md §10, §18; the Milestone 1-2 review)', () => {
  it('a fold needs two kinds of machine, or one feeding another', () => {
    const g = sandbox();
    must(g, { k: 'place', kind: 'miner', x: 2, y: 11, rot: 0 });
    expect(foldRefusal(g, { x: 2, y: 11, w: 1, h: 1 })).toMatch(/two kinds/);
    // two assemblers side by side, not feeding each other: refused
    must(g, { k: 'place', kind: 'assembler', x: 6, y: 9, rot: 3 });
    must(g, { k: 'place', kind: 'assembler', x: 7, y: 9, rot: 3 });
    expect(foldRefusal(g, { x: 6, y: 9, w: 2, h: 1 })).toMatch(/feeding another/);
    // a gear assembler handing gears into a Gizmo assembler: a line
    must(g, { k: 'remove', x: 6, y: 9 });
    must(g, { k: 'place', kind: 'assembler', x: 6, y: 9, rot: 0 });
    must(g, { k: 'recipe', x: 6, y: 9, recipe: 'cutGear' });
    expect(foldRefusal(g, { x: 6, y: 9, w: 2, h: 1 })).toBeNull();
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

describe('saves v3 and v4', () => {
  it('migrates a v2 save: parts bank, claims, Codex, Megaproject, Act II reputation', () => {
    const st = { coin: 'N:5', orders: { active: null, progress: {}, done: [], rep: { bramble: 2 } } };
    const d = migrate({ v: 2, saved: 0, seed: 1, snap: JSON.stringify(st) });
    expect(d.v).toBe(SAVE_VERSION);
    const s2 = JSON.parse(d.snap as string);
    expect(s2.parts).toBe('N:0');
    expect(s2.orders.rep).toMatchObject({ bramble: 2, unit7: 0, voltaire: 0 });
    expect(s2.mega).toEqual({ stage: 0, progress: {} });
    expect(s2.codex).toEqual([]);
    expect(Num.parse('0').toNumber()).toBe(0);
  });

  it('migrates a v3 save: its one audit becomes the first of the audits', () => {
    const st = { audit: { box: { x: 1, y: 2, w: 3, h: 1 }, t: 5, ids: [], ins: {}, outs: {}, busy: {}, crafts0: {}, ports: [], result: null } };
    const d = migrate({ v: 3, saved: 0, seed: 1, snap: JSON.stringify(st) });
    const s2 = JSON.parse(d.snap as string);
    expect(s2.audit).toBeUndefined();
    expect(s2.audits).toHaveLength(1);
    expect(s2.audits[0].id).toBe(1);
    expect(s2.nextAudit).toBe(2);
  });
});
