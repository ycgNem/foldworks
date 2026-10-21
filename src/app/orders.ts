// The Orders page of the ledger (DESIGN.md §7, §18 Customers; docs/hud-180.md "Full-screen menus"):
// the left page is the open customer's orders as slips (the name in the display face, the wants as
// item meters with counts, the pay as chips, Accept or Set aside), the ones still locked as faint
// wells naming the research they wait for, the filled ones stamped, and the Dock's prices under
// them. The right page is the customers: four portraits to pick from (a red count on the ones with
// open orders), then the open one at 48 px (cheering when an order of theirs was just filled), their
// line in a speech bubble in their own voice, their reputation as hearts and its rewards ticked
// off, the next one with what it takes, and their perks at work now.
import { C } from '../data/palette';
import { MEGA } from '../data/megaprojects';
import { RESEARCH } from '../data/research';
import { ORDERS, CUSTOMERS, ORDER, type CustomerId, type OrderDef } from '../data/orders';
import { ITEMS, ITEM_IDS, type ItemId } from '../data/items';
import { RULES } from '../data/rules';
import { ICON, textWidth, bigWidth, BIG_H } from '../ui/font';
import { itemIcon } from '../render/sprites';
import { orderFrac } from '../sim/systems/orders';
import { customerMet } from '../sim/reorganize';
import { saleValue } from '../sim/systems/docks';
import { Num } from '../engine/num';
import { button, meter, chip, chipWidth, ribbon, section, slip, rule, pencil, stamp, dot, uiIcon, bubble, CHIP_H } from './chrome';
import { menuTemplate, fmt } from './widgets';
import { layoutRich, drawLayout, richWidth } from '../ui/rich';
import { T } from '../ui/theme';
import type { App } from './app';
import type { Rect } from '../ui/ui';
import { committeeFallback } from './reorganize';
import { bookArea, castPortrait, bubbleHeight, heading, ROW_H, tick } from './ledger';

// Milestone 5: the Committee is the fourth customer (met through src/sim/reorganize.ts customerMet)
const CUSTOMER_IDS: CustomerId[] = ['bramble', 'unit7', 'voltaire', 'committee'];
/** Each customer's ink on paper: Bramble moss, Unit 7 teal, Voltaire copper, the Committee violet */
const INK: Record<CustomerId, string> = { bramble: T.good, unit7: T.research, voltaire: T.warn, committee: T.reset };
/** When a customer not yet met turns up, as a row */
const arrives = (c: CustomerId) => (CUSTOMERS[c].afterReset ? '{u:mega} with the Great Drill · or after a {u:reset} Reorganize' : `{u:research} with {research:${RESEARCH[CUSTOMERS[c].meets!].name}}`);

/** the open customer, and the customer cheering after a fill (until when, in UI seconds) */
const st = { tab: 'bramble' as CustomerId, seen: -1, cheer: null as null | { who: CustomerId; until: number } };

export function met(app: App, c: CustomerId): boolean {
  return customerMet(app.game, c);
}

/** Open the Orders page on a customer (the Great Drill's locked stage: the Committee). */
export function openOrders(app: App, who: CustomerId) {
  st.tab = who;
  if (app.panel !== 'orders') app.togglePanel('orders');
}

/** Make a customer cheer on the Orders page (an order of theirs was just filled). */
export function cheerFor(app: App, who: CustomerId, secs = 5) {
  st.cheer = { who, until: app.ui.time + secs };
  st.tab = who;
}

/** A customer's portrait, 48 or 24 px, cheering (the art's cheer frames bounce) when asked. */
export function customerPortrait(app: App, who: CustomerId, x: number, y: number, size: 48 | 24, cheer = false) {
  castPortrait(app, who, x, y, size, cheer, who === 'committee' ? committeeFallback : undefined);
}

/** Hearts for a reputation level: red ink up to rep, faint to `of`. Returns the width. */
function hearts(app: App, x: number, y: number, rep: number, of = 3): number {
  const ui = app.ui;
  for (let i = 0; i < of; i++) ui.text(ICON.heart, x + i * 8, y, i < rep ? T.bad : T.paperEdge);
  return of * 8 - 1;
}

