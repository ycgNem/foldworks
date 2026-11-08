// The core ending in a test (DESIGN.md §21 The core ending): the Floating City complete, which opens
// the post-game (Challenges and the Scenario boards, the playability pass). Test setups that take a
// Challenge call it rather than playing to the City.
import type { Game } from '../src/sim/Game';
import { MEGAS } from '../src/data/megaprojects';

/** Mark the Floating City complete (every stage standing). */
export function endStory(g: Game) {
  g.s.megas = { ...g.s.megas, city: { stage: MEGAS.city.stages.length, progress: {} } };
}
