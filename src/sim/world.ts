// The sim's state: plain, serializable data (JSON with Nums tagged by Num.toJSON). Everything the
// game remembers lives in `State`; Game.ts keeps only caches derived from it (the tile grid, the
// belt order), rebuilt after a load or a change of layout. Pure: no DOM, timers or clocks.
import { Num } from '../engine/num';
import type { EntKind } from '../data/machines';
import { FACTORY } from '../data/land';
import type { ResearchId } from '../data/research';
import type { ItemId } from '../data/items';
import type { CustomerId } from '../data/orders';
import type { SparkKind } from '../data/sparks';
import type { BuildKind } from '../data/machines';
import type { PatentId } from '../data/patents';

export type Dir = 0 | 1 | 2 | 3;
/** E, S, W, N */
export const DX = [1, 0, -1, 0] as const;
export const DY = [0, 1, 0, -1] as const;
export const opposite = (d: Dir): Dir => ((d + 2) % 4) as Dir;
export const cw = (d: Dir): Dir => ((d + 1) % 4) as Dir;
export const ccw = (d: Dir): Dir => ((d + 3) % 4) as Dir;

export type Floor = 'workshop' | 'factory';

/** What a machine is doing this tick (DESIGN.md §4 status pips). A powered machine with no power
 * is 'starved' with why = 'power' (the blue pip, §18). */
export type MState = 'work' | 'starved' | 'blocked' | 'idle';

/** A powered machine's mode (DESIGN.md §18 Modes, research Tuning). */
export type Mode = 'normal' | 'efficient' | 'overclock' | 'precision';
export const MODES: Mode[] = ['normal', 'efficient', 'overclock', 'precision'];

/** The tiles just outside a footprint's face in direction d: one for a 1x1, two for a 2x2. */
export function faceTiles(e: { x: number; y: number; w: number; h: number }, d: Dir): [number, number][] {
  const out: [number, number][] = [];
  if (d === 0) for (let y = e.y; y < e.y + e.h; y++) out.push([e.x + e.w, y]);
  else if (d === 2) for (let y = e.y; y < e.y + e.h; y++) out.push([e.x - 1, y]);
  else if (d === 1) for (let x = e.x; x < e.x + e.w; x++) out.push([x, e.y + e.h]);
  else for (let x = e.x; x < e.x + e.w; x++) out.push([x, e.y - 1]);
  return out;
}

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
  /** a belt's recent load and jam, smoothed over about 5 s (0..1): the flow overlay's heat map */
  occ: number;
  jam: number;
  // ---- crate (FIFO), heap (count), splitter/merger (one-item buffer)
  store: string[];
  count: number;
  /** round-robin pointer (splitter sides, merger inputs, byproduct sides) */
  rr: number;
  // ---- stats: per-second dominant state over the last minute ('w' 's' 'b' 'i'), newest last
  hist: string;
  /** ticks in each state this second: work, starved, blocked on output, blocked on byproduct */
  sec: [number, number, number, number];
  // ---- Act II (DESIGN.md §18); absent on older saves, read with ?? defaults
  /** a powered machine's mode */
  mode?: Mode;
  /** Overdrive: ticks left at 3x, then ticks left cooling */
  od?: number;
  cool?: number;
  /** Precision's extra output, a fraction of an item carried between crafts */
  bonus?: number;
  /** a Lucky Vein's boost on every machine of its line: ticks left (DESIGN.md §6) */
  boost?: number;
  // ---- Milestone 6 (DESIGN.md §20); absent on older saves
  /** stopped by the player (the 'pause' command): takes nothing, makes nothing, draws no power;
   * splitters route around it as around any full machine */
  paused?: boolean;
  // ---- the bills term (DESIGN.md §19, the Milestone 5-6 final round); absent on older saves
  /** measured work this minute, in ticks: a machine's work x its grid's satisfaction, a Miner's
   * digging, a power producer's burn share */
  wkAcc?: number;
  /** the work of each of the last whole minutes (seconds, newest last, at most RULES.billsWindow) */
  wk?: number[];
  /** a belt or logistics part: the tick it last took an item */
  used?: number;
}

/** A box on the Workshop, in tiles. */
export interface Box { x: number; y: number; w: number; h: number }

