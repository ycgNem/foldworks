// The UI kit's chrome after the 180 (docs/hud-180.md, "The kit"): ink on paper. Paper plates,
// tags on strings, speech bubbles, ribbons, the Purse's plank, the ledger book, paper buttons that
// press 1 px, keycaps, chips, meters with a target notch, the red-ink stamp. Everything is
// code-drawn (src/ui/paper.ts) and swapped for the art director's `h180_*` sheets when they load.
// The pre-180 exports keep their signatures so every screen still compiles; they draw paper now,
// and light colours meant for the old slate boxes are mapped to their ink (`onPaper`).
// Sprites are found by name, never by their pixels.
import { C, rgba } from '../data/palette';
import { ICON, smallWidth, textWidth, drawText, bigWidth } from '../ui/font';
import { sheet, hasArt, itemIcon, frameNamed, type SpriteSheet } from '../render/sprites';
import { ITEM_IDS } from '../data/items';
import type { UI, TipLine, Rect } from '../ui/ui';
import { T, onPaper, accentRole, roleInk, roleFill, type Role } from '../ui/theme';
import {
  nineRaw, paperRaw, ribbonBand, art, tagRaw, tagHole, holeToward, bubbleRaw, ribbonRaw, ribbonFor, RIBBON, signRaw, bookRaw, keycapRaw, keycapWidth,
  chipRaw, chipText, meterRaw, stampRaw, buttonRaw, pushpinRaw, stringRaw, grommetRaw, TAG_HEAD, KEY_H,
  type HoleSide, type TailSide, type RibbonColor,
} from '../ui/paper';
import { setRichIcons, drawRich, richWidth, CAP_H, BIG_CAP_H, CHIP_H } from '../ui/rich';

export { T, type Role } from '../ui/theme';
export { type HoleSide, type TailSide, type RibbonColor, KEY_H, TAG_HEAD } from '../ui/paper';
export { CHIP_H } from '../ui/rich';

/** ui_icons.png frame order (the art director's export list) */
export const UICON = {
  build: 0, research: 1, orders: 2, stats: 3, trophies: 4, options: 5, fold: 6, flow: 7, remove: 8, rotate: 9,
  factory: 10, workshop: 11, coin: 12, heart: 13, clock: 14, lock: 15, star: 16, play: 17, pause: 18, ff: 19,
  // Act II (append-only, STYLE.md)
  power: 20, heavy: 21, codex: 22, survey: 23, mega: 24, kit: 25, claim: 26, overdrive: 27, mode: 28,
  // Milestones 5 and 6 (append-only)
  patents: 29, blueprint: 30, reset: 31, overnight: 32,
  // Act III (append-only; 33 is the atlas's own 'bearings'): pixel-art/act3/ui3.py
  district: 34, chute: 35,
  // Act IV (append-only): pixel-art/act4
  world: 36, legacy: 37, relocate: 38,
  // Act V (append-only): pixel-art/act5
  kernel: 39, beyond: 40, lastFold: 41, ledger: 42,
} as const;
export type UIconName = keyof typeof UICON;

/** font glyphs standing in for the icons until the art lands */
const GLYPH: Record<UIconName, string> = {
  build: ICON.cog, research: ICON.flask, orders: ICON.crate, stats: '#', trophies: ICON.star, options: ICON.cog, fold: ICON.module,
  flow: '~', remove: ICON.cross, rotate: '@', factory: ICON.module, workshop: ICON.cog, coin: ICON.coin, heart: ICON.heart,
  clock: ICON.clock, lock: ICON.lock, star: ICON.star, play: ICON.right, pause: '|', ff: '>',
  power: ICON.bolt, heavy: ICON.cog, codex: '?', survey: ICON.flask, mega: ICON.star, kit: ICON.crate, claim: '^', overdrive: ICON.bolt, mode: '=',
  patents: ICON.star, blueprint: ICON.module, reset: '@', overnight: ICON.clock,
  district: ICON.module, chute: ICON.down,
  world: ICON.star, legacy: ICON.star, relocate: ICON.right,
  kernel: ICON.pip, beyond: ICON.up, lastFold: ICON.module, ledger: ICON.crate,
};

/** What each accent colour means (docs/ui-redesign.md): gold is coin and "you can buy this", teal
 * research, leaf orders and customers, copper heat and jams, violet Patents and resets, blue power.
 * These are the pre-180 light accents; on paper use `T` (or `onPaper(ACCENT.x)`). */
export const ACCENT = { coin: C.gold, research: C.teal1, orders: C.leaf, heat: C.copper2, reset: C.violet, power: C.pipBlue, plain: C.hull1 } as const;

/** Spacing (docs/ui-redesign.md): a 4 px grid, 4 px between cards, 6 px inside them. */
export const GAP = 4;
export const PAD = 6;

// ---------------------------------------------------------------- rich text's icons

