// The speaker's corner (docs/hud-180.md "Bramble's corner"): the speaker's portrait on a lily pad,
// bottom-left, and the speech bubble with the current goal beside it (rich text, its progress as a
// meter, its chips, its note), its tail at the portrait's mouth. A click on the portrait folds the
// bubble away (a "!" bubble when a new line arrives) or unfolds it; a click on the bubble opens what
// the goal names (a page, a floor, a tool), or folds it. At the start the Bellows' Buy button sits
// in the bubble. Other speakers take the corner for a few seconds for their own lines: a customer
// offering an order or thanking you for one, Unit 7 logging a Codex first. The toolbox (the wheel at
// the screen's centre) sits on the pad's shoulder. Also the diegetic touches on the floor: the
// active order's flag over the Dock, the research ring over the Hopper, the goal's bobbing arrow.
import { C, rgba } from '../data/palette';
import { UPGRADES } from '../data/machines';
import { ORDER, CUSTOMERS, type CustomerId } from '../data/orders';
import { itemName } from '../data/items';
import { ICON, drawText, LINE_H } from '../ui/font';
import { layoutRich, drawLayout, richWidth, CHIP_H } from '../ui/rich';
import { T } from '../ui/theme';
import { bubbleRaw } from '../ui/paper';
import { sheet, hasArt } from '../render/sprites';
import { researchFrac } from '../sim/systems/research';
import { offeredOrders, orderFrac } from '../sim/systems/orders';
import { bubble, button, meter, chip, chipWidth, lilyPad, portrait, rule } from './chrome';
import { nextGoal, type Speaker } from './goals';
import { toolboxButton } from './wheel';
import type { Layout } from './layout';
import { nodeIcon } from './screens';
import type { App } from './app';

/** each customer's colour (their orders' flags and tabs) */
export const CUSTOMER_COL: Record<CustomerId, string> = { bramble: C.leaf, unit7: C.teal1, voltaire: C.hot, committee: C.violet };

/** The goal's key without its live numbers: a change of key is a new goal (it flashes and chimes). */
const goalKey = (s: string) => s.replace(/[\d,.%/]+/g, '#');

/** A line another speaker says for a few seconds (an order offered, a Codex first). */
export interface Cameo { who: Speaker; text: string; at: number; life: number; chips?: string[]; open?: 'orders' | 'codex' }

/** Seconds a cameo holds the corner. */
const CAMEO_S = 6.5;

/** Watch the game for other speakers' lines and queue them. */
function cameos(app: App) {
  const g = app.game;
  const hs = app.hud;
  const t = app.ui.time;
  const offered = offeredOrders(g);
  const ids = offered.map((d) => d.id);
  if (hs.offerSeen === null) hs.offerSeen = ids;
  const fresh = ids.find((id) => !hs.offerSeen!.includes(id));
  hs.offerSeen = ids;
  if (fresh && !g.s.orders.active) {
    const d = ORDER[fresh];
    hs.cameos.push({ who: d.customer, text: d.pitch, at: t, life: CAMEO_S, chips: [`{u:orders} ${d.name}`], open: 'orders' });
  }
  const codex = g.s.codex.length;
  if (hs.codexHeard < 0) hs.codexHeard = codex;
  if (codex > hs.codexHeard) {
    const id = g.s.codex[codex - 1];
    hs.cameos.push({ who: 'unit7', text: `NEW SPECIMEN: ${itemName(id).toUpperCase()}. PLEASING.`, at: t, life: CAMEO_S, chips: [`{i:${id}} ${codex} logged`], open: 'codex' });
  }
  hs.codexHeard = codex;
  const done = g.s.orders.done.length;
  if (hs.ordersHeard < 0) hs.ordersHeard = done;
  if (done > hs.ordersHeard) {
    const d = ORDER[g.s.orders.done[done - 1]];
    const c = d ? CUSTOMERS[d.customer] : null;
    if (d && c) hs.cameos.push({ who: d.customer, text: c.thanks[done % c.thanks.length], at: t, life: CAMEO_S - 1, chips: [`{coin:${d.pays.toLocaleString('en-US')}}`] });
  }
  hs.ordersHeard = done;
  // one at a time: the next starts when the last ends
  while (hs.cameos.length && t - hs.cameos[0].at > hs.cameos[0].life) {
    hs.cameos.shift();
    if (hs.cameos.length) hs.cameos[0].at = t;
  }
  if (hs.cameos.length > 4) hs.cameos.splice(1, hs.cameos.length - 4);
}

