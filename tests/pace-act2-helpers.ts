// Helpers for the Act II pace tests (DESIGN.md §16, §18; ROADMAP.md Milestone 4's exit): play a
// fresh save with the Act I planner to its slice end, then the Act II policy (src/sim/bot2.ts),
// and record what the §16 rules read: milestone times, decisions, lifetime coin by the minute, and
// a snapshot for the active-versus-idle comparison. Runs are cached per seed within a worker.
import { Game } from '../src/sim/Game';
import { Bot } from '../src/sim/bot';
import { playAct2, type Act2Bot } from '../src/sim/bot2';
import { TICK_RATE } from '../src/engine/time';
import { restore, takeSnapshot } from '../src/sim/snapshot';
import { RULES } from '../src/data/rules';

/** Seeds for the Act II runs (Spark timing is the only random part). Two keep the file inside
 * its ~60 s budget; the spread between them is logged. */
export const SEEDS2 = [1000, 8919];

/** How long a run plays (seconds): the Reorganize point is measured at 4 and 5 h; the run goes on
 * half an hour past it so the idle and offline pace tests (Milestone 6) have an active half hour
 * after the 5 h stage too. */
export const HOURS = 5.5;

/** The whole hours a snapshot is kept at, for the idle and offline pace tests (Milestone 6). */
export const STAGES = [1, 2, 3, 4, 5];

/** §15's Reorganize, with the divisor from src/data/rules.ts (its derivation holds the arithmetic). */
export const PATENT_DIVISOR = RULES.patentDivisor.value;
export const patents = (lifetime: number) => Math.floor(Math.pow(lifetime / PATENT_DIVISOR, 0.4));

/** The window §16 rule 4 compares: from this time, for this long (seconds). */
export const RULE4_AT = 2 * 3600;
export const RULE4_FOR = 30 * 60;

export interface Act2Record {
  seed: number;
  /** seconds the planner handed over (the slice's end) */
  handover: number;
  at: Record<string, number>;
  /** planner decisions then Act II decisions, seconds */
  decisions: number[];
  what: string[];
  /** lifetime coin at the end of each minute */
  earnedByMin: number[];
  /** the game state at RULE4_AT, for the idle branch */
  snap: { snap: string; snapTick: number } | null;
  /** the game state at each of STAGES (hours), for the idle and offline pace tests */
  stages: Record<number, { snap: string; snapTick: number }>;
  overdrives: number;
  clicksPerSecMax: number;
  bot: Act2Bot;
  g: Game;
}

const cache = new Map<number, Act2Record>();

export function act2Run(seed: number): Act2Record {
  const hit = cache.get(seed);
  if (hit) return hit;
  const g = new Game(seed);
  const planner = new Bot(g, 'planner');
  const earnedByMin: number[] = [];
  let snap: Act2Record['snap'] = null;
  const stages: Act2Record['stages'] = {};
  const run = playAct2(g, planner, HOURS * 3600, {}, undefined, (gg) => {
    if (gg.s.tick % (60 * TICK_RATE) === 0) earnedByMin.push(gg.s.earned.toNumber());
    if (gg.s.tick === RULE4_AT * TICK_RATE) snap = takeSnapshot(gg);
    for (const h of STAGES) if (gg.s.tick === h * 3600 * TICK_RATE) stages[h] = takeSnapshot(gg);
  });
  const pd = planner.log.decisions.filter((t) => t <= run.handover);
  const pw = planner.log.what.slice(0, pd.length);
  // clicks a second, both bots: the most in any 1 s window
  const clicks = [...planner.log.clicks, ...run.bot.log.clicks].sort((a, b) => a - b);
  let maxRate = 0;
  for (let i = 0, j = 0; i < clicks.length; i++) {
    while (clicks[i] - clicks[j] >= TICK_RATE) j++;
    maxRate = Math.max(maxRate, i - j + 1);
  }
  const rec: Act2Record = {
    seed,
    handover: run.handover,
    at: { ...planner.log.at, ...run.bot.log.at },
    decisions: [...pd, ...run.bot.log.decisions],
    what: [...pw, ...run.bot.log.what],
    earnedByMin,
    snap,
    stages,
    overdrives: run.bot.log.overdrives.length,
    clicksPerSecMax: maxRate,
    bot: run.bot,
    g,
  };
  cache.set(seed, rec);
  return rec;
}

/** Lifetime coin at `sec` (the minute mark at or before it). */
export function earnedAt(r: Act2Record, sec: number): number {
  return r.earnedByMin[Math.max(0, Math.floor(sec / 60) - 1)] ?? 0;
}

/** Coin an idle player earns over the rule-4 window from the same state: no clicks, no building. */
export function idleEarned(r: Act2Record): number {
  if (!r.snap) return 0;
  const g = restore({ seed: r.seed, snap: r.snap.snap, snapTick: r.snap.snapTick, log: [], tick: r.snap.snapTick });
  const e0 = g.s.earned.toNumber();
  g.step(RULE4_FOR * TICK_RATE);
  return g.s.earned.toNumber() - e0;
}

/** The longest gap (seconds) between decisions in [from, to]. */
export function longestGap(times: number[], from: number, to: number): { gap: number; at: number } {
  const ts = times.filter((t) => t >= from && t <= to).sort((a, b) => a - b);
  let prev = from, best = { gap: 0, at: from };
  for (const t of [...ts, to]) {
    if (t - prev > best.gap) best = { gap: t - prev, at: prev };
    prev = t;
  }
  return best;
}

export const hmm = (sec: number | undefined) =>
  sec === undefined ? 'never' : `${Math.floor(sec / 3600)}:${String(Math.floor((sec % 3600) / 60)).padStart(2, '0')}`;
