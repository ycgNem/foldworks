// Act II's pages in the notebook (DESIGN.md §18; docs/hud-180.md "Full-screen menus"): Unit 7's
// Codex (every item a specimen pinned to the page, a first delivery paying 30x once Unit 7 likes
// you), the Survey Office (a deed slip per ore: what holds its claims, blocks to buy) and the
// Megaproject (the Great Drill's Bay pasted in large, what its stage still wants with meters and
// ETAs, and the stamp and confetti when a stage is done). Ink on paper, the cast talking in
// bubbles. Reads the Game; acts through App.act.
import { C, rgba } from '../data/palette';
import { ITEMS, ITEM_IDS, type ItemId } from '../data/items';
import { CHUNKS, FACTORY, PATCHES, WORKSHOP } from '../data/land';
import { RULES } from '../data/rules';
import { MEGA, megaStage, MEGAS, MEGA_IDS, type MegaId } from '../data/megaprojects';
import { megaStageOf } from '../sim/systems/high';
import { RECIPE } from '../data/recipes';
import { RESEARCH } from '../data/research';
import { ICON, textWidth, smallWidth, bigWidth, ellipsize, wrapText, LINE_H } from '../ui/font';
import { itemIcon, sheet, hasArt, frameNamed } from '../render/sprites';
import { bayFrame, megaFrac, mainOutput } from '../render/factory';
import { claimsHeld, claimsUsed, claimPrice, copiesOf, oresOf } from '../sim/systems/claims';
import { megaOpen } from '../sim/systems/modules';
import { Num } from '../engine/num';
import { button, meter, chip, chipWidth, rule, pencil, slip, stamp, ribbon, pushpin, portrait, T, type Role } from './chrome';
import { menuTemplate, fmt, perMin, slamScale, rays, cells, type MenuTab } from './widgets';
import { openOrders } from './orders';
import { CUSTOMERS, ORDERS } from '../data/orders';
import { offeredOrders, orderFrac } from '../sim/systems/orders';
import { confetti } from './fold';
import { speaker, caption, ledgerRow, pencilIcon, tickStamp, penCircle } from './screens';
import type { App } from './app';
import type { Rect } from '../ui/ui';
import { drawRich, richWidth, richHeight, CHIP_H } from '../ui/rich';

/** A chip beside a page's title, when the header has room for it. */
function titleChip(app: App, r: Rect, title: string, free: number, text: string, role: Role) {
  const w = chipWidth(text);
  if (free < w + 8) return;
  chip(app.ui, r.x + 29 + bigWidth(title) + 6, r.y + Math.floor((20 - CHIP_H) / 2) + 2, text, { role });
}

// ------------------------------------------------------------------ the Codex

/** Items the Codex can log: the ones the Dock pays for (slag, kits and drill bits never sell). */
export const CODEX_ITEMS = ITEM_IDS.filter((id) => ITEMS[id].value > 0);

/** Unit 7's line on its Codex (ALL CAPS, clipped, counting). */
function unit7Line(app: App, open: boolean): string {
  const logged = app.game.s.codex;
  const mult = RULES.codexMult.value;
  if (!open) return `FILL ONE ORDER FOR UNIT 7. THEN FIRSTS PAY ${mult}X.`;
  if (CODEX_ITEMS.every((id) => logged.includes(id))) return 'COLLECTION COMPLETE. UNIT 7 IS... MOVED.';
  const newest = logged[logged.length - 1];
  if (!newest) return 'COLLECTION EMPTY. BRING UNIT 7 A FIRST.';
  return `NEW SPECIMEN: ${ITEMS[newest].name.toUpperCase()}. COLLECTION ${Math.round((logged.length / CODEX_ITEMS.length) * 100)}%. PLEASING.`;
}

export function codexScreen(app: App, r: Rect) {
  const ui = app.ui;
  const g = app.game;
  const logged = g.s.codex;
  const open = g.s.orders.rep.unit7 >= 1;
  const title = 'The Codex';
  const side = r.w >= 600 ? 200 : 150;
  const { body, detail, free } = menuTemplate(app, r, { title, accent: T.research, icon: 'codex', detail: side });
  titleChip(app, r, title, free, `${logged.length} of ${CODEX_ITEMS.length}`, 'research');
  const mult = RULES.codexMult.value;
  // the specimens: every item pinned to the page
  const n = ITEM_IDS.length;
  let cols = Math.max(2, Math.floor((body.w + 4) / 100));
  let rows = Math.ceil(n / cols);
  while (rows > 1 && Math.floor((body.h + 3) / rows) - 3 < 27 && cols < 8) { cols++; rows = Math.ceil(n / cols); }
  const cw = Math.floor((body.w + 4) / cols) - 4;
  const ch = Math.min(56, Math.floor((body.h + 3) / rows) - 3);
  const newest = logged[logged.length - 1];
  let hovered: ItemId | null = null;
  ITEM_IDS.forEach((id, i) => {
    const x = body.x + (i % cols) * (cw + 4), y = body.y + Math.floor(i / cols) * (ch + 3);
    if (specimen(app, id, x, y, cw, ch, id === newest, mult)) hovered = id;
  });
  // the right page: Unit 7, the collection, the specimen in hand, what is worth chasing
  const dp = detail!;
  const x = dp.x + 4, w = dp.w - 8;
  let y = dp.y + 2;
  y += speaker(app, 'unit7', unit7Line(app, open), x, y, w) + 6;
  const paid = logged.reduce((s, id) => s + ITEMS[id].value * mult, 0);
  const left = CODEX_ITEMS.filter((id) => !logged.includes(id)).reduce((s, id) => s + ITEMS[id].value * mult, 0);
  const f = logged.length / CODEX_ITEMS.length;
  caption(ui, 'the collection', x, y);
  ui.big(`${Math.round(f * 100)}%`, x + w, y - 2, T.research, { align: 'right' });
  y += 11;
  meter(ui, x, y, w, 6, f, { role: 'research' });
  y += 10;
  y += ledgerRow(ui, '{soft:paid so far}', `{coin:${Num.of(paid).format()}}`, x, y, w);
  y += ledgerRow(ui, '{soft:still to find}', `{coin:${Num.of(left).format()}}`, x, y, w) + 6;
  const focus: ItemId | null = hovered ?? newest ?? CODEX_ITEMS[0] ?? null;
  const end = dp.y + dp.h;
  if (focus && y + 44 <= end) {
    const it = ITEMS[focus];
    const isLogged = logged.includes(focus);
    const payable = it.value > 0;
    const pays = it.value * mult;
    // the specimen large, on its mount
    ui.fill(x, y, 36, 36, T.ink);
    ui.fill(x + 1, y + 1, 34, 34, T.paperHi);
    ui.ctx.drawImage(itemIcon(focus), x + 2, y + 2, 32, 32);
    if (isLogged) pushpin(ui, x + 18, y + 1);
    const nx = x + 42, nw = w - 42;
    if (bigWidth(it.name) <= nw) ui.big(it.name, nx, y + 2, T.ink);
    else ui.text(ellipsize(it.name, nw), nx, y + 3, T.ink);
    drawRich(ui, isLogged ? '{chip:good:CATALOGUED}' : payable ? `{chip:coin:FIRST PAYS ${mult}×}` : '{chip:soft:NOT SOLD}', nx, y + 17, nw, T.ink);
    y += 40;
    y += ui.para(it.flavor, x, y, w, T.ink) + 4;
    const rowsF: [string, string][] = [
      [`{i:${focus}} {soft:at the Dock}`, payable ? `{coin:${fmt(it.value)}}` : '{bad:refused}'],
      [`{soft:first delivery}`, payable ? (isLogged ? `{good:${ICON.check}} {coin:${Num.of(pays).format()}}` : `{coin:${Num.of(pays).format()}}`) : '{soft:never pays}'],
      [`{soft:delivered}`, g.s.delivered[focus] ? g.s.delivered[focus]!.format() : '{soft:never}'],
    ];
    for (const [k, v] of rowsF) {
      if (y + LINE_H > end) break;
      y += ledgerRow(ui, k, v, x, y, w);
    }
    y += 5;
  }
  // what is worth chasing: the uncatalogued, dearest first
  const chase = CODEX_ITEMS.filter((id) => !logged.includes(id)).sort((p, q) => ITEMS[q].value - ITEMS[p].value);
  if (open && chase.length && y + 22 <= end) {
    y += caption(ui, 'worth chasing', x, y, T.research);
    let xx = x;
    for (const id of chase) {
      const s = `{i:${id}} {coin:${Num.of(ITEMS[id].value * mult).format()}}`;
      const sw = richWidth(s);
      if (xx + sw > x + w) {
        y += 12;
        xx = x;
        if (y + 10 > end) break;
      }
      drawRich(ui, s, xx, y, Infinity, T.ink);
      xx += sw + 6;
    }
  }
}

