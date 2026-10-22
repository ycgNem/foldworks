// Reorganize, reset layer 1 (DESIGN.md §19). Patents are filed, not re-earned: the Patent Office
// keeps each product's best value on file across every run, and a Reorganize pays only for what
// this run raised it by:
//
//   Patents = floor( 0.5 x SUM over products of max(0, best value this run - value on file)
//                    + Megaproject Patents delivered this run
//                    + log2(1 + bills standing and running / 25,000) )
//
//   value of a design = steps folded x grade multiplier x rate tier
//
// Steps folded are the recipe steps the box actually holds: the product's depth from raw ore less
// the deepest item its ports take in (at least 1), so a Drill Bit assembler fed steel, concrete and
// circuits from outside is 2 steps, not 5. The rate tier is the module's scale in Mk1 machines'
// worth of its product's last recipe, x1.5 for each x4 (a Mk2's speed, §18). A new product, a
// better grade, a deeper fold or a bigger line files new Patents; folding the same line again
// files nothing, so a run pays for new progress and a reset loop dries up. The Megaproject term
// pays each stage's Patents as its parts are delivered (progress is kept, so never twice). The
// minor term counts the bills of the buildings and modules standing that ran in the last minute
// (not coin spent, not a building bought and left idle): a hoard is never burned for Patents.
//
// The reset itself is one operation, `reorganize`: the run's state is replaced by a fresh one, and
// what is kept is carried across: `meta` (Patents, the tree, the record on file, the Patent Drawer,
// run history, lifetime statistics), the Night Shift bought with coin, and the kept fields that
// already lived in the run's state and are read all over the game: the Megaproject (`mega`), the
// Codex (`codex`), reputation (`orders.rep`), the trophies (`trophy:` flags) and the counters.
// Everything else is lost: both floors, coin, items, land and the annex, research, module designs,
// claims, orders filled, Sparks.
import type { Game, ActResult } from './Game';
import { OK, no } from './Game';
import { Num } from '../engine/num';
import { TICK_RATE } from '../engine/time';
import { RULES, GRADES } from '../data/rules';
import { RECIPES, RECIPE } from '../data/recipes';
import { ITEMS, ITEM_IDS, itemName, type ItemId } from '../data/items';
import { BUILD, isMachine, isPower } from '../data/machines';
import { RESEARCH, RESEARCH_IDS, type ResearchId } from '../data/research';
import { CUSTOMERS, type CustomerId } from '../data/orders';
import { MEGA, megaStage } from '../data/megaprojects';
import { ANNEX, FACTORY, START_LAYOUT } from '../data/land';
import { IDLE_UPGRADES } from '../data/idle';
import { PATENTS, type PatentId } from '../data/patents';
import { newState, type Filed, type ModuleDesign, type RunRecord, type State } from './world';
import { isSky, setupIsland } from './systems/islands';
import { lrules } from './legacy';
import { megaDone } from './systems/high';
import { noteBests } from './relocate';
import { clearSeedTile, placeSeed } from './lastfold';
import { BYPRODUCTS, mainItem, megaOpen } from './systems/modules';
import { recipeKnown } from './transfer';
import { workShare } from './systems/stats';
import { prules } from './patents';
import { challengeRefusal, startChallenge } from './systems/challenges';
import type { ChallengeId } from '../data/challenges';

/** What a Reorganize keeps, in words (the confirm card lists it). */
export const KEPT: { what: string; why: string }[] = [
  { what: 'Patents and the Patent tree', why: 'what the reset is for' },
  { what: 'The Patent Office\'s record', why: 'every product\'s best design on file: a later run is paid only for beating it' },
  { what: 'The Patent Drawer', why: 'your kept designs, ready to unfold whole onto their boxes' },
  { what: 'The Great Drill and every Megaproject', why: 'Megaproject progress survives every reset' },
  { what: 'Reputation', why: 'every customer remembers you, and their rewards stay (the Committee\'s opens the Drill\'s stages)' },
  { what: 'The Night Shift', why: 'the offline crews you bought with coin keep working' },
  { what: 'The Codex', why: 'firsts already paid stay paid' },
  { what: 'Trophies and lifetime statistics', why: 'the shelf and the counters' },
];

