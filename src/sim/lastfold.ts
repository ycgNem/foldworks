// The Last Fold, reset layer 3 (DESIGN.md §23). The whole World floor is audited at once (every
// module on it, the high-floor audit over the whole floor: `lastFoldAudit`), and its card offers the
// reset (`lastFold`): the World folds into one tile, the Seed, which becomes the first machine of a
// new universe. Kernels are banked from what the World holds and how well it ran:
//
//   Kernels = floor( value / 10 ) + the audit grade's bonus (S+ 5, S 4, A 3, B 2, C 1, D 0)
//
//   value = for each product and depth at work, its best module's value (steps folded x grade x
//           rate tier, as filing, §19) in full, plus a quarter of each further copy's: on the World,
//           each module the audit found at half speed or better; on Beyond, each module run 60 s
//           straight at half speed or better; a depth-4 module counts the World group folded into
//           it (the sum of its parts), so folding up never loses value. A copy pays a quarter of a
//           new kind of group (the review: 100 copies of one chain were 100 Kernels)
//
// Not a root or a log of coin: it counts the folds standing on the top floors, the same scale as
// Patents and Legacy. Kept: every Megaproject, the Codex, trophies, reputation, the Patent Drawer,
// Challenges won, lifetime statistics, the Endless Ledger and its cosmetics, Kernels and the Kernel
// tree, the Legacy tree's Automation branch (pillar 2: what was automated stays automated), Acts
// I-II's research (the Seed knows it, in every run of the new universe) and the stages standing
// (each counts for Legacy once more, at its island's first Relocate); with Kept Islands the worlds'
// records, with Kept Legacy chosen head starts and softeners. Lost: everything a Relocate loses,
// plus Legacy, the rest of the Legacy tree and the worlds' records; the islands are unvisited again.
// The new universe starts on Home (decided, §23): the Seed is planted where the
// town began, on the island with no rule, so the new base rules are met on plain ground first.
// Pillar 4: the player's choice, from a card that says what it gives, keeps and loses.
import type { Game, ActResult } from './Game';
import { OK, no } from './Game';
import { Num } from '../engine/num';
import { RULES } from '../data/rules';
import { HIGH } from '../data/floors';
import { KERNEL_GRADE } from '../data/kernels';
import { GRADES } from '../data/rules';
import { itemName, type ItemId } from '../data/items';
import { newWorldRun, type FEnt, type ModuleDesign, type SeedCard } from './world';
import { designValue, endRun, startRun } from './reorganize';
import { krules } from './kernels';
import { worldOf } from './systems/islands';
import { stagesStanding } from './relocate';
import { LEGACY, type LegacyId } from '../data/legacy';
import { highW } from './systems/high';
import { mainItem } from './systems/modules';

/** What the Last Fold keeps, in words (the card lists it). */
export const LASTFOLD_KEPT: { what: string; why: string }[] = [
  { what: 'Kernels and the Kernel tree', why: 'what the fold is for: the next universe\'s base rules' },
  { what: 'Every Megaproject', why: 'their progress survives every reset, even this one' },
  { what: 'Reputation, the Codex, trophies', why: 'every customer, every first and every shelf follows the Seed' },
  { what: 'The Patent Drawer', why: 'kept designs unfold in the new universe (its rules may change them)' },
  { what: 'Challenges won, lifetime statistics, the Endless Ledger', why: 'the long tail goes on' },
  { what: 'The Legacy tree\'s Automation branch', why: 'the Clerk, the Committee, the Regrader, the Town Plan, the Runners, the Guild and the Drawers stay the town\'s for good: what was automated stays automated' },
  { what: 'Acts I-II\'s research', why: 'the Seed knows it: every run of the new universe starts with it (the Town Archive and more)' },
  { what: 'The worlds\' records (with Kept Islands), chosen head starts and softeners (with Kept Legacy)', why: 'what the Kernel tree keeps' },
];

/** What it loses. */
export const LASTFOLD_LOST: string[] = [
  'Everything a Relocate loses: every floor, coin, items, land, research (past Acts I-II, which the Seed knows), designs, Patents and their tree, the record on file',
  'Legacy, unspent, and the Legacy tree\'s head starts and softeners (Kept Legacy keeps the ones you choose; the Automation branch stays)',
  'The worlds\' records (Kept Islands keeps them) and the islands visited: the new universe starts on Home',
];

