// The Endless Ledger (DESIGN.md §23, the Kernel node of that name), a page of the notebook in the
// orders' hand: the Committee keeps a ledger that never ends. The open order big (its product at
// 2x, how many it wants, a bar of what the Docks have given it, what it pays), then how many orders
// until the next cosmetic and what it is, the orders filled so far and the next few in turn (linear:
// order n wants n + 1 times a base, never timed). The right page is the shelf of cosmetics owned,
// each skin shown as its `skin_<id>_<kind>` sprites where the sheet exists (gilded Miners, candy
// Presses, starlit Assemblers), a ribbon drawn in code for the numbered ones after them, and the
// next one traced in pencil; at its foot, the Wardrobe (Milestone 11: the Trophy Shelf's page, where
// skins are worn; a building's report has a Skin key too). Before
// the node is owned the page says what it would do and points at the Kernel tree. Presentation only.
import { C } from '../data/palette';
import { ITEMS } from '../data/items';
import { LEDGER, LEDGER_RULES, LEDGER_COSMETICS } from '../data/kernels';
import { Num } from '../engine/num';
import { BIG_H, ICON, bigWidth, textWidth, smallWidth } from '../ui/font';
import { layoutRich, drawLayout, drawRich, richWidth } from '../ui/rich';
import { T } from '../ui/theme';
import { ribbonRaw } from '../ui/paper';
import { sheet, hasArt, itemIcon } from '../render/sprites';
import { currentLedger, ledgerFrac, ledgerOpen, ledgerOrder, ledgerState, nextCosmetic, cosmeticAt } from '../sim/systems/ledger';
import { button, chip, chipWidth, meter, rule } from './chrome';
import { shelfTab } from './shelf';
import { menuTemplate, type IconName } from './widgets';
import { pencilIcon } from './screens';
import { bookArea, speak, heading, ROW_H } from './ledger';
import { registerMenu } from './topbar';
import { registerScreen } from './screens';
import type { App } from './app';
import type { Rect } from '../ui/ui';

/** What each skin dresses (the sheets the art drew: `skin_<id>_<kind>`). */
const SKIN_KINDS = ['miner', 'press', 'press_mk2', 'assembler', 'assembler_mk2'];
const SKIN_NAME: Record<string, string> = { gilded: 'Gilded', candy: 'Candy', starlit: 'Starlit' };
const SKIN_WHAT: Record<string, string> = { gilded: 'Miners in gold leaf', candy: 'Presses in candy stripes', starlit: 'Assemblers under the stars' };

/** A cosmetic's name in words: a skin's, or a numbered ribbon's. */
export function cosmeticName(id: string): string {
  if (SKIN_NAME[id]) return `${SKIN_NAME[id]} skin`;
  const m = /^ribbon(\d+)$/.exec(id);
  return m ? `Ribbon no. ${m[1]}` : id;
}

/** The sheets a skin has art for. */
function skinSheets(id: string): string[] {
  return SKIN_KINDS.map((k) => `skin_${id}_${k}`).filter((n) => hasArt(n));
}

const fmt = (n: number) => Num.of(n).format();

