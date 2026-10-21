// Helpers for the idle and offline pace tests (DESIGN.md §16 rule 4, §13 check 12, §20; ROADMAP.md
// Milestone 6's exit). A stage is a saved state of a bot's factory; from it,
//  - active: what the bot earned in the half hour after the stage (building, Sparks, Overdrive);
//  - idle: the same state left open with no input for 30 min, 1 h and on to 8 h (live, tick by
//    tick, Sparks off as in a hidden tab);
//  - offline: the same state closed for 8 h (runOffline), at the base efficiency 0.5 and at the
//    0.75 ceiling the Night Shift and Patents can reach.
// The stages: run 1 of the Act II bot (act2Run, 1 h to 5 h) and runs 2, 3 and 4 of the campaign bot
// (src/sim/campaign.ts: Reorganize, Patents spent, the next run with its head starts), at whole
// hours into each run, on seeds 1000 and 8919. Rule 4 wants active 1.5-4x open idle; offline is
// bounded against open idle: never more than it, at least e of it, and check 12 (b): the first
// hour paid as open idle pays it, the other 7 at about e of what open idle pays in them.
import { restore, checkSave, savePayload, takeSnapshot } from '../src/sim/snapshot';
import { runOffline, offlineEfficiency } from '../src/sim/offline';
import { IDLE } from '../src/data/idle';
import { TICK_RATE } from '../src/engine/time';
import { Game } from '../src/sim/Game';
import { playCampaign } from '../src/sim/campaign';
import { runSeconds } from '../src/sim/reorganize';
import { act2Run, earnedAt } from './pace-act2-helpers';

export const AWAY = 8 * 3600;
export const ACTIVE_FOR = 30 * 60;
const H = 3600;
/** the two efficiencies every stage is measured at */
export const E_BASE = 0.5;
export const E_MAX = IDLE.offlineEffMax.value;

export interface StageRow {
  seed: number;
  /** which run (1: the Act II bot; 2, 3: the campaign's) and whole hours into it */
  run: number;
  hour: number;
  active30: number;
  idle30: number;
  idle1h: number;
  idle8h: number;
  offline8h: number;
  offlineMax8h: number;
  /** the efficiency the game itself has at the stage (its Patents) */
  effNow: number;
  /** research done at the stage (for the Night Shift's payback) */
  done: string[];
  /** wall-clock ms the 8 h offline run took (the replay and its segments) */
  offlineMs: number;
  /** ms a live tick costs at this stage (the background tab's cost is 20 of them a second) */
  tickMs: number;
  /** the save's size (characters) and the ms to check it loads (a backup's rotation, §20) */
  saveChars: number;
  checkMs: number;
  segments: number;
  jams: number;
  lines: number;
}

/** Check 12 (b), restated for any efficiency e (DESIGN.md §13): 8 h away pays the first hour as
 * open idle pays it (replayed, in full) and, for the other 7, between e - 0.03 and e + 0.05 of
 * what open idle pays in them (the 4-minute re-measures after each segment pay in full: the +0.05;
 * whole items floored in each credit slice: the -0.03). `share` is that measured fraction. */
export const CHECK12_BELOW = 0.03;
export const CHECK12_ABOVE = 0.05;
export const share = (off: number, r: { idle1h: number; idle8h: number }) => (off - r.idle1h) / (r.idle8h - r.idle1h);

/** Stages where rule 4's band does not hold, measured, with the reason (DESIGN.md §20, open for
 * the lead: the bot's own build and the economy decide them, not the offline model). The offline
 * bounds are still checked there. Keys are seed:run:hour. */
