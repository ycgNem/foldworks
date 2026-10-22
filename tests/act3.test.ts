// Act III (ROADMAP.md Milestone 7, DESIGN.md §21): the District and its skiff routes (throughput by
// distance), the District's Dock, Hopper and Bay (Megaprojects #2 and #3), the Factory Chute and the
// Chute Mouth, the Recycling and Byproduct modes, depth-3 folds on the District, the Scrap
// Transmuter, and what a Reorganize keeps.
import { describe, expect, it } from 'vitest';
import { Game, type Cmd } from '../src/sim/Game';
import { N, Num } from '../src/engine/num';
import { RESEARCH_IDS } from '../src/data/research';
import { CHUNKS } from '../src/data/land';
import { HIGH, skiffRate } from '../src/data/floors';
import { TICK_RATE } from '../src/engine/time';
import { routeCap, hentAt, highW, maxRoutes, routeWant, drillFactor } from '../src/sim/systems/high';
import { saleValue } from '../src/sim/systems/docks';
import { foldRefusal } from '../src/sim/systems/audits';
import { byEvery } from '../src/sim/systems/machines';
import { RECIPE } from '../src/data/recipes';
import { claimsUsed } from '../src/sim/systems/claims';
import type { ModuleDesign } from '../src/sim/world';
import { runOffline } from '../src/sim/offline';

function sandbox(seed = 1) {
  const g = new Game(seed);
  g.s.coin = N(1e9);
  g.s.land = CHUNKS.map((c) => c.id);
  g.s.research.done = [...RESEARCH_IDS];
  g.s.upgrades.push('bellows');
  g.s.mega.stage = 3;
  g.s.flags.push('factoryOpen');
  g.s.ents = g.s.ents.filter((e) => e.kind === 'dock' || e.kind === 'hopper' || e.kind === 'furnace');
  g.rebuild();
  g.step(1);
  return g;
}

function must(g: Game, c: Cmd) {
  const r = g.act(c);
  if (!r.ok) throw new Error(`${JSON.stringify(c)}: ${r.why}`);
}

/** A fake design (designs are plain data). */
function design(g: Game, over: Partial<ModuleDesign>): ModuleDesign {
  const d: ModuleDesign = {
    id: g.s.nextDesign++, name: 'D', box: { x: 0, y: 0, w: 2, h: 1 }, parts: [], ins: {}, outs: {},
    grade: { letter: 'B', score: 0.7, u: 1, w: 1, c: 1, mult: 1 }, bill: 1000, stamped: 0, spare: 4, depth: 2, ...over,
  };
  g.s.designs.push(d);
  return d;
}

const DK = HIGH.district.dock;

