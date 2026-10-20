// The game: state, the command log, and the fixed system order (CLAUDE.md):
// input commands -> miners -> belts -> machines -> modules -> docks and hoppers -> orders ->
// research -> sparks -> audits -> stats.
// Pure (tests/purity.test.ts): time comes in as ticks; presentation effects go out as events on
// `events`, drained by the renderer and audio.
import { EventQueue, type GameEvent } from '../engine/events';
import { Num } from '../engine/num';
import { TICK_RATE } from '../engine/time';
import { BUILD, UPGRADES, isMachine, type BuildKind, type EntKind, type UpgradeId } from '../data/machines';
import { CHUNKS, PATCHES, START_LAYOUT, WORKSHOP } from '../data/land';
import { RESEARCH, type ResearchId } from '../data/research';
import { ORDER } from '../data/orders';
import { RECIPE } from '../data/recipes';
import type { ItemId } from '../data/items';
import { RULES } from '../data/rules';
import { DX, DY, newEnt, newState, opposite, type Dir, type Ent, type State } from './world';
import { runMiners } from './systems/miners';
import { runBelts } from './systems/belts';
import { runMachines, crankFurnace, shovel } from './systems/machines';
import { runModules } from './systems/modules';
import { runDocks } from './systems/docks';
import { runOrders } from './systems/orders';
import { runResearch, selectResearch } from './systems/research';
import { runSparks, catchSpark } from './systems/sparks';
import { runAudits } from './systems/audits';
import { runStats } from './systems/stats';

export interface Intake {
  to: 'dock' | 'hopper';
  item: ItemId;
  /** where, for the coin pop */
  x: number;
  y: number;
}

/** Everything a player (or a bot) can do. Each is validated and logged with the tick it applied at. */
export type Cmd =
  | { k: 'place'; kind: BuildKind; x: number; y: number; rot: Dir }
  | { k: 'remove'; x: number; y: number }
  | { k: 'rotate'; x: number; y: number }
  | { k: 'click'; x: number; y: number }
  | { k: 'upgrade'; id: UpgradeId }
  | { k: 'land'; id: string }
  | { k: 'research'; id: ResearchId | null }
  | { k: 'order'; id: string | null }
  | { k: 'recipe'; x: number; y: number; recipe: string | null }
  | { k: 'visible'; v: boolean };

export interface Logged { t: number; c: Cmd }

export interface ActResult { ok: boolean; why?: string }

const OK: ActResult = { ok: true };
const no = (why: string): ActResult => ({ ok: false, why });

export class Game {
  s: State;
  events = new EventQueue();
  /** commands since the last snapshot (what a save carries besides the snapshot) */
  log: Logged[] = [];
  /** every command since tick 0, when kept (determinism tests and bots) */
  history: Logged[] | null = null;
  /** commands queued to apply at the start of the next tick (bots, replays) */
  pending: Cmd[] = [];
  /** items handed to a Dock or Hopper this tick, paid out by the docks system */
  intake: Intake[] = [];

  readonly W = WORKSHOP.w;
  readonly H = WORKSHOP.h;
  /** entity id per tile (0 = empty), rebuilt from s.ents */
  grid = new Int32Array(WORKSHOP.w * WORKSHOP.h);
  /** ore item per tile, and which patch it belongs to (-1 = none) */
  ore: (ItemId | null)[] = new Array(WORKSHOP.w * WORKSHOP.h).fill(null);
  patchOf = new Int16Array(WORKSHOP.w * WORKSHOP.h).fill(-1);
  byId = new Map<number, Ent>();
  /** belts, downstream first, so a full belt moves as one */
  belts: Ent[] = [];
  /** miners and crafting machines (furnace included), in id order */
  miners: Ent[] = [];
  machines: Ent[] = [];
  /** splitters, mergers and crates (heaps only take) */
  logistics: Ent[] = [];
  /** the layout changed: caches are rebuilt before the next tick */
  layoutDirty = true;
  /** layout version, bumped on every change (the renderer re-bakes what depends on it) */
  version = 0;
  /** called for every transfer between tiles (the fold audit counts port crossings with it) */
  watchers: ((x: number, y: number, dir: Dir, item: string) => void)[] = [];

