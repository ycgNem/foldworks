// Buildings on the Workshop floor (DESIGN.md §4). Prices are flat: no growth per purchase
// (PLAN.md not-list; DECISIONS.md 2026-10-20). Growth is limited by land, research and coin per
// machine-second.
import type { ResearchId } from './research';
import type { MachineKind } from './recipes';
import type { ItemId } from './items';

export type BuildKind = 'belt' | 'miner' | 'smelter' | 'press' | 'assembler' | 'heap' | 'splitter' | 'merger' | 'crate'
  // Act II (DESIGN.md §18)
  | 'boiler' | 'steamEngine' | 'generator' | 'pole' | 'kiln' | 'mixer' | 'refinery' | 'smelterMk2' | 'pressMk2' | 'assemblerMk2'
  // Act III (DESIGN.md §21)
  | 'chemVat' | 'greenhouse' | 'chuteMouth'
  // Act IV (DESIGN.md §22): Rime's Heater
  | 'heater';
export type FixedKind = 'furnace' | 'dock' | 'hopper'
  // Act V (DESIGN.md §23): the Seed, the World folded into one tile, in every Workshop after a Last Fold
  | 'seed';
export type EntKind = BuildKind | FixedKind;

export interface BuildDef {
  kind: EntKind;
  name: string;
  /** coin; 0 for the fixed buildings */
  cost: number;
  w: number;
  h: number;
  /** research that unlocks it (null: from the start) */
  unlock: ResearchId | null;
  /** the recipe family it crafts, for machines */
  machine?: MachineKind;
  /** holds this many items (crate, heap) */
  capacity?: number;
  /** kW drawn while crafting (powered machines, DESIGN.md §18 Power) */
  kw?: number;
  /** kW made, and the fuel it burns: seconds per item at full load */
  power?: number;
  fuel?: { items: ItemId[]; seconds: number };
  /** craft speed against its family's recipe times (Mk2: 3) */
  speed?: number;
  /** an Act II building: stamping a design that holds one costs Machine Kits */
  act2?: boolean;
  /** the build wheel's info tag: an icon equation and a fact or two, rich-text markup, no sentence */
  blurb: string;
  derivation: string;
}

