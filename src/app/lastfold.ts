// The Last Fold (DESIGN.md §23, reset layer 3): its card and its moment. The card is a page of the
// ledger like Relocate's (src/app/relocate.ts): the Inspector's grade of the whole World stamped on
// the left with U, W and C, then what the fold banks (Kernels: the value term, the grade's bonus, the
// total rounded down, and what would raise it), what is kept (ticked) and lost (struck in red ink);
// the right page is the Seed it will plant, the Keep-Legacy picker once Kept Legacy is owned, and the
// World's modules as the Last Fold counts them. A gold "Fold the World" takes two clicks; "Keep the
// World" cancels the audit. Then the full-screen moment: the `lastfold` strip (the World folding into
// one tile, the flash, the dawn, the tile falling to a new Workshop, the Seed) at a whole-number cover
// scale, frame by frame on its sidecar's durations, its events (the audit's tick, the six creases,
// the flash, the fall and the landing) as sounds and shakes, `audio.resetSound(3)` at the flash, the
// Kernels stamped on the landing; then the new universe's Workshop and the Kernel tree to spend them.
// Pillar 4: the reset is always the player's, and the card says what it costs. Presentation only:
// the reset itself is the `lastFold` command (src/sim/lastfold.ts).
import { C, rgba } from '../data/palette';
import { ITEMS } from '../data/items';
import { RULES, SCORE_WEIGHTS, GRADES } from '../data/rules';
import { LEGACY, type LegacyId } from '../data/legacy';
import { KERNEL_GRADE } from '../data/kernels';
import { BIG_H, ICON, bigWidth, smallWidth, textWidth } from '../ui/font';
import { layoutRich, drawLayout, richWidth, drawRich } from '../ui/rich';
import { T, type Role } from '../ui/theme';
import { sheet, hasArt, itemIcon } from '../render/sprites';
import { previewKernels, lastFoldRefusal, LASTFOLD_KEPT, LASTFOLD_LOST, type KernelPreview } from '../sim/lastfold';
import { krules } from '../sim/kernels';
import { worldOf } from '../sim/systems/islands';
import { WORLDS } from '../data/worlds';
import { button, rule, chip, chipWidth, meter, stamp } from './chrome';
import { menuTemplate, rays, slamScale, type IconName } from './widgets';
import { bookArea, speak, heading, struck, ROW_H } from './ledger';
import { gradeStamp, drawStamp } from './fold';
import { legacyShort } from './legacy';
import { registerScreen } from './screens';
import type { App } from './app';
import type { Rect } from '../ui/ui';

/** The sidecar of the `lastfold` strip: per-frame durations (ms), the frames it loops on, and the
 *  frames its events fall on (docs/endgame.md, Act V art as built). */
interface StripMeta { frame: [number, number]; durations: number[]; loop: [number, number]; events: { audit: number; folds: number[]; tile: number; flash: number; fall: number; land: number }; seedAt: [number, number] }
const META = Object.values(import.meta.glob('../art/lastfold.json', { eager: true, import: 'default' }))[0] as StripMeta | undefined;
const STRIP: StripMeta = META ?? { frame: [128, 72], durations: [800, 650, 170, 170, 170, 170, 170, 240, 550, 160, 420, 110, 110, 280, 600, 600], loop: [14, 15], events: { audit: 1, folds: [2, 3, 4, 5, 6, 7], tile: 8, flash: 9, fall: 11, land: 13 }, seedAt: [56, 39] };

/** the confirm's arming; the moment under way (when it started, what it banked, the last frame
 *  whose event has played) */
const st = {
  armedUntil: -1,
  seq: null as null | { t0: number; kernels: number; grade: string; universe: number; item: string | null; last: number; boom: boolean; landed: boolean },
};

/** Start the moment without a fold (the e2e states): `age` seconds into it. */
export function lastFoldDebug(app: App, kernels: number, grade: string, age = 2.4) {
  st.seq = { t0: app.ui.time - age, kernels, grade, universe: (app.game.s.meta.lastFolds ?? 0) + 1, item: 'sandwichEngineer', last: 99, boom: true, landed: age > 4.5 };
  app.panel = 'lastfold';
}

/** The moment is on the screen (the HUD leaves the notebook's tabs off it). A moment whose page
 * was shut (Esc) ends as Skip would. */
