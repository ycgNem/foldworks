// The Patent Drawer, a page of the ledger (DESIGN.md §19, the Milestone 5-6 review round;
// docs/hud-180.md): the designs kept through every Reorganize as folded paper cards, each with a
// brass band, its product's icon, its grade stamped in red ink, its rate and bill as chips and
// what it can do in this run; below them this run's Workshop designs, each with a Keep button. The
// right page is the selected design in full: its layout drawn big enough to read, its facts as
// ruled rows, its FWD1 share string in a paper field, and Unfold (whole, onto the box it was folded
// from), Queue (for the Draughtsman), Copy and Forget. It replaces the Blueprint Book: no ghosts,
// no drones, no pasted outlines waiting to be built (DECISIONS.md). Presentation only: every change
// is a command (keep, forget, unfoldKept, queueKept, importDesign).
import { C, rgba } from '../data/palette';
import { BUILD } from '../data/machines';
import { RECIPE } from '../data/recipes';
import { ITEMS, type ItemId } from '../data/items';
import { ellipsize, bigWidth } from '../ui/font';
import { itemIcon } from '../render/sprites';
import { keepRefusal, keptBill, keptLand, unfoldKeptRefusal, encodeDesign, drawerSlots } from '../sim/drawer';
import { lrules } from '../sim/legacy';
import { previewPatents, designValue } from '../sim/reorganize';
import { prules } from '../sim/patents';
import { mainItem } from '../sim/systems/modules';
import { Num } from '../engine/num';
import type { DesignPart, KeptDesign, ModuleDesign } from '../sim/world';
import { button, chip, chipWidth, section, rule } from './chrome';
import { menuTemplate, perMin } from './widgets';
import { layoutRich, drawLayout } from '../ui/rich';
import { T } from '../ui/theme';
import type { App } from './app';
import type { Rect } from '../ui/ui';
import { bookArea, heading, kvRow, gradeStamp, speak, ROW_H } from './ledger';
import { committeeFallback } from './reorganize';

/** the row selected (a kept design, or one of this run's designs), the scroll, a two-click Forget */
const st = { sel: null as null | { k: 'kept' | 'run'; id: number }, scroll: 0, armForget: -1, armUntil: 0 };

/** Select a row from outside (the screenshot harness, e2e/screens.mjs). */
export function selectDrawer(sel: { k: 'kept' | 'run'; id: number } | null) {
  st.sel = sel;
}

/** Kind colours for the pictures (belts dim, machines by family). */
function partCol(kind: string): string {
  if (kind === 'belt') return C.hull1;
  if (kind === 'miner') return C.copper1;
  if (kind === 'heap' || kind === 'crate') return C.ground2;
  if (kind === 'splitter' || kind === 'merger') return C.hull2;
  if (kind === 'pole' || kind === 'boiler' || kind === 'steamEngine' || kind === 'generator') return C.teal1;
  return C.gold;
}

/** A layout drawn at k px a tile, as the floor it came from: buildings by family, each crafting
 * machine with its product's icon once the tiles are big enough to read (8 px), belts with a dot
 * pointing their way. */
