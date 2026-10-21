// The kit gallery (gallery.html, dev only): every piece of the 180's paper-and-ink kit on one
// canvas at 2x UI scale over the game's floor colours, so it can be judged by eye and screenshot
// (e2e/gallery.mjs). Scenes: ?scene=hud (the screen's pieces on the floor), kit (buttons, keys,
// chips, meters, ribbons, stamps), old (the pre-180 exports, remapped to paper, and every
// ui.panel style), book (the menu template), rich (rich text). The overlap audit runs on every
// frame; its findings are on window.__galleryIssues.
import { C, rgba } from './data/palette';
import { Input } from './engine/input';
import { UI } from './ui/ui';
import { findIssues, type AuditIssue } from './ui/audit';
import { loadArt, sheet, drawSprite, hasArt } from './render/sprites';
import { T } from './ui/theme';
import { drawRich, layoutRich, drawLayout, richWidth, CHIP_H } from './ui/rich';
import { textWidth, LINE_H, BIG_LINE_H } from './ui/font';
import { RIBBON_COLORS, bookmarkRaw, KEY_H, keycapWidth } from './ui/paper';
import {
  plate, frame, card, section, label, dot, badge, sparkline, coinIcon, portrait, button, bar, uiIcon,
  tag, tagSize, slip, clipboard, bubble, ribbon, sign, chip, chipWidth, keycapK, meter, stamp, book, rule, pencil,
} from './app/chrome';
import { menuTemplate, tab, cells, slamScale, rays, type MenuTab } from './app/widgets';
import type { App } from './app/app';

const canvas = document.getElementById('kit') as HTMLCanvasElement;
const ctx = canvas.getContext('2d')!;
const input = new Input();
input.attach(canvas);
const ui = new UI();
ui.audit = true;
const SCALE = 2;
const scene = new URLSearchParams(location.search).get('scene') ?? 'hud';
// what widgets.ts reads off the app (menuTemplate's linked tabs, icons, sounds)
const app = { ui, panel: 'orders', game: { done: () => true, s: { mega: { stage: 1 } } }, audio: { sfx: () => {} } } as unknown as App;

function resize() {
  canvas.width = Math.floor(window.innerWidth);
  canvas.height = Math.floor(window.innerHeight);
}
window.addEventListener('resize', resize);
resize();

// ---------------------------------------------------------------- the floor

/** The bayou and a plank deck, in the game's floor colours (STYLE.md: deck wood3-4, seams wood2). */
function floor(deck: { x: number; y: number; w: number; h: number } | null) {
  ctx.fillStyle = C.water1;
  ctx.fillRect(0, 0, ui.w, ui.h);
  ctx.fillStyle = C.water2;
  for (let y = 3; y < ui.h; y += 7) for (let x = (y * 13) % 23; x < ui.w; x += 31) ctx.fillRect(x, y, 5, 1);
  if (!deck) return;
  ctx.fillStyle = C.wood0;
  ctx.fillRect(deck.x - 1, deck.y - 1, deck.w + 2, deck.h + 3);
  for (let y = 0; y < deck.h; y += 8) {
    ctx.fillStyle = (y / 8) % 2 ? C.wood3 : C.wood4;
    ctx.fillRect(deck.x, deck.y + y, deck.w, 8);
    ctx.fillStyle = C.wood2;
    ctx.fillRect(deck.x, deck.y + y + 7, deck.w, 1);
    for (let x = ((y * 7) % 40) + 10; x < deck.w; x += 53) ctx.fillRect(deck.x + x, deck.y + y, 1, 7);
  }
}

/** A machine sprite at a UI point (1 world px = 1 UI px here). */
function sprite(name: string, x: number, y: number, f = 0) {
  if (!hasArt(name)) { ctx.fillStyle = C.steel2; ctx.fillRect(x, y, 16, 16); return; }
  drawSprite(ctx, sheet(name), f, x, y);
}