/** One specimen pinned to the Codex page. Returns true while hovered. */
function specimen(app: App, id: ItemId, x: number, y: number, w: number, h: number, isNew: boolean, mult: number): boolean {
  const ui = app.ui;
  const g = app.game;
  const ctx = ui.ctx;
  const it = ITEMS[id];
  const logged = g.s.codex.includes(id);
  const payable = it.value > 0;
  const pays = Num.of(it.value * mult).format();
  const hov = ui.hover(x, y, w, h);
  ui.region(x, y, w, h, 'panel', false);
  ui.mark('codex:' + id, x, y, w, h);
  // the card: a mounted specimen, or its place pencilled in
  if (logged) {
    ctx.fillStyle = rgba(T.shadow, 0.3);
    ctx.fillRect(x + 1, y + 1, w, h);
    ui.fill(x, y, w, h, T.paperEdge);
    ui.fill(x + 1, y + 1, w - 2, h - 2, hov ? C.lamp3 : T.paperHi);
  } else {
    ctx.fillStyle = rgba(T.paperEdge, 0.5);
    for (let i = 0; i < w; i += 3) { ctx.fillRect(x + i, y, Math.min(2, w - i), 1); ctx.fillRect(x + i, y + h - 1, Math.min(2, w - i), 1); }
    for (let j = 0; j < h; j += 3) { ctx.fillRect(x, y + j, 1, Math.min(2, h - j)); ctx.fillRect(x + w - 1, y + j, 1, Math.min(2, h - j)); }
  }
  const my = y + Math.min(4, Math.floor((h - 18) / 2));
  if (logged) {
    ui.fill(x + 3, my, 18, 18, T.ink);
    ui.fill(x + 4, my + 1, 16, 16, T.paper);
    ctx.drawImage(itemIcon(id), x + 4, my + 1, 16, 16);
  } else pencilIcon(ui, 'item:' + id, itemIcon(id), x + 4, my + 1, 16, payable ? T.inkSoft : T.paperEdge);
  const tx = x + 25, tw = x + w - 3 - tx;
  ui.clip(tx, y, tw, h);
  ui.text(ellipsize(it.name, tw - (logged ? 13 : 0)), tx, my, logged ? T.ink : T.inkSoft);
  const val = logged ? `{coin:+${pays}}` : payable ? `{coin:${pays}}` : tw >= 60 ? '{chip:soft:NOT SOLD}' : '{soft:no sale}';
  drawRich(ui, val, tx, my + 11, Infinity, T.ink);
  ui.unclip();
  // the first-delivery note, a chip at the right of the value when it fits
  if (!logged && payable) {
    const ns = `${mult}×`;
    const nw = chipWidth(ns);
    if (richWidth(val) + nw + 6 <= tw) chip(ui, x + w - 3 - nw, my + 10, ns, { role: 'coin' });
  }
  // the flavour, one line, when the card is tall enough
  if (h >= 46) {
    ui.clip(x + 3, y, w - 6, h);
    ui.text(ellipsize(it.flavor, w - 8), x + 4, y + h - 12, logged ? T.inkSoft : rgba(T.inkSoft, 0.8));
    ui.unclip();
  }
  if (logged) tickStamp(ui, x + w - 14, y + 2);
  // the newest: FIRST! stamped across its corner, a glint running over it
  if (isNew && logged) {
    stamp(ui, 'FIRST!', x + w - 24, h >= 46 ? y + h - 9 : my + 15, { angle: -0.18, alpha: 0.9 });
    const gl = (ui.time * 0.8) % 2;
    if (gl < 1) ui.fill(x + 3 + Math.floor(gl * (w - 8)), y + 2, 2, h - 4, C.bone, 0.35);
  }
  if (hov) penCircle(ui, x + 12, my + 9, 12, Math.floor(ui.time * 2.5) % 3);
  return hov;
}

// ------------------------------------------------------------------ the Survey Office

const ORES: ItemId[] = ['ironOre', 'copperOre', 'coal', 'sand'];
const ORE_TILE: Partial<Record<ItemId, string>> = { ironOre: 'tile_ore_iron', copperOre: 'tile_ore_copper', coal: 'tile_ore_coal', sand: 'tile_ore_sand' };
const ORE_COL: Partial<Record<ItemId, string>> = { ironOre: C.iron1, copperOre: C.copper1, coal: C.hull0, sand: C.brass1 };

export function surveyScreen(app: App, r: Rect) {
  const ui = app.ui;
  const mapW = r.w >= 480 ? 140 : 0;
  const { body, detail } = menuTemplate(app, r, { title: 'The Survey Office', accent: T.good, icon: 'survey', detail: mapW || undefined });
  const x = body.x + 2, w = body.w - 4;
  let y = body.y + 2;
  // the rule, in the mayor's mouth
  y += speaker(app, 'bramble', 'Ore never runs out! Each digging module copy holds a claim.', x, y, w) + 5;
  const ores = ORES.filter((o) => PATCHES.some((p) => p.item === o));
  const bottom = body.y + body.h;
  const rh = Math.min(60, Math.floor((bottom - y + 4) / ores.length) - 4);
  ores.forEach((ore, i) => deed(app, ore, x, y + i * (rh + 4), w, rh));
  if (detail) depositMap(app, detail);
}

/** An ore's deed: its deposit tile, its claims used of held and where they come from, the next
 * block's price and the button, and the modules holding them. */
function deed(app: App, ore: ItemId, x: number, y: number, w: number, h: number) {
  const ui = app.ui;
  const g = app.game;
  const ctx = ui.ctx;
  const c = slip(ui, x, y, w, h, { blocking: true });
  // the ore's deposit tile, like a stamp on the deed
  const ts = ORE_TILE[ore];
  const ty = c.y + Math.max(0, Math.floor((c.h - 34) / 2) - 2);
  ui.fill(c.x - 1, ty - 1, 34, 34, T.ink);
  if (ts && hasArt(ts)) ctx.drawImage(sheet(ts).frames[0], c.x, ty, 32, 32);
  else ui.fill(c.x, ty, 32, 32, ORE_COL[ore] ?? C.hull1);
  ctx.drawImage(itemIcon(ore), c.x + 23, ty + 23);
  const held = claimsHeld(g, ore), used = claimsUsed(g, ore);
  const deps = PATCHES.filter((p) => p.item === ore && g.owned(p.x, p.y)).length;
  const blocks = g.s.claimBlocks[ore] ?? 0;
  const left = c.x + 39;
  const right = c.x + c.w;
  const buyW = Math.min(96, Math.max(80, Math.floor(c.w * 0.26)));
  const midR = right - buyW - 8;
  // the name, and the claims as a chip
  ui.big(ITEMS[ore].name, left, c.y, T.ink);
  const freeN = held - used;
  const [ft, fr]: [string, Role] = freeN > 0 ? [`${freeN} FREE`, 'good'] : freeN === 0 ? ['ALL IN USE', 'warn'] : [`${-freeN} OVER`, 'bad'];
  const cs = `${used}/${held} claims`;
  const csW = textWidth(cs);
  const fw = chipWidth(ft);
  ui.text(cs, midR - fw - 6, c.y + 1, freeN >= 0 ? T.ink : T.bad, { align: 'right' });
  chip(ui, midR - fw, c.y - 1, ft, { role: fr, solid: freeN < 0 });
  void csW;
  cells(app, left, c.y + 13, midR - left, 6, used, held, freeN >= 0 ? T.goodFill : T.badFill);
  // where the claims come from, as a sum
  const pd = RULES.claimsPerDeposit.value, pb = RULES.claimsPerBlock.value;
  const long = `{soft:${RULES.claimsBase.value} start} + ${deps} {soft:deposit${deps === 1 ? '' : 's'}} ×${pd} + ${blocks} {soft:block${blocks === 1 ? '' : 's'}} ×${pb}`;
  const sum = richWidth(long) <= midR - left ? long : `{soft:${RULES.claimsBase.value}} + ${deps} {u:survey}×${pd} + ${blocks} {u:claim}×${pb}`;
  ui.clip(left, c.y + 21, midR - left, 11);
  drawRich(ui, sum, left, c.y + 22, Infinity, T.ink);
  ui.unclip();
  ui.hint(left, c.y + 21, midR - left, 11, [{ text: `{big:${held} ${ITEMS[ore].name} claims}` }, { text: long }], 220);
  // the next block and Buy
  const price = claimPrice(g, ore);
  const bx = right - buyW;
  if (price) {
    const afford = g.s.coin.gte(price);
    const ps = `{coin:${price.format()}}`;
    if (smallWidth('NEXT BLOCK') + 6 + richWidth(ps) <= buyW) caption(ui, 'next block', bx, c.y + 1);
    else if (smallWidth('NEXT') + 6 + richWidth(ps) <= buyW) caption(ui, 'next', bx, c.y + 1);
    drawRich(ui, ps, right, c.y, Infinity, afford ? T.coin : T.bad, { align: 'right' });
    const why = !g.done('surveying') ? `{u:research} ${RESEARCH.surveying.name} first` : !afford ? `needs {coin:${price.format()}}` : null;
    if (button(ui, 'claim:' + ore, bx, c.y + 11, buyW, 16, `Buy ${pb} claims`, { gold: !why, disabled: !!why, tip: why ?? [{ text: `{big:${pb} ${ITEMS[ore].name} claims}` }, { text: `{coin:${price.format()}}  {soft:each later block} +50% {soft:of the first}` }] })) app.act({ k: 'claim', item: ore });
    if (why && c.y + 40 <= c.y + c.h + 2) {
      ui.clip(bx, c.y + 29, buyW, 10);
      drawRich(ui, why, bx + buyW / 2, c.y + 29, Infinity, T.bad, { align: 'center' });
      ui.unclip();
    }
  }
  // which designs hold them
  const holders = g.s.designs.filter((d) => (oresOf(g, d)[ore] ?? 0) > 0 && copiesOf(g, d) > 0);
  const hy = c.y + 33;
  if (hy + 10 > c.y + c.h + 3) return;
  let hx = left;
  hx += ui.text('held by', hx, hy, T.inkSoft) + 5;
  if (!holders.length) ui.text('nothing yet', hx, hy, T.inkSoft);
  for (const d of holders) {
    const n = copiesOf(g, d) * (oresOf(g, d)[ore] ?? 1);
    const lab = `${d.name} ×${n}`;
    const lw = 11 + textWidth(lab) + 8;
    if (hx + lw > midR) { ui.text('...', hx, hy, T.inkSoft); break; }
    ctx.drawImage(sheet('module').frames[0], hx, hy - 1, 9, 9);
    const out = mainOutput(g, d.id);
    if (out) ctx.drawImage(itemIcon(out), hx + 1, hy, 7, 7);
    ui.text(lab, hx + 11, hy, T.ink);
    ui.hint(hx, hy - 1, lw - 4, 10, [{ text: `{big:${d.name}}` }, { text: `${copiesOf(g, d)} {soft:copies, spare and placed} · {i:${ore}} ×${oresOf(g, d)[ore] ?? 1} {soft:each}` }], 180);
    hx += lw;
  }
}

