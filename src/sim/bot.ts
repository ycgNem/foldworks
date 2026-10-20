// Bots: scripted players for the pace tests (DESIGN.md §13) and `npm run bot`. Pure: they read the
// Game and queue commands, never touch it directly, and click no faster than a person (4 clicks/s
// while actively clicking, under the 12/s cap).
//
// planner : the competent player. Follows a build plan for the slice map, buys each step as soon
//           as it is affordable, routes a line to the Hopper whenever a research node is open.
// greedy  : the same plan; kept as a name because §13 check 10 measures dead air with it (in the
//           slice the planner already buys the next affordable step at once, DECISIONS.md).
// dockOnly: sends everything to the Dock; feeds the Hopper only when the next step is locked
//           behind research and nothing else in the plan is affordable.
import type { Game, Cmd } from './Game';
import type { Dir } from './world';
import type { BuildKind, UpgradeId } from '../data/machines';
import type { ResearchId } from '../data/research';
import { RESEARCH } from '../data/research';
import { BUILD } from '../data/machines';
import { RULES } from '../data/rules';
import { TICK_RATE } from '../engine/time';
import { available } from './systems/research';

export type Policy = 'planner' | 'greedy' | 'dockOnly' | 'idle';

type Step =
  | { k: 'place'; kind: BuildKind; x: number; y: number; rot: Dir }
  | { k: 'swap'; kind: BuildKind; x: number; y: number; rot: Dir }
  | { k: 'upgrade'; id: UpgradeId }
  | { k: 'land'; id: string }
  | { k: 'order'; id: string }
  | { k: 'need'; research: ResearchId };

const P = (kind: BuildKind, x: number, y: number, rot: Dir): Step => ({ k: 'place', kind, x, y, rot });
const S = (kind: BuildKind, x: number, y: number, rot: Dir): Step => ({ k: 'swap', kind, x, y, rot });
const belts = (pts: [number, number, Dir][]): Step[] => pts.map(([x, y, r]) => P('belt', x, y, r));

/**
 * The slice plan. Chunk A: four miners on the iron patch feed the Hand Furnace and three smelters;
 * presses go inline once Pressing is done; the south line feeds the Hopper. Chunk B: copper ore,
 * then ingots, then wire into the Hopper's east side; gear and Gizmo assemblers come last.
 */
export const PLAN: Step[] = [
  { k: 'upgrade', id: 'bellows' },
  P('miner', 2, 3, 0),
  P('heap', 3, 4, 0),
  // line 2: miner -> smelter -> belts -> Dock
  P('miner', 2, 2, 0), P('smelter', 3, 2, 0), ...belts([[4, 2, 0], [5, 2, 0]]), P('heap', 3, 1, 0),
  { k: 'need', research: 'pressing' },
  S('press', 4, 3, 0),
  S('press', 4, 2, 0),
  // line 4 (south): the research line into the Hopper
  P('miner', 1, 3, 1), P('smelter', 1, 4, 1), P('heap', 0, 4, 0), ...belts([[1, 5, 0], [2, 5, 0], [3, 5, 0], [4, 5, 0], [5, 5, 0]]),
  S('press', 2, 5, 0),
  // line 3 (north): miner -> smelter -> along row 0 -> Dock from above
  P('miner', 1, 2, 3), P('smelter', 1, 1, 3), P('heap', 0, 1, 0), ...belts([[1, 0, 0], [2, 0, 0], [3, 0, 0], [4, 0, 0], [5, 0, 0], [6, 0, 1]]),
  S('press', 3, 0, 0),
  { k: 'order', id: 'boardwalk' },
  { k: 'need', research: 'surveyEast' },
  { k: 'land', id: 'B' },
  // chunk B: copper ore into the Hopper from the east
  P('miner', 11, 3, 1), ...belts([[11, 4, 2], [10, 4, 2], [9, 4, 2], [8, 4, 2]]),
  { k: 'need', research: 'copperSmelting' },
  S('smelter', 10, 4, 2), P('heap', 10, 5, 0),
  P('miner', 12, 3, 2),
  { k: 'need', research: 'wireDrawing' },
  S('press', 9, 4, 2),
  // gears on the south line: plates -> assembler -> Hopper
  { k: 'need', research: 'gearcutting' },
  S('assembler', 4, 5, 0),
  // a second copper line for wire: miner (12,2) N -> smelter (12,1) W -> press (11,1) W -> belts to the Dock's east side
  P('miner', 12, 2, 3), P('smelter', 12, 1, 2), P('heap', 13, 1, 0), P('press', 11, 1, 2), ...belts([[10, 1, 2], [9, 1, 2], [8, 1, 2]]),
  P('miner', 11, 2, 3), P('smelter', 11, 1, 2),
  { k: 'order', id: 'lampPosts' },
  { k: 'need', research: 'gizmoTheory' },
  { k: 'order', id: 'gizmoFestival' },
  { k: 'need', research: 'folding' },
];

