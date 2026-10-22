// The Trophy Shelf (DESIGN.md §24, Milestone 11's screens): Bramble's sticker book, now 205
// stickers. The left page has an index down its edge (the trophies in nine groups by act and by
// theme, each with its count; then the shelf's Bonuses and the Wardrobe), the group's stickers in a
// grid (earned, pencilled in, or "???" for a hidden one), and under them the closest ones still to
// earn. The right page holds the sticker in hand: its condition, its progress and the bonus it gives
// (or gives already). Bonuses lists what the shelf adds up to, kind by kind, against each kind's cap
// (TROPHY_CAPS: the shelf is a set of small rules, never a multiplier on its own size). The Wardrobe
// lists every kind a skin can dress, what it wears, and the skins owned for it, worn with the
// `skin` command. Ink on paper, the page kit of screens.ts.
import { C, rgba } from '../data/palette';
import { TROPHIES, TROPHY, TROPHY_CAPS, trophyFace, type TrophyDef } from '../data/trophies';
import { COSMETICS, SKIN_SLOTS, cosmeticDef, type CosmeticDef, type SkinSlot } from '../data/cosmetics';
import { CHALLENGES } from '../data/challenges';
import { CUSTOMERS } from '../data/orders';
import { BUILD } from '../data/machines';
import { ITEMS, type ItemId } from '../data/items';
import { trules, trophyEarned, ownedCosmetics, skinFor } from '../sim/longtail';
import { trophyValue } from '../sim/systems/stats';
import { textWidth, smallWidth, bigWidth, ellipsize, LINE_H } from '../ui/font';
import { drawRich, richWidth, richHeight } from '../ui/rich';
import { T } from '../ui/theme';
import { sheet, spriteName, hasArt } from '../render/sprites';
import { skinArt } from '../render/skins';
import { button, meter, rule, pencil, chip, chipWidth } from './chrome';
import { menuTemplate } from './widgets';
import { speaker, caption, sticker, penCircle, backTabs, titleChip, ledgerRow } from './screens';
import type { App } from './app';
import type { Rect, UI } from '../ui/ui';

// ------------------------------------------------------------------ the groups

export type ShelfTab = 'act1' | 'act2' | 'act3' | 'deliveries' | 'firsts' | 'resets' | 'heights' | 'feats' | 'hidden' | 'bonuses' | 'wardrobe';

/** The groups in the shelf's order: each starts at its anchor trophy (src/data/trophies.ts keeps
 * them in blocks by act and theme) and runs to the next group's anchor. */
const GROUP_DEFS: { id: ShelfTab; label: string; from: string; tip: string }[] = [
  { id: 'act1', label: 'Act I', from: 'warmHands', tip: 'the Workshop, the first folds' },
  { id: 'act2', label: 'Act II', from: 'manOfSteel', tip: 'steel, power, the Great Drill' },
  { id: 'act3', label: 'Act III', from: 'upInTheAir', tip: 'the District and its goods' },
  { id: 'deliveries', label: 'Hauls', from: 'tenThousandTeeth', tip: 'long deliveries, counted over every run' },
  { id: 'firsts', label: 'Firsts', from: 'hardSet', tip: 'firsts of Acts II-V and the Codex' },
  { id: 'resets', label: 'Resets', from: 'freshStart', tip: 'Reorganize and Relocate' },
  { id: 'heights', label: 'Heights', from: 'urbanPlanner', tip: 'the high floors, the Last Fold, grades' },
  { id: 'feats', label: 'Feats', from: 'tenChallenges', tip: 'Challenges, Scenarios, the shelf' },
  { id: 'hidden', label: 'Hidden', from: 'repetitiveStrain', tip: 'no hints: ??? until earned' },
];

let groupCache: Record<string, TrophyDef[]> | null = null;

/** Each group's trophies (a trophy before the first anchor falls in the first group). */
export function shelfGroups(): Record<string, TrophyDef[]> {
  if (groupCache) return groupCache;
  const starts = GROUP_DEFS.map((d) => ({ id: d.id, i: Math.max(0, TROPHIES.findIndex((t) => t.id === d.from)) })).sort((a, b) => a.i - b.i);
  const out: Record<string, TrophyDef[]> = {};
  starts.forEach((s, k) => { out[s.id] = TROPHIES.slice(k === 0 ? 0 : s.i, k + 1 < starts.length ? starts[k + 1].i : TROPHIES.length); });
  return (groupCache = out);
}

