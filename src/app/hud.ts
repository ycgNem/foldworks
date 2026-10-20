// The HUD, drawn every frame with the immediate-mode kit in UI pixels: the top bar (coin, rate,
// research, panels), the build bar, the next goal, toasts, refusals, the hover report and the
// title screen. Reads the App and the Game; changes the game only through App.act.
import { C, rgba } from '../data/palette';
import { BUILD, BUILD_BAR, UPGRADES } from '../data/machines';
import { RESEARCH } from '../data/research';
import { TITLE } from '../game-info';
import { ICON, textWidth } from '../ui/font';
import { sheet, itemIcon } from '../render/sprites';
import { report } from '../sim/analysis';
import { researchFrac } from '../sim/systems/research';
import { nextGoal } from './goals';
import { drawPanel, PANEL_W } from './panels';
import type { App } from './app';

export interface HudState {
  /** the coin number shown, counting up toward the real value */
  coinShown: number;
  coinBump: number;
  hoverTile: { x: number; y: number } | null;
}

const TOP_H = 22;
const BAR_H = 38;

export function drawHud(app: App, dt: number) {
  const ui = app.ui;
  const g = app.game;
  topBar(app, dt);
  buildBar(app);
  goalLine(app);
  if (app.panel) drawPanel(app);
  else if (app.selected) {
    const e = g.byId.get(app.selected);
    if (e) reportPanel(app, e.id);
    else app.selected = null;
  }
  toasts(app, dt);
  hoverReport(app);
  refusal(app, dt);
  // where the coins fly to
  app.renderer.coinTarget = { x: 12 * ui.scale, y: 11 * ui.scale };
}

// ------------------------------------------------------------------ top bar

function topBar(app: App, dt: number) {
  const ui = app.ui;
  const g = app.game;
  ui.panel(0, 0, ui.w, TOP_H, 'dark');
  // the coin counter rolls up toward the real amount and bumps on each sale
  const real = g.s.coin.toNumber();
  const h = app.hud;
  if (!isFinite(real) || real > 1e12 || Math.abs(real - h.coinShown) > 1e9) h.coinShown = real;
  else h.coinShown += (real - h.coinShown) * Math.min(1, dt * 10);
  if (Math.abs(real - h.coinShown) < 0.5) h.coinShown = real;
  h.coinBump = Math.max(0, h.coinBump - dt * 5);
  const shown = real > 1e12 ? g.s.coin.format() : g.s.coin.sub(Math.round(real - h.coinShown)).format();
  const bump = h.coinBump > 0.5 ? 1 : 0;
  ui.text(ICON.coin, 5, 4 - bump, C.gold, { scale: 2, shadow: C.ink });
  const cw = ui.text(shown, 19, 4 - bump, C.gold, { scale: 2, shadow: C.ink });
  const rate = g.incomePerMin();
  const rateText = rate > 0 ? `+${fmtRate(rate)}/min` : '';
  if (rateText) ui.text(rateText, 23 + cw, 9, C.tan);
  ui.hint(0, 0, 23 + cw + textWidth(rateText), TOP_H, [{ text: 'Coin. Spent on machines, belts and land.' }, { text: 'The rate is the last minute\'s earnings.', color: C.fog }]);

  // right side: panels and sound
  let x = ui.w - 4;
  const btn = (id: string, label: string, w: number, active: boolean, tip: string, hot = false) => {
    x -= w;
    const r = ui.button(id, x, 3, w, 16, label, { active, tip, accent: hot ? C.rust : undefined });
    x -= 3;
    return r;
  };
  if (btn('mute', app.muted ? 'x' : ICON.bolt, 14, app.muted, app.muted ? 'Sound off (M)' : 'Sound on (M)')) { app.muted = !app.muted; app.audio.setMuted(app.muted); }
  if (btn('help', '?', 14, app.panel === 'help', 'Help and keys (?)')) app.togglePanel('help');
  const offered = g.s.orders.active ? 0 : 1;
  if (btn('orders', ICON.crate + ' Orders', 50, app.panel === 'orders', 'Mayor Bramble\'s orders (O). The Dock fills the active one first.', offered > 0 && !g.flag('ordersSeen'))) app.togglePanel('orders');
  if (btn('research', ICON.flask + ' Research', 58, app.panel === 'research', 'Research (T): items delivered to the Hopper.')) app.togglePanel('research');
  // the selected research's progress, between the coin and the buttons
  const sel = g.s.research.selected;
  const midW = 120;
  const mx = Math.max(23 + cw + textWidth(rateText) + 8, Math.min(x - midW - 6, Math.floor(ui.w / 2 - midW / 2)));
  if (mx + midW < x - 2) {
    if (sel) {
      const f = researchFrac(g, sel);
      ui.text(ICON.flask, mx, 4, C.ice);
      ui.text(RESEARCH[sel].name, mx + 9, 3, C.bone);
      ui.bar(mx + 9, 13, midW - 9, 5, f, C.ice);
    } else if (g.s.research.done.length < 10) {
      ui.text(ICON.flask + ' no research picked', mx, 7, C.fog);
    }
  }
}

