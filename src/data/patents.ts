// The Patent tree (DESIGN.md §19, Milestone 5): what Reorganize's Patents buy. Four branches:
// head starts (the next run begins further on), rules (how the factory works changes), automation
// (a chore of this layer becomes a machine's: pillar 2) and offline efficiency (up to 0.75). Every
// price is flat, with prerequisites instead of a growing price (CLAUDE.md: no geometric price
// curves), and no node is a bare "+X% everything" (PLAN.md). Every number has a derivation.
import type { ResearchId } from './research';
import type { UpgradeId } from './machines';

export const PATENT_IDS = [
  // head starts
  'copperDeeds', 'coalRights', 'steelCharter', 'overdriveHabit', 'starterLine',
  // rules
  'surveyCharter', 'widerBox', 'quickAudit', 'moreAuditors', 'sideIntake', 'nestedBoxes', 'freshDies',
  // automation
  'shovelFrog', 'labAssistant', 'orderClerk', 'stampPress', 'draughtsman', 'drawerSpace', 'filingCabinet', 'notebooks',
  // offline
  'nightShift', 'nightWatch', 'lightsOn',
  // Act III (DESIGN.md §21)
  'zoningCharter', 'districtDeeds', 'chemNotes', 'bearingPatent', 'senseNotes', 'roboticsPatent',
  'longSkiffs', 'biggerNest', 'wideDistrictBox', 'dispatcher',
] as const;
export type PatentId = (typeof PATENT_IDS)[number];

export type PatentBranch = 'head' | 'rule' | 'auto' | 'offline';

/** What a node does. Head starts apply to the run they are bought in, at once, and at the start of
 * every run after; rules, automation and offline apply at once. */
export type PatentEffect =
  | { k: 'head'; upgrades?: UpgradeId[]; research?: ResearchId[]; land?: string[]; coin?: number; place?: { kind: 'miner'; x: number; y: number; rot: 0 | 1 | 2 | 3 }[]; lots?: number }
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
  // the returning run (the playability pass, DESIGN.md §19): more free copies of every kept design;
  // the Survey Office's claims kept through a Reorganize; the Factory floor laid again
  | { k: 'spareDies'; add: number }
  | { k: 'claimsKept' }
  | { k: 'floorPlan'; every: number }
  | { k: 'offline'; add: number }
  // Act III (DESIGN.md §21)
  | { k: 'skiffSpeed'; add: number }
  | { k: 'highFoldMax'; value: number }
  | { k: 'dispatcher'; every: number };

