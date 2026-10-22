// Belts (DESIGN.md §4): 2 tiles/s, at most one item per tile, so a full belt moves 120 items/min.
// Belts run downstream first (Game.orderBelts), so a saturated line moves as one with no gaps; an
// item that reaches the end of its tile is offered to the tile ahead and waits there if refused.
// Splitters, mergers, crates and heaps hand on what they hold at the end of the pass.
import type { Game } from '../Game';
import { DX, DY, ccw, cw, type Dir, type Ent } from '../world';
import { RULES } from '../../data/rules';
import { DT } from '../../engine/time';
import { BELT_GAP, offer } from '../transfer';

export function runBelts(g: Game) {
  const step = RULES.beltSpeed.value * DT; // 0.1 tile per tick
  for (const b of g.belts) {
    b.mv = false;
    // Wide Belts (a Kernel node, DESIGN.md §23): a second item rides half a tile or more behind
    if (b.item === null && b.item2) promote(b, 0);
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
    if (b.item2) {
      if (b.item === null) promote(b, step);
      else {
        const np = Math.min((b.p2 ?? 0) + step, b.p - BELT_GAP);
        if (np > (b.p2 ?? 0) + 1e-12) {
          b.p2 = np;
          b.mv = true;
        }
      }
    }
  }
  // the heat map: how loaded and how stuck each belt has been lately (saves from before have none)
  for (const b of g.belts) {
    const full = b.item !== null ? 1 : 0, stuck = b.item !== null && !b.mv ? 1 : 0;
    b.occ = (b.occ ?? 0) * 0.99 + full * 0.01;
    b.jam = (b.jam ?? 0) * 0.99 + stuck * 0.01;
  }
  for (const e of g.logistics) handOn(g, e);
}

/** A wide belt's second item moves up to lead once the first has left (and on by `step`). */
function promote(b: Ent, step: number) {
  b.item = b.item2 ?? null;
  b.p = Math.min(1, (b.p2 ?? 0) + step);
  b.item2 = null;
  b.p2 = 0;
  b.mv = true;
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
    case 'chuteMouth': {
      // a Chute Mouth pushes its item out of its front from what the Factory Chute dropped
      // (DESIGN.md §21), one at a time, as fast as the belt takes them
      const it = e.recipe;
      const st = g.s.chute;
      if (!it || !st || (st[it as keyof typeof st] ?? 0) < 1 - 1e-9) {
        e.state = it ? 'starved' : 'idle';
        e.why = it;
        return;
      }
      if (tryOut(g, e, e.rot, it)) {
        st[it as keyof typeof st] = (st[it as keyof typeof st] ?? 0) - 1;
        e.state = 'work';
        e.why = null;
      } else {
        e.state = 'blocked';
        e.why = it;
      }
      return;
    }
  }
}
