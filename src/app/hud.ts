// The HUD, drawn every frame with the immediate-mode kit in UI pixels, in the UI redesign's
// layout (docs/ui-redesign.md, DECISIONS.md 2026-10-20): a thin top bar (topbar.ts), floating
// cards on the left (rail.ts), the build bar centred at the bottom (buildbar.ts), the Swamp Gazette
// as a crawl along the bottom edge, toasts and the pinned report on the right, and the floor
// behind all of it with its diegetic flag and ring. Full-screen menus (screens.ts) cover the
// floor; celebrations go over everything. Reads the App and the Game; changes the game only
// through App.act.
import { C, rgba } from '../data/palette';
import { BUILD, isMachine, isPower } from '../data/machines';
import { RESEARCH } from '../data/research';
import { TROPHIES } from '../data/trophies';
import { itemName, type ItemId } from '../data/items';
import { RULES } from '../data/rules';
import { MEGA } from '../data/megaprojects';
import { TICK_RATE } from '../engine/time';
import { TITLE } from '../game-info';
import { ICON, textWidth, drawText, ellipsize } from '../ui/font';
import { sheet, itemIcon, hasArt, spriteName, frameAt } from '../render/sprites';
import { report, nominal, lineReport, entName } from '../sim/analysis';
import { poleReach, drawKw } from '../sim/systems/power';
import { modeSpeed } from '../sim/systems/machines';
import { MODES, type Ent, type FEnt, type Mode } from '../sim/world';
import { nextGoal } from './goals';
import { layout, type Layout } from './layout';
import { plate, plateRaw, button, badge, uiIcon, nine, label, UICON, type UIconName } from './chrome';
import { drawScreen } from './screens';
import { auditBadge, factoryReport, factoryHover } from './fold';
import type { TipPlace } from '../ui/ui';
import { topBar } from './topbar';
import { rail, diegetic } from './rail';
import { buildBar } from './buildbar';
import { gridIndex, capacity, powered, burnerOf, fuelCount, engineOf, producerKw, kw } from '../render/powerview';
import type { App } from './app';
// Milestone 5: Reorganize's preview on the bar, and the Patent rules
import { previewPatents } from '../sim/reorganize';
import { prules } from '../sim/patents';

export interface HudState {
  /** the coin number shown, counting up toward the real value */
  coinShown: number;
  coinBump: number;
  hoverTile: { x: number; y: number } | null;
  /** the build bar's open category: one of the store's building tabs, or Upgrades */
  storeTab: 'build' | 'upgrades';
  /** build kinds the player has seen unlocked (for the NEW dot) */
  seen: Set<string>;
  /** the problem machine the line-health chip jumped to last */
  problemIdx: number;
  /** delivered totals sampled once a game second, for the Shipping per-minute rates */
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
  /** kinds whose store tab has been opened since they unlocked (a tab shows a dot until then) */
  tabSeen: Set<string>;
  /** tabs whose "new" chime has played */
  tabRung: Set<string>;
  /** screens opened at least once (their top-bar icon shows a dot until then) */
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
  // ---- the redesign
  /** rail cards folded to their title line */
  collapsed: Set<string>;
  /** the goal shown (its live numbers taken out), when it arrived, and the HUD element it names */
  goalKey: string | null;
  goalAt: number;
  goalUi: string | null;
  /** the crawl's headline is news that matters: bright for its first pass */
  crawlHot: boolean;
}

