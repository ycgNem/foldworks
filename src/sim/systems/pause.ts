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
import { IDLE, IDLE_UPGRADE, type IdleUpgradeId } from '../../data/idle';
import { offlineCeiling, offlineEfficiency, offlineEfficiencyUncapped } from '../offline';
import { Num } from '../../engine/num';
import { lineOf } from '../analysis';
import { auditLock } from './audits';
import { fauditLock } from './nested';
import type { Ent, FEnt } from '../world';
import type { HighFloorId } from '../../data/floors';
import { hauditLock, hent, hentAt, highModules } from './high';

export interface PauseCmd {
  k: 'pause';
  x: number;
  y: number;
  floor?: 'factory' | HighFloorId;
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

/** The modules a pause command reaches on a high floor: the module, or every module joined to it
 * by skiff routes (DESIGN.md §22: the high floors pause as the Factory does). */
export function hpauseTargets(g: Game, id: HighFloorId, m: FEnt, line: boolean): FEnt[] {
  if (!line) return [m];
  const st = g.s[id];
  const seen = new Set<number>([m.id]);
  const todo = [m.id];
  while (todo.length) {
    const cur = todo.pop()!;
    for (const r of st?.routes ?? []) {
      const other = r.from === cur ? r.to : r.to === cur ? r.from : null;
      if (other === null || seen.has(other)) continue;
      if (hent(g, id, other)?.kind === 'module') { seen.add(other); todo.push(other); }
    }
  }
  return [...seen].map((eid) => hent(g, id, eid)).filter((q): q is FEnt => !!q);
}

export function setPause(g: Game, c: PauseCmd): ActResult {
  const r = pauseNow(g, c);
  // a stop counted for the shelf (the hidden Tea Break, DESIGN.md §24)
  if (r.ok && c.on) g.bump('pauses');
  return r;
}

function pauseNow(g: Game, c: PauseCmd): ActResult {
  if (c.floor === 'district' || c.floor === 'world') {
    const id = c.floor;
    const m = hentAt(g, id, c.x, c.y);
    if (!m || m.kind !== 'module') return no('Only a module can be stopped here');
    const ts = hpauseTargets(g, id, m, !!c.line);
    for (const t of ts) {
      const lock = hauditLock(g, id, t.x, t.y);
      if (lock) return no(lock);
    }
    for (const t of ts) {
      if (c.on) t.paused = true;
      else delete t.paused;
    }
    g.emit({ type: c.on ? 'pause' : 'resume', x: m.x, y: m.y, value: ts.length, floor: id });
    return OK;
  }
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
  for (const m of highModules(g)) if (m.paused) n++;
  return n;
}

/** What a Night Shift upgrade would add to the offline efficiency now: its points, less what the
 * 0.75 ceiling cuts off (the Patent tree's offline nodes and the Night Shift overlap, §20). */
export function idleUpgradeGain(g: Game, id: IdleUpgradeId): number {
  const u = IDLE_UPGRADE[id];
  if (!u || g.has(id)) return 0;
  const now = offlineEfficiency(g);
  return Math.max(0, Math.round((Math.min(offlineCeiling(g), offlineEfficiencyUncapped(g) + u.eff) - now) * 1e6) / 1e6);
}

/** Why a Night Shift upgrade can't be bought now, or null. One that would add nothing (the
 * efficiency is at its ceiling already) is refused, saying why, so no coin buys nothing. */
export function idleUpgradeRefusal(g: Game, id: IdleUpgradeId): string | null {
  const u = IDLE_UPGRADE[id];
  if (!u) return 'no such upgrade';
  if (g.has(id)) return 'already bought';
  if (!g.done(u.requires)) return `Needs research: ${RESEARCH[u.requires].name}`;
  if (idleUpgradeGain(g, id) <= 0) return `Offline efficiency is at its ${Math.round(offlineCeiling(g) * 100)}% ceiling already (your Patents): this would add nothing`;
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
