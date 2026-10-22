// Lesson cards on firsts (Milestone 13, ROADMAP.md "Onboarding, UX and accessibility"): the first
// time a save meets each idea (a starved machine, a slag jam, a fold, the Factory floor, a trunk, a
// brownout, a Reorganize, a District route, a short route) a small card pinned at the top of the
// screen names it in two or three short lines beside a picture of the thing, with an OK button.
// Once per save (by its seed, kept with the settings, never in the sim's state: a Reorganize clears
// the sim's flags); queued, one at a time, never over a celebration, a page or the wheel; Options
// turns them off. Triggers are the sim's events (src/engine/events.ts) and a look at the state
// twice a second; nothing here writes the game.
import { C } from '../data/palette';
import type { GameEvent } from '../engine/events';
import { bigWidth, BIG_LINE_H } from '../ui/font';
import { layoutRich, drawLayout } from '../ui/rich';
import { T } from '../ui/theme';
import { sheet, hasArt, frameAt } from '../render/sprites';
import { drawPipShape, PIP_MEANING, type PipShape } from '../render/pips';
import { routeCap, routeWant } from '../sim/systems/high';
import { FACTORY } from '../data/land';
import type { Game } from '../sim/Game';
import { button, tag, tagPad, tagSize, uiIcon, type UIconName } from './chrome';
import { zones } from './tags';
import { lessonsOn, lessonsSeen, saveLessonsSeen } from './settings';
import { wheelOpen } from './wheel';
import type { Rect } from '../ui/ui';
import type { Layout } from './layout';
import type { App } from './app';

export type LessonId = 'starved' | 'slag' | 'fold' | 'factory' | 'trunk' | 'brownout' | 'reorganize' | 'route' | 'shortRoute';

interface LessonDef {
  title: string;
  /** two or three short lines, rich text */
  lines: string[];
  /** the picture: a sprite sheet (drawn at 2x), or a UI icon */
  art?: string;
  icon?: UIconName;
  /** a status pip drawn on the picture's corner */
  pip?: PipShape;
}

export const LESSONS: Record<LessonId, LessonDef> = {
  starved: {
    title: 'Starved', art: 'smelter', pip: 'starved',
    lines: ['{pip:starved} it waits on an input', 'feed it more: a Miner, a feeder', 'hover it: what it is short of'],
  },
  slag: {
    title: 'A slag jam', art: 'heap', pip: 'blocked',
    lines: ['{i:slag} leaves a smelter by a side', 'nowhere to go: it stops {pip:blocked}', 'a Slag Heap beside it · {k:LMB} shovel'],
  },
  fold: {
    title: 'Folded!', art: 'module',
    lines: ['the line is a design: one tile', 'its rates × its grade', 'place copies on the Factory {k:Tab}'],
  },
  factory: {
    title: 'The Factory floor', art: 'module', pip: 'work',
    lines: ['modules run as rates, not items', 'a gold front feeds a back', 'the Factory Dock buys what arrives'],
  },
  trunk: {
    title: 'Trunks', art: 'trunk',
    lines: [`front to back · ${FACTORY.trunkSpeed * 60}/min at most`, 'one trunk feeds one module', 'waste leaves by a side trunk'],
  },
  brownout: {
    title: 'A brownout', art: 'pole', pip: 'power',
    lines: ['more kW wanted than made', 'the whole grid slows {pip:power}', 'an engine more, or fuel its Boiler'],
  },
  reorganize: {
    title: 'A fresh start', icon: 'reset',
    lines: ['Patents and the Drawer stay', 'buy a head start: the Patent Office', 'each run goes quicker'],
  },
  route: {
    title: 'Skiff routes', art: 'skiff',
    lines: ['a skiff carries one item a trip', 'far apart: fewer a second', 'click a route for its card'],
  },
  shortRoute: {
    title: 'A short route', art: 'skiff', pip: 'starved',
    lines: ['less than its group makes {pip:starved}', '+ skiff on its card', 'or move the two groups closer'],
  },
};

/** the order they are checked in (a queue keeps them in the order they happened) */
const ORDER = Object.keys(LESSONS) as LessonId[];

// ------------------------------------------------------------------ state (the app's, not the sim's)