export function ordersScreen(app: App, r0: Rect) {
  const ui = app.ui;
  const g = app.game;
  const o = g.s.orders;
  // a newly filled order: its customer cheers and their page opens
  if (st.seen >= 0 && o.done.length > st.seen) {
    const last = ORDER[o.done[o.done.length - 1]];
    if (last) cheerFor(app, last.customer);
  }
  st.seen = o.done.length;
  if (!met(app, st.tab)) st.tab = 'bramble';
  const r = bookArea(r0);
  const { body, detail } = menuTemplate(app, r, { title: 'Orders', accent: C.leaf, icon: 'orders', detail: Math.floor(r.w * 0.4) });
  ordersPage(app, body);
  if (detail) customerPage(app, detail);
}

// ------------------------------------------------------------------ the left page: the orders

function ordersPage(app: App, p: Rect) {
  const g = app.game;
  const o = g.s.orders;
  const who = st.tab;
  const mine = ORDERS.filter((q) => q.customer === who);
  const offered = mine.filter((q) => !o.done.includes(q.id) && q.requires.every((rq) => g.done(rq)));
  const locked = mine.filter((q) => !o.done.includes(q.id) && !offered.includes(q));
  const done = mine.filter((q) => o.done.includes(q.id));
  const bottom = p.y + p.h;
  let y = p.y;
  for (const d of offered) {
    const h = orderSlipH(d, p.w);
    if (y + h > bottom) break;
    orderSlip(app, d, p.x, y, p.w, h);
    y += h + 4;
  }
  for (const d of locked) {
    if (y + 30 > bottom) break;
    lockedSlip(app, d, p.x, y, p.w);
    y += 33;
  }
  for (const d of done) {
    if (y + 20 > bottom) break;
    doneRow(app, d, p.x, y, p.w);
    y += 21;
  }
  if (bottom - y >= 40) priceBoard(app, p.x, y + 2, p.w, bottom - y - 2);
}

/** One want's cell on a slip: icon, count, and a meter under the count. */
function wantW(have: number, n: number): number {
  return 11 + Math.max(30, textWidth(`${fmt(have)}/${fmt(n)}`));
}

/** The pay chips of an order (coin, reputation; the Factory Dock when only it counts). */
function payChips(d: OrderDef): { text: string; role: 'coin' | 'bad' | 'warn'; tip?: string; icon?: 'factory' }[] {
  const out: { text: string; role: 'coin' | 'bad' | 'warn'; tip?: string; icon?: 'factory' }[] = [];
  if (d.at === 'factory') out.push({ text: 'Factory Dock', role: 'warn', icon: 'factory', tip: '{u:factory} only the Factory Dock counts · trunk your modules into it · the Workshop Dock just sells' });
  out.push({ text: `{coin:${Num.of(d.pays).format()}}`, role: 'coin', tip: `{coin:${Num.of(d.pays).format()}} when it fills` });
  out.push({ text: `+${d.rep} ${ICON.heart}`, role: 'bad', tip: `+${d.rep} reputation with ${CUSTOMERS[d.customer].name}` });
  return out;
}

/** Lay the wants and pay chips out in lines `w` wide; returns each piece's place. */
function flow(app: App | null, d: OrderDef, w: number) {
  const p = app?.game.s.orders.progress[d.id] ?? {};
  const pieces: { kind: 'want' | 'chip'; w: number; item?: ItemId; have?: number; n?: number; c?: ReturnType<typeof payChips>[number] }[] = [];
  for (const [item, n] of Object.entries(d.wants) as [ItemId, number][]) {
    const have = Math.min(n, Math.floor(p[item]?.toNumber() ?? 0));
    pieces.push({ kind: 'want', w: wantW(have, n), item, have, n });
  }
  for (const c of payChips(d)) pieces.push({ kind: 'chip', w: chipWidth(c.text, { icon: c.icon }), c });
  const placed: { x: number; line: number; piece: (typeof pieces)[number] }[] = [];
  let x = 0, line = 0;
  // the chips sit after the wants, right-aligned on the last line when they fit there
  for (const pc of pieces) {
    if (x > 0 && x + pc.w > w) { x = 0; line++; }
    placed.push({ x, line, piece: pc });
    x += pc.w + 6;
  }
  return { placed, lines: line + 1 };
}

const SLIP_HEAD = BIG_H + 5;
const FLOW_H = 17;

function orderSlipH(d: OrderDef, w: number): number {
  return 5 + SLIP_HEAD + flow(null, d, w - 12).lines * FLOW_H + 3;
}