/** The group a trophy is shelved in. */
export function trophyGroup(id: string): ShelfTab {
  const gs = shelfGroups();
  for (const d of GROUP_DEFS) if (gs[d.id]?.some((t) => t.id === id)) return d.id;
  return 'act1';
}

/** The page's state: the tab open, the sticker in hand (null: the closest), the Wardrobe's slot. */
const st = { tab: 'act1' as ShelfTab, focus: null as string | null, slot: null as SkinSlot | null, opened: false };

/** Open the shelf at a tab (e2e, and the Ledger's "Wardrobe" key). */
export function shelfTab(tab: ShelfTab, focus: string | null = null, slot: SkinSlot | null = null) {
  st.tab = tab;
  st.focus = focus;
  if (slot) st.slot = slot;
  st.opened = true;
}

// ------------------------------------------------------------------ names

/** A skin slot's name: the building's, or the carrier's. */
export function slotName(slot: SkinSlot): string {
  const n: Record<string, string> = { module: 'Modules', skiff: 'Skiffs', barge: 'Barges', courier: 'Couriers' };
  return n[slot] ?? (BUILD as Record<string, { name: string } | undefined>)[slot]?.name ?? slot;
}

/** Where a cosmetic comes from, in a few words. */
export function cosmeticSource(app: App, c: CosmeticDef): string {
  const s = c.source;
  switch (s.k) {
    case 'ledger': return `Ledger order ${s.n}`;
    case 'rep': return `${CUSTOMERS[s.customer]?.name ?? s.customer} rep ${s.level}`;
    case 'challenge': return `win ${CHALLENGES[s.id]?.name ?? s.id}`;
    case 'trophy': {
      const t = TROPHY[s.id];
      return t ? `trophy: ${trophyFace(t, trophyEarned(app.game, t)).name}` : 'a trophy';
    }
  }
}

/** The sheet a slot is drawn with when plain. */
const slotSheet = (slot: SkinSlot) => sheet(slot === 'module' || slot === 'skiff' || slot === 'barge' || slot === 'courier' ? slot : spriteName(slot));

/** Draw a slot's sprite (or a skin's, when its art exists) fitted in a `size` px square at (x, y):
 * whole-pixel scales only (a 32 px Mk2 sheet at half in a 16 box). */
export function slotPreview(ui: UI, slot: SkinSlot, skin: string | null, x: number, y: number, size: number) {
  const name = skin ? skinArt(skin, slot) : null;
  const s = name ? sheet(name) : slotSheet(slot);
  const img = s.rows ? s.rows[0][0] : s.frames[0];
  if (!img) return;
  const big = Math.max(s.w, s.h);
  const k = big <= size ? Math.floor(size / big) : 1 / Math.ceil(big / size);
  const w = Math.round(s.w * k), h = Math.round(s.h * k);
  ui.ctx.drawImage(img, Math.round(x + (size - w) / 2), Math.round(y + (size - h) / 2), w, h);
}

// ------------------------------------------------------------------ the page

/** Bramble's line on the shelf. */
function brambleLine(have: number, all: number, tab: ShelfTab): string {
  if (tab === 'bonuses') return 'Every sticker adds a little rule. Small ones. Capped!';
  if (tab === 'wardrobe') return 'Dress them up! It changes nothing. It changes everything.';
  if (have === 0) return 'An empty page! Go win me a sticker, ribbit.';
  if (have >= all) return 'Every sticker! The whole island salutes you!';
  return 'Each sticker gives a little bonus, for good.';
}