// ------------------------------------------------------------------ the value of what stands

/** A design's worth to the Last Fold: its value as filing (§19); a depth-4 design the sum of the
 * World group folded into it. */
export function lastFoldValue(g: Game, d: ModuleDesign, depth = 0): number {
  if ((d.depth ?? 1) >= 4 && d.hparts?.length && depth < 4) {
    let v = 0;
    for (const p of d.hparts) {
      const q = g.design(p.design);
      if (q) v += lastFoldValue(g, q, depth + 1);
    }
    return v;
  }
  return designValue(d)?.value ?? 0;
}

export interface KernelLine {
  floor: 'world' | 'beyond';
  id: number;
  design: number;
  name: string;
  item: ItemId | null;
  value: number;
  /** the audit's busy share (World), or 1 / 0 by 60 s at work (Beyond) */
  busy: number;
  counted: boolean;
  /** the share of its value it counts: 1 for its product and depth's best at work, a quarter
   * (RULES.kernelCopyShare) for each further copy, 0 when it isn't counted */
  share: number;
}

/** A goal: `text` in full (the card's tip), `short` the card's line when the text's first clause
 * won't do (the audit's own advice). */
export interface KernelGoal { kind: 'audit' | 'module' | 'grade'; text: string; gain: number; short?: string }

export interface KernelPreview {
  /** Kernels the Last Fold gives now */
  now: number;
  total: number;
  /** the World's value counted, its term, the modules counted, and the kinds (product and depth)
   * among them (each kind's best in full, its copies a quarter) */
  value: number;
  valueTerm: number;
  counted: number;
  kinds: number;
  /** the whole-World audit's grade (null until it is graded), and its bonus */
  audited: boolean;
  grade: string | null;
  gradeBonus: number;
  lines: KernelLine[];
  goals: KernelGoal[];
}

const fmt = (v: number) => (v >= 10 ? v.toFixed(0) : v.toFixed(1).replace(/\.0$/, ''));

/** The Last Fold's audit, if it is graded. */
function graded(g: Game) {
  const a = g.s.haudit;
  return a && a.last && a.result ? a : null;
}

