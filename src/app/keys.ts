// The Keys page (the drawn keyboard, moved here from screens.ts in Milestone 13): every bound key
// inked in its role's colour with its word and icon, the mouse drawn large with what each part
// does, and now rebinding: click a key, then press the key it should move to (Esc keeps it). The
// action that held the new key takes the old one, so no key does two things and nothing is left
// unbound. The bindings are kept with the settings (src/app/settings.ts) and every keycap in every
// string follows them (src/ui/rich.ts setKeyAliases). Under the board: what the inks mean, a
// Reset keys button, and the status pips' legend (their shapes: src/render/pips.ts).
import { C, rgba } from '../data/palette';
import { ICON, textWidth, smallWidth, hasSmallGlyph } from '../ui/font';
import { ACTION_LABELS, SHOWN_ACTIONS, keyLabel, rebind, keyAliases, defaultBinds, type Action, type Binds } from '../engine/input';
import { drawRich, richWidth, setKeyAliases, CHIP_H } from '../ui/rich';
import { drawPipShape, PIP_MEANING } from '../render/pips';
import { button, chip, uiIcon, roleInk, label, T, type UIconName, type Role } from './chrome';
import { menuTemplate } from './widgets';
import { registerScreen, backTabs, pencilLine } from './screens';
import { loadBinds, saveBinds } from './settings';
import type { App } from './app';
import type { Rect } from '../ui/ui';

// ------------------------------------------------------------------ the bindings, kept

/** Load the stored bindings into the input and the keycaps (once, at start: src/app/app.ts). */
export function initKeys(app: App) {
  app.input.setBinds(loadBinds());
  setKeyAliases(keyAliases(app.input.binds));
}

/** Use and remember new bindings. */
function apply(app: App, b: Binds) {
  app.input.setBinds(b);
  saveBinds(b);
  setKeyAliases(keyAliases(b));
}

const sameBinds = (a: Binds, b: Binds) => SHOWN_ACTIONS.every((k) => a[k].join() === b[k].join());

/** the key being moved: its code and the action it does, and when the capture began */
let capture: { code: string; action: Action; at: number } | null = null;
/** the last move, said under the board for a moment */
let note: { text: string; at: number } | null = null;

function startCapture(app: App, code: string, action: Action) {
  capture = { code, action, at: app.ui.time };
  app.audio.sfx('click');
  app.input.captureKey = (k) => {
    const c = capture;
    capture = null;
    if (!c || app.panel !== 'keys') return;
    // Esc keeps the key where it is (unless Esc is the key being moved and Esc is pressed: the same)
    if (k === 'Escape' && c.code !== 'Escape') { app.audio.sfx('close'); return; }
    const r = rebind(app.input.binds, c.action, c.code, k);
    if (r.binds[c.action].join() === app.input.binds[c.action].join()) { app.audio.sfx('error'); return; }
    apply(app, r.binds);
    app.audio.sfx('rotate');
    note = { text: r.from ? `{k:=${keyLabel(k)}} ${ACTION_LABELS[c.action].toLowerCase()} · {k:=${keyLabel(c.code)}} ${ACTION_LABELS[r.from].toLowerCase()}` : `{k:=${keyLabel(k)}} ${ACTION_LABELS[c.action].toLowerCase()}`, at: app.ui.time };
  };
}

function stopCapture(app: App) {
  capture = null;
  app.input.captureKey = null;
}

/** Each frame in play: a capture left behind by a page that closed lets go of the keyboard. */
export function keysFrame(app: App) {
  if (capture && app.panel !== 'keys') stopCapture(app);
}

// ------------------------------------------------------------------ the drawn keyboard

