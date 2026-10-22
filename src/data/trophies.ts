// The Trophy Shelf (PLAN.md long tail; DESIGN.md §15, §24). The slice's 29 were cosmetic; Milestone
// 11 gives every trophy a small, specific bonus tied to what earned it (`bonus`, applied by the sim
// through src/sim/longtail.ts `trules`), never a pooled multiplier and never "+X% everything"
// (DECISIONS.md flags Cookie Clicker's milk: a bonus that grows with the number of trophies). A
// delivery trophy speeds that one product's craft, a route trophy gives a route a skiff more, a
// slag trophy a free Slag Heap. Hidden trophies show as "???" until earned. Trophies are kept
// through every reset (the `trophy:<id>` flags), so their bonuses are too. They began because the
// owner asked for constant feedback (DECISIONS.md 2026-10-20).
import type { ItemId } from './items';
import { BUILD, type BuildKind } from './machines';
import { cosmeticDef } from './cosmetics';
import type { CustomerId } from './orders';
import { MEGA, MEGAS, type MegaId } from './megaprojects';
import type { ScenarioId } from './scenarios';
import { PATENT_IDS } from './patents';
import { KERNEL_IDS } from './kernels';
import { CODEX_ITEMS, CODEX_TOTAL, type Tier } from './codex';

/** what a trophy counts */
export type TrophyStat =
  | { k: 'earned' }
  | { k: 'delivered'; item: ItemId }
  | { k: 'counter'; name: string }
  | { k: 'built'; kind: string }
  | { k: 'machines' }
  | { k: 'research' }
  | { k: 'orders' }
  /** a customer's reputation (Bramble when absent) */
  | { k: 'rep'; who?: CustomerId }
  /** the lowest reputation of the four customers (Milestone 11) */
  | { k: 'repMin' }
  | { k: 'land' }
  | { k: 'upgrades' }
  // ---- Milestone 11 (DESIGN.md §24)
  /** delivered in every run so far and this one (the lifetime statistics) */
  | { k: 'lifetime'; item: ItemId }
  /** coin earned in every run so far and this one */
  | { k: 'lifetimeEarned' }
  /** items of a tier in the Codex, or of every tier */
  | { k: 'codexTier'; tier: Tier }
  | { k: 'codexAll' }
  /** a number the reset layers keep (meta) */
  | { k: 'meta'; name: 'patentsEarned' | 'legacyEarned' | 'kernelsEarned' | 'visited' | 'drawer' | 'cosmetics' | 'patentNodes' | 'legacyNodes' | 'kernelNodes' | 'challenges' | 'boards' }
  /** a Megaproject's stages standing (the Great Drill is 'drill') */
  | { k: 'mega'; id: MegaId | 'drill' }
  /** a Scenario board with a personal best on file (meta.boards) */
  | { k: 'board'; id: ScenarioId }
  /** trophies on the shelf */
  | { k: 'trophies' }
  /** Last Folds graded S or S+ (the Seed cards) */
  | { k: 'seedS' };

/** What a trophy gives, for good (DESIGN.md §24): a handful of kinds, each small and about one
 * thing. Summed over the trophies that give the same kind. */
export type TrophyBonus =
  /** Workshop machines crafting this item (their recipe's main output) run this much faster */
  | { k: 'speed'; item: ItemId; add: number }
  /** the first n of a Workshop building on the map are free (a free one refunds nothing) */
  | { k: 'free'; kind: BuildKind; n: number }
  /** every route on a high floor takes this many more skiffs */
  | { k: 'skiffs'; add: number }
  /** every high floor holds this many more routes */
  | { k: 'routes'; add: number }
  /** the Patent Drawer holds this many more designs */
  | { k: 'drawer'; add: number }
  /** Sparks stay this many seconds longer */
  | { k: 'sparkLife'; add: number }
  /** Slag Heaps hold this many more */
  | { k: 'heap'; add: number }
  /** every run after a reset starts with this much more coin */
  | { k: 'startCoin'; add: number }
  /** Overdrive cools this many seconds sooner */
  | { k: 'cool'; sub: number }
  /** the Old Works' ruins repair for this share less */
  | { k: 'repair'; off: number }
  /** the Chute holds this many more of each item */
  | { k: 'chute'; add: number }
  // ---- Acts IV-V's own (the review of 2026-10-22: a late trophy pays a rule about the late game)
  /** the World's barges fly this many tiles a second faster */
  | { k: 'barge'; add: number }
  /** Beyond's couriers load and unload this many seconds quicker */
  | { k: 'courier'; sub: number }
  /** the World's and Beyond's lots cost this share less */
  | { k: 'lot'; off: number }
  /** every Endless Ledger order wants this share less */
  | { k: 'ledger'; off: number }
  /** a skin (src/data/cosmetics.ts), kept in meta.cosmetics */
  | { k: 'cosmetic'; id: string };

export interface TrophyDef {
  id: string;
  name: string;
  /** how to earn it, shown on the shelf: a short row of markup, no sentence */
  desc: string;
  /** an item icon to show, or null for a star */
  icon: ItemId | null;
  stat: TrophyStat;
  n: number;
  bonus: TrophyBonus;
  /** shown as "???" until earned */
  hidden?: true;
  derivation: string;
}

/** The most the shelf adds of each kind, however many trophies give it (DESIGN.md §24): a cap, so
 * a full shelf is a set of small rules and never a bonus that grows with the trophy count (the
 * thing DECISIONS.md flags in Cookie Clicker's milk). */
export const TROPHY_CAPS = {
  speed: 0.1, skiffs: 4, routes: 40, drawer: 6, sparkLife: 10, heap: 200, cool: 10, repair: 0.3, chute: 40,
  startCoin: 20000, barge: 1, courier: 1, lot: 0.4, ledger: 0.35,
  derivation: '§24 Trophy bonuses, the caps: a product\'s craft +10% (two delivery trophies); a route 4 skiffs more (12 -> 16, §21); 40 routes (a third of 120); 6 Drawer slots (8 -> 14, under A Deeper Drawer and the Legacy\'s 4 each); Sparks 10 s more (20 -> 30, §6); Slag Heaps 200 more (half of 400, §4); Overdrive 10 s sooner (30 -> 20, still twice its 10 s run, §18); ruins 30% off their quarter (§22); the Chute 40 more (20 -> 60, Specimen Jars\' level, §21); a run\'s start 20,000 coin (an Act II-III run\'s first heavy machines: a Mixer, a Refinery and a Smelter Mk2 are 19,000, §18); Acts IV-V\'s own (§24, the review of 2026-10-22): barges a tile a second faster (3 -> 4, the Lens Room\'s step again, §22), couriers a second quicker at the ends (2 -> 1 s, the District\'s skiffs\' 1 s, §23), the World\'s and Beyond\'s lots 40% off (10M and 100M x n stay linear, §22-23), Ledger orders 35% less (an order still grows by two thirds of its base, §23). Every kind\'s uncapped sum (trophies and the Ledger\'s rules) is at most 1.5x its cap, so a late trophy is never a sticker on a full kind',
};

type B = TrophyBonus;
const X = (id: string, name: string, desc: string, icon: ItemId | null, stat: TrophyStat, n: number, bonus: B, derivation: string, hidden = false): TrophyDef =>
  ({ id, name, desc, icon, stat, n, bonus, ...(hidden ? { hidden: true as const } : {}), derivation });
const SL = '§15 Trophy Shelf preview; §24';

// the bonus sizes (DESIGN.md §24 Trophy bonuses)
const SPEED = 0.05;
const speed = (item: ItemId): B => ({ k: 'speed', item, add: SPEED });
const free = (kind: BuildKind, n = 1): B => ({ k: 'free', kind, n });
const coin = (add: number): B => ({ k: 'startCoin', add });
const skin = (id: string): B => ({ k: 'cosmetic', id });

