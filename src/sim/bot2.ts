// The Act II bot (ROADMAP.md Milestone 4, DESIGN.md §18): a competent player from the slice's end
// to the Great Drill's stage 1. The Act I planner (bot.ts) plays the slice; at its end (three
// products chained on the Factory floor) this policy takes the hands. Like bot.ts it is honest:
//  - every action goes through g.act (command history replays exactly), never a state write;
//  - building commands (place, remove, turn, select, stamp, fold, trunk) at 4 a second at most;
//  - map clicks (Sparks and Overdrive) at 4 a second at most, on their own pace;
//  - a Spark is clicked about 2 s after it appears, never before;
//  - it looks at what the screen shows (the map, buffers, pips, research and order progress).
//
// Shape of the policy. Act II's new thinking is ratios and power, so the Workshop's new chunks
// (E, F, and the free corner of B by the copper patch) are a line lab: each line is laid out from
// a fixed plan (LAYOUTS below), fed by belts, powered by its own plant, and folded into a module
// once it runs; the lab is rebuilt or rearranged for the next line. Research items reach the
// Workshop Hopper by a spine belt down chunk E's west edge and a corridor through chunk B found by
// search (so the policy composes with whatever the Act I planner left in chunks A-D). On the
// Factory floor a small planner places module copies and trunk belts by search: sources into the
// Factory Hopper (research), the Factory Dock (coin and orders) and the Megaproject Bay, byproducts
// out of a side trunk to whatever uses them (slag into concrete, oil into the concrete plant's
// boiler) or to the Dock.
//
// Options model §16 rule 4's two players: `overdrive` (an active player clicking Overdrive on busy
// machines, capped), `sparks` and `build`. With everything off the bot does nothing: idle play.
import type { Game, Cmd } from './Game';
import type { Bot } from './bot';
import { DX, DY, ccw, cw, opposite, type Box, type Dir, type Ent, type FEnt, type ModuleDesign } from './world';
import { BUILD, isMachine, type BuildKind } from '../data/machines';
import { RESEARCH, type ResearchId } from '../data/research';
import { CHUNKS, FACTORY } from '../data/land';
import { RECIPE } from '../data/recipes';
import { ORDER, ORDERS } from '../data/orders';
import type { ItemId } from '../data/items';
import { TICK_RATE } from '../engine/time';
import { available } from './systems/research';
import { offeredOrders } from './systems/orders';
import { auditLock, foldRefusal } from './systems/audits';
import { BYPRODUCTS, kitsFor, mainItem, stampCost, stampRefusal } from './systems/modules';
import { ffoldRefusal } from './systems/nested';
import { shares } from './systems/stats';
import { recipeKnown } from './transfer';

/** E S W N */
const E: Dir = 0, S: Dir = 1, W: Dir = 2, N: Dir = 3;

const HAND_TICKS = TICK_RATE / 4;
const CLICK_TICKS = TICK_RATE / 4;
const SPARK_NOTICE = 2 * TICK_RATE;
/** An active player's Overdrive clicks: one every this many ticks at most (2 a second), leaving
 * the other half of the 4 clicks/s for Sparks. */
const OD_TICKS = TICK_RATE / 2;

// ------------------------------------------------------------------ layouts

export interface Pl {
  kind: BuildKind;
  x: number;
  y: number;
  rot: Dir;
  recipe?: string;
  /** a feed into the spine: turned to `off` while research needs none of these items (a player
   * turning a miner away once the Hopper's bank holds enough, so the spine carries what is short) */
  gate?: ItemId[];
  off?: Dir;
}

/** Gate a part: on (its own rot) while research still needs one of `items`, else turned to `off`. */
const gated = (pls: Pl[], items: ItemId[], off: Dir): Pl[] => pls.map((p) => ({ ...p, gate: items, off }));

const KIND: Record<string, BuildKind> = {
  b: 'belt', m: 'miner', s: 'smelter', p: 'press', a: 'assembler', h: 'heap', S: 'splitter', J: 'merger', c: 'crate',
  B: 'boiler', e: 'steamEngine', g: 'generator', o: 'pole', k: 'kiln', x: 'mixer', r: 'refinery',
};
const ROT: Record<string, Dir> = { '>': E, v: S, '<': W, '^': N, '.': E };

/** A layout drawn as rows of 2-character cells (kind letter + direction), top-left at (ox, oy);
 * `..` is a tile the layout leaves alone. Recipes by "x,y". */
export function draw(ox: number, oy: number, rows: string[], recipes: Record<string, string> = {}): Pl[] {
  const out: Pl[] = [];
  rows.forEach((row, dy) => {
    for (let i = 0; i + 1 < row.length; i += 2) {
      const k = row[i], r = row[i + 1];
      if (k === '.') continue;
      const kind = KIND[k];
      if (!kind) throw new Error(`layout: unknown kind '${k}'`);
      const x = ox + i / 2, y = oy + dy;
      out.push({ kind, x, y, rot: ROT[r] ?? E, recipe: recipes[`${x},${y}`] });
    }
  });
  return out;
}

const belts = (pts: [number, number, Dir][]): Pl[] => pts.map(([x, y, rot]) => ({ kind: 'belt', x, y, rot }));

/**
 * The lab's parts (x 16-23 is chunks E and F; x 12-15 the free corner of chunk B by the copper
 * patch). The map once everything is up (coal `:` E (17-18, 2-3) and F (18-19, 11-12), sand E
 * (20-21, 5-6), iron F (21-22, 13-14)):
 *
 *        x 12  16      23
 *     y0   ...v<<<<<<<..      G&P belt: glass and plastic west along row 0, down (15,0) into the
 *     y1   ...vv.g.^^..       circuit assembler at (15,2)
 *     y2   msp a v m m o^^    B: copper miner (12,2) > smelter > wire press > circuit assembler
 *     y3   .v..v m m r>^^     E: refinery (19,3) fed by coal (18,3), oil south from (19,4)
 *     ...
 */