const S = {
  seed: NaN as number,
  game: null as Game | null,
  seen: new Set<string>(),
  queue: [] as LessonId[],
  shown: null as LessonId | null,
  shownAt: 0,
  /** the UI time the last card was put away (the next waits a moment) */
  closedAt: -10,
  pollAt: 0,
  /** e2e: lessons held off (the HUD audit's states), unless a state asks for one */
  held: false,
  /** the card's rect last frame (the floor's tags keep off it) */
  rect: null as Rect | null,
  /** e2e: the next card shows at rest, without its drop */
  instant: false,
};

/** The lessons a save already past them has learnt (an old save loaded for the first time since
 * lessons came, or a later run): read from its state, so a 20 h factory is not taught a belt. */
export function pastLessons(g: Game): LessonId[] {
  const runs = g.s.meta.runs;
  const out: LessonId[] = [];
  if (runs > 0 || g.machines.filter((m) => m.kind !== 'furnace' && m.kind !== 'miner').length >= 4) out.push('starved');
  if (runs > 0 || g.flag('jam:slag') || g.done('slagBricks')) out.push('slag');
  if (runs > 0 || g.s.designs.length > 0) out.push('fold');
  if (g.flag('factorySeen')) out.push('factory');
  if (g.s.factory.ents.some((e) => e.kind === 'trunk') || (runs > 0 && g.flag('factorySeen'))) out.push('trunk');
  if (g.s.ents.filter((e) => e.kind === 'pole').length >= 2) out.push('brownout');
  if (runs > 0) out.push('reorganize');
  const routes = g.s.district?.routes.length ?? 0;
  if (routes > 0) out.push('route');
  if (routes > 2) out.push('shortRoute');
  return out;
}

/** Keep the seen set on the save on screen (a new game, a load, a Scenario board). */
function sync(app: App) {
  const g = app.game;
  if (S.game === g && S.seed === g.s.seed) return;
  S.game = g;
  S.seed = g.s.seed;
  S.queue = [];
  S.shown = null;
  const stored = lessonsSeen(g.s.seed);
  S.seen = new Set(stored ?? pastLessons(g));
  if (!stored) saveLessonsSeen(g.s.seed, [...S.seen]);
}

/** Queue a lesson unless this save has had it. */
export function teach(app: App, id: LessonId) {
  sync(app);
  if (S.seen.has(id) || S.shown === id || S.queue.includes(id)) return;
  S.queue.push(id);
}

/** The sim's events that are firsts (called with each frame's events, src/app/app.ts). */
export function lessonEvents(app: App, evs: GameEvent[]) {
  if (app.game.s.scenario) return;
  for (const e of evs) {
    if (e.type === 'firstSlagJam') teach(app, 'slag');
    else if (e.type === 'firstFold' || (e.type === 'fold' && (e.floor ?? 'workshop') === 'workshop')) teach(app, 'fold');
    else if (e.type === 'reorganize') teach(app, 'reorganize');
    else if (e.type === 'firstRoute') teach(app, 'route');
  }
}

/** Twice a second, the firsts that are states rather than events. */
function poll(app: App) {
  const g = app.game;
  if (g.s.scenario) return;
  if (g.has('bellows') && g.machines.some((m) => m.state === 'starved' && !m.paused && m.why && m.why !== 'crank' && m.why !== 'power' && m.kind !== 'furnace' && m.hist.endsWith('sss'))) teach(app, 'starved');
  if (app.floor === 'factory') teach(app, 'factory');
  if (g.s.factory.ents.some((e) => e.kind === 'trunk')) teach(app, 'trunk');
  if (g.grids.some((gr) => gr.demand > 0 && gr.sat > 0 && gr.sat < 0.999)) teach(app, 'brownout');
  const d = g.s.district;
  if (d && d.routes.some((r) => r.skiffs > 0 && routeCap(g, 'district', r) < 0.9 * routeWant(g, 'district', r))) teach(app, 'shortRoute');
}

/** A card may show now: in play, no page, no wheel, no celebration, no offline run. */
function clear(app: App): boolean {
  return app.screen === 'play' && !app.panel && !wheelOpen(app) && !app.offlineJob && !app.hud.celebs.length && !app.trophyPops.length && !app.renderer.parade;
}

/** the zone lessonZones handed out this frame (the card does not keep off itself) */
let ownZone: Rect | null = null;

/** The card's rect last frame, for the floor's tags and reports to keep off. */
export function lessonZones(): Rect[] {
  ownZone = S.rect ? { x: S.rect.x - 2, y: S.rect.y - 2, w: S.rect.w + 4, h: S.rect.h + 4 } : null;
  return ownZone ? [ownZone] : [];
}

const CARD_W = 220;
const ART = 34;