function fmtRate(v: number) {
  if (v < 1000) return String(Math.round(v));
  if (v < 1e6) return (v / 1000).toFixed(1) + 'K';
  return (v / 1e6).toFixed(2) + 'M';
}

// ------------------------------------------------------------------ build bar

function buildBar(app: App) {
  const ui = app.ui;
  const g = app.game;
  const y = ui.h - BAR_H;
  ui.panel(0, y, ui.w, BAR_H, 'dark');
  const slotW = 34;
  let x = 4;
  BUILD_BAR.forEach((kind, i) => {
    const d = BUILD[kind];
    const unlocked = g.unlocked(kind);
    const active = app.mode.k === 'build' && app.mode.kind === kind;
    const afford = g.s.coin.gte(d.cost) || (kind === 'crate' && g.s.freeCrates > 0);
    const hov = ui.hover(x, y + 3, slotW - 2, BAR_H - 6);
    ui.fill(x, y + 3, slotW - 2, BAR_H - 6, C.ink);
    ui.fill(x + 1, y + 4, slotW - 4, BAR_H - 8, active ? C.clay : hov && unlocked ? C.iron : C.slate);
    if (active) ui.fill(x + 1, y + 4, slotW - 4, 1, C.tan);
    const s = sheet(kind);
    if (unlocked) {
      ui.ctx.globalAlpha = afford ? 1 : 0.45;
      ui.ctx.drawImage(s.frames[0], x + 8, y + 5);
      ui.ctx.globalAlpha = 1;
      ui.text(String(i + 1), x + 3, y + 5, C.fog);
      const cost = kind === 'crate' && g.s.freeCrates > 0 ? 'free' : String(d.cost);
      ui.text(cost, x + slotW / 2 - 1, y + 23, afford ? C.gold : C.pipRed, { align: 'center' });
    } else {
      ui.text(ICON.lock, x + slotW / 2 - 3, y + 11, C.steel);
    }
    if (hov) {
      ui.tip(unlocked
        ? [{ text: `${d.name} (${i + 1}): ${d.cost} coin`, color: C.gold }, { text: d.blurb }, { text: 'R rotates. Right-click cancels.', color: C.fog }]
        : [{ text: d.name, color: C.fog }, { text: `Locked: research ${RESEARCH[d.unlock!].name}` }], 200);
      if (ui.clicked) {
        ui.eat();
        app.pickBuild(kind);
      }
    }
    ui.block(x, y + 3, slotW - 2, BAR_H - 6);
    x += slotW;
  });
  x += 4;
  // tools
  if (ui.button('rotate', x, y + 5, 30, 13, 'R ' + ['>', 'v', '<', '^'][app.rot], { tip: 'Rotate (R): what you place next, or the machine under the mouse.' })) app.rot = ((app.rot + 1) % 4) as 0;
  if (ui.button('remove', x, y + 20, 30, 13, 'X del', { active: app.mode.k === 'remove', tip: 'Remove (X): full refund.', accent: C.rust })) app.setMode(app.mode.k === 'remove' ? { k: 'idle' } : { k: 'remove' });
  x += 34;
  // the Bellows, until bought: the first purchase (DESIGN.md §6)
  if (!g.has('bellows')) {
    const u = UPGRADES.bellows;
    const can = g.s.coin.gte(u.cost);
    const pulse = can && Math.floor(ui.time * 3) % 2 === 0;
    if (x + 92 <= ui.w) {
      if (ui.button('bellows', x, y + 5, 92, 28, '', { disabled: !can, active: pulse, accent: C.rust, tip: [{ text: `Bellows: ${u.cost} coin`, color: C.gold }, { text: u.blurb }] })) app.act({ k: 'upgrade', id: 'bellows' });
      ui.text('Bellows', x + 46, y + 9, can ? C.bone : C.fog, { align: 'center', shadow: C.ink });
      ui.text(ICON.coin + ' ' + u.cost, x + 46, y + 20, can ? C.gold : C.fog, { align: 'center', shadow: C.ink });
    }
  } else if (g.s.freeCrates > 0 && x + 92 <= ui.w) {
    ui.text(`${g.s.freeCrates} free crate${g.s.freeCrates > 1 ? 's' : ''}`, x + 2, y + 15, C.lime);
  }
}