/** The 8x8 UI icon by its atlas name (UICON names, and the atlas's own: fastforward, bearings). */
function smallIcon(ctx: CanvasRenderingContext2D, name: string, x: number, y: number) {
  if (hasArt('ui_icons_small')) {
    const s = sheet('ui_icons_small');
    const i = s.order && s.order.includes(name) ? frameNamed(s, name) : name in UICON ? UICON[name as UIconName] : -1;
    if (i >= 0 && s.frames[i]) { ctx.drawImage(s.frames[i], Math.round(x), Math.round(y)); return; }
  }
  const g = GLYPH[name as UIconName] ?? '?';
  drawText(ctx, g, Math.round(x) + 4 - Math.floor(textWidth(g) / 2), Math.round(y), name === 'coin' ? T.coin : name === 'heart' ? T.bad : T.ink);
}
const ITEMS = new Set<string>(ITEM_IDS);
setRichIcons({
  item: { has: (id) => ITEMS.has(id), draw: (ctx, id, x, y) => ctx.drawImage(itemIcon(id), Math.round(x), Math.round(y)) },
  ui: { has: (n) => n in UICON || n === 'fastforward' || n === 'bearings', draw: smallIcon },
});

// ---------------------------------------------------------------- 9-slices, plates, sections

/** Draw a 9-slice sheet's frame tiled to w x h (edges and centre repeat, never stretch). */
export function nine(ctx: CanvasRenderingContext2D, s: SpriteSheet, f: number, x: number, y: number, w: number, h: number) {
  nineRaw(ctx, s, f, x, y, w, h);
}

/** Draw a plate straight to a context (no UI bookkeeping): for tooltips and floating cards. A
 * sheet of paper now; `accent` inks a line along its top, `fill` and `a` are ignored (paper is
 * opaque). */
export function plateRaw(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, accent?: string, fill: string = C.ink, a = 0.94) {
  paperRaw(ctx, x, y, w, h);
  if (accent) { ctx.fillStyle = onPaper(accent); ctx.fillRect(x + 2, y + 1, w - 4, 1); }
}

/** A plate: the HUD's sheet of paper (a soft shadow, a lit edge, nicks on its free edges). The
 * accent inks its top line; hover lights it. `fill` and `alpha` are kept for old callers. */
export function plate(ui: UI, x: number, y: number, w: number, h: number, o: { accent?: string; blocking?: boolean; alpha?: number; hover?: boolean; kind?: 'panel' | 'button'; fill?: string } = {}) {
  x = Math.round(x); y = Math.round(y); w = Math.round(w); h = Math.round(h);
  ui.region(x, y, w, h, o.kind ?? 'panel', o.blocking ?? true);
  paperRaw(ui.ctx, x, y, w, h, { hi: o.hover });
  if (o.accent) { ui.ctx.fillStyle = onPaper(o.accent); ui.ctx.fillRect(x + 2, y + 1, w - 4, 1); }
}

/** A section inside a page: a faint well ruled with a pencil line (its accent inks the top). */
export function section(ui: UI, x: number, y: number, w: number, h: number, accent?: string) {
  x = Math.round(x); y = Math.round(y);
  ui.region(x, y, w, h, 'panel', true);
  const ctx = ui.ctx;
  ctx.fillStyle = rgba(T.paperLo, 0.4);
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = rgba(T.paperEdge, 0.55);
  ctx.fillRect(x + 1, y, w - 2, 1);
  ctx.fillRect(x + 1, y + h - 1, w - 2, 1);
  ctx.fillRect(x, y + 1, 1, h - 2);
  ctx.fillRect(x + w - 1, y + 1, 1, h - 2);
  if (accent) {
    ctx.fillStyle = onPaper(accent);
    ctx.fillRect(x + 1, y + 1, w - 2, 1);
  }
}

/** A small-caps label (Pip) in ink (its colour mapped to paper). Returns its width. */
export function label(ui: UI, s: string, x: number, y: number, col: string = T.inkSoft, align: 'left' | 'center' | 'right' = 'left'): number {
  return ui.small(s.toUpperCase(), x, y, onPaper(col, T.inkSoft), { align });
}

/** A badge dot: "something new here" on an icon button, a tab or a slot. */
export function dot(ui: UI, x: number, y: number, col: string = C.pipRed) {
  const ctx = ui.ctx;
  ctx.fillStyle = C.ink;
  ctx.fillRect(x - 1, y, 5, 3);
  ctx.fillRect(x, y - 1, 3, 5);
  ctx.fillStyle = col;
  ctx.fillRect(x, y, 3, 3);
  ctx.fillStyle = rgba(C.bone, 0.6);
  ctx.fillRect(x, y, 1, 1);
}

/** A key cap at (x, y): a little paper key with the name in Pip (`col` is kept for old callers).
 * Prefer `keycapK`, which returns its width. */
export function keycap(ui: UI, k: string, x: number, y: number, col: string = C.hull2) {
  keycapK(ui, k, x, y);
}

/** A keycap (docs/hud-180.md): `{k:T}` as a widget. LMB, RMB and WHEEL draw the mouse. Returns
 * its width; it is KEY_H tall. */
