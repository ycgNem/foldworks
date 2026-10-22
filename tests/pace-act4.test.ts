// Act IV pacing (DESIGN.md §16 and §22 Pacing targets): the campaign bot with the Act IV policy
// (src/sim/bot4.ts over src/sim/bot3.ts) plays a fresh game to FOLD_ACT4_HOURS of play (default
// 40 h, as far as fits in the wall-time budget; 80 h is the target horizon). Printed: the timeline
// (each run, the research that opens each act's floors, each Relocate and island, Megaproject
// stages, Legacy nodes), §16 rules 1 and 2's worst gaps over each Act III and Act IV stretch, and the
// tick cost of the biggest World (or District). Asserted: what holds as measured; what doesn't
// prints an `OPEN` line (as tests/pace-act3.test.ts does).
import { describe, expect, it } from 'vitest';
import { act4Campaign, tickCost, H, HORIZON, HOURS } from './pace-act4-helpers';
import { longestGap, hmm } from './pace-act3-helpers';

const SEED = 1000;
const T = 3_600_000;

/** Goal events (rule 1's proxy, as pace-act3 reads them, with Act IV's: the World, a Relocate). */
const GOAL = /^(research|land|fold|order|module|stage|annex|claim|lot|line|world|relocate)/;

describe(`Act IV pacing to ${HOURS} h (seed ${SEED})`, () => {
  it('plays the campaign to its horizon and prints the timeline', () => {
    const r = act4Campaign(SEED);
    const runs = r.logs.map((l) => `${l.run} ${hmm(l.start)}-${hmm(l.end)} ${l.world}${l.act3 >= 0 ? ` (Act III ${hmm(l.start + l.act3)})` : ''}${l.relocated ? ` -> ${l.relocated} +${l.legacy}L` : l.patents ? ` +${l.patents}P` : ''}`);
    console.log(
      `[pace4] seed ${SEED}, ${HOURS} h, wall ${(r.wallMs / 1000).toFixed(0)} s\n` +
      `[pace4] runs ${runs.join('; ')}\n` +
      `[pace4] District ${hmm(r.at.district)}, Chemistry ${hmm(r.at.chemistry)}, Robotics ${hmm(r.at.robotics)}, District Folds ${hmm(r.at.districtFolds)}, Charting ${hmm(r.at.charting)}, World ${hmm(r.at.world)}, Relocation ${hmm(r.at.relocation)}\n` +
      `[pace4] Relocates ${r.relocates.map((x) => `${hmm(x.at)} ${x.from}->${x.to} +${x.legacy}`).join(', ') || 'none'}; islands ${r.islands.map((i) => `${i.world} ${hmm(i.at)}`).join(', ')}\n` +
      `[pace4] Megaproject stages ${r.stages.map((s) => `${s.id}${s.stage} ${hmm(s.at)}`).join(', ') || 'none'}\n` +
      `[pace4] Legacy ${r.legacy.map((x) => `${x.id} ${hmm(x.at)}`).join(', ') || 'none'}; District folds ${r.districtFolds}; most District modules ${r.maxDistrict}, World modules ${r.maxWorld}`,
    );
    expect(r.logs[r.logs.length - 1].end).toBeGreaterThanOrEqual(HORIZON - 1);
    expect(r.at.district).not.toBeNull();
  }, T);

  it('§22 targets: Charting and the World, the first Relocate at 40-45 h, four islands by 60 h (OPEN where not met)', () => {
    const r = act4Campaign(SEED);
    if (r.at.charting === null) console.log(`[pace4] OPEN Charting not researched by ${HOURS} h (the World floor never opens)`);
    if (r.at.world === null) console.log(`[pace4] OPEN no World floor by ${HOURS} h`);
    const first = r.relocates[0];
    if (!first) console.log(`[pace4] OPEN no Relocate by ${HOURS} h (target 40-45 h; Relocation wants 3 Sandwich Engineers and 20 umbrellas)`);
    else if (first.at < 38 * H || first.at > 47 * H) console.log(`[pace4] OPEN first Relocate at ${hmm(first.at)} (target 40-45 h)`);
    const four = r.islands[3];
    if (HOURS >= 60 && (!four || four.at > 60 * H)) console.log(`[pace4] OPEN four islands by 60 h: ${r.islands.length} by ${HOURS} h`);
    expect(r.islands[0].world).toBe('home');
  }, T);

  it('rules 1 and 2 over each Act III and Act IV stretch (logged; OPEN past 10 and 15 min)', () => {
    const r = act4Campaign(SEED);
    const goals = r.decisions.filter((_, i) => GOAL.test(r.what[i]));
    const own = r.decisions.filter((_, i) => r.what[i] !== 'spark' && r.what[i] !== 'relay');
    const spans: [string, number, number][] = [];
    for (const l of r.logs) {
      if (l.act3 < 0) continue;
      const a = l.start + l.act3, b = Math.min(l.end, HORIZON);
      // the Act IV stretch is the World's: from its opening in this run to the run's end
      const w = r.at.world !== null && r.at.world >= l.start && r.at.world <= l.end ? r.at.world : null;
      if (w !== null) { spans.push(['III', a, w], ['IV', w, b]); } else spans.push([l.world === 'home' ? 'III' : `III on ${l.world}`, a, b]);
    }
    let w1 = 0, w2 = 0;
    for (const [name, a, b] of spans) {
      if (b <= a) continue;
      const g1 = longestGap(goals, a, b), g2 = longestGap(own, a, b);
      w1 = Math.max(w1, g1.gap);
      w2 = Math.max(w2, g2.gap);
      console.log(`[pace4] Act ${name} ${hmm(a)}-${hmm(b)}: rule 1 longest goal gap ${(g1.gap / 60).toFixed(1)} min at ${hmm(g1.at)}; rule 2 longest gap between decisions ${(g2.gap / 60).toFixed(1)} min at ${hmm(g2.at)}`);
      if (g1.gap > 10 * 60) console.log(`[pace4] OPEN rule 1 (a goal every 10 min) in Act ${name}: ${(g1.gap / 60).toFixed(1)} min from ${hmm(g1.at)}`);
      if (g2.gap > 15 * 60) console.log(`[pace4] OPEN rule 2 (15 min without a decision) in Act ${name}: ${(g2.gap / 60).toFixed(1)} min from ${hmm(g2.at)}`);
    }
    expect(goals.length).toBeGreaterThan(0);
  }, T);

  // the idle-critic's Act IV-V review asks (DESIGN.md §22): the island climb against 6-8 h and the
  // Legacy nodes it had (the critic: plausible only after the Regrader, the Town Plan and the Group
  // Drawer, about 24 Legacy); each floor's best value against "7-10 a floor" and the Legacy preview
  // against the model's ~35 at the first move; the Patent preview over 30-40 h
  it('the critic\'s asks: island climbs, floor bests and the Legacy preview, the Patent preview 30-40 h (logged)', () => {
    const r = act4Campaign(SEED);
    const fmt = (b: Record<string, number | null>) => Object.entries(b).map(([f, v]) => `${f} ${v ?? 'none'}`).join(', ');
    for (const c of r.climbs) console.log(`[pace4] climb on ${c.world}: Relocate ${hmm(c.from)}, World ${c.worldAt === null ? 'never' : `${hmm(c.worldAt)} (${((c.worldAt - c.from) / H).toFixed(1)} h; target 6-8 h)`}; Legacy owned [${c.owned.join(', ')}], affordable [${c.affordable.join(', ')}]`);
    if (!r.climbs.length) console.log('[pace4] climbs: none (no Relocate)');
    for (const s of r.beforeRelocate) console.log(`[pace4] before the Relocate at ${hmm(s.at)} from ${s.world}: floor bests ${fmt(s.bests)} (target 7-10 a floor); Legacy preview ${s.preview} (model ~35 on the first move)`);
    const e = r.atEnd;
    console.log(`[pace4] at ${HOURS} h on ${e.world}: floor bests ${fmt(e.bests)} (target 7-10 a floor); Legacy preview ${e.preview} (model ~35 at the first move); Legacy ${e.legacy}, owned [${e.owned.join(', ')}]`);
    const p = r.patents30;
    if (p.length) {
      const byH = new Map<number, typeof p>();
      for (const q of p) { const h = Math.floor(q.t / H); byH.set(h, [...(byH.get(h) ?? []), q]); }
      console.log(`[pace4] Patent preview 30-${HOURS} h: ${[...byH].map(([h, qs]) => `${h} h ${Math.min(...qs.map((q) => q.p)).toFixed(1)}-${Math.max(...qs.map((q) => q.p)).toFixed(1)} (${qs[qs.length - 1].nodes}/${r.patentNodes} nodes)`).join('; ')}`);
    }
    for (const f of ['workshop', 'factory', 'district', 'world']) if ((e.bests[f] ?? 0) < 7) console.log(`[pace4] OPEN ${f} best ${e.bests[f] ?? 'none'} at ${HOURS} h (§22 assumes 7-10)`);
    expect(r.atEnd.world).toBeDefined();
  }, T);

  it('ticks the biggest World (or District) inside the frame budget (e2e/perf.mjs: 4 ms a tick)', () => {
    const r = act4Campaign(SEED);
    const ms = tickCost(r);
    console.log(`[pace4] tick cost on the biggest ${r.maxWorld ? `World (${r.maxWorld} modules)` : `District (${r.maxDistrict} modules)`}: ${ms.toFixed(3)} ms`);
    expect(ms).toBeLessThan(4);
  }, T);
});