/** A speaker's portrait on its lily pad (the cheer frames while a line is fresh). */
function speaker(app: App, who: Speaker, x: number, y: number, cheer: boolean) {
  const ui = app.ui;
  if (hasArt('h180_lilypad')) ui.ctx.drawImage(sheet('h180_lilypad').frames[0], x - 4, y + 42);
  else lilyPad(ui, x + 24, y + 46, 62);
  const name = cheer && hasArt(`portrait_${who}_cheer`) ? `portrait_${who}_cheer` : `portrait_${who}`;
  if (!hasArt(name)) { portrait(ui, who, x, y, 48); return; }
  const s = sheet(name);
  const f = cheer ? Math.floor(ui.time * 4) % s.frames.length : s.frames.length > 1 && Math.floor(ui.time * 10) % 47 === 0 ? 1 : 0;
  ui.ctx.drawImage(s.frames[f], x, y);
}

/** The speaker's corner. */
export function rail(app: App, L: Layout) {
  const ui = app.ui;
  const g = app.game;
  const hs = app.hud;
  cameos(app);
  const goal = nextGoal(g);
  const cam = hs.cameos[0] ?? null;
  const who: Speaker = cam ? cam.who : goal?.who ?? 'bramble';
  const text = cam ? cam.text : goal ? goal.text : 'Build, balance, keep it humming!';
  const key = goalKey(text);
  if (hs.goalKey !== key) {
    if (hs.goalKey !== null) {
      hs.goalAt = ui.time;
      if (!cam) app.audio.sfx('codex', 0.35, 1.5);
    }
    hs.goalKey = key;
  }
  hs.goalUi = goal?.ui ?? null;
  const t = ui.time - hs.goalAt;
  const P = L.portrait;
  const folded = hs.collapsed.has('goal') && !cam;
  // the portrait: a click folds or unfolds the bubble
  const pHov = ui.hover(P.x, P.y, 48, 54);
  ui.mark('speaker', P.x, P.y, 48, 54);
  ui.region(P.x, P.y + 6, 48, 48, 'button');
  speaker(app, who, P.x, P.y + (pHov ? -1 : 0), t < 1.2);
  if (pHov) {
    ui.hoverId = 'speaker';
    ui.tip([{ text: `{big:${SPEAKER_NAME[who]}}` }, { text: folded ? '{k:LMB} listen' : '{k:LMB} hush' }], 150);
    if (ui.clicked) {
      ui.eat();
      ui.sfx('click');
      if (hs.collapsed.has('goal')) hs.collapsed.delete('goal');
      else { hs.collapsed.add('goal'); hs.foldedAt = ui.time; }
    }
  }
  toolboxButton(app, P.x + 2, P.y - 18);
  if (folded) {
    // a little bubble: "!" when a new line has arrived since it was folded
    const news = hs.goalAt > hs.foldedAt;
    const bx = P.x + 40, by = P.y - 2;
    bubbleRaw(ui.ctx, bx, by, 15, 14, 'left', 6);
    ui.big(news ? '!' : '…', bx + 7, by + 2, news ? T.bad : T.inkSoft, { align: 'center' });
    return;
  }
  // ---- the bubble: the line, its meter, its chips, the note, the Bellows
  const maxW = Math.max(150, Math.min(L.wide ? 262 : 236, L.corner.w - 56));
  const cw = maxW - 12;
  const lay = layoutRich(text, cw);
  const bellows = !cam && !g.has('bellows');
  const canBuy = bellows && g.s.coin.gte(UPGRADES.bellows.cost);
  const chips = (cam ? cam.chips : goal?.chips) ?? [];
  const bar = cam ? undefined : goal?.bar;
  const note = cam ? null : goal?.note ? layoutRich(goal.note, cw) : null;
  // chips flow in rows
  const chipRows: string[][] = [];
  let rowW = 0;
  for (const c of chips) {
    const w = chipWidth(c);
    if (!chipRows.length || rowW + w > cw) { chipRows.push([c]); rowW = w + 3; } else { chipRows[chipRows.length - 1].push(c); rowW += w + 3; }
  }
  let ch = lay.h - 2;
  if (bar !== undefined) ch += 9;
  if (chipRows.length) ch += 3 + chipRows.length * (CHIP_H + 2);
  if (bellows) ch += canBuy ? 20 : 11;
  if (note) ch += 5 + note.h;
  const natural = Math.max(lay.w, ...chipRows.map((r) => r.reduce((s, c) => s + chipWidth(c) + 3, -3)), note ? note.w : 0, canBuy ? 130 : bellows ? 110 : 0);
  const bw = Math.min(maxW, natural + 12);
  const bh = ch + 10;
  const bx = P.x + 54;
  const by = Math.min(ui.h - 8 - bh, P.y + 40 - bh + 14);
  const at = Math.max(6, Math.min(bh - 12, P.y + 22 - by));
  // a new line pops in: the bubble grows from its tail for a moment
  const k = Math.min(1, t / 0.18);
  const slide = Math.round((1 - k) * -10);
  const action = cam?.open ? { go: () => app.togglePanel(cam.open!), what: cam.open === 'orders' ? 'orders' : 'the Codex' } : goalAction(app, goal?.ui ?? null);
  const hov = ui.hover(bx, by, bw, bh);
  ui.mark('goalBubble', bx, by, bw, bh);
  const r = bubble(ui, bx + slide, by, bw, bh, { side: 'left', at });
  if (t < 0.6) { ui.ctx.fillStyle = rgba(T.paperHi, (0.6 - t) * 1.2); ui.ctx.fillRect(r.x - 3, r.y - 2, r.w + 6, r.h + 4); }
  drawLayout(ui, lay, r.x, r.y, T.ink);
  let yy = r.y + lay.h - 1;
  if (bar !== undefined) { meter(ui, r.x, yy + 1, Math.min(r.w, 120), 6, bar, { role: 'good' }); yy += 9; }
  if (chipRows.length) {
    yy += 2;
    for (const row of chipRows) {
      let x = r.x;
      for (const c of row) x += chip(ui, x, yy, c, { role: 'ink' }) + 3;
      yy += CHIP_H + 2;
    }
  }
  if (bellows) {
    const u = UPGRADES.bellows;
    if (canBuy) {
      if (button(ui, 'buyBellows', r.x, yy + 2, Math.min(r.w, 140), 17, `Buy the Bellows {coin:${u.cost}}`, { gold: true, pulse: true, tip: [{ text: '{big:The Bellows}' }, { text: '{i:ironOre} → {i:ironIngot} on its own · 1 per 2 s' }] })) app.act({ k: 'upgrade', id: 'bellows' });
      yy += 20;
    } else {
      const have = Math.max(0, Math.floor(g.s.coin.toNumber()));
      const s = `{coin:${have}/${u.cost}}`;
      const sw = richWidth(s);
      meter(ui, r.x, yy + 2, Math.min(r.w - sw - 4, 90), 6, have / u.cost, { role: 'coin' });
      ui.rich(s, r.x + Math.min(r.w - sw - 4, 90) + 4, yy);
      ui.mark('bellows', r.x, yy, r.w, 10);
      yy += 11;
    }
  }
  if (note) {
    rule(ui, r.x, yy + 2, r.w);
    drawLayout(ui, note, r.x, yy + 4, T.warn);
  }
  if (hov && !ui.hoverId) {
    ui.tip([{ text: action ? `{k:LMB} ${action.what}` : '{k:LMB} hush' }], 160);
    if (ui.clicked) {
      ui.eat();
      ui.sfx('click');
      if (action) action.go();
      else if (cam) hs.cameos.shift();
      else { hs.collapsed.add('goal'); hs.foldedAt = ui.time; }
    }
  }
  void LINE_H;
}

