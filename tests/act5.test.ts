// Act V (ROADMAP.md Milestone 10, DESIGN.md §23): the Last Fold (its whole-World audit, Kernels, what
// it keeps and loses, the Seed), every Kernel node's rule, Beyond (couriers, depth-4 modules, its
// Dock), tier 5, the Endless Ledger's sequence and cosmetics, offline on Beyond, the v10 migration
// and determinism.
import { describe, expect, it } from 'vitest';
import { Game, type Cmd } from '../src/sim/Game';
import { N, Num } from '../src/engine/num';
import { RESEARCH_IDS, RESEARCH } from '../src/data/research';
import { CHUNKS } from '../src/data/land';
import { HIGH, skiffRate } from '../src/data/floors';
import { ITEMS, ITEM_IDS, type ItemId } from '../src/data/items';
import { RECIPES, RECIPE } from '../src/data/recipes';
import { RULES } from '../src/data/rules';
import type { WorldId } from '../src/data/worlds';
import { KERNELS, KERNEL_IDS, KERNEL_GRADE, LEDGER, LEDGER_RULES, type KernelId } from '../src/data/kernels';
import { LEGACY } from '../src/data/legacy';
import { TICK_RATE } from '../src/engine/time';
import { migrate, SAVE_VERSION } from '../src/engine/save';
import { startRun, designValue, chainSteps } from '../src/sim/reorganize';
import { floorBests } from '../src/sim/relocate';
import { krules } from '../src/sim/kernels';
import { isSky } from '../src/sim/systems/islands';
import { available } from '../src/sim/systems/research';
import { fillOrder } from '../src/sim/systems/docks';
import { runOrders } from '../src/sim/systems/orders';
import { currentLedger, ledgerOrder, cosmeticAt, nextCosmetic } from '../src/sim/systems/ledger';
import { SEED_ORES } from '../src/sim/systems/seed';
import { foldRefusal } from '../src/sim/systems/audits';
import { hentAt, hfoldRefusal, routeCap } from '../src/sim/systems/high';
import { previewKernels, lastFoldValue, lastFoldRefusal, lastFoldAuditRefusal, LASTFOLD_KEPT, LASTFOLD_LOST } from '../src/sim/lastfold';
import { offlineCeiling, offlineEfficiency, runOffline } from '../src/sim/offline';
import { prules } from '../src/sim/patents';
import { offer, recipeKnown } from '../src/sim/transfer';
import { fingerprint, replayInto, savePayload, restore } from '../src/sim/snapshot';
import type { KeptDesign, ModuleDesign } from '../src/sim/world';

/** A fresh first run on an island (as a Relocate leaves it). */
function isle(world: WorldId, seed = 1, keepHistory = false) {
  const g = new Game(seed, keepHistory ? { keepHistory: true } : undefined);
  g.s.meta.world = world;
  if (!g.s.meta.visited!.includes(world)) g.s.meta.visited!.push(world);
  startRun(g);
  g.rebuild();
  return g;
}

/** Every Megaproject complete (Act IV done: the Last Fold is open). */
function megasDone(g: Game) {
  g.s.mega.stage = 3;
  g.s.megas = {
    city: { stage: 2, progress: {} }, transmuter: { stage: 2, progress: {} },
    lighthouse: { stage: 4, progress: {}, done: [1, 2, 3, 4] }, anchor: { stage: 4, progress: {}, done: [1, 2, 3, 4] },
  };
}

function grant(g: Game) {
  g.s.coin = N(1e12);
  g.s.land = CHUNKS.map((c) => c.id).filter((c) => !isSky(g, c));
  g.s.research.done = [...RESEARCH_IDS];
  g.s.upgrades.push('bellows');
  megasDone(g);
  if (!g.s.flags.includes('factoryOpen')) g.s.flags.push('factoryOpen');
  g.s.ents = g.s.ents.filter((e) => e.kind === 'dock' || e.kind === 'hopper' || e.kind === 'furnace' || e.kind === 'seed' || e.ruined);
  g.rebuild();
}

/** Everything researched, every Megaproject done, on an island. */
function sandbox(world: WorldId = 'home', seed = 1, keepHistory = false) {
  const g = isle(world, seed, keepHistory);
  grant(g);
  g.step(1);
  return g;
}

function must(g: Game, c: Cmd) {
  const r = g.act(c);
  if (!r.ok) throw new Error(`${JSON.stringify(c)}: ${r.why}`);
}

