// The high floors (DESIGN.md §21 the District, §22 the World): platforms of folded groups above the
// Factory. Modules run exactly as on the Factory (stepModule), but nothing lies between them: they
// are joined by skiff routes, each flying one item from a module's output to a module that takes
// it, or to the floor's Dock, Hopper or Bay. A route moves at most
//
//     skiffs x load / (2 x distance / speed + dwell)   items a second
//
// so where a module stands is a decision: a feeder beside its consumer needs one skiff, across the
// floor three to six. Skiffs are bought one at a time at a flat price and refunded when taken off.
// What reaches the Dock sells and fills orders, the Hopper pays research, the Bay builds
// Megaprojects #2 and on (`s.megas`, kept through every reset). A group joined by routes inside a
// box folds again, one depth up (research District Folds): its ports are the routes crossing the
// box edge, and the skiffs inside are refunded like trunk tiles.
// Pure: no DOM, timers or clocks. Rates are plain numbers; what reaches a Dock, Hopper or Bay is
// paid out as whole items, as Nums.
import type { Game, ActResult } from '../Game';
import { OK, no } from '../Game';
import { Num } from '../../engine/num';
import { TICK_RATE } from '../../engine/time';
import { HIGH, skiffRate, type HighFloorDef, type HighFloorId } from '../../data/floors';
import { ITEMS, itemName, type ItemId } from '../../data/items';
import { MEGAS, MEGA_IDS, type MegaId, type MegaStage } from '../../data/megaprojects';
import { RESEARCH } from '../../data/research';
import { RULES, SCORE_WEIGHTS, gradeFor } from '../../data/rules';
import { newFEnt, newHighFloor, type AuditResult, type Box, type FEnt, type HAuditState, type HighFloorState, type ModuleDesign, type SkiffRoute } from '../world';
import { BYPRODUCTS, defaultName, mainItem, moduleBoost, moduleSecond, stepModule } from './modules';
import { placeClaimRefusal } from './claims';
import { hopperWantsWaste } from '../transfer';
import { inBox, splusGate } from './audits';
import { inspire } from './inspire';
import { prules } from '../patents';
import { lrules } from '../legacy';

const DT = 1 / TICK_RATE;

export const HIGH_IDS: HighFloorId[] = ['district', 'world'];

/** The floor's state, if it is open this run. */
export function hfloor(g: Game, id: HighFloorId): HighFloorState | undefined {
  return g.s[id];
}

/** Is the floor open (its research done this run, or opened another way: the World with Act IV)? */
export function highOpen(g: Game, id: HighFloorId): boolean {
  return !!g.s[id];
}

/** Lots the floor holds for good: the Floating City's second stage gives the District a fourth. */
export function keptLots(g: Game, id: HighFloorId): number {
  if (id === 'world') return megaDone(g, 'lighthouse', 3) ? 1 : 0;
  return (g.s.megas?.city?.stage ?? 0) >= 2 ? 1 : 0;
}

/** The floor's width now: its first width, the lots bought this run and those kept for good. */
export function highW(g: Game, id: HighFloorId): number {
  const f = HIGH[id], st = g.s[id];
  return f.w + f.lotCols * ((st?.lots ?? 0) + keptLots(g, id));
}

/** The widest the floor gets (every lot, and the kept one). */
export function highMaxW(id: HighFloorId): number {
  const f = HIGH[id];
  return f.w + f.lotCols * (f.lots + 1);
}

export const highInb = (g: Game, id: HighFloorId, x: number, y: number) => x >= 0 && y >= 0 && x < highW(g, id) && y < HIGH[id].h;

// ------------------------------------------------------------------ caches

interface Cache { st: HighFloorState; ver: number; grid: Int32Array; byId: Map<number, FEnt> }
const caches = new WeakMap<Game, Partial<Record<HighFloorId, Cache>>>();

/** Bumped by every layout change on a high floor (the renderer re-reads what depends on it). */
export function touch(g: Game, id: HighFloorId) {
  const c = caches.get(g)?.[id];
  if (c) c.ver = -1;
  g.hversion++;
}

function cache(g: Game, id: HighFloorId): Cache | null {
  const st = g.s[id];
  if (!st) return null;
  let all = caches.get(g);
  if (!all) caches.set(g, (all = {}));
  let c = all[id];
  if (c && c.st === st && c.ver === g.hversion) return c;
  const W = highMaxW(id), H = HIGH[id].h;
  const grid = new Int32Array(W * H);
  const byId = new Map<number, FEnt>();
  for (const e of st.ents) {
    byId.set(e.id, e);
    for (let y = e.y; y < e.y + e.h; y++) for (let x = e.x; x < e.x + e.w; x++) if (x < W && y < H) grid[y * W + x] = e.id;
  }
  c = { st, ver: g.hversion, grid, byId };
  all[id] = c;
  return c;
}

export function hentAt(g: Game, id: HighFloorId, x: number, y: number): FEnt | null {
  if (!highInb(g, id, x, y)) return null;
  const c = cache(g, id);
  if (!c) return null;
  const e = c.grid[y * highMaxW(id) + x];
  return e ? c.byId.get(e) ?? null : null;
}

export function hent(g: Game, id: HighFloorId, eid: number): FEnt | null {
  return cache(g, id)?.byId.get(eid) ?? null;
}

export function hname(g: Game, e: FEnt): string {
  if (e.kind === 'fdock') return 'Dock';
  if (e.kind === 'fhopper') return 'Hopper';
  if (e.kind === 'fbay') return 'Megaproject Bay';
  return g.design(e.design)?.name ?? 'Module';
}

/** Tile distance between two things' centres, as the skiffs fly. */
export function routeDist(a: FEnt, b: FEnt): number {
  const ax = a.x + a.w / 2, ay = a.y + a.h / 2, bx = b.x + b.w / 2, by = b.y + b.h / 2;
  return Math.max(1, Math.hypot(ax - bx, ay - by));
}

