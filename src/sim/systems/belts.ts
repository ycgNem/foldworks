// Belts (DESIGN.md §4): 2 tiles/s, at most one item per tile, so a full belt moves 120 items/min.
// Belts run downstream first (Game.orderBelts), so a saturated line moves as one with no gaps; an
// item that reaches the end of its tile is offered to the tile ahead and waits there if refused.
// Splitters, mergers, crates and heaps hand on what they hold at the end of the pass.
import type { Game } from '../Game';
import { DX, DY, ccw, cw, type Dir, type Ent } from '../world';
import { RULES } from '../../data/rules';
import { DT } from '../../engine/time';
import { offer } from '../transfer';

export function runBelts(g: Game) {
  const step = RULES.beltSpeed.value * DT; // 0.1 tile per tick
  for (const b of g.belts) {
    b.mv = false;
    if (b.item === null) continue;
    if (b.p < 1) {
      b.p = Math.min(1, b.p + step);
      b.mv = true;
    }
    if (b.p >= 1 - 1e-9) {
      const item = b.item;
      const carry = Math.max(0, b.p - 1);
      b.item = null;
      if (offer(g, b.x + DX[b.rot], b.y + DY[b.rot], b.rot, item, carry)) {
        b.p = 0;
      } else {
        b.item = item;
        b.p = 1;
      }
    }
  }
  for (const e of g.logistics) handOn(g, e);
}

function tryOut(g: Game, e: Ent, d: Dir, item: string): boolean {
  return offer(g, e.x + DX[d], e.y + DY[d], d, item);
}

function handOn(g: Game, e: Ent) {
  switch (e.kind) {
    case 'splitter': {
      if (!e.store.length) return;
      const sides: Dir[] = [e.rot, ccw(e.rot), cw(e.rot)];
      for (let k = 0; k < 3; k++) {
        const i = (e.rr + k) % 3;
        if (tryOut(g, e, sides[i], e.store[0])) {
          e.store.shift();
          e.rr = (i + 1) % 3;
          return;
        }
      }
      return;
    }
    case 'merger':
    case 'crate':
      if (e.store.length && tryOut(g, e, e.rot, e.store[0])) e.store.shift();
      return;
    case 'heap':
      // a heap empties out of its front into whatever takes slag (a belt leading on, a brick press)
      if (e.count > 0 && tryOut(g, e, e.rot, 'slag')) e.count--;
      return;
  }
}
