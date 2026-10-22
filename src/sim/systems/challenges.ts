// Challenges (DESIGN.md §21 Challenges, §24): a run under one restriction, taken at a Reorganize.
// The rule holds until the goal is met; the reward is kept for good in meta.challenges. Readers ask
// `ruled` (is this restriction on now?) and `won` (is this reward kept?); the goal is checked
// once a second, at the end of the tick (after orders and research have counted). The helpers at
// the foot are the one place each rule and reward is read (a Scenario's twist too, where a board
// shares a Challenge's rule: Milestone 11).
import type { Game, ActResult } from '../Game';
import { OK, no } from '../Game';
import { Num } from '../../engine/num';
import { TICK_RATE } from '../../engine/time';
import { CHALLENGES, CHALLENGE_AFTER_RUNS, CHALLENGE_IDS, type ChallengeGoal, type ChallengeId } from '../../data/challenges';
import { BUILD, isMachine, type BuildKind } from '../../data/machines';
import { GRADES, RULES } from '../../data/rules';
import { scenarioOf, scenarioPower } from '../scenario';

/** Is this Challenge's restriction on now? */
export const ruled = (g: Game, id: ChallengeId) => g.s.challenge === id;

/** Is this Challenge's reward kept? */
export const won = (g: Game, id: ChallengeId) => !!g.s.meta.challenges?.includes(id);

/** Why the next run can't be this Challenge, or null. */
export function challengeRefusal(g: Game, id: ChallengeId): string | null {
  if (!CHALLENGES[id]) return 'No such Challenge';
  if (g.s.meta.runs < CHALLENGE_AFTER_RUNS) return 'Challenges open after your first Reorganize';
  if (won(g, id)) return `${CHALLENGES[id].name} is won already: its reward is yours`;
  const need = CHALLENGES[id].needs;
  if (need && (g.s.counters[need.counter] ?? 0) < 1) return need.text;
  return null;
}

/** The letters at or above a grade (S+ first). */
const lettersFrom = (letter: string) => GRADES.slice(0, GRADES.findIndex((q) => q.letter === letter) + 1).map((q) => q.letter);

/** Where a goal's count stands as the run begins (its goal is more than that). */
function goalBase(g: Game, goal: ChallengeGoal): number {
  const c = g.s.counters;
  switch (goal.k) {
    case 'foldS': return c.foldS ?? 0;
    case 'foldGrade': return lettersFrom(goal.letter).reduce((a, l) => a + (c['grade:' + l] ?? 0), 0);
    case 'counter': return c[goal.name] ?? 0;
    default: return 0;
  }
}

/** Start the run just begun as this Challenge (reorganize calls it after the reset). */
export function startChallenge(g: Game, id: ChallengeId) {
  const c = CHALLENGES[id];
  g.s.challenge = id;
  g.s.challengeBase = goalBase(g, c.goal);
  if (c.start?.coin) {
    g.s.coin = g.s.coin.add(c.start.coin);
    g.s.granted = (g.s.granted ?? Num.ZERO).add(c.start.coin);
  }
  for (const u of c.start?.upgrades ?? []) if (!g.s.upgrades.includes(u as never)) g.s.upgrades.push(u as never);
  g.layoutDirty = true;
  g.emit({ type: 'challenge', id });
}

/** Give the Challenge up: the run goes on as an ordinary one, without the reward. */
export function quitChallenge(g: Game): ActResult {
  if (!g.s.challenge) return no('This run is not a Challenge');
  const id = g.s.challenge;
  g.s.challenge = null;
  g.layoutDirty = true;
  g.bump('challengesQuit');
  g.emit({ type: 'challengeQuit', id });
  return OK;
}

/** Modules standing on a floor now. */
function standing(g: Game, floor: 'factory' | 'district' | 'world'): number {
  const ents = floor === 'factory' ? g.s.factory.ents : g.s[floor]?.ents ?? [];
  let n = 0;
  for (const e of ents) if (e.kind === 'module') n++;
  return n;
}

