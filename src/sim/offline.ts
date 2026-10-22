// Offline progress, finished (DESIGN.md §12, §20). On load, or when a hidden tab comes back after
// a gap the background pump could not cover, the app passes the seconds away (capped at 7 days).
//  1. Replay: up to an hour of real ticks headless through the same systems (both floors:
//     Workshop lines item by item, modules as rates), so heaps fill and lines jam as they would.
//  2. Extrapolate the rest in segments. Rates come from what reached each Dock, Hopper and the
//     Megaproject Bay over the last minutes of live ticks, and each rising Slag Heap's fill rate.
//     The segment runs until the next thing that would change those rates: a heap filling, the
//     Bay getting all it wants of an item, the active order filling (the Dock stops taking what it
//     took only for that order: the Committee's slag) or the selected research finishing (the
//     Hopper stops taking slag for it). Then the heap is set full (or the want met), a few minutes
//     are replayed live so the jam spreads as it would, and the new rates are measured. Lines run
//     at the same physical speed as live (heaps fill and lines jam at the same times); what they
//     deliver while extrapolated counts at the offline efficiency, paid through the same functions
//     as live (orders first, then sales; research credit; Machine Kits to the parts bank; the
//     Bay's stage).
// The report is a timeline: one row per line that stopped (a cascade of jams is one line, named by
// the first machine to block and why, with a fix the player can build and how many machines it
// stopped), each heap filling on its own, orders filled, research finished and the Megaproject's
// stages, plus the totals. Nothing about the time away is hidden, and every number is one the
// player can check against the live factory. The same run, on a copy of the game, is the forecast.
// Sparks pause: the run hides the tab for the sim (`visible` false), so no Spark appears unseen.
import type { Game } from './Game';
import { Num } from '../engine/num';
import { TICK_RATE } from '../engine/time';
import { duration } from '../engine/fmt';
import { RULES } from '../data/rules';
import { IDLE, IDLE_UPGRADES } from '../data/idle';
import { ITEMS, itemName, type ItemId } from '../data/items';
import { RESEARCH, type ResearchId } from '../data/research';
import { ORDER } from '../data/orders';
import { megaStage, MEGA } from '../data/megaprojects';
import { fillOrder, saleValue } from './systems/docks';
import { creditResearch, runResearch } from './systems/research';
import { runOrders } from './systems/orders';
import { megaGive, fname, BYPRODUCTS, chuteCap } from './systems/modules';
import { entName, lines as workshopLines } from './analysis';
import { restore } from './snapshot';
import { prules } from './patents';
import type { Ent, FEnt } from './world';
import { HIGH, type HighFloorId } from '../data/floors';
import { HIGH_IDS, bayProjects, megaStageOf, megaGiveX, hent, hname, routeCap, routeWant, routeDist, skiffRateNow, maxSkiffs } from './systems/high';
import { krules } from './kernels';
import { lrules } from './legacy';
import { standingDue } from './systems/automation';
import { BUILD } from '../data/machines';
import type { SkiffRoute } from './world';

/** The offline efficiency now (DESIGN.md §12, §20): the base 0.5 plus the Patent tree's offline
 * nodes (§19) plus the Night Shift bought with coin, capped at 0.75. The one function every
 * caller reads (the run, the forecast, the overnight screen, the Night Shift's refusal). */
export function offlineEfficiency(g: Game): number {
  return Math.min(offlineCeiling(g), offlineEfficiencyUncapped(g));
}

/** The ceiling offline efficiency stops at: 0.75 (§20), 0.85 with Long Nights (a Kernel node, §23). */
export function offlineCeiling(g: Game): number {
  return krules(g).offlineCeiling ?? IDLE.offlineEffMax.value;
}

/** The sources summed before the cap (what a purchase would add is judged against the cap). */
export function offlineEfficiencyUncapped(g: Game): number {
  let e = prules(g).offline + krules(g).offlineAdd;
  for (const u of IDLE_UPGRADES) if (g.has(u.id)) e += u.eff;
  return Math.round(e * 1e6) / 1e6;
}

export type TimelineKind = 'jam' | 'heap' | 'order' | 'research' | 'mega' | 'bay' | 'route' | 'committee';

/** The floor a report row is on (a jump-to goes there). */
export type ReportFloor = 'workshop' | 'factory' | HighFloorId;

/** One thing that happened while away, at `t` seconds into the time away. */
export interface TimelineEntry {
  t: number;
  kind: TimelineKind;
  /** plain words, e.g. "Smelter 3's line stopped: its Slag Heap filled (4 machines)" */
  text: string;
  /** where (a line's first machine to block, a heap), for the jump-to button */
  x?: number;
  y?: number;
  floor?: ReportFloor;
  /** a jam: the item its first machine is blocked by */
  why?: string | null;
  /** worked out from the measured rates rather than replayed tick by tick */
  est?: boolean;
  /** a jam row (or a short route's): its line in `OfflineReport.lines` */
  line?: number;
}

/** A line that stopped while away: every machine of a cascade in one row (DESIGN.md §12). */
export interface JamLine {
  /** when the line stopped: its heap filling, or its first machine blocking (s into the time away) */
  t: number;
  floor: ReportFloor;
  /** the first machine (module) to block, and the item it is blocked by: the root cause */
  root: { name: string; x: number; y: number; why: string | null; t: number };
  /** machines (modules) it stopped, the root included */
  count: number;
  /** the Slag Heap whose filling stopped it, with its average fill rate (slag a second) */
  heap: { x: number; y: number; t: number; rate: number; room: number } | null;
  /** why, in plain words ("its Slag Heap filled") */
  cause: string;
  /** a fix the player can build, in lower case after "Fix:" ("2 more Slag Heaps keep it running 8h") */
  fix: string;
  /** what stopping the line before leaving keeps, or null when it keeps nothing */
  stopKeeps: string | null;
  est: boolean;
  /** a high-floor route short of carriers (DESIGN.md §20): not a line that stopped but one that runs
   * short the whole time, named like the District's starved report ("short of 3 barges"); `root`
   * is the route's source, `count` 0 */
  route?: { id: number; item: ItemId; cap: number; want: number; short: number; carrier: string; max: boolean };
  /** copies of one high-floor group that stopped the same way, folded into this row (`count` is
   * every module of them) */
  copies?: number;
}

export interface OfflineReport {
  /** seconds away, and the part counted (capped at 7 days) */
  away: number;
  counted: number;
  /** seconds simulated tick by tick (the replay and the re-measures, paid in full as if open),
   * and seconds extrapolated (paid at `eff`) */
  replayed: number;
  extrapolated: number;
  /** the offline efficiency the extrapolated part was paid at */
  eff: number;
  coin: Num;
  /** items delivered to Hoppers (research and the parts bank) */
  hopper: Num;
  /** Machine Kits into the parts bank */
  parts: Num;
  /** items delivered to the Docks, by item */
  sold: Partial<Record<ItemId, Num>>;
  research: ResearchId[];
  orders: string[];
  /** the Megaproject: stages before and after, and what the Bay was given */
  mega: { from: number; to: number; given: Partial<Record<ItemId, Num>> };
  /** what happened, in time order (the first IDLE.timelineMax); a stopped line is one row */
  timeline: TimelineEntry[];
  /** the lines that stopped, in time order, each with its root cause and a fix */
  lines: JamLine[];
  /** machines and modules already jammed when you left (not on the timeline) */
  jammedAtStart: number;
  /** how many machines and modules jammed while away (every machine of every line) */
  jams: number;
  /** segments re-measured after a heap filled, the Bay was satisfied, an order filled or a
   * research node finished */
  segments: number;
  /** the first machine or module to jam (kept for the slice's card and older callers) */
  firstJam: { t: number; x: number; y: number; floor: ReportFloor; name: string; why: string | null } | null;
  /** the Slag Heap still filling at the end, and when it fills (seconds from the return) */
  nextHeap: { x: number; y: number; inSeconds: number } | null;
  /** the Standing Committee's number reached while away: it never Reorganizes while you are away
   * (DESIGN.md §20), so the report says when it would have, and at how many Patents */
  committee: { t: number; patents: number; at: number } | null;
  /** the compute budget (DESIGN.md §20): the estimated cost of a tick (ms on the reference PC,
   * from the number of things that tick) and the live ticks the run could afford */
  budget: { tickMs: number; ticks: number };
}

