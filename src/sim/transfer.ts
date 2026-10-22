// How an item moves from one thing to the next (DESIGN.md §4): belts carry it to the tile they
// face; machines push their output onto the tile their front faces and their byproducts out of a
// side; whatever is there accepts it or refuses. One function, `offer`, so belts, machines,
// splitters and crates all follow the same rules.
import type { Game } from './Game';
import { DX, DY, opposite, type Dir, type Ent } from './world';
import { BUILD, isMachine } from '../data/machines';
import { ITEMS, type ItemId } from '../data/items';
import { RECIPE, recipesFor, type RecipeDef } from '../data/recipes';
import { RULES } from '../data/rules';
import { RESEARCH } from '../data/research';
import { ORDER, ORDERS } from '../data/orders';
import { lrules } from './legacy';
import { customerMet } from './reorganize';
import { prules } from './patents';
import { wastePrice } from './systems/modules';
import { krules } from './kernels';

/** Wide Belts (DESIGN.md §23): a belt tile holds two items, at least half a tile apart. */
export const BELT_GAP = 0.5;
export const wideBelt = (g: Game) => krules(g).beltItems > 1;

/** Does the active special order still want this item at the Workshop Dock? */
export function orderWants(g: Game, item: string): boolean {
  // Contract Runners (a Legacy node, DESIGN.md §22): every order on offer fills, from every Dock
  const ids = lrules(g).runners ? orderQueue(g) : g.s.orders.active ? [g.s.orders.active] : [];
  for (const id of ids) {
    const d = ORDER[id];
    if (d.at && !lrules(g).runners) continue;
    const want = d.wants[item as ItemId];
    if (want && (g.s.orders.progress[id]?.[item as ItemId]?.toNumber() ?? 0) < want) return true;
  }
  return false;
}

/** The orders Contract Runners fill (DESIGN.md §22): the active one first, then every other on
 * offer, in the order list's order. */
export function orderQueue(g: Game): string[] {
  const o = g.s.orders;
  const out = o.active ? [o.active] : [];
  for (const d of ORDERS) {
    if (d.id === o.active || o.done.includes(d.id)) continue;
    if (!d.requires.every((r) => g.done(r)) || !customerMet(g, d.customer)) continue;
    out.push(d.id);
  }
  return out;
}

/** Can `to` take `item`, arriving while travelling in direction `dir`? (No side effects.) */
export function accepts(g: Game, to: Ent, item: string, dir: Dir): boolean {
  const enterSide = opposite(dir); // the side of `to` the item comes in through
  switch (to.kind) {
    case 'belt':
      // never head-on into a belt that comes back at us; Wide Belts (a Kernel node, DESIGN.md §23):
      // a second item behind the first once it is half a tile on
      if (to.rot === opposite(dir)) return false;
      return to.item === null || (wideBelt(g) && !to.item2 && to.p >= BELT_GAP - 1e-9);
    case 'dock':
      // what the Dock refuses it takes while the active order wants it (the Committee's slag)
      // and waste once the Scrap Transmuter buys it (DESIGN.md §21)
      return !(ITEMS as Record<string, { refused?: boolean }>)[item]?.refused || orderWants(g, item) || (!!ITEMS[item as ItemId]?.waste && wastePrice(g, item) > 0);
    case 'hopper':
      // slag only while the selected research still wants it (else a heap draining into the
      // Hopper would never fill, and banked slag would pay for Slag Bricks: DECISIONS.md)
      return (item !== 'slag' && item !== 'sludge') || hopperWantsWaste(g, item);
    case 'heap':
      return item === 'slag' && to.count < prules(g).heapCap;
    case 'crate':
      return enterSide !== to.rot && to.store.length < (BUILD.crate.capacity ?? 50);
    case 'splitter':
      return enterSide === opposite(to.rot) && to.store.length === 0;
    case 'merger':
      return enterSide !== to.rot && to.store.length === 0 && mergerTurn(g, to, enterSide);
    case 'boiler':
    case 'generator': {
      if (to.ruined) return false;
      // fuel, from any side but a boiler's front (its Steam Engine is there)
      if (to.kind === 'boiler' && enterSide === to.rot) return false;
      const f = BUILD[to.kind].fuel!;
      if (!f.items.includes(item as ItemId)) return false;
      let held = 0;
      for (const k of f.items) held += to.inBuf[k] ?? 0;
      return held < RULES.fuelCap.value;
    }
    default:
      // crafting machines (Mk1, Act II, Mk2); miners, engines and poles take nothing
      if (!isMachine(to.kind) || to.kind === 'miner') return false;
      if (to.paused) return false; // stopped by the player (DESIGN.md §20): its inputs route on
      if (to.ruined) return false; // a ruin of the Old Works takes nothing until repaired (§22)
      if (enterSide === to.rot) return false; // the front is the output
      return machineTakes(g, to, item);
  }
}

/** Does a Hopper take this byproduct now? Slag and sludge only while the selected research still
 * wants them (the slag rule: DECISIONS.md, Milestone 1); anything else always. */
