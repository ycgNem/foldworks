// The prestige economy after the Acts IV-V review (DECISIONS.md "Fixes after the review: the prestige
// economy", DESIGN.md §22, §23): the Automation branch survives every Last Fold, Kept Legacy keeps
// head starts and softeners only, a universe's Megaproject stages standing count once at the first
// Relocate from their island, Kernels count each kind in full and its copies a quarter, the World's
// Legacy term counts its distinct designs, the Seed knows Acts I-II's research, and the Last Fold's
// "raises it" reads the audit's own advice.
import { describe, expect, it } from 'vitest';
import { Game, type Cmd } from '../src/sim/Game';
import { N, Num } from '../src/engine/num';
import { RESEARCH_IDS, RESEARCH } from '../src/data/research';
import { CHUNKS } from '../src/data/land';
import { HIGH } from '../src/data/floors';
import type { ItemId } from '../src/data/items';
import { RULES } from '../src/data/rules';
import type { WorldId } from '../src/data/worlds';
import { KERNELS, type KernelId } from '../src/data/kernels';
import { LEGACY, LEGACY_IDS, type LegacyId } from '../src/data/legacy';
import { TICK_RATE } from '../src/engine/time';
import { startRun, designValue } from '../src/sim/reorganize';
import { previewLegacy, stagesStanding } from '../src/sim/relocate';
import { previewKernels, keptForGood, LASTFOLD_KEPT } from '../src/sim/lastfold';
import { isSky } from '../src/sim/systems/islands';
import { hentAt } from '../src/sim/systems/high';
import { prules } from '../src/sim/patents';
import type { FEnt, ModuleDesign } from '../src/sim/world';

function isle(world: WorldId) {
  const g = new Game(1);
  g.s.meta.world = world;
  if (!g.s.meta.visited!.includes(world)) g.s.meta.visited!.push(world);
  startRun(g);
  g.rebuild();
  return g;
}

function megasDone(g: Game) {
  g.s.mega.stage = 3;
  g.s.megas = {
    city: { stage: 2, progress: {} }, transmuter: { stage: 2, progress: {} },
    lighthouse: { stage: 4, progress: {}, done: [1, 2, 3, 4] }, anchor: { stage: 4, progress: {}, done: [1, 2, 3, 4] },
  };
}

/** Everything researched, every Megaproject done, coin and land: the run as it stands. */
function grant(g: Game) {
  g.s.coin = N(1e12);
  g.s.land = CHUNKS.map((c) => c.id).filter((c) => !isSky(g, c));
  g.s.research.done = [...RESEARCH_IDS];
  megasDone(g);
  if (!g.s.flags.includes('factoryOpen')) g.s.flags.push('factoryOpen');
  g.s.ents = g.s.ents.filter((e) => e.kind === 'dock' || e.kind === 'hopper' || e.kind === 'furnace' || e.kind === 'seed' || e.ruined);
  g.rebuild();
  g.step(1);
}

function sandbox(world: WorldId = 'home') {
  const g = isle(world);
  grant(g);
  return g;
}

function must(g: Game, c: Cmd) {
  const r = g.act(c);
  if (!r.ok) throw new Error(`${JSON.stringify(c)}: ${r.why}`);
}

function design(g: Game, over: Partial<ModuleDesign>): ModuleDesign {
  const d: ModuleDesign = {
    id: g.s.nextDesign++, name: 'D' + g.s.nextDesign, box: { x: 0, y: 0, w: 2, h: 1 }, parts: [], ins: {}, outs: {},
    grade: { letter: 'B', score: 0.7, u: 1, w: 1, c: 1, mult: 1 }, bill: 1000, stamped: 0, spare: 4, depth: 3, ...over,
  };
  g.s.designs.push(d);
  return d;
}

/** Four District groups at work on the World, each flying its product to the Dock. */
const WORLD_ITEMS: ItemId[] = ['robotArm', 'sandwichEngineer', 'umbrella', 'servo'];
const WORLD_AT: [number, number][] = [[13, 1], [13, 2], [12, 1], [12, 2]];
function worldAtWork(g: Game) {
  const dk = HIGH.world.dock;
  return WORLD_ITEMS.map((item, i) => {
    const d = design(g, { outs: { [item]: 0.05 } });
    const [x, y] = WORLD_AT[i];
    must(g, { k: 'hplace', floor: 'world', design: d.id, x, y });
    must(g, { k: 'route', floor: 'world', fx: x, fy: y, tx: dk.x, ty: dk.y, item });
    return d;
  });
}