export function keycapK(ui: UI, k: string, x: number, y: number, o: { down?: boolean } = {}): number {
  const w = keycapWidth(k);
  ui.record('text', x, y, w, KEY_H, `{k:${k}}`);
  return keycapRaw(ui.ctx, k, x, y, o.down);
}

export type FrameStyle = 'wood' | 'paper' | 'inset';

/** A framed panel. 'wood' is the ledger book's cover with one page on it (full-screen menus and
 * celebration cards), 'paper' a sheet, 'inset' a well pressed into a page. */
export function frame(ui: UI, x: number, y: number, w: number, h: number, style: FrameStyle = 'wood', blocking = true) {
  x = Math.round(x); y = Math.round(y);
  if (style === 'inset') { ui.panel(x, y, w, h, 'inset', blocking); return; }
  ui.region(x, y, w, h, 'panel', blocking);
  if (style === 'paper') paperRaw(ui.ctx, x, y, w, h);
  else bookRaw(ui.ctx, x, y, w, h, null);
}

/** A card: a sheet of paper with a ribbon across its top carrying the title (the accent picks the
 * ribbon's colour). Returns the inner content origin (5 px in, the content starting under the
 * ribbon). */
export function card(ui: UI, x: number, y: number, w: number, h: number, title: string, accent: string = C.brass1, icon?: UIconName) {
  x = Math.round(x); y = Math.round(y);
  ui.region(x, y, w, h, 'panel', true);
  paperRaw(ui.ctx, x, y, w, h, { shadow: true });
  ribbon(ui, x + 2, y + 1, w - 4, title, { color: ribbonFor(accentRole(accent)), tails: 'in', icon, big: false });
  return { x: x + 5, y: y + 17, w: w - 10, h: h - 20 };
}

// ---------------------------------------------------------------- icons

/** One UI icon at (x, y). `half` draws the 16x16 icon at 8x8 via the glyph fallback when small. */
export function uiIcon(ui: UI, name: UIconName, x: number, y: number, half = 0) {
  // an icon the atlas doesn't have yet (appended names wait for the art) falls back to its glyph
  const big = hasArt('ui_icons') ? sheet('ui_icons').frames[UICON[name]] : undefined;
  const small = hasArt('ui_icons_small') ? sheet('ui_icons_small').frames[UICON[name]] : undefined;
  if (big && !half) {
    ui.ctx.drawImage(big, Math.round(x), Math.round(y));
    return;
  }
  if (half && small) {
    // the 8x8 drawings (drawn for that size, not a squeezed 16x16)
    ui.ctx.drawImage(small, Math.round(x), Math.round(y));
    return;
  }
  if (big && half) {
    ui.ctx.drawImage(big, Math.round(x), Math.round(y), 8, 8);
    return;
  }
  const g = GLYPH[name];
  if (!half) {
    // a 16x16 stand-in at the icon's size and weight (the UI legibility round: a 5 px glyph beside
    // the 16 px icons read as broken), until the art director draws the frame
    ui.ctx.drawImage(fallbackIcon(name), Math.round(x), Math.round(y));
    return;
  }
  ui.text(g, Math.round(x) + 1, Math.round(y) + 1, name === 'coin' ? T.coin : name === 'heart' ? T.bad : T.ink);
}

/** Code-drawn 16x16 pictograms for the icons appended after the atlas was drawn (Milestones 5
 * and 6), outlined in ink like the drawn ones. Each row is 16 pixels: '.' is clear, the letters
 * are palette slots (PICTO_INK). Placeholders: the art director's frames replace them. */
const PICTO: Partial<Record<UIconName, string[]>> = {
  // a certificate with a violet seal
  patents: [
    '................', '..kkkkkkkkkkk...', '..kbbbbbbbbbk...', '..kbhhhhhhhbk...', '..kbbbbbbbbbk...', '..kbhhhhhhbbk...',
    '..kbbbbbbbbbk...', '..kbhhhhhbbbk...', '..kbbbbbbkkkk...', '..kbhhhbkvvvvk..', '..kbbbbkvbvvvvk.', '..kbbbkvvvvvvvk.',
    '..kkkkkvvvvvvlk.', '......kkvvvvlkk.', '......kvlkkkvlk.', '......kkk...kkk.',
  ],
  // a blue sheet, its corner turned, a plan drawn on it
  blueprint: [
    '................', '.kkkkkkkkkk.....', '.kBBBBBBBBkk....', '.kBwBBBBBBkwk...', '.kBwBBwwwBkkkk..', '.kBwBBwBwBBBBk..',
    '.kBwBBwwwBBBBk..', '.kBwBBBBBBBwBk..', '.kBwwwwwwwwwBk..', '.kBBBBBBwBBwBk..', '.kBwwwBBwBBwBk..', '.kBwBwBBwwwwBk..',
    '.kBwwwBBBBBBBk..', '.kBBBBBBBBBBBk..', '.kkkkkkkkkkkkk..', '................',
  ],
  // two violet arrows chasing round
  reset: [
    '................', '....kkkkkk......', '..kkvvvvvvkk.k..', '.kvvkkkkkkvvkvk.', '.kvk......kvvvk.', 'kvk......kvvvvk.',
    'kvk......kkkkkk.', 'kkk.............', '.............kkk', '.kkkkkk......kvk', '.kvvvvk......kvk', '.kvvvk......kvk.',
    '.kvkvvkkkkkkvvk.', '..k.kkvvvvvvkk..', '......kkkkkk....', '................',
  ],
  // a crescent moon and two stars
  overnight: [
    '................', '......kkkk......', '....kkgggk......', '...kggggk.....k.', '..kgggGk.....kgk', '..kggGk.......k.',
    '.kgggk..........', '.kgggk..........', '.kgggk.....k....', '.kggggk...kgk...', '..kggggk...k....', '..kGggggkk...kk.',
    '...kGggggGkkkGk.', '....kkGGGGGGkk..', '......kkkkkk....', '................',
  ],
};
const PICTO_INK: Record<string, string> = {
  k: C.ink, b: C.bone, h: C.hull1, v: C.violet, l: C.slag, B: C.iron1, w: C.iron2, g: C.hot, G: C.brass1,
};