/** What the Last Fold would give now, line by line, and what would raise it (pure). */
export function previewKernels(g: Game): KernelPreview {
  const a = graded(g);
  const lines: KernelLine[] = [];
  const line = (floor: 'world' | 'beyond', e: FEnt, busy: number, counted: boolean) => {
    const d = g.design(e.design);
    if (!d) return;
    lines.push({ floor, id: e.id, design: d.id, name: d.name, item: mainItem(d), value: lastFoldValue(g, d), busy, counted, share: 0 });
  };
  const runSecs = RULES.legacyRunSeconds.value;
  for (const e of g.s.world?.ents ?? []) {
    if (e.kind !== 'module') continue;
    if (a) {
      const busy = a.result!.busy[String(e.id)] ?? 0;
      line('world', e, busy, a.ids.includes(e.id) && busy >= 0.5 - 1e-9);
    } else line('world', e, (e.ok ?? 0) >= runSecs ? 1 : 0, (e.ok ?? 0) >= runSecs);
  }
  for (const e of g.s.beyond?.ents ?? []) if (e.kind === 'module') line('beyond', e, (e.ok ?? 0) >= runSecs ? 1 : 0, (e.ok ?? 0) >= runSecs);
  // each (product, depth) at work counts its best module in full and every further copy a quarter
  const copy = RULES.kernelCopyShare.value;
  const kindOf = (l: KernelLine) => `${l.item ?? '#' + l.design}|${g.design(l.design)?.depth ?? 1}`;
  const best = new Map<string, KernelLine>();
  for (const l of lines) {
    if (!l.counted) continue;
    const k = kindOf(l), was = best.get(k);
    if (!was || l.value > was.value) best.set(k, l);
  }
  for (const l of lines) if (l.counted) l.share = best.get(kindOf(l)) === l ? 1 : copy;
  const value = lines.reduce((t, l) => t + l.value * l.share, 0);
  const valueTerm = value / RULES.kernelPerValue.value;
  const grade = a ? a.result!.grade.letter : null;
  const gradeBonus = grade ? KERNEL_GRADE.bonus[grade] ?? 0 : 0;
  const total = valueTerm + gradeBonus;
  const now = Math.floor(total + 1e-9);
  const goals: KernelGoal[] = [];
  const k = 1 / RULES.kernelPerValue.value;
  if (!a) goals.push({ kind: 'audit', gain: KERNEL_GRADE.bonus.B, text: 'Audit the whole World (the Last Fold\'s audit): its grade adds 0-5 Kernels' });
  else {
    const i = GRADES.findIndex((q) => q.letter === grade);
    // the audit's own advice, weakest part first (the review: "run it better" while C was 11%)
    const advice = a.result!.advice[0];
    if (i > 0) {
      const next = `${GRADES[i - 1].letter} adds 1 Kernel more (now ${grade})`;
      goals.push({ kind: 'grade', gain: 1, text: advice ? `${advice} ${next}.` : `Run the World better: ${next}`, short: advice ? firstSentence(advice) : undefined });
    }
  }
  for (const l of lines) {
    if (l.counted || l.value <= 0) continue;
    // what it would add: the best of its kind in full, the rest a quarter
    const b = best.get(kindOf(l));
    const gain = (b ? (l.value > b.value ? l.value - b.value + b.value * copy : l.value * copy) : l.value) * k;
    goals.push({ kind: 'module', gain, text: `Put ${l.name} to work (half speed or better${l.floor === 'beyond' ? ', 60 s' : ''}): +${fmt(gain)} Kernels${b ? ' (a copy: a quarter of its value)' : ''}` });
  }
  goals.push({ kind: 'module', gain: 8 * k, text: `Put a new kind of District group to work on the World (a product not at work there): +${fmt(k)} a unit of its value (about 8 a group; a copy counts a quarter)` });
  goals.sort((p, q) => q.gain - p.gain);
  return { now, total, value, valueTerm, counted: lines.filter((l) => l.counted).length, kinds: best.size, audited: !!a, grade, gradeBonus, lines, goals };
}

/** An advice line's first sentence, without its full stop (the card's line; the whole is its tip). */
function firstSentence(s: string): string {
  const i = s.search(/\.(\s|$)/);
  return (i > 0 ? s.slice(0, i) : s).replace(/:.*$/, '');
}

/** Legacy nodes the Last Fold keeps without choosing: the Automation branch (pillar 2, the review). */
export const keptForGood = (id: LegacyId) => LEGACY[id]?.branch === 'auto';

// ------------------------------------------------------------------ the audit

/** Why the whole World can't be audited now, or null. */
export function lastFoldAuditRefusal(g: Game): string | null {
  if (g.s.scenario) return 'A Scenario has no Last Fold';
  if (!g.done('lastFold')) return 'Research The Last Fold first (the Lighthouse and the Sky Anchor must stand)';
  if (!g.s.world) return 'The World floor is not open';
  const a = g.s.haudit;
  if (a) return a.last ? (a.result ? 'The World is graded: take the Last Fold, or cancel the audit' : 'The World is being audited already') : 'Fold or cancel the audit up here first';
  if (!g.s.world.ents.some((e) => e.kind === 'module')) return 'Put modules to work on the World first';
  return null;
}

/** Audit every module on the World at once (the Last Fold's card follows the grade). */
export function startLastFoldAudit(g: Game): ActResult {
  const why = lastFoldAuditRefusal(g);
  if (why) return no(why);
  const st = g.s.world!;
  const box = { x: 0, y: 0, w: highW(g, 'world'), h: HIGH.world.h };
  g.s.haudit = { floor: 'world', last: true, box, t: 0, ids: st.ents.filter((e) => e.kind === 'module').map((e) => e.id), ins: {}, outs: {}, run: {}, made: 0, missed: 0, inside: 0, result: null };
  g.bump('audits');
  g.emit({ type: 'lastFoldAudit', x: box.w / 2, y: box.h / 2, floor: 'world' });
  return OK;
}

// ------------------------------------------------------------------ the fold