/** The Workshop's deposits on a little map (owned land lit, ore patches in their colours), the
 * deposits owned by ore, the claim blocks bought and the next prices, and land for sale. */
function depositMap(app: App, page: Rect) {
  const ui = app.ui;
  const g = app.game;
  const x = page.x + 4, w = page.w - 8;
  let y = page.y + 2;
  ui.big('Deposits', x, y, T.ink);
  y += 15;
  const k = Math.max(2, Math.floor(w / WORKSHOP.w));
  const mw = WORKSHOP.w * k, mh = WORKSHOP.h * k;
  const mx = x + Math.floor((w - mw) / 2), my = y + 1;
  ui.fill(mx - 1, my - 1, mw + 2, mh + 2, T.ink);
  for (const c of CHUNKS) {
    const own = g.s.land.includes(c.id);
    ui.fill(mx + c.x * k, my + c.y * k, c.w * k, c.h * k, own ? C.ground1 : C.shadow);
    ui.fill(mx + c.x * k, my + c.y * k, c.w * k, 1, T.ink);
    ui.fill(mx + c.x * k, my + c.y * k, 1, c.h * k, T.ink);
    if (!own) ui.small(c.id, mx + c.x * k + (c.w * k) / 2, my + c.y * k + (c.h * k) / 2 - 2, C.hull2, { align: 'center' });
  }
  for (const p of PATCHES) {
    const own = g.owned(p.x, p.y);
    const pulse = own && Math.floor(ui.time * 2 + p.x) % 4 === 0;
    ui.ctx.globalAlpha = own ? 1 : 0.45;
    ui.fill(mx + p.x * k, my + p.y * k, p.w * k, p.h * k, pulse ? C.bone : ORE_COL[p.item] ?? C.hull2);
    ui.ctx.globalAlpha = 1;
    ui.hint(mx + p.x * k, my + p.y * k, p.w * k, p.h * k, [{ text: `{i:${p.item}} {big:${ITEMS[p.item].name}}` }, { text: own ? `{good:yours} +${RULES.claimsPerDeposit.value} claims` : `{soft:buy its land} +${RULES.claimsPerDeposit.value} claims` }], 150);
  }
  y = my + mh + 5;
  const end = page.y + page.h;
  for (const ore of ORES) {
    if (y + 10 > end) break;
    const own = PATCHES.filter((p) => p.item === ore && g.owned(p.x, p.y)).length;
    const all = PATCHES.filter((p) => p.item === ore).length;
    ui.fill(x, y + 2, 6, 6, T.ink);
    ui.fill(x + 1, y + 3, 4, 4, ORE_COL[ore] ?? C.hull2);
    ui.text(ITEMS[ore].name, x + 9, y, T.ink);
    ui.text(`${own}/${all}`, x + w, y, own ? T.good : T.inkSoft, { align: 'right' });
    rule(ui, x, y + 10, w);
    y += 11;
  }
  // the price list: blocks bought and the next block's price, by ore
  if (y + 24 <= end) {
    y += 4;
    caption(ui, 'claim blocks', x, y, T.good);
    caption(ui, 'next', x + w, y, T.inkSoft, 'right');
    y += 9;
    for (const ore of ORES) {
      if (y + 10 > end) break;
      const pr = claimPrice(g, ore);
      ui.ctx.drawImage(itemIcon(ore), x, y + 1);
      ui.text(`${g.s.claimBlocks[ore] ?? 0} bought`, x + 10, y, T.ink);
      drawRich(ui, pr ? `{coin:${pr.format()}}` : '-', x + w, y, Infinity, pr && g.s.coin.gte(pr) ? T.coin : T.inkSoft, { align: 'right' });
      y += 11;
    }
  }
  const forSale = CHUNKS.find((c) => !g.s.land.includes(c.id) && (!c.requires || g.done(c.requires)) && PATCHES.some((p) => p.x >= c.x && p.x < c.x + c.w && p.y >= c.y && p.y < c.y + c.h));
  if (forSale) {
    const s = `{u:workshop} ${forSale.name} {soft:for sale} {coin:${fmt(forSale.cost)}}`;
    const sh = richHeight(s, w);
    if (y + 4 + sh <= end) drawRich(ui, s, x, y + 4, w, T.ink);
  }
}

// ------------------------------------------------------------------ the Megaproject

let landedAt = -1;

// ---- Act III (DESIGN.md §21): Megaprojects #2 and #3 beside the Great Drill, one tab each

/** which project the page shows */
const megaTab = { id: 'drill' as 'drill' | MegaId };
/** Show a project's tab (the e2e states). */
export function setMegaTab(id: 'drill' | MegaId) { megaTab.id = id; }

/** Act III's projects are on the page once Act III opens (the Drill's stage 3) or one has begun. */
function act3Megas(app: App): boolean {
  const g = app.game;
  return (g.s.mega.stage ?? 0) >= 3 || g.done('zoning') || MEGA_IDS.some((m) => g.done(MEGAS[m].opens as never) || !!g.s.megas?.[m]);
}

/** Act IV's projects (DESIGN.md §22: the Lighthouse, the Sky Anchor) are on the page once the World
 * is charted, their research is done or one of them has begun (their progress is kept). */
function act4Mega(app: App, m: MegaId): boolean {
  const g = app.game;
  return MEGAS[m].floor !== 'world' || g.done('charting') || g.done(MEGAS[m].opens as never) || !!g.s.megas?.[m];
}

/** The page's tabs: the Great Drill, the Floating City, the Scrap Transmuter (none before Act III),
 * the Lighthouse and the Sky Anchor (Act IV). */
function megaTabs(app: App): MenuTab[] {
  if (!act3Megas(app)) return [];
  const short: Record<MegaId, string> = { city: 'Floating City', transmuter: 'Transmuter', lighthouse: 'Lighthouse', anchor: 'Sky Anchor' };
  return [
    { id: 'mtab_drill', label: 'Great Drill', icon: 'mega', tip: '{u:mega} Megaproject #1 · the Factory Bay', active: megaTab.id === 'drill', onClick: () => { megaTab.id = 'drill'; } },
    ...MEGA_IDS.filter((m) => act4Mega(app, m)).map((m): MenuTab => ({
      id: 'mtab_' + m, label: short[m], icon: 'mega',
      tip: MEGAS[m].floor === 'world' ? `{u:world} ${MEGAS[m].name} · the World Bay · a stage on each island` : `{u:district} ${MEGAS[m].name} · the District Bay`,
      active: megaTab.id === m, onClick: () => { megaTab.id = m; },
    })),
  ];
}

export function megaScreen(app: App, r: Rect) {
  const ui = app.ui;
  const g = app.game;
  const tabs = megaTabs(app);
  if (!tabs.length || (megaTab.id !== 'drill' && !tabs.some((t) => t.id === 'mtab_' + megaTab.id))) megaTab.id = 'drill';
  if (megaTab.id !== 'drill' && MEGAS[megaTab.id].anyOrder) return worldProjectPage(app, r, megaTab.id, tabs);
  if (megaTab.id !== 'drill') return projectPage(app, r, megaTab.id, tabs);
  const stage = megaStage(g.s.mega.stage);
  const doneStage = MEGA.find((m) => m.stage === g.s.mega.stage) ?? null;
  const t = ui.time - app.gradeAt;
  const celebrate = g.s.mega.stage >= 1 && t < 12 && t >= 0;
  const side = Math.floor(r.w * 0.4);
  const title = tabs.length ? 'Megaprojects' : stage ? stage.name : doneStage ? doneStage.name : 'The Megaproject';
  const { body, detail, free } = menuTemplate(app, r, { title: bigWidth(title) > r.w * 0.45 ? 'The Great Drill' : title, accent: T.coin, icon: 'mega', detail: side, tabs: tabs.length ? tabs : undefined });
  if (!stage && doneStage && !tabs.length) titleChip(app, r, bigWidth(title) > r.w * 0.45 ? 'The Great Drill' : title, free, 'COMPLETE', 'good');
  // the left page: what the stage wants (or the celebration)
  if (stage) wants(app, stage, body);
  else complete(app, body, celebrate, t);
  // the right page: the Bay pasted in large, the stage track, where the Bay stands
  bayPage(app, detail!);
}