const fallbacks = new Map<UIconName, HTMLCanvasElement>();

/** The 16x16 stand-in for an icon the atlas lacks: its pictogram, or a paper disc with the glyph
 * inked on it. */
function fallbackIcon(name: UIconName): HTMLCanvasElement {
  const hit = fallbacks.get(name);
  if (hit) return hit;
  const cv = document.createElement('canvas');
  cv.width = 16;
  cv.height = 16;
  const ctx = cv.getContext('2d')!;
  const p = PICTO[name];
  if (p) {
    p.forEach((row, y) => {
      for (let x = 0; x < 16; x++) {
        const col = PICTO_INK[row[x]];
        if (!col) continue;
        ctx.fillStyle = col;
        ctx.fillRect(x, y, 1, 1);
      }
    });
  } else {
    // a paper disc the size of an icon: ink rim, a lit face, the glyph inked on it
    ctx.fillStyle = C.ink;
    ctx.fillRect(3, 0, 10, 16);
    ctx.fillRect(1, 2, 14, 12);
    ctx.fillRect(0, 3, 16, 10);
    ctx.fillStyle = T.paper;
    ctx.fillRect(3, 1, 10, 14);
    ctx.fillRect(2, 2, 12, 12);
    ctx.fillRect(1, 3, 14, 10);
    ctx.fillStyle = T.paperHi;
    ctx.fillRect(3, 1, 10, 1);
    ctx.fillStyle = T.paperLo;
    ctx.fillRect(3, 14, 10, 1);
    const g = GLYPH[name];
    const col = name === 'coin' ? T.coin : name === 'heart' ? T.bad : T.ink;
    drawText(ctx, g, 8 - Math.floor(textWidth(g) / 2), 4, col, 1);
  }
  fallbacks.set(name, cv);
  return cv;
}

// ---------------------------------------------------------------- buttons

/** A button with an optional icon; returns true when clicked. A paper button with an ink line
 * that presses down 1 px; `gold` is brass with ink text (the call to buy or to do), `active` the
 * lit green of a tool or tab that is on. The label may carry markup. */
export function button(ui: UI, id: string, x: number, y: number, w: number, h: number, label: string, opts: { icon?: UIconName; disabled?: boolean; active?: boolean; gold?: boolean; tip?: TipLine[] | string; key?: string; pulse?: boolean; big?: boolean } = {}): boolean {
  ui.mark(id, x, y, w, h);
  x = Math.round(x); y = Math.round(y);
  const hov = ui.hover(x, y, w, h) && !opts.disabled;
  const down = hov && ui.input.mouse.down[0];
  ui.region(x, y, w, h, 'button');
  const pulse = opts.pulse && Math.floor(ui.time * 2.5) % 2 === 0;
  const state = opts.disabled ? 'disabled' : down ? 'down' : hov || pulse ? 'hover' : 'up';
  const dy = buttonRaw(ui.ctx, x, y, w, h, state, opts.gold ? 'gold' : opts.active ? 'active' : 'paper');
  // the face is h - 4 tall above the lip; things sit centred on it
  const faceH = h - 4;
  let cx = x + w / 2;
  const tcol = opts.disabled ? T.inkSoft : T.ink;
  if (opts.disabled) ui.ctx.globalAlpha = 0.45;
  if (opts.icon && label) {
    uiIcon(ui, opts.icon, x + 3, y + 1 + Math.floor((faceH - 16) / 2) + dy);
    cx = x + 20 + (w - 22) / 2;
  } else if (opts.icon) {
    uiIcon(ui, opts.icon, x + Math.floor((w - 16) / 2), y + 1 + Math.floor((faceH - 16) / 2) + dy);
  }
  ui.ctx.globalAlpha = 1;
  if (label) {
    if (opts.big) ui.big(label, cx, y + 1 + Math.floor((faceH - BIG_CAP_H) / 2) + dy, tcol, { align: 'center' });
    else drawRich(ui, label, cx, y + 1 + Math.floor((faceH - CAP_H) / 2) + dy, Infinity, tcol, { align: 'center' });
  }
  if (opts.key) ui.small(opts.key, x + w - 3, y + h - 9 + dy, T.inkSoft, { align: 'right' });
  if (hov) {
    ui.hoverId = id;
    if (opts.tip) ui.tip(typeof opts.tip === 'string' ? [{ text: opts.tip }] : opts.tip);
  }
  if (hov && ui.clicked) {
    ui.eat();
    ui.sfx('click');
    return true;
  }
  return false;
}

