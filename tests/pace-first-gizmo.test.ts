// DESIGN.md §13 check 5: the first Gizmo (1 gear + 2 wire, after Gizmo Theory) delivered by 20:00.
import { describe, expect, it } from 'vitest';
import { milestone } from './pace-helpers';

describe('pace: first Gizmo (§13 check 5)', () => {
  it('the first Gizmo is delivered by 20:00 (planner)', () => {
    const s = milestone('planner', 'gizmo', 2400);
    expect(s.reached).toBe(s.n);
    expect(s.mean).toBeLessThanOrEqual(1200);
  });
});
