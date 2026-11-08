// The second playtest (2026-11-08, DECISIONS.md "the second playtest's fixes"): each rule it changed,
// pinned by a test.
import { describe, expect, it } from 'vitest';
import { Game, type Cmd } from '../src/sim/Game';
import { N } from '../src/engine/num';
import { RESEARCH_IDS, RESEARCH } from '../src/data/research';
import { CHUNKS } from '../src/data/land';
import { RULES } from '../src/data/rules';
import { TICK_RATE } from '../src/engine/time';
import { runDocks } from '../src/sim/systems/docks';
import { chuteCap } from '../src/sim/systems/modules';
import { nextRunPace } from '../src/sim/reorganize';
import { claimFix } from '../src/sim/systems/claims';
import { article, aWord } from '../src/engine/fmt';
import { nextGoal } from '../src/app/goals';
import type { ModuleDesign, RunRecord } from '../src/sim/world';

function must(g: Game, c: Cmd) {
  const r = g.act(c);
  if (!r.ok) throw new Error(`${JSON.stringify(c)}: ${r.why}`);
}

/** Every research, all land, the Factory open: a floor to build on. */
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

function design(g: Game, over: Partial<ModuleDesign>): ModuleDesign {
  const d: ModuleDesign = {
    id: g.s.nextDesign++, name: 'D', box: { x: 0, y: 0, w: 2, h: 1 }, parts: [], ins: {}, outs: {},
    grade: { letter: 'B', score: 0.7, u: 1, w: 1, c: 1, mult: 1 }, bill: 1000, stamped: 0, spare: 4, depth: 2, ...over,
  };
  g.s.designs.push(d);
  return d;
}

describe('the Hopper pays like the Dock until the first fold (§8)', () => {
  it('pays for what it takes, banked items too, after Pressing and before the first fold; nothing after', () => {
    const g = new Game(3);
    g.s.research.done = ['pressing'];
    g.s.research.selected = 'folding';
    const before = g.s.coin.toNumber();
    // ingots, which Folding (plates) does not take: banked, and paid
    g.intake.push({ to: 'hopper', item: 'ironIngot', x: 0, y: 0, n: N(10) });
    runDocks(g);
    expect(g.s.research.bank.ironIngot?.toNumber()).toBe(10);
    expect(g.s.coin.toNumber()).toBeGreaterThan(before);
    g.s.flags.push('firstFold');
    const mid = g.s.coin.toNumber();
    g.intake.push({ to: 'hopper', item: 'ironIngot', x: 0, y: 0, n: N(10) });
    runDocks(g);
    expect(g.s.coin.toNumber()).toBe(mid);
  });
});

describe('the frog says when income is 0 while lines feed the Hopper', () => {
  it('names it, with the fix', () => {
    const g = new Game(5);
    g.s.upgrades.push('bellows');
    g.s.flags.push('firstSale');
    g.s.income = Array(60).fill(0);
    nextGoal(g);
    g.s.research.bank.ironIngot = N(12);
    g.s.tick += 4 * TICK_RATE;
    const goal = nextGoal(g);
    expect(goal?.text).toMatch(/No coin coming in/);
    expect(goal?.chips?.join(' ')).toMatch(/Dock/);
    // income back: the line goes
    g.s.income = Array(60).fill(3);
    expect(nextGoal(g)?.text ?? '').not.toMatch(/No coin/);
  });
});

describe('the Factory Chute never jams the floor (§21)', () => {
  it('a module trunked into a Chute with no Mouth keeps working; what the stock cannot hold sells at the Factory Dock', () => {
    const g = sandbox();
    const d = design(g, { depth: 1, outs: { motor: 2 } });
    must(g, { k: 'fplace', design: d.id, x: 3, y: 3, rot: 0 });
    must(g, { k: 'fchute', x: 4, y: 3 });
    const earned = g.s.earned.toNumber();
    g.step(30 * TICK_RATE);
    const m = g.s.factory.ents.find((e) => e.kind === 'module')!;
    expect(m.state).toBe('work');
    expect(g.s.chute!.motor ?? 0).toBeLessThanOrEqual(chuteCap(g) + 1e-9);
    expect(g.s.earned.toNumber()).toBeGreaterThan(earned);
  });

  it('what no Dock buys (Drill Bits) still fills the stock and backs up', () => {
    const g = sandbox();
    const d = design(g, { depth: 1, outs: { drillBit: 2 } });
    must(g, { k: 'fplace', design: d.id, x: 3, y: 3, rot: 0 });
    must(g, { k: 'fchute', x: 4, y: 3 });
    g.step(30 * TICK_RATE);
    const m = g.s.factory.ents.find((e) => e.kind === 'module')!;
    expect(m.state).toBe('blocked');
  });
});

describe("the Reorganize card's 'back in' (§19)", () => {
  const rec = (over: Partial<RunRecord>): RunRecord => ({ run: 1, ticks: 1000, patents: 1, earned: N(1), peakPerMin: 1000, ...over }) as RunRecord;
  it('a catch-up measured against a record from before the returning run is not used: the model', () => {
    const g = new Game(9);
    g.s.meta.history = [rec({})];
    g.s.meta.caughtUp = 455 * 60;
    const p = nextRunPace(g);
    expect(p.measured).toBe(false);
    expect(p.minutes).toBe(RULES.backInMinutes.value);
  });
  it('an honest catch-up is used, and none past the cap is shown', () => {
    const g = new Game(9);
    g.s.meta.history = [rec({ factoryPeak: 900 })];
    g.s.meta.caughtUp = 11 * 60;
    expect(nextRunPace(g)).toMatchObject({ measured: true, minutes: 11 });
    g.s.meta.caughtUp = 3 * 3600;
    expect(nextRunPace(g).minutes).toBeNull();
  });
});

describe('a claim short names the nearest visible step', () => {
  it('Surveying before its page opens: the node on the way; then the chunk with a deposit; then Surveying', () => {
    const g = new Game(4);
    g.s.research.done = RESEARCH_IDS.filter((r) => (RESEARCH[r].act ?? 1) === 1 && r !== 'gizmoTheory');
    expect(claimFix(g, 'ironOre')).toMatch(/after Gizmo Theory/);
    (g.s.research.done as string[]).push('gizmoTheory');
    expect(claimFix(g, 'ironOre')).toMatch(/Chunk C/);
    g.s.land.push('C');
    expect(claimFix(g, 'ironOre')).toMatch(/after Coal Seams/);
    (g.s.research.done as string[]).push('coalSeams');
    expect(claimFix(g, 'ironOre')).toMatch(/research Surveying/);
  });
  it('a or an by the sound', () => {
    expect(article('iron')).toBe('an');
    expect(aWord('Assembler')).toBe('an Assembler');
    expect(aWord('Smelter')).toBe('a Smelter');
    expect(article('Unit 7')).toBe('a');
  });
});
