// Reorganize, layer 1 (ROADMAP.md Milestone 5, DESIGN.md §19): the Patents formula and its preview,
// the reset (what is kept, what is lost), head starts, the Patent tree's rules and automation,
// blueprints, ghosts, the dragonflies and the FWB1 share strings, the Committee and its bearings,
// the Great Drill's stages 2 and 3, determinism across a reset, saves and the v4 -> v5 migration.
import { describe, expect, it } from 'vitest';
import { Game, type Cmd } from '../src/sim/Game';
import { N, Num } from '../src/engine/num';
import { RESEARCH_IDS } from '../src/data/research';
import { CHUNKS } from '../src/data/land';
import { RULES } from '../src/data/rules';
import { MEGA } from '../src/data/megaprojects';
import { PATENTS, PATENT_IDS, type PatentId } from '../src/data/patents';
import { TICK_RATE } from '../src/engine/time';
import { auditTicks, foldRefusal } from '../src/sim/systems/audits';
import { claimsHeld } from '../src/sim/systems/claims';
import { offeredOrders } from '../src/sim/systems/orders';
import { stampCost } from '../src/sim/systems/modules';
import { chainSteps, previewPatents, reorganizeRefusal, customerMet, runSeconds } from '../src/sim/reorganize';
import { prules, patentRefusal } from '../src/sim/patents';
import { offlineEfficiency } from '../src/sim/offline';
import { decodeBlueprint, encodeBlueprint, ghostAt } from '../src/sim/blueprints';
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

/** The iron line folded (worth 0.6 of a Patent at S), and a Gizmo design beside it (2 more). */
function foldIronLine(g: Game) {
  ironLine(g);
  g.step(30 * TICK_RATE);
  must(g, { k: 'audit', x: 2, y: 11, w: 2, h: 2 });
  g.step(auditTicks(g) + 1);
  must(g, { k: 'fold', name: 'Ingots' });
  fakeDesign(g, 'gizmo', 'B', 1);
}

