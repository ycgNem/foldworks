// DESIGN.md §13 check 6, the fold half: the planner's first fold by 8:00 (mean of 50 seeds), so a
// first-time player (about half the planner's pace at research, §16) folds within 8-16 min. Folding
// is node 2 (the playability pass); the planner audits L2, its first plate line (box 2,2 3x1: a
// miner, a smelter and a press; slag leaves by a heap outside the box), folds it into "Iron plates",
// which goes to work beside the Factory Dock by itself (§10 The first fold), and stamps its free
// first copy.
import { describe, expect, it } from 'vitest';
import { at, describe2, runsUntil, spread } from './pace-helpers';

describe('pace: first fold (§13 check 6, fold half)', () => {
  const runs = runsUntil('planner', 'fold', 1200);
  const s = spread(at(runs, 'fold'), 1200);
  console.log(`[pace] planner ${describe2('fold', s)}`);
  it('the planner folds its first line by 8:00 (mean)', () => {
    expect(s.reached).toBe(s.n);
    expect(s.mean).toBeLessThanOrEqual(8 * 60);
  });
  it('the first module goes to work beside the Factory Dock at once, and grades S or better', () => {
    for (const r of runs.slice(0, 5)) {
      const d = r.g.s.designs[0];
      expect(d.name).toBe('Iron plates');
      expect(['S', 'S+']).toContain(d.grade.letter);
      const placed = r.g.s.factory.ents.filter((e) => e.kind === 'module' && e.design === d.id);
      expect(placed.length).toBeGreaterThanOrEqual(1);
    }
  });
});
