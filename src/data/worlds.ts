// The islands (DESIGN.md §22, Act IV): where a Relocate flies the town. Each island's Workshop has
// one rule that changes what a good line, and so a good fold, looks like; one exotic deposit; and
// the tier 4 goods made of it. The rules are read by the systems through small helpers in
// src/sim/systems/islands.ts (as Challenges are read through `ruled`). The island the town is on
// is `s.meta.world` (absent: Home). Everything here is fixed per island: the ground is the same in
// every run there (it is laid again at each run's start, like the start layout), so kept designs
// unfold onto it as they were folded.
import type { ItemId } from './items';
import type { BuildKind } from './machines';
import type { PatchDef } from './land';
import { CHUNKS, PATCHES, START_LAYOUT } from './land';

export const WORLD_IDS = ['home', 'pebble', 'cinder', 'rime', 'oldworks'] as const;
export type WorldId = (typeof WORLD_IDS)[number];

/** A machine of the Old Works standing broken at a run's start (or a belt or heap of a whole line). */
export interface RuinDef {
  kind: BuildKind;
  x: number;
  y: number;
  rot: 0 | 1 | 2 | 3;
  recipe: string | null;
  /** a machine is ruined until repaired; the belts and heaps of a whole line stand whole */
  ruined: boolean;
}

export interface WorldDef {
  id: WorldId;
  name: string;
  /** a short line under the name */
  title: string;
  /** the rule, as a row of rich-text markup (docs/hud-180.md) */
  rule: string;
  flavor: string;
  /** its exotic deposit's item (Home has none), and the goods its research makes of it */
  exotic: ItemId | null;
  goods: ItemId[];
  /** the island's own deposits, laid after PATCHES (so every earlier patch keeps its index) */
  patches: PatchDef[];
  /** chunks that are sky, not land: nothing is built there and they are not for sale (Pebble) */
  sky?: string[];
  /** Miners dig this much faster (Pebble) */
  miners?: number;
  /** vent tiles (Cinder): a machine beside one needs no power and burns no fuel; no belt, splitter,
   * merger or crate stands beside one */
  vents?: [number, number][];
  /** Rime: a powered machine runs at `cold` of its speed unless it is warm */
  cold?: number;
  /** the Old Works: rubble on about half the land, and the ruins */
  rubble?: boolean;
  ruins?: RuinDef[];
  derivation: string;
}

const OLD_LINES: RuinDef[] = [
  // a whole line in chunk C: two Miners on the iron, a Smelter with its Slag Heap, a Press; its
  // last belt points into chunk D for the player to carry on
  { kind: 'miner', x: 3, y: 11, rot: 0, recipe: 'mineIron', ruined: true },
  { kind: 'miner', x: 3, y: 12, rot: 0, recipe: 'mineIron', ruined: true },
  { kind: 'belt', x: 4, y: 12, rot: 3, recipe: null, ruined: false },
  { kind: 'smelter', x: 4, y: 11, rot: 0, recipe: 'smeltIron', ruined: true },
  { kind: 'heap', x: 4, y: 10, rot: 3, recipe: null, ruined: false },
  { kind: 'belt', x: 5, y: 11, rot: 0, recipe: null, ruined: false },
  { kind: 'press', x: 6, y: 11, rot: 0, recipe: 'pressPlate', ruined: true },
  { kind: 'belt', x: 7, y: 11, rot: 0, recipe: null, ruined: false },
  // a whole line in chunk B: copper into wire, its belt leading east
  { kind: 'miner', x: 11, y: 3, rot: 1, recipe: 'mineCopper', ruined: true },
  { kind: 'miner', x: 12, y: 3, rot: 1, recipe: 'mineCopper', ruined: true },
  { kind: 'belt', x: 12, y: 4, rot: 2, recipe: null, ruined: false },
  { kind: 'smelter', x: 11, y: 4, rot: 1, recipe: 'smeltCopper', ruined: true },
  { kind: 'heap', x: 10, y: 4, rot: 2, recipe: null, ruined: false },
  { kind: 'belt', x: 11, y: 5, rot: 1, recipe: null, ruined: false },
  { kind: 'press', x: 11, y: 6, rot: 0, recipe: 'drawWire', ruined: true },
  { kind: 'belt', x: 12, y: 6, rot: 0, recipe: null, ruined: false },
  { kind: 'belt', x: 13, y: 6, rot: 0, recipe: null, ruined: false },
  // loose ruins, some of them big machines nobody here knows how to build yet
  { kind: 'smelterMk2', x: 1, y: 5, rot: 1, recipe: 'smeltIron', ruined: true },
  { kind: 'assemblerMk2', x: 5, y: 14, rot: 0, recipe: 'cutGear', ruined: true },
  { kind: 'pressMk2', x: 9, y: 13, rot: 0, recipe: 'pressPlate', ruined: true },
  { kind: 'assembler', x: 13, y: 9, rot: 0, recipe: 'gizmo', ruined: true },
  { kind: 'kiln', x: 22, y: 3, rot: 1, recipe: 'fireGlass', ruined: true },
  { kind: 'refinery', x: 20, y: 9, rot: 0, recipe: 'refinePlastic', ruined: true },
];

