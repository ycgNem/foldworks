// Customers and their orders (DESIGN.md §7). Standing orders never expire; special orders are
// optional, never timed, and one is active at a time. Items delivered to the Dock fill the
// active order first, then sell.
import type { ItemId } from './items';
import type { ResearchId } from './research';

export type CustomerId = 'bramble';

export interface CustomerDef {
  id: CustomerId;
  name: string;
  /** one line the customer says when an order is filled */
  thanks: string[];
  /** what each reputation level gives, from 1 */
  rewards: { rep: number; text: string }[];
  derivation: string;
}

export const CUSTOMERS: Record<CustomerId, CustomerDef> = {
  bramble: {
    id: 'bramble',
    name: 'Mayor Bramble',
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
  derivation: string;
}

export const ORDERS: OrderDef[] = [
  { id: 'boardwalk', customer: 'bramble', name: 'The Boardwalk', pitch: 'My frogs keep sinking. A boardwalk, please. Iron, flat.', wants: { ironPlate: 400 }, pays: 3000, rep: 1, requires: ['pressing'], derivation: '§7 400 plates -> 3,000 + 1 rep: 1.5x value' },
  { id: 'lampPosts', customer: 'bramble', name: 'Lamp Posts', pitch: 'The swamp is dark at night. Gears to turn, wire to glow.', wants: { gear: 150, copperWire: 300 }, pays: 4500, rep: 1, requires: ['gearcutting', 'wireDrawing'], derivation: '§7 150 gears + 300 wire -> 4,500 + 1 rep: 1.6x value' },
  { id: 'gizmoFestival', customer: 'bramble', name: 'The Gizmo Festival', pitch: 'A festival! Of Gizmos! I do not know what they do and neither will the guests.', wants: { gizmo: 40 }, pays: 8000, rep: 1, requires: ['gizmoTheory'], derivation: '§7 40 Gizmos -> 8,000 + 1 rep + the Folding hint: 2.5x' },
];

export const ORDER: Record<string, OrderDef> = Object.fromEntries(ORDERS.map((o) => [o.id, o]));