export function lastFoldPlaying(app: App): boolean {
  if (st.seq && app.panel !== 'lastfold') finish(app, false);
  return !!st.seq;
}

/** The next letter up and the score it needs, in words. */
function nextUp(letter: string): string {
  const i = GRADES.findIndex((q) => q.letter === letter);
  return i > 0 ? `${GRADES[i - 1].letter} at ${GRADES[i - 1].min.toFixed(2)}` : 'the top grade';
}

const p1 = (v: number) => (v >= 10 ? v.toFixed(0) : v.toFixed(1).replace(/\.0$/, ''));
const GRADE_ROLE: Record<string, Role> = { 'S+': 'coin', S: 'coin', A: 'good', B: 'research', C: 'warn', D: 'bad' };
const meterRole = (v: number): Role => (v >= 0.9 ? 'good' : v >= 0.6 ? 'warn' : 'bad');

// ------------------------------------------------------------------ the card

function lastFoldCard(app: App, r0: Rect) {
  if (st.seq) return sequence(app);
  const ui = app.ui;
  const g = app.game;
  const a = g.s.haudit;
  // no graded whole-World audit (cancelled, or a save from before): nothing to show
  if (!a?.last || !a.result) { app.panel = null; return; }
  const r = bookArea(r0);
  const p = previewKernels(g);
  const why = lastFoldRefusal(g);
  const armed = ui.time < st.armedUntil && !why;
  const { body, detail } = menuTemplate(app, r, { title: 'The Last Fold', accent: C.violet, icon: 'lastFold' as IconName, detail: Math.max(150, Math.min(196, Math.floor(r.w * 0.36))) });
  // ---- the Inspector, and the way to the Kernel tree
  const kb = layoutRich('{u:kernel} Kernel tree').w + 14;
  if (button(ui, 'toKernels', body.x + body.w - kb, body.y - 1, kb, 15, '{u:kernel} Kernel tree', { tip: [{ text: '{u:kernel} {big:The Kernel tree}' }, { text: 'what Kernels buy: the next universe\'s rules' }] })) app.panel = 'kernels';
  const line = why ? `Not yet. ${why.split(':')[0]}.` : armed ? 'Sure? Every floor folds into one tile. Click again.' : `The whole World, graded ${p.grade}. Fold it, and the next universe starts from the Seed.`;
  let y = body.y + 16;
  y += speak(app, 'inspector', line, body.x, y, body.w, { size: 24 }) + 4;
  // ---- the contract: what it banks, keeps and loses
  const foot = 24;
  const sheetR = { x: body.x + 2, y, w: body.w - 4, h: body.y + body.h - foot - y };
  ui.panel(sheetR.x, sheetR.y, sheetR.w, sheetR.h, 'paper', true);
  const ix = sheetR.x + 6, iy = sheetR.y + 5, iw = sheetR.w - 12, ih = sheetR.h - 9;
  const gw = Math.floor((iw - 8) * 0.55);
  bankColumn(app, p, { x: ix, y: iy, w: gw, h: ih });
  const kx = ix + gw + 8;
  ui.ctx.fillStyle = T.paperEdge;
  ui.ctx.fillRect(kx - 4, iy, 1, ih);
  keepLoseColumn(app, { x: kx, y: iy, w: iw - gw - 8, h: ih });
  // ---- the two keys: keep the World (cancel the audit), or fold it
  const fy = body.y + body.h - foot + 6;
  const label = why ? 'Not yet' : armed ? 'Sure? Fold it' : 'Fold the World';
  const bw = Math.max(110, bigWidth(label) + 34);
  const bx = body.x + body.w - bw - 2;
  const kw = richWidth('Keep the World') + 16;
  if (button(ui, 'lastFoldKeep', body.x + 2, fy - 4, kw, 17, 'Keep the World', { tip: [{ text: '{big:Keep the World}' }, { text: 'the audit is cancelled · the World keeps running' }, { text: '{soft:audit it again whenever you like}' }] })) {
    app.act({ k: 'hauditCancel' });
    app.panel = null;
    st.armedUntil = -1;
  }
  const tip = why ? [{ text: `{bad:${why}}` }] : armed ? [{ text: '{u:lastFold} click again · the World folds' }] : [{ text: '{u:lastFold} two clicks · the first arms it' }, { text: `{coin:+${p.now} Kernels} banked · a new universe from the Seed` }];
  if (button(ui, 'lastFoldGo', bx, fy - 6, bw, 20, label, { icon: 'lastFold', disabled: !!why, gold: !why, big: true, pulse: armed, tip })) {
    if (!armed) st.armedUntil = ui.time + 4;
    else {
      st.armedUntil = -1;
      const grade = p.grade ?? 'D';
      const kernels = p.now;
      const top = p.lines.filter((l) => l.counted).sort((q, w) => w.value - q.value)[0];
      if (app.act({ k: 'lastFold' }).ok) afterLastFold(app, kernels, grade, top?.item ?? null);
    }
  }
  // ---- the right page: the Seed, Kept Legacy, the World as counted
  if (detail) seedPage(app, p, detail);
}

