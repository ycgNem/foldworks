// The Patent Office (DESIGN.md §19, Milestone 5): the Patent tree. Head starts run along the top,
// one row per line of research; rules, automation and offline efficiency sit in three boxes under
// it. A node shows its icon and flat price; owned nodes are lit gold, ones you can buy now pulse
// teal, locked ones are dim with their lines to what they need. The node under the mouse (or the
// one clicked) is described on the right with its Buy button. Presentation only: buying is the
// `patent` command.
import { C, rgba } from '../data/palette';
import { PATENTS, PATENT_LIST, BRANCH_NAMES, type PatentId, type PatentBranch } from '../data/patents';
import type { ItemId } from '../data/items';
import { ITEMS } from '../data/items';
import { ICON, textWidth } from '../ui/font';
import { itemIcon } from '../render/sprites';
import { hasPatent, patentRefusal } from '../sim/patents';
import { offlineEfficiency } from '../sim/offline';
import { previewPatents } from '../sim/reorganize';
import { frame, card, button, uiIcon, type UIconName } from './chrome';
import { screenHeader } from './widgets';
import type { App } from './app';
import type { Rect } from '../ui/ui';

const NODE_ICON: Record<PatentId, ItemId | UIconName> = {
  bellows: 'ironIngot', starterLine: 'ironOre', notebooks: 'research', copperDeeds: 'copperIngot', gearPatterns: 'gear',
  gizmoPatent: 'gizmo', foldingPatent: 'fold', grant: 'coin', overdriveHabit: 'overdrive', coalRights: 'coal',
  steelCharter: 'steel', glassNotes: 'glass', circuitPatent: 'circuit',
  // Milestone 5-6 review round (the reset layer agent): the re-derived rules and the Draughtsman
  surveyCharter: 'claim', widerBox: 'fold', quickAudit: 'clock', moreAuditors: 'stats', sideIntake: 'flow',
  nestedBoxes: 'heavy', freshDies: 'kit',
  shovelFrog: 'slag', labAssistant: 'research', orderClerk: 'orders', stampPress: 'kit', draughtsman: 'build', drawerSpace: 'factory',
  nightShift: 'clock', nightWatch: 'clock', lightsOn: 'star',
};

const BRANCH_COL: Record<PatentBranch, string> = { head: C.gold, rule: C.teal1, auto: C.leaf, offline: C.violet };

/** the node pinned by a click (the hovered one wins while the mouse is on a node) */
const st = { pinned: 'bellows' as PatentId };

const N = 20;

export function patentsScreen(app: App, r: Rect) {
  const ui = app.ui;
  const g = app.game;
  const m = g.s.meta;
  screenHeader(app, r, 'The Patent Office', C.violet, 'star');
  const y0 = r.y + 22, bottom = r.y + r.h - 6;
  const dw = Math.min(170, Math.floor(r.w * 0.32));
  const tw = r.w - dw - 22;
  // the bank
  const bank = `${m.patents.format()} ${m.patents.eq(1) ? 'Patent' : 'Patents'} to spend.`;
  ui.text(`${ICON.star} ${bank}`, r.x + 10, y0 + 1, C.gold, { shadow: C.ink });
  const pv = previewPatents(g);
  const sub = `${m.runs} ${m.runs === 1 ? 'Reorganize' : 'Reorganizes'}; this run would bank ${pv.now}`;
  const sx = r.x + 16 + textWidth(`${ICON.star} ${bank}`);
  if (sx + textWidth(sub) < r.x + 8 + tw - 92) ui.text(sub, sx, y0 + 1, C.hull3);
  if (button(ui, 'toReorganize', r.x + 8 + tw - 86, y0 - 2, 86, 12, 'Reorganize...', { tip: 'The Reorganize card: what a reset gives, keeps and loses' })) app.panel = 'reorganize';
  // the tree: head starts on top, the other three branches below
  const ty = y0 + 14;
  const headH = Math.floor((bottom - ty) * 0.42);
  let hover: PatentId | null = null;
  const boxes: { b: PatentBranch; x: number; y: number; w: number; h: number }[] = [];
  boxes.push({ b: 'head', x: r.x + 8, y: ty, w: tw, h: headH });
  const lw = Math.floor((tw - 8) / 3);
  (['rule', 'auto', 'offline'] as PatentBranch[]).forEach((b, i) => boxes.push({ b, x: r.x + 8 + i * (lw + 4), y: ty + headH + 4, w: lw, h: bottom - (ty + headH + 4) }));
  for (const bx of boxes) {
    const inner = card(ui, bx.x, bx.y, bx.w, bx.h, BRANCH_NAMES[bx.b], BRANCH_COL[bx.b]);
    const nodes = PATENT_LIST.filter((p) => p.branch === bx.b);
    const cols = Math.max(...nodes.map((p) => p.pos[0])) + 1, rows = Math.max(...nodes.map((p) => p.pos[1])) + 1;
    const cw = Math.floor(inner.w / cols), rh = Math.min(34, Math.floor(inner.h / rows));
    const at = (id: PatentId) => {
      const p = PATENTS[id];
      return { x: inner.x + p.pos[0] * cw + Math.floor((cw - N) / 2), y: inner.y + p.pos[1] * rh + Math.floor((rh - N - 8) / 2) };
    };
    // lines to prerequisites first, under the nodes
    for (const p of nodes) {
      const a = at(p.id);
      for (const q of p.requires) {
        if (PATENTS[q].branch !== bx.b) continue;
        const b = at(q);
        const col = hasPatent(g, q) ? BRANCH_COL[bx.b] : C.hull0;
        link(app, b.x + N / 2, b.y + N / 2, a.x + N / 2, a.y + N / 2, b.x + N / 2 + Math.floor(cw / 2), col);
      }
    }
    for (const p of nodes) {
      const a = at(p.id);
      const own = hasPatent(g, p.id);
      const why = own ? null : patentRefusal(g, p.id);
      const locked = !own && p.requires.some((q) => !hasPatent(g, q));
      const can = !own && !why;
      const sel = st.pinned === p.id;
      ui.region(a.x - 1, a.y - 1, N + 2, N + 12, 'button');
      const hov = ui.hover(a.x - 1, a.y - 1, N + 2, N + 12);
      if (hov) hover = p.id;
      ui.fill(a.x - 1, a.y - 1, N + 2, N + 2, sel ? C.bone : own ? BRANCH_COL[bx.b] : can ? (Math.sin(ui.time * 5) > 0 ? C.teal1 : C.teal0) : C.ink);
      ui.fill(a.x, a.y, N, N, own ? C.ground1 : locked ? C.shadow : C.hull0);
      ui.ctx.globalAlpha = locked ? 0.35 : 1;
      const ic = NODE_ICON[p.id];
      if (ic in ITEMS) ui.ctx.drawImage(itemIcon(ic), a.x + 2, a.y + 2, 16, 16);
      else uiIcon(ui, ic as UIconName, a.x + 2, a.y + 2);
      ui.ctx.globalAlpha = 1;
      ui.text(own ? ICON.check : `${p.cost}`, a.x + N / 2, a.y + N + 1, own ? BRANCH_COL[bx.b] : can ? C.gold : C.hull1, { align: 'center' });
      if (hov && ui.clicked) {
        ui.eat();
        if (st.pinned === p.id && can) buy(app, p.id);
        else { st.pinned = p.id; ui.sfx('click'); }
      }
    }
  }
  // ---- the node described
  detail(app, hover ?? st.pinned, r.x + r.w - dw - 8, y0 - 2, dw, bottom - y0 + 2);
}

