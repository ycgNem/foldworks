// The Patent Office (DESIGN.md §19, Milestone 5), a page of the ledger (docs/hud-180.md): the
// Patent tree drawn in pencil on paper. Head starts run along the top, rules, automation and
// offline efficiency in three groups under them; each node is a paper disc with its own picture and
// its price on a little chip (a gold rim when you can buy it now, dim paper when its lines lead to
// nodes not yet bought), owned ones stamped with the green tick, the selected one circled in red
// pencil. The right page is the node in numbers, as rows: what it does, what buying it changes in
// this run, its price and what it needs, its flavour line and the Buy button; the Committee speaks
// at its top. Presentation only: buying is the `patent` command.
//
// The node data in src/data/patents.ts is read generically (`effect.k` and its fields, prules() by
// field name), so the page keeps working when nodes, effects or prices change; a node this file
// has no picture or label for gets one from its effect and its name.
import { C } from '../data/palette';
import { PATENTS, PATENT_LIST, BRANCH_NAMES, type PatentId, type PatentBranch, type PatentDef } from '../data/patents';
import { ITEMS } from '../data/items';
import { RESEARCH } from '../data/research';
import { UPGRADES, BUILD } from '../data/machines';
import { CHUNKS } from '../data/land';
import { RULES } from '../data/rules';
import { IDLE } from '../data/idle';
import { ICON, smallWidth, bigWidth, SMALL_H } from '../ui/font';
import { itemIcon, sheet, hasArt, spriteName } from '../render/sprites';
import { amount, pct } from '../engine/fmt';
import { hasPatent, patentRefusal, prules } from '../sim/patents';
import { offlineEfficiency } from '../sim/offline';
import { previewPatents } from '../sim/reorganize';
import { button, uiIcon, chip, chipWidth, rule, stamp, UICON, type UIconName } from './chrome';
import { menuTemplate } from './widgets';
import { layoutRich, drawLayout } from '../ui/rich';
import { T, roleInk, type Role } from '../ui/theme';
import type { App } from './app';
import type { Rect } from '../ui/ui';
import { bookArea, heading, disc, tick, pencilCircle, speak, ROW_H } from './ledger';
import { committeeFallback } from './reorganize';

/** A node's picture: an item icon, a UI icon, or a building's sprite (frame f). */
type NodeIcon = { item: string } | { ui: UIconName } | { sprite: string; f?: number };

/** One distinct picture per node (the critic: the flame was used twice). */
const NODE_ICON: Partial<Record<string, NodeIcon>> = {
  // head starts: what the run starts with
  bellows: { sprite: 'furnace' }, starterLine: { sprite: 'miner' }, notebooks: { ui: 'codex' }, copperDeeds: { item: 'copperIngot' },
  gearPatterns: { item: 'gear' }, gizmoPatent: { item: 'gizmo' }, foldingPatent: { ui: 'fold' }, grant: { ui: 'coin' },
  overdriveHabit: { ui: 'overdrive' }, coalRights: { item: 'coal' }, steelCharter: { item: 'steel' }, glassNotes: { item: 'glass' },
  circuitPatent: { item: 'circuit' },
  // rules
  surveyCharter: { ui: 'claim' }, widerBox: { sprite: 'module' }, quickAudit: { ui: 'clock' }, moreAuditors: { ui: 'stats' },
  // the Milestone 5-6 review round (the reset layer): Fresh Dies replaces Deep Heaps, Cool Hands, Stamping Dies
  sideIntake: { ui: 'flow' }, nestedBoxes: { ui: 'factory' }, freshDies: { ui: 'heavy' },
  // automation
  shovelFrog: { item: 'slag' }, labAssistant: { ui: 'research' }, orderClerk: { ui: 'orders' }, stampPress: { sprite: 'press' },
  draughtsman: { ui: 'build' }, drawerSpace: { ui: 'blueprint' },
  // offline
  nightShift: { ui: 'overnight' }, nightWatch: { ui: 'lock' }, lightsOn: { ui: 'power' },
};

