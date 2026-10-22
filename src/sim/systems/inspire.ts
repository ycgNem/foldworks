// Inspiration (DESIGN.md §15, §20): from Act II on (the slice's end), a click on a Hopper credits the
// selected research node with 0.1% of what it still needs, item by item, counted as items
// delivered, up to 30% of each item's cost per node. Clicking helps but never replaces the line:
// the share is of the *remaining* cost, so each click gives less, and the cap holds the rest for
// the factory. Counted against the 12 clicks/s cap like every click (Game.click / countClick).
import type { Game, ActResult } from '../Game';
import { Num } from '../../engine/num';
import { RESEARCH, type ResearchId } from '../../data/research';
import type { ItemId } from '../../data/items';
import { IDLE } from '../../data/idle';

/** Inspiration opens with Act II: the Gizmo Festival filled (the slice's end). */
export function inspireUnlocked(g: Game): boolean {
  return g.flag('sliceEnd');
}

/** How much of each item's cost Inspiration has given this node, 0..cap (by total items). */
export function inspiredFrac(g: Game, id: ResearchId): number {
  const cost = RESEARCH[id].cost;
  const got = g.s.inspire?.[id] ?? {};
  let have = 0, need = 0;
  for (const [item, n] of Object.entries(cost) as [ItemId, number][]) {
    need += n;
    have += got[item]?.toNumber() ?? 0;
  }
  return need ? have / need : 0;
}

/** One Inspiration click on a Hopper at (x, y) (for the pop). */
export function inspire(g: Game, x: number, y: number, floor?: 'factory' | 'district' | 'world' | 'beyond'): ActResult {
  if (!inspireUnlocked(g)) return { ok: false, why: 'nothing to click' };
  const r = g.s.research;
  const sel = r.selected;
  if (!sel) return { ok: false, why: 'Select a research node: clicking the Hopper inspires it' };
  const cost = RESEARCH[sel].cost;
  const prog = (r.progress[sel] ??= {});
  g.s.inspire ??= {};
  const got = (g.s.inspire[sel] ??= {});
  const share = IDLE.inspireShare.value, cap = IDLE.inspireCap.value;
  let gave = 0;
  let main: ItemId | null = null;
  for (const [item, n] of Object.entries(cost) as [ItemId, number][]) {
    const have = prog[item] ?? Num.ZERO;
    const remaining = n - have.toNumber();
    if (remaining <= 0) continue;
    const room = cap * n - (got[item]?.toNumber() ?? 0);
    if (room <= 1e-9) continue;
    const amt = Math.min(remaining * share, room);
    if (amt <= 0) continue;
    prog[item] = have.add(amt);
    got[item] = (got[item] ?? Num.ZERO).add(amt);
    gave += amt;
    if (!main) main = item;
  }
  if (gave <= 0) {
    // the node has had its 30% (or is filled): the click counts for nothing, quietly
    g.emit({ type: 'inspireFull', x, y, id: sel, floor });
    return { ok: true };
  }
  g.bump('inspiration');
  g.emit({ type: 'inspire', x, y, id: main ?? undefined, value: gave, floor });
  // the Hopper's own pop and chime, so a click shows at once
  g.emit({ type: 'hopper', x, y, id: main ?? undefined, floor });
  return { ok: true };
}
