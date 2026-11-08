// Reorganize, layer 1 (ROADMAP.md Milestone 5, DESIGN.md §19; the Milestone 5-6 review round): the
// filing model (each product's best design on file, only a rise paid), the bills term, the preview's
// lines and goals, the reset (what is kept, what is lost), head starts, the Patent tree's rules and
// automation, the Patent Drawer (keep, unfold whole, the Draughtsman, FWD1 share strings), the Factory
// annex, the Committee and the Great Drill's gates, the Bay that never jams, determinism across a
// reset, saves and the v6 -> v7 migration.
import { describe, expect, it } from 'vitest';
import { Game, type Cmd } from '../src/sim/Game';
import { N, Num } from '../src/engine/num';
import { RESEARCH, RESEARCH_IDS } from '../src/data/research';
import { ANNEX, CHUNKS, FACTORY } from '../src/data/land';
import { RULES } from '../src/data/rules';
import { MEGA, megaStage } from '../src/data/megaprojects';
import { PATENTS, PATENT_IDS, PATENT_LIST, type PatentId } from '../src/data/patents';
import { TICK_RATE } from '../src/engine/time';
import { auditTicks, foldRefusal } from '../src/sim/systems/audits';
import { claimLoad, claimsHeld } from '../src/sim/systems/claims';
import { offeredOrders, orderFilled, ordersEverFilled } from '../src/sim/systems/orders';
import { stampCost, megaOpen } from '../src/sim/systems/modules';
import { annexPrice } from '../src/sim/systems/annex';
import { billsStanding, billsTerm, chainSteps, designValue, previewPatents, reorganizeRefusal, customerMet, runSeconds, stepsFolded, returnCopies } from '../src/sim/reorganize';
import { prules, patentRefusal, spendable } from '../src/sim/patents';
import { trules } from '../src/sim/longtail';
import { offlineEfficiency } from '../src/sim/offline';
import { decodeDesign, encodeDesign, keptBill, unfoldKeptRefusal, dieRefusal } from '../src/sim/drawer';
import { restore, savePayload, fingerprint, stateFrom } from '../src/sim/snapshot';
import { migrate, SAVE_VERSION } from '../src/engine/save';
import type { Dir, ModuleDesign } from '../src/sim/world';

function sandbox(seed = 1) {
  const g = new Game(seed);
  g.s.coin = N(1e7);
  g.s.land = CHUNKS.map((c) => c.id);
  g.s.research.done = [...RESEARCH_IDS];
  g.s.upgrades.push('bellows');
  g.s.ents = g.s.ents.filter((e) => e.kind === 'dock' || e.kind === 'hopper' || e.kind === 'furnace');
  g.rebuild();
  return g;
}

function must(g: Game, c: Cmd) {
  const r = g.act(c);
  if (!r.ok) throw new Error(`${JSON.stringify(c)}: ${r.why}`);
}

function belt(g: Game, x0: number, y0: number, n: number, rot: Dir) {
  const dx = [1, 0, -1, 0][rot], dy = [0, 1, 0, -1][rot];
  for (let i = 0; i < n; i++) must(g, { k: 'place', kind: 'belt', x: x0 + dx * i, y: y0 + dy * i, rot });
}

/** The fold tests' iron line on chunk C: Miner (2,11) into a Smelter (3,11), slag out of a port to
 * a heap, ingots up column 5 into the Dock. */
function ironLine(g: Game) {
  must(g, { k: 'place', kind: 'miner', x: 2, y: 11, rot: 0 });
  must(g, { k: 'place', kind: 'smelter', x: 3, y: 11, rot: 0 });
  must(g, { k: 'place', kind: 'belt', x: 3, y: 12, rot: 1 });
  must(g, { k: 'place', kind: 'heap', x: 3, y: 13, rot: 1 });
  belt(g, 4, 11, 1, 0);
  belt(g, 5, 11, 9, 3);
  belt(g, 5, 2, 1, 0);
}

/** The iron line folded into "Ingots" (its Miner and Smelter, a 2x2 box), and a Gizmo design beside it. */
function foldIronLine(g: Game): ModuleDesign {
  ironLine(g);
  g.step(30 * TICK_RATE);
  must(g, { k: 'audit', x: 2, y: 11, w: 2, h: 2 });
  g.step(auditTicks(g) + 1);
  must(g, { k: 'fold', name: 'Ingots' });
  fakeDesign(g, 'gizmo', 'B', 1);
  return g.s.designs.find((d) => d.name === 'Ingots')!;
}

/** A design of a product at a grade, put straight into the inventory (the preview reads designs). */
function fakeDesign(g: Game, item: string, letter: string, mult: number, ins: Record<string, number> = {}, rate = 0.25): ModuleDesign {
  const d: ModuleDesign = {
    id: g.s.nextDesign++, name: item, box: { x: 0, y: 0, w: 1, h: 1 }, parts: [], ins: ins as never, outs: { [item]: rate * mult } as never,
    grade: { letter, score: 0.9, u: 1, w: 1, c: 1, mult }, bill: 100, stamped: 0, spare: 1,
  };
  g.s.designs.push(d);
  return d;
}

function give(g: Game, n: number) {
  g.s.meta.patents = g.s.meta.patents.add(n);
}

function buy(g: Game, ...ids: PatentId[]) {
  for (const id of ids) {
    give(g, PATENTS[id].cost);
    must(g, { k: 'patent', id });
  }
}

/** A run that can be reset: a design worth at least one Patent. */
function resettable(g: Game) {
  fakeDesign(g, 'gizmo', 'S', 1.25);
}