  constructor(seed: number, opts: { keepHistory?: boolean; empty?: boolean } = {}) {
    this.s = newState(seed);
    if (opts.keepHistory) this.history = [];
    for (let i = 0; i < PATCHES.length; i++) {
      const p = PATCHES[i];
      for (let y = p.y; y < p.y + p.h; y++)
        for (let x = p.x; x < p.x + p.w; x++) {
          this.ore[y * this.W + x] = p.item;
          this.patchOf[y * this.W + x] = i;
        }
    }
    if (!opts.empty) {
      for (const b of START_LAYOUT) this.addEnt(b.kind, b.x, b.y, b.rot);
      this.s.nextSpark = this.sparkDelay();
    }
    this.rebuild();
  }

  // ------------------------------------------------------------------ queries

  inb(x: number, y: number) {
    return x >= 0 && y >= 0 && x < this.W && y < this.H;
  }

  entAt(x: number, y: number): Ent | null {
    if (!this.inb(x, y)) return null;
    const id = this.grid[y * this.W + x];
    return id ? this.byId.get(id) ?? null : null;
  }

  oreAt(x: number, y: number): ItemId | null {
    return this.inb(x, y) ? this.ore[y * this.W + x] : null;
  }

  chunkAt(x: number, y: number) {
    return CHUNKS.find((c) => x >= c.x && y >= c.y && x < c.x + c.w && y < c.y + c.h) ?? null;
  }

  owned(x: number, y: number) {
    const c = this.chunkAt(x, y);
    return !!c && this.s.land.includes(c.id);
  }

  has(upgrade: string) {
    return this.s.upgrades.includes(upgrade);
  }

  done(r: ResearchId) {
    return this.s.research.done.includes(r);
  }

  unlocked(kind: EntKind) {
    const u = BUILD[kind].unlock;
    return u === null || this.done(u);
  }

  flag(f: string) {
    return this.s.flags.includes(f);
  }

  /** Set a one-time flag; true the first time. */
  first(f: string) {
    if (this.s.flags.includes(f)) return false;
    this.s.flags.push(f);
    return true;
  }

  emit(e: Omit<GameEvent, 'tick'>) {
    this.events.push({ ...e, tick: this.s.tick } as GameEvent);
  }

  /** seconds since the run started */
  get seconds() {
    return this.s.tick / TICK_RATE;
  }

  // ------------------------------------------------------------------ layout

  private addEnt(kind: EntKind, x: number, y: number, rot: Dir): Ent {
    const d = BUILD[kind];
    const e = newEnt(this.s.nextId++, kind, x, y, d.w, d.h, rot);
    if (kind === 'miner') {
      const o = this.oreAt(x, y);
      e.recipe = o === 'copperOre' ? 'mineCopper' : 'mineIron';
    }
    if (kind === 'furnace') e.recipe = 'smeltIron';
    this.s.ents.push(e);
    this.layoutDirty = true;
    return e;
  }

  /** Rebuild the caches from s.ents (after a load or a layout change). */
  rebuild() {
    this.grid.fill(0);
    this.byId.clear();
    this.miners = [];
    this.machines = [];
    this.logistics = [];
    const belts: Ent[] = [];
    for (const e of this.s.ents) {
      this.byId.set(e.id, e);
      for (let y = e.y; y < e.y + e.h; y++) for (let x = e.x; x < e.x + e.w; x++) this.grid[y * this.W + x] = e.id;
      if (e.kind === 'belt') belts.push(e);
      else if (e.kind === 'miner') this.miners.push(e);
      else if (isMachine(e.kind)) this.machines.push(e);
      else if (e.kind === 'splitter' || e.kind === 'merger' || e.kind === 'crate' || e.kind === 'heap') this.logistics.push(e);
    }
    this.belts = this.orderBelts(belts);
    this.layoutDirty = false;
    this.version++;
  }

