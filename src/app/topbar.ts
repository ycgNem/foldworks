// The top bar (docs/ui-redesign.md): one thin plate across the top. On the left the coin counter,
// the one loud thing on the screen (big gold digits that roll, bump and sparkle; the rate beside
// them; hovering drops down the old Shipping card), then Machine Kits and the power readout once
// they exist, and the line-health chip (green, yellow, red and blue counts; a click jumps to the
// next problem, Factorio-style). The floor tabs in the middle. The menus on the right as icon
// buttons with a dot when something waits inside (the label and key are in the tooltip).
import { C, rgba } from '../data/palette';
import { RESEARCH } from '../data/research';
import { TROPHIES } from '../data/trophies';
import { ITEMS, ITEM_IDS, type ItemId } from '../data/items';
import { MEGA } from '../data/megaprojects';
import { CLAIM_PRICE } from '../data/land';
import { TICK_RATE } from '../engine/time';
import { Num } from '../engine/num';
import { textWidth, smallWidth, ICON } from '../ui/font';
import { itemIcon } from '../render/sprites';
import { offeredOrders } from '../sim/systems/orders';
import { powered, powerTotals, kw } from '../render/powerview';
import { plate, plateRaw, coinIcon, sparkline, uiIcon, dot, label, bar, type UIconName } from './chrome';
import { icon, tab } from './widgets';
import type { Layout } from './layout';
import type { App } from './app';

/** Something not working for a share of the last minute: a Workshop machine or a Factory module. */
interface Problem { floor: 'workshop' | 'factory'; id: number; x: number; y: number; share: number }

function badShare(hist: string, state: string): number {
  if (!hist.length) return state === 'blocked' || state === 'starved' ? 1 : 0;
  let n = 0;
  for (const c of hist) if (c === 's' || c === 'b' || c === 'x') n++;
  return n / hist.length;
}

export function fmtRate(v: number) {
  if (v < 1000) return String(Math.round(v));
  if (v < 1e6) return (v / 1000).toFixed(1) + 'K';
  return (v / 1e6).toFixed(2) + 'M';
}

function fmtKw(v: number) {
  if (v < 10000) return Math.round(v).toLocaleString('en-US');
  return (v / 1000).toFixed(1) + 'K';
}

interface Menu { id: string; icon: UIconName; name: string; key: string; panel: Parameters<App['togglePanel']>[0]; tip: string; dot: boolean }

/** A menu another file adds to the top bar (Milestones 5 and 6: Patents, Blueprints...). */
export interface MenuDef { id: string; icon: UIconName; name: string; key?: string; panel: Parameters<App['togglePanel']>[0]; tip: string; show: (app: App) => boolean; dot?: (app: App) => boolean; group?: 'game' | 'book' }
const MENUS: MenuDef[] = [];
/** Add an icon menu to the top bar: registerMenu({ id: 'patents', icon: 'star', name: 'Patents', panel: 'patents', tip: '...', show: (app) => app.game.done('x') }). */
export function registerMenu(m: MenuDef) { if (!MENUS.some((q) => q.id === m.id)) MENUS.push(m); }

/** A counter another file adds beside Machine Kits and power (Patents): it draws at (x, 7) and returns its width. */
export interface CounterDef { id: string; show: (app: App) => boolean; draw: (app: App, x: number, y: number) => number }
const COUNTERS: CounterDef[] = [];
export function registerCounter(c: CounterDef) { if (!COUNTERS.some((q) => q.id === c.id)) COUNTERS.push(c); }