/** The right page: the Bay's picture at a whole scale, the three stages as chips, the rule that
 * the Drill's progress is kept, and the Factory floor in miniature with the Bay lit. */
function bayPage(app: App, page: Rect) {
  const ui = app.ui;
  const g = app.game;
  const ctx = ui.ctx;
  const x = page.x + 4, w = page.w - 8;
  const big = hasArt('mega_stage1');
  const S0 = big ? 48 : 32;
  const k = Math.max(1, Math.min(5, Math.floor(Math.min(page.h - 80, w - 12) / S0)));
  const P = S0 * k;
  const ax = x + Math.floor((w - P) / 2), ay = page.y + 6;
  // the picture: a night sky over the pad, pasted to the page with a paper border and tape
  ctx.fillStyle = rgba(T.shadow, 0.35);
  ctx.fillRect(ax - 3, ay - 3, P + 9, P + 9);
  ui.fill(ax - 5, ay - 5, P + 10, P + 10, T.paperHi);
  ui.fill(ax - 1, ay - 1, P + 2, P + 2, T.ink);
  ui.clip(ax, ay, P, P);
  ui.fill(ax, ay, P, P, C.shadow);
  for (let i = 0; i < 24; i++) {
    const sx = ax + ((i * 53) % P), sy = ay + ((i * 29) % Math.max(1, Math.floor(P / 2)));
    if (Math.sin(ui.time * 2 + i) > 0.3) ui.fill(sx, sy, 1, 1, i % 3 ? C.hull2 : C.hot);
  }
  if (g.s.mega.stage >= 1) rays(app, ax + P / 2, ay + P / 2, P, C.gold, 14);
  if (big) {
    const st = sheet('mega_stage1');
    const flip = Math.floor(ui.time * (st.fps || 4)) % 2;
    const fi = g.s.mega.stage >= 1 ? 8 + flip : 2 * Math.min(3, Math.floor(megaFrac(g) * 4)) + flip;
    ctx.drawImage(st.frames[fi], ax, ay, P, P);
  } else ctx.drawImage(sheet('mega_bay').frames[bayFrame(g, ui.time)], ax, ay, P, P);
  ui.unclip();
  ctx.fillStyle = rgba(C.lamp3, 0.7);
  ctx.fillRect(ax - 8, ay - 7, 14, 4);
  ctx.fillRect(ax + P - 6, ay - 7, 14, 4);
  let y = ay + P + 9;
  // the three stages, as chips in a row
  const sw = Math.floor((w - 8) / 3);
  for (let s = 1; s <= 3; s++) {
    const sx = x + (s - 1) * (sw + 4);
    const done = g.s.mega.stage >= s, cur = g.s.mega.stage + 1 === s && !!megaStage(g.s.mega.stage);
    const shut = cur && !megaOpen(g, megaStage(g.s.mega.stage)!);
    const lab = done ? `${ICON.check} ${s}` : cur && !shut ? (textWidth(`Stage ${s}`) + 8 <= sw ? `Stage ${s}` : `${s}`) : `${ICON.lock} ${s}`;
    const role: Role = done ? 'good' : cur ? (shut ? 'reset' : 'coin') : 'soft';
    const cwid = chipWidth(lab);
    chip(ui, sx + Math.floor((sw - cwid) / 2), y, lab, { role, solid: done || (cur && !shut) });
    if (cur) pencil(ui, sx + 2, y + CHIP_H + 1, sw - 4, T.bad);
    const m = MEGA[s - 1];
    if (m) ui.hint(sx, y, sw, CHIP_H, [{ text: `{big:${m.name}}` }, { text: m.reward }, ...(m.rep ? [{ text: `{reset:opens at the Committee's reputation} ${m.rep}` }] : [])], 190);
  }
  y += CHIP_H + 6;
  const keep = g.s.mega.stage >= 1 ? '{good:the drill runs} · {reset:kept through every reset}' : '{reset:kept through every reset}';
  if (y + 10 <= page.y + page.h) y += drawRich(ui, keep, x + w / 2, y, w, T.ink, { align: 'center' }) + 6;
  // the Factory floor in miniature, the Bay lit in its corner
  if (page.y + page.h - y >= 16 + FACTORY.h * 2) bayMap(app, x, y, w, page.y + page.h - y);
}

function bayFeeds(app: App): Partial<Record<ItemId, number>> {
  const g = app.game;
  const out: Partial<Record<ItemId, number>> = {};
  for (const rt of g.routes) {
    if (rt.to?.kind !== 'fbay' || rt.by) continue;
    const it = mainOutput(g, rt.from.design);
    const last = rt.tiles[rt.tiles.length - 1];
    if (it && last) out[it] = (out[it] ?? 0) + last.flow;
  }
  return out;
}

