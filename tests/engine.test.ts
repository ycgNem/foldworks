// The engine layer (from Trotline's tests): saves and migrations, export strings, the event queue,
// the font's coverage of every string the HUD draws, and the overlap audit's three kinds of finding.
import { describe, expect, it } from 'vitest';
import { MIGRATIONS, SAVE_VERSION, migrate, readSave, writeSave, listSlots, deleteSave, exportString, importString } from '../src/engine/save';
import { EventQueue } from '../src/engine/events';
import { hasGlyph, textWidth, hasSmallGlyph, smallWidth, hasBigGlyph, bigWidth, ICON, FACES, FONT_H, LINE_H, BIG_H, BIG_LINE_H, SMALL_H, SMALL_LINE } from '../src/ui/font';
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
    // FW2 since Milestone 14 (deflated); tests/deflate.test.ts checks an FW1 string still imports
    expect(str.startsWith('FW2.')).toBe(true);
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
  // Reed, the body face: every literal the HUD can draw must be in its table (an unknown char
  // draws as '?'). Rich-text markup (docs/hud-180.md "Rich text") is stripped first: a `{name:`
  // opener, a whole `{name}` token such as `{coin}`, and the closing `}`; what is left is drawn.
  it('covers the HUD strings and every name and line in the data, markup stripped', () => {
    const files = [...fs.readdirSync('src/app').filter((f) => f.endsWith('.ts')).map((f) => 'src/app/' + f), ...fs.readdirSync('src/data').map((f) => 'src/data/' + f)];
    // derivation strings are for DESIGN.md, never drawn
    const src = files.map((f) => fs.readFileSync(f, 'utf8')).join('\n')
      .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\s\/\/ .*$/gm, '')
      .split('\n').filter((l) => !l.includes('derivation:') && !l.includes('§')).join('\n');
    const literals = [...src.matchAll(/'([^'\\]*)'|`([^`]*)`/g)].map((m) => stripMarkup((m[1] ?? m[2]).replace(/\$\{[^}]*\}/g, '')));
    const chars = new Set(literals.join('') + '0123456789.:-x%°');
    for (const ch of chars) {
      if (ch === "'" || ch === '\\' || /\s/.test(ch)) continue;
      expect(hasGlyph(ch), `glyph for ${JSON.stringify(ch)}`).toBe(true);
    }
    expect(textWidth('Coin 20/20')).toBeGreaterThan(0);
  });
  it('strips rich-text markup before the coverage check', () => {
    expect(stripMarkup('{i:ironOre} → {i:ironIngot}  {coin:25} {k:LMB} shovel {coin} {bad:CHOKED}')).toBe('ironOre → ironIngot  25 LMB shovel  CHOKED');
    expect(stripMarkup('{big:S+} {good:+7.0K}/min')).toBe('S+ +7.0K/min');
  });
  it('draws every printable ASCII char, the marks and every ICON in Reed', () => {
    for (let c = 32; c < 127; c++) expect(hasGlyph(String.fromCharCode(c)), `Reed ${String.fromCharCode(c)}`).toBe(true);
    for (const ch of '°×·÷→←↑↓—–…') expect(hasGlyph(ch), `Reed ${ch}`).toBe(true);
    for (const ch of Object.values(ICON)) expect(hasGlyph(ch), `Reed icon ${ch.charCodeAt(0)}`).toBe(true);
  });
  // Bullfrog, the display face: the Purse, titles, names, grade letters and big numbers
  it('has a Bullfrog glyph for every letter, figure, grade and number mark', () => {
    for (const ch of 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789 .,:;!?\'"-+/%()&#$×→' + ICON.coin) expect(hasBigGlyph(ch), `Bullfrog ${ch}`).toBe(true);
    expect(bigWidth('S+')).toBeGreaterThan(textWidth('S+'));
  });
  // Pip, the small face (prices, keycap letters, chip counts); lowercase draws as capitals
  it('has a Pip glyph for every capital, figure and price mark', () => {
    for (const ch of 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789.,:/+-%()!?\'#=&<>$×→*' + ICON.coin) expect(hasSmallGlyph(ch), `small glyph for ${ch}`).toBe(true);
    expect(smallWidth('1.2K')).toBeLessThan(textWidth('1.2K'));
    expect(smallWidth('q')).toBe(smallWidth('Q'));
  });
  // the metrics docs/hud-180.md fixes, and figures that line up in columns
  it('keeps each face to its metrics, with tabular figures', () => {
    expect([FONT_H, LINE_H, BIG_H, BIG_LINE_H, SMALL_H, SMALL_LINE]).toEqual([9, 11, 11, 13, 5, 7]);
    const faces: [string, Record<string, string>, number, number, number][] = [
      // name, table, cap height, cell height (a glyph may hang 1 px below Pip), figure width
      ['Reed', FACES.reed, 7, FONT_H, 5], ['Bullfrog', FACES.bullfrog, 9, BIG_H, 7], ['Pip', FACES.pip, 5, SMALL_H + 1, 4],
    ];
    for (const [name, table, cap, cell, fig] of faces) {
      for (const [ch, def] of Object.entries(table)) {
        const rows = def.split('|');
        expect(new Set(rows.map((r) => r.length)).size, `${name} ${JSON.stringify(ch)} rows all one width`).toBe(1);
        expect(rows.length, `${name} ${JSON.stringify(ch)} fits the cell`).toBeLessThanOrEqual(cell);
        expect(/^[#.|]+$/.test(def), `${name} ${JSON.stringify(ch)} only # and .`).toBe(true);
      }
      for (const d of '0123456789') expect(table[d].split('|')[0].length, `${name} figure ${d}`).toBe(fig);
      // capitals stand on the baseline: their last cap row has ink
      for (const ch of 'EHLTZ') expect(table[ch].split('|')[cap - 1].includes('#'), `${name} ${ch} on the baseline`).toBe(true);
    }
    expect(textWidth('1,234,567')).toBe(textWidth('9,876,543'));
    expect(bigWidth('1.58M')).toBe(bigWidth('8.88M'));
  });
});