describe('the filing model (DESIGN.md §19)', () => {
  it('counts chain steps from raw ore off the recipes, and the steps a design folds', () => {
    expect(chainSteps('ironOre')).toBe(0);
    expect(chainSteps('ironIngot')).toBe(1);
    expect(chainSteps('ironPlate')).toBe(2);
    expect(chainSteps('gear')).toBe(3);
    expect(chainSteps('gizmo')).toBe(4);
    expect(chainSteps('steel')).toBe(2);
    expect(chainSteps('drillBit')).toBe(5);
    // a Gizmo works fed ingots and wire folds the steps past them; one fed ore folds them all
    expect(stepsFolded({ ins: { ironIngot: 1, copperWire: 1 } }, 'gizmo')).toBe(2);
    expect(stepsFolded({ ins: {} }, 'gizmo')).toBe(4);
    // at least one, even fed its own product's parts
    expect(stepsFolded({ ins: { gear: 1, copperWire: 1 } }, 'gizmo')).toBe(1);
  });

  it('a design is worth steps x grade x rate tier; a bigger line climbs a tier', () => {
    const g = sandbox();
    const small = designValue(fakeDesign(g, 'gizmo', 'A', 1.1, {}, 0.25))!;
    expect(small.steps).toBe(4);
    expect(small.tier).toBe(0);
    expect(small.value).toBeCloseTo(4 * 1.1, 9);
    // four Mk1 assemblers' worth of Gizmos (4 s a Gizmo: 1/s) is the next tier, +50%
    const big = designValue(fakeDesign(g, 'gizmo', 'A', 1.1, {}, 1.0))!;
    expect(big.tier).toBe(1);
    expect(big.value).toBeCloseTo(4 * 1.1 * (1 + RULES.tierBonus.value), 9);
    // byproducts are never patented
    expect(designValue(fakeDesign(g, 'slag', 'B', 1))).toBeNull();
  });

  it('a fresh run is worth nothing and is refused', () => {
    const g = sandbox();
    expect(previewPatents(g).designs).toBe(0);
    expect(reorganizeRefusal(g)).toMatch(/fold a line/);
    expect(g.act({ k: 'reorganize' }).ok).toBe(false);
  });

  it('pays half a Patent a unit of value, each product once at its best; the record keeps the best', () => {
    const g = sandbox();
    fakeDesign(g, 'gizmo', 'A', 1.1);
    fakeDesign(g, 'gizmo', 'S', 1.25); // the best counts, once
    fakeDesign(g, 'ironIngot', 'B', 1);
    const p = previewPatents(g);
    expect(p.lines.map((l) => l.item).sort()).toEqual(['gizmo', 'ironIngot']);
    expect(p.lines.every((l) => l.status === 'new')).toBe(true);
    expect(p.designs).toBeCloseTo(RULES.patentPerStep.value * (4 * 1.25 + 1 * 1), 9);
    must(g, { k: 'reorganize' });
    expect(g.s.meta.patented.gizmo).toMatchObject({ steps: 4, grade: 'S', tier: 0, run: 1 });
    expect(g.s.meta.patented.gizmo!.value).toBeCloseTo(5, 9);
    // the same designs again: on file, worth nothing; a better one pays only the rise
    g.s.research.done = [...RESEARCH_IDS];
    fakeDesign(g, 'gizmo', 'S', 1.25);
    fakeDesign(g, 'ironIngot', 'B', 1);
    let q = previewPatents(g);
    expect(q.lines.every((l) => l.status === 'filed' && l.patents === 0)).toBe(true);
    expect(q.designs).toBe(0);
    fakeDesign(g, 'gizmo', 'S+', 1.35);
    q = previewPatents(g);
    const giz = q.lines.find((l) => l.item === 'gizmo')!;
    expect(giz.status).toBe('improved');
    expect(giz.patents).toBeCloseTo(RULES.patentPerStep.value * 4 * (1.35 - 1.25), 9);
    // a worse design never lowers the record (a new product makes this reset worth one)
    fakeDesign(g, 'gizmo', 'A', 1.1);
    fakeDesign(g, 'steel', 'B', 1);
    must(g, { k: 'reorganize' });
    expect(g.s.meta.patented.gizmo!.value).toBeCloseTo(4 * 1.35, 9);
    expect(g.s.meta.patented.gizmo!.run).toBe(2);
    expect(g.s.meta.patented.ironIngot!.run).toBe(1);
  });

  it('the bills term counts what stands and runs: log2(1 + bills / 25,000)', () => {
    expect(billsTerm(0)).toBe(0);
    expect(billsTerm(RULES.patentBillsDivisor.value)).toBeCloseTo(1, 9);
    expect(billsTerm(3 * RULES.patentBillsDivisor.value)).toBeCloseTo(2, 9);
    const g = sandbox();
    // an idle building counts for nothing; a working line counts its machines and belts
    must(g, { k: 'place', kind: 'smelter', x: 10, y: 10, rot: 0 });
    g.step(5 * TICK_RATE);
    expect(billsStanding(g)).toBe(0);
    ironLine(g);
    g.step(70 * TICK_RATE);
    expect(billsStanding(g)).toBeGreaterThan(0);
    expect(previewPatents(g).bills).toBeCloseTo(billsTerm(billsStanding(g)), 9);
    // coin on hand is not a bill
    const b = billsStanding(g);
    g.s.coin = g.s.coin.add(1e9);
    expect(billsStanding(g)).toBe(b);
  });

  it('the preview names its goals: a new product, a better grade, a deeper fold, a bigger line, the Drill', () => {
    const g = sandbox();
    fakeDesign(g, 'gizmo', 'B', 1, { ironIngot: 0.5, copperWire: 0.5 });
    const kinds = new Set(previewPatents(g).goals.map((q) => q.kind));
    for (const k of ['fold', 'grade', 'deeper', 'bigger', 'mega']) expect(kinds.has(k as never), k).toBe(true);
    // no goal to buy buildings for the bills term (the final round: it pointed at burning coin)
    expect(kinds.has('bills' as never)).toBe(false);
    // a stage shut on the Committee's reputation is a goal of its own
    g.s.mega.stage = 1;
    expect(previewPatents(g).goals.some((q) => q.kind === 'committee' && /reputation 3/.test(q.text))).toBe(true);
  });

  it('a reset loop gains little: the second reset at once has only the bills to give', () => {
    const g = sandbox();
    fakeDesign(g, 'gizmo', 'S', 1.25);
    must(g, { k: 'reorganize' });
    g.s.research.done = [...RESEARCH_IDS];
    fakeDesign(g, 'gizmo', 'S', 1.25);
    expect(previewPatents(g).now).toBe(0);
    expect(reorganizeRefusal(g)).toMatch(/Nothing new to patent/);
  });
});