export function shelfPage(app: App, r: Rect) {
  const ui = app.ui;
  const g = app.game;
  const have = TROPHIES.filter((t) => trophyEarned(g, t)).length;
  const sideW = Math.min(190, Math.floor(r.w * 0.34));
  const title = 'The Trophy Shelf';
  const { body, detail, free } = menuTemplate(app, r, { title, accent: T.coin, icon: 'trophies', tabs: backTabs(app), detail: sideW });
  titleChip(app, r, title, free, `${have} of ${TROPHIES.length}`, 'coin');
  // the first opening lands on the first group with a sticker still to earn
  if (!st.opened) {
    st.opened = true;
    const gs = shelfGroups();
    st.tab = GROUP_DEFS.find((d) => d.id !== 'hidden' && gs[d.id].some((t) => !trophyEarned(g, t)))?.id ?? 'act1';
  }
  // ---- the index down the left edge
  const IW = body.w >= 360 ? 80 : 72;
  indexColumn(app, body.x, body.y, IW, body.h);
  const page: Rect = { x: body.x + IW + 7, y: body.y, w: body.w - IW - 7, h: body.h };
  ui.ctx.fillStyle = rgba(T.paperEdge, 0.5);
  ui.ctx.fillRect(page.x - 4, page.y, 1, page.h);
  const dp = detail!;
  if (st.tab === 'bonuses') { bonusesPage(app, page); bonusesSide(app, dp, have); return; }
  if (st.tab === 'wardrobe') { wardrobePage(app, page); wardrobeSide(app, dp); return; }
  const list = shelfGroups()[st.tab] ?? [];
  const hovered = stickerGrid(app, list, page);
  trophySide(app, dp, list, hovered, have);
}

/** One row of the index: its label, its count at the right, the open one on a lit band. */
export function indexRow(app: App, id: string, x: number, y: number, w: number, h: number, labelS: string, count: string, on: boolean, done: boolean, tip: string): boolean {
  const ui = app.ui;
  ui.mark(id, x, y, w, h);
  ui.region(x, y, w, h, 'button');
  const hov = ui.hover(x, y, w, h);
  if (on || hov) {
    ui.fill(x, y, w, h, on ? T.paperHi : rgba(T.paperLo, 0.6));
    if (on) ui.fill(x, y, 2, h, T.coin);
  }
  const cw = count ? smallWidth(count) + 3 : 0;
  ui.text(ellipsize(labelS, w - 6 - cw), x + 4, y + Math.floor((h - 9) / 2) + 1, on ? T.ink : T.inkSoft);
  if (count) ui.small(count, x + w - 2, y + Math.floor((h - 5) / 2), done ? T.good : T.inkSoft, { align: 'right' });
  if (hov) {
    ui.tip([{ text: `{big:${labelS}}` }, { text: tip }], 170);
    if (ui.clicked) { ui.eat(); ui.sfx('click'); return true; }
  }
  return false;
}

function indexColumn(app: App, x: number, y: number, w: number, h: number) {
  const g = app.game;
  const gs = shelfGroups();
  const rows = GROUP_DEFS.length + 2;
  const rh = Math.max(13, Math.min(16, Math.floor((h - 8) / rows)));
  let yy = y;
  for (const d of GROUP_DEFS) {
    const list = gs[d.id] ?? [];
    const n = list.filter((t) => trophyEarned(g, t)).length;
    if (indexRow(app, 'shelf:' + d.id, x, yy, w, rh - 1, d.label, `${n}/${list.length}`, st.tab === d.id, n === list.length, d.tip)) { st.tab = d.id; st.focus = null; }
    yy += rh;
  }
  yy += 3;
  rule(app.ui, x + 2, yy - 2, w - 4, true);
  yy += 2;
  const owned = ownedCosmetics(g).length;
  if (indexRow(app, 'shelf:bonuses', x, yy, w, rh - 1, 'Bonuses', '', st.tab === 'bonuses', false, 'what the shelf adds up to · each kind capped')) st.tab = 'bonuses';
  yy += rh;
  if (indexRow(app, 'shelf:wardrobe', x, yy, w, rh - 1, 'Wardrobe', owned ? String(owned) : '', st.tab === 'wardrobe', false, 'skins for every kind · worn here')) st.tab = 'wardrobe';
}

