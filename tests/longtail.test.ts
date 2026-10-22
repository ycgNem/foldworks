// The long tail (DESIGN.md §24, Milestone 11): the Trophy Shelf's bonuses and hidden trophies, the
// Codex's completion and pages (Unit 7's ending), the ten new Challenges, the five new Scenario
// boards and the efficiency boards, cosmetics and the skin picker, and the save.
import { describe, expect, it } from 'vitest';
import { Game, type Cmd } from '../src/sim/Game';
import { N } from '../src/engine/num';
import { TICK_RATE } from '../src/engine/time';
import { CHUNKS } from '../src/data/land';
import { BUILD, isMachine } from '../src/data/machines';
import { RESEARCH_IDS } from '../src/data/research';
import { RULES } from '../src/data/rules';
import { HIGH } from '../src/data/floors';
import { ITEMS } from '../src/data/items';
import { TROPHIES, TROPHY, TROPHY_CAPS, trophyFace, bonusText } from '../src/data/trophies';
import { CODEX_ITEMS, CODEX_PAGES, CODEX_TOTAL, ITEM_TIER } from '../src/data/codex';
import { COSMETICS, cosmeticDef, skinSprite } from '../src/data/cosmetics';
import { CHALLENGES, CHALLENGE_IDS, type ChallengeId } from '../src/data/challenges';
import { SCENARIOS, SCENARIO_IDS } from '../src/data/scenarios';
import { trules, craftSpeed, freeBuild, codexCompletion, codexPages, grantCosmetics, ownedCosmetics, skinFor, boardRecord, mergeBoard, boardsOnFile } from '../src/sim/longtail';
import { prules } from '../src/sim/patents';
import { checkTrophies, trophyValue } from '../src/sim/systems/stats';
import { maxRoutes, maxSkiffs, skiffStats, lotPrice, routeRefusal } from '../src/sim/systems/high';
import { chuteCap, kitsFor, stampRefusal } from '../src/sim/systems/modules';
import { repairPrice } from '../src/sim/systems/islands';
import { buildPrice, compactFull, splusShare, strictGrade, challengeRefusal, challengeProgress, powerMult } from '../src/sim/systems/challenges';
import { scenarioMiners, designScore } from '../src/sim/scenario';
import { newEnt, newFEnt, type BoardRecord, type ModuleDesign } from '../src/sim/world';
import { fingerprint, replay, savePayload, restore } from '../src/sim/snapshot';
import { migrate, SAVE_VERSION } from '../src/engine/save';
import { GRADES } from '../src/data/rules';

function must(g: Game, c: Cmd) {
  const r = g.act(c);
  if (!r.ok) throw new Error(`${JSON.stringify(c)}: ${r.why}`);
}

/** Earn trophies by flag (they are plain flags). */
function earn(g: Game, ...ids: string[]) {
  for (const id of ids) {
    expect(TROPHY[id], id).toBeTruthy();
    g.s.flags.push('trophy:' + id);
  }
}

const freeTile = (g: Game) => {
  for (let y = 8; y < 30; y++) for (let x = 8; x < 30; x++) if (g.owned(x, y) && !g.entAt(x, y) && !g.oreAt(x, y)) return { x, y };
  throw new Error('no free tile');
};
/** a free tile in chunk A (a fresh game owns only it) */
const freeTileA = (g: Game) => {
  for (let y = 5; y < 8; y++) for (let x = 0; x < 8; x++) if (g.owned(x, y) && !g.entAt(x, y) && !g.oreAt(x, y)) return { x, y };
  throw new Error('no free tile in A');
};

/** Everything researched and owned, a billion coin, the District and the World open. */
function sandbox(seed = 1) {
  const g = new Game(seed);
  open(g);
  return g;
}
function open(g: Game) {
  g.s.coin = N(1e9);
  g.s.land = CHUNKS.map((c) => c.id);
  g.s.research.done = [...RESEARCH_IDS];
  if (!g.s.upgrades.includes('bellows')) g.s.upgrades.push('bellows');
  g.rebuild();
  g.step(1);
}

/** A fake design (plain data). */
function design(g: Game, over: Partial<ModuleDesign>): ModuleDesign {
  const d: ModuleDesign = {
    id: g.s.nextDesign++, name: 'D', box: { x: 0, y: 0, w: 2, h: 2 }, parts: [], ins: {}, outs: { gear: 0.5 },
    grade: { letter: 'A', score: 0.85, u: 1, w: 1, c: 1, mult: 1.1 }, bill: 100, stamped: 0, spare: 20, ...over,
  };
  g.s.designs.push(d);
  return d;
}

