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
import { designValue } from '../src/sim/reorganize';
import type { Dir, ModuleDesign } from '../src/sim/world';

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
