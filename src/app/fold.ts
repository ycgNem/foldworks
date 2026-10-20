// Folding's screens and HUD pieces (DESIGN.md §10, §11, §18): the audit badge while a box is
// measured (a live projected grade with its U/W/C bars and the coin the line makes), the grade
// card (the stamp slams in, then U/W/C, the rates and what would raise it, a name and "Fold it!")
// for Workshop lines and for nested folds on the Factory floor, the Modules inventory (stamp with
// the per-product price, Machine Kits and claims explained; unfold, place, rename) with a ledger
// beside it, the Factory floor's store column and reports, the offline report, and the slice's
// closing card. Reads the App and the Game; changes the game only through App.act.
import { C, rgba } from '../data/palette';
import { ITEMS, itemName, type ItemId } from '../data/items';
import { FACTORY } from '../data/land';
import { ORDER } from '../data/orders';
import { RESEARCH } from '../data/research';
import { RULES, SCORE_WEIGHTS } from '../data/rules';
import { prules } from '../sim/patents'; // Milestone 5: the Patent rules (More Auditors, Quick Audits)
import type { Game } from '../sim/Game';
import { megaStage } from '../data/megaprojects';
import { ICON, textWidth, wrapText } from '../ui/font';
import { TICK_RATE } from '../engine/time';
import { Num } from '../engine/num';
import { sheet, itemIcon, hasArt, spriteName, frameNamed } from '../render/sprites';
import { mainOutput, megaFrac } from '../render/factory';
import { auditTicks, projectAudit, entsIn, gradedAudit } from '../sim/systems/audits';
import { BUILD } from '../data/machines';
import { gradeFAudit } from '../sim/systems/nested';
import { inBill, defaultName, stampCost, stampRefusal, unfoldRefusal, fname, feedsDock, productCopies, kitsFor, mainItem, sliceEndParts } from '../sim/systems/modules';
import { claimsHeld, claimsUsed, oresOf, copiesOf } from '../sim/systems/claims';
import type { AuditResult, AuditState, Box, FAuditState, FEnt, ModuleDesign } from '../sim/world';
import { frame, card, button, bar, uiIcon, portrait, coinIcon, plate } from './chrome';
import { icon, perMin as perMinW, screenHeader, cells, fmt, rays } from './widgets';
import type { Layout } from './layout';
import type { App } from './app';
import type { Rect } from '../ui/ui';

/** the grade art's frame order (S+ is the sixth frame, drawn after the first five) */
const GRADE_ORDER = ['S', 'A', 'B', 'C', 'D', 'S+'];
/** best first, for sorting */
export const GRADE_RANK = ['S+', 'S', 'A', 'B', 'C', 'D'];
export const GRADE_COL: Record<string, string> = { 'S+': C.gold, S: C.gold, A: C.leaf, B: C.teal1, C: C.copper2, D: C.pipRed };

/** The grade art's frame for a letter (S+ falls back to S, with a plus drawn over it, until its
 * own frame exists). */
function gradeFrame(letter: string): { img: CanvasImageSource; plus: boolean } {
  const fr = sheet('ui_grade').frames;
  const i = GRADE_ORDER.indexOf(letter);
  if (i >= 0 && i < fr.length) return { img: fr[i], plus: false };
  return { img: fr[0], plus: letter === 'S+' };
}

/** A gold plus beside an S emblem drawn at (x, y, size). */
function drawPlus(ctx: CanvasRenderingContext2D, x: number, y: number, size: number) {
  const u = Math.max(1, Math.round(size / 16));
  const cx = x + size - 3 * u, cy = y + 3 * u;
  ctx.fillStyle = C.ink;
  ctx.fillRect(cx - 3 * u, cy - u * 2, 6 * u, 4 * u);
  ctx.fillRect(cx - u * 2, cy - 3 * u, 4 * u, 6 * u);
  ctx.fillStyle = C.gold;
  ctx.fillRect(cx - 2 * u, cy - u, 4 * u, 2 * u);
  ctx.fillRect(cx - u, cy - 2 * u, 2 * u, 4 * u);
}

export const perMin = perMinW;

const warmTicks = (g?: Game) => (g ? prules(g).auditWarmup : RULES.auditWarmup.value) * TICK_RATE; // Quick Audits (§19)

/** Coin a minute a set of outputs is worth at the Dock (rates per second). */
function coinPerMin(outs: Partial<Record<ItemId, number>>, mult = 1): number {
  let c = 0;
  for (const [k, r] of Object.entries(outs) as [ItemId, number][]) c += r * 60 * ITEMS[k].value * mult;
  return c;
}

/** A grade letter as the art's 32x32 sprite drawn at `size`, or text. */
function gradeIcon(app: App, letter: string, x: number, y: number, size: number) {
  if (hasArt('ui_grade')) {
    const f = gradeFrame(letter);
    app.ui.ctx.drawImage(f.img, x, y, size, size);
    if (f.plus) drawPlus(app.ui.ctx, x, y, size);
  } else app.ui.text(letter, x + size / 2 - 2, y + size / 2 - 4, GRADE_COL[letter] ?? C.bone);
}

// ------------------------------------------------------------------ a text field

/** A one-line text field; focus with a click, Enter or Esc leaves. Returns the value. */
export function textField(app: App, id: string, x: number, y: number, w: number, value: string, max = 28): string {
  const ui = app.ui;
  const focused = app.hud.focus === id;
  app.hud.fieldSeen = true;
  ui.region(x, y, w, 13, 'button');
  ui.fill(x, y, w, 13, C.brass0);
  ui.fill(x + 1, y + 1, w - 2, 11, focused ? C.ink : C.shadow);
  ui.clip(x + 2, y, w - 4, 13);
  const tw = textWidth(value);
  const sx = Math.min(x + 3, x + w - 6 - tw);
  ui.text(value, sx, y + 3, C.bone);
  if (focused && Math.floor(ui.time * 2) % 2 === 0) ui.fill(sx + tw + 1, y + 2, 1, 9, C.gold);
  ui.unclip();
  if (ui.hover(x, y, w, 13) && ui.clicked) {
    ui.eat();
    app.hud.focus = id;
    app.hud.draft = value;
    app.input.typing = (key: string) => {
      if (key === 'Enter' || key === 'Escape') {
        app.hud.focus = null;
        app.input.typing = null;
      } else if (key === 'Backspace') app.hud.draft = app.hud.draft.slice(0, -1);
      else if (app.hud.draft.length < max) app.hud.draft += key;
    };
  }
  return focused ? app.hud.draft : value;
}

// ------------------------------------------------------------------ the audit badges

/** The graded Workshop audit the grade card shows: the one picked (by its badge), else the first. */
export function selectedAudit(app: App): AuditState | null {
  const g = app.game;
  const a = app.gradeId !== null ? g.s.audits.find((q) => q.id === app.gradeId && q.result) : null;
  return a ?? gradedAudit(g);
}

/** Open the grade card for a Workshop audit (its stamp falls again). */
export function openGrade(app: App, id: number) {
  app.gradeId = id;
  app.panel = 'grade';
  app.gradeAt = app.ui.time;
  app.nameDraft = null;
  app.hud.stamped = false;
}

type AnyAudit = AuditState | FAuditState;

/** A box's rect on screen, in UI px. */
function boxOnScreen(app: App, b: Box): Rect {
  const p0 = app.renderer.toScreen(b.x, b.y), p1 = app.renderer.toScreen(b.x + b.w, b.y + b.h);
  const k = app.ui.scale;
  return { x: p0.x / k - 3, y: p0.y / k - 3, w: (p1.x - p0.x) / k + 6, h: (p1.y - p0.y) / k + 6 };
}

function overlapArea(a: Rect, b: Rect): number {
  const w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x), h = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
  return w > 0 && h > 0 ? w * h : 0;
}

/** Every audit on this floor as a compact badge (a ring running down the 70 s, the projected
 * grade's parts as one stacked bar, the grade emblem once graded), in a row along the bottom of
 * the floor view, or the top when the bottom would cover a box being audited or dragged. A
 * graded badge opens its own grade card; a running one shows its box. The audits on the other
 * floor show as a chip with a Go button. */
export function auditBadge(app: App, L: Layout) {
  const ui = app.ui;
  const g = app.game;
  const ws = app.floor === 'workshop';
  const c = L.center;
  const here: AnyAudit[] = ws ? g.s.audits : g.s.faudit ? [g.s.faudit] : [];
  const there: AnyAudit[] = ws ? (g.s.faudit ? [g.s.faudit] : []) : g.s.audits;
  let topY = c.y + 4;
  // the other floor: one chip, top right
  if (there.length) {
    const graded = there.filter((a) => a.result).length;
    const first = there.find((a) => a.result) ?? there[0];
    const left = Math.max(0, Math.ceil((auditTicks() - first.t) / TICK_RATE));
    const where = ws ? 'Factory floor' : 'Workshop';
    const s = graded ? `${graded} graded on the ${where}` : there.length > 1 ? `${there.length} audits on the ${where}` : `Audit on the ${where}: ${left} s`;
    const w = Math.min(c.w - 8, textWidth(s) + 52);
    const x = c.x + Math.floor((c.w - w) / 2), y = c.y + 4;
    plate(ui, x, y, w, 18, { accent: graded ? C.gold : C.teal1 });
    ui.clip(x + 4, y, w - 44, 18);
    ui.text(s, x + 6, y + 6, graded ? C.gold : C.teal1);
    ui.unclip();
    if (button(ui, 'gotoAudit', x + w - 38, y + 3, 34, 12, 'Go', { gold: !!graded, pulse: !!graded })) {
      app.setFloor(ws ? 'factory' : 'workshop', true);
      app.lookAt(first.box.x + first.box.w / 2, first.box.y + first.box.h / 2);
    }
    topY = y + 22;
  }
  if (!here.length) return;
  const n = here.length, gap = 3, bh = 32;
  const bw = Math.min(118, Math.floor((c.w - 8 - gap * (n - 1)) / n));
  const rowW = n * bw + (n - 1) * gap;
  const x0 = c.x + Math.floor((c.w - rowW) / 2);
  // the row goes where it covers the least of the boxes on the floor (the critic: the old badge
  // hid the top boxes): the bottom first, then the top
  const boxes = here.map((a) => boxOnScreen(app, a.box));
  const drag = app.dragBox();
  if (drag) boxes.push(boxOnScreen(app, drag));
  const head = ws ? 11 : 0;
  const cost = (y: number) => boxes.reduce((s, b) => s + overlapArea(b, { x: x0, y: y - head, w: rowW, h: bh + head }), 0);
  const bottomY = c.y + c.h - bh - 4, upY = topY + head;
  const y = cost(bottomY) <= cost(upY) ? bottomY : upY;
  // "2/3 audits": a tab on the row's corner
  if (ws) {
    const graded = here.filter((a) => a.result).length;
    const s = `Audits ${n}/${prules(g).maxAudits}${graded ? `  ${graded} graded` : ''}`;
    const tw = textWidth(s) + 8;
    ui.fill(x0, y - 11, tw, 11, C.ink);
    ui.fill(x0 + 1, y - 10, tw - 2, 10, C.shadow);
    ui.fill(x0 + 1, y - 10, tw - 2, 1, graded ? C.brass1 : C.teal0);
    ui.text(s, x0 + 4, y - 9, graded ? C.gold : C.teal1);
    ui.hint(x0, y - 11, tw, 11, `Up to ${prules(g).maxAudits} lines can be audited at once, in boxes that never overlap. Click a graded badge to fold it.`, 180);
  }
  here.forEach((a, i) => auditChip(app, a, ws, x0 + i * (bw + gap), y, bw, bh));
}