/** How far the goal is: the count now and the count it wants (the Challenge slip's meter). */
export function challengeProgress(g: Game, id: ChallengeId): { have: number; want: number } {
  const goal = CHALLENGES[id].goal;
  const base = g.s.challenge === id ? g.s.challengeBase ?? 0 : 0;
  switch (goal.k) {
    case 'order': return { have: g.s.orders.done.includes(goal.id) ? 1 : 0, want: 1 };
    case 'research': return { have: g.done(goal.id) ? 1 : 0, want: 1 };
    case 'deliver': return { have: Math.min(goal.n, g.s.delivered[goal.item]?.toNumber() ?? 0), want: goal.n };
    case 'foldS': return { have: Math.min(1, Math.max(0, (g.s.counters.foldS ?? 0) - base)), want: 1 };
    case 'foldGrade': return { have: Math.min(1, Math.max(0, goalBase(g, goal) - base)), want: 1 };
    case 'standing': return { have: Math.min(goal.n, standing(g, goal.floor)), want: goal.n };
    case 'counter': return { have: Math.min(goal.n, Math.max(0, (g.s.counters[goal.name] ?? 0) - base)), want: goal.n };
  }
}

function goalMet(g: Game, id: ChallengeId): boolean {
  const p = challengeProgress(g, id);
  return p.have >= p.want;
}

export function runChallenges(g: Game) {
  const id = g.s.challenge as ChallengeId | null | undefined;
  if (!id || g.s.tick % TICK_RATE !== 0) return;
  if (!CHALLENGE_IDS.includes(id)) { g.s.challenge = null; return; }
  if (!goalMet(g, id)) return;
  const m = g.s.meta;
  m.challenges ??= [];
  if (!m.challenges.includes(id)) m.challenges.push(id);
  g.s.challenge = null;
  g.layoutDirty = true;
  g.bump('challengesWon');
  g.emit({ type: 'challengeWon', id });
}

/** A Mk2 machine (a bigger, faster one of a family, §18). */
const isMk2 = (kind: BuildKind) => isMachine(kind) && (BUILD[kind].speed ?? 1) > 1;

/** Why a Workshop build is refused by this run's Challenge (or the Scenario's twist), or null. */
export function challengeBuildRefusal(g: Game, kind: BuildKind): string | null {
  if (kind === 'splitter' && ruled(g, 'noSplitters')) return 'No Splitters this run (the Challenge)';
  if (ruled(g, 'threeKinds') && isMachine(kind)) {
    const fam = (k: string) => BUILD[k as BuildKind].machine ?? k;
    const kinds = new Set(g.s.ents.filter((e) => isMachine(e.kind) && e.kind !== 'furnace').map((e) => fam(e.kind)));
    if (!kinds.has(fam(kind)) && kinds.size >= (CHALLENGES.threeKinds.value ?? 3)) return `Three kinds of machine at most this run (the Challenge): ${[...kinds].map((k) => BUILD[k as BuildKind].name).join(', ')}`;
  }
  // Milestone 11 (DESIGN.md §24)
  const sc = scenarioOf(g);
  if (kind === 'heap' && (ruled(g, 'cleanHands') || sc?.noHeaps)) return sc?.noHeaps ? 'No Slag Heaps on this board (the Scenario)' : 'No Slag Heaps this run (the Challenge): use the slag';
  if (isMk2(kind) && (ruled(g, 'mk1Only') || sc?.mk1Only)) return sc?.mk1Only ? 'Mk1 machines only on this board (the Scenario)' : 'No Mk2 machines this run (the Challenge)';
  if (kind === 'belt' && ruled(g, 'beltBudget')) {
    const cap = CHALLENGES.beltBudget.value ?? 60;
    if (g.s.ents.filter((e) => e.kind === 'belt').length >= cap) return `${cap} belt tiles at most this run (the Challenge)`;
  }
  return null;
}

/** What a Workshop build costs now (one place for a price a rule may change): Old Faithful won
 * takes 15% off a Mk2 (DESIGN.md §24). */
export function buildPrice(g: Game, kind: BuildKind): number {
  const c = BUILD[kind].cost;
  if (isMk2(kind) && won(g, 'mk1Only')) return Math.round(c * (CHALLENGES.mk1Only.reward2 ?? 0.85));
  return c;
}

