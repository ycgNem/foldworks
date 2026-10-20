// Line analysis (pillar 3: bottlenecks are puzzles, not mysteries). Which machines form a line,
// who feeds a machine, what it wants per minute and what it gets, and the grade a line would
// earn by DESIGN.md §10's formula (the Inspector Spark and the fold audit's preview use it).
// Pure: reads the Game, never writes it.
import type { Game } from './Game';
import { DX, DY, ccw, cw, opposite, type Dir, type Ent } from './world';
import { BUILD, isMachine } from '../data/machines';
import { RECIPE } from '../data/recipes';
import { ITEMS, itemName, type ItemId } from '../data/items';
import { RULES, SCORE_WEIGHTS, gradeFor } from '../data/rules';
import { shares } from './systems/stats';

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
    case 'smelter':
    case 'press':
    case 'assembler':
    case 'furnace':
      return [front, ...[ccw(e.rot), opposite(e.rot), cw(e.rot)].map((d) => ({ x: e.x + DX[d], y: e.y + DY[d], d }))];
    default:
      return [];
  }
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
      if (t && !isSink(t) && t !== e && linked(g, e, t, l.d)) union(e.id, t.id);
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
  const crafts = 60 / r.time;
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
export function feeders(g: Game, m: Ent): { from: Ent[]; shared: Ent[] } {
  const from: Ent[] = [];
  const shared: Ent[] = [];
  const seen = new Set<number>([m.id]);
  const todo: Ent[] = [m];
  while (todo.length) {
    const cur = todo.pop()!;
    for (let d = 0 as Dir; d < 4; d = (d + 1) as Dir) {
      const n = g.entAt(cur.x + DX[d], cur.y + DY[d]);
      if (!n || seen.has(n.id) || isSink(n)) continue;
      // does n hand items into cur?
      const links = outLinks(n).filter((l) => l.x >= cur.x && l.x < cur.x + cur.w && l.y >= cur.y && l.y < cur.y + cur.h);
      if (!links.some((l) => linked(g, n, cur, l.d))) continue;
      seen.add(n.id);
      if (isMachine(n.kind)) from.push(n);
      else {
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
  return { from, shared };
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

const pct = (f: number) => Math.round(f * 100) + '%';
const perMin = (n: number) => (Math.round(n * 10) / 10).toString().replace(/\.0$/, '') + '/min';

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
  // what it is doing now
  if (m.state === 'work') out.push({ text: `Working${sh.n ? ': busy ' + pct(sh.work) + ' of the last minute' : ''}`, tone: 'good' });
  else if (m.state === 'starved') {
    if (m.why === 'crank') out.push({ text: 'Waiting for a crank: click it', tone: 'warn' });
    else out.push({ text: `Starved of ${m.why ? itemName(m.why).toLowerCase() : 'input'}${sh.n ? ' ' + pct(sh.starved) + ' of the last minute' : ''}`, tone: 'warn' });
  } else if (m.state === 'blocked') {
    if (m.why === m.byItem && m.why) out.push({ text: `Blocked: its ${itemName(m.why).toLowerCase()} has nowhere to go${sh.n ? ' (' + pct(sh.byBlocked) + ' of the last minute)' : ''}`, tone: 'bad' });
    else out.push({ text: `Blocked: its ${m.why ? itemName(m.why).toLowerCase() : 'output'} has nowhere to go${sh.n ? ' (' + pct(sh.blocked) + ' of the last minute)' : ''}`, tone: 'bad' });
  } else out.push({ text: 'Idle', tone: 'dim' });
  // rates
  if (nom.outs.length) out.push({ text: `Makes ${nom.outs.map((o) => perMin(o.perMin) + ' ' + itemName(o.item).toLowerCase()).join(', ')} when busy; ${perMin(nom.outs[0].perMin * sh.work)} now`, tone: 'plain' });
  if (nom.ins.length) {
    const f = feeders(g, m);
    out.push({ text: `Wants ${nom.ins.map((i) => perMin(i.perMin) + ' ' + itemName(i.item).toLowerCase()).join(' + ')}`, tone: 'plain' });
    if (f.from.length) {
      const supply = f.from.map((s) => {
        const sn = nominal(s);
        return `${entName(g, s)} (${sn.outs.map((o) => perMin(o.perMin) + ' ' + itemName(o.item).toLowerCase()).join(', ')})`;
      });
      out.push({ text: `Fed by ${supply.join(', ')}`, tone: 'plain' });
    } else out.push({ text: m.kind === 'furnace' ? 'Fed by hand (the ore patch)' : 'Nothing feeds it: point a belt or a machine\'s front into it', tone: m.kind === 'furnace' ? 'dim' : 'bad' });
    if (f.shared.length) out.push({ text: `Its supply is shared with ${f.shared.map((s) => entName(g, s)).join(', ')}`, tone: 'warn' });
  }
  if (r.byproduct) {
    const every = r.byproduct.every;
    out.push({ text: `1 ${itemName(r.byproduct.item).toLowerCase()} per ${every} crafts leaves by a side: a Slag Heap or a belt leading away`, tone: m.by >= RULES.outputCap.value ? 'bad' : 'dim' });
    if (m.by >= RULES.outputCap.value) out.push({ text: 'Click it to shovel the slag out by hand', tone: 'warn' });
  }
  // the front
  if (m.kind !== 'miner') {
    const front = g.entAt(m.x + DX[m.rot], m.y + DY[m.rot]);
    if (!front) out.push({ text: 'Nothing at its front: its output waits', tone: m.out > 0 ? 'bad' : 'dim' });
  }
  return out;
}
