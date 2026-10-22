// The Patent Drawer (DESIGN.md §19): designs kept through every Reorganize, unfolded whole in a
// later run. Re-derived from Foldworks' own verb, Unfold (§10): a Workshop design folded in a run
// can be kept (8 slots, 12 with A Deeper Drawer); in any later run it unfolds in one action back
// onto the box it was folded from (the land and the ore lie the same in every run), every machine
// and belt placed at once for its bill, ready to be audited and folded again. The Draughtsman (a
// Patent) unfolds the designs the player queues, in their order, as land, research and coin allow.
// A kept design travels as a share string, FWD1.<data>.<checksum>: its box, name and layout as cell
// bytes plus a recipe byte per crafting machine, squeezed by a small LZSS coder and written in
// base64url, in plain TypeScript (no DOM CompressionStream: the sim is pure). Import checks
// everything and refuses with the reason.
import type { Game, ActResult } from './Game';
import { OK, no } from './Game';
import { TICK_RATE } from '../engine/time';
import { BUILD, isMachine, type BuildKind, type EntKind } from '../data/machines';
import { RECIPE } from '../data/recipes';
import { RULES } from '../data/rules';
import { RESEARCH } from '../data/research';
import { CHUNKS, FACTORY } from '../data/land';
import { itemName, type ItemId } from '../data/items';
import type { DesignPart, Dir, KeptDesign, ModuleDesign } from './world';
import { prules } from './patents';
import { lrules } from './legacy';
import { recipeKnown } from './transfer';
import { finb, fplace, mainItem } from './systems/modules';
import { fauditLock } from './systems/nested';
import { islandTileRefusal } from './systems/islands';
import { inBox } from './systems/audits';
import { chainSteps } from './reorganize';

// ------------------------------------------------------------------ keeping and forgetting

const cleanName = (n: string) => n.replace(/[^\x20-\x7e]/g, '').trim().slice(0, 28);

/** Why this run's design can't be kept in the drawer, or null. */
export function keepRefusal(g: Game, designId: number): string | null {
  const d = g.design(designId);
  if (!d) return 'No such module';
  if ((d.depth ?? 1) >= 3) return 'A District or World group lives on its floor: keep the lines it was folded from';
  // the Group Drawer (a Legacy node, DESIGN.md §22) keeps a nested design as its group's layout
  if ((d.depth === 2 || d.fparts) && !(lrules(g).groupDrawer && d.fparts?.length)) return 'A nested design lives on the Factory floor: keep the Workshop lines it was folded from (the Group Drawer, a Legacy node, keeps it)';
  if (!d.parts.length && !d.fparts?.length) return 'Nothing in this design to unfold';
  const m = g.s.meta;
  if (m.drawer.some((k) => k.src === d.id)) return 'Already in the Patent Drawer';
  const slots = drawerSlots(g);
  if (m.drawer.length >= slots) return `The drawer is full (${slots}): forget a design first`;
  return null;
}

