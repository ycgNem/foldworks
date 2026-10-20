// DESIGN.md §13 check 10, no dead air: no stretch longer than 3 min passes with nothing bought,
// researched, filled or folded, for the greedy bot (it skips ahead over locked steps, accepts every
// order the moment it is offered, researches any node its bank already pays for, and keeps stamping
// modules after the slice). Measured over the first 35 min, or until the greedy's slice end if
// that comes first (after it, the slice is over).
//
// It held only after round 3's numbers (§7, §9): the two long stretches were the Boardwalk taken
// at ~4 min with one plate line on the Dock (no coin at all for 5-6 min at 200 plates; 80 now) and
// saving 4,000 for chunk C at ~180-540 coin/min while Lamp Posts held the Dock's gears and wire
// (1,000 now: the spending moves to the gear lines built on it, one purchase at a time).
import { describe, expect, it } from 'vitest';
import { longestGap, play, SEEDS, spread, mmss, type Run } from './pace-helpers';

const WINDOW = 35 * 60;

describe('pace: no dead air (§13 check 10)', () => {
  const runs = SEEDS.map((s) => play(s, 'greedy', WINDOW, (_g, b) => b.log.at.sliceEnd !== undefined));
  const end = (r: Run) => Math.min(WINDOW, r.bot.log.at.sliceEnd ?? WINDOW);
  const gaps = runs.map((r) => longestGap(r, end(r)));
  const s = spread(gaps.map((x) => x.gap));
  const worst = gaps.reduce((a, b) => (b.gap > a.gap ? b : a));
  console.log(`[pace] greedy longest stretch without a decision: mean ${Math.round(s.mean)} s, min ${Math.round(s.min)} s, p90 ${Math.round(s.p90)} s, max ${Math.round(s.max)} s; worst ${mmss(worst.from)}-${mmss(worst.to)} after ${worst.after}`);
  const r0 = runs[0];
  const d = r0.bot.log.decisions.filter((t) => t <= end(r0));
  const stretches = [...d, end(r0)].map((t, i) => ({ from: i ? d[i - 1] : 0, to: t, after: i ? r0.bot.log.what[i - 1] : 'start' })).filter((x) => x.to - x.from > 120);
  console.log(`[pace] greedy seed ${r0.seed} stretches over 2 min: ${stretches.map((x) => `${mmss(x.from)}-${mmss(x.to)} after ${x.after}`).join('; ') || 'none'}`);

  it('the greedy bot researches Folding within 35 min on every seed', () => {
    expect(runs.every((r) => r.g.done('folding'))).toBe(true);
  });
  it('no stretch longer than 3 min without a decision (mean of the longest stretch per seed)', () => {
    expect(s.mean).toBeLessThanOrEqual(180);
  });
  // the tail, as §13 check 10 words it since the Milestone 5-6 review round: 9 seeds in 10 never
  // wait over 5 min (measured p90 243 s, the worst 244 s: saving for a land chunk after a heap)
  it('no stretch longer than 5 min on 9 seeds in 10 (p90 of the longest stretch per seed)', () => {
    expect(s.p90).toBeLessThanOrEqual(300);
  });
});