/** Why the Last Fold can't be taken now, or null. */
export function lastFoldRefusal(g: Game): string | null {
  if (g.s.scenario) return 'A Scenario has no Last Fold';
  const a = g.s.haudit;
  if (!a?.last) return 'Audit the whole World first (the Last Fold\'s audit)';
  if (!a.result) return 'The World is still being audited: wait for its grade';
  if (g.s.audits.length || g.s.faudit) return 'An audit is running: fold or cancel it first';
  if (previewKernels(g).now < RULES.kernelMin.value) return 'Nothing to fold yet: put modules to work on the World';
  return null;
}

/** The Last Fold: bank this universe's Kernels and start the next one on Home, the Seed in its
 * Workshop (pillar 4: the player's choice, with a preview). */
export function lastFold(g: Game): ActResult {
  const why = lastFoldRefusal(g);
  if (why) return no(why);
  const s = g.s;
  const m = s.meta;
  const p = previewKernels(g);
  const k = p.now;
  const top = p.lines.filter((l) => l.counted).sort((x, y) => y.value - x.value)[0];
  const card: SeedCard = { universe: (m.lastFolds ?? 0) + 1, grade: p.grade ?? 'D', value: p.value, kernels: k, modules: p.counted, item: top?.item ?? null, world: worldOf(g) };
  endRun(g, { patents: 0, lastFold: k });
  m.kernels = (m.kernels ?? Num.ZERO).add(k);
  m.kernelsEarned = (m.kernelsEarned ?? Num.ZERO).add(k);
  (m.seeds ??= []).push(card);
  m.lastFolds = (m.lastFolds ?? 0) + 1;
  const kr = krules(g);
  // layer 1 and 2's losses: the Patents and their tree, the record on file, the room kept
  m.patents = Num.ZERO;
  m.nodes = [];
  m.habits = [];
  m.patented = {};
  m.queue = m.queue.filter((q) => m.drawer.some((d) => d.id === q));
  m.keptRoom = {};
  // layer 3's: Legacy and its tree, but the Automation branch for good and the head starts and
  // softeners Kept Legacy chose; the Seed knows what the Town Archive knew (and Act II's research
  // too: reorganize.ts applyHeadStarts), so the Archive is the town's; the worlds' records (Kept
  // Islands keeps them), the islands seen
  const picks = (m.keptLegacy ?? []).filter((n) => !keptForGood(n) && n !== 'townArchive').slice(0, kr.legacySlots);
  const keep = new Set<LegacyId>([...picks, ...(m.legacyNodes ?? []).filter(keptForGood)]);
  m.legacyNodes = [...(m.legacyNodes ?? []).filter((n) => keep.has(n)), 'townArchive'];
  m.keptLegacy = picks;
  m.legacy = Num.ZERO;
  // the stages standing go into the new universe, each to count once more for Legacy (§22)
  m.inherited = stagesStanding(g);
  if (!m.legacyNodes.includes('standingCommittee')) m.standing = null;
  if (!m.legacyNodes.includes('townPlan')) m.plans = [];
  if (!kr.keptIslands) m.worldRecords = {};
  m.world = 'home';
  m.visited = ['home'];
  m.here = newWorldRun(s.tick);
  startRun(g);
  g.bump('lastFolds');
  g.emit({ type: 'lastFold', id: card.item ?? undefined, value: k, d: m.lastFolds });
  if (card.item) g.emit({ type: 'seed', x: RULES.seedX.value, y: RULES.seedY.value, id: card.item, value: card.universe });
  return OK;
}

/** Plant the Seed in a fresh Workshop (every run after a Last Fold: src/sim/reorganize.ts startRun). */
export function placeSeed(g: Game) {
  if ((g.s.meta.lastFolds ?? 0) < 1 || g.s.scenario) return;
  const x = RULES.seedX.value, y = RULES.seedY.value;
  if (g.s.ents.some((e) => e.x <= x && x < e.x + e.w && e.y <= y && y < e.y + e.h)) return;
  g.addPart('seed', x, y, 0);
}

/** The Old Works' rubble never lies on the Seed's tile (it is laid after: startRun). */
export function clearSeedTile(g: Game) {
  if (!g.s.rubble || (g.s.meta.lastFolds ?? 0) < 1) return;
  const i = RULES.seedY.value * g.W + RULES.seedX.value;
  g.s.rubble = g.s.rubble.filter((q) => q !== i);
}

export { itemName };
