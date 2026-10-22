// The Patent tree's effects (DESIGN.md §19): buying a node, and every rule the sim reads through
// it. Systems call these instead of reading the RULES a node can change (the fold box, audits,
// claims, nested folds, stamp counting, module buffers), so a node bought is applied everywhere at
// once. The Committee's reputation rewards are read here too. `heapCap` and `overdriveCool` stay
// for their readers (no node changes them since the Milestone 5 review: they were numbers).
// prules(g).offline is the Patents' part of offlineEfficiency(g) (src/sim/offline.ts).
import type { Game, ActResult } from './Game';
import { OK, no } from './Game';
import { Num } from '../engine/num';
import { RULES } from '../data/rules';
import { BUILD } from '../data/machines';
import { PATENTS, PATENT_IDS, type PatentEffect, type PatentId } from '../data/patents';
import type { State } from './world';
import { applyHeadStarts } from './reorganize';
import { offlineCeiling, offlineEfficiency } from './offline';
import { IDLE } from '../data/idle';
import { CHALLENGES } from '../data/challenges';
import { krules } from './kernels';
import { trules } from './longtail';
import { TROPHY_CAPS } from '../data/trophies';
import { scenarioOf } from './scenario';

export interface PatentRules {
  foldMax: number;
  auditWarmup: number;
  auditWindow: number;
  maxAudits: number;
  sideIntake: boolean;
  heapCap: number;
  /** the Surveyor's Charter: an S or S+ source design holds half a claim a copy */
  halfClaims: boolean;
  nestedMax: number;
  overdriveCool: number;
  /** Fresh Dies: a better-graded refold starts its stamp price over */
  freshDies: boolean;
  moduleBuffer: number;
  shovelEvery: number;
  lab: boolean;
  clerk: boolean;
  stampPressEvery: number;
  /** the Draughtsman: seconds between two queued unfolds (0: none) */
  draughtsmanEvery: number;
  /** the Patent Drawer's slots */
  drawerSlots: number;
  offline: number;
  /** the Committee's rewards (reputation, kept across runs) */
  nightCrew: boolean;
  kitsOff: number;
  /** Act III (DESIGN.md §21): skiff speed added, the District's fold box, the Dispatcher's seconds */
  skiffSpeed: number;
  highFoldMax: number;
  dispatcherEvery: number;
}

const cache = new WeakMap<State, { key: string; r: PatentRules }>();