function wants(app: App, stage: NonNullable<ReturnType<typeof megaStage>>, page: Rect) {
  const ui = app.ui;
  const g = app.game;
  // the Milestone 5-6 final round: a stage behind the Committee's reputation is the Committee's
  // to open, so the page's call to action is their orders, not the trunks
  if (stage.rep && !megaOpen(g, stage)) {
    lockedStage(app, stage, page);
    return;
  }
  const x = page.x + 2, w = page.w - 4;
  const bay = g.s.factory.ents.find((e) => e.kind === 'fbay');
  const feeds = bayFeeds(app);
  const end = page.y + page.h - 19;
  let y = page.y + 2;
  ui.big('Wanted', x, y, T.ink);
  caption(ui, 'by trunk into the bay', x + bigWidth('Wanted') + 8, y + 3);
  y += 16;
  const ents = Object.entries(stage.wants) as [ItemId, number][];
  const rowH = 26;
  let slowest = 0;
  for (const [it, want] of ents) {
    const have = Math.min(want, Math.floor(g.s.mega.progress[it]?.toNumber() ?? 0));
    const f = have / want;
    const done = f >= 1;
    ui.fill(x, y, 20, 20, T.ink);
    ui.fill(x + 1, y + 1, 18, 18, done ? C.lily : T.paperHi);
    ui.ctx.drawImage(itemIcon(it), x + 2, y + 2, 16, 16);
    const nx = x + 25;
    ui.text(ITEMS[it].name, nx, y, done ? T.good : T.ink);
    const rate = feeds[it];
    const rx = nx + textWidth(ITEMS[it].name) + 6;
    if (rate) chip(ui, rx, y - 2, `+${perMin(rate)}/min`, { role: 'good' });
    else if (!done) chip(ui, rx, y - 2, 'NOT ARRIVING', { role: 'warn', solid: true });
    ui.text(`${fmt(have)} / ${fmt(want)}`, x + w, y, done ? T.good : T.coin, { align: 'right' });
    meter(ui, nx, y + 12, w - 25 - 30, 7, f, { role: done ? 'good' : 'coin' });
    if (done) tickStamp(ui, x + w - 13, y + 9);
    else ui.text(`${Math.floor(f * 100)}%`, x + w, y + 11, T.inkSoft, { align: 'right' });
    if (!done) slowest = Math.max(slowest, rate ? (want - have) / rate : Infinity);
    ui.hint(x, y, w, rowH - 2, rate && !done ? [{ text: `{i:${it}} +${perMin(rate)}/min {soft:arriving}` }, { text: `{u:clock} about ${eta((want - have) / rate)} to go` }] : done ? `{good:${ICON.check} enough} {i:${it}}` : [{ text: `{warn:nothing brings} {i:${it}} {warn:to the Bay}` }, { text: `{u:fold} a module making it · trunk it into the Bay` }], 180);
    rule(ui, x, y + rowH - 4, w);
    y += rowH;
  }
  // the whole stage: a big meter with quarter ticks
  const tf = megaFrac(g);
  caption(ui, `stage ${stage.stage} in all`, x, y + 4);
  ui.big(`${Math.floor(tf * 100)}%`, x + w, y, T.coin, { align: 'right', scale: 2 });
  y += 23;
  meter(ui, x, y, w, 10, tf, { role: 'coin' });
  for (const q of [0.25, 0.5, 0.75]) ui.fill(x + Math.round(w * q), y + 1, 1, 8, tf >= q ? T.brassLo : rgba(T.ink, 0.35));
  y += 14;
  if (y + 12 <= end) {
    const s = slowest === 0 ? `{good:${ICON.check} everything in} · {soft:the drill wakes}` : isFinite(slowest) ? `{u:clock} {soft:done in about} ${eta(slowest)}` : `{chip:warn:NOT ALL ARRIVING}  {soft:trunk the missing in}`;
    drawRich(ui, s, x, y, w, T.ink);
    y += 14;
  }
  // the reward: what it pays, with what you have that it would boost
  const miners = g.miners.length;
  const srcMods = g.s.factory.ents.filter((e) => e.kind === 'module' && Object.keys(oresOf(g, g.design(e.design)!)).length).length;
  if (y + 14 <= end) {
    caption(ui, 'the reward', x, y);
    y += 9;
    const stampW = stage.stage === 1 && w >= 220 ? 50 : 0;
    const th = richHeight(stage.reward, w - 12 - stampW);
    const rh = th + (stage.stage === 1 ? 14 : 0) + 10;
    if (y + rh <= end) {
      const c = slip(ui, x, y, w, rh);
      drawRich(ui, stage.reward, c.x, c.y, c.w - stampW, T.ink);
      if (stage.stage === 1) {
        const ry = c.y + th + 2;
        const minerS = sheet('miner'), modS = sheet('module');
        ui.ctx.drawImage(minerS.frames[Math.floor(ui.time * 6) % minerS.frames.length], c.x, ry - 1, 10, 10);
        const ms = `${miners} Miner${miners === 1 ? '' : 's'}`;
        const mw = ui.text(ms, c.x + 13, ry, T.ink);
        ui.ctx.drawImage(modS.frames[0], c.x + 13 + mw + 10, ry - 1, 10, 10);
        ui.text(`${srcMods} source module${srcMods === 1 ? '' : 's'}`, c.x + 13 + mw + 23, ry, T.ink);
        // a +50% stamp at the right while there is room
        if (w >= 220) stamp(ui, '+50%', c.x + c.w - 22, c.y + 9, { angle: -0.12, scale: 1, alpha: Math.floor(ui.time * 2) % 2 ? 0.95 : 0.8 });
        ui.hint(x, y, w, rh, [{ text: stage.reward }, { text: `{u:workshop} ${miners} Miners · {u:factory} ${srcMods} modules with miners inside` }], 190);
      }
      y += rh + 5;
    }
  }
  // how a Drill Bit is made
  const bit = RECIPE.forgeDrillBit;
  if (bit && y + 11 <= end) {
    const eq = `${bit.inputs.map((inp) => `${inp.n} {i:${inp.item}}`).join(' + ')} → {i:drillBit}  {soft:Assembler} ${bit.time} s`;
    ui.clip(x, y, w, 11);
    drawRich(ui, eq, x, y, Infinity, T.ink);
    ui.unclip();
    y += 12;
  }
  // the drill-bit modules' rate and what holds them back (the Milestone 5-6 review round)
  const bitMods = g.s.factory.ents.filter((e) => e.kind === 'module' && mainOutput(g, e.design) === 'drillBit');
  if (bitMods.length && y + 11 <= end) {
    const rate = bitMods.reduce((s, e) => s + (g.design(e.design)?.outs.drillBit ?? 0) * e.fAvg, 0);
    const slow = bitMods.find((e) => e.state !== 'work' && e.why);
    const why = slow ? (ITEMS[slow.why as ItemId] ? `{i:${slow.why}}` : slow.why ?? '') : '';
    const lim = slow ? (slow.state === 'blocked' ? `{chip:bad:BLOCKED} ${why}` : `{chip:warn:SHORT} ${why}`) : '{good:flat out}';
    drawRich(ui, `{i:drillBit} ${perMin(rate)}/min  ${lim}`, x, y, w, T.ink);
    ui.hint(x, y, w, 11, [{ text: `${bitMods.length} {soft:drill-bit modules · their recent run}` }, { text: slow ? `{soft:the slowest} ${lim}` : '{good:nothing holds them back}' }], 180);
    y += 13;
  }
  // what is arriving now
  const flowing = Object.entries(feeds) as [ItemId, number][];
  if (y + 11 <= end) {
    const s = flowing.length ? `{soft:arriving}  ${flowing.map(([it, r2]) => `{i:${it}} {good:${perMin(r2)}/min}`).join('  ')}` : '{warn:nothing trunked into the Bay yet}';
    ui.clip(x, y, w, 11);
    drawRich(ui, s, x, y, Infinity, T.ink);
    ui.unclip();
    y += 13;
  }
  // the modules feeding it, each with its product and rate
  const feeders = g.routes.filter((rt) => rt.to?.kind === 'fbay' && !rt.by);
  if (feeders.length && y + 22 <= end) {
    caption(ui, 'feeding the bay', x, y, T.coin);
    y += 9;
    for (const rt of feeders) {
      if (y + 11 > end) break;
      const d = g.design(rt.from.design);
      const it = mainOutput(g, rt.from.design);
      const last = rt.tiles[rt.tiles.length - 1];
      ui.ctx.drawImage(sheet('module').frames[0], x, y - 2, 12, 12);
      if (it) ui.ctx.drawImage(itemIcon(it), x + 15, y);
      const rs = last ? `${perMin(last.flow)}/min` : '-';
      ui.clip(x + 26, y, w - 32 - textWidth(rs), 10);
      ui.text(d?.name ?? 'module', x + 26, y, T.ink);
      ui.unclip();
      ui.text(rs, x + w, y, rt.from.state === 'work' ? T.good : T.warn, { align: 'right' });
      y += 11;
    }
  }
  // where it is, or why it isn't there yet
  const by = page.y + page.h - 16;
  if (bay) {
    if (button(ui, 'gotoBay', x, by, w, 16, 'Go to the Bay', { tip: [{ text: '{u:factory} the Factory floor · bottom-left' }, { text: '{u:fold} trunk modules into it' }] })) {
      app.panel = null;
      app.setFloor('factory', true);
      app.lookAt(bay.x + 1, bay.y + 1);
    }
  } else if (g.done('greatDrill')) {
    drawRich(ui, `{bad:clear the corner} · tiles ${FACTORY.bay.x}-${FACTORY.bay.x + 1}, ${FACTORY.bay.y}-${FACTORY.bay.y + 1} {soft:the Bay lands there}`, x, by, w, T.ink);
  } else drawRich(ui, `{u:research} ${RESEARCH.greatDrill.name} {soft:brings the Bay}`, x, by + 3, w, T.ink);
}

/** A stage shut behind the Committee's reputation (the Milestone 5-6 review round's gate, shown
 * as what to do about it in the final round): the Committee's line, its reputation now and
 * needed, the orders it has on offer with their progress, and a key to its tab on the Orders
 * page; what the stage will want once open, quietly, under it. The Bay counts nothing meanwhile,
 * so there is no "not arriving" or ETA to show. */
function lockedStage(app: App, stage: NonNullable<ReturnType<typeof megaStage>>, page: Rect) {
  const ui = app.ui;
  const g = app.game;
  const need = stage.rep ?? 0;
  const rep = g.s.orders.rep.committee ?? 0;
  const x = page.x + 2, w = page.w - 4;
  const end = page.y + page.h - 20;
  let y = page.y + 2;
  ui.big(`Stage ${stage.stage}`, x, y, T.ink);
  chip(ui, x + bigWidth(`Stage ${stage.stage}`) + 6, y - 1, 'SHUT', { role: 'reset', solid: true });
  y += 16;
  y += speaker(app, 'committee', '"psst." "fill our orders." "then we open the drill."', x, y, w) + 5;
  // the Committee's reputation: a pip for each level the stage needs
  const rs = `{reset:${CUSTOMERS.committee.name}} {soft:reputation} ${rep} of ${need}`;
  drawRich(ui, rs, x, y, Infinity, T.ink);
  const px0 = x + richWidth(rs) + 6;
  for (let i = 0; i < need; i++) {
    ui.fill(px0 + i * 10, y + 1, 8, 7, T.ink);
    ui.fill(px0 + i * 10 + 1, y + 2, 6, 5, i < rep ? T.resetFill : T.paperLo);
  }
  y += 13;
  y += drawRich(ui, '{chip:reset:+1 AN ORDER} {soft:kept through every reset}', x, y, w, T.ink) + 3;
  y += drawRich(ui, '{soft:till then} {i:steel} {soft:sells at the Dock} · {i:drillBit} {soft:scrapped}', x, y, w, T.ink) + 6;
  // their orders on offer, the one under way first
  const offered = offeredOrders(g).filter((o) => o.customer === 'committee').sort((a, b) => (b.id === g.s.orders.active ? 1 : 0) - (a.id === g.s.orders.active ? 1 : 0));
  if (y + 10 <= end) y += caption(ui, offered.length ? 'their orders on offer' : 'no orders on offer yet', x, y, T.reset);
  if (!offered.length && y + 10 <= end) {
    const next = ORDERS.find((o) => o.customer === 'committee' && !g.s.orders.done.includes(o.id));
    if (next) {
      const after = next.requires.filter((q) => !g.done(q)).map((q) => `{u:research} ${RESEARCH[q].name}`).join(' · ') || '{soft:the Committee turns up}';
      y += drawRich(ui, `{soft:next} ${next.name} {soft:after} ${after}`, x, y, w, T.ink) + 3;
    }
  }
  for (const o of offered) {
    if (y + 22 > end) break;
    const active = o.id === g.s.orders.active;
    const f = orderFrac(g, o.id);
    ui.text(o.name, x, y, T.ink);
    if (active) pencil(ui, x, y + 9, textWidth(o.name), T.bad);
    const tagS = active ? '{good:under way}' : `+${o.rep} {soft:rep} {coin:${fmt(o.pays)}}`;
    drawRich(ui, tagS, x + w, y, Infinity, T.ink, { align: 'right' });
    let ix = x;
    for (const [it, n] of Object.entries(o.wants) as [ItemId, number][]) {
      const have = Math.min(n, Math.floor(g.s.orders.progress[o.id]?.[it]?.toNumber() ?? 0));
      ui.ctx.drawImage(itemIcon(it), ix, y + 11);
      ix += 11 + ui.small(`${fmt(have)}/${fmt(n)}`, ix + 10, y + 13, T.ink) + 6;
    }
    const mw = Math.min(57, x + w - ix);
    if (mw > 12) meter(ui, x + w - mw, y + 12, mw, 6, f, { role: active ? 'coin' : 'reset', glint: false });
    ui.hint(x, y, w, 21, [{ text: o.pitch }, ...(active ? [] : [{ text: '{u:orders} pick it on the Orders page · any Dock' }])], 190);
    rule(ui, x, y + 21, w);
    y += 24;
  }
  // what the stage wants once open, and what it pays
  if (y + 20 <= end) {
    y += caption(ui, `stage ${stage.stage} once open`, x, y);
    const ws = (Object.entries(stage.wants) as [ItemId, number][]).map(([it, n]) => `${fmt(n)} {i:${it}}`).join('  ');
    y += drawRich(ui, ws, x, y, w, T.ink) + 3;
  }
  // the reward whole or not at all (it must not run under the Committee's key)
  if (y + richHeight(stage.reward, w) <= end) drawRich(ui, stage.reward, x, y, w, T.ink);
  if (button(ui, 'megaCommittee', x, page.y + page.h - 17, w, 17, "The Committee's orders", { gold: true, icon: 'orders', tip: '{u:orders} the Orders page · the Committee' })) openOrders(app, 'committee');
}

