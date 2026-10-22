// Save size (ROADMAP.md Milestone 14: under 200 KB; DESIGN.md §20 "Save size"): the deflate codec
// against Node's zlib both ways, the packed slot and the FW2 export string, old slots (plain JSON)
// and old FW1 strings still loading, and a late game with every floor full (the dense 24x16
// Workshop, the widest Factory, 200 modules on each high floor) staying under the limit and coming
// back the same game.
import { describe, expect, it } from 'vitest';
import zlib from 'node:zlib';
import fs from 'node:fs';
import { deflateRaw, inflateRaw } from '../src/engine/deflate';
import { SAVE_VERSION, packSave, unpackSave, writeSaveSafe, loadSave, readSave, exportString, importString, parseSave } from '../src/engine/save';
import { Game, type Cmd } from '../src/sim/Game';
import { N, Num } from '../src/engine/num';
import { RESEARCH_IDS } from '../src/data/research';
import { CHUNKS, FACTORY, ANNEX } from '../src/data/land';
import { HIGH, type HighFloorId } from '../src/data/floors';
import { KERNELS } from '../src/data/kernels';
import { isSky } from '../src/sim/systems/islands';
import { savePayload, checkSave, fingerprint } from '../src/sim/snapshot';
import type { ModuleDesign } from '../src/sim/world';

class MemStore {
  m = new Map<string, string>();
  get length() { return this.m.size; }
  clear() { this.m.clear(); }
  getItem(k: string) { return this.m.get(k) ?? null; }
  setItem(k: string, v: string) { this.m.set(k, v); }
  removeItem(k: string) { this.m.delete(k); }
  key(i: number) { return [...this.m.keys()][i] ?? null; }
}

const LIMIT = 200 * 1024;
const enc = (s: string) => new TextEncoder().encode(s);
const same = (a: Uint8Array, b: Uint8Array) => a.length === b.length && Buffer.from(a).equals(Buffer.from(b));

/** Bytes with the shape of a save: JSON-ish runs with numbers, plus noise. */
function samples(): [string, Uint8Array][] {
  let r = 12345;
  const rnd = () => ((r = (Math.imul(r, 1103515245) + 12345) >>> 0) / 4294967296);
  const noise = Uint8Array.from({ length: 70_000 }, () => Math.floor(rnd() * 256));
  const json = enc(JSON.stringify(Array.from({ length: 3000 }, (_, i) => ({ id: i, kind: ['belt', 'miner', 'smelter'][i % 3], x: i % 24, y: (i / 24) | 0, inBuf: { ironOre: rnd() * 9 }, p: rnd() }))));
  return [
    ['empty', new Uint8Array(0)],
    ['one byte', enc('x')],
    ['short', enc('{"a":1}')],
    ['a long run', new Uint8Array(100_000).fill(97)],
    ['noise', noise],
    ['json', json],
    ['far repeats', new Uint8Array([...noise.subarray(0, 40_000), ...noise.subarray(0, 40_000)])],
  ];
}

describe('deflate (src/engine/deflate.ts)', () => {
  it('what it writes, zlib reads back exactly', () => {
    for (const [name, a] of samples()) expect(same(zlib.inflateRawSync(deflateRaw(a)), a), name).toBe(true);
  });

  it('what zlib writes (stored, fixed and dynamic blocks), it reads back exactly', () => {
    for (const [name, a] of samples())
      for (const o of [{ level: 0 }, { level: 1 }, { level: 9 }, { level: 9, strategy: zlib.constants.Z_FIXED }, { level: 6, strategy: zlib.constants.Z_HUFFMAN_ONLY }])
        expect(same(inflateRaw(zlib.deflateRawSync(a, o)), a), `${name} ${JSON.stringify(o)}`).toBe(true);
  });

  it('round-trips its own output, and throws on a stream cut short', () => {
    for (const [name, a] of samples()) expect(same(inflateRaw(deflateRaw(a)), a), name).toBe(true);
    const z = deflateRaw(samples()[5][1]);
    expect(() => inflateRaw(z.subarray(0, z.length >> 1))).toThrow();
  });

  it('packs repetitive JSON as well as zlib does with the same fixed codes', () => {
    const a = enc(JSON.stringify(Array.from({ length: 4000 }, (_, i) => ({ id: i, kind: ['belt', 'miner', 'smelter'][i % 3], x: i % 24, y: (i / 24) | 0, rot: i % 4, item: i % 5 ? 'ironOre' : null }))));
    const ours = deflateRaw(a).length, fixed = zlib.deflateRawSync(a, { level: 9, strategy: zlib.constants.Z_FIXED }).length;
    expect(ours).toBeLessThan(a.length / 8);
    expect(ours).toBeLessThan(fixed * 1.25);
  });
});

