// The high floors (DESIGN.md §21 the District, §22 the World): platforms above the Factory built
// out of folded groups. There are no trunks up there: modules are joined by skiff routes, and a
// route's throughput is its skiffs times their load over the round trip, so distance matters
// (`routeRate`). One implementation runs both floors (src/sim/systems/high.ts); these are their
// numbers, each with its derivation.
import type { ResearchId } from './research';
import type { KernelId } from './kernels';

export type HighFloorId = 'district' | 'world' | 'beyond';

export interface HighFloorDef {
  id: HighFloorId;
  name: string;
  /** the research that opens it */
  opens: ResearchId | null;
  /** a Kernel node it also needs (Beyond, DESIGN.md §23) */
  kernel?: KernelId;
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
   * a round trip, and the first skiff's price */
  speed: number;
  load: number;
  dwell: number;
  skiffCost: number;
  /** each skiff paid for on the floor makes the next 1/skiffStep of skiffCost dearer (linear: the
   * n-th costs skiffCost x (1 + (n - 1) / skiffStep); DESIGN.md §21 "Skiffs and coin") */
  skiffStep: number;
  /** skiffs a route may hold */
  maxSkiffs: number;
  /** the fold box on this floor (a District fold makes a depth-3 module) */
  foldMax: number;
  derivation: string;
}

export const HIGH: Record<HighFloorId, HighFloorDef> = {
  district: {
    id: 'district', name: 'District', opens: 'zoning', depth: 2,
    w: 12, h: 10, lotCols: 2, lots: 3, lotBase: 4_000_000,
    dock: { x: 10, y: 1 }, hopper: { x: 10, y: 5 }, bay: { x: 0, y: 8 },
    speed: 2, load: 1, dwell: 1, skiffCost: 40000, skiffStep: 20, maxSkiffs: 12,
    foldMax: 8,
    derivation: '§21 The District: 12x10 (120 tiles, 1.25x the Factory\'s 96, each holding a group of 2-6 modules), three lots of 2x10 east of it at 4M x n (linear, the annex pattern, §19; the playability pass, §21 Skiffs and coin: they are bought when the routes run out, at 12-15 h on 400-730K a minute, so a lot is 6-20 min of income, and the three take the 24M of the 33M the bot banked by 15 h; at 1M x n, the second gate\'s price for the floor\'s opening income, the second lot was 3 min of 15 h income and coin piled up), Dock and Hopper at the east edge like the Factory\'s, the Bay at the south-west corner; skiffs fly 2 tiles/s with 1 item a trip and 1 s at the two ends (ship value, not bulk: the second gate): beside its consumer a skiff moves 0.5 a second, five tiles off 0.17, across the floor 0.08, against depth-2 flows of 0.06-1.1 a second, so a bulk feeder (glass, steel, solvent at 0.5-1 a second) must stand beside what it feeds, and a Servo group (0.1-0.2) can fly across the floor on two skiffs; the first skiff is 40,000 and each one more paid for on the floor 2,000 dearer (linear, skiffStep 20; the playability pass, §21 Skiffs and coin): 2 min of the 20K a minute the game makes when the District opens, 40 s of the 169K at 11 h with 37 flying, 45 s of the 646K at 14.75 h with 225 flying (it was 40,000 flat, 4 s of 15 h income, and coin piled up to 46M: the review), so a route across the floor (four to six skiffs) is 3-5 min of 15 h income, the critic\'s target per route, and a fleet of 225 costs about 60M, half of what the District earned by then (step 10 priced it at all of it); refunded at the last one\'s price, so lifting a skiff and buying it again is even',
  },
  world: {
    id: 'world', name: 'World', opens: 'charting', depth: 3,
    w: 16, h: 12, lotCols: 2, lots: 3, lotBase: 10_000_000,
    dock: { x: 14, y: 1 }, hopper: { x: 14, y: 5 }, bay: { x: 0, y: 10 },
    speed: 3, load: 2, dwell: 1.5, skiffCost: 250000, skiffStep: 40, maxSkiffs: 12,
    foldMax: 16,
    derivation: '§22 The World floor: 16x12 of depth-3 modules (192 tiles, 1.6x the District\'s 120), three lots of 2x12 at 10M x n (linear: 10-20 min of the 0.5-1M a minute an Act IV floor makes); barges fly 3 tiles/s with 2 a trip and 1.5 s at the ends (ship value, not bulk, as the District\'s skiffs since the second gate): beside its consumer a barge moves 0.92 a second, five tiles off 0.41, across the floor 0.16, against depth-3 flows of 0.02-0.3 a second for finished goods (an Engineer group, a Robot Arm group) and 0.5-1 for an island\'s bulk (alloys, lenses), so bulk stands beside what it feeds and finished goods fly; the first barge is 250,000 and each one more 6,250 dearer (linear, skiffStep 40: the District\'s rule at half its slope, as a barge carries 2-4x a skiff; the playability pass, not yet measured on the Act IV bot): 15-30 s of an Act IV floor\'s income for the first, 40-75 s with 60 flying',
  },
  beyond: {
    id: 'beyond', name: 'Beyond', opens: 'lastFold', kernel: 'beyond', depth: 4,
    w: 14, h: 10, lotCols: 2, lots: 2, lotBase: 100_000_000,
    dock: { x: 12, y: 1 }, hopper: { x: 12, y: 5 }, bay: { x: 0, y: 8 },
    speed: 4, load: 1, dwell: 2, skiffCost: 2_500_000, skiffStep: 40, maxSkiffs: 12,
    foldMax: 0,
    derivation: '§23 Beyond: the fifth floor (the Kernel node Beyond, and research The Last Fold in the run), 14x10 of depth-4 modules (140 tiles: a module is a World group of 2-6 groups, so fewer tiles hold more than the World\'s 192), two lots of 2x10 at 100M x n (linear: 10-50 min of the 2-10M a minute an Act V floor makes); couriers fly 4 tiles/s with 1 a trip and 2 s at the ends (ship value, not bulk, a third time): beside its consumer a courier moves 0.4 a second, five tiles off 0.22, across the floor with its lots 0.09, against depth-4 flows of 0.005-0.05 a second for tier 5 goods and 0.1-0.5 for the tier 4 bulk between them, so tier 4 stands beside what it feeds and tier 5 flies anywhere on one courier; the first courier is 2,500,000 and each one more 62,500 dearer (linear, skiffStep 40, as the World\'s barges; the playability pass, not yet measured): 15-75 s of an Act V floor\'s income for the first, 30 s-2 min with 40 flying; nothing folds on Beyond (it is the top of the world: a fold of the whole World is the Last Fold)',
  },
};

/** Items a second one skiff carries on a route this long (tiles, centre to centre). */
export function skiffRate(f: HighFloorDef, dist: number, load = f.load, speed = f.speed, dwell = f.dwell): number {
  return load / ((2 * Math.max(1, dist)) / speed + dwell);
}
