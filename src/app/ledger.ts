// Pieces the 180's ledger pages share (docs/hud-180.md, "Full-screen menus: the ledger book"):
// Orders, the Patent Office, the Patent Drawer, Reorganize, the offline letter and the overnight
// forecast. A cast member speaking (portrait + speech bubble with its tail at them), paper discs
// for tree nodes with the stamped tick and the red pencil circle, a Bullfrog heading over a pencil
// rule, ruled key/value rows, and the strip kept free along the overlay's right edge for the
// notebook's section tabs. Presentation only, ink on paper.
import { C, rgba } from '../data/palette';
import { BIG_H } from '../ui/font';
import { sheet, hasArt } from '../render/sprites';
import { layoutRich, drawLayout, richWidth, CHIP_H } from '../ui/rich';
import { art } from '../ui/paper';
import { T, onPaper, roleInk, type Role } from '../ui/theme';
import { bubble, chip, chipWidth, rule, portrait, stamp } from './chrome';
import type { App } from './app';
import type { Rect, UI } from '../ui/ui';

/** UI px left free along the overlay's right edge: the notebook's section tabs hang there. */
export const TAB_ROOM = 14;

/** The page's rect. `drawScreen` (screens.ts) already takes the notebook's tab strip off the
 * overlay for every screen, so this keeps the rect as it is (taking it twice left 28 px). */
export function bookArea(r: Rect): Rect {
  return { x: r.x, y: r.y, w: r.w, h: r.h };
}

/** Line height for rows that carry chips (a chip stands 2 px above the text and 3 below). */
export const ROW_H = CHIP_H + 2;

// ---------------------------------------------------------------- the cast

/** A cast member's portrait, 48 or 24 px, in a 1 px ink frame: the art (blinking now and then,
 * the cheer frames bouncing when `cheer`), Bramble's code-drawn frog, or the Committee's
 * code-drawn stand-in (`fallback`) until its art lands. */
export function castPortrait(app: App, who: string, x: number, y: number, size: 48 | 24, cheer = false, fallback?: (ui: UI, x: number, y: number, size: number) => void) {
  const ui = app.ui;
  const base = `portrait_${who}`;
  x = Math.round(x); y = Math.round(y);
  if (!hasArt(base) && who === 'bramble') return portrait(ui, who, x, y, size);
  ui.fill(x - 1, y - 1, size + 2, size + 2, C.ink);
  const ctx = ui.ctx;
  if (cheer && hasArt(base + '_cheer')) {
    const s = sheet(base + '_cheer');
    ctx.drawImage(s.frames[Math.floor(ui.time * 4) % s.frames.length], x, y, size, size);
    return;
  }
  if (size === 24 && hasArt(base + '_small')) return void ctx.drawImage(sheet(base + '_small').frames[0], x, y);
  if (hasArt(base)) {
    const s = sheet(base);
    const blink = s.frames.length > 1 && Math.floor(ui.time * 10 + who.length * 7) % 53 === 0;
    ctx.drawImage(s.frames[blink ? 1 : 0], x, y, size, size);
    return;
  }
  if (fallback) return fallback(ui, x, y, size);
  ui.fill(x, y, size, size, T.paperLo);
}

/** Height of a speech bubble holding `line` with `textW` px for the words. */
export function bubbleHeight(line: string, textW: number): number {
  return layoutRich(line, textW).h + 9;
}

export interface SpeakOpts {
  size?: 48 | 24;
  cheer?: boolean;
  /** the portrait's side of the bubble (default left) */
  side?: 'left' | 'right';
  fallback?: (ui: UI, x: number, y: number, size: number) => void;
}

/** A cast member says `line` (markup, their voice): the portrait at the left (or right) and a
 * speech bubble beside it, its tail at the portrait's mouth. `w` is the whole width. Returns the
 * height used. */
