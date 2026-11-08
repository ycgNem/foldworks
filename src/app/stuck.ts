// "Where am I stuck?" (Milestone 13): a labelled button beside the trouble bell (and the G key)
// names the one bottleneck on the floor on screen that costs the most output, pans the camera to
// it, pins its report and has the Inspector say in one line what to do. Nothing stuck: what the
// next goal needs.
//
// The choice is `findStuck` (pure: it reads the Game and never writes it, so a test can ask it of a
// sandbox). Every stopped or starved thing is traced to its cause: a machine starved by a feeder
// that is itself stopped is that feeder's problem, a machine blocked by a slower machine after it
// is that machine's, and so on up and down the line. Each cause is charged the output lost at every
// stopped thing traced to it (its main output a minute at full speed, times the share of the last
// minute it was not working, times the item's coin value), plus, on a grid in a brownout, what the
// brownout slows. The dearest cause is the answer. On the Factory floor the same over modules and
// trunk routes; on the District over groups and skiff routes, where a route short of its want
// (`routeCap` under 90% of `routeWant`, the Dispatcher's test) is charged what it leaves behind.
import { ITEMS, itemName, type ItemId } from '../data/items';
import { BUILD, isMachine } from '../data/machines';
import { RECIPES } from '../data/recipes';
import { FACTORY } from '../data/land';
import { plain } from '../engine/fmt';
import { nominal, feeders, entName } from '../sim/analysis';
import { shares } from '../sim/systems/stats';
import { poleReach } from '../sim/systems/power';
import { fname } from '../sim/systems/modules';
import type { HighFloorId } from '../data/floors';
import { routeCap, routeWant, hent, hname, skiffRateNow, routeDist, maxRoutes, lotPrice, skiffsPrice } from '../sim/systems/high';
import { perMin } from '../engine/fmt';
import { BYPRODUCTS } from '../sim/systems/modules';
import { RULES } from '../data/rules';
import { DX, DY, type Ent, type FEnt, type Floor, type SkiffRoute } from '../sim/world';
import type { Game } from '../sim/Game';
import { capacity, gridIndex, powered } from '../render/powerview';
import { nextGoal } from './goals';
import { DS } from './district';
import type { App } from './app';

export interface Stuck {
  floor: Floor;
  /** what it points at: a Workshop entity, a Factory or District module, a District route, or
   * nothing (the goal) */
  kind: 'ent' | 'module' | 'route' | 'goal';
  /** the entity's or route's id */
  id: number;
  /** the tile to look at (centre) */
  x: number;
  y: number;
  /** its name (the report's title) */
  name: string;
  /** coin a minute the cause costs (its rank) */
  cost: number;
  /** the line: what is wrong and what to do (rich text) */
  say: string;
  /** the chips under the line */
  chips: string[];
}

/** coin an item is worth (a worthless item still counts a little: its line is stopped) */
const worth = (it: string | null | undefined) => Math.max(0.2, (it && ITEMS[it as ItemId]?.value) || 0);
const pm = (n: number) => plain(n, n < 10 ? 1 : 0);
const ic = (it: string | null | undefined) => (it && it in ITEMS ? `{i:${it}}` : '');
const lc = (it: string | null | undefined) => (it && it in ITEMS ? itemName(it).toLowerCase() : 'input');

/** The machine that makes an item first (for "add a Miner"). */
function makerName(item: string): string | null {
  const r = RECIPES.find((q) => q.outputs.some((o) => o.item === item));
  return r ? BUILD[r.machine].name : null;
}

/** A Workshop machine's main output a minute at full speed, in coin. */
function valuePerMin(m: Ent): number {
  const o = nominal(m).outs[0];
  return o ? o.perMin * worth(o.item) : 0;
}

/** The share of the last minute it lost (at least a quarter while it is stopped now). */
function lostShare(m: Ent): number {
  const sh = shares(m);
  return Math.max(sh.n ? 1 - sh.work : 1, m.state === 'work' ? 0 : 0.25);
}

