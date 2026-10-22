// The HUD, drawn every frame with the immediate-mode kit in UI pixels, on the 180's screen
// (docs/hud-180.md "The screen", DECISIONS.md "The 180"): no strips, no columns. The floor runs
// edge to edge and carries its own numbers (floortags.ts); things hang on its corners: the Purse,
// its rate tag, the trouble bell and the Committee's slip top-left (topbar.ts), the lift top-right
// with the slips under it, the speaker's corner bottom-left (rail.ts), the notebook and the Swamp
// Gazette bottom-right (gazette.ts). Reports are tags on strings (tags.ts). Full-screen menus are
// the ledger book (screens.ts) with the notebook's section tabs down its right edge; celebrations
// go over everything; the Workbench Wheel (wheel.ts) is drawn last, under only the tooltips.
// Reads the App and the Game; changes the game only through App.act.
import { C, rgba } from '../data/palette';
import { BUILD } from '../data/machines';
import { RESEARCH } from '../data/research';
import { TROPHIES } from '../data/trophies';
import { itemName, ITEMS, type ItemId } from '../data/items';
import { MEGA, MEGAS, type MegaId } from '../data/megaprojects';
import { TITLE } from '../game-info';
import { ICON, textWidth, bigWidth, drawText, LINE_H, BIG_H } from '../ui/font';
import { layoutRich, drawLayout, richWidth } from '../ui/rich';
import { T, onPaper } from '../ui/theme';
import { bubbleRaw, outlinedText, ribbonRaw, tagRaw, paperRaw, ribbonFor, RIBBON, type RibbonColor } from '../ui/paper';
import { accentRole } from '../ui/theme';
import { sheet, itemIcon, hasArt, frameAt } from '../render/sprites';
import { layout, type Layout } from './layout';
import { button, uiIcon, slip, ribbon, chip, UICON, type UIconName } from './chrome';
import { drawScreen } from './screens';
import { auditBadge } from './fold';
import { purse, bell, counters, lift, notebook, bookmarks, sectionTabs, edgeArrows, cornerZones } from './topbar';
import { rail, diegetic, type Cameo } from './rail';
import { newspaper } from './gazette';
import { floorTags } from './floortags';
import { pinnedReport, hoverEnt, worldTip, zones, pinTop, bigSafe } from './tags';
import { isleTileKey, isleTileTip, isleFrame } from './islands';
import { drawWheel } from './wheel';
import { nextGoal } from './goals';
import { getHoverTags } from './settings';
import { calm } from './soundopts';
import { districtHud, districtHover, districtHoverKey, districtZones } from './district';
import { lessonFrame, lessonZones } from './lessons';
import { stuckButton } from './stuck';
import { keysFrame } from './keys';
import type { App } from './app';
import type { Rect } from '../ui/ui';

export interface HudState {
  /** the coin number shown, counting up toward the real value */
  coinShown: number;
  coinBump: number;
  hoverTile: { x: number; y: number } | null;
  /** the wheel's open category: one of the store's building tabs, or Upgrades */
  storeTab: 'build' | 'upgrades';
  /** build kinds the player has seen unlocked (for the NEW dot) */
  seen: Set<string>;
  /** the problem the trouble bell jumped to last */
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
  /** the wheel's open tab of buildings */
  buildTab: 'build' | 'power' | 'heavy';
  // ---- Act II presentation
  /** kinds whose tab has been opened since they unlocked (a tab shows a dot until then) */
  tabSeen: Set<string>;
  /** tabs whose "new" chime has played */
  tabRung: Set<string>;
  /** screens opened at least once (their section tab shows a dot until then) */
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
  /** pieces folded away ('goal': the speaker's bubble) */
  collapsed: Set<string>;
  /** the line shown (its live numbers taken out), when it arrived, and the HUD element it names */
  goalKey: string | null;
  goalAt: number;
  goalUi: string | null;
  /** kept for old callers (the crawl is gone) */
  crawlHot: boolean;
  // ---- the 180
  /** when the speaker's bubble was folded (a "!" when a line arrives after) */
  foldedAt: number;
  /** other speakers' lines queued for the corner, and what has been heard */
  cameos: Cameo[];
  offerSeen: string[] | null;
  codexHeard: number;
  ordersHeard: number;
  /** the trouble bell: the problems it has rung for, when it last swung */
  bellIds: Set<string>;
  bellAt: number;
  /** the lift's needle, degrees */
  liftAngle: number;
  /** the notebook's last page */
  lastPage: Parameters<App['togglePanel']>[0] | null;
  /** the Purse's foot and the speaker's corner, last frame (the floor's tags keep off them) */
  purseBottom: number;
  cornerRect: Rect | null;
  /** the notebook's bookmarks up the left edge, last frame (floor tags and a report docked on the
   * left keep off them) */
  marksRect: Rect | null;
  /** the audit clipboards on the floor this frame (the Gazette's slip yields to them) */
  clipRects: Rect[];
  // ---- the hover delay (the owner, 2026-10-21: hover tags everywhere were overstimulating)
  /** what the mouse is over on the floor, since when, and when a floor tag was last up */
  hoverKey: string | null;
  hoverSince: number;
  hoverShown: number;
}

