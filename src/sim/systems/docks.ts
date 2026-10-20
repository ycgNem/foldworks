// The Dock and the Hopper (DESIGN.md §7, §8): what belts handed them this tick. The Dock fills
// the active special order first, then sells at the item's value (Bramble's rep 1: plates +20%);
// the Hopper counts toward the selected research, or banks it by type.
import type { Game } from '../Game';
import { Num } from '../../engine/num';
import { ITEMS, type ItemId } from '../../data/items';
import { ORDER } from '../../data/orders';
import { RULES } from '../../data/rules';
import { creditResearch } from './research';

/** What one item sells for at the Dock right now. */
export function saleValue(g: Game, item: ItemId): number {
  let v = ITEMS[item].value;
  if (item === 'ironPlate' && g.s.orders.rep.bramble >= 1) v *= 1 + RULES.repPlateBonus.value;
  return v;
}

/** Fill the active order with one item if it wants it; true if it did. */
export function fillOrder(g: Game, item: ItemId, n: Num): Num {
  const o = g.s.orders;
  if (!o.active) return n;
  const d = ORDER[o.active];
  const want = d.wants[item];
  if (!want) return n;
  const prog = (o.progress[o.active] ??= {});
  const have = prog[item] ?? Num.ZERO;
  if (have.gte(want)) return n;
  const room = Num.of(want).sub(have);
  const take = Num.min(room, n);
  prog[item] = have.add(take);
  return n.sub(take);
}

export function runDocks(g: Game) {
  if (!g.intake.length) return;
  for (const it of g.intake) {
    const one = Num.ONE;
    g.s.delivered[it.item] = (g.s.delivered[it.item] ?? Num.ZERO).add(one);
    if (it.to === 'dock') {
      const left = fillOrder(g, it.item, one);
      if (left.isZero()) {
        g.emit({ type: 'orderFill', x: it.x, y: it.y, id: it.item });
        continue;
      }
      const v = saleValue(g, it.item);
      g.earn(Num.of(v));
      g.emit({ type: 'sell', x: it.x, y: it.y, id: it.item, value: v });
      if (g.first('firstSale')) g.emit({ type: 'firstSale', x: it.x, y: it.y });
    } else {
      creditResearch(g, it.item, one);
      g.emit({ type: 'hopper', x: it.x, y: it.y, id: it.item });
    }
  }
  g.intake.length = 0;
}
