// Relocate, reset layer 2 (DESIGN.md §22). The town flies to another island: everything a
// Reorganize loses is lost, and the Patents (unspent and the tree), the record on file and the run's
// room go too; Legacy is banked for what this world built:
//
//   Legacy = floor( SUM over the four floors of the best value this world / 4
//                   + 3 x Megaproject stages counted
//                   + 5 for an island not visited before )
//
//   a floor's best value = its best design's steps folded x grade x rate tier (as filing, §19):
//   the Workshop's best depth-1 fold, the Factory's best nested fold, the District's best fold of
//   groups; the World's is the summed value of its distinct designs (product and depth) put to work
//   there (run 60 s at half speed or better) / 4, so it is not the District's best counted again
//
//   stages counted = the stages done this world, plus, at the first Relocate of a universe from an
//   island, the stages that stood on it when the universe began (`meta.inherited`): every stage
//   counts once a universe, so universe 2's first Relocate is worth universe 1's (the review)
//
// Not a root or a log of a currency: it counts the best of what was folded on each floor, the
// Megaprojects built and the islands seen, never coin. A world's bests are kept through its
// Reorganizes (`meta.here`), so Legacy is the whole world's, not the last run's; each island's best
// per floor ever is its record (`meta.worldRecords`). Pillar 4: always the player's choice, from a
// card that says what it gives, keeps and loses (`previewLegacy`, `RELOCATE_KEPT`, `RELOCATE_LOST`).
import type { Game, ActResult } from './Game';
import { OK, no } from './Game';
import { Num } from '../engine/num';
import { RULES } from '../data/rules';
import { WORLDS, WORLD_IDS, type WorldId } from '../data/worlds';
import { MEGAS, MEGA_IDS } from '../data/megaprojects';
import { itemName } from '../data/items';
import { newWorldRun, type FloorBest, type LegacyFloor, type MegaState, type ModuleDesign } from './world';
import { designValue, endRun, startRun } from './reorganize';
import { lrules } from './legacy';
import { krules } from './kernels';
import { worldOf } from './systems/islands';
import { megaDone, megaStageOf, projectOpen } from './systems/high';

export const LEGACY_FLOORS: LegacyFloor[] = ['workshop', 'factory', 'district', 'world'];

/** What a Relocate keeps, in words (the card lists it). */
export const RELOCATE_KEPT: { what: string; why: string }[] = [
  { what: 'Legacy and the Legacy tree', why: 'what the move is for' },
  { what: 'Every Megaproject', why: 'their progress survives every reset; an island\'s stage waits for you there' },
  { what: 'Reputation', why: 'every customer follows the town' },
  { what: 'The Codex and the Patent Drawer', why: 'firsts stay paid; kept designs travel (they may not suit the new rule)' },
  { what: 'Trophies, lifetime statistics, Challenges won', why: 'the shelf and the counters' },
  { what: 'The worlds\' records', why: 'each island\'s best fold on each floor' },
];

/** What it loses. */
export const RELOCATE_LOST: string[] = [
  'Everything a Reorganize loses: every floor, coin, items, land, research, designs',
  'Patents, unspent and the Patent tree (Old Habits keeps the nodes you choose)',
  'The Patent Office\'s record on file (every product files again on the new island)',
  'Room the Sky Anchor kept through Reorganizes (until its last stage)',
];

// ------------------------------------------------------------------ this world's best folds

/** The floor a design's best value counts for: where it was folded (depth 1 the Workshop, 2 the
 * Factory, 3 the District, 4 the World). */
export function designFloor(d: ModuleDesign): LegacyFloor {
  const depth = d.depth ?? 1;
  return depth >= 4 ? 'world' : depth === 3 ? 'district' : depth === 2 ? 'factory' : 'workshop';
}

const asBest = (v: NonNullable<ReturnType<typeof designValue>>): FloorBest => ({ value: v.value, item: v.item, grade: v.grade, steps: v.steps, tier: v.tier });