/** The left column: the grade stamped, U, W and C, the Kernels term by term, what would raise it. */
function bankColumn(app: App, p: KernelPreview, c: Rect) {
  const ui = app.ui;
  const g = app.game;
  const a = g.s.haudit!;
  const res = a.result!;
  const bottom = c.y + c.h;
  let y = c.y;
  heading(ui, 'You bank', c.x, y, c.w, 'coin');
  ui.text('Kernels', c.x + c.w, y + 2, T.coin, { align: 'right' });
  ui.big(`+${p.now}`, c.x + c.w - textWidth('Kernels') - 4, y, T.coin, { align: 'right' });
  y += BIG_H + 5;
  // the grade: the Inspector's stamp slammed down, then U, W, C beside it
  const t = ui.time - app.gradeAt;
  const letter = res.grade.letter;
  const sc = slamScale(t);
  if (t >= 0.28 && !app.hud.stamped) { app.hud.stamped = true; app.audio.sfx('stamp'); app.renderer.fx.kick(2); }
  drawStamp(ui.ctx, gradeStamp(letter, false), c.x + 16, y + 16, sc, -0.1);
  ui.hint(c.x, y, 32, 32, [{ text: `{big:Graded ${letter}}` }, { text: `score ${res.grade.score.toFixed(2)} · ${nextUp(letter)}` }, { text: `{u:kernel} +${p.gradeBonus} for the grade (S+ ${KERNEL_GRADE.bonus['S+']} … D 0)` }], 210);
  const mx = c.x + 38, mw = Math.max(30, c.w - 38 - 52);
  const parts: [string, string, number, number][] = [['U', 'busy', res.grade.u, SCORE_WEIGHTS.u], ['W', 'waste', res.grade.w, SCORE_WEIGHTS.w], ['C', 'filled', res.grade.c, SCORE_WEIGHTS.c]];
  parts.forEach(([l, word, v, wt], i) => {
    const yy = y + 2 + i * 10;
    ui.small(l, mx, yy + 1, T.inkSoft);
    meter(ui, mx + 7, yy, mw, 6, v, { role: meterRole(v), glint: false });
    ui.small(`${Math.round(v * 100)}%`, mx + 7 + mw + 4, yy + 1, T.ink);
    ui.hint(mx, yy - 1, mw + 40, 9, [{ text: `{big:${l} ${word}}` }, { text: l === 'C' ? `modules over the World's free tiles · weight ×${wt}` : `weight ×${wt}` }], 200);
  });
  y += 34;
  const row = (left: string, right: string, tip?: string): boolean => {
    const rw = richWidth(right);
    const L = layoutRich(left);
    if (L.w > c.w - rw - 6 || y + ROW_H > bottom) return false;
    drawLayout(ui, L, c.x, y + 2, T.ink);
    drawLayout(ui, layoutRich(right), c.x + c.w, y + 2, T.ink, { align: 'right' });
    if (tip) ui.hint(c.x, y, c.w, ROW_H, tip, 220);
    y += ROW_H;
    return true;
  };
  const per = RULES.kernelPerValue.value;
  const valTip = `the filing value (steps × grade × tier) of every module at work: ${p.counted} of ${p.lines.length} · ÷${per}`;
  if (!row(`{u:fold} value ${p1(p.value)} {soft:÷${per}}`, `{coinc:+${p1(p.valueTerm)}}`, valTip)) row(`{u:fold} ${p1(p.value)}`, `{coinc:+${p1(p.valueTerm)}}`, valTip);
  if (!row(`{u:star} graded {big:${letter}}`, `{coinc:+${p.gradeBonus}}`, 'one Kernel a letter from D: a grade, not a multiplier')) row(`{u:star} ${letter}`, `{coinc:+${p.gradeBonus}}`);
  if (y + 3 + ROW_H <= bottom) {
    rule(ui, c.x, y + 1, c.w, true);
    y += 3;
    if (!row('{big:Total} {soft:rounded down}', `{coinc:${p1(p.total)}} → {big:${p.now}}`)) row('{big:Total}', `{big:${p.now}}`);
  }
  // what would raise it (the sim's goals, biggest first)
  const goals = p.goals.filter((q) => q.kind !== 'audit');
  if (goals.length && y + ROW_H * 2 <= bottom) {
    y += 2;
    chip(ui, c.x, y, 'raises it', { role: 'coin', solid: true });
    y += ROW_H;
    for (const q of goals.slice(0, 3)) {
      const i = q.text.indexOf(':');
      const s = `{soft:${ICON.right}} ${i > 0 ? q.text.slice(0, i) : q.text}`;
      const gain = `{coinc:+${p1(q.gain)}}`;
      const L = layoutRich(s, c.w - richWidth(gain) - 6);
      if (y + L.h + 2 > bottom) break;
      drawLayout(ui, L, c.x, y + 2, T.ink);
      drawLayout(ui, layoutRich(gain), c.x + c.w, y + 2, T.ink, { align: 'right' });
      ui.hint(c.x, y, c.w, L.h + 2, q.text, 220);
      y += Math.max(ROW_H, L.h + 3);
    }
  }
}

