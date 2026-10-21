// Shared pieces for the screens: icons found by their atlas name (the atlas is append-only,
// STYLE.md), tabs (bookmark ribbons since the 180), the one full-screen menu template (the ledger
// book, docs/hud-180.md "Full-screen menus": the menu's tabs as bookmarks along the top, the title
// in the display face at the top of the left page, the detail panel as the right page), a stamp
// that slams down, star bursts, meters and number formatting for rates. Presentation only.
import { C, rgba } from '../data/palette';
import { ICON, textWidth, smallWidth, bigWidth } from '../ui/font';
import { sheet, hasArt } from '../render/sprites';
import { button, keycapK } from './chrome';
import type { App } from './app';
import type { ScreenName } from './screens';
import type { Rect, TipLine } from '../ui/ui';
import { T, onPaper } from '../ui/theme';
import { bookRaw, bookmarkRaw, keycapWidth, RIBBON, type RibbonColor } from '../ui/paper';
import { CAP_H, BIG_CAP_H } from '../ui/rich';
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
  ui.text(GLYPH[name] ?? '?', Math.round(x) + (small ? 1 : 5), Math.round(y) + (small ? 0 : 4), name === 'coin' ? T.coin : name === 'heart' ? T.bad : T.ink);
}

/** Per-minute figures from a per-second rate: 480, 37.5, 0.75. */
export function perMin(r: number): string {
  return fmtPerMin(r);
}

/** A whole number with separators. */
export const fmt = (n: number) => amount(Math.floor(n));

/** The bookmark colour of an active tab, and of the rest. */
const TAB_ON: RibbonColor = 'gold';
const TAB_OFF: RibbonColor = 'moss';

/** A tab, a bookmark ribbon forked at its foot: gold when active, moss otherwise, lit paper while
 * disabled. An optional icon and a badge (a count or "!") on its corner. Returns true on click. */
