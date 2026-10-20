// Crafting machines (DESIGN.md §4): smelters, presses, assemblers and the Hand Furnace. Each tick a
// machine advances its craft, finishes it into its output buffer (and its byproduct buffer every
// N crafts), starts the next one if its inputs are there and there is room for what it will
// make, and hands its output out of its front and its byproduct out of a side. A full output is
// blocked, an empty input is starved; the hover report reads `state` and `why`.
// Act II (DESIGN.md §18): a machine's speed is its kind's (Mk2: 3x) times its mode, Overdrive and
// the power its grid can give; a powered machine with none is starved with why = 'power'.
import type { Game, ActResult } from '../Game';
import { DX, DY, ccw, cw, faceTiles, opposite, type Dir, type Ent } from '../world';
import { RECIPE, type RecipeDef } from '../../data/recipes';
import { BUILD } from '../../data/machines';
import { RULES } from '../../data/rules';
import { TICK_RATE } from '../../engine/time';
import { offer, accepts } from '../transfer';
import { powerFactor } from './power';
import { note } from './stats';

const OK: ActResult = { ok: true };

/** The speed a mode gives (1 in normal mode). */
export function modeSpeed(m: Ent): number {
  switch (m.mode ?? 'normal') {
    case 'efficient': return RULES.modeEfficientSpeed.value;
    case 'overclock': return RULES.modeOverclockSpeed.value;
    case 'precision': return RULES.modePrecisionSpeed.value;
    default: return 1;
  }
}

/** Crafting speed this tick, before power: kind x mode x Overdrive. */
export function baseSpeed(m: Ent): number {
  return (BUILD[m.kind].speed ?? 1) * modeSpeed(m) * ((m.od ?? 0) > 0 ? RULES.overdriveMult.value : 1);
}

/** Count down Overdrive, then its cooling (both systems that run machines call it). */
export function overdriveTick(m: Ent) {
  if (m.od) {
    m.od--;
    if (!m.od) m.cool = Math.round(RULES.overdriveCool.value * TICK_RATE);
  } else if (m.cool) m.cool--;
}

export function runMachines(g: Game) {
  const cap = RULES.outputCap.value;
  const bellows = g.has('bellows');
  for (const m of g.machines) {
    const r = m.recipe ? RECIPE[m.recipe] : null;
    const wasBy = m.state === 'blocked' && m.why !== null && m.why === m.byItem;
    let progressed = false;
    let carry = 0;
    let unpowered = false;
    if (r && m.active) {
      const hand = m.kind === 'furnace' && !bellows;
      if (!hand) {
        const pf = powerFactor(g, m);
        const sp = baseSpeed(m) * pf;
        if (sp > 0) {
          m.prog += sp;
          progressed = true;
        } else unpowered = pf <= 0;
      }
      const need = r.time * TICK_RATE;
      if (m.prog >= need - 1e-9) {
        carry = Math.max(0, m.prog - need);
        finish(g, m, r);
      }
    }
    if (r && !m.active) {
      start(m, r, cap);
      if (m.active && carry > 1e-9) m.prog = carry;
    }
    // state
    if (!r) {
      m.state = 'starved';
      m.why = null;
    } else if (m.active) {
      if (m.kind === 'furnace' && !bellows) {
        m.state = progressed ? 'work' : 'starved';
        m.why = progressed ? null : 'crank';
      } else if (unpowered && !progressed) {
        m.state = 'starved';
        m.why = 'power';
      } else {
        m.state = 'work';
        m.why = null;
      }
    } else {
      const missing = r.inputs.find((s) => (m.inBuf[s.item] ?? 0) < s.n);
      const byDue = r.byproduct && (m.crafts + 1) % r.byproduct.every === 0;
      if (byDue && m.by >= cap) {
        m.state = 'blocked';
        m.why = r.byproduct!.item;
      } else if (m.out > 0 && (m.out + r.outputs[0].n > cap || m.outItem !== r.outputs[0].item)) {
        m.state = 'blocked';
        m.why = m.outItem;
      } else if (missing) {
        m.state = 'starved';
        m.why = missing.item;
      } else {
        m.state = 'idle';
        m.why = null;
      }
      if (progressed) m.state = 'work';
    }
    // hand on: the main output out of the front, a byproduct out of a side
    if (m.out > 0 && m.outItem && handOut(g, m, m.outItem)) {
      m.out--;
      if (!m.out) m.outItem = r?.outputs[0].item ?? null;
    }
    if (m.by > 0 && m.byItem && pushByproduct(g, m)) m.by--;
    if (m.state === 'blocked' && m.why && m.why === m.byItem && !wasBy) {
      g.bump('slagJams');
      g.emit({ type: 'jam', x: m.x, y: m.y, id: m.why, value: m.id });
      if (g.first('jam:slag')) g.emit({ type: 'firstSlagJam', x: m.x, y: m.y, id: String(m.id) });
    }
    overdriveTick(m);
    note(m);
  }
}

