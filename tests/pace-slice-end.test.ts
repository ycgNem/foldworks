// DESIGN.md §13 check 9, slice end (DECISIONS.md, the gate's blocking findings; the sim's 'sliceEnd'
// flag, `sliceEndCheck` in systems/modules.ts): Bramble's Gizmo Festival is filled, 400 Gizmos
// delivered to the Factory Dock (the Workshop Dock's don't count). After Folding the bots audit
// three lines at once and fold "Copper wire", "Iron ingots" and "Gizmo works" (ingots and wire in),
// then build Gizmo chains on the Factory floor, one folded and four stamped (bot.ts PLAN).
//
// The window: by 45 min (planner mean), and no sooner than 6 min after Folding on any seed (three
// audits at once, then the floor built and 400 Gizmos made: a floor phase, not an audit timer).
import { describe, expect, it } from 'vitest';
import { at, describe2, mmss, runsUntil, SEEDS, spread } from './pace-helpers';

describe('pace: slice end (§13 check 9)', () => {
  const runs = runsUntil('planner', 'sliceEnd', 75 * 60);
  const end = spread(at(runs, 'sliceEnd'), 75 * 60);
  const phase = spread(runs.map((r) => (r.bot.log.at.sliceEnd ?? Infinity) - r.bot.log.at.fold));
  const afterFolding = spread(runs.map((r) => (r.bot.log.at.sliceEnd ?? Infinity) - r.bot.log.at['research:folding']));
  console.log(`[pace] planner ${describe2('sliceEnd', end)}`);
  console.log(`[pace] planner Folding -> slice end: mean ${mmss(afterFolding.mean)}, min ${mmss(afterFolding.min)}, max ${mmss(afterFolding.max)}; first fold -> slice end: mean ${mmss(phase.mean)}`);
  const d = runs[0].g.s.designs.map((q) => `${q.name} ${q.grade.letter} (${q.grade.score.toFixed(2)})`).join(', ');
  console.log(`[pace] planner seed ${runs[0].seed} designs: ${d}`);

  it('the planner ends the slice on every seed: the Gizmo Festival filled at the Factory Dock', () => {
    expect(end.reached).toBe(end.n);
  });
  it('it ends by 45 min (mean), and no sooner than 6 min after Folding on any seed', () => {
    expect(end.mean).toBeLessThanOrEqual(45 * 60);
    expect(afterFolding.min).toBeGreaterThanOrEqual(6 * 60);
  });
  it('the greedy and Dock-only players end the slice too, by 60 min', () => {
    for (const policy of ['greedy', 'dockOnly'] as const) {
      const s = spread(at(runsUntil(policy, 'sliceEnd', 60 * 60, SEEDS.slice(0, 10)), 'sliceEnd'), 60 * 60);
      console.log(`[pace] ${policy} ${describe2('sliceEnd', s)}`);
      expect(s.reached).toBe(s.n);
    }
  });
});
