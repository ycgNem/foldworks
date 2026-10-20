// The Orders screen (DESIGN.md §7, §18 Customers): a tab per customer met (Mayor Bramble from the
// start, Unit 7 after Coal Seams, Dame Voltaire after Steam Power), each with a portrait that
// cheers when one of their orders has just been filled, their reputation and its rewards (reached
// ones lit, the next one with what it takes), their orders, and the Dock's standing prices below.
import { C } from '../data/palette';
import { RESEARCH } from '../data/research';
import { ORDERS, CUSTOMERS, ORDER, type CustomerId, type OrderDef } from '../data/orders';
import { ITEMS, ITEM_IDS, type ItemId } from '../data/items';
import { RULES } from '../data/rules';
import { ICON, textWidth } from '../ui/font';
import { itemIcon, sheet, hasArt } from '../render/sprites';
import { orderFrac } from '../sim/systems/orders';
import { saleValue } from '../sim/systems/docks';
import { Num } from '../engine/num';
import { frame, card, button, bar, portrait } from './chrome';
import { screenHeader, tab, icon, fmt } from './widgets';
import type { App } from './app';
import type { Rect } from '../ui/ui';

const CUSTOMER_IDS: CustomerId[] = ['bramble', 'unit7', 'voltaire'];
const ACCENT: Record<CustomerId, string> = { bramble: C.leaf, unit7: C.teal1, voltaire: C.hot };

/** the open tab, and the customer cheering after a fill (until when, in UI seconds) */
const st = { tab: 'bramble' as CustomerId, seen: -1, cheer: null as null | { who: CustomerId; until: number } };

export function met(app: App, c: CustomerId): boolean {
  const m = CUSTOMERS[c].meets;
  return !m || app.game.done(m);
}

/** Make a customer cheer on the Orders screen (an order of theirs was just filled). */
export function cheerFor(app: App, who: CustomerId, secs = 5) {
  st.cheer = { who, until: app.ui.time + secs };
  st.tab = who;
}

/** A customer's portrait, 48 or 24 px, cheering (the art's cheer frames bounce) when asked. */
export function customerPortrait(app: App, who: CustomerId, x: number, y: number, size: 48 | 24, cheer = false) {
  const ui = app.ui;
  const base = `portrait_${who}`;
  if (!hasArt(base) && who === 'bramble') return portrait(ui, who, x, y, size);
  frame(ui, x - 2, y - 2, size + 4, size + 4, 'inset', false);
  const ctx = ui.ctx;
  if (cheer && hasArt(base + '_cheer')) {
    const s = sheet(base + '_cheer');
    ctx.drawImage(s.frames[Math.floor(ui.time * 4) % s.frames.length], x, y, size, size);
    return;
  }
  if (size === 24 && hasArt(base + '_small')) return void ctx.drawImage(sheet(base + '_small').frames[0], x, y);
  if (hasArt(base)) {
    const s = sheet(base);
    const blink = s.frames.length > 1 && Math.floor(ui.time * 10 + who.length * 7) % 53 === 0;
    ctx.drawImage(s.frames[blink ? 1 : 0], x, y, size, size);
    return;
  }
  ui.fill(x, y, size, size, ACCENT[who]);
  ui.text(CUSTOMERS[who].name[0], x + size / 2, y + size / 2 - 4, C.ink, { align: 'center' });
}

/** Hearts for a reputation level: filled up to rep, hollow to 3. */
function hearts(app: App, x: number, y: number, rep: number, big = false) {
  const ui = app.ui;
  for (let i = 0; i < 3; i++) {
    if (big) {
      ui.ctx.globalAlpha = i < rep ? 1 : 0.25;
      icon(app, 'heart', x + i * 11, y, true);
      ui.ctx.globalAlpha = 1;
    } else ui.text(ICON.heart, x + i * 7, y, i < rep ? C.pipRed : C.hull0);
  }
}

