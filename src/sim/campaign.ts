// The campaign bot (ROADMAP.md Milestone 5, DESIGN.md §16 rules 3 and 6, §19): several runs in a
// row. Each run is the Act I planner to its slice end, then the Act II policy (bot2.ts); when the
// Reorganize preview stops growing (a sensible player's moment: nothing more this run would earn
// many Patents soon) it resets, spends its Patents in a fixed, sensible priority, and plays the
// next run with the head starts. Honest like the others: every action is a command through g.act,
// at the same hand and click pace, and it reads only what the screen shows (the preview included).
import type { Game } from './Game';
import { Bot } from './bot';
import { ANNEX1, Act2Bot, LANE, PLAN2, type Step as Step2 } from './bot2';
import { TICK_RATE } from '../engine/time';
import { previewPatents, reorganizeRefusal, runSeconds } from './reorganize';
import { patentRefusal, hasPatent } from './patents';
import type { PatentId } from '../data/patents';
import { ORDER } from '../data/orders';
import { orderFrac } from './systems/orders';

/** The order a sensible player buys in: the rule that raises income at once (half a claim a copy
 * of its S-graded ingot and wire lines: more source copies) and Overdrive from the first minute,
 * then every Act I head start, then Act II's, then quality of life. A node waits for its
 * prerequisites and the Patents to buy it. */
export const PATENT_PRIORITY: PatentId[] = [
  'surveyCharter', 'bellows', 'overdriveHabit', 'starterLine', 'notebooks', 'copperDeeds', 'gearPatterns', 'gizmoPatent', 'foldingPatent',
  'shovelFrog', 'grant', 'quickAudit', 'coalRights', 'steelCharter', 'moreAuditors', 'nightShift',
  'glassNotes', 'circuitPatent', 'widerBox', 'nightWatch', 'draughtsman', 'lightsOn', 'freshDies', 'nestedBoxes', 'sideIntake',
  'labAssistant', 'orderClerk', 'stampPress', 'drawerSpace',
];

/** More Gizmo chains for the Factory floor, once the Surveyor's Charter halves the claims of its
 * S-graded ingot and wire designs: the Act II bot places them by search before its own plan (a
 * Gizmo works feeding the Dock, an ingot and a wire module feeding it, their slag to the Dock):
 * two for sure, two more while claims and room allow (the Great Drill's deep seams add claims,
 * DESIGN.md §19). */
export const EXTRA_CHAINS: Step2[] = ['F', 'G', 'H', 'I', 'J', 'K', 'L', 'M'].flatMap((c, i): Step2[] => [
  // the later two in the annex's blocks 2 and 3 (bought once claims allow a chain there), beside the
  // Factory annex's own chain in block 1 (bot2.ts ANNEX1), so the Bay floor keeps them
  // (a block is bought when the chain finds no room in the blocks owned: two chains fit a block)
  // (optional: the Act II plan never waits on the annex; a block not affordable yet waits beside
  // the plan and is bought as soon as the coin is there, before the Bay floor: the final round)
  ...(i >= 2 ? [{ k: 'annex', n: Math.min(3, Math.ceil(i / 2) + 1), for: ['Iron ingots', 'Copper wire'], opt: true } as Step2] : []),
  // the annex's block-1 chain and its lane first: the later chains sell through the lane
  ...(i === 2 ? [{ k: 'fplan', name: 'annex1extra', items: [...ANNEX1, ...LANE], opt: true, keep: true } as Step2] : []),
  { k: 'fmod', id: 'giz' + c, design: 'Gizmo works', to: { k: 'dock' }, hub: true, opt: i >= 2, annex: i >= 2 },
  { k: 'fmod', id: 'ing' + c, design: 'Iron ingots', to: { k: 'mod', id: 'giz' + c }, by: { k: 'dock' }, opt: i >= 2, annex: i >= 2 },
  { k: 'fmod', id: 'wire' + c, design: 'Copper wire', to: { k: 'mod', id: 'giz' + c }, by: { k: 'dock' }, opt: i >= 2, annex: i >= 2 },
]);

export interface RunLog {
  run: number;
  /** seconds since tick 0 when the run started and ended */
  start: number;
  end: number;
  /** the planner's hand-over to the Act II policy, seconds into the run (-1: never) */
  handover: number;
  /** milestones, seconds into the run */
  at: Record<string, number>;
  /** each minute: coin per minute averaged over the last 5 minutes (one-offs excluded) */
  perMin: number[];
  /** each minute: the preview's Patents (unrounded) */
  preview: number[];
  /** Patents banked at its Reorganize (0 when it never reset) */
  patents: number;
  peakPerMin: number;
  /** Patent nodes bought after it */
  bought: PatentId[];
  megaStage: number;
  decisions: number[];
  what: string[];
  clicks: number[];
}

export interface CampaignOpts {
  /** how many runs (the last one plays to its cap and does not reset) */
  runs: number;
  /** each run's cap, seconds */
  cap: (run: number) => number;
  /** reset once the preview grew less than `stallGain` Patents over `stallMin` minutes, after the
   * hand-over, with at least `minPatents` */
  stallMin?: number;
  stallGain?: number;
  minPatents?: (run: number) => number;
  /** never reset: play run 1 to its cap (§16 rule 6) */
  noReset?: boolean;
  /** a reset loop (DESIGN.md §19: the loop never beats the designed run): reset as soon as the
   * run reaches this many seconds (or its slice end, the hand-over) and Reorganize is allowed,
   * every run, until `horizon` seconds of play in all */
  loopAt?: number | 'slice';
  horizon?: number;
  /** called once a second */
  onSecond?: (g: Game, run: number, bot: Act2Bot | null) => void;
}