/** A design of a product at a grade, put straight into the inventory (the preview reads designs). */
function fakeDesign(g: Game, item: string, letter: string, mult: number): ModuleDesign {
  const d: ModuleDesign = {
    id: g.s.nextDesign++, name: item, box: { x: 0, y: 0, w: 1, h: 1 }, parts: [], ins: {}, outs: { [item]: 1 } as never,
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

describe('the Patents formula (DESIGN.md §19)', () => {
  it('counts chain steps from raw ore off the recipes', () => {
    expect(chainSteps('ironOre')).toBe(0);
    expect(chainSteps('ironIngot')).toBe(1);
    expect(chainSteps('ironPlate')).toBe(2);
    expect(chainSteps('gear')).toBe(3);
    expect(chainSteps('gizmo')).toBe(4);
    expect(chainSteps('glass')).toBe(1);
    expect(chainSteps('steel')).toBe(2);
    expect(chainSteps('concrete')).toBe(3);
    expect(chainSteps('circuit')).toBe(3);
    expect(chainSteps('motor')).toBe(4);
    expect(chainSteps('drillBit')).toBe(5);
  });

  it('a fresh run is worth nothing and is refused; a fold makes it worth a Patent or so', () => {
    const g = sandbox();
    g.s.coin = N(0);
    expect(previewPatents(g).now).toBe(0);
    expect(reorganizeRefusal(g)).toMatch(/fold a line/);
    expect(g.act({ k: 'reorganize' }).ok).toBe(false);
  });

  it('is half a Patent a chain step of each distinct product, at its best grade, plus works and Megaproject terms', () => {
    const g = sandbox();
    g.s.coin = N(0);
    g.s.earned = N(0);
    fakeDesign(g, 'gizmo', 'A', 1.1);
    fakeDesign(g, 'gizmo', 'S', 1.25); // the best grade counts, once
    fakeDesign(g, 'ironIngot', 'B', 1);
    fakeDesign(g, 'slag', 'B', 1); // a byproduct is never patented
    const p = previewPatents(g);
    expect(p.lines.map((l) => l.item).sort()).toEqual(['gizmo', 'ironIngot']);
    expect(p.designs).toBeCloseTo(0.5 * 4 * 1.25 + 0.5 * 1 * 1, 6);
    expect(p.works).toBe(0);
    // invested coin: log2(1 + invested / 100,000); 300,000 put in is 2 Patents
    g.s.earned = N(300000);
    expect(previewPatents(g).works).toBeCloseTo(2, 6);
    // a goal: fold the next product (the drill bit, 5 steps, is the best unfolded one)
    const fold = previewPatents(g).goals.find((q) => q.kind === 'fold')!;
    expect(fold.gain).toBeCloseTo(2.5, 6);
    expect(previewPatents(g).nextStep).toBe(Math.floor(previewPatents(g).total + 2.5));
  });

  it('an idle slice factory (ingots, wire, Gizmos) is worth far fewer than an Act II run', () => {
    const slice = sandbox();
    slice.s.coin = N(0);
    fakeDesign(slice, 'ironIngot', 'S+', 1.35);
    fakeDesign(slice, 'copperWire', 'S', 1.25);
    fakeDesign(slice, 'gizmo', 'A', 1.1);
    slice.s.earned = N(60000);
    const act2 = sandbox();
    act2.s.coin = N(0);
    for (const [it, l, m] of [['ironIngot', 'S', 1.25], ['copperWire', 'S', 1.25], ['gizmo', 'A', 1.1], ['steel', 'A', 1.1], ['concrete', 'B', 1], ['circuit', 'C', 0.9], ['plastic', 'C', 0.9], ['glass', 'D', 0.75], ['drillBit', 'D', 0.75]] as [string, string, number][]) fakeDesign(act2, it, l, m);
    act2.s.megaPatents = MEGA[0].patents;
    act2.s.earned = N(280000);
    const a = previewPatents(slice).now, b = previewPatents(act2).now;
    expect(a).toBeLessThanOrEqual(6);
    expect(b).toBeGreaterThanOrEqual(12);
    expect(b).toBeLessThanOrEqual(20);
  });
});

describe('the reset (DESIGN.md §19)', () => {
  it('keeps meta, the Megaproject, the Codex, reputation, trophies and counters; loses the run', () => {
    const g = sandbox();
    foldIronLine(g);
    g.s.mega = { stage: 1, progress: { steel: N(5) } };
    g.s.codex.push('steel');
    g.s.orders.rep.bramble = 3;
    g.s.flags.push('trophy:pocketMoney', 'sliceEnd');
    g.s.counters.folds = 7;
    must(g, { k: 'bpSave', x: 2, y: 11, w: 2, h: 3, name: 'Line' });
    const tick = g.s.tick;
    const p = previewPatents(g).now;
    expect(p).toBeGreaterThanOrEqual(1);
    const earned = g.s.earned;
    must(g, { k: 'reorganize' });
    const s = g.s;
    expect(s.tick).toBe(tick);
    expect(s.meta.runs).toBe(1);
    expect(s.meta.runStart).toBe(tick);
    expect(runSeconds(g)).toBe(0);
    expect(s.meta.patents.toNumber()).toBe(p);
    expect(s.meta.history[0].patents).toBe(p);
    expect(s.meta.lifetime.earned.toNumber()).toBe(earned.toNumber());
    expect(s.meta.blueprints).toHaveLength(1);
    expect(s.mega.stage).toBe(1);
    expect(s.mega.progress.steel?.toNumber()).toBe(5);
    expect(s.codex).toContain('steel');
    expect(s.orders.rep.bramble).toBe(3);
    expect(s.flags).toContain('trophy:pocketMoney');
    expect(s.flags).not.toContain('sliceEnd');
    expect(s.counters.folds).toBe(7);
    // lost
    expect(s.coin.toNumber()).toBe(0);
    expect(s.earned.toNumber()).toBe(0);
    expect(s.land).toEqual(['A']);
    expect(s.research.done).toEqual([]);
    expect(s.designs).toEqual([]);
    expect(s.upgrades).toEqual([]);
    expect(s.orders.done).toEqual([]);
    // the starting layout is back
    expect(g.entAt(3, 3)?.kind).toBe('furnace');
    expect(g.entAt(6, 1)?.kind).toBe('dock');
    expect(g.entAt(2, 11)).toBeNull();
    expect(s.factory.ents.filter((e) => e.kind === 'module')).toHaveLength(0);
  });

  it('head starts bought in the tree shape the next run', () => {
    const g = sandbox();
    foldIronLine(g);
    buy(g, 'bellows', 'starterLine', 'notebooks', 'copperDeeds', 'grant');
    must(g, { k: 'reorganize' });
    const s = g.s;
    expect(s.upgrades).toContain('bellows');
    expect(g.entAt(2, 3)?.kind).toBe('miner');
    expect(s.research.done).toEqual(['pressing', 'surveyEast', 'copperSmelting', 'wireDrawing']);
    expect(s.land).toContain('B');
    expect(s.coin.toNumber()).toBe(2000);
    // head-start coin is not "invested": the works term starts at 0
    expect(previewPatents(g).works).toBe(0);
  });

  it('a reset in the command log replays to the same state', () => {
    const play = (keep: boolean) => {
      const g = new Game(7, { keepHistory: keep });
      g.s.designs.push({ id: 99, name: 'x', box: { x: 0, y: 0, w: 1, h: 1 }, parts: [], ins: {}, outs: { gizmo: 1 }, grade: { letter: 'B', score: 0.7, u: 1, w: 1, c: 1, mult: 1 }, bill: 0, stamped: 0, spare: 0 });
      return g;
    };
    // the live run
    const a = play(true);
    a.step(100);
    a.act({ k: 'reorganize' });
    a.act({ k: 'patent', id: 'bellows' });
    a.step(300);
    a.act({ k: 'click', x: 2, y: 3 });
    a.step(300);
    // the replay: the same seed and starting design, then the history
    const b = play(true);
    let i = 0;
    const hist = a.history!;
    while (b.s.tick < a.s.tick) {
      while (i < hist.length && hist[i].t === b.s.tick) b.act(hist[i++].c);
      b.tick();
    }
    expect(fingerprint(b)).toBe(fingerprint(a));
    expect(b.s.meta.nodes).toEqual(['bellows']);
    expect(b.s.meta.runs).toBe(1);
  });

  it('a save after a reset restores Patents, blueprints and bearings as Nums', () => {
    const g = sandbox();
    foldIronLine(g);
    must(g, { k: 'bpSave', x: 2, y: 11, w: 2, h: 3, name: 'Line' });
    must(g, { k: 'reorganize' });
    g.s.meta.bearings = N(3);
    const p = savePayload(g, 0);
    const h = restore(p);
    expect(h.s.meta.patents).toBeInstanceOf(Num);
    expect(h.s.meta.patents.toNumber()).toBe(g.s.meta.patents.toNumber());
    expect(h.s.meta.bearings.toNumber()).toBe(3);
    expect(h.s.meta.blueprints[0].parts.length).toBe(g.s.meta.blueprints[0].parts.length);
    expect(fingerprint(h)).toBe(fingerprint(g));
    expect(stateFrom(p.snap).meta.runs).toBe(1);
  });

  it('migrates a v4 save into a first run with nothing kept yet', () => {
    const st = { coin: 'N:5', orders: { active: null, progress: {}, done: [], rep: { bramble: 2, unit7: 1, voltaire: 0 } } };
    const d = migrate({ v: 4, saved: 0, seed: 1, snap: JSON.stringify(st) });
    expect(d.v).toBe(SAVE_VERSION);
    const s2 = stateFrom(d.snap as string);
    expect(s2.meta.runs).toBe(0);
    expect(s2.meta.patents.toNumber()).toBe(0);
    expect(s2.meta.blueprints).toEqual([]);
    expect(s2.ghosts).toEqual([]);
    expect(s2.orders.rep.committee).toBe(0);
    expect(s2.orders.rep.bramble).toBe(2);
  });
});

describe('the Patent tree (DESIGN.md §19)', () => {
  it('has about 30 nodes at flat prices, bought with prerequisites first', () => {
    expect(PATENT_IDS.length).toBeGreaterThanOrEqual(28);
    const g = sandbox();
    expect(patentRefusal(g, 'starterLine')).toMatch(/Needs Bellows/);
    expect(patentRefusal(g, 'bellows')).toMatch(/Costs 1 Patent/);
    give(g, 1);
    must(g, { k: 'patent', id: 'bellows' });
    expect(g.s.meta.patents.toNumber()).toBe(0);
    expect(g.act({ k: 'patent', id: 'bellows' }).ok).toBe(false);
  });

  it('rules: a wider fold box, quicker and more audits, deeper heaps, more claims, bigger nested boxes', () => {
    const g = sandbox();
    expect(foldRefusal(g, { x: 0, y: 0, w: 9, h: 2 })).toMatch(/Too big/);
    const claims0 = claimsHeld(g, 'ironOre');
    buy(g, 'widerBox', 'quickAudit', 'moreAuditors', 'deepHeaps', 'surveyCharter', 'nestedBoxes', 'coolHands', 'stampDies');
    expect(foldRefusal(g, { x: 0, y: 8, w: 9, h: 2 })).not.toMatch(/Too big/);
    expect(auditTicks(g)).toBe(45 * TICK_RATE);
    expect(prules(g).maxAudits).toBe(5);
    expect(prules(g).heapCap).toBe(800);
    expect(claimsHeld(g, 'ironOre')).toBe(claims0 + 2);
    expect(prules(g).nestedMax).toBe(8);
    expect(prules(g).overdriveCool).toBe(20);
    const d = fakeDesign(g, 'gizmo', 'B', 1);
    d.stamped = 2;
    expect(stampCost(g, d).toNumber()).toBe(Math.round(100 * (1 + 0.3 * 2)));
  });

  it('offline efficiency rises to 0.75 and no further', () => {
    const g = sandbox();
    expect(offlineEfficiency(g)).toBe(0.5);
    buy(g, 'nightShift');
    expect(offlineEfficiency(g)).toBeCloseTo(0.6, 6);
    buy(g, 'nightWatch', 'lightsOn');
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

describe('blueprints, ghosts and the dragonflies (DESIGN.md §19)', () => {
  it('saves a box, round-trips through an FWB1 string, and refuses damaged strings with reasons', () => {
    const g = sandbox();
    ironLine(g);
    must(g, { k: 'bpSave', x: 2, y: 11, w: 4, h: 3, name: 'Iron line' });
    const bp = g.s.meta.blueprints[0];
    expect(bp.parts.map((p) => p.kind).sort()).toEqual(['belt', 'belt', 'belt', 'heap', 'miner', 'smelter']);
    const code = encodeBlueprint(bp);
    expect(code.startsWith('FWB1.')).toBe(true);
    const back = decodeBlueprint(code);
    expect(back).toEqual({ name: bp.name, w: bp.w, h: bp.h, parts: bp.parts });
    expect(() => decodeBlueprint('FW1.abc.def')).toThrow(/not a Foldworks blueprint/);
    const [, body, sum] = code.split('.');
    expect(() => decodeBlueprint(`FWB1.${body}x.${sum}`)).toThrow(/checksum/);
    expect(g.act({ k: 'bpImport', code: 'hello' }).why).toMatch(/not a Foldworks blueprint/);
    must(g, { k: 'bpImport', code });
    expect(g.s.meta.blueprints).toHaveLength(2);
  });

  it('compresses: a 16x16 box with a belt ring is a short string, and a Mk2 keeps its footprint', () => {
    const parts: { kind: 'belt' | 'smelterMk2'; dx: number; dy: number; rot: Dir; recipe: string | null }[] = [];
    for (let i = 0; i < 16; i++) parts.push({ kind: 'belt', dx: i, dy: 0, rot: 0, recipe: null }, { kind: 'belt', dx: i, dy: 15, rot: 2, recipe: null });
    parts.push({ kind: 'smelterMk2', dx: 7, dy: 7, rot: 1, recipe: 'smeltSteel' });
    const code = encodeBlueprint({ name: 'Ring', w: 16, h: 16, parts });
    // 256 cells raw would be 342 base64 characters
    expect(code.length).toBeLessThan(120);
    const back = decodeBlueprint(code);
    expect(back.parts).toHaveLength(33);
    expect(back.parts.find((p) => p.kind === 'smelterMk2')).toEqual({ kind: 'smelterMk2', dx: 7, dy: 7, rot: 1, recipe: 'smeltSteel' });
  });

  it('places ghosts that do nothing, refuses a clash, and builds them by hand or all at once', () => {
    const g = sandbox();
    ironLine(g);
    must(g, { k: 'bpSave', x: 2, y: 11, w: 2, h: 2, name: 'Pair' });
    const id = g.s.meta.blueprints[0].id;
    // the same place: already built
    expect(g.act({ k: 'bpPlace', id, x: 2, y: 11 }).why).toMatch(/already built/);
    // on the first iron patch, where the furnace's neighbours are free (1,2) is ore
    expect(g.act({ k: 'bpPlace', id, x: 9, y: 9 }).why).toMatch(/not stand on ore/);
    must(g, { k: 'bpPlace', id, x: 1, y: 2 });
    // the miner, the smelter and the slag belt under it
    expect(g.s.ghosts).toHaveLength(3);
    expect(g.entAt(1, 2)).toBeNull();
    const coin = g.s.coin.toNumber();
    must(g, { k: 'ghostBuild', x: 1, y: 2 });
    expect(g.entAt(1, 2)?.kind).toBe('miner');
    expect(g.s.coin.toNumber()).toBe(coin - 40);
    must(g, { k: 'ghostBuildAll' });
    expect(g.entAt(2, 2)?.kind).toBe('smelter');
    expect(g.s.ghosts).toHaveLength(0);
  });

  it('a building put on a ghost by hand takes its place; ghosts are lost at a reset, blueprints kept', () => {
    const g = sandbox();
    ironLine(g);
    must(g, { k: 'bpSave', x: 2, y: 11, w: 2, h: 2, name: 'Pair' });
    must(g, { k: 'bpPlace', id: 1, x: 1, y: 2 });
    must(g, { k: 'place', kind: 'belt', x: 2, y: 2, rot: 0 });
    expect(ghostAt(g, 2, 2)).toBeNull();
    expect(g.s.ghosts).toHaveLength(2);
  });

  it('the Builder Dragonfly builds a ghost every 2 s as coin allows', () => {
    const g = sandbox();
    for (let x = 8; x < 16; x++) for (let y = 6; y < 8; y++) g.s.ghosts.push({ kind: 'belt', x, y, rot: 0, recipe: null });
    g.step(5 * TICK_RATE);
    expect(g.s.ghosts).toHaveLength(16);
    buy(g, 'shovelFrog', 'dragonfly');
    g.step(10 * TICK_RATE);
    expect(g.s.ghosts.length).toBe(11);
    buy(g, 'dragonflies');
    g.step(4 * TICK_RATE);
    expect(g.s.ghosts.length).toBe(5);
    // no coin, no building
    g.s.coin = N(0);
    g.step(10 * TICK_RATE);
    expect(g.s.ghosts.length).toBe(5);
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
    // in the first run, the Great Drill research brings them (their bearings go to the Bay)
    g.s.meta.runs = 0;
    g.s.research.done.push('greatDrill');
    expect(customerMet(g, 'committee')).toBe(true);
  });

  it('The Pile: the Dock takes slag while it is wanted, and pays Raccoon Bearings', () => {
    const g = sandbox();
    g.s.meta.runs = 1;
    must(g, { k: 'order', id: 'thePile' });
    // a heap emptying into a belt into the Dock (6,1): heap (4,2) east onto (5,2), into the Dock
    must(g, { k: 'place', kind: 'heap', x: 4, y: 2, rot: 0 });
    must(g, { k: 'place', kind: 'belt', x: 5, y: 2, rot: 0 });
    g.entAt(4, 2)!.count = 400;
    g.step(60 * TICK_RATE);
    const got = g.s.orders.progress.thePile?.slag?.toNumber() ?? 0;
    expect(got).toBeGreaterThan(50);
    g.s.orders.progress.thePile = { slag: N(1500) };
    g.step(2);
    expect(g.s.orders.done).toContain('thePile');
    expect(g.s.meta.bearings.toNumber()).toBe(3);
    expect(g.s.orders.rep.committee).toBe(1);
    // with the order filled, the Dock refuses slag again
    const left = g.entAt(4, 2)!.count;
    g.step(20 * TICK_RATE);
    expect(g.entAt(4, 2)!.count).toBeGreaterThanOrEqual(left - 3);
    // reputation 1: Coat Pockets, modules hold 6 s
    expect(prules(g).moduleBuffer).toBe(6);
  });
});

describe('the Great Drill, stages 2 and 3 (DESIGN.md §19)', () => {
  it('stages 2 and 3 want bearings, taken from the stash by the Bay, and earn their Patents', () => {
    expect(MEGA.map((m) => m.stage)).toEqual([1, 2, 3]);
    expect(MEGA[1].bearings).toBeGreaterThan(0);
    const g = sandbox();
    g.s.mega.stage = 1;
    g.s.flags.push('factoryOpen');
    g.step(TICK_RATE * 2);
    expect(g.s.factory.ents.some((e) => e.kind === 'fbay')).toBe(true);
    g.s.meta.bearings = N(10);
    g.step(TICK_RATE * 2);
    expect(g.s.mega.bearings).toBe(MEGA[1].bearings);
    expect(g.s.meta.bearings.toNumber()).toBe(10 - MEGA[1].bearings!);
    // a third of stage 2's 6 Patents for its bearings (one of three parts)
    expect(g.s.megaPatents).toBeCloseTo(MEGA[1].patents / 3, 6);
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