describe('the District (DESIGN.md §21)', () => {
  it('opens with Zoning: a 12x10 floor with its Dock and Hopper', () => {
    const g = sandbox();
    expect(g.s.district).toBeTruthy();
    expect(highW(g, 'district')).toBe(HIGH.district.w);
    expect(hentAt(g, 'district', DK.x, DK.y)?.kind).toBe('fdock');
    expect(hentAt(g, 'district', HIGH.district.hopper.x, HIGH.district.hopper.y)?.kind).toBe('fhopper');
  });

  it('takes depth-2 modules (and its own depth-3 folds), never depth 1', () => {
    const g = sandbox();
    const d1 = design(g, { depth: 1, outs: { steel: 1 } });
    const d2 = design(g, { outs: { steel: 1 } });
    expect(g.act({ k: 'hplace', floor: 'district', design: d1.id, x: 2, y: 2 }).why).toMatch(/depth-2/);
    must(g, { k: 'hplace', floor: 'district', design: d2.id, x: 2, y: 2 });
    expect(d2.spare).toBe(3);
  });

  it('a skiff route carries skiffs x load / (2 x distance / speed + dwell), so distance matters', () => {
    const g = sandbox();
    const d = design(g, { outs: { steel: 10 } });
    // two copies: one beside the Dock, one across the floor
    must(g, { k: 'hplace', floor: 'district', design: d.id, x: DK.x - 1, y: DK.y });
    must(g, { k: 'hplace', floor: 'district', design: d.id, x: 0, y: DK.y });
    must(g, { k: 'route', floor: 'district', fx: DK.x - 1, fy: DK.y, tx: DK.x, ty: DK.y, item: 'steel' });
    must(g, { k: 'route', floor: 'district', fx: 0, fy: DK.y, tx: DK.x, ty: DK.y, item: 'steel' });
    const [near, far] = g.s.district!.routes;
    const f = HIGH.district;
    expect(routeCap(g, 'district', near)).toBeCloseTo(skiffRate(f, 1.5811), 3);
    expect(routeCap(g, 'district', far)).toBeLessThan(routeCap(g, 'district', near) / 4);
    const before = g.s.coin;
    g.step(60 * TICK_RATE);
    const sold = g.s.delivered.steel?.toNumber() ?? 0;
    const want = 60 * (routeCap(g, 'district', near) + routeCap(g, 'district', far));
    expect(sold).toBeGreaterThan(want * 0.9);
    expect(sold).toBeLessThan(want * 1.05);
    expect(g.s.coin.gt(before)).toBe(true);
    // another skiff on the far route doubles what it carries
    const c1 = routeCap(g, 'district', far);
    must(g, { k: 'skiff', floor: 'district', id: far.id, n: 1 });
    expect(routeCap(g, 'district', far)).toBeCloseTo(2 * c1, 6);
    expect(far.flow).toBeGreaterThan(0);
  });

  it('skiffs are bought at a flat price and refunded when a route comes off', () => {
    const g = sandbox();
    const d = design(g, { outs: { steel: 1 } });
    must(g, { k: 'hplace', floor: 'district', design: d.id, x: 3, y: 3 });
    const c0 = g.s.coin;
    must(g, { k: 'route', floor: 'district', fx: 3, fy: 3, tx: DK.x, ty: DK.y, item: 'steel' });
    const r = g.s.district!.routes[0];
    must(g, { k: 'skiff', floor: 'district', id: r.id, n: 1 });
    expect(c0.sub(g.s.coin).toNumber()).toBe(2 * HIGH.district.skiffCost);
    must(g, { k: 'unroute', floor: 'district', id: r.id });
    expect(g.s.coin.eq(c0)).toBe(true);
  });

  it('a route only goes where its item is taken', () => {
    const g = sandbox();
    const a = design(g, { outs: { steel: 1 } });
    const b = design(g, { ins: { glass: 1 }, outs: { circuit: 1 } });
    must(g, { k: 'hplace', floor: 'district', design: a.id, x: 3, y: 3 });
    must(g, { k: 'hplace', floor: 'district', design: b.id, x: 4, y: 3 });
    expect(g.act({ k: 'route', floor: 'district', fx: 3, fy: 3, tx: 4, ty: 3, item: 'steel' }).why).toMatch(/takes no steel/);
    expect(g.act({ k: 'route', floor: 'district', fx: 3, fy: 3, tx: 4, ty: 3, item: 'glass' }).why).toMatch(/makes no glass/);
  });

  it('a module feeding another by skiff runs at what the route brings', () => {
    const g = sandbox();
    const src = design(g, { outs: { glass: 4 } });
    const use = design(g, { ins: { glass: 1 }, outs: { circuit: 0.5 } });
    must(g, { k: 'hplace', floor: 'district', design: src.id, x: 8, y: 1 });
    must(g, { k: 'hplace', floor: 'district', design: use.id, x: 9, y: 1 });
    must(g, { k: 'route', floor: 'district', fx: 8, fy: 1, tx: 9, ty: 1, item: 'glass' });
    must(g, { k: 'route', floor: 'district', fx: 9, fy: 1, tx: DK.x, ty: DK.y, item: 'circuit' });
    // a skiff carries one a trip: two of them bring the glass (1 a second) next door, and two the
    // circuits to the Dock
    for (const r of g.s.district!.routes) must(g, { k: 'skiff', floor: 'district', id: r.id, n: 1 });
    g.step(60 * TICK_RATE);
    const m = hentAt(g, 'district', 9, 1)!;
    expect(m.fAvg).toBeGreaterThan(0.9);
    expect(g.s.delivered.circuit?.toNumber() ?? 0).toBeGreaterThan(25);
  });

  it('the District Hopper pays research', () => {
    const g = sandbox();
    g.s.research.done = g.s.research.done.filter((r) => r !== 'robotics' && r !== 'umbrella' as never);
    g.s.research.done = g.s.research.done.filter((r) => r !== 'sandwichEngineering' && r !== 'districtFolds');
    must(g, { k: 'research', id: 'robotics' });
    const d = design(g, { outs: { servo: 2 } });
    must(g, { k: 'hplace', floor: 'district', design: d.id, x: 9, y: 6 });
    must(g, { k: 'route', floor: 'district', fx: 9, fy: 6, tx: HIGH.district.hopper.x, ty: HIGH.district.hopper.y, item: 'servo' });
    g.step(30 * TICK_RATE);
    expect(g.s.research.progress.robotics?.servo?.toNumber() ?? 0).toBeGreaterThan(10);
  });

  it('a module whose routes all lead off holds its claims like a copy on the Factory', () => {
    const g = sandbox();
    const line = design(g, { depth: 1, parts: [{ kind: 'miner', dx: 0, dy: 0, rot: 0, recipe: 'mineCopper' }], outs: { copperOre: 1 }, spare: 0 });
    const grp = design(g, { fparts: [{ kind: 'module', design: line.id, dx: 0, dy: 0, rot: 0 }], outs: { copperOre: 1 }, spare: 1 });
    expect(claimsUsed(g, 'copperOre')).toBe(1);
    must(g, { k: 'hplace', floor: 'district', design: grp.id, x: 2, y: 2 });
    expect(claimsUsed(g, 'copperOre')).toBe(1);
  });

  it('Overdrive runs a District module and every module joined to it by routes', () => {
    const g = sandbox();
    const a = design(g, { outs: { glass: 4 } });
    const b = design(g, { ins: { glass: 1 }, outs: { circuit: 0.5 } });
    must(g, { k: 'hplace', floor: 'district', design: a.id, x: 2, y: 2 });
    must(g, { k: 'hplace', floor: 'district', design: b.id, x: 3, y: 2 });
    must(g, { k: 'route', floor: 'district', fx: 2, fy: 2, tx: 3, ty: 2, item: 'glass' });
    must(g, { k: 'hclick', floor: 'district', x: 2, y: 2 });
    expect(hentAt(g, 'district', 3, 2)!.od).toBeGreaterThan(0);
  });

  it('lots east of the floor are bought at base x n', () => {
    const g = sandbox();
    const c0 = g.s.coin;
    must(g, { k: 'hlot', floor: 'district' });
    must(g, { k: 'hlot', floor: 'district' });
    expect(c0.sub(g.s.coin).toNumber()).toBe(HIGH.district.lotBase * 3);
    expect(highW(g, 'district')).toBe(HIGH.district.w + 2 * HIGH.district.lotCols);
  });
});

