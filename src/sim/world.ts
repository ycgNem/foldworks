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
import { HIGH, type HighFloorId } from '../data/floors';
import type { WorldId } from '../data/worlds';
import type { LegacyId } from '../data/legacy';
import type { KernelId } from '../data/kernels';

export type Dir = 0 | 1 | 2 | 3;
/** E, S, W, N */
export const DX = [1, 0, -1, 0] as const;
export const DY = [0, 1, 0, -1] as const;
export const opposite = (d: Dir): Dir => ((d + 2) % 4) as Dir;
export const cw = (d: Dir): Dir => ((d + 1) % 4) as Dir;
export const ccw = (d: Dir): Dir => ((d + 3) % 4) as Dir;

export type Floor = 'workshop' | 'factory' | 'district' | 'world' | 'beyond';
/** The floors of modules (rate functions): the Factory and the high floors above it. */
export type ModFloor = Exclude<Floor, 'workshop'>;

/** What a machine is doing this tick (DESIGN.md §4 status pips). A powered machine with no power
 * is 'starved' with why = 'power' (the blue pip, §18). */
export type MState = 'work' | 'starved' | 'blocked' | 'idle';

/** A powered machine's mode (DESIGN.md §18 Modes, research Tuning). */
export type Mode = 'normal' | 'efficient' | 'overclock' | 'precision'
  // Act III (DESIGN.md §21 Modes, research Recycling): half the byproduct, or twice it
  | 'recycling' | 'byproduct';
export const MODES: Mode[] = ['normal', 'efficient', 'overclock', 'precision', 'recycling', 'byproduct'];

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
  // ---- Act IV (DESIGN.md §22); absent elsewhere
  /** a ruin of the Old Works: it does nothing until repaired */
  ruined?: boolean;
  /** a powered machine on Rime running cold this tick (half speed; the frost overlay) */
  cold?: boolean;
  // ---- Act V (DESIGN.md §23); absent elsewhere
  /** Wide Belts (a Kernel node): a belt's second item, half a tile or more behind `item`, and its
   * progress along the tile (it moves up into `item` when that one leaves) */
  item2?: string | null;
  p2?: number;
  // ---- Milestone 11 (DESIGN.md §24); absent elsewhere
  /** placed free by a trophy's bonus (the first n of a kind): it refunds nothing */
  free?: boolean;
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
  /** the refold check (DESIGN.md §19, the final round): the kept design this box is unchanged from,
   * each machine's work during the check, and its product's items out of the box during it */
  kept?: number;
  chk?: Record<string, number>;
  chkOut?: number;
  /** started by the Regrader (a Legacy node, DESIGN.md §22): it folds by itself when graded */
  auto?: boolean;
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
  /** 2 for a design folded on the Factory floor out of modules (DESIGN.md §18 Nested folds), 3 for
   * one folded on the District out of depth-2 modules (§21), 4 on the World (§22) */
  depth?: 1 | 2 | 3 | 4;
  /** a depth-2 design: the modules and trunks it was folded from, relative to its box */
  fparts?: { kind: 'module' | 'trunk'; design: number; dx: number; dy: number; rot: Dir }[];
  /** a depth-3 (or 4) design: the modules it was folded from on its high floor, relative to its
   * box, and the skiff routes between them (indices into hparts) */
  hparts?: { design: number; dx: number; dy: number }[];
  hroutes?: { from: number; to: number; item: ItemId; skiffs: number }[];
  /** the floor a depth-3+ design was folded on (it unfolds back there) */
  hfloor?: 'district' | 'world';
  /** copies made by stamping so far (n in bill x (1 + 0.5 n)) */
  stamped: number;
  /** copies in the inventory, not placed (a count of modules) */
  spare: number;
  /** the Stamp Press keeps one spare copy of it (DESIGN.md §19, a Patent node) */
  auto?: boolean;
  /** every machine in the box ran in its normal mode when it was folded (a kept design refolds
   * after a short check only then: the final round); absent on designs from before */
  normal?: boolean;
}

/** What stands on a floor of modules. The Factory has trunks and its Chute (DESIGN.md §21); the
 * high floors have only modules, a Dock, a Hopper and a Bay (skiff routes join them). */
export type FKind = 'module' | 'trunk' | 'fdock' | 'fhopper' | 'fbay' | 'fchute';

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

/** A skiff route on a high floor (DESIGN.md §21): one item from a module's output to a module, the
 * floor's Dock, Hopper or Bay, flown by `skiffs` skiffs. Throughput: skiffs x load / (2 x distance /
 * speed + dwell). */
export interface SkiffRoute {
  id: number;
  /** entity ids on the floor */
  from: number;
  to: number;
  item: ItemId;
  skiffs: number;
  /** items a second moved, smoothed over about 5 s (the route's readout) */
  flow: number;
  /** this tick's move, items (for the bills term and the drawing) */
  moved: number;
  /** the tick it last carried anything (the bills term counts a route by its use, like a trunk) */
  used?: number;
  /** its first skiff was the Committee's (Pocket Skiffs): not refunded */
  free?: boolean;
  /** it holds the Skiff Guild's free skiff (a Legacy node, DESIGN.md §22): not refunded */
  guild?: boolean;
}

