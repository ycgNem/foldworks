// The Patent tree (DESIGN.md §19, Milestone 5): what Reorganize's Patents buy. Four branches:
// head starts (the next run begins further on), rules (how the factory works changes), automation
// (a chore of this layer becomes a machine's: pillar 2) and offline efficiency (up to 0.75). Every
// price is flat, with prerequisites instead of a growing price (CLAUDE.md: no geometric price
// curves), and no node is a bare "+X% everything" (PLAN.md). Every number has a derivation.
import type { ResearchId } from './research';
import type { UpgradeId } from './machines';

export const PATENT_IDS = [
  // head starts
  'bellows', 'starterLine', 'notebooks', 'copperDeeds', 'gearPatterns', 'gizmoPatent', 'foldingPatent', 'grant',
  'overdriveHabit', 'coalRights', 'steelCharter', 'glassNotes', 'circuitPatent',
  // rules
  'surveyCharter', 'widerBox', 'quickAudit', 'moreAuditors', 'sideIntake', 'nestedBoxes', 'freshDies',
  // automation
  'shovelFrog', 'labAssistant', 'orderClerk', 'stampPress', 'draughtsman', 'drawerSpace',
  // offline
  'nightShift', 'nightWatch', 'lightsOn',
] as const;
export type PatentId = (typeof PATENT_IDS)[number];

export type PatentBranch = 'head' | 'rule' | 'auto' | 'offline';

/** What a node does. Head starts apply to the run they are bought in, at once, and at the start of
 * every run after; rules, automation and offline apply at once. */
export type PatentEffect =
  | { k: 'head'; upgrades?: UpgradeId[]; research?: ResearchId[]; land?: string[]; coin?: number; place?: { kind: 'miner'; x: number; y: number; rot: 0 | 1 | 2 | 3 }[] }
  | { k: 'foldMax'; value: number }
  | { k: 'audit'; warmup: number; span: number }
  | { k: 'maxAudits'; value: number }
  | { k: 'sideIntake' }
  | { k: 'halfClaims' }
  | { k: 'nestedMax'; value: number }
  | { k: 'freshDies' }
  | { k: 'shovel'; every: number }
  | { k: 'lab' }
  | { k: 'clerk' }
  | { k: 'stampPress'; every: number }
  | { k: 'draughtsman'; every: number }
  | { k: 'drawer'; add: number }
  | { k: 'offline'; add: number };

export interface PatentDef {
  id: PatentId;
  name: string;
  branch: PatentBranch;
  /** Patents, flat */
  cost: number;
  requires: PatentId[];
  effect: PatentEffect;
  /** what it does, in a line */
  text: string;
  flavor: string;
  /** where it sits on the tree screen: column and row within its branch */
  pos: [number, number];
  derivation: string;
}

const P = (d: PatentDef) => d;

