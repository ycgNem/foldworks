// Reorganize, reset layer 1 (DESIGN.md §19). A run's Patents come from what it built:
//
//   Patents = floor( 0.5 x sum over products folded this run of (chain steps x best grade multiplier)
//                    + Megaproject Patents earned this run
//                    + log2(1 + coin invested / 100,000) )
//
// The main term counts each distinct product a module design of this run makes (its main output),
// once, by how many crafting steps it sits from raw ore (ingot 1, plate 2, gear 3, Gizmo 4, Drill
// Bit 5: read off the recipes, src/data/recipes.ts) and the best grade any of its designs got. The
// second is each Great Drill stage's worth (src/data/megaprojects.ts) in proportion to what this run
// delivered to the Bay. The third, minor, is the coin the run put into its factory (earned + head
// start coin - coin on hand): spending the pile is worth a little, hoarding it nothing.
//
// The reset itself is one operation, `reorganize`: the run's state is replaced by a fresh one, and
// what is kept is carried across: `meta` (Patents, the tree, blueprints, bearings, run history,
// lifetime statistics) plus the four kept fields that already lived in the run's state and are read
// all over the game: the Megaproject (`mega`), the Codex (`codex`), reputation (`orders.rep`), the
// trophies (`trophy:` flags), and the statistics counters. Everything else is lost: both floors,
// coin, items, land, research, module designs, claims, orders filled, Sparks, ghosts.
import type { Game, ActResult } from './Game';
import { OK, no } from './Game';
import { Num } from '../engine/num';
import { TICK_RATE } from '../engine/time';
import { RULES, GRADES } from '../data/rules';
import { RECIPES, RECIPE } from '../data/recipes';
import { ITEMS, ITEM_IDS, itemName, type ItemId } from '../data/items';
import { RESEARCH, RESEARCH_IDS, type ResearchId } from '../data/research';
import { CUSTOMERS, type CustomerId } from '../data/orders';
import { MEGA, megaStage } from '../data/megaprojects';
import { START_LAYOUT } from '../data/land';
import { PATENTS, type PatentId } from '../data/patents';
import { newState, type State } from './world';
import { BYPRODUCTS, mainItem } from './systems/modules';
import { recipeKnown } from './transfer';
import { prules } from './patents';

/** What a Reorganize keeps, in words (the confirm card lists it). */
export const KEPT: { what: string; why: string }[] = [
  { what: 'Patents and the Patent tree', why: 'what the reset is for' },
  { what: 'Blueprints', why: 'your layouts, ready to place as ghosts' },
  { what: 'The Great Drill', why: 'Megaproject progress survives every reset' },
  { what: 'Reputation', why: 'every customer remembers you, and their rewards stay' },
  { what: 'The Codex', why: 'firsts already paid stay paid' },
  { what: 'Raccoon Bearings', why: 'the Committee keeps them in the coat' },
  { what: 'Trophies and lifetime statistics', why: 'the shelf and the counters' },
];

/** What it loses. */
export const LOST: string[] = [
  'Both floors: every building, module and trunk',
  'Coin and every item in the factory',
  'Land (back to chunk A) and deposit claims',
  'Research (head starts give some back)',
  'Module designs (blueprints rebuild the lines; fold them again)',
  'Orders filled this run (they are offered again)',
];

// ------------------------------------------------------------------ chain steps

let depthCache: Partial<Record<ItemId, number>> | null = null;

/** Crafting steps from raw ore to this item: mined things 0, then 1 + the deepest input, by its
 * shallowest recipe (glass is 1 from sand, not 3 from gravel); a byproduct sits where its recipe's
 * main output does. */
