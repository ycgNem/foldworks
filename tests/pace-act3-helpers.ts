// Helpers for the Act III pace tests (DESIGN.md §16, §21; ROADMAP.md Milestone 7's exit: rules 1, 2
// and 5 hold to 40 h for the planner bot; a District with 20+ modules runs inside the performance
// budget). The campaign bot (src/sim/campaign.ts) plays from a fresh game to 40 h of play: the Act I
// planner, the Act II policy, the Act III policy (src/sim/bot3.ts) once the Great Drill's stage 3
// stands, resetting when the Reorganize preview stalls. Everything the tests read is recorded here
// in play time (seconds since tick 0), and the save is written at 1, 5, 15, 30 and 40 h as export
// strings for the second gate (e2e/out/checkpoints/seed<seed>-<h>h.txt, the in-game import's format).
import { mkdirSync, writeFileSync } from 'node:fs';
import { Game } from '../src/sim/Game';
import { playCampaign, type RunLog } from '../src/sim/campaign';
import { TICK_RATE } from '../src/engine/time';
import { exportString } from '../src/engine/save';
import { savePayload, takeSnapshot, restore } from '../src/sim/snapshot';
import { previewPatents } from '../src/sim/reorganize';
import { routeCap, routeWant } from '../src/sim/systems/high';

export const H = 3600;
export const HORIZON = 40 * H;
/** the hours a checkpoint save is written at (the second gate's, ROADMAP.md Milestone 8) */
export const CHECKPOINTS = [1, 5, 15, 30, 40];

export interface Act3Record {
  seed: number;
  logs: RunLog[];
  /** play time (s) of the first District opening, of each Megaproject #2-#3 stage, of each run's
   * Act III hand-over */
  districtAt: number | null;
  stages: { id: string; stage: number; at: number }[];
  act3At: number[];
  /** every decision and what it was, in play time */
  decisions: number[];
  what: string[];
  /** District modules, routes, routes between modules, skiffs on routes, lots bought and routes
   * carrying under 90% of their want and the most skiffs on one route, sampled each minute */
  districtByMin: { t: number; modules: number; routes: number; between: number; skiffs: number; lots: number; short: number; most: number }[];
  /** District folds (depth 3) made over the campaign, and depth-3 modules standing at 40 h */
  districtFolds: number;
  foldsAt40: number;
  /** the most of each over the campaign, and at 40 h */
  maxModules: number;
  modulesAt40: number;
  /** Patents preview each minute, play time */
  previewByMin: { t: number; p: number }[];
  /** the game's state when its District was biggest (the perf case) */
  final: { snap: string; snapTick: number };
  /** clicks a second at most, over every run */
  clicksPerSecMax: number;
  wallMs: number;
}

const cache = new Map<number, Act3Record>();

