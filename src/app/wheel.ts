// The Workbench Wheel (docs/hud-180.md "The Workbench Wheel"): the build menu, opened at the
// cursor (a right tap on the floor, a click on empty paving, Q or Space) or at the screen's centre
// (the Build button on the speaker's head). A wooden hub holds the last building picked; brass petals on an inner ring
// are the categories that exist (Tools, Build, Power, Heavy, Upgrades; on the Factory floor Tools,
// Trunk, Modules); hovering or clicking one fans its items on an outer arc as paper discs, each
// with its sprite at 1x and a Pip price tag on a string. The hovered item's tag hangs beside the
// wheel. It replaces the numbered build bar (buildbar.ts), whose bookkeeping it keeps: the "new"
// dots (hud.seen, tabSeen), the chime when a petal gets something new (tabRung), the store's open
// tab (storeTab, buildTab), the goal's pulse. A radial build menu is a genre convention (pie
// menus); nothing here copies a specific game's layout, art or words (DECISIONS.md "The 180").
import { C, rgba } from '../data/palette';
import { BUILD, UPGRADES, STORE_TABS, type BuildKind } from '../data/machines';
import { RESEARCH } from '../data/research';
import { ANNEX, CHUNKS, PATCHES, FACTORY, type ChunkDef } from '../data/land';
import { isSky } from '../sim/systems/islands';
import { type ItemId } from '../data/items';
import { annexPrice } from '../sim/systems/annex';
import { prules } from '../sim/patents';
import { poleReach } from '../sim/systems/power';
import { stampCost, stampRefusal, kitsFor } from '../sim/systems/modules';
import { claimLoad, claimsHeld, claimsUsed } from '../sim/systems/claims';
import { Num } from '../engine/num';
import { perMin, plain } from '../engine/fmt';
import { kindRate } from './rates'; // Milestone 13: rates on the wheel's item cards
import { bigWidth, smallWidth, drawSmall, SMALL_H } from '../ui/font';
import { richWidth, layoutRich, drawLayout } from '../ui/rich';
import { art, buttonRaw } from '../ui/paper';
import { T, onPaper } from '../ui/theme';
import { sheet, itemIcon, spriteName, type SpriteSheet } from '../render/sprites';
import { mainOutput } from '../render/factory';
import { tag, tagSize, chip, chipWidth, dot, keycapK, uiIcon, CHIP_H, type ChipOpts, type UIconName } from './chrome';
import { GRADE_COL } from './fold';
import type { Layout } from './layout';
import type { App } from './app';
import type { Dir } from '../sim/world';
// Act III (DESIGN.md §21): the Chute Mouths' look, the Factory Chute in hand, the watchers
import { act3Frame, holdChute, holdingChute } from './act3';
import { chuteCap } from '../sim/systems/modules';

// ---------------------------------------------------------------- geometry

/** the petals' ring and the items' arc, from the hub's centre (UI px) */
const R_PETAL = 30;
const R_ITEM = 62;
/** a petal or an item disc (round a 16 px sprite at 1x) */
const DISC = 24;
const HIT = 12;
/** the hub (28x28, the well for the last building at [6, 6, 16, 16]) */
const HUB = 28;
/** px along the arc between item centres */
const ITEM_STEP = 27;
/** how far out the wheel reaches with its price tags (clamping it on screen) */
const REACH = 100;
/** the info tag's content width */
const INFO_W = 136;
/** how long the mouse rests on a petal before it fans (moving across one on the way to an item
 * does not switch) */
const DWELL = 0.09;
/** at most this many module designs on the Modules petal; the rest open the Modules page */
const MAX_DESIGNS = 11;

type PetalId = 'tools' | 'build' | 'power' | 'heavy' | 'upgrades' | 'trunk' | 'modules';

/** One thing on the outer arc. */
interface Item {
  id: string;
  /** the Bullfrog title of its tag (a locked building: ???) */
  name: string;
  /** a 16x16 drawing at (x, y); `big` 2 for the tag's preview */
  draw: (x: number, y: number, k: 1 | 2, hov: boolean) => void;
  /** the Pip text on its price tag (null: no tag) */
  price: string | null;
  priceRole: 'coin' | 'soft' | 'bad' | 'research' | 'good';
  afford: boolean;
  locked: boolean;
  active: boolean;
  fresh: boolean;
  goal: boolean;
  /** its hotkey, drawn as a keycap on its tag */
  key?: string;
  /** the info tag: a chip row and rows of rich text */
  chips: { text: string; o: ChipOpts }[];
  rows: string[];
  /** keycap verbs at the tag's foot */
  verbs: string;
  /** do it; true when the wheel should close */
  pick: (shift: boolean) => boolean;
}

interface Petal {
  id: PetalId;
  name: string;
  icon: (x: number, y: number) => void;
  items: Item[];
  fresh: boolean;
  goal: boolean;
}

// ---------------------------------------------------------------- state

const W = {
  open: false,
  /** the hub's centre, UI px */
  x: 0,
  y: 0,
  /** when it opened, and when the open petal fanned (UI time) */
  t: 0,
  tp: 0,
  petal: 'build' as PetalId,
  /** the petal under the mouse and since when (the dwell) */
  hov: null as PetalId | null,
  hovAt: 0,
  /** the last petal open on each floor (it fans first next time) */
  lastW: 'build' as PetalId,
  lastF: 'modules' as PetalId,
  /** the last building picked on each floor (the hub) */
  hubW: null as BuildKind | null,
  hubF: null as { k: 'trunk' } | { k: 'module'; id: number } | null,
  /** the real mouse while open (the HUD under the wheel sees it off screen) and this frame's
   * clicks, taken before the HUD can */
  mx: 0,
  my: 0,
  click: null as { shift: boolean } | null,
  rclick: false,
  /** the mouse was moved off screen for the HUD this frame */
  hidden: false,
  /** a fresh thing waits in some petal (the toolbox's dot) */
  fresh: false,
  goal: false,
};

export function wheelOpen(_app: App): boolean {
  return W.open;
}

/** Open the wheel centred at a UI-pixel point (clamped on screen). */
export function openWheel(app: App, x: number, y: number): void {
  if (app.screen !== 'play' || app.panel || app.offlineJob) return;
  const ui = app.ui;
  W.open = true;
  W.x = Math.round(Math.max(REACH, Math.min(ui.w - REACH, x)));
  W.y = Math.round(Math.max(Math.min(REACH, ui.h / 2), Math.min(ui.h - Math.min(REACH, ui.h / 2), y)));
  W.t = ui.time;
  W.tp = ui.time;
  W.hov = null;
  W.click = null;
  W.rclick = false;
  W.mx = ui.mx;
  W.my = ui.my;
  // the goal's petal fans first, else the last one open on this floor
  const ps = petals(app);
  const goalPetal = ps.find((p) => p.goal);
  const last = app.floor === 'factory' ? W.lastF : W.lastW;
  const want = goalPetal?.id ?? (ps.some((p) => p.id === last) ? last : ps[app.floor === 'factory' && !app.game.s.designs.length ? 0 : Math.min(1, ps.length - 1)].id);
  setPetal(app, want, false);
  app.audio.sfx('open');
}

export function closeWheel(app: App): void {
  if (!W.open) return;
  W.open = false;
  W.click = null;
  if (W.hidden) restoreMouse(app);
  app.audio.sfx('close');
}

/** Open the petal `id` (its items fan out). */
function setPetal(app: App, id: PetalId, sound = true) {
  if (W.petal === id && W.open && W.tp !== W.t) return;
  W.petal = id;
  W.tp = app.ui.time;
  if (app.floor === 'factory') W.lastF = id;
  else W.lastW = id;
  const hs = app.hud;
  if (id === 'build' || id === 'power' || id === 'heavy') { hs.storeTab = 'build'; hs.buildTab = id; }
  else if (id === 'upgrades') hs.storeTab = 'upgrades';
  if (sound) app.audio.sfx('click');
}

