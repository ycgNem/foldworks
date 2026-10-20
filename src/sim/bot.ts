// Bots: scripted players for the pace tests (DESIGN.md §13) and `npm run bot`. Pure: they read the
// Game and send commands through `g.act` like the UI does (so a bot's run replays from its seed and
// command history), never write the state directly, and are honest about hands and eyes:
//  - map clicks at 4 a second at most (DESIGN.md §1: the sustained active rate, well under the
//    12 clicks/s cap), and building commands (place, remove, turn a belt, select) at 4 a second;
//  - a Spark is clicked about 2 s after it appears (a person notices it), never before;
//  - they look only at what the screen shows (the map, buffers, research and order progress), never
//    at the sim's random state or the next Spark's timer.
//
// planner : the competent player. Follows PLAN for the slice map, buys each step as soon as it is
//           affordable, sends a line to the Hopper while research still needs what it carries,
//           otherwise to the Dock (or into the Gizmo assembler).
// greedy  : the impatient player. The same layout, but it skips ahead to later steps when the next
//           one is locked behind land or a build unlock, researches any node its bank already pays
//           for, accepts every order the moment it is offered, and after the slice stamps more
//           copper wire while its claims last. §13 check 10 (dead air) uses it.
// dockOnly: sends everything to the Dock. It builds no Hopper-only line, and turns a line to the
//           Hopper only while the plan is stuck on research, for that one node (§13 check 11).
import type { Game, Cmd } from './Game';
import type { Dir, Ent } from './world';
import { isMachine, type BuildKind, type UpgradeId } from '../data/machines';
import { RESEARCH, RESEARCH_IDS, type ResearchId } from '../data/research';
import { BUILD, UPGRADES } from '../data/machines';
import { CHUNKS, FACTORY } from '../data/land';
import { foldRefusal } from './systems/audits';
import { stampCost } from './systems/modules';
import { RECIPE } from '../data/recipes';
import type { ItemId } from '../data/items';
import { RULES } from '../data/rules';
import { TICK_RATE } from '../engine/time';
import { available } from './systems/research';
import { offeredOrders } from './systems/orders';

export type Policy = 'planner' | 'greedy' | 'dockOnly' | 'idle';

/** E S W N */
const E: Dir = 0, S: Dir = 1, W: Dir = 2, N: Dir = 3;

export type Step =
  | { k: 'place'; kind: BuildKind; x: number; y: number; rot: Dir; only?: Policy[] }
  | { k: 'swap'; kind: BuildKind; x: number; y: number; rot: Dir; only?: Policy[] }
  | { k: 'upgrade'; id: UpgradeId; only?: Policy[] }
  | { k: 'land'; id: string; only?: Policy[] }
  | { k: 'order'; id: string; only?: Policy[] }
  | { k: 'need'; research: ResearchId; only?: Policy[] }
  // folding (DESIGN.md §10): audit the box, wait for the grade, fold; `design` below is the index
  // of a fold in the order this bot folded them
  | { k: 'fold'; x: number; y: number; w: number; h: number; name: string; only?: Policy[] }
  | { k: 'stamp'; design: number; copies: number; only?: Policy[] }
  // the Factory floor (DESIGN.md §11)
  | { k: 'fplace'; design: number; x: number; y: number; rot: Dir; only?: Policy[] }
  | { k: 'ftrunk'; x: number; y: number; rot: Dir; only?: Policy[] };

const P = (kind: BuildKind, x: number, y: number, rot: Dir): Step => ({ k: 'place', kind, x, y, rot });
const SW = (kind: BuildKind, x: number, y: number, rot: Dir): Step => ({ k: 'swap', kind, x, y, rot });
const belts = (pts: [number, number, Dir][]): Step[] => pts.map(([x, y, r]) => P('belt', x, y, r));
const need = (research: ResearchId): Step => ({ k: 'need', research });
const order = (id: string): Step => ({ k: 'order', id });
const fold = (x: number, y: number, w: number, h: number, name: string): Step => ({ k: 'fold', x, y, w, h, name });
const fplace = (design: number, x: number, y: number, rot: Dir): Step => ({ k: 'fplace', design, x, y, rot });
const trunks = (pts: [number, number, Dir][]): Step[] => pts.map(([x, y, rot]) => ({ k: 'ftrunk', x, y, rot }));
const not = (policies: Policy[], steps: Step[]): Step[] => {
  const all: Policy[] = ['planner', 'greedy', 'dockOnly'];
  return steps.map((s) => ({ ...s, only: all.filter((p) => !policies.includes(p)) }));
};

