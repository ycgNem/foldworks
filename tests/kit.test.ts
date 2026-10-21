// The 180's UI kit (docs/hud-180.md): the colour roles' contrast on paper, and rich text's
// parsing, measuring, wrapping, plain-string passthrough and graceful degradation.
import { describe, expect, it, beforeEach } from 'vitest';
import { PALETTE, C } from '../src/data/palette';
import { T, contrast, onPaper, accentRole } from '../src/ui/theme';
import { parseRich, richWidth, wrapRich, layoutRich, setRichIcons, drawRich, isRich } from '../src/ui/rich';
import { textWidth, wrapText, LINE_H, BIG_LINE_H } from '../src/ui/font';
import { keycapWidth, COIN_W } from '../src/ui/paper';
import type { UI } from '../src/ui/ui';

const ITEMS = new Set(['ironOre', 'ironIngot', 'slag', 'gear']);
const UIS = new Set(['research', 'power', 'coin']);
const noop = () => {};
beforeEach(() => {
  setRichIcons({ item: { has: (n) => ITEMS.has(n), draw: noop }, ui: { has: (n) => UIS.has(n), draw: noop } });
});

describe('colour roles', () => {
  it('are palette B colours', () => {
    const pal = new Set<string>(PALETTE);
    for (const [k, v] of Object.entries(T)) expect(pal.has(v), `T.${k} ${v}`).toBe(true);
  });
  it('ink and inkSoft read at 7:1 on paper, every accent ink at 4.4:1', () => {
    expect(contrast(T.ink, T.paper)).toBeGreaterThanOrEqual(7);
    expect(contrast(T.inkSoft, T.paper)).toBeGreaterThanOrEqual(7);
    for (const k of ['good', 'bad', 'warn', 'coin', 'research', 'power', 'reset'] as const) expect(contrast(T[k], T.paper), k).toBeGreaterThanOrEqual(4.4);
    // and on the lit paper of chips and keycaps
    for (const k of ['ink', 'inkSoft', 'good', 'bad', 'warn', 'coin', 'research', 'power', 'reset'] as const) expect(contrast(T[k], T.paperHi), k).toBeGreaterThanOrEqual(4.4);
  });
  it('maps the old light colours to their ink on paper', () => {
    expect(onPaper(C.bone)).toBe(T.ink);
    expect(onPaper(C.gold)).toBe(T.coin);
    expect(onPaper(C.teal1)).toBe(T.research);
    expect(onPaper(C.violet)).toBe(T.reset);
    expect(onPaper(T.bad)).toBe(T.bad);
    expect(onPaper(undefined)).toBe(T.ink);
    expect(accentRole(C.leaf)).toBe('good');
  });
});

