// DESIGN.md §13 check 3: the first research (Pressing, 30 iron ingots into the Hopper) by 6:00.
// The planner turns the furnace line to the Hopper once its first miner runs; the Dock-only player
// does it only when its plan waits on Pressing, so it is checked too.
import { describe, expect, it } from 'vitest';
import { milestone } from './pace-helpers';

describe('pace: first research (§13 check 3)', () => {
  it('Pressing is researched by 6:00 (planner)', () => {
    const s = milestone('planner', 'research:pressing', 900);
    expect(s.reached).toBe(s.n);
    expect(s.mean).toBeLessThanOrEqual(360);
  });
  it('Pressing is researched by 6:00 (dock-only)', () => {
    const s = milestone('dockOnly', 'research:pressing', 900);
    expect(s.mean).toBeLessThanOrEqual(360);
  });
});
