// Act III pacing (ROADMAP.md Milestone 7's exit, DESIGN.md §16 and §21 Pacing): the campaign bot
// (the Act I planner, the Act II policy, then src/sim/bot3.ts once the Great Drill's stage 3 stands)
// plays a fresh game to 40 h of play, resetting when the Reorganize preview stalls. Measured here:
// when the District opens, when the first Act III Megaproject stage is done, §16 rules 1, 2 and 5
// over the Act III stretches, the District's module count at 40 h, and the cost of a sim tick with
// that District (e2e/perf.mjs's budget, 4 ms). The game's save is written at 1, 5, 15, 30 and 40 h
// to e2e/out/checkpoints/seed1000-<h>h.txt (the second gate's play-from points).
import { describe, expect, it } from 'vitest';
import { act3Campaign, longestGap, tickCost, hmm, H, HORIZON, type Act3Record } from './pace-act3-helpers';

const SEED = 1000;
const T = 1_800_000;

/** Goal events (rule 1's proxy, as tests/pace-act2-run.test.ts reads them, with the District's own:
 * a stage of a Megaproject, a module placed on the District, a lot, a nested fold). */
const GOAL = /^(research|land|fold|order|module|stage|annex|claim|lot|line)/;

/** Act III stretches: each run's hand-over to the Act III policy, to that run's end. */
function act3Spans(r: Act3Record): [number, number][] {
  return r.logs.filter((l) => l.act3 >= 0).map((l) => [l.start + l.act3, Math.min(l.end, HORIZON)] as [number, number]).filter(([a, b]) => b > a);
}

function worst(times: number[], spans: [number, number][]) {
  let best = { gap: 0, at: 0 };
  for (const [a, b] of spans) {
    const g = longestGap(times, a, b);
    if (g.gap > best.gap) best = g;
  }
  return best;
}