export const PARTS: Record<string, Pl[]> = {
  // the spine: chunk E's west column carries research items down to (16,6), which turns west into
  // the corridor (found by search) to the Workshop Hopper
  spine: belts([[16, 1, S], [16, 2, S], [16, 3, S], [16, 4, S], [16, 5, S], [16, 6, W], [16, 7, N]]),
  // research coal: two miners on E's coal patch, straight into the spine
  coalFeed: gated(draw(17, 2, ['m<', 'm<']), ['coal'], N),
  // research sand: a miner on E's sand patch, west along row 6 into the spine's turn
  sandFeed: [...draw(17, 6, ['b<b<b<']), ...gated(draw(20, 6, ['m<']), ['sand'], N)],
  // F's steel line (box 19,11 3x3): iron miner (21,13) north into the ingot smelter (21,12)? no:
  // iron miner (21,13) west into the ingot smelter (20,13), which hands ingots north into the
  // steel smelter (20,12); coal from the miner (19,12) into its west side; steel north and west
  // along row 10 to the spine column; steel's slag east (21,12) and north up column 23
  steel: [
    ...draw(19, 11, ['..b^..', 'm>s^b>', 'h.s^m<'], { '20,12': 'smeltSteel', '20,13': 'smeltIron' }),
    ...belts([[20, 10, W], [19, 10, W], [18, 10, W], [17, 10, W], [16, 10, N], [16, 9, N], [16, 8, N]]),
    ...belts([[22, 12, E], [23, 12, N], [23, 11, N]]),
  ],
  // the steel line's slag into a heap (a buffer: it drains north into the gravel press later)
  steelSlagHeap: draw(23, 10, ['h^']),
  // glass and plastic west along row 0, down chunk B's column 15 into (15,2)
  gpFeed: [...gated(belts([[16, 0, W]]), ['glass', 'plastic'], N), ...belts([[15, 0, S], [15, 1, S]])],
  // after Circuits: glass and plastic share one belt, so a splitter at (15,1) sends what the
  // assembler can't take on into the spine (a shared belt into one side jams on any ratio drift)
  gpFeed2: [...belts([[16, 0, W], [15, 0, S]]), ...draw(15, 1, ['Sv'])],
  // B: copper miner (12,2) > smelter > wire press > (15,2), slag south into a heap at (13,4)
  wireB: [...draw(12, 2, ['m>s>'], { '13,2': 'smeltCopper' }), ...gated(draw(14, 2, ['p>'], { '14,2': 'drawWire' }), ['copperWire'], S), ...draw(13, 3, ['bv']), ...draw(13, 4, ['h.'])],
  wireB2: [...draw(12, 2, ['m>s>p>'], { '13,2': 'smeltCopper', '14,2': 'drawWire' }), ...draw(13, 3, ['bv']), ...draw(13, 4, ['h.'])],
  // before Circuits: wire, glass and plastic straight on into the spine (research)
  wireOut: draw(15, 2, ['b>']),
  // after Circuits: the circuit assembler takes wire from behind, glass and plastic from above
  circuitAsm: draw(15, 2, ['a>'], { '15,2': 'etchCircuit' }),
  // E's glass and plastic works (box 18,0 4x6, its own grid): a generator fed by coal (18,2), the
  // pole (19,2), a kiln (21,4) fed by sand (21,5), glass north up column 21 and west along row 0
  gp: [
    ...draw(17, 0, ['b<b<b<b<b<']),
    ...draw(18, 1, ['g...b^b^']),
    ...draw(18, 2, ['m^o.b^b^']),
    ...draw(18, 3, ['m>..b^b^']),
    ...draw(21, 4, ['k^']),
    ...draw(21, 5, ['m^']),
  ],
  // after Refining: the refinery (19,3) takes coal from (18,3), plastic north up column 20, its
  // oil south down column 19
  refinery: [...draw(19, 3, ['r>'], { '19,3': 'refinePlastic' }), ...belts([[19, 4, S]])],
  // before Splitters: the oil runs on south into the sand feed's belt (and so into the spine)
  oilBelt: belts([[19, 5, S]]),
  // after Splitters: the oil splits at (19,5): south to the concrete plant's boiler, west along
  // row 5 into the spine (so a full boiler never stops the refinery)
  oilSplit: [...draw(19, 5, ['Sv']), ...belts([[18, 5, W], [17, 5, W]])],
  // after Crushing: the slag heap drains north into a gravel press (22,8); gravel and sand west
  // along row 8 into the spine
  gravel: [
    ...belts([[23, 9, N], [23, 8, W]]),
    ...draw(22, 8, ['p<'], { '22,8': 'crushGravel' }),
    ...draw(21, 6, ['mv']), ...belts([[21, 7, S]]),
    ...gated(belts([[17, 8, W]]), ['gravel', 'sand', 'concrete'], N), ...belts([[18, 8, W], [19, 8, W], [20, 8, W]]),
  ],
  gravelOut: belts([[21, 8, W]]),
  // after Concrete: the mixer (21,8) takes gravel from behind and sand from above; its plant is a
  // boiler (19,7) burning the refinery's oil and an engine (20,7), on the pole (21,9): a grid of
  // its own, 7 tiles from E's (box 19,6 4x4)
  concrete: [
    ...draw(21, 8, ['x<'], { '21,8': 'mixConcrete' }),
    ...belts([[19, 6, S]]),
    ...draw(19, 7, ['B>e.']),
    ...draw(21, 9, ['o.']),
  ],
};

// ------------------------------------------------------------------ the plan

export type Dest = { k: 'dock' } | { k: 'hopper' } | { k: 'bay' } | { k: 'mod'; id: string };

export type Step =
  | { k: 'land'; id: string }
  | { k: 'need'; r: ResearchId }
  | { k: 'parts'; parts: string[] }
  | { k: 'corridor'; name: string; from: [number, number]; enter: Dir; to: 'hopper' | 'dock' }
  | { k: 'fold'; box: Box; name: string; ready?: (g: Game, b: Act2Bot) => boolean }
  | { k: 'fmod'; id: string; design: string; to: Dest; by?: Dest }
  | { k: 'order'; id: string }
  | { k: 'wait'; label: string; until: (g: Game, b: Act2Bot) => boolean }
  | { k: 'mark'; name: string };

