// Scenarios (DESIGN.md §21 Scenarios, §24): puzzle boards played as a separate game in their own
// save slot ("scenario:<id>", localStorage key foldworks_scenario_<id>), opened after the first
// Reorganize. Eight boards (Milestone 11). The page lists them with each one's best score; the
// board picked gets the right page: its pitch, its twist, and its efficiency board (the best score,
// per tile, per kW and waste, each the best of its own: DESIGN.md §24). The bests are the sim's:
// a board's game notes them in its meta, and "Back to your town" hands them to the town with the
// `boards` command, so they are in the town's save. The app's older store (foldworks_scenario_best)
// is read once into the town's boards and removed. Playing a board saves the main game first and
// swaps the App's game for the board's; the App's save() hands a Scenario game to saveScenario
// (the one hook in app.ts), so autosave and closing the tab never write a board over the town.
import { C, rgba } from '../data/palette';
import { CHUNKS } from '../data/land';
import { ITEMS } from '../data/items';
import { SCENARIOS, SCENARIO_IDS, type ScenarioId, type ScenarioDef } from '../data/scenarios';
import { Game } from '../sim/Game';
import { savePayload, restore } from '../sim/snapshot';
import { scenarioOf, scenarioBest, beltsLeft } from '../sim/scenario';
import { mergeBoard } from '../sim/longtail';
import type { BoardRecord } from '../sim/world';
import { banner } from './hud';
import { migrate, store, SAVE_VERSION } from '../engine/save';
import { plain } from '../engine/fmt';
import { Num } from '../engine/num';
import { textWidth, bigWidth, smallWidth, ellipsize, LINE_H } from '../ui/font';
import { drawRich, richHeight, CHIP_H } from '../ui/rich';
import { T } from '../ui/theme';
import { itemIcon } from '../render/sprites';
import { button, chip, chipWidth, rule, pencil, meter } from './chrome';
import { menuTemplate } from './widgets';
import { speaker, caption } from './screens';
import { newHudState } from './hud';
import type { App } from './app';
import type { Rect } from '../ui/ui';

/** The board's save slot name and its localStorage key. */
export const scenarioSlot = (id: ScenarioId) => `scenario:${id}`;
const slotKey = (id: ScenarioId) => `foldworks_scenario_${id}`;
/** the app's older store of bests, retired (Milestone 11: read once into the town's boards) */
const BEST_KEY = 'foldworks_scenario_best';

/** A score as the record card prints it: two figures after the point under 10. */
export const scoreText = (v: number) => plain(v, v < 10 ? 2 : 1);

/** Does this board have a game saved? */
export function hasScenarioSave(id: ScenarioId): boolean {
  try { return !!store()?.getItem(slotKey(id)); } catch { return false; }
}

/** Scenarios open after the first Reorganize (DESIGN.md §21), and inside one, of course. */
export function scenariosOpen(app: App): boolean {
  return !!app.game.s.scenario || app.game.s.meta.runs >= 1;
}

/** App.save() for a Scenario game: into the board's own slot, never the main one. */
export function saveScenario(app: App): boolean {
  const g = app.game;
  const id = g.s.scenario as ScenarioId | undefined;
  if (!id || app.screen !== 'play' || app.offlineJob) return false;
  const s = store();
  if (!s) return false;
  const now = Date.now();
  try {
    s.setItem(slotKey(id), JSON.stringify({ ...savePayload(g, now), v: SAVE_VERSION }));
    app.autosave.mark(now);
    return true;
  } catch (err) {
    console.error('scenario save failed', err);
    return false;
  }
}

/** The board's saved game, or null (missing or unreadable: it starts over). */
function loadScenario(id: ScenarioId): Game | null {
  try {
    const raw = store()?.getItem(slotKey(id));
    if (!raw) return null;
    const g = restore(migrate(JSON.parse(raw)) as never);
    return g.s.scenario === id ? g : null;
  } catch (err) {
    console.error('scenario load failed', err);
    return null;
  }
}

/** Put a game on the App the way newGame does (nothing of the last game stays open or pinned). */
function adopt(app: App, g: Game) {
  app.game = g;
  app.screen = 'play';
  app.mode = { k: 'idle' };
  app.selected = null;
  app.fselected = null;
  app.panel = null;
  app.toasts = [];
  app.trophyPops = [];
  app.renderer.ground = null;
  app.hud = newHudState();
  app.hud.coinShown = g.s.coin.toNumber();
  app.hud.firstMiner = true;
  app.offline = null;
  app.gradeId = null;
  app.setFloor('workshop', true);
  app.fitCamera(true);
}