/** A skiff's load and speed on this floor now: Bramble's Skiff Club (rep 4) adds one to the load,
 * Long Skiffs (a Patent) a tile a second to the speed (DESIGN.md §21). */
export function skiffStats(g: Game, id: HighFloorId): { load: number; speed: number; dwell: number } {
  const f = HIGH[id];
  return {
    load: f.load + (g.s.orders.rep.bramble >= 4 ? RULES.brambleSkiffLoad.value : 0),
    // Long Skiffs flies the District's; the Lighthouse's Lens Room the World's barges (DESIGN.md §22)
    speed: f.speed + (id === 'district' ? prules(g).skiffSpeed : megaDone(g, 'lighthouse', 1) ? RULES.lighthouseSpeed.value : 0),
    // the Lighthouse's Beacon: loading in half the time on every high floor
    dwell: f.dwell * (megaDone(g, 'lighthouse', 2) ? RULES.lighthouseDwell.value : 1),
  };
}

/** Items a second one skiff carries on a route this long on this floor now (the Lighthouse's Light
 * counts a route at most six tiles long). */
export function skiffRateNow(g: Game, id: HighFloorId, dist: number): number {
  const k = skiffStats(g, id);
  const d = megaDone(g, 'lighthouse', 4) ? Math.min(dist, RULES.lighthouseReach.value) : dist;
  return skiffRate(HIGH[id], d, k.load, k.speed, k.dwell);
}

/** Items a second this route can carry with its skiffs. */
export function routeCap(g: Game, id: HighFloorId, r: SkiffRoute): number {
  const a = hent(g, id, r.from), b = hent(g, id, r.to);
  if (!a || !b) return 0;
  return r.skiffs * skiffRateNow(g, id, routeDist(a, b));
}

/** What the route's source makes of its item a second at full speed (the readout's "wanted"), or
 * what its destination takes, whichever is less (the Dock, Hopper and Bay take all). */
export function routeWant(g: Game, id: HighFloorId, r: SkiffRoute): number {
  const a = hent(g, id, r.from), b = hent(g, id, r.to);
  const da = a ? g.design(a.design) : undefined;
  // the Great Drill's boost runs every module faster, and so what it makes and takes (the second
  // gate: the card read "0.18/s of 0.11 wanted")
  const drill = drillFactor(g);
  const make = (da?.outs[r.item] ?? 0) * drill;
  if (!b || b.kind !== 'module') return make;
  const db = g.design(b.design);
  return Math.min(make, (db?.ins[r.item] ?? 0) * drill);
}

/** The Great Drill's stage 1 boost every module runs at (DESIGN.md §19). */
export const drillFactor = (g: Game) => (g.s.mega.stage >= 1 ? 1 + RULES.drillBoost.value : 1);

/** Routes this floor holds now: 120, and 20 more a lot bought (DESIGN.md §21), and the No
 * Splitters Challenge's 20 once won. */
export function maxRoutes(g: Game, id: HighFloorId): number {
  const st = g.s[id];
  return RULES.maxRoutes.value + RULES.routesPerLot.value * (st?.lots ?? 0) + (g.s.meta.challenges?.includes('noSplitters') ? RULES.routesPerLot.value : 0);
}

// ------------------------------------------------------------------ opening

/** Open a high floor this run (its research just finished, or a head start knew it). */
export function openHigh(g: Game, id: HighFloorId) {
  if (g.s[id]) return;
  g.s[id] = newHighFloor(id);
  // District Deeds (a head start, DESIGN.md §21): it opens with its first lot; the Sky Anchor keeps
  // the lots bought in earlier runs (§22)
  const lots = Math.max(id === 'district' ? g.s.headLots ?? 0 : 0, g.s.meta.keptRoom?.[id] ?? 0);
  if (lots) g.s[id]!.lots = Math.min(HIGH[id].lots, lots);
  // the World floor has stood in this world: a Relocate is open from here (§22)
  if (id === 'world' && g.s.meta.here) g.s.meta.here.opened = true;
  touch(g, id);
  g.emit({ type: 'floorOpen', id, floor: id });
}

/** Called each tick: a floor opens when its research is done. */
function checkOpen(g: Game) {
  for (const id of HIGH_IDS) {
    const r = HIGH[id].opens;
    if (r && !g.s[id] && g.done(r)) openHigh(g, id);
  }
}

// ------------------------------------------------------------------ building

/** Why this design can't be placed on the floor here, or null. */
export function hplaceRefusal(g: Game, id: HighFloorId, design: number, x: number, y: number): string | null {
  const f = HIGH[id];
  if (!g.s[id]) return `The ${f.name} opens with research ${f.opens ? RESEARCH[f.opens].name : 'later'}`;
  if (!highInb(g, id, x, y)) {
    const lot = x >= highW(g, id) && x < highMaxW(id) && y >= 0 && y < f.h;
    return lot ? `Buy this lot first (${lotPrice(g, id)?.format() ?? '?'} coin)` : 'off the floor';
  }
  if (hauditLock(g, id, x, y)) return hauditLock(g, id, x, y);
  const e = hentAt(g, id, x, y);
  if (e) return `${hname(g, e)} is in the way`;
  const d = g.design(design);
  if (!d) return 'Pick a module from the inventory';
  // the District also takes its own folds (depth 3): a fold packs a group's routes into one tile's
  // ports (the second gate: a District fold had nowhere to go until the World)
  const dd = d.depth ?? 1;
  if (dd !== f.depth && !(id === 'district' && dd === 3)) return `The ${f.name} takes depth-${f.depth}${id === 'district' ? ' and depth-3' : ''} modules: ${dd < f.depth ? 'fold a group of these on the floor below' : 'this one goes on a floor above'}`;
  if (d.spare < 1) return `No spare ${d.name}: stamp a copy`;
  return placeClaimRefusal(g, d);
}

