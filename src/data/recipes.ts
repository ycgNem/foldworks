// Recipes (DESIGN.md §3). Time is seconds per craft; the player sees rates per minute.
import type { ItemId } from './items';
import type { ResearchId } from './research';
import type { CustomerId } from './orders';

export type MachineKind = 'miner' | 'smelter' | 'press' | 'assembler' | 'kiln' | 'mixer' | 'refinery'
  // Act III (DESIGN.md §21)
  | 'chemVat' | 'greenhouse';

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
  /** only a Mk2 machine of its family crafts it (the Autonomous Sandwich Engineer's four inputs and
   * ten sandwiches need a 2x2's faces and buffer: DESIGN.md §21) */
  mk2?: boolean;
  /** an alternate recipe of the Second Cookbook (a Kernel node, DESIGN.md §23): known only with it,
   * and never counted for chain steps */
  alt?: boolean;
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
  // Act III (DESIGN.md §21 Tier 3)
  { id: 'mixSolvent', name: 'Solvent', machine: 'chemVat', inputs: [{ item: 'oil', n: 2 }, { item: 'sand', n: 1 }], outputs: [{ item: 'solvent', n: 1 }], byproduct: { item: 'sludge', every: 2 }, time: 2.0, unlock: 'chemistry', derivation: '§21 Tier 3: 2 oil + sand -> solvent, 2.0 s, sludge per 2: oil, the refinery\'s waste, is the input (one refinery\'s 7.5 oil/min feeds an eighth of a vat)' },
  { id: 'cureRubber', name: 'Rubber', machine: 'chemVat', inputs: [{ item: 'plastic', n: 1 }, { item: 'solvent', n: 1 }], outputs: [{ item: 'rubber', n: 2 }], time: 3.0, unlock: 'vulcanizing', derivation: '§21 Tier 3: plastic + solvent -> 2 rubber, 3.0 s' },
  { id: 'cellBattery', name: 'Battery', machine: 'chemVat', inputs: [{ item: 'copperIngot', n: 2 }, { item: 'solvent', n: 1 }, { item: 'plastic', n: 1 }], outputs: [{ item: 'battery', n: 1 }], time: 5.0, unlock: 'batteries', derivation: '§21 Tier 3: 2 copper ingots + solvent + plastic -> battery, 5.0 s' },
  { id: 'brewFertilizer', name: 'Fertilizer', machine: 'chemVat', inputs: [{ item: 'sludge', n: 2 }, { item: 'gravel', n: 1 }], outputs: [{ item: 'fertilizer', n: 1 }], time: 2.0, unlock: 'hydroponics', derivation: '§21 Tier 3: 2 sludge + gravel -> fertilizer, 2.0 s: the vat\'s waste and the smelter\'s together (§4 Byproducts)' },
  { id: 'pressBearing', name: 'Bearing', machine: 'press', inputs: [{ item: 'steel', n: 1 }], outputs: [{ item: 'bearing', n: 2 }], time: 2.0, unlock: 'bearings', derivation: '§21 Tier 3: steel -> 2 bearings, 2.0 s on the Press' },
  { id: 'buildGearbox', name: 'Gearbox', machine: 'assembler', inputs: [{ item: 'gear', n: 2 }, { item: 'bearing', n: 2 }, { item: 'steel', n: 1 }], outputs: [{ item: 'gearbox', n: 1 }], time: 6.0, unlock: 'bearings', derivation: '§21 Tier 3: 2 gears + 2 bearings + steel -> gearbox, 6.0 s' },
  { id: 'growProduce', name: 'Produce', machine: 'greenhouse', inputs: [{ item: 'fertilizer', n: 1 }], outputs: [{ item: 'produce', n: 3 }], time: 6.0, unlock: 'hydroponics', derivation: '§21 Tier 3: fertilizer -> 3 produce, 6.0 s in the Greenhouse' },
  { id: 'buildSensor', name: 'Sensor', machine: 'assembler', inputs: [{ item: 'glass', n: 2 }, { item: 'circuit', n: 1 }, { item: 'rubber', n: 1 }], outputs: [{ item: 'sensor', n: 1 }], time: 6.0, unlock: 'sensors', derivation: '§21 Tier 3: 2 glass + circuit + rubber -> sensor, 6.0 s' },
  { id: 'etchProcessor', name: 'Processor', machine: 'assembler', inputs: [{ item: 'circuit', n: 3 }, { item: 'solvent', n: 2 }], outputs: [{ item: 'processor', n: 1 }], time: 8.0, unlock: 'processors', derivation: '§21 Tier 3: 3 circuits + 2 solvent -> processor, 8.0 s' },
  { id: 'buildServo', name: 'Servo', machine: 'assembler', inputs: [{ item: 'motor', n: 1 }, { item: 'gearbox', n: 1 }, { item: 'circuit', n: 1 }], outputs: [{ item: 'servo', n: 1 }], time: 10.0, unlock: 'servos', derivation: '§21 Tier 3: motor + gearbox + circuit -> servo, 10 s' },
  { id: 'makeSandwich', name: 'Sandwich', machine: 'assembler', inputs: [{ item: 'produce', n: 3 }, { item: 'plastic', n: 1 }], outputs: [{ item: 'sandwich', n: 1 }], time: 4.0, unlock: 'sandwiches', derivation: '§21 Tier 3: 3 produce + plastic -> sandwich, 4.0 s' },
  { id: 'windFrog', name: 'Clockwork Frog', machine: 'assembler', inputs: [{ item: 'gearbox', n: 1 }, { item: 'bearing', n: 2 }, { item: 'rubber', n: 1 }], outputs: [{ item: 'clockworkFrog', n: 1 }], time: 8.0, unlock: 'servos', derivation: '§21 Tier 3: gearbox + 2 bearings + rubber -> clockwork frog, 8.0 s' },
  { id: 'rigBalloon', name: 'Weather Balloon', machine: 'assembler', inputs: [{ item: 'rubber', n: 3 }, { item: 'sensor', n: 1 }, { item: 'battery', n: 1 }], outputs: [{ item: 'weatherBalloon', n: 1 }], time: 10.0, unlock: 'sensors', derivation: '§21 Tier 3: 3 rubber + sensor + battery -> weather balloon, 10 s' },
  { id: 'foldUmbrella', name: 'Self-Folding Umbrella', machine: 'assembler', inputs: [{ item: 'servo', n: 1 }, { item: 'rubber', n: 2 }, { item: 'plastic', n: 1 }, { item: 'steel', n: 1 }], outputs: [{ item: 'umbrella', n: 1 }], time: 12.0, unlock: 'robotics', derivation: '§21 Tier 3: servo + 2 rubber + plastic + steel -> umbrella, 12 s' },
  { id: 'buildArm', name: 'Robot Arm', machine: 'assembler', inputs: [{ item: 'servo', n: 2 }, { item: 'sensor', n: 1 }, { item: 'steel', n: 2 }], outputs: [{ item: 'robotArm', n: 1 }], time: 16.0, unlock: 'robotics', derivation: '§21 Tier 3: 2 servos + sensor + 2 steel -> robot arm, 16 s' },
  { id: 'buildLiftRotor', name: 'Lift Rotor', machine: 'assembler', inputs: [{ item: 'motor', n: 2 }, { item: 'gearbox', n: 2 }, { item: 'steel', n: 4 }], outputs: [{ item: 'liftRotor', n: 1 }], time: 12.0, unlock: 'floatingCity', derivation: '§21 Megaprojects: 2 motors + 2 gearboxes + 4 steel -> lift rotor, 12 s' },
  { id: 'windCoil', name: 'Transmuter Coil', machine: 'assembler', inputs: [{ item: 'processor', n: 1 }, { item: 'battery', n: 2 }, { item: 'rubber', n: 4 }], outputs: [{ item: 'transmuterCoil', n: 1 }], time: 14.0, unlock: 'scrapTransmuter', derivation: '§21 Megaprojects: processor + 2 batteries + 4 rubber -> transmuter coil, 14 s' },
  { id: 'buildEngineer', name: 'Autonomous Sandwich Engineer', machine: 'assembler', mk2: true, inputs: [{ item: 'robotArm', n: 1 }, { item: 'processor', n: 1 }, { item: 'sandwich', n: 10 }, { item: 'battery', n: 1 }], outputs: [{ item: 'sandwichEngineer', n: 1 }], time: 30.0, unlock: 'sandwichEngineering', derivation: '§21 Tier 3: robot arm + processor + 10 sandwiches + battery -> the Engineer, 30 s, Assembler Mk2 only (7.5 s at its 4x)' },
  // Act IV (DESIGN.md §22 Tier 4): each island's exotic is mined like ore, and each island's goods
  // are made from its exotic and the tier 2 and 3 goods every island makes
  { id: 'mineSkyglass', name: 'Mine skyglass', machine: 'miner', inputs: [], outputs: [{ item: 'skyglass', n: 1 }], time: 2.0, unlock: null, derivation: '§22 Tier 4: a Miner 2.0 s, like ore (Pebble Isle\'s deposit)' },
  { id: 'mineCinderite', name: 'Mine cinderite', machine: 'miner', inputs: [], outputs: [{ item: 'cinderite', n: 1 }], time: 2.0, unlock: null, derivation: '§22 Tier 4: a Miner 2.0 s (Cinder Isle\'s deposit)' },
  { id: 'mineRime', name: 'Mine rime crystal', machine: 'miner', inputs: [], outputs: [{ item: 'rimeCrystal', n: 1 }], time: 2.0, unlock: null, derivation: '§22 Tier 4: a Miner 2.0 s (Rime\'s deposit)' },
  { id: 'mineRelic', name: 'Dig relics', machine: 'miner', inputs: [], outputs: [{ item: 'relic', n: 1 }], time: 2.0, unlock: null, derivation: '§22 Tier 4: a Miner 2.0 s (the Old Works\' seam)' },
  { id: 'cutLens', name: 'Skyglass Lens', machine: 'kiln', inputs: [{ item: 'skyglass', n: 2 }, { item: 'glass', n: 1 }], outputs: [{ item: 'skyglassLens', n: 1 }], time: 3.0, unlock: 'skyglassCutting', derivation: '§22 Tier 4: 2 skyglass + glass -> lens, 3.0 s in the Kiln (a Miner\'s 30/min of skyglass feeds 1.5 kilns: Pebble\'s 1.5x Miners feed two)' },
  { id: 'smeltCinder', name: 'Cinder Alloy', machine: 'smelter', inputs: [{ item: 'cinderite', n: 1 }, { item: 'steel', n: 1 }], outputs: [{ item: 'cinderAlloy', n: 1 }], byproduct: { item: 'slag', every: 2 }, time: 3.0, unlock: 'cinderSmelting', derivation: '§22 Tier 4: cinderite + steel -> alloy, 3.0 s in the Smelter, slag per 2 (as steel, §18)' },
  { id: 'brewDye', name: 'Sunset Dye', machine: 'chemVat', inputs: [{ item: 'cinderite', n: 2 }, { item: 'solvent', n: 1 }], outputs: [{ item: 'sunsetDye', n: 1 }], time: 3.0, unlock: 'sunsetDyes', derivation: '§22 Tier 4: 2 cinderite + solvent -> dye, 3.0 s in the Chem Vat' },
  { id: 'temperFrost', name: 'Frost Alloy', machine: 'chemVat', inputs: [{ item: 'rimeCrystal', n: 1 }, { item: 'steel', n: 1 }, { item: 'solvent', n: 1 }], outputs: [{ item: 'frostAlloy', n: 1 }], time: 4.0, unlock: 'frostWorks', derivation: '§22 Tier 4: rime crystal + steel + solvent -> frost alloy, 4.0 s in the Chem Vat' },
  { id: 'cutRelicGear', name: 'Relic Gear', machine: 'assembler', inputs: [{ item: 'relic', n: 1 }, { item: 'gear', n: 2 }, { item: 'bearing', n: 1 }], outputs: [{ item: 'relicGear', n: 1 }], time: 4.0, unlock: 'relicStudy', derivation: '§22 Tier 4: relic + 2 gears + bearing -> relic gear, 4.0 s in the Assembler' },
  { id: 'chargeStorm', name: 'Storm Cell', machine: 'chemVat', inputs: [{ item: 'frostAlloy', n: 1 }, { item: 'battery', n: 1 }], outputs: [{ item: 'stormCell', n: 1 }], time: 6.0, unlock: 'stormCells', derivation: '§22 Tier 4: frost alloy + battery -> storm cell, 6.0 s in the Chem Vat' },
  { id: 'grindHorizon', name: 'Horizon Lens', machine: 'assembler', inputs: [{ item: 'skyglassLens', n: 2 }, { item: 'sensor', n: 1 }], outputs: [{ item: 'horizonLens', n: 1 }], time: 8.0, unlock: 'horizonOptics', derivation: '§22 Tier 4: 2 skyglass lenses + sensor -> horizon lens, 8.0 s' },
  { id: 'bottleWeather', name: 'Pocket Weather', machine: 'assembler', mk2: true, inputs: [{ item: 'stormCell', n: 2 }, { item: 'weatherBalloon', n: 1 }, { item: 'umbrella', n: 1 }], outputs: [{ item: 'pocketWeather', n: 1 }], time: 24.0, unlock: 'pocketWeathers', derivation: '§22 Tier 4: 2 storm cells + weather balloon + umbrella -> Pocket Weather, 24 s, Assembler Mk2 only (6 s at its 4x; four inputs want a 2x2\'s faces, as the Engineer, §21)' },
  { id: 'buildSunset', name: 'Portable Sunset Generator', machine: 'assembler', mk2: true, inputs: [{ item: 'sunsetDye', n: 4 }, { item: 'sandwichEngineer', n: 1 }, { item: 'cinderAlloy', n: 2 }], outputs: [{ item: 'sunsetGenerator', n: 1 }], time: 30.0, unlock: 'sunsetEngineering', derivation: '§22 Tier 4: 4 sunset dye + an Engineer + 2 cinder alloy -> the Portable Sunset Generator, 30 s, Assembler Mk2 only (as the Engineer, §21)' },
  { id: 'buildLamp', name: 'Lighthouse Lamp', machine: 'assembler', inputs: [{ item: 'sensor', n: 1 }, { item: 'battery', n: 1 }, { item: 'glass', n: 4 }], outputs: [{ item: 'lighthouseLamp', n: 1 }], time: 10.0, unlock: 'lighthouse', derivation: '§22 Megaprojects: sensor + battery + 4 glass -> lamp, 10 s (made of what every island makes, so every island can build its stage)' },
  { id: 'forgeChain', name: 'Anchor Chain', machine: 'assembler', inputs: [{ item: 'steel', n: 4 }, { item: 'bearing', n: 2 }, { item: 'gearbox', n: 1 }], outputs: [{ item: 'anchorChain', n: 1 }], time: 8.0, unlock: 'skyAnchor', derivation: '§22 Megaprojects: 4 steel + 2 bearings + gearbox -> chain, 8 s (made of what every island makes)' },
  // Act V (DESIGN.md §23 Tier 5): the impossible inventions, Assembler Mk2 only (four inputs and big
  // counts want a 2x2's faces and buffer, as the Engineer, §21), each island's of its own tier 4
  // goods, taught by the island's Act V research
  { id: 'chartEverywhere', name: 'A Map of Everywhere', machine: 'assembler', mk2: true, inputs: [{ item: 'horizonLens', n: 4 }, { item: 'processor', n: 2 }], outputs: [{ item: 'mapOfEverywhere', n: 1 }], time: 30.0, unlock: 'cartography', derivation: '§23 Tier 5: 4 horizon lenses + 2 processors -> a Map of Everywhere, 30 s (7.5 s at the Mk2\'s 4x: a Horizon group at 0.1-0.2 a second feeds one)' },
  { id: 'climbStaircase', name: 'The Infinite Staircase', machine: 'assembler', mk2: true, inputs: [{ item: 'skyglassLens', n: 20 }, { item: 'servo', n: 4 }, { item: 'steel', n: 10 }], outputs: [{ item: 'infiniteStaircase', n: 1 }], time: 24.0, unlock: 'cartography', derivation: '§23 Tier 5: 20 skyglass lenses + 4 servos + 10 steel -> the Staircase, 24 s: Pebble\'s bulk lens (0.5-1 a second) into a finished good' },
  { id: 'kindleSun', name: 'A Very Small Sun', machine: 'assembler', mk2: true, inputs: [{ item: 'sunsetGenerator', n: 1 }, { item: 'cinderAlloy', n: 6 }, { item: 'sunsetDye', n: 4 }], outputs: [{ item: 'verySmallSun', n: 1 }], time: 60.0, unlock: 'starForging', derivation: '§23 Tier 5: a Sunset Generator + 6 cinder alloy + 4 dye -> a Very Small Sun, 60 s (15 s at 4x: a Sunset group of 0.02-0.05 a second feeds it, so a Sun module is slow and dear)' },
  { id: 'bottleTuesday', name: 'Bottled Tuesday', machine: 'assembler', mk2: true, inputs: [{ item: 'pocketWeather', n: 1 }, { item: 'stormCell', n: 4 }, { item: 'processor', n: 1 }], outputs: [{ item: 'bottledTuesday', n: 1 }], time: 40.0, unlock: 'weatherBottling', derivation: '§23 Tier 5: Pocket Weather + 4 storm cells + a processor -> Bottled Tuesday, 40 s' },
  { id: 'keepSandwich', name: 'The Everlasting Sandwich', machine: 'assembler', mk2: true, inputs: [{ item: 'sandwichEngineer', n: 1 }, { item: 'sandwich', n: 10 }, { item: 'frostAlloy', n: 4 }], outputs: [{ item: 'everlastingSandwich', n: 1 }], time: 40.0, unlock: 'weatherBottling', derivation: '§23 Tier 5: an Engineer + 10 sandwiches + 4 frost alloy -> the Everlasting Sandwich, 40 s' },
  { id: 'hushEngine', name: 'The Quiet Engine', machine: 'assembler', mk2: true, inputs: [{ item: 'relicGear', n: 8 }, { item: 'servo', n: 2 }, { item: 'gearbox', n: 2 }], outputs: [{ item: 'quietEngine', n: 1 }], time: 20.0, unlock: 'relicEngines', derivation: '§23 Tier 5: 8 relic gears + 2 servos + 2 gearboxes -> the Quiet Engine, 20 s: the Old Works\' one exotic good made worth folding' },
  { id: 'pocketAnIsland', name: 'The Pocket Island', machine: 'assembler', mk2: true, inputs: [{ item: 'relicGear', n: 20 }, { item: 'robotArm', n: 1 }, { item: 'fertilizer', n: 10 }], outputs: [{ item: 'pocketIsland', n: 1 }], time: 40.0, unlock: 'relicEngines', derivation: '§23 Tier 5: 20 relic gears + a robot arm + 10 fertilizer -> the Pocket Island, 40 s' },
  // the Folded Universe Replica: each island folds it its own way (one recipe an island, each about
  // 1.06M of that island's tier 5 goods), so every island has a capstone and none is required
  { id: 'replicaPebble', name: 'Folded Universe (Pebble\'s way)', machine: 'assembler', mk2: true, inputs: [{ item: 'mapOfEverywhere', n: 12 }, { item: 'infiniteStaircase', n: 4 }], outputs: [{ item: 'foldedUniverse', n: 1 }], time: 120.0, unlock: 'cartography', derivation: '§23 Tier 5: 12 maps + 4 staircases (1,064,000) -> the Replica, 120 s' },
  { id: 'replicaCinder', name: 'Folded Universe (Cinder\'s way)', machine: 'assembler', mk2: true, inputs: [{ item: 'verySmallSun', n: 1 }, { item: 'processor', n: 2 }], outputs: [{ item: 'foldedUniverse', n: 1 }], time: 120.0, unlock: 'starForging', derivation: '§23 Tier 5: a Very Small Sun + 2 processors (1,054,400) -> the Replica, 120 s' },
  { id: 'replicaRime', name: 'Folded Universe (Rime\'s way)', machine: 'assembler', mk2: true, inputs: [{ item: 'bottledTuesday', n: 3 }, { item: 'everlastingSandwich', n: 1 }], outputs: [{ item: 'foldedUniverse', n: 1 }], time: 120.0, unlock: 'weatherBottling', derivation: '§23 Tier 5: 3 Bottled Tuesdays + an Everlasting Sandwich (1,070,000) -> the Replica, 120 s' },
  { id: 'replicaOld', name: 'Folded Universe (the Old Works\' way)', machine: 'assembler', mk2: true, inputs: [{ item: 'pocketIsland', n: 8 }, { item: 'quietEngine', n: 8 }], outputs: [{ item: 'foldedUniverse', n: 1 }], time: 120.0, unlock: 'relicEngines', derivation: '§23 Tier 5: 8 Pocket Islands + 8 Quiet Engines (1,072,000) -> the Replica, 120 s' },
  // the Second Cookbook (a Kernel node, DESIGN.md §23): alternate recipes, each a different shape of
  // line for a product the player already makes; known with the Kernel and the product's research,
  // never counted for chain steps (src/sim/reorganize.ts chainSteps)
  { id: 'oreSteel', name: 'Steel from ore', machine: 'smelter', alt: true, inputs: [{ item: 'ironOre', n: 2 }, { item: 'coal', n: 1 }], outputs: [{ item: 'steel', n: 1 }], byproduct: { item: 'slag', every: 1 }, time: 4.0, unlock: 'steelmaking', derivation: '§23 The Second Cookbook: 2 ore + coal -> steel in one Smelter, 4 s, a slag every craft: the ingot step is gone, twice the slag of steel (§18) to route' },
  { id: 'slagGlass', name: 'Glass from slag', machine: 'kiln', alt: true, inputs: [{ item: 'slag', n: 2 }, { item: 'sand', n: 1 }], outputs: [{ item: 'glass', n: 1 }], time: 2.5, unlock: 'glassworks', derivation: '§23 The Second Cookbook: 2 slag + sand -> glass, 2.5 s: a steel line\'s slag (one per 2 crafts, §18) feeds its own Kiln, a zero-waste box without a Press' },
  { id: 'brickCircuit', name: 'Circuit on a brick', machine: 'assembler', alt: true, inputs: [{ item: 'copperWire', n: 4 }, { item: 'slagBrick', n: 2 }], outputs: [{ item: 'circuit', n: 1 }], time: 6.0, unlock: 'circuits', derivation: '§23 The Second Cookbook: 4 wire + 2 slag bricks -> circuit, 6 s: no plastic and no glass (no Refinery, no Kiln), the slice\'s slag bricks back in Act V' },
  { id: 'oilPlastic', name: 'Plastic from oil', machine: 'refinery', alt: true, inputs: [{ item: 'oil', n: 3 }], outputs: [{ item: 'plastic', n: 1 }], time: 4.0, unlock: 'refining', derivation: '§23 The Second Cookbook: 3 oil -> plastic, 4 s: a Refinery\'s own oil (one per 2 crafts, §18) feeds a second one, so a plastic box has no oil to route out' },
  { id: 'castGearbox', name: 'Cast gearbox', machine: 'assembler', alt: true, inputs: [{ item: 'steel', n: 3 }, { item: 'gear', n: 2 }], outputs: [{ item: 'gearbox', n: 1 }], time: 8.0, unlock: 'bearings', derivation: '§23 The Second Cookbook: 3 steel + 2 gears -> gearbox, 8 s: no bearings, so no bearing Press in the box' },
];

export const RECIPE: Record<string, RecipeDef> = Object.fromEntries(RECIPES.map((r) => [r.id, r]));

export function recipesFor(machine: MachineKind): RecipeDef[] {
  return RECIPES.filter((r) => r.machine === machine);
}
