// Milestone 12: the sound can't be heard in a test, so this checks what can be: the ambience
// mixer's arithmetic (a voice per family, never per machine; the count, the level, the pan, the
// few machine voices, the duck), what the app counts as sounding on screen, the stored settings
// made safe, that no AudioContext exists before a user gesture, and that every sound plays
// through a fake Web Audio graph without a bad ramp (a real context throws on those).
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mix, tickGap, MIX, MACHINE_FAMS, type Src } from '../src/engine/audio/mix';
import { Audio, SOUND_IDS } from '../src/engine/audio/audio';
import { familyOf, workshopSources, floorSources } from '../src/app/ambience';
import { cleanSound, SOUND_DEFAULT } from '../src/app/settings';
import { BUILD } from '../src/data/machines';
import type { Ent, FEnt } from '../src/sim/world';

describe('the ambience mixer', () => {
  it('makes one voice per family, however many are working', () => {
    const v = mix([{ fam: 'smelter', x: 0.2 }, { fam: 'smelter', x: 0.4 }, { fam: 'smelter', x: 0.6 }]);
    expect(v).toHaveLength(1);
    expect(v[0].fam).toBe('smelter');
    expect(v[0].n).toBe(3);
    expect(v[0].level).toBeCloseTo(Math.sqrt(3 / MIX.full.smelter));
  });

  it('grows by the square root of the count and stops at full', () => {
    const lv = (n: number) => mix(Array.from({ length: n }, () => ({ fam: 'press' as const, x: 0.5 })))[0].level;
    expect(lv(4)).toBeCloseTo(2 * lv(1));
    expect(lv(2) - lv(1)).toBeGreaterThan(lv(3) - lv(2));
    expect(lv(100)).toBe(1);
  });

  it('pans to where they stand on average, never hard into one ear', () => {
    expect(mix([{ fam: 'miner', x: 0.5 }])[0].pan).toBeCloseTo(0);
    expect(mix([{ fam: 'miner', x: 0 }, { fam: 'miner', x: 0 }])[0].pan).toBeCloseTo(-MIX.panWidth);
    expect(mix([{ fam: 'miner', x: 1 }])[0].pan).toBeCloseTo(MIX.panWidth);
    expect(mix([{ fam: 'miner', x: 0.75 }, { fam: 'miner', x: 1 }])[0].pan).toBeCloseTo((0.875 * 2 - 1) * MIX.panWidth);
    // a broken position sits in the middle, and the pan stays in range
    const odd = mix([{ fam: 'miner', x: NaN }, { fam: 'kiln', x: 7 }]);
    expect(odd.find((q) => q.fam === 'miner')!.pan).toBeCloseTo(0);
    expect(odd.find((q) => q.fam === 'kiln')!.pan).toBeCloseTo(MIX.panWidth);
  });

  it('lets only the busiest few machine families sound; beds always sound', () => {
    const srcs: Src[] = [];
    MACHINE_FAMS.forEach((fam, i) => { for (let k = 0; k <= i; k++) srcs.push({ fam, x: 0.5 }); });
    srcs.push({ fam: 'belt', x: 0.5 });
    const v = mix(srcs);
    const machines = v.filter((q) => MACHINE_FAMS.includes(q.fam));
    expect(machines).toHaveLength(MIX.machineVoices);
    // the most numerous win: the last families pushed had the most sources
    expect(machines.map((q) => q.fam).sort()).toEqual(MACHINE_FAMS.slice(-MIX.machineVoices).slice().sort());
    expect(v.some((q) => q.fam === 'belt')).toBe(true);
    expect(v.length).toBeLessThanOrEqual(MIX.machineVoices + 3);
  });

  it('weights skiffs by the route, ducks under a panel, ignores nothing-weights', () => {
    const v = mix([{ fam: 'skiff', x: 0.5, w: 3 }, { fam: 'skiff', x: 0.5, w: 0 }]);
    expect(v[0].n).toBe(3);
    const loud = mix([{ fam: 'module', x: 0.5 }])[0].level;
    expect(mix([{ fam: 'module', x: 0.5 }], { duck: true })[0].level).toBeCloseTo(loud * MIX.duck);
    expect(mix([])).toEqual([]);
  });

  it('ticks faster as more work, at most twice as fast', () => {
    expect(tickGap(1, 1)).toBe(1);
    expect(tickGap(1, 4)).toBeLessThan(1);
    expect(tickGap(1, 1e6)).toBe(0.5);
  });
});

