// The Legacy tree (DESIGN.md §22, reset layer 2), a page of the ledger like the Patent Office
// (src/app/patents.ts): seventeen nodes in three branches drawn in pencil on paper, flat prices on
// little chips, prerequisites as pencil lines, owned nodes ticked, the pinned one circled in red
// pencil. Automation runs down the left (the chores of the Reorganize loop handed to the town), head
// starts and the islands' softeners on the right. The right page is the node in plain words: what it
// does, its price against the bank, what it needs, its flavour line, the Buy button; and, once
// owned, its controls: the Standing Committee's number on a labelled stepper (`standing`), Old
// Habits' Patent nodes to keep (`habit`), the Town Plan's kept District layouts by name
// (`keepPlan`, `forgetPlan`). Presentation only: buying is the `legacy` command.
import { C } from '../data/palette';
import { LEGACY, LEGACY_LIST, LEGACY_BRANCHES, type LegacyId, type LegacyDef, type LegacyBranch } from '../data/legacy';
import { PATENTS, type PatentId } from '../data/patents';
import { ITEMS } from '../data/items';
import { ICON, smallWidth, bigWidth, SMALL_H, BIG_H, textWidth } from '../ui/font';
import { itemIcon, sheet, hasArt, spriteName } from '../render/sprites';
import { Num } from '../engine/num';
import { hasLegacy, legacyRefusal, lrules } from '../sim/legacy';
import { previewPatents } from '../sim/reorganize';
import { button, uiIcon, chip, chipWidth, rule, stamp, UICON, type UIconName } from './chrome';
import { menuTemplate, type IconName } from './widgets';
import { layoutRich, drawLayout, drawRich, richWidth } from '../ui/rich';
import { T, roleInk, type Role } from '../ui/theme';
import { bookArea, heading, disc, tick, pencilCircle, speak, ROW_H } from './ledger';
import { registerMenu } from './topbar';
import { registerScreen } from './screens';
import { relocateClose, relocateNow } from './moves';
import type { App } from './app';
import type { Rect } from '../ui/ui';

type NodeIcon = { item: string } | { ui: UIconName } | { sprite: string; f?: number };

/** One picture per node: what it hands the town, or the island it softens (its exotic). */
const NODE_ICON: Record<LegacyId, NodeIcon> = {
  patentPurse: { ui: 'coin' }, oldHabits: { ui: 'reset' }, secondNature: { ui: 'mode' }, townArchive: { ui: 'research' }, standingCharts: { ui: 'world' },
  patentClerk: { ui: 'patents' }, standingCommittee: { ui: 'clock' }, regrader: { ui: 'fold' }, townPlan: { ui: 'district' }, contractRunners: { ui: 'orders' },
  skiffGuild: { sprite: 'skiff' }, longerDrawer: { ui: 'blueprint' }, groupDrawer: { ui: 'factory' },
  skyMoorings: { item: 'skyglass' }, heatShields: { item: 'cinderite' }, warmHands: { item: 'rimeCrystal' }, salvageCrews: { item: 'relic' },
};

/** Short labels under the nodes; the first that fits its room wins. */
const SHORT: Record<LegacyId, string[]> = {
  patentPurse: ['Purse'], oldHabits: ['Habits'], secondNature: ['Second', '2nd'], townArchive: ['Archive', 'Notes'], standingCharts: ['Charts', 'Map'],
  patentClerk: ['Clerk'], standingCommittee: ['Committee', 'Cttee'], regrader: ['Regrader', 'Regrade'], townPlan: ['Plan'], contractRunners: ['Runners', 'Run'],
  skiffGuild: ['Guild'], longerDrawer: ['Drawer+', 'Drawer'], groupDrawer: ['Groups', 'Group'],
  skyMoorings: ['Moorings', 'Moor'], heatShields: ['Shields', 'Heat'], warmHands: ['Hands', 'Warm'], salvageCrews: ['Salvage', 'Crew'],
};
const shortLabel = (d: LegacyDef, room: number) => SHORT[d.id].find((s) => smallWidth(s.toUpperCase()) <= room) ?? SHORT[d.id][SHORT[d.id].length - 1];

const BRANCH_ROLE: Record<LegacyBranch, Role> = { start: 'coin', auto: 'good', soften: 'research' };

/** the node pinned by a click (the hovered one wins while the mouse is on a node) */
const st = { pinned: 'patentPurse' as LegacyId };
/** Pin a node (the e2e states). */
export function pinLegacy(id: LegacyId) { st.pinned = id; }

