// Modules and the Factory floor (DESIGN.md §10 Fold/Stamp/Unfold, §11). A module design is a
// folded line: its measured port rates times the grade multiplier. Placed on the Factory floor,
// each copy runs as a rate function, not crafts: every tick it takes its inputs at rate when its
// buffer has them (fractional amounts), makes its outputs at rate, and is starved or blocked in
// proportion. Trunk belts carry up to 8 items/s from a module's front to whatever the trunk ends
// at: another module's back, the Factory Dock or the Factory Hopper. Amounts in buffers are
// fractions of items in flight, bounded by RULES.moduleBuffer seconds (plain numbers, like a
// machine's buffer slots); what reaches the Dock or Hopper is paid out as whole items, as Nums.
// Byproducts (slag, oil) leave a module by a side onto a trunk pointing away, like a Workshop
// machine's (§4); with no such trunk they go out of the front with the rest.
// Act II (§18): stamps of designs holding Act II buildings cost Machine Kits; copies of designs
// with miners inside hold deposit claims; the Megaproject Bay takes its stage's items by trunk.
import type { Game, ActResult } from '../Game';
import { OK, no } from '../Game';
import { Num } from '../../engine/num';
import { TICK_RATE } from '../../engine/time';
import { BUILD, isMachine, isPower, type EntKind } from '../../data/machines';
import { FACTORY } from '../../data/land';
import { RULES } from '../../data/rules';
import { RECIPES } from '../../data/recipes';
import { ITEMS, itemName, type ItemId } from '../../data/items';
import { megaStage, type MegaStage } from '../../data/megaprojects';
import { DX, DY, ccw, cw, newFEnt, opposite, type Dir, type FEnt, type ModuleDesign } from '../world';
import { entsIn, inBox, gradedAudit } from './audits';
import { claimRefusal, oresOf, placeClaimRefusal } from './claims';
import { hopperWantsSlag } from '../transfer';
import { fauditFlow, fauditLock } from './nested';
import { prules } from '../patents';

const DT = 1 / TICK_RATE;

/** Items that are some recipe's byproduct (they leave a module by a side). */
export const BYPRODUCTS: ReadonlySet<string> = new Set(RECIPES.filter((r) => r.byproduct).map((r) => r.byproduct!.item));

/** Buildings whose price goes into a design's stamp bill (machines and power); belts and the
 * rest are refunded at the fold and paid again at Unfold. */
export const inBill = (k: EntKind) => isMachine(k) || isPower(k);

/** A design's main product: its most valuable output that is not a byproduct. */
export function mainItem(d: { outs: Partial<Record<ItemId, number>> }): ItemId | null {
  let best: ItemId | null = null, bv = -1;
  for (const [k, r] of Object.entries(d.outs) as [ItemId, number][]) {
    const v = r * Math.max(0.01, ITEMS[k].value);
    if (!BYPRODUCTS.has(k) && v > bv) { bv = v; best = k; }
  }
  return best ?? ((Object.keys(d.outs)[0] as ItemId | undefined) ?? null);
}

// ------------------------------------------------------------------ fold, stamp, unfold

/** The default name: the main output and its rate, e.g. "Iron plate x28/min". */
export function defaultName(outs: Partial<Record<ItemId, number>>): string {
  const best = mainItem({ outs });
  if (!best) return 'Module';
  return `${itemName(best)} ×${Math.round((outs[best] ?? 0) * 60)}/min`;
}

