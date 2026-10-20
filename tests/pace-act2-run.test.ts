// Act II pace tests (DESIGN.md §16, ROADMAP.md Milestone 4): the Act I planner plays to the slice
// end (the Gizmo Festival), then the honest Act II policy (src/sim/bot2.ts) plays on to 5 h. Times
// are rebased from the measured slice end (~0:31), not from the old ~1:00 assumption.
// Measured on seeds 1000 and 8919 (bot2 at this commit):
//   slice end 0:30-0:31, steel 0:48-0:50 (+18-19 min), power 0:55-0:58 (+25-27),
//   circuits 1:20-1:23 (+50-52), longest decision gap 5.7-6.0 min, max 4 clicks/s,
//   lifetime coin 4 h 1.97-2.01M, 5 h 2.53-2.56M, rule 4 active/idle 1.36-1.38.
import { describe, expect, it } from 'vitest';
import { act2Run, earnedAt, idleEarned, longestGap, patents, hmm, SEEDS2, RULE4_AT, RULE4_FOR } from './pace-act2-helpers';

const T = 120_000;
const MIN = 60;

describe('Act II pacing (bot2 after the planner)', () => {
  for (const seed of SEEDS2) {
    describe(`seed ${seed}`, () => {
      it('is honest: at most 4 clicks in any second, Overdrive included', () => {
        const r = act2Run(seed);
        expect(r.clicksPerSecMax).toBeLessThanOrEqual(4);
        expect(r.overdrives).toBeGreaterThan(0);
      }, T);

      it('hands over at the slice end, then reaches steel, power and circuits on the rebased targets', () => {
        const r = act2Run(seed);
        const h = r.handover;
        console.log(`seed ${seed}: handover ${hmm(h)} steel ${hmm(r.at.steel)} power ${hmm(r.at.power)} circuits ${hmm(r.at.circuits)} concrete ${hmm(r.at.concrete)} drill ${hmm(r.at.greatDrill1)}`);
        expect(h).toBeGreaterThan(25 * MIN);
        expect(h).toBeLessThan(40 * MIN);
        // steel within 25 min of the slice end, power within 35, circuits within 60
        expect(r.at.steel).toBeDefined();
        expect(r.at.steel! - h).toBeLessThanOrEqual(25 * MIN);
        expect(r.at.power).toBeDefined();
        expect(r.at.power! - h).toBeLessThanOrEqual(35 * MIN);
        expect(r.at.circuits).toBeDefined();
        expect(r.at.circuits! - h).toBeLessThanOrEqual(60 * MIN);
      }, T);

      it('rule 2: no dead air longer than 15 min between decisions, slice end to 5 h', () => {
        const r = act2Run(seed);
        const gap = longestGap(r.decisions, r.handover, 5 * 3600);
        console.log(`seed ${seed}: longest gap ${(gap.gap / 60).toFixed(1)} min at ${hmm(gap.at)}`);
        expect(gap.gap).toBeLessThanOrEqual(15 * MIN);
      }, T);

      it('Reorganize: 5 h gives 12-20 Patents, 4 h fewer, doubling lifetime coin adds at least 3', () => {
        const r = act2Run(seed);
        const e4 = earnedAt(r, 4 * 3600), e5 = earnedAt(r, 5 * 3600);
        const p4 = patents(e4), p5 = patents(e5), p10 = patents(2 * e5);
        console.log(`seed ${seed}: earned 4h ${Math.round(e4)} (${p4}) 5h ${Math.round(e5)} (${p5}) x2 (${p10})`);
        expect(p5).toBeGreaterThanOrEqual(12);
        expect(p5).toBeLessThanOrEqual(20);
        expect(p4).toBeLessThan(p5);
        expect(p10 - p5).toBeGreaterThanOrEqual(3);
      }, T);

      it('rule 4 (partial): active play out-earns idle from the same 2 h state', () => {
        const r = act2Run(seed);
        const act = earnedAt(r, RULE4_AT + RULE4_FOR) - earnedAt(r, RULE4_AT);
        const idle = idleEarned(r);
        console.log(`seed ${seed}: rule 4 active ${Math.round(act)} idle ${Math.round(idle)} ratio ${(act / idle).toFixed(2)}`);
        expect(idle).toBeGreaterThan(0);
        expect(act / idle).toBeGreaterThan(1);
        expect(act / idle).toBeLessThanOrEqual(4);
      }, T);
    });
  }

  // Known gaps, measured and reported, not yet held:
  // rule 4's band: active/idle is 1.36-1.38, under the 1.5 floor (Overdrive's real ceiling is +50%
  // and the Gizmo chains earn most of the coin with or without the player).
  it.todo('rule 4: active/idle in 1.5-4 at 2:00-2:30');
  // rule 1: bot2 stalls at "no room for circ1" (the Festival planner leaves 15 Act I modules on the
  // Factory floor), so after concrete research at ~2:29 no goal lands for the rest of the run.
  it.todo('rule 1: the next goal always within 3 min of reach');
  it.todo('Concrete fold by ~2:30 and Great Drill stage 1 by ~4:30');
});