interface Cause { key: string; floor: Floor; kind: Stuck['kind']; id: number; x: number; y: number; name: string; say: string; chips: string[] }

// ------------------------------------------------------------------ the Workshop

/** The first machine (or sink) a front leads to through belts, mergers, splitters and crates. */
function downstream(g: Game, m: Ent): Ent | null {
  let x = m.x + DX[m.rot], y = m.y + DY[m.rot];
  for (let i = 0; i < 300; i++) {
    const t = g.entAt(x, y);
    if (!t || t === m) return null;
    if (isMachine(t.kind) || t.kind === 'dock' || t.kind === 'hopper' || t.kind === 'heap') return t;
    x = t.x + DX[t.rot];
    y = t.y + DY[t.rot];
  }
  return null;
}

/** Trace a stopped Workshop machine to the cause worth fixing. */
function workshopCause(g: Game, m: Ent, seen: Set<number>): Cause {
  seen.add(m.id);
  const name = entName(g, m);
  const at = { floor: 'workshop' as Floor, kind: 'ent' as const, id: m.id, x: m.x + m.w / 2, y: m.y + m.h / 2, name };
  const c = (say: string, chips: string[] = []): Cause => ({ key: 'e' + m.id, ...at, say, chips });
  if (m.why === 'crank') return c(`${name}: waiting on a crank. {k:LMB} it, or buy the Bellows.`, ['{pip:starved} cranks']);
  if (m.why === 'power') {
    const gi = gridIndex(g, m);
    if (gi < 0) return c(`${name}: no power. A Pole within ${poleReach(g)} tiles of it.`, ['{pip:power} no Pole']);
    return c(`${name}: no power. Its grid has no fuel: coal into the Boiler.`, ['{pip:power} no fuel']);
  }
  const nom = nominal(m, g);
  if (m.state === 'starved') {
    const item = m.why;
    const f = nom.ins.length ? feeders(g, m) : null;
    const makers = f ? f.from.filter((s) => nominal(s, g).outs.some((o) => o.item === item)) : [];
    if (f && !makers.length && !f.stores.length) {
      if (m.kind === 'furnace') return c(`${name}: no ore. {k:LMB} the ore beside it, or a Miner on it facing in.`, [`{pip:starved} ${ic(item)} none`]);
      const mk = item ? makerName(item) : null;
      return c(`${name}: nothing brings it ${ic(item)} ${lc(item)}. Belt a ${mk ?? 'feeder'} into it.`, [`{pip:starved} ${ic(item)} none`]);
    }
    const stopped = makers.find((s) => s.state !== 'work' && !s.paused && !seen.has(s.id));
    if (stopped) return workshopCause(g, stopped, seen);
    const have = makers.reduce((n, s) => n + (nominal(s, g).outs.find((o) => o.item === item)?.perMin ?? 0), 0);
    const want = nom.ins.find((i) => i.item === item)?.perMin ?? 0;
    const mk = makers[0] ? BUILD[makers[0].kind].name : item ? makerName(item) : null;
    if (have > 0 && want > have * 1.05) {
      const each = makers[0] ? nominal(makers[0], g).outs.find((o) => o.item === item)?.perMin ?? have : have;
      const more = Math.max(1, Math.ceil((want - have) / Math.max(0.01, each)));
      return c(`${name}: short of ${ic(item)} ${lc(item)}, ${pm(have)} of ${pm(want)} a minute. Add ${more} ${mk ?? 'feeder'}${more > 1 ? 's' : ''}.`, [`{pip:starved} ${ic(item)} ${pm(have)}/${pm(want)}`]);
    }
    return c(`${name}: starved of ${ic(item)} ${lc(item)}. Its feeders make enough: a belt between is slow or split.`, [`{pip:starved} ${ic(item)}`]);
  }
  // blocked
  if (m.why && m.why === m.byItem) return c(`${name}: choked on ${ic(m.why)} ${lc(m.why)}. A Slag Heap beside it, or {k:LMB} to shovel.`, [`{pip:blocked} ${ic(m.why)} no way out`]);
  const front = g.entAt(m.x + DX[m.rot], m.y + DY[m.rot]);
  if (!front) return c(`${name}: its front leads nowhere. Belt it to the Dock or the next machine.`, ['{pip:blocked} front']);
  const d = downstream(g, m);
  if (d && isMachine(d.kind) && d.state !== 'work' && !d.paused && !seen.has(d.id)) return workshopCause(g, d, seen);
  const out = nom.outs[0];
  if (d && isMachine(d.kind) && out) {
    const takes = nominal(d, g).ins.find((i) => i.item === out.item)?.perMin ?? 0;
    if (takes > 0 && takes < out.perMin * 0.95) {
      const more = Math.max(1, Math.ceil((out.perMin - takes) / takes));
      return c(`${name}: ${entName(g, d)} uses ${pm(takes)} of its ${pm(out.perMin)} ${lc(out.item)} a minute. Add ${more} ${BUILD[d.kind].name}${more > 1 ? 's' : ''}, or send the rest to the Dock.`, [`{pip:blocked} ${ic(out.item)} ${pm(takes)}/${pm(out.perMin)}`]);
    }
    if (takes <= 0) return c(`${name}: ${entName(g, d)} takes no ${ic(out.item)} ${lc(out.item)}. Turn the belt to where it is wanted.`, [`{pip:blocked} ${ic(out.item)}`]);
  }
  return c(`${name}: its ${ic(out?.item)} ${lc(out?.item)} backs up. A belt carries 120 a minute: a second belt, or fewer feeders.`, [`{pip:blocked} ${ic(out?.item)}`]);
}