/** Play runs in a row on `g` (a fresh game). */
export function playCampaign(g: Game, o: CampaignOpts): RunLog[] {
  const logs: RunLog[] = [];
  const stallMin = o.stallMin ?? 20;
  const stallGain = o.stallGain ?? 0.25;
  for (let run = 1; run <= o.runs; run++) {
    const start = g.s.tick;
    const planner = new Bot(g, 'planner');
    let bot: Act2Bot | null = null;
    let doneAt: number | null = null;
    let handover = -1;
    const perMin: number[] = [];
    const preview: number[] = [];
    /** a Committee order filling (its reputation opens the Great Drill's later stages), by minute */
    const committee: number[] = [];
    const ring: number[] = [];
    const cap = o.cap(run);
    let reset = false;
    // the Patents, spent first thing in the new run (the tree screen, one click a hand-beat)
    const bought: PatentId[] = [];
    for (;;) {
      const next = PATENT_PRIORITY.find((id) => !hasPatent(g, id) && !patentRefusal(g, id));
      if (!next) break;
      if (!g.act({ k: 'patent', id: next }).ok) break;
      bought.push(next);
      g.step(TICK_RATE / 4);
    }
    while (runSeconds(g) < cap && !(o.horizon && g.s.tick >= o.horizon * TICK_RATE)) {
      if (!bot) {
        planner.update();
        if (planner.step >= planner.plan.length) doneAt ??= g.s.tick;
        if (doneAt !== null && (g.flag('sliceEnd') || g.s.tick - doneAt >= 60 * TICK_RATE)) {
          // the Great Drill's deep seams (stage 3, kept through every reset) are claims in chunk D
          const deep: Step2[] = g.s.mega.stage >= 3 ? [{ k: 'land', id: 'D' }] : [];
          const extra = [...deep, ...(hasPatent(g, 'surveyCharter') ? EXTRA_CHAINS : [])];
          bot = new Act2Bot(g, {}, [...extra, ...PLAN2]);
          handover = runSeconds(g);
        }
      } else bot.update();
      g.tick();
      bot?.tick();
      if (g.s.tick % TICK_RATE === 0) o.onSecond?.(g, run, bot);
      if (o.loopAt !== undefined && g.s.tick % TICK_RATE === 0) {
        const at = o.loopAt === 'slice' ? (handover >= 0 ? handover : Infinity) : o.loopAt;
        if (runSeconds(g) >= at && !reorganizeRefusal(g) && !g.s.audits.length && !g.s.faudit) {
          reset = true;
          break;
        }
      }
      if ((g.s.tick - start) % (60 * TICK_RATE) === 0) {
        ring.push(g.incomePerMin());
        if (ring.length > 5) ring.shift();
        perMin.push(ring.reduce((a, b) => a + b, 0) / ring.length);
        const p = previewPatents(g);
        preview.push(p.total);
        const act = g.s.orders.active;
        committee.push(act && ORDER[act].customer === 'committee' ? orderFrac(g, act) : -1);
        const m = preview.length;
        if (o.loopAt === undefined && !o.noReset && run < o.runs && bot && bot.step >= bot.plan.length && m > stallMin && p.now >= (o.minPatents?.(run) ?? 1) && preview[m - 1] - preview[m - 1 - stallMin] < stallGain && (committee[m - 1] < 0 || committee[m - 1] === committee[m - 1 - stallMin]) && !g.s.audits.length && !g.s.faudit) {
          reset = true;
          break;
        }
      }
    }
    const end = g.s.tick;
    const pv = previewPatents(g);
    const at: Record<string, number> = {};
    const t0 = start / TICK_RATE;
    for (const [k, v] of Object.entries({ ...planner.log.at, ...(bot?.log.at ?? {}) })) at[k] = v - t0;
    const log: RunLog = {
      run, start: start / TICK_RATE, end: end / TICK_RATE, handover, at, perMin, preview,
      patents: reset ? pv.now : 0, peakPerMin: Math.max(0, ...perMin.filter((_, i) => i >= 4)), bought, megaStage: g.s.mega.stage,
      ...byTime([...planner.log.decisions, ...(bot?.log.decisions ?? [])].map((t) => t - t0), [...planner.log.what, ...(bot?.log.what ?? [])]),
      clicks: [...planner.log.clicks, ...(bot?.log.clicks ?? [])],
    };
    logs.push(log);
    if (!reset) break;
    const r = g.act({ k: 'reorganize' });
    if (!r.ok) throw new Error('campaign: reorganize refused: ' + r.why);
  }
  return logs;
}

/** Decisions and what each was, in time order (the planner's and the Act II bot's together). */
function byTime(t: number[], what: string[]): { decisions: number[]; what: string[] } {
  const i = t.map((_, k) => k).sort((a, b) => t[a] - t[b]);
  return { decisions: i.map((k) => t[k]), what: i.map((k) => what[k] ?? '') };
}

/** Seconds into a run when its 5-minute coin per minute first passed `level` (or undefined). */
export function passedAt(log: RunLog, level: number): number | undefined {
  const i = log.perMin.findIndex((v, k) => k >= 4 && v > level);
  return i < 0 ? undefined : (i + 1) * 60;
}