/** Draw with the mouse forced over (or pressing) a rect, for the buttons' states. */
function forced<R>(state: 'up' | 'hover' | 'down', x: number, y: number, f: () => R): R {
  const mx = ui.mx, my = ui.my, d = input.mouse.down[0];
  if (state === 'up') { ui.mx = -999; ui.my = -999; } else { ui.mx = x + 3; ui.my = y + 3; }
  input.mouse.down[0] = state === 'down';
  const r = f();
  ui.mx = mx; ui.my = my; input.mouse.down[0] = d;
  return r;
}

/** A small caption in ink on paper, or light over the floor. */
const cap = (s: string, x: number, y: number, onFloor = false) => (onFloor ? ui.text(s, x, y, T.floorText, { outline: T.floorOutline }) : label(ui, s, x, y));

// ---------------------------------------------------------------- scenes

function hud() {
  const deck = { x: 150, y: 64, w: 330, h: 230 };
  floor(deck);
  // a line on the deck: miner, furnace, belts to the Dock
  const ty = 168;
  sprite('miner', 254, ty, 0);
  sprite('furnace', 270, ty, Math.floor(ui.time * 8) % 4);
  for (let x = 286; x < 382; x += 16) sprite('belt', x, ty, Math.floor(ui.time * 16) % 4);
  sprite('dock', 382, ty - 16, 0);

  // the Purse: a plank on two ropes, the coin in the display face at 2x, gold with an ink outline
  const s = sign(ui, 8, 10, 118, 30, { ropeTop: 0 });
  coinIcon(ui, s.x + 2, s.y + 3);
  ui.big('1.58M', s.x + 22, s.y + 1, T.floorCoin, { scale: 2, outline: T.floorOutline });
  // the rate on a paper tag hanging under it
  const rate = '{coinc:+7.0K/min}';
  const ts = tagSize(richWidth(rate), LINE_H, 'top');
  const rt = tag(ui, 30, 50, ts.w, ts.h, { hole: 'top', anchor: { x: 30 + ts.w / 2, y: 40 } });
  drawRich(ui, rate, rt.x, rt.y);

  // a trophy ribbon from the top centre
  ribbon(ui, 250, 8, 140, 'First Fold!', { color: 'gold' });

  // a slip (a toast) at the top right, and the Inspector's clipboard on an audit box
  const sl = slip(ui, 492, 10, 140, 24);
  drawRich(ui, 'Bellows bought {coin:25}', sl.x, sl.y + 1);
  const cb = clipboard(ui, 500, 230, 120, 60);
  ui.big('Audit', cb.x, cb.y, T.ink);
  drawRich(ui, '{u:clock} 70 s  {chip:good:A}', cb.x, cb.y + 15);
  stamp(ui, 'A', cb.x + cb.w - 12, cb.y + 8, { angle: -0.15 });

  // the hover report: a tag on a string from the furnace (docs/hud-180.md, "Reports")
  report(300, 186, { x: 278, y: ty + 8 });

  // a pinned line tag at the Dock's mouth, and the Dock's own tag
  const lt = '{i:gear} 30/min';
  const ls = tagSize(richWidth(lt), LINE_H, 'left');
  const lr = tag(ui, 340, 120, ls.w, ls.h, { hole: 'left', pin: true });
  drawRich(ui, lt, lr.x, lr.y);
  const dt = '{coin} {coinc:+5.1K/min}';
  const ds = tagSize(Math.max(richWidth(dt), 70), LINE_H + 7, 'left');
  const dr = tag(ui, 424, 104, ds.w, ds.h, { anchor: { x: 398, y: ty - 6 } });
  drawRich(ui, dt, dr.x, dr.y);
  meter(ui, dr.x, dr.y + LINE_H + 2, dr.w, 5, 0.62, { role: 'good', target: 0.8 });

  // a coin pop over the floor
  const pop = (ui.time * 12) % 10;
  ui.big('+25', 470, ty - 24 - Math.round(pop), T.floorCoin, { outline: T.floorOutline });

  // Bramble's corner: the portrait on a lily pad, the goal in a speech bubble
  portrait(ui, 'bramble', 12, ui.h - 60, 48, { pad: true });
  const line = "She's choking! {k:LMB} shovel, or a {i:slag} Heap {coin:25}";
  const L = layoutRich(line, 230);
  const bw = L.w + 14, bh = L.h + 9;
  const b = bubble(ui, 72, ui.h - 52, bw, bh, { side: 'left', at: 12 });
  drawLayout(ui, L, b.x + 1, b.y);
}