/** Research the plan wants, in order (a node already paid for by the bank goes first). */
export const WISH: ResearchId[] = [
  'coalSeams', 'steelmaking', 'steamPower', 'overdrive', 'glassworks', 'crushing', 'refining', 'circuits', 'splitters', 'concrete',
  'machineKits', 'heavyMachines', 'tuning', 'motors', 'nestedFolds', 'greatDrill',
];

const BASE = ['spine', 'corridor', 'coalFeed'];

export const PLAN2: Step[] = [
  { k: 'need', r: 'coalSeams' },
  { k: 'land', id: 'E' },
  { k: 'parts', parts: ['spine', 'coalFeed', 'sandFeed'] },
  { k: 'corridor', name: 'corridor', from: [15, 6], enter: W, to: 'hopper' },
  { k: 'need', r: 'steamPower' },
  { k: 'land', id: 'F' },
  { k: 'parts', parts: [...BASE, 'sandFeed', 'steel', 'steelSlagHeap'] },
  { k: 'fold', box: { x: 19, y: 11, w: 3, h: 3 }, name: 'Steel', ready: (g) => working(g, 20, 12, 20) },
  { k: 'fmod', id: 'steelDock', design: 'Steel', to: { k: 'dock' }, by: { k: 'dock' } },
  { k: 'order', id: 'calibration' },
  { k: 'need', r: 'glassworks' },
  { k: 'parts', parts: [...BASE, 'sandFeed', 'steel', 'steelSlagHeap', 'gpFeed', 'wireB', 'wireOut', 'gp'] },
  { k: 'fmod', id: 'steelHop', design: 'Steel', to: { k: 'hopper' }, by: { k: 'dock' } },
  { k: 'need', r: 'crushing' },
  { k: 'parts', parts: [...BASE, 'sandFeed', 'steel', 'steelSlagHeap', 'gpFeed', 'wireB', 'wireOut', 'gp', 'gravel', 'gravelOut'] },
  { k: 'need', r: 'refining' },
  { k: 'parts', parts: [...BASE, 'sandFeed', 'steel', 'steelSlagHeap', 'gpFeed', 'wireB', 'wireOut', 'gp', 'gravel', 'gravelOut', 'refinery', 'oilBelt'] },
  { k: 'need', r: 'circuits' },
  { k: 'need', r: 'splitters' },
  { k: 'parts', parts: [...BASE, 'sandFeed', 'steel', 'steelSlagHeap', 'gpFeed2', 'wireB2', 'circuitAsm', 'gp', 'gravel', 'gravelOut', 'refinery', 'oilBelt'] },
  { k: 'fold', box: { x: 12, y: 2, w: 4, h: 2 }, name: 'Circuits', ready: (g) => working(g, 15, 2, 20) },
  { k: 'need', r: 'splitters' },
  { k: 'parts', parts: [...BASE, 'sandFeed', 'steel', 'steelSlagHeap', 'gpFeed2', 'wireB2', 'circuitAsm', 'gp', 'gravel', 'gravelOut', 'refinery', 'oilSplit'] },
  { k: 'fold', box: { x: 18, y: 0, w: 4, h: 6 }, name: 'Glass & plastic', ready: (g) => working(g, 19, 3, 20) && working(g, 21, 4, 20) },
  { k: 'fmod', id: 'circ1', design: 'Circuits', to: { k: 'hopper' }, by: { k: 'dock' } },
  { k: 'need', r: 'concrete' },
  { k: 'parts', parts: [...BASE, 'steel', 'steelSlagHeap', 'gpFeed2', 'wireB2', 'circuitAsm', 'gp', 'gravel', 'refinery', 'oilSplit', 'concrete'] },
  { k: 'fold', box: { x: 19, y: 6, w: 4, h: 4 }, name: 'Concrete', ready: (g) => working(g, 21, 8, 20) },
  { k: 'fmod', id: 'conc1', design: 'Concrete', to: { k: 'hopper' } },
  { k: 'fmod', id: 'gp1', design: 'Glass & plastic', to: { k: 'mod', id: 'circ1' }, by: { k: 'mod', id: 'conc1' } },
  { k: 'fmod', id: 'steelConc', design: 'Steel', to: { k: 'hopper' }, by: { k: 'mod', id: 'conc1' } },
  { k: 'mark', name: 'end' },
];

/** Is the machine at (x, y) working, and has it been for most of the last `sec` seconds? */
export function working(g: Game, x: number, y: number, sec: number): boolean {
  const m = g.entAt(x, y);
  if (!m || !isMachine(m.kind) || m.state !== 'work') return false;
  const h = m.hist.slice(-sec);
  return h.length >= sec && [...h].filter((c) => c === 'w').length >= sec * 0.7;
}

// ------------------------------------------------------------------ the bot

export interface Act2Opts {
  /** build, research, fill orders (the plan) */
  build?: boolean;
  /** click Overdrive on busy machines */
  overdrive?: boolean;
  /** click Sparks */
  sparks?: boolean;
  /** shovel slag out of jammed machines */
  shovel?: boolean;
}

export interface Act2Log {
  at: Record<string, number>;
  decisions: number[];
  what: string[];
  clicks: number[];
  overdrives: number[];
  shovels: number;
  cmds: number[];
  /** the step reached and why it waits, for the logs */
  step: number;
  waiting: string;
}

export class Act2Bot {
  log: Act2Log = { at: {}, decisions: [], what: [], clicks: [], overdrives: [], shovels: 0, cmds: [], step: 0, waiting: '' };
  step = 0;
  /** ids of Workshop buildings this bot placed */
  mine = new Set<number>();
  /** the current desired layout (parts by name) */
  layout: string[] = [];
  /** parts found by search (corridors) */
  found: Record<string, Pl[]> = {};
  /** modules this bot placed on the Factory floor, by label */
  mods: Record<string, number> = {};
  private handFree = 0;
  private lookAt = 0;
  private placeAt = 0;
  private clickAt = 0;
  private odAt = 0;
  private sparkSeen = new Map<string, number>();
  private seenDone = 0;
  private seenOrders = 0;
  private odNext = 0;
  /** queued Factory-floor commands of a placement under way */
  private fq: Cmd[] = [];
  private fqFor: string | null = null;
  readonly plan: Step[];
  readonly opts: Required<Act2Opts>;