/** A node with no entry above gets the picture of its effect. */
const EFFECT_ICON: Record<string, NodeIcon> = {
  head: { ui: 'play' }, foldMax: { sprite: 'module' }, audit: { ui: 'clock' }, maxAudits: { ui: 'stats' }, sideIntake: { ui: 'flow' },
  heapCap: { sprite: 'heap', f: 4 }, claims: { ui: 'claim' }, nestedMax: { ui: 'factory' }, overdriveCool: { ui: 'pause' },
  stampGrowth: { ui: 'heavy' }, shovel: { item: 'slag' }, lab: { ui: 'research' }, clerk: { ui: 'orders' }, stampPress: { sprite: 'press' },
  drone: { ui: 'build' }, offline: { ui: 'overnight' },
};

/** Short labels under the nodes. A list is tried in order, the first that fits its room wins. */
const SHORT: Partial<Record<string, string | string[]>> = {
  bellows: 'Bellows', starterLine: 'Miner', notebooks: 'Notes', copperDeeds: 'Copper', gearPatterns: 'Gears', gizmoPatent: 'Gizmo',
  foldingPatent: ['Folding', 'Fold'], grant: 'Grant', overdriveHabit: ['Overdrive', 'Drive'], coalRights: 'Coal', steelCharter: 'Steel', glassNotes: 'Glass',
  circuitPatent: ['Circuit', 'Chip'],
  surveyCharter: 'Claims', widerBox: 'Wider', quickAudit: 'Quick', moreAuditors: ['Auditors', 'Audit'], sideIntake: ['Intake', 'Side'],
  nestedBoxes: ['Nesting', 'Nest'], freshDies: 'Dies',
  shovelFrog: ['Shovel', 'Dig'], labAssistant: 'Lab', orderClerk: 'Clerk', stampPress: 'Press', draughtsman: ['Drafter', 'Draft'], drawerSpace: ['Drawer', 'Slots'],
  nightShift: 'Shift', nightWatch: 'Watch', lightsOn: 'Lights',
};

const STOP = new Set(['a', 'an', 'the', 'of', 'on', 'by', 'and', 'in', 'to', 'for']);

