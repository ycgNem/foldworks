// Helpers for the Act IV pace test (DESIGN.md §16, §22 Pacing targets: the first Relocate at about
// 40-45 h, four islands by about 60 h, the island rules holding to 80 h). The campaign bot
// (src/sim/campaign.ts with `act4`) plays a fresh game: the Act I planner, the Act II policy, then
// the Act IV policy (src/sim/bot4.ts, which plays the Act III one, src/sim/bot3.ts) once the Great
// Drill's stage 3 stands, resetting as the Act III campaign does and Relocating when it pays.
// Everything the test reads is recorded here in play time (seconds since tick 0). The horizon is
// FOLD_ACT4_HOURS (default 40: about 25 minutes of wall time on the owner's machine; 80 h is about
// twice that).
import { Game } from '../src/sim/Game';
import { playCampaign, type RunLog } from '../src/sim/campaign';
import { TICK_RATE } from '../src/engine/time';
import { takeSnapshot, restore } from '../src/sim/snapshot';
import { worldOf } from '../src/sim/systems/islands';
import type { WorldId } from '../src/data/worlds';
import { floorBests, previewLegacy, LEGACY_FLOORS } from '../src/sim/relocate';
import { previewPatents } from '../src/sim/reorganize';
import { legacyRefusal } from '../src/sim/legacy';
import { LEGACY_IDS } from '../src/data/legacy';
import { PATENT_IDS } from '../src/data/patents';
import type { Game as G } from '../src/sim/Game';

/** Each floor's best design value this world (DESIGN.md §22: steps x grade x tier), the Legacy
 * preview to the next island, and the Legacy nodes owned and affordable (the critic's asks). */
export interface WorldSnap { at: number; world: WorldId; bests: Record<string, number | null>; preview: number; legacy: number; owned: string[]; affordable: string[] }

export function worldSnap(g: G): WorldSnap {
  const fb = floorBests(g);
  const bests: Record<string, number | null> = {};
  for (const f of LEGACY_FLOORS) bests[f] = fb[f] ? +fb[f]!.value.toFixed(2) : null;
  return {
    at: g.s.tick / TICK_RATE, world: worldOf(g), bests, preview: previewLegacy(g).now, legacy: g.s.meta.legacy?.toNumber() ?? 0,
    owned: [...(g.s.meta.legacyNodes ?? [])], affordable: LEGACY_IDS.filter((id) => !legacyRefusal(g, id)),
  };
}

export const H = 3600;
export const HOURS = Number(process.env.FOLD_ACT4_HOURS ?? 40);
export const HORIZON = HOURS * H;

export interface Act4Record {
  seed: number;
  logs: RunLog[];
  /** play time (s) the research landed (null: never) */
  at: { district: number | null; chemistry: number | null; robotics: number | null; districtFolds: number | null; charting: number | null; world: number | null; relocation: number | null };
  /** each Relocate: when, from, to, Legacy banked */
  relocates: { at: number; from: WorldId; to: WorldId; legacy: number }[];
  /** the first time the town stood on each island */
  islands: { world: WorldId; at: number }[];
  /** each Megaproject stage, in play time */
  stages: { id: string; stage: number; at: number }[];
  /** Legacy nodes bought, in play time */
  legacy: { id: string; at: number }[];
  /** District folds made (depth 3), the most depth-3 modules on the World */
  districtFolds: number;
  maxWorld: number;
  maxDistrict: number;
  /** every decision and what it was, in play time */
  decisions: number[];
  what: string[];
  /** the world's state just before each Relocate, and at the horizon */
  beforeRelocate: WorldSnap[];
  atEnd: WorldSnap;
  /** each island climb: from a Relocate to the World floor opening on the new island (null: never),
   * with the Legacy nodes owned and affordable when the World opened (or at the horizon) */
  climbs: { world: WorldId; from: number; worldAt: number | null; owned: string[]; affordable: string[] }[];
  /** the Patent preview each minute from 30 h, with the Patent nodes owned (of all) */
  patents30: { t: number; p: number; nodes: number }[];
  patentNodes: number;
  /** the state with the biggest World (or District, when no World stood) for the perf case */
  final: { snap: string; snapTick: number };
  wallMs: number;
}

const cache = new Map<number, Act4Record>();

