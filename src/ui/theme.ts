// The 180's colour roles (docs/hud-180.md, "Colour roles"): ink on paper. Every value is a
// palette B colour (`C` in src/data/palette.ts, or a Lantern Bayou slot `C` shadows with palette
// A's name, read from PALETTE); the palette itself never changes. tests/kit.test.ts checks the
// contrast pairs: ink and inkSoft at least 7:1 on paper, every accent ink at least 4.4:1.
import { C, PALETTE } from '../data/palette';

/** Lantern Bayou's darkest brass (`brass0` in pal.py). `C.brass0` is palette A's name for the
 * frame brass (`brass1` in B), so the deep one is read from the ordered palette. */
const LB_BRASS0 = PALETTE[40];

export const T = {
  // paper: tag and page fill, its lit edge, its shadow edge and fold, the line round it
  paper: C.bone,
  paperHi: C.lamp3,
  paperLo: C.wood5,
  paperEdge: C.wood2,
  // ink on paper
  ink: C.ink,
  inkSoft: C.wood1,
  // accent inks on paper (each at least 4.4:1 on `paper`)
  good: C.moss1,
  bad: C.copper0,
  warn: C.copper1,
  coin: LB_BRASS0,
  research: C.water2,
  power: C.iron0,
  reset: C.slag0,
  // fills that carry a role (chips drawn solid, stamps, bars): never text on paper
  badFill: C.red,
  goodFill: C.moss3,
  warnFill: C.lamp1,
  coinFill: C.brass2,
  researchFill: C.water4,
  powerFill: C.iron1,
  resetFill: C.slag1,
  // wood: the Purse's sign, the wheel's hub, the lift's case, the book's leather
  wood: C.wood2,
  woodHi: C.wood4,
  woodLo: C.wood0,
  leather: C.wood1,
  // brass: gold buttons, grommets, nails
  brass: C.brass2,
  brassHi: C.brass3,
  brassLo: C.brass0,
  brassDeep: LB_BRASS0,
  // text over the floor: light, always with an ink outline (coin pops, a tag's floating number)
  floorText: C.bone,
  floorCoin: C.lamp2,
  floorGood: C.moss5,
  floorBad: C.copper3,
  floorWarn: C.lamp1,
  floorResearch: C.teal,
  floorPower: C.iron2,
  floorReset: C.violet,
  floorOutline: C.ink,
  // the soft shadow paper casts on what it lies over
  shadow: C.ink,
} as const;

export type ThemeRole = keyof typeof T;

/** The roles that ink text on paper (chips, rich-text spans). */
export type Role = 'ink' | 'soft' | 'good' | 'bad' | 'warn' | 'coin' | 'research' | 'power' | 'reset';

/** A role's ink colour on paper. */
export function roleInk(r: Role): string {
  return r === 'soft' ? T.inkSoft : T[r];
}

/** A role's fill colour (a solid chip, a bar's fill, a stamp). */
export function roleFill(r: Role): string {
  switch (r) {
    case 'good': return T.goodFill;
    case 'bad': return T.badFill;
    case 'warn': return T.warnFill;
    case 'coin': return T.coinFill;
    case 'research': return T.researchFill;
    case 'power': return T.powerFill;
    case 'reset': return T.resetFill;
    case 'soft': return T.paperLo;
    default: return T.ink;
  }
}

/** A role's light colour for text over the floor (drawn with an ink outline). */
export function roleFloor(r: Role): string {
  switch (r) {
    case 'good': return T.floorGood;
    case 'bad': return T.floorBad;
    case 'warn': return T.floorWarn;
    case 'coin': return T.floorCoin;
    case 'research': return T.floorResearch;
    case 'power': return T.floorPower;
    case 'reset': return T.floorReset;
    default: return T.floorText;
  }
}

/** The pre-180 accents and light text colours, each mapped to the ink that plays its role on
 * paper. Callers still pass light colours (bone, gold, teal1...) meant for slate boxes; the paper
 * widgets run them through `onPaper` so they stay legible until every caller is rewritten. */
const ON_PAPER: Record<string, string> = {};
for (const [ink, cols] of [
  [T.ink, [C.bone, C.hot, C.hull3]],
  [T.inkSoft, [C.mist, C.fog, C.hull2, C.hull1]],
  [T.coin, [C.gold, C.brass1, C.brass0, C.amber, C.pipYellow, C.brass3]],
  [T.research, [C.teal1, C.teal0, C.teal, C.water4]],
  [T.good, [C.leaf, C.moss, C.lily, C.pipGreen, C.moss4]],
  [T.warn, [C.copper2, C.glow, C.lamp0, C.copper3]],
  [T.bad, [C.pipRed, C.red]],
  [T.reset, [C.violet, C.slag]],
  [T.power, [C.pipBlue, C.ice, C.sky]],
] as [string, string[]][])
  for (const c of cols) if (!(c in ON_PAPER)) ON_PAPER[c] = ink;

/** The ink for a colour a caller meant for a dark box: light text becomes ink, light accents
 * their role's ink; a colour that already reads on paper passes through. */
export function onPaper(col: string | undefined, fallback: string = T.ink): string {
  if (!col) return fallback;
  return ON_PAPER[col] ?? col;
}

/** The role a pre-180 accent colour stands for (a card's ribbon, a tab's bookmark). */
export function accentRole(col: string | undefined): Role {
  const ink = onPaper(col);
  for (const r of ['good', 'bad', 'warn', 'coin', 'research', 'power', 'reset'] as const) if (T[r] === ink) return r;
  return 'ink';
}

/** WCAG relative luminance of a #rrggbb colour. */
export function luminance(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  const lin = (v: number) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin((n >> 16) & 255) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255);
}

/** WCAG contrast ratio between two #rrggbb colours. */
export function contrast(a: string, b: string): number {
  const la = luminance(a), lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}