/** The hover report laid out as docs/hud-180.md "Reports" draws it. */
function report(x: number, y: number, anchor: { x: number; y: number }, pin = false) {
  const rows = [
    '{chip:bad:CHOKED} slag has no way out',
    '{i:ironOre} → {i:ironIngot}  27/min',
    '',
    'in {i:ironOre} 30/min {soft:from} Miner',
    'side {i:slag} 1 per 4 → {bad:nowhere}',
    '{k:LMB} shovel  {k:R} turn  {k:X} sell',
  ];
  const cw = 176;
  const heights = rows.map((r) => (r ? layoutRich(r, cw).h : 9));
  const ch = BIG_LINE_H + 2 + heights.reduce((a, b) => a + b, 0) + 3 * (rows.length - 1);
  const sz = tagSize(cw, ch, 'left');
  const r = tag(ui, x, y, sz.w, sz.h, { anchor: pin ? null : anchor, pin, hole: 'left' });
  ui.big('Hand Furnace', r.x, r.y, T.ink);
  ui.ctx.drawImage(sheet('items').frames[2] ?? sheet('items').frames[0], r.x + r.w - 8, r.y + 1);
  rule(ui, r.x, r.y + BIG_LINE_H, r.w, true);
  let yy = r.y + BIG_LINE_H + 3;
  rows.forEach((row, i) => {
    if (!row) {
      // the rate bar: 27 of a 36 scale, its notch at the 30/min it makes when busy
      meter(ui, r.x, yy + 2, 100, 6, 27 / 36, { role: 'warn', target: 30 / 36 });
      ui.text('of 30/min', r.x + 106, yy, T.inkSoft);
    } else drawRich(ui, row, r.x, yy, cw);
    yy += heights[i] + 3;
  });
}