export function chainSteps(item: ItemId): number {
  if (!depthCache) {
    const d: Partial<Record<ItemId, number>> = {};
    for (const r of RECIPES) if (r.machine === 'miner') for (const o of r.outputs) d[o.item] = 0;
    for (let pass = 0; pass < 20; pass++)
      for (const r of RECIPES) {
        if (r.machine === 'miner') continue;
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

// ------------------------------------------------------------------ the preview

export interface PatentLine { item: ItemId; steps: number; grade: string; mult: number; patents: number }
export interface PatentGoal { kind: 'fold' | 'grade' | 'mega' | 'works'; text: string; gain: number; item?: ItemId; coin?: Num }

export interface Preview {
  /** Patents a Reorganize gives now */
  now: number;
  /** the sum before rounding down */
  total: number;
  lines: PatentLine[];
  designs: number;
  mega: number;
  works: number;
  invested: number;
  /** Patents at the next step of the main term: the best product not yet folded, folded at B */
  nextStep: number;
  /** goals that raise it, biggest first */
  goals: PatentGoal[];
}

const gradeMult = (letter: string) => GRADES.find((q) => q.letter === letter)?.mult ?? 1;

/** Coin the run has put into its factory: earned, plus head-start coin, less what is on hand. */
export function invested(g: Game): number {
  const s = g.s;
  return Math.max(0, s.earned.toNumber() + (s.granted?.toNumber() ?? 0) - s.coin.toNumber());
}

export const worksTerm = (put: number) => Math.log2(1 + put / RULES.patentWorksDivisor.value);

/** What Reorganize would give now, term by term, and what would raise it (pure). */
export function previewPatents(g: Game): Preview {
  const s = g.s;
  const k = RULES.patentPerStep.value;
  // the main term: each distinct product of this run's designs, at its best grade
  const best = new Map<ItemId, { grade: string; mult: number }>();
  for (const d of s.designs) {
    const it = mainItem(d);
    if (!it || !patentable(it)) continue;
    const cur = best.get(it);
    if (!cur || d.grade.mult > cur.mult) best.set(it, { grade: d.grade.letter, mult: d.grade.mult });
  }
  const lines: PatentLine[] = [...best.entries()].map(([item, b]) => ({ item, steps: chainSteps(item), grade: b.grade, mult: b.mult, patents: k * chainSteps(item) * b.mult }));
  lines.sort((a, b) => b.patents - a.patents);
  const designs = lines.reduce((t, l) => t + l.patents, 0);
  const mega = s.megaPatents ?? 0;
  const inv = invested(g);
  const works = worksTerm(inv);
  const total = designs + mega + works;
  const now = Math.floor(total + 1e-9);
  // goals: fold a product not folded yet (its recipe known now), at B
  const goals: PatentGoal[] = [];
  const known = new Set<ItemId>();
  for (const r of RECIPES) if (r.machine !== 'miner' && recipeKnown(g, r)) for (const o of r.outputs) known.add(o.item);
  for (const it of ITEM_IDS) {
    if (best.has(it) || !known.has(it) || !patentable(it)) continue;
    goals.push({ kind: 'fold', item: it, gain: k * chainSteps(it), text: `Fold a line making ${itemName(it).toLowerCase()}: +${fmt(k * chainSteps(it))}` });
  }
  for (const l of lines) {
    if (l.mult >= GRADES[0].mult) continue;
    const gain = k * l.steps * (GRADES[0].mult - l.mult);
    if (gain >= 0.25) goals.push({ kind: 'grade', item: l.item, gain, text: `Fold ${itemName(l.item).toLowerCase()} again at S+ (now ${l.grade}): +${fmt(gain)}` });
  }
  const st = megaStage(s.mega.stage);
  if (st && g.done('greatDrill')) {
    const left = st.patents * (1 - megaFrac(g));
    if (left > 0.05) goals.push({ kind: 'mega', gain: left, text: `Finish ${st.name}: +${fmt(left)}` });
  }
  // the coin that lifts the total to the next whole Patent through the works term alone
  const need = Math.ceil(total + 1e-9) - total || 1;
  const coin = RULES.patentWorksDivisor.value * (Math.pow(2, works + need) - 1) - inv;
  goals.push({ kind: 'works', gain: need, coin: Num.of(Math.ceil(coin)), text: `Invest ${Num.of(Math.ceil(coin)).format()} more coin in the factory: +1 Patent` });
  goals.sort((a, b) => b.gain - a.gain);
  const fold = goals.filter((q) => q.kind === 'fold').sort((a, b) => b.gain - a.gain)[0];
  const nextStep = Math.floor(total + (fold?.gain ?? 0) + 1e-9);
  return { now, total, lines, designs, mega, works, invested: inv, nextStep, goals };
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
  if (st.bearings) { f += Math.min(1, (g.s.mega.bearings ?? 0) / st.bearings); n++; }
  return n ? f / n : 1;
}

const fmt = (v: number) => (v >= 10 ? v.toFixed(0) : v.toFixed(1).replace(/\.0$/, ''));

// ------------------------------------------------------------------ the reset

export function reorganizeRefusal(g: Game): string | null {
  const p = previewPatents(g);
  if (p.now < RULES.patentMin.value) return 'Nothing to patent yet: fold a line into a module first';
  if (g.s.audits.length || g.s.faudit) return 'An audit is running: fold or cancel it first';
  return null;
}

/** Flags that outlive a run (trophies; the screens the player has opened once). */
const KEEP_FLAG = (f: string) => f.startsWith('trophy:') || f === 'ordersSeen' || f === 'factorySeen';

/** Reorganize: bank this run's Patents and start a new run, keeping what survives (pillar 4:
 * always the player's choice, with a preview). */
export function reorganize(g: Game): ActResult {
  const why = reorganizeRefusal(g);
  if (why) return no(why);
  const s = g.s;
  const p = previewPatents(g).now;
  const m = s.meta;
  m.history.push({ run: m.runs + 1, ticks: s.tick - m.runStart, patents: p, earned: s.earned, peakPerMin: m.peakPerMin });
  m.patents = m.patents.add(p);
  m.patentsEarned = m.patentsEarned.add(p);
  m.runs++;
  m.lifetime.earned = m.lifetime.earned.add(s.earned);
  for (const [it, n] of Object.entries(s.delivered) as [ItemId, Num][]) m.lifetime.delivered[it] = (m.lifetime.delivered[it] ?? Num.ZERO).add(n);
  m.lifetime.folds += s.designs.length;
  const fresh = carry(s);
  g.s = fresh;
  // the old run's grid and lookups go with it, before anything is placed on the new floor
  g.rebuild();
  g.rebuildFactory();
  g.intake.length = 0;
  for (const b of START_LAYOUT) g.addPart(b.kind, b.x, b.y, b.rot);
  fresh.nextSpark = g.sparkDelay();
  applyHeadStarts(g);
  g.layoutDirty = true;
  g.factoryDirty = true;
  g.bump('reorganizes');
  g.emit({ type: 'reorganize', value: p, d: m.runs });
  return OK;
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
  f.codex = s.codex;
  f.orders.rep = s.orders.rep;
  f.counters = s.counters;
  f.flags = s.flags.filter(KEEP_FLAG);
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
    for (const l of e.land ?? []) if (!s.land.includes(l)) s.land.push(l);
    if (e.coin) {
      s.coin = s.coin.add(e.coin);
      s.granted = (s.granted ?? Num.ZERO).add(e.coin);
    }
    for (const q of e.place ?? []) if (!g.entAt(q.x, q.y)) g.addPart(q.kind, q.x, q.y, q.rot);
  }
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
 * (once `meets` is done in that run), or in the first run once the Great Drill is researched (the
 * Bay is where its bearings go, and its odd orders are goals while the Bay fills: §16 rule 1), or
 * once the Great Drill's stage 1 stands (DESIGN.md §19). */
export function customerMet(g: Game, c: CustomerId): boolean {
  const d = CUSTOMERS[c];
  const research = !d.meets || g.done(d.meets);
  if (!d.afterReset) return research;
  return (g.s.meta.runs >= 1 && research) || g.done('greatDrill') || g.s.mega.stage >= 1;
}

export { MEGA, ITEMS, RECIPE, prules };