/** One audit's badge. */
function auditChip(app: App, a: AnyAudit, ws: boolean, x: number, y: number, w: number, h: number) {
  const ui = app.ui;
  const g = app.game;
  const ctx = ui.ctx;
  const total = auditTicks(g);
  const f = Math.min(1, a.t / total);
  const warm = !a.result && a.t < warmTicks(g);
  const res: AuditResult | null = a.result ?? (ws ? projectAudit(g, a as AuditState) : a.t > warmTicks(g) + TICK_RATE ? gradeFAudit(g) : null);
  const hov = ui.hover(x, y, w, h);
  plate(ui, x, y, w, h, { accent: a.result ? C.gold : warm ? C.hull1 : C.teal1, hover: hov, kind: 'button' });
  if (a.result) {
    // a graded badge glows gold and asks to be clicked
    ui.fill(x + 3, y + 3, w - 6, h - 6, C.gold, 0.12 + 0.1 * Math.sin(ui.time * 6));
    if (Math.floor(ui.time * 2) % 2 === 0) ui.fill(x + 3, y + 3, w - 6, 1, C.gold);
  } else if (hov) ui.fill(x + 3, y + 3, w - 6, h - 6, C.teal1, 0.1);
  // the ring
  const cx = x + 15, cy = y + 16, rad = 11;
  ctx.fillStyle = C.ink;
  ctx.beginPath(); ctx.arc(cx, cy, rad + 2, 0, Math.PI * 2); ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = C.shadow;
  ctx.beginPath(); ctx.arc(cx, cy, rad - 1, 0, Math.PI * 2); ctx.stroke();
  ctx.strokeStyle = a.result ? C.gold : warm ? C.hull2 : C.teal1;
  ctx.beginPath(); ctx.arc(cx, cy, rad - 1, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * f); ctx.stroke();
  ctx.lineWidth = 1;
  const left = Math.max(0, Math.ceil((total - a.t) / TICK_RATE));
  if (a.result) gradeIcon(app, a.result.grade.letter, cx - 8, cy - 8, 16);
  else ui.text(`${left}`, cx - Math.floor(textWidth(String(left)) / 2), cy - 3, C.bone);
  // the words
  const tx = x + 30, tr = x + w - 4;
  const canCancel = !a.result;
  // a running audit: the art director's stopwatch ticking beside its name
  const watch = !a.result && hasArt('ui_audit');
  if (watch) {
    const sw = sheet('ui_audit');
    ctx.drawImage(sw.frames[Math.floor(ui.time * (sw.fps || 4)) % sw.frames.length], tx, y + 2);
  }
  ui.clip(tx, y, tr - tx - (canCancel ? 10 : 0), h);
  const full = `${ws ? 'Line' : 'Group'} ${a.box.w}x${a.box.h}`;
  const room = tr - tx - (canCancel ? 10 : 0) - (watch ? 14 : 0);
  ui.text(a.result ? 'Graded!' : warm ? (textWidth('Warming up') <= room ? 'Warming up' : 'Warm-up') : textWidth(full) <= room ? full : `${a.box.w}x${a.box.h}`, tx + (watch ? 14 : 0), y + 4, a.result ? C.gold : warm ? C.hull2 : C.teal1);
  ui.unclip();
  ui.clip(tx, y, tr - tx, h);
  if (a.result) {
    const s = `${a.result.grade.letter} x${a.result.grade.mult.toFixed(2)}`;
    ui.text(s, tx, y + 13, GRADE_COL[a.result.grade.letter] ?? C.bone);
    if (tx + textWidth(s) + 6 + textWidth('fold!') <= tr) ui.text('fold!', tr, y + 13, Math.floor(ui.time * 3) % 2 ? C.hot : C.bone, { align: 'right' });
  } else if (res) {
    ui.text('so far', tx, y + 13, C.hull2);
    ui.text(res.grade.letter, tx + textWidth('so far') + 4, y + 13, GRADE_COL[res.grade.letter] ?? C.bone);
  } else ui.text(warm ? `${Math.ceil((warmTicks(g) - a.t) / TICK_RATE)} s, then ${prules(g).auditWindow}` : 'measuring', tx, y + 13, C.hull1);
  ui.unclip();
  // the score as one bar: U, W and C stacked in their weights
  const bw = tr - tx;
  ui.fill(tx, y + 23, bw, 5, C.ink);
  if (res) {
    let bx = tx + 1;
    for (const [v, wgt, col] of [[res.grade.u, SCORE_WEIGHTS.u, C.leaf], [res.grade.w, SCORE_WEIGHTS.w, C.teal1], [res.grade.c, SCORE_WEIGHTS.c, C.brass1]] as [number, number, string][]) {
      const pw = Math.round((bw - 2) * v * wgt);
      ui.fill(bx, y + 24, pw, 3, col);
      bx += pw;
    }
  } else for (let i = 0; i < bw - 2; i += 4) if ((i / 4 + Math.floor(ui.time * 6)) % 2 === 0) ui.fill(tx + 1 + i, y + 24, 2, 3, C.hull0);
  // cancel a running audit; a graded one is cancelled on its card
  const aid = 'id' in a ? a.id : -1;
  if (canCancel && button(ui, 'cancelAudit:' + aid, x + w - 13, y + 3, 10, 10, '', { tip: `Stop measuring this box; the ${ws ? 'line' : 'group'} keeps running.` })) {
    app.act(ws ? { k: 'auditCancel', id: aid } : { k: 'fauditCancel' });
    return;
  }
  if (canCancel) ui.text(ICON.cross, x + w - 11, y + 4, C.bone);
  if (hov) {
    const lines: { text: string; color?: string }[] = [{ text: a.result ? `Graded ${a.result.grade.letter}: click to open its card` : `${ws ? 'Fold audit' : 'Nested fold audit'}: ${left} s to go`, color: a.result ? C.gold : C.teal1 }];
    if (res) {
      lines.push({ text: `U ${Math.round(res.grade.u * 100)}% (x0.6), W ${Math.round(res.grade.w * 100)}% (x0.2), C ${Math.round(res.grade.c * 100)}% (x0.2): score ${res.grade.score.toFixed(2)}` });
      lines.push({ text: `Worth ${fmt(coinPerMin(res.outs, res.grade.mult))} coin a minute at the Dock${a.result ? '' : ' at the grade so far'}.`, color: C.gold });
    } else lines.push({ text: 'It runs 70 s: 10 s to warm up, then 60 s measured. The projected grade shows once the window opens.' });
    if (!a.result) lines.push({ text: 'Click to look at its box.', color: C.hull2 });
    ui.tip(lines, 210);
    if (ui.clicked) {
      ui.eat();
      ui.sfx('click');
      if (a.result) {
        if (ws) openGrade(app, aid);
        else { app.panel = 'fgrade'; app.gradeAt = ui.time; app.nameDraft = null; app.hud.stamped = false; }
      } else app.lookAt(a.box.x + a.box.w / 2, a.box.y + a.box.h / 2);
    }
  }
}

// ------------------------------------------------------------------ the grade card

interface GradeSpec {
  res: AuditResult;
  box: Box;
  title: string;
  /** the things in the box, each with a sprite drawer, a name and its busy share */
  parts: { id: number; draw: (x: number, y: number) => void; name: string; busy: number }[];
  defaultName: string;
  fold: (name: string) => boolean;
  cancel: () => void;
  foldTip: string;
  /** what is inside, as a plural noun, and lines about the fold for the card's facts box */
  unit: string;
  facts: string[];
  cancelLabel: string;
  cancelTip: string;
  /** several graded audits: which one this is, and a way to step between them */
  pager?: { i: number; n: number; go: (d: number) => void };
}

export function gradeCard(app: App, L: Layout) {
  const g = app.game;
  const a = selectedAudit(app);
  if (!a || !a.result) { app.panel = null; return; }
  app.gradeId = a.id;
  const res = a.result;
  const graded = g.s.audits.filter((q) => q.result);
  const gi = graded.indexOf(a);
  drawGrade(app, L, {
    res,
    box: a.box,
    title: `Audit: a ${a.box.w}x${a.box.h} line`,
    parts: a.ids.map((id) => g.byId.get(id)).filter((m) => !!m).map((m) => ({
      id: m!.id,
      draw: (x: number, y: number) => app.ui.ctx.drawImage(sheet(spriteName(m!.kind)).frames[0], x, y, 16, 16),
      name: m!.kind === 'furnace' ? 'Hand Furnace' : m!.kind[0].toUpperCase() + m!.kind.slice(1).replace(/Mk2$/, ' Mk2'),
      busy: res.busy[m!.id] ?? 0,
    })),
    defaultName: defaultName(scaled(res)),
    fold: (name) => app.act({ k: 'fold', name, id: a.id }).ok,
    cancel: () => app.act({ k: 'auditCancel', id: a.id }),
    foldTip: 'The machines go into a one-tile module; belts are refunded; the box empties.',
    unit: 'machines',
    facts: [`Stamping copies costs the machines' price (${fmt(foldBill(app, a))} coin) x (1 + 0.5 n), n counted per product.`],
    cancelLabel: 'Keep the line',
    cancelTip: 'Cancel the audit. The line stays and keeps running; audit it again any time.',
    pager: graded.length > 1 ? { i: gi, n: graded.length, go: (d) => { const q = graded[(gi + d + graded.length) % graded.length]; openGrade(app, q.id); } } : undefined,
  });
}

