// Customers and their orders (DESIGN.md §7). Standing orders never expire; special orders are
// optional, never timed, and one is active at a time. Items delivered to the Dock fill the
// active order first, then sell.
import type { ItemId } from './items';
import type { ResearchId } from './research';

export type CustomerId = 'bramble' | 'unit7' | 'voltaire' | 'committee';

export interface CustomerDef {
  id: CustomerId;
  name: string;
  /** one line the customer says when an order is filled, in their own voice */
  thanks: string[];
  /** what each reputation level gives, from 1: a row of rich-text markup, no sentence */
  rewards: { rep: number; text: string }[];
  /** research after which the customer turns up (none: from the start) */
  meets?: ResearchId;
  /** a short line under the name */
  title: string;
  /** met after the first Reorganize (with `meets` done in that run), or in any run once the Great
   * Drill is researched there or its stage 1 stands (the Committee, DESIGN.md §19) */
  afterReset?: boolean;
  derivation: string;
}

export const CUSTOMERS: Record<CustomerId, CustomerDef> = {
  bramble: {
    id: 'bramble',
    name: 'Mayor Bramble',
    title: 'Mayor of the island town',
    thanks: [
      'Ribbit! The whole island thanks you!',
      'Splendid! The council will hear of this. I am the council.',
      'Oh my. Oh my oh my. I need a bigger lily pad!',
    ],
    rewards: [
      { rep: 1, text: '{i:ironPlate} sell for {good:+20%}' },
      { rep: 2, text: 'a free Buffer Crate every minute · up to 5' },
      { rep: 3, text: 'the Lily Pad Dock' },
      { rep: 4, text: 'the Skiff Club · skiffs carry {good:2} a trip, was 1' },
    ],
    derivation: '§7 Reputation (Bramble)',
  },
  unit7: {
    id: 'unit7',
    name: 'Unit 7',
    title: 'A collector. Of everything.',
    meets: 'coalSeams',
    thanks: [
      'SPECIMEN LOGGED. GRATITUDE SUBROUTINE: ENGAGED.',
      'THIS WILL BE CATALOGUED UNDER "MARVELLOUS". THE CATEGORY IS NEW.',
      'UNIT 7 IS PLEASED. UNIT 7 IS OFTEN PLEASED. THIS IS MORE.',
    ],
    rewards: [
      { rep: 1, text: '{u:codex} the Codex · a first delivery of each item pays {coinc:30×}' },
      { rep: 2, text: 'Recycled Glass · 3 {i:gravel} → {i:glass} in the Kiln' },
      { rep: 3, text: '{u:mode} Precision yields {good:+35%}, was +25%' },
      { rep: 4, text: 'Specimen Jars · the Chute holds {good:60} of each item, was 20' },
    ],
    derivation: '§18 Customers: Unit 7',
  },
  voltaire: {
    id: 'voltaire',
    name: 'Dame Voltaire',
    title: 'Baroness of the island\'s electricity',
    meets: 'steamPower',
    thanks: [
      'Marvellous, darling. The lights stay on another day.',
      'You have a talent for current. I, for spending it.',
      'Charming. Bill the Mayor.',
    ],
    rewards: [
      { rep: 1, text: 'Boilers burn {i:oil} at {good:2×} heat' },
      { rep: 2, text: 'Steam Engines {power:+25%}' },
      { rep: 3, text: 'Poles reach {good:+1} tile' },
      { rep: 4, text: 'Chem Vats and Greenhouses draw {power:half} the power' },
    ],
    derivation: '§18 Customers: Dame Voltaire',
  },
  committee: {
    id: 'committee',
    name: 'The Committee',
    title: 'Three raccoons in a trench coat',
    meets: 'folding',
    afterReset: true,
    thanks: [
      '"we accept." "on behalf of all of us." "which is one of us. hello."',
      '"the coat thanks you." "the coat is very full now." "burp."',
      '"pleasure doing business." "we were never here." "any of us. him."',
    ],
    rewards: [
      { rep: 1, text: 'Coat Pockets · modules hold 6 s of each input and output, was 2' },
      { rep: 2, text: 'the Night Crew · {u:overnight} away, each Slag Heap loses 1 {i:slag} per 10 s' },
      { rep: 3, text: '{u:mega} the Great Drill\'s stage 2 opens' },
      { rep: 4, text: 'Pocketed Kits · a stamp needs 1 {i:machineKit} fewer' },
      { rep: 5, text: '{u:mega} the Great Drill\'s stage 3 opens' },
      { rep: 6, text: 'Pocket Skiffs · a route\'s first skiff costs nothing' },
    ],
    derivation: '§19 The Committee: met with the Great Drill research in the first run, or after the first Reorganize once Folding is done; its reputation (kept through every reset) opens the Great Drill\'s stages 2 and 3 at 3 and 5, two orders a run, so stage 2 is the second run\'s and stage 3 the third\'s; every reputation reward is a rule',
  },
};

