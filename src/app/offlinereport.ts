// The offline report (DESIGN.md §12, §20; Milestone 6): what happened while the player was away, as
// a timeline (each line that stopped as one row: its first machine to block and why, how many
// machines it stopped and a fix to build; heaps filling, orders filled, research finished, the
// Megaproject's stages) with a jump-to button per line, and the totals. While the run is still
// going (it is spread over frames, so the page never freezes) the card shows its progress. The
// footer says exactly how the number was made: what ran tick by tick, what was extrapolated and
// at what efficiency, so the report is a number the player can check (pillar 4).
// Built with the existing kit (chrome.ts, widgets.ts, ui.ts) as it is.
import { C } from '../data/palette';
import { ITEMS, type ItemId } from '../data/items';
import { ICON, textWidth } from '../ui/font';
import { frame, button, bar, coinIcon, uiIcon } from './chrome';
import { duration, clock } from '../engine/fmt';
import { Num } from '../engine/num';
import { paidHow, type TimelineEntry, type OfflineReport, type OfflineRun } from '../sim/offline';
import { IDLE } from '../data/idle';
import type { Layout } from './layout';
import type { App } from './app';

/** the timeline page shown (rows per page depend on the card's height) */
let page = 0;
let pageFor: OfflineReport | null = null;

/** Step an offline run (or a forecast) for about `ms` of this frame; true when its report is ready. */
export function stepJob(run: OfflineRun, ms = IDLE.jobMsPerFrame.value): boolean {
  const t0 = performance.now();
  do {
    if (run.step(IDLE.jobChunkTicks.value)) return true;
  } while (performance.now() - t0 < ms);
  return false;
}

/** Cut a line to fit `w` UI px, with an ellipsis. */
export function fit(s: string, w: number): string {
  if (textWidth(s) <= w) return s;
  let t = s;
  while (t.length > 1 && textWidth(t + '...') > w) t = t.slice(0, -1);
  return t.trimEnd() + '...';
}

const KIND_COL: Record<TimelineEntry['kind'], string> = {
  jam: C.pipRed, heap: C.pipYellow, order: C.lime, research: C.ice, mega: C.gold, bay: C.gold,
};
const KIND_MARK: Record<TimelineEntry['kind'], string> = {
  jam: ICON.cross, heap: ICON.pip, order: ICON.crate, research: ICON.flask, mega: ICON.star, bay: ICON.star,
};

/** Go to a jam or a heap on its floor and pin its report. */
export function goTo(app: App, e: { x?: number; y?: number; floor?: 'workshop' | 'factory' }) {
  if (e.x === undefined || e.y === undefined) return;
  const g = app.game;
  app.panel = null;
  app.setFloor(e.floor ?? 'workshop', true);
  app.lookAt(e.x + 0.5, e.y + 0.5);
  if ((e.floor ?? 'workshop') === 'workshop') app.selected = g.entAt(e.x, e.y)?.id ?? null;
  else app.fselected = g.fentAt(e.x, e.y)?.id ?? null;
}

/** The biggest few things sold, as "12.3K steel, 4.5K glass". */
function soldLine(rep: OfflineReport, n = 3): string {
  const rows = (Object.entries(rep.sold) as [ItemId, Num][])
    .filter(([k, v]) => v.gt(0) && ITEMS[k].value > 0)
    .sort((a, b) => b[1].mul(Math.max(0.01, ITEMS[b[0]].value)).cmp(a[1].mul(Math.max(0.01, ITEMS[a[0]].value))));
  return rows.slice(0, n).map(([k, v]) => `${v.format()} ${ITEMS[k].name.toLowerCase()}`).join(', ');
}