/** a delivery trophy over every run: that product's craft 5% faster (§24) */
const life = (id: string, name: string, item: ItemId, n: number, why: string, hidden = false) =>
  X(id, name, `deliver ${n.toLocaleString('en-US')} {i:${item}} (every run)`, item, { k: 'lifetime', item }, n, speed(item), `§24 Trophy bonuses: ${why}; that product's craft +5%`, hidden);

export const TROPHIES: TrophyDef[] = [
  // ================================================================== Act I, the slice (§15)
  X('warmHands', 'Warm Hands', '{k:LMB} crank the Hand Furnace ×8', 'ironIngot', { k: 'counter', name: 'cranks' }, 8, skin('ember'), `${SL}: the first cranks; a furnace skin (the Bellows soon ends the cranking, so no rule is worth giving)`),
  X('openForBusiness', 'Open for Business', '{coin} sell anything at the Dock', null, { k: 'earned' }, 1, coin(10), `${SL}: the first sale; 10 coin a run, a quarter of the first Miner (§4)`),
  X('secondWind', 'Second Wind', 'buy the Bellows', null, { k: 'upgrades' }, 1, coin(15), `${SL}: the first purchase; 15 coin a run`),
  X('handsFree', 'Hands Free', 'build a Miner', 'ironOre', { k: 'built', kind: 'miner' }, 1, free('miner'), `${SL}: the first Miner; one Miner free (40 coin, §4)`),
  X('slagHappens', 'Slag Happens', 'let a machine choke on {i:slag}', 'slag', { k: 'counter', name: 'slagJams' }, 1, free('heap'), `${SL}: the first slag jam; one Slag Heap free (25 coin, §4), the jam's own cure`),
  X('elbowGrease', 'Elbow Grease', '{k:LMB} shovel {i:slag} by hand ×10', 'slag', { k: 'counter', name: 'shovels' }, 10, { k: 'heap', add: 50 }, `${SL}: ten shovels; Slag Heaps hold 50 more (400, §4: 6-7 min of one smelter)`),
  X('pocketMoney', 'Pocket Money', 'earn {coin:1,000}', null, { k: 'earned' }, 1000, coin(25), `${SL}: 1,000 coin; 25 coin a run`),
  X('smallBusiness', 'Small Business', 'earn {coin:10,000}', null, { k: 'earned' }, 10000, coin(100), `${SL}: 10,000 coin; 100 coin a run, a Miner and its belts`),
  X('swampTycoon', 'Island Tycoon', 'earn {coin:100,000}', null, { k: 'earned' }, 100000, coin(400), `${SL}: 100,000 coin; 400 coin a run, a slice line`),
  X('barHopping', 'Bar Hopping', 'deliver 100 {i:ironIngot}', 'ironIngot', { k: 'delivered', item: 'ironIngot' }, 100, free('smelter'), `${SL}: 100 ingots; one Smelter free (60, §4). Not a craft speed: a first-hour speed raised run 1's peak, the bar run 2 must pass (§16 rule 3, pace-reorganize); not heap room: the first heap's 400 is §12's offline lesson (53 min of one furnace)`),
  X('flatOut', 'Flat Out', 'deliver 500 {i:ironPlate}', 'ironPlate', { k: 'delivered', item: 'ironPlate' }, 500, free('press'), `${SL}: 500 plates; one Press free (150, §4)`),
  X('liveWire', 'Live Wire', 'deliver 500 {i:copperWire}', 'copperWire', { k: 'delivered', item: 'copperWire' }, 500, free('splitter'), `${SL}: 500 wire; one Splitter free`),
  X('teething', 'Teething', 'deliver 1 {i:gear}', 'gear', { k: 'delivered', item: 'gear' }, 1, free('press'), `${SL}: the first gear; one Press free (150, §4)`),
  X('whatDoesItDo', 'What Does It Do?', 'deliver 1 {i:gizmo}', 'gizmo', { k: 'delivered', item: 'gizmo' }, 1, free('assembler'), `${SL}: the first Gizmo; one Assembler free (500, §4)`),
  X('gizmoEnthusiast', 'Gizmo Enthusiast', 'deliver 100 {i:gizmo}', 'gizmo', { k: 'delivered', item: 'gizmo' }, 100, free('assembler'), `${SL}: 100 Gizmos; one Assembler free (500, §4)`),
  X('brickByBrick', 'Brick by Brick', 'deliver 1 {i:slagBrick}', 'slagBrick', { k: 'delivered', item: 'slagBrick' }, 1, { k: 'heap', add: 50 }, `${SL}: the first brick; Slag Heaps hold 50 more`),
  X('eureka', 'Eureka', 'finish 1 {research:research}', null, { k: 'research' }, 1, skin('mortarboard'), `${SL}: the first research; a Hopper decoration`),
  X('wellRead', 'Well Read', 'finish all 10 Workshop {research:research}', null, { k: 'research' }, 10, { k: 'drawer', add: 1 }, `${SL}: Act I's research; the Patent Drawer holds 1 more (8, §19)`),
  X('brambleApproves', 'Bramble Approves', 'fill 1 of Bramble\'s orders', null, { k: 'orders' }, 1, skin('bunting'), `${SL}: the first order; a Dock decoration`),
  X('friendOfTheSwamp', 'Friend of the Island', 'Bramble reputation 3', null, { k: 'rep' }, 3, coin(50), `${SL}: Bramble's rep 3; 50 coin a run`),
  X('landBaron', 'Land Baron', 'own 2 chunks of land', null, { k: 'land' }, 2, free('belt', 10), `${SL}: a second chunk; 10 belt tiles free (a road across it)`),
  X('estate', 'Estate', 'own all 4 Workshop chunks', null, { k: 'land' }, 4, free('crate', 2), `${SL}: the slice's land; 2 Buffer Crates free (30 each, §4)`),
  X('busyFloor', 'Busy Floor', 'run 10 machines', null, { k: 'machines' }, 10, free('smelter'), `${SL}: ten machines; one Smelter free (60, §4)`),
  X('factoryFloor', 'Proper Factory', 'run 25 machines', null, { k: 'machines' }, 25, free('splitter'), `${SL}: 25 machines; one Splitter free`),
  X('beltUp', 'Belt Up', 'lay 50 belt tiles', null, { k: 'built', kind: 'belt' }, 50, free('belt', 10), `${SL}: 50 belts; 10 belt tiles free`),
  X('lucky', 'Lucky!', '{k:LMB} catch a Spark', null, { k: 'counter', name: 'sparks' }, 1, { k: 'sparkLife', add: 2 }, `${SL}: the first Spark; Sparks stay 2 s longer (20, §6)`),
  X('sparkChaser', 'Spark Chaser', '{k:LMB} catch 10 Sparks', null, { k: 'counter', name: 'sparks' }, 10, { k: 'sparkLife', add: 3 }, `${SL}: ten Sparks; Sparks stay 3 s longer`),
  X('goldStar', 'Gold Star', 'an S from the Inspector', null, { k: 'counter', name: 'inspectS' }, 1, { k: 'sparkLife', add: 2 }, `${SL}: the Inspector's S; Sparks stay 2 s longer`),
  X('tireless', 'Tireless', '{k:LMB} ×1,000', null, { k: 'counter', name: 'clicks' }, 1000, { k: 'sparkLife', add: 2 }, `${SL}: 1,000 clicks; Sparks stay 2 s longer (20, §6)`),
  // ================================================================== Act II (§18)
  X('manOfSteel', 'Forged in the Clouds', 'deliver 1 {i:steel}', 'steel', { k: 'delivered', item: 'steel' }, 1, free('smelter'), '§18 Items: steel, the first new product of the act; §24: one Smelter free'),
  X('letThereBeLight', 'Let There Be Light', 'light a {power:power} grid', 'coal', { k: 'counter', name: 'gridsLit' }, 1, free('pole', 2), '§18 Power: the first grid with power flowing; §24: two Poles free (150 each)'),
  X('clearAsGlass', 'Clear as Glass', 'deliver 1 {i:glass}', 'glass', { k: 'delivered', item: 'glass' }, 1, free('kiln'), '§18 Items: glass; §24: one Kiln free (3,000, a few minutes of early Act II income)'),
  X('thinkingWire', 'Thinking Wire', 'deliver 1 {i:circuit}', 'circuit', { k: 'delivered', item: 'circuit' }, 1, skin('circuitry'), '§18 Items: circuits by 3:00; §24: an Assembler skin'),
  X('heavyMetal', 'Heavy Metal', 'build a Mk2 machine', 'steel', { k: 'counter', name: 'mk2Built' }, 1, { k: 'cool', sub: 2 }, '§18 Machines: the first Mk2 of any kind; §24: Overdrive cools 2 s sooner'),
  X('spinDoctor', 'Spin Doctor', 'deliver 1 {i:motor}', 'motor', { k: 'delivered', item: 'motor' }, 1, skin('pinstripe'), '§18 Items: the motor, 420 coin; §24: an Assembler Mk2 skin'),
  X('redline', 'Redline', '{u:overdrive} Overdrive ×100', null, { k: 'counter', name: 'overdrives' }, 100, { k: 'cool', sub: 2 }, '§18 Overdrive: the click lever behind §16 rule 4; §24: Overdrive cools 2 s sooner'),
  X('cataloguer', 'Cataloguer', '{u:codex} log 10 items in the Codex', null, { k: 'counter', name: 'codex' }, 10, { k: 'drawer', add: 1 }, '§18 Customers: the Codex of Unit 7; §24: the Drawer holds 1 more (a catalogue keeps things)'),
  X('claimJumper', 'Claim Jumper', '{u:claim} buy a block of ore claims', 'ironOre', { k: 'counter', name: 'claimBlocks' }, 1, free('miner'), '§18 Land and deposits: the Survey Office; §24: one Miner free'),
  X('foldception', 'Foldception', '{u:fold} fold modules into one', null, { k: 'counter', name: 'nestedFolds' }, 1, skin('origami'), '§18 Nested folds; §24: a module skin'),
  X('stampCollector', 'Stamp Collector', 'stamp 25 module copies', null, { k: 'counter', name: 'stamps' }, 25, skin('postmark'), '§10 Stamp; §18; §24: a module skin'),
  X('greatDrill', 'Breaking Ground', "{u:mega} finish the Great Drill's stage 1", 'drillBit', { k: 'counter', name: 'megaStages' }, 1, skin('drillbit'), '§18 Megaproject #1, stage 1 by about 4:30; §24: a Miner skin'),
  // ================================================================== Act III (§21)
  X('upInTheAir', 'Up in the Air', '{u:district} place a module on the District', null, { k: 'counter', name: 'districtPlaced' }, 1, { k: 'routes', add: 5 }, '§21 The District: the act\'s first decision; §24: 5 more routes a floor (120, §21)'),
  X('skyLanes', 'Sky Lanes', '{u:district} fly a skiff route', null, { k: 'counter', name: 'routes' }, 1, { k: 'skiffs', add: 1 }, '§21 The District: skiff routes; §24: every route takes a skiff more (12, §21)'),
  X('fleetAdmiral', 'Fleet Admiral', '{u:district} buy 50 skiffs', null, { k: 'counter', name: 'skiffs' }, 50, { k: 'skiffs', add: 1 }, '§21 The District: about 750,000 coin of skiffs, an Act III evening; §24: a skiff more a route'),
  X('zoningBoard', 'Zoning Board', '{u:district} place 20 modules on the District', null, { k: 'counter', name: 'districtPlaced' }, 20, { k: 'routes', add: 5 }, '§21 The District: 20 modules, ROADMAP Milestone 7\'s performance case; §24: 5 more routes'),
  X('wardOfTheCity', 'Ward of the City', '{u:fold} fold a District group into one', null, { k: 'counter', name: 'districtFolds' }, 1, { k: 'drawer', add: 1 }, '§21 District folds: depth 3; §24: the Drawer holds 1 more'),
  X('wetWork', 'Wet Work', 'deliver 1 {i:solvent}', 'solvent', { k: 'delivered', item: 'solvent' }, 1, free('chemVat'), '§21 Tier 3: chemistry, the act\'s first new line; §24: one Chem Vat free (12,000)'),
  X('rollingAlong', 'Rolling Along', 'deliver 100 {i:bearing}', 'bearing', { k: 'delivered', item: 'bearing' }, 100, speed('bearing'), '§21 Tier 3: bearings; §24: bearings +5%'),
  X('greenThumb', 'Green Thumb', 'deliver 100 {i:produce}', 'produce', { k: 'delivered', item: 'produce' }, 100, speed('produce'), '§21 Tier 3: the Greenhouse, fed by a waste (sludge into fertilizer); §24: produce +5%'),
  X('thinkingCap', 'Thinking Cap', 'deliver 1 {i:processor}', 'processor', { k: 'delivered', item: 'processor' }, 1, { k: 'chute', add: 5 }, '§21 Tier 3: processors; §24: the Chute holds 5 more of each (20, §21)'),
  X('armsRace', 'Arms Race', 'deliver 1 {i:robotArm}', 'robotArm', { k: 'delivered', item: 'robotArm' }, 1, { k: 'chute', add: 5 }, '§21 Tier 3: the robot arm, 24,000 coin; §24: the Chute holds 5 more'),
  X('lunchIsServed', 'Lunch Is Served', 'deliver 1 {i:sandwichEngineer}', 'sandwichEngineer', { k: 'delivered', item: 'sandwichEngineer' }, 1, skin('apron'), '§21 Tier 3: the Autonomous Sandwich Engineer, the act\'s absurd last product; §24: an Assembler Mk2 skin'),
  X('cityInTheSky', 'City in the Sky', '{u:mega} raise the Floating City\'s Platform', null, { k: 'counter', name: 'megaStages' }, 4, { k: 'routes', add: 5 }, '§21 Megaprojects: the Great Drill\'s three stages, then the first of Act III\'s; §24: 5 more routes'),
  X('againstTheOdds', 'Against the Odds', 'win a Challenge', null, { k: 'counter', name: 'challengesWon' }, 1, coin(200), '§21 Challenges; §24: 200 coin a run'),
  X('fullHouse', 'Full House', 'win five Challenges', null, { k: 'counter', name: 'challengesWon' }, 5, coin(500), '§21 Challenges: the five of v1; §24: 500 coin a run (the Drawer\'s trophies cut to eight, 8 against its cap of 6)'),

  // ================================================================== Milestone 11 (§24)
  // ---- the long deliveries: every run counts, that product's craft +5%
  // (Act I's products at counts past the first run: the campaign bot made 10,000 gears and 5,000
  // Gizmos inside run 1, and a run-1 speed raises the peak run 2 must pass, §16 rule 3)
  life('tenThousandTeeth', 'A Mouthful of Teeth', 'gear', 50000, 'gears, the slice\'s workhorse (§3): the bot\'s run 1 makes 10,000 by 2.6 h, so this lands runs later'),
  life('sheetMetal', 'Sheet Metal', 'ironPlate', 100000, 'plates (§3): the bot\'s run 1 makes 20,000 by 3.8 h'),
  life('copperbottomed', 'Copper-Bottomed', 'copperWire', 100000, 'wire (§3): the bot\'s run 1 makes 20,000 by 2.9 h'),
  life('gizmoGalore', 'Gizmo Galore', 'gizmo', 50000, 'Gizmos, the slice-end chain\'s product (§13): the bot\'s run 1 makes 5,000 by 1.1 h'),
  life('steelTown', 'Steel Town', 'steel', 10000, 'steel, about 7 h of one S steel module (0.42/s, §18)'),
  life('glassHouse', 'Glass House', 'glass', 10000, 'glass, about 4.5 h of one S glass module (0.62/s, §18)'),
  life('setInStone', 'Set in Stone', 'concrete', 5000, 'concrete, about 3.5 h of one S concrete module (§18)'),
  life('fantasticPlastic', 'Fantastic Plastic', 'plastic', 5000, 'plastic, about 4.5 h of one S plastic module (0.31/s, §18)'),
  life('boardMeeting', 'Board Meeting', 'circuit', 3000, 'circuits, about 3.3 h of a circuit chain (0.25/s, §18)'),
  life('motorMouth', 'Motor Mouth', 'motor', 1000, 'motors, Act II\'s last product (§18)'),
  life('dissolved', 'Dissolved', 'solvent', 2000, 'solvent, Act III\'s first line (§21)'),
  life('bounceBack', 'Bounce Back', 'rubber', 1000, 'rubber (§21 Tier 3)'),
  life('fullyCharged', 'Fully Charged', 'battery', 1000, 'batteries (§21 Tier 3)'),
  life('bearingUp', 'Bearing Up', 'bearing', 2000, 'bearings (§21 Tier 3)'),
  life('shiftingGears', 'Shifting Gears', 'gearbox', 500, 'gearboxes (§21 Tier 3)'),
  life('commonSense', 'Common Sense', 'sensor', 500, 'sensors (§21 Tier 3)'),
  life('wellProcessed', 'Well Processed', 'processor', 500, 'processors (§21 Tier 3)'),
  life('atYourService', 'At Your Service', 'servo', 500, 'servos (§21 Tier 3)'),
  life('lunchRush', 'Lunch Rush', 'sandwich', 1000, 'sandwiches (§21 Tier 3)'),
  life('ribbitTick', 'Ribbit, Tick', 'clockworkFrog', 100, 'clockwork frogs (§21 Tier 3)'),
  life('brollyGood', 'Brolly Good', 'umbrella', 100, 'umbrellas (§21 Tier 3)'),
  life('lendAHand', 'Lend a Hand', 'robotArm', 100, 'robot arms, about 3-6 h of a Robot Arm group (0.005-0.01/s, §21)'),
  life('kitchenBrigade', 'Kitchen Brigade', 'sandwichEngineer', 25, 'Sandwich Engineers, about 2.5-3.5 h of an Engineer group (§21)'),
  life('clearSkies', 'Clear Skies', 'skyglassLens', 1000, 'skyglass lenses, Pebble Isle\'s (§22)'),
  life('hotMetal', 'Hot Metal', 'cinderAlloy', 1000, 'cinder alloy, Cinder Isle\'s (§22)'),
  life('coldSteel', 'Cold Steel', 'frostAlloy', 1000, 'frost alloy, Rime\'s (§22)'),
  life('oldNewTricks', 'Old Gears, New Tricks', 'relicGear', 1000, 'relic gears, the Old Works\' (§22)'),
  life('brainstorm', 'Brainstorm', 'stormCell', 500, 'storm cells (§22)'),
  life('dyedInTheWool', 'Dyed in the Wool', 'sunsetDye', 500, 'sunset dye (§22)'),
  life('farSighted', 'Far-Sighted', 'horizonLens', 200, 'horizon lenses (§22)'),
  life('weatherPermitting', 'Weather Permitting', 'pocketWeather', 20, 'Pocket Weathers (§22)'),
  life('goldenHour', 'Golden Hour', 'sunsetGenerator', 10, 'Portable Sunset Generators, Act IV\'s absurd product (§22)'),
  // ---- firsts of Acts II-IV: the machine that makes it, free, or room for it
  X('hardSet', 'Hard Set', 'deliver 1 {i:concrete}', 'concrete', { k: 'delivered', item: 'concrete' }, 1, free('mixer'), '§24 Trophy bonuses: the first concrete (§18); one Mixer free (4,000)'),
  X('blackGold', 'Black Gold', 'deliver 1 {i:plastic}', 'plastic', { k: 'delivered', item: 'plastic' }, 1, free('refinery'), '§24 Trophy bonuses: the first plastic (§18); one Refinery free (9,000)'),
  X('stretchy', 'Stretchy', 'deliver 1 {i:rubber}', 'rubber', { k: 'delivered', item: 'rubber' }, 1, free('chemVat'), '§24 Trophy bonuses: the first rubber (§21); one Chem Vat free'),
  X('sparkPlug', 'Spark Plug', 'deliver 1 {i:battery}', 'battery', { k: 'delivered', item: 'battery' }, 1, { k: 'chute', add: 5 }, '§24 Trophy bonuses: the first battery (§21); the Chute holds 5 more'),
  X('homeGrown', 'Home Grown', 'deliver 1 {i:produce}', 'produce', { k: 'delivered', item: 'produce' }, 1, free('greenhouse'), '§24 Trophy bonuses: the first produce (§21); one Greenhouse free (25,000)'),
  X('makingSense', 'Making Sense', 'deliver 1 {i:sensor}', 'sensor', { k: 'delivered', item: 'sensor' }, 1, { k: 'chute', add: 5 }, '§24 Trophy bonuses: the first sensor (§21); the Chute holds 5 more'),
  X('smallMotions', 'Small Motions', 'deliver 1 {i:servo}', 'servo', { k: 'delivered', item: 'servo' }, 1, { k: 'routes', add: 5 }, '§24 Trophy bonuses: the first servo (§21); 5 more routes a floor'),
  X('goodToGo', 'Good to Go', 'deliver 1 {i:sandwich}', 'sandwich', { k: 'delivered', item: 'sandwich' }, 1, free('assembler'), '§24 Trophy bonuses: the first sandwich (§21); one Assembler free'),
  X('itTicks', 'It Ticks', 'deliver 1 {i:clockworkFrog}', 'clockworkFrog', { k: 'delivered', item: 'clockworkFrog' }, 1, coin(500), '§24 Trophy bonuses: the first clockwork frog (§21); 500 coin a run'),
  X('upUpAway', 'Up, Up and Away', 'deliver 1 {i:weatherBalloon}', 'weatherBalloon', { k: 'delivered', item: 'weatherBalloon' }, 1, { k: 'skiffs', add: 1 }, '§24 Trophy bonuses: the first weather balloon (§21); a skiff more a route'),
  X('lookingGlass', 'Looking Glass', 'deliver 1 {i:skyglassLens}', 'skyglassLens', { k: 'delivered', item: 'skyglassLens' }, 1, speed('skyglassLens'), '§24 Trophy bonuses: Pebble Isle\'s first good (§22); lenses +5% (with Clear Skies, the product\'s 10% cap: an island\'s good, about the island)'),
  X('forgeAhead', 'Forge Ahead', 'deliver 1 {i:cinderAlloy}', 'cinderAlloy', { k: 'delivered', item: 'cinderAlloy' }, 1, free('smelterMk2'), '§24 Trophy bonuses: Cinder Isle\'s first good (§22); one Smelter Mk2 free (6,000)'),
  X('chillOut', 'Chill Out', 'deliver 1 {i:frostAlloy}', 'frostAlloy', { k: 'delivered', item: 'frostAlloy' }, 1, free('generator'), '§24 Trophy bonuses: Rime\'s first good (§22); one Generator free (2,600): a plant within 2 tiles warms a Rime line, where it is wanted'),
  X('handMeDowns', 'Hand-Me-Downs', 'deliver 1 {i:relicGear}', 'relicGear', { k: 'delivered', item: 'relicGear' }, 1, { k: 'repair', off: 0.1 }, '§24 Trophy bonuses: the Old Works\' first good (§22); ruins repair 10% cheaper'),
  X('bottledLightning', 'Bottled Lightning', 'deliver 1 {i:stormCell}', 'stormCell', { k: 'delivered', item: 'stormCell' }, 1, speed('stormCell'), '§24 Trophy bonuses: the first storm cell (§22); storm cells +5% (with Brainstorm, the 10% cap)'),
  X('pocketRain', 'Pocket Rain', 'deliver 1 {i:pocketWeather}', 'pocketWeather', { k: 'delivered', item: 'pocketWeather' }, 1, speed('pocketWeather'), '§24 Trophy bonuses: the first Pocket Weather (§22); Pocket Weathers +5% (with Weather Permitting, the 10% cap)'),
  X('sunsetStrip', 'Sunset Strip', 'deliver 1 {i:sunsetGenerator}', 'sunsetGenerator', { k: 'delivered', item: 'sunsetGenerator' }, 1, speed('sunsetGenerator'), '§24 Trophy bonuses: the first Sunset Generator (§22); Sunset Generators +5% (with Golden Hour, the 10% cap)'),
  // ---- tier 5 (§23): each a first, the impossible inventions
  X('whichTuesday', 'Which Tuesday?', 'deliver 1 {i:bottledTuesday}', 'bottledTuesday', { k: 'lifetime', item: 'bottledTuesday' }, 1, speed('bottledTuesday'), '§24 Trophy bonuses: a tier 5 first (§23); Bottled Tuesdays +5%, about the thing that earned it (not start coin: the review of 2026-10-22)'),
  X('youAreHere', 'You Are Here', 'deliver 1 {i:mapOfEverywhere}', 'mapOfEverywhere', { k: 'lifetime', item: 'mapOfEverywhere' }, 1, speed('mapOfEverywhere'), '§24 Trophy bonuses: a tier 5 first (§23); Maps of Everywhere +5%'),
  X('pocketIsle', 'Pocket Isle', 'deliver 1 {i:pocketIsland}', 'pocketIsland', { k: 'lifetime', item: 'pocketIsland' }, 1, { k: 'repair', off: 0.1 }, '§24 Trophy bonuses: the Old Works\' tier 5 (§23); ruins repair 10% cheaper'),
  X('hush', 'Hush', 'deliver 1 {i:quietEngine}', 'quietEngine', { k: 'lifetime', item: 'quietEngine' }, 1, speed('quietEngine'), '§24 Trophy bonuses: a tier 5 first (§23); Quiet Engines +5%'),
  X('stillFresh', 'Still Fresh', 'deliver 1 {i:everlastingSandwich}', 'everlastingSandwich', { k: 'lifetime', item: 'everlastingSandwich' }, 1, speed('everlastingSandwich'), '§24 Trophy bonuses: a tier 5 first (§23); Everlasting Sandwiches +5%'),
  X('upAndUp', 'Up and Up', 'deliver 1 {i:infiniteStaircase}', 'infiniteStaircase', { k: 'lifetime', item: 'infiniteStaircase' }, 1, speed('infiniteStaircase'), '§24 Trophy bonuses: a tier 5 first (§23); Infinite Staircases +5%'),
  // ---- the Codex (§24): completion, tier by tier
  X('codexI', 'Volume I', `{u:codex} every Act I item in the Codex (${CODEX_ITEMS[1].length})`, 'gizmo', { k: 'codexTier', tier: 1 }, CODEX_ITEMS[1].length, { k: 'drawer', add: 1 }, '§24 The Codex: tier 1 complete; the Drawer holds 1 more (one of eight Drawer trophies: 8 against the cap of 6)'),
  X('codexII', 'Volume II', `{u:codex} every Act II item in the Codex (${CODEX_ITEMS[2].length})`, 'motor', { k: 'codexTier', tier: 2 }, CODEX_ITEMS[2].length, { k: 'chute', add: 5 }, '§24 The Codex: tier 2 complete; the Chute holds 5 more'),
  X('codexIII', 'Volume III', `{u:codex} every Act III item in the Codex (${CODEX_ITEMS[3].length})`, 'sandwichEngineer', { k: 'codexTier', tier: 3 }, CODEX_ITEMS[3].length, { k: 'routes', add: 10 }, '§24 The Codex: tier 3 complete; 10 more routes'),
  X('codexIV', 'Volume IV', `{u:codex} every island good in the Codex (${CODEX_ITEMS[4].length})`, 'sunsetGenerator', { k: 'codexTier', tier: 4 }, CODEX_ITEMS[4].length, { k: 'lot', off: 0.05 }, '§24 The Codex: tier 4 complete (every island visited and worked); the World\'s and Beyond\'s lots 5% cheaper (§24 Acts IV-V\'s own, cap 40%)'),
  X('codexV', 'Volume V', `{u:codex} every impossible invention in the Codex (${CODEX_ITEMS[5].length})`, 'foldedUniverse', { k: 'codexTier', tier: 5 }, CODEX_ITEMS[5].length, { k: 'courier', sub: 0.2 }, '§24 The Codex: tier 5 complete (sold at Beyond\'s Dock); couriers 0.2 s quicker at the ends (§24 Acts IV-V\'s own, cap 1 s)'),
  X('codex25', 'Specimen Drawer', '{u:codex} log 25 items in the Codex', null, { k: 'codexAll' }, 25, { k: 'chute', add: 5 }, '§24 The Codex: 25 of the collection; the Chute holds 5 more'),
  X('codexComplete', 'Collection Complete', `{u:codex} every item in the Codex (${CODEX_TOTAL})`, 'foldedUniverse', { k: 'codexAll' }, CODEX_TOTAL, { k: 'ledger', off: 0.05 }, '§24 The Codex: everything Unit 7 collects, tier 5 last; Ledger orders want 5% less (§24 Acts IV-V\'s own, cap 35%: the Ledger asks for the collection too)', true),
  // ---- Reorganize (§19)
  X('freshStart', 'Fresh Start', '{u:reset} Reorganize', null, { k: 'counter', name: 'reorganizes' }, 1, coin(100), '§19 Reorganize; §24: 100 coin a run'),
  X('serialReorganizer', 'Serial Reorganizer', '{u:reset} Reorganize ×5', null, { k: 'counter', name: 'reorganizes' }, 5, coin(300), '§19 Reorganize, every 1-3 h; §24: 300 coin a run'),
  X('reorgVeteran', 'Old Hand', '{u:reset} Reorganize ×25', null, { k: 'counter', name: 'reorganizes' }, 25, coin(1000), '§19 Reorganize; §24: 1,000 coin a run, a Miner line and its smelters'),
  X('patentLeather', 'Patent Leather', '{u:patent} earn 50 Patents', null, { k: 'meta', name: 'patentsEarned' }, 50, { k: 'drawer', add: 1 }, '§19 Filing: about three runs\' worth; §24: the Drawer holds 1 more'),
  X('patentOffice', 'The Whole Office', '{u:patent} earn 200 Patents', null, { k: 'meta', name: 'patentsEarned' }, 200, coin(2000), '§19 Filing; §24: 2,000 coin a run'),
  X('tenPatents', 'Paper Trail', '{u:patent} buy 10 Patent nodes', null, { k: 'meta', name: 'patentNodes' }, 10, { k: 'drawer', add: 1 }, '§19 The Patent tree; §24: the Drawer holds 1 more'),
  X('wholeTree', 'Patent Pending, No Longer', '{u:patent} buy every Patent node', null, { k: 'meta', name: 'patentNodes' }, PATENT_IDS.length, coin(5000), '§19 The Patent tree, every node; §24: 5,000 coin a run'),
  X('keepsake', 'Keepsake', '{u:blueprint} keep a design in the Drawer', null, { k: 'counter', name: 'designsKept' }, 1, { k: 'drawer', add: 1 }, '§19 The Patent Drawer; §24: it holds 1 more'),
  X('dejaVu', 'Déjà Vu', '{u:blueprint} unfold 10 kept designs', null, { k: 'counter', name: 'keptUnfolds' }, 10, free('belt', 20), '§19 The Patent Drawer: unfold whole; §24: 20 belt tiles free'),
  X('muscleMemory', 'Muscle Memory', '{u:fold} 10 quick refolds', null, { k: 'counter', name: 'quickRefolds' }, 10, free('belt', 20), '§19 Refolding after a check; §24: 20 belt tiles free'),
  X('draughty', 'The Draughtsman Draws', '{u:blueprint} the Draughtsman unfolds 10 designs', null, { k: 'counter', name: 'draughtsmanUnfolds' }, 10, free('crate', 2), '§19 The Draughtsman; §24: 2 Buffer Crates free'),
  X('annexed', 'Annexed', '{u:factory} buy a Factory annex block', null, { k: 'counter', name: 'annexBlocks' }, 1, coin(500), '§19 The Factory annex; §24: 500 coin a run'),
  // ---- Relocate (§22)
  X('movingDay', 'Moving Day', '{u:relocate} Relocate', null, { k: 'counter', name: 'relocations' }, 1, { k: 'lot', off: 0.05 }, '§22 Relocate; §24: World and Beyond lots 5% cheaper (a new island\'s town buys its land again)'),
  X('islandHopper', 'Island Hopper', '{u:relocate} Relocate ×4', null, { k: 'counter', name: 'relocations' }, 4, { k: 'barge', add: 0.25 }, '§22 Relocate: four islands; §24: the World\'s barges a quarter tile a second faster (cap +1)'),
  X('grandTour', 'Grand Tour', '{u:relocate} visit all five islands', null, { k: 'meta', name: 'visited' }, 5, { k: 'lot', off: 0.05 }, '§22 The islands; §24: World and Beyond lots 5% cheaper (not start coin: the review of 2026-10-22)'),
  X('legacy50', 'Heirloom', '{u:legacy} earn 50 Legacy', null, { k: 'meta', name: 'legacyEarned' }, 50, { k: 'lot', off: 0.05 }, '§22 Legacy, about two worlds\' worth; §24: World and Beyond lots 5% cheaper'),
  X('legacyNodes5', 'Family Tree', '{u:legacy} buy 5 Legacy nodes', null, { k: 'meta', name: 'legacyNodes' }, 5, { k: 'lot', off: 0.05 }, '§22 The Legacy tree; §24: World and Beyond lots 5% cheaper'),
  X('tidyRuins', 'Tidy Ruins', 'clear 50 tiles of rubble', null, { k: 'counter', name: 'rubbleCleared' }, 50, { k: 'repair', off: 0.1 }, '§22 The Old Works: rubble; §24: ruins repair 10% cheaper'),
  X('restorer', 'Restorer', 'repair 20 ruins', null, { k: 'counter', name: 'repairs' }, 20, { k: 'repair', off: 0.1 }, '§22 The Old Works: ruins; §24: ruins repair 10% cheaper (the four repair trophies 40% against the cap of 30%)'),
  X('worldly', 'Worldly', '{u:world} place a module on the World', null, { k: 'counter', name: 'worldPlaced' }, 1, { k: 'lot', off: 0.05 }, '§22 The World floor; §24: its lots (and Beyond\'s) 5% cheaper'),
  X('crowdedWorld', 'Crowded World', '{u:world} place 25 modules on the World', null, { k: 'counter', name: 'worldPlaced' }, 25, { k: 'lot', off: 0.05 }, '§22 The World floor: a full first World (§23: 20-25 groups); §24: its lots 5% cheaper, room for the next'),
  X('smallWorld', 'Small World', '{u:fold} fold a World group into one', null, { k: 'counter', name: 'worldFolds' }, 1, { k: 'lot', off: 0.05 }, '§23 Depth-4 folds; §24: World and Beyond lots 5% cheaper'),
  X('lighthouseKeeper', 'Lighthouse Keeper', '{u:mega} light every stage of the Lighthouse', null, { k: 'mega', id: 'lighthouse' }, MEGAS.lighthouse.stages.length, { k: 'barge', add: 0.25 }, '§22 Megaprojects #4, whose Lens Room flies barges a tile faster; §24: barges a quarter tile a second more'),
  X('anchorsAweigh', 'Anchors Aweigh', '{u:mega} moor every stage of the Sky Anchor', null, { k: 'mega', id: 'anchor' }, MEGAS.anchor.stages.length, { k: 'lot', off: 0.05 }, '§22 Megaprojects #5, the Sky Anchor that holds the World\'s lots; §24: World and Beyond lots 5% cheaper'),
  X('cityComplete', 'Spires', '{u:mega} finish the Floating City', null, { k: 'mega', id: 'city' }, MEGAS.city.stages.length, { k: 'routes', add: 5 }, '§21 Megaprojects #2; §24: 5 more routes'),
  X('transmuted', 'Transmuted', '{u:mega} finish the Scrap Transmuter', null, { k: 'mega', id: 'transmuter' }, MEGAS.transmuter.stages.length, { k: 'heap', add: 50 }, '§21 Megaprojects #3: waste sells; §24: Slag Heaps hold 50 more (the heap trophies at 250 against the cap of 200)'),
  X('drillDone', 'Breakthrough', '{u:mega} finish the Great Drill', 'drillBit', { k: 'mega', id: 'drill' }, MEGA.length, free('miner', 2), '§19 The Great Drill, stages 2 and 3; §24: two Miners free'),
  // ---- the District and the high floors (§21)
  X('urbanPlanner', 'Urban Planner', '{u:district} fold 5 District groups', null, { k: 'counter', name: 'districtFolds' }, 5, { k: 'routes', add: 5 }, '§21 District folds; §24: 5 more routes'),
  X('airTraffic', 'Air Traffic Control', '{u:district} fly 50 routes', null, { k: 'counter', name: 'routes' }, 50, { k: 'routes', add: 5 }, '§21 Skiff routes; §24: 5 more routes'),
  X('armada', 'Armada', '{u:district} buy 250 skiffs', null, { k: 'counter', name: 'skiffs' }, 250, { k: 'skiffs', add: 1 }, '§21 Skiffs, several Act III evenings; §24: a skiff more a route'),
  X('realEstate', 'Real Estate', '{u:land} buy 5 high-floor lots', null, { k: 'counter', name: 'lots' }, 5, coin(2000), '§21 Lots; §24: 2,000 coin a run'),
  X('dispatcher', 'Dispatched', '{u:district} the Dispatcher sends 100 skiffs', null, { k: 'counter', name: 'dispatched' }, 100, { k: 'skiffs', add: 1 }, '§21 The Dispatcher; §24: a skiff more a route'),
  X('beyondFirst', 'Over the Edge', '{u:beyond} place a module Beyond', null, { k: 'counter', name: 'beyondPlaced' }, 1, { k: 'courier', sub: 0.2 }, '§23 Beyond, the fifth floor; §24: its couriers 0.2 s quicker at the ends (cap 1 s)'),
  X('beyondBusy', 'Busy Beyond', '{u:beyond} place 10 modules Beyond', null, { k: 'counter', name: 'beyondPlaced' }, 10, skin('mirrorBall'), '§23 Beyond; §24: a courier skin'),
  // ---- the Last Fold (§23)
  X('lastFold', 'Origami', '{u:lastFold} take the Last Fold', null, { k: 'counter', name: 'lastFolds' }, 1, { k: 'courier', sub: 0.2 }, '§23 The Last Fold, which opens Beyond; §24: couriers 0.2 s quicker at the ends (not start coin: the review of 2026-10-22)'),
  X('secondUniverse', 'Encore', '{u:lastFold} take the Last Fold ×2', null, { k: 'counter', name: 'lastFolds' }, 2, skin('seedling'), '§23 The second universe (110-120 h); §24: a skin for the Seed'),
  X('kernelNodes5', 'Rule Bender', '{u:kernel} buy 5 Kernel nodes', null, { k: 'meta', name: 'kernelNodes' }, 5, { k: 'ledger', off: 0.05 }, '§23 The Kernel tree, whose node opens the Ledger; §24: Ledger orders want 5% less (cap 35%)'),
  X('kernelTree', 'New Physics', '{u:kernel} buy every Kernel node', null, { k: 'meta', name: 'kernelNodes' }, KERNEL_IDS.length, { k: 'courier', sub: 0.2 }, '§23 The Kernel tree, every node (Beyond among them); §24: couriers 0.2 s quicker at the ends'),
  X('kernels50', 'Kernel of Truth', '{u:kernel} earn 50 Kernels', null, { k: 'meta', name: 'kernelsEarned' }, 50, { k: 'ledger', off: 0.05 }, '§23 Kernels: about two Last Folds; §24: Ledger orders want 5% less'),
  // ---- the Endless Ledger (§23)
  X('ledger10', 'Open Account', '{u:ledger} fill 10 Ledger orders', null, { k: 'counter', name: 'ledgerOrders' }, 10, { k: 'ledger', off: 0.05 }, '§23 The Endless Ledger; §24: its orders want 5% less (cap 35%)'),
  X('ledger50', 'Long Account', '{u:ledger} fill 50 Ledger orders', null, { k: 'counter', name: 'ledgerOrders' }, 50, { k: 'ledger', off: 0.05 }, '§23 The Endless Ledger; §24: its orders want 5% less'),
  X('ledger100', 'In the Black', '{u:ledger} fill 100 Ledger orders', null, { k: 'counter', name: 'ledgerOrders' }, 100, { k: 'ledger', off: 0.05 }, '§23 The Endless Ledger; §24: its orders want 5% less'),
  // ---- grades and audits (§10)
  X('flawless', 'Flawless', '{u:fold} fold a line graded S+', null, { k: 'counter', name: 'grade:S+' }, 1, { k: 'heap', add: 50 }, '§10 Grade S+, a zero-waste line; §24: Slag Heaps hold 50 more'),
  X('flawlessTen', 'Ten Out of Ten', '{u:fold} fold 10 lines graded S+', null, { k: 'counter', name: 'grade:S+' }, 10, { k: 'drawer', add: 1 }, '§10 Grade S+; §24: the Drawer holds 1 more'),
  X('honourRoll', 'Honour Roll', '{u:fold} fold 25 lines graded S', null, { k: 'counter', name: 'foldS' }, 25, free('belt', 20), '§10 Grade S; §24: 20 belt tiles free'),
  X('underReview', 'Under Review', '{u:clock} run 100 fold audits', null, { k: 'counter', name: 'audits' }, 100, free('splitter', 2), '§10 Audit; §24: two Splitters free'),
  X('hundredFolds', 'Fold Hundred', '{u:fold} fold 100 lines', null, { k: 'counter', name: 'folds' }, 100, free('merger', 2), '§10 Fold; §24: two Mergers free'),
  // ---- Challenges, Scenarios, the shelf
  X('tenChallenges', 'Tenacious', 'win 10 Challenges', null, { k: 'meta', name: 'challenges' }, 10, coin(2000), '§21 Challenges, §24: ten of the fifteen; 2,000 coin a run'),
  X('allChallenges', 'The Full Fifteen', 'win all 15 Challenges', null, { k: 'meta', name: 'challenges' }, 15, { k: 'barge', add: 0.25 }, '§21 Challenges, §24: all fifteen, Rough Seas and Light Fleet (the barges\' two) last; barges a quarter tile a second faster'),
  X('boardTinyIsland', 'Island Living', '{u:trophies} a best on Tiny Island', 'gizmo', { k: 'board', id: 'tinyIsland' }, 1, free('assembler'), '§21 Scenarios: Tiny Island; §24: one Assembler free'),
  X('boardRichOre', 'Little Power', '{u:trophies} a best on Rich Ore, Little Power', 'glass', { k: 'board', id: 'richOre' }, 1, free('kiln'), '§21 Scenarios: Rich Ore; §24: one Kiln free'),
  X('boardScarceBelts', 'Belt Tightening', '{u:trophies} a best on Scarce Belts', 'circuit', { k: 'board', id: 'scarceBelts' }, 1, free('belt', 20), '§21 Scenarios: Scarce Belts; §24: 20 belt tiles free'),
  X('boardPocket', 'Pocket Sized', '{u:trophies} a best on Pocket Workshop', 'gizmo', { k: 'board', id: 'pocketWorkshop' }, 1, free('press'), '§24 Scenarios: Pocket Workshop; one Press free'),
  X('boardSlag', 'Mountain Mover', '{u:trophies} a best on Slag Mountain', 'concrete', { k: 'board', id: 'slagMountain' }, 1, free('mixer'), '§24 Scenarios: Slag Mountain; one Mixer free'),
  X('boardAntique', 'Collector\'s Item', '{u:trophies} a best on the Antique Shop', 'motor', { k: 'board', id: 'antiqueShop' }, 1, free('smelter', 2), '§24 Scenarios: the Antique Shop; two Smelters free'),
  X('boardNight', 'Night Owl', '{u:trophies} a best on the Night Market', 'plastic', { k: 'board', id: 'nightMarket' }, 1, free('refinery'), '§24 Scenarios: the Night Market; one Refinery free'),
  X('boardThin', 'Fine Margins', '{u:trophies} a best on Thin Vein', 'gear', { k: 'board', id: 'thinVein' }, 1, free('miner'), '§24 Scenarios: Thin Vein; one Miner free'),
  X('allBoards', 'Puzzle Box', '{u:trophies} a best on all 8 boards', null, { k: 'meta', name: 'boards' }, 8, free('assemblerMk2'), '§24 The efficiency boards: every board\'s best; one Assembler Mk2 free (20,000, the dearest machine: §18)'),
  X('dressedUp', 'Dressed Up', 'own 5 skins', null, { k: 'meta', name: 'cosmetics' }, 5, coin(200), '§24 Cosmetics; 200 coin a run'),
  X('wardrobe', 'Wardrobe', 'own 20 skins', null, { k: 'meta', name: 'cosmetics' }, 20, coin(1000), '§24 Cosmetics; 1,000 coin a run'),
  X('dressRehearsal', 'Dress Rehearsal', 'wear a skin', null, { k: 'counter', name: 'skinsWorn' }, 1, { k: 'sparkLife', add: 2 }, '§24 Cosmetics: the skin picker; Sparks stay 2 s longer (they like the look)'),
  X('shelf50', 'Shelf Life', '{u:trophies} 50 trophies', null, { k: 'trophies' }, 50, coin(1000), '§24 The Trophy Shelf: a quarter of it, an Act II-III count; 1,000 coin a run'),
  X('shelf100', 'Mantelpiece', '{u:trophies} 100 trophies', null, { k: 'trophies' }, 100, coin(2000), '§24 The Trophy Shelf; 2,000 coin a run'),
  X('reputable', 'Reputable', 'every customer at reputation 3', null, { k: 'repMin' }, 3, coin(500), '§21 Orders: the four customers\' rep 3, the Committee last to meet (§19); §24: 500 coin a run'),
  X('unit7Friend', 'Specimen Collector', 'Unit 7 reputation 5', null, { k: 'rep', who: 'unit7' }, 5, { k: 'chute', add: 10 }, '§18 Customers: Unit 7\'s Field Notes; §24: the Chute holds 10 more'),
  X('voltaireFriend', 'Darling', 'Dame Voltaire reputation 5', null, { k: 'rep', who: 'voltaire' }, 5, free('pole', 4), '§18 Customers: Voltaire\'s High-Tension Lines; §24: four Poles free'),
  X('millionaire', 'Millionaire', 'earn {coin:1,000,000} in all', null, { k: 'lifetimeEarned' }, 1e6, coin(500), '§24 Trophy bonuses: a million coin over every run (§16: Act II); 500 coin a run'),
  X('billionaire', 'Billionaire', 'earn {coin:1,000,000,000} in all', null, { k: 'lifetimeEarned' }, 1e9, coin(5000), '§24 Trophy bonuses: a billion over every run (§16: Act III); 5,000 coin a run'),
  X('inspired', 'Inspired', '{research:research} 1,000 Inspiration clicks', null, { k: 'counter', name: 'inspiration' }, 1000, { k: 'cool', sub: 2 }, '§20 Inspiration; §24: Overdrive cools 2 s sooner'),
  X('floorIt', 'Floor It', '{u:overdrive} Overdrive ×10,000', null, { k: 'counter', name: 'overdrives' }, 10000, { k: 'cool', sub: 3 }, '§18 Overdrive, past the first runs (the campaign bot overdrives about 1,000 a run); §24: Overdrive cools 3 s sooner'),
  X('sparkCollector', 'Spark Collector', '{k:LMB} catch 100 Sparks', null, { k: 'counter', name: 'sparks' }, 100, { k: 'sparkLife', add: 3 }, '§6 Sparks, about 8 h of play; §24: Sparks stay 3 s longer'),

  // ================================================================== hidden (§24): "???" until earned
  X('repetitiveStrain', 'Repetitive Strain', '{k:LMB} ×100,000', null, { k: 'counter', name: 'clicks' }, 100000, { k: 'cool', sub: 3 }, '§24 Hidden trophies: a hundred thousand clicks (§1\'s 12 a second for 2.3 h straight); Overdrive cools 3 s sooner', true),
  X('spadeWork', 'Spade Work', '{k:LMB} shovel {i:slag} ×5,000', 'slag', { k: 'counter', name: 'shovels' }, 5000, { k: 'heap', add: 50 }, '§24 Hidden trophies: 5,000 shovels (the campaign bot shovels about 500 a run); Slag Heaps hold 50 more', true),
  X('slagMagnet', 'Slag Magnet', 'let machines choke on {i:slag} ×1,000', 'slag', { k: 'counter', name: 'slagJams' }, 1000, free('heap', 2), '§24 Hidden trophies: a thousand jams (the bot has about 100 a run); two Slag Heaps free', true),
  X('notTheHint', 'Missing the Hint', '{k:LMB} crank the Hand Furnace ×300', 'ironIngot', { k: 'counter', name: 'cranks' }, 300, coin(15), '§24 Hidden trophies: the Bellows costs less than 300 cranks\' worth (§6); 15 coin a run', true),
  X('changedMyMind', 'Changed My Mind', 'give up a Challenge', null, { k: 'counter', name: 'challengesQuit' }, 1, coin(50), '§24 Hidden trophies: giving up costs nothing (§21); 50 coin a run', true),
  X('rubberStamp', 'Rubber Stamp', '{u:reset} the Standing Committee Reorganizes for you', null, { k: 'counter', name: 'standingReorganizes' }, 1, { k: 'lot', off: 0.05 }, '§24 Hidden trophies: the Standing Committee (§22, a Legacy node); World and Beyond lots 5% cheaper', true),
  X('participation', 'Participation Award', '{u:fold} fold a line graded D', null, { k: 'counter', name: 'grade:D' }, 1, free('belt', 10), '§24 Hidden trophies: a D still folds (§10); 10 belt tiles free', true),
  X('teaBreak', 'Tea Break', 'stop machines ×100', null, { k: 'counter', name: 'pauses' }, 100, coin(100), '§24 Hidden trophies: the stop button (§20); 100 coin a run (the Spark trophies cut to six, 14 s against the cap of 10)', true),
  X('theyKnow', 'They Know', '{research:research} 10,000 Inspiration clicks', null, { k: 'counter', name: 'inspiration' }, 10000, skin('tinfoil'), '§24 Hidden trophies: Inspiration (§20); a Hopper decoration', true),
  X('unit6', 'Unit 6', 'repair 100 ruins', 'relicGear', { k: 'counter', name: 'repairs' }, 100, skin('ghostly'), '§24 Hidden trophies: the Old Works (§22), Unit 7\'s Codex page; a module skin', true),
  X('smallSun', 'Pocket Sunrise', 'deliver 1 {i:verySmallSun}', 'verySmallSun', { k: 'lifetime', item: 'verySmallSun' }, 1, skin('sunburst'), '§24 Hidden trophies: a tier 5 first (§23); a Dock decoration', true),
  X('recursion', 'Recursion', 'deliver 1 {i:foldedUniverse}', 'foldedUniverse', { k: 'lifetime', item: 'foldedUniverse' }, 1, speed('foldedUniverse'), '§24 Hidden trophies: the Folded Universe Replica (§23); Replicas +5%', true),
  X('skyFull', 'Sky Full of Sails', '{u:district} buy 1,000 skiffs', null, { k: 'counter', name: 'skiffs' }, 1000, skin('paperCrane'), '§24 Hidden trophies: a thousand skiffs (§21); a skiff skin', true),
  X('perfectFold', 'Perfect Fold', '{u:lastFold} a Last Fold graded S or better', null, { k: 'seedS' }, 1, { k: 'courier', sub: 0.2 }, '§24 Hidden trophies: a World graded S at the Last Fold (§23); couriers 0.2 s quicker at the ends (not start coin)', true),
  X('thirdTime', 'Third Time Lucky', '{u:lastFold} take the Last Fold ×3', null, { k: 'counter', name: 'lastFolds' }, 3, { k: 'ledger', off: 0.05 }, '§24 Hidden trophies: the tree bought out (§23), the Ledger the endless part; its orders want 5% less', true),
  X('ledger500', 'The Long Tail', '{u:ledger} fill 500 Ledger orders', null, { k: 'counter', name: 'ledgerOrders' }, 500, { k: 'ledger', off: 0.05 }, '§24 Hidden trophies: the Ledger\'s 500th (§23); its orders want 5% less', true),
  X('fullShelf', 'Full Shelf', '{u:trophies} 150 trophies', null, { k: 'trophies' }, 150, { k: 'ledger', off: 0.05 }, '§24 Hidden trophies: the shelf nearly full, its last stickers Acts IV-V\'s; Ledger orders want 5% less (not start coin)', true),
];