  constructor(public g: Game, opts: Act2Opts = {}, plan: Step[] = PLAN2) {
    this.plan = plan;
    this.opts = { build: opts.build ?? true, overdrive: opts.overdrive ?? true, sparks: opts.sparks ?? true, shovel: opts.shovel ?? true };
    this.seenDone = g.s.research.done.length;
    this.seenOrders = g.s.orders.done.length;
  }

  // ---------------------------------------------------------------- hands

  private act(c: Cmd): boolean | null {
    const t = this.g.s.tick;
    if (c.k === 'click') {
      if (t < this.clickAt) return null;
      this.clickAt = t + CLICK_TICKS;
      this.log.clicks.push(t);
    } else {
      if (t < this.handFree) return null;
      this.handFree = t + HAND_TICKS;
    }
    this.log.cmds.push(t);
    const r = this.g.act(c);
    if (r.ok && c.k === 'place') {
      const e = this.g.entAt(c.x, c.y);
      if (e) this.mine.add(e.id);
    }
    return r.ok;
  }

  get handReady() {
    return this.g.s.tick >= this.handFree;
  }

  mark(name: string) {
    if (this.log.at[name] === undefined) this.log.at[name] = this.g.seconds;
  }

  decide(what: string) {
    this.log.decisions.push(this.g.seconds);
    this.log.what.push(what);
  }

  private buy(c: Cmd, what: string): boolean {
    const r = this.act(c);
    if (r === null) return false;
    if (r) this.decide(what);
    return true;
  }

  update() {
    this.observe();
    if (this.opts.sparks) this.sparks();
    if (this.opts.shovel) this.shovel();
    if (this.opts.overdrive) this.overdrive();
    if (!this.opts.build) return;
    this.research();
    this.orders();
    this.build();
  }

  // ---------------------------------------------------------------- watching

  private observe() {
    const g = this.g;
    const done = g.s.research.done;
    for (; this.seenDone < done.length; this.seenDone++) {
      this.mark('research:' + done[this.seenDone]);
      this.decide('research:' + done[this.seenDone]);
    }
    const od = g.s.orders.done;
    for (; this.seenOrders < od.length; this.seenOrders++) {
      this.mark('order:' + od[this.seenOrders]);
      this.decide('order:' + od[this.seenOrders]);
    }
    for (const id of ['E', 'F']) if (g.s.land.includes(id)) this.mark('land' + id);
    if (g.s.tick % TICK_RATE === 0) {
      const d = g.s.delivered;
      if ((d.steel?.toNumber() ?? 0) > 0) this.mark('steel');
      if ((d.glass?.toNumber() ?? 0) > 0) this.mark('glass');
      if ((d.circuit?.toNumber() ?? 0) > 0) this.mark('circuits');
      if ((d.concrete?.toNumber() ?? 0) > 0) this.mark('concrete');
      if ((d.motor?.toNumber() ?? 0) > 0) this.mark('motors');
      if ((d.plastic?.toNumber() ?? 0) > 0) this.mark('plastic');
      if (g.grids.some((gr) => gr.supply > 0 && gr.consumers.some((c) => c.state === 'work'))) this.mark('power');
      if (g.s.mega.stage >= 1) this.mark('greatDrill1');
      if (g.s.factory.ents.some((e) => e.kind === 'fbay')) this.mark('bay');
    }
    this.log.step = this.step;
  }

  // ---------------------------------------------------------------- clicking

  private sparks() {
    const g = this.g;
    const t = g.s.tick;
    const now = new Set(g.s.sparks.map((p) => `${p.kind}${p.x},${p.y}`));
    for (const k of [...this.sparkSeen.keys()]) if (!now.has(k)) this.sparkSeen.delete(k);
    for (const k of now) if (!this.sparkSeen.has(k)) this.sparkSeen.set(k, t);
    if (t < this.clickAt) return;
    for (const p of g.s.sparks) {
      const seen = this.sparkSeen.get(`${p.kind}${p.x},${p.y}`)!;
      if (t - seen >= SPARK_NOTICE) {
        if (this.act({ k: 'click', x: p.x, y: p.y })) this.decide('spark');
        return;
      }
    }
  }

  /** Shovel a machine choked on its byproduct (one click, one slag): the slice's lines fill their
   * heaps in about 100 minutes and an attentive player keeps them clear, as the planner did. */
  private shovel(): boolean {
    const g = this.g;
    if (g.s.tick < this.clickAt) return false;
    const m = g.machines.find((q) => q.state === 'blocked' && q.by >= 4 && q.byItem && q.why === q.byItem);
    if (!m) return false;
    if (this.act({ k: 'click', x: m.x, y: m.y })) this.log.shovels++;
    return true;
  }

  /** Overdrive the busiest machines (they hold their lines back), round robin, 2 clicks/s at
   * most: what an attentive player does with a hand free. */
  private overdrive() {
    const g = this.g;
    const t = g.s.tick;
    if (!g.done('overdrive') || t < this.clickAt || t < this.odAt) return;
    // machines without a byproduct (overdriving a smelter fills its slag heap 3x as fast and
    // jams the line: a player learns that once)
    const ms = g.machines.filter((m) => m.kind !== 'furnace' && !(m.od ?? 0) && !(m.cool ?? 0) && m.state === 'work' && !!m.recipe && !RECIPE[m.recipe].byproduct);
    if (!ms.length) return;
    const pick = ms
      .filter((m) => !auditLock(g, m.x, m.y))
      .filter((m) => shares(m).work >= 0.8)
      .sort((a, b) => a.id - b.id);
    if (!pick.length) return;
    const m = pick.find((q) => q.id >= this.odNext) ?? pick[0];
    this.odNext = m.id + 1;
    this.odAt = t + OD_TICKS;
    if (this.act({ k: 'click', x: m.x, y: m.y })) this.log.overdrives.push(t);
  }

  // ---------------------------------------------------------------- research