function workshopCauses(g: Game, goal: Set<string> = new Set()): Ranked[] {
  const by = new Map<string, Ranked>();
  const add = (cause: Cause, cost: number, toGoal = 0) => {
    const q = by.get(cause.key);
    if (q) { q.cost += cost; q.goal += toGoal; }
    else by.set(cause.key, { cause, cost, goal: toGoal });
  };
  for (const m of [...g.miners, ...g.machines]) {
    if (m.paused || (m.state !== 'starved' && m.state !== 'blocked')) continue;
    if (m.state === 'starved' && !m.why && !m.recipe) continue; // idle, no recipe yet
    const cost = valuePerMin(m) * lostShare(m);
    const out = nominal(m).outs[0]?.item;
    add(workshopCause(g, m, new Set()), cost, out && goal.has(out) ? cost : 0);
  }
  // a brownout: every machine on the grid slowed (DESIGN.md §18 Power)
  g.grids.forEach((gr, i) => {
    if (!(gr.demand > 0 && gr.sat > 0 && gr.sat < 0.999)) return;
    const slowed = gr.consumers.filter((m) => m.state === 'work').reduce((n, m) => n + valuePerMin(m), 0) * (1 - gr.sat);
    const at = gr.producers[0] ?? gr.poles[0];
    if (!at) return;
    const cap = capacity(g, gr);
    add({ key: 'grid' + i, floor: 'workshop', kind: 'ent', id: at.id, x: at.x + at.w / 2, y: at.y + at.h / 2, name: entName(g, at),
      say: `A brownout: ${Math.round(cap)} kW for ${Math.round(gr.demand)} kW wanted. Every machine on it runs at ${Math.round(gr.sat * 100)}%. An engine more, or more fuel.`,
      chips: [`{pip:power} ${Math.round(gr.sat * 100)}%`] }, slowed,
      gr.consumers.some((m) => m.state === 'work' && goal.has(nominal(m).outs[0]?.item ?? '')) ? slowed : 0);
  });
  void powered;
  return [...by.values()];
}

// ------------------------------------------------------------------ the Factory floor

function moduleWorth(g: Game, m: FEnt): number {
  const d = g.design(m.design);
  if (!d) return 0;
  return (Object.entries(d.outs) as [ItemId, number][]).reduce((n, [k, v]) => n + (v ?? 0) * 60 * worth(k), 0);
}