// ---------------------------------------------------------------- bars and meters

/** A progress bar on paper: an ink-lined trough, the fill with a lit top and a glint running
 * along it. `trough` is kept for old callers. */
export function bar(ui: UI, x: number, y: number, w: number, h: number, frac: number, col: string, trough: string = C.ink) {
  meter(ui, x, y, w, h, frac, { col });
}

/** A meter (docs/hud-180.md, "bar"): an ink-lined trough with a notch at `target` (0..1; the tick
 * stands 2 px above the bar). The fill is the role's colour (or `col`). */
export function meter(ui: UI, x: number, y: number, w: number, h: number, frac: number, o: { role?: Role; col?: string; target?: number | null; glint?: boolean } = {}) {
  const col = o.col ?? roleFill(o.role ?? 'good');
  const f = Math.max(0, Math.min(1, frac));
  const fw = Math.round((w - 2) * f);
  const g = o.glint === false ? -1 : Math.floor((ui.time * 40) % (w + 20)) - 10;
  ui.record('fill', x, y, w, h);
  meterRaw(ui.ctx, x, y, w, h, f, col, o.target ?? null, g > 0 && g < fw - 2 ? g : -1);
}

/** A sparkline of the last values (bars, newest at the right) in a pencil-ruled well. */
export function sparkline(ui: UI, x: number, y: number, w: number, h: number, values: number[], col: string) {
  ui.ctx.fillStyle = rgba(T.paperLo, 0.7);
  ui.ctx.fillRect(x, y, w, h);
  ui.ctx.fillStyle = rgba(T.paperEdge, 0.5);
  ui.ctx.fillRect(x, y + h - 1, w, 1);
  if (!values.length) return;
  let max = 0;
  for (const v of values) max = Math.max(max, v);
  if (max <= 0) return;
  const n = Math.min(values.length, w - 2);
  const ink = onPaper(col);
  for (let i = 0; i < n; i++) {
    const v = values[values.length - n + i];
    const bh = Math.max(1, Math.round((v / max) * (h - 2)));
    ui.ctx.fillStyle = i === n - 1 ? T.ink : ink;
    ui.ctx.fillRect(x + w - 1 - n + i, y + h - 1 - bh, 1, bh);
  }
}

/** A little "NEW" style pill in Pip: an ink line round a fill of `col`. */
export function badge(ui: UI, x: number, y: number, text: string, col: string = C.pipRed) {
  const w = smallWidth(text.toUpperCase()) + 4;
  ui.fill(x + 1, y, w - 2, 9, C.ink);
  ui.fill(x, y + 1, w, 7, C.ink);
  ui.fill(x + 1, y + 1, w - 2, 7, col);
  ui.ctx.fillStyle = rgba(C.bone, 0.35);
  ui.ctx.fillRect(x + 1, y + 1, w - 2, 1);
  const light = col === C.gold || col === C.hot || col === C.pipYellow || col === T.brass || col === C.lamp3 || col === T.paper || col === T.paperHi;
  ui.small(text.toUpperCase(), x + 2, y + 2, light ? C.ink : C.bone);
}

/** The spinning coin (art: ui_coin, 6 frames). */
export function coinIcon(ui: UI, x: number, y: number, big = true) {
  const name = big ? 'ui_coin' : 'ui_coin_small';
  if (hasArt(name)) {
    const s = sheet(name);
    ui.ctx.drawImage(s.frames[Math.floor(ui.time * (s.fps || 10)) % s.frames.length], Math.round(x), Math.round(y));
    return;
  }
  const sz = big ? 16 : 8;
  const t = Math.abs(Math.sin(ui.time * 3));
  const w = Math.max(2, Math.round(sz * (0.35 + 0.65 * t)));
  const ox = Math.round(x + (sz - w) / 2);
  ui.fill(ox, y + 1, w, sz - 2, C.ink);
  ui.fill(ox + 1, y + 2, Math.max(1, w - 2), sz - 4, C.brass1);
  ui.fill(ox + 1, y + 2, Math.max(1, w - 2), 1, C.gold);
  if (w > 6) ui.fill(ox + Math.floor(w / 2) - 1, y + Math.floor(sz / 2) - 1, 2, 2, C.brass0);
}