export function topBar(app: App, L: Layout, dt: number) {
  const ui = app.ui;
  const g = app.game;
  const h = app.hud;
  const T = L.top;
  plate(ui, T.x - 2, T.y - 2, T.w + 4, T.h + 3, { alpha: 0.92 });
  sampleShipping(app);

  // ---- the menus, right to left, so the rest knows the room it has
  const menus: Menu[] = [];
  const m = (id: string, ic: UIconName, name: string, key: string, panel: Menu['panel'], tip: string, d = false) => menus.push({ id, icon: ic, name, key, panel, tip, dot: d });
  m('research', 'research', 'Research', 'T', 'research', 'The research tree: the Hopper pays in items', !g.s.research.selected && g.s.research.done.length < Object.keys(RESEARCH).length && g.has('bellows'));
  m('orders', 'orders', 'Orders', 'O', 'orders', 'Customers and their orders', !g.s.orders.active && offeredOrders(g).length > 0);
  if (g.done('folding')) m('modules', 'fold', 'Modules', 'I', 'modules', 'Your folded modules: stamp, unfold, place', g.s.designs.some((d) => d.spare > 0) && app.floor === 'factory' && !g.s.factory.ents.some((e) => e.kind === 'module'));
  if (g.s.orders.rep.unit7 >= 1) m('codex', 'codex', 'Codex', '', 'codex', "Unit 7's Codex: every item, and a first-delivery bonus for each", !h.opened.has('codex') || g.s.codex.length > h.codexSeen);
  if (g.done('surveying')) {
    const cheapest = Math.min(...CLAIM_PRICE.map((c) => c.price * (1 + 0.5 * (g.s.claimBlocks[c.item] ?? 0))));
    m('survey', 'survey', 'Survey', '', 'survey', 'The Survey Office: buy deposit claims, 4 at a time', !h.opened.has('survey') || g.s.coin.gte(cheapest));
  }
  if (g.done('greatDrill')) m('mega', 'mega', 'Megaproject', '', 'mega', `The Megaproject: ${MEGA.find((q) => q.stage === g.s.mega.stage + 1)?.name ?? 'the Great Drill'}`, !h.opened.has('mega'));
  for (const q of MENUS) if (q.group !== 'book' && q.show(app)) m(q.id, q.icon, q.name, q.key ?? '', q.panel, q.tip, q.dot?.(app) ?? false);
  const trophyCount = TROPHIES.filter((t) => g.flag('trophy:' + t.id)).length;
  const book: Menu[] = [];
  book.push({ id: 'stats', icon: 'stats', name: 'Statistics', key: '', panel: 'stats', tip: 'The run in numbers, and everything delivered', dot: false });
  book.push({ id: 'trophies', icon: 'trophies', name: `Trophies ${trophyCount}/${TROPHIES.length}`, key: '', panel: 'trophies', tip: 'The Trophy Shelf', dot: false });
  for (const q of MENUS) if (q.group === 'book' && q.show(app)) book.push({ id: q.id, icon: q.icon, name: q.name, key: q.key ?? '', panel: q.panel, tip: q.tip, dot: q.dot?.(app) ?? false });
  book.push({ id: 'options', icon: 'options', name: 'Options', key: '/', panel: 'options', tip: 'Sound, saves, keys', dot: false });
  const BW = 18, BG = 2;
  const menusW = (menus.length + book.length) * (BW + BG) + 6;
  let rx = T.w - 3;
  for (const it of [...book].reverse()) { rx -= BW; menuButton(app, it, rx, 2, BW); rx -= BG; }
  rx -= 6;
  ui.fill(rx + 2, 4, 1, 12, C.hull0);
  for (const it of [...menus].reverse()) { rx -= BW; menuButton(app, it, rx, 2, BW); rx -= BG; }

  // ---- the coin counter
  const x0 = 4;
  const real = g.s.coin.toNumber();
  if (!isFinite(real) || real > 1e12 || Math.abs(real - h.coinShown) > 1e9) h.coinShown = real;
  else h.coinShown += (real - h.coinShown) * Math.min(1, dt * 10);
  if (Math.abs(real - h.coinShown) < 0.5) h.coinShown = real;
  const shown = real > 1e12 ? g.s.coin.format() : Num.of(Math.max(0, Math.round(h.coinShown))).format();
  const sc = textWidth(shown) * 2 <= (L.wide ? 96 : 76) ? 2 : 1;
  const numW = textWidth(shown) * sc;
  if (h.coinLast >= 0 && real > h.coinLast) {
    // a bigger bump for a bigger gain
    const gain = (real - h.coinLast) / Math.max(1, h.coinLast);
    h.coinBump = Math.max(h.coinBump, Math.min(1.6, 0.8 + gain * 8));
    if (h.glints.length < 12 && Math.random() < 0.6) h.glints.push({ x: x0 + 20 + Math.random() * numW, y: 2 + Math.random() * 14, t: 0 });
  }
  h.coinLast = real;
  h.coinBump = Math.max(0, h.coinBump - dt * 4);
  coinIcon(ui, x0, 2 - (h.coinBump > 0.5 ? 1 : 0));
  const bump = h.coinBump > 0.4 ? (h.coinBump > 1 ? 2 : 1) : 0;
  const numX = x0 + 20, numY = (sc === 2 ? 3 : 7) - bump;
  ui.text(shown, numX, numY, h.coinBump > 0.9 ? C.hot : C.gold, { scale: sc, shadow: C.brass0 });
  // a shine that sweeps across the number now and then
  const sweep = (ui.time * 0.6) % 3;
  if (sweep < 1) {
    const sx = numX + Math.floor(sweep * (numW + 10)) - 5;
    ui.ctx.save();
    ui.ctx.beginPath();
    ui.ctx.rect(numX, numY, numW, 7 * sc);
    ui.ctx.clip();
    ui.ctx.fillStyle = rgba(C.bone, 0.45);
    ui.ctx.fillRect(sx, numY, 2, 7 * sc);
    ui.ctx.restore();
  }
  for (const gl of h.glints) gl.t += dt;
  h.glints = h.glints.filter((gl) => gl.t < 0.5);
  for (const gl of h.glints) {
    const k = gl.t < 0.25 ? 1 : 0;
    ui.ctx.fillStyle = gl.t < 0.15 ? C.bone : C.hot;
    ui.ctx.fillRect(Math.round(gl.x), Math.round(gl.y - k), 1, 3);
    ui.ctx.fillRect(Math.round(gl.x) - 1, Math.round(gl.y + 1 - k), 3, 1);
  }
  const rate = g.incomePerMin();
  const rs = rate > 0 ? `+${fmtRate(rate)}/min` : '0/min';
  let x = numX + numW + 5;
  x += ui.text(rs, x, 7, rate > 0 ? C.leaf : C.hull1) + 4;
  const coinEnd = x;
  app.renderer.coinTarget = { x: (x0 + 8) * ui.scale, y: 10 * ui.scale };
  if (app.mouseIn && ui.hover(0, 0, coinEnd, T.h)) coinCard(app, coinEnd);

  // ---- Machine Kits and power, once they exist
  const sep = () => { ui.fill(x, 4, 1, 12, C.hull0); x += 5; };
  // the room the middle needs: the chip, and the floor tabs at their smallest
  const room = () => rx - x - 4;
  if (g.done('machineKits') || g.s.parts.gt(0)) {
    sep();
    const s = g.s.parts.format();
    icon(app, 'kit', x, 6, true);
    const w = 10 + ui.text(s, x + 10, 7, g.s.parts.gt(0) ? C.bone : C.hull1);
    ui.hint(x - 2, 0, w + 4, T.h, [{ text: 'Machine Kits', color: C.gold }, { text: 'Stamping a module made of Act II machines takes Machine Kits as well as coin. A Hopper banks the kits that reach it.' }], 190);
    x += w + 5;
  }
  for (const c of COUNTERS) {
    if (!c.show(app)) continue;
    sep();
    x += c.draw(app, x, 7) + 5;
  }
  if (g.grids.length > 0) {
    sep();
    const t = powerTotals(g);
    const col = t.demand > 0 && t.supply <= 0 ? C.pipBlue : t.worst < 1 ? C.pipYellow : C.pipGreen;
    const flick = t.worst < 1 && t.demand > 0 && Math.floor(ui.time * 6) % 3 === 0;
    const x1 = x;
    ui.text(ICON.bolt, x, 7, flick ? C.hull1 : col, { shadow: C.ink });
    x += 7;
    x += ui.text(`${fmtKw(t.demand)}/${fmtKw(t.supply)}`, x, 7, col) + 2;
    x += ui.small('KW', x, 9, C.hull2) + 3;
    if (room() > 190) {
      bar(ui, x, 8, 22, 5, t.supply > 0 ? Math.min(1, t.demand / t.supply) : t.demand > 0 ? 1 : 0, t.worst < 1 ? C.pipYellow : C.teal1);
      x += 26;
    }
    ui.hint(x1 - 2, 0, x - x1 + 2, T.h, [
      { text: 'Power: demand / supply', color: C.pipBlue },
      { text: `Machines want ${kw(t.demand)}; the engines make ${kw(t.supply)}, across ${t.grids} grid${t.grids > 1 ? 's' : ''}.` },
      { text: t.demand > 0 && t.supply <= 0 ? 'No fuelled producer: feed the Boilers and Generators coal.' : t.worst < 1 ? `Brownout: a grid gets ${Math.round(t.worst * 100)}% of what it wants, so its machines run at that speed. Add an engine, or fuel.` : 'Every grid has the power it wants.', color: t.worst < 1 || t.supply <= 0 ? C.pipYellow : C.hull2 },
    ], 200);
  }
  // the line-health chip, once there is a line to be healthy (the first minute shows one goal)
  if (g.miners.length || g.s.research.done.length || g.s.factory.ents.some((e) => e.kind === 'module')) {
    sep();
    x = healthChip(app, x, 3) + 6;
  }

  // ---- the floor tabs, in the middle of what is left
  const labels = rx - x >= 2 * (24 + textWidth('Workshop')) + 10;
  const fw = (s: string) => (labels ? 22 + textWidth(s) : 22);
  const tw = fw('Workshop') + 2 + fw('Factory');
  const mid = Math.floor(T.w / 2 - tw / 2);
  const fx = Math.max(x, Math.min(mid, rx - 6 - tw));
  // one floor until Folding is researched: no tabs to choose between
  if (fx + tw <= rx - 2 && (g.done('folding') || g.flag('factoryOpen'))) {
    if (tab(app, 'floorWorkshop', fx, 3, fw('Workshop'), 15, labels ? 'Workshop' : '', { icon: 'workshop', active: app.floor === 'workshop', tip: 'The Workshop floor (Tab)' })) app.setFloor('workshop');
    const open = g.flag('factoryOpen');
    const fresh = open && !g.flag('factorySeen');
    if (tab(app, 'floorFactory', fx + fw('Workshop') + 2, 3, fw('Factory'), 15, labels ? 'Factory' : '', { icon: 'factory', active: app.floor === 'factory', disabled: !open, tip: open ? 'The Factory floor (Tab)' : 'The Factory floor opens with your first fold' })) app.setFloor('factory');
    if (fresh && Math.floor(ui.time * 3) % 2 === 0) dot(ui, fx + tw - 5, 4, C.gold);
  }
  void menusW;
}