describe('the reset (DESIGN.md §19)', () => {
  it('keeps meta, the record, the Drawer, the Drill, reputation, the Night Shift, trophies; loses the run and the annex', () => {
    const g = sandbox();
    const ingots = foldIronLine(g);
    must(g, { k: 'keep', id: ingots.id });
    g.s.mega = { stage: 1, progress: { steel: N(5) } };
    g.s.codex.push('steel');
    g.s.orders.rep.bramble = 3;
    g.s.orders.rep.committee = 2;
    g.s.flags.push('trophy:pocketMoney', 'sliceEnd', 'factoryOpen');
    g.s.counters.folds = 7;
    g.s.upgrades.push('nightForeman');
    must(g, { k: 'annex' });
    expect(g.fw).toBe(FACTORY.w + ANNEX.cols);
    const tick = g.s.tick;
    const p = previewPatents(g).now;
    expect(p).toBeGreaterThanOrEqual(1);
    const earned = g.s.earned;
    must(g, { k: 'reorganize' });
    const s = g.s;
    expect(s.tick).toBe(tick);
    expect(s.meta.runs).toBe(1);
    expect(runSeconds(g)).toBe(0);
    expect(s.meta.patents.toNumber()).toBe(p);
    expect(s.meta.history[0].patents).toBe(p);
    expect(s.meta.lifetime.earned.toNumber()).toBe(earned.toNumber());
    expect(Object.keys(s.meta.patented).sort()).toEqual(['gizmo', 'ironIngot']);
    expect(s.meta.drawer).toHaveLength(1);
    expect(s.mega.stage).toBe(1);
    expect(s.mega.progress.steel?.toNumber()).toBe(5);
    expect(s.codex).toContain('steel');
    expect(s.orders.rep).toMatchObject({ bramble: 3, committee: 2 });
    expect(s.flags).toContain('trophy:pocketMoney');
    // the returning run (the playability pass): the slice's end and the open Factory are kept
    expect(s.flags).toContain('sliceEnd');
    expect(s.flags).toContain('factoryOpen');
    expect(s.counters.folds).toBe(7);
    // the Night Shift bought with coin is kept (the lead's decision 6); the Bellows was a run's
    expect(s.upgrades).toEqual(['nightForeman']);
    // lost (but the coin trophies' head start, DESIGN.md §24: Pocket Money's 25 and what the
    // sandbox earned on the way)
    expect(s.coin.toNumber()).toBe(trules(g).startCoin);
    expect(trules(g).startCoin).toBeGreaterThanOrEqual(25);
    expect(s.earned.toNumber()).toBe(0);
    expect(s.land).toEqual(['A']);
    // what you learned is kept (the playability pass, DESIGN.md §19): Acts I-II's research, and the
    // kept Ingots back as a module design with its free copy
    expect(s.research.done).toEqual(RESEARCH_IDS.filter((r) => (RESEARCH[r].act ?? 1) <= 2 && !RESEARCH[r].world));
    expect(s.designs.map((d) => [d.name, d.kept, d.spare, d.stamped])).toEqual([['Ingots', s.meta.drawer[0].id, 1, 0]]);
    expect(s.orders.done).toEqual([]);
    expect(s.annex ?? 0).toBe(0);
    expect(g.fw).toBe(FACTORY.w);
    expect(g.entAt(3, 3)?.kind).toBe('furnace');
    expect(g.entAt(6, 1)?.kind).toBe('dock');
    expect(g.entAt(2, 11)).toBeNull();
    expect(s.factory.ents.filter((e) => e.kind === 'module')).toHaveLength(0);
  });

  it('head starts bought in the tree shape the next run: land deeds, Spare Dies, Claims on File', () => {
    const g = sandbox();
    const ingots = foldIronLine(g);
    must(g, { k: 'keep', id: ingots.id });
    buy(g, 'copperDeeds', 'coalRights', 'steelCharter', 'overdriveHabit', 'starterLine');
    g.s.claimBlocks.ironOre = 2;
    must(g, { k: 'reorganize' });
    const s = g.s;
    expect([...s.land].sort()).toEqual(['A', 'B', 'C', 'D', 'E', 'F']);
    // two free copies with Spare Dies, and the claims bought kept
    expect(s.designs.find((d) => d.name === 'Ingots')?.spare).toBe(2);
    expect(s.claimBlocks.ironOre).toBe(2);
    expect(s.meta.keptClaims?.ironOre).toBe(2);
    // the coin trophies earned on the way (DESIGN.md §24), and nothing else: no Grant any more
    expect(s.coin.toNumber()).toBe(trules(g).startCoin);
  });

  it('a reset in the command log replays to the same state', () => {
    const play = () => {
      const g = new Game(7, { keepHistory: true });
      g.s.designs.push({ id: 99, name: 'x', box: { x: 0, y: 0, w: 1, h: 1 }, parts: [], ins: {}, outs: { gizmo: 1 }, grade: { letter: 'B', score: 0.7, u: 1, w: 1, c: 1, mult: 1 }, bill: 0, stamped: 0, spare: 0 });
      return g;
    };
    const a = play();
    a.step(100);
    a.act({ k: 'reorganize' });
    a.act({ k: 'patent', id: 'copperDeeds' });
    a.step(300);
    a.act({ k: 'click', x: 2, y: 3 });
    a.step(300);
    const b = play();
    let i = 0;
    const hist = a.history!;
    while (b.s.tick < a.s.tick) {
      while (i < hist.length && hist[i].t === b.s.tick) b.act(hist[i++].c);
      b.tick();
    }
    expect(fingerprint(b)).toBe(fingerprint(a));
    expect(b.s.meta.nodes).toEqual(['copperDeeds']);
    expect(b.s.meta.runs).toBe(1);
    expect(b.s.meta.patented.gizmo).toBeDefined();
  });

  it('a save after a reset restores Patents (a Num), the record and the Drawer', () => {
    const g = sandbox();
    const ingots = foldIronLine(g);
    must(g, { k: 'keep', id: ingots.id });
    must(g, { k: 'reorganize' });
    const p = savePayload(g, 0);
    const h = restore(p);
    expect(h.s.meta.patents).toBeInstanceOf(Num);
    expect(h.s.meta.patents.toNumber()).toBe(g.s.meta.patents.toNumber());
    expect(h.s.meta.patented).toEqual(g.s.meta.patented);
    expect(h.s.meta.drawer).toEqual(g.s.meta.drawer);
    expect(fingerprint(h)).toBe(fingerprint(g));
    expect(stateFrom(p.snap).meta.runs).toBe(1);
  });

  it('migrates a v6 save: blueprints, bearings and ghosts go, the record and the Drawer start empty', () => {
    const st = {
      coin: 'N:5',
      meta: { runs: 1, runStart: 0, patents: 'N:3', patentsEarned: 'N:3', nodes: ['bellows'], blueprints: [{ id: 1, name: 'x', w: 1, h: 1, parts: [] }], nextBlueprint: 2, bearings: 'N:4', lifetime: { earned: 'N:0', delivered: {}, folds: 0 }, history: [], peakPerMin: 0, perMinRing: [] },
      ghosts: [{ kind: 'belt', x: 1, y: 1, rot: 0, recipe: null }],
      mega: { stage: 1, progress: {}, bearings: 2 },
      orders: { active: null, progress: {}, done: [], rep: { bramble: 0, unit7: 0, voltaire: 0, committee: 1 } },
    };
    const log = [{ t: 0, c: { k: 'bpSave', x: 0, y: 0, w: 1, h: 1, name: 'x' } }, { t: 3, c: { k: 'click', x: 2, y: 3 } }, { t: 4, c: { k: 'ghostBuildAll' } }];
    const d = migrate({ v: 6, saved: 0, seed: 1, snap: JSON.stringify(st), log });
    expect(d.v).toBe(SAVE_VERSION);
    expect((d as unknown as { log: unknown[] }).log).toHaveLength(1);
    const s2 = stateFrom(d.snap as string);
    // 3 banked and the old Bellows on the Bench refunded (v13, the playability pass)
    expect(s2.meta.patents.toNumber()).toBe(4);
    expect(s2.meta.nodes).toEqual([]);
    expect(s2.meta.patented).toEqual({});
    expect(s2.meta.drawer).toEqual([]);
    expect(s2.meta.queue).toEqual([]);
    expect('blueprints' in s2.meta).toBe(false);
    expect('bearings' in s2.meta).toBe(false);
    expect('ghosts' in s2).toBe(false);
    expect('bearings' in s2.mega).toBe(false);
    expect(s2.annex).toBe(0);
    expect(s2.orders.rep.committee).toBe(1);
  });

  it('migrates a v4 save into a first run with nothing kept yet', () => {
    const st = { coin: 'N:5', orders: { active: null, progress: {}, done: [], rep: { bramble: 2, unit7: 1, voltaire: 0 } } };
    const d = migrate({ v: 4, saved: 0, seed: 1, snap: JSON.stringify(st) });
    expect(d.v).toBe(SAVE_VERSION);
    const s2 = stateFrom(d.snap as string);
    expect(s2.meta.runs).toBe(0);
    expect(s2.meta.patents.toNumber()).toBe(0);
    expect(s2.meta.drawer).toEqual([]);
    expect(s2.orders.rep.committee).toBe(0);
    expect(s2.orders.rep.bramble).toBe(2);
  });
});