/** Keep a design folded this run in the Patent Drawer (it survives every Reorganize). */
export function keepDesign(g: Game, designId: number): ActResult {
  const why = keepRefusal(g, designId);
  if (why) return no(why);
  const d = g.design(designId)!;
  const m = g.s.meta;
  const product = mainItem(d);
  if (d.fparts?.length) {
    // a nested design: its group's layout, each module tile named by its product (DESIGN.md §22)
    const k: KeptDesign = {
      id: m.nextKept++,
      name: cleanName(d.name) || `Design ${m.nextKept - 1}`,
      x: d.box.x, y: d.box.y, w: d.box.w, h: d.box.h,
      parts: [],
      nested: d.fparts.map((p) => {
        const sub = p.kind === 'module' ? g.design(p.design) : undefined;
        return { kind: p.kind, item: sub ? mainItem(sub) : null, dx: p.dx, dy: p.dy, rot: p.rot };
      }),
      product,
      grade: d.grade.letter,
      rate: product ? d.outs[product] ?? 0 : 0,
      run: m.runs + 1,
      src: d.id,
    };
    m.drawer.push(k);
    g.bump('designsKept');
    g.emit({ type: 'keep', id: k.name, value: k.id });
    return OK;
  }
  const k: KeptDesign = {
    id: m.nextKept++,
    name: cleanName(d.name) || `Design ${m.nextKept - 1}`,
    x: d.box.x, y: d.box.y, w: d.box.w, h: d.box.h,
    parts: d.parts
      .filter((p) => p.kind !== 'dock' && p.kind !== 'hopper' && p.kind !== 'furnace')
      .map((p) => ({ kind: p.kind as BuildKind, dx: p.dx, dy: p.dy, rot: p.rot, recipe: isMachine(p.kind) && p.kind !== 'miner' ? p.recipe : null })),
    product,
    grade: d.grade.letter,
    rate: product ? d.outs[product] ?? 0 : 0,
    run: m.runs + 1,
    src: d.id,
  };
  // the audit it was folded with, before the grade (the refold check, DESIGN.md §19)
  if (d.normal && d.grade.mult > 0) {
    const raw = (t: Partial<Record<ItemId, number>>) => {
      const o: Partial<Record<ItemId, number>> = {};
      for (const [it, v] of Object.entries(t) as [ItemId, number][]) o[it] = v / d.grade.mult;
      return o;
    };
    k.card = { grade: { ...d.grade }, ins: raw(d.ins), outs: raw(d.outs) };
  }
  m.drawer.push(k);
  g.bump('designsKept');
  g.emit({ type: 'keep', id: k.name, value: k.id });
  return OK;
}

export function forgetKept(g: Game, id: number): ActResult {
  const m = g.s.meta;
  if (!m.drawer.some((k) => k.id === id)) return no('No such design in the drawer');
  m.drawer = m.drawer.filter((k) => k.id !== id);
  m.queue = m.queue.filter((q) => q !== id);
  return OK;
}

export function renameKept(g: Game, id: number, name: string): ActResult {
  const k = g.s.meta.drawer.find((q) => q.id === id);
  if (!k) return no('No such design in the drawer');
  const n = cleanName(name);
  if (!n) return no('A name needs a letter or two');
  k.name = n;
  return OK;
}

/** Put a kept design in the Draughtsman's queue at `at` (the end by default), or move it there; a
 * design already queued with no `at` leaves the queue. */
export function queueKept(g: Game, id: number, at?: number): ActResult {
  const m = g.s.meta;
  if (!m.drawer.some((k) => k.id === id)) return no('No such design in the drawer');
  const was = m.queue.indexOf(id);
  if (was >= 0 && at === undefined) {
    m.queue.splice(was, 1);
    return OK;
  }
  if (was >= 0) m.queue.splice(was, 1);
  const i = at === undefined ? m.queue.length : Math.max(0, Math.min(m.queue.length, at));
  m.queue.splice(i, 0, id);
  return OK;
}

// ------------------------------------------------------------------ unfolding

/** What unfolding a kept design costs: every building in it, belts included (the design's bill and
 * its belts, as a fresh build). */
export function keptBill(k: Pick<KeptDesign, 'parts'>): number {
  return k.parts.reduce((t, p) => t + BUILD[p.kind].cost, 0);
}

/** Why a kept design can't be unfolded with its top-left at (x, y) now, or null. `waits` says what
 * kind of reason it is (the Draughtsman waits on coin, skips the rest for now). */
