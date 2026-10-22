// The islands' rules (DESIGN.md §22), read by the systems through these helpers, as Challenges are
// read through `ruled` (src/sim/systems/challenges.ts):
//  - Pebble Isle: chunks C, D and F are sky (not owned, not for sale; Sky Moorings moors F); Miners
//    dig 1.5x (`islandMiners`, read by the Miners).
//  - Cinder Isle: vent tiles. A machine with a vent beside it needs no power and a Generator or
//    Boiler beside one burns no fuel (`g.vented`, read by power.ts); no belt, splitter, merger or
//    crate is laid beside one (Heat Shields lets the last three stand there).
//  - Rime: a powered machine runs at half speed (`coldFactor`, read by machines.ts) unless a lit
//    Heater is within 2 tiles or two working machines touch it (Warm Hands: one).
//  - the Old Works: rubble on about half the free land, cleared tile by tile (`clear`), and ruined
//    machines, repaired for a quarter of their price (`repair`); two ruins are whole lines.
// `runIslands` is part of the machines stage (before the machines run): the Heaters burn and Rime's
// warmth is worked out from the last tick's states. The ground (rubble, ruins) is laid at a run's
// start by `setupIsland`. Pure: no DOM, timers or clocks.
import type { Game, ActResult } from '../Game';
import { OK, no } from '../Game';
import { TICK_RATE } from '../../engine/time';
import { Num } from '../../engine/num';
import { BUILD, isMachine, type BuildKind, type EntKind } from '../../data/machines';
import { CHUNKS, PATCHES, type PatchDef } from '../../data/land';
import { RULES } from '../../data/rules';
import { OLD_RUBBLE, WORLDS, rubblePrice, type WorldDef, type WorldId } from '../../data/worlds';
import type { Ent } from '../world';
import { lrules } from '../legacy';
import { buildPrice } from './challenges';
import { trules } from '../longtail';
import { note } from './stats';

/** The island the town is on. */
export const worldOf = (g: Game): WorldId => g.s.meta.world ?? 'home';
export const islandDef = (g: Game): WorldDef => WORLDS[worldOf(g)];
/** Every island's exotic and its goods (Field Notes pays the Codex for them on each island). */
export const ISLAND_GOODS: ReadonlySet<string> = new Set(
  Object.values(WORLDS).flatMap((w) => [...(w.exotic ? [w.exotic] : []), ...w.goods]),
);
/** Is the town on this island now? */
export const onIsle = (g: Game, id: WorldId) => worldOf(g) === id;
/** Is this island's rule softened by its Legacy node? */
export const softened = (g: Game, id: WorldId) => lrules(g).soften.has(id);

/** Is this chunk sky on this island (Pebble's C, D and F; Sky Moorings moors F)? */
export function isSky(g: Game, chunk: string): boolean {
  const d = islandDef(g);
  if (!d.sky?.includes(chunk)) return false;
  return !(chunk === 'F' && d.id === 'pebble' && softened(g, 'pebble'));
}

/** The deposits on this island: the Workshop's, then its own (laid after, so indices hold). */
export function islandPatches(g: Game): PatchDef[] {
  const own = islandDef(g).patches;
  return own.length ? [...PATCHES, ...own] : PATCHES;
}

/** The Miners' speed on this island (Pebble: 1.5x). */
export const islandMiners = (g: Game) => islandDef(g).miners ?? 1;

const chunkOf = (x: number, y: number) => CHUNKS.find((c) => x >= c.x && y >= c.y && x < c.x + c.w && y < c.y + c.h) ?? null;

export const ventAt = (g: Game, x: number, y: number) => g.inb(x, y) && g.vents[y * g.W + x] === 1;
export const rubbleAt = (g: Game, x: number, y: number) => g.inb(x, y) && g.rubbleMask[y * g.W + x] === 1;

/** A vent on one of the four sides of this tile? */
function ventNear(g: Game, x: number, y: number): boolean {
  return ventAt(g, x + 1, y) || ventAt(g, x - 1, y) || ventAt(g, x, y + 1) || ventAt(g, x, y - 1);
}

/** Does a vent touch this footprint (one of the tiles just outside its four faces)? */
export function besideVent(g: Game, e: { x: number; y: number; w: number; h: number }): boolean {
  for (let x = e.x; x < e.x + e.w; x++) if (ventAt(g, x, e.y - 1) || ventAt(g, x, e.y + e.h)) return true;
  for (let y = e.y; y < e.y + e.h; y++) if (ventAt(g, e.x - 1, y) || ventAt(g, e.x + e.w, y)) return true;
  return false;
}

