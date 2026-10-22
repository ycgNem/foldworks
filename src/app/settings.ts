// Player settings that are not part of the game (DESIGN.md §20): how big numbers are written, how
// much a hover over the floor shows, the sound's volumes and mute, and reduced motion.
// Kept in localStorage apart from the save, so a notation follows the browser, not the factory,
// and never touches the sim's state (an export string carries the game, not the reader's taste).
import { NOTATIONS, getNotation, setNotation, type Notation } from '../engine/num';
import { store } from '../engine/save';
import { cleanBinds, type Binds } from '../engine/input';

const KEY = 'foldworks_settings';

/** How much a hover over the floor shows: the status line (brief), every row it showed before
 * 2026-10-21 (full), or nothing until you click (off). */
export type HoverTags = 'brief' | 'full' | 'off';
export const HOVER_TAGS: HoverTags[] = ['brief', 'full', 'off'];
let hoverTags: HoverTags = 'brief';

/** Milestone 12: the sound buses' volumes (0..1) and the mute, and reduced motion. */
export interface SoundSettings { master: number; sfx: number; amb: number; ui: number; muted: boolean }
export const SOUND_DEFAULT: SoundSettings = { master: 0.8, sfx: 0.8, amb: 0.6, ui: 0.7, muted: false };

interface Settings {
  notation?: Notation; hover?: HoverTags; sound?: Partial<SoundSettings>; calm?: boolean;
  // ---- Milestone 13 (onboarding, UX and accessibility)
  /** the key bindings, as the Keys page left them (every action; cleaned on load) */
  binds?: unknown;
  /** the HUD's whole-number scale, or 0 for Auto (the largest that fits) */
  uiScale?: number;
  /** lesson cards on firsts (on unless turned off) */
  lessons?: boolean;
  /** the lessons each save has had, by the save's seed (the last few saves) */
  lessonsSeen?: Record<string, string[]>;
}

// ---------------------------------------------------------------- Milestone 13: keys, UI scale, lessons

/** The stored key bindings, cleaned (the defaults for anything missing or damaged). */
export function loadBinds(): Binds {
  return cleanBinds(read().binds);
}

/** Remember the key bindings (null: back to the defaults). */
export function saveBinds(b: Binds | null) {
  const s = read();
  if (b) s.binds = b;
  else delete s.binds;
  write(s);
}

/** The HUD's integer scale the player picked (0: Auto). */
export function uiScaleSetting(): number {
  const v = read().uiScale;
  return typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= 12 ? v : 0;
}

export function saveUiScale(v: number) {
  write({ ...read(), uiScale: Math.max(0, Math.min(12, Math.round(v))) });
}

/** The UI px the HUD needs at the least (the narrowest layout it is drawn for). */
export const UI_MIN_W = 480;
export const UI_MIN_H = 270;

/** The HUD scale for a canvas w x h px: Auto is the largest whole scale with 480x300 UI px (as it
 * always was); a picked scale is used up to the largest that leaves 480x270 (the narrowest layout
 * the HUD is checked at), so a big scale never squeezes the screen past it. */
export function uiScaleFor(w: number, h: number, pick: number = uiScaleSetting()): number {
  const auto = Math.max(1, Math.floor(Math.min(w / 480, h / 300)));
  if (!pick) return auto;
  return Math.max(1, Math.min(pick, maxUiScale(w, h)));
}

/** The largest HUD scale a w x h canvas can take. */
export function maxUiScale(w: number, h: number): number {
  return Math.max(1, Math.floor(Math.min(w / UI_MIN_W, h / UI_MIN_H)));
}

/** lesson cards on or off, as last read or set (read every frame: not parsed every frame) */
let lessonsCache: boolean | null = null;

/** Lesson cards on or off. */
export function lessonsOn(): boolean {
  if (lessonsCache === null) lessonsCache = read().lessons !== false;
  return lessonsCache;
}

export function saveLessonsOn(on: boolean) {
  lessonsCache = on;
  write({ ...read(), lessons: on });
}

/** The lessons a save (by its seed) has had. */
export function lessonsSeen(seed: number): string[] | null {
  const m = read().lessonsSeen;
  const l = m && typeof m === 'object' ? m[String(seed)] : undefined;
  return Array.isArray(l) ? l.filter((x): x is string => typeof x === 'string') : null;
}

/** Remember a save's lessons (the last 8 saves' are kept). */
export function saveLessonsSeen(seed: number, ids: string[]) {
  const s = read();
  const m = { ...(s.lessonsSeen && typeof s.lessonsSeen === 'object' ? s.lessonsSeen : {}) };
  delete m[String(seed)];
  m[String(seed)] = ids;
  const keys = Object.keys(m);
  for (const k of keys.slice(0, Math.max(0, keys.length - 8))) delete m[k];
  write({ ...s, lessonsSeen: m });
}

/** A stored sound setting made safe: every volume a number in 0..1 (to the nearest 5%), the
 *  defaults for anything missing or damaged. */
export function cleanSound(raw: unknown): SoundSettings {
  const o = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const vol = (k: 'master' | 'sfx' | 'amb' | 'ui') => {
    const v = o[k];
    return typeof v === 'number' && Number.isFinite(v) ? Math.round(Math.max(0, Math.min(1, v)) * 20) / 20 : SOUND_DEFAULT[k];
  };
  return { master: vol('master'), sfx: vol('sfx'), amb: vol('amb'), ui: vol('ui'), muted: o.muted === true };
}

/** The stored sound settings. */
export function soundSettings(): SoundSettings {
  return cleanSound(read().sound);
}

/** Remember the sound settings. */
export function saveSound(s: SoundSettings) {
  write({ ...read(), sound: cleanSound(s) });
}

/** Reduced motion as stored (off unless the player turned it on). */
export function calmSetting(): boolean {
  return read().calm === true;
}

export function saveCalm(on: boolean) {
  write({ ...read(), calm: on });
}

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
