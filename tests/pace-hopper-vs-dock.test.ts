// DESIGN.md §13 check 11, Hopper versus Dock: a player who sends everything to the Dock (and feeds
// the Hopper only while its plan is stuck on research, one node at a time) still reaches Gizmo
// Theory by 60 min (the Hopper is a choice, not a trap), but behind the planner, who keeps a line
// on the Hopper whenever research needs it, by at least a quarter of the planner's time to it. It was
// 5 min of the planner's ~27 to Folding (18%); Act I's research is half as long now (Gizmo Theory at
// ~13.5 min), and a quarter of it is ~3.4 min (DESIGN.md §13 check 11). Measured at Gizmo Theory since the
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
  console.log(`[pace] dock-only is ${((dock.mean - planner.mean) / 60).toFixed(1)} min behind the planner (target ${(planner.mean / 4 / 60).toFixed(1)}+, a quarter of the planner's time)`);

  it('the Dock-only player still researches Gizmo Theory by 60 min', () => {
    expect(dock.reached).toBe(dock.n);
    expect(dock.mean).toBeLessThanOrEqual(3600);
  });
  it("the Dock-only player is behind the planner by at least a quarter of the planner's time", () => {
    expect(dock.mean - planner.mean).toBeGreaterThanOrEqual(planner.mean / 4);
  });
});
