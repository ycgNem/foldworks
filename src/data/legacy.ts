// The Legacy tree (DESIGN.md §22, reset layer 2): what Relocate's Legacy buys. Pillar 2: Legacy
// automates layer 1. Its nodes take the chores of the Reorganize loop (spending Patents, choosing
// when to reset, refolding kept designs, placing the District, filling orders) and hand them to
// the town, and soften one island rule each. Flat prices with prerequisites, never a growing price
// (CLAUDE.md), and no node is "+X% everything" (PLAN.md): every one is a rule or an automation.
import type { WorldId } from './worlds';

export const LEGACY_IDS = [
  // the next world starts further on
  'patentPurse', 'oldHabits', 'secondNature', 'townArchive', 'standingCharts',
  // automation of layer 1
  'patentClerk', 'standingCommittee', 'regrader', 'townPlan', 'contractRunners', 'skiffGuild', 'longerDrawer', 'groupDrawer',
  // one softener per island rule
  'skyMoorings', 'heatShields', 'warmHands', 'salvageCrews',
] as const;
export type LegacyId = (typeof LEGACY_IDS)[number];

export type LegacyBranch = 'start' | 'auto' | 'soften';

export type LegacyEffect =
  /** each Relocate starts the new island with this many Patents */
  | { k: 'purse'; patents: number }
  /** Patent nodes chosen to keep through a Relocate */
  | { k: 'habits'; slots: number }
  /** every run starts knowing every research node of Act I */
  | { k: 'archive' }
  /** once the World floor has stood in this world, every later run here knows Charting */
  | { k: 'charts' }
  /** open Patent nodes are bought as Patents allow, in the tree's order */
  | { k: 'clerk' }
  /** Reorganize by itself when the preview reaches the number the player sets */
  | { k: 'standing' }
  /** kept designs unfold, are audited and refold by themselves at a run's start */
  | { k: 'regrader' }
  /** kept District layouts are placed again, routes and all, as copies of their groups exist */
  | { k: 'townPlan'; plans: number }
  /** every special order on offer fills from every Dock's sales at once */
  | { k: 'runners' }
  /** a route starts with a second skiff (or barge), free */
  | { k: 'skiffGuild' }
  /** the Patent Drawer holds more designs */
  | { k: 'drawer'; add: number }
  /** the Patent Drawer keeps nested Factory designs (as layouts of their groups) */
  | { k: 'groupDrawer' }
  /** an island's rule, softened */
  | { k: 'soften'; world: WorldId };

export interface LegacyDef {
  id: LegacyId;
  name: string;
  branch: LegacyBranch;
  /** Legacy, flat */
  cost: number;
  requires: LegacyId[];
  effect: LegacyEffect;
  /** what it does, as a row of rich-text markup (docs/hud-180.md) */
  text: string;
  flavor: string;
  /** where it sits on the tree screen: column and row within its branch */
  pos: [number, number];
  derivation: string;
}

const L = (d: LegacyDef) => d;