  private research() {
    const g = this.g;
    if (!this.handReady) return;
    const r = g.s.research;
    const open = WISH.filter((id) => available(g, id));
    if (!open.length) return;
    const covered = open.find((id) => Object.entries(RESEARCH[id].cost).every(([it, n]) => (r.progress[id]?.[it as ItemId]?.toNumber() ?? 0) + (r.bank[it as ItemId]?.toNumber() ?? 0) >= (n as number)));
    const pick = covered ?? open[0];
    if (r.selected !== pick) this.act({ k: 'research', id: pick });
  }

  // ---------------------------------------------------------------- orders

  /** Orders the plan has reached are accepted when nothing else is active; the slice's own orders
   * (Mayor Bramble's) whenever they are offered. */
  private wantOrders: string[] = [];

  private orders() {
    const g = this.g;
    if (!this.handReady || g.s.orders.active) return;
    const offered = offeredOrders(g);
    const id = offered.find((o) => o.customer === 'bramble')?.id ?? this.wantOrders.find((p) => offered.some((q) => q.id === p));
    if (id) this.act({ k: 'order', id });
  }

  // ---------------------------------------------------------------- the plan

  private build() {
    // the layout is kept up (rebuilt after a fold, rearranged after a change of plan)
    if (this.handReady) this.reconcile();
    if (!this.handReady) return;
    // the Factory-floor commands of a placement under way
    if (this.fq.length) {
      const c = this.fq[0];
      const r = this.act(c);
      if (r === null) return;
      this.fq.shift();
      if (!r) this.fq = [];
      return;
    }
    // a person looks at the plan now and then, not 20 times a second
    if (this.g.s.tick < this.lookAt) return;
    this.lookAt = this.g.s.tick + TICK_RATE / 2;
    for (let guard = 0; guard < 20 && this.step < this.plan.length; guard++) {
      const s = this.plan[this.step];
      const res = this.tryStep(s);
      if (res === 'done') {
        this.step++;
        continue;
      }
      this.log.waiting = res;
      return;
    }
  }

  /** 'done', or what the step waits on. */
  private tryStep(s: Step): string {
    const g = this.g;
    switch (s.k) {
      case 'mark':
        this.mark(s.name);
        return 'done';
      case 'need':
        return g.done(s.r) ? 'done' : `research ${s.r}`;
      case 'land': {
        if (g.s.land.includes(s.id)) return 'done';
        const ch = CHUNKS.find((c) => c.id === s.id)!;
        if (ch.requires && !g.done(ch.requires)) return `research ${ch.requires}`;
        if (g.s.coin.lt(ch.cost)) return `coin for land ${s.id}`;
        this.buy({ k: 'land', id: s.id }, 'land:' + s.id);
        return 'land';
      }
      case 'parts':
        this.layout = s.parts;
        return this.layoutMissing() ? 'building' : 'done';
      case 'corridor': {
        if (!this.found[s.name]) {
          const path = corridor(this.g, s.from, s.enter, s.to, this.reserved());
          if (!path) return `no corridor for ${s.name}`;
          this.found[s.name] = path;
        }
        if (!this.layout.includes(s.name)) this.layout = [...this.layout, s.name];
        return this.layoutMissing() ? 'building' : 'done';
      }
      case 'order':
        if (!this.wantOrders.includes(s.id)) this.wantOrders.push(s.id);
        return 'done';
      case 'wait':
        return s.until(g, this) ? 'done' : s.label;
      case 'fold':
        return this.fold(s);
      case 'fmod':
        return this.fmod(s);
    }
  }

  // ---------------------------------------------------------------- Workshop layout

  private part(name: string): Pl[] {
    return PARTS[name] ?? this.found[name] ?? [];
  }

  wanted(): Pl[] {
    return this.layout.flatMap((n) => this.part(n));
  }

  private reserved(): Set<string> {
    const out = new Set<string>();
    for (const parts of Object.values(PARTS)) for (const p of parts) {
      const d = BUILD[p.kind];
      for (let y = p.y; y < p.y + d.h; y++) for (let x = p.x; x < p.x + d.w; x++) out.add(`${x},${y}`);
    }
    return out;
  }

  private matches(e: Ent, p: Pl): boolean {
    return e.kind === p.kind && e.x === p.x && e.y === p.y && e.rot === this.rotOf(p);
  }

  /** What research still needs of an item, after what is delivered and banked. */
  needOf(item: ItemId): number {
    const r = this.g.s.research;
    let n = 0;
    for (const id of WISH) {
      if (this.g.done(id)) continue;
      const want = RESEARCH[id].cost[item];
      if (want) n += Math.max(0, want - (r.progress[id]?.[item]?.toNumber() ?? 0));
    }
    return n - (r.bank[item]?.toNumber() ?? 0);
  }

  private rotOf(p: Pl): Dir {
    if (!p.gate) return p.rot;
    return p.gate.some((i) => this.needOf(i) > 0) ? p.rot : p.off!;
  }

  /** Is anything in the layout not built yet? */
  private layoutMissing(): boolean {
    const g = this.g;
    for (const p of this.wanted()) {
      const e = g.entAt(p.x, p.y);
      if (!e || !this.matches(e, p)) return true;
      if (p.recipe && e.recipe !== p.recipe && recipeKnown(g, RECIPE[p.recipe])) return true;
    }
    return false;
  }

  /** One command toward the layout: remove what is ours and not in it, turn, place, set recipes. */
  private reconcile() {
    const g = this.g;
    const want = this.wanted();
    const key = new Map<string, Pl>();
    for (const p of want) key.set(`${p.x},${p.y}`, p);
    // ours, not wanted (heaps holding slag stay until they drain)
    for (const e of g.s.ents) {
      if (!this.mine.has(e.id)) continue;
      const p = key.get(`${e.x},${e.y}`);
      if (p && p.kind === e.kind) continue;
      if (e.kind === 'heap' && e.count > 0) continue;
      if (auditLock(g, e.x, e.y)) continue;
      if (this.act({ k: 'remove', x: e.x, y: e.y })) this.mine.delete(e.id);
      return;
    }
    for (const p of want) {
      const e = g.entAt(p.x, p.y);
      if (auditLock(g, p.x, p.y)) continue;
      if (e) {
        if (!this.mine.has(e.id) || e.kind !== p.kind) continue;
        const rot = this.rotOf(p);
        if (e.rot !== rot) {
          if (p.kind === 'belt') this.act({ k: 'place', kind: 'belt', x: p.x, y: p.y, rot });
          else this.act({ k: 'rotate', x: p.x, y: p.y });
          return;
        }
        if (p.recipe && e.recipe !== p.recipe && recipeKnown(g, RECIPE[p.recipe])) {
          this.act({ k: 'recipe', x: p.x, y: p.y, recipe: p.recipe });
          return;
        }
        continue;
      }
      if (g.canPlace(p.kind, p.x, p.y)) continue;
      // a machine whose recipe is not known yet waits (it would pick the wrong one)
      if (p.recipe && !recipeKnown(g, RECIPE[p.recipe])) continue;
      if (this.buy({ k: 'place', kind: p.kind, x: p.x, y: p.y, rot: this.rotOf(p) }, p.kind)) return;
    }
  }

