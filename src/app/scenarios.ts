// Scenarios (DESIGN.md §21 Scenarios): puzzle boards played as a separate game in their own save
// slot ("scenario:<id>", localStorage key foldworks_scenario_<id>), opened after the first
// Reorganize. The page lists the three boards with each one's personal best; the bests are the
// app's (localStorage foldworks_scenario_best: score, grade, date), never the sim's. Playing a board
// saves the main game first and swaps the App's game for the board's; "Back to your town" saves the
// board and continues the main save. The App's save() hands a Scenario game to saveScenario (the
// one hook in app.ts), so autosave and closing the tab never write a board over the town.
import { C, rgba } from '../data/palette';
import { CHUNKS } from '../data/land';
import { ITEMS } from '../data/items';
import { SCENARIOS, SCENARIO_IDS, type ScenarioId, type ScenarioDef } from '../data/scenarios';
import { Game } from '../sim/Game';
import { savePayload, restore } from '../sim/snapshot';
import { scenarioOf, scenarioBest, beltsLeft } from '../sim/scenario';
import { migrate, store, SAVE_VERSION } from '../engine/save';
import { plain } from '../engine/fmt';
import { Num } from '../engine/num';
import { textWidth, bigWidth, smallWidth, LINE_H } from '../ui/font';
import { drawRich, richHeight, CHIP_H } from '../ui/rich';
import { T } from '../ui/theme';
import { itemIcon } from '../render/sprites';
import { button, chip, chipWidth, rule, pencil } from './chrome';
import { menuTemplate } from './widgets';
import { speaker, caption } from './screens';
import { newHudState } from './hud';
import type { App } from './app';
import type { Rect } from '../ui/ui';

/** The board's save slot name and its localStorage key. */
export const scenarioSlot = (id: ScenarioId) => `scenario:${id}`;
const slotKey = (id: ScenarioId) => `foldworks_scenario_${id}`;
const BEST_KEY = 'foldworks_scenario_best';

export interface ScenarioRecord { score: number; grade: string; date: number; design?: string }

/** The personal bests, by board (empty when storage is missing or unreadable). */
export function records(): Partial<Record<ScenarioId, ScenarioRecord>> {
  try {
    const raw = store()?.getItem(BEST_KEY);
    const d = raw ? JSON.parse(raw) : {};
    return d && typeof d === 'object' ? d : {};
  } catch {
    return {};
  }
}

/** Keep a new personal best if it beats the one on file; true when it did. */
export function noteBest(id: ScenarioId, rec: ScenarioRecord): boolean {
  const all = records();
  const old = all[id];
  if (old && old.score >= rec.score - 1e-9) return false;
  all[id] = rec;
  try { store()?.setItem(BEST_KEY, JSON.stringify(all)); } catch { /* a full or blocked store keeps the old record */ }
  return true;
}

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
  app.save();
  app.continueGame();
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

