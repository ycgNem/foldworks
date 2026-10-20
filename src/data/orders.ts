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
  /** met after the first Reorganize (with `meets` done in that run), or in any run once the Great
   * Drill is researched there or its stage 1 stands (the Committee, DESIGN.md §19) */
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
      { rep: 1, text: 'Coat Pockets: modules hold 6 s of each input and output (was 2)' },
      { rep: 2, text: 'The Night Crew: while you are away, each Slag Heap loses a slag every 10 s' },
      { rep: 3, text: 'The Great Drill\'s stage 2 opens' },
      { rep: 4, text: 'Pocketed Kits: a stamp needs 1 Machine Kit fewer' },
      { rep: 5, text: 'The Great Drill\'s stage 3 opens' },
    ],
    derivation: '§19 The Committee: met with the Great Drill research in the first run, or after the first Reorganize once Folding is done; its reputation (kept through every reset) opens the Great Drill\'s stages 2 and 3 at 3 and 5, two orders a run, so stage 2 is the second run\'s and stage 3 the third\'s; every reputation reward is a rule',
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
  // The Committee (DESIGN.md §19): weird orders for what nobody wants, paid in reputation (which
  // opens the Great Drill\'s stages 2 and 3) and a little coin: 2x what the goods would fetch, waste
  // valued at what its first recipe makes of it (slag 1, as half a gravel; oil 3). While one of
  // theirs wants slag or oil, either Dock takes it for the order
  { id: 'thePile', customer: 'committee', name: 'The Pile', pitch: 'We require slag. A lot. Do not ask what for. We do not know either.', wants: { slag: 800 }, pays: 1600, rep: 1, requires: ['folding'], derivation: '§19 The Committee: 800 slag, about 20 min of the Bay floor\'s slag at the Factory Dock (an Iron ingots and a Steel copy send theirs there, about 40 a minute), so a run fills it while the Bay fills; 2x slag at 1 (half a gravel) -> 1,600 + 1 rep' },
  { id: 'midnightOil', customer: 'committee', name: 'Midnight Oil', pitch: 'Oil. For the coat. It squeaks.', wants: { oil: 150 }, pays: 900, rep: 1, requires: ['refining'], derivation: '§19 The Committee: 150 oil, about 20 min of one Plastic module\'s oil (about 8 a minute) at a Dock; 600 was over an hour of two modules and the bot never filled it (the Milestone 5 review); 2x oil at 3 -> 900 + 1 rep' },
  { id: 'brickThrone', customer: 'committee', name: 'The Brick Throne', pitch: 'One of us wishes to be king. The other two wish to sit on him. Bricks.', wants: { slagBrick: 100 }, pays: 1200, rep: 1, requires: ['slagBricks'], derivation: '§19 The Committee: 100 slag bricks (400 slag through a brick press: a line nobody builds unless asked; 25 min of one press fed by two smelters) -> 2x 600 = 1,200 + 1 rep' },
  { id: 'gravelGarden', customer: 'committee', name: 'Gravel Garden', pitch: 'A garden. Of gravel. For contemplation. And for hiding things.', wants: { gravel: 300 }, pays: 1200, rep: 1, requires: ['crushing'], derivation: '§19 The Committee: 300 gravel (600 slag through a crushing press, about 15 min of the Bay floor\'s slag) -> 2x 600 = 1,200 + 1 rep' },
  { id: 'shinyThings', customer: 'committee', name: 'Shiny Things', pitch: 'Shiny. Shinier. The shiniest. Wire, for the shiny. Ingots, for the shinier.', wants: { copperWire: 1200, ironIngot: 600 }, pays: 8400, rep: 1, requires: ['steamPower'], derivation: '§19 The Committee: 1,200 wire + 600 ingots (4,200 at Dock value): what an Act II Factory floor sends its Dock anyway (two wire and two ingot copies beside the Dock: about 75 wire and 150 ingots a minute, so about 16 min), the second order a run fills beside The Pile; glass never reached a Dock on the bot floor (the review round) -> 8,400 (2x) + 1 rep' },
  { id: 'coatLining', customer: 'committee', name: 'The Lining', pitch: 'The coat needs a lining. Plastic. And motors. Do not look at the motors.', wants: { plastic: 200, motor: 10 }, pays: 22400, rep: 1, requires: ['motors'], derivation: '§19 The Committee: 200 plastic + 10 motors (11,200 at Dock value) -> 22,400 (2x) + 1 rep' },
  { id: 'gizmoFestival', customer: 'bramble', name: 'The Gizmo Festival', pitch: 'A festival! Of Gizmos! By the crateload, from your Factory floor. I do not know what they do and neither will the guests.', wants: { gizmo: 400 }, pays: 64000, rep: 1, requires: ['folding'], at: 'factory', derivation: '§7 400 Gizmos (32,000) -> 64,000 + 1 rep: 2x; §11 only the Factory Dock counts, so the slice ends with a Gizmo module fed by gear and wire modules running at rate (the Milestone 3 gate review)' },
];

export const ORDER: Record<string, OrderDef> = Object.fromEntries(ORDERS.map((o) => [o.id, o]));
