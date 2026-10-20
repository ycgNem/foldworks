// The Patent tree's effects (DESIGN.md §19): buying a node, and every rule the sim reads through
// it. Systems call these instead of reading the RULES a node can change (the fold box, audits,
// heaps, claims, nested folds, Overdrive's cooldown, the stamp growth, module buffers), so a node
// bought is applied everywhere at once. The Committee's reputation rewards are read here too.
// prules(g).offline is the Patents' part of offlineEfficiency(g) (src/sim/offline.ts).
import type { Game, ActResult } from './Game';
import { OK, no } from './Game';
import { Num } from '../engine/num';
import { RULES } from '../data/rules';
import { BUILD } from '../data/machines';
import { PATENTS, PATENT_IDS, type PatentEffect, type PatentId } from '../data/patents';
import type { State } from './world';
import { applyHeadStarts } from './reorganize';

export interface PatentRules {
  foldMax: number;
  auditWarmup: number;
  auditWindow: number;
  maxAudits: number;
  sideIntake: boolean;
  heapCap: number;
  extraClaims: number;
  nestedMax: number;
  overdriveCool: number;
  stampGrowth: number;
  moduleBuffer: number;
  shovelEvery: number;
  lab: boolean;
  clerk: boolean;
  stampPressEvery: number;
  drones: number;
  offline: number;
  /** the Committee's rewards (reputation, kept across runs) */
  nightCrew: boolean;
  kitsOff: number;
}

const cache = new WeakMap<State, { key: string; r: PatentRules }>();

/** Every rule a Patent node (or the Committee's reputation) changes, as it stands now. */
export function prules(g: Game): PatentRules {
  const s = g.s;
  const rep = s.orders.rep.committee ?? 0;
  const key = s.meta.nodes.length + ':' + rep;
  const hit = cache.get(s);
  if (hit && hit.key === key) return hit.r;
  const r: PatentRules = {
    foldMax: RULES.foldMax.value,
    auditWarmup: RULES.auditWarmup.value,
    auditWindow: RULES.auditWindow.value,
    maxAudits: RULES.maxAudits.value,
    sideIntake: false,
    heapCap: BUILD.heap.capacity ?? 400,
    extraClaims: 0,
    nestedMax: RULES.nestedMax.value,
    overdriveCool: RULES.overdriveCool.value,
    stampGrowth: RULES.stampGrowth.value,
    moduleBuffer: rep >= 1 ? RULES.coatBuffer.value : RULES.moduleBuffer.value,
    shovelEvery: 0,
    lab: false,
    clerk: false,
    stampPressEvery: 0,
    drones: 0,
    offline: RULES.offlineEff.value,
    nightCrew: rep >= 2,
    kitsOff: rep >= 3 ? RULES.pocketedKits.value : 0,
  };
  for (const id of s.meta.nodes) {
    const e: PatentEffect | undefined = PATENTS[id]?.effect;
    if (!e) continue;
    switch (e.k) {
      case 'foldMax': r.foldMax = Math.max(r.foldMax, e.value); break;
      case 'audit': r.auditWarmup = Math.min(r.auditWarmup, e.warmup); r.auditWindow = Math.min(r.auditWindow, e.span); break;
      case 'maxAudits': r.maxAudits = Math.max(r.maxAudits, e.value); break;
      case 'sideIntake': r.sideIntake = true; break;
      case 'heapCap': r.heapCap = Math.max(r.heapCap, e.value); break;
      case 'claims': r.extraClaims += e.value; break;
      case 'nestedMax': r.nestedMax = Math.max(r.nestedMax, e.value); break;
      case 'overdriveCool': r.overdriveCool = Math.min(r.overdriveCool, e.value); break;
      case 'stampGrowth': r.stampGrowth = Math.min(r.stampGrowth, e.value); break;
      case 'shovel': r.shovelEvery = r.shovelEvery ? Math.min(r.shovelEvery, e.every) : e.every; break;
      case 'lab': r.lab = true; break;
      case 'clerk': r.clerk = true; break;
      case 'stampPress': r.stampPressEvery = r.stampPressEvery ? Math.min(r.stampPressEvery, e.every) : e.every; break;
      case 'drone': r.drones = Math.max(r.drones, e.n); break;
      case 'offline': r.offline += e.add; break;
      case 'head': break;
    }
  }
  // the ceiling of ROADMAP Milestone 5 (rounding: 0.5 + 0.1 + 0.08 + 0.07)
  r.offline = Math.min(0.75, Math.round(r.offline * 1000) / 1000);
  cache.set(s, { key, r });
  return r;
}

/** Offline efficiency (DESIGN.md §12, §19): 0.5, raised by the Night Shift nodes to 0.75. */
/** The offline efficiency with every source counted (Patents, the Night Shift) lives in
 * src/sim/offline.ts, `offlineEfficiency(g)`; `prules(g).offline` is the Patents' part. */

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
