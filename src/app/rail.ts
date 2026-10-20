// The left rail (docs/ui-redesign.md): floating cards with a gap between them, not one framed
// column. The Goal (the old "Next", with the Bellows' Buy button at the start), the active Order
// (the customer's portrait, one bar per item; an "orders offered" pill when none is active), the
// Research node, and the Megaproject once the Bay exists. A click on a card's title folds it to
// that line; a click on its body opens its screen. Also the diegetic touches drawn on the map:
// the active order's flag over the Dock and the research ring over the Hopper.
import { C, rgba } from '../data/palette';
import { UPGRADES } from '../data/machines';
import { RESEARCH, type ResearchId } from '../data/research';
import { ORDER, CUSTOMERS, type CustomerId } from '../data/orders';
import { ITEMS, type ItemId } from '../data/items';
import { megaStage } from '../data/megaprojects';
import { ICON, textWidth, wrapText, ellipsize } from '../ui/font';
import { itemIcon } from '../render/sprites';
import { researchFrac, available } from '../sim/systems/research';
import { offeredOrders, orderFrac } from '../sim/systems/orders';
import { megaFrac } from '../render/factory';
import { plate, bar, button, label, uiIcon, dot, type UIconName } from './chrome';
import { customerPortrait } from './orders';
import { nextGoal } from './goals';
import type { Layout } from './layout';
import type { TipLine } from '../ui/ui';
import { nodeIcon } from './screens';
import type { App } from './app';

/** each customer's colour (their orders' cards, flags and tabs) */
export const CUSTOMER_COL: Record<CustomerId, string> = { bramble: C.leaf, unit7: C.teal1, voltaire: C.hot };

const TITLE_H = 13;

/** A rail card: a plate with an accent top edge and a small-caps title; a click on the title
 *  folds the card to that line. Returns the y under it. */
function railCard(app: App, id: string, x: number, y: number, w: number, title: string, accent: string, ic: UIconName, bodyH: number, body: (x: number, y: number, w: number) => void, open?: () => void, flash = 0, tip?: TipLine[]): number {
  const ui = app.ui;
  const hs = app.hud;
  const folded = hs.collapsed.has(id);
  const h = folded ? TITLE_H + 1 : TITLE_H + bodyH + 5;
  const hovTitle = ui.hover(x, y, w, TITLE_H);
  plate(ui, x, y, w, h, { accent, hover: hovTitle });
  if (flash > 0) ui.fill(x + 1, y + 1, w - 2, h - 2, accent, flash * 0.5);
  uiIcon(ui, ic, x + 4, y + 3, 1);
  label(ui, title, x + 15, y + 5, accent);
  ui.small(folded ? '+' : '-', x + w - 8, y + 5, hovTitle ? C.bone : C.hull1);
  ui.mark('card:' + id, x, y, w, h);
  if (!folded) body(x + 6, y + TITLE_H + 2, w - 12);
  if (hovTitle) {
    ui.tip([{ text: folded ? 'Click to open this card' : 'Click to fold this card to its title', color: C.hull2 }], 150);
    if (ui.clicked) {
      ui.eat();
      ui.sfx('click');
      if (folded) hs.collapsed.delete(id);
      else hs.collapsed.add(id);
    }
  } else if (!folded && ui.hover(x, y + TITLE_H, w, h - TITLE_H)) {
    if (tip && !ui.hoverId) ui.tip(tip, 190);
    if (open && ui.clicked) {
      ui.eat();
      ui.sfx('click');
      open();
    }
  }
  return y + h + 4;
}

/** a want row: the item's icon, a bar, and "have/need" in the small figures */
function wantRow(app: App, item: ItemId, have: number, need: number, x: number, y: number, w: number, col: string) {
  const ui = app.ui;
  ui.ctx.drawImage(itemIcon(item), x, y);
  const s = `${fmtShort(have)}/${fmtShort(need)}`;
  const sw = ui.small(s, x + w, y + 2, have >= need ? C.leaf : C.hull3, { align: 'right' });
  bar(ui, x + 10, y + 2, w - 13 - sw, 5, need > 0 ? have / need : 0, col);
}

function fmtShort(n: number): string {
  n = Math.floor(n);
  if (n < 10000) return String(n);
  if (n < 1e6) return (n / 1000).toFixed(n < 1e5 ? 1 : 0).replace(/\.0$/, '') + 'K';
  return (n / 1e6).toFixed(1).replace(/\.0$/, '') + 'M';
}

