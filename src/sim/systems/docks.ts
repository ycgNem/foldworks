// The Dock and the Hopper (DESIGN.md §7, §8): what belts handed them this tick. The Dock fills
// the active special order first, then sells at the item's value (Bramble's rep 1: plates +20%);
// the Hopper counts toward the selected research, or banks it by type. Act II (§18): Machine Kits
// at a Hopper go to the parts bank; with Unit 7's rep 1 the Codex pays 30x an item's value for
// its first delivery to a Dock.
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

/** Fill the active order with what was delivered, if it wants it; returns what is left to sell.
 * An order for the Factory Dock only counts deliveries made there. */
export function fillOrder(g: Game, item: ItemId, n: Num, floor?: 'factory'): Num {
  const o = g.s.orders;
  if (!o.active) return n;
  const d = ORDER[o.active];
  if (d.at === 'factory' && floor !== 'factory') return n;
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
    const n = it.n ?? Num.ONE;
    const floor = it.floor;
    g.s.delivered[it.item] = (g.s.delivered[it.item] ?? Num.ZERO).add(n);
    if (g.tally) {
      const t = g.tally[it.to];
      t[it.item] = (t[it.item] ?? 0) + n.toNumber();
    }
    if (it.to === 'dock') {
      const left = fillOrder(g, it.item, n, floor);
      if (left.lt(n)) g.emit({ type: 'orderFill', x: it.x, y: it.y, id: it.item, floor });
      if (left.isZero()) continue;
      codex(g, it.item, it.x, it.y, floor);
      // slag reaching the Factory Dock is scrapped for nothing (the Workshop Dock refuses it)
      const v = saleValue(g, it.item);
      const pay = left.mul(v);
      if (v > 0) g.earn(pay);
      g.emit({ type: 'sell', x: it.x, y: it.y, id: it.item, value: pay.toNumber(), floor });
      if (v > 0 && g.first('firstSale')) g.emit({ type: 'firstSale', x: it.x, y: it.y });
    } else if (ITEMS[it.item].parts) {
      g.s.parts = g.s.parts.add(n);
      g.emit({ type: 'parts', x: it.x, y: it.y, id: it.item, value: n.toNumber(), floor });
    } else {
      creditResearch(g, it.item, n);
      g.emit({ type: 'hopper', x: it.x, y: it.y, id: it.item, floor });
    }
  }
  g.intake.length = 0;
}

/** The Codex (Unit 7's rep 1): the first delivery of each item pays 30x its value, once. */
function codex(g: Game, item: ItemId, x: number, y: number, floor?: 'factory') {
  if (g.s.orders.rep.unit7 < 1 || g.s.codex.includes(item)) return;
  const v = ITEMS[item].value;
  if (v <= 0) return;
  g.s.codex.push(item);
  g.bump('codex');
  const pay = Num.of(v * RULES.codexMult.value);
  g.earn(pay, true);
  g.emit({ type: 'codex', x, y, id: item, value: pay.toNumber(), floor });
}