/** What it loses. */
export const LOST: string[] = [
  'Every floor: every building, module, trunk and skiff route',
  'Coin and every item in the factory',
  'Land (back to chunk A), the Factory annex and deposit claims',
  'Research (head starts give some back)',
  'Module designs (keep the best in the Patent Drawer to unfold them again)',
  'Orders filled this run (they are offered again)',
];

// ------------------------------------------------------------------ chain steps and value

let depthCache: Partial<Record<ItemId, number>> | null = null;

/** Crafting steps from raw ore to this item: mined things 0, then 1 + the deepest input, by its
 * shallowest recipe (glass is 1 from sand, not 3 from gravel); a byproduct sits where its recipe's
 * main output does. */
export function chainSteps(item: ItemId): number {
  if (!depthCache) {
    const d: Partial<Record<ItemId, number>> = {};
    for (const r of RECIPES) if (r.machine === 'miner') for (const o of r.outputs) d[o.item] = 0;
    // (the Second Cookbook's alternate recipes never count: filing is the same in every universe, §23)
    for (let pass = 0; pass < 20; pass++)
      for (const r of RECIPES) {
        if (r.machine === 'miner' || r.alt) continue;
        if (!r.inputs.every((s) => d[s.item] !== undefined)) continue;
        const v = 1 + Math.max(0, ...r.inputs.map((s) => d[s.item]!));
        for (const o of [...r.outputs.map((q) => q.item), ...(r.byproduct ? [r.byproduct.item] : [])]) if (d[o] === undefined || v < d[o]!) d[o] = v;
      }
    depthCache = d;
  }
  return depthCache[item] ?? 0;
}

/** Items a module can be patented for: made by a recipe, not a byproduct. */
export function patentable(item: ItemId): boolean {
  return chainSteps(item) > 0 && !BYPRODUCTS.has(item);
}

/** The recipe steps a design's box holds: its product's depth less the deepest item it takes in
 * through its ports, at least 1 (DESIGN.md §19). */
export function stepsFolded(d: Pick<ModuleDesign, 'ins'>, item: ItemId): number {
  const inDepth = Math.max(0, ...(Object.keys(d.ins) as ItemId[]).filter((i) => (d.ins[i] ?? 0) > 0).map((i) => chainSteps(i)));
  return Math.max(1, chainSteps(item) - inDepth);
}

/** A design's scale: its product per second (before the grade) in Mk1 machines' worth of the
 * product's last recipe (the shallowest recipe making it). */
export function designScale(d: Pick<ModuleDesign, 'outs' | 'grade'>, item: ItemId): number {
  const r = RECIPES.filter((q) => q.machine !== 'miner' && !q.alt && q.outputs.some((o) => o.item === item)).sort((a, b) => a.time - b.time)[0];
  if (!r) return 0;
  const n = r.outputs.find((o) => o.item === item)!.n;
  return ((d.outs[item] ?? 0) / Math.max(0.01, d.grade.mult)) * r.time / n;
}

/** The rate tier of a scale: 0 under 4 machines' worth, then one more for each x4 (§19). */
export function rateTier(scale: number): number {
  const step = RULES.tierStep.value;
  return scale < step - 1e-6 ? 0 : Math.floor(Math.log(scale + 1e-6) / Math.log(step));
}

export const tierMult = (tier: number) => 1 + RULES.tierBonus.value * tier;

/** The scale a design needs for the next tier, in its product per minute (the drawer and goals). */
export function nextTierRate(d: Pick<ModuleDesign, 'outs' | 'grade'>, item: ItemId): number {
  const s = designScale(d, item);
  const want = Math.pow(RULES.tierStep.value, rateTier(s) + 1);
  return s > 0 ? ((d.outs[item] ?? 0) * 60 * want) / s : 0;
}