export const BUILD: Record<EntKind, BuildDef> = {
  belt: { kind: 'belt', name: 'Belt', cost: 1, w: 1, h: 1, unlock: null, blurb: '2 tiles/s · 1 a tile · 120/min · drag to lay', derivation: '§4 Belt Mk1: 4 miners fill one belt' },
  miner: { kind: 'miner', name: 'Miner', cost: 40, w: 1, h: 1, unlock: null, machine: 'miner', blurb: 'sits on ore · 30 ore/min out the front', derivation: '§4 Miner Mk1; §16 first miner before 2:00' },
  smelter: { kind: 'smelter', name: 'Smelter', cost: 60, w: 1, h: 1, unlock: null, machine: 'smelter', blurb: '{i:ironOre} → {i:ironIngot}  30/min out the front · {i:slag} 1 per 4, out the sides', derivation: '§4 Smelter Mk1; §3' },
  press: { kind: 'press', name: 'Press', cost: 150, w: 1, h: 1, unlock: 'pressing', machine: 'press', blurb: '{i:ironIngot} → {i:ironPlate}  40/min · {i:copperIngot} → 2 {i:copperWire} · 4 {i:slag} → {i:slagBrick}', derivation: '§4 Press Mk1; research 1' },
  assembler: { kind: 'assembler', name: 'Assembler', cost: 500, w: 1, h: 1, unlock: 'gearcutting', machine: 'assembler', blurb: '2 {i:ironPlate} → {i:gear}  30/min · {i:gear} + 2 {i:copperWire} → {i:gizmo}  15/min', derivation: '§4 Assembler Mk1; research 5' },
  heap: { kind: 'heap', name: 'Slag Heap', cost: 25, w: 1, h: 1, unlock: null, capacity: 400, blurb: 'holds 400 {i:slag} · fed by a machine beside it or a belt · empties out the front', derivation: '§4 Slag Heap holds 400 (about 53 min of one smelter); §4 Byproducts' },
  splitter: { kind: 'splitter', name: 'Splitter', cost: 20, w: 1, h: 1, unlock: 'splitters', blurb: 'in the back · out front, left, right in turn · skips a blocked side', derivation: '§4 Splitter; research 6' },
  merger: { kind: 'merger', name: 'Merger', cost: 20, w: 1, h: 1, unlock: 'splitters', blurb: 'in back, left, right in turn · out the front', derivation: '§4 Merger; research 6' },
  crate: { kind: 'crate', name: 'Buffer Crate', cost: 30, w: 1, h: 1, unlock: 'buffers', capacity: 50, blurb: 'holds 50 · first in, first out · out the front', derivation: '§4 Buffer Crate; research 7' },
  furnace: { kind: 'furnace', name: 'Hand Furnace', cost: 0, w: 1, h: 1, unlock: null, machine: 'smelter', blurb: '{k:LMB} crank · 0.25 s of smelting a click · the Bellows runs it for you', derivation: '§4 Hand Furnace; §6 Cranking' },
  dock: { kind: 'dock', name: 'Dock', cost: 0, w: 2, h: 2, unlock: null, blurb: '{coin} buys all but {i:slag} · fills the active order first', derivation: '§4 Dock; §7' },
  hopper: { kind: 'hopper', name: 'Hopper', cost: 0, w: 2, h: 2, unlock: null, blurb: 'takes anything · pays into the selected {research:research}', derivation: '§4 Hopper; §8' },
  seed: { kind: 'seed', name: 'The Seed', cost: 0, w: 1, h: 1, unlock: null, blurb: 'digs {i:ironOre} {i:copperOre} {i:coal} {i:sand} · one out of each side · 15/min each · {k:R} turns which side gets which', derivation: '§23 The Seed: the folded World, 1x1, not removable; one of each raw ore out of its four sides every 4 s (half a Miner\'s pace, §4), so a new universe\'s chunk A holds all four ores' },
  // Act II: power (DESIGN.md §18 Power)
  boiler: { kind: 'boiler', name: 'Boiler', cost: 1200, w: 1, h: 1, unlock: 'steamPower', fuel: { items: ['coal', 'oil'], seconds: 4 }, act2: true, blurb: 'burns {i:coal} or {i:oil} · 1 per 4 s at full load · steams the Engine at its front', derivation: '§18 Power: boiler 120, 1 fuel per 4 s; cost 1,200: priced against Act II income, not Mk1 prices (the Milestone 4 review: Act II coin piled up unspent), about 6 s of the 12,000/min factory, a plant of boiler, engine and poles about half a minute' },
  steamEngine: { kind: 'steamEngine', name: 'Steam Engine', cost: 2000, w: 1, h: 1, unlock: 'steamPower', power: 300, act2: true, blurb: '{power:300 kW} while a Boiler faces it · a Pole within 2 tiles joins it to a grid', derivation: '§18 Power: 300 kW; 1,200 kJ per coal with its boiler; cost 2,000: priced against Act II income, not Mk1 prices (the Milestone 4 review: Act II coin piled up unspent)' },
  generator: { kind: 'generator', name: 'Generator', cost: 2600, w: 1, h: 1, unlock: 'steamPower', power: 200, fuel: { items: ['coal'], seconds: 3 }, act2: true, blurb: 'one tile · 1 {i:coal} per 3 s → {power:200 kW} · half a Boiler pair\'s energy a coal', derivation: '§18 Power: 200 kW per tile at 600 kJ per coal, against the boiler pair at 150 kW per tile at 1,200 kJ: compactness against efficiency (the gate review); cost 2,600: priced against Act II income, not Mk1 prices (the Milestone 4 review: Act II coin piled up unspent)' },
  pole: { kind: 'pole', name: 'Pole', cost: 150, w: 1, h: 1, unlock: 'steamPower', act2: true, blurb: '{u:power} all within 2 tiles · Poles within 6 join one grid', derivation: '§18 Power: reach 2, link 6; cost 150: priced against Act II income, not Mk1 prices (the Milestone 4 review: Act II coin piled up unspent)' },
  // Act II: machines
  kiln: { kind: 'kiln', name: 'Kiln', cost: 3000, w: 1, h: 1, unlock: 'glassworks', machine: 'kiln', kw: 60, act2: true, blurb: '2 {i:sand} → {i:glass}  30/min · {power:60 kW}', derivation: '§18 Items and Power: kiln 300, 60 kW; cost 3,000: priced against Act II income, not Mk1 prices (the Milestone 4 review: Act II coin piled up unspent)' },
  mixer: { kind: 'mixer', name: 'Mixer', cost: 4000, w: 1, h: 1, unlock: 'concrete', machine: 'mixer', kw: 80, act2: true, blurb: '2 {i:gravel} + {i:sand} → {i:concrete}  20/min · {power:80 kW}', derivation: '§18 Items and Power: mixer 400, 80 kW; cost 4,000: priced against Act II income, not Mk1 prices (the Milestone 4 review: Act II coin piled up unspent)' },
  refinery: { kind: 'refinery', name: 'Refinery', cost: 9000, w: 1, h: 1, unlock: 'refining', machine: 'refinery', kw: 120, act2: true, blurb: '2 {i:coal} → {i:plastic}  15/min · {i:oil} 1 per 2, out a side · {power:120 kW}', derivation: '§18 Items and Power: refinery 900, 120 kW; cost 9,000: priced against Act II income, not Mk1 prices (the Milestone 4 review: Act II coin piled up unspent), the dearest Act II machine at about 45 s' },
  smelterMk2: { kind: 'smelterMk2', name: 'Smelter Mk2', cost: 6000, w: 2, h: 2, unlock: 'heavyMachines', machine: 'smelter', kw: 150, speed: 4, act2: true, blurb: '2×2 · 4× a Smelter · {i:ironIngot} 120/min, a full belt · {power:150 kW}', derivation: '§18 Mk2: 4x speed makes 120 ingots/min, exactly one Mk1 belt; 6,000 coin, about half a minute of the Act II factory (12,000/min): priced against Act II income, not against Mk1 prices (230 was a rounding error of the coin piling up, the Milestone 4 review)' },
  pressMk2: { kind: 'pressMk2', name: 'Press Mk2', cost: 9000, w: 2, h: 2, unlock: 'heavyMachines', machine: 'press', kw: 120, speed: 4, act2: true, blurb: '2×2 · 4× a Press · {power:120 kW}', derivation: '§18 Mk2: 4x speed; 9,000 coin, about 45 s of the Act II factory (12,000/min); 120 kW' },
  assemblerMk2: { kind: 'assemblerMk2', name: 'Assembler Mk2', cost: 20000, w: 2, h: 2, unlock: 'heavyMachines', machine: 'assembler', kw: 200, speed: 4, act2: true, blurb: '2×2 · 4× an Assembler · {power:200 kW}', derivation: '§18 Mk2: 4x speed; 20,000 coin, about 1.7 min of the Act II factory (12,000/min), the dearest machine; 200 kW' },
  // Act III (DESIGN.md §21)
  chemVat: { kind: 'chemVat', name: 'Chem Vat', cost: 12000, w: 1, h: 1, unlock: 'chemistry', machine: 'chemVat', kw: 100, act2: true, blurb: '2 {i:oil} + {i:sand} → {i:solvent}  30/min · {i:sludge} 1 per 2, out the sides · {power:100 kW}', derivation: '§21 Machines: the Chem Vat, 100 kW; 12,000 coin, priced against the Act III factory (the Refinery\'s 9,000 against Act II\'s, a little dearer: it makes four recipes)' },
  greenhouse: { kind: 'greenhouse', name: 'Greenhouse', cost: 25000, w: 2, h: 2, unlock: 'hydroponics', machine: 'greenhouse', kw: 150, act2: true, blurb: '2×2 · {i:fertilizer} → 3 {i:produce}  30/min · {power:150 kW}', derivation: '§21 Machines: the Greenhouse, 2x2, 150 kW (a Mk2 smelter\'s draw); 25,000 coin, about an Assembler Mk2' },
  chuteMouth: { kind: 'chuteMouth', name: 'Chute Mouth', cost: 400, w: 1, h: 1, unlock: 'chutes', act2: true, blurb: 'drops what the Factory Chute takes · set it to an item · 120/min out the front', derivation: '§21 The Chute: a belt\'s speed out of its front (§4); 400 coin, a token: the Chute is a routing piece, not a machine' },
  // Act IV (DESIGN.md §22 Rime)
  heater: { kind: 'heater', name: 'Heater', cost: 3000, w: 1, h: 1, unlock: 'thermals', fuel: { items: ['coal'], seconds: 10 }, act2: true, blurb: 'burns {i:coal} · 1 per 10 s while a powered machine in reach runs · warms every powered machine within 2 tiles', derivation: '§22 Rime: a Heater warms what is within 2 tiles (a 5x5, a Pole\'s reach, §18) and burns a coal every 10 s while it warms anything (a fifth of a Generator\'s 3 s: heat, not power); 3,000 coin, a Kiln\'s price, so a cold line is fixed for the price of one of its machines' },
};