/** Deliveries by destination while a tally is open (runDocks and the Bay add to it), as Num:
 * they are item amounts (CLAUDE.md). */
export interface Tally {
  dock: Partial<Record<ItemId, Num>>;
  /** each floor's Dock apart (the Factory's, the District's, the World's): an order for one
   * floor fills only from its Dock */
  fdock: Partial<Record<ItemId, Num>>;
  ddock: Partial<Record<ItemId, Num>>;
  wdock: Partial<Record<ItemId, Num>>;
  /** Beyond's Dock (DESIGN.md §23) */
  bdock: Partial<Record<ItemId, Num>>;
  hopper: Partial<Record<ItemId, Num>>;
  /** the Factory's Bay (the Great Drill), and the District's and World's (Megaprojects #2 on) */
  bay: Partial<Record<ItemId, Num>>;
  dbay: Partial<Record<ItemId, Num>>;
  wbay: Partial<Record<ItemId, Num>>;
  /** Beyond's Bay (no project builds there yet; tallied like the others) */
  bbay: Partial<Record<ItemId, Num>>;
}

type Kind = keyof Tally;
/** Delivery rates, items a second, by destination (rates may be plain numbers). */
type Rates = Record<Kind, Partial<Record<ItemId, number>>>;

const KINDS = ['dock', 'fdock', 'ddock', 'wdock', 'bdock', 'hopper', 'bay', 'dbay', 'wbay', 'bbay'] as const;
const DOCKS = ['dock', 'fdock', 'ddock', 'wdock', 'bdock'] as const;
/** the floor an order must be for to fill from this Dock (undefined: the Workshop's) */
const DOCK_FLOOR = { dock: undefined, fdock: 'factory', ddock: 'district', wdock: 'world', bdock: 'beyond' } as const;
const HBAYS = { district: 'dbay', world: 'wbay', beyond: 'bbay' } as const;
const newTally = (): Tally => ({ dock: {}, fdock: {}, ddock: {}, wdock: {}, bdock: {}, hopper: {}, bay: {}, dbay: {}, wbay: {}, bbay: {} });
const copyTally = (t: Tally): Tally => Object.fromEntries(KINDS.map((k) => [k, { ...t[k] }])) as unknown as Tally;
/** The tally a delivery to a floor's Dock goes into. */
export const dockTally = (floor: 'factory' | HighFloorId | undefined): (typeof DOCKS)[number] =>
  floor === 'factory' ? 'fdock' : floor === 'district' ? 'ddock' : floor === 'world' ? 'wdock' : floor === 'beyond' ? 'bdock' : 'dock';
const addTo = (rec: Partial<Record<ItemId, Num>>, item: ItemId, n: Num | number) => { rec[item] = (rec[item] ?? Num.ZERO).add(n); };

/** Blocked `n` seconds straight, by the per-second history ('b' output, 'x' byproduct). */
function jammedHist(hist: string, n: number): boolean {
  if (hist.length < n) return false;
  for (let i = hist.length - n; i < hist.length; i++) if (hist[i] !== 'b' && hist[i] !== 'x') return false;
  return true;
}

const heapCap = (g: Game) => prules(g).heapCap; // Deep Heaps (§19)
const crateCap = () => BUILD.crate.capacity ?? 50;

/** Stopped `n` seconds straight on a high floor: starved, blocked or blocked by its waste (a
 * module runs at a fraction there: a starved one runs short of an input, not only at 0). */
function stoppedHist(hist: string, n: number): boolean {
  if (hist.length < n) return false;
  for (let i = hist.length - n; i < hist.length; i++) if (hist[i] !== 'b' && hist[i] !== 'x' && hist[i] !== 's') return false;
  return true;
}

/** A high-floor module counts as stopped when starved or blocked 10 s straight and running at
 * under half speed (a module a little short of an input is the route rows' news, not a stop). */
const highStopped = (m: FEnt, J: number) => m.kind === 'module' && !m.paused && m.fAvg < 0.5 && stoppedHist(m.hist, J);

/** What a high floor's carriers are called (the District's skiffs, the World's barges, Beyond's couriers). */
export const carrierWord = (f: HighFloorId) => (f === 'beyond' ? 'courier' : f === 'world' ? 'barge' : 'skiff');

/** The things a tick steps, counted (DESIGN.md §20, the compute budget): Workshop pieces (belts,
 * Miners, machines, splitters, crates, heaps), Factory pieces (modules and trunks) and high-floor
 * pieces (modules and routes on the District, the World and Beyond). */
export function tickLoad(g: Game): { workshop: number; factory: number; high: number } {
  let high = 0;
  for (const id of HIGH_IDS) {
    const st = g.s[id];
    if (!st) continue;
    high += st.routes.length;
    for (const e of st.ents) if (e.kind === 'module') high++;
  }
  let fmods = 0;
  for (const e of g.s.factory.ents) if (e.kind === 'module') fmods++;
  return { workshop: g.belts.length + g.miners.length + g.machines.length + g.logistics.length, factory: fmods + g.routes.length, high };
}

/** A tick's cost, estimated from what ticks (ms on the reference PC, DESIGN.md §20): never read
 * from a clock, so the replayed window is the same on every machine and in every replay. */
export function tickCostMs(g: Game): number {
  const n = tickLoad(g);
  return IDLE.tickBaseMs.value + n.workshop * IDLE.tickWorkshopMs.value + n.factory * IDLE.tickFactoryMs.value + n.high * IDLE.tickHighMs.value;
}

/** "copper ingots", "gears"; slag, oil, sand and the other stuffs stay as they are. */
const COUNTED = ['ingot', 'plate', 'gear', 'gizmo', 'circuit', 'motor', 'kit', 'bit', 'brick'];
const plural = (name: string) => (COUNTED.includes(name.split(' ').pop()!) ? name + 's' : name);

type Cause = { heap: Ent } | { crate: Ent } | { chute: ItemId } | { bay: ItemId } | { hbay: HighFloorId; item: ItemId } | { order: string } | { research: ResearchId };

interface LineAcc {
  key: string;
  floor: ReportFloor;
  root: JamLine['root'] | null;
  count: number;
  heap: (NonNullable<JamLine['heap']> & { est: boolean }) | null;
  /** a high-floor line: its root's cause and fix, read when it stopped (the routes may change) */
  said?: { cause: string; fix: string };
}

/** A route seen short of carriers while away (its row's numbers, read when first seen). */
interface RouteAcc { f: HighFloorId; r: SkiffRoute; t: number; est: boolean; line: JamLine }

/**
 * An offline run that can be spread over frames: `step(maxTicks)` does at most that many live
 * ticks (extrapolating costs almost nothing) and returns true once the report is ready.
 */
