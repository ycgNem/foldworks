// Challenges v1 (DESIGN.md §21 Challenges): a run taken at a Reorganize under one restriction,
// until its goal is met; the reward is kept for good, and giving up costs nothing but the reward.
import { describe, expect, it } from 'vitest';
import { Game } from '../src/sim/Game';
import { N } from '../src/engine/num';
import { TICK_RATE } from '../src/engine/time';
import { CHUNKS } from '../src/data/land';
import { BUILD } from '../src/data/machines';
import { CHALLENGES, CHALLENGE_IDS } from '../src/data/challenges';
import { prules } from '../src/sim/patents';
import { foldRefusal } from '../src/sim/systems/audits';
import { buildPrice, powerMult } from '../src/sim/systems/challenges';
import { SCENARIOS, SCENARIO_IDS } from '../src/data/scenarios';
import { scenarioMiners, beltsLeft, scenarioBest } from '../src/sim/scenario';

/** A game after one Reorganize, with Patents to bank so a second one is allowed. */
function ready(seed = 3) {
  const g = new Game(seed);
  g.s.meta.runs = 1;
  g.s.megaPatents = 3;
  return g;
}

function take(g: Game, id: (typeof CHALLENGE_IDS)[number]) {
  const r = g.act({ k: 'reorganize', challenge: id });
  if (!r.ok) throw new Error(r.why);
  g.s.coin = N(1e6);
  g.s.land = CHUNKS.map((c) => c.id);
  g.step(1);
}

const freeTile = (g: Game) => {
  for (let y = 8; y < 30; y++) for (let x = 8; x < 30; x++) if (g.owned(x, y) && !g.entAt(x, y) && !g.oreAt(x, y)) return { x, y };
  throw new Error('no free tile');
};

describe('Challenges (DESIGN.md §21)', () => {
  it('every Challenge has a rule, a goal, a reward and a derivation', () => {
    for (const id of CHALLENGE_IDS) {
      const c = CHALLENGES[id];
      expect(c.rule.length).toBeGreaterThan(10);
      expect(c.reward.length).toBeGreaterThan(10);
      expect(c.derivation).toMatch(/§21/);
    }
  });

  it('opens after the first Reorganize', () => {
    const g = new Game(1);
    g.s.megaPatents = 3;
    expect(g.act({ k: 'reorganize', challenge: 'noSplitters' }).why).toMatch(/after your first Reorganize/);
  });

  it('No Splitters: refused while it holds; won with the Festival; then Splitters are free', () => {
    const g = ready();
    take(g, 'noSplitters');
    g.s.research.done.push('splitters');
    const t = freeTile(g);
    expect(g.act({ k: 'place', kind: 'splitter', x: t.x, y: t.y, rot: 0 }).why).toMatch(/No Splitters/);
    g.s.orders.done.push('gizmoFestival');
    g.step(TICK_RATE);
    expect(g.s.challenge).toBeNull();
    expect(g.s.meta.challenges).toContain('noSplitters');
    expect(buildPrice(g, 'splitter')).toBe(0);
    const coin = g.s.coin;
    expect(g.act({ k: 'place', kind: 'splitter', x: t.x, y: t.y, rot: 0 }).ok).toBe(true);
    expect(g.s.coin.eq(coin)).toBe(true);
    // a won Challenge isn't taken again
    g.s.megaPatents = 3;
    expect(g.act({ k: 'reorganize', challenge: 'noSplitters' }).why).toMatch(/won already/);
  });

  it('Hands Off: no click counts; starts with the Bellows and a Miner\'s coin; the Bellows is kept', () => {
    const g = ready();
    expect(g.act({ k: 'reorganize', challenge: 'handsOff' }).ok).toBe(true);
    expect(g.s.upgrades).toContain('bellows');
    expect(g.s.coin.gte(BUILD.miner.cost)).toBe(true);
    const f = g.s.ents.find((e) => e.kind === 'furnace')!;
    expect(g.act({ k: 'click', x: f.x, y: f.y }).why).toMatch(/Hands Off/);
    expect(g.countClick()).toBe(false);
    g.s.research.done.push('folding');
    g.step(TICK_RATE);
    expect(g.s.meta.challenges).toContain('handsOff');
    expect(g.countClick()).toBe(true);
    // every later run starts with the Bellows
    g.s.megaPatents = 3;
    expect(g.act({ k: 'reorganize' }).ok).toBe(true);
    expect(g.s.upgrades).toContain('bellows');
  });

  it('Lean Power: producers make half while it holds, a tenth more once won', () => {
    const g = ready();
    take(g, 'leanPower');
    expect(powerMult(g)).toBe(0.5);
    g.s.research.done.push('circuits');
    g.step(TICK_RATE);
    expect(powerMult(g)).toBeCloseTo(1.1);
  });

  it('Three Kinds: a fourth kind of machine is refused (Mk2s are their family); won, machines are 10% off', () => {
    const g = ready();
    take(g, 'threeKinds');
    g.s.research.done.push('pressing', 'gearcutting');
    const placeOn = (kind: 'smelter' | 'press' | 'assembler') => {
      const t = freeTile(g);
      return g.act({ k: 'place', kind, x: t.x, y: t.y, rot: 0 });
    };
    // a Miner on an ore patch
    let mined = false;
    for (let y = 0; y < 40 && !mined; y++) for (let x = 0; x < 40 && !mined; x++) if (g.owned(x, y) && g.oreAt(x, y) && !g.entAt(x, y)) mined = g.act({ k: 'place', kind: 'miner', x, y, rot: 0 }).ok;
    expect(mined).toBe(true);
    expect(placeOn('smelter').ok).toBe(true);
    expect(placeOn('press').ok).toBe(true);
    expect(placeOn('smelter').ok).toBe(true);
    expect(placeOn('assembler').why).toMatch(/Three kinds/);
    g.s.counters.foldS = (g.s.challengeBase ?? 0) + 1;
    g.step(TICK_RATE);
    expect(g.s.meta.challenges).toContain('threeKinds');
    expect(buildPrice(g, 'assembler')).toBe(Math.ceil(BUILD.assembler.cost * 0.9));
    expect(placeOn('assembler').ok).toBe(true);
  });

  it('Small Boxes: a 5x5 fold box is refused while it holds; won, the box is a tile larger', () => {
    const g = ready();
    const before = prules(g).foldMax;
    take(g, 'smallBoxes');
    g.s.research.done.push('folding');
    expect(prules(g).foldMax).toBe(4);
    expect(foldRefusal(g, { x: 0, y: 0, w: 5, h: 5 })).toMatch(/at most 4x4/);
    g.s.orders.done.push('gizmoFestival');
    g.step(TICK_RATE);
    expect(prules(g).foldMax).toBe(before + 1);
  });

  it('giving up ends the restriction without the reward', () => {
    const g = ready();
    take(g, 'noSplitters');
    expect(g.act({ k: 'challengeQuit' }).ok).toBe(true);
    expect(g.s.challenge).toBeNull();
    expect(g.s.meta.challenges ?? []).not.toContain('noSplitters');
    expect(g.act({ k: 'challengeQuit' }).why).toMatch(/not a Challenge/);
  });
});

