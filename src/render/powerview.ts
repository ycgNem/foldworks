// Read-only views of the power grids for the renderer and the HUD (DESIGN.md §18 Power): which
// grid a building is on, whether a footprint is in a Pole's reach, the wires to draw between
// linked Poles, and plain-English status for the report card. Never writes the Game.
import type { Game } from '../sim/Game';
import type { Grid } from '../sim/systems/power';
import { poleReach } from '../sim/systems/power';
import { BUILD, isMachine, isPower, type EntKind } from '../data/machines';
import { RULES } from '../data/rules';
import type { Ent } from '../sim/world';

/** Does this kind take part in the power grid (a powered machine or a power building)? */
export function onGridKind(k: EntKind): boolean {
  return isPower(k) || (isMachine(k) && (BUILD[k].kw ?? 0) > 0);
}

/** A powered machine (it draws kW). */
export function powered(k: EntKind): boolean {
  return isMachine(k) && (BUILD[k].kw ?? 0) > 0;
}

/** Max-norm distance from a tile to the nearest tile of a footprint. */
export function cheb(a: { x: number; y: number; w: number; h: number }, x: number, y: number): number {
  const dx = x < a.x ? a.x - x : x >= a.x + a.w ? x - (a.x + a.w - 1) : 0;
  const dy = y < a.y ? a.y - y : y >= a.y + a.h ? y - (a.y + a.h - 1) : 0;
  return Math.max(dx, dy);
}

/** The index of the grid a building is on (poles included), or -1. */
export function gridIndex(g: Game, e: Ent): number {
  if (e.kind === 'pole') return g.grids.findIndex((gr) => gr.poles.includes(e));
  if (e.kind === 'boiler') {
    for (const [eid, b] of g.boilerOf) if (b === e) return g.gridOf.get(eid) ?? -1;
    return -1;
  }
  return g.gridOf.get(e.id) ?? -1;
}

export function gridOfEnt(g: Game, e: Ent): Grid | null {
  const i = gridIndex(g, e);
  return i >= 0 ? g.grids[i] : null;
}

/** Is any tile of this footprint within a Pole's reach? */
export function reached(g: Game, x: number, y: number, w: number, h: number): boolean {
  const r = poleReach(g);
  const f = { x, y, w, h };
  return g.power.some((p) => p.kind === 'pole' && cheb(f, p.x, p.y) <= r);
}

/** The Steam Engine a Boiler steams (the one at its front), if any. */
export function engineOf(g: Game, b: Ent): Ent | null {
  for (const [eid, bb] of g.boilerOf) if (bb === b) return g.byId.get(eid) ?? null;
  return null;
}

/** Pairs of Poles to draw a wire between: a spanning tree of each grid's links (Kruskal on
 *  distance), so a cluster of Poles reads as a few wires, not a web. */
export function wirePairs(g: Game): [Ent, Ent][] {
  const poles = g.power.filter((p) => p.kind === 'pole').sort((a, b) => a.id - b.id);
  const link = RULES.poleLink.value;
  const edges: { a: number; b: number; d: number }[] = [];
  for (let i = 0; i < poles.length; i++)
    for (let j = i + 1; j < poles.length; j++) {
      const dx = poles[i].x - poles[j].x, dy = poles[i].y - poles[j].y;
      if (Math.max(Math.abs(dx), Math.abs(dy)) <= link) edges.push({ a: i, b: j, d: dx * dx + dy * dy });
    }
  edges.sort((p, q) => p.d - q.d || p.a - q.a || p.b - q.b);
  const parent = poles.map((_, i) => i);
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  const out: [Ent, Ent][] = [];
  for (const e of edges) {
    const ra = find(e.a), rb = find(e.b);
    if (ra === rb) continue;
    parent[ra] = rb;
    out.push([poles[e.a], poles[e.b]]);
  }
  return out;
}

/** The fuel-holding burner of a producer (a Generator burns its own; an Engine its Boiler's). */
export function burnerOf(g: Game, p: Ent): Ent | null {
  return p.kind === 'generator' ? p : p.kind === 'steamEngine' ? g.boilerOf.get(p.id) ?? null : p.kind === 'boiler' ? p : null;
}

/** Fuel items waiting in a burner. */
export function fuelCount(b: Ent): number {
  let n = 0;
  for (const it of BUILD[b.kind].fuel?.items ?? []) n += b.inBuf[it] ?? 0;
  return n;
}

/** kW a producer can make now: its rating when its burner has fuel (0 without). */
export function producerKw(g: Game, p: Ent): number {
  const b = burnerOf(g, p);
  if (!b || (b.prog <= 0 && fuelCount(b) <= 0)) return 0;
  const bonus = p.kind === 'steamEngine' && g.s.orders.rep.voltaire >= 2 ? 1 + RULES.voltaireSteam.value : 1;
  return (BUILD[p.kind].power ?? 0) * bonus;
}

/** What a grid could supply right now (its fuelled producers), whether or not anything draws. */
export function capacity(g: Game, gr: Grid): number {
  let s = 0;
  for (const p of gr.producers) s += producerKw(g, p);
  return Math.max(s, gr.supply);
}

/** Totals over every grid, for the HUD's readout. */
export function powerTotals(g: Game): { supply: number; demand: number; sat: number; grids: number; worst: number } {
  let supply = 0, demand = 0, worst = 1;
  for (const gr of g.grids) {
    supply += capacity(g, gr);
    demand += gr.demand;
    if (gr.demand > 0) worst = Math.min(worst, gr.sat);
  }
  return { supply, demand, sat: demand > 0 ? Math.min(1, supply / demand) : 1, grids: g.grids.length, worst };
}

/** kW with thousands separators: "1,410 kW". */
export function kw(n: number): string {
  return `${Math.round(n).toLocaleString('en-US')} kW`;
}
