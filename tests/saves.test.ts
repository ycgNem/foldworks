// Save robustness (DESIGN.md §20; ROADMAP.md Milestone 6): a corrupt string, truncated JSON, an
// old version migrating, three rolling backups and their rotation, recovery from the newest good
// backup with the bad string kept aside and the reason in plain words, and the autosave cadence:
// closing and reopening never loses more than 30 s. Also the background tab's pump.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Game } from '../src/sim/Game';
import { N } from '../src/engine/num';
import { savePayload, checkSave, fingerprint } from '../src/sim/snapshot';
import { SAVE_VERSION, migrate, writeSaveSafe, loadSave, badSave, bakKey, badKey, parseSave, AutoSave, exportString, importString, unpackSave } from '../src/engine/save';
import { IDLE } from '../src/data/idle';
import { TICK_RATE } from '../src/engine/time';
import { Background } from '../src/app/background';

class MemStore {
  m = new Map<string, string>();
  quota = Infinity;
  get length() { return this.m.size; }
  clear() { this.m.clear(); }
  getItem(k: string) { return this.m.get(k) ?? null; }
  setItem(k: string, v: string) {
    let used = 0;
    for (const [kk, vv] of this.m) if (kk !== k) used += vv.length;
    if (used + v.length > this.quota) throw new Error('QuotaExceededError');
    this.m.set(k, v);
  }
  removeItem(k: string) { this.m.delete(k); }
  key(i: number) { return [...this.m.keys()][i] ?? null; }
}

const validate = (d: unknown) => void checkSave(d as never);
const MIN = 60_000;
const opts = (now: number) => ({ now, backupMs: IDLE.backupMinutes.value * MIN, backups: IDLE.backups.value, validate });

/** A small real game at `ticks`, and its save payload. */
function gameAt(ticks: number, seed = 3) {
  const g = new Game(seed);
  g.s.coin = N(500);
  g.s.upgrades.push('bellows');
  g.act({ k: 'place', kind: 'miner', x: 2, y: 3, rot: 0 });
  g.step(ticks);
  return g;
}

describe('loading a damaged save', () => {
  it('refuses a corrupt string and truncated JSON with plain words', () => {
    expect(() => parseSave('{"v":5,"seed":1,"snap":"{\\"tick', validate)).toThrow(/cut short or garbled/);
    expect(() => parseSave('not json at all', validate)).toThrow(/cut short or garbled/);
    expect(() => parseSave('42', validate)).toThrow(/holds no game/);
    expect(() => parseSave(JSON.stringify({ v: 99, seed: 1 }), validate)).toThrow(/newer version/);
    // parses and migrates, but the factory does not rebuild
    expect(() => parseSave(JSON.stringify({ v: SAVE_VERSION, seed: 1, saved: 0, snap: '{"tick":"x"}', snapTick: 0, log: [], tick: 0 }), validate)).toThrow(/could not be rebuilt/);
  });

  it('falls back to the newest good backup, keeps the bad string aside and says why', () => {
    const s = new MemStore() as unknown as Storage;
    let now = 1_000_000;
    // three saves 10 min apart: each rotates the one before into the backups
    for (let i = 1; i <= 4; i++) {
      const g = gameAt(i * 400);
      expect(writeSaveSafe(1, savePayload(g, now), opts(now), s).ok).toBe(true);
      now += 10 * MIN;
    }
    expect(s.getItem(bakKey(1, 1))).toBeTruthy();
    // the main save is cut off mid-write
    const raw = s.getItem('foldworks_save_1')!;
    s.setItem('foldworks_save_1', raw.slice(0, Math.floor(raw.length / 2)));
    const r = loadSave(1, validate, 3, s);
    expect(r.from).toBe('bak1');
    expect(r.problem).toMatch(/cut short/);
    expect(r.keptBad).toBe(true);
    expect(badSave(1, s)).toBe(raw.slice(0, Math.floor(raw.length / 2)));
    // the backup is the save before the last one (tick 1,200)
    const g = checkSave(r.data as never);
    expect(g.s.tick).toBe(1200);
  });

  it('skips a backup that is broken too, down to the oldest', () => {
    const s = new MemStore() as unknown as Storage;
    let now = 0;
    for (let i = 1; i <= 4; i++) { writeSaveSafe(1, savePayload(gameAt(i * 200), now), opts(now), s); now += 11 * MIN; }
    s.setItem('foldworks_save_1', '{garbage');
    s.setItem(bakKey(1, 1), '{"v":5');
    const r = loadSave(1, validate, 3, s);
    expect(r.from).toBe('bak2');
    expect(checkSave(r.data as never).s.tick).toBe(400);
  });

  it('with nothing that loads, says so and keeps the bad string', () => {
    const s = new MemStore() as unknown as Storage;
    s.setItem('foldworks_save_1', 'oops');
    const r = loadSave(1, validate, 3, s);
    expect(r.data).toBeNull();
    expect(r.problem).toMatch(/garbled/);
    expect(s.getItem(badKey(1))).toBe('oops');
  });

  it('a good main save loads from main, untouched', () => {
    const s = new MemStore() as unknown as Storage;
    const g = gameAt(500);
    writeSaveSafe(1, savePayload(g, 5), opts(5), s);
    const r = loadSave(1, validate, 3, s);
    expect(r.from).toBe('main');
    expect(r.problem).toBeNull();
    expect(fingerprint(checkSave(r.data as never))).toBe(fingerprint(g));
  });
});

