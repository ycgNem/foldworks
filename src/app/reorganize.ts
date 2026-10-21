// The Reorganize page (DESIGN.md §19, Milestone 5; docs/hud-180.md "Full-screen menus"): the
// Committee slides a contract across the table. Three columns of ink: what you gain (the Patents
// now, term by term: each product new, better than the design on file, or already filed; the Great
// Drill; the bills of the last five minutes; the total; then the goals that raise it, the next step
// first), what you keep (ticked, each with its reason on hover) and what you lose (struck through in
// red ink). Under it the run so far and the runs before, and a gold "Sign here" that takes two
// clicks. Pillar 4: the reset is always the player's choice, and the contract says exactly what it
// costs. Presentation only: the reset itself is the `reorganize` command (src/sim/reorganize.ts).
import { C } from '../data/palette';
import { ITEMS, type ItemId } from '../data/items';
import { RULES, GRADES } from '../data/rules';
import { megaStage } from '../data/megaprojects';
import { ICON, bigWidth, textWidth, BIG_H } from '../ui/font';
import { previewPatents, reorganizeRefusal, runSeconds, chainSteps, nextTierRate, bestThisRun, KEPT, LOST, type PatentGoal, type Preview } from '../sim/reorganize';
import { TICK_RATE } from '../engine/time';
import { Num } from '../engine/num';
import { button, rule, chip } from './chrome';
import { menuTemplate } from './widgets';
import { layoutRich, drawLayout, richWidth } from '../ui/rich';
import { T } from '../ui/theme';
import type { App } from './app';
import type { Rect, UI } from '../ui/ui';
import { bookArea, speak, heading, struck, ROW_H } from './ledger';

/** the confirm's first click arms it until this UI time */
const st = { armedUntil: -1 };

const hm = (sec: number) => `${Math.floor(sec / 3600)}:${String(Math.floor((sec % 3600) / 60)).padStart(2, '0')}`;
const p1 = (v: number) => (v >= 10 ? v.toFixed(0) : v.toFixed(1).replace(/\.0$/, ''));
const lc = (it: ItemId) => ITEMS[it].name.toLowerCase();