/** The group's stickers in a grid, then the closest still to earn. Returns the one hovered. */
function stickerGrid(app: App, list: TrophyDef[], page: Rect): TrophyDef | null {
  const ui = app.ui;
  const g = app.game;
  const progress = (t: TrophyDef) => Math.min(1, trophyValue(g, t) / t.n);
  let cell = 34;
  const rowsFor = (c: number) => Math.ceil(list.length / Math.max(1, Math.floor(page.w / c)));
  while (cell > 28 && rowsFor(cell) * cell > page.h * 0.62) cell -= 2;
  const cols = Math.max(1, Math.floor(page.w / cell));
  const x0 = page.x + Math.floor((page.w - cols * cell) / 2), y0 = page.y + 1;
  let hovered: TrophyDef | null = null;
  list.forEach((t, i) => {
    const cx = x0 + (i % cols) * cell, cy = y0 + Math.floor(i / cols) * cell;
    if (cy + cell > page.y + page.h) return;
    const earned = trophyEarned(g, t);
    ui.region(cx, cy, cell, cell, 'button', false);
    const ctx = ui.ctx;
    ctx.fillStyle = rgba(T.paperLo, 0.8);
    ctx.fillRect(cx + 2, cy + cell - 2, cell - 4, 1);
    ctx.fillRect(cx + cell - 2, cy + 2, 1, cell - 4);
    const R = Math.min(13, Math.floor(cell / 2) - 3);
    const ccx = cx + Math.floor(cell / 2), ccy = cy + Math.floor(cell / 2) - 1;
    if (t.hidden && !earned) mystery(ui, ccx, ccy, R);
    else sticker(app, t, ccx, ccy, earned, TROPHIES.indexOf(t), R);
    const hv = ui.hover(cx, cy, cell, cell);
    ui.mark('trophy:' + t.id, cx, cy, cell, cell);
    if (!earned && !t.hidden && progress(t) > 0) meter(ui, cx + 6, cy + cell - 7, cell - 12, 3, progress(t), { role: 'coin', glint: false });
    if (st.focus === t.id) penCircle(ui, ccx, ccy, 15, 1);
    if (hv) {
      hovered = t;
      if (st.focus !== t.id) penCircle(ui, ccx, ccy, 15, Math.floor(ui.time * 2.5) % 3);
      if (ui.clicked) { ui.eat(); ui.sfx('click'); st.focus = st.focus === t.id ? null : t.id; }
    }
  });
  // under the stickers: the closest ones of this group still to earn
  const gridH = Math.ceil(list.length / cols) * cell;
  let y = y0 + gridH + 6;
  const next = list.filter((t) => !trophyEarned(g, t) && !t.hidden).map((t) => ({ t, f: progress(t) })).sort((p, q) => q.f - p.f);
  if (next.length && y + 30 <= page.y + page.h) {
    rule(ui, page.x, y - 3, page.w, true);
    y += caption(ui, 'almost there', page.x + 2, y);
    const two = page.w >= 300;
    const cw = two ? Math.floor((page.w - 14) / 2) : page.w - 4;
    const rowH = 22;
    const fit = Math.floor((page.y + page.h - y) / rowH) * (two ? 2 : 1);
    next.slice(0, Math.max(0, fit)).forEach(({ t, f }, i) => {
      const col = two ? i % 2 : 0, row = two ? Math.floor(i / 2) : i;
      const rx = page.x + 2 + col * (cw + 10), ry = y + row * rowH;
      const pct = `${Math.floor(f * 100)}%`;
      ui.text(ellipsize(t.name, cw - textWidth(pct) - 6), rx, ry, T.ink);
      ui.text(pct, rx + cw, ry, T.coin, { align: 'right' });
      // the goal gets the row's whole width (beside a meter it was cut mid-word: "by han"), and the
      // meter runs under it
      ui.clip(rx, ry + 10, cw, 10);
      drawRich(ui, t.desc, rx, ry + 10, Infinity, T.inkSoft);
      ui.unclip();
      meter(ui, rx, ry + 19, cw, 3, f, { role: 'coin', glint: false });
      ui.hint(rx, ry, cw, rowH - 2, [{ text: `{big:${t.name}}` }, { text: t.desc }, { text: trophyFace(t, false).bonus }], 190);
      if (ui.hover(rx, ry, cw, rowH - 2) && ui.clicked) { ui.eat(); st.focus = t.id; }
    });
  }
  return hovered;
}

/** A hidden trophy's place: a dashed ring with a question mark in it. */
function mystery(ui: UI, cx: number, cy: number, R: number) {
  const ctx = ui.ctx;
  const steps = Math.ceil(2 * Math.PI * (R - 1));
  ctx.fillStyle = rgba(T.inkSoft, 0.45);
  for (let k = 0; k < steps; k++) {
    if (k % 4 >= 2) continue;
    const a = (k / steps) * Math.PI * 2;
    ctx.fillRect(Math.round(cx + Math.cos(a) * (R - 1)), Math.round(cy + Math.sin(a) * (R - 1)), 1, 1);
  }
  ui.big('?', cx, cy - 5, T.inkSoft, { align: 'center' });
}

/** The right page on a group: Bramble, the sticker in hand (clicked, hovered, else the closest),
 * its condition, its progress and its bonus; the latest stickers along the foot. */
