// Customers and their orders (DESIGN.md §7). Standing orders never expire; special orders are
// optional, never timed, and one is active at a time. Items delivered to the Dock fill the
// active order first, then sell.
import type { ItemId } from './items';
import type { ResearchId } from './research';

export type CustomerId = 'bramble' | 'unit7' | 'voltaire' | 'committee';

export interface CustomerDef {
  id: CustomerId;
  name: string;
  /** one line the customer says when an order is filled */
  thanks: string[];
  /** what each reputation level gives, from 1 */
  rewards: { rep: number; text: string }[];
  /** research after which the customer turns up (none: from the start) */
  meets?: ResearchId;
  /** a short line under the name */
  title: string;
  /** met only after the first Reorganize (with `meets` done in that run), or once the Great
   * Drill's stage 1 is built in any run (the Committee, DESIGN.md §19) */
  afterReset?: boolean;
  derivation: string;
}

export const CUSTOMERS: Record<CustomerId, CustomerDef> = {
  bramble: {
    id: 'bramble',
    name: 'Mayor Bramble',
    title: 'Mayor of the swamp town',
    thanks: [
      'Ribbit! The swamp thanks you.',
      'Splendid! The town council will hear of this. The town council is me.',
      'Oh my. Oh my oh my. I am going to need a bigger lily pad.',
    ],
    rewards: [
      { rep: 1, text: 'Iron plates sell for +20%' },
      { rep: 2, text: 'A free Buffer Crate every minute, up to 5' },
      { rep: 3, text: 'The Lily Pad Dock' },
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
      { rep: 1, text: 'The Codex opens: a first delivery of each item pays 30x its value' },
      { rep: 2, text: 'Recycled Glass: the Kiln makes glass from 3 gravel' },
      { rep: 3, text: 'Precision mode yields +35% instead of +25%' },
    ],
    derivation: '§18 Customers: Unit 7',
  },
  voltaire: {
    id: 'voltaire',
    name: 'Dame Voltaire',
    title: 'Baroness of the swamp\'s electricity',
    meets: 'steamPower',
    thanks: [
      'Marvellous, darling. The lights stay on another day.',
      'You have a talent for current. I have a talent for spending it.',
      'Charming. Bill the Mayor.',
    ],
    rewards: [
      { rep: 1, text: 'Boilers burn oil at 2x heat' },
      { rep: 2, text: 'Steam Engines make +25% power' },
      { rep: 3, text: 'Poles reach 1 tile further' },
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
      'We accept. On behalf of all of us. Of which there is one. Hello.',
      'The coat thanks you. The coat is very full now.',
      'A pleasure doing business. We were never here. Any of us. Him.',
    ],
    rewards: [
      { rep: 1, text: 'Coat Pockets: modules hold 6 s of each input and output (was 2), so a hiccup in a feed is ridden out' },
      { rep: 2, text: 'The Night Crew: every Slag Heap loses 1 slag every 10 s to the coat' },
      { rep: 3, text: 'Pocketed Kits: every stamp needs 1 Machine Kit fewer' },
    ],
    derivation: '§19 The Committee: met after the first Reorganize (Folding done in that run) or once the Great Drill stage 1 is built; pays in Raccoon Bearings, which the Great Drill stages 2 and 3 want; every reputation reward is a rule',
  },
};

export interface OrderDef {
  id: string;
  customer: CustomerId;
  name: string;
  /** what Bramble says when offering it */
  pitch: string;
  wants: Partial<Record<ItemId, number>>;
  pays: number;
  rep: number;
  /** research that must be done before it is offered */
  requires: ResearchId[];
  /** only deliveries to this Dock count (the Gizmo Festival: the Factory Dock) */
  at?: 'factory';
  /** Raccoon Bearings it pays into the stash (the Committee's orders, DESIGN.md §19) */
  bearings?: number;
  derivation: string;
}

