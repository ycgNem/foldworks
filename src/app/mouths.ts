// How a Chute Mouth looks (DESIGN.md §21 The Chute), smoothed over the last moments: the sim pushes
// one item a tick when the belt in front has room, so its state flips between work and blocked
// many times a second while it runs fine. The pip, the animation and the report read this instead
// of the raw state: pushing (something left in the last 0.75 s), empty (the Chute holds none of
// its item: starved, naming it), blocked (its front has taken nothing for 0.75 s) or unset (no
// item picked yet). Presentation only; no imports beyond types.
import type { Ent } from '../sim/world';

export type MouthLook = 'push' | 'empty' | 'blocked' | 'unset';

const HOLD = 0.75;
const seen = new Map<number, { work: number; look: MouthLook }>();

/** Sample a Chute Mouth this frame (UI time `now`) and return how it looks. */
export function sampleMouth(e: Ent, now: number): MouthLook {
  let rec = seen.get(e.id);
  if (!rec) { rec = { work: -10, look: 'unset' }; seen.set(e.id, rec); }
  if (e.state === 'work') rec.work = now;
  if (rec.work > now) rec.work = -10; // a new game's clock
  rec.look = !e.recipe ? 'unset' : now - rec.work < HOLD ? 'push' : e.state === 'starved' ? 'empty' : e.state === 'blocked' ? 'blocked' : 'push';
  return rec.look;
}

/** How a Chute Mouth looked when last sampled (its raw state before the first sample). */
export function mouthLook(e: Ent): MouthLook {
  const rec = seen.get(e.id);
  if (rec) return !e.recipe ? 'unset' : rec.look;
  return !e.recipe ? 'unset' : e.state === 'starved' ? 'empty' : e.state === 'blocked' ? 'blocked' : 'push';
}