export function act4Campaign(seed: number): Act4Record {
  const hit = cache.get(seed);
  if (hit) return hit;
  const t0 = Date.now();
  const g = new Game(seed);
  const at: Act4Record['at'] = { district: null, chemistry: null, robotics: null, districtFolds: null, charting: null, world: null, relocation: null };
  const stages: Act4Record['stages'] = [];
  const seen: Record<string, number> = {};
  const islands: Act4Record['islands'] = [{ world: 'home', at: 0 }];
  let maxWorld = 0, maxDistrict = 0, worldBest = 0;
  let biggest: { snap: string; snapTick: number } | null = null;
  let folds = 0, foldsSeen = 0;
  let snap: WorldSnap | null = null;
  const beforeRelocate: WorldSnap[] = [];
  const climbs: Act4Record['climbs'] = [];
  let moves = 0;
  const patents30: Act4Record['patents30'] = [];
  const logs = playCampaign(g, {
    runs: 60,
    cap: (r) => (r === 1 ? 6 * H : 12 * H),
    minPatents: (r) => (r === 1 ? 12 : 4),
    horizon: HORIZON,
    act3: true,
    act4: true,
    onSecond: (gg) => {
      const t = gg.s.tick / TICK_RATE;
      if (at.district === null && gg.s.district) at.district = t;
      if (at.world === null && gg.s.world) at.world = t;
      for (const r of ['chemistry', 'robotics', 'districtFolds', 'charting', 'relocation'] as const) if (at[r] === null && gg.done(r)) at[r] = t;
      const w = worldOf(gg);
      if (!islands.some((i) => i.world === w)) islands.push({ world: w, at: t });
      // a Relocate happened since the last second: the snapshot taken just before it is that
      // world's, and the new island's climb starts
      const rel = gg.s.meta.relocations ?? 0;
      if (rel > moves) {
        moves = rel;
        if (snap) beforeRelocate.push(snap);
        climbs.push({ world: w, from: t, worldAt: null, owned: [], affordable: [] });
      }
      const climb = climbs[climbs.length - 1];
      if (climb && climb.worldAt === null && gg.s.world) {
        const ws = worldSnap(gg);
        climb.worldAt = t;
        climb.owned = ws.owned;
        climb.affordable = ws.affordable;
      }
      for (const id of ['city', 'transmuter', 'lighthouse', 'anchor'] as const) {
        const ms = gg.s.megas?.[id];
        const n = (ms?.done?.length ?? 0) || (ms?.stage ?? 0);
        if (n > (seen[id] ?? 0)) { seen[id] = n; stages.push({ id, stage: n, at: t }); }
      }
      const fc = gg.s.counters.districtFolds ?? 0;
      if (fc > foldsSeen) folds += fc - foldsSeen;
      foldsSeen = fc;
      if (t % 60 === 0) {
        snap = worldSnap(gg);
        if (t >= 30 * H) patents30.push({ t, p: +previewPatents(gg).total.toFixed(2), nodes: gg.s.meta.nodes.length });
        const wm = (gg.s.world?.ents ?? []).filter((e) => e.kind === 'module').length;
        const dm = (gg.s.district?.ents ?? []).filter((e) => e.kind === 'module').length;
        maxWorld = Math.max(maxWorld, wm);
        maxDistrict = Math.max(maxDistrict, dm);
        // the perf case: the biggest World, else the biggest District
        const size = wm * 1000 + dm;
        if (size > worldBest) { worldBest = size; biggest = takeSnapshot(gg); }
      }
    },
  });
  const decisions: number[] = [], what: string[] = [];
  const relocates: Act4Record['relocates'] = [];
  const legacy: Act4Record['legacy'] = [];
  for (const l of logs) {
    l.decisions.forEach((t, i) => { decisions.push(l.start + t); what.push(l.what[i] ?? ''); });
    if (l.relocated) relocates.push({ at: l.end, from: l.world, to: l.relocated, legacy: l.legacy ?? 0 });
    for (const id of l.legacyBought ?? []) legacy.push({ id, at: l.start });
  }
  const end = worldSnap(g);
  for (const c of climbs) if (c.worldAt === null) { c.owned = end.owned; c.affordable = end.affordable; }
  const rec: Act4Record = {
    seed, logs, at, relocates, islands, stages, legacy, districtFolds: folds, maxWorld, maxDistrict, decisions, what,
    beforeRelocate, atEnd: end, climbs, patents30, patentNodes: PATENT_IDS.length,
    final: biggest ?? takeSnapshot(g), wallMs: Date.now() - t0,
  };
  cache.set(seed, rec);
  return rec;
}

/** ms a tick costs on the biggest World's state (or the biggest District's), over `ticks` ticks. */
export function tickCost(r: Act4Record, ticks = 20 * 60 * 5): number {
  const g = restore({ seed: r.seed, snap: r.final.snap, snapTick: r.final.snapTick, log: [], tick: r.final.snapTick });
  g.step(TICK_RATE * 10);
  const t0 = performance.now();
  g.step(ticks);
  return (performance.now() - t0) / ticks;
}