export function offlineReportCard(app: App, L: Layout) {
  const ui = app.ui;
  const O = L.overlay;
  ui.fill(O.x, O.y, O.w, O.h, C.ink, 0.6);
  const w = Math.min(380, O.w - 12), h = Math.min(250, O.h - 8);
  const x = O.x + Math.floor((O.w - w) / 2), y = O.y + Math.floor((O.h - h) / 2);
  frame(ui, x, y, w, h);
  ui.fill(x + 3, y + 3, w - 6, 15, C.shadow);
  uiIcon(ui, 'clock', x + 6, y + 2);
  const job = app.offlineJob;
  const rep = app.offline;
  if (!rep) {
    if (!job) { app.panel = null; return; }
    // still running: a progress bar, never a frozen page
    ui.text(`While you were away: ${duration(job.away)}`, x + 26, y + 7, C.hot, { shadow: C.ink });
    ui.text('Running your factory through the time away...', x + 12, y + 34, C.bone);
    bar(ui, x + 12, y + 48, w - 24, 8, job.progress(), C.gold);
    ui.para('The first hour runs tick by tick through the same machines as live play and pays in full; the rest follows from the rates measured, in segments that end whenever a Slag Heap fills, an order fills or research finishes.', x + 12, y + 66, w - 24, C.hull2);
    return;
  }
  if (pageFor !== rep) { page = 0; pageFor = rep; }
  ui.text(`While you were away: ${duration(rep.away)}`, x + 26, y + 7, C.hot, { shadow: C.ink });
  // ---- the totals
  let yy = y + 24;
  coinIcon(ui, x + 12, yy);
  ui.text(`+${rep.coin.format()}`, x + 34, yy + 1, C.gold, { scale: 2, shadow: C.brass0 });
  ui.text('coin earned', x + 34, yy + 18, C.hull2);
  const rx = x + Math.floor(w / 2) + 6, rw = x + w - 12 - rx;
  let ry = y + 24;
  const right = (s: string, col: string) => { ui.text(fit(s, rw), rx, ry, col); ry += 10; };
  if (!rep.hopper.isZero()) right(`${rep.hopper.format()} items into the Hopper`, C.teal1);
  if (!rep.parts.isZero()) right(`${rep.parts.format()} Machine Kits banked`, C.copper2);
  const given = (Object.entries(rep.mega.given) as [ItemId, Num][]).filter(([, v]) => v.gt(0));
  if (given.length) right(`Megaproject: +${given.map(([k, v]) => `${v.format()} ${ITEMS[k].name.toLowerCase()}`).join(', ')}`, C.gold);
  const sold = soldLine(rep);
  if (sold) right(`Sold: ${sold}`, C.bone);
  yy = Math.max(yy + 30, ry + 2);
  // ---- the timeline: a stopped line is one row (its first machine to block, why, how many it
  // stopped) with the fix under it; heaps, orders, research and the Megaproject one line each
  ui.fill(x + 8, yy, w - 16, 1, C.brass0);
  yy += 4;
  const nl = rep.lines.length;
  const head = nl
    ? `${nl} line${nl > 1 ? 's' : ''} stopped (${rep.jams} machine${rep.jams > 1 ? 's' : ''}), ${rep.orders.length} order${rep.orders.length === 1 ? '' : 's'} filled, ${rep.research.length} research done`
    : `${ICON.check} Nothing jammed in ${duration(rep.counted)}.`;
  ui.text(fit(head, w - 24), x + 12, yy, nl ? C.pipYellow : C.leaf);
  yy += 12;
  const footH = 56;
  const rowsH = y + h - footH - yy - 12;
  const tl = rep.timeline;
  const rowH = (e: TimelineEntry) => (e.line !== undefined ? 21 : 12);
  // pages by height: a line's row is two lines tall
  const starts: number[] = [0];
  for (let i = 0, used = 0; i < tl.length; i++) {
    if (used + rowH(tl[i]) > rowsH && used > 0) { starts.push(i); used = 0; }
    used += rowH(tl[i]);
  }
  const pages = starts.length;
  if (page >= pages) page = pages - 1;
  if (!tl.length) ui.text(rep.jammedAtStart ? `${rep.jammedAtStart} machine${rep.jammedAtStart > 1 ? 's were' : ' was'} already jammed when you left.` : 'A quiet stretch: every line ran the whole time.', x + 12, yy, C.hull2);
  for (let i = starts[page]; i < (starts[page + 1] ?? tl.length); i++) {
    const e = tl[i];
    const col = KIND_COL[e.kind];
    const line = e.line !== undefined ? rep.lines[e.line] : null;
    ui.text(clock(e.t), x + 12, yy, C.hull3);
    ui.text(KIND_MARK[e.kind], x + 42, yy, col);
    const go = e.x !== undefined && (e.kind === 'jam' || e.kind === 'heap');
    const tw = w - 24 - 40 - (go ? 40 : 0);
    const text = line ? `${line.root.name}'s line: ${line.cause}` : e.text;
    ui.text(fit((e.est ? '~' : '') + text, tw), x + 52, yy, e.kind === 'jam' ? C.bone : col);
    if (go && button(ui, 'offGo' + i, x + w - 48, yy - 2, 36, 11, 'Go', { tip: line ? `Show ${line.root.name}, the first of its line to block` : e.est ? 'Worked out from the measured rates (~): this is where it will be' : 'Show me where' })) goTo(app, e);
    if (line) ui.text(fit(`${line.count} machine${line.count > 1 ? 's' : ''} stopped. Fix: ${line.fix}`, w - 24 - 40), x + 52, yy + 9, C.leaf);
    yy += rowH(e);
  }
  if (pages > 1) {
    const py = y + h - footH - 2;
    if (button(ui, 'offPrev', x + 12, py - 10, 44, 11, 'Earlier', { disabled: page === 0 })) page--;
    ui.text(`${page + 1}/${pages}`, x + Math.floor(w / 2), py - 8, C.hull2, { align: 'center' });
    if (button(ui, 'offNext', x + w - 56, py - 10, 44, 11, 'Later', { disabled: page >= pages - 1 })) page++;
  }
  // ---- how the number was made (pillar 4: a number you can check)
  const fy = y + h - footH + 2;
  ui.fill(x + 8, fy - 2, w - 16, 1, C.brass0);
  const how = `Paid: ${paidHow(rep)} (offline efficiency).${tl.some((e) => e.est) ? ' ~ marks a time worked out from rates.' : ''} Time away counts up to 7 days.`;
  ui.para(how, x + 12, fy + 1, w - 24, C.hull2);
  if (button(ui, 'offOvernight', x + 12, y + h - 18, 110, 13, 'Overnight check', { tip: 'Before you go next time: see which lines would jam, and stop them' })) {
    app.offline = null;
    app.panel = 'overnight';
  }
  if (button(ui, 'offlineOk', x + w - 112, y + h - 18, 100, 13, 'Back to work', { gold: true })) { app.panel = null; app.offline = null; }
}
