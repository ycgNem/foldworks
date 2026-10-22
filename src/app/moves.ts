// Where the town could fly (DESIGN.md §22): the questions the Relocate card, its slip under the
// Purse, the Legacy tree and the Patent Office all ask. Kept apart from src/app/relocate.ts (which
// registers its page and slip when imported) so the pages can ask without an import cycle.
import { WORLDS, WORLD_IDS, type WorldId } from '../data/worlds';
import { previewLegacy, relocateRefusal, type LegacyPreview } from '../sim/relocate';
import { worldOf } from '../sim/systems/islands';
import { available } from '../sim/systems/research';
import type { App } from './app';
import { perTick } from './pertick';

/** An island's name, capitalised at the start of a line when asked (the Old Works). */
export const isleName = (w: WorldId, cap = false) => (cap ? WORLDS[w].name.replace(/^the /, 'The ') : WORLDS[w].name);

/** The islands the town could fly to (every one but this). */
export const destinations = (app: App) => WORLD_IDS.filter((w) => w !== worldOf(app.game));

/** The best island to fly to now and what it banks; null when none may be flown to. */
export function relocateNow(app: App): { to: WorldId; p: LegacyPreview } | null {
  // asked several times a frame by the HUD: once a tick (src/app/pertick.ts)
  return perTick(app.game, 'relocateNow', () => relocateBest(app));
}

function relocateBest(app: App): { to: WorldId; p: LegacyPreview } | null {
  const g = app.game;
  let best: { to: WorldId; p: LegacyPreview } | null = null;
  for (const w of destinations(app)) {
    if (relocateRefusal(g, w)) continue;
    const p = previewLegacy(g, w);
    if (!best || p.now > best.p.now) best = { to: w, p };
  }
  return best;
}

/** Is a Relocate possible, or close: Relocation researched (or open to research, or being fed),
 * and the World floor standing in this world. */
export function relocateClose(app: App): boolean {
  const g = app.game;
  if (g.s.scenario) return false;
  const near = g.done('relocation') || available(g, 'relocation') || g.s.research.selected === 'relocation';
  return near && (!!g.s.world || !!g.s.meta.here?.opened);
}
