// Unit 7's ending's clock (src/app/ending.ts draws it): kept apart so the Codex can open the moment
// without importing the page itself (screens.ts loads the Codex before any page registers).
import type { App } from './app';

/** the moment's clock (UI time it opened), whether LOGGED has landed, whether Skip was pressed */
export const endingState = { at: 0, stamped: false, skip: false };

/** Open the moment (replay: from the Codex). */
export function openEnding(app: App, replay = false) {
  endingState.at = app.ui.time;
  endingState.stamped = false;
  endingState.skip = false;
  app.panel = 'ending';
  app.audio.sfx(replay ? 'open' : 'codex', 0.6);
}
