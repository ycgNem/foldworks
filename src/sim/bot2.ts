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
// (E, F, and the free corner of B by the copper patch) are a line lab: lines are laid out from
// fixed parts (PARTS below), fed by belts, powered by their own plants, and folded into modules
// once they run well (some in the background while the plan goes on); the lab is rearranged for
// the next line. Research items reach the Workshop Hopper by a spine down chunk E's west edge and
// a corridor through chunk B found by search; once research needs only motors and concrete the
// spine becomes a loop of splitters feeding the motor and drill-bit assemblers. A few audits are
// prepared like a player would: a slag heap is let fill first so the Concrete and Drill works
// lines are measured at full speed, and the glass and plastic works is folded twice with each
// half stopped, for single-output modules. On the Factory floor the first Steel copy goes to the
// Hopper by search; the Great Drill's floor is laid by hand (BAY_PLAN), clearing the Act I chains.
//
// Options model §16 rule 4's two players: `overdrive` (an active player clicking Overdrive on busy
// machines, capped), `sparks` and `build`. With everything off the bot does nothing: idle play.
import type { Game, Cmd } from './Game';
import type { Bot } from './bot';
import { DX, DY, ccw, cw, opposite, type Box, type Dir, type Ent, type FEnt, type KeptDesign, type ModuleDesign } from './world';
import { BUILD, isMachine, type BuildKind } from '../data/machines';
import { RESEARCH, type ResearchId } from '../data/research';
import { CHUNKS, FACTORY, FACTORY_MAX_H, FACTORY_MAX_W } from '../data/land';
import { RECIPE } from '../data/recipes';
import { ORDER, ORDERS } from '../data/orders';
import type { ItemId } from '../data/items';
import { TICK_RATE } from '../engine/time';
import { available } from './systems/research';
import { offeredOrders, orderFrac } from './systems/orders';
import { auditLock, foldRefusal } from './systems/audits';
import { BYPRODUCTS, buildRoutes, kitsFor, mainItem, stampCost, stampRefusal } from './systems/modules';
import { fauditLock, ffoldRefusal } from './systems/nested';
import { shares } from './systems/stats';
import { accepts, recipeKnown } from './transfer';
import { claimLoad, claimPrice, claimsHeld, claimsUsed, placeClaimRefusal, placedClaims } from './systems/claims';
import { annexPrice, annexRefusal } from './systems/annex';
import { keepRefusal, unfoldKeptRefusal } from './drawer';
import { hasPatent } from './patents';
import { entsIn } from './systems/audits';

/** E S W N */
const E: Dir = 0, S: Dir = 1, W: Dir = 2, N: Dir = 3;

/** An optional step's answer when it waits for coin, claims or room it may get later: it leaves the
 * plan and is tried again beside it (Act2Bot.later). */
