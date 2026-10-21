// The body of the later-run idle and offline pace tests (DESIGN.md §16 rule 4, §13 check 12, §20;
// ROADMAP.md Milestone 6's exit: every stage to 15 h). The campaign bot plays to run 2 or run 3 (a
// Reorganize, its Patents spent, the next run with the head starts) and each whole hour of that run
// is a stage, measured like run 1's (tests/pace-idle-helpers.ts). One file per seed and run
// (tests/pace-idle-run*.test.ts), so the four campaigns play side by side.
import { describe, expect, it } from 'vitest';
import { campaignStages, campaignHours, campaignRow, failed } from './pace-idle-helpers';

const T = 400_000;

export function laterRun(seed: number, run: number, hours = [1, 2, 3], timeout = T) {
  describe(`idle and offline at every stage (Milestone 6 exit), run ${run}, seed ${seed}`, () => {
    it(`plays run ${run} long enough to measure ${hours.join(', ')} h`, () => {
      const c = campaignStages(seed, run);
      expect(c.patentsBought).toBeGreaterThan(0);
      expect(campaignHours(c)).toEqual(expect.arrayContaining(hours));
    }, timeout);
    for (const hour of hours) {
      it(`${hour} h into run ${run}: active earns 1.5-4x open idle; 8 h offline pays between e and 1 of open idle and within check 12, at 0.5 and 0.75`, () => {
        expect(failed(campaignRow(seed, run, hour))).toEqual([]);
      }, T);
    }
  });
}