/** Build kinds that carry items tile to tile, which melt beside a vent. */
const MELTS = new Set<string>(['belt', 'splitter', 'merger', 'crate']);

/** Why this island refuses a building on this tile, or null (Game.canPlace asks for each tile). */
export function islandTileRefusal(g: Game, kind: BuildKind | EntKind, x: number, y: number): string | null {
  if (ventAt(g, x, y)) return 'A vent: nothing stands on it';
  if (rubbleAt(g, x, y)) return `Rubble: clear it first (${Num.of(rubblePrice(x, y)).format()} coin)`;
  if (MELTS.has(kind) && ventNear(g, x, y)) {
    if (kind !== 'belt' && softened(g, 'cinder')) return null;
    return kind === 'belt' ? 'A belt melts beside a vent: feed the machines there face to face' : `A ${BUILD[kind].name} melts beside a vent (Heat Shields, a Legacy node, shields it)`;
  }
  return null;
}

/** The caches the rules read, rebuilt with the layout (Game.rebuild calls it). */
export function islandCaches(g: Game) {
  const d = islandDef(g);
  g.vents.fill(0);
  for (const [x, y] of d.vents ?? []) if (g.inb(x, y)) g.vents[y * g.W + x] = 1;
  g.rubbleMask.fill(0);
  for (const i of g.s.rubble ?? []) if (i >= 0 && i < g.rubbleMask.length) g.rubbleMask[i] = 1;
  g.vented.clear();
  if (d.vents?.length) for (const e of g.s.ents) if (!e.ruined && besideVent(g, e)) g.vented.add(e.id);
}

/** Lay the island's ground at a run's start: the Old Works' rubble and ruins. */
export function setupIsland(g: Game) {
  const d = islandDef(g);
  if (d.rubble) g.s.rubble = [...OLD_RUBBLE];
  else delete g.s.rubble;
  for (const r of d.ruins ?? []) {
    if (g.entAt(r.x, r.y)) continue;
    const e = g.addPart(r.kind, r.x, r.y, r.rot);
    e.recipe = r.recipe;
    if (r.ruined) e.ruined = true;
  }
  g.layoutDirty = true;
}

// ------------------------------------------------------------------ the Old Works

/** What repairing this ruin costs now: a quarter of its price, or nothing with Salvage Crews. */
export function repairPrice(g: Game, e: Ent): number {
  if (softened(g, 'oldworks')) return 0;
  // the Trophy Shelf's repair trophies take a share off (DESIGN.md §24)
  return Math.ceil(buildPrice(g, e.kind as BuildKind) * RULES.ruinRepair.value * (1 - trules(g).repair));
}

export function repair(g: Game, x: number, y: number): ActResult {
  const e = g.entAt(x, y);
  if (!e || !e.ruined) return no('Nothing ruined here');
  const p = repairPrice(g, e);
  if (g.s.coin.lt(p)) return no(`Repairing the ${BUILD[e.kind].name} costs ${Num.of(p).format()} coin`);
  g.s.coin = g.s.coin.sub(p);
  delete e.ruined;
  // Salvage Crews (a Legacy node): the rubble on the eight tiles around it is cleared with it
  if (softened(g, 'oldworks') && g.s.rubble) {
    const near = new Set<number>();
    for (let yy = e.y - 1; yy <= e.y + e.h; yy++) for (let xx = e.x - 1; xx <= e.x + e.w; xx++) if (g.inb(xx, yy)) near.add(yy * g.W + xx);
    g.s.rubble = g.s.rubble.filter((i) => !near.has(i));
  }
  g.layoutDirty = true;
  g.bump('repairs');
  g.emit({ type: 'repair', x: e.x, y: e.y, id: e.kind, value: p });
  return OK;
}

/** Clear a tile of rubble for its price (the land must be yours); the Committee's Rubble Rousers
 * (rep 7) clear the rubble touching it with it. */