/** Kept and lost in short (the sim's rows are the tips). */
const KEPT_SHORT = ['{u:kernel} Kernels and their tree', '{u:mega} every Megaproject', '{u:heart} reputation, Codex, trophies', '{u:blueprint} the Patent Drawer', '{u:trophies} Challenges, stats, the Ledger', '{u:world} records, Legacy (by Kernel)'];
const KEPT_TINY = ['{u:kernel} Kernels, tree', '{u:mega} Megaprojects', '{u:heart} rep, Codex', '{u:blueprint} the Drawer', '{u:trophies} stats, Ledger', '{u:world} by Kernel'];
const LOST_SHORT = ['every floor, coin, research', 'Patents and their tree', 'Legacy and its tree', "the islands' records"];
const LOST_TINY = ['floors, coin, research', 'Patents, tree', 'Legacy, tree', 'records'];
const LOST_FULL = [LASTFOLD_LOST[0], 'Patents (unspent and the Patent tree) and the record on file', LASTFOLD_LOST[1], LASTFOLD_LOST[2]];
const oneLine = (w: number, ...ss: string[]) => ss.find((s) => richWidth(s) <= w) ?? ss[ss.length - 1];

/** The right column: what the fold keeps (ticked) and loses (struck in red ink). */
function keepLoseColumn(app: App, c: Rect) {
  const ui = app.ui;
  const g = app.game;
  let y = c.y;
  const bottom = c.y + c.h;
  heading(ui, 'You keep', c.x, y, c.w, 'good');
  y += BIG_H + 4;
  const kr = krules(g);
  LASTFOLD_KEPT.forEach((k, i) => {
    // the last row (the worlds' records, chosen Legacy) only with the Kernel nodes that keep them
    if (i === LASTFOLD_KEPT.length - 1 && !kr.keptIslands && !kr.legacySlots) return;
    const L = layoutRich(oneLine(c.w - 10, KEPT_SHORT[i] ?? k.what, KEPT_TINY[i] ?? k.what), c.w - 10);
    if (y + L.h > bottom) return;
    ui.text(ICON.check, c.x, y, T.good);
    drawLayout(ui, L, c.x + 9, y, T.ink);
    ui.hint(c.x, y - 1, c.w, L.h + 2, [{ text: `{good:${ICON.check}} {big:${k.what}}` }, { text: k.why, color: T.inkSoft }], 210);
    y += L.h + 1;
  });
  y += 3;
  if (y + BIG_H + 8 > bottom) return;
  heading(ui, 'You lose', c.x, y, c.w, 'bad');
  y += BIG_H + 4;
  LOST_SHORT.forEach((short, i) => {
    // with Kept Islands the records stay; with Kept Legacy the chosen nodes do (their own rows)
    if (i === 3 && kr.keptIslands) return;
    const s = oneLine(c.w - 10, short, LOST_TINY[i]);
    const h = layoutRich(s, c.w - 10).h;
    if (y + h > bottom) return;
    ui.text(ICON.cross, c.x, y, T.bad);
    struck(ui, s, c.x + 9, y, c.w - 10);
    ui.hint(c.x, y - 1, c.w, h + 2, [{ text: `{bad:${ICON.cross}} {big:Lost}` }, { text: LOST_FULL[i], color: T.inkSoft }], 220);
    y += h + 1;
  });
}