export interface Valued { item: ItemId; steps: number; grade: string; mult: number; scale: number; tier: number; value: number; rate: number; design: ModuleDesign }

/** A design's value on the Patent Office's scale: steps folded x grade x rate tier. */
export function designValue(d: ModuleDesign): Valued | null {
  const item = mainItem(d);
  if (!item || !patentable(item)) return null;
  // a fold on a high floor files a step deeper per depth past 2 (DESIGN.md §22, the second gate):
  // its box's routes are logistics folded away, so a District fold of a chain is worth more than the
  // Factory's nested fold of the same chain
  const steps = stepsFolded(d, item) + Math.max(0, (d.depth ?? 1) - 2) * RULES.highFoldSteps.value;
  const scale = designScale(d, item);
  const tier = rateTier(scale);
  return { item, steps, grade: d.grade.letter, mult: d.grade.mult, scale, tier, value: steps * d.grade.mult * tierMult(tier), rate: d.outs[item] ?? 0, design: d };
}

// ------------------------------------------------------------------ bills standing

/** Pole bills on a grid count up to this share of its consumers' counted bills (a grid's poles
 * cost a few percent of what they power: a field of poles beside one kiln is not a factory). */
const POLE_SHARE = 0.25;

/** The bills of the factory standing and running, each building weighted by its measured work
 * over the last RULES.billsWindow whole minutes (§19, the Milestone 5-6 final round):
 * - a Workshop machine or Miner by its work share times its grid's satisfaction (a brownout at 1%
 *   of the power wanted counts 1% of the bill);
 * - a power producer (and an engine's boiler) by its own burn share: an unfuelled one counts
 *   nothing, a plant twice the load half each;
 * - Poles by their grid's producers' burn share, at most a quarter of the grid's counted consumers;
 * - belts and logistics parts, and Factory trunks, in full if they carried an item in the window;
 * - Factory modules by their run fraction, at their stamp bill.
 * Coin on hand counts for nothing, and a building bought and left idle, starved, blocked or
 * browned out for nothing, so a hoard is never burned for Patents. */
export function billsStanding(g: Game): number {
  const win = RULES.billsWindow.value * 60 * TICK_RATE;
  const carried = (e: { used?: number }) => e.used !== undefined && g.s.tick - e.used <= win;
  let b = 0;
  // each grid's counted consumers, and its producers' capacity and delivered share
  const cons = new Map<number, number>(), cap = new Map<number, number>(), gave = new Map<number, number>();
  for (const e of g.s.ents) {
    if (e.kind === 'dock' || e.kind === 'hopper' || e.kind === 'furnace') continue;
    const cost = BUILD[e.kind]?.cost ?? 0;
    const gi = g.gridOf.get(e.id);
    if (isMachine(e.kind)) {
      const v = cost * workShare(e);
      b += v;
      if (gi !== undefined) cons.set(gi, (cons.get(gi) ?? 0) + v);
    } else if (e.kind === 'pole') continue;
    else if (isPower(e.kind)) {
      const sh = workShare(e);
      b += cost * sh;
      const kw = BUILD[e.kind].power ?? 0;
      if (gi !== undefined && kw) {
        cap.set(gi, (cap.get(gi) ?? 0) + kw);
        gave.set(gi, (gave.get(gi) ?? 0) + kw * sh);
      }
    } else if (carried(e)) b += cost;
  }
  g.grids.forEach((gr, gi) => {
    const pc = gr.poles.reduce((t, p) => t + (BUILD[p.kind]?.cost ?? 0), 0);
    const c = cap.get(gi) ?? 0;
    const util = c > 0 ? (gave.get(gi) ?? 0) / c : 0;
    b += Math.min(pc * util, POLE_SHARE * (cons.get(gi) ?? 0));
  });
  for (const e of g.s.factory.ents) {
    if (e.kind === 'module') b += (g.design(e.design)?.bill ?? 0) * workShare(e);
    else if (e.kind === 'trunk' && carried(e)) b += FACTORY.trunkCost;
  }
  return b;
}