function picture(app: App, parts: DesignPart[], w: number, h: number, x: number, y: number, k: number, nested?: KeptDesign['nested']) {
  const ui = app.ui;
  ui.fill(x - 1, y - 1, w * k + 2, h * k + 2, C.ink);
  for (let ty = 0; ty < h; ty++) for (let tx = 0; tx < w; tx++) ui.fill(x + tx * k, y + ty * k, k, k, (tx + ty) % 2 ? C.ground1 : C.ground0);
  // a nested design kept by the Group Drawer (DESIGN.md §22): its group's layout, each module tile
  // named by its product, its trunks
  for (const p of nested ?? []) {
    const px = x + p.dx * k, py = y + p.dy * k;
    if (p.kind === 'trunk') { ui.fill(px + 1, py + 1, k - 2, k - 2, C.hull1); continue; }
    ui.fill(px, py, k, k, C.ink);
    ui.fill(px + 1, py + 1, k - 2, k - 2, C.brass1);
    if (p.item && k >= 8) ui.ctx.drawImage(itemIcon(p.item), px + Math.floor((k - 8) / 2), py + Math.floor((k - 8) / 2));
  }
  for (const p of parts) {
    const d = BUILD[p.kind];
    const px = x + p.dx * k, py = y + p.dy * k;
    if (p.kind === 'belt') {
      ui.fill(px + 1, py + 1, k - 2, k - 2, C.hull1);
      if (k >= 6) {
        const c = Math.floor(k / 2) - 1;
        const off = [[k - 3, c], [c, k - 3], [1, c], [c, 1]][p.rot];
        ui.fill(px + off[0], py + off[1], 2, 2, C.bone);
      }
      continue;
    }
    ui.fill(px, py, d.w * k, d.h * k, C.ink);
    ui.fill(px + 1, py + 1, d.w * k - 2, d.h * k - 2, partCol(p.kind));
    const r = p.recipe ? RECIPE[p.recipe] : null;
    if (r && k >= 8) ui.ctx.drawImage(itemIcon(r.outputs[0].item), px + Math.floor((d.w * k - 8) / 2), py + Math.floor((d.h * k - 8) / 2));
  }
}

/** A kept design's state as a chip: ready, unfolded this run, or what it waits for. */
function stateChip(app: App, k: KeptDesign): { text: string; role: 'good' | 'soft' | 'warn'; why: string | null } {
  const g = app.game;
  if ((g.s.drafted ?? []).includes(k.id)) return { text: 'unfolded', role: 'soft', why: null };
  const why = unfoldKeptRefusal(g, k);
  if (!why) return { text: 'ready', role: 'good', why: null };
  const WAITS = { coin: 'needs coin', land: 'needs land', research: 'needs research', room: 'box blocked' } as const;
  return { text: WAITS[why.waits], role: 'warn', why: why.why };
}