describe(`Act III pacing to 40 h (seed ${SEED})`, () => {
  it('plays 40 h: the campaign reaches the District and writes its checkpoints', () => {
    const r = act3Campaign(SEED, { checkpoints: true });
    const spans = act3Spans(r);
    const decisions = r.decisions.filter((_, i) => r.what[i] !== 'spark' && r.what[i] !== 'relay');
    const goals = r.decisions.filter((_, i) => GOAL.test(r.what[i]));
    const g1 = worst(goals, spans), g2 = worst(decisions, spans);
    const whole1 = longestGap(goals, 0, HORIZON), whole2 = longestGap(decisions, 0, HORIZON);
    const stage = r.stages[0];
    console.log(
      `[pace] seed ${SEED}: runs ${r.logs.map((l) => `${l.run} ${hmm(l.start)}-${hmm(l.end)} (+${l.patents}P${l.act3 >= 0 ? `, Act III ${hmm(l.start + l.act3)}` : ''})`).join('; ')}\n` +
      `[pace] District open ${hmm(r.districtAt)} (target ~15 h); Megaproject stages ${r.stages.map((s) => `${s.id}${s.stage} ${hmm(s.at)}`).join(', ') || 'none'} (first by 25 h)\n` +
      `[pace] rule 1 over Act III: longest goal gap ${(g1.gap / 60).toFixed(1)} min at ${hmm(g1.at)} (whole campaign ${(whole1.gap / 60).toFixed(1)} at ${hmm(whole1.at)})\n` +
      `[pace] rule 2 over Act III: longest gap between decisions ${(g2.gap / 60).toFixed(1)} min at ${hmm(g2.at)} (whole campaign ${(whole2.gap / 60).toFixed(1)} at ${hmm(whole2.at)})\n` +
      `[pace] District modules at 40 h ${r.modulesAt40} (most ${r.maxModules}); clicks/s max ${r.clicksPerSecMax}; wall ${(r.wallMs / 1000).toFixed(0)} s`,
    );
    expect(r.logs[r.logs.length - 1].end).toBeGreaterThanOrEqual(HORIZON - 1);
    expect(r.districtAt).not.toBeNull();
    expect(stage).toBeDefined();
  }, T);

  it('opens the District inside its window (§16: about 15 h; measured 10-16 h)', () => {
    const r = act3Campaign(SEED);
    expect(r.districtAt!).toBeGreaterThan(8 * H);
    expect(r.districtAt!).toBeLessThan(16 * H);
  }, T);

  it('finishes the first Act III Megaproject stage by 25 h (§16)', () => {
    const r = act3Campaign(SEED);
    expect(r.stages.length).toBeGreaterThan(0);
    expect(r.stages[0].at).toBeLessThan(25 * H);
  }, T);

  // OPEN (measured and printed, not asserted yet; DESIGN.md §21 Pacing): rules 1 and 2 hold through
  // the first Act III stretches, but the fifth run runs out of things to do once the District is
  // full and the Floating City's first stage stands (about 21.5 h): its next goals are chemistry's
  // (Chemistry, then sludge for Hydroponics, sandwiches for the City's second stage), which this
  // player does not build yet, and with nothing new to patent the Reorganize is refused, so the run
  // idles to 40 h. Rule 5's skiffs: every route carries its want with one skiff (feeders stand
  // beside what they feed), so no route has needed a second yet.
  it('rules 1 and 2 over Act III (logged; OPEN past the first megaproject stage)', () => {
    const r = act3Campaign(SEED);
    const goals = r.decisions.filter((_, i) => GOAL.test(r.what[i]));
    const own = r.decisions.filter((_, i) => r.what[i] !== 'spark' && r.what[i] !== 'relay');
    for (const span of act3Spans(r)) {
      const g1 = longestGap(goals, span[0], span[1]), g2 = longestGap(own, span[0], span[1]);
      console.log(`[pace] Act III ${hmm(span[0])}-${hmm(span[1])}: rule 1 longest goal gap ${(g1.gap / 60).toFixed(1)} min at ${hmm(g1.at)}; rule 2 longest gap between decisions ${(g2.gap / 60).toFixed(1)} min at ${hmm(g2.at)}`);
    }
    const g1 = worst(goals, act3Spans(r)), g2 = worst(own, act3Spans(r));
    if (g1.gap > 10 * 60) console.log(`[pace] OPEN rule 1 (a goal every 10 min of Act III): ${(g1.gap / 60).toFixed(1)} min from ${hmm(g1.at)}`);
    if (g2.gap > 15 * 60) console.log(`[pace] OPEN rule 2 (15 min without a decision): ${(g2.gap / 60).toFixed(1)} min from ${hmm(g2.at)}`);
    expect(goals.length).toBeGreaterThan(0);
  }, T);

  it('rule 5: Act III adds composing modules (routes between District modules)', () => {
    const r = act3Campaign(SEED);
    const most = r.districtByMin.reduce((m, s) => (s.between > m.between ? s : m), r.districtByMin[0]);
    console.log(`[pace] rule 5: most routes between District modules ${most?.between} (of ${most?.routes}, ${most?.skiffs} skiffs) at ${hmm(most?.t)}`);
    expect(most.between).toBeGreaterThanOrEqual(2);
    if (!r.districtByMin.some((s) => s.skiffs > s.routes)) console.log('[pace] OPEN rule 5: no route ever needed a second skiff (the placer stands every feeder beside what it feeds)');
  }, T);

  it('holds 20+ modules on the District at 40 h', () => {
    expect(act3Campaign(SEED).modulesAt40).toBeGreaterThanOrEqual(20);
  }, T);

  it('ticks a 20+ module District inside the frame budget (e2e/perf.mjs: 4 ms a tick)', () => {
    const r = act3Campaign(SEED);
    const ms = tickCost(r);
    console.log(`[pace] tick cost at 40 h: ${ms.toFixed(3)} ms (${r.modulesAt40} District modules)`);
    expect(ms).toBeLessThan(4);
  }, T);
});
