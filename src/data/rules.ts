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
  veinMult: r(3, '§6 Lucky Vein: its line runs 3x for 60 s'),
  veinSeconds: r(60, '§6 Lucky Vein: 3x for 60 s'),
  /** Inspector: pays this many seconds of the line's measured output value x the grade multiplier */
  inspectorSeconds: r(60, '§6 Inspector: 60 s of that line\'s measured output value'),
  /** fold box limit, warm-up and window (seconds) */
  foldMax: r(8, '§10 the Fold box is at most 8x8 in the slice'),
  auditWarmup: r(10, '§10 Audit: 10 s warm-up'),
  auditWindow: r(60, '§10 Audit: a 60 s window'),
  /** Workshop lines audited at once */
  maxAudits: r(3, '§10 Audit: up to three lines at once, so the slice\'s folds are not three waits in a row (the Milestone 3 gate review)'),
  /** compactness: machine tiles / box tiles at which C = 1 */
  compactFull: r(0.6, '§10 Grade: C = min(1, (machine tiles / box tiles) / 0.6)'),
  /** stamp cost growth per copy already made */
  stampGrowth: r(0.5, '§10 Stamp: bill x (1 + 0.5 n), linear'),
  /** a module's input and output buffers hold this many seconds of its rates */
  moduleBuffer: r(2, '§11 module buffers: 2 s of each rate, like a machine holding 2 crafts (§4)'),
  /** offline */
  offlineEff: r(0.5, '§12 offline efficiency 0.5'),
  offlineCapHours: r(24, '§12 elapsed time capped at 24 h in the slice'),
  offlineReplayTicks: r(72000, '§12 replay up to 1 h of real ticks (72,000 ticks, about a second): heaps fill and lines jam in it as they would live'),
  /** Bramble rep 1: plates sell for this much more */
  repPlateBonus: r(0.2, '§7 Reputation: 1 rep -> plates sell for +20%'),
  /** Bramble rep 2: a free Buffer Crate every this many seconds, up to this many */
  repCrateSeconds: r(60, '§7 Reputation: 2 rep -> one free Buffer Crate a minute up to 5'),
  repCrateMax: r(5, '§7 Reputation: 2 rep -> one free Buffer Crate a minute up to 5'),
  // ---- Act II (DESIGN.md §18)
  /** Poles: reach (a square of side 2r+1) and the distance that joins two into one grid */
  poleReach: r(2, '§18 Power: a Pole powers everything within 2 tiles (5x5)'),
  poleLink: r(6, '§18 Power: Poles within 6 tiles join one grid'),
  /** modes: speed and power multipliers, and Precision's extra main output */
  modeEfficientSpeed: r(0.75, '§18 Modes: Efficient 0.75x speed at 0.5x power'),
  modeEfficientPower: r(0.5, '§18 Modes: Efficient 0.75x speed at 0.5x power'),
  modeOverclockSpeed: r(1.5, '§18 Modes: Overclocked 1.5x speed at 2.2x power'),
  modeOverclockPower: r(2.2, '§18 Modes: Overclocked 1.5x speed at 2.2x power'),
  modePrecisionSpeed: r(0.8, '§18 Modes: Precision 0.8x speed, +25% of the main output'),
  modePrecisionYield: r(0.25, '§18 Modes: Precision 0.8x speed, +25% of the main output'),
  /** a Boiler or Generator holds this much fuel */
  fuelCap: r(4, '§18 Power: a burner holds 4 fuel, like a machine holding 2 crafts of a 2-item input (§4)'),
  /** Overdrive: speed, seconds on, seconds cooling */
  overdriveMult: r(3, '§18 Machines: Overdrive runs a machine 3x for 10 s, then it cools 30 s'),
  overdriveSeconds: r(10, '§18 Machines: Overdrive runs a machine 3x for 10 s, then it cools 30 s'),
  overdriveCool: r(30, '§18 Machines: Overdrive runs a machine 3x for 10 s, then it cools 30 s'),
  /** Machine Kits per stamp of a design with Act II buildings: 1 + floor(bill / this) */
  kitDivisor: r(500, '§18 Machine Kits: 1 + floor(bill / 500); at 1,500 a stamp took 2-3 kits, about 3% of its price in goods, a chore with no weight (the Milestone 3 gate review)'),
  /** deposit claims: the start, per Workshop deposit owned, per Survey Office block, block growth */
  claimsBase: r(3, '§18 Land and deposits: 3 claims per ore plus 2 per Workshop deposit'),
  claimsPerDeposit: r(2, '§18 Land and deposits: 3 claims per ore plus 2 per Workshop deposit'),
  claimsPerBlock: r(4, '§18 Land and deposits: the Survey Office sells claims 4 at a time'),
  claimGrowth: r(0.5, '§18 Land and deposits: each block costs price x (1 + 0.5 b), the stamp rule'),
  /** the Great Drill's stage 1: Miners and source modules run this much faster */
  drillBoost: r(0.5, '§18 Megaproject #1: stage 1 runs every Miner and source module +50%'),
  /** reputation rewards (Act II customers) */
  voltaireSteam: r(0.25, '§18 Customers: Dame Voltaire rep 2, Steam Engines +25%'),
  unit7Precision: r(0.1, '§18 Customers: Unit 7 rep 3 adds +10% to Precision'),
  codexMult: r(30, '§18 Customers: Unit 7 rep 1, the Codex pays 30x a first delivery (100x paid ~71K in one burst, a motor 42K: the Milestone 3 gate audit)'),
  /** nested folds: the box limit on the Factory floor */
  nestedMax: r(6, '§18 Nested folds: a box up to 6x6 of modules and trunks'),
  /** Reorganize (§15): patents = floor((lifetime coin / this) ^ 0.4) */
  patentDivisor: r(2500, '§15 Reorganize, §16 rule 6: the Act II bot (tests/pace-act2-run.test.ts) has earned about 2.5M lifetime coin by 5 h; 2.5M / 2,500 = 1,000 and 1,000 ^ 0.4 = 15.8, so a 5 h first run gives 15 Patents (12-20), 4 h about 14, and doubling lifetime coin adds about 6'),
};

export type RuleId = keyof typeof RULES;

/** The fold grades (§10): score floor, letter and rate multiplier. */
export const GRADES = [
  { letter: 'S+', min: 0.97, mult: 1.35, derivation: '§10 Grade S+ >= 0.97 x1.35: above S, so a balanced, compact, zero-waste line still has something to reach (the Milestone 3 gate review)' },
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
