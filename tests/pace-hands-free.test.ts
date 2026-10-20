// DESIGN.md §13 check 2: the first Miner (which ends the clicking) by 2:00.
import { describe, expect, it } from 'vitest';
import { milestone } from './pace-helpers';

describe('pace: hands-free (§13 check 2)', () => {
  it('the first Miner is placed by 2:00', () => {
    const s = milestone('planner', 'miner', 300);
    expect(s.reached).toBe(s.n);
    expect(s.mean).toBeLessThanOrEqual(120);
  });
});
