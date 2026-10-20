// One helper for every number the player reads (DESIGN.md §20, the number-readability pass):
// amounts, rates, power, durations, shares and multipliers are written the same way everywhere,
// and anything big goes through Num.format, so the notation setting (standard, scientific,
// engineering, letters) reaches every figure. No raw toFixed in what the player sees: decimals
// only where a small number needs them, and never trailing zeros ("2.5", not "2.50").
// Pure (no DOM): the sim's refusal messages and reports use it too.
import { Num, type NumLike } from './num';

/** A whole amount: 1,234 · 12.3K · 4.56M (floored: never more than there is). */
export function amount(x: NumLike): string {
  return Num.from(x).format();
}

/** A small plain number with at most `d` decimals, trailing zeros dropped: 2.5, 0.75, 12. Big
 * values (10,000 and up) go through the notation. */
export function plain(x: number, d = 1): string {
  if (!isFinite(x)) return x > 0 ? 'a lot' : '-a lot';
  if (Math.abs(x) >= 1e4) return Num.of(Math.round(x)).format();
  const k = Math.pow(10, d);
  const r = Math.round(x * k) / k;
  let s = r.toFixed(d);
  if (d > 0) s = s.replace(/\.?0+$/, '');
  // thousands separators on the whole part, like Num.format below 10,000
  return s.replace(/^(-?)(\d+)/, (_, sign: string, int: string) => sign + int.replace(/\B(?=(\d{3})+$)/g, ','));
}

/** A per-second rate as per minute, the unit the player sees (DESIGN.md §1): 480, 37.5, 0.75. */
export function perMin(perSecond: number): string {
  const m = perSecond * 60;
  const a = Math.abs(m);
  return a >= 100 ? plain(m, 0) : a >= 10 ? plain(m, 1) : plain(m, 2);
}

/** Power: 300 kW, 1,200 kW, then 12.5 MW from 10,000 kW. */
export function kw(x: number): string {
  if (Math.abs(x) >= 1e4) return `${plain(x / 1000, x >= 1e5 ? 0 : 1)} MW`;
  return `${plain(x, x >= 100 ? 0 : 1)} kW`;
}

/** A share 0..1 as a whole percent: 41%. */
export function pct(f: number): string {
  return `${Math.round(f * 100)}%`;
}

/** A rate multiplier: x1.25, x1.1, x3. */
export function mult(x: number): string {
  return `x${plain(x, 2)}`;
}

/** A duration in seconds, two units at most: 45s · 4m 10s · 2h 05m · 3d 4h. */
export function duration(s: number): string {
  s = Math.max(0, Math.floor(s));
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, '0')}s`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}m`;
  return `${Math.floor(s / 86400)}d ${Math.floor((s % 86400) / 3600)}h`;
}

/** A clock time into a span, for timelines: 0:47, 3:12, 26:05 (hours:minutes). */
export function clock(s: number): string {
  s = Math.max(0, Math.floor(s));
  return `${Math.floor(s / 3600)}:${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}`;
}
