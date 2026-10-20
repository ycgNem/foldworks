// Fold audits (DESIGN.md §10): the boxed line keeps running for 70 s of sim time (a 10 s warm-up,
// then a 60 s window) while the player plays on. Over the window the audit counts items through
// the ports (belts crossing the box edge), each machine's working ticks (scaled by the power it
// got: a brownout is not full work), and byproducts made inside against those that left by a port
// or were used inside. Items that were already in the box when the window opened and left it
// during the window are not production: the stock drawdown is taken off the outputs. Then it
// grades the line: score = 0.6 U + 0.2 W + 0.2 C, and says in plain English what would raise it,
// with what each fix is worth. Up to three lines can be audited at once (RULES.maxAudits).
import type { Game, ActResult } from '../Game';
import { OK, no } from '../Game';
import { TICK_RATE } from '../../engine/time';
import { BUILD, isMachine, isPower } from '../../data/machines';
import { RECIPE } from '../../data/recipes';
import { RULES, SCORE_WEIGHTS, gradeFor, GRADES } from '../../data/rules';
import { ITEMS, itemName, type ItemId } from '../../data/items';
import { DX, DY, opposite, type AuditResult, type AuditState, type Box, type Dir, type Ent, type Port } from '../world';
import { entName, feeders } from '../analysis';
import { powerFactor } from './power';

export const inBox = (b: Box, x: number, y: number) => x >= b.x && y >= b.y && x < b.x + b.w && y < b.y + b.h;
const overlaps = (a: Box, b: Box) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

/** The audit whose grade is waiting for a decision (the grade card shows it), if any. */
export function gradedAudit(g: Game): AuditState | null {
  return g.s.audits.find((a) => a.result) ?? null;
}

/** The audit covering a tile, if any. */
export function auditAt(g: Game, x: number, y: number): AuditState | null {
  return g.s.audits.find((a) => inBox(a.box, x, y)) ?? null;
}

/** Is this machine being measured right now (boosts must not reach it)? */
export function isAudited(g: Game, id: number): boolean {
  return g.s.audits.some((a) => !a.result && a.ids.includes(id));
}

/** Why this box can't be folded, or null. */
export function foldRefusal(g: Game, b: Box): string | null {
  if (!g.done('folding')) return 'Research Folding first';
  const max = RULES.maxAudits.value;
  if (g.s.audits.length >= max) return `${max} audits are running: fold or cancel one first`;
  if (g.s.audits.some((a) => overlaps(a.box, b))) return 'This box overlaps a line being audited';
  const fmax = RULES.foldMax.value;
  if (b.w > fmax || b.h > fmax) return `Too big: a fold is at most ${fmax}x${fmax}`;
  if (b.w < 1 || b.h < 1) return 'Drag a box over a line';
  const ents = entsIn(g, b);
  for (const e of ents) {
    if (e.kind === 'dock' || e.kind === 'hopper' || e.kind === 'furnace') return `The box holds the ${BUILD[e.kind].name}, which stays on the floor`;
    if (e.x < b.x || e.y < b.y || e.x + e.w > b.x + b.w || e.y + e.h > b.y + b.h) return `${BUILD[e.kind].name} is only partly in the box`;
  }
  const ms = ents.filter((e) => isMachine(e.kind));
  if (!ms.length) return 'No machines in the box';
  // a module is a line, not a part (DECISIONS.md, the Milestone 1-2 review): a lone miner in a
  // 1x1 box would grade S and stamp forever. Two kinds of machine, or one machine in the box
  // feeding another in it (an assembler line: circuits into motors; Act II's review)
  if (new Set(ms.map((e) => BUILD[e.kind].machine ?? e.kind)).size < 2) {
    const ids = new Set(ms.map((e) => e.id));
    if (!ms.some((m) => feeders(g, m).from.some((f) => ids.has(f.id)))) return 'A module is a line: box two kinds of machine, or one machine feeding another';
  }
  return powerRefusal(g, ents);
}

/** Power never crosses a fold box (DESIGN.md §18): every grid with a member in the box must be
 * wholly inside it, and so must every Boiler and the Steam Engine it steams. */