describe('the Patent tree (DESIGN.md §19)', () => {
  it('has 33 nodes, 65 Patents in all at flat prices, bought with prerequisites first', () => {
    expect(PATENT_IDS.length).toBe(33);
    expect(PATENT_LIST.reduce((t, d) => t + d.cost, 0)).toBe(65);
    // (no node buys back Acts I-II research: a run after a reset knows it, the playability pass)
    for (const d of PATENT_LIST) if (d.effect.k === 'head') for (const r of d.effect.research ?? []) expect((RESEARCH[r].act ?? 1), `${d.id}: ${r}`).toBeGreaterThan(2);
    const g = sandbox();
    expect(patentRefusal(g, 'coalRights')).toMatch(/Needs Copper Deeds/);
    expect(patentRefusal(g, 'copperDeeds')).toMatch(/Costs 1 Patent/);
    give(g, 1);
    must(g, { k: 'patent', id: 'copperDeeds' });
    expect(g.s.meta.patents.toNumber()).toBe(0);
    expect(g.act({ k: 'patent', id: 'copperDeeds' }).ok).toBe(false);
  });

  it('rules: a wider fold box, quicker and more audits, bigger nested boxes', () => {
    const g = sandbox();
    expect(foldRefusal(g, { x: 0, y: 0, w: 9, h: 2 })).toMatch(/Too big/);
    buy(g, 'widerBox', 'quickAudit', 'moreAuditors', 'nestedBoxes');
    expect(foldRefusal(g, { x: 0, y: 8, w: 9, h: 2 })).not.toMatch(/Too big/);
    expect(auditTicks(g)).toBe(45 * TICK_RATE);
    expect(prules(g).maxAudits).toBe(5);
    expect(prules(g).nestedMax).toBe(8);
  });

  it("the Surveyor's Charter: a source design graded S or S+ holds half a claim, an A design a whole one", () => {
    const g = sandbox();
    const mk = (letter: string, mult: number) => {
      const d = fakeDesign(g, 'ironIngot', letter, mult);
      d.parts = [{ kind: 'miner', dx: 0, dy: 0, rot: 0, recipe: 'mineIron' }, { kind: 'smelter', dx: 1, dy: 0, rot: 0, recipe: 'smeltIron' }];
      return d;
    };
    const s = mk('S', 1.25), a = mk('A', 1.1);
    expect(claimLoad(g, s).ironOre).toBe(1);
    buy(g, 'surveyCharter');
    expect(claimLoad(g, s).ironOre).toBe(0.5);
    expect(claimLoad(g, a).ironOre).toBe(1);
    // the claims held are not changed: the rule is about the dig, not the deeds
    const held = claimsHeld(g, 'ironOre');
    expect(claimsHeld(g, 'ironOre')).toBe(held);
  });

  it('Fresh Dies: a better-graded refold starts its stamp price over', () => {
    const g = sandbox();
    const old = fakeDesign(g, 'gizmo', 'B', 1);
    old.stamped = 4;
    const better = fakeDesign(g, 'gizmo', 'S', 1.25);
    const before = stampCost(g, better).toNumber();
    buy(g, 'freshDies');
    const after = stampCost(g, better).toNumber();
    expect(after).toBeLessThan(before);
    expect(after).toBe(better.bill);
    // the worse design still counts the better one's copies
    expect(stampCost(g, old).toNumber()).toBeGreaterThan(old.bill);
  });

  it('offline efficiency: three Patent nodes of +0.05 and the Night Shift reach 0.75 and no further', () => {
    const g = sandbox();
    expect(offlineEfficiency(g)).toBe(0.5);
    buy(g, 'nightShift');
    expect(offlineEfficiency(g)).toBeCloseTo(0.55, 6);
    buy(g, 'nightWatch', 'lightsOn');
    expect(offlineEfficiency(g)).toBeCloseTo(0.65, 6);
    must(g, { k: 'idleUpgrade', id: 'nightForeman' });
    must(g, { k: 'idleUpgrade', id: 'nightRota' });
    expect(offlineEfficiency(g)).toBeCloseTo(0.75, 6);
  });

  it('the Shovel Frog clears a jammed machine; the Lab Assistant and Order Clerk pick for you', () => {
    const g = new Game(3);
    buy(g, 'shovelFrog', 'labAssistant', 'orderClerk');
    const f = g.entAt(3, 3)!;
    f.by = RULES.outputCap.value;
    f.byItem = 'slag';
    f.state = 'blocked';
    f.why = 'slag';
    g.step(TICK_RATE + 1);
    expect(f.by).toBeLessThan(RULES.outputCap.value);
    expect(g.s.research.selected).toBe('pressing');
    g.s.research.done.push('pressing');
    g.s.research.selected = null;
    g.step(TICK_RATE + 1);
    expect(g.s.orders.active).toBe('boardwalk');
  });

  it('the Stamp Press keeps one spare of a marked design', () => {
    const g = sandbox();
    buy(g, 'orderClerk', 'stampPress');
    const d = fakeDesign(g, 'gizmo', 'B', 1);
    d.spare = 0;
    must(g, { k: 'autoStamp', id: d.id });
    g.step(6 * TICK_RATE);
    expect(d.spare).toBe(1);
    expect(d.stamped).toBe(1);
    g.step(6 * TICK_RATE);
    expect(d.stamped).toBe(1);
  });
});