export function hplace(g: Game, id: HighFloorId, design: number, x: number, y: number): ActResult {
  const why = hplaceRefusal(g, id, design, x, y);
  if (why) return no(why);
  const st = g.s[id]!;
  const d = g.design(design)!;
  d.spare--;
  st.ents.push(newFEnt(st.nextId++, 'module', x, y, 0, d.id));
  touch(g, id);
  g.bump('modulesPlaced');
  g.bump(id + 'Placed');
  g.emit({ type: 'place', x, y, id: 'module', floor: id });
  if (g.first(id + ':first')) g.emit({ type: 'firstHigh', x, y, id, floor: id });
  return OK;
}

export function hremove(g: Game, id: HighFloorId, x: number, y: number): ActResult {
  const st = g.s[id];
  if (!st) return no('not open');
  const e = hentAt(g, id, x, y);
  if (!e) return no('nothing here');
  if (e.kind !== 'module') return no(`The ${hname(g, e)} stays`);
  const lock = hauditLock(g, id, x, y);
  if (lock) return no(lock);
  const d = g.design(e.design);
  if (d) d.spare++;
  // its routes go with it, their skiffs refunded
  for (const r of st.routes.filter((q) => q.from === e.id || q.to === e.id)) dropRoute(g, id, r);
  st.ents = st.ents.filter((q) => q !== e);
  touch(g, id);
  g.emit({ type: 'remove', x, y, id: 'module', floor: id });
  return OK;
}

function dropRoute(g: Game, id: HighFloorId, r: SkiffRoute) {
  const st = g.s[id]!;
  // a skiff the Committee gave (Pocket Skiffs, rep 6) or the Skiff Guild's (§22) is not refunded
  g.s.coin = g.s.coin.add(HIGH[id].skiffCost * Math.max(0, r.skiffs - unpaid(r)));
  st.routes = st.routes.filter((q) => q !== r);
}

/** The skiffs on a route nobody paid for: the Committee's and the Skiff Guild's. */
const unpaid = (r: SkiffRoute) => (r.free ? 1 : 0) + (r.guild ? 1 : 0);

/** Can `to` take `item` by skiff (the kind of thing it is, not whether it has room now)? */
export function takes(g: Game, id: HighFloorId, to: FEnt, item: ItemId): boolean {
  if (to.kind === 'fdock') return !ITEMS[item].refused || BYPRODUCTS.has(item);
  if (to.kind === 'fhopper') return true;
  if (to.kind === 'fbay') return bayWants(g, id).has(item);
  if (to.kind !== 'module') return false;
  return !!g.design(to.design)?.ins[item];
}

/** Why a route from (fx, fy) to (tx, ty) carrying `item` can't be made, or null. */
export function routeRefusal(g: Game, id: HighFloorId, fx: number, fy: number, tx: number, ty: number, item: ItemId): string | null {
  const st = g.s[id];
  if (!st) return 'not open';
  const a = hentAt(g, id, fx, fy), b = hentAt(g, id, tx, ty);
  if (!a || a.kind !== 'module') return 'A route starts at a module';
  const da = g.design(a.design);
  if (!da?.outs[item]) return `${hname(g, a)} makes no ${itemName(item).toLowerCase()}`;
  if (!b) return 'A route ends at a module, the Dock, the Hopper or the Bay';
  if (b === a) return 'A route goes somewhere else';
  if (!takes(g, id, b, item)) return b.kind === 'module' ? `${hname(g, b)} takes no ${itemName(item).toLowerCase()}` : b.kind === 'fbay' ? 'No Megaproject here wants that' : `The ${hname(g, b)} refuses ${itemName(item).toLowerCase()}`;
  if (st.routes.some((r) => r.from === a.id && r.to === b.id && r.item === item)) return 'That route is flown already: add a skiff to it';
  if (st.routes.length >= maxRoutes(g, id)) return `${maxRoutes(g, id)} routes is the most this floor holds now: a lot adds 20, or fold a group into one tile`;
  const lock = hauditLock(g, id, fx, fy) ?? hauditLock(g, id, tx, ty);
  if (lock) return lock;
  if (!pocketSkiff(g) && g.s.coin.lt(HIGH[id].skiffCost)) return `A skiff costs ${Num.of(HIGH[id].skiffCost).format()} coin`;
  return null;
}

/** The Committee's Pocket Skiffs (rep 6): a route's first skiff costs nothing. */
const pocketSkiff = (g: Game) => (g.s.orders.rep.committee ?? 0) >= 6;

export function addRoute(g: Game, id: HighFloorId, fx: number, fy: number, tx: number, ty: number, item: ItemId): ActResult {
  const why = routeRefusal(g, id, fx, fy, tx, ty, item);
  if (why) return no(why);
  const st = g.s[id]!;
  const a = hentAt(g, id, fx, fy)!, b = hentAt(g, id, tx, ty)!;
  const free = pocketSkiff(g);
  if (!free) g.s.coin = g.s.coin.sub(HIGH[id].skiffCost);
  // the Skiff Guild (a Legacy node, DESIGN.md §22): a second skiff, free, that stays with the route
  const guild = lrules(g).skiffGuild;
  st.routes.push({ id: st.nextRoute++, from: a.id, to: b.id, item, skiffs: guild ? 2 : 1, flow: 0, moved: 0, ...(free ? { free: true } : {}), ...(guild ? { guild: true } : {}) });
  g.bump('routes');
  g.emit({ type: 'route', x: a.x, y: a.y, x2: b.x, y2: b.y, id: item, floor: id });
  if (g.first('firstRoute')) g.emit({ type: 'firstRoute', x: a.x, y: a.y, floor: id });
  return OK;
}

/** One more skiff on a route (+1), or one fewer (-1; the last one leaves the route standing). */
export function setSkiffs(g: Game, id: HighFloorId, rid: number, delta: number): ActResult {
  const st = g.s[id];
  const r = st?.routes.find((q) => q.id === rid);
  if (!st || !r) return no('No such route');
  const f = HIGH[id];
  if (delta > 0) {
    if (r.skiffs >= f.maxSkiffs) return no(`${f.maxSkiffs} skiffs is the most a route takes`);
    if (g.s.coin.lt(f.skiffCost)) return no(`A skiff costs ${Num.of(f.skiffCost).format()} coin`);
    g.s.coin = g.s.coin.sub(f.skiffCost);
    r.skiffs++;
    g.bump('skiffs');
  } else {
    if (r.skiffs <= 1) return no('A route keeps one skiff: take the route off to lift it');
    if (r.skiffs <= unpaid(r)) return no('The free skiffs stay with the route: take the route off to lift them');
    g.s.coin = g.s.coin.add(f.skiffCost);
    r.skiffs--;
  }
  g.emit({ type: 'skiff', value: r.skiffs, floor: id });
  return OK;
}