function factoryCause(g: Game, m: FEnt, seen: Set<number>): Cause {
  seen.add(m.id);
  const name = fname(g, m);
  const c = (say: string, chips: string[] = []): Cause => ({ key: 'f' + m.id, floor: 'factory', kind: 'module', id: m.id, x: m.x + 0.5, y: m.y + 0.5, name, say, chips });
  const d = g.design(m.design);
  if (m.state === 'starved') {
    const item = m.why;
    const ins = g.routes.filter((q) => q.to === m && !q.by);
    if (!ins.length) return c(`${name}: nothing trunks ${ic(item)} ${lc(item)} into its back. A trunk from a module that makes it.`, [`{pip:starved} ${ic(item)} none`]);
    const src = ins.map((q) => q.from).find((f) => f.state !== 'work' && !f.paused && !seen.has(f.id));
    if (src) return factoryCause(g, src, seen);
    const have = ins.reduce((n, q) => n + (g.design(q.from.design)?.outs[item as ItemId] ?? 0) * 60, 0);
    const want = (d?.ins[item as ItemId] ?? 0) * 60;
    if (have > 0 && want > have * 1.05) return c(`${name}: ${pm(have)} of the ${pm(want)} ${lc(item)} a minute it wants arrive. Stamp another source.`, [`{pip:starved} ${ic(item)} ${pm(have)}/${pm(want)}`]);
    return c(`${name}: starved of ${ic(item)} ${lc(item)}. Its trunk carries ${FACTORY.trunkSpeed * 60} a minute at most.`, [`{pip:starved} ${ic(item)}`]);
  }
  const item = m.why as ItemId | null;
  const r = g.routes.find((q) => q.from === m && !q.by);
  const to = r?.to ?? null;
  if (!to) return c(`${name}: its front leads nowhere. Trunk it to the Factory Dock or a module.`, ['{pip:blocked} front']);
  if (to.kind === 'module') {
    if (to.state !== 'work' && !to.paused && !seen.has(to.id)) return factoryCause(g, to, seen);
    const takes = (g.design(to.design)?.ins[item as ItemId] ?? 0) * 60;
    const offered = (d?.outs[item as ItemId] ?? 0) * 60;
    if (takes <= 0) return c(`${name}: ${fname(g, to)} takes no ${ic(item)} ${lc(item)}. Turn the trunk.`, [`{pip:blocked} ${ic(item)}`]);
    return c(`${name}: ${fname(g, to)} takes ${pm(takes)} of its ${pm(offered)} ${lc(item)} a minute. Another taker, or the rest to the Dock.`, [`{pip:blocked} ${ic(item)} ${pm(takes)}/${pm(offered)}`]);
  }
  if (to.kind === 'fbay') return c(`${name}: the Megaproject Bay takes no ${ic(item)} ${lc(item)} now. Trunk it to the Factory Dock.`, [`{pip:blocked} ${ic(item)} Bay`]);
  if (to.kind === 'fchute') return c(`${name}: the Factory Chute is full of ${ic(item)} ${lc(item)}. A Chute Mouth set to it empties it.`, ['{pip:blocked} Chute']);
  return c(`${name}: its ${ic(item)} ${lc(item)} backs up. A trunk carries ${FACTORY.trunkSpeed * 60} a minute: give it its own.`, [`{pip:blocked} ${ic(item)}`]);
}

function factoryCauses(g: Game, goal: Set<string> = new Set()): Ranked[] {
  const by = new Map<string, Ranked>();
  for (const m of g.s.factory.ents) {
    if (m.kind !== 'module' || m.paused || (m.state !== 'starved' && m.state !== 'blocked')) continue;
    const cause = factoryCause(g, m, new Set());
    const cost = moduleWorth(g, m) * Math.max(0.25, 1 - m.fAvg);
    const toGoal = Object.keys(g.design(m.design)?.outs ?? {}).some((k) => goal.has(k)) ? cost : 0;
    const q = by.get(cause.key);
    if (q) { q.cost += cost; q.goal += toGoal; }
    else by.set(cause.key, { cause, cost, goal: toGoal });
  }
  return [...by.values()];
}