function design(g: Game, over: Partial<ModuleDesign>): ModuleDesign {
  const d: ModuleDesign = {
    id: g.s.nextDesign++, name: 'D', box: { x: 0, y: 0, w: 2, h: 1 }, parts: [], ins: {}, outs: {},
    grade: { letter: 'B', score: 0.7, u: 1, w: 1, c: 1, mult: 1 }, bill: 1000, stamped: 0, spare: 4, depth: 1, ...over,
  };
  g.s.designs.push(d);
  return d;
}

/** Give Kernels and buy nodes. */
function kernels(g: Game, ...ids: KernelId[]) {
  g.s.meta.kernels = (g.s.meta.kernels ?? Num.ZERO).add(ids.reduce((t, id) => t + KERNELS[id].cost, 0));
  for (const id of ids) must(g, { k: 'kernel', id });
}

/** Four District groups at work on the World, each flying its product to the Dock. */
const WORLD_ITEMS: ItemId[] = ['robotArm', 'sandwichEngineer', 'umbrella', 'servo'];
const WORLD_AT: [number, number][] = [[13, 1], [13, 2], [12, 1], [12, 2]];
function worldAtWork(g: Game) {
  const dk = HIGH.world.dock;
  return WORLD_ITEMS.map((item, i) => {
    const d = design(g, { depth: 3, outs: { [item]: 0.05 } });
    const [x, y] = WORLD_AT[i];
    must(g, { k: 'hplace', floor: 'world', design: d.id, x, y });
    must(g, { k: 'route', floor: 'world', fx: x, fy: y, tx: dk.x, ty: dk.y, item });
    return d;
  });
}

/** The audit's warm-up and window, and a tick. */
const auditTicks = (g: Game) => (prules(g).auditWarmup + prules(g).auditWindow) * TICK_RATE + 1;

/** A World at work, audited whole and graded. */
function graded(world: WorldId = 'home', seed = 1, keepHistory = false) {
  const g = sandbox(world, seed, keepHistory);
  const ds = worldAtWork(g);
  g.step(5 * TICK_RATE);
  must(g, { k: 'lastFoldAudit' });
  g.step(auditTicks(g));
  return { g, ds };
}

