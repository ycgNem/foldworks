// Folding's screens and HUD pieces (DESIGN.md §10, §11, §18), in the 180's ink on paper
// (docs/hud-180.md): the Inspector's clipboard hanging on a string from each box being audited
// (the countdown, the projected grade, U/W/C as meters, the coin the line makes), his report slip
// once it is graded (the grade stamped in red ink, U/W/C with their numbers, the rates as icon
// rows, the advice as rows with their worth, his verdict in a bubble, a name and "Fold it!") for
// Workshop lines and for nested folds on the Factory floor, the Modules pages of the ledger book
// (folded paper cards with their stamp, rates, copies and chips; the ledger beside them), the
// Factory floor's reports, and the slice's closing card. Reads the App and the Game; changes the
// game only through App.act.
import { C, rgba } from '../data/palette';
import { ITEMS, itemName, type ItemId } from '../data/items';
import { ORDER } from '../data/orders';
import { RULES, SCORE_WEIGHTS, GRADES } from '../data/rules';
import { prules } from '../sim/patents'; // Milestone 5: the Patent rules (More Auditors, Quick Audits)
import type { Game } from '../sim/Game';
import { ICON, textWidth, bigWidth, smallWidth, ellipsize, LINE_H } from '../ui/font';
import { TICK_RATE } from '../engine/time';
import { Num } from '../engine/num';
import { sheet, itemIcon, hasArt, spriteName, frameNamed } from '../render/sprites';
import { mainOutput } from '../render/factory';
import { auditTicks, projectAudit, entsIn, gradedAudit } from '../sim/systems/audits';
import { BUILD } from '../data/machines';
import { gradeFAudit } from '../sim/systems/nested';
import { inBill, defaultName, stampCost, stampRefusal, unfoldRefusal, fname, feedsDock, productCopies, kitsFor, mainItem, sliceEndParts } from '../sim/systems/modules';
import { claimsHeld, claimsUsed, oresOf, copiesOf } from '../sim/systems/claims';
import type { AuditResult, AuditState, Box, FAuditState, ModuleDesign } from '../sim/world';
import { frame, button, uiIcon, portrait, coinIcon, clipboard, chip, chipWidth, meter, tag, tagSize, bubble, ribbon, rule, twine, RIBBON_H, CHIP_H, T, type Role } from './chrome';
import { perMin as perMinW, menuTemplate, cells, fmt, rays, slamScale } from './widgets';
import { drawRich, layoutRich, richWidth, richHeight } from '../ui/rich';
import { paperRaw, hash2, stampCanvas } from '../ui/paper';
import type { Layout } from './layout';
import { zones } from './tags';
import { hgradeCard } from './district';
import type { App } from './app';
import type { Rect } from '../ui/ui';

/** the grade art's frame order (S+ is the sixth frame, drawn after the first five) */
const GRADE_ORDER = ['S', 'A', 'B', 'C', 'D', 'S+'];
/** best first, for sorting */
export const GRADE_RANK = ['S+', 'S', 'A', 'B', 'C', 'D'];
/** The grade colours over the floor and on the old dark plates (the build bar's module slots). */
export const GRADE_COL: Record<string, string> = { 'S+': C.gold, S: C.gold, A: C.leaf, B: C.teal1, C: C.copper2, D: C.pipRed };
/** The grade's ink on paper (each a theme role: at least 4.4:1 on paper). */
export const GRADE_INK: Record<string, string> = { 'S+': T.coin, S: T.coin, A: T.good, B: T.research, C: T.warn, D: T.bad };
const gradeRole = (v: number): Role => (v >= 0.9 ? 'good' : v >= 0.6 ? 'warn' : 'bad');

/** The grade art's frame for a letter (S+ falls back to S, with a plus drawn over it, until its
 * own frame exists). */
function gradeFrame(letter: string): { img: CanvasImageSource; plus: boolean } {
  const fr = sheet('ui_grade').frames;
  const i = GRADE_ORDER.indexOf(letter);
  if (i >= 0 && i < fr.length) return { img: fr[i], plus: false };
  return { img: fr[0], plus: letter === 'S+' };
}

/** A plus beside an S emblem drawn at (x, y, size). */
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

const rgbOf = (hex: string): [number, number, number] => {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

const stamps = new Map<string, HTMLCanvasElement>();

/** The Inspector's rubber stamp for a grade: the grade art's letter (and the stamp ring with
 * `ring`) as a red-ink impression, its outline a deeper red, worn where the ink didn't take.
 * 48x48 with the ring, 32x32 without; the kit's word stamp until the art loads. */
function gradeStamp(letter: string, ring: boolean): HTMLCanvasElement {
  const key = letter + (ring ? ':r' : '');
  const hit = stamps.get(key);
  if (hit) return hit;
  if (!hasArt('ui_grade')) return stampCanvas(letter, T.badFill);
  const S = ring ? 48 : 32, off = ring ? 8 : 0;
  const cv = document.createElement('canvas');
  cv.width = S;
  cv.height = S;
  const c = cv.getContext('2d')!;
  const f = gradeFrame(letter);
  c.drawImage(f.img, off, off);
  if (f.plus) drawPlus(c, off, off, 32);
  const d = c.getImageData(0, 0, S, S);
  const deep = rgbOf(C.copper0), ink = rgbOf(T.badFill);
  const seed = letter.charCodeAt(0) * 7 + letter.length;
  for (let j = 0; j < S; j++)
    for (let i = 0; i < S; i++) {
      const p = (j * S + i) * 4;
      if (d.data[p + 3] < 40) continue;
      const lum = (d.data[p] * 0.3 + d.data[p + 1] * 0.59 + d.data[p + 2] * 0.11) / 255;
      const col = lum < 0.3 ? deep : ink;
      d.data[p] = col[0];
      d.data[p + 1] = col[1];
      d.data[p + 2] = col[2];
      // the rubber's wear: specks where no ink took, and a lighter band across it
      const wear = hash2(i + seed, j * 3 + seed) < (ring ? 0.05 : 0.03) || (hash2(i >> 2, j >> 2) < 0.1 && hash2(i, j) < 0.3);
      d.data[p + 3] = wear ? 0 : lum < 0.3 ? 245 : 225;
    }
  c.putImageData(d, 0, 0);
  if (ring && hasArt('ui_stamp_ring')) c.drawImage(sheet('ui_stamp_ring').frames[0], 0, 0);
  stamps.set(key, cv);
  return cv;
}

/** The Inspector's report on its clipboard, drawn big: a hardboard with rounded corners and a
 * soft shadow, a second sheet peeking under the report, and a steel clip across the top centre.
 * Returns the report sheet's content rect. */
function reportBoard(ui: App['ui'], x: number, y: number, w: number, h: number): Rect {
  const ctx = ui.ctx;
  x = Math.round(x); y = Math.round(y);
  ui.region(x, y, w, h, 'panel', true);
  const f = (c: string, a: number, b: number, ww: number, hh: number) => { ctx.fillStyle = c; ctx.fillRect(x + a, y + b, ww, hh); };
  // the board
  f(rgba(T.shadow, 0.35), 3, 4, w, h);
  f(C.ink, 2, 0, w - 4, h);
  f(C.ink, 0, 2, w, h - 4);
  f(C.ink, 1, 1, w - 2, h - 2);
  f(C.wood2, 2, 2, w - 4, h - 4);
  f(C.wood1, 1, 3, w - 2, h - 6);
  f(C.wood2, 2, 3, w - 4, h - 6);
  f(C.wood3, 2, 2, w - 4, 1);
  f(C.wood1, 2, h - 3, w - 4, 1);
  // its grain: a few long faint streaks
  for (let i = 0; i < 9; i++) {
    const gy = 6 + Math.floor(hash2(i, w) * (h - 12)), gx = 4 + Math.floor(hash2(w, i) * (w * 0.6));
    f(rgba(C.wood3, 0.5), gx, gy, Math.floor(20 + hash2(i, h) * 60), 1);
  }
  // the sheets: one under, a little skewed, then the report
  const px = 7, py = 12, pw = w - 14, ph = h - 19;
  paperRaw(ctx, x + px + 2, y + py + 2, pw, ph, { shadow: false, deckle: false, fill: T.paperLo });
  paperRaw(ctx, x + px, y + py, pw, ph, { shadow: false });
  ctx.fillStyle = rgba(T.shadow, 0.25);
  ctx.fillRect(x + px + 1, y + py + ph, pw, 1);
  // the clip: a steel plate over the top edge, its lever, two rivets
  const cw = Math.min(64, Math.floor(w * 0.22)), cx = x + Math.floor((w - cw) / 2), cy = y - 3;
  const g = (c: string, a: number, b: number, ww: number, hh: number) => { ctx.fillStyle = c; ctx.fillRect(cx + a, cy + b, ww, hh); };
  g(rgba(T.shadow, 0.35), 2, 3, cw, 17);
  g(C.ink, 1, 0, cw - 2, 18);
  g(C.ink, 0, 1, cw, 16);
  g(C.steel3, 1, 1, cw - 2, 16);
  g(C.steel4, 1, 1, cw - 2, 2);
  g(C.steel2, 1, 14, cw - 2, 3);
  g(C.steel1, 1, 16, cw - 2, 1);
  // the lever: a ring standing up off the plate
  const lw = Math.floor(cw * 0.5), lx = Math.floor((cw - lw) / 2);
  g(C.ink, lx, -5, lw, 6);
  g(C.steel2, lx + 1, -4, lw - 2, 2);
  g(C.steel4, lx + 1, -4, lw - 2, 1);
  g(C.ink, lx + 3, -2, lw - 6, 3);
  for (const rx of [4, cw - 7]) { g(C.ink, rx, 7, 3, 3); g(C.steel4, rx, 7, 1, 1); }
  return { x: x + px + 6, y: y + py + 9, w: pw - 12, h: ph - 13 };
}

/** Draw a stamp canvas centred on (cx, cy) at an integer scale, turned `angle` radians. */
function drawStamp(ctx: CanvasRenderingContext2D, cv: HTMLCanvasElement, cx: number, cy: number, scale: number, angle: number, alpha = 0.95) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(Math.round(cx), Math.round(cy));
  if (angle) ctx.rotate(angle);
  const w = cv.width * scale, h = cv.height * scale;
  ctx.drawImage(cv, -Math.floor(w / 2), -Math.floor(h / 2), w, h);
  ctx.restore();
}

export const perMin = perMinW;

const warmTicks = (g?: Game) => (g ? prules(g).auditWarmup : RULES.auditWarmup.value) * TICK_RATE; // Quick Audits (§19)

