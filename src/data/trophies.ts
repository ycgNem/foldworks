// Trophies: the slice's preview of the Trophy Shelf (PLAN.md long tail; DESIGN.md §15). Cosmetic
// only until Milestone 11, where each gets a small, specific bonus tied to what earned it (never a
// pooled multiplier: DECISIONS.md flags Cookie Clicker's milk). They exist now because the owner
// asked for constant feedback (DECISIONS.md 2026-10-20).
import type { ItemId } from './items';

/** what a trophy counts */
export type TrophyStat =
  | { k: 'earned' }
  | { k: 'delivered'; item: ItemId }
  | { k: 'counter'; name: string }
  | { k: 'built'; kind: string }
  | { k: 'machines' }
  | { k: 'research' }
  | { k: 'orders' }
  | { k: 'rep' }
  | { k: 'land' }
  | { k: 'upgrades' };

export interface TrophyDef {
  id: string;
  name: string;
  /** how to earn it, shown on the shelf */
  desc: string;
  /** an item icon to show, or null for a star */
  icon: ItemId | null;
  stat: TrophyStat;
  n: number;
  derivation: string;
}

const T = (id: string, name: string, desc: string, icon: ItemId | null, stat: TrophyStat, n: number): TrophyDef => ({ id, name, desc, icon, stat, n, derivation: '§15 Trophy Shelf preview (cosmetic in the slice)' });
const A = (id: string, name: string, desc: string, icon: ItemId | null, stat: TrophyStat, n: number, why: string): TrophyDef => ({ id, name, desc, icon, stat, n, derivation: why });