export const billsTerm = (b: number) => Math.log2(1 + b / RULES.patentBillsDivisor.value);

// ------------------------------------------------------------------ the preview

export type FileStatus = 'new' | 'improved' | 'filed';

export interface PatentLine {
  item: ItemId;
  steps: number;
  grade: string;
  mult: number;
  tier: number;
  /** this run's best value, and what is on file */
  value: number;
  filed: number;
  /** Patents it files now */
  patents: number;
  status: FileStatus;
  /** its product per minute (grade applied) */
  perMin: number;
}

export interface PatentGoal { kind: 'fold' | 'grade' | 'deeper' | 'bigger' | 'mega' | 'committee'; text: string; gain: number; item?: ItemId }

export interface Preview {
  /** Patents a Reorganize gives now */
  now: number;
  /** the sum before rounding down */
  total: number;
  lines: PatentLine[];
  /** the filing term (main) */
  designs: number;
  mega: number;
  /** the bills term, and the bills it counts (coin) */
  bills: number;
  billValue: number;
  /** Patents at the next step: the best goal of the main term added */
  nextStep: number;
  /** goals that raise it, biggest first */
  goals: PatentGoal[];
}

const gradeMult = (letter: string) => GRADES.find((q) => q.letter === letter)?.mult ?? 1;

/** Each product's best design this run, valued. */
export function bestThisRun(g: Game): Map<ItemId, Valued> {
  const best = new Map<ItemId, Valued>();
  for (const d of g.s.designs) {
    const v = designValue(d);
    if (!v) continue;
    const cur = best.get(v.item);
    if (!cur || v.value > cur.value) best.set(v.item, v);
  }
  return best;
}

