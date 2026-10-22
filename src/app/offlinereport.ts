// The offline report (DESIGN.md §12, §20; Milestone 6), as a letter from Mayor Bramble
// (docs/hud-180.md): he opens it in a speech bubble in his own voice, then the totals (the coin in
// the display face, the Hopper, Machine Kits, the Megaproject, what sold), then the timeline as
// rows (each line that stopped as one row: its first machine to block, the cause and how many
// machines it stopped as chips, the fix to build as a chip, a jump-to button; on the District, the
// World and Beyond the same for a module that stopped, and a row for each route short of carriers,
// naming it and how many it is short, as the District's starved report does; heaps filling, orders
// filled, research finished, the Megaproject's stages one row each; the Standing Committee's number
// reached while away, which it waits on until you are back), and at the foot exactly how
// the number was made: what ran tick by tick, what was worked out from the rates and at what
// efficiency (pillar 4: a number the player can check). While the run is still going (it is spread
// over frames, so the page never freezes) the letter shows its progress.
import { C } from '../data/palette';
import { ITEMS, type ItemId } from '../data/items';
import { textWidth, bigWidth, BIG_H } from '../ui/font';
import { button, meter, coinIcon, chip, chipWidth, rule } from './chrome';
import { duration, clock } from '../engine/fmt';
import { Num } from '../engine/num';
import { type TimelineEntry, type OfflineReport, type OfflineRun, type JamLine, type ReportFloor } from '../sim/offline';
import { hentAt } from '../sim/systems/high';
import { DS } from './district';
import { IDLE } from '../data/idle';
import { layoutRich, drawLayout } from '../ui/rich';
import { T, roleInk, type Role } from '../ui/theme';
import type { Layout } from './layout';
import type { App } from './app';
import type { Rect } from '../ui/ui';
import { speak, ROW_H } from './ledger';

/** the timeline page shown (rows per page depend on the letter's height) */
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

/** Each kind of timeline row: its icon and its ink. */
const KIND: Record<TimelineEntry['kind'], { icon: string; role: Role }> = {
  jam: { icon: '{u:remove}', role: 'bad' }, heap: { icon: '{i:slag}', role: 'warn' }, order: { icon: '{u:orders}', role: 'good' },
  research: { icon: '{u:research}', role: 'research' }, mega: { icon: '{u:mega}', role: 'coin' }, bay: { icon: '{u:mega}', role: 'coin' },
  route: { icon: '{u:district}', role: 'warn' }, committee: { icon: '{u:reset}', role: 'reset' },
};

/** A row's icon: a short route has its floor's. */
const rowIcon = (e: TimelineEntry) => (e.kind !== 'route' ? KIND[e.kind].icon : e.floor === 'world' ? '{u:world}' : e.floor === 'beyond' ? '{u:kernel}' : '{u:district}');

const isLine = (l: JamLine) => !l.route;

/** Go to a jam, a heap or a short route on its floor and pin its report (a route's: its own). */
export function goTo(app: App, e: { x?: number; y?: number; floor?: ReportFloor }, line?: JamLine | null) {
  if (e.x === undefined || e.y === undefined) return;
  const g = app.game;
  const f = e.floor ?? 'workshop';
  app.panel = null;
  app.setFloor(f, true);
  app.lookAt(e.x + 0.5, e.y + 0.5);
  if (f === 'workshop') app.selected = g.entAt(e.x, e.y)?.id ?? null;
  else if (f === 'factory') app.fselected = g.fentAt(e.x, e.y)?.id ?? null;
  else {
    DS.game = g;
    DS.floor = f;
    DS.route = line?.route ? line.route.id : null;
    DS.sel = line?.route ? null : hentAt(g, f, e.x, e.y)?.id ?? null;
  }
}

/** The biggest few things sold, as icon rows: "{i:steel} 12.3K  {i:glass} 4.5K". */
function soldRow(rep: OfflineReport, n = 3): string {
  const rows = (Object.entries(rep.sold) as [ItemId, Num][])
    .filter(([k, v]) => v.gt(0) && ITEMS[k].value > 0)
    .sort((a, b) => b[1].mul(Math.max(0.01, ITEMS[b[0]].value)).cmp(a[1].mul(Math.max(0.01, ITEMS[a[0]].value))));
  return rows.slice(0, n).map(([k, v]) => `{i:${k}} ${v.format()}`).join('  ');
}

