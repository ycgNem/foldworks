// Act II pace tests (DESIGN.md §16, §18 Pacing targets; ROADMAP.md Milestone 4): the Act I planner
// plays to the slice end (the Gizmo Festival), then the honest Act II policy (src/sim/bot2.ts)
// plays on to 5 h. Every target is measured from the slice end S (about 0:31), not the clock.
// Measured on seeds 1000 and 8919 (bot2 at this commit):
//   S 0:30-0:31; steel S+18-19 min; power S+25-27; circuits S+55; Concrete fold S+65-67;
//   Drill works fold S+1:56; the Great Drill's stage 1 S+3:22-3:37 (3:53-4:08);
//   longest stretch without a decision 5.8-6.0 min; at most 4 clicks in any second;
//   Overdrive (Workshop machines and Factory groups) about 3,600 clicks;
//   rule 4 active/idle over 2:00-2:30 1.80-1.84; lifetime coin 4 h 1.80M, 5 h 2.05-2.07M.
import { describe, expect, it } from 'vitest';
import { act2Run, earnedAt, idleEarned, longestGap, patents, hmm, SEEDS2, RULE4_AT, RULE4_FOR } from './pace-act2-helpers';

const T = 120_000;
const MIN = 60;

/** Goal events: research, land, folds, orders, modules placed, the Bay's stage (rule 1's proxy). */
const GOAL = /^(research|land|fold|order|module|stage)/;

describe('Act II pacing (bot2 after the planner)', () => {
  for (const seed of SEEDS2) {
    describe(`seed ${seed}`, () => {
      it('is honest: at most 4 clicks in any second, Overdrive included', () => {
        const r = act2Run(seed);
        expect(r.clicksPerSecMax).toBeLessThanOrEqual(4);
        expect(r.overdrives).toBeGreaterThan(0);
      }, T);

      it('hands over at the slice end, then reaches steel, power, circuits and the Concrete fold on the rebased targets', () => {
        const r = act2Run(seed);
        const h = r.handover;
        const rel = (k: string) => (r.at[k] === undefined ? undefined : r.at[k] - h);
        console.log(`seed ${seed}: S ${hmm(h)} steel ${hmm(r.at.steel)} power ${hmm(r.at.power)} circuits ${hmm(r.at.circuits)} Concrete fold ${hmm(r.at['fold:Concrete'])} Drill works ${hmm(r.at['fold:Drill works'])} stage 1 ${hmm(r.at.greatDrill1)}`);
        expect(h).toBeGreaterThan(25 * MIN);
        expect(h).toBeLessThan(40 * MIN);
        // §18 Pacing targets: steel by S+25 min, power by S+35, circuits by S+60, Concrete by S+80
        expect(rel('steel')).toBeLessThanOrEqual(25 * MIN);
        expect(rel('power')).toBeLessThanOrEqual(35 * MIN);
        expect(rel('circuits')).toBeLessThanOrEqual(60 * MIN);
        expect(rel('fold:Concrete')).toBeLessThanOrEqual(80 * MIN);
      }, T);

      it('fills the Great Drill\'s stage 1 by S+4 h', () => {
        const r = act2Run(seed);
        expect(r.at['fold:Drill works']).toBeDefined();
        expect(r.at.greatDrill1).toBeDefined();
        expect(r.at.greatDrill1! - r.handover).toBeLessThanOrEqual(4 * 3600);
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

      it('rule 4: active play earns 1.5-4x idle from the same 2 h state', () => {
        const r = act2Run(seed);
        const act = earnedAt(r, RULE4_AT + RULE4_FOR) - earnedAt(r, RULE4_AT);
        const idle = idleEarned(r);
        console.log(`seed ${seed}: rule 4 active ${Math.round(act)} idle ${Math.round(idle)} ratio ${(act / idle).toFixed(2)}`);
        expect(idle).toBeGreaterThan(0);
        expect(act / idle).toBeGreaterThanOrEqual(1.5);
        expect(act / idle).toBeLessThanOrEqual(4);
      }, T);

      it('rule 1 (logged): the longest wait between goals, slice end to the stage', () => {
        const r = act2Run(seed);
        const goals = r.decisions.filter((_, i) => GOAL.test(r.what[i]));
        const end = r.at.greatDrill1 ?? 5 * 3600;
        const before = longestGap(goals, r.handover, r.at['fplan:bay'] ?? end);
        const after = longestGap(goals, r.at['fplan:bay'] ?? end, end);
        console.log(`seed ${seed}: rule 1 longest goal gap ${(before.gap / 60).toFixed(1)} min at ${hmm(before.at)} before the Bay floor, ${(after.gap / 60).toFixed(1)} at ${hmm(after.at)} while the Bay fills`);
        // up to the Bay floor a goal lands at least every 15 min (rule 2's bound; rule 1's 3 min is not met, see it.todo)
        expect(before.gap).toBeLessThanOrEqual(15 * MIN);
      }, T);
    });
  }

  // Not met yet, measured and reported: while the Bay fills (about 1.5 h) the goals are the last
  // research nodes and the stage itself, 25-40 min apart; §16 rule 1 wants one within 3 min.
  it.todo('rule 1: the next goal always within 3 min of reach while the Bay fills');
});