function eta(secs: number): string {
  if (!isFinite(secs)) return 'forever';
  return secs >= 3600 ? `${(secs / 3600).toFixed(1)} h` : `${Math.max(1, Math.ceil(secs / 60))} min`;
}

/** The Factory floor in miniature with the Bay lit: where it stands, and the trunks into it. */
function bayMap(app: App, x: number, y: number, w: number, h: number) {
  const ui = app.ui;
  const g = app.game;
  const t = Math.max(2, Math.min(8, Math.floor(Math.min((w - 4) / FACTORY.w, (h - 14) / FACTORY.h))));
  const mw = FACTORY.w * t, mh = FACTORY.h * t;
  const mx = x + Math.floor((w - mw) / 2), my = y + 11;
  caption(ui, 'where the bay stands', x + w / 2, y, T.inkSoft, 'center');
  ui.fill(mx - 2, my - 2, mw + 4, mh + 4, T.ink);
  ui.fill(mx - 1, my - 1, mw + 2, mh + 2, T.brassLo);
  for (let ty = 0; ty < FACTORY.h; ty++) for (let tx = 0; tx < FACTORY.w; tx++) ui.fill(mx + tx * t, my + ty * t, t, t, (tx + ty) % 2 ? C.hull1 : C.hull0);
  const flowsIn = new Set<number>();
  for (const r of g.routes) if (r.to?.kind === 'fbay') for (const q of r.tiles) flowsIn.add(q.id);
  for (const e of g.s.factory.ents) {
    const ex = mx + e.x * t, ey = my + e.y * t;
    if (e.kind === 'trunk') {
      const lit = flowsIn.has(e.id);
      ui.fill(ex + Math.floor(t / 2) - 1, ey + Math.floor(t / 2) - 1, 2, 2, lit ? (Math.floor(ui.time * 4 + e.x) % 2 ? C.gold : C.hot) : C.shadow);
    } else if (e.kind === 'module') {
      ui.fill(ex, ey, t, t, T.ink);
      ui.fill(ex + 1, ey + 1, t - 2, t - 2, C.brass1);
    } else if (e.kind === 'fdock' || e.kind === 'fhopper') {
      ui.fill(ex, ey, e.w * t, e.h * t, T.ink);
      ui.fill(ex + 1, ey + 1, e.w * t - 2, e.h * t - 2, e.kind === 'fdock' ? C.leaf : C.teal0);
    }
  }
  // the Bay: lit gold and breathing, or hazard corners where it will land
  const b = FACTORY.bay;
  const bx = mx + b.x * t, by = my + b.y * t;
  const on = Math.floor(ui.time * 3) % 2 === 0;
  ui.fill(bx - 1, by - 1, 2 * t + 2, 2 * t + 2, on ? C.gold : C.hot);
  ui.fill(bx + 1, by + 1, 2 * t - 2, 2 * t - 2, C.iron0);
  ui.fill(bx + 2, by + 2, 2 * t - 4, 2 * t - 4, C.iron1);
  ui.hint(mx, my, mw, mh, [{ text: '{big:The Megaproject Bay}' }, { text: `{u:factory} bottom-left · tiles ${b.x}-${b.x + 1}, ${b.y}-${b.y + 1}` }, { text: '{coinc:lit dots} {soft:trunks carrying into it}' }], 180);
}

/** The left page once a stage is done: the stamp slams down, rays turn, confetti flies; the stage's
 * ribbon, its reward, what it boosts and the next stage. */
function complete(app: App, page: Rect, celebrate: boolean, t: number) {
  const ui = app.ui;
  const g = app.game;
  const st = MEGA.find((m) => m.stage === g.s.mega.stage);
  const x = page.x + 2, w = page.w - 4;
  const cx = x + Math.floor(w / 2);
  const base = w >= 260 ? 2 : 1;
  const sc = celebrate ? slamScale(t, base) : base;
  if (celebrate && t >= 0.28 && landedAt !== app.gradeAt) {
    landedAt = app.gradeAt;
    app.audio.sfx('gradeS');
    app.renderer.fx.kick(6);
    app.hud.confetti = 90;
  }
  const lab = `STAGE ${g.s.mega.stage} DONE`;
  const sy = page.y + 26;
  ui.clip(page.x, page.y, page.w, page.h);
  rays(app, cx, sy, Math.min(w, 170), celebrate ? C.lamp2 : C.brass2, 16);
  ui.unclip();
  stamp(ui, lab, cx, sy, { scale: sc, angle: -0.07 });
  confetti(app, cx, sy);
  let y = sy + 26;
  if (st) {
    y += ribbon(ui, x + 16, y, w - 32, bigWidth(st.name) <= w - 50 ? st.name : `Stage ${st.stage}`, { color: 'gold' }) + 6;
    y += drawRich(ui, st.reward, cx, y, w - 12, T.ink, { align: 'center' }) + 8;
  }
  const miners = g.miners.length;
  const src = g.s.factory.ents.filter((e) => e.kind === 'module' && Object.keys(oresOf(g, g.design(e.design)!)).length).length;
  const rows: [string, string][] = [
    ['{u:workshop} {soft:Miners running} {good:+50%}', fmt(miners)],
    ['{u:factory} {soft:source modules running} {good:+50%}', fmt(src)],
    ['{coin} {soft:coin earned this run}', `{coinc:${g.s.earned.format()}}`],
  ];
  const rw = Math.min(w - 12, 300), rx = cx - Math.floor(rw / 2);
  for (const [k2, v] of rows) {
    if (y + 12 > page.y + page.h - 40) break;
    y += ledgerRow(ui, k2, v, rx, y, rw);
  }
  const nx = MEGA.find((m) => m.stage === g.s.mega.stage + 1);
  if (nx && y + 14 <= page.y + page.h - 22) drawRich(ui, `{u:mega} {soft:stage ${nx.stage} opens at the Committee's reputation} ${nx.rep ?? 0} · {soft:now} ${g.s.orders.rep.committee ?? 0}`, cx, y + 4, w - 12, T.ink, { align: 'center' });
  if (button(ui, 'megaOk', cx - 60, page.y + page.h - 19, 120, 19, 'Magnificent', { gold: true, big: true, pulse: celebrate })) app.panel = null;
}

// ------------------------------------------------------------------ the Floating City, the Scrap Transmuter

/** What a high floor's routes carry into its Bay now, items a second. */
function districtBayFeeds(app: App, f: 'district' | 'world' = 'district'): Partial<Record<ItemId, number>> {
  const d = app.game.s[f];
  const out: Partial<Record<ItemId, number>> = {};
  if (!d) return out;
  const bay = d.ents.find((e) => e.kind === 'fbay');
  if (!bay) return out;
  for (const rt of d.routes) if (rt.to === bay.id) out[rt.item] = (out[rt.item] ?? 0) + (rt.flow ?? 0);
  return out;
}

/** A project of the District Bay (DESIGN.md §21 Megaprojects #2 and #3): on the left its stages,
 * each with what it wants (meters and arrival rates for the stage under way), its reward and its
 * Patents; on the right its picture (pN = N stages done, run once complete), the stage track, and
 * the stage under way in all. */