const auditTicks = (g: Game) => (prules(g).auditWarmup + prules(g).auditWindow) * TICK_RATE + 1;

/** A World at work, audited whole and graded. */
function graded(world: WorldId = 'home') {
  const g = sandbox(world);
  const ds = worldAtWork(g);
  g.step(5 * TICK_RATE);
  must(g, { k: 'lastFoldAudit' });
  g.step(auditTicks(g));
  return { g, ds };
}

function kernels(g: Game, ...ids: KernelId[]) {
  g.s.meta.kernels = (g.s.meta.kernels ?? Num.ZERO).add(ids.reduce((t, id) => t + KERNELS[id].cost, 0));
  for (const id of ids) must(g, { k: 'kernel', id });
}

/** Place `n` copies of `d` on the World's free tiles, each marked as run 60 s at half speed (the
 * preview's count before an audit), with nothing stepped after. */
function placeAtWork(g: Game, d: ModuleDesign, n: number): FEnt[] {
  d.spare = n + 4;
  const out: FEnt[] = [];
  const W = HIGH.world.w, H = HIGH.world.h;
  for (let y = 0; y < H && out.length < n; y++)
    for (let x = 0; x < W && out.length < n; x++) {
      if (hentAt(g, 'world', x, y)) continue;
      if (!g.act({ k: 'hplace', floor: 'world', design: d.id, x, y }).ok) continue;
      out.push(hentAt(g, 'world', x, y)!);
    }
  for (const e of out) e.ok = RULES.legacyRunSeconds.value + 1;
  return out;
}

const AUTO = LEGACY_IDS.filter((id) => LEGACY[id].branch === 'auto');

describe('the Automation branch is kept through every Last Fold (pillar 2)', () => {
  it('all eight nodes, the Committee\'s number and the Town Plan\'s layouts survive; head starts go', () => {
    expect(AUTO.length).toBe(8);
    expect(AUTO.every(keptForGood)).toBe(true);
    const { g } = graded();
    const m = g.s.meta;
    m.legacyNodes = ['patentPurse', 'oldHabits', 'skyMoorings', ...AUTO];
    m.standing = 25;
    m.plans = [{ id: 1, name: 'Plan', tiles: [], routes: [] }];
    must(g, { k: 'lastFold' });
    for (const id of AUTO) expect(m.legacyNodes).toContain(id);
    expect(m.legacyNodes).not.toContain('patentPurse');
    expect(m.legacyNodes).not.toContain('skyMoorings');
    expect(m.standing).toBe(25);
    expect(m.plans!.length).toBe(1);
    // and through a second Last Fold
    grant(g);
    worldAtWork(g);
    g.step(5 * TICK_RATE);
    must(g, { k: 'lastFoldAudit' });
    g.step(auditTicks(g));
    must(g, { k: 'lastFold' });
    for (const id of AUTO) expect(m.legacyNodes).toContain(id);
    expect(m.lastFolds).toBe(2);
    // the card says so
    expect(LASTFOLD_KEPT.some((k) => /Automation/.test(k.what))).toBe(true);
  });

  it('Kept Legacy no longer offers automation (nor the Archive, which the Seed keeps)', () => {
    const { g } = graded();
    kernels(g, 'keptIslands', 'keptLegacy');
    g.s.meta.legacyNodes = ['patentClerk', 'townPlan', 'regrader', 'townArchive', 'patentPurse', 'heatShields'];
    for (const id of ['patentClerk', 'townPlan'] as LegacyId[]) expect(g.act({ k: 'keepLegacy', id }).why).toMatch(/Automation/);
    expect(g.act({ k: 'keepLegacy', id: 'townArchive' }).why).toMatch(/Seed/);
    must(g, { k: 'keepLegacy', id: 'patentPurse' });
    must(g, { k: 'keepLegacy', id: 'heatShields' });
    expect(g.s.meta.keptLegacy).toEqual(['patentPurse', 'heatShields']);
    // an older save's pick of an Automation node takes no slot: it is kept anyway
    g.s.meta.keptLegacy = ['patentClerk', 'patentPurse'];
    must(g, { k: 'lastFold' });
    expect(g.s.meta.keptLegacy).toEqual(['patentPurse']);
    expect([...g.s.meta.legacyNodes!].sort()).toEqual(['patentClerk', 'patentPurse', 'regrader', 'townArchive', 'townPlan']);
  });
});