export function speak(app: App, who: string, line: string, x: number, y: number, w: number, o: SpeakOpts = {}): number {
  const size = o.size ?? 24;
  const right = o.side === 'right';
  const gap = 8;
  const bw = w - size - gap;
  const L = layoutRich(line, bw - 12);
  const bh = Math.max(L.h + 9, 17);
  const h = Math.max(size, bh);
  const px = right ? x + w - size : x;
  castPortrait(app, who, px, y, size, o.cheer, o.fallback);
  const bx = right ? x : x + size + gap;
  const by = y + (size > bh ? Math.floor((size - bh) / 2) : 0);
  const mouth = Math.min(bh - 6, Math.max(6, Math.floor(size * 0.6) - (by - y)));
  const c = bubble(app.ui, bx, by, bw, bh, { side: right ? 'right' : 'left', at: mouth });
  drawLayout(app.ui, L, c.x, c.y, T.ink);
  return h;
}

// ---------------------------------------------------------------- headings and rows

/** A heading in the display face, in a role's ink, over a pencil rule. Returns its height. */
export function heading(ui: UI, text: string, x: number, y: number, w: number, role: Role = 'ink', right?: string): number {
  ui.big(text, x, y, roleInk(role));
  if (right) {
    const rw = richWidth(right);
    drawLayout(ui, layoutRich(right), x + w - rw, y + 2, T.inkSoft);
  }
  ui.ctx.fillStyle = role === 'ink' ? rgba(T.paperEdge, 0.8) : rgba(roleInk(role), 0.7);
  ui.ctx.fillRect(Math.round(x), Math.round(y + BIG_H + 1), Math.round(w), 1);
  return BIG_H + 4;
}

/** One ruled row: `left` (markup) at x, `right` (markup) right-aligned at x + w, a faint rule
 * under it. Returns its height (ROW_H). */
export function kvRow(ui: UI, x: number, y: number, w: number, left: string, right = '', colL: string = T.inkSoft, colR: string = T.ink, ruled = true): number {
  drawLayout(ui, layoutRich(left), x, y + 2, colL);
  if (right) drawLayout(ui, layoutRich(right), x + w, y + 2, colR, { align: 'right' });
  if (ruled) rule(ui, x, y + ROW_H - 1, w);
  return ROW_H;
}

/** Chips in a row from x; returns the width used. */
export function chips(ui: UI, x: number, y: number, list: { text: string; role?: Role; solid?: boolean; tip?: string }[], gap = 3): number {
  let cx = x;
  for (const c of list) {
    const cw = chip(ui, cx, y, c.text, { role: c.role, solid: c.solid });
    if (c.tip) ui.hint(cx, y, cw, CHIP_H, c.tip, 170);
    cx += cw + gap;
  }
  return cx - x - (list.length ? gap : 0);
}

/** The width chips() would take. */
export function chipsWidth(list: { text: string; role?: Role }[], gap = 3): number {
  return list.reduce((s, c) => s + chipWidth(c.text) + gap, 0) - (list.length ? gap : 0);
}

// ---------------------------------------------------------------- discs, ticks, circles

export type DiscState = 'normal' | 'hover' | 'afford' | 'locked' | 'owned';

/** A paper disc n px across (tree nodes): an ink rim round paper; `afford` gets a gold rim,
 * `locked` dim paper, `owned` a moss-washed face, `hover` lit paper. */
