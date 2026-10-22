// The Challenges page (DESIGN.md §21, §24; Milestone 11's screens): all fifteen, by act, each with
// its state (won, under way, open for the next run, or shut with what it needs), its rule, its goal,
// its reward and how far the run under way has got. Opened from the Reorganize card's "next run"
// strip (where "Take it next run" picks one and goes back to the contract) and from the Challenge
// slip under the Purse (the one under way, with its Give up). Ink on paper, the page kit.
import { C, rgba } from '../data/palette';
import { CHALLENGES, CHALLENGE_IDS, CHALLENGE_AFTER_RUNS, type ChallengeId } from '../data/challenges';
import { cosmeticDef, COSMETICS } from '../data/cosmetics';
import { won, challengeRefusal, challengeProgress } from '../sim/systems/challenges';
import { ICON, bigWidth, ellipsize, smallWidth, textWidth } from '../ui/font';
import { drawRich, richHeight, richWidth } from '../ui/rich';
import { T } from '../ui/theme';
import { button, meter, rule } from './chrome';
import { menuTemplate } from './widgets';
import { caption, speaker } from './screens';
import { pickNextRun, nextRunPick } from './reorganize';
import type { App } from './app';
import type { Rect } from '../ui/ui';

/** The act each Challenge is meant for (the first five predate `act`: Act I's goals, and Lean
 * Power's circuits, Act II's). */
export const challengeAct = (id: ChallengeId): 1 | 2 | 3 | 4 => CHALLENGES[id].act ?? (id === 'leanPower' ? 2 : 1);
const ROMAN = ['', 'I', 'II', 'III', 'IV'];

/** A Challenge's rule and goal in a few words (for the slip under the Purse and the list). */
export const SHORT: Record<ChallengeId, [string, string]> = {
  noSplitters: ['no Splitters', 'the Gizmo Festival'],
  handsOff: ['clicks do nothing', '200 Gizmos'],
  leanPower: ['power x0.5', '300 circuits'],
  threeKinds: ['3 kinds of machine', 'a fold at S'],
  smallBoxes: ['boxes 4x4 at most', 'the Gizmo Festival'],
  cleanHands: ['no Slag Heaps', '400 concrete'],
  mk1Only: ['no Mk2 machines', '100 motors'],
  handMade: ['no stamping', '8 Factory modules'],
  strictInspector: ['grades one lower', 'a fold at A'],
  beltBudget: ['60 belt tiles', '1,000 steel'],
  headwinds: ['skiffs half speed', '30 robot arms'],
  shortHaul: ['routes 5 tiles', '10 Engineers'],
  zoningFreeze: ['no District lots', 'the Specimen Drawer'],
  roughSeas: ['barges carry 1', '10 World modules'],
  lightFleet: ['3 carriers a route', 'a Megaproject stage'],
};

export type ChallengeState = 'won' | 'running' | 'open' | 'shut';

export function challengeState(app: App, id: ChallengeId): ChallengeState {
  const g = app.game;
  if (won(g, id)) return 'won';
  if (g.s.challenge === id) return 'running';
  return challengeRefusal(g, id) ? 'shut' : 'open';
}

const st = { sel: null as ChallengeId | null, from: null as 'reorganize' | null, armedUntil: -1 };

/** Open the page on one Challenge (from: the page to go back to). */
export function openChallenges(app: App, sel: ChallengeId | null, from: 'reorganize' | null = null) {
  st.sel = sel;
  st.from = from;
  app.panel = 'challenges';
  app.audio.sfx('open');
}

const MARK: Record<ChallengeState, string> = { won: `{good:${ICON.check}}`, running: `{reset:${ICON.star}}`, open: `{soft:${ICON.pip}}`, shut: '{u:lock}' };
const STATE_CHIP: Record<ChallengeState, string> = { won: '{chip:good:WON}', running: '{chip:reset:UNDER WAY}', open: '{chip:soft:OPEN}', shut: '{chip:soft:SHUT}' };

/** The skin a Challenge also pays. */
const skinOf = (id: ChallengeId) => COSMETICS.find((c) => c.source.k === 'challenge' && c.source.id === id);

/** The page (drawn from screens.ts's switch: a page imported by screens.ts must not register while
 * screens.ts is still loading). */