const N = 20;

function nodes(b: LegacyBranch) { return LEGACY_LIST.filter((d) => d.branch === b); }

function legacyScreen(app: App, r0: Rect) {
  const ui = app.ui;
  const g = app.game;
  const m = g.s.meta;
  const r = bookArea(r0);
  const { body, detail } = menuTemplate(app, r, { title: 'The Legacy Tree', accent: C.gold, icon: 'legacy' as IconName, detail: Math.max(150, Math.min(200, Math.floor(r.w * 0.34))) });
  if (!LEGACY[st.pinned]) st.pinned = LEGACY_LIST[0].id;
  // ---- the bank: Legacy to spend, the moves so far, what flying now would bank, the way to Relocate
  const bank = (m.legacy ?? Num.ZERO).format();
  let x = body.x;
  ui.big(bank, x, body.y + 1, T.coin);
  x += bigWidth(bank) + 4;
  ui.text('Legacy to spend', x, body.y + 3, T.ink);
  const bankW = bigWidth(bank) + 4 + textWidth('Legacy to spend');
  const showGo = relocateClose(app) || (m.relocations ?? 0) > 0;
  const bw = layoutRich('{u:relocate} Relocate').w + 14;
  const bx = body.x + body.w - (showGo ? bw : 0);
  if (showGo && button(ui, 'toRelocate', bx, body.y - 1, bw, 15, '{u:relocate} Relocate', { tip: [{ text: '{u:relocate} {big:Relocate}' }, { text: 'what a move banks, keeps and loses' }] })) app.panel = 'relocate';
  const now = relocateNow(app);
  const runChips: { text: string; role: Role; tip: string }[] = [
    { text: `${m.relocations ?? 0} ${(m.relocations ?? 0) === 1 ? 'move' : 'moves'}`, role: 'soft', tip: '{u:relocate} Relocates so far' },
    ...(now ? [{ text: `+${now.p.now} if you fly`, role: 'coin' as Role, tip: `{u:relocate} a Relocate now banks {coin:+${now.p.now} Legacy}` }] : []),
  ];
  let cx = body.x + bankW + 8;
  for (const c of runChips) {
    const cw = chipWidth(c.text);
    if (cx + cw > bx - 4) break;
    chip(ui, cx, body.y, c.text, { role: c.role });
    ui.hint(cx, body.y, cw, 12, c.tip, 200);
    cx += cw + 3;
  }
  // ---- the tree: Automation down the left, Head starts and Islands on the right
  const ty = body.y + 17, bottom = body.y + body.h;
  const gap = 8;
  const colsOf = (b: LegacyBranch) => Math.max(...nodes(b).map((d) => d.pos[0])) + 1;
  const rowsOf = (b: LegacyBranch) => Math.max(...nodes(b).map((d) => d.pos[1])) + 1;
  const leftCols = colsOf('auto'), rightCols = Math.max(colsOf('start'), colsOf('soften'));
  const lw = Math.floor(((body.w - gap) * leftCols) / (leftCols + rightCols));
  const rw = body.w - gap - lw;
  // the right column's height shared by its two branches by their rows
  const rh = bottom - ty;
  const sRows = rowsOf('start'), fRows = rowsOf('soften');
  // (no taller than its rows want: the Islands sit just under the Head starts, not at the foot)
  const sh = Math.min(Math.floor(((rh - 3) * (sRows + 0.6)) / (sRows + fRows + 1.2)), 16 + sRows * (N + SMALL_H + 18) + 6);
  const boxes: { b: LegacyBranch; x: number; y: number; w: number; h: number }[] = [
    { b: 'auto', x: body.x, y: ty, w: lw, h: rh },
    { b: 'start', x: body.x + lw + gap, y: ty, w: rw, h: sh },
    { b: 'soften', x: body.x + lw + gap, y: ty + sh + 3, w: rw, h: rh - sh - 3 },
  ];
  let hover: LegacyId | null = null;
  for (const B of boxes) {
    const role = BRANCH_ROLE[B.b];
    const ink = roleInk(role);
    heading(ui, LEGACY_BRANCHES[B.b], B.x, B.y, B.w, role);
    const list = nodes(B.b);
    const cols = colsOf(B.b), rows = rowsOf(B.b);
    const cw = Math.floor(B.w / cols);
    const labelRoom = cw - 3;
    const labels = B.y + 16 + rows * (N + SMALL_H + 6) <= B.y + B.h + 1;
    const rowH = Math.max(N + (labels ? SMALL_H + 6 : 4), Math.min(N + SMALL_H + 18, Math.floor((B.h - 16) / rows)));
    const at = (id: LegacyId) => ({ x: B.x + LEGACY[id].pos[0] * cw + Math.floor((cw - N) / 2), y: B.y + 16 + LEGACY[id].pos[1] * rowH });
    // pencil lines to prerequisites first, under the nodes
    for (const d of list) {
      const a = at(d.id);
      for (const q of d.requires) {
        if (LEGACY[q].branch !== B.b) continue;
        const b = at(q);
        link(app, b.x + N / 2, b.y + N / 2, a.x + N / 2, a.y + N / 2, b.x + N / 2 + Math.floor(cw / 2), hasLegacy(g, q) ? T.good : T.paperEdge);
      }
    }
    for (const d of list) {
      const a = at(d.id);
      const own = hasLegacy(g, d.id);
      const why = own ? null : legacyRefusal(g, d.id);
      const locked = !own && d.requires.some((q) => !hasLegacy(g, q));
      const can = !own && !why;
      const sel = st.pinned === d.id;
      const bw0 = Math.max(N + 2, cw - 2), bx1 = a.x + N / 2 - Math.floor(bw0 / 2);
      ui.region(a.x - 1, a.y - 1, N + 7, N + 4, 'button');
      const hov = ui.hover(bx1, a.y - 1, bw0, N + 1 + (labels ? SMALL_H + 4 : 0));
      ui.mark('legacy_' + d.id, a.x - 1, a.y - 1, N + 2, N + 2);
      if (hov) hover = d.id;
      disc(ui, a.x, a.y, N, hov ? 'hover' : own ? 'owned' : can ? 'afford' : locked ? 'locked' : 'normal');
      if (can) {
        const t = ui.time * 3 + d.pos[0];
        ui.ctx.fillStyle = T.paperHi;
        ui.ctx.fillRect(Math.round(a.x + N / 2 + Math.cos(t) * (N / 2 - 1.5)), Math.round(a.y + N / 2 + Math.sin(t) * (N / 2 - 1.5)), 1, 1);
      }
      ui.ctx.globalAlpha = locked ? 0.45 : 1;
      drawNodeIcon(app, d, a.x + 2, a.y + 2);
      ui.ctx.globalAlpha = 1;
      if (own) tick(ui, a.x + N - 8, a.y + N - 9);
      else priceTag(app, String(d.cost), a.x + N - 4, a.y + N - 5, can ? 'coin' : 'soft');
      if (sel) pencilCircle(ui, a.x, a.y, N);
      if (labels) {
        const lab = shortLabel(d, labelRoom).toUpperCase();
        const lx = a.x + N / 2, ly = a.y + N + 3;
        const lw0 = smallWidth(lab) + 2;
        ui.ctx.fillStyle = T.paper;
        ui.ctx.fillRect(Math.round(lx - lw0 / 2), ly - 1, lw0, SMALL_H + 2);
        ui.small(lab, lx, ly, own ? ink : can || sel || hov ? T.ink : T.inkSoft, { align: 'center' });
      }
      if (hov && ui.clicked) {
        ui.eat();
        if (st.pinned === d.id && can) buy(app, d.id);
        else { st.pinned = d.id; ui.sfx('click'); }
      }
    }
  }
  if (detail) nodePage(app, hover ?? st.pinned, detail, hover === null);
}