/** A lily pad under a portrait (Bramble's corner): an ink-lined pad with its notch. */
export function lilyPad(ui: UI, cx: number, cy: number, w: number) {
  const ctx = ui.ctx;
  const rx = w / 2, ry = Math.max(3, Math.round(w / 8));
  for (let j = -ry; j <= ry; j++) {
    const half = Math.round(rx * Math.sqrt(Math.max(0, 1 - (j / (ry + 0.5)) ** 2)));
    const yy = Math.round(cy + j);
    ctx.fillStyle = C.ink;
    ctx.fillRect(Math.round(cx - half - 1), yy, half * 2 + 2, 1);
    ctx.fillStyle = j < -ry + 2 ? C.moss5 : j > ry - 2 ? C.moss2 : C.moss3;
    ctx.fillRect(Math.round(cx - half), yy, half * 2, 1);
  }
  ctx.fillStyle = C.ink;
  ctx.fillRect(Math.round(cx - rx - 1), Math.round(cy - ry - 1), Math.round(rx * 2 + 2), 1);
  // the notch, toward the viewer
  for (let k = 0; k < ry; k++) {
    ctx.fillStyle = k === ry - 1 ? C.ink : C.water2;
    ctx.fillRect(Math.round(cx + rx * 0.35 + k), Math.round(cy + k + 1), 2, 1);
  }
}

/** A customer portrait (art: portrait_<who>), or a code-drawn frog for Bramble. `pad` sits it on
 * a lily pad (Bramble's corner). */
export function portrait(ui: UI, who: string, x: number, y: number, size: 48 | 24, o: { pad?: boolean } = {}) {
  const name = size === 48 ? `portrait_${who}` : `portrait_${who}_small`;
  if (o.pad) {
    if (hasArt('h180_lilypad') && size === 48) {
      // the pad's sidecar says where the portrait sits on it
      const s = sheet('h180_lilypad');
      ui.ctx.drawImage(s.frames[0], x - 4, y + 42);
    } else lilyPad(ui, x + size / 2, y + size - 2, size + 14);
  }
  ui.fill(x - 1, y - 1, size + 2, size + 2, C.ink);
  if (hasArt(name)) {
    const s = sheet(name);
    const blink = s.frames.length > 1 && Math.floor(ui.time * 10) % 47 === 0;
    ui.ctx.drawImage(s.frames[blink ? 1 : 0], x, y);
    return;
  }
  // a frog in a top hat
  const k = size / 24;
  const f = (c: string, a: number, b: number, w: number, h: number) => ui.fill(x + a * k, y + b * k, w * k, h * k, c);
  f(C.moss, 0, 0, 24, 24);
  f(C.ink, 1, 9, 22, 15); f(C.leaf, 2, 10, 20, 13); f(C.hot, 6, 18, 12, 4);
  f(C.ink, 2, 6, 8, 8); f(C.ink, 14, 6, 8, 8); f(C.bone, 3, 7, 6, 6); f(C.bone, 15, 7, 6, 6);
  f(C.ink, 6, 9, 2, 2); f(C.ink, 18, 9, 2, 2);
  f(C.ink, 7, 16, 10, 1);
  f(C.ink, 8, 0, 8, 6); f(C.ink, 6, 5, 12, 2); f(C.shadow, 9, 1, 6, 4); f(C.copper1, 9, 4, 6, 1);
  f(C.pipRed, 2, 20, 20, 2);
}

// ---------------------------------------------------------------- the 180's pieces

export interface TagOpts {
  /** where its string runs to (a world point or a HUD object, UI pixels); null: no string */
  anchor?: { x: number; y: number } | null;
  /** pinned: a pushpin through its head, no string */
  pin?: boolean;
  /** its head's side (default: the side facing the anchor, else left) */
  hole?: HoleSide;
  hover?: boolean;
  blocking?: boolean;
  kind?: 'panel' | 'button';
}

/** Room a tag needs round its content: [left, top, right, bottom] for a head on `hole`. */
export function tagPad(hole: HoleSide = 'left'): [number, number, number, number] {
  return [hole === 'left' ? TAG_HEAD + 2 : 6, hole === 'top' ? TAG_HEAD + 1 : 5, hole === 'right' ? TAG_HEAD + 2 : 6, 5];
}

/** A tag's outer size for content cw x ch with its head on `hole`. */
export function tagSize(cw: number, ch: number, hole: HoleSide = 'left'): { w: number; h: number } {
  const [l, t, r, b] = tagPad(hole);
  return { w: cw + l + r, h: Math.max(ch + t + b, 17) };
}

/** A paper tag (hover reports, the wheel's info, the floor's numbers, toasts): cut corners and a
 * brass grommet on its head, a twine string to `anchor` (or a pushpin), nicks on its free edges.
 * Returns the content rect inside it. */
export function tag(ui: UI, x: number, y: number, w: number, h: number, o: TagOpts = {}): Rect {
  x = Math.round(x); y = Math.round(y); w = Math.round(w); h = Math.round(h);
  const hole = o.hole ?? (o.anchor ? holeToward(x, y, w, h, o.anchor) : 'left');
  ui.region(x, y, w, h, o.kind ?? 'panel', o.blocking ?? true);
  tagRaw(ui.ctx, x, y, w, h, { hole, anchor: o.anchor ?? null, pin: o.pin, hover: o.hover });
  const [l, t, r, b] = tagPad(hole);
  return { x: x + l, y: y + t, w: w - l - r, h: h - t - b };
}