describe('the District Bay: the Floating City and the Scrap Transmuter (DESIGN.md §21)', () => {
  it('arrives with the research and builds the City; its first stage gives the Factory a ninth row', () => {
    const g = sandbox();
    g.step(TICK_RATE + 1);
    const bay = HIGH.district.bay;
    expect(hentAt(g, 'district', bay.x, bay.y)?.kind).toBe('fbay');
    expect(g.fh).toBe(8);
    g.s.megas = { city: { stage: 0, progress: { liftRotor: Num.of(119), concrete: Num.of(4000) } } };
    const d = design(g, { outs: { liftRotor: 2 } });
    must(g, { k: 'hplace', floor: 'district', design: d.id, x: 2, y: 8 });
    must(g, { k: 'route', floor: 'district', fx: 2, fy: 8, tx: bay.x, ty: bay.y, item: 'liftRotor' });
    g.step(10 * TICK_RATE);
    expect(g.s.megas!.city!.stage).toBe(1);
    expect(g.fh).toBe(9);
  });

  it('the Transmuter: stage 1 sells waste at 25% of what made it; stage 2 never lets it stop a module', () => {
    const g = sandbox();
    expect(saleValue(g, 'slag')).toBe(0);
    g.s.megas = { transmuter: { stage: 1, progress: {} } };
    expect(saleValue(g, 'slag')).toBeCloseTo(0.75, 6); // a quarter of an iron ingot
    expect(saleValue(g, 'sludge')).toBeCloseTo(7.5, 6); // a quarter of a solvent
    // a Factory module whose slag has nowhere to go stops at stage 1 and keeps running at stage 2
    const d = design(g, { depth: 1, outs: { steel: 0.2, slag: 0.5 } });
    // beside the Factory Hopper, facing it: its steel goes in, its slag has nowhere to go (the
    // Hopper takes waste only while a node wants it)
    must(g, { k: 'fplace', design: d.id, x: 9, y: 5, rot: 0 });
    g.step(30 * TICK_RATE);
    const m = g.s.factory.ents.find((e) => e.kind === 'module' && e.x === 9 && e.y === 5)!;
    expect(m.state).toBe('blocked');
    g.s.megas.transmuter!.stage = 2;
    const c0 = g.s.coin;
    g.step(30 * TICK_RATE);
    expect(m.state).toBe('work');
    expect(g.s.coin.gt(c0)).toBe(true);
  });
});