describe('what the app hears on screen', () => {
  const ent = (kind: string, x: number, o: Partial<Ent> = {}) => ({ id: x, kind, x, y: 0, w: 1, h: 1, state: 'work', mv: false, ...o }) as unknown as Ent;
  // tiles 0..9 across the view; past 9 is off screen
  const at = (tx: number) => (tx > 10 ? null : tx / 10);

  it('maps every crafting machine and power plant to a family', () => {
    for (const [k, d] of Object.entries(BUILD)) {
      if ('machine' in d && d.machine) expect(familyOf(k), k).not.toBeNull();
    }
    expect(familyOf('smelterMk2')).toBe('smelter');
    expect(familyOf('mixer')).toBe('kiln');
    expect(familyOf('generator')).toBe('power');
    expect(familyOf('belt')).toBeNull();
    expect(familyOf('pole')).toBeNull();
  });

  it('counts the working ones on screen, and belts that moved', () => {
    const src = workshopSources({
      miners: [ent('miner', 1), ent('miner', 2, { state: 'starved' }), ent('miner', 30)],
      machines: [ent('smelter', 3), ent('press', 4, { paused: true }), ent('assemblerMk2', 5, { w: 2, h: 2 })],
      power: [ent('boiler', 6), ent('pole', 7)],
      belts: [ent('belt', 1, { mv: true }), ent('belt', 2), ent('belt', 3, { mv: true })],
    }, (tx) => at(tx));
    const n = (f: string) => src.filter((s) => s.fam === f).length;
    expect(n('miner')).toBe(1);
    expect(n('smelter')).toBe(1);
    expect(n('press')).toBe(0);
    expect(n('assembler')).toBe(1);
    expect(src.find((s) => s.fam === 'assembler')!.x).toBeCloseTo(0.6);
    expect(n('power')).toBe(1);
    expect(n('belt')).toBe(2);
  });

  it('hears working modules and carrying trunks on the Factory', () => {
    const f = (kind: string, x: number, o: Partial<FEnt> = {}) => ({ id: x, kind, x, y: 0, w: 1, h: 1, state: 'work', flow: 0, ...o }) as unknown as FEnt;
    const src = floorSources([f('module', 1), f('module', 2, { state: 'starved' }), f('trunk', 3, { flow: 1 }), f('trunk', 4), f('fdock', 5), f('module', 40)], (tx) => at(tx));
    expect(src.filter((s) => s.fam === 'module')).toHaveLength(1);
    expect(src.filter((s) => s.fam === 'belt')).toHaveLength(1);
  });
});

describe('the sound settings', () => {
  it('fills what is missing and clamps what is damaged', () => {
    expect(cleanSound(undefined)).toEqual(SOUND_DEFAULT);
    expect(cleanSound('nonsense')).toEqual(SOUND_DEFAULT);
    expect(cleanSound({ master: 2, sfx: -1, amb: 'x', ui: 0.333, muted: 'yes' })).toEqual({ master: 1, sfx: 0, amb: SOUND_DEFAULT.amb, ui: 0.35, muted: false });
    expect(cleanSound({ master: 0.5, sfx: 0.5, amb: 0, ui: 1, muted: true })).toEqual({ master: 0.5, sfx: 0.5, amb: 0, ui: 1, muted: true });
  });
});

// ---------------------------------------------------------------- a fake Web Audio graph