/** Play a board: the main game (or the board open now) is saved first; `fresh` starts it over. */
export function playScenario(app: App, id: ScenarioId, fresh = false) {
  if (!app.game.s.scenario) townBoards = { ...(app.game.s.meta.boards ?? {}) };
  app.save();
  const g = (!fresh && loadScenario(id)) || new Game((Math.random() * 1e9) | 0, { scenario: id });
  adopt(app, g);
  const d = SCENARIOS[id];
  app.toast(d.name, `${twist(g, d)} · fold the best {i:${d.product}} you can`, C.violet, 'star');
  app.audio.sfx('open');
  app.save();
}

/** Back to the main game: the board is saved where it stands, the town's save continues. */
export function backToTown(app: App) {
  // the board's bests go to the town (DESIGN.md §24): checked, merged field by field, in its save
  const boards = app.game.s.scenario ? app.game.s.meta.boards : null;
  app.save();
  app.continueGame();
  if (boards && Object.keys(boards).length) {
    app.game.act({ k: 'boards', boards });
    townBoards = { ...(app.game.s.meta.boards ?? {}) };
  }
  if (app.panel === 'scenarios') app.panel = null;
  app.audio.sfx('open');
}

/** The board's twist in a few words (Scarce Belts counts what is left). */
export function twist(g: Game | null, d: ScenarioDef): string {
  if (d.belts) {
    const left = g && scenarioOf(g)?.id === d.id ? beltsLeft(g) : d.belts;
    return `${left} of ${d.belts} belt tiles left`;
  }
  const parts: string[] = [];
  if (d.miners) parts.push(`Miners ×${d.miners}`);
  if (d.power) parts.push(`power ×${d.power}`);
  if (d.foldMax) parts.push(`boxes ${d.foldMax}×${d.foldMax}`);
  if (d.noHeaps) parts.push('no Slag Heaps');
  if (d.mk1Only) parts.push('no Mk2');
  if (!parts.length) parts.push(`${d.land.length} chunks of land`);
  return parts.join(' · ');
}

/** The best fold of this game, for the chip: its score, or null. */
export function liveBest(g: Game): { score: number; grade: string; design: number } | null {
  return scenarioBest(g);
}

// ------------------------------------------------------------------ the page

/** The board's land in miniature: the Workshop's chunks, the board's own lit. */
function landMap(app: App, d: ScenarioDef, x: number, y: number, k: number) {
  const ui = app.ui;
  const W = Math.max(...CHUNKS.map((c) => c.x + c.w)), H = Math.max(...CHUNKS.map((c) => c.y + c.h));
  ui.fill(x - 1, y - 1, W * k + 2, H * k + 2, T.ink);
  for (const c of CHUNKS) {
    const on = d.land.includes(c.id);
    ui.fill(x + c.x * k, y + c.y * k, c.w * k, c.h * k, on ? C.pave2 : C.grass1);
    if (on) ui.fill(x + c.x * k, y + c.y * k, c.w * k, 1, C.pave3);
  }
}

/** The board picked on the page (null: the one open, else the first). */
const page = { sel: null as ScenarioId | null };

/** Pick a board on the page (e2e). */
export function scenarioPick(id: ScenarioId | null) { page.sel = id; }

/** A share as the board prints it ("-" for a record from the older store, which never knew). */
const wasteText = (w: number) => (w >= 1 ? '-' : `${Math.round(w * 100)}%`);
const measureName: Record<string, string> = { perTile: 'a tile', rate: 'a minute', perKw: 'a kW' };

/** The Scenarios page: the eight boards with their best scores down the left page; the board picked
 * on the right, with its efficiency board and its keys. */
