// Act III's pieces on the existing floors and HUD (DESIGN.md §21; docs/endgame.md Milestone 7):
// - the Chute Mouths' look on the Workshop: the status pip (pushing green, empty yellow naming its
//   item in the report, blocked red and blinking, no item grey) and the work cycle only while it
//   pushes (src/app/mouths.ts smooths the sim's per-tick state). The Renderer draws every other
//   building; a Chute Mouth is a logistics piece to it (no pip, always animated), so its pip and
//   still frame are laid over it here, in world pixels, before the HUD.
// - the Factory Chute in hand: picked from the wheel's Trunk petal, a ghost follows the mouse on
//   the Factory floor, a left click places it, a right click or Esc drops it.
// - a Chute Mouth just placed pins its report, so its item picker is the next thing seen.
// - watchers: a Challenge won (toast, banner, fanfare), a Scenario's new personal best.
// - two slips under the Purse (registerCounter): the Challenge under way (its rule, its goal and a
//   labelled Give up that asks twice), and the Scenario board (its twist, its best fold, and a
//   labelled way back to the town).
// Called once a frame from the wheel's frame hook (wheelFrameStart), before the HUD draws.
import { C, rgba } from '../data/palette';
import { CHALLENGES, type ChallengeId } from '../data/challenges';
import type { ScenarioId } from '../data/scenarios';
import { textWidth, smallWidth, ICON } from '../ui/font';
import { richWidth } from '../ui/rich';
import { T } from '../ui/theme';
import { sheet, drawRot, itemIcon } from '../render/sprites';
import { TILE } from '../render/ground';
import { drawPip } from '../render/pips';
import { handChute } from '../render/factory';
import { fplaceRefusal } from '../sim/systems/modules';
import { scenarioOf } from '../sim/scenario';
import type { Game } from '../sim/Game';
import { slip, button, tag, tagSize } from './chrome';
import { registerCounter } from './topbar';
import { banner } from './hud';
import { sampleMouth, type MouthLook } from './mouths';
import { noteBest, records, scoreText, backToTown, twist, liveBest } from './scenarios';
import type { App } from './app';

// ------------------------------------------------------------------ the frame

export function act3Frame(app: App) {
  if (app.screen !== 'play') return;
  chuteHand(app);
  if (!app.panel && app.floor === 'workshop') mouths(app);
  watch(app);
}

// ------------------------------------------------------------------ Chute Mouths on the Workshop

const PIP: Record<MouthLook, string> = { push: C.pipGreen, empty: C.pipYellow, blocked: C.pipRed, unset: C.pipGrey };
/** when each Chute Mouth was first seen (a building drops in for its first moments: no overlay) */
const firstSeen = new Map<number, number>();
let seenGame: Game | null = null;

function mouths(app: App) {
  const g = app.game;
  const r = app.renderer;
  const ctx = app.ui.ctx;
  const now = app.ui.time;
  const fresh = seenGame !== g;
  if (fresh) { firstSeen.clear(); seenGame = g; }
  const list = g.s.ents.filter((e) => e.kind === 'chuteMouth');
  if (!list.length) return;
  const z = r.cam.zoom;
  const { ox, oy } = r.origin();
  const s = sheet('chute_mouth');
  ctx.save();
  ctx.setTransform(z, 0, 0, z, ox, oy);
  ctx.imageSmoothingEnabled = false;
  for (const e of list) {
    const look = sampleMouth(e, now);
    let t0 = firstSeen.get(e.id);
    if (t0 === undefined) {
      t0 = fresh ? -10 : now;
      firstSeen.set(e.id, t0);
      // just placed: pin its report, so the item picker is the next thing seen
      if (!fresh && !e.recipe && app.selected === null) app.selected = e.id;
    }
    if (now - t0 < 0.6) continue;
    const x = e.x * TILE, y = e.y * TILE;
    // stopped: the still frame over the Renderer's running cycle
    if (look !== 'push') drawRot(ctx, s, 0, x, y, e.rot);
    pip(ctx, x, y, PIP[look], look === 'blocked', r.time);
  }
  ctx.restore();
}

/** The status pip, as the Renderer draws every machine's (top-right 4x4; blocked blinks). */
function pip(ctx: CanvasRenderingContext2D, x: number, y: number, col: string, blink: boolean, time: number) {
  drawPip(ctx, x, y, col, blink, time);
}

// ------------------------------------------------------------------ the Factory Chute in hand

const hand = { on: false, floorAt: 0 };

/** Pick the Factory Chute up (the wheel's Trunk petal): the next left click on the floor puts it down. */
export function holdChute(app: App) {
  app.setMode({ k: 'idle' });
  hand.on = true;
  hand.floorAt = app.ui.time;
}