function kit() {
  floor({ x: 0, y: 0, w: ui.w, h: ui.h });
  // buttons in every state
  plate(ui, 6, 6, 314, 114);
  label(ui, 'buttons', 12, 11);
  const states = ['up', 'hover', 'down'] as const;
  let y = 20;
  for (const kind of ['paper', 'gold', 'active'] as const) {
    states.forEach((st, i) => {
      const x = 12 + i * 62;
      forced(st, x, y, () => button(ui, `b-${kind}-${st}`, x, y, 58, 16, st === 'up' ? 'Build' : st === 'hover' ? 'Hover' : 'Down', { gold: kind === 'gold', active: kind === 'active' }));
    });
    button(ui, `b-${kind}-dis`, 198, y, 58, 16, 'Locked', { disabled: true, gold: kind === 'gold' });
    label(ui, kind, 262, y + 6);
    y += 19;
  }
  forced('up', 12, y, () => button(ui, 'b-icon', 12, y, 74, 21, 'Research', { icon: 'research' }));
  forced('hover', 90, y, () => button(ui, 'b-gold-big', 90, y, 96, 21, 'Sign here', { gold: true, big: true }));
  forced('up', 190, y, () => button(ui, 'b-rich', 190, y, 120, 21, 'Buy {coin:25}', { gold: true }));
  y += 24;
  forced('up', 12, y, () => ui.button('ui-b', 12, y, 70, 16, 'ui.button'));
  forced('down', 86, y, () => ui.button('ui-b2', 86, y, 70, 16, 'pressed'));

  // keycaps and the mouse
  plate(ui, 326, 6, 308, 46);
  label(ui, 'keycaps', 332, 11);
  let kx = 332;
  for (const k of ['T', 'R', 'X', 'F', 'Q', 'Esc', 'Tab', 'Space', '1', 'LMB', 'RMB', 'WHEEL']) {
    keycapK(ui, k, kx, 20);
    kx += keycapWidth(k) + 5;
  }
  keycapK(ui, 'T', 332, 34, { down: true });
  drawRich(ui, '{k:LMB} shovel  {k:RMB} wheel  {k:T} research', 346, 35);

  // chips
  plate(ui, 326, 56, 308, 62);
  label(ui, 'chips', 332, 61);
  let cx = 332;
  const row1: [string, Parameters<typeof chip>[4]][] = [
    ['WORKING', { role: 'good' }], ['STARVED {i:ironOre} 2 short', { role: 'warn' }], ['CHOKED', { role: 'bad' }], ['NO POWER', { role: 'power', icon: 'power' }],
  ];
  for (const [t, o] of row1) cx += chip(ui, cx, 70, t, o) + 4;
  cx = 332;
  const row2: [string, Parameters<typeof chip>[4]][] = [
    ['BROWNOUT 82%', { role: 'warn', solid: true }], ['OVERDRIVE 3x 6s', { role: 'reset', solid: true }], ['FULL', { role: 'bad', solid: true }], ['COOLING 12s', { role: 'research' }],
  ];
  for (const [t, o] of row2) cx += chip(ui, cx, 86, t, o) + 4;
  cx = 332;
  for (const [t, o] of [['{coin:1.2K}', { role: 'coin' }], ['+3 Patents', { role: 'reset' }], ['{i:gear} 30/min', { role: 'ink' }]] as [string, Parameters<typeof chip>[4]][]) cx += chip(ui, cx, 102, t, o) + 4;

  // meters
  plate(ui, 6, 122, 200, 82);
  label(ui, 'meters', 12, 127);
  const m = (yy: number, f: number, o: Parameters<typeof meter>[6], s: string) => { meter(ui, 12, yy, 110, 7, f, o); drawRich(ui, s, 128, yy - 1); };
  m(139, 27 / 30, { role: 'good', target: 1 }, '27/30 {soft:target}');
  m(152, 27 / 36, { role: 'warn', target: 30 / 36 }, '{warn:27} of 30/min');
  m(165, 1, { role: 'bad' }, '{bad:FULL}');
  m(178, 0.42, { role: 'research', target: 0.6 }, '{research:42%}');
  bar(ui, 12, 191, 110, 5, 0.7, C.gold);
  ui.text('bar()', 128, 189, T.inkSoft);

  // ribbons and bookmarks
  plate(ui, 210, 122, 424, 82);
  label(ui, 'ribbons', 216, 127);
  RIBBON_COLORS.forEach((c, i) => ribbon(ui, 226 + i * 82, 138, 64, c, { color: c }));
  RIBBON_COLORS.forEach((c, i) => ribbon(ui, 220 + i * 82, 160, 72, c, { color: c, tails: 'in', big: false }));
  [...RIBBON_COLORS, 'paper' as const].forEach((c, i) => bookmarkRaw(ui.ctx, 220 + i * 26, 180, 18, 20, c));
  ui.text('bookmarks', 380, 186, T.inkSoft);

  // stamps
  plate(ui, 6, 208, 300, 146);
  label(ui, 'stamps and juice', 12, 213);
  stamp(ui, 'APPROVED', 80, 246);
  stamp(ui, 'PAID', 200, 240, { angle: 0.1, col: T.goodFill });
  const t = (ui.time % 2) - 0.3;
  ui.clip(8, 262, 140, 90);
  rays(app, 70, 306, 70, C.gold);
  ui.unclip();
  stamp(ui, 'S+', 70, 306, { scale: slamScale(Math.max(0.3, t), 2) });
  cells(app, 160, 280, 120, 8, 7, 10, C.moss3);
  sparkline(ui, 160, 296, 120, 20, [3, 4, 4, 6, 5, 7, 8, 8, 9, 12, 11, 13, 15, 14, 17, 18, 21], C.brass1);
  badge(ui, 160, 324, 'new');
  badge(ui, 190, 324, '3/5', C.gold);
  dot(ui, 226, 326);

  // the tag and bubble shapes, bare
  plate(ui, 310, 208, 324, 146);
  label(ui, 'tags and bubbles', 316, 213);
  tag(ui, 320, 228, 80, 30, { hole: 'left', anchor: { x: 316, y: 270 } });
  tag(ui, 410, 228, 80, 30, { hole: 'right', anchor: { x: 500, y: 290 } });
  tag(ui, 520, 236, 70, 30, { hole: 'top', anchor: { x: 555, y: 222 } });
  tag(ui, 320, 290, 80, 26, { hole: 'left', pin: true });
  bubble(ui, 420, 290, 70, 24, { side: 'bottom', at: 12 });
  bubble(ui, 520, 284, 70, 24, { side: 'bottom', at: 56 });
  bubble(ui, 430, 326, 60, 20, { side: 'left', at: 10 });
  bubble(ui, 520, 326, 60, 20, { side: 'right', at: 10 });
}