/** The nested fold's grade card (DESIGN.md §18): the same card, for a group of modules. */
export function fgradeCard(app: App, L: Layout) {
  const g = app.game;
  const a = g.s.faudit;
  if (!a || !a.result) { app.panel = null; return; }
  const res = a.result;
  drawGrade(app, L, {
    res,
    box: a.box,
    title: `Nested fold: a ${a.box.w}x${a.box.h} group`,
    parts: a.ids.map((id) => g.fById.get(id)).filter((m) => !!m).map((m) => ({
      id: m!.id,
      draw: (x: number, y: number) => {
        app.ui.ctx.drawImage(sheet('module').frames[0], x, y);
        const out = mainOutput(g, m!.design);
        if (out) app.ui.ctx.drawImage(itemIcon(out), x + 4, y + 4);
      },
      name: fname(g, m!),
      busy: res.busy[m!.id] ?? 0,
    })),
    defaultName: defaultName(scaled(res)) + ' II',
    fold: (name) => app.act({ k: 'ffold', name }).ok,
    cancel: () => app.act({ k: 'fauditCancel' }),
    foldTip: 'The modules and trunks go into one depth-2 module: the group\'s rates times its grade. Trunks are refunded.',
    unit: 'modules',
    facts: [`Its own grade multiplies the group's measured rates: modules graded S, folded at S, run 1.25 x 1.25 = 1.56x the raw lines.`, 'Its stamp bill is the sum of its modules\' bills; a depth-2 module cannot be folded again.'],
    cancelLabel: 'Keep the group',
    cancelTip: 'Cancel the audit. The modules stay and keep running.',
  });
}

/** The coin price of the machines in a Workshop audit's box (its stamp bill once folded). */
function foldBill(app: App, a: AuditState | null): number {
  if (!a) return 0;
  let bill = 0;
  for (const e of entsIn(app.game, a.box)) if (inBill(e.kind)) bill += BUILD[e.kind].cost;
  return bill;
}

function scaled(res: AuditResult): Partial<Record<ItemId, number>> {
  return Object.fromEntries(Object.entries(res.outs).map(([k, v]) => [k, (v ?? 0) * res.grade.mult])) as Partial<Record<ItemId, number>>;
}

/** The S+ moment (the grade card's stamp, the audit's last tick, the fold): gold everywhere. */
export function celebrateTop(app: App) {
  app.audio.sfx('fanfare');
  app.audio.sfx('gradeS', 1, 1.26);
  app.audio.sfx('codex', 0.8, 1.5);
  app.renderer.fx.kick(9);
  app.hud.confetti = Math.max(app.hud.confetti, 150);
  app.hud.celebs.push({ kind: 'splus', t: 0, x: app.ui.w / 2, y: app.ui.h / 2 });
  for (let i = 0; i < 120; i++) app.hud.rain.push({ x: Math.random() * app.ui.w, y: -Math.random() * app.ui.h * 0.7, vx: (Math.random() - 0.5) * 30, vy: 50 + Math.random() * 60, f: Math.floor(Math.random() * 8), spin: Math.random() * 6, gold: true });
}

function drawGrade(app: App, L: Layout, sp: GradeSpec) {
  const ui = app.ui;
  const res = sp.res;
  const gr = res.grade;
  const top = gr.letter === 'S+';
  const O = L.overlay;
  ui.fill(O.x, O.y, O.w, O.h, C.ink, 0.6);
  const w = Math.min(380, O.w - 12), h = Math.min(264, O.h - 8);
  const x = O.x + Math.floor((O.w - w) / 2), y = O.y + Math.floor((O.h - h) / 2);
  frame(ui, x, y, w, h);
  ui.fill(x + 3, y + 3, w - 6, 15, C.shadow);
  if (top) ui.fill(x + 3, y + 17, w - 6, 1, Math.floor(ui.time * 4) % 2 ? C.gold : C.hot);
  uiIcon(ui, 'fold', x + 6, y + 2);
  ui.text(sp.title, x + 26, y + 7, top ? C.gold : C.hot, { shadow: C.ink });
  // several graded lines: step between their cards
  if (sp.pager) {
    const pw = 70, px = x + w - 6 - pw;
    if (button(ui, 'gradePrev', px, y + 4, 14, 11, ICON.left, { tip: 'The previous graded line' })) sp.pager.go(-1);
    ui.text(`${sp.pager.i + 1} of ${sp.pager.n}`, px + pw / 2, y + 6, C.gold, { align: 'center' });
    if (button(ui, 'gradeNext', px + pw - 14, y + 4, 14, 11, ICON.right, { tip: 'The next graded line' })) sp.pager.go(1);
  }
  // the stamp: it slams down from 3x, then the burst and confetti
  const t = ui.time - app.gradeAt;
  const k = t < 0.28 ? 3 - 2 * (t / 0.28) ** 2 : 1;
  // the stamp is drawn at 2x when the card is wide enough (integer scales keep the pixels square)
  const S = w >= 340 ? 2 : 1;
  const sx = x + 8, sy = y + 22;
  if (t >= 0.28 && !app.hud.stamped) {
    app.hud.stamped = true;
    if (top) celebrateTop(app);
    else {
      app.audio.sfx(('grade' + gr.letter) as 'gradeS');
      app.renderer.fx.kick(gr.letter === 'S' ? 6 : 3);
      app.hud.confetti = gr.letter === 'S' || gr.letter === 'A' ? 60 : 16;
    }
  }
  const ctx = ui.ctx;
  const half = 24 * S;
  const mx = sx + half, my = sy + half;
  const colW = 48 * S + 6;
  // the burst stays in the stamp's own column, under the title strip (the critic: it covered
  // "Audit:", "Compact" and "Score"); S+ turns gold rays behind it
  ui.clip(x + 3, y + 18, colW + 6, 48 * S + 4);
  if (top && t >= 0.28) rays(app, mx, my, 48 * S, C.gold, 16);
  if (t >= 0.28 && hasArt('fx_burst')) {
    const b = sheet('fx_burst');
    const fi = Math.min(b.frames.length - 1, Math.floor((t - 0.28) * 15));
    if ((t - 0.28) * 15 < b.frames.length + 6) ctx.drawImage(b.frames[fi], mx - 32 * S, my - 32 * S, 64 * S, 64 * S);
  }
  ui.unclip();
  // the scale steps in whole numbers so the stamp stays crisp as it falls; it falls inside the
  // card (clipped to it) so it never breaks out over the floor
  const kk = Math.max(S, Math.min(S * 2, Math.round(k * S)));
  const big = 48 * kk;
  const ox = mx - big / 2, oy = my - big / 2;
  ui.clip(x + 3, y + 18, w - 6, h - 21);
  if (hasArt('ui_stamp_ring')) ctx.drawImage(sheet('ui_stamp_ring').frames[0], ox, oy, big, big);
  else { ctx.fillStyle = GRADE_COL[gr.letter]; ctx.fillRect(ox, oy, big, big); }
  if (hasArt('ui_grade')) {
    const f = gradeFrame(gr.letter);
    ctx.drawImage(f.img, ox + 8 * kk, oy + 8 * kk, 32 * kk, 32 * kk);
    if (f.plus) drawPlus(ctx, ox + 8 * kk, oy + 8 * kk, 32 * kk);
  }
  else ui.text(gr.letter, mx - 4, my - 6, C.ink, { scale: 2 });
  // S+: a glint sweeps across the stamp now and then
  if (top && t >= 0.28) {
    const sw = (ui.time * 0.7) % 2;
    if (sw < 1) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(mx, my, 20 * S, 0, Math.PI * 2);
      ctx.clip();
      ctx.fillStyle = rgba(C.bone, 0.55);
      const gx = Math.round(mx - 24 * S + sw * 48 * S);
      ctx.fillRect(gx, my - 24 * S, 2 * S, 48 * S);
      ctx.fillRect(gx + 4 * S, my - 24 * S, S, 48 * S);
      ctx.restore();
    }
  }
  ui.unclip();
  confetti(app, mx, my);
  ui.text(`Score ${gr.score.toFixed(2)}`, mx, sy + 48 * S + 4, top ? C.gold : C.bone, { align: 'center' });
  ui.text(`rates x${gr.mult.toFixed(2)}`, mx, sy + 48 * S + 14, gr.mult >= 1 ? C.leaf : C.pipRed, { align: 'center' });
  // the three parts
  const px = x + 14 + colW, pw = x + w - 10 - px;
  let yy = y + 24;
  const part = (label: string, v: number, wgt: number, tip: string) => {
    ui.text(label, px, yy, C.bone);
    ui.text(`${Math.round(v * 100)}%  +${(v * wgt).toFixed(2)}`, px + pw, yy, C.hull3, { align: 'right' });
    bar(ui, px, yy + 10, pw, 5, v, v >= 0.9 ? C.leaf : v >= 0.6 ? C.pipYellow : C.pipRed);
    ui.hint(px, yy, pw, 16, tip, 180);
    yy += 19;
  };
  part('Busy (U) x0.6', gr.u, 0.6, 'How much of the time the things in the box worked.');
  part('Waste handled (W) x0.2', gr.w, 0.2, res.byMade ? `${Math.round(res.byHandled)} of ${Math.round(res.byMade)} byproducts left by a port or were used inside.` : 'No byproducts made: full marks.');
  part('Compact (C) x0.2', gr.c, 0.2, `${res.machineTiles} working tiles in ${res.boxTiles}: full at 60%.`);
  // the rates (x the grade's multiplier: what the module will do)
  const rates = (label: string, tt: Partial<Record<ItemId, number>>, col: string) => {
    const ents = Object.entries(tt) as [ItemId, number][];
    ui.text(label, px, yy, C.hull2);
    let ix = px + textWidth(label) + 4;
    if (!ents.length) ui.text('nothing', ix, yy, C.hull1);
    for (const [it, r] of ents) {
      const s = `${perMin(r * gr.mult)}/m`;
      if (ix + 10 + textWidth(s) > px + pw) break;
      ctx.drawImage(itemIcon(it), ix, yy);
      ix += 12 + ui.text(s, ix + 10, yy, col);
    }
    yy += 11;
  };
  rates('Makes', res.outs, C.leaf);
  rates('Takes', res.ins, C.copper2);
  ui.text(`Worth ${fmt(coinPerMin(res.outs, gr.mult))} coin a minute at the Dock`, px, yy, C.gold);
  yy += 12;
  // each thing in the box and how busy it was: beside the stamp when there is room
  const ax = x + 10, aw = w - 20;
  const stampBottom = sy + 48 * S + 24;
  const inside = (ix0: number, iy: number, right: number) => {
    let mxx = ix0;
    ui.text('Inside', mxx, iy + 4, C.hull2);
    mxx += textWidth('Inside') + 6;
    for (const p of sp.parts) {
      if (mxx + 20 > right) break;
      ui.fill(mxx, iy, 18, 18, C.ink);
      p.draw(mxx + 1, iy + 1);
      ui.fill(mxx, iy + 19, 18, 3, C.ink);
      ui.fill(mxx + 1, iy + 20, Math.round(16 * p.busy), 1, p.busy >= 0.9 ? C.leaf : p.busy >= 0.6 ? C.pipYellow : C.pipRed);
      ui.hint(mxx, iy, 18, 22, `${p.name}: busy ${Math.round(p.busy * 100)}%`, 140);
      mxx += 21;
    }
  };
  if (yy + 22 <= stampBottom) {
    inside(px, yy, px + pw);
    yy = stampBottom + 2;
  } else {
    yy = Math.max(yy + 2, stampBottom + 2);
    inside(ax, yy, ax + aw);
    yy += 26;
  }
  // what would raise it: the advice gets the card's width, each line saying what it is worth
  const by = y + h - 36;
  const lines = res.advice.slice(0, 3);
  if (top) {
    ui.text(`${ICON.star} S+: the top grade. A flawless line, x${gr.mult.toFixed(2)} for good.`, ax, yy, C.gold, { shadow: C.ink });
    yy += 12;
  } else if (lines.length) {
    ui.text(gr.letter === 'S' ? 'One step to S+:' : 'To raise it:', ax, yy, C.gold);
    yy += 11;
  }
  if (!top) {
    for (const l of lines) {
      const n = wrapText(`${ICON.right} ${l}`, aw).length;
      if (yy + n * 10 > by - 2) break;
      yy += ui.para(`${ICON.right} ${l}`, ax, yy, aw, C.bone) + 2;
    }
  }
  // what the fold does, in numbers, while there is room
  const facts: string[] = [`${sp.parts.length} ${sp.unit} on ${res.boxTiles} tiles become one tile, running at these rates for good.`];
  if (res.byMade > 0) facts.push(`Byproducts over the window: ${Math.round(res.byHandled)} of ${Math.round(res.byMade)} handled.`);
  facts.push(...sp.facts);
  let fh = 6;
  for (const f of facts) fh += Math.max(1, wrapText(`${ICON.module} ${f}`, aw - 12).length) * 10;
  if (by - 6 - yy >= 26) {
    const bh = Math.min(fh, by - 6 - yy);
    frame(ui, ax, yy + 2, aw, bh, 'inset');
    ui.clip(ax, yy + 2, aw, bh);
    let fy = yy + 5;
    for (const f of facts) {
      const fl = wrapText(`${ICON.module} ${f}`, aw - 12).length * 10;
      if (fy + fl > yy + 2 + bh) continue;
      fy += ui.para(`${ICON.module} ${f}`, ax + 6, fy, aw - 12, C.hull3);
    }
    ui.unclip();
  }
  // the name, then fold or cancel
  if (app.nameDraft === null) app.nameDraft = sp.defaultName;
  ui.text('Name', ax, by + 3, C.hull2);
  app.nameDraft = textField(app, 'foldName', ax + 26, by, aw - 26, app.nameDraft);
  const bw = Math.floor((aw - 4) / 2);
  if (button(ui, 'doFold', ax, by + 16, bw, 15, top ? 'Fold it! S+' : 'Fold it!', { gold: true, pulse: true, tip: sp.foldTip })) {
    app.hud.focus = null;
    app.input.typing = null;
    if (sp.fold(app.nameDraft)) { app.panel = null; app.hud.stamped = false; app.gradeId = null; }
  }
  if (button(ui, 'cancelFold', ax + bw + 4, by + 16, bw, 15, sp.cancelLabel, { tip: sp.cancelTip })) {
    sp.cancel();
    app.panel = null;
    app.hud.stamped = false;
    app.gradeId = null;
  }
}

