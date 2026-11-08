// DESIGN.md §13 check 6, the research half: Folding is node 2 (the playability pass, DECISIONS.md),
// 40 plates after Pressing, so the first fold comes in the first minutes (§16's first row). The
// planner researches it by 6:00 (mean of 50 seeds) and by 8:00 on every seed; the Dock-only player
// (who feeds the Hopper only while its plan waits on research) by 8:00 too.
import { describe, expect, it } from 'vitest';
import { milestone } from './pace-helpers';

describe('pace: Folding researched (§13 check 6, research half)', () => {
  it('Folding is researched by 6:00 (planner mean), and by 8:00 on every seed', () => {
    const s = milestone('planner', 'research:folding', 1200);
    expect(s.reached).toBe(s.n);
    expect(s.mean).toBeLessThanOrEqual(6 * 60);
    expect(s.max).toBeLessThanOrEqual(8 * 60);
  });
  it('the Dock-only player researches Folding by 8:00 (mean)', () => {
    const s = milestone('dockOnly', 'research:folding', 1200);
    expect(s.reached).toBe(s.n);
    expect(s.mean).toBeLessThanOrEqual(8 * 60);
  });
});
