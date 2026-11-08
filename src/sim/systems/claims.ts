// Deposit claims (DESIGN.md §18 Land and deposits). Ore never runs out; instead each copy of a
// module with miners inside holds one claim on every ore its miners dig. A player starts with 3
// claims per ore plus 2 for each Workshop deposit of that ore they own, and buys more at the
// Survey Office (research Surveying), 4 at a time, each block costing price x (1 + 0.5 b).
// Folding is never refused for claims (the line was already digging); stamping a copy is, and so
// is placing a copy on the Factory floor past the claims held (a re-folded copy got around them:
// the Milestone 4 review).
import type { Game, ActResult } from '../Game';
import { OK, no } from '../Game';
import { Num } from '../../engine/num';
import { CLAIM_PRICE, CHUNKS, patchOpen } from '../../data/land';
import { RESEARCH, type ResearchId } from '../../data/research';
import { available } from './research';
import { aWord } from '../../engine/fmt';
import { islandDef, islandPatches } from './islands';
import { prules } from '../patents';
import { RECIPE } from '../../data/recipes';
import { RULES } from '../../data/rules';
import { itemName, type ItemId } from '../../data/items';
import type { ModuleDesign } from '../world';
import { subDesigns } from './modules';
import { highModules } from './high';

/** The ores a copy of this design digs (a depth-2 design: its modules' ores, once each). */
export function oresOf(g: Game, d: ModuleDesign, depth = 0): Partial<Record<ItemId, number>> {
  const out: Partial<Record<ItemId, number>> = {};
  if (depth > 4) return out;
  const sub = subDesigns(g, d);
  if (sub) {
    for (const c of sub) for (const [k, n] of Object.entries(oresOf(g, c, depth + 1)) as [ItemId, number][]) out[k] = (out[k] ?? 0) + n;
    return out;
  }
  for (const p of d.parts) {
    if (p.kind !== 'miner' || !p.recipe) continue;
    const ore = RECIPE[p.recipe]?.outputs[0].item;
    if (ore) out[ore] = 1;
  }
  return out;
}

/** The claims one copy of this design holds on each ore: one per ore its miners dig, or half of one
 * for a design graded S or better once the Surveyor's Charter is owned (a Patent, DESIGN.md §19: a
 * line folded that well digs its deposit cleanly). A depth-2 design holds its modules' claims. */
export function claimLoad(g: Game, d: ModuleDesign, depth = 0): Partial<Record<ItemId, number>> {
  const out: Partial<Record<ItemId, number>> = {};
  if (depth > 4) return out;
  const sub = subDesigns(g, d);
  if (sub) {
    for (const c of sub) for (const [k, n] of Object.entries(claimLoad(g, c, depth + 1)) as [ItemId, number][]) out[k] = (out[k] ?? 0) + n;
    return out;
  }
  const w = prules(g).halfClaims && d.grade.mult >= RULES.halfClaimMult.value ? 0.5 : 1;
  for (const [k, n] of Object.entries(oresOf(g, d)) as [ItemId, number][]) out[k] = n * w;
  return out;
}

/** Copies of a design that exist: spare in the inventory plus placed on the Factory floor (copies
 * folded into a depth-2 design count through that design's own ores). */
export function copiesOf(g: Game, d: ModuleDesign): number {
  let n = d.spare;
  for (const e of g.s.factory.ents) if (e.kind === 'module' && e.design === d.id) n++;
  for (const e of highModules(g)) if (e.design === d.id) n++;
  return n;
}

/** Claims held on an ore. */
export function claimsHeld(g: Game, ore: ItemId): number {
  let deposits = 0;
  for (const p of islandPatches(g)) if (p.item === ore && patchOpen(p, g.s.mega.stage) && g.owned(p.x, p.y)) deposits++;
  // Harbour Rights (Bramble's rep 5, DESIGN.md §22): two more claims on the island's exotic
  const harbour = g.s.orders.rep.bramble >= 5 && islandDef(g).exotic === ore ? RULES.harbourClaims.value : 0;
  return harbour + RULES.claimsBase.value + RULES.claimsPerDeposit.value * deposits + RULES.claimsPerBlock.value * (g.s.claimBlocks[ore] ?? 0);
}

