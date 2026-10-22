// Rich text (docs/hud-180.md, "Rich text"): one markup for every string a player reads.
//
//   {i:ironOre}   an 8x8 item icon          {u:research}  an 8x8 UI icon (ui_icons_small names)
//   {k:T}         a keycap                   {k:LMB} {k:RMB} {k:WHEEL}  the mouse
//   {coin:25}     a coin chip                {coin}        the coin alone
//   {good:..} {bad:..} {warn:..} {coinc:..} {research:..} {power:..} {reset:..} {soft:..}  ink spans
//   {big:..}      a span in the display face (Bullfrog)
//   {chip:bad:CHOKED}  a status chip inline (role, then its words; an extension for report rows);
//                 a status chip's words (WORKING, STARVED, BLOCKED, NO POWER, IDLE...) carry their
//                 pip's shape at its left (Milestone 13, colourblind-safe pips: src/render/pips.ts)
//   {pip:starved} a status pip's shape inline (work starved blocked paused power idle)
//   {k:=X}        a keycap drawn as written; {k:X} names the default key of an action and draws
//                 as the key that action is bound to now (setKeyAliases, from the Keys page)
//
// No nesting. Plain strings (no '{') lay out and draw exactly as `wrapText` + `ui.text`. Unknown
// tokens degrade to text: `{foo:bar}` draws "bar", `{i:nope}` draws "nope", an unclosed '{'
// draws as written. Icons, keycaps and coins never split from the word after them. Strings are
// parsed once and cached; layouts are cached per width. src/ui stays free of src/app: icons are
// drawn through the registry chrome.ts fills in (`setRichIcons`).
import { textWidth, wrapText, LINE_H, FONT_H, bigWidth, BIG_H, BIG_LINE_H, drawText } from './font';
import { T, roleInk, roleFloor, type Role } from './theme';
import { keycapRaw, keycapWidth, KEY_H, coinRaw, COIN_W, chipRaw, chipText, outlinedText } from './paper';
import type { UI } from './ui';
import { drawPipShape, PIP_MEANING, type PipShape } from '../render/pips';

// ---------------------------------------------------------------- the icon registry

export interface RichIconSet {
  /** is this a name the set can draw? (unknown names degrade to text) */
  has(name: string): boolean;
  /** draw the 8x8 icon with its top-left at (x, y) */
  draw(ctx: CanvasRenderingContext2D, name: string, x: number, y: number): void;
}
export interface RichIcons { item?: RichIconSet; ui?: RichIconSet }

let icons: RichIcons = {};

/** Hand rich text its icon drawers (chrome.ts does, at load). Clears the caches. */
export function setRichIcons(r: RichIcons) {
  icons = r;
  parsed.clear();
  layouts.clear();
}

// ---------------------------------------------------------------- parsing

/** A text span's ink: a role, or null for the caller's colour. */
type Ink = Role | null;

export type RichAtom =
  | { t: 'word'; s: string; ink: Ink; big: boolean }
  | { t: 'space'; ink: Ink; big: boolean }
  | { t: 'nl' }
  | { t: 'item'; id: string }
  | { t: 'ui'; name: string }
  | { t: 'key'; k: string }
  | { t: 'coin'; n: string | null }
  | { t: 'chip'; role: Role; s: string }
  | { t: 'pip'; shape: PipShape };

const SPANS: Record<string, Role> = {
  good: 'good', bad: 'bad', warn: 'warn', coinc: 'coin', research: 'research', power: 'power', reset: 'reset', soft: 'soft', ink: 'ink',
};
const CHIP_ROLES = new Set<string>(['ink', 'soft', 'good', 'bad', 'warn', 'coin', 'research', 'power', 'reset']);

const parsed = new Map<string, RichAtom[]>();
const CACHE_MAX = 4000;

// ---------------------------------------------------------------- keycaps follow the bindings

/** default key label -> the label of the key bound now (only the keys a player has moved) */
let keyAlias = new Map<string, string>();