/** The World's designs this run as its Legacy term counts them: each distinct design (product and
 * depth) put to work there, and each fold made on the World, at its best value (DESIGN.md §22). */
export function worldDesigns(g: Game): Map<string, NonNullable<ReturnType<typeof designValue>>> {
  const best = new Map<string, NonNullable<ReturnType<typeof designValue>>>();
  const add = (d: ModuleDesign | undefined) => {
    const v = d ? designValue(d) : null;
    if (!v) return;
    const key = `${v.item}|${d!.depth ?? 1}`;
    const was = best.get(key);
    if (!was || v.value > was.value) best.set(key, v);
  };
  for (const e of g.s.world?.ents ?? []) {
    if (e.kind !== 'module' || (e.ok ?? 0) < RULES.legacyRunSeconds.value) continue;
    add(g.design(e.design));
  }
  for (const d of g.s.designs) if (designFloor(d) === 'world') add(d);
  return best;
}

/** Each floor's best this run: the designs folded; the World's distinct designs at work, summed. */
export function bestsThisRun(g: Game): Partial<Record<LegacyFloor, FloorBest>> {
  const out: Partial<Record<LegacyFloor, FloorBest>> = {};
  const up = (f: LegacyFloor, b: FloorBest) => { if (!out[f] || b.value > out[f]!.value) out[f] = b; };
  for (const d of g.s.designs) {
    if (designFloor(d) === 'world') continue;
    const v = designValue(d);
    if (v) up(designFloor(d), asBest(v));
  }
  const ws = [...worldDesigns(g).values()];
  if (ws.length) {
    const top = ws.reduce((a, b) => (b.value > a.value ? b : a));
    const sum = ws.reduce((t, v) => t + v.value, 0);
    out.world = { ...asBest(top), value: sum / RULES.legacyWorldDesigns.value, designs: ws.length, sum };
  }
  return out;
}

/** Each floor's best this world: what earlier runs here kept, and this run's (pure). */
export function floorBests(g: Game): Record<LegacyFloor, FloorBest | null> {
  const kept = g.s.meta.here?.best ?? {};
  const now = bestsThisRun(g);
  // Kept Islands (a Kernel node, DESIGN.md §23): the island's record stands as this world's best
  const rec = krules(g).keptIslands ? g.s.meta.worldRecords?.[worldOf(g)] ?? {} : {};
  const out = {} as Record<LegacyFloor, FloorBest | null>;
  const better = (a: FloorBest | null | undefined, b: FloorBest | null | undefined) => (a && b ? (b.value > a.value ? b : a) : a ?? b ?? null);
  for (const f of LEGACY_FLOORS) out[f] = better(better(kept[f], now[f]), rec[f]);
  return out;
}

/** Keep this run's bests in this world's record and the island's (the worlds' records). */
export function noteBests(g: Game) {
  const m = g.s.meta;
  const here = (m.here ??= newWorldRun(m.runStart));
  const now = bestsThisRun(g);
  const rec = ((m.worldRecords ??= {})[worldOf(g)] ??= {});
  for (const f of LEGACY_FLOORS) {
    const b = now[f];
    if (!b) continue;
    if (!here.best[f] || b.value > here.best[f]!.value) here.best[f] = b;
    if (!rec[f] || b.value > rec[f]!.value) rec[f] = b;
  }
}

// ------------------------------------------------------------------ the preview

export interface LegacyGoal { kind: 'floor' | 'mega' | 'island'; text: string; gain: number; floor?: LegacyFloor }

export interface LegacyPreview {
  /** Legacy a Relocate to `target` gives now */
  now: number;
  total: number;
  /** each floor's best this world, and their sum and its term */
  floors: Record<LegacyFloor, FloorBest | null>;
  value: number;
  designs: number;
  /** Megaproject stages counted (done this world, and those standing since the universe began that
   * this island's first Relocate banks: `inherited`), and their term */
  stages: number;
  inherited: number;
  stageTerm: number;
  /** the island and its first-visit bonus */
  target: WorldId | null;
  newIsland: number;
  /** islands not visited yet */
  unvisited: WorldId[];
  goals: LegacyGoal[];
}