function old() {
  floor({ x: 0, y: 0, w: ui.w, h: ui.h });
  // the pre-180 exports, as they draw now
  plate(ui, 6, 6, 150, 40, { accent: C.gold });
  ui.text('plate() accent gold', 12, 14, C.bone);
  ui.text('light text passed in', 12, 26, C.hull2);
  frame(ui, 162, 6, 150, 70, 'wood');
  ui.text('frame(wood)', 172, 14, T.ink);
  frame(ui, 318, 6, 150, 40, 'paper');
  ui.text('frame(paper)', 326, 14, T.ink);
  frame(ui, 474, 6, 160, 40, 'inset');
  ui.text('frame(inset)', 482, 14, T.ink);
  const c = card(ui, 6, 82, 200, 90, 'Orders', C.leaf, 'orders');
  drawRich(ui, '{i:gear} 40 of 60 for Bramble', c.x, c.y);
  meter(ui, c.x, c.y + 14, c.w, 6, 40 / 60, { role: 'good' });
  const c2 = card(ui, 212, 82, 200, 90, 'Research', C.teal1);
  drawRich(ui, '{u:research} Bellows {research:62%}', c2.x, c2.y);
  section(ui, c2.x, c2.y + 14, c2.w, 40, C.teal1);
  ui.text('section()', c2.x + 4, c2.y + 18, T.ink);
  const c3 = card(ui, 418, 82, 216, 90, 'Patents', C.violet, 'patents');
  drawRich(ui, '{reset:+3 Patents} on Reorganize', c3.x, c3.y);
  label(ui, 'label() pip caps', c3.x, c3.y + 16);
  uiIcon(ui, 'patents', c3.x, c3.y + 28);
  uiIcon(ui, 'blueprint', c3.x + 20, c3.y + 28);
  uiIcon(ui, 'codex', c3.x + 40, c3.y + 28);
  uiIcon(ui, 'mode', c3.x + 60, c3.y + 28);

  // every ui.panel style
  label(ui, 'ui.panel styles', 8, 182);
  const styles = ['dark', 'raised', 'inset', 'paper', 'tag', 'bubble', 'ribbon'] as const;
  styles.forEach((s, i) => {
    const x = 8 + i * 89, y = 194;
    ui.panel(x, y, 80, s === 'ribbon' ? 13 : 30, s, true, s === 'tag' ? { anchor: { x: x + 4, y: y + 46 } } : s === 'bubble' ? { side: 'bottom', at: 14 } : { color: 'teal' });
    ui.text(s, x + (s === 'tag' ? 13 : 7), y + (s === 'ribbon' ? 3 : 6), s === 'ribbon' ? C.bone : T.ink);
  });
  ui.panel(8, 254, 150, 40, 'sign', true, { ropeTop: 236 });
  ui.text('sign', 20, 264, C.bone, { outline: C.ink });
  ui.panel(170, 240, 280, 112, 'book');
  ui.text('book', 186, 250, T.ink);

  // tabs (bookmarks) outside the book
  const tabs = ['Build', 'Upgrades', 'Power'];
  tabs.forEach((t, i) => tab(app, 't' + i, 462 + i * 56, 242, 52, 15, t, { active: i === 0, icon: i === 0 ? 'build' : undefined }));
  tab(app, 'tx', 462, 262, 52, 15, 'Locked', { disabled: true });
  tab(app, 'tb', 518, 262, 52, 15, 'Orders', { badge: '2' });
}

