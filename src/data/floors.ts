// The high floors (DESIGN.md §21 the District, §22 the World): platforms above the Factory built
// out of folded groups. There are no trunks up there: modules are joined by skiff routes, and a
// route's throughput is its skiffs times their load over the round trip, so distance matters
// (`routeRate`). One implementation runs both floors (src/sim/systems/high.ts); these are their
// numbers, each with its derivation.
import type { ResearchId } from './research';

export type HighFloorId = 'district' | 'world';

export interface HighFloorDef {
  id: HighFloorId;
  name: string;
  /** the research that opens it */
  opens: ResearchId | null;
  /** the module depth it takes (the Factory takes 1 and 2) */
  depth: number;
  /** its size to start with, in tiles, and the lots bought east of it (columns each, how many) */
  w: number;
  h: number;
  lotCols: number;
  lots: number;
  /** the n-th lot costs lotBase x n (linear: CLAUDE.md, no geometric curves) */
  lotBase: number;
  /** its Dock, Hopper and Bay (2x2 each), top-left tiles on the first w x h */
  dock: { x: number; y: number };
  hopper: { x: number; y: number };
  bay: { x: number; y: number };
  /** the skiffs (barges on the World): tiles a second, items a trip, seconds loading and unloading
   * a round trip, and a skiff's flat price */
  speed: number;
  load: number;
  dwell: number;
  skiffCost: number;
  /** skiffs a route may hold */
  maxSkiffs: number;
  /** the fold box on this floor (a District fold makes a depth-3 module) */
  foldMax: number;
  derivation: string;
}

export const HIGH: Record<HighFloorId, HighFloorDef> = {
  district: {
    id: 'district', name: 'District', opens: 'zoning', depth: 2,
    w: 12, h: 10, lotCols: 2, lots: 3, lotBase: 2_000_000,
    dock: { x: 10, y: 1 }, hopper: { x: 10, y: 5 }, bay: { x: 0, y: 8 },
    speed: 2, load: 4, dwell: 1, skiffCost: 15000, maxSkiffs: 12,
    foldMax: 8,
    derivation: '§21 The District: 12x10 (120 tiles, 1.25x the Factory\'s 96, each holding a group of 2-6 modules), three lots of 2x10 east of it at 2M x n (linear, the annex pattern, §19), Dock and Hopper at the east edge like the Factory\'s, the Bay at the south-west corner; skiffs fly 2 tiles/s with 4 items a trip and 1 s at the two ends: beside its consumer a skiff moves 2.0/s, five tiles off 0.67, across the floor 0.32, against depth-2 rates of 0.1-3 items/s, so a feeder placed beside its consumer needs one skiff and across the floor three to six; a skiff is 15,000 (flat), about 10 s of the Act III factory',
  },
  world: {
    id: 'world', name: 'World', opens: null, depth: 3,
    w: 16, h: 12, lotCols: 2, lots: 3, lotBase: 40_000_000,
    dock: { x: 14, y: 1 }, hopper: { x: 14, y: 5 }, bay: { x: 0, y: 10 },
    speed: 3, load: 12, dwell: 1.5, skiffCost: 400000, maxSkiffs: 12,
    foldMax: 16,
    derivation: '§22 The World floor: 16x12 of depth-3 modules, barges (3 tiles/s, 12 a trip, 1.5 s at the ends: beside, 8/s; across 0.9) against depth-3 rates of 0.5-10/s; prices scaled by the Act IV factory (§22)',
  },
};

/** Items a second one skiff carries on a route this long (tiles, centre to centre). */
export function skiffRate(f: HighFloorDef, dist: number, load = f.load, speed = f.speed): number {
  return load / ((2 * Math.max(1, dist)) / speed + f.dwell);
}
