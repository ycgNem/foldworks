// The Milestone 5-6 final round (DECISIONS.md, DESIGN.md §10, §19): Overdrive never reaches an
// audited line or group, the bills term can't be farmed with idle or starved buildings, and a kept
// design unfolded unchanged refolds after a short check instead of a full audit.
import { describe, expect, it } from 'vitest';
import { Game, type Cmd } from '../src/sim/Game';
import { N } from '../src/engine/num';
import { RESEARCH_IDS } from '../src/data/research';
import { CHUNKS } from '../src/data/land';
import { TICK_RATE } from '../src/engine/time';
import { auditTicks } from '../src/sim/systems/audits';
import { billsStanding, billsTerm, designValue } from '../src/sim/reorganize';
import type { Dir, Ent, ModuleDesign } from '../src/sim/world';

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

function belt(g: Game, x0: number, y0: number, n: number, rot: Dir) {
  const dx = [1, 0, -1, 0][rot], dy = [0, 1, 0, -1][rot];
  for (let i = 0; i < n; i++) must(g, { k: 'place', kind: 'belt', x: x0 + dx * i, y: y0 + dy * i, rot });
}

/** A miner into a smelter, its slag into a heap, its ingots up to the Dock. */
function ironLine(g: Game) {
  must(g, { k: 'place', kind: 'miner', x: 2, y: 11, rot: 0 });
  must(g, { k: 'place', kind: 'smelter', x: 3, y: 11, rot: 0 });
  must(g, { k: 'place', kind: 'belt', x: 3, y: 12, rot: 1 });
  must(g, { k: 'place', kind: 'heap', x: 3, y: 13, rot: 1 });
  belt(g, 4, 11, 1, 0);
  belt(g, 5, 11, 9, 3);
  belt(g, 5, 2, 1, 0);
}

/** Fold the iron line, Overdriven just before its audit or not, with Quick Audits or not. */
function foldIron(quick: boolean, od: boolean) {
  const g = sandbox();
  if (quick) g.s.meta.nodes.push('quickAudit');
  ironLine(g);
  g.step(60 * TICK_RATE);
  if (od) must(g, { k: 'click', x: 3, y: 11 });
  must(g, { k: 'audit', x: 2, y: 11, w: 2, h: 2 });
  g.step(auditTicks(g) + 1);
  must(g, { k: 'fold', name: 'Ingots' });
  return g.s.designs[g.s.designs.length - 1];
}

function design(g: Game, over: Partial<ModuleDesign>): ModuleDesign {
  const d: ModuleDesign = {
    id: g.s.nextDesign++, name: 'D', box: { x: 0, y: 0, w: 2, h: 1 }, parts: [], ins: {}, outs: {},
    grade: { letter: 'B', score: 0.7, u: 1, w: 1, c: 1, mult: 1 }, bill: 100, stamped: 0, spare: 1, ...over,
  };
  g.s.designs.push(d);
  return d;
}

/** Bills (and the term) a farm adds on top of a factory standing on `base` coin of bills. */
const added = (base: number, farm: number) => billsTerm(base + farm) - billsTerm(base);