describe('the Patent Drawer (DESIGN.md §19)', () => {
  it('keeps a Workshop design (not a nested one), up to its slots, and forgets on request', () => {
    const g = sandbox();
    const ingots = foldIronLine(g);
    must(g, { k: 'keep', id: ingots.id });
    expect(g.act({ k: 'keep', id: ingots.id }).why).toMatch(/Already in the Patent Drawer/);
    const k = g.s.meta.drawer[0];
    expect(k).toMatchObject({ name: 'Ingots', x: 2, y: 11, w: 2, h: 2, product: 'ironIngot', run: 1 });
    // the box's own parts: the Miner, the Smelter and the slag belt under it
    expect(k.parts.map((p) => p.kind).sort()).toEqual(['belt', 'miner', 'smelter']);
    const nested = fakeDesign(g, 'gizmo', 'B', 1);
    nested.depth = 2;
    nested.fparts = [];
    expect(g.act({ k: 'keep', id: nested.id }).why).toMatch(/nested design/);
    // (and the Drawer trophies the sandbox earned: Well Read, DESIGN.md §24)
    expect(prules(g).drawerSlots).toBe(RULES.drawerSlots.value + trules(g).drawer);
    must(g, { k: 'forget', id: k.id });
    expect(g.s.meta.drawer).toHaveLength(0);
  });

  it('unfolds a kept design whole onto its box in a later run, for its bill, with the reasons when it cannot', () => {
    const g = sandbox();
    const ingots = foldIronLine(g);
    must(g, { k: 'keep', id: ingots.id });
    must(g, { k: 'reorganize' });
    const k = g.s.meta.drawer[0];
    // chunk C is not owned in the new run
    expect(unfoldKeptRefusal(g, k)?.waits).toBe('land');
    expect(g.act({ k: 'unfoldKept', id: k.id }).why).toMatch(/Chunk C/);
    g.s.land.push('C');
    expect(unfoldKeptRefusal(g, k)?.waits).toBe('coin');
    g.s.coin = N(keptBill(k));
    must(g, { k: 'unfoldKept', id: k.id });
    expect(g.s.coin.toNumber()).toBe(0);
    expect(g.entAt(2, 11)?.kind).toBe('miner');
    expect(g.entAt(3, 11)?.kind).toBe('smelter');
    expect(g.entAt(3, 11)?.recipe).toBe('smeltIron');
    expect(g.s.drafted).toEqual([k.id]);
    // in the way now: itself
    expect(unfoldKeptRefusal(g, k)?.waits).toBe('room');
  });

  it('the Draughtsman unfolds the queue in order, waiting on coin and passing over what cannot go yet', () => {
    const g = sandbox();
    const ingots = foldIronLine(g);
    must(g, { k: 'keep', id: ingots.id });
    must(g, { k: 'importDesign', code: encodeDesign({ name: 'Far', x: 20, y: 20, w: 1, h: 1, parts: [{ kind: 'belt', dx: 0, dy: 0, rot: 0, recipe: null }] }) });
    must(g, { k: 'reorganize' });
    const [a, far] = g.s.meta.drawer;
    must(g, { k: 'queueKept', id: far.id });
    must(g, { k: 'queueKept', id: a.id });
    expect(g.s.meta.queue).toEqual([far.id, a.id]);
    must(g, { k: 'queueKept', id: a.id, at: 0 });
    expect(g.s.meta.queue).toEqual([a.id, far.id]);
    g.s.land.push('C');
    g.s.coin = N(0);
    // without the node nothing happens
    g.step(6 * TICK_RATE);
    expect(g.entAt(2, 11)).toBeNull();
    buy(g, 'shovelFrog', 'draughtsman');
    g.step(6 * TICK_RATE);
    // waiting on coin for the first: the queue holds
    expect(g.entAt(2, 11)).toBeNull();
    g.s.coin = N(1e6);
    g.step(6 * TICK_RATE);
    expect(g.entAt(2, 11)?.kind).toBe('miner');
    // the far design's box (20,20) is off the Workshop: passed over, nothing placed for it
    g.step(12 * TICK_RATE);
    expect(g.entAt(20, 20)).toBeNull();
  });

  it('round-trips through an FWD1 string, refuses damaged strings with reasons, and compresses', () => {
    const g = sandbox();
    const ingots = foldIronLine(g);
    must(g, { k: 'keep', id: ingots.id });
    const k = g.s.meta.drawer[0];
    const code = encodeDesign(k);
    expect(code.startsWith('FWD1.')).toBe(true);
    const back = decodeDesign(code);
    expect(back).toMatchObject({ name: k.name, x: k.x, y: k.y, w: k.w, h: k.h, product: 'ironIngot' });
    expect([...back.parts].sort((p, q) => p.dy - q.dy || p.dx - q.dx)).toEqual([...k.parts].sort((p, q) => p.dy - q.dy || p.dx - q.dx));
    expect(() => decodeDesign('FWB1.abc.def')).toThrow(/not a Foldworks design/);
    const [, body, sum] = code.split('.');
    expect(() => decodeDesign(`FWD1.${body}x.${sum}`)).toThrow(/checksum/);
    expect(g.act({ k: 'importDesign', code: 'hello' }).why).toMatch(/not a Foldworks design/);
    must(g, { k: 'importDesign', code });
    expect(g.s.meta.drawer).toHaveLength(2);
    // a 16x16 belt ring with a Mk2 smelter is a short string, and the Mk2 keeps its footprint
    const parts: { kind: 'belt' | 'smelterMk2'; dx: number; dy: number; rot: Dir; recipe: string | null }[] = [];
    for (let i = 0; i < 16; i++) parts.push({ kind: 'belt', dx: i, dy: 0, rot: 0, recipe: null }, { kind: 'belt', dx: i, dy: 15, rot: 2, recipe: null });
    parts.push({ kind: 'smelterMk2', dx: 7, dy: 7, rot: 1, recipe: 'smeltSteel' });
    const ring = encodeDesign({ name: 'Ring', x: 0, y: 0, w: 16, h: 16, parts });
    expect(ring.length).toBeLessThan(130);
    const r2 = decodeDesign(ring);
    expect(r2.parts).toHaveLength(33);
    expect(r2.parts.find((p) => p.kind === 'smelterMk2')).toEqual({ kind: 'smelterMk2', dx: 7, dy: 7, rot: 1, recipe: 'smeltSteel' });
  });
});

