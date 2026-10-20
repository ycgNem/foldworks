// The HUD's chrome: framed wood-and-brass panels, chunky buttons with icons, cards, counters,
// sparklines and badges (STYLE.md UI: the screen is full and every clickable thing reacts). Uses
// the art director's ui_* sprites when they exist (9-slices from src/art), and code-drawn frames
// in the same colours until then.
import { C, rgba } from '../data/palette';
import { ICON } from '../ui/font';
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

export type FrameStyle = 'wood' | 'paper' | 'inset';

/** A framed panel: dark wood with brass trim and rivets (or the art's 9-slice). */
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

/** A card: a frame with a title strip. Returns the inner content origin. */
export function card(ui: UI, x: number, y: number, w: number, h: number, title: string, accent: string = C.brass1, icon?: UIconName) {
  frame(ui, x, y, w, h);
  ui.fill(x + 3, y + 3, w - 6, 11, C.shadow);
  ui.fill(x + 3, y + 13, w - 6, 1, accent);
  let tx = x + 6;
  if (icon) { uiIcon(ui, icon, x + 4, y + 2, 0.5); tx += 10; }
  ui.text(title, tx, y + 4, accent, { shadow: C.ink });
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

/** A chunky button with an optional icon; returns true when clicked. */
export function button(ui: UI, id: string, x: number, y: number, w: number, h: number, label: string, opts: { icon?: UIconName; disabled?: boolean; active?: boolean; gold?: boolean; tip?: TipLine[] | string; key?: string; pulse?: boolean } = {}): boolean {
  ui.mark(id, x, y, w, h);
  x = Math.round(x); y = Math.round(y);
  const hov = ui.hover(x, y, w, h) && !opts.disabled;
  const down = hov && ui.input.mouse.down[0];
  ui.region(x, y, w, h, 'button');
  const art = opts.gold ? 'ui_button_gold' : 'ui_button';
  const pulse = opts.pulse && Math.floor(ui.time * 2.5) % 2 === 0;
  if (hasArt(art)) {
    nine(ui.ctx, sheet(art), down ? 2 : hov || opts.active || pulse ? 1 : 0, x, y, w, h);
    if (opts.disabled) ui.fill(x, y, w, h, C.ink, 0.45);
  } else {
    const base = opts.disabled ? C.shadow : opts.gold ? (hov || pulse ? C.glow : C.brass1) : opts.active ? C.copper1 : hov ? C.hull1 : C.hull0;
    const hi = opts.disabled ? C.hull0 : opts.gold ? C.hot : opts.active ? C.copper2 : hov ? C.hull2 : C.hull1;
    ui.fill(x, y, w, h, C.ink);
    ui.fill(x + 1, y + 1, w - 2, h - 2, base);
    if (!down) {
      ui.fill(x + 1, y + 1, w - 2, 1, hi);
      ui.fill(x + 1, y + h - 2, w - 2, 1, opts.gold ? C.brass0 : C.shadow);
    }
  }
  const dy = down ? 1 : 0;
  let cx = x + w / 2;
  const tcol = opts.disabled ? C.hull1 : opts.gold ? C.ink : C.bone;
  if (opts.icon && label) {
    uiIcon(ui, opts.icon, x + 3, y + Math.floor((h - 16) / 2) + dy);
    cx = x + 20 + (w - 22) / 2;
  } else if (opts.icon) {
    uiIcon(ui, opts.icon, x + Math.floor((w - 16) / 2), y + Math.floor((h - 16) / 2) + dy);
  }
  if (label) ui.text(label, cx, y + Math.floor((h - 7) / 2) + dy, tcol, { align: 'center', shadow: opts.gold || opts.disabled ? undefined : C.ink });
  if (opts.key) ui.text(opts.key, x + w - 2, y + h - 9 + dy, opts.disabled ? C.hull1 : C.hull2, { align: 'right' });
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
    ui.fill(x + 1, y + 1, fw, 1, rgba(C.bone, 0.45));
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

/** A little "NEW!" style pill. */
export function badge(ui: UI, x: number, y: number, text: string, col: string = C.pipRed) {
  const w = text.length * 5 + 4;
  ui.fill(x, y, w, 9, C.ink);
  ui.fill(x + 1, y + 1, w - 2, 7, col);
  ui.text(text, x + 2, y + 1, C.bone);
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
  frame(ui, x - 2, y - 2, size + 4, size + 4, 'inset', false);
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