/** The power producers' factor: half under Lean Power, a tenth more once it is won (and a
 * Scenario's twist: Little Power). */
export function powerMult(g: Game): number {
  return (ruled(g, 'leanPower') ? CHALLENGES.leanPower.value ?? 0.5 : 1) * (won(g, 'leanPower') ? 1.1 : 1) * scenarioPower(g);
}

// ------------------------------------------------------------------ Milestone 11's rules (§24)

/** The Strict Inspector: a grade one letter lower while it holds (S+ is S ... D stays D). */
export function strictGrade<T extends { letter: string; mult: number }>(g: Game, gr: T): T {
  if (!ruled(g, 'strictInspector')) return gr;
  const i = GRADES.findIndex((q) => q.letter === gr.letter);
  const low = GRADES[Math.min(GRADES.length - 1, i + 1)];
  return { ...gr, letter: low.letter, mult: low.mult };
}

/** Compactness counts full at this share of machine tiles a box tile (Belt Budget won: 0.55). */
export const compactFull = (g: Game) => (won(g, 'beltBudget') ? CHALLENGES.beltBudget.reward2 ?? 0.55 : RULES.compactFull.value);

/** S+ needs this share of the byproducts used inside the box (The Strict Inspector won: 0.7). */
export const splusShare = (g: Game) => (won(g, 'strictInspector') ? CHALLENGES.strictInspector.reward2 ?? 0.7 : RULES.splusUsedInside.value);

/** Hand-Made: no stamping while it holds. */
export const stampRule = (g: Game): string | null => (ruled(g, 'handMade') ? 'No stamping this run (the Challenge): fold the line again' : null);

/** Hand-Made won: a design's first stamp takes no Machine Kits. */
export const firstStampKitFree = (g: Game, stamped: number) => stamped === 0 && won(g, 'handMade');

/** A high floor's skiff numbers under the Challenges (Headwinds, Rough Seas, Light Fleet). */
export function skiffRules(g: Game, id: 'district' | 'world' | 'beyond', k: { load: number; speed: number; dwell: number }): { load: number; speed: number; dwell: number } {
  let { load, speed, dwell } = k;
  if (id === 'district') {
    if (ruled(g, 'headwinds')) speed *= CHALLENGES.headwinds.value ?? 0.5;
    if (won(g, 'headwinds')) speed += CHALLENGES.headwinds.reward2 ?? 0.5;
  }
  if (id === 'world') {
    if (ruled(g, 'roughSeas')) load = Math.max(1, Math.floor(load * (CHALLENGES.roughSeas.value ?? 0.5)));
    if (won(g, 'roughSeas')) load += CHALLENGES.roughSeas.reward2 ?? 1;
  }
  if (won(g, 'lightFleet')) dwell *= CHALLENGES.lightFleet.reward2 ?? 0.75;
  return { load, speed, dwell };
}

/** Skiffs a route takes at most under the Challenges: Short Haul won adds 2; Light Fleet holds 3. */
export function skiffCapRule(g: Game, cap: number): number {
  let c = cap + (won(g, 'shortHaul') ? CHALLENGES.shortHaul.reward2 ?? 2 : 0);
  if (ruled(g, 'lightFleet')) c = Math.min(c, CHALLENGES.lightFleet.value ?? 3);
  return c;
}

/** Why a route this long can't fly on this floor now (Short Haul), or null. */
export function routeRule(g: Game, id: string, dist: number): string | null {
  const cap = CHALLENGES.shortHaul.value ?? 5;
  if (id === 'district' && ruled(g, 'shortHaul') && dist > cap + 1e-9) return `Routes fly ${cap} tiles at most this run (the Challenge): this one is ${dist.toFixed(1)}`;
  return null;
}

/** Why a lot can't be bought on this floor now (Zoning Freeze), or null; and its price factor. */
export const lotRule = (g: Game, id: string): string | null => (id === 'district' && ruled(g, 'zoningFreeze') ? 'No District lots this run (the Challenge)' : null);
export const lotFactor = (g: Game, id: string) => (id === 'district' && won(g, 'zoningFreeze') ? CHALLENGES.zoningFreeze.reward2 ?? 0.8 : 1);
