// The full-screen menus opened from the top bar: the research tree (glowing nodes on a
// starfield), statistics, the Trophy Shelf and options, all in the one menu template
// (widgets.ts menuTemplate: header bar with icon, title, tabs and close; content; a detail panel).
// Each covers the floor between the top bar and the crawl; Esc or the same button closes it.
import { C, rgba } from '../data/palette';
import { RESEARCH, RESEARCH_LIST, type ResearchId } from '../data/research';
import { ORDERS, CUSTOMERS } from '../data/orders';
import { ITEMS, ITEM_IDS, type ItemId } from '../data/items';
import { TROPHIES } from '../data/trophies';
import { BUILD, BUILD_BAR } from '../data/machines';
import { ICON, textWidth } from '../ui/font';
import { ACTION_LABELS, SHOWN_ACTIONS, keyLabel } from '../engine/input';
import { itemIcon, sheet, hasArt } from '../render/sprites';
import { available, researchFrac } from '../sim/systems/research';
import { orderFrac } from '../sim/systems/orders';
import { trophyValue } from '../sim/systems/stats';
import { Num } from '../engine/num';
import { frame, card, button, bar, badge, portrait, uiIcon, type UIconName } from './chrome';
import { fmt, menuTemplate, type MenuTab } from './widgets';
import type { Layout } from './layout';
import { modulesScreen, gradeCard, fgradeCard, offlineCard, sliceEndCard } from './fold';
import { ordersScreen } from './orders';
import { codexScreen, surveyScreen, megaScreen } from './act2screens';
import type { App } from './app';
import type { Rect } from '../ui/ui';

export type ScreenName = 'research' | 'orders' | 'stats' | 'trophies' | 'options' | 'modules' | 'grade' | 'offline' | 'sliceEnd'
  // Act II (Milestone 4): the Factory floor's grade card, the Codex, the Survey Office, the Megaproject
  | 'fgrade' | 'codex' | 'survey' | 'mega';

/** Screens added from other files (Milestones 5 and 6): drawn in the overlay rect like the rest. */
const EXTRA = new Map<string, (app: App, r: Rect, L: Layout) => void>();

/** Register a full-screen menu drawn by another file; open it with app.togglePanel(name).
 *    registerScreen('patents', (app, r) => { const { body } = menuTemplate(app, r, { ... }); ... });
 */
export function registerScreen(name: ScreenName, draw: (app: App, r: Rect, L: Layout) => void) {
  EXTRA.set(name, draw);
}

export function drawScreen(app: App, L: Layout) {
  const r = L.overlay;
  const extra = app.panel ? EXTRA.get(app.panel) : undefined;
  if (extra) return extra(app, r, L);
  switch (app.panel) {
    case 'research': return researchTree(app, r);
    case 'orders': return ordersScreen(app, r);
    case 'stats': return statsScreen(app, r);
    case 'trophies': return trophyShelf(app, r);
    case 'options': return optionsScreen(app, r);
    case 'modules': return modulesScreen(app, r);
    case 'grade': return gradeCard(app, L);
    case 'offline': return offlineCard(app, L);
    case 'sliceEnd': return sliceEndCard(app, L);
    case 'fgrade': return fgradeCard(app, L);
    case 'codex': return codexScreen(app, r);
    case 'survey': return surveyScreen(app, r);
    case 'mega': return megaScreen(app, r);
  }
}

// ------------------------------------------------------------------ the research tree

/** where each node sits: column, row, and 1 when its label goes under it (so neighbours' labels never meet) */
const TREE: Record<ResearchId, [number, number, number?]> = {
  pressing: [0, 1.5],
  surveyEast: [1, 0], gearcutting: [1, 2], slagBricks: [1, 3.2],
  copperSmelting: [2, 0, 1], splitters: [2.4, 2.2, 1], buffers: [2, 3.2, 1],
  wireDrawing: [3, 0.4],
  gizmoTheory: [4, 1.4],
  folding: [5, 1.4, 1],
  // Act II's page (columns 0-6)
  coalSeams: [0, 1.6],
  steelmaking: [1, 1.0], surveying: [1, 2.6, 1],
  overdrive: [2, 0], steamPower: [2, 1.4], crushing: [2, 2.8, 1],
  glassworks: [3, 0.5], refining: [3, 1.6, 1], machineKits: [3, 2.9, 1],
  circuits: [4, 1.0], concrete: [4, 2.6, 1],
  heavyMachines: [5, 0.2], motors: [5, 1.3, 1], nestedFolds: [5, 2.6],
  tuning: [6, 0.2, 1], greatDrill: [6, 1.9],
};

