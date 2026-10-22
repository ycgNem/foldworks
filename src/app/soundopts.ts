// Milestone 12: the sound and motion settings, kept (src/app/settings.ts) and drawn on the
// Options page: the mute (also the M key), four volume sliders in two columns (master; the
// game's effects; the ambience of machines and belts; the interface's clicks), and reduced
// motion (no shake, a third of the particles, a few flakes of confetti, ribbons that fade in
// place without dropping, no full-screen flashes).
import type { App } from './app';
import type { Vol } from '../engine/audio/audio';
import { textWidth } from '../ui/font';
import { meter, T } from './chrome';
import { calmSetting, saveCalm, saveSound, soundSettings } from './settings';

/** Apply the stored sound and motion settings (once, at start), and keep them from now on. */
export function initSound(app: App) {
  const s = soundSettings();
  app.audio.applySettings({ master: s.master, sfx: s.sfx, amb: s.amb, ui: s.ui });
  app.audio.setMuted(s.muted);
  app.muted = s.muted;
  app.renderer.fx.calm = calmSetting();
  app.audio.onChange = () => saveSound({ ...app.audio.vol, muted: app.audio.muted });
}

export function setMute(app: App, on: boolean) {
  app.muted = on;
  app.audio.setMuted(on);
}

/** Reduced motion on or off, and remembered. */
export function setCalm(app: App, on: boolean) {
  app.renderer.fx.calm = on;
  if (on) app.renderer.fx.shake = 0;
  saveCalm(on);
}

/** Reduced motion is on (the HUD's celebrations read it). */
export const calm = (app: App) => app.renderer.fx.calm;

const SLIDERS: { k: keyof Vol; name: string; tip: string; preview: string | null }[] = [
  { k: 'master', name: 'Master', tip: 'everything', preview: 'coin' },
  { k: 'sfx', name: 'Effects', tip: 'coins, folds, grades, orders, resets', preview: 'coin' },
  { k: 'amb', name: 'Ambience', tip: 'machines, belts, modules, skiffs', preview: null },
  { k: 'ui', name: 'Interface', tip: 'clicks, pages, refusals', preview: 'click' },
];

/** the slider being dragged */
let drag: keyof Vol | null = null;

/** The four volume sliders, two to a row, from (x, y) across `w`; returns the height used. */
export function volumeRows(app: App, x: number, y: number, w: number): number {
  const ui = app.ui;
  const gap = 16;
  const cw = Math.floor((w - gap) / 2);
  const lw = Math.max(...SLIDERS.map((s) => textWidth(s.name))) + 6;
  const pw = textWidth('100%') + 4;
  const down = ui.input.mouse.down[0];
  if (!down && drag) {
    const s = SLIDERS.find((q) => q.k === drag);
    if (s?.preview) app.audio.sfx(s.preview, 0.8);
    drag = null;
  }
  SLIDERS.forEach((s, i) => {
    const cx = x + (i % 2) * (cw + gap), cy = y + Math.floor(i / 2) * 20;
    const bx = cx + lw, bw = cw - lw - pw, bh = 6, by = cy + 5;
    const v = app.audio.vol[s.k];
    const off = app.muted;
    ui.text(s.name, cx, cy + 4, off ? T.inkSoft : T.ink);
    // the hit area is taller than the trough, so a slider is easy to catch
    const hov = ui.hover(bx - 3, cy, bw + 6, 17);
    ui.mark('vol:' + s.k, bx, cy, bw, 17);
    ui.region(bx - 3, cy, bw + 6, 17, 'panel');
    if (hov && ui.clicked) { ui.eat(); drag = s.k; }
    if (drag === s.k && down) {
      const nv = Math.round(Math.max(0, Math.min(1, (ui.mx - bx) / bw)) * 20) / 20;
      if (nv !== v) app.audio.applySettings({ [s.k]: nv });
    }
    const cur = app.audio.vol[s.k];
    meter(ui, bx, by, bw, bh, cur, { col: off ? T.paperEdge : s.k === 'master' ? T.coinFill : T.goodFill, glint: false });
    // the knob: an ink post with a lit top
    const kx = Math.round(bx + (bw - 3) * cur);
    ui.ctx.fillStyle = T.ink;
    ui.ctx.fillRect(kx, by - 2, 3, bh + 4);
    ui.ctx.fillStyle = hov || drag === s.k ? T.paperHi : T.paper;
    ui.ctx.fillRect(kx + 1, by - 1, 1, bh + 2);
    ui.text(`${Math.round(cur * 100)}%`, cx + cw, cy + 4, off ? T.inkSoft : T.ink, { align: 'right' });
    if (hov) ui.tip([{ text: `{big:${s.name}}` }, { text: s.tip }, { text: off ? '{k:LMB} drag · {soft:sound is off}' : '{k:LMB} drag' }]);
  });
  return 40;
}
