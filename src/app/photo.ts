// Photo mode (Milestone 11, DESIGN.md §24): the HUD steps aside so the floor can be looked at, and a
// labelled strip along the foot snaps the whole floor (not just the view) to a PNG at 1x or 2x,
// downloaded through a link. A white flash and a "Saved" note say it worked. Opened by the "Photo"
// key under the Purse (beside Stuck?) or the HUD key (H, "HUD on/off", which had no handler);
// Esc, H or Done leave it. The picture is src/render/photo.ts's. Presentation only.
import { C, rgba } from '../data/palette';
import { smallWidth, textWidth } from '../ui/font';
import { T } from '../ui/theme';
import { floorPhoto, bareOverlay } from '../render/photo';
import { button, slip } from './chrome';
import type { App } from './app';
import type { Game } from '../sim/Game';

const st = { on: false, flash: -10, saved: '', savedAt: -10, enteredAt: -10, game: null as Game | null };

export const photoOn = () => st.on;

export function setPhoto(app: App, on: boolean) {
  if (on === st.on) return;
  st.on = on;
  st.game = app.game;
  st.enteredAt = app.ui.time;
  if (on) { app.selected = null; app.fselected = null; app.setMode({ k: 'idle' }); }
  app.audio.sfx(on ? 'open' : 'close', 0.6);
}

/** The keys: H toggles, Esc leaves (once a frame, before the HUD). */
export function photoKeys(app: App) {
  const inp = app.input;
  // another game (a new one, a board, the town again) starts with the HUD up
  if (st.game !== app.game) { st.game = app.game; st.on = false; }
  if (app.screen !== 'play' || inp.typing) return;
  if (inp.wasPressed('hud') && !app.panel) { inp.consume('hud'); setPhoto(app, !st.on); return; }
  if (st.on && (app.panel || app.offlineJob)) { st.on = false; return; }
  if (st.on && inp.wasPressed('cancel')) { inp.consume('cancel'); setPhoto(app, false); }
}

/** The file name: the floor and the date and time, to the second. */
function fileName(app: App, k: number): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `foldworks-${app.floor}-${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}${k > 1 ? '@2x' : ''}.png`;
}

/** Snap the whole floor and download it. Returns the file name (or null when it failed). */
export function snap(app: App, k: 1 | 2): string | null {
  try {
    const cv = floorPhoto(app.renderer, app.game, bareOverlay(app.floor, app.high ?? 'district'), k);
    const name = fileName(app, k);
    const a = document.createElement('a');
    a.download = name;
    a.href = cv.toDataURL('image/png');
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    a.remove();
    st.flash = app.ui.time;
    st.saved = `${name} · ${cv.width}×${cv.height}`;
    st.savedAt = app.ui.time;
    (window as unknown as { __lastPhoto?: { name: string; w: number; h: number } }).__lastPhoto = { name, w: cv.width, h: cv.height };
    app.audio.sfx('place', 0.8, 1.6);
    return name;
  } catch (err) {
    console.error('photo failed', err);
    st.saved = 'the photo could not be made';
    st.savedAt = app.ui.time;
    return null;
  }
}

/** Photo mode's whole HUD: the strip along the foot, the flash, the note. */
export function photoHud(app: App) {
  const ui = app.ui;
  // the floor takes no clicks while the strip is up (a click would build under the hidden HUD)
  ui.region(0, 0, ui.w, ui.h, 'panel', true);
  const t = ui.time;
  // the flash: white, gone in 0.35 s
  const f = t - st.flash;
  if (f >= 0 && f < 0.35) ui.fill(0, 0, ui.w, ui.h, C.bone, (1 - f / 0.35) * 0.85);
  // the strip
  const label = 'PHOTO MODE';
  const bw1 = textWidth('Snap 1x') + 26, bw2 = textWidth('Snap 2x') + 26, bw3 = textWidth('Done') + 14;
  const w = 8 + smallWidth(label) + 8 + bw1 + 4 + bw2 + 4 + bw3 + 8;
  const h = 24;
  const x = Math.floor(ui.w / 2 - w / 2), y = ui.h - h - 6;
  const r = slip(ui, x, y, w, h, { blocking: true });
  ui.small(label, r.x, y + Math.floor((h - 5) / 2), T.reset);
  let bx = r.x + smallWidth(label) + 8;
  const by = y + 4;
  const tip = (k: number) => [{ text: `{big:Snap ${k}x}` }, { text: `the whole ${app.floor === 'workshop' ? 'Workshop' : app.floor} as a PNG, ${k} px a pixel` }, { text: '{soft:downloaded · no HUD in it}' }];
  if (button(ui, 'photoSnap1', bx, by, bw1, 16, 'Snap 1x', { icon: 'star', gold: true, tip: tip(1) })) snap(app, 1);
  bx += bw1 + 4;
  if (button(ui, 'photoSnap2', bx, by, bw2, 16, 'Snap 2x', { icon: 'star', tip: tip(2) })) snap(app, 2);
  bx += bw2 + 4;
  if (button(ui, 'photoDone', bx, by, bw3, 16, 'Done', { tip: 'back to the HUD {k:Esc}' })) setPhoto(app, false);
  // the note: what was saved
  const n = t - st.savedAt;
  if (st.saved && n < 3.5) {
    const s = `Saved ${st.saved}`;
    const nw = Math.min(ui.w - 20, textWidth(s) + 16);
    ui.ctx.globalAlpha = n > 3 ? (3.5 - n) * 2 : 1;
    const nr = slip(ui, Math.floor(ui.w / 2 - nw / 2), y - 22, nw, 18, { blocking: false });
    ui.clip(nr.x, nr.y - 2, nr.w, 12);
    ui.text(s, Math.floor(ui.w / 2), nr.y, T.good, { align: 'center' });
    ui.unclip();
    ui.ctx.globalAlpha = 1;
  }
  // a hint that fades: how to leave
  if (t - st.enteredAt < 2.5) {
    ui.ctx.globalAlpha = Math.min(1, (2.5 - (t - st.enteredAt)) * 2);
    ui.text('the HUD is hidden · Esc or H brings it back', Math.floor(ui.w / 2), 8, C.bone, { align: 'center', outline: C.ink });
    ui.ctx.globalAlpha = 1;
  }
  void rgba;
}

/** The labelled key under the Purse, beside Stuck? (the owner: core actions get a button). */
export function photoButton(app: App, x: number, y: number): number {
  const w = 44;
  if (button(app.ui, 'photoMode', x, y, w, 17, 'Photo', { tip: [{ text: '{big:Photo mode}' }, { text: 'hide the HUD · snap the whole floor to a PNG' }, { text: '{k:H}' }] })) setPhoto(app, true);
  return w;
}
