// The Kernel tree (DESIGN.md §23, reset layer 3), a page of the ledger like the Legacy tree
// (src/app/legacy.ts) and the Patent Office: ten nodes in three bands drawn in pencil on paper (the
// Rules a layout is built under, Further up and further on, what a universe Keeps), flat prices on
// little chips, the one prerequisite as a pencil line, owned nodes ticked, the pinned one circled
// in red pencil. The purse of Kernels heads the page with the Last Folds so far; the right page is
// the node in plain words: what it does, its price against the purse, what it needs, its refusal in
// the sim's words, its flavour line and the Buy button. Reached from the notebook, the Last Fold's
// card and the moment after it. Presentation only: buying is the `kernel` command.
import { C } from '../data/palette';
import { KERNELS, KERNEL_LIST, KERNEL_BRANCHES, type KernelId, type KernelDef, type KernelBranch } from '../data/kernels';
import { ICON, smallWidth, bigWidth, SMALL_H, textWidth } from '../ui/font';
import { sheet, hasArt } from '../render/sprites';
import { Num } from '../engine/num';
import { hasKernel, kernelRefusal } from '../sim/kernels';
import { ledgerOpen } from '../sim/systems/ledger';
import { button, uiIcon, chip, chipWidth, rule, stamp, type UIconName } from './chrome';
import { menuTemplate, type IconName } from './widgets';
import { layoutRich, drawLayout, drawRich } from '../ui/rich';
import { T, roleInk, type Role } from '../ui/theme';
import { bookArea, disc, tick, pencilCircle, speak, ROW_H } from './ledger';
import { registerMenu } from './topbar';
import { registerScreen } from './screens';
import type { App } from './app';
import type { Rect } from '../ui/ui';

type NodeIcon = { ui: UIconName } | { sprite: string };

/** One picture per node: the rule it changes. */
const NODE_ICON: Record<KernelId, NodeIcon> = {
  wideBelts: { ui: 'flow' }, everySide: { ui: 'factory' }, biggerBox: { ui: 'fold' }, secondCookbook: { ui: 'research' },
  beyond: { ui: 'beyond' }, endlessLedger: { ui: 'ledger' }, seedling: { sprite: 'seed' },
  longNights: { ui: 'overnight' }, keptIslands: { ui: 'world' }, keptLegacy: { ui: 'legacy' },
};

/** Short labels under the nodes; the first that fits its room wins. */
const SHORT: Record<KernelId, string[]> = {
  wideBelts: ['Wide belts', 'Wide'], everySide: ['Every side', 'Ports'], biggerBox: ['Bigger box', 'Box'], secondCookbook: ['Cookbook', 'Recipes'],
  beyond: ['Beyond'], endlessLedger: ['Ledger'], seedling: ['Seedling', 'Seed'],
  longNights: ['Long nights', 'Nights'], keptIslands: ['Kept islands', 'Islands'], keptLegacy: ['Kept legacy', 'Legacy'],
};
const shortLabel = (d: KernelDef, room: number) => SHORT[d.id].find((s) => smallWidth(s.toUpperCase()) <= room) ?? SHORT[d.id][SHORT[d.id].length - 1];

const BRANCH_ROLE: Record<KernelBranch, Role> = { rules: 'research', reach: 'coin', kept: 'good' };
const BRANCHES: KernelBranch[] = ['rules', 'reach', 'kept'];
/** what each band is about, under its heading */
const BRANCH_LINE: Record<KernelBranch, string> = { rules: 'the rules a layout is built under', reach: 'further up, and further on', kept: 'what a universe keeps' };

/** the node pinned by a click (the hovered one wins while the mouse is on a node) */
const st = { pinned: 'endlessLedger' as KernelId };
/** Pin a node (the e2e states). */
export function pinKernel(id: KernelId) { st.pinned = id; }

const N = 20;

function nodes(b: KernelBranch) { return KERNEL_LIST.filter((d) => d.branch === b); }