export function scenariosScreen(app: App, r: Rect) {
  const ui = app.ui;
  const g = app.game;
  const inBoard = scenarioOf(g);
  const side = Math.min(206, Math.floor(r.w * 0.4));
  const { body, detail } = menuTemplate(app, r, { title: 'Scenarios', accent: T.reset, icon: 'trophies', detail: side });
  const recs = boardsNow(app);
  if (!page.sel || !SCENARIOS[page.sel]) page.sel = (inBoard?.id as ScenarioId | undefined) ?? SCENARIO_IDS[0];
  const x = body.x + 2, w = body.w - 4;
  let y = body.y + 1;
  y += speaker(app, 'voltaire', '"A board, a twist, a record. Fold well, darling."', x, y, Math.min(w, 300)) + 4;
  const rowH = Math.max(22, Math.min(34, Math.floor((body.y + body.h - y) / SCENARIO_IDS.length)));
  const W = Math.max(...CHUNKS.map((c) => c.x + c.w)), H = Math.max(...CHUNKS.map((c) => c.y + c.h));
  const k = rowH >= 30 && w >= 300 ? 1 : 0.5;
  SCENARIO_IDS.forEach((id, i) => {
    const d = SCENARIOS[id];
    const rec = recs[id];
    const here = inBoard?.id === id;
    const on = page.sel === id;
    const top = y + i * rowH;
    if (top + rowH > body.y + body.h + 1) return;
    const hov = ui.hover(x, top, w, rowH - 1);
    ui.mark('board:' + id, x, top, w, rowH - 1);
    ui.region(x, top, w, rowH - 1, 'button', false);
    if (on || hov) {
      ui.fill(x, top, w, rowH - 1, on ? T.paperHi : rgba(T.paperLo, 0.6));
      if (on) ui.fill(x, top, 2, rowH - 1, T.reset);
    }
    // the land in miniature at the left
    const mw = Math.ceil(W * k) + 8;
    if (k >= 1) landMap(app, d, x + 5, top + Math.floor((rowH - 1 - H) / 2), 1);
    else ui.ctx.drawImage(itemIcon(d.product), x + 5, top + Math.floor((rowH - 9) / 2));
    const tx = x + (k >= 1 ? mw : 16);
    const sw = rec ? Math.max(textWidth(scoreText(rec.score)), 30) + 4 : smallWidth('NO BEST YET') + 4;
    const tw = x + w - 4 - sw - tx;
    const ty = top + Math.floor((rowH - 1 - (rowH >= 26 ? 18 : 9)) / 2);
    ui.text(ellipsize(d.name, tw), tx, ty, here ? T.reset : T.ink);
    if (rowH >= 26) ui.small(ellipsize(`${twist(here ? g : null, d)} · ${d.unit}`.toUpperCase(), tw), tx, ty + 11, T.inkSoft);
    if (rec) {
      ui.text(scoreText(rec.score), x + w - 4, ty, T.coin, { align: 'right' });
      if (rowH >= 26) ui.small(`GRADE ${rec.grade}`, x + w - 4, ty + 11, T.inkSoft, { align: 'right' });
    } else ui.small('NO BEST YET', x + w - 4, ty + 2, T.inkSoft, { align: 'right' });
    if (hov) {
      ui.tip([{ text: `{big:${d.name}}` }, { text: `{reset:${twist(here ? g : null, d)}}` }, { text: `{soft:scored by} ${d.unit}` }], 200);
      if (ui.clicked) { ui.eat(); ui.sfx('click'); page.sel = id; }
    }
    if (i < SCENARIO_IDS.length - 1 && !on) rule(ui, x + 4, top + rowH - 1, w - 8);
  });
  boardSide(app, detail!, page.sel, recs[page.sel] ?? null);
}