export interface PatentDef {
  id: PatentId;
  name: string;
  branch: PatentBranch;
  /** Patents, flat */
  cost: number;
  requires: PatentId[];
  effect: PatentEffect;
  /** what it does, as a row of rich-text markup (icons, numbers, no sentence: docs/hud-180.md) */
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
  // designed campaign banks 30 by the end of its third run (14 + 7 + 9, about 10 h of play) and has
  // bought 22 of the 29 nodes, most of the tree in 5-15 h (the review round). Measured in the final
  // round, a fourth run files about 1 in 5 h (everything is on file and the Drill is done), so the
  // last 10 Patents wait for the next floor's goals (Milestone 7), not for the fourth run.
  // The returning run (the playability pass, DESIGN.md §19 "What a Reorganize keeps"): every run
  // after a Reorganize knows Acts I-II's research, has the Factory open and gets its kept designs
  // back as modules, so the old head starts (research, a Miner, the Bellows, 2,000 coin) bought
  // nothing. These nodes buy what a returning run still has to rebuild by hand: the land its
  // claims and boxes sit on, the claims it bought, and more copies of what it kept. Priced at
  // about a Patent per 10-15 min of a run saved (§19), measured on the campaign bot.
  // (Ids are kept from the old tree so a save, the bots and Old Habits still name them; the
  // effects are new. A save from before refunds the old nodes: src/engine/save.ts v13.)
  copperDeeds: P({
    id: 'copperDeeds', name: 'Copper Deeds', branch: 'head', cost: 1, requires: [], pos: [0, 0],
    effect: { k: 'head', land: ['B', 'C'] },
    text: '{u:survey} every run starts owning Chunks B and C · {good:+2} claims a deposit',
    flavor: 'The frogs never asked for the land back. Frogs are like that.',
    derivation: '§19 The returning run: 1 Patent; chunks B and C are 2,000 coin, nothing to a returning run, but their copper and iron deposits are claims (2 each, §18) the kept source designs dig with from the first minute',
  }),
  coalRights: P({
    id: 'coalRights', name: 'Coal Rights', branch: 'head', cost: 1, requires: ['copperDeeds'], pos: [1, 0],
    effect: { k: 'head', land: ['D', 'E'] },
    text: '{u:survey} every run starts owning Chunks D and E · {i:coal} {i:sand}',
    flavor: 'Signed in coal dust, witnessed by a heron.',
    derivation: '§19 The returning run: 1 Patent; chunks D and E are 72,000 coin, about 5 min of a returning run\'s first 20 (the Act II floor coming back at 3-15K a minute), and E\'s coal and sand are the claims the Steel, Glass and Plastic designs dig with',
  }),
  steelCharter: P({
    id: 'steelCharter', name: 'Steel Charter', branch: 'head', cost: 2, requires: ['coalRights'], pos: [2, 0],
    effect: { k: 'head', land: ['F'] },
    text: '{u:survey} every run starts owning Chunk F · {i:coal} {i:ironOre}',
    flavor: 'Dame Voltaire framed her copy.',
    derivation: '§19 The returning run: 2 Patents; chunk F is 120,000 coin, about 8-10 min of a returning run\'s early floor, and its iron and coal deposits hold the Steel line\'s claims',
  }),
  overdriveHabit: P({
    id: 'overdriveHabit', name: 'Claims on File', branch: 'head', cost: 2, requires: ['steelCharter'], pos: [3, 0],
    effect: { k: 'claimsKept' },
    text: '{u:claim} the claims bought at the Survey Office stay through a Reorganize · the most of each ore so far',
    flavor: 'The surveyor\'s pegs are still in the ground. Nobody moved them.',
    derivation: '§19 The returning run: 2 Patents; a run buys 1-2 blocks of claims (25,000-60,000 x (1 + 0.5 b), §18), and without them the kept source designs past the 3 + 2 a deposit wait on coin and Surveying\'s 400 coal and 100 bricks: about 10 min of the first 20',
  }),
  starterLine: P({
    id: 'starterLine', name: 'Spare Dies', branch: 'head', cost: 3, requires: [], pos: [0, 1],
    effect: { k: 'spareDies', add: 1 },
    text: '{u:blueprint} every kept design comes back with {good:2} copies, was 1',
    flavor: 'Two of everything. The Patent Office insists.',
    derivation: '§19 The returning run: 3 Patents; a second free copy of each kept design (8-16) is a whole second chain on the Factory floor at minute one, the 5-8 stamps (bill x 1.5-2.5) and their clicks a returning run makes in its first 15 min',
  }),
  // ---------------------------------------------------------------- rules: each one a rule a player plans around
  surveyCharter: P({
    id: 'surveyCharter', name: "Surveyor's Charter", branch: 'rule', cost: 2, requires: [], pos: [0, 0],
    effect: { k: 'halfClaims' },
    text: '{u:claim} a copy of a source design graded S or S+ · half a claim per ore it digs',
    flavor: 'A clean dig is a small dig. The map agrees.',
    derivation: '§19 Patent tree: rules, 2 Patents (was 3, the review round\'s repricing); §18 claims (one per ore per copy) -> half for a design graded S or better: twice the copies of a well-folded source line, none more of a sloppy one, so the audit grade decides the floor. It was +2 claims on every ore, a multiplier in disguise (the Milestone 5 review)',
  }),
  widerBox: P({
    id: 'widerBox', name: 'Wider Fold Box', branch: 'rule', cost: 1, requires: [], pos: [0, 1],
    effect: { k: 'foldMax', value: 10 },
    text: '{u:fold} fold box 8×8 → {good:10×10} · longer lines fold into one',
    flavor: 'Bigger paper. Same creases.',
    derivation: '§19 Patent tree: rules, 1 Patent (was 2); §10 fold box 8 -> 10, a line with its power plant inside (§18: power never crosses a box) fits, so a deeper line folds whole (more steps filed)',
  }),
  quickAudit: P({
    id: 'quickAudit', name: 'Quick Audits', branch: 'rule', cost: 1, requires: [], pos: [1, 0],
    effect: { k: 'audit', warmup: 5, span: 40 },
    text: '{u:clock} audit 70 s → {good:45 s} · 5 s warm-up · 40 s window',
    flavor: 'The auditors learned to count faster. Or skip.',
    derivation: '§19 Patent tree: rules, 1 Patent (was 2); §10 audit 10 + 60 s -> 5 + 40 s: a later run folds its lines again to file better ones, and the wait is this layer\'s chore',
  }),
  moreAuditors: P({
    id: 'moreAuditors', name: 'More Auditors', branch: 'rule', cost: 1, requires: ['quickAudit'], pos: [2, 0],
    effect: { k: 'maxAudits', value: 5 },
    text: 'Workshop audits at once 3 → {good:5}',
    flavor: 'Two more clipboards. Same frog.',
    derivation: '§19 Patent tree: rules, 1 Patent (was 2); §10 audits at once 3 -> 5',
  }),
  sideIntake: P({
    id: 'sideIntake', name: 'Side Intakes', branch: 'rule', cost: 2, requires: ['widerBox'], pos: [1, 1],
    effect: { k: 'sideIntake' },
    text: 'modules also take inputs from a trunk into their left side · {good:+1} port',
    flavor: 'A second door. Do knock.',
    derivation: '§19 Patent tree: rules, 2 Patents (was 3); §11 one input side -> two (ROADMAP Milestone 5: +1 port per module)',
  }),
  nestedBoxes: P({
    id: 'nestedBoxes', name: 'Nested Boxes', branch: 'rule', cost: 2, requires: ['widerBox'], pos: [2, 1],
    effect: { k: 'nestedMax', value: 8 },
    text: '{u:fold} nested fold box 6×6 → {good:8×8}',
    flavor: 'A box in a box in a slightly bigger box.',
    derivation: '§19 Patent tree: rules, 2 Patents (was 3); §18 Nested folds 6 -> 8, a whole Bay floor group (BAY_PLAN is 8x8): a deeper fold, more steps filed',
  }),
  freshDies: P({
    id: 'freshDies', name: 'Fresh Dies', branch: 'rule', cost: 1, requires: [], pos: [0, 2],
    effect: { k: 'freshDies' },
    text: 'refold at a better grade than every earlier design · its stamp price starts over',
    flavor: 'New dies, sharp edges, first-copy prices.',
    derivation: '§19 Patent tree: rules, 1 Patent (was 2); §10 Stamp counts every copy of a product; with this, only the designs graded as well as the one stamped, so a better refold is cheap to copy (still bill x (1 + 0.5 n), linear). It was Stamping Dies, a lower growth (0.3): a number, not a rule (the Milestone 5 review)',
  }),
  // ---------------------------------------------------------------- automation (pillar 2)
  shovelFrog: P({
    id: 'shovelFrog', name: 'The Shovel Frog', branch: 'auto', cost: 1, requires: [], pos: [0, 0],
    effect: { k: 'shovel', every: 1 },
    text: 'a frog shovels 1 jammed machine clear of its byproduct · every second',
    flavor: 'He works for flies. He is very good.',
    derivation: '§19 Patent tree: automation; the shovel click of §6, one a second (a player at 4 clicks/s keeps a few lines clear)',
  }),
  labAssistant: P({
    id: 'labAssistant', name: 'Lab Assistant', branch: 'auto', cost: 1, requires: [], pos: [0, 1],
    effect: { k: 'lab' },
    text: '{research:nothing selected} → picks the node the Hopper bank pays most of',
    flavor: 'Wears goggles. Has never needed them.',
    derivation: '§19 Patent tree: automation; selecting research (§8), checked once a second',
  }),
  orderClerk: P({
    id: 'orderClerk', name: 'Order Clerk', branch: 'auto', cost: 1, requires: [], pos: [1, 1],
    effect: { k: 'clerk' },
    text: '{u:orders} no order active → accepts the first one offered',
    flavor: 'Stamps everything APPROVED. Has a stamp for that.',
    derivation: '§19 Patent tree: automation; accepting orders (§7), checked once a second',
  }),
  stampPress: P({
    id: 'stampPress', name: 'Stamp Press', branch: 'auto', cost: 2, requires: ['orderClerk'], pos: [2, 1],
    effect: { k: 'stampPress', every: 5 },
    text: 'stamps designs marked keep one spare · cheapest first · every 5 s while affordable',
    flavor: 'Ka-chunk. Ka-chunk. Ka-chunk.',
    derivation: '§19 Patent tree: automation, 2 Patents (was 3); the stamp of §10 at its full price, one every 5 s at most',
  }),
  draughtsman: P({
    id: 'draughtsman', name: 'The Draughtsman', branch: 'auto', cost: 2, requires: ['shovelFrog'], pos: [1, 0],
    effect: { k: 'draughtsman', every: 5 },
    text: '{u:blueprint} unfolds designs queued in the Drawer · in your order · as land, research and coin allow',
    flavor: 'A heron with a pencil behind its ear. It never smudges.',
    derivation: '§19 The Patent Drawer, 2 Patents (was 3): rebuilding a kept line each run is this layer\'s chore (pillar 2); one unfold every 5 s at most, at the full bill, in the order the player set, each where it was folded',
  }),
  drawerSpace: P({
    id: 'drawerSpace', name: 'A Deeper Drawer', branch: 'auto', cost: 1, requires: ['draughtsman'], pos: [2, 0],
    effect: { k: 'drawer', add: 4 },
    text: '{u:blueprint} Patent Drawer 8 → {good:12} designs',
    flavor: 'It sticks. Jiggle it.',
    derivation: '§19 The Patent Drawer, 1 Patent (was 2): 8 -> 12 kept designs, room for every Act II product line (the Act II bot folds nine products)',
  }),
  filingCabinet: P({
    id: 'filingCabinet', name: 'The Filing Cabinet', branch: 'auto', cost: 2, requires: ['drawerSpace'], pos: [3, 1],
    effect: { k: 'drawer', add: 4 },
    text: '{u:blueprint} Patent Drawer 12 → {good:16} designs · each one comes back built',
    flavor: 'Four drawers, one of them for sandwiches.',
    derivation: '§19 The returning run (the playability pass): 12 -> 16 kept designs; every kept design now comes back as a module at a run\'s start, so a slot is a chain that returns built: room for Act II\'s nine products and Act III\'s Workshop lines (Chem Vat, Greenhouse, bearings)',
  }),
  notebooks: P({
    id: 'notebooks', name: 'The Floor Plan', branch: 'auto', cost: 3, requires: ['draughtsman'], pos: [4, 0],
    effect: { k: 'floorPlan', every: 2 },
    text: '{u:factory} the Factory floor at a Reorganize is laid again · trunks paid · its modules placed as copies exist',
    flavor: 'Pinned to the wall with four drawing pins and a gear.',
    derivation: '§19 The returning run (the playability pass): pillar 2, a returning run\'s chore (placing the same modules and trunks as last run, about 100 clicks for the Act II floor) becomes the Draughtsman\'s; one tile every 2 s at most, a trunk at its price, a module tile filled with a spare copy of a design making the same product (the best graded), so it never stamps or spends a save',
  }),
  // ---------------------------------------------------------------- Act III (DESIGN.md §21 Patents)
  // Head starts for the District's research, and the rules and automation of composing groups.
  // Priced as Act II's: about a Patent per 10-15 min of a run the node saves (§19).
  zoningCharter: P({
    id: 'zoningCharter', name: 'Zoning Charter', branch: 'head', cost: 3, requires: [], pos: [2, 1],
    effect: { k: 'head', research: ['zoning', 'chutes'] },
    text: '{u:reset} start knowing {research:Zoning} · {research:Chutes} · the District open from the first minute',
    flavor: 'Stamped by a frog, countersigned by three raccoons.',
    derivation: '§21 Patents: head starts, 3; Zoning and Chutes (300 motors, 300 circuits, 300 concrete, 2,000 steel) are about 35-40 min of a fresh run\'s Act II floor (motors 7.5 a minute, circuits 8.4: the second gate\'s arithmetic), a Patent per 12-13 min (§19)',
  }),
  districtDeeds: P({
    id: 'districtDeeds', name: 'District Deeds', branch: 'head', cost: 3, requires: ['zoningCharter'], pos: [2, 2],
    effect: { k: 'head', lots: 1 },
    text: '{u:reset} the District opens with its first lot · 14×10',
    flavor: 'The ink was still wet. It is always still wet.',
    derivation: '§21 Patents: head starts, 3; the first lot is 1M coin, about 45-55 min of the 18-21K a minute the floor makes when the District opens (the second gate\'s measure)',
  }),
  chemNotes: P({
    id: 'chemNotes', name: 'Chemistry Notes', branch: 'head', cost: 3, requires: ['zoningCharter'], pos: [3, 1],
    effect: { k: 'head', research: ['chemistry', 'vulcanizing', 'batteries'] },
    text: '{u:reset} start knowing {research:Chemistry} · {research:Vulcanizing} · {research:Batteries}',
    flavor: 'Stained, smoking slightly, legible in places.',
    derivation: '§21 Patents: head starts, 3; three nodes (400 oil, 350 solvent, 500 plastic, 800 copper ingots), about 40 min of a floor with two Plastic modules and a first Chem Vat line',
  }),
  bearingPatent: P({
    id: 'bearingPatent', name: 'The Bearing Patent', branch: 'head', cost: 2, requires: ['zoningCharter'], pos: [3, 2],
    effect: { k: 'head', research: ['bearings', 'servos'] },
    text: '{u:reset} start knowing {research:Bearings} · {research:Servos}',
    flavor: 'Round, smooth, and legally yours.',
    derivation: '§21 Patents: head starts, 2; two nodes (2,000 steel, 1,500 gears, 120 gearboxes, 120 motors), about 25-30 min',
  }),
  senseNotes: P({
    id: 'senseNotes', name: 'Sense and Logic', branch: 'head', cost: 3, requires: ['chemNotes'], pos: [4, 1],
    effect: { k: 'head', research: ['sensors', 'processors', 'recycling', 'hydroponics'] },
    text: '{u:reset} start knowing {research:Sensors} · {research:Processors} · {research:Recycling} · {research:Hydroponics}',
    flavor: 'Half of it is diagrams of eyes. The other half is diagrams of thinking.',
    derivation: '§21 Patents: head starts, 3; four nodes (700 circuits, 350 rubber, 200 solvent, 300 sludge, 600 glass, 60 gearboxes), about 40-45 min',
  }),
  roboticsPatent: P({
    id: 'roboticsPatent', name: 'The Robotics Patent', branch: 'head', cost: 3, requires: ['senseNotes', 'bearingPatent'], pos: [5, 1],
    effect: { k: 'head', research: ['robotics', 'sandwiches'] },
    text: '{u:reset} start knowing {research:Robotics} · {research:Sandwiches}',
    flavor: 'It reaches for the pen and signs itself.',
    derivation: '§21 Patents: head starts, 3; Robotics and Sandwiches (40 servos, 40 sensors, 20 processors, 400 produce), about 35-40 min',
  }),
  longSkiffs: P({
    id: 'longSkiffs', name: 'Long Skiffs', branch: 'rule', cost: 2, requires: [], pos: [3, 0],
    effect: { k: 'skiffSpeed', add: 1 },
    text: '{u:district} skiffs fly {good:3} tiles/s, was 2 · a far feeder needs fewer skiffs',
    flavor: 'Longer rotors, louder hum.',
    derivation: '§21 Patents: rules, 2; skiffs 2 -> 3 tiles/s: a route five tiles long carries 0.23 a skiff, was 0.17; beside its consumer 0.6, was 0.5, because the dwell is unchanged: a rule about distance, not a multiplier on output',
  }),
  biggerNest: P({
    id: 'biggerNest', name: 'The Bigger Nest', branch: 'rule', cost: 2, requires: ['nestedBoxes'], pos: [3, 1],
    effect: { k: 'nestedMax', value: 10 },
    text: '{u:fold} nested fold box 8×8 → {good:10×10}',
    flavor: 'Boxes all the way up.',
    derivation: '§21 Patents: rules, 2; a tier 3 group with its feeders (four modules and the trunks between) folds whole: a deeper fold files more steps (§19)',
  }),
  wideDistrictBox: P({
    id: 'wideDistrictBox', name: 'Ward Boundaries', branch: 'rule', cost: 2, requires: ['biggerNest'], pos: [3, 2],
    effect: { k: 'highFoldMax', value: 10 },
    text: '{u:fold} District fold box 8×8 → {good:10×10}',
    flavor: 'The surveyor moved the fence. Nobody minded.',
    derivation: '§21 Patents: rules, 2; a District group of a dozen groups folds whole',
  }),
  dispatcher: P({
    id: 'dispatcher', name: 'The Dispatcher', branch: 'auto', cost: 3, requires: [], pos: [3, 0],
    effect: { k: 'dispatcher', every: 10 },
    text: '{u:district} adds a skiff to the route furthest short of what it is wanted · every 10 s · while a skiff is under 5% of your coin',
    flavor: 'A gull with a whistle. Nobody argues with the gull.',
    derivation: '§21 Patents: automation, 3 (pillar 2: placing skiffs, the act\'s chore, becomes a machine\'s); one skiff every 10 s at most, at its full price, only on a route running under 90% of its want, and only while a skiff costs under 5% of the coin on hand, so it never spends a save',
  }),
  // ---------------------------------------------------------------- offline (DESIGN.md §12, §20)
  nightShift: P({
    id: 'nightShift', name: 'Graveyard Shift', branch: 'offline', cost: 2, requires: [], pos: [0, 0],
    effect: { k: 'offline', add: 0.05 },
    text: '{u:overnight} offline efficiency {good:+5%} · on top of 50% and the Night Shift',
    flavor: 'The owls clock in.',
    derivation: '§19 Patent tree: offline; §20: 0.5, the Night Shift bought with coin (+0.1), and three nodes of +0.05 make 0.75 exactly, the ceiling',
  }),
  nightWatch: P({
    id: 'nightWatch', name: 'Night Watch', branch: 'offline', cost: 2, requires: ['nightShift'], pos: [1, 0],
    effect: { k: 'offline', add: 0.05 },
    text: '{u:overnight} offline efficiency {good:+5%} more',
    flavor: 'A lantern on every line.',
    derivation: '§19 Patent tree: offline; the second of three +0.05 steps to the 0.75 ceiling (§20)',
  }),
  lightsOn: P({
    id: 'lightsOn', name: 'Lights Left On', branch: 'offline', cost: 3, requires: ['nightWatch'], pos: [2, 0],
    effect: { k: 'offline', add: 0.05 },
    text: '{u:overnight} offline efficiency {good:+5%} more · 75% with the Night Shift, the ceiling',
    flavor: 'Voltaire sends the bill. You pay it gladly.',
    derivation: '§19 Patent tree: offline; the last +0.05: 0.5 + 0.1 (coin) + 0.15 (Patents) = 0.75, the ceiling: offline never pays as much as being there (§13 check 12, §20)',
  }),
};

export const PATENT_LIST: PatentDef[] = PATENT_IDS.map((id) => PATENTS[id]);

export const BRANCH_NAMES: Record<PatentBranch, string> = { head: 'Head starts', rule: 'Rules', auto: 'Automation', offline: 'Offline' };