export const ORDERS: OrderDef[] = [
  { id: 'boardwalk', customer: 'bramble', name: 'The Boardwalk', pitch: 'My frogs keep sinking. A boardwalk, please. Iron, flat.', wants: { ironPlate: 80 }, pays: 600, rep: 1, requires: ['pressing'], derivation: '§7 80 plates -> 600 + 1 rep: 1.5x value; 80 so a player who takes it the moment Pressing offers it (one plate line on the Dock) waits under 3 min for coin (§13 check 10)' },
  { id: 'lampPosts', customer: 'bramble', name: 'Lamp Posts', pitch: 'The swamp is dark at night. Gears to turn, wire to glow.', wants: { gear: 60, copperWire: 200 }, pays: 2000, rep: 1, requires: ['gearcutting', 'wireDrawing'], derivation: '§7 60 gears + 200 wire (1,240) -> 2,000 + 1 rep: 1.6x value; 60 gears, not 150: one order at a time, and at 150 its gears (research\'s until Folding) held the Gizmo Festival up ~9 min (pacing round 4)' },
  // Act II (DESIGN.md §18 Customers)
  { id: 'calibration', customer: 'unit7', name: 'Calibration Weights', pitch: 'UNIT 7 REQUIRES MASS. PRECISE MASS. STEEL MASS.', wants: { steel: 300 }, pays: 13000, rep: 1, requires: ['steelmaking'], derivation: '§18 Customers: 300 steel (6,600) -> 13,000: 2x' },
  { id: 'lensArray', customer: 'unit7', name: 'Lens Array', pitch: 'UNIT 7 WISHES TO SEE FURTHER. ALSO, SHINIER.', wants: { glass: 400, circuit: 60 }, pays: 34000, rep: 1, requires: ['circuits'], derivation: '§18 Customers: 400 glass + 60 circuits (15,600) -> 34,000: 2.2x' },
  { id: 'everything', customer: 'unit7', name: 'One of Everything', pitch: 'THE COLLECTION HAS GAPS. GAPS ARE INTOLERABLE.', wants: { steel: 20, glass: 20, concrete: 20, plastic: 20, circuit: 10, motor: 5 }, pays: 14500, rep: 1, requires: ['motors', 'concrete'], derivation: '§18 Customers: a sample of every tier-2 product (6,800 at Dock value) -> 14,500: 2.1x, inside the 1.5-2.5x band (the pacing audit)' },
  { id: 'streetlamps', customer: 'voltaire', name: 'Streetlamps', pitch: 'Light the swamp, darling. Every lane. Every lily.', wants: { circuit: 150, glass: 300 }, pays: 64000, rep: 1, requires: ['circuits'], derivation: '§18 Customers: 150 circuits + 300 glass (30,600) -> 64,000: 2.1x' },
  { id: 'promenade', customer: 'voltaire', name: 'Concrete Promenade', pitch: 'One must have somewhere to promenade. In shoes.', wants: { concrete: 800 }, pays: 56000, rep: 1, requires: ['concrete'], derivation: '§18 Customers: 800 concrete (25,600) -> 56,000: 2.2x' },
  { id: 'turbine', customer: 'voltaire', name: 'The Grand Turbine', pitch: 'Something enormous that hums. I will name it after myself.', wants: { motor: 40, steel: 600 }, pays: 85000, rep: 1, requires: ['motors'], derivation: '§18 Customers: 40 motors + 600 steel (38,800) -> 85,000: 2.2x' },
  // The Committee (DESIGN.md §19): weird orders for what nobody wants, paid in Raccoon Bearings
  // and reputation, no coin. While one of theirs wants slag, either Dock takes slag for it
  { id: 'thePile', customer: 'committee', name: 'The Pile', pitch: 'We require slag. A lot. Do not ask what for. We do not know either.', wants: { slag: 1500 }, pays: 0, rep: 1, bearings: 3, requires: ['folding'], derivation: '§19 The Committee: 1,500 slag, about 30 min of a slice Factory floor (five Iron ingots copies, about 0.75 slag/s to the Factory Dock), worth nothing at the Dock -> 3 bearings' },
  { id: 'midnightOil', customer: 'committee', name: 'Midnight Oil', pitch: 'Oil. For the coat. It squeaks.', wants: { oil: 600 }, pays: 0, rep: 1, bearings: 3, requires: ['refining'], derivation: '§19 The Committee: 600 oil, about an hour of the oil of two Plastic modules (0.075/s each) -> 3 bearings' },
  { id: 'brickThrone', customer: 'committee', name: 'The Brick Throne', pitch: 'One of us wishes to be king. The other two wish to sit on him. Bricks.', wants: { slagBrick: 200 }, pays: 0, rep: 1, bearings: 3, requires: ['slagBricks'], derivation: '§19 The Committee: 200 slag bricks (800 slag through brick presses: a line nobody builds unless asked) -> 3 bearings' },
  { id: 'gravelGarden', customer: 'committee', name: 'Gravel Garden', pitch: 'A garden. Of gravel. For contemplation. And for hiding things.', wants: { gravel: 600 }, pays: 0, rep: 1, bearings: 3, requires: ['crushing'], derivation: '§19 The Committee: 600 gravel (1,200 slag through a crushing press) -> 3 bearings' },
  { id: 'shinyThings', customer: 'committee', name: 'Shiny Things', pitch: 'Shiny. Shinier. The shiniest. Also some wire, for the shiny.', wants: { glass: 300, copperWire: 600 }, pays: 0, rep: 1, bearings: 4, requires: ['glassworks'], derivation: '§19 The Committee: 300 glass + 600 wire (4,800 at Dock value, sold for nothing) -> 4 bearings' },
  { id: 'coatLining', customer: 'committee', name: 'The Lining', pitch: 'The coat needs a lining. Plastic. And motors. Do not look at the motors.', wants: { plastic: 200, motor: 10 }, pays: 0, rep: 1, bearings: 4, requires: ['motors'], derivation: '§19 The Committee: 200 plastic + 10 motors (11,200 at Dock value) -> 4 bearings' },
  { id: 'gizmoFestival', customer: 'bramble', name: 'The Gizmo Festival', pitch: 'A festival! Of Gizmos! By the crateload, from your Factory floor. I do not know what they do and neither will the guests.', wants: { gizmo: 400 }, pays: 64000, rep: 1, requires: ['folding'], at: 'factory', derivation: '§7 400 Gizmos (32,000) -> 64,000 + 1 rep: 2x; §11 only the Factory Dock counts, so the slice ends with a Gizmo module fed by gear and wire modules running at rate (the Milestone 3 gate review)' },
];

export const ORDER: Record<string, OrderDef> = Object.fromEntries(ORDERS.map((o) => [o.id, o]));
