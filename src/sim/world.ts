// The sim's state: plain, serializable data (JSON with Nums tagged by Num.toJSON). Everything the
// game remembers lives in `State`; Game.ts keeps only caches derived from it (the tile grid, the
// belt order), rebuilt after a load or a change of layout. Pure: no DOM, timers or clocks.
import { Num } from '../engine/num';
import type { EntKind } from '../data/machines';
import type { ResearchId } from '../data/research';
import type { ItemId } from '../data/items';
import type { CustomerId } from '../data/orders';
import type { SparkKind } from '../data/sparks';

export type Dir = 0 | 1 | 2 | 3;
/** E, S, W, N */
export const DX = [1, 0, -1, 0] as const;
export const DY = [0, 1, 0, -1] as const;
export const opposite = (d: Dir): Dir => ((d + 2) % 4) as Dir;
export const cw = (d: Dir): Dir => ((d + 1) % 4) as Dir;
export const ccw = (d: Dir): Dir => ((d + 3) % 4) as Dir;

export type Floor = 'workshop' | 'factory';

/** What a machine is doing this tick (DESIGN.md §4 status pips). */
export type MState = 'work' | 'starved' | 'blocked' | 'idle';

/** One building on the Workshop floor. A flat record: fields a kind doesn't use stay at defaults. */
export interface Ent {
  id: number;
  kind: EntKind;
  x: number;
  y: number;
  w: number;
  h: number;
  rot: Dir;
  // ---- machines (miner, smelter, press, assembler, furnace)
  /** the recipe it crafts; null = it picks one from the first input that arrives */
  recipe: string | null;
  /** input buffer: item -> count (bounded: 2 crafts' worth, DESIGN.md §4) */
  inBuf: Record<string, number>;
  /** main output waiting to leave the front */
  out: number;
  outItem: string | null;
  /** byproduct waiting to leave a side */
  by: number;
  byItem: string | null;
  /** seconds into the current craft */
  prog: number;
  /** a craft is under way (its inputs are taken) */
  active: boolean;
  /** crafts finished (a byproduct every N) */
  crafts: number;
  state: MState;
  /** the item it is starved of or blocked by */
  why: string | null;
  // ---- belts
  item: string | null;
  /** progress along the tile, 0..1 */
  p: number;
  /** the item moved this tick (for render interpolation) */
  mv: boolean;
  // ---- crate (FIFO), heap (count), splitter/merger (one-item buffer)
  store: string[];
  count: number;
  /** round-robin pointer (splitter sides, merger inputs, byproduct sides) */
  rr: number;
  // ---- stats: per-second dominant state over the last minute ('w' 's' 'b' 'i'), newest last
  hist: string;
  /** ticks in each state this second: work, starved, blocked on output, blocked on byproduct */
  sec: [number, number, number, number];
}

export interface Spark {
  kind: SparkKind;
  /** tile it sits on */
  x: number;
  y: number;
  /** ticks left visible */
  life: number;
  /** the line (entity ids) an Inspector is looking at */
  line?: number[];
}

export interface ResearchState {
  done: ResearchId[];
  selected: ResearchId | null;
  /** delivered toward each node, by item */
  progress: Partial<Record<ResearchId, Partial<Record<ItemId, Num>>>>;
  /** delivered with nothing selected (or not needed by the selected node), by item */
  bank: Partial<Record<ItemId, Num>>;
}

export interface OrderState {
  /** the active special order, if any */
  active: string | null;
  /** delivered toward each order, by item */
  progress: Record<string, Partial<Record<ItemId, Num>>>;
  done: string[];
  rep: Record<CustomerId, number>;
}

export interface State {
  seed: number;
  tick: number;
  /** the sim's random state (mulberry32 seed) */
  rng: number;
  coin: Num;
  /** every coin ever earned this run (Reorganize reads it later) */
  earned: Num;
  /** owned land chunks */
  land: string[];
  upgrades: string[];
  ents: Ent[];
  nextId: number;
  research: ResearchState;
  orders: OrderState;
  /** Sparks on the map, and ticks until the next one */
  sparks: Spark[];
  nextSpark: number;
  /** Sparks are paused while the tab is hidden (DESIGN.md §6) */
  visible: boolean;
  /** Lucky Veins: patch index -> ticks left */
  veins: Record<string, number>;
  /** free Buffer Crates waiting (Bramble rep 2) and ticks to the next */
  freeCrates: number;
  freeCrateIn: number;
  /** clicks counted in the current 1 s window, and when it started (the 12/s cap) */
  clicks: number;
  clickWindow: number;
  /** coin earned per second over the last minute (a rate statistic, plain numbers), newest last */
  income: number[];
  incomeSec: number;
  /** items delivered to the Dock and Hopper, by item, all run */
  delivered: Partial<Record<ItemId, Num>>;
  /** firsts the presentation reacts to once (first jam, first sale...) */
  flags: string[];
}

export function newEnt(id: number, kind: EntKind, x: number, y: number, w: number, h: number, rot: Dir): Ent {
  return {
    id, kind, x, y, w, h, rot,
    recipe: null, inBuf: {}, out: 0, outItem: null, by: 0, byItem: null, prog: 0, active: false, crafts: 0, state: 'idle', why: null,
    item: null, p: 0, mv: false,
    store: [], count: 0, rr: 0,
    hist: '', sec: [0, 0, 0, 0],
  };
}

export function newState(seed: number): State {
  return {
    seed,
    tick: 0,
    rng: seed >>> 0 || 0x9e3779b9,
    coin: Num.ZERO,
    earned: Num.ZERO,
    land: ['A'],
    upgrades: [],
    ents: [],
    nextId: 1,
    research: { done: [], selected: null, progress: {}, bank: {} },
    orders: { active: null, progress: {}, done: [], rep: { bramble: 0 } },
    sparks: [],
    nextSpark: 0,
    visible: true,
    veins: {},
    freeCrates: 0,
    freeCrateIn: 0,
    clicks: 0,
    clickWindow: 0,
    income: [],
    incomeSec: 0,
    delivered: {},
    flags: [],
  };
}

/** mulberry32 on the state's own seed (the sim's only randomness). */
export function rand(s: State): number {
  let t = (s.rng = (s.rng + 0x6d2b79f5) >>> 0);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
