// The islands in the HUD (DESIGN.md §22, Act IV): what the town is told about the island's rule,
// always and in few words (pillar 3: a rule you can't read is a rule you can't fold for).
// - A slip under the Purse naming the island and its rule in a few words (`Rime · machines need
//   warmth`), its tip the whole rule and a line of flavour (registerCounter, as the Challenge's).
// - Short hover tags for the island's ground: rubble (`{k:LMB} Clear · {coin}`: a click on it clears
//   it, the command `clear`), a vent (what it does beside it), the sky (Pebble Isle's lost half).
// - The Old Works: a toast for a repair, and a banner the first time each of its two whole ruined
//   lines runs again (every machine repaired and each has made something this run).
// The machines' own island rows (cold or warm, vented) and the Repair button are in the reports
// (src/app/tags.ts). Reads the Game; writes it only through commands.
import { C } from '../data/palette';
import { BUILD } from '../data/machines';
import { RECIPE } from '../data/recipes';
import { WORLDS, rubblePrice, type RuinDef, type WorldId } from '../data/worlds';
import { itemName } from '../data/items';
import type { GameEvent } from '../engine/events';
import { textWidth, smallWidth } from '../ui/font';
import { T } from '../ui/theme';
import type { TipPlace } from '../ui/ui';
import type { Game } from '../sim/Game';
import { worldOf, islandDef, isSky, rubbleAt, ventAt } from '../sim/systems/islands';
import { TILE } from '../render/ground';
import { slip } from './chrome';
import { registerCounter } from './topbar';
import { banner } from './hud';
import type { App } from './app';

// ------------------------------------------------------------------ the slip under the Purse

/** Each island's rule in a few words (Pip capitals on the slip), and its ink. */
export const ISLE_SHORT: Record<WorldId, { rule: string; ink: string }> = {
  home: { rule: 'no rule', ink: T.inkSoft },
  pebble: { rule: 'half the land is sky', ink: T.research },
  cinder: { rule: 'vents: no power, no belts', ink: T.warn },
  rime: { rule: 'machines need warmth', ink: T.power },
  oldworks: { rule: 'rubble and ruins', ink: T.good },
};

const SLIP_H = 26;

/** The island's slip: its name over its rule, the whole rule in its tip. */
function isleSlip(app: App, x: number, y: number, room: number): number {
  const ui = app.ui;
  const d = islandDef(app.game);
  const short = ISLE_SHORT[d.id];
  const name = d.name.charAt(0).toUpperCase() + d.name.slice(1);
  const rule = short.rule.toUpperCase();
  const w = Math.min(room, Math.max(10 + textWidth(name), smallWidth(rule)) + 12);
  const r = slip(ui, x, y, w, SLIP_H, { blocking: true });
  ui.mark('isleSlip', x, y, w, SLIP_H);
  // a little island: sky over its land, in the rule's ink
  ui.ctx.fillStyle = short.ink;
  ui.ctx.fillRect(r.x + 1, y + 6, 6, 3);
  ui.ctx.fillRect(r.x + 2, y + 9, 4, 1);
  ui.ctx.fillRect(r.x + 3, y + 10, 2, 1);
  ui.text(name, r.x + 10, y + 4, T.ink);
  ui.small(rule, r.x, y + 16, short.ink);
  ui.hint(x, y, w, SLIP_H, [
    { text: `{big:${name}}` },
    { text: `{soft:${d.title}}` },
    ...d.rule.split(' · ').map((s) => ({ text: s })),
    { text: `{soft:${d.flavor}}` },
  ], 230);
  return w;
}

registerCounter({ id: 'island', show: (app) => worldOf(app.game) !== 'home' && !app.game.s.scenario, draw: (app, x, y, room) => isleSlip(app, x, y, room) });

// ------------------------------------------------------------------ the ground's hover tags

/** What the mouse is over on the island's own ground (for the hover's key), or null. */
export function isleTileKey(g: Game, x: number, y: number): string | null {
  const ch = g.chunkAt(x, y);
  if (ch && isSky(g, ch.id)) return 'sky' + ch.id;
  if (!g.owned(x, y)) return null;
  if (rubbleAt(g, x, y)) return `r${x},${y}`;
  if (ventAt(g, x, y)) return `v${x},${y}`;
  return null;
}