describe('the Chute (DESIGN.md §21)', () => {
  it('drops what a Factory trunk brings it down to the Workshop, where a Chute Mouth pushes it out', () => {
    const g = sandbox();
    const d = design(g, { depth: 1, outs: { motor: 2 } });
    must(g, { k: 'fplace', design: d.id, x: 3, y: 3, rot: 0 });
    must(g, { k: 'fchute', x: 4, y: 3 });
    expect(g.act({ k: 'fchute', x: 5, y: 5 }).why).toMatch(/Chute already/);
    must(g, { k: 'place', kind: 'chuteMouth', x: 10, y: 10, rot: 0 });
    must(g, { k: 'recipe', x: 10, y: 10, recipe: 'motor' });
    must(g, { k: 'place', kind: 'belt', x: 11, y: 10, rot: 0 });
    must(g, { k: 'place', kind: 'belt', x: 12, y: 10, rot: 0 });
    must(g, { k: 'place', kind: 'crate', x: 13, y: 10, rot: 0 });
    g.step(20 * TICK_RATE);
    const crate = g.entAt(13, 10)!;
    expect(crate.store.filter((i) => i === 'motor').length).toBeGreaterThan(15);
    // the stock between them never holds more than 20 of an item
    expect(g.s.chute!.motor ?? 0).toBeLessThanOrEqual(20 + 1e-9);
  });

  it('a fold box may not hold a Chute Mouth', () => {
    const g = sandbox();
    must(g, { k: 'place', kind: 'chuteMouth', x: 10, y: 10, rot: 0 });
    must(g, { k: 'place', kind: 'assembler', x: 11, y: 10, rot: 0 });
    must(g, { k: 'place', kind: 'press', x: 12, y: 10, rot: 0 });
    expect(foldRefusal(g, { x: 10, y: 10, w: 3, h: 1 })).toMatch(/Chute Mouth/);
  });
});

describe('Recycling and Byproduct modes (DESIGN.md §21)', () => {
  it('halve or double the byproduct a recipe makes', () => {
    const r = RECIPE.mixSolvent;
    expect(byEvery({ mode: 'normal' }, r)).toBe(2);
    expect(byEvery({ mode: 'recycling' }, r)).toBe(4);
    expect(byEvery({ mode: 'byproduct' }, r)).toBe(1);
    expect(byEvery({ mode: 'byproduct' }, RECIPE.smeltIron)).toBe(2);
  });

  it('need Recycling researched and a powered machine', () => {
    const g = sandbox();
    must(g, { k: 'place', kind: 'chemVat', x: 10, y: 10, rot: 0 });
    must(g, { k: 'mode', x: 10, y: 10, mode: 'recycling' });
    g.s.research.done = g.s.research.done.filter((r) => r !== 'recycling');
    expect(g.act({ k: 'mode', x: 10, y: 10, mode: 'byproduct' }).why).toMatch(/Recycling/);
  });

  it('the Engineer is an Assembler Mk2 recipe only', () => {
    const g = sandbox();
    must(g, { k: 'place', kind: 'assembler', x: 10, y: 10, rot: 0 });
    expect(g.act({ k: 'recipe', x: 10, y: 10, recipe: 'buildEngineer' }).why).toMatch(/Mk2/);
    must(g, { k: 'place', kind: 'assemblerMk2', x: 12, y: 10, rot: 0 });
    must(g, { k: 'recipe', x: 12, y: 10, recipe: 'buildEngineer' });
  });
});