/** The Scenarios page: the boards with their bests, play or start over, and the way back. */
export function scenariosScreen(app: App, r: Rect) {
  const ui = app.ui;
  const g = app.game;
  const inBoard = scenarioOf(g);
  const side = Math.min(190, Math.floor(r.w * 0.34));
  const { body, detail } = menuTemplate(app, r, { title: 'Scenarios', accent: T.reset, icon: 'trophies', detail: side });
  const recs = records();
  const x = body.x + 2, w = body.w - 4;
  let y = body.y + 2;
  const rowH = Math.floor((body.h - 4) / SCENARIO_IDS.length);
  SCENARIO_IDS.forEach((id, i) => {
    const d = SCENARIOS[id];
    const rec = recs[id];
    const here = inBoard?.id === id;
    const top = y + i * rowH;
    // the land in miniature at the left
    const k = rowH >= 56 && w >= 360 ? 2 : 1;
    landMap(app, d, x + 1, top + 4, k);
    const mw = Math.max(...CHUNKS.map((c) => c.x + c.w)) * k + 8;
    const tx = x + mw;
    // the right column: the record, then the buttons
    const bw = Math.min(96, Math.max(70, Math.floor(w * 0.24)));
    const bx = x + w - bw;
    const tw = bx - tx - 8;
    ui.big(d.name, tx, top + 2, here ? T.reset : T.ink);
    if (here && tx + bigWidth(d.name) + 6 + chipWidth('PLAYING') <= bx - 4) chip(ui, tx + bigWidth(d.name) + 6, top + 2, 'PLAYING', { role: 'reset', solid: true });
    let ty = top + 16;
    const pitchH = richHeight(d.pitch, tw);
    if (ty + pitchH <= top + rowH - CHIP_H - 6) { drawRich(ui, `{soft:${d.pitch}}`, tx, ty, tw, T.inkSoft); ty += pitchH + 2; }
    // its facts as chips: the twist, the coin, what scores
    let cx = tx;
    const chips: [string, Parameters<typeof chip>[4]][] = [
      [twist(here ? g : null, d), { role: 'reset' }],
      [`${Num.of(d.coin).format()}`, { role: 'coin', icon: 'coin' }],
      [d.unit, { role: 'ink', item: d.product }],
    ];
    for (const [t, o] of chips) {
      const cw = chipWidth(t, o);
      if (cx + cw > tx + tw) break;
      chip(ui, cx, Math.min(ty, top + rowH - CHIP_H - 5), t, o);
      cx += cw + 4;
    }
    // the record
    if (rec) {
      const s = scoreText(rec.score);
      ui.big(s, bx + bw, top + 2, T.coin, { align: 'right' });
      const date = new Date(rec.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      // the longest of these that fits the right column (the pitch runs right up to it)
      const line = [`BEST, GRADE ${rec.grade}, ${date.toUpperCase()}`, `GRADE ${rec.grade}, ${date.toUpperCase()}`, `GRADE ${rec.grade}`].find((t) => smallWidth(t) <= bw) ?? `GRADE ${rec.grade}`;
      ui.small(line, bx + bw, top + 15, T.inkSoft, { align: 'right' });
      ui.hint(bx, top, bw, 22, [{ text: `{big:Personal best}` }, { text: `${s} ${d.unit} · grade ${rec.grade}` }, ...(rec.design ? [{ text: `{soft:${rec.design}}` }] : []), { text: `{soft:${new Date(rec.date).toLocaleString('en-US')}}` }], 200);
    } else ui.small('NO RECORD YET', bx + bw, top + 6, T.inkSoft, { align: 'right' });
    // play or resume, and start over when a game is saved
    const saved = hasScenarioSave(id) || here;
    const by = top + rowH - 2 - 16 - (saved && !here ? 18 : 0);
    if (here) {
      if (button(ui, 'scenarioHere_' + id, bx, by, bw, 16, 'Playing', { active: true, tip: '{u:play} this board is open · close the page to play' })) app.panel = null;
    } else if (button(ui, 'scenarioPlay_' + id, bx, by, bw, 16, saved ? 'Resume' : 'Play', { gold: true, icon: 'play', tip: [{ text: `{big:${d.name}}` }, { text: saved ? '{u:play} pick up where you left it' : '{u:play} a fresh board' }, { text: inBoard ? '{soft:this board is saved first}' : '{soft:your town is saved first · it waits}' }] })) playScenario(app, id);
    if (saved && !here && button(ui, 'scenarioNew_' + id, bx, by + 18, bw, 16, 'Start over', { tip: [{ text: '{bad:the saved board is replaced}' }, { text: '{soft:your best stays on file}' }] })) playScenario(app, id, true);
    if (i < SCENARIO_IDS.length - 1) rule(ui, x, top + rowH - 1, w);
  });
  // the right page: Dame Voltaire on the rules, the bests in all, the way back
  const dp = detail!;
  const dx = dp.x + 4, dw = dp.w - 8;
  let dy = dp.y + 2;
  dy += speaker(app, 'voltaire', '"A board, a twist, a record. Fold well, darling."', dx, dy, dw) + 6;
  dy += caption(ui, 'the rules', dx, dy);
  for (const s of ['{u:workshop} land and research fixed', '{u:fold} the best fold of one product scores', '{u:reset} no Reorganize · no Patents', '{u:clock} each board saved on its own']) {
    const h = richHeight(s, dw);
    if (dy + h > dp.y + dp.h - 44) break;
    dy += drawRich(ui, s, dx, dy, dw, T.ink) + 2;
  }
  dy += 4;
  if (dy + 30 <= dp.y + dp.h - 22) {
    dy += caption(ui, 'your bests', dx, dy);
    for (const id of SCENARIO_IDS) {
      if (dy + 11 > dp.y + dp.h - 22) break;
      const rec = recs[id];
      ui.ctx.drawImage(itemIcon(SCENARIOS[id].product), dx, dy);
      const v = rec ? scoreText(rec.score) : '-';
      ui.clip(dx + 11, dy, dw - 15 - textWidth(v), LINE_H);
      ui.text(SCENARIOS[id].name, dx + 11, dy, T.ink);
      ui.unclip();
      ui.text(v, dx + dw, dy, rec ? T.coin : T.inkSoft, { align: 'right' });
      dy += 11;
    }
  }
  const fy = dp.y + dp.h - 17;
  if (inBoard) {
    if (button(ui, 'scenarioBack', dx, fy, dw, 17, 'Back to your town', { gold: true, icon: 'workshop', tip: [{ text: '{u:workshop} this board is saved · your town continues' }] })) backToTown(app);
  } else {
    pencil(ui, dx, fy + 8, dw, rgba(T.inkSoft, 0.6));
    const foot = ['YOUR TOWN WAITS WHILE YOU PLAY', 'YOUR TOWN WAITS'].find((t) => smallWidth(t) <= dw - 8) ?? '';
    ui.small(foot, dx + dw / 2, fy + 2, T.inkSoft, { align: 'center' });
  }
  void ITEMS;
}