const fmt = (v: number) => (v >= 10 ? v.toFixed(0) : v.toFixed(1).replace(/\.0$/, ''));
const FLOOR_NAME: Record<LegacyFloor, string> = { workshop: 'Workshop', factory: 'Factory', district: 'District', world: 'World' };

/** What a Relocate to `target` (or the best island to go to, when absent) would give now. */
export function previewLegacy(g: Game, target?: WorldId): LegacyPreview {
  const m = g.s.meta;
  const floors = floorBests(g);
  const value = LEGACY_FLOORS.reduce((t, f) => t + (floors[f]?.value ?? 0), 0);
  const designs = value / RULES.legacyPerValue.value;
  const here = worldOf(g);
  // a universe's stages standing count once, at the first Relocate from their island (DESIGN.md §22)
  const inherited = m.inherited?.[here] ?? 0;
  const stages = (m.here?.stages ?? 0) + inherited;
  const stageTerm = stages * RULES.legacyPerStage.value;
  const visited = m.visited ?? ['home'];
  const unvisited = WORLD_IDS.filter((w) => !visited.includes(w) && w !== here);
  const to = target ?? unvisited[0] ?? null;
  const newIsland = to && !visited.includes(to) && to !== here ? RULES.legacyNewIsland.value : 0;
  const total = designs + stageTerm + newIsland;
  const now = Math.floor(total + 1e-9);
  const goals: LegacyGoal[] = [];
  const k = 1 / RULES.legacyPerValue.value;
  const kw = k / RULES.legacyWorldDesigns.value;
  for (const f of LEGACY_FLOORS) {
    const b = floors[f];
    if (f === 'world') {
      // the World counts each kind of design at work once: another kind raises it, a copy doesn't
      const lead = b ? 'Put another kind of District group to work on the World (a product not at work there yet)' : 'Put a District fold to work on the World floor';
      goals.push({ kind: 'floor', floor: f, gain: 8 * kw, text: `${lead}: 60 s at half speed or better, +${fmt(kw)} Legacy a unit of its value (about 8 a group; a copy adds nothing)` });
    } else if (!b) goals.push({ kind: 'floor', floor: f, gain: 2 * k, text: `Fold on the ${FLOOR_NAME[f]}: +${fmt(k)} Legacy a unit of value (steps x grade x tier)` });
    else goals.push({ kind: 'floor', floor: f, gain: k * b.value * 0.25, text: `Beat the ${FLOOR_NAME[f]}'s best (${itemName(b.item).toLowerCase()}, ${b.grade}, ${fmt(b.value)}): a step deeper or a grade better, +${fmt(k)} a unit` });
  }
  for (const mid of MEGA_IDS) {
    if (!projectOpen(g, mid)) continue;
    const st = megaStageOf(g, mid);
    if (st) goals.push({ kind: 'mega', gain: RULES.legacyPerStage.value, text: `Finish ${st.name}: +${RULES.legacyPerStage.value} Legacy` });
  }
  if (unvisited.length && !(target && newIsland)) goals.push({ kind: 'island', gain: RULES.legacyNewIsland.value, text: `Fly to an island you have not visited (${unvisited.map((w) => WORLDS[w].name).join(', ')}): +${RULES.legacyNewIsland.value} Legacy` });
  goals.sort((a, b) => b.gain - a.gain);
  return { now, total, floors, value, designs, stages, inherited, stageTerm, target: to, newIsland, unvisited, goals };
}

/** The Megaproject stages standing now, by the island whose Relocate banks them (DESIGN.md §22):
 * the Great Drill's, the City's and the Transmuter's are Home's (where every universe begins), each
 * stage of #4 and #5 its own island's. The Last Fold hands these to the next universe
 * (`meta.inherited`), so every stage counts once a universe. */