export function newHudState(): HudState {
  return {
    coinShown: 0, coinBump: 0, hoverTile: null, storeTab: 'build', seen: new Set(), problemIdx: 0, ship: [], focus: null, draft: '', fieldSeen: false, stamped: false, confetti: 0, flakes: [], treePage: 2, buildTab: 'build',
    tabSeen: new Set(), tabRung: new Set(), opened: new Set(), codexSeen: 0, celebs: [], rain: [], coinLast: -1, glints: [], firstMiner: false,
    collapsed: new Set(), goalKey: null, goalAt: -10, goalUi: null, crawlHot: false,
    foldedAt: -10, cameos: [], offerSeen: null, codexHeard: -1, ordersHeard: -1, bellIds: new Set(), bellAt: -10, liftAngle: 180, lastPage: null, purseBottom: 70, cornerRect: null,
    marksRect: null, clipRects: [], hoverKey: null, hoverSince: 0, hoverShown: -10,
  };
}

/** The pages the notebook reopens at (not the grade cards, the offline letter, the slice's end). */
const NOT_PAGES = new Set(['grade', 'fgrade', 'offline', 'sliceEnd']);

export function drawHud(app: App, dt: number) {
  const ui = app.ui;
  const L = layout(ui.w, ui.h);
  app.layout = L;
  app.hud.fieldSeen = false;
  presentation(app);
  // the floor's tags and the reports keep off the corners
  zones.length = 0;
  zones.push(...cornerZones(app, L, app.hud.purseBottom));
  if (app.hud.cornerRect) zones.push(app.hud.cornerRect);
  zones.push(...districtZones(app, L), ...lessonZones());
  if (!app.panel) {
    // the floor's own markers first (under every piece of the HUD)
    floorTags(app, L);
    diegetic(app, L);
    panArrows(app, L);
    // the District's audit hangs its own clipboard (src/app/district.ts)
    app.hud.clipRects = [];
    if (app.floor !== 'district') auditBadge(app, L);
    corners(app, L, dt);
    edgeArrows(app);
    pinnedReport(app, L);
    districtHud(app, L);
  } else {
    // a page lies open on the desk: the floor goes behind dark wood
    if (!NOT_PAGES.has(app.panel)) desk(app);
    drawScreen(app, L);
    sectionTabs(app, L);
  }
  // a text field that is no longer drawn lets go of the keyboard
  if (!app.hud.fieldSeen && app.hud.focus) {
    app.hud.focus = null;
    app.input.typing = null;
  }
  slips(app, L, dt);
  if (!app.panel) hoverReport(app);
  if (app.screen === 'play') isleFrame(app); // Act IV: the Old Works' lines running again (src/app/islands.ts)
  lessonFrame(app, L); // Milestone 13: lesson cards on firsts (src/app/lessons.ts)
  keysFrame(app);
  refusal(app, dt);
  celebrations(app, L, dt);
  drawWheel(app, L);
}

/** The desk under the open book: dark planks, edge to edge. */
function desk(app: App) {
  const ui = app.ui;
  const ctx = ui.ctx;
  ctx.fillStyle = C.wood0;
  ctx.fillRect(0, 0, ui.w, ui.h);
  ctx.fillStyle = rgba(C.wood1, 0.55);
  for (let y = 7; y < ui.h; y += 12) ctx.fillRect(0, y, ui.w, 1);
  ctx.fillStyle = rgba(C.ink, 0.35);
  for (let y = 8; y < ui.h; y += 12) ctx.fillRect(0, y, ui.w, 1);
}

/** The pieces on the corners: the speaker's corner, the Purse and what hangs under it, the lift,
 * the notebook and the Gazette. */
