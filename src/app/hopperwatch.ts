// What the Hopper is doing with what arrives (the playability review: it banked ingots for a plate
// node while the bar sat at 0 and the frog said "munching away"). Presentation only: it samples the
// research state every few seconds of sim time and compares, so the frog and the research page can
// say plainly when the selected node is filling, and when deliveries are only being banked.
import type { Game } from '../sim/Game';
import { RESEARCH, type ResearchId } from '../data/research';
import type { ItemId } from '../data/items';
import { TICK_RATE } from '../engine/time';

/** sample every this many ticks; a reading looks back over the last two samples */
const EVERY = 3 * TICK_RATE;

interface Watch {
  tick: number;
  bank: Record<string, number>;
  prog: Record<string, number>;
  /** the item banked most recently while a node was selected that did not want it, and when */
  wrong: { item: ItemId; tick: number; node: ResearchId } | null;
  /** the tick the selected node's progress last rose */
  filled: number;
  node: ResearchId | null;
}

const watches = new WeakMap<Game, Watch>();

function read(g: Game): { bank: Record<string, number>; prog: Record<string, number> } {
  const r = g.s.research;
  const bank: Record<string, number> = {};
  for (const [k, v] of Object.entries(r.bank)) bank[k] = v?.toNumber() ?? 0;
  const prog: Record<string, number> = {};
  const sel = r.selected;
  if (sel) for (const [k, v] of Object.entries(r.progress[sel] ?? {})) prog[k] = v?.toNumber() ?? 0;
  return { bank, prog };
}

function watch(g: Game): Watch {
  let w = watches.get(g);
  const now = g.s.tick;
  if (!w) {
    w = { tick: now, ...read(g), wrong: null, filled: -Infinity, node: g.s.research.selected };
    watches.set(g, w);
    return w;
  }
  if (now - w.tick < EVERY && now >= w.tick) return w;
  const cur = read(g);
  const sel = g.s.research.selected;
  if (sel && sel === w.node) {
    const want = RESEARCH[sel].cost;
    // banked while this node was selected: an item it does not take (or has in full)
    let best: { item: ItemId; n: number } | null = null;
    for (const [k, v] of Object.entries(cur.bank)) {
      const n = v - (w.bank[k] ?? 0);
      if (n <= 0 || k === 'slag') continue;
      const full = (want[k as ItemId] ?? 0) > 0 && (cur.prog[k] ?? 0) >= (want[k as ItemId] ?? 0);
      if (!want[k as ItemId] || full) if (!best || n > best.n) best = { item: k as ItemId, n };
    }
    if (best) w.wrong = { item: best.item, tick: now, node: sel };
    for (const [k, v] of Object.entries(cur.prog)) if (v > (w.prog[k] ?? 0)) w.filled = now;
  } else w.filled = -Infinity;
  w.tick = now;
  w.bank = cur.bank;
  w.prog = cur.prog;
  w.node = sel;
  return w;
}

/** An item the Hopper banked in the last ~10 s that the selected node does not take (or has in
 * full): the frog and the research page name it. Null when nothing is going astray. */
export function hopperBanking(g: Game): { item: ItemId; node: ResearchId } | null {
  const w = watch(g);
  if (!w.wrong || w.wrong.node !== g.s.research.selected || g.s.tick - w.wrong.tick > 10 * TICK_RATE) return null;
  return { item: w.wrong.item, node: w.wrong.node };
}

/** Did the selected node's bar rise in the last ~10 s? */
export function hopperFilling(g: Game): boolean {
  const w = watch(g);
  return g.s.tick - w.filled <= 10 * TICK_RATE;
}
