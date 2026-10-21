// The game palette: "Lantern Bayou", picked at the art revamp's style test (DECISIONS.md, the art
// revamp, 2026-10-20; STYLE.md). It replaced palette A ("Foundry", Milestone 0). PALETTE is the
// ordered list the art scripts snap to (scripts/lib/pixel.mjs and scripts/art-import.mjs read it
// from this file; pixel-art/revamp/pal.py is its source). C names each colour for code: the Lantern
// Bayou slot names, then palette A's slot names (kept so code never changed, each mapped to the
// colour that plays that role now), then the semantic aliases the UI and placeholders use.

export const PALETTE = [
  '#130e1c', '#211a30', '#322944',
  '#0e2629', '#143638', '#1c4a49', '#2a625c', '#4a8a78',
  '#1d2f22', '#2b4628', '#3d5f2d', '#587b34', '#7e9b3e', '#a8bf55',
  '#3a221f', '#583428', '#7a4b33', '#9e6a42', '#c28f5a', '#dcb07a',
  '#3e302d', '#56433a', '#705847', '#8c7258',
  '#2c3042', '#464c65', '#6b7290', '#98a0b8', '#cbd0de',
  '#273a68', '#4066a8', '#76a3dc',
  '#6a2723', '#aa472d', '#de7a44', '#f4ac74',
  '#b4561c', '#ee8a26', '#ffbe48', '#fff0a6',
  '#5b4016', '#91701f', '#c8a13a', '#ecd27c',
  '#4f3658', '#83568a', '#b45aa0', '#7ccdb4',
  '#eee2c6', '#c2db74', '#c43a32',
  // status pips: code-only, never in sprite art (unchanged from palette A)
  '#66cc50', '#ffe466', '#c8362e', '#3d3c42', '#4a8fe2',
  // the sky island (docs/sky-island.md, 2026-10-21): palette B extended for the world. Appended
  // after the pips so no earlier index moves (theme.ts reads PALETTE[40]); proposed hexes, the
  // style test tunes them. Code reads them only through C (sky0.., cloud0.., grass0.., pave0.., sun).
  '#3a78d4', '#5893e3', '#7fb2ee', '#a9d0f5', '#d4ebfb',
  '#9cb4da', '#c3d6ef', '#e6f0fb', '#ffffff',
  '#2f6e36', '#4c9a3e', '#73c14e', '#a3dd68',
  '#7d7468', '#a3988a', '#c4b8a5', '#ddd2bd',
  '#ffe9c2',
] as const;

/** The sky island's ramps (docs/sky-island.md, Palette): dark to light, the sky zenith to horizon. */
const SKY = {
  sky0: '#3a78d4', sky1: '#5893e3', sky2: '#7fb2ee', sky3: '#a9d0f5', sky4: '#d4ebfb',
  cloud0: '#9cb4da', cloud1: '#c3d6ef', cloud2: '#e6f0fb', cloud3: '#ffffff',
  grass0: '#2f6e36', grass1: '#4c9a3e', grass2: '#73c14e', grass3: '#a3dd68',
  pave0: '#7d7468', pave1: '#a3988a', pave2: '#c4b8a5', pave3: '#ddd2bd',
  sun: '#ffe9c2',
} as const;

/** Lantern Bayou's own slots (what the art scripts use): ramps dark to light. */
const LB = {
  ink: '#130e1c', ink1: '#211a30', ink2: '#322944',
  water0: '#0e2629', water1: '#143638', water2: '#1c4a49', water3: '#2a625c', water4: '#4a8a78',
  moss0: '#1d2f22', moss1: '#2b4628', moss2: '#3d5f2d', moss3: '#587b34', moss4: '#7e9b3e', moss5: '#a8bf55',
  wood0: '#3a221f', wood1: '#583428', wood2: '#7a4b33', wood3: '#9e6a42', wood4: '#c28f5a', wood5: '#dcb07a',
  earth0: '#3e302d', earth1: '#56433a', earth2: '#705847', earth3: '#8c7258',
  steel0: '#2c3042', steel1: '#464c65', steel2: '#6b7290', steel3: '#98a0b8', steel4: '#cbd0de',
  iron0: '#273a68', iron1: '#4066a8', iron2: '#76a3dc',
  copper0: '#6a2723', copper1: '#aa472d', copper2: '#de7a44', copper3: '#f4ac74',
  lamp0: '#b4561c', lamp1: '#ee8a26', lamp2: '#ffbe48', lamp3: '#fff0a6',
  brass0: '#5b4016', brass1: '#91701f', brass2: '#c8a13a', brass3: '#ecd27c',
  slag0: '#4f3658', slag1: '#83568a', violet: '#b45aa0', teal: '#7ccdb4',
  bone: '#eee2c6', lily: '#c2db74', red: '#c43a32',
} as const;

/** Palette A's slot names, each now the Lantern Bayou colour that plays its role. */
const A = {
  ink: LB.ink, shadow: LB.ink1, bone: LB.bone,
  // the old ground ramp is wood now: the Workshop is a deck, and wood frames the ornate UI
  ground0: LB.wood0, ground1: LB.wood1, ground2: LB.wood2,
  hull0: LB.steel1, hull1: LB.steel2, hull2: LB.steel3, hull3: LB.steel4,
  iron0: LB.iron0, iron1: LB.iron1, iron2: LB.iron2,
  copper0: LB.copper0, copper1: LB.copper1, copper2: LB.copper2,
  slag: LB.slag1,
  // brass0/brass1 keep their meaning (frame and rivet); the darkest brass is LB.brass0
  brass0: LB.brass1, brass1: LB.brass2, glow: LB.lamp1, hot: LB.lamp3,
  teal0: LB.water3, teal1: LB.teal,
  moss: LB.moss3, leaf: LB.moss5,
  violet: LB.violet,
  // status pips (DESIGN.md §4, §17): apart by lightness as well as hue
  pipGreen: '#66cc50', pipYellow: '#ffe466', pipRed: '#c8362e', pipGrey: '#3d3c42', pipBlue: '#4a8fe2',
  // coin gold for the numbers that matter: the lantern's own gold
  gold: LB.lamp2,
} as const;

export const C = {
  ...LB,
  ...A,
  ...SKY,
  // semantic aliases (UI, placeholders), darkest neutral first
  night: A.shadow, slate: A.hull0, iron: A.hull1, steel: A.hull1, fog: A.hull2, mist: A.hull3,
  bark: A.ground0, umber: A.ground1, clay: A.ground2,
  copper: A.copper1, tan: A.copper2, rust: A.copper0, cream: A.hot,
  orange: A.glow, amber: A.brass1,
  deep: A.iron0, blue: A.iron0, sky: A.iron1, ice: A.iron2,
  lime: A.leaf, plum: A.slag,
} as const;

export type ColorName = keyof typeof C;

/** 'rgba(...)' for a palette hex at an alpha (overlays and fades). */
export function rgba(hex: string, a: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}