export function drawerScreen(app: App, r0: Rect) {
  const ui = app.ui;
  const g = app.game;
  const m = g.s.meta;
  // the Patent tree's slots and the Legacy tree's (A Longer Drawer, DESIGN.md §22)
  const slots = drawerSlots(g);
  const r = bookArea(r0);
  const { body, detail } = menuTemplate(app, r, { title: 'The Patent Drawer', accent: C.violet, icon: 'fold', detail: Math.floor(r.w * 0.4) });
  // ---- the tools: import a string, and who unfolds the queue
  const iw = layoutRich('{u:blueprint} Import a string').w + 14;
  if (button(ui, 'kdImport', body.x, body.y, iw, 15, '{u:blueprint} Import a string', { disabled: m.drawer.length >= slots, tip: [{ text: '{u:blueprint} paste an FWD1 share string' }, { text: 'a design from another save, kept here like your own', color: T.inkSoft }] })) importPrompt(app);
  const draught = prules(g).draughtsmanEvery;
  const note = draught ? `{u:build} the Draughtsman unfolds the queue {chip:reset:${m.queue.length}}` : '{u:fold} a kept design unfolds whole onto its box';
  const NL = layoutRich(note);
  if (body.x + iw + 8 + NL.w <= body.x + body.w) drawLayout(ui, NL, body.x + body.w, body.y + 4, T.inkSoft, { align: 'right' });
  // ---- the kept designs
  let y = body.y + 20;
  // the Group Drawer (a Legacy node) keeps nested Factory designs too
  const nested = lrules(g).groupDrawer;
  const runDesigns = g.s.designs.filter((d) => (!d.fparts || (nested && d.fparts.length > 0 && (d.depth ?? 1) < 3)) && !m.drawer.some((k) => k.src === d.id));
  const runH = runDesigns.length ? Math.min(Math.floor(body.h * 0.36), 18 + Math.ceil(runDesigns.length / 2) * 17) : 0;
  const keptEnd = body.y + body.h - (runH ? runH + 4 : 0);
  heading(ui, 'Kept', body.x, y, body.w, 'reset', `{soft:${m.drawer.length} of ${slots} slots}`);
  y += 16;
  if (!m.drawer.length) {
    // the Committee explains it in their own words
    speak(app, 'committee', '"keep a good one." "it outlives us." "everything does."', body.x, y, Math.min(body.w, 280), { size: 24, fallback: committeeFallback });
    drawLayout(ui, layoutRich('{u:fold} fold → {u:blueprint} keep → {u:reset} reset → {u:fold} unfold whole', body.w), body.x, y + 32, T.inkSoft);
  } else {
    const rowH = 32;
    const per = Math.max(1, Math.floor((keptEnd - y) / rowH));
    st.scroll = Math.max(0, Math.min(st.scroll, m.drawer.length - per));
    if (ui.hover(body.x, y, body.w, keptEnd - y) && app.input.mouse.wheel) st.scroll = Math.max(0, Math.min(m.drawer.length - per, st.scroll + Math.sign(app.input.mouse.wheel)));
    m.drawer.slice(st.scroll, st.scroll + per).forEach((k, i) => keptCard(app, k, body.x, y + i * rowH, body.w, rowH - 4));
    if (m.drawer.length > per) drawLayout(ui, layoutRich(`{k:WHEEL} ${st.scroll + 1}-${Math.min(m.drawer.length, st.scroll + per)} of ${m.drawer.length}`), body.x + body.w, keptEnd - 10, T.inkSoft, { align: 'right' });
  }
  // ---- this run's designs, to keep
  if (runH) {
    const ry = body.y + body.h - runH;
    heading(ui, 'Folded this run', body.x, ry, body.w, 'coin', '{soft:keep the good ones}');
    const cw = Math.floor((body.w - 6) / 2);
    const rows = Math.max(0, Math.floor((runH - 16) / 17));
    runDesigns.slice(0, rows * 2).forEach((d, i) => runRow(app, d, body.x + (i % 2) * (cw + 6), ry + 16 + Math.floor(i / 2) * 17, cw, 15));
  }
  // ---- the right page
  if (!detail) return;
  const sel = st.sel;
  const kd = sel?.k === 'kept' ? m.drawer.find((k) => k.id === sel.id) : undefined;
  const rd = sel?.k === 'run' ? g.design(sel.id) : undefined;
  if (kd) keptDetail(app, kd, detail);
  else if (rd) runDetail(app, rd, detail);
  else {
    heading(ui, 'Pick a design', detail.x, detail.y, detail.w, 'reset');
    drawLayout(ui, layoutRich('{k:LMB} a kept design · see it, unfold it', detail.w), detail.x, detail.y + 18, T.ink);
    drawLayout(ui, layoutRich("{k:LMB} one of this run's · keep it", detail.w), detail.x, detail.y + 32, T.ink);
  }
}

/** A kept design as a folded paper card: a brass band down its left edge, its picture, the
 * product's icon and name, its grade stamped, its facts as chips, a turned-down corner. */