  /** Downstream first: a depth-first post-order along each belt's "next" tile (cycles broken). */
  private orderBelts(belts: Ent[]): Ent[] {
    const out: Ent[] = [];
    const state = new Map<number, number>(); // 1 visiting, 2 done
    const visit = (b: Ent) => {
      const st = state.get(b.id);
      if (st) return;
      state.set(b.id, 1);
      const n = this.entAt(b.x + DX[b.rot], b.y + DY[b.rot]);
      if (n && n.kind === 'belt') visit(n);
      state.set(b.id, 2);
      out.push(b);
    };
    for (const b of belts) visit(b);
    return out;
  }

  // ------------------------------------------------------------------ commands

  /** Validate and apply a command now; it is logged with the current tick. */
  act(c: Cmd): ActResult {
    const r = this.apply(c);
    if (this.layoutDirty) this.rebuild();
    if (r.ok) {
      const l = { t: this.s.tick, c };
      this.log.push(l);
      this.history?.push(l);
    }
    return r;
  }

  /** Queue a command for the start of the next tick (the bots use this). */
  queue(c: Cmd) {
    this.pending.push(c);
  }

  private apply(c: Cmd): ActResult {
    switch (c.k) {
      case 'place': return this.place(c.kind, c.x, c.y, c.rot);
      case 'remove': return this.remove(c.x, c.y);
      case 'rotate': return this.rotate(c.x, c.y);
      case 'click': return this.click(c.x, c.y);
      case 'upgrade': return this.upgrade(c.id);
      case 'land': return this.buyLand(c.id);
      case 'research': return selectResearch(this, c.id);
      case 'order': return this.setOrder(c.id);
      case 'recipe': return this.setRecipe(c.x, c.y, c.recipe);
      case 'visible': this.s.visible = c.v; return OK;
    }
  }

  /** Why a build here would be refused, or null if it can go. */
  canPlace(kind: BuildKind, x: number, y: number): string | null {
    const d = BUILD[kind];
    if (!this.unlocked(kind)) return `${d.name} needs research: ${RESEARCH[d.unlock!].name}`;
    for (let yy = y; yy < y + d.h; yy++)
      for (let xx = x; xx < x + d.w; xx++) {
        if (!this.inb(xx, yy)) return 'off the map';
        if (!this.owned(xx, yy)) {
          const ch = this.chunkAt(xx, yy)!;
          return ch.requires && !this.done(ch.requires) ? `Land not yet surveyed (research ${RESEARCH[ch.requires].name})` : `Buy this chunk: ${Num.of(ch.cost).format()} coin`;
        }
        const e = this.entAt(xx, yy);
        if (e && !(kind === 'belt' && e.kind === 'belt')) return `${BUILD[e.kind].name} is in the way`;
      }
    if (kind === 'miner' && !this.oreAt(x, y)) return 'A Miner goes on an ore patch';
    const free = kind === 'crate' && this.s.freeCrates > 0;
    if (!free && this.s.coin.lt(d.cost)) return `Needs ${d.cost} coin`;
    return null;
  }

  private place(kind: BuildKind, x: number, y: number, rot: Dir): ActResult {
    const existing = this.entAt(x, y);
    if (kind === 'belt' && existing?.kind === 'belt') {
      if (existing.rot === rot) return no('already a belt facing that way');
      existing.rot = rot;
      this.layoutDirty = true;
      this.emit({ type: 'rotate', x, y });
      return OK;
    }
    const why = this.canPlace(kind, x, y);
    if (why) return no(why);
    const d = BUILD[kind];
    if (kind === 'crate' && this.s.freeCrates > 0) this.s.freeCrates--;
    else this.s.coin = this.s.coin.sub(d.cost);
    this.addEnt(kind, x, y, rot);
    this.emit({ type: 'place', x, y, id: kind });
    return OK;
  }

  private remove(x: number, y: number): ActResult {
    const e = this.entAt(x, y);
    if (!e) return no('nothing here');
    if (e.kind === 'dock' || e.kind === 'hopper' || e.kind === 'furnace') return no(`The ${BUILD[e.kind].name} stays`);
    // full refund in the slice (ROADMAP.md Milestone 1 step 2)
    this.s.coin = this.s.coin.add(BUILD[e.kind].cost);
    this.s.ents = this.s.ents.filter((q) => q !== e);
    this.layoutDirty = true;
    this.emit({ type: 'remove', x, y, id: e.kind });
    return OK;
  }