export function stagesStanding(g: Game): Partial<Record<WorldId, number>> {
  const out: Partial<Record<WorldId, number>> = {};
  const add = (w: WorldId, n: number) => { if (n > 0) out[w] = (out[w] ?? 0) + n; };
  add('home', g.s.mega.stage);
  for (const mid of MEGA_IDS) {
    const def = MEGAS[mid];
    const ms = g.s.megas?.[mid];
    if (!ms) continue;
    if (!def.anyOrder) { add('home', ms.stage); continue; }
    for (const st of def.stages) if (st.world && ms.done?.includes(st.stage)) add(st.world, 1);
  }
  return out;
}

// ------------------------------------------------------------------ the move

/** Why the town can't fly to `world` now, or null. */
export function relocateRefusal(g: Game, world: WorldId): string | null {
  if (g.s.scenario) return 'A Scenario has no Relocate';
  if (!WORLDS[world]) return 'No such island';
  if (world === worldOf(g)) return `The town is on ${WORLDS[world].name} already: pick another island`;
  if (!g.done('relocation')) return 'Research Relocation first';
  if (!g.s.meta.here?.opened && !g.s.world) return 'The World floor must stand in this world first (research Charting)';
  if (g.s.audits.length || g.s.faudit || g.s.haudit) return 'An audit is running: fold or cancel it first';
  if (previewLegacy(g, world).now < RULES.legacyMin.value) return 'Nothing to bank yet: fold on more floors, or finish a Megaproject stage';
  return null;
}

/** Megaprojects #4 and #5 build each island's stage there: the progress of the stage left behind
 * waits in `held`, and the new island's comes back. */
function switchMegas(g: Game, from: WorldId, to: WorldId) {
  for (const mid of MEGA_IDS) {
    const def = MEGAS[mid];
    if (!def.anyOrder) continue;
    const ms: MegaState | undefined = g.s.megas?.[mid];
    if (!ms) continue;
    const held = (ms.held ??= {});
    const old = def.stages.find((st) => st.world === from && !ms.done?.includes(st.stage));
    if (old && Object.keys(ms.progress).length) held[old.stage] = ms.progress;
    const nu = def.stages.find((st) => st.world === to && !ms.done?.includes(st.stage));
    ms.progress = nu ? held[nu.stage] ?? {} : {};
    if (nu) delete held[nu.stage];
  }
}

/** Relocate: bank this world's Legacy and start the first run on `world` (pillar 4: the player's
 * choice, with a preview). */
export function relocate(g: Game, world: WorldId): ActResult {
  const why = relocateRefusal(g, world);
  if (why) return no(why);
  const s = g.s;
  const m = s.meta;
  const p = previewLegacy(g, world).now;
  const from = worldOf(g);
  endRun(g, { patents: 0, relocate: world, legacy: p });
  m.legacy = (m.legacy ?? Num.ZERO).add(p);
  m.legacyEarned = (m.legacyEarned ?? Num.ZERO).add(p);
  // layer 2's losses: the Patent tree (but the habits kept), the Patents, the record on file
  const lr = lrules(g);
  const keep = new Set((m.habits ?? []).slice(0, lr.habitSlots));
  m.nodes = m.nodes.filter((n) => keep.has(n));
  m.habits = (m.habits ?? []).filter((n) => keep.has(n));
  m.patents = Num.of(lr.purse);
  m.patented = {};
  m.queue = m.queue.filter((q) => m.drawer.some((k) => k.id === q));
  if (!megaDone(g, 'anchor', 4)) m.keptRoom = {};
  // this island's stages standing since the universe began are banked: once a universe
  if (m.inherited?.[from] !== undefined) delete m.inherited[from];
  switchMegas(g, from, world);
  m.world = world;
  if (!(m.visited ??= ['home']).includes(world)) m.visited.push(world);
  m.here = newWorldRun(s.tick);
  m.relocations = (m.relocations ?? 0) + 1;
  m.standing = m.standing ?? null;
  startRun(g);
  g.bump('relocations');
  // an island visited, in any universe (the Codex's island pages, DESIGN.md §24)
  g.bump('visit:' + world);
  g.emit({ type: 'relocate', id: world, value: p, d: m.relocations });
  return OK;
}
