// Player settings that are not part of the game (DESIGN.md §20): how big numbers are written, and
// how much a hover over the floor shows.
// Kept in localStorage apart from the save, so a notation follows the browser, not the factory,
// and never touches the sim's state (an export string carries the game, not the reader's taste).
import { NOTATIONS, getNotation, setNotation, type Notation } from '../engine/num';
import { store } from '../engine/save';

const KEY = 'foldworks_settings';

/** How much a hover over the floor shows: the status line (brief), every row it showed before
 * 2026-10-21 (full), or nothing until you click (off). */
export type HoverTags = 'brief' | 'full' | 'off';
export const HOVER_TAGS: HoverTags[] = ['brief', 'full', 'off'];
let hoverTags: HoverTags = 'brief';

interface Settings { notation?: Notation; hover?: HoverTags }

function read(): Settings {
  try {
    return JSON.parse(store()?.getItem(KEY) ?? '{}') as Settings;
  } catch {
    return {};
  }
}

function write(s: Settings) {
  try {
    store()?.setItem(KEY, JSON.stringify(s));
  } catch { /* a full or blocked store: the setting lasts this session */ }
}

/** Apply the stored settings (once, at start). */
export function loadSettings() {
  const s = read();
  if (s.notation && NOTATIONS.includes(s.notation)) setNotation(s.notation);
  if (s.hover && HOVER_TAGS.includes(s.hover)) hoverTags = s.hover;
}

export function getHoverTags(): HoverTags {
  return hoverTags;
}

/** The Options page's button for hover tags. */
export const HOVER_LABEL: Record<HoverTags, string> = {
  brief: 'Brief {soft:status only}',
  full: 'Full {soft:every row}',
  off: 'Off {soft:click to see}',
};

/** Step to the next hover setting and remember it. */
export function cycleHoverTags(): HoverTags {
  hoverTags = HOVER_TAGS[(HOVER_TAGS.indexOf(hoverTags) + 1) % HOVER_TAGS.length];
  write({ ...read(), hover: hoverTags });
  return hoverTags;
}

/** Each notation's name and a sample, as a row (docs/hud-180.md: no parentheses, one colon at
 * most): the Options page's button carries it. */
export const NOTATION_LABEL: Record<Notation, string> = {
  standard: 'Standard {soft:12.3K · 4.56M}',
  scientific: 'Scientific {soft:1.23e4}',
  engineering: 'Engineering {soft:12.3e3}',
  letters: 'Letters {soft:Dc → aa · ab}',
};

/** Step to the next notation and remember it. */
export function cycleNotation(): Notation {
  const i = NOTATIONS.indexOf(getNotation());
  const n = NOTATIONS[(i + 1) % NOTATIONS.length];
  setNotation(n);
  write({ ...read(), notation: n });
  return n;
}