/** Fold the audited line into a module design (DESIGN.md §10 Fold). */
export function foldAudited(g: Game, name: string | null, id?: number): ActResult {
  const a = id !== undefined ? g.s.audits.find((q) => q.id === id) : gradedAudit(g) ?? g.s.audits[0];
  if (!a) return no('Nothing is being audited');
  if (!a.result) return no('The audit is still running');
  const res = a.result;
  const ents = entsIn(g, a.box);
  const parts = ents.map((e) => ({ kind: e.kind, dx: e.x - a.box.x, dy: e.y - a.box.y, rot: e.rot, recipe: e.recipe }));
  let bill = 0, refund = 0;
  for (const e of ents) {
    if (inBill(e.kind)) bill += BUILD[e.kind].cost;
    else refund += BUILD[e.kind].cost;
  }
  const mult = res.grade.mult;
  const scale = (t: Partial<Record<ItemId, number>>) => {
    const o: Partial<Record<ItemId, number>> = {};
    for (const [k, v] of Object.entries(t) as [ItemId, number][]) o[k] = v * mult;
    return o;
  };
  const outs = scale(res.outs);
  const d: ModuleDesign = {
    id: g.s.nextDesign++,
    name: (name ?? '').trim().slice(0, 28) || defaultName(outs),
    box: { ...a.box },
    parts,
    ins: scale(res.ins),
    outs,
    grade: { ...res.grade },
    bill,
    stamped: 0,
    spare: 1,
  };
  g.s.designs.push(d);
  // the machines go into the module; the belts and the rest are refunded; the box empties
  const ids = new Set(ents.map((e) => e.id));
  g.s.ents = g.s.ents.filter((e) => !ids.has(e.id));
  g.s.coin = g.s.coin.add(refund);
  g.layoutDirty = true;
  g.s.audits = g.s.audits.filter((q) => q !== a);
  g.bump('folds');
  if (res.grade.letter === 'S') g.bump('foldS');
  g.first('factoryOpen');
  g.emit({ type: 'fold', x: a.box.x + a.box.w / 2, y: a.box.y + a.box.h / 2, id: d.grade.letter, value: d.id, d: a.box.w * a.box.h });
  if (g.first('firstFold')) g.emit({ type: 'firstFold', x: a.box.x + a.box.w / 2, y: a.box.y + a.box.h / 2, value: d.id });
  return OK;
}

/** Copies so far of everything making the same main product: stamps of every such design, plus
 * every fold of it after the first. Counting by product, not by design, means folding the same
 * line again never resets the stamp price (DECISIONS.md, the Milestone 1-2 review). */
export function productCopies(g: Game, d: ModuleDesign): number {
  const item = mainItem(d);
  let n = 0, folds = 0;
  for (const q of g.s.designs) {
    if (mainItem(q) !== item) continue;
    n += q.stamped;
    folds++;
  }
  return n + Math.max(0, folds - 1);
}

/** What the next copy of a design costs: bill x (1 + 0.5 n), linear (DESIGN.md §10 Stamp), n
 * counted over every design of the same product. */
export function stampCost(g: Game, d: ModuleDesign): Num {
  // Stamping Dies (a Patent, §19) lowers the growth; it stays linear
  return Num.of(Math.round(d.bill * (1 + prules(g).stampGrowth * productCopies(g, d))));
}

/** Does the design hold an Act II building (directly, or in a module it was folded from)? */
export function holdsAct2(g: Game, d: ModuleDesign, depth = 0): boolean {
  if (depth > 3) return false;
  if (d.fparts) return d.fparts.some((p) => p.kind === 'module' && !!g.design(p.design) && holdsAct2(g, g.design(p.design)!, depth + 1));
  return d.parts.some((p) => !!BUILD[p.kind].act2);
}

/** Machine Kits a copy of this design takes (DESIGN.md §18): 1 + floor(bill / 1,500), or none for
 * a design of slice-era machines only. */
export function kitsFor(g: Game, d: ModuleDesign): number {
  // the Committee's Pocketed Kits (reputation 3, §19) takes one off, never below none
  return holdsAct2(g, d) ? Math.max(0, 1 + Math.floor(d.bill / RULES.kitDivisor.value) - prules(g).kitsOff) : 0;
}

/** Why the next copy can't be stamped, or null. */
export function stampRefusal(g: Game, d: ModuleDesign): string | null {
  const cost = stampCost(g, d);
  if (g.s.coin.lt(cost)) return `A copy costs ${cost.format()} coin`;
  const kits = kitsFor(g, d);
  if (kits > 0 && g.s.parts.lt(kits)) {
    return g.done('machineKits')
      ? `A copy takes ${kits} Machine Kit${kits > 1 ? 's' : ''}: you have ${g.s.parts.format()}`
      : `A copy takes ${kits} Machine Kit${kits > 1 ? 's' : ''}: research Machine Kits`;
  }
  return claimRefusal(g, d);
}

