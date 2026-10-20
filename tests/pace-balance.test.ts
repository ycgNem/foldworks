// DESIGN.md §13 check 7, balance beats buying: the balanced 4-smelter / 3-press plate line with its
// slag handled folds at A or better; the same machines with an unbalanced ratio, or with their slag
// backing up, fold at C or worse.
//
// The line (box x 9-12, y 2-9, beside the Hopper): four miners on chunk C's patch send 120 ore/min
// up column 15, split into two lanes into ore splitters at (12,3) and (12,6), each feeding the
// smelters above and below it. The smelters face west; their slag leaves by the back into heaps
// outside the box. Their ingots run down column 10 into a splitter at (10,8) that feeds three
// presses at 40/min each, whose plates run to the Hopper. Miners sit outside the box (ore enters
// by ports), so U is the smelters' and presses' busy fraction.
//
//      9 10 11 12 13
//   2  .  v  <  s  h      s smelter facing west, S splitter, p press, h slag heap
//   3  .  v  .  S  <      ore lane
//   4  .  v  <  s  h
//   5  .  v  <  s  h
//   6  .  v  .  S  <      ore lane
//   7  .  v  <  s  h
//   8  p  S  p  .  .
//   9  <  p  >  v  .
import { describe, expect, it } from 'vitest';
import { Game, type Cmd } from '../src/sim/Game';
import { N } from '../src/engine/num';
import { RESEARCH_IDS } from '../src/data/research';
import { CHUNKS } from '../src/data/land';
import { TICK_RATE } from '../src/engine/time';
import { auditTicks } from '../src/sim/systems/audits';
import type { BuildKind } from '../src/data/machines';
import type { Dir } from '../src/sim/world';

const E: Dir = 0, S: Dir = 1, W: Dir = 2, Nn: Dir = 3;

function sandbox() {
  const g = new Game(1);
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
const put = (g: Game, kind: BuildKind, x: number, y: number, rot: Dir) => must(g, { k: 'place', kind, x, y, rot });
const belts = (g: Game, pts: [number, number, Dir][]) => pts.forEach(([x, y, r]) => put(g, 'belt', x, y, r));

/** balanced: the layout above. ratio: the ingot splitter replaced by a belt, so one press gets every
 * ingot. slag: no heaps, so slag backs up into the smelters. Same machines in all three. */
function build(variant: 'balanced' | 'ratio' | 'slag') {
  const g = sandbox();
  put(g, 'miner', 3, 11, E);
  put(g, 'miner', 3, 12, E);
  put(g, 'miner', 2, 11, Nn);
  put(g, 'miner', 2, 12, S);
  belts(g, [[2, 10, E], [3, 10, E], [4, 10, S], [4, 11, S], [4, 12, S], [2, 13, E], [3, 13, E], [4, 13, E]]);
  for (let x = 5; x <= 14; x++) belts(g, [[x, 13, E]]);
  for (let y = 13; y >= 7; y--) belts(g, [[15, y, Nn]]);
  put(g, 'splitter', 15, 6, Nn);
  belts(g, [[14, 6, W], [13, 6, W], [15, 5, Nn], [15, 4, Nn], [15, 3, W], [14, 3, W], [13, 3, W]]);
  for (const y of [2, 4, 5, 7]) put(g, 'smelter', 12, y, W);
  put(g, 'splitter', 12, 3, W);
  put(g, 'splitter', 12, 6, W);
  if (variant !== 'slag') for (const y of [2, 4, 5, 7]) put(g, 'heap', 13, y, W);
  for (const y of [2, 4, 5, 7]) belts(g, [[11, y, W]]);
  belts(g, [[10, 2, S], [10, 3, S], [10, 4, S], [10, 5, S], [10, 6, S], [10, 7, S]]);
  if (variant === 'ratio') belts(g, [[10, 8, S]]);
  else put(g, 'splitter', 10, 8, S);
  put(g, 'press', 10, 9, W);
  put(g, 'press', 11, 8, S);
  put(g, 'press', 9, 8, W);
  belts(g, [[9, 9, W], [11, 9, E], [12, 9, S], [12, 10, W], [11, 10, W], [10, 10, W], [9, 10, W], [8, 10, Nn], [8, 9, Nn], [8, 8, Nn], [8, 7, Nn], [8, 6, Nn], [8, 5, W]]);
  return g;
}

function audit(variant: 'balanced' | 'ratio' | 'slag') {
  const g = build(variant);
  g.step(60 * TICK_RATE);
  must(g, { k: 'audit', x: 9, y: 2, w: 4, h: 8 });
  g.step(auditTicks());
  const r = g.s.audit!.result!;
  const gr = r.grade;
  console.log(`[pace] ${variant}: ${gr.letter} score ${gr.score.toFixed(3)} (U ${gr.u.toFixed(3)}, W ${gr.w.toFixed(3)}, C ${gr.c.toFixed(3)}), plates ${((r.outs.ironPlate ?? 0) * 60).toFixed(0)}/min`);
  return r;
}

describe('pace: balance beats buying (§13 check 7)', () => {
  it('the balanced 4-smelter / 3-press line with slag handled grades A or better', () => {
    const r = audit('balanced');
    expect(['S', 'A']).toContain(r.grade.letter);
    expect(r.outs.ironPlate! * 60).toBeGreaterThan(110);
  });
  it('the same machines with every ingot on one press grade C or worse', () => {
    expect(['C', 'D']).toContain(audit('ratio').grade.letter);
  });
  it('the same machines with their slag backing up grade C or worse', () => {
    // U = 0 and W = 0: a line jammed by its slag makes none in the window, but the audit counts the
    // slag its blocked smelters would have made (systems/audits.ts gradeAudit)
    expect(['C', 'D']).toContain(audit('slag').grade.letter);
  });
});
