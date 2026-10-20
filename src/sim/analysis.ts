// Line analysis (pillar 3: bottlenecks are puzzles, not mysteries). Which machines form a line,
// who feeds a machine, what it wants per minute and what it gets, and the grade a line would
// earn by DESIGN.md §10's formula (the Inspector Spark and the fold audit's preview use it).
// Pure: reads the Game, never writes it.
import { powerFactor } from './systems/power';
import type { Game } from './Game';
import { DX, DY, ccw, cw, faceTiles, opposite, type Dir, type Ent } from './world';
import { machineRecipes } from './transfer';
import { BUILD, isMachine } from '../data/machines';
import { RECIPE } from '../data/recipes';
import { ITEMS, itemName, type ItemId } from '../data/items';
import { RULES, SCORE_WEIGHTS, gradeFor } from '../data/rules';
import { shares } from './systems/stats';
import { plain, pct as fmtPct, duration } from '../engine/fmt';
import { TICK_RATE } from '../engine/time';
import { baseSpeed, veinBoost } from './systems/machines';
import type { RecipeDef } from '../data/recipes';

const isSink = (e: Ent) => e.kind === 'dock' || e.kind === 'hopper';

/** The tiles an entity hands items to, with the direction of travel. */
export function outLinks(e: Ent): { x: number; y: number; d: Dir }[] {
  const front = { x: e.x + DX[e.rot], y: e.y + DY[e.rot], d: e.rot };
  switch (e.kind) {
    case 'belt':
    case 'miner':
    case 'merger':
    case 'crate':
    case 'heap':
      return [front];
    case 'splitter':
      return [front, ...[ccw(e.rot), cw(e.rot)].map((d) => ({ x: e.x + DX[d], y: e.y + DY[d], d }))];
    default:
      if (!isMachine(e.kind)) return [];
      if (e.w === 1 && e.h === 1) return [front, ...[ccw(e.rot), opposite(e.rot), cw(e.rot)].map((d) => ({ x: e.x + DX[d], y: e.y + DY[d], d }))];
      // a 2x2: both tiles of each face
      return [e.rot, ccw(e.rot), opposite(e.rot), cw(e.rot)].flatMap((d) => faceTiles(e, d).map(([x, y]) => ({ x, y, d })));
  }
}

/** Machine to machine, does `to` use what `from` hands over this way (its output out of the
 * front, its byproduct out of a side)? Any other link carries whatever comes. */
function hands(g: Game, from: Ent, to: Ent, d: Dir): boolean {
  if (!isMachine(from.kind) || !isMachine(to.kind)) return true;
  const r = from.recipe ? RECIPE[from.recipe] : null;
  if (!r) return true;
  const item = d === from.rot ? r.outputs[0].item : r.byproduct?.item;
  return !!item && uses(g, to, item);
}

/** Does machine m use this item (its recipe, or any recipe it could pick)? */
function uses(g: Game, m: Ent, item: string): boolean {
  if (m.recipe) return RECIPE[m.recipe].inputs.some((s) => s.item === item);
  return machineRecipes(g, m).some((r) => r.inputs.some((s) => s.item === item));
}

/** Does `from` actually hand items to `to` (respecting belt directions and fronts)? */
function linked(g: Game, from: Ent, to: Ent, d: Dir): boolean {
  if (to.kind === 'belt') {
    if (to.rot === opposite(d)) return false;
    // byproduct sides only use belts leading away
    const isFront = d === from.rot;
    if (!isFront && isMachine(from.kind) && to.rot !== d) return false;
    return true;
  }
  if (to.kind === 'miner') return false;
  if (isMachine(to.kind)) return opposite(d) !== to.rot;
  return true;
}

/** Every line on the floor: groups of entities joined by item flow, Dock and Hopper excluded. */
export function lines(g: Game): Ent[][] {
  const parent = new Map<number, number>();
  const find = (a: number): number => {
    let r = a;
    while (parent.get(r) !== r) r = parent.get(r)!;
    parent.set(a, r);
    return r;
  };
  const union = (a: number, b: number) => parent.set(find(a), find(b));
  for (const e of g.s.ents) if (!isSink(e)) parent.set(e.id, e.id);
  for (const e of g.s.ents) {
    if (isSink(e)) continue;
    for (const l of outLinks(e)) {
      const t = g.entAt(l.x, l.y);
      if (t && !isSink(t) && t !== e && linked(g, e, t, l.d) && hands(g, e, t, l.d)) union(e.id, t.id);
    }
  }
  const groups = new Map<number, Ent[]>();
  for (const e of g.s.ents) {
    if (isSink(e)) continue;
    const r = find(e.id);
    let l = groups.get(r);
    if (!l) groups.set(r, (l = []));
    l.push(e);
  }
  return [...groups.values()];
}