function bookScene() {
  floor({ x: 0, y: 0, w: ui.w, h: ui.h });
  const r = { x: 12, y: 10, w: ui.w - 24, h: ui.h - 20 };
  const { body, detail } = menuTemplate(app, r, { title: 'Orders', accent: C.leaf, icon: 'orders', detail: 200 });
  // the list: ruled rows, the selected one pencil-underlined
  const rows: { who: string; name: string; chip: [string, Parameters<typeof chip>[4]]; f: number; want: string }[] = [
    { who: 'bramble', name: 'Mayor Bramble', chip: ['ACTIVE', { role: 'good' }], f: 0.66, want: '{i:gear} 40/60  {i:ironPlate} 12/20' },
    { who: 'unit7', name: 'Unit 7', chip: ['CODEX', { role: 'research' }], f: 0.25, want: '{i:glass} 3/12' },
    { who: 'voltaire', name: 'Dame Voltaire', chip: ['LOCKED', { role: 'soft' }], f: 0, want: '{i:circuit} 0/40' },
    { who: 'committee', name: 'The Committee', chip: ['+3 PATENTS', { role: 'reset' }], f: 0.9, want: '{i:motor} 9/10' },
  ];
  let y = body.y + 4;
  rows.forEach((row, i) => {
    portrait(ui, row.who, body.x + 2, y + 1, 24);
    ui.big(row.name, body.x + 32, y + 2, T.ink);
    chip(ui, body.x + body.w - chipWidth(row.chip[0], row.chip[1]) - 2, y + 1, row.chip[0], row.chip[1]);
    drawRich(ui, row.want, body.x + 32, y + 15);
    meter(ui, body.x + 180, y + 17, 90, 5, row.f, { role: row.chip[1]?.role ?? 'good', target: 0.75 });
    if (i === 0) pencil(ui, body.x + 32, y + 13, 120, T.bad);
    rule(ui, body.x, y + 30, body.w);
    y += 34;
  });
  drawRich(ui, '{k:O} orders  {k:Esc} close  {k:WHEEL} scroll', body.x, body.y + body.h - 12, Infinity, T.inkSoft);
  if (!detail) return;
  // the right page: the selected order
  portrait(ui, 'bramble', detail.x + 4, detail.y + 4, 48);
  ui.big('Mayor Bramble', detail.x + 60, detail.y + 6, T.ink);
  drawRich(ui, '{soft:the town\'s standing order}', detail.x + 60, detail.y + 20);
  let dy = detail.y + 60;
  for (const [it, f, s] of [['gear', 40 / 60, '40/60'], ['ironPlate', 12 / 20, '12/20'], ['slagBrick', 1, '8/8']] as [string, number, string][]) {
    drawRich(ui, `{i:${it}}`, detail.x + 4, dy);
    meter(ui, detail.x + 16, dy + 1, 120, 6, f, { role: f >= 1 ? 'good' : 'warn', target: 1 });
    ui.text(s, detail.x + 142, dy, f >= 1 ? T.good : T.ink);
    dy += 14;
  }
  drawRich(ui, 'pays {coin:1.2K} and {chip:reset:+1 Patent}', detail.x + 4, dy + 4);
  forced('up', detail.x + 4, dy + 24, () => button(ui, 'deliver', detail.x + 4, dy + 24, 92, 20, 'Deliver', { gold: true, big: true }));
  stamp(ui, 'PAID', detail.x + 150, dy + 34, { angle: -0.2 });
}