describe('rich text', () => {
  it('parses icons, keys, coins, spans and the display face', () => {
    const a = parseRich("She's choking! {k:LMB} shovel, or a {i:slag} Heap {coin:25}");
    expect(a.filter((x) => x.t === 'key')).toEqual([{ t: 'key', k: 'LMB' }]);
    expect(a.filter((x) => x.t === 'item')).toEqual([{ t: 'item', id: 'slag' }]);
    expect(a.filter((x) => x.t === 'coin')).toEqual([{ t: 'coin', n: '25' }]);
    expect(parseRich('{coin}')).toEqual([{ t: 'coin', n: null }]);
    expect(parseRich('{bad:CHOKED}')).toEqual([{ t: 'word', s: 'CHOKED', ink: 'bad', big: false }]);
    expect(parseRich('{coinc:+5}')[0]).toMatchObject({ ink: 'coin' });
    expect(parseRich('{big:Hi there}').filter((x) => x.t === 'word').every((x) => x.t === 'word' && x.big)).toBe(true);
    expect(parseRich('{u:research}')).toEqual([{ t: 'ui', name: 'research' }]);
    expect(parseRich('{chip:bad:NO WAY}')).toEqual([{ t: 'chip', role: 'bad', s: 'NO WAY' }]);
    // parsed once: the same array comes back
    expect(parseRich('{i:gear} 30/min')).toBe(parseRich('{i:gear} 30/min'));
  });

  it('degrades unknown tokens to text', () => {
    const words = (s: string) => parseRich(s).filter((x) => x.t === 'word').map((x) => (x.t === 'word' ? x.s : ''));
    expect(words('{foo:bar}')).toEqual(['bar']);
    expect(words('{i:nope}')).toEqual(['nope']);
    expect(words('{u:nope}')).toEqual(['nope']);
    expect(words('{chip:nope:X}')).toEqual(['nope:X']);
    expect(words('{foo}')).toEqual(['{foo}']);
    expect(words('a {unclosed')).toEqual(['a', '{unclosed']);
    expect(words('{Caps:x}')).toEqual(['{Caps:x}']);
  });

  it('measures plain strings exactly as textWidth, rich ones atom by atom', () => {
    for (const s of ['Hand Furnace', 'Coin 20/20', '', '1,234/min']) expect(richWidth(s)).toBe(textWidth(s));
    // an icon is 8 wide with 2 px either side of it; a coin chip the coin, 2 px, its number
    expect(richWidth('{i:gear}')).toBe(8);
    expect(richWidth('{i:gear}x')).toBe(8 + 2 + textWidth('x'));
    expect(richWidth('{coin:25}')).toBe(COIN_W + 2 + textWidth('25'));
    expect(richWidth('{k:T}')).toBe(keycapWidth('T'));
    // colour spans cost nothing: the same width as the plain words
    expect(richWidth('{good:a b} c')).toBe(textWidth('a b c'));
  });

  it('passes plain strings through wrapText and the old line height', () => {
    const s = 'The furnace is choked with slag! Click it to shovel, or build a Slag Heap beside it.';
    expect(isRich(s)).toBe(false);
    expect(wrapRich(s, 90)).toEqual(wrapText(s, 90));
    expect(layoutRich(s, 90).h).toBe(wrapText(s, 90).length * LINE_H);
  });

  it('wraps to the width and never splits an icon or keycap from the word after it', () => {
    const s = 'A whole line in one tile? Show me! {k:F} fold, then {k:LMB} place it {i:gear} near the Dock';
    for (const w of [50, 60, 80, 96, 140, 400]) {
      const L = layoutRich(s, w);
      for (const l of L.lines) {
        const units = l.items.length;
        expect(l.w <= w || units === 1 || l.src.split(' ').filter(Boolean).length <= 2, `line "${l.src}" at ${w}`).toBe(true);
      }
      const lines = wrapRich(s, w);
      for (const l of lines) {
        // a keycap or icon is never the last thing on a line
        expect(/\{(k|i):[^}]*\}\s*$/.test(l), `"${l}" ends in a glyph at ${w}`).toBe(false);
      }
      // nothing lost: the words come back in order
      const words = lines.join(' ').replace(/\{[a-z]+:([^}]*)\}/g, '$1').split(/\s+/).filter(Boolean);
      expect(words.join(' ')).toBe(s.replace(/\{[a-z]+:([^}]*)\}/g, '$1').split(/\s+/).filter(Boolean).join(' '));
    }
  });

  it('keeps spans across a wrap and gives a display line its own height', () => {
    const lines = wrapRich('{bad:one two three four five six}', 40);
    expect(lines.length).toBeGreaterThan(1);
    for (const l of lines) expect(l.startsWith('{bad:')).toBe(true);
    expect(layoutRich('{big:Title}').h).toBe(Math.max(LINE_H, BIG_LINE_H));
    expect(layoutRich('a\nb\nc').lines.length).toBe(3);
  });

  it('draws one audit record per run', () => {
    const recs: string[] = [];
    const ctx = new Proxy({}, { get: () => noop, set: () => true }) as unknown as CanvasRenderingContext2D;
    const ui = {
      ctx, audit: true,
      text: (s: string) => { recs.push('text:' + s); return 0; },
      big: (s: string) => { recs.push('big:' + s); return 0; },
      record: (_k: string, _x: number, _y: number, _w: number, _h: number, s?: string) => { recs.push('rec:' + s); },
    } as unknown as UI;
    const h = drawRich(ui, '{i:ironOre} → {i:ironIngot}  27/min {bad:now}', 0, 0);
    expect(h).toBe(LINE_H);
    expect(recs).toEqual(['rec:{i:ironOre}', 'text: → ', 'rec:{i:ironIngot}', 'text:  27/min ', 'text:now']);
  });
});