const DEFER = 'defer';

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
  /** a valve the bot works by hand: on (its own rot) while this says so, else turned to `off` */
  on?: (b: Act2Bot) => boolean;
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
  // (the second miner rests once the Great Drill's stage 1 runs miners +50%: one digs three
  // quarters of what two did, and two flood the corridor in a later run: Milestone 5)
  coalFeed: [
    ...gated(draw(17, 2, ['m<']), ['coal'], N),
    { kind: 'miner', x: 17, y: 3, rot: W, on: (b) => b.needOf('coal') > 0 && b.g.s.mega.stage < 1, off: N },
  ],
  // research sand: a miner on E's sand patch, west along row 6 into the spine's turn
  sandFeed: [...draw(17, 6, ['b<b<b<']), ...gated(draw(20, 6, ['m<']), ['sand'], N)],
  // F's steel line (box 19,11 3x3): iron miner (21,13) north into the ingot smelter (21,12)? no:
  // iron miner (21,13) west into the ingot smelter (20,13), which hands ingots north into the
  // steel smelter (20,12); coal from the miner (19,12) into its west side; steel north and west
  // along row 10 to the spine column; steel's slag east (21,12) and north up column 23
  steel: [
    ...draw(19, 11, ['..b^..', 'm>s^b>', 'hvs^m<'], { '20,12': 'smeltSteel', '20,13': 'smeltIron' }),
    // the ingot smelter's slag: its heap empties south and along row 14 into the slag column, so
    // both smelters' slag reaches the gravel press (a slag line, not a dump)
    ...belts([[19, 14, E], [20, 14, E], [21, 14, E], [22, 14, E], [23, 14, N], [23, 13, N]]),
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
  // Folded twice, once with each half stopped (the sand miner or the refinery's coal miner turned
  // away): a Glass module and a Plastic module, each with one main output. A module making glass
  // and plastic together stalls for good feeding a Circuits module that takes them in any other
  // ratio than 1:1 (the surplus fills its output and stops the other); one output each, every
  // module runs at what its consumer takes.
  gp: [
    ...draw(17, 0, ['b<b<b<b<b<']),
    ...draw(18, 1, ['g...b^b^']),
    ...draw(18, 2, ['m^o.b^b^']),
    { kind: 'miner', x: 18, y: 3, rot: E, on: (b) => b.foldMode !== 'glass', off: S },
    ...draw(20, 3, ['b^b^']),
    ...draw(21, 4, ['k^']),
    // (also turned away while glass floods the shared belt and stops the refinery before the
    // Concrete fold: the refinery's oil fires the concrete boiler, the review round's run-2 stall)
    { kind: 'miner', x: 21, y: 5, rot: N, on: (b) => b.foldMode !== 'plastic' && !b.glassFlood(), off: E },
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
  // (23,9) is a valve: before the Concrete and Drill works audits it is turned east (off the map,
  // one slag stuck on it) so the heap fills, and the audit then measures the mixer (and the
  // drill-bit assembler after it) at full speed rather than at the trickle of slag one steel line
  // makes: a player lets the buffer fill before measuring
  gravel: [
    { kind: 'belt', x: 23, y: 9, rot: N, on: (b) => b.valveOpen(), off: E },
    ...belts([[23, 8, W]]),
    ...draw(22, 8, ['p<'], { '22,8': 'crushGravel' }),
    // the gravel line's sand miner: turned away while nothing wants its sand (once the Great Drill's
    // stage 1 runs miners +50%, an ungated miner floods the corridor in a later run: Milestone 5)
    { kind: 'miner', x: 21, y: 6, rot: S, on: (b) => b.sandWanted(), off: E }, ...belts([[21, 7, S]]),
    { kind: 'belt', x: 17, y: 8, rot: W, on: (b) => b.concreteOut(), off: N },
    ...belts([[19, 8, W], [20, 8, W]]),
  ],
  g18: belts([[18, 8, W]]),
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
  // ---- after Motors and the Concrete fold, research needs only motors and concrete: the spine's
  // top half becomes a loop. Steel and concrete come up column 16 from F, pass a splitter beside
  // the motor assembler (15,3), go east along row 2 and back down column 17 to a merger at (16,6);
  // a splitter at (16,5) lets a share of each lap out west into the corridor (the Hopper takes
  // research concrete and anything the assemblers pass up). Every machine is fed through a splitter
  // that skips it when it refuses an item, so a mixed belt never jams (the gpFeed2 lesson).
  loop: [
    ...belts([[16, 1, E], [16, 2, E], [16, 4, N], [16, 7, N]]),
    ...draw(16, 3, ['S^']), ...draw(16, 5, ['S^']), ...draw(16, 6, ['J^']),
    ...belts([[17, 1, S], [17, 2, S], [17, 3, S], [17, 4, S], [17, 5, S], [17, 6, W]]),
  ],
  // the refinery's oil: south to the boiler, or west into the loop (17,5)
  oilSplitM: [...draw(19, 5, ['Sv']), ...belts([[18, 5, W]])],
  // two copper lines: (12,2) into the circuit assembler, (12,3) into the motor assembler
  wireB3: [
    ...draw(12, 2, ['m>s>p>'], { '13,2': 'smeltCopper', '14,2': 'drawWire' }),
    ...draw(12, 3, ['m>s>p>'], { '13,3': 'smeltCopper', '14,3': 'drawWire' }),
    ...draw(13, 1, ['h<']), ...draw(13, 4, ['h.']),
  ],
  // circuits (15,2) hand straight down into the motor assembler (15,3), which takes wire from the
  // press on its west side and steel from the loop's splitter on its east
  motorAsm: draw(15, 2, ['av', 'av'], { '15,2': 'etchCircuit', '15,3': 'buildMotor' }),
  // motors south into the corridor (research)
  motorOut: belts([[15, 4, S], [15, 5, S]]),
  // ---- after The Great Drill: the motors run down (15,4) into a drill-bit assembler (15,5) that
  // hands its bits into the corridor. The loop no longer lets anything out to the Hopper before
  // the assemblers have had their pick: the drill's splitter (16,5) comes first after the merger,
  // the motor's (16,3) next, and only the last (16,2) sends a share north onto the glass and
  // plastic feed, whose splitter passes what the circuit assembler refuses west along row 0 to the
  // Workshop Dock (sold). The oil no longer joins the loop (the boiler takes it; a full boiler is
  // shovelled like a slag heap).
  drill: [...belts([[15, 4, S]]), ...draw(15, 5, ['av'], { '15,5': 'forgeDrillBit' })],
  loopX: [
    ...belts([[16, 1, N], [16, 4, N], [16, 7, N]]),
    ...draw(16, 2, ['S^']), ...draw(16, 3, ['S^']), ...draw(16, 5, ['S^']), ...draw(16, 6, ['J^']),
    ...belts([[17, 2, S], [17, 3, S], [17, 4, S], [17, 5, S], [17, 6, W]]),
    ...belts([[14, 1, N], [14, 0, W], [13, 0, W], [12, 0, W]]),
  ],
  oilBoiler: draw(19, 5, ['Sv']),
  // ---- once the Drill works is folded the lab's last job is research (Tuning, Nested Folds):
  // circuits east into the loop and out to the Hopper with the concrete
  circuitZ: [...draw(15, 2, ['a>'], { '15,2': 'etchCircuit' }), ...belts([[15, 5, S]])],
  // ---- standing once Slag Bricks is researched (the final round): slag bricks for Surveying (the
  // Survey Office's claims). The Act I planner's copper slag heap (10,5) empties east into a brick
  // press (11,5), which hands its bricks south onto the corridor (11,6) and so into the Workshop
  // Hopper (banked until Surveying is selected); the copper lines' slag drains instead of backing up
  // into their smelters. (Turning the heap west would face it south onto the corridor for a moment
  // on the way, and one slag on the corridor jams it at the Hopper, which refuses slag.)
  // It is turned away (north, onto nothing) once the bank holds the bricks Surveying needs: on a
  // full corridor every brick is a gap the spine's research items wait for.
  brick: [{ kind: 'press', x: 11, y: 5, rot: S, recipe: 'pressBrick', on: (b) => b.needOf('slagBrick') > 0, off: N }],
};

/** The lab once research needs only motors and concrete (§18 Motors, Megaproject). */
export const PHASE_M = ['loop', 'corridor', 'steel', 'steelSlagHeap', 'gpFeed2', 'wireB3', 'motorAsm', 'motorOut', 'gp', 'gravel', 'g18', 'refinery', 'oilSplitM', 'concrete'];
/** The lab after the Drill works fold: circuits and concrete for the last research nodes. */
export const PHASE_Z = ['loop', 'corridor', 'steel', 'steelSlagHeap', 'gpFeed2', 'wireB2', 'circuitZ', 'gp', 'gravel', 'g18', 'refinery', 'oilSplitM', 'concrete'];
/** The lab once The Great Drill is researched: the motor assembler feeds a drill-bit assembler. */
const PHASE_X = ['loopX', 'corridor', 'steel', 'steelSlagHeap', 'gpFeed2', 'wireB3', 'motorAsm', 'drill', 'gp', 'gravel', 'g18', 'refinery', 'oilBoiler', 'concrete'];

// ------------------------------------------------------------------ the plan

export type Dest = { k: 'dock' } | { k: 'hopper' } | { k: 'bay' } | { k: 'chute' } | { k: 'mod'; id: string };

export type Step =
  /** buy a chunk (`when`: only if this holds, else skipped) */
  | { k: 'land'; id: string; when?: (g: Game) => boolean }
  | { k: 'need'; r: ResearchId }
  | { k: 'parts'; parts: string[] }
  | { k: 'corridor'; name: string; from: [number, number]; enter: Dir; to: 'hopper' | 'dock' }
  /** `pure`: items the line makes itself; an audit that measured them coming in from outside (a
   * neighbour's belt leaking into the box) is cancelled and taken again, up to 3 times */
  | { k: 'fold'; box: Box; name: string; ready?: (g: Game, b: Act2Bot) => boolean; bg?: boolean; mode?: 'glass' | 'plastic'; pure?: ItemId[]; nokeep?: boolean }
  /** wait until these designs are folded (a background fold must land before its box changes) */
  | { k: 'folded'; names: string[] }
  /** a module placed by search; `annex`: east of the 12x8 only; `opt`: skipped when it can't go */
  | { k: 'fmod'; id: string; design: string; to: Dest; by?: Dest; hub?: boolean; annex?: boolean; opt?: boolean; zone?: PlaceZone }
  /** buy the annex up to `n` blocks (DESIGN.md §19), once coin is `spare` times the price */
  /** `opt`: only if affordable now (with `spare`), else skipped: the plan never waits on it */
  | { k: 'annex'; n: number; spare?: number; for?: string[]; opt?: boolean }
  /** a nested fold of a group on the Factory floor (skipped when the box can't be folded) */
  | { k: 'ffold'; box: Box; name: string }
  | { k: 'order'; id: string }
  | { k: 'wait'; label: string; until: (g: Game, b: Act2Bot) => boolean }
  /** a whole Factory-floor layout laid by hand: everything else on the floor is cleared */
  /** `keep`: lay it without clearing anything else (an annex plan beside the Act I chains) */
  | { k: 'fplan'; name: string; items: FPl[]; opt?: boolean; keep?: boolean }
  | { k: 'mark'; name: string };

/** Research the plan wants, in order (a node already paid for by the bank goes first). */
// Slag Bricks and Surveying (the Survey Office's deposit claims, the final round): the Act I
// planner's last slag heap (5,4) pays Slag Bricks into the Hopper as soon as Act II begins;
// Surveying's bricks come from the standing brick press and bank in the Hopper, its coal rides the
// spine with the rest; it is taken as soon as the bank covers it (last in turn, so slow bricks
// never hold the plan's research up)
export const WISH: ResearchId[] = [
  'coalSeams', 'slagBricks', 'steelmaking', 'steamPower', 'overdrive', 'glassworks', 'crushing', 'refining', 'circuits', 'splitters', 'concrete',
  'motors', 'greatDrill', 'machineKits', 'heavyMachines', 'tuning', 'nestedFolds', 'surveying',
];

const BASE = ['spine', 'corridor', 'coalFeed'];
/** Parts every layout keeps (the brick press for Surveying). */
const STANDING = ['brick', 'brickOut'];

/** One tile of a hand-laid Factory-floor layout: a trunk, or a copy of a design (by name). */
export interface FPl { kind: 'module' | 'trunk'; x: number; y: number; rot: Dir; design?: string }
const ft = (pts: [number, number, Dir][]): FPl[] => pts.map(([x, y, rot]) => ({ kind: 'trunk', x, y, rot }));
const fm = (design: string, x: number, y: number, rot: Dir): FPl => ({ kind: 'module', x, y, rot, design });

/**
 * The Great Drill's floor (DESIGN.md §18 Megaproject), laid by hand once the Drill works is folded
 * (the search placer packs the first modules into the Bay's corner and walls in the trunks the
 * later ones need). The Drill works X (2,7) feeds the Bay along row 7 from Concrete C, Steel S and
 * Circuits c; Plastic P and Glass G feed Circuits. No module feeding the Drill works sends a
 * byproduct back into Concrete: every such loop (Concrete waits on the Drill works, which waits on
 * a module blocked by its own slag waiting on Concrete) stalls for good, so their slag and oil go
 * to the Dock, and Concrete takes its slag and oil only from modules that never wait on it: the
 * Bay's Steel s (0,5), Iron ingots I (4,2, ingots to the Dock) and a second Plastic copy p (2,3,
 * plastic to the Dock).
 *
 *        0 1 2 3 4 5 6 7 8 9 A B
 *     0  . . > > > > v . . . . .
 *     1  . . ^ . . . > > > > D D
 *     2  . . ^ . I > ^ . . > D D
 *     3  v < p v v . ^ P > ^ . .
 *     4  > > > v < . ^ v G ^ . .
 *     5  s > > v . . ^ v . ^ H H
 *     6  B B . C S > ^ c > ^ H H
 *     7  B B X < < < < < . . . .
 */
export const BAY_PLAN: FPl[] = [
  ...ft([[3, 7, W], [4, 7, W], [5, 7, W], [6, 7, W], [7, 7, W]]),
  ...ft([[5, 6, E], [6, 6, N], [6, 5, N], [6, 4, N], [6, 3, N], [6, 2, N], [6, 1, E], [7, 1, E], [8, 1, E], [9, 1, E]]),
  ...ft([[8, 6, E], [9, 6, N], [9, 5, N], [9, 4, N], [9, 3, N], [9, 2, E]]),
  ...ft([[7, 4, S], [7, 5, S], [8, 3, E]]),
  ...ft([[3, 3, S], [3, 4, S], [3, 5, S]]),
  ...ft([[1, 5, E], [2, 5, E]]),
  ...ft([[5, 2, E], [4, 3, S], [4, 4, W]]),
  ...ft([[2, 2, N], [2, 1, N], [2, 0, E], [3, 0, E], [4, 0, E], [5, 0, E], [6, 0, S]]),
  ...ft([[1, 3, W], [0, 3, S], [0, 4, E], [1, 4, E], [2, 4, E]]),
  fm('Drill works', 2, 7, W),
  fm('Concrete', 3, 6, S),
  fm('Steel', 4, 6, S),
  fm('Circuits', 7, 6, S),
  fm('Plastic', 7, 3, S),
  fm('Glass', 8, 4, W),
  fm('Steel', 0, 5, S),
  fm('Iron ingots', 4, 2, E),
  fm('Plastic II', 2, 3, N),
];

/**
 * The annex's first block (DESIGN.md §19 Factory annex: two columns east of the 12x8, beside the
 * Dock): a Gizmo chain that sells what the Bay floor cleared away. The Gizmo works g (12,1) sells
 * into the Dock; the wire w (13,0) and the ingots i (13,2) feed its back through (13,1); their
 * slag rides (12,0) and (11,0) and (12,2) into the Dock.
 *
 *        A B | C D
 *     0  . v | < w
 *     1  D D | g <
 *     2  D D | < i
 */
export const ANNEX1: FPl[] = [
  ...ft([[13, 1, W], [12, 0, W], [11, 0, S], [12, 2, W]]),
  fm('Gizmo works', 12, 1, W),
  fm('Copper wire', 13, 0, S),
  fm('Iron ingots', 13, 2, N),
];
/** The annex's lane (12,3) north into the trunk (12,2) and on into the Dock: what the annex's
 * later blocks make joins it, before and after the block-1 chain is folded (ANNEX_II keeps (12,2)). */
export const LANE: FPl[] = ft([[12, 3, N]]);
/** The Dock's free sides on the 12x8 (ingots and wire that sell), beside the annex's trunks. */
const DOCKS: FPl[] = [fm('Iron ingots', 10, 3, N), fm('Iron ingots', 11, 3, N), fm('Copper wire', 10, 0, S)];
/** The annex chain folded into one module (§18 Nested folds) at (13,1), selling through (12,1);
 * its slag down (13,2), along (13,3) into the lane. */
export const ANNEX_II: FPl[] = [...ft([[12, 1, W], [13, 2, S], [13, 3, W], [12, 2, W]]), ...LANE, fm('Gizmo works II', 13, 1, W)];
/** Annex tiles the hand-laid plans keep for themselves: a searched module or trunk never takes
 * them, and only the lane's trunk is joined. */
const ANNEX_HELD = new Set<number>([...ANNEX1, ...ANNEX_II].map((p) => p.y * FACTORY_MAX_W + p.x));

export const PLAN2: Step[] = [
  { k: 'need', r: 'coalSeams' },
  { k: 'land', id: 'E' },
  { k: 'parts', parts: ['spine', 'coalFeed', 'sandFeed'] },
  { k: 'corridor', name: 'corridor', from: [15, 6], enter: W, to: 'hopper' },
  { k: 'need', r: 'steamPower' },
  { k: 'land', id: 'F' },
  { k: 'parts', parts: [...BASE, 'sandFeed', 'steel', 'steelSlagHeap'] },
  { k: 'order', id: 'calibration' },
  { k: 'need', r: 'glassworks' },
  { k: 'parts', parts: [...BASE, 'sandFeed', 'steel', 'steelSlagHeap', 'gpFeed', 'wireB', 'wireOut', 'gp'] },
  { k: 'need', r: 'crushing' },
  { k: 'parts', parts: [...BASE, 'sandFeed', 'steel', 'steelSlagHeap', 'gpFeed', 'wireB', 'wireOut', 'gp', 'gravel', 'g18', 'gravelOut'] },
  { k: 'need', r: 'refining' },
  { k: 'parts', parts: [...BASE, 'sandFeed', 'steel', 'steelSlagHeap', 'gpFeed', 'wireB', 'wireOut', 'gp', 'gravel', 'g18', 'gravelOut', 'refinery', 'oilBelt'] },
  // the steel line is folded once it runs flat out (the spine is clear once coal is researched)
  { k: 'fold', box: { x: 19, y: 11, w: 3, h: 3 }, name: 'Steel', ready: (g) => working(g, 20, 12, 60, 0.9), bg: true },
  { k: 'fmod', id: 'steelHop', design: 'Steel', to: { k: 'hopper' }, by: { k: 'dock' } },
  // the annex's first block (§19), once coin allows: a fourth Gizmo chain beside the Dock, which
  // the Bay floor later keeps
  { k: 'annex', n: 1 },
  { k: 'fplan', name: 'annex1early', items: [...ANNEX1, ...LANE], opt: true, keep: true },
  { k: 'need', r: 'circuits' },
  { k: 'need', r: 'splitters' },
  { k: 'parts', parts: [...BASE, 'sandFeed', 'steel', 'steelSlagHeap', 'gpFeed2', 'wireB2', 'circuitAsm', 'gp', 'gravel', 'g18', 'gravelOut', 'refinery', 'oilBelt'] },
  { k: 'fold', box: { x: 12, y: 2, w: 4, h: 2 }, name: 'Circuits', ready: (g) => working(g, 15, 2, 60, 0.8), bg: true, pure: ['copperWire'] },
  { k: 'parts', parts: [...BASE, 'sandFeed', 'steel', 'steelSlagHeap', 'gpFeed2', 'wireB2', 'circuitAsm', 'gp', 'gravel', 'g18', 'gravelOut', 'refinery', 'oilSplit'] },
  { k: 'need', r: 'concrete' },
  { k: 'parts', parts: [...BASE, 'steel', 'steelSlagHeap', 'gpFeed2', 'wireB2', 'circuitAsm', 'gp', 'gravel', 'g18', 'refinery', 'oilSplit', 'concrete'] },
  // (pure, the final round: a line whose own buffer of an item it makes drains in the window measures
  // that item as an input, and a module wanting gravel or wire from outside starves on the Bay floor:
  // a player who sees "takes gravel" on the grade card audits it again once the buffers settle)
  { k: 'fold', box: { x: 19, y: 6, w: 4, h: 4 }, name: 'Concrete', ready: (g, b) => b.concreteGo && working(g, 21, 8, 30, 0.9), bg: true, pure: ['gravel', 'sand'] },
  // the glass and plastic halves are folded one at a time, after Circuits (its audit needs both);
  // Glass after Concrete too (with the refinery stopped there is no oil for the concrete boiler)
  { k: 'folded', names: ['Circuits'] },
  { k: 'fold', box: { x: 18, y: 0, w: 4, h: 6 }, name: 'Plastic', mode: 'plastic', ready: (g) => working(g, 19, 3, 30, 0.8) && idle(g, 21, 4, 15) },
  { k: 'fold', box: { x: 18, y: 0, w: 4, h: 6 }, name: 'Plastic II', mode: 'plastic', ready: (g) => working(g, 19, 3, 30, 0.8) && idle(g, 21, 4, 15) },
  { k: 'folded', names: ['Concrete'] },
  // one sand miner feeds the kiln half of what it can fire: it works about half the time
  { k: 'fold', box: { x: 18, y: 0, w: 4, h: 6 }, name: 'Glass', mode: 'glass', ready: (g) => working(g, 21, 4, 30, 0.4) && idle(g, 19, 3, 15) },
  { k: 'need', r: 'motors' },
  { k: 'parts', parts: PHASE_M },
  { k: 'need', r: 'greatDrill' },
  { k: 'parts', parts: PHASE_X },
  { k: 'fold', box: { x: 12, y: 3, w: 4, h: 3 }, name: 'Drill works', ready: (g, b) => b.drillGo && working(g, 15, 5, 30, 0.8), pure: ['copperWire'] },
  // the Megaproject Bay: drill bits from the Drill works, steel from a Steel copy
  { k: 'fplan', name: 'bay', items: BAY_PLAN },
  { k: 'parts', parts: PHASE_Z },
  // while the Bay fills: the annex's first block takes the Gizmo chain the Bay floor cleared, and
  // the Dock's free sides take copies that sell (ingots and wire), one at a time as coin and
  // claims allow
  { k: 'annex', n: 1 },
  { k: 'fplan', name: 'annex1', items: [...BAY_PLAN, ...ANNEX1, ...LANE], opt: true },
  { k: 'fplan', name: 'dock1', items: [...BAY_PLAN, ...ANNEX1, ...LANE, ...DOCKS.slice(0, 1)], opt: true },
  { k: 'fplan', name: 'dock2', items: [...BAY_PLAN, ...ANNEX1, ...LANE, ...DOCKS], opt: true },
  { k: 'need', r: 'tuning' },
  { k: 'need', r: 'nestedFolds' },
  // a deeper fold (§19: more steps folded files a better Gizmo): the annex chain as one module,
  // put back where its Gizmo works stood, and copies of it in the annex's later blocks
  { k: 'ffold', box: { x: 12, y: 0, w: 2, h: 3 }, name: 'Gizmo works II' },
  { k: 'fplan', name: 'annexII', items: [...BAY_PLAN, ...LANE, ...DOCKS, ...ANNEX_II], opt: true },
  { k: 'annex', n: 2, spare: 2, for: ['Gizmo works II'] },
  { k: 'fmod', id: 'gizII2', design: 'Gizmo works II', to: { k: 'dock' }, annex: true, opt: true },
  { k: 'annex', n: 3, spare: 2, for: ['Gizmo works II'] },
  { k: 'fmod', id: 'gizII3', design: 'Gizmo works II', to: { k: 'dock' }, annex: true, opt: true },
  // the Great Drill's deep seams (stage 3) are in chunk D: their claims once it is owned
  { k: 'land', id: 'D', when: (g) => g.s.mega.stage >= 3 },
  { k: 'mark', name: 'end' },
];

/** Has the machine at (x, y) done nothing for the last `sec` seconds? */
export function idle(g: Game, x: number, y: number, sec: number): boolean {
  const m = g.entAt(x, y);
  if (!m || !isMachine(m.kind)) return true;
  return m.state !== 'work' && !m.hist.slice(-sec).includes('w');
}

/** Is the machine at (x, y) working, and has it been for `frac` of the last `sec` seconds? A
 * player folds a line once it runs well: the audit measures the module's rates for good. */
export function working(g: Game, x: number, y: number, sec: number, frac = 0.7): boolean {
  const m = g.entAt(x, y);
  if (!m || !isMachine(m.kind) || m.state !== 'work') return false;
  const h = m.hist.slice(-sec);
  return h.length >= sec && [...h].filter((c) => c === 'w').length >= sec * frac;
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
  /** Act I chains cleared from the Factory floor */
  cleared: number;
  cmds: number[];
  /** the step reached and why it waits, for the logs */
  step: number;
  waiting: string;
}

export class Act2Bot {
  log: Act2Log = { at: {}, decisions: [], what: [], clicks: [], overdrives: [], shovels: 0, cleared: 0, cmds: [], step: 0, waiting: '' };
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

  /** One command through the hands (public: the Act III policy, bot3.ts, shares them, so the two
   * together keep to the one hand and click pace). */
  act(c: Cmd): boolean | null {
    const t = this.g.s.tick;
    if (c.k === 'click' || c.k === 'fclick' || c.k === 'hclick') {
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
    // kept designs the Draughtsman unfolded: this bot's to manage, like the parts it placed
    const drafted = g.s.drafted ?? [];
    for (; this.seenDrafted < drafted.length; this.seenDrafted++) {
      const k = g.s.meta.drawer.find((q) => q.id === drafted[this.seenDrafted]);
      if (k) this.adopt(k);
    }
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
      if (g.s.mega.stage >= 1 && this.log.at.greatDrill1 === undefined) {
        this.mark('greatDrill1');
        this.decide('stage:greatDrill1');
      }
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
    if (this.fOverdrive()) return;
    // machines without a byproduct (overdriving a smelter fills its slag heap 3x as fast and
    // jams the line: a player learns that once)
    const ms = g.machines.filter((m) => m.kind !== 'furnace' && !(m.od ?? 0) && !(m.cool ?? 0) && m.state === 'work' && !!m.recipe && !RECIPE[m.recipe].byproduct);
    if (!ms.length) return;
    // nor a line it is about to fold (the final round: Overdrive never reaches an audited machine, so
    // buffers filled at 3x just before the audit drained in the window and were measured as inputs),
    // once the line is ready to fold: a line still warming up is overdriven like any other
    const folding = [...this.bgFolds, ...(this.plan[this.step]?.k === 'fold' ? [this.plan[this.step] as Extract<Step, { k: 'fold' }>] : [])]
      .filter((f) => !f.ready || f.ready(g, this))
      .map((f) => f.box);
    const pick = ms
      .filter((m) => !auditLock(g, m.x, m.y) && !folding.some((b) => inside(b, m.x, m.y)))
      .filter((m) => shares(m).work >= 0.8)
      .sort((a, b) => a.id - b.id);
    if (!pick.length) return;
    const m = pick.find((q) => q.id >= this.odNext) ?? pick[0];
    this.odNext = m.id + 1;
    this.odAt = t + OD_TICKS;
    if (this.act({ k: 'click', x: m.x, y: m.y })) this.log.overdrives.push(t);
  }

  /** Overdrive on the Factory floor (DESIGN.md §18): a click on a module runs it and every module
   * joined to it by trunks 3x for 10 s. The groups are taken round robin, each as soon as it has
   * cooled: where the money is after the slice. */
  private fOverdrive(): boolean {
    const g = this.g;
    const groups = moduleGroups(g);
    if (!groups.length) return false;
    const ready = groups.filter((grp) => grp.some((m) => m.state === 'work') && grp.every((m) => !(m.od ?? 0) && !(m.cool ?? 0) && !fauditLock(g, m.x, m.y)));
    if (!ready.length) return false;
    const pick = ready.find((grp) => grp[0].id >= this.fodNext) ?? ready[0];
    this.fodNext = pick[0].id + 1;
    const m = pick[0];
    this.odAt = g.s.tick + OD_TICKS;
    if (this.act({ k: 'fclick', x: m.x, y: m.y })) this.log.overdrives.push(g.s.tick);
    return true;
  }

  private fodNext = 0;

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

  /** Orders the plan has reached are accepted when nothing else is active; Mayor Bramble's
   * Factory-floor order (the Festival) whenever it is offered, and the Committee's orders the floor
   * fills on its own (Milestone 5); the slice's Workshop orders are the Act I planner's. */
  private wantOrders: string[] = [];

  /** the active order's progress when last looked at, and since when it has not moved */
  private orderWatch: { id: string; frac: number; since: number } | null = null;

  private orders() {
    const g = this.g;
    if (!this.handReady) return;
    const active = g.s.orders.active;
    if (active) {
      // an order nothing on the floor feeds any more (the slice's Lamp Posts after the hand-over)
      // gives way, after 10 minutes without progress, to a Committee order the floor fills itself
      const f = orderFrac(g, active);
      if (!this.orderWatch || this.orderWatch.id !== active || Math.abs(this.orderWatch.frac - f) > 1e-9) this.orderWatch = { id: active, frac: f, since: g.seconds };
      else if (ORDER[active].customer !== 'committee' && ORDER[active].at !== 'factory' && (g.seconds - this.orderWatch.since >= 600 || g.s.tick % (60 * TICK_RATE) === 0)) {
        const c = this.committeeOrder(offeredOrders(g).map((o) => o.id));
        if (c) this.act({ k: 'order', id: c });
      }
      return;
    }
    const offered = offeredOrders(g);
    const id = offered.find((o) => o.customer === 'bramble' && o.at === 'factory')?.id ?? this.committeeOrder(offered.map((o) => o.id)) ?? this.wantOrders.find((p) => offered.some((q) => q.id === p));
    if (id) this.act({ k: 'order', id });
  }

  /** What reaches a Dock each minute, as a player reads it off the floor: the Factory modules
   * working with a trunk route to the Factory Dock, by the rates on their cards (DESIGN.md §19:
   * the Committee's odd orders are goals while the Bay fills). */
  dockPerMin(item: ItemId): number {
    const g = this.g;
    let n = 0;
    for (const r of g.routes) {
      if (r.to?.kind !== 'fdock') continue;
      const d = g.design(r.from.design);
      const v = d?.outs[item] ?? 0;
      if (!v) continue;
      // a byproduct rides its side route when it has one, the front route otherwise
      const side = g.routes.some((q) => q.from === r.from && q.by);
      if (BYPRODUCTS.has(item) ? side !== r.by : r.by) continue;
      const busy = [...r.from.hist.slice(-60)].filter((c) => c === 'w').length / 60;
      n += v * 60 * busy;
    }
    return n;
  }

  /** The Committee's orders (DESIGN.md §19) this floor fills within about 40 minutes on its own:
   * The Pile while modules send slag to the Factory Dock, Midnight Oil while a Plastic module sends
   * its oil there, and so on; the quickest first. */
  private committeeOrder(offered: string[]): string | undefined {
    let best: string | undefined, bestT = 40;
    for (const id of offered) {
      const o = ORDER[id];
      if (o.customer !== 'committee') continue;
      const p = this.g.s.orders.progress[id] ?? {};
      let t = 0;
      for (const [it, n] of Object.entries(o.wants) as [ItemId, number][]) {
        const left = n - (p[it]?.toNumber() ?? 0);
        if (left <= 0) continue;
        const r = this.dockPerMin(it);
        t = Math.max(t, r > 0 ? left / r : Infinity);
      }
      if (t < bestT) { bestT = t; best = id; }
    }
    return best;
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
    if (this.drawer()) return;
    // folds under way beside the plan: each is audited once its line runs well
    for (const f of [...this.bgFolds]) {
      if (this.fold(f) === 'done') this.bgFolds = this.bgFolds.filter((q) => q !== f);
      if (!this.handReady || this.fq.length) return;
    }
    // optional steps that waited for coin, claims or an annex block: tried again beside the plan,
    // in their order, before it (a copy whose destination still waits, waits with it; one waiting
    // on room lets the next block's purchase behind it go first)
    // (looked at every 10 s while nothing in it moves: a player glances at the coin now and then)
    if (this.later.length && this.g.s.tick >= this.laterAt) {
      let moved = false;
      for (let i = 0; i < this.later.length; ) {
        const res = this.tryStep(this.later[i]);
        if (res === 'done') { this.later.splice(i, 1); moved = true; continue; }
        if (res === DEFER) { i++; continue; }
        return;
      }
      if (!moved) this.laterAt = this.g.s.tick + 10 * TICK_RATE;
    }
    for (let guard = 0; guard < 20 && this.step < this.plan.length; guard++) {
      const s = this.plan[this.step];
      const res = this.tryStep(s);
      if (res === 'done' || res === DEFER) {
        if (res === DEFER) this.later.push(s);
        this.step++;
        continue;
      }
      this.log.waiting = res;
      return;
    }
  }

  /** Optional steps waiting beside the plan (DEFER), in plan order. */
  later: Step[] = [];
  private laterAt = 0;

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
        if (g.s.land.includes(s.id) || (s.when && !s.when(g))) return 'done';
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
        if (s.bg) {
          if (!this.bgFolds.includes(s)) this.bgFolds.push(s);
          return 'done';
        }
        return this.fold(s);
      case 'folded': {
        const left = s.names.filter((n) => !this.designNamed(n));
        return left.length ? `fold ${left.join(', ')}` : 'done';
      }
      case 'fmod':
        return this.fmod(s);
      case 'fplan':
        return this.fplan(s);
      case 'annex': {
        if ((g.s.annex ?? 0) >= s.n) return 'done';
        // a block for a copy of a design: only when that copy could dig (claims, bought first when
        // a block of them costs at most half the coin on hand)
        for (const n of s.for ?? []) {
          const d = this.designNamed(n);
          if (!d) return 'done';
          const c = this.claimFor(d, true);
          if (c === 'short') return s.opt ? DEFER : 'done';
          if (c) return c;
        }
        const price = annexPrice(g);
        if (!price) return 'done';
        const why = annexRefusal(g);
        // (refused for research or the floor: an optional block waits beside the plan for it)
        if (why && !g.s.coin.lt(price)) return s.opt ? DEFER : 'done';
        // an optional block waits beside the plan for the coin (the final round: in a later run the
        // campaign's annex blocks were skipped for good when the plan passed them before the coin came)
        if (g.s.coin.lt(price.mul(s.spare ?? 1))) return s.opt ? DEFER : `coin for annex block ${(g.s.annex ?? 0) + 1}`;
        this.buy({ k: 'annex' }, 'annex');
        return 'annex';
      }
      case 'ffold':
        return this.ffold(s);
    }
  }

  /** A nested fold on the Factory floor: audit the group once every module in it runs, then fold. */
  private ffold(s: Extract<Step, { k: 'ffold' }>): string {
    const g = this.g;
    if (this.designNamed(s.name)) return 'done';
    const a = g.s.faudit;
    if (a) {
      if (a.box.x !== s.box.x || a.box.y !== s.box.y) return 'another nested audit';
      if (!a.result) return 'auditing the group';
      if (!Object.keys(a.result.outs).length) { this.act({ k: 'fauditCancel' }); return 'audit made nothing: again'; }
      if (this.act({ k: 'ffold', name: s.name })) { this.decide('fold:' + a.result.grade.letter); this.mark('ffold:' + s.name); }
      return 'folding the group';
    }
    const mods = g.s.factory.ents.filter((e) => e.kind === 'module' && inside(s.box, e.x, e.y));
    if (ffoldRefusal(g, s.box)) return 'done';
    if (!this.warmSince.has(s.name)) this.warmSince.set(s.name, g.seconds);
    const warm = mods.every((m) => m.hist.length >= 30 && [...m.hist.slice(-30)].filter((c) => c === 'w').length >= 20);
    if (!warm && g.seconds - this.warmSince.get(s.name)! < 15 * 60) return 'group warming up';
    this.buy({ k: 'faudit', ...s.box }, 'audit');
    return 'auditing the group';
  }

  // ---------------------------------------------------------------- Workshop layout

  private part(name: string): Pl[] {
    return PARTS[name] ?? this.found[name] ?? [];
  }

  wanted(): Pl[] {
    return [...this.layout, ...this.standing()].flatMap((n) => this.part(n));
  }

  /** The standing parts, once Slag Bricks is researched and the corridor found: the brick press, and
   * a belt from its front to the Hopper when the corridor does not pass in front of it (found once,
   * joining any belt that leads to the Hopper). */
  private standing(): string[] {
    const g = this.g;
    if (!g.done('slagBricks') || !this.found.corridor) return [];
    if (!this.found.brickOut) {
      // (once the corridor is laid, so the path can join it)
      if (this.found.corridor.some((p) => g.entAt(p.x, p.y)?.kind !== 'belt')) return [];
      const t = g.entAt(11, 6);
      const res = this.reserved();
      for (const p of this.found.corridor) res.add(`${p.x},${p.y}`);
      this.found.brickOut = t ? [] : corridor(g, [11, 6], S, 'hopper', res, true) ?? [];
    }
    return STANDING;
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
      // Surveying, last in turn, wants its coal once Overdrive is in: counted from the start, it kept
      // the second coal miner flooding the spine, and the steel for Overdrive's research waited
      // behind it for 6-9 minutes (the final round)
      if (id === 'surveying' && item !== 'slagBrick' && !this.g.done('overdrive')) continue;
      const want = RESEARCH[id].cost[item];
      if (want) n += Math.max(0, want - (r.progress[id]?.[item]?.toNumber() ?? 0));
    }
    return n - (r.bank[item]?.toNumber() ?? 0);
  }

  /** Is the lab in its loop phases (research only motors and concrete, or none)? */
  looping(): boolean {
    return this.layout.includes('loop') || this.layout.includes('loopX');
  }

  /** The half of the glass and plastic works stopped for a fold of the other half. */
  foldMode: 'glass' | 'plastic' | null = null;

  /** Set once the slag heap has filled again for the Drill works audit. */
  drillGo = false;

  /** The concrete gate (17,8): open while research needs gravel, sand or concrete, and in the
   * loop phases (the drill-bit assembler takes concrete off the loop). */
  /** The gravel line's sand: while research needs sand, or a mixer is built to take it. */
  sandWanted(): boolean {
    return this.needOf('sand') > 0 || this.layout.includes('concrete');
  }

  concreteOut(): boolean {
    // (and while the Concrete line waits for its fold: turned away mid-audit, its concrete backed up
    // and the line folded at D, the final round)
    if (this.layout.includes('concrete') && !this.designNamed('Concrete')) return true;
    return this.looping() || (['gravel', 'sand', 'concrete'] as ItemId[]).some((i) => this.needOf(i) > 0);
  }

  /** Set once the slag heap has filled for the Concrete audit. */
  concreteGo = false;

  /** Glass backed up to the refinery while the Concrete line waits for its fold: the refinery
   * stands blocked on plastic, so the concrete boiler gets no oil (a player sees the jam and turns
   * the kiln's sand miner away until the line runs). */
  glassFlood(): boolean {
    const g = this.g;
    if (!this.layout.includes('concrete') || this.designNamed('Concrete')) return false;
    const r = g.entAt(19, 3);
    return !!r && r.kind === 'refinery' && r.state === 'blocked';
  }

  /** The slag valve (23,9): shut after Concrete is researched until the heap holds enough for a
   * full-speed audit (about 90 s of the mixer at full speed is 120 slag), then open for good. */
  valveOpen(): boolean {
    const g = this.g;
    const h = g.entAt(23, 10);
    const n = h && h.kind === 'heap' ? h.count : 0;
    // the Drill works audit: the heap fills again (170 slag runs the mixer flat out for 2 min), so the drill-bit assembler is measured on a full flow of concrete
    if (this.layout.includes('loopX') && !this.drillGo && !this.designNamed('Drill works')) {
      if (n >= 170) this.drillGo = true;
      return this.drillGo;
    }
    if (this.concreteGo || !this.layout.includes('concrete') || this.designNamed('Concrete')) return true;
    if (n >= 160) this.concreteGo = true;
    return this.concreteGo;
  }

  private rotOf(p: Pl): Dir {
    if (p.on) return p.on(this) ? p.rot : p.off!;
    if (!p.gate) return p.rot;
    return p.gate.some((i) => this.needOf(i) > 0) ? p.rot : p.off!;
  }

  /** Is anything in the layout not built yet? */
  private layoutMissing(): boolean {
    const g = this.g;
    for (const p of this.wanted()) {
      const e = g.entAt(p.x, p.y);
      if (!e || !this.matches(e, p)) return true;
      if (p.recipe && e.recipe !== p.recipe && partKnown(g, p)) return true;
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
        if (p.recipe && e.recipe !== p.recipe && partKnown(g, p)) {
          this.act({ k: 'recipe', x: p.x, y: p.y, recipe: p.recipe });
          return;
        }
        continue;
      }
      // a kept design of exactly what the layout wants in its box: unfolded whole (the Patent
      // Drawer); while it waits on coin or research nothing else is built in its box
      const k = this.keptFor(p.x, p.y, want);
      if (k) {
        const why = unfoldKeptRefusal(g, k);
        if (!why) {
          if (this.buy({ k: 'unfoldKept', id: k.id }, 'unfold') && (g.s.drafted ?? []).includes(k.id)) { this.adopt(k); this.unfolds++; }
          return;
        }
        if (why.waits === 'coin' || why.waits === 'research') continue;
      }
      if (g.canPlace(p.kind, p.x, p.y)) continue;
      // a machine whose recipe is not known yet waits (it would pick the wrong one)
      if (p.recipe && !partKnown(g, p)) continue;
      // a belt lifted to clear it and laid again is logged as a relay, not a decision (rule 2)
      const relay = this.relays.delete(`${p.x},${p.y}`);
      if (this.buy({ k: 'place', kind: p.kind, x: p.x, y: p.y, rot: this.rotOf(p) }, relay ? 'relay' : p.kind)) return;
    }
    // a belt turned to a new job can keep an item from the old one that its new end never takes
    // (sand left on the belt now feeding the concrete boiler): a player lifts the belt and lays it
    // again, and the item goes with it
    for (const p of want) {
      if (p.kind !== 'belt') continue;
      const e = g.entAt(p.x, p.y);
      if (!e || e.kind !== 'belt' || !e.item || auditLock(g, p.x, p.y)) continue;
      const f = g.entAt(p.x + DX[e.rot], p.y + DY[e.rot]);
      if (!f || (f.kind !== 'boiler' && f.kind !== 'generator') || accepts(g, f, e.item, e.rot)) continue;
      if (this.act({ k: 'remove', x: p.x, y: p.y })) { this.mine.delete(e.id); this.relays.add(`${p.x},${p.y}`); }
      return;
    }
  }

  /** Belts lifted to clear an item their end never takes, to lay again (the final round: a relay is
   * upkeep, not a decision, so rule 2 does not read it as one). */
  private relays = new Set<string>();

  // ---------------------------------------------------------------- folding

  bgFolds: Extract<Step, { k: 'fold' }>[] = [];
  private warmSince = new Map<string, number>();

  /** Is anything wanted inside the box not built yet? */
  private boxMissing(b: Box): boolean {
    const g = this.g;
    for (const p of this.wanted()) {
      if (!inside(b, p.x, p.y)) continue;
      const e = g.entAt(p.x, p.y);
      if (!e || !this.matches(e, p)) return true;
      if (p.recipe && e.recipe !== p.recipe && partKnown(g, p)) return true;
    }
    return false;
  }

  private fold(s: Extract<Step, { k: 'fold' }>): string {
    const g = this.g;
    if (g.s.designs.some((d) => d.name === s.name)) {
      if (s.mode && this.foldMode === s.mode) this.foldMode = null;
      return 'done';
    }
    if (s.mode) this.foldMode = s.mode;
    const a = g.s.audits.find((q) => q.box.x === s.box.x && q.box.y === s.box.y && q.box.w === s.box.w && q.box.h === s.box.h);
    if (!a) {
      if (this.boxMissing(s.box)) { this.warmSince.delete(s.name); return 'building before the fold'; }
      if (!this.warmSince.has(s.name)) this.warmSince.set(s.name, g.seconds);
      // a player waits a while for a line to run well, then folds it as it is
      if (s.ready && !s.ready(g, this) && g.seconds - this.warmSince.get(s.name)! < 30 * 60) return 'line warming up';
      const why = foldRefusal(g, s.box);
      if (why) return `fold: ${why}`;
      this.buy({ k: 'audit', ...s.box }, 'audit');
      return 'auditing';
    }
    if (!a.result) return 'auditing';
    // a line that made nothing in the window is not folded (it would be a module of nothing): a
    // player cancels and audits it again once it runs
    if (!Object.keys(a.result.outs).length) {
      if (this.act({ k: 'auditCancel', id: a.id })) this.warmSince.set(s.name, g.seconds);
      return 'audit made nothing: again';
    }
    // wire leaking in from a neighbour: the Bay floor's Circuits copy would starve without it
    const leak = s.pure?.find((i) => (a.result!.ins[i] ?? 0) > 0);
    if (leak && (this.reaudits.get(s.name) ?? 0) < 3) {
      if (this.act({ k: 'auditCancel', id: a.id })) { this.reaudits.set(s.name, (this.reaudits.get(s.name) ?? 0) + 1); this.warmSince.set(s.name, g.seconds); }
      return `audit measured ${leak} coming in: again`;
    }
    const r = this.act({ k: 'fold', name: s.name, id: a.id });
    if (r) {
      this.decide('fold:' + a.result.grade.letter);
      this.mark('fold:' + s.name);
      // the Patent Drawer (DESIGN.md §19): a lab line is kept for the next run (not the Act III
      // policy's Chute lines: their slots change from run to run, bot3.ts)
      if (!s.nokeep) this.toKeep.push(s.name);
      // what was in the box is gone: forget it
      for (const id of [...this.mine]) if (!g.byId.has(id)) this.mine.delete(id);
    }
    return 'folding';
  }

  // ---------------------------------------------------------------- the Factory floor

  designNamed(name: string): ModuleDesign | undefined {
    return this.g.s.designs.find((d) => d.name === name);
  }

  /** Claims bought (the final round: the bot never went to the Survey Office), by ore. */
  claimsBought: Partial<Record<ItemId, number>> = {};

  /**
   * A block of claims for the ore a copy of `d` lacks (stamping it: `place` false; placing it on the
   * floor: true), bought at the Survey Office when the block costs at most half the coin on hand: a
   * player buys claims before clearing a chain or leaving a copy out. A status while buying (or the
   * hand is busy), 'short' when a claim is missing and not affordable now, null when none is missing.
   */
  private claimFor(d: ModuleDesign, place: boolean): string | null {
    const g = this.g;
    let short = false;
    for (const [ore, n] of Object.entries(claimLoad(g, d)) as [ItemId, number][]) {
      const used = place ? placedClaims(g, ore) : claimsUsed(g, ore);
      if (used + n <= claimsHeld(g, ore) + 1e-9) continue;
      const price = claimPrice(g, ore);
      if (!g.done('surveying') || !price || g.s.coin.lt(price.mul(2))) { short = true; continue; }
      const r = this.act({ k: 'claim', item: ore });
      if (r) {
        this.decide('claim:' + ore);
        this.claimsBought[ore] = (this.claimsBought[ore] ?? 0) + 1;
      }
      return `buying ${ore} claims`;
    }
    return short ? 'short' : null;
  }

  // ---------------------------------------------------------------- the Patent Drawer

  /** designs folded this run to keep, by name */
  private toKeep: string[] = [];
  private seenDrafted = 0;
  private queued = new Set<number>();
  /** kept designs unfolded by hand, and by the Draughtsman, this run (the logs) */
  unfolds = 0;

  /** The ents of a kept design's box are this bot's now (it turns its valves, lifts what the plan
   * no longer wants). */
  private adopt(k: KeptDesign) {
    for (const e of entsIn(this.g, { x: k.x, y: k.y, w: k.w, h: k.h })) this.mine.add(e.id);
  }

  /** Keep the lab lines folded this run (one a hand-beat, while the drawer has room), and with the
   * Draughtsman queue the kept designs the plan folds again, in the plan's order. True when the
   * hand was used. */
  private drawer(): boolean {
    const g = this.g;
    while (this.toKeep.length) {
      const name = this.toKeep[0];
      const d = this.designNamed(name);
      if (!d || g.s.meta.drawer.some((k) => k.name === name) || keepRefusal(g, d.id)) { this.toKeep.shift(); continue; }
      const r = this.act({ k: 'keep', id: d.id });
      if (r === null) return true;
      this.toKeep.shift();
      if (r) this.decide('keep');
      return true;
    }
    if (!hasPatent(g, 'draughtsman')) return false;
    for (const s of this.plan) {
      if (s.k !== 'fold') continue;
      const k = g.s.meta.drawer.find((q) => q.name === s.name && q.x === s.box.x && q.y === s.box.y);
      if (!k || this.queued.has(k.id) || g.s.meta.queue.includes(k.id) || (g.s.drafted ?? []).includes(k.id)) continue;
      const r = this.act({ k: 'queueKept', id: k.id });
      if (r === null) return true;
      this.queued.add(k.id);
      if (r) this.decide('queue');
      return true;
    }
    return false;
  }

  /** A kept design to unfold whole for the part at (x, y): not unfolded yet this run, its box empty,
   * and the parts the layout wants in its box exactly its parts (unfolding it builds what the plan
   * would build piece by piece, in one action, and its audit is then the short refold check). */
  private keptFor(x: number, y: number, want: Pl[]): KeptDesign | null {
    const g = this.g;
    const drafted = g.s.drafted ?? [];
    for (const k of g.s.meta.drawer) {
      const box = { x: k.x, y: k.y, w: k.w, h: k.h };
      if (drafted.includes(k.id) || !inside(box, x, y) || entsIn(g, box).length) continue;
      const here = want.filter((p) => inside(box, p.x, p.y));
      if (here.length !== k.parts.length) continue;
      const same = k.parts.every((q) => here.some((p) => p.kind === q.kind && p.x === k.x + q.dx && p.y === k.y + q.dy && this.rotOf(p) === q.rot && (!q.recipe || p.recipe === q.recipe)));
      if (same) return k;
    }
    return null;
  }

  private fmod(s: Extract<Step, { k: 'fmod' }>): string {
    const g = this.g;
    if (this.mods[s.id] !== undefined && g.s.factory.ents.some((e) => e.id === this.mods[s.id])) return 'done';
    const d = this.designNamed(s.design);
    if (!d) return `no design ${s.design}`;
    if (d.spare < 1) {
      // a claim short for the copy: a block from the Survey Office first (the final round)
      const c = this.claimFor(d, false);
      if (c && c !== 'short') return c;
      const why = stampRefusal(g, d);
      // an optional copy short of claims waits for the coin to buy them (DEFER); one refused for
      // anything but coin (Machine Kits) is left out
      if (why && s.opt && c === 'short') return DEFER;
      if (why && s.opt && !g.s.coin.lt(stampCost(g, d))) return 'done';
      if (why) return `stamp ${s.design}: ${why}`;
      this.buy({ k: 'stamp', id: d.id }, 'stamp');
      return 'stamping';
    }
    if (g.s.tick < this.placeAt) return `no room for ${s.id}`;
    // a copy that can't dig: buy a block of claims when it costs at most half the coin on hand
    const c = this.claimFor(d, true);
    if (c && c !== 'short') return c;
    // an optional copy that still can't dig, or has no annex block to stand in yet, waits for the
    // coin (it is tried again beside the plan)
    if (s.opt && (c === 'short' || (s.annex && g.fw <= FACTORY.w))) return DEFER;
    // out of claims for another copy digging, and none affordable: clear the newest Act I chain
    if (c === 'short') return this.clearChain(`claims for ${s.id}`);
    // a destination module that does not take these goods: no room to clear would help
    for (const [dest, items] of [[s.to, mainOuts(d, !!s.by)], [s.by, byOuts(d)]] as [Dest | undefined, ItemId[]][]) {
      if (dest?.k !== 'mod' || !items.length) continue;
      const m = g.s.factory.ents.find((e) => e.id === this.mods[dest.id]);
      const dd = m && g.design(m.design);
      // (a destination copy still waiting beside the plan: this one waits with it)
      if (!dd && s.opt && this.later.some((q) => q.k === 'fmod' && q.id === dest.id)) return DEFER;
      if (!dd || !items.every((i) => (dd.ins[i] ?? 0) > 0)) return s.opt ? 'done' : `${dest.id} does not take ${items.join(', ')}`;
    }
    const plan = placeModule(g, d, s.to, s.by, this.mods, s.hub, s.annex ? { x0: FACTORY.w + 2, tx0: FACTORY.w } : undefined, s.zone);
    // an annex copy with no room waits while a block is still to buy
    if (!plan && s.opt) return s.annex && annexPrice(g) ? DEFER : 'done';
    if (!plan) {
      // no room: clear the newest Act I chain (modules back to the inventory, trunks refunded)
      if (nextChainToClear(g, new Set(Object.values(this.mods)))) return this.clearChain(`room for ${s.id}`);
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

  /** One command toward a hand-laid floor: clear what is not in it, stamp copies it needs, lay
   * its trunks, then its modules. */
  private fplan(s: Extract<Step, { k: 'fplan' }>): string {
    const g = this.g;
    const want = new Map<string, FPl>();
    for (const p of s.items) want.set(`${p.x},${p.y}`, p);
    const fits = (e: FEnt, p: FPl | undefined) => !!p && e.kind === p.kind && e.rot === p.rot && (p.kind === 'trunk' || g.design(e.design)?.name === p.design);
    // clear: modules first (their flows stop), newest first, then trunks
    // the annex (east of the 12x8) is laid by its own steps: a 12x8 plan never clears it
    const extra = g.s.factory.ents
      .filter((e) => !s.keep && (e.kind === 'module' || e.kind === 'trunk') && e.x < FACTORY.w && !fits(e, want.get(`${e.x},${e.y}`)))
      .sort((a, b) => (a.kind === b.kind ? b.id - a.id : a.kind === 'module' ? -1 : 1));
    if (extra.length) {
      const e = extra[0];
      if (this.act({ k: 'fremove', x: e.x, y: e.y })) {
        if (e.kind === 'module') { this.decide('clear'); this.log.cleared++; }
      }
      return `clearing the floor for ${s.name}`;
    }
    const skip = this.skipped.get(s.name) ?? new Set<string>();
    const missing = s.items.filter((p) => { const e = g.fentAt(p.x, p.y); return !skip.has(`${p.x},${p.y}`) && (!e || !fits(e, p)); });
    if (!missing.length) {
      this.mark('fplan:' + s.name);
      return 'done';
    }
    // an optional plan leaves out what can't go (a module without claims or design, a tile off the
    // floor) and lays the rest
    const skipIt = (p: FPl, why: string) => {
      if (!s.opt) return why;
      skip.add(`${p.x},${p.y}`);
      this.skipped.set(s.name, skip);
      return `skipping ${p.design ?? 'a trunk'}: ${why}`;
    };
    const off = missing.find((p) => p.x >= g.fw || p.y >= g.fh);
    if (off) return skipIt(off, 'off the floor');
    // a tile taken by something this plan does not clear (the annex, or a plan that keeps the rest)
    const taken = missing.find((p) => g.fentAt(p.x, p.y) && (s.keep || p.x >= FACTORY.w));
    if (taken) return skipIt(taken, 'the tile is taken');
    const t = missing.find((p) => p.kind === 'trunk');
    if (t) {
      if (g.s.coin.lt(FACTORY.trunkCost)) return 'coin for trunks';
      this.act({ k: 'ftrunk', x: t.x, y: t.y, rot: t.rot });
      return `laying ${s.name}`;
    }
    const m = missing[0];
    const d = this.designNamed(m.design!);
    if (!d) return skipIt(m, `no design ${m.design}`);
    if (d.spare < 1) {
      // claims short for the copy: a block first, when it costs at most half the coin on hand
      const c = this.claimFor(d, false);
      if (c && c !== 'short') return c;
      const why = stampRefusal(g, d);
      if (why && !g.s.coin.lt(stampCost(g, d))) return skipIt(m, `stamp ${d.name}: ${why}`);
      if (why) return `stamp ${d.name}: ${why}`;
      this.buy({ k: 'stamp', id: d.id }, 'stamp');
      return 'stamping';
    }
    const c = this.claimFor(d, true);
    if (c && c !== 'short') return c;
    const why = placeClaimRefusal(g, d);
    if (why) return skipIt(m, `place ${d.name}: ${why}`);
    if (this.buy({ k: 'fplace', design: d.id, x: m.x, y: m.y, rot: m.rot }, 'module')) this.mark('module:' + d.name);
    return `placing ${d.name}`;
  }

  /** audits taken again because something the line makes came in from outside */
  private reaudits = new Map<string, number>();

  /** tiles an optional plan left out, by plan name */
  private skipped = new Map<string, Set<string>>();

  /** Queue the removal of the newest Act I chain (modules back to the inventory, trunks refunded). */
  private clearChain(why: string): string {
    const clear = nextChainToClear(this.g, new Set(Object.values(this.mods)));
    if (!clear) return `no chain left to clear (${why})`;
    this.fq = clear.map((t): Cmd => ({ k: 'fremove', x: t.x, y: t.y }));
    this.decide('clear');
    this.log.cleared++;
    return `clearing a chain: ${why}`;
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

/** A part's recipe is known (a Chute Mouth's "recipe" is the item it pushes out: always). */
const partKnown = (g: Game, p: Pl) => p.kind === 'chuteMouth' || recipeKnown(g, RECIPE[p.recipe!]);

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
export function corridor(g: Game, from: [number, number], enter: Dir, to: 'hopper' | 'dock', reserved: Set<string>, join = false): Pl[] | null {
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
  const inSink = (x: number, y: number) => x >= sink.x && y >= sink.y && x < sink.x + sink.w && y < sink.y + sink.h;
  // `join`: a belt already leading to the sink ends the path too (from its side or its back)
  const leads = (x: number, y: number, d: Dir) => {
    let b = g.entAt(x, y);
    if (!b || b.kind !== 'belt' || b.rot === opposite(d)) return false;
    for (let n = 0; n < 64 && b && b.kind === 'belt'; n++) {
      const nx = b.x + DX[b.rot], ny = b.y + DY[b.rot];
      if (inSink(nx, ny)) return true;
      b = g.entAt(nx, ny);
    }
    return false;
  };
  const isSink = (x: number, y: number, d: Dir) => inSink(x, y) || (join && leads(x, y, d));
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
      if (isSink(nx, ny, d)) { end = cur; endDir = d; break; }
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

// ------------------------------------------------------------------ Factory-floor groups

/** Modules joined by trunk routes, each group sorted by id. */
export function moduleGroups(g: Game): FEnt[][] {
  const mods = g.s.factory.ents.filter((e) => e.kind === 'module');
  const parent = new Map<number, number>();
  const find = (a: number): number => {
    let r = a;
    while (parent.get(r) !== r) r = parent.get(r)!;
    parent.set(a, r);
    return r;
  };
  for (const m of mods) parent.set(m.id, m.id);
  for (const r of g.routes) if (r.to && r.to.kind === 'module' && parent.has(r.from.id) && parent.has(r.to.id)) parent.set(find(r.from.id), find(r.to.id));
  const out = new Map<number, FEnt[]>();
  for (const m of mods) {
    const k = find(m.id);
    if (!out.has(k)) out.set(k, []);
    out.get(k)!.push(m);
  }
  return [...out.values()].map((grp) => grp.sort((a, b) => a.id - b.id)).sort((a, b) => a[0].id - b[0].id);
}

/** The tiles of the newest Act I chain on the Factory floor (the planner's Gizmo chains: modules
 * this bot did not place, joined by trunks), modules first, then the trunks no other module's
 * route uses: what a player clears to make room after the Festival. */
export function nextChainToClear(g: Game, mine: Set<number>): { x: number; y: number }[] | null {
  const routes = buildRoutes(g);
  const groups = moduleGroups(g).filter((grp) => grp.every((m) => !mine.has(m.id)));
  if (!groups.length) return null;
  const grp = groups.sort((a, b) => b[b.length - 1].id - a[a.length - 1].id)[0];
  const ids = new Set(grp.map((m) => m.id));
  const keep = new Set<number>();
  for (const r of routes) if (!ids.has(r.from.id)) for (const t of r.tiles) keep.add(t.id);
  const trunks = new Map<number, FEnt>();
  for (const r of routes) if (ids.has(r.from.id)) for (const t of r.tiles) if (!keep.has(t.id)) trunks.set(t.id, t);
  return [...grp, ...trunks.values()].map((e) => ({ x: e.x, y: e.y }));
}

// ------------------------------------------------------------------ Factory-floor placement

export interface FPlan { x: number; y: number; rot: Dir; trunks: { x: number; y: number; rot: Dir }[] }

// the Factory floor grows east with the annex (DESIGN.md §19): bounds read the floor as it stands;
// the hazard grids are laid out at the widest it gets
const finb = (g: Game, x: number, y: number) => x >= 0 && y >= 0 && x < g.fw && y < g.fh;
const FW = FACTORY_MAX_W;

/** What a new trunk tile must avoid: tiles someone's items arrive at (a module's front, the tile
 * an existing trunk points into), and directions that would make it a module's byproduct route
 * (beside a module, pointing away from it). */
interface FHaz { arrive: Uint8Array; away: Uint8Array }

function fhazards(g: Game): FHaz {
  const arrive = new Uint8Array(FW * FACTORY_MAX_H);
  const away = new Uint8Array(FW * FACTORY_MAX_H);
  for (const e of g.s.factory.ents) {
    if (e.kind === 'module' || e.kind === 'trunk') {
      const x = e.x + DX[e.rot], y = e.y + DY[e.rot];
      if (finb(g, x, y)) arrive[y * FW + x] = 1;
    }
    if (e.kind === 'module') {
      for (const s of [ccw(e.rot), cw(e.rot)]) {
        const x = e.x + DX[s], y = e.y + DY[s];
        if (finb(g, x, y)) away[y * FW + x] |= 1 << s;
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
  if (e.kind === 'fchute') return true;
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
      if (!finb(g, nx, ny)) continue;
      const t = g.fentAt(nx, ny);
      if (t) {
        // a trunk held by a plan (the annex's) is not joined
        if (t.kind === 'trunk' && blocked.has(ny * FW + nx)) continue;
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
    if (to.k === 'chute') return e.kind === 'fchute';
    return e.kind === 'module' && e.id === mods[to.id] && takes(g, e, d, items);
  };
}

/** Where to put a copy of `d` so its main outputs reach `to` (and its byproducts `by`, out of a
 * side trunk), with the fewest trunk tiles. */
const byOuts = (d: ModuleDesign) => (Object.keys(d.outs) as ItemId[]).filter((i) => BYPRODUCTS.has(i));
const mainOuts = (d: ModuleDesign, by: boolean) => (Object.keys(d.outs) as ItemId[]).filter((i) => !by || !BYPRODUCTS.has(i));

/** A placement confined to a part of the Factory floor (the Act III policy's bench and Chute floor,
 * bot3.ts): the module goes inside `mods`, its trunks stay inside `trunks`. */
export interface PlaceZone { mods: Box; trunks: Box }

/** `hub`: several modules will feed this one, so the tiles around its back stay open for their trunks. */
export function placeModule(g: Game, d: ModuleDesign, to: Dest, by: Dest | undefined, mods: Record<string, number>, hub = false, area?: { x0: number; tx0: number }, zone?: PlaceZone): FPlan | null {
  const byItems = byOuts(d);
  const main = mainOuts(d, !!by);
  const h = fhazards(g);
  const blocked = new Set<number>();
  // a module for the annex (§19) and its trunks stay east of the 12x8: the Bay floor's hand-laid
  // plan clears everything else on the 12x8
  // (modules from x0, trunks from tx0; the tiles the hand-laid annex plans hold stay free, and their
  // trunks are joined only at the lane)
  if (zone) {
    for (let y = 0; y < g.fh; y++) for (let x = 0; x < g.fw; x++) if (!inside(zone.trunks, x, y)) blocked.add(y * FW + x);
  } else if (area) {
    for (let y = 0; y < g.fh; y++) for (let x = 0; x < area.tx0; x++) blocked.add(y * FW + x);
    for (const k of ANNEX_HELD) if (k !== 3 * FW + 12) blocked.add(k);
  } else {
    // a module for the 12x8 stays on it, off the tiles the annex plans hold beside the Dock
    for (let y = 0; y < g.fh; y++) for (let x = FACTORY.w; x < g.fw; x++) blocked.add(y * FW + x);
    for (const k of ANNEX_HELD) blocked.add(k);
  }
  // the Megaproject Bay's corner stays clear until it arrives
  if (!g.s.factory.ents.some((e) => e.kind === 'fbay')) for (let y = FACTORY.bay.y; y < FACTORY.bay.y + 2; y++) for (let x = FACTORY.bay.x; x < FACTORY.bay.x + 2; x++) blocked.add(y * FW + x);
  // trunks pointing into a tile would feed a module there (or stop dead at it)
  let best: FPlan | null = null;
  for (let y = 0; y < g.fh; y++)
    for (let x = area?.x0 ?? 0; x < g.fw; x++) {
      if (g.fentAt(x, y) || blocked.has(y * FW + x) || h.arrive[y * FW + x]) continue;
      if (zone && !inside(zone.mods, x, y)) continue;
      for (let rot = 0 as Dir; rot < 4; rot = (rot + 1) as Dir) {
        const fx = x + DX[rot], fy = y + DY[rot];
        if (!finb(g, fx, fy)) continue;
        // a module that takes inputs keeps its back open for the trunk that will feed it
        if (Object.keys(d.ins).length) {
          const bx = x - DX[rot], by_ = y - DY[rot];
          if (!finb(g, bx, by_) || blocked.has(by_ * FW + bx) || h.arrive[by_ * FW + bx]) continue;
          const t = g.fentAt(bx, by_);
          if (t && !(t.kind === 'trunk' && t.rot === rot)) continue;
          if (hub) {
            let open = 0;
            for (const k of [opposite(rot), ccw(rot), cw(rot)]) {
              const nx = bx + DX[k], ny = by_ + DY[k];
              if (finb(g, nx, ny) && !g.fentAt(nx, ny) && !blocked.has(ny * FW + nx)) open++;
            }
            if (open < 3) continue;
          }
        }
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
        // a module feeding another sits a trunk away from it, so others can join that trunk
        if (to.k === 'mod' && !path.length) continue;
        let trunks = path;
        if (by && byItems.length) {
          for (const p of path) bl.add(p.y * FW + p.x);
          let side: Trunk[] | null = null;
          for (const s of [ccw(rot), cw(rot)]) {
            const sx = x + DX[s], sy = y + DY[s];
            if (!finb(g, sx, sy) || g.fentAt(sx, sy)) continue;
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