function buy(app: App, id: PatentId) {
  if (app.act({ k: 'patent', id }).ok) {
    app.audio.sfx('upgrade');
    app.toast(PATENTS[id].name, PATENTS[id].text, C.violet);
  }
}

function link(app: App, x0: number, y0: number, x1: number, y1: number, mx: number, col: string) {
  const ui = app.ui;
  // across to the gap after the source's column, then up or down there; going down, it runs on in
  // the gap just above the target's row and drops in from the top, so it never crosses a node
  ui.fill(Math.min(x0, mx), y0, Math.abs(mx - x0) + 1, 1, col);
  const yr = y1 > y0 ? y1 - N / 2 - 3 : y1;
  ui.fill(mx, Math.min(y0, yr), 1, Math.abs(yr - y0) + 1, col);
  ui.fill(Math.min(mx, x1), yr, Math.abs(x1 - mx) + 1, 1, col);
  if (yr !== y1) ui.fill(x1, yr, 1, y1 - yr, col);
}

function detail(app: App, id: PatentId, x: number, y: number, w: number, h: number) {
  const ui = app.ui;
  const g = app.game;
  const p = PATENTS[id];
  const inner = card(ui, x, y, w, h, BRANCH_NAMES[p.branch], BRANCH_COL[p.branch]);
  let yy = inner.y + 2;
  yy += ui.para(p.name, inner.x + 2, yy, inner.w - 4, C.gold) + 3;
  yy += ui.para(p.text, inner.x + 2, yy, inner.w - 4, C.bone) + 4;
  if (p.requires.length) yy += ui.para(`Needs: ${p.requires.map((q) => (hasPatent(g, q) ? ICON.check + ' ' : '') + PATENTS[q].name).join(', ')}`, inner.x + 2, yy, inner.w - 4, C.hull3) + 4;
  if (p.effect.k === 'offline') yy += ui.para(`Offline efficiency now ${Math.round(offlineEfficiency(g) * 100)}% (at most 75%)`, inner.x + 2, yy, inner.w - 4, C.hull3) + 4;
  const foot = inner.y + inner.h - 18;
  if (yy + 10 < foot - 2) {
    frame(ui, inner.x, yy, inner.w, Math.min(foot - 4 - yy, 40), 'paper', false);
    ui.clip(inner.x + 3, yy + 3, inner.w - 6, Math.min(foot - 4 - yy, 40) - 6);
    ui.para(p.flavor, inner.x + 5, yy + 4, inner.w - 10, C.ink);
    ui.unclip();
  }
  const own = hasPatent(g, id);
  const why = own ? 'Owned' : patentRefusal(g, id);
  const label = own ? `${ICON.check} Owned` : `Buy: ${p.cost} ${p.cost === 1 ? 'Patent' : 'Patents'}`;
  if (button(ui, 'patentBuy', inner.x, foot, inner.w, 16, label, { disabled: !!why, gold: !why, tip: why ?? 'Bought for good: it lasts through every Reorganize' })) buy(app, id);
  ui.fill(inner.x, foot - 3, inner.w, 1, rgba(C.hull0, 0.6));
}
