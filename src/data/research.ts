// Research nodes (DESIGN.md §8). Each costs item deliveries to the Hopper; one is selected at a
// time and fills from matching deliveries; items delivered with nothing selected are banked.
import type { ItemId } from './items';

export const RESEARCH_IDS = [
  'pressing', 'surveyEast', 'copperSmelting', 'wireDrawing', 'gearcutting', 'splitters', 'buffers', 'gizmoTheory', 'slagBricks', 'folding',
  // Act II (DESIGN.md §18)
  'coalSeams', 'steelmaking', 'overdrive', 'steamPower', 'surveying', 'glassworks', 'crushing', 'concrete', 'refining',
  'machineKits', 'circuits', 'heavyMachines', 'tuning', 'motors', 'nestedFolds', 'greatDrill',
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
  /** which act's tree page it sits on (1: the Workshop, 2: the Factory) */
  act?: 1 | 2;
  derivation: string;
}

export const RESEARCH: Record<ResearchId, ResearchDef> = {
  pressing: { id: 'pressing', num: 1, name: 'Pressing', cost: { ironIngot: 30 }, requires: [], unlocks: 'the Press and iron plates', derivation: '§8 #1; §16 first research about 5 min' },
  surveyEast: { id: 'surveyEast', num: 2, name: 'Survey East', cost: { ironPlate: 40 }, requires: ['pressing'], unlocks: 'buying land chunk B (copper)', derivation: '§8 #2; §9 chunk B' },
  copperSmelting: { id: 'copperSmelting', num: 3, name: 'Copper Smelting', cost: { copperOre: 80 }, requires: ['surveyEast'], unlocks: 'the copper ingot recipe', derivation: '§8 #3; x2 (§13 checks 6, 11)' },
  wireDrawing: { id: 'wireDrawing', num: 4, name: 'Wire Drawing', cost: { copperIngot: 120 }, requires: ['copperSmelting'], unlocks: 'copper wire on the Press', derivation: '§8 #4; x2 (§13 checks 6, 11)' },
  gearcutting: { id: 'gearcutting', num: 5, name: 'Gearcutting', cost: { ironPlate: 160 }, requires: ['pressing'], unlocks: 'the Assembler and gears', derivation: '§8 #5; x2 (§13 checks 6, 11)' },
  splitters: { id: 'splitters', num: 6, name: 'Splitters & Mergers', cost: { gear: 100 }, requires: ['gearcutting'], unlocks: 'the Splitter and the Merger', derivation: '§8 #6; x2 (§13 checks 6, 11)' },
  buffers: { id: 'buffers', num: 7, name: 'Buffers', cost: { ironPlate: 200, gear: 40 }, requires: ['gearcutting'], unlocks: 'the Buffer Crate', derivation: '§8 #7; x2 (§13 checks 6, 11)' },
  gizmoTheory: { id: 'gizmoTheory', num: 8, name: 'Gizmo Theory', cost: { gear: 120, copperWire: 300 }, requires: ['gearcutting', 'wireDrawing'], unlocks: "the Gizmo, Bramble's Gizmo Festival, and land chunk C (iron)", derivation: '§8 #8; x2 (§13 checks 6, 11)' },
  slagBricks: { id: 'slagBricks', num: 9, name: 'Slag Bricks', cost: { slag: 200 }, requires: ['pressing'], unlocks: 'slag bricks on the Press', derivation: '§8 #9; §4 waste becomes an input; x2 (§13 checks 6, 11)' },
  coalSeams: { id: 'coalSeams', num: 11, act: 2, name: 'Coal Seams', cost: { gizmo: 80, ironPlate: 800 }, requires: ['folding'], unlocks: 'land chunk E (coal and sand), and Unit 7', derivation: '§18 Land: chunk E; the act opens with the slice\'s own products' },
  steelmaking: { id: 'steelmaking', num: 12, act: 2, name: 'Steelmaking', cost: { coal: 300, ironIngot: 300 }, requires: ['coalSeams'], unlocks: 'steel in the Smelter (ingot + coal)', derivation: '§18 Items: steel; pacing target steel by 1:45' },
  overdrive: { id: 'overdrive', num: 13, act: 2, name: 'Overdrive', cost: { steel: 150 }, requires: ['steelmaking'], unlocks: 'Overdrive: click a machine to run it 3x for 10 s', derivation: '§18 Overdrive; §16 rule 4' },
  steamPower: { id: 'steamPower', num: 14, act: 2, name: 'Steam Power', cost: { steel: 300, gear: 200 }, requires: ['steelmaking'], unlocks: 'Boilers, Steam Engines, Generators and Poles; land chunk F; Dame Voltaire', derivation: '§18 Power; pacing target power by 2:15' },
  surveying: { id: 'surveying', num: 15, act: 2, name: 'Surveying', cost: { coal: 400, slagBrick: 100 }, requires: ['coalSeams'], unlocks: 'the Survey Office: buy deposit claims', derivation: '§18 Land: deposit claims' },
  glassworks: { id: 'glassworks', num: 16, act: 2, name: 'Glassworks', cost: { sand: 600 }, requires: ['steamPower'], unlocks: 'the Kiln and glass', derivation: '§18 Items: glass' },
  crushing: { id: 'crushing', num: 17, act: 2, name: 'Crushing', cost: { slag: 600 }, requires: ['steelmaking'], unlocks: 'gravel on the Press (2 slag)', derivation: '§18 Items: gravel; slag becomes an input' },
  concrete: { id: 'concrete', num: 18, act: 2, name: 'Concrete', cost: { gravel: 500, sand: 400 }, requires: ['crushing', 'glassworks'], unlocks: 'the Mixer and concrete', derivation: '§18 Items: concrete' },
  refining: { id: 'refining', num: 19, act: 2, name: 'Refining', cost: { coal: 800, steel: 200 }, requires: ['steamPower'], unlocks: 'the Refinery: plastic, with oil on the side', derivation: '§18 Items: plastic and oil' },
  machineKits: { id: 'machineKits', num: 20, act: 2, name: 'Machine Kits', cost: { steel: 400, gear: 300 }, requires: ['steamPower'], unlocks: 'Machine Kits (stamping designs with Act II machines needs them)', derivation: '§18 Machine Kits' },
  circuits: { id: 'circuits', num: 21, act: 2, name: 'Circuits', cost: { plastic: 200, glass: 300, copperWire: 800 }, requires: ['refining', 'glassworks'], unlocks: 'circuits in the Assembler', derivation: '§18 Items: circuits; pacing target circuits by 3:00' },
  heavyMachines: { id: 'heavyMachines', num: 22, act: 2, name: 'Heavy Machines', cost: { steel: 600, circuit: 80 }, requires: ['circuits'], unlocks: 'Mk2 Smelter, Press and Assembler (2x2, 3x speed, powered)', derivation: '§18 Mk2' },
  tuning: { id: 'tuning', num: 23, act: 2, name: 'Tuning', cost: { circuit: 200 }, requires: ['heavyMachines'], unlocks: 'machine modes: Efficient, Overclocked, Precision', derivation: '§18 Modes' },
  motors: { id: 'motors', num: 24, act: 2, name: 'Motors', cost: { steel: 800, circuit: 150, gear: 300 }, requires: ['circuits'], unlocks: 'motors in the Assembler', derivation: '§18 Items: motor' },
  nestedFolds: { id: 'nestedFolds', num: 25, act: 2, name: 'Nested Folds', cost: { circuit: 150, concrete: 300 }, requires: ['circuits', 'concrete'], unlocks: 'the Fold tool on the Factory floor: modules fold into one', derivation: '§18 Nested folds' },
  greatDrill: { id: 'greatDrill', num: 26, act: 2, name: 'The Great Drill', cost: { motor: 60, concrete: 600 }, requires: ['motors', 'concrete'], unlocks: 'the Megaproject Bay and Drill Bits', derivation: '§18 Megaproject #1, stage 1 by about 4:30' },
  folding: { id: 'folding', num: 10, name: 'Folding', cost: { gizmo: 50, gear: 500 }, requires: ['gizmoTheory'], unlocks: 'the Fold tool, and land chunk D', derivation: '§8 #10; 500 gears: chunk C\'s gear lines on the Hopper put Folding at 22-30 min and the Dock-only player 5+ min behind (§13 checks 6, 11); §16 first fold by 40 min' },
};

export const RESEARCH_LIST: ResearchDef[] = RESEARCH_IDS.map((id) => RESEARCH[id]);
