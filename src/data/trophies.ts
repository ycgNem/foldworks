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
  /** how to earn it, shown on the shelf: a short row of markup, no sentence */
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
  T('warmHands', 'Warm Hands', '{k:LMB} crank the Hand Furnace ×8', 'ironIngot', { k: 'counter', name: 'cranks' }, 8),
  T('openForBusiness', 'Open for Business', '{coin} sell anything at the Dock', null, { k: 'earned' }, 1),
  T('secondWind', 'Second Wind', 'buy the Bellows', null, { k: 'upgrades' }, 1),
  T('handsFree', 'Hands Free', 'build a Miner', 'ironOre', { k: 'built', kind: 'miner' }, 1),
  T('slagHappens', 'Slag Happens', 'let a machine choke on {i:slag}', 'slag', { k: 'counter', name: 'slagJams' }, 1),
  T('elbowGrease', 'Elbow Grease', '{k:LMB} shovel {i:slag} by hand ×10', 'slag', { k: 'counter', name: 'shovels' }, 10),
  T('pocketMoney', 'Pocket Money', 'earn {coin:1,000}', null, { k: 'earned' }, 1000),
  T('smallBusiness', 'Small Business', 'earn {coin:10,000}', null, { k: 'earned' }, 10000),
  T('swampTycoon', 'Island Tycoon', 'earn {coin:100,000}', null, { k: 'earned' }, 100000),
  T('barHopping', 'Bar Hopping', 'deliver 100 {i:ironIngot}', 'ironIngot', { k: 'delivered', item: 'ironIngot' }, 100),
  T('flatOut', 'Flat Out', 'deliver 500 {i:ironPlate}', 'ironPlate', { k: 'delivered', item: 'ironPlate' }, 500),
  T('liveWire', 'Live Wire', 'deliver 500 {i:copperWire}', 'copperWire', { k: 'delivered', item: 'copperWire' }, 500),
  T('teething', 'Teething', 'deliver 1 {i:gear}', 'gear', { k: 'delivered', item: 'gear' }, 1),
  T('whatDoesItDo', 'What Does It Do?', 'deliver 1 {i:gizmo}', 'gizmo', { k: 'delivered', item: 'gizmo' }, 1),
  T('gizmoEnthusiast', 'Gizmo Enthusiast', 'deliver 100 {i:gizmo}', 'gizmo', { k: 'delivered', item: 'gizmo' }, 100),
  T('brickByBrick', 'Brick by Brick', 'deliver 1 {i:slagBrick}', 'slagBrick', { k: 'delivered', item: 'slagBrick' }, 1),
  T('eureka', 'Eureka', 'finish 1 {research:research}', null, { k: 'research' }, 1),
  T('wellRead', 'Well Read', 'finish all 10 Workshop {research:research}', null, { k: 'research' }, 10),
  T('brambleApproves', 'Bramble Approves', 'fill 1 of Bramble\'s orders', null, { k: 'orders' }, 1),
  T('friendOfTheSwamp', 'Friend of the Island', 'Bramble reputation 3', null, { k: 'rep' }, 3),
  T('landBaron', 'Land Baron', 'own 2 chunks of land', null, { k: 'land' }, 2),
  T('estate', 'Estate', 'own all 4 Workshop chunks', null, { k: 'land' }, 4),
  T('busyFloor', 'Busy Floor', 'run 10 machines', null, { k: 'machines' }, 10),
  T('factoryFloor', 'Proper Factory', 'run 25 machines', null, { k: 'machines' }, 25),
  T('beltUp', 'Belt Up', 'lay 50 belt tiles', null, { k: 'built', kind: 'belt' }, 50),
  T('lucky', 'Lucky!', '{k:LMB} catch a Spark', null, { k: 'counter', name: 'sparks' }, 1),
  T('sparkChaser', 'Spark Chaser', '{k:LMB} catch 10 Sparks', null, { k: 'counter', name: 'sparks' }, 10),
  T('goldStar', 'Gold Star', 'an S from the Inspector', null, { k: 'counter', name: 'inspectS' }, 1),
  T('tireless', 'Tireless', '{k:LMB} ×1,000', null, { k: 'counter', name: 'clicks' }, 1000),
  // Act II (DESIGN.md §18)
  A('manOfSteel', 'Forged in the Clouds', 'deliver 1 {i:steel}', 'steel', { k: 'delivered', item: 'steel' }, 1, '§18 Items: steel, the first new product of the act'),
  A('letThereBeLight', 'Let There Be Light', 'light a {power:power} grid', 'coal', { k: 'counter', name: 'gridsLit' }, 1, '§18 Power: the first grid with power flowing'),
  A('clearAsGlass', 'Clear as Glass', 'deliver 1 {i:glass}', 'glass', { k: 'delivered', item: 'glass' }, 1, '§18 Items: glass'),
  A('thinkingWire', 'Thinking Wire', 'deliver 1 {i:circuit}', 'circuit', { k: 'delivered', item: 'circuit' }, 1, '§18 Items: circuits by 3:00'),
  A('heavyMetal', 'Heavy Metal', 'build a Mk2 machine', 'steel', { k: 'counter', name: 'mk2Built' }, 1, '§18 Machines: the first Mk2 of any kind'),
  A('spinDoctor', 'Spin Doctor', 'deliver 1 {i:motor}', 'motor', { k: 'delivered', item: 'motor' }, 1, '§18 Items: the motor, 420 coin'),
  A('redline', 'Redline', '{u:overdrive} Overdrive ×100', null, { k: 'counter', name: 'overdrives' }, 100, '§18 Overdrive: the click lever behind §16 rule 4'),
  A('cataloguer', 'Cataloguer', '{u:codex} log 10 items in the Codex', null, { k: 'counter', name: 'codex' }, 10, '§18 Customers: the Codex of Unit 7'),
  A('claimJumper', 'Claim Jumper', '{u:claim} buy a block of ore claims', 'ironOre', { k: 'counter', name: 'claimBlocks' }, 1, '§18 Land and deposits: the Survey Office'),
  A('foldception', 'Foldception', '{u:fold} fold modules into one', null, { k: 'counter', name: 'nestedFolds' }, 1, '§18 Nested folds'),
  A('stampCollector', 'Stamp Collector', 'stamp 25 module copies', null, { k: 'counter', name: 'stamps' }, 25, '§10 Stamp; §18'),
  A('greatDrill', 'Breaking Ground', "{u:mega} finish the Great Drill's stage 1", 'drillBit', { k: 'counter', name: 'megaStages' }, 1, '§18 Megaproject #1, stage 1 by about 4:30'),
];

export const TROPHY: Record<string, TrophyDef> = Object.fromEntries(TROPHIES.map((t) => [t.id, t]));