/** A high floor's state: the District, the World (DESIGN.md §21, §22). */
export interface HighFloorState {
  ents: FEnt[];
  nextId: number;
  routes: SkiffRoute[];
  nextRoute: number;
  /** lots bought this run, east of its first width */
  lots: number;
}

/** A fold audit on a high floor: a group of modules joined by routes (DESIGN.md §21 District folds). */
export interface HAuditState extends FAuditState {
  floor: 'district' | 'world';
  /** the Last Fold's audit (DESIGN.md §23): every module on the World at once; what leaves a module
   * for the Dock, Hopper or Bay is its output, and it folds the whole World into the Seed */
  last?: boolean;
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
  /** the audit it was folded with, before the grade multiplier (rates through its ports, and the
   * grade card): an unchanged layout refolds at it after a short check (DESIGN.md §19, the final
   * round). Absent for an imported string, a design kept before the final round, or one folded
   * with a machine out of its normal mode: those refold after a full audit */
  card?: { grade: GradeCard; ins: Partial<Record<ItemId, number>>; outs: Partial<Record<ItemId, number>> };
  /** a nested Factory design kept by the Group Drawer (a Legacy node, DESIGN.md §22): its box is on
   * the Factory floor, and each module tile is named by its product (filled from this run's spare
   * copies of a depth-1 design making it); `parts` is empty */
  nested?: { kind: 'module' | 'trunk'; item: ItemId | null; dx: number; dy: number; rot: Dir }[];
}

/** A District layout kept by the Town Plan (a Legacy node, DESIGN.md §22): each tile named by the
 * product of the group that stood there, and the routes between the tiles (by position). */
export interface TownPlan {
  id: number;
  name: string;
  tiles: { x: number; y: number; item: ItemId; depth: number }[];
  routes: { fx: number; fy: number; tx: number; ty: number; item: ItemId; skiffs: number }[];
}

/** The floors whose best design counts for Legacy (DESIGN.md §22). */
export type LegacyFloor = 'workshop' | 'factory' | 'district' | 'world';

/** A floor's best design this world, or an island's record: its value on the Patent Office's scale. */
export interface FloorBest { value: number; item: ItemId; grade: string; steps: number; tier: number }

/** This world: what has happened since the last Relocate (kept through every Reorganize). */
export interface WorldRun {
  /** the tick the world began on */
  start: number;
  /** each floor's best design this world (DESIGN.md §22 Legacy) */
  best: Partial<Record<LegacyFloor, FloorBest>>;
  /** Megaproject stages done this world */
  stages: number;
  /** the World floor has stood this world */
  opened: boolean;
  /** Reorganizes taken this world */
  runs: number;
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
  /** it ended with a Relocate to this island, banking this much Legacy (DESIGN.md §22) */
  relocate?: WorldId;
  legacy?: number;
  /** it ended with the Last Fold, banking this many Kernels (DESIGN.md §23) */
  lastFold?: number;
}

/** What the Last Fold folded (DESIGN.md §23): the Seed's card, kept for good. */
export interface SeedCard {
  /** the universe it ended (1 = the first) */
  universe: number;
  grade: string;
  value: number;
  kernels: number;
  /** modules counted, and the most valuable product among them */
  modules: number;
  item: ItemId | null;
  /** the island it was folded on */
  world: WorldId;
}

/** The Endless Ledger (DESIGN.md §23): orders filled so far, and what the open one has been given. */
export interface LedgerState {
  n: number;
  progress: Partial<Record<ItemId, Num>>;
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
  /** Challenges completed, for good (DESIGN.md §21); absent on older saves */
  challenges?: string[];
  // ---- Relocate, layer 2 (DESIGN.md §22); absent on older saves (Home, nothing banked)
  /** the island the town is on (absent: Home) */
  world?: WorldId;
  /** Legacy unspent, and ever earned; the Legacy tree's nodes bought */
  legacy?: Num;
  legacyEarned?: Num;
  legacyNodes?: LegacyId[];
  /** islands visited (Home included) */
  visited?: WorldId[];
  /** each island's best design per floor, ever (the worlds' records) */
  worldRecords?: Partial<Record<WorldId, Partial<Record<LegacyFloor, FloorBest>>>>;
  /** this world: since the last Relocate */
  here?: WorldRun;
  /** Relocates taken */
  relocations?: number;
  /** Old Habits: the Patent nodes kept through a Relocate */
  habits?: PatentId[];
  /** the Standing Committee: Reorganize by itself at this many Patents (null: off) */
  standing?: number | null;
  /** the Town Plan's kept District layouts */
  plans?: TownPlan[];
  nextPlan?: number;
  /** room kept through a Reorganize (the Sky Anchor's stages): annex blocks, District and World lots */
  keptRoom?: { annex?: number; district?: number; world?: number };
  /** Field Notes (Unit 7's rep 5): `island:item` keys the Codex has paid on each island */
  fieldNotes?: string[];
  // ---- the Last Fold, layer 3 (DESIGN.md §23); absent on older saves (nothing folded yet)
  /** Kernels unspent, and ever earned; the Kernel tree's nodes bought */
  kernels?: Num;
  kernelsEarned?: Num;
  kernelNodes?: KernelId[];
  /** Last Folds taken (the universe is lastFolds + 1); the Seed's card from each */
  lastFolds?: number;
  seeds?: SeedCard[];
  /** Kept Legacy: the Legacy nodes kept through the next Last Fold */
  keptLegacy?: LegacyId[];
  /** the Endless Ledger, and the cosmetics it has paid (machine skin ids), kept through every reset */
  ledger?: LedgerState;
  cosmetics?: string[];
  // ---- the long tail (DESIGN.md §24, Milestone 11); absent on older saves
  /** the skin chosen for each kind of building (a cosmetic id from meta.cosmetics) */
  skins?: Record<string, string>;
  /** the efficiency boards: each Scenario board's personal bests, kept through every reset */
  boards?: Record<string, BoardRecord>;
}

