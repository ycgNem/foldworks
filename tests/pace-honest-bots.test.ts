// The bots play like people (DESIGN.md §1, §6): they click no faster than 12 a second (4 a second
// while clicking), notice a Spark about 2 s after it appears, act only through commands (so a run
// replays exactly from its seed and command history: no grant, no state written behind the sim's
// back) and never read the sim's random state.
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import { play } from './pace-helpers';
import { replay, fingerprint } from '../src/sim/snapshot';
import { TICK_RATE } from '../src/engine/time';
import type { Policy } from '../src/sim/bot';

/** most entries of `ticks` inside any one-second window */
function perSecond(ticks: number[]): number {
  let best = 0;
  for (let i = 0, j = 0; i < ticks.length; i++) {
    while (ticks[i] - ticks[j] >= TICK_RATE) j++;
    best = Math.max(best, i - j + 1);
  }
  return best;
}

describe('the bots are honest', () => {
  for (const policy of ['planner', 'greedy', 'dockOnly'] as Policy[]) {
    it(`${policy}: <= 4 clicks/s, <= 12 commands/s, Sparks after 2 s, and the run replays from its commands`, () => {
      const appeared = new Map<string, number>();
      const reactions: number[] = [];
      const r = play(4242, policy, 60 * 60, (_g, b) => b.log.at.sliceEnd !== undefined, {
        history: true,
        onTick: (g) => {
          for (const e of g.events.drain()) {
            if (e.type === 'spark') appeared.set(`${e.x},${e.y}`, e.tick);
            if (e.type === 'sparkGet') reactions.push(e.tick - (appeared.get(`${e.x},${e.y}`) ?? e.tick));
          }
        },
      });
      const { clicks, cmds } = r.bot.log;
      expect(clicks.length).toBeGreaterThan(50);
      expect(perSecond(clicks)).toBeLessThanOrEqual(4);
      expect(perSecond(cmds)).toBeLessThanOrEqual(12);
      // Sparks were caught, never faster than a person notices them
      expect(reactions.length).toBeGreaterThan(0);
      expect(Math.min(...reactions)).toBeGreaterThanOrEqual(2 * TICK_RATE);
      // every change came through a command: the history replays to the identical state
      const h = replay(r.seed, r.g.history!, r.g.s.tick);
      expect(fingerprint(h)).toBe(fingerprint(r.g));
      expect(h.s.coin.toString()).toBe(r.g.s.coin.toString());
    });
  }

  it('bot.ts never writes game state, grants coin, steps the sim, or reads the random state or the Spark timer', () => {
    const src = fs.readFileSync('src/sim/bot.ts', 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    expect(src).not.toMatch(/\bgrant\b/);
    expect(src).not.toMatch(/\.s\.[\w.[\]]+\s*(=|\+=|-=|\+\+|--)(?!=)/);
    expect(src).not.toMatch(/\.s\.rng|nextSpark|sparkDelay|\brand\(/);
    // the Bot class steps nothing; only runBot (the harness at the bottom) ticks the game
    const cls = src.slice(src.indexOf('export class Bot'), src.indexOf('export function runBot'));
    expect(cls).not.toMatch(/\.tick\(\)|\.step\(/);
  });
});