export function unroute(g: Game, id: HighFloorId, rid: number): ActResult {
  const st = g.s[id];
  const r = st?.routes.find((q) => q.id === rid);
  if (!st || !r) return no('No such route');
  const a = hent(g, id, r.from), b = hent(g, id, r.to);
  const lock = (a && hauditLock(g, id, a.x, a.y)) || (b && hauditLock(g, id, b.x, b.y));
  if (lock) return no(lock);
  dropRoute(g, id, r);
  g.emit({ type: 'unroute', floor: id });
  return OK;
}

/** What the next lot east of the floor costs: base x n, linear. */
export function lotPrice(g: Game, id: HighFloorId): Num | null {
  const st = g.s[id], f = HIGH[id];
  if (!st || st.lots >= f.lots) return null;
  return Num.of(f.lotBase * (st.lots + 1));
}

export function buyLot(g: Game, id: HighFloorId): ActResult {
  const st = g.s[id];
  if (!st) return no('not open');
  const p = lotPrice(g, id);
  if (!p) return no(`Every lot of the ${HIGH[id].name} is yours`);
  if (g.s.coin.lt(p)) return no(`The next lot costs ${p.format()} coin`);
  g.s.coin = g.s.coin.sub(p);
  st.lots++;
  touch(g, id);
  g.bump('lots');
  g.emit({ type: 'land', id: id + 'Lot', x: highW(g, id) - 1, y: HIGH[id].h / 2, floor: id });
  return OK;
}

/** A click on a high floor: the Hopper takes Inspiration; a module, Overdrive for it and every
 * module joined to it by routes (DESIGN.md §18, as the Factory's trunk groups). */
export function hclick(g: Game, id: HighFloorId, x: number, y: number): ActResult {
  const e = hentAt(g, id, x, y);
  if (!e) return no('nothing here');
  if (e.kind === 'fhopper') return g.countClick() ? inspire(g, e.x + 1, e.y + 1, id) : no('too fast');
  if (e.kind !== 'module') return no('Click a module to overdrive it');
  if (!g.done('overdrive')) return no('Research Overdrive first');
  if ((e.od ?? 0) > 0) return no('Overdriven already');
  if ((e.cool ?? 0) > 0) return no(`Cooling down: ${Math.ceil((e.cool ?? 0) / TICK_RATE)} s`);
  if (isHAudited(g, id, e.id)) return no('Auditing: Overdrive would spoil the measurement');
  if (!g.countClick()) return no('too fast');
  const st = g.s[id]!;
  const seen = new Set<number>([e.id]);
  const todo = [e.id];
  while (todo.length) {
    const cur = todo.pop()!;
    for (const r of st.routes) {
      const other = r.from === cur ? r.to : r.to === cur ? r.from : null;
      if (other !== null && !seen.has(other)) {
        const o = hent(g, id, other);
        if (o?.kind === 'module') { seen.add(other); todo.push(other); }
      }
    }
  }
  const ticks = Math.round(RULES.overdriveSeconds.value * TICK_RATE);
  let n = 0;
  for (const mid of seen) {
    const m = hent(g, id, mid)!;
    if ((m.od ?? 0) > 0 || (m.cool ?? 0) > 0 || isHAudited(g, id, m.id)) continue;
    m.od = ticks;
    n++;
  }
  g.bump('overdrives');
  g.emit({ type: 'overdrive', x: e.x, y: e.y, value: e.id, d: n, floor: id });
  return OK;
}

// ------------------------------------------------------------------ Megaprojects #2 and on

/** The stage a project is building now, or null when it is done. */
export function megaStageOf(g: Game, mid: MegaId): MegaStage | null {
  const def = MEGAS[mid];
  const ms = g.s.megas?.[mid];
  // Megaprojects #4 and #5 (DESIGN.md §22): the stage of the island the town is on, if not built
  if (def.anyOrder) {
    const w = g.s.meta.world ?? 'home';
    return def.stages.find((st) => st.world === w && !ms?.done?.includes(st.stage)) ?? null;
  }
  const done = ms?.stage ?? 0;
  return def.stages.find((st) => st.stage === done + 1) ?? null;
}

/** Does this stage of a project stand (its reward is a rule kept for good)? */
export function megaDone(g: Game, mid: MegaId, stage: number): boolean {
  const ms = g.s.megas?.[mid];
  if (!ms) return false;
  return MEGAS[mid].anyOrder ? !!ms.done?.includes(stage) : ms.stage >= stage;
}

/** A project is open once its research is done this run, or for good once a stage of it stands
 * (its progress is kept, so a later run doesn't pay the research again: the second gate). */
export const projectOpen = (g: Game, m: MegaId) => g.done(MEGAS[m].opens as never) || (g.s.megas?.[m]?.stage ?? 0) >= 1;

/** Projects this floor's Bay builds now (progress is kept). */
export function bayProjects(g: Game, id: HighFloorId): MegaId[] {
  return MEGA_IDS.filter((m) => MEGAS[m].floor === id && projectOpen(g, m) && megaStageOf(g, m));
}

/** Items some open project at this floor's Bay still wants. */
export function bayWants(g: Game, id: HighFloorId): Set<ItemId> {
  const out = new Set<ItemId>();
  for (const m of bayProjects(g, id)) {
    const st = megaStageOf(g, m)!;
    const p = g.s.megas?.[m]?.progress ?? {};
    for (const [k, want] of Object.entries(st.wants) as [ItemId, number][]) if ((p[k]?.toNumber() ?? 0) < want) out.add(k);
  }
  return out;
}