export function disc(ui: UI, x: number, y: number, n: number, state: DiscState) {
  x = Math.round(x); y = Math.round(y);
  const ctx = ui.ctx;
  const r = n / 2;
  const face = state === 'locked' ? T.paperLo : state === 'hover' ? T.paperHi : state === 'owned' ? C.lily : T.paper;
  const rim = state === 'afford' ? T.brass : state === 'owned' ? T.good : null;
  for (let j = 0; j < n; j++) {
    const dy = j + 0.5 - r;
    const half = Math.round(Math.sqrt(Math.max(0, r * r - dy * dy)));
    if (half <= 0) continue;
    // shadow, the ink rim, then the face
    ctx.fillStyle = rgba(T.shadow, 0.3);
    ctx.fillRect(x + Math.round(r) - half + 1, y + j + 1, half * 2, 1);
    ctx.fillStyle = C.ink;
    ctx.fillRect(x + Math.round(r) - half, y + j, half * 2, 1);
  }
  for (let j = 1; j < n - 1; j++) {
    const dy = j + 0.5 - r;
    const half = Math.round(Math.sqrt(Math.max(0, (r - 1) * (r - 1) - dy * dy)));
    if (half <= 0) continue;
    ctx.fillStyle = rim ?? face;
    ctx.fillRect(x + Math.round(r) - half, y + j, half * 2, 1);
  }
  if (rim) {
    for (let j = 2; j < n - 2; j++) {
      const dy = j + 0.5 - r;
      const half = Math.round(Math.sqrt(Math.max(0, (r - 2) * (r - 2) - dy * dy)));
      if (half <= 0) continue;
      ctx.fillStyle = face;
      ctx.fillRect(x + Math.round(r) - half, y + j, half * 2, 1);
    }
  }
  // the lit top of the face
  ctx.fillStyle = rgba(C.bone, state === 'locked' ? 0.2 : 0.6);
  ctx.fillRect(x + Math.round(r) - Math.floor(r / 2), y + (rim ? 3 : 2), Math.floor(r), 1);
}

/** The green stamped tick (12x12 art, or inked by code) with its top-left at (x, y). */
export function tick(ui: UI, x: number, y: number) {
  x = Math.round(x); y = Math.round(y);
  const a = art('h180_tick');
  ui.record('text', x, y, 12, 12, '{tick}');
  if (a) { ui.ctx.drawImage(a.frames[0], x, y); return; }
  const ctx = ui.ctx;
  ctx.fillStyle = T.good;
  for (let i = 0; i < 4; i++) ctx.fillRect(x + 1 + i, y + 6 + i, 2, 2);
  for (let i = 0; i < 7; i++) ctx.fillRect(x + 5 + i, y + 9 - i - 1, 2, 2);
}

/** The red pencil circle (22x22 art) round a thing n px across at (x, y). */
export function pencilCircle(ui: UI, x: number, y: number, n: number) {
  const a = art('h180_circle');
  const ctx = ui.ctx;
  if (a) {
    ctx.drawImage(a.frames[0], Math.round(x + n / 2 - a.w / 2), Math.round(y + n / 2 - a.h / 2));
    return;
  }
  const r = n / 2 + 2;
  ctx.fillStyle = T.badFill;
  for (let k = 0; k < 64; k++) {
    const t = (k / 64) * Math.PI * 2;
    ctx.fillRect(Math.round(x + n / 2 + Math.cos(t) * r), Math.round(y + n / 2 + Math.sin(t) * r), 1, 1);
  }
}

/** A grade letter as a red-ink stamp centred on (cx, cy). */
export function gradeStamp(ui: UI, letter: string, cx: number, cy: number, o: { scale?: number; angle?: number } = {}) {
  stamp(ui, letter, cx, cy, { scale: o.scale ?? 1, angle: o.angle ?? -0.12 });
}

/** A struck-through line of text in red ink (the contract's "you lose"). */
export function struck(ui: UI, s: string, x: number, y: number, maxW: number, col: string = T.bad): number {
  const L = layoutRich(s, maxW);
  drawLayout(ui, L, x, y, col);
  const ctx = ui.ctx;
  ctx.fillStyle = col;
  for (const line of L.lines) {
    if (!line.w) continue;
    // a pencil stroke through the middle, wobbling a pixel
    for (let i = -1; i < line.w + 1; i++) ctx.fillRect(Math.round(x + i), Math.round(y + line.y + 3 + ((i >> 3) % 2)), 1, 1);
  }
  return L.h;
}

/** The ink a pre-180 colour plays on paper (re-exported for the pages). */
export { onPaper };
