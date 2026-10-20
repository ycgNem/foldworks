// DESIGN.md §13 check 6, the research half: Folding researched by 35:00, and (the balance window
// set with the x2 research costs of nodes 3-10, §8) at 22-30 min for the planner, mean of 50 seeds.
import { describe, expect, it } from 'vitest';
import { milestone } from './pace-helpers';

describe('pace: Folding researched (§13 check 6, research half)', () => {
  it('Folding is researched at 22-30 min (planner), and by 35:00 on every seed', () => {
    const s = milestone('planner', 'research:folding', 3600);
    expect(s.reached).toBe(s.n);
    expect(s.mean).toBeGreaterThanOrEqual(22 * 60);
    expect(s.mean).toBeLessThanOrEqual(30 * 60);
    expect(s.max).toBeLessThanOrEqual(35 * 60);
  });
});
