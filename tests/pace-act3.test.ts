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
      `[pace] District open ${hmm(r.districtAt)} (target ~11 h); Megaproject stages ${r.stages.map((s) => `${s.id}${s.stage} ${hmm(s.at)}`).join(', ') || 'none'} (first by 25 h)\n` +
      `[pace] rule 1 over Act III: longest goal gap ${(g1.gap / 60).toFixed(1)} min at ${hmm(g1.at)} (whole campaign ${(whole1.gap / 60).toFixed(1)} at ${hmm(whole1.at)})\n` +
      `[pace] rule 2 over Act III: longest gap between decisions ${(g2.gap / 60).toFixed(1)} min at ${hmm(g2.at)} (whole campaign ${(whole2.gap / 60).toFixed(1)} at ${hmm(whole2.at)})\n` +
      `[pace] District modules at 40 h ${r.modulesAt40} (most ${r.maxModules}); District folds ${r.districtFolds} (depth-3 standing at 40 h ${r.foldsAt40}); clicks/s max ${r.clicksPerSecMax}; wall ${(r.wallMs / 1000).toFixed(0)} s`,
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

  // Measured and printed, not asserted (DESIGN.md §21 Pacing): rules 1 and 2 hold while the
  // District grows, a copy every few minutes and a lot as the routes or the tiles run out; once the
  // floor is full (about 140 groups on 180 routes, every lot) this player has nothing left to
  // build: it now builds chemistry as far as Robotics research (the chemistry corner,
  // src/sim/bot3.ts), but its Sensors line starves for rubber, so Robotics, District Folds, sludge
  // for Hydroponics, the City's stage 2 and the Transmuter stay out of reach. It then resets
  // (src/sim/campaign.ts ACT3_FULL), so the worst wait is about the reset's 10 minutes.
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

  // Rule 5's new problem is composing: where a group stands decides how many skiffs its route
  // takes (1 a trip, DESIGN.md §21), so the skiff count is the layout's bill.
  it('rule 5: Act III adds composing modules (routes between District modules, skiffs by distance)', () => {
    const r = act3Campaign(SEED);
    const most = r.districtByMin.reduce((m, s) => (s.between > m.between ? s : m), r.districtByMin[0]);
    const busy = r.districtByMin.reduce((m, s) => (s.skiffs - s.routes > m.skiffs - m.routes ? s : m), r.districtByMin[0]);
    const deep = r.districtByMin.reduce((m, s) => (s.most > m.most ? s : m), r.districtByMin[0]);
    const lots = Math.max(0, ...r.districtByMin.map((s) => s.lots));
    const short = r.districtByMin.filter((s) => s.modules > 0 && s.short > 0).length / Math.max(1, r.districtByMin.filter((s) => s.modules > 0).length);
    console.log(
      `[pace] rule 5: most routes between District modules ${most?.between} (of ${most?.routes}) at ${hmm(most?.t)}; ` +
      `most skiffs over routes ${busy.skiffs} on ${busy.routes} (${(busy.skiffs / Math.max(1, busy.routes)).toFixed(2)} a route) at ${hmm(busy.t)}; ` +
      `most on one route ${deep.most} at ${hmm(deep.t)}; lots bought ${lots}; minutes with a short route ${(short * 100).toFixed(0)}%`,
    );
    expect(most.between).toBeGreaterThanOrEqual(2);
    expect(r.districtByMin.some((s) => s.skiffs > s.routes)).toBe(true);
    if (r.districtFolds === 0) console.log('[pace] OPEN District folds: none made (District Folds is research behind Robotics, which wants sensors: the Sensors line starves for rubber, DESIGN.md §21 Pacing)');
  }, T);

  // (the campaign now resets once a District is full, so 40 h can fall early in a run: the test
  // holds the most the District stood on, and the perf case ticks that state)
  it('holds 20+ modules on the District', () => {
    expect(act3Campaign(SEED).maxModules).toBeGreaterThanOrEqual(20);
  }, T);

  it('ticks a 20+ module District inside the frame budget (e2e/perf.mjs: 4 ms a tick)', () => {
    const r = act3Campaign(SEED);
    const ms = tickCost(r);
    console.log(`[pace] tick cost with the biggest District: ${ms.toFixed(3)} ms (${r.maxModules} District modules)`);
    expect(ms).toBeLessThan(4);
  }, T);
});