/** The right page: the board picked, its pitch and twist, its efficiency board, and its keys. */
function boardSide(app: App, dp: Rect, id: ScenarioId, rec: BoardRecord | null) {
  const ui = app.ui;
  const g = app.game;
  const d = SCENARIOS[id];
  const inBoard = scenarioOf(g);
  const here = inBoard?.id === id;
  const dx = dp.x + 4, dw = dp.w - 8;
  let dy = dp.y + 2;
  const foot = here || inBoard ? 40 : hasScenarioSave(id) ? 40 : 22;
  const end = dp.y + dp.h - foot;
  if (bigWidth(d.name) <= dw) ui.big(d.name, dx, dy, here ? T.reset : T.ink);
  else ui.text(ellipsize(d.name, dw), dx, dy + 1, here ? T.reset : T.ink);
  dy += 15;
  const ph = richHeight(`{soft:${d.pitch}}`, dw);
  if (dy + ph <= end - 80) dy += drawRich(ui, `{soft:${d.pitch}}`, dx, dy, dw, T.inkSoft) + 4;
  // its facts as chips: the twist, the coin, what scores
  let cx = dx;
  const chips: [string, Parameters<typeof chip>[4]][] = [
    [twist(here ? g : null, d), { role: 'reset' }],
    [`${Num.of(d.coin).format()}`, { role: 'coin', icon: 'coin' }],
  ];
  for (const [t, o] of chips) {
    const cw = chipWidth(t, o);
    if (cx + cw > dx + dw) { cx = dx; dy += CHIP_H + 3; }
    chip(ui, cx, dy, t, o);
    cx += cw + 4;
  }
  dy += CHIP_H + 6;
  // the efficiency board: the score big, then per tile, per kW and waste
  rule(ui, dx, dy - 2, dw, true);
  caption(ui, 'your bests', dx, dy + 1, T.reset);
  dy += 10;
  if (dy + 44 <= end) {
    ui.ctx.drawImage(itemIcon(d.product), dx, dy + 2);
    ui.big(rec ? scoreText(rec.score) : '-', dx + 12, dy, rec ? T.coin : T.inkSoft);
    const unit = d.unit;
    const uw = dx + dw - (dx + 12 + bigWidth(rec ? scoreText(rec.score) : '-') + 6);
    if (uw > 20) ui.small(ellipsize(unit.toUpperCase(), uw), dx + dw, dy + 4, T.inkSoft, { align: 'right' });
    dy += 14;
    if (rec) drawRich(ui, `{soft:grade} ${rec.grade} {soft:· each best is its own, from any fold}`, dx, dy, dw, T.ink);
    else drawRich(ui, `{soft:fold a line of} {i:${d.product}} {soft:to score}`, dx, dy, dw, T.ink);
    dy += 12;
    // three cells: per tile, per kW, waste (the fold audit's own terms: C, §18's power, W)
    const cells: [string, string, number][] = [
      ['PER TILE', rec && rec.perTile > 0 ? scoreText(rec.perTile) : '-', -1],
      ['PER KW', rec && rec.perKw > 0 ? scoreText(rec.perKw) : '-', -1],
      ['WASTE', rec ? wasteText(rec.waste) : '-', rec && rec.waste < 1 ? 1 - rec.waste : 0],
    ];
    const cw = Math.floor((dw - 8) / 3);
    cells.forEach(([lab, v, f], i) => {
      const cx2 = dx + i * (cw + 4);
      ui.fill(cx2, dy, cw, 26, rgba(T.paperLo, 0.5));
      ui.small(lab, cx2 + 3, dy + 3, T.inkSoft);
      ui.text(ellipsize(v, cw - 6), cx2 + 3, dy + 11, v === '-' ? T.inkSoft : T.ink);
      if (v !== '-' && f >= 0) meter(ui, cx2 + 3, dy + 21, cw - 6, 3, f, { role: 'good', glint: false });
    });
    ui.hint(dx, dy, dw, 26, [{ text: '{big:The efficiency board}' }, { text: 'per tile: the measure a tile of its box' }, { text: 'per kW: a minute for each kW its machines draw' }, { text: 'waste: the byproducts its audit found loose' }, { text: '{soft:each the best of its own fold}' }], 210);
    dy += 30;
  }
  if (dy + 10 <= end) {
    const s = `{soft:scored ${measureName[d.measure]}: the best fold of} {i:${d.product}}`;
    drawRich(ui, s, dx, dy, dw, T.ink);
  }
  // the keys along the foot
  const fy = dp.y + dp.h - 17;
  const saved = hasScenarioSave(id) || here;
  if (here) {
    if (button(ui, 'scenarioHere_' + id, dx, fy - 20, dw, 16, 'Playing · close the page', { active: true, tip: '{u:play} this board is open' })) app.panel = null;
  } else if (button(ui, 'scenarioPlay_' + id, dx, saved ? fy - 20 : fy, saved ? Math.floor(dw * 0.55) : dw, 16, saved ? 'Resume' : 'Play', { gold: true, icon: 'play', tip: [{ text: `{big:${d.name}}` }, { text: saved ? '{u:play} pick up where you left it' : '{u:play} a fresh board' }, { text: inBoard ? '{soft:this board is saved first}' : '{soft:your town is saved first · it waits}' }] })) playScenario(app, id);
  if (saved && !here) {
    const sw2 = dw - Math.floor(dw * 0.55) - 4;
    if (button(ui, 'scenarioNew_' + id, dx + dw - sw2, fy - 20, sw2, 16, 'Start over', { tip: [{ text: '{bad:the saved board is replaced}' }, { text: '{soft:your bests stay on file}' }] })) playScenario(app, id, true);
  }
  if (inBoard) {
    if (button(ui, 'scenarioBack', dx, fy, dw, 17, 'Back to your town', { gold: !here ? false : true, icon: 'workshop', tip: [{ text: '{u:workshop} this board is saved · your town continues' }, { text: '{soft:its bests go on file}' }] })) backToTown(app);
  } else if (saved) {
    pencil(ui, dx, fy + 8, dw, rgba(T.inkSoft, 0.6));
    const foot2 = ['YOUR TOWN WAITS WHILE YOU PLAY', 'YOUR TOWN WAITS'].find((t) => smallWidth(t) <= dw - 8) ?? '';
    ui.small(foot2, dx + dw / 2, fy + 2, T.inkSoft, { align: 'center' });
  }
  void LINE_H; void ITEMS;
}