describe('Scenarios (DESIGN.md §21)', () => {
  it('lays each board out: its land, research, coin, and no Reorganize or land to buy', () => {
    for (const id of SCENARIO_IDS) {
      const d = SCENARIOS[id];
      const g = new Game(5, { scenario: id });
      expect(g.s.scenario).toBe(id);
      expect([...g.s.land].sort()).toEqual([...d.land].sort());
      expect(g.done('folding')).toBe(true);
      expect(g.done('greatDrill')).toBe(false);
      expect(g.s.coin.eq(d.coin)).toBe(true);
      g.s.megaPatents = 3;
      expect(g.act({ k: 'reorganize' }).why).toMatch(/Scenario/);
      expect(g.act({ k: 'land', id: 'F' }).ok).toBe(false);
    }
  });

  it('Rich Ore digs twice as fast; Little Power halves the plant', () => {
    expect(scenarioMiners(new Game(5, { scenario: 'richOre' }))).toBe(2);
    expect(powerMult(new Game(5, { scenario: 'richOre' }))).toBe(0.5);
    expect(scenarioMiners(new Game(5))).toBe(1);
  });

  it('Scarce Belts stops at 40 belt tiles', () => {
    const g = new Game(5, { scenario: 'scarceBelts' });
    const have = g.s.ents.filter((e) => e.kind === 'belt').length;
    let laid = 0;
    for (let y = 9; y < 16 && have + laid < 40; y++) for (let x = 9; x < 23 && have + laid < 40; x++) if (!g.entAt(x, y) && !g.oreAt(x, y) && g.act({ k: 'place', kind: 'belt', x, y, rot: 0 }).ok) laid++;
    expect(have + laid).toBe(40);
    expect(beltsLeft(g)).toBe(0);
    expect(g.act({ k: 'place', kind: 'belt', x: 20, y: 15, rot: 0 }).why).toMatch(/No belt tiles left/);
  });

  it('scores the best fold of its product: per tile of box on Tiny Island', () => {
    const g = new Game(5, { scenario: 'tinyIsland' });
    expect(scenarioBest(g)).toBeNull();
    const grade = { letter: 'A', score: 0.8, u: 1, w: 1, c: 1, mult: 1.1 };
    g.s.designs.push({ id: 1, name: 'G', box: { x: 0, y: 0, w: 4, h: 3 }, parts: [], ins: {}, outs: { gizmo: 0.5 }, grade, bill: 0, stamped: 0, spare: 1 });
    g.s.designs.push({ id: 2, name: 'G2', box: { x: 0, y: 0, w: 2, h: 3 }, parts: [], ins: {}, outs: { gizmo: 0.3 }, grade, bill: 0, stamped: 0, spare: 1 });
    const b = scenarioBest(g)!;
    expect(b.design).toBe(2);
    expect(b.score).toBeCloseTo((0.3 * 60) / 6);
  });
});