/** A game after one Reorganize, then this Challenge taken; then the sandbox opened. */
function take(id: ChallengeId, before?: (g: Game) => void) {
  const g = new Game(3);
  g.s.meta.runs = 1;
  g.s.megaPatents = 3;
  before?.(g);
  must(g, { k: 'reorganize', challenge: id });
  expect(g.s.challenge).toBe(id);
  open(g);
  return g;
}

function winNow(g: Game, id: ChallengeId) {
  g.step(TICK_RATE);
  expect(g.s.challenge).toBeNull();
  expect(g.s.meta.challenges).toContain(id);
}

// ================================================================== the shelf

describe('the Trophy Shelf (DESIGN.md §24)', () => {
  it('holds 150+ trophies, 12+ hidden, every one with a bonus that points at something real', () => {
    expect(TROPHIES.length).toBeGreaterThanOrEqual(150);
    expect(TROPHIES.filter((t) => t.hidden).length).toBeGreaterThanOrEqual(12);
    expect(new Set(TROPHIES.map((t) => t.id)).size).toBe(TROPHIES.length);
    const cosmetics = new Set(COSMETICS.map((c) => c.id));
    for (const t of TROPHIES) {
      const b = t.bonus;
      expect(b, t.id).toBeTruthy();
      if (b.k === 'speed') { expect(ITEMS[b.item], t.id).toBeTruthy(); expect(b.add).toBeLessThanOrEqual(TROPHY_CAPS.speed); }
      if (b.k === 'free') { expect(BUILD[b.kind], t.id).toBeTruthy(); expect(b.n).toBeGreaterThan(0); }
      if (b.k === 'cosmetic') expect(cosmetics.has(b.id), `${t.id}: ${b.id}`).toBe(true);
      expect(bonusText(b).length).toBeGreaterThan(4);
    }
    // a trophy's cosmetic is the one the list names for it
    for (const c of COSMETICS) if (c.source.k === 'trophy') expect(TROPHY[c.source.id]?.bonus, c.id).toEqual({ k: 'cosmetic', id: c.id });
  });

  it('a hidden trophy is "???" until earned', () => {
    const t = TROPHIES.find((q) => q.hidden)!;
    expect(trophyFace(t, false).name).toBe('???');
    expect(trophyFace(t, false).icon).toBeNull();
    expect(trophyFace(t, true).name).toBe(t.name);
    const shown = TROPHIES.find((q) => !q.hidden)!;
    expect(trophyFace(shown, false).name).toBe(shown.name);
  });

  it('sums each kind over the trophies earned, and caps it', () => {
    const g = new Game(1);
    expect(trules(g).n).toBe(0);
    earn(g, 'skyLanes', 'fleetAdmiral');
    expect(trules(g).skiffs).toBe(2);
    expect(trules(g).n).toBe(2);
    // every skiff trophy at once: capped at 4
    for (const t of TROPHIES) if (t.bonus.k === 'skiffs' && !g.flag('trophy:' + t.id)) g.s.flags.push('trophy:' + t.id);
    expect(trules(g).skiffs).toBe(TROPHY_CAPS.skiffs);
    // every trophy: every kind under its cap
    for (const t of TROPHIES) if (!g.flag('trophy:' + t.id)) g.s.flags.push('trophy:' + t.id);
    const r = trules(g);
    expect(r.n).toBe(TROPHIES.length);
    expect(r.routes).toBeLessThanOrEqual(TROPHY_CAPS.routes);
    expect(r.drawer).toBeLessThanOrEqual(TROPHY_CAPS.drawer);
    expect(r.heap).toBeLessThanOrEqual(TROPHY_CAPS.heap);
    expect(r.cool).toBeLessThanOrEqual(TROPHY_CAPS.cool);
    for (const v of Object.values(r.speed)) expect(v).toBeLessThanOrEqual(TROPHY_CAPS.speed + 1e-12);
    expect(prules(g).overdriveCool).toBe(RULES.overdriveCool.value - TROPHY_CAPS.cool);
  });

  it('a delivery trophy makes that one product\'s craft faster, nothing else', () => {
    const g = new Game(1);
    expect(craftSpeed(g, 'ironPlate')).toBe(1);
    earn(g, 'sheetMetal');
    expect(craftSpeed(g, 'ironPlate')).toBeCloseTo(1.05);
    expect(craftSpeed(g, 'gear')).toBe(1);
    earn(g, 'rollingAlong', 'bearingUp');
    expect(craftSpeed(g, 'bearing')).toBeCloseTo(1.1);
  });

  it('a delivery trophy speeds a real machine: a press finishes plates 5% sooner', () => {
    const run = (trophy: boolean) => {
      const g = new Game(4, { empty: true });
      g.s.upgrades.push('bellows');
      g.s.research.done.push('pressing');
      if (trophy) earn(g, 'sheetMetal');
      g.s.ents.push(newEnt(g.s.nextId++, 'press', 5, 5, 1, 1, 0));
      g.rebuild();
      const p = g.s.ents.find((e) => e.kind === 'press')!;
      p.recipe = 'pressPlate';
      p.inBuf = { ironIngot: 100 };
      g.step(10);
      return p.prog;
    };
    const plain = run(false), quick = run(true);
    expect(plain).toBeGreaterThan(0);
    expect(quick / plain).toBeCloseTo(1.05, 2);
  });

  it('Slag Happens: the first Slag Heap is free, refunds nothing, and its place frees when lifted', () => {
    const g = new Game(2);
    g.s.coin = N(1000);
    g.step(1);
    const t = freeTileA(g);
    expect(freeBuild(g, 'heap')).toBe(false);
    earn(g, 'slagHappens');
    expect(freeBuild(g, 'heap')).toBe(true);
    must(g, { k: 'place', kind: 'heap', x: t.x, y: t.y, rot: 0 });
    expect(g.s.coin.toNumber()).toBe(1000);
    expect(g.entAt(t.x, t.y)!.free).toBe(true);
    // the second one is paid
    expect(freeBuild(g, 'heap')).toBe(false);
    must(g, { k: 'remove', x: t.x, y: t.y });
    expect(g.s.coin.toNumber()).toBe(1000);
    expect(freeBuild(g, 'heap')).toBe(true);
  });

  it('a free building never comes free in a Scenario', () => {
    const g = new Game(2, { scenario: 'tinyIsland' });
    earn(g, 'slagHappens');
    expect(freeBuild(g, 'heap')).toBe(false);
  });

  it('applies each kind where the sim reads it: heaps, the Drawer, Sparks, routes, skiffs, the Chute, repairs, Overdrive', () => {
    const g = sandbox();
    const heap0 = prules(g).heapCap, drawer0 = prules(g).drawerSlots, routes0 = maxRoutes(g, 'district'), skiffs0 = maxSkiffs(g, 'district'), chute0 = chuteCap(g), cool0 = prules(g).overdriveCool;
    const ruin = newEnt(999, 'smelterMk2', 0, 0, 2, 2, 0);
    const repair0 = repairPrice(g, ruin);
    earn(g, 'elbowGrease', 'wellRead', 'upInTheAir', 'skyLanes', 'thinkingCap', 'handMeDowns', 'redline');
    expect(prules(g).heapCap).toBe(heap0 + 50);
    expect(prules(g).drawerSlots).toBe(drawer0 + 1);
    expect(maxRoutes(g, 'district')).toBe(routes0 + 5);
    expect(maxSkiffs(g, 'district')).toBe(skiffs0 + 1);
    expect(chuteCap(g)).toBe(chute0 + 5);
    expect(repairPrice(g, ruin)).toBe(Math.ceil(buildPrice(g, 'smelterMk2') * RULES.ruinRepair.value * 0.9));
    expect(repairPrice(g, ruin)).toBeLessThan(repair0);
    expect(prules(g).overdriveCool).toBe(cool0 - 2);
  });

  it('Sparks stay longer with the Spark trophies', () => {
    const g = new Game(5);
    earn(g, 'lucky', 'sparkChaser');
    // a working Miner on the iron, feeding the Hand Furnace, so a Lucky Vein can appear on it
    g.s.upgrades.push('bellows');
    g.s.coin = N(100);
    must(g, { k: 'place', kind: 'miner', x: 2, y: 3, rot: 0 });
    // run until a Spark appears (one every 3-6 min, §6)
    for (let i = 0; i < 400 * TICK_RATE && !g.s.sparks.length; i++) g.tick();
    expect(g.s.sparks.length).toBeGreaterThan(0);
    expect(g.s.sparks[0].life).toBeGreaterThan((RULES.sparkLife.value + 4) * TICK_RATE);
  });

  it('coin trophies give every run after a reset its head start', () => {
    const g = new Game(6);
    g.s.meta.runs = 1;
    g.s.megaPatents = 3;
    earn(g, 'pocketMoney', 'smallBusiness');
    must(g, { k: 'reorganize' });
    expect(g.s.coin.toNumber()).toBe(125);
    expect(g.s.granted.toNumber()).toBeGreaterThanOrEqual(125);
  });

  it('is awarded by the sim from the new stats: lifetime deliveries, the Codex, reputation, the shelf', () => {
    const g = new Game(7);
    g.s.meta.lifetime.delivered.gear = N(49990);
    g.s.delivered.gear = N(10);
    expect(trophyValue(g, TROPHY.tenThousandTeeth)).toBe(50000);
    g.s.codex.push(...CODEX_ITEMS[1]);
    g.s.orders.rep = { bramble: 3, unit7: 3, voltaire: 3, committee: 3 };
    checkTrophies(g);
    expect(g.flag('trophy:tenThousandTeeth')).toBe(true);
    expect(g.flag('trophy:codexI')).toBe(true);
    expect(g.flag('trophy:reputable')).toBe(true);
    expect(trophyValue(g, TROPHY.shelf50)).toBe(g.s.flags.filter((f) => f.startsWith('trophy:')).length);
  });
});