describe('a universe\'s Megaproject stages count once, at the first Relocate from their island (§22)', () => {
  it('the first universe is as before: only the stages done this world', () => {
    const g = sandbox();
    worldAtWork(g);
    g.s.meta.here!.stages = 2;
    const p = previewLegacy(g, 'pebble');
    expect(p.inherited).toBe(0);
    expect(p.stages).toBe(2);
    expect(g.s.meta.inherited).toBeUndefined();
  });

  it('universe 2\'s first Relocate counts Home\'s seven stages standing; each island\'s two at its own; never twice', () => {
    const { g } = graded();
    expect(stagesStanding(g)).toEqual({ home: 7, pebble: 2, cinder: 2, rime: 2, oldworks: 2 });
    must(g, { k: 'lastFold' });
    const m = g.s.meta;
    expect(m.inherited).toEqual({ home: 7, pebble: 2, cinder: 2, rime: 2, oldworks: 2 });
    // the new universe climbs back to its World on Home
    grant(g);
    worldAtWork(g);
    g.step(65 * TICK_RATE);
    const p = previewLegacy(g, 'pebble');
    expect(p.inherited).toBe(7);
    expect(p.stages).toBe(7);
    expect(p.stageTerm).toBe(7 * RULES.legacyPerStage.value);
    // universe 1's first Relocate from Home banked the same 21 for its seven stages
    expect(p.stageTerm).toBe(21);
    expect(p.now).toBeGreaterThanOrEqual(21 + RULES.legacyNewIsland.value);
    must(g, { k: 'relocate', world: 'pebble' });
    expect(m.inherited!.home).toBeUndefined();
    expect(m.inherited!.pebble).toBe(2);
    // on Pebble its two stages count at its first Relocate
    grant(g);
    worldAtWork(g);
    g.step(65 * TICK_RATE);
    expect(previewLegacy(g, 'home').inherited).toBe(2);
    must(g, { k: 'relocate', world: 'home' });
    expect(m.inherited!.pebble).toBeUndefined();
    // back on Home: its stages were banked this universe already
    grant(g);
    worldAtWork(g);
    g.step(65 * TICK_RATE);
    const q = previewLegacy(g, 'cinder');
    expect(q.inherited).toBe(0);
    expect(q.stages).toBe(0);
  });
});

describe('Kernels count each kind in full and its copies a quarter (§23)', () => {
  it('100 copies of one design are not 100 Kernels', () => {
    const g = sandbox();
    const d = design(g, { outs: { sandwichEngineer: 0.05 }, grade: { letter: 'S', score: 0.95, u: 1, w: 1, c: 1, mult: 1.25 } });
    const v = designValue(d)!.value;
    const copies = placeAtWork(g, d, 100);
    expect(copies.length).toBe(100);
    const p = previewKernels(g);
    expect(p.counted).toBe(100);
    expect(p.kinds).toBe(1);
    expect(p.value).toBeCloseTo(v + 99 * v * RULES.kernelCopyShare.value, 6);
    expect(p.now).toBe(Math.floor(p.value / RULES.kernelPerValue.value + 1e-9));
    // the old rule summed every copy: 100 x the value
    expect(p.now).toBeLessThan(Math.floor((100 * v) / RULES.kernelPerValue.value) / 3);
    // one line counts in full, the rest a quarter
    expect(p.lines.filter((l) => l.share === 1).length).toBe(1);
    expect(p.lines.filter((l) => l.share === RULES.kernelCopyShare.value).length).toBe(99);
  });

  it('distinct kinds each count in full; a deeper fold of the same product is another kind', () => {
    const g = sandbox();
    const a = design(g, { outs: { robotArm: 0.05 } });
    const b = design(g, { outs: { servo: 0.05 } });
    const a2 = design(g, { outs: { robotArm: 0.05 }, grade: { letter: 'A', score: 0.85, u: 1, w: 1, c: 1, mult: 1.1 } });
    placeAtWork(g, a, 1);
    placeAtWork(g, b, 1);
    placeAtWork(g, a2, 1);
    const [va, vb, va2] = [a, b, a2].map((q) => designValue(q)!.value);
    const p = previewKernels(g);
    expect(p.kinds).toBe(2);
    // robot arms twice: the better graded in full, the other a quarter
    expect(p.value).toBeCloseTo(Math.max(va, va2) + Math.min(va, va2) * RULES.kernelCopyShare.value + vb, 6);
    // a goal for an idle copy says what it adds: a quarter
    const idle = design(g, { outs: { servo: 0.05 } });
    placeAtWork(g, idle, 1)[0].ok = 0;
    const goal = previewKernels(g).goals.find((q) => q.text.includes(idle.name))!;
    expect(goal.gain).toBeCloseTo((designValue(idle)!.value * RULES.kernelCopyShare.value) / RULES.kernelPerValue.value, 6);
  });
});

