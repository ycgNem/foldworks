// The District's tools and panels (DESIGN.md §21, docs/endgame.md Milestone 7), in the 180's ink on
// paper (docs/hud-180.md). Every core action is a labelled button (the owner): a tool strip hangs
// at the top centre with Route, Remove and Fold, the route count against the cap, and the groups in
// hand (depth-2 designs and the District's own depth-3 folds with spare copies, each a slot that
// puts one in your hand); the next lot's Buy button stands on the lot
// itself at the floor's east edge. The Route tool: click a source module, then where it goes; when
// the source makes several things the destination takes, a small labelled list picks the item. A
// route (its line, or a module's route list) opens its card: `3 skiffs · 1.4/s of 2.1 wanted ·
// 6.2 tiles`, + skiff and - skiff with the price, Remove route. Hover tags and the pinned report
// for modules (status and its cause: which route is short, which item has nowhere to go), the
// Dock, the Hopper and the Bay, and a route's readout (pillar 3). The District fold: the drag box,
// the Inspector's clipboard on the audited box, and the grade card (fold.ts drawGrade). Reads the
// App and the Game; changes the game only through App.act.
//
// Act IV (DESIGN.md §22): the World floor is the same UI over `g.s.world`: barges instead of
// skiffs, depth-3 modules (the District's folds) on its strip, its own Dock, Hopper, lots and Bay
// (the Lighthouse and the Sky Anchor). Both floors' pinned reports carry a labelled Stop / Start for
// the module and its route group.
//
// Act V (DESIGN.md §23): Beyond is the same UI again over `g.s.beyond` (couriers, depth-4 modules,
// nothing folds there). The World gains two keys once The Last Fold is researched: Last Fold (the
// whole-World audit, its progress over the whole floor, then the card: src/app/lastfold.ts) and,
// once Beyond stands, Fold (a World group up to depth 4).
import { C } from '../data/palette';
import { HIGH, type HighFloorId } from '../data/floors';
import { ITEMS, itemName, type ItemId } from '../data/items';
import { RESEARCH } from '../data/research';
import { RULES, SCORE_WEIGHTS } from '../data/rules';
import { MEGAS } from '../data/megaprojects';
import { Num } from '../engine/num';
import { TICK_RATE } from '../engine/time';
import { prules } from '../sim/patents';
import type { Game } from '../sim/Game';
import type { FEnt, SkiffRoute } from '../sim/world';
import { highW, hent, hentAt, hname, routeDist, routeCap, routeWant, routeRefusal, lotPrice, megaStageOf, gradeHAudit, skiffRateNow, maxRoutes, drillFactor, projectOpen } from '../sim/systems/high';
import { hpauseTargets } from '../sim/systems/pause';
import { WORLDS } from '../data/worlds';
import { worldOf } from '../sim/systems/islands';
import { BYPRODUCTS, defaultName, mainItem } from '../sim/systems/modules';
import { bigWidth, smallWidth, LINE_H, BIG_LINE_H, ICON } from '../ui/font';
import { layoutRich, drawLayout, richWidth, drawRich, CHIP_H, type RichLayout } from '../ui/rich';
import { T, roleInk, type Role } from '../ui/theme';
import { previewKernels, lastFoldAuditRefusal } from '../sim/lastfold';
import { KERNEL_GRADE } from '../data/kernels';
import { sheet, itemIcon, hasArt } from '../render/sprites';
import { mainOutput } from '../render/factory';
import { routeAtWorld, routeEnds, routeShort, routeItems, districtMegaFrac, hart, carrier } from '../render/district';
import { liftWingW } from './topbar';
import { button, tag, tagSize, rule, meter, chip, chipWidth, clipboard, twine, uiIcon, dot, type UIconName } from './chrome';
import { bigSafe, worldRect, place, zones } from './tags';
import { drawGrade } from './fold';
import type { Layout } from './layout';
import type { App } from './app';
import type { Rect, TipLine } from '../ui/ui';

/** The high floor on screen: the District, the World or Beyond (one UI for all three, DESIGN.md
 *  §22-23). Set by every entry point from the app's floor (`at`). */
let ID: HighFloorId = 'district';
/** The high floor the app shows, or null on the Workshop and the Factory. */
export const highOf = (app: App): HighFloorId | null => (app.floor === 'district' || app.floor === 'world' || app.floor === 'beyond' ? app.floor : null);
function at(app: App) { ID = highOf(app) ?? 'district'; }
/** what flies the routes here, in words: skiffs on the District, barges on the World, couriers
 *  Beyond */
const word = () => carrier(ID);
const Word = () => (ID === 'beyond' ? 'Courier' : ID === 'world' ? 'Barge' : 'Skiff');
const words = (n: number) => `${n} ${word()}${n === 1 ? '' : 's'}`;

/** The high floors' UI state: the Route tool's source and its item list, the pinned thing, the
 *  route whose card is open, the route under the mouse, the tool strip's page of groups, and the
 *  floor they belong to (ids are per floor). */
export const DS = {
  from: null as { x: number; y: number } | null,
  pick: null as { fx: number; fy: number; tx: number; ty: number; items: ItemId[] } | null,
  sel: null as number | null,
  route: null as number | null,
  hoverRoute: null as number | null,
  page: 0,
  game: null as Game | null,
  floor: 'district' as HighFloorId,
};

/** Forget what belongs to another game, another floor, or has gone from the floor. */
function sync(app: App) {
  const g = app.game;
  at(app);
  if (DS.game !== g || DS.floor !== ID) { DS.from = null; DS.pick = null; DS.sel = null; DS.route = null; DS.hoverRoute = null; DS.page = 0; DS.game = g; DS.floor = ID; }
  const st = g.s[ID];
  if (!st) { DS.sel = null; DS.route = null; return; }
  if (DS.sel !== null && !hent(g, ID, DS.sel)) DS.sel = null;
  if (DS.route !== null && !st.routes.some((r) => r.id === DS.route)) DS.route = null;
  if (DS.hoverRoute !== null && !st.routes.some((r) => r.id === DS.hoverRoute)) DS.hoverRoute = null;
}

/** Esc and the right tap on the District: the item list, then the Route tool's source, then the
 *  route card, then the pinned report. Returns true when it let something go. */
export function districtCancel(): boolean {
  if (DS.pick) { DS.pick = null; return true; }
  if (DS.from) { DS.from = null; return true; }
  if (DS.route !== null) { DS.route = null; return true; }
  if (DS.sel !== null) { DS.sel = null; return true; }
  return false;
}

// ------------------------------------------------------------------ numbers

/** Items a second, as few figures as read well. */
export function rate(n: number): string {
  if (n >= 100) return n.toFixed(0);
  if (n >= 10) return n.toFixed(1).replace(/\.0$/, '');
  if (n >= 1) return n.toFixed(1);
  // tier 5 flows up on Beyond run at 0.002-0.05 a second: three places, so they never read 0.00
  return n <= 0 ? '0' : n >= 0.01 ? n.toFixed(2) : n.toFixed(3);
}
const MINUS = '-'; // the bitmap font has no U+2212 minus sign
const coinK = (n: number) => Num.of(n).format();
const skiffCost = () => HIGH[ID].skiffCost;
const gradeRole = (l: string): Role => (l === 'S+' || l === 'S' ? 'coin' : l === 'A' ? 'good' : l === 'B' ? 'research' : l === 'C' ? 'warn' : 'bad');
const meterRole = (v: number): Role => (v >= 0.9 ? 'good' : v >= 0.6 ? 'warn' : 'bad');
const icon = (id: string | null | undefined) => (id && id in ITEMS ? `{i:${id}}` : '');

/** The readout every route carries (DESIGN.md §21): `3 skiffs · 1.4/s of 2.1 wanted · 6.2 tiles`. */
export function routeReadout(g: Game, r: SkiffRoute): string {
  const e = routeEnds(g, r, ID);
  const dist = e ? routeDist(e.a, e.b) : 0;
  return `${words(r.skiffs)} · ${rate(r.flow)}/s of ${rate(routeWant(g, ID, r))} wanted · ${dist.toFixed(1)} tiles`;
}

/** A thing's short name on the District. */
function nameOf(g: Game, e: FEnt): string {
  return hname(g, e);
}

/** Skiffs a route needs to carry all it is wanted. */
function skiffsNeeded(g: Game, r: SkiffRoute): number {
  const e = routeEnds(g, r, ID);
  if (!e) return r.skiffs;
  const per = skiffRateNow(g, ID, routeDist(e.a, e.b));
  const want = routeWant(g, ID, r);
  return per > 0 ? Math.max(1, Math.ceil((want - 1e-9) / per)) : r.skiffs;
}

// ------------------------------------------------------------------ reports

interface DRep {
  title: string;
  item?: string | null;
  uicon?: UIconName;
  /** the rows a hover shows (all of them when pinned) */
  rows: string[];
  /** rows only the pinned report shows */
  more: string[];
  verbs?: string;
  /** a module's routes, buttons in the pinned report (each opens its card) */
  routes?: SkiffRoute[];
  /** a module: the pinned report's Stop / Start keys (the pause command, DESIGN.md §22) */
  pause?: FEnt;
}

/** A row only the pinned report shows (the brief hover keeps to the cause), and one only a hover
 *  shows (the short cause the pinned report's numbers replace). */