/** The build bar, in slot order (keys 1-9). */
export const BUILD_BAR: BuildKind[] = ['belt', 'miner', 'smelter', 'press', 'assembler', 'heap', 'splitter', 'merger', 'crate'];

/** The store's tabs of buildings (keys 1-9 pick from the tab that is open). */
export const STORE_TABS: { id: 'build' | 'power' | 'heavy'; name: string; kinds: BuildKind[] }[] = [
  { id: 'build', name: 'Build', kinds: BUILD_BAR },
  { id: 'power', name: 'Power', kinds: ['boiler', 'steamEngine', 'generator', 'pole'] },
  { id: 'heavy', name: 'Heavy', kinds: ['kiln', 'mixer', 'refinery', 'smelterMk2', 'pressMk2', 'assemblerMk2', 'chemVat', 'greenhouse', 'chuteMouth', 'heater'] },
];

export function isMachine(k: EntKind): boolean {
  return k === 'miner' || k === 'smelter' || k === 'press' || k === 'assembler' || k === 'furnace'
    || k === 'kiln' || k === 'mixer' || k === 'refinery' || k === 'smelterMk2' || k === 'pressMk2' || k === 'assemblerMk2'
    || k === 'chemVat' || k === 'greenhouse';
}

/** Buildings of the power grid (they are not crafting machines; they have their own pips). */
export function isPower(k: EntKind): boolean {
  return k === 'boiler' || k === 'steamEngine' || k === 'generator' || k === 'pole';
}

/** One-off upgrades bought with coin. */
export const UPGRADES = {
  bellows: { id: 'bellows', name: 'Bellows', cost: 25, blurb: 'Hand Furnace runs itself · {i:ironIngot} every 2.0 s · no cranking', derivation: '§4 Bellows; §16 first purchase at 20-40 s' },
} as const;
export type UpgradeId = keyof typeof UPGRADES;
