// The UI kit's chrome, in the redesign's two weights (docs/ui-redesign.md): the calm code-drawn
// plate for every HUD piece, and the ornate wood-and-brass 9-slice (the art director's ui_panel)
// only for full-screen menus and celebration cards. Buttons, cards, bars, sparklines, badges,
// counters and portraits draw from the palette's C slots, so a new palette restyles them; sprites
// are found by name, never by their pixels.
import { C, rgba } from '../data/palette';
import { ICON, smallWidth } from '../ui/font';
import { sheet, hasArt, type SpriteSheet } from '../render/sprites';
import type { UI, TipLine } from '../ui/ui';

/** ui_icons.png frame order (the art director's export list) */
export const UICON = {
  build: 0, research: 1, orders: 2, stats: 3, trophies: 4, options: 5, fold: 6, flow: 7, remove: 8, rotate: 9,
  factory: 10, workshop: 11, coin: 12, heart: 13, clock: 14, lock: 15, star: 16, play: 17, pause: 18, ff: 19,
  // Act II (append-only, STYLE.md)
  power: 20, heavy: 21, codex: 22, survey: 23, mega: 24, kit: 25, claim: 26, overdrive: 27, mode: 28,
} as const;
export type UIconName = keyof typeof UICON;

/** font glyphs standing in for the icons until the art lands */
const GLYPH: Record<UIconName, string> = {
  build: ICON.cog, research: ICON.flask, orders: ICON.crate, stats: '#', trophies: ICON.star, options: ICON.cog, fold: ICON.module,
  flow: '~', remove: ICON.cross, rotate: '@', factory: ICON.module, workshop: ICON.cog, coin: ICON.coin, heart: ICON.heart,
  clock: ICON.clock, lock: ICON.lock, star: ICON.star, play: ICON.right, pause: '|', ff: '>',
  power: ICON.bolt, heavy: ICON.cog, codex: '?', survey: ICON.flask, mega: ICON.star, kit: ICON.crate, claim: '^', overdrive: ICON.bolt, mode: '=',
};

/** What each accent colour means (docs/ui-redesign.md): gold is coin and "you can buy this", teal
 * research, leaf orders and customers, copper heat and jams, violet Patents and resets, blue power. */
export const ACCENT = { coin: C.gold, research: C.teal1, orders: C.leaf, heat: C.copper2, reset: C.violet, power: C.pipBlue, plain: C.hull1 } as const;

/** Spacing (docs/ui-redesign.md): a 4 px grid, 4 px between cards, 6 px inside them. */
export const GAP = 4;
export const PAD = 6;

/** Draw a 9-slice sheet's frame tiled to w x h (edges and centre repeat, never stretch). */
export function nine(ctx: CanvasRenderingContext2D, s: SpriteSheet, f: number, x: number, y: number, w: number, h: number) {
  const img = s.frames[Math.min(f, s.frames.length - 1)];
  const [l, t, r, b] = s.slice ?? [4, 4, 4, 4];
  const cw = s.w - l - r, ch = s.h - t - b;
  const iw = w - l - r, ih = h - t - b;
  const part = (sx: number, sy: number, sw: number, sh: number, dx: number, dy: number, dw: number, dh: number) => {
    if (dw <= 0 || dh <= 0 || sw <= 0 || sh <= 0) return;
    for (let yy = 0; yy < dh; yy += sh)
      for (let xx = 0; xx < dw; xx += sw) {
        const pw = Math.min(sw, dw - xx), ph = Math.min(sh, dh - yy);
        ctx.drawImage(img, sx, sy, pw, ph, dx + xx, dy + yy, pw, ph);
      }
  };
  part(0, 0, l, t, x, y, l, t);
  part(l, 0, cw, t, x + l, y, iw, t);
  part(s.w - r, 0, r, t, x + w - r, y, r, t);
  part(0, t, l, ch, x, y + t, l, ih);
  part(l, t, cw, ch, x + l, y + t, iw, ih);
  part(s.w - r, t, r, ch, x + w - r, y + t, r, ih);
  part(0, s.h - b, l, b, x, y + h - b, l, b);
  part(l, s.h - b, cw, b, x + l, y + h - b, iw, b);
  part(s.w - r, s.h - b, r, b, x + w - r, y + h - b, r, b);
}