/** One measured port of a boxed line: a belt crossing the box edge (DESIGN.md §10). */
export interface Port {
  /** the tile inside the box the belt crosses at */
  x: number;
  y: number;
  /** the direction items travel across the edge */
  dir: Dir;
  io: 'in' | 'out';
}

/** The grade a fold audit gave (DESIGN.md §10 Grade). */
export interface GradeCard {
  letter: string;
  score: number;
  u: number;
  w: number;
  c: number;
  mult: number;
}

/** A fold audit under way, then its result until the player folds or cancels. */
export interface AuditState {
  id: number;
  box: Box;
  /** ticks since it began (warm-up, then the window) */
  t: number;
  /** machines (miners included) in the box when it began */
  ids: number[];
  /** items through the ports during the window, by item: plain counts of a measurement */
  ins: Record<string, number>;
  outs: Record<string, number>;
  /** ticks each machine worked during the window */
  busy: Record<string, number>;
  /** each machine's finished crafts at the window's start (byproducts made = crafts / every) */
  crafts0: Record<string, number>;
  ports: Port[];
  /** set when the window closes */
  result: AuditResult | null;
  /** ticks each machine spent not working, by "state:why" (absent on older saves) */
  stall?: Record<string, Record<string, number>>;
  /** items held inside the box when the window opened (a counted measurement, not a stock) */
  stock0?: Record<string, number>;
}

export interface AuditResult {
  grade: GradeCard;
  /** items per second through the ports, measured (before the grade multiplier) */
  ins: Partial<Record<ItemId, number>>;
  outs: Partial<Record<ItemId, number>>;
  /** byproducts made inside, and how many left by a port or were used inside */
  byMade: number;
  byHandled: number;
  /** machine tiles and box tiles (compactness) */
  machineTiles: number;
  boxTiles: number;
  /** each machine's busy fraction, by id, and what held the slowest back */
  busy: Record<string, number>;
  /** plain-English lines on what would raise the grade, weakest part first */
  advice: string[];
}

/** A module design: a folded line, kept in the inventory and placed on the Factory floor. */
export interface ModuleDesign {
  id: number;
  name: string;
  /** where it was folded, and everything that was in the box (for Unfold) */
  box: Box;
  parts: { kind: EntKind; dx: number; dy: number; rot: Dir; recipe: string | null }[];
  /** items per second at full speed, grade multiplier applied (rates: plain numbers) */
  ins: Partial<Record<ItemId, number>>;
  outs: Partial<Record<ItemId, number>>;
  grade: GradeCard;
  /** the price of the machines (and power buildings) inside, in coin (the stamp bill) */
  bill: number;
  /** 2 for a design folded on the Factory floor out of modules (DESIGN.md §18 Nested folds) */
  depth?: 1 | 2;
  /** a depth-2 design: the modules and trunks it was folded from, relative to its box */
  fparts?: { kind: 'module' | 'trunk'; design: number; dx: number; dy: number; rot: Dir }[];
  /** copies made by stamping so far (n in bill x (1 + 0.5 n)) */
  stamped: number;
  /** copies in the inventory, not placed (a count of modules) */
  spare: number;
  /** the Stamp Press keeps one spare copy of it (DESIGN.md §19, a Patent node) */
  auto?: boolean;
}

export type FKind = 'module' | 'trunk' | 'fdock' | 'fhopper' | 'fbay';

/** One thing on the Factory floor (DESIGN.md §11): modules run as rate functions. */
export interface FEnt {
  id: number;
  kind: FKind;
  x: number;
  y: number;
  w: number;
  h: number;
  /** a module's output side faces rot; its input side is the back */
  rot: Dir;
  /** the design a module is a copy of */
  design: number;
  /** buffers in items (fractional), bounded by RULES.moduleBuffer seconds of the rates */
  inBuf: Record<string, number>;
  outBuf: Record<string, number>;
  /** the run fraction this tick, smoothed for the report */
  f: number;
  fAvg: number;
  state: MState;
  why: string | null;
  /** round-robin over output items */
  rr: number;
  /** a product spilling because its output is full while another still has room, this tick */
  spill?: string | null;
  /** a trunk tile's flow last tick, items/s (for drawing items along it) */
  flow: number;
  /** 'w' 's' 'b' 'i' per second over the last minute */
  hist: string;
  sec: [number, number, number, number];
  /** this second's summed run fraction, and seconds in a row at half speed or better */
  fsum?: number;
  ok?: number;
  /** Overdrive on a module (DESIGN.md §18): ticks left at 3x, then ticks cooling */
  od?: number;
  cool?: number;
  /** a module stopped by the player (DESIGN.md §20): runs at 0 and takes nothing */
  paused?: boolean;
  /** the bills term (DESIGN.md §19): a module's run fraction this minute (ticks) and in each of the
   * last whole minutes (seconds); a trunk's last tick carrying items */
  wkAcc?: number;
  wk?: number[];
  used?: number;
}