/** Count whole items into the first open project that wants them; returns how many none could. */
export function megaGiveX(g: Game, id: HighFloorId, bay: FEnt, item: ItemId, n: number): number {
  let left = n;
  for (const mid of bayProjects(g, id)) {
    if (left <= 0) break;
    const st = megaStageOf(g, mid)!;
    const want = st.wants[item] ?? 0;
    if (!want) continue;
    const ms = ((g.s.megas ??= {})[mid] ??= { stage: 0, progress: {} });
    const have = ms.progress[item]?.toNumber() ?? 0;
    const counted = Math.max(0, Math.min(left, want - have));
    if (counted <= 0) continue;
    ms.progress[item] = (ms.progress[item] ?? Num.ZERO).add(counted);
    if (g.tally) {
      const t = g.tally[id === 'district' ? 'dbay' : 'wbay'];
      t[item] = (t[item] ?? Num.ZERO).add(counted);
    }
    g.s.megaPatents += (st.patents * counted) / want / Object.keys(st.wants).length;
    left -= counted;
    g.emit({ type: 'megaGive', x: bay.x + 1, y: bay.y + 1, id: item, value: counted, floor: id });
    const complete = (Object.entries(st.wants) as [ItemId, number][]).every(([k, w]) => (ms.progress[k] ?? Num.ZERO).gte(w));
    if (complete) {
      if (MEGAS[mid].anyOrder) {
        (ms.done ??= []).push(st.stage);
        ms.stage = ms.done.length;
      } else ms.stage = st.stage;
      ms.progress = {};
      // a stage done this world counts for its Legacy (DESIGN.md §22)
      if (g.s.meta.here) g.s.meta.here.stages++;
      g.bump('megaStages');
      g.layoutDirty = true;
      g.factoryDirty = true;
      touch(g, id);
      g.emit({ type: 'megaDone', x: bay.x + 1, y: bay.y + 1, id: mid, value: st.stage, floor: id });
    }
  }
  return left;
}

// ------------------------------------------------------------------ the tick

export function runHigh(g: Game) {
  checkOpen(g);
  for (const id of HIGH_IDS) {
    const st = g.s[id];
    if (st) runFloor(g, id, st);
  }
  runHAudit(g);
}

function runFloor(g: Game, id: HighFloorId, st: HighFloorState) {
  const f = HIGH[id];
  const pr = prules(g);
  const drill = g.s.mega.stage >= 1 ? 1 + RULES.drillBoost.value : 1;
  // 1. every module runs as its rates
  for (const m of st.ents) {
    if (m.kind !== 'module') continue;
    const d = g.design(m.design);
    if (!d) continue;
    stepModule(g, m, d, moduleBoost(g, m, d, drill, isHAudited(g, id, m.id)), pr.moduleBuffer, pr.overdriveCool);
  }
  // 2. the skiffs fly: each route takes its share of its source's output, as much as its skiffs
  // carry and its destination has room for; routes from one output share it in turn
  const groups = new Map<string, SkiffRoute[]>();
  for (const r of st.routes) {
    r.moved = 0;
    const k = r.from + ':' + r.item;
    let gr = groups.get(k);
    if (!gr) groups.set(k, (gr = []));
    gr.push(r);
  }
  for (const gr of groups.values()) {
    const src = hent(g, id, gr[0].from);
    if (!src) continue;
    const item = gr[0].item;
    const n = gr.length;
    const start = n > 1 ? g.s.tick % n : 0;
    for (let pass = 0; pass < 2; pass++) {
      for (let j = 0; j < n; j++) {
        const r = gr[(start + j) % n];
        const have = src.outBuf[item] ?? 0;
        if (have <= 1e-9) break;
        const to = hent(g, id, r.to);
        if (!to) continue;
        const cap = routeCap(g, id, r) * DT - r.moved;
        if (cap <= 1e-9) continue;
        const share = pass === 0 ? have / (n - j) : have;
        const amt = Math.min(share, cap, room(g, id, to, item));
        if (amt <= 1e-9) continue;
        src.outBuf[item] = have - amt;
        to.inBuf[item] = (to.inBuf[item] ?? 0) + amt;
        r.moved += amt;
        hauditFlow(g, id, src, to, item, amt);
      }
    }
    for (const r of gr) {
      r.flow = r.flow * 0.99 + r.moved * TICK_RATE * 0.01;
      if (r.moved > 1e-9) r.used = g.s.tick;
    }
  }
  // 2b. a module's waste with no route out goes down the floor's waste chute to its Dock (DESIGN.md
  // §21: the byproduct lesson was learned on the floors below; on a floor of groups it was the act's
  // biggest chore and filled the route cap: the second gate)
  const dock = st.ents.find((e) => e.kind === 'fdock');
  if (dock)
    for (const m of st.ents) {
      if (m.kind !== 'module') continue;
      for (const k of Object.keys(m.outBuf)) {
        const item = k as ItemId;
        const n = m.outBuf[item] ?? 0;
        if (n <= 1e-9 || !BYPRODUCTS.has(item) || groups.has(m.id + ':' + item)) continue;
        m.outBuf[item] = 0;
        dock.inBuf[item] = (dock.inBuf[item] ?? 0) + n;
        hauditFlow(g, id, m, dock, item, n);
      }
    }
  // 3. whole items at the Dock, the Hopper and the Bay are paid out
  for (const e of st.ents) {
    if (e.kind !== 'fdock' && e.kind !== 'fhopper' && e.kind !== 'fbay') continue;
    for (const k of Object.keys(e.inBuf)) {
      const n = Math.floor(e.inBuf[k] + 1e-9);
      if (n < 1) continue;
      e.inBuf[k] -= n;
      const item = k as ItemId;
      if (e.kind === 'fbay') {
        // the Bay never jams (as the Factory's): what no project counts goes on to the Dock
        const left = megaGiveX(g, id, e, item, n);
        if (left > 0 && !ITEMS[item]?.refused) g.intake.push({ to: 'dock', item, x: e.x + 1, y: e.y + 1, n: Num.of(left), floor: id });
      } else g.intake.push({ to: e.kind === 'fdock' ? 'dock' : 'hopper', item, x: e.x + 1, y: e.y + 1, n: Num.of(n), floor: id });
    }
  }
  // 4. once a second: statistics, and the Bay arriving once a project is researched
  if (g.s.tick % TICK_RATE === 0) {
    for (const m of st.ents) if (m.kind === 'module') moduleSecond(m);
    if (!st.ents.some((e) => e.kind === 'fbay') && MEGA_IDS.some((m) => MEGAS[m].floor === id && projectOpen(g, m))) placeHBay(g, id, st, f);
    if (pr.dispatcherEvery && (g.s.tick / TICK_RATE) % pr.dispatcherEvery === 0) dispatch(g, id, st, f);
  }
}