function keptCard(app: App, k: KeptDesign, x: number, y: number, w: number, h: number) {
  const ui = app.ui;
  const g = app.game;
  const on = st.sel?.k === 'kept' && st.sel.id === k.id;
  const hov = ui.hover(x, y, w, h);
  ui.panel(x, y, w, h, 'paper', false, { hover: hov || on });
  ui.region(x, y, w, h, 'button', false);
  const ctx = ui.ctx;
  // the brass band, and the corner folded down
  ctx.fillStyle = C.ink;
  ctx.fillRect(x + 3, y + 1, 5, h - 2);
  ctx.fillStyle = T.brass;
  ctx.fillRect(x + 4, y + 1, 3, h - 2);
  ctx.fillStyle = T.brassHi;
  ctx.fillRect(x + 4, y + 1, 1, h - 2);
  for (let i = 0; i < 6; i++) {
    ctx.fillStyle = T.paperLo;
    ctx.fillRect(x + w - 7 + i, y + 1 + i, 6 - i, 1);
    ctx.fillStyle = T.paperEdge;
    ctx.fillRect(x + w - 7 + i, y + 1 + i, 1, 1);
  }
  if (on) { ctx.fillStyle = rgba(T.reset, 0.9); ctx.fillRect(x + 10, y + h - 3, w - 20, 1); }
  // the picture, small
  const t = Math.max(1, Math.min(3, Math.floor((h - 6) / Math.max(k.w, k.h))));
  picture(app, k.parts, k.w, k.h, x + 12, y + 3 + Math.floor((h - 6 - k.h * t) / 2), t, k.nested);
  const tx = x + 16 + Math.max(20, k.w * t);
  if (k.product) ctx.drawImage(itemIcon(k.product), tx, y + 4);
  const queued = g.s.meta.queue.indexOf(k.id);
  // the grade, stamped at the right; the facts as chips on the second line
  const gx = x + w - 20;
  const nameRoom = gx - 14 - (tx + 11) - (queued >= 0 ? chipWidth(`#${queued + 1}`) + 4 : 0);
  const name = bigWidth(k.name) <= nameRoom ? `{big:${k.name}}` : ellipsize(k.name, nameRoom);
  drawLayout(ui, layoutRich(name), tx + 11, y + 3, T.ink);
  if (queued >= 0) chip(ui, gx - 14 - chipWidth(`#${queued + 1}`), y + 2, `#${queued + 1}`, { role: 'reset', solid: true });
  if (k.grade) gradeStamp(ui, k.grade, gx, y + Math.floor(h / 2));
  else drawLayout(ui, layoutRich('{soft:FWD1}'), gx + 8, y + Math.floor(h / 2) - 4, T.inkSoft, { align: 'right' });
  const sc = stateChip(app, k);
  const facts = [
    ...(k.rate ? [{ text: `${perMin(k.rate)}/min`, role: 'ink' as const }] : []),
    { text: `{coin:${Num.of(keptBill(k)).format()}}`, role: 'coin' as const },
    { text: sc.text, role: sc.role },
  ];
  let cx = tx;
  for (const f of facts) {
    const cw = chipWidth(f.text);
    if (cx + cw > gx - 14) break;
    chip(ui, cx, y + h - 14, f.text, { role: f.role });
    cx += cw + 3;
  }
  if (hov) ui.tip([{ text: `{big:${k.name}}` }, ...(sc.why ? [{ text: `{warn:${sc.why}}` }] : []), { text: '{k:LMB} open it on the right page', color: T.inkSoft }], 200);
  if (hov && ui.clicked) { ui.eat(); st.sel = { k: 'kept', id: k.id }; ui.sfx('click'); }
}

function runRow(app: App, d: ModuleDesign, x: number, y: number, w: number, h: number) {
  const ui = app.ui;
  const g = app.game;
  const it = mainItem(d);
  const on = st.sel?.k === 'run' && st.sel.id === d.id;
  ui.region(x, y, w - 44, h, 'button', false);
  if (on || ui.hover(x, y, w - 44, h)) section(ui, x, y, w - 42, h);
  if (it) ui.ctx.drawImage(itemIcon(it), x + 2, y + 4);
  const label = `${d.name} {soft:${d.grade.letter}}`;
  const room = w - 59; // inside the row's region (w - 44 from x, the label starting at x + 13)
  drawLayout(ui, layoutRich(layoutRich(label).w <= room ? label : ellipsize(d.name, room - 14) + ` {soft:${d.grade.letter}}`), x + 13, y + 4, T.ink);
  if (on) rule(ui, x + 13, y + h - 1, w - 58, true);
  const why = keepRefusal(g, d.id);
  if (button(ui, `keep${d.id}`, x + w - 40, y, 40, h, 'Keep', { disabled: !!why, tip: why ? `{warn:${why}}` : '{u:blueprint} into the Patent Drawer · it survives every Reorganize' })) app.act({ k: 'keep', id: d.id });
  if (ui.hover(x, y, w - 44, h) && ui.clicked) { ui.eat(); st.sel = { k: 'run', id: d.id }; ui.sfx('click'); }
}

/** One kept design in full: its picture big enough to read, its facts as rows, its share string,
 * and the four things it can do. */
