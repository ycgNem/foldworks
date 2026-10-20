// The Reorganize card (DESIGN.md §19, Milestone 5): what a reset gives (the Patents now, term by
// term, and the goals that raise them, the next step first), what it keeps and what it loses, the
// runs so far, and a confirm that takes two clicks. Pillar 4: the reset is always the player's
// choice, and the card says exactly what it costs. Presentation only: the reset itself is the
// `reorganize` command (src/sim/reorganize.ts).
import { C } from '../data/palette';
import { ITEMS } from '../data/items';
import { ICON, textWidth, ellipsize, wrapText, LINE_H } from '../ui/font';
import { itemIcon } from '../render/sprites';
import { previewPatents, reorganizeRefusal, runSeconds, KEPT, LOST } from '../sim/reorganize';
import { TICK_RATE } from '../engine/time';
import { Num } from '../engine/num';
import { card, button } from './chrome';
import { screenHeader } from './widgets';
import type { App } from './app';
import type { Rect, UI } from '../ui/ui';

/** the confirm's first click arms it until this UI time */
const st = { armedUntil: -1 };

const hm = (sec: number) => `${Math.floor(sec / 3600)}:${String(Math.floor((sec % 3600) / 60)).padStart(2, '0')}`;
const p1 = (v: number) => (v >= 10 ? v.toFixed(0) : v.toFixed(1).replace(/\.0$/, ''));

export function reorganizeCard(app: App, r: Rect) {
  const ui = app.ui;
  const g = app.game;
  const p = previewPatents(g);
  screenHeader(app, r, 'Reorganize', C.violet, 'star');
  const y0 = r.y + 22, bottom = r.y + r.h - 6;
  const foot = 40;
  const colH = bottom - foot - y0;
  const gw = Math.floor((r.w - 24) * 0.42), kw = Math.floor((r.w - 24 - gw) / 2);
  // ---- what you gain
  const gin = card(ui, r.x + 8, y0, gw, colH, 'You gain', C.gold, 'star');
  ui.text(`${p.now}`, gin.x + 2, gin.y + 2, C.gold, { scale: 2, shadow: C.ink });
  ui.text(p.now === 1 ? 'Patent' : 'Patents', gin.x + 6 + textWidth(`${p.now}`) * 2, gin.y + 8, C.bone);
  let yy = gin.y + 22;
  const line = (left: string, right: string, col: string = C.bone, ic?: string) => {
    if (yy + 9 > gin.y + gin.h) return;
    let lx = gin.x + 2;
    if (ic) { ui.ctx.drawImage(itemIcon(ic), lx, yy); lx += 10; }
    const rw = textWidth(right);
    ui.text(ellipsize(left, gin.w - (lx - gin.x) - rw - 6), lx, yy, col);
    ui.text(right, gin.x + gin.w - 2, yy, col, { align: 'right' });
    yy += 10;
  };
  for (const l of p.lines) line(`${ITEMS[l.item].name}: ${l.steps} steps x ${l.grade}`, `+${p1(l.patents)}`, C.bone, l.item);
  if (!p.lines.length) line('No modules folded this run', '+0', C.hull1);
  if (p.mega > 0.01) line('The Great Drill, delivered this run', `+${p1(p.mega)}`, C.gold);
  line(`Works: ${Num.of(Math.floor(p.invested)).format()} coin put in`, `+${p1(p.works)}`, C.hull3);
  ui.fill(gin.x + 2, yy, gin.w - 4, 1, C.hull0);
  yy += 3;
  line('Total (rounded down)', `${p1(p.total)}`, C.gold);
  yy += 3;
  if (yy + 9 < gin.y + gin.h) {
    ui.text(`Next step: ${p.nextStep} ${p.nextStep === 1 ? 'Patent' : 'Patents'}`, gin.x + 2, yy, C.teal1);
    yy += 11;
  }
  for (const q of p.goals.slice(0, 4)) {
    if (yy + 9 > gin.y + gin.h) break;
    yy += ui.para(`${ICON.right} ${q.text}`, gin.x + 2, yy, gin.w - 4, C.hull3) + 1;
  }
  // ---- what you keep, and what you lose
  const kx = r.x + 8 + gw + 4;
  const kin = card(ui, kx, y0, kw, colH, 'You keep', C.leaf);
  keepLose(ui, kin, KEPT.map((k) => `${ICON.check} ${k.what}`), KEPT.map((k) => k.why), C.leaf);
  const lin = card(ui, kx + kw + 4, y0, kw, colH, 'You lose', C.pipRed);
  keepLose(ui, lin, LOST.map((l) => `${ICON.cross} ${l}`), [], C.pipRed);
  // ---- the runs so far, and the confirm
  const fy = bottom - foot + 4;
  const m = g.s.meta;
  const runText = `Run ${m.runs + 1}: ${hm(runSeconds(g))} so far, ${g.s.earned.format()} coin earned. ` +
    (m.history.length ? `Before: ${m.history.slice(-3).map((h) => `run ${h.run} ${hm(h.ticks / TICK_RATE)} for ${h.patents}`).join(', ')}.` : 'Your first Reorganize.');
  const bw = Math.min(170, Math.floor(r.w * 0.36));
  ui.para(runText, r.x + 10, fy, r.w - bw - 28, C.hull3);
  const why = reorganizeRefusal(g);
  const armed = ui.time < st.armedUntil;
  const label = why ? 'Not yet' : armed ? `Sure? Reorganize for ${p.now}` : `Reorganize: +${p.now} ${p.now === 1 ? 'Patent' : 'Patents'}`;
  if (button(ui, 'reorganizeGo', r.x + r.w - bw - 10, fy, bw, 22, label, { icon: 'star', disabled: !!why, gold: armed, tip: why ?? (armed ? 'Click again to reset: the run ends here' : 'Two clicks: the first arms it') })) {
    if (!armed) st.armedUntil = ui.time + 4;
    else {
      st.armedUntil = -1;
      if (app.act({ k: 'reorganize' }).ok) afterReorganize(app, p.now);
    }
  }
}

