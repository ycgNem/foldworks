// Blueprints on screen (DESIGN.md §19, Milestone 5): the Blueprint Book (a list of saved layouts
// with their size, parts and price; place, copy, rename, delete), the two Workshop tools (drag a
// box to save a layout; click to place one as ghosts), the ghosts' own row (build what you can
// afford, clear them) and import from a share string. Deliberately a list of named layouts with a
// mini map, not a grid of icon slots (DECISIONS.md, Milestone 5). Presentation only: every change
// is a command (bpSave, bpPlace, bpImport, ghostBuild...).
import { C } from '../data/palette';
import { BUILD } from '../data/machines';
import { ICON, textWidth, ellipsize } from '../ui/font';
import { RULES } from '../data/rules';
import { Num } from '../engine/num';
import { bpCost, bpSaveRefusal, ghostAt, ghostWhy, ghostsCost, encodeBlueprint } from '../sim/blueprints';
import { prules } from '../sim/patents';
import type { Blueprint } from '../sim/world';
import type { BlueprintPreview } from '../render/ghosts';
import { card, button, frame } from './chrome';
import { screenHeader } from './widgets';
import type { App } from './app';
import type { Rect } from '../ui/ui';

const st = { scroll: 0, armDelete: -1, armUntil: 0 };

/** Kind colours for the mini maps (belts dim, machines by family). */
function partCol(kind: string): string {
  if (kind === 'belt') return C.hull1;
  if (kind === 'miner') return C.copper1;
  if (kind === 'heap' || kind === 'crate') return C.ground2;
  if (kind === 'splitter' || kind === 'merger') return C.hull2;
  if (kind === 'pole' || kind === 'boiler' || kind === 'steamEngine' || kind === 'generator') return C.teal1;
  return C.gold;
}

export function blueprintsScreen(app: App, r: Rect) {
  const ui = app.ui;
  const g = app.game;
  const m = g.s.meta;
  screenHeader(app, r, 'The Blueprint Book', C.teal1, 'build');
  const y0 = r.y + 22, bottom = r.y + r.h - 6;
  // ---- the tools row
  let bx = r.x + 8;
  const tool = (id: string, label: string, tip: string, on: () => void, disabled = false) => {
    const w = textWidth(label) + 14;
    if (button(ui, id, bx, y0, w, 14, label, { tip, disabled })) on();
    bx += w + 4;
  };
  tool('bpNew', 'Save a layout', `Drag a box over buildings in the Workshop (at most ${RULES.blueprintMax.value}x${RULES.blueprintMax.value}). The Dock, Hopper and Hand Furnace stay out.`, () => {
    app.panel = null;
    app.setFloor('workshop', true);
    app.setMode({ k: 'bpsave' });
  });
  tool('bpImport', 'Import a string', 'Paste an FWB1 share string', () => importPrompt(app));
  const ghosts = g.s.ghosts.length;
  tool('ghostAll', `Build ghosts (${ghosts})`, `Build every ghost you can afford now (${ghostsCost(g).format()} coin for all of them)`, () => app.act({ k: 'ghostBuildAll' }), !ghosts);
  tool('ghostClear', 'Clear ghosts', 'Remove every ghost (nothing is refunded: ghosts cost nothing)', () => app.act({ k: 'ghostClear' }), !ghosts);
  const drones = prules(g).drones;
  const note = drones ? `${drones} ${drones === 1 ? 'dragonfly builds' : 'dragonflies build'} a ghost every ${RULES.droneTicks.value / 20} s` : 'Ghosts wait for you (or a Builder Dragonfly)';
  if (bx + textWidth(note) < r.x + r.w - 8) ui.text(note, r.x + r.w - 8, y0 + 4, C.hull3, { align: 'right' });
  // ---- the book
  const ly = y0 + 18;
  const inner = card(ui, r.x + 8, ly, r.w - 16, bottom - ly, `${m.blueprints.length} of ${RULES.blueprintSlots.value} layouts`, C.teal1);
  if (!m.blueprints.length) {
    ui.para('No blueprints yet. Save a working line from a box, and it waits here through every Reorganize: place it as ghosts and build it again in a minute.', inner.x + 4, inner.y + 4, Math.min(inner.w - 8, 320), C.hull3);
    return;
  }
  const rowH = 30;
  const per = Math.max(1, Math.floor(inner.h / rowH));
  st.scroll = Math.max(0, Math.min(st.scroll, m.blueprints.length - per));
  if (ui.hover(inner.x, inner.y, inner.w, inner.h) && app.input.mouse.wheel) st.scroll = Math.max(0, Math.min(m.blueprints.length - per, st.scroll + Math.sign(app.input.mouse.wheel)));
  m.blueprints.slice(st.scroll, st.scroll + per).forEach((bp, i) => row(app, bp, inner.x, inner.y + i * rowH, inner.w, rowH - 2));
  if (m.blueprints.length > per) ui.text(`${st.scroll + 1}-${Math.min(m.blueprints.length, st.scroll + per)} of ${m.blueprints.length} (scroll)`, inner.x + inner.w, inner.y - 13, C.hull1, { align: 'right' });
}

