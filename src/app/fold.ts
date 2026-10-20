// Folding's screens and HUD pieces (DESIGN.md §10, §11, §18): the audit badge while a box is
// measured (a live projected grade with its U/W/C bars and the coin the line makes), the grade
// card (the stamp slams in, then U/W/C, the rates and what would raise it, a name and "Fold it!")
// for Workshop lines and for nested folds on the Factory floor, the Modules inventory (stamp with
// the per-product price, Machine Kits and claims explained; unfold, place, rename) with a ledger
// beside it, the Factory floor's store column and reports, the offline report, and the slice's
// closing card. Reads the App and the Game; changes the game only through App.act.
import { C } from '../data/palette';
import { ITEMS, itemName, type ItemId } from '../data/items';
import { FACTORY } from '../data/land';
import { ORDER } from '../data/orders';
import { RESEARCH } from '../data/research';
import { RULES, SCORE_WEIGHTS } from '../data/rules';
import { megaStage } from '../data/megaprojects';
import { ICON, textWidth, wrapText } from '../ui/font';
import { TICK_RATE } from '../engine/time';
import { Num } from '../engine/num';
import { sheet, itemIcon, hasArt, spriteName } from '../render/sprites';
import { mainOutput, megaFrac } from '../render/factory';
import { auditTicks, projectAudit, entsIn } from '../sim/systems/audits';
import { BUILD } from '../data/machines';
import { gradeFAudit } from '../sim/systems/nested';
import { inBill, defaultName, stampCost, stampRefusal, unfoldRefusal, fname, feedsDock, productCopies, kitsFor, mainItem, sliceEndParts } from '../sim/systems/modules';
import { claimsHeld, claimsUsed, oresOf, copiesOf } from '../sim/systems/claims';
import type { AuditResult, Box, FEnt, ModuleDesign } from '../sim/world';
import { frame, card, button, bar, uiIcon, portrait, coinIcon } from './chrome';
import { icon, perMin as perMinW, screenHeader, cells, fmt } from './widgets';
import type { Layout } from './layout';
import type { App } from './app';
import type { Rect } from '../ui/ui';

const GRADE_ORDER = ['S', 'A', 'B', 'C', 'D'];
const GRADE_COL: Record<string, string> = { S: C.gold, A: C.leaf, B: C.teal1, C: C.copper2, D: C.pipRed };

export const perMin = perMinW;

const warmTicks = () => RULES.auditWarmup.value * TICK_RATE;

/** Coin a minute a set of outputs is worth at the Dock (rates per second). */
function coinPerMin(outs: Partial<Record<ItemId, number>>, mult = 1): number {
  let c = 0;
  for (const [k, r] of Object.entries(outs) as [ItemId, number][]) c += r * 60 * ITEMS[k].value * mult;
  return c;
}