function rich() {
  floor({ x: 0, y: 200, w: ui.w, h: 160 });
  plate(ui, 6, 6, 400, 186);
  label(ui, 'rich text on paper', 12, 11);
  const samples = [
    "She's choking! {k:LMB} shovel, or a {i:slag} Heap {coin:25}",
    '{i:ironOre} → {i:ironIngot}  27/min',
    'status {chip:bad:CHOKED} {chip:warn:STARVED} {chip:good:WORKING}',
    '{good:good} {bad:bad} {warn:warn} {coinc:coin} {research:research} {power:power} {reset:reset} {soft:soft}',
    '{big:Bullfrog title} beside body text {coin}',
    'unknown {foo:degrades} and {i:nope} to text, {unclosed',
    'Plain strings draw exactly as ui.text: 1,234/min',
  ];
  let y = 22;
  for (const s of samples) y += drawRich(ui, s, 12, y, 388) + 4;
  ui.text('Plain strings draw exactly as ui.text: 1,234/min', 12, y, T.ink);
  y += LINE_H + 2;
  // wrapping: keycaps and icons stay with the next word
  plate(ui, 412, 6, 222, 186);
  label(ui, 'wrapped to 96 px', 418, 11);
  const wrapS = 'A whole line in one tile? Show me! {k:F} fold, then {k:LMB} place it {i:gear} near the Dock';
  drawRich(ui, wrapS, 418, 24, 96);
  ui.ctx.fillStyle = rgba(T.bad, 0.4);
  ui.ctx.fillRect(418 + 96, 22, 1, 80);
  drawRich(ui, wrapS, 530, 24, 60);
  ui.ctx.fillRect(530 + 60, 22, 1, 120);
  // over the floor: light with an ink outline
  label(ui, 'floor text', 12, 210);
  drawRich(ui, '+5.1K/min {coin:25} {i:gear} 30/min {good:WORKING} {bad:CHOKED} {warn:82%}', 12, 222, Infinity, T.floorText, { floor: true });
  ui.big('+125', 12, 240, T.floorCoin, { outline: T.floorOutline, scale: 2 });
  ui.text('a tooltip is a tag on a string (below)', 200, 246, T.floorText, { outline: T.floorOutline });
  sprite('furnace', 300, 300, 0);
  // the tooltip: mouse over the furnace
  ui.mx = 308; ui.my = 308;
  ui.tip([{ text: '{big:Hand Furnace}' }, { text: '{chip:bad:CHOKED} slag has no way out' }, { text: '{k:LMB} shovel  {k:X} sell', color: C.hull2 }], 180, { avoid: [{ x: 300, y: 300, w: 16, h: 16 }] });
}

const SCENES: Record<string, () => void> = { hud, kit, old, book: bookScene, rich };

let last = performance.now();
let issues: AuditIssue[] = [];
function frameLoop(now: number) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  ui.begin(ctx, input, SCALE, dt, true);
  // the first audited frame is the one before; read its findings
  if (ui.lastAudit.length) issues = findIssues(ui.lastAudit, { w: ui.w, h: ui.h });
  (SCENES[scene] ?? hud)();
  ui.end();
  input.endFrame();
  (window as unknown as { __galleryIssues: AuditIssue[] }).__galleryIssues = issues;
  (window as unknown as { __galleryRecs: number }).__galleryRecs = ui.lastAudit.length;
  (window as unknown as { __galleryReady: boolean }).__galleryReady = true;
  requestAnimationFrame(frameLoop);
}

loadArt().then(() => requestAnimationFrame(frameLoop));
// keep unused helpers referenced for the typechecker's sake when scenes change
void textWidth; void CHIP_H; void KEY_H; void book;