const NODE_ICON: Record<ResearchId, ItemId | UIconName> = {
  pressing: 'ironPlate', surveyEast: 'workshop', copperSmelting: 'copperIngot', wireDrawing: 'copperWire', gearcutting: 'gear',
  splitters: 'flow', buffers: 'orders', gizmoTheory: 'gizmo', slagBricks: 'slagBrick', folding: 'fold',
  coalSeams: 'coal', steelmaking: 'steel', overdrive: 'overdrive', steamPower: 'power', surveying: 'survey', glassworks: 'glass',
  crushing: 'gravel', concrete: 'concrete', refining: 'plastic', machineKits: 'machineKit', circuits: 'circuit',
  heavyMachines: 'heavy', tuning: 'mode', motors: 'motor', nestedFolds: 'fold', greatDrill: 'mega',
};

/** nodes with their own drawing in ui_research (the art director's), by frame */
const NODE_ART: Partial<Record<ResearchId, number>> = { surveyEast: 0, splitters: 1, buffers: 2, nestedFolds: 3 };

/** A research node's icon at 16 px (or 8 px when small). */
export function nodeIcon(ui: App['ui'], id: ResearchId, x: number, y: number, small = false) {
  const art = NODE_ART[id];
  const sz = small ? 8 : 16;
  if (art !== undefined && hasArt('ui_research')) { ui.ctx.drawImage(sheet('ui_research').frames[art], x, y, sz, sz); return; }
  const ic = NODE_ICON[id];
  if (ic in ITEMS) ui.ctx.drawImage(itemIcon(ic), x, y, sz, sz);
  else uiIcon(ui, ic as UIconName, x, y, small ? 1 : 0);
}

