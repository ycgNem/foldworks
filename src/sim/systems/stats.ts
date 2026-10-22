// Statistics (the last system of the tick): each machine's state per second over the last minute
// (the hover report's "starved of iron ore 41% of the last minute", the Inspector's U), and coin
// earned per second over the last minute (the HUD's coin/min and offline extrapolation).
import type { Game } from '../Game';
import type { Ent } from '../world';
import { RULES } from '../../data/rules';
import { TICK_RATE } from '../../engine/time';
import { TROPHIES, type TrophyDef } from '../../data/trophies';
import { isMachine } from '../../data/machines';

/** Count this tick's state for a machine (called by the systems that run it). */
export function note(m: Ent) {
  if (m.state === 'work') m.sec[0]++;
  else if (m.state === 'starved') m.sec[1]++;
  else if (m.state === 'blocked') m.sec[m.why !== null && m.why === m.byItem ? 3 : 2]++;
}

/** The dominant state of a second: 'w' working, 's' starved, 'b' blocked on output, 'x' blocked
 * on its byproduct, 'i' idle. */
function dominant(m: Ent): string {
  const [w, s, b, x] = m.sec;
  if (w === 0 && s === 0 && b === 0 && x === 0) return 'i';
  if (w >= s && w >= b && w >= x) return 'w';
  if (s >= b && s >= x) return 's';
  return x > b ? 'x' : 'b';
}

export function runStats(g: Game) {
  if ((g.s.tick + 1) % TICK_RATE !== 0) return;
  const win = RULES.statWindow.value;
  for (const list of [g.miners, g.machines, g.power, g.heaters, g.seeds]) {
    for (const m of list) {
      m.hist = (m.hist + dominant(m)).slice(-win);
      m.sec[0] = m.sec[1] = m.sec[2] = m.sec[3] = 0;
    }
  }
  // the bills term's window (§19): each building's measured work, minute by minute
  if ((g.s.tick + 1) % (60 * TICK_RATE) === 0) {
    const n = RULES.billsWindow.value;
    for (const list of [g.miners, g.machines, g.power, g.heaters]) for (const m of list) rollWork(m, n);
    for (const m of g.s.factory.ents) if (m.kind === 'module') rollWork(m, n);
  }
  checkTrophies(g);
  g.s.income.push(g.s.incomeSec);
  if (g.s.income.length > win) g.s.income.shift();
  g.s.incomeSec = 0;
  // the run's best 5-minute coin per minute (the Reorganize card and §16 rule 3), once a minute
  if ((g.s.tick + 1) % (60 * TICK_RATE) === 0) {
    const m = g.s.meta;
    m.perMinRing.push(g.incomePerMin());
    if (m.perMinRing.length > 5) m.perMinRing.shift();
    const avg = m.perMinRing.reduce((a, b) => a + b, 0) / m.perMinRing.length;
    if (m.perMinRing.length >= 5 && avg > m.peakPerMin) m.peakPerMin = avg;
  }
}

/** Close a minute of measured work (seconds, to two places) into the last `n` minutes. */
function rollWork(m: { wkAcc?: number; wk?: number[]; hist: string; state: string }, n: number) {
  // a building from a save made before the record: its last minute's pips stand in for the
  // minutes before this one (only such a building has no record; a new one starts empty)
  if (!m.wk) { const v = Math.round(shares(m as Ent).work * 6000) / 100; m.wk = Array.from({ length: n - 1 }, () => v); }
  const w = m.wk;
  w.push(Math.round(((m.wkAcc ?? 0) / TICK_RATE) * 100) / 100);
  while (w.length > n) w.shift();
  m.wkAcc = 0;
}

/** A building's measured work share over the bills term's window (0..1): what it did in each of
 * the last RULES.billsWindow whole minutes, a minute it did not stand counted as none. Saves from
 * before the final round have no record (`wk` absent): their last minute's pip history stands in. */
export function workShare(m: { wk?: number[]; hist: string }): number {
  if (!m.wk) return shares(m as Ent).work;
  const n = RULES.billsWindow.value;
  let s = 0;
  for (const v of m.wk) s += v;
  return Math.min(1, s / (60 * n));
}

/** Fraction of the recorded window a machine spent in each state. */
export function shares(m: Ent): { work: number; starved: number; blocked: number; byBlocked: number; n: number } {
  const n = m.hist.length;
  if (!n) return { work: m.state === 'work' ? 1 : 0, starved: m.state === 'starved' ? 1 : 0, blocked: m.state === 'blocked' ? 1 : 0, byBlocked: 0, n: 0 };
  let w = 0, s = 0, b = 0, x = 0;
  for (const c of m.hist) {
    if (c === 'w') w++;
    else if (c === 's') s++;
    else if (c === 'b') b++;
    else if (c === 'x') x++;
  }
  return { work: w / n, starved: s / n, blocked: (b + x) / n, byBlocked: x / n, n };
}

/** How far a trophy's stat has got (a plain number: counts and lifetime coin for display). */
export function trophyValue(g: Game, t: TrophyDef): number {
  const s = g.s;
  switch (t.stat.k) {
    case 'earned': return s.earned.toNumber();
    case 'delivered': return s.delivered[t.stat.item]?.toNumber() ?? 0;
    case 'counter': return s.counters[t.stat.name] ?? 0;
    case 'built': { const k = t.stat.kind; return s.ents.filter((e) => e.kind === k).length; }
    case 'machines': return s.ents.filter((e) => isMachine(e.kind) && e.kind !== 'furnace').length;
    case 'research': return s.research.done.length;
    case 'orders': return s.orders.done.length;
    case 'rep': return s.orders.rep.bramble;
    case 'land': return s.land.length;
    case 'upgrades': return s.upgrades.length;
  }
}

/** Award trophies whose stat has reached its mark (once a second). */
export function checkTrophies(g: Game) {
  for (const t of TROPHIES) {
    const f = 'trophy:' + t.id;
    if (g.s.flags.includes(f)) continue;
    if (trophyValue(g, t) >= t.n) {
      g.s.flags.push(f);
      g.emit({ type: 'trophy', id: t.id });
    }
  }
}