export function hopperWantsWaste(g: Game, item: string): boolean {
  if (item !== 'slag' && item !== 'sludge') return true;
  const sel = g.s.research.selected;
  if (!sel) return false;
  const need = RESEARCH[sel].cost[item as ItemId];
  if (!need) return false;
  return (g.s.research.progress[sel]?.[item as ItemId]?.toNumber() ?? 0) < need;
}

export function hopperWantsSlag(g: Game): boolean {
  const sel = g.s.research.selected;
  if (!sel) return false;
  const need = RESEARCH[sel].cost.slag;
  if (!need) return false;
  return (g.s.research.progress[sel]?.slag?.toNumber() ?? 0) < need;
}

/** Offer an item to the tile (x, y), travelling in `dir`. Returns true if it was taken. */
export function offer(g: Game, x: number, y: number, dir: Dir, item: string, carry = 0): boolean {
  const to = g.entAt(x, y);
  if (!to || !accepts(g, to, item, dir)) return false;
  const enterSide = opposite(dir);
  switch (to.kind) {
    case 'belt':
      if (to.item === null) {
        to.item = item;
        to.p = carry;
      } else {
        // the second item of a wide belt, behind the first
        to.item2 = item;
        to.p2 = Math.min(carry, to.p - BELT_GAP);
      }
      to.mv = true;
      break;
    case 'dock':
    case 'hopper':
      g.intake.push({ to: to.kind, item: item as ItemId, x: to.x + 1, y: to.y + 1 });
      break;
    case 'heap':
      to.count++;
      break;
    case 'crate':
    case 'splitter':
      to.store.push(item);
      break;
    case 'merger':
      to.store.push(item);
      to.rr = nextMergerSide(to, enterSide);
      break;
    default: {
      // a machine
      if (!to.recipe) {
        const r = pickRecipe(g, to, item);
        if (r) to.recipe = r.id;
      }
      to.inBuf[item] = (to.inBuf[item] ?? 0) + 1;
    }
  }
  // a belt or logistics part that carried an item counts in the bills term (§19)
  if (!isMachine(to.kind)) to.used = g.s.tick;
  g.onTransfer(x, y, dir, item);
  return true;
}

/** The recipes this machine may craft right now (unlocked ones of its family). */
export function machineRecipes(g: Game, m: Ent): RecipeDef[] {
  const fam = BUILD[m.kind].machine;
  if (!fam) return [];
  return recipesFor(fam).filter((r) => recipeKnown(g, r) && (m.kind !== 'furnace' || r.id === 'smeltIron') && (!r.mk2 || (BUILD[m.kind].speed ?? 1) > 1));
}

/** Researched, and taught (an alternate recipe needs its customer's reputation, §18). */
export function recipeKnown(g: Game, r: RecipeDef): boolean {
  if (r.unlock !== null && !g.s.research.done.includes(r.unlock)) return false;
  // the Second Cookbook's alternate recipes (a Kernel node, DESIGN.md §23)
  if (r.alt && !krules(g).cookbook) return false;
  return !r.rep || (g.s.orders.rep[r.rep.customer] ?? 0) >= r.rep.level;
}

function pickRecipe(g: Game, m: Ent, item: string): RecipeDef | null {
  return machineRecipes(g, m).find((r) => r.inputs.some((s) => s.item === item)) ?? null;
}

/** Does machine m have room for one more `item` in its input buffer? */
function machineTakes(g: Game, m: Ent, item: string): boolean {
  const r = m.recipe ? RECIPE[m.recipe] : pickRecipe(g, m, item);
  if (!r) return false;
  const need = r.inputs.find((s) => s.item === item);
  if (!need) return false;
  const cap = m.kind === 'furnace' ? Math.max(RULES.handOreCap.value, need.n * RULES.inputCrafts.value) : need.n * RULES.inputCrafts.value;
  return (m.inBuf[item] ?? 0) < cap;
}

// ---- mergers take their inputs in turn: back, left, right (DESIGN.md §4 Splitter / Merger)

const MERGE_SIDES = (rot: Dir): Dir[] => [opposite(rot), ((rot + 3) % 4) as Dir, ((rot + 1) % 4) as Dir];

function nextMergerSide(m: Ent, took: Dir): number {
  const sides = MERGE_SIDES(m.rot);
  return (sides.indexOf(took) + 1) % 3;
}

/** A side may hand an item in if it is the side whose turn it is, or that side has nothing ready. */
function mergerTurn(g: Game, m: Ent, side: Dir): boolean {
  const sides = MERGE_SIDES(m.rot);
  for (let k = 0; k < 3; k++) {
    const s = sides[(m.rr + k) % 3];
    if (s === side) return true;
    // the side whose turn it is: does a belt there have an item at its end, pointing in?
    const b = g.entAt(m.x + DX[s], m.y + DY[s]);
    if (b && b.kind === 'belt' && b.item !== null && b.p >= 1 && b.rot === opposite(s)) return false;
  }
  return true;
}