/** A price on a node: a little paper chip with the number, its right edge at x. */
function priceTag(app: App, s: string, x: number, y: number, role: Role) {
  const ui = app.ui;
  const w = smallWidth(s) + 4, h = SMALL_H + 3;
  const x0 = Math.round(x - w + 4);
  ui.ctx.fillStyle = roleInk(role);
  ui.ctx.fillRect(x0 + 1, y, w - 2, h);
  ui.ctx.fillRect(x0, y + 1, w, h - 2);
  ui.ctx.fillStyle = T.paperHi;
  ui.ctx.fillRect(x0 + 1, y + 1, w - 2, h - 2);
  ui.small(s, x0 + 2, y + 2, roleInk(role));
}

function drawNodeIcon(app: App, d: LegacyDef, x: number, y: number) {
  const ui = app.ui;
  const ic = NODE_ICON[d.id];
  if ('item' in ic && ic.item in ITEMS) ui.ctx.drawImage(itemIcon(ic.item), x, y, 16, 16);
  else if ('sprite' in ic && hasArt(spriteName(ic.sprite))) {
    const s = sheet(spriteName(ic.sprite));
    const f = s.frames[Math.min(ic.f ?? 0, s.frames.length - 1)];
    const k = Math.min(1, 16 / Math.max(f.width, f.height));
    ui.ctx.drawImage(f, x + Math.floor((16 - f.width * k) / 2), y + Math.floor((16 - f.height * k) / 2), f.width * k, f.height * k);
  } else if ('ui' in ic && ic.ui in UICON) uiIcon(ui, ic.ui, x, y);
  else uiIcon(ui, 'star', x, y);
}

