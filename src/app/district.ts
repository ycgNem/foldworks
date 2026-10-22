// The District's tools and panels (DESIGN.md §21, docs/endgame.md Milestone 7), in the 180's ink on
// paper (docs/hud-180.md). Every core action is a labelled button (the owner): a tool strip hangs
// at the top centre with Route, Remove and Fold and the groups in hand (depth-2 designs with spare
// copies, each a slot that puts one in your hand); the next lot's Buy button stands on the lot
// itself at the floor's east edge. The Route tool: click a source module, then where it goes; when
// the source makes several things the destination takes, a small labelled list picks the item. A
// route (its line, or a module's route list) opens its card: `3 skiffs · 1.4/s of 2.1 wanted ·
// 6.2 tiles`, + skiff and - skiff with the price, Remove route. Hover tags and the pinned report
// for modules (status and its cause: which route is short, which item has nowhere to go), the
// Dock, the Hopper and the Bay, and a route's readout (pillar 3). The District fold: the drag box,
// the Inspector's clipboard on the audited box, and the grade card (fold.ts drawGrade). Reads the
// App and the Game; changes the game only through App.act.
import { C } from '../data/palette';
import { HIGH } from '../data/floors';
import { ITEMS, itemName, type ItemId } from '../data/items';
import { RESEARCH } from '../data/research';
import { RULES, SCORE_WEIGHTS } from '../data/rules';
import { MEGAS } from '../data/megaprojects';
import { Num } from '../engine/num';
import { TICK_RATE } from '../engine/time';
import { prules } from '../sim/patents';
import type { Game } from '../sim/Game';
import type { FEnt, SkiffRoute } from '../sim/world';
import { highW, hent, hentAt, hname, routeDist, routeCap, routeWant, routeRefusal, lotPrice, megaStageOf, gradeHAudit, skiffRateNow } from '../sim/systems/high';
import { BYPRODUCTS, defaultName, mainItem } from '../sim/systems/modules';
import { bigWidth, smallWidth, LINE_H, BIG_LINE_H, ICON } from '../ui/font';
import { layoutRich, drawLayout, richWidth, drawRich, CHIP_H, type RichLayout } from '../ui/rich';
import { T, type Role } from '../ui/theme';
import { sheet, itemIcon, hasArt } from '../render/sprites';
import { mainOutput } from '../render/factory';
import { routeAtWorld, routeEnds, routeShort, routeItems, districtMegaFrac } from '../render/district';
import { button, tag, tagSize, rule, meter, chip, chipWidth, clipboard, twine, uiIcon, dot, type UIconName } from './chrome';
import { bigSafe, worldRect, place, zones } from './tags';
import { drawGrade } from './fold';
import type { Layout } from './layout';
import type { App } from './app';
import type { Rect, TipLine } from '../ui/ui';

const ID = 'district' as const;

/** The District's UI state: the Route tool's source and its item list, the pinned thing, the
 *  route whose card is open, the route under the mouse, the tool strip's page of groups. */
export const DS = {
  from: null as { x: number; y: number } | null,
  pick: null as { fx: number; fy: number; tx: number; ty: number; items: ItemId[] } | null,
  sel: null as number | null,
  route: null as number | null,
  hoverRoute: null as number | null,
  page: 0,
  game: null as Game | null,
};

/** Forget what belongs to another game or has gone from the floor. */
function sync(app: App) {
  const g = app.game;
  if (DS.game !== g) { DS.from = null; DS.pick = null; DS.sel = null; DS.route = null; DS.hoverRoute = null; DS.page = 0; DS.game = g; }
  const st = g.s.district;
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
  return n <= 0 ? '0' : n.toFixed(2);
}
const MINUS = '-'; // the bitmap font has no U+2212 minus sign
const coinK = (n: number) => Num.of(n).format();
const skiffCost = () => HIGH.district.skiffCost;
const gradeRole = (l: string): Role => (l === 'S+' || l === 'S' ? 'coin' : l === 'A' ? 'good' : l === 'B' ? 'research' : l === 'C' ? 'warn' : 'bad');
const meterRole = (v: number): Role => (v >= 0.9 ? 'good' : v >= 0.6 ? 'warn' : 'bad');
const icon = (id: string | null | undefined) => (id && id in ITEMS ? `{i:${id}}` : '');