function powerRefusal(g: Game, ents: Ent[]): string | null {
  const ids = new Set(ents.map((e) => e.id));
  if (!ents.some((e) => isPower(e.kind) || (BUILD[e.kind].kw ?? 0) > 0)) return null;
  for (const gr of g.grids) {
    const members = [...gr.poles, ...gr.producers, ...gr.consumers];
    if (!members.some((m) => ids.has(m.id))) continue;
    const out = members.find((m) => !ids.has(m.id));
    if (out) return `Power crosses the box: the ${BUILD[out.kind].name} at ${out.x},${out.y} shares its grid. Box the whole grid, or give this line its own`;
  }
  for (const [engId, b] of g.boilerOf) {
    if (ids.has(engId) !== ids.has(b.id)) return 'A Boiler and its Steam Engine must be folded together';
  }
  return null;
}

export function entsIn(g: Game, b: Box): Ent[] {
  const seen = new Set<number>();
  const out: Ent[] = [];
  for (let y = b.y; y < b.y + b.h; y++)
    for (let x = b.x; x < b.x + b.w; x++) {
      const e = g.entAt(x, y);
      if (e && !seen.has(e.id)) {
        seen.add(e.id);
        out.push(e);
      }
    }
  return out;
}

/** Every item held inside a box: on belts, in crates, splitters and mergers, heaps, and machine
 * buffers. The audit takes what it draws down off the measured outputs. */
export function stockIn(g: Game, b: Box): Record<string, number> {
  const st: Record<string, number> = {};
  const add = (k: string | null, n: number) => { if (k && n > 0) st[k] = (st[k] ?? 0) + n; };
  for (const e of entsIn(g, b)) {
    if (e.kind === 'belt') add(e.item, 1);
    else if (e.kind === 'heap') add('slag', e.count);
    else if (e.kind === 'crate' || e.kind === 'splitter' || e.kind === 'merger') for (const it of e.store) add(it, 1);
    else {
      for (const [k, v] of Object.entries(e.inBuf)) add(k, v);
      add(e.outItem, e.out);
      add(e.byItem, e.by);
    }
  }
  return st;
}

/** Belts that cross the box edge: an edge belt pointing out, or a belt outside pointing in. */
export function findPorts(g: Game, b: Box): Port[] {
  const ports: Port[] = [];
  for (let y = b.y; y < b.y + b.h; y++)
    for (let x = b.x; x < b.x + b.w; x++) {
      if (x !== b.x && y !== b.y && x !== b.x + b.w - 1 && y !== b.y + b.h - 1) continue;
      for (let d = 0 as Dir; d < 4; d = (d + 1) as Dir) {
        const ox = x + DX[d], oy = y + DY[d];
        if (inBox(b, ox, oy)) continue;
        const inside = g.entAt(x, y), outside = g.entAt(ox, oy);
        // out: something inside hands items across this edge (a belt or a machine's front/side)
        if (inside && (inside.kind === 'belt' ? inside.rot === d : isMachine(inside.kind)) && outside && outside.kind !== 'miner')
          if (inside.kind === 'belt' || outside.kind === 'belt' || outside.kind === 'dock' || outside.kind === 'hopper') ports.push({ x, y, dir: d, io: 'out' });
        // in: a belt outside pointing at this tile
        if (outside && outside.kind === 'belt' && outside.rot === opposite(d) && inside) ports.push({ x, y, dir: opposite(d), io: 'in' });
      }
    }
  return ports;
}

export function startAudit(g: Game, b: Box): ActResult {
  const why = foldRefusal(g, b);
  if (why) return no(why);
  const ms = entsIn(g, b).filter((e) => isMachine(e.kind));
  g.s.audits.push({ id: g.s.nextAudit++, box: { ...b }, t: 0, ids: ms.map((m) => m.id), ins: {}, outs: {}, busy: {}, crafts0: {}, ports: findPorts(g, b), result: null, stall: {} });
  g.bump('audits');
  g.emit({ type: 'auditStart', x: b.x + b.w / 2, y: b.y + b.h / 2 });
  return OK;
}

/** Cancel an audit: the one named, or else the graded one, or else the newest. */
export function cancelAudit(g: Game, id?: number): ActResult {
  const a = id !== undefined ? g.s.audits.find((q) => q.id === id) : gradedAudit(g) ?? g.s.audits[g.s.audits.length - 1];
  if (!a) return no('No audit to cancel');
  g.s.audits = g.s.audits.filter((q) => q !== a);
  g.emit({ type: 'auditCancel', x: a.box.x + a.box.w / 2, y: a.box.y + a.box.h / 2 });
  return OK;
}

