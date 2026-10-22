// Act IV (ROADMAP.md Milestone 9, DESIGN.md §22): the islands and their rules, the tier 4 chains,
// the World floor and its barges, Megaprojects #4 and #5, Relocate (what it keeps and loses), the
// Legacy preview and every Legacy node, offline on an island, the v9 migration and determinism.
import { describe, expect, it } from 'vitest';
import { Game, type Cmd } from '../src/sim/Game';
import { N, Num } from '../src/engine/num';
import { RESEARCH_IDS, RESEARCH } from '../src/data/research';
import { CHUNKS } from '../src/data/land';
import { HIGH, skiffRate } from '../src/data/floors';
import { BUILD, type BuildKind } from '../src/data/machines';
import { ITEMS, type ItemId } from '../src/data/items';
import { RECIPES } from '../src/data/recipes';
import { RULES } from '../src/data/rules';
import { WORLDS, OLD_RUBBLE, type WorldId } from '../src/data/worlds';
import { LEGACY, LEGACY_IDS, type LegacyId } from '../src/data/legacy';
import { PATENT_IDS, PATENTS } from '../src/data/patents';
import { TICK_RATE } from '../src/engine/time';
import { migrate, SAVE_VERSION } from '../src/engine/save';
import { startRun, designValue, previewPatents } from '../src/sim/reorganize';
import { previewLegacy, relocateRefusal, RELOCATE_KEPT, RELOCATE_LOST } from '../src/sim/relocate';
import { lrules } from '../src/sim/legacy';
import { isSky, isWarm, repairPrice, ISLAND_GOODS } from '../src/sim/systems/islands';
import { available } from '../src/sim/systems/research';
import { claimsHeld } from '../src/sim/systems/claims';
import { fillOrder } from '../src/sim/systems/docks';
import { offeredOrders } from '../src/sim/systems/orders';
import { drawerSlots, keepRefusal } from '../src/sim/drawer';
import { hentAt, megaDone, megaGiveX, megaStageOf, routeCap, skiffStats } from '../src/sim/systems/high';
import { runOffline } from '../src/sim/offline';
import { fingerprint, replayInto, savePayload, restore } from '../src/sim/snapshot';
import type { Ent, KeptDesign, ModuleDesign } from '../src/sim/world';

/** A fresh first run on an island (as a Relocate leaves it). */
function isle(world: WorldId, seed = 1, keepHistory = false) {
  const g = new Game(seed, keepHistory ? { keepHistory: true } : undefined);
  g.s.meta.world = world;
  if (!g.s.meta.visited!.includes(world)) g.s.meta.visited!.push(world);
  startRun(g);
  g.rebuild();
  return g;
}

/** Everything researched and paid for on an island; the start layout cleared but its Dock, Hopper
 * and furnace (and the Old Works' ruins). */
function sandbox(world: WorldId = 'home', seed = 1, keepHistory = false) {
  const g = isle(world, seed, keepHistory);
  grant(g);
  g.step(1);
  return g;
}