/** The coverage scan's view of a rich-text string: markup gone, the drawn text left. */
function stripMarkup(s: string): string {
  return s.replace(/\{[A-Za-z]+\}/g, '').replace(/\{[A-Za-z]+:/g, '').replace(/\}/g, '');
}

describe('overlap audit', () => {
  const rec = (kind: AuditRec['kind'], x: number, y: number, w: number, h: number, seq: number, s?: string): AuditRec => ({ kind, x, y, w, h, s, layer: 'ui', seq });
  it('finds clashing, overflowing and covered text, and nothing in a clean frame', () => {
    expect(findIssues([rec('panel', 0, 0, 100, 20, 0), rec('text', 4, 4, 40, 9, 1, 'ok')], { w: 200, h: 100 })).toEqual([]);
    expect(findIssues([rec('text', 4, 4, 40, 9, 0, 'a'), rec('text', 10, 6, 40, 9, 1, 'b')], { w: 200, h: 100 })[0].type).toBe('clash');
    expect(findIssues([rec('panel', 0, 0, 30, 20, 0), rec('text', 4, 4, 40, 9, 1, 'long')], { w: 200, h: 100 })[0].type).toBe('overflow');
    expect(findIssues([rec('text', 4, 4, 40, 9, 0, 'under'), rec('fill', 0, 0, 50, 20, 1)], { w: 200, h: 100 })[0].type).toBe('covered');
  });
  it('checks toasts (the float layer): on screen, inside their plate, over no HUD text; tooltips are free', () => {
    const fl = (r: AuditRec): AuditRec => ({ ...r, layer: 'float' });
    const tip = (r: AuditRec): AuditRec => ({ ...r, layer: 'tip' });
    // a toast at rest on the right, over nothing: clean
    expect(findIssues([rec('panel', 0, 0, 60, 20, 0), rec('text', 4, 4, 40, 9, 1, 'hud'), fl(rec('panel', 120, 30, 70, 20, 2)), fl(rec('text', 124, 34, 50, 9, 3, 'toast'))], { w: 200, h: 100 })).toEqual([]);
    // running past the right edge
    expect(findIssues([fl(rec('panel', 150, 30, 70, 20, 0)), fl(rec('text', 154, 34, 40, 9, 1, 'toast'))], { w: 200, h: 100 }).map((i) => i.type)).toContain('offscreen');
    // over the HUD's text
    expect(findIssues([rec('text', 124, 34, 40, 9, 0, 'hud'), fl(rec('panel', 120, 30, 70, 20, 1)), fl(rec('text', 124, 40, 50, 9, 2, 'toast'))], { w: 200, h: 100 }).map((i) => i.type)).toContain('covered');
    // a tooltip may do all of that
    expect(findIssues([rec('text', 124, 34, 40, 9, 0, 'hud'), tip(rec('panel', 150, 30, 70, 20, 1)), tip(rec('text', 124, 34, 50, 9, 2, 'tip'))], { w: 200, h: 100 })).toEqual([]);
  });
});