export const WORLDS: Record<WorldId, WorldDef> = {
  home: {
    id: 'home', name: 'Home', title: 'Where the town began',
    rule: 'no rule · the island you know', flavor: 'The lily pads are just as you left them.',
    exotic: null, goods: [], patches: [],
    derivation: '§22 Islands: Home, the first three acts\' island, no rule and no exotic',
  },
  pebble: {
    id: 'pebble', name: 'Pebble Isle', title: 'Half an island, twice the view',
    rule: 'chunks C, D and F are sky · Miners dig {good:1.5×}',
    flavor: 'The rest of it fell off a long time ago. Nobody misses it. Much.',
    exotic: 'skyglass', goods: ['skyglassLens', 'horizonLens'],
    patches: [{ item: 'skyglass', x: 9, y: 5, w: 2, h: 2, derivation: '§22 Pebble Isle: skyglass in chunk B, beside the copper (B is land here; C, D and F are sky)' }],
    sky: ['C', 'D', 'F'], miners: 1.5,
    derivation: '§22 Pebble Isle: half the land (A, B and E: one iron, one copper, one coal and one sand deposit), Miners 1.5x so a deposit feeds half again the machines: two Miners fill three Smelters, a ratio no other island\'s line has',
  },
  cinder: {
    id: 'cinder', name: 'Cinder Isle', title: 'Warm underfoot',
    rule: 'beside a vent: no power, no fuel · no belt beside a vent',
    flavor: 'Bring shoes. Bring two pairs.',
    exotic: 'cinderite', goods: ['cinderAlloy', 'sunsetDye', 'sunsetGenerator'],
    patches: [{ item: 'cinderite', x: 4, y: 13, w: 2, h: 2, derivation: '§22 Cinder Isle: cinderite in chunk C, between two vents' }],
    vents: [[1, 6], [5, 6], [10, 4], [14, 5], [3, 10], [6, 13], [12, 11], [19, 4], [23, 5], [17, 10], [20, 12], [22, 10]],
    derivation: '§22 Cinder Isle: twelve vents, two a chunk, none beside the start layout\'s belts; a machine beside one needs no grid and a Generator or Boiler beside one burns nothing, but no belt (or splitter, merger, crate) stands beside one, so a vent\'s machines feed each other face to face: power-free, belt-free clusters that fold compact (C) with no plant in the box',
  },
  rime: {
    id: 'rime', name: 'Rime', title: 'Cold enough to fold the air',
    rule: 'a powered machine runs at {bad:half} speed · unless a working Boiler, Engine or Generator is within 2 · or 2 working machines touch it',
    flavor: 'The frogs wear scarves. The machines want scarves.',
    exotic: 'rimeCrystal', goods: ['frostAlloy', 'stormCell', 'pocketWeather'],
    patches: [{ item: 'rimeCrystal', x: 11, y: 13, w: 2, h: 2, derivation: '§22 Rime: rime crystal in chunk D' }],
    cold: 0.5,
    derivation: '§22 Rime: a powered machine runs at half speed when cold; warm is a working Boiler, Steam Engine or Generator within 2 tiles (a Pole\'s reach, §18) or two working machines touching it, so a good Rime line packs its machines together round its own plant (the plant inside the fold box), and a line laid out for full speed elsewhere runs at half its ratios',
  },
  oldworks: {
    id: 'oldworks', name: 'the Old Works', title: 'Somebody was here first',
    rule: 'rubble on half the land · ruins repair for {good:a quarter} of their price · two ruins are whole lines',
    flavor: 'The machines are older than the town. Some of them are older than machines.',
    exotic: 'relic', goods: ['relicGear'],
    patches: [{ item: 'relic', x: 14, y: 1, w: 2, h: 2, derivation: '§22 the Old Works: a seam of relics in chunk B' }],
    rubble: true, ruins: OLD_LINES,
    derivation: '§22 the Old Works: rubble on about half of every chunk\'s free tiles, cleared tile by tile; ruins repaired for a quarter of their price without their research (an Old Works Mk2 stands in Act I), two of them whole lines (iron plates in C, copper wire in B), so the island\'s first hour folds machines the others have not reached yet',
  },
};

/** The price of clearing one tile of rubble: 5 coin and a 64th of its chunk's price (the chunk's
 * price per tile again: a chunk half under rubble costs half again to clear whole). */
export function rubblePrice(x: number, y: number): number {
  const c = CHUNKS.find((q) => x >= q.x && y >= q.y && x < q.x + q.w && y < q.y + q.h);
  return Math.round(5 + (c?.cost ?? 0) / 64);
}

export const RUBBLE = {
  share: 0.5,
  derivation: '§22 the Old Works: rubble on about half the free tiles (a fixed hash of the tile, the same every run), never on a deposit, the start layout or a ruin; a tile clears for 5 + its chunk\'s price / 64 (A 5, B and C 21, D 193, E 943, F 1,880)',
};

/** The Old Works' rubble: tile indices (y x 24 + x), fixed. Free tiles are those of no deposit, no
 * start building and no ruin; about RUBBLE.share of them. */
export const OLD_RUBBLE: number[] = (() => {
  const W = 24, H = 16;
  const taken = new Set<number>();
  const mark = (x: number, y: number, w = 1, h = 1) => { for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) taken.add(yy * W + xx); };
  for (const p of [...PATCHES, ...WORLDS.oldworks.patches]) mark(p.x, p.y, p.w, p.h);
  for (const b of START_LAYOUT) mark(b.x, b.y, b.kind === 'dock' || b.kind === 'hopper' ? 2 : 1, b.kind === 'dock' || b.kind === 'hopper' ? 2 : 1);
  for (const r of OLD_LINES) { const big = r.kind.endsWith('Mk2'); mark(r.x, r.y, big ? 2 : 1, big ? 2 : 1); }
  const out: number[] = [];
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      if (taken.has(y * W + x)) continue;
      let h = Math.imul(x + 1, 374761393) ^ Math.imul(y + 1, 668265263);
      h = Math.imul(h ^ (h >>> 13), 1274126177);
      h ^= h >>> 16;
      if ((h >>> 0) % 1000 < RUBBLE.share * 1000) out.push(y * W + x);
    }
  return out;
})();