const links: unknown[] = [];
class FakeParam {
  value = 1;
  setValueAtTime(v: number) { this.check(v); this.value = v; }
  linearRampToValueAtTime(v: number) { this.check(v); this.value = v; }
  exponentialRampToValueAtTime(v: number) {
    if (!(v > 0) || !Number.isFinite(v)) throw new RangeError(`exponential ramp to ${v}`);
    this.value = v;
  }
  setTargetAtTime(v: number) { this.check(v); this.value = v; }
  private check(v: number) { if (!Number.isFinite(v)) throw new RangeError(`param ${v}`); }
}
class FakeNode {
  gain = new FakeParam(); frequency = new FakeParam(); Q = new FakeParam(); detune = new FakeParam(); playbackRate = new FakeParam(); pan = new FakeParam();
  type = ''; loop = false; buffer: unknown = null; started = 0;
  constructor(public ctx: FakeContext) { ctx.nodes++; }
  connect(n: unknown) { if (!n) throw new Error('connect to nothing'); links.push(n); return n; }
  start() { this.started++; }
  stop() {}
}
class FakeContext {
  static made = 0;
  nodes = 0;
  currentTime = 1;
  sampleRate = 8000;
  state = 'running';
  destination = {};
  constructor() { FakeContext.made++; }
  resume() {}
  createGain() { return new FakeNode(this); }
  createOscillator() { return new FakeNode(this); }
  createBufferSource() { return new FakeNode(this); }
  createBiquadFilter() { return new FakeNode(this); }
  createStereoPanner() { return new FakeNode(this); }
  createBuffer(_c: number, len: number) { const d = new Float32Array(len); return { getChannelData: () => d }; }
}

describe('the audio engine', () => {
  const g = globalThis as unknown as { window?: unknown };
  let had: unknown;
  beforeEach(() => { had = g.window; g.window = { AudioContext: FakeContext }; FakeContext.made = 0; });
  afterEach(() => { g.window = had; });

  it('creates no AudioContext before a user gesture, and one after', () => {
    const a = new Audio();
    for (const id of SOUND_IDS) a.sfx(id);
    a.foldSound(true);
    a.resetSound(3);
    a.ambience(mix([{ fam: 'smelter', x: 0.5 }]), 0.1);
    a.applySettings({ master: 0.5 });
    a.setMuted(true);
    expect(FakeContext.made).toBe(0);
    expect(a.ctx).toBeNull();
    a.unlock();
    a.unlock();
    expect(FakeContext.made).toBe(1);
  });

  it('plays every sound, the fold, each reset and every voice without a bad ramp', () => {
    const a = new Audio();
    a.unlock();
    const ctx = a.ctx as unknown as FakeContext;
    for (const id of SOUND_IDS) {
      for (const p of [1, 1.26]) {
        ctx.currentTime += 1; // past the repeat guard
        expect(() => a.sfx(id, 1, p), id).not.toThrow();
      }
    }
    expect(() => { a.foldSound(true); a.foldSound(false); }).not.toThrow();
    for (const l of [1, 2, 3] as const) expect(() => a.resetSound(l)).not.toThrow();
    const all: Src[] = [...MACHINE_FAMS, 'belt', 'module', 'skiff'].map((fam) => ({ fam, x: Math.random() } as Src));
    // a few seconds of frames: every ticking family ticks
    for (let i = 0; i < 300; i++) expect(() => a.ambience(mix(all), 1 / 60)).not.toThrow();
    // a voice per family that sounded, never more
    expect(a.amb.built().length).toBe(mix(all).length);
    const nodes = ctx.nodes;
    for (let i = 0; i < 10; i++) a.ambience(mix(all), 0);
    expect(ctx.nodes).toBe(nodes);
    expect(() => a.amb.hush()).not.toThrow();
  });

  it('routes the interface to its own bus, keeps the volumes apart and reports changes', () => {
    const a = new Audio();
    a.unlock();
    links.length = 0;
    a.sfx('click');
    expect(links).toContain(a.uiBus);
    expect(links).not.toContain(a.sfxBus);
    links.length = 0;
    a.sfx('coin');
    expect(links).toContain(a.sfxBus);
    expect(links).not.toContain(a.uiBus);
    a.applySettings({ ui: 0 });
    expect(a.vol.ui).toBe(0);
    expect(a.vol.sfx).toBeGreaterThan(0);
    let saved = 0;
    a.onChange = () => saved++;
    a.setMuted(false);
    a.applySettings({ amb: 0.2 });
    expect(saved).toBe(2);
  });
});
