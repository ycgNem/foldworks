// The Seed (DESIGN.md §23): the World folded into one tile by the Last Fold, the first machine of
// every Workshop after it. It runs in the miners' stage: every RULES.seedSeconds (Seedling, a
// Kernel node: 2 s) it digs one of each raw ore, iron out of the side it faces and copper, coal and
// sand clockwise round it, and hands each on to whatever takes it there (a belt, a machine, the
// Dock), holding one an ore while that side refuses. Rotating it turns which side gets which ore.
// It is not a crafting machine (no recipe, no power, no claims) and it never goes in a fold box: as
// far as a box can see it makes ore out of nothing (as a Chute Mouth, §21). Pure.
import type { Game } from '../Game';
import { DX, DY, type Dir } from '../world';
import { TICK_RATE } from '../../engine/time';
import type { ItemId } from '../../data/items';
import { offer } from '../transfer';
import { krules } from '../kernels';
import { note } from './stats';

/** The ores out of its four sides, from the side it faces, clockwise. */
export const SEED_ORES: readonly ItemId[] = ['ironOre', 'copperOre', 'coal', 'sand'];

/** The side (a direction out of the Seed) that gets the k-th ore. */
export const seedSide = (rot: Dir, k: number): Dir => ((rot + k) % 4) as Dir;

export function runSeed(g: Game) {
  if (!g.seeds.length) return;
  const period = Math.round(krules(g).seedSeconds * TICK_RATE);
  for (const e of g.seeds) {
    e.prog += 1;
    if (e.prog >= period) {
      e.prog -= period;
      for (const it of SEED_ORES) if ((e.inBuf[it] ?? 0) < 1) e.inBuf[it] = 1;
      e.crafts++;
    }
    let held = 0;
    let first: ItemId | null = null;
    for (let k = 0; k < SEED_ORES.length; k++) {
      const it = SEED_ORES[k];
      if ((e.inBuf[it] ?? 0) < 1) continue;
      const d = seedSide(e.rot, k);
      if (offer(g, e.x + DX[d], e.y + DY[d], d, it)) e.inBuf[it] = 0;
      else {
        held++;
        first ??= it;
      }
    }
    // the pip: working while any side takes its ore; blocked when every side holds one; `why` names
    // the first ore waiting on its side (the hover report says which side)
    e.state = held >= SEED_ORES.length ? 'blocked' : 'work';
    e.why = first;
    note(e);
  }
}
