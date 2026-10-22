// Milestone 11's frame hook (DESIGN.md §24), called once a frame from the wheel's frame hook before
// the HUD draws. The hooks are added by app.ts (photo mode's keys, the older Scenario store retired
// into the town's boards, Unit 7's ending queued): this file imports nothing, so the wheel, which
// loads early, never pulls the pages in before screens.ts has loaded.
import type { App } from './app';

export const tailHooks: ((app: App) => void)[] = [];

export function tailFrame(app: App) {
  if (app.screen !== 'play') return;
  for (const h of tailHooks) h(app);
}