describe('the Last Fold (DESIGN.md §23)', () => {
  it('its research is on the Act V page and opens once the Lighthouse and the Sky Anchor are complete', () => {
    expect(RESEARCH.lastFold.act).toBe(5);
    const g = isle('home');
    g.s.mega.stage = 3;
    g.s.research.done = RESEARCH_IDS.filter((r) => r !== 'lastFold');
    expect(available(g, 'lastFold')).toBe(false);
    g.s.megas = { lighthouse: { stage: 3, progress: {}, done: [1, 2, 3] }, anchor: { stage: 4, progress: {}, done: [1, 2, 3, 4] } };
    expect(available(g, 'lastFold')).toBe(false);
    megasDone(g);
    expect(available(g, 'lastFold')).toBe(true);
  });

  it('audits every module on the World at once; the World is locked while it runs; it is no ordinary fold', () => {
    const g = sandbox();
    expect(lastFoldAuditRefusal(g)).toMatch(/modules/);
    const ds = worldAtWork(g);
    must(g, { k: 'lastFoldAudit' });
    const a = g.s.haudit!;
    expect(a.last).toBe(true);
    expect(a.ids.length).toBe(ds.length);
    expect(g.act({ k: 'hremove', floor: 'world', x: 13, y: 1 }).ok).toBe(false);
    expect(g.act({ k: 'lastFoldAudit' }).ok).toBe(false);
    expect(lastFoldRefusal(g)).toMatch(/still being audited/);
    g.step(auditTicks(g));
    expect(a.result).toBeTruthy();
    expect(a.result!.grade.u).toBeGreaterThan(0.9);
    // what reached the Dock is the World's output
    expect(Object.keys(a.result!.outs).sort()).toEqual([...WORLD_ITEMS].sort());
    expect(g.act({ k: 'hfold', name: null }).why).toMatch(/Seed/);
    must(g, { k: 'hauditCancel' });
    expect(g.s.haudit).toBeNull();
  });

  it('Kernels = floor(value / 10) + the grade bonus; value sums the modules at work', () => {
    const { g, ds } = graded();
    const p = previewKernels(g);
    const value = ds.reduce((t, d) => t + designValue(d)!.value, 0);
    expect(p.audited).toBe(true);
    expect(p.counted).toBe(ds.length);
    expect(p.value).toBeCloseTo(value, 6);
    expect(p.gradeBonus).toBe(KERNEL_GRADE.bonus[p.grade!]);
    expect(p.now).toBe(Math.floor(value / RULES.kernelPerValue.value + p.gradeBonus + 1e-9));
    expect(p.now).toBeGreaterThanOrEqual(RULES.kernelMin.value);
    // a module that did not run is not counted, and is a goal
    const idle = design(g, { depth: 3, ins: { gear: 1 }, outs: { robotArm: 0.05 } });
    must(g, { k: 'hauditCancel' });
    must(g, { k: 'hplace', floor: 'world', design: idle.id, x: 2, y: 2 });
    must(g, { k: 'lastFoldAudit' });
    g.step(auditTicks(g));
    const q = previewKernels(g);
    expect(q.lines.find((l) => l.design === idle.id)!.counted).toBe(false);
    expect(q.goals.some((x) => x.kind === 'module' && x.text.includes(idle.name))).toBe(true);
  });

  it('a depth-4 module counts the World group folded into it', () => {
    const g = sandbox();
    const a = design(g, { depth: 3, outs: { robotArm: 0.1 } });
    const b = design(g, { depth: 3, outs: { servo: 0.1 } });
    const four = design(g, { depth: 4, hfloor: 'world', outs: { robotArm: 0.1 }, hparts: [{ design: a.id, dx: 0, dy: 0 }, { design: b.id, dx: 1, dy: 0 }], hroutes: [] });
    expect(lastFoldValue(g, four)).toBeCloseTo(designValue(a)!.value + designValue(b)!.value, 6);
  });

  it('keeps the Megaprojects, reputation, the Codex, the Drawer, Challenges, trophies, Kernels; loses the rest; the new universe starts on Home with the Seed', () => {
    const { g } = graded('cinder');
    const m = g.s.meta;
    m.patents = N(40);
    m.nodes = ['quickAudits' as never];
    m.patented = { gear: { value: 3, steps: 2, grade: 'A', tier: 0, run: 1 } };
    m.legacy = N(12);
    m.legacyNodes = ['patentPurse', 'patentClerk'];
    m.visited = ['home', 'pebble', 'cinder'];
    g.s.orders.rep.bramble = 5;
    g.s.codex = ['gear'];
    g.s.flags.push('trophy:test');
    m.challenges = ['smallBoxes'];
    const kd: KeptDesign = { id: m.nextKept++, name: 'Kept', x: 0, y: 0, w: 1, h: 1, parts: [], product: null, grade: null, rate: 0, run: 1 };
    m.drawer.push(kd);
    const k = previewKernels(g).now;
    must(g, { k: 'lastFold' });
    expect(m.kernels!.toNumber()).toBe(k);
    expect(m.kernelsEarned!.toNumber()).toBe(k);
    expect(m.lastFolds).toBe(1);
    expect(m.seeds![0]).toMatchObject({ universe: 1, kernels: k, world: 'cinder' });
    expect(m.history[m.history.length - 1].lastFold).toBe(k);
    // kept
    expect(g.s.megas!.lighthouse!.done).toEqual([1, 2, 3, 4]);
    expect(g.s.mega.stage).toBe(3);
    expect(g.s.orders.rep.bramble).toBe(5);
    expect(g.s.codex).toEqual(['gear']);
    expect(g.s.flags).toContain('trophy:test');
    expect(m.challenges).toEqual(['smallBoxes']);
    expect(m.drawer.map((q) => q.id)).toContain(kd.id);
    // lost
    expect(m.patents.toNumber()).toBe(0);
    expect(m.nodes).toEqual([]);
    expect(m.patented).toEqual({});
    expect(m.legacy!.toNumber()).toBe(0);
    expect(m.legacyNodes).toEqual([]);
    expect(m.worldRecords).toEqual({});
    expect(m.visited).toEqual(['home']);
    expect(m.world).toBe('home');
    expect(g.s.world).toBeUndefined();
    expect(g.s.designs).toEqual([]);
    expect(g.s.research.done).toEqual([]);
    expect(g.s.land).toEqual(['A']);
    // the Seed stands in the new Workshop, not removable, and is planted again by every later run
    const seed = g.entAt(RULES.seedX.value, RULES.seedY.value)!;
    expect(seed.kind).toBe('seed');
    expect(g.act({ k: 'remove', x: seed.x, y: seed.y }).ok).toBe(false);
    expect(LASTFOLD_KEPT.length).toBeGreaterThan(4);
    expect(LASTFOLD_LOST.length).toBeGreaterThan(1);
    g.s.coin = N(1e6);
    design(g, { outs: { gear: 1 }, grade: { letter: 'S', score: 0.95, u: 1, w: 1, c: 1, mult: 2 } });
    must(g, { k: 'reorganize' });
    expect(g.entAt(RULES.seedX.value, RULES.seedY.value)?.kind).toBe('seed');
  });

  it('is refused without the whole-World audit graded', () => {
    const g = sandbox();
    expect(lastFoldRefusal(g)).toMatch(/Audit the whole World/);
    expect(g.act({ k: 'lastFold' }).ok).toBe(false);
    const h = isle('home');
    expect(lastFoldAuditRefusal(h)).toMatch(/Research The Last Fold/);
  });
});