function trophySide(app: App, dp: Rect, list: TrophyDef[], hovered: TrophyDef | null, have: number) {
  const ui = app.ui;
  const g = app.game;
  const dx = dp.x + 4, dw = dp.w - 8;
  let dy = dp.y + 2;
  dy += speaker(app, 'bramble', brambleLine(have, TROPHIES.length, st.tab), dx, dy, dw) + 8;
  const closest = list.filter((t) => !trophyEarned(g, t) && !t.hidden).sort((p, q) => trophyValue(g, q) / q.n - trophyValue(g, p) / p.n)[0];
  const picked: TrophyDef | undefined = st.focus ? TROPHY[st.focus] : undefined;
  let focus: TrophyDef | null = list.length ? list[list.length - 1] : null;
  if (closest) focus = closest;
  if (picked) focus = picked;
  if (hovered) focus = hovered;
  const footH = 34;
  const end = dp.y + dp.h - footH;
  if (focus && dy + 60 <= end) {
    const earned = trophyEarned(g, focus);
    const face = trophyFace(focus, earned);
    const big = dw >= 150 && dp.h >= 200;
    const SR = big ? 20 : 15;
    if (focus.hidden && !earned) mystery(ui, dx + SR + 1, dy + SR, SR);
    else sticker(app, focus, dx + SR + 1, dy + SR, earned, TROPHIES.indexOf(focus), SR);
    const nx = dx + SR * 2 + 7, nw = dw - SR * 2 - 7;
    if (bigWidth(face.name) <= nw) ui.big(face.name, nx, dy + 2, T.ink);
    else ui.text(ellipsize(face.name, nw), nx, dy + 3, T.ink);
    drawRich(ui, earned ? '{chip:good:EARNED}' : focus.hidden ? '{chip:soft:HIDDEN}' : '{chip:soft:TO EARN}', nx, dy + 16, nw, T.ink);
    dy += SR * 2 + 6;
    if (dy + richHeight(face.desc, dw) <= end) dy += drawRich(ui, face.desc, dx, dy, dw, T.ink) + 4;
    if (!(focus.hidden && !earned) && dy + 12 <= end) {
      const v = Math.min(focus.n, trophyValue(g, focus));
      const s = `${Math.floor(v).toLocaleString('en-US')}/${focus.n.toLocaleString('en-US')}`;
      meter(ui, dx, dy + 2, dw - textWidth(s) - 6, 6, earned ? 1 : v / focus.n, { role: earned ? 'good' : 'coin' });
      ui.text(s, dx + dw, dy, earned ? T.good : T.ink, { align: 'right' });
      dy += 14;
    }
    // the bonus: what it gives (or gives already), in the shelf's own words
    if (dy + 22 <= end) {
      caption(ui, earned ? 'its bonus, yours for good' : 'its bonus', dx, dy, earned ? T.good : T.coin);
      dy += 9;
      const bh = richHeight(face.bonus, dw);
      if (dy + bh <= end) dy += drawRich(ui, face.bonus, dx, dy, dw, earned ? T.ink : T.inkSoft) + 4;
    }
  }
  // the latest stickers, along the page's foot
  const latest = TROPHIES.filter((t) => trophyEarned(g, t)).slice(-Math.max(1, Math.floor((dw - 2) / 24)));
  if (latest.length && dy + 4 <= end + 4) {
    const fy = dp.y + dp.h - 30;
    rule(ui, dx, fy - 4, dw, true);
    caption(ui, 'latest on the shelf', dx, fy);
    latest.forEach((t, i) => sticker(app, t, dx + 11 + i * 24, fy + 18, true, TROPHIES.indexOf(t), 10));
  }
}

// ------------------------------------------------------------------ Bonuses

/** One bonus row: an icon and name at the left, the sum at the right, a meter of it against its cap
 * under (no meter for a kind without a cap). Returns the height. */
function bonusRow(ui: UI, x: number, y: number, w: number, name: string, value: string, frac: number | null, capS: string): number {
  const vw = richWidth(value);
  ui.clip(x, y, w - vw - 4, 11);
  drawRich(ui, name, x, y, Infinity, T.ink);
  ui.unclip();
  drawRich(ui, value, x + w, y, Infinity, frac !== null && frac <= 0 ? T.inkSoft : T.ink, { align: 'right' });
  if (frac !== null) {
    const cw = smallWidth(capS) + 4;
    meter(ui, x, y + 12, w - cw, 4, frac, { role: frac >= 1 ? 'good' : 'coin', glint: false });
    ui.small(capS, x + w, y + 11, frac >= 1 ? T.good : T.inkSoft, { align: 'right' });
  } else ui.small(capS, x + w, y + 11, T.inkSoft, { align: 'right' });
  return 20;
}