function projectPage(app: App, r: Rect, id: MegaId, tabs: MenuTab[]) {
  const ui = app.ui;
  const g = app.game;
  const P = MEGAS[id];
  app.hud.opened.add('mega:' + id);
  const ms = g.s.megas?.[id];
  const done = ms?.stage ?? 0;
  const cur = megaStageOf(g, id);
  const prog = ms?.progress ?? {};
  const open = g.done(P.opens as never);
  const feeds = districtBayFeeds(app);
  const side = Math.floor(r.w * 0.4);
  const { body, detail } = menuTemplate(app, r, { title: 'Megaprojects', accent: T.coin, icon: 'mega', detail: side, tabs });
  const x = body.x + 2, w = body.w - 4;
  const end = body.y + body.h;
  let y = body.y + 2;
  // the name and where it stands
  const [cs, role]: [string, Role] = !cur ? ['COMPLETE', 'good'] : !open ? ['NOT RESEARCHED', 'soft'] : [`STAGE ${cur.stage} OF ${P.stages.length}`, 'coin'];
  const nameW = bigWidth(P.name) <= w - chipWidth(cs) - 8 ? P.name : P.name.replace(/^The /, '');
  ui.big(nameW, x, y, T.ink);
  chip(ui, x + w - chipWidth(cs), y, cs, { role, solid: !cur || open });
  y += 16;
  const bay = g.s.district?.ents.some((e) => e.kind === 'fbay');
  const opener = RESEARCH[P.opens as keyof typeof RESEARCH]?.name ?? P.opens;
  const where = !open ? `{u:research} ${opener} {soft:opens it} · {u:district} {soft:built at the District Bay}`
    : !cur ? '{good:built} · {reset:kept through every reset}'
    : bay ? '{u:district} {soft:routes into the District Bay} · {reset:kept through every reset}' : "{u:district} {soft:its Bay stands in the District's south-west corner}";
  y += drawRich(ui, where, x, y, w, T.ink) + 5;
  for (const st of P.stages) {
    if (y + 24 > end) break;
    const sdone = done >= st.stage, now = cur?.stage === st.stage;
    const nm = st.name.split(': ')[1] ?? `stage ${st.stage}`;
    const head = `Stage ${st.stage}${st.name.includes(': ') ? ` · ${nm}` : ''}`;
    ui.text(head, x, y, sdone ? T.good : now ? T.ink : T.inkSoft);
    if (now && open) pencil(ui, x, y + 9, textWidth(head), T.bad);
    if (sdone) tickStamp(ui, x + textWidth(head) + 4, y - 2);
    drawRich(ui, `{reset:+${st.patents}} {u:patents}`, x + w, y, Infinity, T.ink, { align: 'right' });
    ui.hint(x + w - 30, y - 1, 30, 11, [{ text: `{big:${st.patents} Patents}` }, { text: '{soft:paid at Reorganize as it is delivered}' }], 180);
    y += 12;
    const wants = Object.entries(st.wants) as [ItemId, number][];
    if (now && open) {
      // the stage under way: each part with its meter, the rate arriving, have / want
      for (const [it, want] of wants) {
        if (y + 20 > end) break;
        const have = Math.min(want, Math.floor(prog[it]?.toNumber() ?? 0));
        const f = have / want;
        const ok = f >= 1;
        ui.ctx.drawImage(itemIcon(it), x, y + 1);
        ui.text(ITEMS[it].name, x + 11, y, ok ? T.good : T.ink);
        const rate = feeds[it];
        const rx = x + 11 + textWidth(ITEMS[it].name) + 5;
        if (rate && !ok) chip(ui, rx, y - 2, `+${perMin(rate)}/min`, { role: 'good' });
        else if (!ok && bay) chip(ui, rx, y - 2, 'NOT ARRIVING', { role: 'warn', solid: true });
        ui.text(`${fmt(have)} / ${fmt(want)}`, x + w, y, ok ? T.good : T.coin, { align: 'right' });
        meter(ui, x + 11, y + 11, w - 11, 5, f, { role: ok ? 'good' : 'coin', glint: false });
        ui.hint(x, y, w, 18, rate && !ok ? [{ text: `{i:${it}} +${perMin(rate)}/min {soft:arriving}` }, { text: `{u:clock} about ${eta((want - have) / rate)} to go` }] : ok ? `{good:${ICON.check} enough} {i:${it}}` : [{ text: `{warn:nothing brings} {i:${it}} {warn:to the Bay}` }, { text: '{u:district} route a group making it into the Bay' }], 180);
        y += 19;
      }
    } else {
      const ws = wants.map(([it, n]) => `${sdone ? `{good:${fmt(n)}}` : fmt(n)} {i:${it}}`).join('  ');
      y += drawRich(ui, ws, x, y, w, T.ink) + 2;
    }
    const rw = `{soft:reward} ${st.reward}`;
    if (y + richHeight(rw, w) <= end) y += drawRich(ui, rw, x, y, w, sdone ? T.good : T.ink) + 3;
    rule(ui, x, y, w);
    y += 5;
  }
  // the right page: the picture, the stage track, the stage under way in all
  const dp = detail!;
  const dx = dp.x + 4, dw = dp.w - 8;
  const name = id === 'city' ? 'mega_city' : 'mega_transmuter';
  const S0 = 48;
  const k = Math.max(1, Math.min(5, Math.floor(Math.min(dp.h - 70, dw - 12) / S0)));
  const PX = S0 * k;
  const ax = dx + Math.floor((dw - PX) / 2), ay = dp.y + 6;
  const ctx = ui.ctx;
  ctx.fillStyle = rgba(T.shadow, 0.35);
  ctx.fillRect(ax - 3, ay - 3, PX + 9, PX + 9);
  ui.fill(ax - 5, ay - 5, PX + 10, PX + 10, T.paperHi);
  ui.fill(ax - 1, ay - 1, PX + 2, PX + 2, T.ink);
  if (hasArt(name)) {
    const s = sheet(name);
    const flip = Math.floor(ui.time * (s.fps || 4)) % 2;
    const fi = !cur ? frameNamed(s, flip ? 'run2' : 'run1') : frameNamed(s, `p${Math.min(2, done)}${flip ? 'b' : 'a'}`);
    ctx.drawImage(s.frames[fi], ax, ay, PX, PX);
  } else ui.fill(ax, ay, PX, PX, C.shadow);
  if (!cur) { ui.clip(ax, ay, PX, PX); rays(app, ax + PX / 2, ay + PX / 2, PX, C.gold, 14); ui.unclip(); }
  ctx.fillStyle = rgba(C.lamp3, 0.7);
  ctx.fillRect(ax - 8, ay - 7, 14, 4);
  ctx.fillRect(ax + PX - 6, ay - 7, 14, 4);
  let yy = ay + PX + 9;
  const n = P.stages.length;
  const sw = Math.floor((dw - 4 * (n - 1)) / n);
  P.stages.forEach((st, i) => {
    const sx = dx + i * (sw + 4);
    const sd = done >= st.stage, now = cur?.stage === st.stage;
    const lab = sd ? `${ICON.check} ${st.stage}` : now && open ? (textWidth(`Stage ${st.stage}`) + 8 <= sw ? `Stage ${st.stage}` : `${st.stage}`) : `${ICON.lock} ${st.stage}`;
    const rl: Role = sd ? 'good' : now && open ? 'coin' : 'soft';
    chip(ui, sx + Math.floor((sw - chipWidth(lab)) / 2), yy, lab, { role: rl, solid: sd || (now && open) });
    if (now) pencil(ui, sx + 2, yy + CHIP_H + 1, sw - 4, T.bad);
    ui.hint(sx, yy, sw, CHIP_H, [{ text: `{big:Stage ${st.stage}}` }, { text: st.reward }, { text: `{reset:+${st.patents}} {soft:Patents}` }], 190);
  });
  yy += CHIP_H + 7;
  if (cur && open && yy + 22 <= dp.y + dp.h) {
    let have = 0, need = 0;
    for (const [it, want] of Object.entries(cur.wants) as [ItemId, number][]) { need += want; have += Math.min(want, prog[it]?.toNumber() ?? 0); }
    const f = need ? have / need : 0;
    caption(ui, `stage ${cur.stage} in all`, dx, yy + 3);
    ui.big(`${Math.floor(f * 100)}%`, dx + dw, yy, T.coin, { align: 'right' });
    yy += 14;
    meter(ui, dx, yy, dw, 7, f, { role: 'coin' });
    yy += 12;
  }
  const keep = !cur ? '{good:complete} · its rewards stand for good' : '{reset:kept through every reset}';
  if (yy + 10 <= dp.y + dp.h) drawRich(ui, keep, dx + dw / 2, yy, dw, T.ink, { align: 'center' });
}

// ------------------------------------------------------------------ the Lighthouse, the Sky Anchor

const ISLE_SHORT: Record<string, string> = { home: 'Home', pebble: 'Pebble', cinder: 'Cinder', rime: 'Rime', oldworks: 'Old Works' };

/** A project of the World Bay (DESIGN.md §22 Megaprojects #4 and #5): four stages, one on each
 * island, built in any order where the town stands. On the left each stage with its island: the
 * one here with its meters and arrival rates, one left half built elsewhere with what it holds,
 * the rest with what they want; each with its reward, its Patents and its Legacy. On the right the
 * picture (pN = N stages built, run once all four stand), the islands as a stage track, the stage
 * here in all. */
