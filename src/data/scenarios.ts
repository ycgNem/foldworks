// Scenarios v1 (DESIGN.md §21 Scenarios): puzzle boards played as a separate game in their own
// save slot. A board fixes the land, the research, the starting coin and one twist; the goal is the
// best fold of one product, measured one way. They open after the first Reorganize. Milestone 11
// (DESIGN.md §24): five more boards, and the efficiency boards: each board's personal bests for
// output per tile, per kW and waste, kept in the town's `meta.boards` (src/sim/longtail.ts).
import type { ItemId } from './items';

export const SCENARIO_IDS = ['tinyIsland', 'richOre', 'scarceBelts',
  // Milestone 11 (DESIGN.md §24)
  'pocketWorkshop', 'slagMountain', 'antiqueShop', 'nightMarket', 'thinVein'] as const;
export type ScenarioId = (typeof SCENARIO_IDS)[number];

/** How a board scores a fold of its product: per tile of the fold box, its rate alone, or per kW
 * its machines draw (always the grade-applied rate of the design's main output, a minute). */
export type ScenarioMeasure = 'perTile' | 'rate' | 'perKw';

export interface ScenarioDef {
  id: ScenarioId;
  name: string;
  pitch: string;
  /** land chunks owned, and the only ones for sale (none are) */
  land: string[];
  /** research done at the start ('act1' / 'act2' mean every node of those acts but the Drill) */
  research: 'act1' | 'act2';
  coin: number;
  /** the twist */
  miners?: number;
  power?: number;
  belts?: number;
  /** Milestone 11's twists: fold boxes at most this size; no Slag Heaps built; no Mk2 machines */
  foldMax?: number;
  noHeaps?: boolean;
  mk1Only?: boolean;
  product: ItemId;
  measure: ScenarioMeasure;
  /** the score's unit, as the record card prints it */
  unit: string;
  derivation: string;
}

export const SCENARIOS: Record<ScenarioId, ScenarioDef> = {
  tinyIsland: {
    id: 'tinyIsland', name: 'Tiny Island',
    pitch: 'Two chunks of rock and a lot of ambition. Fold the most Gizmo out of every tile.',
    land: ['A', 'B'], research: 'act1', coin: 6000,
    product: 'gizmo', measure: 'perTile', unit: 'Gizmos/min a tile',
    derivation: '§21 Scenarios: chunks A and B (iron in A, copper in B: chunk A alone has no copper, so the doc\'s "chunk A only" became the two); 6,000 coin is a Gizmo line twice over (§4 prices); the score is compactness, §10\'s C read as a number',
  },
  richOre: {
    id: 'richOre', name: 'Rich Ore, Little Power',
    pitch: 'The ground is generous; the coal merchant is not. Fold the fastest glass you can power.',
    land: ['A', 'C', 'E', 'F'], research: 'act2', coin: 250000,
    miners: 2, power: 0.5,
    product: 'glass', measure: 'rate', unit: 'glass/min',
    derivation: '§21 Scenarios: Miners dig 2x and Steam Engines and Generators make 0.5x, so sand is free and kW dear: glass comes from the Kiln, a powered machine (steel did not: a Mk1 smelter draws none, the second gate), so the fastest glass fold is a plant sized to its kilns in Efficient mode; 250,000 coin is a glass line and its plant (§18 prices)',
  },
  scarceBelts: {
    id: 'scarceBelts', name: 'Scarce Belts',
    pitch: 'Forty belt tiles in the whole town. Circuits, as many as you can.',
    land: ['A', 'B', 'C', 'D', 'E', 'F'], research: 'act2', coin: 600000,
    belts: 40,
    product: 'circuit', measure: 'rate', unit: 'circuits/min',
    derivation: '§21 Scenarios: 40 belt tiles where an Act II circuit line lays about 60 (§18), so machines must face each other and feed by side intake and Crates; 600,000 coin buys every machine it can use',
  },
  // ---- Milestone 11 (DESIGN.md §24)
  pocketWorkshop: {
    id: 'pocketWorkshop', name: 'Pocket Workshop',
    pitch: 'Every fold box is 4×4. Fold the fastest Gizmo that fits in your pocket.',
    land: ['A', 'B'], research: 'act1', coin: 8000,
    foldMax: 4,
    product: 'gizmo', measure: 'rate', unit: 'Gizmos/min',
    derivation: '§24 Scenarios: the Small Boxes Challenge as a board (§21): a 4x4 box holds an Assembler and what feeds it, so the fastest Gizmo fold is the one whose ports carry the most in; 8,000 coin is the Tiny Island\'s Gizmo line twice over and its belts (§4 prices)',
  },
  slagMountain: {
    id: 'slagMountain', name: 'Slag Mountain',
    pitch: 'No Slag Heaps on the island. Every scrap of slag becomes concrete, or nothing runs.',
    land: ['A', 'C', 'E', 'F'], research: 'act2', coin: 300000,
    noHeaps: true,
    product: 'concrete', measure: 'perTile', unit: 'concrete/min a tile',
    derivation: '§24 Scenarios: the Clean Hands Challenge as a board (§21): slag -> gravel -> concrete (§18) inside one box, iron in A, C and F, sand in E; scored per tile, so the zero-waste line is also the compact one; 300,000 coin is a concrete line, its smelters and its plant (§18 prices)',
  },
  antiqueShop: {
    id: 'antiqueShop', name: 'The Antique Shop',
    pitch: 'Mk1 machines only, every chunk yours. Motors, as many as the old machines can make.',
    land: ['A', 'B', 'C', 'D', 'E', 'F'], research: 'act2', coin: 800000,
    mk1Only: true,
    product: 'motor', measure: 'rate', unit: 'motors/min',
    derivation: '§24 Scenarios: the Old Faithful Challenge as a board (§21): a motor is steel + 4 wire + a circuit (§18), every step of it Mk1, so the box is wide and the ratios are the puzzle; 800,000 coin buys the Mk1 machines of the six chunks (§18 prices)',
  },
  nightMarket: {
    id: 'nightMarket', name: 'Night Market',
    pitch: 'Coal and a little power. Fold the most plastic per kilowatt.',
    land: ['A', 'E', 'F'], research: 'act2', coin: 400000,
    power: 0.75,
    product: 'plastic', measure: 'perKw', unit: 'plastic/min a kW',
    derivation: '§24 Scenarios: the Refinery is the hungriest Act II machine (120 kW, §18) and makes plastic out of coal, so the score is plastic a minute per kW drawn by the box\'s machines: Efficient mode at 0.5x power and 0.75x speed (§18) scores 1.5x Normal\'s; Steam Engines and Generators at 0.75x; coal in E and F; 400,000 coin is a refinery line and its plant',
  },
  thinVein: {
    id: 'thinVein', name: 'Thin Vein',
    pitch: 'The ore is thin here: Miners dig half as fast. Gears, out of every tile you have.',
    land: ['A', 'B'], research: 'act1', coin: 8000,
    miners: 0.5,
    product: 'gear', measure: 'perTile', unit: 'gears/min a tile',
    derivation: '§24 Scenarios: Miners dig 15 ore a minute (§4\'s 30 halved), so a smelter needs two Miners and the patch is the limit; scored per tile of box, so the Miners crowd the patch and the press sits beside them; 8,000 coin is two gear lines (§4 prices)',
  },
};
