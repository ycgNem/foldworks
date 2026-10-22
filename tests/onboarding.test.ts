// Milestone 13 (onboarding, UX and accessibility): the key bindings (clean, rebind by swapping,
// kept with the settings, the keycaps that follow them), the stuck-finder's choice on sandbox
// states (the cause, not the symptom; the dearest cause; a short skiff route; nothing stuck), and
// the lesson cards' "already learnt" read of an old save.
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Game, type Cmd } from '../src/sim/Game';
import { N } from '../src/engine/num';
import { RESEARCH_IDS } from '../src/data/research';
import { CHUNKS } from '../src/data/land';
import { HIGH } from '../src/data/floors';
import { ACTIONS, DEFAULT_BINDS, cleanBinds, rebind, keyAliases, defaultBinds, bindable, type Binds } from '../src/engine/input';
import { loadBinds, saveBinds, uiScaleFor, maxUiScale, lessonsSeen, saveLessonsSeen } from '../src/app/settings';
import { findStuck } from '../src/app/stuck';
import { pastLessons } from '../src/app/lessons';
import { routeCap, routeWant } from '../src/sim/systems/high';
import type { ModuleDesign } from '../src/sim/world';

// ---------------------------------------------------------------- a stand-in for localStorage

class MemoryStorage {
  private m = new Map<string, string>();
  get length() { return this.m.size; }
  clear() { this.m.clear(); }
  getItem(k: string) { return this.m.has(k) ? this.m.get(k)! : null; }
  setItem(k: string, v: string) { this.m.set(k, String(v)); }
  removeItem(k: string) { this.m.delete(k); }
  key(i: number) { return [...this.m.keys()][i] ?? null; }
}

const G = globalThis as unknown as { localStorage?: Storage };
let before: Storage | undefined;
beforeEach(() => { before = G.localStorage; G.localStorage = new MemoryStorage() as unknown as Storage; });
afterEach(() => { G.localStorage = before; });

const keysOf = (b: Binds) => ACTIONS.flatMap((a) => b[a]);

describe('key bindings (the Keys page)', () => {
  it('cleans what is stored: defaults for anything missing or damaged, no key on two actions', () => {
    expect(cleanBinds(undefined)).toEqual(DEFAULT_BINDS);
    expect(cleanBinds('junk')).toEqual(DEFAULT_BINDS);
    const b = cleanBinds({ fold: ['KeyQ'], wheel: 'nonsense', rotate: [7, 'KeyR', 'KeyR'], remove: ['KeyX', 'KeyC', 'KeyV', 'KeyB'] });
    // fold took Q, so the wheel (damaged: its defaults) keeps only Space
    expect(b.fold).toEqual(['KeyQ']);
    expect(b.wheel).toEqual(['Space']);
    expect(b.rotate).toEqual(['KeyR']);
    expect(b.remove).toEqual(['KeyX', 'KeyC', 'KeyV']);
    const all = keysOf(b);
    expect(new Set(all).size).toBe(all.length);
    expect(bindable('F5')).toBe(false);
    expect(bindable('KeyK')).toBe(true);
  });

  it('a new action keeps its default key unless the player moved another action onto it', () => {
    const stored = defaultBinds() as Partial<Binds>;
    delete stored.stuck;
    expect(cleanBinds(stored).stuck).toEqual(['KeyG']);
    expect(cleanBinds({ ...stored, fold: ['KeyG'] }).stuck).toEqual([]);
  });

  it('rebinding a key to one another action holds swaps the two, so nothing is left unbound', () => {
    const b = defaultBinds();
    const r = rebind(b, 'fold', 'KeyF', 'KeyR');
    expect(r.from).toBe('rotate');
    expect(r.binds.fold).toEqual(['KeyR']);
    expect(r.binds.rotate).toEqual(['KeyF']);
    // to a free key: the old key is free now
    const r2 = rebind(b, 'fold', 'KeyF', 'KeyK');
    expect(r2.from).toBeNull();
    expect(r2.binds.fold).toEqual(['KeyK']);
    expect(keysOf(r2.binds)).not.toContain('KeyF');
    // the second key of a two-key action
    const r3 = rebind(b, 'panUp', 'ArrowUp', 'KeyK');
    expect(r3.binds.panUp).toEqual(['KeyW', 'KeyK']);
    // an unbindable key or the same key changes nothing; the input is never changed in place
    expect(rebind(b, 'fold', 'KeyF', 'F12').binds).toEqual(b);
    expect(rebind(b, 'fold', 'KeyF', 'KeyF').binds).toEqual(b);
    expect(b).toEqual(DEFAULT_BINDS);
  });

  it('keycaps follow the bindings: a moved action\'s default label draws as its key now', () => {
    expect(keyAliases(defaultBinds()).size).toBe(0);
    const m = keyAliases(rebind(defaultBinds(), 'fold', 'KeyF', 'KeyR').binds);
    expect(m.get('F')).toBe('R');
    expect(m.get('R')).toBe('F');
  });

  it('are kept with the settings and come back cleaned', () => {
    expect(loadBinds()).toEqual(DEFAULT_BINDS);
    const moved = rebind(defaultBinds(), 'remove', 'KeyX', 'KeyC').binds;
    saveBinds(moved);
    expect(loadBinds()).toEqual(moved);
    expect(loadBinds().remove).toEqual(['KeyC']);
    // the other settings in the same record survive
    const raw = JSON.parse(G.localStorage!.getItem('foldworks_settings')!);
    expect(raw.binds.remove).toEqual(['KeyC']);
    saveBinds(null);
    expect(loadBinds()).toEqual(DEFAULT_BINDS);
    // a damaged record loads as the defaults
    G.localStorage!.setItem('foldworks_settings', '{not json');
    expect(loadBinds()).toEqual(DEFAULT_BINDS);
  });
});