/** The right page: the Seed the World becomes, Kept Legacy's picks, the World's modules counted. */
function seedPage(app: App, p: KernelPreview, page: Rect) {
  const ui = app.ui;
  const g = app.game;
  const x = page.x + 4, pw = page.w - 8;
  const end = page.y + page.h;
  let y = page.y + 2;
  // the Seed, at 2x on a little plot of paving, humming
  ui.fill(x - 1, y - 1, 34, 34, T.ink);
  ui.fill(x, y, 32, 32, C.pave2);
  if (hasArt('seed')) { const s = sheet('seed'); ui.ctx.drawImage(s.frames[Math.floor(ui.time * (s.fps || 4)) % s.frames.length], x, y, 32, 32); }
  ui.big('The Seed', x + 38, y + 1, T.ink);
  drawRich(ui, `{soft:planted on} ${WORLDS.home.name.replace(/^the /, '')} {soft:at 4,6}`, x + 38, y + BIG_H + 3, pw - 38, T.ink);
  y += 36;
  y += drawRich(ui, `{i:ironOre} {i:copperOre} {i:coal} {i:sand} one out of each side every ${krules(g).seedSeconds} s · {k:R} turns it`, x, y, pw, T.ink) + 4;
  // Kept Legacy: which Legacy nodes go through
  const slots = krules(g).legacySlots;
  if (slots && y + 30 <= end) {
    const kept = new Set(g.s.meta.keptLegacy ?? []);
    const owned = (g.s.meta.legacyNodes ?? []).filter((n) => LEGACY[n as LegacyId]) as LegacyId[];
    ui.small(`KEEP LEGACY ${kept.size}/${slots}`, x, y, kept.size >= slots ? T.good : T.inkSoft);
    y += 9;
    if (!owned.length) { y += drawRich(ui, '{soft:no Legacy nodes this universe}', x, y, pw, T.inkSoft) + 3; }
    const half = Math.floor((pw - 3) / 2);
    let i = 0;
    for (const id of owned) {
      const cx = x + (i % 2) * (half + 3), cy = y + Math.floor(i / 2) * 12;
      if (cy + 11 > end - 30) { drawRich(ui, `{soft:+${owned.length - i} more}`, x, cy, pw, T.inkSoft); y = cy + 10; i = -1; break; }
      const on = kept.has(id);
      const full = LEGACY[id].name.replace(/^The /, '').toUpperCase();
      const lab = `${on ? ICON.check + ' ' : ''}${smallWidth(full) + (on ? 10 : 0) <= half - 6 ? full : legacyShort(id).toUpperCase()}`;
      if (button(ui, 'keepLegacy_' + id, cx, cy, half, 11, '', { active: on, disabled: !on && kept.size >= slots, tip: [{ text: `{big:${LEGACY[id].name}}` }, { text: on ? '{good:kept through the Last Fold} · {k:LMB} let go' : kept.size >= slots ? `{soft:Kept Legacy keeps ${slots}: let one go first}` : '{k:LMB} keep it through the Last Fold' }] })) app.act({ k: 'keepLegacy', id });
      ui.clip(cx + 2, cy, half - 4, 11);
      ui.small(lab, cx + 3, cy + 3, on ? T.good : T.ink);
      ui.unclip();
      i++;
    }
    if (i >= 0) y += Math.ceil(owned.length / 2) * 12 + 3;
  }
  // the World as the Last Fold counts it: each module's value, ticked when it is counted
  if (y + 20 > end) return;
  rule(ui, x, y, pw, true);
  y += 3;
  ui.small(`THE WORLD ${p.counted}/${p.lines.length} AT WORK`, x, y, T.inkSoft);
  y += 9;
  const lines = p.lines.slice().sort((q, w) => Number(w.counted) - Number(q.counted) || w.value - q.value);
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (y + 10 > end) { break; }
    if (y + 20 > end && i < lines.length - 1) { drawRich(ui, `{soft:+${lines.length - i} more}`, x, y, pw, T.inkSoft); break; }
    const v = p1(l.value);
    ui.clip(x, y, pw - textWidth(v) - 4, 10);
    drawRich(ui, `${l.counted ? `{good:${ICON.check}}` : `{bad:${ICON.cross}}`} ${l.item && l.item in ITEMS ? `{i:${l.item}}` : ''} ${l.name}`, x, y, Infinity, l.counted ? T.ink : T.inkSoft);
    ui.unclip();
    ui.text(v, x + pw, y, l.counted ? T.ink : T.inkSoft, { align: 'right' });
    ui.hint(x, y, pw, 10, [{ text: `{big:${l.name}}` }, { text: `{u:${l.floor === 'beyond' ? 'beyond' : 'world'}} value ${p1(l.value)} · busy ${Math.round(l.busy * 100)}%` }, { text: l.counted ? '{good:counted}' : `{bad:not counted} · ${l.floor === 'beyond' ? 'run it 60 s' : 'half speed or better in the audit'}` }], 210);
    y += 10;
  }
}