function bonusesPage(app: App, page: Rect) {
  const ui = app.ui;
  const g = app.game;
  const r = trules(g);
  const x = page.x + 2, w = page.w - 4;
  let y = page.y + 1;
  y += caption(ui, ['every trophy\'s bonus, summed, each kind capped', 'every bonus summed, each kind capped', 'summed, each capped'].find((q) => smallWidth(q.toUpperCase()) <= w) ?? '', x, y) + 2;
  const two = w >= 300;
  const cw = two ? Math.floor((w - 12) / 2) : w;
  const rows: [string, string, number | null, string][] = [];
  const speeds = Object.entries(r.speed) as [ItemId, number][];
  rows.push(['{u:fold} crafts faster', speeds.length ? `${speeds.length} product${speeds.length === 1 ? '' : 's'}` : '{soft:none yet}', null, `+${Math.round(TROPHY_CAPS.speed * 100)}% EACH AT MOST`]);
  const frees = Object.entries(r.free) as [string, number][];
  rows.push(['{u:build} buildings free', frees.length ? `${frees.reduce((a, [, n]) => a + n, 0)} free` : '{soft:none yet}', null, 'THE FIRST N OF A KIND']);
  rows.push(['{u:district} skiffs a route', `+${r.skiffs}`, r.skiffs / TROPHY_CAPS.skiffs, `CAP +${TROPHY_CAPS.skiffs}`]);
  rows.push(['{u:district} routes a floor', `+${r.routes}`, r.routes / TROPHY_CAPS.routes, `CAP +${TROPHY_CAPS.routes}`]);
  rows.push(['{u:blueprint} Drawer slots', `+${r.drawer}`, r.drawer / TROPHY_CAPS.drawer, `CAP +${TROPHY_CAPS.drawer}`]);
  rows.push(['{u:star} Sparks stay', `+${r.sparkLife} s`, r.sparkLife / TROPHY_CAPS.sparkLife, `CAP +${TROPHY_CAPS.sparkLife} S`]);
  rows.push(['{i:slag} Slag Heaps hold', `+${r.heap}`, r.heap / TROPHY_CAPS.heap, `CAP +${TROPHY_CAPS.heap}`]);
  rows.push(['{u:overdrive} Overdrive cools', `${r.cool} s sooner`, r.cool / TROPHY_CAPS.cool, `CAP ${TROPHY_CAPS.cool} S`]);
  rows.push(['{u:relocate} ruins repair', `${Math.round(r.repair * 100)}% off`, r.repair / TROPHY_CAPS.repair, `CAP ${Math.round(TROPHY_CAPS.repair * 100)}%`]);
  rows.push(['{u:chute} the Chute holds', `+${r.chuteRoom}`, r.chuteRoom / TROPHY_CAPS.chute, `CAP +${TROPHY_CAPS.chute}`]);
  rows.push(['{coin} each run starts', `{coin:${r.startCoin.toLocaleString('en-US')}}`, null, 'AFTER A RESET']);
  const skins = TROPHIES.filter((t) => t.bonus.k === 'cosmetic');
  rows.push(['{u:trophies} skins from trophies', `${skins.filter((t) => trophyEarned(g, t)).length}/${skins.length}`, null, 'IN THE WARDROBE']);
  const per = two ? Math.ceil(rows.length / 2) : rows.length;
  const bottom = page.y + page.h;
  rows.forEach(([n, v, f, c], i) => {
    const col = two ? Math.floor(i / per) : 0, row = two ? i % per : i;
    const ry = y + row * 22;
    if (ry + 20 > bottom) return;
    bonusRow(ui, x + col * (cw + 12), ry, cw, n, v, f === null ? null : Math.min(1, f), c);
  });
  y += per * 22 + 4;
  // the products sped up and the buildings made free, as chips
  const chips: string[] = [...speeds.map(([it, a]) => `{i:${it}} +${Math.round(a * 100)}%`), ...frees.map(([k, n]) => `${n > 1 ? n + ' ' : ''}${(BUILD as Record<string, { name: string }>)[k]?.name ?? k}${n > 1 ? 's' : ''} free`)];
  if (chips.length && y + 22 <= bottom) {
    rule(ui, x, y - 2, w, true);
    y += caption(ui, 'the products and the buildings', x, y + 1) + 2;
    let cx = x;
    for (const c of chips) {
      const cw2 = chipWidth(c);
      if (cx + cw2 > x + w) { cx = x; y += 15; }
      if (y + 13 > bottom) break;
      chip(ui, cx, y, c, { role: c.includes('%') ? 'coin' : 'good' });
      cx += cw2 + 4;
    }
  }
}