/** How the number was made, as one row (the sim's paidHow, in chips and icons). */
export function paidRow(rep: Pick<OfflineReport, 'replayed' | 'extrapolated' | 'eff'>): string {
  if (rep.extrapolated <= 0) return `{u:clock} ${duration(rep.replayed)} {good:at 100%} · as if open`;
  return `{u:clock} first ${duration(rep.replayed)} {good:at 100%} · the other ${duration(rep.extrapolated)} {warn:at ${Math.round(rep.eff * 100)}%}`;
}

/** Mayor Bramble's opening line for the letter. */
function brambleLine(rep: OfflineReport | null): string {
  if (!rep) return 'Welcome back! Counting it all up, one moment!';
  const n = rep.lines.filter(isLine).length;
  if (n) return n === 1 ? 'While you were away, a line got stuck! Look!' : 'While you were away, some lines got stuck! Look!';
  if (rep.lines.length) return 'While you were away, a route ran short! Look!';
  if (rep.coin.gt(0)) return 'While you were away, she never stopped! Smells like money!';
  return 'Welcome back! A quiet stretch. Ribbit.';
}

export function offlineReportCard(app: App, L: Layout) {
  const ui = app.ui;
  const O = L.overlay;
  ui.fill(O.x, O.y, O.w, O.h, C.ink, 0.6);
  const w = Math.min(420, O.w - 12), h = Math.min(286, O.h - 8);
  const x = O.x + Math.floor((O.w - w) / 2), y = O.y + Math.floor((O.h - h) / 2);
  // the letter: a sheet of paper, ruled faintly like writing paper
  ui.panel(x, y, w, h, 'paper', true);
  const c: Rect = { x: x + 8, y: y + 6, w: w - 16, h: h - 12 };
  const job = app.offlineJob;
  const rep = app.offline;
  // ---- Bramble opens it, the time away on a chip beside him
  const away = rep ? rep.away : job ? job.away : 0;
  const awayChip = `{u:clock} ${duration(away)}`;
  const cw = chipWidth(awayChip);
  const sh = speak(app, 'bramble', brambleLine(rep), c.x, c.y, c.w - cw - 6, { size: 48, cheer: !!rep && rep.coin.gt(0) && !rep.lines.length });
  chip(ui, c.x + c.w - cw, c.y + 2, awayChip, { role: 'ink', solid: false });
  let yy = c.y + sh + 6;
  if (!rep) {
    if (!job) { app.panel = null; return; }
    // still running: a meter, never a frozen page
    meter(ui, c.x, yy + 2, c.w, 8, job.progress(), { role: 'coin' });
    yy += 16;
    const first = `{u:clock} the first ${duration(job.firstReplay)} · tick by tick, the same machines as live play · {good:pays in full}`;
    drawLayout(ui, layoutRich(first, c.w), c.x, yy, T.ink);
    yy += layoutRich(first, c.w).h + 4;
    drawLayout(ui, layoutRich('{u:stats} the rest · the rates measured · a new segment at each full heap, filled order, finished research', c.w), c.x, yy, T.inkSoft);
    return;
  }
  if (pageFor !== rep) { page = 0; pageFor = rep; }
  // ---- the totals: the coin big, the rest as icon rows beside it
  coinIcon(ui, c.x, yy + 2);
  const coin = `+${rep.coin.format()}`;
  ui.big(coin, c.x + 20, yy, T.coin, { scale: 2 });
  const tw = 20 + bigWidth(coin) * 2 + 12;
  const rx = c.x + Math.max(tw, Math.floor(c.w * 0.42));
  const rw = c.x + c.w - rx;
  const right: string[] = [];
  if (!rep.hopper.isZero()) right.push(`{u:research} ${rep.hopper.format()} into the Hopper`);
  if (!rep.parts.isZero()) right.push(`{i:machineKit} ${rep.parts.format()} Machine Kits`);
  const given = (Object.entries(rep.mega.given) as [ItemId, Num][]).filter(([, v]) => v.gt(0));
  if (given.length) right.push(`{u:mega} ${given.map(([k, v]) => `{i:${k}} +${v.format()}`).join(' ')}`);
  const sold = soldRow(rep);
  if (sold) right.push(`{u:coin} sold ${sold}`);
  let ry = yy - 1;
  for (const s of right.slice(0, 3)) {
    const RL = layoutRich(s);
    if (RL.w > rw) continue;
    drawLayout(ui, RL, rx, ry, T.ink);
    ry += 10;
  }
  yy = Math.max(yy + 2 * BIG_H + 3, ry + 2);
  // writing paper from here down: faint ruled lines under the timeline
  ui.ctx.fillStyle = T.paperLo;
  for (let ly = yy + 20; ly < y + h - 6 - 40; ly += 13) ui.ctx.fillRect(x + 6, ly, w - 12, 1);
  // ---- the timeline: its summary as chips, then a row a line (two when it has a fix)
  rule(ui, c.x, yy, c.w, true);
  yy += 4;
  const nl = rep.lines.filter(isLine).length;
  const nr = rep.lines.length - nl;
  const sum: { text: string; role: Role }[] = nl
    ? [{ text: `${nl} line${nl > 1 ? 's' : ''} stopped`, role: 'bad' }, { text: `${rep.jams} machine${rep.jams > 1 ? 's' : ''}`, role: 'bad' }]
    : nr ? [] : [{ text: `nothing jammed in ${duration(rep.counted)}`, role: 'good' }];
  if (nr) sum.push({ text: `${nr} route${nr > 1 ? 's' : ''} short`, role: 'warn' });
  if (rep.orders.length) sum.push({ text: `${rep.orders.length} order${rep.orders.length > 1 ? 's' : ''} filled`, role: 'good' });
  if (rep.research.length) sum.push({ text: `${rep.research.length} research done`, role: 'research' });
  let sx = c.x;
  for (const s of sum) {
    const sw = chipWidth(s.text);
    if (sx + sw > c.x + c.w) break;
    chip(ui, sx, yy, s.text, { role: s.role, solid: s.role === 'bad' });
    sx += sw + 3;
  }
  yy += ROW_H + 2;
  const footH = 38;
  const rowsBottom = y + h - 6 - footH - 14;
  const tl = rep.timeline;
  const rowH = (e: TimelineEntry) => (e.line !== undefined ? lineRows(app, rep.lines[e.line], c.x + 46, 0, c.w - 46, c.w - 46 - 40, false) + 1 : 14);
  // pages by height: a line's row is two rows tall
  const starts: number[] = [0];
  for (let i = 0, used = 0; i < tl.length; i++) {
    if (used + rowH(tl[i]) > rowsBottom - yy && used > 0) { starts.push(i); used = 0; }
    used += rowH(tl[i]);
  }
  const pages = starts.length;
  if (page >= pages) page = pages - 1;
  if (!tl.length) drawLayout(ui, layoutRich(rep.jammedAtStart ? `{warn:${rep.jammedAtStart} machine${rep.jammedAtStart > 1 ? 's' : ''} already jammed when you left}` : '{good:every line ran the whole time}', c.w), c.x, yy, T.ink);
  for (let i = starts[page]; i < (starts[page + 1] ?? tl.length); i++) {
    const e = tl[i];
    const k = KIND[e.kind];
    const line = e.line !== undefined ? rep.lines[e.line] : null;
    ui.text((e.est ? '~' : '') + clock(e.t), c.x + 30, yy + 2, T.inkSoft, { align: 'right' });
    drawLayout(ui, layoutRich(rowIcon(e)), c.x + 34, yy + 2, T.ink);
    const go = e.x !== undefined && (e.kind === 'jam' || e.kind === 'heap' || e.kind === 'route');
    const room = c.w - 46 - (go ? 40 : 0);
    if (line) lineRows(app, line, c.x + 46, yy, c.w - 46, room, true);
    else ui.text(fit(e.text, room), c.x + 46, yy + 2, roleInk(k.role));
    const tip = line?.route ? `{u:district} show the ${line.root.name} route · its ${line.route.carrier}s` : line ? `{u:remove} show ${line.root.name} · the first of its line to block` : e.est ? '~ worked out from the measured rates · this is where it will be' : 'show me where';
    if (go && button(ui, 'offGo' + i, c.x + c.w - 36, yy - 1, 36, 14, 'Go', { tip })) goTo(app, e, line);
    yy += rowH(e);
  }
  if (pages > 1) {
    const py = rowsBottom + 1;
    if (button(ui, 'offPrev', c.x, py, 50, 13, 'Earlier', { disabled: page === 0 })) page--;
    ui.text(`${page + 1}/${pages}`, c.x + Math.floor(c.w / 2), py + 3, T.inkSoft, { align: 'center' });
    if (button(ui, 'offNext', c.x + c.w - 50, py, 50, 13, 'Later', { disabled: page >= pages - 1 })) page++;
  }
  // ---- how the number was made (pillar 4: a number you can check)
  const fy = y + h - 6 - footH;
  rule(ui, c.x, fy, c.w, true);
  const how = `${paidRow(rep)}${tl.some((e) => e.est) ? ' · ~ from rates' : ''} · {soft:7 days at most}`;
  const HL = layoutRich(how, c.w);
  drawLayout(ui, HL.lines.length > 1 ? layoutRich(paidRow(rep), c.w) : HL, c.x, fy + 4, T.ink);
  const by = y + h - 6 - 17;
  if (button(ui, 'offOvernight', c.x, by, 130, 17, '{u:overnight} Overnight check', { tip: [{ text: '{u:overnight} before you go next time' }, { text: 'see which lines would jam, and stop them', color: T.inkSoft }] })) {
    app.offline = null;
    app.panel = 'overnight';
  }
  if (button(ui, 'offlineOk', c.x + c.w - 120, by, 120, 17, 'Back to work', { gold: true, big: true })) { app.panel = null; app.offline = null; }
}