function row(app: App, bp: Blueprint, x: number, y: number, w: number, h: number) {
  const ui = app.ui;
  frame(ui, x, y, w, h, 'inset', false);
  // the mini map: one pixel block per tile
  const k = Math.max(1, Math.min(3, Math.floor((h - 6) / Math.max(bp.w, bp.h))));
  const mw = bp.w * k, mh = bp.h * k;
  ui.fill(x + 3, y + 3, Math.max(mw, 24), h - 6, C.shadow);
  for (const p of bp.parts) {
    const d = BUILD[p.kind];
    ui.fill(x + 3 + p.dx * k, y + 3 + Math.floor((h - 6 - mh) / 2) + p.dy * k, d.w * k, d.h * k, partCol(p.kind));
  }
  const tx = x + 8 + Math.max(mw, 24);
  const bw = 40, gap = 3;
  const btnX = x + w - 4 * (bw + gap) - 2;
  ui.text(ellipsize(bp.name, btnX - tx - 6), tx, y + 4, C.gold);
  const machines = bp.parts.filter((p) => p.kind !== 'belt').length;
  ui.text(ellipsize(`${bp.w}x${bp.h}, ${machines} buildings, ${bp.parts.length - machines} ${bp.parts.length - machines === 1 ? 'belt' : 'belts'}: ${Num.of(bpCost(bp)).format()} coin`, btnX - tx - 6), tx, y + 15, C.hull3);
  let b = btnX;
  if (button(ui, `bpPlace${bp.id}`, b, y + 6, bw, 14, 'Place', { tip: 'Place it as ghosts in the Workshop (R turns nothing: a blueprint keeps its turns)' })) {
    app.panel = null;
    app.setFloor('workshop', true);
    app.setMode({ k: 'bpplace', id: bp.id });
  }
  b += bw + gap;
  if (button(ui, `bpCopy${bp.id}`, b, y + 6, bw, 14, 'Copy', { tip: 'Copy its share string (FWB1) to the clipboard' })) copyString(app, bp);
  b += bw + gap;
  if (button(ui, `bpRename${bp.id}`, b, y + 6, bw, 14, 'Name', { tip: 'Rename it' })) {
    const n = window.prompt('A name for this blueprint:', bp.name);
    if (n) app.act({ k: 'bpRename', id: bp.id, name: n });
  }
  b += bw + gap;
  const armed = st.armDelete === bp.id && ui.time < st.armUntil;
  if (button(ui, `bpDelete${bp.id}`, b, y + 6, bw, 14, armed ? 'Sure?' : 'Delete', { gold: armed, tip: armed ? 'Click again to delete it for good' : 'Delete it (two clicks)' })) {
    if (armed) { app.act({ k: 'bpDelete', id: bp.id }); st.armDelete = -1; }
    else { st.armDelete = bp.id; st.armUntil = ui.time + 3; }
  }
}

function copyString(app: App, bp: Blueprint) {
  const s = encodeBlueprint(bp);
  const done = () => app.toast('Blueprint copied', `${bp.name}: ${s.length} characters. Paste it into Import on any save.`, C.teal1);
  if (navigator.clipboard) navigator.clipboard.writeText(s).then(done, () => window.prompt('Copy this blueprint string:', s));
  else window.prompt('Copy this blueprint string:', s);
}

function importPrompt(app: App) {
  const s = window.prompt('Paste a Foldworks blueprint string (FWB1...):');
  if (!s) return;
  if (app.act({ k: 'bpImport', code: s.trim() }).ok) app.toast('Blueprint imported', 'It is in the book: Place it to lay its ghosts.', C.teal1);
}