export function stamp(g: Game, id: number): ActResult {
  const d = g.s.designs.find((q) => q.id === id);
  if (!d) return no('No such module');
  const why = stampRefusal(g, d);
  if (why) return no(why);
  const cost = stampCost(g, d);
  g.s.coin = g.s.coin.sub(cost);
  const kits = kitsFor(g, d);
  if (kits > 0) g.s.parts = g.s.parts.sub(kits);
  d.stamped++;
  d.spare++;
  g.bump('stamps');
  g.emit({ type: 'stamp', id: d.name, value: d.id });
  return OK;
}

export function renameDesign(g: Game, id: number, name: string): ActResult {
  const d = g.s.designs.find((q) => q.id === id);
  if (!d) return no('No such module');
  const n = name.trim().slice(0, 28);
  if (!n) return no('A name needs a letter or two');
  d.name = n;
  return OK;
}

/** Why a design can't be unfolded back at its box, or null. */
export function unfoldRefusal(g: Game, d: ModuleDesign): string | null {
  if (d.spare < 1) return 'No spare copy: take one off the Factory floor or stamp one';
  if (d.fparts) return funfoldRefusal(g, d);
  for (let y = d.box.y; y < d.box.y + d.box.h; y++)
    for (let x = d.box.x; x < d.box.x + d.box.w; x++) {
      if (!g.inb(x, y) || !g.owned(x, y)) return 'Its land is not yours any more';
      if (g.entAt(x, y)) return `The box at ${d.box.x},${d.box.y} is not empty: clear ${d.box.w}x${d.box.h} tiles there`;
      if (g.s.audits.some((a) => inBox(a.box, x, y))) return 'An audit is running there';
    }
  let belts = 0;
  for (const p of d.parts) if (!inBill(p.kind)) belts += BUILD[p.kind].cost;
  if (g.s.coin.lt(belts)) return `The belts cost ${belts} coin`;
  return null;
}

/** A depth-2 design unfolds back into its modules and trunks on the Factory floor. */
function funfoldRefusal(g: Game, d: ModuleDesign): string | null {
  const b = d.box;
  for (let y = b.y; y < b.y + b.h; y++)
    for (let x = b.x; x < b.x + b.w; x++) {
      if (!finb(x, y)) return 'Its box is off the floor';
      if (g.fentAt(x, y)) return `The box at ${b.x},${b.y} on the Factory floor is not empty: clear ${b.w}x${b.h} tiles there`;
      if (g.s.faudit && inBox(g.s.faudit.box, x, y)) return 'An audit is running there';
    }
  const trunks = (d.fparts ?? []).filter((p) => p.kind === 'trunk').length * FACTORY.trunkCost;
  if (g.s.coin.lt(trunks)) return `The trunk belts cost ${trunks} coin`;
  return null;
}

/** Put a spare copy back onto the Workshop where it was folded (DESIGN.md §10 Unfold). */
export function unfold(g: Game, id: number): ActResult {
  const d = g.s.designs.find((q) => q.id === id);
  if (!d) return no('No such module');
  const why = unfoldRefusal(g, d);
  if (why) return no(why);
  if (d.fparts) {
    const f = g.s.factory;
    for (const p of d.fparts) {
      if (p.kind === 'trunk') g.s.coin = g.s.coin.sub(FACTORY.trunkCost);
      f.ents.push(newFEnt(f.nextId++, p.kind, d.box.x + p.dx, d.box.y + p.dy, p.rot, p.design));
    }
    d.spare--;
    g.factoryDirty = true;
    g.emit({ type: 'unfold', x: d.box.x + d.box.w / 2, y: d.box.y + d.box.h / 2, value: d.id, floor: 'factory' });
    return OK;
  }
  for (const p of d.parts) {
    if (!inBill(p.kind)) g.s.coin = g.s.coin.sub(BUILD[p.kind].cost);
    const e = g.addPart(p.kind as EntKind, d.box.x + p.dx, d.box.y + p.dy, p.rot);
    e.recipe = p.recipe;
  }
  d.spare--;
  g.emit({ type: 'unfold', x: d.box.x + d.box.w / 2, y: d.box.y + d.box.h / 2, value: d.id });
  return OK;
}

// ------------------------------------------------------------------ the Factory floor: building

export const finb = (x: number, y: number) => x >= 0 && y >= 0 && x < FACTORY.w && y < FACTORY.h;

export function factoryOpen(g: Game) {
  return g.flag('factoryOpen');
}

