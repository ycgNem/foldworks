// Blueprints and ghosts (DESIGN.md §19). A blueprint is a Workshop layout saved from a box: every
// building in it with its turn and recipe. Blueprints are kept across every Reorganize (they live in
// `meta`). Placed, a blueprint becomes ghosts: outlines that do nothing until they are built, by
// hand (a click on a ghost, or "build what I can afford") or by the Builder Dragonfly (a Patent),
// one every 2 s as coin allows. A blueprint travels as a share string, FWB1.<data>.<checksum>:
// the layout as a grid of cell bytes (kind and turn) plus a recipe byte for each machine, squeezed
// by a small LZSS coder (empty runs and rows of belts repeat) and written in base64url, all in
// plain TypeScript (no DOM CompressionStream: the sim is pure).
// Import checks everything and refuses with the reason.
import type { Game, ActResult } from './Game';
import { OK, no } from './Game';
import { Num } from '../engine/num';
import { BUILD, isMachine, type BuildKind } from '../data/machines';
import { RECIPE } from '../data/recipes';
import { RULES } from '../data/rules';
import { RESEARCH } from '../data/research';
import type { Blueprint, BlueprintPart, Box, Dir, Ghost } from './world';
import { entsIn } from './systems/audits';
import { prules } from './patents';
import { recipeKnown } from './transfer';

// ------------------------------------------------------------------ saving and the library

/** Why this box can't be saved as a blueprint, or null. */
export function bpSaveRefusal(g: Game, b: Box): string | null {
  const max = RULES.blueprintMax.value;
  if (b.w < 1 || b.h < 1) return 'Drag a box over a layout';
  if (b.w > max || b.h > max) return `Too big: a blueprint is at most ${max}x${max}`;
  if (b.x < 0 || b.y < 0 || b.x + b.w > g.W || b.y + b.h > g.H) return 'The box is off the map';
  if (g.s.meta.blueprints.length >= RULES.blueprintSlots.value) return `The book is full (${RULES.blueprintSlots.value}): delete one first`;
  const parts = partsIn(g, b);
  if (!parts.length) return 'Nothing in the box to save (the Dock, Hopper and Hand Furnace stay out of blueprints)';
  const cut = entsIn(g, b).find((e) => e.x < b.x || e.y < b.y || e.x + e.w > b.x + b.w || e.y + e.h > b.y + b.h);
  if (cut) return `${BUILD[cut.kind].name} is only partly in the box`;
  return null;
}

/** The buildings in a box, relative to it (the fixed buildings are left out). */
export function partsIn(g: Game, b: Box): BlueprintPart[] {
  return entsIn(g, b)
    .filter((e) => e.kind !== 'dock' && e.kind !== 'hopper' && e.kind !== 'furnace')
    .filter((e) => e.x >= b.x && e.y >= b.y && e.x + e.w <= b.x + b.w && e.y + e.h <= b.y + b.h)
    .map((e) => ({ kind: e.kind as BuildKind, dx: e.x - b.x, dy: e.y - b.y, rot: e.rot, recipe: isMachine(e.kind) && e.kind !== 'miner' ? e.recipe : null }))
    .sort((p, q) => p.dy - q.dy || p.dx - q.dx);
}

const cleanName = (n: string) => n.replace(/[^\x20-\x7e]/g, '').trim().slice(0, 28);

export function bpSave(g: Game, b: Box, name: string): ActResult {
  const why = bpSaveRefusal(g, b);
  if (why) return no(why);
  const m = g.s.meta;
  const id = m.nextBlueprint++;
  const bp: Blueprint = { id, name: cleanName(name) || `Layout ${id}`, w: b.w, h: b.h, parts: partsIn(g, b) };
  m.blueprints.push(bp);
  g.bump('blueprints');
  g.emit({ type: 'bpSave', x: b.x + b.w / 2, y: b.y + b.h / 2, value: id });
  return OK;
}

export function bpDelete(g: Game, id: number): ActResult {
  const m = g.s.meta;
  if (!m.blueprints.some((b) => b.id === id)) return no('No such blueprint');
  m.blueprints = m.blueprints.filter((b) => b.id !== id);
  return OK;
}