/**
 * The slice plan. The map at Folding (planner, seed 1000; D Dock, H Hopper, h Slag Heap, M miner,
 * F Hand Furnace, s smelter, p press, a assembler, `:` an unused ore tile, arrows are belts):
 *
 *      0123456789012
 *    0 hp>>>>v.v<<<p     L3: miner (1,2) -> smelter (1,1) -> press (1,0) -> row 0 -> Dock
 *    1 hshh..DD<.h.sh    C4: miner (12,2) -> smelter (12,1) -> press (12,0) -> row 0 -> (8,1) -> Dock
 *    2 .MMspvDD<psMM     L2: miner (2,2) -> smelter (3,2) -> press (4,2) -> (5,2) router
 *    3 .MMFpava^psM:     L1: miner (2,3) -> furnace -> press (4,3) -> assembler (5,3) -> (6,3) router
 *    4 .shh>>HH<.h..     C1/C2: copper miners (11,3), (11,2) -> smelters -> presses -> (8,3), (8,2)
 *    5 .pa>>>HH          L4: miner (1,3) -> smelter (1,4) -> press (1,5) -> assembler (2,5) -> Hopper
 *
 * Routers (the bot turns them; turning a belt is free): (5,2) sends L2's plates east to the Dock or
 * south into L1's gear assembler; (6,3) sends L1 north to the Dock, south to the Hopper or east into
 * the Gizmo assembler at (7,3), which faces north (Dock) or south (Hopper); (8,3) sends C1 south via
 * (8,4) to the Hopper, west into the Gizmo assembler, or north via (8,2) to the Dock; (8,2) sends C2
 * west to the Dock or south into (8,3). Slag: every smelter has a heap on a free side, chained so
 * each line has 800+ slag of room (over 100 min): L4's heap (2,4) empties into the furnace's (3,4),
 * which overflows east into (4,4) and (5,4) (the last faces the Hopper, which takes slag only while
 * Slag Bricks is selected); L2's (3,1) empties into (2,1), shared with L3, whose (0,1) overflows into
 * (0,0); the copper heaps chain to (10,5), (9,1) and (11,1).
 *
 * After Gizmo Theory, chunk C (rows 9-14) gets four gear lines on its iron patch, up columns 6 and 7
 * into the Hopper's south side. After Folding (DESIGN.md §13 check 9) every bot folds three products
 * and chains two of them on the Factory floor (F the Factory Dock, rows 0-2 of the floor):
 *
 *      89AB
 *    0 >>vC     C: more "Copper wire" (greedy, past the slice end)
 *    1 ^cFF     c: "Copper wire" (C4) into the Dock
 *    2 igFF     i: "Iron ingots" (miners + smelters) into g's back; its slag up the side trunk (8,1)
 *                  and along row 0 into the Dock, which scraps it (g refuses slag)
 *               g: "Gear works" (presses + assembler, ingots in) into the Dock
 *
 * The planner and greedy fold chunk C's CA pair as "Iron ingots" (box 3,11 2x2), rebuild its miners
 * and smelters (200 coin), and fold the presses and assembler left behind as "Gear works" (box 5,11
 * 2x2); the Dock-only player folds L3's miner and smelter (box 1,1 1x2) and L1's press and
 * assembler fed by the Hand Furnace (box 4,3 2x1).
 */