/** Draw a plate straight to a context (no UI bookkeeping): for tooltips and floating cards. */
export function plateRaw(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, accent?: string, fill: string = C.ink, a = 0.94) {
  ctx.fillStyle = rgba(fill, a);
  ctx.fillRect(x + 1, y + 1, w - 2, h - 2);
  ctx.fillStyle = C.hull0;
  ctx.fillRect(x + 2, y, w - 4, 1);
  ctx.fillRect(x + 2, y + h - 1, w - 4, 1);
  ctx.fillRect(x, y + 2, 1, h - 4);
  ctx.fillRect(x + w - 1, y + 2, 1, h - 4);
  ctx.fillRect(x + 1, y + 1, 1, 1);
  ctx.fillRect(x + w - 2, y + 1, 1, 1);
  ctx.fillRect(x + 1, y + h - 2, 1, 1);
  ctx.fillRect(x + w - 2, y + h - 2, 1, 1);
  ctx.fillStyle = accent ?? rgba(C.hull1, 0.7);
  ctx.fillRect(x + 2, y + 1, w - 4, 1);
}

/** A plate: the HUD's one panel (docs/ui-redesign.md, "two weights"). Ink at 90%, a 1 px outline,
 * a 1 px lighter top edge (the accent colour when given), 2 px notched corners. No wood, no
 * rivets: calm, so the world and the numbers carry the colour. */
export function plate(ui: UI, x: number, y: number, w: number, h: number, o: { accent?: string; blocking?: boolean; alpha?: number; hover?: boolean; kind?: 'panel' | 'button'; fill?: string } = {}) {
  x = Math.round(x); y = Math.round(y); w = Math.round(w); h = Math.round(h);
  ui.region(x, y, w, h, o.kind ?? 'panel', o.blocking ?? true);
  const ctx = ui.ctx;
  const a = o.alpha ?? 0.9;
  ctx.fillStyle = rgba(o.fill ?? (o.hover ? C.shadow : C.ink), a);
  ctx.fillRect(x + 1, y + 1, w - 2, h - 2);
  // the outline, its corners notched
  ctx.fillStyle = o.hover ? C.hull1 : C.hull0;
  ctx.fillRect(x + 2, y, w - 4, 1);
  ctx.fillRect(x + 2, y + h - 1, w - 4, 1);
  ctx.fillRect(x, y + 2, 1, h - 4);
  ctx.fillRect(x + w - 1, y + 2, 1, h - 4);
  ctx.fillRect(x + 1, y + 1, 1, 1);
  ctx.fillRect(x + w - 2, y + 1, 1, 1);
  ctx.fillRect(x + 1, y + h - 2, 1, 1);
  ctx.fillRect(x + w - 2, y + h - 2, 1, 1);
  // the lighter top edge, or the accent
  ctx.fillStyle = o.accent ?? rgba(C.hull1, 0.7);
  ctx.fillRect(x + 2, y + 1, w - 4, 1);
}

/** A section inside a full-screen menu: a flat dark well with a hairline outline, lighter than the
 * ornate frame around it (menus no longer nest wood inside wood). */
export function section(ui: UI, x: number, y: number, w: number, h: number, accent?: string) {
  x = Math.round(x); y = Math.round(y);
  ui.region(x, y, w, h, 'panel', true);
  const ctx = ui.ctx;
  ctx.fillStyle = rgba(C.ink, 0.6);
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = rgba(C.hull0, 0.9);
  ctx.fillRect(x, y, w, 1);
  ctx.fillRect(x, y + h - 1, w, 1);
  ctx.fillRect(x, y, 1, h);
  ctx.fillRect(x + w - 1, y, 1, h);
  if (accent) {
    ctx.fillStyle = accent;
    ctx.fillRect(x + 1, y + 1, w - 2, 1);
  }
}

