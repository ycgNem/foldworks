// Shared pieces for the Act II screens (Milestone 4): icons found by their atlas name (the atlas is
// append-only, STYLE.md), the screen header with its row of linked-screen tabs, tabs, a stamp
// that slams down, star bursts and number formatting for rates. Presentation only.
import { C, rgba } from '../data/palette';
import { ICON, textWidth } from '../ui/font';
import { sheet, hasArt } from '../render/sprites';
import { nine, button, frame } from './chrome';
import type { App } from './app';
import type { ScreenName } from './screens';
import type { Rect, TipLine } from '../ui/ui';
import { perMin as fmtPerMin, amount } from '../engine/fmt'; // Milestone 6: one number helper (DESIGN.md §20)

/** ui_icons.png / ui_icons_small.png names, in atlas order (append-only, STYLE.md). */
export const ICON_NAMES = [
  'build', 'research', 'orders', 'stats', 'trophies', 'options', 'fold', 'flow', 'remove', 'rotate',
  'factory', 'workshop', 'coin', 'heart', 'clock', 'lock', 'star', 'play', 'pause', 'fastforward',
  'power', 'heavy', 'codex', 'survey', 'mega', 'kit', 'claim', 'overdrive', 'mode',
] as const;
export type IconName = (typeof ICON_NAMES)[number];

/** font glyphs standing in until the art loads */
const GLYPH: Partial<Record<IconName, string>> = {
  coin: ICON.coin, heart: ICON.heart, clock: ICON.clock, lock: ICON.lock, star: ICON.star, power: ICON.bolt,
  codex: ICON.crate, survey: ICON.pip, mega: ICON.module, kit: ICON.cog, claim: ICON.pip, fold: ICON.module, orders: ICON.crate,
};

/** One UI icon by name: 16x16, or the 8x8 atlas with `small`. */
export function icon(app: App, name: IconName, x: number, y: number, small = false) {
  const ui = app.ui;
  const at = small ? 'ui_icons_small' : 'ui_icons';
  const i = ICON_NAMES.indexOf(name);
  if (hasArt(at) && sheet(at).frames[i]) {
    ui.ctx.drawImage(sheet(at).frames[i], Math.round(x), Math.round(y));
    return;
  }
  ui.text(GLYPH[name] ?? '?', Math.round(x) + (small ? 1 : 5), Math.round(y) + (small ? 0 : 4), name === 'coin' ? C.gold : name === 'heart' ? C.pipRed : C.bone, { shadow: C.ink });
}

/** Per-minute figures from a per-second rate: 480, 37.5, 0.75. */
export function perMin(r: number): string {
  return fmtPerMin(r);
}

/** A whole number with separators. */
export const fmt = (n: number) => amount(Math.floor(n));

/** A tab: the art's 9-slice (frame 1 when active), a label, an optional icon. Returns true on click. */
export function tab(app: App, id: string, x: number, y: number, w: number, h: number, label: string, o: { active?: boolean; icon?: IconName; disabled?: boolean; tip?: TipLine[] | string; badge?: string } = {}): boolean {
  const ui = app.ui;
  ui.mark(id, x, y, w, h);
  ui.region(x, y, w, h, 'button');
  const hov = ui.hover(x, y, w, h);
  if (hasArt('ui_tab')) nine(ui.ctx, sheet('ui_tab'), o.active || (hov && !o.disabled) ? 1 : 0, x, y, w, h);
  else {
    ui.fill(x, y, w, h, C.ink);
    ui.fill(x + 1, y + 1, w - 2, h - 1, o.active ? C.ground1 : hov ? C.hull1 : C.hull0);
  }
  if (o.active) ui.fill(x + 3, y + h - 2, w - 6, 1, C.gold);
  let tx = x + Math.floor(w / 2);
  if (o.icon) {
    const iw = 9 + textWidth(label);
    const ix = x + Math.floor((w - iw) / 2);
    ui.ctx.globalAlpha = o.disabled ? 0.4 : 1;
    icon(app, o.icon, ix, y + Math.floor((h - 8) / 2), true);
    ui.ctx.globalAlpha = 1;
    tx = ix + 9 + Math.floor(textWidth(label) / 2);
  }
  ui.text(label, tx, y + Math.floor((h - 7) / 2), o.disabled ? C.hull1 : o.active ? C.gold : C.bone, { align: 'center', shadow: C.ink });
  if (o.badge) {
    const bw = textWidth(o.badge) + 4;
    ui.fill(x + w - bw - 1, y - 3, bw, 8, C.ink);
    ui.fill(x + w - bw, y - 2, bw - 2, 6, C.pipRed);
    ui.text(o.badge, x + w - bw + 1, y - 3, C.bone);
  }
  if (hov && o.tip) ui.tip(typeof o.tip === 'string' ? [{ text: o.tip }] : o.tip, 190);
  if (hov && ui.clicked && !o.disabled) {
    ui.eat();
    ui.sfx('click');
    return true;
  }
  return false;
}