const PIN = '\u0001';
const HOVER = '\u0002';

/** What a module needs of one input against what its routes bring (DESIGN.md §21), and why it falls
 *  short: no route brings it, a route short of skiffs (the one whose skiffs carry least of what its
 *  source can spare), the feeders making too little at full speed, or a feeder not running. */
interface Supply {
  need: number;
  gets: number;
  why: 'none' | 'skiffs' | 'makes' | 'feeder' | 'ok';
  /** the route to add a skiff to ('skiffs'), the feeder to place another of ('makes') or the one
   *  not running ('feeder') */
  route?: SkiffRoute;
  src?: FEnt;
  /** what the feeders make of it a second at full speed (their share of it, for 'makes') */
  makes: number;
  /** a feeder's output is split with other routes */
  shared?: boolean;
}

function supplyOf(g: Game, e: FEnt, item: ItemId): Supply {
  const st = g.s[ID]!;
  const drill = drillFactor(g);
  const need = (g.design(e.design)?.ins[item] ?? 0) * drill;
  const ins = st.routes.filter((r) => r.to === e.id && r.item === item);
  const gets = ins.reduce((s, r) => s + r.flow, 0);
  if (!ins.length) return { need, gets, why: 'none', makes: 0 };
  // each route's share of its source (routes from one output share it in turn) and what its
  // skiffs can carry of it
  const legs = ins.map((r) => {
    const src = hent(g, ID, r.from);
    const make = (src ? g.design(src.design)?.outs[item] ?? 0 : 0) * drill;
    const split = st.routes.filter((q) => q.from === r.from && q.item === item).length || 1;
    return { r, src, make, share: make / split, cap: routeCap(g, ID, r) };
  });
  const srcs = new Map<number, number>();
  for (const l of legs) srcs.set(l.r.from, l.make);
  const makes = [...srcs.values()].reduce((s, v) => s + v, 0);
  const can = legs.reduce((s, l) => s + Math.min(l.share, l.cap), 0);
  // the skiffs bind: the route whose skiffs leave most of its share behind
  const tight = legs.filter((l) => l.cap < l.share * 0.9).sort((a, b) => (b.share - b.cap) - (a.share - a.cap))[0];
  if (can < need * 0.9 && tight) return { need, gets, why: 'skiffs', route: tight.r, src: tight.src ?? undefined, makes };
  // the feeders bind: what they make (their share of it) is under the need
  if (can < need * 0.9) {
    const top = legs.sort((a, b) => b.make - a.make)[0];
    return { need, gets, why: 'makes', src: top.src ?? undefined, makes: legs.reduce((s, l) => s + l.share, 0), shared: legs.some((l) => l.share < l.make - 1e-9) };
  }
  const idle = legs.find((l) => l.src && l.src.state !== 'work');
  if (idle) return { need, gets, why: 'feeder', src: idle.src!, makes };
  return { need, gets, why: 'ok', makes };
}

/** Why a module is starved of `item`, as one short row (the brief hover's cause). */
function starvedCause(g: Game, e: FEnt, item: ItemId): string {
  const s = supplyOf(g, e, item);
  if (s.why === 'none') return `{bad:no route brings} ${icon(item)}`;
  if (s.why === 'skiffs') return `{warn:short of ${word()}s} · the ${s.src ? nameOf(g, s.src) : '?'} route`;
  if (s.why === 'makes') return `{warn:its feeders make too little} ${icon(item)}`;
  if (s.why === 'feeder') return `its feeder is {warn:${s.src!.state}}`;
  return `${icon(item)} {soft:by ${word()}} ${rate(s.gets)}/s`;
}

/** The pinned report's numbers for every input a module is short of (or the one it starves on):
 *  `needs 0.10/s · gets 0.08`, then what to do about it. */
function starvedRows(g: Game, e: FEnt): string[] {
  const d = g.design(e.design);
  if (!d) return [];
  const out: string[] = [];
  for (const item of Object.keys(d.ins) as ItemId[]) {
    const s = supplyOf(g, e, item);
    // an input short of its need with its buffer run down (one stocked up is waiting on another
    // input, not the cause: its feeder backs up behind it)
    if (item !== e.why && (s.gets >= s.need * 0.9 || (e.inBuf[item] ?? 0) >= s.need)) continue;
    out.push(`${PIN}${icon(item)} needs ${rate(s.need)}/s · gets ${s.gets < s.need * 0.9 ? `{warn:${rate(s.gets)}}` : rate(s.gets)}`);
    const name = s.src ? nameOf(g, s.src) : '?';
    if (s.why === 'none') out.push(`${PIN}{bad:no route brings it} · the Route tool`);
    else if (s.why === 'skiffs') out.push(`${PIN}add a ${word()} to the ${name} route {soft:(${rate(routeCap(g, ID, s.route!))}/s now)}`);
    else if (s.why === 'makes') out.push(`${PIN}its feeders ${s.shared ? 'spare it' : 'make'} ${rate(s.makes)}: place another ${name}`);
    else if (s.why === 'feeder') out.push(`${PIN}its feeder ${name} is {warn:${s.src!.state}}`);
  }
  return out;
}

/** Why a module's `item` backs up, as a row. */
function blockedCause(g: Game, e: FEnt, item: string): string {
  const st = g.s[ID]!;
  const outs = st.routes.filter((r) => r.from === e.id && r.item === item);
  if (!outs.length) return BYPRODUCTS.has(item) ? `{bad:no route takes} ${icon(item)} · waste blocks it` : `{bad:no route takes} ${icon(item)}`;
  if (outs.some((r) => routeShort(g, r, ID))) {
    const cap = outs.reduce((s, r) => s + routeCap(g, ID, r), 0);
    const made = (g.design(e.design)?.outs[item as ItemId] ?? 0) * drillFactor(g);
    return `{warn:short of ${word()}s} ${rate(cap)}/s of ${rate(made)}/s made`;
  }
  const to = hent(g, ID, outs[0].to);
  return to ? `→ ${nameOf(g, to)} {warn:takes no more}` : '{warn:its route lands nowhere}';
}

/** The report for a thing on the District. */
function entRep(app: App, e: FEnt): DRep {
  const g = app.game;
  const st = g.s[ID]!;
  const rows: string[] = [];
  const more: string[] = [];
  const inflow = (to: FEnt) => st.routes.filter((r) => r.to === to.id).sort((a, b) => b.flow - a.flow);
  if (e.kind === 'fdock') {
    const ins = inflow(e);
    rows.push(`{coin} buys what the ${word()}s bring`);
    if (ins.length) rows.push(ins.slice(0, 4).map((r) => `${icon(r.item)} ${rate(r.flow)}/s`).join('  '));
    else rows.push('{soft:no route lands here yet}');
    const o = g.s.orders.active;
    if (o) more.push('fills the active order first');
    return { title: `${HIGH[ID].name} Dock`, uicon: 'orders', rows, more, verbs: '{k:LMB} orders' };
  }
  if (e.kind === 'fhopper') {
    const sel = g.s.research.selected;
    rows.push(sel ? `{u:research} counts toward ${RESEARCH[sel].name}` : '{u:research} {warn:pick research}');
    const ins = inflow(e);
    if (ins.length) rows.push(ins.slice(0, 4).map((r) => `${icon(r.item)} ${rate(r.flow)}/s`).join('  '));
    return { title: `${HIGH[ID].name} Hopper`, uicon: 'research', rows, more, verbs: '{k:LMB} inspire' };
  }
  if (e.kind === 'fbay') {
    const mf = districtMegaFrac(g, ID);
    if (!mf) {
      // the World's projects build one stage on each island (DESIGN.md §22): none may be here
      const here = worldOf(g);
      const worldProjects = (['lighthouse', 'anchor'] as const).filter((m) => projectOpen(g, m));
      if (ID === 'world' && worldProjects.length && worldProjects.some((m) => (g.s.megas?.[m]?.done?.length ?? 0) < MEGAS[m].stages.length)) {
        rows.push(`{soft:no stage is built on} ${WORLDS[here].name}`);
        rows.push('{u:relocate} each stage on its own island');
        more.push('{u:mega} the Megaproject page lists them');
      } else rows.push('{good:every project here stands}');
      return { title: 'Megaproject Bay', uicon: 'mega', rows, more };
    }
    const m = MEGAS[mf.id];
    const stg = megaStageOf(g, mf.id)!;
    rows.push(`${m.name}, stage ${stg.stage} {research:${Math.floor(mf.frac * 100)}%}`);
    const p = g.s.megas?.[mf.id]?.progress ?? {};
    for (const [k, n] of Object.entries(stg.wants) as [ItemId, number][]) rows.push(`${icon(k)} ${Num.of(Math.min(n, p[k]?.toNumber() ?? 0)).format()} / ${Num.of(n).format()}`);
    more.push(`{soft:reward} ${stg.reward}`);
    return { title: 'Megaproject Bay', uicon: 'mega', rows, more };
  }
  const d = g.design(e.design);
  if (!d) return { title: 'Module', rows, more };
  rows.push(`{chip:${gradeRole(d.grade.letter)}:${d.grade.letter}} rates ×${d.grade.mult.toFixed(2)} · {research:depth ${d.depth ?? 2}}`);
  const p = Math.round(e.fAvg * 100);
  if (e.paused) rows.push('{chip:soft:STOPPED} by you · makes nothing');
  else if (e.state === 'work') rows.push(`{chip:good:WORKING} ${p}% of full speed`);
  else if (e.state === 'starved') {
    rows.push(`{chip:warn:STARVED} ${icon(e.why)} · ${p}%`);
    if (e.why && e.why in ITEMS) rows.push(HOVER + starvedCause(g, e, e.why as ItemId));
    rows.push(...starvedRows(g, e));
  }
  else if (e.state === 'blocked') { rows.push(`{chip:bad:BLOCKED} ${icon(e.why)} backs up`); if (e.why) rows.push(blockedCause(g, e, e.why)); }
  else rows.push('{chip:soft:IDLE}');
  if (e.spill) rows.push(`{chip:warn:SPILLING} ${icon(e.spill)} no route takes it all`);
  const odOn = g.done('overdrive');
  const od = e.od ?? 0, cool = e.cool ?? 0;
  if (odOn && od > 0) rows.push(`{chip:warn:OVERDRIVE ${RULES.overdriveMult.value}x ${Math.ceil(od / TICK_RATE)}s} with its group`);
  else if (odOn && cool > 0) rows.push(`{chip:soft:COOLING ${Math.ceil(cool / TICK_RATE)}s}`);
  // at full speed now: the Great Drill's boost runs every module faster (as routeWant reads it)
  const drill = drillFactor(g);
  const outs = Object.entries(d.outs) as [ItemId, number][];
  rows.push(`out ${outs.map(([k, v]) => `${icon(k)} ${rate((v ?? 0) * drill)}/s`).join('  ')}`);
  const ins = Object.entries(d.ins) as [ItemId, number][];
  if (ins.length) more.push(`in ${ins.map(([k, v]) => `${icon(k)} ${rate((v ?? 0) * drill)}/s`).join('  ')}`);
  const mine = st.routes.filter((r) => r.from === e.id || r.to === e.id);
  if (!mine.length) more.push('{warn:no routes} · the Route tool joins it');
  const odReady = odOn && !od && !cool;
  return {
    title: d.name, item: mainItem(d), rows, more, routes: mine, pause: e,
    verbs: `{k:LMB} ${odReady ? `overdrive ${RULES.overdriveMult.value}x ${RULES.overdriveSeconds.value}s` : 'pin'}  {k:X} remove`,
  };
}

