// DESIGN.md §13 check 8, the slag lesson: a smelter line with no slag route stalls within 3 min.
// A player whose furnace line has its Slag Heap (so coin keeps coming) builds a second line, miner ->
// smelter -> belts -> Dock, with nothing on the smelter's free side, and stops shovelling by hand
// once miners run. The smelter is timed from the tick it starts getting ore to its first slag jam.
import { describe, expect, it } from 'vitest';
import type { Step } from '../src/sim/bot';
import { play, spread, describe2, SEEDS } from './pace-helpers';

const NO_HEAPS: Step[] = [
  { k: 'upgrade', id: 'bellows' },
  { k: 'place', kind: 'heap', x: 3, y: 4, rot: 0 }, // the start layout's
  { k: 'place', kind: 'miner', x: 2, y: 3, rot: 0 },
  { k: 'place', kind: 'miner', x: 2, y: 2, rot: 0 },
  { k: 'place', kind: 'smelter', x: 3, y: 2, rot: 0 },
  { k: 'place', kind: 'belt', x: 4, y: 2, rot: 0 },
  { k: 'place', kind: 'belt', x: 5, y: 2, rot: 0 },
];

describe('pace: the slag lesson (§13 check 8)', () => {
  it('a smelter line with no slag route stalls on slag within 3 minutes', () => {
    const times: number[] = [];
    for (const seed of SEEDS.slice(0, 10)) {
      let start = -1, jam = -1;
      play(seed, 'planner', 900, () => jam >= 0, {
        plan: NO_HEAPS,
        shovel: false,
        onTick: (g) => {
          const s = g.entAt(3, 2);
          if (s?.kind !== 'smelter') return;
          if (start < 0 && s.state === 'work') start = g.seconds;
          if (start >= 0 && jam < 0 && s.state === 'blocked' && s.why === 'slag') jam = g.seconds;
        },
      });
      expect(start).toBeGreaterThan(0);
      expect(jam).toBeGreaterThan(start);
      times.push(jam - start);
    }
    const sp = spread(times);
    console.log(`[pace] ${describe2('smelter line, no slag route: first slag jam after it starts', sp)}`);
    expect(sp.max).toBeLessThanOrEqual(180);
  });
});