/** A grade letter as the art's 32x32 sprite drawn at `size`, or text. */
function gradeIcon(app: App, letter: string, x: number, y: number, size: number) {
  if (hasArt('ui_grade')) app.ui.ctx.drawImage(sheet('ui_grade').frames[GRADE_ORDER.indexOf(letter)], x, y, size, size);
  else app.ui.text(letter, x + size / 2 - 2, y + size / 2 - 4, GRADE_COL[letter] ?? C.bone);
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

// ------------------------------------------------------------------ the audit badge

/** While a box is measured: a ring that runs down 70 s, the projected grade with live U/W/C bars
 * and their share of the score, the coin a minute the line makes, and Cancel. The audit on the
 * other floor shows as a small chip with a Go button. */
export function auditBadge(app: App, L: Layout) {
  const ui = app.ui;
  const g = app.game;
  const ws = app.floor === 'workshop';
  const here = ws ? g.s.audit : g.s.faudit;
  const there = ws ? g.s.faudit : g.s.audit;
  const c = L.center;
  if (!here) {
    if (!there) return;
    const left = Math.max(0, Math.ceil((auditTicks() - there.t) / TICK_RATE));
    const s = there.result ? `Graded ${there.result.grade.letter} on the ${ws ? 'Factory floor' : 'Workshop'}` : `Audit on the ${ws ? 'Factory floor' : 'Workshop'}: ${left} s`;
    const w = Math.min(c.w - 8, textWidth(s) + 52);
    const x = c.x + Math.floor((c.w - w) / 2), y = c.y + 20;
    frame(ui, x, y, w, 18);
    ui.clip(x + 4, y, w - 44, 18);
    ui.text(s, x + 6, y + 6, there.result ? C.gold : C.teal1);
    ui.unclip();
    if (button(ui, 'gotoAudit', x + w - 38, y + 3, 34, 12, 'Go', { gold: !!there.result })) {
      app.setFloor(ws ? 'factory' : 'workshop', true);
      app.lookAt(there.box.x + there.box.w / 2, there.box.y + there.box.h / 2);
    }
    return;
  }
  const w = Math.min(236, c.w - 8), h = 64;
  const x = c.x + Math.floor((c.w - w) / 2), y = c.y + 20;
  frame(ui, x, y, w, h);
  const total = auditTicks();
  const f = Math.min(1, here.t / total);
  // the ring
  const cx = x + 20, cy = y + 22, rad = 13;
  const ctx = ui.ctx;
  ctx.fillStyle = C.ink;
  ctx.beginPath(); ctx.arc(cx, cy, rad + 2, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = C.shadow;
  ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(cx, cy, rad - 1, 0, Math.PI * 2); ctx.stroke();
  ctx.strokeStyle = here.result ? C.gold : here.t < warmTicks() ? C.hull2 : C.teal1;
  ctx.beginPath(); ctx.arc(cx, cy, rad - 1, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * f); ctx.stroke();
  ctx.lineWidth = 1;
  const res: AuditResult | null = here.result ?? (ws ? projectAudit(g) : here.t > warmTicks() + TICK_RATE ? gradeFAudit(g) : null);
  const left = Math.max(0, Math.ceil((total - here.t) / TICK_RATE));
  if (here.result) gradeIcon(app, here.result.grade.letter, cx - 8, cy - 8, 16);
  else ui.text(`${left}`, cx - Math.floor(textWidth(String(left)) / 2), cy - 3, C.bone);
  ui.text(here.result ? 'graded' : 's left', cx, y + 40, C.hull2, { align: 'center' });
  // the title: what is being measured
  const tx = x + 40;
  const n = here.ids.length;
  let busy = 0;
  for (const id of here.ids) {
    const m = ws ? g.byId.get(id) : g.fById.get(id);
    if (m && m.state === 'work') busy++;
  }
  const warm = here.t < warmTicks();
  const title = here.result ? 'Graded!' : warm ? `Warming up: ${Math.ceil((warmTicks() - here.t) / TICK_RATE)} s` : `${ws ? 'Line' : 'Group'} ${here.box.w}x${here.box.h}: ${busy}/${n} ${ws ? 'busy' : 'running'}`;
  ui.text(title, tx, y + 5, here.result ? C.gold : warm ? C.hull2 : C.teal1);
  // the projection: a grade letter with the live parts beside it
  const gx = x + w - 30;
  if (res) {
    gradeIcon(app, res.grade.letter, gx, y + 4, 24);
    ui.text(here.result ? 'final' : 'so far', gx + 12, y + 29, C.hull2, { align: 'center' });
  } else {
    ui.fill(gx, y + 4, 24, 24, C.ink);
    ui.text('?', gx + 10, y + 12, C.hull2);
    ui.text('soon', gx + 12, y + 29, C.hull1, { align: 'center' });
  }
  const parts: [string, number, number][] = res ? [['U', res.grade.u, SCORE_WEIGHTS.u], ['W', res.grade.w, SCORE_WEIGHTS.w], ['C', res.grade.c, SCORE_WEIGHTS.c]] : [['U', 0, SCORE_WEIGHTS.u], ['W', 0, SCORE_WEIGHTS.w], ['C', 0, SCORE_WEIGHTS.c]];
  const bw = gx - 4 - (tx + 8) - 30;
  let yy = y + 15;
  for (const [k, v, wgt] of parts) {
    ui.text(k, tx, yy, C.hull3);
    if (res) bar(ui, tx + 8, yy + 1, bw, 6, v, v >= 0.9 ? C.leaf : v >= 0.6 ? C.pipYellow : C.pipRed);
    else {
      ui.fill(tx + 8, yy + 1, bw, 6, C.ink);
      for (let i = 0; i < bw - 2; i += 4) if ((i / 4 + Math.floor(ui.time * 6)) % 2 === 0) ui.fill(tx + 9 + i, yy + 2, 2, 4, C.hull0);
    }
    ui.text(res ? `+${(v * wgt).toFixed(2)}` : `x${wgt}`, gx - 4, yy, res ? C.bone : C.hull1, { align: 'right' });
    yy += 9;
  }
  const hint = [{ text: ws ? 'Fold audit' : 'Nested fold audit', color: C.teal1 }, { text: `It runs for 70 s: 10 s to warm up, then 60 s measured. Score = 0.6 U (busy) + 0.2 W (waste handled) + 0.2 C (compact). The grade shown is the window so far.` }];
  ui.hint(x, y, w, 44, hint, 200);
  // the coin a minute the line makes (at the grade so far), and Cancel or See the grade
  const by = y + h - 17;
  const cpm = res ? coinPerMin(res.outs, res.grade.mult) : 0;
  coinIcon(ui, tx, by + 3, false);
  ui.text(res ? `${fmt(cpm)}/min` : 'measuring...', tx + 10, by + 3, res ? C.gold : C.hull1);
  let ix = tx + 14 + textWidth(res ? `${fmt(cpm)}/min` : 'measuring...');
  if (res) {
    for (const [it, r] of (Object.entries(res.outs) as [ItemId, number][]).slice(0, 2)) {
      const s = `${perMin(r * res.grade.mult)}`;
      if (ix + 12 + textWidth(s) > x + w - 50) break;
      ctx.drawImage(itemIcon(it), ix, by + 3);
      ix += 13 + ui.text(s, ix + 10, by + 3, C.leaf);
    }
  }
  if (here.result) {
    if (button(ui, 'openGrade', x + w - 46, by, 42, 13, 'Grade', { gold: true, pulse: true, tip: 'Open the grade card' })) { app.panel = ws ? 'grade' : 'fgrade'; app.gradeAt = ui.time; app.nameDraft = null; app.hud.stamped = false; }
  } else if (button(ui, 'cancelAudit', x + w - 46, by, 42, 13, 'Cancel', { tip: `Stop measuring; the ${ws ? 'line' : 'group'} keeps running.` })) app.act(ws ? { k: 'auditCancel' } : { k: 'fauditCancel' });
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
}

export function gradeCard(app: App, L: Layout) {
  const g = app.game;
  const a = g.s.audit;
  if (!a || !a.result) { app.panel = null; return; }
  const res = a.result;
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
    fold: (name) => app.act({ k: 'fold', name }).ok,
    cancel: () => app.act({ k: 'auditCancel' }),
    foldTip: 'The machines go into a one-tile module; belts are refunded; the box empties.',
    unit: 'machines',
    facts: [`Stamping copies costs the machines' price (${fmt(foldBill(app))} coin) x (1 + 0.5 n), n counted per product.`],
    cancelLabel: 'Keep the line',
    cancelTip: 'Cancel the audit. The line stays and keeps running; audit it again any time.',
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

/** The coin price of the machines in the Workshop audit's box (its stamp bill once folded). */
function foldBill(app: App): number {
  const a = app.game.s.audit;
  if (!a) return 0;
  let bill = 0;
  for (const e of entsIn(app.game, a.box)) if (inBill(e.kind)) bill += BUILD[e.kind].cost;
  return bill;
}

function scaled(res: AuditResult): Partial<Record<ItemId, number>> {
  return Object.fromEntries(Object.entries(res.outs).map(([k, v]) => [k, (v ?? 0) * res.grade.mult])) as Partial<Record<ItemId, number>>;
}

function drawGrade(app: App, L: Layout, sp: GradeSpec) {
  const ui = app.ui;
  const res = sp.res;
  const gr = res.grade;
  const O = L.overlay;
  ui.fill(O.x, O.y, O.w, O.h, C.ink, 0.6);
  const w = Math.min(380, O.w - 12), h = Math.min(258, O.h - 8);
  const x = O.x + Math.floor((O.w - w) / 2), y = O.y + Math.floor((O.h - h) / 2);
  frame(ui, x, y, w, h);
  ui.fill(x + 3, y + 3, w - 6, 15, C.shadow);
  uiIcon(ui, 'fold', x + 6, y + 2);
  ui.text(sp.title, x + 26, y + 7, C.hot, { shadow: C.ink });
  // the stamp: it slams down from 3x, then the burst and confetti
  const t = ui.time - app.gradeAt;
  const k = t < 0.28 ? 3 - 2 * (t / 0.28) ** 2 : 1;
  // the stamp is drawn at 2x when the card is wide enough (integer scales keep the pixels square)
  const S = w >= 340 ? 2 : 1;
  const sx = x + 8, sy = y + 22;
  if (t >= 0.28 && !app.hud.stamped) {
    app.hud.stamped = true;
    app.audio.sfx(('grade' + gr.letter) as 'gradeS');
    app.renderer.fx.kick(gr.letter === 'S' ? 6 : 3);
    app.hud.confetti = gr.letter === 'S' || gr.letter === 'A' ? 60 : 16;
  }
  const ctx = ui.ctx;
  const half = 24 * S;
  const mx = sx + half, my = sy + half;
  const colW = 48 * S + 6;
  // the burst stays in the stamp's own column, under the title strip (the critic: it covered
  // "Audit:", "Compact" and "Score")
  ui.clip(x + 3, y + 18, colW + 6, 48 * S + 4);
  if (t >= 0.28 && hasArt('fx_burst')) {
    const b = sheet('fx_burst');
    const fi = Math.min(b.frames.length - 1, Math.floor((t - 0.28) * 15));
    if ((t - 0.28) * 15 < b.frames.length + 6) ctx.drawImage(b.frames[fi], mx - 32 * S, my - 32 * S, 64 * S, 64 * S);
  }
  ui.unclip();
  // the scale steps in whole numbers so the stamp stays crisp as it falls
  const kk = Math.max(S, Math.round(k * S));
  const big = 48 * kk;
  const ox = mx - big / 2, oy = my - big / 2;
  if (hasArt('ui_stamp_ring')) ctx.drawImage(sheet('ui_stamp_ring').frames[0], ox, oy, big, big);
  else { ctx.fillStyle = GRADE_COL[gr.letter]; ctx.fillRect(ox, oy, big, big); }
  if (hasArt('ui_grade')) ctx.drawImage(sheet('ui_grade').frames[GRADE_ORDER.indexOf(gr.letter)], ox + 8 * kk, oy + 8 * kk, 32 * kk, 32 * kk);
  else ui.text(gr.letter, mx - 4, my - 6, C.ink, { scale: 2 });
  confetti(app, mx, my);
  ui.text(`Score ${gr.score.toFixed(2)}`, mx, sy + 48 * S + 4, C.bone, { align: 'center' });
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
  yy += 11;
  // each thing in the box and how busy it was
  const ax = x + 10, aw = w - 20;
  yy = Math.max(yy + 2, sy + 48 * S + 26);
  {
    let mxx = ax;
    ui.text('Inside', mxx, yy + 4, C.hull2);
    mxx += textWidth('Inside') + 6;
    for (const p of sp.parts) {
      if (mxx + 20 > ax + aw) break;
      ui.fill(mxx, yy, 18, 18, C.ink);
      p.draw(mxx + 1, yy + 1);
      ui.fill(mxx, yy + 19, 18, 3, C.ink);
      ui.fill(mxx + 1, yy + 20, Math.round(16 * p.busy), 1, p.busy >= 0.9 ? C.leaf : p.busy >= 0.6 ? C.pipYellow : C.pipRed);
      ui.hint(mxx, yy, 18, 22, `${p.name}: busy ${Math.round(p.busy * 100)}%`, 140);
      mxx += 21;
    }
    yy += 26;
  }
  // what would raise it
  const by = y + h - 36;
  if (res.advice.length && gr.letter !== 'S') {
    ui.text('To raise it:', ax, yy, C.gold);
    yy += 10;
    for (const l of res.advice.slice(0, 2)) {
      if (yy + 20 > by - 2) break;
      yy += ui.para(`${ICON.right} ${l}`, ax, yy, aw, C.bone) + 1;
    }
  } else if (gr.letter === 'S') {
    ui.text('A perfect fold. The Gazette will hear of this.', ax, yy, C.gold);
    yy += 12;
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
  if (button(ui, 'doFold', ax, by + 16, bw, 15, 'Fold it!', { gold: true, pulse: true, tip: sp.foldTip })) {
    app.hud.focus = null;
    app.input.typing = null;
    if (sp.fold(app.nameDraft)) { app.panel = null; app.hud.stamped = false; }
  }
  if (button(ui, 'cancelFold', ax + bw + 4, by + 16, bw, 15, sp.cancelLabel, { tip: sp.cancelTip })) {
    sp.cancel();
    app.panel = null;
    app.hud.stamped = false;
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
  // the slice's end, until it is reached
  if (!g.flag('sliceEnd') && yy + 34 <= end) {
    const p = sliceEndParts(g);
    ui.text('The Factory goal', inner.x, yy, C.hot);
    yy += 10;
    ui.text(`${p.designs >= 3 ? ICON.check : ICON.cross} ${Math.min(3, p.designs)}/3 products running`, inner.x, yy, p.designs >= 3 ? C.leaf : C.bone);
    yy += 10;
    ui.text(`${p.chained ? ICON.check : ICON.cross} one module feeding another`, inner.x, yy, p.chained ? C.leaf : C.bone);
    yy += 10;
  } else {
    const tip = 'Stamps grow by product, not design: a better line for the same product doesn\'t reset the price.';
    if (yy + wrapText(tip, inner.w).length * 10 <= end) ui.para(tip, inner.x, yy, inner.w, C.hull2);
  }
}

// ------------------------------------------------------------------ the Factory store column

export function factoryStore(app: App, L: Layout) {
  const ui = app.ui;
  const g = app.game;
  const r = L.right;
  frame(ui, r.x, r.y, r.w, r.h);
  ui.fill(r.x + 3, r.y + 3, r.w - 6, 13, C.shadow);
  ui.text('Factory', r.x + 7, r.y + 6, C.hot, { shadow: C.ink });
  if (button(ui, 'openModules', r.x + r.w - 60, r.y + 3, 56, 13, 'Modules', { active: app.panel === 'modules', tip: 'The inventory: stamp copies, unfold, rename (I).' })) app.togglePanel('modules');
  let y = r.y + 20;
  const rowH = 30;
  // quick links along the bottom: the Survey Office, the Codex, the Drill
  const links: { id: 'survey' | 'codex' | 'mega'; ic: 'survey' | 'codex' | 'mega'; tip: string }[] = [];
  if (g.done('coalSeams')) links.push({ id: 'survey', ic: 'survey', tip: 'The Survey Office: ore claims' }, { id: 'codex', ic: 'codex', tip: "Unit 7's Codex" });
  if (g.done('greatDrill')) links.push({ id: 'mega', ic: 'mega', tip: 'The Great Drill' });
  const linkY = r.y + r.h - 22;
  const bottom = links.length ? linkY - 2 : r.y + r.h - 4;
  if (links.length) {
    const lw = Math.floor((r.w - 8 - (links.length - 1) * 3) / links.length);
    links.forEach((l, i) => {
      if (button(ui, 'flink:' + l.id, r.x + 4 + i * (lw + 3), linkY, lw, 18, '', { tip: l.tip })) app.togglePanel(l.id);
      icon(app, l.ic, r.x + 4 + i * (lw + 3) + Math.floor((lw - 16) / 2), linkY + 1);
    });
  }
  // the trunk belt
  const tr = app.mode.k === 'ftrunk';
  const rowFrame = (yy: number, active: boolean, hov: boolean) => {
    if (hasArt('ui_row')) {
      const s = sheet('ui_row');
      ui.ctx.drawImage(s.frames[hov ? 1 : 0], r.x + 4, yy, r.w - 8, rowH - 2);
    } else ui.fill(r.x + 4, yy, r.w - 8, rowH - 2, hov ? C.ground1 : C.ground0);
    if (active) ui.fill(r.x + 5, yy + 1, 2, rowH - 4, C.gold);
  };
  {
    const hov = ui.hover(r.x + 4, y, r.w - 8, rowH - 2);
    ui.region(r.x + 4, y, r.w - 8, rowH - 2, 'button');
    rowFrame(y, tr, hov);
    ui.fill(r.x + 8, y + 3, 22, 22, C.ink);
    ui.ctx.drawImage(sheet('trunk').frames[0], r.x + 11, y + 6);
    ui.text('1', r.x + 6, y + 2, C.hull2);
    ui.text('Trunk belt', r.x + 34, y + 4, C.bone);
    coinIcon(ui, r.x + 34, y + 15, false);
    ui.text(`${FACTORY.trunkCost}  ${FACTORY.trunkSpeed * 60}/min`, r.x + 44, y + 15, g.s.coin.gte(FACTORY.trunkCost) ? C.gold : C.pipRed);
    if (hov) ui.tip([{ text: 'Trunk belt (key 1)', color: C.gold }, { text: `Carries ${FACTORY.trunkSpeed * 60} items a minute from a module's front to the next module's back, the Factory Dock, the Hopper or the Megaproject Bay. A trunk leaving a module's side takes its slag or oil. Drag to lay a line.` }], 190);
    if (hov && ui.clicked) { ui.eat(); app.setMode(tr ? { k: 'idle' } : { k: 'ftrunk' }); }
    y += rowH;
  }
  if (!g.s.designs.length) {
    ui.para('Fold a line on the Workshop (F) to get your first module.', r.x + 8, y + 4, r.w - 16, C.hull2);
    return;
  }
  ui.text('Your modules', r.x + 8, y + 2, C.hull2);
  y += 11;
  g.s.designs.forEach((d, i) => {
    if (y + rowH > bottom) return;
    const active = app.mode.k === 'fmodule' && app.mode.design === d.id;
    const hov = ui.hover(r.x + 4, y, r.w - 8, rowH - 2);
    ui.region(r.x + 4, y, r.w - 8, rowH - 2, 'button');
    rowFrame(y, active, hov);
    ui.fill(r.x + 8, y + 3, 22, 22, d.depth === 2 ? C.teal0 : C.ink);
    ui.ctx.drawImage(sheet('module').frames[0], r.x + 11, y + 6);
    const out = mainOutput(g, d.id);
    if (out) ui.ctx.drawImage(itemIcon(out), r.x + 15, y + 10);
    if (i < 8) ui.text(String(i + 2), r.x + 6, y + 2, C.hull2);
    ui.clip(r.x + 34, y, r.w - 52, rowH);
    ui.text(d.name, r.x + 34, y + 4, d.spare ? C.bone : C.hull2);
    ui.unclip();
    ui.text(d.grade.letter, r.x + r.w - 12, y + 4, GRADE_COL[d.grade.letter], { align: 'right' });
    const cost = stampCost(g, d);
    const why = stampRefusal(g, d);
    const bwid = Math.min(54, Math.max(40, textWidth(`+${cost.format()}`) + 8));
    const bx = r.x + r.w - 8 - bwid;
    ui.clip(r.x + 34, y + 13, bx - (r.x + 34) - 2, 12);
    ui.text(`${d.spare} spare`, r.x + 34, y + 15, d.spare ? C.leaf : C.hull1);
    ui.unclip();
    if (button(ui, 'fstamp:' + d.id, bx, y + 13, bwid, 12, `+${cost.format()}`, { disabled: !!why, tip: why ?? `Stamp a copy for ${cost.format()} coin: bill x (1 + 0.5 x ${productCopies(g, d)} copies of this product).` })) app.act({ k: 'stamp', id: d.id });
    if (hov) ui.tip([{ text: d.name + (d.depth === 2 ? ' (depth 2)' : ''), color: C.gold }, { text: `Grade ${d.grade.letter} (x${d.grade.mult.toFixed(2)}). Makes ${Object.entries(d.outs).map(([k, v]) => `${perMin(v ?? 0)} ${ITEMS[k as ItemId].name.toLowerCase()}`).join(', ')} a minute.` }, { text: Object.keys(d.ins).length ? `Takes ${Object.entries(d.ins).map(([k, v]) => `${perMin(v ?? 0)} ${ITEMS[k as ItemId].name.toLowerCase()}`).join(', ')} a minute at its back.` : 'A source: it takes nothing in.', color: C.hull2 }, { text: 'Click, then click the floor. R rotates: the gold mark is its front.', color: C.hull2 }], 200);
    if (hov && ui.clicked) { ui.eat(); app.pickModule(d.id); }
    y += rowH;
  });
}

/** The hover report for a thing on the Factory floor. */
export function factoryReport(app: App, e: FEnt): { text: string; color?: string }[] {
  const g = app.game;
  const out: { text: string; color?: string }[] = [{ text: fname(g, e), color: C.gold }];
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
  if (e.state === 'work') out.push({ text: `Working: ${pct}% of full speed lately`, color: C.pipGreen });
  else if (e.state === 'starved') out.push({ text: `Starved of ${ITEMS[e.why as ItemId]?.name.toLowerCase() ?? 'input'} (${pct}% lately): feed its back`, color: C.pipYellow });
  else if (e.state === 'blocked') {
    const r = g.routes.find((q) => q.from === e && !q.by);
    const where = !r?.to ? 'its front leads nowhere: lay a trunk to the Factory Dock' : r.to.kind === 'module' ? `${fname(g, r.to)} does not take it` : 'the trunk is full';
    out.push({ text: `Blocked: ${ITEMS[e.why as ItemId]?.name.toLowerCase() ?? 'output'} has nowhere to go (${where})`, color: C.pipRed });
  } else out.push({ text: 'Idle', color: C.hull2 });
  out.push({ text: `Makes ${Object.entries(d.outs).map(([k, v]) => `${perMin(v ?? 0)} ${ITEMS[k as ItemId].name.toLowerCase()}`).join(', ')} a minute at full speed` });
  if (Object.keys(d.ins).length) out.push({ text: `Takes ${Object.entries(d.ins).map(([k, v]) => `${perMin(v ?? 0)} ${ITEMS[k as ItemId].name.toLowerCase()}`).join(', ')} a minute at its back` });
  if (g.routes.some((q) => q.from === e && q.by && q.to)) out.push({ text: 'Byproducts leave by its side trunk', color: C.violet });
  out.push({ text: feedsDock(g, e) ? 'Feeds the Factory Dock' : 'Does not reach the Factory Dock yet', color: C.hull2 });
  if (d.depth === 2) out.push({ text: `Depth 2: folded from ${(d.fparts ?? []).filter((p) => p.kind === 'module').length} modules`, color: C.teal1 });
  out.push({ text: `Grade ${d.grade.letter}: rates x${d.grade.mult.toFixed(2)}`, color: GRADE_COL[d.grade.letter] });
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

export function sliceEndCard(app: App, L: Layout) {
  const ui = app.ui;
  const g = app.game;
  const O = L.overlay;
  ui.fill(O.x, O.y, O.w, O.h, C.ink, 0.7);
  const w = Math.min(340, O.w - 12), h = Math.min(236, O.h - 8);
  const x = O.x + Math.floor((O.w - w) / 2), y = O.y + Math.floor((O.h - h) / 2);
  frame(ui, x, y, w, h);
  ui.fill(x + 3, y + 3, w - 6, 15, C.shadow);
  ui.text('Milestone reached', x + w / 2, y + 7, C.gold, { align: 'center', shadow: C.ink });
  const t = ui.time - app.gradeAt;
  if (t < 3 && Math.floor(t * 30) % 2 === 0) app.hud.confetti = Math.max(app.hud.confetti, 2);
  if (hasArt('portrait_bramble_cheer')) {
    frame(ui, x + 10, y + 24, 52, 52, 'inset', false);
    const s = sheet('portrait_bramble_cheer');
    ui.ctx.drawImage(s.frames[Math.floor(t * 4) % s.frames.length], x + 12, y + 26);
  } else portrait(ui, 'bramble', x + 12, y + 26, hasArt('portrait_bramble') ? 48 : 24);
  confetti(app, x + 36, y + 40);
  const parts = sliceEndParts(g);
  const prods = factoryProducts(app);
  ui.text('The swamp has a Factory!', x + 70, y + 26, C.hot);
  const named = listNames(prods.slice(0, 4));
  const quote = `"${named[0].toUpperCase() + named.slice(1)}, humming into one Dock${chainedNow(app) ? ', one module feeding the next' : ''}. I understand none of it and I love all of it. Ribbit!" Mayor Bramble`;
  ui.para(quote, x + 70, y + 38, w - 82, C.bone);
  // what the player built: the products, side by side
  let yy = y + 84;
  ui.text('Running into the Factory Dock', x + 14, yy, C.hull2);
  yy += 10;
  let px = x + 14;
  for (const it of prods.slice(0, 6)) {
    const s = ITEMS[it].name;
    if (px + 20 + textWidth(s) > x + w - 12) break;
    ui.fill(px, yy, 12, 12, C.ink);
    ui.ctx.drawImage(itemIcon(it), px + 2, yy + 2);
    px += 22 + ui.text(s, px + 15, yy + 3, C.gold);
  }
  yy += 16;
  const secs = Math.floor(g.seconds);
  const best = g.s.designs.map((d) => d.grade.letter).sort((a, b) => GRADE_ORDER.indexOf(a) - GRADE_ORDER.indexOf(b))[0] ?? '-';
  const rows: [string, string][] = [
    ['Time', `${Math.floor(secs / 3600)}h ${Math.floor((secs % 3600) / 60)}m`],
    ['Coin earned', g.s.earned.format()],
    ['Products into the Factory Dock', `${Math.max(parts.designs, prods.length)}`],
    ['One module feeding another', chainedNow(app) ? 'yes' : 'not yet'],
    ['Designs folded / modules placed', `${g.s.designs.length} / ${g.s.factory.ents.filter((e) => e.kind === 'module').length}`],
    ['Best grade', best],
  ];
  for (const [k, v] of rows) {
    if (yy + 10 > y + h - 44) break;
    ui.text(k, x + 14, yy, C.hull2);
    ui.text(v, x + w - 14, yy, C.gold, { align: 'right' });
    yy += 11;
  }
  ui.para('Act II opens up from here: coal, steel, power and two new customers. Keep folding.', x + 14, y + h - 42, w - 28, C.teal1);
  if (button(ui, 'sliceOk', x + Math.floor(w / 2) - 55, y + h - 20, 110, 16, 'Keep building', { gold: true, pulse: true })) app.panel = null;
}

export { Num, copiesOf };
