// DESIGN.md §13 check 1: an active bot (4 clicks/s, hand-mining and cranking) buys the Bellows in
// 20-40 s. Sparks start at 3 min, so nothing random happens before it: every seed agrees.
import { describe, expect, it } from 'vitest';
import { milestone } from './pace-helpers';

describe('pace: first purchase (§13 check 1)', () => {
  it('the Bellows is bought in 20-40 s', () => {
    const s = milestone('planner', 'bellows', 120);
    expect(s.reached).toBe(s.n);
    expect(s.mean).toBeGreaterThanOrEqual(20);
    expect(s.mean).toBeLessThanOrEqual(40);
  });
});
