// Customers and their orders (DESIGN.md §7). Standing orders never expire; special orders are
// optional, never timed, and one is active at a time. Items delivered to the Dock fill the
// active order first, then sell.
import type { ItemId } from './items';
import type { ResearchId } from './research';

export type CustomerId = 'bramble' | 'unit7' | 'voltaire';

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
  { id: 'calibration', customer: 'unit7', name: 'Calibration Weights', pitch: 'UNIT 7 REQUIRES MASS. PRECISE MASS. STEEL MASS.', wants: { steel: 300 }, pays: 9000, rep: 1, requires: ['steelmaking'], derivation: '§18 Customers: 300 steel (4,500) -> 9,000: 2x' },
  { id: 'lensArray', customer: 'unit7', name: 'Lens Array', pitch: 'UNIT 7 WISHES TO SEE FURTHER. ALSO, SHINIER.', wants: { glass: 400, circuit: 60 }, pays: 24000, rep: 1, requires: ['circuits'], derivation: '§18 Customers: 400 glass + 60 circuits (9,800) -> 24,000: 2.4x' },
  { id: 'everything', customer: 'unit7', name: 'One of Everything', pitch: 'THE COLLECTION HAS GAPS. GAPS ARE INTOLERABLE.', wants: { steel: 20, glass: 20, concrete: 20, plastic: 20, circuit: 10, motor: 5 }, pays: 9500, rep: 1, requires: ['motors', 'concrete'], derivation: '§18 Customers: a sample of every tier-2 product (4,420 at Dock value) -> 9,500: 2.1x, inside the 1.5-2.5x band (the pacing audit)' },
  { id: 'streetlamps', customer: 'voltaire', name: 'Streetlamps', pitch: 'Light the swamp, darling. Every lane. Every lily.', wants: { circuit: 150, glass: 300 }, pays: 40000, rep: 1, requires: ['circuits'], derivation: '§18 Customers: 150 circuits + 300 glass (18,900) -> 40,000: 2.1x' },
  { id: 'promenade', customer: 'voltaire', name: 'Concrete Promenade', pitch: 'One must have somewhere to promenade. In shoes.', wants: { concrete: 800 }, pays: 45000, rep: 1, requires: ['concrete'], derivation: '§18 Customers: 800 concrete (17,600) -> 45,000: 2.6x' },
  { id: 'turbine', customer: 'voltaire', name: 'The Grand Turbine', pitch: 'Something enormous that hums. I will name it after myself.', wants: { motor: 40, steel: 600 }, pays: 60000, rep: 1, requires: ['motors'], derivation: '§18 Customers: 40 motors + 600 steel (25,800) -> 60,000: 2.3x' },
  { id: 'gizmoFestival', customer: 'bramble', name: 'The Gizmo Festival', pitch: 'A festival! Of Gizmos! By the crateload, from your Factory floor. I do not know what they do and neither will the guests.', wants: { gizmo: 400 }, pays: 64000, rep: 1, requires: ['folding'], at: 'factory', derivation: '§7 400 Gizmos (32,000) -> 64,000 + 1 rep: 2x; §11 only the Factory Dock counts, so the slice ends with a Gizmo module fed by gear and wire modules running at rate (the Milestone 3 gate review)' },
];

export const ORDER: Record<string, OrderDef> = Object.fromEntries(ORDERS.map((o) => [o.id, o]));