export function fplaceRefusal(g: Game, kind: 'module' | 'trunk', x: number, y: number, design?: number): string | null {
  if (!factoryOpen(g)) return 'The Factory floor opens with your first fold';
  if (!finb(x, y)) return 'off the floor';
  const lock = fauditLock(g, x, y);
  if (lock) return lock;
  const e = g.fentAt(x, y);
  if (e && !(kind === 'trunk' && e.kind === 'trunk')) return `${fname(g, e)} is in the way`;
  if (kind === 'module') {
    const d = g.s.designs.find((q) => q.id === design);
    if (!d) return 'Pick a module from the inventory';
    if (d.spare < 1) return `No spare ${d.name}: stamp a copy`;
    const claim = placeClaimRefusal(g, d);
    if (claim) return claim;
  } else if (g.s.coin.lt(FACTORY.trunkCost)) return `Needs ${FACTORY.trunkCost} coin`;
  return null;
}

export function fplace(g: Game, kind: 'module' | 'trunk', x: number, y: number, rot: Dir, design = 0): ActResult {
  const ex = g.fentAt(x, y);
  if (kind === 'trunk' && ex?.kind === 'trunk') {
    if (ex.rot === rot) return no('already a trunk facing that way');
    ex.rot = rot;
    g.factoryDirty = true;
    g.emit({ type: 'rotate', x, y, floor: 'factory' });
    return OK;
  }
  const why = fplaceRefusal(g, kind, x, y, design);
  if (why) return no(why);
  const f = g.s.factory;
  if (kind === 'module') {
    const d = g.s.designs.find((q) => q.id === design)!;
    d.spare--;
    f.ents.push(newFEnt(f.nextId++, 'module', x, y, rot, d.id));
    g.bump('modulesPlaced');
  } else {
    g.s.coin = g.s.coin.sub(FACTORY.trunkCost);
    f.ents.push(newFEnt(f.nextId++, 'trunk', x, y, rot));
  }
  g.factoryDirty = true;
  g.emit({ type: 'place', x, y, id: kind, floor: 'factory' });
  return OK;
}

export function fremove(g: Game, x: number, y: number): ActResult {
  const e = g.fentAt(x, y);
  if (!e) return no('nothing here');
  if (e.kind === 'fdock' || e.kind === 'fhopper' || e.kind === 'fbay') return no(`The ${fname(g, e)} stays`);
  const lock = fauditLock(g, x, y);
  if (lock) return no(lock);
  if (e.kind === 'module') {
    const d = g.s.designs.find((q) => q.id === e.design);
    if (d) d.spare++;
  } else g.s.coin = g.s.coin.add(FACTORY.trunkCost);
  g.s.factory.ents = g.s.factory.ents.filter((q) => q !== e);
  g.factoryDirty = true;
  g.emit({ type: 'remove', x, y, id: e.kind, floor: 'factory' });
  return OK;
}

export function frotate(g: Game, x: number, y: number): ActResult {
  const e = g.fentAt(x, y);
  if (!e) return no('nothing here');
  if (e.kind === 'fdock' || e.kind === 'fhopper' || e.kind === 'fbay') return no(`The ${fname(g, e)} takes from every side`);
  const lock = fauditLock(g, x, y);
  if (lock) return no(lock);
  e.rot = ((e.rot + 1) % 4) as Dir;
  g.factoryDirty = true;
  g.emit({ type: 'rotate', x, y, floor: 'factory' });
  return OK;
}

export function fname(g: Game, e: FEnt): string {
  if (e.kind === 'fdock') return 'Factory Dock';
  if (e.kind === 'fhopper') return 'Factory Hopper';
  if (e.kind === 'trunk') return 'Trunk belt';
  if (e.kind === 'fbay') return 'Megaproject Bay';
  return g.s.designs.find((d) => d.id === e.design)?.name ?? 'Module';
}

// ------------------------------------------------------------------ routes

/** Where a module's output goes: the trunk tiles in order and what they end at. `by` routes start
 * at a side and carry byproducts only. */
export interface Route {
  from: FEnt;
  to: FEnt | null;
  tiles: FEnt[];
  by: boolean;
}

