// Idle and offline at the stages of the campaign's run 4, seed 1000 (see tests/pace-idle-runs.ts): the
// final round's stages past 12 h of play. Runs 1-3 play and reset as the campaign plays them, run 4
// plays 5 h, and 8 h offline is measured at each of its whole hours, so the stages reach 15 h.
import { expect, it } from 'vitest';
import { laterRun } from './pace-idle-runs';
import { campaignStages } from './pace-idle-helpers';

laterRun(1000, 4, [1, 2, 3, 4], 900_000);

it('the last stage of run 4 stands past 12 h of play (seed 1000)', () => {
  const c = campaignStages(1000, 4);
  console.log(`[pace] seed 1000: run 4 starts at ${(c.before / 3600).toFixed(2)} h of play; its 4 h stage at ${((c.before + 4 * 3600) / 3600).toFixed(2)} h`);
  expect(c.before + 4 * 3600).toBeGreaterThan(12 * 3600);
}, 900_000);