/** Confetti bursting from a point while app.hud.confetti lasts (screen-space, UI px). */
export function confetti(app: App, x: number, y: number) {
  const ui = app.ui;
  const h = app.hud;
  if (h.confetti > 0) {
    h.confetti--;
    for (let i = 0; i < 2; i++) h.flakes.push({ x, y, vx: (Math.random() - 0.5) * 160, vy: -60 - Math.random() * 120, t: 0, f: Math.floor(Math.random() * 8) });
  }
  const s = sheet('fx_confetti');
  const cols = [C.gold, C.leaf, C.teal1, C.pipRed, C.hot, C.violet];
  for (const p of h.flakes) {
    p.t += ui.dt;
    p.vy += 220 * ui.dt;
    p.x += p.vx * ui.dt;
    p.y += p.vy * ui.dt;
    if (!s.placeholder) ui.ctx.drawImage(s.frames[p.f % s.frames.length], Math.round(p.x), Math.round(p.y));
    else ui.fill(Math.round(p.x), Math.round(p.y), 2, 2, cols[p.f % cols.length]);
  }
  h.flakes = h.flakes.filter((p) => p.t < 2 && p.y < ui.h);
}

// ------------------------------------------------------------------ the Modules screen

let modPage = 0;

export function modulesScreen(app: App, r: Rect) {
  const ui = app.ui;
  const g = app.game;
  const n = g.s.designs.length;
  screenHeader(app, r, `Modules: ${n} design${n === 1 ? '' : 's'}`, C.gold, 'fold');
  const y0 = r.y + 22, bottom = r.y + r.h - 6;
  const sbW = r.w >= 600 ? 172 : r.w >= 470 ? 150 : 0;
  const gx = r.x + 8, gw = r.w - 16 - (sbW ? sbW + 6 : 0);
  const paged = !!sbW && n > Math.max(1, Math.floor((gw + 5) / 169)) * Math.max(1, Math.floor((bottom - y0 + 5) / 106));
  if (sbW) ledger(app, r.x + r.w - 8 - sbW, y0, sbW, bottom - y0, paged ? 20 : 0);
  if (!n) {
    const inner = card(ui, gx, y0, gw, Math.min(120, bottom - y0), 'How folding works', C.gold, 'fold');
    ui.para(g.done('folding')
      ? 'Press F (or the Fold tool) and drag a box over a working line, at most 8x8. It runs 70 s while you play; then it is graded and you fold it into a one-tile module with its rates. Place modules on the Factory floor.'
      : 'Research Folding first (the last node in the tree). Then you can box up a working line and fold it into a single tile.', inner.x, inner.y, inner.w, C.bone);
    return;
  }
  const minW = 164, ch = 101;
  const cols = Math.max(1, Math.floor((gw + 5) / (minW + 5)));
  const cw = Math.floor((gw + 5) / cols) - 5;
  // the pager sits in the ledger when there is one, else under the cards
  const pagerH = sbW ? 0 : 16;
  let rows = Math.max(1, Math.floor((bottom - y0 + 5) / (ch + 5)));
  if (!sbW && n > cols * rows) rows = Math.max(1, Math.floor((bottom - y0 - pagerH + 5) / (ch + 5)));
  const per = cols * rows;
  const pageN = Math.max(1, Math.ceil(n / per));
  modPage = Math.min(modPage, pageN - 1);
  g.s.designs.slice(modPage * per, modPage * per + per).forEach((d, i) => {
    designCard(app, d, gx + (i % cols) * (cw + 5), y0 + Math.floor(i / cols) * (ch + 5), cw, ch);
  });
  if (pageN > 1) {
    const px = sbW ? r.x + r.w - 8 - sbW + 5 : gx, pw = sbW ? sbW - 10 : gw;
    const py = bottom - (sbW ? 18 : 13);
    if (button(ui, 'modPrev', px, py, 30, 13, ICON.left, { disabled: modPage === 0, tip: 'Previous page' })) modPage--;
    ui.text(`Page ${modPage + 1} of ${pageN}`, px + pw / 2, py + 3, C.bone, { align: 'center' });
    if (button(ui, 'modNext', px + pw - 30, py, 30, 13, ICON.right, { disabled: modPage >= pageN - 1, tip: 'Next page' })) modPage++;
  }
}

/** A module's case drawn big, with its product in the well; a depth-2 design in a doubled frame. */
function bigModule(app: App, d: ModuleDesign, x: number, y: number) {
  const ui = app.ui;
  const g = app.game;
  if (d.depth === 2) {
    ui.fill(x - 3, y - 3, 38, 38, C.ink);
    ui.fill(x - 2, y - 2, 36, 36, Math.floor(ui.time * 2) % 2 ? C.teal1 : C.teal0);
    ui.fill(x - 1, y - 1, 34, 34, C.ink);
  }
  ui.ctx.drawImage(sheet('module').frames[0], x, y, 32, 32);
  const out = mainOutput(g, d.id);
  if (out) ui.ctx.drawImage(itemIcon(out), x + 8, y + 8, 16, 16);
}