  // ---------------------------------------------------------------- folding

  private fold(s: Extract<Step, { k: 'fold' }>): string {
    const g = this.g;
    if (g.s.designs.some((d) => d.name === s.name)) return 'done';
    const a = g.s.audits.find((q) => q.box.x === s.box.x && q.box.y === s.box.y && q.box.w === s.box.w && q.box.h === s.box.h);
    if (!a) {
      if (this.layoutMissing()) return 'building before the fold';
      if (s.ready && !s.ready(g, this)) return 'line warming up';
      const why = foldRefusal(g, s.box);
      if (why) return `fold: ${why}`;
      this.buy({ k: 'audit', ...s.box }, 'audit');
      return 'auditing';
    }
    if (!a.result) return 'auditing';
    const r = this.act({ k: 'fold', name: s.name, id: a.id });
    if (r) {
      this.decide('fold:' + a.result.grade.letter);
      this.mark('fold:' + s.name);
      // what was in the box is gone: forget it
      for (const id of [...this.mine]) if (!g.byId.has(id)) this.mine.delete(id);
    }
    return 'folding';
  }

  // ---------------------------------------------------------------- the Factory floor

  designNamed(name: string): ModuleDesign | undefined {
    return this.g.s.designs.find((d) => d.name === name);
  }

  private fmod(s: Extract<Step, { k: 'fmod' }>): string {
    const g = this.g;
    if (this.mods[s.id] !== undefined && g.s.factory.ents.some((e) => e.id === this.mods[s.id])) return 'done';
    const d = this.designNamed(s.design);
    if (!d) return `no design ${s.design}`;
    if (d.spare < 1) {
      const why = stampRefusal(g, d);
      if (why) return `stamp ${s.design}: ${why}`;
      this.buy({ k: 'stamp', id: d.id }, 'stamp');
      return 'stamping';
    }
    if (g.s.tick < this.placeAt) return `no room for ${s.id}`;
    const plan = placeModule(g, d, s.to, s.by, this.mods);
    if (!plan) {
      this.placeAt = g.s.tick + 10 * TICK_RATE;
      return `no room for ${s.id}`;
    }
    const cost = plan.trunks.length * FACTORY.trunkCost;
    if (g.s.coin.lt(cost)) return 'coin for trunks';
    // the trunks first (a module without its route would block), then the module
    this.fq = [...plan.trunks.map((t): Cmd => ({ k: 'ftrunk', x: t.x, y: t.y, rot: t.rot }))];
    const placeCmd: Cmd = { k: 'fplace', design: d.id, x: plan.x, y: plan.y, rot: plan.rot };
    const r = this.act(this.fq.length ? this.fq.shift()! : placeCmd);
    if (r === null) { this.fq = []; return 'hands busy'; }
    if (plan.trunks.length) this.fq.push(placeCmd);
    else if (r) this.noteModule(s.id, plan.x, plan.y);
    this.fqFor = s.id;
    this.pendingMod = { id: s.id, x: plan.x, y: plan.y };
    return 'placing';
  }

  private pendingMod: { id: string; x: number; y: number } | null = null;

  private noteModule(id: string, x: number, y: number) {
    const e = this.g.fentAt(x, y);
    if (e && e.kind === 'module') {
      this.mods[id] = e.id;
      this.decide('module');
    }
  }

  /** Called each tick: record a module placed by the queue. */
  private settle() {
    const p = this.pendingMod;
    if (!p || this.fq.length) return;
    this.noteModule(p.id, p.x, p.y);
    this.pendingMod = null;
    this.fqFor = null;
  }

  tick() {
    this.settle();
  }
}

const inside = (b: Box, x: number, y: number) => x >= b.x && y >= b.y && x < b.x + b.w && y < b.y + b.h;

// ------------------------------------------------------------------ Workshop corridor search

/** Does anything around (x, y) hand items onto a belt there pointing `d` (other than from `prev`)? */
function feedsInto(g: Game, x: number, y: number, d: Dir, prev: [number, number] | null): boolean {
  for (let k = 0 as Dir; k < 4; k = (k + 1) as Dir) {
    const nx = x + DX[k], ny = y + DY[k];
    if (k === d) continue;
    if (prev && prev[0] === nx && prev[1] === ny) continue;
    const n = g.entAt(nx, ny);
    if (!n) continue;
    const toward = opposite(k); // direction of travel from n into (x, y)
    switch (n.kind) {
      case 'belt': case 'miner': case 'heap': case 'crate': case 'merger':
        if (n.rot === toward) return true;
        break;
      case 'splitter':
        if (n.rot === toward || ccw(n.rot) === toward || cw(n.rot) === toward) return true;
        break;
      default:
        if (isMachine(n.kind)) {
          // a front, or a side the byproduct leaves by onto a belt pointing away
          if (n.rot === toward) return true;
          if (d === toward) return true;
        }
    }
  }
  return false;
}

/** A belt path from `from` (entered travelling `enter`) to a free face of the Workshop Hopper or
 * Dock, over free owned tiles that nothing else hands items onto. */