function corners(app: App, L: Layout, dt: number) {
  const ui = app.ui;
  rail(app, L);
  const pb = purse(app, L, dt);
  const bb = stuckButton(app, L, pb, bell(app, L, pb)); // Milestone 13: "Stuck?" beside the bell
  app.hud.purseBottom = counters(app, L, bb);
  lift(app, L, dt);
  notebook(app, L);
  bookmarks(app, L);
  // the Gazette's slip reaches left as far as the speaker's bubble allows
  const b = ui.ids.get('goalBubble');
  const left = b && b.y + b.h > L.newspaper.y ? b.x + b.w + 8 : L.portrait.x + 60;
  newspaper(app, L, left);
  const gb = ui.ids.get('goalBubble');
  app.hud.cornerRect = { x: 0, y: Math.min(L.build.y - 4, gb ? gb.y : ui.h), w: gb ? gb.x + gb.w + 4 : L.portrait.x + 64, h: ui.h };
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
  // a fold flies to the lift's Factory button (or the Modules page's tab)
  const tab = app.ui.ids.get('floorFactory') ?? app.ui.ids.get('page:modules');
  r.factoryTarget = tab ? { x: (tab.x + tab.w / 2) * app.ui.scale, y: (tab.y + tab.h / 2) * app.ui.scale } : null;
  if (app.panel) app.hud.opened.add(app.panel);
  if (app.panel && !NOT_PAGES.has(app.panel)) app.hud.lastPage = app.panel;
  if (app.panel === 'codex') app.hud.codexSeen = app.game.s.codex.length;
}

// ------------------------------------------------------------------ over the floor

/** More floor (or town) past an edge of the view: a soft arrow there, pulsing (drag with the right
 * button, WASD, or rest the mouse at that edge to pan). */
function panArrows(app: App, L: Layout) {
  const ui = app.ui;
  const c = L.center;
  const ph = app.panHints();
  ui.ctx.globalAlpha = 0.45 + 0.25 * Math.sin(ui.time * 3);
  const mx = c.x + Math.floor(c.w / 2), my = c.y + Math.floor(c.h / 2);
  if (ph.l) outlinedText(ui.ctx, ICON.left, c.x + 3, my - 4, T.floorText);
  if (ph.r) outlinedText(ui.ctx, ICON.right, c.x + c.w - 9, my - 4, T.floorText);
  if (ph.u) outlinedText(ui.ctx, ICON.up, mx - 3, c.y + 3, T.floorText);
  if (ph.d) outlinedText(ui.ctx, ICON.down, mx - 3, c.y + c.h - 10, T.floorText);
  ui.ctx.globalAlpha = 1;
}

// ------------------------------------------------------------------ slips, trophies, refusals

const TOAST_ICON: Record<string, UIconName> = { flask: 'research', crate: 'orders', module: 'fold' };

/** The slips under the lift: toasts as paper slips that slide in from the right, rest, and slide
 * out (newest on top). Every line is wrapped to the slip; a slip with no room in full shows its
 * title alone, and one with no room for that waits. Trophies drop as a gold ribbon from the top
 * centre. A slip that has landed is on the audit's 'float' layer. */