function keptDetail(app: App, k: KeptDesign, r: Rect) {
  const ui = app.ui;
  const g = app.game;
  let y = r.y;
  const nameRoom = r.w - (k.grade ? 30 : 0);
  const NL = layoutRich(`{big:${k.name}}`, nameRoom);
  drawLayout(ui, NL, r.x, y, T.ink);
  if (k.grade) gradeStamp(ui, k.grade, r.x + r.w - 13, y + 8, { scale: 1 });
  y += NL.h + 3;
  const t = Math.max(3, Math.min(10, Math.floor(Math.min(r.w - 4, 90) / Math.max(k.w, k.h))));
  const ph = Math.min(k.h * t, 60);
  const tt = Math.max(2, Math.min(t, Math.floor(ph / k.h)));
  picture(app, k.parts, k.w, k.h, r.x + Math.floor((r.w - k.w * tt) / 2), y + 1, tt, k.nested);
  y += k.h * tt + 6;
  const foot = r.y + r.h - 54;
  const row = (a: string, b: string) => { if (y + ROW_H <= foot) y += kvRow(ui, r.x, y, r.w, a, b); };
  if (k.product) row(`{i:${k.product}} makes`, `${ITEMS[k.product as ItemId].name}${k.rate ? ` · ${perMin(k.rate)}/min` : ''}`);
  row('{u:fold} graded', k.grade ? `${k.grade} · run ${k.run}` : '{soft:imported}');
  row('{u:claim} box', `${k.w}x${k.h} at ${k.x},${k.y} · land ${keptLand(k).join(' ')}`);
  const machines = k.parts.filter((p) => p.kind !== 'belt');
  row('{u:coin} bill', `{coin:${Num.of(keptBill(k)).format()}} · ${machines.length} {u:build} ${k.parts.length - machines.length} belts`);
  const filed = k.product ? g.s.meta.patented?.[k.product] : undefined;
  if (filed) row('{u:reset} on file', `{reset:${filed.grade} · ${filed.steps} step${filed.steps === 1 ? '' : 's'} · tier ${filed.tier}}`);
  // what it can do in this run
  const sc = stateChip(app, k);
  const drafted = (g.s.drafted ?? []).includes(k.id);
  if (y + ROW_H <= foot + 14) {
    const cw = chip(ui, r.x, y + 1, sc.text, { role: sc.role, solid: sc.role === 'good' });
    const said = drafted ? '{soft:audit it, fold it again, file it better}' : sc.why ? `{warn:${sc.why}}` : '{soft:one click lays every machine and belt}';
    const L = layoutRich(said, r.w - cw - 4);
    if (y + L.h + 2 <= foot + 14) drawLayout(ui, L, r.x + cw + 4, y + 3, T.ink);
    y += Math.max(ROW_H, L.h + 4);
  }
  // the share string in a paper field, Copy beside it
  const by = r.y + r.h - 50;
  const code = encodeDesign(k);
  const fw = r.w - 46;
  section(ui, r.x, by, fw, 15);
  ui.text(ellipsize(code, fw - 8), r.x + 4, by + 4, T.inkSoft);
  if (button(ui, 'kdCopy', r.x + fw + 4, by, 42, 15, 'Copy', { tip: [{ text: '{u:blueprint} copy its FWD1 share string' }, { text: `${code.length} characters`, color: T.inkSoft }] })) copyString(app, k);
  // Unfold and Queue, then Forget
  const bw = Math.floor((r.w - 4) / 2);
  const why = unfoldKeptRefusal(g, k);
  if (button(ui, 'kdUnfold', r.x, by + 18, bw, 16, 'Unfold', { gold: !why, disabled: !!why, tip: why ? `{warn:${why.why}}` : `{u:fold} onto ${k.x},${k.y} · {coin:${Num.of(keptBill(k)).format()}}` })) {
    if (app.act({ k: 'unfoldKept', id: k.id }).ok) {
      app.panel = null;
      app.setFloor('workshop', true);
      app.lookAt(k.x + k.w / 2, k.y + k.h / 2);
    }
  }
  const draught = prules(g).draughtsmanEvery > 0;
  const q = g.s.meta.queue.includes(k.id);
  if (button(ui, 'kdQueue', r.x + bw + 4, by + 18, bw, 16, q ? 'Unqueue' : 'Queue', { disabled: !draught, active: q, tip: draught ? (q ? '{u:build} out of the Draughtsman\'s queue' : '{u:build} the Draughtsman unfolds it every run · in queue order · as land, research and coin allow') : '{u:lock} needs the Draughtsman · a Patent' })) app.act({ k: 'queueKept', id: k.id });
  const armed = st.armForget === k.id && ui.time < st.armUntil;
  if (button(ui, 'kdForget', r.x, by + 36, r.w, 14, armed ? 'Sure? Forget it' : 'Forget', { gold: armed, tip: armed ? '{bad:click again} · gone for good' : '{u:remove} two clicks · its slot frees up' })) {
    if (armed) { app.act({ k: 'forget', id: k.id }); st.armForget = -1; st.sel = null; }
    else { st.armForget = k.id; st.armUntil = ui.time + 3; }
  }
}

