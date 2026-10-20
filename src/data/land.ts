// Land and floors (DESIGN.md §5, §9, §11). The Workshop is made of 8x8 chunks; A is owned at the
// start, the others are bought once research allows. Ore patches are 2x2.
import type { ResearchId } from './research';
import type { ItemId } from './items';

export interface ChunkDef {
  id: string;
  name: string;
  /** top-left tile */
  x: number;
  y: number;
  w: number;
  h: number;
  /** coin; 0 = owned from the start */
  cost: number;
  /** research needed before it can be bought */
  requires: ResearchId | null;
  derivation: string;
}

export const CHUNKS: ChunkDef[] = [
  { id: 'A', name: 'Chunk A', x: 0, y: 0, w: 8, h: 8, cost: 0, requires: null, derivation: '§9 chunk A: the starting land' },
  { id: 'B', name: 'Chunk B (copper)', x: 8, y: 0, w: 8, h: 8, cost: 1000, requires: 'surveyEast', derivation: '§9 chunk B costs 1,000 after Survey East' },
  { id: 'C', name: 'Chunk C (iron)', x: 0, y: 8, w: 8, h: 8, cost: 4000, requires: 'folding', derivation: '§9 chunk C costs 4,000 after Folding' },
  { id: 'D', name: 'Chunk D', x: 8, y: 8, w: 8, h: 8, cost: 12000, requires: 'folding', derivation: '§9 chunk D costs 12,000 after Folding' },
];

export interface PatchDef { item: ItemId; x: number; y: number; w: number; h: number; derivation: string }

export const PATCHES: PatchDef[] = [
  { item: 'ironOre', x: 1, y: 2, w: 2, h: 2, derivation: '§5 iron in chunk A, beside the Hand Furnace' },
  { item: 'copperOre', x: 11, y: 2, w: 2, h: 2, derivation: '§5 copper in chunk B' },
  { item: 'ironOre', x: 2, y: 11, w: 2, h: 2, derivation: '§5 a second iron patch in chunk C' },
];

/** The Workshop's size in tiles (the four slice chunks). */
export const WORKSHOP = { w: 16, h: 16, derivation: '§9 the full slice Workshop is 16x16' };

/** What chunk A starts with (§9): the Hand Furnace beside the patch, a 3-tile belt from it whose
 * last tile turns into the Dock (rotate it to feed the Hopper instead), the Dock and the Hopper. */
export const START_LAYOUT: { kind: 'furnace' | 'belt' | 'dock' | 'hopper'; x: number; y: number; rot: 0 | 1 | 2 | 3 }[] = [
  { kind: 'furnace', x: 3, y: 3, rot: 0 },
  { kind: 'belt', x: 4, y: 3, rot: 0 },
  { kind: 'belt', x: 5, y: 3, rot: 0 },
  { kind: 'belt', x: 6, y: 3, rot: 3 },
  { kind: 'dock', x: 6, y: 1, rot: 0 },
  { kind: 'hopper', x: 6, y: 4, rot: 0 },
];

/** The Factory floor (§11): 12x8 tiles of modules and trunk belts, Dock and Hopper at the east edge. */
export const FACTORY = {
  w: 12, h: 8,
  dock: { x: 10, y: 1 },
  hopper: { x: 10, y: 5 },
  /** trunk belts: 8 items/s, 2 coin a tile */
  trunkSpeed: 8,
  trunkCost: 2,
  derivation: '§11 12x8; trunk belts 8 items/s (480/min), 2 coin per tile',
};