/** Say which keycaps now draw as another key (the Keys page rebinds: src/app/keys.ts). Clears the
 * caches, since keycaps change width. */
export function setKeyAliases(m: Map<string, string>) {
  keyAlias = m;
  parsed.clear();
  layouts.clear();
}

// ---------------------------------------------------------------- status chips carry their pip

const PIP_SHAPES = new Set<string>(PIP_MEANING.map((p) => p[0]));
/** a status chip's first words -> its pip's shape (the floor pip it stands for) */
const CHIP_PIP: [RegExp, PipShape][] = [
  [/^(WORKING|MAKING|BURNING|PUSHING|TAKING)\b/, 'work'],
  [/^(STARVED|WAITING|EMPTY|SHORT|NO FUEL|NO ITEM|NOT ALL ARRIVING)\b/, 'starved'],
  [/^(BLOCKED|FULL|CHOKED)\b/, 'blocked'],
  [/^(NO POWER|BROWNOUT)\b/, 'power'],
  [/^STOPPED\b/, 'paused'],
  [/^(IDLE|STANDBY|UNLINKED)\b/, 'idle'],
];
/** The pip shape a status chip's words carry, or null for other chips. */
export function chipPip(s: string): PipShape | null {
  for (const [re, sh] of CHIP_PIP) if (re.test(s)) return sh;
  return null;
}
/** px a chip's pip takes before its words */
const CHIP_PIP_W = 8;
/** the colour a shape is drawn in (a brownout's bolt is amber, as on the floor) */
const pipCol = (sh: PipShape, s = '') => (s.startsWith('BROWNOUT') ? PIP_MEANING[1][2] : PIP_MEANING.find((p) => p[0] === sh)![2]);

/** Does this string carry markup? (Plain strings take the old path, untouched.) */
export const isRich = (s: string) => s.indexOf('{') >= 0;

function pushText(out: RichAtom[], s: string, ink: Ink, big: boolean) {
  const parts = s.split('\n');
  parts.forEach((p, pi) => {
    if (pi > 0) out.push({ t: 'nl' });
    let i = 0;
    while (i < p.length) {
      if (p[i] === ' ') { out.push({ t: 'space', ink, big }); i++; continue; }
      let j = i;
      while (j < p.length && p[j] !== ' ') j++;
      out.push({ t: 'word', s: p.slice(i, j), ink, big });
      i = j;
    }
  });
}

/** Parse a string into atoms (cached). */
export function parseRich(s: string): RichAtom[] {
  const hit = parsed.get(s);
  if (hit) return hit;
  const out: RichAtom[] = [];
  let i = 0, text = '';
  const flush = () => { if (text) { pushText(out, text, null, false); text = ''; } };
  while (i < s.length) {
    const ch = s[i];
    if (ch !== '{') { text += ch; i++; continue; }
    const end = s.indexOf('}', i + 1);
    const m = end > 0 ? /^([a-z]+)(?::([\s\S]*))?$/.exec(s.slice(i + 1, end)) : null;
    if (!m) { text += ch; i++; continue; }
    const name = m[1], arg = m[2];
    flush();
    i = end + 1;
    if (name === 'i' && arg !== undefined) {
      if (!icons.item || icons.item.has(arg)) out.push({ t: 'item', id: arg });
      else pushText(out, arg, null, false);
    } else if (name === 'u' && arg !== undefined) {
      if (!icons.ui || icons.ui.has(arg)) out.push({ t: 'ui', name: arg });
      else pushText(out, arg, null, false);
    } else if (name === 'k' && arg) out.push({ t: 'key', k: arg.length > 1 && arg[0] === '=' ? arg.slice(1) : keyAlias.get(arg) ?? arg });
    else if (name === 'pip' && arg && PIP_SHAPES.has(arg)) out.push({ t: 'pip', shape: arg as PipShape });
    else if (name === 'coin') out.push({ t: 'coin', n: arg ? arg : null });
    else if (name === 'big' && arg !== undefined) pushText(out, arg, null, true);
    else if (name === 'chip' && arg !== undefined) {
      const c = arg.indexOf(':');
      const role = c > 0 ? arg.slice(0, c) : '';
      if (CHIP_ROLES.has(role)) out.push({ t: 'chip', role: role as Role, s: arg.slice(c + 1) });
      else pushText(out, arg, null, false);
    } else if (SPANS[name] && arg !== undefined) pushText(out, arg, SPANS[name], false);
    else if (arg !== undefined) pushText(out, arg, null, false);
    else pushText(out, '{' + name + '}', null, false);
  }
  flush();
  if (parsed.size > CACHE_MAX) parsed.clear();
  parsed.set(s, out);
  return out;
}

