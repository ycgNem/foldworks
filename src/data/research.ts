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
  /** what it unlocks, as a row of rich-text markup for the panel (docs/hud-180.md: no sentence) */
  unlocks: string;
  /** which act's tree page it sits on (1: the Workshop, 2: the Factory) */
  act?: 1 | 2;
  derivation: string;
}

export const RESEARCH: Record<ResearchId, ResearchDef> = {
  pressing: { id: 'pressing', num: 1, name: 'Pressing', cost: { ironIngot: 30 }, requires: [], unlocks: 'the Press · {i:ironIngot} → {i:ironPlate}', derivation: '§8 #1; §16 first research about 5 min' },
  surveyEast: { id: 'surveyEast', num: 2, name: 'Survey East', cost: { ironPlate: 40 }, requires: ['pressing'], unlocks: 'Chunk B for sale · {i:copperOre}', derivation: '§8 #2; §9 chunk B' },
  copperSmelting: { id: 'copperSmelting', num: 3, name: 'Copper Smelting', cost: { copperOre: 80 }, requires: ['surveyEast'], unlocks: '{i:copperOre} → {i:copperIngot} in the Smelter', derivation: '§8 #3; x2 (§13 checks 6, 11)' },
  wireDrawing: { id: 'wireDrawing', num: 4, name: 'Wire Drawing', cost: { copperIngot: 120 }, requires: ['copperSmelting'], unlocks: '{i:copperIngot} → 2 {i:copperWire} on the Press', derivation: '§8 #4; x2 (§13 checks 6, 11)' },
  gearcutting: { id: 'gearcutting', num: 5, name: 'Gearcutting', cost: { ironPlate: 160 }, requires: ['pressing'], unlocks: 'the Assembler · 2 {i:ironPlate} → {i:gear}', derivation: '§8 #5; x2 (§13 checks 6, 11)' },
  splitters: { id: 'splitters', num: 6, name: 'Splitters & Mergers', cost: { gear: 100 }, requires: ['gearcutting'], unlocks: 'the Splitter · the Merger', derivation: '§8 #6; x2 (§13 checks 6, 11)' },
  buffers: { id: 'buffers', num: 7, name: 'Buffers', cost: { ironPlate: 200, gear: 40 }, requires: ['gearcutting'], unlocks: 'the Buffer Crate · holds 50', derivation: '§8 #7; x2 (§13 checks 6, 11)' },
  gizmoTheory: { id: 'gizmoTheory', num: 8, name: 'Gizmo Theory', cost: { gear: 120, copperWire: 300 }, requires: ['gearcutting', 'wireDrawing'], unlocks: '{i:gear} + 2 {i:copperWire} → {i:gizmo} · the Gizmo Festival · Chunk C for sale', derivation: '§8 #8; x2 (§13 checks 6, 11)' },
  slagBricks: { id: 'slagBricks', num: 9, name: 'Slag Bricks', cost: { slag: 200 }, requires: ['pressing'], unlocks: '4 {i:slag} → {i:slagBrick} on the Press', derivation: '§8 #9; §4 waste becomes an input; x2 (§13 checks 6, 11)' },
  coalSeams: { id: 'coalSeams', num: 11, act: 2, name: 'Coal Seams', cost: { gear: 600 }, requires: ['folding'], unlocks: 'Chunk E for sale · {i:coal} {i:sand} · Unit 7 arrives', derivation: '§18 Land: chunk E; the act opens with the slice own product: 600 gears is about 12 min of the banked gear lines (~50/min, Act II bot), so it lands a few minutes after the slice end (plates no longer reach the bank)' },
  steelmaking: { id: 'steelmaking', num: 12, act: 2, name: 'Steelmaking', cost: { coal: 300, gear: 300 }, requires: ['coalSeams'], unlocks: '{i:ironIngot} + {i:coal} → {i:steel} in the Smelter', derivation: '§18 Items: steel; 300 coal is 10 min of the first chunk E coal miner into the Hopper, 300 gears 6 min of the bank; no ingots (the first iron Act II can reach is in chunk F)' },
  overdrive: { id: 'overdrive', num: 13, act: 2, name: 'Overdrive', cost: { steel: 150 }, requires: ['steelmaking'], unlocks: '{u:overdrive} Overdrive · {k:LMB} a machine · 3× for 10 s', derivation: '§18 Overdrive; §16 rule 4' },
  steamPower: { id: 'steamPower', num: 14, act: 2, name: 'Steam Power', cost: { coal: 500, gear: 400 }, requires: ['steelmaking'], unlocks: '{u:power} Boiler · Steam Engine · Generator · Pole · Chunk F for sale · Dame Voltaire arrives', derivation: '§18 Power: coal and gears, no steel: steel needs the chunk F iron and F requires this node, so steel follows power land by minutes' },
  surveying: { id: 'surveying', num: 15, act: 2, name: 'Surveying', cost: { coal: 400, slagBrick: 100 }, requires: ['coalSeams'], unlocks: '{u:survey} the Survey Office · {u:claim} buy deposit claims', derivation: '§18 Land: deposit claims' },
  glassworks: { id: 'glassworks', num: 16, act: 2, name: 'Glassworks', cost: { sand: 600 }, requires: ['steamPower'], unlocks: 'the Kiln · 2 {i:sand} → {i:glass}', derivation: '§18 Items: glass' },
  crushing: { id: 'crushing', num: 17, act: 2, name: 'Crushing', cost: { slag: 600 }, requires: ['steelmaking'], unlocks: '2 {i:slag} → {i:gravel} on the Press', derivation: '§18 Items: gravel; slag becomes an input' },
  concrete: { id: 'concrete', num: 18, act: 2, name: 'Concrete', cost: { gravel: 200, sand: 200 }, requires: ['crushing', 'glassworks'], unlocks: 'the Mixer · 2 {i:gravel} + {i:sand} → {i:concrete}', derivation: '§18 Items: concrete; 200 gravel is 400 slag, about 40 min of one steel line (0.17 slag/s) once Crushing is in: the Act II bot reaches it about 1 h after the slice end (500 gravel took 1.5 h and put the Concrete fold past S+2 h)' },
  refining: { id: 'refining', num: 19, act: 2, name: 'Refining', cost: { coal: 800, steel: 200 }, requires: ['steamPower'], unlocks: 'the Refinery · 2 {i:coal} → {i:plastic} · {i:oil} out a side', derivation: '§18 Items: plastic and oil' },
  machineKits: { id: 'machineKits', num: 20, act: 2, name: 'Machine Kits', cost: { steel: 400, gear: 300 }, requires: ['steamPower'], unlocks: '2 {i:steel} + 2 {i:gear} → {i:machineKit} · stamps of Act II machines need them', derivation: '§18 Machine Kits' },
  circuits: { id: 'circuits', num: 21, act: 2, name: 'Circuits', cost: { plastic: 200, glass: 300, copperWire: 800 }, requires: ['refining', 'glassworks'], unlocks: '3 {i:copperWire} + {i:plastic} + {i:glass} → {i:circuit} in the Assembler', derivation: '§18 Items: circuits; pacing target circuits by 3:00' },
  heavyMachines: { id: 'heavyMachines', num: 22, act: 2, name: 'Heavy Machines', cost: { steel: 600, circuit: 80 }, requires: ['circuits'], unlocks: '{u:heavy} Smelter, Press, Assembler Mk2 · 2×2 · 4× speed · {u:power}', derivation: '§18 Mk2' },
  tuning: { id: 'tuning', num: 23, act: 2, name: 'Tuning', cost: { circuit: 200 }, requires: ['heavyMachines'], unlocks: '{u:mode} machine modes · Efficient · Overclocked · Precision', derivation: '§18 Modes' },
  motors: { id: 'motors', num: 24, act: 2, name: 'Motors', cost: { steel: 800, circuit: 150, gear: 300 }, requires: ['circuits'], unlocks: '{i:steel} + 4 {i:copperWire} + {i:circuit} → {i:motor} in the Assembler', derivation: '§18 Items: motor' },
  nestedFolds: { id: 'nestedFolds', num: 25, act: 2, name: 'Nested Folds', cost: { circuit: 150, concrete: 300 }, requires: ['circuits', 'concrete'], unlocks: '{u:fold} on the Factory floor · modules fold into one', derivation: '§18 Nested folds' },
  greatDrill: { id: 'greatDrill', num: 26, act: 2, name: 'The Great Drill', cost: { motor: 40, concrete: 200 }, requires: ['motors', 'concrete'], unlocks: '{u:mega} the Megaproject Bay · {i:drillBit} Drill Bits', derivation: '§18 Megaproject #1, stage 1 by about S+4 h: 40 motors are about 6 min of one motor assembler, 200 concrete about 45 min of the Workshop mixer on one steel line slag; 600 concrete was over 3 h of it' },
  folding: { id: 'folding', num: 10, name: 'Folding', cost: { gizmo: 50, gear: 500 }, requires: ['gizmoTheory'], unlocks: '{u:fold} the Fold tool · Chunk D for sale', derivation: '§8 #10; 500 gears: chunk C\'s gear lines on the Hopper put Folding at 22-30 min and the Dock-only player 5+ min behind (§13 checks 6, 11); §16 first fold by 40 min' },
};

export const RESEARCH_LIST: ResearchDef[] = RESEARCH_IDS.map((id) => RESEARCH[id]);
