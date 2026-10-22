// Skins (DESIGN.md §24, Milestone 11): the sheet a building, module or carrier is drawn with when the
// player has chosen a skin for its kind (`meta.skins[kind]`, the `skin` command). The art is
// `skin_<id>_<kind>` in src/art/; the Act V sheets spell a Mk2 kind in snake case
// (skin_candy_press_mk2) where `skinSprite` gives camel case (skin_candy_pressMk2), so both are
// looked up. A skin whose sheet is not drawn yet falls back to the building's own sprite: a choice
// never leaves a hole in the floor. Purely cosmetic: nothing here reads or changes the sim.
import type { Game } from '../sim/Game';
import { sheet, hasArt, spriteName, type SpriteSheet } from './sprites';

/** The sheet name of a skin on a slot, if its art exists (either spelling), else null. */
export function skinArt(id: string, slot: string): string | null {
  const a = `skin_${id}_${slot}`;
  if (hasArt(a)) return a;
  const b = `skin_${id}_${spriteName(slot)}`;
  if (hasArt(b)) return b;
  return null;
}

/** The skin chosen for a slot in this game (null: the plain sprite). */
export const skinChoice = (g: Game, slot: string): string | null => g.s.meta.skins?.[slot as never] ?? null;

/** The sheet to draw a `slot` with in this game: the chosen skin's when its art exists, else
 * `base` (the building's own sheet name). */
export function skinned(g: Game, slot: string, base: string): SpriteSheet {
  const id = skinChoice(g, slot);
  const name = id ? skinArt(id, slot) : null;
  return sheet(name ?? base);
}

/** The skinned sheet's name, or null when the plain sprite is drawn (for callers that test art). */
export function skinnedName(g: Game, slot: string): string | null {
  const id = skinChoice(g, slot);
  return id ? skinArt(id, slot) : null;
}