// ---------------------------------------------------------------- measuring

/** The body face's cap height (glyph cells carry 2 px of descender under the cap). */
export const CAP_H = FONT_H - 2;
/** The display face's cap height. */
export const BIG_CAP_H = BIG_H - 2;
/** An inline chip's height (and a status chip's, see chrome.chip). */
export const CHIP_H = FONT_H + 3;
/** Pixels between a chip's line and its text. */
const CHIP_PAD = 4;

/** Atoms that glue to the word after them (and get a pixel more room either side). */
const glyphLike = (a: RichAtom) => a.t === 'item' || a.t === 'ui' || a.t === 'key' || a.t === 'coin' || a.t === 'chip' || a.t === 'pip';

function atomWidth(a: RichAtom): number {
  switch (a.t) {
    case 'word': return a.big ? bigWidth(a.s) : textWidth(a.s);
    case 'space': return a.big ? bigWidth(' ') : textWidth(' ');
    case 'item': case 'ui': return 8;
    case 'key': return keycapWidth(a.k);
    case 'coin': return a.n === null ? COIN_W : COIN_W + 2 + textWidth(a.n);
    case 'chip': return chipWidthOf(a.s);
    case 'pip': return 7;
    default: return 0;
  }
}

/** A chip's width for its words (they may carry icons). */
export function chipWidthOf(s: string): number {
  return richWidth(s) + CHIP_PAD * 2 + (chipPip(s) ? CHIP_PIP_W : 0);
}

/** The gap between two atoms on a line: 1 px (the font's own letter gap), 2 beside an icon. */
const gap = (a: RichAtom, b: RichAtom) => 1 + (glyphLike(a) ? 1 : 0) + (glyphLike(b) ? 1 : 0);

// ---------------------------------------------------------------- layout

export type RichItem =
  | { t: 'text'; s: string; x: number; dy: number; w: number; ink: Ink; big: boolean }
  | { t: 'item' | 'ui'; name: string; x: number; dy: number; w: number }
  | { t: 'key'; k: string; x: number; dy: number; w: number }
  | { t: 'coin'; n: string | null; x: number; dy: number; w: number }
  | { t: 'chip'; role: Role; s: string; x: number; dy: number; w: number }
  | { t: 'pip'; shape: PipShape; x: number; dy: number; w: number };

/** One laid-out line: its top `y` from the block's top, height, width and items (x from its left). */
export interface RichLine { y: number; h: number; w: number; items: RichItem[]; /** the line as markup */ src: string }
export interface RichLayout { lines: RichLine[]; w: number; h: number }

const layouts = new Map<string, RichLayout>();

/** Lay out a string in lines no wider than `maxW` (Infinity: no wrapping), with `lineH` between
 * plain lines (default LINE_H; a line with display text is BIG_LINE_H). Cached. */
export function layoutRich(s: string, maxW = Infinity, lineH = LINE_H): RichLayout {
  const key = s + '\u0000' + maxW + '\u0000' + lineH;
  const hit = layouts.get(key);
  if (hit) return hit;
  let out: RichLayout;
  if (!isRich(s)) {
    // the plain path: exactly wrapText's lines, drawn as ui.para would
    const ls = Number.isFinite(maxW) ? wrapText(s, maxW) : s.split('\n');
    const lines = ls.map((l, i) => ({ y: i * lineH, h: lineH, w: textWidth(l), src: l, items: l ? [{ t: 'text' as const, s: l, x: 0, dy: 0, w: textWidth(l), ink: null, big: false }] : [] }));
    out = { lines, w: Math.max(0, ...lines.map((l) => l.w)), h: lines.length * lineH };
  } else out = layoutAtoms(parseRich(s), maxW, lineH);
  if (layouts.size > CACHE_MAX) layouts.clear();
  layouts.set(key, out);
  return out;
}