export const TROPHIES: TrophyDef[] = [
  T('warmHands', 'Warm Hands', 'Crank the Hand Furnace 8 times.', 'ironIngot', { k: 'counter', name: 'cranks' }, 8),
  T('openForBusiness', 'Open for Business', 'Sell something at the Dock.', null, { k: 'earned' }, 1),
  T('secondWind', 'Second Wind', 'Buy the Bellows.', null, { k: 'upgrades' }, 1),
  T('handsFree', 'Hands Free', 'Build a Miner.', 'ironOre', { k: 'built', kind: 'miner' }, 1),
  T('slagHappens', 'Slag Happens', 'Have a machine choke on its slag.', 'slag', { k: 'counter', name: 'slagJams' }, 1),
  T('elbowGrease', 'Elbow Grease', 'Shovel slag by hand 10 times.', 'slag', { k: 'counter', name: 'shovels' }, 10),
  T('pocketMoney', 'Pocket Money', 'Earn 1,000 coin.', null, { k: 'earned' }, 1000),
  T('smallBusiness', 'Small Business', 'Earn 10,000 coin.', null, { k: 'earned' }, 10000),
  T('swampTycoon', 'Swamp Tycoon', 'Earn 100,000 coin.', null, { k: 'earned' }, 100000),
  T('barHopping', 'Bar Hopping', 'Deliver 100 iron ingots.', 'ironIngot', { k: 'delivered', item: 'ironIngot' }, 100),
  T('flatOut', 'Flat Out', 'Deliver 500 iron plates.', 'ironPlate', { k: 'delivered', item: 'ironPlate' }, 500),
  T('liveWire', 'Live Wire', 'Deliver 500 copper wire.', 'copperWire', { k: 'delivered', item: 'copperWire' }, 500),
  T('teething', 'Teething', 'Deliver a gear.', 'gear', { k: 'delivered', item: 'gear' }, 1),
  T('whatDoesItDo', 'What Does It Do?', 'Deliver a Gizmo.', 'gizmo', { k: 'delivered', item: 'gizmo' }, 1),
  T('gizmoEnthusiast', 'Gizmo Enthusiast', 'Deliver 100 Gizmos.', 'gizmo', { k: 'delivered', item: 'gizmo' }, 100),
  T('brickByBrick', 'Brick by Brick', 'Deliver a slag brick.', 'slagBrick', { k: 'delivered', item: 'slagBrick' }, 1),
  T('eureka', 'Eureka', 'Finish a research.', null, { k: 'research' }, 1),
  T('wellRead', 'Well Read', 'Finish all ten Workshop research.', null, { k: 'research' }, 10),
  T('brambleApproves', 'Bramble Approves', 'Fill one of Bramble\'s orders.', null, { k: 'orders' }, 1),
  T('friendOfTheSwamp', 'Friend of the Swamp', 'Reach 3 reputation with Bramble.', null, { k: 'rep' }, 3),
  T('landBaron', 'Land Baron', 'Own two chunks of land.', null, { k: 'land' }, 2),
  T('estate', 'Estate', 'Own all four Workshop chunks.', null, { k: 'land' }, 4),
  T('busyFloor', 'Busy Floor', 'Have 10 machines.', null, { k: 'machines' }, 10),
  T('factoryFloor', 'Proper Factory', 'Have 25 machines.', null, { k: 'machines' }, 25),
  T('beltUp', 'Belt Up', 'Lay 50 belt tiles.', null, { k: 'built', kind: 'belt' }, 50),
  T('lucky', 'Lucky!', 'Catch a Spark.', null, { k: 'counter', name: 'sparks' }, 1),
  T('sparkChaser', 'Spark Chaser', 'Catch 10 Sparks.', null, { k: 'counter', name: 'sparks' }, 10),
  T('goldStar', 'Gold Star', 'Get an S from the Inspector.', null, { k: 'counter', name: 'inspectS' }, 1),
  T('tireless', 'Tireless', 'Click 1,000 times.', null, { k: 'counter', name: 'clicks' }, 1000),
  // Act II (DESIGN.md §18)
  A('manOfSteel', 'Forged in the Swamp', 'Deliver your first steel.', 'steel', { k: 'delivered', item: 'steel' }, 1, '§18 Items: steel, the first new product of the act'),
  A('letThereBeLight', 'Let There Be Light', 'Light up your first power grid.', 'coal', { k: 'counter', name: 'gridsLit' }, 1, '§18 Power: the first grid with power flowing'),
  A('clearAsGlass', 'Clear as Glass', 'Deliver a pane of glass.', 'glass', { k: 'delivered', item: 'glass' }, 1, '§18 Items: glass'),
  A('thinkingWire', 'Thinking Wire', 'Deliver a circuit.', 'circuit', { k: 'delivered', item: 'circuit' }, 1, '§18 Items: circuits by 3:00'),
  A('heavyMetal', 'Heavy Metal', 'Build a Mk2 machine.', 'steel', { k: 'counter', name: 'mk2Built' }, 1, '§18 Machines: the first Mk2 of any kind'),
  A('spinDoctor', 'Spin Doctor', 'Deliver a motor.', 'motor', { k: 'delivered', item: 'motor' }, 1, '§18 Items: the motor, 420 coin'),
  A('redline', 'Redline', 'Overdrive machines 100 times.', null, { k: 'counter', name: 'overdrives' }, 100, '§18 Overdrive: the click lever behind §16 rule 4'),
  A('cataloguer', 'Cataloguer', 'Log 10 items in the Codex.', null, { k: 'counter', name: 'codex' }, 10, '§18 Customers: the Codex of Unit 7'),
  A('claimJumper', 'Claim Jumper', 'Buy a block of ore claims.', 'ironOre', { k: 'counter', name: 'claimBlocks' }, 1, '§18 Land and deposits: the Survey Office'),
  A('foldception', 'Foldception', 'Fold a group of modules into one.', null, { k: 'counter', name: 'nestedFolds' }, 1, '§18 Nested folds'),
  A('stampCollector', 'Stamp Collector', 'Stamp 25 copies of modules.', null, { k: 'counter', name: 'stamps' }, 25, '§10 Stamp; §18'),
  A('greatDrill', 'Breaking Ground', "Finish the Great Drill's stage 1.", 'drillBit', { k: 'counter', name: 'megaStages' }, 1, '§18 Megaproject #1, stage 1 by about 4:30'),
];

export const TROPHY: Record<string, TrophyDef> = Object.fromEntries(TROPHIES.map((t) => [t.id, t]));
