// A question the HUD asks every frame whose answer only changes when the sim does (Milestone 14,
// DESIGN.md "Performance (measured)"): a reset's preview walks every module on every floor, and the
// HUD asked it two or three times a frame (2 ms a frame with 200 modules a floor). Answered once a
// tick (and again when the layout changes), the same number as before reaches the screen.
import type { Game } from '../sim/Game';

const memo = new Map<string, { g: Game; at: string; v: unknown }>();

export function perTick<T>(g: Game, key: string, f: () => T): T {
  const at = `${g.s.tick}|${g.version}|${g.fversion}|${g.hversion}|${g.s.research.done.length}`;
  const m = memo.get(key);
  if (m && m.g === g && m.at === at) return m.v as T;
  const v = f();
  memo.set(key, { g, at, v });
  return v;
}