  private rotate(x: number, y: number): ActResult {
    const e = this.entAt(x, y);
    if (!e) return no('nothing here');
    if (e.kind === 'dock' || e.kind === 'hopper') return no('The Dock and Hopper take from every side');
    e.rot = ((e.rot + 1) % 4) as Dir;
    this.layoutDirty = true;
    this.emit({ type: 'rotate', x, y });
    return OK;
  }

  /** Clicking the map: a Spark, an ore patch (hand-mining), the Hand Furnace (crank), a machine
   * blocked by its byproduct (shovel). Capped at 12 counted clicks a second (DESIGN.md §1). */
  private click(x: number, y: number): ActResult {
    const s = this.s;
    if (s.tick - s.clickWindow >= TICK_RATE) {
      s.clickWindow = s.tick;
      s.clicks = 0;
    }
    if (s.clicks >= RULES.clickCap.value) return no('too fast');
    const spark = s.sparks.find((p) => p.x === x && p.y === y);
    if (spark) {
      s.clicks++;
      return catchSpark(this, spark);
    }
    const e = this.entAt(x, y);
    if (e && e.by >= RULES.outputCap.value && e.byItem) {
      s.clicks++;
      return shovel(this, e);
    }
    if (e && e.kind === 'furnace' && !this.has('bellows')) {
      s.clicks++;
      return crankFurnace(this, e);
    }
    if (!e || e.kind === 'miner') {
      const ore = this.oreAt(x, y);
      if (ore) {
        s.clicks++;
        return this.handMine(x, y, ore);
      }
    }
    return no('nothing to click');
  }

  /** Hand-mining: 1 ore into a machine beside the patch that takes it (DESIGN.md §6). */
  private handMine(x: number, y: number, ore: ItemId): ActResult {
    const pi = this.patchOf[y * this.W + x];
    const p = PATCHES[pi];
    for (let yy = p.y - 1; yy <= p.y + p.h; yy++)
      for (let xx = p.x - 1; xx <= p.x + p.w; xx++) {
        const inside = xx >= p.x && yy >= p.y && xx < p.x + p.w && yy < p.y + p.h;
        if (inside) continue;
        const m = this.entAt(xx, yy);
        if (!m || !isMachine(m.kind) || m.kind === 'miner') continue;
        // which way does the ore travel from the patch into m? from the nearest patch tile
        const fx = Math.max(p.x, Math.min(p.x + p.w - 1, xx)), fy = Math.max(p.y, Math.min(p.y + p.h - 1, yy));
        if (fx !== xx && fy !== yy) continue; // diagonal: not beside the patch
        const dir: Dir = xx > fx ? 0 : xx < fx ? 2 : yy > fy ? 1 : 3;
        if (opposite(dir) === m.rot) continue; // not through its front
        const r = m.recipe ? RECIPE[m.recipe] : null;
        if (r && !r.inputs.some((st) => st.item === ore)) continue;
        const cap = m.kind === 'furnace' ? RULES.handOreCap.value : (r?.inputs.find((st) => st.item === ore)?.n ?? 1) * RULES.inputCrafts.value;
        if ((m.inBuf[ore] ?? 0) >= cap) continue;
        if (!r) {
          const fam = BUILD[m.kind].machine;
          if (fam !== 'smelter') continue;
          m.recipe = ore === 'copperOre' ? 'smeltCopper' : 'smeltIron';
          if (m.recipe === 'smeltCopper' && !this.done('copperSmelting')) { m.recipe = null; continue; }
        }
        m.inBuf[ore] = (m.inBuf[ore] ?? 0) + 1;
        this.emit({ type: 'mine', x, y, x2: m.x, y2: m.y, id: ore });
        return OK;
      }
    const beside = this.machines.some((m) => m.kind !== 'miner' && Math.abs(m.x - x) + Math.abs(m.y - y) <= 3);
    return no(beside ? 'The furnace is full of ore' : 'Nothing beside this patch takes ore');
  }