export class OfflineRun {
  readonly g: Game;
  readonly away: number;
  readonly counted: number;
  readonly eff: number;
  report: OfflineReport | null = null;
  /** live ticks run so far, and seconds extrapolated: the time away accounted for is their sum
   * (counted in whole ticks, so an hour replayed is exactly 3,600 s) */
  private liveTicks = 0;
  private get t() { return this.liveTicks / TICK_RATE + this.extrapolated; }
  private phase: 'live' | 'extrap' | 'done' = 'live';
  private liveLeft = 0;
  private liveTotal = 0;
  /** liveLeft at which the measuring window opens */
  private measureAt = 0;
  private measureSecs = 0;
  private tally = newTally();
  private mark: Tally | null = null;
  private heaps0 = new Map<number, number>();
  private heapRate = new Map<number, number>();
  /** each heap's room when the player left (for a full line's fill rate and its fix) */
  private heapRoom0 = new Map<number, number>();
  private get replayed() { return this.liveTicks / TICK_RATE; }
  private extrapolated = 0;
  private visible0: boolean;
  private earned0: Num;
  private parts0: Num;
  private research0: Set<string>;
  private orders0: Set<string>;
  private seenResearch: Set<string>;
  private seenOrders: Set<string>;
  private stage0: number;
  private stageSeen: number;
  private jammed = new Set<string>();
  private jammedAtStart = 0;
  private heapsFull = new Set<number>();
  private timeline: TimelineEntry[] = [];
  /** heap rows and the line each belongs to (merged into the line's row if it stops) */
  private heapRows: { e: TimelineEntry; key: string | undefined }[] = [];
  /** every machine jam, for firstJam */
  private machineJams: NonNullable<OfflineReport['firstJam']>[] = [];
  /** which line each Workshop entity and Factory module is in (lines do not change while away:
   * nobody builds) */
  private lineKey = new Map<string, string>();
  private lineAcc = new Map<string, LineAcc>();
  /** items the Dock refuses that it stopped taking when an order wanting them filled */
  private orderOnly = new Map<string, string>();
  /** extrapolated deliveries (live ones are in the tally), Num like the tally */
  private extra = newTally();
  /** the fraction of one item carried between credit slices, per destination and item: always
   * below 1, a remainder of a rate times a time, not a stock (DECISIONS.md, the review round) */
  private carry: Record<string, number> = {};
  private segments = 0;
  /** times the measuring window was opened again in this live stretch (a jam inside it) */
  private reopened = 0;
  /** the compute budget (DESIGN.md §20): a tick's estimated cost, and the live ticks the whole run
   * may spend (the replay, then each segment's settle and measure) */
  readonly tickMs: number;
  readonly budgetTicks: number;
  /** seconds the first replay runs (an hour at most; shorter when the budget says so) */
  readonly firstReplay: number;
  /** the measuring window of the live stretch now (s): a window opened again is this long */
  private windowSecs: number = IDLE.measureSeconds.value;
  /** Buffer Crates and the Factory Chute's stock filling (a full one backs its line up, like a
   * heap): counts when the measuring window opened, and rates over it */
  private crates0 = new Map<number, number>();
  private crateRate = new Map<number, number>();
  private chute0: Partial<Record<ItemId, number>> = {};
  private chuteRate = new Map<ItemId, number>();
  /** high-floor routes seen short of carriers, by floor and route id */
  private routeRows = new Map<string, RouteAcc>();
  /** seconds in a row each high-floor module has run under half speed */
  private slow = new Map<string, number>();
  private committee: OfflineReport['committee'] = null;

  constructor(g: Game, awaySeconds: number, opts: { eff?: number } = {}) {
    this.g = g;
    const s = g.s;
    this.away = awaySeconds;
    this.counted = Math.max(0, Math.min(awaySeconds, RULES.offlineCapHours.value * 3600));
    this.eff = opts.eff ?? offlineEfficiency(g);
    // no Sparks while away (DESIGN.md §6): the sim sees a hidden tab
    this.visible0 = s.visible;
    s.visible = false;
    this.earned0 = s.earned;
    this.parts0 = s.parts;
    this.research0 = new Set(s.research.done);
    this.orders0 = new Set(s.orders.done);
    this.seenResearch = new Set(s.research.done);
    this.seenOrders = new Set(s.orders.done);
    this.stage0 = this.stageSeen = s.mega.stage;
    g.tally = this.tally;
    // the lines, once: a cascade of jams is reported as the line it stopped
    for (const l of workshopLines(g)) {
      const key = 'w' + Math.min(...l.map((e) => e.id));
      for (const e of l) this.lineKey.set('w' + e.id, key);
    }
    this.factoryGroups();
    this.highGroups();
    // what is already jammed or full when the player leaves is not news
    const J = IDLE.jamSeconds.value;
    for (const m of [...g.miners, ...g.machines]) if (jammedHist(m.hist, J)) { this.jammed.add('w' + m.id); this.jammedAtStart++; }
    for (const m of s.factory.ents) if (m.kind === 'module' && jammedHist(m.hist, J)) { this.jammed.add('f' + m.id); this.jammedAtStart++; }
    for (const id of HIGH_IDS) for (const m of s[id]?.ents ?? []) if (highStopped(m, J)) { this.jammed.add('h' + id + m.id); this.jammedAtStart++; }
    // a route short of carriers when the player leaves is news all the same: it runs short the whole
    // time away, and most of Act III-V's income is made up there (the Acts IV-V review)
    this.watchRoutes(0, false);
    for (const h of g.logistics) {
      if (h.kind !== 'heap') continue;
      if (h.count >= heapCap(g)) this.heapsFull.add(h.id);
      else this.heapRoom0.set(h.id, heapCap(g) - h.count);
    }
    // the compute budget: the run may spend about IDLE.replayBudgetMs on live ticks, at the cost a
    // tick is estimated at from what ticks; the replay takes its share, the segments the rest
    this.tickMs = tickCostMs(g);
    this.budgetTicks = Math.floor(IDLE.replayBudgetMs.value / this.tickMs);
    const afford = Math.max(IDLE.replayMinSeconds.value * TICK_RATE, Math.floor(this.budgetTicks * IDLE.replayShare.value));
    const ticks = Math.min(Math.floor(this.counted * TICK_RATE), RULES.offlineReplayTicks.value, afford);
    this.firstReplay = ticks / TICK_RATE;
    // rates come from the replay's last 5 minutes, after lines have settled
    this.startLive(ticks, Math.min(ticks, 5 * 60 * TICK_RATE));
  }

  /** High-floor modules joined by routes are one line, as the Factory's joined by trunks. */
  private highGroups() {
    const g = this.g;
    for (const id of HIGH_IDS) {
      const st = g.s[id];
      if (!st) continue;
      const parent = new Map<number, number>();
      const find = (a: number): number => {
        let r = a;
        while (parent.get(r) !== r) r = parent.get(r)!;
        parent.set(a, r);
        return r;
      };
      for (const m of st.ents) if (m.kind === 'module') parent.set(m.id, m.id);
      for (const r of st.routes) if (parent.has(r.from) && parent.has(r.to)) parent.set(find(r.from), find(r.to));
      for (const m of parent.keys()) this.lineKey.set('h' + id + m, 'h' + id + find(m));
    }
  }

  /** Modules joined by trunks are one line on the Factory floor (as `line: true` stops them). */
  private factoryGroups() {
    const g = this.g;
    const parent = new Map<number, number>();
    const find = (a: number): number => {
      let r = a;
      while (parent.get(r) !== r) r = parent.get(r)!;
      parent.set(a, r);
      return r;
    };
    for (const m of g.s.factory.ents) if (m.kind === 'module') parent.set(m.id, m.id);
    for (const r of g.routes)
      if (r.to && r.to.kind === 'module' && parent.has(r.from.id) && parent.has(r.to.id)) parent.set(find(r.from.id), find(r.to.id));
    for (const id of parent.keys()) this.lineKey.set('f' + id, 'f' + find(id));
  }

