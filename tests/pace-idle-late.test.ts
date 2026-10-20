// The idle and offline pace test (DESIGN.md §16 rule 4, §13 check 12, §20; ROADMAP.md Milestone 6's
// exit), stages 3 h, 4 h and 5 h of the Act II bot's run 1 on seed 1000 (1 h and 2 h are in
// pace-idle-early.test.ts). See tests/pace-idle-helpers.ts for what is measured and checked.
import { describe, expect, it } from 'vitest';
import { stageRow, failed } from './pace-idle-helpers';

const T = 240_000;
const SEED = 1000;

describe('idle and offline at every stage (Milestone 6 exit), run 1, late', () => {
  for (const hour of [3, 4, 5]) {
    it(`${hour} h: active earns 1.5-4x open idle; 8 h offline pays between e and 1 of open idle and within check 12, at 0.5 and 0.75`, () => {
      expect(failed(stageRow(SEED, hour))).toEqual([]);
    }, T);
  }
});