// ---------------------------------------------------------------- the frame's hooks (app.ts)

/** Before the HUD draws: the wheel's bookkeeping, and while it is open, its clicks taken and the
 * mouse hidden from what lies under it. */
export function wheelFrameStart(app: App): void {
  const ui = app.ui;
  const m = app.mode;
  // the hub remembers the last building held
  if (m.k === 'build') W.hubW = m.kind;
  else if (m.k === 'ftrunk') W.hubF = { k: 'trunk' };
  else if (m.k === 'fmodule') W.hubF = { k: 'module', id: m.design };
  bookkeeping(app);
  act3Frame(app);
  if (!W.open) return;
  if (app.panel || app.screen !== 'play' || app.offlineJob) { closeWheel(app); return; }
  W.mx = ui.mx;
  W.my = ui.my;
  W.click = ui.clicked ? { shift: app.input.shift } : null;
  W.rclick = app.input.mouse.pressed[2] || app.input.mouse.pressed[1];
  if (ui.clicked) ui.eat();
  if (W.rclick) { app.input.consumeMouse(2); app.input.consumeMouse(1); }
  ui.rclicked = false;
  ui.mx = -10000;
  ui.my = -10000;
  W.hidden = true;
}

/** After the HUD: the mouse back where it is (if drawWheel did not run this frame). */
export function wheelFrameEnd(app: App): void {
  if (W.hidden) restoreMouse(app);
  if (W.open && W.click) { W.click = null; }
}

function restoreMouse(app: App) {
  app.ui.mx = W.mx;
  app.ui.my = W.my;
  W.hidden = false;
}

/** The "new" dots and the chime, every frame (the wheel is shut most of the time). */
function bookkeeping(app: App) {
  const g = app.game;
  const hs = app.hud;
  const goalUi = hs.goalUi ?? '';
  let fresh = false;
  if (app.floor === 'workshop') {
    for (const t of STORE_TABS) {
      const open = t.kinds.filter((k) => g.unlocked(k));
      if (t.id !== 'build' && !open.length) continue;
      for (const k of open) if (g.s.ents.some((e) => e.kind === k)) hs.seen.add(k);
      // a petal fanned: what it holds has been seen
      if (W.open && W.petal === t.id) for (const k of open) hs.tabSeen.add(k);
      const tabFresh = t.id !== 'build' && open.some((k) => !hs.tabSeen.has(k));
      const ring = t.id + open.length;
      if (tabFresh && !hs.tabRung.has(ring)) { hs.tabRung.add(ring); app.audio.sfx('tab'); }
      fresh ||= tabFresh || open.some((k) => isFreshKind(app, k));
    }
    fresh ||= CHUNKS.some((c) => c.cost && !g.s.land.includes(c.id) && !isSky(g, c.id) && (!c.requires || g.done(c.requires)) && g.s.coin.gte(c.cost));
  }
  W.fresh = fresh;
  // the Build button glows for a goal inside this floor's wheel (a Workshop building, the Bellows
  // and land are not on the Factory floor's), not once the goal's building is in hand
  const held = app.mode.k === 'build' && goalUi === 'build:' + app.mode.kind;
  W.goal = (app.floor === 'workshop' && !held && (goalUi.startsWith('build:') || goalUi === 'bellows' || goalUi === 'land')) || goalUi === 'fold';
}

const STARTERS = new Set<string>(['belt', 'miner', 'smelter', 'heap']);
function isFreshKind(app: App, k: BuildKind) {
  return app.game.unlocked(k) && !app.hud.seen.has(k) && !STARTERS.has(k);
}

/** Number keys 1-9 (hidden accelerators): on the Workshop the open building petal's items (or,
 * shut, the last one opened); on the Factory floor 1 the trunk, 2-9 the designs. */
export function wheelSlot(app: App, i: number): void {
  if (app.floor === 'factory') {
    if (i === 0) app.setMode(app.mode.k === 'ftrunk' ? { k: 'idle' } : { k: 'ftrunk' });
    else {
      const d = app.game.s.designs[i - 1];
      if (d) app.pickModule(d.id);
    }
    if (W.open) closeWheel(app);
    return;
  }
  const hs = app.hud;
  const id: PetalId = W.open && (W.petal === 'build' || W.petal === 'power' || W.petal === 'heavy') ? W.petal : hs.buildTab;
  const tab = STORE_TABS.find((q) => q.id === id) ?? STORE_TABS[0];
  const kind = tab.kinds[i];
  if (!kind) return;
  setPetal(app, tab.id, false);
  if (app.mode.k !== 'build' || app.mode.kind !== kind) app.pickBuild(kind);
  if (W.open && app.mode.k === 'build') closeWheel(app);
}

// ---------------------------------------------------------------- the petals and their items

const FACING = ['east', 'south', 'west', 'north'];
const ARROW = ['→', '↓', '←', '↑'];
const short = (n: number) => Num.of(n).format();

/** A building's sprite at k x 16 px, facing `rot`, frame f (a 2x2's 32 px art drawn at half). */
function drawKind(app: App, kind: string, x: number, y: number, k: 1 | 2, rot: number, f: number, dark = false) {
  const ctx = app.ui.ctx;
  const s = sheet(spriteName(kind));
  const row = s.rows ? s.rows[((rot % 4) + 4) % 4 % s.rows.length] : s.frames;
  const img = row[((f % row.length) + row.length) % row.length];
  const scale = (16 * k) / s.w;
  const w = Math.round(s.w * scale), h = Math.round(s.h * scale);
  // tall art (the Pole) stands up out of its tile, as on the floor
  const dy = Math.round(s.ay * scale);
  if (dark) { ctx.globalAlpha = 0.45; ctx.filter = 'brightness(0)'; }
  if (!s.rows && rot) {
    ctx.save();
    ctx.translate(x + w / 2, y + w / 2);
    ctx.rotate((rot * Math.PI) / 2);
    ctx.drawImage(img, -w / 2, -h / 2 - dy, w, h);
    ctx.restore();
  } else ctx.drawImage(img, x, y - dy, w, h);
  if (dark) { ctx.filter = 'none'; ctx.globalAlpha = 1; }
}

function frameOf(app: App, s: SpriteSheet, anim: boolean) {
  return anim ? Math.floor(app.ui.time * (s.fps || 6)) : 0;
}

/** Act III's Workshop buildings (DESIGN.md §21): kept off the wheel, even as locked silhouettes,
 * until Act III opens (the Great Drill's stage 3) or one is unlocked, so an Act II wheel stays as
 * it was. They sit at the end of the Heavy petal, so the number keys of the rest never move. */
const ACT3_KINDS = new Set<BuildKind>(['chemVat', 'greenhouse', 'chuteMouth']);
const act3Open = (app: App) => (app.game.s.mega.stage ?? 0) >= 3 || [...ACT3_KINDS].some((k) => app.game.unlocked(k));