/** The goal's key without its live numbers: a change of key is a new goal (it flashes and chimes). */
const goalKey = (s: string) => s.replace(/[\d,.%/]+/g, '#');

export function rail(app: App, L: Layout) {
  const ui = app.ui;
  const g = app.game;
  const hs = app.hud;
  const R = L.rail;
  const x = R.x, w = R.w;
  let y = R.y;

  // ---- the goal
  const goal = nextGoal(g);
  const text = goal ? goal.text : 'Build, balance, and keep the pips green.';
  const key = goalKey(text);
  if (hs.goalKey !== key) {
    if (hs.goalKey !== null) {
      hs.goalAt = ui.time;
      app.audio.sfx('codex', 0.35, 1.5);
    }
    hs.goalKey = key;
  }
  hs.goalUi = goal?.ui ?? null;
  const t = ui.time - hs.goalAt;
  const k = Math.min(1, t / 0.28);
  const slide = Math.round((1 - k * k * (3 - 2 * k)) * -(w + 8));
  const flash = t < 0.7 ? 1 - t / 0.7 : 0;
  const lines = wrapText(text, w - 12);
  const noteLines = goal?.note ? wrapText(goal.note, w - 12) : [];
  const bellows = !g.has('bellows');
  const goalH = lines.length * 10 + (bellows ? 18 : 0) + (noteLines.length ? 5 + noteLines.length * 10 : 0) - 2;
  y = railCard(app, 'goal', x + slide, y, w, 'Goal', C.gold, 'star', goalH, (bx, by, bw) => {
    lines.forEach((l, i) => ui.text(l, bx, by + i * 10, C.bone));
    let yy = by + lines.length * 10;
    if (bellows) bellowsRow(app, bx, yy + 1, bw);
    if (bellows) yy += 18;
    if (noteLines.length) {
      ui.fill(bx, yy + 1, bw, 1, C.hull0);
      noteLines.forEach((l, i) => ui.text(l, bx, yy + 4 + i * 10, C.pipYellow));
    }
  }, undefined, flash);

  // ---- the order
  const o = g.s.orders;
  if (o.active) {
    const d = ORDER[o.active];
    const who = d.customer;
    const col = CUSTOMER_COL[who];
    const wants = Object.entries(d.wants) as [ItemId, number][];
    const factoryOnly = d.at === 'factory';
    const bodyH = Math.max(26, 11 + wants.length * 9) + (factoryOnly ? 9 : 0);
    y = railCard(app, 'order', x, y, w, 'Order', col, 'orders', bodyH, (bx, by, bw) => {
      customerPortrait(app, who, bx + 1, by + 1, 24);
      const tx = bx + 30;
      ui.clip(tx, by, bw - 30, 10);
      ui.text(ellipsize(d.name, bw - 30), tx, by, C.bone, { shadow: C.ink });
      ui.unclip();
      wants.forEach(([item, n], i) => {
        const have = Math.min(n, Math.floor(o.progress[d.id]?.[item]?.toNumber() ?? 0));
        wantRow(app, item, have, n, tx, by + 11 + i * 9, bw - 30, col);
      });
      if (factoryOnly) ui.small('factory dock only', bx + 1, by + bodyH - 6, C.hot);
    }, () => app.togglePanel('orders'), 0, [{ text: `${d.name}, for ${CUSTOMERS[who].name}`, color: col }, { text: factoryOnly ? 'This order counts only what reaches the Factory Dock: trunk the modules that make it into the Factory Dock. The Workshop Dock just sells.' : 'Items sent to the Dock fill the active order first, then sell. Orders never expire.' }, { text: `${Math.round(orderFrac(g, d.id) * 100)}% done. Click for the Orders screen (O).`, color: C.hull2 }]);
  } else {
    const offered = offeredOrders(g);
    if (offered.length) {
      const s = offered.length === 1 ? 'An order is offered' : `${offered.length} orders offered`;
      if (pill(app, 'openOrders', x, y, w, s, C.leaf, 'orders', [{ text: 'Orders', color: C.leaf }, { text: 'A customer has an order for you. Take one; it fills before anything sells. (O)' }])) app.togglePanel('orders');
      y += 18;
    }
  }

  // ---- research (once the Bellows is bought: the first minute has one goal)
  const sel = g.s.research.selected;
  const allDone = g.s.research.done.length >= Object.keys(RESEARCH).length;
  if (sel) {
    y = railCard(app, 'research', x, y, w, 'Research', C.teal1, 'research', 18, (bx, by, bw) => {
      const f = researchFrac(g, sel);
      ui.clip(bx, by, bw, 10);
      ui.text(ellipsize(RESEARCH[sel].name, bw), bx, by, C.bone, { shadow: C.ink });
      ui.unclip();
      const ps = `${Math.floor(f * 100)}%`;
      const pw = ui.small(ps, bx + bw, by + 11, C.teal1, { align: 'right' });
      bar(ui, bx, by + 11, bw - pw - 3, 5, f, C.teal1);
    }, () => app.togglePanel('research'), 0, [{ text: RESEARCH[sel].name, color: C.teal1 }, { text: `Unlocks ${RESEARCH[sel].unlocks}. Items delivered to the Hopper pay for it.` }, { text: 'Click for the research tree (T).', color: C.hull2 }]);
  } else if (!allDone && (g.has('bellows') || g.s.research.done.length > 0) && Object.keys(RESEARCH).some((id) => available(g, id as ResearchId))) {
    if (pill(app, 'openTree', x, y, w, 'Pick research (T)', C.teal1, 'research', [{ text: 'Research', color: C.teal1 }, { text: 'Nothing is selected: items in the Hopper go to waste. Pick a node in the tree.' }])) app.togglePanel('research');
    y += 18;
  }

  // ---- the Megaproject, once the Bay stands on the Factory floor
  const st = megaStage(g.s.mega.stage);
  if (st && g.s.factory.ents.some((e) => e.kind === 'fbay')) {
    const wants = Object.entries(st.wants) as [ItemId, number][];
    y = railCard(app, 'mega', x, y, w, 'Megaproject', C.glow, 'mega', 11 + wants.length * 9, (bx, by, bw) => {
      ui.clip(bx, by, bw, 10);
      ui.text(ellipsize(st.name.replace(/^The /, ''), bw - 26), bx, by, C.bone, { shadow: C.ink });
      ui.unclip();
      ui.small(`${Math.floor(megaFrac(g) * 100)}%`, bx + bw, by + 2, C.glow, { align: 'right' });
      wants.forEach(([item, n], i) => wantRow(app, item, Math.min(n, g.s.mega.progress[item]?.toNumber() ?? 0), n, bx, by + 11 + i * 9, bw, C.glow));
    }, () => app.togglePanel('mega'), 0, [{ text: st.name, color: C.glow }, { text: `Trunk these into the Megaproject Bay on the Factory floor. Built, it gives: ${st.reward}.` }, { text: 'Click for the Megaproject.', color: C.hull2 }]);
  }
  void ITEMS; void textWidth;
}