function keepLose(ui: UI, inner: Rect, lines: string[], subs: string[], col: string) {
  // the explanations go first when the column is too short for them (1024x640: the QA pass)
  const need = lines.reduce((h, l, i) => h + wrapText(l, inner.w - 4).length * LINE_H + (subs[i] ? wrapText(subs[i], inner.w - 12).length * LINE_H : 0) + 3, 0);
  if (need > inner.h - 2) subs = [];
  let y = inner.y + 2;
  for (let i = 0; i < lines.length; i++) {
    if (y + 9 > inner.y + inner.h) break;
    y += ui.para(lines[i], inner.x + 2, y, inner.w - 4, col);
    if (subs[i] && y + 9 <= inner.y + inner.h) y += ui.para(subs[i], inner.x + 10, y, inner.w - 12, C.hull1);
    y += 3;
  }
}

/** The app's side of a reset: nothing of the old run stays selected or open, the new run is framed,
 * and the Patent tree opens to spend what was banked. */
export function afterReorganize(app: App, patents: number) {
  app.selected = null;
  app.fselected = null;
  app.gradeId = null;
  app.mode = { k: 'idle' };
  app.renderer.ground = null;
  app.setFloor('workshop', true);
  app.fitCamera(true);
  app.panel = 'patents';
  app.toast('Reorganized', `${patents} ${patents === 1 ? 'Patent' : 'Patents'} banked. Spend them on the Patent tree, then build again.`, C.violet);
  app.audio.sfx('milestone');
  app.save();
}

/** The Committee's portrait until the art director's lands: three raccoon heads stacked in one
 * trench coat (portrait_committee / portrait_committee_small replace it). */
export function committeeFallback(ui: UI, x: number, y: number, size: number) {
  const k = size / 24;
  const f = (c: string, a: number, b: number, w: number, h: number) => ui.fill(x + a * k, y + b * k, w * k, h * k, c);
  f(C.shadow, 0, 0, 24, 24);
  // the coat
  f(C.ink, 5, 13, 14, 11); f(C.copper0, 6, 14, 12, 10); f(C.ink, 11, 15, 1, 9); f(C.brass1, 9, 17, 1, 1); f(C.brass1, 9, 20, 1, 1);
  f(C.copper1, 6, 14, 3, 2); f(C.copper1, 15, 14, 3, 2);
  // the top raccoon: grey head, black mask, bright eyes, ears
  f(C.ink, 7, 3, 10, 10); f(C.fog, 8, 4, 8, 8); f(C.ink, 7, 1, 3, 3); f(C.ink, 14, 1, 3, 3); f(C.fog, 8, 2, 1, 1); f(C.fog, 15, 2, 1, 1);
  f(C.ink, 8, 6, 8, 3); f(C.bone, 9, 7, 2, 1); f(C.bone, 13, 7, 2, 1); f(C.bone, 11, 10, 2, 1); f(C.ink, 11, 9, 2, 1);
  // a hat, slightly too small
  f(C.ink, 8, 0, 8, 2); f(C.hull0, 9, 0, 6, 1);
  // two more peering out of the coat
  f(C.ink, 1, 16, 6, 6); f(C.fog, 2, 17, 4, 4); f(C.ink, 2, 18, 4, 1); f(C.bone, 3, 18, 1, 1);
  f(C.ink, 17, 18, 6, 6); f(C.fog, 18, 19, 4, 4); f(C.ink, 18, 20, 4, 1); f(C.bone, 20, 20, 1, 1);
}