export const SPEAKER_NAME: Record<Speaker, string> = { bramble: 'Mayor Bramble', unit7: 'Unit 7', voltaire: 'Dame Voltaire', committee: 'The Committee', inspector: 'The Inspector' };

/** What a click on the goal's bubble does when the goal names a page, a floor or a tool. */
function goalAction(app: App, ui: string | null): { go: () => void; what: string } | null {
  switch (ui) {
    case 'research': return { go: () => app.togglePanel('research'), what: 'research' };
    case 'orders': return { go: () => app.togglePanel('orders'), what: 'orders' };
    case 'mega': return { go: () => app.togglePanel('mega'), what: 'the Megaproject' };
    case 'survey': return { go: () => app.togglePanel('survey'), what: 'the Survey Office' };
    case 'factory': return app.floor === 'factory' ? null : { go: () => app.setFloor('factory'), what: 'the Factory floor' };
    case 'fold': return app.mode.k === 'fold' ? null : { go: () => app.toggleFold(), what: 'the Fold tool' };
    default: return null;
  }
}

/** On the floor, under the HUD: the active order's flag over the Dock (the customer's colour, a
 *  small bar), a progress ring over the Hopper for the selected research node, and the goal's
 *  arrow bobbing over its tile. World markers, drawn straight to the canvas outside the audit. */