export function lineOf(g: Game, e: Ent): Ent[] {
  return lines(g).find((l) => l.includes(e)) ?? [e];
}

/** Nominal input and output per minute of a machine's recipe. */
export function nominal(m: Ent): { ins: { item: ItemId; perMin: number }[]; outs: { item: ItemId; perMin: number }[] } {
  const r = m.recipe ? RECIPE[m.recipe] : null;
  if (!r) return { ins: [], outs: [] };
  // crafts a minute at the machine's own speed (a Mk2 makes 3x)
  const crafts = (60 / r.time) * (BUILD[m.kind].speed ?? 1);
  return {
    ins: r.inputs.map((s) => ({ item: s.item, perMin: s.n * crafts })),
    outs: r.outputs.map((s) => ({ item: s.item, perMin: s.n * crafts })),
  };
}

export interface LineGrade {
  u: number;
  w: number;
  c: number;
  score: number;
  letter: string;
  mult: number;
  /** coin per second the line's final products are worth at the measured busy fractions */
  valuePerSec: number;
  machines: Ent[];
}

/** The §10 grade of a line from the last minute's statistics. */
export function gradeLine(g: Game, line: Ent[]): LineGrade {
  const machines = line.filter((e) => isMachine(e.kind));
  let u = 0;
  for (const m of machines) u += shares(m).work;
  u = machines.length ? u / machines.length : 0;
  const makers = machines.filter((m) => m.recipe && RECIPE[m.recipe].byproduct);
  let w = 1;
  if (makers.length) {
    let blocked = 0;
    for (const m of makers) blocked += shares(m).byBlocked;
    w = 1 - blocked / makers.length;
  }
  const solid = line.filter((e) => e.kind !== 'belt');
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const e of line) {
    x0 = Math.min(x0, e.x); y0 = Math.min(y0, e.y);
    x1 = Math.max(x1, e.x + e.w - 1); y1 = Math.max(y1, e.y + e.h - 1);
  }
  const box = (x1 - x0 + 1) * (y1 - y0 + 1);
  let tiles = 0;
  for (const e of solid) tiles += e.w * e.h;
  const c = Math.min(1, tiles / box / RULES.compactFull.value);
  const score = SCORE_WEIGHTS.u * u + SCORE_WEIGHTS.w * w + SCORE_WEIGHTS.c * c;
  const gr = gradeFor(score);
  // final products: machines whose front leads (through belts) to a Dock or Hopper
  let value = 0;
  for (const m of machines) {
    if (!endsAtSink(g, m)) continue;
    const r = m.recipe ? RECIPE[m.recipe] : null;
    if (!r) continue;
    const o = r.outputs[0];
    value += (shares(m).work * o.n * ITEMS[o.item].value) / r.time;
  }
  return { u, w, c, score, letter: gr.letter, mult: gr.mult, valuePerSec: value, machines };
}

/** Follow a machine's front through belts: does it reach a Dock or Hopper? */
export function endsAtSink(g: Game, m: Ent): boolean {
  let x = m.x + DX[m.rot], y = m.y + DY[m.rot];
  for (let i = 0; i < 300; i++) {
    const t = g.entAt(x, y);
    if (!t) return false;
    if (isSink(t)) return true;
    if (t.kind !== 'belt' && t.kind !== 'merger' && t.kind !== 'crate') return false;
    x = t.x + DX[t.rot];
    y = t.y + DY[t.rot];
  }
  return false;
}

/** What feeds machine m: the machines upstream of it (through belts, mergers, splitters, crates),
 * and the machines it shares a splitter with. */