function ledgerScreen(app: App, r0: Rect) {
  const ui = app.ui;
  const g = app.game;
  const r = bookArea(r0);
  const { body, detail } = menuTemplate(app, r, { title: 'The Endless Ledger', accent: C.moss5, icon: 'ledger' as IconName, detail: Math.max(150, Math.min(196, Math.floor(r.w * 0.34))) });
  const open = ledgerOpen(g);
  const L = ledgerState(g);
  const o = currentLedger(g);
  let y = body.y;
  const tb = layoutRich('{u:kernel} Kernel tree').w + 14;
  if (button(ui, 'ledgerToKernels', body.x + body.w - tb, y - 1, tb, 15, '{u:kernel} Kernel tree', { tip: '{u:kernel} the Kernel tree' })) app.panel = 'kernels';
  const filled = `${L.n} filled`;
  if (bigWidth('Order') + chipWidth(filled) + 8 < body.w - tb) chip(ui, body.x, y, filled, { role: 'soft' });
  y += 16;
  const say = !open ? 'This ledger opens with its Kernel node. Then it never closes.'
    : L.n === 0 ? 'The first order. After it, another. And another. We never run out of paper.'
    : o.cosmetic ? 'This one pays a little extra. Something to wear.'
    : 'Next order. The Committee thanks you, again, for ever.';
  y += speak(app, 'committee', say, body.x, y, body.w, { size: 24 }) + 6;
  // ---- the open order
  const cardH = 62;
  ui.panel(body.x + 2, y, body.w - 4, cardH, 'paper', true);
  const cx = body.x + 8, cw = body.w - 16;
  let cy = y + 5;
  ui.fill(cx - 1, cy - 1, 34, 34, T.ink);
  ui.fill(cx, cy, 32, 32, T.paperHi);
  ui.ctx.drawImage(itemIcon(o.item), cx + 8, cy + 8, 16, 16);
  const tx = cx + 40, tw = cw - 40;
  ui.big(`Order ${o.n + 1}`, tx, cy, T.ink);
  const ps = `{coin:${fmt(o.pays)}}`;
  if (bigWidth(`Order ${o.n + 1}`) + richWidth(ps) + 10 <= tw) drawRich(ui, ps, tx + tw, cy + 2, Infinity, T.ink, { align: 'right' });
  cy += BIG_H + 3;
  const have = Math.min(o.want, L.progress[o.item]?.toNumber() ?? 0);
  // on one line: the longest wording that fits (the sum is the tip's)
  const nm = ITEMS[o.item].name.toLowerCase();
  const wants = [`wants ${fmt(o.want)} {i:${o.item}} ${nm} {soft:· ${o.n + 1} × ${fmt(LEDGER[o.n % LEDGER.length].base)}}`, `wants ${fmt(o.want)} {i:${o.item}} ${nm}`, `wants ${fmt(o.want)} {i:${o.item}}`].find((q) => richWidth(q) <= tw) ?? `${fmt(o.want)} {i:${o.item}}`;
  drawRich(ui, wants, tx, cy, Infinity, T.ink);
  ui.hint(tx, cy - 1, tw, 10, [{ text: `{big:${ITEMS[o.item].name}}` }, { text: `order ${o.n + 1} wants ${o.n + 1} × ${fmt(LEDGER[o.n % LEDGER.length].base)} = ${fmt(o.want)}` }, { text: '{soft:linear: each order one base more than the last}' }], 220);
  cy += 11;
  const frac = ledgerFrac(g);
  meter(ui, tx, cy + 1, Math.max(40, tw - 64), 6, open ? frac : 0, { role: 'good', glint: false });
  ui.text(`${fmt(have)}/${fmt(o.want)}`, tx + tw, cy, T.ink, { align: 'right' });
  ui.hint(tx, cy - 1, tw, 9, [{ text: `{big:Order ${o.n + 1}}` }, { text: `${fmt(have)} of ${fmt(o.want)} ${ITEMS[o.item].name.toLowerCase()} · ${Math.floor(frac * 100)}%` }, { text: '{soft:taken from any Dock before the sale · never timed}' }], 220);
  cy += 11;
  const foot = open ? [`{soft:any Dock · never timed · pays ${LEDGER_RULES.pays}× its Dock value}`, `{soft:any Dock · never timed · pays ${LEDGER_RULES.pays}×}`, `{soft:never timed · pays ${LEDGER_RULES.pays}×}`] : ['{bad:closed} {soft:· its Kernel node opens it}', '{bad:closed}'];
  drawRich(ui, foot.find((q) => richWidth(q) <= tw) ?? foot[foot.length - 1], tx, cy, Infinity, T.ink);
  y += cardH + 6;
  // ---- the next cosmetic
  const nc = nextCosmetic(g);
  const cos = nc.order.cosmetic ?? cosmeticAt(0);
  const away = nc.away === 0 ? '{good:this order}' : `in ${nc.away + 1} orders`;
  const crow = `{u:trophies} next cosmetic ${away} {soft:· order ${nc.order.n + 1} ·} ${cosmeticName(cos)}`;
  drawRich(ui, crow, body.x + 2, y, body.w - 4, T.ink);
  ui.hint(body.x + 2, y - 1, body.w - 4, 10, [{ text: `{big:${cosmeticName(cos)}}` }, { text: SKIN_WHAT[cos] ?? 'a ribbon for the shelf' }, { text: `every ${LEDGER_RULES.every}th order pays one · kept for good` }], 220);
  y += 13;
  // ---- the orders after it, in turn
  heading(ui, 'Next in turn', body.x + 2, y, body.w - 4, 'ink');
  y += BIG_H + 4;
  const bottom = body.y + body.h;
  for (let i = 1; y + ROW_H <= bottom; i++) {
    const q = ledgerOrder(o.n + i);
    const left = `{soft:${q.n + 1}.} {i:${q.item}} ${fmt(q.want)} ${ITEMS[q.item].name.toLowerCase()}${q.cosmetic ? ` {good:+ ${cosmeticName(q.cosmetic).toLowerCase()}}` : ''}`;
    const right = `{coin:${fmt(q.pays)}}`;
    const room = body.w - 4 - richWidth(right) - 6;
    ui.clip(body.x + 2, y, room, ROW_H);
    drawRich(ui, left, body.x + 2, y + 2, Infinity, T.ink);
    ui.unclip();
    drawRich(ui, right, body.x + body.w - 2, y + 2, Infinity, T.ink, { align: 'right' });
    rule(ui, body.x + 2, y + ROW_H - 1, body.w - 4);
    y += ROW_H;
    if (i > 12) break;
  }
  if (detail) shelf(app, detail);
}