function storeItems(app: App, tabId: 'build' | 'power' | 'heavy'): Item[] {
  const g = app.game;
  const hs = app.hud;
  const all = STORE_TABS.find((t) => t.id === tabId)!.kinds;
  const kinds = act3Open(app) ? all : all.filter((k) => !ACT3_KINDS.has(k));
  const goalUi = hs.goalUi ?? '';
  return kinds.map((kind, i): Item => {
    const d = BUILD[kind];
    const unlocked = g.unlocked(kind);
    const free = kind === 'crate' && g.s.freeCrates > 0;
    const afford = free || g.s.coin.gte(d.cost);
    const owned = g.s.ents.filter((e) => e.kind === kind).length;
    const s = sheet(spriteName(kind));
    const working = g.s.ents.some((e) => e.kind === kind && e.state === 'work');
    const draw = (x: number, y: number, k: 1 | 2, hov: boolean) => drawKind(app, kind, x, y, k, app.rot, frameOf(app, s, hov || working || k === 2), !unlocked);
    const rows: string[] = [];
    const chips: Item['chips'] = [];
    let verbs = '';
    if (unlocked) {
      for (const r of d.blurb.split(' · ')) rows.push(r);
      if (d.kw) rows.push(`{u:power} a Pole within ${poleReach(g)} tiles`);
      if (d.w > 1) rows.push(`${d.w}×${d.h} · placed by its top-left tile`);
      chips.push(free ? { text: `free ×${g.s.freeCrates}`, o: { role: 'good' } } : { text: Num.of(d.cost).format() + ' each', o: { role: afford ? 'coin' : 'bad', icon: 'coin' } });
      // Milestone 13: its rate at its first recipe known (or a power building's kW)
      const rate = kindRate(g, kind);
      if (rate) chips.push({ text: `${plain(rate.perMin, rate.perMin < 10 ? 1 : 0)}/min`, o: { role: 'ink', item: rate.item } });
      else if (d.power) chips.push({ text: `${d.power} kW`, o: { role: 'power', icon: 'power' } });
      chips.push({ text: `×${owned} built`, o: { role: 'soft' } });
      verbs = kind === 'belt' ? '{k:LMB} drag to lay  {k:R} turn  {k:RMB} drop' : '{k:LMB} place  {k:R} turn  {k:RMB} drop';
    } else {
      rows.push(`{u:lock} {research:${RESEARCH[d.unlock!].name}}`);
      verbs = '{k:T} research';
    }
    return {
      id: 'wheel_item_' + kind,
      name: unlocked ? d.name : '???',
      draw,
      price: unlocked ? (free ? 'FREE' : short(d.cost)) : null,
      priceRole: afford ? 'coin' : 'soft',
      afford: unlocked && afford,
      locked: !unlocked,
      active: app.mode.k === 'build' && app.mode.kind === kind,
      fresh: isFreshKind(app, kind),
      goal: goalUi === 'build:' + kind,
      key: String(i + 1),
      chips, rows, verbs,
      pick: () => {
        if (!unlocked) { app.pickBuild(kind); return false; }
        if (!(app.mode.k === 'build' && app.mode.kind === kind)) app.pickBuild(kind);
        return true;
      },
    };
  });
}

/** A land chunk as a 16 px tile (k 2: 32): ground, a grid, and the ore its deposits hold. */
function landTile(app: App, c: ChunkDef, x: number, y: number, k: number) {
  const ui = app.ui;
  const size = 16 * k;
  ui.ctx.fillStyle = C.ground1; ui.ctx.fillRect(x, y, size, size);
  ui.ctx.fillStyle = C.ground2; ui.ctx.fillRect(x, y, size, k);
  ui.ctx.fillStyle = C.ground0;
  for (let i = 4; i < 16; i += 4) { ui.ctx.fillRect(x + i * k, y, Math.max(1, k / 2), size); ui.ctx.fillRect(x, y + i * k, size, Math.max(1, k / 2)); }
  const ores = chunkOres(c, app.game.patches);
  ores.slice(0, 2).forEach((it, i) => ui.ctx.drawImage(itemIcon(it), x + (ores.length > 1 ? (2 + i * 6) * k : 4 * k), y + (ores.length > 1 ? (2 + i * 6) * k : 4 * k), 8 * k, 8 * k));
}

/** The ores a chunk's deposits hold (on this island: its exotic too, Act IV). */
function chunkOres(c: ChunkDef, patches = PATCHES): ItemId[] {
  return [...new Set(patches.filter((p) => p.x >= c.x && p.x < c.x + c.w && p.y >= c.y && p.y < c.y + c.h).map((p) => p.item))] as ItemId[];
}

/** Upgrades: the Bellows until it is bought, the land still for sale, the Factory annex. */
function upgradeItems(app: App): Item[] {
  const g = app.game;
  const goalUi = app.hud.goalUi ?? '';
  const out: Item[] = [];
  if (!g.has('bellows')) {
    const u = UPGRADES.bellows;
    const afford = g.s.coin.gte(u.cost);
    out.push({
      id: 'wheel_item_bellows', name: 'The Bellows',
      draw: (x, y, k, hov) => drawKind(app, 'furnace', x, y, k, 1, frameOf(app, sheet('furnace'), hov || k === 2)),
      price: String(u.cost), priceRole: afford ? 'coin' : 'soft', afford, locked: false, active: false, fresh: false, goal: goalUi === 'bellows',
      chips: [{ text: String(u.cost), o: { role: afford ? 'coin' : 'bad', icon: 'coin' } }],
      rows: u.blurb.split(' · '),
      verbs: '{k:LMB} buy',
      pick: () => { app.act({ k: 'upgrade', id: 'bellows' }); return true; },
    });
  }
  for (const c of CHUNKS) {
    // Pebble Isle's sky (Act IV) is not for sale
    if (!c.cost || g.s.land.includes(c.id) || isSky(g, c.id)) continue;
    const ready = !c.requires || g.done(c.requires);
    const afford = g.s.coin.gte(c.cost);
    const ores = chunkOres(c, g.patches);
    out.push({
      id: 'wheel_item_land_' + c.id, name: c.name.replace(/^Chunk [A-Z] · /, '') || c.name,
      draw: (x, y, k) => { app.ui.ctx.globalAlpha = ready ? 1 : 0.45; landTile(app, c, x, y, k); app.ui.ctx.globalAlpha = 1; },
      price: short(c.cost), priceRole: ready && afford ? 'coin' : 'soft', afford: ready && afford, locked: !ready, active: false, fresh: false, goal: goalUi === 'land' && ready,
      chips: [{ text: c.cost.toLocaleString('en-US'), o: { role: afford ? 'coin' : 'bad', icon: 'coin' } }, { text: `${c.w}×${c.h} tiles`, o: { role: 'soft' } }],
      rows: [c.name.split(' · ')[0], ...(ores.length ? [`${ores.map((o) => `{i:${o}}`).join(' ')} deposits · +claims`] : ['open ground']), ...(ready ? [] : [`{u:lock} {research:${RESEARCH[c.requires!].name}}`])],
      verbs: ready ? '{k:LMB} buy  or click it on the map' : '{k:T} research',
      pick: () => {
        if (!ready) { app.refuse(`needs {research:${RESEARCH[c.requires!].name}}`); return false; }
        if (app.act({ k: 'land', id: c.id }).ok) { app.lookAt(c.x + c.w / 2, c.y + c.h / 2); return true; }
        return false;
      },
    });
  }
  // the Factory annex (DESIGN.md §19): the next block of Factory floor east of the Dock
  const price = annexPrice(g);
  if (price && g.flag('factoryOpen')) {
    const ready = g.done(ANNEX.requires);
    const afford = g.s.coin.gte(price);
    const n = (g.s.annex ?? 0) + 1;
    const tile = (x: number, y: number, k: number) => {
      const ctx = app.ui.ctx;
      ctx.fillStyle = C.hull0; ctx.fillRect(x, y, 16 * k, 16 * k);
      for (let i = 0; i < 4; i++) { ctx.fillStyle = i % 3 ? C.hull1 : C.hull0; ctx.fillRect(x + (i % 2) * 8 * k, y + Math.floor(i / 2) * 8 * k, 8 * k, 8 * k); }
      ctx.fillStyle = C.brass0;
      ctx.fillRect(x + 7 * k, y + 2 * k, 2 * k, 12 * k);
      ctx.fillRect(x + 2 * k, y + 7 * k, 12 * k, 2 * k);
    };
    out.push({
      id: 'wheel_item_annex', name: `Annex ${n} of ${ANNEX.blocks}`,
      draw: (x, y, k) => { app.ui.ctx.globalAlpha = ready ? 1 : 0.45; tile(x, y, k); app.ui.ctx.globalAlpha = 1; },
      price: price.format(), priceRole: ready && afford ? 'coin' : 'soft', afford: ready && afford, locked: !ready, active: false, fresh: false, goal: false,
      chips: [{ text: price.format(), o: { role: afford ? 'coin' : 'bad', icon: 'coin' } }, { text: `${ANNEX.cols}×${FACTORY.h} tiles`, o: { role: 'soft' } }],
      rows: ['{u:factory} Factory floor · east of the Dock', '{reset:lost at Reorganize}', ...(ready ? [] : [`{u:lock} {research:${RESEARCH[ANNEX.requires].name}}`])],
      verbs: ready ? '{k:LMB} buy' : '{k:T} research',
      pick: () => {
        if (!ready) { app.refuse(`needs {research:${RESEARCH[ANNEX.requires].name}}`); return false; }
        return app.act({ k: 'annex' }).ok;
      },
    });
  }
  return out;
}