/** A small-caps label (a card's or a group's title) in its accent colour. Returns its width. */
export function label(ui: UI, s: string, x: number, y: number, col: string = C.hull2, align: 'left' | 'center' | 'right' = 'left'): number {
  return ui.small(s.toUpperCase(), x, y, col, { align, shadow: C.ink });
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

/** A key cap: the hotkey letter or number in a slot's or a button's corner. */
export function keycap(ui: UI, k: string, x: number, y: number, col: string = C.hull2) {
  const w = smallWidth(k) + 2;
  ui.ctx.fillStyle = rgba(C.ink, 0.85);
  ui.ctx.fillRect(x, y, w, 7);
  ui.small(k, x + 1, y + 1, col);
}

export type FrameStyle = 'wood' | 'paper' | 'inset';

/** A framed panel: the ornate dark wood with brass trim and rivets (or the art's 9-slice). The
 * redesign keeps it for full-screen menus and celebration cards only; HUD pieces use `plate`. */
export function frame(ui: UI, x: number, y: number, w: number, h: number, style: FrameStyle = 'wood', blocking = true) {
  x = Math.round(x); y = Math.round(y);
  ui.region(x, y, w, h, 'panel', blocking);
  const art = style === 'wood' ? 'ui_panel' : style === 'paper' ? 'ui_panel_light' : 'ui_inset';
  if (hasArt(art)) return nine(ui.ctx, sheet(art), 0, x, y, w, h);
  const f = (c: string, a: number, b: number, ww: number, hh: number) => { ui.ctx.fillStyle = c; ui.ctx.fillRect(x + a, y + b, ww, hh); };
  if (style === 'inset') {
    f(C.ink, 0, 0, w, h);
    f(C.shadow, 1, 1, w - 2, h - 2);
    f(C.ink, 1, 1, w - 2, 1);
    return;
  }
  if (style === 'paper') {
    f(C.ink, 0, 0, w, h);
    f(C.brass0, 1, 1, w - 2, h - 2);
    f(C.hull3, 2, 2, w - 4, h - 4);
    f(C.bone, 2, 2, w - 4, 1);
    return;
  }
  // wood: ink rim, brass trim, dark planks with a grain
  f(C.ink, 0, 0, w, h);
  f(C.brass0, 1, 1, w - 2, h - 2);
  f(C.brass1, 1, 1, w - 2, 1);
  f(C.ink, 2, 2, w - 4, h - 4);
  f(C.ground0, 3, 3, w - 6, h - 6);
  for (let yy = 3; yy < h - 3; yy += 6) f(rgba(C.shadow, 0.5), 3, yy + 5, w - 6, 1);
  for (let yy = 3, i = 0; yy < h - 3; yy += 6, i++) f(rgba(C.ground1, 0.35), 3 + ((i * 37) % Math.max(1, w - 30)), yy + 2, 18, 1);
  // corner rivets
  for (const [a, b] of [[3, 3], [w - 5, 3], [3, h - 5], [w - 5, h - 5]]) { f(C.brass1, a, b, 2, 2); f(C.hot, a, b, 1, 1); }
}

/** A card inside a menu: a section with its title in small capitals over an accent hairline.
 * Returns the inner content origin (5 px in, the content starting under the title). */
export function card(ui: UI, x: number, y: number, w: number, h: number, title: string, accent: string = C.brass1, icon?: UIconName) {
  section(ui, x, y, w, h);
  let tx = x + 5;
  if (icon) { uiIcon(ui, icon, x + 4, y + 3, 0.5); tx += 10; }
  label(ui, title, tx, y + 5, accent);
  ui.fill(x + 4, y + 12, w - 8, 1, accent, 0.45);
  return { x: x + 5, y: y + 17, w: w - 10, h: h - 20 };
}

/** One UI icon at (x, y). `half` draws the 16x16 icon at 8x8 via the glyph fallback when small. */
export function uiIcon(ui: UI, name: UIconName, x: number, y: number, half = 0) {
  if (hasArt('ui_icons') && !half) {
    ui.ctx.drawImage(sheet('ui_icons').frames[UICON[name]], Math.round(x), Math.round(y));
    return;
  }
  if (half && hasArt('ui_icons_small')) {
    // the 8x8 drawings (drawn for that size, not a squeezed 16x16)
    ui.ctx.drawImage(sheet('ui_icons_small').frames[UICON[name]], Math.round(x), Math.round(y));
    return;
  }
  if (hasArt('ui_icons') && half) {
    ui.ctx.drawImage(sheet('ui_icons').frames[UICON[name]], Math.round(x), Math.round(y), 8, 8);
    return;
  }
  const g = GLYPH[name];
  ui.text(g, Math.round(x) + (half ? 1 : 3), Math.round(y) + (half ? 1 : 4), name === 'coin' ? C.gold : name === 'heart' ? C.pipRed : C.bone, { shadow: C.ink });
}

/** A button with an optional icon; returns true when clicked. Code-drawn in the plate language:
 * a dark key with a lighter top edge; `gold` is the call to buy or to do (gold means coin and
 * "you can buy this"), `active` a tool or tab that is on (teal). */
export function button(ui: UI, id: string, x: number, y: number, w: number, h: number, label: string, opts: { icon?: UIconName; disabled?: boolean; active?: boolean; gold?: boolean; tip?: TipLine[] | string; key?: string; pulse?: boolean } = {}): boolean {
  ui.mark(id, x, y, w, h);
  x = Math.round(x); y = Math.round(y);
  const hov = ui.hover(x, y, w, h) && !opts.disabled;
  const down = hov && ui.input.mouse.down[0];
  ui.region(x, y, w, h, 'button');
  const pulse = opts.pulse && Math.floor(ui.time * 2.5) % 2 === 0;
  const base = opts.disabled ? C.shadow : opts.gold ? (hov || pulse ? C.gold : C.brass1) : opts.active ? C.teal0 : hov ? C.hull0 : C.shadow;
  const hi = opts.disabled ? C.shadow : opts.gold ? C.hot : opts.active ? C.teal1 : hov ? C.hull1 : C.hull0;
  ui.fill(x, y, w, h, C.ink);
  ui.fill(x + 1, y + 1, w - 2, h - 2, base);
  if (!down) {
    ui.ctx.fillStyle = hi;
    ui.ctx.fillRect(x + 1, y + 1, w - 2, 1);
    if (h > 8) { ui.ctx.fillStyle = opts.gold ? C.brass0 : rgba(C.ink, 0.6); ui.ctx.fillRect(x + 1, y + h - 2, w - 2, 1); }
  }
  const dy = down ? 1 : 0;
  let cx = x + w / 2;
  const tcol = opts.disabled ? C.hull1 : opts.gold ? C.ink : opts.active ? C.hot : C.bone;
  if (opts.disabled) ui.ctx.globalAlpha = 0.45;
  if (opts.icon && label) {
    uiIcon(ui, opts.icon, x + 3, y + Math.floor((h - 16) / 2) + dy);
    cx = x + 20 + (w - 22) / 2;
  } else if (opts.icon) {
    uiIcon(ui, opts.icon, x + Math.floor((w - 16) / 2), y + Math.floor((h - 16) / 2) + dy);
  }
  ui.ctx.globalAlpha = 1;
  if (label) ui.text(label, cx, y + Math.floor((h - 7) / 2) + dy, tcol, { align: 'center', shadow: opts.gold || opts.disabled ? undefined : C.ink });
  if (opts.key) ui.small(opts.key, x + w - 2, y + h - 7 + dy, opts.disabled ? C.hull1 : C.hull2, { align: 'right', shadow: C.ink });
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

/** A progress bar with a shine and a dark trough. */
export function bar(ui: UI, x: number, y: number, w: number, h: number, frac: number, col: string, trough: string = C.ink) {
  frac = Math.max(0, Math.min(1, frac));
  ui.fill(x, y, w, h, trough);
  const fw = Math.round((w - 2) * frac);
  if (fw > 0) {
    ui.fill(x + 1, y + 1, fw, h - 2, col);
    if (h > 3) ui.fill(x + 1, y + 1, fw, 1, rgba(C.bone, 0.45));
    // a glint that runs along the filled part
    const g = Math.floor((ui.time * 40) % (w + 20)) - 10;
    if (g > 0 && g < fw - 2) ui.fill(x + 1 + g, y + 1, 2, h - 2, rgba(C.bone, 0.35));
  }
}

/** A sparkline of the last values (bars, newest at the right). */
export function sparkline(ui: UI, x: number, y: number, w: number, h: number, values: number[], col: string) {
  ui.fill(x, y, w, h, C.ink, 0.6);
  if (!values.length) return;
  let max = 0;
  for (const v of values) max = Math.max(max, v);
  if (max <= 0) return;
  const n = Math.min(values.length, w - 2);
  for (let i = 0; i < n; i++) {
    const v = values[values.length - n + i];
    const bh = Math.max(1, Math.round((v / max) * (h - 2)));
    ui.ctx.fillStyle = i === n - 1 ? C.gold : col;
    ui.ctx.fillRect(x + w - 1 - n + i, y + h - 1 - bh, 1, bh);
  }
}

/** A little "NEW" style pill, in the small capitals. */
export function badge(ui: UI, x: number, y: number, text: string, col: string = C.pipRed) {
  const w = smallWidth(text.toUpperCase()) + 4;
  ui.fill(x, y, w, 9, C.ink);
  ui.fill(x + 1, y + 1, w - 2, 7, col);
  ui.small(text.toUpperCase(), x + 2, y + 2, col === C.gold || col === C.hot || col === C.pipYellow ? C.ink : C.bone);
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

/** A customer portrait (art: portrait_<who>), or a code-drawn frog for Bramble. */
export function portrait(ui: UI, who: string, x: number, y: number, size: 48 | 24) {
  const name = size === 48 ? `portrait_${who}` : `portrait_${who}_small`;
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