function follow(g: Game, m: FEnt, dir: Dir, by: boolean): Route {
  const sideIn = prules(g).sideIntake;
  let x = m.x + DX[dir], y = m.y + DY[dir];
  const tiles: FEnt[] = [];
  const seen = new Set<number>();
  let to: FEnt | null = null;
  for (;;) {
    const e = g.fentAt(x, y);
    if (!e) break;
    if (e.kind === 'trunk') {
      if (seen.has(e.id) || e.rot === opposite(dir)) break;
      seen.add(e.id);
      tiles.push(e);
      dir = e.rot;
      x += DX[dir];
      y += DY[dir];
      continue;
    }
    // a module takes in at its back: the item must travel the way it faces
    // Side Intakes (a Patent, §19): also from a trunk pointing into its left side
    if (e.kind === 'module') to = (dir === e.rot || (sideIn && dir === cw(e.rot))) && e !== m ? e : null;
    else to = e;
    break;
  }
  return { from: m, to, tiles, by };
}

/** Follow the trunk from each module's front (and from a side trunk pointing away, for its
 * byproducts) to a module's back, the Dock, the Hopper or the Megaproject Bay. */
export function buildRoutes(g: Game): Route[] {
  const routes: Route[] = [];
  for (const m of g.s.factory.ents) {
    if (m.kind !== 'module') continue;
    routes.push(follow(g, m, m.rot, false));
    for (const side of [ccw(m.rot), cw(m.rot)]) {
      const t = g.fentAt(m.x + DX[side], m.y + DY[side]);
      if (t && t.kind === 'trunk' && t.rot === side) routes.push(follow(g, m, side, true));
    }
  }
  return routes;
}

/** Overdrive a module and every module joined to it by trunk routes (DESIGN.md §18). */
export function foverdrive(g: Game, x: number, y: number): ActResult {
  if (!g.done('overdrive')) return no('Research Overdrive first');
  const m = g.fentAt(x, y);
  if (!m || m.kind !== 'module') return no('Click a module to overdrive it');
  if ((m.od ?? 0) > 0) return no('Overdriven already');
  if ((m.cool ?? 0) > 0) return no(`Cooling down: ${Math.ceil((m.cool ?? 0) / TICK_RATE)} s`);
  if (fauditLock(g, x, y)) return no('Auditing: Overdrive would spoil the measurement');
  const ticks = Math.round(RULES.overdriveSeconds.value * TICK_RATE);
  const seen = new Set<number>([m.id]);
  const todo = [m];
  while (todo.length) {
    const cur = todo.pop()!;
    for (const r of g.routes) {
      const other = r.from === cur ? r.to : r.to === cur ? r.from : null;
      if (other && other.kind === 'module' && !seen.has(other.id)) { seen.add(other.id); todo.push(other); }
    }
  }
  let n = 0;
  for (const id of seen) {
    const e = g.fById.get(id)!;
    if ((e.od ?? 0) > 0 || (e.cool ?? 0) > 0 || fauditLock(g, e.x, e.y)) continue;
    e.od = ticks;
    n++;
  }
  g.bump('overdrives');
  g.emit({ type: 'overdrive', x: m.x, y: m.y, value: m.id, d: n, floor: 'factory' });
  return OK;
}

/** Does the route chain from m reach the Factory Dock (through other modules)? */
export function feedsDock(g: Game, m: FEnt, depth = 0): boolean {
  if (depth > 40) return false;
  const r = g.routes.find((q) => q.from === m && !q.by);
  if (!r || !r.to) return false;
  if (r.to.kind === 'fdock') return true;
  return r.to.kind === 'module' && feedsDock(g, r.to, depth + 1);
}

// ------------------------------------------------------------------ the tick

