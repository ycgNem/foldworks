// The core ending's clock (src/app/finale.ts draws it): kept apart so the Codex can open the
// finale again without importing the page (screens.ts loads the Codex before any page registers),
// as endingstate.ts does for Unit 7's ending.
import type { App } from './app';

/** the finale's clock (UI time it opened), which scene a Skip jumped to, whether it is a replay */
export const finaleState = { at: 0, jump: 0, replay: false, rolled: false };

/** Open the finale (replay: from the Codex). */
export function openFinale(app: App, replay = false) {
  finaleState.at = app.ui.time;
  finaleState.jump = 0;
  finaleState.replay = replay;
  finaleState.rolled = false;
  app.panel = 'finale';
  app.audio.sfx(replay ? 'open' : 'fanfare', 0.7);
}