export function clearRubble(g: Game, x: number, y: number): ActResult {
  if (!rubbleAt(g, x, y)) return no('No rubble here');
  if (!g.owned(x, y)) return no('Buy this chunk first');
  const p = rubblePrice(x, y);
  if (g.s.coin.lt(p)) return no(`Clearing this rubble costs ${Num.of(p).format()} coin`);
  g.s.coin = g.s.coin.sub(p);
  const gone = new Set<number>([y * g.W + x]);
  if ((g.s.orders.rep.committee ?? 0) >= 7)
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) if (g.inb(x + dx, y + dy) && g.owned(x + dx, y + dy)) gone.add((y + dy) * g.W + x + dx);
  g.s.rubble = (g.s.rubble ?? []).filter((i) => !gone.has(i));
  g.layoutDirty = true;
  g.bump('rubbleCleared', gone.size);
  g.emit({ type: 'clear', x, y, value: p, d: gone.size });
  return OK;
}

// ------------------------------------------------------------------ Rime, and the Heaters

/** A powered machine's speed factor from the cold (Rime: half when cold, else 1). */
export const coldFactor = (m: Ent) => (m.cold ? RULES.rimeCold.value : 1);

const powered = (e: Ent) => isMachine(e.kind) && (BUILD[e.kind].kw ?? 0) > 0;

/** Max-norm distance from a tile to a footprint (as a Pole's reach is measured, §18). */
const cheb = (a: { x: number; y: number; w: number; h: number }, x: number, y: number) => {
  const dx = x < a.x ? a.x - x : x >= a.x + a.w ? x - (a.x + a.w - 1) : 0;
  const dy = y < a.y ? a.y - y : y >= a.y + a.h ? y - (a.y + a.h - 1) : 0;
  return Math.max(dx, dy);
};

/** A Heater has heat to give: a coal burning or one in its box. */
export const heaterLit = (h: Ent) => h.prog > 0 || (h.inBuf.coal ?? 0) > 0;

/** Is something that makes heat working: a machine or a power producer, not ruined or stopped. */
const warmBody = (e: Ent) => !e.ruined && !e.paused && e.state === 'work' && (isMachine(e.kind) || e.kind === 'steamEngine' || e.kind === 'generator');

/** Working machines touching this footprint (the tiles just outside its faces). */
export function workingNeighbours(g: Game, m: Ent): number {
  const seen = new Set<number>();
  const look = (x: number, y: number) => {
    const n = g.entAt(x, y);
    if (n && n !== m && !seen.has(n.id) && warmBody(n)) seen.add(n.id);
  };
  for (let x = m.x; x < m.x + m.w; x++) { look(x, m.y - 1); look(x, m.y + m.h); }
  for (let y = m.y; y < m.y + m.h; y++) { look(m.x - 1, y); look(m.x + m.w, y); }
  return seen.size;
}

/** Is this powered machine warm on Rime: a lit Heater within reach, or enough working neighbours? */
export function isWarm(g: Game, m: Ent): boolean {
  const reach = RULES.heaterReach.value;
  for (const h of g.heaters) if (heaterLit(h) && cheb(m, h.x, h.y) <= reach) return true;
  const need = softened(g, 'rime') ? 1 : RULES.rimeTouch.value;
  return workingNeighbours(g, m) >= need;
}

/** The machines stage, before the machines run: Rime's warmth from the last tick's states, and the
 * Heaters burning (one coal every 10 s while a powered machine in reach is crafting). */
export function runIslands(g: Game) {
  const rime = !!islandDef(g).cold;
  if (rime) {
    const cold: Ent[] = [];
    for (const m of g.machines) {
      if (!powered(m) || m.ruined) { if (m.cold) delete m.cold; continue; }
      if (isWarm(g, m)) { if (m.cold) delete m.cold; } else cold.push(m);
    }
    for (const m of cold) m.cold = true;
  }
  if (!g.heaters.length) return;
  const reach = RULES.heaterReach.value;
  for (const h of g.heaters) {
    const wants = rime && g.machines.some((m) => powered(m) && m.active && !m.paused && cheb(m, h.x, h.y) <= reach);
    if (wants && h.prog <= 0 && (h.inBuf.coal ?? 0) > 0) {
      h.inBuf.coal--;
      h.prog += (BUILD.heater.fuel?.seconds ?? 10) * TICK_RATE;
      h.crafts++;
    }
    if (wants && h.prog > 0) {
      h.prog = Math.max(0, h.prog - 1);
      h.wkAcc = (h.wkAcc ?? 0) + 1;
      h.state = 'work';
      h.why = null;
    } else if (!heaterLit(h)) {
      h.state = 'starved';
      h.why = 'coal';
    } else {
      h.state = 'idle';
      h.why = null;
    }
    note(h);
  }
}