/** A bound key's short word on its face (Pip, five letters at most), by action. */
const KEY_WORD: Record<string, string> = {
  zoomIn: 'IN', zoomOut: 'OUT',
  rotate: 'TURN', remove: 'SELL', fold: 'FOLD', floor: 'LIFT', research: 'LAB', orders: 'DOCK', modules: 'MODS',
  cancel: 'BACK', pause: 'STOP', help: 'HELP', mute: 'MUTE', hud: 'HUD', flow: 'FLOW', debug: 'DBG', wheel: 'WHEEL', stuck: 'STUCK',
};
/** The pan keys draw an arrow (Reed's) instead of a word. */
const KEY_ARROW: Record<string, string> = { panUp: ICON.up, panDown: ICON.down, panLeft: ICON.left, panRight: ICON.right };
/** A mark for a narrow key whose word does not fit and that has no icon. */
const KEY_MARK: Record<string, string> = { help: '?', cancel: ICON.cross, stuck: '?' };
/** A bound key's icon (8x8), where the action has one. */
const KEY_ICON: Record<string, UIconName> = {
  rotate: 'rotate', remove: 'remove', fold: 'fold', flow: 'flow', research: 'research', orders: 'orders', modules: 'kit',
  floor: 'factory', pause: 'pause', mute: 'heart', wheel: 'build',
};
/** What kind of thing an action does: the key's ink. */
function keyRole(act: string): Role {
  if (act.startsWith('pan') || act.startsWith('zoom')) return 'power';
  if (act.startsWith('slot') || ['rotate', 'remove', 'fold', 'flow', 'wheel', 'build'].includes(act)) return 'coin';
  if (['research', 'orders', 'modules', 'help', 'codex', 'patents', 'drawer', 'stats', 'keys', 'stuck'].includes(act)) return 'research';
  return 'good';
}
const ROLE_NAME: [Role, string][] = [['power', 'camera'], ['coin', 'building'], ['research', 'pages'], ['good', 'the game']];

/** The keyboard's rows: [code, label, width in key units]; null codes are gaps. */
const ROWS: [string | null, string, number][][] = [
  [['Escape', 'Esc', 1.25], [null, '', 0.75], ['F1', 'F1', 1], ['F2', 'F2', 1], ['F3', 'F3', 1], ['F4', 'F4', 1]],
  [['Backquote', '`', 1], ['Digit1', '1', 1], ['Digit2', '2', 1], ['Digit3', '3', 1], ['Digit4', '4', 1], ['Digit5', '5', 1], ['Digit6', '6', 1], ['Digit7', '7', 1], ['Digit8', '8', 1], ['Digit9', '9', 1], ['Digit0', '0', 1], ['Minus', '-', 1], ['Equal', '=', 1], ['Backspace', 'Bksp', 1.75]],
  [['Tab', 'Tab', 1.5], ['KeyQ', 'Q', 1], ['KeyW', 'W', 1], ['KeyE', 'E', 1], ['KeyR', 'R', 1], ['KeyT', 'T', 1], ['KeyY', 'Y', 1], ['KeyU', 'U', 1], ['KeyI', 'I', 1], ['KeyO', 'O', 1], ['KeyP', 'P', 1], ['BracketLeft', '[', 1], ['BracketRight', ']', 1], ['Backslash', '\\', 1.25]],
  [['CapsLock', 'Caps', 1.75], ['KeyA', 'A', 1], ['KeyS', 'S', 1], ['KeyD', 'D', 1], ['KeyF', 'F', 1], ['KeyG', 'G', 1], ['KeyH', 'H', 1], ['KeyJ', 'J', 1], ['KeyK', 'K', 1], ['KeyL', 'L', 1], ['Semicolon', ';', 1], ['Quote', "'", 1], ['Enter', 'Enter', 2]],
  [['ShiftLeft', 'Shift', 2.25], ['KeyZ', 'Z', 1], ['KeyX', 'X', 1], ['KeyC', 'C', 1], ['KeyV', 'V', 1], ['KeyB', 'B', 1], ['KeyN', 'N', 1], ['KeyM', 'M', 1], ['Comma', ',', 1], ['Period', '.', 1], ['Slash', '/', 1], ['ShiftRight', 'Shift', 2.5]],
  [['ControlLeft', 'Ctrl', 1.5], ['AltLeft', 'Alt', 1.5], ['Space', 'Space', 8.75], ['AltRight', 'Alt', 1.5], ['ControlRight', 'Ctrl', 1.5]],
];
/** the arrow keys, beside the board: [code, label, column, row] */
const ARROWS: [string, string, number, number][] = [['ArrowUp', 'Up', 1, 4], ['ArrowLeft', 'Left', 0, 5], ['ArrowDown', 'Down', 1, 5], ['ArrowRight', 'Right', 2, 5]];
const DRAWN = new Set<string>([...ROWS.flat().map((k) => k[0]).filter((c): c is string => !!c), ...ARROWS.map((a) => a[0])]);

/** One key of the drawn keyboard: a paper key with an ink line and a lip. A bound key is inked:
 * its letter, its icon, its word in the role's ink; a free key is faint pencil. Pressed keys go
 * down; the key being moved glows gold. A click on a bound key starts moving it. */
