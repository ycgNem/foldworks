// Research (DESIGN.md §8): nodes cost item deliveries to the Hopper. One node is selected at a
// time and fills from matching deliveries; anything else, or anything delivered with nothing
// selected, is banked by type and applied when a node that wants it is selected.
import type { Game, ActResult } from '../Game';
import { Num } from '../../engine/num';
import { RESEARCH, RESEARCH_LIST, type ResearchId } from '../../data/research';
import type { ItemId } from '../../data/items';
import { worldOf } from './islands';

/** Can this node be selected (requirements done, not done itself)? */
export function available(g: Game, id: ResearchId): boolean {
  const d = RESEARCH[id];
  // an island's own research is offered only on that island (DESIGN.md §22)
  return !g.done(id) && d.requires.every((r) => g.done(r)) && (g.s.mega.stage ?? 0) >= (d.drill ?? 0) && (!d.world || d.world === worldOf(g));
}

export function availableNodes(g: Game) {
  return RESEARCH_LIST.filter((d) => available(g, d.id));
}

/** How much of a node's cost is delivered, 0..1 (by total items). */
export function researchFrac(g: Game, id: ResearchId): number {
  const d = RESEARCH[id];
  const p = g.s.research.progress[id] ?? {};
  let have = 0, need = 0;
  for (const [item, n] of Object.entries(d.cost) as [ItemId, number][]) {
    need += n;
    have += Math.min(n, p[item]?.toNumber() ?? 0);
  }
  return need ? have / need : 1;
}

export function selectResearch(g: Game, id: ResearchId | null): ActResult {
  const r = g.s.research;
  if (id === null) {
    r.selected = null;
    return { ok: true };
  }
  if (!RESEARCH[id]) return { ok: false, why: 'no such research' };
  if (g.done(id)) return { ok: false, why: 'already researched' };
  if (!available(g, id)) return { ok: false, why: 'needs earlier research first' };
  r.selected = id;
  // the bank pays in first
  const cost = RESEARCH[id].cost;
  const prog = (r.progress[id] ??= {});
  for (const [item, n] of Object.entries(cost) as [ItemId, number][]) {
    const banked = r.bank[item];
    if (!banked || banked.isZero()) continue;
    const have = prog[item] ?? Num.ZERO;
    const take = Num.min(banked, Num.of(n).sub(have));
    if (take.sign() <= 0) continue;
    prog[item] = have.add(take);
    r.bank[item] = banked.sub(take);
  }
  g.emit({ type: 'researchSelect', id });
  return { ok: true };
}

/** One delivery to the Hopper. */
export function creditResearch(g: Game, item: ItemId, n: Num) {
  const r = g.s.research;
  let left = n;
  if (r.selected) {
    const want = RESEARCH[r.selected].cost[item];
    if (want) {
      const prog = (r.progress[r.selected] ??= {});
      const have = prog[item] ?? Num.ZERO;
      const take = Num.min(left, Num.of(want).sub(have));
      if (take.sign() > 0) {
        prog[item] = have.add(take);
        left = left.sub(take);
      }
    }
  }
  if (left.sign() > 0) r.bank[item] = (r.bank[item] ?? Num.ZERO).add(left);
}

export function runResearch(g: Game) {
  const r = g.s.research;
  if (!r.selected) return;
  const id = r.selected;
  const prog = r.progress[id] ?? {};
  for (const [item, n] of Object.entries(RESEARCH[id].cost) as [ItemId, number][]) if (!(prog[item] ?? Num.ZERO).gte(n)) return;
  r.done.push(id);
  r.selected = null;
  g.emit({ type: 'research', id });
  if (id === 'pressing') g.emit({ type: 'unlock', id: 'press' });
}
