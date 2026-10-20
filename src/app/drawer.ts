// The Patent Drawer on screen (DESIGN.md §19, the Milestone 5-6 review round): the designs kept
// through every Reorganize, each with its product, grade, rate and bill and a readable picture of
// its layout, and what it can do now: Unfold (whole, onto the box it was folded from), Queue (for
// the Draughtsman), Copy its share string, Forget. Below them, this run's Workshop designs, each
// with a Keep button. Built on menuTemplate with a detail panel (src/app/widgets.ts). It replaces
// the Blueprint Book: no ghosts, no drones, no pasted outlines waiting to be built (DECISIONS.md).
// Presentation only: every change is a command (keep, forget, unfoldKept, queueKept, importDesign).
import { C } from '../data/palette';
import { BUILD } from '../data/machines';
import { RECIPE } from '../data/recipes';
import { ITEMS, type ItemId } from '../data/items';
import { ICON, textWidth, ellipsize } from '../ui/font';
import { itemIcon } from '../render/sprites';
import { keepRefusal, keptBill, keptLand, keptState, unfoldKeptRefusal, encodeDesign } from '../sim/drawer';
import { previewPatents, designValue } from '../sim/reorganize';
import { prules } from '../sim/patents';
import { mainItem } from '../sim/systems/modules';
import { Num } from '../engine/num';
import type { DesignPart, KeptDesign, ModuleDesign } from '../sim/world';
import { card, button, frame } from './chrome';
import { menuTemplate, perMin } from './widgets';
import type { App } from './app';
import type { Rect } from '../ui/ui';

/** the row selected (a kept design, or one of this run's designs), the scroll, a two-click Forget */
const st = { sel: null as null | { k: 'kept' | 'run'; id: number }, scroll: 0, armForget: -1, armUntil: 0 };

/** Kind colours for the pictures (belts dim, machines by family). */
function partCol(kind: string): string {
  if (kind === 'belt') return C.hull1;
  if (kind === 'miner') return C.copper1;
  if (kind === 'heap' || kind === 'crate') return C.ground2;
  if (kind === 'splitter' || kind === 'merger') return C.hull2;
  if (kind === 'pole' || kind === 'boiler' || kind === 'steamEngine' || kind === 'generator') return C.teal1;
  return C.gold;
}

/** A layout drawn at k px a tile: buildings by family, each crafting machine with its product's
 * icon once the tiles are big enough to read (8 px), belts with a dot pointing their way. */