  /** 0..1, for a progress bar */
  progress(): number {
    if (this.phase === 'done') return 1;
    // the first replay is most of the work; the re-measured segments share the last tenth
    const liveDone = this.liveTotal ? 1 - this.liveLeft / this.liveTotal : 1;
    if (!this.segments) return 0.9 * (this.phase === 'live' ? liveDone : 1);
    return Math.min(0.99, 0.9 + 0.1 * (this.counted > 0 ? this.t / this.counted : 1));
  }

  /** Run on; at most `maxTicks` live ticks this call. True when the report is ready. */
  step(maxTicks = Infinity): boolean {
    while (this.phase !== 'done' && maxTicks > 0) {
      if (this.phase === 'live') {
        const n = Math.min(this.liveLeft, maxTicks);
        for (let i = 0; i < n; i++) {
          if (this.liveLeft === this.measureAt) this.openMeasure();
          this.g.tick();
          this.liveLeft--;
          this.liveTicks++;
          if (this.g.s.tick % TICK_RATE === 0) this.watch(this.t, false);
        }
        maxTicks -= n;
        if (this.liveLeft <= 0) this.closeLive();
      } else this.extrapolate();
    }
    if (this.phase === 'done' && !this.report) this.finish();
    return this.phase === 'done';
  }

  private startLive(ticks: number, measureTicks: number) {
    this.reopened = 0;
    this.liveLeft = this.liveTotal = ticks;
    this.measureAt = Math.min(ticks, measureTicks);
    this.measureSecs = this.measureAt / TICK_RATE;
    this.windowSecs = Math.max(1, Math.min(IDLE.measureSeconds.value, this.measureSecs));
    this.mark = null;
    this.phase = ticks > 0 ? 'live' : 'extrap';
    if (ticks > 0 && this.measureAt >= ticks) this.openMeasure();
    if (ticks <= 0) this.measureSecs = 0;
  }

  private openMeasure() {
    if (this.mark) return;
    this.mark = copyTally(this.tally);
    this.heaps0.clear();
    this.crates0.clear();
    for (const h of this.g.logistics) {
      if (h.kind === 'heap') this.heaps0.set(h.id, h.count);
      else if (h.kind === 'crate') this.crates0.set(h.id, h.store.length);
    }
    this.chute0 = { ...(this.g.s.chute ?? {}) };
  }

  /** A jam inside the measuring window: what the window counted before it is a line that has
   * stopped since, so measure again from now, for the full window (extending the live stretch,
   * at most IDLE.remeasureMax times; never past the time away). */
  private reopenMeasure() {
    if (!this.mark || this.reopened >= IDLE.remeasureMax.value) return;
    this.reopened++;
    this.mark = null;
    const left = Math.max(0, Math.floor((this.counted - this.t) * TICK_RATE));
    this.liveLeft = Math.min(Math.max(this.liveLeft, Math.round(this.windowSecs * TICK_RATE)), left);
    this.liveTotal = Math.max(this.liveTotal, this.liveLeft);
    this.measureAt = this.liveLeft;
    this.measureSecs = this.liveLeft / TICK_RATE;
    this.openMeasure();
  }

  private closeLive() {
    this.g.events.drain();
    // heap fill rates over the measuring window
    this.heapRate.clear();
    if (this.measureSecs > 0)
      for (const h of this.g.logistics) {
        if (h.kind !== 'heap' || !this.heaps0.has(h.id)) continue;
        const rate = (h.count - this.heaps0.get(h.id)!) / this.measureSecs;
        if (rate > 1e-6) this.heapRate.set(h.id, rate);
      }
    // a crate or the Chute's stock rising fills like a heap (with a shorter replay, one filling
    // after it would otherwise be paid on as if it never did)
    this.crateRate.clear();
    this.chuteRate.clear();
    if (this.measureSecs > 0) {
      for (const c of this.g.logistics) {
        if (c.kind !== 'crate' || !this.crates0.has(c.id)) continue;
        const rate = (c.store.length - this.crates0.get(c.id)!) / this.measureSecs;
        if (rate > 1e-6 && c.store.length < crateCap()) this.crateRate.set(c.id, rate);
      }
      const ch = this.g.s.chute ?? {};
      for (const [item, n] of Object.entries(ch) as [ItemId, number][]) {
        const rate = (n - (this.chute0[item] ?? 0)) / this.measureSecs;
        if (rate > 1e-6 && n < chuteCap(this.g)) this.chuteRate.set(item, rate);
      }
    }
    this.phase = this.counted - this.t > 1e-6 && this.measureSecs > 0 ? 'extrap' : 'done';
  }

  /** Delivery rates per second over the last measuring window. */
  private rates(): Rates {
    const out: Rates = { dock: {}, fdock: {}, ddock: {}, wdock: {}, bdock: {}, hopper: {}, bay: {}, dbay: {}, wbay: {}, bbay: {} };
    if (!this.mark || this.measureSecs <= 0) return out;
    for (const k of KINDS)
      for (const [item, n] of Object.entries(this.tally[k]) as [ItemId, Num][]) {
        const r = n.sub(this.mark[k][item] ?? Num.ZERO).toNumber() / this.measureSecs;
        if (r > 1e-9) out[k][item] = r;
      }
    return out;
  }

  /** Seconds until every remaining item of `wants` arrives at `rate(item)` x the efficiency
   * (Infinity if one never does; null if nothing is left to want). */
  private timeToFill(wants: Partial<Record<ItemId, number>>, have: Partial<Record<ItemId, Num>>, rate: (item: ItemId) => number): number | null {
    let t: number | null = null;
    for (const [item, n] of Object.entries(wants) as [ItemId, number][]) {
      const rem = n - (have[item]?.toNumber() ?? 0);
      if (rem <= 1e-9) continue;
      const r = rate(item) * this.eff;
      t = Math.max(t ?? 0, r > 0 ? rem / r : Infinity);
    }
    return t;
  }