describe('the Seed (DESIGN.md §23)', () => {
  /** A first run after a Last Fold. */
  function seeded(...ks: KernelId[]) {
    const g = isle('home');
    g.s.meta.lastFolds = 1;
    if (ks.length) kernels(g, ...ks);
    startRun(g);
    g.rebuild();
    g.s.coin = N(1e6);
    return g;
  }

  it('digs one of each raw ore out of its four sides every 4 s, iron out of the side it faces', () => {
    const g = seeded();
    const s = g.entAt(RULES.seedX.value, RULES.seedY.value)!;
    expect(s.kind).toBe('seed');
    // a belt east of it (the side it faces) into nothing: iron waits on it
    must(g, { k: 'place', kind: 'belt', x: s.x + 1, y: s.y, rot: 0 });
    g.step(RULES.seedSeconds.value * TICK_RATE + 2);
    const b = g.entAt(s.x + 1, s.y)!;
    expect(b.item).toBe('ironOre');
    // nothing takes the other three: they wait, and the pip says what waits
    expect(s.state).toBe('work');
    expect(SEED_ORES).toContain(s.why as ItemId);
    // turned, copper comes out of the east side
    g.s.coin = N(1000);
    must(g, { k: 'remove', x: s.x + 1, y: s.y });
    must(g, { k: 'rotate', x: s.x, y: s.y });
    must(g, { k: 'place', kind: 'belt', x: s.x + 1, y: s.y, rot: 0 });
    g.step(RULES.seedSeconds.value * TICK_RATE + 2);
    // rot 1 (south) gets iron; the side three clockwise (east) gets sand
    expect(g.entAt(s.x + 1, s.y)!.item).toBe(SEED_ORES[3]);
  });

  it('never goes in a fold box', () => {
    const g = seeded();
    g.s.research.done = ['folding'];
    expect(foldRefusal(g, { x: RULES.seedX.value - 1, y: RULES.seedY.value - 1, w: 3, h: 3 })).toMatch(/Seed/);
  });

  it('Seedling: it digs every 2 s, a Miner\'s pace', () => {
    const g = seeded('seedling');
    expect(krules(g).seedSeconds).toBe(KERNELS.seedling.effect.k === 'seedling' ? KERNELS.seedling.effect.seconds : 0);
    const s = g.entAt(RULES.seedX.value, RULES.seedY.value)!;
    must(g, { k: 'place', kind: 'heap', x: s.x + 1, y: s.y, rot: 0 }); // takes nothing but slag: a dead end
    const dock = g.s.ents.find((e) => e.kind === 'dock')!;
    void dock;
    g.step(2 * TICK_RATE + 1);
    expect(s.crafts).toBe(1);
    g.step(2 * TICK_RATE);
    expect(s.crafts).toBe(2);
  });
});