/** One menu: an icon key, teal when its screen is open, with a dot when something waits inside. */
function menuButton(app: App, it: Menu, x: number, y: number, w: number) {
  const ui = app.ui;
  const h = 16;
  ui.mark(it.id, x, y, w, h);
  ui.region(x, y, w, h, 'button');
  const active = app.panel === it.panel;
  const hov = ui.hover(x, y, w, h);
  if (active || hov) {
    ui.fill(x, y, w, h, active ? C.teal0 : C.hull0, 0.9);
    ui.fill(x, y, w, 1, active ? C.teal1 : C.hull1);
  }
  const down = hov && ui.input.mouse.down[0] ? 1 : 0;
  uiIcon(ui, it.icon, x + Math.floor((w - 16) / 2), y + down);
  // an unopened screen's dot blinks; one with news inside holds steady
  if (it.dot && (app.hud.opened.has(it.panel) || Math.floor(ui.time * 2.5) % 2 === 0)) dot(ui, x + w - 4, y + 1, app.hud.opened.has(it.panel) ? C.pipRed : C.gold);
  if (hov) {
    ui.hoverId = it.id;
    ui.tip([{ text: it.key ? `${it.name}  (${it.key})` : it.name, color: C.gold }, { text: it.tip }], 180);
    if (ui.clicked) {
      ui.eat();
      ui.sfx('click');
      app.togglePanel(it.panel);
    }
  }
}