function bonusesSide(app: App, dp: Rect, have: number) {
  const ui = app.ui;
  const g = app.game;
  const dx = dp.x + 4, dw = dp.w - 8;
  let dy = dp.y + 2;
  dy += speaker(app, 'bramble', brambleLine(have, TROPHIES.length, 'bonuses'), dx, dy, dw) + 8;
  dy += ledgerRow(ui, '{u:trophies} {soft:trophies}', `${have} of ${TROPHIES.length}`, dx, dy, dw);
  dy += ledgerRow(ui, '{soft:hidden found}', `${TROPHIES.filter((t) => t.hidden && trophyEarned(g, t)).length} of ${TROPHIES.filter((t) => t.hidden).length}`, dx, dy, dw) + 6;
  for (const s of ['{u:star} each bonus is about what earned it', '{u:lock} every kind stops at its cap', '{u:clock} kept through every reset', '{soft:never a bonus on the trophy count}']) {
    const h = richHeight(s, dw);
    if (dy + h > dp.y + dp.h) break;
    dy += drawRich(ui, s, dx, dy, dw, T.ink) + 3;
  }
}

// ------------------------------------------------------------------ the Wardrobe

/** The skins owned that fit a slot, and the ones not yet owned. */
export function skinsFor(app: App, slot: SkinSlot): { owned: CosmeticDef[]; locked: CosmeticDef[] } {
  const owned = ownedCosmetics(app.game).filter((c) => c.slots.includes(slot));
  const ids = new Set(owned.map((c) => c.id));
  const locked = COSMETICS.filter((c) => c.slots.includes(slot) && !ids.has(c.id));
  return { owned, locked };
}

const CELL = 26;

function wardrobePage(app: App, page: Rect) {
  const ui = app.ui;
  const g = app.game;
  const x = page.x + 2, w = page.w - 4;
  let y = page.y + 1;
  y += caption(ui, 'every kind a skin can dress, click one', x, y) + 2;
  if (!st.slot || !SKIN_SLOTS.includes(st.slot)) st.slot = SKIN_SLOTS.find((s) => skinsFor(app, s).owned.length) ?? SKIN_SLOTS[0];
  const cols = Math.max(1, Math.floor(w / CELL));
  const x0 = x + Math.floor((w - cols * CELL) / 2);
  SKIN_SLOTS.forEach((slot, i) => {
    const cx = x0 + (i % cols) * CELL, cy = y + Math.floor(i / cols) * CELL;
    if (cy + CELL > page.y + page.h) return;
    const { owned } = skinsFor(app, slot);
    const worn = skinFor(g, slot);
    const on = st.slot === slot;
    const hov = ui.hover(cx, cy, CELL - 2, CELL - 2);
    ui.region(cx, cy, CELL - 2, CELL - 2, 'button', false);
    ui.mark('wardrobe:' + slot, cx, cy, CELL - 2, CELL - 2);
    ui.fill(cx, cy, CELL - 2, CELL - 2, on ? T.ink : owned.length ? T.paperEdge : rgba(T.paperEdge, 0.4));
    ui.fill(cx + 1, cy + 1, CELL - 4, CELL - 4, on ? C.lamp3 : hov ? T.paperHi : owned.length ? T.paper : rgba(T.paperLo, 0.5));
    ui.ctx.globalAlpha = owned.length ? 1 : 0.45;
    slotPreview(ui, slot, worn, cx + 4, cy + 4, 16);
    ui.ctx.globalAlpha = 1;
    if (owned.length) ui.small(String(owned.length), cx + CELL - 4, cy + CELL - 9, worn ? T.good : T.inkSoft, { align: 'right' });
    if (worn) ui.fill(cx + 2, cy + 2, 3, 3, T.coin);
    if (hov) {
      ui.tip([{ text: `{big:${slotName(slot)}}` }, { text: worn ? `wears ${cosmeticDef(worn)?.name ?? worn}` : owned.length ? `${owned.length} skin${owned.length === 1 ? '' : 's'} to wear` : '{soft:no skin yet}' }], 160);
      if (ui.clicked) { ui.eat(); ui.sfx('click'); st.slot = slot; }
    }
  });
  y += Math.ceil(SKIN_SLOTS.length / cols) * CELL + 4;
  // what is worn now, as chips
  const worn = SKIN_SLOTS.filter((s) => skinFor(g, s)).map((s) => `${slotName(s)}: ${cosmeticDef(skinFor(g, s)!)?.name ?? '?'}`);
  if (y + 24 <= page.y + page.h) {
    rule(ui, x, y - 2, w, true);
    y += caption(ui, 'worn now', x, y + 1) + 2;
    if (!worn.length) ui.text('Nothing yet: every kind is plain.', x, y, T.inkSoft);
    let cx = x;
    for (const c of worn) {
      const cw = chipWidth(c);
      if (cx + cw > x + w) { cx = x; y += 15; }
      if (y + 13 > page.y + page.h) break;
      chip(ui, cx, y, c, { role: 'coin' });
      cx += cw + 4;
    }
  }
}