// ------------------------------------------------------------------ the moment

/** The app's side of the Last Fold: nothing of the old universe stays selected or open, the new
 * Workshop is framed under the moment, and the moment starts. */
function afterLastFold(app: App, kernels: number, grade: string, item: string | null) {
  app.selected = null;
  app.fselected = null;
  app.gradeId = null;
  app.mode = { k: 'idle' };
  app.renderer.ground = null;
  app.setFloor('workshop', true);
  app.fitCamera(true);
  st.seq = { t0: app.ui.time, kernels, grade, universe: app.game.s.meta.lastFolds ?? 1, item, last: -1, boom: false, landed: false };
  app.panel = 'lastfold';
  app.save();
}

/** The frame at t seconds into the strip, and whether it is looping (the hold at its end). */
function frameAt(t: number): { f: number; holding: boolean; holdT: number } {
  let ms = t * 1000;
  for (let i = 0; i < STRIP.durations.length; i++) {
    if (ms < STRIP.durations[i] && i < STRIP.loop[0]) return { f: i, holding: false, holdT: 0 };
    if (i >= STRIP.loop[0]) break;
    ms -= STRIP.durations[i];
  }
  const [a, b] = STRIP.loop;
  const span = STRIP.durations.slice(a, b + 1).reduce((s, d) => s + d, 0);
  const holdT = ms / 1000;
  let m = ms % span;
  for (let i = a; i <= b; i++) { if (m < STRIP.durations[i]) return { f: i, holding: true, holdT }; m -= STRIP.durations[i]; }
  return { f: b, holding: true, holdT };
}

/** How long the hold runs before the cut to the new Workshop on its own. */
const HOLD_S = 3.2;

/** The full-screen moment: the strip at a whole-number cover scale, its events as sounds and shakes,
 * the words over it; a click on Skip (or Onward, in the hold) ends it. */