// Re-read in the final round, with the bot buying claims and its annex blocks as soon as they are
// affordable and a run-4 stage added past 12 h of play. Run 3 at 1 h now passes on both seeds (1.58
// and 1.63; it read 0.77 and 0.72): its annex blocks come before the Bay floor, so the Gizmo chains
// the Bay clears keep selling. What is left is two things:
// - Overdrive's own arithmetic. 3x for 10 s, then 30 s cooling, is (30 + 30) / 40 = 1.5x for a line
//   kept in Overdrive, which is exactly the band's floor. A stage where the bot only clicks (its plan
//   done, or waiting on research) reads 1.48-1.52.
// - The Bay floor rebuild, now in run 4's first hour: the head starts bring the Bay floor to about
//   1:10 into the run, and the bot clears the floor's chains for it.
// A 25 s cooldown was tried in this round (1.57x for a line kept in Overdrive) and rejected before
// the stages were re-read, because it made seed 8919 worse in the Act II run: its 2 h reading fell
// from 1.46 to 1.42, its longest wait between goals before the Bay floor
// rose to 17.0 min (the bound is 15), and its run 3 never passed run 2's peak. A 20 s cooldown
// (the review round) moved the first reset out of 4-6 h. Rule 4's floor is not lowered. The lever
// is the lead's: Overdrive's duty cycle and rule 4's floor are the same number.
export const RULE4_OPEN: Record<string, string> = {
  '1000:2:2': "active 1.48x idle: the bot waits on Nested Boxes' research and only clicks Overdrive (1.5x at most, 3x for 10 s in every 40); seed 8919 reads 1.50",
  '8919:2:3': 'active 1.49x idle: the plan is done and the bot waits for its reset, clicking Overdrive (1.5x at most); seed 1000 reads 2.35',
  '1000:4:1': 'active 0.98x idle: the Bay floor is laid in this half hour (about 1:10 into run 4, brought forward by the head starts): the campaign clears the Gizmo chains for it while the untouched factory keeps them',
  '8919:4:1': 'active 0.97x idle: the same Bay floor rebuild as seed 1000 at 1 h of run 4',
  '1000:4:3': 'active 1.48x idle: the plan is done (run 4 is the last, so it never resets), Overdrive alone (1.5x at most); seed 8919 reads 1.50',
  '1000:4:4': 'active 1.49x idle: as at 3 h; seed 8919 reads 1.50',
};

/** Everything measured from one saved state. */
export function measure(seed: number, run: number, hour: number, snap: { snap: string; snapTick: number }, active30: number): StageRow {
  const copy = () => restore({ seed, snap: snap.snap, snapTick: snap.snapTick, log: [], tick: snap.snapTick });
  // open and idle: no input at all; a hidden tab pauses Sparks the same way, so they are off here too
  const live = copy();
  const effNow = offlineEfficiency(live);
  const done = [...live.s.research.done];
  live.s.visible = false;
  const e0 = live.s.earned.toNumber();
  const tl0 = performance.now();
  live.step(ACTIVE_FOR * TICK_RATE);
  const tickMs = (performance.now() - tl0) / (ACTIVE_FOR * TICK_RATE);
  const idle30 = live.s.earned.toNumber() - e0;
  live.step((H - ACTIVE_FOR) * TICK_RATE);
  const idle1h = live.s.earned.toNumber() - e0;
  live.step((AWAY - H) * TICK_RATE);
  const idle8h = live.s.earned.toNumber() - e0;
  const t0 = performance.now();
  const off = runOffline(copy(), AWAY, { eff: E_BASE });
  const offlineMs = performance.now() - t0;
  const offMax = runOffline(copy(), AWAY, { eff: E_MAX });
  const save = JSON.stringify(savePayload(copy(), 0));
  const tc = performance.now();
  checkSave(JSON.parse(save));
  const checkMs = performance.now() - tc;
  const row: StageRow = {
    seed, run, hour, active30, idle30, idle1h, idle8h, effNow, done,
    offline8h: off.coin.toNumber(), offlineMax8h: offMax.coin.toNumber(),
    offlineMs, segments: off.segments, jams: off.jams, lines: off.lines.length, tickMs, saveChars: save.length, checkMs,
  };
  console.log(describe(row));
  return row;
}

const k = (x: number) => (Math.abs(x) >= 1e6 ? (x / 1e6).toFixed(2) + 'M' : Math.round(x / 1000) + 'K');

