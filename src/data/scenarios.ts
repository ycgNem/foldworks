// Scenarios v1 (DESIGN.md §21 Scenarios): puzzle boards played as a separate game in their own
// save slot. A board fixes the land, the research, the starting coin and one twist; the goal is the
// best fold of one product, measured one way. Personal bests are the app's (local storage), never
// the sim's. They open after the first Reorganize.
import type { ItemId } from './items';

export const SCENARIO_IDS = ['tinyIsland', 'richOre', 'scarceBelts'] as const;
export type ScenarioId = (typeof SCENARIO_IDS)[number];

/** How a board scores a fold of its product: per tile of the fold box, or its rate alone (always
 * the grade-applied rate of the design's main output). */
export type ScenarioMeasure = 'perTile' | 'rate';

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
    pitch: 'The ground is generous; the coal merchant is not. Fold the fastest steel you can power.',
    land: ['A', 'C', 'E', 'F'], research: 'act2', coin: 250000,
    miners: 2, power: 0.5,
    product: 'steel', measure: 'rate', unit: 'steel/min',
    derivation: '§21 Scenarios: Miners dig 2x and Steam Engines and Generators make 0.5x, so ore is free and kW dear: a fast steel fold is Mk2 smelters on twice the plant, or many Mk1s in one box; 250,000 coin is a steel line and its plant (§18 prices)',
  },
  scarceBelts: {
    id: 'scarceBelts', name: 'Scarce Belts',
    pitch: 'Forty belt tiles in the whole town. Circuits, as many as you can.',
    land: ['A', 'B', 'C', 'D', 'E', 'F'], research: 'act2', coin: 600000,
    belts: 40,
    product: 'circuit', measure: 'rate', unit: 'circuits/min',
    derivation: '§21 Scenarios: 40 belt tiles where an Act II circuit line lays about 60 (§18), so machines must face each other and feed by side intake and Crates; 600,000 coin buys every machine it can use',
  },
};