describe('packed slots and FW2 strings', () => {
  it('a slot holds the JSON packed; a slot written before Milestone 14 (plain JSON) still loads', () => {
    const json = JSON.stringify({ seed: 4, saved: 1, v: SAVE_VERSION, note: 'frog'.repeat(500) });
    const packed = packSave(json);
    expect(packed.startsWith('FWZ1.')).toBe(true);
    expect(packed.length).toBeLessThan(json.length / 4);
    expect(unpackSave(packed)).toBe(json);
    expect(unpackSave(json)).toBe(json);
    const s = new MemStore() as unknown as Storage;
    s.setItem('foldworks_save_1', json);
    expect(readSave(1, s)?.note).toBe('frog'.repeat(500));
    // a packed string cut short is "cut short or garbled", as a cut JSON string was
    expect(() => parseSave(packed.slice(0, packed.length >> 1))).toThrow(/cut short or garbled/);
    expect(() => parseSave(packed.slice(0, -3) + 'abc')).toThrow(/cut short or garbled/);
  });

  it('an FW1 export string (before Milestone 14) still imports', () => {
    const json = JSON.stringify({ seed: 9, saved: 2, v: SAVE_VERSION, note: 'old' });
    const body = Buffer.from(json, 'utf8').toString('base64url');
    let h = 2166136261;
    for (let i = 0; i < body.length; i++) { h ^= body.charCodeAt(i); h = Math.imul(h, 16777619); }
    const fw1 = `FW1.${body}.${(h >>> 0).toString(16).padStart(8, '0')}`;
    expect(importString(fw1).note).toBe('old');
    const fw2 = exportString({ seed: 9, saved: 2, note: 'new' });
    expect(fw2.startsWith('FW2.')).toBe(true);
    expect(importString(fw2).note).toBe('new');
  });
});

// ---------------------------------------------------------------- a late game, every floor full

function must(g: Game, c: Cmd) {
  const r = g.act(c);
  if (!r.ok) throw new Error(`${JSON.stringify(c)}: ${r.why}`);
}

function design(g: Game, name: string, depth: number, outs: Record<string, number>): ModuleDesign {
  const d: ModuleDesign = {
    id: g.s.nextDesign++, name, box: { x: 0, y: 0, w: 4, h: 3 }, parts: [], ins: {}, outs: outs as never,
    grade: { letter: 'A', score: 0.86, u: 0.9, w: 1, c: 0.8, mult: 1.1 }, bill: 1000, stamped: 0, spare: 999, depth: depth as ModuleDesign['depth'],
  };
  g.s.designs.push(d);
  return d;
}