/** Tools: Rotate, Remove, Fold (with its audit count) and Flow. */
function toolItems(app: App): Item[] {
  const g = app.game;
  const icon = (name: UIconName) => (x: number, y: number) => uiIcon(app.ui, name, x, y);
  const folding = g.done('folding');
  const audits = g.s.audits.length, max = prules(g).maxAudits;
  const graded = g.s.audits.some((a) => a.result);
  const foldNew = folding && !g.s.designs.length && !g.s.audits.length;
  const r = app.rot;
  return [
    {
      id: 'wheel_item_rotate', name: 'Rotate', draw: icon('rotate'), price: ARROW[r], priceRole: 'soft', afford: false, locked: false, active: false, fresh: false, goal: false, key: 'R',
      chips: [{ text: `${ARROW[r]} ${FACING[r]}`, o: { role: 'ink' } }],
      rows: ['the part in hand', 'or the machine under the mouse'], verbs: '{k:R} turn',
      pick: () => { app.rot = ((app.rot + 1) % 4) as Dir; app.audio.sfx('rotate'); return false; },
    },
    {
      id: 'wheel_item_remove', name: 'Remove', draw: icon('remove'), price: null, priceRole: 'soft', afford: false, locked: false, active: app.mode.k === 'remove', fresh: false, goal: false, key: 'X',
      chips: [{ text: 'full refund', o: { role: 'coin', icon: 'coin' } }],
      rows: ['any building you placed'], verbs: '{k:LMB} remove  {k:RMB} stop',
      pick: () => { app.setMode(app.mode.k === 'remove' ? { k: 'idle' } : { k: 'remove' }); return true; },
    },
    {
      id: 'wheel_item_fold', name: 'Fold', draw: icon('fold'), price: audits ? `${audits}/${max}` : null, priceRole: graded ? 'coin' : 'research',
      afford: foldNew, locked: !folding, active: app.mode.k === 'fold', fresh: foldNew, goal: (app.hud.goalUi ?? '') === 'fold' && app.mode.k !== 'fold', key: 'F',
      chips: folding ? [{ text: `audits ${audits}/${max}`, o: { role: graded ? 'coin' : 'research', icon: 'clock' } }] : [],
      rows: folding ? ['box a working line', '→ an audit → a grade → one tile'] : [`{u:lock} {research:${RESEARCH.folding.name}}`],
      verbs: folding ? '{k:LMB} drag a box' : '{k:T} research',
      pick: () => { app.toggleFold(); return folding; },
    },
    {
      id: 'wheel_item_flow', name: 'Flow', draw: icon('flow'), price: app.flowOverlay ? 'ON' : null, priceRole: 'good', afford: false, locked: false, active: app.flowOverlay, fresh: false, goal: false, key: 'L',
      chips: [{ text: app.flowOverlay ? 'on' : 'off', o: { role: app.flowOverlay ? 'good' : 'soft' } }],
      rows: ['belts drawn by how full they are'], verbs: '{k:L} show or hide',
      pick: () => { app.flowOverlay = !app.flowOverlay; app.audio.sfx('click'); return true; },
    },
  ];
}

function trunkItems(app: App): Item[] {
  const g = app.game;
  const afford = g.s.coin.gte(FACTORY.trunkCost);
  const tr = sheet('trunk');
  return [{
    id: 'wheel_item_trunk', name: 'Trunk belt',
    draw: (x, y, k, hov) => drawKind(app, 'trunk', x, y, k, app.rot, frameOf(app, tr, hov || k === 2)),
    price: String(FACTORY.trunkCost), priceRole: afford ? 'coin' : 'soft', afford, locked: false, active: app.mode.k === 'ftrunk', fresh: false, goal: false, key: '1',
    chips: [{ text: `${FACTORY.trunkCost} a tile`, o: { role: afford ? 'coin' : 'bad', icon: 'coin' } }, { text: `${FACTORY.trunkSpeed * 60}/min`, o: { role: 'ink' } }],
    rows: ["a module's gold front → the next one's back", 'or the Factory Dock, the Hopper, the Bay', 'off a side · its {i:slag} or {i:oil}'],
    verbs: '{k:LMB} drag to lay  {k:R} turn',
    pick: () => { if (app.mode.k !== 'ftrunk') app.setMode({ k: 'ftrunk' }); return true; },
  }, ...chuteItems(app)];
}

/** The Factory Chute (DESIGN.md §21): one on the floor, once Chutes is researched (a padlock from
 * Zoning on). Picked, it follows the mouse until a click puts it down (src/app/act3.ts). */
function chuteItems(app: App): Item[] {
  const g = app.game;
  const open = g.done('chutes');
  if (!open && !g.done('zoning')) return [];
  const placed = g.s.factory.ents.some((e) => e.kind === 'fchute');
  const afford = g.s.coin.gte(FACTORY.chuteCost);
  const fs = sheet('factory_chute');
  return [{
    id: 'wheel_item_fchute', name: open ? 'Factory Chute' : '???',
    draw: (x, y, k, hov) => drawKind(app, 'factory_chute', x, y, k, 0, frameOf(app, fs, hov || k === 2), !open),
    price: open ? (placed ? 'BUILT' : short(FACTORY.chuteCost)) : null, priceRole: placed ? 'good' : afford ? 'coin' : 'soft',
    afford: open && !placed && afford, locked: !open, active: holdingChute(), fresh: false, goal: false,
    chips: open ? [{ text: Num.of(FACTORY.chuteCost).format(), o: { role: afford ? 'coin' : 'bad', icon: 'coin' } }, { text: placed ? 'one standing' : 'one a floor', o: { role: 'soft' } }] : [],
    rows: open
      ? ['trunks end in it → down to the Workshop', `{u:workshop} a Chute Mouth pushes it out`, `holds ${chuteCap(g)} of each item`, ...(placed ? ['{good:standing} · {k:X} lifts it, refunded'] : [])]
      : [`{u:lock} {research:${RESEARCH.chutes.name}}`],
    verbs: open ? (placed ? '{k:X} remove' : '{k:LMB} pick up  then click the floor') : '{k:T} research',
    pick: () => {
      if (!open) { app.refuse(`needs {research:${RESEARCH.chutes.name}}`); return false; }
      if (placed) { app.refuse('The Factory has its Chute already: run more trunks into it'); return false; }
      holdChute(app);
      return true;
    },
  }];
}

