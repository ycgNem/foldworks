// Challenges v1 (DESIGN.md §21 Challenges): a run taken under one restriction, chosen at a
// Reorganize. Its rule holds until its goal is met; then the reward is kept for good
// (meta.challenges) and the rest of the run is an ordinary one. Patents are filed as for any run,
// and a Challenge can be given up at any time (no reward, no penalty). DECISIONS.md: Challenges are
// an Antimatter Dimensions convention, allowed as genre furniture; here every goal is a factory
// goal (an order, a research, a grade) and every reward is a small rule tied to what earned it,
// never a multiplier on everything.
import type { ResearchId } from './research';

export const CHALLENGE_IDS = ['noSplitters', 'handsOff', 'leanPower', 'threeKinds', 'smallBoxes'] as const;
export type ChallengeId = (typeof CHALLENGE_IDS)[number];

export type ChallengeGoal =
  | { k: 'order'; id: string }
  | { k: 'research'; id: ResearchId }
  /** a fold graded S or better this run */
  | { k: 'foldS' };

export interface ChallengeDef {
  id: ChallengeId;
  name: string;
  /** the restriction, as the Reorganize card states it */
  rule: string;
  goal: ChallengeGoal;
  goalText: string;
  /** what is kept for good once the goal is met */
  reward: string;
  /** what the run starts with besides the usual (so a rule doesn't make the start impossible) */
  start?: { coin?: number; upgrades?: string[] };
  /** the restriction's number, where it has one */
  value?: number;
  flavor: string;
  derivation: string;
}

const C = (d: ChallengeDef) => d;

export const CHALLENGES: Record<ChallengeId, ChallengeDef> = {
  noSplitters: C({
    id: 'noSplitters', name: 'No Splitters',
    rule: 'No Splitters can be built this run',
    goal: { k: 'order', id: 'gizmoFestival' }, goalText: 'Fill the Gizmo Festival',
    reward: 'Splitters cost nothing, for good',
    flavor: 'Every belt goes exactly one place. Like a sensible person.',
    derivation: '§21 Challenges: the slice\'s last goal, its lines laid with dedicated belts and two Miners where one split would do; the reward is the part it took away, priced at nothing',
  }),
  handsOff: C({
    id: 'handsOff', name: 'Hands Off',
    rule: 'No clicks count: no hand-mining, no cranking, no Sparks, no Overdrive, no Inspiration',
    goal: { k: 'research', id: 'folding' }, goalText: 'Research Folding',
    reward: 'Every run starts with the Bellows, for good',
    start: { coin: 60, upgrades: ['bellows'] },
    flavor: 'The town votes to sit on its hands. The machines are delighted.',
    derivation: '§21 Challenges: Folding is the slice\'s first hour, built by Miners alone (60 coin buys the first Miner and its belt, §4); the reward is the Bellows head start (a 1-Patent node, §19) for nothing',
  }),
  leanPower: C({
    id: 'leanPower', name: 'Lean Power',
    rule: 'Steam Engines and Generators make half their kW',
    value: 0.5,
    goal: { k: 'research', id: 'circuits' }, goalText: 'Research Circuits',
    reward: 'Steam Engines and Generators make 10% more, for good',
    flavor: 'The coal merchant is on holiday. Nobody knows where.',
    derivation: '§21 Challenges: Circuits are Act II\'s first powered line (§18); at half power the player learns Efficient mode and shed load; the reward is a tenth of the plant they did without',
  }),
  threeKinds: C({
    id: 'threeKinds', name: 'Three Kinds',
    rule: 'At most three kinds of machine on the Workshop (the Hand Furnace is free)',
    value: 3,
    goal: { k: 'foldS' }, goalText: 'Fold a line graded S',
    reward: 'Workshop machines cost 10% less, for good',
    flavor: 'A frog, a press and a furnace walk into a bar.',
    derivation: '§21 Challenges: an S fold of three kinds is a tight line (miner, smelter, press: §10\'s grade with C >= 0.9); the reward is a flat 10% off the Workshop\'s machines, never a curve (§4)',
  }),
  smallBoxes: C({
    id: 'smallBoxes', name: 'Small Boxes',
    rule: 'Fold boxes are at most 4×4',
    value: 4,
    goal: { k: 'order', id: 'gizmoFestival' }, goalText: 'Fill the Gizmo Festival',
    reward: 'Fold boxes one tile larger each way, for good',
    flavor: 'The Patent Office has run out of big envelopes.',
    derivation: '§21 Challenges: a 4x4 box holds one machine pair, so Gizmos come from three small modules joined on the Factory; the reward is a tile of box, about what one more Patent node gives (§19)',
  }),
};

/** Challenges open after the first Reorganize (the Reorganize card offers them). */
export const CHALLENGE_AFTER_RUNS = 1;