export function bpRename(g: Game, id: number, name: string): ActResult {
  const b = g.s.meta.blueprints.find((q) => q.id === id);
  if (!b) return no('No such blueprint');
  const n = cleanName(name);
  if (!n) return no('A name needs a letter or two');
  b.name = n;
  return OK;
}

/** What a blueprint's buildings cost, in coin (belts included). */
export function bpCost(bp: Blueprint): number {
  return bp.parts.reduce((t, p) => t + BUILD[p.kind].cost, 0);
}

export function bpImport(g: Game, code: string): ActResult {
  if (g.s.meta.blueprints.length >= RULES.blueprintSlots.value) return no(`The book is full (${RULES.blueprintSlots.value}): delete one first`);
  let d: Omit<Blueprint, 'id'>;
  try {
    d = decodeBlueprint(code);
  } catch (e) {
    return no((e as Error).message);
  }
  const m = g.s.meta;
  const id = m.nextBlueprint++;
  m.blueprints.push({ ...d, id });
  g.emit({ type: 'bpSave', value: id });
  return OK;
}

// ------------------------------------------------------------------ ghosts

export function ghostAt(g: Game, x: number, y: number): Ghost | null {
  for (const q of g.s.ghosts) {
    const d = BUILD[q.kind];
    if (x >= q.x && y >= q.y && x < q.x + d.w && y < q.y + d.h) return q;
  }
  return null;
}

/** Remove the ghosts under a footprint (a building put there by hand takes their place). */
export function clearGhosts(g: Game, x: number, y: number, w = 1, h = 1) {
  if (!g.s.ghosts.length) return;
  g.s.ghosts = g.s.ghosts.filter((q) => {
    const d = BUILD[q.kind];
    return q.x + d.w <= x || x + w <= q.x || q.y + d.h <= y || y + h <= q.y;
  });
}

/** One part of a blueprint placed at (px, py): already built there, free for a ghost, or blocked
 * (the reason). A belt facing another way takes a ghost: building it turns the belt. */
export function partState(g: Game, p: BlueprintPart, px: number, py: number): 'built' | 'free' | string {
  const d = BUILD[p.kind];
  let state: 'built' | 'free' = 'free';
  for (let yy = py; yy < py + d.h; yy++)
    for (let xx = px; xx < px + d.w; xx++) {
      const e = g.entAt(xx, yy);
      if (!e) continue;
      if (e.kind === p.kind && e.x === px && e.y === py) {
        if (e.rot === p.rot) { state = 'built'; continue; }
        if (p.kind === 'belt') continue;
      }
      return `${BUILD[e.kind].name} at ${xx},${yy} is in the way of the blueprint's ${d.name}`;
    }
  if (p.kind === 'miner' && !g.minerOre(px, py)) return `The blueprint's Miner at ${px},${py} would not stand on ore`;
  return state;
}

/** Why a blueprint can't be placed with its top-left at (x, y), or null. Ghosts may wait on land,
 * research and coin; they may not sit on a different building, off the map, or (a Miner) off ore. */
export function bpPlaceRefusal(g: Game, bp: Blueprint, x: number, y: number): string | null {
  if (x < 0 || y < 0 || x + bp.w > g.W || y + bp.h > g.H) return 'The blueprint does not fit on the map there';
  let fresh = 0;
  for (const p of bp.parts) {
    const st = partState(g, p, x + p.dx, y + p.dy);
    if (st === 'free') fresh++;
    else if (st !== 'built') return st;
  }
  if (!fresh) return 'Everything in this blueprint is already built there';
  return null;
}

export function bpPlace(g: Game, id: number, x: number, y: number): ActResult {
  const bp = g.s.meta.blueprints.find((q) => q.id === id);
  if (!bp) return no('No such blueprint');
  const why = bpPlaceRefusal(g, bp, x, y);
  if (why) return no(why);
  let n = 0;
  for (const p of bp.parts) {
    const px = x + p.dx, py = y + p.dy;
    if (partState(g, p, px, py) !== 'free') continue;
    const d = BUILD[p.kind];
    clearGhosts(g, px, py, d.w, d.h);
    g.s.ghosts.push({ kind: p.kind, x: px, y: py, rot: p.rot, recipe: p.recipe });
    n++;
  }
  g.bump('ghosts', n);
  g.emit({ type: 'bpPlace', x: x + bp.w / 2, y: y + bp.h / 2, value: n });
  return OK;
}