export function feeders(g: Game, m: Ent): { from: Ent[]; shared: Ent[]; stores: Ent[] } {
  const from: Ent[] = [];
  const shared: Ent[] = [];
  const stores: Ent[] = [];
  const seen = new Set<number>([m.id]);
  const todo: Ent[] = [m];
  while (todo.length) {
    const cur = todo.pop()!;
    for (let d = 0 as Dir; d < 4; d = (d + 1) as Dir) {
      const n = g.entAt(cur.x + DX[d], cur.y + DY[d]);
      if (!n || seen.has(n.id) || isSink(n)) continue;
      // does n hand items into cur?
      const links = outLinks(n).filter((l) => l.x >= cur.x && l.x < cur.x + cur.w && l.y >= cur.y && l.y < cur.y + cur.h);
      const link = links.find((l) => linked(g, n, cur, l.d));
      if (!link) continue;
      if (isMachine(n.kind)) {
        // only if what it hands this way (its output out of the front, its byproduct out of a
        // side) is something m uses: a press beside a press is not feeding it
        const r = n.recipe ? RECIPE[n.recipe] : null;
        const item = link.d === n.rot ? r?.outputs[0].item : r?.byproduct?.item;
        if (!item || !uses(g, m, item)) continue;
        seen.add(n.id);
        from.push(n);
      } else {
        seen.add(n.id);
        if (n.kind === 'crate') stores.push(n);
        if (n.kind === 'splitter') {
          for (const l of outLinks(n)) {
            const o = g.entAt(l.x, l.y);
            if (!o || o === cur) continue;
            const end = followToMachine(g, o);
            if (end && end !== m && !shared.includes(end)) shared.push(end);
          }
        }
        todo.push(n);
      }
    }
  }
  return { from, shared, stores };
}

function followToMachine(g: Game, e: Ent): Ent | null {
  let cur: Ent | null = e;
  for (let i = 0; i < 300 && cur; i++) {
    if (isMachine(cur.kind)) return cur;
    if (cur.kind !== 'belt') return null;
    cur = g.entAt(cur.x + DX[cur.rot], cur.y + DY[cur.rot]);
  }
  return null;
}

// the one number helper (DESIGN.md §20): rates and shares read the same everywhere
const pct = fmtPct;
const perMin = (n: number) => plain(n, 1) + '/min';

export function entName(g: Game, e: Ent): string {
  const same = g.s.ents.filter((q) => q.kind === e.kind);
  return `${BUILD[e.kind].name}${same.length > 1 ? ' ' + (same.indexOf(e) + 1) : ''}`;
}

