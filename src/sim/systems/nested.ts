// Nested folds (DESIGN.md §18): with research Nested Folds the Fold tool works on the Factory
// floor. A box of up to 6x6 holding modules and trunks is audited the same way as a Workshop
// line (a 10 s warm-up, then a 60 s window) and folds into a depth-2 module: one tile running at
// the group's measured rates times its own grade. U is the modules' mean run fraction; W is
// byproducts that left by a trunk or went into a module inside, against those made (and those a
// module blocked by its byproduct would have made); C is module tiles over box tiles over 0.6.
import type { Game, ActResult } from '../Game';
import { OK, no } from '../Game';
import { TICK_RATE } from '../../engine/time';
import { prules } from '../patents';
import { FACTORY } from '../../data/land';
import { RULES, SCORE_WEIGHTS, gradeFor } from '../../data/rules';
import { itemName, type ItemId } from '../../data/items';
import type { AuditResult, Box, FEnt, ModuleDesign } from '../world';
import { inBox, splusGate } from './audits';
import { compactFull, splusShare, strictGrade } from './challenges';
import { BYPRODUCTS, defaultName, fname } from './modules';

const DT = 1 / TICK_RATE;
/** warm-up and window in ticks: Quick Audits (a Patent, §19) shortens them */
const warmTicks = (g?: Game) => (g ? prules(g).auditWarmup : RULES.auditWarmup.value) * TICK_RATE;
const windowTicks = (g?: Game) => (g ? prules(g).auditWindow : RULES.auditWindow.value) * TICK_RATE;

/** Everything on the Factory floor with a tile in the box. */
export function fentsIn(g: Game, b: Box): FEnt[] {
  const seen = new Set<number>();
  const out: FEnt[] = [];
  for (let y = b.y; y < b.y + b.h; y++)
    for (let x = b.x; x < b.x + b.w; x++) {
      const e = g.fentAt(x, y);
      if (e && !seen.has(e.id)) {
        seen.add(e.id);
        out.push(e);
      }
    }
  return out;
}

/** Why this Factory box can't be folded, or null. */
export function ffoldRefusal(g: Game, b: Box): string | null {
  if (!g.done('nestedFolds')) return 'Research Nested Folds first';
  if (g.s.faudit) return g.s.faudit.result ? 'Fold or cancel the audited group first' : 'An audit is already running on this floor';
  const max = prules(g).nestedMax;
  if (b.w > max || b.h > max) return `Too big: a nested fold is at most ${max}x${max}`;
  if (b.w < 1 || b.h < 1) return 'Drag a box over a group of modules';
  if (b.x < 0 || b.y < 0 || b.x + b.w > g.fw || b.y + b.h > g.fh) return 'The box is off the floor';
  const ents = fentsIn(g, b);
  for (const e of ents) {
    if (e.kind === 'fdock' || e.kind === 'fhopper' || e.kind === 'fbay' || e.kind === 'fchute') return `The box holds the ${fname(g, e)}, which stays on the floor`;
    if (e.x < b.x || e.y < b.y || e.x + e.w > b.x + b.w || e.y + e.h > b.y + b.h) return `${fname(g, e)} is only partly in the box`;
  }
  const mods = ents.filter((e) => e.kind === 'module');
  if (mods.length < 2) return 'Box at least two modules: a nested fold folds a group';
  for (const m of mods) if (g.design(m.design)?.depth === 2) return `${fname(g, m)} is folded from modules already: depth 2 is the limit`;
  // a group, not a pile: at least one module inside must feed another inside (two unrelated
  // modules in a box would stack their grades for nothing; the Milestone 3 gate review)
  // one group, not a pile: every module inside joined to the others by trunks inside the box
  // (two unrelated modules, or a pair with strangers riding along, would stack their grades for
  // nothing; the Milestone 3 gate and Milestone 4 reviews)
  const ids = new Set(mods.map((m) => m.id));
  const inner = g.routes.filter((r) => r.to && ids.has(r.from.id) && ids.has(r.to.id));
  if (!inner.some((r) => !r.by)) return 'Box a group that works together: at least one module inside must feed another inside';
  const seen = new Set<number>([mods[0].id]);
  for (let grew = true; grew; ) {
    grew = false;
    for (const r of inner) {
      const a = r.from.id, b = r.to!.id;
      if (seen.has(a) !== seen.has(b)) { seen.add(a); seen.add(b); grew = true; }
    }
  }
  const stray = mods.find((m) => !seen.has(m.id));
  if (stray) return `${fname(g, stray)} isn't joined to the rest by a trunk inside the box: box one group`;
  return null;
}

