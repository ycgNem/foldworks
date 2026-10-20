// The idle and offline pace test (DESIGN.md §16 rule 4, §20; ROADMAP.md Milestone 6's exit), stages
// 3 h, 4 h and 5 h of the Act II bot's run (1 h and 2 h are in pace-idle-early.test.ts, split so
// the two files run side by side). See tests/pace-idle-helpers.ts for what is measured.
import { describe, expect, it } from 'vitest';
import { stageRow } from './pace-idle-helpers';

const T = 240_000;
const SEED = 1000;

describe('idle and offline at every stage (Milestone 6 exit), late', () => {
  for (const hour of [3, 4, 5]) {
    it(`${hour} h: active earns 1.5-4x idle, and 8 h offline pays no more than 8 h open and idle (at 0.5 and at 0.75)`, () => {
      const r = stageRow(SEED, hour);
      expect(r.idle30).toBeGreaterThan(0);
      expect(r.active30 / r.idle30).toBeGreaterThanOrEqual(1.5);
      expect(r.active30 / r.idle30).toBeLessThanOrEqual(4);
      expect(r.offline8h).toBeGreaterThan(0);
      expect(r.offline8h).toBeLessThanOrEqual(r.idle8h);
      expect(r.offlineMax8h).toBeLessThanOrEqual(r.idle8h);
      // offline never pays like playing: the active rate is at least 1.5x the offline rate
      expect((r.active30 * 16) / r.offline8h).toBeGreaterThanOrEqual(1.5);
    }, T);
  }
});