export function newHudState(): HudState {
  return {
    coinShown: 0, coinBump: 0, hoverTile: null, storeTab: 'build', seen: new Set(), problemIdx: 0, ship: [], focus: null, draft: '', fieldSeen: false, stamped: false, confetti: 0, flakes: [], treePage: 2, buildTab: 'build',
    tabSeen: new Set(), tabRung: new Set(), opened: new Set(), codexSeen: 0, celebs: [], rain: [], coinLast: -1, glints: [], firstMiner: false,
    collapsed: new Set(), goalKey: null, goalAt: -10, goalUi: null, crawlHot: false,
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
  if (!app.panel) {
    // the floor's own markers first (under every card), then the floating HUD
    diegetic(app, L);
    centerOverlay(app, L);
    rail(app, L);
    buildBar(app, L);
    auditBadge(app, L);
    pinnedReport(app, L);
  }
  crawl(app, L, dt);
  if (app.panel) drawScreen(app, L);
  topBar(app, L, dt);
  // a text field that is no longer drawn lets go of the keyboard
  if (!app.hud.fieldSeen && app.hud.focus) {
    app.hud.focus = null;
    app.input.typing = null;
  }
  sideStack(app, L, dt);
  if (!app.panel) hoverReport(app);
  refusal(app, dt);
  celebrations(app, L, dt);
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

// ------------------------------------------------------------------ the Gazette's crawl

/** The Swamp Gazette as a thin crawl along the very bottom edge: dim, no frame; breaking news (the
 *  town growing, an order filled) runs bright for its first pass. */
function crawl(app: App, L: Layout, dt: number) {
  const ui = app.ui;
  const r = L.crawl;
  const ctx = ui.ctx;
  ctx.fillStyle = rgba(C.ink, 0.82);
  ctx.fillRect(r.x, r.y, r.w, r.h);
  ctx.fillStyle = rgba(C.hull0, 0.8);
  ctx.fillRect(r.x, r.y, r.w, 1);
  const gz = app.gazette;
  if (!gz.text) app.hud.crawlHot = gz.next(app.game);
  gz.x -= dt * 30;
  const head = 'GAZETTE';
  const hw = ui.small(head, r.x + 4, r.y + 3, C.brass1) + 10;
  const tw = textWidth(gz.text);
  if (gz.x < -tw) {
    app.hud.crawlHot = gz.next(app.game);
    gz.x = r.w - hw;
  }
  ui.clip(hw, r.y + 1, r.w - hw - 2, r.h - 1);
  ui.text(gz.text, hw + Math.round(gz.x), r.y + 1, app.hud.crawlHot ? C.hot : C.hull2);
  ui.unclip();
  ui.hint(0, r.y, r.w, r.h, [{ text: 'The Swamp Gazette', color: C.brass1 }, { text: 'The swamp\'s paper: its headlines report on your factory now and then.' }], 180);
}

// ------------------------------------------------------------------ over the floor

function centerOverlay(app: App, L: Layout) {
  const ui = app.ui;
  const g = app.game;
  const c = L.center;
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
  const ph = app.panHints();
  const a = 0.35 + 0.25 * Math.sin(ui.time * 3);
  ui.ctx.globalAlpha = a;
  const mx = c.x + Math.floor(c.w / 2), my = c.y + Math.floor(c.h / 2);
  if (ph.l) drawText(ui.ctx, ICON.left, c.x + 3, my - 4, C.bone, 1, C.ink);
  if (ph.r) drawText(ui.ctx, ICON.right, c.x + c.w - 9, my - 4, C.bone, 1, C.ink);
  if (ph.u) drawText(ui.ctx, ICON.up, mx - 3, c.y + 4, C.bone, 1, C.ink);
  if (ph.d) drawText(ui.ctx, ICON.down, mx - 3, c.y + c.h - 10, C.bone, 1, C.ink);
  ui.ctx.globalAlpha = 1;
  // Sparks off-screen: an arrow at the edge of the frame pointing at them
  if (app.floor === 'workshop')
    for (const p of g.s.sparks) {
      const s = app.renderer.toScreen(p.x + 0.5, p.y + 0.5);
      const ux = s.x / ui.scale, uy = s.y / ui.scale;
      const inside = ux > c.x && ux < c.x + c.w && uy > c.y && uy < c.y + c.h;
      if (inside) continue;
      const ex = Math.max(c.x + 6, Math.min(c.x + c.w - 40, ux)), ey = Math.max(c.y + 6, Math.min(c.y + c.h - 14, uy));
      badge(ui, Math.round(ex), Math.round(ey), p.kind === 'vein' ? 'vein!' : 'inspector!', C.gold);
    }
}

/** where the toasts on the right must stop this frame (the pinned report's top, when it is there) */
let sideFloor = Infinity;

/** Room kept for toasts above a pinned report on the right (the UI legibility round: a tall report
 * pushed every toast off the screen): two trophies, or a toast of three lines. */
const TOAST_ROOM = 54;

/** How a pinned report fits: its width, the wider width it may take when it is tall, the most it
 * may be tall, and where it goes for a height and width. */
interface Fit { w: number; wide: number; maxH: number; place: (h: number, w: number) => { x: number; y: number } }

/** The pinned report, on its own floor: anchored bottom-right above the build bar (leaving room for
 *  toasts above it), or left of the floor when it would sit on what it reports on. */
function pinnedReport(app: App, L: Layout) {
  sideFloor = Infinity;
  const g = app.game;
  const ui = app.ui;
  const fit = (tx: number, ty: number): Fit => ({
    w: Math.min(206, L.center.w - 8),
    wide: Math.min(256, L.center.w - 8),
    maxH: L.band.y - 6 - (L.side.y + TOAST_ROOM),
    place: (h: number, w: number) => {
      const s = app.renderer.toScreen(tx, ty);
      const sx = s.x / ui.scale, sy = s.y / ui.scale;
      const right = L.side.x + L.side.w - w, left = L.center.x + 4;
      const y = Math.max(L.top.h + 4, L.band.y - h - 6);
      const under = (x0: number) => sx > x0 - 12 && sx < x0 + w + 12 && sy > y - 12 && sy < y + h + 12;
      const x = under(right) && !under(left) ? left : right;
      // the toasts above it on the right stop short of it
      if (x === right) sideFloor = y - 3;
      return { x, y };
    },
  });
  if (app.floor === 'workshop' && app.selected) {
    const e = g.byId.get(app.selected);
    if (e) reportCard(app, e, fit(e.x + e.w / 2, e.y + e.h / 2));
    else app.selected = null;
  } else if (app.floor === 'factory' && app.fselected) {
    const e = g.fById.get(app.fselected);
    if (e && e.kind !== 'trunk') factoryCard(app, e, fit(e.x + 0.5, e.y + 0.5));
  }
}

/** A report's lines wrapped to a width that keeps it under `fit.maxH`: its own width, then the
 *  wider one, then without the optional lines, then cut with a note of how many more there are. */
function fitLines(fit: Fit, chrome: number, build: (w: number, all: boolean) => { text: string; color: string }[]): { w: number; lines: { text: string; color: string }[] } {
  const tall = (n: number) => chrome + n * 10 > fit.maxH;
  let w = fit.w;
  let lines = build(w, true);
  if (tall(lines.length) && fit.wide > w) { w = fit.wide; lines = build(w, true); }
  if (tall(lines.length)) lines = build(w, false);
  if (tall(lines.length)) {
    const keep = Math.max(1, Math.floor((fit.maxH - chrome) / 10) - 1);
    const more = lines.length - keep;
    lines = [...lines.slice(0, keep), { text: `+${more} more line${more > 1 ? 's' : ''}: hover it for the whole report`, color: C.hull1 }];
  }
  return { w, lines };
}

/** The report lines for anything on the Workshop: machines (with their Act II lines) and the
 *  power buildings. */
function entLines(app: App, e: Ent): { text: string; tone: Tone }[] {
  const p = entParts(app, e);
  return p ? [...p.head, ...p.a2, ...p.rest] : [];
}

/** A report in its parts: the head (the name, any first-minute instruction, what it is doing now),
 *  the power and Overdrive lines, and the rest (rates, feed, byproduct, front). */
function entParts(app: App, e: Ent): { head: { text: string; tone: Tone }[]; a2: { text: string; tone: Tone }[]; rest: { text: string; tone: Tone }[] } | null {
  const g = app.game;
  if (isPower(e.kind)) { const p = powerReport(app, e); return { head: p.slice(0, 2), a2: [], rest: p.slice(2) }; }
  const lines: { text: string; tone: Tone }[] = report(g, e);
  if (!lines.length) return null;
  // the hand furnace's first-minute instruction comes before its status line
  const st = e.kind === 'furnace' && !g.has('bellows') && lines.length > 2 ? 2 : 1;
  if (e.why === 'power' && lines[st]) lines[st] = { text: 'Stopped: no power', tone: 'blue' };
  const a2 = act2Lines(app, e);
  // the grid's Brownout line says it already: drop the report's "Short of power" under it
  const rest = a2.some((l) => l.text.startsWith('Brownout')) ? lines.slice(st + 1).filter((l) => !l.text.startsWith('Short of power')) : lines.slice(st + 1);
  return { head: lines.slice(0, st + 1), a2, rest };
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

function reportCard(app: App, e: Ent, fit: Fit) {
  const ui = app.ui;
  const g = app.game;
  const lines = entLines(app, e);
  if (!lines.length) { app.selected = null; return; }
  const modes = powered(e.kind) && g.done('tuning');
  // the whole line around it, in plain English (left out first when the report would be too tall)
  const lr = isMachine(e.kind) ? lineReport(g, e) : [];
  const { w, lines: wrapped } = fitLines(fit, 30 + (modes ? 18 : 0), (ww, all) => {
    const out: { text: string; color: string }[] = [];
    for (const l of lines.slice(1)) for (const t of wrap(l.text, ww - 14)) out.push({ text: t, color: TONE[l.tone] });
    if (all && lr.length) {
      out.push({ text: '', color: C.hull1 });
      for (const l of lr) for (const t of wrap(l.text, ww - 14)) out.push({ text: t, color: TONE[l.tone] });
    }
    return out;
  });
  const h = 30 + wrapped.length * 10 + (modes ? 18 : 0);
  const { x, y } = fit.place(h, w);
  const pip = e.state === 'work' ? C.pipGreen : e.state === 'blocked' ? C.pipRed : e.state === 'starved' ? (e.why === 'power' ? C.pipBlue : C.pipYellow) : C.hull1;
  plate(ui, x, y, w, h, { accent: pip });
  ui.fill(x + 5, y + 5, 18, 18, C.ink);
  const s = sheet(spriteName(e.kind));
  const f = e.state === 'work' ? Math.floor(ui.time * 6) % s.frames.length : 0;
  ui.ctx.drawImage(s.frames[f], x + 6, y + 6, 16, 16);
  ui.clip(x + 27, y + 4, w - 46, 20);
  ui.text(lines[0].text, x + 27, y + 5, C.gold, { shadow: C.ink });
  const n = nominal(e);
  if (n.outs.length) ui.small(`${Math.round(n.outs[0].perMin)}/min when busy`, x + 27, y + 16, C.hull2);
  else if (isPower(e.kind)) ui.small(e.kind === 'pole' ? 'power grid' : BUILD[e.kind].power ? `${BUILD[e.kind].power} kW` : 'fuel burner', x + 27, y + 16, C.hull2);
  ui.unclip();
  wrapped.forEach((l, i) => ui.text(l.text, x + 6, y + 27 + i * 10, l.color));
  if (modes) {
    // mode buttons: Normal / Efficient / Overclocked / Precision
    const by = y + h - 17;
    const avail = w - 12;
    const bw = Math.floor((avail - 9) / 4);
    const full = MODES.every((m) => textWidth(MODE_NAME[m]) + 6 <= bw);
    MODES.forEach((m, i) => {
      const cur = (e.mode ?? 'normal') === m;
      if (button(ui, 'mode_' + m, x + 6 + i * (bw + 3), by, bw, 13, full ? MODE_NAME[m] : MODE_SHORT[m], { active: cur, tip: [...modeTip(m, BUILD[e.kind].kw ?? 0), { text: cur ? 'Its mode now.' : 'Click to switch.', color: C.hull2 }] }) && !cur) app.act({ k: 'mode', x: e.x, y: e.y, mode: m });
    });
  }
  if (button(ui, 'closeReport', x + w - 16, y + 4, 12, 11, ICON.cross, { tip: 'Close (Esc)' })) app.selected = null;
}

/** The pinned report for a module (or the Factory Dock, Hopper or Bay) on the Factory floor. */
function factoryCard(app: App, e: FEnt, fit: Fit) {
  const ui = app.ui;
  const lines = factoryReport(app, e);
  const { w, lines: wrapped } = fitLines(fit, 26, (ww) => {
    const out: { text: string; color: string }[] = [];
    for (const l of lines.slice(1)) for (const t of wrap(l.text, ww - 14)) out.push({ text: t, color: l.color ?? C.bone });
    return out;
  });
  const h = 26 + wrapped.length * 10;
  const { x, y } = fit.place(h, w);
  const pip = e.kind !== 'module' ? C.gold : e.state === 'work' ? C.pipGreen : e.state === 'blocked' ? C.pipRed : e.state === 'starved' ? C.pipYellow : C.hull1;
  plate(ui, x, y, w, h, { accent: pip });
  if (e.kind === 'module') ui.ctx.drawImage(sheet('module').frames[0], x + 6, y + 5);
  ui.clip(x + 27, y + 4, w - 46, 12);
  ui.text(lines[0].text, x + 27, y + 7, C.gold, { shadow: C.ink });
  ui.unclip();
  wrapped.forEach((l, i) => ui.text(l.text, x + 6, y + 23 + i * 10, l.color));
  if (button(ui, 'closeReport', x + w - 16, y + 4, 12, 11, ICON.cross, { tip: 'Close (Esc)' })) app.fselected = null;
}

// ------------------------------------------------------------------ toasts, trophies, refusals

const TOAST_ICON: Record<string, UIconName> = { flask: 'research', crate: 'orders', module: 'fold' };

/** The right side: toasts stacking down from the top-right corner (newest on top, sliding in and
 *  fading out), then the trophies just earned. No column behind them. Every line is wrapped to the
 *  column (a long word is cut to fit), so nothing runs off the screen; a toast that has no room in
 *  full shows its title alone, and one with no room for that waits off the stack. A toast that has
 *  landed is on the audit's 'float' layer: on screen, inside its plate, over no other HUD text. */
function sideStack(app: App, L: Layout, dt: number) {
  const ui = app.ui;
  for (const t of app.toasts) t.t += dt;
  app.toasts = app.toasts.filter((t) => t.t < t.life);
  for (const p of app.trophyPops) p.t += dt;
  app.trophyPops = app.trophyPops.filter((p) => p.t < 4);
  const S = L.side;
  const w = S.w;
  let y = S.y;
  const bottom = app.panel ? L.overlay.y + L.overlay.h : Math.min(L.band.y - 4, sideFloor);
  for (const t of app.toasts.slice().reverse()) {
    const icon = t.icon ? (TOAST_ICON[t.icon] ?? (t.icon in UICON ? (t.icon as UIconName) : null)) : null;
    const tx = icon ? 24 : 8;
    const tw = w - tx - 6;
    let title = fitWrap(t.title, tw);
    let lines = fitWrap(t.text, tw);
    let h = Math.max(icon ? 24 : 0, 9 + title.length * 10 + lines.length * 10);
    if (y + h > bottom) {
      // no room in full: the title alone, on one line
      title = [ellipsize(t.title, tw)];
      lines = [];
      h = Math.max(icon ? 24 : 0, 19);
      if (y + h > bottom) break;
    }
    const k = Math.min(1, t.t * 5);
    const x = S.x + Math.round((1 - k * k * (3 - 2 * k)) * (w + 8));
    ui.ctx.globalAlpha = Math.min(1, (t.life - t.t) * 2);
    ui.floating(() => {
      plate(ui, x, y, w, h, { accent: t.color, blocking: false });
      // a flash of the toast's colour as it lands
      if (t.t < 0.3) ui.fill(x + 1, y + 2, w - 2, h - 3, t.color, (0.3 - t.t) * 1.2);
      if (icon) uiIcon(ui, icon, x + 5, y + 4);
      title.forEach((l, i) => ui.text(l, x + tx, y + 5 + i * 10, t.color, { shadow: C.ink }));
      lines.forEach((l, i) => ui.text(l, x + tx, y + 5 + title.length * 10 + i * 10, C.bone));
    }, k < 1 ? 'tip' : 'float');
    ui.ctx.globalAlpha = 1;
    y += h + 3;
  }
  for (const p of app.trophyPops.slice(-2)) {
    const t = TROPHIES.find((q) => q.id === p.id)!;
    // the trophy's name wraps under its label (two lines at most) instead of running off the edge
    const name = fitWrap(t.name, w - 30).slice(0, 2);
    const h = 16 + name.length * 10;
    if (y + h > bottom) break;
    const slide = Math.min(1, p.t * 5) * (p.t > 3.6 ? Math.max(0, (4 - p.t) / 0.4) : 1);
    const x = S.x + Math.round((1 - slide) * (w + 8));
    ui.floating(() => {
      plate(ui, x, y, w, h, { accent: C.gold, blocking: false, fill: C.brass0, alpha: 0.95 });
      uiIcon(ui, 'trophies', x + 5, y + Math.floor((h - 16) / 2));
      label(ui, 'trophy!', x + 24, y + 5, C.hot);
      name.forEach((l, i) => ui.text(l, x + 24, y + 12 + i * 10, C.bone, { shadow: C.ink }));
    }, slide < 1 ? 'tip' : 'float');
    y += h + 3;
  }
}

/** Wrap to a width, cutting any single word wider than it (a toast never runs off the screen). */
function fitWrap(s: string, w: number): string[] {
  return wrap(s, w).map((l) => (textWidth(l) > w ? ellipsize(l, w) : l));
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
      // between the cards on the left and the toasts on the right (or the whole width over a menu)
      const room = app.panel ? ui.w - 8 : L.side.x - (L.rail.x + L.rail.w) - 8;
      const sc = textWidth(title) * 2 + 40 <= room ? 2 : 1;
      const bw = Math.min(ui.w - 20, Math.max(textWidth(title) * sc, textWidth(sub)) + 28), bh = 9 * sc + (sub ? 16 : 8);
      const cx = app.panel || bw > room - 12 ? ui.w / 2 : Math.round((L.rail.x + L.rail.w + L.side.x) / 2);
      const k = Math.min(1, c.t * 5);
      const lift = c.t < 0.2 ? Math.round((1 - k) * -20) : c.t > BANNER_S - 0.4 ? Math.round((c.t - (BANNER_S - 0.4)) * -60) : 0;
      const bx = Math.floor(cx - bw / 2), by = (app.panel ? L.overlay.y + 4 : L.center.y + 8) + i * (bh + 4) + lift;
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

/** Where a world tooltip may sit: never over the hovered tile and its neighbours, nor the tile the
 * goal points at (the first minute: the ore's tooltip sat on the Hand Furnace just as the goal said
 * to crank it), and inside the floor between the top bar and the build bar where it fits (the
 * Milestone 5-6 final round). */
function worldTip(app: App, x: number, y: number, w = 1, h = 1): TipPlace {
  const ui = app.ui;
  const L = app.layout ?? layout(ui.w, ui.h);
  const r = app.renderer;
  const k = ui.scale;
  const rect = (x0: number, y0: number, x1: number, y1: number) => {
    const a = r.toScreen(x0, y0), b = r.toScreen(x1, y1);
    return { x: Math.floor(a.x / k), y: Math.floor(a.y / k), w: Math.ceil((b.x - a.x) / k), h: Math.ceil((b.y - a.y) / k) };
  };
  const avoid = [rect(x - 1, y - 1, x + w + 1, y + h + 1)];
  const goal = app.floor === 'workshop' ? nextGoal(app.game) : null;
  if (goal?.tile) avoid.push(rect(goal.tile.x - 0.25, goal.tile.y - 0.25, goal.tile.x + 1.25, goal.tile.y + 1.25));
  return { avoid, bounds: { x: 2, y: L.top.h + 2, w: ui.w - 4, h: L.band.y - L.top.h - 4 } };
}

/** The hover report, kept short (the Milestone 5-6 final round: fifteen lines covered a third of
 * the floor): the name, what it is doing, the one cause most worth fixing and how, its rate. The
 * whole report is a click away, pinned. */
function compactEnt(app: App, e: Ent): { text: string; color: string }[] {
  const g = app.game;
  const p = entParts(app, e);
  if (!p) return [];
  const pool = [...p.rest, ...p.a2.filter((l) => l.tone !== 'hot')];
  // blocked by its own byproduct: the fix is where the byproduct goes, whatever that line's tone
  const byFix = e.state === 'blocked' && e.why && e.why === e.byItem ? p.rest.find((l) => l.text.includes('leaves by a side')) : undefined;
  const cause = pool.find((l) => l.tone === 'bad') ?? byFix ?? pool.find((l) => l.tone === 'blue') ?? pool.find((l) => l.tone === 'warn');
  const rate = p.rest.find((l) => l.text.startsWith('Makes ')) ?? p.rest.find((l) => l.text.startsWith('Grid '));
  const hot = p.a2.find((l) => l.text.startsWith('Overdriven'));
  const ready = p.a2.find((l) => l.text.startsWith('Overdrive: click'));
  const picked = [hot, cause, rate].filter((l, i, a): l is { text: string; tone: Tone } => !!l && a.indexOf(l) === i);
  const shown = [...p.head, ...picked];
  const more = p.head.length + p.a2.length + p.rest.length - shown.length - (ready ? 1 : 0);
  const out = shown.map((l, i) => ({ text: l.text, color: i === 0 ? C.gold : TONE[l.tone] }));
  const modes = powered(e.kind) && g.done('tuning');
  const what = `the full report${more > 0 ? ` (+${more} line${more > 1 ? 's' : ''})` : ''}${modes ? ' and its modes' : ''}`;
  if (ready) {
    out.push({ text: `Click: Overdrive ${RULES.overdriveMult.value}x for ${RULES.overdriveSeconds.value} s`, color: TONE.hot });
    out.push({ text: `While it cools, a click pins ${what}.`, color: C.hull1 });
  } else out.push({ text: `Click to pin ${what}.`, color: C.hull1 });
  return out;
}

function hoverReport(app: App) {
  const ui = app.ui;
  const h = app.hud.hoverTile;
  if (!h && app.townTip && app.mode.k === 'idle' && !ui.tooltip) { ui.tip([{ text: app.townTip, color: C.gold }], 240); return; }
  if (!h || app.mode.k !== 'idle' || ui.tooltip) return;
  const g = app.game;
  if (app.floor === 'factory') {
    const fe = g.fentAt(h.x, h.y);
    if (fe && fe.id !== app.fselected) ui.tip(factoryHover(app, fe), 200, worldTip(app, fe.x, fe.y));
    return;
  }
  const at = worldTip(app, h.x, h.y);
  const e = g.entAt(h.x, h.y);
  const spark = g.s.sparks.find((p) => p.x === h.x && p.y === h.y);
  if (spark) {
    ui.tip([{ text: spark.kind === 'vein' ? 'Lucky Vein' : 'Inspector', color: C.gold }, { text: spark.kind === 'vein' ? "Click: this patch's miners run 3x for 60 s." : "Click: they grade this line and hand a minute of its output x the grade to research." }], 190, at);
    return;
  }
  if (!e) {
    if (!g.owned(h.x, h.y)) {
      const ch = g.chunkAt(h.x, h.y)!;
      const ready = !ch.requires || g.done(ch.requires);
      ui.tip([{ text: ch.name, color: C.gold }, { text: ready ? `Click to buy: ${ch.cost.toLocaleString('en-US')} coin` : `Research ${RESEARCH[ch.requires!].name} first` }], 170, at);
    } else if (g.oreAt(h.x, h.y)) {
      const ore = g.oreAt(h.x, h.y)!;
      ui.tip([{ text: itemName(ore), color: C.iron2 }, { text: 'Click: 1 into a machine beside the deposit. A Miner goes on it.' }], 180, at);
    }
    return;
  }
  if (app.selected === e.id) return;
  const on = worldTip(app, e.x, e.y, e.w, e.h);
  if (e.kind === 'dock') { ui.tip([{ text: 'The Dock', color: C.gold }, { text: BUILD.dock.blurb }, { text: 'Click for orders.', color: C.hull2 }], 170, on); return; }
  if (e.kind === 'hopper') { ui.tip([{ text: 'The Hopper', color: C.teal1 }, { text: BUILD.hopper.blurb }, { text: 'Click for the research tree.', color: C.hull2 }], 170, on); return; }
  if (e.kind === 'belt') {
    ui.tip([{ text: 'Belt', color: C.bone }, { text: e.item ? `Carrying ${itemName(e.item).toLowerCase()}${e.mv ? '' : ' (stuck: what is ahead will not take it)'}` : 'Empty' }], 180, on);
    return;
  }
  if (e.kind === 'heap') { ui.tip([{ text: 'Slag Heap', color: C.violet }, { text: `${e.count} / ${BUILD.heap.capacity} slag. Empties out its front into a belt or a brick press.` }], 180, on); return; }
  if (e.kind === 'crate') { ui.tip([{ text: 'Buffer Crate', color: C.copper2 }, { text: `${e.store.length} / ${BUILD.crate.capacity}` }], 150, on); return; }
  const lines = compactEnt(app, e);
  if (lines.length) ui.tip(lines, 200, on);
}

// ------------------------------------------------------------------ title

export function drawTitle(app: App) {
  if (hasArt('title_scene') && hasArt('logo')) return drawTitleScene(app);
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

/** The title over the art director's key art ('title_scene', 320x180, STYLE.md): the scene at
 *  the smallest whole-number scale that covers the screen, centred and cropped, never smoothed.
 *  Everything is placed in scene coordinates so it lands on the scene's calm areas: the logo and
 *  tagline on the sky band (scene y 14-66), the buttons on the open water (y 104+), the last
 *  line on the dark water along the bottom. */
function drawTitleScene(app: App) {
  const ui = app.ui;
  const t = ui.time;
  const sc = sheet('title_scene');
  const SW = sc.w, SH = sc.h;
  const k = Math.max(1, Math.ceil(Math.max(ui.w / SW, ui.h / SH)));
  const ox = Math.floor((ui.w - SW * k) / 2), oy = Math.floor((ui.h - SH * k) / 2);
  ui.ctx.drawImage(sc.frames[frameAt(sc, t)], ox, oy, SW * k, SH * k);
  const at = (sy: number) => oy + sy * k;
  const s = sheet('logo');
  const lk = Math.max(1, Math.min(3, Math.floor(ui.w / (s.w + 24))));
  const lx = Math.floor(ui.w / 2 - (s.w * lk) / 2);
  const ly = Math.max(4, at(14));
  ui.ctx.drawImage(s.frames[0], lx, ly, s.w * lk, s.h * lk);
  if (hasArt('logo_glint')) {
    const gl = sheet('logo_glint');
    ui.ctx.drawImage(gl.frames[Math.floor(t * 10) % gl.frames.length], lx, ly, s.w * lk, s.h * lk);
  }
  ui.text('Build a line. Fold it into a tile. Build with what you folded.', Math.floor(ui.w / 2), ly + s.h * lk + 6, C.copper2, { align: 'center', shadow: C.ink });
  const bw = 130, bx = Math.floor(ui.w / 2 - bw / 2);
  let y = Math.min(ui.h - 70, at(104));
  if (app.titleInfo.hasSave) {
    if (button(ui, 'continue', bx, y, bw, 20, 'Continue', { gold: true })) { app.audio.unlock(); app.continueGame(); }
    ui.text(`${ICON.coin} ${app.titleInfo.coin}`, bx + bw + 8, y + 6, C.gold, { shadow: C.ink });
    y += 24;
  }
  if (button(ui, 'new', bx, y, bw, 20, app.titleInfo.hasSave ? 'New game' : 'Start', { gold: !app.titleInfo.hasSave })) { app.audio.unlock(); app.newGame(); }
  ui.text('A frog mayor wants Gizmos. Nobody knows what they do.', Math.floor(ui.w / 2), ui.h - 16, C.hull2, { align: 'center', shadow: C.ink });
}