export const holdingChute = () => hand.on;

function chuteHand(app: App) {
  handChute.at = null;
  if (!hand.on) return;
  const inp = app.input;
  const drop = () => { hand.on = false; handChute.at = null; };
  if (app.floor !== 'factory' || app.panel || app.mode.k !== 'idle' || app.offlineJob) return drop();
  if (inp.wasPressed('cancel')) { inp.consume('cancel'); app.audio.sfx('close'); return drop(); }
  if (inp.mouse.pressed[2]) { inp.consumeMouse(2); app.audio.sfx('close'); return drop(); }
  const g = app.game;
  const t = app.hud.hoverTile;
  if (t) {
    const why = fplaceRefusal(g, 'chute', t.x, t.y);
    handChute.at = { x: t.x, y: t.y, ok: !why };
    // the click that picked it from the wheel must not also place it
    if (app.ui.clicked && app.ui.time - hand.floorAt > 0.15) {
      app.ui.eat();
      if (app.act({ k: 'fchute', x: t.x, y: t.y }).ok) {
        app.audio.sfx('place');
        app.toast('The Factory Chute', '{u:chute} trunk goods into it · a Chute Mouth on the Workshop pushes them out', C.gold, 'chute');
        drop();
      }
    }
  }
  // what is in hand, beside the cursor
  const ui = app.ui;
  const s = '{u:chute} Factory Chute  {k:LMB} place  {k:RMB} drop';
  const sz = tagSize(richWidth(s), 9, 'left');
  const x = Math.min(ui.w - sz.w - 4, ui.mx + 14), y = Math.min(ui.h - sz.h - 4, ui.my + 12);
  ui.later(() => {
    const r = tag(ui, x, y, sz.w, sz.h, { hole: 'left', blocking: false });
    ui.rich(s, r.x, r.y, Infinity, T.ink);
  });
}

// ------------------------------------------------------------------ watchers

const watched = { game: null as Game | null, won: 0 };

function watch(app: App) {
  const g = app.game;
  const won = g.s.meta.challenges ?? [];
  if (watched.game !== g) { watched.game = g; watched.won = won.length; }
  else if (won.length > watched.won) {
    for (const id of won.slice(watched.won)) {
      const c = CHALLENGES[id as ChallengeId];
      if (!c) continue;
      app.audio.sfx('fanfare', 0.8);
      app.renderer.fx.kick(4);
      banner(app, 'CHALLENGE WON!', `${c.name} · ${c.reward}`, C.violet);
      app.toast(`${c.name}: won!`, `{good:${ICON.check}} ${c.reward}`, C.violet, 'star');
    }
    watched.won = won.length;
  }
  // a Scenario's best fold beating the record on file
  const d = scenarioOf(g);
  if (d && g.s.tick % 10 === 0) {
    const b = liveBest(g);
    if (b) {
      const name = g.design(b.design)?.name;
      if (noteBest(d.id, { score: b.score, grade: b.grade, date: Date.now(), design: name })) {
        app.audio.sfx('fanfare', 0.7);
        banner(app, 'NEW BEST!', `${d.name} · ${scoreText(b.score)} ${d.unit}`, C.gold);
        app.toast('A new personal best', `${scoreText(b.score)} ${d.unit} · grade ${b.grade}`, C.gold, 'trophies');
      }
    }
  }
}

// ------------------------------------------------------------------ the slips under the Purse

/** A Challenge's rule and goal in a few words (Pip capitals), for the slip. */
const SHORT: Record<ChallengeId, [string, string]> = {
  noSplitters: ['no Splitters', 'Gizmo Festival'],
  handsOff: ['clicks do nothing', 'Folding'],
  leanPower: ['power ×0.5', 'Circuits'],
  threeKinds: ['3 kinds of machine', 'a fold at S'],
  smallBoxes: ['boxes 4×4', 'Gizmo Festival'],
};

const quit = { armedUntil: -1 };
const SLIP_H = 26;

/** A slip under the Purse: line 1 its name (after an 8 px icon) with a button at the right, line 2
 * small capitals in up to three inks. Returns its width, the button's click and the hover. */