function kernelScreen(app: App, r0: Rect) {
  const ui = app.ui;
  const g = app.game;
  const m = g.s.meta;
  const r = bookArea(r0);
  const { body, detail } = menuTemplate(app, r, { title: 'The Kernel Tree', accent: C.violet, icon: 'kernel' as IconName, detail: Math.max(150, Math.min(200, Math.floor(r.w * 0.34))) });
  if (!KERNELS[st.pinned]) st.pinned = KERNEL_LIST[0].id;
  // ---- the purse: Kernels to spend, the Last Folds so far, the ways to the Ledger and the card
  const bank = (m.kernels ?? Num.ZERO).format();
  let x = body.x;
  ui.big(bank, x, body.y + 1, T.coin);
  x += bigWidth(bank) + 4;
  const purse = 'Kernels to spend';
  ui.text(purse, x, body.y + 3, T.ink);
  const bankW = bigWidth(bank) + 4 + textWidth(purse);
  const keys: { id: string; label: string; tip: string; go: () => void }[] = [];
  if (ledgerOpen(g)) keys.push({ id: 'toLedger', label: '{u:ledger} Ledger', tip: '{u:ledger} the Endless Ledger · its open order', go: () => { app.panel = 'ledger'; } });
  if (g.s.haudit?.last && g.s.haudit.result) keys.push({ id: 'toLastFold', label: '{u:lastFold} Last Fold', tip: '{u:lastFold} the whole World is graded · its card', go: () => { app.panel = 'lastfold'; } });
  let bx = body.x + body.w;
  for (const k of keys) {
    const w = layoutRich(k.label).w + 14;
    bx -= w;
    if (bx < body.x + bankW + 8) break;
    if (button(ui, k.id, bx, body.y - 1, w, 15, k.label, { tip: k.tip })) k.go();
    bx -= 3;
  }
  const folds = m.lastFolds ?? 0;
  const runChips: { text: string; role: Role; tip: string }[] = [
    { text: `${folds} Last ${folds === 1 ? 'Fold' : 'Folds'}`, role: 'soft', tip: '{u:lastFold} universes folded so far' },
    { text: `${(m.kernelsEarned ?? Num.ZERO).format()} earned`, role: 'soft', tip: '{u:kernel} Kernels banked in all' },
  ];
  let cx = body.x + bankW + 8;
  for (const c of runChips) {
    const cw = chipWidth(c.text);
    if (cx + cw > bx - 4) break;
    chip(ui, cx, body.y, c.text, { role: c.role });
    ui.hint(cx, body.y, cw, 12, c.tip, 200);
    cx += cw + 3;
  }
  // ---- the tree: three bands, one a row of nodes each
  const ty = body.y + 17, bottom = body.y + body.h;
  const bandH = Math.floor((bottom - ty) / 3);
  let hover: KernelId | null = null;
  BRANCHES.forEach((b, bi) => {
    const B = { x: body.x, y: ty + bi * bandH, w: body.w, h: bandH - 3 };
    const role = BRANCH_ROLE[b];
    const ink = roleInk(role);
    ui.big(KERNEL_BRANCHES[b], B.x, B.y, ink);
    const hw = bigWidth(KERNEL_BRANCHES[b]);
    if (hw + 8 + textWidth(BRANCH_LINE[b]) <= B.w) ui.text(BRANCH_LINE[b], B.x + hw + 8, B.y + 2, T.inkSoft);
    ui.ctx.fillStyle = ink;
    ui.ctx.globalAlpha = 0.6;
    ui.ctx.fillRect(B.x, B.y + 12, B.w, 1);
    ui.ctx.globalAlpha = 1;
    const list = nodes(b);
    const cols = Math.max(4, ...list.map((d) => d.pos[0] + 1));
    const cw = Math.floor(B.w / cols);
    const labels = B.h >= 16 + N + SMALL_H + 4;
    const ny = B.y + 16 + Math.max(0, Math.floor((B.h - 16 - N - (labels ? SMALL_H + 4 : 0)) / 2));
    const at = (id: KernelId) => ({ x: B.x + KERNELS[id].pos[0] * cw + Math.floor((cw - N) / 2), y: ny });
    // pencil lines to a prerequisite in the band, under the nodes
    for (const d of list)
      for (const q of d.requires) {
        if (KERNELS[q].branch !== b) continue;
        const a0 = at(q), a1 = at(d.id);
        ui.ctx.fillStyle = hasKernel(g, q) ? T.good : T.paperEdge;
        ui.ctx.fillRect(a0.x + N + 1, a0.y + N / 2, a1.x - a0.x - N - 2, 1);
        ui.ctx.fillRect(a1.x - 4, a0.y + N / 2 - 2, 1, 5);
        ui.ctx.fillRect(a1.x - 3, a0.y + N / 2 - 1, 1, 3);
      }
    for (const d of list) {
      const a = at(d.id);
      const own = hasKernel(g, d.id);
      const why = own ? null : kernelRefusal(g, d.id);
      const locked = !own && d.requires.some((q) => !hasKernel(g, q));
      const can = !own && !why;
      const sel = st.pinned === d.id;
      const bw0 = Math.max(N + 2, cw - 2), bx1 = a.x + N / 2 - Math.floor(bw0 / 2);
      ui.region(a.x - 1, a.y - 1, N + 7, N + 4, 'button');
      const hov = ui.hover(bx1, a.y - 1, bw0, N + 1 + (labels ? SMALL_H + 4 : 0));
      ui.mark('kernel_' + d.id, a.x - 1, a.y - 1, N + 2, N + 2);
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
        const lab = shortLabel(d, cw - 3).toUpperCase();
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
  });
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

function drawNodeIcon(app: App, d: KernelDef, x: number, y: number) {
  const ui = app.ui;
  const ic = NODE_ICON[d.id];
  if ('sprite' in ic && hasArt(ic.sprite)) ui.ctx.drawImage(sheet(ic.sprite).frames[0], x, y, 16, 16);
  else if ('ui' in ic) uiIcon(ui, ic.ui, x, y);
  else uiIcon(ui, 'kernel', x, y);
}

function buy(app: App, id: KernelId) {
  if (app.act({ k: 'kernel', id }).ok) app.toast(KERNELS[id].name, KERNELS[id].text, C.gold, 'kernel');
}

/** The Inspector's line on the tree: what is waiting to be spent or folded. */
function line(app: App): string {
  const g = app.game;
  const canBuy = KERNEL_LIST.some((d) => !hasKernel(g, d.id) && !kernelRefusal(g, d.id));
  if (canBuy) return 'Spend them. Each one changes a rule the next universe is built under.';
  if (KERNEL_LIST.every((d) => hasKernel(g, d.id))) return 'Every rule bent. The Ledger goes on for ever.';
  if ((g.s.meta.kernels ?? Num.ZERO).gt(0)) return 'Save them up. Another Last Fold banks more.';
  return 'Kernels come from the Last Fold: the whole World, graded and folded.';
}

/** The node in plain words (`live`: the pinned node, not a hover). */
function nodePage(app: App, id: KernelId, r: Rect, live: boolean) {
  const ui = app.ui;
  const g = app.game;
  const d = KERNELS[id];
  const role = BRANCH_ROLE[d.branch];
  let y = r.y;
  y += speak(app, 'inspector', line(app), r.x, y, r.w, { size: 24 }) + 5;
  rule(ui, r.x, y - 2, r.w, true);
  y += 2;
  const own = hasKernel(g, id);
  disc(ui, r.x, y, N, own ? 'owned' : 'normal');
  drawNodeIcon(app, d, r.x + 2, y + 2);
  const NL = layoutRich(`{big:${d.name}}`, r.w - N - 6);
  drawLayout(ui, NL, r.x + N + 5, y + (NL.lines.length > 1 ? 0 : 5), roleInk(role));
  y += Math.max(N, NL.h) + 3;
  chip(ui, r.x, y, KERNEL_BRANCHES[d.branch], { role });
  if (own) stamp(ui, 'OWNED', r.x + r.w - 30, y + 4, { col: T.goodFill, angle: -0.1 });
  y += 15;
  const foot = r.y + r.h - 19;
  const TL = layoutRich(d.text, r.w);
  drawLayout(ui, TL, r.x, y, T.ink);
  y += TL.h + 3;
  if (own) y += drawRich(ui, '{good:in effect} · for good, through every Last Fold', r.x, y, r.w, T.ink) + 3;
  else {
    const have = g.s.meta.kernels ?? Num.ZERO;
    const cw = chip(ui, r.x, y, `${d.cost} Kernel${d.cost === 1 ? '' : 's'}`, { role: have.gte(d.cost) ? 'coin' : 'soft', solid: have.gte(d.cost) });
    drawLayout(ui, layoutRich(`{soft:you have ${have.format()}}`), r.x + cw + 5, y + 3, T.inkSoft);
    y += ROW_H;
    for (const q of d.requires) {
      if (y + 11 > foot - 12) break;
      const ok = hasKernel(g, q);
      ui.text(`${ok ? ICON.check : ICON.cross} ${KERNELS[q].name}`, r.x, y, ok ? T.good : T.bad);
      y += 11;
    }
  }
  const FL = layoutRich(`{soft:"${d.flavor}"}`, r.w);
  if (y + FL.h + 4 <= foot - 2) drawLayout(ui, FL, r.x, foot - 3 - FL.h, T.inkSoft);
  const why = own ? null : kernelRefusal(g, id);
  const lab = own ? `${ICON.check} Yours for good` : `Buy · ${d.cost} Kernel${d.cost === 1 ? '' : 's'}`;
  if (button(ui, 'kernelBuy', r.x, foot, r.w, 18, lab, { disabled: own || !!why, gold: !own && !why, tip: own ? '{u:kernel} it lasts through every Last Fold' : why ? `{bad:${why}}` : '{u:kernel} bought for good · it lasts through every Last Fold' })) buy(app, id);
  void live;
}

registerScreen('kernels', kernelScreen);

registerMenu({
  id: 'kernels', icon: 'kernel', name: 'Kernels', panel: 'kernels', group: 'game',
  tip: '{u:kernel} the Kernel tree · bought with what the Last Fold banks',
  show: (app) => !app.game.s.scenario && ((app.game.s.meta.lastFolds ?? 0) > 0 || (app.game.s.meta.kernels ?? Num.ZERO).gt(0) || app.game.done('lastFold')),
  dot: (app) => app.panel !== 'kernels' && KERNEL_LIST.some((d) => !hasKernel(app.game, d.id) && !kernelRefusal(app.game, d.id)),
});