/** A speech bubble (goals, hints, the cast's lines): its tail on `side`, `at` px along it (from
 * the left or top), 5 px long. Returns the content rect. */
export function bubble(ui: UI, x: number, y: number, w: number, h: number, o: { side?: TailSide; at?: number; blocking?: boolean } = {}): Rect {
  x = Math.round(x); y = Math.round(y);
  ui.region(x, y, w, h, 'panel', o.blocking ?? true);
  bubbleRaw(ui.ctx, x, y, w, h, o.side ?? 'bottom', o.at ?? 12);
  return { x: x + 6, y: y + 5, w: w - 12, h: h - 9 };
}

/** A ribbon's height for text in the display face (or the body face with `big: false`). */
export const RIBBON_H = BIG_CAP_H + 6;
export const RIBBON_H_SMALL = CAP_H + 5;

/** A ribbon w wide at (x, y) carrying `text` centred (display face by default): titles, trophies,
 * celebrations. tails 'out' (default) folds tails 7 px past each end; 'in' cuts forks into its
 * own ends. Returns its height. */
export function ribbon(ui: UI, x: number, y: number, w: number, text = '', o: { color?: RibbonColor; tails?: 'out' | 'in' | 'none'; h?: number; icon?: UIconName; big?: boolean; blocking?: boolean } = {}): number {
  x = Math.round(x); y = Math.round(y);
  const big = o.big ?? true;
  const h = o.h ?? (big ? RIBBON_H : RIBBON_H_SMALL);
  const color = o.color ?? 'moss';
  ui.region(x, y, w, h, 'panel', o.blocking ?? false);
  ribbonRaw(ui.ctx, x, y, w, h, color, o.tails ?? 'out');
  const P = RIBBON[color];
  let tx = x + w / 2;
  if (o.icon) {
    uiIcon(ui, o.icon, x + 4, y + Math.floor((h - 8) / 2), 1);
    tx += 5;
  }
  if (text) {
    const cap = big ? BIG_CAP_H : CAP_H;
    const ty = y + Math.floor((ribbonBand(h) - cap) / 2);
    const shadow = color === 'gold' ? undefined : P.line;
    if (big) ui.big(text, tx, ty, P.text, { align: 'center', shadow });
    else ui.text(text, tx, ty, P.text, { align: 'center', shadow });
  }
  return h;
}

/** A wooden plank on two ropes (the Purse), the ropes running up to `ropeTop`. Returns the
 * content rect on the plank. */
export function sign(ui: UI, x: number, y: number, w: number, h: number, o: { ropeTop?: number | null; blocking?: boolean } = {}): Rect {
  x = Math.round(x); y = Math.round(y);
  ui.region(x, y, w, h, 'panel', o.blocking ?? true);
  signRaw(ui.ctx, x, y, w, h, o.ropeTop === undefined ? 0 : o.ropeTop);
  return { x: x + 5, y: y + 4, w: w - 10, h: h - 8 };
}

export interface ChipOpts {
  role?: Role;
  /** the role's fill with light text (a loud status), instead of ink on lit paper */
  solid?: boolean;
  /** an 8x8 UI icon before the words */
  icon?: UIconName;
  /** an 8x8 item icon before the words */
  item?: string;
}

/** A chip's width: its words (they may carry markup) and icon, padded. */
export function chipWidth(text: string, o: ChipOpts = {}): number {
  return richWidth(text) + 8 + (o.icon || o.item ? 10 : 0);
}

/** A chip (docs/hud-180.md): a rounded pill, icon + words in the role's ink on lit paper
 * (`solid`: on the role's fill). CHIP_H tall. Returns its width. */
export function chip(ui: UI, x: number, y: number, text: string, o: ChipOpts = {}): number {
  x = Math.round(x); y = Math.round(y);
  const role = o.role ?? 'ink';
  const w = chipWidth(text, o);
  ui.region(x, y, w, CHIP_H, 'panel', false);
  chipRaw(ui.ctx, x, y, w, CHIP_H, role, o.solid);
  let tx = x + 4;
  if (o.icon) { uiIcon(ui, o.icon, tx, y + 2, 1); tx += 10; }
  else if (o.item) { ui.ctx.drawImage(itemIcon(o.item), tx, y + 2); tx += 10; }
  const col = chipText(role, !!o.solid);
  drawRich(ui, text, tx, y + 3, Infinity, col, { shadow: o.solid && col === C.bone ? C.ink : undefined });
  return w;
}

/** A red-ink rubber stamp centred on (cx, cy) (the grade, APPROVED, PAID): `scale` for the slam
 * (see slamScale), `angle` in radians. */