function moduleItems(app: App): Item[] {
  const g = app.game;
  const designs = g.s.designs;
  const room = designs.length > MAX_DESIGNS ? MAX_DESIGNS - 1 : MAX_DESIGNS;
  const out: Item[] = designs.slice(0, room).map((d, i): Item => {
    const out1 = mainOutput(g, d.id);
    const cost = stampCost(g, d);
    const why = stampRefusal(g, d);
    const kits = kitsFor(g, d);
    const letter = d.grade.letter;
    const draw = (x: number, y: number, k: 1 | 2) => {
      const ctx = app.ui.ctx;
      ctx.drawImage(sheet('module').frames[0], x, y, 16 * k, 16 * k);
      if (out1) ctx.drawImage(itemIcon(out1), x + 4 * k, y + 4 * k, 8 * k, 8 * k);
      if (k === 1) {
        const lw = smallWidth(letter);
        ctx.fillStyle = T.paper;
        ctx.fillRect(x + 16 - lw - 1, y - 1, lw + 2, SMALL_H + 2);
        drawSmall(ctx, letter, x + 16 - lw, y, onPaper(GRADE_COL[letter] ?? C.bone));
      }
    };
    const chips: Item['chips'] = [
      { text: `stamp ${cost.format()}`, o: { role: g.s.coin.gte(cost) ? 'coin' : 'bad', icon: 'coin' } },
    ];
    if (kits > 0) chips.push({ text: `${kits}`, o: { role: g.s.parts.gte(kits) ? 'ink' : 'bad', icon: 'kit' } });
    for (const [ore, n] of Object.entries(claimLoad(g, d)) as [ItemId, number][]) {
      if (!n) continue;
      const held = claimsHeld(g, ore), used = claimsUsed(g, ore);
      chips.push({ text: `+${n} → ${used + n}/${held}`, o: { role: used + n <= held + 1e-9 ? 'ink' : 'bad', item: ore } });
    }
    const ins = Object.entries(d.ins).map(([k, v]) => `{i:${k}} ${perMin(v ?? 0)}`).join('  ');
    const outs = Object.entries(d.outs).map(([k, v]) => `{i:${k}} ${perMin(v ?? 0)}`).join('  ');
    return {
      id: 'wheel_item_module_' + d.id, name: d.name.replace(/[{}]/g, ''),
      draw: (x, y, k) => draw(x, y, k),
      price: `×${d.spare}`, priceRole: d.spare > 0 ? 'good' : 'soft', afford: d.spare > 0, locked: false,
      active: app.mode.k === 'fmodule' && app.mode.design === d.id, fresh: false, goal: false, key: i < 8 ? String(i + 2) : undefined,
      chips,
      rows: [
        `grade {big:${letter}} ×${d.grade.mult.toFixed(2)} · ${d.spare} spare`,
        ins ? `${ins} → ${outs} /min` : `a source → ${outs} /min`,
        ...(why ? [`{bad:${why.replace(/[{}]/g, '')}}`] : []),
      ],
      verbs: d.spare ? '{k:LMB} place  {k:SHIFT}{k:LMB} stamp' : '{k:SHIFT}{k:LMB} stamp',
      pick: (shift) => {
        if (shift || d.spare < 1) { app.act({ k: 'stamp', id: d.id }); return false; }
        app.pickModule(d.id);
        return true;
      },
    };
  });
  if (designs.length > room) {
    out.push({
      id: 'wheel_item_moreModules', name: 'More modules', draw: (x, y) => uiIcon(app.ui, 'fold', x, y), price: `+${designs.length - room}`, priceRole: 'soft',
      afford: false, locked: false, active: false, fresh: false, goal: false, key: 'I',
      chips: [{ text: `+${designs.length - room} designs`, o: { role: 'ink', icon: 'fold' } }],
      rows: ['place · stamp · unfold · rename'], verbs: '{k:I} Modules',
      pick: () => { app.togglePanel('modules'); return true; },
    });
  }
  return out;
}

/** The petals that exist now, clockwise from the top. */
function petals(app: App): Petal[] {
  const g = app.game;
  const hs = app.hud;
  const goalUi = hs.goalUi ?? '';
  const ps: Petal[] = [];
  const icon = (name: UIconName) => (x: number, y: number) => uiIcon(app.ui, name, x, y);
  const tools = toolItems(app);
  if (app.floor === 'factory') {
    const tr = sheet('trunk');
    ps.push({ id: 'modules', name: 'Modules', icon: icon('fold'), items: moduleItems(app), fresh: false, goal: goalUi === 'factory' && app.mode.k !== 'fmodule' && g.s.designs.some((d) => d.spare > 0) });
    ps.push({ id: 'trunk', name: 'Trunk', icon: (x, y) => app.ui.ctx.drawImage(tr.frames[Math.floor(app.ui.time * 6) % tr.frames.length], x, y), items: trunkItems(app), fresh: false, goal: false });
  } else {
    for (const t of STORE_TABS) {
      if (t.id !== 'build' && !t.kinds.some((k) => g.unlocked(k))) continue;
      const items = storeItems(app, t.id);
      const fresh = t.id !== 'build' && t.kinds.some((k) => g.unlocked(k) && !hs.tabSeen.has(k));
      ps.push({ id: t.id, name: t.name, icon: icon(t.id === 'build' ? 'build' : t.id), items, fresh: fresh || items.some((q) => q.fresh), goal: items.some((q) => q.goal) });
    }
    const up = upgradeItems(app);
    ps.push({ id: 'upgrades', name: 'Upgrades', icon: icon('star'), items: up, fresh: up.some((q) => q.afford && q.id.startsWith('wheel_item_land')), goal: up.some((q) => q.goal) });
  }
  ps.push({ id: 'tools', name: 'Tools', icon: (x, y) => toolsIcon(app, x, y), items: tools, fresh: tools.some((q) => q.fresh), goal: tools.some((q) => q.goal) });
  return ps;
}

/** The Tools petal's face: the four tools' 8x8 icons in a 2x2. */
function toolsIcon(app: App, x: number, y: number) {
  uiIcon(app.ui, 'rotate', x, y, 1);
  uiIcon(app.ui, 'remove', x + 8, y, 1);
  uiIcon(app.ui, 'fold', x, y + 8, 1);
  uiIcon(app.ui, 'flow', x + 8, y + 8, 1);
}

// ---------------------------------------------------------------- drawing

const easeBack = (t: number) => {
  const c1 = 1.70158, c3 = c1 + 1;
  const u = Math.max(0, Math.min(1, t)) - 1;
  return 1 + c3 * u * u * u + c1 * u * u;
};

function petalAngle(i: number, n: number) {
  return -Math.PI / 2 + (i * Math.PI * 2) / n;
}

/** The items' angles: centred on their petal's, ITEM_STEP apart along the arc. */
function itemAngles(base: number, n: number): number[] {
  const step = ITEM_STEP / R_ITEM;
  return Array.from({ length: n }, (_, i) => base + (i - (n - 1) / 2) * step);
}

const near = (mx: number, my: number, x: number, y: number, r = HIT) => (mx - x) * (mx - x) + (my - y) * (my - y) <= r * r;

/** The discs' looks, in the h180_disc and h180_petal art's own colours (line, fill, lit edge,
 * shaded edge, an inner rim). The art is 18 px, drawn for 8 px icons; a 16 px sprite at 1x
 * covered it, so the wheel draws the same discs at DISC px from these. */
const DISC_LOOK: Record<string, { line: string; fill: string; hi: string; lo: string; rim?: string; rimHi?: string }> = {
  paper: { line: '#7a4b33', fill: '#eee2c6', hi: '#fff0a6', lo: '#dcb07a' },
  paperHover: { line: '#7a4b33', fill: '#fff0a6', hi: '#fff0a6', lo: '#dcb07a' },
  paperAfford: { line: '#130e1c', fill: '#eee2c6', hi: '#fff0a6', lo: '#dcb07a', rim: '#c8a13a', rimHi: '#ecd27c' },
  paperAffordHover: { line: '#130e1c', fill: '#fff0a6', hi: '#fff0a6', lo: '#dcb07a', rim: '#ffbe48', rimHi: '#fff0a6' },
  paperLocked: { line: '#7a4b33', fill: '#c28f5a', hi: '#dcb07a', lo: '#9e6a42' },
  brass: { line: '#130e1c', fill: '#c8a13a', hi: '#ecd27c', lo: '#91701f' },
  brassHover: { line: '#130e1c', fill: '#ecd27c', hi: '#fff0a6', lo: '#c8a13a' },
  brassOpen: { line: '#130e1c', fill: '#91701f', hi: '#c8a13a', lo: '#5b4016', rim: '#ffbe48', rimHi: '#ffbe48' },
};
const discCache = new Map<string, HTMLCanvasElement>();