export function reorganizeCard(app: App, r0: Rect) {
  const ui = app.ui;
  const g = app.game;
  const p = previewPatents(g);
  const r = bookArea(r0);
  const { body } = menuTemplate(app, r, { title: 'Reorganize', accent: C.violet, icon: 'star' });
  const why = reorganizeRefusal(g);
  const armed = ui.time < st.armedUntil;
  // ---- the Committee, sliding the contract over
  const line = why ? '"not yet." "come back with a fold." "or two."' : armed ? '"sure?" "sign again." "no take-backs."' : `"psst." "sign here." {chip:reset:+${p.now} ${p.now === 1 ? 'Patent' : 'Patents'}}`;
  let y = body.y;
  y += speak(app, 'committee', line, body.x, y, Math.min(body.w, 300), { size: 24, fallback: committeeFallback }) + 6;
  // ---- the contract: a sheet on the page, three ruled columns
  const foot = 26;
  const sheet = { x: body.x + 2, y, w: body.w - 4, h: body.y + body.h - foot - y };
  ui.panel(sheet.x, sheet.y, sheet.w, sheet.h, 'paper', true);
  const ix = sheet.x + 6, iy = sheet.y + 5, iw = sheet.w - 12, ih = sheet.h - 9;
  const gw = Math.floor((iw - 16) * 0.44), kw = Math.floor((iw - 16 - gw) / 2);
  gainColumn(app, p, { x: ix, y: iy, w: gw, h: ih });
  const kx = ix + gw + 8;
  ui.ctx.fillStyle = T.paperEdge;
  ui.ctx.fillRect(kx - 4, iy, 1, ih);
  keepColumn(ui, { x: kx, y: iy, w: kw, h: ih });
  const lx = kx + kw + 8;
  ui.ctx.fillRect(lx - 4, iy, 1, ih);
  loseColumn(ui, { x: lx, y: iy, w: iw - (lx - ix), h: ih });
  // ---- the run so far, the runs before, and the signature
  const fy = body.y + body.h - foot + 6;
  const m = g.s.meta;
  const bw = Math.max(110, bigWidth(armed ? 'Sure? Sign' : 'Sign here') + 40);
  const bx = body.x + body.w - bw - 2;
  const runRow = `{big:Run ${m.runs + 1}} {u:clock} ${hm(runSeconds(g))} · {coin:${g.s.earned.format()}} earned`;
  const before = m.history.length ? `{soft:before} ${m.history.slice(-3).map((h) => `run ${h.run} ${hm(h.ticks / TICK_RATE)} → {reset:${h.patents}}`).join(' · ')}` : '{soft:your first Reorganize}';
  const RL = layoutRich(runRow);
  drawLayout(ui, RL, body.x + 2, fy - 2, T.ink);
  let textEnd = body.x + 2 + RL.w;
  const BL = layoutRich(before);
  if (textEnd + 12 + BL.w < bx - 16) {
    drawLayout(ui, BL, textEnd + 12, fy, T.ink);
    textEnd += 12 + BL.w;
  }
  // the dotted line the Committee taps, an x at its start
  const sx = Math.max(textEnd + 10, bx - 70);
  if (bx - 6 - sx >= 24) {
    ui.text(ICON.cross, sx, fy + 1, T.inkSoft);
    for (let i = sx + 9; i < bx - 6; i += 3) ui.fill(i, fy + 8, 2, 1, T.inkSoft);
  }
  const label = why ? 'Not yet' : armed ? 'Sure? Sign' : 'Sign here';
  const tip = why ? [{ text: `{bad:${why}}` }] : armed ? [{ text: '{u:reset} click again · the run ends here' }] : [{ text: '{u:reset} two clicks · the first arms it' }, { text: before }];
  if (button(ui, 'reorganizeGo', bx, fy - 6, bw, 20, label, { icon: 'reset', disabled: !!why, gold: !why, big: true, pulse: armed, tip })) {
    if (!armed) st.armedUntil = ui.time + 4;
    else {
      st.armedUntil = -1;
      if (app.act({ k: 'reorganize' }).ok) afterReorganize(app, p.now);
    }
  }
}