/** Why this ghost can't be built now (the reason the outline shows), or null. */
export function ghostRefusal(g: Game, q: Ghost): string | null {
  return g.canPlace(q.kind, q.x, q.y);
}

/** Build one ghost now: the same rules and price as placing it by hand. */
export function buildGhost(g: Game, q: Ghost): ActResult {
  const r = g.placeNow(q.kind, q.x, q.y, q.rot);
  if (!r.ok) return r;
  // placeNow clears the ghosts under it
  const e = g.entAt(q.x, q.y);
  if (e && q.recipe && RECIPE[q.recipe] && recipeKnown(g, RECIPE[q.recipe])) e.recipe = q.recipe;
  return OK;
}

export function ghostBuild(g: Game, x: number, y: number): ActResult {
  const q = ghostAt(g, x, y);
  if (!q) return no('No ghost here');
  return buildGhost(g, q);
}

/** Build every ghost that can be built now, in the order they were placed, while coin lasts. */
export function ghostBuildAll(g: Game): ActResult {
  if (!g.s.ghosts.length) return no('No ghosts to build');
  let n = 0;
  for (const q of [...g.s.ghosts]) {
    if (ghostRefusal(g, q)) continue;
    if (buildGhost(g, q).ok) n++;
  }
  if (!n) return no(g.s.ghosts.map((q) => ghostRefusal(g, q)).find((w) => w) ?? 'Nothing can be built yet');
  return OK;
}

export function ghostClear(g: Game, x?: number, y?: number): ActResult {
  if (x === undefined || y === undefined) {
    if (!g.s.ghosts.length) return no('No ghosts');
    g.s.ghosts = [];
    return OK;
  }
  const q = ghostAt(g, x, y);
  if (!q) return no('No ghost here');
  g.s.ghosts = g.s.ghosts.filter((r) => r !== q);
  return OK;
}

/** The Builder Dragonflies (DESIGN.md §19): every 2 s each builds the first ghost that can be
 * built (cheapest first among those, so a dear one waiting for coin never holds the belts up). */
export function runDrones(g: Game) {
  const n = prules(g).drones;
  if (!n || !g.s.ghosts.length) return;
  if (g.s.tick % RULES.droneTicks.value !== 0) return;
  for (let i = 0; i < n; i++) {
    const ready = g.s.ghosts.filter((q) => !ghostRefusal(g, q));
    if (!ready.length) return;
    ready.sort((a, b) => BUILD[a.kind].cost - BUILD[b.kind].cost);
    const q = ready[0];
    if (!buildGhost(g, q).ok) return;
    g.bump('droneBuilds');
    g.emit({ type: 'drone', x: q.x, y: q.y, id: q.kind });
  }
}

/** What the ghosts left would cost. */
export function ghostsCost(g: Game): Num {
  return Num.of(g.s.ghosts.reduce((t, q) => t + BUILD[q.kind].cost, 0));
}

/** A ghost's reason in short, for its outline's tooltip. */
export function ghostWhy(g: Game, q: Ghost): string {
  const why = ghostRefusal(g, q);
  if (!why) return `${BUILD[q.kind].name}: ready to build (${BUILD[q.kind].cost} coin)`;
  const u = BUILD[q.kind].unlock;
  if (u && !g.done(u)) return `${BUILD[q.kind].name}: waits for ${RESEARCH[u].name}`;
  return `${BUILD[q.kind].name}: ${why}`;
}

// ------------------------------------------------------------------ share strings (FWB1)

/** Building kinds by code (append only: old strings must keep decoding). */
const BP_KINDS: BuildKind[] = ['belt', 'miner', 'smelter', 'press', 'assembler', 'heap', 'splitter', 'merger', 'crate', 'boiler', 'steamEngine', 'generator', 'pole', 'kiln', 'mixer', 'refinery', 'smelterMk2', 'pressMk2', 'assemblerMk2'];
/** Recipes by code, 1-based (0 = none; append only). */
const BP_RECIPES = ['smeltIron', 'smeltCopper', 'pressPlate', 'drawWire', 'pressBrick', 'cutGear', 'gizmo', 'smeltSteel', 'fireGlass', 'recycledGlass', 'crushGravel', 'mixConcrete', 'refinePlastic', 'etchCircuit', 'packKit', 'buildMotor', 'forgeDrillBit'];
const BP_VERSION = 1;
const PREFIX = 'FWB1';