function slips(app: App, L: Layout, dt: number) {
  const ui = app.ui;
  // a page open: the slips wait (the book is the whole screen and they covered what you read);
  // the newest four land when it closes
  if (app.panel) {
    if (app.toasts.length > 4) app.toasts = app.toasts.slice(-4);
    if (app.trophyPops.length > 2) app.trophyPops = app.trophyPops.slice(-2);
    return;
  }
  for (const t of app.toasts) t.t += dt;
  app.toasts = app.toasts.filter((t) => t.t < t.life);
  for (const p of app.trophyPops) p.t += dt;
  app.trophyPops = app.trophyPops.filter((p) => p.t < 4);
  const S = L.slips;
  const w = S.w;
  let y = S.y;
  const x0 = S.x;
  const bottom = Math.min(S.y + S.h, pinTop - 4);
  for (const t of app.toasts.slice().reverse()) {
    const icon = t.icon ? (TOAST_ICON[t.icon] ?? (t.icon in UICON ? (t.icon as UIconName) : null)) : null;
    const tx = icon ? 12 : 0;
    const cw = w - 12 - tx;
    const title = layoutRich(`{big:${bigSafe(t.title.replace(/[{}]/g, ''))}}`, cw);
    let body = t.text ? layoutRich(t.text, cw) : null;
    let h = 10 + title.h + (body ? body.h : 0);
    if (y + h > bottom) {
      body = null;
      h = 10 + title.h;
      if (y + h > bottom) break;
    }
    const k = Math.min(1, t.t * 5);
    const out = Math.max(0, Math.min(1, (t.t - (t.life - 0.35)) / 0.35));
    const x = x0 + Math.round((1 - k * k * (3 - 2 * k)) * (w + 10)) + Math.round(out * out * (w + 10));
    ui.floating(() => {
      const r = slip(ui, x, y, w, h);
      const ink = onPaper(t.color, T.ink);
      if (icon) uiIcon(ui, icon, r.x, r.y + 1, 1);
      drawLayout(ui, title, r.x + tx, r.y, ink);
      if (body) drawLayout(ui, body, r.x + tx, r.y + title.h, T.ink);
    }, k < 1 || out > 0 ? 'tip' : 'float');
    y += h + 3;
  }
  // trophies: a gold ribbon drops from the top centre, holds, and lifts away
  app.trophyPops.slice(-2).forEach((p, i) => {
    const t = TROPHIES.find((q) => q.id === p.id)!;
    const s = bigSafe(`Trophy! ${t.name}`);
    const rw = Math.min(ui.w - 40, bigWidth(s) + 40);
    const drop = p.t < 0.25 ? (1 - p.t / 0.25) * -30 : p.t > 3.6 ? (p.t - 3.6) * -90 : Math.round(Math.sin(Math.min(1, (p.t - 0.25) * 4) * Math.PI) * 2);
    const ry = Math.round(6 + i * 20 + drop);
    ui.floating(() => {
      ribbon(ui, Math.floor(ui.w / 2 - rw / 2), ry, rw, '', { color: 'gold' });
      uiIcon(ui, 'trophies', Math.floor(ui.w / 2 - rw / 2) + 5, ry + 1, 1);
      ui.big(s, Math.floor(ui.w / 2) + 5, ry + 3, RIBBON.gold.text, { align: 'center' });
    }, 'tip');
  });
}

/** The refusal at the cursor: a small speech puff in ink, its tail at the cursor. */
function refusal(app: App, dt: number) {
  const r = app.refusal;
  if (!r) return;
  r.t -= dt;
  if (r.t <= 0) { app.refusal = null; return; }
  const ui = app.ui;
  const L = layoutRich(`{bad:${r.text.replace(/[{}]/g, '')}}`, 200);
  const w = L.w + 12, h = L.h + 7;
  const x = Math.max(2, Math.min(ui.w - w - 2, ui.mx - Math.floor(w / 2))), y = Math.max(2, ui.my - h - 10);
  ui.floating(() => {
    ui.ctx.globalAlpha = Math.min(1, r.t * 3);
    bubbleRaw(ui.ctx, x, y, w, h, 'bottom', Math.max(6, Math.min(w - 12, ui.mx - x - 3)));
    drawLayout(ui, L, x + 6, y + 4, T.bad);
    ui.ctx.globalAlpha = 1;
  });
}

/** seconds a first's banner stays up */
const BANNER_S = 2.8;

/** Put up a banner for a first (a Codex entry, the first Mk2, a reputation level): a ribbon that
 * drops from the top centre. */
export function banner(app: App, title: string, sub: string, color: string = C.gold) {
  app.hud.celebs.push({ kind: 'banner', t: 0, x: 0, y: 0, title, sub, color });
}

/** A ribbon with a title in the display face (scale 1-3) and a sub line on a tag under it, centred
 * at cx: the celebrations' banner. Raw drawing: they pass, they are not layout. */
function bannerRibbon(app: App, cx: number, y: number, title: string, sub: string, color: RibbonColor, sc: number) {
  const ui = app.ui;
  const ctx = ui.ctx;
  title = bigSafe(title);
  const tw = bigWidth(title) * sc;
  const rh = BIG_H * sc + 8;
  const rw = Math.min(ui.w - 24, tw + 36);
  const rx = Math.floor(cx - rw / 2);
  ribbonRaw(ctx, rx, y, rw, rh, color, 'out');
  const P = RIBBON[color];
  outlinedText(ctx, title, Math.floor(cx - tw / 2), y + 3, Math.floor(ui.time * 6) % 2 ? P.text : C.lamp3, P.line, sc, true);
  let bottom = y + rh;
  if (sub) {
    const sl = layoutRich(sub, Math.min(ui.w - 40, 300));
    const sw = sl.w + 14, sh = sl.h + 8;
    const sx = Math.floor(cx - sw / 2), sy = y + rh + 2;
    tagRaw(ctx, sx, sy, sw, sh, { hole: 'none', anchor: null });
    const prev = ui.audit;
    ui.audit = false;
    drawLayout(ui, sl, sx + 7, sy + 4, T.ink);
    ui.audit = prev;
    bottom = sy + sh;
  }
  return { x: rx, y, w: rw, h: bottom - y };
}