/** What Reorganize would give now, term by term, and what would raise it (pure). */
export function previewPatents(g: Game): Preview {
  const s = g.s;
  const k = RULES.patentPerStep.value;
  const filed = s.meta.patented ?? {};
  const best = bestThisRun(g);
  const lines: PatentLine[] = [...best.values()].map((v) => {
    const on = filed[v.item]?.value ?? 0;
    const gain = k * Math.max(0, v.value - on);
    return { item: v.item, steps: v.steps, grade: v.grade, mult: v.mult, tier: v.tier, value: v.value, filed: on, patents: gain, status: !filed[v.item] ? 'new' : gain > 1e-9 ? 'improved' : 'filed', perMin: v.rate * 60 };
  });
  lines.sort((a, b) => b.patents - a.patents || b.value - a.value);
  const designs = lines.reduce((t, l) => t + l.patents, 0);
  const mega = s.megaPatents ?? 0;
  const billValue = billsStanding(g);
  const bills = billsTerm(billValue);
  const total = designs + mega + bills;
  const now = Math.floor(total + 1e-9);
  const goals: PatentGoal[] = [];
  // a product not folded yet this run, its recipe known: one step at B, at the least
  const known = new Set<ItemId>();
  for (const r of RECIPES) if (r.machine !== 'miner' && recipeKnown(g, r)) for (const o of r.outputs) known.add(o.item);
  for (const it of ITEM_IDS) {
    if (best.has(it) || !known.has(it) || !patentable(it)) continue;
    const on = filed[it]?.value ?? 0;
    const lo = k * Math.max(0, 1 - on), hi = k * Math.max(0, chainSteps(it) * GRADES[0].mult - on);
    if (hi <= 1e-9) continue;
    goals.push({ kind: 'fold', item: it, gain: Math.max(lo, hi / 2), text: on ? `Fold ${itemName(it).toLowerCase()} better than its filed ${fmt(on)}: up to +${fmt(hi)}` : `Fold a line making ${itemName(it).toLowerCase()} (new): +${fmt(k)} a step folded, up to +${fmt(hi)}` });
  }
  // the lines folded this run: a better grade, a deeper fold, a bigger line
  for (const v of best.values()) {
    const on = filed[v.item]?.value ?? 0;
    const cur = k * Math.max(0, v.value - on);
    const gainAt = (value: number) => k * Math.max(0, value - on) - cur;
    const name = itemName(v.item).toLowerCase();
    if (v.mult < GRADES[0].mult) {
      const gain = gainAt(v.steps * GRADES[0].mult * tierMult(v.tier));
      if (gain >= 0.1) goals.push({ kind: 'grade', item: v.item, gain, text: `Refold ${name} at S+ (now ${v.grade}): +${fmt(gain)}` });
    }
    if (v.steps < chainSteps(v.item)) {
      const gain = gainAt((v.steps + 1) * v.mult * tierMult(v.tier));
      if (gain >= 0.1) goals.push({ kind: 'deeper', item: v.item, gain, text: `Fold ${name} one step deeper (${v.steps} of ${chainSteps(v.item)} steps in its box): +${fmt(gain)}` });
    }
    const gain = gainAt(v.steps * v.mult * tierMult(v.tier + 1));
    if (gain >= 0.1) goals.push({ kind: 'bigger', item: v.item, gain, text: `Fold a bigger ${name} line (${fmt(v.rate * 60)}/min, next tier at ${fmt(nextTierRate(v.design, v.item))}/min): +${fmt(gain)}` });
  }
  const st = megaStage(s.mega.stage);
  if (st && g.done('greatDrill')) {
    const left = st.patents * (1 - megaFrac(g));
    if (!megaOpen(g, st)) goals.push({ kind: 'committee', gain: left, text: `Fill Committee orders: ${st.name} opens at their reputation ${st.rep} (now ${s.orders.rep.committee ?? 0}), worth +${fmt(left)}` });
    else if (left > 0.05) goals.push({ kind: 'mega', gain: left, text: `Finish ${st.name}: +${fmt(left)}` });
  }
  // (no "run N more coin of buildings" goal: the final round, a goal to buy buildings for the bills
  // term pointed at burning coin, the one thing the term is built not to pay for)
  goals.sort((a, b) => b.gain - a.gain);
  const main = goals.filter((q) => q.kind !== 'mega' && q.kind !== 'committee')[0];
  const nextStep = Math.floor(total + (main?.gain ?? 0) + 1e-9);
  return { now, total, lines, designs, mega, bills, billValue, nextStep, goals };
}

/** How far the current Great Drill stage is (mean of its parts), 0..1. */
export function megaFrac(g: Game): number {
  const st = megaStage(g.s.mega.stage);
  if (!st) return 1;
  let f = 0, n = 0;
  for (const [it, want] of Object.entries(st.wants) as [ItemId, number][]) {
    f += Math.min(1, (g.s.mega.progress[it]?.toNumber() ?? 0) / want);
    n++;
  }
  return n ? f / n : 1;
}

const fmt = (v: number) => (v >= 10 ? v.toFixed(0) : v.toFixed(1).replace(/\.0$/, ''));

// ------------------------------------------------------------------ the reset

export function reorganizeRefusal(g: Game): string | null {
  if (g.s.scenario) return 'A Scenario has no Reorganize: its best fold is its record';
  const p = previewPatents(g);
  if (p.now < RULES.patentMin.value) return g.s.designs.length ? 'Nothing new to patent yet: fold a new product, or a line better than the one on file' : 'Nothing to patent yet: fold a line into a module first';
  if (g.s.audits.length || g.s.faudit || g.s.haudit) return 'An audit is running: fold or cancel it first';
  return null;
}

/** Flags that outlive a run (trophies; the screens the player has opened once). */
const KEEP_FLAG = (f: string) => f.startsWith('trophy:') || f === 'ordersSeen' || f === 'factorySeen';

/** The Night Shift bought with coin (src/data/idle.ts) outlives a run (the lead's decision 6). */
const KEEP_UPGRADE = new Set<string>(IDLE_UPGRADES.map((u) => u.id));