function bigKey(app: App, code: string, lab: string, x: number, y: number, w: number, h: number, acts: string[]) {
  const ui = app.ui;
  const ctx = ui.ctx;
  const bound = acts.length > 0;
  const hov = ui.hover(x, y, w, h);
  const moving = capture?.code === code;
  const down = app.input.down.has(code) || (hov && bound && ui.input.mouse.down[0]);
  const dy = down ? 1 : 0;
  const role = bound ? keyRole(acts[0]) : 'soft';
  ui.region(x, y, w, h, bound ? 'button' : 'panel', false);
  if (bound) ui.mark('key:' + code, x, y, w, h);
  if (bound) {
    ctx.fillStyle = rgba(T.shadow, 0.3);
    ctx.fillRect(x + 1, y + h, w - 1, 1);
    ctx.fillStyle = C.ink;
    ctx.fillRect(x + 1, y + dy, w - 2, h - dy);
    ctx.fillRect(x, y + 1 + dy, w, h - 2 - dy);
    ctx.fillStyle = moving ? (Math.floor(ui.time * 4) % 2 ? C.gold : C.lamp3) : hov ? C.lamp3 : T.paperHi;
    ctx.fillRect(x + 1, y + 1 + dy, w - 2, h - 5);
    ctx.fillStyle = T.paperLo;
    ctx.fillRect(x + 1, y + h - 4, w - 2, down ? 2 : 1);
    if (!down) { ctx.fillStyle = C.wood4; ctx.fillRect(x + 1, y + h - 3, w - 2, 2); }
    ctx.fillStyle = rgba(roleInk(role), 0.85);
    ctx.fillRect(x + 2, y + h - 6 + dy, w - 4, 1);
  } else {
    ctx.fillStyle = C.wood1;
    ctx.fillRect(x + 1, y + 1, w - 2, h - 1);
    ctx.fillRect(x, y + 2, w, h - 3);
    ctx.fillStyle = hov && capture ? C.wood5 : hov ? C.wood5 : C.wood4;
    ctx.fillRect(x + 1, y + 2, w - 2, h - 4);
  }
  const name = lab.toUpperCase();
  const nameCol = bound ? T.ink : C.wood2;
  // Pip has no brackets or quotes: those keys' names go in Reed
  if ([...name].every((ch) => hasSmallGlyph(ch))) { if (smallWidth(name) <= w - 4) ui.small(name, x + 3, y + 3 + dy, nameCol); }
  else if (textWidth(lab) <= w - 4) ui.text(lab, x + 3, y + 1 + dy, nameCol);
  if (bound) {
    const ic = KEY_ICON[acts[0]] ?? (acts[0].startsWith('slot') ? 'build' : undefined);
    const arrow = KEY_ARROW[acts[0]];
    let word = KEY_WORD[acts[0]] ?? (acts[0].startsWith('slot') ? 'PICK' : (ACTION_LABELS[acts[0] as Action] ?? acts[0]).split(' ')[0].toUpperCase());
    const fits = smallWidth(word) <= w - 4;
    const mark = arrow ?? (!fits && !ic ? KEY_MARK[acts[0]] : undefined);
    // the mark sits under the key's name, never on it (a short key at 1024x640 had them touch)
    const markY = y + Math.max(h - 15, 9) + dy;
    if (mark) ui.text(mark, x + Math.floor(w / 2), markY, roleInk(role), { align: 'center' });
    else if (fits || !ic) {
      if (ic && w >= 22 && smallWidth(name) + 12 <= w - 2) uiIcon(ui, ic, x + w - 10, y + 2 + dy, 1);
      while (word.length > 1 && smallWidth(word) > w - 4) word = word.slice(0, -1);
      ui.small(word, x + Math.floor(w / 2), y + h - 12 + dy, roleInk(role), { align: 'center' });
    } else uiIcon(ui, ic, x + Math.floor(w / 2) - 4, markY, 1);
  }
  if (hov) {
    if (bound) {
      const lines = [{ text: `{k:=${keyLabel(code)}}  {big:${ACTION_LABELS[acts[0] as Action] ?? acts[0]}}` }, ...acts.slice(1).map((a) => ({ text: `{soft:and} ${ACTION_LABELS[a as Action] ?? a}` }))];
      ui.tip([...lines, { text: moving ? '{warn:press its new key} · {k:=Esc} keeps it' : '{k:LMB} move it to another key' }], 190);
    }
    if (ui.clicked) {
      ui.eat();
      if (bound && !moving) startCapture(app, code, acts[0] as Action);
      else stopCapture(app);
    }
  }
}

/** The mouse, drawn large: a paper mouse with its two buttons and the wheel, the part in use
 * inked red; returns the three parts' centres for the labels. */