function orderSlip(app: App, d: OrderDef, x: number, y: number, w: number, h: number) {
  const ui = app.ui;
  const g = app.game;
  const o = g.s.orders;
  const active = o.active === d.id;
  const c = slip(ui, x, y, w, h, { blocking: true });
  const ink = INK[d.customer];
  // the active order: a ribbon of the customer's ink down its edge, breathing a little
  if (active) {
    ui.fill(x + 1, y + 3, 2, h - 6, ink);
    if (Math.floor(ui.time * 2) % 2 === 0) ui.fill(x + 3, y + 3, 1, h - 6, ink);
  }
  const f = orderFrac(g, d.id);
  // the head: the name, ACTIVE, the share filled, the button
  const bw = Math.max(54, textWidth(active ? 'Set aside' : 'Accept') + 14);
  const bx = x + w - 6 - bw;
  ui.big(d.name, c.x, y + 5, T.ink);
  let hx = c.x + bigWidth(d.name) + 5;
  if (active && hx + chipWidth('ACTIVE') < bx - 30) { hx += chip(ui, hx, y + 4, 'ACTIVE', { role: 'good', solid: true }) + 4; }
  const pc = `${Math.floor(f * 100)}%`;
  ui.text(pc, bx - 5, y + 6, f >= 1 ? T.good : T.inkSoft, { align: 'right' });
  if (button(ui, 'ord:' + d.id, bx, y + 3, bw, 15, active ? 'Set aside' : 'Accept', { gold: !active, active, pulse: !active && !o.active, tip: active ? [{ text: '{u:pause} stop filling it · progress is kept' }] : [{ text: d.pitch }, { text: '{u:orders} what reaches a Dock fills it first, then sells', color: T.inkSoft }] })) app.act({ k: 'order', id: active ? null : d.id });
  // the wants (icon, count, meter) and the pay chips, flowing
  const fl = flow(app, d, w - 12);
  const fy = y + 5 + SLIP_HEAD;
  for (const pl of fl.placed) {
    const px = c.x + pl.x, py = fy + pl.line * FLOW_H;
    const pz = pl.piece;
    if (pz.kind === 'want') {
      const n = pz.n!, have = pz.have!;
      ui.ctx.drawImage(itemIcon(pz.item!), px, py + 1);
      ui.text(`${fmt(have)}/${fmt(n)}`, px + 11, py, have >= n ? T.good : T.ink);
      meter(ui, px + 11, py + 10, pz.w - 11, 4, have / n, { role: have >= n ? 'good' : 'warn', glint: false });
      ui.hint(px, py - 1, pz.w, 16, `{i:${pz.item}} ${ITEMS[pz.item!].name} · ${fmt(have)} of ${fmt(n)} delivered`, 170);
    } else {
      const cc = pz.c!;
      chip(ui, px, py + 1, cc.text, { role: cc.role, icon: cc.icon });
      if (cc.tip) ui.hint(px, py + 1, pz.w, CHIP_H, cc.tip, 180);
    }
  }
}

function lockedSlip(app: App, d: OrderDef, x: number, y: number, w: number) {
  const ui = app.ui;
  const g = app.game;
  section(ui, x, y, w, 30);
  uiIcon(ui, 'lock', x + 5, y + 4, 1);
  ui.text(d.name, x + 16, y + 4, T.inkSoft);
  const pay = `{coin:${Num.of(d.pays).format()}}`;
  drawLayout(ui, layoutRich(pay), x + w - 5, y + 4, T.inkSoft, { align: 'right' });
  // what it wants (faded), then what it waits for as chips
  let ix = x + 5;
  ui.ctx.globalAlpha = 0.6;
  for (const [item, n] of Object.entries(d.wants) as [ItemId, number][]) {
    if (ix + 30 > x + w / 2) break;
    ui.ctx.drawImage(itemIcon(item), ix, y + 17);
    ix += 14 + ui.text(fmt(n), ix + 10, y + 17, T.inkSoft);
  }
  ui.ctx.globalAlpha = 1;
  const need = d.requires.filter((q) => !g.done(q)).map((q) => ({ text: RESEARCH[q].name, role: 'research' as const }));
  if (d.at === 'factory') need.push({ text: 'Factory Dock', role: 'warn' as never });
  let cx = x + w - 5;
  for (const n of [...need].reverse()) {
    const cw = chipWidth(n.text);
    if (cx - cw < ix + 4) break;
    cx -= cw;
    chip(ui, cx, y + 15, n.text, { role: n.role });
    cx -= 3;
  }
  ui.hint(x, y, w, 30, [{ text: `{u:lock} ${d.name}` }, { text: `waits for ${d.requires.filter((q) => !g.done(q)).map((q) => `{research:${RESEARCH[q].name}}`).join(' · ')}` }], 190);
}

