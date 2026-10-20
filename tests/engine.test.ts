// The engine layer (from Trotline's tests): saves and migrations, export strings, the event queue,
// the font's coverage of every string the HUD draws, and the overlap audit's three kinds of finding.
import { describe, expect, it } from 'vitest';
import { MIGRATIONS, SAVE_VERSION, migrate, readSave, writeSave, listSlots, deleteSave, exportString, importString } from '../src/engine/save';
import { EventQueue } from '../src/engine/events';
import { hasGlyph, textWidth } from '../src/ui/font';
import { findIssues, AuditRec } from '../src/ui/audit';
import fs from 'node:fs';

class MemStore {
  m = new Map<string, string>();
  get length() { return this.m.size; }
  clear() { this.m.clear(); }
  getItem(k: string) { return this.m.get(k) ?? null; }
  setItem(k: string, v: string) { this.m.set(k, v); }
  removeItem(k: string) { this.m.delete(k); }
  key(i: number) { return [...this.m.keys()][i] ?? null; }
}

describe('saves', () => {
  it('round-trips a payload through a slot', () => {
    const s = new MemStore() as unknown as Storage;
    expect(writeSave(2, { seed: 42, saved: 1, note: 'x' }, s)).toBe(true);
    const d = readSave(2, s)!;
    expect(d.v).toBe(SAVE_VERSION);
    expect(d.seed).toBe(42);
    expect(listSlots(s)).toEqual([2]);
    deleteSave(2, s);
    expect(readSave(2, s)).toBeNull();
  });

  it('runs migrations in order and refuses gaps and newer saves', () => {
    const chain = { 1: (d: any) => ({ ...d, a: 1, v: 2 }), 2: (d: any) => ({ ...d, b: d.a + 1, v: 3 }) };
    expect(migrate({ v: 1, seed: 1 }, chain, 3)).toMatchObject({ v: 3, a: 1, b: 2 });
    expect(() => migrate({ v: 1 }, { 2: chain[2] }, 3)).toThrow(/no migration from v1/);
    expect(() => migrate({ v: 9 }, chain, 3)).toThrow(/newer/);
    expect(() => migrate({ v: 1 }, { 1: (d: any) => d }, 2)).toThrow(/did not set/);
  });

  it('has a migration for every version below the current one', () => {
    for (let v = 1; v < SAVE_VERSION; v++) expect(MIGRATIONS[v]).toBeTypeOf('function');
  });
});

describe('export strings', () => {
  it('round-trip, and refuse damaged or foreign strings with a reason', () => {
    const str = exportString({ seed: 7, saved: 1, snap: '{"a":1}', note: 'frog' });
    expect(str.startsWith('FW1.')).toBe(true);
    const d = importString(str);
    expect(d.seed).toBe(7);
    expect(d.note).toBe('frog');
    const parts = str.split('.');
    const broken = parts[0] + '.' + parts[1].slice(0, -2) + 'zz.' + parts[2];
    expect(() => importString(broken)).toThrow(/damaged/);
    expect(() => importString('hello')).toThrow(/not a Foldworks save/);
  });
});

describe('event queue', () => {
  it('drains oldest first and caps its length by dropping the oldest', () => {
    const q = new EventQueue();
    q.max = 3;
    for (let i = 0; i < 5; i++) q.push({ type: 't', tick: i });
    expect(q.drain().map((e) => e.tick)).toEqual([2, 3, 4]);
    expect(q.length).toBe(0);
  });
});

describe('font', () => {
  // every literal the HUD can draw must be in the glyph table (an unknown char draws as '?')
  it('covers the HUD strings and every name and line in the data', () => {
    const files = ['src/app/hud.ts', 'src/app/app.ts', 'src/app/panels.ts', 'src/app/goals.ts', ...fs.readdirSync('src/data').map((f) => 'src/data/' + f)];
    // derivation strings are for DESIGN.md, never drawn
    const src = files.map((f) => fs.readFileSync(f, 'utf8')).join('\n')
      .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\s\/\/ .*$/gm, '')
      .split('\n').filter((l) => !l.includes('derivation:') && !l.includes('§')).join('\n');
    const literals = [...src.matchAll(/'([^'\\]*)'|`([^`]*)`/g)].map((m) => (m[1] ?? m[2]).replace(/\$\{[^}]*\}/g, ''));
    const chars = new Set(literals.join('') + '0123456789.:-x%°');
    for (const ch of chars) {
      if (ch === "'" || ch === '\\' || /\s/.test(ch)) continue;
      expect(hasGlyph(ch), `glyph for ${JSON.stringify(ch)}`).toBe(true);
    }
    expect(textWidth('Coin 20/20')).toBeGreaterThan(0);
  });
});

describe('overlap audit', () => {
  const rec = (kind: AuditRec['kind'], x: number, y: number, w: number, h: number, seq: number, s?: string): AuditRec => ({ kind, x, y, w, h, s, layer: 'ui', seq });
  it('finds clashing, overflowing and covered text, and nothing in a clean frame', () => {
    expect(findIssues([rec('panel', 0, 0, 100, 20, 0), rec('text', 4, 4, 40, 9, 1, 'ok')], { w: 200, h: 100 })).toEqual([]);
    expect(findIssues([rec('text', 4, 4, 40, 9, 0, 'a'), rec('text', 10, 6, 40, 9, 1, 'b')], { w: 200, h: 100 })[0].type).toBe('clash');
    expect(findIssues([rec('panel', 0, 0, 30, 20, 0), rec('text', 4, 4, 40, 9, 1, 'long')], { w: 200, h: 100 })[0].type).toBe('overflow');
    expect(findIssues([rec('text', 4, 4, 40, 9, 0, 'under'), rec('fill', 0, 0, 50, 20, 1)], { w: 200, h: 100 })[0].type).toBe('covered');
  });
});