export function unfoldKeptRefusal(g: Game, k: KeptDesign, x = k.x, y = k.y): { why: string; waits: 'coin' | 'land' | 'research' | 'room' } | null {
  if (k.nested) return nestedRefusal(g, k, x, y);
  if (x < 0 || y < 0 || x + k.w > g.W || y + k.h > g.H) return { why: 'It does not fit on the Workshop there', waits: 'room' };
  for (let yy = y; yy < y + k.h; yy++)
    for (let xx = x; xx < x + k.w; xx++) {
      if (!g.owned(xx, yy)) {
        const ch = g.chunkAt(xx, yy);
        return { why: ch ? `Its box reaches into ${ch.name}: buy it first` : 'Its box is off your land', waits: 'land' };
      }
      if (g.s.audits.some((a) => inBox(a.box, xx, yy))) return { why: 'An audit is running there', waits: 'room' };
    }
  for (const p of k.parts) {
    const d = BUILD[p.kind];
    const px = x + p.dx, py = y + p.dy;
    for (let yy = py; yy < py + d.h; yy++)
      for (let xx = px; xx < px + d.w; xx++) {
        const e = g.entAt(xx, yy);
        if (e) return { why: `${BUILD[e.kind].name} at ${xx},${yy} is in the way of its ${d.name}: clear the ${k.w}x${k.h} box at ${x},${y}`, waits: 'room' };
        // the island's ground (DESIGN.md §22): a vent, rubble, a belt beside a vent
        const isle = islandTileRefusal(g, p.kind, xx, yy);
        if (isle) return { why: `Its ${d.name} at ${xx},${yy}: ${isle}`, waits: 'room' };
      }
    if (d.unlock && !g.done(d.unlock)) return { why: `Its ${d.name} needs research: ${RESEARCH[d.unlock].name}`, waits: 'research' };
    if (p.recipe) {
      const r = RECIPE[p.recipe];
      if (!r || !recipeKnown(g, r)) return { why: `Its ${d.name} makes ${r?.name ?? 'something'}: research it first`, waits: 'research' };
    }
    if (p.kind === 'miner' && !g.minerOre(px, py)) return { why: `Its Miner at ${px},${py} would not stand on ore`, waits: 'room' };
  }
  const bill = keptBill(k);
  if (g.s.coin.lt(bill)) return { why: `Unfolding it costs ${bill.toLocaleString('en-US')} coin`, waits: 'coin' };
  return null;
}

/** Unfold a kept design whole: every building in it placed at once, for its bill (DESIGN.md §19). */
export function unfoldKept(g: Game, id: number, x?: number, y?: number): ActResult {
  const k = g.s.meta.drawer.find((q) => q.id === id);
  if (!k) return no('No such design in the drawer');
  const at = { x: x ?? k.x, y: y ?? k.y };
  const why = unfoldKeptRefusal(g, k, at.x, at.y);
  if (why) return no(why.why);
  if (k.nested) return unfoldNested(g, k, at.x, at.y);
  g.s.coin = g.s.coin.sub(keptBill(k));
  for (const p of k.parts) {
    const e = g.addPart(p.kind as EntKind, at.x + p.dx, at.y + p.dy, p.rot);
    if (p.recipe) e.recipe = p.recipe;
  }
  (g.s.drafted ??= []).push(k.id);
  g.bump('keptUnfolds');
  g.emit({ type: 'unfold', x: at.x + k.w / 2, y: at.y + k.h / 2, value: k.id, d: k.w * k.h });
  return OK;
}

/** The Patent Drawer's slots now: the Patent tree's, and A Longer Drawer's (a Legacy node). */
export function drawerSlots(g: Game): number {
  return prules(g).drawerSlots + lrules(g).drawerAdd;
}

/** The Group Drawer's nested design, matched to this run's spare copies: each module tile gets the
 * best graded depth-1 design of its product with a copy to spare (null where none has). */
function nestedPicks(g: Game, k: KeptDesign): (ModuleDesign | null)[] {
  const used = new Map<number, number>();
  return (k.nested ?? []).map((p) => {
    if (p.kind !== 'module') return null;
    const d = g.s.designs
      .filter((q) => (q.depth ?? 1) === 1 && !q.fparts && mainItem(q) === p.item && q.spare - (used.get(q.id) ?? 0) >= 1)
      .sort((a, b) => b.grade.mult - a.grade.mult || a.id - b.id)[0] ?? null;
    if (d) used.set(d.id, (used.get(d.id) ?? 0) + 1);
    return d;
  });
}