describe('the Kernel tree (DESIGN.md §23): every node', () => {
  it('has about ten nodes at flat prices, the contract\'s ids', () => {
    expect(KERNEL_IDS).toEqual(['wideBelts', 'everySide', 'biggerBox', 'secondCookbook', 'beyond', 'endlessLedger', 'seedling', 'longNights', 'keptIslands', 'keptLegacy']);
    const total = KERNEL_IDS.reduce((t, id) => t + KERNELS[id].cost, 0);
    expect(total).toBeGreaterThan(40);
    expect(total).toBeLessThan(70);
    const g = sandbox();
    expect(g.act({ k: 'kernel', id: 'beyond' }).why).toMatch(/Costs/);
    expect(g.act({ k: 'kernel', id: 'keptLegacy' }).why).toMatch(/Kept Islands/);
  });

  it('Wide Belts: a belt carries 2 a tile, 240 a minute', () => {
    const run = (wide: boolean) => {
      const g = sandbox();
      if (wide) kernels(g, 'wideBelts');
      // a belt from (12, 1) west into the Workshop Dock at (6..7, 1..2)
      for (let x = 12; x >= 8; x--) must(g, { k: 'place', kind: 'belt', x, y: 1, rot: 2 });
      const d0 = g.s.delivered.ironPlate?.toNumber() ?? 0;
      for (let t = 0; t < 60 * TICK_RATE; t++) {
        offer(g, 12, 1, 2, 'ironPlate');
        g.tick();
      }
      return (g.s.delivered.ironPlate?.toNumber() ?? 0) - d0;
    };
    const one = run(false), two = run(true);
    expect(one).toBeGreaterThan(110);
    expect(one).toBeLessThan(125);
    expect(two).toBeGreaterThan(220);
    expect(two).toBeLessThan(245);
  });

  it('Every Side a Port: a module takes in from a trunk on its side and gives out of its back', () => {
    const setup = (every: boolean) => {
      const g = sandbox();
      if (every) kernels(g, 'everySide');
      const a = design(g, { outs: { gear: 0.5 } });
      const b = design(g, { ins: { gear: 0.5 }, outs: { gizmo: 0.25 } });
      must(g, { k: 'fplace', design: a.id, x: 2, y: 2, rot: 0 });
      must(g, { k: 'ftrunk', x: 3, y: 2, rot: 0 });
      // b faces south: the trunk comes in at its west side
      must(g, { k: 'fplace', design: b.id, x: 4, y: 2, rot: 1 });
      // a trunk leading away from b's back (north)
      must(g, { k: 'ftrunk', x: 4, y: 1, rot: 3 });
      g.rebuildFactory();
      const A = g.fentAt(2, 2)!, B = g.fentAt(4, 2)!;
      return { g, A, B };
    };
    const off = setup(false);
    expect(off.g.routes.find((r) => r.from === off.A)!.to).toBeNull();
    const on = setup(true);
    expect(on.g.routes.find((r) => r.from === on.A)!.to).toBe(on.B);
    const back = on.g.routes.find((r) => r.from === on.B && r.tiles[0]?.x === 4 && r.tiles[0]?.y === 1);
    expect(back).toBeTruthy();
    expect(back!.by).toBe(false);
  });

  it('the Bigger Box: the Workshop fold box is 12x12', () => {
    const g = sandbox();
    expect(prules(g).foldMax).toBeLessThan(12);
    expect(foldRefusal(g, { x: 0, y: 0, w: 12, h: 12 })).toMatch(/Too big/);
    kernels(g, 'biggerBox');
    expect(prules(g).foldMax).toBe(12);
    expect(foldRefusal(g, { x: 0, y: 0, w: 12, h: 12 }) ?? '').not.toMatch(/Too big/);
  });

  it('the Second Cookbook: the alternate recipes are known with it, and never change chain steps', () => {
    const alts = RECIPES.filter((r) => r.alt);
    expect(alts.length).toBeGreaterThanOrEqual(4);
    const g = sandbox();
    const steps = chainSteps('steel');
    for (const r of alts) expect(recipeKnown(g, r), r.id).toBe(false);
    must(g, { k: 'place', kind: 'smelter', x: 9, y: 9, rot: 0 });
    expect(g.act({ k: 'recipe', x: 9, y: 9, recipe: 'oreSteel' }).ok).toBe(false);
    kernels(g, 'secondCookbook');
    for (const r of alts) expect(recipeKnown(g, r), r.id).toBe(true);
    must(g, { k: 'recipe', x: 9, y: 9, recipe: 'oreSteel' });
    expect(chainSteps('steel')).toBe(steps);
    // each makes something the player already makes another way
    for (const r of alts) expect(RECIPES.some((q) => !q.alt && q.outputs[0].item === r.outputs[0].item), r.id).toBe(true);
  });

  it('Beyond opens the fifth floor with research The Last Fold; World groups fold only once it stands', () => {
    const g = sandbox();
    worldAtWork(g);
    g.step(2);
    expect(g.s.beyond).toBeUndefined();
    expect(hfoldRefusal(g, 'world', { x: 12, y: 1, w: 2, h: 2 })).toMatch(/Beyond/);
    expect(g.act({ k: 'hplace', floor: 'beyond', design: design(g, { depth: 4, outs: { verySmallSun: 0.01 } }).id, x: 2, y: 2 }).why).toMatch(/Kernel/);
    kernels(g, 'beyond');
    g.step(1);
    expect(g.s.beyond).toBeTruthy();
    expect(hfoldRefusal(g, 'world', { x: 12, y: 1, w: 2, h: 2 }) ?? '').not.toMatch(/Beyond/);
    expect(hfoldRefusal(g, 'beyond', { x: 0, y: 0, w: 2, h: 2 })).toMatch(/Nothing folds on Beyond/);
  });

  it('the Endless Ledger is shut without its node', () => {
    const g = sandbox();
    expect(fillOrder(g, 'gizmo', N(10)).toNumber()).toBe(10);
    kernels(g, 'endlessLedger');
    expect(fillOrder(g, 'gizmo', N(10)).toNumber()).toBe(0);
  });

  it('Long Nights: the offline ceiling is 0.85, and 0.1 toward it', () => {
    const g = sandbox();
    const e0 = offlineEfficiency(g);
    expect(offlineCeiling(g)).toBe(0.75);
    kernels(g, 'longNights');
    expect(offlineCeiling(g)).toBe(0.85);
    expect(offlineEfficiency(g)).toBeCloseTo(Math.min(0.85, e0 + 0.1), 6);
  });

  it('Kept Islands: the worlds\' records survive a Last Fold, and an island\'s record counts for its world from the first run', () => {
    const { g } = graded();
    kernels(g, 'keptIslands');
    g.s.meta.worldRecords = { pebble: { workshop: { value: 7, item: 'gear', grade: 'S', steps: 3, tier: 1 } } };
    must(g, { k: 'lastFold' });
    expect(g.s.meta.worldRecords!.pebble!.workshop!.value).toBe(7);
    g.s.meta.world = 'pebble';
    expect(floorBests(g).workshop!.value).toBe(7);
  });

  it('Kept Legacy: the chosen Legacy nodes survive a Last Fold', () => {
    const { g } = graded();
    g.s.meta.legacyNodes = ['patentClerk', 'regrader', 'skiffGuild'];
    expect(g.act({ k: 'keepLegacy', id: 'patentClerk' }).why).toMatch(/Kept Legacy/);
    kernels(g, 'keptIslands', 'keptLegacy');
    expect(g.act({ k: 'keepLegacy', id: 'townPlan' }).why).toMatch(/own/);
    must(g, { k: 'keepLegacy', id: 'patentClerk' });
    must(g, { k: 'keepLegacy', id: 'regrader' });
    expect(LEGACY.regrader).toBeTruthy();
    must(g, { k: 'lastFold' });
    expect(g.s.meta.legacyNodes).toEqual(['patentClerk', 'regrader']);
  });
});