export const PLAN: Step[] = [
  { k: 'upgrade', id: 'bellows' },
  // L1: the first miner into the Hand Furnace, its slag into a heap
  P('miner', 2, 3, E),
  P('heap', 3, 4, E),
  // L2: miner -> smelter -> belts -> Dock; slag north into heaps
  P('miner', 2, 2, E), P('smelter', 3, 2, E), ...belts([[4, 2, E], [5, 2, E]]), P('heap', 3, 1, W), P('heap', 2, 1, W),
  need('pressing'),
  SW('press', 4, 3, E),
  SW('press', 4, 2, E),
  // L3: miner -> smelter -> press -> row 0 -> Dock from above
  P('miner', 1, 2, N), P('smelter', 1, 1, N), P('heap', 0, 1, N), P('heap', 0, 0, E),
  P('press', 1, 0, E), ...belts([[2, 0, E], [3, 0, E], [4, 0, E], [5, 0, E], [6, 0, S]]),
  need('surveyEast'),
  { k: 'land', id: 'B' },
  // chunk B: two copper miners, ore west along rows 2 and 3, down (8,2) and (8,3), into the Hopper via (8,4)
  P('miner', 11, 3, W), ...belts([[10, 3, W], [9, 3, W], [8, 3, S], [8, 4, W]]),
  P('miner', 11, 2, W), ...belts([[10, 2, W], [9, 2, W], [8, 2, S]]),
  need('copperSmelting'),
  SW('smelter', 10, 3, W), P('heap', 10, 4, S), P('heap', 10, 5, E),
  SW('smelter', 10, 2, W), P('heap', 10, 1, W),
  need('wireDrawing'),
  SW('press', 9, 3, W),
  // (9,1) overflows C2's heap; it faces the press (which refuses slag), never the belt it replaced
  SW('press', 9, 2, W), P('heap', 9, 1, S),
  need('gearcutting'),
  // gears: L1 into the router
  SW('assembler', 5, 3, E),
  // L4 (planner, greedy): a gear line straight into the Hopper's west side; its slag joins the
  // furnace's heap, which overflows east into two more (the last faces the Hopper, which takes slag
  // only while Slag Bricks is being researched)
  ...not(['dockOnly'], [
    P('miner', 1, 3, S), P('smelter', 1, 4, S), P('heap', 2, 4, E), P('press', 1, 5, E), P('assembler', 2, 5, E), ...belts([[3, 5, E], [4, 5, E], [5, 5, E]]),
  ]),
  P('heap', 4, 4, E), P('heap', 5, 4, E),
  need('gizmoTheory'),
  // the Gizmo assembler between the Dock and the Hopper: gears from L1 (west), wire from C1 (east)
  P('assembler', 7, 3, S),
  order('lampPosts'),
  order('gizmoFestival'),
  order('boardwalk'),
  // C4: the last copper tile, wire along row 0 into the Dock's east side
  P('miner', 12, 2, N), P('smelter', 12, 1, N), P('heap', 13, 1, W), P('heap', 11, 1, E), P('press', 12, 0, W),
  ...belts([[11, 0, W], [10, 0, W], [9, 0, W], [8, 0, S], [8, 1, W]]),
  // chunk C (after Gizmo Theory): four gear lines on the second iron patch, up columns 6 and 7 into
  // the Hopper's south side (planner, greedy: the Dock-only player builds no Hopper line)
  ...not(['dockOnly'], [
    { k: 'land', id: 'C' },
    // CA: miners (3,11) and (3,12) -> smelters -> presses -> one assembler at (6,11) facing north
    P('miner', 3, 11, E), P('smelter', 4, 11, E), P('heap', 4, 10, S), P('press', 5, 11, E), P('assembler', 6, 11, N),
    ...belts([[6, 10, N], [6, 9, N], [6, 8, N], [6, 7, N], [6, 6, N]]),
    P('miner', 3, 12, E), P('smelter', 4, 12, E), P('heap', 4, 13, N), P('press', 5, 12, E), P('belt', 6, 12, N),
    // CB: miner (2,11) -> smelter (2,10) -> press (2,9) -> assembler (3,9) -> row 9 into column 6
    P('miner', 2, 11, N), P('smelter', 2, 10, N), P('heap', 1, 10, E), P('heap', 3, 10, W), P('press', 2, 9, E), P('assembler', 3, 9, E), ...belts([[4, 9, E], [5, 9, E]]),
    // CC: miner (2,12) -> smelter (2,13) -> press (2,14) -> assembler (3,14) -> row 14 -> column 7
    P('miner', 2, 12, S), P('smelter', 2, 13, S), P('heap', 1, 13, E), P('heap', 3, 13, W), P('press', 2, 14, E), P('assembler', 3, 14, E),
    ...belts([[4, 14, E], [5, 14, E], [6, 14, E], [7, 14, N], [7, 13, N], [7, 12, N], [7, 11, N], [7, 10, N], [7, 9, N], [7, 8, N], [7, 7, N], [7, 6, N]]),
  ]),
  need('folding'),
  // The Factory floor (DESIGN.md §11, §13 check 9): three products, one module feeding another.
  // Design 0, "Copper wire": C4 (box 12,0 1x3: miner, smelter, press; slag leaves by its heaps,
  // outside the box), put beside the Factory Dock.
  fold(12, 0, 1, 3, 'Copper wire'),
  fplace(0, 9, 1, E),
  // Design 1, "Iron ingots": miners and smelters only (planner, greedy: chunk C's CA pair, box 3,11
  // 2x2; dock-only: L3's, box 1,1 1x2). On the floor it feeds the gear works from behind, and its
  // slag leaves by a side trunk north, along row 0 and down into the Dock (which scraps it): the
  // gear works refuses slag, so without the side trunk the source would block.
  ...not(['dockOnly'], [fold(3, 11, 2, 2, 'Iron ingots')]),
  ...not(['planner', 'greedy'], [fold(1, 1, 1, 2, 'Iron ingots')]),
  fplace(1, 8, 2, E), ...trunks([[8, 1, N], [8, 0, E], [9, 0, E], [10, 0, S]]),
  // the source half is rebuilt (200 coin) so the presses and assembler left behind have ingots
  // for their own audit
  ...not(['dockOnly'], [P('miner', 3, 11, E), P('smelter', 4, 11, E), P('miner', 3, 12, E), P('smelter', 4, 12, E)]),
  ...not(['planner', 'greedy'], [P('miner', 1, 2, N), P('smelter', 1, 1, N)]),
  // Design 2, "Gear works": presses and the assembler, ingots in (planner, greedy: box 5,11 2x2;
  // dock-only: L1's press and assembler, box 4,3 2x1, fed by the Hand Furnace), into the Dock.
  // Ingots -> gear works -> Factory Dock is the chain; copper wire is the third product.
  ...not(['dockOnly'], [fold(5, 11, 2, 2, 'Gear works')]),
  ...not(['planner', 'greedy'], [fold(4, 3, 2, 1, 'Gear works')]),
  fplace(2, 9, 2, E),
  // past the slice end (greedy): more copper wire, into the Dock from above and below, while the
  // copper claims last (3 + 2 for chunk B's deposit, §18)
  ...not(['planner', 'dockOnly'], [
    { k: 'stamp', design: 0, copies: 1 }, fplace(0, 11, 0, S),
    { k: 'stamp', design: 0, copies: 2 }, fplace(0, 10, 3, N),
    { k: 'stamp', design: 0, copies: 3 }, fplace(0, 11, 3, N),
  ]),
];