/** A stopped line as rows (the offline letter and the overnight forecast): its first machine to
 * block, the cause and how many machines it stopped as chips, then the fix to build. Line one has
 * `room1` px (the buttons sit after it), the rest `w`. A chip too wide for its row becomes wrapped
 * ink instead (never cut). Draws when `draw`; returns the height. */
export function lineRows(app: App, line: JamLine, x: number, y: number, w: number, room1: number, draw: boolean): number {
  const ui = app.ui;
  const who = line.root.why && ITEMS[line.root.why as ItemId] ? `{i:${line.root.why}} ` : '';
  const cause = `${who}${line.cause}`;
  // a short route stops nothing: its chip says how much of its want it carries
  const count = line.route ? `carries ${Math.round((line.route.cap / Math.max(1e-9, line.route.want)) * 100)}%` : `${line.count} stopped`;
  const name = line.root.name;
  const nw = textWidth(name) + 5;
  // line one: the name, then the cause and the count when they fit beside it
  const both = nw + chipWidth(cause) + 3 + chipWidth(count) <= room1;
  const causeUp = both || nw + chipWidth(cause) <= room1;
  const countUp = both || (!causeUp && nw + chipWidth(count) <= room1);
  if (draw) {
    ui.text(name, x, y + 2, T.ink);
    let lx = x + nw;
    if (causeUp) lx += chip(ui, lx, y, cause, { role: 'bad' }) + 3;
    if (countUp) chip(ui, lx, y, count, { role: 'soft' });
  }
  let h = 13;
  // the cause on its own row when line one had no room for it (the count after it if it fits)
  if (!causeUp) {
    const cw = chipWidth(cause);
    if (cw <= w) {
      if (draw) {
        chip(ui, x, y + h, cause, { role: 'bad' });
        if (!countUp && cw + 3 + chipWidth(count) <= w) chip(ui, x + cw + 3, y + h, count, { role: 'soft' });
      }
      h += 13;
    } else {
      const L = layoutRich(`${who}{bad:${line.cause}} · ${count}`, w);
      if (draw) drawLayout(ui, L, x, y + h + 2, T.inkSoft);
      h += L.h + 2;
    }
  }
  // the fix (the count rides after it when line one had room only for the cause)
  const fix = `fix · ${line.fix}`;
  const countLeft = causeUp && !countUp;
  const fw = chipWidth(fix);
  if (fw <= w) {
    if (draw) {
      chip(ui, x, y + h, fix, { role: 'good' });
      if (countLeft && fw + 3 + chipWidth(count) <= w) chip(ui, x + fw + 3, y + h, count, { role: 'soft' });
    }
    h += 13;
    if (countLeft && fw + 3 + chipWidth(count) > w) {
      if (draw) chip(ui, x, y + h, count, { role: 'soft' });
      h += 13;
    }
  } else {
    const L = layoutRich(`{good:fix · ${line.fix}}${countLeft ? ` · {soft:${count}}` : ''}`, w);
    if (draw) drawLayout(ui, L, x, y + h + 2, T.good);
    h += L.h + 2;
  }
  return h;
}