// ================================================================== the Codex

describe('the Codex (DESIGN.md §24)', () => {
  it('completion counts the items first delivered out of every item it logs, by tier', () => {
    const g = new Game(1);
    const c0 = codexCompletion(g);
    expect(c0.have).toBe(0);
    expect(c0.total).toBe(CODEX_TOTAL);
    expect(CODEX_TOTAL).toBe(Object.values(ITEMS).filter((i) => i.value > 0).length);
    g.s.codex.push('gear', 'gizmo', 'steel');
    const c = codexCompletion(g);
    expect(c.have).toBe(3);
    expect(c.tiers[1]).toEqual({ have: 2, total: CODEX_ITEMS[1].length });
    expect(c.tiers[2].have).toBe(1);
    expect(c.frac).toBeCloseTo(3 / CODEX_TOTAL);
    expect(ITEM_TIER.foldedUniverse).toBe(5);
    expect(ITEM_TIER.slag).toBe(1);
  });

  it('opens a page a tier, a floor and an island by firsts the sim keeps, and Unit 7\'s ending with the first Last Fold', () => {
    const g = new Game(1);
    const ids = () => codexPages(g).map((p) => p.id);
    expect(ids()).toEqual([]);
    g.s.codex.push('gear');
    earn(g, 'openForBusiness');
    g.s.counters.folds = 1;
    expect(ids()).toEqual(['tier1', 'floorWorkshop', 'floorFactory']);
    g.s.counters.districtPlaced = 1;
    g.s.counters['visit:rime'] = 1;
    g.s.meta.relocations = 1;
    expect(ids()).toContain('floorDistrict');
    expect(ids()).toContain('isleRime');
    expect(ids()).toContain('isleHome');
    expect(ids()).not.toContain('ending');
    g.s.meta.lastFolds = 1;
    expect(ids()).toContain('ending');
    const end = CODEX_PAGES.find((p) => p.id === 'ending')!;
    expect(end.lines.join(' ')).toMatch(/UNIT 7/);
    // every page has its lines in Unit 7's capitals
    for (const p of CODEX_PAGES) for (const l of p.lines) expect(l).toBe(l.toUpperCase());
  });

  it('a Relocate counts the island for good (the island pages survive a Last Fold)', () => {
    const g = new Game(1);
    g.s.counters['visit:pebble'] = 1;
    g.s.meta.visited = ['home'];
    expect(codexPages(g).map((p) => p.id)).toContain('islePebble');
  });
});

