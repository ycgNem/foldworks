// The HUD, drawn every frame with the immediate-mode kit in UI pixels. The owner's direction is a
// full screen (DECISIONS.md 2026-10-20): the Swamp Gazette ticker on top; on the left the coin
// counter (rolling, bumping, a sparkline), the machine-status strip and the power readout, Mayor
// Bramble's order card, the research card, the next goal and the toasts; on the right the store
// with its Build / Power / Heavy tabs; tools and menus along the bottom; reports over the floor;
// screen-wide celebrations on top of everything. Reads the App and the Game; changes the game
// only through App.act.
import { C, rgba } from '../data/palette';
import { BUILD, UPGRADES, STORE_TABS, isMachine, isPower, type BuildKind } from '../data/machines';
import { RESEARCH } from '../data/research';
import { CHUNKS, CLAIM_PRICE } from '../data/land';
import { ORDER, CUSTOMERS } from '../data/orders';
import { TROPHIES } from '../data/trophies';
import { ITEMS, ITEM_IDS, itemName, type ItemId } from '../data/items';
import { RULES } from '../data/rules';
import { MEGA } from '../data/megaprojects';
import { TICK_RATE } from '../engine/time';
import { TITLE } from '../game-info';
import { ICON, textWidth, drawText } from '../ui/font';
import { sheet, itemIcon, hasArt, spriteName } from '../render/sprites';
import { report, nominal, lineReport, entName } from '../sim/analysis';
import { researchFrac } from '../sim/systems/research';
import { offeredOrders, orderFrac } from '../sim/systems/orders';
import { poleReach, drawKw } from '../sim/systems/power';
import { modeSpeed } from '../sim/systems/machines';
import { MODES, type Ent, type FEnt, type Mode } from '../sim/world';
import { Num } from '../engine/num';
import { plain } from '../engine/fmt'; // Milestone 6: one number helper (DESIGN.md §20)
import { nextGoal } from './goals';
import { layout, type Layout } from './layout';
import { frame, card, button, bar, sparkline, badge, coinIcon, portrait, uiIcon, nine, UICON, type UIconName } from './chrome';
import { drawScreen } from './screens';
import { auditBadge, factoryStore, factoryReport } from './fold';
import { gridIndex, capacity, powered, burnerOf, fuelCount, engineOf, producerKw, powerTotals, kw } from '../render/powerview';
import type { App } from './app';

export interface HudState {
  /** the coin number shown, counting up toward the real value */
  coinShown: number;
  coinBump: number;
  hoverTile: { x: number; y: number } | null;
  storeTab: 'build' | 'upgrades';
  /** build kinds the player has seen unlocked (for the NEW badge) */
  seen: Set<string>;
  /** the problem machine the status strip jumped to last */
  problemIdx: number;
  /** delivered totals sampled once a game second, for the Shipping card's per-minute rates */
  ship: { tick: number; d: Partial<Record<ItemId, number>> }[];
  /** the text field with the keyboard, its text, and whether any field was drawn this frame */
  focus: string | null;
  draft: string;
  fieldSeen: boolean;
  /** the grade card's stamp has landed (its sound and shake played) */
  stamped: boolean;
  /** confetti still to throw, and the flakes in the air (UI px) */
  confetti: number;
  flakes: { x: number; y: number; vx: number; vy: number; t: number; f: number }[];
  /** the research tree's page */
  treePage: 1 | 2;
  /** the store's open tab of buildings */
  buildTab: 'build' | 'power' | 'heavy';
  // ---- Act II presentation
  /** kinds whose store tab has been opened since they unlocked (a tab pulses until then) */
  tabSeen: Set<string>;
  /** tabs whose "new" chime has played */
  tabRung: Set<string>;
  /** screens opened at least once (their bottom-bar button pulses until then) */
  opened: Set<string>;
  /** Codex entries when the Codex was last open */
  codexSeen: number;
  /** screen-wide celebrations (the Megaproject, claims) and their confetti rain (UI px) */
  celebs: { kind: string; t: number; x: number; y: number; id?: string; value?: number; title?: string; sub?: string; color?: string }[];
  rain: { x: number; y: number; vx: number; vy: number; f: number; spin: number; gold?: boolean }[];
  /** the first Miner has been celebrated */
  firstMiner: boolean;
  /** the last coin value seen, and sparkles around the counter while it climbs */
  coinLast: number;
  glints: { x: number; y: number; t: number }[];
}

export function newHudState(): HudState {
  return {
    coinShown: 0, coinBump: 0, hoverTile: null, storeTab: 'build', seen: new Set(), problemIdx: 0, ship: [], focus: null, draft: '', fieldSeen: false, stamped: false, confetti: 0, flakes: [], treePage: 2, buildTab: 'build',
    tabSeen: new Set(), tabRung: new Set(), opened: new Set(), codexSeen: 0, celebs: [], rain: [], coinLast: -1, glints: [], firstMiner: false,
  };
}

type Tone = 'good' | 'warn' | 'bad' | 'dim' | 'plain' | 'hot' | 'blue';
const TONE: Record<string, string> = { good: C.pipGreen, warn: C.pipYellow, bad: C.pipRed, dim: C.hull2, plain: C.bone, hot: C.glow, blue: C.pipBlue };

export function drawHud(app: App, dt: number) {
  const ui = app.ui;
  const L = layout(ui.w, ui.h);
  app.layout = L;
  app.hud.fieldSeen = false;
  presentation(app);
  ticker(app, L, dt);
  // a full-screen overlay hides the columns and the floor, so they are not drawn under it
  if (!app.panel) {
    leftColumn(app, L, dt);
    if (app.floor === 'factory') factoryStore(app, L);
    else store(app, L);
    centerOverlay(app, L);
    auditBadge(app, L);
  }
  bottomBar(app, L);
  if (app.panel) drawScreen(app, L);
  // a text field that is no longer drawn lets go of the keyboard
  if (!app.hud.fieldSeen && app.hud.focus) {
    app.hud.focus = null;
    app.input.typing = null;
  }
  trophyPopups(app, L, dt);
  if (!app.panel) hoverReport(app);
  refusal(app, dt);
  celebrations(app, L, dt);
  app.renderer.coinTarget = { x: (L.left.x + 14) * ui.scale, y: (L.left.y + 14) * ui.scale };
}

/** Sounds the renderer asked for, screen-wide events, the fold animation's target, and which
 *  screens have been seen. */
function presentation(app: App) {
  const r = app.renderer;
  for (const s of r.sounds) app.audio.sfx(s.id, s.v, s.p);
  r.sounds.length = 0;
  for (const e of r.screenEvents) {
    app.hud.celebs.push({ kind: e.type, t: 0, x: app.ui.mx, y: app.ui.my, id: e.id, value: e.value });
    if (e.type === 'megaDone') {
      for (let i = 0; i < 160; i++) app.hud.rain.push({ x: Math.random() * app.ui.w, y: -Math.random() * app.ui.h * 0.8, vx: (Math.random() - 0.5) * 30, vy: 40 + Math.random() * 60, f: Math.floor(Math.random() * 8), spin: Math.random() * 6 });
    }
  }
  r.screenEvents.length = 0;
  for (const n of r.townNews) app.gazette.push(n);
  r.townNews.length = 0;
  const tab = app.ui.ids.get('floorFactory') ?? app.ui.ids.get('modules');
  r.factoryTarget = tab ? { x: (tab.x + tab.w / 2) * app.ui.scale, y: (tab.y + tab.h / 2) * app.ui.scale } : null;
  if (app.panel) app.hud.opened.add(app.panel);
  if (app.panel === 'codex') app.hud.codexSeen = app.game.s.codex.length;
}

// ------------------------------------------------------------------ the ticker

function ticker(app: App, L: Layout, dt: number) {
  const ui = app.ui;
  const r = L.ticker;
  ui.region(r.x, r.y, r.w, r.h);
  ui.fill(r.x, r.y, r.w, r.h, C.ink);
  ui.fill(r.x, r.y + r.h - 1, r.w, 1, C.brass0);
  const label = 'SWAMP GAZETTE';
  const lw = textWidth(label) + 10;
  // the art is a 9-slice brass rail; the headline runs in a dark slot inside it
  if (hasArt('ui_ticker')) nine(ui.ctx, sheet('ui_ticker'), 0, r.x, r.y, r.w, r.h);
  ui.fill(lw + 2, r.y + 3, r.w - lw - 6, r.h - 6, C.ink);
  ui.fill(r.x, r.y, lw, r.h - 1, C.brass0);
  ui.fill(r.x, r.y, lw, 1, C.brass1);
  ui.text(label, r.x + 5, r.y + 3, C.hot, { shadow: C.ink });
  const gz = app.gazette;
  if (!gz.text) gz.next(app.game);
  gz.x -= dt * 34;
  const tw = textWidth(gz.text);
  if (gz.x < -tw) {
    gz.next(app.game);
    gz.x = r.w - lw;
  }
  ui.clip(lw + 4, r.y + 3, r.w - lw - 10, r.h - 6);
  ui.text(gz.text, lw + 4 + Math.round(gz.x), r.y + 4, C.bone);
  ui.unclip();
}

// ------------------------------------------------------------------ the left column