export function ordersScreen(app: App, r: Rect) {
  const ui = app.ui;
  const g = app.game;
  const o = g.s.orders;
  // a newly filled order: its customer cheers and their tab opens
  if (st.seen >= 0 && o.done.length > st.seen) {
    const last = ORDER[o.done[o.done.length - 1]];
    if (last) cheerFor(app, last.customer);
  }
  st.seen = o.done.length;
  if (!met(app, st.tab)) st.tab = 'bramble';
  const who = st.tab;
  const cu = CUSTOMERS[who];
  const accent = ACCENT[who];
  screenHeader(app, r, `Orders: ${cu.name}`, accent, 'orders');
  // ---- the customer tabs
  const y0 = r.y + 22;
  const tw = Math.floor((r.w - 16 - 8) / 3);
  CUSTOMER_IDS.forEach((c, i) => {
    const x = r.x + 8 + i * (tw + 4);
    const isMet = met(app, c);
    const active = c === who;
    const d = CUSTOMERS[c];
    const open = ORDERS.filter((q) => q.customer === c && !o.done.includes(q.id) && q.requires.every((rq) => g.done(rq))).length;
    if (tab(app, 'cust:' + c, x, y0, tw, 30, '', { active, disabled: !isMet, tip: isMet ? `${d.name}: ${d.title}` : `Not met yet: arrives with ${RESEARCH[d.meets!].name}` })) st.tab = c;
    const cheer = st.cheer?.who === c && ui.time < st.cheer.until;
    if (isMet) customerPortrait(app, c, x + 4, y0 + 3, 24, cheer);
    else {
      ui.fill(x + 4, y0 + 3, 24, 24, C.ink);
      icon(app, 'lock', x + 8, y0 + 7);
    }
    const tx = x + 33;
    const badge = isMet && open && !active ? `${open} open` : '';
    const bw = badge ? textWidth(badge) + 4 : 0;
    ui.clip(tx, y0, x + tw - tx - 30, 14);
    ui.text(isMet ? d.name : '???', tx, y0 + 4, isMet ? (active ? ACCENT[c] : C.bone) : C.hull1, { shadow: C.ink });
    ui.unclip();
    ui.clip(tx, y0 + 14, x + tw - tx - 6 - bw, 14);
    ui.text(isMet ? d.title : `After ${RESEARCH[d.meets!].name}`, tx, y0 + 18, C.hull2);
    ui.unclip();
    if (isMet) hearts(app, x + tw - 26, y0 + 4, o.rep[c] ?? 0);
    if (badge) {
      ui.fill(x + tw - bw - 4, y0 + 17, bw, 9, C.ink);
      ui.fill(x + tw - bw - 3, y0 + 18, bw - 2, 7, C.pipRed);
      ui.text(badge, x + tw - bw - 2, y0 + 18, C.bone);
    }
  });
  const y1 = y0 + 34;
  const bottom = r.y + r.h - 6;
  // ---- the customer card
  const leftW = Math.min(184, Math.floor(r.w * 0.34));
  const pc = card(app.ui, r.x + 8, y1, leftW, bottom - y1, cu.title, accent);
  const cheer = st.cheer?.who === who && ui.time < st.cheer.until;
  const big = pc.h >= 250 && pc.w >= 170;
  const ps = big ? 96 : 48;
  const rep = o.rep[who] ?? 0;
  const mine = ORDERS.filter((q) => q.customer === who);
  const filled = mine.filter((q) => o.done.includes(q.id)).length;
  if (big) {
    // the portrait at 2x, centred, in its own frame
    const px = pc.x + Math.floor((pc.w - 96) / 2);
    frame(ui, px - 3, pc.y, 102, 102, 'inset', false);
    const base = `portrait_${who}`;
    const s = cheer && hasArt(base + '_cheer') ? sheet(base + '_cheer') : hasArt(base) ? sheet(base) : null;
    if (s) ui.ctx.drawImage(s.frames[cheer ? Math.floor(ui.time * 4) % s.frames.length : 0], px, pc.y + 3, 96, 96);
    else customerPortrait(app, who, px + 24, pc.y + 27, 48, cheer);
    if (cheer) ui.text('Delighted!', pc.x + pc.w / 2, pc.y + 104, C.gold, { align: 'center', shadow: C.ink });
  } else customerPortrait(app, who, pc.x + 2, pc.y + 3, 48, cheer);
  const ix = big ? pc.x : pc.x + 58;
  const iy = big ? pc.y + (cheer ? 114 : 106) : pc.y;
  ui.text('Reputation', ix, iy + 2, C.hull2);
  hearts(app, big ? pc.x + pc.w - 33 : ix, big ? iy + 1 : iy + 12, rep, true);
  ui.text(`${filled}/${mine.length} filled`, big ? ix : ix, big ? iy + 12 : iy + 24, C.bone);
  if (cheer && !big) ui.text('Delighted!', ix, pc.y + 36, C.gold, { shadow: C.ink });
  let y = big ? iy + 26 : pc.y + 56;
  const active = o.active ? ORDER[o.active] : null;
  const quote = active && active.customer === who ? active.pitch : filled ? cu.thanks[(filled - 1) % cu.thanks.length] : who === 'bramble' ? 'Got anything for me? The swamp is always buying.' : mine[0].pitch;
  y += ui.para(`"${quote}"`, pc.x, y, pc.w, C.bone) + 5;
  ui.text('Reputation rewards', pc.x, y, accent);
  y += 11;
  for (const rw of cu.rewards) {
    const got = rep >= rw.rep;
    const next = rw.rep === rep + 1;
    const col = got ? C.leaf : next ? C.gold : C.hull1;
    ui.text(`${rw.rep}${ICON.heart}`, pc.x, y, got ? C.pipRed : col);
    const h = ui.para(`${got ? ICON.check + ' ' : ''}${rw.text}`, pc.x + 14, y, pc.w - 14, col);
    y += h;
    if (next && y < bottom - 24) {
      const can = mine.find((q) => !o.done.includes(q.id) && q.requires.every((rq) => g.done(rq)));
      const later = mine.find((q) => !o.done.includes(q.id));
      const how = can ? `Fill one more order (${can.name})` : later ? `Next order needs ${later.requires.filter((rq) => !g.done(rq)).map((rq) => RESEARCH[rq].name).join(', ')}` : 'No orders left';
      y += ui.para(`${ICON.right} ${how}`, pc.x + 14, y, pc.w - 14, C.hull2);
    }
    y += 2;
  }
  // what the customer has paid, and their perks working right now
  const paid = mine.filter((q) => o.done.includes(q.id)).reduce((n, q) => n + q.pays, 0);
  const perks: [string, string][] = [['Paid you', Num.of(paid).format()]];
  if (who === 'bramble') {
    if (rep >= 1) perks.push(['Iron plates sell for', `${fmt(saleValue(g, 'ironPlate'))} each`]);
    if (rep >= 2) perks.push(['Free crates waiting', `${g.s.freeCrates}/${RULES.repCrateMax.value}`]);
  } else if (who === 'unit7') perks.push(['Codex entries', `${g.s.codex.length}`]);
  else if (who === 'voltaire') perks.push(['Grids on the Workshop', `${g.grids.length}`]);
  const foot = who === 'unit7' ? 16 : 0;
  let py = Math.max(y + 3, pc.y + pc.h - foot - perks.length * 10);
  for (const [k, v] of perks) {
    if (py + 9 > pc.y + pc.h - foot) break;
    ui.text(k, pc.x, py, C.hull2);
    ui.text(v, pc.x + pc.w, py, C.gold, { align: 'right' });
    py += 10;
  }
  if (who === 'unit7' && py + 15 <= pc.y + pc.h + 1) {
    if (button(ui, 'openCodex', pc.x, pc.y + pc.h - 15, pc.w, 14, `Open the Codex`, { gold: rep >= 1, icon: undefined, tip: 'Every item, with its story. A first delivery of each pays 100x its value once Unit 7 likes you.' })) app.panel = 'codex';
  }
  // ---- the orders, then the Dock's price board
  const ox = r.x + 8 + leftW + 6, ow = r.x + r.w - 8 - ox;
  let oy = y1;
  const offered = mine.filter((q) => !o.done.includes(q.id) && q.requires.every((rq) => g.done(rq)));
  const locked = mine.filter((q) => !o.done.includes(q.id) && !offered.includes(q));
  const done = mine.filter((q) => o.done.includes(q.id));
  for (const d of offered) {
    if (oy + 46 > bottom) break;
    orderCard(app, d, ox, oy, ow, 46);
    oy += 49;
  }
  for (const d of locked) {
    if (oy + 28 > bottom) break;
    lockedCard(app, d, ox, oy, ow);
    oy += 31;
  }
  for (const d of done) {
    if (oy + 18 > bottom) break;
    doneRow(app, d, ox, oy, ow);
    oy += 20;
  }
  if (bottom - oy >= 44) priceBoard(app, ox, oy, ow, bottom - oy);
}

