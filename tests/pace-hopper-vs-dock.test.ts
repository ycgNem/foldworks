// DESIGN.md §13 check 11, Hopper versus Dock: a player who sends everything to the Dock (and feeds
// the Hopper only while its plan is stuck on research, one node at a time) still reaches Gizmo
// Theory by 60 min (the Hopper is a choice, not a trap), but at least 5 min behind the planner, who
// keeps a line on the Hopper whenever research needs it. Measured at Gizmo Theory since the
// playability pass (Folding is node 2, 40 plates: both players reach it within a minute of each
// other); Gizmo Theory is the node that opens the full fold box, the Festival and chunk C, the last
// of Act I's research the slice needs (§8).
import { describe, expect, it } from 'vitest';
import { at, describe2, runsUntil, spread } from './pace-helpers';

const CAP = 90 * 60;

describe('pace: Hopper versus Dock (§13 check 11)', () => {
  const planner = spread(at(runsUntil('planner', 'research:gizmoTheory', CAP), 'research:gizmoTheory'), CAP);
  const dock = spread(at(runsUntil('dockOnly', 'research:gizmoTheory', CAP), 'research:gizmoTheory'), CAP);
  console.log(`[pace] ${describe2('planner Gizmo Theory', planner)}`);
  console.log(`[pace] ${describe2('dock-only Gizmo Theory', dock)}`);
  console.log(`[pace] dock-only is ${((dock.mean - planner.mean) / 60).toFixed(1)} min behind the planner (target 5+)`);

  it('the Dock-only player still researches Gizmo Theory by 60 min', () => {
    expect(dock.reached).toBe(dock.n);
    expect(dock.mean).toBeLessThanOrEqual(3600);
  });
  it('the Dock-only player is at least 5 min behind the planner', () => {
    expect(dock.mean - planner.mean).toBeGreaterThanOrEqual(5 * 60);
  });
});