/** The Dispatcher (a Patent, DESIGN.md §21): one skiff, at its price, onto the route whose skiffs
 * carry the smallest share of what it is wanted, if that share is under 90% and a skiff is under
 * 5% of the coin on hand. Ties go to the oldest route, so it is deterministic. */
function dispatch(g: Game, id: HighFloorId, st: HighFloorState, f: HighFloorDef) {
  if (g.s.coin.lt(f.skiffCost * 20)) return;
  let best: SkiffRoute | null = null, bestShare = 0.9;
  for (const r of st.routes) {
    if (r.skiffs >= f.maxSkiffs) continue;
    const want = routeWant(g, id, r);
    if (want <= 1e-9) continue;
    const share = routeCap(g, id, r) / want;
    if (share < bestShare) { best = r; bestShare = share; }
  }
  if (!best) return;
  g.s.coin = g.s.coin.sub(f.skiffCost);
  best.skiffs++;
  g.bump('skiffs');
  g.bump('dispatched');
  g.emit({ type: 'skiff', value: best.skiffs, floor: id });
}

function placeHBay(g: Game, id: HighFloorId, st: HighFloorState, f: HighFloorDef) {
  for (let y = f.bay.y; y < f.bay.y + 2; y++) for (let x = f.bay.x; x < f.bay.x + 2; x++) if (hentAt(g, id, x, y)) return;
  st.ents.push(newFEnt(st.nextId++, 'fbay', f.bay.x, f.bay.y, 0));
  touch(g, id);
  g.emit({ type: 'bayOpen', x: f.bay.x + 1, y: f.bay.y + 1, floor: id });
}

/** Room at `to` for `item` this tick. */
function room(g: Game, id: HighFloorId, to: FEnt, item: ItemId): number {
  if (to.kind === 'fdock') return !ITEMS[item]?.refused || BYPRODUCTS.has(item) ? Infinity : 0;
  if (to.kind === 'fhopper') return !BYPRODUCTS.has(item) || hopperWantsWaste(g, item) ? Infinity : 0;
  if (to.kind === 'fbay') return bayWants(g, id).has(item) ? Infinity : 0;
  if (to.kind !== 'module' || to.paused) return 0;
  const r = g.design(to.design)?.ins[item];
  if (!r) return 0;
  return Math.max(0, r * prules(g).moduleBuffer - (to.inBuf[item] ?? 0));
}

// ------------------------------------------------------------------ folds on a high floor

/** Is this module being measured by a high-floor audit? */
export function isHAudited(g: Game, id: HighFloorId, eid: number): boolean {
  const a = g.s.haudit;
  return !!a && a.floor === id && !a.result && a.ids.includes(eid);
}

export function hauditLock(g: Game, id: HighFloorId, x: number, y: number): string | null {
  const a = g.s.haudit;
  if (a && a.floor === id && inBox(a.box, x, y)) return a.result ? 'Fold this group or cancel the audit first' : 'Auditing this box: wait for the grade, or cancel';
  return null;
}

export function hentsIn(g: Game, id: HighFloorId, b: Box): FEnt[] {
  const seen = new Set<number>();
  const out: FEnt[] = [];
  for (let y = b.y; y < b.y + b.h; y++)
    for (let x = b.x; x < b.x + b.w; x++) {
      const e = hentAt(g, id, x, y);
      if (e && !seen.has(e.id)) { seen.add(e.id); out.push(e); }
    }
  return out;
}

/** The research a fold on this floor needs (the World's is the Last Fold, Act V). */
const FOLD_RESEARCH: Record<HighFloorId, string> = { district: 'districtFolds', world: 'lastFold' };

/** Why this box on a high floor can't be folded, or null. */
export function hfoldRefusal(g: Game, id: HighFloorId, b: Box): string | null {
  const need = FOLD_RESEARCH[id];
  if (!g.done(need as never)) return `Research ${(RESEARCH as Record<string, { name: string } | undefined>)[need]?.name ?? 'the next fold'} first`;
  if (!g.s[id]) return 'not open';
  if (g.s.haudit) return g.s.haudit.result ? 'Fold or cancel the audited group first' : 'An audit is already running up here';
  const max = Math.max(HIGH[id].foldMax, id === 'district' ? prules(g).highFoldMax : 0);
  if (b.w > max || b.h > max) return `Too big: a fold here is at most ${max}x${max}`;
  if (b.w < 1 || b.h < 1) return 'Drag a box over a group of modules';
  if (b.x < 0 || b.y < 0 || b.x + b.w > highW(g, id) || b.y + b.h > HIGH[id].h) return 'The box is off the floor';
  const ents = hentsIn(g, id, b);
  for (const e of ents) if (e.kind !== 'module') return `The box holds the ${hname(g, e)}, which stays on the floor`;
  if (ents.length < 2) return 'Box at least two modules: a fold up here folds a group';
  const ids = new Set(ents.map((m) => m.id));
  const st = g.s[id]!;
  const inner = st.routes.filter((r) => ids.has(r.from) && ids.has(r.to));
  if (!inner.some((r) => !BYPRODUCTS.has(r.item))) return 'Box a group that works together: at least one module inside must feed another inside';
  const seen = new Set<number>([ents[0].id]);
  for (let grew = true; grew; ) {
    grew = false;
    for (const r of inner) if (seen.has(r.from) !== seen.has(r.to)) { seen.add(r.from); seen.add(r.to); grew = true; }
  }
  const stray = ents.find((m) => !seen.has(m.id));
  if (stray) return `${hname(g, stray)} isn't joined to the rest by a route inside the box: box one group`;
  return null;
}

