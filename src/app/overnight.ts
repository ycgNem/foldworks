// "Safe for overnight" (DESIGN.md §20; Milestone 6), a page of the ledger: the Inspector's forecast
// on his clipboard (docs/hud-180.md). Before leaving, the player looks ahead 1, 8 or 24 hours and
// sees which lines would stop and when, and what the time away would pay. The forecast is the
// offline model itself (src/sim/offline.ts) run on a copy of the game, so the morning's report and
// the evening's forecast are the same computation; it is spread over frames while the live factory
// keeps running. A cascade is one row per line: the first machine to block, the cause as a chip, a
// fix the player can build, and how many machines it stopped. A line stopped by its Slag Heap
// filling can be stopped now (the 'pause' command, logged like any other): its heap keeps its room
// for when you are back; a line that would stop for any other reason keeps nothing by stopping, so
// it is offered the fix instead. Any stop or start re-runs the forecast. The Night Shift (coin for
// offline efficiency) is bought on the facing page.
import { C } from '../data/palette';
import { IDLE, IDLE_UPGRADES } from '../data/idle';
import { ICON } from '../ui/font';
import { button, meter, clipboard, chip, chipWidth, rule } from './chrome';
import { menuTemplate } from './widgets';
import { clock, pct } from '../engine/fmt';
import { Num } from '../engine/num';
import { ITEMS, type ItemId } from '../data/items';
import { forecast, offlineEfficiency, type OfflineRun, type OfflineReport, type TimelineEntry } from '../sim/offline';
import { pausedCount, idleUpgradeRefusal, idleUpgradeGain } from '../sim/systems/pause';
import { entName } from '../sim/analysis';
import { fname } from '../sim/systems/modules';
import { fit, goTo, stepJob, paidRow, lineRows } from './offlinereport';
import { layoutRich, drawLayout } from '../ui/rich';
import { T } from '../ui/theme';
import type { App } from './app';
import type { Rect } from '../ui/ui';
import { bookArea, speak, heading, ROW_H } from './ledger';

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

/** The rows the forecast shows: a stopped line (one per line), a heap filling on its own, a high
 * floor's route short of carriers, and the Committee's reorganize it would have made (the morning
 * report's rows: the forecast is the same model). */
const trouble = (res: OfflineReport): TimelineEntry[] => res.timeline.filter((e) => e.kind === 'jam' || e.kind === 'heap' || e.kind === 'route' || e.kind === 'committee');

/** A row's icon (a short route has its floor's, as the morning report's). */
const rowIcon = (e: TimelineEntry) => (e.kind === 'jam' ? '{u:remove}' : e.kind === 'heap' ? '{i:slag}' : e.kind === 'committee' ? '{u:reset}' : e.floor === 'world' ? '{u:world}' : e.floor === 'beyond' ? '{u:kernel}' : '{u:district}');

/** The Inspector's line on the clipboard. */
function inspectorLine(app: App): string {
  const res = look.result;
  if (look.job) return 'Hmm. One moment. I am counting.';
  if (!res) return 'Leaving? A forecast first, I think.';
  if (stale(app)) return 'You have changed things. Again, please.';
  const n = res.lines.length;
  if (!trouble(res).length) return 'Nothing stops. Do carry on.';
  return n === 1 ? 'One line stops. I did mention it.' : 'Some lines stop. I did mention it.';
}

export function overnightScreen(app: App, r0: Rect) {
  const ui = app.ui;
  const g = app.game;
  const r = bookArea(r0);
  const { body, detail } = menuTemplate(app, r, { title: 'Safe for overnight', accent: C.ice, icon: 'clock', detail: Math.floor(r.w * 0.36) });
  // a stop or a start changes what the night brings: look again at once
  if (look.result && !look.job && look.at && look.at.paused !== pausedCount(g)) startForecast(app, look.at.hours);
  // a forecast running: a slice of it each frame (the live factory runs on meanwhile)
  if (look.job && stepJob(look.job)) {
    look.result = look.job.report;
    look.job = null;
  }
  forecastBoard(app, body);
  if (detail) nightPage(app, detail);
}

