// This world's records (DESIGN.md §22), at the end of the tick with the statistics: every 10 s the
// best design of each floor this run goes into this world's bests (`meta.here`, kept through every
// Reorganize: Legacy counts the whole world) and the island's records (`meta.worldRecords`, kept
// through everything). A Reorganize or a Relocate notes them once more before the reset.
import type { Game } from '../Game';
import { TICK_RATE } from '../../engine/time';
import { noteBests } from '../relocate';

export function runWorlds(g: Game) {
  if (g.s.scenario || (g.s.tick + 1) % (10 * TICK_RATE) !== 0) return;
  noteBests(g);
}