/** Screen-wide moments over everything (screens included): the Megaproject's stage (a flash,
 *  confetti raining over the whole screen, a ribbon), S+ (gold leaf and a ribbon), the firsts'
 *  ribbons, and claims staked (a flag popping up where the click was). Drawn straight to the
 *  canvas: they pass, they are not layout. */
function celebrations(app: App, L: Layout, dt: number) {
  const ui = app.ui;
  const h = app.hud;
  const ctx = ui.ctx;
  for (const c of h.celebs) c.t += dt;
  h.celebs = h.celebs.filter((c) => c.t < (c.kind === 'megaDone' ? 4.5 : c.kind === 'splus' ? 3.2 : c.kind === 'banner' ? BANNER_S : 1.6));
  let bannerN = 0;
  let bannerY = 0;
  // reduced motion (Milestone 12): a few flakes, no flashes, ribbons that fade in place
  const still = calm(app);
  if (still) { if (h.rain.length > 24) h.rain.length = 24; h.confetti = Math.min(h.confetti, 3); if (h.flakes.length > 12) h.flakes.length = 12; }
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
      if (c.t < 0.35 && !still) { ctx.fillStyle = rgba(C.hot, (0.35 - c.t) * 1.6); ctx.fillRect(0, 0, ui.w, ui.h); }
      // the ribbon drops in, bounces, holds, then lifts away
      const k = Math.min(1, c.t * 3);
      const drop = still ? 0 : c.t < 0.33 ? (1 - k) * -60 : c.t > 3.8 ? (c.t - 3.8) * -120 : Math.round(Math.sin(Math.min(1, (c.t - 0.33) * 4) * Math.PI) * 4);
      // a District project (the Floating City, the Scrap Transmuter) or the Great Drill
      const proj = c.id && c.id in MEGAS ? MEGAS[c.id as MegaId] : null;
      const st = proj ? proj.stages.find((m) => m.stage === c.value) : MEGA.find((m) => m.stage === c.value);
      const title = `${(st?.name ?? proj?.name ?? 'The Great Drill').split(/[:,]/)[0]}!`;
      const sub = `stage ${c.value ?? 1} built · ${st?.reward ?? ''}`;
      const sc = bigWidth(title) * 3 + 60 <= ui.w ? 3 : 2;
      bannerRibbon(app, Math.floor(ui.w / 2), Math.round(30 + drop), title, sub, 'gold', sc);
    } else if (c.kind === 'splus') {
      // S+: a gold flash, then the ribbon drops in over the floor, bounces, and lifts away
      if (c.t < 0.25 && !still) { ctx.fillStyle = rgba(C.gold, (0.25 - c.t) * 1.4); ctx.fillRect(0, 0, ui.w, ui.h); }
      const k = Math.min(1, c.t * 4);
      const drop = still ? 0 : c.t < 0.25 ? (1 - k) * -50 : c.t > 2.7 ? (c.t - 2.7) * -140 : Math.round(Math.sin(Math.min(1, (c.t - 0.25) * 4) * Math.PI) * 3);
      const title = c.id === 'fold' ? 'S+ Module!' : 'S+ Flawless!';
      const sub = c.id === 'fold' ? 'the best fold there is · ×1.35 in one tile' : 'the top grade · every part at full marks';
      const onCard = app.panel === 'grade' || app.panel === 'fgrade';
      ctx.globalAlpha = c.t > 2.7 ? Math.max(0, 1 - (c.t - 2.7) * 2) : 1;
      // on the grade card it is a ribbon alone at the very top, clear of the card's parts
      const r = bannerRibbon(app, Math.floor(ui.w / 2), onCard ? Math.round(L.overlay.y + 1 + Math.min(0, drop)) : Math.round(36 + drop), title, onCard ? '' : sub, 'gold', onCard ? 2 : 3);
      const mid = r.x + r.w / 2;
      for (let i = 0; i < (still ? 0 : 10); i++) {
        const a = c.t * 3 + (i * Math.PI) / 5;
        ctx.fillStyle = i % 2 ? C.gold : C.bone;
        ctx.fillRect(Math.round(mid + Math.cos(a) * (r.w / 2 + 8)), Math.round(r.y + r.h / 2 + Math.sin(a) * (r.h / 2 + 6)), 2, 2);
      }
      ctx.globalAlpha = 1;
    } else if (c.kind === 'banner') {
      // a first: a ribbon drops in at the top centre, holds, and lifts away; several stack
      const i = bannerN++;
      if (i > 2) continue;
      const col: RibbonColor = c.color ? ribbonFor(accentRole(c.color)) : 'gold';
      const k = Math.min(1, c.t * 5);
      const lift = still ? 0 : c.t < 0.2 ? Math.round((1 - k) * -20) : c.t > BANNER_S - 0.4 ? Math.round((c.t - (BANNER_S - 0.4)) * -60) : 0;
      ctx.globalAlpha = c.t > BANNER_S - 0.4 ? Math.max(0, (BANNER_S - c.t) / 0.4) : 1;
      const title = (c.title ?? '').replace(/[\u0001-\u0016]/g, '').trim();
      if (i === 0) bannerY = app.panel ? L.overlay.y + 2 : 44;
      const r = bannerRibbon(app, Math.floor(ui.w / 2), bannerY + lift, title, c.sub ?? '', col, bigWidth(title) * 2 + 60 <= ui.w ? 2 : 1);
      bannerY += r.h + 4;
      if (c.t < 0.6 && !still) for (let j = 0; j < 8; j++) {
        const a = (j / 8) * Math.PI * 2, rr = 8 + c.t * 70;
        ctx.fillStyle = j % 2 ? C.gold : C.bone;
        ctx.fillRect(Math.round(ui.w / 2 + Math.cos(a) * rr * 1.6), Math.round(r.y + 10 + Math.sin(a) * rr * 0.5), 2, 2);
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
      outlinedText(ctx, txt, x - Math.floor(textWidth(txt) / 2), y + 2, T.floorGood);
      if (c.t < 0.5) for (let i = 0; i < 6; i++) {
        const a = i / 6 * Math.PI * 2 + c.t * 4, rr = 6 + c.t * 40;
        ctx.fillStyle = i % 2 ? C.gold : C.leaf;
        ctx.fillRect(Math.round(x + Math.cos(a) * rr), Math.round(y - 8 + Math.sin(a) * rr), 2, 2);
      }
      ctx.globalAlpha = 1;
    }
  }
}

