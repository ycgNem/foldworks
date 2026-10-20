// Fold audits (DESIGN.md §10): the boxed line keeps running for 70 s of sim time (a 10 s warm-up,
// then a 60 s window) while the player plays on. Over the window the audit counts items through
// the ports (belts crossing the box edge), each machine's working ticks, and byproducts made
// inside against those that left by a port or were used inside. Then it grades the line:
// score = 0.6 U + 0.2 W + 0.2 C, and says in plain English what would raise it.
import type { Game, ActResult } from '../Game';
import { OK, no } from '../Game';
import { TICK_RATE } from '../../engine/time';
import { BUILD, isMachine, isPower } from '../../data/machines';
import { RECIPE } from '../../data/recipes';
import { RULES, SCORE_WEIGHTS, gradeFor } from '../../data/rules';
import { itemName, type ItemId } from '../../data/items';
import { DX, DY, opposite, type AuditResult, type Box, type Dir, type Ent, type Port } from '../world';
import { entName } from '../analysis';

export const inBox = (b: Box, x: number, y: number) => x >= b.x && y >= b.y && x < b.x + b.w && y < b.y + b.h;

/** Why this box can't be folded, or null. */
export function foldRefusal(g: Game, b: Box): string | null {
  if (!g.done('folding')) return 'Research Folding first';
  if (g.s.audit) return g.s.audit.result ? 'Fold or cancel the audited line first' : 'An audit is already running';
  const max = RULES.foldMax.value;
  if (b.w > max || b.h > max) return `Too big: a fold is at most ${max}x${max}`;
  if (b.w < 1 || b.h < 1) return 'Drag a box over a line';
  const ents = entsIn(g, b);
  for (const e of ents) {
    if (e.kind === 'dock' || e.kind === 'hopper' || e.kind === 'furnace') return `The box holds the ${BUILD[e.kind].name}, which stays on the floor`;
    if (e.x < b.x || e.y < b.y || e.x + e.w > b.x + b.w || e.y + e.h > b.y + b.h) return `${BUILD[e.kind].name} is only partly in the box`;
  }
  const ms = ents.filter((e) => isMachine(e.kind));
  if (!ms.length) return 'No machines in the box';
  // a module is a line, not a part (DECISIONS.md, the Milestone 1-2 review): a lone miner in a
  // 1x1 box would grade S and stamp forever
  if (new Set(ms.map((e) => BUILD[e.kind].machine ?? e.kind)).size < 2) return 'A module is a line: box at least two kinds of machine working together';
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
  g.s.audit = { box: { ...b }, t: 0, ids: ms.map((m) => m.id), ins: {}, outs: {}, busy: {}, crafts0: {}, ports: findPorts(g, b), result: null, stall: {} };
  g.bump('audits');
  g.emit({ type: 'auditStart', x: b.x + b.w / 2, y: b.y + b.h / 2 });
  return OK;
}

export function cancelAudit(g: Game): ActResult {
  if (!g.s.audit) return no('No audit to cancel');
  const b = g.s.audit.box;
  g.s.audit = null;
  g.emit({ type: 'auditCancel', x: b.x + b.w / 2, y: b.y + b.h / 2 });
  return OK;
}

/** Edits inside an audited box would spoil the measurement: refused until it is folded or cancelled. */
export function auditLock(g: Game, x: number, y: number): string | null {
  const a = g.s.audit;
  if (a && inBox(a.box, x, y)) return a.result ? 'Fold this line or cancel the audit first' : 'Auditing this box: wait for the grade, or cancel (Esc)';
  return null;
}

const warmTicks = () => RULES.auditWarmup.value * TICK_RATE;
const windowTicks = () => RULES.auditWindow.value * TICK_RATE;
export const auditTicks = () => warmTicks() + windowTicks();

/** Count a transfer across the box edge (called from Game.onTransfer for every tile change). */
export function auditTransfer(g: Game, x: number, y: number, dir: Dir, item: string) {
  const a = g.s.audit;
  if (!a || a.result || a.t < warmTicks()) return;
  const from = inBox(a.box, x - DX[dir], y - DY[dir]), to = inBox(a.box, x, y);
  if (from === to) return;
  const tally = to ? a.ins : a.outs;
  tally[item] = (tally[item] ?? 0) + 1;
}