// ------------------------------------------------------------------ goal line and toasts

function goalLine(app: App) {
  const ui = app.ui;
  const goal = nextGoal(app.game);
  if (!goal) return;
  const y = ui.h - BAR_H - 14;
  const w = Math.min(ui.w - 8 - (app.panel || app.selected ? PANEL_W + 4 : 0), textWidth(goal.text) + 22);
  ui.fill(4, y, w, 12, C.ink, 0.8);
  ui.fill(4, y, 2, 12, C.amber);
  ui.text(ICON.right, 9, y + 2, C.amber);
  ui.clip(4, y, w, 12);
  ui.text(goal.text, 17, y + 2, C.bone);
  ui.unclip();
  // point at the tile it names
  if (goal.tile) {
    const s = app.renderer.toScreen(goal.tile.x + 0.5, goal.tile.y);
    const bob = Math.round(Math.sin(ui.time * 6) * 2);
    const ux = Math.round(s.x / ui.scale), uy = Math.round(s.y / ui.scale) - 10 + bob;
    if (uy > TOP_H + 2 && uy < ui.h - BAR_H - 20) ui.text(ICON.down, ux - 2, uy, C.amber, { shadow: C.ink });
  }
}

function toasts(app: App, dt: number) {
  const ui = app.ui;
  let y = TOP_H + 4;
  for (const t of app.toasts) t.t += dt;
  app.toasts = app.toasts.filter((t) => t.t < t.life);
  for (const t of app.toasts) {
    const w = Math.min(300, ui.w - 16);
    const x = Math.floor(ui.w / 2 - w / 2);
    // slide in from above, fade out at the end
    const k = Math.min(1, t.t * 6);
    const lines = wrap(t.text, w - 16);
    const h = 16 + lines.length * 10;
    const yy = Math.round(y - (1 - k) * 12);
    ui.ctx.globalAlpha = Math.min(1, (t.life - t.t) * 2);
    ui.fill(x + 2, yy + 2, w, h, C.ink, 0.5);
    ui.panel(x, yy, w, h, 'raised', false);
    ui.fill(x + 1, yy + 1, 3, h - 2, t.color);
    ui.text(t.title, x + 9, yy + 4, t.color, { shadow: C.ink });
    lines.forEach((l, i) => ui.text(l, x + 9, yy + 14 + i * 10, C.bone));
    ui.ctx.globalAlpha = 1;
    y += h + 3;
  }
}

