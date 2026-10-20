// DESIGN.md §13 check 11, Hopper versus Dock: a player who sends everything to the Dock (and feeds
// the Hopper only while its plan is stuck on research, one node at a time) still reaches Folding by
// 60 min, but at least 5 min behind the planner, who keeps a line on the Hopper whenever research
// needs it. (5 min, not the first draft's 15, §8.) Round 3: after the sim changes since round 2 (the
// Inspector paying research in kind, the Gizmo at 2 wire) the gap measured ~4 min; Folding's
// 500 gears and chunk C at 1,000 (the planner's four Hopper gear lines arrive before Folding, not
// after it) put it back at ~7.5 min (§8).
import { describe, expect, it } from 'vitest';
import { at, describe2, runsToFolding, spread } from './pace-helpers';

const CAP = 90 * 60;

describe('pace: Hopper versus Dock (§13 check 11)', () => {
  const planner = spread(at(runsToFolding('planner', CAP), 'research:folding'), CAP);
  const dock = spread(at(runsToFolding('dockOnly', CAP), 'research:folding'), CAP);
  console.log(`[pace] ${describe2('planner Folding', planner)}`);
  console.log(`[pace] ${describe2('dock-only Folding', dock)}`);
  console.log(`[pace] dock-only is ${((dock.mean - planner.mean) / 60).toFixed(1)} min behind the planner (target 5+)`);

  it('the Dock-only player still researches Folding by 60 min', () => {
    expect(dock.reached).toBe(dock.n);
    expect(dock.mean).toBeLessThanOrEqual(3600);
  });
  it('the Dock-only player is at least 5 min behind the planner', () => {
    expect(dock.mean - planner.mean).toBeGreaterThanOrEqual(5 * 60);
  });
});
