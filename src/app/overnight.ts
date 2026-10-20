// "Safe for overnight" (DESIGN.md §20; Milestone 6): before leaving, the player looks ahead 1, 8
// or 24 hours and sees which lines would stop and when, and what the time away would pay. The
// forecast is the offline model itself (src/sim/offline.ts) run on a copy of the game, so the
// morning's report and the evening's forecast are the same computation; it is spread over frames
// while the live factory keeps running. A cascade is one row per line: the first machine to block
// and why, a fix the player can build, and how many machines it stopped. A line stopped by its
// Slag Heap filling can be stopped now (the 'pause' command, logged like any other): its heap
// keeps its room for when you are back, and the row says how long that is; a line that would stop
// for any other reason keeps nothing by stopping, so it is offered the fix instead. Any stop or
// start re-runs the forecast. The Night Shift (coin for offline efficiency) is bought here too.
import { C } from '../data/palette';
import { IDLE, IDLE_UPGRADES } from '../data/idle';
import { ICON, textWidth } from '../ui/font';
import { card, button, bar, label } from './chrome';
import { menuTemplate } from './widgets';
import { clock, pct } from '../engine/fmt';
import { Num } from '../engine/num';
import { forecast, offlineEfficiency, paidHow, type OfflineRun, type OfflineReport, type TimelineEntry } from '../sim/offline';
import { pausedCount, idleUpgradeRefusal, idleUpgradeGain } from '../sim/systems/pause';
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

/** Has the factory changed since the forecast (a build, a fold)? */
function stale(app: App): boolean {
  const g = app.game;
  const a = look.at;
  return !!a && (a.version !== g.version || a.fversion !== g.fversion);
}

/** The rows the forecast shows: a stopped line (one per line) or a heap filling on its own. */
const trouble = (res: OfflineReport): TimelineEntry[] => res.timeline.filter((e) => e.kind === 'jam' || e.kind === 'heap');