function doneRow(app: App, d: OrderDef, x: number, y: number, w: number) {
  const ui = app.ui;
  tick(ui, x + 1, y + 3);
  ui.text(d.name, x + 16, y + 5, T.good);
  let ix = x + 20 + textWidth(d.name);
  for (const item of Object.keys(d.wants) as ItemId[]) {
    if (ix + 10 > x + w - 110) break;
    ui.ctx.drawImage(itemIcon(item), ix, y + 5);
    ix += 10;
  }
  const pay = `+{coin:${Num.of(d.pays).format()}}`;
  const pw = richWidth(pay);
  drawLayout(ui, layoutRich(pay), x + w - 2, y + 5, T.coin, { align: 'right' });
  stamp(ui, 'FILLED', x + w - pw - 36, y + 9, { col: T.goodFill, angle: -0.05 });
  rule(ui, x, y + 20, w);
}

/** The standing order: what the Dock pays for each item, lit for the ones you have delivered. */
function priceBoard(app: App, x: number, y: number, w: number, h: number) {
  const ui = app.ui;
  const g = app.game;
  const hh = heading(ui, 'Dock prices', x, y, w, 'coin', '{soft:every item at its value}');
  const top = y + hh + 2;
  const items = ITEM_IDS.filter((id) => ITEMS[id].value > 0);
  const roomy = h - hh >= 48 && w >= 240;
  const cw = roomy ? 92 : 50, rh = roomy ? 21 : 12;
  const cols = Math.max(1, Math.floor(w / cw));
  const rows = Math.max(0, Math.floor((y + h - top + 1) / rh));
  // the ones you have sold first, then the rest
  const sorted = [...items.filter((id) => g.s.delivered[id]?.gt(0)), ...items.filter((id) => !g.s.delivered[id]?.gt(0))];
  sorted.slice(0, cols * rows).forEach((id, i) => {
    const cx = x + (i % cols) * cw, cy = top + Math.floor(i / cols) * rh;
    const got = !!g.s.delivered[id]?.gt(0);
    const v = saleValue(g, id);
    const bonus = v > ITEMS[id].value;
    ui.ctx.globalAlpha = got ? 1 : 0.4;
    if (roomy) ui.ctx.drawImage(itemIcon(id), cx, cy + 1, 16, 16);
    else ui.ctx.drawImage(itemIcon(id), cx, cy + 1);
    ui.ctx.globalAlpha = 1;
    const tx = cx + (roomy ? 19 : 10);
    if (roomy) ui.text(ITEMS[id].name, tx, cy, got ? T.ink : T.inkSoft);
    const price = `{coin:${fmt(v)}}`;
    drawLayout(ui, layoutRich(price), tx, roomy ? cy + 10 : cy + 1, bonus ? T.good : T.coin);
    if (roomy && got) ui.text(g.s.delivered[id]!.format(), cx + cw - 6, cy + 10, T.inkSoft, { align: 'right' });
    ui.hint(cx, cy - 1, cw - 2, rh, [{ text: `{i:${id}} {big:${ITEMS[id].name}}` }, { text: `{coin:${fmt(v)}} each at the Dock${bonus ? ` · {good:+${Math.round(RULES.repPlateBonus.value * 100)}%} {u:heart} Bramble` : ''}` }, { text: got ? `{u:orders} ${g.s.delivered[id]!.format()} delivered` : '{soft:not delivered yet}' }], 180);
  });
}

// ------------------------------------------------------------------ the right page: the customers