/** Edits inside an audited box would spoil the measurement: refused until it is folded or cancelled. */
export function auditLock(g: Game, x: number, y: number): string | null {
  const a = auditAt(g, x, y);
  if (a) return a.result ? 'Fold this line or cancel the audit first' : 'Auditing this box: wait for the grade, or cancel (Esc)';
  return null;
}

const warmTicks = () => RULES.auditWarmup.value * TICK_RATE;
const windowTicks = () => RULES.auditWindow.value * TICK_RATE;
export const auditTicks = () => warmTicks() + windowTicks();

/** Count a transfer across a box edge (called from Game.onTransfer for every tile change). */
export function auditTransfer(g: Game, x: number, y: number, dir: Dir, item: string) {
  for (const a of g.s.audits) {
    if (a.result || a.t < warmTicks()) continue;
    const from = inBox(a.box, x - DX[dir], y - DY[dir]), to = inBox(a.box, x, y);
    if (from === to) continue;
    const tally = to ? a.ins : a.outs;
    tally[item] = (tally[item] ?? 0) + 1;
  }
}

export function runAudits(g: Game) {
  for (const a of g.s.audits) {
    if (a.result) continue;
    a.t++;
    const warm = warmTicks();
    if (a.t === warm) {
      for (const id of a.ids) {
        const m = g.byId.get(id);
        a.crafts0[id] = m ? m.crafts : 0;
        a.busy[id] = 0;
      }
      a.stock0 = stockIn(g, a.box);
    }
    if (a.t > warm) {
      const stall = (a.stall ??= {});
      for (const id of a.ids) {
        const m = g.byId.get(id);
        if (!m) continue;
        // work counts at the speed power allowed: a machine at 57% in a brownout is 57% busy
        if (m.state === 'work') a.busy[id] = (a.busy[id] ?? 0) + Math.min(1, powerFactor(g, m));
        else {
          // what held it back, counted over the window (the advice names the commonest)
          const key = `${m.state}:${m.why ?? ''}`;
          const st = (stall[id] ??= {});
          st[key] = (st[key] ?? 0) + 1;
        }
      }
    }
    if (a.t >= warm + windowTicks()) {
      a.result = gradeAudit(g, a);
      g.emit({ type: 'auditDone', x: a.box.x + a.box.w / 2, y: a.box.y + a.box.h / 2, id: a.result.grade.letter, d: a.result.grade.score, value: a.id });
    }
  }
}

/** Stock that drains by no more than this many of an item over the window is belts and buffers
 * settling, not production (DESIGN.md §10 Audit). */
const STOCK_NOISE = 3;

/** The window's item counts net of stock already in the box (DESIGN.md §10 Audit; the Milestone 3
 * gate and Milestone 4 reviews): what was drawn down of an item that also left the box comes off
 * that output (a crate of Gizmos draining out is not a Gizmo factory), and the rest of what was
 * drawn down is an input the module will need (a crate of steel feeding a kit assembler inside
 * makes a module that takes steel, not one that makes kits from nothing, whatever kits are worth). */
function netCounts(g: Game, a: AuditState): { ins: Record<string, number>; outs: Record<string, number> } {
  const outs: Record<string, number> = { ...a.outs };
  const ins: Record<string, number> = { ...a.ins };
  if (!a.stock0) return { ins, outs };
  const now = stockIn(g, a.box);
  for (const [k, n0] of Object.entries(a.stock0)) {
    let d = n0 - (now[k] ?? 0);
    if (d <= STOCK_NOISE) continue;
    const same = Math.min(d, outs[k] ?? 0);
    if (same > 0) { outs[k] -= same; d -= same; }
    if (d > 0) ins[k] = (ins[k] ?? 0) + d;
  }
  return { ins, outs };
}

/** Grade the window measured so far (DESIGN.md §10 Grade): the whole window when it closes, and
 * the projected grade the badge shows while it runs. */
