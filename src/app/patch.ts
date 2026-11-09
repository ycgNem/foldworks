// This update's name and its notes for the What's new card (whatsnew.ts). Constants only, no screen
// registered here, so Options (access.ts) can name the update without an import cycle.

/** this update's id: a browser that has seen its card has `patchSeen` equal to it */
export const PATCH_ID = '2026-11-08';
export const PATCH_NAME = 'The Playability Update';

/** One line a bullet: rich text, short (the card is read, not studied). */
export const WHATS_NEW: string[] = [
  '{u:fold} {good:Fold in the first minutes}: Folding is the second research · the box grows with research · the first copy is free',
  '{u:reset} {good:Reorganize keeps what you learned}: Acts I-II research and your Drawer designs stay · old orders stay filled',
  '{u:mega} {good:An ending}: finish the Floating City and the story ends, with credits (the World goes on after)',
  '{u:district} {good:The District routes itself}: a placed group draws its own routes · only problems show a dot',
  '{u:build} {good:Easier hands}: drag empty ground to pan · {k:Shift}+{k:R} turns back · names on the build wheel',
  '{u:stats} {good:A calmer screen}: floor buttons with names · the bell is the one place for trouble · trophies batched',
  '{u:remove} {good:Fewer things to track}: Machine Kits, machine modes, Inspiration and the Lucky Vein are gone',
  '{u:research} income never stops for research: the Hopper pays like the Dock until your first fold',
  '{u:factory} modules say what they need and how to feed them · a full Chute no longer jams the Factory',
  '{u:lock} fixes: two open tabs no longer overwrite a save · New game asks first · Challenges wait for the ending',
];