export function startFAudit(g: Game, b: Box): ActResult {
  const why = ffoldRefusal(g, b);
  if (why) return no(why);
  const mods = fentsIn(g, b).filter((e) => e.kind === 'module');
  g.s.faudit = { box: { ...b }, t: 0, ids: mods.map((m) => m.id), ins: {}, outs: {}, run: {}, made: 0, missed: 0, inside: 0, result: null };
  g.bump('audits');
  g.emit({ type: 'auditStart', x: b.x + b.w / 2, y: b.y + b.h / 2, floor: 'factory' });
  return OK;
}

export function cancelFAudit(g: Game): ActResult {
  if (!g.s.faudit) return no('No audit to cancel');
  const b = g.s.faudit.box;
  g.s.faudit = null;
  g.emit({ type: 'auditCancel', x: b.x + b.w / 2, y: b.y + b.h / 2, floor: 'factory' });
  return OK;
}

/** Edits inside an audited Factory box would spoil the measurement. */
export function fauditLock(g: Game, x: number, y: number): string | null {
  const a = g.s.faudit;
  if (a && inBox(a.box, x, y)) return a.result ? 'Fold this group or cancel the audit first' : 'Auditing this box: wait for the grade, or cancel (Esc)';
  return null;
}

const inside = (b: Box, e: FEnt) => inBox(b, e.x, e.y);

/** Count an amount moved along a trunk route (modules.ts calls it for every share it moves). */
export function fauditFlow(g: Game, from: FEnt, to: FEnt, item: string, amt: number) {
  const a = g.s.faudit;
  if (!a || a.result || a.t < warmTicks(g)) return;
  const fi = inside(a.box, from), ti = inside(a.box, to);
  if (fi && !ti) a.outs[item] = (a.outs[item] ?? 0) + amt;
  else if (!fi && ti) a.ins[item] = (a.ins[item] ?? 0) + amt;
  else if (fi && ti && BYPRODUCTS.has(item)) a.inside += amt;
}

export function runFAudits(g: Game) {
  const a = g.s.faudit;
  if (!a || a.result) return;
  a.t++;
  const warm = warmTicks(g);
  if (a.t <= warm) return;
  for (const id of a.ids) {
    const m = g.fById.get(id);
    if (!m) continue;
    a.run[id] = (a.run[id] ?? 0) + m.f;
    const d = g.design(m.design);
    if (!d) continue;
    // modules under audit run without the Great Drill's boost (runModules), so k is 1 here
    const k = 1;
    for (const [o, r] of Object.entries(d.outs) as [ItemId, number][]) {
      if (!BYPRODUCTS.has(o)) continue;
      a.made += r * k * DT * m.f;
      if (m.state === 'blocked' && m.why === o) a.missed += r * k * DT * (1 - m.f);
    }
  }
  if (a.t >= warm + windowTicks(g)) {
    a.result = gradeFAudit(g);
    g.emit({ type: 'auditDone', x: a.box.x + a.box.w / 2, y: a.box.y + a.box.h / 2, id: a.result.grade.letter, d: a.result.grade.score, floor: 'factory' });
  }
}