/** The report for a route under the mouse. */
function routeRep(app: App, r: SkiffRoute): DRep {
  const g = app.game;
  const e = routeEnds(g, r, ID);
  const rows = [`${e ? nameOf(g, e.a) : '?'} → ${e ? nameOf(g, e.b) : '?'}`, routeReadout(g, r)];
  if (routeShort(g, r, ID)) rows.push(`{warn:short of ${word()}s} · ${skiffsNeeded(g, r) - r.skiffs} more carry it all`);
  return { title: `${Word()} route`, item: r.item, rows, more: [], verbs: '{k:LMB} its card' };
}

interface Laid { rep: DRep; cw: number; w: number; h: number; rows: { lay: RichLayout; h: number; chip: boolean }[]; routesH: number; verbs: RichLayout | null; brief: boolean }

const ROUTE_ROW = 14;
/** the pinned report's Stop / Start keys: a row this tall */
const PAUSE_ROW = 19;

function layRep(rep: DRep, full: boolean, maxCw: number, brief: boolean, close: boolean, maxH = Infinity): Laid {
  // the pinned report's own rows (marked PIN) stay out of every hover; a hover's short cause
  // (marked HOVER) gives way to them when pinned
  let rows = (full ? [...rep.rows, ...rep.more] : rep.rows).filter((s) => !s.startsWith(full ? HOVER : PIN)).map((s) => (s.startsWith(PIN) || s.startsWith(HOVER) ? s.slice(1) : s));
  if (brief) {
    // the brief hover: a cause (a chip, warn or bad ink) never goes; plain rows past five do
    const cause = (s: string) => /\{(chip:|bad:|warn:)/.test(s);
    let room = 5 - rows.filter(cause).length;
    rows = rows.filter((s) => cause(s) || room-- > 0);
  }
  const verbsS = brief ? rep.verbs?.split('  ').find((v) => v.startsWith('{k:LMB}')) : rep.verbs;
  const titleW = (brief ? richWidth(rep.title) : bigWidth(bigSafe(rep.title))) + (rep.item || rep.uicon ? 12 : 0) + (close ? 16 : 0);
  const natural = Math.max(...rows.map((s) => richWidth(s)), verbsS ? richWidth(verbsS) : 0, full && rep.routes?.length ? 150 : 0);
  const cw = Math.min(maxCw, Math.max(brief ? 64 : 120, titleW, natural));
  const titleH = brief ? LINE_H : BIG_LINE_H;
  let laid = rows.map((s) => { const L = layoutRich(s, cw); const c = s.includes('{chip:'); return { lay: L, h: Math.max(L.h, c ? CHIP_H : 0) + 1, chip: c }; });
  let routes = full ? rep.routes ?? [] : [];
  const verbs = verbsS ? layoutRich(verbsS, cw) : null;
  const pauseH = full && rep.pause ? PAUSE_ROW : 0;
  const measure = () => titleH + 3 + laid.reduce((s, r) => s + r.h, 0) + (routes.length ? 6 + routes.length * ROUTE_ROW : 0) + pauseH + (verbs ? verbs.h + 4 : 0);
  // too tall for its room: the route list shortens first, then rows go from the end
  while (tagSize(cw, measure(), 'left').h > maxH && routes.length > 2) routes = routes.slice(0, routes.length - 1);
  while (tagSize(cw, measure(), 'left').h > maxH && laid.length > 2) laid = laid.slice(0, laid.length - 1);
  const sz = tagSize(cw, measure(), 'left');
  return { rep: { ...rep, routes, pause: full ? rep.pause : undefined }, cw, w: sz.w, h: sz.h, rows: laid, routesH: routes.length ? 6 + routes.length * ROUTE_ROW : 0, verbs, brief };
}

/** The pinned report's Stop / Start keys (the pause command, DESIGN.md §22, as the Factory's): the
 *  module alone, and every module joined to it by routes. */
function pauseKeys(app: App, e: FEnt, x: number, y: number, w: number) {
  const ui = app.ui;
  const g = app.game;
  const group = hpauseTargets(g, ID, e, true);
  const groupStopped = group.some((q) => q.paused);
  const one = e.paused ? '{u:play} Start' : '{u:pause} Stop';
  const all = `${groupStopped ? '{u:play} Start' : '{u:pause} Stop'} all ${group.length}`;
  const w1 = group.length > 1 ? Math.floor((w - 4) / 2) : w;
  if (button(ui, 'dPause', x, y, w1, 15, one, { tip: e.paused ? [{ text: '{big:Start it}' }, { text: 'it takes and makes again' }] : [{ text: '{big:Stop it}' }, { text: 'takes nothing, makes nothing · its routes wait' }, { text: '{soft:offline and overnight too}' }] })) {
    app.act({ k: 'pause', floor: ID, x: e.x, y: e.y, on: !e.paused });
  }
  if (group.length > 1 && button(ui, 'dPauseGroup', x + w1 + 4, y, w - w1 - 4, 15, all, { tip: [{ text: `{big:${groupStopped ? 'Start' : 'Stop'} its group}` }, { text: `${group.length} modules joined by routes` }] })) {
    app.act({ k: 'pause', floor: ID, x: e.x, y: e.y, line: true, on: !groupStopped });
  }
}

function drawRep(app: App, L: Laid, x: number, y: number, o: { anchor?: { x: number; y: number } | null; pin?: boolean; close?: () => void; blocking?: boolean }) {
  const ui = app.ui;
  const g = app.game;
  const rep = L.rep;
  const r = tag(ui, x, y, L.w, L.h, { hole: 'left', anchor: o.pin ? null : o.anchor ?? null, pin: o.pin, blocking: o.blocking ?? !!o.pin });
  const titleH = L.brief ? LINE_H : BIG_LINE_H;
  if (L.brief) ui.text(rep.title, r.x, r.y, T.ink);
  else ui.big(bigSafe(rep.title), r.x + (o.pin ? 2 : 0), r.y, T.ink);
  const ix = r.x + r.w - 8 - (o.close ? 16 : 0);
  if (rep.item && rep.item in ITEMS) ui.ctx.drawImage(itemIcon(rep.item), ix, r.y + (L.brief ? 0 : 1));
  else if (rep.uicon) uiIcon(ui, rep.uicon, ix, r.y + (L.brief ? 0 : 1), 1);
  if (o.close && button(ui, 'dCloseReport', r.x + r.w - 12, r.y - 1, 12, 12, '{u:remove}', { tip: 'close {k:Esc}' })) o.close();
  rule(ui, r.x, r.y + titleH, r.w, !L.brief);
  let yy = r.y + titleH + 3;
  for (const row of L.rows) {
    drawLayout(ui, row.lay, r.x, yy + (row.chip ? 2 : 0), T.ink);
    yy += row.h;
  }
  if (rep.routes?.length) {
    rule(ui, r.x, yy + 2, L.cw);
    yy += 6;
    for (const q of rep.routes) {
      const e = routeEnds(g, q, ID);
      const out = e?.a.id === DS.sel;
      const other = e ? (out ? e.b : e.a) : null;
      const short = routeShort(g, q, ID);
      const s = `${out ? '→' : '←'} ${icon(q.item)} ${other ? nameOf(g, other) : '?'} ${short ? `{warn:${rate(q.flow)}/${rate(routeWant(g, ID, q))}}` : `${rate(q.flow)}/s`}`;
      if (button(ui, 'dRouteRow:' + q.id, r.x, yy, L.cw, ROUTE_ROW - 1, '', { active: DS.route === q.id, tip: [{ text: `{big:${Word()} route}` }, { text: routeReadout(g, q) }, { text: '{k:LMB} its card' }] })) { DS.route = q.id; }
      ui.clip(r.x + 2, yy, L.cw - 4, ROUTE_ROW);
      drawRich(ui, s, r.x + 3, yy + 2, Infinity, T.ink);
      ui.unclip();
      yy += ROUTE_ROW;
    }
  }
  if (rep.pause) {
    pauseKeys(app, rep.pause, r.x, yy + 2, L.cw);
    yy += PAUSE_ROW;
  }
  if (L.verbs) {
    rule(ui, r.x, yy, L.cw);
    drawLayout(ui, L.verbs, r.x, yy + 3, T.ink);
  }
  return r;
}

// ------------------------------------------------------------------ hover

/** What the mouse is over on the District, as a key (the hover tag waits on it not changing). */
export function districtHoverKey(app: App): string | null {
  const g = app.game;
  at(app);
  const h = app.hud.hoverTile;
  if (DS.hoverRoute !== null) return DS.hoverRoute === DS.route ? null : 'r' + DS.hoverRoute;
  if (!h) return null;
  const e = hentAt(g, ID, h.x, h.y);
  return e && e.id !== DS.sel ? 'd' + e.id : null;
}

/** The hover tag on the District: a thing's report or a route's readout, on a string from it. */
export function districtHover(app: App, o: { brief: boolean; alpha: number }) {
  const ui = app.ui;
  const g = app.game;
  let rep: DRep | null = null, near: Rect | null = null;
  at(app);
  if (DS.hoverRoute !== null) {
    const r = g.s[ID]?.routes.find((q) => q.id === DS.hoverRoute);
    if (r) {
      rep = routeRep(app, r);
      near = { x: ui.mx - 6, y: ui.my - 6, w: 12, h: 12 };
    }
  } else if (app.hud.hoverTile) {
    const e = hentAt(g, ID, app.hud.hoverTile.x, app.hud.hoverTile.y);
    if (e && e.id !== DS.sel) { rep = entRep(app, e); near = worldRect(app, e.x, e.y, e.w, e.h); }
  }
  if (!rep || !near) return;
  const L = layRep(rep, false, o.brief ? 200 : 232, o.brief, false);
  const p = place(app, { x: near.x - 6, y: near.y - 6, w: near.w + 12, h: near.h + 12 }, L.w, L.h);
  const anchor = { x: near.x + Math.floor(near.w / 2), y: near.y + Math.floor(near.h / 2) };
  ui.later(() => {
    ui.ctx.globalAlpha = o.alpha;
    drawRep(app, L, p.x, p.y, { anchor, blocking: false });
    ui.ctx.globalAlpha = 1;
  });
}

// ------------------------------------------------------------------ the HUD

/** The tool strip's rect (the floor's tags keep off it). */
function stripRect(app: App, L: Layout): Rect {
  // between the Purse and the lift's wings (topbar.ts liftWingW: the District's, the World's, Beyond's)
  const x0 = L.purse.x + L.purse.w + 10, x1 = L.lift.x - liftWingW(app) - 8;
  STRIP.level = stripLevel(app, x1 - x0);
  const w = Math.min(x1 - x0, stripNatural(app, STRIP.level));
  return { x: Math.round(x0 + (x1 - x0 - w) / 2), y: 4, w, h: 30 };
}

/** How tight the strip is this frame: 0 every word; 1 without the MODULES caption; 2 the route count
 *  as bare numbers too (Act V's World at 1024 has four labelled tools). The tools keep their labels. */
const STRIP = { level: 0 };
function stripLevel(app: App, room: number): number {
  for (let l = 0; l < 2; l++) if (stripNatural(app, l) <= room) return l;
  return 2;
}

/** The slip under the strip saying what the tool in hand does (the Route tool, a group). */
function hintOf(app: App, L: Layout): { s: string; r: Rect } | null {
  let s: string;
  if (app.mode.k === 'route') s = DS.from ? '{k:LMB} where it goes · {k:Esc} another source' : '{k:LMB} the module it starts at · {k:Esc} done';
  else if (app.mode.k === 'remove') s = `{bad:Remove} {k:LMB} a module or a route · ${word()}s refunded · {k:Esc} done`;
  else if (app.mode.k === 'hmodule') {
    const d = app.game.design(app.mode.design);
    s = `{good:in hand} ${d ? bigSafe(d.name) : ''} · {k:LMB} place  {k:Esc} drop`;
  } else return null;
  const R = stripRect(app, L);
  const w = richWidth(s) + 12;
  return { s, r: { x: Math.round(R.x + R.w / 2 - w / 2), y: R.y + R.h + 3, w, h: 14 } };
}

/** HUD rects on the District that the floor's tags keep off. */
export function districtZones(app: App, L: Layout): Rect[] {
  const f = highOf(app);
  if (!f || !app.game.s[f]) return [];
  at(app);
  const out = [stripRect(app, L)];
  const ls = lastSlipRect(app, L);
  if (ls) out.push(ls);
  const lot = lotRect(app, L);
  if (lot) out.push(lot);
  const h = hintOf(app, L);
  if (h) out.push(h.r);
  return out;
}

interface Tool { id: string; label: string; icon: UIconName; on: boolean; tip: TipLine[]; go: () => void; w: number }

function tools(app: App): Tool[] {
  const g = app.game;
  const mk = (id: string, label: string, ic: UIconName, on: boolean, tip: TipLine[], go: () => void): Tool => ({ id, label, icon: ic, on, tip, go, w: 26 + richWidth(label) });
  const out = [
    mk('dRoute', 'Route', 'flow', app.mode.k === 'route', [{ text: '{big:Route}' }, { text: '{k:LMB} a module, then where it goes' }, { text: `a ${word()} {coin:${coinK(skiffCost())}} · refunded when lifted` }], () => app.setMode(app.mode.k === 'route' ? { k: 'idle' } : { k: 'route' })),
    mk('dRemove', 'Remove', 'remove', app.mode.k === 'remove', [{ text: '{big:Remove}' }, { text: '{k:LMB} a module back to the inventory' }, { text: `its routes go with it · ${word()}s refunded` }], () => app.setMode(app.mode.k === 'remove' ? { k: 'idle' } : { k: 'remove' })),
  ];
  // the World folds a group up to Beyond once The Last Fold is researched and Beyond stands
  // (depth 4, DESIGN.md §23); nothing folds on Beyond
  if (ID === 'world' && g.done('lastFold') && g.s.beyond) out.push(mk('dFold', 'Fold', 'fold', app.mode.k === 'fold', [{ text: '{big:World fold}' }, { text: '{k:LMB} drag a box over a joined group' }, { text: `up to ${HIGH.world.foldMax}×${HIGH.world.foldMax} · depth 4 · for {u:beyond} Beyond · {k:F}` }], () => app.toggleFold()));
  // the Last Fold (Act V): audit the whole World, then its card
  if (ID === 'world' && g.done('lastFold')) {
    const ha = g.s.haudit;
    const why = ha?.last ? null : lastFoldAuditRefusal(g);
    const tip: TipLine[] = ha?.last
      ? [{ text: '{big:The Last Fold}' }, { text: ha.result ? `graded ${ha.result.grade.letter} · {k:LMB} its card` : 'the whole World is being audited' }]
      : [{ text: '{big:The Last Fold}' }, { text: 'audit every module on the World at once' }, { text: why ? `{bad:${why}}` : `{k:LMB} start · its card says what it banks, keeps and loses` }];
    out.push(mk('dLastFold', 'Last Fold', 'lastFold', app.panel === 'lastfold' || !!ha?.last, tip, () => {
      if (ha?.last) { if (ha.result) { app.panel = 'lastfold'; app.gradeAt = app.ui.time; app.hud.stamped = false; } return; }
      app.act({ k: 'lastFoldAudit' });
    }));
  }
  if (ID === 'district' && g.done('districtFolds' as never)) out.push(mk('dFold', 'Fold', 'fold', app.mode.k === 'fold', [{ text: '{big:District fold}' }, { text: '{k:LMB} drag a box over a joined group' }, { text: `up to ${Math.max(HIGH.district.foldMax, prules(g).highFoldMax)}×${Math.max(HIGH.district.foldMax, prules(g).highFoldMax)} · depth 3 · {k:F}` }], () => app.toggleFold()));
  return out;
}

/** Designs with spare copies the District takes: depth-2 groups and its own depth-3 folds (DESIGN.md
 *  §21), the groups first. */
function groups(app: App) {
  // the World takes depth 3 only: the District's folds (DESIGN.md §22); Beyond depth 4, the World's
  // folds (§23)
  if (ID === 'world') return app.game.s.designs.filter((d) => d.depth === 3 && d.spare > 0);
  if (ID === 'beyond') return app.game.s.designs.filter((d) => d.depth === 4 && d.spare > 0);
  const ds = app.game.s.designs.filter((d) => (d.depth === 2 || d.depth === 3) && d.spare > 0);
  return [...ds.filter((d) => d.depth === 2), ...ds.filter((d) => d.depth === 3)];
}

const SLOT = 21;

/** The route count on the strip (DESIGN.md §21: `routes 96/140`), warn ink within 10 of the cap. */
function routesLabel(app: App, short = false): string {
  const g = app.game;
  const n = g.s[ID]?.routes.length ?? 0, max = maxRoutes(g, ID);
  const s = short ? `${n}/${max}` : `routes ${n}/${max}`;
  return n >= max - 10 ? `{warn:${s}}` : s;
}

/** The strip's words when no group is in hand: what goes up here and where it comes from. */
const NONE = () => (ID === 'beyond' ? '{soft:no spare World folds}' : ID === 'world' ? '{soft:no spare District folds}' : '{soft:no spare groups}');
const groupsCap = () => (ID === 'district' ? 'GROUPS' : 'MODULES');

function stripNatural(app: App, level = 0): number {
  const ts = tools(app);
  const tw = ts.reduce((s, t) => s + t.w + 3, 0);
  const gs = groups(app);
  const slots = gs.length ? 6 + (level >= 1 ? 0 : smallWidth(groupsCap()) + 4) + gs.length * (SLOT + 2) : 6 + richWidth(NONE());
  return 12 + tw + 4 + richWidth(routesLabel(app, level >= 2)) + 6 + slots;
}

/** The tool strip at the top centre: the tools, then the groups in hand (a page at a time). */
function toolStrip(app: App, L: Layout) {
  const ui = app.ui;
  const R = stripRect(app, L);
  ui.panel(R.x, R.y, R.w, R.h, 'paper');
  // two strings up to the top edge, as the Purse hangs
  ui.ctx.fillStyle = T.paperEdge;
  ui.ctx.fillRect(R.x + 8, 0, 1, R.y);
  ui.ctx.fillRect(R.x + R.w - 9, 0, 1, R.y);
  let x = R.x + 5;
  const y = R.y + 5;
  for (const t of tools(app)) {
    if (button(ui, t.id, x, y, t.w, 20, t.label, { icon: t.icon, active: t.on, tip: t.tip })) t.go();
    x += t.w + 3;
  }
  // the route count: how many more the floor holds (a refusal at the cap says why: the sim)
  const rl = routesLabel(app, STRIP.level >= 2), rw = richWidth(rl);
  const g = app.game;
  const nR = g.s[ID]?.routes.length ?? 0, maxR = maxRoutes(g, ID);
  drawRich(ui, rl, x + 2, y + 5, Infinity, T.inkSoft);
  ui.hint(x, y, rw + 4, 20, [
    { text: '{big:Routes}' },
    { text: `${nR} of the ${maxR} this floor holds` },
    { text: `a lot adds ${RULES.routesPerLot.value} · a fold packs a group's routes into one tile` },
  ], 220);
  x += rw + 4;
  ui.ctx.fillStyle = T.paperEdge;
  ui.ctx.fillRect(x + 1, y + 1, 1, 18);
  x += 5;
  const gs = groups(app);
  if (!gs.length) {
    drawRich(ui, NONE(), x, y + 5, Infinity, T.inkSoft);
    ui.hint(x, y, R.x + R.w - x, 20, ID === 'beyond'
      ? [{ text: '{big:Modules}' }, { text: 'depth-4 modules go up here: the World\'s folds' }, { text: 'fold a group on the {u:world} World · stamp copies on the Modules page' }]
      : ID === 'world'
      ? [{ text: '{big:Modules}' }, { text: 'depth-3 modules go up here: the District\'s folds' }, { text: 'fold a group of groups on the {u:district} District · stamp copies on the Modules page' }]
      : [{ text: '{big:Groups}' }, { text: 'depth-2 groups and depth-3 folds go up here' }, { text: 'fold a group on the {u:factory} Factory · stamp copies on the Modules page' }], 210);
    return;
  }
  if (STRIP.level < 1) {
    ui.small(groupsCap(), x, y + 7, T.inkSoft);
    x += smallWidth(groupsCap()) + 4;
  }
  const room = Math.max(1, Math.floor((R.x + R.w - 4 - x) / (SLOT + 2)));
  const pages = Math.max(1, Math.ceil(gs.length / room));
  const per = pages > 1 ? Math.max(1, room - 1) : room;
  const np = Math.max(1, Math.ceil(gs.length / per));
  DS.page = Math.min(DS.page, np - 1);
  const shown = gs.slice(DS.page * per, DS.page * per + per);
  for (const d of shown) {
    const holding = app.mode.k === 'hmodule' && app.mode.design === d.id;
    const out = mainItem(d);
    // a depth-3 fold among the District's groups wears a mark; on the World every one is depth 3
    const deep = d.depth === 3 && ID === 'district';
    const tip: TipLine[] = [
      { text: `{big:${bigSafe(d.name)}}` },
      ...(deep ? [{ text: '{research:depth 3} · a District fold' }] : []),
      { text: `{chip:${gradeRole(d.grade.letter)}:${d.grade.letter}} out ${(Object.entries(d.outs) as [ItemId, number][]).map(([k, v]) => `${icon(k)} ${rate(v ?? 0)}/s`).join(' ')}` },
      ...(Object.keys(d.ins).length ? [{ text: `in ${(Object.entries(d.ins) as [ItemId, number][]).map(([k, v]) => `${icon(k)} ${rate(v ?? 0)}/s`).join(' ')}` }] : []),
      { text: `${d.spare} spare · {k:LMB} take one` },
    ];
    if (button(ui, 'dGroup:' + d.id, x, y, SLOT, 20, '', { active: holding, tip })) app.pickModule(d.id);
    const mn = hart(ID, 'module');
    const s = hasArt(mn) ? sheet(mn) : sheet('module');
    ui.ctx.drawImage(s.frames[0], x + 2, y + 1);
    if (out) ui.ctx.drawImage(itemIcon(out), x + 6, y + 1 + (hasArt(mn) ? 6 : 4));
    ui.small(String(d.spare), x + SLOT - 2, y + 11, T.ink, { align: 'right' });
    // a depth-3 fold: a research-teal rim inside the slot and a "3" tab on its top-left corner
    if (deep) {
      const c = ui.ctx;
      c.fillStyle = T.research;
      c.fillRect(x + 1, y + 1, SLOT - 2, 1);
      c.fillRect(x + 1, y + 18, SLOT - 2, 1);
      c.fillRect(x + 1, y + 1, 1, 18);
      c.fillRect(x + SLOT - 2, y + 1, 1, 18);
      c.fillStyle = T.ink;
      c.fillRect(x, y, 7, 9);
      c.fillStyle = T.research;
      c.fillRect(x + 1, y + 1, 5, 7);
      ui.small('3', x + 2, y + 2, T.paperHi);
    }
    x += SLOT + 2;
  }
  if (np > 1) {
    if (button(ui, 'dGroupsNext', x, y, 12, 20, ICON.right, { tip: `{big:More groups}  page ${DS.page + 1} of ${np}` })) DS.page = (DS.page + 1) % np;
  }
}

/** Where the lot's Buy button stands (the lot's lower part: the Dock's and the Hopper's tags hang
 *  beside their own tiles, above it), or null when no lot is for sale or it is off the screen. A
 *  pinned report docked over it moves it up or down the lot, or puts it away while it is pinned. */
function lotRect(app: App, L: Layout): Rect | null {
  const ui = app.ui;
  const g = app.game;
  const price = lotPrice(g, ID);
  if (!price) return null;
  const fw = highW(g, ID), fh = HIGH[ID].h;
  const r = worldRect(app, fw, 0, HIGH[ID].lotCols, fh);
  if (r.x > ui.w - 8 || r.x + r.w < 8) return null;
  const priceS = `{coin:${price.format()}}`;
  const bw = Math.max(richWidth('Buy lot') + 14, chipWidth(priceS)), bh = 17 + 2 + CHIP_H;
  const x = Math.round(Math.max(4, Math.min(ui.w - bw - 4, r.x + r.w / 2 - bw / 2)));
  const lo = 40, hi = ui.h - 100;
  const y = Math.round(Math.max(lo, Math.min(hi, r.y + r.h * 0.72 - bh / 2)));
  const P = pinnedPlace(app, L);
  if (!P || overlapArea({ x, y, w: bw, h: bh }, P) <= 0) return { x, y, w: bw, h: bh };
  const fits = (yy: number) => yy >= Math.max(lo, r.y) && yy + bh <= Math.min(hi + bh, r.y + r.h);
  const below = P.y + P.h + 4, above = P.y - bh - 4;
  if (fits(below)) return { x, y: below, w: bw, h: bh };
  if (fits(above)) return { x, y: above, w: bw, h: bh };
  return null;
}

function lotButton(app: App, L: Layout) {
  const ui = app.ui;
  const g = app.game;
  const price = lotPrice(g, ID);
  const R = lotRect(app, L);
  if (!price || !R) return;
  const can = g.s.coin.gte(price);
  const priceS = `{coin:${price.format()}}`;
  const tip: TipLine[] = [{ text: `{big:A ${HIGH[ID].name} lot}` }, { text: `+${HIGH[ID].lotCols} columns · +${RULES.routesPerLot.value} routes` }, { text: can ? `{k:LMB} buy ${priceS}` : `{soft:you have} {coin:${g.s.coin.format()}}` }, { text: '{reset:until Reorganize}' }];
  if (button(ui, 'buyLot', R.x, R.y, R.w, 17, 'Buy lot', { gold: can, tip })) app.act({ k: 'hlot', floor: ID });
  chip(ui, R.x + Math.round((R.w - chipWidth(priceS)) / 2), R.y + 19, priceS, { role: can ? 'coin' : 'soft' });
}

/** The item list when a route could carry several things. */
function itemPicker(app: App) {
  const p = DS.pick;
  if (!p) return;
  const ui = app.ui;
  const g = app.game;
  const to = hentAt(g, ID, p.tx, p.ty);
  if (!to) { DS.pick = null; return; }
  const near = worldRect(app, to.x, to.y, to.w, to.h);
  const src = hentAt(g, ID, p.fx, p.fy);
  const d = src ? g.design(src.design) : null;
  const rows = p.items.map((it) => `${icon(it)} ${itemName(it)} {soft:${rate(d?.outs[it] ?? 0)}/s}`);
  const cw = Math.max(120, ...rows.map((s) => richWidth(s) + 8));
  const ch = BIG_LINE_H + 4 + rows.length * 16;
  const sz = tagSize(cw, ch, 'left');
  const at = place(app, near, sz.w, sz.h);
  const R = tag(ui, at.x, at.y, sz.w, sz.h, { hole: 'left', anchor: { x: near.x + near.w / 2, y: near.y + near.h / 2 } });
  ui.big('Carry which?', R.x, R.y, T.ink);
  if (button(ui, 'dPickClose', R.x + R.w - 12, R.y - 1, 12, 12, '{u:remove}', { tip: 'cancel {k:Esc}' })) { DS.pick = null; return; }
  rule(ui, R.x, R.y + BIG_LINE_H, R.w, true);
  let y = R.y + BIG_LINE_H + 4;
  p.items.forEach((it, i) => {
    if (button(ui, 'dPick:' + it, R.x, y, R.w, 15, rows[i], { tip: [{ text: `{big:${bigSafe(itemName(it))}}` }, { text: `by ${word()} to ${nameOf(g, to)}` }, { text: `{k:LMB} fly it · a ${word()} {coin:${coinK(skiffCost())}}` }] })) {
      const ok = app.act({ k: 'route', floor: ID, fx: p.fx, fy: p.fy, tx: p.tx, ty: p.ty, item: it }).ok;
      DS.pick = null;
      if (ok) DS.from = null;
    }
    y += 16;
  });
}

const overlapArea = (a: Rect, b: Rect) => Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));

