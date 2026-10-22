// Milestone 11's frame hook (DESIGN.md §24), called once a frame from the wheel's frame hook before
// the HUD draws: Unit 7's ending queued when its page opens, the app's older Scenario store retired
// into the town's boards, and photo mode's keys.
import { endingWatch } from './ending';
import { retireOldBests } from './scenarios';
import { photoKeys } from './photo';
import type { App } from './app';

export function tailFrame(app: App) {
  if (app.screen !== 'play') return;
  photoKeys(app);
  retireOldBests(app);
  endingWatch(app);
}