/** File this run's best design of each product with the Patent Office (only a rise is kept). */
export function fileDesigns(g: Game) {
  const m = g.s.meta;
  m.patented ??= {};
  for (const v of bestThisRun(g).values()) {
    const on = m.patented[v.item];
    if (on && on.value >= v.value) continue;
    const f: Filed = { value: v.value, steps: v.steps, grade: v.grade, tier: v.tier, run: m.runs + 1 };
    m.patented[v.item] = f;
  }
}

/** Reorganize: bank this run's Patents and start a new run, keeping what survives (pillar 4:
 * always the player's choice, with a preview). */
export function reorganize(g: Game, challenge?: ChallengeId): ActResult {
  const why = reorganizeRefusal(g) ?? (challenge ? challengeRefusal(g, challenge) : null);
  if (why) return no(why);
  const s = g.s;
  const p = previewPatents(g).now;
  const m = s.meta;
  fileDesigns(g);
  endRun(g, { patents: p });
  m.patents = m.patents.add(p);
  m.patentsEarned = m.patentsEarned.add(p);
  if (m.here) m.here.runs++;
  keepRoom(g);
  startRun(g);
  if (challenge) startChallenge(g, challenge);
  g.bump('reorganizes');
  g.emit({ type: 'reorganize', value: p, d: m.runs });
  return OK;
}

/** Close the run: its record, the lifetime statistics, and this world's best folds (Reorganize and
 * Relocate both call it before the reset). */
export function endRun(g: Game, rec: { patents: number; relocate?: RunRecord['relocate']; legacy?: number; lastFold?: number }) {
  const s = g.s;
  const m = s.meta;
  noteBests(g);
  m.history.push({ run: m.runs + 1, ticks: s.tick - m.runStart, patents: rec.patents, earned: s.earned, peakPerMin: m.peakPerMin, ...(rec.relocate ? { relocate: rec.relocate, legacy: rec.legacy } : {}), ...(rec.lastFold !== undefined ? { lastFold: rec.lastFold } : {}) });
  m.runs++;
  m.lifetime.earned = m.lifetime.earned.add(s.earned);
  for (const [it, n] of Object.entries(s.delivered) as [ItemId, Num][]) m.lifetime.delivered[it] = (m.lifetime.delivered[it] ?? Num.ZERO).add(n);
  m.lifetime.folds += s.designs.length;
}

/** The Sky Anchor's stages (DESIGN.md §22): the room bought this run that is kept through a
 * Reorganize, the most of it so far. */
function keepRoom(g: Game) {
  const s = g.s;
  const k = (s.meta.keptRoom ??= {});
  if (megaDone(g, 'anchor', 1)) k.annex = Math.max(k.annex ?? 0, s.annex ?? 0);
  if (megaDone(g, 'anchor', 2)) k.district = Math.max(k.district ?? 0, s.district?.lots ?? 0);
  if (megaDone(g, 'anchor', 3)) k.world = Math.max(k.world ?? 0, s.world?.lots ?? 0);
}

/** Start a fresh run on the island the town is on: the kept state carried over, the start layout,
 * the island's ground, the head starts (Reorganize and Relocate both end here). */
export function startRun(g: Game) {
  const fresh = carry(g.s);
  g.s = fresh;
  // the old run's grid and lookups go with it, before anything is placed on the new floor
  g.rebuild();
  g.rebuildFactory();
  g.intake.length = 0;
  for (const b of START_LAYOUT) g.addPart(b.kind, b.x, b.y, b.rot);
  // the Seed, in every Workshop after a Last Fold (DESIGN.md §23)
  placeSeed(g);
  setupIsland(g);
  clearSeedTile(g);
  fresh.nextSpark = g.sparkDelay();
  fresh.annex = Math.min(ANNEX.blocks, fresh.meta.keptRoom?.annex ?? 0);
  applyHeadStarts(g);
  g.layoutDirty = true;
  g.factoryDirty = true;
}