/** Kinds that carry a recipe byte in the string (the crafting machines; a Miner's comes from its ore). */
const HAS_RECIPE = (k: BuildKind) => isMachine(k) && k !== 'miner';
/** A cell under a 2x2 building that is not its top-left tile. */
const COVERED = 127;

/** The layout as a w x h grid of cell bytes, row by row: 0 empty, else kind code + 1 plus 32 x the
 * turn (127 for the rest of a 2x2's footprint); then one recipe byte for each crafting machine, in
 * the same order. Empty runs and rows of belts are what LZSS squeezes best. */
export function encodeBlueprint(bp: Pick<Blueprint, 'name' | 'w' | 'h' | 'parts'>): string {
  const name = new TextEncoder().encode(cleanName(bp.name));
  const grid = new Array(bp.w * bp.h).fill(0);
  const byCell = new Map<number, BlueprintPart>();
  for (const p of bp.parts) {
    const d = BUILD[p.kind];
    for (let yy = p.dy; yy < p.dy + d.h; yy++) for (let xx = p.dx; xx < p.dx + d.w; xx++) grid[yy * bp.w + xx] = COVERED;
    grid[p.dy * bp.w + p.dx] = BP_KINDS.indexOf(p.kind) + 1 + 32 * p.rot;
    byCell.set(p.dy * bp.w + p.dx, p);
  }
  const recipes: number[] = [];
  for (let i = 0; i < grid.length; i++) {
    const p = byCell.get(i);
    if (p && HAS_RECIPE(p.kind)) recipes.push(p.recipe ? BP_RECIPES.indexOf(p.recipe) + 1 : 0);
  }
  const out = [BP_VERSION, bp.w, bp.h, name.length, ...name, ...grid, ...recipes];
  const body = b64encode(lzss(new Uint8Array(out)));
  return `${PREFIX}.${body}.${checksum(body)}`;
}

/** Parse a share string; throws an Error that says, in plain words, why it was refused. */
export function decodeBlueprint(code: string): Omit<Blueprint, 'id'> {
  const parts = code.trim().split('.');
  if (parts.length !== 3 || parts[0] !== PREFIX) throw new Error('That is not a Foldworks blueprint (it should start with FWB1.)');
  if (checksum(parts[1]) !== parts[2]) throw new Error('The blueprint string is damaged: its checksum does not match');
  let bytes: Uint8Array;
  try {
    bytes = unlzss(b64decode(parts[1]));
  } catch {
    throw new Error('The blueprint string is damaged: it does not unpack');
  }
  let i = 0;
  const at = () => {
    if (i >= bytes.length) throw new Error('The blueprint string is cut short');
    return bytes[i++];
  };
  const v = at();
  if (v !== BP_VERSION) throw new Error(`The blueprint is from a newer game (version ${v})`);
  const w = at(), h = at();
  const max = RULES.blueprintMax.value;
  if (w < 1 || h < 1 || w > max || h > max) throw new Error(`The blueprint is ${w}x${h}; at most ${max}x${max} fits`);
  const nl = at();
  const nb: number[] = [];
  for (let k = 0; k < nl; k++) nb.push(at());
  const name = cleanName(new TextDecoder().decode(new Uint8Array(nb))) || 'Imported layout';
  const grid: number[] = [];
  for (let k = 0; k < w * h; k++) grid.push(at());
  const covered = new Set<number>();
  const out: BlueprintPart[] = [];
  for (let c = 0; c < grid.length; c++) {
    const v2 = grid[c];
    if (v2 === 0 || v2 === COVERED) continue;
    const kind = BP_KINDS[(v2 % 32) - 1];
    if (!kind) throw new Error('The blueprint has a building this game does not know');
    const rot = Math.floor(v2 / 32) as Dir;
    if (rot > 3) throw new Error('The blueprint has a building turned a way that does not exist');
    const dx = c % w, dy = Math.floor(c / w);
    const d = BUILD[kind];
    if (dx + d.w > w || dy + d.h > h) throw new Error(`The blueprint's ${d.name} at ${dx},${dy} sticks out of its ${w}x${h} box`);
    for (let yy = dy; yy < dy + d.h; yy++)
      for (let xx = dx; xx < dx + d.w; xx++) {
        const t = yy * w + xx;
        if (t !== c && grid[t] !== COVERED) throw new Error(`The blueprint's ${d.name} at ${dx},${dy} overlaps another building`);
        if (covered.has(t)) throw new Error(`Two of the blueprint's buildings overlap at ${xx},${yy}`);
        covered.add(t);
      }
    out.push({ kind, dx, dy, rot, recipe: null });
  }
  for (let c = 0; c < grid.length; c++) if (grid[c] === COVERED && !covered.has(c)) throw new Error('The blueprint string is damaged: a 2x2 building has lost its corner');
  if (!out.length) throw new Error('The blueprint is empty');
  for (const p of out) {
    if (!HAS_RECIPE(p.kind)) continue;
    const rc = at();
    if (!rc) continue;
    const recipe = BP_RECIPES[rc - 1];
    if (!recipe || !RECIPE[recipe]) throw new Error('The blueprint has a recipe this game does not know');
    const d = BUILD[p.kind];
    if (RECIPE[recipe].machine !== d.machine) throw new Error(`The blueprint's ${d.name} at ${p.dx},${p.dy} is set to ${RECIPE[recipe].name}, which it cannot make`);
    p.recipe = recipe;
  }
  if (i !== bytes.length) throw new Error('The blueprint string has extra data at its end');
  return { name, w, h, parts: out };
}