/** The line-health chip: how many machines and modules work, starve, block, or want power; a
 *  click jumps to the next problem (the worst share of the last minute first) and opens it. */
function healthChip(app: App, x0: number, y: number): number {
  const ui = app.ui;
  const g = app.game;
  const h = app.hud;
  const all = [...g.miners, ...g.machines];
  const mods = g.s.factory.ents.filter((e) => e.kind === 'module');
  let work = 0, starved = 0, blocked = 0, unpowered = 0;
  for (const m of all) {
    if (m.state === 'work') work++;
    else if (m.state === 'blocked') blocked++;
    else if (m.state === 'starved') { if (m.why === 'power') unpowered++; else starved++; }
  }
  for (const m of mods) {
    if (m.state === 'work') work++;
    else if (m.state === 'blocked') blocked++;
    else if (m.state === 'starved') starved++;
  }
  const problems: Problem[] = [];
  for (const m of all) {
    if (!(m.state === 'blocked' || (m.state === 'starved' && m.why !== 'crank'))) continue;
    const s = badShare(m.hist, m.state);
    if (s >= 0.1) problems.push({ floor: 'workshop', id: m.id, x: m.x + m.w / 2, y: m.y + m.h / 2, share: s });
  }
  for (const m of mods) {
    if (m.state !== 'blocked' && m.state !== 'starved') continue;
    const s = badShare(m.hist, m.state);
    if (s >= 0.1) problems.push({ floor: 'factory', id: m.id, x: m.x + 0.5, y: m.y + 0.5, share: s });
  }
  problems.sort((a, b) => b.share - a.share || a.id - b.id);
  const pips: [string, number][] = [[C.pipGreen, work], [C.pipYellow, starved], [C.pipRed, blocked]];
  if (unpowered || g.machines.some((m) => powered(m.kind))) pips.push([C.pipBlue, unpowered]);
  const w = pips.reduce((s, [, n]) => s + 9 + textWidth(String(n)) + 4, 0) + 4;
  const hov = ui.hover(x0, y, w, 14);
  ui.mark('nextProblem', x0, y, w, 14);
  ui.region(x0, y, w, 14, 'button');
  const alarm = problems.length > 0;
  ui.fill(x0, y, w, 14, C.ink);
  ui.fill(x0 + 1, y + 1, w - 2, 12, hov ? C.hull0 : C.shadow);
  if (alarm) ui.fill(x0 + 1, y + 1, w - 2, 1, blocked ? C.pipRed : C.pipYellow, Math.floor(ui.time * 2) % 2 ? 1 : 0.4);
  let x = x0 + 4;
  for (const [col, n] of pips) {
    ui.fill(x, y + 4, 6, 6, C.ink);
    ui.fill(x + 1, y + 5, 4, 4, n ? col : C.pipGrey);
    x += 9 + ui.text(String(n), x + 8, y + 3, n ? C.bone : C.hull1) + 4;
  }
  if (hov) {
    ui.hoverId = 'nextProblem';
    ui.tip([
      { text: 'Line health', color: C.gold },
      { text: `${work} working, ${starved} starved (waiting for an input), ${blocked} blocked (output has nowhere to go)${pips.length > 3 ? `, ${unpowered} without power` : ''}. Workshop machines and Factory modules.` },
      { text: problems.length ? `${problems.length} problem${problems.length > 1 ? 's' : ''}: click to jump to the next one, the worst first.` : 'Nothing has struggled for long: every pip green or close.', color: problems.length ? C.pipYellow : C.hull2 },
    ], 200);
    if (ui.clicked) {
      ui.eat();
      ui.sfx('click');
      if (problems.length) {
        h.problemIdx = (h.problemIdx + 1) % problems.length;
        const p = problems[h.problemIdx];
        if (p.floor === 'factory') {
          app.setFloor('factory');
          app.fselected = p.id;
        } else {
          if (app.floor !== 'workshop') app.setFloor('workshop');
          app.selected = p.id;
        }
        app.lookAt(p.x, p.y);
      }
    }
  }
  return x0 + w;
}