  private extrapolate() {
    const g = this.g;
    const s = g.s;
    const left = this.counted - this.t;
    if (left <= 1e-6) { this.phase = 'done'; return; }
    const rates = this.rates();
    // the next thing that changes the rates: a heap filling, the Bay getting all it wants of an
    // item, the active order filling, or the selected research finishing
    let dt = left;
    let cause: Cause | null = null;
    for (const [id, rate] of this.heapRate) {
      const h = g.byId.get(id);
      if (!h || h.count >= heapCap(g)) continue;
      const tf = (heapCap(g) - h.count) / rate;
      if (tf < dt) { dt = tf; cause = { heap: h }; }
    }
    for (const [id, rate] of this.crateRate) {
      const c = g.byId.get(id);
      if (!c || c.store.length >= crateCap() || !c.store.length) continue;
      const tf = (crateCap() - c.store.length) / rate;
      if (tf < dt) { dt = tf; cause = { crate: c }; }
    }
    for (const [item, rate] of this.chuteRate) {
      const n = s.chute?.[item] ?? 0;
      if (n >= chuteCap(g)) continue;
      const tf = (chuteCap(g) - n) / rate;
      if (tf < dt) { dt = tf; cause = { chute: item }; }
    }
    const st = megaStage(s.mega.stage);
    if (st && this.eff > 0)
      for (const [item, want] of Object.entries(st.wants) as [ItemId, number][]) {
        const r = rates.bay[item] ?? 0;
        const rem = want - (s.mega.progress[item]?.toNumber() ?? 0);
        if (r <= 0 || rem <= 0) continue;
        const tb = rem / (r * this.eff);
        if (tb < dt) { dt = tb; cause = { bay: item }; }
      }
    // a high floor's Bay: the first open project's want of an item met
    if (this.eff > 0)
      for (const id of HIGH_IDS) {
        const r0 = rates[HBAYS[id]];
        for (const mid of bayProjects(g, id)) {
          const st3 = megaStageOf(g, mid)!;
          const p = s.megas?.[mid]?.progress ?? {};
          for (const [item, want] of Object.entries(st3.wants) as [ItemId, number][]) {
            const r = r0[item] ?? 0;
            const rem = want - (p[item]?.toNumber() ?? 0);
            if (r <= 0 || rem <= 0) continue;
            const tb = rem / (r * this.eff);
            if (tb < dt) { dt = tb; cause = { hbay: id, item }; }
          }
        }
      }
    const act = s.orders.active;
    if (act && this.eff > 0) {
      const d = ORDER[act];
      // an order for one floor's Dock counts only what reaches it; any other counts every Dock
      const to = this.timeToFill(d.wants, s.orders.progress[act] ?? {}, (i) => DOCKS.reduce((a, k) => a + (!d.at || DOCK_FLOOR[k] === d.at ? rates[k][i] ?? 0 : 0), 0));
      if (to !== null && to < dt) { dt = to; cause = { order: act }; }
    }
    const sel = s.research.selected;
    if (sel && this.eff > 0) {
      const tr = this.timeToFill(RESEARCH[sel].cost, s.research.progress[sel] ?? {}, (i) => (ITEMS[i].parts ? 0 : rates.hopper[i] ?? 0));
      if (tr !== null && tr < dt) { dt = tr; cause = { research: sel }; }
    }
    dt = Math.max(0, dt);
    // pay the segment in slices, so orders and research land on the timeline near their time
    g.tally = null;
    let done = 0;
    while (done < dt - 1e-9) {
      const sl = Math.min(IDLE.creditSlice.value, dt - done);
      this.pay(rates, sl);
      done += sl;
      this.watch(this.t + done, true);
    }
    // the heaps fill as they would live
    for (const [id, rate] of this.heapRate) {
      const h = g.byId.get(id);
      if (!h) continue;
      h.count = Math.min(heapCap(g), Math.floor(h.count + rate * dt + 1e-9));
    }
    // crates and the Chute's stock as well (whole items: a crate holds the last thing it took)
    for (const [id, rate] of this.crateRate) {
      const c = g.byId.get(id);
      if (!c || !c.store.length) continue;
      const to = Math.min(crateCap(), Math.floor(c.store.length + rate * dt + 1e-9));
      while (c.store.length < to) c.store.push(c.store[c.store.length - 1]);
    }
    for (const [item, rate] of this.chuteRate) {
      const st0 = (s.chute ??= {});
      st0[item] = Math.min(chuteCap(g), Math.floor((st0[item] ?? 0) + rate * dt + 1e-9));
    }
    this.extrapolated += dt;
    if (cause && 'heap' in cause) {
      cause.heap.count = heapCap(g);
      this.heapFull(cause.heap, this.t, true);
    } else if (cause && 'crate' in cause) {
      // full: its line backs up behind it in the live minutes after (a jam row if a machine stops)
      const c = cause.crate;
      while (c.store.length < crateCap()) c.store.push(c.store[c.store.length - 1]);
    } else if (cause && 'chute' in cause) {
      (s.chute ??= {})[cause.chute] = chuteCap(g);
    } else if (cause && 'bay' in cause) {
      // top up the last fraction so the want is met exactly, then say so
      const st2 = megaStage(s.mega.stage);
      const want = st2?.wants[cause.bay] ?? 0;
      const rem = Math.ceil(want - (s.mega.progress[cause.bay]?.toNumber() ?? 0));
      if (rem > 0) this.giveBay(cause.bay, rem);
      this.push({ t: this.t, kind: 'bay', text: `The Megaproject Bay has all the ${itemName(cause.bay).toLowerCase()} it wants`, est: true });
      this.watch(this.t, true);
    } else if (cause && 'hbay' in cause) {
      const mid = bayProjects(g, cause.hbay).find((m) => megaStageOf(g, m)?.wants[cause.item]);
      const st3 = mid ? megaStageOf(g, mid) : null;
      const rem = st3 ? Math.ceil((st3.wants[cause.item] ?? 0) - (s.megas?.[mid!]?.progress[cause.item]?.toNumber() ?? 0)) : 0;
      if (rem > 0) this.giveHBay(cause.hbay, cause.item, rem);
      this.push({ t: this.t, kind: 'bay', text: `The ${HIGH[cause.hbay].name} Bay has all the ${itemName(cause.item).toLowerCase()} it wants`, est: true });
      this.watch(this.t, true);
    } else if (cause && 'order' in cause) {
      // the slices paid whole items; top up the last fraction of one so the order fills now
      if (s.orders.active === cause.order) {
        const d = ORDER[cause.order];
        const p = s.orders.progress[cause.order] ?? {};
        for (const [item, n] of Object.entries(d.wants) as [ItemId, number][]) {
          const rem = n - (p[item]?.toNumber() ?? 0);
          if (rem > 0 && rem <= 1 + 1e-9) fillOrder(g, item, Num.of(rem), d.at);
        }
        runOrders(g);
      }
      this.watch(this.t, true);
    } else if (cause && 'research' in cause) {
      if (s.research.selected === cause.research) {
        const p = s.research.progress[cause.research] ?? {};
        for (const [item, n] of Object.entries(RESEARCH[cause.research].cost) as [ItemId, number][]) {
          const rem = n - (p[item]?.toNumber() ?? 0);
          if (rem > 0 && rem <= 1 + 1e-9) creditResearch(g, item, Num.of(rem));
        }
        runResearch(g);
      }
      this.watch(this.t, true);
    }
    g.events.drain();
    g.tally = this.tally;
    const remaining = this.counted - this.t;
    if (!cause || remaining <= 1e-6) { this.phase = 'done'; return; }
    // replay a few minutes live from here: the jam spreads, then the new rates are measured (the
    // measuring window shortened to what the budget has left, never under its floor)
    this.segments++;
    this.watchRoutes(this.t, true);
    const budgetLeft = Math.max(0, this.budgetTicks - this.liveTicks);
    const settle = IDLE.settleSeconds.value;
    const measure = Math.max(IDLE.measureMinSeconds.value, Math.min(IDLE.measureSeconds.value, Math.floor(budgetLeft / TICK_RATE) - settle));
    const ticks = Math.min(Math.floor(remaining * TICK_RATE), (settle + measure) * TICK_RATE);
    this.startLive(ticks, Math.min(ticks, measure * TICK_RATE));
  }

  /** Credit `secs` of the measured rates at the offline efficiency, through the live functions. */
  private pay(rates: Rates, secs: number) {
    const g = this.g;
    const s = g.s;
    const k = secs * this.eff;
    const whole = (key: string, x: number): number => {
      const v = x + (this.carry[key] ?? 0);
      const n = Math.floor(v + 1e-9);
      this.carry[key] = Math.max(0, v - n);
      return n;
    };
    for (const kind of DOCKS)
      for (const [item, r] of Object.entries(rates[kind]) as [ItemId, number][]) {
        const n = whole(kind + item, r * k);
        if (n <= 0) continue;
        const amt = Num.of(n);
        addTo(s.delivered, item, amt);
        addTo(this.extra[kind], item, amt);
        const left = fillOrder(g, item, amt, DOCK_FLOOR[kind]);
        const v = saleValue(g, item);
        // a one-off for the coin/min statistic: the HUD's rate stays the live one
        if (v > 0 && !left.isZero()) g.earn(left.mul(v), true);
        runOrders(g);
      }
    for (const [item, r] of Object.entries(rates.hopper) as [ItemId, number][]) {
      const n = whole('hopper' + item, r * k);
      if (n <= 0) continue;
      const amt = Num.of(n);
      addTo(s.delivered, item, amt);
      addTo(this.extra.hopper, item, amt);
      if (ITEMS[item].parts) s.parts = s.parts.add(amt);
      else {
        creditResearch(g, item, amt);
        runResearch(g);
      }
    }
    for (const [item, r] of Object.entries(rates.bay) as [ItemId, number][]) {
      const n = whole('bay' + item, r * k);
      if (n > 0) this.giveBay(item, n);
    }
    for (const id of HIGH_IDS)
      for (const [item, r] of Object.entries(rates[HBAYS[id]]) as [ItemId, number][]) {
        const n = whole(HBAYS[id] + item, r * k);
        if (n > 0) this.giveHBay(id, item, n);
      }
  }