// ------------------------------------------------------------------ the hover report

/** Seconds the mouse rests on a thing before its tag comes; once one has been up, the next comes
 * quicker for a moment (moving along a line reads it), and a sweep across the floor shows none. */
const HOVER_DELAY = 0.45;
const HOVER_WARM = 0.12;
const HOVER_FADE = 0.1;

/** What the mouse is over on the floor or the town, as a key (a tag waits on it not changing). */
function hoverKeyOf(app: App): string | null {
  const g = app.game;
  const h = app.hud.hoverTile;
  if (app.floor === 'district') return districtHoverKey(app);
  if (!h) return app.townTip ? 'town:' + app.townTip : null;
  // the pinned thing has its whole report up already: no hover tag for it
  if (app.floor === 'factory') { const fe = g.fentAt(h.x, h.y); return fe && fe.id !== app.fselected ? 'f' + fe.id : null; }
  if (g.s.sparks.some((p) => p.x === h.x && p.y === h.y)) return `s${h.x},${h.y}`;
  const e = g.entAt(h.x, h.y);
  if (e) return e.id === app.selected ? null : 'e' + e.id;
  // the island's ground (Act IV): rubble, a vent, the sky
  const isle = isleTileKey(g, h.x, h.y);
  if (isle) return isle;
  if (!g.owned(h.x, h.y)) return 'c' + (g.chunkAt(h.x, h.y)?.id ?? '');
  return g.oreAt(h.x, h.y) ? `o${h.x},${h.y}` : null;
}

/** The hover report: machines, power buildings and Factory modules get their tag on a string
 * (tags.ts); the Dock, the Hopper, belts, heaps, crates, ore, land and Sparks a short tag. Each
 * waits HOVER_DELAY on its thing and fades in; the Options page's Hover tags picks brief (the
 * status line), full (every hover row) or off (a click pins the whole report either way). */