function counterSlip(app: App, id: string, x: number, y: number, name: string, nameInk: string, icon: (x: number, y: number) => void,
  parts: [string, string][], btn: string, tip: { text: string }[], btnTip: { text: string }[], pulse = false): { w: number; click: boolean; over: boolean } {
  const ui = app.ui;
  const bw = textWidth(btn) + 12;
  const line2 = parts.map(([t]) => t).join(' ');
  const w = Math.max(10 + textWidth(name) + 6 + bw, smallWidth(line2)) + 12;
  const r = slip(ui, x, y, w, SLIP_H, { blocking: true });
  ui.mark(id, x, y, w, SLIP_H);
  icon(r.x, y + 4);
  ui.text(name, r.x + 10, y + 4, nameInk);
  let lx = r.x;
  for (const [t, ink] of parts) lx += ui.small(t, lx, y + 16, ink) + smallWidth(' ');
  const over = ui.hover(x, y, w - bw - 6, SLIP_H);
  ui.hint(x, y, w - bw - 6, SLIP_H, tip, 220);
  const click = button(ui, id + 'Btn', x + w - bw - 5, y + 3, bw, 13, btn, { pulse, tip: btnTip });
  return { w, click, over };
}

/** The slip for the Challenge under way: its name, its rule then its goal, and Give up (two clicks). */
function challengeSlip(app: App, x: number, y: number): number {
  const ui = app.ui;
  const id = app.game.s.challenge as ChallengeId;
  const c = CHALLENGES[id];
  if (!c) return 0;
  const [rule, goal] = SHORT[id] ?? [c.rule, c.goalText];
  const armed = ui.time < quit.armedUntil;
  const r = counterSlip(app, 'challengeSlip', x, y, c.name, T.reset, (ix, iy) => { ui.ctx.fillStyle = T.reset; ui.ctx.fillRect(ix + 1, iy + 2, 5, 5); },
    [[rule.toUpperCase(), T.bad], ['→', T.inkSoft], [goal.toUpperCase(), T.good]],
    armed ? 'Sure?' : 'Give up',
    [{ text: `{big:${c.name}}` }, { text: `{bad:the rule} ${c.rule}` }, { text: `{good:the goal} ${c.goalText}` }, { text: `{coinc:the reward} ${c.reward}` }],
    armed ? [{ text: '{bad:click again} · the run goes on ordinary' }, { text: '{soft:no reward · Patents as ever}' }] : [{ text: '{u:remove} give the Challenge up' }, { text: '{soft:two clicks · the first asks}' }],
    armed);
  if (r.click) {
    if (!armed) quit.armedUntil = ui.time + 4;
    else {
      quit.armedUntil = -1;
      if (app.act({ k: 'challengeQuit' }).ok) app.toast('Challenge given up', `${c.name} · the run goes on as an ordinary one`, C.violet, 'star');
    }
  }
  return r.w;
}

registerCounter({ id: 'challenge', show: (app) => !!app.game.s.challenge && !!CHALLENGES[app.game.s.challenge as ChallengeId], draw: (app, x, y) => challengeSlip(app, x, y) });

/** The slip for the Scenario board: its name, its best fold now and the record on file, and the
 * way back to the town; a click on it opens the Scenarios page. */
function scenarioSlip(app: App, x: number, y: number): number {
  const ui = app.ui;
  const g = app.game;
  const d = scenarioOf(g);
  if (!d) return 0;
  const best = liveBest(g);
  const rec = records()[d.id as ScenarioId];
  const beat = !!best && (!rec || best.score >= rec.score - 1e-9);
  const parts: [string, string][] = [[(best ? `BEST ${scoreText(best.score)}` : 'NO FOLD YET') + (rec ? ',' : ''), beat ? T.coin : T.inkSoft]];
  if (rec) parts.push([`RECORD ${scoreText(rec.score)}`, T.inkSoft]);
  const date = rec ? new Date(rec.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '';
  const r = counterSlip(app, 'scenarioSlip', x, y, d.name, T.ink, (ix, iy) => ui.ctx.drawImage(itemIcon(d.product), ix, iy),
    parts, 'To town',
    [{ text: `{big:${d.name}}` }, { text: `{reset:the twist} ${twist(g, d)}` }, { text: `{soft:scored by} ${d.unit}` },
      { text: best ? `{good:best fold} ${scoreText(best.score)} · grade ${best.grade}` : `{soft:fold a line of} {i:${d.product}} {soft:to score}` },
      ...(rec ? [{ text: `{coinc:record} ${scoreText(rec.score)} · ${date}` }] : []), { text: '{k:LMB} the Scenarios page' }],
    [{ text: '{u:workshop} back to your town' }, { text: '{soft:this board is saved where it stands}' }]);
  if (r.over && ui.clicked) { ui.eat(); app.togglePanel('scenarios'); }
  if (r.click) backToTown(app);
  return r.w;
}

registerCounter({ id: 'scenario', show: (app) => !!scenarioOf(app.game), draw: (app, x, y) => scenarioSlip(app, x, y) });