/** Words: runs of atoms with no break inside (a glyph-like atom keeps the space after it). */
interface Unit { atoms: RichAtom[]; lead: RichAtom[]; nl: boolean }

function units(atoms: RichAtom[]): Unit[] {
  const out: Unit[] = [];
  let cur: Unit = { atoms: [], lead: [], nl: false };
  let pendingSpaces: RichAtom[] = [];
  const close = () => { if (cur.atoms.length) out.push(cur); cur = { atoms: [], lead: [], nl: false }; };
  for (let i = 0; i < atoms.length; i++) {
    const a = atoms[i];
    if (a.t === 'nl') {
      close();
      out.push({ atoms: [], lead: [], nl: true });
      pendingSpaces = [];
      continue;
    }
    if (a.t === 'space') {
      const prev = cur.atoms[cur.atoms.length - 1];
      // a space right after an icon or keycap does not break: it is part of the word
      if (prev && glyphLike(prev) && !pendingSpaces.length) { cur.atoms.push(a); continue; }
      if (cur.atoms.length) close();
      pendingSpaces.push(a);
      continue;
    }
    if (!cur.atoms.length) { cur.lead = pendingSpaces; pendingSpaces = []; }
    cur.atoms.push(a);
  }
  close();
  return out;
}

function layoutAtoms(atoms: RichAtom[], maxW: number, lineH: number): RichLayout {
  const lines: { atoms: RichAtom[]; xs: number[]; w: number }[] = [];
  let line: { atoms: RichAtom[]; xs: number[]; w: number } = { atoms: [], xs: [], w: 0 };
  const widthWith = (l: typeof line, add: RichAtom[]) => {
    let w = l.w, last = l.atoms[l.atoms.length - 1];
    for (const a of add) { w += (last ? gap(last, a) : 0) + atomWidth(a); last = a; }
    return w;
  };
  const place = (l: typeof line, add: RichAtom[]) => {
    let last = l.atoms[l.atoms.length - 1];
    for (const a of add) {
      const x = l.w + (last ? gap(last, a) : 0);
      l.atoms.push(a); l.xs.push(x); l.w = x + atomWidth(a); last = a;
    }
  };
  for (const u of units(atoms)) {
    if (u.nl) { lines.push(line); line = { atoms: [], xs: [], w: 0 }; continue; }
    const withLead = [...u.lead, ...u.atoms];
    if (line.atoms.length && widthWith(line, withLead) > maxW) {
      lines.push(line);
      line = { atoms: [], xs: [], w: 0 };
      place(line, u.atoms);
    } else place(line, withLead);
  }
  lines.push(line);
  // trailing spaces never count toward a line's width
  for (const l of lines) {
    while (l.atoms.length && l.atoms[l.atoms.length - 1].t === 'space') { l.atoms.pop(); l.xs.pop(); }
    l.w = l.atoms.length ? l.xs[l.xs.length - 1] + atomWidth(l.atoms[l.atoms.length - 1]) : 0;
  }
  const out: RichLine[] = [];
  let y = 0;
  for (const l of lines) {
    const big = l.atoms.some((a) => (a.t === 'word' || a.t === 'space') && a.big);
    const h = big ? Math.max(lineH, BIG_LINE_H) : lineH;
    // body text sits on the display face's baseline when they share a line
    const bodyDy = big ? BIG_CAP_H - CAP_H : 0;
    const items: RichItem[] = [];
    for (let i = 0; i < l.atoms.length; i++) {
      const a = l.atoms[i], x = l.xs[i];
      if (a.t === 'word' || a.t === 'space') {
        const s = a.t === 'word' ? a.s : ' ';
        const prev = items[items.length - 1];
        // merge text of one ink and face into one run (one draw, one audit record)
        if (prev && prev.t === 'text' && prev.ink === a.ink && prev.big === a.big && i > 0 && (l.atoms[i - 1].t === 'word' || l.atoms[i - 1].t === 'space')) {
          prev.s += s;
          prev.w = x + atomWidth(a) - prev.x;
          continue;
        }
        items.push({ t: 'text', s, x, dy: a.big ? 0 : bodyDy, w: atomWidth(a), ink: a.ink, big: a.big });
        continue;
      }
      const dy = bodyDy - 1;
      if (a.t === 'item') items.push({ t: 'item', name: a.id, x, dy, w: 8 });
      else if (a.t === 'ui') items.push({ t: 'ui', name: a.name, x, dy, w: 8 });
      else if (a.t === 'key') items.push({ t: 'key', k: a.k, x, dy, w: atomWidth(a) });
      else if (a.t === 'coin') items.push({ t: 'coin', n: a.n, x, dy: bodyDy, w: atomWidth(a) });
      else if (a.t === 'chip') items.push({ t: 'chip', role: a.role, s: a.s, x, dy: bodyDy - 2, w: atomWidth(a) });
      else if (a.t === 'pip') items.push({ t: 'pip', shape: a.shape, x, dy, w: 7 });
    }
    // a run that ends in spaces (before an icon) keeps its width honest
    for (const it of items) if (it.t === 'text') it.w = it.big ? bigWidth(it.s) : textWidth(it.s);
    out.push({ y, h, w: l.w, items, src: serialize(l.atoms) });
    y += h;
  }
  return { lines: out, w: Math.max(0, ...out.map((l) => l.w)), h: y };
}