/** A fresh run's state with the kept parts of `s` carried over. */
function carry(s: State): State {
  const f = newState(s.seed);
  f.tick = s.tick;
  f.rng = s.rng;
  f.visible = s.visible;
  f.meta = s.meta;
  f.meta.runStart = s.tick;
  f.meta.peakPerMin = 0;
  f.meta.perMinRing = [];
  f.mega = s.mega;
  // Megaprojects #2 and on survive every reset as the Great Drill does (DESIGN.md §21)
  if (s.megas) f.megas = s.megas;
  f.codex = s.codex;
  f.orders.rep = s.orders.rep;
  f.counters = s.counters;
  f.flags = s.flags.filter(KEEP_FLAG);
  f.upgrades = s.upgrades.filter((u) => KEEP_UPGRADE.has(u));
  // ids keep counting, so nothing of the old run is mistaken for the new
  f.nextId = s.nextId;
  f.nextAudit = s.nextAudit;
  f.nextDesign = s.nextDesign;
  return f;
}

/** Put the head starts the Patent tree owns (or just `ids`, a node bought now) into this run. */
export function applyHeadStarts(g: Game, ids: readonly PatentId[] = g.s.meta.nodes) {
  const s = g.s;
  // only the nodes a head start names: Overdrive by Habit gives Overdrive, not the steel research
  // before it (the tree's prerequisites stay to be researched)
  const research = new Set<ResearchId>(s.research.done);
  const add = (r: ResearchId) => research.add(r);
  for (const id of ids) {
    const e = PATENTS[id]?.effect;
    if (!e || e.k !== 'head') continue;
    for (const u of e.upgrades ?? []) if (!s.upgrades.includes(u)) s.upgrades.push(u);
    for (const r of e.research ?? []) add(r);
    // (never sky: Pebble Isle's C, D and F are not land, DESIGN.md §22)
    for (const l of e.land ?? []) if (!s.land.includes(l) && !isSky(g, l)) s.land.push(l);
    if (e.coin) {
      s.coin = s.coin.add(e.coin);
      s.granted = (s.granted ?? Num.ZERO).add(e.coin);
    }
    for (const q of e.place ?? []) if (!g.entAt(q.x, q.y)) g.addPart(q.kind, q.x, q.y, q.rot);
    if (e.lots) s.headLots = Math.max(s.headLots ?? 0, e.lots);
  }
  // the Legacy tree's head starts (DESIGN.md §22): the Town Archive knows Act I; Standing Charts knows
  // Charting in a world whose World floor has stood
  const lr = lrules(g);
  if (lr.archive) for (const r of RESEARCH_IDS) if ((RESEARCH[r].act ?? 1) === 1) add(r);
  if (lr.charts && s.meta.here?.opened) add('charting');
  // in the tree's order, so the research screen and the bots read them as researched in turn
  s.research.done = RESEARCH_IDS.filter((r) => research.has(r));
  g.layoutDirty = true;
}

/** The run's length so far, in seconds. */
export function runSeconds(g: Game): number {
  return (g.s.tick - (g.s.meta?.runStart ?? 0)) / TICK_RATE;
}

// ------------------------------------------------------------------ customers met

/** Has the player met this customer in this run? The Committee comes after the first Reorganize
 * (once `meets` is done in that run), or in any run once the Great Drill is researched there (its
 * reputation opens the Drill's later stages, and its odd orders are goals while the Bay fills:
 * §16 rule 1), or once the Great Drill's stage 1 stands (DESIGN.md §19). */
export function customerMet(g: Game, c: CustomerId): boolean {
  const d = CUSTOMERS[c];
  const research = !d.meets || g.done(d.meets);
  if (!d.afterReset) return research;
  return (g.s.meta.runs >= 1 && research) || g.done('greatDrill') || g.s.mega.stage >= 1;
}

export { MEGA, ITEMS, RECIPE, prules, gradeMult };