function grant(g: Game) {
  g.s.coin = N(1e9);
  g.s.land = CHUNKS.map((c) => c.id).filter((c) => !isSky(g, c));
  g.s.research.done = [...RESEARCH_IDS];
  g.s.upgrades.push('bellows');
  g.s.mega.stage = 3;
  if (!g.s.flags.includes('factoryOpen')) g.s.flags.push('factoryOpen');
  g.s.ents = g.s.ents.filter((e) => e.kind === 'dock' || e.kind === 'hopper' || e.kind === 'furnace' || e.ruined);
  g.rebuild();
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

/** Give Legacy and buy nodes. */
function legacy(g: Game, ...ids: LegacyId[]) {
  g.s.meta.legacy = (g.s.meta.legacy ?? Num.ZERO).add(ids.reduce((t, id) => t + LEGACY[id].cost, 0));
  for (const id of ids) must(g, { k: 'legacy', id });
}

const at = (g: Game, x: number, y: number) => g.entAt(x, y) as Ent;

// the Cinder line: a Miner on the sand (chunk E) into a Kiln beside the vent at (23, 5), its glass
// belted west along row 7 and up column 8 into the Dock (no belt beside a vent anywhere on it)
function sandLine(g: Game) {
  must(g, { k: 'place', kind: 'miner', x: 21, y: 5, rot: 0 });
  must(g, { k: 'place', kind: 'kiln', x: 22, y: 5, rot: 1 });
  must(g, { k: 'place', kind: 'belt', x: 22, y: 6, rot: 1 });
  for (let x = 22; x >= 9; x--) must(g, { k: 'place', kind: 'belt', x, y: 7, rot: 2 });
  for (let y = 7; y >= 3; y--) must(g, { k: 'place', kind: 'belt', x: 8, y, rot: 3 });
  must(g, { k: 'place', kind: 'belt', x: 8, y: 2, rot: 2 });
}

describe('the islands (DESIGN.md §22)', () => {
  it('every island has a rule, an exotic deposit and its tier 4 goods (Home has none)', () => {
    for (const w of Object.values(WORLDS)) {
      if (w.id === 'home') { expect(w.exotic).toBeNull(); continue; }
      expect(w.exotic && ITEMS[w.exotic].value).toBeGreaterThan(0);
      expect(w.goods.length).toBeGreaterThan(0);
      expect(w.patches.some((p) => p.item === w.exotic)).toBe(true);
    }
    expect(ISLAND_GOODS.has('horizonLens')).toBe(true);
  });

  it('island research is offered only on its island (Thermals on Rime)', () => {
    for (const w of ['home', 'rime'] as WorldId[]) {
      const g = isle(w);
      g.s.mega.stage = 3;
      g.s.research.done = RESEARCH_IDS.filter((r) => r !== 'thermals' && r !== 'frostWorks');
      expect(available(g, 'thermals'), w).toBe(w === 'rime');
      expect(available(g, 'frostWorks'), w).toBe(w === 'rime');
      expect(g.act({ k: 'research', id: 'thermals' }).ok, w).toBe(w === 'rime');
    }
  });

  it('Pebble Isle: C, D and F are sky, not for sale; Miners dig 1.5x', () => {
    const p = isle('pebble');
    p.s.coin = N(1e9);
    p.s.research.done = [...RESEARCH_IDS];
    for (const c of ['C', 'D', 'F']) {
      expect(isSky(p, c)).toBe(true);
      expect(p.act({ k: 'land', id: c }).ok).toBe(false);
    }
    expect(p.act({ k: 'land', id: 'B' }).ok).toBe(true);
    expect(p.act({ k: 'place', kind: 'belt', x: 2, y: 10, rot: 0 }).why).toMatch(/sky/i);
    // the same Miner, on the copper, into a crate, for 60 s at Home and on Pebble
    const dug = (w: WorldId) => {
      const g = sandbox(w);
      g.s.mega.stage = 0;
      must(g, { k: 'place', kind: 'miner', x: 11, y: 2, rot: 3 });
      must(g, { k: 'place', kind: 'crate', x: 11, y: 1, rot: 0 });
      g.step(60 * TICK_RATE);
      return at(g, 11, 2).crafts;
    };
    const home = dug('home'), pebble = dug('pebble');
    expect(home).toBeGreaterThanOrEqual(29);
    expect(pebble / home).toBeCloseTo(1.5, 1);
    // skyglass is dug from its own deposit
    const g = sandbox('pebble');
    must(g, { k: 'place', kind: 'miner', x: 9, y: 5, rot: 3 });
    must(g, { k: 'place', kind: 'crate', x: 9, y: 4, rot: 0 });
    g.step(10 * TICK_RATE);
    expect(at(g, 9, 4).store.filter((i) => i === 'skyglass').length).toBeGreaterThan(3);
  });

  it('Cinder Isle: a Kiln beside a vent runs with no power; no belt stands beside a vent', () => {
    const g = sandbox('cinder');
    expect(g.act({ k: 'place', kind: 'belt', x: 23, y: 4, rot: 0 }).why).toMatch(/melts/);
    expect(g.act({ k: 'place', kind: 'miner', x: 23, y: 5, rot: 0 }).why).toMatch(/vent/);
    expect(g.act({ k: 'place', kind: 'crate', x: 23, y: 4, rot: 0 }).why).toMatch(/Heat Shields/);
    sandLine(g);
    g.step(120 * TICK_RATE);
    expect(g.vented.has(at(g, 22, 5).id)).toBe(true);
    expect(g.s.delivered.glass?.toNumber() ?? 0).toBeGreaterThan(20);
    // the same line at Home has no grid: the Kiln waits on power
    const h = sandbox('home');
    sandLine(h);
    h.step(120 * TICK_RATE);
    expect(h.s.delivered.glass?.toNumber() ?? 0).toBe(0);
    expect(at(h, 22, 5).why).toBe('power');
  });

  it('Cinder Isle: a Generator beside a vent burns no fuel', () => {
    const g = sandbox('cinder');
    must(g, { k: 'place', kind: 'generator', x: 9, y: 4, rot: 0 }); // the vent at (10, 4)
    must(g, { k: 'place', kind: 'pole', x: 9, y: 6, rot: 0 });
    must(g, { k: 'place', kind: 'miner', x: 20, y: 6, rot: 2 });
    must(g, { k: 'place', kind: 'kiln', x: 19, y: 6, rot: 2 });
    // a pole chain from the generator to the kiln (link 6)
    for (const x of [14, 18]) must(g, { k: 'place', kind: 'pole', x, y: 7, rot: 0 });
    must(g, { k: 'place', kind: 'crate', x: 18, y: 6, rot: 2 });
    g.step(60 * TICK_RATE);
    expect(at(g, 19, 6).crafts).toBeGreaterThan(15);
    expect(at(g, 9, 4).crafts).toBe(0); // never took a coal
  });

  it('Rime: a powered machine alone runs at half speed; a working plant within reach or two working neighbours warm it', () => {
    // a Kiln fed by hand at (9, 6), powered by a stocked Generator `gx, gy` through two Poles, for 60 s
    const run = (gx: number, gy: number, setup: (g: Game) => void = () => {}, thermals = false) => {
      const g = sandbox('rime');
      if (!thermals) g.s.research.done = g.s.research.done.filter((r) => r !== 'thermals');
      must(g, { k: 'place', kind: 'generator', x: gx, y: gy, rot: 0 });
      must(g, { k: 'place', kind: 'pole', x: gx + 1, y: gy + 1, rot: 0 });
      must(g, { k: 'place', kind: 'pole', x: 10, y: 7, rot: 0 });
      must(g, { k: 'place', kind: 'kiln', x: 9, y: 6, rot: 0 });
      must(g, { k: 'place', kind: 'crate', x: 10, y: 6, rot: 0 });
      setup(g);
      const kilns = g.s.ents.filter((e) => e.kind === 'kiln');
      for (const k of kilns) k.recipe = 'fireGlass';
      for (let t = 0; t < 60 * TICK_RATE; t++) {
        at(g, gx, gy).inBuf.coal = 2;
        for (const k of kilns) k.inBuf.sand = 4;
        g.tick();
      }
      return { g, crafts: at(g, 9, 6).crafts };
    };
    // the plant 5 tiles off: out of reach, the Kiln cold
    const cold = run(9, 1);
    expect(at(cold.g, 9, 1).state).toBe('work');
    expect(at(cold.g, 9, 6).cold).toBe(true);
    // the plant 2 tiles off (a Pole's reach): warm, twice the crafts
    const warm = run(9, 4);
    expect(at(warm.g, 9, 6).cold).toBeFalsy();
    expect(warm.crafts / cold.crafts).toBeCloseTo(2, 0);
    // 3 tiles off: cold, until Thermals spreads the plant's warmth to 3
    expect(at(run(9, 3).g, 9, 6).cold).toBe(true);
    expect(at(run(9, 3, undefined, true).g, 9, 6).cold).toBeFalsy();
    // a plant with no coal is no warmer than none
    const out = sandbox('rime');
    must(out, { k: 'place', kind: 'generator', x: 9, y: 4, rot: 0 });
    must(out, { k: 'place', kind: 'kiln', x: 9, y: 6, rot: 0 });
    expect(isWarm(out, at(out, 9, 6))).toBe(false);
    // two working Kilns touching it, each emptying into its own crate, the plant out of reach
    const packed = run(9, 1, (g) => {
      must(g, { k: 'place', kind: 'kiln', x: 8, y: 6, rot: 2 });
      must(g, { k: 'place', kind: 'crate', x: 7, y: 6, rot: 2 });
      must(g, { k: 'place', kind: 'kiln', x: 9, y: 7, rot: 1 });
      must(g, { k: 'place', kind: 'crate', x: 9, y: 8, rot: 0 });
    });
    expect(at(packed.g, 9, 6).cold).toBeFalsy();
    expect(at(packed.g, 8, 6).cold).toBe(true); // one neighbour is not enough
    expect(packed.crafts / cold.crafts).toBeGreaterThan(1.7);
    // there is no Heater to build any more
    expect('heater' in BUILD).toBe(false);
    // at Home no machine is ever cold
    const h = sandbox('home');
    must(h, { k: 'place', kind: 'kiln', x: 9, y: 6, rot: 0 });
    h.step(5);
    expect(at(h, 9, 6).cold).toBeFalsy();
  });

  it('the Old Works: rubble refuses building and clears for coin; ruins repair for a quarter, research or not', () => {
    const g = isle('oldworks');
    expect(g.s.rubble!.length).toBe(OLD_RUBBLE.length);
    expect(OLD_RUBBLE.length).toBeGreaterThan(100);
    const ruins = g.s.ents.filter((e) => e.ruined);
    expect(ruins.length).toBe(WORLDS.oldworks.ruins!.filter((r) => r.ruined).length);
    // a tile of rubble in chunk A
    const i = OLD_RUBBLE.find((q) => q % 24 < 8 && Math.floor(q / 24) < 8 && !g.entAt(q % 24, Math.floor(q / 24)))!;
    const x = i % 24, y = Math.floor(i / 24);
    g.s.coin = N(100);
    expect(g.act({ k: 'place', kind: 'belt', x, y, rot: 0 }).why).toMatch(/Rubble/);
    must(g, { k: 'clear', x, y });
    expect(g.s.coin.toNumber()).toBe(95);
    must(g, { k: 'place', kind: 'belt', x, y, rot: 0 });
    // the Mk2 smelter ruin stands in Act I, and repairs for a quarter of its price
    const mk2 = at(g, 1, 5);
    expect(mk2.kind).toBe('smelterMk2');
    expect(repairPrice(g, mk2)).toBe(Math.ceil(BUILD.smelterMk2.cost * RULES.ruinRepair.value));
    // at Home a Mk2 can't be built without its research
    const h = new Game(1);
    h.s.coin = N(1e6);
    expect(h.act({ k: 'place', kind: 'smelterMk2', x: 9, y: 9, rot: 0 }).ok).toBe(false);
  });

  it('the Old Works: a cleared tile stays clear through a Reorganize and a Relocate back; a new universe lays it again', () => {
    const g = isle('oldworks');
    g.s.coin = N(1e4);
    const cleared = OLD_RUBBLE.filter((q) => q % 24 < 8 && Math.floor(q / 24) < 8 && !g.entAt(q % 24, Math.floor(q / 24))).slice(0, 3);
    for (const i of cleared) must(g, { k: 'clear', x: i % 24, y: Math.floor(i / 24) });
    expect(g.s.meta.cleared!.tiles.oldworks).toEqual([...cleared].sort((a, b) => a - b));
    // a Reorganize ends in a fresh run here (startRun)
    startRun(g);
    expect(g.s.rubble!.length).toBe(OLD_RUBBLE.length - cleared.length);
    for (const i of cleared) expect(g.s.rubble).not.toContain(i);
    // to Pebble and back: still clear (the island's record, this universe)
    g.s.meta.world = 'pebble';
    startRun(g);
    expect(g.s.rubble).toBeUndefined();
    g.s.meta.world = 'oldworks';
    startRun(g);
    for (const i of cleared) expect(g.s.rubble).not.toContain(i);
    // a new universe (a Last Fold taken): the island is laid again whole
    g.s.meta.lastFolds = 1;
    startRun(g);
    expect(g.s.rubble!.length).toBe(OLD_RUBBLE.length - 1 + (OLD_RUBBLE.includes(RULES.seedY.value * 24 + RULES.seedX.value) ? 0 : 1));
    for (const i of cleared) expect(g.s.rubble).toContain(i);
  });

  it('the Old Works: the ruined iron line runs once repaired, with no research (a fold Home has not reached yet)', () => {
    const g = isle('oldworks');
    g.s.coin = N(1e4);
    g.s.land.push('C');
    g.rebuild();
    for (const [x, y] of [[3, 11], [3, 12], [4, 11], [6, 11]]) must(g, { k: 'repair', x, y });
    expect(g.s.research.done).not.toContain('pressing');
    g.step(60 * TICK_RATE);
    expect(at(g, 6, 11).crafts).toBeGreaterThan(0);
    expect(at(g, 4, 11).crafts).toBeGreaterThan(10);
    // the box folds once Folding is known; a ruin left in the box refuses it
    const g2 = isle('oldworks');
    g2.s.research.done = ['folding'];
    g2.s.land.push('C');
    g2.rebuild();
    expect(g2.act({ k: 'audit', x: 3, y: 11, w: 2, h: 2 }).why).toMatch(/ruined/);
  });
});

describe('tier 4 (DESIGN.md §22)', () => {
  const act4 = RECIPES.filter((r) => r.unlock && (RESEARCH[r.unlock as keyof typeof RESEARCH]?.act ?? 0) === 4 && r.machine !== 'miner');

  it('every tier 4 good sells for 3-4x what goes into it', () => {
    for (const r of act4) {
      const out = ITEMS[r.outputs[0].item].value * r.outputs[0].n;
      if (!out) continue;
      const ins = r.inputs.reduce((t, s) => t + ITEMS[s.item].value * s.n, 0);
      expect(out / ins, r.id).toBeGreaterThanOrEqual(3);
      expect(out / ins, r.id).toBeLessThanOrEqual(4);
    }
  });

  it('every tier 4 recipe crafts in its machine (beside a Cinder vent, fed by hand)', () => {
    for (const r of act4) {
      const g = sandbox('cinder');
      const kind = (Object.keys(BUILD) as BuildKind[]).find((k) => BUILD[k].machine === r.machine && (k as string) !== 'furnace' && ((BUILD[k].speed ?? 1) > 1) === !!r.mk2)!;
      const big = BUILD[kind].w > 1;
      const [x, y] = big ? [17, 4] : [22, 5];
      must(g, { k: 'place', kind, x, y, rot: 1 });
      const m = at(g, x, y);
      m.recipe = r.id;
      for (let t = 0; t < (r.time / (BUILD[kind].speed ?? 1) + 2) * TICK_RATE; t++) {
        for (const s of r.inputs) m.inBuf[s.item] = s.n * 2;
        g.tick();
      }
      expect(g.vented.has(m.id), r.id).toBe(true);
      expect(m.crafts, `${r.id} in a ${kind}`).toBeGreaterThanOrEqual(1);
    }
  });
});

describe('the World floor (DESIGN.md §22)', () => {
  it('opens with Charting and takes the District\'s folds (depth 3), not depth 2', () => {
    const g = sandbox();
    expect(g.s.world).toBeTruthy();
    expect(g.s.meta.here!.opened).toBe(true);
    const h = isle('home');
    grant(h);
    h.s.research.done = RESEARCH_IDS.filter((r) => r !== 'charting');
    h.step(2);
    expect(h.s.world).toBeUndefined();
    const d2 = design(g, { depth: 2, outs: { robotArm: 0.1 } });
    const d3 = design(g, { depth: 3, outs: { robotArm: 0.1 } });
    expect(g.act({ k: 'hplace', floor: 'world', design: d2.id, x: 2, y: 2 }).why).toMatch(/depth-3/);
    must(g, { k: 'hplace', floor: 'world', design: d3.id, x: 2, y: 2 });
    // a World fold is the Last Fold, Act V's
    expect(g.act({ k: 'haudit', floor: 'world', x: 0, y: 0, w: 4, h: 4 }).ok).toBe(false);
  });

  it('barges fly load / (2 x distance / speed + dwell): beside the Dock 0.92/s, across the floor about 0.16', () => {
    const g = sandbox();
    const f = HIGH.world;
    expect(skiffRate(f, 1)).toBeCloseTo(2 / (2 / 3 + 1.5), 6);
    expect(skiffRate(f, 1)).toBeCloseTo(0.92, 2);
    expect(skiffRate(f, 5)).toBeCloseTo(0.41, 2);
    expect(skiffRate(f, 17)).toBeCloseTo(0.16, 2); // across the floor with its lots
    const d = design(g, { depth: 3, outs: { robotArm: 0.5 } });
    must(g, { k: 'hplace', floor: 'world', design: d.id, x: f.dock.x - 1, y: f.dock.y });
    must(g, { k: 'route', floor: 'world', fx: f.dock.x - 1, fy: f.dock.y, tx: f.dock.x, ty: f.dock.y, item: 'robotArm' });
    const r = g.s.world!.routes[0];
    expect(routeCap(g, 'world', r)).toBeCloseTo(skiffRate(f, 1.5811), 3);
    const c0 = g.s.coin;
    g.step(60 * TICK_RATE);
    expect(g.s.delivered.robotArm?.toNumber() ?? 0).toBeGreaterThan(20);
    expect(g.s.coin.gt(c0)).toBe(true);
  });

  it('modules on the World pause, singly or by their routes', () => {
    const g = sandbox();
    const d = design(g, { depth: 3, outs: { robotArm: 0.5 } });
    must(g, { k: 'hplace', floor: 'world', design: d.id, x: 3, y: 3 });
    must(g, { k: 'pause', floor: 'world', x: 3, y: 3, on: true });
    expect(hentAt(g, 'world', 3, 3)!.paused).toBe(true);
    must(g, { k: 'pause', floor: 'world', x: 3, y: 3, on: false });
    expect(hentAt(g, 'world', 3, 3)!.paused).toBeFalsy();
  });
});

describe('Megaprojects #4 and #5 (DESIGN.md §22)', () => {
  it('the Lighthouse builds each island\'s stage on that island, in any order; its rewards are rules kept for good', () => {
    const g = sandbox('pebble');
    g.step(TICK_RATE);
    const bay = g.s.world!.ents.find((e) => e.kind === 'fbay')!;
    expect(bay).toBeTruthy();
    expect(megaStageOf(g, 'lighthouse')!.world).toBe('pebble');
    expect(megaGiveX(g, 'world', bay, 'lighthouseLamp', 150)).toBe(0);
    expect(megaGiveX(g, 'world', bay, 'horizonLens', 200)).toBe(0);
    expect(megaDone(g, 'lighthouse', 1)).toBe(true);
    expect(g.s.meta.here!.stages).toBe(1);
    expect(skiffStats(g, 'world').speed).toBe(HIGH.world.speed + RULES.lighthouseSpeed.value);
    expect(megaStageOf(g, 'lighthouse')).toBeNull(); // nothing more here
    // on Cinder the Beacon (stage 2) is built next, though stage 3 and 4 wait elsewhere
    must(g, { k: 'relocate', world: 'cinder' });
    grant(g);
    g.step(TICK_RATE);
    expect(megaStageOf(g, 'lighthouse')!.stage).toBe(2);
    expect(megaDone(g, 'lighthouse', 1)).toBe(true); // kept through the Relocate
    const b2 = g.s.world!.ents.find((e) => e.kind === 'fbay')!;
    megaGiveX(g, 'world', b2, 'lighthouseLamp', 150);
    megaGiveX(g, 'world', b2, 'sunsetDye', 800);
    expect(megaDone(g, 'lighthouse', 2)).toBe(true);
    expect(skiffStats(g, 'district').dwell).toBeCloseTo(HIGH.district.dwell * RULES.lighthouseDwell.value, 9);
  });

  it('a stage left half built waits on its island through a Relocate', () => {
    const g = sandbox('rime');
    g.step(TICK_RATE);
    const bay = g.s.world!.ents.find((e) => e.kind === 'fbay')!;
    megaGiveX(g, 'world', bay, 'anchorChain', 40);
    expect(g.s.megas!.anchor!.progress.anchorChain!.toNumber()).toBe(40);
    must(g, { k: 'relocate', world: 'pebble' });
    expect(Object.keys(g.s.megas!.anchor!.progress)).toEqual([]);
    expect(g.s.megas!.anchor!.held![3].anchorChain!.toNumber()).toBe(40);
  });

  it('the Sky Anchor keeps the annex through a Reorganize (stage 1), and lots and annex through a Relocate (stage 4)', () => {
    const g = sandbox('pebble');
    g.step(TICK_RATE);
    const bay = g.s.world!.ents.find((e) => e.kind === 'fbay')!;
    megaGiveX(g, 'world', bay, 'anchorChain', 150);
    megaGiveX(g, 'world', bay, 'skyglassLens', 1200);
    expect(megaDone(g, 'anchor', 1)).toBe(true);
    must(g, { k: 'annex' });
    must(g, { k: 'annex' });
    design(g, { outs: { gear: 1 }, grade: { letter: 'S', score: 0.95, u: 1, w: 1, c: 1, mult: 2 } });
    must(g, { k: 'reorganize' });
    expect(g.s.annex).toBe(2);
  });
});

describe('Relocate (DESIGN.md §22)', () => {
  it('is refused until Relocation is researched and the World floor has stood in this world', () => {
    const g = isle('home');
    expect(relocateRefusal(g, 'pebble')).toMatch(/Relocation/);
    g.s.research.done = ['relocation'];
    expect(relocateRefusal(g, 'pebble')).toMatch(/World floor/);
    const s = sandbox();
    expect(relocateRefusal(s, 'home')).toMatch(/already/);
    expect(relocateRefusal(s, 'pebble')).toBeNull();
  });

  it('keeps Legacy, Megaprojects, reputation, the Codex, the Drawer, trophies, lifetime, Challenges won, the records; loses the rest and the Patents', () => {
    const g = sandbox();
    const m = g.s.meta;
    m.patents = N(40);
    m.nodes = [PATENT_IDS[0], PATENT_IDS[1]];
    m.patented = { gear: { value: 3, steps: 2, grade: 'A', tier: 0, run: 1 } };
    g.s.orders.rep.bramble = 3;
    g.s.codex = ['gear'];
    g.s.megas = { city: { stage: 1, progress: {} } };
    g.s.flags.push('trophy:test');
    m.challenges = ['smallBoxes'];
    const kd: KeptDesign = { id: m.nextKept++, name: 'Kept', x: 0, y: 0, w: 1, h: 1, parts: [], product: null, grade: null, rate: 0, run: 1 };
    m.drawer.push(kd);
    design(g, { outs: { gear: 1 } });
    const before = previewLegacy(g, 'pebble').now;
    expect(before).toBeGreaterThanOrEqual(RULES.legacyNewIsland.value);
    must(g, { k: 'relocate', world: 'pebble' });
    expect(m.world).toBe('pebble');
    expect(m.legacy!.toNumber()).toBe(before);
    expect(m.legacyEarned!.toNumber()).toBe(before);
    expect(m.patents.toNumber()).toBe(0);
    expect(m.nodes).toEqual([]);
    expect(m.patented).toEqual({});
    expect(g.s.orders.rep.bramble).toBe(3);
    expect(g.s.codex).toEqual(['gear']);
    expect(g.s.megas!.city!.stage).toBe(1);
    expect(g.s.flags).toContain('trophy:test');
    expect(m.challenges).toEqual(['smallBoxes']);
    expect(m.drawer.map((k) => k.id)).toContain(kd.id);
    expect(m.visited).toEqual(['home', 'pebble']);
    expect(m.relocations).toBe(1);
    expect(m.worldRecords!.home!.workshop).toBeTruthy();
    expect(m.history[m.history.length - 1].relocate).toBe('pebble');
    // the run is a fresh one: chunk A, no research, the start layout, no designs
    expect(g.s.land).toEqual(['A']);
    expect(g.s.research.done).toEqual([]);
    expect(g.s.designs).toEqual([]);
    expect(g.s.world).toBeUndefined();
    expect(RELOCATE_KEPT.length).toBeGreaterThan(4);
    expect(RELOCATE_LOST.length).toBeGreaterThan(2);
    // the World must stand again on the new island first
    g.s.research.done = ['relocation'];
    expect(relocateRefusal(g, 'cinder')).toMatch(/World floor/);
  });

  it('Legacy = floor(sum of each floor\'s best value / 4 + 3 x stages + 5 for a new island)', () => {
    const g = sandbox();
    const w = design(g, { depth: 1, ins: { ironIngot: 0.5 }, outs: { gear: 0.5 }, grade: { letter: 'A', score: 0.85, u: 1, w: 1, c: 1, mult: 1.5 } });
    const f = design(g, { depth: 2, ins: {}, outs: { gizmo: 0.25 } });
    const d = design(g, { depth: 3, ins: {}, outs: { motor: 0.1 } });
    const vals = [w, f, d].map((q) => designValue(q)!.value);
    // the World's best counts once a module has run there 60 s at half speed or better
    const wd = design(g, { depth: 3, ins: {}, outs: { robotArm: 0.1 } });
    const wdk = HIGH.world.dock;
    must(g, { k: 'hplace', floor: 'world', design: wd.id, x: wdk.x - 1, y: wdk.y });
    must(g, { k: 'route', floor: 'world', fx: wdk.x - 1, fy: wdk.y, tx: wdk.x, ty: wdk.y, item: 'robotArm' });
    let p = previewLegacy(g, 'pebble');
    expect(p.floors.world).toBeNull();
    g.step(65 * TICK_RATE);
    p = previewLegacy(g, 'pebble');
    expect(p.floors.world!.item).toBe('robotArm');
    g.s.meta.here!.stages = 2;
    // the District's best is the better of its two folds; the one at work on the World counts there too
    const vw = designValue(wd)!.value;
    const sum = vals[0] + vals[1] + Math.max(vals[2], vw) + vw;
    p = previewLegacy(g, 'pebble');
    expect(p.value).toBeCloseTo(sum, 6);
    expect(p.now).toBe(Math.floor(sum / 4 + 3 * 2 + 5 + 1e-9));
    // a depth-3 fold files a step deeper than the same chain folded at depth 2 (the second gate)
    const d2 = design(g, { depth: 2, ins: {}, outs: { motor: 0.1 } });
    expect(designValue(d)!.steps).toBe(designValue(d2)!.steps + RULES.highFoldSteps.value);
    // a visited island gives no first-visit bonus
    g.s.meta.visited!.push('pebble');
    expect(previewLegacy(g, 'pebble').newIsland).toBe(0);
    expect(previewLegacy(g).target).toBe('cinder');
  });

  it('the World\'s bests survive a Reorganize within the world', () => {
    const g = sandbox();
    design(g, { depth: 2, outs: { gizmo: 0.25 } });
    design(g, { outs: { gear: 1 } });
    const v = previewLegacy(g, 'pebble').value;
    must(g, { k: 'reorganize' });
    expect(previewLegacy(g, 'pebble').value).toBeCloseTo(v, 6);
  });
});

describe('the Legacy tree (DESIGN.md §22): every node', () => {
  /** A sandbox ready to Relocate, the given nodes bought. */
  const ready = (...ids: LegacyId[]) => {
    const g = sandbox();
    legacy(g, ...ids);
    return g;
  };

  it('has flat prices and is about 100 Legacy in all', () => {
    const total = LEGACY_IDS.reduce((t, id) => t + LEGACY[id].cost, 0);
    expect(total).toBeGreaterThan(80);
    expect(total).toBeLessThan(130);
    const g = sandbox();
    g.s.meta.legacy = N(3);
    expect(g.act({ k: 'legacy', id: 'patentPurse' }).why).toMatch(/Costs 4/);
    expect(g.act({ k: 'legacy', id: 'secondNature' }).why).toMatch(/Old Habits/);
  });

  it('the Patent Purse: a new island starts with 10 Patents', () => {
    const g = ready('patentPurse');
    must(g, { k: 'relocate', world: 'pebble' });
    expect(g.s.meta.patents.toNumber()).toBe(10);
  });

  it('Old Habits and Second Nature: the chosen Patent nodes survive a Relocate', () => {
    const g = ready('oldHabits');
    const m = g.s.meta;
    m.nodes = PATENT_IDS.slice(0, 6) as never;
    for (const id of PATENT_IDS.slice(0, 4)) must(g, { k: 'habit', id });
    expect(g.act({ k: 'habit', id: PATENT_IDS[4] }).why).toMatch(/keeps 4/);
    must(g, { k: 'relocate', world: 'pebble' });
    expect(m.nodes).toEqual(PATENT_IDS.slice(0, 4));
    legacy(g, 'secondNature');
    expect(lrules(g).habitSlots).toBe(12);
  });

  it('the Town Archive: every run starts knowing Act I', () => {
    const g = ready('patentPurse', 'townArchive');
    must(g, { k: 'relocate', world: 'pebble' });
    const act1 = RESEARCH_IDS.filter((r) => (RESEARCH[r].act ?? 1) === 1);
    for (const r of act1) expect(g.s.research.done).toContain(r);
  });

  it('Standing Charts: a later run in a world whose World floor stood knows Charting; a new island does not', () => {
    const g = ready('patentPurse', 'townArchive', 'standingCharts');
    design(g, { outs: { gear: 1 }, grade: { letter: 'S', score: 0.95, u: 1, w: 1, c: 1, mult: 2 } });
    must(g, { k: 'reorganize' });
    expect(g.s.research.done).toContain('charting');
    const h = ready('patentPurse', 'townArchive', 'standingCharts');
    must(h, { k: 'relocate', world: 'cinder' });
    expect(h.s.research.done).not.toContain('charting');
  });

  it('the Patent Clerk buys open Patent nodes in the tree\'s order', () => {
    const g = ready('patentClerk');
    g.s.meta.patents = N(3);
    g.step(RULES.legacyEvery.value * TICK_RATE + 1);
    expect(g.s.meta.nodes.length).toBeGreaterThan(0);
    const spent = g.s.meta.nodes.reduce((t, id) => t + PATENTS[id].cost, 0);
    expect(spent + g.s.meta.patents.toNumber()).toBe(3);
  });

  it('the Standing Committee Reorganizes by itself at the number set', () => {
    const g = ready('patentClerk', 'standingCommittee');
    expect(g.act({ k: 'standing', at: 0 }).ok).toBe(false);
    must(g, { k: 'standing', at: 1 });
    design(g, { outs: { gear: 1 }, grade: { letter: 'S', score: 0.95, u: 1, w: 1, c: 1, mult: 2 } });
    expect(previewPatents(g).now).toBeGreaterThanOrEqual(1);
    const runs = g.s.meta.runs;
    g.step(RULES.standingEvery.value * TICK_RATE + 1);
    expect(g.s.meta.runs).toBe(runs + 1);
    // off again: no more resets
    must(g, { k: 'standing', at: null });
    design(g, { outs: { gear: 1 }, grade: { letter: 'S', score: 0.95, u: 1, w: 1, c: 1, mult: 2 } });
    g.step(RULES.standingEvery.value * TICK_RATE + 1);
    expect(g.s.meta.runs).toBe(runs + 1);
  });

  it('the Regrader unfolds a kept design, audits it and folds it by itself at a run\'s start', () => {
    const g = ready('regrader');
    // an iron line in chunk A, belted into the Dock, folded and kept
    must(g, { k: 'place', kind: 'heap', x: 2, y: 0, rot: 0 });
    must(g, { k: 'place', kind: 'smelter', x: 2, y: 1, rot: 0 });
    must(g, { k: 'place', kind: 'miner', x: 2, y: 2, rot: 3 });
    for (let x = 3; x <= 5; x++) must(g, { k: 'place', kind: 'belt', x, y: 1, rot: 0 });
    g.step(10 * TICK_RATE);
    must(g, { k: 'audit', x: 2, y: 0, w: 4, h: 3 });
    for (let i = 0; i < 400 && !g.s.audits[0].result; i++) g.step(TICK_RATE);
    must(g, { k: 'fold', name: 'Ingots' });
    const d = g.s.designs[g.s.designs.length - 1];
    must(g, { k: 'keep', id: d.id });
    design(g, { outs: { gear: 1 }, grade: { letter: 'S', score: 0.95, u: 1, w: 1, c: 1, mult: 2 } });
    must(g, { k: 'reorganize' });
    expect(g.s.designs).toEqual([]);
    g.s.coin = N(1e6);
    g.s.research.done = [...RESEARCH_IDS];
    g.step(60 * TICK_RATE);
    // unchanged and fed, it refolded at its kept grade after the 10 s check (no full audit)
    expect(g.s.counters.quickRefolds).toBeGreaterThanOrEqual(1);
    expect(g.s.designs.some((q) => q.name === 'Ingots')).toBe(true);
    expect(g.s.audits).toEqual([]);
    expect(g.s.counters.regraderUnfolds).toBe(1);
  });

  it('the Town Plan places a kept District layout again, routes and skiffs, as copies exist', () => {
    const g = ready('regrader', 'townPlan');
    const a = design(g, { depth: 2, outs: { steel: 1 } });
    const b = design(g, { depth: 2, ins: { steel: 1 }, outs: { gearbox: 0.1 } });
    must(g, { k: 'hplace', floor: 'district', design: a.id, x: 3, y: 3 });
    must(g, { k: 'hplace', floor: 'district', design: b.id, x: 4, y: 3 });
    must(g, { k: 'route', floor: 'district', fx: 3, fy: 3, tx: 4, ty: 3, item: 'steel' });
    must(g, { k: 'skiff', floor: 'district', id: g.s.district!.routes[0].id, n: 1 });
    must(g, { k: 'keepPlan', name: 'Gearboxes' });
    design(g, { outs: { gear: 1 }, grade: { letter: 'S', score: 0.95, u: 1, w: 1, c: 1, mult: 2 } });
    must(g, { k: 'reorganize' });
    expect(g.s.meta.plans!.length).toBe(1);
    grant(g);
    design(g, { depth: 2, outs: { steel: 1 } });
    design(g, { depth: 2, ins: { steel: 1 }, outs: { gearbox: 0.1 } });
    g.step(RULES.legacyEvery.value * TICK_RATE + 2);
    expect(hentAt(g, 'district', 3, 3)?.kind).toBe('module');
    expect(hentAt(g, 'district', 4, 3)?.kind).toBe('module');
    expect(g.s.district!.routes.length).toBe(1);
    expect(g.s.district!.routes[0].skiffs).toBe(2);
  });

  it('the Town Plan keeps and places the World layout too, barges and all (every high floor)', () => {
    const g = ready('regrader', 'townPlan');
    const a = design(g, { depth: 3, outs: { steel: 1 } });
    const b = design(g, { depth: 3, ins: { steel: 1 }, outs: { gearbox: 0.1 } });
    const c = design(g, { depth: 2, outs: { gear: 1 } });
    must(g, { k: 'hplace', floor: 'world', design: a.id, x: 3, y: 3 });
    must(g, { k: 'hplace', floor: 'world', design: b.id, x: 4, y: 3 });
    must(g, { k: 'route', floor: 'world', fx: 3, fy: 3, tx: 4, ty: 3, item: 'steel' });
    must(g, { k: 'skiff', floor: 'world', id: g.s.world!.routes[0].id, n: 1 });
    must(g, { k: 'hplace', floor: 'district', design: c.id, x: 2, y: 2 });
    must(g, { k: 'keepPlan', name: 'Both floors' });
    const plan = g.s.meta.plans![0];
    expect(plan.tiles.filter((t) => t.floor === 'world').length).toBe(2);
    expect(plan.tiles.filter((t) => !t.floor).length).toBe(1);
    expect(plan.routes[0].floor).toBe('world');
    must(g, { k: 'reorganize' });
    grant(g);
    design(g, { depth: 3, outs: { steel: 1 } });
    design(g, { depth: 3, ins: { steel: 1 }, outs: { gearbox: 0.1 } });
    design(g, { depth: 2, outs: { gear: 1 } });
    g.step(RULES.legacyEvery.value * TICK_RATE + 2);
    expect(hentAt(g, 'world', 3, 3)?.kind).toBe('module');
    expect(hentAt(g, 'world', 4, 3)?.kind).toBe('module');
    expect(hentAt(g, 'district', 2, 2)?.kind).toBe('module');
    expect(hentAt(g, 'district', 3, 3)).toBeFalsy(); // a World tile is not placed on the District
    expect(g.s.world!.routes.length).toBe(1);
    expect(g.s.world!.routes[0].skiffs).toBe(2);
  });

  it('Contract Runners: every offered order fills from every Dock at once', () => {
    const g = ready('contractRunners');
    const offered = offeredOrders(g);
    expect(offered.length).toBeGreaterThan(1);
    const a = offered[0], b = offered[1];
    must(g, { k: 'order', id: a.id });
    const item = Object.keys(b.wants)[0] as ItemId;
    const left = fillOrder(g, item, N(1e6), 'factory');
    expect(g.s.orders.progress[b.id]?.[item]?.toNumber()).toBe(b.wants[item]);
    expect(left.lt(1e6)).toBe(true);
    for (const [it, n] of Object.entries(b.wants)) fillOrder(g, it as ItemId, N(n as number), 'factory');
    g.step(1);
    expect(g.s.orders.done).toContain(b.id);
    expect(g.s.orders.active).toBe(a.id);
  });

  it('the Skiff Guild: a route starts with a second skiff, free, and it is not refunded', () => {
    const g = ready('skiffGuild');
    const d = design(g, { depth: 2, outs: { steel: 1 } });
    must(g, { k: 'hplace', floor: 'district', design: d.id, x: 3, y: 3 });
    const c0 = g.s.coin;
    must(g, { k: 'route', floor: 'district', fx: 3, fy: 3, tx: HIGH.district.dock.x, ty: HIGH.district.dock.y, item: 'steel' });
    const r = g.s.district!.routes[0];
    expect(r.skiffs).toBe(2);
    expect(c0.sub(g.s.coin).toNumber()).toBe(HIGH.district.skiffCost);
    // the paid skiff comes off and is refunded; the Guild's stays with the route, and is never refunded
    must(g, { k: 'skiff', floor: 'district', id: r.id, n: -1 });
    expect(g.s.coin.eq(c0)).toBe(true);
    expect(g.act({ k: 'skiff', floor: 'district', id: r.id, n: -1 }).ok).toBe(false);
    must(g, { k: 'unroute', floor: 'district', id: r.id });
    expect(g.s.coin.eq(c0)).toBe(true);
  });

  it('A Longer Drawer holds 4 more; the Group Drawer keeps a nested design and unfolds it from spare copies', () => {
    const g = ready('longerDrawer');
    const slots0 = drawerSlots(g) - 4;
    expect(lrules(g).drawerAdd).toBe(4);
    expect(slots0).toBeGreaterThan(0);
    const sub = design(g, { outs: { gear: 1 }, spare: 0 });
    const nested = design(g, { depth: 2, outs: { gizmo: 0.2 }, box: { x: 1, y: 1, w: 2, h: 1 }, fparts: [{ kind: 'module', design: sub.id, dx: 0, dy: 0, rot: 0 }, { kind: 'trunk', design: 0, dx: 1, dy: 0, rot: 0 }] });
    expect(keepRefusal(g, nested.id)).toMatch(/Group Drawer/);
    legacy(g, 'groupDrawer');
    must(g, { k: 'keep', id: nested.id });
    const k = g.s.meta.drawer[g.s.meta.drawer.length - 1];
    expect(k.nested![0].item).toBe('gear');
    design(g, { outs: { gear: 1 }, grade: { letter: 'S', score: 0.95, u: 1, w: 1, c: 1, mult: 2 } });
    must(g, { k: 'reorganize' });
    grant(g);
    expect(g.act({ k: 'unfoldKept', id: k.id }).why).toMatch(/spare module making gear/);
    const gear = design(g, { outs: { gear: 1 }, spare: 1 });
    must(g, { k: 'unfoldKept', id: k.id });
    expect(g.fentAt(1, 1)?.design).toBe(gear.id);
    expect(g.fentAt(2, 1)?.kind).toBe('trunk');
    expect(gear.spare).toBe(0);
  });

  it('Sky Moorings: Pebble\'s chunk F is land again', () => {
    const g = isle('pebble');
    expect(isSky(g, 'F')).toBe(true);
    legacy(g, 'skyMoorings');
    expect(isSky(g, 'F')).toBe(false);
    expect(isSky(g, 'C')).toBe(true);
  });

  it('Heat Shields: a crate stands beside a vent; a belt still melts', () => {
    const g = sandbox('cinder');
    legacy(g, 'heatShields');
    must(g, { k: 'place', kind: 'crate', x: 23, y: 4, rot: 0 });
    expect(g.act({ k: 'place', kind: 'belt', x: 23, y: 6, rot: 0 }).why).toMatch(/melts/);
  });

  it('Warm Hands: on Rime one working neighbour is warmth enough', () => {
    const g = sandbox('rime');
    must(g, { k: 'place', kind: 'kiln', x: 9, y: 6, rot: 0 });
    must(g, { k: 'place', kind: 'kiln', x: 8, y: 6, rot: 2 });
    const k = at(g, 9, 6);
    at(g, 8, 6).state = 'work';
    expect(isWarm(g, k)).toBe(false);
    legacy(g, 'warmHands');
    expect(isWarm(g, k)).toBe(true);
  });

  it('Salvage Crews: ruins repair for nothing and clear the rubble around them', () => {
    const g = isle('oldworks');
    legacy(g, 'salvageCrews');
    g.s.land.push('C');
    const r = at(g, 3, 11);
    expect(repairPrice(g, r)).toBe(0);
    g.s.coin = N(0);
    const near = (g.s.rubble ?? []).filter((i) => Math.abs((i % 24) - 3) <= 1 && Math.abs(Math.floor(i / 24) - 11) <= 1);
    must(g, { k: 'repair', x: 3, y: 11 });
    for (const i of near) expect(g.s.rubble).not.toContain(i);
    expect(r.ruined).toBeFalsy();
  });
});

describe('Act IV reputation rewards (DESIGN.md §22)', () => {
  it('Harbour Rights (Bramble 5): two more claims on the island\'s exotic', () => {
    const g = sandbox('pebble');
    const c0 = claimsHeld(g, 'skyglass');
    g.s.orders.rep.bramble = 5;
    expect(claimsHeld(g, 'skyglass')).toBe(c0 + RULES.harbourClaims.value);
    expect(claimsHeld(g, 'ironOre')).toBe(claimsHeld(sandbox('pebble'), 'ironOre'));
  });

  it('Field Notes (Unit 7 5): an island\'s goods pay the Codex again on each island', () => {
    const g = sandbox('pebble');
    g.s.orders.rep.unit7 = 5;
    g.s.codex.push('skyglassLens');
    g.intake.push({ to: 'dock', item: 'skyglassLens', x: 7, y: 2 });
    const c0 = g.s.coin;
    g.step(1);
    const paid = g.s.coin.sub(c0).toNumber();
    expect(paid).toBeGreaterThanOrEqual(ITEMS.skyglassLens.value * RULES.codexMult.value);
    expect(g.s.meta.fieldNotes).toContain('pebble:skyglassLens');
  });

  it('Rubble Rousers (Committee 7): a cleared tile clears the rubble touching it', () => {
    const g = isle('oldworks');
    g.s.coin = N(1e4);
    g.s.orders.rep.committee = 7;
    const rub = new Set(g.s.rubble);
    const i = OLD_RUBBLE.find((q) => q % 24 < 7 && q % 24 > 0 && Math.floor(q / 24) < 7 && Math.floor(q / 24) > 0 && rub.has(q + 1))!;
    must(g, { k: 'clear', x: i % 24, y: Math.floor(i / 24) });
    expect(g.s.rubble).not.toContain(i + 1);
  });
});

describe('Act IV away and in saves (DESIGN.md §12, §22)', () => {
  it('offline on Cinder Isle: the vent line pays while away, through the same code paths', () => {
    const g = sandbox('cinder');
    sandLine(g);
    g.step(30 * TICK_RATE);
    const c0 = g.s.coin.toNumber();
    const rep = runOffline(g, 2 * 3600);
    expect(rep.coin.toNumber()).toBeGreaterThan(5000);
    expect(g.s.coin.toNumber()).toBeGreaterThan(c0);
    expect(g.s.meta.world).toBe('cinder');
  });

  it('a v8 save migrates to v9: Home, no Legacy, Home the only island seen', () => {
    expect(SAVE_VERSION).toBeGreaterThanOrEqual(9);
    const g = new Game(3);
    g.step(100);
    const p = savePayload(g, 0) as unknown as { v: number; snap: string };
    const st = JSON.parse(p.snap);
    for (const k of ['world', 'legacy', 'legacyEarned', 'legacyNodes', 'visited', 'worldRecords', 'here', 'relocations']) delete st.meta[k];
    const old = { ...p, v: 8, snap: JSON.stringify(st) };
    const m = migrate(old) as unknown as { v: number; snap: string };
    expect(m.v).toBe(SAVE_VERSION);
    const meta = JSON.parse(m.snap).meta;
    expect(meta.world).toBe('home');
    expect(meta.legacy).toBe('N:0');
    expect(meta.visited).toEqual(['home']);
    expect(meta.here.stages).toBe(0);
    const h = restore(m as never);
    expect(h.s.meta.world).toBe('home');
    expect(h.s.meta.legacy!.toNumber()).toBe(0);
  });

  it('a v11 save migrates to v12: Heaters lifted and refunded, out of the designs and the log; the clearing on the Old Works kept', () => {
    expect(SAVE_VERSION).toBeGreaterThanOrEqual(12);
    const g = sandbox('oldworks');
    const i = g.s.rubble![0];
    must(g, { k: 'clear', x: i % 24, y: Math.floor(i / 24) });
    g.step(20);
    const p = savePayload(g, 0) as unknown as { v: number; snap: string; log: unknown[] };
    const st = JSON.parse(p.snap);
    // as a v11 save had it: a Heater standing (one bought, one free), one in a design, no record
    st.ents.push({ ...st.ents[0], id: 9001, kind: 'heater', x: 10, y: 6, inBuf: { coal: 2 } });
    st.ents.push({ ...st.ents[0], id: 9002, kind: 'heater', x: 11, y: 6, inBuf: {}, free: true });
    st.designs = [{ id: 1, name: 'Warm', box: { x: 0, y: 0, w: 2, h: 1 }, parts: [{ kind: 'kiln', dx: 0, dy: 0, rot: 0, recipe: 'fireGlass' }, { kind: 'heater', dx: 1, dy: 0, rot: 0, recipe: null }], ins: {}, outs: { glass: 0.5 }, grade: { letter: 'B', score: 0.7, u: 1, w: 1, c: 1, mult: 1 }, bill: 6000, stamped: 0, spare: 1, depth: 1 }];
    delete st.meta.cleared;
    const coin = g.s.coin.toNumber();
    const old = { ...p, v: 11, snap: JSON.stringify(st), log: [{ t: g.s.tick, c: { k: 'place', kind: 'heater', x: 12, y: 6, rot: 0 } }] };
    const m = migrate(old) as unknown as { v: number; snap: string; log: unknown[] };
    expect(m.v).toBe(SAVE_VERSION);
    expect(m.log).toEqual([]);
    const h = restore(m as never);
    expect(h.s.ents.some((e) => (e.kind as string) === 'heater')).toBe(false);
    expect(h.s.coin.toNumber()).toBe(coin + 3000);
    expect(h.s.designs[0].parts.map((q) => q.kind)).toEqual(['kiln']);
    expect(h.s.meta.cleared!.tiles.oldworks).toContain(i);
    h.step(100);
    startRun(h);
    expect(h.s.rubble).not.toContain(i);
  });

  it('a save on an island restores exactly and keeps running in step', () => {
    const g = sandbox('cinder');
    sandLine(g);
    g.step(200);
    const h = restore(JSON.parse(JSON.stringify(savePayload(g, 0))));
    expect(fingerprint(h)).toBe(fingerprint(g));
    g.step(600);
    h.step(600);
    expect(fingerprint(h)).toBe(fingerprint(g));
  });

  it('seed + command log replays a Relocate, a Legacy node, a repair and a clearing to the same state', () => {
    const g = sandbox('home', 13, true);
    must(g, { k: 'place', kind: 'miner', x: 21, y: 5, rot: 0 });
    g.step(300);
    must(g, { k: 'relocate', world: 'oldworks' });
    g.step(100);
    must(g, { k: 'legacy', id: 'salvageCrews' });
    must(g, { k: 'repair', x: 1, y: 5 });
    const r = g.s.rubble!.find((q) => q % 24 < 8 && Math.floor(q / 24) < 8)!;
    must(g, { k: 'clear', x: r % 24, y: Math.floor(r / 24) });
    for (let i = 0; i < 20; i++) { g.act({ k: 'click', x: 3, y: 3 }); g.step(3); }
    g.step(400);
    const h = sandbox('home', 13, true);
    replayInto(h, g.history!.filter((l) => l.t >= 1), g.s.tick);
    expect(fingerprint(h)).toBe(fingerprint(g));
    expect(h.s.meta.world).toBe('oldworks');
    expect(h.s.meta.cleared).toEqual(g.s.meta.cleared);
  });
});