/** Width of a string on one line (the widest of its '\n' lines). Plain strings: textWidth. */
export function richWidth(s: string): number {
  if (!isRich(s)) return textWidth(s);
  return layoutRich(s).w;
}

/** The height a string takes wrapped to `maxW`. */
export function richHeight(s: string, maxW = Infinity, lineH = LINE_H): number {
  return layoutRich(s, maxW, lineH).h;
}

/** Wrap to `maxW`: each line as its own markup string (plain strings: exactly wrapText). */
export function wrapRich(s: string, maxW: number): string[] {
  if (!isRich(s)) return wrapText(s, maxW);
  return layoutRich(s, maxW).lines.map((l) => l.src);
}

const INK_TAG: Record<Role, string> = { ink: 'ink', soft: 'soft', good: 'good', bad: 'bad', warn: 'warn', coin: 'coinc', research: 'research', power: 'power', reset: 'reset' };

/** Atoms back to markup: text of one ink or face as one span, tokens as written. */
function serialize(atoms: RichAtom[]): string {
  let s = '';
  let run = '', runInk: Ink = null, runBig = false;
  const flush = () => {
    if (!run) return;
    s += runBig ? `{big:${run}}` : runInk ? `{${INK_TAG[runInk]}:${run}}` : run;
    run = '';
  };
  for (const a of atoms) {
    if (a.t === 'word' || a.t === 'space') {
      if (run && (a.ink !== runInk || a.big !== runBig)) flush();
      runInk = a.ink; runBig = a.big;
      run += a.t === 'word' ? a.s : ' ';
      continue;
    }
    flush();
    if (a.t === 'item') s += `{i:${a.id}}`;
    else if (a.t === 'ui') s += `{u:${a.name}}`;
    else if (a.t === 'key') s += `{k:${a.k}}`;
    else if (a.t === 'coin') s += a.n === null ? '{coin}' : `{coin:${a.n}}`;
    else if (a.t === 'chip') s += `{chip:${a.role}:${a.s}}`;
    else if (a.t === 'pip') s += `{pip:${a.shape}}`;
  }
  flush();
  return s;
}

// ---------------------------------------------------------------- drawing

