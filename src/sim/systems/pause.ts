// Stopping a line on purpose (DESIGN.md §20, "safe for overnight"), and the Night Shift upgrades.
// A paused machine or Miner takes nothing, makes nothing and draws no power; it holds what is in
// its buffers, and splitters route its share to their other sides as they do around any full
// machine. A paused module runs at 0 and takes nothing, so the trunks into it back up. Unlike a
// jam, a pause leaves a Slag Heap's room for when you are back, and it is the player's choice,
// logged like every command (so a replay of the save stops the same line at the same tick).
import type { Game, ActResult } from '../Game';
import { OK, no } from '../Game';
import { isMachine } from '../../data/machines';
import { RESEARCH } from '../../data/research';
import { IDLE_UPGRADE, type IdleUpgradeId } from '../../data/idle';
import { Num } from '../../engine/num';
import { lineOf } from '../analysis';
import { auditLock } from './audits';
import { fauditLock } from './nested';
import type { Ent, FEnt } from '../world';

export interface PauseCmd {
  k: 'pause';
  x: number;
  y: number;
  floor?: 'factory';
  /** the whole line (Workshop) or every module joined to it by trunks (Factory) */
  line?: boolean;
  /** true stops, false restarts */
  on: boolean;
}

/** The machines a pause command reaches on the Workshop. */
export function pauseTargets(g: Game, e: Ent, line: boolean): Ent[] {
  if (!line) return isMachine(e.kind) ? [e] : [];
  return lineOf(g, e).filter((q) => isMachine(q.kind));
}

/** The modules a pause command reaches on the Factory floor: the module, or its trunk-joined group. */
export function fpauseTargets(g: Game, m: FEnt, line: boolean): FEnt[] {
  if (!line) return [m];
  const seen = new Set<number>([m.id]);
  const todo = [m];
  while (todo.length) {
    const cur = todo.pop()!;
    for (const r of g.routes) {
      const other = r.from === cur ? r.to : r.to === cur ? r.from : null;
      if (other && other.kind === 'module' && !seen.has(other.id)) { seen.add(other.id); todo.push(other); }
    }
  }
  return [...seen].map((id) => g.fById.get(id)!).filter((q) => !!q);
}

export function setPause(g: Game, c: PauseCmd): ActResult {
  if (c.floor === 'factory') {
    const m = g.fentAt(c.x, c.y);
    if (!m || m.kind !== 'module') return no('Only a module can be stopped here');
    const ts = fpauseTargets(g, m, !!c.line);
    for (const t of ts) {
      const lock = fauditLock(g, t.x, t.y);
      if (lock) return no(lock);
    }
    for (const t of ts) {
      if (c.on) t.paused = true;
      else delete t.paused;
    }
    g.emit({ type: c.on ? 'pause' : 'resume', x: m.x, y: m.y, value: ts.length, floor: 'factory' });
    return OK;
  }
  const e = g.entAt(c.x, c.y);
  // a whole line can be named by any machine in it, or by the Slag Heap it fills
  if (!e || !(isMachine(e.kind) || (c.line && e.kind === 'heap'))) return no('Only a machine or a Miner can be stopped');
  const ts = pauseTargets(g, e, !!c.line);
  if (!ts.length) return no('Nothing there to stop');
  for (const t of ts) {
    const lock = auditLock(g, t.x, t.y);
    if (lock) return no(lock);
  }
  for (const t of ts) {
    if (c.on) t.paused = true;
    else delete t.paused;
  }
  g.emit({ type: c.on ? 'pause' : 'resume', x: e.x, y: e.y, value: ts.length });
  return OK;
}

/** Everything stopped right now, both floors. */
export function pausedCount(g: Game): number {
  let n = 0;
  for (const e of g.s.ents) if (e.paused) n++;
  for (const m of g.s.factory.ents) if (m.paused) n++;
  return n;
}

/** Why a Night Shift upgrade can't be bought now, or null. */
export function idleUpgradeRefusal(g: Game, id: IdleUpgradeId): string | null {
  const u = IDLE_UPGRADE[id];
  if (!u) return 'no such upgrade';
  if (g.has(id)) return 'already bought';
  if (!g.done(u.requires)) return `Needs research: ${RESEARCH[u.requires].name}`;
  if (g.s.coin.lt(u.cost)) return `Needs ${Num.of(u.cost).format()} coin`;
  return null;
}

export function buyIdleUpgrade(g: Game, id: IdleUpgradeId): ActResult {
  const why = idleUpgradeRefusal(g, id);
  if (why) return no(why);
  const u = IDLE_UPGRADE[id];
  g.s.coin = g.s.coin.sub(u.cost);
  g.s.upgrades.push(id);
  g.emit({ type: 'idleUpgrade', id });
  return OK;
}