describe('Beyond (DESIGN.md §23)', () => {
  function beyond(seed = 1, keepHistory = false) {
    const g = sandbox('home', seed, keepHistory);
    kernels(g, 'beyond');
    g.step(1);
    return g;
  }

  it('couriers fly load / (2 x distance / speed + dwell): beside 0.4/s, across about 0.09', () => {
    const f = HIGH.beyond;
    expect(f.depth).toBe(4);
    expect(skiffRate(f, 1)).toBeCloseTo(0.4, 6);
    expect(skiffRate(f, 5)).toBeCloseTo(0.22, 2);
    expect(skiffRate(f, 17)).toBeCloseTo(0.095, 2);
    const g = beyond();
    const d = design(g, { depth: 4, outs: { verySmallSun: 0.02 } });
    must(g, { k: 'hplace', floor: 'beyond', design: d.id, x: f.dock.x - 1, y: f.dock.y });
    must(g, { k: 'route', floor: 'beyond', fx: f.dock.x - 1, fy: f.dock.y, tx: f.dock.x, ty: f.dock.y, item: 'verySmallSun' });
    // (the Lighthouse's Beacon, done in this sandbox, halves the dwell on every high floor)
    expect(routeCap(g, 'beyond', g.s.beyond!.routes[0])).toBeCloseTo(skiffRate(f, 1.5811, f.load, f.speed, f.dwell * RULES.lighthouseDwell.value), 3);
    expect(g.s.coin.lt(1e12)).toBe(true); // a courier was paid for
    const c0 = g.s.coin;
    g.step(120 * TICK_RATE);
    expect(g.s.delivered.verySmallSun?.toNumber() ?? 0).toBeGreaterThanOrEqual(2);
    expect(g.s.coin.gt(c0)).toBe(true);
  });

  it('takes depth-4 modules only', () => {
    const g = beyond();
    const d3 = design(g, { depth: 3, outs: { robotArm: 0.1 } });
    expect(g.act({ k: 'hplace', floor: 'beyond', design: d3.id, x: 2, y: 2 }).why).toMatch(/depth-4/);
    const d4 = design(g, { depth: 4, outs: { quietEngine: 0.1 } });
    must(g, { k: 'hplace', floor: 'beyond', design: d4.id, x: 2, y: 2 });
    expect(hentAt(g, 'beyond', 2, 2)!.design).toBe(d4.id);
  });

  it('a module at work on Beyond counts for the Last Fold', () => {
    const g = beyond();
    worldAtWork(g);
    const f = HIGH.beyond;
    const d = design(g, { depth: 4, outs: { verySmallSun: 0.02 } });
    must(g, { k: 'hplace', floor: 'beyond', design: d.id, x: f.dock.x - 1, y: f.dock.y });
    must(g, { k: 'route', floor: 'beyond', fx: f.dock.x - 1, fy: f.dock.y, tx: f.dock.x, ty: f.dock.y, item: 'verySmallSun' });
    g.step((RULES.legacyRunSeconds.value + 5) * TICK_RATE);
    const p = previewKernels(g);
    expect(p.lines.find((l) => l.floor === 'beyond')!.counted).toBe(true);
  });

  it('offline: Beyond\'s Dock is tallied and pays while away, through the same code', () => {
    const g = beyond();
    const f = HIGH.beyond;
    const d = design(g, { depth: 4, outs: { quietEngine: 0.2 } });
    must(g, { k: 'hplace', floor: 'beyond', design: d.id, x: f.dock.x - 1, y: f.dock.y });
    must(g, { k: 'route', floor: 'beyond', fx: f.dock.x - 1, fy: f.dock.y, tx: f.dock.x, ty: f.dock.y, item: 'quietEngine' });
    g.step(30 * TICK_RATE);
    const c0 = g.s.coin;
    const rep = runOffline(g, 3 * 3600);
    expect(rep.sold.quietEngine!.toNumber()).toBeGreaterThan(0.2 * 3600 * 0.9);
    expect(rep.extrapolated).toBeGreaterThan(0);
    expect(g.s.coin.gt(c0)).toBe(true);
  });
});