  /** Give a high floor's Bay up to `n` of an item: what its open projects still want (the rest,
   * which live play would sell at its Dock, is not counted: offline never pays more than live). */
  private giveHBay(id: HighFloorId, item: ItemId, n: number) {
    const g = this.g;
    const bay = g.s[id]?.ents.find((e) => e.kind === 'fbay');
    if (!bay) return;
    const t = g.tally;
    g.tally = null;
    const left = megaGiveX(g, id, bay, item, n);
    g.tally = t;
    if (n - left > 0) addTo(this.extra[HBAYS[id]], item, n - left);
  }

  /** Give the Bay up to `n` of an item, no more than its stage still wants. */
  private giveBay(item: ItemId, n: number) {
    const g = this.g;
    const st = megaStage(g.s.mega.stage);
    const bay = g.s.factory.ents.find((e) => e.kind === 'fbay');
    if (!st || !bay) return;
    const rem = Math.ceil((st.wants[item] ?? 0) - (g.s.mega.progress[item]?.toNumber() ?? 0));
    const give = Math.min(n, rem);
    if (give <= 0) return;
    addTo(this.extra.bay, item, give);
    megaGive(g, bay, item, give);
  }

  private push(e: TimelineEntry) {
    this.timeline.push(e);
  }

  private acc(key: string, floor: ReportFloor): LineAcc {
    let a = this.lineAcc.get(key);
    if (!a) this.lineAcc.set(key, (a = { key, floor, root: null, count: 0, heap: null }));
    return a;
  }

  private heapFull(h: Ent, t: number, est: boolean) {
    if (this.heapsFull.has(h.id)) return;
    this.heapsFull.add(h.id);
    const e: TimelineEntry = { t, kind: 'heap', text: 'A Slag Heap is full', x: h.x, y: h.y, floor: 'workshop', est };
    this.push(e);
    const key = this.lineKey.get('w' + h.id);
    this.heapRows.push({ e, key });
    const room = this.heapRoom0.get(h.id) ?? 0;
    if (key && t > 0 && room > 0) {
      // the line's heaps fill one after another (or side by side) until the last one stops it:
      // the room they had together over the time they took is the line's slag rate
      const a = this.acc(key, 'workshop');
      if (!a.root) {
        const sum = (a.heap?.room ?? 0) + room;
        a.heap = { x: h.x, y: h.y, t, rate: sum / t, room: sum, est };
      }
    }
  }

  /** A machine or module jammed (blocked 10 s straight; on a high floor, starved or blocked) at
   * `t`: count it into its line. */
  private jam(m: Ent | FEnt, floor: ReportFloor, t: number) {
    const g = this.g;
    const high = floor !== 'workshop' && floor !== 'factory';
    const name = floor === 'workshop' ? entName(g, m as Ent) : high ? hname(g, m as FEnt) : fname(g, m as FEnt);
    const id = (floor === 'workshop' ? 'w' : floor === 'factory' ? 'f' : 'h' + floor) + m.id;
    this.machineJams.push({ t, x: m.x, y: m.y, floor, name, why: m.why });
    const a = this.acc(this.lineKey.get(id) ?? id, floor);
    a.count++;
    if (!a.root) {
      a.root = { name, x: m.x, y: m.y, why: m.why, t };
      if (high) a.said = this.highCause(floor, m as FEnt);
    }
  }

  /** Why a high-floor module stopped and what to build, in the District's starved report's words
   * (src/app/district.ts, src/app/stuck.ts): no route brings it, a route short of carriers (how
   * many more), its feeder stopped, or its feeders make too little; blocked: nothing takes it, a
   * route out short of carriers, or where it goes takes no more. */
  private highCause(f: HighFloorId, m: FEnt): { cause: string; fix: string } {
    const g = this.g;
    const st = g.s[f]!;
    const item = m.why as ItemId | null;
    const d = g.design(m.design);
    const main = (Object.keys((m.state === 'starved' ? d?.ins : d?.outs) ?? {}) as ItemId[]).find((i) => !BYPRODUCTS.has(i));
    const it = item && ITEMS[item] ? item : main ?? null;
    const wn = it ? plural(itemName(it).toLowerCase()) : m.state === 'starved' ? 'its input' : 'its goods';
    const word = carrierWord(f);
    const shortFix = (r: SkiffRoute) => {
      const q = this.routeShortBy(f, r);
      const a = hent(g, f, r.from);
      return q.max ? `the ${a ? hname(g, a) : '?'} route's ends closer (${maxSkiffs(g, f)} ${word}s at most)` : `${q.short} more ${word}${q.short > 1 ? 's' : ''} on the ${a ? hname(g, a) : '?'} route`;
    };
    if (m.state === 'starved') {
      const ins = st.routes.filter((r) => r.to === m.id && r.item === item);
      if (!ins.length) return { cause: `no route brings it ${wn}`, fix: `a route bringing ${wn} from a group that makes it` };
      const short = ins.find((r) => this.isShort(f, r));
      if (short) return { cause: `its ${wn} route is short of ${word}s`, fix: shortFix(short) };
      const src = ins.map((r) => hent(g, f, r.from)).find((e): e is FEnt => !!e && e.kind === 'module' && e.state !== 'work');
      if (src) return { cause: `its feeder ${hname(g, src)} stopped`, fix: `${hname(g, src)} running again (its own row says how)` };
      const a = hent(g, f, ins[0].from);
      return { cause: `its feeders make too little ${wn}`, fix: `another ${a ? hname(g, a) : 'group making it'} routed in` };
    }
    const outs = st.routes.filter((r) => r.from === m.id && (!item || r.item === item));
    if (!outs.length) return { cause: `its ${wn} had nowhere to go`, fix: item && BYPRODUCTS.has(item) ? `a route taking ${wn} to the Dock` : `a route taking ${wn} to the Dock or a group` };
    const short = outs.find((r) => this.isShort(f, r));
    if (short) return { cause: `its ${wn} route out is short of ${word}s`, fix: shortFix(short) };
    if (item && this.orderOnly.has(item)) return { cause: `the Dock stopped taking ${wn} (${this.orderOnly.get(item)} filled)`, fix: `a group that uses ${wn}` };
    const to = hent(g, f, outs[0].to);
    // the Dock, the Hopper and the Bay take all: a module blocked there waits on its carriers (one
    // that carries 90-100% of its want still leaves it waiting between loads)
    if (!to || to.kind !== 'module') return { cause: `its ${wn} wait on the ${word}s`, fix: shortFix(outs[0]) };
    return { cause: `${hname(g, to)} takes no more ${wn}`, fix: `a route taking the rest of its ${wn} to the Dock` };
  }