function leftColumn(app: App, L: Layout, dt: number) {
  const ui = app.ui;
  const g = app.game;
  const r = L.left;
  let y = r.y;
  const h = app.hud;

  // the coin counter: big gold digits that roll up, bump and sparkle on income
  const ch = 52;
  frame(ui, r.x, y, r.w, ch);
  const real = g.s.coin.toNumber();
  if (!isFinite(real) || real > 1e12 || Math.abs(real - h.coinShown) > 1e9) h.coinShown = real;
  else h.coinShown += (real - h.coinShown) * Math.min(1, dt * 10);
  if (Math.abs(real - h.coinShown) < 0.5) h.coinShown = real;
  if (h.coinLast >= 0 && real > h.coinLast) {
    // a bigger bump for a bigger gain
    const gain = (real - h.coinLast) / Math.max(1, h.coinLast);
    h.coinBump = Math.max(h.coinBump, Math.min(1.6, 0.8 + gain * 8));
    if (h.glints.length < 12 && Math.random() < 0.6) h.glints.push({ x: r.x + 26 + Math.random() * (r.w - 34), y: y + 4 + Math.random() * 20, t: 0 });
  }
  h.coinLast = real;
  h.coinBump = Math.max(0, h.coinBump - dt * 4);
  const shown = real > 1e12 ? g.s.coin.format() : Num.of(Math.max(0, Math.round(h.coinShown))).format();
  // a warm glow behind the digits while they climb
  if (h.coinBump > 0.05) ui.fill(r.x + 4, y + 4, r.w - 8, 24, C.glow, Math.min(0.35, h.coinBump * 0.25));
  coinIcon(ui, r.x + 6, y + 7 - (h.coinBump > 0.5 ? 1 : 0));
  const sc = textWidth(shown) * 3 <= r.w - 32 ? 3 : textWidth(shown) * 2 <= r.w - 30 ? 2 : 1;
  const bump = h.coinBump > 0.4 ? (h.coinBump > 1 ? 2 : 1) : 0;
  const numY = y + (sc === 3 ? 3 : sc === 2 ? 8 : 11) - bump;
  ui.text(shown, r.x + 26, numY, h.coinBump > 0.9 ? C.hot : C.gold, { scale: sc, shadow: C.brass0 });
  // a shine that sweeps across the number now and then
  const sweep = (ui.time * 0.6) % 3;
  if (sweep < 1) {
    const sx = r.x + 26 + Math.floor(sweep * (textWidth(shown) * sc + 10)) - 5;
    ui.ctx.save();
    ui.ctx.beginPath();
    ui.ctx.rect(r.x + 26, numY, textWidth(shown) * sc, 7 * sc);
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
  ui.text(`${fmtRate(rate)} coin/min`, r.x + 26, y + 30, rate > 0 ? C.leaf : C.hull2);
  sparkline(ui, r.x + 5, y + 40, r.w - 10, 8, g.s.income, C.brass1);
  ui.hint(r.x, y, r.w, ch, [{ text: `${g.s.coin.format()} coin`, color: C.gold }, { text: 'Coin buys machines, belts and land. The bars are each second of the last minute.' }, { text: `Earned this run: ${g.s.earned.format()}`, color: C.hull2 }], 190);
  y += ch;

  y = statusStrip(app, r.x, y, r.w);

  // Mayor Bramble and the order
  const oh = 66;
  const inner = card(ui, r.x, y, r.w, oh, 'Mayor Bramble', C.leaf, 'orders');
  const big = r.w >= 136 && hasArt('portrait_bramble');
  const ps = 24;
  portrait(ui, 'bramble', inner.x + 1, inner.y + 2, big ? 24 : ps as 24);
  const tx = inner.x + 30;
  const o = g.s.orders;
  for (let i = 0; i < 3; i++) ui.text(ICON.heart, tx + i * 9, inner.y + 1, i < o.rep.bramble ? C.pipRed : C.hull0);
  if (o.active) {
    const d = ORDER[o.active];
    ui.clip(tx, inner.y, inner.w - 30, 30);
    ui.text(d.name, tx, inner.y + 11, C.bone);
    ui.unclip();
    bar(ui, tx, inner.y + 21, inner.w - 30, 6, orderFrac(g, d.id), C.leaf);
    if (d.at === 'factory') {
      // only the Factory Dock fills it: a small plate on the card's corner says so
      const s = 'Factory Dock only';
      const sw = textWidth(s) + 4;
      const sx = inner.x + inner.w - sw;
      ui.fill(sx, inner.y + 31, sw, 10, C.ink);
      ui.text(s, sx + 2, inner.y + 32, C.hot);
    }
    let ix = inner.x;
    const room = inner.x + inner.w - (d.at === 'factory' ? textWidth('Factory Dock only') + 8 : 0);
    for (const [item, n] of Object.entries(d.wants) as [ItemId, number][]) {
      const have = Math.min(n, Math.floor(o.progress[d.id]?.[item]?.toNumber() ?? 0));
      if (ix + 10 + textWidth(`${have}/${n}`) > room) break;
      ui.ctx.drawImage(itemIcon(item), ix, inner.y + 32);
      ix += 11 + ui.text(`${have}/${n}`, ix + 10, inner.y + 32, C.hull3);
    }
  } else {
    const offered = offeredOrders(g);
    if (offered.length) {
      ui.text(offered.length === 1 ? 'An order for you!' : `${offered.length} orders for you!`, tx, inner.y + 11, C.hot);
      if (button(ui, 'openOrders', tx, inner.y + 21, inner.w - 30, 14, 'See orders', { gold: true, pulse: true })) app.togglePanel('orders');
    } else {
      ui.para('"Got anything for me? Everything sells at the Dock."', tx, inner.y + 11, inner.w - 30, C.hull2);
    }
  }
  const atF = o.active && ORDER[o.active].at === 'factory';
  ui.hint(r.x, y, r.w, oh, [{ text: CUSTOMERS.bramble.name, color: C.leaf }, { text: atF ? 'This order counts only what reaches the Factory Dock: trunk the modules that make it into the Factory Dock. The Workshop Dock just sells.' : 'Items sent to the Dock fill the active order first, then sell. Orders never expire.' }], 180);
  y += oh;

  // research
  const rh = 46;
  const rin = card(ui, r.x, y, r.w, rh, 'Research', C.teal1, 'research');
  const sel = g.s.research.selected;
  if (sel) {
    ui.clip(rin.x, rin.y, rin.w, 10);
    ui.text(RESEARCH[sel].name, rin.x, rin.y + 1, C.bone);
    ui.unclip();
    const f = researchFrac(g, sel);
    bar(ui, rin.x, rin.y + 11, rin.w - 26, 7, f, C.teal1);
    ui.text(`${Math.floor(f * 100)}%`, rin.x + rin.w, rin.y + 11, C.teal1, { align: 'right' });
  } else if (g.s.research.done.length < Object.keys(RESEARCH).length) {
    ui.text('Nothing selected', rin.x, rin.y + 1, C.pipYellow);
    if (button(ui, 'openTree', rin.x, rin.y + 10, rin.w, 13, 'Pick research (T)', { gold: true, pulse: true })) app.togglePanel('research');
  } else ui.text('All research done!', rin.x, rin.y + 1, C.pipGreen);
  ui.hint(r.x, y, r.w, rh, [{ text: 'Research', color: C.teal1 }, { text: 'Items delivered to the Hopper pay for the selected node. Open the tree with T.' }], 180);
  y += rh;

  // the toasts take the bottom of the column (never the floor: the critic's review), newest at
  // the bottom; the next goal and shipping get what is left above them
  const bottom = r.y + r.h;
  const stack = toastStack(app, r.w, bottom - y, dt);

  const room = bottom - stack.h - y;
  const goal = nextGoal(g);
  // the Next card grows to its goal's lines (they were cut at four), leaving Shipping 44 px
  const noteLines = goal?.note ? wrap(goal.note, r.w - 10).length : 0;
  const goalLines = wrap(goal ? goal.text : 'Build, balance, and keep the pips green.', r.w - 10).length + (noteLines ? noteLines + 0.4 : 0);
  const gh = room >= 110 ? Math.max(58, Math.min(room - 40, 24 + Math.ceil(goalLines * 10))) : room;
  if (gh >= 34) {
    const gin = card(ui, r.x, y, r.w, gh, 'Next', C.glow, 'star');
    ui.clip(gin.x, gin.y, gin.w, gin.h);
    const used = ui.para(goal ? goal.text : 'Build, balance, and keep the pips green.', gin.x, gin.y, gin.w, C.bone);
    // a lower-ranked alert under the goal, in warning yellow, only while it fits
    if (goal?.note && used + 4 + noteLines * 10 <= gin.h) {
      ui.fill(gin.x, gin.y + used + 1, gin.w, 1, C.ground2);
      ui.para(goal.note, gin.x, gin.y + used + 4, gin.w, C.pipYellow);
    }
    ui.unclip();
    y += gh;
  }

  // shipping: what reaches the Dock and the Hopper, per minute
  const sh2 = bottom - stack.h - y;
  if (sh2 >= 40) shipping(app, r.x, y, r.w, sh2);
  stack.draw(r.x, bottom - stack.h);
}

/** Something not working for a share of the last minute: a Workshop machine or a Factory module. */
interface Problem { floor: 'workshop' | 'factory'; id: number; x: number; y: number; share: number }

function badShare(hist: string, state: string): number {
  if (!hist.length) return state === 'blocked' || state === 'starved' ? 1 : 0;
  let n = 0;
  for (const c of hist) if (c === 's' || c === 'b' || c === 'x') n++;
  return n / hist.length;
}

/** The machine-status strip: counts by pip colour (Workshop machines and Factory modules), a
 *  find button that visits the worst problems first, and the power readout while a grid exists. */
function statusStrip(app: App, x0: number, y: number, w: number): number {
  const ui = app.ui;
  const g = app.game;
  const h = app.hud;
  const grids = g.grids.length > 0;
  const sh = grids ? 34 : 22;
  frame(ui, x0, y, w, sh);
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
  let x = x0 + 7;
  const pip = (col: string, n: number, label: string) => {
    ui.fill(x, y + 8, 6, 6, C.ink);
    ui.fill(x + 1, y + 9, 4, 4, col);
    const tw = ui.text(String(n), x + 8, y + 7, n ? C.bone : C.hull1);
    ui.hint(x, y + 4, tw + 10, 14, `${n} ${label}`);
    x += tw + 13;
  };
  pip(C.pipGreen, work, 'working (Workshop machines and Factory modules)');
  pip(C.pipYellow, starved, 'starved: waiting for an input');
  pip(C.pipRed, blocked, 'blocked: output has nowhere to go');
  if (unpowered || g.machines.some((m) => powered(m.kind))) pip(C.pipBlue, unpowered, 'unpowered: no Pole in reach, or no fuel on the grid');
  // problems, worst share of the last minute first; under 10% is noise
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
  if (problems.length && button(ui, 'nextProblem', x0 + w - 38, y + 4, 34, 14, 'find', { tip: [{ text: `${problems.length} problem${problems.length > 1 ? 's' : ''}`, color: C.pipYellow }, { text: 'Jump to the next machine or module that spent the most of the last minute starved or blocked, and open its report.' }] })) {
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
  if (grids) powerReadout(app, x0 + 5, y + 20, w - 10);
  return y + sh;
}

/** The compact power readout: a bolt, supply / demand kW coloured by how well the grids are fed,
 *  and a bar of demand against supply. */
function powerReadout(app: App, x: number, y: number, w: number) {
  const ui = app.ui;
  const g = app.game;
  const t = powerTotals(g);
  const col = t.demand > 0 && t.supply <= 0 ? C.pipBlue : t.worst < 1 ? C.pipYellow : C.pipGreen;
  const flick = t.worst < 1 && t.demand > 0 && Math.floor(ui.time * 6) % 3 === 0;
  ui.text(ICON.bolt, x + 1, y + 1, flick ? C.hull1 : col, { shadow: C.ink });
  const label = `${fmtKw(t.supply)}/${fmtKw(t.demand)} kW`;
  const tw = ui.text(label, x + 9, y + 1, col);
  const bx = x + 12 + tw, bw = x + w - bx;
  if (bw > 10) bar(ui, bx, y + 2, bw, 6, t.supply > 0 ? Math.min(1, t.demand / t.supply) : t.demand > 0 ? 1 : 0, t.worst < 1 ? C.pipYellow : C.teal1);
  ui.hint(x, y, w, 11, [
    { text: 'Power', color: C.teal1 },
    { text: `Supply ${kw(t.supply)}, demand ${kw(t.demand)} across ${t.grids} grid${t.grids > 1 ? 's' : ''}.` },
    { text: t.demand > 0 && t.supply <= 0 ? 'No fuelled producer: feed the Boilers and Generators coal.' : t.worst < 1 ? `Brownout: a grid gets ${Math.round(t.worst * 100)}% of what it wants, so its machines run at that speed. Add an engine, or fuel.` : 'Every grid has the power it wants.', color: t.worst < 1 || t.supply <= 0 ? C.pipYellow : C.hull2 },
  ], 200);
}

function fmtKw(v: number) {
  return plain(v, 0); // Milestone 6: through the one number helper, so the notation reaches it
}

function shipping(app: App, x: number, y: number, w: number, h: number) {
  const ui = app.ui;
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
  const inner = card(ui, x, y, w, h, 'Shipping', C.copper2, 'orders');
  const a = hs.ship[0], b = hs.ship[hs.ship.length - 1];
  const span = (b.tick - a.tick) / TICK_RATE;
  const rows = ITEM_IDS.filter((id) => (b.d[id] ?? 0) > 0);
  if (!rows.length) {
    ui.clip(inner.x, inner.y, inner.w, inner.h);
    ui.para('Nothing shipped yet. Items that reach the Dock sell; items in the Hopper pay for research.', inner.x, inner.y, inner.w, C.hull2);
    ui.unclip();
    return;
  }
  let yy = inner.y;
  for (const id of rows) {
    if (yy > inner.y + inner.h - 10) break;
    const perMin = span > 0 ? (((b.d[id] ?? 0) - (a.d[id] ?? 0)) / span) * 60 : 0;
    ui.ctx.drawImage(itemIcon(id), inner.x, yy);
    const val = perMin > 0 ? `${fmtRate(perMin)}/m` : Num.of(b.d[id] ?? 0).format();
    ui.clip(inner.x + 11, yy, inner.w - 14 - textWidth(val), 10);
    ui.text(ITEMS[id].name, inner.x + 11, yy, C.bone);
    ui.unclip();
    ui.text(val, inner.x + inner.w, yy, perMin > 0 ? C.leaf : C.hull2, { align: 'right' });
    yy += 10;
  }
  ui.hint(x, y, w, h, [{ text: 'Shipping', color: C.copper2 }, { text: 'Items delivered to the Dock and the Hopper. Green: per minute over the last minute. Grey: the total so far.' }], 180);
}

function fmtRate(v: number) {
  return plain(v, v < 10 ? 1 : 0); // Milestone 6: through the one number helper (DESIGN.md §20)
}

// ------------------------------------------------------------------ the store

const TAB_ICON: Record<string, UIconName> = { build: 'build', power: 'power', heavy: 'heavy' };

function store(app: App, L: Layout) {
  const ui = app.ui;
  const g = app.game;
  const r = L.right;
  const h = app.hud;
  frame(ui, r.x, r.y, r.w, r.h);
  // the building tabs that have anything unlocked (Build always)
  const tabs = STORE_TABS.filter((t) => t.id === 'build' || t.kinds.some((k) => g.unlocked(k)));
  if (!tabs.some((t) => t.id === h.buildTab)) h.buildTab = 'build';
  const upgradesReady = !g.has('bellows') && g.s.coin.gte(25) || CHUNKS.some((c) => !g.s.land.includes(c.id) && (!c.requires || g.done(c.requires)) && g.s.coin.gte(c.cost));
  ui.fill(r.x + 3, r.y + 3, r.w - 6, 13, C.shadow);
  // a tab is opened: what it holds has been seen
  if (h.storeTab === 'build') for (const k of STORE_TABS.find((t) => t.id === h.buildTab)!.kinds) if (g.unlocked(k)) h.tabSeen.add(k);
  if (tabs.length === 1) {
    ui.text('Store', r.x + 7, r.y + 6, C.hot, { shadow: C.ink });
    const tabW = 44;
    if (button(ui, 'tabBuild', r.x + r.w - tabW * 2 - 6, r.y + 3, tabW, 13, 'Build', { active: h.storeTab === 'build' })) h.storeTab = 'build';
    if (button(ui, 'tabUpgrades', r.x + r.w - tabW - 4, r.y + 3, tabW, 13, 'Extras', { active: h.storeTab === 'upgrades', pulse: upgradesReady && h.storeTab !== 'upgrades', tip: 'The Bellows and land.' })) h.storeTab = 'upgrades';
  } else {
    // Build | Power | Heavy across the top, Extras as a star at the end
    const gap = 2, ew = 18;
    const tw = Math.floor((r.w - 8 - ew - gap * tabs.length) / tabs.length);
    let x = r.x + 4;
    for (const t of tabs) {
      const fresh = t.id !== 'build' && t.kinds.some((k) => g.unlocked(k) && !h.tabSeen.has(k));
      if (fresh && !h.tabRung.has(t.id + t.kinds.filter((k) => g.unlocked(k)).length)) {
        h.tabRung.add(t.id + t.kinds.filter((k) => g.unlocked(k)).length);
        app.audio.sfx('tab');
      }
      const active = h.storeTab === 'build' && h.buildTab === t.id;
      const keys = t.kinds.filter((k) => g.unlocked(k)).map((k) => BUILD[k].name).join(', ');
      if (storeTab(app, 'tab_' + t.id, x, r.y + 3, tw, 13, t.name, TAB_ICON[t.id], active, fresh, [{ text: t.name, color: C.gold }, { text: keys || 'Nothing unlocked yet' }, { text: 'Keys 1-9 pick from the open tab.', color: C.hull2 }])) {
        h.storeTab = 'build';
        h.buildTab = t.id;
      }
      x += tw + gap;
    }
    if (storeTab(app, 'tabUpgrades', r.x + r.w - 4 - ew, r.y + 3, ew, 13, 'Extras', 'star', h.storeTab === 'upgrades', upgradesReady && h.storeTab !== 'upgrades', [{ text: 'Extras', color: C.gold }, { text: 'The Bellows and land.' }])) h.storeTab = 'upgrades';
  }
  let top = r.y + 19;
  // until it is bought, the Bellows sits on top of the store, lit up: the first goal points at it
  if (h.storeTab === 'build' && !g.has('bellows')) top = bellowsCard(app, r.x + 4, top, r.w - 8) + 3;
  const avail = r.y + r.h - 4 - top;
  if (h.storeTab === 'build') {
    const kinds = STORE_TABS.find((t) => t.id === h.buildTab)!.kinds;
    const rowH = Math.max(24, Math.min(32, Math.floor(avail / Math.max(kinds.length, 6))));
    kinds.forEach((kind, i) => {
      if (top + (i + 1) * rowH > r.y + r.h - 2) return;
      storeRow(app, kind, i, r.x + 4, top + i * rowH, r.w - 8, rowH - 2);
    });
  } else upgradesTab(app, r.x + 4, top, r.w - 8, avail);
}

/** The Bellows as a big lit card at the top of the store while it is unbought: the furnace at 2x
 *  breathing embers, what it does, and its price (a BUY button once affordable, else how close). */
function bellowsCard(app: App, x: number, y: number, w: number): number {
  const ui = app.ui;
  const g = app.game;
  const u = UPGRADES.bellows;
  const h = 46;
  const afford = g.s.coin.gte(u.cost);
  ui.mark('bellows', x, y, w, h);
  const hov = ui.hover(x, y, w, h);
  ui.region(x, y, w, h, 'button');
  const pulse = 0.5 + 0.5 * Math.sin(ui.time * (afford ? 7 : 3));
  ui.fill(x, y, w, h, C.ink);
  ui.fill(x + 1, y + 1, w - 2, h - 2, afford ? (pulse > 0.5 ? C.gold : C.brass1) : C.brass0);
  ui.fill(x + 2, y + 2, w - 4, h - 4, hov ? C.ground2 : C.ground1);
  ui.fill(x + 2, y + 2, w - 4, 1, C.brass1);
  // the furnace at 2x in a well, with embers rising
  ui.fill(x + 4, y + 5, 36, 36, C.ink);
  ui.fill(x + 5, y + 6, 34, 34, C.shadow);
  const s = sheet('furnace');
  ui.ctx.drawImage(s.frames[Math.floor(ui.time * (s.fps || 6)) % s.frames.length], x + 6, y + 7, 32, 32);
  for (let i = 0; i < 4; i++) {
    const t = (ui.time * 0.9 + i * 0.27) % 1;
    ui.fill(x + 12 + ((i * 7) % 20), Math.round(y + 34 - t * 26), 1, 1, i % 2 ? C.hot : C.glow, 1 - t);
  }
  const tx = x + 45, tr = x + w - 4;
  ui.text('The Bellows', tx, y + 5, C.gold, { shadow: C.ink });
  ui.clip(tx, y, tr - tx, h);
  ui.text(textWidth('The furnace runs itself') <= tr - tx ? 'The furnace runs itself' : 'Runs by itself', tx, y + 15, C.bone);
  ui.unclip();
  if (afford) {
    if (button(ui, 'buyBellows', tx, y + 27, tr - tx, 14, `Buy: ${ICON.coin} ${u.cost}`, { gold: true, pulse: true, tip: [{ text: 'The Bellows', color: C.gold }, { text: 'The Hand Furnace runs on its own: an ingot every 2 s while it has ore. No more cranking.' }] })) app.act({ k: 'upgrade', id: 'bellows' });
  } else {
    const have = Math.max(0, Math.floor(g.s.coin.toNumber()));
    bar(ui, tx, y + 29, tr - tx - 34, 7, have / u.cost, C.gold);
    ui.text(`${have}/${u.cost}`, tr, y + 28, C.gold, { align: 'right' });
    if (hov) ui.tip([{ text: 'The Bellows', color: C.gold }, { text: `The Hand Furnace runs on its own: an ingot every 2 s while it has ore. ${u.cost - have} coin to go: crank the furnace and sell ingots at the Dock.` }], 190);
  }
  if (afford && Math.floor(ui.time * 2) % 2 === 0) badge(ui, x + w - 26, y - 3, 'BUY', C.pipRed);
  return y + h;
}

/** One store tab: a small icon and its name (the icon alone when the name does not fit); a fresh
 *  tab blinks gold with a "!" until it is opened. */
function storeTab(app: App, id: string, x: number, y: number, w: number, h: number, label: string, icon: UIconName, active: boolean, fresh: boolean, tip: { text: string; color?: string }[]): boolean {
  const ui = app.ui;
  ui.mark(id, x, y, w, h);
  const hov = ui.hover(x, y, w, h);
  ui.region(x, y, w, h, 'button');
  const blink = fresh && Math.floor(ui.time * 3) % 2 === 0;
  ui.fill(x, y, w, h, C.ink);
  ui.fill(x + 1, y + 1, w - 2, h - 2, active ? C.copper0 : blink ? C.brass0 : hov ? C.hull0 : C.ground0);
  ui.fill(x + 1, y + 1, w - 2, 1, active ? C.copper1 : blink ? C.brass1 : hov ? C.hull1 : C.ground1);
  if (active) ui.fill(x + 1, y + h - 2, w - 2, 1, C.gold);
  const lw = textWidth(label);
  // a fresh tab's "!" sits inside its right end, so the label gives it room
  const bang = fresh ? 11 : 0;
  const withLabel = 8 + 2 + lw <= w - 4 - bang * 2;
  const cw = withLabel ? 10 + lw : 8;
  const cx = x + Math.floor((w - cw) / 2);
  const down = hov && ui.input.mouse.down[0] ? 1 : 0;
  if (hasArt('ui_icons_small') || hasArt('ui_icons')) uiIcon(ui, icon, cx, y + 3 + down, 1);
  if (withLabel) ui.text(label, cx + 10, y + 3 + down, active ? C.hot : fresh ? C.gold : C.bone, { shadow: C.ink });
  if (fresh) badge(ui, x + w - bang, y + 2, '!', C.pipRed);
  if (hov) {
    ui.hoverId = id;
    ui.tip(tip, 170);
    if (ui.clicked) {
      ui.eat();
      ui.sfx('click');
      return true;
    }
  }
  return false;
}

function storeRow(app: App, kind: BuildKind, i: number, x: number, y: number, w: number, h: number) {
  const ui = app.ui;
  const g = app.game;
  const d = BUILD[kind];
  const unlocked = g.unlocked(kind);
  const active = app.mode.k === 'build' && app.mode.kind === kind;
  const free = kind === 'crate' && g.s.freeCrates > 0;
  const afford = free || g.s.coin.gte(d.cost);
  const hov = ui.hover(x, y, w, h);
  ui.region(x, y, w, h, 'button');
  ui.mark('store_' + kind, x, y, w, h);
  if (hasArt('ui_row')) {
    // nine-slice row plaque: normal, hover, locked
    nine(ui.ctx, sheet('ui_row'), !unlocked ? 2 : hov || active ? 1 : 0, x, y, w, h);
  } else {
    ui.fill(x, y, w, h, C.ink);
    ui.fill(x + 1, y + 1, w - 2, h - 2, !unlocked ? C.shadow : active ? C.copper0 : hov ? C.hull0 : C.ground1);
    ui.fill(x + 1, y + 1, w - 2, 1, !unlocked ? C.ground0 : active ? C.copper1 : C.ground2);
  }
  if (active) ui.fill(x + 1, y + 1, 2, h - 2, C.gold);
  // the icon in a well (a 2x2 machine's 32x32 art drawn at half size)
  const ih = h - 4;
  ui.fill(x + 3, y + 2, ih, ih, C.ink);
  ui.fill(x + 4, y + 3, ih - 2, ih - 2, C.shadow);
  const s = sheet(spriteName(kind));
  const sx = x + 3 + Math.floor((ih - 16) / 2), sy = y + 2 + Math.floor((ih - 16) / 2);
  const draw = (f: number) => ui.ctx.drawImage(s.frames[f % s.frames.length], sx, sy, 16, 16);
  const owned = g.s.ents.filter((e) => e.kind === kind).length;
  if (unlocked) {
    const working = g.s.ents.some((e) => e.kind === kind && e.state === 'work');
    const f = hov || working ? Math.floor(ui.time * (s.fps || 6)) % s.frames.length : 0;
    ui.ctx.globalAlpha = afford ? 1 : 0.55;
    draw(f);
    ui.ctx.globalAlpha = 1;
    // how many you own: a small count badge on the icon (not a big faded number, DECISIONS.md)
    if (owned > 0) {
      const t = String(owned), bw = textWidth(t) + 4;
      const bx = x + 3 + ih - bw, by = y + 2 + ih - 9;
      ui.fill(bx, by, bw, 9, C.ink);
      ui.fill(bx + 1, by + 1, bw - 2, 7, C.brass0);
      ui.text(t, bx + 2, by + 1, C.hot);
    }
  } else {
    // a dark silhouette
    ui.ctx.globalAlpha = 0.35;
    ui.ctx.filter = 'brightness(0)';
    draw(0);
    ui.ctx.filter = 'none';
    ui.ctx.globalAlpha = 1;
  }
  const tx = x + ih + 7;
  if (unlocked) {
    ui.clip(tx, y, x + w - tx - 2, h);
    ui.text(d.name, tx, y + 3, C.bone, { shadow: C.ink });
    ui.unclip();
    const cost = free ? 'free!' : Num.of(d.cost).format();
    coinSmall(ui, tx, y + h - 11);
    ui.text(cost, tx + 9, y + h - 11, afford ? C.gold : C.pipRed);
    const rate = rowRate(kind);
    if (rate && tx + 14 + textWidth(cost) + textWidth(rate) <= x + w - 3) ui.text(rate, tx + 14 + textWidth(cost), y + h - 11, C.hull2);
    if (!app.hud.seen.has(kind)) {
      if (owned > 0) app.hud.seen.add(kind);
      else if (kind !== 'belt' && kind !== 'miner' && kind !== 'smelter' && kind !== 'heap') badge(ui, x + w - 26, y + 2, 'NEW', C.pipRed);
    }
  } else {
    ui.text('???', tx, y + 3, C.hull1);
    ui.clip(tx, y, x + w - tx - 2, h);
    ui.text(`${ICON.lock} ${RESEARCH[d.unlock!].name}`, tx, y + h - 11, C.hull1);
    ui.unclip();
  }
  ui.text(String(i + 1), x + 4, y + 2, C.hull2, { shadow: C.ink });
  if (hov) {
    const extra: { text: string; color?: string }[] = [];
    if (d.kw) extra.push({ text: `Draws ${d.kw} kW while it works. A Pole within ${poleReach(g)} tiles joins it to a grid.`, color: C.teal1 });
    if (d.w > 1) extra.push({ text: `${d.w}x${d.h} tiles: it goes down with its top-left corner on the tile you click.`, color: C.hull2 });
    ui.tip(unlocked
      ? [{ text: `${d.name}  (key ${i + 1})`, color: C.gold }, { text: d.blurb }, ...extra, { text: `Cost ${Num.of(d.cost).format()} coin, flat: the 10th costs the same as the 1st. You have ${owned}.`, color: C.hull2 }, { text: 'Click, then click the floor. R rotates. Right-click stops.', color: C.hull2 }]
      : [{ text: '???', color: C.hull2 }, { text: `Research ${RESEARCH[d.unlock!].name} to unlock.` }], 210);
    if (ui.clicked) {
      ui.eat();
      app.pickBuild(kind);
    }
  }
}

function rowRate(kind: BuildKind): string {
  switch (kind) {
    case 'belt': return '120/min';
    case 'miner': return '30 ore/min';
    case 'smelter': return '30/min';
    case 'press': return '40/min';
    case 'assembler': return '30/min';
    case 'heap': return 'holds 400';
    case 'crate': return 'holds 50';
    case 'boiler': return 'coal/4s';
    case 'steamEngine': return '300 kW';
    case 'generator': return '150 kW';
    case 'pole': return `reach 2`;
    case 'kiln': case 'mixer': case 'refinery': case 'smelterMk2': case 'pressMk2': case 'assemblerMk2': return `-${BUILD[kind].kw} kW`;
    default: return '';
  }
}

function coinSmall(ui: App['ui'], x: number, y: number) {
  if (hasArt('ui_coin_small')) coinIcon(ui, x, y, false);
  else ui.text(ICON.coin, x, y, C.gold);
}

function upgradesTab(app: App, x: number, y: number, w: number, h: number) {
  const ui = app.ui;
  const g = app.game;
  const rowH = 30;
  const rows: { name: string; text: string; cost: number; done: boolean; locked: string | null; buy: () => void; icon: UIconName }[] = [];
  const u = UPGRADES.bellows;
  rows.push({ name: u.name, text: 'The furnace runs itself.', cost: u.cost, done: g.has('bellows'), locked: null, buy: () => app.act({ k: 'upgrade', id: 'bellows' }), icon: 'build' });
  for (const c of CHUNKS) {
    if (!c.cost) continue;
    rows.push({ name: c.name, text: `8x8 tiles of land`, cost: c.cost, done: g.s.land.includes(c.id), locked: c.requires && !g.done(c.requires) ? RESEARCH[c.requires].name : null, buy: () => { if (app.act({ k: 'land', id: c.id }).ok) app.lookAt(c.x + c.w / 2, c.y + c.h / 2); }, icon: 'workshop' });
  }
  rows.forEach((r, i) => {
    const yy = y + i * rowH;
    if (yy + rowH > y + h) return;
    const afford = g.s.coin.gte(r.cost);
    const hov = ui.hover(x, yy, w, rowH - 2) && !r.done && !r.locked;
    ui.region(x, yy, w, rowH - 2, 'button');
    ui.fill(x, yy, w, rowH - 2, C.ink);
    ui.fill(x + 1, yy + 1, w - 2, rowH - 4, r.done ? C.moss : r.locked ? C.shadow : hov ? C.hull0 : C.ground1);
    uiIcon(ui, r.done ? 'star' : r.locked ? 'lock' : r.icon, x + 4, yy + 5);
    ui.clip(x + 24, yy, w - 26, rowH - 2);
    ui.text(r.name, x + 24, yy + 4, r.locked ? C.hull1 : C.bone, { shadow: C.ink });
    if (r.done) ui.text(`${ICON.check} owned`, x + 24, yy + 15, C.leaf);
    else if (r.locked) ui.text(`${ICON.lock} ${r.locked}`, x + 24, yy + 15, C.hull1);
    ui.unclip();
    if (!r.done && !r.locked) {
      coinSmall(ui, x + 24, yy + 15);
      ui.text(Num.of(r.cost).format(), x + 33, yy + 15, afford ? C.gold : C.pipRed);
      if (afford) badge(ui, x + w - 26, yy + 3, 'BUY', C.copper1);
    }
    if (hov) {
      ui.tip([{ text: r.name, color: C.gold }, { text: r.text }], 160);
      if (ui.clicked) { ui.eat(); r.buy(); }
    }
  });
}

// ------------------------------------------------------------------ bottom bar

interface BarItem { id: string; icon: UIconName; label: string; key: string; active: boolean; tip: string; onClick: () => void; opts?: { disabled?: boolean; gold?: boolean; pulse?: boolean } }

function bottomBar(app: App, L: Layout) {
  const ui = app.ui;
  const g = app.game;
  const h = app.hud;
  const r = L.bottom;
  frame(ui, r.x, r.y, r.w, r.h);
  const bh = r.h - 8;
  const by = r.y + 4;
  const tools: BarItem[] = [
    { id: 'rotate', icon: 'rotate', label: 'Rotate', key: 'R', active: false, tip: `Rotate what you place, or the machine under the mouse. Facing ${['east', 'south', 'west', 'north'][app.rot]}`, onClick: () => { app.rot = ((app.rot + 1) % 4) as 0; app.audio.sfx('rotate'); } },
    { id: 'remove', icon: 'remove', label: 'Remove', key: 'X', active: app.mode.k === 'remove', tip: 'Remove a building: full refund', onClick: () => app.setMode(app.mode.k === 'remove' ? { k: 'idle' } : { k: 'remove' }) },
    { id: 'fold', icon: 'fold', label: 'Fold', key: 'F', active: app.mode.k === 'fold', tip: g.done('folding') ? 'Drag a box over a working line: it is audited for 70 s, graded, and folded into one tile' : 'Locked: research Folding', onClick: () => app.toggleFold(), opts: { disabled: !g.done('folding'), gold: g.done('folding') && !g.s.designs.length && !g.s.audits.length, pulse: g.done('folding') && !g.s.designs.length && !g.s.audits.length && app.mode.k !== 'fold' } },
    { id: 'flow', icon: 'flow', label: 'Flow', key: 'L', active: app.flowOverlay, tip: 'Show belts by how full they are', onClick: () => { app.flowOverlay = !app.flowOverlay; } },
  ];
  // menus, from the right
  const trophyCount = TROPHIES.filter((t) => g.flag('trophy:' + t.id)).length;
  const menus: BarItem[] = [];
  const menu = (id: string, icon: UIconName, label: string, key: string, panel: Parameters<App['togglePanel']>[0], tip: string, pulse = false) =>
    menus.push({ id, icon, label, key, active: app.panel === panel, tip, onClick: () => app.togglePanel(panel), opts: { pulse, gold: pulse && !h.opened.has(panel) } });
  menu('options', 'options', 'Options', '/', 'options', 'Sound, saves, keys');
  menu('trophies', 'trophies', `${trophyCount}/${TROPHIES.length}`, '', 'trophies', 'The Trophy Shelf');
  menu('stats', 'stats', 'Stats', '', 'stats', 'Statistics');
  // Act II screens, as they open
  if (g.done('greatDrill')) menu('mega', 'mega', 'Mega', '', 'mega', `The Megaproject: ${MEGA.find((m) => m.stage === g.s.mega.stage + 1)?.name ?? 'the Great Drill'}`, !h.opened.has('mega'));
  if (g.done('surveying')) {
    const cheapest = Math.min(...CLAIM_PRICE.map((c) => c.price * (1 + 0.5 * (g.s.claimBlocks[c.item] ?? 0))));
    menu('survey', 'survey', 'Survey', '', 'survey', 'The Survey Office: buy deposit claims, 4 at a time', !h.opened.has('survey') || (g.s.coin.gte(cheapest) && app.panel !== 'survey' && Math.floor(ui.time / 8) % 2 === 0));
  }
  if (g.s.orders.rep.unit7 >= 1) menu('codex', 'codex', 'Codex', '', 'codex', "Unit 7's Codex: every item, and a first-delivery bonus for each", !h.opened.has('codex') || g.s.codex.length > h.codexSeen);
  if (g.done('folding')) menu('modules', 'fold', 'Modules', 'I', 'modules', 'Your folded modules: stamp, unfold, place', g.s.designs.some((d) => d.spare > 0) && app.floor === 'factory' && !g.s.factory.ents.some((e) => e.kind === 'module'));
  menu('orders', 'orders', 'Orders', 'O', 'orders', 'Orders from the swamp', !g.s.orders.active && offeredOrders(g).length > 0);
  menu('research', 'research', 'Research', 'T', 'research', 'The research tree', !g.s.research.selected && g.s.research.done.length < Object.keys(RESEARCH).length && g.has('bellows'));
  // labels while everything (and the floor tabs) fits; icons alone when not
  // labels where they fit, in this order of giving way: the menus' labels, the tools' labels,
  // then the floor tabs' labels (the floor tabs themselves always show)
  const width = (it: BarItem, lab: boolean) => (lab ? 20 + textWidth(it.label) + 8 : 24);
  const need = (tl: boolean, ml: boolean, fw: number) => tools.reduce((s, it) => s + width(it, tl) + 3, 0) + menus.reduce((s, it) => s + width(it, ml) + 3, 0) + 10 + fw * 2 + 6;
  const plans: [boolean, boolean, number][] = [[true, true, 66], [true, false, 66], [false, false, 66], [false, false, 28]];
  const [tl, ml, fw] = plans.find(([a, b, f]) => (L.wide || !a) && need(a, b, f) <= r.w) ?? plans[3];
  // the floor tabs keep their names whenever the name fits beside the icon (at 1024 wide they
  // were blank icons: the QA pass)
  const labels = fw > 28 && 20 + textWidth('Workshop') + 4 <= fw;
  let x = r.x + 5;
  for (const it of tools) {
    const w = width(it, tl);
    if (button(ui, it.id, x, by, w, bh, tl ? it.label : '', { icon: it.icon, active: it.active, tip: it.key ? `${it.tip} (${it.key})` : it.tip, ...it.opts })) it.onClick();
    // the Fold tool wears the audit count, gold when one is graded
    if (it.id === 'fold' && g.s.audits.length) {
      const graded = g.s.audits.some((a) => a.result);
      badge(ui, x + w - 18, by - 5, `${g.s.audits.length}/${RULES.maxAudits.value}`, graded ? C.copper1 : C.teal0);
    }
    x += w + 3;
  }
  let rx = r.x + r.w - 5;
  for (const it of menus) {
    const w = width(it, ml);
    rx -= w;
    if (button(ui, it.id, rx, by, w, bh, ml ? it.label : '', { icon: it.icon, active: it.active, tip: [{ text: it.label, color: C.gold }, { text: it.key ? `${it.tip} (${it.key})` : it.tip }], ...it.opts })) it.onClick();
    rx -= 3;
  }
  // floor tabs between the groups
  if (rx - x >= fw * 2 + 6) {
    const fx = Math.floor((x + rx) / 2) - fw;
    if (button(ui, 'floorWorkshop', fx, by, fw, bh, labels ? 'Workshop' : '', { icon: 'workshop', active: app.floor === 'workshop', tip: 'The Workshop floor (Tab)' })) app.setFloor('workshop');
    const open = g.flag('factoryOpen');
    if (button(ui, 'floorFactory', fx + fw + 3, by, fw, bh, labels ? 'Factory' : '', { icon: 'factory', active: app.floor === 'factory', disabled: !open, pulse: open && !g.flag('factorySeen'), gold: open && !g.flag('factorySeen'), tip: open ? 'The Factory floor (Tab)' : 'The Factory floor opens with your first fold' })) app.setFloor('factory');
  }
}

// ------------------------------------------------------------------ over the floor

function centerOverlay(app: App, L: Layout) {
  const ui = app.ui;
  const g = app.game;
  const c = L.center;
  // the floor's name plate
  const plate = app.floor === 'factory' ? `${TITLE} Factory` : `${TITLE} Workshop`;
  ui.fill(c.x + 4, c.y + 4, textWidth(plate) + 10, 12, C.ink, 0.75);
  ui.text(plate, c.x + 9, c.y + 7, C.hull3);
  // the goal's pointer on the floor
  const goal = nextGoal(g);
  if (goal?.tile && !app.panel && app.floor === 'workshop') {
    const s = app.renderer.toScreen(goal.tile.x + 0.5, goal.tile.y);
    const bob = Math.round(Math.sin(ui.time * 6) * 2);
    const ux = Math.round(s.x / ui.scale), uy = Math.round(s.y / ui.scale) - 18 + bob;
    if (ux > c.x + 8 && ux < c.x + c.w - 8 && uy > c.y + 2 && uy < c.y + c.h - 18) {
      // a world marker, not HUD text: drawn straight to the canvas, outside the overlap audit
      drawText(ui.ctx, ICON.down, ux - 6, uy, C.glow, 2, C.ink);
    }
  }
  // more floor (or town) past an edge of the view: a soft arrow there, pulsing (drag with the
  // right button, WASD, or rest the mouse at that edge to pan)
  if (!app.panel) {
    const ph = app.panHints();
    const a = 0.35 + 0.25 * Math.sin(ui.time * 3);
    ui.ctx.globalAlpha = a;
    const mx = c.x + Math.floor(c.w / 2), my = c.y + Math.floor(c.h / 2);
    if (ph.l) drawText(ui.ctx, ICON.left, c.x + 3, my - 4, C.bone, 1, C.ink);
    if (ph.r) drawText(ui.ctx, ICON.right, c.x + c.w - 9, my - 4, C.bone, 1, C.ink);
    if (ph.u) drawText(ui.ctx, ICON.up, mx - 3, c.y + 18, C.bone, 1, C.ink);
    if (ph.d) drawText(ui.ctx, ICON.down, mx - 3, c.y + c.h - 10, C.bone, 1, C.ink);
    ui.ctx.globalAlpha = 1;
  }
  // Sparks off-screen: an arrow at the edge of the frame pointing at them
  if (app.floor === 'workshop')
    for (const p of g.s.sparks) {
      const s = app.renderer.toScreen(p.x + 0.5, p.y + 0.5);
      const ux = s.x / ui.scale, uy = s.y / ui.scale;
      const inside = ux > c.x && ux < c.x + c.w && uy > c.y && uy < c.y + c.h;
      if (inside) continue;
      const ex = Math.max(c.x + 6, Math.min(c.x + c.w - 14, ux)), ey = Math.max(c.y + 18, Math.min(c.y + c.h - 14, uy));
      badge(ui, Math.round(ex), Math.round(ey), p.kind === 'vein' ? 'VEIN!' : 'INSPECTOR!', C.brass1);
    }
  // the pinned report, only on its own floor
  if (app.panel) return;
  const w = Math.min(206, c.w - 8);
  // the card sits on the side of the view away from what it reports on
  const side = (tx: number) => {
    const sx = app.renderer.toScreen(tx, 0).x / ui.scale;
    const left = c.x + 4, right = c.x + c.w - w - 4;
    const under = (x0: number) => sx > x0 - 12 && sx < x0 + w + 12;
    return under(left) && !under(right) ? right : left;
  };
  if (app.floor === 'workshop' && app.selected) {
    const e = g.byId.get(app.selected);
    if (e) reportCard(app, e, side(e.x + e.w / 2), c.y + 20, w);
    else app.selected = null;
  } else if (app.floor === 'factory' && app.fselected) {
    const e = g.fById.get(app.fselected);
    if (e && e.kind !== 'trunk') factoryCard(app, e, side(e.x + 0.5), c.y + 20, w);
  }
}

/** The report lines for anything on the Workshop: machines (with their Act II lines) and the
 *  power buildings. */
function entLines(app: App, e: Ent): { text: string; tone: Tone }[] {
  const g = app.game;
  if (isPower(e.kind)) return powerReport(app, e);
  const lines: { text: string; tone: Tone }[] = report(g, e);
  if (!lines.length) return lines;
  if (e.why === 'power' && lines[1]) lines[1] = { text: 'Stopped: no power', tone: 'blue' };
  return [...lines.slice(0, 2), ...act2Lines(app, e), ...lines.slice(2)];
}

/** Power and Overdrive lines for a machine (DESIGN.md §18). */
function act2Lines(app: App, e: Ent): { text: string; tone: Tone }[] {
  const g = app.game;
  const out: { text: string; tone: Tone }[] = [];
  if (powered(e.kind)) {
    const gi = gridIndex(g, e);
    const draw = drawKw(e);
    if (gi < 0) out.push({ text: `No Pole reaches it: put one within ${poleReach(g)} tiles (it draws ${draw} kW)`, tone: 'blue' });
    else {
      const gr = g.grids[gi];
      const cap = capacity(g, gr);
      if (cap <= 0) out.push({ text: `No power: grid ${gi + 1} has no fuelled Steam Engine or Generator`, tone: 'blue' });
      else out.push({ text: `Power ${Math.round(gr.sat * 100)}%: grid ${gi + 1} ${kw(cap)} for ${kw(gr.demand)} wanted; it draws ${Math.round(draw)} kW`, tone: gr.sat < 1 ? 'warn' : 'good' });
      if (gr.sat < 1 && cap > 0) out.push({ text: `Brownout: every machine on the grid runs at ${Math.round(gr.sat * 100)}% speed`, tone: 'warn' });
    }
    if (g.done('tuning')) {
      const m = e.mode ?? 'normal';
      out.push({ text: `Mode: ${MODE_NAME[m]} (${modeSpeed(e)}x speed)`, tone: m === 'normal' ? 'dim' : 'plain' });
    }
  }
  if (g.done('overdrive') && !(e.kind === 'furnace' && !g.has('bellows'))) {
    const od = e.od ?? 0, cool = e.cool ?? 0;
    if (od > 0) out.push({ text: `Overdriven: ${RULES.overdriveMult.value}x for ${Math.ceil(od / TICK_RATE)} s more`, tone: 'hot' });
    else if (cool > 0) out.push({ text: `Cooling: Overdrive again in ${Math.ceil(cool / TICK_RATE)} s`, tone: 'dim' });
    else out.push({ text: `Overdrive: click to run ${RULES.overdriveMult.value}x for ${RULES.overdriveSeconds.value} s`, tone: 'hot' });
  }
  return out;
}

const MODE_NAME: Record<Mode, string> = { normal: 'Normal', efficient: 'Efficient', overclock: 'Overclocked', precision: 'Precision' };
const MODE_SHORT: Record<Mode, string> = { normal: 'Norm', efficient: 'Eff', overclock: 'Over', precision: 'Prec' };

function modeTip(m: Mode, base: number): { text: string; color?: string }[] {
  const sp = m === 'efficient' ? RULES.modeEfficientSpeed.value : m === 'overclock' ? RULES.modeOverclockSpeed.value : m === 'precision' ? RULES.modePrecisionSpeed.value : 1;
  const pw = m === 'efficient' ? RULES.modeEfficientPower.value : m === 'overclock' ? RULES.modeOverclockPower.value : 1;
  const extra = m === 'precision' ? `, +${Math.round(RULES.modePrecisionYield.value * 100)}% of its main output` : '';
  return [{ text: MODE_NAME[m], color: C.teal1 }, { text: `${sp}x speed at ${pw}x power (${Math.round(base * pw)} kW)${extra}.` }];
}

/** Boilers, Steam Engines, Generators and Poles: what they are doing, their fuel, their grid. */
function powerReport(app: App, e: Ent): { text: string; tone: Tone }[] {
  const g = app.game;
  const out: { text: string; tone: Tone }[] = [{ text: entName(g, e), tone: 'plain' }];
  const gi = gridIndex(g, e);
  const gr = gi >= 0 ? g.grids[gi] : null;
  const gridLine = () => {
    if (!gr) return;
    const cap = capacity(g, gr);
    out.push({ text: `Grid ${gi + 1}: ${kw(cap)} for ${kw(gr.demand)} wanted (${gr.poles.length} Pole${gr.poles.length > 1 ? 's' : ''}, ${gr.producers.length} producer${gr.producers.length === 1 ? '' : 's'}, ${gr.consumers.length} machine${gr.consumers.length === 1 ? '' : 's'})`, tone: gr.demand > 0 && cap <= 0 ? 'blue' : gr.sat < 1 ? 'warn' : 'plain' });
  };
  const fuel = (b: Ent) => {
    const n = fuelCount(b);
    const left = b.prog > 0 ? `, burning ${(b.prog / TICK_RATE).toFixed(1)} s of fuel` : '';
    out.push({ text: `Fuel: ${n} waiting${left}. Burns 1 per ${BUILD[b.kind].fuel!.seconds} s at full load`, tone: n > 0 || b.prog > 0 ? 'dim' : 'warn' });
  };
  const status = (p: Ent, made: string) => {
    if (p.state === 'work') out.push({ text: made, tone: 'good' });
    else if (p.state === 'starved') out.push({ text: 'Out of fuel: belt coal into it', tone: 'warn' });
    else if (p.why === 'pole') out.push({ text: `Not connected: put a Pole within ${poleReach(g)} tiles`, tone: 'dim' });
    else if (p.why === 'engine') out.push({ text: 'No Steam Engine at its front: turn it to face one (R)', tone: 'warn' });
    else out.push({ text: 'Standing by: nothing on its grid wants power', tone: 'dim' });
  };
  switch (e.kind) {
    case 'boiler': {
      const eng = engineOf(g, e);
      status(e, `Burning: steaming ${eng ? entName(g, eng) : 'its engine'}`);
      fuel(e);
      out.push({ text: 'Takes coal or oil from a belt or machine on any side but its front.', tone: 'dim' });
      break;
    }
    case 'steamEngine': {
      const b = burnerOf(g, e);
      status(e, `Making ${kw(producerKw(g, e))}`);
      if (b) out.push({ text: `Steam from ${entName(g, b)}${fuelCount(b) + b.prog > 0 ? '' : ', which has no fuel'}`, tone: fuelCount(b) + b.prog > 0 ? 'dim' : 'warn' });
      else out.push({ text: 'No Boiler faces it: put one behind it, facing it', tone: 'bad' });
      if (!gr) out.push({ text: `Not on a grid: put a Pole within ${poleReach(g)} tiles`, tone: 'warn' });
      break;
    }
    case 'generator': {
      status(e, `Making ${kw(producerKw(g, e))}`);
      fuel(e);
      if (!gr) out.push({ text: `Not on a grid: put a Pole within ${poleReach(g)} tiles`, tone: 'warn' });
      break;
    }
    case 'pole': {
      if (!gr || gr.consumers.length + gr.producers.length === 0) out.push({ text: 'Powers nothing yet: machines and engines within its reach join its grid', tone: 'dim' });
      out.push({ text: `Reaches ${poleReach(g)} tiles (a ${poleReach(g) * 2 + 1}x${poleReach(g) * 2 + 1} square); links Poles within ${RULES.poleLink.value}`, tone: 'dim' });
      break;
    }
  }
  gridLine();
  return out;
}

function reportCard(app: App, e: Ent, x: number, y: number, w: number) {
  const ui = app.ui;
  const g = app.game;
  const lines = entLines(app, e);
  if (!lines.length) { app.selected = null; return; }
  const wrapped: { text: string; color: string }[] = [];
  for (const l of lines.slice(1)) for (const t of wrap(l.text, w - 16)) wrapped.push({ text: t, color: TONE[l.tone] });
  // the whole line around it, in plain English
  const lr = isMachine(e.kind) ? lineReport(g, e) : [];
  if (lr.length) {
    wrapped.push({ text: '', color: C.hull1 });
    for (const l of lr) for (const t of wrap(l.text, w - 16)) wrapped.push({ text: t, color: TONE[l.tone] });
  }
  const modes = powered(e.kind) && g.done('tuning');
  const h = 30 + wrapped.length * 10 + (modes ? 18 : 0);
  frame(ui, x, y, w, h);
  const s = sheet(spriteName(e.kind));
  const f = e.state === 'work' ? Math.floor(ui.time * 6) % s.frames.length : 0;
  ui.ctx.drawImage(s.frames[f], x + 6, y + 6, 16, 16);
  ui.clip(x + 26, y + 4, w - 44, 20);
  ui.text(lines[0].text, x + 26, y + 6, C.gold, { shadow: C.ink });
  const n = nominal(e);
  if (n.outs.length) ui.text(`${Math.round(n.outs[0].perMin)}/min when busy`, x + 26, y + 15, C.hull2);
  else if (isPower(e.kind)) ui.text(e.kind === 'pole' ? 'Power grid' : BUILD[e.kind].power ? `${BUILD[e.kind].power} kW` : 'Fuel burner', x + 26, y + 15, C.hull2);
  ui.unclip();
  wrapped.forEach((l, i) => ui.text(l.text, x + 6, y + 26 + i * 10, l.color));
  if (modes) {
    // mode buttons: Normal / Efficient / Overclocked / Precision
    const by = y + h - 18;
    const avail = w - 12;
    const bw = Math.floor((avail - 9) / 4);
    const full = MODES.every((m) => textWidth(MODE_NAME[m]) + 6 <= bw);
    MODES.forEach((m, i) => {
      const cur = (e.mode ?? 'normal') === m;
      if (button(ui, 'mode_' + m, x + 6 + i * (bw + 3), by, bw, 13, full ? MODE_NAME[m] : MODE_SHORT[m], { active: cur, tip: [...modeTip(m, BUILD[e.kind].kw ?? 0), { text: cur ? 'Its mode now.' : 'Click to switch.', color: C.hull2 }] }) && !cur) app.act({ k: 'mode', x: e.x, y: e.y, mode: m });
    });
  }
  if (button(ui, 'closeReport', x + w - 15, y + 4, 11, 11, 'x', { tip: 'Close (Esc)' })) app.selected = null;
}

/** The pinned report for a module (or the Factory Dock, Hopper or Bay) on the Factory floor. */
function factoryCard(app: App, e: FEnt, x: number, y: number, w: number) {
  const ui = app.ui;
  const lines = factoryReport(app, e);
  const wrapped: { text: string; color: string }[] = [];
  for (const l of lines.slice(1)) for (const t of wrap(l.text, w - 16)) wrapped.push({ text: t, color: l.color ?? C.bone });
  const h = 24 + wrapped.length * 10;
  frame(ui, x, y, w, h);
  if (e.kind === 'module') ui.ctx.drawImage(sheet('module').frames[0], x + 6, y + 4);
  ui.clip(x + 26, y + 4, w - 44, 12);
  ui.text(lines[0].text, x + 26, y + 7, C.gold, { shadow: C.ink });
  ui.unclip();
  wrapped.forEach((l, i) => ui.text(l.text, x + 6, y + 21 + i * 10, l.color));
  if (button(ui, 'closeReport', x + w - 15, y + 4, 11, 11, 'x', { tip: 'Close (Esc)' })) app.fselected = null;
}

// ------------------------------------------------------------------ toasts, trophies, refusals

const TOAST_ICON: Record<string, UIconName> = { flask: 'research', crate: 'orders', module: 'fold' };

/** The toasts that fit at the bottom of the left column (newest lowest), and a draw function. */
function toastStack(app: App, w: number, room: number, dt: number): { h: number; draw: (x: number, y: number) => void } {
  const ui = app.ui;
  for (const t of app.toasts) t.t += dt;
  app.toasts = app.toasts.filter((t) => t.t < t.life);
  const shown: { t: App['toasts'][number]; title: string[]; lines: string[]; h: number }[] = [];
  let total = 0;
  for (const t of app.toasts.slice().reverse()) {
    const icon = t.icon ? (TOAST_ICON[t.icon] ?? (t.icon in UICON ? (t.icon as UIconName) : null)) : null;
    const tx = icon ? 24 : 12;
    const title = wrap(t.title, w - tx - 6);
    const lines = wrap(t.text, w - 18);
    const h = 8 + title.length * 10 + lines.length * 10 + (icon && title.length < 2 ? 4 : 0);
    if (total + h + 3 > room && shown.length) break;
    if (total + h + 3 > room) {
      // no room at all (a tiny window): the column's lower cards stay
      break;
    }
    shown.push({ t, title, lines, h });
    total += h + 3;
    if (shown.length >= 3) break;
  }
  return {
    h: total,
    draw: (x0: number, y0: number) => {
      let y = y0 + total;
      for (const s of shown) {
        const t = s.t;
        y -= s.h + 3;
        const k = Math.min(1, t.t * 5);
        const slide = Math.round((1 - k * k * (3 - 2 * k)) * -(w + 8));
        const x = x0 + slide;
        const icon = t.icon ? (TOAST_ICON[t.icon] ?? (t.icon in UICON ? (t.icon as UIconName) : null)) : null;
        const tx = icon ? 24 : 12;
        ui.ctx.globalAlpha = Math.min(1, (t.life - t.t) * 2);
        if (hasArt('ui_toast')) {
          ui.region(x, y, w, s.h);
          nine(ui.ctx, sheet('ui_toast'), 0, x, y, w, s.h);
        } else frame(ui, x, y, w, s.h, 'wood');
        // a flash of the toast's colour as it lands
        if (t.t < 0.3) ui.fill(x + 3, y + 3, w - 6, s.h - 6, t.color, (0.3 - t.t) * 1.2);
        ui.fill(x + 4, y + 4, 2, s.h - 8, t.color);
        if (icon) uiIcon(ui, icon, x + 7, y + 4);
        s.title.forEach((l, i) => ui.text(l, x + tx, y + 5 + i * 10, t.color, { shadow: C.ink }));
        s.lines.forEach((l, i) => ui.text(l, x + 9, y + 5 + s.title.length * 10 + (icon && s.title.length < 2 ? 4 : 0) + i * 10, C.bone));
        ui.ctx.globalAlpha = 1;
      }
    },
  };
}

function trophyPopups(app: App, L: Layout, dt: number) {
  const ui = app.ui;
  for (const p of app.trophyPops) p.t += dt;
  app.trophyPops = app.trophyPops.filter((p) => p.t < 4);
  app.trophyPops.slice(-2).forEach((p, i) => {
    const t = TROPHIES.find((q) => q.id === p.id)!;
    const R = L.right;
    const w = R.w - 8, h = 26;
    const slide = Math.min(1, p.t * 5) * (p.t > 3.6 ? Math.max(0, (4 - p.t) / 0.4) : 1);
    const x = R.x + 4, y = Math.round(L.bottom.y - (h + 3) * (i + 1) + (1 - slide) * (h + 3) * 2);
    frame(ui, x, y, w, h, 'paper', false);
    uiIcon(ui, 'trophies', x + 5, y + 5);
    ui.text('Trophy!', x + 25, y + 4, C.brass0);
    ui.clip(x + 25, y, w - 28, h);
    ui.text(t.name, x + 25, y + 14, C.ink);
    ui.unclip();
  });
}

function wrap(s: string, w: number): string[] {
  const out: string[] = [];
  for (const para of s.split('\n')) {
    let line = '';
    for (const word of para.split(' ')) {
      const t = line ? line + ' ' + word : word;
      if (textWidth(t) > w && line) { out.push(line); line = word; } else line = t;
    }
    if (line) out.push(line);
  }
  return out;
}

function refusal(app: App, dt: number) {
  const r = app.refusal;
  if (!r) return;
  r.t -= dt;
  if (r.t <= 0) { app.refusal = null; return; }
  const ui = app.ui;
  const w = textWidth(r.text) + 8;
  const x = Math.max(2, Math.min(ui.w - w - 2, ui.mx - w / 2)), y = Math.max(16, ui.my - 22);
  ui.floating(() => {
    ui.ctx.globalAlpha = Math.min(1, r.t * 3);
    ui.fill(x, y, w, 12, C.ink, 0.92);
    ui.fill(x, y + 11, w, 1, C.pipRed);
    ui.text(r.text, x + 4, y + 2, C.bone);
    ui.ctx.globalAlpha = 1;
  });
}

/** Screen-wide moments over everything (screens included): the Megaproject's stage (a flash,
 *  confetti raining over the whole screen, a banner) and claims staked (a flag popping up where
 *  the click was). Drawn straight to the canvas: they pass, they are not layout. */
function celebrations(app: App, L: Layout, dt: number) {
  const ui = app.ui;
  const h = app.hud;
  const ctx = ui.ctx;
  for (const c of h.celebs) c.t += dt;
  h.celebs = h.celebs.filter((c) => c.t < (c.kind === 'megaDone' ? 4.5 : c.kind === 'splus' ? 3.2 : c.kind === 'banner' ? BANNER_S : 1.6));
  let bannerN = 0;
  // confetti rain
  if (h.rain.length) {
    const s = sheet('fx_confetti');
    for (const p of h.rain) {
      p.vy += 30 * dt;
      p.x += (p.vx + Math.sin(ui.time * 3 + p.spin) * 20) * dt;
      p.y += p.vy * dt;
      p.spin += dt * 8;
      const f = (p.f + Math.floor(p.spin)) % 8;
      if (p.gold) {
        // S+ rain: gold leaf that flips (wide, then thin) as it falls
        const thin = Math.floor(p.spin) % 2 === 0;
        ctx.fillStyle = p.f % 3 === 0 ? C.hot : C.gold;
        ctx.fillRect(Math.round(p.x), Math.round(p.y), thin ? 1 : 3, 2);
        if (!thin && p.f % 2) { ctx.fillStyle = C.bone; ctx.fillRect(Math.round(p.x), Math.round(p.y), 1, 1); }
      } else if (!s.placeholder) ctx.drawImage(s.frames[f % s.frames.length], Math.round(p.x), Math.round(p.y));
      else { ctx.fillStyle = [C.gold, C.pipRed, C.teal1, C.leaf][p.f % 4]; ctx.fillRect(Math.round(p.x), Math.round(p.y), 2, 2); }
    }
    h.rain = h.rain.filter((p) => p.y < ui.h + 8);
  }
  for (const c of h.celebs) {
    if (c.kind === 'megaDone') {
      if (c.t < 0.35) { ctx.fillStyle = rgba(C.hot, (0.35 - c.t) * 1.6); ctx.fillRect(0, 0, ui.w, ui.h); }
      // the banner drops in, bounces, holds, then lifts away
      const k = Math.min(1, c.t * 3);
      const drop = c.t < 0.33 ? (1 - k) * -60 : c.t > 3.8 ? (c.t - 3.8) * -120 : Math.round(Math.sin(Math.min(1, (c.t - 0.33) * 4) * Math.PI) * 4);
      const st = MEGA.find((m) => m.stage === c.value);
      const title = `${(st?.name ?? 'The Great Drill').toUpperCase()}!`;
      const sub = `Stage ${c.value ?? 1} built: ${st?.reward ?? ''}`;
      const sc = textWidth(title) * 3 + 40 <= ui.w ? 3 : 2;
      const bw = Math.max(textWidth(title) * sc, textWidth(sub)) + 30, bh = 9 * sc + 26;
      const bx = Math.floor(ui.w / 2 - bw / 2), by = Math.round(L.overlay.y + 24 + drop);
      ctx.fillStyle = rgba(C.ink, 0.5);
      ctx.fillRect(bx + 3, by + 3, bw, bh);
      if (hasArt('ui_panel')) nine(ctx, sheet('ui_panel'), 0, bx, by, bw, bh);
      else { ctx.fillStyle = C.brass0; ctx.fillRect(bx, by, bw, bh); }
      const glow = Math.floor(ui.time * 6) % 2 ? C.gold : C.hot;
      drawText(ctx, title, Math.floor(ui.w / 2 - (textWidth(title) * sc) / 2), by + 8, glow, sc, C.copper0);
      drawText(ctx, sub, Math.floor(ui.w / 2 - textWidth(sub) / 2), by + 12 + 9 * sc, C.bone, 1, C.ink);
    } else if (c.kind === 'splus') {
      // S+: a gold flash, then "S+ FLAWLESS!" drops in over the floor, bounces, and lifts away
      if (c.t < 0.25) { ctx.fillStyle = rgba(C.gold, (0.25 - c.t) * 1.4); ctx.fillRect(0, 0, ui.w, ui.h); }
      const k = Math.min(1, c.t * 4);
      const drop = c.t < 0.25 ? (1 - k) * -50 : c.t > 2.7 ? (c.t - 2.7) * -140 : Math.round(Math.sin(Math.min(1, (c.t - 0.25) * 4) * Math.PI) * 3);
      const title = c.id === 'fold' ? 'S+ MODULE!' : 'S+  FLAWLESS!';
      const sub = c.id === 'fold' ? 'The best fold there is: x1.35, in one tile.' : 'The top grade: every part at full marks.';
      const O = L.overlay;
      const onCard = app.panel === 'grade' || app.panel === 'fgrade';
      let bx: number, by: number, bw: number, bh: number, sc: number, row: boolean;
      if (onCard) {
        // on the grade card the banner is one compact row ABOVE the card (the Milestone 4 review:
        // it covered the U and W rows while the player read them); where there is no room above,
        // it overlaps only the card's title strip, never the parts
        const cw = Math.min(380, O.w - 12), ch = Math.min(264, O.h - 8);
        const cardY = O.y + Math.floor((O.h - ch) / 2);
        sc = 2;
        row = textWidth(title) * sc + 12 + textWidth(sub) + 24 <= Math.min(ui.w - 8, cw + 120);
        bw = textWidth(title) * sc + (row ? 12 + textWidth(sub) : 0) + 24;
        bh = 9 * sc + 8;
        bx = Math.floor(ui.w / 2 - bw / 2);
        const lift = c.t < 0.25 ? Math.round((1 - k) * -30) : c.t > 2.7 ? Math.round((c.t - 2.7) * -80) : 0;
        by = Math.max(O.y + 1, cardY - bh - 2) + lift;
      } else {
        sc = textWidth(title) * 3 + 40 <= ui.w ? 3 : 2;
        row = false;
        bw = Math.max(textWidth(title) * sc, textWidth(sub)) + 30;
        bh = 9 * sc + 26;
        bx = Math.floor(ui.w / 2 - bw / 2);
        by = Math.round(O.y + 34 + drop);
      }
      ctx.globalAlpha = c.t > 2.7 ? Math.max(0, 1 - (c.t - 2.7) * 2) : 1;
      ctx.fillStyle = rgba(C.ink, 0.5);
      ctx.fillRect(bx + 3, by + 3, bw, bh);
      if (hasArt('ui_panel')) nine(ctx, sheet('ui_panel'), 0, bx, by, bw, bh);
      else { ctx.fillStyle = C.brass0; ctx.fillRect(bx, by, bw, bh); }
      ctx.fillStyle = Math.floor(ui.time * 8) % 2 ? C.gold : C.hot;
      ctx.fillRect(bx + 4, by + 2, bw - 8, 1);
      ctx.fillRect(bx + 4, by + bh - 3, bw - 8, 1);
      const mid = bx + bw / 2;
      const glowCol = Math.floor(ui.time * 6) % 2 ? C.gold : C.hot;
      if (onCard) {
        drawText(ctx, title, bx + 12, by + 5, glowCol, sc, C.copper0);
        if (row) drawText(ctx, sub, bx + 12 + textWidth(title) * sc + 12, by + 5 + Math.floor((9 * sc - 7) / 2), C.bone, 1, C.ink);
      } else {
        drawText(ctx, title, Math.floor(mid - (textWidth(title) * sc) / 2), by + 8, glowCol, sc, C.copper0);
        drawText(ctx, sub, Math.floor(mid - textWidth(sub) / 2), by + 12 + 9 * sc, C.bone, 1, C.ink);
      }
      // sparkles orbiting the banner
      for (let i = 0; i < 10; i++) {
        const a = c.t * 3 + (i * Math.PI) / 5;
        ctx.fillStyle = i % 2 ? C.gold : C.bone;
        ctx.fillRect(Math.round(mid + Math.cos(a) * (bw / 2 + 8)), Math.round(by + bh / 2 + Math.sin(a) * (bh / 2 + 6)), 2, 2);
      }
      ctx.globalAlpha = 1;
    } else if (c.kind === 'banner') {
      // a first (a Codex entry, the first Mk2, a reputation level): a ribbon drops in at the top of
      // the floor view, holds, and lifts away; several stack
      const i = bannerN++;
      if (i > 2) continue;
      const title = c.title ?? '', sub = c.sub ?? '';
      const col = c.color ?? C.gold;
      const sc = textWidth(title) * 2 + 40 <= L.center.w ? 2 : 1;
      const bw = Math.min(ui.w - 8, Math.max(textWidth(title) * sc, textWidth(sub)) + 28), bh = 9 * sc + (sub ? 16 : 8);
      const cx = app.panel ? ui.w / 2 : L.center.x + L.center.w / 2;
      const k = Math.min(1, c.t * 5);
      const lift = c.t < 0.2 ? Math.round((1 - k) * -20) : c.t > BANNER_S - 0.4 ? Math.round((c.t - (BANNER_S - 0.4)) * -60) : 0;
      const bx = Math.floor(cx - bw / 2), by = (app.panel ? L.overlay.y + 4 : L.center.y + 20) + i * (bh + 4) + lift;
      ctx.globalAlpha = c.t > BANNER_S - 0.4 ? Math.max(0, (BANNER_S - c.t) / 0.4) : 1;
      ctx.fillStyle = rgba(C.ink, 0.5);
      ctx.fillRect(bx + 2, by + 2, bw, bh);
      ctx.fillStyle = C.ink;
      ctx.fillRect(bx, by, bw, bh);
      ctx.fillStyle = C.brass0;
      ctx.fillRect(bx + 1, by + 1, bw - 2, bh - 2);
      ctx.fillStyle = C.ground0;
      ctx.fillRect(bx + 2, by + 2, bw - 4, bh - 4);
      ctx.fillStyle = Math.floor(ui.time * 8) % 2 ? col : C.hot;
      ctx.fillRect(bx + 3, by + 2, bw - 6, 1);
      // ribbon tails
      ctx.fillStyle = C.brass0;
      ctx.fillRect(bx - 6, by + 4, 6, bh - 8);
      ctx.fillRect(bx + bw, by + 4, 6, bh - 8);
      ctx.fillStyle = C.ink;
      ctx.fillRect(bx - 6, by + Math.floor(bh / 2) - 1, 2, 2);
      ctx.fillRect(bx + bw + 4, by + Math.floor(bh / 2) - 1, 2, 2);
      drawText(ctx, title, Math.floor(cx - (textWidth(title) * sc) / 2), by + 4, Math.floor(ui.time * 6) % 2 ? col : C.gold, sc, C.ink);
      if (sub) drawText(ctx, sub, Math.floor(cx - textWidth(sub) / 2), by + 6 + 9 * sc, C.bone, 1, C.ink);
      if (c.t < 0.6) for (let j = 0; j < 8; j++) {
        const a = (j / 8) * Math.PI * 2, rr = 8 + c.t * 70;
        ctx.fillStyle = j % 2 ? col : C.bone;
        ctx.fillRect(Math.round(cx + Math.cos(a) * rr * 1.6), Math.round(by + bh / 2 + Math.sin(a) * rr * 0.5), 2, 2);
      }
      ctx.globalAlpha = 1;
    } else if (c.kind === 'claim') {
      // a flag on a stake pops up and waves, with "+4 claims"
      const k = Math.min(1, c.t * 6);
      const rise = Math.round(k * 16 + c.t * 6);
      const x = Math.round(c.x), y = Math.round(c.y - rise);
      ctx.globalAlpha = Math.min(1, (1.6 - c.t) * 2);
      const sc = c.t < 0.15 ? 2 : 1;
      if (hasArt('ui_icons')) ctx.drawImage(sheet('ui_icons').frames[UICON.claim], x - 8 * sc, y - 16 * sc, 16 * sc, 16 * sc);
      const txt = `+${c.value ?? 4} ${itemName(c.id ?? '').toLowerCase()} claims`;
      drawText(ctx, txt, x - Math.floor(textWidth(txt) / 2), y + 2, C.leaf, 1, C.ink);
      if (c.t < 0.5) for (let i = 0; i < 6; i++) {
        const a = i / 6 * Math.PI * 2 + c.t * 4, rr = 6 + c.t * 40;
        ctx.fillStyle = i % 2 ? C.gold : C.leaf;
        ctx.fillRect(Math.round(x + Math.cos(a) * rr), Math.round(y - 8 + Math.sin(a) * rr), 2, 2);
      }
      ctx.globalAlpha = 1;
    }
  }
}

/** seconds a first's banner stays up */
const BANNER_S = 2.8;

/** Put up a banner for a first (a Codex entry, the first Mk2, a reputation level). */
export function banner(app: App, title: string, sub: string, color: string = C.gold) {
  app.hud.celebs.push({ kind: 'banner', t: 0, x: 0, y: 0, title, sub, color });
}

// ------------------------------------------------------------------ the hover report

function hoverReport(app: App) {
  const ui = app.ui;
  const h = app.hud.hoverTile;
  if (!h && app.townTip && app.mode.k === 'idle' && !ui.tooltip) { ui.tip([{ text: app.townTip, color: C.gold }], 240); return; }
  if (!h || app.mode.k !== 'idle' || ui.tooltip) return;
  const g = app.game;
  if (app.floor === 'factory') {
    const fe = g.fentAt(h.x, h.y);
    if (fe && fe.id !== app.fselected) ui.tip([...factoryReport(app, fe), { text: 'Click to pin. R rotates, X removes (back to the inventory).', color: C.hull1 }], 220);
    return;
  }
  const e = g.entAt(h.x, h.y);
  const spark = g.s.sparks.find((p) => p.x === h.x && p.y === h.y);
  if (spark) {
    ui.tip([{ text: spark.kind === 'vein' ? 'Lucky Vein' : 'Inspector', color: C.gold }, { text: spark.kind === 'vein' ? "Click: this patch's miners run 3x for 60 s." : "Click: they grade this line and hand a minute of its output x the grade to research." }], 190);
    return;
  }
  if (!e) {
    if (!g.owned(h.x, h.y)) {
      const ch = g.chunkAt(h.x, h.y)!;
      const ready = !ch.requires || g.done(ch.requires);
      ui.tip([{ text: ch.name, color: C.gold }, { text: ready ? `Click to buy: ${ch.cost.toLocaleString('en-US')} coin` : `Research ${RESEARCH[ch.requires!].name} first` }], 170);
    } else if (g.oreAt(h.x, h.y)) {
      const ore = g.oreAt(h.x, h.y)!;
      ui.tip([{ text: itemName(ore), color: C.iron2 }, { text: 'Click: 1 into a machine beside the deposit. A Miner goes on it.' }], 180);
    }
    return;
  }
  if (app.selected === e.id) return;
  if (e.kind === 'dock') { ui.tip([{ text: 'The Dock', color: C.gold }, { text: BUILD.dock.blurb }, { text: 'Click for orders.', color: C.hull2 }], 170); return; }
  if (e.kind === 'hopper') { ui.tip([{ text: 'The Hopper', color: C.teal1 }, { text: BUILD.hopper.blurb }, { text: 'Click for the research tree.', color: C.hull2 }], 170); return; }
  if (e.kind === 'belt') {
    ui.tip([{ text: 'Belt', color: C.bone }, { text: e.item ? `Carrying ${itemName(e.item).toLowerCase()}${e.mv ? '' : ' (stuck: what is ahead will not take it)'}` : 'Empty' }], 180);
    return;
  }
  if (e.kind === 'heap') { ui.tip([{ text: 'Slag Heap', color: C.violet }, { text: `${e.count} / ${BUILD.heap.capacity} slag. Empties out its front into a belt or a brick press.` }], 180); return; }
  if (e.kind === 'crate') { ui.tip([{ text: 'Buffer Crate', color: C.copper2 }, { text: `${e.store.length} / ${BUILD.crate.capacity}` }], 150); return; }
  const lines = entLines(app, e);
  if (lines.length) ui.tip([...lines.map((l, i) => ({ text: l.text, color: i === 0 ? C.gold : TONE[l.tone] })), { text: powered(e.kind) && g.done('tuning') ? 'Click to pin this report and pick a mode.' : 'Click to pin this report.', color: C.hull1 }], 220);
}

// ------------------------------------------------------------------ title

export function drawTitle(app: App) {
  const ui = app.ui;
  const t = ui.time;
  // a slow belt of items crossing the screen under the title, and a dark floor
  const by = Math.floor(ui.h / 2) + 10;
  const belt = sheet('belt');
  for (let x = -16; x < ui.w + 16; x += 16) ui.ctx.drawImage(belt.frames[Math.floor(t * 8) % belt.frames.length], x, by);
  const items = ['ironOre', 'ironIngot', 'ironPlate', 'gear', 'copperWire', 'gizmo'];
  for (let i = 0; i < 14; i++) {
    const x = ((t * 32 + i * 44) % (ui.w + 64)) - 32;
    ui.ctx.drawImage(itemIcon(items[i % items.length]), Math.round(x), by + 4);
  }
  if (hasArt('logo')) {
    const s = sheet('logo');
    const k = Math.max(1, Math.min(3, Math.floor(ui.w / (s.w + 40))));
    const lx = Math.floor(ui.w / 2 - (s.w * k) / 2), ly = Math.floor(by - 30 - s.h * k);
    ui.ctx.drawImage(s.frames[0], lx, ly, s.w * k, s.h * k);
    if (hasArt('logo_glint')) {
      const gl = sheet('logo_glint');
      ui.ctx.drawImage(gl.frames[Math.floor(t * 10) % gl.frames.length], lx, ly, s.w * k, s.h * k);
    }
    ui.text('Build a line. Fold it into a tile. Build with what you folded.', Math.floor(ui.w / 2), by - 22, C.copper2, { align: 'center' });
  } else {
    const sc = Math.max(3, Math.min(6, Math.floor(ui.w / 90)));
    const ty = Math.floor(ui.h / 2) - 26 - sc * 9;
    ui.text(TITLE.toUpperCase(), Math.floor(ui.w / 2), ty, C.gold, { scale: sc, align: 'center', shadow: C.copper0 });
    ui.text('Build a line. Fold it into a tile. Build with what you folded.', Math.floor(ui.w / 2), ty + sc * 9 + 8, C.copper2, { align: 'center' });
  }
  const bw = 130, bx = Math.floor(ui.w / 2 - bw / 2);
  let y = by + 30;
  if (app.titleInfo.hasSave) {
    if (button(ui, 'continue', bx, y, bw, 20, 'Continue', { gold: true })) { app.audio.unlock(); app.continueGame(); }
    ui.text(`${ICON.coin} ${app.titleInfo.coin}`, bx + bw + 8, y + 6, C.gold);
    y += 24;
  }
  if (button(ui, 'new', bx, y, bw, 20, app.titleInfo.hasSave ? 'New game' : 'Start', { gold: !app.titleInfo.hasSave })) { app.audio.unlock(); app.newGame(); }
  ui.text('A frog mayor wants Gizmos. Nobody knows what they do.', Math.floor(ui.w / 2), ui.h - 16, C.hull1, { align: 'center' });
}