/** Delivered totals sampled once a game second, for the per-minute Shipping rates. */
function sampleShipping(app: App) {
  const g = app.game;
  const hs = app.hud;
  const last = hs.ship[hs.ship.length - 1];
  if (!last || g.s.tick - last.tick >= TICK_RATE || g.s.tick < last.tick) {
    if (last && g.s.tick < last.tick) hs.ship = [];
    const d: Partial<Record<ItemId, number>> = {};
    for (const id of ITEM_IDS) d[id] = g.s.delivered[id]?.toNumber() ?? 0;
    hs.ship.push({ tick: g.s.tick, d });
    if (hs.ship.length > 61) hs.ship.shift();
  }
}

/** The coin counter's drop-down (on hover): the whole number, the rate with its sparkline, the
 *  run's earnings, and Shipping: what reaches the Dock and the Hopper, per minute. */
function coinCard(app: App, minW: number) {
  const ui = app.ui;
  const g = app.game;
  const hs = app.hud;
  const a = hs.ship[0], b = hs.ship[hs.ship.length - 1];
  const span = a && b ? (b.tick - a.tick) / TICK_RATE : 0;
  const rows = b ? ITEM_IDS.filter((id) => (b.d[id] ?? 0) > 0) : [];
  const w = Math.max(minW, 184);
  const shown = rows.slice(0, 10);
  const h = 58 + (shown.length ? 12 + shown.length * 10 : 22);
  ui.later(() => {
    const x = 2, y = 21;
    plateRaw(ui.ctx, x, y, w, h, C.gold);
    label(ui, 'coin', x + 6, y + 5, C.gold);
    ui.text(`${g.s.coin.format()} coin`, x + w - 6, y + 4, C.gold, { align: 'right' });
    const rate = g.incomePerMin();
    ui.text(rate > 0 ? `+${Math.round(rate).toLocaleString('en-US')} a minute` : 'Nothing selling yet', x + 6, y + 15, rate > 0 ? C.leaf : C.hull2);
    sparkline(ui, x + 6, y + 26, w - 12, 12, g.s.income, C.brass1);
    label(ui, 'each second, the last minute', x + 6, y + 40, C.hull1);
    ui.text(`Earned this run: ${g.s.earned.format()}`, x + 6, y + 47, C.hull2);
    let yy = y + 58;
    ui.fill(x + 5, yy - 2, w - 10, 1, C.hull0);
    if (!shown.length) {
      ui.text('Nothing shipped yet.', x + 6, yy + 2, C.hull2);
      ui.text('Docks sell; the Hopper researches.', x + 6, yy + 11, C.hull1);
      return;
    }
    label(ui, 'shipping, per minute', x + 6, yy + 2, C.copper2);
    yy += 11;
    for (const id of shown) {
      const pm = span > 0 ? (((b.d[id] ?? 0) - (a.d[id] ?? 0)) / span) * 60 : 0;
      ui.ctx.drawImage(itemIcon(id), x + 6, yy);
      ui.text(ITEMS[id].name, x + 17, yy, C.bone);
      const val = pm > 0 ? `${fmtRate(pm)}/m` : Num.of(b.d[id] ?? 0).format();
      ui.text(val, x + w - 6, yy, pm > 0 ? C.leaf : C.hull2, { align: 'right' });
      yy += 10;
    }
    void smallWidth;
  });
}