function designCard(app: App, d: ModuleDesign, x: number, y: number, w: number, h: number) {
  const ui = app.ui;
  const g = app.game;
  frame(ui, x, y, w, h, 'inset');
  const ctx = ui.ctx;
  const deep = d.depth === 2;
  if (deep) ui.fill(x + 1, y + 1, w - 2, 1, C.teal1);
  // the left column: the module, its grade and multiplier
  bigModule(app, d, x + 5, y + 5);
  gradeIcon(app, d.grade.letter, x + 9, y + 41, 24);
  ui.text(`x${d.grade.mult.toFixed(2)}`, x + 21, y + 67, GRADE_COL[d.grade.letter], { align: 'center' });
  // the right column
  const tx = x + 42, tr = x + w - 5;
  const name = textField(app, 'name:' + d.id, tx, y + 5, tr - tx, app.hud.focus === 'name:' + d.id ? app.hud.draft : d.name);
  if (app.hud.focus !== 'name:' + d.id && name !== d.name) app.act({ k: 'rename', id: d.id, name });
  if (app.hud.focus === 'name:' + d.id && app.hud.draft !== d.name && !app.input.typing) app.act({ k: 'rename', id: d.id, name: app.hud.draft });
  const placed = g.s.factory.ents.filter((e) => e.kind === 'module' && e.design === d.id).length;
  ui.text(`Spare ${d.spare}  Placed ${placed}`, tx, y + 21, C.hull3);
  if (deep) {
    const px = tx + textWidth(`Spare ${d.spare}  Placed ${placed}`) + 6;
    ui.fill(px, y + 20, 34, 9, C.teal0);
    ui.text('DEPTH 2', px + 17, y + 21, C.ink, { align: 'center' });
    ui.hint(px, y + 20, 34, 9, `Folded on the Factory floor from ${(d.fparts ?? []).filter((p) => p.kind === 'module').length} modules: their rates times this grade, in one tile.`, 170);
  } else ui.text('/min', tr, y + 21, C.hull1, { align: 'right' });
  let yy = y + 31;
  const line = (label: string, t: Partial<Record<ItemId, number>>, col: string, none: string) => {
    let ix = tx;
    ui.text(label, ix, yy, C.hull2);
    ix += 16;
    const ents = Object.entries(t) as [ItemId, number][];
    for (const [it, r] of ents) {
      const s = perMin(r);
      if (ix + 10 + textWidth(s) > tr) break;
      ctx.drawImage(itemIcon(it), ix, yy);
      ix += 13 + ui.text(s, ix + 10, yy, col);
    }
    if (!ents.length) ui.text(none, ix, yy, C.hull1);
    yy += 10;
  };
  line('out', d.outs, C.leaf, '-');
  line('in', d.ins, C.copper2, 'nothing: a source');
  // the stamp's price, per product
  const cost = stampCost(g, d);
  const copies = productCopies(g, d);
  const item = mainItem(d);
  const pname = item ? itemName(item).toLowerCase() : 'this product';
  yy += 1;
  const full = `${fmt(d.bill)} x (1 + 0.5 x ${copies}) = ${cost.format()}`;
  ui.clip(tx, yy, tr - tx, 10);
  ui.text(textWidth(full) + 4 <= tr - tx ? full : `${fmt(d.bill)} x ${(1 + RULES.stampGrowth.value * copies).toFixed(1)} = ${cost.format()}`, tx, yy, C.gold);
  ui.unclip();
  ui.hint(tx, yy - 1, tr - tx, 10, [{ text: 'The stamp price, per product', color: C.gold }, { text: `The bill (${fmt(d.bill)} coin of machines inside) x (1 + 0.5 x n), where n = ${copies}: every copy already made of anything whose main product is ${pname}, across all your designs. Linear: the 5th copy costs 3x the first.` }], 200);
  yy += 10;
  // Machine Kits and claims
  const kits = kitsFor(g, d);
  let ix = tx;
  icon(app, 'kit', ix, yy, true);
  const ks = kits ? `${kits} kit${kits > 1 ? 's' : ''}` : 'no kits';
  ui.text(ks, ix + 10, yy, kits ? (g.s.parts.gte(kits) ? C.bone : C.pipRed) : C.hull1);
  ui.hint(ix, yy - 1, 12 + textWidth(ks), 10, kits ? `Machine Kits per copy: 1 + floor(${fmt(d.bill)} / ${fmt(RULES.kitDivisor.value)}). You have ${g.s.parts.format()}.` : 'Slice-era machines only: copies cost coin alone.', 180);
  ix += 16 + textWidth(ks);
  const ores = Object.keys(oresOf(g, d)) as ItemId[];
  for (const ore of ores) {
    const held = claimsHeld(g, ore), used = claimsUsed(g, ore);
    const s = `${itemName(ore).replace(' ore', '').toLowerCase()} ${used}/${held}`;
    if (ix + 12 + textWidth(s) > tr) break;
    icon(app, 'claim', ix, yy, true);
    ui.text(s, ix + 10, yy, used < held ? C.leaf : C.pipRed);
    ui.hint(ix, yy - 1, 12 + textWidth(s), 10, `Each copy holds a ${itemName(ore).toLowerCase()} claim: ${used} of ${held} in use.`, 170);
    ix += 14 + textWidth(s);
  }
  yy += 10;
  // why not, in red, across the card
  const why = stampRefusal(g, d);
  if (why) {
    ui.clip(x + 5, yy, w - 10, 10);
    ui.text(why, x + 5, yy, C.pipRed);
    ui.unclip();
    ui.hint(x + 5, yy - 1, w - 10, 10, why, 180);
  }
  // the buttons: Place, Stamp, Unfold in a row
  const by = y + h - 17;
  const b3 = Math.floor((w - 10 - 6) / 3);
  if (button(ui, 'place:' + d.id, x + 5, by, b3, 13, d.spare ? `Place ${d.spare}` : 'Place', { gold: d.spare > 0, disabled: d.spare < 1 || !g.flag('factoryOpen'), tip: 'Put a spare copy on the Factory floor.' })) app.pickModule(d.id);
  const label = textWidth(`Stamp ${cost.format()}`) <= b3 - 6 ? `Stamp ${cost.format()}` : `+${cost.format()}`;
  if (button(ui, 'stamp:' + d.id, x + 8 + b3, by, b3, 13, label, { disabled: !!why, tip: [{ text: `Stamp a copy: ${cost.format()} coin${kits ? ` and ${kits} Machine Kit${kits > 1 ? 's' : ''}` : ''}`, color: C.gold }, { text: why ?? `Copies of ${pname} so far: ${copies}. The one after this costs ${Num.of(Math.round(d.bill * (1 + RULES.stampGrowth.value * (copies + 1)))).format()}.` }] })) app.act({ k: 'stamp', id: d.id });
  const uwhy = unfoldRefusal(g, d);
  if (button(ui, 'unfold:' + d.id, x + 11 + 2 * b3, by, w - 16 - 2 * b3, 13, 'Unfold', { disabled: !!uwhy, tip: uwhy ?? `Put it back on the ${deep ? 'Factory floor' : 'Workshop'} where it was folded (${d.box.x},${d.box.y}) to change the design. ${deep ? 'Trunks' : 'Belts'} are bought again.` })) {
    if (app.act({ k: 'unfold', id: d.id }).ok) {
      app.panel = null;
      app.setFloor(deep ? 'factory' : 'workshop', true);
      app.lookAt(d.box.x + d.box.w / 2, d.box.y + d.box.h / 2);
    }
  }
}

/** The Modules screen's side ledger: Machine Kits, products and their copies, claims, and how far
 * the Factory is from the slice's end. */
function ledger(app: App, x: number, y: number, w: number, h: number, foot = 0) {
  const ui = app.ui;
  const g = app.game;
  const inner = card(ui, x, y, w, h, 'The ledger', C.gold, 'stats');
  const end = inner.y + inner.h - foot;
  let yy = inner.y;
  // the parts bank
  icon(app, 'kit', inner.x, yy - 1);
  ui.text('Machine Kits', inner.x + 19, yy, C.bone);
  ui.text(g.s.parts.format(), inner.x + inner.w, yy, g.s.parts.gt(0) ? C.gold : C.hull1, { align: 'right' });
  ui.text(g.done('machineKits') ? 'a Hopper banks them' : 'research Machine Kits', inner.x + 19, yy + 9, C.hull2);
  yy += 22;
  // products: copies so far and the next stamp's factor
  const prods = new Map<ItemId, number>();
  for (const d of g.s.designs) {
    const it = mainItem(d);
    if (it && !prods.has(it)) prods.set(it, productCopies(g, d));
  }
  ui.text('Products', inner.x, yy, C.gold);
  ui.text('next stamp', inner.x + inner.w, yy, C.hull2, { align: 'right' });
  yy += 10;
  for (const [it, n] of prods) {
    if (yy + 10 > end - 60) break;
    ui.ctx.drawImage(itemIcon(it), inner.x, yy);
    ui.clip(inner.x + 10, yy, inner.w - 50, 10);
    ui.text(`${ITEMS[it].name} (${n})`, inner.x + 10, yy, C.bone);
    ui.unclip();
    ui.text(`x${(1 + RULES.stampGrowth.value * n).toFixed(1)}`, inner.x + inner.w, yy, C.gold, { align: 'right' });
    ui.hint(inner.x, yy - 1, inner.w, 10, `${n} cop${n === 1 ? 'y' : 'ies'} of ${ITEMS[it].name.toLowerCase()} made so far: the next stamp of any design making it costs its bill x ${(1 + RULES.stampGrowth.value * n).toFixed(1)}.`, 180);
    yy += 10;
  }
  yy += 4;
  // claims by ore
  if (g.done('coalSeams') || g.s.designs.some((d) => Object.keys(oresOf(g, d)).length)) {
    ui.text('Ore claims', inner.x, yy, C.leaf);
    yy += 10;
    for (const ore of ['ironOre', 'copperOre', 'coal', 'sand'] as ItemId[]) {
      if (yy + 10 > end - 34) break;
      const held = claimsHeld(g, ore), used = claimsUsed(g, ore);
      ui.ctx.drawImage(itemIcon(ore), inner.x, yy);
      cells(app, inner.x + 11, yy + 1, inner.w - 46, 6, used, held, used <= held ? C.leaf : C.pipRed);
      ui.text(`${used}/${held}`, inner.x + inner.w, yy, used < held ? C.bone : C.pipYellow, { align: 'right' });
      yy += 10;
    }
    if (g.done('coalSeams') && yy + 14 <= end - 26) {
      if (button(ui, 'openSurvey', inner.x, yy + 1, inner.w, 13, 'Survey Office', { tip: 'Buy claims, 4 at a time.' })) app.panel = 'survey';
      yy += 17;
    }
  }
  // the slice's end, until it is reached: Bramble's Gizmo Festival, by the Factory Dock alone
  const fest = ORDER.gizmoFestival;
  if (!g.flag('sliceEnd') && fest && yy + 34 <= end) {
    const want = fest.wants.gizmo ?? 400;
    const have = Math.min(want, Math.floor(g.s.orders.progress.gizmoFestival?.gizmo?.toNumber() ?? 0));
    const gizmoMod = g.s.factory.ents.some((m) => { const q = m.kind === 'module' ? g.design(m.design) : null; return !!q && mainItem(q) === 'gizmo' && feedsDock(g, m); });
    ui.text('The Gizmo Festival', inner.x, yy, C.hot);
    yy += 10;
    ui.ctx.drawImage(itemIcon('gizmo'), inner.x, yy);
    bar(ui, inner.x + 11, yy + 1, inner.w - 50, 6, have / want, C.leaf);
    ui.text(`${have}/${want}`, inner.x + inner.w, yy, C.gold, { align: 'right' });
    yy += 10;
    ui.text(`${gizmoMod ? ICON.check : ICON.cross} a Gizmo module to the Factory Dock`, inner.x, yy, gizmoMod ? C.leaf : C.bone);
    ui.hint(inner.x, yy - 21, inner.w, 31, `Bramble's last order of the slice: ${want} Gizmos, counted only at the Factory Dock. Fold a Gizmo line and the gear and wire lines that feed it, place them, and trunk the Gizmos into the Factory Dock.`, 180);
    yy += 10;
  } else {
    const tip = 'Stamps grow by product, not design: a better line for the same product doesn\'t reset the price.';
    if (yy + wrapText(tip, inner.w).length * 10 <= end) ui.para(tip, inner.x, yy, inner.w, C.hull2);
  }
}