/** Claims in use on an ore: one per copy of every design that digs it. */
export function claimsUsed(g: Game, ore: ItemId): number {
  let used = 0;
  for (const d of g.s.designs) {
    const n = claimLoad(g, d)[ore] ?? 0;
    // a design that came back from the Drawer (the playability pass, DESIGN.md §19): its spare
    // copies are dies in the inventory and hold a claim only once placed (measured: the free copies
    // held the copper and iron claims the run's Gizmo chains needed, and run 2 never passed run 1)
    if (n) used += n * (d.kept !== undefined ? copiesOf(g, d) - d.spare : copiesOf(g, d));
  }
  return used;
}

/** Why one more copy of this design would break a claim, or null. */
export function claimRefusal(g: Game, d: ModuleDesign): string | null {
  for (const [ore, n] of Object.entries(claimLoad(g, d)) as [ItemId, number][]) {
    const held = claimsHeld(g, ore), used = claimsUsed(g, ore);
    if (used + n > held + 1e-9) {
      const name = itemName(ore).toLowerCase().replace(' ore', '');
      return `Needs ${aWord(name)} claim (${used}/${held} used): ${claimFix(g, ore)}`;
    }
  }
  return null;
}

/** The nearest way to more claims on an ore that the player can see now (the second playtest:
 * "research Surveying" while Surveying sat on a page not yet open): the Survey Office, a chunk for
 * sale with a deposit of it, Surveying, or the node on the way to it. Short: it ends a refusal. */
export function claimFix(g: Game, ore: ItemId, short = false): string {
  if (g.done('surveying')) return short ? 'the Survey Office' : 'buy more at the Survey Office';
  const s = g.s;
  const chunk = CHUNKS.find((c) => !s.land.includes(c.id) && (!c.requires || g.done(c.requires))
    && islandPatches(g).some((p) => p.item === ore && patchOpen(p, s.mega.stage) && p.x >= c.x && p.x < c.x + c.w && p.y >= c.y && p.y < c.y + c.h));
  if (chunk) return short ? `buy ${chunk.name.split(' · ')[0]}` : `buy ${chunk.name.split(' · ')[0]} for ${RULES.claimsPerDeposit.value} more`;
  if (available(g, 'surveying')) return short ? 'research Surveying' : 'research Surveying to buy more';
  const seen = new Set<ResearchId>();
  const walk = (id: ResearchId): ResearchId | null => {
    if (g.done(id) || seen.has(id)) return null;
    seen.add(id);
    if (available(g, id)) return id;
    for (const q of RESEARCH[id].requires) { const r = walk(q); if (r) return r; }
    return null;
  };
  const step = walk('surveying');
  if (short) return step ? `Surveying, after ${RESEARCH[step].name}` : 'Surveying, later';
  return step ? `Surveying sells more, after ${RESEARCH[step].name}` : 'Surveying sells more, later';
}

/** A claim refusal in a card's one line: the ore's icon, "full", and the nearest fix (the second
 * playtest: "Needs a iron claim (5 of 5 in use): r.." was cut off on the Modules page). */
export function claimShort(g: Game, d: ModuleDesign): string | null {
  for (const [ore, n] of Object.entries(claimLoad(g, d)) as [ItemId, number][]) {
    if (claimsUsed(g, ore) + n > claimsHeld(g, ore) + 1e-9) return `{i:${ore}} claims full: ${claimFix(g, ore, true)}`;
  }
  return null;
}

/** Claims the modules placed on the Factory floor dig with. */
export function placedClaims(g: Game, ore: ItemId): number {
  let n = 0;
  for (const e of [...g.s.factory.ents, ...highModules(g)]) {
    if (e.kind !== 'module') continue;
    const d = g.design(e.design);
    if (d) n += claimLoad(g, d)[ore] ?? 0;
  }
  return n;
}

/** Why placing one more copy of this design would dig past the claims held, or null. */
export function placeClaimRefusal(g: Game, d: ModuleDesign): string | null {
  for (const [ore, n] of Object.entries(claimLoad(g, d)) as [ItemId, number][]) {
    const held = claimsHeld(g, ore), placed = placedClaims(g, ore);
    if (placed + n > held + 1e-9) {
      const name = itemName(ore).toLowerCase().replace(' ore', '');
      return `Out of ${name} claims (${placed}/${held} digging): ${claimFix(g, ore)}`;
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