export function overnightScreen(app: App, r: Rect) {
  const ui = app.ui;
  const g = app.game;
  const { body } = menuTemplate(app, r, { title: 'Safe for overnight', accent: C.ice, icon: 'clock' });
  // a stop or a start changes what the night brings: look again at once
  if (look.result && !look.job && look.at && look.at.paused !== pausedCount(g)) startForecast(app, look.at.hours);
  // a forecast running: a slice of it each frame (the live factory runs on meanwhile)
  if (look.job && stepJob(look.job)) {
    look.result = look.job.report;
    look.job = null;
  }
  const lw = Math.floor((body.w - 6) * 0.66);
  const a = card(ui, body.x, body.y, lw, body.h, 'The forecast', C.ice, 'research');
  let y = a.y;
  // ---- how far to look, and the button
  label(ui, 'Look ahead', a.x, y + 4, C.hull2);
  let bx = a.x + 52;
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
    y += ui.para('See which lines would stop while you are away, and when, before you go. The forecast runs your factory ahead through the same offline model that writes the report you get when you come back.', a.x, y, a.w, C.hull2);
    y += 4;
    ui.para('A line stopped by its Slag Heap filling can be stopped now: its heap keeps its room for when you are back. Any other stop needs the fix it names.', a.x, y, a.w, C.hull2);
  }
  if (res) {
    const hrs = look.at?.hours ?? look.hours;
    ui.text(fit(`Closed for ${hrs} h: +${res.coin.format()} coin`, a.w), a.x, y, C.gold);
    y += 10;
    // the effective rate, honestly: the first hour runs as if open
    ui.text(fit(paidHow(res), a.w), a.x, y, C.hull2);
    y += 10;
    const more: string[] = [];
    if (!res.hopper.isZero()) more.push(`${res.hopper.format()} to the Hopper`);
    if (res.research.length) more.push(`${res.research.length} research done`);
    if (res.orders.length) more.push(`${res.orders.length} order${res.orders.length > 1 ? 's' : ''} filled`);
    if (more.length) { ui.text(fit(more.join(', '), a.w), a.x, y, C.teal1); y += 10; }
    if (stale(app)) { ui.text(fit('The factory has changed since: forecast again', a.w), a.x, y, C.pipYellow); y += 10; }
    y += 3;
    const rows = trouble(res);
    const nl = res.lines.length;
    if (!rows.length) {
      ui.text(`${ICON.check} Nothing stops in ${hrs} h: safe for overnight.`, a.x, y, C.leaf);
      y += 12;
    } else {
      ui.text(fit(nl ? `${nl} line${nl === 1 ? '' : 's'} would stop in ${hrs} h (${res.jams} machine${res.jams === 1 ? '' : 's'}):` : `In ${hrs} h:`, a.w), a.x, y, C.pipRed);
      y += 12;
    }
    const rowsEnd = a.y + a.h - 4;
    let shown = 0;
    for (const e of rows) {
      const line = e.line !== undefined ? res.lines[e.line] : null;
      const h = line ? 21 : 12;
      if (y + h > rowsEnd + 2) break;
      shown++;
      const i = shown;
      ui.text(clock(e.t), a.x, y, C.hull3);
      ui.text(e.kind === 'jam' ? ICON.cross : ICON.pip, a.x + 28, y, e.kind === 'jam' ? C.pipRed : C.pipYellow);
      const target = e.x !== undefined ? (e.floor === 'factory' ? g.fentAt(e.x, e.y!) : g.entAt(e.x, e.y!)) : null;
      const stopped = !!target && !!target.paused;
      const canStop = !!line?.stopKeeps && !!target;
      const tw = a.w - 38 - (canStop ? 88 : 34);
      const text = line ? `${line.root.name}'s line: ${line.cause}` : e.text;
      ui.text(fit((e.est ? '~' : '') + text, tw), a.x + 38, y, C.bone);
      if (button(ui, 'onGo' + i, a.x + a.w - (canStop ? 86 : 30), y - 2, 30, 11, 'Go', { tip: line ? `Show ${line.root.name}, the first of its line to block (${line.count} machine${line.count > 1 ? 's' : ''} would stop)` : 'Show me where' })) goTo(app, e);
      if (canStop && button(ui, 'onStop' + i, a.x + a.w - 53, y - 2, 53, 11, stopped ? 'Stopped' : 'Stop line', { disabled: stopped, tip: [{ text: 'Stop every machine of this line now', color: C.gold }, { text: line!.stopKeeps! }, { text: 'The forecast runs again after it.', color: C.hull2 }] })) {
        app.act({ k: 'pause', x: e.x!, y: e.y!, floor: e.floor === 'factory' ? 'factory' : undefined, line: true, on: true });
      }
      if (line) ui.text(fit(`Fix: ${line.fix}`, a.w - 38), a.x + 38, y + 9, C.leaf);
      y += h;
    }
    if (shown < rows.length) ui.text(`and ${rows.length - shown} more`, a.x + 38, Math.min(y, rowsEnd - 9), C.hull2);
  }
  // ---- the right column: what is stopped, and the Night Shift
  const bx0 = body.x + lw + 6, bw = body.w - lw - 6;
  const b = card(ui, bx0, body.y, bw, body.h, 'Stopped and the Night Shift', C.ice, 'pause');
  y = b.y;
  const stoppedW = g.s.ents.filter((e) => e.paused);
  const stoppedF = g.s.factory.ents.filter((e) => e.paused);
  const n = stoppedW.length + stoppedF.length;
  ui.text(n ? `${n} stopped by you` : 'Nothing stopped', b.x, y + 3, n ? C.pipYellow : C.hull2);
  if (!n) ui.para('Stop a line whose Slag Heap would fill: its heap keeps its room for when you are back. Its pip goes grey; start it again here.', b.x, y + 16, b.w, C.hull2);
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
  ui.fill(b.x - 2, y, b.w + 4, 1, C.hull0);
  y += 5;
  ui.text(`Offline efficiency: ${pct(offlineEfficiency(g))}`, b.x, y, C.gold);
  y += 12;
  for (const u of IDLE_UPGRADES) {
    if (y + 22 > b.y + b.h) break;
    const owned = g.has(u.id);
    const why = idleUpgradeRefusal(g, u.id);
    const gain = idleUpgradeGain(g, u.id);
    const pts = owned ? Math.round(u.eff * 100) : Math.round(gain * 100);
    const nm = `${u.name}: +${pts} points`;
    ui.text(fit(textWidth(nm) <= b.w - 70 ? nm : `${u.name} +${pts}%`, b.w - 70), b.x, y + 3, owned ? C.leaf : gain > 0 ? C.bone : C.hull2);
    const lbl = owned ? 'Bought' : `${ICON.coin} ${Num.of(u.cost).format()}`;
    if (button(ui, 'onBuy' + u.id, b.x + b.w - 66, y, 66, 13, lbl, { gold: !owned && !why, disabled: owned || !!why, tip: owned ? u.blurb : [{ text: u.name, color: C.gold }, { text: u.blurb }, ...(why ? [{ text: why, color: C.pipRed }] : [])] })) {
      app.act({ k: 'idleUpgrade', id: u.id });
    }
    y += 16;
  }
  if (y + 30 < b.y + b.h) ui.para(`Away, the first hour runs as if open and pays 100%. After it lines still run at live speed (heaps fill and lines jam at the same times); what they deliver pays at the offline efficiency, at most ${pct(IDLE.offlineEffMax.value)}. Up to 7 days count.`, b.x, y + 2, b.w, C.hull2);
}