/** The linked screens shown as tabs in every Act II screen's header (only the open ones). */
function linked(app: App): { id: ScreenName; label: string; icon: IconName; tip: string }[] {
  const g = app.game;
  const out: { id: ScreenName; label: string; icon: IconName; tip: string }[] = [{ id: 'orders', label: 'Orders', icon: 'orders', tip: 'Customers and their orders (O)' }];
  if (g.done('folding')) out.push({ id: 'modules', label: 'Modules', icon: 'fold', tip: 'Your folded designs: stamp, place, unfold (I)' });
  if (g.done('coalSeams')) out.push({ id: 'codex', label: 'Codex', icon: 'codex', tip: "Unit 7's Codex: a first delivery of each item pays 30x" });
  if (g.done('coalSeams')) out.push({ id: 'survey', label: 'Survey', icon: 'survey', tip: 'The Survey Office: deposit claims for source modules' });
  if (g.done('greatDrill') || g.s.mega.stage > 0) out.push({ id: 'mega', label: 'Drill', icon: 'mega', tip: 'The Megaproject: the Great Drill' });
  return out;
}

/** A screen's title strip: icon, title, the linked-screen tabs and Close. Returns the strip's
 * free width left of the tabs (for callers that add their own controls). */
export function screenHeader(app: App, r: Rect, title: string, accent: string, ic: IconName): number {
  const ui = app.ui;
  frame(ui, r.x, r.y, r.w, r.h);
  ui.fill(r.x + 3, r.y + 3, r.w - 6, 15, C.shadow);
  ui.fill(r.x + 3, r.y + 17, r.w - 6, 1, accent);
  icon(app, ic, r.x + 6, r.y + 2);
  ui.text(title, r.x + 26, r.y + 7, accent, { shadow: C.ink });
  if (button(ui, 'closeScreen', r.x + r.w - 46, r.y + 4, 40, 12, 'close', { tip: 'Close (Esc)' })) app.panel = null;
  const tabs = linked(app);
  const tw = r.w >= 600 ? 58 : 50;
  let x = r.x + r.w - 50 - tabs.length * (tw + 2);
  const left = x - (r.x + 26 + textWidth(title)) - 6;
  if (left < 0) return 0;
  for (const t of tabs) {
    if (tab(app, 'nav:' + t.id, x, r.y + 4, tw, 13, t.label, { icon: t.icon, active: app.panel === t.id, tip: t.tip }) && app.panel !== t.id) {
      app.panel = t.id;
      app.audio.sfx('open');
    }
    x += tw + 2;
  }
  return left;
}

/** The stamp's scale at time t after it starts falling: 3x down to 1x in whole steps. */
export function slamScale(t: number, base = 1): number {
  const k = t < 0.28 ? 3 - 2 * (Math.max(0, t) / 0.28) ** 2 : 1;
  return Math.max(base, Math.round(k * base));
}

/** Rays turning slowly behind a celebrated thing (code-drawn, clipped by the caller). */
export function rays(app: App, cx: number, cy: number, rad: number, col: string, n = 12) {
  const ctx = app.ui.ctx;
  const t = app.ui.time * 0.4;
  ctx.fillStyle = rgba(col, 0.18);
  for (let i = 0; i < n; i++) {
    const a = t + (i * Math.PI * 2) / n;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(a - 0.09) * rad, cy + Math.sin(a - 0.09) * rad);
    ctx.lineTo(cx + Math.cos(a + 0.09) * rad, cy + Math.sin(a + 0.09) * rad);
    ctx.closePath();
    ctx.fill();
  }
}

/** A segmented meter: n cells, `on` filled; cells past `cap` drawn red (over-use). */
export function cells(app: App, x: number, y: number, w: number, h: number, on: number, n: number, col: string) {
  const ui = app.ui;
  ui.fill(x, y, w, h, C.ink);
  if (n <= 0) return;
  const cw = Math.max(2, Math.floor((w - 1) / n));
  for (let i = 0; i < n; i++) {
    const cx = x + 1 + i * cw;
    if (cx + cw - 1 > x + w) break;
    ui.fill(cx, y + 1, cw - 1, h - 2, i < on ? col : C.shadow);
    if (i < on) ui.fill(cx, y + 1, cw - 1, 1, rgba(C.bone, 0.4));
  }
}