/** The left column: the Patents a Reorganize gives now, term by term, and what would raise it. */
function gainColumn(app: App, p: Preview, c: Rect) {
  const ui = app.ui;
  const bottom = c.y + c.h;
  let y = c.y;
  heading(ui, 'You gain', c.x, y, c.w, 'reset');
  const word = p.now === 1 ? 'Patent' : 'Patents';
  ui.text(word, c.x + c.w, y + 2, T.reset, { align: 'right' });
  ui.big(`+${p.now}`, c.x + c.w - textWidth(word) - 4, y, T.reset, { align: 'right' });
  y += BIG_H + 5;
  /** a row: left markup, right markup at the column's edge; `wrap` lets the left run onto a
   * second line (the goals), else a row too wide is refused (the caller tries a shorter one) */
  const row = (left: string, right: string, colR: string = T.ink, tip?: string, wrap = false) => {
    const rw = richWidth(right);
    const L = layoutRich(left, wrap ? c.w - rw - 6 : Infinity);
    if (!wrap && L.w > c.w - rw - 6) return false;
    const h = L.lines.length > 1 ? L.h + 3 : ROW_H;
    if (y + h > bottom) return false;
    drawLayout(ui, L, c.x, y + 2, T.ink);
    drawLayout(ui, layoutRich(right), c.x + c.w, y + 2, colR, { align: 'right' });
    if (tip) ui.hint(c.x, y, c.w, h, tip, 200);
    y += h;
    return true;
  };
  // the Milestone 5-6 review round: Patents are filed, so each product says whether it is new, an
  // improvement on the design on file, or already filed (files nothing)
  const order: Record<string, number> = { new: 0, improved: 1, filed: 2 };
  const CHIP = { new: '{chip:good:new}', improved: '{chip:research:better}', filed: '{chip:soft:on file}' } as const;
  for (const l of [...p.lines].sort((a, b) => order[a.status] - order[b.status] || b.patents - a.patents)) {
    const fact = `${l.steps}×${l.grade}${l.tier ? `×t${l.tier}` : ''}`;
    const right = l.status === 'filed' ? '{soft:0}' : `{reset:+${p1(l.patents)}}`;
    const tip = `{i:${l.item}} ${ITEMS[l.item].name} · ${l.steps} step${l.steps === 1 ? '' : 's'} folded × grade ${l.grade}${l.tier ? ` × tier ${l.tier}` : ''} · ${CHIP[l.status]}`;
    if (!row(`{i:${l.item}} ${ITEMS[l.item].name} ${fact} ${CHIP[l.status]}`, right, T.ink, tip)) row(`{i:${l.item}} ${fact} ${CHIP[l.status]}`, right, T.ink, tip);
  }
  if (!p.lines.length) row('{u:fold} {soft:no modules folded this run}', '{soft:+0}');
  if (p.mega > 0.01) row('{u:mega} the Great Drill', `{reset:+${p1(p.mega)}}`, T.ink, '{u:mega} delivered to the Bay this run');
  row(`{u:build} running 5 min · {coin:${Num.of(Math.floor(p.billValue)).format()}}`, `{reset:+${p1(p.bills)}}`, T.ink, '{u:build} the bills of the buildings at work · the last 5 min');
  if (y + 3 + ROW_H <= bottom) {
    rule(ui, c.x, y + 1, c.w, true);
    y += 3;
    row('{big:Total} {soft:rounded down}', `{reset:${p1(p.total)}} → {big:${p.now}}`);
  }
  // the next step, and the goals that raise it
  if (y + ROW_H + 2 <= bottom) {
    y += 3;
    const cw = chip(ui, c.x, y, `next step ${p.nextStep}`, { role: 'research', solid: true });
    ui.text(p.nextStep === 1 ? 'Patent' : 'Patents', c.x + cw + 4, y + 2, T.research);
    y += ROW_H;
  }
  for (const q of p.goals.slice(0, 4)) {
    const gr = goalRow(app, p, q);
    if (!gr) continue;
    if (!row(gr[0], gr[1], T.reset, undefined, true)) break;
  }
}

/** A goal as a row (left markup, right markup), from its kind and the run's own numbers. */
function goalRow(app: App, p: Preview, q: PatentGoal): [string, string] | null {
  const g = app.game;
  const gain = `{reset:+${p1(q.gain)}}`;
  const it = q.item;
  const line = it ? p.lines.find((l) => l.item === it) : undefined;
  switch (q.kind) {
    case 'fold': {
      if (!it) return null;
      const k = RULES.patentPerStep.value;
      const on = g.s.meta.patented?.[it]?.value ?? 0;
      const hi = k * Math.max(0, chainSteps(it) * GRADES[0].mult - on);
      return [on ? `{u:fold} fold {i:${it}} past its filed one` : `{u:fold} fold {i:${it}} ${lc(it)} {chip:good:new}`, `{soft:up to} {reset:+${p1(hi)}}`];
    }
    case 'grade':
      return it ? [`{u:fold} refold {i:${it}} at S+ {soft:now ${line?.grade ?? '?'}}`, gain] : null;
    case 'deeper':
      return it ? [`{u:fold} {i:${it}} a step deeper {soft:${line?.steps ?? '?'} of ${chainSteps(it)}}`, gain] : null;
    case 'bigger': {
      if (!it) return null;
      const v = bestThisRun(g).get(it);
      const next = v ? nextTierRate(v.design, it) : 0;
      return [`{u:fold} a bigger {i:${it}} line {soft:${p1(line?.perMin ?? 0)} → ${p1(next)}/min}`, gain];
    }
    case 'committee': {
      const stg = megaStage(g.s.mega.stage);
      return [`{u:orders} Committee orders {soft:${g.s.orders.rep.committee ?? 0}/${stg?.rep ?? '?'}${ICON.heart} opens ${stg?.name ?? 'the Drill'}}`, gain];
    }
    case 'mega': {
      const stg = megaStage(g.s.mega.stage);
      return [`{u:mega} finish ${stg?.name ?? 'the Drill'}`, gain];
    }
  }
  return null;
}