function customerPage(app: App, p: Rect) {
  const ui = app.ui;
  const g = app.game;
  const o = g.s.orders;
  // ---- the four customers, a portrait each; the open one underlined in red pencil
  const cw = Math.floor(p.w / CUSTOMER_IDS.length);
  CUSTOMER_IDS.forEach((c, i) => {
    const cx = p.x + i * cw + Math.floor((cw - 24) / 2), cy = p.y + 1;
    const isMet = met(app, c);
    const active = c === st.tab;
    const d = CUSTOMERS[c];
    ui.mark('cust:' + c, cx - 2, cy - 1, 28, 38);
    ui.region(cx - 2, cy - 1, 28, 38, 'button');
    const hov = ui.hover(cx - 2, cy - 1, 28, 38) && isMet;
    const cheer = st.cheer?.who === c && ui.time < st.cheer.until;
    if (isMet) {
      customerPortrait(app, c, cx, cy + (hov && !active ? -1 : 0), 24, cheer);
      const of = Math.min(3, d.rewards.length);
      hearts(app, cx + 12 - Math.floor((of * 8 - 1) / 2), cy + 27, Math.min(of, o.rep[c] ?? 0), of);
    } else {
      section(ui, cx, cy, 24, 24);
      uiIcon(ui, 'lock', cx + 4, cy + 4);
    }
    if (active) pencil(ui, cx - 3, cy + 35, 30, T.badFill);
    // open orders: a red count on the portrait's corner, bobbing now and then
    const open = ORDERS.filter((q) => q.customer === c && !o.done.includes(q.id) && q.requires.every((rq) => g.done(rq))).length;
    if (isMet && open && !active) {
      const bob = Math.floor(ui.time * 2 + i) % 4 === 0 ? 1 : 0;
      dot(ui, cx + 21, cy - bob);
      ui.small(String(open), cx + 27, cy - 2 - bob, T.bad);
    }
    if (ui.hover(cx - 2, cy - 1, 28, 38)) {
      ui.tip(isMet ? [{ text: `{big:${d.name}}` }, { text: d.title, color: T.inkSoft }, ...(open ? [{ text: `{u:orders} ${open} open` }] : [])] : [{ text: '{u:lock} {big:???}' }, { text: arrives(c) }], 190);
      if (isMet && ui.clicked) { ui.eat(); ui.sfx('click'); st.tab = c; }
    }
  });
  let y = p.y + 40;
  rule(ui, p.x, y - 2, p.w, true);
  const who = st.tab;
  const cu = CUSTOMERS[who];
  const rep = o.rep[who] ?? 0;
  const mine = ORDERS.filter((q) => q.customer === who);
  const filled = mine.filter((q) => o.done.includes(q.id)).length;
  const cheer = st.cheer?.who === who && ui.time < st.cheer.until;
  const bottom = p.y + p.h;
  // ---- what they say: the active order's pitch, else a thank-you, else their opening line
  const active = o.active ? ORDER[o.active] : null;
  const quote = cheer && filled ? cu.thanks[(filled - 1) % cu.thanks.length]
    : active && active.customer === who ? active.pitch
      : filled ? cu.thanks[(filled - 1) % cu.thanks.length]
        : who === 'bramble' ? 'Got anything for me? The swamp is always buying!' : mine[0].pitch;
  // the perks and rewards decide whether the portrait fits at 48
  let perks = perkRows(app, who, rep);
  const foot = who === 'unit7' ? 18 : 0;
  // every reward row is a fact to keep: the rows (and the next one's "how") come first, then the
  // portrait at 48, then the Drill-stage perks (they repeat the Committee's reward rows)
  const rewardH = cu.rewards.reduce((s, rw) => s + layoutRich(rw.text, p.w - 24).h + 2, 0) + 13;
  const fixed = 8 + bubbleHeight(quote, p.w - 12) + 6 + BIG_H + 4 + rewardH + foot;
  const room = (ps: number, n: number) => bottom - y - (ps + fixed + n * ROW_H);
  if (room(24, perks.length) < 0) perks = perks.filter((q) => !q[0].startsWith('{u:mega}'));
  const big = room(48, perks.length) >= 0;
  const ps = big ? 48 : 24;
  customerPortrait(app, who, p.x + 1, y + 1, ps, cheer);
  const nx = p.x + ps + 7;
  ui.big(cu.name, nx, y + 1, INK[who]);
  if (big) {
    drawLayout(ui, layoutRich(`{soft:${cu.title}}`, p.x + p.w - nx), nx, y + 14, T.inkSoft);
    const hy = y + 14 + layoutRich(`{soft:${cu.title}}`, p.x + p.w - nx).h + 3;
    const hw = hearts(app, nx, hy, rep, cu.rewards.length);
    chip(ui, nx + hw + 5, hy - 2, `${filled}/${mine.length} filled`, { role: filled === mine.length ? 'good' : 'ink' });
  } else {
    const hw = hearts(app, nx, y + 14, rep, cu.rewards.length);
    const cw = chip(ui, nx + hw + 5, y + 12, `${filled}/${mine.length}`, { role: filled === mine.length ? 'good' : 'ink' });
    // no room for the ribbon on a 24 px portrait: the cheer is a gold chip after the count
    if (cheer && nx + hw + 5 + cw + 4 + chipWidth('Yay!') <= p.x + p.w) chip(ui, nx + hw + 5 + cw + 4, y + 12, 'Yay!', { role: 'coin', solid: true });
  }
  if (cheer && big) ribbon(ui, p.x - 3, y + ps - 6, ps + 8, 'Yay!', { color: 'gold', tails: 'in', big: false });
  y += ps + 8;
  // ---- the speech bubble, its tail up at the portrait
  const L = layoutRich(quote, p.w - 12);
  const bh = L.h + 9;
  const bc = bubble(ui, p.x, y + 5, p.w, bh, { side: 'top', at: Math.floor(ps / 2) + 1 });
  drawLayout(ui, L, bc.x, bc.y, T.ink);
  y += bh + 10;
  // ---- reputation and its rewards
  y += heading(ui, 'Reputation', p.x, y, p.w, 'bad');
  for (const rw of cu.rewards) {
    const got = rep >= rw.rep;
    const next = rw.rep === rep + 1;
    const RL = layoutRich(rw.text, p.w - 24);
    if (y + RL.h > bottom - foot - perks.length * ROW_H) break;
    ui.text(`${rw.rep}${ICON.heart}`, p.x, y, got ? T.bad : next ? T.coin : T.inkSoft);
    drawLayout(ui, RL, p.x + 16, y, got ? T.good : next ? T.ink : T.inkSoft);
    if (got) ui.text(ICON.check, p.x + p.w - 6, y, T.good);
    y += RL.h + 2;
    if (next && y + 11 <= bottom - foot - perks.length * ROW_H) {
      const can = mine.find((q) => !o.done.includes(q.id) && q.requires.every((rq) => g.done(rq)));
      const later = mine.find((q) => !o.done.includes(q.id));
      const how = can ? `→ fill {coinc:${can.name}}` : later ? `→ needs ${later.requires.filter((rq) => !g.done(rq)).map((rq) => `{research:${RESEARCH[rq].name}}`).join(' · ')}` : '{soft:no orders left}';
      const HL = layoutRich(how, p.w - 24);
      drawLayout(ui, HL, p.x + 16, y, T.inkSoft);
      y += HL.h + 2;
    }
  }
  // ---- their perks at work now, ruled rows at the foot
  let py = Math.max(y + 2, bottom - foot - perks.length * ROW_H);
  for (const [k, v] of perks) {
    if (py + ROW_H > bottom - foot + 1) break;
    py += kvRowSafe(app, p.x, py, p.w, k, v);
  }
  if (who === 'unit7' && bottom - 15 >= py - 1) {
    if (button(ui, 'openCodex', p.x, bottom - 16, p.w, 16, '{u:codex} The Codex', { gold: rep >= 1, tip: [{ text: '{u:codex} every item, with its story' }, { text: `a first delivery of each pays {coinc:30×} · {u:heart} 1` }] })) app.panel = 'codex';
  }
}