/** A spot for a big w x h card near `near`: the four sides first, then a scan of the screen, off
 *  the HUD's zones and `also` (a route's card is wide, and the District's HUD is busy at 1024). */
function placeWide(app: App, near: Rect, w: number, h: number, also: Rect[]): { x: number; y: number } {
  const ui = app.ui;
  const first = place(app, near, w, h, also);
  const score = (r: Rect) => overlapArea(r, near) * 4 + zones.reduce((n, z) => n + overlapArea(r, z), 0) * 3 + also.reduce((n, z) => n + overlapArea(r, z), 0) * 2;
  let best = first, bestScore = score({ ...first, w, h });
  if (bestScore === 0) return best;
  const cx = near.x + near.w / 2, cy = near.y + near.h / 2;
  for (let y = 3; y <= ui.h - h - 3; y += 8) {
    for (let x = 3; x <= ui.w - w - 3; x += 8) {
      const s = score({ x, y, w, h }) + Math.hypot(x + w / 2 - cx, y + h / 2 - cy) * 0.5;
      if (s < bestScore) { bestScore = s; best = { x, y }; }
    }
  }
  return best;
}

/** The route card: the readout, + skiff and - skiff with the price, Remove route. */
function routeCard(app: App, L: Layout) {
  const id = DS.route;
  if (id === null) return;
  const ui = app.ui;
  const g = app.game;
  const r = g.s[ID]?.routes.find((q) => q.id === id);
  const e = r ? routeEnds(g, r, ID) : null;
  if (!r || !e) { DS.route = null; return; }
  const want = routeWant(g, ID, r);
  const cap = routeCap(g, ID, r);
  const short = routeShort(g, r, ID);
  const per = skiffRateNow(g, ID, routeDist(e.a, e.b));
  const w1 = word();
  const lines = [`${icon(r.item)} ${nameOf(g, e.a)} → ${nameOf(g, e.b)}`, routeReadout(g, r)];
  if (short) lines.push(`{warn:short of ${w1}s} · ${skiffsNeeded(g, r) - r.skiffs} more carry all ${rate(want)}/s`);
  else if (want > 1e-9 && r.flow < want * 0.9 && e.a.state !== 'work') lines.push(`its source is {warn:${e.a.state}} · ${w1}s wait on it`);
  lines.push(`{soft:a ${w1} carries} ${rate(per)}/s {soft:here}` + (r.skiffs > 1 ? ` {soft:· ${r.skiffs} carry} ${rate(cap)}/s` : ''));
  const lays = lines.map((s) => layoutRich(s, 230));
  const plus = `+ ${w1} {coin:${coinK(skiffCost())}}`;
  const minus = `${MINUS} ${w1} +${coinK(skiffCost())}`;
  const btnW = [richWidth(plus) + 14, richWidth(minus) + 14, richWidth('Remove route') + 14];
  const title = `${Word()} route`;
  const cw = Math.max(150, bigWidth(title) + 28, ...lays.map((l) => l.w), btnW[0] + btnW[1] + 4);
  const ch = BIG_LINE_H + 3 + lays.reduce((s, l) => s + l.h, 0) + 10 + 2 * 19;
  const sz = tagSize(cw, ch, 'left');
  // beside the route's middle, off its two ends
  const mid = worldRect(app, (e.ax + e.bx) / 2 / 16 - 0.5, (e.ay + e.by) / 2 / 16 - 0.5, 1, 1);
  const also = [worldRect(app, e.a.x, e.a.y, e.a.w, e.a.h), worldRect(app, e.b.x, e.b.y, e.b.w, e.b.h)];
  const at = placeWide(app, mid, sz.w, sz.h, also);
  const R = tag(ui, at.x, at.y, sz.w, sz.h, { pin: true, hole: 'left' });
  ui.big(title, R.x + 2, R.y, T.ink);
  ui.ctx.drawImage(itemIcon(r.item), R.x + R.w - 24, R.y + 1);
  if (button(ui, 'dCloseRoute', R.x + R.w - 12, R.y - 1, 12, 12, '{u:remove}', { tip: 'close {k:Esc}' })) { DS.route = null; return; }
  rule(ui, R.x, R.y + BIG_LINE_H, R.w, true);
  let y = R.y + BIG_LINE_H + 3;
  for (const l of lays) { drawLayout(ui, l, R.x, y, T.ink); y += l.h; }
  meter(ui, R.x, y + 2, R.w, 5, want > 1e-9 ? Math.min(1, r.flow / want) : 1, { role: short ? 'warn' : 'good', target: 0.9, glint: false });
  y += 10;
  const can = g.s.coin.gte(skiffCost());
  const max = HIGH[ID].maxSkiffs;
  if (button(ui, 'dSkiffPlus', R.x, y, btnW[0], 17, plus, { gold: can && short, disabled: r.skiffs >= max, tip: [{ text: `{big:One more ${w1}}` }, { text: `+${rate(per)}/s · ${words(r.skiffs + 1)}` }, { text: r.skiffs >= max ? `{soft:${max} is the most a route takes}` : `{coin:${coinK(skiffCost())}} · refunded when lifted` }] })) app.act({ k: 'skiff', floor: ID, id: r.id, n: 1 });
  if (button(ui, 'dSkiffMinus', R.x + btnW[0] + 4, y, btnW[1], 17, minus, { disabled: r.skiffs <= 1, tip: [{ text: `{big:One ${w1} fewer}` }, { text: r.skiffs <= 1 ? '{soft:a route keeps one · remove the route}' : `${MINUS}${rate(per)}/s · {coin:${coinK(skiffCost())}} back` }] })) app.act({ k: 'skiff', floor: ID, id: r.id, n: -1 });
  y += 19;
  if (button(ui, 'dUnroute', R.x, y, btnW[2], 17, 'Remove route', { tip: [{ text: '{big:Remove route}' }, { text: `its ${words(r.skiffs)} refunded` }] })) { if (app.act({ k: 'unroute', floor: ID, id: r.id }).ok) DS.route = null; }
  void L;
}