describe('tier 5 (DESIGN.md §23)', () => {
  const T5: ItemId[] = ['bottledTuesday', 'mapOfEverywhere', 'verySmallSun', 'pocketIsland', 'quietEngine', 'foldedUniverse', 'everlastingSandwich', 'infiniteStaircase'];

  it('the contract\'s eight items, after tier 4 in ITEM_IDS', () => {
    expect(ITEM_IDS.slice(ITEM_IDS.indexOf('anchorChain') + 1)).toEqual(T5);
  });

  it('every tier 5 recipe pays 3-4x its inputs, Assembler Mk2 only, from tier 4 goods', () => {
    const t4 = new Set<string>(['skyglassLens', 'cinderAlloy', 'frostAlloy', 'relicGear', 'stormCell', 'sunsetDye', 'horizonLens', 'pocketWeather', 'sunsetGenerator']);
    for (const r of RECIPES.filter((q) => T5.includes(q.outputs[0].item))) {
      const inV = r.inputs.reduce((t, s) => t + s.n * ITEMS[s.item].value, 0);
      const x = ITEMS[r.outputs[0].item].value / inV;
      expect(x, r.id).toBeGreaterThanOrEqual(3);
      expect(x, r.id).toBeLessThanOrEqual(4);
      expect(r.mk2, r.id).toBe(true);
      expect(r.inputs.some((s) => t4.has(s.item) || T5.includes(s.item)), r.id).toBe(true);
    }
    // the Replica folds four ways, one an island
    expect(RECIPES.filter((r) => r.outputs[0].item === 'foldedUniverse').length).toBe(4);
  });

  it('each island\'s tier 5 research is offered there, with Beyond', () => {
    const g = isle('rime');
    megasDone(g);
    g.s.research.done = RESEARCH_IDS.filter((r) => r !== 'weatherBottling' && r !== 'cartography');
    expect(available(g, 'weatherBottling')).toBe(false);
    kernels(g, 'beyond');
    expect(available(g, 'weatherBottling')).toBe(true);
    expect(available(g, 'cartography')).toBe(false); // Pebble's
    expect(RECIPE.bottleTuesday.unlock).toBe('weatherBottling');
  });
});

