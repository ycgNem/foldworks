// Offline progress, v1 (DESIGN.md §12). On load (or when a hidden tab comes back) the app passes
// the seconds away (capped at 24 h). Up to an hour of real ticks is replayed headless through the
// same systems (both floors: Workshop lines item by item, modules as rates), so heaps fill and
// lines jam as they would live; the rest is extrapolated from what reached each Dock and Hopper
// in the replay's last minutes, at the offline efficiency 0.5, and paid through the same
// functions (orders first, then sales; research credit; Machine Kits to the parts bank).
// The report names the first machine that jammed during the replay so the player can go to it,
// and the heap that will fill next, so nothing about the time away is hidden.
import type { Game } from './Game';
import { Num } from '../engine/num';
import { TICK_RATE } from '../engine/time';
import { RULES } from '../data/rules';
import { BUILD } from '../data/machines';
import { ITEMS, type ItemId } from '../data/items';
import type { ResearchId } from '../data/research';
import { fillOrder, saleValue } from './systems/docks';
import { creditResearch, runResearch } from './systems/research';
import { runOrders } from './systems/orders';
import { entName } from './analysis';
import { fname } from './systems/modules';
import { offlineEfficiency } from './patents';

export interface OfflineReport {
  /** seconds away, and the part counted (capped) */
  away: number;
  counted: number;
  /** seconds simulated tick by tick, and seconds extrapolated */
  replayed: number;
  extrapolated: number;
  coin: Num;
  /** items delivered to Hoppers */
  hopper: Num;
  research: ResearchId[];
  orders: string[];
  /** the first machine or module to go blocked during the replay */
  firstJam: { t: number; x: number; y: number; floor: 'workshop' | 'factory'; name: string; why: string | null } | null;
  /** the Slag Heap that was still filling at the end, and when it fills (seconds from the return) */
  nextHeap: { x: number; y: number; inSeconds: number } | null;
}

/** Deliveries by destination while a tally is open (runDocks adds to it). */
export interface Tally {
  dock: Partial<Record<ItemId, number>>;
  hopper: Partial<Record<ItemId, number>>;
}

export function runOffline(g: Game, awaySeconds: number): OfflineReport {
  const s = g.s;
  const counted = Math.max(0, Math.min(awaySeconds, RULES.offlineCapHours.value * 3600));
  const ticks = Math.min(Math.floor(counted * TICK_RATE), RULES.offlineReplayTicks.value);
  const earned0 = s.earned;
  const research0 = new Set(s.research.done);
  const orders0 = new Set(s.orders.done);
  let hopper = Num.ZERO;
  // rates come from the last part of the replay (at most 5 minutes of it), after lines have settled
  const measure = Math.min(ticks, 5 * 60 * TICK_RATE);
  const blocked0 = new Set([...g.machines, ...s.factory.ents].filter((m) => m.state === 'blocked').map((m) => m.id + ':' + ('design' in m ? 'f' : 'w')));
  let firstJam: OfflineReport['firstJam'] = null;
  const t0 = s.tick;
  const heaps0 = new Map<number, number>();
  for (let i = 0; i < ticks; i++) {
    if (i === ticks - measure) {
      g.tally = { dock: {}, hopper: {} };
      for (const h of g.logistics) if (h.kind === 'heap') heaps0.set(h.id, h.count);
    }
    g.tick();
    if (i % TICK_RATE === 0) {
      g.events.drain();
      if (!firstJam) {
        for (const m of g.machines)
          if (m.state === 'blocked' && !blocked0.has(m.id + ':w')) {
            firstJam = { t: (s.tick - t0) / TICK_RATE, x: m.x, y: m.y, floor: 'workshop', name: entName(g, m), why: m.why };
            break;
          }
        if (!firstJam)
          for (const m of s.factory.ents)
            if (m.kind === 'module' && m.state === 'blocked' && !blocked0.has(m.id + ':f')) {
              firstJam = { t: (s.tick - t0) / TICK_RATE, x: m.x, y: m.y, floor: 'factory', name: fname(g, m), why: m.why };
              break;
            }
      }
    }
  }
  g.events.drain();
  const tally = g.tally;
  g.tally = null;
  for (const v of Object.values(tally?.hopper ?? {})) hopper = hopper.add(v ?? 0);
  // the rest: measured delivery rates x the time left x the offline efficiency
  const replayed = ticks / TICK_RATE;
  const rest = Math.max(0, counted - replayed);
  if (rest > 0 && tally && measure > 0) {
    const secs = measure / TICK_RATE;
    const k = (rest / secs) * offlineEfficiency(g);
    for (const [item, n] of Object.entries(tally.dock) as [ItemId, number][]) {
      const amt = Num.of(Math.floor(n * k));
      if (amt.isZero()) continue;
      s.delivered[item] = (s.delivered[item] ?? Num.ZERO).add(amt);
      const left = fillOrder(g, item, amt);
      const v = saleValue(g, item);
      if (v > 0 && !left.isZero()) g.earn(left.mul(v));
      runOrders(g);
    }
    for (const [item, n] of Object.entries(tally.hopper) as [ItemId, number][]) {
      const amt = Num.of(Math.floor(n * k));
      if (amt.isZero()) continue;
      s.delivered[item] = (s.delivered[item] ?? Num.ZERO).add(amt);
      hopper = hopper.add(amt);
      if (ITEMS[item].parts) s.parts = s.parts.add(amt);
      else {
        creditResearch(g, item, amt);
        runResearch(g);
      }
    }
    g.events.drain();
  }
  // the heap filling soonest, measured over the same last minutes (its count still rising)
  let nextHeap: OfflineReport['nextHeap'] = null;
  if (measure > 0) {
    const secs = measure / TICK_RATE;
    for (const h of g.logistics) {
      if (h.kind !== 'heap' || !heaps0.has(h.id)) continue;
      const rate = (h.count - heaps0.get(h.id)!) / secs;
      if (rate <= 1e-6) continue;
      const left = ((BUILD.heap.capacity ?? 400) - h.count) / rate;
      if (!nextHeap || left < nextHeap.inSeconds) nextHeap = { x: h.x, y: h.y, inSeconds: left };
    }
  }
  return {
    away: awaySeconds,
    counted,
    replayed,
    extrapolated: rest,
    coin: s.earned.sub(earned0),
    hopper,
    research: s.research.done.filter((r) => !research0.has(r)),
    orders: s.orders.done.filter((o) => !orders0.has(o)),
    firstJam,
    nextHeap,
  };
}