/** One of this run's designs: what it would file, and Keep. */
function runDetail(app: App, d: ModuleDesign, r: Rect) {
  const ui = app.ui;
  const g = app.game;
  let y = r.y;
  const NL = layoutRich(`{big:${d.name}}`, r.w - 30);
  drawLayout(ui, NL, r.x, y, T.ink);
  gradeStamp(ui, d.grade.letter, r.x + r.w - 13, y + 8);
  y += NL.h + 3;
  const t = Math.max(3, Math.min(10, Math.floor(Math.min(r.w - 4, 90) / Math.max(d.box.w, d.box.h))));
  const parts = d.parts.map((p) => ({ kind: p.kind as DesignPart['kind'], dx: p.dx, dy: p.dy, rot: p.rot, recipe: p.recipe }));
  picture(app, parts, d.box.w, d.box.h, r.x + Math.floor((r.w - d.box.w * t) / 2), y + 1, t);
  y += d.box.h * t + 6;
  const v = designValue(d);
  const line = previewPatents(g).lines.find((l) => l.item === v?.item);
  if (v) {
    y += kvRow(ui, r.x, y, r.w, `{i:${v.item}} ${ITEMS[v.item].name}`, `${perMin(v.rate)}/min`);
    y += kvRow(ui, r.x, y, r.w, '{u:fold} value', `${v.steps} step${v.steps === 1 ? '' : 's'} × ${v.grade} × tier ${v.tier}`);
    if (line) {
      const files = line.status === 'filed' ? '{soft:on file · files nothing more}' : `{reset:+${line.patents.toFixed(1)}} ${line.status === 'improved' ? '{chip:research:better}' : '{chip:good:new}'}`;
      y += kvRow(ui, r.x, y, r.w, '{u:reset} files', files);
    }
  }
  const why = keepRefusal(g, d.id);
  if (why) {
    const L = layoutRich(`{warn:${why}}`, r.w);
    if (y + L.h < r.y + r.h - 20) drawLayout(ui, L, r.x, y + 2, T.warn);
  }
  if (button(ui, 'rdKeep', r.x, r.y + r.h - 17, r.w, 17, '{u:blueprint} Keep in the Drawer', { gold: !why, disabled: !!why, tip: why ? `{warn:${why}}` : '{u:reset} it survives every Reorganize · unfold it whole in a later run' })) {
    if (app.act({ k: 'keep', id: d.id }).ok) {
      const k = g.s.meta.drawer[g.s.meta.drawer.length - 1];
      if (k) st.sel = { k: 'kept', id: k.id };
    }
  }
}

function copyString(app: App, k: KeptDesign) {
  const s = encodeDesign(k);
  const done = () => app.toast('Design string copied', `{u:blueprint} ${k.name} · ${s.length} characters`, C.violet);
  if (navigator.clipboard) navigator.clipboard.writeText(s).then(done, () => window.prompt('Copy this design string', s));
  else window.prompt('Copy this design string', s);
}

function importPrompt(app: App) {
  const s = window.prompt('Paste a Foldworks design string, FWD1...');
  if (!s) return;
  if (app.act({ k: 'importDesign', code: s.trim() }).ok) app.toast('Design imported', '{u:blueprint} in the Drawer · unfold it onto its box', C.violet);
}