/** Why each kept thing is kept, as a row for its tip (the sim's words, src/sim/reorganize.ts KEPT,
 * stand when a new entry has no row here). */
const KEPT_ROW: Record<string, string> = {
  'Patents and the Patent tree': '{u:reset} what the reset is for',
  "The Patent Office's record": "{u:patents} each product's best design on file · a run is paid for beating it",
  'The Patent Drawer': '{u:blueprint} kept designs · unfold whole onto their boxes',
  'The Great Drill': '{u:mega} its progress survives every reset',
  'Reputation': "{u:heart} every customer remembers you · rewards stay · the Committee's opens the Drill",
  'The Night Shift': '{u:overnight} the offline crews you bought with coin',
  'The Codex': '{u:codex} firsts paid stay paid',
  'Trophies and lifetime statistics': '{u:trophies} the shelf and the counters',
};

/** The middle column: what a Reorganize keeps, ticked; its reason on hover. */
function keepColumn(ui: UI, c: Rect) {
  let y = c.y;
  heading(ui, 'You keep', c.x, y, c.w, 'good');
  y += BIG_H + 5;
  for (const k of KEPT) {
    const L = layoutRich(k.what, c.w - 10);
    if (y + L.h > c.y + c.h) break;
    ui.text(ICON.check, c.x, y, T.good);
    drawLayout(ui, L, c.x + 9, y, T.ink);
    ui.hint(c.x, y - 1, c.w, L.h + 2, [{ text: `{good:${ICON.check}} {big:${k.what}}` }, { text: KEPT_ROW[k.what] ?? k.why, color: T.inkSoft }], 190);
    y += L.h + 3;
  }
}

/** The right column: what it loses, struck through in red ink (its note under it when there is room). */
function loseColumn(ui: UI, c: Rect) {
  let y = c.y;
  heading(ui, 'You lose', c.x, y, c.w, 'bad');
  y += BIG_H + 5;
  const rows = LOST.map((l) => {
    const m = /\s*\(([^)]*)\)/.exec(l);
    return m ? { what: (l.slice(0, m.index) + l.slice(m.index + m[0].length)).trim(), note: m[1] } : { what: l, note: '' };
  });
  const need = rows.reduce((h, q) => h + layoutRich(q.what, c.w - 10).h + (q.note ? layoutRich(q.note, c.w - 10).h : 0) + 3, 0);
  const notes = need <= c.h - BIG_H - 5;
  for (const q of rows) {
    const h = layoutRich(q.what, c.w - 10).h;
    if (y + h > c.y + c.h) break;
    ui.text(ICON.cross, c.x, y, T.bad);
    struck(ui, q.what, c.x + 9, y, c.w - 10);
    ui.hint(c.x, y - 1, c.w, h + 2, [{ text: `{bad:${ICON.cross}} {big:${q.what}}` }, ...(q.note ? [{ text: q.note, color: T.inkSoft }] : [])], 190);
    y += h;
    if (notes && q.note) y += drawNote(ui, q.note, c.x + 9, y, c.w - 10);
    y += 3;
  }
}

function drawNote(ui: UI, s: string, x: number, y: number, w: number): number {
  const L = layoutRich(`{soft:${s}}`, w);
  drawLayout(ui, L, x, y, T.inkSoft);
  return L.h;
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
  app.toast('Reorganized', `{reset:+${patents}} ${patents === 1 ? 'Patent' : 'Patents'} banked · spend them on the tree`, C.violet);
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

