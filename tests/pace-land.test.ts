// DESIGN.md §13 check 4: chunk B (copper, 1,000 coin after Survey East) bought by 12:00.
import { describe, expect, it } from 'vitest';
import { milestone } from './pace-helpers';

describe('pace: land (§13 check 4)', () => {
  it('chunk B is bought by 12:00 (planner)', () => {
    const s = milestone('planner', 'landB', 1800);
    expect(s.reached).toBe(s.n);
    expect(s.mean).toBeLessThanOrEqual(720);
  });
});
