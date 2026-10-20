// Reorganize pace tests (DESIGN.md §16 rules 3 and 6, §19; ROADMAP.md Milestone 5): the campaign
// bot (src/sim/campaign.ts) plays run 1 (the Act I planner, then the Act II policy) to its first
// sensible Reorganize, spends its Patents in a fixed priority, and plays runs 2 and 3 with the head
// starts. A never-resetting bot plays one long run beside it. Every number is measured, not set:
// the test reads the same preview the card shows.
import { describe, expect, it } from 'vitest';
import { Game } from '../src/sim/Game';
import { Bot } from '../src/sim/bot';
import { playCampaign, passedAt, type RunLog } from '../src/sim/campaign';
import { previewPatents, runSeconds } from '../src/sim/reorganize';
import { TICK_RATE } from '../src/engine/time';
import { hmm, SEEDS2 } from './pace-act2-helpers';

const T = 300_000;
const H = 3600;

const cache = new Map<number, RunLog[]>();
/** Three runs: run 1 capped at 6 h (must reset with at least 12 Patents), runs 2 and 3 at 4 h. */
function campaign(seed: number): RunLog[] {
  let logs = cache.get(seed);
  if (!logs) {
    logs = playCampaign(new Game(seed), {
      runs: 3,
      cap: (r) => (r === 1 ? 6 * H : 4 * H),
      minPatents: (r) => (r === 1 ? 12 : 4),
    });
    cache.set(seed, logs);
  }
  return logs;
}

const MAX_CLICKS_PER_SEC = 4;
function clicksPerSecMax(log: RunLog): number {
  const per = new Map<number, number>();
  for (const t of log.clicks) per.set(Math.floor(t), (per.get(Math.floor(t)) ?? 0) + 1);
  return Math.max(0, ...per.values());
}

describe('Reorganize pacing (the campaign bot)', () => {
  for (const seed of SEEDS2) {
    describe(`seed ${seed}`, () => {
      it('takes its first Reorganize at 4-6 h with 12-20 Patents, honestly', () => {
        const [r1] = campaign(seed);
        const len = r1.end - r1.start;
        console.log(`seed ${seed}: run 1 ${hmm(len)} with ${r1.patents} Patents, peak ${Math.round(r1.peakPerMin)}/min`);
        expect(r1.patents).toBeGreaterThanOrEqual(12);
        expect(r1.patents).toBeLessThanOrEqual(20);
        expect(len).toBeGreaterThanOrEqual(4 * H);
        expect(len).toBeLessThanOrEqual(6 * H);
        expect(r1.megaStage).toBeGreaterThanOrEqual(1);
        for (const l of campaign(seed)) expect(clicksPerSecMax(l)).toBeLessThanOrEqual(MAX_CLICKS_PER_SEC);
      }, T);

      it('rule 3: runs 2 and 3 pass run 1\'s peak income in at most a third of run 1\'s length', () => {
        const [r1, r2, r3] = campaign(seed);
        const third = (r1.end - r1.start) / 3;
        const p2 = passedAt(r2, r1.peakPerMin), p3 = passedAt(r3, r1.peakPerMin);
        console.log(`seed ${seed}: a third of run 1 ${hmm(third)}; run 2 passes it at ${hmm(p2)} (bought ${r2.bought.length}), run 3 at ${hmm(p3)} (bought ${r3.bought.length}); hand-overs ${hmm(r1.handover)} ${hmm(r2.handover)} ${hmm(r3.handover)}`);
        expect(r2.bought.length).toBeGreaterThan(0);
        expect(p2).toBeDefined();
        expect(p2!).toBeLessThanOrEqual(third);
        expect(p3).toBeDefined();
        expect(p3!).toBeLessThanOrEqual(third);
        // the head starts reach the hand-over sooner each run
        expect(r2.handover).toBeLessThan(r1.handover);
        expect(r3.handover).toBeLessThanOrEqual(r2.handover);
      }, T);

      it('the Great Drill grows across runs: stage 2 by the end of run 3', () => {
        const logs = campaign(seed);
        console.log(`seed ${seed}: Drill stage after each run ${logs.map((l) => l.megaStage).join(', ')}`);
        expect(logs[logs.length - 1].megaStage).toBeGreaterThanOrEqual(2);
      }, T);
    });
  }

  it('rule 6: a bot that never resets still progresses (7 h, seed 1000)', () => {
    const g = new Game(1000);
    const seen: { t: number; patents: number; earned: number; stage: number }[] = [];
    playCampaign(g, {
      runs: 1,
      cap: () => 7 * H,
      noReset: true,
      onSecond: (gg) => {
        const t = runSeconds(gg);
        if (t % H === 0) seen.push({ t, patents: previewPatents(gg).total, earned: gg.s.earned.toNumber(), stage: gg.s.mega.stage });
      },
    });
    const at = (h: number) => seen.find((s) => s.t === h * H)!;
    console.log('never resets:', seen.map((s) => `${s.t / H}h ${s.patents.toFixed(1)}P ${Math.round(s.earned / 1000)}K st${s.stage}`).join(' | '));
    // coin keeps coming in (slower than a reset's run, never stopping) and nothing is taken away:
    // the preview never falls. It flattens once every product is folded and stage 1 stands, the
    // pressure toward a reset (DESIGN.md §19, open items), not a wall.
    expect(at(7).earned).toBeGreaterThan(at(5).earned * 1.1);
    expect(at(6).earned).toBeGreaterThan(at(5).earned);
    for (let h = 2; h <= 7; h++) expect(at(h).patents).toBeGreaterThanOrEqual(at(h - 1).patents);
    expect(at(7).stage).toBeGreaterThanOrEqual(1);
  }, T);

  it('the idle slice factory is worth clearly fewer Patents at 4 h than the planner run', () => {
    const g = new Game(1000);
    const planner = new Bot(g, 'planner');
    while (!g.flag('sliceEnd') && g.s.tick < H * TICK_RATE) {
      planner.update();
      g.tick();
    }
    expect(g.flag('sliceEnd')).toBe(true);
    // left alone from the Festival on
    while (g.s.tick < 4 * H * TICK_RATE) g.step(TICK_RATE * 60);
    const idle = previewPatents(g).total;
    const [r1] = campaign(1000);
    const active = r1.preview[4 * 60 - 1];
    console.log(`idle slice factory at 4 h: ${idle.toFixed(2)} Patents; the campaign's run 1 at 4 h: ${active.toFixed(2)}`);
    expect(idle).toBeLessThan(active / 2);
    expect(idle).toBeGreaterThanOrEqual(1);
  }, T);
});