function wantsLine(app: App, d: OrderDef, x: number, y: number, maxX: number, done: boolean) {
  const ui = app.ui;
  const p = app.game.s.orders.progress[d.id] ?? {};
  let ix = x;
  for (const [item, n] of Object.entries(d.wants) as [ItemId, number][]) {
    const have = done ? n : Math.min(n, Math.floor(p[item]?.toNumber() ?? 0));
    const s = `${fmt(have)}/${fmt(n)}`;
    const name = ITEMS[item].name.toLowerCase();
    const full = ix + 10 + textWidth(s + ' ' + name) <= maxX;
    if (ix + 10 + textWidth(s) > maxX) break;
    const label = full ? `${s} ${name}` : s;
    ui.ctx.drawImage(itemIcon(item), ix, y);
    ui.text(label, ix + 10, y, have >= n ? C.moss : C.shadow);
    ui.hint(ix, y - 1, 10 + textWidth(label), 10, `${ITEMS[item].name}: ${fmt(have)} of ${fmt(n)} delivered`, 160);
    ix += 16 + textWidth(label);
  }
}

function orderCard(app: App, d: OrderDef, x: number, y: number, w: number, h: number) {
  const ui = app.ui;
  const g = app.game;
  const o = g.s.orders;
  const active = o.active === d.id;
  frame(ui, x, y, w, h, 'paper');
  if (active) {
    ui.fill(x + 2, y + 2, 3, h - 4, ACCENT[d.customer]);
    // the active order breathes a little
    if (Math.floor(ui.time * 2) % 2 === 0) ui.fill(x + 2, y + 2, w - 4, 1, C.gold);
  }
  ui.text(d.name, x + 9, y + 5, C.ink);
  const pay = `${ICON.coin} ${Num.of(d.pays).format()}  +${d.rep}${ICON.heart}`;
  ui.text(pay, x + w - 8, y + 5, C.brass0, { align: 'right' });
  if (active) ui.text('ACTIVE', x + 13 + textWidth(d.name), y + 5, C.moss);
  wantsLine(app, d, x + 9, y + 17, x + w - 8, false);
  const f = orderFrac(g, d.id);
  bar(ui, x + 9, y + 32, w - 114, 7, f, ACCENT[d.customer], C.shadow);
  ui.text(`${Math.floor(f * 100)}%`, x + w - 82, y + 32, C.shadow, { align: 'right' });
  if (button(ui, 'ord:' + d.id, x + w - 76, y + 29, 68, 13, active ? 'Set aside' : 'Accept', { gold: !active, active, pulse: !active && !o.active, tip: active ? 'Stop filling it; progress is kept.' : `"${d.pitch}" Items sent to a Dock fill it first, then sell.` })) app.act({ k: 'order', id: active ? null : d.id });
}

