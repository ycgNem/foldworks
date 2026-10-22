// Orders and reputation (DESIGN.md §7): the active special order completes when every item it
// wants is delivered; it pays coin and reputation. Bramble's rep 2 hands out a free Buffer Crate a
// minute, up to 5 waiting.
import type { Game } from '../Game';
import { Num } from '../../engine/num';
import { ORDER, ORDERS } from '../../data/orders';
import type { ItemId } from '../../data/items';
import { RULES } from '../../data/rules';
import { TICK_RATE } from '../../engine/time';
import { customerMet } from '../reorganize';
import { lrules } from '../legacy';
import { orderQueue } from '../transfer';
import { runLedger } from './ledger';

/** Special orders on offer right now (requirements met, not done). */
export function offeredOrders(g: Game) {
  return ORDERS.filter((o) => !g.s.orders.done.includes(o.id) && o.requires.every((r) => g.done(r)) && customerMet(g, o.customer));
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
  // Contract Runners (a Legacy node, DESIGN.md §22): every order on offer completes as it fills
  const ids = lrules(g).runners ? orderQueue(g) : o.active ? [o.active] : [];
  for (const id of ids) {
    const d = ORDER[id];
    const p = o.progress[id] ?? {};
    const complete = (Object.entries(d.wants) as [ItemId, number][]).every(([item, n]) => (p[item] ?? Num.ZERO).gte(n));
    if (!complete) continue;
    o.done.push(d.id);
    (o.doneAt ??= {})[d.id] = g.s.tick;
    if (o.active === id) o.active = null;
    if (d.pays) g.earn(Num.of(d.pays), true);
    // reputation is kept through every Reorganize; the Committee's opens the Great Drill's
    // stages 2 and 3 (DESIGN.md §19)
    o.rep[d.customer] = (o.rep[d.customer] ?? 0) + d.rep;
    g.emit({ type: 'order', id: d.id, value: d.pays });
    // reputation can change the rules the layout runs by (Voltaire's rep 3 extends pole reach)
    g.layoutDirty = true;
  }
  // the Endless Ledger's open order (DESIGN.md §23), with the special orders (offline pays through here too)
  runLedger(g);
  if (o.rep.bramble >= 2) {
    if (g.s.freeCrateIn > 0) g.s.freeCrateIn--;
    else if (g.s.freeCrates < RULES.repCrateMax.value) {
      g.s.freeCrates++;
      g.s.freeCrateIn = RULES.repCrateSeconds.value * TICK_RATE;
    }
  }
}
