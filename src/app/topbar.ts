// The pieces that hang on the screen's corners (docs/hud-180.md "The screen"), now that there is no
// top bar. Top-left, the Purse: a wooden sign on two ropes with the coin counter in the display
// face at 2x, gold with an ink outline, that rolls, bumps and sparkles; the rate on a tag hanging
// under it; hovering hangs the Shipping tag. Under it the trouble bell (only while something is
// wrong; it swings when a new problem starts, a click jumps to the next one, worst first, and pins
// its report), red edge arrows for problems off the screen and gold ones for Sparks, and whatever
// counters other files register (Milestone 5's contract slip). Top-right, the lift: a brass dial in
// a wooden case, a button for each floor (Tab still works). Bottom-right, the notebook that opens
// the book at the last page, and, while a page is open, its section tabs down the book's right
// edge. The menus registry (registerMenu) and the counters registry keep their pre-180 signatures.
import { C } from '../data/palette';
import { RESEARCH } from '../data/research';
import { TROPHIES } from '../data/trophies';
import { ITEMS, ITEM_IDS, type ItemId } from '../data/items';
import { MEGA } from '../data/megaprojects';
import { CLAIM_PRICE } from '../data/land';
import { TICK_RATE } from '../engine/time';
import { Num } from '../engine/num';
import { plain } from '../engine/fmt';
import { bigWidth, BIG_LINE_H, LINE_H, ICON } from '../ui/font';
import { layoutRich, drawLayout, richWidth } from '../ui/rich';
import { T } from '../ui/theme';
import { outlinedText, ribbonRaw, type RibbonColor } from '../ui/paper';
import { itemIcon, hasArt, sheet, frameNamed } from '../render/sprites';
import { offeredOrders } from '../sim/systems/orders';
import { powered } from '../render/powerview';
import { sign, tag, tagSize, coinIcon, sparkline, dot, uiIcon, rule, chip, chipWidth, type UIconName } from './chrome';
import type { Layout } from './layout';
import type { Rect } from '../ui/ui';
import type { App } from './app';
import type { ScreenName } from './screens';

export function fmtRate(v: number) {
  return plain(v, v < 10 ? 1 : 0); // Milestone 6: through the one number helper (DESIGN.md §20)
}

// ------------------------------------------------------------------ registries

/** A menu another file adds (Milestones 5 and 6: Patents, the Drawer, Overnight): a page of the
 * notebook, shown as a section tab while the book is open. */
export interface MenuDef { id: string; icon: UIconName; name: string; key?: string; panel: Parameters<App['togglePanel']>[0]; tip: string; show: (app: App) => boolean; dot?: (app: App) => boolean; group?: 'game' | 'book' }
const MENUS: MenuDef[] = [];
/** Add a page to the notebook: registerMenu({ id: 'patents', icon: 'star', name: 'Patents', panel: 'patents', tip: '...', show: (app) => app.game.done('x') }). */
export function registerMenu(m: MenuDef) { if (!MENUS.some((q) => q.id === m.id)) MENUS.push(m); }

/** A counter another file hangs under the Purse (Milestone 5: the Committee's contract slip): it
 * draws at (x, y) and returns its width; `room` is the width it may take. Each takes a 30 px row. */
export interface CounterDef { id: string; show: (app: App) => boolean; draw: (app: App, x: number, y: number, room: number) => number }
const COUNTERS: CounterDef[] = [];
export function registerCounter(c: CounterDef) { if (!COUNTERS.some((q) => q.id === c.id)) COUNTERS.push(c); }

// ------------------------------------------------------------------ shipping