export function diegetic(app: App, L: Layout) {
  const ui = app.ui;
  const g = app.game;
  const ctx = ui.ctx;
  const r = app.renderer;
  const inView = (x: number, y: number) => x > 0 && x < ui.w && y > 4 && y < ui.h;
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
        ctx.fillStyle = C.ink;
        ctx.fillRect(p.x - 1, top - 1, 3, 22);
        ctx.fillStyle = C.hull2;
        ctx.fillRect(p.x, top, 1, 20);
        ctx.fillStyle = C.gold;
        ctx.fillRect(p.x - 1, top - 2, 3, 2);
        const wave = Math.floor(ui.time * 4) % 2;
        ctx.fillStyle = C.ink;
        ctx.fillRect(p.x - 13, top, 13, 9);
        ctx.fillStyle = col;
        ctx.fillRect(p.x - 12, top + 1, 12, 7);
        ctx.fillStyle = rgba(C.ink, 0.35);
        ctx.fillRect(p.x - 12 + (wave ? 0 : 6), top + 1, 3, 7);
        ctx.fillStyle = C.ink;
        ctx.fillRect(p.x - 13, top + 4 + wave, 2, 2);
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
      const p = at(hop.x + hop.w, hop.y);
      const cx = p.x - 7, cy = p.y + 6;
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
  // the goal's arrow, bobbing over the tile it names
  const goal = nextGoal(g);
  if (goal?.tile && !app.panel && !fac) {
    const s = r.toScreen(goal.tile.x + 0.5, goal.tile.y);
    const bob = Math.round(Math.sin(ui.time * 6) * 2);
    const ux = Math.round(s.x / ui.scale), uy = Math.round(s.y / ui.scale) - 18 + bob;
    if (ux > 8 && ux < ui.w - 8 && uy > 2 && uy < ui.h - 18) drawText(ctx, ICON.down, ux - 6, uy, T.floorCoin, 2, C.ink);
  }
  void L;
}