/** The pinned report for a thing on the District, docked on the right (or the left when the right
 *  would sit on it). */
function pinned(app: App, L: Layout) {
  const id = DS.sel;
  if (id === null) return;
  if (!hent(app.game, ID, id)) { DS.sel = null; return; }
  const P = pinnedPlace(app, L);
  if (!P) return;
  drawRep(app, P.laid, P.x, P.y, { pin: true, close: () => { DS.sel = null; }, blocking: true });
}

/** Where the pinned report goes: docked on the right, or the left when the right would sit on the
 *  thing (the lot's Buy button keeps off it: lotRect). */
function pinnedPlace(app: App, L: Layout): { laid: Laid; x: number; y: number; w: number; h: number } | null {
  const id = DS.sel;
  if (id === null) return null;
  const g = app.game;
  const ui = app.ui;
  const e = hent(g, ID, id);
  if (!e) return null;
  const rep = entRep(app, e);
  const near = worldRect(app, e.x, e.y, e.w, e.h);
  const top = L.slips.y + 18, bot = L.notebook.y - 6;
  const laid = layRep(rep, true, L.wide ? 206 : 198, false, true, bot - top);
  let x = ui.w - 6 - laid.w;
  const y = Math.max(top, Math.min(bot - laid.h, near.y - 10));
  if (near.x + near.w > x - 8) x = Math.max(6, near.x - 12 - laid.w);
  return { laid, x, y, w: laid.w, h: laid.h };
}