export function stamp(ui: UI, text: string, cx: number, cy: number, o: { col?: string; scale?: number; angle?: number; alpha?: number } = {}) {
  stampRaw(ui.ctx, text, cx, cy, o.col ?? T.badFill, Math.max(1, Math.round(o.scale ?? 1)), o.angle ?? -0.08, o.alpha ?? 0.92);
}

/** The ledger book at r: leather, brass corners, stitching, the pages (two when `spine` is a
 * screen x, one when null). Returns the page rects. */
export function book(ui: UI, r: Rect, spine: number | null = null, blocking = true): { left: Rect; right: Rect | null } {
  ui.region(r.x, r.y, r.w, r.h, 'panel', blocking);
  return bookRaw(ui.ctx, r.x, r.y, r.w, r.h, spine);
}

/** A red pushpin at (cx, cy). */
export function pushpin(ui: UI, cx: number, cy: number) {
  pushpinRaw(ui.ctx, cx, cy);
}

/** A twine string from (x0, y0) to (x1, y1), sagging (a tag's, a sign's). */
export function twine(ui: UI, x0: number, y0: number, x1: number, y1: number) {
  stringRaw(ui.ctx, x0, y0, x1, y1);
}

/** A brass grommet centred on (cx, cy). */
export function grommet(ui: UI, cx: number, cy: number) {
  grommetRaw(ui.ctx, cx, cy);
}

/** Where a tag's hole sits (for callers that run their own strings). */
export { tagHole, holeToward };

/** The role ink for an accent (re-exported for callers moving off ACCENT). */
export { onPaper, accentRole, roleInk, roleFill };

/** A ruled pencil line across a page (lists ruled with faint paperLo lines). */
export function rule(ui: UI, x: number, y: number, w: number, strong = false) {
  ui.ctx.fillStyle = strong ? rgba(T.paperEdge, 0.8) : rgba(T.paperLo, 0.9);
  ui.ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), 1);
}

/** A pencil underline under a selected row (not a highlight block). */
export function pencil(ui: UI, x: number, y: number, w: number, col: string = T.inkSoft) {
  const ctx = ui.ctx;
  ctx.fillStyle = col;
  for (let i = 0; i < w; i++) {
    const dy = Math.round(Math.sin((x + i) * 0.7) * 0.5 + (i % 9 === 0 ? 0.5 : 0));
    ctx.fillRect(Math.round(x + i), Math.round(y + dy), 1, 1);
  }
}

/** The display face's width (for laying out titles). */
export const titleWidth = (s: string) => bigWidth(s);

/** A paper slip (a toast): the art's slip, or a sheet of paper. Returns the content rect. */
export function slip(ui: UI, x: number, y: number, w: number, h: number, o: { blocking?: boolean } = {}): Rect {
  x = Math.round(x); y = Math.round(y);
  ui.region(x, y, w, h, 'panel', o.blocking ?? false);
  const a = art('h180_slip');
  if (a) nineRaw(ui.ctx, a, 0, x, y, w, h);
  else paperRaw(ui.ctx, x, y, w, h);
  return { x: x + 6, y: y + 5, w: w - 12, h: h - 10 };
}

/** The Inspector's clipboard (an audit's tag, the grade slip): a board with a steel clip at its
 * top-left and a sheet on it. Returns the content rect on the sheet. */
export function clipboard(ui: UI, x: number, y: number, w: number, h: number, o: { blocking?: boolean } = {}): Rect {
  x = Math.round(x); y = Math.round(y);
  ui.region(x, y, w, h, 'panel', o.blocking ?? true);
  const a = art('h180_clipboard');
  const ctx = ui.ctx;
  if (a) {
    nineRaw(ctx, a, 0, x, y, w, h);
    const [l, t, r, b] = a.slice ?? [10, 8, 4, 4];
    return { x: x + Math.max(5, l - 4), y: y + t + 1, w: w - Math.max(5, l - 4) - r - 2, h: h - t - b - 2 };
  }
  ctx.fillStyle = rgba(T.shadow, 0.35);
  ctx.fillRect(x + 2, y + 4, w, h - 2);
  ctx.fillStyle = C.ink;
  ctx.fillRect(x, y + 3, w, h - 3);
  ctx.fillStyle = C.wood3;
  ctx.fillRect(x + 1, y + 4, w - 2, h - 5);
  ctx.fillStyle = T.woodHi;
  ctx.fillRect(x + 1, y + 4, w - 2, 1);
  paperRaw(ctx, x + 3, y + 7, w - 6, h - 10, { shadow: false });
  // the clip
  ctx.fillStyle = C.ink;
  ctx.fillRect(x + 3, y, 12, 7);
  ctx.fillStyle = C.steel3;
  ctx.fillRect(x + 4, y + 1, 10, 5);
  ctx.fillStyle = C.steel4;
  ctx.fillRect(x + 4, y + 1, 10, 1);
  ctx.fillStyle = C.steel1;
  ctx.fillRect(x + 7, y + 3, 4, 1);
  return { x: x + 7, y: y + 10, w: w - 14, h: h - 16 };
}
