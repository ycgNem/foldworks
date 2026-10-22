// The Kernel tree (DESIGN.md §23, reset layer 3): what the Last Fold's Kernels buy. Kernels change
// the base rules (PLAN.md): how much a belt carries, which sides of a module are ports, how big a
// fold box is, how many floors there are, which recipes exist, how honest a night away pays. Flat
// prices with a prerequisite or two, never a growing price (CLAUDE.md), and no node is "+X%
// everything" (PLAN.md): each one is a rule the next universe is built under.
// The Endless Ledger's orders (§23) are data here too: the products in turn, their base amounts and
// the cosmetics every tenth order pays.
import type { ItemId } from './items';

export const KERNEL_IDS = [
  // the rules of the floors
  'wideBelts', 'everySide', 'biggerBox', 'secondCookbook',
  // further up and further on
  'beyond', 'endlessLedger', 'seedling',
  // what a universe keeps
  'longNights', 'keptIslands', 'keptLegacy',
] as const;
export type KernelId = (typeof KERNEL_IDS)[number];

export type KernelBranch = 'rules' | 'reach' | 'kept';

export type KernelEffect =
  /** a belt tile carries two items, half a tile apart */
  | { k: 'wideBelts'; per: number }
  /** a module on the Factory floor takes in and gives out on every side */
  | { k: 'everySide' }
  /** the Workshop fold box */
  | { k: 'foldMax'; value: number }
  /** the alternate recipes flagged `alt` (src/data/recipes.ts) are known */
  | { k: 'cookbook' }
  /** opens the fifth floor, Beyond (with research The Last Fold in the run) */
  | { k: 'beyond' }
  /** the Endless Ledger's infinite orders */
  | { k: 'ledger' }
  /** the Seed digs every this many seconds a side, was RULES.seedSeconds */
  | { k: 'seedling'; seconds: number }
  /** the offline ceiling, and what it adds to the offline efficiency */
  | { k: 'longNights'; ceiling: number; add: number }
  /** the worlds' records survive a Last Fold, and an island's record counts for its world's Legacy */
  | { k: 'keptIslands' }
  /** Legacy nodes chosen to keep through a Last Fold */
  | { k: 'keptLegacy'; slots: number };

export interface KernelDef {
  id: KernelId;
  name: string;
  branch: KernelBranch;
  /** Kernels, flat */
  cost: number;
  requires: KernelId[];
  effect: KernelEffect;
  /** what it does, as a row of rich-text markup (docs/hud-180.md) */
  text: string;
  flavor: string;
  /** where it sits on the tree screen: column and row within its branch */
  pos: [number, number];
  derivation: string;
}

const K = (d: KernelDef) => d;