function bigMouse(app: App, x: number, y: number, s: number) {
  const ui = app.ui;
  const ctx = ui.ctx;
  const w = 10 * s, h = 15 * s;
  const m = ui.input.mouse;
  ctx.fillStyle = rgba(T.shadow, 0.3);
  ctx.beginPath(); ctx.ellipse(x + w / 2 + 1, y + h / 2 + 2, w / 2, h / 2, 0, 0, Math.PI * 2); ctx.fill();
  for (let j = 0; j < h; j++) {
    const t = (j + 0.5) / h * 2 - 1;
    const half = Math.round((w / 2) * Math.sqrt(Math.max(0, 1 - t * t * (t < 0 ? 0.55 : 0.85))));
    if (half <= 0) continue;
    ctx.fillStyle = C.ink;
    ctx.fillRect(x + w / 2 - half, y + j, half * 2, 1);
    const face = j < h * 0.4 ? null : j > h - 3 ? T.paperLo : T.paper;
    if (half > 1 && j > 0 && j < h - 1) {
      if (face) { ctx.fillStyle = face; ctx.fillRect(x + w / 2 - half + 1, y + j, half * 2 - 2, 1); }
      else {
        ctx.fillStyle = m.down[0] ? T.badFill : T.paperHi;
        ctx.fillRect(x + w / 2 - half + 1, y + j, half - 2, 1);
        ctx.fillStyle = m.down[2] ? T.badFill : T.paperHi;
        ctx.fillRect(x + w / 2 + 1, y + j, half - 2, 1);
      }
    }
  }
  ctx.fillStyle = C.ink;
  ctx.fillRect(x, y + Math.round(h * 0.4), w, 1);
  const wy = y + Math.round(h * 0.12), wh = Math.round(h * 0.22);
  ctx.fillRect(x + w / 2 - 2, wy, 4, wh);
  ctx.fillStyle = C.copper2;
  ctx.fillRect(x + w / 2 - 1, wy + 1, 2, wh - 2);
  ctx.fillStyle = C.ink;
  const turn = Math.floor(ui.time * 3) % 3;
  for (let k = turn; k < wh - 2; k += 3) ctx.fillRect(x + w / 2 - 1, wy + 1 + k, 2, 1);
  return { lmb: { x: x + w * 0.25, y: y + h * 0.2 }, rmb: { x: x + w * 0.75, y: y + h * 0.2 }, wheel: { x: x + w / 2, y: wy + wh / 2 } };
}

/** The status pips' legend: each shape at 2x in its colour and what it means, in rows of `per`. */
export function pipLegend(app: App, x: number, y: number, w: number): number {
  const ui = app.ui;
  label(ui, 'status pips', x, y, T.inkSoft);
  const per = w >= 210 ? 3 : 2;
  const cw = Math.floor(w / per);
  PIP_MEANING.forEach(([shape, word, col], i) => {
    const cx = x + (i % per) * cw, cy = y + 10 + Math.floor(i / per) * 15;
    // the pip as it is on the floor (1x) and drawn large beside it (2x), so it reads as a shape
    ui.ctx.save();
    ui.ctx.translate(cx + 1, cy);
    ui.ctx.scale(2, 2);
    drawPipShape(ui.ctx, 1, 1, shape, col);
    ui.ctx.restore();
    ui.text(word, cx + 17, cy + 2, T.ink);
  });
  return 10 + Math.ceil(PIP_MEANING.length / per) * 15;
}

