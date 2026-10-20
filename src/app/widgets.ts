// Shared pieces for the screens: icons found by their atlas name (the atlas is append-only,
// STYLE.md), tabs, the one full-screen menu template (docs/ui-redesign.md: header bar with icon,
// title, the menu's tabs and close; content; an optional detail panel on the right), a stamp that
// slams down, star bursts, meters and number formatting for rates. Presentation only.
import { C, rgba } from '../data/palette';
import { ICON, textWidth, smallWidth } from '../ui/font';
import { sheet, hasArt } from '../render/sprites';
import { button, frame, label } from './chrome';
import type { App } from './app';
import type { ScreenName } from './screens';
import type { Rect, TipLine } from '../ui/ui';

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
  const m = r * 60;
  return m >= 100 ? Math.round(m).toLocaleString('en-US') : m >= 10 ? m.toFixed(1).replace(/\.0$/, '') : m.toFixed(2).replace(/0$/, '').replace(/\.0$/, '');
}

/** A whole number with separators. */
export const fmt = (n: number) => Math.floor(n).toLocaleString('en-US');

/** A tab, code-drawn in the plate language: a dark key, lit with a gold underline when active.
 * An optional icon and a badge (a count or "!") on its corner. Returns true on click. */
export function tab(app: App, id: string, x: number, y: number, w: number, h: number, label: string, o: { active?: boolean; icon?: IconName; disabled?: boolean; tip?: TipLine[] | string; badge?: string } = {}): boolean {
  const ui = app.ui;
  ui.mark(id, x, y, w, h);
  ui.region(x, y, w, h, 'button');
  const hov = ui.hover(x, y, w, h) && !o.disabled;
  const ctx = ui.ctx;
  ctx.fillStyle = C.ink;
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = o.active ? C.hull0 : hov ? C.shadow : rgba(C.shadow, 0.6);
  ctx.fillRect(x + 1, y + 1, w - 2, h - 1);
  ctx.fillStyle = o.active ? C.hull1 : C.hull0;
  ctx.fillRect(x + 1, y + 1, w - 2, 1);
  if (o.active) { ctx.fillStyle = C.gold; ctx.fillRect(x + 2, y + h - 2, w - 4, 1); }
  let tx = x + Math.floor(w / 2);
  if (o.icon) {
    const iw = label ? 9 + textWidth(label) : 8;
    const ix = x + Math.floor((w - iw) / 2);
    ctx.globalAlpha = o.disabled ? 0.4 : 1;
    icon(app, o.icon, ix, y + Math.floor((h - 8) / 2), true);
    ctx.globalAlpha = 1;
    tx = ix + 9 + Math.floor(textWidth(label) / 2);
  }
  if (label) ui.text(label, tx, y + Math.floor((h - 7) / 2), o.disabled ? C.hull1 : o.active ? C.gold : C.bone, { align: 'center', shadow: C.ink });
  if (o.badge) {
    const bw = smallWidth(o.badge) + 4;
    ui.fill(x + w - bw - 1, y - 3, bw, 8, C.ink);
    ui.fill(x + w - bw, y - 2, bw - 2, 6, C.pipRed);
    ui.small(o.badge, x + w - bw + 1, y - 2, C.bone);
  }
  if (hov && o.tip) ui.tip(typeof o.tip === 'string' ? [{ text: o.tip }] : o.tip, 190);
  if (hov && ui.clicked) {
    ui.eat();
    ui.sfx('click');
    return true;
  }
  return false;
}

/** A tab in a menu's header bar. */
export interface MenuTab { id: string; label: string; icon?: IconName; tip?: string; active: boolean; onClick: () => void; badge?: string; disabled?: boolean }

/** The screens that share a header's tabs: switching among them keeps the menu open. */
const GROUPS: ScreenName[][] = [
  ['orders', 'modules', 'codex', 'survey', 'mega'],
  ['stats', 'trophies', 'options'],
];

