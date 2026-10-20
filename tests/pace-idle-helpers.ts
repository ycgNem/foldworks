// Helpers for the idle and offline pace tests (DESIGN.md §16 rule 4, §20; ROADMAP.md Milestone 6's
// exit): at each stage of the Act II bot's run (1 h to 5 h), from the same saved state,
//  - active: what the bot earned in the half hour after the stage (building, Sparks, Overdrive);
//  - idle: the same state left open with no input for 30 min, and on to 8 h (live, tick by tick);
//  - offline: the same state closed for 8 h (runOffline), at the base efficiency 0.5 and at the
//    0.75 ceiling the Night Shift and Patents can reach.
// Rule 4 wants active 1.5-4x idle; pillar 4 wants offline to pay no more than open and idle.
import { restore, checkSave, savePayload } from '../src/sim/snapshot';
import { runOffline } from '../src/sim/offline';
import { IDLE } from '../src/data/idle';
import { TICK_RATE } from '../src/engine/time';
import { act2Run, earnedAt } from './pace-act2-helpers';

export const AWAY = 8 * 3600;
export const ACTIVE_FOR = 30 * 60;

export interface StageRow {
  seed: number;
  hour: number;
  active30: number;
  idle30: number;
  idle8h: number;
  offline8h: number;
  offlineMax8h: number;
  /** wall-clock ms the 8 h offline run took (the replay and its segments) */
  offlineMs: number;
  /** ms a live tick costs at this stage (the background tab's cost is 20 of them a second) */
  tickMs: number;
  /** the save's size (characters) and the ms to check it loads (a backup's rotation, §20) */
  saveChars: number;
  checkMs: number;
  segments: number;
  jams: number;
}

const cache = new Map<string, StageRow>();

export function stageRow(seed: number, hour: number): StageRow {
  const key = seed + ':' + hour;
  const hit = cache.get(key);
  if (hit) return hit;
  const r = act2Run(seed);
  const st = r.stages[hour];
  if (!st) throw new Error(`no snapshot at ${hour} h`);
  const copy = () => restore({ seed, snap: st.snap, snapTick: st.snapTick, log: [], tick: st.snapTick });
  const active30 = earnedAt(r, hour * 3600 + ACTIVE_FOR) - earnedAt(r, hour * 3600);
  // open and idle: no input at all; a hidden tab pauses Sparks the same way, so they are off here too
  const live = copy();
  live.s.visible = false;
  const e0 = live.s.earned.toNumber();
  const tl0 = performance.now();
  live.step(ACTIVE_FOR * TICK_RATE);
  const tickMs = (performance.now() - tl0) / (ACTIVE_FOR * TICK_RATE);
  const idle30 = live.s.earned.toNumber() - e0;
  live.step((AWAY - ACTIVE_FOR) * TICK_RATE);
  const idle8h = live.s.earned.toNumber() - e0;
  const t0 = performance.now();
  const off = runOffline(copy(), AWAY);
  const offlineMs = performance.now() - t0;
  const offMax = runOffline(copy(), AWAY, { eff: IDLE.offlineEffMax.value });
  const save = JSON.stringify(savePayload(copy(), 0));
  const tc = performance.now();
  checkSave(JSON.parse(save));
  const checkMs = performance.now() - tc;
  const row: StageRow = {
    seed, hour, active30, idle30, idle8h,
    offline8h: off.coin.toNumber(), offlineMax8h: offMax.coin.toNumber(),
    offlineMs, segments: off.segments, jams: off.jams, tickMs, saveChars: save.length, checkMs,
  };
  console.log(`[pace] seed ${seed} at ${hour} h: active 30 min ${Math.round(active30)}, idle 30 min ${Math.round(idle30)} (active/idle ${(active30 / idle30).toFixed(2)}); 8 h open and idle ${Math.round(idle8h)}, 8 h offline ${Math.round(row.offline8h)} at 0.5 (${(row.offline8h / idle8h).toFixed(2)} of idle) and ${Math.round(row.offlineMax8h)} at ${IDLE.offlineEffMax.value} (${(row.offlineMax8h / idle8h).toFixed(2)}); active rate / offline rate ${((active30 * 16) / row.offline8h).toFixed(2)}; offline run ${Math.round(offlineMs)} ms, ${off.segments} segments, ${off.jams} jams; a tick ${tickMs.toFixed(4)} ms (hidden tab ${(tickMs * TICK_RATE).toFixed(2)} ms a second); save ${Math.round(save.length / 1024)} KB, checked in ${Math.round(checkMs)} ms`);
  cache.set(key, row);
  return row;
}