/** The left page: the Inspector's clipboard with the forecast on it. */
function forecastBoard(app: App, body: Rect) {
  const ui = app.ui;
  const g = app.game;
  const a = clipboard(ui, body.x, body.y, body.w, body.h);
  let y = a.y;
  y += speak(app, 'inspector', inspectorLine(app), a.x, y, a.w, { size: 24 }) + 5;
  // ---- how far to look, and the button
  drawLayout(ui, layoutRich('{u:clock}'), a.x, y + 4, T.ink);
  let bx = a.x + 12;
  for (const hrs of [1, 8, 24]) {
    if (button(ui, 'onHours' + hrs, bx, y, 32, 15, `${hrs} h`, { active: look.hours === hrs, tip: `{u:clock} look ${hrs} h ahead` })) look.hours = hrs;
    bx += 35;
  }
  if (button(ui, 'onRun', a.x + a.w - 76, y, 76, 15, look.job ? 'Looking' : 'Forecast', { gold: !look.job, disabled: !!look.job, tip: [{ text: '{u:research} runs the factory ahead on a copy' }, { text: 'through the offline model · the live game is not touched', color: T.inkSoft }] })) startForecast(app);
  y += 19;
  if (look.job) {
    drawLayout(ui, layoutRich(`{u:clock} ${look.job.counted / 3600} h ahead`), a.x, y, T.ink);
    meter(ui, a.x, y + 11, a.w, 7, look.job.progress(), { role: 'research' });
    y += 24;
  }
  const res = look.result;
  if (!res && !look.job) {
    for (const s of ['{u:research} the same model as the morning\'s report', '{i:slag} a line stopped by a full heap · {chip:good:Stop line} keeps its room', '{soft:any other stop needs the fix it names}']) {
      const L = layoutRich(s, a.w);
      if (y + L.h > a.y + a.h) break;
      drawLayout(ui, L, a.x, y + 1, T.ink);
      y += L.h + 4;
    }
  }
  if (!res) return;
  const hrs = look.at?.hours ?? look.hours;
  // ---- what the night pays, honestly: the first hour runs as if open
  const head = `{big:${hrs} h} {coin:+${res.coin.format()}}`;
  drawLayout(ui, layoutRich(head), a.x, y, T.ink);
  y += 14;
  const PL = layoutRich(paidRow(res), a.w);
  drawLayout(ui, PL, a.x, y, T.ink);
  y += PL.h + 1;
  const more: string[] = [];
  if (!res.hopper.isZero()) more.push(`{u:research} ${res.hopper.format()} to the Hopper`);
  if (res.research.length) more.push(`${res.research.length} research done`);
  if (res.orders.length) more.push(`{u:orders} ${res.orders.length} order${res.orders.length > 1 ? 's' : ''} filled`);
  if (more.length) {
    const ML = layoutRich(more.join(' · '), a.w);
    drawLayout(ui, ML, a.x, y, T.research);
    y += ML.h + 1;
  }
  if (stale(app)) { chip(ui, a.x, y + 1, 'changed since · forecast again', { role: 'warn', solid: true }); y += ROW_H; }
  y += 2;
  const rows = trouble(res);
  const nl = res.lines.length;
  if (!rows.length) {
    chip(ui, a.x, y, `${ICON.check} nothing stops in ${hrs} h`, { role: 'good', solid: true });
    y += ROW_H + 2;
  } else {
    let cx = a.x;
    const nr = res.lines.filter((l) => l.route).length, ns = nl - nr;
    if (ns) cx += chip(ui, cx, y, `${ns} line${ns === 1 ? '' : 's'} stop`, { role: 'bad', solid: true }) + 3;
    if (ns) cx += chip(ui, cx, y, `${res.jams} machine${res.jams === 1 ? '' : 's'}`, { role: 'bad' }) + 3;
    if (nr) chip(ui, cx, y, `${nr} route${nr === 1 ? '' : 's'} short`, { role: 'warn' });
    y += ROW_H + 2;
  }
  rule(ui, a.x, y - 2, a.w, true);
  const rowsEnd = a.y + a.h;
  let shown = 0;
  for (const e of rows) {
    const line = e.line !== undefined ? res.lines[e.line] : null;
    const canStop0 = !!line?.stopKeeps;
    const h = line ? lineRows(app, line, a.x + 46, 0, a.w - 46, a.w - 46 - (canStop0 ? 98 : 34), false) + 1 : 14;
    if (y + h > rowsEnd + 1) break;
    shown++;
    const i = shown;
    ui.text((e.est ? '~' : '') + clock(e.t), a.x + 30, y + 2, T.inkSoft, { align: 'right' });
    drawLayout(ui, layoutRich(rowIcon(e)), a.x + 34, y + 2, T.ink);
    // only the Workshop's and the Factory's can be stopped from here (a high floor's are its own)
    const low = e.floor === undefined || e.floor === 'workshop' || e.floor === 'factory';
    const target = e.x !== undefined && low ? (e.floor === 'factory' ? g.fentAt(e.x, e.y!) : g.entAt(e.x, e.y!)) : null;
    const stopped = !!target && !!target.paused;
    const canStop = !!line?.stopKeeps && !!target;
    const right = canStop ? 98 : 34;
    const room = a.w - 46 - right;
    const lx = a.x + 46;
    if (line) lineRows(app, line, lx, y, a.w - 46, room, true);
    else ui.text(fit(e.text, room), lx, y + 2, T.warn);
    const goTip = line?.route ? `{u:district} show the ${line.root.name} route · its ${line.route.carrier}s` : line ? `{u:remove} show ${line.root.name} · the first of its line to block · ${line.count} would stop` : 'show me where';
    if (e.x !== undefined && button(ui, 'onGo' + i, a.x + a.w - (canStop ? 96 : 32), y - 1, 32, 14, 'Go', { tip: goTip })) goTo(app, e);
    if (canStop && button(ui, 'onStop' + i, a.x + a.w - 61, y - 1, 61, 14, stopped ? 'Stopped' : 'Stop line', { disabled: stopped, tip: [{ text: '{u:pause} {big:Stop line}' }, { text: '{u:pause} every machine of this line, now' }, { text: line!.stopKeeps!, color: T.inkSoft }, { text: '{u:research} the forecast runs again after it', color: T.inkSoft }] })) {
      app.act({ k: 'pause', x: e.x!, y: e.y!, floor: e.floor === 'factory' ? 'factory' : undefined, line: true, on: true });
    }
    y += h;
  }
  if (shown < rows.length) ui.text(`+${rows.length - shown} more`, a.x + 46, Math.min(y, rowsEnd - 9), T.inkSoft);
}