/** A pixel disc DISC across (and its 1 px shadow under it), cached per look. */
function discCanvas(look: string): HTMLCanvasElement {
  const hit = discCache.get(look);
  if (hit) return hit;
  const L = DISC_LOOK[look];
  const c = document.createElement('canvas');
  c.width = DISC;
  c.height = DISC + 1;
  const ctx = c.getContext('2d')!;
  const R = DISC / 2;
  const inside = (x: number, y: number) => Math.hypot(x + 0.5 - R, y + 0.5 - R) <= R - 0.15;
  for (let y = 0; y <= DISC; y++)
    for (let x = 0; x < DISC; x++) {
      const dx = x + 0.5 - R, dy = y + 0.5 - R;
      const r = Math.hypot(dx, dy);
      let col: string | null = null;
      if (y < DISC && inside(x, y)) {
        if (!inside(x - 1, y) || !inside(x + 1, y) || !inside(x, y - 1) || !inside(x, y + 1)) col = L.line;
        else if (L.rim && r > R - 2.6) col = dx + dy < -R * 0.6 ? L.rimHi ?? L.rim : L.rim;
        else if (r > R - (L.rim ? 3.6 : 2.6)) col = dx + dy < -R * 0.45 ? L.hi : dx + dy > R * 0.45 ? L.lo : L.fill;
        else col = L.fill;
      } else if (y > 0 && inside(x, y - 1)) col = '#211a30';
      if (col) { ctx.fillStyle = col; ctx.fillRect(x, y, 1, 1); }
    }
  discCache.set(look, c);
  return c;
}

/** A disc (petal or item) centred at (cx, cy). */
function discArt(app: App, look: keyof typeof DISC_LOOK, cx: number, cy: number) {
  app.ui.ctx.drawImage(discCanvas(look), Math.round(cx - DISC / 2), Math.round(cy - DISC / 2));
}

/** A padlock over a locked disc (code-drawn, 7x8). */
function padlock(app: App, cx: number, cy: number) {
  const ctx = app.ui.ctx;
  const x = Math.round(cx - 3), y = Math.round(cy - 2);
  ctx.fillStyle = C.ink;
  ctx.fillRect(x + 1, y - 3, 5, 1); ctx.fillRect(x, y - 2, 1, 3); ctx.fillRect(x + 6, y - 2, 1, 3);
  ctx.fillRect(x - 1, y, 9, 7);
  ctx.fillStyle = C.brass2; ctx.fillRect(x, y + 1, 7, 5);
  ctx.fillStyle = C.brass3; ctx.fillRect(x, y + 1, 7, 1);
  ctx.fillStyle = C.ink; ctx.fillRect(x + 3, y + 3, 1, 2);
}

/** A 1 px string between two disc centres, `pad` px clear of each disc. */
function twineLine(app: App, x0: number, y0: number, x1: number, y1: number, pad: number) {
  const ctx = app.ui.ctx;
  const d = Math.hypot(x1 - x0, y1 - y0);
  if (d <= pad * 2) return;
  const ux = (x1 - x0) / d, uy = (y1 - y0) / d;
  ctx.fillStyle = rgba(C.wood1, 0.9);
  for (let s = pad; s < d - pad; s += 1) ctx.fillRect(Math.round(x0 + ux * s), Math.round(y0 + uy * s), 1, 1);
}

/** A price tag on a string, hung radially out from a disc at angle a. */
function priceTag(app: App, text: string, role: Item['priceRole'], cx: number, cy: number, a: number) {
  const ctx = app.ui.ctx;
  const tw = smallWidth(text) + 5, th = SMALL_H + 4;
  const ux = Math.cos(a), uy = Math.sin(a);
  const sup = Math.abs(ux) * tw / 2 + Math.abs(uy) * th / 2;
  const d = DISC / 2 + 2 + sup;
  const tx = Math.round(cx + ux * d - tw / 2), ty = Math.round(cy + uy * d - th / 2);
  // the string, from the disc's rim to the tag
  ctx.fillStyle = C.wood1;
  for (let s = DISC / 2 - 1; s < d - sup + 1; s += 1) ctx.fillRect(Math.round(cx + ux * s), Math.round(cy + uy * s), 1, 1);
  ctx.fillStyle = rgba(C.ink, 0.5); ctx.fillRect(tx + 1, ty + 1, tw, th);
  ctx.fillStyle = T.paperEdge; ctx.fillRect(tx, ty, tw, th);
  ctx.fillStyle = role === 'coin' ? T.paperHi : T.paper; ctx.fillRect(tx + 1, ty + 1, tw - 2, th - 2);
  const col = role === 'coin' ? T.coin : role === 'good' ? T.good : role === 'research' ? T.research : role === 'bad' ? T.bad : T.inkSoft;
  drawSmall(ctx, text, tx + 3, ty + 2, col);
  app.ui.record('text', tx, ty, tw, th, text);
}

/** The goal's pulse: a gold ring swelling off a disc and fading, twice a second. */
function ripple(app: App, cx: number, cy: number) {
  const ctx = app.ui.ctx;
  const ph = (app.ui.time * 1.6) % 1;
  ctx.globalAlpha = 1 - ph;
  ring(app, cx, cy, DISC / 2 + 1 + Math.round(ph * 7), C.lamp2, 2);
  ctx.globalAlpha = 1;
}

/** A ring round a disc: a held tool. */
function ring(app: App, cx: number, cy: number, r: number, col: string, w = 1) {
  const ctx = app.ui.ctx;
  ctx.strokeStyle = col;
  ctx.lineWidth = w;
  ctx.beginPath(); ctx.arc(Math.round(cx) + 0.5, Math.round(cy), r, 0, Math.PI * 2); ctx.stroke();
}

/** Draw the wheel when it is open (and handle its clicks). Called last in the HUD, over the floor. */
export function drawWheel(app: App, _L: Layout): void {
  if (!W.open) return;
  if (app.panel || app.screen !== 'play') { closeWheel(app); return; }
  const ui = app.ui;
  restoreMouse(app);
  const mx = ui.mx, my = ui.my;
  // the wheel takes the whole screen's clicks while it is open
  ui.block(0, 0, ui.w, ui.h);
  ui.floating(() => draw(app, mx, my), 'tip');
  // it was drawn over the HUD: whatever lay under it never hovers
  ui.tooltip = null;
}

