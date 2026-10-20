// Buildings on the Workshop floor (DESIGN.md §4). Prices are flat: no growth per purchase
// (PLAN.md not-list; DECISIONS.md 2026-10-20). Growth is limited by land, research and coin per
// machine-second.
import type { ResearchId } from './research';
import type { MachineKind } from './recipes';
import type { ItemId } from './items';

export type BuildKind = 'belt' | 'miner' | 'smelter' | 'press' | 'assembler' | 'heap' | 'splitter' | 'merger' | 'crate'
  // Act II (DESIGN.md §18)
  | 'boiler' | 'steamEngine' | 'generator' | 'pole' | 'kiln' | 'mixer' | 'refinery' | 'smelterMk2' | 'pressMk2' | 'assemblerMk2';
export type FixedKind = 'furnace' | 'dock' | 'hopper';
export type EntKind = BuildKind | FixedKind;

export interface BuildDef {
  kind: EntKind;
  name: string;
  /** coin; 0 for the fixed buildings */
  cost: number;
  w: number;
  h: number;
  /** research that unlocks it (null: from the start) */
  unlock: ResearchId | null;
  /** the recipe family it crafts, for machines */
  machine?: MachineKind;
  /** holds this many items (crate, heap) */
  capacity?: number;
  /** kW drawn while crafting (powered machines, DESIGN.md §18 Power) */
  kw?: number;
  /** kW made, and the fuel it burns: seconds per item at full load */
  power?: number;
  fuel?: { items: ItemId[]; seconds: number };
  /** craft speed against its family's recipe times (Mk2: 3) */
  speed?: number;
  /** an Act II building: stamping a design that holds one costs Machine Kits */
  act2?: boolean;
  /** one-line description for the build bar tooltip */
  blurb: string;
  derivation: string;
}

