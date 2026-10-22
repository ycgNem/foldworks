// Items (DESIGN.md §3). `value` is what the Dock pays for one (Mayor Bramble's standing order).
// Every number carries a derivation naming its DESIGN.md section (tests/data.test.ts).

export const ITEM_IDS = [
  'ironOre', 'copperOre', 'ironIngot', 'copperIngot', 'slag', 'ironPlate', 'copperWire', 'gear', 'slagBrick', 'gizmo',
  // Act II (DESIGN.md §18), in the order of src/art/items2.png
  'coal', 'sand', 'steel', 'glass', 'gravel', 'concrete', 'plastic', 'circuit', 'machineKit', 'motor', 'oil', 'drillBit',
  // Act III (DESIGN.md §21), in the order of src/art/items3.png
  'solvent', 'sludge', 'rubber', 'battery', 'fertilizer', 'bearing', 'gearbox', 'produce', 'sensor', 'processor', 'servo',
  'sandwich', 'clockworkFrog', 'weatherBalloon', 'umbrella', 'robotArm', 'liftRotor', 'transmuterCoil', 'sandwichEngineer',
  // Act IV (DESIGN.md §22), in the order of src/art/items4.png: the four exotics, then the islands' goods
  'skyglass', 'cinderite', 'rimeCrystal', 'relic', 'skyglassLens', 'cinderAlloy', 'frostAlloy', 'relicGear', 'stormCell',
  'sunsetDye', 'horizonLens', 'pocketWeather', 'sunsetGenerator', 'lighthouseLamp', 'anchorChain',
  // Act V (DESIGN.md §23), in the order of src/art/items5.png: the impossible inventions
  'bottledTuesday', 'mapOfEverywhere', 'verySmallSun', 'pocketIsland', 'quietEngine', 'foldedUniverse',
  'everlastingSandwich', 'infiniteStaircase',
] as const;
export type ItemId = (typeof ITEM_IDS)[number];

export interface ItemDef {
  id: ItemId;
  name: string;
  /** coin the Dock pays for one */
  value: number;
  /** the Dock refuses it (slag, kits, drill bits) */
  refused?: boolean;
  /** a byproduct: waste a recipe makes on the side (slag, oil, sludge); the Scrap Transmuter pays
   * for it at a share of what made it (DESIGN.md §21) */
  waste?: boolean;
  /** delivered to a Hopper it goes to the parts bank, not to research (Machine Kits) */
  parts?: boolean;
  /** the item's colour family, for code-drawn icons and the flow overlay (palette names) */
  color: string;
  flavor: string;
  derivation: string;
}