export function runModules(g: Game) {
  const f = g.s.factory;
  if (!f.ents.length || !factoryOpen(g)) return;
  if (g.factoryDirty) g.rebuildFactory();
  const pr = prules(g);
  // the Committee's Coat Pockets (reputation 1, §19) hold 6 s instead of 2
  const buf = pr.moduleBuffer;
  // the Great Drill's stage 1 runs modules with miners inside +50% (§18)
  const drill = g.s.mega.stage >= 1 ? 1 + RULES.drillBoost.value : 1;
  // 1. each module runs at the fraction its inputs and output room allow
  for (const m of f.ents) {
    if (m.kind !== 'module') continue;
    const d = g.design(m.design);
    if (!d) continue;
    // the Great Drill boosts modules with miners inside, but never one under audit: its rate is
    // being measured, and a depth-2 module folded from it gets the boost again (Milestone 4 review)
    const audited = !!g.s.faudit && !g.s.faudit.result && g.s.faudit.ids.includes(m.id);
    const k = (drill > 1 && !audited && Object.keys(oresOf(g, d)).length ? drill : 1) * ((m.od ?? 0) > 0 ? RULES.overdriveMult.value : 1);
    if (m.od) { m.od--; if (!m.od) m.cool = Math.round(pr.overdriveCool * TICK_RATE); } else if (m.cool) m.cool--;
    let frac = 1;
    let why: string | null = null;
    let kind: 'starved' | 'blocked' | null = null;
    for (const [i, r0] of Object.entries(d.ins) as [ItemId, number][]) {
      const r = r0 * k;
      const need = r * DT;
      if (need <= 0) continue;
      const fi = (m.inBuf[i] ?? 0) / need;
      if (fi < frac) { frac = fi; why = i; kind = 'starved'; }
    }
    // a byproduct with nowhere to go blocks the module (the slag lesson, §11); of its products, it
    // runs while any one has room, and a full one spills (a module making glass and plastic for a
    // consumer that takes them in another ratio would otherwise stop for good: Act II's bot)
    let bestMain = -1, fullMain: string | null = null;
    for (const [o, r0] of Object.entries(d.outs) as [ItemId, number][]) {
      const r = r0 * k;
      const need = r * DT;
      if (need <= 0) continue;
      const room = r * buf - (m.outBuf[o] ?? 0);
      const fo = Math.max(0, room / need);
      if (BYPRODUCTS.has(o)) {
        if (fo < frac) { frac = fo; why = o; kind = 'blocked'; }
      } else {
        if (fo > bestMain) bestMain = fo;
        if (fo < 1e-9) fullMain = o;
      }
    }
    if (bestMain >= 0 && bestMain < frac) { frac = bestMain; why = fullMain ?? why; kind = 'blocked'; }
    frac = Math.max(0, Math.min(1, frac));
    m.spill = null;
    for (const [i, r] of Object.entries(d.ins) as [ItemId, number][]) m.inBuf[i] = Math.max(0, (m.inBuf[i] ?? 0) - r * k * DT * frac);
    for (const [o, r] of Object.entries(d.outs) as [ItemId, number][]) {
      const cap = r * k * buf;
      const v = (m.outBuf[o] ?? 0) + r * k * DT * frac;
      if (!BYPRODUCTS.has(o) && v > cap && frac > 0) m.spill = o;
      m.outBuf[o] = BYPRODUCTS.has(o) ? v : Math.min(Math.max(cap, m.outBuf[o] ?? 0), v);
    }
    m.f = frac;
    m.fsum = (m.fsum ?? 0) + frac;
    m.fAvg = m.fAvg * 0.98 + frac * 0.02;
    m.state = frac >= 0.98 ? 'work' : (kind ?? 'idle');
    m.why = frac >= 0.98 ? null : why;
    m.sec[m.state === 'work' ? 0 : m.state === 'starved' ? 1 : 2]++;
  }
  // 2. trunks carry outputs onward, 8 items/s per tile shared by every route through it
  const cap = FACTORY.trunkSpeed * DT;
  const used = new Map<number, number>();
  for (const t of f.ents) if (t.kind === 'trunk') t.flow = 0;
  // modules whose byproducts have a side route of their own
  const sideOut = new Set<number>();
  for (const r of g.routes) if (r.by && r.to) sideOut.add(r.from.id);
  for (const r of g.routes) {
    const to = r.to;
    if (!to) continue;
    let room = cap;
    for (const t of r.tiles) room = Math.min(room, cap - (used.get(t.id) ?? 0));
    if (room <= 1e-9) continue;
    const src = r.from;
    const keys = Object.keys(src.outBuf)
      .filter((k) => src.outBuf[k] > 1e-9 && (r.by ? BYPRODUCTS.has(k) : !BYPRODUCTS.has(k) || !sideOut.has(src.id)))
      .sort();
    if (!keys.length) continue;
    let moved = 0;
    // round robin: an equal share each, then what is left to whoever still has some
    for (let pass = 0; pass < 2 && moved < room - 1e-9; pass++) {
      const live = keys.filter((k) => src.outBuf[k] > 1e-9 && acceptRoom(g, to, k) > 1e-9);
      if (!live.length) break;
      const share = (room - moved) / live.length;
      for (let n = 0; n < live.length; n++) {
        const k = live[(n + src.rr) % live.length];
        const amt = Math.min(src.outBuf[k], share, acceptRoom(g, to, k));
        if (amt <= 0) continue;
        src.outBuf[k] -= amt;
        give(g, to, k, amt);
        if (g.s.faudit) fauditFlow(g, src, to, k, amt);
        moved += amt;
      }
    }
    src.rr++;
    for (const t of r.tiles) {
      used.set(t.id, (used.get(t.id) ?? 0) + moved);
      t.flow = (used.get(t.id) ?? 0) * TICK_RATE;
    }
  }
  // 3. whole items reaching the Factory Dock and Hopper are paid out by the docks system; the
  // Megaproject Bay counts them toward its stage
  for (const e of f.ents) {
    if (e.kind !== 'fdock' && e.kind !== 'fhopper' && e.kind !== 'fbay') continue;
    for (const k of Object.keys(e.inBuf)) {
      const n = Math.floor(e.inBuf[k] + 1e-9);
      if (n < 1) continue;
      e.inBuf[k] -= n;
      if (e.kind === 'fbay') megaGive(g, e, k as ItemId, n);
      else g.intake.push({ to: e.kind === 'fdock' ? 'dock' : 'hopper', item: k as ItemId, x: e.x + 1, y: e.y + 1, n: Num.of(n), floor: 'factory' });
    }
  }
  // 4. once a second: statistics, the slice's end, and the Megaproject Bay arriving
  if (g.s.tick % TICK_RATE === 0) {
    for (const m of f.ents) {
      if (m.kind !== 'module') continue;
      const [w, s, b] = m.sec;
      const top = Math.max(w, s, b);
      m.hist = (m.hist + (top === 0 ? 'i' : top === w ? 'w' : top === b ? 'b' : 's')).slice(-60);
      m.sec = [0, 0, 0, 0];
      // seconds in a row at half speed or better
      m.ok = (m.fsum ?? 0) / TICK_RATE >= 0.5 ? (m.ok ?? 0) + 1 : 0;
      m.fsum = 0;
    }
    sliceEndCheck(g);
    if (g.done('greatDrill') && !f.ents.some((e) => e.kind === 'fbay')) placeBay(g);
    const bay = f.ents.find((e) => e.kind === 'fbay');
    if (bay) megaBearings(g, bay);
  }
}