/** The right page: what you stopped, and the Night Shift. */
function nightPage(app: App, b: Rect) {
  const ui = app.ui;
  const g = app.game;
  let y = b.y;
  const stoppedW = g.s.ents.filter((e) => e.paused);
  const stoppedF = g.s.factory.ents.filter((e) => e.paused);
  const n = stoppedW.length + stoppedF.length;
  heading(ui, 'Stopped', b.x, y, b.w, 'warn', n ? '' : '{soft:none}');
  if (n && button(ui, 'onStartAll', b.x + b.w - 56, y - 2, 56, 14, 'Start all', { tip: '{u:play} start every machine you stopped' })) {
    for (const e of stoppedW) app.act({ k: 'pause', x: e.x, y: e.y, on: false });
    for (const e of stoppedF) app.act({ k: 'pause', x: e.x, y: e.y, floor: 'factory', on: false });
  }
  y += 16;
  if (!n) {
    const L = layoutRich('{i:slag} stop a line whose heap would fill · its pip goes grey · start it here', b.w);
    drawLayout(ui, L, b.x, y, T.inkSoft);
    y += L.h + 2;
  }
  const list = [...stoppedW.map((e) => ({ name: entName(g, e), x: e.x, y: e.y, floor: 'workshop' as const })), ...stoppedF.map((e) => ({ name: fname(g, e), x: e.x, y: e.y, floor: 'factory' as const }))];
  const listEnd = b.y + Math.floor(b.h * 0.4);
  for (let i = 0; i < list.length && y + 14 <= listEnd; i++) {
    const p = list[i];
    drawLayout(ui, layoutRich(`{u:pause} ${fit(p.name, b.w - 56)}`), b.x, y + 2, T.ink);
    if (button(ui, 'onStart' + i, b.x + b.w - 40, y, 40, 14, 'Start', { tip: `{u:play} start ${p.name}` })) app.act({ k: 'pause', x: p.x, y: p.y, floor: p.floor === 'factory' ? 'factory' : undefined, on: false });
    y += 15;
  }
  // ---- the Night Shift
  y = Math.max(y + 4, listEnd + 2);
  heading(ui, 'Night Shift', b.x, y, b.w, 'reset', `{good:${pct(offlineEfficiency(g))}}`);
  y += 17;
  for (const u of IDLE_UPGRADES) {
    if (y + 16 > b.y + b.h) break;
    const owned = g.has(u.id);
    const why = idleUpgradeRefusal(g, u.id);
    const gain = idleUpgradeGain(g, u.id);
    const pts = owned ? Math.round(u.eff * 100) : Math.round(gain * 100);
    const bw = 66;
    const nm = `${u.name} {good:+${pts}}`;
    const NL = layoutRich(nm);
    drawLayout(ui, NL.w <= b.w - bw - 4 ? NL : layoutRich(`{good:+${pts}}`), b.x, y + 3, owned ? T.good : gain > 0 ? T.ink : T.inkSoft);
    const lbl = owned ? `${ICON.check} Bought` : `{coin:${Num.of(u.cost).format()}}`;
    if (button(ui, 'onBuy' + u.id, b.x + b.w - bw, y, bw, 15, lbl, { gold: !owned && !why, disabled: owned || !!why, tip: [{ text: `{big:${u.name}}` }, { text: u.blurb }, ...(why ? [{ text: `{bad:${why}}` }] : [])] })) {
      app.act({ k: 'idleUpgrade', id: u.id });
    }
    y += 18;
  }
  // how away time pays, as rows
  const rowsAt = ['{u:clock} first hour · {good:100%} as if open', `{u:overnight} after it · live speed · pays at most ${pct(IDLE.offlineEffMax.value)}`, '{u:clock} up to 7 days count'];
  y += 2;
  for (const s of rowsAt) {
    const L = layoutRich(s, b.w);
    if (y + L.h > b.y + b.h) break;
    drawLayout(ui, L, b.x, y, T.inkSoft);
    y += L.h + 2;
  }
}
