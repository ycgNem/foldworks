// DESIGN.md §13 check 6, the fold half: the planner's first fold by 40:00 (mean of 50 seeds). After
// Folding it audits C4, its last copper line (box 12,0 1x3: a miner, a smelter and a press; slag
// leaves by heaps outside the box), and folds it into "Copper wire".
import { describe, expect, it } from 'vitest';
import { milestone } from './pace-helpers';

describe('pace: first fold (§13 check 6, fold half)', () => {
  it('the planner folds its first line by 40:00', () => {
    const s = milestone('planner', 'fold', 3600);
    expect(s.reached).toBe(s.n);
    expect(s.mean).toBeLessThanOrEqual(40 * 60);
  });
});
