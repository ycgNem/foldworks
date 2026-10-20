// Items (DESIGN.md §3). `value` is what the Dock pays for one (Mayor Bramble's standing order).
// Every number carries a derivation naming its DESIGN.md section (tests/data.test.ts).

export const ITEM_IDS = [
  'ironOre', 'copperOre', 'ironIngot', 'copperIngot', 'slag', 'ironPlate', 'copperWire', 'gear', 'slagBrick', 'gizmo',
] as const;
export type ItemId = (typeof ITEM_IDS)[number];

export interface ItemDef {
  id: ItemId;
  name: string;
  /** coin the Dock pays for one */
  value: number;
  /** the Dock refuses it (slag) */
  refused?: boolean;
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
};

export function itemName(id: string): string {
  return (ITEMS as Record<string, ItemDef>)[id]?.name ?? id;
}