export const ITEMS: Record<ItemId, ItemDef> = {
  ironOre: { id: 'ironOre', name: 'Iron ore', value: 1, color: 'sky', flavor: 'Lumpy, rusty, full of promise.', derivation: '§3 base unit' },
  copperOre: { id: 'copperOre', name: 'Copper ore', value: 1, color: 'copper', flavor: 'Green on the outside, pennies on the inside.', derivation: '§3 base unit' },
  ironIngot: { id: 'ironIngot', name: 'Iron ingot', value: 3, color: 'ice', flavor: 'Still warm. Hold it by the cold end.', derivation: '§3 3x ore: smelting is the first, big reward' },
  copperIngot: { id: 'copperIngot', name: 'Copper ingot', value: 3, color: 'tan', flavor: 'Shiny enough to see your bad decisions in.', derivation: '§3 same as iron' },
  slag: { id: 'slag', name: 'Slag', value: 0, refused: true, waste: true, color: 'violet', flavor: 'What is left when the iron leaves. Nobody wants it. Yet.', derivation: '§3 1 per 4 ingots; §4 Byproducts: the Dock refuses it' },
  ironPlate: { id: 'ironPlate', name: 'Iron plate', value: 5, color: 'sky', flavor: 'Flat. Very flat. Bramble is building a boardwalk.', derivation: '§3 +2 per press step' },
  copperWire: { id: 'copperWire', name: 'Copper wire', value: 2, color: 'amber', flavor: 'Coils itself up the moment nobody is looking.', derivation: '§3 4 per ingot: +1 over the ingot' },
  gear: { id: 'gear', name: 'Gear', value: 14, color: 'mist', flavor: 'Teeth on the outside, purpose on the inside.', derivation: '§3 10 in -> 14 (+40%)' },
  slagBrick: { id: 'slagBrick', name: 'Slag brick', value: 6, color: 'plum', flavor: 'Waste, pressed into usefulness. The town loves a brick.', derivation: '§3 research 9: waste becomes value' },
  gizmo: { id: 'gizmo', name: 'Gizmo', value: 80, color: 'gold', flavor: "Does something. Bramble isn't sure what. Bramble loves it.", derivation: '§3 18 in (gear + 2 wire) -> 80 (x4.4): the first product' },
  coal: { id: 'coal', name: 'Coal', value: 2, color: 'ink', flavor: 'Old forest, squashed flat for a very long time. Burns with opinions.', derivation: '§18 Items: raw, 2 (it burns: worth a little more than ore)' },
  sand: { id: 'sand', name: 'Sand', value: 1, color: 'clay', flavor: 'Gets everywhere. Especially into glass.', derivation: '§18 Items: raw, 1' },
  steel: { id: 'steel', name: 'Steel', value: 22, color: 'mist', flavor: 'Iron that went to finishing school.', derivation: '§18 Items: ingot 3 + coal 2 -> 22 (x4.4); an S-grade Steel module of a full-speed line (0.42/s) earns 9.2 coin/s, over the 7.3 per module of a slice Gizmo chain (3 modules, 0.27 Gizmos/s x 80): Act II goods out-earn the Gizmo per module tile (the Milestone 4 review)' },
  glass: { id: 'glass', name: 'Glass', value: 12, color: 'ice', flavor: 'Sand that has seen the light.', derivation: '§18 Items: 2 sand -> 12 (x6); an S-grade Glass module of a full-speed kiln (0.62/s) earns 7.5 coin/s, over a Gizmo chain per module (7.3)' },
  gravel: { id: 'gravel', name: 'Gravel', value: 2, color: 'fog', flavor: 'Slag, crushed small enough for a road to love.', derivation: '§18 Items: 2 slag (0) -> 2: waste becomes an input' },
  concrete: { id: 'concrete', name: 'Concrete', value: 32, color: 'hull2', flavor: 'Gravel, sand and patience. Mostly patience.', derivation: '§18 Items: 2 gravel + sand (5) -> 32; an S-grade Concrete module (0.42/s) earns 13 coin/s from slag the Dock scraps for nothing' },
  plastic: { id: 'plastic', name: 'Plastic', value: 24, color: 'violet', flavor: 'Coal tar, cooked until it forgets it was coal.', derivation: '§18 Items: 2 coal (4) -> 24 plus oil; an S-grade Plastic module of a full-speed refinery (0.31/s) earns 7.5 coin/s, over a Gizmo chain per module (7.3)' },
  circuit: { id: 'circuit', name: 'Circuit', value: 180, color: 'leaf', flavor: 'Wire that learned to think. Mostly about wire.', derivation: '§18 Items: 3 wire + plastic + glass (42) -> 180 (x4.3); a circuits chain (Circuits, Plastic and Glass modules, S grade, 0.25 circuits/s) earns 45 coin/s, 15 per module against a Gizmo chain 7.3' },
  machineKit: { id: 'machineKit', name: 'Machine Kit', value: 0, refused: true, parts: true, color: 'brass1', flavor: 'A whole machine in a crate. Instructions in frog.', derivation: '§18 Machine Kits: parts for stamps, not for sale' },
  motor: { id: 'motor', name: 'Motor', value: 640, color: 'copper', flavor: 'Spins. Endlessly. Bramble watched one for an hour.', derivation: '§18 Items: steel + 4 wire + circuit (210) -> 640 (x3.0)' },
  oil: { id: 'oil', name: 'Oil', value: 3, waste: true, color: 'shadow', flavor: "The refinery's leftovers. The boiler's favourite snack.", derivation: '§18 Items: the refinery\'s byproduct, 3; boiler fuel' },
  drillBit: { id: 'drillBit', name: 'Drill Bit', value: 0, refused: true, color: 'gold', flavor: 'For a drill the size of a town. Do not ask Bramble where the town goes.', derivation: '§18 Megaproject: the Great Drill\'s part, not for sale' },
  // Act III (DESIGN.md §21 Tier 3): each step pays about 3-4x its inputs at the Dock, as §18
  solvent: { id: 'solvent', name: 'Solvent', value: 30, color: 'teal', flavor: 'Dissolves grease, grime and, occasionally, the flask.', derivation: '§21 Tier 3: 2 oil + sand (7) -> 30 (x4.3): oil, the refinery\'s waste, becomes an input' },
  sludge: { id: 'sludge', name: 'Sludge', value: 0, refused: true, waste: true, color: 'shadow', flavor: 'What solvent leaves behind. It has opinions about you.', derivation: '§21 Tier 3: the Chem Vat\'s byproduct, 1 per 2 solvents; the Dock refuses it' },
  rubber: { id: 'rubber', name: 'Rubber', value: 80, color: 'ink', flavor: 'Bounces. Bramble has been told not to.', derivation: '§21 Tier 3: plastic + solvent (54) -> 2 rubber (160, x3.0)' },
  battery: { id: 'battery', name: 'Battery', value: 240, color: 'leaf', flavor: 'Holds a charge and, somehow, a grudge.', derivation: '§21 Tier 3: 2 copper ingots + solvent + plastic (60) -> 240 (x4)' },
  fertilizer: { id: 'fertilizer', name: 'Fertilizer', value: 12, color: 'moss', flavor: 'Sludge with a purpose. Smells exactly as you fear.', derivation: '§21 Tier 3: 2 sludge (0) + gravel (2) -> 12: waste becomes an input again (§4 Byproducts)' },
  bearing: { id: 'bearing', name: 'Bearing', value: 33, color: 'mist', flavor: 'Tiny steel balls, very well behaved.', derivation: '§21 Tier 3: steel (22) -> 2 bearings (66, x3.0; was 30, x2.7, under §18\'s 3-4x: the second gate)' },
  gearbox: { id: 'gearbox', name: 'Gearbox', value: 360, color: 'brass1', flavor: 'Gears, but organised. Gears with a filing system.', derivation: '§21 Tier 3: 2 gears + 2 bearings + steel (110) -> 360 (x3.3)' },
  produce: { id: 'produce', name: 'Produce', value: 12, color: 'leaf', flavor: 'Grown in the sky, under glass, on sludge. Delicious, allegedly.', derivation: '§21 Tier 3: fertilizer (12) -> 3 produce (36, x3.0; was 10, x2.5: the second gate) in the Greenhouse' },
  sensor: { id: 'sensor', name: 'Sensor', value: 1000, color: 'ice', flavor: 'It sees you. It has no comment.', derivation: '§21 Tier 3: 2 glass + circuit + rubber (284) -> 1,000 (x3.5)' },
  processor: { id: 'processor', name: 'Processor', value: 2200, color: 'leaf', flavor: 'Thinks very fast about very little.', derivation: '§21 Tier 3: 3 circuits + 2 solvent (600) -> 2,200 (x3.7)' },
  servo: { id: 'servo', name: 'Servo', value: 3600, color: 'copper', flavor: 'A motor that knows where it is. Smug about it.', derivation: '§21 Tier 3: motor + gearbox + circuit (1,180) -> 3,600 (x3.1)' },
  sandwich: { id: 'sandwich', name: 'Sandwich', value: 200, color: 'tan', flavor: 'Sky lettuce, sky lettuce, more sky lettuce, in cling film.', derivation: '§21 Tier 3: 3 produce + plastic (60) -> 200 (x3.3)' },
  clockworkFrog: { id: 'clockworkFrog', name: 'Clockwork Frog', value: 1800, color: 'moss', flavor: 'Hops eleven times, then sits with dignity. Bramble cried.', derivation: '§21 Tier 3: gearbox + 2 bearings + rubber (500) -> 1,800 (x3.6)' },
  weatherBalloon: { id: 'weatherBalloon', name: 'Weather Balloon', value: 4600, color: 'cream', flavor: 'Goes up, writes down the weather, comes down cross.', derivation: '§21 Tier 3: 3 rubber + sensor + battery (1,480) -> 4,600 (x3.1)' },
  umbrella: { id: 'umbrella', name: 'Self-Folding Umbrella', value: 12000, color: 'violet', flavor: 'Folds itself into one tile. Someone here would appreciate that.', derivation: '§21 Tier 3: servo + 2 rubber + plastic + steel (3,806) -> 12,000 (x3.2)' },
  robotArm: { id: 'robotArm', name: 'Robot Arm', value: 25000, color: 'steel', flavor: 'Reaches for things. Usually the right things.', derivation: '§21 Tier 3: 2 servos + sensor + 2 steel (8,244) -> 25,000 (x3.03; was 24,000, x2.9: the second gate)' },
  liftRotor: { id: 'liftRotor', name: 'Lift Rotor', value: 0, refused: true, color: 'brass1', flavor: 'Keeps a city in the sky. Please do not unplug.', derivation: '§21 Megaprojects: the Floating City\'s part, not for sale' },
  transmuterCoil: { id: 'transmuterCoil', name: 'Transmuter Coil', value: 0, refused: true, color: 'violet', flavor: 'Hums in a key that turns rubbish into change.', derivation: '§21 Megaprojects: the Scrap Transmuter\'s part, not for sale' },
  sandwichEngineer: { id: 'sandwichEngineer', name: 'Autonomous Sandwich Engineer', value: 90000, color: 'gold', flavor: 'Designs, builds and eats its own sandwiches. Has a union.', derivation: '§21 Tier 3: robot arm + processor + 10 sandwiches + battery (29,440) -> 90,000 (x3.06): Act III\'s first absurd product' },
  // Act IV (DESIGN.md §22 Tier 4): each island's exotic deposit and the goods made of it, each step
  // about 3-4x its inputs at the Dock, as §18 and §21
  skyglass: { id: 'skyglass', name: 'Skyglass', value: 4, color: 'ice', flavor: 'Glass the sky made by itself, then dropped.', derivation: '§22 Tier 4: raw, Pebble Isle\'s exotic deposit; 4, twice coal (§18): a rarer raw, one deposit an island' },
  cinderite: { id: 'cinderite', name: 'Cinderite', value: 4, color: 'hot', flavor: 'Warm to the touch. Warmer if you insult it.', derivation: '§22 Tier 4: raw, Cinder Isle\'s exotic deposit; 4, as skyglass' },
  rimeCrystal: { id: 'rimeCrystal', name: 'Rime crystal', value: 4, color: 'ice', flavor: 'Frost that forgot to melt, on purpose.', derivation: '§22 Tier 4: raw, Rime\'s exotic deposit; 4, as skyglass' },
  relic: { id: 'relic', name: 'Relic', value: 4, color: 'brass1', flavor: 'A part of something. Nobody remembers what. It still turns.', derivation: '§22 Tier 4: raw, the Old Works\' exotic deposit (a seam of old parts); 4, as skyglass' },
  skyglassLens: { id: 'skyglassLens', name: 'Skyglass Lens', value: 70, color: 'ice', flavor: 'Shows you the weather from the other side.', derivation: '§22 Tier 4: 2 skyglass + glass (20) -> 70 (x3.5) in the Kiln' },
  cinderAlloy: { id: 'cinderAlloy', name: 'Cinder Alloy', value: 90, color: 'hot', flavor: 'Steel that has been to a volcano and come back smug.', derivation: '§22 Tier 4: cinderite + steel (26) -> 90 (x3.5) in the Smelter, slag per 2' },
  frostAlloy: { id: 'frostAlloy', name: 'Frost Alloy', value: 200, color: 'mist', flavor: 'Never warms up. Not even to you.', derivation: '§22 Tier 4: rime crystal + steel + solvent (56) -> 200 (x3.6) in the Chem Vat' },
  relicGear: { id: 'relicGear', name: 'Relic Gear', value: 220, color: 'brass1', flavor: 'An old gear, re-toothed. It hums a tune from before the town.', derivation: '§22 Tier 4: relic + 2 gears + bearing (62) -> 220 (x3.5) in the Assembler' },
  stormCell: { id: 'stormCell', name: 'Storm Cell', value: 1500, color: 'sky', flavor: 'A thunderstorm in a can. Do not shake.', derivation: '§22 Tier 4: frost alloy + battery (440) -> 1,500 (x3.4) in the Chem Vat' },
  sunsetDye: { id: 'sunsetDye', name: 'Sunset Dye', value: 130, color: 'amber', flavor: 'Exactly the orange of six forty-two in the evening.', derivation: '§22 Tier 4: 2 cinderite + solvent (38) -> 130 (x3.4) in the Chem Vat' },
  horizonLens: { id: 'horizonLens', name: 'Horizon Lens', value: 4000, color: 'cream', flavor: 'Look through it and the edge of the world waves back.', derivation: '§22 Tier 4: 2 skyglass lenses + sensor (1,140) -> 4,000 (x3.5) in the Assembler' },
  pocketWeather: { id: 'pocketWeather', name: 'Pocket Weather', value: 64000, color: 'sky', flavor: 'A small cloud, an umbrella and a strong opinion about Tuesday.', derivation: '§22 Tier 4: 2 storm cells + weather balloon + umbrella (19,600) -> 64,000 (x3.3), Assembler Mk2 only: Rime\'s absurd product' },
  sunsetGenerator: { id: 'sunsetGenerator', name: 'Portable Sunset Generator', value: 300000, color: 'gold', flavor: 'Fits in a cart. Ends the day whenever you like. Requires an Engineer to supervise.', derivation: '§22 Tier 4: 4 sunset dye + an Autonomous Sandwich Engineer + 2 cinder alloy (90,700) -> 300,000 (x3.3), Assembler Mk2 only: Cinder Isle\'s absurd product, one step past the Engineer' },
  lighthouseLamp: { id: 'lighthouseLamp', name: 'Lighthouse Lamp', value: 0, refused: true, color: 'gold', flavor: 'Bright enough to be seen from the next island. That is the point.', derivation: '§22 Megaprojects: the Lighthouse at the Edge\'s part, not for sale' },
  anchorChain: { id: 'anchorChain', name: 'Anchor Chain', value: 0, refused: true, color: 'steel', flavor: 'Each link is a promise not to drift.', derivation: '§22 Megaprojects: the Sky Anchor\'s part, not for sale' },
  // Act V (DESIGN.md §23 Tier 5): the impossible inventions, each made on one island of its tier 4
  // goods at about 3.5x their inputs (§18's rule), so Beyond's Dock sells what the islands fold
  bottledTuesday: { id: 'bottledTuesday', name: 'Bottled Tuesday', value: 250000, color: 'sky', flavor: 'A whole Tuesday, corked. Open it on a Monday to skip ahead.', derivation: '§23 Tier 5: Pocket Weather + 4 storm cells + a processor (72,200) -> 250,000 (x3.5), Assembler Mk2, Rime' },
  mapOfEverywhere: { id: 'mapOfEverywhere', name: 'A Map of Everywhere', value: 70000, color: 'cream', flavor: 'Folds down to the size of a stamp. Unfolds to the size of everywhere. Do not unfold it indoors.', derivation: '§23 Tier 5: 4 horizon lenses + 2 processors (20,400) -> 70,000 (x3.4), Assembler Mk2, Pebble Isle' },
  verySmallSun: { id: 'verySmallSun', name: 'A Very Small Sun', value: 1050000, color: 'gold', flavor: 'About the size of a grapefruit. Please do not eat it.', derivation: '§23 Tier 5: a Portable Sunset Generator + 6 cinder alloy + 4 sunset dye (301,060) -> 1,050,000 (x3.5), Assembler Mk2, Cinder Isle' },
  pocketIsland: { id: 'pocketIsland', name: 'The Pocket Island', value: 100000, color: 'moss', flavor: 'Comes with its own frog. The frog has its own pocket island.', derivation: '§23 Tier 5: 20 relic gears + a robot arm + 10 fertilizer (29,520) -> 100,000 (x3.4), Assembler Mk2, the Old Works' },
  quietEngine: { id: 'quietEngine', name: 'The Quiet Engine', value: 34000, color: 'steel', flavor: 'It runs. You can tell because nothing else is quite so silent.', derivation: '§23 Tier 5: 8 relic gears + 2 servos + 2 gearboxes (9,680) -> 34,000 (x3.5), Assembler Mk2, the Old Works' },
  foldedUniverse: { id: 'foldedUniverse', name: 'The Folded Universe Replica', value: 3600000, color: 'violet', flavor: 'A scale model of everything, folded. The scale is 1:1. It is also a lot smaller.', derivation: '§23 Tier 5: each island folds it its own way, about 1.06M of that island\'s tier 5 goods -> 3,600,000 (x3.4), Assembler Mk2, 120 s' },
  everlastingSandwich: { id: 'everlastingSandwich', name: 'The Everlasting Sandwich', value: 320000, color: 'amber', flavor: 'Take a bite and it is whole again. The Engineer is very proud and very tired.', derivation: '§23 Tier 5: an Autonomous Sandwich Engineer + 10 sandwiches + 4 frost alloy (92,800) -> 320,000 (x3.4), Assembler Mk2, Rime (the frost keeps it fresh)' },
  infiniteStaircase: { id: 'infiniteStaircase', name: 'The Infinite Staircase', value: 56000, color: 'ice', flavor: 'Every step is the first step. The view is excellent all the way up.', derivation: '§23 Tier 5: 20 skyglass lenses + 4 servos + 10 steel (16,020) -> 56,000 (x3.5), Assembler Mk2, Pebble Isle' },
};

export function itemName(id: string): string {
  return (ITEMS as Record<string, ItemDef>)[id]?.name ?? id;
}
