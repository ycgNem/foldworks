// The Patent Office (DESIGN.md §19, Milestone 5): the Patent tree. Head starts run along the top,
// one row per line of research; rules, automation and offline efficiency sit in three boxes under
// it. A node shows its own icon, its price on a chip and a short label under it; owned nodes are
// lit in their branch's colour, ones you can buy now pulse teal, locked ones are dim with their
// lines to what they need. The node under the mouse (or the one clicked) is described on the right
// in numbers: what it does, what it changes in this run, its price and what it needs, with its Buy
// button. Presentation only: buying is the `patent` command.
//
// The UI legibility round (2026-10-20): the node data in src/data/patents.ts is read generically
// (`effect.k` and its fields, prules() by field name), so the screen keeps working when nodes,
// effects or prices change; a node this file has no icon or label for gets one from its effect
// and its name.
import { C, rgba } from '../data/palette';
import { PATENTS, PATENT_LIST, BRANCH_NAMES, type PatentId, type PatentBranch, type PatentDef } from '../data/patents';
import { ITEMS } from '../data/items';
import { RESEARCH } from '../data/research';
import { UPGRADES, BUILD } from '../data/machines';
import { CHUNKS } from '../data/land';
import { RULES } from '../data/rules';
import { IDLE } from '../data/idle';
import { ICON, textWidth, smallWidth } from '../ui/font';
import { itemIcon, sheet, hasArt, spriteName } from '../render/sprites';
import { amount, pct } from '../engine/fmt';
import { hasPatent, patentRefusal, prules } from '../sim/patents';
import { offlineEfficiency } from '../sim/offline';
import { previewPatents } from '../sim/reorganize';
import { frame, card, button, uiIcon, label, UICON, type UIconName } from './chrome';
import { screenHeader } from './widgets';
import type { App } from './app';
import type { Rect } from '../ui/ui';

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
  sideIntake: { ui: 'flow' }, deepHeaps: { sprite: 'heap', f: 4 }, nestedBoxes: { ui: 'factory' }, coolHands: { ui: 'pause' },
  stampDies: { ui: 'heavy' },
  // automation
  shovelFrog: { item: 'slag' }, labAssistant: { ui: 'research' }, orderClerk: { ui: 'orders' }, stampPress: { sprite: 'press' },
  dragonfly: { ui: 'build' }, dragonflies: { ui: 'ff' },
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

/** Short labels under the nodes (8 small capitals or fewer, so they fit a column at 1024x640). */
const SHORT: Partial<Record<string, string>> = {
  bellows: 'Bellows', starterLine: 'Miner', notebooks: 'Notes', copperDeeds: 'Copper', gearPatterns: 'Gears', gizmoPatent: 'Gizmo',
  foldingPatent: 'Folding', grant: 'Grant', overdriveHabit: 'Overdrv', coalRights: 'Coal', steelCharter: 'Steel', glassNotes: 'Glass',
  circuitPatent: 'Circuit',
  surveyCharter: 'Claims', widerBox: 'Wider', quickAudit: 'Quick', moreAuditors: 'Auditors', sideIntake: 'Intake', deepHeaps: 'Heaps',
  nestedBoxes: 'Nesting', coolHands: 'Cooling', stampDies: 'Dies',
  shovelFrog: 'Shovel', labAssistant: 'Lab', orderClerk: 'Clerk', stampPress: 'Press', dragonfly: 'Drone', dragonflies: 'Swarm',
  nightShift: 'Shift', nightWatch: 'Watch', lightsOn: 'Lights',
};

const STOP = new Set(['a', 'an', 'the', 'of', 'on', 'by', 'and', 'in', 'to', 'for']);

