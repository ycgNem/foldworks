// Player settings that are not part of the game (DESIGN.md §20): how big numbers are written.
// Kept in localStorage apart from the save, so a notation follows the browser, not the factory,
// and never touches the sim's state (an export string carries the game, not the reader's taste).
import { NOTATIONS, getNotation, setNotation, type Notation } from '../engine/num';
import { store } from '../engine/save';

const KEY = 'foldworks_settings';

interface Settings { notation?: Notation }

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
}

export const NOTATION_LABEL: Record<Notation, string> = {
  standard: 'Standard (12.3K, 4.56M)',
  scientific: 'Scientific (1.23e4)',
  engineering: 'Engineering (12.3e3)',
  letters: 'Letters (after Dc: aa, ab)',
};

/** Step to the next notation and remember it. */
export function cycleNotation(): Notation {
  const i = NOTATIONS.indexOf(getNotation());
  const n = NOTATIONS[(i + 1) % NOTATIONS.length];
  setNotation(n);
  write({ ...read(), notation: n });
  return n;
}
