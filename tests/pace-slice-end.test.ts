// DESIGN.md §13 check 9, slice end (the rule in DECISIONS.md, the Milestone 1-2 review; the sim's
// 'sliceEnd' flag, `sliceEndParts` in systems/modules.ts): modules making three different products
// run on the Factory floor, one feeding another, each at half speed or better for 30 s, all reaching
// the Factory Dock. After Folding the bots fold "Copper wire" (a miner, smelter and press), "Iron
// ingots" (miners and smelters only) and "Gear works" (presses and an assembler, ingots in); on the
// floor the ingots feed the gear works from behind, their slag leaves by a side trunk into the Dock,
// and the wire and the gears go into the Dock (bot.ts PLAN).
//
// The window is §13's revised one: by 45 min (mean), and no sooner than 4 min after Folding is
// researched (three audits of 70 s, one at a time, and 30 s of running: the floor phase the critic
// found missing when the slice ended 15 s after the first fold). §13 says why 60-90 min is out of
// reach of the Act I numbers.
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

  it('the planner ends the slice on every seed: three products, chained, into the Factory Dock', () => {
    expect(end.reached).toBe(end.n);
  });
  it('it ends by 45 min (mean), and no sooner than 4 min after Folding on any seed', () => {
    expect(end.mean).toBeLessThanOrEqual(45 * 60);
    expect(afterFolding.min).toBeGreaterThanOrEqual(4 * 60);
  });
  it('the greedy and Dock-only players end the slice too, by 60 min', () => {
    for (const policy of ['greedy', 'dockOnly'] as const) {
      const s = spread(at(runsUntil(policy, 'sliceEnd', 60 * 60, SEEDS.slice(0, 10)), 'sliceEnd'), 60 * 60);
      console.log(`[pace] ${policy} ${describe2('sliceEnd', s)}`);
      expect(s.reached).toBe(s.n);
    }
  });
});