/** A node's label: its short name, or the first word of its name that says something. */
function shortLabel(p: PatentDef): string {
  const s = SHORT[p.id];
  if (s) return s;
  const words = p.name.replace(/[^A-Za-z' ]/g, ' ').split(/\s+/).filter((w) => w && !STOP.has(w.toLowerCase()));
  return words[0] ?? p.name;
}

const BRANCH_COL: Record<string, string> = { head: C.gold, rule: C.teal1, auto: C.leaf, offline: C.violet };
const branchCol = (b: string) => BRANCH_COL[b] ?? C.hull2;
const branchName = (b: string) => (BRANCH_NAMES as Record<string, string>)[b] ?? b;

/** the node pinned by a click (the hovered one wins while the mouse is on a node) */
const st = { pinned: 'bellows' as PatentId };

const N = 20;

export function patentsScreen(app: App, r: Rect) {
  const ui = app.ui;
  const g = app.game;
  const m = g.s.meta;
  screenHeader(app, r, 'The Patent Office', C.violet, 'star');
  const y0 = r.y + 22, bottom = r.y + r.h - 6;
  const dw = Math.min(176, Math.floor(r.w * 0.33));
  const tw = r.w - dw - 22;
  if (!PATENTS[st.pinned]) st.pinned = PATENT_LIST[0].id;
  // the bank
  const bank = `${m.patents.format()} ${m.patents.eq(1) ? 'Patent' : 'Patents'} to spend.`;
  ui.text(`${ICON.star} ${bank}`, r.x + 10, y0 + 1, C.gold, { shadow: C.ink });
  const pv = previewPatents(g);
  const sub = `${m.runs} ${m.runs === 1 ? 'Reorganize' : 'Reorganizes'}; this run would bank ${pv.now}`;
  const sx = r.x + 16 + textWidth(`${ICON.star} ${bank}`);
  if (sx + textWidth(sub) < r.x + 8 + tw - 92) ui.text(sub, sx, y0 + 1, C.hull3);
  if (button(ui, 'toReorganize', r.x + 8 + tw - 86, y0 - 2, 86, 12, 'Reorganize...', { tip: 'The Reorganize card: what a reset gives, keeps and loses' })) app.panel = 'reorganize';
  // the tree: head starts on top, the other branches below
  const ty = y0 + 14;
  const headH = Math.floor((bottom - ty) * 0.42);
  let hover: PatentId | null = null;
  const boxes: { b: PatentBranch; x: number; y: number; w: number; h: number }[] = [];
  const branches = [...new Set(PATENT_LIST.map((p) => p.branch))];
  const lower = branches.filter((b) => b !== 'head');
  if (branches.includes('head' as PatentBranch)) boxes.push({ b: 'head' as PatentBranch, x: r.x + 8, y: ty, w: tw, h: headH });
  const lw = Math.floor((tw - 4 * (lower.length - 1)) / Math.max(1, lower.length));
  lower.forEach((b, i) => boxes.push({ b, x: r.x + 8 + i * (lw + 4), y: ty + headH + 4, w: lw, h: bottom - (ty + headH + 4) }));
  for (const bx of boxes) {
    const col = branchCol(bx.b);
    const inner = card(ui, bx.x, bx.y, bx.w, bx.h, branchName(bx.b), col);
    const nodes = PATENT_LIST.filter((p) => p.branch === bx.b);
    if (!nodes.length) continue;
    const cols = Math.max(...nodes.map((p) => p.pos[0])) + 1, rows = Math.max(...nodes.map((p) => p.pos[1])) + 1;
    const cw = Math.floor(inner.w / cols), rh = Math.min(38, Math.floor(inner.h / rows));
    const at = (id: PatentId) => {
      const p = PATENTS[id];
      return { x: inner.x + p.pos[0] * cw + Math.floor((cw - N) / 2), y: inner.y + p.pos[1] * rh + Math.max(0, Math.floor((rh - N - 9) / 2)) };
    };
    // lines to prerequisites first, under the nodes
    for (const p of nodes) {
      const a = at(p.id);
      for (const q of p.requires) {
        if (!PATENTS[q] || PATENTS[q].branch !== bx.b) continue;
        const b = at(q);
        link(app, b.x + N / 2, b.y + N / 2, a.x + N / 2, a.y + N / 2, b.x + N / 2 + Math.floor(cw / 2), hasPatent(g, q) ? col : C.hull0);
      }
    }
    for (const p of nodes) {
      const a = at(p.id);
      const own = hasPatent(g, p.id);
      const why = own ? null : patentRefusal(g, p.id);
      const locked = !own && p.requires.some((q) => !hasPatent(g, q));
      const can = !own && !why;
      const sel = st.pinned === p.id;
      // the node and its label are one button (the label is as wide as the column)
      const bx0 = Math.min(a.x - 1, a.x + N / 2 - Math.floor((cw - 2) / 2)), bw0 = Math.max(N + 2, cw - 2);
      ui.region(bx0, a.y - 1, bw0, N + 11, 'button');
      const hov = ui.hover(bx0, a.y - 1, bw0, N + 11);
      ui.mark('patent_' + p.id, a.x - 1, a.y - 1, N + 2, N + 2);
      if (hov) hover = p.id;
      const edge = sel || hov ? C.bone : own ? col : can ? (Math.sin(ui.time * 5) > 0 ? C.teal1 : C.teal0) : C.ink;
      ui.fill(a.x - 1, a.y - 1, N + 2, N + 2, edge);
      ui.fill(a.x, a.y, N, N, own ? C.ground1 : locked ? C.shadow : C.hull0);
      ui.ctx.globalAlpha = locked ? 0.5 : 1;
      drawNodeIcon(app, p, a.x + 2, a.y + 2);
      ui.ctx.globalAlpha = 1;
      // the price on a chip at the corner, or a tick when owned
      if (own) {
        ui.fill(a.x + N - 7, a.y + N - 7, 8, 8, C.ink);
        ui.text(ICON.check, a.x + N - 7, a.y + N - 8, col);
      } else {
        const ps = `${p.cost}`;
        const pw = smallWidth(ps) + 3;
        ui.fill(a.x + N - pw + 1, a.y + N - 6, pw, 7, C.ink);
        ui.small(ps, a.x + N - pw + 3, a.y + N - 5, can ? C.gold : C.hull2);
      }
      // the label under it, clipped to its column
      const lab = shortLabel(p).toUpperCase();
      const lx = a.x + N / 2, ly = a.y + N + 3;
      const cx0 = a.x + N / 2 - Math.floor((cw - 2) / 2);
      ui.clip(cx0, ly - 1, cw - 2, 7);
      // on a dark backing, so a prerequisite line running down the gap passes behind it
      const lw0 = Math.min(cw - 2, smallWidth(lab) + 2);
      ui.ctx.fillStyle = rgba(C.ink, 0.8);
      ui.ctx.fillRect(Math.round(lx - lw0 / 2), ly - 1, lw0, 7);
      ui.small(lab, lx, ly, own ? col : can || sel || hov ? C.bone : C.hull2, { align: 'center', shadow: C.ink });
      ui.unclip();
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

// ------------------------------------------------------------------ what a node does, in numbers

type Eff = { k: string } & Record<string, unknown>;

/** A rule's value as this run has it (the Patents owned) and as a new game has it. */
function ruleNow(app: App, key: string): number | undefined {
  const v = (prules(app.game) as unknown as Record<string, unknown>)[key];
  return typeof v === 'number' ? v : typeof v === 'boolean' ? (v ? 1 : 0) : undefined;
}

/** "45 s instead of 70" style lines: what the node does, and what buying it changes in this run. */
export function effectInfo(app: App, p: PatentDef): { does: string[]; now: string | null } {
  const g = app.game;
  const e = p.effect as unknown as Eff;
  const num = (k: string) => (typeof e[k] === 'number' ? (e[k] as number) : NaN);
  const list = (k: string) => (Array.isArray(e[k]) ? (e[k] as unknown[]) : []);
  const own = hasPatent(g, p.id);
  const was = (now: number | undefined, base: number | undefined, unit: string | ((v: number) => string) = '') => {
    const b = own ? base : now;
    return b === undefined || !isFinite(b) ? '' : ` instead of ${typeof unit === 'string' ? b + unit : unit(b)}`;
  };
  const base = (k: string) => (RULES as unknown as Record<string, { value: number } | undefined>)[k]?.value;
  const change = (from: number | undefined, to: number, fmt: (v: number) => string, better: (a: number, b: number) => boolean) => {
    if (own) return 'In effect in this run and every run after.';
    if (from === undefined) return null;
    return better(to, from) ? `This run: ${fmt(from)} becomes ${fmt(to)} the moment you buy it.` : `No change this run: it is ${fmt(from)} already.`;
  };
  const up = (a: number, b: number) => a > b, down = (a: number, b: number) => a < b;
  switch (e.k) {
    case 'head': {
      const does: string[] = [];
      const add: string[] = [];
      for (const u of list('upgrades') as string[]) {
        const name = (UPGRADES as Record<string, { name: string } | undefined>)[u]?.name ?? u;
        does.push(`Starts with the ${name}.`);
        if (!g.has(u as never)) add.push(`the ${name}`);
      }
      const rs = list('research') as string[];
      if (rs.length) {
        const names = rs.map((q) => (RESEARCH as Record<string, { name: string } | undefined>)[q]?.name ?? q);
        does.push(`Research known from the start: ${names.join(', ')}.`);
        rs.forEach((q, i) => { if (!g.done(q as never)) add.push(names[i]); });
      }
      const land = list('land') as string[];
      if (land.length) {
        const names = land.map((l) => CHUNKS.find((c) => c.id === l)?.name ?? `chunk ${l}`);
        const worth = land.reduce((s, l) => s + (CHUNKS.find((c) => c.id === l)?.cost ?? 0), 0);
        does.push(`Land from the start: ${names.join(', ')}${worth ? ` (${amount(worth)} coin of land)` : ''}.`);
        land.forEach((l, i) => { if (!g.s.land.includes(l)) add.push(names[i]); });
      }
      const coin = num('coin');
      if (isFinite(coin)) { does.push(`${amount(coin)} coin at the start of every run.`); add.push(`${amount(coin)} coin`); }
      const place = list('place') as { kind: string; x: number; y: number }[];
      for (const q of place) {
        does.push(`A ${BUILD[q.kind as keyof typeof BUILD]?.name ?? q.kind} placed at ${q.x},${q.y} at the start.`);
        if (!g.entAt(q.x, q.y)) add.push(`a ${BUILD[q.kind as keyof typeof BUILD]?.name ?? q.kind}`);
      }
      const now = own ? 'Yours: every run starts with it.' : add.length ? `This run: buying adds ${add.join(', ')} now.` : 'This run: you have all of it already; it pays from the next run.';
      return { does: does.length ? does : [p.text], now };
    }
    case 'foldMax': {
      const v = num('value'), cur = ruleNow(app, 'foldMax');
      return { does: [`The fold box is up to ${v}x${v}${was(cur, base('foldMax'), (x) => `${x}x${x}`)}.`], now: change(cur, v, (x) => `${x}x${x}`, up) };
    }
    case 'audit': {
      const w = num('warmup'), s = num('span');
      const cw = ruleNow(app, 'auditWarmup'), cs = ruleNow(app, 'auditWindow');
      const cur = cw !== undefined && cs !== undefined ? cw + cs : undefined;
      const b = (base('auditWarmup') ?? NaN) + (base('auditWindow') ?? NaN);
      return { does: [`An audit takes ${w + s} s (${w} s warm-up, a ${s} s window)${was(cur, isFinite(b) ? b : undefined, ' s')}.`], now: change(cur, w + s, (x) => `${x} s`, down) };
    }
    case 'maxAudits': {
      const v = num('value'), cur = ruleNow(app, 'maxAudits');
      return { does: [`Up to ${v} Workshop lines audited at once${was(cur, base('maxAudits'))}.`], now: change(cur, v, (x) => `${x} at once`, up) };
    }
    case 'sideIntake':
      return { does: ['A module also takes inputs from a trunk into its left side: 2 input sides instead of 1.'], now: own ? 'In effect in this run and every run after.' : ruleNow(app, 'sideIntake') ? 'No change this run: modules have it already.' : 'This run: every module gets its second input side at once.' };
    case 'heapCap': {
      const v = num('value'), cur = ruleNow(app, 'heapCap');
      return { does: [`A Slag Heap holds ${v} slag${was(cur, BUILD.heap.capacity)}.`], now: change(cur, v, (x) => `${x} slag`, up) };
    }
    case 'claims': {
      const v = num('value'), cur = ruleNow(app, 'extraClaims') ?? 0;
      return { does: [`+${v} deposit claims on every ore: ${v} more copies of each source module.`], now: own ? 'In effect in this run and every run after.' : `This run: +${v} claims on every ore at once (+${cur} from Patents now).` };
    }
    case 'nestedMax': {
      const v = num('value'), cur = ruleNow(app, 'nestedMax');
      return { does: [`A nested fold boxes up to ${v}x${v}${was(cur, base('nestedMax'), (x) => `${x}x${x}`)}.`], now: change(cur, v, (x) => `${x}x${x}`, up) };
    }
    case 'overdriveCool': {
      const v = num('value'), cur = ruleNow(app, 'overdriveCool');
      return { does: [`Overdrive cools in ${v} s${was(cur, base('overdriveCool'), ' s')}.`], now: change(cur, v, (x) => `${x} s`, down) };
    }
    case 'stampGrowth': {
      const v = num('value'), cur = ruleNow(app, 'stampGrowth');
      return { does: [`Each stamped copy costs ${v} more of its bill${was(cur, base('stampGrowth'))}: bill x (1 + ${v} n).`], now: change(cur, v, (x) => `+${x} a copy`, down) };
    }
    case 'shovel': {
      const v = num('every'), cur = ruleNow(app, 'shovelEvery');
      return { does: [`Shovels one jammed machine clear every ${v} s, on its own.`], now: own ? 'In effect in this run and every run after.' : cur ? `No change this run: a frog shovels every ${cur} s already.` : 'This run: the frog starts at once.' };
    }
    case 'stampPress': {
      const v = num('every');
      return { does: [`Stamps a spare of each "keep one spare" design every ${v} s while you can afford it.`], now: own ? 'In effect in this run and every run after.' : 'This run: the press starts at once.' };
    }
    case 'drone': {
      const v = num('n'), cur = ruleNow(app, 'drones') ?? 0;
      return { does: [`${v} ${v === 1 ? 'dragonfly builds' : 'dragonflies build'} your blueprint ghosts, as coin allows.`], now: change(cur, v, (x) => `${x} ${x === 1 ? 'dragonfly' : 'dragonflies'}`, up) };
    }
    case 'offline': {
      const add = num('add');
      const now = offlineEfficiency(g);
      const cap = IDLE.offlineEffMax.value;
      const to = Math.min(cap, now + add);
      return { does: [`Offline efficiency +${pct(add)} (at most ${pct(cap)}).`], now: own ? `In effect: offline pays ${pct(now)} now.` : to > now ? `This run: offline pays ${pct(now)}, then ${pct(to)}.` : `No change: offline is at its ${pct(cap)} ceiling.` };
    }
    case 'lab':
    case 'clerk':
    default:
      return { does: [p.text], now: own ? 'In effect in this run and every run after.' : 'This run: it starts work the moment you buy it.' };
  }
}

function detail(app: App, id: PatentId, x: number, y: number, w: number, h: number) {
  const ui = app.ui;
  const g = app.game;
  const p = PATENTS[id];
  const col = branchCol(p.branch);
  const inner = card(ui, x, y, w, h, branchName(p.branch), col);
  const tx = inner.x + 2, tw = inner.w - 4;
  const foot = inner.y + inner.h - 18;
  let yy = inner.y + 2;
  // the icon beside the name
  ui.fill(tx - 1, yy - 1, 18, 18, C.ink);
  drawNodeIcon(app, p, tx, yy);
  const nameH = ui.para(p.name, tx + 21, yy + (textWidth(p.name) > tw - 21 ? 0 : 4), tw - 21, C.gold);
  yy += Math.max(18, nameH) + 4;
  const info = effectInfo(app, p);
  const room = (hh: number) => yy + hh <= foot - 12;
  for (const d of info.does) {
    const hh = ui.para(d, tx, yy, tw, C.bone);
    yy += hh + 2;
  }
  if (info.now) {
    yy += 2;
    label(ui, 'this run', tx, yy, C.teal1);
    yy += 7;
    // the label says "this run": the line says what changes
    const now = info.now.replace(/^This run: /, '');
    yy += ui.para(now.charAt(0).toUpperCase() + now.slice(1), tx, yy, tw, C.teal1) + 2;
  }
  // the price and what it needs
  yy += 2;
  const own = hasPatent(g, id);
  label(ui, own ? 'owned' : `price ${p.cost} ${p.cost === 1 ? 'patent' : 'patents'}, you have ${g.s.meta.patents.format()}`, tx, yy, own ? col : g.s.meta.patents.gte(p.cost) ? C.gold : C.hull2);
  yy += 9;
  if (p.requires.length) {
    label(ui, 'needs', tx, yy, C.hull2);
    yy += 7;
    for (const q of p.requires) {
      const ok = hasPatent(g, q);
      ui.text(`${ok ? ICON.check : ICON.cross} ${PATENTS[q]?.name ?? q}`, tx, yy, ok ? C.leaf : C.copper2);
      yy += 10;
    }
  }
  // the line from the data, then the flavour, as room allows
  const textLines = info.does[0] === p.text ? 0 : Math.ceil(textWidth(p.text) / tw) + 1;
  if (textLines && room(textLines * 10 + 4)) {
    yy += 3;
    yy += ui.para(p.text, tx, yy, tw, C.hull2) + 2;
  }
  if (yy + 22 < foot - 4) {
    const fh = Math.min(foot - 4 - yy, 40);
    frame(ui, inner.x, yy + 2, inner.w, fh, 'paper', false);
    ui.clip(inner.x + 3, yy + 5, inner.w - 6, fh - 6);
    ui.para(p.flavor, inner.x + 5, yy + 6, inner.w - 10, C.ink);
    ui.unclip();
  }
  const why = own ? 'Owned' : patentRefusal(g, id);
  const lab = own ? `${ICON.check} Owned` : `Buy: ${p.cost} ${p.cost === 1 ? 'Patent' : 'Patents'}`;
  if (button(ui, 'patentBuy', inner.x, foot, inner.w, 16, lab, { disabled: !!why, gold: !why, tip: why ?? 'Bought for good: it lasts through every Reorganize' })) buy(app, id);
  ui.fill(inner.x, foot - 3, inner.w, 1, rgba(C.hull0, 0.6));
}