export const KERNELS: Record<KernelId, KernelDef> = {
  // ---------------------------------------------------------------- the rules of the floors
  wideBelts: K({
    id: 'wideBelts', name: 'Wide Belts', branch: 'rules', cost: 8, requires: [], pos: [0, 0],
    effect: { k: 'wideBelts', per: 2 },
    text: '{u:flow} a belt tile carries {good:2} items, half a tile apart · 240/min a belt',
    flavor: 'Twice the belt. Same frogs.',
    derivation: '§23 The Kernel tree: a belt\'s 120/min (§4) was the Workshop\'s first ratio; at 240 a Miner line feeds a Mk2 (§18) from one belt and a fold box holds half the belt it did, so every Workshop layout is drawn again; 8 Kernels, a third of the first Last Fold (§23 Kernels), the dearest of the rules',
  }),
  everySide: K({
    id: 'everySide', name: 'Every Side a Port', branch: 'rules', cost: 6, requires: [], pos: [1, 0],
    effect: { k: 'everySide' },
    text: '{u:factory} a module takes in from a trunk on {good:any side} · and gives out on any side with a trunk leading away',
    flavor: 'The module has no front any more. It has opinions.',
    derivation: '§23 The Kernel tree: a Factory module took in at its back (and a side with Side Intakes, §19) and gave out at its front (§11); with four ports a trunk network packs modules face to face, so a nested fold box (§18) holds more modules and fewer trunks: a C term the old ports could not reach',
  }),
  biggerBox: K({
    id: 'biggerBox', name: 'The Bigger Box', branch: 'rules', cost: 5, requires: [], pos: [2, 0],
    effect: { k: 'foldMax', value: 12 },
    text: '{u:fold} the Workshop fold box is {good:12×12}, was 8 (10 with the Wider Fold Box)',
    flavor: 'Folds bigger. Still fits in a pocket.',
    derivation: '§23 The Kernel tree: 12x12 is a chunk and a half (§9), a whole tier 3 line with its Chute Mouths\' feeds and its power plant in one box (§21), so one fold files more steps (§19 Filing); under the Patent Drawer\'s 16x16 share string (§19), so every box still travels',
  }),
  secondCookbook: K({
    id: 'secondCookbook', name: 'The Second Cookbook', branch: 'rules', cost: 6, requires: [], pos: [3, 0],
    effect: { k: 'cookbook' },
    text: '{u:research} five alternate recipes · steel from ore · glass from slag · circuits on bricks · plastic from oil · cast gearboxes',
    flavor: 'Found under the first one. Annotated in raccoon.',
    derivation: '§23 The Second Cookbook: five recipes that each change a line\'s shape (a step skipped, a byproduct made an input), learned with the research of their product, so the same products fold from different lines; not counted for chain steps (§19 Filing stays as it was)',
  }),
  // ---------------------------------------------------------------- further up and further on
  beyond: K({
    id: 'beyond', name: 'Beyond', branch: 'reach', cost: 8, requires: [], pos: [0, 0],
    effect: { k: 'beyond' },
    text: '{u:beyond} the fifth floor · World groups fold up to it (research {research:The Last Fold}) · tier 5 research',
    flavor: 'Above the World there is a little more sky. Somebody has to build on it.',
    derivation: '§23 Beyond: the fifth floor (§15: the fifth floor the Kernel tree names), depth-4 modules folded on the World, couriers, its own Dock and Hopper, and the tier 5 research on each island; 8 Kernels, with Wide Belts the dearest node, a third of the first Last Fold',
  }),
  endlessLedger: K({
    id: 'endlessLedger', name: 'The Endless Ledger', branch: 'reach', cost: 2, requires: [], pos: [1, 0],
    effect: { k: 'ledger' },
    text: '{u:ledger} infinite orders · order n wants {good:(n + 1)×} a product in turn · never timed · every tenth pays a cosmetic',
    flavor: 'The last page says "continued overleaf". It always does.',
    derivation: '§23 The Endless Ledger: §16 rule 1 at 100 h needs a next goal forever; 2 Kernels, the cheapest node, so it is the first Last Fold\'s whatever else is bought',
  }),
  seedling: K({
    id: 'seedling', name: 'Seedling', branch: 'reach', cost: 3, requires: [], pos: [2, 0],
    effect: { k: 'seedling', seconds: 2 },
    text: '{u:kernel} the Seed digs every {good:2 s} a side, was 4 · a Miner\'s pace',
    flavor: 'It has started putting out leaves. Ore-shaped leaves.',
    derivation: '§23 The Seed: 2 s a side is a Miner\'s pace (§4), so the Seed feeds four Mk1 lines of four different ores from chunk A: the new universe\'s Act I starts with copper, coal and sand beside the iron',
  }),
  // ---------------------------------------------------------------- what a universe keeps
  longNights: K({
    id: 'longNights', name: 'Long Nights', branch: 'kept', cost: 3, requires: [], pos: [0, 0],
    effect: { k: 'longNights', ceiling: 0.85, add: 0.1 },
    text: '{u:overnight} offline pays up to {good:85%}, was 75% · and {good:+10%} toward it',
    flavor: 'The Seed hums all night. The frogs have stopped complaining.',
    derivation: '§23 The Kernel tree: the offline ceiling (§20) at 0.85 and a tenth added, so a closed game at 100 h pays 0.85 of open idle: still below it (§16 rule 4, offline never pays more than open idle), and nearer it once the whole factory is folded rates',
  }),
  keptIslands: K({
    id: 'keptIslands', name: 'Kept Islands', branch: 'kept', cost: 4, requires: [], pos: [1, 0],
    effect: { k: 'keptIslands' },
    text: '{u:world} the worlds\' records survive a Last Fold · an island\'s record counts for its {u:legacy} Legacy from your first run there',
    flavor: 'The islands remember the town. The town pretends to remember the islands.',
    derivation: '§23 The Kernel tree: each island\'s best fold per floor (§22) is kept and stands as a floor\'s best of a world begun there, so a new universe\'s Relocates pay the folds it made before from the first visit (about 8-10 Legacy a world, §22 Legacy), and a better fold still pays the rise',
  }),
  keptLegacy: K({
    id: 'keptLegacy', name: 'Kept Legacy', branch: 'kept', cost: 6, requires: ['keptIslands'], pos: [2, 0],
    effect: { k: 'keptLegacy', slots: 4 },
    text: '{u:legacy} keep {good:4} Legacy nodes you choose through a Last Fold',
    flavor: 'Some habits survive the end of the world. Mostly the Committee.',
    derivation: '§23 The Kernel tree: four of the 17 Legacy nodes (§22), as Old Habits keeps four Patent nodes through a Relocate: the automation a player misses most (the Clerk, the Committee, the Regrader, the Town Plan) or a head start, chosen on the Last Fold card',
  }),
};

