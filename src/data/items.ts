// Items (DESIGN.md §3). `value` is what the Dock pays for one (Mayor Bramble's standing order).
// Every number carries a derivation naming its DESIGN.md section (tests/data.test.ts).

export const ITEM_IDS = [
  'ironOre', 'copperOre', 'ironIngot', 'copperIngot', 'slag', 'ironPlate', 'copperWire', 'gear', 'slagBrick', 'gizmo',
  // Act II (DESIGN.md §18), in the order of src/art/items2.png
  'coal', 'sand', 'steel', 'glass', 'gravel', 'concrete', 'plastic', 'circuit', 'machineKit', 'motor', 'oil', 'drillBit',
] as const;
export type ItemId = (typeof ITEM_IDS)[number];

export interface ItemDef {
  id: ItemId;
  name: string;
  /** coin the Dock pays for one */
  value: number;
  /** the Dock refuses it (slag, kits, drill bits) */
  refused?: boolean;
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
  ironIngot: { id: 'ironIngot', name: 'Iron ingot', value: 3, color: 'ice', flavor: 'A bar of iron. Still warm.', derivation: '§3 3x ore: smelting is the first, big reward' },
  copperIngot: { id: 'copperIngot', name: 'Copper ingot', value: 3, color: 'tan', flavor: 'Shiny enough to see your bad decisions in.', derivation: '§3 same as iron' },
  slag: { id: 'slag', name: 'Slag', value: 0, refused: true, color: 'violet', flavor: 'What is left when the iron leaves. Nobody wants it. Yet.', derivation: '§3 1 per 4 ingots; §4 Byproducts: the Dock refuses it' },
  ironPlate: { id: 'ironPlate', name: 'Iron plate', value: 5, color: 'sky', flavor: 'Flat. Very flat. Bramble is building a boardwalk.', derivation: '§3 +2 per press step' },
  copperWire: { id: 'copperWire', name: 'Copper wire', value: 2, color: 'amber', flavor: 'Two from every ingot. Coils itself when nobody looks.', derivation: '§3 4 per ingot: +1 over the ingot' },
  gear: { id: 'gear', name: 'Gear', value: 14, color: 'mist', flavor: 'Teeth on the outside, purpose on the inside.', derivation: '§3 10 in -> 14 (+40%)' },
  slagBrick: { id: 'slagBrick', name: 'Slag brick', value: 6, color: 'plum', flavor: 'Waste, pressed into usefulness. The swamp town loves a brick.', derivation: '§3 research 9: waste becomes value' },
  gizmo: { id: 'gizmo', name: 'Gizmo', value: 80, color: 'gold', flavor: "Does something. Bramble isn't sure what. Bramble loves it.", derivation: '§3 20 in -> 80 (x4): the first product' },
  coal: { id: 'coal', name: 'Coal', value: 2, color: 'ink', flavor: 'Old swamp, squashed flat for a very long time. Burns with opinions.', derivation: '§18 Items: raw, 2 (it burns: worth a little more than ore)' },
  sand: { id: 'sand', name: 'Sand', value: 1, color: 'clay', flavor: 'Gets everywhere. Especially into glass.', derivation: '§18 Items: raw, 1' },
  steel: { id: 'steel', name: 'Steel', value: 15, color: 'mist', flavor: 'Iron that went to finishing school.', derivation: '§18 Items: ingot 3 + coal 2 -> 15 (x3)' },
  glass: { id: 'glass', name: 'Glass', value: 8, color: 'ice', flavor: 'Sand that has seen the light.', derivation: '§18 Items: 2 sand -> 8 (x4)' },
  gravel: { id: 'gravel', name: 'Gravel', value: 2, color: 'fog', flavor: 'Slag, crushed into something a road would want.', derivation: '§18 Items: 2 slag (0) -> 2: waste becomes an input' },
  concrete: { id: 'concrete', name: 'Concrete', value: 22, color: 'hull2', flavor: 'Gravel, sand and patience. Mostly patience.', derivation: '§18 Items: 2 gravel + sand (5) -> 22' },
  plastic: { id: 'plastic', name: 'Plastic', value: 16, color: 'violet', flavor: 'Coal tar, cooked until it forgets it was coal.', derivation: '§18 Items: 2 coal (4) -> 16 plus oil' },
  circuit: { id: 'circuit', name: 'Circuit', value: 110, color: 'leaf', flavor: 'Wire that learned to think. Mostly about wire.', derivation: '§18 Items: 3 wire + plastic + glass (30) -> 110 (x3.7)' },
  machineKit: { id: 'machineKit', name: 'Machine Kit', value: 0, refused: true, parts: true, color: 'brass1', flavor: 'Everything a machine needs, in a crate, with instructions in frog.', derivation: '§18 Machine Kits: parts for stamps, not for sale' },
  motor: { id: 'motor', name: 'Motor', value: 420, color: 'copper', flavor: 'Spins. Endlessly. Bramble watched one for an hour.', derivation: '§18 Items: 2 steel + gear + circuit (154) -> 420 (x2.7)' },
  oil: { id: 'oil', name: 'Oil', value: 3, color: 'shadow', flavor: 'What the refinery does not want. The boiler does.', derivation: '§18 Items: the refinery\'s byproduct, 3; boiler fuel' },
  drillBit: { id: 'drillBit', name: 'Drill Bit', value: 0, refused: true, color: 'gold', flavor: 'For a drill the size of a town. Do not ask Bramble where the town goes.', derivation: '§18 Megaproject: the Great Drill\'s part, not for sale' },
};

export function itemName(id: string): string {
  return (ITEMS as Record<string, ItemDef>)[id]?.name ?? id;
}