export const TROPHY: Record<string, TrophyDef> = Object.fromEntries(TROPHIES.map((t) => [t.id, t]));

/** A trophy as the shelf shows it: a hidden one is "???" until earned. */
export function trophyFace(t: TrophyDef, earned: boolean): { name: string; desc: string; icon: ItemId | null; bonus: string } {
  if (!t.hidden || earned) return { name: t.name, desc: t.desc, icon: t.icon, bonus: bonusText(t.bonus) };
  return { name: '???', desc: '{soft:a hidden trophy}', icon: null, bonus: '{soft:???}' };
}

/** A building's name, plural: "Presses", "Slag Heaps", "Smelters Mk2" (the shelf said "Presss"). */
export function pluralName(name: string): string {
  const m = /^(.*?)( Mk\d)?$/.exec(name)!;
  const w = m[1];
  return (/(s|x|z|ch|sh)$/.test(w) ? w + 'es' : w + 's') + (m[2] ?? '');
}

/** The bonus as a row of markup for the shelf (DESIGN.md §24). */
export function bonusText(b: TrophyBonus): string {
  switch (b.k) {
    case 'speed': return `{i:${b.item}} crafts {good:+${Math.round(b.add * 100)}%}`;
    case 'free': return b.n > 1 ? `the first {good:${b.n}} ${pluralName(BUILD[b.kind].name)} free` : `the first ${BUILD[b.kind].name} free`;
    case 'skiffs': return `{u:district} {good:+${b.add}} skiff a route`;
    case 'routes': return `{u:district} {good:+${b.add}} routes a floor`;
    case 'drawer': return `{u:blueprint} Drawer {good:+${b.add}}`;
    case 'sparkLife': return `Sparks stay {good:+${b.add} s}`;
    case 'heap': return `Slag Heaps hold {good:+${b.add}}`;
    case 'startCoin': return `{coin:${b.add.toLocaleString('en-US')}} at each run's start`;
    case 'cool': return `{u:overdrive} cools {good:${b.sub} s} sooner`;
    case 'repair': return `ruins repair {good:${Math.round(b.off * 100)}%} cheaper`;
    case 'chute': return `{u:chute} holds {good:+${b.add}} of each`;
    case 'barge': return `{u:world} barges fly {good:+${b.add}} tiles/s`;
    case 'courier': return `{u:beyond} couriers load {good:${b.sub} s} quicker`;
    case 'lot': return `{u:claim} World and Beyond lots {good:${Math.round(b.off * 100)}%} cheaper`;
    case 'ledger': return `{u:ledger} Ledger orders want {good:${Math.round(b.off * 100)}%} less`;
    case 'cosmetic': return `a skin: ${cosmeticDef(b.id)?.name ?? b.id}`;
  }
}