describe('rolling backups', () => {
  it('keeps three, newest first, at most one every 10 min, and only from a save that loads', () => {
    const s = new MemStore() as unknown as Storage;
    let now = 0;
    const ticks: number[] = [];
    // a save every 30 s for 50 min
    for (let i = 1; i <= 100; i++) {
      const g = gameAt(i * 20);
      ticks.push(g.s.tick);
      writeSaveSafe(1, savePayload(g, now), opts(now), s);
      now += 30_000;
    }
    const tickOf = (k: string) => checkSave(JSON.parse(unpackSave(s.getItem(k)!))).s.tick;
    const b1 = tickOf(bakKey(1, 1)), b2 = tickOf(bakKey(1, 2)), b3 = tickOf(bakKey(1, 3));
    expect(b1).toBeGreaterThan(b2);
    expect(b2).toBeGreaterThan(b3);
    // 10 min of saves (20 saves of 20 ticks) between backups
    expect(b1 - b2).toBe(20 * 20);
    expect(b2 - b3).toBe(20 * 20);
    expect(s.getItem(bakKey(1, 4))).toBeNull();
    // a broken main save never rotates into the backups
    s.setItem('foldworks_save_1', '{broken');
    now += 11 * MIN;
    writeSaveSafe(1, savePayload(gameAt(5000), now), opts(now), s);
    expect(tickOf(bakKey(1, 1))).toBe(b1);
  });

  it('gives up the oldest backup when the browser is out of room', () => {
    const st = new MemStore();
    const s = st as unknown as Storage;
    let now = 0;
    for (let i = 1; i <= 4; i++) { writeSaveSafe(1, savePayload(gameAt(i * 100), now), opts(now), s); now += 11 * MIN; }
    const size = s.getItem('foldworks_save_1')!.length;
    st.quota = size * 3.5;
    const r = writeSaveSafe(1, savePayload(gameAt(900), now), opts(now), s);
    expect(r.ok).toBe(true);
    expect(s.getItem(bakKey(1, 3))).toBeNull();
  });
});

