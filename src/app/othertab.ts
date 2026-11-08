// One tab plays a save at a time (the playability review, 2026-11-08: a forgotten second tab kept
// autosaving every 30 s, hidden or not, and put a 9M town back to 1,000 coin). The tab that last
// started a game owns the save; any other tab stops writing, stops ticking and says so, with a
// button that takes the save back (a reload, so it continues from what the other tab wrote).
import { registerScreen } from './screens';
import { C } from '../data/palette';
import { T } from '../ui/theme';
import { layoutRich, drawLayout } from '../ui/rich';
import { button } from './chrome';
import type { App } from './app';
import type { Layout } from './layout';

const KEY = 'foldworks.owner';
/** this tab's id: when it was opened, and a few random letters */
const ME = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
let lost = false;

function read(): string | null {
  try { return localStorage.getItem(KEY); } catch { return null; }
}

/** This tab starts (or takes back) the save: every game swap calls it (App.adopt). */
export function claimSaves() {
  try { localStorage.setItem(KEY, ME); } catch { /* no storage: nothing to share either */ }
  lost = false;
}

/** May this tab write the save? False for good once another tab has claimed it. */
export function ownsSaves(): boolean {
  if (lost) return false;
  const v = read();
  if (v !== null && v !== ME) lost = true;
  return !lost;
}

/** Has another tab taken the save over? (the app keeps the card up while it has) */
export function savesLost(): boolean {
  return lost;
}

/** Hear another tab claim the save at once (the `storage` event fires in every other tab). */
export function watchOwner(app: App) {
  window.addEventListener('storage', (e) => {
    if (e.key !== KEY || !e.newValue || e.newValue === ME || lost) return;
    lost = true;
    if (app.screen === 'play') app.otherTab();
  });
}

registerScreen('otherTab', (app: App, _r, L: Layout) => {
  const ui = app.ui;
  const O = L.overlay;
  ui.fill(0, 0, ui.w, ui.h, C.ink, 0.7);
  const w = Math.min(300, O.w - 12), h = 92;
  const x = O.x + Math.floor((O.w - w) / 2), y = O.y + Math.floor((O.h - h) / 2);
  ui.panel(x, y, w, h, 'paper', true);
  const head = layoutRich('{bad:Foldworks is open in another tab}', w - 16);
  drawLayout(ui, head, x + 8, y + 8, T.ink);
  const body = layoutRich('This tab has stopped, so the two never write over each other\'s save. Play on in the other tab, or take the save back here.', w - 16);
  drawLayout(ui, body, x + 8, y + 10 + head.h, T.inkSoft);
  if (button(ui, 'otherTabBack', x + w - 128, y + h - 24, 120, 17, 'Play here instead', { gold: true })) {
    claimSaves();
    location.reload();
  }
});