export function challengesPage(app: App, r: Rect) {
  const ui = app.ui;
  const g = app.game;
  const side = Math.min(206, Math.floor(r.w * 0.4));
  const { body, detail } = menuTemplate(app, r, { title: 'Challenges', accent: C.violet, icon: 'star', detail: side });
  const nWon = CHALLENGE_IDS.filter((id) => won(g, id)).length;
  if (!st.sel || !CHALLENGES[st.sel]) st.sel = (g.s.challenge as ChallengeId | null) ?? nextRunPick() ?? CHALLENGE_IDS.find((id) => challengeState(app, id) === 'open') ?? CHALLENGE_IDS[0];
  // ---- the list, by act
  const x = body.x + 2, w = body.w - 4;
  let y = body.y + 1;
  const acts = [1, 2, 3, 4] as const;
  const rows = CHALLENGE_IDS.length + acts.length;
  const rh = Math.max(12, Math.min(16, Math.floor((body.h - 12) / rows)));
  const cap = [`${nWon} of ${CHALLENGE_IDS.length} won, a rule until its goal, then a reward for good`, `${nWon} of ${CHALLENGE_IDS.length} won, a rule until its goal`, `${nWon} of ${CHALLENGE_IDS.length} won`].find((q) => smallWidth(q.toUpperCase()) <= w) ?? '';
  caption(ui, cap, x, y);
  y += 11;
  for (const a of acts) {
    const list = CHALLENGE_IDS.filter((id) => challengeAct(id) === a);
    if (!list.length) continue;
    if (y + rh > body.y + body.h) break;
    caption(ui, `act ${ROMAN[a]}`, x, y + Math.floor((rh - 7) / 2), T.reset);
    y += rh;
    for (const id of list) {
      if (y + rh > body.y + body.h) break;
      const c = CHALLENGES[id];
      const s = challengeState(app, id);
      const on = st.sel === id;
      const hov = ui.hover(x, y, w, rh - 1);
      ui.mark('challenge:' + id, x, y, w, rh - 1);
      ui.region(x, y, w, rh - 1, 'button', false);
      if (on || hov) {
        ui.fill(x, y, w, rh - 1, on ? T.paperHi : rgba(T.paperLo, 0.6));
        if (on) ui.fill(x, y, 2, rh - 1, T.reset);
      }
      const ty = y + Math.floor((rh - 1 - 9) / 2);
      drawRich(ui, MARK[s], x + 4, ty, Infinity, T.ink);
      const [rule1, goal1] = SHORT[id];
      const right = `${rule1.toUpperCase()} → ${goal1.toUpperCase()}`;
      const nameW = Math.min(textWidth(c.name), Math.max(60, Math.floor(w * 0.42)));
      ui.text(ellipsize(c.name, nameW), x + 16, ty, s === 'shut' ? T.inkSoft : T.ink);
      const rx = x + 16 + nameW + 8, rw = x + w - 3 - rx;
      if (rw > 30) {
        const shown = smallWidth(right) <= rw ? right : smallWidth(rule1.toUpperCase()) <= rw ? rule1.toUpperCase() : '';
        if (shown) ui.small(shown, x + w - 3, ty + 2, s === 'shut' ? rgba(T.inkSoft, 0.8) : T.inkSoft, { align: 'right' });
      }
      if (hov) {
        ui.tip([{ text: `{big:${c.name}}` }, { text: `{bad:rule} ${c.rule}` }, { text: `{good:goal} ${c.goalText}` }], 200);
        if (ui.clicked) { ui.eat(); ui.sfx('click'); st.sel = id; st.armedUntil = -1; }
      }
      y += rh;
    }
  }
  sidePage(app, detail!);
}

