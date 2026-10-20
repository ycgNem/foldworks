// Buildings on the Workshop floor (DESIGN.md §4). Prices are flat: no growth per purchase
// (PLAN.md not-list; DECISIONS.md 2026-10-20). Growth is limited by land, research and coin per
// machine-second.
import type { ResearchId } from './research';
import type { MachineKind } from './recipes';

export type BuildKind = 'belt' | 'miner' | 'smelter' | 'press' | 'assembler' | 'heap' | 'splitter' | 'merger' | 'crate';
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
  /** one-line description for the build bar tooltip */
  blurb: string;
  derivation: string;
}

export const BUILD: Record<EntKind, BuildDef> = {
  belt: { kind: 'belt', name: 'Belt', cost: 1, w: 1, h: 1, unlock: null, blurb: 'Moves items 2 tiles/s, one per tile: 120/min. Drag to lay a line.', derivation: '§4 Belt Mk1: 4 miners fill one belt' },
  miner: { kind: 'miner', name: 'Miner', cost: 40, w: 1, h: 1, unlock: null, machine: 'miner', blurb: 'Goes on ore. 30 ore/min out of its front.', derivation: '§4 Miner Mk1; §16 first miner before 2:00' },
  smelter: { kind: 'smelter', name: 'Smelter', cost: 60, w: 1, h: 1, unlock: null, machine: 'smelter', blurb: 'Ore in, ingots out the front: 30/min. 1 slag per 4 ingots out the sides.', derivation: '§4 Smelter Mk1; §3' },
  press: { kind: 'press', name: 'Press', cost: 150, w: 1, h: 1, unlock: 'pressing', machine: 'press', blurb: 'Ingot -> plate (40/min), copper ingot -> 2 wire, 4 slag -> brick.', derivation: '§4 Press Mk1; research 1' },
  assembler: { kind: 'assembler', name: 'Assembler', cost: 500, w: 1, h: 1, unlock: 'gearcutting', machine: 'assembler', blurb: '2 plates -> gear (30/min); gear + 3 wire -> Gizmo (15/min).', derivation: '§4 Assembler Mk1; research 5' },
  heap: { kind: 'heap', name: 'Slag Heap', cost: 25, w: 1, h: 1, unlock: null, capacity: 400, blurb: 'Takes slag from a machine beside it or a belt. Holds 400; empties out its front.', derivation: '§4 Slag Heap holds 400 (about 53 min of one smelter); §4 Byproducts' },
  splitter: { kind: 'splitter', name: 'Splitter', cost: 20, w: 1, h: 1, unlock: 'splitters', blurb: 'In at the back; out front, left and right in turn, skipping a blocked side.', derivation: '§4 Splitter; research 6' },
  merger: { kind: 'merger', name: 'Merger', cost: 20, w: 1, h: 1, unlock: 'splitters', blurb: 'In from back, left and right in turn; out the front.', derivation: '§4 Merger; research 6' },
  crate: { kind: 'crate', name: 'Buffer Crate', cost: 30, w: 1, h: 1, unlock: 'buffers', capacity: 50, blurb: 'Holds 50, first in first out, out the front.', derivation: '§4 Buffer Crate; research 7' },
  furnace: { kind: 'furnace', name: 'Hand Furnace', cost: 0, w: 1, h: 1, unlock: null, machine: 'smelter', blurb: 'Crank it: each click is 0.25 s of smelting. The Bellows makes it run itself.', derivation: '§4 Hand Furnace; §6 Cranking' },
  dock: { kind: 'dock', name: 'Dock', cost: 0, w: 2, h: 2, unlock: null, blurb: 'Buys everything but slag. Fills the active order first.', derivation: '§4 Dock; §7' },
  hopper: { kind: 'hopper', name: 'Hopper', cost: 0, w: 2, h: 2, unlock: null, blurb: 'Takes anything. Counts toward the selected research.', derivation: '§4 Hopper; §8' },
};

/** The build bar, in slot order (keys 1-9). */
export const BUILD_BAR: BuildKind[] = ['belt', 'miner', 'smelter', 'press', 'assembler', 'heap', 'splitter', 'merger', 'crate'];

export function isMachine(k: EntKind): boolean {
  return k === 'miner' || k === 'smelter' || k === 'press' || k === 'assembler' || k === 'furnace';
}

/** One-off upgrades bought with coin. */
export const UPGRADES = {
  bellows: { id: 'bellows', name: 'Bellows', cost: 25, blurb: 'The Hand Furnace runs itself: 2.0 s per ingot, no cranking.', derivation: '§4 Bellows; §16 first purchase at 20-40 s' },
} as const;
export type UpgradeId = keyof typeof UPGRADES;
