// Skins (DESIGN.md §24, Milestone 11): the sheet a building, module or carrier is drawn with when the
// player has chosen a skin for its kind (`meta.skins[kind]`, the `skin` command). The rule
// (docs/endgame.md "Milestone 11 skins as built"): wherever the renderer draws base sheet X for a
// skinned kind, it draws `skin_<id>_X` when that sheet exists, with the same frame, facing, anchor
// and position; X is the base sheet's own snake_case name (steam_engine, press_mk2, dist_module,
// belt_turn, dock_lily's skin is the dock's), <id> as cosmetics.ts spells it. A skin without a sheet
// falls back to the base: a choice never leaves a hole in the floor. Pips, glows and overlays still
// draw on top (the callers draw them after). Purely cosmetic: nothing here reads or changes the sim.
import type { Game } from '../sim/Game';
import { sheet, hasArt, spriteName, type SpriteSheet } from './sprites';

/** The skin chosen for a slot in this game (null: the plain sprite). */
export const skinChoice = (g: Game, slot: string): string | null => g.s.meta.skins?.[slot as never] ?? null;

/** The sheet name to draw for base sheet `base` of a skinned `slot`: `skin_<id>_<base>` when the
 * skin is chosen and its sheet exists, else `base`. */
export function skinName(g: Game, slot: string, base: string): string {
  const id = skinChoice(g, slot);
  if (!id) return base;
  const n = `skin_${id}_${base}`;
  return hasArt(n) ? n : base;
}

/** The sheet itself (see skinName). */
export const skinned = (g: Game, slot: string, base: string): SpriteSheet => sheet(skinName(g, slot, base));

/** A skin's sheet on a slot's own base sheet (the Wardrobe's and the picker's previews), or null
 * when its art does not exist. */
export function skinArt(id: string, slot: string): string | null {
  const n = `skin_${id}_${spriteName(slot)}`;
  return hasArt(n) ? n : null;
}