/** The readout every route carries (DESIGN.md §21): `3 skiffs · 1.4/s of 2.1 wanted · 6.2 tiles`. */
export function routeReadout(g: Game, r: SkiffRoute): string {
  const e = routeEnds(g, r);
  const dist = e ? routeDist(e.a, e.b) : 0;
  return `${r.skiffs} skiff${r.skiffs === 1 ? '' : 's'} · ${rate(r.flow)}/s of ${rate(routeWant(g, ID, r))} wanted · ${dist.toFixed(1)} tiles`;
}

/** A thing's short name on the District. */
function nameOf(g: Game, e: FEnt): string {
  return hname(g, e);
}

/** Skiffs a route needs to carry all it is wanted. */
function skiffsNeeded(g: Game, r: SkiffRoute): number {
  const e = routeEnds(g, r);
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
}

/** Why a module is starved of `item`, as a row: no route brings it, a route short of skiffs, or
 *  its feeder making too little. */
function starvedCause(g: Game, e: FEnt, item: string): string {
  const st = g.s.district!;
  const ins = st.routes.filter((r) => r.to === e.id && r.item === item);
  if (!ins.length) return `{bad:no route brings} ${icon(item)} · the Route tool`;
  const short = ins.find((r) => routeShort(g, r));
  if (short) return `{warn:short of skiffs} ${rate(routeCap(g, ID, short))}/s of ${rate(routeWant(g, ID, short))}`;
  const src = hent(g, ID, ins[0].from);
  if (src && src.state !== 'work') return `its feeder is {warn:${src.state}}`;
  return `${icon(item)} by skiff ${rate(ins.reduce((s, r) => s + r.flow, 0))}/s · more than one feeder?`;
}

/** Why a module's `item` backs up, as a row. */
function blockedCause(g: Game, e: FEnt, item: string): string {
  const st = g.s.district!;
  const outs = st.routes.filter((r) => r.from === e.id && r.item === item);
  if (!outs.length) return BYPRODUCTS.has(item) ? `{bad:no route takes} ${icon(item)} · waste blocks it` : `{bad:no route takes} ${icon(item)}`;
  if (outs.some((r) => routeShort(g, r))) {
    const cap = outs.reduce((s, r) => s + routeCap(g, ID, r), 0);
    const made = g.design(e.design)?.outs[item as ItemId] ?? 0;
    return `{warn:short of skiffs} ${rate(cap)}/s of ${rate(made)}/s made`;
  }
  const to = hent(g, ID, outs[0].to);
  return to ? `→ ${nameOf(g, to)} {warn:takes no more}` : '{warn:its route lands nowhere}';
}