// ---- LZSS: a flag byte per 8 tokens; a token is a literal byte or a 2-byte back reference
// (12-bit distance, 4-bit length 3..18). Blueprints are mostly repeats (rows of belts, empty runs).

function lzss(src: Uint8Array): Uint8Array {
  const out: number[] = [];
  let i = 0;
  while (i < src.length) {
    const flagAt = out.length;
    out.push(0);
    let flags = 0;
    for (let bit = 0; bit < 8 && i < src.length; bit++) {
      let bestLen = 0, bestDist = 0;
      const start = Math.max(0, i - 4095);
      for (let j = start; j < i; j++) {
        let l = 0;
        while (l < 18 && i + l < src.length && src[j + l] === src[i + l]) l++;
        if (l > bestLen) { bestLen = l; bestDist = i - j; }
      }
      if (bestLen >= 3) {
        flags |= 1 << bit;
        out.push(bestDist >> 4, ((bestDist & 15) << 4) | (bestLen - 3));
        i += bestLen;
      } else out.push(src[i++]);
    }
    out[flagAt] = flags;
  }
  return new Uint8Array(out);
}

function unlzss(src: Uint8Array): Uint8Array {
  const out: number[] = [];
  let i = 0;
  while (i < src.length) {
    const flags = src[i++];
    for (let bit = 0; bit < 8 && i < src.length; bit++) {
      if (flags & (1 << bit)) {
        if (i + 1 >= src.length) throw new Error('cut');
        const dist = (src[i] << 4) | (src[i + 1] >> 4);
        const len = (src[i + 1] & 15) + 3;
        i += 2;
        if (dist < 1 || dist > out.length) throw new Error('bad reference');
        for (let k = 0; k < len; k++) out.push(out[out.length - dist]);
        if (out.length > 65536) throw new Error('too big');
      } else out.push(src[i++]);
    }
  }
  return new Uint8Array(out);
}

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

function b64encode(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const n = (bytes[i] << 16) | ((bytes[i + 1] ?? 0) << 8) | (bytes[i + 2] ?? 0);
    const k = Math.min(3, bytes.length - i);
    out += B64[(n >> 18) & 63] + B64[(n >> 12) & 63] + (k > 1 ? B64[(n >> 6) & 63] : '') + (k > 2 ? B64[n & 63] : '');
  }
  return out;
}

function b64decode(s: string): Uint8Array {
  const out: number[] = [];
  let buf = 0, bits = 0;
  for (const ch of s) {
    const v = B64.indexOf(ch);
    if (v < 0) throw new Error('not base64url');
    buf = ((buf << 6) | v) & 0xffffff;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out.push((buf >> bits) & 255);
    }
  }
  return new Uint8Array(out);
}

/** FNV-1a over the encoded body, 8 hex digits (as the FW1 save strings). */
function checksum(s: string): string {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}