function wrap(s: string, w: number): string[] {
  const out: string[] = [];
  let line = '';
  for (const word of s.split(' ')) {
    const t = line ? line + ' ' + word : word;
    if (textWidth(t) > w && line) { out.push(line); line = word; } else line = t;
  }
  if (line) out.push(line);
  return out;
}

function refusal(app: App, dt: number) {
  const r = app.refusal;
  if (!r) return;
  r.t -= dt;
  if (r.t <= 0) { app.refusal = null; return; }
  const ui = app.ui;
  const w = textWidth(r.text) + 8;
  const x = Math.max(2, Math.min(ui.w - w - 2, ui.mx - w / 2)), y = Math.max(TOP_H + 2, ui.my - 22);
  ui.ctx.globalAlpha = Math.min(1, r.t * 3);
  ui.fill(x, y, w, 12, C.ink, 0.9);
  ui.fill(x, y + 11, w, 1, C.pipRed);
  ui.text(r.text, x + 4, y + 2, C.bone);
  ui.ctx.globalAlpha = 1;
}

// ------------------------------------------------------------------ the hover report

const TONE: Record<string, string> = { good: C.pipGreen, warn: C.pipYellow, bad: C.pipRed, dim: C.fog, plain: C.bone };

function hoverReport(app: App) {
  const ui = app.ui;
  const h = app.hud.hoverTile;
  if (!h || app.mode.k !== 'idle' || ui.tooltip) return;
  const g = app.game;
  const e = g.entAt(h.x, h.y);
  const spark = g.s.sparks.find((p) => p.x === h.x && p.y === h.y);
  if (spark) {
    ui.tip([{ text: spark.kind === 'vein' ? 'Lucky Vein' : 'Inspector', color: C.gold }, { text: spark.kind === 'vein' ? "Click: this patch's miners run 3x for 60 s." : 'Click: they grade this line and pay 60 s of its output x the grade.' }], 190);
    return;
  }
  if (!e) {
    if (!g.owned(h.x, h.y)) {
      const ch = g.chunkAt(h.x, h.y)!;
      const ready = !ch.requires || g.done(ch.requires);
      ui.tip([{ text: ch.name, color: C.gold }, { text: ready ? `Click to buy: ${ch.cost.toLocaleString('en-US')} coin` : `Research ${RESEARCH[ch.requires!].name} first` }], 170);
    } else if (g.oreAt(h.x, h.y)) {
      ui.tip([{ text: g.oreAt(h.x, h.y) === 'ironOre' ? 'Iron ore' : 'Copper ore', color: C.ice }, { text: 'Click: 1 ore into a machine beside the patch. A Miner goes on it.' }], 180);
    }
    return;
  }
  if (app.selected === e.id) return;
  if (e.kind === 'dock') { ui.tip([{ text: 'The Dock', color: C.gold }, { text: BUILD.dock.blurb }, { text: 'Click for orders.', color: C.fog }], 170); return; }
  if (e.kind === 'hopper') { ui.tip([{ text: 'The Hopper', color: C.ice }, { text: BUILD.hopper.blurb }, { text: 'Click for research.', color: C.fog }], 170); return; }
  if (e.kind === 'belt') {
    ui.tip([{ text: 'Belt', color: C.bone }, { text: e.item ? `Carrying ${e.item.replace(/([A-Z])/g, ' $1').toLowerCase()}${e.mv ? '' : ' (stuck: what is ahead will not take it)'}` : 'Empty' }], 180);
    return;
  }
  if (e.kind === 'heap') { ui.tip([{ text: 'Slag Heap', color: C.violet }, { text: `${e.count} / ${BUILD.heap.capacity} slag. Empties out its front into a belt or a brick press.` }], 180); return; }
  if (e.kind === 'crate') { ui.tip([{ text: 'Buffer Crate', color: C.tan }, { text: `${e.store.length} / ${BUILD.crate.capacity}` }], 150); return; }
  const lines = report(g, e);
  if (lines.length) ui.tip([...lines.map((l) => ({ text: l.text, color: TONE[l.tone] })), { text: 'Click to pin this report.', color: C.steel }], 220);
}

