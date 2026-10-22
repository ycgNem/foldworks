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
  { id: 'A', name: 'Chunk A · the Yard', x: 0, y: 0, w: 8, h: 8, cost: 0, requires: null, derivation: '§9 chunk A: the starting land' },
  { id: 'B', name: 'Chunk B · Copper Bank', x: 8, y: 0, w: 8, h: 8, cost: 1000, requires: 'surveyEast', derivation: '§9 chunk B costs 1,000 after Survey East' },
  { id: 'C', name: 'Chunk C · Rust Hollow', x: 0, y: 8, w: 8, h: 8, cost: 1000, requires: 'gizmoTheory', derivation: '§9 chunk C costs 1,000 after Gizmo Theory: the spending is its ~3,000 of gear lines, bought one by one, not a long save (§13 checks 10, 11)' },
  { id: 'D', name: 'Chunk D · the Back Forty', x: 8, y: 8, w: 8, h: 8, cost: 12000, requires: 'folding', derivation: '§9 chunk D costs 12,000 after Folding' },
  { id: 'E', name: 'Chunk E · Coal Flats', x: 16, y: 0, w: 8, h: 8, cost: 60000, requires: 'coalSeams', derivation: '§18 Land: chunk E, 60,000 after Coal Seams: about 5 min of the slice-end factory (12,500/min with Overdrive and Sparks, 7,200 idle; it was 15,000, 1.2 min, the Milestone 4 review)' },
  { id: 'F', name: 'Chunk F · Ironside', x: 16, y: 8, w: 8, h: 8, cost: 120000, requires: 'steamPower', derivation: '§18 Land: chunk F, 120,000 after Steam Power: about 10 min of the early Act II factory (12,000/min)' },
];

export interface PatchDef {
  item: ItemId; x: number; y: number; w: number; h: number;
  /** a deep deposit: there only once the Great Drill has reached this stage (DESIGN.md §19) */
  stage?: number;
  derivation: string;
}

export const PATCHES: PatchDef[] = [
  { item: 'ironOre', x: 1, y: 2, w: 2, h: 2, derivation: '§5 iron in chunk A, beside the Hand Furnace' },
  { item: 'copperOre', x: 11, y: 2, w: 2, h: 2, derivation: '§5 copper in chunk B' },
  { item: 'ironOre', x: 2, y: 11, w: 2, h: 2, derivation: '§5 a second iron patch in chunk C' },
  { item: 'coal', x: 17, y: 2, w: 2, h: 2, derivation: '§18 Land: coal in chunk E' },
  { item: 'sand', x: 20, y: 5, w: 2, h: 2, derivation: '§18 Land: sand in chunk E' },
  { item: 'coal', x: 18, y: 11, w: 2, h: 2, derivation: '§18 Land: coal in chunk F' },
  { item: 'ironOre', x: 21, y: 13, w: 2, h: 2, derivation: '§18 Land: iron in chunk F' },
  // the Great Drill's stage 3 (Milestone 5) breaks into deep seams under chunk D: last in the list,
  // so every earlier patch keeps its index
  { item: 'ironOre', x: 9, y: 10, w: 2, h: 2, stage: 3, derivation: '§19 Great Drill stage 3: an iron deposit in chunk D, beside chunk C' },
  { item: 'copperOre', x: 13, y: 13, w: 2, h: 2, stage: 3, derivation: '§19 Great Drill stage 3: a copper deposit in chunk D, the second copper patch (copper claims gate the Gizmo chains)' },
];

/** The deposits there now: the deep ones once the Great Drill's stage has reached them. */
export function patchOpen(p: PatchDef, megaStage: number): boolean {
  return !p.stage || megaStage >= p.stage;
}

/** Deposit claims at the Survey Office (DESIGN.md §18 Land and deposits): the first block of 4
 * for each ore; each later block costs price x (1 + 0.5 b). */
export const CLAIM_PRICE: { item: ItemId; price: number; derivation: string }[] = [
  { item: 'ironOre', price: 25000, derivation: '§18 Land and deposits: iron claims 25,000 a block of 4, about 2 min of Act II income (12,000/min)' },
  { item: 'copperOre', price: 25000, derivation: '§18 Land and deposits: copper claims 25,000 a block of 4, about 2 min of Act II income' },
  { item: 'sand', price: 40000, derivation: '§18 Land and deposits: sand claims 40,000 a block of 4, about 3 min of Act II income' },
  { item: 'coal', price: 60000, derivation: '§18 Land and deposits: coal claims 60,000 a block of 4, about 5 min of Act II income (it is fuel too)' },
];

/** The Workshop's size in tiles: the four slice chunks, then Act II's two to the east. */
export const WORKSHOP = { w: 24, h: 16, derivation: '§9 the slice Workshop is 16x16; §18 Land: chunks E and F widen it to 24x16' };

/** What chunk A starts with (§9): the Hand Furnace beside the patch with a Slag Heap under it, a 3-tile belt from it whose
 * last tile turns into the Dock (rotate it to feed the Hopper instead), the Dock and the Hopper. */
export const START_LAYOUT: { kind: 'furnace' | 'belt' | 'dock' | 'hopper' | 'heap'; x: number; y: number; rot: 0 | 1 | 2 | 3 }[] = [
  { kind: 'furnace', x: 3, y: 3, rot: 0 },
  // a Slag Heap under the furnace: hand-smelting never jams before the first Miner (the Milestone
  // 3 gate review lost 100 s of clicks to it); the slag lesson comes with the first built line. It
  // faces east, so it empties into a second heap put beside it, never onto a belt below
  { kind: 'heap', x: 3, y: 4, rot: 0 },
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
  /** the Megaproject Bay (§18), placed when The Great Drill is researched */
  bay: { x: 0, y: 6 },
  /** trunk belts: 8 items/s, 2 coin a tile */
  trunkSpeed: 8,
  trunkCost: 2,
  /** the Factory Chute (DESIGN.md §21): one a floor */
  chuteCost: 5000,
  derivation: '§11 12x8; trunk belts 8 items/s (480/min), 2 coin per tile; §21 the Factory Chute 5,000 (a token, refunded when lifted: it routes, it makes nothing)',
};

/** The Factory annex (DESIGN.md §19): blocks of floor bought with coin east of the 12x8, beside
 * the Factory Dock, land like the Workshop's chunks (lost at a Reorganize). Each block is 2 columns
 * of 8 tiles; the n-th costs base x n, linear in blocks bought. */
export const ANNEX = {
  blocks: 3,
  cols: 2,
  base: 150000,
  requires: 'steamPower' as ResearchId,
  derivation: '§19 The Factory annex: up to 3 blocks of 2x8 tiles east of the floor (18x8 at most, half again its tiles), the n-th block base x n, linear (CLAUDE.md: no geometric curves): 150K, 300K, 450K, 900K in all, about half of the 1.8-2.3M an Act II run piles up by 4-5 h; the first block is 12 min of Act II income (12,500/min) for room for a Gizmo chain or two right at the Factory Dock\'s east face, so the Bay floor no longer pushes the coin chains out. After Steam Power, when Act II coin starts. East, not south, so the Floating City\'s +1 row (§15, Milestone 7) stays a row nobody can buy: the two never meet',
};

/** The widest the Factory floor gets (the 12 and the annex) and the most rows (the 8 and the Floating City's). */
export const FACTORY_MAX_W = FACTORY.w + ANNEX.blocks * ANNEX.cols;
export const FACTORY_MAX_H = FACTORY.h + 1;