/** A pill: a one-line plate in its accent colour that opens a screen (orders offered, research to
 *  pick), with a blinking dot. Calmer than a gold button: gold is for buying. */
function pill(app: App, id: string, x: number, y: number, w: number, text: string, accent: string, ic: UIconName, tip: TipLine[]): boolean {
  const ui = app.ui;
  const h = 14;
  const hov = ui.hover(x, y, w, h);
  ui.mark(id, x, y, w, h);
  plate(ui, x, y, w, h, { accent, hover: hov, kind: 'button' });
  uiIcon(ui, ic, x + 4, y + 3, 1);
  ui.text(ellipsize(text, w - 26), x + 15, y + 3, accent, { shadow: C.ink });
  if (Math.floor(ui.time * 2.5) % 2 === 0) dot(ui, x + w - 7, y + 5, accent === C.leaf ? C.pipRed : C.gold);
  if (hov) {
    ui.hoverId = id;
    ui.tip(tip, 180);
    if (ui.clicked) {
      ui.eat();
      ui.sfx('click');
      return true;
    }
  }
  return false;
}

/** The Bellows under the first goal: how close the coin is, then a Buy button once it is there. */
function bellowsRow(app: App, x: number, y: number, w: number) {
  const ui = app.ui;
  const g = app.game;
  const u = UPGRADES.bellows;
  ui.mark('bellows', x, y, w, 15);
  if (g.s.coin.gte(u.cost)) {
    if (button(ui, 'buyBellows', x, y, w, 15, `Buy the Bellows ${ICON.coin}${u.cost}`, { gold: true, pulse: true, tip: [{ text: 'The Bellows', color: C.gold }, { text: 'The Hand Furnace runs on its own: an ingot every 2 s while it has ore. No more cranking.' }] })) app.act({ k: 'upgrade', id: 'bellows' });
    return;
  }
  const have = Math.max(0, Math.floor(g.s.coin.toNumber()));
  label(ui, 'bellows', x, y + 4, C.hull2);
  const s = `${have}/${u.cost}`;
  const sw = ui.small(s, x + w, y + 4, C.gold, { align: 'right' });
  bar(ui, x + 32, y + 4, w - 36 - sw, 5, have / u.cost, C.gold);
  ui.hint(x, y, w, 14, [{ text: 'The Bellows', color: C.gold }, { text: `The Hand Furnace runs on its own: an ingot every 2 s while it has ore. ${u.cost - have} coin to go: crank the furnace and sell ingots at the Dock.` }], 190);
}

