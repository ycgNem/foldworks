// Challenges v1 (DESIGN.md §21 Challenges): a run taken under one restriction, chosen at a
// Reorganize. Its rule holds until its goal is met; then the reward is kept for good
// (meta.challenges) and the rest of the run is an ordinary one. Patents are filed as for any run,
// and a Challenge can be given up at any time (no reward, no penalty). DECISIONS.md: Challenges are
// an Antimatter Dimensions convention, allowed as genre furniture; here every goal is a factory
// goal (an order, a research, a grade) and every reward is a small rule tied to what earned it,
// never a multiplier on everything.
import type { ResearchId } from './research';
import type { ItemId } from './items';

export const CHALLENGE_IDS = ['noSplitters', 'handsOff', 'leanPower', 'threeKinds', 'smallBoxes',
  // Milestone 11 (DESIGN.md §24): ten more, across Acts II-IV
  'cleanHands', 'mk1Only', 'handMade', 'strictInspector', 'beltBudget', 'headwinds', 'shortHaul', 'zoningFreeze', 'roughSeas', 'lightFleet'] as const;
export type ChallengeId = (typeof CHALLENGE_IDS)[number];

export type ChallengeGoal =
  | { k: 'order'; id: string }
  | { k: 'research'; id: ResearchId }
  /** this many of an item delivered this run (a head start can't deliver it for you) */
  | { k: 'deliver'; item: ItemId; n: number }
  /** a fold graded S or better this run */
  | { k: 'foldS' }
  // Milestone 11 (DESIGN.md §24)
  /** a fold graded this letter or better this run (as the run's rule graded it) */
  | { k: 'foldGrade'; letter: 'S+' | 'S' | 'A' | 'B' }
  /** this many modules standing on a floor at once */
  | { k: 'standing'; floor: 'factory' | 'district' | 'world'; n: number }
  /** a counter raised this many this run (from where it stood when the run began) */
  | { k: 'counter'; name: string; n: number };

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
  /** the reward's number, where it has one (Milestone 11) */
  reward2?: number;
  /** offered only once the player has been this far in some run (a counter, kept for good) */
  needs?: { counter: string; text: string };
  /** the act it is meant for (Milestone 11: the Reorganize card can sort by it) */
  act?: 2 | 3 | 4;
  flavor: string;
  derivation: string;
}

const C = (d: ChallengeDef) => d;