describe('District folds (DESIGN.md §21)', () => {
  it('audits a group joined by routes and folds it into one depth-3 tile', () => {
    const g = sandbox();
    const src = design(g, { outs: { glass: 4 }, bill: 3000 });
    const use = design(g, { ins: { glass: 1 }, outs: { circuit: 0.5 }, bill: 5000 });
    must(g, { k: 'hplace', floor: 'district', design: src.id, x: 2, y: 2 });
    must(g, { k: 'hplace', floor: 'district', design: use.id, x: 3, y: 2 });
    must(g, { k: 'route', floor: 'district', fx: 2, fy: 2, tx: 3, ty: 2, item: 'glass' });
    must(g, { k: 'route', floor: 'district', fx: 3, fy: 2, tx: DK.x, ty: DK.y, item: 'circuit' });
    // one item a trip: two skiffs bring the glass next door, five the circuits across to the Dock
    const [inner, out] = g.s.district!.routes;
    must(g, { k: 'skiff', floor: 'district', id: inner.id, n: 1 });
    for (let i = 0; i < 4; i++) must(g, { k: 'skiff', floor: 'district', id: out.id, n: 1 });
    must(g, { k: 'haudit', floor: 'district', x: 2, y: 2, w: 2, h: 1 });
    g.step(75 * TICK_RATE);
    const a = g.s.haudit!;
    expect(a.result).toBeTruthy();
    expect(a.result!.outs.circuit).toBeGreaterThan(0.3);
    const coin = g.s.coin;
    must(g, { k: 'hfold', name: null });
    const d = g.s.designs[g.s.designs.length - 1];
    expect(d.depth).toBe(3);
    expect(d.bill).toBe(8000);
    expect(d.hparts?.length).toBe(2);
    expect(d.hroutes?.length).toBe(1);
    // the skiffs came back: the inner route's two and the five to the Dock
    expect(g.s.coin.sub(coin).toNumber()).toBe(7 * HIGH.district.skiffCost);
    expect(hentAt(g, 'district', 2, 2)).toBeNull();
    // the District takes its own fold back: a group's routes packed into one tile's ports
    d.spare = 1;
    must(g, { k: 'hplace', floor: 'district', design: d.id, x: 5, y: 5 });
  });

  it('refuses a pile of strangers', () => {
    const g = sandbox();
    const a = design(g, { outs: { glass: 1 } });
    must(g, { k: 'hplace', floor: 'district', design: a.id, x: 2, y: 2 });
    must(g, { k: 'hplace', floor: 'district', design: a.id, x: 3, y: 2 });
    expect(g.act({ k: 'haudit', floor: 'district', x: 2, y: 2, w: 2, h: 1 }).why).toMatch(/works together/);
  });
});

