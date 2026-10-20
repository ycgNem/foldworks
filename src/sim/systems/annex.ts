// The Factory annex (DESIGN.md §19): blocks of Factory floor bought with coin east of the 12x8,
// beside the Factory Dock, like the Workshop's land chunks (lost at a Reorganize). The n-th block
// costs ANNEX.base x n: linear in blocks bought, never a geometric curve (CLAUDE.md). It is room
// for the coin chains once the Megaproject Bay's floor has taken the 12x8, and the Act II coin
// sink a run's pile was missing.
import type { Game, ActResult } from '../Game';
import { OK, no } from '../Game';
import { Num } from '../../engine/num';
import { ANNEX, FACTORY } from '../../data/land';
import { RESEARCH } from '../../data/research';

/** What the next annex block costs (null: every block is bought). */
export function annexPrice(g: Game): Num | null {
  const n = g.s.annex ?? 0;
  if (n >= ANNEX.blocks) return null;
  return Num.of(ANNEX.base * (n + 1));
}

/** Why the next block can't be bought now, or null. */
export function annexRefusal(g: Game): string | null {
  const price = annexPrice(g);
  if (!price) return `The annex is all yours (${ANNEX.blocks} blocks)`;
  if (!g.flag('factoryOpen')) return 'The Factory floor opens with your first fold';
  if (!g.done(ANNEX.requires)) return `Research ${RESEARCH[ANNEX.requires].name} first`;
  if (g.s.coin.lt(price)) return `Annex block ${(g.s.annex ?? 0) + 1} costs ${price.format()} coin`;
  return null;
}

export function buyAnnex(g: Game): ActResult {
  const why = annexRefusal(g);
  if (why) return no(why);
  const price = annexPrice(g)!;
  g.s.coin = g.s.coin.sub(price);
  g.s.annex = (g.s.annex ?? 0) + 1;
  g.factoryDirty = true;
  g.bump('annexBlocks');
  g.emit({ type: 'annex', x: g.fw - ANNEX.cols / 2, y: FACTORY.h / 2, floor: 'factory', value: g.s.annex });
  return OK;
}