export const PATENTS: Record<PatentId, PatentDef> = {
  // ---------------------------------------------------------------- head starts
  // Each is priced at about a Patent per 10-15 minutes of the first run it saves (1 at the least):
  // the designed first run files about 3.6 Patents an hour (§19), so a node pays back its price in
  // the minutes it saves over two or three runs. The tree is 40 Patents in all (it was 55): the
  // designed campaign banks about 31 by the end of its third run (11-12 h), most of the tree, and
  // all of it in the fourth (the review round: buy most of it in 5-15 h).
  bellows: P({
    id: 'bellows', name: 'Bellows on the Bench', branch: 'head', cost: 1, requires: [], pos: [0, 0],
    effect: { k: 'head', upgrades: ['bellows'] },
    text: 'Every run starts with the Bellows: the Hand Furnace runs itself.',
    flavor: 'You kept the bellows. Of course you kept the bellows.',
    derivation: '§19 Patent tree: head starts; 1 Patent (the least), the 20 s of cranking §6 measures (§13 check 1)',
  }),
  starterLine: P({
    id: 'starterLine', name: 'A Miner on the Patch', branch: 'head', cost: 1, requires: ['bellows'], pos: [1, 0],
    effect: { k: 'head', place: [{ kind: 'miner', x: 2, y: 3, rot: 0 }] },
    text: 'Every run starts with a Miner feeding the Hand Furnace: hands-free from the first second.',
    flavor: 'It was still warm when you came back.',
    derivation: '§19 Patent tree: head starts; 1 Patent (the least), the first 47 s of hand-mining (§13 check 2)',
  }),
  notebooks: P({
    id: 'notebooks', name: 'Old Notebooks', branch: 'head', cost: 1, requires: ['starterLine'], pos: [2, 0],
    effect: { k: 'head', research: ['pressing', 'surveyEast'] },
    text: 'Pressing and Survey East are known from the start.',
    flavor: 'Smudged, dog-eared, mostly correct.',
    derivation: '§19 Patent tree: head starts; 1 Patent, about 5 min of the first run (§13 checks 3-4)',
  }),
  copperDeeds: P({
    id: 'copperDeeds', name: 'Copper Deeds', branch: 'head', cost: 1, requires: ['notebooks'], pos: [3, 0],
    effect: { k: 'head', land: ['B'], research: ['copperSmelting', 'wireDrawing'] },
    text: 'Chunk B is yours from the start, and copper smelting and wire drawing are known.',
    flavor: 'The frogs never asked for the land back. Frogs are like that.',
    derivation: '§19 Patent tree: head starts; 1 Patent, chunk B (1,000) and two nodes, about 6 min of the first run (§13 check 4)',
  }),
  gearPatterns: P({
    id: 'gearPatterns', name: 'Gear Patterns', branch: 'head', cost: 1, requires: ['notebooks'], pos: [3, 1],
    effect: { k: 'head', research: ['gearcutting', 'splitters', 'buffers'] },
    text: 'Gearcutting, Splitters & Mergers and Buffers are known from the start.',
    flavor: 'Teeth drawn to scale, on a napkin.',
    derivation: '§19 Patent tree: head starts; 1 Patent, three nodes (about 500 plates and gears of deliveries, 5-6 min; Slag Bricks stays a choice: a press set to nothing would pick bricks from the first slag it met)',
  }),
  gizmoPatent: P({
    id: 'gizmoPatent', name: 'The Gizmo Patent', branch: 'head', cost: 1, requires: ['copperDeeds', 'gearPatterns'], pos: [4, 0],
    effect: { k: 'head', research: ['gizmoTheory'] },
    text: 'Gizmo Theory is known from the start (and chunk C can be bought at once).',
    flavor: 'Nobody knows what it does. Now nobody else is allowed to make one.',
    derivation: '§19 Patent tree: head starts; 1 Patent, 120 gears and 300 wire of deliveries, about 5 min',
  }),
  foldingPatent: P({
    id: 'foldingPatent', name: 'Folding, Remembered', branch: 'head', cost: 1, requires: ['gizmoPatent'], pos: [5, 0],
    effect: { k: 'head', research: ['folding'] },
    text: 'Folding is known from the start: fold the first line the moment it runs.',
    flavor: 'Your hands know the creases.',
    derivation: '§19 Patent tree: head starts; 1 Patent (was 2: the tree repriced so most of it is bought in 5-15 h, the review round), the dearest Act I node (50 Gizmos, 500 gears: §13 check 6), about 10 min',
  }),
  grant: P({
    id: 'grant', name: "Founders' Grant", branch: 'head', cost: 1, requires: ['bellows'], pos: [1, 1],
    effect: { k: 'head', coin: 2000 },
    text: 'Every run starts with 2,000 coin.',
    flavor: 'Bramble insists it is a loan. Bramble has no ledger.',
    derivation: '§19 Patent tree: head starts; 1 Patent, 2,000 coin, about what the Act I planner has earned by chunk B (1,000 at 9:20, §13 measured) and the gear lines after it, some 5 min; a flat sum, never scaled by anything (flagged derivative: DECISIONS.md)',
  }),
  overdriveHabit: P({
    id: 'overdriveHabit', name: 'Overdrive by Habit', branch: 'head', cost: 1, requires: ['bellows'], pos: [2, 1],
    effect: { k: 'head', research: ['overdrive'] },
    text: 'Overdrive is known from the start: click any machine (or module) to run its line 3x for 10 s.',
    flavor: 'Your finger twitches toward the big red lever.',
    derivation: '§19 Patent tree: head starts; 1 Patent, Act II active play (§18 Overdrive) from the first minute, the click lever of §16 rule 4',
  }),
  coalRights: P({
    id: 'coalRights', name: 'Coal Rights', branch: 'head', cost: 1, requires: ['foldingPatent'], pos: [6, 0],
    effect: { k: 'head', research: ['coalSeams'], land: ['E'] },
    text: 'Coal Seams is known and chunk E (coal, sand) is yours from the start.',
    flavor: 'Signed in coal dust, witnessed by a heron.',
    derivation: '§19 Patent tree: head starts; 1 Patent (was 2, the review round\'s repricing), chunk E (60,000) and 600 gears of research, about 10-15 min of early Act II',
  }),
  steelCharter: P({
    id: 'steelCharter', name: 'Steel Charter', branch: 'head', cost: 1, requires: ['coalRights'], pos: [7, 0],
    effect: { k: 'head', research: ['steelmaking', 'steamPower'], land: ['F'] },
    text: 'Steelmaking and Steam Power are known and chunk F is yours from the start.',
    flavor: 'Dame Voltaire framed her copy.',
    derivation: '§19 Patent tree: head starts; 1 Patent (was 2, the review round\'s repricing), chunk F (120,000) and two nodes: 9-12 min of the first run, measured (the Milestone 5 review; it was priced at 4 for 25 min)',
  }),
  glassNotes: P({
    id: 'glassNotes', name: 'Glass and Gravel Notes', branch: 'head', cost: 2, requires: ['steelCharter'], pos: [8, 0],
    effect: { k: 'head', research: ['glassworks', 'crushing', 'refining', 'machineKits'] },
    text: 'Glassworks, Crushing, Refining and Machine Kits are known from the start.',
    flavor: 'The pages are stuck together with something. Possibly plastic.',
    derivation: '§19 Patent tree: head starts; 2 Patents (was 3, the review round\'s repricing), four Act II nodes, about 15-20 min of the first run between them (§18 targets)',
  }),
  circuitPatent: P({
    id: 'circuitPatent', name: 'Circuit Patent', branch: 'head', cost: 2, requires: ['glassNotes'], pos: [9, 0],
    effect: { k: 'head', research: ['circuits', 'concrete'] },
    text: 'Circuits and Concrete are known from the start.',
    flavor: 'It thinks, therefore you own it.',
    derivation: '§19 Patent tree: head starts; 2 Patents (was 3, the review round\'s repricing), the two nodes that gate Act II goods (§18 targets: circuits by S+60, concrete after), about 15-20 min',
  }),
  // ---------------------------------------------------------------- rules: each one a rule a player plans around
  surveyCharter: P({
    id: 'surveyCharter', name: "Surveyor's Charter", branch: 'rule', cost: 2, requires: [], pos: [0, 0],
    effect: { k: 'halfClaims' },
    text: 'A copy of a source design graded S or S+ holds half a claim on each ore it digs.',
    flavor: 'A clean dig is a small dig. The map agrees.',
    derivation: '§19 Patent tree: rules, 2 Patents (was 3, the review round\'s repricing); §18 claims (one per ore per copy) -> half for a design graded S or better: twice the copies of a well-folded source line, none more of a sloppy one, so the audit grade decides the floor. It was +2 claims on every ore, a multiplier in disguise (the Milestone 5 review)',
  }),
  widerBox: P({
    id: 'widerBox', name: 'Wider Fold Box', branch: 'rule', cost: 1, requires: [], pos: [0, 1],
    effect: { k: 'foldMax', value: 10 },
    text: 'The fold box is up to 10x10 (was 8x8): longer lines fold into one module.',
    flavor: 'Bigger paper. Same creases.',
    derivation: '§19 Patent tree: rules, 1 Patent (was 2); §10 fold box 8 -> 10, a line with its power plant inside (§18: power never crosses a box) fits, so a deeper line folds whole (more steps filed)',
  }),
  quickAudit: P({
    id: 'quickAudit', name: 'Quick Audits', branch: 'rule', cost: 1, requires: [], pos: [1, 0],
    effect: { k: 'audit', warmup: 5, span: 40 },
    text: 'An audit takes 45 s (5 s warm-up, a 40 s window) instead of 70 s.',
    flavor: 'The auditors learned to count faster. Or skip.',
    derivation: '§19 Patent tree: rules, 1 Patent (was 2); §10 audit 10 + 60 s -> 5 + 40 s: a later run folds its lines again to file better ones, and the wait is this layer\'s chore',
  }),
  moreAuditors: P({
    id: 'moreAuditors', name: 'More Auditors', branch: 'rule', cost: 1, requires: ['quickAudit'], pos: [2, 0],
    effect: { k: 'maxAudits', value: 5 },
    text: 'Up to 5 Workshop lines audited at once (was 3).',
    flavor: 'Two more clipboards. Same frog.',
    derivation: '§19 Patent tree: rules, 1 Patent (was 2); §10 audits at once 3 -> 5',
  }),
  sideIntake: P({
    id: 'sideIntake', name: 'Side Intakes', branch: 'rule', cost: 2, requires: ['widerBox'], pos: [1, 1],
    effect: { k: 'sideIntake' },
    text: 'A module also takes its inputs from a trunk pointing into its left side: one more port.',
    flavor: 'A second door. Do knock.',
    derivation: '§19 Patent tree: rules, 2 Patents (was 3); §11 one input side -> two (ROADMAP Milestone 5: +1 port per module)',
  }),
  nestedBoxes: P({
    id: 'nestedBoxes', name: 'Nested Boxes', branch: 'rule', cost: 2, requires: ['widerBox'], pos: [2, 1],
    effect: { k: 'nestedMax', value: 8 },
    text: 'A nested fold on the Factory floor boxes up to 8x8 (was 6x6).',
    flavor: 'A box in a box in a slightly bigger box.',
    derivation: '§19 Patent tree: rules, 2 Patents (was 3); §18 Nested folds 6 -> 8, a whole Bay floor group (BAY_PLAN is 8x8): a deeper fold, more steps filed',
  }),
  freshDies: P({
    id: 'freshDies', name: 'Fresh Dies', branch: 'rule', cost: 1, requires: [], pos: [0, 2],
    effect: { k: 'freshDies' },
    text: 'A line refolded at a better grade than every earlier design of its product starts its stamp price over.',
    flavor: 'New dies, sharp edges, first-copy prices.',
    derivation: '§19 Patent tree: rules, 1 Patent (was 2); §10 Stamp counts every copy of a product; with this, only the designs graded as well as the one stamped, so a better refold is cheap to copy (still bill x (1 + 0.5 n), linear). It was Stamping Dies, a lower growth (0.3): a number, not a rule (the Milestone 5 review)',
  }),
  // ---------------------------------------------------------------- automation (pillar 2)
  shovelFrog: P({
    id: 'shovelFrog', name: 'The Shovel Frog', branch: 'auto', cost: 1, requires: [], pos: [0, 0],
    effect: { k: 'shovel', every: 1 },
    text: 'A frog shovels one jammed machine clear of its byproduct every second.',
    flavor: 'He works for flies. He is very good.',
    derivation: '§19 Patent tree: automation; the shovel click of §6, one a second (a player at 4 clicks/s keeps a few lines clear)',
  }),
  labAssistant: P({
    id: 'labAssistant', name: 'Lab Assistant', branch: 'auto', cost: 1, requires: [], pos: [0, 1],
    effect: { k: 'lab' },
    text: 'With no research selected, the node the Hopper bank pays most of is picked for you.',
    flavor: 'Wears goggles. Has never needed them.',
    derivation: '§19 Patent tree: automation; selecting research (§8), checked once a second',
  }),
  orderClerk: P({
    id: 'orderClerk', name: 'Order Clerk', branch: 'auto', cost: 1, requires: [], pos: [1, 1],
    effect: { k: 'clerk' },
    text: 'With no special order active, the first one offered is accepted for you.',
    flavor: 'Stamps everything APPROVED. Has a stamp for that.',
    derivation: '§19 Patent tree: automation; accepting orders (§7), checked once a second',
  }),
  stampPress: P({
    id: 'stampPress', name: 'Stamp Press', branch: 'auto', cost: 2, requires: ['orderClerk'], pos: [2, 1],
    effect: { k: 'stampPress', every: 5 },
    text: 'Designs you mark "keep one spare" are stamped for you, the cheapest first, every 5 s while affordable.',
    flavor: 'Ka-chunk. Ka-chunk. Ka-chunk.',
    derivation: '§19 Patent tree: automation, 2 Patents (was 3); the stamp of §10 at its full price, one every 5 s at most',
  }),
  draughtsman: P({
    id: 'draughtsman', name: 'The Draughtsman', branch: 'auto', cost: 2, requires: ['shovelFrog'], pos: [1, 0],
    effect: { k: 'draughtsman', every: 5 },
    text: 'Designs you queue in the Patent Drawer are unfolded for you, in your order, as land, research and coin allow.',
    flavor: 'A heron with a pencil behind its ear. It never smudges.',
    derivation: '§19 The Patent Drawer, 2 Patents (was 3): rebuilding a kept line each run is this layer\'s chore (pillar 2); one unfold every 5 s at most, at the full bill, in the order the player set, each where it was folded',
  }),
  drawerSpace: P({
    id: 'drawerSpace', name: 'A Deeper Drawer', branch: 'auto', cost: 1, requires: ['draughtsman'], pos: [2, 0],
    effect: { k: 'drawer', add: 4 },
    text: 'The Patent Drawer keeps 4 more designs (12 in all).',
    flavor: 'It sticks. Jiggle it.',
    derivation: '§19 The Patent Drawer, 1 Patent (was 2): 8 -> 12 kept designs, room for every Act II product line (the Act II bot folds nine products)',
  }),
  // ---------------------------------------------------------------- offline (DESIGN.md §12, §20)
  nightShift: P({
    id: 'nightShift', name: 'Graveyard Shift', branch: 'offline', cost: 2, requires: [], pos: [0, 0],
    effect: { k: 'offline', add: 0.05 },
    text: 'Offline efficiency +5% (on top of 0.5 and the Night Shift you buy with coin).',
    flavor: 'The owls clock in.',
    derivation: '§19 Patent tree: offline; §20: 0.5, the Night Shift bought with coin (+0.1), and three nodes of +0.05 make 0.75 exactly, the ceiling',
  }),
  nightWatch: P({
    id: 'nightWatch', name: 'Night Watch', branch: 'offline', cost: 2, requires: ['nightShift'], pos: [1, 0],
    effect: { k: 'offline', add: 0.05 },
    text: 'Offline efficiency +5% more.',
    flavor: 'A lantern on every line.',
    derivation: '§19 Patent tree: offline; the second of three +0.05 steps to the 0.75 ceiling (§20)',
  }),
  lightsOn: P({
    id: 'lightsOn', name: 'Lights Left On', branch: 'offline', cost: 3, requires: ['nightWatch'], pos: [2, 0],
    effect: { k: 'offline', add: 0.05 },
    text: 'Offline efficiency +5% more: 0.75 with the Night Shift, the ceiling.',
    flavor: 'Voltaire sends the bill. You pay it gladly.',
    derivation: '§19 Patent tree: offline; the last +0.05: 0.5 + 0.1 (coin) + 0.15 (Patents) = 0.75, the ceiling: offline never pays as much as being there (§13 check 12, §20)',
  }),
};

export const PATENT_LIST: PatentDef[] = PATENT_IDS.map((id) => PATENTS[id]);

export const BRANCH_NAMES: Record<PatentBranch, string> = { head: 'Head starts', rule: 'Rules', auto: 'Automation', offline: 'Offline' };