/** The research nodes a plan waits on, in plan order (a `need`, or what unlocks a build). */
export function planResearch(plan: Step[]): ResearchId[] {
  const out: ResearchId[] = [];
  const add = (r: ResearchId) => {
    for (const q of RESEARCH[r].requires) add(q);
    if (!out.includes(r)) out.push(r);
  };
  for (const s of plan) {
    if (s.k === 'need') add(s.research);
    if (s.k === 'place' || s.k === 'swap') {
      const u = BUILD[s.kind].unlock;
      if (u) add(u);
    }
    if (s.k === 'land') {
      const req = CHUNKS.find((c) => c.id === s.id)?.requires;
      if (req) add(req);
    }
  }
  return out;
}

export interface BotLog {
  /** seconds at which each named milestone happened */
  at: Record<string, number>;
  /** decisions in seconds: purchases, research completions, orders filled (§13 check 10) */
  decisions: number[];
  /** what each decision was, parallel to `decisions` */
  what: string[];
  /** the plan step index reached */
  step: number;
  /** the tick of every map click the bot sent (the click-rate test reads it) */
  clicks: number[];
  /** the tick of every command the bot sent */
  cmds: number[];
}

/** Ticks between two building commands (place, remove, turn, select): 4 a second. */
const HAND_TICKS = TICK_RATE / 4;
/** Ticks between clicks while actively clicking: 4 clicks/s (DESIGN.md §1). */
const CLICK_TICKS = TICK_RATE / 4;
/** A person notices a Spark about this long after it appears. */
const SPARK_NOTICE = 2 * TICK_RATE;
/** The routers are looked at once a second (a person glancing at the floor, not a 20 Hz loop). */
const ROUTE_EVERY = TICK_RATE;

