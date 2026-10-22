// Challenges (DESIGN.md §21 Challenges): a run under one restriction, taken at a Reorganize. The
// rule holds until the goal is met; the reward is kept for good in meta.challenges. Readers ask
// `ruled` (is this restriction on now?) and `won` (is this reward kept?); the goal is checked
// once a second, at the end of the tick (after orders and research have counted).
import type { Game, ActResult } from '../Game';
import { OK, no } from '../Game';
import { Num } from '../../engine/num';
import { TICK_RATE } from '../../engine/time';
import { CHALLENGES, CHALLENGE_AFTER_RUNS, CHALLENGE_IDS, type ChallengeId } from '../../data/challenges';
import { BUILD, isMachine, type BuildKind } from '../../data/machines';
import { scenarioPower } from '../scenario';

/** Is this Challenge's restriction on now? */
export const ruled = (g: Game, id: ChallengeId) => g.s.challenge === id;

/** Is this Challenge's reward kept? */
export const won = (g: Game, id: ChallengeId) => !!g.s.meta.challenges?.includes(id);

/** Why the next run can't be this Challenge, or null. */
export function challengeRefusal(g: Game, id: ChallengeId): string | null {
  if (!CHALLENGES[id]) return 'No such Challenge';
  if (g.s.meta.runs < CHALLENGE_AFTER_RUNS) return 'Challenges open after your first Reorganize';
  if (won(g, id)) return `${CHALLENGES[id].name} is won already: its reward is yours`;
  return null;
}

/** Start the run just begun as this Challenge (reorganize calls it after the reset). */
export function startChallenge(g: Game, id: ChallengeId) {
  const c = CHALLENGES[id];
  g.s.challenge = id;
  g.s.challengeBase = g.s.counters.foldS ?? 0;
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
  g.emit({ type: 'challengeQuit', id });
  return OK;
}

function goalMet(g: Game, id: ChallengeId): boolean {
  const goal = CHALLENGES[id].goal;
  switch (goal.k) {
    case 'order': return g.s.orders.done.includes(goal.id);
    case 'research': return g.done(goal.id);
    case 'foldS': return (g.s.counters.foldS ?? 0) > (g.s.challengeBase ?? 0);
  }
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

/** Why a Workshop build is refused by this run's Challenge, or null. */
export function challengeBuildRefusal(g: Game, kind: BuildKind): string | null {
  if (kind === 'splitter' && ruled(g, 'noSplitters')) return 'No Splitters this run (the Challenge)';
  if (ruled(g, 'threeKinds') && isMachine(kind)) {
    const fam = (k: string) => BUILD[k as BuildKind].machine ?? k;
    const kinds = new Set(g.s.ents.filter((e) => isMachine(e.kind) && e.kind !== 'furnace').map((e) => fam(e.kind)));
    if (!kinds.has(fam(kind)) && kinds.size >= (CHALLENGES.threeKinds.value ?? 3)) return `Three kinds of machine at most this run (the Challenge): ${[...kinds].map((k) => BUILD[k as BuildKind].name).join(', ')}`;
  }
  return null;
}

/** What a Workshop build costs now (the Challenges' rewards: free Splitters, 10% off machines). */
export function buildPrice(g: Game, kind: BuildKind): number {
  const base = BUILD[kind].cost;
  if (kind === 'splitter' && won(g, 'noSplitters')) return 0;
  if (isMachine(kind) && won(g, 'threeKinds')) return Math.ceil(base * 0.9);
  return base;
}

/** The power producers' factor: half under Lean Power, a tenth more once it is won (and a
 * Scenario's twist: Little Power). */
export function powerMult(g: Game): number {
  return (ruled(g, 'leanPower') ? CHALLENGES.leanPower.value ?? 0.5 : 1) * (won(g, 'leanPower') ? 1.1 : 1) * scenarioPower(g);
}