describe('the waste chute and the route cap (DESIGN.md §21, the second gate)', () => {
  it('a District module\'s waste with no route goes to the Dock on its own', () => {
    const g = sandbox();
    const d = design(g, { outs: { steel: 0.2, slag: 0.5 } });
    must(g, { k: 'hplace', floor: 'district', design: d.id, x: 3, y: 3 });
    must(g, { k: 'route', floor: 'district', fx: 3, fy: 3, tx: DK.x, ty: DK.y, item: 'steel' });
    // eight tiles to the Dock at one a trip: three skiffs carry its 0.2 steel a second
    for (let i = 0; i < 2; i++) must(g, { k: 'skiff', floor: 'district', id: g.s.district!.routes[0].id, n: 1 });
    g.step(30 * TICK_RATE);
    expect(hentAt(g, 'district', 3, 3)!.state).toBe('work');
    expect(g.s.delivered.slag?.toNumber() ?? 0).toBeGreaterThan(10);
  });

  it('holds 120 routes and 20 more a lot', () => {
    const g = sandbox();
    expect(maxRoutes(g, 'district')).toBe(120);
    must(g, { k: 'hlot', floor: 'district' });
    expect(maxRoutes(g, 'district')).toBe(140);
  });

  it('takes its own folds (depth 3) as well as depth-2 groups', () => {
    const g = sandbox();
    const d = design(g, { depth: 3, outs: { servo: 0.2 } });
    must(g, { k: 'hplace', floor: 'district', design: d.id, x: 5, y: 5 });
  });

  it('a route\'s want counts the Great Drill\'s boost', () => {
    const g = sandbox();
    const d = design(g, { outs: { servo: 0.2 } });
    must(g, { k: 'hplace', floor: 'district', design: d.id, x: 5, y: 5 });
    must(g, { k: 'route', floor: 'district', fx: 5, fy: 5, tx: DK.x, ty: DK.y, item: 'servo' });
    expect(routeWant(g, 'district', g.s.district!.routes[0])).toBeCloseTo(0.2 * drillFactor(g), 6);
    expect(drillFactor(g)).toBeGreaterThan(1);
  });
});

describe('Reorganize in Act III (DESIGN.md §21)', () => {
  it('loses the District and the Chute stock, keeps the Megaprojects', () => {
    const g = sandbox();
    g.s.megas = { city: { stage: 1, progress: {} } };
    g.s.chute = { motor: 5 };
    // Patents to bank (a Megaproject delivered this run), so a Reorganize is allowed
    g.s.megaPatents = 3;
    const r = g.act({ k: 'reorganize' });
    expect(r.why).toBeUndefined();
    expect(g.s.district).toBeUndefined();
    expect(g.s.chute).toBeUndefined();
    expect(g.s.megas?.city?.stage).toBe(1);
    expect(g.fh).toBe(9);
  });
});

describe('Act III away (DESIGN.md §12, §21)', () => {
  it('a District line pays while away, at the offline rate, and its Bay fills from its own tally', () => {
    const g = sandbox();
    const d = design(g, { outs: { steel: 2, liftRotor: 0.2 } });
    must(g, { k: 'hplace', floor: 'district', design: d.id, x: DK.x - 1, y: DK.y });
    must(g, { k: 'route', floor: 'district', fx: DK.x - 1, fy: DK.y, tx: DK.x, ty: DK.y, item: 'steel' });
    // the City's Bay, and a route of lift rotors to it
    g.step(TICK_RATE);
    const bay = HIGH.district.bay;
    expect(hentAt(g, 'district', bay.x, bay.y)?.kind).toBe('fbay');
    must(g, { k: 'route', floor: 'district', fx: DK.x - 1, fy: DK.y, tx: bay.x, ty: bay.y, item: 'liftRotor' });
    g.step(120 * TICK_RATE);
    const steel0 = g.s.delivered.steel?.toNumber() ?? 0;
    const rotors0 = g.s.megas?.city?.progress.liftRotor?.toNumber() ?? 0;
    const drill0 = g.s.mega.progress.liftRotor?.toNumber() ?? 0;
    const rep = runOffline(g, 4 * 3600);
    const steel = (g.s.delivered.steel?.toNumber() ?? 0) - steel0;
    const live = 4 * 3600 * Math.min(2, routeCap(g, 'district', g.s.district!.routes[0]));
    expect(steel).toBeGreaterThan(live * rep.eff * 0.9);
    expect(steel).toBeLessThan(live * 1.01);
    const rotors = (g.s.megas?.city?.progress.liftRotor?.toNumber() ?? 0) - rotors0 + (g.s.megas?.city?.stage ?? 0) * 120;
    expect(rotors).toBeGreaterThan(0);
    expect(rep.mega.given.liftRotor?.toNumber() ?? 0).toBeGreaterThan(0);
    // nothing of the District's Bay was counted toward the Great Drill
    expect(g.s.mega.progress.liftRotor?.toNumber() ?? 0).toBe(drill0);
  });
});