export function startHAudit(g: Game, id: HighFloorId, b: Box): ActResult {
  const why = hfoldRefusal(g, id, b);
  if (why) return no(why);
  const mods = hentsIn(g, id, b);
  g.s.haudit = { floor: id, box: { ...b }, t: 0, ids: mods.map((m) => m.id), ins: {}, outs: {}, run: {}, made: 0, missed: 0, inside: 0, result: null } as HAuditState;
  g.bump('audits');
  g.emit({ type: 'auditStart', x: b.x + b.w / 2, y: b.y + b.h / 2, floor: id });
  return OK;
}

export function cancelHAudit(g: Game): ActResult {
  const a = g.s.haudit;
  if (!a) return no('No audit to cancel');
  g.s.haudit = null;
  g.emit({ type: 'auditCancel', x: a.box.x + a.box.w / 2, y: a.box.y + a.box.h / 2, floor: a.floor });
  return OK;
}

const warmTicks = (g: Game) => prules(g).auditWarmup * TICK_RATE;
const windowTicks = (g: Game) => prules(g).auditWindow * TICK_RATE;

function hauditFlow(g: Game, id: HighFloorId, from: FEnt, to: FEnt, item: string, amt: number) {
  const a = g.s.haudit;
  if (!a || a.floor !== id || a.result || a.t < warmTicks(g)) return;
  const fi = inBox(a.box, from.x, from.y), ti = inBox(a.box, to.x, to.y);
  if (fi && !ti) a.outs[item] = (a.outs[item] ?? 0) + amt;
  else if (!fi && ti) a.ins[item] = (a.ins[item] ?? 0) + amt;
  else if (fi && ti && BYPRODUCTS.has(item)) a.inside += amt;
}

function runHAudit(g: Game) {
  const a = g.s.haudit;
  if (!a || a.result) return;
  a.t++;
  const warm = warmTicks(g);
  if (a.t <= warm) return;
  for (const eid of a.ids) {
    const m = hent(g, a.floor, eid);
    if (!m) continue;
    a.run[eid] = (a.run[eid] ?? 0) + m.f;
    const d = g.design(m.design);
    if (!d) continue;
    for (const [o, r] of Object.entries(d.outs) as [ItemId, number][]) {
      if (!BYPRODUCTS.has(o)) continue;
      a.made += r * DT * m.f;
      if (m.state === 'blocked' && m.why === o) a.missed += r * DT * (1 - m.f);
    }
  }
  if (a.t >= warm + windowTicks(g)) {
    a.result = gradeHAudit(g);
    g.emit({ type: 'auditDone', x: a.box.x + a.box.w / 2, y: a.box.y + a.box.h / 2, id: a.result.grade.letter, d: a.result.grade.score, floor: a.floor });
  }
}

/** Grade the high-floor audit's window so far (or all of it): U, W, C as a nested fold's. */
export function gradeHAudit(g: Game): AuditResult {
  const a = g.s.haudit!;
  const n = Math.max(1, a.t - warmTicks(g));
  const secs = n / TICK_RATE;
  const mods = a.ids.map((eid) => hent(g, a.floor, eid)).filter((m): m is FEnt => !!m);
  const busy: Record<string, number> = {};
  let u = 0;
  for (const m of mods) {
    busy[m.id] = Math.min(1, (a.run[m.id] ?? 0) / n);
    u += busy[m.id];
  }
  u = mods.length ? u / mods.length : 0;
  let byOut = 0;
  for (const it of BYPRODUCTS) byOut += a.outs[it] ?? 0;
  const byMade = a.made + a.missed;
  const byHandled = Math.min(byMade, byOut + a.inside);
  const w = byMade > 1e-6 ? byHandled / byMade : 1;
  const c = Math.min(1, mods.length / (a.box.w * a.box.h) / RULES.compactFull.value);
  const score = SCORE_WEIGHTS.u * u + SCORE_WEIGHTS.w * w + SCORE_WEIGHTS.c * c;
  const gr = splusGate(gradeFor(score), score, byMade, a.inside);
  const rate = (t: Record<string, number>) => {
    const o: Partial<Record<ItemId, number>> = {};
    for (const [k, v] of Object.entries(t)) if (v > 1e-6) o[k as ItemId] = v / secs;
    return o;
  };
  const ins = rate(a.ins), outs = rate(a.outs);
  const lines: { lost: number; text: string }[] = [];
  if (!Object.keys(outs).length) lines.push({ lost: 1, text: 'Nothing left the box: fly a route out of it to the Dock, the Hopper or another module.' });
  const slow = mods.filter((m) => busy[m.id] < 0.9).sort((p, q) => busy[p.id] - busy[q.id]);
  if (slow.length) {
    const m = slow[0];
    const why = m.why ? `${m.state === 'blocked' ? 'blocked by' : 'starved of'} ${itemName(m.why as ItemId).toLowerCase()}` : 'waiting';
    lines.push({ lost: SCORE_WEIGHTS.u * (1 - u), text: `${hname(g, m)} ran ${Math.round(busy[m.id] * 100)}% (${why}). A skiff more on its route, or the feeder moved beside it.` });
  }
  if (byMade > 1e-6 && byHandled < byMade - 1e-6) lines.push({ lost: SCORE_WEIGHTS.w * (1 - w), text: `${Math.round(byMade - byHandled)} of ${Math.round(byMade)} byproducts went nowhere. Fly them out of the box, or to a module inside that uses them.` });
  if (c < 1) lines.push({ lost: SCORE_WEIGHTS.c * (1 - c), text: `${mods.length} of ${a.box.w * a.box.h} tiles are modules; ${Math.ceil(a.box.w * a.box.h * RULES.compactFull.value)} would be fully compact. Draw the box tighter.` });
  return {
    grade: { letter: gr.letter, score, u, w, c, mult: gr.mult },
    ins, outs, byMade, byHandled, machineTiles: mods.length, boxTiles: a.box.w * a.box.h, busy,
    advice: lines.sort((p, q) => q.lost - p.lost).map((l) => l.text),
  };
}