/** Why a module's output backs up, with both rates when the module downstream takes less than
 *  it is offered (the Milestone 4 review: "does not take it" when it took 34 of 81 a minute). */
function blockedWhy(g: App['game'], e: FEnt, d: ModuleDesign, to: FEnt | null, item: ItemId): string {
  if (!to) return 'Its front leads nowhere: lay a trunk from its gold mark to the Factory Dock.';
  const offered = d.outs[item] ?? 0;
  if (to.kind === 'module') {
    const td = g.design(to.design);
    const name = fname(g, to);
    const takes = td?.ins[item] ?? 0;
    if (!td || takes <= 0) {
      const wants = td ? (Object.keys(td.ins) as ItemId[]).map((k) => ITEMS[k].name.toLowerCase()) : [];
      return `${name} does not take ${ITEMS[item]?.name.toLowerCase() ?? 'it'}${wants.length ? `: it wants ${wants.join(', ')}` : ': it is a source and takes nothing'}. Turn this trunk to the Factory Dock.`;
    }
    if (to.state === 'blocked') return `${name} takes ${perMinW(takes)}/min but is blocked itself, so it takes nothing now. Clear its front first.`;
    if (takes < offered * 0.98) return `${name} takes ${perMinW(takes)} of the ${perMinW(offered)}/min offered: a trunk feeds one module. Fold a works that takes ${perMinW(offered)}/min, or split the source.`;
    return `${name} takes ${perMinW(takes)}/min, as much as is offered, but its input store is full.`;
  }
  if (to.kind === 'fbay') return 'The Megaproject Bay takes only what the Great Drill is built from (steel and Drill Bits).';
  return `The trunk is full: it carries ${FACTORY.trunkSpeed * 60}/min. Give the module a trunk of its own.`;
}

/** The hover report for a thing on the Factory floor. */
/** A report line, tagged with what it says so the hover report can pick the few that matter. */
interface RLine { text: string; color?: string; role?: 'status' | 'cause' | 'od' | 'odReady' | 'rate' }

export function factoryReport(app: App, e: FEnt): RLine[] {
  const g = app.game;
  const out: RLine[] = [{ text: fname(g, e), color: C.gold }];
  if (e.kind === 'trunk') {
    const r = g.routes.find((q) => q.tiles.includes(e));
    const cap = FACTORY.trunkSpeed * 60;
    out.push({ text: `Carrying ${Math.round(e.flow * 60)} of ${cap} a minute`, color: e.flow > FACTORY.trunkSpeed * 0.97 ? C.pipYellow : C.bone });
    if (r?.by) out.push({ text: 'A side route: it carries the module\'s byproducts (slag, oil).', color: C.violet });
    return out;
  }
  if (e.kind === 'fdock') return [...out, { text: 'Buys what reaches it, like the Workshop Dock. Fills the active order first. Slag is scrapped for nothing.' }];
  if (e.kind === 'fhopper') return [...out, { text: 'Counts toward the selected research, like the Workshop Hopper. Machine Kits go to the parts bank.' }];
  if (e.kind === 'fbay') {
    const st = megaStage(g.s.mega.stage);
    if (!st) return [...out, { text: 'The Great Drill runs: every Miner and source module +50%.', color: C.gold }, { text: 'Click to open.', color: C.hull2 }];
    out.push({ text: `${st.name}: ${Math.floor(megaFrac(g) * 100)}%`, color: C.bone });
    for (const [k, n] of Object.entries(st.wants) as [ItemId, number][]) out.push({ text: `${ITEMS[k].name}: ${fmt(Math.min(n, g.s.mega.progress[k]?.toNumber() ?? 0))} / ${fmt(n)}`, color: C.hull3 });
    out.push({ text: 'Trunk them in. Click to open the Megaproject.', color: C.hull2 });
    return out;
  }
  const d = g.design(e.design);
  if (!d) return out;
  const pct = Math.round(e.fAvg * 100);
  if (e.state === 'work') out.push({ text: `Working: ${pct}% of full speed lately`, color: C.pipGreen, role: 'status' });
  else if (e.state === 'starved') out.push({ text: `Starved of ${ITEMS[e.why as ItemId]?.name.toLowerCase() ?? 'input'} (${pct}% lately): feed its back`, color: C.pipYellow, role: 'status' });
  else if (e.state === 'blocked') {
    const r = g.routes.find((q) => q.from === e && !q.by);
    const item = e.why as ItemId;
    const iname = ITEMS[item]?.name.toLowerCase() ?? 'output';
    out.push({ text: `Blocked: ${iname} backs up`, color: C.pipRed, role: 'status' });
    out.push({ text: blockedWhy(g, e, d, r?.to ?? null, item), color: C.pipRed, role: 'cause' });
  } else out.push({ text: 'Idle', color: C.hull2, role: 'status' });
  if (e.spill) out.push({ text: `Spilling ${ITEMS[e.spill as ItemId]?.name.toLowerCase() ?? 'a product'}: what its front leads to doesn't take it all. Trunk it somewhere that does, or fold a works that uses it`, color: C.pipYellow, role: 'cause' });
  if (g.done('overdrive')) {
    const od = e.od ?? 0, cool = e.cool ?? 0;
    if (od > 0) out.push({ text: `Overdriven: ${RULES.overdriveMult.value}x for ${Math.ceil(od / TICK_RATE)} s more`, color: C.glow, role: 'od' });
    else if (cool > 0) out.push({ text: `Cooling: Overdrive again in ${Math.ceil(cool / TICK_RATE)} s`, color: C.hull2 });
    else out.push({ text: `Overdrive: click to run it and every module trunked to it ${RULES.overdriveMult.value}x for ${RULES.overdriveSeconds.value} s`, color: C.glow, role: 'odReady' });
  }
  out.push({ role: 'rate', text: `Makes ${Object.entries(d.outs).map(([k, v]) => `${perMin(v ?? 0)} ${ITEMS[k as ItemId].name.toLowerCase()}`).join(', ')} a minute at full speed` });
  if (Object.keys(d.ins).length) out.push({ text: `Takes ${Object.entries(d.ins).map(([k, v]) => `${perMin(v ?? 0)} ${ITEMS[k as ItemId].name.toLowerCase()}`).join(', ')} a minute at its back` });
  if (g.routes.some((q) => q.from === e && q.by && q.to)) out.push({ text: 'Byproducts leave by its side trunk', color: C.violet });
  out.push({ text: feedsDock(g, e) ? 'Feeds the Factory Dock' : 'Does not reach the Factory Dock yet', color: C.hull2 });
  if (d.depth === 2) out.push({ text: `Depth 2: folded from ${(d.fparts ?? []).filter((p) => p.kind === 'module').length} modules`, color: C.teal1 });
  out.push({ text: `Grade ${d.grade.letter}: rates x${d.grade.mult.toFixed(2)}`, color: GRADE_COL[d.grade.letter] });
  return out;
}

/** The hover report on the Factory floor, kept short (the Milestone 5-6 final round): a module's
 * name and grade, what it is doing, the one cause worth fixing, its rate; the rest is pinned by a
 * click. The Docks, the Hopper, the Bay and trunks say little enough to show whole. */
