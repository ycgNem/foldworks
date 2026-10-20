// Statistics (the last system of the tick): each machine's state per second over the last minute
// (the hover report's "starved of iron ore 41% of the last minute", the Inspector's U), and coin
// earned per second over the last minute (the HUD's coin/min and offline extrapolation).
import type { Game } from '../Game';
import type { Ent } from '../world';
import { RULES } from '../../data/rules';
import { TICK_RATE } from '../../engine/time';

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
  for (const list of [g.miners, g.machines]) {
    for (const m of list) {
      m.hist = (m.hist + dominant(m)).slice(-win);
      m.sec[0] = m.sec[1] = m.sec[2] = m.sec[3] = 0;
    }
  }
  g.s.income.push(g.s.incomeSec);
  if (g.s.income.length > win) g.s.income.shift();
  g.s.incomeSec = 0;
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