/** The right page: the Challenge picked, in full, and what can be done with it now. */
function sidePage(app: App, dp: Rect) {
  const ui = app.ui;
  const g = app.game;
  const id = st.sel!;
  const c = CHALLENGES[id];
  const s = challengeState(app, id);
  const x = dp.x + 4, w = dp.w - 8;
  let y = dp.y + 2;
  const foot = 40;
  const end = dp.y + dp.h - foot;
  if (bigWidth(c.name) <= w) ui.big(c.name, x, y, T.ink);
  else ui.text(ellipsize(c.name, w), x, y + 1, T.ink);
  y += 15;
  drawRich(ui, `${STATE_CHIP[s]} {chip:reset:ACT ${ROMAN[challengeAct(id)]}}`, x, y, w, T.ink);
  y += 16;
  const block = (label: string, ink: string, text: string) => {
    if (y + 20 > end) return;
    caption(ui, label, x, y, ink);
    y += 9;
    const h = richHeight(text, w);
    if (y + h > end) return;
    y += drawRich(ui, text, x, y, w, T.ink) + 4;
  };
  block('the rule', T.bad, c.rule);
  block('the goal', T.good, c.goalText);
  const skin = skinOf(id);
  block('the reward, for good', T.coin, c.reward + (skin ? ` · and the ${cosmeticDef(skin.id)?.name ?? skin.id} skin` : ''));
  if (c.needs) {
    const met = (g.s.counters[c.needs.counter] ?? 0) >= 1;
    block('needs', met ? T.good : T.bad, `${met ? `{good:${ICON.check}}` : `{bad:${ICON.cross}}`} ${c.needs.text}`);
  }
  // how far the run under way has got
  if (s === 'running' && y + 22 <= end) {
    const p = challengeProgress(g, id);
    const v = p.want > 1 ? `${Math.floor(p.have).toLocaleString('en-US')}/${p.want.toLocaleString('en-US')}` : p.have >= p.want ? 'done' : 'not yet';
    caption(ui, 'this run', x, y, T.reset);
    y += 9;
    meter(ui, x, y + 2, w - textWidth(v) - 6, 6, p.want ? p.have / p.want : 0, { role: 'reset' });
    ui.text(v, x + w, y, T.ink, { align: 'right' });
    y += 14;
  }
  if (y + richHeight(`{soft:${c.flavor}}`, w) <= end) drawRich(ui, `{soft:${c.flavor}}`, x, y, w, T.inkSoft);
  // the keys along the foot
  const fy = dp.y + dp.h - 36;
  rule(ui, x, fy - 3, w, true);
  const why = challengeRefusal(g, id);
  const picked = nextRunPick() === id;
  if (s === 'running') {
    const armed = ui.time < st.armedUntil;
    if (button(ui, 'challengeGiveUp', x, fy, w, 16, armed ? 'Sure? Give up' : 'Give up', { pulse: armed, tip: armed ? [{ text: '{bad:click again} · the run goes on ordinary' }] : [{ text: '{u:remove} give it up · two clicks' }, { text: '{soft:no reward · Patents as ever}' }] })) {
      if (!armed) st.armedUntil = ui.time + 4;
      else { st.armedUntil = -1; if (app.act({ k: 'challengeQuit' }).ok) app.toast('Challenge given up', `${c.name} · the run goes on as an ordinary one`, C.violet, 'star'); }
    }
  } else if (s === 'won') {
    button(ui, 'challengeWon', x, fy, w, 16, 'Won · the reward is yours', { disabled: true });
  } else if (why) {
    // the refusal on one line (the needs are spelt out above): the sim's words when they fit
    const full = `{u:lock} {soft:${why.replace(/[{}]/g, '')}}`;
    const line = richWidth(full) <= w ? full : c.needs && why === c.needs.text ? '{u:lock} {soft:shut until it has what it needs}' : '{u:lock} {soft:not open for the next run}';
    drawRich(ui, line, x, fy + 3, Infinity, T.ink);
  } else if (button(ui, 'challengeTake', x, fy, w, 16, picked ? 'Next run: picked' : 'Take it next run', { gold: !picked, active: picked, tip: [{ text: `{big:${c.name}}` }, { text: 'the next Reorganize starts the run under its rule' }, { text: '{soft:sign the contract to begin}' }] })) {
    pickNextRun(id);
    app.panel = 'reorganize';
    app.audio.sfx('open');
  }
  const back = st.from === 'reorganize' || g.s.meta.runs >= CHALLENGE_AFTER_RUNS;
  if (back && button(ui, 'challengeBack', x, fy + 18, w, 16, 'The contract', { icon: 'reset', tip: '{u:reset} back to the Reorganize card' })) { app.panel = 'reorganize'; app.audio.sfx('open'); }
  void speaker;
}