function keysPage(app: App, r: Rect) {
  const ui = app.ui;
  const { body } = menuTemplate(app, r, { title: 'Keys', accent: T.ink, icon: 'options', tabs: backTabs(app) });
  const byCode = new Map<string, string[]>();
  for (const act of SHOWN_ACTIONS) for (const code of app.input.binds[act] ?? []) {
    const l = byCode.get(code) ?? [];
    l.push(act);
    byCode.set(code, l);
  }
  // the line over the board: what a click does, or what it is waiting for; Reset keys at its right
  const changed = !sameBinds(app.input.binds, defaultBinds());
  const rw = 66;
  if (button(ui, 'resetKeys', body.x + body.w - rw - 2, body.y + 2, rw, 15, 'Reset keys', { disabled: !changed, tip: changed ? '{k:LMB} every key back where it was' : '{soft:the keys are as they came}' })) {
    stopCapture(app);
    apply(app, defaultBinds());
    note = { text: '{good:every key back where it was}', at: ui.time };
  }
  const head = capture
    ? `{warn:press the new key for} {big:${ACTION_LABELS[capture.action]}} {soft:·} {k:=Esc} {soft:keeps it on} {k:=${keyLabel(capture.code)}}`
    : note && ui.time - note.at < 4 ? `{good:moved} ${note.text}` : '{soft:click a key, then press the key it moves to}';
  drawRich(ui, head, body.x + 4, body.y + 5, body.w - rw - 12, T.ink);
  const units = 14.75 + 0.6 + 3;
  const u = Math.max(18, Math.min(32, Math.floor((body.w - 8) / units)));
  const kh = Math.max(18, Math.min(26, Math.round(u * 0.86)));
  const gap = 2;
  const boardW = Math.round(units * u);
  const bx = body.x + Math.floor((body.w - boardW) / 2), by = body.y + 24;
  const caseH = ROWS.length * (kh + gap) + 8;
  ui.ctx.fillStyle = rgba(T.shadow, 0.3);
  ui.ctx.fillRect(bx - 4, by - 1, boardW + 9, caseH + 2);
  ui.fill(bx - 5, by - 3, boardW + 8, caseH, T.woodLo);
  ui.fill(bx - 4, by - 2, boardW + 6, caseH - 2, T.wood);
  ui.fill(bx - 4, by - 2, boardW + 6, 1, T.woodHi);
  ROWS.forEach((row, j) => {
    let kx = bx;
    const ky = by + j * (kh + gap);
    for (const [code, lab, wu] of row) {
      const kw = Math.round(wu * u) - gap;
      if (code) bigKey(app, code, lab, kx, ky, kw, kh, byCode.get(code) ?? []);
      kx += Math.round(wu * u);
    }
  });
  const ax0 = bx + Math.round((14.75 + 0.6) * u);
  for (const [code, lab, c, rr] of ARROWS) bigKey(app, code, lab, ax0 + c * u, by + rr * (kh + gap), u - gap, kh, byCode.get(code) ?? []);
  // a click anywhere else lets a key being moved stay where it is
  if (capture && ui.clicked && ui.time - capture.at > 0.05) { ui.eat(); stopCapture(app); }
  let y = by + caseH + 6;
  let cx = body.x + 4;
  for (const [role, name] of ROLE_NAME) cx += chip(ui, cx, y, name, { role }) + 6;
  // bound keys the drawing has no place for (the numpad and the like)
  const extra = [...byCode.entries()].filter(([code]) => !DRAWN.has(code));
  if (extra.length) {
    cx += 8;
    cx += ui.text('also', cx, y + 2, T.inkSoft) + 6;
    for (const [code, acts] of extra) {
      const s = `{k:=${keyLabel(code)}} ${(ACTION_LABELS[acts[0] as Action] ?? acts[0]).toLowerCase()}`;
      const sw = richWidth(s);
      if (cx + sw > body.x + body.w) break;
      drawRich(ui, s, cx, y + 2, Infinity, roleInk(keyRole(acts[0])));
      cx += sw + 8;
    }
  }
  y += CHIP_H + 8;
  // the mouse on the left, the pips' legend on the right
  const room = body.y + body.h - y;
  const legW = Math.min(240, Math.floor(body.w * 0.42));
  const legX = body.x + body.w - legW;
  if (room >= 42) pipLegend(app, legX, y, legW - 4);
  const s = Math.max(2, Math.min(4, Math.floor((room - 4) / 15)));
  if (room >= 32) {
    const mx = body.x + 10;
    const parts = bigMouse(app, mx, y, s);
    const lx = mx + 10 * s + 26;
    const lines: [{ x: number; y: number }, string][] = [
      [parts.lmb, '{k:LMB}  use · place · drag a belt'],
      [parts.wheel, '{k:WHEEL}  zoom'],
      [parts.rmb, '{k:RMB}  the wheel · drag to pan'],
    ];
    const step = Math.max(12, Math.min(16, Math.floor((15 * s) / 3)));
    lines.forEach(([p, text], i) => {
      const ty = y + 2 + i * step;
      pencilLine(ui, p.x, p.y, lx - 4, ty + 4, T.inkSoft, 0.8);
      ui.ctx.fillStyle = T.inkSoft;
      ui.ctx.fillRect(Math.round(p.x) - 1, Math.round(p.y) - 1, 2, 2);
      drawRich(ui, text, lx, ty, legX - 8 - lx, T.ink);
    });
  }
}

registerScreen('keys', (app, r) => keysPage(app, r));

/** For the e2e scripts (App.onboarding): start moving a key, press a key, put every key back. */
export const keysDebug = {
  capture(app: App, code: string) {
    const act = SHOWN_ACTIONS.find((a) => app.input.binds[a].includes(code));
    if (act) startCapture(app, code, act);
  },
  press(app: App, code: string) { app.input.captureKey?.(code); },
  reset(app: App) {
    stopCapture(app);
    note = null;
    if (!sameBinds(app.input.binds, defaultBinds())) apply(app, defaultBinds());
  },
};