/** On the map, under the HUD: the active order's flag over the Dock (the customer's colour, a
 *  small bar) and a progress ring over the Hopper for the selected research node. World markers,
 *  drawn straight to the canvas outside the overlap audit. */
export function diegetic(app: App, L: Layout) {
  const ui = app.ui;
  const g = app.game;
  const ctx = ui.ctx;
  const r = app.renderer;
  const c = L.center;
  const inView = (x: number, y: number) => x > 0 && x < ui.w && y > L.top.h + 4 && y < L.band.y;
  const fac = app.floor === 'factory';
  const at = (tx: number, ty: number) => { const s = r.toScreen(tx, ty); return { x: Math.round(s.x / ui.scale), y: Math.round(s.y / ui.scale) }; };
  const o = g.s.orders;
  if (o.active) {
    const d = ORDER[o.active];
    const dock = fac ? g.s.factory.ents.find((e) => e.kind === 'fdock') : d.at === 'factory' ? null : g.s.ents.find((e) => e.kind === 'dock');
    if (dock) {
      const p = at(dock.x + dock.w - 0.25, dock.y + 0.2);
      if (inView(p.x, p.y - 20)) {
        const col = CUSTOMER_COL[d.customer];
        const top = p.y - 20;
        // the pole
        ctx.fillStyle = C.ink;
        ctx.fillRect(p.x - 1, top - 1, 3, 22);
        ctx.fillStyle = C.hull2;
        ctx.fillRect(p.x, top, 1, 20);
        ctx.fillStyle = C.gold;
        ctx.fillRect(p.x - 1, top - 2, 3, 2);
        // the pennant, waving
        const wave = Math.floor(ui.time * 4) % 2;
        ctx.fillStyle = C.ink;
        ctx.fillRect(p.x - 13, top, 13, 9);
        ctx.fillStyle = col;
        ctx.fillRect(p.x - 12, top + 1, 12, 7);
        ctx.fillStyle = rgba(C.ink, 0.35);
        ctx.fillRect(p.x - 12 + (wave ? 0 : 6), top + 1, 3, 7);
        ctx.fillStyle = C.ink;
        ctx.fillRect(p.x - 13, top + 4 + wave, 2, 2);
        // its progress, under the pennant
        const f = orderFrac(g, d.id);
        ctx.fillStyle = C.ink;
        ctx.fillRect(p.x - 13, top + 10, 13, 4);
        ctx.fillStyle = col;
        ctx.fillRect(p.x - 12, top + 11, Math.round(11 * f), 2);
      }
    }
  }
  const sel = g.s.research.selected;
  if (sel) {
    const hop = fac ? g.s.factory.ents.find((e) => e.kind === 'fhopper') : g.s.ents.find((e) => e.kind === 'hopper');
    if (hop) {
      const p = at(hop.x + hop.w / 2, hop.y);
      const cx = p.x, cy = p.y - 9;
      if (inView(cx, cy - 8)) {
        const f = researchFrac(g, sel);
        ctx.fillStyle = C.ink;
        ctx.beginPath(); ctx.arc(cx, cy, 8.5, 0, Math.PI * 2); ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = C.teal0;
        ctx.beginPath(); ctx.arc(cx, cy, 7, 0, Math.PI * 2); ctx.stroke();
        ctx.strokeStyle = C.teal1;
        ctx.beginPath(); ctx.arc(cx, cy, 7, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * f); ctx.stroke();
        ctx.lineWidth = 1;
        nodeIcon(ui, sel, cx - 4, cy - 4, true);
      }
    }
  }
  void c;
}