function worldProjectPage(app: App, r: Rect, id: MegaId, tabs: MenuTab[]) {
  const ui = app.ui;
  const g = app.game;
  const P = MEGAS[id];
  app.hud.opened.add('mega:' + id);
  const ms = g.s.megas?.[id];
  const built = ms?.done ?? [];
  const here = g.s.meta.world ?? 'home';
  const cur = megaStageOf(g, id);
  const open = g.done(P.opens as never) || built.length > 0;
  const feeds = districtBayFeeds(app, 'world');
  const side = Math.floor(r.w * 0.4);
  const { body, detail } = menuTemplate(app, r, { title: 'Megaprojects', accent: T.coin, icon: 'mega', detail: side, tabs });
  const x = body.x + 2, w = body.w - 4;
  const end = body.y + body.h;
  let y = body.y + 2;
  const all = built.length >= P.stages.length;
  const [cs, role]: [string, Role] = all ? ['COMPLETE', 'good'] : !open ? ['NOT RESEARCHED', 'soft'] : [`${built.length} OF ${P.stages.length} BUILT`, 'coin'];
  const nameW = bigWidth(P.name) <= w - chipWidth(cs) - 8 ? P.name : P.name.replace(/^The /, '').replace(/ at the Edge$/, '');
  ui.big(nameW, x, y, T.ink);
  chip(ui, x + w - chipWidth(cs), y, cs, { role, solid: all || open });
  y += 16;
  const bay = g.s.world?.ents.some((e) => e.kind === 'fbay');
  const opener = RESEARCH[P.opens as keyof typeof RESEARCH]?.name ?? P.opens;
  const where = !open ? `{u:research} ${opener} {soft:opens it} · {u:world} {soft:built at the World Bay, a stage on each island}`
    : all ? '{good:built} · {reset:its rewards stand for good}'
    : !cur ? `{u:relocate} {soft:no stage is built on} ${ISLE_SHORT[here]} · {soft:fly to an island with one}`
    : bay ? '{u:world} {soft:routes into the World Bay} · {reset:kept through every reset}' : "{u:world} {soft:its Bay stands in the World's south-west corner}";
  y += drawRich(ui, where, x, y, w, T.ink) + 4;
  for (const st of P.stages) {
    if (y + 22 > end) break;
    const sdone = built.includes(st.stage);
    const now = cur?.stage === st.stage;
    const held = !now && !sdone ? ms?.held?.[st.stage] : undefined;
    const part = st.name.split(', ')[1]?.replace(/ \(.*\)$/, '') ?? `stage ${st.stage}`;
    const isle = ISLE_SHORT[st.world ?? 'home'];
    const head = `${part}`;
    ui.text(head, x, y, sdone ? T.good : now ? T.ink : T.inkSoft);
    let hx = x + textWidth(head) + 4;
    if (now && open) pencil(ui, x, y + 9, textWidth(head), T.bad);
    if (sdone) { tickStamp(ui, hx, y - 2); hx += 14; }
    hx += chip(ui, hx, y - 2, isle, { role: st.world === here ? 'research' : 'soft', icon: 'world' }) + 3;
    drawRich(ui, `{reset:+${st.patents}} {u:patents} {coinc:+${RULES.legacyPerStage.value}} {u:legacy}`, x + w, y, Infinity, T.ink, { align: 'right' });
    ui.hint(x + w - 56, y - 1, 56, 11, [{ text: `{big:${st.patents} Patents · ${RULES.legacyPerStage.value} Legacy}` }, { text: '{soft:Patents at Reorganize as it is delivered · Legacy at the next Relocate}' }], 200);
    void hx;
    y += 12;
    const wants = Object.entries(st.wants) as [ItemId, number][];
    if (now && open) {
      for (const [it, want] of wants) {
        if (y + 19 > end) break;
        const have = Math.min(want, Math.floor(ms?.progress[it]?.toNumber() ?? 0));
        const f = have / want;
        const ok = f >= 1;
        ui.ctx.drawImage(itemIcon(it), x, y + 1);
        ui.text(ITEMS[it].name, x + 11, y, ok ? T.good : T.ink);
        const rate = feeds[it];
        const rx = x + 11 + textWidth(ITEMS[it].name) + 5;
        if (rate && !ok) chip(ui, rx, y - 2, `+${perMin(rate)}/min`, { role: 'good' });
        else if (!ok && bay) chip(ui, rx, y - 2, 'NOT ARRIVING', { role: 'warn', solid: true });
        ui.text(`${fmt(have)} / ${fmt(want)}`, x + w, y, ok ? T.good : T.coin, { align: 'right' });
        meter(ui, x + 11, y + 11, w - 11, 5, f, { role: ok ? 'good' : 'coin', glint: false });
        ui.hint(x, y, w, 18, rate && !ok ? [{ text: `{i:${it}} +${perMin(rate)}/min {soft:arriving}` }, { text: `{u:clock} about ${eta((want - have) / rate)} to go` }] : ok ? `{good:${ICON.check} enough} {i:${it}}` : [{ text: `{warn:nothing brings} {i:${it}} {warn:to the Bay}` }, { text: '{u:world} route a module making it into the World Bay' }], 180);
        y += 18;
      }
    } else {
      let hv = 0, nd = 0;
      const ws = wants.map(([it, n]) => { const got = Math.min(n, held?.[it]?.toNumber() ?? 0); hv += got; nd += n; return `${sdone ? `{good:${fmt(n)}}` : held ? `${fmt(got)}/${fmt(n)}` : fmt(n)} {i:${it}}`; }).join('  ');
      const tail = held && hv > 0 ? `  {coinc:${Math.floor((hv / Math.max(1, nd)) * 100)}% held} {soft:waits there}` : '';
      y += drawRich(ui, ws + tail, x, y, w, T.ink) + 1;
    }
    const rw = `{soft:reward} ${st.reward}`;
    if (y + richHeight(rw, w) <= end) y += drawRich(ui, rw, x, y, w, sdone ? T.good : T.ink) + 2;
    rule(ui, x, y, w);
    y += 4;
  }
  // ---- the right page: the picture, the islands as a stage track, the stage here in all
  const dp = detail!;
  const dx = dp.x + 4, dw = dp.w - 8;
  const name = id === 'lighthouse' ? 'mega_lighthouse' : 'mega_anchor';
  const S0 = 48;
  const k = Math.max(1, Math.min(5, Math.floor(Math.min(dp.h - 74, dw - 12) / S0)));
  const PX = S0 * k;
  const ax = dx + Math.floor((dw - PX) / 2), ay = dp.y + 6;
  const ctx = ui.ctx;
  ctx.fillStyle = rgba(T.shadow, 0.35);
  ctx.fillRect(ax - 3, ay - 3, PX + 9, PX + 9);
  ui.fill(ax - 5, ay - 5, PX + 10, PX + 10, T.paperHi);
  ui.fill(ax - 1, ay - 1, PX + 2, PX + 2, T.ink);
  if (hasArt(name)) {
    const s = sheet(name);
    const flip = Math.floor(ui.time * (s.fps || 4)) % 2;
    const fi = all ? frameNamed(s, flip ? 'run2' : 'run1') : frameNamed(s, `p${Math.min(4, built.length)}${flip ? 'b' : 'a'}`);
    ctx.drawImage(s.frames[fi], ax, ay, PX, PX);
  } else ui.fill(ax, ay, PX, PX, C.shadow);
  if (all) { ui.clip(ax, ay, PX, PX); rays(app, ax + PX / 2, ay + PX / 2, PX, C.gold, 14); ui.unclip(); }
  ctx.fillStyle = rgba(C.lamp3, 0.7);
  ctx.fillRect(ax - 8, ay - 7, 14, 4);
  ctx.fillRect(ax + PX - 6, ay - 7, 14, 4);
  let yy = ay + PX + 9;
  const n = P.stages.length;
  const sw = Math.floor((dw - 3 * (n - 1)) / n);
  P.stages.forEach((st, i) => {
    const sx = dx + i * (sw + 3);
    const sd = built.includes(st.stage), now = cur?.stage === st.stage;
    const isle = ISLE_SHORT[st.world ?? 'home'];
    const lab = sd ? `${ICON.check} ${textWidth(isle) + 18 <= sw ? isle : isle[0]}` : textWidth(isle) + 8 <= sw ? isle : isle.slice(0, 3);
    const rl: Role = sd ? 'good' : now && open ? 'coin' : 'soft';
    chip(ui, sx + Math.max(0, Math.floor((sw - chipWidth(lab)) / 2)), yy, lab, { role: rl, solid: sd || (now && open) });
    if (now) pencil(ui, sx + 2, yy + CHIP_H + 1, sw - 4, T.bad);
    ui.hint(sx, yy, sw, CHIP_H, [{ text: `{big:${st.name}}` }, { text: st.reward }, { text: sd ? '{good:built}' : now ? '{coinc:built here, now}' : ms?.held?.[st.stage] ? '{coinc:half built} · {soft:it waits on its island}' : '{soft:built on its island}' }], 200);
  });
  yy += CHIP_H + 7;
  if (cur && open && yy + 22 <= dp.y + dp.h) {
    let have = 0, need = 0;
    for (const [it, want] of Object.entries(cur.wants) as [ItemId, number][]) { need += want; have += Math.min(want, ms?.progress[it]?.toNumber() ?? 0); }
    const f = need ? have / need : 0;
    caption(ui, `${ISLE_SHORT[here].toLowerCase()} stage in all`, dx, yy + 3);
    ui.big(`${Math.floor(f * 100)}%`, dx + dw, yy, T.coin, { align: 'right' });
    yy += 14;
    meter(ui, dx, yy, dw, 7, f, { role: 'coin' });
    yy += 12;
  }
  const keep = all ? '{good:complete} · its rewards stand for good' : '{reset:kept through every reset and move}';
  if (yy + 10 <= dp.y + dp.h) drawRich(ui, keep, dx + dw / 2, yy, dw, T.ink, { align: 'center' });
}

void wrapText; void portrait;