/** A pencil line from a prerequisite to a node (the Patent tree's: across, then down or up). */
function link(app: App, x0: number, y0: number, x1: number, y1: number, mx: number, col: string) {
  const ctx = app.ui.ctx;
  ctx.fillStyle = col;
  const f = (x: number, y: number, w: number, h: number) => ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
  f(Math.min(x0, mx), y0, Math.abs(mx - x0) + 1, 1);
  const yr = y1 > y0 ? y1 - N / 2 - 3 : y1;
  f(mx, Math.min(y0, yr), 1, Math.abs(yr - y0) + 1);
  f(Math.min(mx, x1), yr, Math.abs(x1 - mx) + 1, 1);
  if (yr !== y1) f(x1, yr, 1, y1 - yr);
}

function buy(app: App, id: LegacyId) {
  if (app.act({ k: 'legacy', id }).ok) {
    app.audio.sfx('upgrade');
    app.toast(LEGACY[id].name, LEGACY[id].text, C.gold, 'legacy');
  }
}

/** Bramble's line on the tree: what is waiting to be spent or banked. */
function bramblesLine(app: App): string {
  const g = app.game;
  const canBuy = LEGACY_LIST.some((d) => !hasLegacy(g, d.id) && !legacyRefusal(g, d.id));
  if (canBuy) return 'Spend it! The town remembers everything you buy here.';
  const now = relocateNow(app);
  if (now) return `Another island banks {chip:coin:+${now.p.now} Legacy}. Pack the lily pads?`;
  if ((g.s.meta.legacy ?? Num.ZERO).gt(0)) return 'Save it up! The good ones cost more.';
  return 'Legacy comes from moving the town. Every island remembers.';
}

/** The node in plain words, and its controls once owned (`live`: the pinned node, not a hover). */
function nodePage(app: App, id: LegacyId, r: Rect, live: boolean) {
  const ui = app.ui;
  const g = app.game;
  const d = LEGACY[id];
  const role = BRANCH_ROLE[d.branch];
  let y = r.y;
  y += speak(app, 'bramble', bramblesLine(app), r.x, y, r.w, { size: 24 }) + 5;
  rule(ui, r.x, y - 2, r.w, true);
  y += 2;
  const own = hasLegacy(g, id);
  disc(ui, r.x, y, N, own ? 'owned' : 'normal');
  drawNodeIcon(app, d, r.x + 2, y + 2);
  const NL = layoutRich(`{big:${d.name}}`, r.w - N - 6);
  drawLayout(ui, NL, r.x + N + 5, y + (NL.lines.length > 1 ? 0 : 5), roleInk(role));
  y += Math.max(N, NL.h) + 3;
  chip(ui, r.x, y, LEGACY_BRANCHES[d.branch], { role });
  if (own) stamp(ui, 'OWNED', r.x + r.w - 30, y + 4, { col: T.goodFill, angle: -0.1 });
  y += 15;
  const foot = r.y + r.h - 19;
  const TL = layoutRich(d.text, r.w);
  drawLayout(ui, TL, r.x, y, T.ink);
  y += TL.h + 3;
  // owned: its controls; else its price and what it needs
  if (own && live) y = controls(app, id, r.x, y, r.w, foot - 2);
  else if (own) y += drawRich(ui, '{good:in effect} · for good, through every move', r.x, y, r.w, T.ink) + 3;
  else {
    const have = g.s.meta.legacy ?? Num.ZERO;
    const cw = chip(ui, r.x, y, `${d.cost} Legacy`, { role: have.gte(d.cost) ? 'coin' : 'soft', solid: have.gte(d.cost) });
    drawLayout(ui, layoutRich(`{soft:you have ${have.format()}}`), r.x + cw + 5, y + 3, T.inkSoft);
    y += ROW_H;
    for (const q of d.requires) {
      if (y + 11 > foot - 12) break;
      const ok = hasLegacy(g, q);
      ui.text(`${ok ? ICON.check : ICON.cross} ${LEGACY[q].name}`, r.x, y, ok ? T.good : T.bad);
      y += 11;
    }
  }
  const FL = layoutRich(`{soft:"${d.flavor}"}`, r.w);
  if (y + FL.h + 4 <= foot - 2) drawLayout(ui, FL, r.x, foot - 3 - FL.h, T.inkSoft);
  const why = own ? null : legacyRefusal(g, id);
  const lab = own ? `${ICON.check} Yours for good` : `Buy · ${d.cost} Legacy`;
  if (button(ui, 'legacyBuy', r.x, foot, r.w, 18, lab, { disabled: own || !!why, gold: !own && !why, tip: own ? '{u:legacy} it lasts through every Relocate' : why ?? '{u:legacy} bought for good · it lasts through every Relocate' })) buy(app, id);
}