describe('versions', () => {
  it('an old (v1) save migrates through every step to the current version', () => {
    const st = { tick: 10, coin: 'N:5', earned: 'N:5', ents: [], research: { done: [], selected: null, progress: {}, bank: {} }, orders: { active: null, progress: {}, done: [], rep: {} } };
    const d = migrate({ v: 1, saved: 0, seed: 1, snap: JSON.stringify(st) });
    expect(d.v).toBe(SAVE_VERSION);
    const s2 = JSON.parse(d.snap as string);
    expect(s2.inspire).toEqual({});
    expect(s2.audits).toEqual([]);
    expect(s2.factory.ents.length).toBe(2);
  });

  it('a v4 save (Milestone 4) gains the Reorganize meta and Inspiration, and loads', () => {
    const g = gameAt(300);
    const p = savePayload(g, 0);
    const st = JSON.parse(p.snap);
    delete st.inspire;
    const d = migrate({ ...p, v: 4, snap: JSON.stringify(st) });
    expect(d.v).toBe(SAVE_VERSION);
    const back = checkSave(d as never);
    expect(back.s.inspire).toEqual({});
    expect(back.s.tick).toBe(300);
  });

  it('export strings carry the version and come back through the same checks', () => {
    const g = gameAt(250);
    const str = exportString(savePayload(g, 9));
    const d = importString(str);
    expect(d.v).toBe(SAVE_VERSION);
    expect(fingerprint(checkSave(d as never))).toBe(fingerprint(g));
  });
});

describe('the save cadence: closing never loses more than 30 s (DESIGN.md §20)', () => {
  /** A session of `secs` with autosave on the real clock; the tab closes at the end, with or
   * without a pagehide/visibilitychange save. Returns the seconds of play lost. */
  function session(secs: number, hook: boolean, frameMs = 16.7) {
    const auto = new AutoSave(IDLE.autosaveSeconds.value * 1000, 0);
    let lastSave = 0;
    for (let t = 0; t <= secs * 1000; t += frameMs) {
      if (auto.due(t)) { auto.mark(t); lastSave = t; }
    }
    if (hook) lastSave = secs * 1000;
    return (secs * 1000 - lastSave) / 1000;
  }

  it('with no unload hook at all (a crash), at most 30 s', () => {
    for (const secs of [5, 29, 31, 59.9, 61, 600, 3599.5]) expect(session(secs, false)).toBeLessThanOrEqual(30);
  });

  it('with the pagehide/visibility hooks, nothing', () => {
    for (const secs of [5, 29, 31, 59.9, 61, 600]) expect(session(secs, true)).toBe(0);
  });

  it('is real time, not sim time: fast-forward does not save every frame', () => {
    const auto = new AutoSave(30_000, 0);
    let saves = 0;
    // 10 s of real time at x1000: 200,000 ticks, one check a game second
    for (let tick = 0; tick < 200_000; tick++) {
      const now = (tick / 200_000) * 10_000;
      if (tick % TICK_RATE === 0 && auto.due(now)) { auto.mark(now); saves++; }
    }
    expect(saves).toBe(0);
  });
});

describe('the background tab (DESIGN.md §20)', () => {
  beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(0); });
  afterEach(() => vi.useRealTimers());

  it('pumps the owed ticks once a second while hidden, and owes nothing on return', () => {
    let ticks = 0;
    const bg = new Background(() => { ticks++; });
    bg.hide(Date.now());
    vi.advanceTimersByTime(10 * 60 * 1000);
    const back = bg.show(Date.now());
    expect(ticks + back.owed * TICK_RATE).toBeCloseTo(10 * 60 * TICK_RATE, -1);
    expect(back.owed).toBeLessThan(2);
    expect(back.away).toBe(0);
    expect(bg.stats.pumps).toBeGreaterThanOrEqual(599);
  });

  it('a pump that comes very late (the machine slept) counts the gap as time away, not ticks owed', () => {
    let ticks = 0;
    const bg = new Background(() => { ticks++; });
    bg.hide(Date.now());
    vi.advanceTimersByTime(5000);
    // the clock jumps 2 h with no timers firing (a laptop lid closed)
    vi.setSystemTime(Date.now() + 2 * 3600 * 1000);
    vi.advanceTimersByTime(1000);
    const back = bg.show(Date.now());
    expect(back.away).toBeGreaterThan(2 * 3600 - 5);
    expect(ticks).toBeLessThan(200);
  });

  it('throttled to one pump a minute, it still keeps up (1,200 ticks a pump)', () => {
    let ticks = 0;
    const bg = new Background(() => { ticks++; });
    bg.hide(Date.now());
    for (let i = 0; i < 10; i++) {
      vi.setSystemTime(Date.now() + 60_000);
      bg.pump(Date.now());
    }
    expect(ticks).toBe(10 * 60 * TICK_RATE);
  });
});
