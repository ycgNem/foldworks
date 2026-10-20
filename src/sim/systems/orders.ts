// Orders and reputation (DESIGN.md §7): the active special order completes when every item it
// wants is delivered; it pays coin and reputation. Bramble's rep 2 hands out a free Buffer Crate a
// minute, up to 5 waiting.
import type { Game } from '../Game';
import { Num } from '../../engine/num';
import { ORDER, ORDERS } from '../../data/orders';
import type { ItemId } from '../../data/items';
import { RULES } from '../../data/rules';
import { TICK_RATE } from '../../engine/time';

/** Special orders on offer right now (requirements met, not done). */
export function offeredOrders(g: Game) {
  return ORDERS.filter((o) => !g.s.orders.done.includes(o.id) && o.requires.every((r) => g.done(r)));
}

export function orderFrac(g: Game, id: string): number {
  const d = ORDER[id];
  const p = g.s.orders.progress[id] ?? {};
  let have = 0, need = 0;
  for (const [item, n] of Object.entries(d.wants) as [ItemId, number][]) {
    need += n;
    have += Math.min(n, p[item]?.toNumber() ?? 0);
  }
  return need ? have / need : 1;
}

export function runOrders(g: Game) {
  const o = g.s.orders;
  if (o.active) {
    const d = ORDER[o.active];
    const p = o.progress[o.active] ?? {};
    const complete = (Object.entries(d.wants) as [ItemId, number][]).every(([item, n]) => (p[item] ?? Num.ZERO).gte(n));
    if (complete) {
      o.done.push(d.id);
      o.active = null;
      g.earn(Num.of(d.pays));
      o.rep[d.customer] = (o.rep[d.customer] ?? 0) + d.rep;
      g.emit({ type: 'order', id: d.id, value: d.pays });
    }
  }
  if (o.rep.bramble >= 2) {
    if (g.s.freeCrateIn > 0) g.s.freeCrateIn--;
    else if (g.s.freeCrates < RULES.repCrateMax.value) {
      g.s.freeCrates++;
      g.s.freeCrateIn = RULES.repCrateSeconds.value * TICK_RATE;
    }
  }
}