/** A node's label: its short name, or the first word of its name that says something. */
function shortLabel(p: PatentDef, room = Infinity): string {
  const s = SHORT[p.id];
  if (Array.isArray(s)) return s.find((t) => smallWidth(t.toUpperCase()) <= room) ?? s[s.length - 1];
  if (s) return s;
  const words = p.name.replace(/[^A-Za-z' ]/g, ' ').split(/\s+/).filter((w) => w && !STOP.has(w.toLowerCase()));
  return words[0] ?? p.name;
}

/** Each branch's ink on paper. */
const BRANCH_ROLE: Record<string, Role> = { head: 'coin', rule: 'research', auto: 'good', offline: 'reset' };
const branchRole = (b: string): Role => BRANCH_ROLE[b] ?? 'ink';
const branchName = (b: string) => (BRANCH_NAMES as Record<string, string>)[b] ?? b;

/** the node pinned by a click (the hovered one wins while the mouse is on a node) */
const st = { pinned: 'bellows' as PatentId };

/** a node's disc */
const N = 20;

/** How a branch's nodes lay out in a box w wide: the column width, and the labels (one row, two
 * staggered rows, or none when even two columns are too narrow for them). */
function branchLayout(nodes: PatentDef[], w: number, grow = 0) {
  const cols = Math.max(...nodes.map((p) => p.pos[0])) + 1, rows = Math.max(...nodes.map((p) => p.pos[1])) + 1;
  const cw = Math.floor(w / cols);
  const fits = (room: number) => nodes.every((p) => smallWidth(shortLabel(p, room).toUpperCase()) <= room);
  const labels: 'one' | 'two' | 'none' = fits(cw - 3) ? 'one' : fits(2 * cw - 6) ? 'two' : 'none';
  const rh = N + (labels === 'one' ? SMALL_H + 6 : labels === 'two' ? 2 * SMALL_H + 9 : 5) + grow;
  return { cols, rows, cw, labels, rh, h: rows * rh };
}

export function patentsScreen(app: App, r0: Rect) {
  const ui = app.ui;
  const g = app.game;
  const m = g.s.meta;
  const r = bookArea(r0);
  const { body, detail } = menuTemplate(app, r, { title: 'The Patent Office', accent: C.violet, icon: 'star', detail: Math.max(150, Math.min(200, Math.floor(r.w * 0.34))) });
  if (!PATENTS[st.pinned]) st.pinned = PATENT_LIST[0].id;
  // ---- the bank: the Patents to spend, the runs, what this run would bank, and the way to Reorganize
  const pv = previewPatents(g);
  let x = body.x;
  ui.big(m.patents.format(), x, body.y + 1, T.reset);
  x += bigWidth(m.patents.format()) + 4;
  ui.text(m.patents.eq(1) ? 'Patent to spend' : 'Patents to spend', x, body.y + 3, T.ink);
  const bankW = bigWidth(m.patents.format()) + 4 + layoutRich(m.patents.eq(1) ? 'Patent to spend' : 'Patents to spend').w;
  const bw = layoutRich('{u:reset} Reorganize').w + 14;
  const bx = body.x + body.w - bw;
  if (button(ui, 'toReorganize', bx, body.y - 1, bw, 15, '{u:reset} Reorganize', { tip: [{ text: '{u:reset} {big:Reorganize}' }, { text: 'what a reset gives, keeps and loses' }] })) app.panel = 'reorganize';
  const runChips = [
    { text: `${m.runs} ${m.runs === 1 ? 'reset' : 'resets'}`, role: 'soft' as Role, tip: '{u:reset} Reorganizes so far' },
    { text: `+${pv.now} this run`, role: 'reset' as Role, tip: `{u:reset} a Reorganize now banks {reset:+${pv.now}}` },
  ];
  let cx = body.x + bankW + 8;
  for (const c of runChips) {
    const cw = chipWidth(c.text);
    if (cx + cw > bx - 4) break;
    chip(ui, cx, body.y, c.text, { role: c.role });
    ui.hint(cx, body.y, cw, 12, c.tip, 180);
    cx += cw + 3;
  }
  // ---- the tree: head starts on top, the other branches side by side below
  const ty = body.y + 17, bottom = body.y + body.h;
  let hover: PatentId | null = null;
  const branches = [...new Set(PATENT_LIST.map((p) => p.branch))];
  const lower = branches.filter((b) => b !== 'head');
  const boxes: { b: PatentBranch; x: number; y: number; w: number; h: number }[] = [];
  const headNodes = PATENT_LIST.filter((p) => p.branch === 'head');
  const gap = 8;
  const lw = Math.floor((body.w - gap * (lower.length - 1)) / Math.max(1, lower.length));
  // spare height spreads into the rows (a roomy page breathes; at most 12 px a row)
  const headL = headNodes.length ? branchLayout(headNodes, body.w) : null;
  const lowL = lower.map((b) => branchLayout(PATENT_LIST.filter((p) => p.branch === b), lw));
  const lowRows = Math.max(0, ...lowL.map((l) => l.rows));
  const need = (headL ? 15 + headL.h + 3 : 0) + 15 + Math.max(0, ...lowL.map((l) => l.h));
  const grow = Math.max(0, Math.min(12, Math.floor((bottom - ty - need - 4) / Math.max(1, (headL?.rows ?? 0) + lowRows))));
  let headH = 0;
  if (headNodes.length) {
    headH = 15 + branchLayout(headNodes, body.w, grow).h;
    boxes.push({ b: 'head' as PatentBranch, x: body.x, y: ty, w: body.w, h: headH });
  }
  lower.forEach((b, i) => boxes.push({ b, x: body.x + i * (lw + gap), y: ty + headH + 3, w: lw, h: bottom - (ty + headH + 3) }));
  for (const bx0 of boxes) {
    const role = branchRole(bx0.b);
    const ink = roleInk(role);
    heading(ui, branchName(bx0.b), bx0.x, bx0.y, bx0.w, role);
    const nodes = PATENT_LIST.filter((p) => p.branch === bx0.b);
    if (!nodes.length) continue;
    const L = branchLayout(nodes, bx0.w, grow);
    // a box too short for its labels drops them (the name is on the right page and the tip)
    const labels = bx0.y + 15 + L.h <= bx0.y + bx0.h + 1 ? L.labels : 'none';
    const rh = labels === L.labels ? L.rh : N + 5;
    const at = (id: PatentId) => {
      const p = PATENTS[id];
      return { x: bx0.x + p.pos[0] * L.cw + Math.floor((L.cw - N) / 2), y: bx0.y + 16 + p.pos[1] * rh };
    };
    // pencil lines to prerequisites first, under the nodes
    for (const p of nodes) {
      const a = at(p.id);
      for (const q of p.requires) {
        if (!PATENTS[q] || PATENTS[q].branch !== bx0.b) continue;
        const b = at(q);
        link(app, b.x + N / 2, b.y + N / 2, a.x + N / 2, a.y + N / 2, b.x + N / 2 + Math.floor(L.cw / 2), hasPatent(g, q) ? T.good : T.paperEdge);
      }
    }
    for (const p of nodes) {
      const a = at(p.id);
      const own = hasPatent(g, p.id);
      const why = own ? null : patentRefusal(g, p.id);
      const locked = !own && p.requires.some((q) => !hasPatent(g, q));
      const can = !own && !why;
      const sel = st.pinned === p.id;
      // the node and its label are one button
      const stag = labels === 'two' && p.pos[0] % 2 === 1;
      const lh = labels === 'none' ? 0 : stag ? 2 * SMALL_H + 7 : SMALL_H + 4;
      const bw0 = Math.max(N + 2, L.cw - 2), bx1 = a.x + N / 2 - Math.floor(bw0 / 2);
      ui.region(a.x - 1, a.y - 1, N + 7, N + 4, 'button');
      const hov = ui.hover(bx1, a.y - 1, bw0, N + 1 + lh);
      ui.mark('patent_' + p.id, a.x - 1, a.y - 1, N + 2, N + 2);
      if (hov) hover = p.id;
      disc(ui, a.x, a.y, N, hov ? 'hover' : own ? 'owned' : can ? 'afford' : locked ? 'locked' : 'normal');
      // one you can buy now glints round its gold rim
      if (can) {
        const t = ui.time * 3 + p.pos[0];
        ui.ctx.fillStyle = T.paperHi;
        ui.ctx.fillRect(Math.round(a.x + N / 2 + Math.cos(t) * (N / 2 - 1.5)), Math.round(a.y + N / 2 + Math.sin(t) * (N / 2 - 1.5)), 1, 1);
      }
      ui.ctx.globalAlpha = locked ? 0.45 : 1;
      drawNodeIcon(app, p, a.x + 2, a.y + 2);
      ui.ctx.globalAlpha = 1;
      if (own) tick(ui, a.x + N - 8, a.y + N - 9);
      else priceTag(app, String(p.cost), a.x + N - 4, a.y + N - 5, can ? 'reset' : 'soft');
      if (sel) pencilCircle(ui, a.x, a.y, N);
      if (labels !== 'none') {
        const room = (labels === 'two' ? 2 * L.cw - 6 : L.cw - 3);
        const lab = shortLabel(p, room).toUpperCase();
        const lx = a.x + N / 2, ly = a.y + N + 3 + (stag ? SMALL_H + 3 : 0);
        // a scrap of paper behind it, so a pencil line passing through the gap goes under the word
        const lw0 = smallWidth(lab) + 2;
        ui.ctx.fillStyle = T.paper;
        ui.ctx.fillRect(Math.round(lx - lw0 / 2), ly - 1, lw0, SMALL_H + 2);
        if (stag) { ui.ctx.fillStyle = T.paperEdge; ui.ctx.fillRect(Math.round(lx), a.y + N + 1, 1, SMALL_H + 1); }
        ui.small(lab, lx, ly, own ? ink : can || sel || hov ? T.ink : T.inkSoft, { align: 'center' });
      }
      if (hov && ui.clicked) {
        ui.eat();
        if (st.pinned === p.id && can) buy(app, p.id);
        else { st.pinned = p.id; ui.sfx('click'); }
      }
    }
  }
  // ---- the node described, on the right page
  if (detail) nodePage(app, hover ?? st.pinned, detail);
}

/** A price on a node: a little paper chip with the number in Pip, its right edge at x. */
function priceTag(app: App, s: string, x: number, y: number, role: Role) {
  const ui = app.ui;
  const w = smallWidth(s) + 4, h = SMALL_H + 3;
  const x0 = Math.round(x - w + 4);
  ui.ctx.fillStyle = roleInk(role === 'soft' ? 'soft' : role);
  ui.ctx.fillRect(x0 + 1, y, w - 2, h);
  ui.ctx.fillRect(x0, y + 1, w, h - 2);
  ui.ctx.fillStyle = T.paperHi;
  ui.ctx.fillRect(x0 + 1, y + 1, w - 2, h - 2);
  ui.small(s, x0 + 2, y + 2, roleInk(role));
}

/** A node's picture, 16x16 at (x, y). */
function drawNodeIcon(app: App, p: PatentDef, x: number, y: number) {
  const ui = app.ui;
  const ic = NODE_ICON[p.id] ?? EFFECT_ICON[(p.effect as { k: string }).k] ?? { ui: 'star' };
  if ('item' in ic && ic.item in ITEMS) ui.ctx.drawImage(itemIcon(ic.item), x, y, 16, 16);
  else if ('sprite' in ic && hasArt(spriteName(ic.sprite))) {
    const s = sheet(spriteName(ic.sprite));
    const f = s.frames[Math.min(ic.f ?? 0, s.frames.length - 1)];
    ui.ctx.drawImage(f, 0, Math.max(0, f.height - 16), Math.min(16, f.width), Math.min(16, f.height), x, y, 16, 16);
  } else if ('ui' in ic && ic.ui in UICON) uiIcon(ui, ic.ui, x, y);
  else uiIcon(ui, 'star', x, y);
}

function buy(app: App, id: PatentId) {
  if (app.act({ k: 'patent', id }).ok) {
    app.audio.sfx('upgrade');
    app.toast(PATENTS[id].name, PATENTS[id].text, C.violet);
  }
}

/** A pencil line from a prerequisite to a node: across to the gap after the source's column, then
 * up or down there; going down it runs on in the gap just above the target's row and drops in from
 * the top, so it never crosses a node. */
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

// ------------------------------------------------------------------ what a node does, in rows

type Eff = { k: string } & Record<string, unknown>;

/** A rule's value as this run has it (the Patents owned). */
function ruleNow(app: App, key: string): number | undefined {
  const v = (prules(app.game) as unknown as Record<string, unknown>)[key];
  return typeof v === 'number' ? v : typeof v === 'boolean' ? (v ? 1 : 0) : undefined;
}

const OWNED_NOW = '{good:in effect} · this run and every run after';

/** What a node does as rows of markup ("{u:fold} the fold box 10x10 · was 4x4"), and what buying
 * it changes in this run (a row, or null). */
export function effectInfo(app: App, p: PatentDef): { does: string[]; now: string | null } {
  const g = app.game;
  const e = p.effect as unknown as Eff;
  const num = (k: string) => (typeof e[k] === 'number' ? (e[k] as number) : NaN);
  const list = (k: string) => (Array.isArray(e[k]) ? (e[k] as unknown[]) : []);
  const own = hasPatent(g, p.id);
  const was = (now: number | undefined, base: number | undefined, unit: string | ((v: number) => string) = '') => {
    const b = own ? base : now;
    return b === undefined || !isFinite(b) ? '' : ` · {soft:was ${typeof unit === 'string' ? b + unit : unit(b)}}`;
  };
  const base = (k: string) => (RULES as unknown as Record<string, { value: number } | undefined>)[k]?.value;
  const change = (from: number | undefined, to: number, fmt: (v: number) => string, better: (a: number, b: number) => boolean) => {
    if (own) return OWNED_NOW;
    if (from === undefined) return null;
    return better(to, from) ? `${fmt(from)} → {good:${fmt(to)}} the moment you buy it` : `{soft:no change · ${fmt(from)} already}`;
  };
  const up = (a: number, b: number) => a > b, down = (a: number, b: number) => a < b;
  const box = (x: number) => `${x}x${x}`;
  switch (e.k) {
    case 'head': {
      const does: string[] = [];
      const add: string[] = [];
      for (const u of list('upgrades') as string[]) {
        const name = (UPGRADES as Record<string, { name: string } | undefined>)[u]?.name ?? u;
        does.push(`{u:play} start with the ${name}`);
        if (!g.has(u as never)) add.push(`the ${name}`);
      }
      const rs = list('research') as string[];
      if (rs.length) {
        const names = rs.map((q) => (RESEARCH as Record<string, { name: string } | undefined>)[q]?.name ?? q);
        does.push(`{u:research} known from the start · ${names.map((n) => `{research:${n}}`).join(' · ')}`);
        rs.forEach((q, i) => { if (!g.done(q as never)) add.push(`{research:${names[i]}}`); });
      }
      const land = list('land') as string[];
      if (land.length) {
        const names = land.map((l) => CHUNKS.find((c) => c.id === l)?.name ?? `chunk ${l}`);
        const worth = land.reduce((s, l) => s + (CHUNKS.find((c) => c.id === l)?.cost ?? 0), 0);
        does.push(`{u:claim} land from the start · ${names.join(' · ')}${worth ? ` · {coin:${amount(worth)}} of land` : ''}`);
        land.forEach((l, i) => { if (!g.s.land.includes(l)) add.push(names[i]); });
      }
      const coin = num('coin');
      if (isFinite(coin)) { does.push(`{coin:${amount(coin)}} at the start of every run`); add.push(`{coin:${amount(coin)}}`); }
      const place = list('place') as { kind: string; x: number; y: number }[];
      for (const q of place) {
        const name = BUILD[q.kind as keyof typeof BUILD]?.name ?? q.kind;
        does.push(`{u:build} a ${name} at ${q.x},${q.y} from the start`);
        if (!g.entAt(q.x, q.y)) add.push(`a ${name}`);
      }
      const now = own ? '{good:yours} · every run starts with it' : add.length ? `+ ${add.join(' · ')} now` : '{soft:you have it all already · pays from the next run}';
      return { does: does.length ? does : [p.text], now };
    }
    case 'foldMax': {
      const v = num('value'), cur = ruleNow(app, 'foldMax');
      return { does: [`{u:fold} the fold box up to ${box(v)}${was(cur, base('foldMax'), box)}`], now: change(cur, v, box, up) };
    }
    case 'audit': {
      const w = num('warmup'), s = num('span');
      const cw = ruleNow(app, 'auditWarmup'), cs = ruleNow(app, 'auditWindow');
      const cur = cw !== undefined && cs !== undefined ? cw + cs : undefined;
      const b = (base('auditWarmup') ?? NaN) + (base('auditWindow') ?? NaN);
      return { does: [`{u:clock} an audit takes ${w + s} s · ${w} s warm-up + ${s} s window${was(cur, isFinite(b) ? b : undefined, ' s')}`], now: change(cur, w + s, (x) => `${x} s`, down) };
    }
    case 'maxAudits': {
      const v = num('value'), cur = ruleNow(app, 'maxAudits');
      return { does: [`{u:stats} up to ${v} Workshop lines audited at once${was(cur, base('maxAudits'))}`], now: change(cur, v, (x) => `${x} at once`, up) };
    }
    case 'sideIntake':
      return { does: ['{u:flow} a module also takes a trunk into its left side · 2 input sides, was 1'], now: own ? OWNED_NOW : ruleNow(app, 'sideIntake') ? '{soft:no change · modules have it already}' : 'every module gets its second input side at once' };
    // the Milestone 5-6 review round (the reset layer): the re-derived rules
    case 'halfClaims':
      return { does: ['{u:claim} an S or S+ source design holds half a claim on each ore · twice the copies'], now: own ? OWNED_NOW : 'your S and S+ source designs need half a claim a copy at once' };
    case 'nestedMax': {
      const v = num('value'), cur = ruleNow(app, 'nestedMax');
      return { does: [`{u:factory} a nested fold boxes up to ${box(v)}${was(cur, base('nestedMax'), box)}`], now: change(cur, v, box, up) };
    }
    case 'freshDies':
      return { does: ['{u:heavy} a design refolded at a better grade than every earlier one of its product starts its stamp price over'], now: own ? OWNED_NOW : 'refold a line better and its copies are cheap again' };
    case 'shovel': {
      const v = num('every'), cur = ruleNow(app, 'shovelEvery');
      return { does: [`{i:slag} shovels one jammed machine clear every ${v} s, on its own`], now: own ? OWNED_NOW : cur ? `{soft:no change · a frog shovels every ${cur} s already}` : 'the frog starts at once' };
    }
    case 'stampPress': {
      const v = num('every');
      return { does: [`{u:fold} stamps a spare of each keep-one-spare design every ${v} s · while you can afford it`], now: own ? OWNED_NOW : 'the press starts at once' };
    }
    case 'draughtsman': {
      const v = num('every');
      return { does: [`{u:blueprint} unfolds the Drawer's queue in order · one every ${v} s at most · as land, research and coin allow`], now: own ? OWNED_NOW : 'queue kept designs in the Drawer · it starts at once' };
    }
    case 'drawer': {
      const v = num('add'), cur = ruleNow(app, 'drawerSlots');
      return { does: [`{u:blueprint} the Patent Drawer keeps ${v} more designs`], now: change(cur, (cur ?? 0) + v, (x) => `${x} slots`, up) };
    }
    case 'offline': {
      const add = num('add');
      const now = offlineEfficiency(g);
      const cap = IDLE.offlineEffMax.value;
      const to = Math.min(cap, now + add);
      return { does: [`{u:overnight} offline efficiency {good:+${pct(add)}} · at most ${pct(cap)}`], now: own ? `{good:in effect} · offline pays ${pct(now)} now` : to > now ? `offline pays ${pct(now)} → {good:${pct(to)}}` : `{soft:no change · offline is at its ${pct(cap)} ceiling}` };
    }
    case 'lab':
    case 'clerk':
    default:
      return { does: [p.text], now: own ? OWNED_NOW : 'it starts work the moment you buy it' };
  }
}

/** The Committee's line on the Patent page: what is waiting to be banked or spent. */
function committeeLine(app: App): string {
  const g = app.game;
  const m = g.s.meta;
  const now = previewPatents(g).now;
  const canBuy = PATENT_LIST.some((p) => !hasPatent(g, p.id) && !patentRefusal(g, p.id));
  if (canBuy) return '"spend them." "we won\'t tell." "much."';
  if (now > 0) return `"psst." "this run files" {chip:reset:+${now}}`;
  if (m.patents.gt(0)) return '"save them." "the good ones cost more."';
  return '"psst." "we know a guy." "he files patents."';
}

function nodePage(app: App, id: PatentId, r: Rect) {
  const ui = app.ui;
  const g = app.game;
  const p = PATENTS[id];
  const role = branchRole(p.branch);
  let y = r.y;
  // the Committee, conspiring at the top
  y += speak(app, 'committee', committeeLine(app), r.x, y, r.w, { size: 24, fallback: committeeFallback }) + 5;
  rule(ui, r.x, y - 2, r.w, true);
  y += 2;
  const own = hasPatent(g, id);
  // the disc beside the name
  disc(ui, r.x, y, N, own ? 'owned' : 'normal');
  drawNodeIcon(app, p, r.x + 2, y + 2);
  const NL = layoutRich(`{big:${p.name}}`, r.w - N - 6);
  drawLayout(ui, NL, r.x + N + 5, y + (NL.lines.length > 1 ? 0 : 5), roleInk(role));
  y += Math.max(N, NL.h) + 3;
  chip(ui, r.x, y, branchName(p.branch), { role });
  if (own) stamp(ui, 'OWNED', r.x + r.w - 30, y + 4, { col: T.goodFill, angle: -0.1 });
  y += 15;
  const foot = r.y + r.h - 19;
  const info = effectInfo(app, p);
  // the data's row first, in ink; the numbers behind it (limits, what it was) after, softer
  const rows = [{ s: p.text, col: T.ink }, ...info.does.filter((d) => d !== p.text).map((d) => ({ s: d, col: T.inkSoft }))];
  for (const d of rows) {
    const L = layoutRich(d.s, r.w);
    if (y + L.h > foot - 30) break;
    drawLayout(ui, L, r.x, y, d.col);
    y += L.h + 2;
  }
  if (info.now) {
    y += 2;
    const cw = chip(ui, r.x, y, 'THIS RUN', { role: 'research' });
    const L = layoutRich(info.now, r.w - cw - 4);
    drawLayout(ui, L, r.x + cw + 4, y + 2, T.ink);
    y += Math.max(ROW_H, L.h + 4);
  }
  // the price and what it needs
  y += 2;
  const have = g.s.meta.patents;
  if (!own) {
    const cw = chip(ui, r.x, y, `${p.cost} ${p.cost === 1 ? 'Patent' : 'Patents'}`, { role: have.gte(p.cost) ? 'reset' : 'soft', solid: have.gte(p.cost) });
    drawLayout(ui, layoutRich(`{soft:you have ${have.format()}}`), r.x + cw + 5, y + 3, T.inkSoft);
    y += ROW_H;
  }
  for (const q of p.requires) {
    if (y + 11 > foot - 12) break;
    const ok = hasPatent(g, q);
    ui.text(`${ok ? ICON.check : ICON.cross} ${PATENTS[q]?.name ?? q}`, r.x, y, ok ? T.good : T.bad);
    y += 11;
  }
  // the flavour line, as room allows
  const FL = layoutRich(`{soft:"${p.flavor}"}`, r.w);
  if (y + FL.h + 4 <= foot - 2) drawLayout(ui, FL, r.x, foot - 3 - FL.h, T.inkSoft);
  const why = own ? null : patentRefusal(g, id);
  const lab = own ? `${ICON.check} Yours for good` : `Buy · ${p.cost} ${p.cost === 1 ? 'Patent' : 'Patents'}`;
  if (button(ui, 'patentBuy', r.x, foot, r.w, 18, lab, { disabled: own || !!why, gold: !own && !why, tip: own ? '{u:reset} it lasts through every Reorganize' : why ?? '{u:reset} bought for good · it lasts through every Reorganize' })) buy(app, id);
}
