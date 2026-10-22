// Unit 7's ending (DESIGN.md §24, Milestone 11's screens): the Codex's last page, opened by the
// first Last Fold, gets its own moment instead of a list row. Once the Last Fold's sequence and the
// Kernel tree are closed (the first time the floor is back with nothing open), the night sky fills
// the screen: Unit 7 at the top, the World it logged as the last specimen pinned on a mount, and its
// five lines typed out one by one in its capitals; then LOGGED is stamped over the mount and a new
// empty drawer slides out under it. "Onward" closes it; "Read it in the Codex" opens the page. The
// Codex's Lore keeps a key to see it again. Presentation only.
import { C, rgba } from '../data/palette';
import { CODEX_PAGES } from '../data/codex';
import { pageOpen } from '../sim/longtail';
import { bigWidth, wrapText, LINE_H } from '../ui/font';
import { sheet } from '../render/sprites';
import { button, portrait, pushpin, stamp } from './chrome';
import { registerScreen } from './screens';
import { lastFoldPlaying } from './lastfold';
import { codexTab } from './codexbook';
import { endingState, openEnding } from './endingstate';
import type { Game } from '../sim/Game';
import type { App } from './app';

const END = CODEX_PAGES.find((p) => p.id === 'ending');

const st = endingState;
const watch = { game: null as Game | null, open: false, pending: false };

export { openEnding };

/** Once a frame: the page opening in this game (not a save loaded with it open) queues the moment,
 * which waits until the floor is back with nothing open. */
export function endingWatch(app: App) {
  if (!END || app.screen !== 'play') return;
  const g = app.game;
  const open = pageOpen(g, END);
  if (watch.game !== g) { watch.game = g; watch.open = open; return; }
  if (open && !watch.open) watch.pending = true;
  watch.open = open;
  if (watch.pending && !app.panel && !lastFoldPlaying(app) && !app.offlineJob) {
    watch.pending = false;
    openEnding(app);
  }
}

/** Seconds per character as the lines type out, and the pause before the first. */
const CPS = 42;
const LEAD = 1.2;

registerScreen('ending', (app) => {
  const ui = app.ui;
  const ctx = ui.ctx;
  const W = ui.w, H = ui.h;
  const t = ui.time - st.at;
  ui.region(0, 0, W, H, 'panel', true);
  // the night: ink at the top to slag violet at the foot, in bands
  const bands = 12;
  for (let i = 0; i < bands; i++) {
    const f = i / (bands - 1);
    ctx.fillStyle = f < 0.5 ? rgba(C.ink, 1) : C.ink;
    ctx.fillRect(0, Math.floor((i * H) / bands), W, Math.ceil(H / bands) + 1);
    ctx.fillStyle = rgba(C.violet, 0.04 + 0.16 * f * f);
    ctx.fillRect(0, Math.floor((i * H) / bands), W, Math.ceil(H / bands) + 1);
  }
  // stars, fixed places, twinkling
  for (let i = 0; i < 140; i++) {
    const sx = Math.floor(((Math.sin(i * 91.7) * 43758.5) % 1 + 1) % 1 * W);
    const sy = Math.floor(((Math.sin(i * 17.3 + 4) * 12543.1) % 1 + 1) % 1 * H);
    const tw = 0.35 + 0.65 * Math.abs(Math.sin(ui.time * (0.6 + (i % 7) * 0.2) + i));
    ctx.fillStyle = rgba(i % 9 === 0 ? C.lamp3 : C.bone, tw * (i % 3 === 0 ? 0.9 : 0.5));
    ctx.fillRect(sx, sy, i % 11 === 0 ? 2 : 1, i % 11 === 0 ? 2 : 1);
  }
  const lines = END?.lines ?? [];
  const colW = Math.min(380, W - 40);
  const cx = Math.floor(W / 2);
  const x0 = cx - Math.floor(colW / 2);
  // the head: Unit 7 and the last specimen side by side, the title under them
  let y = 12;
  const bob = Math.floor(ui.time * 1.5) % 4 === 0 ? 1 : 0;
  const tall = H >= 330;
  if (tall) {
    portrait(ui, 'unit7', cx - 54, y + bob, 48);
    // the mount: the World, folded into the Seed, pinned
    ui.fill(cx + 8, y + 4, 40, 40, C.bone);
    ui.fill(cx + 9, y + 5, 38, 38, C.ink1);
    const seed = sheet('seed');
    const img = seed.rows ? seed.rows[0][0] : seed.frames[0];
    if (img) ctx.drawImage(img, cx + 12, y + 8, 32, 32);
    pushpin(ui, cx + 28, y + 5);
    y += 54;
  } else {
    portrait(ui, 'unit7', x0, y + bob, 24);
    y += 2;
  }
  const title = 'Collection Complete';
  const sc = bigWidth(title) * 2 <= colW ? 2 : 1;
  ui.big(title, cx, y, C.lamp3, { align: 'center', scale: sc, shadow: C.ink });
  y += sc === 2 ? 26 : 15;
  ui.small("UNIT 7'S LAST PAGE", cx, y, C.teal, { align: 'center' });
  y += 12;
  // the lines, typed out
  const typed = st.skip ? Infinity : Math.max(0, (t - LEAD) * CPS);
  let used = 0;
  const lineH = LINE_H;
  const footY = H - 26;
  let done = true;
  for (const s of lines) {
    const n = Math.max(0, Math.min(s.length, Math.floor(typed - used)));
    used += s.length + 12;
    if (n < s.length) done = false;
    if (n <= 0) break;
    const wrapped = wrapText(s, colW);
    const wantH = wrapped.length * lineH;
    if (y + wantH > footY - 4) break;
    // draw the typed part: the wrapped lines, cut at n characters
    let left = n;
    for (const wl of wrapped) {
      if (left <= 0) break;
      const part = wl.slice(0, left);
      ui.text(part, x0, y, C.bone, { shadow: C.ink });
      left -= wl.length + 1;
      y += lineH;
    }
    y += 4;
  }
  // the stamp and the new drawer, once every line is out
  if (done && tall) {
    if (!st.stamped) { st.stamped = true; app.audio.sfx('milestone', 0.6); }
    stamp(ui, 'LOGGED', cx + 28, 40, { angle: -0.2, alpha: 0.95 });
  } else if (done && !st.stamped) { st.stamped = true; app.audio.sfx('milestone', 0.6); }
  // the keys along the foot
  const bw = 120;
  if (!done) {
    if (button(ui, 'endingSkip', cx - 40, footY, 80, 17, 'Skip', { tip: 'show every line' })) st.skip = true;
  } else {
    if (button(ui, 'endingOnward', cx + 4, footY, bw, 17, 'Onward', { gold: true, icon: 'play', tip: [{ text: '{big:Onward}' }, { text: 'a new drawer, a new universe' }] })) { app.panel = null; app.audio.sfx('close'); }
    if (button(ui, 'endingCodex', cx - 4 - bw, footY, bw, 17, 'Read in the Codex', { icon: 'codex', tip: "{u:codex} the page in Unit 7's Codex" })) { codexTab('lore', 'ending'); app.panel = 'codex'; app.audio.sfx('open'); }
  }
});