/** The short tag for the island's ground at (x, y); true if it drew one. */
export function isleTileTip(app: App, x: number, y: number, at: TipPlace): boolean {
  const g = app.game;
  const ui = app.ui;
  const ch = g.chunkAt(x, y);
  if (ch && isSky(g, ch.id)) {
    ui.tip([{ text: '{big:Sky}' }, { text: `{soft:${islandDef(g).name} has no land here}` }], 170, at);
    return true;
  }
  if (!g.owned(x, y)) return false;
  if (rubbleAt(g, x, y)) {
    const p = rubblePrice(x, y);
    const afford = g.s.coin.gte(p);
    ui.tip([{ text: '{big:Rubble}' }, { text: `{k:LMB} Clear · {coin:${p.toLocaleString('en-US')}}` }, { text: afford ? '{soft:then build on it}' : '{bad:not enough coin yet}' }], 170, at);
    return true;
  }
  if (ventAt(g, x, y)) {
    ui.tip([{ text: '{big:A Vent}' }, { text: 'beside it: {good:no power, no fuel}' }, { text: 'no belt beside it: {bad:it melts}' }, { text: '{soft:feed machines here face to face}' }], 190, at);
    return true;
  }
  return false;
}

// ------------------------------------------------------------------ the Old Works' events

/** Toasts and sounds for the island's commands (called with each frame's events, app.ts). */
export function isleEvents(app: App, evs: GameEvent[]) {
  for (const e of evs) {
    if (e.type === 'repair') {
      const name = e.id && e.id in BUILD ? BUILD[e.id as keyof typeof BUILD].name : 'Machine';
      app.audio.sfx('buy', 0.7);
      app.toast(`${name} repaired`, `${e.value ? `{coin:${e.value.toLocaleString('en-US')}} · ` : ''}it keeps its recipe · no research`, C.brass2, 'build');
    } else if (e.type === 'clear') app.audio.sfx('buy', 0.4);
  }
}

/** The Old Works' whole lines: its ruins in groups of touching footprints (with their belts and
 * heaps), the groups of three or more machines being the lines. */
function ruinLines(): RuinDef[][] {
  const ruins = WORLDS.oldworks.ruins ?? [];
  const size = (r: RuinDef) => (BUILD[r.kind].w ?? 1);
  const touch = (a: RuinDef, b: RuinDef) => {
    const sa = size(a), sb = size(b);
    const dx = Math.max(a.x - (b.x + sb - 1), b.x - (a.x + sa - 1), 0), dy = Math.max(a.y - (b.y + sb - 1), b.y - (a.y + sa - 1), 0);
    return dx + dy === 1 || (dx === 0 && dy === 0);
  };
  const group = ruins.map((_, i) => i);
  const find = (i: number): number => (group[i] === i ? i : (group[i] = find(group[i])));
  for (let i = 0; i < ruins.length; i++) for (let j = i + 1; j < ruins.length; j++) if (touch(ruins[i], ruins[j])) group[find(i)] = find(j);
  const by = new Map<number, RuinDef[]>();
  ruins.forEach((r, i) => { const k = find(i); by.set(k, [...(by.get(k) ?? []), r]); });
  return [...by.values()].filter((g) => g.filter((r) => r.ruined).length >= 3);
}
const LINES = ruinLines();

const watch = { game: null as Game | null, run: -1, ran: new Set<number>(), at: 0 };

/** Twice a second on the Old Works: a banner when a whole ruined line runs again. */
export function isleFrame(app: App) {
  const g = app.game;
  if (worldOf(g) !== 'oldworks' || g.s.scenario) return;
  if (app.ui.time < watch.at) return;
  watch.at = app.ui.time + 0.5;
  const fresh = watch.game !== g || watch.run !== g.s.meta.runStart;
  if (fresh) { watch.game = g; watch.run = g.s.meta.runStart; watch.ran = new Set(); }
  LINES.forEach((line, i) => {
    if (watch.ran.has(i)) return;
    const ms = line.filter((r) => r.ruined).map((r) => g.entAt(r.x, r.y));
    const runs = ms.every((m, k) => m && m.kind === line.filter((r) => r.ruined)[k].kind && !m.ruined && m.crafts > 0);
    if (!runs) return;
    watch.ran.add(i);
    // a line already running when this save came up is not news
    if (fresh) return;
    const last = line.filter((r) => r.ruined).at(-1)!;
    const out = last.recipe ? RECIPE[last.recipe]?.outputs[0]?.item : null;
    app.audio.sfx('fanfare', 0.7);
    banner(app, 'THE OLD LINE RUNS!', `${out ? itemName(out).toLowerCase() : 'its goods'} again, as the Old Works made it`, C.brass2);
    const fx = app.renderer.fx;
    for (const r of line) fx.burst(r.x * TILE + 8, r.y * TILE + 8, 10, [C.brass2, C.bone, C.moss3, C.lamp2], 60, 60, 1, 1);
    const cx = line.reduce((n, r) => n + r.x, 0) / line.length, cy = line.reduce((n, r) => n + r.y, 0) / line.length;
    fx.ring(cx * TILE + 8, cy * TILE + 8, C.brass2, 48, 0.9, 6);
    fx.kick(3);
  });
}