const nestedTrunks = (k: KeptDesign) => (k.nested ?? []).filter((p) => p.kind === 'trunk').length;

function nestedRefusal(g: Game, k: KeptDesign, x: number, y: number): { why: string; waits: 'coin' | 'land' | 'research' | 'room' } | null {
  if (!g.flag('factoryOpen')) return { why: 'The Factory floor opens with your first fold', waits: 'research' };
  const picks = nestedPicks(g, k);
  for (let i = 0; i < k.nested!.length; i++) {
    const p = k.nested![i];
    const px = x + p.dx, py = y + p.dy;
    if (!finb(g, px, py)) return { why: `Its box reaches off the Factory floor at ${px},${py}: buy the annex block first`, waits: 'land' };
    if (g.fentAt(px, py)) return { why: `The Factory floor at ${px},${py} is not empty: clear the ${k.w}x${k.h} box at ${x},${y}`, waits: 'room' };
    const lock = fauditLock(g, px, py);
    if (lock) return { why: lock, waits: 'room' };
    if (p.kind === 'module' && !picks[i]) return { why: `It needs a spare module making ${p.item ? itemName(p.item).toLowerCase() : 'something'}: fold or stamp one`, waits: 'research' };
  }
  const bill = nestedTrunks(k) * FACTORY.trunkCost;
  if (g.s.coin.lt(bill)) return { why: `Its trunks cost ${bill.toLocaleString('en-US')} coin`, waits: 'coin' };
  return null;
}

/** Unfold a Group Drawer design onto the Factory floor: its trunks bought, its tiles filled from
 * spare copies of this run's designs of those products. */
function unfoldNested(g: Game, k: KeptDesign, x: number, y: number): ActResult {
  const picks = nestedPicks(g, k);
  k.nested!.forEach((p, i) => {
    if (p.kind === 'trunk') fplace(g, 'trunk', x + p.dx, y + p.dy, p.rot);
    else if (picks[i]) fplace(g, 'module', x + p.dx, y + p.dy, p.rot, picks[i]!.id);
  });
  (g.s.drafted ??= []).push(k.id);
  g.bump('keptUnfolds');
  g.emit({ type: 'unfold', x: x + k.w / 2, y: y + k.h / 2, value: k.id, d: k.w * k.h, floor: 'factory' });
  return OK;
}

/** The Draughtsman (a Patent, DESIGN.md §19): every few seconds, the first queued design not yet
 * unfolded this run that can be, in the player's order. One waiting only for coin holds the queue
 * (the coin is saved for it); one waiting on land, research or room is passed over for now. */
export function runDraughtsman(g: Game) {
  const every = prules(g).draughtsmanEvery;
  const m = g.s.meta;
  if (!every || !m.queue.length || g.s.tick % (every * TICK_RATE) !== 0) return;
  const done = new Set(g.s.drafted ?? []);
  for (const id of m.queue) {
    if (done.has(id)) continue;
    const k = m.drawer.find((q) => q.id === id);
    if (!k) continue;
    const why = unfoldKeptRefusal(g, k);
    if (!why) {
      if (unfoldKept(g, id).ok) g.bump('draughtsmanUnfolds');
      return;
    }
    if (why.waits === 'coin') return;
  }
}

/** A kept design's state in this run, in a few words (the drawer's line for it). */
export function keptState(g: Game, k: KeptDesign): string {
  if ((g.s.drafted ?? []).includes(k.id)) return 'unfolded this run';
  const why = unfoldKeptRefusal(g, k);
  return why ? why.why : `ready: ${keptBill(k).toLocaleString('en-US')} coin`;
}

/** The land a kept design needs (chunks its box touches), for the drawer's detail. */
export function keptLand(k: KeptDesign): string[] {
  const out = new Set<string>();
  for (const c of CHUNKS) if (k.x < c.x + c.w && c.x < k.x + k.w && k.y < c.y + c.h && c.y < k.y + k.h) out.add(c.id);
  return [...out];
}

