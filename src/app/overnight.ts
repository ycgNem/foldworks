// "Safe for overnight" (DESIGN.md §20; Milestone 6): before leaving, the player looks ahead 1, 8
// or 24 hours and sees which lines would jam and when, and what the time away would pay. The
// forecast is the offline model itself (src/sim/offline.ts) run on a copy of the game, so the
// morning's report and the evening's forecast are the same computation; it is spread over frames
// while the live factory keeps running. Each jam can be shown, or its line stopped (the 'pause'
// command, logged like any other): a stopped line takes nothing and makes nothing, so its Slag
// Heap keeps its room for when you are back. The Night Shift (coin for offline efficiency) is
// bought here too. Built with the existing kit (chrome.ts, widgets.ts, ui.ts) as it is.
import { C } from '../data/palette';
import { IDLE, IDLE_UPGRADES } from '../data/idle';
import { ICON } from '../ui/font';
import { frame, card, button, bar } from './chrome';
import { screenHeader } from './widgets';
import { duration, clock, pct } from '../engine/fmt';
import { Num } from '../engine/num';
import { forecast, offlineEfficiency, type OfflineRun, type OfflineReport } from '../sim/offline';
import { pausedCount, idleUpgradeRefusal } from '../sim/systems/pause';
import { entName } from '../sim/analysis';
import { fname } from '../sim/systems/modules';
import { fit, goTo, stepJob } from './offlinereport';
import type { App } from './app';
import type { Rect } from '../ui/ui';

interface Look {
  hours: number;
  job: OfflineRun | null;
  result: OfflineReport | null;
  /** the factory the result was forecast from (to say when it is out of date) */
  at: { version: number; fversion: number; paused: number; hours: number } | null;
}

const look: Look = { hours: IDLE.forecastHours.value, job: null, result: null, at: null };

/** Start a forecast of `hours` from the game as it is now. */
export function startForecast(app: App, hours = look.hours) {
  const g = app.game;
  look.hours = hours;
  look.job = forecast(g, hours);
  look.result = null;
  look.at = { version: g.version, fversion: g.fversion, paused: pausedCount(g), hours };
}

/** The forecast as it stands (for the debug handle and the e2e scripts). */
export function overnightState() {
  return look;
}

/** Has the factory changed since the forecast (a build, a fold, a stop)? */
function stale(app: App): boolean {
  const g = app.game;
  const a = look.at;
  return !!a && (a.version !== g.version || a.fversion !== g.fversion || a.paused !== pausedCount(g));
}

