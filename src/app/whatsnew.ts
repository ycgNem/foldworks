// "What's new": the patch notes in the game (the playability update, 2026-11-08). Shown once to a
// returning player on Continue (after any offline letter), never on a first game, and again from
// Options. The full notes are docs/patch-notes.md; this card keeps to what a player will notice.
import { registerScreen } from './screens';
import { C } from '../data/palette';
import { T } from '../ui/theme';
import { layoutRich, drawLayout } from '../ui/rich';
import { button } from './chrome';
import { speak } from './ledger';
import { patchSeen, savePatchSeen } from './settings';
import { PATCH_ID, PATCH_NAME, WHATS_NEW } from './patch';
import type { App } from './app';
import type { Layout } from './layout';

let pending = false;

/** On Continue: show the card once this update, after the offline letter if there is one. */
export function queueWhatsNew() {
  if (patchSeen() !== PATCH_ID) pending = true;
}

/** Each frame: open the queued card once nothing else is open. */
export function whatsNewFrame(app: App) {
  if (!pending || app.screen !== 'play' || app.panel || app.offlineJob) return;
  pending = false;
  app.panel = 'whatsnew';
}

/** A new game has nothing to compare against: it never shows the card for this update. */
export function markWhatsNewSeen() {
  pending = false;
  savePatchSeen(PATCH_ID);
}

registerScreen('whatsnew', (app: App, _r, L: Layout) => {
  const ui = app.ui;
  const O = L.overlay;
  ui.fill(0, 0, ui.w, ui.h, C.ink, 0.6);
  const w = Math.min(400, O.w - 12);
  const inner = w - 16;
  const lines = WHATS_NEW.map((s) => layoutRich(s, inner - 8));
  const body = lines.reduce((a, l) => a + l.h + 3, 0);
  const h = Math.min(O.h - 8, 58 + body + 26);
  const x = O.x + Math.floor((O.w - w) / 2), y = O.y + Math.floor((O.h - h) / 2);
  ui.panel(x, y, w, h, 'paper', true);
  let yy = y + 6;
  yy += speak(app, 'bramble', `{big:${PATCH_NAME}}  Ribbit! Things changed while you were away. The good kind!`, x + 8, yy, inner, { size: 24, cheer: true }) + 6;
  for (const L2 of lines) {
    if (yy + L2.h > y + h - 24) break;
    ui.fill(x + 10, yy + 3, 2, 2, T.inkSoft);
    drawLayout(ui, L2, x + 16, yy, T.ink);
    yy += L2.h + 3;
  }
  if (button(ui, 'whatsNewOk', x + w - 128, y + h - 22, 120, 17, 'Back to work', { gold: true })) {
    savePatchSeen(PATCH_ID);
    app.panel = null;
  }
});