/** The right page: the cosmetics owned, their sprites, the next traced in pencil. */
function shelf(app: App, page: Rect) {
  const ui = app.ui;
  const g = app.game;
  const owned = g.s.meta.cosmetics ?? [];
  const x = page.x + 4, w = page.w - 8;
  let y = page.y + 2;
  ui.big('The shelf', x, y, T.ink);
  const n = `${owned.length} owned`;
  if (bigWidth('The shelf') + chipWidth(n) + 6 <= w) chip(ui, x + w - chipWidth(n), y + 1, n, { role: owned.length ? 'good' : 'soft' });
  y += BIG_H + 4;
  rule(ui, x, y - 2, w, true);
  y += 2;
  const end = page.y + page.h;
  // the next one to come, then those owned (newest first)
  const next = nextCosmetic(g).order.cosmetic;
  const list: { id: string; owned: boolean }[] = [...(next && !owned.includes(next) ? [{ id: next, owned: false }] : []), ...owned.slice().reverse().map((id) => ({ id, owned: true }))];
  if (!list.length) list.push({ id: LEDGER_COSMETICS[0], owned: false });
  const foot = 20;
  for (const c of list) {
    if (y + 40 > end - foot) { drawRich(ui, `{soft:+${list.length - list.indexOf(c)} more}`, x, y, w, T.inkSoft); break; }
    y = cosmeticRow(app, c.id, c.owned, x, y, w) + 4;
  }
  // Milestone 11: skins are worn in the Wardrobe (the Trophy Shelf's page)
  const tip = [{ text: '{big:The Wardrobe}' }, { text: 'every kind a skin dresses · wear one' }, { text: '{soft:kept for good through every reset}' }];
  if (button(ui, 'ledgerWardrobe', x, end - 17, w, 17, 'Wear them: the Wardrobe', { icon: 'trophies', gold: owned.length > 0, tip })) { shelfTab('wardrobe'); app.panel = 'trophies'; app.audio.sfx('open'); }
}

/** One cosmetic: its name, what it dresses, and its sprites (or ribbon). Returns the y under it. */
function cosmeticRow(app: App, id: string, owned: boolean, x: number, y: number, w: number): number {
  const ui = app.ui;
  const name = cosmeticName(id);
  ui.text(`${owned ? ICON.check + ' ' : ''}${name}`, x, y, owned ? T.good : T.inkSoft);
  if (!owned) { const s = 'NEXT'; ui.small(s, x + w - smallWidth(s), y + 1, T.inkSoft); }
  y += 10;
  const sheets = skinSheets(id);
  let sx = x, rowH = 0;
  if (sheets.length) {
    for (const nm of sheets) {
      const s = sheet(nm);
      const f = s.frames[owned ? Math.floor(ui.time * (s.fps || 4)) % s.frames.length : 0];
      // every preview 32 px tall: a 1x1 machine at 2x, a Mk2 at 1x
      const k = f.height <= 16 ? 2 : 1;
      const fw = f.width * k, fh = f.height * k;
      if (sx + fw > x + w) break;
      ui.fill(sx - 1, y - 1, fw + 2, fh + 2, T.ink);
      ui.fill(sx, y, fw, fh, C.pave2);
      if (owned) ui.ctx.drawImage(f, sx, y, fw, fh);
      else pencilIcon(ui, 'skin:' + nm, f, sx, y, Math.max(fw, fh), T.inkSoft);
      ui.hint(sx, y, fw, fh, [{ text: `{big:${name}}` }, { text: SKIN_WHAT[id] ?? '' }, { text: owned ? '{good:yours}' : '{soft:the next one the Ledger pays}' }], 190);
      rowH = Math.max(rowH, fh);
      sx += fw + 4;
    }
  } else {
    // a ribbon for the shelf, drawn in code (no sheet for the numbered ones)
    ribbonRaw(ui.ctx, x, y, Math.min(w, 60), 12, owned ? 'gold' : 'moss', 'in');
    const m = /^ribbon(\d+)$/.exec(id);
    ui.small(m ? `NO. ${m[1]}` : name.toUpperCase(), x + 8, y + 3, owned ? C.ink : T.inkSoft);
    rowH = 12;
  }
  y += rowH + 3;
  if (SKIN_WHAT[id]) { drawLayout(ui, layoutRich(`{soft:${SKIN_WHAT[id]}}`, w), x, y, T.inkSoft); y += 9; }
  return y;
}

registerScreen('ledger', ledgerScreen);

registerMenu({
  id: 'ledger', icon: 'ledger', name: 'Ledger', panel: 'ledger', group: 'game',
  tip: '{u:ledger} the Endless Ledger · an order that never ends',
  show: (app) => !app.game.s.scenario && (ledgerOpen(app.game) || (app.game.s.meta.ledger?.n ?? 0) > 0),
});

void textWidth;
