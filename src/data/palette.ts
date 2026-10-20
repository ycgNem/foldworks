// The game palette: candidate A, "Foundry", picked at the Milestone 0 palette test (DECISIONS.md,
// STYLE.md). PALETTE is the ordered list the art scripts snap to (scripts/lib/pixel.mjs reads it
// from this file); C names each colour for code: first the palette's own slot names (what the art
// director's build scripts use), then the semantic aliases the UI and placeholders use.

export const PALETTE = [
  '#1d1420', '#3a2532', '#f2e6cf',
  '#4a3431', '#62473b', '#7e624c',
  '#463f50', '#847f87', '#b4ada9', '#dccfb8',
  '#333a5a', '#5c6d93', '#96a9c6',
  '#722d2a', '#c4633b', '#ec9e78',
  '#74586e',
  '#7a5418', '#c99a3a', '#f5952a', '#ffeca0',
  '#2a6566', '#6fc1ae',
  '#5a6a2e', '#9cb446',
  '#9a4a88',
  '#66cc50', '#ffe466', '#c8362e', '#3d3c42', '#4a8fe2',
  '#ffcc3d',
] as const;

const A = {
  ink: '#1d1420', shadow: '#3a2532', bone: '#f2e6cf',
  ground0: '#4a3431', ground1: '#62473b', ground2: '#7e624c',
  // hull1 and hull2 lifted one step after the palette test (art director's note)
  hull0: '#463f50', hull1: '#847f87', hull2: '#b4ada9', hull3: '#dccfb8',
  iron0: '#333a5a', iron1: '#5c6d93', iron2: '#96a9c6',
  copper0: '#722d2a', copper1: '#c4633b', copper2: '#ec9e78',
  slag: '#74586e',
  brass0: '#7a5418', brass1: '#c99a3a', glow: '#f5952a', hot: '#ffeca0',
  teal0: '#2a6566', teal1: '#6fc1ae',
  moss: '#5a6a2e', leaf: '#9cb446',
  violet: '#9a4a88',
  // status pips (DESIGN.md §4, §17): apart by lightness as well as hue
  pipGreen: '#66cc50', pipYellow: '#ffe466', pipRed: '#c8362e', pipGrey: '#3d3c42', pipBlue: '#4a8fe2',
  // the 32nd slot: bright coin gold for the numbers that matter
  gold: '#ffcc3d',
} as const;

export const C = {
  ...A,
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
