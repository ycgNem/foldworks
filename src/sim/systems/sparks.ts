// Sparks (DESIGN.md §6): one every 3-6 minutes, visible for 20 s, paused while the tab is hidden.
// A Spark is the Inspector (the playability pass cut the Lucky Vein, Cookie Clicker's golden cookie
// into Frenzy): they walk up to the busiest line (click: they grade it with §10's formula and hand
// over 60 s of its measured output x the grade multiplier, in kind, to research; paid in items, not
// coin, so it is not a bank-percentage windfall: DECISIONS.md). Missing one costs nothing.
import type { Game, ActResult } from '../Game';
import { Num } from '../../engine/num';
import { RECIPE } from '../../data/recipes';
import type { ItemId } from '../../data/items';
import { creditResearch } from './research';
import { RULES } from '../../data/rules';
import { TICK_RATE } from '../../engine/time';
import { isMachine } from '../../data/machines';
import type { Spark } from '../world';
import { lines, gradeLine, endsAtSink } from '../analysis';
import { shares } from './stats';
import { trules } from '../longtail';

export function runSparks(g: Game) {
  const s = g.s;
  if (!s.visible) return;
  for (const p of s.sparks) p.life--;
  const gone = s.sparks.filter((p) => p.life <= 0);
  if (gone.length) {
    s.sparks = s.sparks.filter((p) => p.life > 0);
    for (const p of gone) g.emit({ type: 'sparkMiss', x: p.x, y: p.y });
  }
  if (s.nextSpark > 0) {
    s.nextSpark--;
    return;
  }
  s.nextSpark = g.sparkDelay();
  const spark = pickSpark(g);
  if (spark) {
    s.sparks.push(spark);
    g.emit({ type: 'spark', x: spark.x, y: spark.y });
  }
}

/** The Inspector: beside the busiest line (most working machines, two at least), on a free owned
 * tile; none while no line has two machines at work (the timer runs on). */
function pickSpark(g: Game): Spark | null {
  // the Trophy Shelf's Inspector trophies keep them a few seconds longer (DESIGN.md §24)
  const life = (RULES.sparkLife.value + trules(g).sparkLife) * TICK_RATE;
  let best: { n: number; ids: number[]; x: number; y: number } | null = null;
  for (const l of lines(g)) {
    const ms = l.filter((e) => isMachine(e.kind));
    const n = ms.filter((m) => m.state === 'work').length;
    if (n < 2 || (best && best.n >= n)) continue;
    const spot = freeBeside(g, ms);
    if (spot) best = { n, ids: l.map((e) => e.id), x: spot.x, y: spot.y };
  }
  return best ? { x: best.x, y: best.y, life, line: best.ids } : null;
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
  const line = p.line.map((id) => g.byId.get(id)).filter((e) => !!e) as NonNullable<ReturnType<typeof g.byId.get>>[];
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
  g.emit({ type: 'sparkGet', x: p.x, y: p.y, value: total, d: gr.score });
  g.emit({ type: 'inspected', x: p.x, y: p.y, id: gr.letter, value: total, d: gr.score });
  if (main) g.emit({ type: 'inspectGift', x: p.x, y: p.y, id: main, value: total });
  return { ok: true };
}
