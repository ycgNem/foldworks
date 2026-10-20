// Deposit claims (DESIGN.md §18 Land and deposits). Ore never runs out; instead each copy of a
// module with miners inside holds one claim on every ore its miners dig. A player starts with 3
// claims per ore plus 2 for each Workshop deposit of that ore they own, and buys more at the
// Survey Office (research Surveying), 4 at a time, each block costing price x (1 + 0.5 b).
// Folding is never refused for claims (the line was already digging); stamping a copy is.
import type { Game, ActResult } from '../Game';
import { OK, no } from '../Game';
import { Num } from '../../engine/num';
import { CLAIM_PRICE, PATCHES } from '../../data/land';
import { RECIPE } from '../../data/recipes';
import { RULES } from '../../data/rules';
import { itemName, type ItemId } from '../../data/items';
import type { ModuleDesign } from '../world';

/** The ores a copy of this design digs (a depth-2 design: its modules' ores, once each). */
export function oresOf(g: Game, d: ModuleDesign, depth = 0): Partial<Record<ItemId, number>> {
  const out: Partial<Record<ItemId, number>> = {};
  if (depth > 3) return out;
  if (d.fparts) {
    for (const p of d.fparts) {
      if (p.kind !== 'module') continue;
      const c = g.design(p.design);
      if (!c) continue;
      for (const [k, n] of Object.entries(oresOf(g, c, depth + 1)) as [ItemId, number][]) out[k] = (out[k] ?? 0) + n;
    }
    return out;
  }
  for (const p of d.parts) {
    if (p.kind !== 'miner' || !p.recipe) continue;
    const ore = RECIPE[p.recipe]?.outputs[0].item;
    if (ore) out[ore] = 1;
  }
  return out;
}

/** Copies of a design that exist: spare in the inventory plus placed on the Factory floor (copies
 * folded into a depth-2 design count through that design's own ores). */
export function copiesOf(g: Game, d: ModuleDesign): number {
  let n = d.spare;
  for (const e of g.s.factory.ents) if (e.kind === 'module' && e.design === d.id) n++;
  return n;
}

/** Claims held on an ore. */
export function claimsHeld(g: Game, ore: ItemId): number {
  let deposits = 0;
  for (const p of PATCHES) if (p.item === ore && g.owned(p.x, p.y)) deposits++;
  return RULES.claimsBase.value + RULES.claimsPerDeposit.value * deposits + RULES.claimsPerBlock.value * (g.s.claimBlocks[ore] ?? 0);
}

/** Claims in use on an ore: one per copy of every design that digs it. */
export function claimsUsed(g: Game, ore: ItemId): number {
  let used = 0;
  for (const d of g.s.designs) {
    const n = oresOf(g, d)[ore] ?? 0;
    if (n) used += n * copiesOf(g, d);
  }
  return used;
}

/** Why one more copy of this design would break a claim, or null. */
export function claimRefusal(g: Game, d: ModuleDesign): string | null {
  for (const [ore, n] of Object.entries(oresOf(g, d)) as [ItemId, number][]) {
    const held = claimsHeld(g, ore), used = claimsUsed(g, ore);
    if (used + n > held) {
      const name = itemName(ore).toLowerCase().replace(' ore', '');
      return g.done('surveying')
        ? `Needs a ${name} claim (${used} of ${held} in use): buy more at the Survey Office`
        : `Needs a ${name} claim (${used} of ${held} in use): research Surveying to buy more`;
    }
  }
  return null;
}

/** What the next block of 4 claims on an ore costs. */
export function claimPrice(g: Game, ore: ItemId): Num | null {
  const c = CLAIM_PRICE.find((q) => q.item === ore);
  if (!c) return null;
  return Num.of(Math.round(c.price * (1 + RULES.claimGrowth.value * (g.s.claimBlocks[ore] ?? 0))));
}

export function buyClaims(g: Game, ore: ItemId): ActResult {
  if (!g.done('surveying')) return no('Research Surveying first');
  const price = claimPrice(g, ore);
  if (!price) return no('No claims are sold on that');
  if (g.s.coin.lt(price)) return no(`A block of ${RULES.claimsPerBlock.value} costs ${price.format()} coin`);
  g.s.coin = g.s.coin.sub(price);
  g.s.claimBlocks[ore] = (g.s.claimBlocks[ore] ?? 0) + 1;
  g.bump('claimBlocks');
  g.emit({ type: 'claim', id: ore, value: RULES.claimsPerBlock.value });
  return OK;
}