export function factoryHover(app: App, e: FEnt): { text: string; color?: string }[] {
  const all = factoryReport(app, e);
  const keys = e.kind === 'trunk' ? 'R rotates, X removes.' : e.kind === 'module' ? 'R rotates, X removes.' : '';
  if (e.kind !== 'module') return keys ? [...all, { text: keys, color: C.hull1 }] : all;
  const d = app.game.design(e.design);
  const shown = [all[0], ...all.filter((l) => l.role === 'status' || l.role === 'od'), all.find((l) => l.role === 'cause'), all.find((l) => l.role === 'rate')].filter((l): l is RLine => !!l);
  if (d) shown[0] = { text: `${all[0].text} (${d.grade.letter})`, color: all[0].color };
  const ready = all.some((l) => l.role === 'odReady');
  const more = all.length - shown.length - (ready ? 1 : 0);
  const what = `the full report${more > 0 ? ` (+${more} line${more > 1 ? 's' : ''})` : ''}`;
  const out: { text: string; color?: string }[] = shown.map((l) => ({ text: l.text, color: l.color }));
  if (ready) {
    out.push({ text: `Click: Overdrive it and every module trunked to it ${RULES.overdriveMult.value}x for ${RULES.overdriveSeconds.value} s`, color: C.glow });
    out.push({ text: `While it cools, a click pins ${what}. ${keys}`, color: C.hull1 });
  } else out.push({ text: `Click to pin ${what}. ${keys}`, color: C.hull1 });
  return out;
}

// ------------------------------------------------------------------ the offline report

export function offlineCard(app: App, L: Layout) {
  const ui = app.ui;
  const g = app.game;
  const rep = app.offline;
  if (!rep) { app.panel = null; return; }
  const O = L.overlay;
  ui.fill(O.x, O.y, O.w, O.h, C.ink, 0.6);
  const w = Math.min(300, O.w - 12), h = Math.min(224, O.h - 8);
  const x = O.x + Math.floor((O.w - w) / 2), y = O.y + Math.floor((O.h - h) / 2);
  frame(ui, x, y, w, h);
  const hm = (s: number) => (s >= 3600 ? `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m` : `${Math.floor(s / 60)}m ${Math.floor(s % 60)}s`);
  ui.fill(x + 3, y + 3, w - 6, 15, C.shadow);
  uiIcon(ui, 'clock', x + 6, y + 2);
  ui.text(`While you were away: ${hm(rep.away)}`, x + 26, y + 7, C.hot, { shadow: C.ink });
  let yy = y + 26;
  coinIcon(ui, x + 12, yy);
  ui.text(`+${rep.coin.format()}`, x + 34, yy + 1, C.gold, { scale: 2, shadow: C.brass0 });
  yy += 22;
  ui.text('coin earned', x + 34, yy - 4, C.hull2);
  yy += 8;
  if (!rep.hopper.isZero()) { ui.text(`${rep.hopper.format()} items into the Hopper`, x + 12, yy, C.teal1); yy += 11; }
  for (const r of rep.research) { ui.text(`${ICON.check} Research done: ${RESEARCH[r].name}`, x + 12, yy, C.leaf); yy += 11; }
  for (const o of rep.orders) { ui.text(`${ICON.check} Order filled: ${ORDER[o].name}`, x + 12, yy, C.leaf); yy += 11; }
  yy += 2;
  if (rep.firstJam) {
    const j = rep.firstJam;
    ui.text(`${hm(j.t)} in: ${j.name} blocked${j.why ? ` by ${ITEMS[j.why as ItemId]?.name.toLowerCase() ?? j.why}` : ''}`, x + 12, yy, C.pipRed);
    if (button(ui, 'gotoJam', x + w - 74, yy - 3, 62, 13, 'Go to it', { gold: true })) {
      app.panel = null;
      app.setFloor(j.floor, true);
      app.lookAt(j.x + 0.5, j.y + 0.5);
      if (j.floor === 'workshop') app.selected = g.entAt(j.x, j.y)?.id ?? null;
      else app.fselected = g.fentAt(j.x, j.y)?.id ?? null;
    }
    yy += 13;
  } else { ui.text(`${ICON.check} Nothing jammed in the first ${hm(rep.replayed)}.`, x + 12, yy, C.leaf); yy += 11; }
  const nh = (rep as { nextHeap?: { x: number; y: number; inSeconds: number } | null }).nextHeap;
  if (nh) {
    ui.text(`A Slag Heap fills in ${hm(nh.inSeconds)}`, x + 12, yy, C.pipYellow);
    if (button(ui, 'gotoHeap', x + w - 74, yy - 3, 62, 13, 'Show me')) {
      app.panel = null;
      app.offline = null;
      app.setFloor('workshop', true);
      app.lookAt(nh.x + 0.5, nh.y + 0.5);
      app.selected = g.entAt(nh.x, nh.y)?.id ?? null;
    }
  }
  ui.para(`The first ${hm(rep.replayed)} ran in full; the rest (${hm(rep.extrapolated)}) at half rate from what reached your Docks and Hoppers. Time away counts up to 24 h.`, x + 12, y + h - 58, w - 24, C.hull2);
  if (button(ui, 'offlineOk', x + Math.floor(w / 2) - 50, y + h - 20, 100, 15, 'Back to work', { gold: true })) { app.panel = null; app.offline = null; }
}

// ------------------------------------------------------------------ the slice's end

/** The products the Factory runs into the Factory Dock right now (main items of feeding modules). */
function factoryProducts(app: App): ItemId[] {
  const g = app.game;
  const out: ItemId[] = [];
  for (const m of g.s.factory.ents) {
    if (m.kind !== 'module' || !feedsDock(g, m)) continue;
    const d = g.design(m.design);
    const it = d ? mainItem(d) : null;
    if (it && !out.includes(it)) out.push(it);
  }
  return out;
}

/** Does any module's front trunk feed another module, both reaching the Factory Dock? */
function chainedNow(app: App): boolean {
  const g = app.game;
  return g.routes.some((r) => !r.by && r.to?.kind === 'module' && feedsDock(g, r.from));
}

function listNames(items: ItemId[]): string {
  const n = items.map((i) => ITEMS[i].name.toLowerCase().replace(/^(\w)/, (c) => c));
  if (n.length <= 1) return n[0] ?? 'things';
  return `${n.slice(0, -1).join(', ')} and ${n[n.length - 1]}`;
}

/** A strip of the Festival: boardwalk, stalls, lamps and bunting, frogs walking (UI px). */
function festivalScene(app: App, x: number, y: number, w: number, h: number, t: number) {
  const ui = app.ui;
  const ctx = ui.ctx;
  const k = h >= 64 ? 2 : 1;
  frame(ui, x - 1, y - 1, w + 2, h + 2, 'inset', false);
  ui.clip(x, y, w, h);
  // water, a dusk sky line, then the boardwalk along the bottom
  ctx.fillStyle = C.shadow;
  ctx.fillRect(x, y, w, h);
  if (hasArt('tile_water')) {
    const ws = sheet('tile_water');
    for (let yy = y; yy < y + h; yy += 16 * k) for (let xx = x; xx < x + w; xx += 16 * k) ctx.drawImage(ws.frames[(Math.floor(t * 4) + xx + yy) & 3], xx, yy, 16 * k, 16 * k);
  }
  const deckY = y + h - 16 * k;
  const bw = sheet('town_boardwalk');
  for (let xx = x; xx < x + w; xx += 16 * k) ctx.drawImage(bw.frames[frameNamed(bw, 'h')], xx, deckY, 16 * k, 16 * k);
  const tops: { x: number; y: number }[] = [];
  const step = 64 * k;
  for (let i = 0, xx = x + 6 * k; xx < x + w - 16 * k; i++, xx += step / 2) {
    if (i % 2 === 0 && hasArt('town_lamp')) {
      const l = sheet('town_lamp');
      ctx.drawImage(l.frames[Math.floor(t * (l.fps || 6) + i) % l.frames.length], xx, deckY + 16 * k - l.h * k, l.w * k, l.h * k);
      tops.push({ x: xx + (l.w * k) / 2, y: deckY + 16 * k - l.h * k + 4 * k });
    } else if (hasArt('town_stall')) {
      const st = sheet('town_stall');
      ctx.drawImage(st.frames[Math.floor(t * (st.fps || 6) + i) % st.frames.length], xx - 8 * k, deckY + 16 * k - st.h * k, st.w * k, st.h * k);
    }
  }
  // bunting between the lamp tops
  const cols = [C.pipRed, C.gold, C.teal1, C.leaf, C.hot];
  for (let i = 0; i + 1 < tops.length; i++) {
    const a = tops[i], b = tops[i + 1];
    for (let j = 0; j <= 16; j++) {
      const u = j / 16;
      const bx = Math.round(a.x + (b.x - a.x) * u), by = Math.round(a.y + Math.sin(u * Math.PI) * 6 * k);
      ctx.fillStyle = j % 2 ? cols[(i + j) % cols.length] : C.ink;
      ctx.fillRect(bx, by, j % 2 ? 2 * k : k, j % 2 ? 2 * k : k);
    }
  }
  if (hasArt('town_frog')) {
    const fr = sheet('town_frog');
    for (let i = 0; i < 6; i++) {
      const sp = 14 + i * 5;
      const span = w + 16 * k;
      const d = (t * sp * k + i * 53 * k) % (span * 2);
      const back = d >= span;
      const fx = x - 16 * k + (back ? span * 2 - d : d);
      const img = fr.frames[Math.floor(t * (fr.fps || 8) + i) % fr.frames.length];
      const fy = deckY - 6 * k;
      if (back) { ctx.save(); ctx.translate(Math.round(fx) + fr.w * k, 0); ctx.scale(-1, 1); ctx.drawImage(img, 0, fy, fr.w * k, fr.h * k); ctx.restore(); }
      else ctx.drawImage(img, Math.round(fx), fy, fr.w * k, fr.h * k);
    }
  }
  ui.unclip();
}

/** the slice-end card's count-up and its one-time rain, keyed by when the card opened */
let sliceOpened = -1;
let sliceTicks = 0;
let sliceLanded = false;

/** The slice's end (the Milestone 4 review: it was a plain table missing the Festival's 64K):
 *  a celebration. Gold rays behind the card, confetti over the screen, Bramble cheering at 2x,
 *  the payout counted up big with ticks and a slam, the Festival's 400 Gizmos popping in, and
 *  the factory's numbers as tiles. */