/** Coin a minute a set of outputs is worth at the Dock (rates per second). */
function coinPerMin(outs: Partial<Record<ItemId, number>>, mult = 1): number {
  let c = 0;
  for (const [k, r] of Object.entries(outs) as [ItemId, number][]) c += r * 60 * ITEMS[k].value * mult;
  return c;
}

/** The next grade up from `letter` and the score it starts at (null at the top). */
function nextGrade(letter: string): { letter: string; min: number } | null {
  const i = GRADES.findIndex((q) => q.letter === letter);
  return i > 0 ? { letter: GRADES[i - 1].letter, min: GRADES[i - 1].min } : null;
}

// ------------------------------------------------------------------ a text field

/** A one-line text field on paper: a pressed well with an ink writing line and an ink caret;
 * focus with a click, Enter or Esc leaves. Returns the value. */
export function textField(app: App, id: string, x: number, y: number, w: number, value: string, max = 28): string {
  const ui = app.ui;
  const ctx = ui.ctx;
  const focused = app.hud.focus === id;
  app.hud.fieldSeen = true;
  const hov = ui.hover(x, y, w, 13);
  ui.region(x, y, w, 13, 'button');
  ctx.fillStyle = focused ? T.paperHi : hov ? rgba(T.paperHi, 0.85) : rgba(T.paperLo, 0.55);
  ctx.fillRect(x, y, w, 12);
  ctx.fillStyle = rgba(T.paperEdge, 0.7);
  ctx.fillRect(x, y, w, 1);
  ctx.fillRect(x, y, 1, 12);
  ctx.fillStyle = focused ? T.ink : T.inkSoft;
  ctx.fillRect(x, y + 12, w, 1);
  ui.clip(x + 2, y, w - 4, 13);
  const tw = textWidth(value);
  const sx = Math.min(x + 3, x + w - 6 - tw);
  ui.text(value, sx, y + 2, T.ink);
  if (focused && Math.floor(ui.time * 2) % 2 === 0) ui.fill(sx + tw + 1, y + 2, 1, 9, T.ink);
  ui.unclip();
  if (hov && ui.clicked) {
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

// ------------------------------------------------------------------ the audit clipboards

/** The graded Workshop audit the grade card shows: the one picked (by its clipboard), else the first. */
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

function openFGrade(app: App) {
  app.panel = 'fgrade';
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

const clampN = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/** the Inspector's clipboard on the floor */
const CB_W = 104, CB_H = 62;

/** Every audit on this floor as the Inspector's clipboard, hanging on a string beside its box
 * (right, left, below or above, wherever it covers the fewest boxes and other clipboards), with
 * the countdown, the projected grade, U/W/C as meters and the coin the line makes. A box off the
 * screen keeps a small tag at the edge, its string running toward it. A graded clipboard opens its
 * report; a running one shows its box. The audits on the other floor show as a tag with a Go
 * button. */
export function auditBadge(app: App, L: Layout) {
  const g = app.game;
  const ws = app.floor === 'workshop';
  const c = L.center;
  const here: AnyAudit[] = ws ? g.s.audits : g.s.faudit ? [g.s.faudit] : [];
  const there: AnyAudit[] = ws ? (g.s.faudit ? [g.s.faudit] : []) : g.s.audits;
  let top = c.y + 4;
  if (there.length) top = otherFloorTag(app, c, there, ws) + 4;
  if (!here.length) return;
  const view = { x: c.x + 4, y: top, w: c.w - 8, h: c.y + c.h - 4 - top };
  const boxes = here.map((a) => boxOnScreen(app, a.box));
  const drag = app.dragBox();
  const avoid = drag ? [...boxes, boxOnScreen(app, drag)] : boxes;
  const placed: Rect[] = [];
  here.forEach((a, i) => {
    const b = boxes[i];
    if (!overlapArea(b, view)) { placed.push(edgeTag(app, a, ws, b, view, placed)); return; }
    // the corner pieces (the Purse, the speaker's bubble, the Gazette…) are kept clear where it
    // costs nothing, but another clipboard is worse to cover than a corner
    const r = placeClip(b, avoid, placed, view, zones);
    placed.push(r);
    auditClip(app, a, ws, r, b, here.length);
  });
}

/** Where a clipboard goes beside box b: the candidate covering the least of the boxes and the
 * clipboards already placed, kept inside the view. */
function placeClip(b: Rect, boxes: Rect[], placed: Rect[], view: Rect, soft: Rect[] = []): Rect {
  const near = [
    { x: b.x + b.w + 10, y: b.y }, { x: b.x - CB_W - 10, y: b.y },
    { x: b.x + b.w / 2 - CB_W / 2, y: b.y + b.h + 10 }, { x: b.x + b.w / 2 - CB_W / 2, y: b.y - CB_H - 10 },
    { x: b.x + b.w + 10, y: b.y + b.h - CB_H }, { x: b.x - CB_W - 10, y: b.y + b.h - CB_H },
  ];
  // one clipboard further along each side, for when the near spots are taken (a longer string
  // costs a little, so these only win over something covered)
  const far = near.flatMap((p, i) => i === 2 || i === 3
    ? [{ x: p.x - CB_W - 6, y: p.y }, { x: p.x + CB_W + 6, y: p.y }]
    : [{ x: p.x, y: p.y - CB_H - 6 }, { x: p.x, y: p.y + CB_H + 6 }]);
  const cands = [...near.map((p) => ({ ...p, step: 0 })), ...far.map((p) => ({ ...p, step: 150 }))];
  let best: Rect | null = null, bestCost = Infinity;
  for (const p of cands) {
    const x = Math.round(clampN(p.x, view.x, view.x + view.w - CB_W)), y = Math.round(clampN(p.y, view.y, view.y + view.h - CB_H));
    const r = { x, y, w: CB_W, h: CB_H };
    const cost = boxes.reduce((s, q) => s + overlapArea(q, r) * 3, 0) + placed.reduce((s, q) => s + overlapArea(q, { x: x - 2, y: y - 2, w: CB_W + 4, h: CB_H + 4 }) * 6, 0) + soft.reduce((s, q) => s + overlapArea(q, r) * 2, 0) + Math.abs(x - p.x) + Math.abs(y - p.y) + p.step;
    if (cost < bestCost) { bestCost = cost; best = r; }
  }
  return best!;
}

/** The audit's projected (or final) result, null while it warms up. */
function auditResult(g: Game, a: AnyAudit, ws: boolean): AuditResult | null {
  return a.result ?? (ws ? projectAudit(g, a as AuditState) : a.t > warmTicks(g) + TICK_RATE ? gradeFAudit(g) : null);
}

/** The hover tag's rows for an audit (the numbers the clipboard has no room for). */
function auditTip(app: App, a: AnyAudit, ws: boolean, res: AuditResult | null, left: number, n: number): { text: string; color?: string }[] {
  const g = app.game;
  const lines: { text: string; color?: string }[] = [];
  lines.push(a.result
    ? { text: `{big:Graded ${a.result.grade.letter}}  {k:LMB} the report` }
    : { text: `{big:${ws ? 'Fold audit' : 'Nested audit'}}  {u:clock} ${left} s  {k:LMB} look` });
  if (res) {
    const gr = res.grade;
    lines.push({ text: `U busy ${Math.round(gr.u * 100)}% ×0.6 = +${(gr.u * SCORE_WEIGHTS.u).toFixed(2)}` });
    lines.push({ text: `W waste ${Math.round(gr.w * 100)}% ×0.2 = +${(gr.w * SCORE_WEIGHTS.w).toFixed(2)}` });
    lines.push({ text: `C compact ${Math.round(gr.c * 100)}% ×0.2 = +${(gr.c * SCORE_WEIGHTS.c).toFixed(2)}` });
    lines.push({ text: `score ${gr.score.toFixed(2)} → {big:${gr.letter}}  rates ×${gr.mult.toFixed(2)}` });
    lines.push({ text: `{coin:${fmt(coinPerMin(res.outs, gr.mult))}}{coinc:/min} at the Dock${a.result ? '' : ' so far'}` });
  } else lines.push({ text: `{u:clock} ${Math.round(warmTicks(g) / TICK_RATE)} s warm-up, then ${prules(g).auditWindow} s measured` });
  if (ws) lines.push({ text: `{soft:audits ${n}/${prules(g).maxAudits} · boxes never overlap}` });
  return lines;
}

/** One audit's clipboard at r, its string to box b. */
function auditClip(app: App, a: AnyAudit, ws: boolean, r: Rect, b: Rect, n: number) {
  const ui = app.ui;
  const g = app.game;
  const total = auditTicks(g);
  const res = auditResult(g, a, ws);
  const left = Math.max(0, Math.ceil((total - a.t) / TICK_RATE));
  const aid = 'id' in a ? a.id : -1;
  // the string runs from the clip to the nearest point of the box's edge
  const ax = clampN(r.x + 10, b.x + 2, b.x + b.w - 2), ay = clampN(r.y + 3, b.y + 2, b.y + b.h - 2);
  twine(ui, r.x + 10, r.y + 3, ax, ay);
  // a graded clipboard nods for attention
  const bob = a.result && Math.floor(ui.time * 2.5) % 2 === 0 ? -1 : 0;
  const R = clipboard(ui, r.x, r.y + bob, r.w, r.h);
  const hov = ui.hover(r.x, r.y, r.w, r.h);
  // the head: what is boxed, and the clock or GRADED
  const canCancel = !a.result;
  const cs = `{u:clock} {${left <= 10 ? 'warn' : 'ink'}:${left} s}`;
  const headR = canCancel ? richWidth(cs) + 17 : smallWidth('GRADED') + 4;
  const full = `${ws ? 'LINE' : 'GROUP'} ${a.box.w}X${a.box.h}`;
  ui.small(smallWidth(full) <= R.w - headR ? full : `${a.box.w}X${a.box.h}`, R.x, R.y + 2, T.inkSoft);
  if (canCancel) drawRich(ui, cs, R.x + R.w - 13, R.y, Infinity, T.ink, { align: 'right' });
  else ui.small('GRADED', R.x + R.w, R.y + 2, T.good, { align: 'right' });
  rule(ui, R.x, R.y + 11, R.w, true);
  // the grade: the projection in the display face, the final one stamped in red ink
  const lx = R.x + 15, ly = R.y + 14;
  if (a.result) {
    // the kit's word stamp: the letter in a double ring of red ink, small enough for the board
    drawStamp(ui.ctx, stampCanvas(a.result.grade.letter, T.badFill), lx + 1, ly + 10, 1, -0.14, 0.92);
  }
  else if (res) ui.big(res.grade.letter, lx, ly, GRADE_INK[res.grade.letter] ?? T.ink, { scale: 2, align: 'center' });
  else ui.big('?', lx, ly, T.inkSoft, { scale: 2, align: 'center' });
  // U, W and C as three meters
  const mx = R.x + 34, mw = R.x + R.w - mx - 7;
  const parts: [string, number][] = res ? [['U', res.grade.u], ['W', res.grade.w], ['C', res.grade.c]] : [['U', 0], ['W', 0], ['C', 0]];
  parts.forEach(([l, v], i) => {
    const yy = ly + i * 7;
    ui.small(l, mx, yy, T.inkSoft);
    meter(ui, mx + 7, yy, mw, 5, v, { role: gradeRole(v), glint: false });
    // still warming up: a dashed trough that ticks along
    if (!res) for (let k = 2; k < mw - 2; k += 4) if ((k / 4 + Math.floor(ui.time * 6)) % 2 === 0) ui.ctx.fillRect(mx + 7 + k, yy + 2, 2, 1);
  });
  // the foot: the coin it makes, or the warm-up; a graded one asks to be opened
  const fy = R.y + R.h - CHIP_H;
  if (res) chip(ui, R.x, fy, `${fmt(coinPerMin(res.outs, res.grade.mult))}/min`, { role: 'coin', icon: 'coin' });
  else chip(ui, R.x, fy, `warm-up ${Math.max(0, Math.ceil((warmTicks(g) - a.t) / TICK_RATE))} s`, { role: 'soft' });
  if (a.result) drawRich(ui, `{k:LMB} {${Math.floor(ui.time * 3) % 2 ? 'coinc' : 'ink'}:fold}`, R.x + R.w, fy + 2, Infinity, T.ink, { align: 'right' });
  // cancel a running audit; a graded one is cancelled on its report
  if (canCancel && button(ui, 'cancelAudit:' + aid, R.x + R.w - 11, R.y - 1, 11, 11, ICON.cross, { tip: [{ text: '{big:Stop the audit}' }, { text: `the ${ws ? 'line' : 'group'} keeps running` }] })) {
    app.act(ws ? { k: 'auditCancel', id: aid } : { k: 'fauditCancel' });
    return;
  }
  if (hov && ui.hoverId !== 'cancelAudit:' + aid) {
    ui.tip(auditTip(app, a, ws, res, left, n), 210);
    if (ui.clicked) {
      ui.eat();
      ui.sfx('click');
      if (a.result) {
        if (ws) openGrade(app, aid);
        else openFGrade(app);
      } else app.lookAt(a.box.x + a.box.w / 2, a.box.y + a.box.h / 2);
    }
  }
}

/** A box off the screen: a small tag at the view's edge toward it, its string running off toward
 * the box. Click: the report when graded, else the camera goes to the box. */
function edgeTag(app: App, a: AnyAudit, ws: boolean, b: Rect, view: Rect, placed: Rect[]): Rect {
  const ui = app.ui;
  const g = app.game;
  const left = Math.max(0, Math.ceil((auditTicks(g) - a.t) / TICK_RATE));
  const s = a.result ? `{u:fold} {big:${a.result.grade.letter}}` : `{u:fold} {u:clock} ${left} s`;
  const bx = b.x + b.w / 2, by = b.y + b.h / 2;
  const sz = tagSize(richWidth(s), a.result ? 13 : LINE_H, bx < view.x ? 'left' : 'right');
  let x = clampN(bx - sz.w / 2, view.x, view.x + view.w - sz.w), y = clampN(by - sz.h / 2, view.y, view.y + view.h - sz.h);
  // beside another edge tag rather than on it: along the edge it sits on
  for (let k = 0; k < placed.length; k++) {
    const p = placed.find((q) => overlapArea(q, { x: x - 2, y: y - 2, w: sz.w + 4, h: sz.h + 4 }));
    if (!p) break;
    const alongX = y <= view.y + 1 || y >= view.y + view.h - sz.h - 1;
    if (alongX) x = p.x + p.w + 4 + sz.w <= view.x + view.w ? p.x + p.w + 4 : p.x - sz.w - 4;
    else y = p.y + p.h + 4 + sz.h <= view.y + view.h ? p.y + p.h + 4 : p.y - sz.h - 4;
  }
  x = Math.round(x); y = Math.round(y);
  const hov = ui.hover(x, y, sz.w, sz.h);
  const R = tag(ui, x, y, sz.w, sz.h, { anchor: { x: bx, y: by }, hover: hov, kind: 'button' });
  drawRich(ui, s, R.x, R.y + 1);
  if (hov) {
    ui.tip(auditTip(app, a, ws, auditResult(g, a, ws), left, 1), 210);
    if (ui.clicked) {
      ui.eat();
      ui.sfx('click');
      if (a.result) { if (ws) openGrade(app, 'id' in a ? a.id : -1); else openFGrade(app); }
      else app.lookAt(a.box.x + a.box.w / 2, a.box.y + a.box.h / 2);
    }
  }
  return { x, y, w: sz.w, h: sz.h };
}

/** The audits on the other floor: one tag at the top of the view with a Go button. Returns its
 * bottom edge. */
function otherFloorTag(app: App, c: Rect, there: AnyAudit[], ws: boolean): number {
  const ui = app.ui;
  const graded = there.filter((a) => a.result).length;
  const first = there.find((a) => a.result) ?? there[0];
  const left = Math.max(0, Math.ceil((auditTicks(app.game) - first.t) / TICK_RATE));
  const fl = ws ? '{u:factory}' : '{u:workshop}';
  const s = graded ? `${fl} {u:fold} {coinc:${graded} graded}` : there.length > 1 ? `${fl} {u:fold} ${there.length} audits` : `${fl} {u:fold} {u:clock} ${left} s`;
  const bw = 26;
  const sz = tagSize(richWidth(s) + 6 + bw, 13, 'top');
  const x = Math.round(c.x + (c.w - sz.w) / 2), y = c.y + 4;
  const R = tag(ui, x, y, sz.w, sz.h, { hole: 'top' });
  drawRich(ui, s, R.x, R.y + 3);
  if (button(ui, 'gotoAudit', R.x + R.w - bw, R.y, bw, 14, 'Go', { gold: !!graded, pulse: !!graded, tip: `{big:${ws ? 'Factory floor' : 'Workshop'}}  {u:fold} audit` })) {
    app.setFloor(ws ? 'factory' : 'workshop', true);
    app.lookAt(first.box.x + first.box.w / 2, first.box.y + first.box.h / 2);
  }
  return y + sz.h;
}

// ------------------------------------------------------------------ the grade card

export interface GradeSpec {
  res: AuditResult;
  box: Box;
  /** the report's heading, and what was boxed in small caps */
  title: string;
  kind: string;
  /** the things in the box, each with a sprite drawer, a name and its busy share */
  parts: { id: number; draw: (x: number, y: number) => void; name: string; busy: number }[];
  defaultName: string;
  fold: (name: string) => boolean;
  cancel: () => void;
  /** what the fold does, as rows (the Fold button's tag) */
  foldRows: string[];
  /** the stamp bill of a copy (coin) */
  bill: number;
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
  const bill = foldBill(app, a);
  const parts = a.ids.map((id) => g.byId.get(id)).filter((m) => !!m).map((m) => ({
    id: m!.id,
    draw: (x: number, y: number) => app.ui.ctx.drawImage(sheet(spriteName(m!.kind)).frames[0], x, y, 16, 16),
    name: m!.kind === 'furnace' ? 'Hand Furnace' : BUILD[m!.kind]?.name ?? m!.kind,
    busy: res.busy[m!.id] ?? 0,
  }));
  drawGrade(app, L, {
    res,
    box: a.box,
    title: 'Audit report',
    kind: `LINE ${a.box.w}X${a.box.h}`,
    parts,
    defaultName: defaultName(scaled(res)),
    fold: (name) => app.act({ k: 'fold', name, id: a.id }).ok,
    cancel: () => app.act({ k: 'auditCancel', id: a.id }),
    foldRows: [
      `{u:fold} ${parts.length} machines · ${res.boxTiles} tiles → 1 tile`,
      'belts refunded · the box empties',
      `copies {coin:${fmt(bill)}} ×1 · ×1.5 · ×2 · …`,
    ],
    bill,
    cancelLabel: 'Keep the line',
    cancelTip: '{big:Keep the line}  audit off · it keeps running',
    pager: graded.length > 1 ? { i: gi, n: graded.length, go: (d) => { const q = graded[(gi + d + graded.length) % graded.length]; openGrade(app, q.id); } } : undefined,
  });
}

/** The nested fold's grade card (DESIGN.md §18): the same report, for a group of modules. */
export function fgradeCard(app: App, L: Layout) {
  const g = app.game;
  const a = g.s.faudit;
  // a District fold's grade card (DESIGN.md §21) opens on the same page: src/app/district.ts
  if (!a?.result && g.s.haudit?.result) return hgradeCard(app, L);
  if (!a || !a.result) { app.panel = null; return; }
  const res = a.result;
  const mods = a.ids.map((id) => g.fById.get(id)).filter((m) => !!m);
  const bill = mods.reduce((s, m) => s + (m!.kind === 'module' ? g.design(m!.design)?.bill ?? 0 : 0), 0);
  drawGrade(app, L, {
    res,
    box: a.box,
    title: 'Nested fold',
    kind: `GROUP ${a.box.w}X${a.box.h}`,
    parts: mods.map((m) => ({
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
    foldRows: [
      `{u:fold} ${mods.length} modules · ${res.boxTiles} tiles → 1 tile`,
      `the group's rates ×${res.grade.mult.toFixed(2)} · S inside, S fold = ×1.56`,
      'trunks refunded · depth 2 folds no further',
      `copies {coin:${fmt(bill)}} ×1 · ×1.5 · ×2 · …`,
    ],
    bill,
    cancelLabel: 'Keep the group',
    cancelTip: '{big:Keep the group}  audit off · the modules keep running',
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

/** The Inspector's verdict on a grade: one line in his voice (officious, dry, secretly impressed). */
const VERDICT: Record<string, string> = {
  'S+': 'Flawless. I am, against all my training, impressed.',
  S: 'An {big:S}. I shall tell no one. Fine, everyone.',
  A: 'Tidy work. One more fix and I write an {big:S}.',
  B: 'Serviceable. I have seen worse. Recently, even.',
  C: 'It runs. Mostly. Do read my notes.',
  D: 'Frankly, this line wants work. See my notes.',
};

// ---- the advice as rows

const ITEM_BY_NAME = new Map<string, ItemId>(Object.entries(ITEMS).map(([id, d]) => [d.name.toLowerCase(), id as ItemId]));
/** An item named in an advice line, as its icon (unknown names stay words). */
const itemTok = (name: string) => {
  const id = ITEM_BY_NAME.get(name.toLowerCase());
  return id ? `{i:${id}}` : name;
};
const cap = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);
const why = (s: string) => {
  const m = /^(blocked by|starved of) (.+)$/.exec(s);
  return m ? `{${m[1] === 'blocked by' ? 'bad:blocked' : 'warn:starved'}} ${itemTok(m[2])}` : s;
};

interface AdviceRow { act: string; cause: string; worth: string | null; to: string | null }

/** An advice line from the sim (tests pin its wording) as a row: the action to take, its cause
 * in icons and numbers, what it is worth and the grade it reaches. A form this does not know is
 * split at its first colon: the cause before, the action after. */
export function adviceRow(text: string): AdviceRow {
  let s = text.trim();
  let worth: string | null = null, to: string | null = null;
  const w = /\s*\((\+\d+(?:\.\d+)?)(?:\s*→\s*(S\+|[SABCD]))?\)\s*$/.exec(s);
  if (w) { worth = w[1]; to = w[2] ?? null; s = s.slice(0, w.index); }
  s = s.replace(/\.$/, '');
  let m: RegExpExecArray | null;
  if ((m = /^Nothing left the box: (.+)$/.exec(s))) return { act: /trunk/.test(m[1]) ? 'Trunk it out to a Dock, the Hopper or a module' : 'Belt it out to a Dock, a Hopper or the next line', cause: '{bad:nothing left the box}', worth, to };
  if ((m = /^(.+?) ran (\d+)%, short of power: (.+)$/.exec(s))) return { act: cap(m[3]), cause: `${m[1]} {warn:${m[2]}%} {power:short of power}`, worth, to };
  if ((m = /^(.+?)s are the bottleneck: they take (\d+) (.+?)\/min and the line makes (\d+)\. Add (\d+) more, or one fewer maker$/.exec(s))) {
    const n = +m[5];
    return { act: `Add ${n} ${m[1]}${n > 1 ? 's' : ''}, or one fewer maker`, cause: `{bad:bottleneck} ${m[1]}s take ${m[2]} of ${m[4]} ${itemTok(m[3])}/min`, worth, to };
  }
  if ((m = /^(.+?) ran (\d+)%, blocked by its (.+?): it has nowhere to go fast enough\. (.+)$/.exec(s))) return { act: m[4], cause: `${m[1]} {warn:${m[2]}%} {bad:blocked} ${itemTok(m[3])}`, worth, to };
  if ((m = /^(.+?) ran (\d+)%, starved of (.+?): it wants (\d+)\/min and got about (\d+)\. Feed it more (.+)$/.exec(s))) return { act: `Feed it more ${itemTok(m[6])}`, cause: `${m[1]} {warn:${m[2]}%} {warn:starved} ${itemTok(m[3])} ${m[5]} of ${m[4]}/min`, worth, to };
  if ((m = /^(.+?) ran (\d+)% of the time\. Balance the ratio: (.+)$/.exec(s))) return { act: 'Balance the ratio', cause: `${m[1]} {warn:${m[2]}%} · ${m[3]}`, worth, to };
  if ((m = /^(.+?) ran (\d+)% \((.+?)\)\. (.+?): (.+)$/.exec(s))) return { act: m[4], cause: `${m[1]} {warn:${m[2]}%} ${why(m[3])} · ${m[5]}`, worth, to };
  if ((m = /^(\d+) of (\d+) (.+?) went nowhere(?: useful)?\. (.+)$/.exec(s))) return { act: m[4], cause: `${itemTok(m[3])} ${m[1]} of ${m[2]} {bad:went nowhere}`, worth, to };
  if ((m = /^(\d+) of (\d+) tiles are (machines|modules); (\d+) would be fully compact\. (.+)$/.exec(s))) return { act: m[5], cause: `${m[3]} on ${m[1]} of ${m[2]} tiles · ${m[4]} for full marks`, worth, to };
  if ((m = /^One step to S\+: use the (.+?) inside the box/.exec(s))) return { act: `Use the ${m[1].split(' and ').map(itemTok).join(' and ')} inside the box`, cause: '{i:slagBrick} a press · {i:gravel} a crusher · a heap caps it at S', worth, to };
  if ((m = /^(Flawless|Nothing to fix): (.+)$/.exec(s))) return { act: `{good:${m[1]}}`, cause: m[2], worth, to };
  if ((m = /^Refolded at its kept grade \((.+?)\)/.exec(s))) {
    const n = /for (\d+) s \((\d+)% busy\)/.exec(s);
    return { act: `Refolded at its kept grade, ${m[1]}`, cause: n ? `{u:patents} Drawer layout · ports fed ${n[1]} s · ${n[2]}% busy` : '{u:patents} Drawer layout', worth, to };
  }
  // a form this does not know: the cause before the first colon, the action after it
  const plain = s.replace(/\s*\([^)]*\)/g, '').replace(/;/g, ',');
  const c = plain.indexOf(':');
  return c > 0 ? { act: cap(plain.slice(c + 1).trim()), cause: plain.slice(0, c), worth, to } : { act: plain, cause: '', worth, to };
}

/** The Inspector, 48x48 (cheering, both frames, at an S or S+) or 24x24. */
function inspector(app: App, x: number, y: number, size: 48 | 24, cheer: boolean, t: number) {
  const ui = app.ui;
  if (size === 48 && cheer && hasArt('portrait_inspector_cheer')) {
    const s = sheet('portrait_inspector_cheer');
    ui.fill(x - 1, y - 1, 50, 50, C.ink);
    ui.ctx.drawImage(s.frames[Math.floor(t * 4) % s.frames.length], x, y);
  } else portrait(ui, 'inspector', x, y, size);
}

export function drawGrade(app: App, L: Layout, sp: GradeSpec) {
  const ui = app.ui;
  const ctx = ui.ctx;
  const res = sp.res;
  const gr = res.grade;
  const top = gr.letter === 'S+';
  const O = L.overlay;
  ui.fill(O.x, O.y, O.w, O.h, C.ink, 0.55);
  // the Inspector stands left of his clipboard when there is room for him
  const w = Math.min(430, O.w - 12), maxH = Math.min(320, O.h - 6);
  const standing = O.w - w >= 56;
  // the board is as tall as the report: the header, the stamp and the numbers beside it, the
  // advice rows, the verdict, the name. The stamp goes 2x and the causes show while they fit.
  const advice = res.advice.slice(0, 3).map(adviceRow);
  const need = (s: number, cause: boolean) => {
    const advH = top ? 18 : advice.length ? 11 + advice.length * (cause && advice.some((a) => a.cause) ? 24 : 13) : 0;
    return 19 + Math.max(48 * s + 33, 106) + 2 + 3 + advH + 3 + 26 + 16 + 32;
  };
  const fit = ([[2, true], [2, false], [1, true], [1, false]] as [number, boolean][]).find(([s, c]) => (s === 1 || w - 26 >= 380) && need(s, c) <= maxH) ?? [1, false];
  const S = fit[0];
  const h = Math.max(Math.min(maxH, 200), Math.min(maxH, need(S, fit[1])));
  const x = O.x + (standing ? Math.max(54, Math.floor((O.w - w) / 2)) : Math.floor((O.w - w) / 2)), y = O.y + 4 + Math.floor((O.h - 4 - h) / 2);
  const t = ui.time - app.gradeAt;
  const R = reportBoard(ui, x, y, w, h);
  // the head: the form's title, what was boxed, the pager
  ui.big(sp.title, R.x, R.y, T.ink);
  ui.small(sp.kind, R.x + bigWidth(sp.title) + 6, R.y + 4, T.inkSoft);
  if (sp.pager) {
    const ps = `${sp.pager.i + 1} of ${sp.pager.n}`;
    const pw = textWidth(ps) + 36, px = R.x + R.w - pw;
    if (button(ui, 'gradePrev', px, R.y - 1, 14, 13, ICON.left, { tip: '{big:The previous line}' })) sp.pager.go(-1);
    ui.text(ps, px + pw / 2, R.y + 1, T.ink, { align: 'center' });
    if (button(ui, 'gradeNext', px + pw - 14, R.y - 1, 14, 13, ICON.right, { tip: '{big:The next line}' })) sp.pager.go(1);
  }
  ctx.fillStyle = T.ink;
  ctx.fillRect(R.x, R.y + 13, R.w, 1);
  rule(ui, R.x, R.y + 15, R.w);
  let yy = R.y + 19;
  // ---- the stamp: it falls from 3x as a faint shadow, lands in red ink with a thump, the card
  // shakes, ink spatters; S+ turns gold rays behind it
  const colW = 48 * S + 8;
  const mx = R.x + Math.floor(colW / 2), my = yy + 24 * S;
  if (t >= 0.28 && !app.hud.stamped) {
    app.hud.stamped = true;
    if (top) celebrateTop(app);
    else {
      app.audio.sfx(('grade' + gr.letter) as 'gradeS');
      app.renderer.fx.kick(gr.letter === 'S' ? 6 : 3);
      app.hud.confetti = gr.letter === 'S' || gr.letter === 'A' ? 60 : 16;
    }
  }
  const landed = t >= 0.28;
  ui.clip(R.x, yy - 2, colW, 48 * S + 4);
  if (top && landed) rays(app, mx, my, 48 * S, C.brass1, 16);
  if (landed && t < 0.9) {
    // the thump: a ring of ink drops flying out
    const k = (t - 0.28) / 0.62;
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2 + hash2(i, 3) * 0.4, rr = (20 + 26 * k + hash2(i, 9) * 8) * S;
      ctx.fillStyle = rgba(T.badFill, 1 - k);
      ctx.fillRect(Math.round(mx + Math.cos(a) * rr), Math.round(my + Math.sin(a) * rr), S, S);
    }
  }
  ui.unclip();
  ui.clip(R.x, R.y + 16, R.w, R.h - 16);
  const id = sp.box.x * 31 + sp.box.y * 7 + sp.box.w;
  if (landed) {
    // the spatter it left: a few dots round the ring, the same each time it is opened
    for (let i = 0; i < 9; i++) {
      const a = hash2(id + i, 5) * Math.PI * 2, rr = (25 + hash2(i, id) * 6) * S;
      ctx.fillStyle = rgba(T.badFill, 0.7);
      ctx.fillRect(Math.round(mx + Math.cos(a) * rr), Math.round(my + Math.sin(a) * rr), hash2(i, 1) < 0.3 ? 2 : 1, 1);
    }
  }
  const kk = landed ? S : slamScale(t, S);
  drawStamp(ctx, gradeStamp(gr.letter, true), mx, my, kk, -0.09, landed ? 0.95 : 0.15 + 0.45 * Math.max(0, t / 0.28));
  // S+: a glint sweeps across the stamp now and then
  if (top && landed) {
    const sw = (ui.time * 0.7) % 2;
    if (sw < 1) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(mx, my, 20 * S, 0, Math.PI * 2);
      ctx.clip();
      ctx.fillStyle = rgba(C.lamp3, 0.6);
      const gx = Math.round(mx - 24 * S + sw * 48 * S);
      ctx.fillRect(gx, my - 24 * S, 2 * S, 48 * S);
      ctx.fillRect(gx + 4 * S, my - 24 * S, S, 48 * S);
      ctx.restore();
    }
  }
  ui.unclip();
  confetti(app, mx, my);
  // the score under it: the number, a meter with a notch at the next grade, the multiplier
  const nx = nextGrade(gr.letter);
  let sy = yy + 48 * S + 3;
  ui.text(`score ${gr.score.toFixed(2)}`, mx, sy, T.ink, { align: 'center' });
  sy += LINE_H;
  meter(ui, R.x + 6, sy, colW - 12, 5, gr.score, { role: top ? 'coin' : gradeRole(gr.score), target: nx ? nx.min : null, glint: top });
  sy += 8;
  ui.text(`rates ×${gr.mult.toFixed(2)}`, mx, sy, gr.mult >= 1 ? T.good : T.bad, { align: 'center' });
  sy += LINE_H;
  ui.hint(R.x, yy, colW, sy - yy, [
    { text: `{big:Grade ${gr.letter}}  rates ×${gr.mult.toFixed(2)}` },
    { text: `score ${gr.score.toFixed(2)} = 0.6 U + 0.2 W + 0.2 C` },
    { text: nx ? `{soft:${nx.letter} from ${nx.min.toFixed(2)}}` : '{coinc:the top grade}' },
  ], 200);
  // ---- the right column: the three parts, the rates, the coin, what is inside
  const px = R.x + colW + 6, pw = R.x + R.w - px;
  let ry = yy;
  const partRow = (l: string, word: string, v: number, wgt: number, tip: string[]) => {
    ui.big(l, px, ry, T.ink);
    ui.text(word, px + 12, ry + 2, T.inkSoft);
    const bx = px + 64, bw = pw - 64 - 62;
    meter(ui, bx, ry + 3, bw, 6, v, { role: gradeRole(v) });
    ui.text(`${Math.round(v * 100)}%`, px + pw - 30, ry + 2, T.ink, { align: 'right' });
    ui.text(`+${(v * wgt).toFixed(2)}`, px + pw, ry + 2, T.inkSoft, { align: 'right' });
    ui.hint(px, ry, pw, 13, tip.map((text) => ({ text })), 190);
    ry += 13;
  };
  partRow('U', 'busy', gr.u, SCORE_WEIGHTS.u, ['{big:U busy}  ×0.6', 'time the things inside worked']);
  partRow('W', 'waste', gr.w, SCORE_WEIGHTS.w, ['{big:W waste}  ×0.2', res.byMade ? `{i:slag} ${Math.round(res.byHandled)} of ${Math.round(res.byMade)} handled · a port or used inside` : 'no byproducts · full marks']);
  partRow('C', 'compact', gr.c, SCORE_WEIGHTS.c, ['{big:C compact}  ×0.2', `${res.machineTiles} working tiles of ${res.boxTiles} · full at 60%`]);
  rule(ui, px, ry, pw);
  ry += 3;
  // the rates, times the grade's multiplier: what the module will do
  const rates = (lab: string, tt: Partial<Record<ItemId, number>>) => {
    ui.small(lab, px, ry + 2, T.inkSoft);
    let ix = px + 22;
    const ents = Object.entries(tt) as [ItemId, number][];
    if (!ents.length) ui.text('nothing', ix, ry, T.inkSoft);
    for (const [it, r] of ents) {
      const s = `{i:${it}} ${perMin(r * gr.mult)}/min`;
      const sw = richWidth(s);
      if (ix + sw > px + pw) break;
      drawRich(ui, s, ix, ry);
      ix += sw + 8;
    }
    ry += LINE_H;
  };
  rates('OUT', res.outs);
  rates('IN', res.ins);
  ry += 1;
  chip(ui, px, ry, `${fmt(coinPerMin(res.outs, gr.mult))}/min`, { role: 'coin', icon: 'coin' });
  ui.small('AT THE DOCK', px + chipWidth(`${fmt(coinPerMin(res.outs, gr.mult))}/min`, { icon: 'coin' }) + 4, ry + 4, T.inkSoft);
  ry += CHIP_H + 4;
  // each thing in the box and how busy it was, then the tile it becomes
  ui.small('INSIDE', px, ry + 6, T.inkSoft);
  let ix = px + 34;
  const tail = `→ {u:fold} {soft:${res.boxTiles} tiles to 1}`;
  const tailW = richWidth(tail);
  for (const p of sp.parts) {
    if (ix + 20 + tailW > px + pw) break;
    ui.fill(ix, ry, 18, 18, T.paperLo);
    p.draw(ix + 1, ry + 1);
    meter(ui, ix, ry + 19, 18, 3, p.busy, { role: gradeRole(p.busy), glint: false });
    ui.hint(ix, ry, 18, 22, [{ text: `{big:${p.name}}` }, { text: `busy ${Math.round(p.busy * 100)}%` }], 140);
    ix += 21;
  }
  drawRich(ui, tail, ix + 2, ry + 5);
  ry += 25;
  yy = Math.max(sy, ry) + 2;
  // ---- the bottom: the name, Fold it! and keep; above it the Inspector's verdict
  const by = R.y + R.h - 16;
  const vy = by - 26;
  // ---- what would raise it: one row each, the action, its worth and the grade it reaches; the
  // cause under it in icons while there is room
  ctx.fillStyle = T.ink;
  ctx.fillRect(R.x, yy, R.w, 1);
  yy += 3;
  if (top) {
    drawRich(ui, `{u:star} {big:S+}  {coinc:the top grade} · rates ×${gr.mult.toFixed(2)} for good`, R.x + 2, yy + 1);
    yy += 15;
  } else if (advice.length) {
    ui.small(gr.letter === 'S' ? 'ONE STEP TO S+' : 'TO RAISE IT', R.x + 2, yy + 1, T.inkSoft);
    ui.small('WORTH', R.x + R.w - 2, yy + 1, T.inkSoft, { align: 'right' });
    yy += 8;
    const withCause = fit[1] && advice.length * 24 <= vy - 3 - yy;
    for (const a of advice) {
      const rowH = withCause && a.cause ? 24 : 13;
      if (yy + 13 > vy - 3) break;
      // the worth: a chip, then the letter it reaches
      let wx = R.x + R.w - 2;
      if (a.to) { wx -= ui.big(a.to, wx, yy + 1, GRADE_INK[a.to] ?? T.ink, { align: 'right' }) + 3; wx -= ui.text('→', wx, yy + 2, T.inkSoft, { align: 'right' }) + 3; }
      if (a.worth) { const cw = chipWidth(a.worth); chip(ui, wx - cw, yy, a.worth, { role: 'good' }); wx -= cw + 4; }
      const aw = wx - (R.x + 12);
      ui.text(ICON.right, R.x + 2, yy + 2, T.ink);
      ui.clip(R.x + 12, yy, aw, 13);
      drawRich(ui, richWidth(a.act) <= aw ? a.act : ellipsize(a.act.replace(/\{[a-z]+:([^}]*)\}/g, '$1'), aw), R.x + 12, yy + 2);
      ui.unclip();
      if (withCause && a.cause) {
        ui.clip(R.x + 12, yy + 13, R.w - 14, 11);
        drawRich(ui, a.cause, R.x + 12, yy + 13, Infinity, T.inkSoft);
        ui.unclip();
      }
      ui.hint(R.x, yy, R.w, rowH, [{ text: a.act }, ...(a.cause ? [{ text: a.cause, color: T.inkSoft }] : []), ...(a.worth ? [{ text: `{good:${a.worth}}${a.to ? ` → {big:${a.to}}` : ''}` }] : [])], 240);
      yy += rowH;
      rule(ui, R.x + 12, yy - 1, R.w - 14);
    }
  }
  // ---- the Inspector's verdict, in his bubble
  const verdict = VERDICT[gr.letter] ?? VERDICT.B;
  const cheer = gr.letter === 'S' || top;
  let bx = R.x + 6;
  if (standing) inspector(app, x - 50, y + h - 60, 48, cheer, t);
  else { inspector(app, R.x, vy, 24, cheer, t); bx = R.x + 32; }
  const VL = layoutRich(verdict, R.w - (bx - R.x) - 20);
  const bh = Math.max(20, VL.h + 9);
  const bbox = bubble(ui, bx, vy + Math.max(0, 22 - bh), VL.w + 14, bh, { side: 'left', at: Math.floor(bh / 2) });
  drawRich(ui, verdict, bbox.x + 1, bbox.y);
  // ---- the name, then fold or keep
  if (app.nameDraft === null) app.nameDraft = sp.defaultName;
  const fw = 104, cw = textWidth(sp.cancelLabel) + 18;
  ui.small('NAME', R.x + 2, by + 4, T.inkSoft);
  const fx = R.x + 6 + smallWidth('NAME'), fieldW = R.x + R.w - cw - fw - 10 - fx;
  app.nameDraft = textField(app, 'foldName', fx, by + 1, fieldW, app.nameDraft);
  if (button(ui, 'doFold', R.x + R.w - cw - fw - 4, by - 1, fw, 17, top ? 'Fold it! S+' : 'Fold it!', { gold: true, pulse: true, big: true, tip: [{ text: '{big:Fold it}' }, ...sp.foldRows.map((text) => ({ text }))] })) {
    app.hud.focus = null;
    app.input.typing = null;
    if (sp.fold(app.nameDraft)) { app.panel = null; app.hud.stamped = false; app.gradeId = null; }
  }
  if (button(ui, 'cancelFold', R.x + R.w - cw, by - 1, cw, 17, sp.cancelLabel, { tip: sp.cancelTip })) {
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
  const cols = [T.coinFill, T.goodFill, T.researchFill, T.badFill, C.lamp2, T.resetFill];
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

// ------------------------------------------------------------------ the Modules pages

let modPage = 0;

const CARD_MIN_W = 186, CARD_H = 118;

export function modulesScreen(app: App, r: Rect) {
  const ui = app.ui;
  const g = app.game;
  const n = g.s.designs.length;
  const wide = r.w >= 470;
  const { body, detail } = menuTemplate(app, r, { title: n ? `Modules: ${n} design${n === 1 ? '' : 's'}` : 'Modules', accent: C.gold, icon: 'fold', detail: wide ? 172 : undefined });
  const cols = Math.max(1, Math.floor((body.w + 6) / (CARD_MIN_W + 6)));
  const cw = Math.floor((body.w + 6) / cols) - 6;
  let rows = Math.max(1, Math.floor((body.h + 6) / (CARD_H + 6)));
  const pagerH = detail ? 0 : 18;
  if (!detail && n > cols * rows) rows = Math.max(1, Math.floor((body.h - pagerH + 6) / (CARD_H + 6)));
  const per = cols * rows;
  const pageN = Math.max(1, Math.ceil(n / per));
  modPage = Math.min(modPage, pageN - 1);
  if (detail) ledger(app, detail, pageN > 1 ? 20 : 0);
  if (!n) { emptyModules(app, body); return; }
  g.s.designs.slice(modPage * per, modPage * per + per).forEach((d, i) => {
    designCard(app, d, body.x + (i % cols) * (cw + 6), body.y + Math.floor(i / cols) * (CARD_H + 6), cw, CARD_H);
  });
  if (pageN > 1) {
    const px = detail ? detail.x : body.x, pw = detail ? detail.w : body.w;
    const py = (detail ? detail.y + detail.h : body.y + body.h) - 15;
    if (button(ui, 'modPrev', px, py, 28, 14, ICON.left, { disabled: modPage === 0, tip: '{big:Previous page}' })) modPage--;
    ui.text(`${modPage + 1} of ${pageN}`, px + pw / 2, py + 2, T.ink, { align: 'center' });
    if (button(ui, 'modNext', px + pw - 28, py, 28, 14, ICON.right, { disabled: modPage >= pageN - 1, tip: '{big:Next page}' })) modPage++;
  }
}

/** No designs yet: the Inspector says how, and the fold as a row of steps. */
function emptyModules(app: App, body: Rect) {
  const ui = app.ui;
  const g = app.game;
  const ready = g.done('folding');
  const x = body.x + 4;
  let y = body.y + 6;
  inspector(app, x, y, 48, false, ui.time);
  const line = ready ? 'Box a line that runs well, and I shall grade it. {k:F}' : 'Folding is not yet approved. Research it first. {k:T}';
  const VL = layoutRich(line, Math.min(260, body.w - 80));
  const bb = bubble(ui, x + 58, y + 8, VL.w + 14, VL.h + 9, { side: 'left', at: 10 });
  drawRich(ui, line, bb.x + 1, bb.y);
  y += 62;
  ui.small('HOW A FOLD GOES', x, y, T.inkSoft);
  y += 9;
  rule(ui, x, y, Math.min(body.w - 8, 320));
  y += 4;
  const steps = ready
    ? ['{k:F} drag a box over a running line · 8×8 at most', `{u:clock} ${Math.round(warmTicks(g) / TICK_RATE)} s warm-up + ${prules(g).auditWindow} s measured`, '{big:S} graded on U busy, W waste, C compact', '{u:fold} 1 tile with its rates · place it on the {u:factory} Factory floor']
    : ['{u:research} Folding, the last node of the tree {k:T}', '{k:F} box a running line', '{u:fold} 1 tile with its rates'];
  steps.forEach((s, i) => {
    ui.big(String(i + 1), x + 2, y, T.inkSoft);
    y += Math.max(13, drawRich(ui, s, x + 14, y + 1, body.w - 22)) + 2;
  });
}

/** A module's case drawn big, with its product in the well; a depth-2 design in a doubled frame. */
function bigModule(app: App, d: ModuleDesign, x: number, y: number) {
  const ui = app.ui;
  const g = app.game;
  const ctx = ui.ctx;
  if (d.depth === 2) {
    ctx.fillStyle = C.ink;
    ctx.fillRect(x - 3, y - 3, 38, 38);
    ctx.fillStyle = Math.floor(ui.time * 2) % 2 ? T.researchFill : T.research;
    ctx.fillRect(x - 2, y - 2, 36, 36);
    ctx.fillStyle = C.ink;
    ctx.fillRect(x - 1, y - 1, 34, 34);
  }
  ctx.drawImage(sheet('module').frames[0], x, y, 32, 32);
  const out = mainOutput(g, d.id);
  if (out) ctx.drawImage(itemIcon(out), x + 8, y + 8, 16, 16);
}

/** A design as a folded paper card: a brass band across its top (the module's own), a turned
 * corner, the module and its red grade stamp on the left; its name, rates, copies, stamp price,
 * Machine Kits and claims on the right; Place, Stamp and Unfold along the foot. */
function designCard(app: App, d: ModuleDesign, x: number, y: number, w: number, h: number) {
  const ui = app.ui;
  const g = app.game;
  const ctx = ui.ctx;
  const deep = d.depth === 2;
  x = Math.round(x); y = Math.round(y);
  ui.region(x, y, w, h, 'panel', true);
  paperRaw(ctx, x, y, w, h, { shadow: true });
  // the band: brass, or research teal on a depth-2 design
  const [b0, b1, b2] = deep ? [T.research, T.researchFill, C.teal] : [T.brassLo, T.brass, T.brassHi];
  ctx.fillStyle = b0; ctx.fillRect(x + 1, y + 1, w - 2, 5);
  ctx.fillStyle = b1; ctx.fillRect(x + 1, y + 1, w - 2, 3);
  ctx.fillStyle = b2; ctx.fillRect(x + 1, y + 1, w - 2, 1);
  // the turned corner, top right
  for (let i = 0; i < 8; i++) {
    ctx.fillStyle = i === 7 ? T.paperEdge : T.paperLo;
    ctx.fillRect(x + w - 8 + i, y + i, 8 - i, 1);
    ctx.fillStyle = C.ink;
    ctx.fillRect(x + w - 9 + i, y + i, 1, 1);
  }
  ctx.fillStyle = rgba(C.ink, 0.25);
  ctx.fillRect(x + w - 9, y + 8, 8, 1);
  // the left column: the module, its grade stamped in red, the multiplier
  bigModule(app, d, x + 6, y + 10);
  drawStamp(ctx, gradeStamp(d.grade.letter, false), x + 22, y + 62, 1, -0.12);
  ui.text(`×${d.grade.mult.toFixed(2)}`, x + 22, y + 80, GRADE_INK[d.grade.letter] ?? T.ink, { align: 'center' });
  ui.hint(x + 4, y + 44, 36, 46, [{ text: `{big:Grade ${d.grade.letter}}  rates ×${d.grade.mult.toFixed(2)}` }, { text: `score ${d.grade.score.toFixed(2)}` }], 160);
  // the right column
  const tx = x + 44, tr = x + w - 10;
  const fid = 'name:' + d.id;
  const name = textField(app, fid, tx, y + 9, tr - tx, app.hud.focus === fid ? app.hud.draft : d.name);
  if (app.hud.focus !== fid && name !== d.name) app.act({ k: 'rename', id: d.id, name });
  if (app.hud.focus === fid && app.hud.draft !== d.name && !app.input.typing) app.act({ k: 'rename', id: d.id, name: app.hud.draft });
  let yy = y + 25;
  const line = (lab: string, t: Partial<Record<ItemId, number>>, none: string) => {
    ui.small(lab, tx, yy + 2, T.inkSoft);
    let ix = tx + smallWidth('OUT') + 6;
    const ents = Object.entries(t) as [ItemId, number][];
    // with /min after each while they fit, else the bare numbers
    const all = (u: string) => ents.map(([it, r]) => `{i:${it}} ${perMin(r)}${u}`);
    const fits = (ss: string[]) => ss.reduce((a, q) => a + richWidth(q) + 6, 0) - 6 <= tr - ix;
    const ss = fits(all('/min')) ? all('/min') : all('');
    for (const s of ss) {
      const sw = richWidth(s);
      if (ix + sw > tr) break;
      drawRich(ui, s, ix, yy);
      ix += sw + 6;
    }
    if (!ents.length) ui.text(none, ix, yy, T.inkSoft);
    yy += LINE_H;
  };
  line('OUT', d.outs, 'nothing');
  line('IN', d.ins, 'a source');
  yy += 1;
  // copies: spare and placed, and a depth-2 mark
  const placed = g.s.factory.ents.filter((e) => e.kind === 'module' && e.design === d.id).length;
  let cx = tx;
  cx += chip(ui, cx, yy, `${d.spare} spare`, { role: d.spare > 0 ? 'good' : 'soft' }) + 3;
  cx += chip(ui, cx, yy, `${placed} placed`, { role: 'ink', icon: 'factory' }) + 3;
  if (deep && cx + chipWidth('depth 2') <= tr + 4) {
    chip(ui, cx, yy, 'depth 2', { role: 'research' });
    ui.hint(cx, yy, chipWidth('depth 2'), CHIP_H, [{ text: '{big:Depth 2}' }, { text: `${(d.fparts ?? []).filter((p) => p.kind === 'module').length} modules folded · their rates × this grade` }], 180);
  }
  yy += CHIP_H + 2;
  // the stamp's price, per product
  const cost = stampCost(g, d);
  const copies = productCopies(g, d);
  const item = mainItem(d);
  const factor = 1 + RULES.stampGrowth.value * copies;
  const next = Num.of(Math.round(d.bill * (1 + RULES.stampGrowth.value * (copies + 1))));
  ui.small('COPY', tx, yy + 2, T.inkSoft);
  const ps = `{coin:${cost.format()}} {soft:= ${fmt(d.bill)} ×${factor.toFixed(1)}}`;
  const pxo = smallWidth('COPY') + 5;
  ui.clip(tx + pxo, yy, tr - tx - pxo, LINE_H);
  drawRich(ui, ps, tx + pxo, yy);
  ui.unclip();
  ui.hint(tx, yy, tr - tx, LINE_H, [
    { text: '{big:The stamp price}  per product' },
    { text: `bill {coin:${fmt(d.bill)}} × 1 + 0.5n · n = ${copies}` },
    { text: `n counts every copy of ${item ? `{i:${item}} ${itemName(item).toLowerCase()}` : 'this product'}, any design` },
    { text: `next {coin:${next.format()}} · the 5th copy costs 3× the 1st` },
  ], 220);
  yy += LINE_H + 1;
  // Machine Kits and claims, as chips
  const kits = kitsFor(g, d);
  cx = tx;
  const ks = kits ? `${kits}` : 'no kits';
  const kw = chip(ui, cx, yy, ks, { role: kits ? (g.s.parts.gte(kits) ? 'ink' : 'bad') : 'soft', icon: 'kit' });
  ui.hint(cx, yy, kw, CHIP_H, kits ? [{ text: `{big:Machine Kits}  ${kits} a copy` }, { text: `1 + ${fmt(d.bill)} ÷ ${fmt(RULES.kitDivisor.value)}, rounded down · you have ${g.s.parts.format()}` }] : [{ text: '{big:No kits}' }, { text: 'slice-era machines · copies cost coin alone' }], 200);
  cx += kw + 3;
  for (const ore of Object.keys(oresOf(g, d)) as ItemId[]) {
    const held = claimsHeld(g, ore), used = claimsUsed(g, ore);
    const s = `${used}/${held}`;
    const w2 = chipWidth(s, { item: ore });
    if (cx + w2 > tr + 4) break;
    chip(ui, cx, yy, s, { role: used < held ? 'good' : 'bad', item: ore });
    ui.hint(cx, yy, w2, CHIP_H, [{ text: `{big:${itemName(ore)} claims}` }, { text: `a copy holds one · ${used} of ${held} in use` }], 170);
    cx += w2 + 3;
  }
  yy += CHIP_H + 1;
  // why not, in red ink
  const whyNot = stampRefusal(g, d);
  if (whyNot) {
    ui.clip(x + 6, yy, w - 12, LINE_H);
    ui.text(ellipsize(whyNot, w - 12), x + 6, yy, T.bad);
    ui.unclip();
    ui.hint(x + 6, yy, w - 12, LINE_H, [{ text: `{bad:${whyNot}}` }], 180);
  }
  // the buttons: Place, Stamp, Unfold in a row
  const by = y + h - 18;
  // Place and Unfold as wide as their words, Stamp takes the rest (it carries the price)
  const pl = d.spare ? `Place ${d.spare}` : 'Place';
  const pw1 = textWidth(pl) + 14, b3w = textWidth('Unfold') + 14;
  const pw2 = w - 12 - 6 - pw1 - b3w;
  if (button(ui, 'place:' + d.id, x + 6, by, pw1, 15, pl, { gold: d.spare > 0, disabled: d.spare < 1 || !g.flag('factoryOpen'), tip: [{ text: '{big:Place}' }, { text: 'a spare copy onto the {u:factory} Factory floor' }] })) app.pickModule(d.id);
  const label = richWidth(`Stamp {coin:${cost.format()}}`) <= pw2 - 6 ? `Stamp {coin:${cost.format()}}` : `{coin:${cost.format()}}`;
  if (button(ui, 'stamp:' + d.id, x + 9 + pw1, by, pw2, 15, label, { disabled: !!whyNot, tip: [{ text: `{big:Stamp a copy}  {coin:${cost.format()}}${kits ? ` + {u:kit} ${kits}` : ''}` }, { text: whyNot ? `{bad:${whyNot}}` : `copies so far ${copies} · next {coin:${next.format()}}` }] })) app.act({ k: 'stamp', id: d.id });
  const uwhy = unfoldRefusal(g, d);
  if (button(ui, 'unfold:' + d.id, x + w - 6 - b3w, by, b3w, 15, 'Unfold', { disabled: !!uwhy, tip: [{ text: '{big:Unfold}' }, { text: uwhy ? `{bad:${uwhy}}` : `back onto the ${deep ? '{u:factory} Factory floor' : '{u:workshop} Workshop'} at ${d.box.x},${d.box.y}` }, ...(uwhy ? [] : [{ text: `${deep ? 'trunks' : 'belts'} bought again` }])] })) {
    if (app.act({ k: 'unfold', id: d.id }).ok) {
      app.panel = null;
      app.setFloor(deep ? 'factory' : 'workshop', true);
      app.lookAt(d.box.x + d.box.w / 2, d.box.y + d.box.h / 2);
    }
  }
}

/** The ledger, the Modules book's right page: Machine Kits, products and their copies, claims, and
 * how far the Factory is from the slice's end, as ruled rows. */
function ledger(app: App, D: Rect, foot = 0) {
  const ui = app.ui;
  const g = app.game;
  const x = D.x, w = D.w, end = D.y + D.h - foot;
  let yy = D.y;
  ui.big('The ledger', x, yy, T.ink);
  yy += 13;
  rule(ui, x, yy, w, true);
  yy += 3;
  // the parts bank
  uiIcon(ui, 'kit', x, yy, 1);
  ui.text('Machine Kits', x + 11, yy, T.ink);
  ui.big(g.s.parts.format(), x + w, yy - 1, g.s.parts.gt(0) ? T.coin : T.inkSoft, { align: 'right' });
  yy += LINE_H;
  drawRich(ui, g.done('machineKits') ? '{i:machineKit} → the Hopper banks them' : '{u:research} Machine Kits first', x + 11, yy, Infinity, T.inkSoft);
  yy += LINE_H + 1;
  rule(ui, x, yy, w);
  yy += 3;
  // products: copies so far and the next stamp's factor
  const prods = new Map<ItemId, number>();
  for (const d of g.s.designs) {
    const it = mainItem(d);
    if (it && !prods.has(it)) prods.set(it, productCopies(g, d));
  }
  if (prods.size) {
    ui.small('PRODUCT', x, yy, T.inkSoft);
    ui.small('MADE', x + w - 30, yy, T.inkSoft, { align: 'right' });
    ui.small('NEXT', x + w, yy, T.inkSoft, { align: 'right' });
    yy += 8;
  }
  for (const [it, n] of prods) {
    if (yy + LINE_H > end - 60) break;
    ui.ctx.drawImage(itemIcon(it), x, yy);
    ui.clip(x + 10, yy, w - 72, LINE_H);
    ui.text(ITEMS[it].name, x + 11, yy, T.ink);
    ui.unclip();
    ui.text(String(n), x + w - 30, yy, T.ink, { align: 'right' });
    ui.text(`×${(1 + RULES.stampGrowth.value * n).toFixed(1)}`, x + w, yy, T.coin, { align: 'right' });
    ui.hint(x, yy, w, LINE_H, [{ text: `{big:${ITEMS[it].name}}  ${n} cop${n === 1 ? 'y' : 'ies'}` }, { text: `next stamp of any design making it · bill ×${(1 + RULES.stampGrowth.value * n).toFixed(1)}` }], 190);
    yy += LINE_H;
    rule(ui, x, yy - 1, w);
  }
  yy += 3;
  // claims by ore
  if (g.done('coalSeams') || g.s.designs.some((d) => Object.keys(oresOf(g, d)).length)) {
    ui.small('ORE CLAIMS', x, yy, T.inkSoft);
    ui.small('USED', x + w, yy, T.inkSoft, { align: 'right' });
    yy += 8;
    for (const ore of ['ironOre', 'copperOre', 'coal', 'sand'] as ItemId[]) {
      if (yy + LINE_H > end - 34) break;
      const held = claimsHeld(g, ore), used = claimsUsed(g, ore);
      ui.ctx.drawImage(itemIcon(ore), x, yy);
      cells(app, x + 11, yy + 1, w - 46, 6, used, held, used <= held ? T.goodFill : T.badFill);
      ui.text(`${used}/${held}`, x + w, yy, used < held ? T.ink : T.warn, { align: 'right' });
      yy += LINE_H;
    }
    if (g.done('coalSeams') && yy + 16 <= end - 26) {
      if (button(ui, 'openSurvey', x, yy + 1, w, 15, '{u:survey} Survey Office', { tip: [{ text: '{big:Survey Office}' }, { text: 'claims, 4 at a time' }] })) app.panel = 'survey';
      yy += 19;
    }
  }
  // the slice's end, until it is reached: Bramble's Gizmo Festival, by the Factory Dock alone
  const fest = ORDER.gizmoFestival;
  if (!g.flag('sliceEnd') && fest && yy + 38 <= end) {
    const want = fest.wants.gizmo ?? 400;
    const have = Math.min(want, Math.floor(g.s.orders.progress.gizmoFestival?.gizmo?.toNumber() ?? 0));
    const gizmoMod = g.s.factory.ents.some((m) => { const q = m.kind === 'module' ? g.design(m.design) : null; return !!q && mainItem(q) === 'gizmo' && feedsDock(g, m); });
    rule(ui, x, yy, w, true);
    yy += 3;
    ui.small('THE GIZMO FESTIVAL', x, yy, T.inkSoft);
    yy += 8;
    ui.ctx.drawImage(itemIcon('gizmo'), x, yy);
    meter(ui, x + 11, yy + 2, w - 54, 6, have / want, { role: 'good' });
    ui.text(`${have}/${want}`, x + w, yy, T.coin, { align: 'right' });
    yy += LINE_H;
    drawRich(ui, `{${gizmoMod ? 'good' : 'soft'}:${gizmoMod ? ICON.check : ICON.cross}} {i:gizmo} module → Factory Dock`, x, yy, Infinity, gizmoMod ? T.good : T.ink);
    ui.hint(x, yy - 19, w, 30, [{ text: `{big:Bramble's last order}  ${want} {i:gizmo}` }, { text: 'counted at the {u:factory} Factory Dock only' }, { text: 'fold the {i:gizmo} line and its {i:gear} {i:copperWire} feeders · trunk them in' }], 200);
    yy += LINE_H;
  } else if (yy + 3 + 8 + LINE_H + richHeight('{soft:n grows per product, not per design}', w, LINE_H) <= end) {
    // the rule's note wraps on a narrow page: it shows only when both of its lines fit
    rule(ui, x, yy, w, true);
    yy += 3;
    ui.small('THE STAMP PRICE', x, yy, T.inkSoft);
    yy += 8;
    drawRich(ui, 'bill × 1 + 0.5n', x, yy);
    yy += LINE_H;
    drawRich(ui, '{soft:n grows per product, not per design}', x, yy, w);
  }
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

/** A strip of the Festival: boardwalk, stalls, lamps and bunting, frogs walking (UI px). */
function festivalScene(app: App, x: number, y: number, w: number, h: number, t: number) {
  const ui = app.ui;
  const ctx = ui.ctx;
  const k = h >= 64 ? 2 : 1;
  frame(ui, x - 1, y - 1, w + 2, h + 2, 'inset', false);
  ui.clip(x, y, w, h);
  // the sky island's sky in bands (zenith to horizon), two clouds drifting, then the boardwalk
  // along the bottom
  const bands = [C.sky1, C.sky2, C.sky3, C.sky4];
  for (let i = 0; i < bands.length; i++) {
    ctx.fillStyle = bands[i];
    ctx.fillRect(x, y + Math.floor((h * i) / bands.length), w, Math.ceil(h / bands.length));
  }
  if (hasArt('sky_cloud')) {
    const cs = sheet('sky_cloud');
    for (let i = 0; i < 2; i++) {
      const f = cs.frames[2 + i * 2];
      const span = w + cs.w * k;
      const cx = x - cs.w * k + ((t * (6 + i * 4) * k + i * span * 0.55) % span);
      ctx.drawImage(f, Math.round(cx), y + (2 + i * 10) * k, cs.w * k, cs.h * k);
    }
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

/** The slice's end (the Milestone 4 review: it was a plain table missing the Festival's 64K): a
 *  celebration on paper. Gold rays behind the sheet, confetti over the screen, a gold ribbon
 *  across its top, Bramble cheering in his frame with his line in a bubble, the payout counted up
 *  big with ticks and a slam, the Festival's 400 Gizmos popping in, the factory's numbers in ruled
 *  wells, the boardwalk, and what Act II brings. */
export function sliceEndCard(app: App, L: Layout) {
  const ui = app.ui;
  const g = app.game;
  const ctx = ui.ctx;
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
  ui.fill(O.x, O.y, O.w, O.h, C.ink, 0.65);
  const w = Math.min(440, O.w - 12), h = Math.min(300, O.h - 6);
  const x = O.x + Math.floor((O.w - w) / 2), y = O.y + Math.floor((O.h - h) / 2);
  // gold rays turning behind the whole sheet, over the dimmed floor
  ui.clip(O.x, O.y, O.w, O.h);
  rays(app, x + w / 2, y + h / 2, Math.max(O.w, O.h), C.gold, 18);
  ui.unclip();
  ui.region(x, y, w, h, 'panel', true);
  paperRaw(ctx, x, y, w, h, { shadow: true });
  // the ribbon across the top
  ribbon(ui, x + 26, y + 4, w - 52, 'The Gizmo Festival!', { color: 'gold', tails: 'out', icon: 'star' });
  if (t < 4 && Math.floor(t * 30) % 2 === 0) app.hud.confetti = Math.max(app.hud.confetti, 2);
  // Bramble cheering, bouncing, at 2x when the sheet is big enough
  const P = h >= 290 && w >= 400 ? 96 : 48;
  const px0 = x + 12, py0 = y + RIBBON_H + 10;
  frame(ui, px0 - 2, py0 - 2, P + 4, P + 4, 'inset', false);
  ui.clip(px0, py0, P, P);
  ui.fill(px0, py0, P, P, C.moss3);
  rays(app, px0 + P / 2, py0 + P / 2, P, C.lamp3, 10);
  const bounce = Math.floor(t * 4) % 2 ? -Math.max(1, P / 48) : 0;
  if (hasArt('portrait_bramble_cheer')) {
    const s = sheet('portrait_bramble_cheer');
    ctx.drawImage(s.frames[Math.floor(t * 4) % s.frames.length], px0, py0 + bounce, P, P);
  } else if (hasArt('portrait_bramble')) ctx.drawImage(sheet('portrait_bramble').frames[0], px0, py0 + bounce, P, P);
  ui.unclip();
  if (!hasArt('portrait_bramble_cheer') && !hasArt('portrait_bramble')) portrait(ui, 'bramble', px0, py0, 48);
  confetti(app, px0 + P / 2, py0 + P / 3);
  // the payout: counted up from 0 over 1.6 s with ticks, then it slams and bumps
  const rx = px0 + P + 14, rw = x + w - 12 - rx;
  let ry = py0;
  ui.small('THE FESTIVAL PAYS', rx, ry, T.inkSoft);
  ry += 9;
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
  const big = bigWidth(`+${fmt(pays)}`) * 3 + 22 <= rw ? 3 : 2;
  const landT = t - 1.9;
  coinIcon(ui, rx, ry + (big === 3 ? 6 : 2));
  ui.big(num, rx + 20, ry - (k >= 1 && landT < 0.15 ? 1 : 0), k >= 1 && Math.floor(ui.time * 5) % 2 ? C.copper0 : T.coin, { scale: big });
  if (k >= 1 && landT < 0.6) {
    // a burst of gold flecks off the number as it lands
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2, rr = 6 + landT * 60;
      ctx.fillStyle = i % 2 ? T.coinFill : C.lamp2;
      ctx.fillRect(Math.round(rx + 20 + (bigWidth(num) * big) / 2 + Math.cos(a) * rr), Math.round(ry + 12 + Math.sin(a) * rr * 0.6), 2, 2);
    }
  }
  ry += 11 * big + 2;
  const earned = g.s.earned.toNumber();
  const share = earned > 0 ? Math.round((pays / earned) * 100) : 0;
  chip(ui, rx, ry, share > 0 && share <= 100 ? `${share}% of all coin earned` : 'the biggest order yet', { role: 'good', icon: 'star' });
  ry += CHIP_H + 4;
  // the 400 Gizmos: one icon per 20, popping in one by one
  drawRich(ui, `${fmt(want)} {i:gizmo} · one Dock`, rx, ry);
  ry += LINE_H;
  let rEnd = ry;
  const per = 20, n = Math.ceil(want / per);
  const cols = Math.max(1, Math.floor(rw / 11));
  const rows = Math.ceil(n / cols);
  if (P - (ry - py0) >= rows * 11) {
    const on = Math.min(n, Math.floor(Math.max(0, t - 0.2) * 14));
    for (let i = 0; i < on; i++) {
      const ix = rx + (i % cols) * 11, iy = ry + Math.floor(i / cols) * 11;
      const fresh = Math.max(0, t - 0.2) * 14 - i < 1.5;
      ui.fill(ix, iy, 10, 10, fresh ? C.lamp3 : T.paperLo);
      ctx.drawImage(itemIcon('gizmo'), ix + 1, iy + 1 - (fresh ? 1 : 0));
    }
    ui.hint(rx, ry, cols * 11, rows * 11, [{ text: `{big:${fmt(want)} Gizmos}` }, { text: `each square ${per} {i:gizmo} · at the {u:factory} Factory Dock` }], 170);
    rEnd = ry + rows * 11;
  }
  // Bramble's line in a bubble under his frame
  let yy = Math.max(py0 + P + 8, rEnd + 6);
  const quote = `{big:${fmt(want)}} Gizmos! I understand none of it, and I love all of it!`;
  const QL = layoutRich(quote, w - 40);
  const qb = bubble(ui, x + 12, yy, QL.w + 14, QL.h + 9, { side: 'top', at: Math.min(QL.w, P / 2) });
  drawRich(ui, quote, qb.x + 1, qb.y);
  yy += QL.h + 14;
  // what runs into the Factory Dock
  const prods = factoryProducts(app);
  const bottom = y + h - 22;
  {
    let ix = x + 14;
    ui.small('INTO THE DOCK', ix, yy + 3, T.inkSoft);
    ix += smallWidth('INTO THE DOCK') + 6;
    for (const it of prods.slice(0, 6)) {
      const s2 = `{i:${it}} ${ITEMS[it].name}`;
      const sw = richWidth(s2);
      if (ix + sw > x + w - 14 - (chainedNow(app) ? chipWidth('chained') + 6 : 0)) break;
      drawRich(ui, s2, ix, yy + 1);
      ix += sw + 8;
    }
    if (chainedNow(app)) chip(ui, x + w - 14 - chipWidth('chained'), yy, 'chained', { role: 'good', icon: 'fold' });
    yy += CHIP_H + 4;
  }
  // the factory's numbers in ruled wells
  const secs = Math.floor(g.seconds);
  const best = g.s.designs.map((d) => d.grade.letter).sort((a, b) => GRADE_RANK.indexOf(a) - GRADE_RANK.indexOf(b))[0] ?? '-';
  const mods = g.s.factory.ents.filter((e) => e.kind === 'module').length;
  const tiles: [string, string, string][] = [
    [`${Math.floor(secs / 3600)}h ${Math.floor((secs % 3600) / 60)}m`, 'PLAYED', T.ink],
    [g.s.earned.format(), 'COIN EARNED', T.coin],
    [String(mods), 'MODULES PLACED', T.ink],
    [String(g.s.designs.length), 'DESIGNS FOLDED', T.ink],
    [String(Math.max(sliceEndParts(g).designs, prods.length)), 'PRODUCTS TO DOCK', T.good],
    [best, 'BEST GRADE', GRADE_INK[best] ?? T.ink],
  ];
  const tcols = 3, gap = 4;
  const tw = Math.floor((w - 28 - gap * (tcols - 1)) / tcols), th = 22;
  let tilesH = 0;
  tiles.forEach(([v, lab, col], i) => {
    const tx = x + 14 + (i % tcols) * (tw + gap), ty = yy + Math.floor(i / tcols) * (th + 3);
    if (ty + th > bottom - 2) return;
    tilesH = Math.max(tilesH, ty + th - yy + 3);
    // the wells pop in one after another
    if (t < 0.4 + i * 0.12) return;
    frame(ui, tx, ty, tw, th, 'inset', false);
    ui.big(v, tx + 4, ty + 3, col);
    ui.small(lab, tx + tw - 4, ty + th - 8, T.inkSoft, { align: 'right' });
  });
  yy += tilesH + 2;
  // the Festival itself, in whatever room is left: the town's boardwalk with its stalls, lamps,
  // bunting and townsfrogs strolling (the town's own sprites, when drawn)
  const sceneH = bottom - 4 - yy;
  if (sceneH >= 36 && hasArt('town_boardwalk')) festivalScene(app, x + 10, yy, w - 20, Math.min(sceneH, 72), t);
  // the foot: what Act II brings, and back to work
  const bw2 = 116;
  ui.big('Act II', x + 14, y + h - 17, T.research);
  drawRich(ui, '{i:coal} {i:steel} {i:glass} {u:power} · 2 new customers', x + 18 + bigWidth('Act II'), y + h - 16, x + w - 30 - bw2 - (x + 18 + bigWidth('Act II')));
  if (button(ui, 'sliceOk', x + w - 12 - bw2, y + h - 20, bw2, 17, 'Keep building', { gold: true, pulse: true, big: true, tip: [{ text: '{big:Act II}  keep folding' }] })) app.panel = null;
}

export { Num, copiesOf };