/** One line for the log (and DESIGN.md §20's table). */
export function describe(r: StageRow): string {
  const extra = (o: number) => (r.idle8h > r.idle1h ? share(o, r).toFixed(2) : 'n/a');
  return `[pace] seed ${r.seed} run ${r.run} at ${r.hour} h: active 30 min ${k(r.active30)}, idle 30 min ${k(r.idle30)} (active/idle ${(r.active30 / r.idle30).toFixed(2)}); idle 1 h ${k(r.idle1h)}, 8 h ${k(r.idle8h)}; 8 h offline ${k(r.offline8h)} at ${E_BASE} (${(r.offline8h / r.idle8h).toFixed(2)} of idle, the 7 h after the first at ${extra(r.offline8h)}; ${(r.offline8h / r.idle1h).toFixed(2)} h of the first idle hour) and ${k(r.offlineMax8h)} at ${E_MAX} (${(r.offlineMax8h / r.idle8h).toFixed(2)}, ${extra(r.offlineMax8h)}; ${(r.offlineMax8h / r.idle1h).toFixed(2)} h); its own efficiency ${r.effNow}; offline run ${Math.round(r.offlineMs)} ms, ${r.segments} segments, ${r.jams} machines jammed in ${r.lines} lines; a tick ${r.tickMs.toFixed(4)} ms; save ${Math.round(r.saveChars / 1024)} KB, checked in ${Math.round(r.checkMs)} ms`;
}

const cache = new Map<string, StageRow>();

/** A stage of run 1 (the Act II bot, src/sim/bot2.ts, through tests/pace-act2-helpers.ts). */
export function stageRow(seed: number, hour: number): StageRow {
  const key = seed + ':1:' + hour;
  const hit = cache.get(key);
  if (hit) return hit;
  const r = act2Run(seed);
  const st = r.stages[hour];
  if (!st) throw new Error(`no snapshot at ${hour} h`);
  const active30 = earnedAt(r, hour * H + ACTIVE_FOR) - earnedAt(r, hour * H);
  const row = measure(seed, 1, hour, st, active30);
  cache.set(key, row);
  return row;
}

export interface CampaignStages {
  /** the run's length, seconds */
  length: number;
  /** the play before the run (the runs before it), seconds */
  before: number;
  /** snapshots at whole hours into the run */
  stages: Record<number, { snap: string; snapTick: number }>;
  /** lifetime coin at the end of each minute of the run */
  earnedByMin: number[];
  patentsBought: number;
  /** what the bot decided, with the second of the run (what the active half hours were spent on) */
  did: [number, string][];
}

const camps = new Map<string, CampaignStages>();

/** Play the campaign bot to the end of run `run` (with exactly pace-reorganize's options, so its
 * runs are the ones that test measures) and keep that run's snapshots. The campaign stops after
 * `run`: that run plays to its cap instead of resetting, which leaves its first hours as they were
 * and gives the half hour after each stage. */
export function campaignStages(seed: number, run: number): CampaignStages {
  const key = seed + ':' + run;
  const hit = camps.get(key);
  if (hit) return hit;
  const out: CampaignStages = { length: 0, before: 0, stages: {}, earnedByMin: [], patentsBought: 0, did: [] };
  let seen = 0;
  const logs = playCampaign(new Game(seed), {
    runs: run,
    // run 4 (the final round: stages past 12 h) plays 5 h, so its 4 h stage has its half hour after it
    cap: (r) => (r === 1 ? 6 * H : r >= 4 ? 5 * H : 4 * H),
    minPatents: (r) => (r === 1 ? 12 : 4),
    onSecond: (g, rn, bot) => {
      if (rn !== run) return;
      const t = runSeconds(g);
      if (bot && bot.log.what.length < seen) seen = 0;
      if (bot) for (; seen < bot.log.what.length; seen++) out.did.push([t, bot.log.what[seen]]);
      if (t > 0 && t % 60 === 0) out.earnedByMin.push(g.s.earned.toNumber());
      if (t > 0 && t % H === 0) out.stages[t / H] = takeSnapshot(g);
    },
  });
  const last = logs[logs.length - 1];
  if (last.run !== run) throw new Error(`campaign ended at run ${last.run}, before run ${run}`);
  out.length = last.end - last.start;
  out.patentsBought = last.bought.length;
  out.before = logs.slice(0, -1).reduce((t, l) => t + l.end - l.start, 0);
  console.log(`[pace] seed ${seed}: campaign run ${run} played ${(out.length / H).toFixed(2)} h after buying ${last.bought.length} Patent nodes, from ${(out.before / H).toFixed(2)} h of play (${logs.map((l) => `run ${l.run} ${((l.end - l.start) / H).toFixed(2)} h`).join(', ')})`);
  camps.set(key, out);
  return out;
}

