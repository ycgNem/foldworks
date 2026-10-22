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
      for (const id of ['city', 'transmuter', 'lighthouse', 'anchor'] as const) {
        const ms = gg.s.megas?.[id];
        const n = (ms?.done?.length ?? 0) || (ms?.stage ?? 0);
        if (n > (seen[id] ?? 0)) { seen[id] = n; stages.push({ id, stage: n, at: t }); }
      }
      const fc = gg.s.counters.districtFolds ?? 0;
      if (fc > foldsSeen) folds += fc - foldsSeen;
      foldsSeen = fc;
      if (t % 60 === 0) {
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
  const rec: Act4Record = {
    seed, logs, at, relocates, islands, stages, legacy, districtFolds: folds, maxWorld, maxDistrict, decisions, what,
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