export interface FactoryState {
  ents: FEnt[];
  nextId: number;
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
  /** the tick each order was filled on (absent on older saves; Bramble's Town labels read it) */
  doneAt?: Record<string, number>;
  rep: Record<CustomerId, number>;
}

// ---- Reorganize, layer 1 (DESIGN.md §19, Milestone 5)

/** One building of a patented design, relative to its box. */
export interface DesignPart { kind: BuildKind; dx: number; dy: number; rot: Dir; recipe: string | null }

/** A design kept in the Patent Drawer (DESIGN.md §19): a Workshop line folded in some run, kept
 * through every Reorganize, unfolded whole onto its box in a later run (shared as an FWD1 string). */
export interface KeptDesign {
  id: number;
  name: string;
  /** where it was folded on the Workshop (it unfolds there: the land and ore lie the same every run) */
  x: number;
  y: number;
  w: number;
  h: number;
  parts: DesignPart[];
  /** what the audit said when it was kept (null for an imported string: not audited in this save) */
  product: ItemId | null;
  grade: string | null;
  /** its main product per second, grade applied (a rate) */
  rate: number;
  /** the run it was kept in (1 = the first) */
  run: number;
  /** the design it was kept from (absent for an imported string) */
  src?: number;
}

/** What the Patent Office has on file for a product (DESIGN.md §19): the best value filed so far,
 * and what made it up. A Reorganize pays only for a rise in it. */
export interface Filed {
  /** steps folded x grade multiplier x rate tier */
  value: number;
  steps: number;
  grade: string;
  tier: number;
  run: number;
}

/** One finished run, for the Reorganize card and the statistics. */
export interface RunRecord {
  run: number;
  /** its length in ticks */
  ticks: number;
  patents: number;
  earned: Num;
  /** its best coin per minute over 5 minutes (a rate) */
  peakPerMin: number;
}

/** What survives a Reorganize, beside the four kept fields that already lived in the run's state
 * (`mega`, `codex`, `orders.rep`, the trophy flags): see src/sim/reorganize.ts KEPT. */
export interface MetaState {
  /** Reorganizes taken */
  runs: number;
  /** the tick the current run started on (the tick never resets: the command log stays ordered) */
  runStart: number;
  /** unspent, and ever earned */
  patents: Num;
  patentsEarned: Num;
  /** Patent nodes bought */
  nodes: PatentId[];
  /** the Patent Office's record: each product's best filed value (DESIGN.md §19 Filing) */
  patented: Partial<Record<ItemId, Filed>>;
  /** the Patent Drawer: designs kept through every Reorganize, and the Draughtsman's queue (ids) */
  drawer: KeptDesign[];
  nextKept: number;
  queue: number[];
  /** lifetime statistics over every run */
  lifetime: { earned: Num; delivered: Partial<Record<ItemId, Num>>; folds: number };
  history: RunRecord[];
  /** this run's best 5-minute coin per minute so far, and the minutes it is averaged over (rates) */
  peakPerMin: number;
  perMinRing: number[];
}