/** The District fold's audit: the Inspector's clipboard on a string beside the box (the countdown,
 *  the projected grade, U/W/C as meters), a cross to stop it; once graded, Fold it opens the card. */
function auditClip(app: App, L: Layout) {
  const g = app.game;
  const a = g.s.haudit;
  if (!a || a.floor !== ID) return;
  if (a.last) return lastAuditSlip(app, L);
  const ui = app.ui;
  const b = worldRect(app, a.box.x, a.box.y, a.box.w, a.box.h);
  const W = 104, H = 62;
  // beside the box, off the HUD's zones (the tool strip, the lot's button, the corners)
  const at = place(app, { x: b.x - 2, y: b.y - 2, w: b.w + 4, h: b.h + 4 }, W, H);
  const x = at.x, y = Math.max(40, at.y);
  twine(ui, x + 10, y + 3, Math.max(b.x + 2, Math.min(b.x + b.w - 2, x + 10)), Math.max(b.y + 2, Math.min(b.y + b.h - 2, y + 3)));
  const R = clipboard(ui, x, y, W, H);
  const warm = prules(g).auditWarmup * TICK_RATE;
  const total = warm + prules(g).auditWindow * TICK_RATE;
  const left = Math.max(0, Math.ceil((total - a.t) / TICK_RATE));
  const res = a.result ?? (a.t > warm + TICK_RATE ? gradeHAudit(g) : null);
  const cs = `{u:clock} {${left <= 10 ? 'warn' : 'ink'}:${left} s}`;
  const headR = a.result ? smallWidth('GRADED') + 4 : richWidth(cs) + 17;
  const full = `GROUP ${a.box.w}X${a.box.h}`;
  ui.small(smallWidth(full) <= R.w - headR ? full : `${a.box.w}X${a.box.h}`, R.x, R.y + 2, T.inkSoft);
  if (!a.result) drawRich(ui, cs, R.x + R.w - 13, R.y, Infinity, T.ink, { align: 'right' });
  else ui.small('GRADED', R.x + R.w, R.y + 2, T.good, { align: 'right' });
  rule(ui, R.x, R.y + 11, R.w, true);
  const lx = R.x + 15, ly = R.y + 14;
  ui.big(res ? res.grade.letter : '?', lx, ly, res ? T.ink : T.inkSoft, { scale: 2, align: 'center' });
  const mx = R.x + 34, mw = R.x + R.w - mx - 7;
  const parts: [string, number][] = res ? [['U', res.grade.u], ['W', res.grade.w], ['C', res.grade.c]] : [['U', 0], ['W', 0], ['C', 0]];
  parts.forEach(([l, v], i) => {
    ui.small(l, mx, ly + i * 7, T.inkSoft);
    meter(ui, mx + 7, ly + i * 7, mw, 5, v, { role: meterRole(v), glint: false });
  });
  const fy = R.y + R.h - CHIP_H;
  if (a.result) {
    if (button(ui, 'dFoldIt', R.x, fy - 3, R.w, 15, 'Fold it!', { gold: true, pulse: true, tip: [{ text: `{big:Graded ${a.result.grade.letter}}` }, { text: '{k:LMB} the Inspector\'s report' }] })) {
      app.panel = 'fgrade';
      app.gradeAt = ui.time;
      app.nameDraft = null;
      app.hud.stamped = false;
    }
  } else {
    chip(ui, R.x, fy, a.t < warm ? `warm-up ${Math.max(0, Math.ceil((warm - a.t) / TICK_RATE))} s` : 'measuring', { role: 'soft' });
    if (button(ui, 'dCancelAudit', R.x + R.w - 11, R.y - 1, 11, 11, ICON.cross, { tip: [{ text: '{big:Stop the audit}' }, { text: 'the group keeps running' }] })) app.act({ k: 'hauditCancel' });
  }
  if (res) ui.hint(R.x, R.y + 12, R.w, 30, [
    { text: `{big:${a.result ? 'Graded' : 'Projected'} ${res.grade.letter}}` },
    { text: `U busy ${Math.round(res.grade.u * 100)}% ×${SCORE_WEIGHTS.u} · W waste ${Math.round(res.grade.w * 100)}% ×${SCORE_WEIGHTS.w}` },
    { text: `C compact ${Math.round(res.grade.c * 100)}% ×${SCORE_WEIGHTS.c} · rates ×${res.grade.mult.toFixed(2)}` },
  ], 220);
}

