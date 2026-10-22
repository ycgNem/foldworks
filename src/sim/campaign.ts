// The campaign bot (ROADMAP.md Milestone 5, DESIGN.md §16 rules 3 and 6, §19): several runs in a
// row. Each run is the Act I planner to its slice end, then the Act II policy (bot2.ts); when the
// Reorganize preview stops growing (a sensible player's moment: nothing more this run would earn
// many Patents soon) it resets, spends its Patents in a fixed, sensible priority, and plays the
// next run with the head starts. Honest like the others: every action is a command through g.act,
// at the same hand and click pace, and it reads only what the screen shows (the preview included).
import type { Game } from './Game';
import { Bot } from './bot';
import { ANNEX1, Act2Bot, LANE, PLAN2, type Step as Step2 } from './bot2';
import { Act3Bot } from './bot3';
import { TICK_RATE } from '../engine/time';
import { previewPatents, reorganizeRefusal, runSeconds } from './reorganize';
import { patentRefusal, hasPatent } from './patents';
import type { PatentId } from '../data/patents';
import { ORDER } from '../data/orders';
import { orderFrac } from './systems/orders';
import { Act4Bot, IslandHand, nextLegacy } from './bot4';
import { worldOf } from './systems/islands';
import { previewLegacy } from './relocate';
import type { WorldId } from '../data/worlds';
import type { LegacyId } from '../data/legacy';

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

/** The Act III nodes (DESIGN.md §21 Patents), bought once a run has reached the District, after
 * PATENT_PRIORITY's (so a campaign that never gets there spends as before): the Charter first (the
 * District open from the first minute, Zoning and Chutes known), then Bearings and Servos known, the
 * first lot, faster skiffs, the Dispatcher, the bigger nest; chemistry's heads last (this player's
 * District does not run chemistry yet). */