  /** A route carrying under 90% of what it is wanted (the District's `routeShort`, the Dispatcher's
   * test; a route with no carrier at all is one the player parked, as the Stuck? button reads it). */
  private isShort(f: HighFloorId, r: SkiffRoute): boolean {
    const want = routeWant(this.g, f, r);
    return r.skiffs > 0 && want > 1e-9 && routeCap(this.g, f, r) < 0.9 * want;
  }

  /** How many carriers a route is short of all it is wanted (the District's `skiffsNeeded` less
   * what it has), and whether that is past the most a route takes. */
  private routeShortBy(f: HighFloorId, r: SkiffRoute): { short: number; max: boolean } {
    const g = this.g;
    const a = hent(g, f, r.from), b = hent(g, f, r.to);
    const per = a && b ? skiffRateNow(g, f, routeDist(a, b)) : 0;
    const need = per > 0 ? Math.max(1, Math.ceil((routeWant(g, f, r) - 1e-9) / per)) : r.skiffs;
    return { short: Math.max(1, need - r.skiffs), max: need > maxSkiffs(g, f) };
  }

  /** Routes short of carriers, first seen at `t` (at the start, each live minute and after each
   * extrapolated segment): one row each, its numbers read when first seen. */
  private watchRoutes(t: number, est: boolean) {
    const g = this.g;
    for (const f of HIGH_IDS) {
      const st = g.s[f];
      if (!st) continue;
      for (const r of st.routes) {
        const key = f + r.id;
        if (this.routeRows.has(key) || !this.isShort(f, r)) continue;
        const a = hent(g, f, r.from), b = hent(g, f, r.to);
        if (!a || !b) continue;
        const cap = routeCap(g, f, r), want = routeWant(g, f, r);
        const q = this.routeShortBy(f, r);
        const word = carrierWord(f);
        const wn = plural(itemName(r.item).toLowerCase());
        const most = maxSkiffs(g, f);
        const line: JamLine = {
          t, floor: f,
          root: { name: `${hname(g, a)} to ${hname(g, b)}`, x: Math.floor((a.x + a.w / 2 + b.x + b.w / 2) / 2), y: Math.floor((a.y + a.h / 2 + b.y + b.h / 2) / 2), why: r.item, t },
          count: 0, heap: null,
          cause: `short of ${q.short} ${word}${q.short > 1 ? 's' : ''}`,
          fix: q.max ? `its ends closer: ${most} ${word}s carry ${Math.round((Math.min(1, (cap / Math.max(1, r.skiffs)) * most / want)) * 100)}% of it` : `${q.short} more ${word}${q.short > 1 ? 's' : ''} carry all its ${wn}`,
          stopKeeps: null, est,
          route: { id: r.id, item: r.item, cap, want, short: q.short, carrier: word, max: q.max },
        };
        this.routeRows.set(key, { f, r, t, est, line });
      }
    }
  }

  /** The Standing Committee's number reached while away: said once, never acted on (DESIGN.md §20). */
  private watchCommittee(t: number, est: boolean) {
    const g = this.g;
    if (this.committee || !lrules(g).standing) return;
    if (!est && g.s.tick % (RULES.standingEvery.value * TICK_RATE) !== 0) return;
    const p = standingDue(g);
    if (p === null) return;
    this.committee = { t, patents: p, at: g.s.meta.standing ?? p };
    this.push({ t, kind: 'committee', text: `The Committee would have reorganized at ${p} Patents`, est });
  }

  /** Once a second of live ticks (and after each credited slice): what changed. */
  private watch(t: number, est: boolean) {
    const g = this.g;
    const s = g.s;
    if (!est) g.events.drain();
    for (const id of s.research.done)
      if (!this.seenResearch.has(id)) { this.seenResearch.add(id); this.push({ t, kind: 'research', text: `Research finished: ${RESEARCH[id].name}`, est }); }
    for (const id of s.orders.done)
      if (!this.seenOrders.has(id)) {
        this.seenOrders.add(id);
        const d = ORDER[id];
        this.push({ t, kind: 'order', text: `Order filled: ${d?.name ?? id}`, est });
        // what the Dock took only for this order it refuses from now on
        if (d) for (const item of Object.keys(d.wants) as ItemId[]) if (ITEMS[item].refused) this.orderOnly.set(item, d.name);
      }
    if (s.mega.stage > this.stageSeen) {
      for (let k = this.stageSeen + 1; k <= s.mega.stage; k++) this.push({ t, kind: 'mega', text: `${MEGA.find((m) => m.stage === k)?.name ?? 'A Megaproject stage'}: done!`, est });
      this.stageSeen = s.mega.stage;
    }
    this.watchCommittee(t, est);
    if (est) return;
    if (s.tick % (60 * TICK_RATE) === 0) this.watchRoutes(t, false);
    const J = IDLE.jamSeconds.value;
    const n0 = this.machineJams.length;
    for (const list of [g.miners, g.machines])
      for (const m of list) {
        if (m.paused || this.jammed.has('w' + m.id) || !jammedHist(m.hist, J)) continue;
        this.jammed.add('w' + m.id);
        this.jam(m, 'workshop', Math.max(0, t - J));
      }
    for (const m of s.factory.ents) {
      if (m.kind !== 'module' || m.paused || this.jammed.has('f' + m.id) || !jammedHist(m.hist, J)) continue;
      this.jammed.add('f' + m.id);
      this.jam(m, 'factory', Math.max(0, t - J));
    }
    // a high-floor module stops when it runs under half speed 10 s straight (read each second: one
    // fed by carriers flickers blocked between loads at 95%, which is not a stop)
    for (const id of HIGH_IDS)
      for (const m of s[id]?.ents ?? []) {
        if (m.kind !== 'module') continue;
        const k = 'h' + id + m.id;
        if (this.jammed.has(k)) continue;
        const slow = !m.paused && m.state !== 'work' && m.state !== 'idle' && m.fAvg < 0.5 ? (this.slow.get(k) ?? 0) + 1 : 0;
        this.slow.set(k, slow);
        if (slow < J) continue;
        this.jammed.add(k);
        this.jam(m, id, Math.max(0, t - J));
      }
    for (const h of g.logistics) if (h.kind === 'heap' && h.count >= heapCap(g)) this.heapFull(h, t, false);
    if (this.machineJams.length > n0) this.reopenMeasure();
  }

  /** A stopped line's row: the root cause in plain words, a fix to build, what a stop keeps. */
  private jamLine(a: LineAcc): JamLine {
    const g = this.g;
    const root = a.root!;
    const why = root.why as ItemId | null;
    const wn = why && ITEMS[why] ? plural(itemName(why).toLowerCase()) : null;
    const span = this.counted % 3600 === 0 && this.counted < 86400 ? `${this.counted / 3600}h` : duration(this.counted);
    let cause: string, fix: string, stopKeeps: string | null = null;
    const heap = a.heap && (why === 'slag' || a.heap.t <= root.t + IDLE.settleSeconds.value) ? a.heap : null;
    if (a.said) {
      cause = a.said.cause;
      fix = a.said.fix;
    } else if (heap) {
      cause = 'its Slag Heap filled';
      // the slag it makes in the whole time away, less the room the heap had: more heaps take it
      const more = Math.max(1, Math.ceil((heap.rate * this.counted - heap.room) / heapCap(g)));
      const press = g.done('crushing') ? ' or a gravel Press' : '';
      fix = `${more > 1 ? more + ' more Slag Heaps' : 'one more Slag Heap'}${press} ${more > 1 && !press ? 'keep' : 'keeps'} it running ${span}`;
      stopKeeps = `Stopped now, its heap${heap.room > heapCap(g) ? 's keep their' : ' keeps its'} room: ${duration(heap.room / heap.rate)} of running when you are back (it earns nothing while stopped)`;
    } else if (a.floor === 'factory') {
      cause = wn ? `its ${wn} backed up` : 'its output backed up';
      fix = `a trunk taking ${wn ?? 'it'} to the Dock`;
    } else if (why && this.orderOnly.has(why)) {
      cause = `the Dock stopped taking ${wn} (${this.orderOnly.get(why)} filled)`;
      fix = `a Crate, or a machine that uses ${wn}`;
    } else if (why === 'slag') {
      cause = 'its slag had nowhere to go';
      fix = 'a Slag Heap beside it';
    } else {
      cause = wn ? `its ${wn} had nowhere to go` : 'its output had nowhere to go';
      const to = why && ITEMS[why]?.parts ? 'a Hopper' : why && ITEMS[why]?.refused ? 'a Crate' : 'the Dock';
      fix = `a belt taking ${wn ?? 'it'} to ${to}`;
    }
    const t = heap ? Math.min(heap.t, root.t) : root.t;
    return { t, floor: a.floor, root, count: a.count, heap: heap ? { x: heap.x, y: heap.y, t: heap.t, rate: heap.rate, room: heap.room } : null, cause, fix, stopKeeps, est: !!heap?.est };
  }