export interface BotLog {
  /** seconds at which each named milestone happened */
  at: Record<string, number>;
  /** decisions: purchases and research completions, in seconds */
  decisions: number[];
  /** the plan step index reached */
  step: number;
}

/** Plays a Game. Call `update()` once per tick, before `g.tick()`. */
export class Bot {
  step = 0;
  log: BotLog = { at: {}, decisions: [], step: 0 };
  private clickAt = 0;
  /** ticks between clicks while actively clicking: 4 clicks/s (DESIGN.md §1) */
  private clickGap = TICK_RATE / 4;
  private sparkSeen = new Map<string, number>();
  /** which belt tile routes the furnace line, and its two settings */
  private routeTile = { x: 6, y: 3 };

  constructor(public g: Game, public policy: Policy = 'planner', public plan: Step[] = PLAN) {}

  private q(c: Cmd) {
    this.g.act(c);
  }

  private mark(name: string) {
    if (this.log.at[name] === undefined) this.log.at[name] = this.g.seconds;
  }

  update() {
    const g = this.g;
    if (this.policy === 'idle') return;
    const t = g.s.tick;
    this.observe();
    // clicking: until the first miner, hand-mine and crank at 4 clicks/s
    const clicking = g.miners.length === 0;
    if (t >= this.clickAt) {
      const did = this.click(clicking);
      if (did) this.clickAt = t + this.clickGap;
    }
    this.research();
    this.build();
    this.route();
  }

  /** record milestones for the pace tests */
  private observe() {
    const g = this.g;
    if (g.has('bellows')) this.mark('bellows');
    if (g.miners.length) this.mark('miner');
    for (const r of g.s.research.done) this.mark('research:' + r);
    if (g.s.land.includes('B')) this.mark('landB');
    if ((g.s.delivered.gizmo?.toNumber() ?? 0) > 0) this.mark('gizmo');
    for (const o of g.s.orders.done) this.mark('order:' + o);
    this.log.step = this.step;
  }

  /** one click if there is something worth clicking; true if it clicked */
  private click(handWork: boolean): boolean {
    const g = this.g;
    // a Spark: a person notices it after a couple of seconds
    for (const p of g.s.sparks) {
      const key = `${p.kind}${p.x},${p.y}`;
      const seen = this.sparkSeen.get(key) ?? g.s.tick;
      this.sparkSeen.set(key, seen);
      if (g.s.tick - seen >= 2 * TICK_RATE) {
        this.q({ k: 'click', x: p.x, y: p.y });
        return true;
      }
    }
    const f = g.machines.find((m) => m.kind === 'furnace');
    if (!f) return false;
    // shovel a choked furnace (the heap comes soon after)
    if (f.by >= RULES.outputCap.value) {
      this.q({ k: 'click', x: f.x, y: f.y });
      return true;
    }
    if (!handWork && g.has('bellows')) return false;
    if (!g.has('bellows')) {
      // keep one ore loaded, crank otherwise
      if (!f.active && !(f.inBuf.ironOre ?? 0)) this.q({ k: 'click', x: 2, y: 3 });
      else if (f.active) this.q({ k: 'click', x: f.x, y: f.y });
      else this.q({ k: 'click', x: 2, y: 3 });
      return true;
    }
    // after the Bellows, before the first miner: keep the furnace fed
    if ((f.inBuf.ironOre ?? 0) < 2) {
      this.q({ k: 'click', x: 2, y: 3 });
      return true;
    }
    return false;
  }