function picture(app: App, parts: DesignPart[], w: number, h: number, x: number, y: number, k: number) {
  const ui = app.ui;
  ui.fill(x - 1, y - 1, w * k + 2, h * k + 2, C.ink);
  for (let ty = 0; ty < h; ty++) for (let tx = 0; tx < w; tx++) ui.fill(x + tx * k, y + ty * k, k, k, (tx + ty) % 2 ? C.ground1 : C.ground0);
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

export function drawerScreen(app: App, r: Rect) {
  const ui = app.ui;
  const g = app.game;
  const m = g.s.meta;
  const slots = prules(g).drawerSlots;
  const { body, detail } = menuTemplate(app, r, { title: `The Patent Drawer: ${m.drawer.length} of ${slots} kept`, accent: C.violet, icon: 'fold', detail: 190 });
  // the tools row
  let bx = body.x;
  const tool = (id: string, label: string, tip: string, on: () => void, disabled = false) => {
    const w = textWidth(label) + 14;
    if (button(ui, id, bx, body.y, w, 14, label, { tip, disabled })) on();
    bx += w + 4;
  };
  tool('kdImport', 'Import a string', 'Paste an FWD1 share string: a design from another save, kept here like your own', () => importPrompt(app), m.drawer.length >= slots);
  const draught = prules(g).draughtsmanEvery;
  const note = draught ? `The Draughtsman unfolds the queue (${m.queue.length}) as land, research and coin allow` : 'Kept designs unfold whole onto the box they were folded from';
  if (bx + textWidth(note) < body.x + body.w) ui.text(note, body.x + body.w, body.y + 4, C.hull3, { align: 'right' });
  // the kept designs
  const ky = body.y + 18;
  const runDesigns = g.s.designs.filter((d) => !d.fparts && !m.drawer.some((k) => k.src === d.id));
  const runH = runDesigns.length ? Math.min(Math.floor(body.h * 0.36), 22 + Math.ceil(runDesigns.length / 2) * 16) : 0;
  const keptH = body.y + body.h - ky - (runH ? runH + 4 : 0);
  const inner = card(ui, body.x, ky, body.w, keptH, 'Kept: unfold them in any run', C.violet, 'star');
  if (!m.drawer.length) {
    ui.para('Nothing kept yet. A design folded this run can be kept here (below): it waits through every Reorganize, and in a later run it unfolds whole onto its box, every machine and belt at once, ready to audit and fold again.', inner.x + 2, inner.y + 2, Math.min(inner.w - 4, 340), C.hull3);
  } else {
    const rowH = 28;
    const per = Math.max(1, Math.floor(inner.h / rowH));
    st.scroll = Math.max(0, Math.min(st.scroll, m.drawer.length - per));
    if (ui.hover(inner.x, inner.y, inner.w, inner.h) && app.input.mouse.wheel) st.scroll = Math.max(0, Math.min(m.drawer.length - per, st.scroll + Math.sign(app.input.mouse.wheel)));
    m.drawer.slice(st.scroll, st.scroll + per).forEach((k, i) => keptRow(app, k, inner.x, inner.y + i * rowH, inner.w, rowH - 2));
    if (m.drawer.length > per) ui.text(`${st.scroll + 1}-${Math.min(m.drawer.length, st.scroll + per)} of ${m.drawer.length} (scroll)`, inner.x + inner.w, inner.y - 13, C.hull1, { align: 'right' });
  }
  // this run's designs, to keep
  if (runH) {
    const rin = card(ui, body.x, body.y + body.h - runH, body.w, runH, 'Folded this run: keep the ones worth unfolding again', C.gold, 'fold');
    const cw = Math.floor((rin.w - 4) / 2);
    runDesigns.slice(0, Math.max(0, Math.floor(rin.h / 16)) * 2).forEach((d, i) => runRow(app, d, rin.x + (i % 2) * (cw + 4), rin.y + Math.floor(i / 2) * 16, cw, 14));
  }
  // the detail panel
  if (!detail) return;
  const sel = st.sel;
  const kd = sel?.k === 'kept' ? m.drawer.find((k) => k.id === sel.id) : undefined;
  const rd = sel?.k === 'run' ? g.design(sel.id) : undefined;
  if (kd) keptDetail(app, kd, detail);
  else if (rd) runDetail(app, rd, detail);
  else {
    const inn = card(ui, detail.x, detail.y, detail.w, detail.h, 'Pick a design', C.violet);
    ui.para('Click a kept design to see its layout and unfold it; click one of this run\'s designs to keep it.', inn.x + 2, inn.y + 2, inn.w - 4, C.hull3);
  }
}

function keptRow(app: App, k: KeptDesign, x: number, y: number, w: number, h: number) {
  const ui = app.ui;
  const g = app.game;
  const on = st.sel?.k === 'kept' && st.sel.id === k.id;
  frame(ui, x, y, w, h, 'inset', false);
  if (on) ui.fill(x + 1, y + 1, 2, h - 2, C.violet);
  const t = Math.max(1, Math.min(3, Math.floor((h - 6) / Math.max(k.w, k.h))));
  picture(app, k.parts, k.w, k.h, x + 5, y + 3 + Math.floor((h - 6 - k.h * t) / 2), t);
  const tx = x + 10 + Math.max(24, k.w * t);
  if (k.product) ui.ctx.drawImage(itemIcon(k.product), tx, y + 3);
  const queued = g.s.meta.queue.indexOf(k.id);
  const name = `${k.name}${queued >= 0 ? `  ${ICON.right}${queued + 1}` : ''}`;
  ui.text(ellipsize(name, w - (tx - x) - 70), tx + 11, y + 4, C.gold);
  const facts = `${k.grade ? `${k.grade}, ` : 'imported, '}${k.rate ? `${perMin(k.rate)}/min, ` : ''}${Num.of(keptBill(k)).format()} coin`;
  ui.text(facts, x + w - 6, y + 4, C.bone, { align: 'right' });
  const state = keptState(g, k);
  ui.text(ellipsize(state, w - (tx - x) - 8), tx, y + 15, state.startsWith('ready') ? C.leaf : state.startsWith('unfolded') ? C.hull2 : C.hull3);
  ui.region(x, y, w, h, 'button', false);
  if (ui.hover(x, y, w, h) && ui.clicked) { ui.eat(); st.sel = { k: 'kept', id: k.id }; ui.sfx('click'); }
}

function runRow(app: App, d: ModuleDesign, x: number, y: number, w: number, h: number) {
  const ui = app.ui;
  const g = app.game;
  const it = mainItem(d);
  const on = st.sel?.k === 'run' && st.sel.id === d.id;
  ui.fill(x, y, w, h, on ? C.hull0 : C.shadow);
  if (it) ui.ctx.drawImage(itemIcon(it), x + 2, y + 3);
  ui.text(ellipsize(`${d.name} (${d.grade.letter})`, w - 56), x + 13, y + 4, C.bone);
  const why = keepRefusal(g, d.id);
  if (button(ui, `keep${d.id}`, x + w - 40, y + 1, 38, 12, 'Keep', { disabled: !!why, tip: why ?? 'Keep it in the Patent Drawer: it survives every Reorganize' })) app.act({ k: 'keep', id: d.id });
  ui.region(x, y, w - 44, h, 'button', false);
  if (ui.hover(x, y, w - 44, h) && ui.clicked) { ui.eat(); st.sel = { k: 'run', id: d.id }; ui.sfx('click'); }
}

/** One kept design in full: its picture big enough to read, what it makes, needs and costs, and
 * the four things it can do. */
function keptDetail(app: App, k: KeptDesign, r: Rect) {
  const ui = app.ui;
  const g = app.game;
  const inner = card(ui, r.x, r.y, r.w, r.h, ellipsize(k.name, r.w - 20), C.violet, 'star');
  let yy = inner.y;
  const t = Math.max(3, Math.min(10, Math.floor(Math.min(inner.w - 4, 90) / Math.max(k.w, k.h))));
  picture(app, k.parts, k.w, k.h, inner.x + Math.floor((inner.w - k.w * t) / 2), yy + 1, t);
  yy += k.h * t + 6;
  const row = (a: string, b: string, col: string = C.bone) => {
    ui.text(a, inner.x, yy, C.hull2);
    ui.text(ellipsize(b, inner.w - textWidth(a) - 6), inner.x + inner.w, yy, col, { align: 'right' });
    yy += 10;
  };
  if (k.product) row('Makes', `${ITEMS[k.product as ItemId].name}${k.rate ? `, ${perMin(k.rate)}/min` : ''}`, C.gold);
  row('Graded', k.grade ? `${k.grade} (run ${k.run})` : 'not audited here: imported', k.grade ? C.bone : C.hull3);
  row('Box', `${k.w}x${k.h} at ${k.x},${k.y}, on land ${keptLand(k).join(', ')}`);
  const machines = k.parts.filter((p) => p.kind !== 'belt');
  row('Bill', `${Num.of(keptBill(k)).format()} coin (${machines.length} buildings, ${k.parts.length - machines.length} belts)`);
  const filed = k.product ? g.s.meta.patented?.[k.product] : undefined;
  if (filed) row('On file', `${filed.grade}, ${filed.steps} step${filed.steps === 1 ? '' : 's'}, tier ${filed.tier}`, C.violet);
  yy += 2;
  const why = unfoldKeptRefusal(g, k);
  const drafted = (g.s.drafted ?? []).includes(k.id);
  yy += ui.para(drafted ? 'Unfolded in this run already. Audit it and fold it again to file a better design.' : why ? why.why : 'Ready: one click lays every machine and belt on its box.', inner.x, yy, inner.w, drafted ? C.hull2 : why ? C.pipYellow : C.leaf) + 4;
  // the buttons: Unfold and Queue on one line, Copy and Forget on the next
  const bw = Math.floor((inner.w - 4) / 2);
  const by = inner.y + inner.h - 32;
  if (button(ui, 'kdUnfold', inner.x, by, bw, 14, 'Unfold', { gold: !why, disabled: !!why, tip: why?.why ?? `Unfold it onto ${k.x},${k.y} for ${Num.of(keptBill(k)).format()} coin` })) {
    if (app.act({ k: 'unfoldKept', id: k.id }).ok) {
      app.panel = null;
      app.setFloor('workshop', true);
      app.lookAt(k.x + k.w / 2, k.y + k.h / 2);
    }
  }
  const draught = prules(g).draughtsmanEvery > 0;
  const q = g.s.meta.queue.includes(k.id);
  if (button(ui, 'kdQueue', inner.x + bw + 4, by, bw, 14, q ? 'Unqueue' : 'Queue', { disabled: !draught, active: q, tip: draught ? (q ? 'Take it out of the Draughtsman\'s queue' : 'The Draughtsman unfolds it in every run, in queue order, as land, research and coin allow') : 'Buy The Draughtsman (a Patent) to unfold kept designs for you' })) app.act({ k: 'queueKept', id: k.id });
  if (button(ui, 'kdCopy', inner.x, by + 17, bw, 14, 'Copy string', { tip: 'Copy its share string (FWD1) to the clipboard' })) copyString(app, k);
  const armed = st.armForget === k.id && ui.time < st.armUntil;
  if (button(ui, 'kdForget', inner.x + bw + 4, by + 17, bw, 14, armed ? 'Sure?' : 'Forget', { gold: armed, tip: armed ? 'Click again to forget it for good' : 'Forget it (two clicks): its slot frees up' })) {
    if (armed) { app.act({ k: 'forget', id: k.id }); st.armForget = -1; st.sel = null; }
    else { st.armForget = k.id; st.armUntil = ui.time + 3; }
  }
}

/** One of this run's designs: what it would file, and Keep. */
function runDetail(app: App, d: ModuleDesign, r: Rect) {
  const ui = app.ui;
  const g = app.game;
  const inner = card(ui, r.x, r.y, r.w, r.h, ellipsize(d.name, r.w - 20), C.gold, 'fold');
  let yy = inner.y;
  const t = Math.max(3, Math.min(10, Math.floor(Math.min(inner.w - 4, 90) / Math.max(d.box.w, d.box.h))));
  const parts = d.parts.map((p) => ({ kind: p.kind as DesignPart['kind'], dx: p.dx, dy: p.dy, rot: p.rot, recipe: p.recipe }));
  picture(app, parts, d.box.w, d.box.h, inner.x + Math.floor((inner.w - d.box.w * t) / 2), yy + 1, t);
  yy += d.box.h * t + 6;
  const v = designValue(d);
  const line = previewPatents(g).lines.find((l) => l.item === v?.item);
  if (v) {
    yy += ui.para(`${ITEMS[v.item].name}: ${v.steps} step${v.steps === 1 ? '' : 's'} folded x ${v.grade} x tier ${v.tier}, ${perMin(v.rate)}/min.`, inner.x, yy, inner.w, C.bone) + 2;
    if (line) yy += ui.para(line.status === 'filed' ? 'Its product is on file at this value or better: it files nothing more.' : `Files +${line.patents.toFixed(1)} Patents at the next Reorganize${line.status === 'improved' ? ' (better than the one on file)' : ' (a new product)'}.`, inner.x, yy, inner.w, line.status === 'filed' ? C.hull3 : C.violet) + 4;
  }
  const why = keepRefusal(g, d.id);
  if (why) yy += ui.para(why, inner.x, yy, inner.w, C.pipYellow) + 2;
  if (button(ui, 'rdKeep', inner.x, inner.y + inner.h - 15, inner.w, 14, 'Keep in the drawer', { gold: !why, disabled: !!why, tip: why ?? 'It survives every Reorganize: unfold it whole in a later run' })) {
    if (app.act({ k: 'keep', id: d.id }).ok) {
      const k = g.s.meta.drawer[g.s.meta.drawer.length - 1];
      if (k) st.sel = { k: 'kept', id: k.id };
    }
  }
}

function copyString(app: App, k: KeptDesign) {
  const s = encodeDesign(k);
  const done = () => app.toast('Design string copied', `${k.name}: ${s.length} characters. Paste it into Import on any save.`, C.violet);
  if (navigator.clipboard) navigator.clipboard.writeText(s).then(done, () => window.prompt('Copy this design string:', s));
  else window.prompt('Copy this design string:', s);
}

function importPrompt(app: App) {
  const s = window.prompt('Paste a Foldworks design string (FWD1...):');
  if (!s) return;
  if (app.act({ k: 'importDesign', code: s.trim() }).ok) app.toast('Design imported', 'It is in the Patent Drawer: unfold it onto its box when the land is yours.', C.violet);
}