/** A Scenario board's personal bests (DESIGN.md §24 The efficiency boards): each the best of its
 * own over every fold of the board's product, so the four may come from four designs. Rates are a
 * minute, grade applied. */
export interface BoardRecord {
  /** the board's own score (its measure, §21), and the grade of the fold that made it */
  score: number;
  grade: string;
  /** the product a minute per tile of the fold box */
  perTile: number;
  /** the product a minute per kW its machines draw (0: no powered fold yet) */
  perKw: number;
  /** the share of its byproducts not used or carried out (0 = none wasted; 1 when none folded) */
  waste: number;
}

export function newMeta(): MetaState {
  return {
    runs: 0, runStart: 0, patents: Num.ZERO, patentsEarned: Num.ZERO, nodes: [], patented: {}, drawer: [], nextKept: 1, queue: [],
    lifetime: { earned: Num.ZERO, delivered: {}, folds: 0 }, history: [], peakPerMin: 0, perMinRing: [],
    world: 'home', legacy: Num.ZERO, legacyEarned: Num.ZERO, legacyNodes: [], visited: ['home'], worldRecords: {}, here: newWorldRun(0), relocations: 0,
    kernels: Num.ZERO, kernelsEarned: Num.ZERO, kernelNodes: [], lastFolds: 0, seeds: [], keptLegacy: [], ledger: { n: 0, progress: {} }, cosmetics: [],
    skins: {}, boards: {},
  };
}

/** A world just arrived at (DESIGN.md §22). */
export function newWorldRun(tick: number): WorldRun {
  return { start: tick, best: {}, stages: 0, opened: false, runs: 0 };
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
  // ---- Act III (DESIGN.md §21); absent on older saves
  /** the District, once Zoning is researched this run */
  district?: HighFloorState;
  /** the World floor (Act IV) */
  world?: HighFloorState;
  /** Beyond, the fifth floor (Act V, DESIGN.md §23: the Kernel node Beyond and research The Last Fold) */
  beyond?: HighFloorState;
  /** a fold audit on a high floor (one at a time, like the Factory's) */
  haudit?: HAuditState | null;
  /** what the Factory Chute has dropped to the Workshop and the Chute Mouths have not pushed out
   * yet, by item (fractional items: modules hand over rates) */
  chute?: Partial<Record<ItemId, number>>;
  /** Megaprojects #2 and on: stages done and what the current stage has been given, by project.
   * Survives every reset (DESIGN.md §21), like `mega`. */
  megas?: Partial<Record<string, MegaState>>;
  /** the Old Works' rubble still lying this run (tile indices y x 24 + x, DESIGN.md §22) */
  rubble?: number[];
  /** this run's Challenge, if it is one (DESIGN.md §21 Challenges): its rules hold until its goal
   * is met */
  challenge?: string | null;
  /** the Scenario this game is (DESIGN.md §21 Scenarios): a separate game in its own save slot */
  scenario?: string;
  /** the Challenge's starting count of S folds (its goal is one more, DESIGN.md §21) */
  challengeBase?: number;
  /** lots a high floor opens with this run (District Deeds, a head start) */
  headLots?: number;
}

/** A Megaproject's progress (#2 on). `stage` counts the stages done; `progress` is the stage being
 * built now. Megaprojects #4 and #5 build their stages in any order, one on each island (DESIGN.md
 * §22): `done` lists the stages that stand, and `held` keeps another island's stage's progress
 * while the town is elsewhere (a Relocate puts it back when the town returns). */
export interface MegaState {
  stage: number;
  progress: Partial<Record<ItemId, Num>>;
  done?: number[];
  held?: Record<string, Partial<Record<ItemId, Num>>>;
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

/** A high floor as it opens: its Dock and Hopper on the east edge, nothing else (DESIGN.md §21). */
export function newHighFloor(id: HighFloorId): HighFloorState {
  const f = HIGH[id];
  return {
    ents: [newFEnt(1, 'fdock', f.dock.x, f.dock.y, 0), newFEnt(2, 'fhopper', f.hopper.x, f.hopper.y, 0)],
    nextId: 3, routes: [], nextRoute: 1, lots: 0,
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