describe('the Factory annex (DESIGN.md §19)', () => {
  it('sells blocks of two columns beside the Dock at linear prices, after Steam Power, and they hold modules', () => {
    const g = sandbox();
    g.s.research.done = g.s.research.done.filter((r) => r !== 'steamPower');
    g.first('factoryOpen');
    expect(g.act({ k: 'annex' }).why).toMatch(/Steam Power/);
    g.s.research.done.push('steamPower');
    const d = fakeDesign(g, 'gizmo', 'B', 1);
    expect(g.act({ k: 'fplace', design: d.id, x: FACTORY.w, y: 0, rot: 2 }).why).toMatch(/annex/);
    for (let n = 1; n <= ANNEX.blocks; n++) {
      expect(annexPrice(g)!.toNumber()).toBe(ANNEX.base * n);
      const coin = g.s.coin.toNumber();
      must(g, { k: 'annex' });
      expect(g.s.coin.toNumber()).toBe(coin - ANNEX.base * n);
      expect(g.fw).toBe(FACTORY.w + ANNEX.cols * n);
    }
    expect(annexPrice(g)).toBeNull();
    expect(g.act({ k: 'annex' }).why).toMatch(/all yours/);
    // the annex is east: the Floating City's row (south) never meets it
    expect(g.fh).toBe(FACTORY.h);
    must(g, { k: 'fplace', design: d.id, x: g.fw - 1, y: 7, rot: 2 });
    expect(g.fentAt(g.fw - 1, 7)?.kind).toBe('module');
  });
});

describe('the Committee (DESIGN.md §19)', () => {
  it('is met after the first Reorganize once Folding is done, with the Great Drill research, or once its stage 1 stands', () => {
    const g = sandbox();
    g.s.research.done = g.s.research.done.filter((r) => r !== 'greatDrill');
    expect(customerMet(g, 'committee')).toBe(false);
    expect(offeredOrders(g).some((o) => o.customer === 'committee')).toBe(false);
    g.s.mega.stage = 1;
    expect(customerMet(g, 'committee')).toBe(true);
    g.s.mega.stage = 0;
    g.s.meta.runs = 1;
    expect(customerMet(g, 'committee')).toBe(true);
    g.s.research.done = g.s.research.done.filter((r) => r !== 'folding');
    expect(customerMet(g, 'committee')).toBe(false);
    g.s.meta.runs = 0;
    g.s.research.done.push('greatDrill');
    expect(customerMet(g, 'committee')).toBe(true);
  });

  it('The Pile: the Dock takes slag while it is wanted, and pays coin and reputation', () => {
    const g = sandbox();
    g.s.meta.runs = 1;
    must(g, { k: 'order', id: 'thePile' });
    must(g, { k: 'place', kind: 'heap', x: 4, y: 2, rot: 0 });
    must(g, { k: 'place', kind: 'belt', x: 5, y: 2, rot: 0 });
    g.entAt(4, 2)!.count = 400;
    g.step(60 * TICK_RATE);
    expect(g.s.orders.progress.thePile?.slag?.toNumber() ?? 0).toBeGreaterThan(50);
    g.s.orders.progress.thePile = { slag: N(800) };
    const coin = g.s.coin.toNumber();
    g.step(2);
    expect(g.s.orders.done).toContain('thePile');
    expect(g.s.coin.toNumber()).toBe(coin + 1600);
    expect(g.s.orders.rep.committee).toBe(1);
    // with the order filled, the Dock refuses slag again
    const left = g.entAt(4, 2)!.count;
    g.step(20 * TICK_RATE);
    expect(g.entAt(4, 2)!.count).toBeGreaterThanOrEqual(left - 3);
    // reputation 1: Coat Pockets, modules hold 6 s
    expect(prules(g).moduleBuffer).toBe(6);
  });

  it("reputation 2: the Night Crew empties heaps only while you are away (it never ends Act I's slag puzzle)", () => {
    const g = sandbox();
    g.s.orders.rep.committee = 2;
    must(g, { k: 'place', kind: 'heap', x: 10, y: 10, rot: 0 });
    g.entAt(10, 10)!.count = 100;
    g.step(60 * TICK_RATE);
    expect(g.entAt(10, 10)!.count).toBe(100);
    must(g, { k: 'visible', v: false });
    g.step(60 * TICK_RATE);
    expect(g.entAt(10, 10)!.count).toBe(94);
  });
});

describe('the Great Drill, stages 2 and 3 (DESIGN.md §19)', () => {
  /** A Bay with stage 1 done, and a Steel source and a bit source straight into it. */
  function bay() {
    const g = sandbox();
    g.s.mega.stage = 1;
    g.first('factoryOpen');
    g.step(TICK_RATE * 2);
    expect(g.s.factory.ents.some((e) => e.kind === 'fbay')).toBe(true);
    const part = [{ kind: 'smelter' as const, dx: 0, dy: 0, rot: 0 as const, recipe: null }];
    const st = fakeDesign(g, 'steel', 'B', 1, {}, 5);
    st.parts = part;
    const bit = fakeDesign(g, 'drillBit', 'B', 1, {}, 1);
    bit.parts = part;
    must(g, { k: 'fplace', design: st.id, x: 2, y: 6, rot: 2 });
    must(g, { k: 'fplace', design: bit.id, x: 0, y: 5, rot: 1 });
    return g;
  }

  it('stage 2 opens at the Committee\'s reputation 3, stage 3 at 5; until then the Bay never jams', () => {
    expect(MEGA.map((m) => [m.stage, m.rep ?? 0])).toEqual([[1, 0], [2, 3], [3, 5]]);
    const g = bay();
    expect(megaOpen(g, megaStage(1))).toBe(false);
    const coin = g.s.coin.toNumber();
    g.step(30 * TICK_RATE);
    // shut: nothing counted, no Patents, but the steel goes on to the Dock and sells (the bits are
    // scrapped), so the modules feeding the Bay keep running
    expect(Object.keys(g.s.mega.progress)).toHaveLength(0);
    expect(g.s.megaPatents).toBe(0);
    expect(g.s.coin.toNumber()).toBeGreaterThan(coin);
    for (const m of g.s.factory.ents.filter((e) => e.kind === 'module')) expect(m.state, `${g.design(m.design)?.name}: ${m.why}`).not.toBe('blocked');
    // reputation 3 opens it: counted, and Patents earned in proportion
    g.s.orders.rep.committee = 3;
    g.step(30 * TICK_RATE);
    expect(g.s.mega.progress.steel?.toNumber() ?? 0).toBeGreaterThan(0);
    expect(g.s.mega.progress.drillBit?.toNumber() ?? 0).toBeGreaterThan(0);
    expect(g.s.megaPatents).toBeGreaterThan(0);
    // a part in full: its surplus goes on to the Dock too, never past the want
    g.step(200 * TICK_RATE);
    expect(g.s.mega.progress.steel!.toNumber()).toBeLessThanOrEqual(MEGA[1].wants.steel!);
  });

  it('stage 2 lets a Miner dig from beside a patch; stage 3 opens deep deposits in chunk D', () => {
    const g = sandbox();
    expect(g.canPlace('miner', 0, 2)).toMatch(/goes on an ore patch/);
    g.s.mega.stage = 2;
    g.rebuild();
    expect(g.canPlace('miner', 0, 2)).toBeNull();
    must(g, { k: 'place', kind: 'miner', x: 0, y: 2, rot: 1 });
    expect(g.entAt(0, 2)!.recipe).toBe('mineIron');
    expect(g.oreAt(9, 10)).toBeNull();
    const before = claimsHeld(g, 'copperOre');
    g.s.mega.stage = 3;
    g.rebuild();
    expect(g.oreAt(9, 10)).toBe('ironOre');
    expect(g.oreAt(13, 13)).toBe('copperOre');
    expect(claimsHeld(g, 'copperOre')).toBe(before + RULES.claimsPerDeposit.value);
  });
});