export function corridor(g: Game, from: [number, number], enter: Dir, to: 'hopper' | 'dock', reserved: Set<string>): Pl[] | null {
  const sink = g.s.ents.find((e) => e.kind === to);
  if (!sink) return null;
  const W_ = g.W;
  const free = (x: number, y: number) => g.inb(x, y) && g.owned(x, y) && !g.entAt(x, y) && !reserved.has(`${x},${y}`);
  if (!free(from[0], from[1])) return null;
  // BFS over (tile, direction travelled into it)
  const prev = new Map<number, number>();
  const key = (x: number, y: number) => y * W_ + x;
  const start = key(from[0], from[1]);
  prev.set(start, -1);
  const q: number[] = [start];
  const isSink = (x: number, y: number) => x >= sink.x && y >= sink.y && x < sink.x + sink.w && y < sink.y + sink.h;
  let end = -1, endDir: Dir = E;
  while (q.length && end < 0) {
    const cur = q.shift()!;
    const x = cur % W_, y = Math.floor(cur / W_);
    const p = prev.get(cur)!;
    const pp: [number, number] | null = p >= 0 ? [p % W_, Math.floor(p / W_)] : null;
    const inDir: Dir = pp ? dirOf(pp[0], pp[1], x, y) : enter;
    for (let d = 0 as Dir; d < 4; d = (d + 1) as Dir) {
      if (d === opposite(inDir)) continue;
      const nx = x + DX[d], ny = y + DY[d];
      if (feedsInto(g, x, y, d, pp ?? [x - DX[enter], y - DY[enter]])) continue;
      if (isSink(nx, ny)) { end = cur; endDir = d; break; }
      const nk = key(nx, ny);
      if (prev.has(nk) || !free(nx, ny)) continue;
      prev.set(nk, cur);
      q.push(nk);
    }
  }
  if (end < 0) return null;
  // walk back
  const tiles: number[] = [];
  for (let c = end; c >= 0; c = prev.get(c)!) tiles.push(c);
  tiles.reverse();
  const out: Pl[] = [];
  for (let i = 0; i < tiles.length; i++) {
    const x = tiles[i] % W_, y = Math.floor(tiles[i] / W_);
    let rot: Dir = endDir;
    if (i + 1 < tiles.length) rot = dirOf(x, y, tiles[i + 1] % W_, Math.floor(tiles[i + 1] / W_));
    out.push({ kind: 'belt', x, y, rot });
  }
  return out;
}

function dirOf(x: number, y: number, x2: number, y2: number): Dir {
  return x2 > x ? E : x2 < x ? W : y2 > y ? S : N;
}

// ------------------------------------------------------------------ Factory-floor placement

export interface FPlan { x: number; y: number; rot: Dir; trunks: { x: number; y: number; rot: Dir }[] }

const finb = (x: number, y: number) => x >= 0 && y >= 0 && x < FACTORY.w && y < FACTORY.h;
const FW = FACTORY.w;

/** What a new trunk tile must avoid: tiles someone's items arrive at (a module's front, the tile
 * an existing trunk points into), and directions that would make it a module's byproduct route
 * (beside a module, pointing away from it). */
interface FHaz { arrive: Uint8Array; away: Uint8Array }

function fhazards(g: Game): FHaz {
  const arrive = new Uint8Array(FW * FACTORY.h);
  const away = new Uint8Array(FW * FACTORY.h);
  for (const e of g.s.factory.ents) {
    if (e.kind === 'module' || e.kind === 'trunk') {
      const x = e.x + DX[e.rot], y = e.y + DY[e.rot];
      if (finb(x, y)) arrive[y * FW + x] = 1;
    }
    if (e.kind === 'module') {
      for (const s of [ccw(e.rot), cw(e.rot)]) {
        const x = e.x + DX[s], y = e.y + DY[s];
        if (finb(x, y)) away[y * FW + x] |= 1 << s;
      }
    }
  }
  return { arrive, away };
}

const tileOk = (h: FHaz, x: number, y: number, d: Dir) => !h.arrive[y * FW + x] && !(h.away[y * FW + x] & (1 << d));

/** Does `e` take everything in `items` arriving travelling `d`? */
function takes(g: Game, e: FEnt, d: Dir, items: ItemId[]): boolean {
  if (e.kind === 'fdock') return items.every((i) => i === 'slag' || i === 'oil' || (i !== 'machineKit' && i !== 'drillBit'));
  if (e.kind === 'fhopper') return items.every((i) => i !== 'slag');
  if (e.kind === 'fbay') return true;
  if (e.kind !== 'module' || e.rot !== d) return false;
  const dd = g.design(e.design);
  return !!dd && items.every((i) => (dd.ins[i] ?? 0) > 0);
}

type Trunk = { x: number; y: number; rot: Dir };

/**
 * The shortest trunk path whose first tile is (sx, sy): items arrive there travelling `d0`, and
 * when `first` is given the first trunk must point that way (a byproduct route leaves pointing
 * away from its module). [] when (sx, sy) is the destination itself; null when nothing reaches.
 */
function trunkPath(g: Game, h: FHaz, sx: number, sy: number, d0: Dir, first: Dir | null, dest: (e: FEnt, d: Dir) => boolean, blocked: Set<number>): Trunk[] | null {
  const e0 = g.fentAt(sx, sy);
  if (e0) return first === null && dest(e0, d0) ? [] : null;
  if (blocked.has(sy * FW + sx)) return null;
  const prev = new Map<number, number>();
  const dirAt = new Map<number, Dir>();
  const start = sy * FW + sx;
  prev.set(start, -1);
  dirAt.set(start, d0);
  const q = [start];
  while (q.length) {
    const cur = q.shift()!;
    const x = cur % FW, y = (cur - x) / FW;
    const inDir = dirAt.get(cur)!;
    for (let d = 0 as Dir; d < 4; d = (d + 1) as Dir) {
      if (d === opposite(inDir)) continue;
      if (cur === start && first !== null && d !== first) continue;
      if (!tileOk(h, x, y, d)) continue;
      const nx = x + DX[d], ny = y + DY[d];
      if (!finb(nx, ny)) continue;
      const t = g.fentAt(nx, ny);
      if (t) {
        // a trunk: join it if it leads to the destination (trunks merge, 8 items/s shared)
        const end = t.kind === 'trunk' ? followTrunk(g, t, d) : { e: t, d };
        if (!end || !end.e || !dest(end.e, end.d)) continue;
        const out: Trunk[] = [];
        let c = cur, rot: Dir = d;
        while (c >= 0) {
          const cx = c % FW, cy = (c - cx) / FW;
          out.push({ x: cx, y: cy, rot });
          const p = prev.get(c)!;
          if (p >= 0) rot = dirAt.get(c)!;
          c = p;
        }
        return out.reverse();
      }
      const k = ny * FW + nx;
      if (prev.has(k) || blocked.has(k)) continue;
      prev.set(k, cur);
      dirAt.set(k, d);
      q.push(k);
    }
  }
  return null;
}