export function importDesign(g: Game, code: string): ActResult {
  const m = g.s.meta;
  const slots = drawerSlots(g);
  if (m.drawer.length >= slots) return no(`The drawer is full (${slots}): forget a design first`);
  let d: Omit<KeptDesign, 'id' | 'run'>;
  try {
    d = decodeDesign(code);
  } catch (e) {
    return no((e as Error).message);
  }
  const k: KeptDesign = { ...d, id: m.nextKept++, run: m.runs + 1 };
  m.drawer.push(k);
  g.emit({ type: 'keep', id: k.name, value: k.id });
  return OK;
}

// ------------------------------------------------------------------ share strings (FWD1)

/** Building kinds by code (append only: old strings must keep decoding). */
const KINDS: BuildKind[] = ['belt', 'miner', 'smelter', 'press', 'assembler', 'heap', 'splitter', 'merger', 'crate', 'boiler', 'steamEngine', 'generator', 'pole', 'kiln', 'mixer', 'refinery', 'smelterMk2', 'pressMk2', 'assemblerMk2'];
/** Recipes by code, 1-based (0 = none; append only). */
const RECIPES_BY_CODE = ['smeltIron', 'smeltCopper', 'pressPlate', 'drawWire', 'pressBrick', 'cutGear', 'gizmo', 'smeltSteel', 'fireGlass', 'recycledGlass', 'crushGravel', 'mixConcrete', 'refinePlastic', 'etchCircuit', 'packKit', 'buildMotor', 'forgeDrillBit'];
const VERSION = 1;
const PREFIX = 'FWD1';

/** Kinds that carry a recipe byte in the string (the crafting machines; a Miner's comes from its ore). */
const HAS_RECIPE = (k: BuildKind) => isMachine(k) && k !== 'miner';
/** A cell under a 2x2 building that is not its top-left tile. */
const COVERED = 127;

/** The box (where it unfolds), the name, the layout as a w x h grid of cell bytes row by row (0
 * empty, else kind code + 1 plus 32 x the turn; 127 for the rest of a 2x2's footprint), then a
 * recipe byte for each crafting machine in the same order. Empty runs and rows of belts are what
 * LZSS squeezes best. */
export function encodeDesign(k: Pick<KeptDesign, 'name' | 'x' | 'y' | 'w' | 'h' | 'parts'>): string {
  const name = new TextEncoder().encode(cleanName(k.name));
  const grid = new Array(k.w * k.h).fill(0);
  const byCell = new Map<number, DesignPart>();
  for (const p of k.parts) {
    const d = BUILD[p.kind];
    for (let yy = p.dy; yy < p.dy + d.h; yy++) for (let xx = p.dx; xx < p.dx + d.w; xx++) grid[yy * k.w + xx] = COVERED;
    grid[p.dy * k.w + p.dx] = KINDS.indexOf(p.kind) + 1 + 32 * p.rot;
    byCell.set(p.dy * k.w + p.dx, p);
  }
  const recipes: number[] = [];
  for (let i = 0; i < grid.length; i++) {
    const p = byCell.get(i);
    if (p && HAS_RECIPE(p.kind)) recipes.push(p.recipe ? RECIPES_BY_CODE.indexOf(p.recipe) + 1 : 0);
  }
  const out = [VERSION, k.w, k.h, k.x, k.y, name.length, ...name, ...grid, ...recipes];
  const body = b64encode(lzss(new Uint8Array(out)));
  return `${PREFIX}.${body}.${checksum(body)}`;
}

/** The main product a layout makes, read off its machines: the output deepest in the recipes. */
function productOf(parts: DesignPart[]): ItemId | null {
  let best: ItemId | null = null, depth = -1;
  for (const p of parts) {
    const r = p.recipe ? RECIPE[p.recipe] : null;
    if (!r) continue;
    const it = r.outputs[0].item;
    if (chainSteps(it) > depth) { depth = chainSteps(it); best = it; }
  }
  return best;
}