/** The linked screens shown as tabs in a screen's header (only the open ones of its group). */
function linked(app: App): MenuTab[] {
  const g = app.game;
  const p = app.panel;
  const group = GROUPS.find((q) => p && q.includes(p as ScreenName));
  if (!group) return [];
  const all: { id: ScreenName; label: string; icon: IconName; tip: string; open: boolean }[] = [
    { id: 'orders', label: 'Orders', icon: 'orders', tip: 'Customers and their orders (O)', open: true },
    { id: 'modules', label: 'Modules', icon: 'fold', tip: 'Your folded designs: stamp, place, unfold (I)', open: g.done('folding') },
    { id: 'codex', label: 'Codex', icon: 'codex', tip: "Unit 7's Codex: a first delivery of each item pays 30x", open: g.done('coalSeams') },
    { id: 'survey', label: 'Survey', icon: 'survey', tip: 'The Survey Office: deposit claims for source modules', open: g.done('coalSeams') },
    { id: 'mega', label: 'Drill', icon: 'mega', tip: 'The Megaproject: the Great Drill', open: g.done('greatDrill') || g.s.mega.stage > 0 },
    { id: 'stats', label: 'Stats', icon: 'stats', tip: 'Statistics', open: true },
    { id: 'trophies', label: 'Trophies', icon: 'trophies', tip: 'The Trophy Shelf', open: true },
    { id: 'options', label: 'Options', icon: 'options', tip: 'Sound, saves, keys (/)', open: true },
  ];
  const tabs = all.filter((t) => group.includes(t.id) && t.open);
  if (tabs.length < 2) return [];
  return tabs.map((t) => ({ id: 'nav:' + t.id, label: t.label, icon: t.icon, tip: t.tip, active: app.panel === t.id, onClick: () => { if (app.panel !== t.id) { app.panel = t.id; app.audio.sfx('open'); } } }));
}

/** The header bar's height: content starts below it (r.y + MENU_HEAD + 2). */
export const MENU_HEAD = 20;

/** Draw the menu template's frame and header bar: the ornate frame (menus are the rare, special
 * weight), the icon, the title in the accent colour, the tabs, Esc and close. Returns the header's
 * free width left of the tabs. */
function menuHead(app: App, r: Rect, title: string, accent: string, ic: IconName, tabs: MenuTab[]): number {
  const ui = app.ui;
  frame(ui, r.x, r.y, r.w, r.h);
  ui.fill(r.x + 3, r.y + 3, r.w - 6, MENU_HEAD - 4, C.ink, 0.7);
  ui.fill(r.x + 3, r.y + MENU_HEAD - 2, r.w - 6, 1, accent);
  icon(app, ic, r.x + 6, r.y + 2);
  ui.text(title, r.x + 26, r.y + 7, accent, { shadow: C.ink });
  // close: an x key at the right, with its key named beside it
  const cx = r.x + r.w - 20;
  if (button(ui, 'closeScreen', cx, r.y + 4, 14, 12, ICON.cross, { tip: 'Close (Esc)' })) app.panel = null;
  label(ui, 'esc', cx - 3, r.y + 8, C.hull1, 'right');
  const right = cx - 3 - smallWidth('ESC') - 6;
  const titleEnd = r.x + 26 + textWidth(title) + 8;
  if (!tabs.length) return right - titleEnd;
  const want = (lab: boolean) => tabs.reduce((s, t) => s + (lab ? Math.max(40, 22 + textWidth(t.label)) : 18) + 2, 0);
  const lab = right - titleEnd >= want(true);
  if (!lab && right - titleEnd < want(false)) return right - titleEnd;
  let x = right - want(lab);
  const left = x - titleEnd;
  for (const t of tabs) {
    const tw = lab ? Math.max(40, 22 + textWidth(t.label)) : 18;
    if (tab(app, t.id, x, r.y + 4, tw, 13, lab ? t.label : '', { icon: t.icon, active: t.active, tip: t.tip, badge: t.badge, disabled: t.disabled })) t.onClick();
    x += tw + 2;
  }
  return left;
}

/** A screen's title strip: the template's header, with the tabs of the screen's group. Returns the
 * strip's free width left of the tabs (for callers that add their own controls). */
export function screenHeader(app: App, r: Rect, title: string, accent: string, ic: IconName): number {
  return menuHead(app, r, title, accent, ic, linked(app));
}

/** The one full-screen menu template (docs/ui-redesign.md): the ornate frame, a header bar (icon,
 * title, the menu's tabs, Esc and close), the content, and an optional detail panel `detail` px
 * wide on the right (the research tree's node card is the model). Returns where to draw.
 *   const { body, detail } = menuTemplate(app, r, { title: 'Patents', accent: C.violet, icon: 'star', detail: 170 });
 */
export function menuTemplate(app: App, r: Rect, o: { title: string; accent: string; icon: IconName; tabs?: MenuTab[]; detail?: number }): { body: Rect; detail: Rect | null; free: number } {
  const free = menuHead(app, r, o.title, o.accent, o.icon, o.tabs ?? linked(app));
  const top = r.y + MENU_HEAD + 4, h = r.h - MENU_HEAD - 10;
  const dw = o.detail ? Math.min(o.detail, Math.floor(r.w * 0.4)) : 0;
  const body = { x: r.x + 8, y: top, w: r.w - 16 - (dw ? dw + 6 : 0), h };
  const detail = dw ? { x: r.x + r.w - 8 - dw, y: top, w: dw, h } : null;
  return { body, detail, free };
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