// ------------------------------------------------------------------ the Workshop tools

/** The blueprint following the mouse while placing (for the renderer). */
export function blueprintPreview(app: App): BlueprintPreview | null {
  const m = app.mode;
  const h = app.hud.hoverTile;
  if (m.k !== 'bpplace' || !h || app.floor !== 'workshop') return null;
  const bp = app.game.s.meta.blueprints.find((q) => q.id === m.id);
  return bp ? { parts: bp.parts, x: h.x, y: h.y } : null;
}

/** Is the dragged box a blueprint's (not a fold's)? Its outline is green when it can be saved. */
export function bpBoxOk(app: App): boolean {
  const b = app.dragBox();
  return !!b && !bpSaveRefusal(app.game, b);
}

/** The Workshop mouse in the two blueprint tools; true when it took the input. */
export function blueprintInput(app: App, t: { x: number; y: number }, overUI: boolean, pt: { x: number; y: number }): boolean {
  const inp = app.input;
  const g = app.game;
  const m = app.mode;
  if (m.k === 'bpsave') {
    const cx = Math.max(0, Math.min(g.W - 1, t.x)), cy = Math.max(0, Math.min(g.H - 1, t.y));
    if (inp.mouse.pressed[0] && !overUI && g.inb(pt.x, pt.y)) app.foldDrag = { x0: pt.x, y0: pt.y, x1: pt.x, y1: pt.y };
    if (app.foldDrag && inp.mouse.down[0]) { app.foldDrag.x1 = cx; app.foldDrag.y1 = cy; }
    if (app.foldDrag && !inp.mouse.down[0]) {
      const b = app.dragBox()!;
      app.foldDrag = null;
      const name = `Layout ${g.s.meta.nextBlueprint}`;
      if (app.act({ k: 'bpSave', ...b, name }).ok) {
        app.toast('Blueprint saved', `${name}, ${b.w}x${b.h}: in the Blueprint Book, kept through every Reorganize.`, C.teal1);
        app.setMode({ k: 'idle' });
        app.panel = 'blueprints';
      }
    }
    return true;
  }
  if (m.k === 'bpplace') {
    if (inp.mouse.pressed[0] && !overUI && g.inb(t.x, t.y)) {
      if (app.act({ k: 'bpPlace', id: m.id, x: t.x, y: t.y }).ok) {
        app.audio.sfx('place');
        // shift keeps the tool for another copy
        if (!inp.shift) app.setMode({ k: 'idle' });
      }
    }
    return true;
  }
  return false;
}

/** A click on a ghost (idle tool): build it now. True when there was a ghost. */
export function ghostClick(app: App, x: number, y: number): boolean {
  if (app.game.entAt(x, y) || !ghostAt(app.game, x, y)) return false;
  if (app.act({ k: 'ghostBuild', x, y }).ok) app.audio.sfx('place');
  return true;
}

/** The tools' instruction strip over the floor, and a ghost's reason under the mouse. */
export function blueprintHud(app: App) {
  const ui = app.ui;
  const g = app.game;
  const c = app.layout.center;
  const m = app.mode;
  const say = (text: string) => {
    const w = textWidth(text) + 12;
    ui.fill(c.x + Math.floor((c.w - w) / 2), c.y + c.h - 18, w, 13, C.ink, 0.85);
    ui.text(text, c.x + c.w / 2, c.y + c.h - 15, C.teal1, { align: 'center' });
  };
  if (app.panel) return;
  if (m.k === 'bpsave') say(ellipsize(`${ICON.right} Drag a box over a layout to save it. Right-click to stop.`, c.w - 16));
  else if (m.k === 'bpplace') {
    const bp = g.s.meta.blueprints.find((q) => q.id === m.id);
    say(ellipsize(`${ICON.right} Click to place ${bp?.name ?? 'the blueprint'} (its top-left corner). Shift keeps placing.`, c.w - 16));
  }
  const h = app.hud.hoverTile;
  if (h && app.floor === 'workshop' && m.k === 'idle' && !g.entAt(h.x, h.y) && !ui.tooltip) {
    const q = ghostAt(g, h.x, h.y);
    if (q) ui.tip([{ text: `Ghost: ${ghostWhy(g, q)}`, color: C.teal1 }, { text: 'Click to build it now.', color: C.hull1 }], 200);
  }
}