  /** pick research whenever a node is open (the planner), or only when stuck (dockOnly) */
  private research() {
    const g = this.g;
    const r = g.s.research;
    if (r.selected) return;
    const want = this.nextNeed();
    if (want && available(g, want)) {
      if (this.policy === 'dockOnly' && !this.stuck()) return;
      this.q({ k: 'research', id: want });
    }
  }

  /** the next research the plan waits on */
  private nextNeed(): ResearchId | null {
    for (let i = this.step; i < this.plan.length; i++) {
      const s = this.plan[i];
      if (s.k === 'need' && !this.g.done(s.research)) return s.research;
      const kind = s.k === 'place' || s.k === 'swap' ? s.kind : null;
      if (kind && BUILD[kind].unlock && !this.g.done(BUILD[kind].unlock!)) return BUILD[kind].unlock!;
    }
    return null;
  }

  /** dockOnly: is the plan blocked on research with nothing to buy? */
  private stuck(): boolean {
    const s = this.plan[this.step];
    if (!s) return true;
    if (s.k === 'need') return true;
    const kind = s.k === 'place' || s.k === 'swap' ? s.kind : null;
    return !!kind && !!BUILD[kind].unlock && !this.g.done(BUILD[kind].unlock!);
  }

  /** work through the plan: every step that can be done this tick */
  private build() {
    const g = this.g;
    for (let guard = 0; guard < 20 && this.step < this.plan.length; guard++) {
      const s = this.plan[this.step];
      const ok = this.tryStep(s);
      if (!ok) return;
      this.step++;
      if (s.k !== 'need') this.log.decisions.push(g.seconds);
    }
  }

  private tryStep(s: Step): boolean {
    const g = this.g;
    switch (s.k) {
      case 'upgrade':
        if (g.has(s.id)) return true;
        if (g.s.coin.lt(25)) return false;
        this.q({ k: 'upgrade', id: s.id });
        return true;
      case 'land': {
        if (g.s.land.includes(s.id)) return true;
        const ok = g.s.coin.gte(1000) && g.act({ k: 'land', id: s.id }).ok;
        return ok;
      }
      case 'order':
        if (g.s.orders.active || g.s.orders.done.includes(s.id)) return g.s.orders.done.includes(s.id) || g.s.orders.active === s.id || !!g.s.orders.active;
        return g.act({ k: 'order', id: s.id }).ok;
      case 'need':
        return g.done(s.research);
      case 'place': {
        const e = g.entAt(s.x, s.y);
        if (e && e.kind === s.kind && e.rot === s.rot) return true;
        if (s.kind === 'belt' && e?.kind === 'belt') return g.act({ k: 'place', kind: 'belt', x: s.x, y: s.y, rot: s.rot }).ok;
        if (g.canPlace(s.kind, s.x, s.y)) return false;
        return g.act({ k: 'place', kind: s.kind, x: s.x, y: s.y, rot: s.rot }).ok;
      }
      case 'swap': {
        const e = g.entAt(s.x, s.y);
        if (e && e.kind === s.kind) return true;
        if (!g.unlocked(s.kind)) return false;
        const refund = e ? BUILD[e.kind].cost : 0;
        if (g.s.coin.add(refund).lt(BUILD[s.kind].cost)) return false;
        if (e) g.act({ k: 'remove', x: s.x, y: s.y });
        return g.act({ k: 'place', kind: s.kind, x: s.x, y: s.y, rot: s.rot }).ok;
      }
    }
  }

  /** the routing decision: the furnace line's last belt points at the Dock (N) or the Hopper (S) */
  private route() {
    const g = this.g;
    const b = g.entAt(this.routeTile.x, this.routeTile.y);
    if (!b || b.kind !== 'belt') return;
    const sel = g.s.research.selected;
    let toHopper = false;
    if (sel) {
      const cost = RESEARCH[sel].cost;
      // only route what the node wants: the furnace line carries iron ingots, then plates
      const carries = g.done('pressing') ? 'ironPlate' : 'ironIngot';
      // the furnace line feeds the Hopper only while the plan waits on research it can pay
      toHopper = carries in cost && this.stuck();
    }
    const want: Dir = toHopper ? 1 : 3;
    if (b.rot !== want) g.act({ k: 'place', kind: 'belt', x: b.x, y: b.y, rot: want });
  }
}

/** Run a bot for `seconds` of game time (or until `stop` says so). */
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