// ================================================================== the ten new Challenges

describe('Challenges 6-15 (DESIGN.md §24)', () => {
  it('there are fifteen, each with a rule, a goal, a reward and a derivation', () => {
    expect(CHALLENGE_IDS).toHaveLength(15);
    for (const id of CHALLENGE_IDS) {
      const c = CHALLENGES[id];
      expect(c.rule.length).toBeGreaterThan(10);
      expect(c.reward.length).toBeGreaterThan(10);
      expect(c.derivation).toMatch(/§21/);
    }
    // every Challenge won pays its skin
    for (const id of CHALLENGE_IDS) expect(COSMETICS.some((c) => c.source.k === 'challenge' && c.source.id === id), id).toBe(true);
  });

  it('Acts III and IV\'s wait until that floor has stood in some run', () => {
    const g = new Game(1);
    g.s.meta.runs = 1;
    expect(challengeRefusal(g, 'headwinds')).toMatch(/District/);
    expect(challengeRefusal(g, 'roughSeas')).toMatch(/World/);
    g.s.counters.districtPlaced = 1;
    expect(challengeRefusal(g, 'headwinds')).toBeNull();
  });

  it('Clean Hands: no Slag Heaps; 400 concrete; then gravel and concrete craft 10% faster', () => {
    const g = take('cleanHands');
    const t = freeTile(g);
    expect(g.act({ k: 'place', kind: 'heap', x: t.x, y: t.y, rot: 0 }).why).toMatch(/No Slag Heaps/);
    expect(g.s.ents.some((e) => e.kind === 'heap')).toBe(true);
    g.s.delivered.concrete = N(400);
    winNow(g, 'cleanHands');
    expect(craftSpeed(g, 'gravel')).toBeCloseTo(1.1);
    expect(craftSpeed(g, 'concrete')).toBeCloseTo(1.1);
    expect(craftSpeed(g, 'steel')).toBe(1);
    expect(g.act({ k: 'place', kind: 'heap', x: t.x, y: t.y, rot: 0 }).ok).toBe(true);
  });

  it('Old Faithful: no Mk2; 100 motors; then a Mk2 costs 15% less', () => {
    const g = take('mk1Only');
    const t = freeTile(g);
    expect(g.act({ k: 'place', kind: 'smelterMk2', x: t.x, y: t.y, rot: 0 }).why).toMatch(/No Mk2/);
    expect(g.act({ k: 'place', kind: 'smelter', x: t.x, y: t.y, rot: 0 }).ok).toBe(true);
    g.s.delivered.motor = N(100);
    winNow(g, 'mk1Only');
    expect(buildPrice(g, 'smelterMk2')).toBe(Math.round(BUILD.smelterMk2.cost * 0.85));
    expect(buildPrice(g, 'smelter')).toBe(BUILD.smelter.cost);
  });

  it('Hand-Made: no stamping; 8 modules standing on the Factory; then a design\'s first stamp takes no kits', () => {
    const g = take('handMade');
    const d = design(g, { bill: 20000, parts: [{ kind: 'kiln', dx: 0, dy: 0, rot: 0, recipe: null }] });
    expect(stampRefusal(g, d)).toMatch(/No stamping/);
    expect(g.act({ k: 'stamp', id: d.id }).ok).toBe(false);
    g.s.flags.push('factoryOpen');
    for (let x = 0; x < 8; x++) must(g, { k: 'fplace', design: d.id, x, y: 0, rot: 0 });
    expect(challengeProgress(g, 'handMade')).toEqual({ have: 8, want: 8 });
    winNow(g, 'handMade');
    expect(kitsFor(g, d)).toBe(0);
    d.stamped = 1;
    expect(kitsFor(g, d)).toBeGreaterThan(0);
  });

  it('The Strict Inspector: a letter lower; a fold at A; then S+ needs 70% used inside', () => {
    const g = take('strictInspector');
    const S = GRADES.find((q) => q.letter === 'S')!;
    expect(strictGrade(g, S).letter).toBe('A');
    expect(strictGrade(g, GRADES.find((q) => q.letter === 'D')!).letter).toBe('D');
    expect(splusShare(g)).toBe(RULES.splusUsedInside.value);
    // a B fold is not the goal; an A one is
    g.bump('grade:B');
    g.step(TICK_RATE);
    expect(g.s.challenge).toBe('strictInspector');
    g.bump('grade:A');
    winNow(g, 'strictInspector');
    expect(strictGrade(g, S).letter).toBe('S');
    expect(splusShare(g)).toBe(0.7);
  });

  it('a fold before the Challenge does not count for its goal', () => {
    const g = take('strictInspector', (q) => { q.s.counters['grade:A'] = 5; q.s.counters['grade:S'] = 2; });
    g.step(TICK_RATE);
    expect(g.s.challenge).toBe('strictInspector');
  });

  it('Belt Budget: 60 belt tiles; 1,000 steel; then C counts full at 0.55', () => {
    const g = take('beltBudget');
    let laid = g.s.ents.filter((e) => e.kind === 'belt').length;
    for (let y = 8; y < 30 && laid < 60; y++) for (let x = 0; x < 24 && laid < 60; x++) if (g.owned(x, y) && !g.entAt(x, y) && g.act({ k: 'place', kind: 'belt', x, y, rot: 0 }).ok) laid++;
    expect(laid).toBe(60);
    const t = freeTile(g);
    expect(g.act({ k: 'place', kind: 'belt', x: t.x, y: t.y, rot: 0 }).why).toMatch(/60 belt tiles/);
    expect(compactFull(g)).toBe(RULES.compactFull.value);
    g.s.delivered.steel = N(1000);
    winNow(g, 'beltBudget');
    expect(compactFull(g)).toBe(0.55);
  });

  it('Headwinds: District skiffs at half speed; 30 robot arms; then +0.5 tiles a second', () => {
    const base = sandbox();
    const speed0 = skiffStats(base, 'district').speed;
    const g = take('headwinds', (q) => { q.s.counters.districtPlaced = 1; });
    expect(skiffStats(g, 'district').speed).toBeCloseTo(speed0 / 2);
    g.s.delivered.robotArm = N(30);
    winNow(g, 'headwinds');
    expect(skiffStats(g, 'district').speed).toBeCloseTo(speed0 + 0.5);
    expect(skiffStats(g, 'world').speed).toBe(skiffStats(base, 'world').speed);
  });

  it('Short Haul: routes at most 5 tiles; 10 Engineers; then every route takes 2 more skiffs', () => {
    const g = take('shortHaul', (q) => { q.s.counters.districtPlaced = 1; });
    const d = design(g, { depth: 2, outs: { steel: 1 } });
    const DK = HIGH.district.dock;
    must(g, { k: 'hplace', floor: 'district', design: d.id, x: 0, y: DK.y });
    must(g, { k: 'hplace', floor: 'district', design: d.id, x: DK.x - 1, y: DK.y });
    expect(routeRefusal(g, 'district', 0, DK.y, DK.x, DK.y, 'steel')).toMatch(/5 tiles at most/);
    expect(routeRefusal(g, 'district', DK.x - 1, DK.y, DK.x, DK.y, 'steel')).toBeNull();
    const cap0 = maxSkiffs(g, 'district');
    g.s.delivered.sandwichEngineer = N(10);
    winNow(g, 'shortHaul');
    expect(maxSkiffs(g, 'district')).toBe(cap0 + 2);
    expect(routeRefusal(g, 'district', 0, DK.y, DK.x, DK.y, 'steel')).toBeNull();
  });

  it('Zoning Freeze: no District lots; the Specimen Drawer; then lots cost 20% less', () => {
    const g = take('zoningFreeze', (q) => { q.s.counters.districtPlaced = 1; });
    const p0 = lotPrice(g, 'district')!.toNumber();
    expect(g.act({ k: 'hlot', floor: 'district' }).why).toMatch(/No District lots/);
    g.s.orders.done.push('specimens');
    winNow(g, 'zoningFreeze');
    expect(lotPrice(g, 'district')!.toNumber()).toBe(Math.round(p0 * 0.8));
    expect(g.act({ k: 'hlot', floor: 'district' }).ok).toBe(true);
  });

  it('Rough Seas: barges carry 1; 10 modules standing on the World; then one more a trip', () => {
    const base = sandbox();
    const load0 = skiffStats(base, 'world').load;
    const g = take('roughSeas', (q) => { q.s.counters.worldPlaced = 1; });
    expect(g.s.world).toBeTruthy();
    expect(skiffStats(g, 'world').load).toBe(1);
    const w = g.s.world!;
    for (let i = 0; i < 10; i++) w.ents.push(newFEnt(w.nextId++, 'module', i, 0, 0, 0));
    winNow(g, 'roughSeas');
    expect(skiffStats(g, 'world').load).toBe(load0 + 1);
  });

  it('Light Fleet: 3 skiffs a route; a Megaproject stage this run; then dwell x0.75', () => {
    const base = sandbox();
    const dwell0 = skiffStats(base, 'district').dwell;
    const g = take('lightFleet', (q) => { q.s.counters.worldPlaced = 1; q.s.counters.megaStages = 4; });
    expect(maxSkiffs(g, 'district')).toBe(3);
    g.step(TICK_RATE);
    expect(g.s.challenge).toBe('lightFleet');
    g.bump('megaStages');
    winNow(g, 'lightFleet');
    expect(maxSkiffs(g, 'district')).toBe(HIGH.district.maxSkiffs);
    expect(skiffStats(g, 'district').dwell).toBeCloseTo(dwell0 * 0.75);
  });
});