describe('the bills term counts measured work (DESIGN.md §19, the final round)', () => {
  /** A grid of poles over x 8-23, y 0-15 with one generator kept fuelled, every other free tile a
   * machine of `kind` kept fed: far more demand than one generator gives (a brownout). */
  function brownout(kind: 'refinery' | 'kiln', fed: (e: Ent) => void) {
    const g = sandbox();
    must(g, { k: 'place', kind: 'generator', x: 9, y: 1, rot: 0 });
    let n = 0;
    for (let y = 0; y < 16; y++) for (let x = 8; x < 24; x++) {
      if (x === 9 && y === 1) continue;
      if ((x - 8) % 4 === 2 && y % 4 === 1) { g.act({ k: 'place', kind: 'pole', x, y, rot: 0 }); continue; }
      if (g.act({ k: 'place', kind, x, y, rot: 0 }).ok) n++;
    }
    g.rebuild();
    const gen = g.s.ents.find((e) => e.kind === 'generator')!;
    const ms = g.s.ents.filter((e) => e.kind === kind);
    for (let t = 0; t < 6 * 60 * TICK_RATE; t++) {
      gen.inBuf.coal = 4;
      for (const m of ms) fed(m);
      g.tick();
    }
    return { g, n, ms };
  }

  it('a brownout farm (100+ machines on one generator, all kept fed) adds under 0.5 Patents', () => {
    const { g, n, ms } = brownout('refinery', (m) => { m.recipe = 'refinePlastic'; m.inBuf.coal = 4; m.out = 0; m.by = 0; });
    expect(n).toBeGreaterThanOrEqual(100);
    // they are all "working" by their pips, at a sliver of the power they want
    expect(ms.filter((m) => m.hist.includes('w')).length).toBeGreaterThanOrEqual(100);
    expect(g.grids[0].sat).toBeLessThan(0.02);
    const b = billsStanding(g);
    const spent = n * 9000;
    console.log(`[pace] brownout farm: ${n} refineries (${spent} coin) on one generator at ${(g.grids[0].sat * 100).toFixed(1)}% of their power: bills ${Math.round(b)}, +${added(14000, b).toFixed(2)} Patents on the slice-end factory, +${added(80000, b).toFixed(2)} on the 4 h factory`);
    for (const base of [0, 14000, 80000]) expect(added(base, b)).toBeLessThan(0.5);
  });

  it('a field of generators with one fuelled, or many fuelled for one kiln, counts by burn share', () => {
    const g = sandbox();
    must(g, { k: 'place', kind: 'kiln', x: 8, y: 0, rot: 0 });
    let n = 0;
    for (let y = 0; y < 8; y++) for (let x = 8; x < 24; x++) {
      if ((x - 8) % 4 === 2 && y % 4 === 1) { g.act({ k: 'place', kind: 'pole', x, y, rot: 0 }); continue; }
      if (g.act({ k: 'place', kind: 'generator', x, y, rot: 0 }).ok) n++;
    }
    g.rebuild();
    const kiln = g.s.ents.find((e) => e.kind === 'kiln')!;
    const gens = g.s.ents.filter((e) => e.kind === 'generator');
    const play = (fuelAll: boolean) => {
      for (let t = 0; t < 6 * 60 * TICK_RATE; t++) {
        kiln.recipe = 'fireGlass'; kiln.inBuf.sand = 4; kiln.out = 0;
        if (fuelAll) for (const q of gens) q.inBuf.coal = 4;
        else gens[0].inBuf.coal = 4;
        g.tick();
      }
      return billsStanding(g);
    };
    const one = play(false);
    const all = play(true);
    console.log(`[pace] ${n} generators (${n * 2600} coin) for one kiln: bills ${Math.round(one)} with one fuelled, ${Math.round(all)} with all fuelled`);
    expect(n).toBeGreaterThanOrEqual(100);
    // the kiln (3,000), its share of the one generator it needs (60 of 200 kW), a few poles
    for (const b of [one, all]) {
      expect(b).toBeLessThan(3000 + 2 * 2600 + 2000);
      expect(added(14000, b)).toBeLessThan(0.5);
    }
  });

  it('idle, starved and blocked buildings count for nothing; a line counts once it has run the window', () => {
    const g = sandbox();
    for (let x = 8; x < 20; x++) must(g, { k: 'place', kind: 'assembler', x, y: 8, rot: 0 });
    g.step(6 * 60 * TICK_RATE);
    expect(billsStanding(g)).toBe(0);
    ironLine(g);
    g.step(61 * TICK_RATE);
    const early = billsStanding(g);
    g.step(5 * 60 * TICK_RATE);
    const full = billsStanding(g);
    // the miner (40), the smelter (60), the heap (25) and the belts (12): a fifth after a minute
    expect(early).toBeGreaterThan(0);
    expect(early).toBeLessThan(full * 0.5);
    expect(full).toBeGreaterThan(100);
    expect(full).toBeLessThanOrEqual(40 + 60 + 25 + 12 + 1e-6);
  });
});

describe('Overdrive never reaches an audited line (DESIGN.md §10 Select)', () => {
  for (const quick of [false, true]) {
    it(`a Workshop line overdriven just before its audit folds at its own rate${quick ? ' (Quick Audits: 5 s warm-up, shorter than Overdrive)' : ''}`, () => {
      const plain = foldIron(quick, false);
      const hot = foldIron(quick, true);
      const r0 = plain.outs.ironIngot!, r1 = hot.outs.ironIngot!;
      expect(r1).toBeLessThanOrEqual(r0 * 1.02);
      expect(designValue(hot)!.value).toBeLessThanOrEqual(designValue(plain)!.value + 1e-9);
    });
  }

  it('a group of modules overdriven just before its nested audit folds at its own rate (Quick Audits)', () => {
    const run = (od: boolean) => {
      const g = sandbox();
      g.s.meta.nodes.push('quickAudit');
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
      g.step(10 * TICK_RATE);
      if (od) must(g, { k: 'fclick', x: 4, y: 1 });
      must(g, { k: 'faudit', x: 4, y: 1, w: 2, h: 2 });
      g.step(auditTicks(g) + 1);
      return g.s.faudit!.result!.outs.ironPlate!;
    };
    const plain = run(false), hot = run(true);
    expect(plain).toBeGreaterThan(0.4);
    expect(hot).toBeLessThanOrEqual(plain * 1.02);
  });
});