/** Delivered totals sampled once a game second, for the per-minute Shipping rates. */
export function sampleShipping(app: App) {
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

/** What reached the Dock and the Hopper a minute, per item, over the last minute. */
export function shipRates(app: App): Map<ItemId, number> {
  const hs = app.hud;
  const out = new Map<ItemId, number>();
  const a = hs.ship[0], b = hs.ship[hs.ship.length - 1];
  const span = a && b ? (b.tick - a.tick) / TICK_RATE : 0;
  if (!b || span <= 0) return out;
  for (const id of ITEM_IDS) {
    const pm = (((b.d[id] ?? 0) - (a.d[id] ?? 0)) / span) * 60;
    if (pm > 0) out.set(id, pm);
  }
  return out;
}

// ------------------------------------------------------------------ the Purse

/** The Purse and the rate tag under it. Returns the y under them (the bell hangs there). */
export function purse(app: App, L: Layout, dt: number): number {
  const ui = app.ui;
  const g = app.game;
  const h = app.hud;
  sampleShipping(app);
  // the roll toward the real number
  const real = g.s.coin.toNumber();
  if (!isFinite(real) || real > 1e12 || Math.abs(real - h.coinShown) > 1e9) h.coinShown = real;
  else h.coinShown += (real - h.coinShown) * Math.min(1, dt * 10);
  if (Math.abs(real - h.coinShown) < 0.5) h.coinShown = real;
  const shown = real > 1e12 ? g.s.coin.format() : Num.of(Math.max(0, Math.round(h.coinShown))).format();
  const numW = bigWidth(shown) * 2;
  const P = L.purse;
  const w = Math.max(84, numW + 40), ph = P.h;
  const x0 = P.x, y0 = P.y;
  if (h.coinLast >= 0 && real > h.coinLast) {
    // a bigger bump for a bigger gain
    const gain = (real - h.coinLast) / Math.max(1, h.coinLast);
    h.coinBump = Math.max(h.coinBump, Math.min(1.6, 0.8 + gain * 8));
    if (h.glints.length < 12 && Math.random() < 0.6) h.glints.push({ x: x0 + 26 + Math.random() * numW, y: y0 + 5 + Math.random() * 18, t: 0 });
  }
  h.coinLast = real;
  h.coinBump = Math.max(0, h.coinBump - dt * 4);
  const hov = app.mouseIn && ui.hover(x0, 0, w, y0 + ph + 26);
  ui.mark('purse', x0, y0, w, ph);
  const c = sign(ui, x0, y0, w, ph, { ropeTop: 0 });
  coinIcon(ui, c.x + 1, c.y + Math.floor((c.h - 16) / 2) - (h.coinBump > 0.5 ? 1 : 0));
  const bump = h.coinBump > 0.4 ? (h.coinBump > 1 ? 2 : 1) : 0;
  const nx = c.x + 21, ny = c.y + Math.floor((c.h - 18) / 2) - bump;
  const col = h.coinBump > 0.9 ? C.lamp3 : T.floorCoin;
  ui.big(shown, nx, ny, col, { scale: 2, outline: T.ink });
  // a shine that sweeps across the digits now and then: the number again in a lighter gold,
  // through a narrow window
  const sweep = (ui.time * 0.6) % 3;
  if (sweep < 1) {
    const sx = nx + Math.floor(sweep * (numW + 10)) - 5;
    ui.ctx.save();
    ui.ctx.beginPath();
    ui.ctx.rect(sx, ny - 2, 3, 26);
    ui.ctx.clip();
    outlinedText(ui.ctx, shown, nx, ny, C.lamp3, T.ink, 2, true);
    ui.ctx.restore();
  }
  for (const gl of h.glints) gl.t += dt;
  h.glints = h.glints.filter((gl) => gl.t < 0.5);
  for (const gl of h.glints) {
    const k = gl.t < 0.25 ? 1 : 0;
    ui.ctx.fillStyle = gl.t < 0.15 ? C.bone : C.lamp3;
    ui.ctx.fillRect(Math.round(gl.x), Math.round(gl.y - k), 1, 3);
    ui.ctx.fillRect(Math.round(gl.x) - 1, Math.round(gl.y + 1 - k), 3, 1);
  }
  // flying coins land on the Purse's coin
  app.renderer.coinTarget = { x: (c.x + 9) * ui.scale, y: (c.y + c.h / 2) * ui.scale };
  // the rate, on a tag hanging under the sign
  const rate = g.incomePerMin();
  const rs = rate > 0 ? `{coinc:+${fmtRate(rate)}/min}` : '{soft:0/min}';
  const rw = richWidth(rs);
  const rz = tagSize(rw, LINE_H - 2, 'left');
  const ry = y0 + ph + 5;
  const rt = tag(ui, x0 + 12, ry, rz.w, rz.h, { hole: 'left', anchor: { x: x0 + 14, y: y0 + ph - 2 } });
  drawLayout(ui, layoutRich(rs), rt.x, rt.y);
  if (hov) shippingTag(app, x0, ry + rz.h + 4);
  return ry + rz.h;
}

/** The Shipping tag (on the Purse's hover): the whole number, the rate and its last minute, the
 * run's earnings, and what reached the Dock and the Hopper a minute, each with its icon. */
function shippingTag(app: App, x: number, y: number) {
  const ui = app.ui;
  const g = app.game;
  const hs = app.hud;
  const b = hs.ship[hs.ship.length - 1];
  const rates = shipRates(app);
  const rows = b ? ITEM_IDS.filter((id) => (b.d[id] ?? 0) > 0).slice(0, 10) : [];
  const cw = 168;
  const rh = rows.length ? 10 + rows.length * 10 : 22;
  const ch = BIG_LINE_H + 3 + LINE_H + 16 + LINE_H + 4 + rh;
  const sz = tagSize(cw, ch, 'left');
  ui.later(() => {
    const r = tag(ui, x, y, sz.w, sz.h, { hole: 'left', anchor: { x: x + 14, y: y - 6 }, blocking: false });
    ui.big(`${g.s.coin.format()}`, r.x, r.y, T.coin);
    ui.small('COIN', r.x + bigWidth(g.s.coin.format()) + 4, r.y + 4, T.inkSoft);
    rule(ui, r.x, r.y + BIG_LINE_H, r.w, true);
    let yy = r.y + BIG_LINE_H + 3;
    const rate = g.incomePerMin();
    ui.rich(rate > 0 ? `{good:+${Math.round(rate).toLocaleString('en-US')}/min}` : '{soft:nothing selling yet}', r.x, yy);
    yy += LINE_H;
    sparkline(ui, r.x, yy, r.w, 12, g.s.income, C.brass1);
    ui.small('THE LAST MINUTE', r.x + r.w, yy - 8, T.inkSoft, { align: 'right' });
    yy += 16;
    ui.rich(`earned this run {coin:${g.s.earned.format()}}`, r.x, yy);
    yy += LINE_H + 1;
    rule(ui, r.x, yy, r.w);
    yy += 3;
    if (!rows.length) {
      ui.rich('{soft:nothing shipped yet}', r.x, yy);
      ui.rich('{u:orders} Dock sells · {u:research} Hopper studies', r.x, yy + LINE_H);
      return;
    }
    ui.small('SHIPPING A MINUTE', r.x, yy + 1, T.inkSoft);
    yy += 9;
    for (const id of rows) {
      const pm = rates.get(id) ?? 0;
      ui.ctx.drawImage(itemIcon(id), r.x, yy);
      ui.text(ITEMS[id].name, r.x + 11, yy, T.ink);
      const val = pm > 0 ? `${fmtRate(pm)}/min` : Num.of(b!.d[id] ?? 0).format();
      ui.text(val, r.x + r.w, yy, pm > 0 ? T.good : T.inkSoft, { align: 'right' });
      yy += 10;
    }
  });
}

// ------------------------------------------------------------------ problems and the bell

/** Something not working for a share of the last minute: a Workshop machine or a Factory module. */
export interface Problem { floor: 'workshop' | 'factory'; id: number; x: number; y: number; share: number; bad: boolean }

function badShare(hist: string, state: string): number {
  if (!hist.length) return state === 'blocked' || state === 'starved' ? 1 : 0;
  let n = 0;
  for (const c of hist) if (c === 's' || c === 'b' || c === 'x') n++;
  return n / hist.length;
}

/** Every machine and module that has struggled lately, the worst first; and the health counts. */
export function problems(app: App) {
  const g = app.game;
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
  const list: Problem[] = [];
  for (const m of all) {
    if (!(m.state === 'blocked' || (m.state === 'starved' && m.why !== 'crank'))) continue;
    const s = badShare(m.hist, m.state);
    if (s >= 0.1) list.push({ floor: 'workshop', id: m.id, x: m.x + m.w / 2, y: m.y + m.h / 2, share: s, bad: m.state === 'blocked' });
  }
  for (const m of mods) {
    if (m.state !== 'blocked' && m.state !== 'starved') continue;
    const s = badShare(m.hist, m.state);
    if (s >= 0.1) list.push({ floor: 'factory', id: m.id, x: m.x + 0.5, y: m.y + 0.5, share: s, bad: m.state === 'blocked' });
  }
  list.sort((a, b) => b.share - a.share || a.id - b.id);
  const showPower = unpowered > 0 || g.machines.some((m) => powered(m.kind));
  return { list, work, starved, blocked, unpowered, showPower };
}

/** The trouble bell: only while something is wrong. Returns the y under it. */
export function bell(app: App, L: Layout, y: number): number {
  const ui = app.ui;
  const h = app.hud;
  const pr = problems(app);
  const ids = new Set(pr.list.map((p) => p.floor + p.id));
  // a new problem: the bell swings and rings
  let fresh = false;
  for (const id of ids) if (!h.bellIds.has(id)) fresh = true;
  if (fresh && pr.list.length && (app.game.miners.length > 0 || app.game.s.research.done.length > 0)) { h.bellAt = ui.time; app.audio.sfx('spark', 0.5, 0.55); }
  h.bellIds = ids;
  // the first minute has one goal: no bell until there is a line to be healthy
  const g = app.game;
  const lines = g.miners.length > 0 || g.s.research.done.length > 0 || g.s.factory.ents.some((e) => e.kind === 'module');
  if (!pr.list.length || !lines) return y;
  const bx = L.bell.x, by = y + 4;
  const n = pr.list.length;
  const s = `{bad:${n}}`;
  const sz = tagSize(richWidth(s), LINE_H - 2, 'left');
  const w = 20 + sz.w;
  const hov = ui.hover(bx, by, w, 18);
  ui.mark('nextProblem', bx, by, w, 18);
  ui.region(bx, by, w, 18, 'button');
  const swing = ui.time - h.bellAt < 1.6;
  const hookX = bx + 8;
  // a nail and the bell under it
  ui.ctx.fillStyle = C.ink;
  ui.ctx.fillRect(hookX - 1, by - 2, 3, 2);
  if (hasArt('h180_bell')) {
    const bs = sheet('h180_bell');
    const f = swing ? Math.floor((ui.time - h.bellAt) * (bs.fps || 6)) % bs.frames.length : hov ? frameNamed(bs, 'left') : 0;
    ui.ctx.drawImage(bs.frames[f], hookX - bs.ax, by - bs.ay);
  } else {
    const sw = swing ? Math.round(Math.sin((ui.time - h.bellAt) * 14) * 2) : 0;
    ui.ctx.fillStyle = C.ink;
    ui.ctx.fillRect(hookX - 6 + sw, by + 3, 13, 11);
    ui.ctx.fillStyle = T.brass;
    ui.ctx.fillRect(hookX - 5 + sw, by + 4, 11, 9);
    ui.ctx.fillStyle = T.brassHi;
    ui.ctx.fillRect(hookX - 4 + sw, by + 4, 3, 8);
  }
  const ct = tag(ui, bx + 18, by + 1, sz.w, sz.h, { hole: 'left', anchor: { x: hookX + 4, y: by + 8 }, blocking: false, hover: hov });
  drawLayout(ui, layoutRich(s), ct.x, ct.y);
  if (hov) {
    ui.hoverId = 'nextProblem';
    const counts = `{chip:good:${pr.work}} {chip:warn:${pr.starved}} {chip:bad:${pr.blocked}}${pr.showPower ? ` {chip:power:${pr.unpowered}}` : ''}`;
    ui.tip([{ text: '{big:Trouble}' }, { text: counts }, { text: '{soft:working · starved · blocked}' + (pr.showPower ? '{soft: · no power}' : '') }, { text: `{k:LMB} the next one · worst first` }], 200);
    if (ui.clicked) {
      ui.eat();
      ui.sfx('click');
      h.problemIdx = (h.problemIdx + 1) % pr.list.length;
      const p = pr.list[h.problemIdx];
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
  return by + 18;
}

/** An arrow at the screen's edge toward something off it: red for a problem, gold for a Spark. */
function edgeArrow(app: App, wx: number, wy: number, col: string, word: string | null) {
  const ui = app.ui;
  const s = app.renderer.toScreen(wx, wy);
  const ux = s.x / ui.scale, uy = s.y / ui.scale;
  const m = 14;
  if (ux > 0 && ux < ui.w && uy > 0 && uy < ui.h) return;
  const cx = ui.w / 2, cy = ui.h / 2;
  const dx = ux - cx, dy = uy - cy;
  const k = Math.min(Math.abs((cx - m) / (dx || 1e-6)), Math.abs((cy - m) / (dy || 1e-6)));
  const ex = Math.round(cx + dx * k), ey = Math.round(cy + dy * k);
  const glyph = Math.abs(dx) * (ui.h / ui.w) > Math.abs(dy) ? (dx > 0 ? ICON.right : ICON.left) : dy > 0 ? ICON.down : ICON.up;
  const bob = Math.round(Math.sin(ui.time * 6) * 1.5);
  const bx = glyph === ICON.right ? bob : glyph === ICON.left ? -bob : 0, byy = glyph === ICON.down ? bob : glyph === ICON.up ? -bob : 0;
  outlinedText(ui.ctx, glyph, ex - 6 + bx, ey - 7 + byy, col, T.ink, 2);
  if (word) {
    const w = chipWidth(word);
    const tx = Math.max(4, Math.min(ui.w - w - 4, ex - Math.floor(w / 2)));
    const ty = glyph === ICON.up ? ey + 10 : ey - 22;
    chip(ui, tx, Math.max(4, Math.min(ui.h - 16, ty)), word, { role: 'coin' });
  }
}

/** Edge arrows: problems on this floor that are off the screen, and Sparks. */
export function edgeArrows(app: App) {
  const g = app.game;
  const prev = app.ui.audit;
  app.ui.audit = false;
  try {
    for (const p of problems(app).list.slice(0, 6)) if (p.floor === app.floor) edgeArrow(app, p.x, p.y, p.bad ? T.floorBad : T.floorWarn, null);
    if (app.floor === 'workshop') for (const p of g.s.sparks) edgeArrow(app, p.x + 0.5, p.y + 0.5, T.floorCoin, p.kind === 'vein' ? 'vein!' : 'inspector!');
  } finally {
    app.ui.audit = prev;
  }
}

/** The counters other files hang under the Purse, one 30 px row each. */
export function counters(app: App, L: Layout, y: number): number {
  for (const c of COUNTERS) {
    if (!c.show(app)) continue;
    const w = c.draw(app, L.purse.x + 4, y + 4, 140);
    if (w > 0) y += 30;
  }
  return y;
}

// ------------------------------------------------------------------ the lift

/** The lift, top-right: a dial whose needle points at the floor you are on, a brass button for
 * each floor (the Factory padlocked until it opens), a dot on a floor that wants you. */
export function lift(app: App, L: Layout, dt: number) {
  const ui = app.ui;
  const g = app.game;
  const R = L.lift;
  const open = g.flag('factoryOpen');
  const fresh = open && !g.flag('factorySeen');
  const want = app.floor === 'factory' ? 120 : 180;
  const hs = app.hud;
  hs.liftAngle += (want - hs.liftAngle) * Math.min(1, dt * 8);
  ui.region(R.x, R.y, R.w, R.h, 'panel');
  const art = hasArt('h180_lift') ? sheet('h180_lift') : null;
  if (art) ui.ctx.drawImage(art.frames[0], R.x, R.y);
  else {
    ui.ctx.fillStyle = C.ink; ui.ctx.fillRect(R.x, R.y, R.w, R.h);
    ui.ctx.fillStyle = T.wood; ui.ctx.fillRect(R.x + 1, R.y + 1, R.w - 2, R.h - 2);
    ui.ctx.fillStyle = T.brass; ui.ctx.fillRect(R.x + 14, R.y + 5, 16, 16);
  }
  // the needle, from the hub, toward the floor's tick
  const px = R.x + 22, py = R.y + 15;
  const a = (hs.liftAngle * Math.PI) / 180;
  ui.ctx.fillStyle = C.ink;
  for (let i = 0; i <= 7; i++) ui.ctx.fillRect(Math.round(px + Math.cos(a) * i), Math.round(py - Math.sin(a) * i), 1, 1);
  ui.ctx.fillStyle = C.red;
  ui.ctx.fillRect(Math.round(px + Math.cos(a) * 7), Math.round(py - Math.sin(a) * 7), 1, 1);
  ui.ctx.fillStyle = T.brassDeep;
  ui.ctx.fillRect(px - 1, py - 1, 2, 2);
  const btns = hasArt('h180_liftbtn') ? sheet('h180_liftbtn') : null;
  const holes: [number, number][] = [[2, 9], [32, 9]];
  const floors = [
    { id: 'floorWorkshop', f: 'workshop' as const, name: 'Workshop', lit: 'Wlit', off: 'W', locked: false },
    { id: 'floorFactory', f: 'factory' as const, name: 'Factory', lit: 'Flit', off: 'F', locked: !open },
  ];
  floors.forEach((fl, i) => {
    const bx = R.x + holes[i][0], by = R.y + holes[i][1];
    ui.mark(fl.id, bx, by, 10, 10);
    ui.region(bx, by, 10, 10, 'button');
    const hov = ui.hover(bx - 1, by - 1, 12, 12);
    const on = app.floor === fl.f;
    if (btns) {
      ui.ctx.drawImage(btns.frames[frameNamed(btns, fl.locked ? 'locked' : on ? fl.lit : fl.off)], bx, by);
      if (hov && !fl.locked) ui.ctx.drawImage(btns.frames[frameNamed(btns, 'hover')], bx, by);
    } else {
      ui.ctx.fillStyle = C.ink; ui.ctx.fillRect(bx, by, 10, 10);
      ui.ctx.fillStyle = on ? T.brassHi : T.brass; ui.ctx.fillRect(bx + 1, by + 1, 8, 8);
      ui.small(fl.locked ? 'X' : fl.off, bx + 3, by + 3, T.ink);
    }
    if (fl.f === 'factory' && fresh && Math.floor(ui.time * 3) % 2 === 0) dot(ui, bx + 8, by - 1, C.gold);
    if (fl.f === 'factory' && !fresh && app.floor !== 'factory' && hs.goalUi === 'factory' && Math.floor(ui.time * 3) % 2 === 0) dot(ui, bx + 8, by - 1, C.gold);
    if (hov) {
      ui.hoverId = fl.id;
      ui.tip(fl.locked ? [{ text: `{big:${fl.name}}` }, { text: '{u:lock} opens with your first fold' }] : [{ text: `{big:${fl.name}}` }, { text: on ? '{soft:you are here}' : '{k:LMB} go  {k:Tab} switch' }], 160);
      if (ui.clicked && !fl.locked) {
        ui.eat();
        ui.sfx('click');
        app.setFloor(fl.f);
      }
    }
  });
}

// ------------------------------------------------------------------ the notebook and its pages

export interface Page { id: string; panel: ScreenName; icon: UIconName; name: string; key: string; dot: boolean; color: RibbonColor }

/** Every page the notebook has now, in order: research, orders, modules, the Act II pages, the
 * registered ones (Patents, the Drawer, Overnight), stats, trophies, the Gazette, options, keys. */
export function pages(app: App): Page[] {
  const g = app.game;
  const h = app.hud;
  const out: Page[] = [];
  const p = (id: ScreenName, icon: UIconName, name: string, key: string, color: RibbonColor, d = false) => out.push({ id, panel: id, icon, name, key, dot: d, color });
  p('research', 'research', 'Research', 'T', 'teal', !g.s.research.selected && g.s.research.done.length < Object.keys(RESEARCH).length && g.has('bellows'));
  p('orders', 'orders', 'Orders', 'O', 'moss', !g.s.orders.active && offeredOrders(g).length > 0);
  if (g.done('folding')) p('modules', 'fold', 'Modules', 'I', 'gold', g.s.designs.some((d) => d.spare > 0) && app.floor === 'factory' && !g.s.factory.ents.some((e) => e.kind === 'module'));
  if (g.s.orders.rep.unit7 >= 1) p('codex', 'codex', 'Codex', '', 'teal', !h.opened.has('codex') || g.s.codex.length > h.codexSeen);
  if (g.done('surveying')) {
    const cheapest = Math.min(...CLAIM_PRICE.map((c) => c.price * (1 + 0.5 * (g.s.claimBlocks[c.item] ?? 0))));
    p('survey', 'survey', 'Survey', '', 'moss', !h.opened.has('survey') || g.s.coin.gte(cheapest));
  }
  if (g.done('greatDrill')) p('mega', 'mega', MEGA.find((q) => q.stage === g.s.mega.stage + 1) ? 'Megaproject' : 'Great Drill', '', 'red', !h.opened.has('mega'));
  for (const q of MENUS) if (q.show(app)) out.push({ id: q.id, panel: q.panel as ScreenName, icon: q.icon, name: q.name, key: q.key ?? '', dot: q.dot?.(app) ?? false, color: 'violet' });
  const trophies = TROPHIES.filter((t) => g.flag('trophy:' + t.id)).length;
  p('stats', 'stats', 'Statistics', '', 'moss');
  p('trophies', 'trophies', `Trophies ${trophies}/${TROPHIES.length}`, '', 'gold');
  p('gazette', 'orders', 'The Gazette', '', 'red');
  p('options', 'options', 'Options', '/', 'moss');
  p('keys', 'build', 'Keys', '', 'moss');
  return out;
}

/** The notebook, bottom-right: opens the book at the last page; a dot when a page wants you. */
export function notebook(app: App, L: Layout) {
  const ui = app.ui;
  const R = L.notebook;
  const ps = pages(app);
  const hov = ui.hover(R.x, R.y, R.w, R.h);
  ui.mark('notebook', R.x, R.y, R.w, R.h);
  ui.region(R.x, R.y, R.w, R.h, 'button');
  if (hasArt('h180_notebook')) {
    const s = sheet('h180_notebook');
    ui.ctx.drawImage(s.frames[frameNamed(s, hov ? 'hover' : 'closed')], R.x, R.y);
  } else {
    ui.ctx.fillStyle = C.ink; ui.ctx.fillRect(R.x + 2, R.y + 1, 20, 22);
    ui.ctx.fillStyle = C.copper0; ui.ctx.fillRect(R.x + 3, R.y + 2, 18, 20);
  }
  const wants = ps.filter((p) => p.dot);
  if (wants.length && Math.floor(ui.time * 2.5) % 2 === 0) dot(ui, R.x + R.w - 4, R.y + 1, C.pipRed);
  if (hov) {
    ui.hoverId = 'notebook';
    const keys = ps.filter((p) => p.key).map((p) => `{k:${p.key}} ${p.name.toLowerCase()}`).join('  ');
    ui.tip([{ text: '{big:Notebook}' }, { text: `{k:LMB} open${wants.length ? ` · {warn:${wants.map((p) => p.name).join(', ')}}` : ''}` }, { text: keys }], 220);
    if (ui.clicked) {
      ui.eat();
      const last = app.hud.lastPage;
      const go = wants.length && !last ? wants[0].panel : last && ps.some((p) => p.panel === last) ? last : wants.length ? wants[0].panel : 'research';
      app.togglePanel(go);
    }
  }
}

/** While a page is open: its section tabs, bookmark ribbons down the book's right edge. */
export function sectionTabs(app: App, L: Layout) {
  const ui = app.ui;
  const ps = pages(app);
  if (!app.panel || !ps.some((p) => p.panel === app.panel)) return;
  const R = L.tabs;
  const n = ps.length;
  const step = Math.max(12, Math.min(17, Math.floor(R.h / n)));
  let y = R.y;
  for (const p of ps) {
    const on = app.panel === p.panel;
    const hov = ui.hover(R.x, y, R.w + 2, step - 1);
    const w = on ? R.w + 1 : hov ? R.w : R.w - 3;
    const h = Math.min(14, step - 2);
    ui.mark('page:' + p.id, R.x, y, R.w + 2, h);
    ui.region(R.x, y, R.w + 2, h, 'button');
    ribbonRaw(ui.ctx, R.x - 2, y, w + 2, h, on ? 'gold' : p.color, 'in');
    uiIcon(ui, p.icon, R.x + w - 11, y + Math.floor((h - 8) / 2) - 1, 1);
    if (p.dot && !on && Math.floor(ui.time * 2.5) % 2 === 0) dot(ui, R.x + w - 2, y, C.pipRed);
    if (hov) {
      ui.hoverId = 'page:' + p.id;
      ui.tip([{ text: `{big:${p.name}}${p.key ? `  {k:${p.key}}` : ''}` }], 160);
      if (ui.clicked) {
        ui.eat();
        if (!on) { app.panel = p.panel; app.audio.sfx('tab'); }
      }
    }
    y += step;
  }
}

/** HUD rects the floor's tags and the reports keep off, this frame. */
export function cornerZones(app: App, L: Layout, purseBottom: number): Rect[] {
  return [
    { x: 0, y: 0, w: L.purse.x + 150, h: purseBottom + 4 },
    { x: L.lift.x - 4, y: 0, w: L.lift.w + 10, h: L.lift.y + L.lift.h + 4 },
    { x: L.notebook.x - 4, y: L.notebook.y - 4, w: app.ui.w - L.notebook.x + 4, h: app.ui.h - L.notebook.y + 4 },
  ];
}