export function newMeta(): MetaState {
  return {
    runs: 0, runStart: 0, patents: Num.ZERO, patentsEarned: Num.ZERO, nodes: [], patented: {}, drawer: [], nextKept: 1, queue: [],
    lifetime: { earned: Num.ZERO, delivered: {}, folds: 0 }, history: [], peakPerMin: 0, perMinRing: [],
  };
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
  /** firsts the presentation reacts to once (first jam, first sale...) and trophies ('trophy:<id>') */
  flags: string[];
  /** event counts for statistics and trophies (clicks, cranks, shovels, sparks...), not amounts */
  counters: Record<string, number>;
  /** fold audits under way or awaiting a decision (DESIGN.md §10), up to RULES.maxAudits */
  audits: AuditState[];
  nextAudit: number;
  /** module designs (the inventory) */
  designs: ModuleDesign[];
  nextDesign: number;
  factory: FactoryState;
  // ---- Act II (DESIGN.md §18)
  /** Machine Kits in the parts bank (a Hopper takes them there) */
  parts: Num;
  /** deposit claim blocks bought at the Survey Office, by ore */
  claimBlocks: Partial<Record<ItemId, number>>;
  /** items whose first delivery the Codex has paid for */
  codex: ItemId[];
  /** the Megaproject: stages done and what the current stage has been given. Survives every
   * reset (Milestone 5 keeps it apart from the run's state). */
  mega: { stage: number; progress: Partial<Record<ItemId, Num>> };
  /** the Factory-floor fold audit (nested folds), like `audit` on the Workshop */
  faudit: FAuditState | null;
  // ---- Milestone 6 (DESIGN.md §20)
  /** Inspiration credited to each research node, by item (capped at 30% of each item's cost) */
  inspire: Partial<Record<ResearchId, Partial<Record<ItemId, Num>>>>;
  // ---- Reorganize (DESIGN.md §19)
  /** what survives a Reorganize */
  meta: MetaState;
  /** Patents earned so far this run by Megaproject deliveries (a fraction of each stage's worth) */
  megaPatents: number;
  /** coin handed over by head starts this run */
  granted: Num;
  /** Factory annex blocks bought this run, 2x8 each east of the 12x8 floor (DESIGN.md §19 The
   * Factory annex); absent on older saves */
  annex?: number;
  /** kept designs unfolded from the Patent Drawer this run (ids), so the Draughtsman does each once */
  drafted?: number[];
}

/** A nested-fold audit on the Factory floor (DESIGN.md §18 Nested folds). */
export interface FAuditState {
  box: Box;
  t: number;
  /** modules in the box */
  ids: number[];
  /** items in and out through the box edge during the window (fractional: modules run as rates) */
  ins: Record<string, number>;
  outs: Record<string, number>;
  /** the modules' summed run fraction over the window */
  run: Record<string, number>;
  /** byproducts made inside, lost to modules blocked by them, and handed between modules inside */
  made: number;
  missed: number;
  inside: number;
  result: AuditResult | null;
}

export function newFEnt(id: number, kind: FKind, x: number, y: number, rot: Dir, design = 0): FEnt {
  const big = kind === 'fdock' || kind === 'fhopper' || kind === 'fbay';
  return {
    id, kind, x, y, w: big ? 2 : 1, h: big ? 2 : 1, rot, design,
    inBuf: {}, outBuf: {}, f: 0, fAvg: 0, state: 'idle', why: null, rr: 0, flow: 0, hist: '', sec: [0, 0, 0, 0], wk: [],
  };
}

export function newFactory(): FactoryState {
  return {
    ents: [newFEnt(1, 'fdock', FACTORY.dock.x, FACTORY.dock.y, 0), newFEnt(2, 'fhopper', FACTORY.hopper.x, FACTORY.hopper.y, 0)],
    nextId: 3,
  };
}

export function newEnt(id: number, kind: EntKind, x: number, y: number, w: number, h: number, rot: Dir): Ent {
  return {
    id, kind, x, y, w, h, rot,
    recipe: null, inBuf: {}, out: 0, outItem: null, by: 0, byItem: null, prog: 0, active: false, crafts: 0, state: 'idle', why: null,
    item: null, p: 0, mv: false, occ: 0, jam: 0,
    store: [], count: 0, rr: 0,
    hist: '', sec: [0, 0, 0, 0], wk: [],
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
    orders: { active: null, progress: {}, done: [], rep: { bramble: 0, unit7: 0, voltaire: 0, committee: 0 } },
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
    counters: {},
    audits: [],
    nextAudit: 1,
    designs: [],
    nextDesign: 1,
    factory: newFactory(),
    parts: Num.ZERO,
    claimBlocks: {},
    codex: [],
    mega: { stage: 0, progress: {} },
    faudit: null,
    inspire: {},
    meta: newMeta(),
    megaPatents: 0,
    granted: Num.ZERO,
    annex: 0,
  };
}

/** mulberry32 on the state's own seed (the sim's only randomness). */
export function rand(s: State): number {
  let t = (s.rng = (s.rng + 0x6d2b79f5) >>> 0);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