function draw(app: App, mx: number, my: number) {
  const ui = app.ui;
  const ctx = ui.ctx;
  const cx = W.x, cy = W.y;
  const ps = petals(app);
  if (!ps.some((p) => p.id === W.petal)) setPetal(app, ps[0].id, false);
  const e = easeBack((ui.time - W.t) / 0.16);
  const click = W.click;
  W.click = null;

  // ---- what is under the mouse (final positions: hit tests never chase the animation)
  const pIdx = ps.findIndex((p) => p.id === W.petal);
  const open = ps[pIdx];
  const pa = ps.map((_, i) => petalAngle(i, ps.length));
  const ia = itemAngles(pa[pIdx], open.items.length);
  const hubHov = near(mx, my, cx, cy, HUB / 2);
  const petalHov = ps.findIndex((_, i) => near(mx, my, cx + Math.cos(pa[i]) * R_PETAL, cy + Math.sin(pa[i]) * R_PETAL));
  const itemHov = open.items.findIndex((_, i) => near(mx, my, cx + Math.cos(ia[i]) * R_ITEM, cy + Math.sin(ia[i]) * R_ITEM));

  // a petal fans when the mouse rests on it, or at once on a click
  const hp = petalHov >= 0 ? ps[petalHov].id : null;
  if (hp !== W.hov) { W.hov = hp; W.hovAt = ui.time; }
  if (hp && hp !== W.petal && ui.time - W.hovAt >= DWELL) setPetal(app, hp);

  // ---- the mat: a soft shadow round the wheel so it lifts off the floor
  const rr = Math.round(R_ITEM * e + 12);
  ctx.fillStyle = rgba(C.ink, 0.4);
  ctx.beginPath(); ctx.arc(cx, cy + 2, Math.max(1, rr), 0, Math.PI * 2); ctx.fill();

  // ---- spokes: twine from the hub to each petal
  ctx.fillStyle = C.wood1;
  for (let i = 0; i < ps.length; i++) {
    const r = R_PETAL * e;
    for (let s = HUB / 2 - 2; s < r - 7; s += 1) ctx.fillRect(Math.round(cx + Math.cos(pa[i]) * s), Math.round(cy + Math.sin(pa[i]) * s), 1, 1);
  }

  // ---- the open petal's items, fanned on the outer arc
  const fan = Math.max(0, Math.min(1, (ui.time - W.tp) / 0.14));
  let hovered: { item: Item; x: number; y: number } | null = null;
  const px0 = cx + Math.cos(pa[pIdx]) * (R_PETAL + 3 * fan) * e, py0 = cy + Math.sin(pa[pIdx]) * (R_PETAL + 3 * fan) * e;
  open.items.forEach((it, i) => {
    const t = easeBack((ui.time - W.tp - i * 0.012) / 0.14);
    const a = pa[pIdx] + (ia[i] - pa[pIdx]) * Math.min(1, t);
    const r = R_PETAL + (R_ITEM - R_PETAL) * t * e;
    const x = Math.round(cx + Math.cos(a) * r), y = Math.round(cy + Math.sin(a) * r);
    // each item hangs off its petal on a string
    twineLine(app, px0, py0, x, y, DISC / 2 - 1);
    const hov = i === itemHov;
    ui.mark(it.id, Math.round(cx + Math.cos(ia[i]) * R_ITEM) - DISC / 2, Math.round(cy + Math.sin(ia[i]) * R_ITEM) - DISC / 2, DISC, DISC);
    if (fan > 0.6 && it.price) priceTag(app, it.price, it.locked ? 'soft' : it.priceRole, x, y, a);
    discArt(app, it.locked ? 'paperLocked' : it.afford ? (hov ? 'paperAffordHover' : 'paperAfford') : hov ? 'paperHover' : 'paper', x, y);
    // the sprite at 1x, lifted a pixel while hovered
    it.draw(x - 8, y - 8 - (hov ? 1 : 0), 1, hov);
    if (it.locked) padlock(app, x + 4, y + 4);
    if (it.active) ring(app, x, y, 13, T.good, 1);
    if (it.goal) ripple(app, x, y);
    if (it.fresh && !it.goal) dot(ui, x + 7, y - 10, C.pipRed);
    if (hov) hovered = { item: it, x, y };
  });

  // ---- the petals
  ps.forEach((p, i) => {
    const isOpen = p.id === W.petal;
    // the open petal leans out toward its items
    const rp = (R_PETAL + (isOpen ? 3 * fan : 0)) * e;
    const x = Math.round(cx + Math.cos(pa[i]) * rp), y = Math.round(cy + Math.sin(pa[i]) * rp);
    const hov = i === petalHov;
    ui.mark('wheel_' + p.id, Math.round(cx + Math.cos(pa[i]) * R_PETAL) - DISC / 2, Math.round(cy + Math.sin(pa[i]) * R_PETAL) - DISC / 2, DISC, DISC);
    if (isOpen) ring(app, x, y, DISC / 2 + 1, C.bone, 1);
    discArt(app, isOpen ? 'brassOpen' : hov ? 'brassHover' : 'brass', x, y);
    p.icon(x - 8, y - 8 - (hov ? 1 : 0));
    if (p.goal && !isOpen) ripple(app, x, y);
    if ((p.fresh || (p.goal && !isOpen)) && Math.floor(ui.time * 3) % 2 === 0) dot(ui, x + 7, y - 10, p.goal ? C.gold : C.pipRed);
  });

  // ---- the hub: the last building picked, in its well
  const hubKind = app.floor === 'factory' ? W.hubF : W.hubW;
  const ha = art('h180_hub');
  const hx = cx - HUB / 2, hy = cy - HUB / 2;
  ui.mark('wheel_hub', hx, hy, HUB, HUB);
  if (ha) ctx.drawImage(ha.frames[hubHov && hubKind ? 1 : 0], hx, hy);
  else { ctx.fillStyle = C.ink; ctx.beginPath(); ctx.arc(cx, cy, 14, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = T.wood; ctx.beginPath(); ctx.arc(cx, cy, 12, 0, Math.PI * 2); ctx.fill(); }
  const hubItem = hubKind ? hubItemOf(app, ps, hubKind) : null;
  if (hubItem) hubItem.draw(hx + 6, hy + 6 - (hubHov ? 1 : 0), 1, hubHov);
  else drawSmall(ctx, ARROW[app.rot], cx - 2, cy - 2, T.woodHi);

  // ---- the info tag: the hovered item, else the hub's building, else the open petal's name
  const info = hovered as { item: Item; x: number; y: number } | null;
  if (info) infoTag(app, info.item, { x: info.x, y: info.y });
  else if (hubHov && hubItem) infoTag(app, hubItem, { x: cx, y: cy });
  else petalTag(app, petalHov >= 0 ? ps[petalHov] : open, petalHov >= 0 ? { x: cx + Math.cos(pa[petalHov]) * R_PETAL, y: cy + Math.sin(pa[petalHov]) * R_PETAL } : { x: cx, y: cy });

  // ---- clicks (taken before the HUD saw them)
  if (W.rclick) { W.rclick = false; closeWheel(app); return; }
  if (!click) return;
  if (itemHov >= 0) {
    const it = open.items[itemHov];
    if (it.pick(click.shift)) {
      if (it.id.startsWith('wheel_item_') && BUILD[it.id.slice(11) as BuildKind]) W.hubW = it.id.slice(11) as BuildKind;
      W.open = false;
    }
    else ui.sfx('click');
    return;
  }
  if (petalHov >= 0) {
    const p = ps[petalHov];
    if (p.id === 'trunk' && W.petal === 'trunk') { p.items[0].pick(false); W.open = false; return; }
    setPetal(app, p.id);
    return;
  }
  if (hubHov) {
    if (hubItem && hubItem.pick(click.shift)) W.open = false;
    else if (!hubItem) closeWheel(app);
    return;
  }
  if (lastInfo && mx >= lastInfo.x && my >= lastInfo.y && mx < lastInfo.x + lastInfo.w && my < lastInfo.y + lastInfo.h) return;
  // a click anywhere else shuts it
  closeWheel(app);
}

/** The hub's item: the last building picked, as its petal draws it. */
function hubItemOf(app: App, ps: Petal[], k: BuildKind | { k: 'trunk' } | { k: 'module'; id: number }): Item | null {
  const id = typeof k === 'string' ? 'wheel_item_' + k : k.k === 'trunk' ? 'wheel_item_trunk' : 'wheel_item_module_' + k.id;
  for (const p of ps) for (const it of p.items) if (it.id === id) return it;
  if (typeof k === 'string') return storeItems(app, STORE_TABS.find((t) => t.kinds.includes(k))!.id).find((q) => q.id === id) ?? null;
  return null;
}

/** where the info tag was drawn last (a click on it does not shut the wheel) */
let lastInfo: { x: number; y: number; w: number; h: number } | null = null;

/** Where a tag of w x h goes beside the wheel: right of it, else left, centred on the hub. */
function besideWheel(app: App, w: number, h: number) {
  const ui = app.ui;
  const right = W.x + REACH + 2;
  const x = right + w <= ui.w - 2 ? right : Math.max(2, W.x - REACH - 2 - w);
  const y = Math.max(2, Math.min(ui.h - h - 2, W.y - Math.round(h / 2)));
  return { x, y };
}

function infoTag(app: App, it: Item, anchor: { x: number; y: number }) {
  const ui = app.ui;
  const rows = it.rows.map((r) => layoutRich(r, INFO_W));
  const verbs = it.verbs ? layoutRich(it.verbs, INFO_W) : null;
  const lines = chipRows(it.chips);
  const head = Math.max(34, 15 + lines.length * (CHIP_H + 2));
  let ch = head + 2;
  for (const r of rows) ch += r.h;
  if (verbs) ch += 3 + verbs.h;
  const cw = INFO_W;
  const size = tagSize(cw, ch);
  const p = besideWheel(app, size.w, size.h);
  // the string runs to the item when it hangs on the tag's side of the wheel (across the wheel
  // it would tangle with the petals)
  const right = p.x > W.x;
  const tied = right ? anchor.x >= W.x - 4 : anchor.x <= W.x + 4;
  const r = tag(ui, p.x, p.y, size.w, size.h, { anchor: tied ? anchor : null, hole: right ? 'left' : 'right', blocking: false });
  lastInfo = { x: p.x, y: p.y, w: size.w, h: size.h };
  // the preview at 2x, in a pressed well
  {
    ui.ctx.fillStyle = rgba(T.paperLo, 0.8);
    ui.ctx.fillRect(r.x, r.y, 32, 32);
    ui.ctx.fillStyle = rgba(T.paperEdge, 0.8);
    ui.ctx.fillRect(r.x, r.y, 32, 1);
    ui.ctx.fillRect(r.x, r.y, 1, 32);
    ui.ctx.save();
    ui.ctx.beginPath(); ui.ctx.rect(r.x, r.y - 8, 32, 40); ui.ctx.clip();
    it.draw(r.x, r.y, 2, true);
    ui.ctx.restore();
    if (it.locked) padlock(app, r.x + 25, r.y + 25);
  }
  const tx = r.x + 36;
  const tw = cw - 36;
  // the name, shrunk to fit, the hotkey beside it
  const kw = it.key ? keycapWidthOf(it.key) + 3 : 0;
  let name = it.name;
  while (name.length > 3 && bigWidth(name) > tw - kw) name = name.slice(0, -2) + '.';
  ui.big(name, tx, r.y + 1, it.locked ? T.inkSoft : T.ink);
  if (it.key) keycapK(ui, it.key, r.x + cw - kw + 3, r.y);
  // the price and the counts as chips under the name
  let cy = r.y + 15;
  for (const line of lines) {
    let x = tx;
    for (const c of line) x += chip(ui, x, cy, c.text, c.o) + 2;
    cy += CHIP_H + 2;
  }
  let y = r.y + head + 2;
  for (const L of rows) { drawLayout(ui, L, r.x, y, T.ink); y += L.h; }
  if (verbs) { ui.ctx.fillStyle = rgba(T.paperLo, 0.9); ui.ctx.fillRect(r.x, y + 1, cw, 1); drawLayout(ui, verbs, r.x, y + 3, T.inkSoft); }
}

function keycapWidthOf(k: string) {
  return richWidth(`{k:${k}}`);
}

/** Chips laid in rows that fit w. */
function chipRows(chips: Item['chips'], w = INFO_W - 36): Item['chips'][] {
  const out: Item['chips'][] = [];
  let line: Item['chips'] = [], x = 0;
  for (const c of chips) {
    const cw = chipWidth(c.text, c.o) + 2;
    if (line.length && x + cw > w) { out.push(line); line = []; x = 0; }
    line.push(c);
    x += cw;
  }
  if (line.length) out.push(line);
  return out.slice(0, 2);
}

/** With nothing hovered: the open petal's name and its icons in a row, the verbs to open it. */
function petalTag(app: App, p: Petal, anchor: { x: number; y: number }) {
  const ui = app.ui;
  // the Heavy petal grows with Act III: its number keys run as far as its items do
  const verbs = p.id === 'heavy' ? `{k:1}-{k:${Math.min(9, p.items.length)}} pick` : PETAL_VERBS[p.id];
  const afford = p.items.filter((q) => q.afford && !q.locked).length;
  const fresh = p.items.filter((q) => q.fresh).length;
  const counts = [afford ? `{coinc:${afford} to buy}` : '', fresh ? `{bad:${fresh} new}` : '', p.items.some((q) => q.goal) ? '{warn:the goal}' : ''].filter(Boolean).join('  ');
  const cw = Math.max(bigWidth(p.name), richWidth(verbs), counts ? richWidth(counts) : 0);
  const ch = 13 + 11 + (counts ? 11 : 0);
  const size = tagSize(cw, ch);
  const pos = besideWheel(app, size.w, size.h);
  const right = pos.x > W.x;
  const r = tag(ui, pos.x, pos.y, size.w, size.h, { anchor: (right ? anchor.x >= W.x - 4 : anchor.x <= W.x + 4) ? anchor : null, hole: right ? 'left' : 'right', blocking: false });
  lastInfo = { x: pos.x, y: pos.y, w: size.w, h: size.h };
  ui.big(p.name, r.x, r.y, T.ink);
  ui.rich(verbs, r.x, r.y + 13, Infinity, T.inkSoft);
  if (counts) ui.rich(counts, r.x, r.y + 24, Infinity, T.ink);
}

/** What a petal's tag says you can do, as keycap verbs. */
const PETAL_VERBS: Record<PetalId, string> = {
  build: '{k:1}-{k:9} pick', power: '{k:1}-{k:4} pick', heavy: '{k:1}-{k:9} pick',
  tools: '{k:R} {k:X} {k:F} {k:L}', upgrades: '{k:LMB} buy',
  trunk: '{k:1} trunk  {k:LMB} drag', modules: '{k:2}-{k:9} place  {k:SHIFT}{k:LMB} stamp',
};

// ---------------------------------------------------------------- the Build button

/** The Build button standing on the speaker's head (the screen says where): the toolbox over the
 * word, its key on the corner. It opens the wheel at the screen's centre. The owner (2026-10-21):
 * a right click is nobody's first guess, so building has a button you can see; the right tap,
 * `Q`, `Space` and a click on empty paving stay the quick ways. Gold, and hopping, while the goal
 * points into the wheel; a red dot when a petal holds something new. */
export function toolboxButton(app: App, R: { x: number; y: number; w: number; h: number }): void {
  const ui = app.ui;
  const ctx = ui.ctx;
  const { x, y, w, h } = R;
  const hov = ui.hover(x, y, w, h);
  ui.mark('toolbox', x, y, w, h);
  ui.region(x, y, w, h, 'button', true);
  const lit = W.goal && !W.open;
  const hop = lit && Math.floor(ui.time * 2.5) % 3 === 0 ? 1 : 0;
  const by = y - hop;
  const dy = buttonRaw(ctx, x, by, w, h, W.open || (hov && app.input.mouse.down[0]) ? 'down' : hov ? 'hover' : 'up', lit ? 'gold' : 'paper');
  const a = art('h180_toolbox');
  const ix = x + Math.floor((w - 20) / 2) - 3, iy = by + 3 + dy;
  if (a) ctx.drawImage(a.frames[hov || W.open ? 1 : 0], ix, iy);
  else {
    ctx.fillStyle = C.ink; ctx.fillRect(ix, iy + 4, 20, 12);
    ctx.fillStyle = C.red; ctx.fillRect(ix + 1, iy + 5, 18, 10);
    ctx.fillStyle = C.brass2; ctx.fillRect(ix + 8, iy + 8, 4, 3);
  }
  keycapK(ui, 'Q', x + w - keycapWidthOf('Q') - 3, by + 3 + dy);
  ui.big('Build', x + Math.floor(w / 2), by + 20 + dy, T.ink, { align: 'center' });
  if (lit && Math.floor(ui.time * 4) % 2 === 0) dot(ui, x + w - 3, by - 1, C.gold);
  else if (W.fresh && !W.open && Math.floor(ui.time * 3) % 2 === 0) dot(ui, x + w - 3, by - 1, C.pipRed);
  if (hov) {
    ui.hoverId = 'toolbox';
    ui.tip([{ text: '{big:Build}' }, { text: '{k:LMB} here · {k:RMB} the floor · {k:Q}' }], 170);
    if (ui.clicked) {
      ui.eat();
      if (W.open) closeWheel(app);
      else openWheel(app, ui.w / 2, ui.h / 2);
    }
  }
}