describe('the returning run (DESIGN.md §19 "What a Reorganize keeps", the playability pass)', () => {
  /** A run with the iron line folded and kept, reset once. */
  function returned(seed = 1): { g: Game; kept: number } {
    const g = sandbox(seed);
    const ingots = foldIronLine(g);
    must(g, { k: 'keep', id: ingots.id });
    must(g, { k: 'reorganize' });
    return { g, kept: g.s.meta.drawer[0].id };
  }

  it('a kept design comes back as a module design at its kept grade and rates, free once, stamped as ever', () => {
    const g0 = sandbox();
    const ingots = foldIronLine(g0);
    must(g0, { k: 'keep', id: ingots.id });
    const was = { grade: ingots.grade.letter, outs: { ...ingots.outs }, bill: ingots.bill };
    must(g0, { k: 'reorganize' });
    const d = g0.s.designs.find((q) => q.name === 'Ingots')!;
    expect(d.kept).toBe(g0.s.meta.drawer[0].id);
    expect(d.grade.letter).toBe(was.grade);
    for (const [it, v] of Object.entries(was.outs)) expect(d.outs[it as never], it).toBeCloseTo(v as number, 9);
    expect(d.bill).toBe(was.bill);
    expect(d.spare).toBe(RULES.returnCopies.value);
    // placeable on the Factory floor from the first tick: the floor is open, no fold needed
    expect(g0.flag('factoryOpen')).toBe(true);
    must(g0, { k: 'fplace', design: d.id, x: 2, y: 2, rot: 0 });
    // the next copy is a stamp at bill x (1 + 0.5 n), as for a design folded now
    expect(stampCost(g0, d).toNumber()).toBe(d.bill);
    // it is kept already, never twice; it files nothing new (it is on file)
    expect(g0.act({ k: 'keep', id: d.id }).why).toMatch(/kept already/);
    expect(previewPatents(g0).lines.find((l) => l.item === 'ironIngot')?.status).toBe('filed');
  });

  it('knows Acts I-II from the first tick (keyed off each node\'s act), nothing of Act III', () => {
    const { g } = returned();
    const want = RESEARCH_IDS.filter((r) => (RESEARCH[r].act ?? 1) <= 2 && !RESEARCH[r].world);
    expect(want.length).toBe(26);
    expect(g.s.research.done).toEqual(want);
    expect(g.s.research.done).not.toContain('zoning');
  });

  it('a Challenge run is built from scratch: no design comes back, and its goal order is offered again', () => {
    const g = sandbox();
    const ingots = foldIronLine(g);
    must(g, { k: 'keep', id: ingots.id });
    g.s.orders.done.push('gizmoFestival');
    must(g, { k: 'reorganize' });
    expect(g.s.meta.ordersFilled).toContain('gizmoFestival');
    expect(offeredOrders(g).some((o) => o.id === 'gizmoFestival')).toBe(false);
    // a second reset, into the Challenge whose goal is the Festival
    g.s.research.done = [...RESEARCH_IDS];
    fakeDesign(g, 'steel', 'S', 1.25);
    must(g, { k: 'reorganize', challenge: 'smallBoxes' });
    expect(g.s.designs).toEqual([]);
    expect(offeredOrders(g).some((o) => o.id === 'gizmoFestival')).toBe(true);
  });

  it('an order filled once is never offered again, and the Town stands on it after the reset', () => {
    const g = new Game(5);
    g.s.research.done.push('pressing');
    expect(offeredOrders(g).map((o) => o.id)).toContain('boardwalk');
    g.s.orders.active = 'boardwalk';
    g.s.orders.progress.boardwalk = { ironPlate: N(80) };
    g.step(2);
    expect(g.s.orders.done).toContain('boardwalk');
    const at = g.s.orders.doneAt!.boardwalk;
    resettable(g);
    must(g, { k: 'reorganize' });
    expect(g.s.orders.done).toEqual([]);
    expect(g.s.meta.ordersFilled).toEqual(['boardwalk']);
    expect(g.s.meta.ordersAt?.boardwalk).toBe(at);
    expect(orderFilled(g, 'boardwalk')).toBe(true);
    expect(ordersEverFilled(g)).toEqual(['boardwalk']);
    // the research is known again, and still Bramble does not ask for the Boardwalk twice
    expect(g.done('pressing')).toBe(true);
    expect(offeredOrders(g).map((o) => o.id)).not.toContain('boardwalk');
    expect(offeredOrders(g).map((o) => o.id)).toContain('lampPosts');
    expect(g.s.orders.rep.bramble).toBe(1);
    // the Committee's orders are its reputation, the Great Drill's gate: offered every run
    g.s.meta.ordersFilled!.push('thePile');
    g.s.research.done.push('folding');
    g.s.mega.stage = 1;
    expect(orderFilled(g, 'thePile')).toBe(false);
    expect(offeredOrders(g).map((o) => o.id)).toContain('thePile');
  });

  it('Dies on file: a Patent a copy of a kept design, at most four, back as Patents when it is forgotten', () => {
    const { g, kept } = returned();
    const d = g.s.designs.find((q) => q.kept === kept)!;
    g.s.meta.patents = Num.ZERO;
    expect(dieRefusal(g, kept)).toMatch(/costs 1 Patent/);
    give(g, 10);
    const p0 = g.s.meta.patents.toNumber();
    for (let i = 0; i < RULES.dieCopiesMax.value; i++) must(g, { k: 'die', id: kept });
    expect(g.act({ k: 'die', id: kept }).why).toMatch(/the most/);
    expect(g.s.meta.patents.toNumber()).toBe(p0 - RULES.dieCopiesMax.value);
    // this run's copies came at once; every later run starts with 1 + 4
    expect(d.spare).toBe(1 + RULES.dieCopiesMax.value);
    expect(returnCopies(g, g.s.meta.drawer[0])).toBe(1 + RULES.dieCopiesMax.value);
    fakeDesign(g, 'steel', 'S', 1.25);
    must(g, { k: 'reorganize' });
    expect(g.s.designs.find((q) => q.kept === kept)!.spare).toBe(1 + RULES.dieCopiesMax.value);
    const p1 = g.s.meta.patents.toNumber();
    must(g, { k: 'forget', id: kept });
    expect(g.s.meta.patents.toNumber()).toBe(p1 + RULES.dieCopiesMax.value);
  });

  it('the card can tell when a reset buys nothing: the tree bought out and every die on file', () => {
    const { g, kept } = returned();
    expect(spendable(g, 5).nodes.length).toBeGreaterThan(0);
    expect(spendable(g).full).toBe(false);
    for (const id of PATENT_IDS) if (!g.s.meta.nodes.includes(id)) g.s.meta.nodes.push(id);
    expect(spendable(g, 5).nodes).toEqual([]);
    expect(spendable(g, 5).dies).toBe(RULES.dieCopiesMax.value);
    expect(spendable(g).full).toBe(false);
    g.s.meta.dies = { [kept]: RULES.dieCopiesMax.value };
    expect(spendable(g, 100)).toEqual({ nodes: [], dies: 0, full: true });
  });

  it('the Floor Plan lays the last Reorganize\'s Factory floor again: trunks paid, modules from spare copies', () => {
    const g = sandbox();
    const ingots = foldIronLine(g);
    must(g, { k: 'keep', id: ingots.id });
    buy(g, 'shovelFrog', 'draughtsman', 'notebooks');
    must(g, { k: 'fplace', design: ingots.id, x: 3, y: 3, rot: 0 });
    must(g, { k: 'ftrunk', x: 4, y: 3, rot: 0 });
    must(g, { k: 'ftrunk', x: 5, y: 3, rot: 1 });
    must(g, { k: 'reorganize' });
    expect(g.s.meta.floorPlan).toEqual([
      { kind: 'module', x: 3, y: 3, rot: 0, item: 'ironIngot' },
      { kind: 'trunk', x: 4, y: 3, rot: 0 },
      { kind: 'trunk', x: 5, y: 3, rot: 1 },
    ]);
    g.s.coin = N(1000);
    g.step(10 * TICK_RATE);
    const at = (x: number, y: number) => g.fentAt(x, y);
    expect(at(3, 3)?.kind).toBe('module');
    expect(g.design(at(3, 3)!.design)?.kept).toBe(g.s.meta.drawer[0].id);
    expect(at(4, 3)).toMatchObject({ kind: 'trunk', rot: 0 });
    expect(at(5, 3)).toMatchObject({ kind: 'trunk', rot: 1 });
    expect(g.s.coin.toNumber()).toBe(1000 - 2 * FACTORY.trunkCost);
  });

  it('notes the run\'s pace: its Act II floor\'s peak, and when it passed the run before\'s', () => {
    const g = new Game(3);
    g.s.income = Array(60).fill(100);
    for (let i = 0; i < 6 * 60; i++) { g.s.income.fill(100); g.step(TICK_RATE); }
    expect(g.s.meta.factoryPeak).toBeGreaterThan(0);
    const peak = g.s.meta.factoryPeak!;
    resettable(g);
    must(g, { k: 'reorganize' });
    expect(g.s.meta.history[0].factoryPeak).toBe(peak);
    expect(g.s.meta.caughtUp).toBeUndefined();
    for (let i = 0; i < 10 * 60 && g.s.meta.caughtUp === undefined; i++) { g.s.income.fill(1000); g.step(TICK_RATE); }
    expect(g.s.meta.caughtUp).toBeGreaterThan(0);
    expect(g.s.meta.caughtUp).toBeLessThanOrEqual(6 * 60);
  });

  it('migrates a v12 save: the old head starts refunded, and the orders filled before written down from reputation', () => {
    const st = {
      coin: 'N:5',
      meta: { runs: 2, runStart: 0, patents: 'N:3', patentsEarned: 'N:30', nodes: ['bellows', 'surveyCharter', 'glassNotes', 'copperDeeds'], habits: ['notebooks', 'surveyCharter'], patented: {}, drawer: [], nextKept: 1, queue: [], lifetime: { earned: 'N:0', delivered: {}, folds: 0 }, history: [], peakPerMin: 0, perMinRing: [] },
      orders: { active: null, progress: {}, done: ['boardwalk'], rep: { bramble: 4, unit7: 1, voltaire: 0, committee: 2 } },
    };
    const d = migrate({ v: 12, saved: 0, seed: 1, snap: JSON.stringify(st), log: [] });
    expect(d.v).toBe(SAVE_VERSION);
    const s2 = stateFrom(d.snap as string);
    expect(s2.meta.nodes).toEqual(['surveyCharter']);
    expect(s2.meta.habits).toEqual(['surveyCharter']);
    // Bellows 1, Glass and Gravel Notes 2, Copper Deeds 1 (its old price) back: 3 + 4
    expect(s2.meta.patents.toNumber()).toBe(7);
    // Bramble's 4: 1 this run (the Boardwalk), so 3 of Acts I-II's before; Unit 7's 1; the Committee's 2
    expect(s2.meta.ordersFilled).toEqual(['boardwalk', 'lampPosts', 'gizmoFestival', 'calibration', 'thePile', 'midnightOil']);
    // a first run's save has no earlier runs to write down
    const first = migrate({ v: 12, saved: 0, seed: 1, snap: JSON.stringify({ ...st, meta: { ...st.meta, runs: 0 } }), log: [] });
    expect(stateFrom(first.snap as string).meta.ordersFilled).toBeUndefined();
  });
});