describe('the UI scale', () => {
  it('Auto is the largest whole scale with 480x300 UI px; a pick is held to what the window takes', () => {
    expect(uiScaleFor(1280, 720, 0)).toBe(2);
    expect(uiScaleFor(1920, 1080, 0)).toBe(3);
    expect(uiScaleFor(1024, 640, 0)).toBe(2);
    expect(maxUiScale(1920, 1080)).toBe(4);
    expect(uiScaleFor(1920, 1080, 4)).toBe(4);
    expect(uiScaleFor(1024, 640, 6)).toBe(2);
    expect(uiScaleFor(1024, 640, 1)).toBe(1);
  });
});

// ---------------------------------------------------------------- the stuck-finder

function sandbox(seed = 1) {
  const g = new Game(seed);
  g.s.coin = N(1e9);
  g.s.land = CHUNKS.map((c) => c.id);
  g.s.research.done = [...RESEARCH_IDS];
  g.s.upgrades.push('bellows');
  return g;
}

function must(g: Game, c: Cmd) {
  const r = g.act(c);
  if (!r.ok) throw new Error(`${JSON.stringify(c)}: ${r.why}`);
}

describe('"where am I stuck?" (findStuck)', () => {
  it('with nothing stuck, says what the next goal needs', () => {
    // a Miner into the Hand Furnace, its slag into the Heap, its ingots along the belts to the Dock
    const g = sandbox();
    must(g, { k: 'place', kind: 'miner', x: 2, y: 3, rot: 0 });
    if (!g.entAt(3, 4)) must(g, { k: 'place', kind: 'heap', x: 3, y: 4, rot: 0 });
    g.step(20 * 30);
    expect(g.machines.find((m) => m.kind === 'furnace')!.state).toBe('work');
    const s = findStuck(g, 'workshop');
    expect(s.kind).toBe('goal');
    expect(s.say).toMatch(/^Nothing stuck/);
  });

  it('names the cause, not the symptom: a furnace choked on slag, not the press it starves', () => {
    const g = sandbox();
    must(g, { k: 'place', kind: 'miner', x: 2, y: 3, rot: 0 });
    // no Slag Heap beside the furnace: its slag has nowhere to go
    if (g.entAt(3, 4)?.kind === 'heap') must(g, { k: 'remove', x: 3, y: 4 });
    g.act({ k: 'remove', x: 5, y: 3 });
    must(g, { k: 'place', kind: 'press', x: 5, y: 3, rot: 0 });
    g.step(20 * 90);
    const furnace = g.machines.find((m) => m.kind === 'furnace')!;
    const press = g.machines.find((m) => m.kind === 'press')!;
    expect(furnace.state).toBe('blocked');
    expect(furnace.why).toBe('slag');
    expect(press.state).toBe('starved');
    const s = findStuck(g, 'workshop');
    expect(s.kind).toBe('ent');
    expect(s.id).toBe(furnace.id);
    expect(s.say).toMatch(/slag/i);
    expect(s.say).toMatch(/Heap/);
    expect(s.cost).toBeGreaterThan(0);
  });

  it('a starved machine with nothing feeding it says what to belt in', () => {
    const g = sandbox();
    must(g, { k: 'place', kind: 'assembler', x: 12, y: 6, rot: 0 });
    must(g, { k: 'recipe', x: 12, y: 6, recipe: 'cutGear' });
    g.step(20 * 5);
    const s = findStuck(g, 'workshop');
    const a = g.machines.find((m) => m.kind === 'assembler')!;
    if (a.state === 'starved') {
      expect(s.id).toBe(a.id);
      expect(s.say).toMatch(/nothing brings it/);
    } else expect(s.kind).toBe('goal');
  });

  it('on the District, names the route short of its want and how many skiffs carry it', () => {
    const g = sandbox();
    g.s.mega.stage = 3;
    g.s.flags.push('factoryOpen');
    g.s.ents = g.s.ents.filter((e) => e.kind === 'dock' || e.kind === 'hopper' || e.kind === 'furnace');
    g.rebuild();
    g.step(1);
    const d: ModuleDesign = {
      id: g.s.nextDesign++, name: 'Steel', box: { x: 0, y: 0, w: 2, h: 1 }, parts: [], ins: {}, outs: { steel: 10 },
      grade: { letter: 'B', score: 0.7, u: 1, w: 1, c: 1, mult: 1 }, bill: 1000, stamped: 0, spare: 4, depth: 2,
    };
    g.s.designs.push(d);
    const DK = HIGH.district.dock;
    must(g, { k: 'hplace', floor: 'district', design: d.id, x: DK.x - 1, y: DK.y });
    must(g, { k: 'hplace', floor: 'district', design: d.id, x: 0, y: DK.y });
    must(g, { k: 'route', floor: 'district', fx: DK.x - 1, fy: DK.y, tx: DK.x, ty: DK.y, item: 'steel' });
    must(g, { k: 'route', floor: 'district', fx: 0, fy: DK.y, tx: DK.x, ty: DK.y, item: 'steel' });
    g.step(20 * 10);
    const [near, far] = g.s.district!.routes;
    // both carry less than 10 a second: the far one leaves more behind (it is dearer)
    expect(routeCap(g, 'district', far)).toBeLessThan(routeCap(g, 'district', near));
    expect(routeCap(g, 'district', far)).toBeLessThan(0.9 * routeWant(g, 'district', far));
    const s = findStuck(g, 'district');
    expect(s.kind).toBe('route');
    expect(s.id).toBe(far.id);
    expect(s.say).toMatch(/skiffs? more/);
  });
});

describe('lesson cards', () => {
  it('a new game has learnt nothing; an old save past the firsts has learnt them', () => {
    const g = sandbox();
    expect(pastLessons(new Game(3))).toEqual([]);
    g.s.meta.runs = 2;
    g.s.flags.push('factorySeen');
    const past = pastLessons(g);
    for (const id of ['starved', 'slag', 'fold', 'factory', 'trunk', 'reorganize']) expect(past).toContain(id);
  });

  it('what a save has had is kept by its seed, the last eight saves', () => {
    expect(lessonsSeen(7)).toBeNull();
    saveLessonsSeen(7, ['slag']);
    expect(lessonsSeen(7)).toEqual(['slag']);
    for (let i = 100; i < 110; i++) saveLessonsSeen(i, ['fold']);
    expect(lessonsSeen(7)).toBeNull();
    expect(lessonsSeen(109)).toEqual(['fold']);
  });
});