export const CHALLENGES: Record<ChallengeId, ChallengeDef> = {
  noSplitters: C({
    id: 'noSplitters', name: 'No Splitters',
    rule: 'No Splitters can be built this run',
    goal: { k: 'order', id: 'gizmoFestival' }, goalText: 'Fill the Gizmo Festival',
    reward: 'Every high floor holds 20 more skiff routes, for good',
    flavor: 'Every belt goes exactly one place. Like a sensible person.',
    derivation: '§21 Challenges: the slice\'s last goal, its lines laid with dedicated belts and two Miners where one split would do; the reward is routing room, a lot\'s worth of routes (RULES.routesPerLot) on every high floor (the second gate: free Splitters were worth nothing by Act III)',
  }),
  handsOff: C({
    id: 'handsOff', name: 'Hands Off',
    rule: 'No clicks count: no hand-mining, no cranking, no Sparks, no Overdrive, no Inspiration',
    goal: { k: 'deliver', item: 'gizmo', n: 200 }, goalText: 'Deliver 200 Gizmos this run',
    reward: 'The Dispatcher works for you without its Patent, for good',
    start: { coin: 60, upgrades: ['bellows'] },
    flavor: 'The town votes to sit on its hands. The machines are delighted.',
    derivation: '§21 Challenges: 200 Gizmos is the slice\'s middle, built with no click (60 coin buys the first Miner and its belt, §4); a delivery this run, so no head start meets it (the second gate: Folding was known from the start and won in 2 s); the reward is automation for a player who proved they need none, the Dispatcher (a 3-Patent node, §21)',
  }),
  leanPower: C({
    id: 'leanPower', name: 'Lean Power',
    rule: 'Steam Engines and Generators make half their kW',
    value: 0.5,
    goal: { k: 'deliver', item: 'circuit', n: 300 }, goalText: 'Deliver 300 circuits this run',
    reward: 'Steam Engines and Generators make 10% more, for good',
    flavor: 'The coal merchant is on holiday. Nobody knows where.',
    derivation: '§21 Challenges: circuits are Act II\'s first powered line (§18), 300 of them about 30 min of two circuit lines; a delivery this run, so no head start meets it (the second gate: Circuits were known from a head start); at half power the player learns Efficient mode and shed load; the reward is a tenth of the plant they did without',
  }),
  threeKinds: C({
    id: 'threeKinds', name: 'Three Kinds',
    rule: 'At most three kinds of machine on the Workshop (the Hand Furnace is free)',
    value: 3,
    goal: { k: 'foldS' }, goalText: 'Fold a line graded S',
    reward: 'Nested and District fold boxes a tile larger each way, for good',
    flavor: 'A frog, a press and a furnace walk into a bar.',
    derivation: '§21 Challenges: an S fold of three kinds is a tight line (miner, smelter, press: §10\'s grade with C >= 0.9); the reward is room to fold deeper, a tile of the nested and District boxes (what one Patent node gives, §19; 10% off Workshop machines was worth nothing by Act III: the second gate)',
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
  // ---- Milestone 11 (DESIGN.md §24): Act II
  cleanHands: C({
    id: 'cleanHands', name: 'Clean Hands', act: 2,
    rule: 'No Slag Heaps can be built this run (the one under the Hand Furnace stays)',
    goal: { k: 'deliver', item: 'concrete', n: 400 }, goalText: 'Deliver 400 concrete this run',
    reward: 'Gravel and concrete craft 10% faster, for good',
    reward2: 0.1,
    flavor: 'The heap has been rezoned as a park. Nobody may put anything on it.',
    derivation: '§21 Challenges, §24: concrete is slag -> gravel -> concrete (§18), so every line\'s slag is an input; 400 is about 16 min of an S concrete module (0.42/s, §18) and a delivery this run; the reward is a tenth on the two crafts that eat slag, a delivery trophy\'s 5% twice over (§24)',
  }),
  mk1Only: C({
    id: 'mk1Only', name: 'Old Faithful', act: 2,
    rule: 'No Mk2 machines can be built this run',
    goal: { k: 'deliver', item: 'motor', n: 100 }, goalText: 'Deliver 100 motors this run',
    reward: 'Mk2 machines cost 15% less, for good',
    reward2: 0.85,
    flavor: 'The town has voted for the classics. The classics are delighted and a bit slow.',
    derivation: '§21 Challenges, §24: motors are Act II\'s last product (§18), 100 of them about 40 min of four Mk1 motor lines; the reward is 15% off the Mk2 price (6,000-20,000, §18), a few minutes of Act II income a machine, for a player who learned to do without them',
  }),
  handMade: C({
    id: 'handMade', name: 'Hand-Made', act: 2,
    rule: 'No stamping this run: every module is folded',
    goal: { k: 'standing', floor: 'factory', n: 8 }, goalText: 'Stand 8 modules on the Factory at once',
    reward: 'A design\'s first stamp takes no Machine Kits, for good',
    flavor: 'The Patent Office has lost the stamp. It was in a coat pocket. The coat denies it.',
    derivation: '§21 Challenges, §24: eight modules standing at once is the slice-end Factory (§11, three to six) and Act II\'s first steel and glass modules, each folded again where a stamp would do; the reward is the kits of one stamp a design (1 + floor(bill / 5,000), §18), which matters while kits are made by hand in Act II',
  }),
  strictInspector: C({
    id: 'strictInspector', name: 'The Strict Inspector', act: 2,
    rule: 'Every fold is graded one letter lower this run (S+ is S, S is A...)',
    goal: { k: 'foldGrade', letter: 'A' }, goalText: 'Fold a line graded A or better (an S before the Inspector)',
    reward: 'S+ needs 70% of the byproducts used inside the box, was 80%, for good',
    reward2: 0.7,
    flavor: 'The Inspector has had a bad week. The Inspector would like you to know that.',
    derivation: '§21 Challenges, §24: an A after the drop is an S line (§10, score 0.9), balanced and compact; the reward is a tenth off S+\'s zero-waste gate (RULES.splusUsedInside 0.8, §10), so a line with slag on its belts at the window edges still reaches S+ (x1.35, and a Kernel more at the Last Fold, §23)',
  }),
  beltBudget: C({
    id: 'beltBudget', name: 'Belt Budget', act: 2,
    rule: 'At most 60 belt tiles on the Workshop this run',
    value: 60,
    goal: { k: 'deliver', item: 'steel', n: 1000 }, goalText: 'Deliver 1,000 steel this run',
    reward: 'A fold box counts fully compact at 55% machines, was 60%, for good',
    reward2: 0.55,
    flavor: 'The belt supplier has gone to the Gizmo Festival. Nobody knows when it ends.',
    derivation: '§21 Challenges, §24: 60 tiles is an Act II circuit line\'s (§18) and half again Scarce Belts\' 40, so machines face each other and feed by side intake; 1,000 steel is about 40 min of one S steel module (0.42/s, §18); the reward is the compact player\'s: C full at 0.55 machine tiles a box tile (§10\'s 0.6), about +0.02 of score on a typical box',
  }),
  // ---- Act III (the District)
  headwinds: C({
    id: 'headwinds', name: 'Headwinds', act: 3,
    rule: 'District skiffs fly at half speed this run',
    value: 0.5,
    needs: { counter: 'districtPlaced', text: 'Place a module on the District first, in any run' },
    goal: { k: 'deliver', item: 'robotArm', n: 30 }, goalText: 'Deliver 30 robot arms this run',
    reward: 'District skiffs fly half a tile a second faster, for good',
    reward2: 0.5,
    flavor: 'A wind from the east. The skiffs lean into it and complain.',
    derivation: '§21 Challenges, §24: at half speed a far route carries nearly half (§21 skiffRate), so feeders sit beside what they feed; 30 robot arms is about an hour of a Robot Arm group (0.005-0.01/s, §21); the reward is half Long Skiffs\' tile a second (§21), a quarter of the District\'s 2',
  }),
  shortHaul: C({
    id: 'shortHaul', name: 'Short Haul', act: 3,
    rule: 'District routes fly at most 5 tiles this run',
    value: 5,
    needs: { counter: 'districtPlaced', text: 'Place a module on the District first, in any run' },
    goal: { k: 'deliver', item: 'sandwichEngineer', n: 10 }, goalText: 'Deliver 10 Sandwich Engineers this run',
    reward: 'Every route takes 2 more skiffs, for good',
    reward2: 2,
    flavor: 'The skiff pilots\' union has discovered the word "commute".',
    derivation: '§21 Challenges, §24: five tiles is a group\'s own neighbourhood on the 12x10 District, so the Engineer chain is laid as one cluster; 10 Engineers is about 1-1.5 h of an Engineer group (0.002-0.003/s, §21); the reward is two skiffs on a route that was full at 12 (§21), a sixth more on a far feeder',
  }),
  zoningFreeze: C({
    id: 'zoningFreeze', name: 'Zoning Freeze', act: 3,
    rule: 'No District lots can be bought this run',
    needs: { counter: 'districtPlaced', text: 'Place a module on the District first, in any run' },
    goal: { k: 'order', id: 'specimens' }, goalText: 'Fill Unit 7\'s Specimen Drawer',
    reward: 'District lots cost 20% less, for good',
    reward2: 0.8,
    flavor: 'The planning committee is three raccoons. They have frozen everything, including lunch.',
    derivation: '§21 Challenges, §24: the Specimen Drawer wants ten each of eight tier 3 goods (§21 Orders), eight groups on the District\'s first 12x10; the reward is a fifth off each lot (linear lot prices, §21), for a player who packed eight groups into the first width',
  }),
  // ---- Act IV (the World)
  roughSeas: C({
    id: 'roughSeas', name: 'Rough Seas', act: 4,
    rule: 'World barges carry half a load (1 a trip) this run',
    value: 0.5,
    needs: { counter: 'worldPlaced', text: 'Place a module on the World first, in any run' },
    goal: { k: 'standing', floor: 'world', n: 10 }, goalText: 'Stand 10 modules on the World at once',
    reward: 'World barges carry one more a trip, for good',
    reward2: 1,
    flavor: 'The cloud sea is choppy. The barges are carrying one thing each and holding on to it.',
    derivation: '§21 Challenges, §24: a barge carries 2 a trip (§22), so at 1 every route needs twice the barges; 10 World groups is about half a first World (§23: 20-25 by the Last Fold); the reward is half again a barge\'s load, as Bramble\'s Skiff Club is on the District (§21)',
  }),
  lightFleet: C({
    id: 'lightFleet', name: 'Light Fleet', act: 4,
    rule: 'At most 3 skiffs, barges or couriers a route this run',
    value: 3,
    needs: { counter: 'worldPlaced', text: 'Place a module on the World first, in any run' },
    goal: { k: 'counter', name: 'megaStages', n: 1 }, goalText: 'Finish a Megaproject stage this run',
    reward: 'Skiffs, barges and couriers load and unload in 3/4 the time, for good',
    reward2: 0.75,
    flavor: 'The fleet is in for repairs. Three of everything are still flying. Mostly.',
    derivation: '§21 Challenges, §24: three skiffs where the busiest routes run 6-12 (§21) means a Bay\'s feeders stand beside it; a Lighthouse or Sky Anchor stage is about an island\'s 2-4 h (§22); the reward is a quarter off the dwell (§21 skiffRate), half of what the Lighthouse\'s Beacon gives (§22)',
  }),
};

/** Challenges open after the first Reorganize (the Reorganize card offers them). */
export const CHALLENGE_AFTER_RUNS = 1;