export const BUILD: Record<EntKind, BuildDef> = {
  belt: { kind: 'belt', name: 'Belt', cost: 1, w: 1, h: 1, unlock: null, blurb: 'Moves items 2 tiles/s, one per tile: 120/min. Drag to lay a line.', derivation: '§4 Belt Mk1: 4 miners fill one belt' },
  miner: { kind: 'miner', name: 'Miner', cost: 40, w: 1, h: 1, unlock: null, machine: 'miner', blurb: 'Goes on ore. 30 ore/min out of its front.', derivation: '§4 Miner Mk1; §16 first miner before 2:00' },
  smelter: { kind: 'smelter', name: 'Smelter', cost: 60, w: 1, h: 1, unlock: null, machine: 'smelter', blurb: 'Ore in, ingots out the front: 30/min. 1 slag per 4 ingots out the sides.', derivation: '§4 Smelter Mk1; §3' },
  press: { kind: 'press', name: 'Press', cost: 150, w: 1, h: 1, unlock: 'pressing', machine: 'press', blurb: 'Ingot -> plate (40/min), copper ingot -> 2 wire, 4 slag -> brick.', derivation: '§4 Press Mk1; research 1' },
  assembler: { kind: 'assembler', name: 'Assembler', cost: 500, w: 1, h: 1, unlock: 'gearcutting', machine: 'assembler', blurb: '2 plates -> gear (30/min); gear + 2 wire -> Gizmo (15/min).', derivation: '§4 Assembler Mk1; research 5' },
  heap: { kind: 'heap', name: 'Slag Heap', cost: 25, w: 1, h: 1, unlock: null, capacity: 400, blurb: 'Takes slag from a machine beside it or a belt. Holds 400; empties out its front.', derivation: '§4 Slag Heap holds 400 (about 53 min of one smelter); §4 Byproducts' },
  splitter: { kind: 'splitter', name: 'Splitter', cost: 20, w: 1, h: 1, unlock: 'splitters', blurb: 'In at the back; out front, left and right in turn, skipping a blocked side.', derivation: '§4 Splitter; research 6' },
  merger: { kind: 'merger', name: 'Merger', cost: 20, w: 1, h: 1, unlock: 'splitters', blurb: 'In from back, left and right in turn; out the front.', derivation: '§4 Merger; research 6' },
  crate: { kind: 'crate', name: 'Buffer Crate', cost: 30, w: 1, h: 1, unlock: 'buffers', capacity: 50, blurb: 'Holds 50, first in first out, out the front.', derivation: '§4 Buffer Crate; research 7' },
  furnace: { kind: 'furnace', name: 'Hand Furnace', cost: 0, w: 1, h: 1, unlock: null, machine: 'smelter', blurb: 'Crank it: each click is 0.25 s of smelting. The Bellows makes it run itself.', derivation: '§4 Hand Furnace; §6 Cranking' },
  dock: { kind: 'dock', name: 'Dock', cost: 0, w: 2, h: 2, unlock: null, blurb: 'Buys everything but slag. Fills the active order first.', derivation: '§4 Dock; §7' },
  hopper: { kind: 'hopper', name: 'Hopper', cost: 0, w: 2, h: 2, unlock: null, blurb: 'Takes anything. Counts toward the selected research.', derivation: '§4 Hopper; §8' },
  // Act II: power (DESIGN.md §18 Power)
  boiler: { kind: 'boiler', name: 'Boiler', cost: 120, w: 1, h: 1, unlock: 'steamPower', fuel: { items: ['coal', 'oil'], seconds: 4 }, act2: true, blurb: 'Burns coal or oil (1 per 4 s at full load) and steams the Steam Engine at its front.', derivation: '§18 Power: boiler 120, 1 fuel per 4 s' },
  steamEngine: { kind: 'steamEngine', name: 'Steam Engine', cost: 200, w: 1, h: 1, unlock: 'steamPower', power: 300, act2: true, blurb: '300 kW while a Boiler faces it. A Pole within 2 tiles joins it to a grid.', derivation: '§18 Power: 300 kW; 1,200 kJ per coal with its boiler' },
  generator: { kind: 'generator', name: 'Generator', cost: 260, w: 1, h: 1, unlock: 'steamPower', power: 200, fuel: { items: ['coal'], seconds: 3 }, act2: true, blurb: 'One tile: burns 1 coal per 3 s for 200 kW. Half the energy from each coal of a boiler pair.', derivation: '§18 Power: 200 kW per tile at 600 kJ per coal, against the boiler pair at 150 kW per tile at 1,200 kJ: compactness against efficiency (the gate review)' },
  pole: { kind: 'pole', name: 'Pole', cost: 15, w: 1, h: 1, unlock: 'steamPower', act2: true, blurb: 'Powers everything within 2 tiles and joins Poles within 6 into one grid.', derivation: '§18 Power: reach 2, link 6' },
  // Act II: machines
  kiln: { kind: 'kiln', name: 'Kiln', cost: 300, w: 1, h: 1, unlock: 'glassworks', machine: 'kiln', kw: 60, act2: true, blurb: '2 sand -> glass (30/min). Needs power: 60 kW.', derivation: '§18 Items and Power: kiln 300, 60 kW' },
  mixer: { kind: 'mixer', name: 'Mixer', cost: 400, w: 1, h: 1, unlock: 'concrete', machine: 'mixer', kw: 80, act2: true, blurb: '2 gravel + sand -> concrete (20/min). Needs power: 80 kW.', derivation: '§18 Items and Power: mixer 400, 80 kW' },
  refinery: { kind: 'refinery', name: 'Refinery', cost: 900, w: 1, h: 1, unlock: 'refining', machine: 'refinery', kw: 120, act2: true, blurb: '2 coal -> plastic (15/min), 1 oil per 2 out a side. Needs power: 120 kW.', derivation: '§18 Items and Power: refinery 900, 120 kW' },
  smelterMk2: { kind: 'smelterMk2', name: 'Smelter Mk2', cost: 230, w: 2, h: 2, unlock: 'heavyMachines', machine: 'smelter', kw: 150, speed: 4, act2: true, blurb: '2x2. Smelts at 4x a Smelter (120 ingots/min, one belt). Needs power: 150 kW.', derivation: '§18 Mk2: 4x speed makes 120 ingots/min, exactly one Mk1 belt; 230 = 3.8x a Smelter (1.3x the three Mk1s it was first priced against, under the four it replaces), so the saved belts, ports and modes pay back its power' },
  pressMk2: { kind: 'pressMk2', name: 'Press Mk2', cost: 580, w: 2, h: 2, unlock: 'heavyMachines', machine: 'press', kw: 120, speed: 4, act2: true, blurb: '2x2. Presses at 4x a Press. Needs power: 120 kW.', derivation: '§18 Mk2: 4x speed; 580 = 3.9x a Press (1.3x three Mk1s, under the four it replaces); 120 kW' },
  assemblerMk2: { kind: 'assemblerMk2', name: 'Assembler Mk2', cost: 1950, w: 2, h: 2, unlock: 'heavyMachines', machine: 'assembler', kw: 200, speed: 4, act2: true, blurb: '2x2. Assembles at 4x an Assembler. Needs power: 200 kW.', derivation: '§18 Mk2: 4x speed; 1,950 = 3.9x an Assembler (1.3x three Mk1s, under the four it replaces); 200 kW' },
};

/** The build bar, in slot order (keys 1-9). */
export const BUILD_BAR: BuildKind[] = ['belt', 'miner', 'smelter', 'press', 'assembler', 'heap', 'splitter', 'merger', 'crate'];

/** The store's tabs of buildings (keys 1-9 pick from the tab that is open). */
export const STORE_TABS: { id: 'build' | 'power' | 'heavy'; name: string; kinds: BuildKind[] }[] = [
  { id: 'build', name: 'Build', kinds: BUILD_BAR },
  { id: 'power', name: 'Power', kinds: ['boiler', 'steamEngine', 'generator', 'pole'] },
  { id: 'heavy', name: 'Heavy', kinds: ['kiln', 'mixer', 'refinery', 'smelterMk2', 'pressMk2', 'assemblerMk2'] },
];

export function isMachine(k: EntKind): boolean {
  return k === 'miner' || k === 'smelter' || k === 'press' || k === 'assembler' || k === 'furnace'
    || k === 'kiln' || k === 'mixer' || k === 'refinery' || k === 'smelterMk2' || k === 'pressMk2' || k === 'assemblerMk2';
}

/** Buildings of the power grid (they are not crafting machines; they have their own pips). */
export function isPower(k: EntKind): boolean {
  return k === 'boiler' || k === 'steamEngine' || k === 'generator' || k === 'pole';
}

/** One-off upgrades bought with coin. */
export const UPGRADES = {
  bellows: { id: 'bellows', name: 'Bellows', cost: 25, blurb: 'The Hand Furnace runs itself: 2.0 s per ingot, no cranking.', derivation: '§4 Bellows; §16 first purchase at 20-40 s' },
} as const;
export type UpgradeId = keyof typeof UPGRADES;