// ================================================================== the new boards

describe('Scenarios 4-8 and the efficiency boards (DESIGN.md §24)', () => {
  it('eight boards, each laid out with its land, coin and no Reorganize', () => {
    expect(SCENARIO_IDS).toHaveLength(8);
    for (const id of SCENARIO_IDS) {
      const d = SCENARIOS[id];
      const g = new Game(5, { scenario: id });
      expect([...g.s.land].sort()).toEqual([...d.land].sort());
      expect(g.s.coin.eq(d.coin)).toBe(true);
      expect(g.done('folding')).toBe(true);
    }
  });

  it('each new twist holds: 4x4 boxes, no heaps, Mk1 only, power 0.75x, Miners 0.5x', () => {
    expect(prules(new Game(5, { scenario: 'pocketWorkshop' })).foldMax).toBe(4);
    expect(prules(new Game(5)).foldMax).toBe(RULES.foldMax.value);
    const slag = new Game(5, { scenario: 'slagMountain' });
    const t = freeTile(slag);
    expect(slag.act({ k: 'place', kind: 'heap', x: t.x, y: t.y, rot: 0 }).why).toMatch(/No Slag Heaps on this board/);
    const old = new Game(5, { scenario: 'antiqueShop' });
    const t2 = freeTile(old);
    expect(old.act({ k: 'place', kind: 'assemblerMk2', x: t2.x, y: t2.y, rot: 0 }).why).toMatch(/Mk1 machines only/);
    expect(powerMult(new Game(5, { scenario: 'nightMarket' }))).toBe(0.75);
    expect(scenarioMiners(new Game(5, { scenario: 'thinVein' }))).toBe(0.5);
  });

  it('Night Market scores plastic a minute per kW its machines draw; an unpowered fold scores nothing', () => {
    const g = new Game(5, { scenario: 'nightMarket' });
    const def = SCENARIOS.nightMarket;
    const d = design(g, { outs: { plastic: 0.5 }, parts: [{ kind: 'refinery', dx: 0, dy: 0, rot: 0, recipe: 'plastic' }, { kind: 'refinery', dx: 1, dy: 0, rot: 0, recipe: 'plastic' }] });
    expect(designScore(d, def)).toBeCloseTo(30 / (2 * (BUILD.refinery.kw ?? 0)));
    const e = design(g, { outs: { plastic: 0.5 }, parts: [{ kind: 'smelter', dx: 0, dy: 0, rot: 0, recipe: null }] });
    expect(designScore(e, def)).toBe(0);
  });

  it('a board keeps its bests per tile, per kW and waste, each the best of its own', () => {
    const g = new Game(5, { scenario: 'tinyIsland' });
    expect(boardRecord(g)).toBeNull();
    const kw = (BUILD.kiln.kw ?? 0);
    design(g, { outs: { gizmo: 0.5 }, box: { x: 0, y: 0, w: 4, h: 3 }, grade: { letter: 'A', score: 0.85, u: 1, w: 0.5, c: 1, mult: 1.1 }, parts: [{ kind: 'kiln', dx: 0, dy: 0, rot: 0, recipe: null }] });
    design(g, { outs: { gizmo: 0.3 }, box: { x: 0, y: 0, w: 2, h: 3 }, grade: { letter: 'S', score: 0.92, u: 1, w: 1, c: 1, mult: 1.25 } });
    const r = boardRecord(g)!;
    expect(r.score).toBeCloseTo(18 / 6);
    expect(r.grade).toBe('S');
    expect(r.perTile).toBeCloseTo(3);
    expect(r.perKw).toBeCloseTo(30 / kw);
    expect(r.waste).toBe(0);
    // the game notes its own once a second, and says so
    g.step(TICK_RATE);
    expect(g.s.meta.boards?.tinyIsland).toEqual(r);
    expect(boardsOnFile(g)).toEqual(['tinyIsland']);
  });

  it('the town takes a board\'s bests with the boards command, field by field, and keeps them through a reset', () => {
    const town = new Game(1);
    const a: BoardRecord = { score: 2, grade: 'A', perTile: 2, perKw: 0.1, waste: 0.2 };
    must(town, { k: 'boards', boards: { tinyIsland: a } });
    must(town, { k: 'boards', boards: { tinyIsland: { score: 1, grade: 'B', perTile: 3, perKw: 0.05, waste: 0.5 } } });
    expect(town.s.meta.boards!.tinyIsland).toEqual({ score: 2, grade: 'A', perTile: 3, perKw: 0.1, waste: 0.2 });
    expect(mergeBoard(undefined, a)).toEqual(a);
    // junk is refused
    expect(town.act({ k: 'boards', boards: { nowhere: a } }).ok).toBe(false);
    expect(town.act({ k: 'boards', boards: { richOre: { ...a, score: NaN } } }).ok).toBe(false);
    expect(town.act({ k: 'boards', boards: { richOre: { ...a, waste: 3 } } }).ok).toBe(false);
    // the board trophy follows, and the record survives a Reorganize
    checkTrophies(town);
    expect(town.flag('trophy:boardTinyIsland')).toBe(true);
    town.s.meta.runs = 1;
    town.s.megaPatents = 3;
    must(town, { k: 'reorganize' });
    expect(town.s.meta.boards!.tinyIsland.perTile).toBe(3);
  });
});

