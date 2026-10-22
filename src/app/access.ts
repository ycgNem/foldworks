// Milestone 13's two Options rows: the HUD's scale (Auto, or a whole scale up to the largest the
// window takes, independent of the floor's zoom) and the lesson cards on or off. Both are kept
// with the settings (src/app/settings.ts); the scale applies at once (App.resize).
import { drawRich } from '../ui/rich';
import { button, rule, T } from './chrome';
import { lessonsOn, saveLessonsOn, saveUiScale, uiScaleSetting, maxUiScale, uiScaleFor } from './settings';
import type { App } from './app';

/** The scale picks a w x h canvas offers: 0 (Auto), then 1x up to the largest that fits. */
export function scalePicks(w: number, h: number): number[] {
  const max = maxUiScale(w, h);
  return [0, ...Array.from({ length: max }, (_, i) => i + 1)];
}

/** Step the HUD scale to the next pick and apply it. */
export function cycleUiScale(app: App) {
  const w = app.canvas.width, h = app.canvas.height;
  const picks = scalePicks(w, h);
  const cur = uiScaleSetting();
  const i = picks.indexOf(Math.min(cur, maxUiScale(w, h)));
  setUiScale(app, picks[(i + 1) % picks.length]);
}

/** Pick a HUD scale (0: Auto) and apply it now. */
export function setUiScale(app: App, v: number) {
  saveUiScale(v);
  app.resize();
}

/** The Options page's rows (the same look as its others: the name at the left, the control at the
 * right, ruled under). Returns the height used. */
export function accessRows(app: App, x: number, y: number, w: number): number {
  const ui = app.ui;
  const y0 = y;
  const row = (name: string, control: (bx: number, by: number) => void, cw: number) => {
    drawRich(ui, name, x, y + 4, Infinity, T.ink);
    control(x + w - cw, y);
    rule(ui, x, y + 20, w);
    y += 24;
  };
  const cw = app.canvas.width, ch = app.canvas.height;
  const pick = uiScaleSetting();
  const now = uiScaleFor(cw, ch);
  const max = maxUiScale(cw, ch);
  const text = pick ? `${Math.min(pick, max)}x` : `Auto {soft:${now}x}`;
  row('{u:stats} UI scale', (bx, by) => {
    if (button(ui, 'opt:uiScale', bx, by, 70, 17, text, { tip: [{ text: '{big:UI scale}' }, { text: `the HUD and pages, apart from the floor's zoom · up to ${max}x here` }, { text: '{k:LMB} next' }] })) cycleUiScale(app);
  }, 70);
  const on = lessonsOn();
  row('{u:codex} Lesson cards', (bx, by) => {
    if (button(ui, 'opt:lessons', bx, by, 50, 17, on ? 'on' : 'off', { active: on, tip: [{ text: '{big:Lesson cards}' }, { text: 'a card the first time each thing happens' }, { text: on ? '{k:LMB} off' : '{k:LMB} on' }] })) saveLessonsOn(!on);
  }, 50);
  return y - y0;
}
