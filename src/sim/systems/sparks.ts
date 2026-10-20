// Sparks (DESIGN.md §6): one every 3-6 minutes, visible for 20 s, paused while the tab is hidden.
// A Lucky Vein glitters on a patch with a working miner (click: that patch's miners run 3x for
// 60 s). An Inspector walks up to the busiest line (click: they grade it with §10's formula and
// hand over 60 s of its measured output x the grade multiplier, in kind, to research; paid in
// items, not coin, so it is not a bank-percentage windfall: DECISIONS.md). Missing one costs
// nothing.
import type { Game, ActResult } from '../Game';
import { Num } from '../../engine/num';
import { PATCHES } from '../../data/land';
import { RECIPE } from '../../data/recipes';
import type { ItemId } from '../../data/items';
import { creditResearch } from './research';
import { RULES } from '../../data/rules';
import { TICK_RATE } from '../../engine/time';
import { isMachine } from '../../data/machines';
import { rand, type Spark } from '../world';
import { lines, gradeLine, endsAtSink } from '../analysis';
import { shares } from './stats';

export function runSparks(g: Game) {
  const s = g.s;
  for (const k of Object.keys(s.veins)) {
    s.veins[k]--;
    if (s.veins[k] <= 0) delete s.veins[k];
  }
  if (!s.visible) return;
  for (const p of s.sparks) p.life--;
  const gone = s.sparks.filter((p) => p.life <= 0);
  if (gone.length) {
    s.sparks = s.sparks.filter((p) => p.life > 0);
    for (const p of gone) g.emit({ type: 'sparkMiss', x: p.x, y: p.y, id: p.kind });
  }
  if (s.nextSpark > 0) {
    s.nextSpark--;
    return;
  }
  s.nextSpark = g.sparkDelay();
  const spark = pickSpark(g);
  if (spark) {
    s.sparks.push(spark);
    g.emit({ type: 'spark', x: spark.x, y: spark.y, id: spark.kind });
  }
}

function pickSpark(g: Game): Spark | null {
  const life = RULES.sparkLife.value * TICK_RATE;
  const options: Spark[] = [];
  // a vein: a patch with a working miner on it
  const patches = new Set<number>();
  for (const m of g.miners) if (m.state === 'work') patches.add(g.patchOf[m.y * g.W + m.x]);
  if (patches.size) {
    const list = [...patches].sort((a, b) => a - b);
    const pi = list[Math.floor(rand(g.s) * list.length)];
    const p = PATCHES[pi];
    const x = p.x + Math.floor(rand(g.s) * p.w), y = p.y + Math.floor(rand(g.s) * p.h);
    options.push({ kind: 'vein', x, y, life });
  }
  // an inspector: beside the busiest line (most working machines), on a free owned tile
  let best: { n: number; ids: number[]; x: number; y: number } | null = null;
  for (const l of lines(g)) {
    const ms = l.filter((e) => isMachine(e.kind));
    const n = ms.filter((m) => m.state === 'work').length;
    if (n < 2 || (best && best.n >= n)) continue;
    const spot = freeBeside(g, ms);
    if (spot) best = { n, ids: l.map((e) => e.id), x: spot.x, y: spot.y };
  }
  if (best) options.push({ kind: 'inspector', x: best.x, y: best.y, life, line: best.ids });
  if (!options.length) return null;
  return options[Math.floor(rand(g.s) * options.length)];
}

function freeBeside(g: Game, ms: { x: number; y: number }[]): { x: number; y: number } | null {
  for (const m of ms)
    for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) {
      const x = m.x + dx, y = m.y + dy;
      if (g.inb(x, y) && g.owned(x, y) && !g.entAt(x, y) && !g.s.sparks.some((p) => p.x === x && p.y === y)) return { x, y };
    }
  return null;
}

export function catchSpark(g: Game, p: Spark): ActResult {
  g.s.sparks = g.s.sparks.filter((q) => q !== p);
  g.bump('sparks');
  if (p.kind === 'vein') {
    const pi = g.patchOf[p.y * g.W + p.x];
    g.s.veins[pi] = RULES.veinSeconds.value * TICK_RATE;
    g.emit({ type: 'sparkGet', x: p.x, y: p.y, id: 'vein' });
    return { ok: true };
  }
  const line = (p.line ?? []).map((id) => g.byId.get(id)).filter((e) => !!e) as NonNullable<ReturnType<typeof g.byId.get>>[];
  const gr = gradeLine(g, line);
  // 60 s of each final product the line makes, at its measured pace, x the grade
  const items: Partial<Record<ItemId, number>> = {};
  for (const m of gr.machines) {
    if (!endsAtSink(g, m)) continue;
    const r = m.recipe ? RECIPE[m.recipe] : null;
    if (!r) continue;
    const o = r.outputs[0];
    items[o.item] = (items[o.item] ?? 0) + (shares(m).work * o.n * RULES.inspectorSeconds.value * gr.mult) / r.time;
  }
  let total = 0;
  let main: ItemId | null = null;
  for (const [k, v] of Object.entries(items) as [ItemId, number][]) {
    const n = Math.max(1, Math.round(v));
    creditResearch(g, k, Num.of(n));
    if (!main || n > (items[main] ?? 0)) main = k;
    total += n;
  }
  if (gr.letter === 'S') g.bump('inspectS');
  g.emit({ type: 'sparkGet', x: p.x, y: p.y, id: 'inspector', value: total, d: gr.score });
  g.emit({ type: 'inspected', x: p.x, y: p.y, id: gr.letter, value: total, d: gr.score });
  if (main) g.emit({ type: 'inspectGift', x: p.x, y: p.y, id: main, value: total });
  return { ok: true };
}