export function runAudits(g: Game) {
  const a = g.s.audit;
  if (!a || a.result) return;
  a.t++;
  const warm = warmTicks();
  if (a.t === warm) {
    for (const id of a.ids) {
      const m = g.byId.get(id);
      a.crafts0[id] = m ? m.crafts : 0;
      a.busy[id] = 0;
    }
  }
  if (a.t > warm) {
    const stall = (a.stall ??= {});
    for (const id of a.ids) {
      const m = g.byId.get(id);
      if (!m) continue;
      if (m.state === 'work') a.busy[id] = (a.busy[id] ?? 0) + 1;
      else {
        // what held it back, counted over the window (the advice names the commonest)
        const key = `${m.state}:${m.why ?? ''}`;
        const st = (stall[id] ??= {});
        st[key] = (st[key] ?? 0) + 1;
      }
    }
  }
  if (a.t >= warm + windowTicks()) {
    a.result = gradeAudit(g);
    g.emit({ type: 'auditDone', x: a.box.x + a.box.w / 2, y: a.box.y + a.box.h / 2, id: a.result.grade.letter, d: a.result.grade.score });
  }
}

/** Grade the window measured so far (DESIGN.md §10 Grade): the whole window when it closes, and
 * the projected grade the badge shows while it runs. */
export function gradeAudit(g: Game): AuditResult {
  const a = g.s.audit!;
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
  for (const it of byItems) byOut += a.outs[it] ?? 0;
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
    for (const [k, v] of Object.entries(t)) if (v > 0) o[k as ItemId] = v / secs;
    return o;
  };
  const ins = rate(a.ins), outs = rate(a.outs);
  return {
    grade: { letter: gr.letter, score, u, w, c, mult: gr.mult },
    ins, outs, byMade, byHandled, machineTiles, boxTiles, busy,
    advice: advise(g, ms, busy, { u, w, c }, byMade, byHandled, machineTiles, boxTiles, outs, a.stall ?? {}),
  };
}

/** The projected grade while an audit runs (null during the warm-up). */
export function projectAudit(g: Game): AuditResult | null {
  const a = g.s.audit;
  if (!a) return null;
  if (a.result) return a.result;
  if (a.t <= warmTicks() + TICK_RATE) return null;
  return gradeAudit(g);
}

/** What would raise the grade, weakest part first, each line naming a machine or a number. */
function advise(g: Game, ms: Ent[], busy: Record<string, number>, p: { u: number; w: number; c: number }, byMade: number, byHandled: number, mt: number, bt: number, outs: Partial<Record<ItemId, number>>, stall: Record<string, Record<string, number>>): string[] {
  const lines: { lost: number; text: string }[] = [];
  if (!Object.keys(outs).length) lines.push({ lost: 1, text: 'Nothing left the box: run a belt out of it to a Dock, a Hopper or the next line.' });
  // utilisation: the least busy machine and why
  const slow = ms.filter((m) => busy[m.id] < 0.9).sort((a, b) => busy[a.id] - busy[b.id]);
  if (slow.length) {
    const m = slow[0];
    const pct = Math.round(busy[m.id] * 100);
    // the commonest reason over the window, not the state at its end
    const top = Object.entries(stall[m.id] ?? {}).sort((x, y) => y[1] - x[1])[0]?.[0] ?? '';
    const [st, why] = top.split(':');
    const reason = why === 'power' ? 'short of power'
      : st === 'blocked' && why ? `blocked by ${itemName(why as ItemId).toLowerCase()}`
      : st === 'starved' && why && why !== 'crank' ? `starved of ${itemName(why as ItemId).toLowerCase()}` : 'waiting';
    lines.push({ lost: SCORE_WEIGHTS.u * (1 - p.u), text: `${entName(g, m)} worked ${pct}% of the time (${reason}). Balance the ratio: ${slow.length > 1 ? `${slow.length} machines` : 'it'} could run faster.` });
  }
  if (byMade > 0 && byHandled < byMade) {
    const left = byMade - byHandled;
    lines.push({ lost: SCORE_WEIGHTS.w * (1 - p.w), text: `${left} of ${byMade} slag went nowhere useful. Belt it out through a port, or press it into bricks inside.` });
  }
  if (p.c < 1) {
    const need = Math.ceil(bt * RULES.compactFull.value);
    lines.push({ lost: SCORE_WEIGHTS.c * (1 - p.c), text: `${mt} of ${bt} tiles are machines; ${need} would be fully compact. Draw the box tighter.` });
  }
  return lines.sort((a, b) => b.lost - a.lost).map((l) => l.text);
}