/** Follow trunk tiles from `t` (entered travelling `d`) to what they end at. */
function followTrunk(g: Game, t: FEnt, d: Dir): { e: FEnt | null; d: Dir } | null {
  const seen = new Set<number>();
  let cur: FEnt | null = t;
  let dir = d;
  while (cur && cur.kind === 'trunk') {
    if (cur.rot === opposite(dir) || seen.has(cur.id)) return null;
    seen.add(cur.id);
    dir = cur.rot;
    cur = g.fentAt(cur.x + DX[dir], cur.y + DY[dir]);
  }
  return { e: cur, d: dir };
}

function destPred(g: Game, to: Dest, items: ItemId[], mods: Record<string, number>): (e: FEnt, d: Dir) => boolean {
  return (e, d) => {
    if (to.k === 'dock') return e.kind === 'fdock' && takes(g, e, d, items);
    if (to.k === 'hopper') return e.kind === 'fhopper' && takes(g, e, d, items);
    if (to.k === 'bay') return e.kind === 'fbay';
    return e.kind === 'module' && e.id === mods[to.id] && takes(g, e, d, items);
  };
}

/** Where to put a copy of `d` so its main outputs reach `to` (and its byproducts `by`, out of a
 * side trunk), with the fewest trunk tiles. */
export function placeModule(g: Game, d: ModuleDesign, to: Dest, by: Dest | undefined, mods: Record<string, number>): FPlan | null {
  const outs = Object.keys(d.outs) as ItemId[];
  const byItems = outs.filter((i) => BYPRODUCTS.has(i));
  const main = by ? outs.filter((i) => !BYPRODUCTS.has(i)) : outs;
  const h = fhazards(g);
  const blocked = new Set<number>();
  // the Megaproject Bay's corner stays clear until it arrives
  if (!g.s.factory.ents.some((e) => e.kind === 'fbay')) for (let y = FACTORY.bay.y; y < FACTORY.bay.y + 2; y++) for (let x = FACTORY.bay.x; x < FACTORY.bay.x + 2; x++) blocked.add(y * FW + x);
  // trunks pointing into a tile would feed a module there (or stop dead at it)
  let best: FPlan | null = null;
  for (let y = 0; y < FACTORY.h; y++)
    for (let x = 0; x < FW; x++) {
      if (g.fentAt(x, y) || blocked.has(y * FW + x) || h.arrive[y * FW + x]) continue;
      for (let rot = 0 as Dir; rot < 4; rot = (rot + 1) as Dir) {
        const fx = x + DX[rot], fy = y + DY[rot];
        if (!finb(fx, fy)) continue;
        // existing trunks beside it pointing away would take its byproducts
        let bad = false;
        for (const s of [ccw(rot), cw(rot)]) {
          const t = g.fentAt(x + DX[s], y + DY[s]);
          if (t && t.kind === 'trunk' && t.rot === s) bad = true;
        }
        if (bad) continue;
        const bl = new Set(blocked);
        bl.add(y * FW + x);
        const path = trunkPath(g, h, fx, fy, rot, null, destPred(g, to, main, mods), bl);
        if (!path) continue;
        let trunks = path;
        if (by && byItems.length) {
          for (const p of path) bl.add(p.y * FW + p.x);
          let side: Trunk[] | null = null;
          for (const s of [ccw(rot), cw(rot)]) {
            const sx = x + DX[s], sy = y + DY[s];
            if (!finb(sx, sy) || g.fentAt(sx, sy)) continue;
            const sp = trunkPath(g, h, sx, sy, s, s, destPred(g, by, byItems, mods), bl);
            if (sp && (!side || sp.length < side.length)) side = sp;
          }
          if (!side) continue;
          trunks = [...path, ...side];
        } else if (byItems.length && !main.length) continue;
        if (!best || trunks.length < best.trunks.length) best = { x, y, rot, trunks };
      }
    }
  return best;
}

// ------------------------------------------------------------------ running it

export interface Act2Run {
  g: Game;
  planner: Bot;
  bot: Act2Bot;
  /** seconds when the planner handed over */
  handover: number;
}

/** Play the Act I planner to its slice end, then this policy, for `seconds` of game time (or until
 * `stop`, checked once a second). */
export function playAct2(
  g: Game,
  planner: Bot,
  seconds: number,
  opts: Act2Opts = {},
  stop?: (g: Game, b: Act2Bot | null) => boolean,
  onSecond?: (g: Game, b: Act2Bot | null) => void,
): Act2Run {
  let bot: Act2Bot | null = null;
  let handover = -1;
  let doneAt: number | null = null;
  const end = seconds * TICK_RATE;
  while (g.s.tick < end) {
    if (!bot) {
      planner.update();
      // the slice's end (the Act I planner's last goal), once its plan is through
      if (planner.step >= planner.plan.length) doneAt ??= g.s.tick;
      if (doneAt !== null && (g.flag('sliceEnd') || g.s.tick - doneAt >= 60 * TICK_RATE)) {
        bot = new Act2Bot(g, opts);
        handover = g.seconds;
      }
    } else {
      bot.update();
    }
    g.tick();
    bot?.tick();
    if (g.s.tick % TICK_RATE === 0) {
      onSecond?.(g, bot);
      if (stop && stop(g, bot)) break;
    }
  }
  if (!bot) bot = new Act2Bot(g, opts);
  return { g, planner, bot, handover };
}

export { ORDERS, ORDER, kitsFor, stampCost, mainItem };
