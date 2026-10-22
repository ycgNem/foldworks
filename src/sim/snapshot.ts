// What a save holds (CLAUDE.md: seed + commands + periodic snapshots): the seed, a snapshot of the
// state at some tick, and the commands logged since it. Loading restores the snapshot and replays
// the commands on top, so a save is exact; replaying the seed with the whole command log from tick
// 0 reaches the same state too (tests/sim.test.ts checks both).
import { Num, reviveNums } from '../engine/num';
import { Game, type Logged } from './Game';
import type { State } from './world';

export interface SavePayload {
  seed: number;
  /** ms since epoch when written (from the app; the sim never reads a clock) */
  saved: number;
  /** the tick the save was written at */
  tick: number;
  /** JSON of the State at `snapTick` */
  snap: string;
  snapTick: number;
  /** commands applied since the snapshot */
  log: Logged[];
}

export function takeSnapshot(g: Game): { snap: string; snapTick: number } {
  return { snap: JSON.stringify(g.s), snapTick: g.s.tick };
}

/** A save of the game now: a fresh snapshot (the log since it is empty). */
export function savePayload(g: Game, savedMs: number): SavePayload {
  const { snap, snapTick } = takeSnapshot(g);
  g.log = [];
  return { seed: g.s.seed, saved: savedMs, tick: g.s.tick, snap, snapTick, log: [] };
}

export function stateFrom(json: string): State {
  return JSON.parse(json, reviveNums) as State;
}

/** Rebuild a Game from a save: the snapshot, then the logged commands replayed up to `tick`. */
export function restore(p: { seed: number; snap: string; snapTick: number; log: Logged[]; tick: number }): Game {
  const g = new Game(p.seed, { empty: true });
  g.s = stateFrom(p.snap);
  g.rebuild();
  replayInto(g, p.log, p.tick);
  return g;
}

/** Check that a save holds a game that rebuilds (DESIGN.md §20, corruption recovery); throws if
 * not. Returns the rebuilt game, so a caller that wants it does not rebuild twice. */
export function checkSave(d: { seed?: unknown; snap?: unknown; snapTick?: unknown; log?: unknown; tick?: unknown }): Game {
  if (typeof d.seed !== 'number' || typeof d.snap !== 'string') throw new Error('not a game save');
  const p = { seed: d.seed, snap: d.snap, snapTick: Number(d.snapTick ?? 0), log: Array.isArray(d.log) ? (d.log as Logged[]) : [], tick: Number(d.tick ?? d.snapTick ?? 0) };
  const g = restore(p);
  const s = g.s;
  if (!(s.coin instanceof Num) || !(s.earned instanceof Num)) throw new Error('coin is not a number');
  if (!Array.isArray(s.ents) || !s.factory || !Array.isArray(s.factory.ents) || !s.research || !s.orders) throw new Error('the state is incomplete');
  if (!Number.isFinite(s.tick) || s.tick < 0) throw new Error('the clock is broken');
  return g;
}

/** Step `g` to `until`, applying each logged command at its tick. */
export function replayInto(g: Game, log: Logged[], until: number) {
  let i = 0;
  while (g.s.tick < until || i < log.length) {
    while (i < log.length && log[i].t === g.s.tick) g.act(log[i++].c);
    if (i < log.length && log[i].t < g.s.tick) throw new Error(`replay: command for tick ${log[i].t} is in the past (now ${g.s.tick})`);
    if (g.s.tick >= until && i >= log.length) break;
    g.tick();
  }
}

/** Replay a whole run from its seed and complete command history. */
export function replay(seed: number, history: Logged[], until: number): Game {
  const g = new Game(seed, { keepHistory: true });
  replayInto(g, history, until);
  return g;
}

/** A stable fingerprint of a state, for determinism checks. */
export function fingerprint(g: Game): string {
  const s = g.s;
  const ents = s.ents.map((e) => `${e.id}${e.kind}${e.x},${e.y}${e.rot}|${e.item ?? ''}${e.p.toFixed(3)}${e.item2 ? e.item2 + (e.p2 ?? 0).toFixed(3) : ''}|${JSON.stringify(e.inBuf)}${e.out}${e.by}${e.prog}${e.count}${e.store.join(',')}`).join(';');
  // the layer-3 state (DESIGN.md §23): Kernels, the universe, the Ledger
  const m = s.meta;
  const meta = `${m.kernels?.toString() ?? ''}:${(m.kernelNodes ?? []).join(',')}:${m.lastFolds ?? 0}:${m.ledger?.n ?? 0}`;
  // the long tail (DESIGN.md §24): the shelf, the cosmetics and skins, the boards, the free buildings
  const tail = `${s.flags.filter((f) => f.startsWith('trophy:')).join(',')}|${(m.cosmetics ?? []).join(',')}|${JSON.stringify(m.skins ?? {})}|${JSON.stringify(m.boards ?? {})}|${s.ents.filter((e) => e.free).map((e) => e.id).join(',')}|${s.challenge ?? ''}:${(m.challenges ?? []).join(',')}`;
  // the islands (DESIGN.md §22): where the town is, the rubble lying and the record of what stays
  // cleared, Rime's cold machines, and the Town Plan's layouts
  const isles = `${m.world ?? 'home'}|${(s.rubble ?? []).join(',')}|${JSON.stringify(m.cleared ?? null)}|${s.ents.filter((e) => e.cold).map((e) => e.id).join(',')}|${JSON.stringify(m.plans ?? [])}`;
  return [s.tick, s.coin.toString(), s.earned.toString(), s.rng, s.research.done.join(','), ents, JSON.stringify(s.research.bank), meta, tail, isles].join('#');
}

export { Num };