export function gradeAudit(g: Game, a: AuditState): AuditResult {
  const n = Math.max(1, Math.min(windowTicks(), a.t - warmTicks()));
  const secs = n / TICK_RATE;
  const ms = a.ids.map((id) => g.byId.get(id)).filter((m): m is Ent => !!m);
  // U: mean busy fraction
  const busy: Record<string, number> = {};
  let u = 0;
  for (const m of ms) {
    busy[m.id] = Math.min(1, (a.busy[m.id] ?? 0) / n);
    u += busy[m.id];
  }
  u = ms.length ? u / ms.length : 0;
  const net = netCounts(g, a);
  const outCounts = net.outs;
  // W: byproducts made inside (plus those a machine blocked by its byproduct would have made:
  // a line jammed by slag makes none, and must not score W = 1) vs. those that left by a port or
  // were used inside
  let byMade = 0, usedInside = 0;
  const byItems = new Set<string>();
  for (const m of ms) {
    const r = m.recipe ? RECIPE[m.recipe] : null;
    if (!r) continue;
    const crafts = m.crafts - (a.crafts0[m.id] ?? m.crafts);
    if (r.byproduct) {
      byItems.add(r.byproduct.item);
      byMade += Math.floor(crafts / r.byproduct.every);
      const jammed = a.stall?.[m.id]?.[`blocked:${r.byproduct.item}`] ?? 0;
      byMade += Math.floor(jammed / (r.time * TICK_RATE) / r.byproduct.every);
    }
  }
  for (const m of ms) {
    const r = m.recipe ? RECIPE[m.recipe] : null;
    if (!r) continue;
    const crafts = m.crafts - (a.crafts0[m.id] ?? m.crafts);
    for (const st of r.inputs) if (byItems.has(st.item)) usedInside += crafts * st.n;
  }
  let byOut = 0;
  for (const it of byItems) byOut += outCounts[it] ?? 0;
  const byHandled = Math.min(byMade, byOut + usedInside);
  const w = byMade > 0 ? byHandled / byMade : 1;
  // C: machine tiles over box tiles, full at 0.6
  let machineTiles = 0;
  for (const m of ms) machineTiles += m.w * m.h;
  const boxTiles = a.box.w * a.box.h;
  const c = Math.min(1, machineTiles / boxTiles / RULES.compactFull.value);
  const score = SCORE_WEIGHTS.u * u + SCORE_WEIGHTS.w * w + SCORE_WEIGHTS.c * c;
  const gr = gradeFor(score);
  const rate = (t: Record<string, number>) => {
    const o: Partial<Record<ItemId, number>> = {};
    for (const [k, v] of Object.entries(t)) if (v > 1e-9) o[k as ItemId] = v / secs;
    return o;
  };
  const ins = rate(net.ins), outs = rate(outCounts);
  const advice = advise(g, ms, busy, { u, w, c }, score, byMade, byHandled, machineTiles, boxTiles, outs, a.stall ?? {});
  // S+ is a zero-waste line: its byproducts are used inside the box (bricks, gravel), or it makes
  // none. A line that only routes its slag out to a heap or a Dock tops out at S (the Milestone 4
  // review: a miner and a smelter graded S+)
  const gr2 = splusGate(gr, score, byMade, usedInside);
  if (gr2 !== gr) advice.unshift(`One step to S+: use the ${[...byItems].map((i) => itemName(i as ItemId).toLowerCase()).join(' and ')} inside the box (a press making bricks, a crusher making gravel); routed out to a heap, it caps the grade at S.`);
  return {
    grade: { letter: gr2.letter, score, u, w, c, mult: gr2.mult },
    ins, outs, byMade, byHandled, machineTiles, boxTiles, busy,
    advice,
  };
}

/** S+ needs the byproducts used inside the box (RULES.splusUsedInside of them), or none made. */
export function splusGate<T extends { letter: string }>(gr: T, score: number, byMade: number, usedInside: number): T {
  if (gr.letter !== 'S+' || byMade <= 0 || usedInside >= byMade * RULES.splusUsedInside.value) return gr;
  return (GRADES.find((q) => q.letter === 'S') as unknown as T) ?? gr;
}

/** The projected grade of an audit while it runs (null during the warm-up). */
export function projectAudit(g: Game, a: AuditState | null = g.s.audits[0] ?? null): AuditResult | null {
  if (!a) return null;
  if (a.result) return a.result;
  if (a.t <= warmTicks() + TICK_RATE) return null;
  return gradeAudit(g, a);
}

/** "+0.12 → A": what a fix is worth and the grade it would reach. */
function worth(score: number, lost: number): string {
  const to = gradeFor(Math.min(1, score + lost));
  return `+${lost.toFixed(2)}${to.letter !== gradeFor(score).letter ? ` → ${to.letter}` : ''}`;
}