export interface OrderDef {
  id: string;
  customer: CustomerId;
  name: string;
  /** what the customer says when offering it, in their own voice (docs/hud-180.md voice guide) */
  pitch: string;
  wants: Partial<Record<ItemId, number>>;
  pays: number;
  rep: number;
  /** research that must be done before it is offered */
  requires: ResearchId[];
  /** only deliveries to this floor's Dock count (the Gizmo Festival: the Factory Dock) */
  at?: 'factory' | 'district' | 'world';
  derivation: string;
}

export const ORDERS: OrderDef[] = [
  { id: 'boardwalk', customer: 'bramble', name: 'The Boardwalk', pitch: 'My frogs keep falling off the edge! A boardwalk, please. Iron, flat.', wants: { ironPlate: 80 }, pays: 600, rep: 1, requires: ['pressing'], derivation: '§7 80 plates -> 600 + 1 rep: 1.5x value; 80 so a player who takes it the moment Pressing offers it (one plate line on the Dock) waits under 3 min for coin (§13 check 10)' },
  { id: 'lampPosts', customer: 'bramble', name: 'Lamp Posts', pitch: 'The island is so dark at night! Gears to turn, wire to glow.', wants: { gear: 60, copperWire: 200 }, pays: 2000, rep: 1, requires: ['gearcutting', 'wireDrawing'], derivation: '§7 60 gears + 200 wire (1,240) -> 2,000 + 1 rep: 1.6x value; 60 gears, not 150: one order at a time, and at 150 its gears (research\'s until Folding) held the Gizmo Festival up ~9 min (pacing round 4)' },
  // Act II (DESIGN.md §18 Customers)
  { id: 'calibration', customer: 'unit7', name: 'Calibration Weights', pitch: 'UNIT 7 REQUIRES MASS. PRECISE MASS. STEEL MASS.', wants: { steel: 300 }, pays: 13000, rep: 1, requires: ['steelmaking'], derivation: '§18 Customers: 300 steel (6,600) -> 13,000: 2x' },
  { id: 'lensArray', customer: 'unit7', name: 'Lens Array', pitch: 'UNIT 7 WISHES TO SEE FURTHER. ALSO, SHINIER.', wants: { glass: 400, circuit: 60 }, pays: 34000, rep: 1, requires: ['circuits'], derivation: '§18 Customers: 400 glass + 60 circuits (15,600) -> 34,000: 2.2x' },
  { id: 'everything', customer: 'unit7', name: 'One of Everything', pitch: 'THE COLLECTION HAS GAPS. GAPS ARE INTOLERABLE.', wants: { steel: 20, glass: 20, concrete: 20, plastic: 20, circuit: 10, motor: 5 }, pays: 14500, rep: 1, requires: ['motors', 'concrete'], derivation: '§18 Customers: a sample of every tier-2 product (6,800 at Dock value) -> 14,500: 2.1x, inside the 1.5-2.5x band (the pacing audit)' },
  { id: 'streetlamps', customer: 'voltaire', name: 'Streetlamps', pitch: 'Light the island, darling. Every lane. Every ledge.', wants: { circuit: 150, glass: 300 }, pays: 64000, rep: 1, requires: ['circuits'], derivation: '§18 Customers: 150 circuits + 300 glass (30,600) -> 64,000: 2.1x' },
  { id: 'promenade', customer: 'voltaire', name: 'Concrete Promenade', pitch: 'One must have somewhere to promenade, darling. In shoes.', wants: { concrete: 800 }, pays: 56000, rep: 1, requires: ['concrete'], derivation: '§18 Customers: 800 concrete (25,600) -> 56,000: 2.2x' },
  { id: 'turbine', customer: 'voltaire', name: 'The Grand Turbine', pitch: 'Something enormous that hums. I will name it after myself.', wants: { motor: 40, steel: 600 }, pays: 85000, rep: 1, requires: ['motors'], derivation: '§18 Customers: 40 motors + 600 steel (38,800) -> 85,000: 2.2x' },
  // The Committee (DESIGN.md §19): weird orders for what nobody wants, paid in reputation (which
  // opens the Great Drill\'s stages 2 and 3) and a little coin: 2x what the goods would fetch, waste
  // valued at what its first recipe makes of it (slag 1, as half a gravel; oil 3). While one of
  // theirs wants slag or oil, either Dock takes it for the order
  { id: 'thePile', customer: 'committee', name: 'The Pile', pitch: '"slag." "a lot of slag." "don\'t ask what for. we don\'t know either."', wants: { slag: 800 }, pays: 1600, rep: 1, requires: ['folding'], derivation: '§19 The Committee: 800 slag, about 20 min of the Bay floor\'s slag at the Factory Dock (an Iron ingots and a Steel copy send theirs there, about 40 a minute), so a run fills it while the Bay fills; 2x slag at 1 (half a gravel) -> 1,600 + 1 rep' },
  { id: 'midnightOil', customer: 'committee', name: 'Midnight Oil', pitch: '"oil." "for the coat." "it squeaks."', wants: { oil: 150 }, pays: 900, rep: 1, requires: ['refining'], derivation: '§19 The Committee: 150 oil, about 20 min of one Plastic module\'s oil (about 8 a minute) at a Dock; 600 was over an hour of two modules and the bot never filled it (the Milestone 5 review); 2x oil at 3 -> 900 + 1 rep' },
  { id: 'brickThrone', customer: 'committee', name: 'The Brick Throne', pitch: '"one of us wants a throne." "of bricks." "we\'ll sit on him."', wants: { slagBrick: 100 }, pays: 1200, rep: 1, requires: ['slagBricks'], derivation: '§19 The Committee: 100 slag bricks (400 slag through a brick press: a line nobody builds unless asked; 25 min of one press fed by two smelters) -> 2x 600 = 1,200 + 1 rep' },
  { id: 'gravelGarden', customer: 'committee', name: 'Gravel Garden', pitch: '"a garden." "of gravel." "for thinking. and for hiding things."', wants: { gravel: 300 }, pays: 1200, rep: 1, requires: ['crushing'], derivation: '§19 The Committee: 300 gravel (600 slag through a crushing press, about 15 min of the Bay floor\'s slag) -> 2x 600 = 1,200 + 1 rep' },
  { id: 'shinyThings', customer: 'committee', name: 'Shiny Things', pitch: '"shiny." "shinier." "wire for the shiny, ingots for the shinier."', wants: { copperWire: 1200, ironIngot: 600 }, pays: 8400, rep: 1, requires: ['steamPower'], derivation: '§19 The Committee: 1,200 wire + 600 ingots (4,200 at Dock value): what an Act II Factory floor sends its Dock anyway (two wire and two ingot copies beside the Dock: about 75 wire and 150 ingots a minute, so about 16 min), the second order a run fills beside The Pile; glass never reached a Dock on the bot floor (the review round) -> 8,400 (2x) + 1 rep' },
  { id: 'coatLining', customer: 'committee', name: 'The Lining', pitch: '"the coat needs a lining." "plastic." "and motors. don\'t look at the motors."', wants: { plastic: 200, motor: 10 }, pays: 22400, rep: 1, requires: ['motors'], derivation: '§19 The Committee: 200 plastic + 10 motors (11,200 at Dock value) -> 22,400 (2x) + 1 rep' },
  // Act III (DESIGN.md §21 Orders): tier 3 goods, about 2x what they fetch at the Dock (§7's rule);
  // none is tied to one floor's Dock, and none is timed
  { id: 'picnic', customer: 'bramble', name: 'Picnic on the Rim', pitch: 'A picnic! For the whole island! Sandwiches, please. Many, many sandwiches.', wants: { sandwich: 300 }, pays: 120000, rep: 1, requires: ['sandwiches'], derivation: '§21 Orders: 300 sandwiches (60,000 at the Dock) -> 120,000: 2x' },
  { id: 'chorus', customer: 'bramble', name: 'The Clockwork Chorus', pitch: 'The council wants a choir. The council is me. Tiny frogs that sing!', wants: { clockworkFrog: 100 }, pays: 380000, rep: 1, requires: ['servos'], derivation: '§21 Orders: 100 clockwork frogs (180,000) -> 380,000: 2.1x' },
  { id: 'umbrellas', customer: 'bramble', name: 'Umbrellas for the Mayor', pitch: 'It rains up here. From below, somehow. I need umbrellas that fold themselves!', wants: { umbrella: 30 }, pays: 720000, rep: 1, requires: ['robotics'], derivation: '§21 Orders: 30 umbrellas (360,000) -> 720,000: 2x' },
  { id: 'senses', customer: 'unit7', name: 'Calibrated Senses', pitch: 'UNIT 7 WISHES TO SENSE. EVERYTHING. AT ONCE.', wants: { sensor: 200 }, pays: 420000, rep: 1, requires: ['sensors'], derivation: '§21 Orders: 200 sensors (200,000) -> 420,000: 2.1x' },
  { id: 'specimens', customer: 'unit7', name: 'The Specimen Drawer', pitch: 'NEW SPECIMENS DETECTED. TEN OF EACH. FOR SCIENCE. AND FOR UNIT 7.', wants: { rubber: 10, battery: 10, bearing: 10, gearbox: 10, sensor: 10, processor: 10, servo: 10, sandwich: 10 }, pays: 160000, rep: 1, requires: ['robotics', 'sandwiches'], derivation: '§21 Orders: ten of eight tier 3 goods (77,130 at the Dock) -> 160,000: 2.1x' },
  { id: 'ballet', customer: 'voltaire', name: 'The Servo Ballet', pitch: 'A ballet of motors that know where they are, darling. Opening night is whenever you say.', wants: { servo: 120 }, pays: 900000, rep: 1, requires: ['servos'], derivation: '§21 Orders: 120 servos (432,000) -> 900,000: 2.1x' },
  { id: 'gala', customer: 'voltaire', name: 'The Weather Gala', pitch: 'Balloons, darling. Clever ones. I intend to forecast my own party.', wants: { weatherBalloon: 60 }, pays: 600000, rep: 1, requires: ['sensors', 'batteries'], derivation: '§21 Orders: 60 weather balloons (276,000) -> 600,000: 2.2x' },
  { id: 'sludgePond', customer: 'committee', name: 'The Sludge Pond', pitch: '"sludge." "a pond of it." "we will swim. one of us will swim."', wants: { sludge: 2000 }, pays: 30000, rep: 1, requires: ['chemistry'], derivation: '§21 Orders: 2,000 sludge, about 30 min of two Solvent groups\' waste at a Dock, valued at what fertilizer makes of it (2 sludge + gravel -> 12: 5 a sludge) x 2 / 0.7 -> 30,000 + 1 rep; while it wants sludge, either Dock takes it' },
  { id: 'spareParts', customer: 'committee', name: 'Spare Parts', pitch: '"bearings." "gearboxes." "the coat has been making a noise."', wants: { bearing: 600, gearbox: 200 }, pays: 180000, rep: 1, requires: ['bearings'], derivation: '§21 Orders: 600 bearings + 200 gearboxes (91,800) -> 180,000: 2x' },
  { id: 'engineer', customer: 'committee', name: 'The Engineer', pitch: '"one engineer." "the sandwich kind." "it will make sandwiches for the coat."', wants: { sandwichEngineer: 1 }, pays: 200000, rep: 1, requires: ['sandwichEngineering'], derivation: '§21 Orders: one Autonomous Sandwich Engineer (90,000) -> 200,000: 2.2x, the act\'s joke and its deepest product' },
  { id: 'gizmoFestival', customer: 'bramble', name: 'The Gizmo Festival', pitch: 'A festival of Gizmos! Crates of them, from your Factory floor!', wants: { gizmo: 400 }, pays: 64000, rep: 1, requires: ['folding'], at: 'factory', derivation: '§7 400 Gizmos (32,000) -> 64,000 + 1 rep: 2x; §11 only the Factory Dock counts, so the slice ends with a Gizmo module fed by gear and wire modules running at rate (the Milestone 3 gate review)' },
];

export const ORDER: Record<string, OrderDef> = Object.fromEntries(ORDERS.map((o) => [o.id, o]));