/** Each frame in play (src/app/hud.ts): watch for firsts, and show the card at the head of the
 * queue, pinned at the top of the screen. */
export function lessonFrame(app: App, L: Layout) {
  const ui = app.ui;
  S.rect = null;
  sync(app);
  if (ui.time >= S.pollAt) { S.pollAt = ui.time + 0.5; poll(app); }
  if (!lessonsOn() || S.held) return;
  if (!S.shown) {
    if (!S.queue.length || ui.time - S.closedAt < 1.5 || !clear(app)) return;
    S.shown = S.queue.shift()!;
    S.shownAt = S.instant ? ui.time - 1 : ui.time;
    S.instant = false;
    S.seen.add(S.shown);
    saveLessonsSeen(S.seed, [...S.seen]);
    app.audio.sfx('codex', 0.3, 1.25);
  }
  // put away (not lost) while something louder has the screen
  if (!clear(app)) return;
  drawCard(app, L, S.shown);
}

function drawCard(app: App, L: Layout, id: LessonId) {
  const ui = app.ui;
  const d = LESSONS[id];
  const w = Math.min(CARD_W, ui.w - 2 * (L.purse.x + L.purse.w) - 8);
  const [pl, , pr] = tagPad('left');
  const inner = w - pl - pr;
  const cw = inner - ART - 6;
  const lays = d.lines.map((s) => layoutRich(s, cw));
  const textH = BIG_LINE_H + 2 + lays.reduce((n, l) => n + l.h, 0) + 2 + 15;
  const sz = tagSize(inner, Math.max(ART + 2, textH), 'left');
  // top centre, under anything the HUD holds there this frame (the District's tool strip)
  let y = 6;
  const x = Math.floor((ui.w - sz.w) / 2);
  for (const z of zones) if (z !== ownZone && z.x < x + sz.w && z.x + z.w > x && z.y < 40) y = Math.max(y, z.y + z.h + 4);
  // it drops in
  const k = Math.min(1, (ui.time - S.shownAt) / 0.2);
  const yy = Math.round(y - (1 - k) * (y + sz.h));
  S.rect = { x, y, w: sz.w, h: sz.h };
  ui.mark('lessonCard', x, yy, sz.w, sz.h);
  const r = tag(ui, x, yy, sz.w, sz.h, { hole: 'left', pin: true, blocking: true });
  // the picture in a well
  const ax = r.x, ay = r.y + 1;
  ui.panel(ax, ay, ART, ART, 'inset', false);
  if (d.art && hasArt(d.art)) {
    const s = sheet(d.art);
    const kk = Math.max(1, Math.min(2, Math.floor((ART - 2) / Math.max(s.w, s.h))));
    ui.ctx.drawImage(s.frames[frameAt(s, ui.time)], ax + Math.floor((ART - s.w * kk) / 2), ay + Math.floor((ART - s.h * kk) / 2), s.w * kk, s.h * kk);
  } else uiIcon(ui, d.icon ?? 'star', ax + Math.floor((ART - 16) / 2), ay + Math.floor((ART - 16) / 2));
  if (d.pip) drawPipShape(ui.ctx, ax + ART - 8, ay + 3, d.pip, PIP_MEANING.find((p) => p[0] === d.pip)![2]);
  // the title and the lines
  const tx = ax + ART + 6;
  if (bigWidth(d.title) <= cw) ui.big(d.title, tx, r.y, T.ink);
  else ui.text(d.title, tx, r.y + 2, T.ink);
  let ty = r.y + BIG_LINE_H + 2;
  for (const l of lays) { drawLayout(ui, l, tx, ty, T.ink); ty += l.h; }
  // OK, at the foot's right
  const bw = 34;
  if (button(ui, 'lessonOk', r.x + r.w - bw, r.y + r.h - 15, bw, 15, 'OK', { tip: [{ text: '{k:LMB} got it' }, { text: '{soft:Options turns lesson cards off}' }] })) {
    S.shown = null;
    S.closedAt = ui.time;
  }
  void C;
}

// ------------------------------------------------------------------ e2e and the debug handle

/** For the e2e scripts (App.onboarding): hold cards off, or show one now. */
export const lessonDebug = {
  hold(on: boolean) { S.held = on; },
  show(app: App, id: LessonId) { sync(app); S.seen.delete(id); S.queue = [id]; S.shown = null; S.closedAt = -10; S.held = false; S.instant = true; },
  get shown() { return S.shown; },
  get queue() { return S.queue.slice(); },
  ids: ORDER,
};