function reportPanel(app: App, id: number) {
  const ui = app.ui;
  const g = app.game;
  const e = g.byId.get(id)!;
  const lines = report(g, e);
  if (!lines.length) { app.selected = null; return; }
  const w = PANEL_W;
  const x = ui.w - w - 4, y = TOP_H + 4;
  const wrapped: { text: string; color: string }[] = [];
  for (const l of lines) for (const t of wrap(l.text, w - 14)) wrapped.push({ text: t, color: TONE[l.tone] });
  const h = 26 + wrapped.length * 10;
  ui.panel(x, y, w, h, 'dark');
  const s = sheet(e.kind);
  ui.ctx.drawImage(s.frames[0], x + 4, y + 4);
  ui.text(wrapped[0].text, x + 24, y + 8, C.gold);
  wrapped.slice(1).forEach((l, i) => ui.text(l.text, x + 6, y + 24 + i * 10, l.color));
  if (ui.button('closeReport', x + w - 14, y + 3, 11, 11, 'x', { tip: 'Close (Esc)' })) app.selected = null;
  void itemIcon;
}

// ------------------------------------------------------------------ title

export function drawTitle(app: App) {
  const ui = app.ui;
  const t = ui.time;
  // a belt of items crossing the screen under the title
  const by = Math.floor(ui.h / 2) + 4;
  const belt = sheet('belt');
  for (let x = -16; x < ui.w + 16; x += 16) ui.ctx.drawImage(belt.frames[Math.floor(t * 8) % belt.frames.length], x, by);
  const items = ['ironOre', 'ironIngot', 'ironPlate', 'gear', 'copperWire', 'gizmo'];
  for (let i = 0; i < 12; i++) {
    const x = ((t * 32 + i * 48) % (ui.w + 64)) - 32;
    ui.ctx.drawImage(itemIcon(items[i % items.length]), Math.round(x), by + 4);
  }
  // the title, with a fold line across it that shimmers
  const sc = Math.max(3, Math.min(6, Math.floor(ui.w / 90)));
  const ty = Math.floor(ui.h / 2) - 26 - sc * 9;
  ui.text(TITLE.toUpperCase(), Math.floor(ui.w / 2), ty, C.gold, { scale: sc, align: 'center', shadow: C.rust });
  const fw = textWidth(TITLE.toUpperCase()) * sc;
  const shimmer = Math.floor(((t * 0.5) % 1.6) * fw);
  ui.fill(Math.floor(ui.w / 2 - fw / 2), ty + Math.floor(sc * 4.5), fw, 1, C.cream, 0.5);
  if (shimmer < fw) ui.fill(Math.floor(ui.w / 2 - fw / 2) + shimmer, ty - 2, 3, sc * 9 + 4, C.bone, 0.35);
  ui.text('Build a line. Fold it into a tile. Build with what you folded.', Math.floor(ui.w / 2), ty + sc * 9 + 8, C.tan, { align: 'center' });
  // buttons
  const bw = 120, bx = Math.floor(ui.w / 2 - bw / 2);
  let y = by + 30;
  if (app.titleInfo.hasSave) {
    if (ui.button('continue', bx, y, bw, 18, 'Continue', { active: true })) { app.audio.unlock(); app.continueGame(); }
    ui.text(`${ICON.coin} ${app.titleInfo.coin}`, bx + bw + 6, y + 5, C.gold);
    y += 22;
  }
  if (ui.button('new', bx, y, bw, 18, app.titleInfo.hasSave ? 'New game' : 'Start', { active: !app.titleInfo.hasSave })) { app.audio.unlock(); app.newGame(); }
  ui.text('A frog mayor wants Gizmos. Nobody knows what they do.', Math.floor(ui.w / 2), ui.h - 16, C.steel, { align: 'center' });
  void rgba;
}