/** The slice's end (DESIGN.md §11, §13 check 9; DECISIONS.md, the Milestone 1-2 review): a
 * factory, not three copies beside a Dock. Modules making three different products, at least one
 * module feeding another, each of them at half speed or better for 30 s straight, every one
 * reaching the Factory Dock (through the others). */
export function sliceEndParts(g: Game): { designs: number; chained: boolean; running: number } {
  const live = g.s.factory.ents.filter((m) => m.kind === 'module' && (m.ok ?? 0) >= 30 && feedsDock(g, m));
  const designs = new Set(live.map((m) => { const d = g.design(m.design); return d ? mainItem(d) : null; })).size;
  const ids = new Set(live.map((m) => m.id));
  const chained = g.routes.some((r) => !r.by && r.to?.kind === 'module' && ids.has(r.from.id) && ids.has(r.to.id));
  return { designs, chained, running: live.length };
}

/** The slice ends when Bramble's Gizmo Festival is filled at the Factory Dock (DESIGN.md §11):
 * Gizmos at rate need a Gizmo module fed by gear and wire modules, so the floor must be built. */
function sliceEndCheck(g: Game) {
  if (g.flag('sliceEnd')) return;
  if (g.s.orders.done.includes('gizmoFestival') && g.first('sliceEnd')) g.emit({ type: 'sliceEnd', value: sliceEndParts(g).running, floor: 'factory' });
}

/** Put the Megaproject Bay down once its 2x2 at the floor's corner is clear. */
function placeBay(g: Game) {
  const b = FACTORY.bay;
  for (let y = b.y; y < b.y + 2; y++) for (let x = b.x; x < b.x + 2; x++) if (g.fentAt(x, y)) return;
  const f = g.s.factory;
  f.ents.push(newFEnt(f.nextId++, 'fbay', b.x, b.y, 0));
  g.factoryDirty = true;
  g.emit({ type: 'bayOpen', x: b.x + 1, y: b.y + 1, floor: 'factory' });
}