function hoverReport(app: App) {
  const ui = app.ui;
  const hs = app.hud;
  const mode = getHoverTags();
  const key = app.mode.k === 'idle' && !ui.tooltip && mode !== 'off' ? hoverKeyOf(app) : null;
  if (key !== hs.hoverKey) { hs.hoverKey = key; hs.hoverSince = ui.time; }
  if (!key) return;
  const age = ui.time - hs.hoverSince - (ui.time - hs.hoverShown < 0.35 ? HOVER_WARM : HOVER_DELAY);
  if (age < 0) return;
  hs.hoverShown = ui.time;
  const alpha = Math.min(1, age / HOVER_FADE);
  ui.tipAlpha = alpha;
  const brief = mode === 'brief';
  if (app.floor === 'district') { districtHover(app, { brief, alpha }); return; }
  const h = app.hud.hoverTile;
  if (!h && app.townTip) { ui.tip([{ text: app.townTip }], 240); return; }
  if (!h) return;
  const g = app.game;
  if (app.floor === 'factory') {
    const fe = g.fentAt(h.x, h.y);
    if (fe && fe.id !== app.fselected) hoverEnt(app, null, fe, { brief, alpha });
    return;
  }
  const goal = nextGoal(g);
  const at = worldTip(app, h.x, h.y, 1, 1, goal?.tile);
  const e = g.entAt(h.x, h.y);
  const spark = g.s.sparks.find((p) => p.x === h.x && p.y === h.y);
  if (spark) {
    ui.tip(spark.kind === 'vein'
      ? [{ text: '{big:Lucky Vein}' }, { text: "{k:LMB} this patch's Miners ×3 for 60 s" }]
      : [{ text: '{big:Inspector}' }, { text: '{k:LMB} grades this line' }, { text: '{u:research} a minute of its output × the grade' }], 190, at);
    return;
  }
  if (!e) {
    if (isleTileTip(app, h.x, h.y, at)) return;
    if (!g.owned(h.x, h.y)) {
      const ch = g.chunkAt(h.x, h.y)!;
      const ready = !ch.requires || g.done(ch.requires);
      ui.tip([{ text: `{big:${bigSafe(ch.name)}}` }, { text: ready ? `{k:LMB} buy {coin:${ch.cost.toLocaleString('en-US')}}` : `{u:lock} research ${RESEARCH[ch.requires!].name} first` }], 180, at);
    } else if (g.oreAt(h.x, h.y)) {
      const ore = g.oreAt(h.x, h.y)!;
      ui.tip([{ text: `{big:${bigSafe(itemName(ore))}} {i:${ore}}` }, { text: '{k:LMB} 1 into a machine beside it' }, { text: '{soft:a Miner goes on it}' }], 180, at);
    }
    return;
  }
  if (app.selected === e.id) return;
  if (hoverEnt(app, e, null, { brief, alpha })) return;
  const on = worldTip(app, e.x, e.y, e.w, e.h, goal?.tile);
  // brief: no R and X keycap row (the same on every building; the Keys page has them)
  const rx = brief ? [] : [{ text: '{k:R} turn  {k:X} remove' }];
  if (e.kind === 'dock') { ui.tip([{ text: '{big:The Dock}' }, { text: BUILD.dock.blurb }, { text: '{k:LMB} orders' }], 180, on); return; }
  if (e.kind === 'hopper') { ui.tip([{ text: '{big:The Hopper}' }, { text: BUILD.hopper.blurb }, { text: '{k:LMB} research' }], 180, on); return; }
  if (e.kind === 'belt') {
    ui.tip([{ text: '{big:Belt}' }, { text: e.item ? `{i:${e.item}} ${itemName(e.item).toLowerCase()}${e.mv ? '' : ' · {bad:stuck}'}` : '{soft:empty}' }, ...rx], 170, on);
    return;
  }
  if (e.kind === 'heap') { ui.tip([{ text: '{big:Slag Heap}' }, { text: `{i:slag} ${e.count} / ${BUILD.heap.capacity}` }, { text: '{soft:empties out its front}' }], 170, on); return; }
  if (e.kind === 'crate') { ui.tip([{ text: '{big:Buffer Crate}' }, { text: `${e.store.length} / ${BUILD.crate.capacity}${e.store.length ? ` {i:${e.store[0]}}` : ''}` }], 150, on); return; }
  ui.tip([{ text: `{big:${bigSafe(BUILD[e.kind].name)}}` }, { text: BUILD[e.kind].blurb }, ...rx], 180, on);
}