export function tab(app: App, id: string, x: number, y: number, w: number, h: number, label: string, o: { active?: boolean; icon?: IconName; disabled?: boolean; tip?: TipLine[] | string; badge?: string } = {}): boolean {
  const ui = app.ui;
  ui.mark(id, x, y, w, h);
  ui.region(x, y, w, h, 'button');
  const hov = ui.hover(x, y, w, h) && !o.disabled;
  const ctx = ui.ctx;
  const col: RibbonColor | 'paper' = o.disabled ? 'paper' : o.active ? TAB_ON : TAB_OFF;
  // a hovered bookmark slides 1 px down out of the book
  const dy = hov && !o.active ? 1 : 0;
  bookmarkRaw(ctx, x, y, w, h - 1 + dy, col, hov);
  const ink = col === 'paper' ? T.inkSoft : RIBBON[col].text;
  const shadow = col === 'paper' ? undefined : col === 'gold' ? C.brass3 : RIBBON[col].line;
  const faceH = h - 4;
  let tx = x + Math.floor(w / 2);
  if (o.icon) {
    const iw = label ? 9 + textWidth(label) : 8;
    const ix = x + Math.floor((w - iw) / 2);
    ctx.globalAlpha = o.disabled ? 0.4 : 1;
    icon(app, o.icon, ix, y + Math.floor((faceH - 8) / 2) + dy, true);
    ctx.globalAlpha = 1;
    tx = ix + 9 + Math.floor(textWidth(label) / 2);
  }
  if (label) ui.text(label, tx, y + Math.floor((faceH - CAP_H) / 2) + dy, ink, { align: 'center', shadow });
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

/** The header band's height: content starts below it (r.y + MENU_HEAD + 2). */
export const MENU_HEAD = 20;

/** Draw the book and its header: the leather cover and the pages (two, split at `spine`, or one),
 * the icon and the title in the display face at the top of the left page over a pencil rule in
 * the accent's ink, the tabs as bookmark ribbons hanging from the top edge, the Esc keycap and the
 * close button. Returns the header's free width left of the tabs. */
function menuHead(app: App, r: Rect, title: string, accent: string, ic: IconName, tabs: MenuTab[], spine: number | null): number {
  const ui = app.ui;
  ui.region(r.x, r.y, r.w, r.h, 'panel', true);
  const ctx = ui.ctx;
  const { left, right } = bookRaw(ctx, r.x, r.y, r.w, r.h, spine);
  const ink = onPaper(accent);
  // the rule under the header: the accent's ink, a faint second line under it
  const ruleY = r.y + MENU_HEAD - 1;
  ctx.fillStyle = ink;
  ctx.fillRect(left.x + 4, ruleY, (right ? left.w : left.w) - 8, 1);
  ctx.fillStyle = rgba(T.paperLo, 0.9);
  ctx.fillRect(left.x + 4, ruleY + 2, left.w - 8, 1);
  if (right) {
    ctx.fillStyle = rgba(T.paperEdge, 0.6);
    ctx.fillRect(right.x + 4, ruleY, right.w - 8, 1);
  }
  const headTop = left.y, headH = ruleY - left.y;
  icon(app, ic, r.x + 9, headTop + Math.floor((headH - 16) / 2));
  const titleX = r.x + 29;
  ui.big(title, titleX, headTop + Math.floor((headH - BIG_CAP_H) / 2), T.ink);
  // close: a paper key with an x at the right, its Esc keycap beside it
  const cx = r.x + r.w - 23;
  if (button(ui, 'closeScreen', cx, headTop + 1, 15, 14, ICON.cross, { tip: 'Close {k:Esc}' })) app.panel = null;
  const kw = keycapWidth('Esc');
  keycapK(ui, 'Esc', cx - 3 - kw, headTop + Math.floor((headH - 10) / 2));
  const right0 = cx - 3 - kw - 6;
  const titleEnd = titleX + bigWidth(title) + 8;
  if (!tabs.length) return right0 - titleEnd;
  const want = (lab: boolean) => tabs.reduce((s, t) => s + (lab ? Math.max(40, 22 + textWidth(t.label)) : 18) + 2, 0);
  const lab = right0 - titleEnd >= want(true);
  if (!lab && right0 - titleEnd < want(false)) return right0 - titleEnd;
  let x = right0 - want(lab);
  const free = x - titleEnd;
  for (const t of tabs) {
    const tw = lab ? Math.max(40, 22 + textWidth(t.label)) : 18;
    // bookmarks hang from the book's top edge; the active one hangs lower
    const th = t.active ? MENU_HEAD - 2 : MENU_HEAD - 5;
    if (tab(app, t.id, x, r.y + 1, tw, th, lab ? t.label : '', { icon: t.icon, active: t.active, tip: t.tip, badge: t.badge, disabled: t.disabled })) t.onClick();
    x += tw + 2;
  }
  return free;
}

/** A screen's title strip: the book (one page) and its header, with the tabs of the screen's
 * group. Returns the strip's free width left of the tabs (for callers that add their own
 * controls). */
export function screenHeader(app: App, r: Rect, title: string, accent: string, ic: IconName): number {
  return menuHead(app, r, title, accent, ic, linked(app), null);
}

/** The one full-screen menu template: the ledger book, its header (icon, title, the menu's tabs
 * as bookmarks, Esc and close), the content on the left page, and an optional detail panel
 * `detail` px wide as the right page (the research tree's node card is the model). Returns where
 * to draw.
 *   const { body, detail } = menuTemplate(app, r, { title: 'Patents', accent: C.violet, icon: 'star', detail: 170 });
 */
export function menuTemplate(app: App, r: Rect, o: { title: string; accent: string; icon: IconName; tabs?: MenuTab[]; detail?: number }): { body: Rect; detail: Rect | null; free: number } {
  const top = r.y + MENU_HEAD + 4, h = r.h - MENU_HEAD - 10;
  const dw = o.detail ? Math.min(o.detail, Math.floor(r.w * 0.4)) : 0;
  const body = { x: r.x + 8, y: top, w: r.w - 16 - (dw ? dw + 6 : 0), h };
  const detail = dw ? { x: r.x + r.w - 8 - dw, y: top, w: dw, h } : null;
  const free = menuHead(app, r, o.title, o.accent, o.icon, o.tabs ?? linked(app), detail ? detail.x - 3 : null);
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

/** A segmented meter on paper: n cells in an ink-lined trough, `on` filled with `col`. */
export function cells(app: App, x: number, y: number, w: number, h: number, on: number, n: number, col: string) {
  const ui = app.ui;
  ui.fill(x, y, w, h, C.ink);
  if (n <= 0) return;
  const cw = Math.max(2, Math.floor((w - 1) / n));
  for (let i = 0; i < n; i++) {
    const cx = x + 1 + i * cw;
    if (cx + cw - 1 > x + w) break;
    ui.fill(cx, y + 1, cw - 1, h - 2, i < on ? col : T.paperLo);
    if (i < on) ui.fill(cx, y + 1, cw - 1, 1, rgba(C.bone, 0.4));
    else ui.fill(cx, y + 1, cw - 1, 1, C.wood4);
  }
}