/** Where the Last Fold's audit slip hangs: under the tool strip (and under the tool's hint slip),
 *  centred on the strip, or null when no whole-World audit runs on this floor. */
function lastSlipRect(app: App, L: Layout): Rect | null {
  const a = app.game.s.haudit;
  if (!a?.last || a.floor !== ID) return null;
  const R = stripRect(app, L);
  const w = Math.min(app.ui.w - 16, Math.max(R.w, 236));
  const h = hintOf(app, L);
  return { x: Math.round(Math.max(8, Math.min(app.ui.w - w - 8, R.x + R.w / 2 - w / 2))), y: R.y + R.h + 3 + (h ? h.r.h + 3 : 0), w, h: 44 };
}

/** The Last Fold's audit over the whole World (DESIGN.md §23): a long clipboard under the strip
 *  with the countdown, the window's progress as a bar, the projected grade and U, W, C, the Kernels
 *  it would bank now, and a labelled Cancel; once graded, "The Last Fold" opens the card. */
function lastAuditSlip(app: App, L: Layout) {
  const R0 = lastSlipRect(app, L);
  const a = app.game.s.haudit;
  if (!R0 || !a) return;
  const ui = app.ui;
  const g = app.game;
  const R = clipboard(ui, R0.x, R0.y, R0.w, R0.h);
  const warm = prules(g).auditWarmup * TICK_RATE;
  const total = warm + prules(g).auditWindow * TICK_RATE;
  const left = Math.max(0, Math.ceil((total - a.t) / TICK_RATE));
  const res = a.result ?? (a.t > warm + TICK_RATE ? gradeHAudit(g) : null);
  const k = previewKernels(g);
  const bonus = res ? KERNEL_GRADE.bonus[res.grade.letter] ?? 0 : 0;
  const kn = Math.floor(k.valueTerm + bonus + 1e-9);
  // the left: the title and the time, then the window's bar
  const title = a.result ? 'THE WORLD IS GRADED' : a.t < warm ? 'THE LAST FOLD - WARM-UP' : 'THE LAST FOLD - AUDITING';
  ui.small(title, R.x, R.y + 1, a.result ? T.good : T.inkSoft);
  const bw = Math.max(60, R.w - 140);
  meter(ui, R.x, R.y + 11, bw, 5, Math.min(1, a.t / total), { role: a.result ? 'good' : 'research', glint: false });
  const cs = a.result ? `${a.ids.length} modules` : `{u:clock} ${left} s · ${a.ids.length} modules`;
  drawRich(ui, cs, R.x, R.y + 18, bw, T.ink);
  // the right: the grade so far, U W C, the Kernels
  const gx = R.x + bw + 8;
  ui.big(res ? res.grade.letter : '?', gx + 8, R.y + 2, res ? GRADE_INK_D(res.grade.letter) : T.inkSoft, { align: 'center' });
  const parts: [string, number][] = res ? [['U', res.grade.u], ['W', res.grade.w], ['C', res.grade.c]] : [['U', 0], ['W', 0], ['C', 0]];
  parts.forEach(([l, v], i) => {
    ui.small(l, gx + 19, R.y + 1 + i * 7, T.inkSoft);
    meter(ui, gx + 25, R.y + 1 + i * 7, 26, 5, v, { role: meterRole(v), glint: false });
  });
  const ks = `{u:kernel} ${kn}`;
  drawRich(ui, ks, gx + 56, R.y + 1, Infinity, T.coin);
  ui.hint(gx, R.y, R.x + R.w - gx, 20, [
    { text: `{big:${a.result ? 'Graded' : 'Projected'} ${res ? res.grade.letter : '?'}}` },
    { text: `{u:kernel} ${kn} Kernels: value ${Math.round(k.value)} ÷ ${RULES.kernelPerValue.value} + ${bonus} for the grade` },
    ...(res ? [{ text: `U busy ${Math.round(res.grade.u * 100)}% · W waste ${Math.round(res.grade.w * 100)}% · C the floor filled ${Math.round(res.grade.c * 100)}%` }] : [{ text: '{soft:the grade shows after the warm-up}' }]),
  ], 240);
  const by = R.y + R.h - 14;
  if (a.result) {
    if (button(ui, 'lastFoldOpen', R.x + R.w - 74, by, 74, 13, 'The card', { gold: true, pulse: true, tip: [{ text: `{big:Graded ${a.result.grade.letter}}` }, { text: '{k:LMB} what the Last Fold banks, keeps and loses' }] })) { app.panel = 'lastfold'; app.gradeAt = ui.time; app.hud.stamped = false; }
  } else if (button(ui, 'lastFoldCancel', R.x + R.w - 50, by, 50, 13, 'Cancel', { tip: [{ text: '{big:Stop the audit}' }, { text: 'the World keeps running · nothing is lost' }] })) app.act({ k: 'hauditCancel' });
}