describe('the Endless Ledger (DESIGN.md §23)', () => {
  it('order n wants (n + 1) x base of the products in turn; linear, never timed', () => {
    for (let n = 0; n < 30; n++) {
      const o = ledgerOrder(n);
      const p = LEDGER[n % LEDGER.length];
      expect(o.item).toBe(p.item);
      expect(o.want).toBe((n + 1) * p.base);
      expect(o.pays).toBe(o.want * ITEMS[p.item].value * LEDGER_RULES.pays);
      expect(o.cosmetic !== null).toBe((n + 1) % 10 === 0);
    }
    expect(ledgerOrder(9).cosmetic).toBe('gilded');
    expect(ledgerOrder(19).cosmetic).toBe('candy');
    expect(ledgerOrder(29).cosmetic).toBe('starlit');
    expect(cosmeticAt(3)).toBe('ribbon4');
  });

  it('fills from any Dock, pays, and moves on; every tenth pays a cosmetic', () => {
    const g = sandbox();
    kernels(g, 'endlessLedger');
    expect(currentLedger(g).item).toBe('gizmo');
    // a Factory Dock delivery counts
    const c0 = g.s.coin;
    expect(fillOrder(g, 'gizmo', N(350), 'factory').toNumber()).toBe(50);
    runOrders(g);
    expect(g.s.meta.ledger!.n).toBe(1);
    expect(g.s.coin.sub(c0).toNumber()).toBe(ledgerOrder(0).pays);
    expect(currentLedger(g).item).toBe('steel');
    expect(nextCosmetic(g).away).toBe(8);
    g.s.meta.ledger!.n = 9;
    const o = currentLedger(g);
    fillOrder(g, o.item, N(o.want), 'world');
    runOrders(g);
    expect(g.s.meta.cosmetics).toEqual(['gilded']);
    // kept through a reset
    design(g, { outs: { gear: 1 }, grade: { letter: 'S', score: 0.95, u: 1, w: 1, c: 1, mult: 2 } });
    must(g, { k: 'reorganize' });
    expect(g.s.meta.ledger!.n).toBe(10);
    expect(g.s.meta.cosmetics).toEqual(['gilded']);
  });
});

describe('Act V in saves (DESIGN.md §23)', () => {
  it('a v9 save migrates to v10: no Kernels, no Last Fold, the Ledger at its first order', () => {
    expect(SAVE_VERSION).toBe(10);
    const g = new Game(3);
    g.step(100);
    const p = savePayload(g, 0) as unknown as { v: number; snap: string };
    const st = JSON.parse(p.snap);
    for (const k of ['kernels', 'kernelsEarned', 'kernelNodes', 'lastFolds', 'seeds', 'keptLegacy', 'ledger', 'cosmetics']) delete st.meta[k];
    const old = { ...p, v: 9, snap: JSON.stringify(st) };
    const m = migrate(old) as unknown as { v: number; snap: string };
    expect(m.v).toBe(10);
    const meta = JSON.parse(m.snap).meta;
    expect(meta.kernels).toBe('N:0');
    expect(meta.lastFolds).toBe(0);
    expect(meta.ledger).toEqual({ n: 0, progress: {} });
    const h = restore(m as never);
    expect(h.s.meta.kernels!.toNumber()).toBe(0);
    expect(h.seeds.length).toBe(0);
  });

  it('a save in a new universe (the Seed, wide belts, Beyond) restores exactly and runs in step', () => {
    const { g } = graded();
    must(g, { k: 'lastFold' });
    kernels(g, 'wideBelts', 'beyond');
    g.s.coin = N(1e6);
    const s = g.seeds[0];
    // the Seed's iron onto a wide belt east (it backs up: two items a tile)
    for (let x = s.x + 1; x <= s.x + 2; x++) must(g, { k: 'place', kind: 'belt', x, y: s.y, rot: 0 });
    g.step(300);
    expect(g.entAt(s.x + 2, s.y)!.item2).toBe('ironOre');
    const h = restore(JSON.parse(JSON.stringify(savePayload(g, 0))));
    expect(fingerprint(h)).toBe(fingerprint(g));
    g.step(600);
    h.step(600);
    expect(fingerprint(h)).toBe(fingerprint(g));
  });

  it('seed + command log replays a whole-World audit, a Last Fold and Kernel nodes to the same state', () => {
    const setup = (seed: number) => {
      const g = sandbox('home', seed, true);
      worldAtWork(g);
      g.s.meta.kernels = N(20);
      return g;
    };
    const g = setup(17);
    const t0 = g.s.tick;
    g.step(100);
    must(g, { k: 'lastFoldAudit' });
    g.step(auditTicks(g));
    must(g, { k: 'lastFold' });
    must(g, { k: 'kernel', id: 'seedling' });
    must(g, { k: 'kernel', id: 'endlessLedger' });
    g.step(400);
    const h = setup(17);
    replayInto(h, g.history!.filter((l) => l.t > t0), g.s.tick);
    expect(fingerprint(h)).toBe(fingerprint(g));
    expect(h.s.meta.lastFolds).toBe(1);
    expect(h.seeds.length).toBe(1);
  });
});