/** An owned node's controls on the right page. Returns the y under them. */
function controls(app: App, id: LegacyId, x: number, y: number, w: number, end: number): number {
  const e = LEGACY[id].effect;
  if (e.k === 'standing') return standingStepper(app, x, y, w);
  if (e.k === 'habits') return habitPicks(app, x, y, w, end);
  if (e.k === 'townPlan') return planList(app, x, y, w, end);
  return y + drawRich(app.ui, '{good:in effect} · for good, through every move', x, y, w, T.ink) + 3;
}

/** The Standing Committee's number: Reorganize by itself when the preview reaches it. A labelled
 * stepper (-5 -1 [N Patents] +1 +5) and Off / On. */
function standingStepper(app: App, x: number, y: number, w: number): number {
  const ui = app.ui;
  const g = app.game;
  const at = g.s.meta.standing ?? null;
  const pv = previewPatents(g).now;
  ui.small('REORGANIZE BY ITSELF AT', x, y, T.inkSoft);
  y += 9;
  const set = (v: number | null) => app.act({ k: 'standing', at: v === null ? null : Math.max(1, Math.min(1000, Math.round(v))) });
  const val = at === null ? 'off' : `${at} Patents`;
  const kw = 18, vw = Math.max(52, textWidth(val) + 10);
  let bx = x;
  const key = (id: string, lab: string, d: number) => {
    if (button(ui, id, bx, y, kw, 15, lab, { disabled: at === null && d < 0, tip: at === null ? '{soft:switch it on first}' : `{big:${d > 0 ? '+' : ''}${d}} Patents` })) set((at ?? 0) + d);
    bx += kw + 2;
  };
  key('standMinus5', '-5', -5);
  key('standMinus1', '-1', -1);
  ui.fill(bx, y, vw, 15, T.ink);
  ui.fill(bx + 1, y + 1, vw - 2, 13, T.paperHi);
  ui.text(val, bx + vw / 2, y + 4, at === null ? T.inkSoft : T.reset, { align: 'center' });
  ui.mark('standValue', bx, y, vw, 15);
  bx += vw + 2;
  key('standPlus1', '+1', 1);
  key('standPlus5', '+5', 5);
  y += 18;
  const onLab = at === null ? 'Switch on' : 'Switch off';
  if (button(ui, 'standToggle', x, y, Math.min(w, 70), 15, onLab, { gold: at === null, tip: at === null ? `{u:reset} it Reorganizes at ${Math.max(1, pv || 20)} Patents` : '{u:reset} it waits for you again' })) set(at === null ? Math.max(1, pv || 20) : null);
  y += 18;
  y += drawRich(ui, `{soft:this run files} {reset:+${pv}} · {soft:never in a Challenge · waits for audits}`, x, y, w, T.ink) + 3;
  return y;
}

/** Old Habits (and Second Nature): the Patent nodes owned this run, each a toggle: kept through
 * the next Relocate or not, up to the slots. */
