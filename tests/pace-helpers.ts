// Shared helpers for the pace tests (DESIGN.md §13): run a bot policy over many seeds, summarise
// the times it reached each milestone, and print the Workshop as ASCII for the logs.
import { Game } from '../src/sim/Game';
import { Bot, PLAN, type Policy, type Step } from '../src/sim/bot';
import { TICK_RATE } from '../src/engine/time';
import { DX, DY } from '../src/sim/world';

/** Seeds for the multi-seed checks. Spark timing is the only random part of the slice. */
export const SEEDS = Array.from({ length: 50 }, (_, i) => 1000 + i * 7919);

export interface Run {
  seed: number;
  policy: Policy;
  g: Game;
  bot: Bot;
}

export interface PlayOpts {
  /** keep the full command history (replay checks) */
  history?: boolean;
  /** called after every tick */
  onTick?: (g: Game, b: Bot) => void;
  plan?: Step[];
  shovel?: boolean;
}

/** Play one seed with a policy until `stop` (checked once a second) or `maxSeconds`. */
export function play(seed: number, policy: Policy, maxSeconds: number, stop?: (g: Game, b: Bot) => boolean, o: PlayOpts = {}): Run {
  const g = new Game(seed, { keepHistory: o.history });
  const bot = new Bot(g, policy, o.plan ?? PLAN, { shovel: o.shovel });
  const end = maxSeconds * TICK_RATE;
  while (g.s.tick < end) {
    bot.update();
    g.tick();
    o.onTick?.(g, bot);
    if (stop && g.s.tick % TICK_RATE === 0 && stop(g, bot)) break;
  }
  return { seed, policy, g, bot };
}

/** Runs until a milestone (or the cap) for every seed. */
export function runsUntil(policy: Policy, milestone: string, maxSeconds: number, seeds = SEEDS): Run[] {
  return seeds.map((s) => play(s, policy, maxSeconds, (_g, b) => b.log.at[milestone] !== undefined));
}

/** Stop once the bot has logged Folding (not on the game's state: the bot logs a milestone on its
 * next update, and a stop on the same tick would lose the time). */
export const untilFolding = (_g: Game, b: Bot) => b.log.at['research:folding'] !== undefined;

/** Runs to Folding (or the cap) for every seed, cached per policy so several test files can share
 * them within one worker. */
const cache = new Map<string, Run[]>();
export function runsToFolding(policy: Policy, maxSeconds: number, seeds = SEEDS): Run[] {
  const key = `${policy}:${maxSeconds}:${seeds.join(',')}`;
  let r = cache.get(key);
  if (!r) {
    r = seeds.map((s) => play(s, policy, maxSeconds, untilFolding));
    cache.set(key, r);
  }
  return r;
}

export interface Spread {
  n: number;
  /** how many runs reached it */
  reached: number;
  mean: number;
  min: number;
  max: number;
  p10: number;
  p90: number;
}

/** Summary of a milestone's time (seconds) over runs; runs that never reached it count as `cap`. */
export function spread(times: (number | undefined)[], cap = Infinity): Spread {
  const reached = times.filter((t) => t !== undefined).length;
  const xs = times.map((t) => t ?? cap).sort((a, b) => a - b);
  const q = (f: number) => xs[Math.min(xs.length - 1, Math.floor(f * xs.length))];
  const mean = xs.reduce((a, b) => a + b, 0) / xs.length;
  return { n: xs.length, reached, mean, min: xs[0], max: xs[xs.length - 1], p10: q(0.1), p90: q(0.9) };
}

export const mmss = (sec: number) => (Number.isFinite(sec) ? `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, '0')}` : 'never');

export function describe2(label: string, s: Spread): string {
  return `${label}: mean ${mmss(s.mean)}, min ${mmss(s.min)}, p10 ${mmss(s.p10)}, p90 ${mmss(s.p90)}, max ${mmss(s.max)} (${s.reached}/${s.n} reached)`;
}

/** The milestone time for each run. */
export const at = (runs: Run[], name: string) => runs.map((r) => r.bot.log.at[name]);

/** The longest gap (seconds) between decisions from 0 to `until` (purchases, research, orders). */
export function longestGap(run: Run, until: number): { gap: number; from: number; to: number; after: string } {
  const d = run.bot.log.decisions.filter((t) => t <= until);
  const what = run.bot.log.what;
  let best = { gap: 0, from: 0, to: 0, after: 'start' };
  let prev = 0, prevWhat = 'start';
  for (let i = 0; i <= d.length; i++) {
    const t = i < d.length ? d[i] : until;
    if (t - prev > best.gap) best = { gap: t - prev, from: prev, to: t, after: prevWhat };
    prev = t;
    prevWhat = what[i] ?? '';
  }
  return best;
}

const GLYPH: Record<string, string> = { miner: 'M', smelter: 's', press: 'p', assembler: 'a', heap: 'h', furnace: 'F', dock: 'D', hopper: 'H', splitter: 'S', merger: 'm', crate: 'c' };
const ARROW = ['>', 'v', '<', '^'];

/** The Workshop as ASCII: one character a tile (belts are arrows, ore is `:`, unowned land `~`). */
export function mapText(g: Game, w = 16, h = 8): string {
  const rows: string[] = ['   ' + Array.from({ length: w }, (_, x) => (x % 10).toString()).join('')];
  for (let y = 0; y < h; y++) {
    let row = String(y).padStart(2) + ' ';
    for (let x = 0; x < w; x++) {
      const e = g.entAt(x, y);
      if (e) row += e.kind === 'belt' ? ARROW[e.rot] : GLYPH[e.kind] ?? '?';
      else if (!g.owned(x, y)) row += '~';
      else row += g.oreAt(x, y) ? ':' : '.';
    }
    rows.push(row);
  }
  return rows.join('\n');
}

/** One line per machine: where, what, state, why, and the last minute's history. */
export function machineText(g: Game): string {
  return [...g.miners, ...g.machines]
    .map((m) => `${m.kind}@${m.x},${m.y}${ARROW[m.rot]} ${m.recipe ?? '-'} ${m.state}${m.why ? ':' + m.why : ''} in=${JSON.stringify(m.inBuf)} out=${m.out} by=${m.by} ${m.hist.slice(-30)}`)
    .join('\n');
}

export { DX, DY };

/** Run `policy` over the seeds until `milestone`, log its spread, and return it (DESIGN.md §13:
 * assert the mean, log the spread). */
export function milestone(policy: Policy, name: string, capSeconds: number, seeds = SEEDS): Spread {
  const runs = runsUntil(policy, name, capSeconds, seeds);
  const s = spread(at(runs, name), capSeconds);
  console.log(`[pace] ${policy} ${describe2(name, s)}`);
  return s;
}