function lockedCard(app: App, d: OrderDef, x: number, y: number, w: number) {
  const ui = app.ui;
  const g = app.game;
  frame(ui, x, y, w, 28, 'inset');
  ui.text(`${ICON.lock} ${d.name}`, x + 8, y + 5, C.hull2);
  ui.text(`${ICON.coin} ${Num.of(d.pays).format()}`, x + w - 8, y + 5, C.brass1, { align: 'right' });
  let ix = x + 8;
  for (const [item, n] of Object.entries(d.wants) as [ItemId, number][]) {
    if (ix + 30 > x + w / 2) break;
    ui.ctx.globalAlpha = 0.6;
    ui.ctx.drawImage(itemIcon(item), ix, y + 16);
    ui.ctx.globalAlpha = 1;
    ix += 14 + ui.text(fmt(n), ix + 10, y + 16, C.hull2);
  }
  const need = `Needs ${d.requires.filter((q) => !g.done(q)).map((q) => RESEARCH[q].name).join(', ')}`;
  ui.clip(ix + 4, y, x + w - 8 - ix - 4, 28);
  ui.text(need, x + w - 8, y + 16, C.hull1, { align: 'right' });
  ui.unclip();
}

function doneRow(app: App, d: OrderDef, x: number, y: number, w: number) {
  const ui = app.ui;
  frame(ui, x, y, w, 18, 'inset');
  ui.fill(x + 1, y + 1, 3, 16, C.leaf);
  ui.text(`${ICON.check} ${d.name}`, x + 8, y + 5, C.leaf);
  let ix = x + 14 + textWidth(`${ICON.check} ${d.name}`);
  for (const item of Object.keys(d.wants) as ItemId[]) {
    if (ix + 10 > x + w - 90) break;
    ui.ctx.drawImage(itemIcon(item), ix, y + 5);
    ix += 10;
  }
  // a little rubber stamp
  const sx = x + w - 82;
  ui.fill(sx, y + 3, 36, 12, C.leaf);
  ui.fill(sx + 1, y + 4, 34, 10, C.shadow);
  ui.text('FILLED', sx + 18, y + 5, C.leaf, { align: 'center' });
  ui.text(`+${Num.of(d.pays).format()}`, x + w - 6, y + 5, C.gold, { align: 'right' });
}