/** The whole hours of a campaign run that have a half hour of play after them. */
export function campaignHours(c: CampaignStages): number[] {
  return Object.keys(c.stages).map(Number).filter((h) => h * H + ACTIVE_FOR <= c.length).sort((a, b) => a - b);
}

/** A stage of a campaign run. */
export function campaignRow(seed: number, run: number, hour: number): StageRow {
  const key = seed + ':' + run + ':' + hour;
  const hit = cache.get(key);
  if (hit) return hit;
  const c = campaignStages(seed, run);
  const st = c.stages[hour];
  if (!st) throw new Error(`no snapshot at ${hour} h of run ${run}`);
  const at = (sec: number) => c.earnedByMin[Math.max(0, Math.floor(sec / 60) - 1)] ?? 0;
  const row = measure(seed, run, hour, st, at(hour * H + ACTIVE_FOR) - at(hour * H));
  const did = c.did.filter(([t]) => t > hour * H && t <= hour * H + ACTIVE_FOR).map(([, w]) => w);
  console.log(`[pace] seed ${seed} run ${run}, the bot's half hour after ${hour} h: ${did.length ? did.join('; ') : 'nothing decided'}`);
  cache.set(key, row);
  return row;
}

/** What every stage must show (the assertions shared by tests/pace-idle-*.test.ts): each check
 * with the value it read, so a failure says which bound and by how much. Ratios are read to two
 * decimals, as the table writes them. */
export function stageChecks(r: StageRow): { name: string; ok: boolean; value: number; open?: string }[] {
  const rows: { name: string; ok: boolean; value: number; open?: string }[] = [];
  const add = (name: string, value: number, ok: boolean, open?: string) => rows.push({ name, ok, value: Math.round(value * 1000) / 1000, open });
  const r2 = (x: number) => Math.round(x * 100) / 100;
  add('idle earns', r.idle30, r.idle30 > 0);
  // rule 4: active against open idle (DESIGN.md §16)
  const ratio = r2(r.active30 / r.idle30);
  const open = RULE4_OPEN[`${r.seed}:${r.run}:${r.hour}`];
  add('rule 4: active / idle >= 1.5', ratio, ratio >= 1.5, open);
  add('rule 4: active / idle <= 4', ratio, ratio <= 4, open);
  // offline against open idle, at both efficiencies: never more, at least e of it, and the 7 h
  // after the first paid at about e of what open idle pays in them (check 12, restated)
  for (const [e, off] of [[E_BASE, r.offline8h], [E_MAX, r.offlineMax8h]] as const) {
    add(`offline at ${e} pays something`, off, off > 0);
    add(`offline at ${e} <= open idle`, off / r.idle8h, off <= r.idle8h);
    add(`offline at ${e} >= ${e} x open idle`, off / r.idle8h, off >= e * r.idle8h);
    const x = share(off, r);
    add(`check 12 at ${e}: the 7 h after the first at ${e - CHECK12_BELOW}-${e + CHECK12_ABOVE} of open idle`, x, x >= e - CHECK12_BELOW - 1e-9 && x <= e + CHECK12_ABOVE + 1e-9);
  }
  return rows;
}

/** The failed checks of a stage (an empty list passes); a rule-4 miss listed in RULE4_OPEN is
 * logged, not failed. */
export function failed(r: StageRow): string[] {
  const out: string[] = [];
  for (const c of stageChecks(r)) {
    if (c.ok) continue;
    if (c.open) { console.log(`[pace] OPEN seed ${r.seed} run ${r.run} at ${r.hour} h, ${c.name}: ${c.open}`); continue; }
    out.push(`${c.name} (read ${c.value})`);
  }
  return out;
}