/** Grade the Factory audit's window so far (or the whole of it). */
export function gradeFAudit(g: Game): AuditResult {
  const a = g.s.faudit!;
  const n = Math.max(1, a.t - warmTicks(g));
  const secs = n / TICK_RATE;
  const mods = a.ids.map((id) => g.fById.get(id)).filter((m): m is FEnt => !!m);
  const busy: Record<string, number> = {};
  let u = 0;
  for (const m of mods) {
    busy[m.id] = Math.min(1, (a.run[m.id] ?? 0) / n);
    u += busy[m.id];
  }
  u = mods.length ? u / mods.length : 0;
  let byOut = 0;
  for (const it of BYPRODUCTS) byOut += a.outs[it] ?? 0;
  const byMade = a.made + a.missed;
  const byHandled = Math.min(byMade, byOut + a.inside);
  const w = byMade > 1e-6 ? byHandled / byMade : 1;
  const machineTiles = mods.length;
  const boxTiles = a.box.w * a.box.h;
  const c = Math.min(1, machineTiles / boxTiles / compactFull(g));
  const score = SCORE_WEIGHTS.u * u + SCORE_WEIGHTS.w * w + SCORE_WEIGHTS.c * c;
  const gr = strictGrade(g, splusGate(gradeFor(score), score, byMade, a.inside, splusShare(g)));
  const rate = (t: Record<string, number>) => {
    const o: Partial<Record<ItemId, number>> = {};
    for (const [k, v] of Object.entries(t)) if (v > 1e-6) o[k as ItemId] = v / secs;
    return o;
  };
  const ins = rate(a.ins), outs = rate(a.outs);
  // advice, weakest part first
  const lines: { lost: number; text: string }[] = [];
  if (!Object.keys(outs).length) lines.push({ lost: 1, text: 'Nothing left the box: run a trunk out of it to the Factory Dock, the Hopper or another module.' });
  const slow = mods.filter((m) => busy[m.id] < 0.9).sort((p, q) => busy[p.id] - busy[q.id]);
  if (slow.length) {
    const m = slow[0];
    const why = m.why ? `${m.state === 'blocked' ? 'blocked by' : 'starved of'} ${itemName(m.why as ItemId).toLowerCase()}` : 'waiting';
    lines.push({ lost: SCORE_WEIGHTS.u * (1 - u), text: `${fname(g, m)} ran ${Math.round(busy[m.id] * 100)}% (${why}). Match the modules' rates: ${slow.length > 1 ? `${slow.length} modules` : 'it'} could run faster.` });
  }
  if (byMade > 1e-6 && byHandled < byMade - 1e-6) {
    lines.push({ lost: SCORE_WEIGHTS.w * (1 - w), text: `${Math.round(byMade - byHandled)} of ${Math.round(byMade)} byproducts went nowhere. Give them a side trunk out of the box, or a module inside that uses them.` });
  }
  if (c < 1) {
    lines.push({ lost: SCORE_WEIGHTS.c * (1 - c), text: `${machineTiles} of ${boxTiles} tiles are modules; ${Math.ceil(boxTiles * compactFull(g))} would be fully compact. Draw the box tighter.` });
  }
  return {
    grade: { letter: gr.letter, score, u, w, c, mult: gr.mult },
    ins, outs, byMade, byHandled, machineTiles, boxTiles, busy,
    advice: lines.sort((p, q) => q.lost - p.lost).map((l) => l.text),
  };
}

/** Fold the audited group into a depth-2 module design. */
export function foldFAudited(g: Game, name: string | null): ActResult {
  const a = g.s.faudit;
  if (!a) return no('Nothing is being audited');
  if (!a.result) return no('The audit is still running');
  const res = a.result;
  const ents = fentsIn(g, a.box);
  let bill = 0, refund = 0;
  for (const e of ents) {
    if (e.kind === 'module') bill += g.design(e.design)?.bill ?? 0;
    else if (e.kind === 'trunk') refund += FACTORY.trunkCost;
  }
  const mult = res.grade.mult;
  const scale = (t: Partial<Record<ItemId, number>>) => {
    const o: Partial<Record<ItemId, number>> = {};
    for (const [k, v] of Object.entries(t) as [ItemId, number][]) o[k] = v * mult;
    return o;
  };
  const outs = scale(res.outs);
  const d: ModuleDesign = {
    id: g.s.nextDesign++,
    name: (name ?? '').trim().slice(0, 28) || defaultName(outs) + ' II',
    box: { ...a.box },
    parts: [],
    depth: 2,
    fparts: ents
      .filter((e) => e.kind === 'module' || e.kind === 'trunk')
      .map((e) => ({ kind: e.kind as 'module' | 'trunk', design: e.design, dx: e.x - a.box.x, dy: e.y - a.box.y, rot: e.rot })),
    ins: scale(res.ins),
    outs,
    grade: { ...res.grade },
    bill,
    stamped: 0,
    spare: 1,
  };
  g.s.designs.push(d);
  const ids = new Set(ents.map((e) => e.id));
  g.s.factory.ents = g.s.factory.ents.filter((e) => !ids.has(e.id));
  g.s.coin = g.s.coin.add(refund);
  g.factoryDirty = true;
  g.s.faudit = null;
  g.bump('folds');
  g.bump('nestedFolds');
  if (res.grade.letter === 'S') g.bump('foldS');
  g.bump('grade:' + res.grade.letter);
  g.emit({ type: 'fold', x: a.box.x + a.box.w / 2, y: a.box.y + a.box.h / 2, id: d.grade.letter, value: d.id, d: a.box.w * a.box.h, floor: 'factory' });
  if (g.first('firstNested')) g.emit({ type: 'firstNested', x: a.box.x + a.box.w / 2, y: a.box.y + a.box.h / 2, value: d.id, floor: 'factory' });
  return OK;
}