export function sliceEndCard(app: App, L: Layout) {
  const ui = app.ui;
  const g = app.game;
  const O = L.overlay;
  const fest = ORDER.gizmoFestival;
  const pays = fest?.pays ?? 64000;
  const want = fest?.wants.gizmo ?? 400;
  const t = ui.time - app.gradeAt;
  if (sliceOpened !== app.gradeAt) {
    sliceOpened = app.gradeAt;
    sliceTicks = 0;
    sliceLanded = false;
    for (let i = 0; i < 180; i++) app.hud.rain.push({ x: Math.random() * ui.w, y: -Math.random() * ui.h * 0.9, vx: (Math.random() - 0.5) * 30, vy: 40 + Math.random() * 60, f: Math.floor(Math.random() * 8), spin: Math.random() * 6, gold: i % 3 === 0 });
    app.audio.sfx('fanfare', 0.9);
  }
  ui.fill(O.x, O.y, O.w, O.h, C.ink, 0.7);
  const w = Math.min(420, O.w - 12), h = Math.min(300, O.h - 8);
  const x = O.x + Math.floor((O.w - w) / 2), y = O.y + Math.floor((O.h - h) / 2);
  // gold rays turning behind the whole card, over the dimmed floor
  ui.clip(O.x, O.y, O.w, O.h);
  rays(app, x + w / 2, y + h / 2, Math.max(O.w, O.h), C.gold, 18);
  ui.unclip();
  frame(ui, x, y, w, h);
  ui.fill(x + 3, y + 3, w - 6, 15, C.shadow);
  ui.fill(x + 3, y + 17, w - 6, 1, Math.floor(ui.time * 4) % 2 ? C.gold : C.hot);
  uiIcon(ui, 'star', x + 6, y + 2);
  ui.text('Milestone: the Gizmo Festival!', x + w / 2, y + 7, Math.floor(ui.time * 3) % 2 ? C.gold : C.hot, { align: 'center', shadow: C.ink });
  if (t < 4 && Math.floor(t * 30) % 2 === 0) app.hud.confetti = Math.max(app.hud.confetti, 2);
  // Bramble cheering, bouncing, at 2x when the card is big enough
  const P = h >= 290 && w >= 400 ? 96 : 48;
  const px0 = x + 10, py0 = y + 24;
  frame(ui, px0 - 2, py0 - 2, P + 4, P + 4, 'inset', false);
  ui.clip(px0, py0, P, P);
  ui.fill(px0, py0, P, P, C.moss);
  rays(app, px0 + P / 2, py0 + P / 2, P, C.gold, 10);
  const bounce = Math.floor(t * 4) % 2 ? -Math.max(1, P / 48) : 0;
  if (hasArt('portrait_bramble_cheer')) {
    const s = sheet('portrait_bramble_cheer');
    ui.ctx.drawImage(s.frames[Math.floor(t * 4) % s.frames.length], px0, py0 + bounce, P, P);
  } else if (hasArt('portrait_bramble')) ui.ctx.drawImage(sheet('portrait_bramble').frames[0], px0, py0 + bounce, P, P);
  ui.unclip();
  if (!hasArt('portrait_bramble_cheer') && !hasArt('portrait_bramble')) portrait(ui, 'bramble', px0, py0, 48);
  confetti(app, px0 + P / 2, py0 + P / 3);
  // the payout: counted up from 0 over 1.6 s with ticks, then it slams and bumps
  const rx = px0 + P + 12, rw = x + w - 10 - rx;
  let ry = py0;
  ui.text('The Festival pays', rx, ry, C.hull2);
  ry += 10;
  const k = Math.min(1, Math.max(0, (t - 0.3) / 1.6));
  const ease = 1 - (1 - k) ** 3;
  const shown = Math.round(pays * ease);
  const step = Math.floor(k * 24);
  if (step > sliceTicks && k < 1) { sliceTicks = step; app.audio.sfx('coin', 0.5, 0.8 + k * 0.8); }
  if (k >= 1 && !sliceLanded) {
    sliceLanded = true;
    app.audio.sfx('stampLand', 1);
    app.audio.sfx('codex', 0.8, 1.3);
    app.renderer.fx.kick(5);
    app.hud.confetti = Math.max(app.hud.confetti, 80);
  }
  const num = `+${fmt(shown)}`;
  const big = textWidth(`+${fmt(pays)}`) * 3 + 22 <= rw ? 3 : 2;
  const landT = t - 1.9;
  coinIcon(ui, rx, ry + (big === 3 ? 3 : 0));
  ui.text(num, rx + 20, ry - (k >= 1 && landT < 0.15 ? 1 : 0), k >= 1 ? (Math.floor(ui.time * 5) % 2 ? C.gold : C.hot) : C.gold, { scale: big, shadow: C.brass0 });
  if (k >= 1 && landT < 0.6) {
    // a burst of sparkles off the number as it lands
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2, rr = 6 + landT * 60;
      ui.ctx.fillStyle = i % 2 ? C.gold : C.bone;
      ui.ctx.fillRect(Math.round(rx + 20 + (textWidth(num) * big) / 2 + Math.cos(a) * rr), Math.round(ry + 10 + Math.sin(a) * rr * 0.6), 2, 2);
    }
  }
  ry += 9 * big + 3;
  const earned = g.s.earned.toNumber();
  const share = earned > 0 ? Math.round((pays / earned) * 100) : 0;
  ui.clip(rx, ry, rw, 10);
  ui.text(share > 0 && share <= 100 ? `${share}% of all the coin you have earned` : "Bramble's biggest order yet", rx, ry, C.leaf);
  ui.unclip();
  ry += 13;
  // the 400 Gizmos: one icon per 20, popping in one by one
  ui.text(`${fmt(want)} Gizmos, one Dock`, rx, ry, C.bone);
  ry += 10;
  let rEnd = ry;
  const per = 20, n = Math.ceil(want / per);
  const cols = Math.max(1, Math.floor(rw / 11));
  const rows = Math.ceil(n / cols);
  if (P - (ry - py0) >= rows * 11) {
    const on = Math.min(n, Math.floor(Math.max(0, t - 0.2) * 14));
    for (let i = 0; i < on; i++) {
      const ix = rx + (i % cols) * 11, iy = ry + Math.floor(i / cols) * 11;
      const fresh = Math.max(0, t - 0.2) * 14 - i < 1.5;
      ui.fill(ix, iy, 10, 10, fresh ? C.gold : C.brass0);
      ui.ctx.drawImage(itemIcon('gizmo'), ix + 1, iy + 1 - (fresh ? 1 : 0));
    }
    ui.hint(rx, ry, cols * 11, rows * 11, `Each one is ${per} Gizmos: ${fmt(want)} delivered at the Factory Dock.`, 160);
    rEnd = ry + rows * 11;
  }
  // Bramble, under the portrait, across the card
  const prods = factoryProducts(app);
  const named = listNames(prods.slice(0, 4));
  let yy = Math.max(py0 + P + 8, rEnd + 4);
  const quote = `"${fmt(want)} Gizmos! ${named[0].toUpperCase() + named.slice(1)}, humming into one Dock${chainedNow(app) ? ', one module feeding the next' : ''}. I understand none of it and I love all of it. Ribbit!"`;
  yy += ui.para(quote, x + 12, yy, w - 24, C.bone) + 4;
  // the factory's numbers as tiles
  const secs = Math.floor(g.seconds);
  const best = g.s.designs.map((d) => d.grade.letter).sort((a, b) => GRADE_RANK.indexOf(a) - GRADE_RANK.indexOf(b))[0] ?? '-';
  const mods = g.s.factory.ents.filter((e) => e.kind === 'module').length;
  const tiles: [string, string, string][] = [
    [`${Math.floor(secs / 3600)}h ${Math.floor((secs % 3600) / 60)}m`, 'played', C.bone],
    [g.s.earned.format(), 'coin earned', C.gold],
    [String(mods), 'modules placed', C.gold],
    [String(g.s.designs.length), 'designs folded', C.bone],
    [String(Math.max(sliceEndParts(g).designs, prods.length)), 'products to Dock', C.leaf],
    [best, 'best grade', GRADE_COL[best] ?? C.bone],
  ];
  const tcols = 3, gap = 4;
  const tw = Math.floor((w - 24 - gap * (tcols - 1)) / tcols), th = 22;
  const bottom = y + h - 44;
  tiles.forEach(([v, label, col], i) => {
    const tx = x + 12 + (i % tcols) * (tw + gap), ty = yy + Math.floor(i / tcols) * (th + 3);
    if (ty + th > bottom) return;
    // tiles pop in one after another
    if (t < 0.4 + i * 0.12) return;
    frame(ui, tx, ty, tw, th, 'inset', false);
    const sc = textWidth(v) * 2 + textWidth(label) + 14 <= tw ? 2 : 1;
    if (sc === 2) {
      ui.text(v, tx + 4, ty + 4, col, { scale: 2, shadow: C.ink });
      ui.text(label, tx + tw - 4, ty + 11, C.hull2, { align: 'right' });
    } else {
      ui.clip(tx, ty, tw, th);
      ui.text(v, tx + 4, ty + 2, col, { shadow: C.ink });
      ui.text(label, tx + 4, ty + 12, C.hull2);
      ui.unclip();
    }
  });
  yy += 2 * (th + 3);
  // what runs into the Factory Dock, while there is room
  if (yy + 14 <= bottom) {
    let ix = x + 12;
    for (const it of prods.slice(0, 6)) {
      const s2 = ITEMS[it].name;
      if (ix + 20 + textWidth(s2) > x + w - 12) break;
      ui.fill(ix, yy, 12, 12, C.ink);
      ui.ctx.drawImage(itemIcon(it), ix + 2, yy + 2);
      ix += 22 + ui.text(s2, ix + 15, yy + 3, C.gold);
    }
    yy += 16;
  }
  // the Festival itself, in whatever room is left: the town's boardwalk with its stalls, lamps,
  // bunting and townsfrogs strolling (the town's own sprites, when drawn)
  const sceneH = bottom - yy;
  if (sceneH >= 36 && hasArt('town_boardwalk')) festivalScene(app, x + 8, yy, w - 16, Math.min(sceneH, 72), t);

  ui.para('Act II opens from here: coal, steel, power and two new customers. Keep folding.', x + 14, y + h - 40, w - 28, C.teal1);
  if (button(ui, 'sliceOk', x + Math.floor(w / 2) - 55, y + h - 20, 110, 16, 'Keep building', { gold: true, pulse: true })) app.panel = null;
}

export { Num, copiesOf };