export const LEGACY: Record<LegacyId, LegacyDef> = {
  // ---------------------------------------------------------------- the next world starts further on
  patentPurse: L({
    id: 'patentPurse', name: 'The Patent Purse', branch: 'start', cost: 4, requires: [], pos: [0, 0],
    effect: { k: 'purse', patents: 10 },
    text: '{u:relocate} every island starts with {good:10} Patents',
    flavor: 'Sewn into the lining. The Committee knows where.',
    derivation: '§22 The Legacy tree: 10 Patents are the head starts of Act I and most of Act II (the 13 head-start nodes cost 15, §19), so a new island\'s first hour is a choice of head starts, not the slice again; 4 Legacy, the cheapest node, about a sixth of the first Relocate',
  }),
  oldHabits: L({
    id: 'oldHabits', name: 'Old Habits', branch: 'start', cost: 5, requires: [], pos: [0, 1],
    effect: { k: 'habits', slots: 4 },
    text: '{u:relocate} keep {good:4} Patent nodes you choose through a Relocate',
    flavor: 'Some things you never unlearn. Like the Shovel Frog.',
    derivation: '§22 The Legacy tree: four nodes, about the rules and automation a player misses most (the Surveyor\'s Charter, Quick Audits, the Draughtsman, the Dispatcher), chosen on the Relocate card',
  }),
  secondNature: L({
    id: 'secondNature', name: 'Second Nature', branch: 'start', cost: 7, requires: ['oldHabits'], pos: [1, 1],
    effect: { k: 'habits', slots: 12 },
    text: '{u:relocate} keep {good:12} Patent nodes through a Relocate, was 4',
    flavor: 'The town forgets where it put the island, but not how to fold.',
    derivation: '§22 The Legacy tree: twelve nodes, a third of the 39-node Patent tree: the Relocate still resets most of it (Patents are re-earned on every world, the record on file starts empty)',
  }),
  townArchive: L({
    id: 'townArchive', name: 'The Town Archive', branch: 'start', cost: 8, requires: ['patentPurse'], pos: [1, 0],
    effect: { k: 'archive' },
    text: '{u:reset} every run starts knowing all of Act I\'s research',
    flavor: 'Ten drawers of notes, three of them about Gizmos.',
    derivation: '§22 The Legacy tree: Act I\'s ten nodes are the slice\'s 30-40 min of research (§16) in every run of every world, the head starts of the Patent tree\'s first branch without their Patents',
  }),
  standingCharts: L({
    id: 'standingCharts', name: 'Standing Charts', branch: 'start', cost: 7, requires: ['townArchive'], pos: [2, 0],
    effect: { k: 'charts' },
    text: '{u:world} once the World floor has stood in this world · every later run here starts knowing {research:Charting}',
    flavor: 'The map is pinned to the wall. The wall is pinned to the island.',
    derivation: '§22 The Legacy tree: Charting is the World floor\'s 30-40 min of District goods (§22 Research); it is known only in a world where it was researched once, so a new island is climbed in full',
  }),
  // ---------------------------------------------------------------- automation of layer 1
  patentClerk: L({
    id: 'patentClerk', name: 'The Patent Clerk', branch: 'auto', cost: 6, requires: [], pos: [0, 0],
    effect: { k: 'clerk' },
    text: '{u:patent} buys open Patent nodes as your Patents allow · in the tree\'s order · every 5 s',
    flavor: 'Stamps everything twice, to be sure.',
    derivation: '§22 The Legacy tree: pillar 2, the Patent tree\'s spending becomes the town\'s; it buys in the tree\'s own order (head starts first), so a purse and a Reorganize\'s Patents go to work without a visit to the tree',
  }),
  standingCommittee: L({
    id: 'standingCommittee', name: 'The Standing Committee', branch: 'auto', cost: 10, requires: ['patentClerk'], pos: [1, 0],
    effect: { k: 'standing' },
    text: '{u:reset} Reorganizes by itself when the preview reaches the Patents you set',
    flavor: 'Three raccoons, one gavel. They take turns.',
    derivation: '§22 The Legacy tree: pillar 2, the reset itself is automated (ROADMAP Milestone 9: "reset when Patents gained >= X"); it waits for an audit to finish, never runs during a Challenge, and the number is the player\'s (pillar 4: a reset is still the player\'s choice, made once in advance); the dearest node, as the deepest automation',
  }),
  regrader: L({
    id: 'regrader', name: 'The Regrader', branch: 'auto', cost: 9, requires: [], pos: [0, 1],
    effect: { k: 'regrader' },
    text: '{u:fold} kept designs unfold, audit and fold by themselves at a run\'s start · as land, research and coin allow',
    flavor: 'Re-reads every line and signs off on it. Twice, if it is cold.',
    derivation: '§22 The Legacy tree: pillar 2, the Patent Drawer\'s chore (unfold, audit, fold) becomes the town\'s; a kept layout that still suits the island refolds after the 10 s check (§19), one that does not (a Rime line run cold, a box under rubble) gets a full audit at its new grade, or waits',
  }),
  townPlan: L({
    id: 'townPlan', name: 'The Town Plan', branch: 'auto', cost: 9, requires: ['regrader'], pos: [1, 1],
    effect: { k: 'townPlan', plans: 2 },
    text: '{u:district} keep {good:2} District layouts · each run places them again, routes and skiffs, as copies of their groups exist',
    flavor: 'Drawn on a napkin in the first world. Still the best plan anyone has.',
    derivation: '§22 The Legacy tree: pillar 2, Act III\'s chore (placing groups and flying their routes) becomes the town\'s; a plan names each tile\'s product and its routes, and fills a tile with a spare copy of a design making that product (the best graded), paying the skiffs, so a world\'s District rebuilds itself as its groups are folded',
  }),
  contractRunners: L({
    id: 'contractRunners', name: 'Contract Runners', branch: 'auto', cost: 7, requires: [], pos: [0, 2],
    effect: { k: 'runners' },
    text: '{u:orders} every special order on offer fills from every Dock\'s sales at once',
    flavor: 'Small, fast, and paid in sandwiches.',
    derivation: '§22 The Legacy tree: pillar 2, "contracts" (PLAN.md): orders stop being one at a time, and a floor\'s order (the Festival) counts every Dock; it takes only what the Docks would sell, so it pays what the orders pay and never more',
  }),
  skiffGuild: L({
    id: 'skiffGuild', name: 'The Skiff Guild', branch: 'auto', cost: 5, requires: [], pos: [1, 2],
    effect: { k: 'skiffGuild' },
    text: '{u:district} a route starts with {good:2} skiffs (or barges) · the Guild\'s is free and stays with the route',
    flavor: 'Members get a hat and a second skiff. The hat is better.',
    derivation: '§22 The Legacy tree: a route\'s second skiff free on every floor: since the second gate\'s 1-a-trip skiffs a route of finished goods across the floor wants two (§21), so the Guild saves a decision a route, not a rate',
  }),
  longerDrawer: L({
    id: 'longerDrawer', name: 'A Longer Drawer', branch: 'auto', cost: 4, requires: [], pos: [2, 1],
    effect: { k: 'drawer', add: 4 },
    text: '{u:fold} the Patent Drawer holds {good:4} more designs',
    flavor: 'It goes back further than the wall. Do not ask.',
    derivation: '§22 The Legacy tree: four more kept designs, so a world\'s best lines and an island\'s own lines (a Rime cluster, a Cinder vent line) both fit',
  }),
  groupDrawer: L({
    id: 'groupDrawer', name: 'The Group Drawer', branch: 'auto', cost: 6, requires: ['longerDrawer'], pos: [2, 2],
    effect: { k: 'groupDrawer' },
    text: '{u:fold} the Patent Drawer keeps nested Factory designs · they unfold as copies of their modules exist',
    flavor: 'A drawer inside the drawer. The Patent Office approves.',
    derivation: '§22 The Legacy tree (docs/endgame.md: the Group Drawer, for good): a nested design is kept as the layout of its group, each tile named by its product; it unfolds onto the Factory floor from spare copies of this run\'s designs of those products, so it saves the layout, never the folds',
  }),
  // ---------------------------------------------------------------- one softener per island rule
  skyMoorings: L({
    id: 'skyMoorings', name: 'Sky Moorings', branch: 'soften', cost: 4, requires: [], pos: [0, 0],
    effect: { k: 'soften', world: 'pebble' },
    text: '{u:land} on Pebble Isle chunk F is moored land · for sale as at Home',
    flavor: 'A very long rope and a very patient frog.',
    derivation: '§22 The Legacy tree: Pebble keeps C and D as sky; F\'s coal and iron are back for its usual price (§18), so Act II\'s steel stops waiting on one iron deposit',
  }),
  heatShields: L({
    id: 'heatShields', name: 'Heat Shields', branch: 'soften', cost: 4, requires: [], pos: [1, 0],
    effect: { k: 'soften', world: 'cinder' },
    text: '{u:power} on Cinder Isle crates, splitters and mergers stand beside a vent · belts still melt',
    flavor: 'Asbestos-free. We checked. Twice.',
    derivation: '§22 The Legacy tree: a vent\'s cluster can take one input from a crate or a splitter beside it, but its feed still cannot be belted in, so the rule\'s layout stands',
  }),
  warmHands: L({
    id: 'warmHands', name: 'Warm Hands', branch: 'soften', cost: 4, requires: [], pos: [2, 0],
    effect: { k: 'soften', world: 'rime' },
    text: '{u:power} on Rime one working machine touching is warmth enough, was 2',
    flavor: 'Knitted by Bramble. Each one slightly the wrong size.',
    derivation: '§22 The Legacy tree: a pair of machines facing each other keeps both warm, so a straight line runs warm and only a lone machine wants a Heater',
  }),
  salvageCrews: L({
    id: 'salvageCrews', name: 'Salvage Crews', branch: 'soften', cost: 4, requires: [], pos: [3, 0],
    effect: { k: 'soften', world: 'oldworks' },
    text: '{u:land} on the Old Works ruins repair for nothing · and repairing one clears the rubble around it',
    flavor: 'They work for the scrap. And the stories.',
    derivation: '§22 The Legacy tree: the ruins are free and their eight neighbours cleared, so the whole lines run from the first minute; the rest of the rubble stays',
  }),
};

export const LEGACY_LIST: LegacyDef[] = LEGACY_IDS.map((id) => LEGACY[id]);

export const LEGACY_BRANCHES: Record<LegacyBranch, string> = { start: 'Head starts', auto: 'Automation', soften: 'Islands' };
