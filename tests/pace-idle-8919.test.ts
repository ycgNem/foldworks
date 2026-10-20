// The idle and offline pace test (DESIGN.md §16 rule 4, §13 check 12, §20; ROADMAP.md Milestone 6's
// exit) on the second seed: the Act II bot's run 1 on seed 8919 at 1 h, 3 h and 5 h (seed 1000 has
// every hour, in pace-idle-early and pace-idle-late). See tests/pace-idle-helpers.ts.
import { describe, expect, it } from 'vitest';
import { stageRow, failed } from './pace-idle-helpers';

const T = 300_000;
const SEED = 8919;

describe('idle and offline at every stage (Milestone 6 exit), run 1, seed 8919', () => {
  for (const hour of [1, 3, 5]) {
    it(`${hour} h: active earns 1.5-4x open idle; 8 h offline pays between e and 1 of open idle and within check 12, at 0.5 and 0.75`, () => {
      expect(failed(stageRow(SEED, hour))).toEqual([]);
    }, T);
  }
});
