// The idle and offline pace test (DESIGN.md §16 rule 4, §13 check 12, §20; ROADMAP.md Milestone 6's
// exit), stages 1 h and 2 h of the Act II bot's run 1 on seed 1000 (the later stages, seed 8919
// and the campaign's runs 2 and 3 are in the other tests/pace-idle-*.test.ts files, split so they
// run side by side). See tests/pace-idle-helpers.ts for what is measured and checked.
import { describe, expect, it } from 'vitest';
import { stageRow, failed } from './pace-idle-helpers';
import { IDLE_UPGRADES } from '../src/data/idle';

const T = 240_000;
const SEED = 1000;

describe('idle and offline at every stage (Milestone 6 exit), run 1, early', () => {
  for (const hour of [1, 2]) {
    it(`${hour} h: active earns 1.5-4x open idle; 8 h offline pays between e and 1 of open idle and within check 12, at 0.5 and 0.75`, () => {
      expect(failed(stageRow(SEED, hour))).toEqual([]);
    }, T);
  }

  it('the Night Shift pays back within 2 nights at the first stage it is offered (DESIGN.md §20)', () => {
    for (const u of IDLE_UPGRADES) {
      const hour = [1, 2].find((h) => stageRow(SEED, h).done.includes(u.requires));
      expect(hour, `${u.name} offered by 2 h`).toBeDefined();
      const r = stageRow(SEED, hour!);
      // a night: the first hour pays in full either way; the other 7 at e, so +eff of them
      const perNight = u.eff * (r.idle8h - r.idle1h);
      console.log(`[pace] ${u.name} (${u.cost}): offered by ${hour} h, +${Math.round(perNight)} coin a night, pays back in ${(u.cost / perNight).toFixed(2)} nights`);
      expect(u.cost / perNight).toBeLessThanOrEqual(2);
    }
  }, T);
});