describe('the World\'s Legacy term counts its distinct designs (§22)', () => {
  it('copies add nothing; a new kind adds its value / legacyWorldDesigns', () => {
    const g = sandbox();
    const a = design(g, { outs: { robotArm: 0.05 } });
    const va = designValue(a)!.value;
    placeAtWork(g, a, 3);
    let w = previewLegacy(g, 'pebble').floors.world!;
    expect(w.designs).toBe(1);
    expect(w.value).toBeCloseTo(va / RULES.legacyWorldDesigns.value, 6);
    const b = design(g, { outs: { sandwichEngineer: 0.05 } });
    const vb = designValue(b)!.value;
    placeAtWork(g, b, 2);
    w = previewLegacy(g, 'pebble').floors.world!;
    expect(w.designs).toBe(2);
    expect(w.sum).toBeCloseTo(va + vb, 6);
    expect(w.value).toBeCloseTo((va + vb) / RULES.legacyWorldDesigns.value, 6);
    // the District's best is not counted again at full value on the World
    const p = previewLegacy(g, 'pebble');
    expect(p.floors.district!.value).toBeCloseTo(Math.max(va, vb), 6);
    expect(p.value).toBeCloseTo(p.floors.district!.value + w.value + (p.floors.workshop?.value ?? 0) + (p.floors.factory?.value ?? 0), 6);
    // a well-built World (five kinds at about 8) is worth a floor's 7-10 (§22)
    expect((5 * 8) / RULES.legacyWorldDesigns.value).toBeGreaterThanOrEqual(7);
    expect((5 * 8) / RULES.legacyWorldDesigns.value).toBeLessThanOrEqual(11);
  });
});

describe('the Seed carries Acts I-II\'s research into each new universe (§23)', () => {
  it('every run of a later universe knows Acts I-II, none of Act III; the first universe knows nothing', () => {
    const fresh = isle('home');
    expect(fresh.s.research.done).toEqual([]);
    const { g } = graded();
    must(g, { k: 'lastFold' });
    const want = RESEARCH_IDS.filter((r) => (RESEARCH[r].act ?? 1) <= RULES.seedActs.value);
    expect(want.length).toBe(26);
    expect(g.s.research.done).toEqual(want);
    expect(g.s.research.done).toContain('greatDrill');
    expect(g.s.research.done).not.toContain('zoning');
    // and after a Reorganize in the new universe
    g.s.coin = N(1e6);
    design(g, { depth: 1, outs: { gear: 1 }, grade: { letter: 'S', score: 0.95, u: 1, w: 1, c: 1, mult: 2 } });
    must(g, { k: 'reorganize' });
    expect(g.s.research.done).toEqual(want);
    // the card's KEPT column says so
    expect(LASTFOLD_KEPT.some((k) => /Acts I-II/.test(k.what))).toBe(true);
  });
});

describe('the Last Fold\'s "raises it" reads the audit\'s own advice', () => {
  it('the grade goal is the audit\'s first advice line, not "run the World better"', () => {
    const { g } = graded();
    const a = g.s.haudit!.result!;
    // four modules on a 16x12 World: C is the weakest part
    expect(a.grade.c).toBeLessThan(0.5);
    const advice = a.advice[0];
    expect(advice).toMatch(/tiles are modules/);
    const goal = previewKernels(g).goals.find((q) => q.kind === 'grade');
    if (a.grade.letter === 'S+') return;
    expect(goal).toBeTruthy();
    expect(goal!.text.startsWith(advice)).toBe(true);
    expect(goal!.text).not.toMatch(/Run the World better/);
    expect(goal!.short).toBe(advice.slice(0, advice.indexOf('.')));
    expect(goal!.short).toMatch(/tiles are modules/);
  });
});