// ------------------------------------------------------------------ title

const TAGLINE = 'Build a line. Fold it into a tile. Build with what you folded.';
const FOOTLINE = 'A frog mayor wants Gizmos. Nobody knows what they do.';

/** The title's buttons, the tagline on a ribbon, the last line on a slip. */
function titleKit(app: App, tagY: number, btnY: number) {
  const ui = app.ui;
  const tw = Math.min(ui.w - 24, textWidth(TAGLINE) + 30);
  const tx = Math.floor(ui.w / 2 - tw / 2);
  ribbonRaw(ui.ctx, tx, tagY, tw, 15, 'moss', 'out');
  ui.text(TAGLINE, Math.floor(ui.w / 2), tagY + 3, RIBBON.moss.text, { align: 'center', shadow: RIBBON.moss.line });
  const bw = 140, bx = Math.floor(ui.w / 2 - bw / 2);
  let y = btnY;
  if (app.titleInfo.hasSave) {
    if (button(ui, 'continue', bx, y, bw, 22, 'Continue', { gold: true, big: true })) { app.audio.unlock(); app.continueGame(); }
    chip(ui, bx + bw + 6, y + 5, `{coin:${app.titleInfo.coin}}`, { role: 'coin' });
    y += 26;
  }
  if (button(ui, 'new', bx, y, bw, 22, app.titleInfo.hasSave ? 'New game' : 'Start', { gold: !app.titleInfo.hasSave, big: true })) { app.audio.unlock(); app.newGame(); }
  const fw = textWidth(FOOTLINE) + 16;
  const fx = Math.floor(ui.w / 2 - fw / 2), fy = ui.h - 22;
  const r = slip(ui, fx, fy, fw, 17);
  ui.text(FOOTLINE, r.x + 2, r.y, T.ink);
}

export function drawTitle(app: App) {
  if (hasArt('title_scene') && hasArt('logo')) return drawTitleScene(app);
  const ui = app.ui;
  const t = ui.time;
  // a slow belt of items crossing the screen under the title
  const by = Math.floor(ui.h / 2) + 10;
  const belt = sheet('belt');
  for (let x = -16; x < ui.w + 16; x += 16) ui.ctx.drawImage(belt.frames[Math.floor(t * 8) % belt.frames.length], x, by);
  const items = ['ironOre', 'ironIngot', 'ironPlate', 'gear', 'copperWire', 'gizmo'];
  for (let i = 0; i < 14; i++) {
    const x = ((t * 32 + i * 44) % (ui.w + 64)) - 32;
    ui.ctx.drawImage(itemIcon(items[i % items.length]), Math.round(x), by + 4);
  }
  let tagY: number;
  if (hasArt('logo')) {
    const s = sheet('logo');
    const k = Math.max(1, Math.min(3, Math.floor(ui.w / (s.w + 40))));
    const lx = Math.floor(ui.w / 2 - (s.w * k) / 2), ly = Math.floor(by - 34 - s.h * k);
    ui.ctx.drawImage(s.frames[0], lx, ly, s.w * k, s.h * k);
    tagY = by - 26;
  } else {
    const sc = Math.max(3, Math.min(6, Math.floor(ui.w / 90)));
    const ty = Math.floor(ui.h / 2) - 26 - sc * 9;
    ui.big(TITLE, Math.floor(ui.w / 2), ty, T.floorCoin, { scale: sc, align: 'center', outline: T.ink });
    tagY = ty + sc * 11 + 6;
  }
  titleKit(app, tagY, by + 30);
}

/** The title over the art director's key art ('title_scene', 320x180, STYLE.md): the scene at
 *  the smallest whole-number scale that covers the screen, centred and cropped, never smoothed.
 *  Everything is placed in scene coordinates so it lands on the scene's calm areas: the logo and
 *  the tagline's ribbon on the sky band (scene y 14-66), the buttons on the open sky between the
 *  two islands (x 125-195 from y 104; the coin chip lands on the town island's empty west end),
 *  the last line on a slip on the cloud sea along the bottom (pixel-art/title/build.py). */
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
  titleKit(app, ly + s.h * lk + 4, Math.min(ui.h - 76, at(104)));
}

void ITEMS; void richWidth; void drawText; void LINE_H; void paperRaw;