/** Every rule a Patent node (or the Committee's reputation) changes, as it stands now. */
export function prules(g: Game): PatentRules {
  const s = g.s;
  const rep = s.orders.rep.committee ?? 0;
  const tr = trules(g);
  const key = s.meta.nodes.length + ':' + rep + ':' + (s.challenge ?? '') + ':' + (s.meta.challenges?.length ?? 0) + ':' + (s.meta.kernelNodes?.length ?? 0) + ':' + tr.n + ':' + (s.scenario ?? '');
  const hit = cache.get(s);
  if (hit && hit.key === key) return hit.r;
  const r: PatentRules = {
    foldMax: RULES.foldMax.value,
    auditWarmup: RULES.auditWarmup.value,
    auditWindow: RULES.auditWindow.value,
    maxAudits: RULES.maxAudits.value,
    sideIntake: false,
    heapCap: BUILD.heap.capacity ?? 400,
    halfClaims: false,
    nestedMax: RULES.nestedMax.value,
    overdriveCool: RULES.overdriveCool.value,
    freshDies: false,
    moduleBuffer: rep >= 1 ? RULES.coatBuffer.value : RULES.moduleBuffer.value,
    shovelEvery: 0,
    lab: false,
    clerk: false,
    stampPressEvery: 0,
    draughtsmanEvery: 0,
    drawerSlots: RULES.drawerSlots.value,
    offline: RULES.offlineEff.value,
    nightCrew: rep >= 2,
    kitsOff: rep >= 4 ? RULES.pocketedKits.value : 0,
    skiffSpeed: 0,
    highFoldMax: 0,
    dispatcherEvery: 0,
  };
  for (const id of s.meta.nodes) {
    const e: PatentEffect | undefined = PATENTS[id]?.effect;
    if (!e) continue;
    switch (e.k) {
      case 'foldMax': r.foldMax = Math.max(r.foldMax, e.value); break;
      case 'audit': r.auditWarmup = Math.min(r.auditWarmup, e.warmup); r.auditWindow = Math.min(r.auditWindow, e.span); break;
      case 'maxAudits': r.maxAudits = Math.max(r.maxAudits, e.value); break;
      case 'sideIntake': r.sideIntake = true; break;
      case 'halfClaims': r.halfClaims = true; break;
      case 'nestedMax': r.nestedMax = Math.max(r.nestedMax, e.value); break;
      case 'freshDies': r.freshDies = true; break;
      case 'shovel': r.shovelEvery = r.shovelEvery ? Math.min(r.shovelEvery, e.every) : e.every; break;
      case 'lab': r.lab = true; break;
      case 'clerk': r.clerk = true; break;
      case 'stampPress': r.stampPressEvery = r.stampPressEvery ? Math.min(r.stampPressEvery, e.every) : e.every; break;
      case 'draughtsman': r.draughtsmanEvery = r.draughtsmanEvery ? Math.min(r.draughtsmanEvery, e.every) : e.every; break;
      case 'drawer': r.drawerSlots += e.add; break;
      case 'offline': r.offline += e.add; break;
      case 'skiffSpeed': r.skiffSpeed += e.add; break;
      case 'highFoldMax': r.highFoldMax = Math.max(r.highFoldMax, e.value); break;
      case 'dispatcher': r.dispatcherEvery = r.dispatcherEvery ? Math.min(r.dispatcherEvery, e.every) : e.every; break;
      case 'head': break;
    }
  }
  // Small Boxes (a Challenge, DESIGN.md §21): 4x4 while it is taken; a tile more each way once won
  if (s.meta.challenges?.includes('smallBoxes')) r.foldMax += 1;
  // Three Kinds won: the nested and District boxes a tile larger; Hands Off won: the Dispatcher
  if (s.meta.challenges?.includes('threeKinds')) {
    r.nestedMax += 1;
    r.highFoldMax = Math.max(r.highFoldMax, 8) + 1;
  }
  if (s.meta.challenges?.includes('handsOff')) r.dispatcherEvery = r.dispatcherEvery || 10;
  // the Bigger Box (a Kernel node, DESIGN.md §23): 12x12 (a Challenge's small box still holds)
  r.foldMax = Math.max(r.foldMax, krules(g).foldMax);
  if (s.challenge === 'smallBoxes') r.foldMax = Math.min(r.foldMax, CHALLENGES.smallBoxes.value ?? 4);
  // a Scenario board's box (Pocket Workshop, DESIGN.md §24)
  const board = scenarioOf(g);
  if (board?.foldMax) r.foldMax = Math.min(r.foldMax, board.foldMax);
  // the Trophy Shelf's bonuses (DESIGN.md §24): bigger heaps, a cooler Overdrive, more Drawer slots
  r.heapCap += tr.heap;
  r.overdriveCool = Math.max(RULES.overdriveCool.value - TROPHY_CAPS.cool, r.overdriveCool - tr.cool);
  r.drawerSlots += tr.drawer;
  // the ceiling of ROADMAP Milestone 5 (rounding: 0.5 + 0.05 x 3; the Night Shift's 0.1 is added
  // in offlineEfficiency, src/sim/offline.ts, which caps the sum at 0.75)
  r.offline = Math.min(0.75, Math.round(r.offline * 1000) / 1000);
  cache.set(s, { key, r });
  return r;
}

/** The offline efficiency with every source counted (Patents, the Night Shift) lives in
 * src/sim/offline.ts, `offlineEfficiency(g)`; `prules(g).offline` is 0.5 and the Patents' part. */

export function hasPatent(g: Game, id: PatentId): boolean {
  return g.s.meta.nodes.includes(id);
}

/** Why a node can't be bought now, or null. */
export function patentRefusal(g: Game, id: PatentId): string | null {
  const d = PATENTS[id];
  if (!d) return 'No such Patent';
  if (hasPatent(g, id)) return 'Already yours';
  const missing = d.requires.filter((q) => !hasPatent(g, q));
  if (missing.length) return `Needs ${missing.map((q) => PATENTS[q].name).join(' and ')} first`;
  // an offline node past the 0.75 ceiling would buy nothing (the coin Night Shift may have got there)
  if (d.effect.k === 'offline' && offlineEfficiency(g) >= offlineCeiling(g) - 1e-9) return `Offline efficiency is at its ${Math.round(offlineCeiling(g) * 100)}% ceiling already`;
  if (g.s.meta.patents.lt(d.cost)) return `Costs ${d.cost} Patent${d.cost > 1 ? 's' : ''}: you have ${g.s.meta.patents.format()}`;
  return null;
}

export function buyPatent(g: Game, id: PatentId): ActResult {
  const why = patentRefusal(g, id);
  if (why) return no(why);
  const d = PATENTS[id];
  g.s.meta.patents = g.s.meta.patents.sub(d.cost);
  g.s.meta.nodes.push(id);
  // a head start applies to this run at once too (bought just after a reset, it is this run's)
  if (d.effect.k === 'head') applyHeadStarts(g, [id]);
  g.bump('patentNodes');
  g.emit({ type: 'patent', id, value: d.cost });
  return OK;
}

/** Nodes the player could buy now (prerequisites owned), affordable or not, in tree order. */
export function openPatents(g: Game): PatentId[] {
  return PATENT_IDS.filter((id) => !hasPatent(g, id) && PATENTS[id].requires.every((q) => hasPatent(g, q)));
}

export { Num };