// ------------------------------------------------------------------ the District (and the World, DESIGN.md §22)

/** the high floor being traced */
let HF: 'district' | 'world' | 'beyond' = 'district'; // the UI's high floors

function routeCause(g: Game, r: SkiffRoute): Cause | null {
  const a = hent(g, HF, r.from), b = hent(g, HF, r.to);
  if (!a || !b) return null;
  const cap = routeCap(g, HF, r), want = routeWant(g, HF, r);
  const each = skiffRateNow(g, HF, routeDist(a, b));
  const more = Math.max(1, Math.ceil((want - cap) / Math.max(1e-6, each)));
  const w = HF === 'beyond' ? 'courier' : HF === 'world' ? 'barge' : 'skiff';
  // per minute, as every rate the player sees (the playability pass), and what the skiffs cost now
  // (each one flying makes the next dearer: DESIGN.md §21 "Skiffs and coin")
  return {
    key: 'r' + r.id, floor: HF, kind: 'route', id: r.id, x: (a.x + a.w / 2 + b.x + b.w / 2) / 2, y: (a.y + a.h / 2 + b.y + b.h / 2) / 2,
    name: `${hname(g, a)} to ${hname(g, b)}`,
    say: `The route from ${hname(g, a)} carries ${perMin(cap)} of ${perMin(want)} ${lc(r.item)} a minute. ${more} ${w}${more > 1 ? 's' : ''} more, or move them closer.`,
    chips: [`{pip:starved} ${ic(r.item)} ${Math.round((cap / Math.max(1e-6, want)) * 100)}%`, `+${more} {coin:${pm(skiffsPrice(g, HF, more))}}`],
  };
}

function districtCause(g: Game, m: FEnt, seen: Set<number>): Cause {
  seen.add(m.id);
  const st = g.s[HF]!;
  const name = hname(g, m);
  const c = (say: string, chips: string[] = []): Cause => ({ key: 'd' + m.id, floor: HF, kind: 'module', id: m.id, x: m.x + m.w / 2, y: m.y + m.h / 2, name, say, chips });
  const item = m.why as ItemId | null;
  if (m.state === 'starved') {
    const ins = st.routes.filter((r) => r.to === m.id && r.item === item);
    if (!ins.length) return limitCause(g) ?? c(`${name}: no route brings it ${ic(item)} ${lc(item)}. Place a group that makes it (its routes fly on their own), or the Route tool.`, [`{pip:starved} ${ic(item)} none`]);
    const short = ins.find((r) => routeCap(g, HF, r) < 0.9 * routeWant(g, HF, r));
    if (short) return routeCause(g, short) ?? c('', []);
    const src = ins.map((r) => hent(g, HF, r.from)).find((f): f is FEnt => !!f && f.kind === 'module' && f.state !== 'work' && !seen.has(f.id));
    if (src) return districtCause(g, src, seen);
    return c(`${name}: starved of ${ic(item)} ${lc(item)}. Its sources make less than it wants: another group making it.`, [`{pip:starved} ${ic(item)}`]);
  }
  const outs = st.routes.filter((r) => r.from === m.id && (!item || r.item === item));
  if (!outs.length) return limitCause(g) ?? c(`${name}: nothing takes its ${ic(item)} ${lc(item)}. A route to the Dock or a group.`, [`{pip:blocked} ${ic(item)}`]);
  const short = outs.find((r) => routeCap(g, HF, r) < 0.9 * routeWant(g, HF, r));
  if (short) return routeCause(g, short) ?? c('', []);
  const dst = outs.map((r) => hent(g, HF, r.to)).find((f): f is FEnt => !!f && f.kind === 'module' && f.state !== 'work' && !seen.has(f.id));
  if (dst) return districtCause(g, dst, seen);
  // into the Dock, the Hopper or the Bay (they take all), not short: Overdrive's surplus draining
  // as it cools, nothing to fix (the review: "Stuck?" picked trivia)
  if (outs.every((r) => hent(g, HF, r.to)?.kind !== 'module')) return c('', []);
  return c(`${name}: its ${ic(item)} ${lc(item)} backs up. Another route out, or a group that uses it.`, [`{pip:blocked} ${ic(item)}`]);
}