function habitPicks(app: App, x: number, y: number, w: number, end: number): number {
  const ui = app.ui;
  const g = app.game;
  const slots = lrules(g).habitSlots;
  const kept = new Set(g.s.meta.habits ?? []);
  const owned = g.s.meta.nodes.filter((n) => PATENTS[n as PatentId]) as PatentId[];
  ui.small(`KEPT THROUGH A MOVE ${kept.size}/${slots}`, x, y, kept.size >= slots ? T.good : T.inkSoft);
  y += 9;
  if (!owned.length) return y + drawRich(ui, '{soft:no Patent nodes this world yet}', x, y, w, T.inkSoft) + 3;
  // two columns when every name fits in one, else one column while the page has the room
  const label = (id: PatentId) => `${kept.has(id) ? ICON.check + ' ' : ''}${PATENTS[id].name.replace(/^The /, '').toUpperCase()}`;
  const half = Math.floor((w - 3) / 2);
  const cols = owned.every((id) => smallWidth(label(id)) <= half - 6) || y + owned.length * 12 > end - 10 ? 2 : 1;
  const colW = cols === 2 ? half : w;
  let i = 0;
  for (const id of owned) {
    const cx = x + (i % cols) * (colW + 3), cy = y + Math.floor(i / cols) * 12;
    if (cy + 11 > end - 10) { drawRich(ui, `{soft:+${owned.length - i} more}`, x, cy, w, T.inkSoft); return cy + 10; }
    const on = kept.has(id);
    if (button(ui, 'habit_' + id, cx, cy, colW, 11, '', { active: on, disabled: !on && kept.size >= slots, tip: [{ text: `{big:${PATENTS[id].name}}` }, { text: on ? '{good:kept through the next move} · {k:LMB} let go' : kept.size >= slots ? `{soft:Old Habits keeps ${slots}: let one go first}` : '{k:LMB} keep it through the next move' }] })) app.act({ k: 'habit', id });
    ui.clip(cx + 2, cy, colW - 4, 11);
    ui.small(label(id), cx + 3, cy + 3, on ? T.good : T.ink);
    ui.unclip();
    i++;
  }
  return y + Math.ceil(owned.length / cols) * 12 + 2;
}

/** The Town Plan: the District layouts kept, each by name with its tiles and routes and a Forget
 * key, and a key to keep the District as it stands. */
function planList(app: App, x: number, y: number, w: number, end: number): number {
  const ui = app.ui;
  const g = app.game;
  const max = lrules(g).plans;
  const plans = g.s.meta.plans ?? [];
  ui.small(`DISTRICT LAYOUTS KEPT ${plans.length}/${max}`, x, y, T.inkSoft);
  y += 9;
  for (const p of plans) {
    if (y + 14 > end - 18) break;
    const fw = 40;
    ui.clip(x, y, w - fw - 4, 12);
    drawRich(ui, `{u:district} ${p.name} {soft:${p.tiles.length} groups · ${p.routes.length} routes}`, x, y + 2, Infinity, T.ink);
    ui.unclip();
    ui.hint(x, y, w - fw - 4, 12, [{ text: `{big:${p.name}}` }, { text: `${p.tiles.length} groups · ${p.routes.length} routes` }, { text: '{soft:each run places it again from spare copies, routes and skiffs paid}' }], 200);
    if (button(ui, 'forgetPlan_' + p.id, x + w - fw, y, fw, 12, 'Forget', { tip: `{bad:forget} ${p.name}` })) app.act({ k: 'forgetPlan', id: p.id });
    y += 14;
  }
  const mods = g.s.district?.ents.filter((e) => e.kind === 'module').length ?? 0;
  const room = plans.length < max;
  if (y + 16 <= end) {
    const lab = '{u:district} Keep the District';
    if (button(ui, 'keepPlan', x, y, Math.min(w, richWidth(lab) + 14), 15, lab, { disabled: !room || !mods, gold: room && mods > 0, tip: !mods ? '{soft:no groups stand on the District}' : !room ? `{soft:the Town Plan keeps ${max}: forget one first}` : [{ text: '{big:Keep this layout}' }, { text: `${mods} groups and their routes, by name` }] })) {
      const name = window.prompt('Name this District layout:', `District plan ${g.s.meta.nextPlan ?? 1}`);
      if (name !== null) app.act({ k: 'keepPlan', name });
    }
    y += 18;
  }
  return y;
}

registerScreen('legacy', legacyScreen);

registerMenu({
  id: 'legacy', icon: 'legacy', name: 'Legacy', panel: 'legacy', group: 'game',
  tip: '{u:legacy} the Legacy tree · bought with what a move banks',
  show: (app) => !app.game.s.scenario && ((app.game.s.meta.relocations ?? 0) > 0 || (app.game.s.meta.legacy ?? Num.ZERO).gt(0) || relocateClose(app)),
  dot: (app) => app.panel !== 'legacy' && LEGACY_LIST.some((d) => !hasLegacy(app.game, d.id) && !legacyRefusal(app.game, d.id)),
});

void BIG_H;
