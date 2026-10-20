// Research nodes (DESIGN.md §8). Each costs item deliveries to the Hopper; one is selected at a
// time and fills from matching deliveries; items delivered with nothing selected are banked.
import type { ItemId } from './items';

export const RESEARCH_IDS = [
  'pressing', 'surveyEast', 'copperSmelting', 'wireDrawing', 'gearcutting', 'splitters', 'buffers', 'gizmoTheory', 'slagBricks', 'folding',
] as const;
export type ResearchId = (typeof RESEARCH_IDS)[number];

export interface ResearchDef {
  id: ResearchId;
  num: number;
  name: string;
  cost: Partial<Record<ItemId, number>>;
  /** research that must be done first */
  requires: ResearchId[];
  /** what it unlocks, in words, for the panel */
  unlocks: string;
  derivation: string;
}

export const RESEARCH: Record<ResearchId, ResearchDef> = {
  pressing: { id: 'pressing', num: 1, name: 'Pressing', cost: { ironIngot: 30 }, requires: [], unlocks: 'the Press and iron plates', derivation: '§8 #1; §16 first research about 5 min' },
  surveyEast: { id: 'surveyEast', num: 2, name: 'Survey East', cost: { ironPlate: 40 }, requires: ['pressing'], unlocks: 'buying land chunk B (copper)', derivation: '§8 #2; §9 chunk B' },
  copperSmelting: { id: 'copperSmelting', num: 3, name: 'Copper Smelting', cost: { copperOre: 40 }, requires: ['surveyEast'], unlocks: 'the copper ingot recipe', derivation: '§8 #3' },
  wireDrawing: { id: 'wireDrawing', num: 4, name: 'Wire Drawing', cost: { copperIngot: 60 }, requires: ['copperSmelting'], unlocks: 'copper wire on the Press', derivation: '§8 #4' },
  gearcutting: { id: 'gearcutting', num: 5, name: 'Gearcutting', cost: { ironPlate: 80 }, requires: ['pressing'], unlocks: 'the Assembler and gears', derivation: '§8 #5' },
  splitters: { id: 'splitters', num: 6, name: 'Splitters & Mergers', cost: { gear: 50 }, requires: ['gearcutting'], unlocks: 'the Splitter and the Merger', derivation: '§8 #6' },
  buffers: { id: 'buffers', num: 7, name: 'Buffers', cost: { ironPlate: 100, gear: 20 }, requires: ['gearcutting'], unlocks: 'the Buffer Crate', derivation: '§8 #7' },
  gizmoTheory: { id: 'gizmoTheory', num: 8, name: 'Gizmo Theory', cost: { gear: 60, copperWire: 150 }, requires: ['gearcutting', 'wireDrawing'], unlocks: "the Gizmo, and Bramble's Gizmo Festival", derivation: '§8 #8' },
  slagBricks: { id: 'slagBricks', num: 9, name: 'Slag Bricks', cost: { slag: 100 }, requires: ['pressing'], unlocks: 'slag bricks on the Press', derivation: '§8 #9; §4 waste becomes an input' },
  folding: { id: 'folding', num: 10, name: 'Folding', cost: { gizmo: 25, gear: 200 }, requires: ['gizmoTheory'], unlocks: 'the Fold tool, and land chunks C and D', derivation: '§8 #10; §16 first fold by 40 min' },
};

export const RESEARCH_LIST: ResearchDef[] = RESEARCH_IDS.map((id) => RESEARCH[id]);