export interface RichOpts {
  align?: 'left' | 'center' | 'right';
  /** a 1 px drop shadow under text runs */
  shadow?: string;
  /** light text over the floor: an ink outline round every run, and roles in their floor colours */
  floor?: boolean;
  lineH?: number;
}

/** Draw rich text at (x, y) wrapped to `maxW`, in `color` (default T.ink) where no span says
 * otherwise. Each run (text of one ink, an icon, a keycap, a coin, a chip) is one record for the
 * overlap audit. Returns the height used. */
export function drawRich(ui: UI, s: string, x: number, y: number, maxW = Infinity, color: string = T.ink, o: RichOpts = {}): number {
  const L = layoutRich(s, maxW, o.lineH ?? LINE_H);
  drawLayout(ui, L, x, y, color, o);
  return L.h;
}

/** Draw a layout made by layoutRich (callers that need the line boxes first). */
export function drawLayout(ui: UI, L: RichLayout, x: number, y: number, color: string = T.ink, o: RichOpts = {}) {
  const ctx = ui.ctx;
  x = Math.round(x); y = Math.round(y);
  const boxW = L.w;
  for (const line of L.lines) {
    const lx = o.align === 'center' ? x - Math.floor(line.w / 2) : o.align === 'right' ? x - line.w : x;
    const ly = y + line.y;
    for (const it of line.items) {
      const ix = lx + it.x, iy = ly + it.dy;
      switch (it.t) {
        case 'text': {
          if (!it.s.trim()) break;
          const col = it.ink ? (o.floor ? roleFloor(it.ink) : roleInk(it.ink)) : color;
          if (o.floor) {
            ui.record('text', ix, iy, it.w, it.big ? BIG_H : FONT_H, it.s);
            outlinedText(ctx, it.s, ix, iy, col, T.floorOutline, 1, it.big);
          } else if (it.big) ui.big(it.s, ix, iy, col, { shadow: o.shadow });
          else ui.text(it.s, ix, iy, col, { shadow: o.shadow });
          break;
        }
        case 'item': case 'ui': {
          const set = it.t === 'item' ? icons.item : icons.ui;
          ui.record('text', ix, iy, 8, 8, `{${it.t === 'item' ? 'i' : 'u'}:${it.name}}`);
          if (set) set.draw(ctx, it.name, ix, iy);
          break;
        }
        case 'key':
          ui.record('text', ix, iy, it.w, KEY_H, `{k:${it.k}}`);
          keycapRaw(ctx, it.k, ix, iy);
          break;
        case 'coin':
          ui.record('text', ix, iy, it.w, FONT_H, it.n === null ? '{coin}' : `{coin:${it.n}}`);
          coinRaw(ctx, ix, iy);
          if (it.n !== null) {
            if (o.floor) outlinedText(ctx, it.n, ix + COIN_W + 2, iy, T.floorCoin);
            else drawText(ctx, it.n, ix + COIN_W + 2, iy, T.coin);
          }
          break;
        case 'chip': {
          ui.record('text', ix, iy, it.w, CHIP_H, `{chip:${it.role}:${it.s}}`);
          chipRaw(ctx, ix, iy, it.w, CHIP_H, it.role, false);
          const sh = chipPip(it.s);
          if (sh) drawPipShape(ctx, ix + CHIP_PAD, iy + 3, sh, pipCol(sh, it.s));
          drawRichRaw(ui, it.s, ix + CHIP_PAD + (sh ? CHIP_PIP_W : 0), iy + 2, chipText(it.role, false));
          break;
        }
        case 'pip':
          ui.record('text', ix, iy, 7, 7, `{pip:${it.shape}}`);
          drawPipShape(ctx, ix + 1, iy + 1, it.shape, pipCol(it.shape));
          break;
      }
    }
  }
  return boxW;
}

/** Rich text drawn with no audit records (inside a chip, which recorded itself). */
function drawRichRaw(ui: UI, s: string, x: number, y: number, color: string) {
  const prev = ui.audit;
  ui.audit = false;
  try { drawRich(ui, s, x, y, Infinity, color); } finally { ui.audit = prev; }
}