/** Count whole items into the Megaproject's current stage; complete it when everything is in.
 * Each delivery earns its share of the stage's Patents for this run's Reorganize (DESIGN.md §19). */
function megaGive(g: Game, bay: FEnt, item: ItemId, n: number) {
  const st = megaStage(g.s.mega.stage);
  if (!st) return;
  const p = g.s.mega.progress;
  const want = st.wants[item] ?? 0;
  const have = p[item]?.toNumber() ?? 0;
  const counted = Math.max(0, Math.min(n, want - have));
  p[item] = (p[item] ?? Num.ZERO).add(n);
  if (counted > 0) g.s.megaPatents += (st.patents * counted) / want / megaParts(st);
  g.emit({ type: 'megaGive', x: bay.x + 1, y: bay.y + 1, id: item, value: n, floor: 'factory' });
  megaCheck(g, bay);
}

/** How many things a stage wants (its items, and the bearings as one more): each is an equal share
 * of its Patents. */
export function megaParts(st: MegaStage): number {
  return Object.keys(st.wants).length + (st.bearings ? 1 : 0);
}

/** Bearings handed from the stash to the Bay (stages 2 and 3), once a second. */
function megaBearings(g: Game, bay: FEnt) {
  const st = megaStage(g.s.mega.stage);
  if (!st?.bearings) return;
  const have = g.s.mega.bearings ?? 0;
  const take = Math.min(st.bearings - have, Math.floor(g.s.meta.bearings.toNumber()));
  if (take <= 0) return;
  g.s.meta.bearings = g.s.meta.bearings.sub(take);
  g.s.mega.bearings = have + take;
  g.s.megaPatents += (st.patents * take) / st.bearings / megaParts(st);
  g.emit({ type: 'megaGive', x: bay.x + 1, y: bay.y + 1, id: 'bearing', value: take, floor: 'factory' });
  megaCheck(g, bay);
}

function megaCheck(g: Game, bay: FEnt) {
  const st = megaStage(g.s.mega.stage);
  if (!st) return;
  const p = g.s.mega.progress;
  const done = (Object.entries(st.wants) as [ItemId, number][]).every(([k, want]) => (p[k] ?? Num.ZERO).gte(want)) && (g.s.mega.bearings ?? 0) >= (st.bearings ?? 0);
  if (done) {
    g.s.mega.stage = st.stage;
    g.s.mega.progress = {};
    g.s.mega.bearings = 0;
    g.bump('megaStages');
    // stages 2 and 3 change the Workshop's ground (miners beside patches, deep deposits)
    g.layoutDirty = true;
    g.emit({ type: 'megaDone', x: bay.x + 1, y: bay.y + 1, value: st.stage, floor: 'factory' });
  }
}

/** How much more of `item` the destination can take this tick. */
export function acceptRoom(g: Game, to: FEnt, item: string): number {
  // the Factory Dock scraps slag for nothing and refuses what the Dock refuses (Machine Kits,
  // Drill Bits); the Factory Hopper takes slag only while research wants it (DECISIONS.md)
  if (to.kind === 'fdock') return item === 'slag' || !ITEMS[item as ItemId]?.refused ? Infinity : 0;
  if (to.kind === 'fhopper') return item !== 'slag' || hopperWantsSlag(g) ? Infinity : 0;
  if (to.kind === 'fbay') {
    const st = megaStage(g.s.mega.stage);
    const want = st?.wants[item as ItemId];
    if (!want) return 0;
    // stages 2 and 3 start once their Raccoon Bearings are in: the bore head is the Committee's
    if (st && st.bearings && (g.s.mega.bearings ?? 0) < st.bearings) return 0;
    return Math.max(0, want - (g.s.mega.progress[item as ItemId]?.toNumber() ?? 0) - (to.inBuf[item] ?? 0));
  }
  if (to.kind !== 'module') return 0;
  const d = g.design(to.design);
  const r = d?.ins[item as ItemId];
  if (!r) return 0;
  return Math.max(0, r * prules(g).moduleBuffer - (to.inBuf[item] ?? 0));
}

function give(_g: Game, to: FEnt, item: string, amt: number) {
  to.inBuf[item] = (to.inBuf[item] ?? 0) + amt;
}