/** A grade's ink on paper (fold.ts GRADE_INK, by role here to keep the import list short). */
const GRADE_INK_D = (l: string) => roleInk(gradeRole(l));

/** Everything the District puts on the HUD (no page open): the tool strip, the lot's button, the
 *  audit's clipboard, the route card, the item list, the pinned report. */
export function districtHud(app: App, L: Layout) {
  const f = highOf(app);
  if (!f || !app.game.s[f]) return;
  sync(app);
  toolStrip(app, L);
  lotButton(app, L);
  auditClip(app, L);
  pinned(app, L);
  // the item list asks a question: the route card waits while it is up
  if (DS.pick) itemPicker(app);
  else routeCard(app, L);
  // what the tool in hand does, on a slip under the strip
  const h = hintOf(app, L);
  if (h) {
    app.ui.panel(h.r.x, h.r.y, h.r.w, h.r.h, 'paper', false);
    drawRich(app.ui, h.s, h.r.x + 6, h.r.y + 3, Infinity, T.ink);
  }
  void dot;
}

// ------------------------------------------------------------------ input

/** The mouse on the District, after the HUD has had its chance to take the click. `w` is the world
 *  point under the mouse (for a route's line). */
export function districtInput(app: App, t: { x: number; y: number }, overUI: boolean, pt: { x: number; y: number }, w: { x: number; y: number }) {
  const g = app.game;
  const inp = app.input;
  sync(app);
  if (!g.s[ID]) return;
  const W = highW(g, ID), H = HIGH[ID].h;
  const inFloor = (p: { x: number; y: number }) => p.x >= 0 && p.y >= 0 && p.x < W && p.y < H;
  // the route under the mouse (not over a thing, not with a tool that places)
  const thing = inFloor(t) ? hentAt(g, ID, t.x, t.y) : null;
  DS.hoverRoute = !overUI && app.mouseIn && !thing && (app.mode.k === 'idle' || app.mode.k === 'remove') ? routeAtWorld(g, w.x, w.y, 3, ID)?.id ?? null : null;
  if (app.mode.k === 'fold') {
    const cx = Math.max(0, Math.min(W - 1, t.x)), cy = Math.max(0, Math.min(H - 1, t.y));
    if (inp.mouse.pressed[0] && !overUI && inFloor(pt)) app.foldDrag = { x0: pt.x, y0: pt.y, x1: pt.x, y1: pt.y };
    if (app.foldDrag && inp.mouse.down[0]) { app.foldDrag.x1 = cx; app.foldDrag.y1 = cy; }
    if (app.foldDrag && !inp.mouse.down[0]) {
      const b = app.dragBox()!;
      app.foldDrag = null;
      if (app.act({ k: 'haudit', floor: ID, ...b }).ok) app.setMode({ k: 'idle' });
    }
    return;
  }
  if (!inp.mouse.pressed[0] || overUI) return;
  if (app.mode.k === 'hmodule') {
    const d = app.mode.design;
    const r = app.act({ k: 'hplace', floor: ID, design: d, x: t.x, y: t.y });
    if (r.ok && (g.design(d)?.spare ?? 0) < 1) app.setMode({ k: 'idle' });
    return;
  }
  if (app.mode.k === 'remove') {
    if (DS.hoverRoute !== null) { app.act({ k: 'unroute', floor: ID, id: DS.hoverRoute }); return; }
    if (thing) app.act({ k: 'hremove', floor: ID, x: t.x, y: t.y });
    return;
  }
  if (app.mode.k === 'route') {
    DS.pick = null;
    if (!DS.from) {
      if (!thing) return;
      if (thing.kind !== 'module') { app.refuse('A route starts at a module'); return; }
      DS.from = { x: thing.x, y: thing.y };
      app.audio.sfx('click');
      return;
    }
    const src = hentAt(g, ID, DS.from.x, DS.from.y);
    if (!src) { DS.from = null; return; }
    if (!thing) { app.refuse('Click where it goes: a module, the Dock, the Hopper or the Bay'); return; }
    if (thing === src) { DS.from = null; app.audio.sfx('close'); return; }
    const items = routeItems(g, src, thing, ID);
    if (!items.length) {
      // the sim says why, for the first thing the source makes
      const d = g.design(src.design);
      const first = (d ? (Object.keys(d.outs) as ItemId[]) : [])[0];
      app.refuse((first && routeRefusal(g, ID, src.x, src.y, thing.x, thing.y, first)) || `${nameOf(g, thing)} takes nothing ${nameOf(g, src)} makes`);
      return;
    }
    if (items.length === 1) {
      if (app.act({ k: 'route', floor: ID, fx: src.x, fy: src.y, tx: thing.x, ty: thing.y, item: items[0] }).ok) DS.from = null;
      return;
    }
    DS.pick = { fx: src.x, fy: src.y, tx: thing.x, ty: thing.y, items };
    return;
  }
  // idle: a route's line opens its card; the Dock its orders, the Hopper Inspiration, a module
  // Overdrive for its group (else its report pins)
  if (DS.hoverRoute !== null) { DS.route = DS.route === DS.hoverRoute ? null : DS.hoverRoute; DS.sel = null; return; }
  if (!thing) { DS.sel = null; DS.route = null; return; }
  if (thing.kind === 'fdock') { app.togglePanel('orders'); return; }
  if (thing.kind === 'fhopper') { if (!g.act({ k: 'hclick', floor: ID, x: t.x, y: t.y }).ok) app.togglePanel('research'); return; }
  if (thing.kind === 'module' && g.done('overdrive') && !(thing.od ?? 0) && !(thing.cool ?? 0) && g.act({ k: 'hclick', floor: ID, x: t.x, y: t.y }).ok) return;
  DS.sel = DS.sel === thing.id ? null : thing.id;
  DS.route = null;
}

// ------------------------------------------------------------------ the grade card

/** The District fold's grade card (DESIGN.md §21): the Inspector's report for a group of groups. */
export function hgradeCard(app: App, L: Layout) {
  const g = app.game;
  const a = g.s.haudit;
  if (!a || !a.result) { app.panel = null; return; }
  ID = a.floor;
  const res = a.result;
  const mods = a.ids.map((id) => hent(g, a.floor, id)).filter((m): m is FEnt => !!m);
  const bill = mods.reduce((s, m) => s + (g.design(m.design)?.bill ?? 0), 0);
  const inner = (g.s[a.floor]?.routes ?? []).filter((r) => a.ids.includes(r.from) && a.ids.includes(r.to));
  const skiffs = inner.reduce((s, r) => s + r.skiffs, 0);
  const scaled = Object.fromEntries(Object.entries(res.outs).map(([k, v]) => [k, (v ?? 0) * res.grade.mult])) as Partial<Record<ItemId, number>>;
  // the whole World's audit is the Last Fold's: its own card (src/app/lastfold.ts)
  if (a.last) { app.panel = 'lastfold'; return; }
  const W4 = a.floor === 'world';
  drawGrade(app, L, {
    res,
    box: a.box,
    title: W4 ? 'World fold' : 'District fold',
    kind: `GROUP ${a.box.w}X${a.box.h}`,
    parts: mods.map((m) => ({
      id: m.id,
      draw: (x: number, y: number) => {
        const mn = hart(a.floor, 'module');
        const s = hasArt(mn) ? sheet(mn) : sheet('module');
        app.ui.ctx.drawImage(s.frames[0], x, y);
        const out = mainOutput(g, m.design);
        if (out) app.ui.ctx.drawImage(itemIcon(out), x + 4, y + (hasArt(mn) ? 6 : 4));
      },
      name: hname(g, m),
      busy: res.busy[m.id] ?? 0,
    })),
    defaultName: defaultName(scaled) + (W4 ? ' IV' : ' III'),
    fold: (name) => app.act({ k: 'hfold', name }).ok,
    cancel: () => app.act({ k: 'hauditCancel' }),
    foldRows: [
      `{u:fold} ${mods.length} ${W4 ? 'modules' : 'groups'} · ${res.boxTiles} tiles → 1 tile`,
      W4 ? `rates ×${res.grade.mult.toFixed(2)} · depth 4 · stands on {u:beyond} Beyond` : `rates ×${res.grade.mult.toFixed(2)} · depth 3 · stands here or on the World`,
      `${skiffs} ${word()}${skiffs === 1 ? '' : 's'} inside refunded {coin:${coinK(skiffs * skiffCost())}}`,
      `copies {coin:${coinK(bill)}} ×1 · ×1.5 · ×2 · …`,
    ],
    bill,
    cancelLabel: 'Keep the group',
    cancelTip: '{big:Keep the group}  audit off · the groups keep flying',
  });
}

void C; void RULES;