/** The standing order: what the Dock pays for each item, lit for the ones you have delivered. */
function priceBoard(app: App, x: number, y: number, w: number, h: number) {
  const ui = app.ui;
  const g = app.game;
  const inner = card(ui, x, y, w, h, 'The Dock buys everything at its value', C.brass1, 'coin');
  const items = ITEM_IDS.filter((id) => ITEMS[id].value > 0);
  const roomy = inner.h >= 40;
  const cw = roomy ? 98 : 58, rh = roomy ? 21 : 11;
  const cols = Math.max(1, Math.floor(inner.w / cw));
  const rows = Math.max(1, Math.floor((inner.h + 1) / rh));
  // the ones you have sold first, then the rest
  const sorted = [...items.filter((id) => g.s.delivered[id]?.gt(0)), ...items.filter((id) => !g.s.delivered[id]?.gt(0))];
  sorted.slice(0, cols * rows).forEach((id, i) => {
    const cx = inner.x + (i % cols) * cw, cy = inner.y + Math.floor(i / cols) * rh;
    const got = !!g.s.delivered[id]?.gt(0);
    const v = saleValue(g, id);
    const bonus = v > ITEMS[id].value;
    if (roomy) {
      ui.fill(cx, cy, 18, 18, got ? C.ground1 : C.ink);
      ui.ctx.globalAlpha = got ? 1 : 0.35;
      ui.ctx.drawImage(itemIcon(id), cx + 1, cy + 1, 16, 16);
      ui.ctx.globalAlpha = 1;
      ui.clip(cx + 21, cy, cw - 24, 20);
      ui.text(ITEMS[id].name, cx + 21, cy, got ? C.bone : C.hull1);
      ui.text(`${ICON.coin}${fmt(v)}${got ? `  ${g.s.delivered[id]!.format()} sold` : ''}`, cx + 21, cy + 10, bonus ? C.leaf : got ? C.gold : C.hull1);
      ui.unclip();
    } else {
      ui.ctx.globalAlpha = got ? 1 : 0.35;
      ui.ctx.drawImage(itemIcon(id), cx, cy);
      ui.ctx.globalAlpha = 1;
      ui.text(fmt(v), cx + 10, cy, bonus ? C.leaf : got ? C.gold : C.hull1);
    }
    ui.hint(cx, cy - 1, cw - 2, rh, [{ text: ITEMS[id].name, color: C.gold }, { text: `${fmt(v)} coin each at the Dock${bonus ? ` (+${Math.round(RULES.repPlateBonus.value * 100)}%: Bramble's reputation)` : ''}.` }, { text: got ? `Delivered so far: ${g.s.delivered[id]!.format()}` : 'Not delivered yet.', color: C.hull2 }], 170);
  });
}