function kvRowSafe(app: App, x: number, y: number, w: number, k: string, v: string): number {
  const ui = app.ui;
  drawLayout(ui, layoutRich(k), x, y + 2, T.inkSoft);
  drawLayout(ui, layoutRich(v), x + w, y + 2, T.ink, { align: 'right' });
  rule(ui, x, y + ROW_H - 2, w);
  return ROW_H;
}

/** What a customer has paid, and their perks working right now: [label, value] rows. */
function perkRows(app: App, who: CustomerId, rep: number): [string, string][] {
  const g = app.game;
  const o = g.s.orders;
  const mine = ORDERS.filter((q) => q.customer === who);
  const paid = mine.filter((q) => o.done.includes(q.id)).reduce((n, q) => n + q.pays, 0);
  const rows: [string, string][] = [['{u:coin} paid you', `{coin:${Num.of(paid).format()}}`]];
  // the Committee's reputation opens the Great Drill's stages
  if (who === 'committee') for (const m of MEGA) if (m.rep) rows.push([`{u:mega} Drill stage ${m.stage} · ${m.rep}${ICON.heart}`, rep >= m.rep ? '{good:open}' : `{warn:${m.rep - rep} more ${ICON.heart}}`]);
  if (who === 'bramble') {
    if (rep >= 1) rows.push(['{i:ironPlate} sells for', `{coin:${fmt(saleValue(g, 'ironPlate'))}}`]);
    if (rep >= 2) rows.push(['{u:kit} free Buffer Crates', `${g.s.freeCrates}/${RULES.repCrateMax.value}`]);
  } else if (who === 'unit7') rows.push(['{u:codex} Codex entries', `${g.s.codex.length}`]);
  else if (who === 'voltaire') rows.push(['{u:power} grids on the Workshop', `${g.grids.length}`]);
  return rows;
}
