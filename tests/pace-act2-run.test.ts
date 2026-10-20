// Act II pace tests (DESIGN.md §16, §18 Pacing targets; ROADMAP.md Milestone 4): the Act I planner
// plays to the slice end (the Gizmo Festival), then the honest Act II policy (src/sim/bot2.ts)
// plays on to 5 h. Every target is measured from the slice end S (about 0:31), not the clock.
// Measured on seeds 1000 and 8919 (bot2 at the Milestone 5-6 review round, with the annex):
//   S 0:30-0:31; steel S+18-19 min; power S+25-27; circuits S+55; Concrete fold S+65-66;
//   Drill works fold S+1:53-1:54; the Great Drill's stage 1 S+3:15 (3:45-3:46);
//   rule 2 (Sparks not counted) 9.2-9.3 min, 4.8-5.6 with them; at most 4 clicks in any second;
//   rule 1 (goals reached) 11.0-12.4 min before the Bay floor, 37.5-42.5 while the Bay fills;
//   rule 4 active/idle over 2:00-2:30 1.72-1.76; the preview 7 at 2 h, 11-12 at 3 h, 15 at 4-5 h.
import { describe, expect, it } from 'vitest';
import { act2Run, earnedAt, idleEarned, longestGap, patentsAt, hmm, SEEDS2, RULE4_AT, RULE4_FOR } from './pace-act2-helpers';

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

      it('rule 2: no dead air longer than 15 min between decisions, slice end to 5 h (Sparks not counted)', () => {
        const r = act2Run(seed);
        // a Spark click is a reflex, not a decision (the Milestone 5-6 review round): rule 2 is read
        // off the build, research, order and fold decisions alone
        const own = r.decisions.filter((_, i) => r.what[i] !== 'spark');
        const gap = longestGap(own, r.handover, 5 * 3600);
        const withSparks = longestGap(r.decisions, r.handover, 5 * 3600);
        console.log(`seed ${seed}: longest gap without Sparks ${(gap.gap / 60).toFixed(1)} min at ${hmm(gap.at)} (with them ${(withSparks.gap / 60).toFixed(1)})`);
        expect(gap.gap).toBeLessThanOrEqual(15 * MIN);
      }, T);

      it('Reorganize (DESIGN.md §19): the preview gives 12-20 Patents at 4 h and 5 h, more than at 2 h', () => {
        const r = act2Run(seed);
        const p2 = patentsAt(r, 2 * 3600), p3 = patentsAt(r, 3 * 3600), p4 = patentsAt(r, 4 * 3600), p5 = patentsAt(r, 5 * 3600);
        console.log(`seed ${seed}: Patents 2h ${p2} 3h ${p3} 4h ${p4} 5h ${p5}`);
        expect(p4).toBeGreaterThanOrEqual(12);
        expect(p4).toBeLessThanOrEqual(20);
        expect(p5).toBeGreaterThanOrEqual(12);
        expect(p5).toBeLessThanOrEqual(20);
        expect(p4).toBeGreaterThan(p2);
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

  // Not met yet, measured and reported: while the Bay fills (about 1.5 h) the goals the bot reaches
  // are Shiny Things, Nested Boxes' research, the nested Gizmo works II and the stage, 37-43 min
  // apart at the longest (DESIGN.md §16); §16 rule 1 wants one within 3 min.
  it.todo('rule 1: the next goal always within 3 min of reach while the Bay fills');
});