/** The right page of the Wardrobe: the slot picked, its preview as worn, Plain and the skins owned
 * as keys (the one worn lit), then the ones still to earn and where they come from. */
function wardrobeSide(app: App, dp: Rect) {
  const ui = app.ui;
  const g = app.game;
  const slot = st.slot ?? SKIN_SLOTS[0];
  const dx = dp.x + 4, dw = dp.w - 8;
  let dy = dp.y + 2;
  const worn = skinFor(g, slot);
  // the preview at 2x on a mount
  ui.fill(dx, dy, 36, 36, T.ink);
  ui.fill(dx + 1, dy + 1, 34, 34, T.paperHi);
  slotPreview(ui, slot, worn, dx + 2, dy + 2, 32);
  const nx = dx + 42, nw = dw - 42;
  const name = slotName(slot);
  if (bigWidth(name) <= nw) ui.big(name, nx, dy + 2, T.ink);
  else ui.text(ellipsize(name, nw), nx, dy + 3, T.ink);
  const wornName = worn ? cosmeticDef(worn)?.name ?? worn : 'Plain';
  ui.text(ellipsize(wornName, nw), nx, dy + 17, worn ? T.coin : T.inkSoft);
  dy += 42;
  const { owned, locked } = skinsFor(app, slot);
  dy += caption(ui, owned.length ? 'wear' : 'no skin for it yet', dx, dy);
  const keys: (CosmeticDef | null)[] = [null, ...owned];
  const end = dp.y + dp.h;
  if (owned.length) for (const c of keys) {
    if (dy + 16 > end) break;
    const on = (c?.id ?? null) === worn;
    const tip = c ? [{ text: `{big:${c.name}}` }, { text: c.flavor }, { text: skinArt(c.id, slot) ? '{k:LMB} wear it' : '{soft:its art is still being drawn: the plain sprite stands in}' }] : [{ text: '{big:Plain}' }, { text: 'the building\'s own look' }];
    if (button(ui, 'wear_' + (c?.id ?? 'plain'), dx, dy, dw, 15, c ? c.name : 'Plain', { active: on, tip }) && !on) {
      if (app.act({ k: 'skin', kind: slot, id: c?.id ?? null }).ok) app.audio.sfx('place', 0.6);
    }
    dy += 17;
  }
  if (locked.length && dy + 20 <= end) {
    dy += 3;
    dy += caption(ui, 'still to earn', dx, dy);
    for (const c of locked) {
      if (dy + 10 > end) break;
      const s = `{u:lock} ${c.name} {soft:· ${cosmeticSource(app, c)}}`;
      ui.clip(dx, dy, dw, 11);
      drawRich(ui, s, dx, dy, Infinity, T.ink);
      ui.unclip();
      ui.hint(dx, dy, dw, 10, [{ text: `{big:${c.name}}` }, { text: c.flavor }, { text: `{soft:${cosmeticSource(app, c)}}` }], 190);
      dy += 11;
    }
  }
  void hasArt; void ITEMS; void pencil; void LINE_H;
}