// ------------------------------------------------------------------ the boards' bests (Milestone 11)

/** The town's bests as they stood when a board was opened (a Scenario game keeps only its own
 * game's bests; the record to beat is the town's). */
let townBoards: Record<string, BoardRecord> = {};

/** The bests on file for each board: the town's, and inside a board also this game's, merged. */
export function boardsNow(app: App): Partial<Record<ScenarioId, BoardRecord>> {
  const g = app.game;
  if (!g.s.scenario) return { ...(g.s.meta.boards ?? {}) } as Partial<Record<ScenarioId, BoardRecord>>;
  const out: Record<string, BoardRecord> = { ...townBoards };
  for (const [id, r] of Object.entries(g.s.meta.boards ?? {})) out[id] = mergeBoard(out[id], r);
  return out as Partial<Record<ScenarioId, BoardRecord>>;
}

/** The record to beat inside a board: the town's (null before the first). */
export const townRecord = (id: ScenarioId): BoardRecord | null => townBoards[id] ?? null;

/** Retire the app's older store (localStorage foldworks_scenario_best: score, grade, date): read it
 * once into the town's boards with the `boards` command, then remove it. A record from it knew only
 * its score: per tile is the score on a per-tile board, per kW nothing, waste unknown (1, shown as
 * a dash). Looked at once for each town game (the key is gone after the first). */
let retired: Game | null = null;
export function retireOldBests(app: App) {
  if (retired === app.game || app.screen !== 'play' || app.game.s.scenario) return;
  retired = app.game;
  let raw: string | null = null;
  try { raw = store()?.getItem(BEST_KEY) ?? null; } catch { return; }
  if (!raw) return;
  try {
    const d = JSON.parse(raw) as Record<string, { score?: number; grade?: string }>;
    const boards: Record<string, BoardRecord> = {};
    for (const id of SCENARIO_IDS) {
      const r = d?.[id];
      if (!r || typeof r.score !== 'number' || !(r.score > 0)) continue;
      boards[id] = { score: r.score, grade: typeof r.grade === 'string' ? r.grade : '-', perTile: SCENARIOS[id].measure === 'perTile' ? r.score : 0, perKw: SCENARIOS[id].measure === 'perKw' ? r.score : 0, waste: 1 };
    }
    if (Object.keys(boards).length) app.game.act({ k: 'boards', boards });
  } catch { /* an unreadable store is dropped */ }
  try { store()?.removeItem(BEST_KEY); } catch { /* blocked storage: nothing to retire */ }
}

/** The board open and its record so far, for the banner: a new best is one that beats the town's. */
const seen = { game: null as Game | null, score: 0 };
export function watchBest(app: App) {
  const g = app.game;
  const d = scenarioOf(g);
  if (!d) return;
  const rec = g.s.meta.boards?.[d.id];
  if (seen.game !== g) { seen.game = g; seen.score = Math.max(rec?.score ?? 0, townBoards[d.id]?.score ?? 0); return; }
  if (rec && rec.score > seen.score + 1e-9) {
    seen.score = rec.score;
    app.audio.sfx('fanfare', 0.7);
    banner(app, 'NEW BEST!', `${d.name} · ${scoreText(rec.score)} ${d.unit}`, C.gold);
    app.toast('A new personal best', `${scoreText(rec.score)} ${d.unit} · grade ${rec.grade}`, C.gold, 'trophies');
  }
}