/** The hover report (DESIGN.md §4): one line per fact, the cause and the numbers. */
export function report(g: Game, m: Ent): { text: string; tone: 'good' | 'warn' | 'bad' | 'dim' | 'plain' }[] {
  const out: { text: string; tone: 'good' | 'warn' | 'bad' | 'dim' | 'plain' }[] = [];
  const name = entName(g, m);
  const r = m.recipe ? RECIPE[m.recipe] : null;
  if (!isMachine(m.kind)) return out;
  const sh = shares(m);
  out.push({ text: `${name}${r ? ': ' + r.name : ''}`, tone: 'plain' });
  if (m.kind === 'furnace' && !g.has('bellows')) {
    out.push({ text: 'Click the ore patch to feed it, then click the furnace to crank it (8 cranks an ingot).', tone: 'dim' });
  }
  if (!r) {
    out.push({ text: 'No recipe yet: it takes the first input it can use.', tone: 'warn' });
    return out;
  }
  const nom = nominal(m);
  // what feeds it and what takes its output: read first, so the status line and the lines under it
  // agree (the UI legibility round: a kiln on its buffer read "Working 100%" over "Nothing feeds it")
  const f = nom.ins.length ? feeders(g, m) : null;
  const unfed = !!f && !f.from.length && !f.stores.length && m.kind !== 'furnace';
  const frontless = m.kind !== 'miner' && !g.entAt(m.x + DX[m.rot], m.y + DY[m.rot]);
  const left = m.state === 'work' && (unfed || frontless) ? runLeft(g, m, r, unfed, frontless) : null;
  const share = (v: number) => (sh.n && Math.round(v * 100) > 0 ? pct(v) + ' of the last minute' : 'just now');
  // what it is doing now
  if (m.paused) out.push({ text: 'Stopped by you: it takes nothing and makes nothing until you start it again', tone: 'dim' });
  else if (m.state === 'work' && left) {
    const t = left.sec >= 1 ? `about ${duration(left.sec)}` : 'a moment';
    if (left.why === 'in') out.push({ text: `Running on its buffer: ${t} of ${itemName(left.item).toLowerCase()} left, then it starves`, tone: 'warn' });
    else out.push({ text: `Working, but its ${itemName(left.item).toLowerCase()} piles up inside: full in ${t}, then it blocks`, tone: 'warn' });
  } else if (m.state === 'work') out.push({ text: `Working${sh.n ? ': busy ' + pct(sh.work) + ' of the last minute' : ''}`, tone: 'good' });
  else if (m.state === 'starved') {
    if (m.why === 'crank') out.push({ text: 'Waiting for a crank: click it', tone: 'warn' });
    else out.push({ text: `Starved of ${m.why ? itemName(m.why).toLowerCase() : 'input'} (${share(sh.starved)})`, tone: 'warn' });
  } else if (m.state === 'blocked') {
    if (m.why === m.byItem && m.why) out.push({ text: `Blocked: its ${itemName(m.why).toLowerCase()} has nowhere to go (${share(sh.byBlocked)})`, tone: 'bad' });
    else out.push({ text: `Blocked: its ${m.why ? itemName(m.why).toLowerCase() : 'output'} has nowhere to go (${share(sh.blocked)})`, tone: 'bad' });
  } else out.push({ text: 'Idle', tone: 'dim' });
  // rates
  // in a brownout a busy machine runs at the speed power allows (Milestone 4 review: a kiln at 67%
  // read "busy 100%, 30/min now")
  const pf = Math.min(1, powerFactor(g, m));
  if (pf < 0.999) out.push({ text: `Short of power: running at ${pct(pf)} speed`, tone: 'warn' });
  if (nom.outs.length) out.push({ text: `Makes ${nom.outs.map((o) => perMin(o.perMin) + ' ' + itemName(o.item).toLowerCase()).join(', ')} when busy; ${perMin(nom.outs[0].perMin * sh.work * pf)} now`, tone: 'plain' });
  if (f) {
    out.push({ text: `Wants ${nom.ins.map((i) => perMin(i.perMin) + ' ' + itemName(i.item).toLowerCase()).join(' + ')}`, tone: 'plain' });
    if (f.from.length) {
      const supply = f.from.map((s) => {
        const sn = nominal(s);
        return `${entName(g, s)} (${sn.outs.map((o) => perMin(o.perMin) + ' ' + itemName(o.item).toLowerCase()).join(', ')})`;
      });
      out.push({ text: `Fed by ${supply.join(', ')}`, tone: 'plain' });
    } else if (f.stores.length) out.push({ text: `Fed from ${f.stores.length > 1 ? f.stores.length + ' crates' : 'a crate'} (${f.stores.reduce((n, c) => n + c.store.length, 0)} held)`, tone: 'plain' });
    else if (m.kind === 'furnace') out.push({ text: 'Fed by hand (the ore patch)', tone: 'dim' });
    // still working from what it holds: a warning of what comes, not a fault yet
    else if (m.state === 'work') out.push({ text: 'Nothing feeds it: it starves when its buffer runs out. Point a belt or a machine\'s front into it', tone: 'warn' });
    else out.push({ text: 'Nothing feeds it: point a belt or a machine\'s front into it', tone: 'bad' });
    if (f.shared.length) out.push({ text: `Its supply is shared with ${f.shared.map((s) => entName(g, s)).join(', ')}`, tone: 'warn' });
  }
  if (r.byproduct) {
    const every = r.byproduct.every;
    out.push({ text: `1 ${itemName(r.byproduct.item).toLowerCase()} per ${every} crafts leaves by a side: a Slag Heap or a belt leading away`, tone: m.by >= RULES.outputCap.value ? 'bad' : 'dim' });
    if (m.by >= RULES.outputCap.value) out.push({ text: 'Click it to shovel the slag out by hand', tone: 'warn' });
  }
  // the front
  if (frontless) {
    const cap = RULES.outputCap.value;
    if (m.state === 'blocked') out.push({ text: 'Nothing at its front: its output waits, so it has stopped', tone: 'bad' });
    else if (m.out > 0) out.push({ text: `Nothing at its front: ${m.out} of ${cap} made wait inside; it blocks when full`, tone: 'warn' });
    else out.push({ text: 'Nothing at its front: its output will wait inside', tone: 'dim' });
  }
  return out;
}

/** How long a working machine runs on what it holds, with no input arriving (`inputs`) and/or
 * nothing taking its output (`output`): the crafts its buffer allows, at its speed now. */
function runLeft(g: Game, m: Ent, r: RecipeDef, inputs: boolean, output: boolean): { sec: number; why: 'in' | 'out'; item: ItemId } | null {
  const sp = baseSpeed(m) * veinBoost(g, m) * Math.min(1, powerFactor(g, m));
  if (sp <= 0) return null;
  const craft = (r.time * TICK_RATE) / sp;
  let inN = Infinity, inItem: ItemId | null = null;
  if (inputs)
    for (const s of r.inputs) {
      const c = (m.active ? 1 : 0) + Math.floor((m.inBuf[s.item] ?? 0) / s.n);
      if (c < inN) { inN = c; inItem = s.item; }
    }
  const o = r.outputs[0];
  const outN = output ? Math.max(0, Math.floor((RULES.outputCap.value - m.out) / o.n)) : Infinity;
  const n = Math.min(inN, outN);
  if (!isFinite(n)) return null;
  const first = m.active ? Math.max(0, r.time * TICK_RATE - m.prog) / sp : craft;
  const ticks = n <= 0 ? 0 : first + (n - 1) * craft;
  return inN <= outN && inItem ? { sec: ticks / TICK_RATE, why: 'in', item: inItem } : { sec: ticks / TICK_RATE, why: 'out', item: o.item };
}

