// The right-hand panels: research (the Hopper), orders (the Dock and Mayor Bramble), help.
import { C } from '../data/palette';
import { RESEARCH_LIST, RESEARCH } from '../data/research';
import { ORDERS, ORDER, CUSTOMERS } from '../data/orders';
import { ITEMS, type ItemId } from '../data/items';
import { ICON, textWidth } from '../ui/font';
import { ACTION_LABELS, SHOWN_ACTIONS, keyLabel } from '../engine/input';
import { itemIcon } from '../render/sprites';
import { available, researchFrac } from '../sim/systems/research';
import { orderFrac } from '../sim/systems/orders';
import { Num } from '../engine/num';
import type { App } from './app';

export const PANEL_W = 196;
const TOP = 26;

export function drawPanel(app: App) {
  switch (app.panel) {
    case 'research': return researchPanel(app);
    case 'orders': return ordersPanel(app);
    case 'help': return helpPanel(app);
  }
}

function frame(app: App, title: string, color: string, h: number) {
  const ui = app.ui;
  const x = ui.w - PANEL_W - 4;
  const y = TOP;
  h = Math.min(h, ui.h - y - 42);
  ui.panel(x, y, PANEL_W, h, 'dark');
  ui.fill(x + 1, y + 1, PANEL_W - 2, 13, C.slate);
  ui.text(title, x + 6, y + 4, color, { shadow: C.ink });
  if (ui.button('closePanel', x + PANEL_W - 14, y + 2, 11, 11, 'x', { tip: 'Close (Esc)' })) app.panel = null;
  return { x, y, h };
}

function researchPanel(app: App) {
  const ui = app.ui;
  const g = app.game;
  const rowH = 28;
  const list = RESEARCH_LIST.filter((d) => g.done(d.id) || d.requires.every((r) => g.done(r)) || d.requires.some((r) => g.done(r)));
  const { x, y, h } = frame(app, ICON.flask + ' Research: the Hopper', C.ice, 30 + list.length * rowH + 22);
  let yy = y + 18;
  ui.clip(x, y + 15, PANEL_W, h - 16);
  for (const d of list) {
    const done = g.done(d.id);
    const can = available(g, d.id);
    const sel = g.s.research.selected === d.id;
    const hov = ui.hover(x + 3, yy, PANEL_W - 6, rowH - 2) && can;
    ui.fill(x + 3, yy, PANEL_W - 6, rowH - 2, sel ? C.deep : hov ? C.iron : C.ink, 0.9);
    if (sel) ui.fill(x + 3, yy, 2, rowH - 2, C.ice);
    ui.text(`${d.num}. ${d.name}`, x + 8, yy + 3, done ? C.pipGreen : can ? C.bone : C.fog);
    if (done) ui.text(ICON.check, x + PANEL_W - 14, yy + 3, C.pipGreen);
    // the cost, as item icons with counts
    let cx = x + 8;
    const prog = g.s.research.progress[d.id] ?? {};
    for (const [item, n] of Object.entries(d.cost) as [ItemId, number][]) {
      ui.ctx.drawImage(itemIcon(item), cx, yy + 14);
      const have = Math.min(n, Math.floor(prog[item]?.toNumber() ?? 0));
      const banked = Math.floor(g.s.research.bank[item]?.toNumber() ?? 0);
      const t = done ? String(n) : `${have}/${n}` + (!sel && banked > 0 ? ` (${banked} banked)` : '');
      const w = ui.text(t, cx + 10, yy + 14, done ? C.fog : C.bone);
      cx += 14 + w;
    }
    if (!done && (sel || researchFrac(g, d.id) > 0)) ui.bar(x + PANEL_W - 46, yy + 15, 40, 6, researchFrac(g, d.id), C.ice);
    if (hov) {
      ui.tip([{ text: d.name, color: C.ice }, { text: `Unlocks ${d.unlocks}.` }, { text: sel ? 'Selected: Hopper deliveries fill it.' : 'Click to select it. Banked deliveries pay in first.', color: C.fog }], 200);
      if (ui.clicked) {
        ui.eat();
        app.act({ k: 'research', id: sel ? null : d.id });
      }
    } else if (!can && !done && ui.hover(x + 3, yy, PANEL_W - 6, rowH - 2)) {
      ui.tip([{ text: d.name, color: C.fog }, { text: `Needs ${d.requires.filter((r) => !g.done(r)).map((r) => RESEARCH[r].name).join(', ')} first.` }], 180);
    }
    yy += rowH;
  }
  ui.unclip();
  ui.text('The Hopper pays research, not coin.', x + 6, y + h - 12, C.fog);
}