/** Everything researched and open (Beyond too), then every floor filled as e2e/perf.mjs fills it. */
function lateGame(): Game {
  const g = new Game(53);
  g.s.coin = N(1e13);
  g.s.land = CHUNKS.map((c) => c.id).filter((c) => !isSky(g, c));
  g.s.research.done = [...RESEARCH_IDS];
  g.s.upgrades.push('bellows');
  g.s.mega.stage = 3;
  g.s.megas = { city: { stage: 2, progress: {} }, transmuter: { stage: 2, progress: {} }, lighthouse: { stage: 4, progress: {}, done: [1, 2, 3, 4] }, anchor: { stage: 4, progress: {}, done: [1, 2, 3, 4] } };
  g.s.flags.push('factoryOpen');
  g.rebuild();
  g.s.meta.kernels = (g.s.meta.kernels ?? Num.ZERO).add(KERNELS.beyond.cost);
  must(g, { k: 'kernel', id: 'beyond' });
  g.step(1);
  // the Workshop: a serpentine belt over every free tile, every belt carrying an item
  for (let y = 0; y < g.H; y++)
    for (let x0 = 0; x0 < g.W; x0++) {
      const x = y % 2 ? g.W - 1 - x0 : x0;
      if (!g.entAt(x, y) && g.owned(x, y)) g.act({ k: 'place', kind: 'belt', x, y, rot: x0 === g.W - 1 ? 1 : y % 2 ? 2 : 0 });
    }
  for (const e of g.belts) e.item = 'ironOre';
  // the Factory at its widest: trunks along rows 1 and 5 into the Dock and the Hopper, modules
  g.s.annex = ANNEX.blocks;
  g.rebuild();
  const fd = [design(g, 'Gizmo works', 1, { gizmo: 0.5 }), design(g, 'Steel works', 2, { steel: 1 })];
  for (const y of [1, 5]) for (let x = 0; x < g.fw; x++) if (!g.fentAt(x, y)) g.act({ k: 'ftrunk', x, y, rot: x < FACTORY.dock.x ? 0 : 2 });
  for (let y = 0; y < g.fh; y++) for (let x = 0; x < g.fw; x++) if (!g.fentAt(x, y)) g.act({ k: 'fplace', design: fd[(x + y) % 2].id, x, y, rot: y === 0 || y === 4 ? 1 : 3 });
  // each high floor: every lot, up to 200 modules, each flying to the Dock or the Hopper
  const outs: Record<HighFloorId, [string, string]> = { district: ['steel', 'glass'], world: ['steel', 'skyglassLens'], beyond: ['stormCell', 'processor'] };
  for (const f of ['district', 'world', 'beyond'] as HighFloorId[]) {
    const st = g.s[f]!;
    const H = HIGH[f];
    st.lots = H.lots;
    const ds = outs[f].map((it, i) => design(g, `${it} works ${f} ${i}`, H.depth, { [it]: 0.5 }));
    let n = 0;
    for (let y = 0; y < H.h && n < 200; y++)
      for (let x = 0; x < H.w + H.lotCols * H.lots && n < 200; x++) {
        const d = ds[(x + y) % 2];
        if (!g.act({ k: 'hplace', floor: f, design: d.id, x, y }).ok) continue;
        n++;
        const to = y < H.h / 2 ? H.dock : H.hopper;
        g.act({ k: 'route', floor: f, fx: x, fy: y, tx: to.x, ty: to.y, item: Object.keys(d.outs)[0] as never });
      }
  }
  g.step(20 * 60);
  return g;
}

describe('a late save stays under 200 KB (DESIGN.md §20)', () => {
  it('every floor full: the packed slot and the export string are under the limit and load back the same game', () => {
    const g = lateGame();
    const mods = (['district', 'world', 'beyond'] as const).map((f) => g.s[f]!.ents.filter((e) => e.kind === 'module').length);
    expect(Math.min(...mods)).toBeGreaterThanOrEqual(150);
    const before = fingerprint(g);
    const p = savePayload(g, 0);
    const json = JSON.stringify({ ...p, v: SAVE_VERSION });
    const t0 = performance.now();
    const packed = packSave(json);
    const ms = performance.now() - t0;
    const exp = exportString(p);
    console.log(`late save: ${g.s.ents.length} Workshop things, ${g.s.factory.ents.length} on the Factory, ${mods.join(' / ')} modules on the high floors; JSON ${(json.length / 1024).toFixed(1)} KB, packed ${(packed.length / 1024).toFixed(1)} KB (${ms.toFixed(0)} ms), export ${(exp.length / 1024).toFixed(1)} KB; zlib -9 would be ${((zlib.deflateRawSync(enc(json), { level: 9 }).length * 4) / 3 / 1024).toFixed(1)} KB as base64`);
    expect(packed.length).toBeLessThan(LIMIT);
    expect(exp.length).toBeLessThan(LIMIT);
    const s = new MemStore() as unknown as Storage;
    expect(writeSaveSafe(1, p, { now: 0, backupMs: 600_000, backups: 3, validate: (d) => void checkSave(d as never) }, s).ok).toBe(true);
    const r = loadSave(1, (d) => void checkSave(d as never), 3, s);
    expect(r.from).toBe('main');
    expect(fingerprint(checkSave(r.data as never))).toBe(before);
    expect(fingerprint(checkSave(importString(exp) as never))).toBe(before);
  }, 120_000);

  // the 40 h checkpoint the Act III bot writes (tests/pace-act3-helpers.ts), when a run has left one
  const CP = 'e2e/out/checkpoints/seed1000-40h.txt';
  it.skipIf(!fs.existsSync(CP))('the 40 h checkpoint packs under the limit', () => {
    const d = importString(fs.readFileSync(CP, 'utf8'));
    const json = JSON.stringify(d);
    const packed = packSave(json);
    console.log(`40 h checkpoint: JSON ${(json.length / 1024).toFixed(1)} KB, packed ${(packed.length / 1024).toFixed(1)} KB`);
    expect(packed.length).toBeLessThan(LIMIT);
    expect(unpackSave(packed)).toBe(json);
  });
});
