// The Legacy tree's effects (DESIGN.md §22, reset layer 2): buying a node, the rules the sim reads
// through `lrules`, and the commands that set what the automation does (Old Habits' kept nodes, the
// Standing Committee's number, the Town Plan's kept layouts). The automation itself runs in
// src/sim/systems/automation.ts, with the Patent tree's.
import type { Game, ActResult } from './Game';
import { OK, no } from './Game';
import { Num } from '../engine/num';
import { LEGACY, LEGACY_IDS, type LegacyId } from '../data/legacy';
import { PATENTS, type PatentId } from '../data/patents';
import type { WorldId } from '../data/worlds';
import type { State, TownPlan } from './world';
import { applyHeadStarts } from './reorganize';
import { mainItem } from './systems/modules';

export interface LegacyRules {
  /** Patents each new island starts with */
  purse: number;
  /** Patent nodes kept through a Relocate */
  habitSlots: number;
  archive: boolean;
  charts: boolean;
  clerk: boolean;
  standing: boolean;
  regrader: boolean;
  /** District layouts the Town Plan keeps */
  plans: number;
  runners: boolean;
  skiffGuild: boolean;
  drawerAdd: number;
  groupDrawer: boolean;
  soften: Set<WorldId>;
}

const cache = new WeakMap<State, { key: string; r: LegacyRules }>();

/** Every rule a Legacy node changes, as it stands now. */
export function lrules(g: Game): LegacyRules {
  const s = g.s;
  const nodes = s.meta.legacyNodes ?? [];
  const key = nodes.join(',');
  const hit = cache.get(s);
  if (hit && hit.key === key) return hit.r;
  const r: LegacyRules = { purse: 0, habitSlots: 0, archive: false, charts: false, clerk: false, standing: false, regrader: false, plans: 0, runners: false, skiffGuild: false, drawerAdd: 0, groupDrawer: false, soften: new Set() };
  for (const id of nodes) {
    const e = LEGACY[id]?.effect;
    if (!e) continue;
    switch (e.k) {
      case 'purse': r.purse = Math.max(r.purse, e.patents); break;
      case 'habits': r.habitSlots = Math.max(r.habitSlots, e.slots); break;
      case 'archive': r.archive = true; break;
      case 'charts': r.charts = true; break;
      case 'clerk': r.clerk = true; break;
      case 'standing': r.standing = true; break;
      case 'regrader': r.regrader = true; break;
      case 'townPlan': r.plans = Math.max(r.plans, e.plans); break;
      case 'runners': r.runners = true; break;
      case 'skiffGuild': r.skiffGuild = true; break;
      case 'drawer': r.drawerAdd += e.add; break;
      case 'groupDrawer': r.groupDrawer = true; break;
      case 'soften': r.soften.add(e.world); break;
    }
  }
  cache.set(s, { key, r });
  return r;
}

export const hasLegacy = (g: Game, id: LegacyId) => !!g.s.meta.legacyNodes?.includes(id);

/** Why a node can't be bought now, or null. */
export function legacyRefusal(g: Game, id: LegacyId): string | null {
  const d = LEGACY[id];
  if (!d) return 'No such Legacy node';
  if (hasLegacy(g, id)) return 'Already yours';
  const missing = d.requires.filter((q) => !hasLegacy(g, q));
  if (missing.length) return `Needs ${missing.map((q) => LEGACY[q].name).join(' and ')} first`;
  const have = g.s.meta.legacy ?? Num.ZERO;
  if (have.lt(d.cost)) return `Costs ${d.cost} Legacy: you have ${have.format()}`;
  return null;
}

export function buyLegacy(g: Game, id: LegacyId): ActResult {
  const why = legacyRefusal(g, id);
  if (why) return no(why);
  const m = g.s.meta;
  m.legacy = (m.legacy ?? Num.ZERO).sub(LEGACY[id].cost);
  (m.legacyNodes ??= []).push(id);
  // a head start is this run's at once (the Town Archive's research; Standing Charts' Charting)
  applyHeadStarts(g, []);
  g.layoutDirty = true;
  g.bump('legacyNodes');
  g.emit({ type: 'legacy', id, value: LEGACY[id].cost });
  return OK;
}

/** Nodes the player could buy now (prerequisites owned), affordable or not, in tree order. */
export function openLegacy(g: Game): LegacyId[] {
  return LEGACY_IDS.filter((id) => !hasLegacy(g, id) && LEGACY[id].requires.every((q) => hasLegacy(g, q)));
}

/** Old Habits: choose a Patent node to keep through the next Relocate (again: no longer). */
export function setHabit(g: Game, id: PatentId): ActResult {
  const slots = lrules(g).habitSlots;
  if (!slots) return no('Buy Old Habits (a Legacy node) first');
  if (!PATENTS[id]) return no('No such Patent');
  if (!g.s.meta.nodes.includes(id)) return no('Keep a node you own');
  const h = (g.s.meta.habits ??= []);
  const i = h.indexOf(id);
  if (i >= 0) { h.splice(i, 1); return OK; }
  if (h.length >= slots) return no(`Old Habits keeps ${slots}: let one go first`);
  h.push(id);
  return OK;
}

/** The Standing Committee: Reorganize by itself at this many Patents (null: stop). */
export function setStanding(g: Game, at: number | null): ActResult {
  if (!lrules(g).standing) return no('Buy the Standing Committee (a Legacy node) first');
  if (at !== null && (!Number.isInteger(at) || at < 1 || at > 1000)) return no('A whole number of Patents, 1 or more');
  g.s.meta.standing = at;
  return OK;
}

// ------------------------------------------------------------------ the Town Plan

/** Keep the District as it stands as a plan: each module tile named by its product, and its routes. */
export function keepPlan(g: Game, name?: string): ActResult {
  const max = lrules(g).plans;
  if (!max) return no('Buy the Town Plan (a Legacy node) first');
  const st = g.s.district;
  if (!st) return no('The District is not open');
  const m = g.s.meta;
  const plans = (m.plans ??= []);
  if (plans.length >= max) return no(`The Town Plan keeps ${max}: forget one first`);
  const byId = new Map(st.ents.map((e) => [e.id, e]));
  const tiles: TownPlan['tiles'] = [];
  for (const e of st.ents) {
    if (e.kind !== 'module') continue;
    const d = g.design(e.design);
    const item = d ? mainItem(d) : null;
    if (d && item) tiles.push({ x: e.x, y: e.y, item, depth: d.depth ?? 1 });
  }
  if (!tiles.length) return no('No groups stand on the District to plan');
  const routes: TownPlan['routes'] = [];
  for (const r of st.routes) {
    const a = byId.get(r.from), b = byId.get(r.to);
    if (a && b) routes.push({ fx: a.x, fy: a.y, tx: b.x, ty: b.y, item: r.item, skiffs: r.skiffs });
  }
  const id = (m.nextPlan ??= 1);
  m.nextPlan = id + 1;
  plans.push({ id, name: (name ?? '').trim().slice(0, 28) || `District plan ${id}`, tiles, routes });
  g.emit({ type: 'keepPlan', value: id });
  return OK;
}

export function forgetPlan(g: Game, id: number): ActResult {
  const m = g.s.meta;
  if (!m.plans?.some((p) => p.id === id)) return no('No such plan');
  m.plans = m.plans.filter((p) => p.id !== id);
  return OK;
}
