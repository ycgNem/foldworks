// Power (DESIGN.md §18): Poles join everything within their reach into grids; Steam Engines (fed
// steam by the Boiler facing them) and Generators make kW from fuel; powered machines draw kW
// while they craft. When a grid's demand passes its supply every machine on it runs at
// supply / demand of its speed: a brownout is proportional, never random. Fuel burns in
// proportion to the load. Runs at the start of the machines stage (CLAUDE.md system order).
import type { Game } from '../Game';
import { BUILD, isMachine, isPower } from '../../data/machines';
import { RULES } from '../../data/rules';
import { TICK_RATE } from '../../engine/time';
import { DX, DY, type Ent } from '../world';
import { note } from './stats';
import { powerMult } from './challenges';

export interface Grid {
  poles: Ent[];
  producers: Ent[];
  consumers: Ent[];
  /** kW this tick: what could be made (fuelled producers), and what is wanted */
  supply: number;
  demand: number;
  /** supply / demand, capped at 1 (1 when nothing is wanted) */
  sat: number;
}

/** kW a machine draws while crafting, after its mode (0 for unpowered machines). */
export function drawKw(e: Ent, g?: Game): number {
  const kw = BUILD[e.kind].kw ?? 0;
  if (!kw) return 0;
  const m = e.mode ?? 'normal';
  // Dame Voltaire's rep 4 (DESIGN.md §21): Act III's chemistry and greenhouses at half the draw
  const volt = g && g.s.orders.rep.voltaire >= 4 && (e.kind === 'chemVat' || e.kind === 'greenhouse') ? RULES.voltaireChemPower.value : 1;
  return kw * volt * (m === 'efficient' ? RULES.modeEfficientPower.value : m === 'overclock' ? RULES.modeOverclockPower.value : 1);
}

/** How far a Pole reaches (Dame Voltaire's rep 3 adds a tile). */
export const poleReach = (g: Game) => RULES.poleReach.value + (g.s.orders.rep.voltaire >= 3 ? 1 : 0);
const cheb = (a: { x: number; y: number; w: number; h: number }, x: number, y: number) => {
  // distance from a tile to the nearest tile of a footprint, in the max norm
  const dx = x < a.x ? a.x - x : x >= a.x + a.w ? x - (a.x + a.w - 1) : 0;
  const dy = y < a.y ? a.y - y : y >= a.y + a.h ? y - (a.y + a.h - 1) : 0;
  return Math.max(dx, dy);
};

/** Rebuild the grids from the layout (Game.rebuild calls it). Deterministic: id order throughout. */
export function buildGrids(g: Game) {
  const poles = g.s.ents.filter((e) => e.kind === 'pole').sort((a, b) => a.id - b.id);
  const link = RULES.poleLink.value;
  const r = poleReach(g);
  // poles within link distance of each other share a grid (union-find)
  const parent = poles.map((_, i) => i);
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  for (let i = 0; i < poles.length; i++)
    for (let j = i + 1; j < poles.length; j++)
      if (Math.max(Math.abs(poles[i].x - poles[j].x), Math.abs(poles[i].y - poles[j].y)) <= link) parent[find(j)] = find(i);
  const byRoot = new Map<number, Grid>();
  const grids: Grid[] = [];
  poles.forEach((p, i) => {
    const root = find(i);
    let gr = byRoot.get(root);
    if (!gr) {
      gr = { poles: [], producers: [], consumers: [], supply: 0, demand: 0, sat: 1 };
      byRoot.set(root, gr);
      grids.push(gr);
    }
    gr.poles.push(p);
  });
  g.gridOf.clear();
  for (const e of [...g.s.ents].sort((a, b) => a.id - b.id)) {
    const consumer = isMachine(e.kind) && (BUILD[e.kind].kw ?? 0) > 0;
    const producer = e.kind === 'steamEngine' || e.kind === 'generator';
    if (!consumer && !producer) continue;
    // the first pole (by id) that reaches any tile of it
    const pi = poles.findIndex((p) => cheb(e, p.x, p.y) <= r);
    if (pi < 0) continue;
    const gr = byRoot.get(find(pi))!;
    (consumer ? gr.consumers : gr.producers).push(e);
    g.gridOf.set(e.id, grids.indexOf(gr));
  }
  g.grids = grids;
  // each Steam Engine's boiler: the Boiler whose front faces it
  g.boilerOf.clear();
  for (const b of g.s.ents) {
    if (b.kind !== 'boiler') continue;
    const t = g.entAt(b.x + DX[b.rot], b.y + DY[b.rot]);
    if (t && t.kind === 'steamEngine' && !g.boilerOf.has(t.id)) g.boilerOf.set(t.id, b);
  }
}