/** Parse a share string; throws an Error that says, in plain words, why it was refused. */
export function decodeDesign(code: string): Omit<KeptDesign, 'id' | 'run'> {
  const parts = code.trim().split('.');
  if (parts.length !== 3 || parts[0] !== PREFIX) throw new Error('That is not a Foldworks design (it should start with FWD1.)');
  if (checksum(parts[1]) !== parts[2]) throw new Error('The design string is damaged: its checksum does not match');
  let bytes: Uint8Array;
  try {
    bytes = unlzss(b64decode(parts[1]));
  } catch {
    throw new Error('The design string is damaged: it does not unpack');
  }
  let i = 0;
  const at = () => {
    if (i >= bytes.length) throw new Error('The design string is cut short');
    return bytes[i++];
  };
  const v = at();
  if (v !== VERSION) throw new Error(`The design is from a newer game (version ${v})`);
  const w = at(), h = at(), x = at(), y = at();
  const max = RULES.drawerBox.value;
  if (w < 1 || h < 1 || w > max || h > max) throw new Error(`The design is ${w}x${h}; at most ${max}x${max} fits`);
  const nl = at();
  const nb: number[] = [];
  for (let n = 0; n < nl; n++) nb.push(at());
  const name = cleanName(new TextDecoder().decode(new Uint8Array(nb))) || 'Imported design';
  const grid: number[] = [];
  for (let n = 0; n < w * h; n++) grid.push(at());
  const covered = new Set<number>();
  const out: DesignPart[] = [];
  for (let c = 0; c < grid.length; c++) {
    const v2 = grid[c];
    if (v2 === 0 || v2 === COVERED) continue;
    const kind = KINDS[(v2 % 32) - 1];
    if (!kind) throw new Error('The design has a building this game does not know');
    const rot = Math.floor(v2 / 32) as Dir;
    if (rot > 3) throw new Error('The design has a building turned a way that does not exist');
    const dx = c % w, dy = Math.floor(c / w);
    const d = BUILD[kind];
    if (dx + d.w > w || dy + d.h > h) throw new Error(`The design's ${d.name} at ${dx},${dy} sticks out of its ${w}x${h} box`);
    for (let yy = dy; yy < dy + d.h; yy++)
      for (let xx = dx; xx < dx + d.w; xx++) {
        const t = yy * w + xx;
        if (t !== c && grid[t] !== COVERED) throw new Error(`The design's ${d.name} at ${dx},${dy} overlaps another building`);
        if (covered.has(t)) throw new Error(`Two of the design's buildings overlap at ${xx},${yy}`);
        covered.add(t);
      }
    out.push({ kind, dx, dy, rot, recipe: null });
  }
  for (let c = 0; c < grid.length; c++) if (grid[c] === COVERED && !covered.has(c)) throw new Error('The design string is damaged: a 2x2 building has lost its corner');
  if (!out.length) throw new Error('The design is empty');
  for (const p of out) {
    if (!HAS_RECIPE(p.kind)) continue;
    const rc = at();
    if (!rc) continue;
    const recipe = RECIPES_BY_CODE[rc - 1];
    if (!recipe || !RECIPE[recipe]) throw new Error('The design has a recipe this game does not know');
    const d = BUILD[p.kind];
    if (RECIPE[recipe].machine !== d.machine) throw new Error(`The design's ${d.name} at ${p.dx},${p.dy} is set to ${RECIPE[recipe].name}, which it cannot make`);
    p.recipe = recipe;
  }
  if (i !== bytes.length) throw new Error('The design string has extra data at its end');
  return { name, x, y, w, h, parts: out, product: productOf(out), grade: null, rate: 0 };
}

// ---- LZSS: a flag byte per 8 tokens; a token is a literal byte or a 2-byte back reference
// (12-bit distance, 4-bit length 3..18). Layouts are mostly repeats (rows of belts, empty runs).

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
