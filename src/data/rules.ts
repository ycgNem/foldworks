// Global rules of the sim, each with its derivation (DESIGN.md). Plain numbers: rates, sizes and
// timers, never stocks.

export interface Rule { value: number; derivation: string }

const r = (value: number, derivation: string): Rule => ({ value, derivation });

export const RULES = {
  /** belt speed, tiles per second */
  beltSpeed: r(2, '§4 Belt Mk1: 2 tiles/s, 1 item per tile = 120 items/min'),
  /** a machine's input buffer holds this many crafts' worth of each input */
  inputCrafts: r(2, '§4 Machine buffers: input holds 2 crafts worth'),
  /** a machine's output buffer holds this many items (and its byproduct buffer the same) */
  outputCap: r(4, '§4 Machine buffers: output holds 4 items'),
  /** the Hand Furnace (and any furnace next to a patch) holds this much hand-mined ore */
  handOreCap: r(4, '§6 Hand-mining: the machine holds up to 4'),
  /** seconds of smelting per crank click before the Bellows */
  crankSeconds: r(0.25, '§6 Cranking: each click = 0.25 s of progress'),
  /** clicks per second the game counts; faster clicks are ignored */
  clickCap: r(12, '§1 Clicks: a 12 clicks/s ceiling, so autoclickers buy nothing'),
  /** the rolling window the hover report and the Inspector read, seconds */
  statWindow: r(60, '§4 Status pips: "41% of the last minute"'),
  /** Sparks: one every 3-6 minutes, visible for 20 s */
  sparkMin: r(180, '§6 Sparks: one every 3-6 min (uniform)'),
  sparkMax: r(360, '§6 Sparks: one every 3-6 min (uniform)'),
  sparkLife: r(20, '§6 Sparks: visible for 20 s'),
  /** Lucky Vein: miners on that patch run this much faster for this long */
  veinMult: r(3, '§6 Lucky Vein: 3x for 60 s'),
  veinSeconds: r(60, '§6 Lucky Vein: 3x for 60 s'),
  /** Inspector: pays this many seconds of the line's measured output value x the grade multiplier */
  inspectorSeconds: r(60, '§6 Inspector: 60 s of that line\'s measured output value'),
  /** fold box limit, warm-up and window (seconds) */
  foldMax: r(8, '§10 the Fold box is at most 8x8 in the slice'),
  auditWarmup: r(10, '§10 Audit: 10 s warm-up'),
  auditWindow: r(60, '§10 Audit: a 60 s window'),
  /** compactness: machine tiles / box tiles at which C = 1 */
  compactFull: r(0.6, '§10 Grade: C = min(1, (machine tiles / box tiles) / 0.6)'),
  /** stamp cost growth per copy already made */
  stampGrowth: r(0.5, '§10 Stamp: bill x (1 + 0.5 n), linear'),
  /** offline */
  offlineEff: r(0.5, '§12 offline efficiency 0.5'),
  offlineCapHours: r(24, '§12 elapsed time capped at 24 h in the slice'),
  offlineReplayTicks: r(12000, '§12 replay up to 10 min of real ticks (12,000 ticks)'),
  /** Bramble rep 1: plates sell for this much more */
  repPlateBonus: r(0.2, '§7 Reputation: 1 rep -> plates sell for +20%'),
  /** Bramble rep 2: a free Buffer Crate every this many seconds, up to this many */
  repCrateSeconds: r(60, '§7 Reputation: 2 rep -> one free Buffer Crate a minute up to 5'),
  repCrateMax: r(5, '§7 Reputation: 2 rep -> one free Buffer Crate a minute up to 5'),
};

export type RuleId = keyof typeof RULES;

/** The fold grades (§10): score floor, letter and rate multiplier. */
export const GRADES = [
  { letter: 'S', min: 0.9, mult: 1.25, derivation: '§10 Grade S >= 0.90 x1.25' },
  { letter: 'A', min: 0.8, mult: 1.1, derivation: '§10 Grade A >= 0.80 x1.10' },
  { letter: 'B', min: 0.65, mult: 1.0, derivation: '§10 Grade B >= 0.65 x1.00' },
  { letter: 'C', min: 0.5, mult: 0.9, derivation: '§10 Grade C >= 0.50 x0.90' },
  { letter: 'D', min: -Infinity, mult: 0.75, derivation: '§10 Grade D < 0.50 x0.75' },
] as const;
export type GradeLetter = (typeof GRADES)[number]['letter'];

export function gradeFor(score: number) {
  return GRADES.find((g) => score >= g.min)!;
}

/** The fold score's weights (§10): score = 0.6 U + 0.2 W + 0.2 C. */
export const SCORE_WEIGHTS = { u: 0.6, w: 0.2, c: 0.2, derivation: '§10 score = 0.6 U + 0.2 W + 0.2 C' };