  private upgrade(id: UpgradeId): ActResult {
    const u = UPGRADES[id];
    if (!u) return no('no such upgrade');
    if (this.has(id)) return no('already bought');
    if (this.s.coin.lt(u.cost)) return no(`Needs ${u.cost} coin`);
    this.s.coin = this.s.coin.sub(u.cost);
    this.s.upgrades.push(id);
    this.emit({ type: 'upgrade', id });
    return OK;
  }

  private buyLand(id: string): ActResult {
    const ch = CHUNKS.find((c) => c.id === id);
    if (!ch) return no('no such land');
    if (this.s.land.includes(id)) return no('already yours');
    if (ch.requires && !this.done(ch.requires)) return no(`Needs research: ${RESEARCH[ch.requires].name}`);
    if (this.s.coin.lt(ch.cost)) return no(`Needs ${Num.of(ch.cost).format()} coin`);
    this.s.coin = this.s.coin.sub(ch.cost);
    this.s.land.push(id);
    this.version++;
    this.emit({ type: 'land', id, x: ch.x + ch.w / 2, y: ch.y + ch.h / 2 });
    return OK;
  }

  private setOrder(id: string | null): ActResult {
    const o = this.s.orders;
    if (id === null) {
      o.active = null;
      return OK;
    }
    const d = ORDER[id];
    if (!d) return no('no such order');
    if (o.done.includes(id)) return no('already filled');
    if (!d.requires.every((r) => this.done(r))) return no('not offered yet');
    o.active = id;
    o.progress[id] ??= {};
    this.emit({ type: 'orderAccept', id });
    return OK;
  }

  private setRecipe(x: number, y: number, recipe: string | null): ActResult {
    const e = this.entAt(x, y);
    if (!e || !isMachine(e.kind) || e.kind === 'miner' || e.kind === 'furnace') return no('not a machine with recipes');
    if (recipe !== null) {
      const r = RECIPE[recipe];
      if (!r || r.machine !== BUILD[e.kind].machine) return no('that machine cannot make it');
      if (r.unlock && !this.done(r.unlock)) return no(`Needs research: ${RESEARCH[r.unlock].name}`);
    }
    if (e.recipe === recipe) return OK;
    e.recipe = recipe;
    // a new recipe: what is in the buffers for the old one goes back to nothing (lost)
    e.inBuf = {};
    e.active = false;
    e.prog = 0;
    return OK;
  }

  // ------------------------------------------------------------------ the tick

  tick() {
    // input commands
    if (this.pending.length) {
      const p = this.pending;
      this.pending = [];
      for (const c of p) this.act(c);
    }
    if (this.layoutDirty) this.rebuild();
    runMiners(this);
    runBelts(this);
    runMachines(this);
    runModules(this);
    runDocks(this);
    runOrders(this);
    runResearch(this);
    runSparks(this);
    runAudits(this);
    runStats(this);
    this.s.tick++;
  }

  step(n: number) {
    for (let i = 0; i < n; i++) this.tick();
  }

  // ------------------------------------------------------------------ helpers for systems

  /** Called by `offer` for every item that changes tile. */
  onTransfer(x: number, y: number, dir: Dir, item: string) {
    for (const w of this.watchers) w(x, y, dir, item);
  }

  /** Ticks until the next Spark: 3-6 min, uniform (DESIGN.md §6). */
  sparkDelay(): number {
    const r = (this.s.rng = (this.s.rng + 0x6d2b79f5) >>> 0);
    let t = Math.imul(r ^ (r >>> 15), r | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    const u = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    return Math.round((RULES.sparkMin.value + u * (RULES.sparkMax.value - RULES.sparkMin.value)) * TICK_RATE);
  }

  /** Add coin earned (counts toward the income statistic and lifetime coin). */
  earn(n: Num) {
    this.s.coin = this.s.coin.add(n);
    this.s.earned = this.s.earned.add(n);
    this.s.incomeSec += n.toNumber();
  }

  /** coin per minute over the last minute (a rate) */
  incomePerMin(): number {
    const h = this.s.income;
    if (!h.length) return 0;
    let sum = 0;
    for (const v of h) sum += v;
    return (sum / h.length) * 60;
  }
}

export { OK, no };