/** Play (or return the cached) 40 h campaign on a seed. */
export function act3Campaign(seed: number, opts: { checkpoints?: boolean } = {}): Act3Record {
  const hit = cache.get(seed);
  if (hit) return hit;
  const t0 = Date.now();
  const g = new Game(seed);
  let districtAt: number | null = null;
  const stages: Act3Record['stages'] = [];
  const seen: Record<string, number> = {};
  const districtByMin: Act3Record['districtByMin'] = [];
  const previewByMin: Act3Record['previewByMin'] = [];
  let maxModules = 0;
  let biggest: { snap: string; snapTick: number } | null = null;
  // (the counter is the run's: its rises are summed over the campaign)
  let folds = 0, foldsSeen = 0;
  if (opts.checkpoints) mkdirSync('e2e/out/checkpoints', { recursive: true });
  const logs = playCampaign(g, {
    runs: 40,
    cap: (r) => (r === 1 ? 6 * H : 12 * H),
    minPatents: (r) => (r === 1 ? 12 : 4),
    horizon: HORIZON,
    act3: true,
    onSecond: (gg) => {
      const t = gg.s.tick / TICK_RATE;
      if (districtAt === null && gg.s.district) districtAt = t;
      for (const id of ['city', 'transmuter'] as const) {
        const st = gg.s.megas?.[id]?.stage ?? 0;
        if (st > (seen[id] ?? 0)) { seen[id] = st; stages.push({ id, stage: st, at: t }); }
      }
      if (t % 60 === 0) {
        const d = gg.s.district;
        const mods = d ? d.ents.filter((e) => e.kind === 'module') : [];
        const ids = new Set(mods.map((m) => m.id));
        const routes = d?.routes ?? [];
        const short = routes.filter((r) => { const w = routeWant(gg, 'district', r); return w > 1e-6 && routeCap(gg, 'district', r) / w < 0.9; }).length;
        districtByMin.push({ t, modules: mods.length, routes: routes.length, between: routes.filter((r) => ids.has(r.to)).length, skiffs: routes.reduce((n, r) => n + r.skiffs, 0), lots: d?.lots ?? 0, short, most: Math.max(0, ...routes.map((r) => r.skiffs)) });
        if (mods.length > maxModules) { maxModules = mods.length; biggest = takeSnapshot(gg); }
        previewByMin.push({ t, p: previewPatents(gg).total });
      }
      const fc = gg.s.counters.districtFolds ?? 0;
      if (fc > foldsSeen) folds += fc - foldsSeen;
      foldsSeen = fc;
      if (opts.checkpoints && CHECKPOINTS.includes(t / H)) writeFileSync(`e2e/out/checkpoints/seed${seed}-${t / H}h.txt`, exportString(savePayload(gg, 0)));
    },
  });
  const decisions: number[] = [], what: string[] = [], act3At: number[] = [];
  const clicks: number[] = [];
  for (const l of logs) {
    l.decisions.forEach((t, i) => { decisions.push(l.start + t); what.push(l.what[i] ?? ''); });
    if (l.act3 >= 0) act3At.push(l.start + l.act3);
    for (const c of l.clicks) clicks.push(c);
  }
  clicks.sort((a, b) => a - b);
  let maxRate = 0;
  for (let i = 0, j = 0; i < clicks.length; i++) {
    while (clicks[i] - clicks[j] >= 1) j++;
    maxRate = Math.max(maxRate, i - j + 1);
  }
  const last = districtByMin[districtByMin.length - 1];
  const rec: Act3Record = {
    seed, logs, districtAt, stages, act3At, decisions, what, districtByMin, maxModules, modulesAt40: last?.modules ?? 0,
    districtFolds: folds, foldsAt40: (g.s.district?.ents ?? []).filter((e) => e.kind === 'module' && (g.design(e.design)?.depth ?? 0) === 3).length,
    previewByMin, final: biggest ?? takeSnapshot(g), clicksPerSecMax: maxRate, wallMs: Date.now() - t0,
  };
  cache.set(seed, rec);
  return rec;
}

/** The longest gap (s) between times in [from, to]. */
export function longestGap(times: number[], from: number, to: number): { gap: number; at: number } {
  const ts = times.filter((t) => t >= from && t <= to).sort((a, b) => a - b);
  let prev = from, best = { gap: 0, at: from };
  for (const t of [...ts, to]) {
    if (t - prev > best.gap) best = { gap: t - prev, at: prev };
    prev = t;
  }
  return best;
}

/** ms a tick costs on the state with the biggest District, over `ticks` ticks (the perf case). */
export function tickCost(r: Act3Record, ticks = 20 * 60 * 5): number {
  const g = restore({ seed: r.seed, snap: r.final.snap, snapTick: r.final.snapTick, log: [], tick: r.final.snapTick });
  g.step(TICK_RATE * 10);
  const t0 = performance.now();
  g.step(ticks);
  return (performance.now() - t0) / ticks;
}

export const hmm = (sec: number | null | undefined) =>
  sec === undefined || sec === null ? 'never' : `${Math.floor(sec / 3600)}:${String(Math.floor((sec % 3600) / 60)).padStart(2, '0')}`;