export function overnightScreen(app: App, r: Rect) {
  const ui = app.ui;
  const g = app.game;
  screenHeader(app, r, 'Safe for overnight', C.ice, 'clock');
  // a forecast running: a slice of it each frame (the live factory runs on meanwhile)
  if (look.job && stepJob(look.job)) {
    look.result = look.job.report;
    look.job = null;
  }
  const lw = Math.floor((r.w - 24) * 0.6);
  const a = card(ui, r.x + 8, r.y + 22, lw, r.h - 28, 'The forecast', C.ice, 'research');
  let y = a.y;
  // ---- how far to look, and the button
  ui.text('Look ahead:', a.x, y + 3, C.bone);
  let bx = a.x + 56;
  for (const hrs of [1, 8, 24]) {
    if (button(ui, 'onHours' + hrs, bx, y, 30, 13, `${hrs} h`, { active: look.hours === hrs })) look.hours = hrs;
    bx += 33;
  }
  if (button(ui, 'onRun', a.x + a.w - 70, y, 70, 13, look.job ? 'Looking...' : 'Forecast', { gold: !look.job, disabled: !!look.job, tip: 'Runs the factory ahead on a copy, through the offline model: the live game is not touched' })) startForecast(app);
  y += 18;
  if (look.job) {
    ui.text(`Looking ${look.job.counted / 3600} h ahead...`, a.x, y, C.bone);
    bar(ui, a.x, y + 11, a.w, 7, look.job.progress(), C.ice);
    y += 24;
  }
  const res = look.result;
  if (!res && !look.job) {
    y += ui.para('See which lines would jam while you are away, and when, before you go. The forecast runs your factory ahead through the same offline model that writes the report you get when you come back.', a.x, y, a.w, C.hull2);
    y += 4;
    ui.para('A line that would jam can be stopped: it takes nothing and makes nothing, so its Slag Heap keeps its room for when you are back. Start it again here.', a.x, y, a.w, C.hull2);
  }
  if (res) {
    const hrs = look.at?.hours ?? look.hours;
    ui.text(fit(`Closed for ${hrs} h: +${res.coin.format()} coin at ${pct(res.eff)}`, a.w), a.x, y, C.gold);
    y += 10;
    const more: string[] = [];
    if (!res.hopper.isZero()) more.push(`${res.hopper.format()} to the Hopper`);
    if (res.research.length) more.push(`${res.research.length} research done`);
    if (res.orders.length) more.push(`${res.orders.length} order${res.orders.length > 1 ? 's' : ''} filled`);
    if (more.length) { ui.text(fit(more.join(', '), a.w), a.x, y, C.teal1); y += 10; }
    if (stale(app)) { ui.text(fit('The factory has changed since: forecast again', a.w), a.x, y, C.pipYellow); y += 10; }
    y += 3;
    const trouble = res.timeline.filter((e) => e.kind === 'jam' || e.kind === 'heap');
    if (!trouble.length) {
      ui.text(`${ICON.check} Nothing jams in ${hrs} h: safe for overnight.`, a.x, y, C.leaf);
      y += 12;
    } else {
      ui.text(fit(`${res.jams} jam${res.jams === 1 ? '' : 's'} in ${hrs} h:`, a.w), a.x, y, C.pipRed);
      y += 12;
    }
    const rowsEnd = a.y + a.h - 4;
    let shown = 0;
    for (const e of trouble) {
      if (y + 12 > rowsEnd) break;
      shown++;
      const i = shown;
      ui.text(clock(e.t), a.x, y, C.hull3);
      ui.text(e.kind === 'jam' ? ICON.cross : ICON.pip, a.x + 28, y, e.kind === 'jam' ? C.pipRed : C.pipYellow);
      const target = e.x !== undefined ? (e.floor === 'factory' ? g.fentAt(e.x, e.y!) : g.entAt(e.x, e.y!)) : null;
      const stopped = !!target && !!target.paused;
      ui.text(fit((e.est ? '~' : '') + e.text, a.w - 38 - 88), a.x + 38, y, C.bone);
      if (button(ui, 'onGo' + i, a.x + a.w - 86, y - 2, 30, 11, 'Go')) goTo(app, e);
      if (target && button(ui, 'onStop' + i, a.x + a.w - 53, y - 2, 53, 11, stopped ? 'Stopped' : 'Stop line', { disabled: stopped, tip: 'Stop every machine of this line: it takes nothing and makes nothing until you start it again' })) {
        app.act({ k: 'pause', x: e.x!, y: e.y!, floor: e.floor === 'factory' ? 'factory' : undefined, line: true, on: true });
      }
      y += 12;
    }
    if (shown < trouble.length) ui.text(`and ${trouble.length - shown} more`, a.x + 38, Math.min(y, rowsEnd - 9), C.hull2);
  }
  // ---- the right column: what is stopped, and the Night Shift
  const bx0 = r.x + 16 + lw, bw = r.w - 24 - lw;
  const b = card(ui, bx0, r.y + 22, bw, r.h - 28, 'Stopped and the Night Shift', C.ice, 'pause');
  y = b.y;
  const stoppedW = g.s.ents.filter((e) => e.paused);
  const stoppedF = g.s.factory.ents.filter((e) => e.paused);
  const n = stoppedW.length + stoppedF.length;
  ui.text(n ? `${n} stopped by you` : 'Nothing stopped', b.x, y + 3, n ? C.pipYellow : C.hull2);
  if (!n) ui.para('Stop a line from the forecast: it takes nothing and makes nothing, so its Slag Heap keeps its room. Its pip goes grey; start it again here.', b.x, y + 16, b.w, C.hull2);
  if (n && button(ui, 'onStartAll', b.x + b.w - 52, y, 52, 13, 'Start all')) {
    for (const e of stoppedW) app.act({ k: 'pause', x: e.x, y: e.y, on: false });
    for (const e of stoppedF) app.act({ k: 'pause', x: e.x, y: e.y, floor: 'factory', on: false });
  }
  y += 16;
  const list = [...stoppedW.map((e) => ({ name: entName(g, e), x: e.x, y: e.y, floor: 'workshop' as const })), ...stoppedF.map((e) => ({ name: fname(g, e), x: e.x, y: e.y, floor: 'factory' as const }))];
  const listEnd = b.y + Math.floor(b.h * 0.42);
  for (let i = 0; i < list.length && y + 11 <= listEnd; i++) {
    const p = list[i];
    ui.text(fit(p.name, b.w - 40), b.x, y + 1, C.bone);
    if (button(ui, 'onStart' + i, b.x + b.w - 36, y - 1, 36, 11, 'Start')) app.act({ k: 'pause', x: p.x, y: p.y, floor: p.floor === 'factory' ? 'factory' : undefined, on: false });
    y += 12;
  }
  // the Night Shift
  y = Math.max(y + 4, listEnd + 2);
  frame(ui, b.x - 2, y, b.w + 4, 1, 'inset', false);
  y += 5;
  ui.text(`Offline efficiency: ${pct(offlineEfficiency(g))}`, b.x, y, C.gold);
  y += 12;
  for (const u of IDLE_UPGRADES) {
    if (y + 22 > b.y + b.h) break;
    const owned = g.has(u.id);
    const why = idleUpgradeRefusal(g, u.id);
    ui.text(fit(`${u.name}: +${Math.round(u.eff * 100)} points`, b.w - 70), b.x, y + 3, owned ? C.leaf : C.bone);
    const label = owned ? 'Bought' : `${ICON.coin} ${Num.of(u.cost).format()}`;
    if (button(ui, 'onBuy' + u.id, b.x + b.w - 66, y, 66, 13, label, { gold: !owned && !why, disabled: owned || !!why, tip: owned ? u.blurb : [{ text: u.name, color: C.gold }, { text: u.blurb }, ...(why ? [{ text: why, color: C.pipRed }] : [])] })) {
      app.act({ k: 'idleUpgrade', id: u.id });
    }
    y += 16;
  }
  if (y + 30 < b.y + b.h) ui.para(`Away, lines run as if open (heaps fill, lines jam at the same times); what they deliver counts at the offline efficiency. Up to 7 days count. Max ${pct(IDLE.offlineEffMax.value)}.`, b.x, y + 2, b.w, C.hull2);
  void duration;
}