/** What would raise the grade, weakest part first, each line naming a machine or a number and
 * what it is worth. Every grade gets advice, S included (S+ is above it). */
function advise(g: Game, ms: Ent[], busy: Record<string, number>, p: { u: number; w: number; c: number }, score: number, byMade: number, byHandled: number, mt: number, bt: number, outs: Partial<Record<ItemId, number>>, stall: Record<string, Record<string, number>>): string[] {
  const lines: { lost: number; text: string }[] = [];
  if (!Object.keys(outs).length) lines.push({ lost: 1, text: 'Nothing left the box: run a belt out of it to a Dock, a Hopper or the next line.' });
  // utilisation: find the slowest stage, not just the idlest machine
  const slow = ms.filter((m) => busy[m.id] < 0.97).sort((a, b) => busy[a.id] - busy[b.id]);
  if (slow.length) {
    const m = slow[0];
    const pct = Math.round(busy[m.id] * 100);
    const top = Object.entries(stall[m.id] ?? {}).sort((x, y) => y[1] - x[1])[0]?.[0] ?? '';
    const [st, why] = top.split(':');
    const lost = SCORE_WEIGHTS.u * (1 - p.u);
    const perMin = (mm: Ent, item: string, side: 'in' | 'out') => {
      const r = mm.recipe ? RECIPE[mm.recipe] : null;
      if (!r) return 0;
      const s = (side === 'in' ? r.inputs : r.outputs).find((q) => q.item === item);
      return s ? (s.n * 60 * (BUILD[mm.kind].speed ?? 1)) / r.time : 0;
    };
    let text: string;
    if (why === 'power') text = `${entName(g, m)} ran ${pct}%, short of power: add a producer to its grid.`;
    else if (st === 'blocked' && why) {
      // blocked by X: the machines inside that take X are the bottleneck
      const takers = ms.filter((q) => perMin(q, why, 'in') > 0);
      const makes = ms.reduce((s, q) => s + perMin(q, why, 'out'), 0);
      const takes = takers.reduce((s, q) => s + perMin(q, why, 'in'), 0);
      const nm = itemName(why as ItemId).toLowerCase();
      if (takers.length && makes > takes + 0.5) {
        const one = perMin(takers[0], why, 'in');
        text = `${BUILD[takers[0].kind].name}s are the bottleneck: they take ${Math.round(takes)} ${nm}/min and the line makes ${Math.round(makes)}. Add ${Math.max(1, Math.ceil((makes - takes) / one))} more, or one fewer maker.`;
      } else text = `${entName(g, m)} ran ${pct}%, blocked by its ${nm}: it has nowhere to go fast enough. Belt it out, or add a machine that takes it.`;
    } else if (st === 'starved' && why && why !== 'crank') {
      const nm = itemName(why as ItemId).toLowerCase();
      const want = perMin(m, why, 'in');
      text = `${entName(g, m)} ran ${pct}%, starved of ${nm}: it wants ${Math.round(want)}/min and got about ${Math.round(want * busy[m.id])}. Feed it more ${nm}.`;
    } else text = `${entName(g, m)} ran ${pct}% of the time. Balance the ratio: ${slow.length > 1 ? `${slow.length} machines` : 'it'} could run faster.`;
    lines.push({ lost, text: `${text} (${worth(score, lost)})` });
  }
  if (byMade > 0 && byHandled < byMade) {
    const lost = SCORE_WEIGHTS.w * (1 - p.w);
    lines.push({ lost, text: `${byMade - byHandled} of ${byMade} slag went nowhere useful. Belt it out through a port, or press it into bricks inside. (${worth(score, lost)})` });
  }
  if (p.c < 1) {
    const lost = SCORE_WEIGHTS.c * (1 - p.c);
    const need = Math.ceil(bt * RULES.compactFull.value);
    lines.push({ lost, text: `${mt} of ${bt} tiles are machines; ${need} would be fully compact. Draw the box tighter. (${worth(score, lost)})` });
  }
  if (!lines.length) lines.push({ lost: 0, text: score >= 0.97 ? 'Flawless: every machine busy, waste handled, nothing wasted on space.' : 'Nothing to fix: every part scores full marks.' });
  return lines.sort((a, b) => b.lost - a.lost).map((l) => l.text);
}