function ordersPanel(app: App) {
  const ui = app.ui;
  const g = app.game;
  const o = g.s.orders;
  const bram = CUSTOMERS.bramble;
  const offered = ORDERS.filter((d) => d.requires.every((r) => g.done(r)));
  const { x, y, h } = frame(app, ICON.crate + ' Orders: ' + bram.name, C.lime, 60 + Math.max(1, offered.length) * 46 + 40);
  let yy = y + 18;
  // Bramble, a frog in a top hat (drawn small until the portrait lands)
  portrait(app, x + 6, yy);
  ui.text(`Reputation ${ICON.heart.repeat(o.rep.bramble)}${o.rep.bramble ? '' : '0'}`, x + 32, yy + 2, C.pipRed);
  const next = bram.rewards.find((r) => r.rep > o.rep.bramble);
  ui.text(next ? `Next: ${next.text}` : 'Every reward earned', x + 32, yy + 12, C.fog);
  yy += 30;
  ui.clip(x, y + 15, PANEL_W, h - 16);
  if (!offered.length) ui.para('Bramble has no special orders yet. Everything you send to the Dock sells at its value.', x + 6, yy, PANEL_W - 12, C.fog);
  for (const d of offered) {
    const done = o.done.includes(d.id);
    const active = o.active === d.id;
    const rh = 44;
    ui.fill(x + 3, yy, PANEL_W - 6, rh - 2, active ? C.moss : C.ink, 0.9);
    if (active) ui.fill(x + 3, yy, 2, rh - 2, C.lime);
    ui.text(d.name, x + 8, yy + 3, done ? C.pipGreen : C.bone);
    ui.text(`${ICON.coin}${Num.of(d.pays).format()} +${d.rep}${ICON.heart}`, x + PANEL_W - 8, yy + 3, C.gold, { align: 'right' });
    let cx = x + 8;
    const prog = o.progress[d.id] ?? {};
    for (const [item, n] of Object.entries(d.wants) as [ItemId, number][]) {
      ui.ctx.drawImage(itemIcon(item), cx, yy + 14);
      const have = Math.min(n, Math.floor(prog[item]?.toNumber() ?? 0));
      cx += 14 + ui.text(done ? `${n}` : `${have}/${n}`, cx + 10, yy + 14, C.bone);
    }
    if (done) ui.text(ICON.check + ' filled', x + 8, yy + 27, C.pipGreen);
    else {
      ui.bar(x + 8, yy + 29, 90, 6, orderFrac(g, d.id), C.lime);
      if (ui.button('order:' + d.id, x + PANEL_W - 60, yy + 25, 54, 13, active ? 'Set aside' : 'Accept', { active: !active, tip: active ? 'Stop filling it (progress is kept).' : `"${d.pitch}" Items sent to the Dock fill it first; the rest sell.` })) app.act({ k: 'order', id: active ? null : d.id });
    }
    yy += rh;
  }
  ui.unclip();
  ui.text('One order at a time. None expire.', x + 6, y + h - 12, C.fog);
  void ORDER;
}

function portrait(app: App, x: number, y: number) {
  const ui = app.ui;
  // a frog: green head, big eyes, a tiny top hat
  ui.fill(x, y + 6, 22, 16, C.ink);
  ui.fill(x + 1, y + 7, 20, 14, C.leaf);
  ui.fill(x + 1, y + 7, 20, 3, C.lime);
  ui.fill(x + 2, y + 3, 7, 7, C.ink); ui.fill(x + 13, y + 3, 7, 7, C.ink);
  ui.fill(x + 3, y + 4, 5, 5, C.bone); ui.fill(x + 14, y + 4, 5, 5, C.bone);
  ui.fill(x + 5, y + 5 + (Math.floor(ui.time) % 4 === 0 ? 1 : 0), 2, 2, C.ink); ui.fill(x + 16, y + 5, 2, 2, C.ink);
  ui.fill(x + 6, y + 15, 10, 1, C.ink);
  ui.fill(x + 7, y - 3, 8, 6, C.ink); ui.fill(x + 5, y + 2, 12, 2, C.ink); ui.fill(x + 8, y - 2, 6, 4, C.night); ui.fill(x + 8, y + 1, 6, 1, C.rust);
}

function helpPanel(app: App) {
  const ui = app.ui;
  const keys = SHOWN_ACTIONS.filter((a) => !a.startsWith('slot') && !a.startsWith('pan'));
  const { x, y, h } = frame(app, '? Help and keys', C.bone, 30 + keys.length * 10 + 90);
  let yy = y + 18;
  yy += ui.para('Click ore to feed the furnace; crank it; sell at the Dock. Build miners, smelters and presses; belts carry items 120/min. Every machine has a pip: green working, yellow starved, red blocked, grey unconnected. Hover one to see why.', x + 6, yy, PANEL_W - 12, C.tan);
  yy += 4;
  ui.text('WASD, arrows or right-drag: pan.', x + 6, yy, C.fog);
  yy += 10;
  ui.text('Mouse wheel: zoom.', x + 6, yy, C.fog);
  yy += 10;
  ui.text('1-9: build. Drag to lay belts.', x + 6, yy, C.fog);
  yy += 12;
  for (const a of keys) {
    if (yy > y + h - 12) break;
    ui.text(ACTION_LABELS[a], x + 6, yy, C.bone);
    const k = app.input.binds[a].map(keyLabel).join(' / ');
    ui.text(k, x + PANEL_W - 8, yy, C.gold, { align: 'right' });
    yy += 10;
  }
  void textWidth;
  void ITEMS;
}