export const PATENT_PRIORITY_3: PatentId[] = [
  'zoningCharter', 'bearingPatent', 'districtDeeds', 'longSkiffs', 'dispatcher', 'biggerNest', 'wideDistrictBox',
  'chemNotes', 'senseNotes', 'roboticsPatent',
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

/** Minutes the District stands full (nothing placed, no lot bought, the plan through) before the
 * campaign's Act III player resets. */
export const ACT3_FULL = 10;

export interface RunLog {
  run: number;
  /** seconds since tick 0 when the run started and ended */
  start: number;
  end: number;
  /** the planner's hand-over to the Act II policy, seconds into the run (-1: never) */
  handover: number;
  /** the Act II policy's hand-over to the Act III policy (bot3.ts), seconds into the run (-1: never) */
  act3: number;
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
  /** the island the run was played on, and where it Relocated to at its end (Act IV) */
  world: WorldId;
  relocated?: WorldId;
  /** Legacy banked at its Relocate, and the Legacy nodes bought at its start */
  legacy?: number;
  legacyBought?: LegacyId[];
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
  /** a loop that burns its coin before each reset (the final round): called once a run when the
   * loop's reset time is reached, before the reset; it may act and step the game */
  burn?: (g: Game) => void;
  /** hand over to the Act III policy (bot3.ts) once the Act II plan is done and the Great Drill's
   * stage 3 stands (default false: the Act I-II pace tests' campaigns stop at the Act II plan's end,
   * as they were measured; tests/pace-act3.test.ts plays with it) */
  act3?: boolean;
  /** with `act3`: the Act IV policy (bot4.ts) takes the Act III hand-over instead, plays on to the
   * World, Relocates when it pays (`Act4Bot.relocateTo`) and spends Legacy at each run's start
   * (default false: tests/pace-act3.test.ts measures Act III as it was; tests/pace-act4.test.ts plays
   * with it) */
  act4?: boolean;
  /** called once a second (`act3`: the Act III policy, once it has the hands) */
  onSecond?: (g: Game, run: number, bot: Act2Bot | null, act3?: Act3Bot | null, act4?: Act4Bot | null) => void;
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
    let act3: Act3Bot | null = null;
    let act4: Act4Bot | null = null;
    const isle = o.act4 ? new IslandHand(g) : null;
    let relocate: WorldId | null = null;
    const world = worldOf(g);
    // Legacy, spent first thing on a new island (the tree screen, one click a hand-beat), and so
    // before the Patents (the Purse's)
    const legacyBought: LegacyId[] = [];
    if (o.act4) {
      for (;;) {
        const next = nextLegacy(g);
        if (!next || !g.act({ k: 'legacy', id: next }).ok) break;
        legacyBought.push(next);
        g.step(TICK_RATE / 4);
      }
    }
    let doneAt: number | null = null;
    let handover = -1;
    let act3At = -1;
    const perMin: number[] = [];
    const preview: number[] = [];
    /** a Committee order filling (its reputation opens the Great Drill's later stages), by minute */
    const committee: number[] = [];
    const ring: number[] = [];
    const cap = o.cap(run);
    let reset = false;
    let burned = false;
    // the Patents, spent first thing in the new run (the tree screen, one click a hand-beat)
    const bought: PatentId[] = [];
    // the Draughtsman's queue is kept through a reset: a design queued last run unfolds as soon as it
    // can, and a lab design over the Act I chains (Circuits at (12,2)) would break the slice's
    // copper line first (seen in the 40 h campaign's fifth run). The player empties the queue at
    // the start of a run; the Act II bot queues what its plan folds again when it takes over.
    if (o.act3) for (const id of [...g.s.meta.queue]) g.act({ k: 'queueKept', id });
    const list = logs.some((l) => l.act3 >= 0) ? [...PATENT_PRIORITY, ...PATENT_PRIORITY_3] : PATENT_PRIORITY;
    for (;;) {
      const next = list.find((id) => !hasPatent(g, id) && !patentRefusal(g, id));
      if (!next) break;
      if (!g.act({ k: 'patent', id: next }).ok) break;
      bought.push(next);
      g.step(TICK_RATE / 4);
    }
    // a campaign played to a horizon (Act III's 40 h, tests/pace-act3.test.ts) resets at a run's
    // cap as soon as the Reorganize may be taken (checked each minute), playing on until it may:
    // the horizon, not the cap, ends it
    const toHorizon = !!o.horizon && o.loopAt === undefined && !o.noReset && run < o.runs;
    while (!(o.horizon && g.s.tick >= o.horizon * TICK_RATE)) {
      if (runSeconds(g) >= cap) {
        if (!toHorizon) break;
        // (at the cap with Relocation known and paying, the player moves rather than Reorganizes:
        // the fourth pass's run 3 researched Relocation 2 hours before its cap, and the 2-hour rule
        // would have handed it to the Reorganize)
        const to = (g.s.tick - start) % (60 * TICK_RATE) === 0 && act4 ? act4.relocateTo(true) : null;
        if (to) {
          for (const id of act4!.habits()) { g.act({ k: 'habit', id }); g.step(TICK_RATE / 4); }
          relocate = to;
          break;
        }
        if ((g.s.tick - start) % (60 * TICK_RATE) === 0 && !reorganizeRefusal(g)) { reset = true; break; }
      }
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
      } else if (act4) act4.update();
      else if (act3) act3.update();
      else {
        bot.update();
        // Act III (DESIGN.md §21): once the Act II plan is through and the Great Drill's stage 3
        // stands, the Act III policy takes the hands (the Act II bot stays on as its builder); with
        // `act4`, the Act IV policy, which plays the Act III one and goes on to the World
        if (o.act3 && bot.step >= bot.plan.length && g.s.mega.stage >= 3) {
          if (o.act4) { act4 = new Act4Bot(g, bot); act3 = act4.a3; }
          else act3 = new Act3Bot(g, bot);
          act3At = runSeconds(g);
        }
      }
      isle?.update();
      g.tick();
      if (act4) act4.tick();
      else if (act3) act3.tick();
      else bot?.tick();
      if (g.s.tick % TICK_RATE === 0) o.onSecond?.(g, run, bot, act3, act4);
      if (o.loopAt !== undefined && g.s.tick % TICK_RATE === 0) {
        const at = o.loopAt === 'slice' ? (handover >= 0 ? handover : Infinity) : o.loopAt;
        if (runSeconds(g) >= at && o.burn && !burned) { burned = true; o.burn(g); }
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
        // Act IV (DESIGN.md §22): a Relocate once it is allowed, pays, and the World stands full
        // (Act4Bot.relocateTo: the preview card read, like the Reorganize's)
        const to = o.loopAt === undefined && !o.noReset && run < o.runs && act4 ? act4.relocateTo() : null;
        if (to) {
          // Old Habits first: the nodes to keep, one a hand-beat
          for (const id of act4!.habits()) { g.act({ k: 'habit', id }); g.step(TICK_RATE / 4); }
          relocate = to;
          break;
        }
        // Act III: once the plan is through and the District has not grown for 10 minutes (the floor
        // full, every lot bought, nothing more this player builds while the coin piles up), a player
        // resets for what the preview offers rather than idle to the run's cap (DESIGN.md §21
        // Pacing: the second gate's bot idled 80 min and 5 h so)
        if (o.loopAt === undefined && !o.noReset && run < o.runs && act3 && act3.grownAgo() >= ACT3_FULL * 60 && !reorganizeRefusal(g)) {
          reset = true;
          break;
        }
        // (an Act III run is not reset by the preview's stall: its District files Patents a copy at a
        // time through the bills term, slower and slower, while there is still floor to build on)
        if (o.loopAt === undefined && !o.noReset && run < o.runs && bot && !act3 && bot.step >= bot.plan.length && m > stallMin && p.now >= (o.minPatents?.(run) ?? 1) && preview[m - 1] - preview[m - 1 - stallMin] < stallGain && (committee[m - 1] < 0 || committee[m - 1] === committee[m - 1 - stallMin]) && !g.s.audits.length && !g.s.faudit) {
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
      run, start: start / TICK_RATE, end: end / TICK_RATE, handover, act3: act3At, at, perMin, preview,
      patents: reset ? pv.now : 0, peakPerMin: Math.max(0, ...perMin.filter((_, i) => i >= 4)), bought, megaStage: g.s.mega.stage,
      world, relocated: relocate ?? undefined, legacy: relocate ? previewLegacy(g, relocate).now : undefined, legacyBought,
      ...byTime([...planner.log.decisions, ...(bot?.log.decisions ?? [])].map((t) => t - t0), [...planner.log.what, ...(bot?.log.what ?? [])]),
      clicks: [...planner.log.clicks, ...(bot?.log.clicks ?? [])],
    };
    logs.push(log);
    if (relocate) {
      const r = g.act({ k: 'relocate', world: relocate });
      if (!r.ok) throw new Error('campaign: relocate refused: ' + r.why);
      continue;
    }
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