/** Fuel seconds per item for a producer (oil burns twice as long with Dame Voltaire's rep 1). */
function fuelTicks(g: Game, fuelHolder: Ent, item: string): number {
  const f = BUILD[fuelHolder.kind].fuel!;
  const oilBonus = item === 'oil' && g.s.orders.rep.voltaire >= 1 ? 2 : 1;
  return f.seconds * TICK_RATE * oilBonus;
}

/** Take the next fuel item into the burner if it is out; true if it has heat now. */
function stoke(g: Game, burner: Ent): boolean {
  if (burner.prog > 0) return true;
  const f = BUILD[burner.kind].fuel;
  if (!f) return false;
  for (const it of f.items) {
    if ((burner.inBuf[it] ?? 0) > 0) {
      burner.inBuf[it]--;
      burner.prog += fuelTicks(g, burner, it);
      burner.crafts++;
      return true;
    }
  }
  return false;
}

/** kW a producer can make this tick (0 without fuel). */
function output(g: Game, p: Ent): number {
  // Lean Power (a Challenge, DESIGN.md §21): half while it is taken, a tenth more once won
  const base = (BUILD[p.kind].power ?? 0) * powerMult(g);
  if (p.kind === 'generator') return stoke(g, p) ? base : 0;
  // a Steam Engine needs its Boiler burning
  const b = g.boilerOf.get(p.id);
  if (!b) return 0;
  const bonus = g.s.orders.rep.voltaire >= 2 ? 1 + RULES.voltaireSteam.value : 1;
  return stoke(g, b) ? base * bonus : 0;
}

export function runPower(g: Game) {
  for (const gr of g.grids) {
    // what is wanted: machines mid-craft, or ready to start and waiting on power
    let demand = 0;
    for (const c of gr.consumers) if (!c.paused && (c.active || c.why === 'power')) demand += drawKw(c, g);
    let supply = 0;
    const live: Ent[] = [];
    if (demand > 0) {
      for (const p of gr.producers) {
        const kw = output(g, p);
        if (kw > 0) { supply += kw; live.push(p); }
      }
    }
    gr.demand = demand;
    gr.supply = supply;
    gr.sat = demand <= 0 ? 1 : Math.min(1, supply / demand);
    if (supply > 0 && demand > 0 && g.first('powerOn')) {
      g.bump('gridsLit');
      g.emit({ type: 'powerOn', x: gr.poles[0].x, y: gr.poles[0].y });
    }
    // burn fuel in proportion to the load
    const load = supply > 0 ? Math.min(1, demand / supply) : 0;
    for (const p of gr.producers) {
      const burner = p.kind === 'generator' ? p : g.boilerOf.get(p.id);
      const on = live.includes(p);
      if (burner && on) burner.prog = Math.max(0, burner.prog - load);
      // the bills term counts a producer by its own burn share (§19): an unfuelled or idle one
      // counts nothing, a plant four times the load a quarter each
      if (on) {
        p.wkAcc = (p.wkAcc ?? 0) + load;
        if (burner && burner !== p) burner.wkAcc = (burner.wkAcc ?? 0) + load;
      }
      p.state = on ? 'work' : demand > 0 ? 'starved' : 'idle';
      p.why = on || demand <= 0 ? null : 'coal';
      if (burner && burner !== p) {
        burner.state = p.state;
        burner.why = p.why;
      }
    }
  }
  // producers with no grid (no pole in reach) and boilers with no engine idle with a reason
  for (const e of g.s.ents) {
    if (!isPower(e.kind) || e.kind === 'pole') continue;
    if (e.kind === 'boiler') {
      const eng = g.entAt(e.x + DX[e.rot], e.y + DY[e.rot]);
      if (!eng || eng.kind !== 'steamEngine') { e.state = 'idle'; e.why = 'engine'; }
      else if (!g.gridOf.has(eng.id)) { e.state = 'idle'; e.why = 'pole'; }
    } else if (!g.gridOf.has(e.id)) { e.state = 'idle'; e.why = 'pole'; }
  }
  // the pips and hover reports read the last minute's states, like a machine's
  for (const e of g.power) if (e.kind !== 'pole') note(e);
}

/** The speed factor power allows a machine this tick: 1 for unpowered kinds, its grid's
 *  satisfaction for powered ones, 0 when it is on no grid. */
export function powerFactor(g: Game, m: Ent): number {
  if (!(BUILD[m.kind].kw ?? 0)) return 1;
  const gi = g.gridOf.get(m.id);
  if (gi === undefined) return 0;
  return g.grids[gi].sat;
}