function starfield(app: App, r: Rect) {
  const ui = app.ui;
  ui.fill(r.x, r.y, r.w, r.h, C.ink);
  // nebulae: soft blots of teal and violet
  const ctx = ui.ctx;
  for (const [fx, fy, rad, col] of [[0.3, 0.45, 90, C.teal0], [0.72, 0.4, 110, C.violet], [0.55, 0.7, 70, C.iron0]] as [number, number, number, string][]) {
    const cx = r.x + r.w * fx, cy = r.y + r.h * fy;
    for (let k = 4; k > 0; k--) {
      ctx.fillStyle = rgba(col, 0.05);
      ctx.beginPath();
      ctx.arc(cx, cy, (rad * k) / 4, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  // stars that twinkle
  for (let i = 0; i < 140; i++) {
    const hx = (Math.sin(i * 127.1) * 43758.5453) % 1, hy = (Math.sin(i * 311.7) * 23421.631) % 1;
    const x = r.x + Math.abs(hx) * r.w, y = r.y + Math.abs(hy) * r.h;
    const tw = Math.sin(ui.time * (1 + (i % 5)) + i) > 0.6;
    ctx.fillStyle = i % 7 === 0 ? C.hot : i % 5 === 0 ? C.teal1 : C.hull2;
    ctx.globalAlpha = tw ? 1 : 0.4;
    ctx.fillRect(Math.round(x), Math.round(y), i % 11 === 0 ? 2 : 1, i % 11 === 0 ? 2 : 1);
  }
  ctx.globalAlpha = 1;
}

function researchTree(app: App, r: Rect) {
  const ui = app.ui;
  const g = app.game;
  // two pages: the Workshop's tree, and Act II's once Folding is done (the template's tabs)
  const act2 = g.done('folding');
  const page = act2 ? app.hud.treePage : 1;
  const ready2 = RESEARCH_LIST.some((d) => d.act === 2 && available(g, d.id));
  const tabs: MenuTab[] = act2 ? [
    { id: 'tree1', label: 'Workshop', icon: 'workshop', active: page === 1, onClick: () => { app.hud.treePage = 1; } },
    { id: 'tree2', label: 'Act II', icon: 'mega', active: page === 2, onClick: () => { app.hud.treePage = 2; }, badge: page === 1 && ready2 ? '!' : undefined },
  ] : [];
  const info = Math.min(170, Math.floor(r.w * 0.32));
  const { body, detail } = menuTemplate(app, r, { title: 'Research: the Hopper pays in items', accent: C.teal1, icon: 'research', tabs, detail: info });
  starfield(app, { x: r.x + 3, y: body.y - 2, w: r.w - 6, h: r.y + r.h - 3 - (body.y - 2) });
  const nodes = RESEARCH_LIST.filter((d) => (d.act ?? 1) === page);
  const cols = page === 2 ? 6 : 5;
  const mx = r.w >= 600 ? 48 : 34;
  const area = { x: body.x + mx - 8, y: body.y + 26, w: body.w - mx * 2 + 8, h: body.h - 66 };
  const pos = (id: ResearchId) => {
    const [c, row] = TREE[id];
    return { x: Math.round(area.x + (c / cols) * area.w), y: Math.round(area.y + (row / 3.2) * area.h) };
  };
  // the dashed links
  const ctx = ui.ctx;
  for (const d of nodes)
    for (const q of d.requires.filter((q2) => (RESEARCH[q2].act ?? 1) === page)) {
      const a = pos(q), b = pos(d.id);
      const done = g.done(d.id), open = g.done(q);
      const n = Math.max(1, Math.round(Math.hypot(b.x - a.x, b.y - a.y) / 3));
      const flow = Math.floor(ui.time * 8) % 2;
      ctx.fillStyle = done ? C.brass1 : open ? C.teal1 : C.hull0;
      for (let i = 0; i <= n; i++) if ((i + (open && !done ? flow : 0)) % 2 === 0) ctx.fillRect(Math.round(a.x + ((b.x - a.x) * i) / n), Math.round(a.y + ((b.y - a.y) * i) / n), 1, 1);
    }
  // the nodes
  let hovered: ResearchId | null = null;
  const placed: { x: number; y: number; w: number }[] = [];
  for (const d of nodes) {
    const p = pos(d.id);
    const done = g.done(d.id), can = available(g, d.id), sel = g.s.research.selected === d.id;
    const state = done ? 3 : sel ? 2 : can ? 1 : 0;
    // ui_node art is 32x32 with the icon at +8,+8; the code fallback is a 24 px ring in the same box
    const x = p.x - 16, y = p.y - 16;
    const hov = ui.hover(x, y, 32, 32);
    if (hov) hovered = d.id;
    ui.region(x, y, 32, 32, 'button');
    if (can && !sel) {
      // available nodes breathe
      const k = 0.25 + 0.2 * Math.sin(ui.time * 4 + d.num);
      ctx.fillStyle = rgba(C.hot, k);
      ctx.beginPath();
      ctx.arc(p.x, p.y, 19, 0, Math.PI * 2);
      ctx.fill();
    }
    if (sel) {
      ctx.fillStyle = rgba(C.teal1, 0.35 + 0.15 * Math.sin(ui.time * 6));
      ctx.beginPath();
      ctx.arc(p.x, p.y, 20, 0, Math.PI * 2);
      ctx.fill();
    }
    if (hasArt('ui_node')) ctx.drawImage(sheet('ui_node').frames[state], x, y);
    else {
      const ring = [C.hull0, C.brass1, C.teal1, C.gold][state];
      ctx.fillStyle = C.ink;
      ctx.beginPath(); ctx.arc(p.x, p.y, 12, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = ring;
      ctx.beginPath(); ctx.arc(p.x, p.y, 11, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = state ? C.shadow : C.ink;
      ctx.beginPath(); ctx.arc(p.x, p.y, 9, 0, Math.PI * 2); ctx.fill();
    }
    // locked icons are drawn darkened (the art director's note)
    ctx.globalAlpha = state === 0 ? 0.35 : 1;
    nodeIcon(ui, d.id, x + 8, y + 8);
    ctx.globalAlpha = 1;
    if (!done && researchFrac(g, d.id) > 0) bar(ui, x + 4, y + 31, 24, 4, researchFrac(g, d.id), C.teal1);
    // the label goes above or below its node (TREE's flag), whichever does not run into another
    // node, kept left of the info card; a long name loses its "The" when nothing else fits
    const others = nodes.filter((q) => q.id !== d.id).map((q) => pos(q.id));
    const place = (label: string, below: boolean) => {
      const lw = textWidth(label);
      const lx = Math.round(Math.min(p.x - lw / 2, detail!.x - 6 - lw));
      const ly = below ? y + 36 : y - 9;
      const free = others.every((o) => lx + lw < o.x - 13 || lx > o.x + 13 || ly + 9 < o.y - 13 || ly > o.y + 13)
        && placed.every((q) => lx + lw < q.x || lx > q.x + q.w || ly + 9 < q.y || ly > q.y + 9);
      return { label, lx, ly, lw, free };
    };
    const pref = !!TREE[d.id][2];
    const short = d.name.replace(/^The /, '');
    const spot = [place(d.name, pref), place(short, pref), place(d.name, !pref), place(short, !pref)].find((q) => q.free) ?? place(d.name, pref);
    placed.push({ x: spot.lx, y: spot.ly, w: spot.lw });
    ui.text(spot.label, spot.lx, spot.ly, done ? C.brass1 : can ? C.bone : C.hull1, { shadow: C.ink });
    if (hov && ui.clicked && (can || sel)) {
      ui.eat();
      app.act({ k: 'research', id: sel ? null : d.id });
    }
  }
  // the info card for the hovered (or selected) node
  const show = hovered ?? g.s.research.selected ?? nodes.find((d) => available(g, d.id))?.id ?? null;
  const inner = card(ui, detail!.x, detail!.y, detail!.w, detail!.h, show ? RESEARCH[show].name : 'Research', C.teal1, 'research');
  const banked = (Object.entries(g.s.research.bank) as [ItemId, Num][]).filter(([, v]) => v.gt(0));
  const end = inner.y + inner.h - (banked.length ? 24 : 0);
  /** what is still owed on a node, in items */
  const owed = (id: ResearchId) => {
    const prog = g.s.research.progress[id] ?? {};
    let n = 0;
    for (const [item, c] of Object.entries(RESEARCH[id].cost) as [ItemId, number][]) n += Math.max(0, c - (prog[item]?.toNumber() ?? 0));
    return n;
  };
  if (show) {
    const d = RESEARCH[show];
    const done = g.done(show);
    let y = inner.y;
    y += ui.para(`Unlocks ${d.unlocks}.`, inner.x, y, inner.w, C.bone) + 4;
    ui.text('Costs, delivered to the Hopper:', inner.x, y, C.hull2);
    y += 11;
    const prog = g.s.research.progress[show] ?? {};
    for (const [item, n] of Object.entries(d.cost) as [ItemId, number][]) {
      ctx.drawImage(itemIcon(item), inner.x, y);
      const have = Math.min(n, Math.floor(prog[item]?.toNumber() ?? 0));
      ui.text(`${ITEMS[item].name}: ${fmt(done ? n : have)}/${fmt(n)}`, inner.x + 11, y, C.bone);
      ui.text(done || have >= n ? ICON.check : `${Math.floor((have / n) * 100)}%`, inner.x + inner.w, y, done || have >= n ? C.leaf : C.teal1, { align: 'right' });
      y += 10;
      bar(ui, inner.x + 11, y, inner.w - 11, 4, done ? 1 : have / n, C.teal1);
      y += 7;
    }
    if (d.requires.length) {
      y += 2;
      y += ui.para(`Needs: ${d.requires.map((q) => (g.done(q) ? ICON.check : '') + RESEARCH[q].name).join(', ')}`, inner.x, y, inner.w, C.hull2) + 2;
    }
    const sel = g.s.research.selected === show;
    if (done) { ui.text(`${ICON.check} Researched`, inner.x, y + 4, C.leaf); y += 16; }
    else if (available(g, show)) {
      if (button(ui, 'selectNode', inner.x, y + 2, inner.w, 16, sel ? 'Selected (click to clear)' : 'Research this', { gold: !sel, active: sel })) app.act({ k: 'research', id: sel ? null : show });
      y += 22;
    } else { ui.text(`${ICON.lock} Locked`, inner.x, y + 4, C.hull1); y += 16; }
    // the whole node's progress, big
    if (!done && y + 24 <= end) {
      const f = researchFrac(g, show);
      ui.text('In all', inner.x, y + 5, C.hull2);
      ui.text(`${Math.floor(f * 100)}%`, inner.x + inner.w, y, C.teal1, { align: 'right', scale: 2, shadow: C.ink });
      bar(ui, inner.x, y + 19, inner.w, 7, f, C.teal1);
      const gl = (ui.time * 0.8) % 1.6;
      if (gl < 1 && f > 0.03) ui.fill(inner.x + 1 + Math.floor(gl * Math.max(1, inner.w * f - 3)), y + 20, 2, 5, C.bone, 0.5);
      y += 31;
    }
    // what it leads to
    const next = RESEARCH_LIST.filter((q) => q.requires.includes(show));
    if (next.length && y + 20 <= end) {
      ui.text('Leads to', inner.x, y, C.gold);
      y += 10;
      for (const q of next) {
        if (y + 10 > end) break;
        nodeIcon(ui, q.id, inner.x, y, true);
        ui.clip(inner.x + 11, y, inner.w - 11, 10);
        ui.text(`${g.done(q.id) ? ICON.check + ' ' : ''}${q.name}`, inner.x + 11, y, g.done(q.id) ? C.brass1 : C.bone);
        ui.unclip();
        y += 10;
      }
      y += 4;
    }
    // ready now: every node that can be picked, the closest to done starred
    const ready = RESEARCH_LIST.filter((q) => !g.done(q.id) && available(g, q.id) && q.id !== show).sort((p, q) => owed(p.id) - owed(q.id));
    if (ready.length && y + 22 <= end) {
      ui.text('Ready to research', inner.x, y, C.teal1);
      y += 10;
      ready.forEach((q, i) => {
        if (y + 12 > end) return;
        const best = i === 0;
        const hv = ui.hover(inner.x, y - 1, inner.w, 12);
        ui.region(inner.x, y - 1, inner.w, 12, 'button');
        if (best) ui.fill(inner.x, y - 1, inner.w, 12, C.gold, 0.12 + 0.08 * Math.sin(ui.time * 5));
        else if (hv) ui.fill(inner.x, y - 1, inner.w, 12, C.teal1, 0.12);
        nodeIcon(ui, q.id, inner.x + 1, y, true);
        ui.clip(inner.x + 12, y, inner.w - 44, 10);
        ui.text(q.name, inner.x + 12, y, best ? C.gold : C.bone);
        ui.unclip();
        ui.text(best ? `${ICON.star} ${fmt(owed(q.id))}` : fmt(owed(q.id)), inner.x + inner.w - 1, y, best ? C.gold : C.hull3, { align: 'right' });
        if (hv) {
          ui.tip([{ text: q.name, color: C.gold }, { text: `Unlocks ${q.unlocks}.` }, { text: `${fmt(owed(q.id))} items still owed.${best ? ' The closest to done.' : ''} Click to research it.`, color: C.hull2 }], 180);
          if (ui.clicked) { ui.eat(); ui.sfx('click'); app.act({ k: 'research', id: q.id }); }
        }
        y += 12;
      });
    }
    // the lab at work in whatever room is left (the art director's scene)
    if (hasArt('research_lab')) {
      const lab = sheet('research_lab');
      const room = end - 4 - y;
      const k = room >= lab.h * 2 + 4 && inner.w >= lab.w * 2 ? 2 : 1;
      if (room >= lab.h + 4) {
        const lx = inner.x + Math.floor((inner.w - lab.w * k) / 2), ly = end - 2 - lab.h * k;
        ui.fill(lx - 2, ly - 2, lab.w * k + 4, lab.h * k + 4, C.ink);
        ctx.drawImage(lab.frames[Math.floor(ui.time * lab.fps) % lab.frames.length], lx, ly, lab.w * k, lab.h * k);
      }
    }
  }
  // the bank
  if (banked.length) {
    let bx = inner.x;
    const by = inner.y + inner.h - 12;
    ui.text('Banked:', bx, by - 11, C.hull2);
    for (const [item, v] of banked.slice(0, 5)) {
      ctx.drawImage(itemIcon(item), bx, by);
      bx += 11 + ui.text(v.format(), bx + 10, by, C.hull3);
    }
  }
}

// ------------------------------------------------------------------ stats

function statsScreen(app: App, r: Rect) {
  const ui = app.ui;
  const g = app.game;
  const s = g.s;
  const { body } = menuTemplate(app, r, { title: 'Statistics', accent: C.hot, icon: 'stats' });
  const colW = Math.floor((body.w - 6) / 2);
  const a = card(ui, body.x, body.y, colW, body.h, 'The run', C.hot, 'clock');
  const secs = Math.floor(g.seconds);
  const rows: [string, string][] = [
    ['Time played', `${Math.floor(secs / 3600)}h ${Math.floor((secs % 3600) / 60)}m ${secs % 60}s`],
    ['Coin now', s.coin.format()],
    ['Coin earned', s.earned.format()],
    ['Coin per minute', Math.round(g.incomePerMin()).toLocaleString('en-US')],
    ['Research done', `${s.research.done.length} / ${RESEARCH_LIST.length}`],
    ['Orders filled', String(s.orders.done.length)],
    ['Land owned', `${s.land.length} chunks`],
    ['Clicks', (s.counters.clicks ?? 0).toLocaleString('en-US')],
    ['Cranks', (s.counters.cranks ?? 0).toLocaleString('en-US')],
    ['Slag shovelled', (s.counters.shovels ?? 0).toLocaleString('en-US')],
    ['Sparks caught', String(s.counters.sparks ?? 0)],
    ['Trophies', `${TROPHIES.filter((t) => g.flag('trophy:' + t.id)).length} / ${TROPHIES.length}`],
  ];
  let y = a.y;
  for (const [k, v] of rows) {
    if (y > a.y + a.h - 10) break;
    ui.text(k, a.x, y, C.hull2);
    ui.text(v, a.x + a.w, y, C.bone, { align: 'right' });
    y += 10;
  }
  y += 4;
  // the last minute's income, one bar a second
  const ch = Math.min(40, a.y + a.h - y - 24);
  if (ch >= 16) {
    ui.text('Coin per second, last minute', a.x, y, C.hull2);
    y += 10;
    ui.fill(a.x, y, a.w, ch, C.ink);
    const inc = s.income;
    const mx = Math.max(1, ...inc);
    const bw = Math.max(1, Math.floor(a.w / 60));
    inc.slice(-60).forEach((v, i) => {
      const hh = Math.round((v / mx) * (ch - 2));
      ui.fill(a.x + i * bw, y + ch - 1 - hh, Math.max(1, bw - 1), hh, i === inc.slice(-60).length - 1 ? C.gold : C.brass1);
    });
    ui.text(`peak ${Math.round(mx)}/s`, a.x + a.w - 2, y + 2, C.hull2, { align: 'right' });
    y += ch + 6;
  }
  let bx = a.x;
  for (const kind of BUILD_BAR) {
    const n = s.ents.filter((e) => e.kind === kind).length;
    if (!n) continue;
    if (bx + 30 > a.x + a.w) { bx = a.x; y += 18; }
    if (y > a.y + a.h - 16) break;
    ui.ctx.drawImage(sheet(kind).frames[0], bx, y);
    ui.text(String(n), bx + 17, y + 5, C.bone);
    bx += 32;
  }
  const b = card(ui, body.x + colW + 6, body.y, body.w - colW - 6, body.h, 'Delivered (Dock and Hopper)', C.hot, 'orders');
  y = b.y;
  for (const id of ITEM_IDS) {
    if (y > b.y + b.h - 10) break;
    const v = s.delivered[id];
    ui.ctx.globalAlpha = v ? 1 : 0.3;
    ui.ctx.drawImage(itemIcon(id), b.x, y);
    ui.text(ITEMS[id].name, b.x + 11, y, v ? C.bone : C.hull1);
    ui.ctx.globalAlpha = 1;
    ui.text(v ? v.format() : '-', b.x + b.w, y, v ? C.gold : C.hull1, { align: 'right' });
    y += 10;
  }
}

// ------------------------------------------------------------------ trophies

function trophyShelf(app: App, r: Rect) {
  const ui = app.ui;
  const g = app.game;
  const got = (id: string) => g.flag('trophy:' + id);
  const sideW = Math.min(180, Math.floor(r.w * 0.34));
  const { body, detail } = menuTemplate(app, r, { title: `The Trophy Shelf: ${TROPHIES.filter((t) => got(t.id)).length} of ${TROPHIES.length}`, accent: C.gold, icon: 'trophies', detail: sideW });
  // the closest unearned trophies, with progress, on the right
  const shelfW = body.w;
  // the shelf shrinks its cells a little when there are many trophies, so every one shows
  let cell = 38;
  const rowsFor = (c: number) => Math.ceil(TROPHIES.length / Math.max(1, Math.floor((shelfW - 8) / c)));
  while (cell > 28 && rowsFor(cell) * (cell + 4) > body.h - 14) cell -= 2;
  const cols = Math.max(1, Math.floor((shelfW - 8) / cell));
  const x0 = body.x + Math.floor((shelfW - cols * cell) / 2);
  TROPHIES.forEach((t, i) => {
    const x = x0 + (i % cols) * cell, y = body.y + Math.floor(i / cols) * (cell + 4);
    if (y + cell > body.y + body.h - 12) return;
    const have = got(t.id);
    // a brass shelf plank under each row
    if (i % cols === 0) {
      ui.fill(x0 - 4, y + cell - 3, cols * cell + 8, 3, C.brass1);
      ui.fill(x0 - 4, y + cell, cols * cell + 8, 1, C.brass0);
    }
    ui.fill(x + 3, y + 2, cell - 6, cell - 7, C.ink);
    ui.fill(x + 4, y + 3, cell - 8, cell - 9, have ? C.ground1 : C.shadow);
    const ix = x + Math.floor(cell / 2) - 8, iy = y + Math.floor((cell - 5) / 2) - 8;
    if (have) {
      // earned: a gentle glint sweeping across
      if (t.icon) ui.ctx.drawImage(itemIcon(t.icon), ix, iy, 16, 16);
      else uiIcon(ui, 'trophies', ix, iy);
      const gl = (ui.time * 0.6 + i * 0.13) % 3;
      if (gl < 1) ui.fill(x + 4 + Math.floor(gl * (cell - 10)), y + 3, 2, cell - 9, C.hot, 0.25);
    } else {
      ui.ctx.globalAlpha = 0.18;
      if (t.icon) ui.ctx.drawImage(itemIcon(t.icon), ix, iy, 16, 16);
      else uiIcon(ui, 'trophies', ix, iy);
      ui.ctx.globalAlpha = 1;
      ui.text('?', x + Math.floor(cell / 2) - 2, iy + 4, C.hull1);
    }
    if (ui.hover(x, y, cell, cell)) {
      ui.fill(x + 3, y + 2, cell - 6, 1, C.gold);
      const v = Math.min(t.n, trophyValue(g, t));
      ui.tip([{ text: have ? t.name : '???', color: have ? C.gold : C.hull2 }, { text: t.desc }, { text: have ? 'Earned!' : `${Math.floor(v).toLocaleString('en-US')} / ${t.n.toLocaleString('en-US')}`, color: have ? C.leaf : C.hull2 }], 170);
    }
  });
  const side = card(ui, detail!.x, detail!.y, detail!.w, detail!.h, 'Almost there', C.gold, 'star');
  const next = TROPHIES.filter((t) => !got(t.id))
    .map((t) => ({ t, f: Math.min(1, trophyValue(g, t) / t.n) }))
    .sort((p, q) => q.f - p.f)
    .slice(0, Math.max(1, Math.floor((side.h - 14) / 30)));
  let y = side.y;
  for (const { t, f } of next) {
    ui.text(t.name, side.x, y, C.bone);
    ui.text(`${Math.floor(f * 100)}%`, side.x + side.w, y, C.gold, { align: 'right' });
    y += 10;
    ui.clip(side.x, y, side.w, 10);
    ui.text(t.desc, side.x, y, C.hull2);
    ui.unclip();
    y += 10;
    bar(ui, side.x, y, side.w, 4, f, C.gold);
    y += 10;
  }
  if (!next.length) ui.para('Every trophy on the shelf. The swamp salutes you.', side.x, y, side.w, C.gold);
  ui.text('Trophies are for glory in the slice; later each adds a small bonus.', body.x + 2, body.y + body.h - 9, C.hull2);
}

// ------------------------------------------------------------------ options

function optionsScreen(app: App, r: Rect) {
  const ui = app.ui;
  const { body } = menuTemplate(app, r, { title: 'Options and keys', accent: C.bone, icon: 'options' });
  const colW = Math.floor((body.w - 6) / 2);
  const a = card(ui, body.x, body.y, colW, body.h, 'Settings', C.bone, 'options');
  let y = a.y;
  const row = (label: string, on: boolean, click: () => void) => {
    ui.text(label, a.x, y + 3, C.bone);
    if (button(ui, 'opt:' + label, a.x + a.w - 44, y, 44, 13, on ? 'on' : 'off', { active: on })) click();
    y += 16;
  };
  row('Sound', !app.muted, () => { app.muted = !app.muted; app.audio.setMuted(app.muted); });
  row('Scientific notation', app.notation === 'scientific', () => { app.notation = app.notation === 'scientific' ? 'standard' : 'scientific'; });
  row('Reduced motion', app.renderer.fx.calm, () => { app.renderer.fx.calm = !app.renderer.fx.calm; });
  y += 4;
  if (button(ui, 'save', a.x, y, a.w, 14, 'Save now')) { app.save(); app.toast('Saved', 'Autosave runs every 30 s and when you leave.', C.leaf); }
  y += 17;
  if (button(ui, 'export', a.x, y, a.w, 14, 'Export save (copy)')) app.copyExport();
  y += 17;
  if (button(ui, 'import', a.x, y, a.w, 14, 'Import save (paste)')) app.promptImport();
  y += 17;
  if (button(ui, 'title', a.x, y, a.w, 14, 'Back to the title')) { app.save(); app.toTitle(); }
  const b = card(ui, body.x + colW + 6, body.y, body.w - colW - 6, body.h, 'Keys', C.bone, 'build');
  y = b.y;
  ui.text('WASD, arrows, right-drag: pan', b.x, y, C.hull2); y += 10;
  ui.text('Wheel or Q/E: zoom. 1-9: build.', b.x, y, C.hull2); y += 12;
  for (const act of SHOWN_ACTIONS.filter((x) => !x.startsWith('slot') && !x.startsWith('pan') && !x.startsWith('zoom'))) {
    if (y > b.y + b.h - 10) break;
    ui.text(ACTION_LABELS[act], b.x, y, C.bone);
    ui.text(app.input.binds[act].map(keyLabel).join('/'), b.x + b.w, y, C.gold, { align: 'right' });
    y += 10;
  }
  void textWidth; void badge; void BUILD;
}
