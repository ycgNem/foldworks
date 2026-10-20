// DESIGN.md §13 check 12, offline (rewritten with §12's hour-long replay): 8 h away after the slice
// end pays no more than
//  (a) leaving the game open and idle for the same 8 h: the same state, run live tick by tick with
//      no inputs (no clicks, no Sparks caught, nothing rebuilt when a heap fills), and
//  (b) 4.5 h of the planner's measured active rate: the first hour replayed in full plus 7 h at
//      the offline efficiency 0.5 (§12).
// The planner plays to its slice end, then 10 more minutes (its coin per hour over those minutes
// is the active rate); that state is saved, and both the offline run (runOffline, §12) and the
// live idle run start from a copy of it.
import { describe, expect, it } from 'vitest';
import { play, SEEDS, spread } from './pace-helpers';
import { runOffline } from '../src/sim/offline';
import { restore } from '../src/sim/snapshot';
import { TICK_RATE } from '../src/engine/time';
import type { Game } from '../src/sim/Game';

const AWAY = 8 * 3600;

const copy = (g: Game) => restore({ seed: g.s.seed, snap: JSON.stringify(g.s), snapTick: g.s.tick, log: [], tick: g.s.tick });

describe('pace: offline is honest (§13 check 12)', () => {
  const rows: { active: number; idle: number; offline: number }[] = [];
  for (const seed of SEEDS.slice(0, 2)) {
    const { g, bot } = play(seed, 'planner', 75 * 60, (_g, b) => b.log.at.sliceEnd !== undefined);
    const e0 = g.s.earned.toNumber();
    for (let i = 0; i < 10 * 60 * TICK_RATE; i++) {
      bot.update();
      g.tick();
    }
    const active = (g.s.earned.toNumber() - e0) * 6;
    const off = copy(g);
    const offline = runOffline(off, AWAY).coin.toNumber();
    const live = copy(g);
    const i0 = live.s.earned.toNumber();
    live.step(AWAY * TICK_RATE);
    const idle = live.s.earned.toNumber() - i0;
    rows.push({ active, idle, offline });
    console.log(`[pace] seed ${seed}: active ${Math.round(active)} coin/h; 8 h offline ${Math.round(offline)} = ${(offline / active).toFixed(2)} h active; 8 h open and idle ${Math.round(idle)} (offline / idle ${(offline / idle).toFixed(2)})`);
  }
  const hours = spread(rows.map((r) => r.offline / r.active));
  const vsIdle = spread(rows.map((r) => r.offline / r.idle));
  console.log(`[pace] 8 h offline = ${hours.mean.toFixed(2)} h of active earning (max ${hours.max.toFixed(2)}; target <= 4.5), ${vsIdle.mean.toFixed(2)} of 8 h open and idle (max ${vsIdle.max.toFixed(2)}; target <= 1)`);

  it('offline pays something', () => {
    expect(hours.min).toBeGreaterThan(0.5);
  });
  it('8 h offline pays no more than 8 h open and idle (a)', () => {
    expect(vsIdle.max).toBeLessThanOrEqual(1);
  });
  it('8 h offline pays no more than 4.5 h of the active rate (b)', () => {
    expect(hours.max).toBeLessThanOrEqual(4.5);
  });
});
