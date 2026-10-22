// The ambience mixer's arithmetic (Milestone 12), apart from Web Audio so it can be tested: what
// is working on screen comes in as sources (a family and a place across the view), and out come
// a few voices, one per family at most, each with a level and a pan. Never one voice per machine:
// ten Smelters on screen are one Smelter voice, louder (by the square root of the count, so the
// tenth adds less than the second) and panned to where they stand on average. Machine families
// compete for a handful of voices (the loudest win); belts, modules and skiffs are beds of their
// own floors and always sound when present. A panel open over the floor ducks all of it.

/** The voices: the machine families (STYLE.md's families by motion), then the floor beds. */
export type Fam =
  | 'miner' | 'smelter' | 'press' | 'assembler' | 'kiln' | 'chem' | 'green' | 'power'
  | 'belt' | 'module' | 'skiff';

export const MACHINE_FAMS: readonly Fam[] = ['miner', 'smelter', 'press', 'assembler', 'kiln', 'chem', 'green', 'power'];
export const BED_FAMS: readonly Fam[] = ['belt', 'module', 'skiff'];
const IS_MACHINE = new Set<Fam>(MACHINE_FAMS);
const ORDER = new Map<Fam, number>([...MACHINE_FAMS, ...BED_FAMS].map((f, i) => [f, i]));

/** Something sounding on screen: its family, where it is across the view (0 left .. 1 right),
 *  and how much of it there is (a route's skiffs; 1 by default). */
export interface Src { fam: Fam; x: number; w?: number }

/** One voice of the mix: how many it stands for, its level (0..1) and its pan (-1 .. 1). */
export interface Voice { fam: Fam; n: number; level: number; pan: number }

export const MIX = {
  /** machine families sounding at once: the rest wait until they are among the busiest */
  machineVoices: 3,
  /** a panel over the floor: everything at this share */
  duck: 0.3,
  /** pans stay inside this, so nothing sits hard in one ear */
  panWidth: 0.7,
  /** how many make a family's voice full: one Smelter is sqrt(1/6) of it */
  full: { miner: 8, smelter: 6, press: 6, assembler: 6, kiln: 6, chem: 5, green: 4, power: 4, belt: 40, module: 12, skiff: 6 } as Record<Fam, number>,
};

const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);

/** The voices for what is working on screen. `duck`: a panel is open over the floor. */
export function mix(srcs: readonly Src[], o: { duck?: boolean } = {}): Voice[] {
  const acc = new Map<Fam, { n: number; sx: number }>();
  for (const s of srcs) {
    const w = s.w ?? 1;
    if (!(w > 0)) continue;
    const a = acc.get(s.fam);
    const x = clamp(Number.isFinite(s.x) ? s.x : 0.5, 0, 1);
    if (a) { a.n += w; a.sx += x * w; } else acc.set(s.fam, { n: w, sx: x * w });
  }
  const k = o.duck ? MIX.duck : 1;
  const all: Voice[] = [];
  for (const [fam, a] of acc) {
    const level = Math.min(1, Math.sqrt(a.n / MIX.full[fam])) * k;
    const pan = clamp((a.sx / a.n) * 2 - 1, -1, 1) * MIX.panWidth;
    all.push({ fam, n: a.n, level, pan });
  }
  const machines = all.filter((v) => IS_MACHINE.has(v.fam)).sort((a, b) => b.n - a.n || ORDER.get(a.fam)! - ORDER.get(b.fam)!);
  const keep = new Set(machines.slice(0, MIX.machineVoices).map((v) => v.fam));
  return all.filter((v) => !IS_MACHINE.has(v.fam) || keep.has(v.fam)).sort((a, b) => ORDER.get(a.fam)! - ORDER.get(b.fam)!);
}

/** Seconds between a ticking family's ticks: more of them tick a little faster (a busy press
 *  hall), never more than twice as fast, so twenty presses do not become a drum roll. */
export function tickGap(base: number, n: number): number {
  return base / Math.min(2, 1 + 0.4 * Math.log(Math.max(1, n)));
}