/** The floor's route cap, when it is what keeps a group unrouted (DESIGN.md §21 "The floor's
 *  limit"): a lot adds 20, a fold packs a group's routes into one tile. */
function limitCause(g: Game): Cause | null {
  const st = g.s[HF]!;
  const max = maxRoutes(g, HF);
  if (st.routes.length < max) return null;
  const lot = lotPrice(g, HF);
  return {
    key: 'cap', floor: HF, kind: 'goal', id: -1, x: NaN, y: NaN, name: 'the route cap',
    say: `Every route this floor holds is flown (${st.routes.length}/${max}). ${lot ? `A lot adds ${RULES.routesPerLot.value} routes, ` : ''}${HF === 'beyond' ? 'or lift a group that sells least.' : 'or fold a group into one tile: its routes pack into its ports.'}`,
    chips: [`{warn:routes ${st.routes.length}/${max}}`, ...(lot ? [`a lot {coin:${lot.format()}}`] : [])],
  };
}

function districtCauses(g: Game, f: 'district' | 'world' | 'beyond'): { cause: Cause; cost: number }[] {
  HF = f;
  const st = g.s[HF];
  if (!st) return [];
  const by = new Map<string, { cause: Cause; cost: number }>();
  const add = (cause: Cause | null, cost: number) => {
    if (!cause || !cause.say) return;
    const q = by.get(cause.key);
    if (q) q.cost += cost;
    else by.set(cause.key, { cause, cost });
  };
  for (const r of st.routes) {
    const cap = routeCap(g, HF, r), want = routeWant(g, HF, r);
    if (r.skiffs > 0 && cap < 0.9 * want) add(routeCause(g, r), (want - cap) * 60 * worth(r.item));
  }
  for (const m of st.ents) {
    if (m.kind !== 'module' || m.paused || (m.state !== 'starved' && m.state !== 'blocked')) continue;
    // a waste with nowhere to go blocks nothing up here (the chute takes it): never a cause
    if (m.state === 'blocked' && m.why && BYPRODUCTS.has(m.why as ItemId)) continue;
    add(districtCause(g, m, new Set()), moduleWorth(g, m) * Math.max(0.25, 1 - m.fAvg));
  }
  // under 1% of the income a minute is trivia on a floor this big (the review: "Press 6 starved,
  // 620/min lost" at 15 h, 0.1% of income)
  const floor = g.incomePerMin() * 0.01;
  return [...by.values()].filter((q) => q.cost >= floor);
}

// ------------------------------------------------------------------ the answer

/** A cause, the coin a minute it costs, and how much of that is output the current goal wants. */
interface Ranked { cause: Cause; cost: number; goal: number }

/** The items the current goal names (its line and its chips: a research node's, an order's or a
 * Megaproject's wants), and the items one recipe before them. */
export function goalItems(g: Game, floor: Floor): Set<string> {
  const goal = nextGoal(g, floor);
  const out = new Set<string>();
  if (!goal) return out;
  for (const m of [goal.text, ...(goal.chips ?? [])].join(' ').matchAll(/\{i:([A-Za-z0-9]+)\}/g)) if (m[1] in ITEMS) out.add(m[1]);
  for (let depth = 0; depth < 1; depth++)
    for (const it of [...out]) for (const r of RECIPES) if (r.outputs.some((o) => o.item === it)) for (const i of r.inputs) out.add(i.item);
  return out;
}

/** Every bottleneck on a floor worth naming: the ones holding up the current goal first (by how
 * much of the goal's output they stop), then by the coin a minute they cost (the playability pass:
 * at 15 h the answer was "Press 6 starved, 620/min lost", 0.1% of income). On the Workshop and the
 * Factory a cause under 1% of income is left out (with no income yet, none is). */
