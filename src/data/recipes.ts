// Recipes (DESIGN.md §3). Time is seconds per craft; the player sees rates per minute.
import type { ItemId } from './items';
import type { ResearchId } from './research';
import type { CustomerId } from './orders';

export type MachineKind = 'miner' | 'smelter' | 'press' | 'assembler' | 'kiln' | 'mixer' | 'refinery';

export interface Stack { item: ItemId; n: number }

export interface RecipeDef {
  id: string;
  name: string;
  machine: MachineKind;
  inputs: Stack[];
  outputs: Stack[];
  /** a byproduct made once every `every` crafts, into the machine's separate byproduct buffer */
  byproduct?: { item: ItemId; every: number };
  time: number;
  /** research that unlocks it (null: known from the start) */
  unlock: ResearchId | null;
  /** an alternate recipe a customer teaches at this reputation (DESIGN.md §18 Customers) */
  rep?: { customer: CustomerId; level: number };
  derivation: string;
}

export const RECIPES: RecipeDef[] = [
  { id: 'mineIron', name: 'Mine iron ore', machine: 'miner', inputs: [], outputs: [{ item: 'ironOre', n: 1 }], time: 2.0, unlock: null, derivation: '§3 miner 2.0 s; §4 30/min' },
  { id: 'mineCopper', name: 'Mine copper ore', machine: 'miner', inputs: [], outputs: [{ item: 'copperOre', n: 1 }], time: 2.0, unlock: null, derivation: '§3 miner 2.0 s' },
  { id: 'smeltIron', name: 'Iron ingot', machine: 'smelter', inputs: [{ item: 'ironOre', n: 1 }], outputs: [{ item: 'ironIngot', n: 1 }], byproduct: { item: 'slag', every: 4 }, time: 2.0, unlock: null, derivation: '§3 smelter 2.0 s, 1 slag per 4 ingots' },
  { id: 'smeltCopper', name: 'Copper ingot', machine: 'smelter', inputs: [{ item: 'copperOre', n: 1 }], outputs: [{ item: 'copperIngot', n: 1 }], byproduct: { item: 'slag', every: 4 }, time: 2.0, unlock: 'copperSmelting', derivation: '§3 same as iron; §8 research 3' },
  { id: 'pressPlate', name: 'Iron plate', machine: 'press', inputs: [{ item: 'ironIngot', n: 1 }], outputs: [{ item: 'ironPlate', n: 1 }], time: 1.5, unlock: 'pressing', derivation: '§3 press 1.5 s; §8 research 1' },
  { id: 'drawWire', name: 'Copper wire', machine: 'press', inputs: [{ item: 'copperIngot', n: 1 }], outputs: [{ item: 'copperWire', n: 2 }], time: 1.5, unlock: 'wireDrawing', derivation: '§3 1 ingot -> 2 wire, 1.5 s; §8 research 4' },
  { id: 'pressBrick', name: 'Slag brick', machine: 'press', inputs: [{ item: 'slag', n: 4 }], outputs: [{ item: 'slagBrick', n: 1 }], time: 3.0, unlock: 'slagBricks', derivation: '§3 4 slag -> 1 brick, 3.0 s; §8 research 9' },
  { id: 'cutGear', name: 'Gear', machine: 'assembler', inputs: [{ item: 'ironPlate', n: 2 }], outputs: [{ item: 'gear', n: 1 }], time: 2.0, unlock: 'gearcutting', derivation: '§3 2 plates -> gear, 2.0 s; §8 research 5' },
  { id: 'gizmo', name: 'Gizmo', machine: 'assembler', inputs: [{ item: 'gear', n: 1 }, { item: 'copperWire', n: 2 }], outputs: [{ item: 'gizmo', n: 1 }], time: 4.0, unlock: 'gizmoTheory', derivation: '§3 gear + 2 wire -> gizmo, 4.0 s (re-derived: DECISIONS.md 2026-10-20 derivative flags); §8 research 8' },
  // Act II (DESIGN.md §18)
  { id: 'mineCoal', name: 'Mine coal', machine: 'miner', inputs: [], outputs: [{ item: 'coal', n: 1 }], time: 2.0, unlock: null, derivation: '§18 Items: miner 2.0 s, like ore' },
  { id: 'mineSand', name: 'Mine sand', machine: 'miner', inputs: [], outputs: [{ item: 'sand', n: 1 }], time: 2.0, unlock: null, derivation: '§18 Items: miner 2.0 s' },
  { id: 'smeltSteel', name: 'Steel', machine: 'smelter', inputs: [{ item: 'ironIngot', n: 1 }, { item: 'coal', n: 1 }], outputs: [{ item: 'steel', n: 1 }], byproduct: { item: 'slag', every: 2 }, time: 3.0, unlock: 'steelmaking', derivation: '§18 Items: ingot + coal -> steel, 3.0 s, slag per 2' },
  { id: 'fireGlass', name: 'Glass', machine: 'kiln', inputs: [{ item: 'sand', n: 2 }], outputs: [{ item: 'glass', n: 1 }], time: 2.0, unlock: 'glassworks', derivation: '§18 Items: 2 sand -> glass, 2.0 s' },
  { id: 'recycledGlass', name: 'Recycled glass', machine: 'kiln', inputs: [{ item: 'gravel', n: 3 }], outputs: [{ item: 'glass', n: 1 }], time: 2.5, unlock: 'glassworks', rep: { customer: 'unit7', level: 2 }, derivation: '§18 Customers: Unit 7 rep 2, 3 gravel -> glass, 2.5 s' },
  { id: 'crushGravel', name: 'Gravel', machine: 'press', inputs: [{ item: 'slag', n: 2 }], outputs: [{ item: 'gravel', n: 1 }], time: 1.0, unlock: 'crushing', derivation: '§18 Items: 2 slag -> gravel, 1.0 s' },
  { id: 'mixConcrete', name: 'Concrete', machine: 'mixer', inputs: [{ item: 'gravel', n: 2 }, { item: 'sand', n: 1 }], outputs: [{ item: 'concrete', n: 1 }], time: 3.0, unlock: 'concrete', derivation: '§18 Items: 2 gravel + sand -> concrete, 3.0 s' },
  { id: 'refinePlastic', name: 'Plastic', machine: 'refinery', inputs: [{ item: 'coal', n: 2 }], outputs: [{ item: 'plastic', n: 1 }], byproduct: { item: 'oil', every: 2 }, time: 4.0, unlock: 'refining', derivation: '§18 Items: 2 coal -> plastic, 4.0 s, oil per 2' },
  { id: 'etchCircuit', name: 'Circuit', machine: 'assembler', inputs: [{ item: 'copperWire', n: 3 }, { item: 'plastic', n: 1 }, { item: 'glass', n: 1 }], outputs: [{ item: 'circuit', n: 1 }], time: 5.0, unlock: 'circuits', derivation: '§18 Items: 3 wire + plastic + glass -> circuit, 5.0 s' },
  { id: 'packKit', name: 'Machine Kit', machine: 'assembler', inputs: [{ item: 'steel', n: 2 }, { item: 'gear', n: 2 }], outputs: [{ item: 'machineKit', n: 1 }], time: 4.0, unlock: 'machineKits', derivation: '§18 Machine Kits: 2 steel + 2 gears, 4.0 s' },
  { id: 'buildMotor', name: 'Motor', machine: 'assembler', inputs: [{ item: 'steel', n: 1 }, { item: 'copperWire', n: 4 }, { item: 'circuit', n: 1 }], outputs: [{ item: 'motor', n: 1 }], time: 8.0, unlock: 'motors', derivation: '§18 Items: steel + 4 copper wire (the windings) + circuit -> motor, 8.0 s; re-derived from 2 steel + gear + circuit, which was close to the engine unit of Factorio (the gate review); inputs 133 -> 420, 3.2x' },
  { id: 'forgeDrillBit', name: 'Drill Bit', machine: 'assembler', inputs: [{ item: 'steel', n: 4 }, { item: 'motor', n: 1 }, { item: 'concrete', n: 2 }], outputs: [{ item: 'drillBit', n: 1 }], time: 12.0, unlock: 'greatDrill', derivation: '§18 Megaproject: 4 steel + motor + 2 concrete -> drill bit, 12 s' },
];

export const RECIPE: Record<string, RecipeDef> = Object.fromEntries(RECIPES.map((r) => [r.id, r]));

export function recipesFor(machine: MachineKind): RecipeDef[] {
  return RECIPES.filter((r) => r.machine === machine);
}