/** Offer the main output out of the front (a 2x2 tries its two front tiles in turn). */
function handOut(g: Game, m: Ent, item: string): boolean {
  if (m.w === 1 && m.h === 1) return offer(g, m.x + DX[m.rot], m.y + DY[m.rot], m.rot, item);
  const ts = faceTiles(m, m.rot);
  for (let k = 0; k < ts.length; k++) {
    const [x, y] = ts[(m.crafts + m.out + k) % ts.length];
    if (offer(g, x, y, m.rot, item)) return true;
  }
  return false;
}

function start(m: Ent, r: RecipeDef, cap: number) {
  for (const s of r.inputs) if ((m.inBuf[s.item] ?? 0) < s.n) return;
  const o = r.outputs[0];
  if (m.out > 0 && (m.outItem !== o.item || m.out + o.n > cap)) return;
  const byDue = r.byproduct && (m.crafts + 1) % r.byproduct.every === 0;
  if (byDue && m.by >= cap) return;
  for (const s of r.inputs) m.inBuf[s.item] -= s.n;
  m.active = true;
  m.prog = 0;
}

function finish(g: Game, m: Ent, r: RecipeDef) {
  const o = r.outputs[0];
  m.out += o.n;
  m.outItem = o.item;
  // Precision: +25% of the main output (Unit 7's rep 3: +35%), whole items as the fraction fills
  if (m.mode === 'precision') {
    const y = RULES.modePrecisionYield.value + (g.s.orders.rep.unit7 >= 3 ? RULES.unit7Precision.value : 0);
    m.bonus = (m.bonus ?? 0) + y * o.n;
    if (m.bonus >= 1 - 1e-9) {
      const extra = Math.floor(m.bonus + 1e-9);
      m.out += extra;
      m.bonus -= extra;
    }
  }
  m.crafts++;
  if (r.byproduct && m.crafts % r.byproduct.every === 0) {
    m.by++;
    m.byItem = r.byproduct.item;
  }
  m.active = false;
  m.prog = 0;
  g.emit({ type: 'craft', x: m.x, y: m.y, id: o.item, value: m.id });
}

/** Byproducts leave by a side (left, back, right in turn) into something that takes them: a Slag
 * Heap, a machine that uses them, or a belt leading away (never a belt just passing by). */
function pushByproduct(g: Game, m: Ent): boolean {
  const sides: Dir[] = [ccw(m.rot), opposite(m.rot), cw(m.rot)];
  for (let k = 0; k < 3; k++) {
    const i = (m.rr + k) % 3;
    const d = sides[i];
    const tiles: [number, number][] = m.w === 1 && m.h === 1 ? [[m.x + DX[d], m.y + DY[d]]] : faceTiles(m, d);
    for (const [x, y] of tiles) {
      const t = g.entAt(x, y);
      if (!t) continue;
      if (t.kind === 'belt' && t.rot !== d) continue;
      if (!accepts(g, t, m.byItem!, d)) continue;
      if (offer(g, x, y, d, m.byItem!)) {
        m.rr = (i + 1) % 3;
        return true;
      }
    }
  }
  return false;
}

/** Overdrive (DESIGN.md §18): a click runs a machine 3x for 10 s, then it cools for 30 s. */
export function overdrive(g: Game, m: Ent): ActResult {
  if ((m.od ?? 0) > 0) return { ok: false, why: 'Overdriven already' };
  if ((m.cool ?? 0) > 0) return { ok: false, why: `Cooling down: ${Math.ceil((m.cool ?? 0) / TICK_RATE)} s` };
  m.od = Math.round(RULES.overdriveSeconds.value * TICK_RATE);
  g.bump('overdrives');
  g.emit({ type: 'overdrive', x: m.x + (m.w - 1) / 2, y: m.y + (m.h - 1) / 2, value: m.id });
  return OK;
}

/** Crank the Hand Furnace (DESIGN.md §6): 0.25 s of progress per click, once it has ore. */
export function crankFurnace(g: Game, f: Ent): ActResult {
  const r = RECIPE[f.recipe ?? 'smeltIron'];
  if (!f.active) start(f, r, RULES.outputCap.value);
  if (!f.active) {
    g.emit({ type: 'crankEmpty', x: f.x, y: f.y });
    return { ok: false, why: (f.inBuf.ironOre ?? 0) > 0 ? 'The furnace is full: clear its output' : 'The furnace needs ore: click the ore patch' };
  }
  f.prog += RULES.crankSeconds.value * TICK_RATE;
  g.bump('cranks');
  const need = r.time * TICK_RATE;
  g.emit({ type: 'crank', x: f.x, y: f.y, value: Math.min(1, f.prog / need) });
  if (f.prog >= need - 1e-9) finish(g, f, r);
  return OK;
}

/** Shovel one byproduct out of a machine blocked by it (a chore the Slag Heap automates). */
export function shovel(g: Game, m: Ent): ActResult {
  if (m.by <= 0) return { ok: false, why: 'nothing to shovel' };
  m.by--;
  g.bump('shovels');
  g.emit({ type: 'shovel', x: m.x, y: m.y, id: m.byItem ?? 'slag' });
  return OK;
}
