// Offline progress, finished (DESIGN.md §12, §20). On load, or when a hidden tab comes back after
// a gap the background pump could not cover, the app passes the seconds away (capped at 7 days).
//  1. Replay: up to an hour of real ticks headless through the same systems (both floors:
//     Workshop lines item by item, modules as rates), so heaps fill and lines jam as they would.
//  2. Extrapolate the rest in segments. Rates come from what reached each Dock, Hopper and the
//     Megaproject Bay over the last minutes of live ticks, and each rising Slag Heap's fill rate.
//     The segment runs until the next thing that would change those rates: a heap filling, or the
//     Bay getting all it wants of an item. Then the heap is set full (or the Bay's want met), a
//     few minutes are replayed live so the jam spreads as it would, and the new rates are
//     measured. Lines run at the same physical speed as live (heaps fill and lines jam at the
//     same times); what they deliver while extrapolated counts at the offline efficiency, paid
//     through the same functions as live (orders first, then sales; research credit; Machine Kits
//     to the parts bank; the Bay's stage).
// The report is a timeline: every jam (machine or module blocked 10 s straight) with its time and
// place, each heap filling, orders filled, research finished and the Megaproject's stages, plus
// the totals. Nothing about the time away is hidden, and every number is one the player can check
// against the live factory. The same run, on a copy of the game, is the overnight forecast.
// Sparks pause: the run hides the tab for the sim (`visible` false), so no Spark appears unseen.
import type { Game } from './Game';
import { Num } from '../engine/num';
import { TICK_RATE } from '../engine/time';
import { RULES } from '../data/rules';
import { IDLE, IDLE_UPGRADES } from '../data/idle';
import { BUILD } from '../data/machines';
import { ITEMS, itemName, type ItemId } from '../data/items';
import { RESEARCH, type ResearchId } from '../data/research';
import { ORDER } from '../data/orders';
import { megaStage, MEGA } from '../data/megaprojects';
import { fillOrder, saleValue } from './systems/docks';
import { creditResearch, runResearch } from './systems/research';
import { runOrders } from './systems/orders';
import { megaGive, fname } from './systems/modules';
import { entName } from './analysis';
import { restore } from './snapshot';
import { prules } from './patents';
import type { Ent, FEnt } from './world';

/** The offline efficiency now (DESIGN.md §12, §20): the base 0.5, plus the Night Shift bought with
 * coin, capped at 0.75. Milestone 5's Patent nodes plug in here. */
export function offlineEfficiency(g: Game): number {
  // the base 0.5 plus the Patent tree's offline nodes (DESIGN.md §19), then the Night Shift
  let e = prules(g).offline;
  for (const u of IDLE_UPGRADES) if (g.has(u.id)) e += u.eff;
  return Math.min(IDLE.offlineEffMax.value, e);
}

export type TimelineKind = 'jam' | 'heap' | 'order' | 'research' | 'mega' | 'bay';

/** One thing that happened while away, at `t` seconds into the time away. */
export interface TimelineEntry {
  t: number;
  kind: TimelineKind;
  /** plain words, e.g. "Smelter 3 blocked by slag" */
  text: string;
  /** where (jams and heaps), for the jump-to button */
  x?: number;
  y?: number;
  floor?: 'workshop' | 'factory';
  /** a jam: the item it is blocked by */
  why?: string | null;
  /** worked out from the measured rates rather than replayed tick by tick */
  est?: boolean;
}

export interface OfflineReport {
  /** seconds away, and the part counted (capped at 7 days) */
  away: number;
  counted: number;
  /** seconds simulated tick by tick (the replay and the re-measures), and seconds extrapolated */
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
  /** what happened, in time order (the first IDLE.timelineMax) */
  timeline: TimelineEntry[];
  /** machines and modules already jammed when you left (not on the timeline) */
  jammedAtStart: number;
  /** how many jams happened while away */
  jams: number;
  /** segments re-measured after a heap filled or the Bay was satisfied */
  segments: number;
  /** the first machine or module to jam (kept for the slice's card and older callers) */
  firstJam: { t: number; x: number; y: number; floor: 'workshop' | 'factory'; name: string; why: string | null } | null;
  /** the Slag Heap still filling at the end, and when it fills (seconds from the return) */
  nextHeap: { x: number; y: number; inSeconds: number } | null;
}

