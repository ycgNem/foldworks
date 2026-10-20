// DESIGN.md §13 check 12, offline at the slice end (restated in the Milestone 5-6 review round for
// any efficiency e, and measured at 0.5 and at the 0.75 ceiling): 8 h away after the slice end pays
//  (a) no more than leaving the game open and idle for the same 8 h, measured by a live run of the
//      bot's state with no inputs (no clicks, no Sparks caught, nothing rebuilt when a heap fills),
//      and at least e of it;
//  (b) the first hour as open idle pays it (it is replayed in full) and, for the other 7, between
//      e - 0.03 and e + 0.05 of what open idle pays in them. At e = 0.5 this is the slice's old
//      "4.5 h of the active rate" (1 h + 7 h x 0.5) with the factory's own idle hours in place of
//      the planner's active rate: at the 0.75 ceiling that bound read 5.52 h and no longer meant
//      anything (DECISIONS.md, the review round).
// Rule 4 at the slice end, active against open idle: the planner's 10 minutes after its slice end
// against the same 10 minutes open and idle.
// The planner plays to its slice end, then 10 more minutes; that state is saved, and the offline
// runs (runOffline, §12) and the live idle run start from a copy of it.
import { describe, expect, it } from 'vitest';
import { play, SEEDS, spread } from './pace-helpers';
import { runOffline } from '../src/sim/offline';
import { restore } from '../src/sim/snapshot';
import { TICK_RATE } from '../src/engine/time';
import type { Game } from '../src/sim/Game';
import { CHECK12_ABOVE, CHECK12_BELOW, E_BASE, E_MAX, share } from './pace-idle-helpers';

const AWAY = 8 * 3600;

const copy = (g: Game) => restore({ seed: g.s.seed, snap: JSON.stringify(g.s), snapTick: g.s.tick, log: [], tick: g.s.tick });

describe('pace: offline is honest at the slice end (§13 check 12)', () => {
  const rows: { active: number; idle10: number; idle1h: number; idle8h: number; off: number; offMax: number }[] = [];
  for (const seed of SEEDS.slice(0, 2)) {
    const { g, bot } = play(seed, 'planner', 75 * 60, (_g, b) => b.log.at.sliceEnd !== undefined);
    const snap = copy(g);
    const e0 = g.s.earned.toNumber();
    for (let i = 0; i < 10 * 60 * TICK_RATE; i++) {
      bot.update();
      g.tick();
    }
    const active = (g.s.earned.toNumber() - e0) * 6;
    const off = runOffline(copy(snap), AWAY, { eff: E_BASE }).coin.toNumber();
    const offMax = runOffline(copy(snap), AWAY, { eff: E_MAX }).coin.toNumber();
    const live = copy(snap);
    live.s.visible = false;
    const i0 = live.s.earned.toNumber();
    live.step(10 * 60 * TICK_RATE);
    const idle10 = live.s.earned.toNumber() - i0;
    live.step(50 * 60 * TICK_RATE);
    const idle1h = live.s.earned.toNumber() - i0;
    live.step((AWAY - 3600) * TICK_RATE);
    const idle8h = live.s.earned.toNumber() - i0;
    const r = { active, idle10, idle1h, idle8h, off, offMax };
    rows.push(r);
    console.log(`[pace] slice end, seed ${seed}: active ${Math.round(active)} coin/h, active / idle (10 min) ${(active / 6 / idle10).toFixed(2)}; open idle 1 h ${Math.round(idle1h)}, 8 h ${Math.round(idle8h)}; 8 h offline at ${E_BASE} ${Math.round(off)} (${(off / idle8h).toFixed(2)} of idle, the 7 h after the first at ${share(off, r).toFixed(2)}, ${(off / active).toFixed(2)} h of active) and at ${E_MAX} ${Math.round(offMax)} (${(offMax / idle8h).toFixed(2)}, ${share(offMax, r).toFixed(2)}, ${(offMax / active).toFixed(2)} h of active)`);
  }
  const vsIdle = spread(rows.map((r) => r.off / r.idle8h));
  const vsIdleMax = spread(rows.map((r) => r.offMax / r.idle8h));
  const sh = spread(rows.map((r) => share(r.off, r)));
  const shMax = spread(rows.map((r) => share(r.offMax, r)));
  const ratio = spread(rows.map((r) => r.active / 6 / r.idle10));
  console.log(`[pace] slice end: offline / open idle ${vsIdle.mean.toFixed(2)} at ${E_BASE} and ${vsIdleMax.mean.toFixed(2)} at ${E_MAX}; the 7 h after the first at ${sh.min.toFixed(2)}-${sh.max.toFixed(2)} and ${shMax.min.toFixed(2)}-${shMax.max.toFixed(2)}; active / idle ${ratio.min.toFixed(2)}-${ratio.max.toFixed(2)}`);

  it('offline pays something', () => {
    expect(vsIdle.min).toBeGreaterThan(0.3);
  });
  it('8 h offline pays no more than 8 h open and idle, and at least e of it (a), at 0.5 and 0.75', () => {
    expect(vsIdle.max).toBeLessThanOrEqual(1);
    expect(vsIdleMax.max).toBeLessThanOrEqual(1);
    expect(vsIdle.min).toBeGreaterThanOrEqual(E_BASE);
    expect(vsIdleMax.min).toBeGreaterThanOrEqual(E_MAX);
  });
  it('the 7 h after the first hour pay about e of open idle (b), at 0.5 and 0.75', () => {
    expect(sh.min).toBeGreaterThanOrEqual(E_BASE - CHECK12_BELOW);
    expect(sh.max).toBeLessThanOrEqual(E_BASE + CHECK12_ABOVE);
    expect(shMax.min).toBeGreaterThanOrEqual(E_MAX - CHECK12_BELOW);
    expect(shMax.max).toBeLessThanOrEqual(E_MAX + CHECK12_ABOVE);
  });
});