function sequence(app: App) {
  const ui = app.ui;
  const ctx = ui.ctx;
  const q = st.seq!;
  const t = ui.time - q.t0;
  const { f, holding, holdT } = frameAt(t);
  const done = () => finish(app, true);
  if (holding && holdT >= HOLD_S) return done();
  // the strip's events as they pass
  const E = STRIP.events;
  for (let i = q.last + 1; i <= f; i++) {
    if (i === E.audit) app.audio.sfx('auditTick');
    if (E.folds.includes(i)) { app.audio.sfx('stamp', 0.45, 0.8 + E.folds.indexOf(i) * 0.08); app.renderer.fx.kick(1); }
    if (i === E.tile) app.audio.sfx('foldStart', 0.8, 0.7);
    if (i === E.flash && !q.boom) { q.boom = true; app.audio.resetSound(3); app.renderer.fx.kick(6); }
    if (i === E.fall) app.audio.sfx('click', 0.6, 0.6);
    if (i === E.land && !q.landed) { q.landed = true; app.audio.sfx('stampLand', 0.9); app.audio.sfx('fanfare', 0.6); app.renderer.fx.kick(5); app.hud.confetti = 80; }
  }
  q.last = Math.max(q.last, f);
  // the whole screen: ink, then the strip at the largest whole scale that covers it
  ui.region(0, 0, ui.w, ui.h, 'panel', true);
  ui.mark('lastFoldScene', 0, 0, ui.w, ui.h);
  ctx.fillStyle = C.ink;
  ctx.fillRect(0, 0, ui.w, ui.h);
  const [FW, FH] = STRIP.frame;
  const k = Math.max(1, Math.ceil(Math.max(ui.w / FW, ui.h / FH)));
  const ox = Math.round((ui.w - FW * k) / 2), oy = Math.round((ui.h - FH * k) / 2);
  if (hasArt('lastfold')) {
    const s = sheet('lastfold');
    ctx.drawImage(s.frames[Math.min(f, s.frames.length - 1)], ox, oy, FW * k, FH * k);
  } else {
    // no art: a box folding to a tile, in code
    const a = Math.max(0.05, 1 - t / 3);
    ctx.fillStyle = C.ink2;
    ctx.fillRect(ui.w / 2 - (ui.w * a) / 2, ui.h / 2 - (ui.h * a) / 2, ui.w * a, ui.h * a);
  }
  // the flash: the screen white for a moment
  if (f === E.flash) { ctx.fillStyle = rgba(C.bone, 0.55); ctx.fillRect(0, 0, ui.w, ui.h); }
  // the words: the title while it folds, then the Kernels stamped on the landing
  const title = f < E.flash ? 'THE LAST FOLD' : `UNIVERSE ${q.universe + 1}`;
  ui.big(title, ui.w / 2, 10, C.bone, { align: 'center', scale: 2, outline: C.ink });
  const sub = f < E.tile ? `the whole World, graded ${q.grade}` : f < E.flash ? 'into one tile' : f < E.land ? 'and down' : 'the Seed';
  drawRich(ui, sub, ui.w / 2, 10 + 2 * BIG_H + 6, Math.min(ui.w - 20, 360), C.bone, { align: 'center', shadow: C.ink });
  if (f >= E.land) {
    const lt = t - landAt();
    // in the sky over the new island (the Seed stands at the strip's seedAt, a little under the middle)
    const sy = Math.round(Math.max(84, Math.min(ui.h * 0.32, oy + STRIP.seedAt[1] * k - 46)));
    rays(app, ui.w / 2, sy, Math.min(ui.w, 200), C.lamp2, 14);
    stamp(ui, `+${q.kernels} KERNELS`, ui.w / 2, sy, { scale: Math.max(1, slamScale(lt, ui.w >= 600 ? 2 : 1)), angle: -0.08, col: C.gold });
  }
  const lab = holding ? 'Onward' : 'Skip';
  if (button(ui, 'lastFoldSkip', ui.w - 60, ui.h - 24, 52, 17, lab, { gold: holding, tip: '{u:kernel} the Kernel tree' })) done();
}

/** The moment over: the new universe's Workshop, the Seed marked where the town began, and the
 * Kernel tree open to spend what was banked (`tree`: when the page is still the moment's). */
function finish(app: App, tree: boolean) {
  const q = st.seq;
  if (!q) return;
  st.seq = null;
  if (tree) app.panel = 'kernels';
  app.toast('The Last Fold!', `{u:kernel} {coin:+${q.kernels} Kernels} banked · spend them on the Kernel tree`, C.gold, 'kernel');
  // the Seed lands where the town began: a ring and a burst on it as the Workshop comes back
  const fx = app.renderer.fx;
  const sx = (RULES.seedX.value + 0.5) * 16, sy = (RULES.seedY.value + 0.5) * 16;
  fx.ring(sx, sy, C.gold, 34, 0.9, 4);
  fx.burst(sx, sy, 40, [C.gold, C.lily, C.bone, C.lamp3], 80, 40, 1, 1.1);
  fx.text(sx, sy - 18, 'THE SEED', C.gold, 2, true);
}

/** Seconds into the strip its landing frame starts. */
function landAt(): number {
  return STRIP.durations.slice(0, STRIP.events.land).reduce((s, d) => s + d, 0) / 1000;
}

registerScreen('lastfold', lastFoldCard);

void smallWidth; void chipWidth; void worldOf;