// ================================================================== cosmetics

describe('cosmetics and the skin picker (DESIGN.md §24)', () => {
  it('one list: the Ledger\'s, reputation\'s, Challenges\' and trophies\', with the art\'s sprite names', () => {
    expect(new Set(COSMETICS.map((c) => c.id)).size).toBe(COSMETICS.length);
    expect(COSMETICS.filter((c) => c.source.k === 'ledger').map((c) => c.id)).toEqual(['gilded', 'candy', 'starlit']);
    expect(COSMETICS.filter((c) => c.source.k === 'rep')).toHaveLength(8);
    expect(COSMETICS.filter((c) => c.source.k === 'challenge')).toHaveLength(15);
    for (const c of COSMETICS) for (const s of c.slots) if (s !== 'module' && s !== 'skiff' && s !== 'barge' && s !== 'courier') expect(BUILD[s], `${c.id} on ${s}`).toBeTruthy();
    expect(cosmeticDef('ribbon4')?.slots).toEqual(['dock']);
    expect(cosmeticDef('ribbon2')).toBeNull();
    expect(skinSprite('gilded', 'miner')).toBe('skin_gilded_miner');
  });

  it('grants a skin for a Challenge won, a reputation reached and a trophy earned, once', () => {
    const g = new Game(1);
    g.s.meta.challenges = ['noSplitters'];
    g.s.orders.rep.unit7 = 3;
    earn(g, 'warmHands');
    grantCosmetics(g);
    grantCosmetics(g);
    expect([...g.s.meta.cosmetics!].sort()).toEqual(['chrome', 'ember', 'straightArrow']);
    expect(ownedCosmetics(g).map((c) => c.id).sort()).toEqual(['chrome', 'ember', 'straightArrow']);
    // the Ledger's are the Ledger's to pay
    expect(g.s.meta.cosmetics).not.toContain('gilded');
    // the sim does it once a second by itself
    const h = new Game(1);
    h.s.meta.challenges = ['handsOff'];
    h.step(TICK_RATE);
    expect(h.s.meta.cosmetics).toContain('mittens');
  });

  it('the skin command wears an owned skin on a kind it fits, and only that; null takes it off', () => {
    const g = new Game(1);
    g.s.meta.cosmetics = ['gilded', 'chrome'];
    expect(g.act({ k: 'skin', kind: 'miner', id: 'candy' }).why).toMatch(/not yours/);
    expect(g.act({ k: 'skin', kind: 'press', id: 'gilded' }).why).toMatch(/doesn't fit/);
    expect(g.act({ k: 'skin', kind: 'miner', id: 'nope' }).why).toMatch(/No such skin/);
    must(g, { k: 'skin', kind: 'miner', id: 'gilded' });
    must(g, { k: 'skin', kind: 'smelterMk2', id: 'chrome' });
    expect(skinFor(g, 'miner')).toBe('gilded');
    expect(skinFor(g, 'smelterMk2')).toBe('chrome');
    must(g, { k: 'skin', kind: 'miner', id: null });
    expect(skinFor(g, 'miner')).toBeNull();
    expect(g.s.counters.skinsWorn).toBe(2);
  });

  it('a skin changes nothing the sim does', () => {
    const run = (skin: boolean) => {
      const g = new Game(11);
      g.s.meta.cosmetics = ['gilded'];
      if (skin) must(g, { k: 'skin', kind: 'miner', id: 'gilded' });
      g.step(TICK_RATE * 120);
      return [g.s.coin.toString(), g.s.earned.toString(), g.s.rng].join('|');
    };
    expect(run(true)).toBe(run(false));
  });
});

// ================================================================== saves and determinism

describe('the long tail in saves (DESIGN.md §24)', () => {
  it('a v10 save migrates to v11: no skin, no board', () => {
    expect(SAVE_VERSION).toBeGreaterThanOrEqual(11);
    const g = new Game(3);
    g.step(100);
    const p = savePayload(g, 0) as unknown as { v: number; snap: string };
    const st = JSON.parse(p.snap);
    delete st.meta.skins;
    delete st.meta.boards;
    const m = migrate({ ...p, v: 10, snap: JSON.stringify(st) }) as unknown as { v: number; snap: string };
    expect(m.v).toBe(SAVE_VERSION);
    const meta = JSON.parse(m.snap).meta;
    expect(meta.skins).toEqual({});
    expect(meta.boards).toEqual({});
  });

  it('skins, boards, free buildings and cosmetics survive a save, and a replay reaches the same fingerprint', () => {
    const g = new Game(9, { keepHistory: true });
    g.s.coin = N(5000);
    earn(g, 'slagHappens', 'warmHands');
    g.step(TICK_RATE);
    must(g, { k: 'place', kind: 'heap', x: 5, y: 6, rot: 0 });
    must(g, { k: 'skin', kind: 'furnace', id: 'ember' });
    must(g, { k: 'boards', boards: { thinVein: { score: 1, grade: 'B', perTile: 1, perKw: 0, waste: 0 } } });
    g.step(TICK_RATE * 5);
    const back = restore(savePayload(g, 0) as never);
    expect(fingerprint(back)).toBe(fingerprint(g));
    expect(back.s.ents.find((e) => e.x === 5 && e.y === 6)?.free).toBe(true);
    expect(skinFor(back, 'furnace')).toBe('ember');
    // a replay from the seed: the earned flags were set by hand, so replay them the same way
    const h = new Game(9, { keepHistory: true });
    h.s.coin = N(5000);
    earn(h, 'slagHappens', 'warmHands');
    for (const l of g.history!) {
      while (h.s.tick < l.t) h.tick();
      h.act(l.c);
    }
    while (h.s.tick < g.s.tick) h.tick();
    expect(fingerprint(h)).toBe(fingerprint(g));
    void replay;
    void isMachine;
  });
});