/** The report for a thing on the District. */
function entRep(app: App, e: FEnt): DRep {
  const g = app.game;
  const st = g.s.district!;
  const rows: string[] = [];
  const more: string[] = [];
  const inflow = (to: FEnt) => st.routes.filter((r) => r.to === to.id).sort((a, b) => b.flow - a.flow);
  if (e.kind === 'fdock') {
    const ins = inflow(e);
    rows.push('{coin} buys what the skiffs bring');
    if (ins.length) rows.push(ins.slice(0, 4).map((r) => `${icon(r.item)} ${rate(r.flow)}/s`).join('  '));
    else rows.push('{soft:no route lands here yet}');
    const o = g.s.orders.active;
    if (o) more.push('fills the active order first');
    return { title: 'District Dock', uicon: 'orders', rows, more, verbs: '{k:LMB} orders' };
  }
  if (e.kind === 'fhopper') {
    const sel = g.s.research.selected;
    rows.push(sel ? `{u:research} counts toward ${RESEARCH[sel].name}` : '{u:research} {warn:pick research}');
    const ins = inflow(e);
    if (ins.length) rows.push(ins.slice(0, 4).map((r) => `${icon(r.item)} ${rate(r.flow)}/s`).join('  '));
    return { title: 'District Hopper', uicon: 'research', rows, more, verbs: '{k:LMB} inspire' };
  }
  if (e.kind === 'fbay') {
    const mf = districtMegaFrac(g);
    if (!mf) {
      rows.push('{good:every project here stands}');
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
  rows.push(`{chip:${gradeRole(d.grade.letter)}:${d.grade.letter}} rates ×${d.grade.mult.toFixed(2)} · {research:depth 2}`);
  const p = Math.round(e.fAvg * 100);
  if (e.state === 'work') rows.push(`{chip:good:WORKING} ${p}% of full speed`);
  else if (e.state === 'starved') { rows.push(`{chip:warn:STARVED} ${icon(e.why)} · ${p}%`); if (e.why) rows.push(starvedCause(g, e, e.why)); }
  else if (e.state === 'blocked') { rows.push(`{chip:bad:BLOCKED} ${icon(e.why)} backs up`); if (e.why) rows.push(blockedCause(g, e, e.why)); }
  else rows.push('{chip:soft:IDLE}');
  if (e.spill) rows.push(`{chip:warn:SPILLING} ${icon(e.spill)} no route takes it all`);
  const odOn = g.done('overdrive');
  const od = e.od ?? 0, cool = e.cool ?? 0;
  if (odOn && od > 0) rows.push(`{chip:warn:OVERDRIVE ${RULES.overdriveMult.value}x ${Math.ceil(od / TICK_RATE)}s} with its group`);
  else if (odOn && cool > 0) rows.push(`{chip:soft:COOLING ${Math.ceil(cool / TICK_RATE)}s}`);
  const outs = Object.entries(d.outs) as [ItemId, number][];
  rows.push(`out ${outs.map(([k, v]) => `${icon(k)} ${rate(v ?? 0)}/s`).join('  ')}`);
  const ins = Object.entries(d.ins) as [ItemId, number][];
  if (ins.length) more.push(`in ${ins.map(([k, v]) => `${icon(k)} ${rate(v ?? 0)}/s`).join('  ')}`);
  const mine = st.routes.filter((r) => r.from === e.id || r.to === e.id);
  if (!mine.length) more.push('{warn:no routes} · the Route tool joins it');
  const odReady = odOn && !od && !cool;
  return {
    title: d.name, item: mainItem(d), rows, more, routes: mine,
    verbs: `{k:LMB} ${odReady ? `overdrive ${RULES.overdriveMult.value}x ${RULES.overdriveSeconds.value}s` : 'pin'}  {k:X} remove`,
  };
}

/** The report for a route under the mouse. */
function routeRep(app: App, r: SkiffRoute): DRep {
  const g = app.game;
  const e = routeEnds(g, r);
  const rows = [`${e ? nameOf(g, e.a) : '?'} → ${e ? nameOf(g, e.b) : '?'}`, routeReadout(g, r)];
  if (routeShort(g, r)) rows.push(`{warn:short of skiffs} · ${skiffsNeeded(g, r) - r.skiffs} more carry it all`);
  return { title: 'Skiff route', item: r.item, rows, more: [], verbs: '{k:LMB} its card' };
}

interface Laid { rep: DRep; cw: number; w: number; h: number; rows: { lay: RichLayout; h: number; chip: boolean }[]; routesH: number; verbs: RichLayout | null; brief: boolean }

const ROUTE_ROW = 14;

function layRep(rep: DRep, full: boolean, maxCw: number, brief: boolean, close: boolean, maxH = Infinity): Laid {
  let rows = full ? [...rep.rows, ...rep.more] : rep.rows;
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
  const measure = () => titleH + 3 + laid.reduce((s, r) => s + r.h, 0) + (routes.length ? 6 + routes.length * ROUTE_ROW : 0) + (verbs ? verbs.h + 4 : 0);
  // too tall for its room: the route list shortens first, then rows go from the end
  while (tagSize(cw, measure(), 'left').h > maxH && routes.length > 2) routes = routes.slice(0, routes.length - 1);
  while (tagSize(cw, measure(), 'left').h > maxH && laid.length > 2) laid = laid.slice(0, laid.length - 1);
  const sz = tagSize(cw, measure(), 'left');
  return { rep: { ...rep, routes }, cw, w: sz.w, h: sz.h, rows: laid, routesH: routes.length ? 6 + routes.length * ROUTE_ROW : 0, verbs, brief };
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
      const e = routeEnds(g, q);
      const out = e?.a.id === DS.sel;
      const other = e ? (out ? e.b : e.a) : null;
      const short = routeShort(g, q);
      const s = `${out ? '→' : '←'} ${icon(q.item)} ${other ? nameOf(g, other) : '?'} ${short ? `{warn:${rate(q.flow)}/${rate(routeWant(g, ID, q))}}` : `${rate(q.flow)}/s`}`;
      if (button(ui, 'dRouteRow:' + q.id, r.x, yy, L.cw, ROUTE_ROW - 1, '', { active: DS.route === q.id, tip: [{ text: '{big:Skiff route}' }, { text: routeReadout(g, q) }, { text: '{k:LMB} its card' }] })) { DS.route = q.id; }
      ui.clip(r.x + 2, yy, L.cw - 4, ROUTE_ROW);
      drawRich(ui, s, r.x + 3, yy + 2, Infinity, T.ink);
      ui.unclip();
      yy += ROUTE_ROW;
    }
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
  if (DS.hoverRoute !== null) {
    const r = g.s.district?.routes.find((q) => q.id === DS.hoverRoute);
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
  // between the Purse and the lift's District wing (topbar.ts districtWing: 15 px left of the case)
  const x0 = L.purse.x + L.purse.w + 10, x1 = L.lift.x - 15 - 8;
  const w = Math.min(x1 - x0, stripNatural(app));
  return { x: Math.round(x0 + (x1 - x0 - w) / 2), y: 4, w, h: 30 };
}

/** The slip under the strip saying what the tool in hand does (the Route tool, a group). */
function hintOf(app: App, L: Layout): { s: string; r: Rect } | null {
  let s: string;
  if (app.mode.k === 'route') s = DS.from ? '{k:LMB} where it goes · {k:Esc} another source' : '{k:LMB} the module it starts at · {k:Esc} done';
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
  if (app.floor !== 'district' || !app.game.s.district) return [];
  const out = [stripRect(app, L)];
  const lot = lotRect(app);
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
    mk('dRoute', 'Route', 'flow', app.mode.k === 'route', [{ text: '{big:Route}' }, { text: '{k:LMB} a module, then where it goes' }, { text: `a skiff {coin:${coinK(skiffCost())}} · refunded when lifted` }], () => app.setMode(app.mode.k === 'route' ? { k: 'idle' } : { k: 'route' })),
    mk('dRemove', 'Remove', 'remove', app.mode.k === 'remove', [{ text: '{big:Remove}' }, { text: '{k:LMB} a module back to the inventory' }, { text: 'its routes go with it · skiffs refunded' }], () => app.setMode(app.mode.k === 'remove' ? { k: 'idle' } : { k: 'remove' })),
  ];
  if (g.done('districtFolds' as never)) out.push(mk('dFold', 'Fold', 'fold', app.mode.k === 'fold', [{ text: '{big:District fold}' }, { text: '{k:LMB} drag a box over a joined group' }, { text: `up to ${Math.max(HIGH.district.foldMax, prules(g).highFoldMax)}×${Math.max(HIGH.district.foldMax, prules(g).highFoldMax)} · depth 3 · {k:F}` }], () => app.toggleFold()));
  return out;
}

/** Depth-2 designs with spare copies: the groups in hand. */
function groups(app: App) {
  return app.game.s.designs.filter((d) => d.depth === 2 && d.spare > 0);
}

const SLOT = 21;

function stripNatural(app: App): number {
  const ts = tools(app);
  const tw = ts.reduce((s, t) => s + t.w + 3, 0);
  const gs = groups(app);
  const slots = gs.length ? 6 + smallWidth('GROUPS') + 4 + gs.length * (SLOT + 2) : 6 + richWidth('{soft:no spare groups}');
  return 12 + tw + slots;
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
  ui.ctx.fillStyle = T.paperEdge;
  ui.ctx.fillRect(x + 1, y + 1, 1, 18);
  x += 5;
  const gs = groups(app);
  if (!gs.length) {
    drawRich(ui, '{soft:no spare groups}', x, y + 5, Infinity, T.inkSoft);
    ui.hint(x, y, R.x + R.w - x, 20, [{ text: '{big:Groups}' }, { text: 'depth-2 modules go up here' }, { text: 'fold a group on the {u:factory} Factory · stamp copies on the Modules page' }], 210);
    return;
  }
  ui.small('GROUPS', x, y + 7, T.inkSoft);
  x += smallWidth('GROUPS') + 4;
  const room = Math.max(1, Math.floor((R.x + R.w - 4 - x) / (SLOT + 2)));
  const pages = Math.max(1, Math.ceil(gs.length / room));
  const per = pages > 1 ? Math.max(1, room - 1) : room;
  const np = Math.max(1, Math.ceil(gs.length / per));
  DS.page = Math.min(DS.page, np - 1);
  const shown = gs.slice(DS.page * per, DS.page * per + per);
  for (const d of shown) {
    const holding = app.mode.k === 'hmodule' && app.mode.design === d.id;
    const out = mainItem(d);
    const tip: TipLine[] = [
      { text: `{big:${bigSafe(d.name)}}` },
      { text: `{chip:${gradeRole(d.grade.letter)}:${d.grade.letter}} out ${(Object.entries(d.outs) as [ItemId, number][]).map(([k, v]) => `${icon(k)} ${rate(v ?? 0)}/s`).join(' ')}` },
      ...(Object.keys(d.ins).length ? [{ text: `in ${(Object.entries(d.ins) as [ItemId, number][]).map(([k, v]) => `${icon(k)} ${rate(v ?? 0)}/s`).join(' ')}` }] : []),
      { text: `${d.spare} spare · {k:LMB} take one` },
    ];
    if (button(ui, 'dGroup:' + d.id, x, y, SLOT, 20, '', { active: holding, tip })) app.pickModule(d.id);
    const s = hasArt('dist_module') ? sheet('dist_module') : sheet('module');
    ui.ctx.drawImage(s.frames[0], x + 2, y + 1);
    if (out) ui.ctx.drawImage(itemIcon(out), x + 6, y + 1 + (hasArt('dist_module') ? 6 : 4));
    ui.small(String(d.spare), x + SLOT - 2, y + 11, T.ink, { align: 'right' });
    x += SLOT + 2;
  }
  if (np > 1) {
    if (button(ui, 'dGroupsNext', x, y, 12, 20, ICON.right, { tip: `{big:More groups}  page ${DS.page + 1} of ${np}` })) DS.page = (DS.page + 1) % np;
  }
}

/** The next lot's Buy button, standing on the lot east of the floor. */
/** Where the lot's Buy button stands (the lot's lower part: the Dock's and the Hopper's tags hang
 *  over their own tiles, above it), or null when no lot is for sale or it is off the screen. */
function lotRect(app: App): Rect | null {
  const ui = app.ui;
  const g = app.game;
  const price = lotPrice(g, ID);
  if (!price) return null;
  const fw = highW(g, ID), fh = HIGH.district.h;
  const r = worldRect(app, fw, 0, HIGH.district.lotCols, fh);
  if (r.x > ui.w - 8 || r.x + r.w < 8) return null;
  const priceS = `{coin:${price.format()}}`;
  const bw = Math.max(richWidth('Buy lot') + 14, chipWidth(priceS)), bh = 17 + 2 + CHIP_H;
  const x = Math.round(Math.max(4, Math.min(ui.w - bw - 4, r.x + r.w / 2 - bw / 2)));
  const y = Math.round(Math.max(40, Math.min(ui.h - 100, r.y + r.h * 0.72 - bh / 2)));
  return { x, y, w: bw, h: bh };
}

function lotButton(app: App) {
  const ui = app.ui;
  const g = app.game;
  const price = lotPrice(g, ID);
  const R = lotRect(app);
  if (!price || !R) return;
  const can = g.s.coin.gte(price);
  const priceS = `{coin:${price.format()}}`;
  const tip: TipLine[] = [{ text: '{big:A District lot}' }, { text: `${HIGH.district.lotCols} columns × ${HIGH.district.h} · east of the floor` }, { text: can ? `{k:LMB} buy ${priceS}` : `{soft:you have} {coin:${g.s.coin.format()}}` }, { text: '{reset:until Reorganize}' }];
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
    if (button(ui, 'dPick:' + it, R.x, y, R.w, 15, rows[i], { tip: [{ text: `{big:${bigSafe(itemName(it))}}` }, { text: `by skiff to ${nameOf(g, to)}` }, { text: `{k:LMB} fly it · a skiff {coin:${coinK(skiffCost())}}` }] })) {
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
  const r = g.s.district?.routes.find((q) => q.id === id);
  const e = r ? routeEnds(g, r) : null;
  if (!r || !e) { DS.route = null; return; }
  const want = routeWant(g, ID, r);
  const cap = routeCap(g, ID, r);
  const short = routeShort(g, r);
  const per = skiffRateNow(g, ID, routeDist(e.a, e.b));
  const lines = [`${icon(r.item)} ${nameOf(g, e.a)} → ${nameOf(g, e.b)}`, routeReadout(g, r)];
  if (short) lines.push(`{warn:short of skiffs} · ${skiffsNeeded(g, r) - r.skiffs} more carry all ${rate(want)}/s`);
  else if (want > 1e-9 && r.flow < want * 0.9 && e.a.state !== 'work') lines.push(`its source is {warn:${e.a.state}} · skiffs wait on it`);
  lines.push(`{soft:a skiff carries} ${rate(per)}/s {soft:here}` + (r.skiffs > 1 ? ` {soft:· ${r.skiffs} carry} ${rate(cap)}/s` : ''));
  const lays = lines.map((s) => layoutRich(s, 230));
  const plus = `+ skiff {coin:${coinK(skiffCost())}}`;
  const minus = `${MINUS} skiff +${coinK(skiffCost())}`;
  const btnW = [richWidth(plus) + 14, richWidth(minus) + 14, richWidth('Remove route') + 14];
  const cw = Math.max(150, bigWidth('Skiff route') + 28, ...lays.map((l) => l.w), btnW[0] + btnW[1] + 4);
  const ch = BIG_LINE_H + 3 + lays.reduce((s, l) => s + l.h, 0) + 10 + 2 * 19;
  const sz = tagSize(cw, ch, 'left');
  // beside the route's middle, off its two ends
  const mid = worldRect(app, (e.ax + e.bx) / 2 / 16 - 0.5, (e.ay + e.by) / 2 / 16 - 0.5, 1, 1);
  const also = [worldRect(app, e.a.x, e.a.y, e.a.w, e.a.h), worldRect(app, e.b.x, e.b.y, e.b.w, e.b.h)];
  const at = placeWide(app, mid, sz.w, sz.h, also);
  const R = tag(ui, at.x, at.y, sz.w, sz.h, { pin: true, hole: 'left' });
  ui.big('Skiff route', R.x + 2, R.y, T.ink);
  ui.ctx.drawImage(itemIcon(r.item), R.x + R.w - 24, R.y + 1);
  if (button(ui, 'dCloseRoute', R.x + R.w - 12, R.y - 1, 12, 12, '{u:remove}', { tip: 'close {k:Esc}' })) { DS.route = null; return; }
  rule(ui, R.x, R.y + BIG_LINE_H, R.w, true);
  let y = R.y + BIG_LINE_H + 3;
  for (const l of lays) { drawLayout(ui, l, R.x, y, T.ink); y += l.h; }
  meter(ui, R.x, y + 2, R.w, 5, want > 1e-9 ? Math.min(1, r.flow / want) : 1, { role: short ? 'warn' : 'good', target: 0.9, glint: false });
  y += 10;
  const can = g.s.coin.gte(skiffCost());
  const max = HIGH.district.maxSkiffs;
  if (button(ui, 'dSkiffPlus', R.x, y, btnW[0], 17, plus, { gold: can && short, disabled: r.skiffs >= max, tip: [{ text: '{big:One more skiff}' }, { text: `+${rate(per)}/s · ${r.skiffs + 1} skiffs` }, { text: r.skiffs >= max ? `{soft:${max} is the most a route takes}` : `{coin:${coinK(skiffCost())}} · refunded when lifted` }] })) app.act({ k: 'skiff', floor: ID, id: r.id, n: 1 });
  if (button(ui, 'dSkiffMinus', R.x + btnW[0] + 4, y, btnW[1], 17, minus, { disabled: r.skiffs <= 1, tip: [{ text: '{big:One skiff fewer}' }, { text: r.skiffs <= 1 ? '{soft:a route keeps one · remove the route}' : `${MINUS}${rate(per)}/s · {coin:${coinK(skiffCost())}} back` }] })) app.act({ k: 'skiff', floor: ID, id: r.id, n: -1 });
  y += 19;
  if (button(ui, 'dUnroute', R.x, y, btnW[2], 17, 'Remove route', { tip: [{ text: '{big:Remove route}' }, { text: `its ${r.skiffs} skiff${r.skiffs === 1 ? '' : 's'} refunded` }] })) { if (app.act({ k: 'unroute', floor: ID, id: r.id }).ok) DS.route = null; }
  void L;
}

/** The pinned report for a thing on the District, docked on the right (or the left when the right
 *  would sit on it). */
function pinned(app: App, L: Layout) {
  const id = DS.sel;
  if (id === null) return;
  const g = app.game;
  const ui = app.ui;
  const e = hent(g, ID, id);
  if (!e) { DS.sel = null; return; }
  const rep = entRep(app, e);
  const near = worldRect(app, e.x, e.y, e.w, e.h);
  const top = L.slips.y + 18, bot = L.notebook.y - 6;
  const laid = layRep(rep, true, L.wide ? 206 : 198, false, true, bot - top);
  let x = ui.w - 6 - laid.w;
  const y = Math.max(top, Math.min(bot - laid.h, near.y - 10));
  if (near.x + near.w > x - 8) x = Math.max(6, near.x - 12 - laid.w);
  drawRep(app, laid, x, y, { pin: true, close: () => { DS.sel = null; }, blocking: true });
}

/** The District fold's audit: the Inspector's clipboard on a string beside the box (the countdown,
 *  the projected grade, U/W/C as meters), a cross to stop it; once graded, Fold it opens the card. */
function auditClip(app: App) {
  const g = app.game;
  const a = g.s.haudit;
  if (!a || a.floor !== ID) return;
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

/** Everything the District puts on the HUD (no page open): the tool strip, the lot's button, the
 *  audit's clipboard, the route card, the item list, the pinned report. */
export function districtHud(app: App, L: Layout) {
  if (app.floor !== 'district' || !app.game.s.district) return;
  sync(app);
  toolStrip(app, L);
  lotButton(app);
  auditClip(app);
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
  if (!g.s.district) return;
  const W = highW(g, ID), H = HIGH.district.h;
  const inFloor = (p: { x: number; y: number }) => p.x >= 0 && p.y >= 0 && p.x < W && p.y < H;
  // the route under the mouse (not over a thing, not with a tool that places)
  const thing = inFloor(t) ? hentAt(g, ID, t.x, t.y) : null;
  DS.hoverRoute = !overUI && app.mouseIn && !thing && (app.mode.k === 'idle' || app.mode.k === 'remove') ? routeAtWorld(g, w.x, w.y, 3)?.id ?? null : null;
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
    const items = routeItems(g, src, thing);
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
  const res = a.result;
  const mods = a.ids.map((id) => hent(g, a.floor, id)).filter((m): m is FEnt => !!m);
  const bill = mods.reduce((s, m) => s + (g.design(m.design)?.bill ?? 0), 0);
  const inner = (g.s[a.floor]?.routes ?? []).filter((r) => a.ids.includes(r.from) && a.ids.includes(r.to));
  const skiffs = inner.reduce((s, r) => s + r.skiffs, 0);
  const scaled = Object.fromEntries(Object.entries(res.outs).map(([k, v]) => [k, (v ?? 0) * res.grade.mult])) as Partial<Record<ItemId, number>>;
  drawGrade(app, L, {
    res,
    box: a.box,
    title: 'District fold',
    kind: `GROUP ${a.box.w}X${a.box.h}`,
    parts: mods.map((m) => ({
      id: m.id,
      draw: (x: number, y: number) => {
        const s = hasArt('dist_module') ? sheet('dist_module') : sheet('module');
        app.ui.ctx.drawImage(s.frames[0], x, y);
        const out = mainOutput(g, m.design);
        if (out) app.ui.ctx.drawImage(itemIcon(out), x + 4, y + (hasArt('dist_module') ? 6 : 4));
      },
      name: hname(g, m),
      busy: res.busy[m.id] ?? 0,
    })),
    defaultName: defaultName(scaled) + ' III',
    fold: (name) => app.act({ k: 'hfold', name }).ok,
    cancel: () => app.act({ k: 'hauditCancel' }),
    foldRows: [
      `{u:fold} ${mods.length} groups · ${res.boxTiles} tiles → 1 tile`,
      `rates ×${res.grade.mult.toFixed(2)} · depth 3 · for the World floor`,
      `${skiffs} skiff${skiffs === 1 ? '' : 's'} inside refunded {coin:${coinK(skiffs * skiffCost())}}`,
      `copies {coin:${coinK(bill)}} ×1 · ×1.5 · ×2 · …`,
    ],
    bill,
    cancelLabel: 'Keep the group',
    cancelTip: '{big:Keep the group}  audit off · the groups keep flying',
  });
}

void C; void RULES;