/**
 * The line report in plain English (DESIGN.md §15 diagnostics, ROADMAP.md Milestone 4): what the
 * whole line around `m` makes, where it ends, and its worst imbalance, with the fix in one line.
 * Ratios are from nominal rates (what each machine makes when busy), so the advice holds before
 * the line has run long enough to measure.
 */
/** a rate per minute as a bare number (the line report writes 'a minute' itself) */
const pm = (n: number) => plain(n, 1);

export function lineReport(g: Game, m: Ent): { text: string; tone: 'good' | 'warn' | 'bad' | 'dim' | 'plain' }[] {
  const out: { text: string; tone: 'good' | 'warn' | 'bad' | 'dim' | 'plain' }[] = [];
  const line = lineOf(g, m);
  if (!line) return out;
  const ms = line.filter((e) => isMachine(e.kind) && e.recipe);
  if (ms.length < 2) return out;
  const made = new Map<ItemId, number>(), used = new Map<ItemId, number>();
  const makers = new Map<ItemId, Ent[]>(), users = new Map<ItemId, Ent[]>();
  for (const e of ms) {
    const n = nominal(e);
    for (const o of n.outs) { made.set(o.item, (made.get(o.item) ?? 0) + o.perMin); makers.set(o.item, [...(makers.get(o.item) ?? []), e]); }
    for (const i of n.ins) { used.set(i.item, (used.get(i.item) ?? 0) + i.perMin); users.set(i.item, [...(users.get(i.item) ?? []), e]); }
  }
  // the line's products: made but not used inside
  const products = [...made.keys()].filter((k) => !used.has(k));
  const sinks = new Set<string>();
  for (const e of ms) if (endsAtSink(g, e)) sinks.add('the Dock or Hopper');
  const machines = ms.length;
  out.push({ text: `The line: ${machines} machines making ${products.map((p) => `${pm(made.get(p)!)} ${itemName(p).toLowerCase()}`).join(', ') || 'parts for each other'} a minute at full speed${sinks.size ? '' : ', but nothing reaches a Dock or Hopper yet'}`, tone: sinks.size ? 'plain' : 'warn' });
  // the worst ratio between what is made and what is wanted inside the line
  let worst: { item: ItemId; ratio: number } | null = null;
  for (const [item, want] of used) {
    const have = made.get(item) ?? 0;
    if (have === 0) continue; // fed from outside the line
    const ratio = have / want;
    if (!worst || Math.abs(Math.log(ratio)) > Math.abs(Math.log(worst.ratio))) worst = { item, ratio };
  }
  if (worst && Math.abs(worst.ratio - 1) > 0.12) {
    const it = itemName(worst.item).toLowerCase();
    const have = made.get(worst.item)!, want = used.get(worst.item)!;
    if (worst.ratio < 1) {
      const maker = makers.get(worst.item)![0];
      const each = nominal(maker).outs.find((o) => o.item === worst!.item)!.perMin;
      const more = Math.ceil((want - have) / each);
      out.push({ text: `Short of ${it}: makes ${pm(have)}, wants ${pm(want)} a minute. Add ${more} ${BUILD[maker.kind].name}${more > 1 ? 's' : ''} making ${it} (${pm(each)} each).`, tone: 'warn' });
    } else {
      const user = users.get(worst.item)![0];
      const each = nominal(user).ins.find((i) => i.item === worst!.item)!.perMin;
      const more = Math.floor((have - want) / each);
      out.push({ text: `Too much ${it}: makes ${pm(have)}, uses ${pm(want)} a minute; the rest backs up.${more >= 1 ? ` ${more} more ${BUILD[user.kind].name}${more > 1 ? 's' : ''} would use it.` : ''}`, tone: 'warn' });
    }
  } else if (worst) out.push({ text: 'Its ratios are balanced.', tone: 'good' });
  // slag
  const slagJams = ms.filter((e) => e.state === 'blocked' && e.why && e.why === e.byItem);
  if (slagJams.length) out.push({ text: `Slag has nowhere to go at ${slagJams.map((e) => entName(g, e)).join(', ')}: a heap, a belt leading away, or a brick press beside it.`, tone: 'bad' });
  return out;
}