  private finish() {
    const g = this.g;
    const s = g.s;
    s.visible = this.visible0;
    g.tally = null;
    g.events.drain();
    // the heap filling soonest after the return, at the last measured rates
    let nextHeap: OfflineReport['nextHeap'] = null;
    for (const [id, rate] of this.heapRate) {
      const h = g.byId.get(id);
      if (!h || h.count >= heapCap(g)) continue;
      const inSeconds = (heapCap(g) - h.count) / rate;
      if (!nextHeap || inSeconds < nextHeap.inSeconds) nextHeap = { x: h.x, y: h.y, inSeconds };
    }
    const sum = (k: Kind, item: ItemId) => (this.tally[k][item] ?? Num.ZERO).add(this.extra[k][item] ?? Num.ZERO);
    const sold: Partial<Record<ItemId, Num>> = {};
    let hopper = Num.ZERO;
    const given: Partial<Record<ItemId, Num>> = {};
    const items = (k: Kind) => new Set([...Object.keys(this.tally[k]), ...Object.keys(this.extra[k])]) as Set<ItemId>;
    for (const kind of DOCKS)
      for (const item of items(kind)) {
        const n = sum(kind, item).round();
        if (n.gt(0)) addTo(sold, item, n);
      }
    for (const item of items('hopper')) hopper = hopper.add(sum('hopper', item).round());
    for (const kind of ['bay', 'dbay', 'wbay', 'bbay'] as const)
      for (const item of items(kind)) {
        const n = sum(kind, item).round();
        if (n.gt(0)) addTo(given, item, n);
      }
    // one row per stopped line, in place of its machines' jams and its heap's row
    const pairs0 = [...this.lineAcc.values()].filter((a) => a.root).map((a) => ({ key: a.key, l: this.jamLine(a) })).sort((a, b) => a.l.t - b.l.t);
    // copies of one group on a high floor that stop the same way are one row (the District stamps
    // groups by the dozen: twelve identical rows would hide the thirteenth)
    const pairs: typeof pairs0 = [];
    const same = new Map<string, JamLine>();
    for (const p of pairs0) {
      const high = p.l.floor !== 'workshop' && p.l.floor !== 'factory';
      const k = p.l.floor + '|' + p.l.root.name + '|' + p.l.cause;
      const was = high ? same.get(k) : undefined;
      if (was) { was.count += p.l.count; was.copies = (was.copies ?? 1) + 1; continue; }
      if (high) same.set(k, p.l);
      pairs.push(p);
    }
    const lines = pairs.map((p) => p.l);
    // the routes short of carriers, after the lines that stopped (in time order among themselves)
    const routes = [...this.routeRows.values()].sort((a, b) => a.t - b.t);
    for (const r of routes) lines.push(r.line);
    const merged = new Set(pairs.filter((p) => p.l.heap).map((p) => p.key));
    const heapRowsGone = new Set(this.heapRows.filter((h) => h.key && merged.has(h.key)).map((h) => h.e));
    const rows = this.timeline.filter((e) => !heapRowsGone.has(e));
    lines.forEach((l, i) => {
      const n = l.count;
      if (l.route) {
        rows.push({ t: l.t, kind: 'route', text: `The ${l.root.name} route ${l.t > 0 ? 'ran' : 'was'} ${l.cause}${l.t > 0 ? '' : ' the whole time'}`, x: l.root.x, y: l.root.y, floor: l.floor, why: l.root.why, est: l.est, line: i });
        return;
      }
      const what = l.floor === 'workshop' || l.floor === 'factory' ? 'machine' : 'module';
      const copies = l.copies ? `, ${l.copies} copies` : '';
      rows.push({ t: l.t, kind: 'jam', text: `${l.root.name}'s line stopped: ${l.cause} (${n} ${what}${n > 1 ? 's' : ''}${copies})`, x: l.root.x, y: l.root.y, floor: l.floor, why: l.root.why, est: l.est, line: i });
    });
    const timeline = rows.sort((a, b) => a.t - b.t);
    const j = this.machineJams.sort((a, b) => a.t - b.t)[0];
    this.report = {
      away: this.away,
      counted: this.counted,
      replayed: this.replayed,
      extrapolated: this.extrapolated,
      eff: this.eff,
      coin: s.earned.sub(this.earned0),
      hopper,
      parts: s.parts.sub(this.parts0),
      sold,
      research: s.research.done.filter((r) => !this.research0.has(r)),
      orders: s.orders.done.filter((o) => !this.orders0.has(o)),
      mega: { from: this.stage0, to: s.mega.stage, given },
      timeline: timeline.slice(0, IDLE.timelineMax.value),
      lines,
      jammedAtStart: this.jammedAtStart,
      jams: this.machineJams.length,
      segments: this.segments,
      firstJam: j ? { ...j } : null,
      nextHeap,
      committee: this.committee,
      budget: { tickMs: this.tickMs, ticks: this.budgetTicks },
    };
  }
}

/** How the report's number was made, in words the player can check (DESIGN.md §12, pillar 4):
 * "the first 1h 04m at 100% (as if open), the other 6h 56m at 50%". */
export function paidHow(rep: Pick<OfflineReport, 'replayed' | 'extrapolated' | 'eff'>): string {
  if (rep.extrapolated <= 0) return `all ${duration(rep.replayed)} at 100%, as if open`;
  return `the first ${duration(rep.replayed)} at 100% (as if open), the other ${duration(rep.extrapolated)} at ${Math.round(rep.eff * 100)}%`;
}

/** Run the whole offline model now (tests, bots and short gaps). */
export function runOffline(g: Game, awaySeconds: number, opts: { eff?: number } = {}): OfflineReport {
  const run = new OfflineRun(g, awaySeconds, opts);
  run.step();
  return run.report!;
}

/** A copy of the game to look ahead on (the live game is never touched). */
export function copyGame(g: Game): Game {
  return restore({ seed: g.s.seed, snap: JSON.stringify(g.s), snapTick: g.s.tick, log: [], tick: g.s.tick });
}

/**
 * "Safe for overnight" (DESIGN.md §20): what `hours` away would bring, run headless on a copy of
 * the game through exactly the offline model above (so the forecast and the report the player
 * gets in the morning are the same computation). Step it like any OfflineRun.
 */
export function forecast(g: Game, hours: number = IDLE.forecastHours.value): OfflineRun {
  return new OfflineRun(copyGame(g), hours * 3600);
}