export const KERNEL_LIST: KernelDef[] = KERNEL_IDS.map((id) => KERNELS[id]);

export const KERNEL_BRANCHES: Record<KernelBranch, string> = { rules: 'Rules', reach: 'Further', kept: 'Kept' };

/** The Last Fold's grade bonus, Kernels by the whole-World audit's letter (DESIGN.md §23). */
export const KERNEL_GRADE = {
  bonus: { 'S+': 5, S: 4, A: 3, B: 2, C: 1, D: 0 } as Record<string, number>,
  derivation: '§23 Kernels: the grade of the whole World\'s audit (§10\'s U, W, C over every module, C against the floor\'s free tiles) adds 0-5: one a letter from D, so an S+ World is worth the cheapest node and a half more than a D one; a grade, not a multiplier, so a bigger World always counts for more than a better-graded small one',
};

// ------------------------------------------------------------------ the Endless Ledger

export interface LedgerProduct { item: ItemId; base: number; derivation: string }

/** The products the Ledger wants in turn: order n (from 0) wants (n + 1) x base of LEDGER[n % 8]. */
export const LEDGER: LedgerProduct[] = [
  { item: 'gizmo', base: 300, derivation: '§23 The Endless Ledger: 300 Gizmos, 10-20 min of a Gizmo line (0.25-0.5 a second, §18) at the first order' },
  { item: 'steel', base: 600, derivation: '§23 The Endless Ledger: 600 steel, 10-20 min of a steel module (0.5-1 a second, §18)' },
  { item: 'circuit', base: 200, derivation: '§23 The Endless Ledger: 200 circuits, 10-20 min of a circuit line (0.2-0.3 a second, §18)' },
  { item: 'motor', base: 60, derivation: '§23 The Endless Ledger: 60 motors, 10-20 min of a motor group (0.05-0.1 a second, §18)' },
  { item: 'sensor', base: 40, derivation: '§23 The Endless Ledger: 40 sensors, 10-20 min of a sensor group (0.03-0.06 a second, §21)' },
  { item: 'servo', base: 20, derivation: '§23 The Endless Ledger: 20 servos, 10-20 min of a servo group (0.02-0.03 a second, §21)' },
  { item: 'robotArm', base: 6, derivation: '§23 The Endless Ledger: 6 robot arms, 10-20 min of a Robot Arm group (0.005-0.01 a second, §21)' },
  { item: 'sandwichEngineer', base: 2, derivation: '§23 The Endless Ledger: 2 Engineers, 10-20 min of an Engineer group (0.002-0.003 a second, §21)' },
];

/** What an order pays, as a share of its items' Dock value (they are taken instead of sold). */
export const LEDGER_RULES = {
  pays: 2,
  every: 10,
  derivation: '§23 The Endless Ledger: an order pays twice its items\' Dock value (the special orders\' 2.1x, §18, since the Ledger takes what would have sold: one value back and one more), and every tenth order a cosmetic: always a next goal (§16 rule 1), linear (no curve: CLAUDE.md), never timed (pillar 4)',
};

/** The cosmetics the Ledger pays, every tenth order in turn: machine skin ids (the art's
 * `skin_<id>_<kind>` sheets, drawn in place of `<kind>` when chosen: gilded Miners, candy Presses,
 * starlit Assemblers); after the last, a numbered ribbon (`ribbon<n>`), so there is always a next one. */
export const LEDGER_COSMETICS = ['gilded', 'candy', 'starlit'] as const;