export function rankStuck(g: Game, floor: Floor): Stuck[] {
  const high = floor === 'district' || floor === 'world' || floor === 'beyond';
  const want = high ? new Set<string>() : goalItems(g, floor);
  const all: Ranked[] = floor === 'factory' ? factoryCauses(g, want) : high ? districtCauses(g, floor).map((q) => ({ ...q, goal: 0 })) : workshopCauses(g, want);
  const cut = high ? 0 : 0.01 * g.incomePerMin();
  const kept = all.filter((q) => q.cost > 0 && q.cost >= cut);
  kept.sort((a, b) => b.goal - a.goal || b.cost - a.cost || a.cause.key.localeCompare(b.cause.key));
  return kept.map((q) => {
    const { key: _k, ...c } = q.cause;
    return { ...c, cost: q.cost, chips: [...c.chips, `{coin:${pm(q.cost)}}/min lost`, ...(q.goal > 0 ? ['{warn:holds up the goal}'] : [])] };
  });
}

/** rankStuck, asked at most once a game second (the trouble bell asks every frame). */
export function stuckList(g: Game, floor: Floor): Stuck[] {
  const at = `${Math.floor(g.s.tick / 20)}|${g.version}|${g.fversion}|${g.hversion}`;
  const c = cache.get(floor);
  if (c && c.g === g && c.at === at) return c.v;
  const v = rankStuck(g, floor);
  cache.set(floor, { g, at, v });
  return v;
}
const cache = new Map<string, { g: Game; at: string; v: Stuck[] }>();

/** The bottleneck on a floor that holds the goal up most (else costs the most output), or what
 * the next goal needs. */
export function findStuck(g: Game, floor: Floor): Stuck {
  const top = rankStuck(g, floor)[0];
  if (top) return top;
  const goal = nextGoal(g);
  return {
    floor, kind: 'goal', id: -1, x: goal?.tile ? goal.tile.x + 0.5 : NaN, y: goal?.tile ? goal.tile.y + 0.5 : NaN, name: 'the next goal', cost: 0,
    say: `Nothing stuck on this floor. Next: ${goal ? goal.text : 'build, balance, keep it humming.'}`,
    chips: goal?.chips?.slice(0, 2) ?? [],
  };
}

/** Ask, and answer on screen: pan to it, pin its report, the Inspector says what to do. `n` picks
 * the nth cause (the trouble bell steps through them, the one holding up the goal first). */
export function whereStuck(app: App, n = 0) {
  const list = stuckList(app.game, app.floor);
  const s = list.length ? list[n % list.length] : findStuck(app.game, app.floor);
  app.audio.sfx('open');
  if (s.kind === 'ent') { app.selected = s.id; app.lookAt(s.x, s.y); }
  else if (s.kind === 'module' && s.floor === 'factory') { app.fselected = s.id; app.lookAt(s.x, s.y); }
  else if (s.kind === 'module') { DS.game = app.game; DS.floor = app.high ?? 'district'; DS.sel = s.id; DS.route = null; app.lookAt(s.x, s.y); }
  else if (s.kind === 'route') { DS.game = app.game; DS.floor = app.high ?? 'district'; DS.route = s.id; DS.sel = null; app.lookAt(s.x, s.y); }
  else if (Number.isFinite(s.x) && app.floor === 'workshop') app.lookAt(s.x, s.y);
  const hs = app.hud;
  // the answer takes the speaker's corner now (the cameo queue's head), then the goal comes back
  hs.cameos = [{ who: 'inspector', text: s.say, at: app.ui.time, life: 9, chips: s.chips }, ...hs.cameos.filter((c) => c.who !== 'inspector')];
  hs.collapsed.delete('goal');
  last = s;
  return s;
}

/** The last answer (e2e and the debug handle). */
export let last: Stuck | null = null;

// The "Stuck?" button that stood beside the bell is gone (the playability pass): the trouble bell
// is the one place for trouble (topbar.ts bell: a click steps through rankStuck's causes, G asks
// for the first).