/** Fold the audited group into a design one depth up. Routes inside the box are its logistics
 * (their skiffs refunded); routes crossing its edge are lifted (refunded) with it. */
export function foldHAudited(g: Game, name: string | null): ActResult {
  const a = g.s.haudit;
  if (!a) return no('Nothing is being audited');
  if (!a.result) return no('The audit is still running');
  const id = a.floor;
  const st = g.s[id]!;
  const res = a.result;
  const mods = hentsIn(g, id, a.box).filter((e) => e.kind === 'module');
  const index = new Map(mods.map((m, i) => [m.id, i]));
  let bill = 0;
  for (const m of mods) bill += g.design(m.design)?.bill ?? 0;
  const inner = st.routes.filter((r) => index.has(r.from) && index.has(r.to));
  const mult = res.grade.mult;
  const scale = (t: Partial<Record<ItemId, number>>) => {
    const o: Partial<Record<ItemId, number>> = {};
    for (const [k, v] of Object.entries(t) as [ItemId, number][]) o[k] = v * mult;
    return o;
  };
  const outs = scale(res.outs);
  const depth = (HIGH[id].depth + 1) as 3 | 4;
  const d: ModuleDesign = {
    id: g.s.nextDesign++,
    name: (name ?? '').trim().slice(0, 28) || defaultName(outs) + (depth === 3 ? ' III' : ' IV'),
    box: { ...a.box },
    parts: [],
    depth,
    hfloor: id,
    hparts: mods.map((m) => ({ design: m.design, dx: m.x - a.box.x, dy: m.y - a.box.y })),
    hroutes: inner.map((r) => ({ from: index.get(r.from)!, to: index.get(r.to)!, item: r.item, skiffs: r.skiffs })),
    ins: scale(res.ins),
    outs,
    grade: { ...res.grade },
    bill,
    stamped: 0,
    spare: 1,
  };
  g.s.designs.push(d);
  // every route touching the group is lifted, its skiffs refunded
  for (const r of st.routes.filter((q) => index.has(q.from) || index.has(q.to))) dropRoute(g, id, r);
  const ids = new Set(mods.map((m) => m.id));
  st.ents = st.ents.filter((e) => !ids.has(e.id));
  touch(g, id);
  g.s.haudit = null;
  g.bump('folds');
  g.bump(id + 'Folds');
  if (res.grade.letter === 'S') g.bump('foldS');
  g.emit({ type: 'fold', x: a.box.x + a.box.w / 2, y: a.box.y + a.box.h / 2, id: d.grade.letter, value: d.id, d: a.box.w * a.box.h, floor: id });
  if (g.first('firstFold:' + id)) g.emit({ type: 'firstHighFold', x: a.box.x + a.box.w / 2, y: a.box.y + a.box.h / 2, value: d.id, floor: id });
  return OK;
}

/** Why a depth-3+ design can't be unfolded back onto its floor, or null. */
export function hunfoldRefusal(g: Game, d: ModuleDesign): string | null {
  const id = d.hfloor;
  if (!id || !d.hparts) return 'not a high floor design';
  if (!g.s[id]) return `The ${HIGH[id].name} is not open`;
  for (const p of d.hparts) {
    const x = d.box.x + p.dx, y = d.box.y + p.dy;
    if (!highInb(g, id, x, y)) return 'Its box is off the floor';
    if (hentAt(g, id, x, y)) return `The box at ${d.box.x},${d.box.y} is not empty`;
  }
  const skiffs = (d.hroutes ?? []).reduce((n, r) => n + r.skiffs, 0);
  if (g.s.coin.lt(skiffs * HIGH[id].skiffCost)) return `Its skiffs cost ${Num.of(skiffs * HIGH[id].skiffCost).format()} coin`;
  return null;
}

/** Put the group back: its modules (from no spare copies: they are inside this one) and its
 * routes, its skiffs paid again. */
export function hunfold(g: Game, d: ModuleDesign) {
  const id = d.hfloor!;
  const st = g.s[id]!;
  const ents = d.hparts!.map((p) => {
    const e = newFEnt(st.nextId++, 'module', d.box.x + p.dx, d.box.y + p.dy, 0, p.design);
    st.ents.push(e);
    return e;
  });
  for (const r of d.hroutes ?? []) {
    g.s.coin = g.s.coin.sub(r.skiffs * HIGH[id].skiffCost);
    st.routes.push({ id: st.nextRoute++, from: ents[r.from].id, to: ents[r.to].id, item: r.item, skiffs: r.skiffs, flow: 0, moved: 0 });
  }
  touch(g, id);
  g.emit({ type: 'unfold', x: d.box.x + d.box.w / 2, y: d.box.y + d.box.h / 2, value: d.id, floor: id });
}

/** Every module placed on a high floor (claims and copies count them). */
export function highModules(g: Game): FEnt[] {
  const out: FEnt[] = [];
  for (const id of HIGH_IDS) for (const e of g.s[id]?.ents ?? []) if (e.kind === 'module') out.push(e);
  return out;
}

/** The product a high floor's Dock is selling most of (for the floor's tag). */
export function topSale(g: Game, id: HighFloorId): ItemId | null {
  const st = g.s[id];
  if (!st) return null;
  let best: ItemId | null = null, bv = 0;
  for (const r of st.routes) {
    const to = hent(g, id, r.to);
    if (to?.kind !== 'fdock') continue;
    const v = r.flow * ITEMS[r.item].value;
    if (v > bv) { bv = v; best = r.item; }
  }
  return best;
}

export { mainItem };