/** Deliveries by destination while a tally is open (runDocks and the Bay add to it). */
export interface Tally {
  dock: Partial<Record<ItemId, number>>;
  /** the Factory Dock, apart: Factory-only orders fill from it */
  fdock: Partial<Record<ItemId, number>>;
  hopper: Partial<Record<ItemId, number>>;
  bay: Partial<Record<ItemId, number>>;
}

const newTally = (): Tally => ({ dock: {}, fdock: {}, hopper: {}, bay: {} });
const copyTally = (t: Tally): Tally => ({ dock: { ...t.dock }, fdock: { ...t.fdock }, hopper: { ...t.hopper }, bay: { ...t.bay } });
const KINDS = ['dock', 'fdock', 'hopper', 'bay'] as const;

/** Blocked `n` seconds straight, by the per-second history ('b' output, 'x' byproduct). */
function jammedHist(hist: string, n: number): boolean {
  if (hist.length < n) return false;
  for (let i = hist.length - n; i < hist.length; i++) if (hist[i] !== 'b' && hist[i] !== 'x') return false;
  return true;
}

const heapCap = (g: Game) => prules(g).heapCap; // Deep Heaps (§19)

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
  /** extrapolated deliveries (live ones are in the tally) and the fractional carry per item */
  private extra = newTally();
  private carry: Record<string, number> = {};
  private segments = 0;

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
    // what is already jammed or full when the player leaves is not news
    const J = IDLE.jamSeconds.value;
    for (const m of [...g.miners, ...g.machines]) if (jammedHist(m.hist, J)) { this.jammed.add('w' + m.id); this.jammedAtStart++; }
    for (const m of s.factory.ents) if (m.kind === 'module' && jammedHist(m.hist, J)) { this.jammed.add('f' + m.id); this.jammedAtStart++; }
    for (const h of g.logistics) if (h.kind === 'heap' && h.count >= heapCap(g)) this.heapsFull.add(h.id);
    const ticks = Math.min(Math.floor(this.counted * TICK_RATE), RULES.offlineReplayTicks.value);
    // rates come from the replay's last 5 minutes, after lines have settled
    this.startLive(ticks, Math.min(ticks, 5 * 60 * TICK_RATE));
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
    this.liveLeft = this.liveTotal = ticks;
    this.measureAt = Math.min(ticks, measureTicks);
    this.measureSecs = this.measureAt / TICK_RATE;
    this.mark = null;
    this.phase = ticks > 0 ? 'live' : 'extrap';
    if (ticks > 0 && this.measureAt >= ticks) this.openMeasure();
    if (ticks <= 0) this.measureSecs = 0;
  }

  private openMeasure() {
    if (this.mark) return;
    this.mark = copyTally(this.tally);
    this.heaps0.clear();
    for (const h of this.g.logistics) if (h.kind === 'heap') this.heaps0.set(h.id, h.count);
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
    this.phase = this.counted - this.t > 1e-6 && this.measureSecs > 0 ? 'extrap' : 'done';
  }

  /** Delivery rates per second over the last measuring window. */
  private rates(): Tally {
    const out = newTally();
    if (!this.mark || this.measureSecs <= 0) return out;
    for (const k of KINDS)
      for (const [item, n] of Object.entries(this.tally[k]) as [ItemId, number][]) {
        const r = (n - (this.mark[k][item] ?? 0)) / this.measureSecs;
        if (r > 1e-9) out[k][item] = r;
      }
    return out;
  }

  private extrapolate() {
    const g = this.g;
    const left = this.counted - this.t;
    if (left <= 1e-6) { this.phase = 'done'; return; }
    const rates = this.rates();
    // the next thing that changes the rates: a heap filling, or the Bay getting all it wants of an item
    let dt = left;
    let cause: { heap: Ent } | { bay: ItemId } | null = null;
    for (const [id, rate] of this.heapRate) {
      const h = g.byId.get(id);
      if (!h || h.count >= heapCap(g)) continue;
      const tf = (heapCap(g) - h.count) / rate;
      if (tf < dt) { dt = tf; cause = { heap: h }; }
    }
    const st = megaStage(g.s.mega.stage);
    if (st && this.eff > 0)
      for (const [item, want] of Object.entries(st.wants) as [ItemId, number][]) {
        const r = rates.bay[item] ?? 0;
        const rem = want - (g.s.mega.progress[item]?.toNumber() ?? 0);
        if (r <= 0 || rem <= 0) continue;
        const tb = rem / (r * this.eff);
        if (tb < dt) { dt = tb; cause = { bay: item }; }
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
    this.extrapolated += dt;
    if (cause && 'heap' in cause) {
      cause.heap.count = heapCap(g);
      this.heapFull(cause.heap, this.t, true);
    } else if (cause && 'bay' in cause) {
      // top up the last fraction so the want is met exactly, then say so
      const st2 = megaStage(g.s.mega.stage);
      const want = st2?.wants[cause.bay] ?? 0;
      const rem = Math.ceil(want - (g.s.mega.progress[cause.bay]?.toNumber() ?? 0));
      if (rem > 0) this.giveBay(cause.bay, rem);
      this.push({ t: this.t, kind: 'bay', text: `The Megaproject Bay has all the ${itemName(cause.bay).toLowerCase()} it wants`, est: true });
      this.watch(this.t, true);
    }
    g.events.drain();
    g.tally = this.tally;
    const remaining = this.counted - this.t;
    if (!cause || remaining <= 1e-6) { this.phase = 'done'; return; }
    // replay a few minutes live from here: the jam spreads, then the new rates are measured
    this.segments++;
    const liveSecs = IDLE.settleSeconds.value + IDLE.measureSeconds.value;
    const ticks = Math.min(Math.floor(remaining * TICK_RATE), liveSecs * TICK_RATE);
    this.startLive(ticks, Math.min(ticks, IDLE.measureSeconds.value * TICK_RATE));
  }

  /** Credit `secs` of the measured rates at the offline efficiency, through the live functions. */
  private pay(rates: Tally, secs: number) {
    const g = this.g;
    const s = g.s;
    const k = secs * this.eff;
    const whole = (key: string, x: number): number => {
      const v = x + (this.carry[key] ?? 0);
      const n = Math.floor(v + 1e-9);
      this.carry[key] = v - n;
      return n;
    };
    for (const kind of ['dock', 'fdock'] as const)
      for (const [item, r] of Object.entries(rates[kind]) as [ItemId, number][]) {
        const n = whole(kind + item, r * k);
        if (n <= 0) continue;
        const amt = Num.of(n);
        s.delivered[item] = (s.delivered[item] ?? Num.ZERO).add(amt);
        this.extra[kind][item] = (this.extra[kind][item] ?? 0) + n;
        const left = fillOrder(g, item, amt, kind === 'fdock' ? 'factory' : undefined);
        const v = saleValue(g, item);
        // a one-off for the coin/min statistic: the HUD's rate stays the live one
        if (v > 0 && !left.isZero()) g.earn(left.mul(v), true);
        runOrders(g);
      }
    for (const [item, r] of Object.entries(rates.hopper) as [ItemId, number][]) {
      const n = whole('hopper' + item, r * k);
      if (n <= 0) continue;
      const amt = Num.of(n);
      s.delivered[item] = (s.delivered[item] ?? Num.ZERO).add(amt);
      this.extra.hopper[item] = (this.extra.hopper[item] ?? 0) + n;
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
    this.extra.bay[item] = (this.extra.bay[item] ?? 0) + give;
    megaGive(g, bay, item, give);
  }

  private push(e: TimelineEntry) {
    this.timeline.push(e);
  }

  private heapFull(h: Ent, t: number, est: boolean) {
    if (this.heapsFull.has(h.id)) return;
    this.heapsFull.add(h.id);
    this.push({ t, kind: 'heap', text: 'A Slag Heap is full: the smelters feeding it stop', x: h.x, y: h.y, floor: 'workshop', est });
  }

  /** Once a second of live ticks (and after each credited slice): what changed. */
  private watch(t: number, est: boolean) {
    const g = this.g;
    const s = g.s;
    if (!est) g.events.drain();
    for (const id of s.research.done)
      if (!this.seenResearch.has(id)) { this.seenResearch.add(id); this.push({ t, kind: 'research', text: `Research finished: ${RESEARCH[id].name}`, est }); }
    for (const id of s.orders.done)
      if (!this.seenOrders.has(id)) { this.seenOrders.add(id); this.push({ t, kind: 'order', text: `Order filled: ${ORDER[id]?.name ?? id}`, est }); }
    if (s.mega.stage > this.stageSeen) {
      for (let k = this.stageSeen + 1; k <= s.mega.stage; k++) this.push({ t, kind: 'mega', text: `${MEGA.find((m) => m.stage === k)?.name ?? 'A Megaproject stage'}: done!`, est });
      this.stageSeen = s.mega.stage;
    }
    if (est) return;
    const J = IDLE.jamSeconds.value;
    for (const list of [g.miners, g.machines])
      for (const m of list) {
        if (m.paused || this.jammed.has('w' + m.id) || !jammedHist(m.hist, J)) continue;
        this.jammed.add('w' + m.id);
        this.push({ t: Math.max(0, t - J), kind: 'jam', text: `${entName(g, m)} blocked${m.why ? ' by ' + itemName(m.why).toLowerCase() : ''}`, x: m.x, y: m.y, floor: 'workshop', why: m.why });
      }
    for (const m of s.factory.ents) {
      if (m.kind !== 'module' || m.paused || this.jammed.has('f' + m.id) || !jammedHist(m.hist, J)) continue;
      this.jammed.add('f' + m.id);
      this.push({ t: Math.max(0, t - J), kind: 'jam', text: `${fname(g, m as FEnt)} blocked${m.why ? ' by ' + itemName(m.why).toLowerCase() : ''}`, x: m.x, y: m.y, floor: 'factory', why: m.why });
    }
    for (const h of g.logistics) if (h.kind === 'heap' && h.count >= heapCap(g)) this.heapFull(h, t, false);
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
    const sum = (k: 'dock' | 'fdock' | 'hopper' | 'bay', item: ItemId) => (this.tally[k][item] ?? 0) + (this.extra[k][item] ?? 0);
    const sold: Partial<Record<ItemId, Num>> = {};
    let hopper = Num.ZERO;
    const given: Partial<Record<ItemId, Num>> = {};
    for (const kind of ['dock', 'fdock'] as const)
      for (const item of new Set([...Object.keys(this.tally[kind]), ...Object.keys(this.extra[kind])]) as Set<ItemId>) {
        const n = sum(kind, item);
        if (n > 0) sold[item] = (sold[item] ?? Num.ZERO).add(Math.round(n));
      }
    for (const item of new Set([...Object.keys(this.tally.hopper), ...Object.keys(this.extra.hopper)]) as Set<ItemId>) hopper = hopper.add(Math.round(sum('hopper', item)));
    for (const item of new Set([...Object.keys(this.tally.bay), ...Object.keys(this.extra.bay)]) as Set<ItemId>) {
      const n = sum('bay', item);
      if (n > 0) given[item] = Num.of(Math.round(n));
    }
    const timeline = this.timeline.sort((a, b) => a.t - b.t);
    const jams = timeline.filter((e) => e.kind === 'jam');
    const j = jams[0];
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
      jammedAtStart: this.jammedAtStart,
      jams: jams.length,
      segments: this.segments,
      firstJam: j ? { t: j.t, x: j.x!, y: j.y!, floor: j.floor!, name: j.text.replace(/ blocked.*$/, ''), why: j.why ?? null } : null,
      nextHeap,
    };
  }
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
