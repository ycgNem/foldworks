// Recipes (DESIGN.md §3). Time is seconds per craft; the player sees rates per minute.
import type { ItemId } from './items';
import type { ResearchId } from './research';

export type MachineKind = 'miner' | 'smelter' | 'press' | 'assembler';

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
  { id: 'gizmo', name: 'Gizmo', machine: 'assembler', inputs: [{ item: 'gear', n: 1 }, { item: 'copperWire', n: 3 }], outputs: [{ item: 'gizmo', n: 1 }], time: 4.0, unlock: 'gizmoTheory', derivation: '§3 gear + 3 wire -> gizmo, 4.0 s; §8 research 8' },
];

export const RECIPE: Record<string, RecipeDef> = Object.fromEntries(RECIPES.map((r) => [r.id, r]));

export function recipesFor(machine: MachineKind): RecipeDef[] {
  return RECIPES.filter((r) => r.machine === machine);
}