/** Plays a Game. Call `update()` once per tick, before `g.tick()`. */
export class Bot {
  step = 0;
  log: BotLog = { at: {}, decisions: [], what: [], step: 0, clicks: [], cmds: [] };
  readonly plan: Step[];
  /** research the plan waits on, in order */
  readonly wanted: ResearchId[];
  private handFree = 0;
  private clickAt = 0;
  private sparkSeen = new Map<string, number>();
  private seenDone = 0;
  private seenOrders = 0;
  /** orders the plan has reached, accepted when no other order is active */
  private pendingOrders: string[] = [];

  /** `shovel: false`: a player who stops clearing slag jams by hand once the first miner runs (the
   * slag lesson test). */
  constructor(public g: Game, public policy: Policy = 'planner', plan: Step[] = PLAN, public opts: { shovel?: boolean } = {}) {
    this.plan = plan.filter((s) => !s.only || s.only.includes(policy));
    this.wanted = planResearch(this.plan);
  }

  // ---------------------------------------------------------------- hands

  /** Send one command if the hand is free (clicks and building commands keep separate paces); the
   * result, or null if the hand was busy. */
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
    return this.g.act(c).ok;
  }

  private get handReady() {
    return this.g.s.tick >= this.handFree;
  }

  private mark(name: string) {
    if (this.log.at[name] === undefined) this.log.at[name] = this.g.seconds;
  }

  private decide(what: string) {
    this.log.decisions.push(this.g.seconds);
    this.log.what.push(what);
  }

  update() {
    if (this.policy === 'idle') return;
    this.observe();
    this.click();
    if (this.g.s.tick % ROUTE_EVERY === 0) this.route();
    this.research();
    this.orders();
    this.build();
  }

  /** record milestones and decisions the game made happen (research done, orders filled) */
  private observe() {
    const g = this.g;
    if (g.has('bellows')) this.mark('bellows');
    if (g.miners.length) this.mark('miner');
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
    if (g.s.land.includes('B')) this.mark('landB');
    if (g.s.land.includes('C')) this.mark('landC');
    if (g.s.designs.length) this.mark('fold');
    if (g.flag('sliceEnd')) this.mark('sliceEnd');
    if ((g.s.delivered.gizmo?.toNumber() ?? 0) > 0) this.mark('gizmo');
    this.log.step = this.step;
  }

  // ---------------------------------------------------------------- clicking

  /** Sparks after a person would notice them; hand-mining and cranking until the first miner. */
  private click() {
    const g = this.g;
    const t = g.s.tick;
    // a Spark is new to the eye when it was not on the map last tick (forget the ones that left)
    const now = new Set(g.s.sparks.map((p) => `${p.kind}${p.x},${p.y}`));
    for (const k of [...this.sparkSeen.keys()]) if (!now.has(k)) this.sparkSeen.delete(k);
    for (const k of now) if (!this.sparkSeen.has(k)) this.sparkSeen.set(k, t);
    if (t < this.clickAt) return;
    for (const p of g.s.sparks) {
      const seen = this.sparkSeen.get(`${p.kind}${p.x},${p.y}`)!;
      if (t - seen >= SPARK_NOTICE) {
        this.act({ k: 'click', x: p.x, y: p.y });
        return;
      }
    }
    const f = g.machines.find((m) => m.kind === 'furnace');
    if (!f) return;
    let at: { x: number; y: number } | null = null;
    // shovel a machine choked on slag (only until its heap is built)
    const choked = this.opts.shovel === false && g.miners.length ? undefined : g.machines.find((m) => m.by >= RULES.outputCap.value && m.state === 'blocked');
    if (choked) at = choked;
    else if (!g.miners.length) {
      if (!g.has('bellows')) {
        // keep ore loaded, crank while a craft is under way
        at = f.active ? f : { x: 2, y: 3 };
      } else if ((f.inBuf.ironOre ?? 0) < 2) at = { x: 2, y: 3 };
    }
    if (!at) return;
    this.act({ k: 'click', x: at.x, y: at.y });
  }

  // ---------------------------------------------------------------- research

  /** Outstanding Hopper deliveries of `item` the given nodes still need (minus what is banked). */
  needOf(item: ItemId, nodes: ResearchId[]): number {
    const r = this.g.s.research;
    let n = 0;
    for (const id of nodes) {
      if (this.g.done(id)) continue;
      const want = RESEARCH[id].cost[item];
      if (!want) continue;
      n += Math.max(0, want - (r.progress[id]?.[item]?.toNumber() ?? 0));
    }
    return n - (r.bank[item]?.toNumber() ?? 0);
  }

  /** The node the plan is blocked on right now (dockOnly feeds only this), or null. */
  blocking(): ResearchId | null {
    const s = this.plan[this.step];
    if (!s) return null;
    let r: ResearchId | null = null;
    if (s.k === 'need' && !this.g.done(s.research)) r = s.research;
    if ((s.k === 'place' || s.k === 'swap') && BUILD[s.kind].unlock && !this.g.done(BUILD[s.kind].unlock!)) r = BUILD[s.kind].unlock;
    if (s.k === 'land') {
      const req = CHUNKS.find((c) => c.id === s.id)?.requires ?? null;
      if (req && !this.g.done(req)) r = req;
    }
    // the first requirement that can be researched now
    const open = (id: ResearchId): ResearchId | null => {
      if (this.g.done(id)) return null;
      if (available(this.g, id)) return id;
      for (const q of RESEARCH[id].requires) {
        const o = open(q);
        if (o) return o;
      }
      return null;
    };
    return r ? open(r) : null;
  }

  /** The nodes whose costs a line should feed now. */
  private feeding(): ResearchId[] {
    if (this.policy === 'dockOnly') {
      const b = this.blocking();
      return b ? [b] : [];
    }
    return this.wanted;
  }

  private research() {
    const g = this.g;
    const r = g.s.research;
    if (!this.handReady) return;
    const open = this.wanted.filter((id) => available(g, id));
    // a node already paid for by the bank: select it and it completes (greedy: any node at all,
    // e.g. Slag Bricks or Buffers from what is left over in the bank)
    const pool = this.policy === 'greedy' ? RESEARCH_IDS.filter((id) => available(g, id)) : open;
    const covered = pool.find((id) => Object.entries(RESEARCH[id].cost).every(([it, n]) => (r.progress[id]?.[it as ItemId]?.toNumber() ?? 0) + (r.bank[it as ItemId]?.toNumber() ?? 0) >= (n as number)));
    if (!open.length && !covered) return;
    let pick: ResearchId | null = covered ?? null;
    if (!pick) {
      if (this.policy === 'dockOnly') pick = this.blocking();
      else pick = open[0];
    }
    if (pick && r.selected !== pick) this.act({ k: 'research', id: pick });
  }

  // ---------------------------------------------------------------- orders

  private orders() {
    const g = this.g;
    if (!this.handReady || g.s.orders.active) return;
    const offered = offeredOrders(g);
    const id = this.policy === 'greedy' ? offered[0]?.id : this.pendingOrders.find((p) => offered.some((q) => q.id === p));
    if (id) this.act({ k: 'order', id });
  }

  // ---------------------------------------------------------------- building

  /** Work through the plan: the next step (greedy: any of the next few) when the hand is free. */
  private build() {
    if (!this.handReady) return;
    // steps already true (or free bookkeeping) are passed at once
    for (let guard = 0; guard < 50 && this.step < this.plan.length; guard++) {
      const s = this.plan[this.step];
      if (!this.isDone(s)) break;
      this.step++;
    }
    if (this.step >= this.plan.length || !this.handReady) return;
    const look = this.policy === 'greedy' ? 12 : 1;
    for (let i = this.step; i < Math.min(this.plan.length, this.step + look); i++) {
      const s = this.plan[i];
      if (this.isDone(s)) continue;
      if (this.tryStep(s)) return;
      if (!this.handReady) return;
      // greedy never sits waiting on a build unlock or land: it skips ahead over steps that are
      // locked (not over steps it merely cannot afford yet), never past a research wait (what
      // follows one depends on it: smelters before Copper Smelting would jam on copper ore)
      if (s.k === 'need' || !this.locked(s)) return;
    }
  }

  /** Is a step locked behind research or land the bot does not have yet? */
  private locked(s: Step): boolean {
    const g = this.g;
    if (s.k === 'need') return !g.done(s.research);
    if (s.k === 'land') {
      const req = CHUNKS.find((c) => c.id === s.id)?.requires;
      return !!req && !g.done(req);
    }
    if (s.k === 'place' || s.k === 'swap') {
      if (!g.unlocked(s.kind)) return true;
      const d = BUILD[s.kind];
      for (let y = s.y; y < s.y + d.h; y++) for (let x = s.x; x < s.x + d.w; x++) if (!g.owned(x, y)) return true;
    }
    return false;
  }

  private isDone(s: Step): boolean {
    const g = this.g;
    switch (s.k) {
      case 'upgrade': return g.has(s.id);
      case 'land': return g.s.land.includes(s.id);
      case 'need': return g.done(s.research);
      case 'order':
        // reaching an order step queues it: it is accepted as soon as no other order is active
        if (!this.pendingOrders.includes(s.id)) this.pendingOrders.push(s.id);
        return true;
      case 'place': {
        const e = g.entAt(s.x, s.y);
        return !!e && e.kind === s.kind && (e.rot === s.rot || s.kind === 'belt' || isMachine(e.kind));
      }
      case 'swap': {
        const e = g.entAt(s.x, s.y);
        return !!e && e.kind === s.kind;
      }
      case 'fold':
        return g.s.designs.some((d) => d.box.x === s.x && d.box.y === s.y && d.box.w === s.w && d.box.h === s.h);
      case 'stamp': {
        const d = g.s.designs[s.design];
        return !!d && d.stamped >= s.copies;
      }
      case 'fplace': {
        const e = g.fentAt(s.x, s.y);
        return !!e && e.kind === 'module';
      }
      case 'ftrunk': {
        const e = g.fentAt(s.x, s.y);
        return !!e && e.kind === 'trunk' && e.rot === s.rot;
      }
    }
  }

  /** Try a step now; true if a command was sent for it. */
  private tryStep(s: Step): boolean {
    const g = this.g;
    switch (s.k) {
      case 'upgrade':
        if (g.s.coin.lt(UPGRADES[s.id].cost)) return false;
        return this.buy({ k: 'upgrade', id: s.id }, 'upgrade:' + s.id);
      case 'land': {
        const ch = CHUNKS.find((c) => c.id === s.id)!;
        if (g.s.coin.lt(ch.cost) || (ch.requires && !g.done(ch.requires))) return false;
        return this.buy({ k: 'land', id: s.id }, 'land:' + s.id);
      }
      case 'order':
      case 'need':
        return false;
      case 'fold': {
        const a = g.s.audit;
        if (!a) {
          if (foldRefusal(g, s)) return false;
          return this.buy({ k: 'audit', x: s.x, y: s.y, w: s.w, h: s.h }, 'audit');
        }
        // the grade is in: fold (a different box being audited would be cancelled first)
        if (a.box.x !== s.x || a.box.y !== s.y || a.box.w !== s.w || a.box.h !== s.h) return this.act({ k: 'auditCancel' }) !== null;
        if (!a.result) return false;
        if (!this.log.at['grade']) this.log.at['grade'] = a.result.grade.score;
        return this.buy({ k: 'fold', name: s.name }, 'fold:' + a.result.grade.letter);
      }
      case 'stamp': {
        const d = g.s.designs[s.design];
        if (!d || g.s.coin.lt(stampCost(g, d))) return false;
        return this.buy({ k: 'stamp', id: d.id }, 'stamp');
      }
      case 'fplace': {
        const d = g.s.designs[s.design];
        if (!d || d.spare < 1 || g.fentAt(s.x, s.y)) return false;
        return this.buy({ k: 'fplace', design: d.id, x: s.x, y: s.y, rot: s.rot }, 'module');
      }
      case 'ftrunk':
        if (!g.flag('factoryOpen') || g.s.coin.lt(FACTORY.trunkCost)) return false;
        return this.buy({ k: 'ftrunk', x: s.x, y: s.y, rot: s.rot }, 'trunk');
      case 'place': {
        const e = g.entAt(s.x, s.y);
        if (s.kind === 'belt' && e?.kind === 'belt') return this.act({ k: 'place', kind: 'belt', x: s.x, y: s.y, rot: s.rot }) !== null;
        if (g.canPlace(s.kind, s.x, s.y)) return false;
        return this.buy({ k: 'place', kind: s.kind, x: s.x, y: s.y, rot: s.rot }, s.kind);
      }
      case 'swap': {
        const e = g.entAt(s.x, s.y);
        if (!g.unlocked(s.kind)) return false;
        if (e && (e.kind === 'dock' || e.kind === 'hopper' || e.kind === 'furnace')) return false;
        const refund = e ? BUILD[e.kind].cost : 0;
        if (g.s.coin.add(refund).lt(BUILD[s.kind].cost)) return false;
        if (e) {
          // remove first (one command), place on a later tick (the next command)
          return this.act({ k: 'remove', x: s.x, y: s.y }) !== null;
        }
        if (g.canPlace(s.kind, s.x, s.y)) return false;
        return this.buy({ k: 'place', kind: s.kind, x: s.x, y: s.y, rot: s.rot }, s.kind);
      }
    }
  }

  private buy(c: Cmd, what: string): boolean {
    const r = this.act(c);
    if (r === null) return false;
    if (r) this.decide(what);
    return true;
  }

  // ---------------------------------------------------------------- routing

  /** The item a run of machines and belts carries out at its end: the output of the nearest machine
   * upstream with a recipe (tiles listed from the end back to the source). */
  private carries(tiles: [number, number][]): ItemId | null {
    for (const [x, y] of tiles) {
      const e = this.g.entAt(x, y);
      if (e && isMachine(e.kind) && e.recipe) return RECIPE[e.recipe].outputs[0].item;
    }
    return null;
  }

  private wants(item: ItemId | null): boolean {
    if (!item) return false;
    // a few in flight on the belts are not counted: stop a little early rather than overshoot
    return this.needOf(item, this.feeding()) > 0;
  }

  /** Point a belt; a command only if it needs turning. */
  private turn(x: number, y: number, rot: Dir) {
    const b = this.g.entAt(x, y);
    if (!b || b.kind !== 'belt' || b.rot === rot) return;
    this.act({ k: 'place', kind: 'belt', x, y, rot });
  }

  private ga(): Ent | null {
    const e = this.g.entAt(7, 3);
    return e && e.kind === 'assembler' ? e : null;
  }

  private route() {
    const g = this.g;
    const ga = this.ga();
    // the Gizmo assembler: south into the Hopper while research wants Gizmos, else north to the Dock
    if (ga) {
      const want: Dir = this.wants('gizmo') ? S : N;
      if (ga.rot !== want) {
        // rotate through the sides (both are belts pointing at it, so nothing leaks meanwhile)
        this.act({ k: 'rotate', x: 7, y: 3 });
        return;
      }
    }
    // L2 at (5,2): plates east to the Dock, or south into L1's gear assembler while research wants gears
    const l2 = this.carries([[4, 2], [3, 2]]);
    const g1 = g.entAt(5, 3);
    if (g.entAt(5, 2)?.kind === 'belt') this.turn(5, 2, l2 === 'ironPlate' && g1?.kind === 'assembler' && this.wants('gear') ? S : E);
    // L1 at (6,3): research first (Gizmos, then gears), then Gizmos for coin, else the Dock
    const l1 = this.carries([[5, 3], [4, 3], [3, 3]]);
    let r1: Dir = N;
    if (!g.miners.length) r1 = N; // hand-made ingots pay for the first miner
    else if (ga && l1 === 'gear' && this.wants('gizmo')) r1 = E;
    else if (this.wants(l1)) r1 = S;
    else if (ga && l1 === 'gear') r1 = E;
    this.turn(6, 3, r1);
    // C1 at (8,3), C2 at (8,2): research, else wire into G while it gets gears, else the Dock
    const c1 = this.carries([[9, 3], [10, 3], [11, 3]]);
    const c2 = this.carries([[9, 2], [10, 2], [11, 2]]);
    if (g.entAt(8, 3)?.kind === 'belt') {
      if (this.wants(c1)) {
        this.turn(8, 3, S);
        this.turn(8, 2, this.wants(c2) ? S : W);
      } else if (ga && c1 === 'copperWire' && r1 === E) {
        this.turn(8, 3, W);
        this.turn(8, 2, W);
      } else {
        // both to the Dock: C1 up through (8,2), which must point west first
        this.turn(8, 2, W);
        this.turn(8, 3, N);
      }
    }
  }
}

/** Run a bot for `seconds` of game time (or until `stop` says so, checked once a second). */
export function runBot(g: Game, policy: Policy, seconds: number, stop?: (g: Game, b: Bot) => boolean): Bot {
  const b = new Bot(g, policy);
  const end = g.s.tick + seconds * TICK_RATE;
  while (g.s.tick < end) {
    b.update();
    g.tick();
    if (stop && g.s.tick % TICK_RATE === 0 && stop(g, b)) break;
  }
  return b;
}
