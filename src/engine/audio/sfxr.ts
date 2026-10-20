// jsfxr sound bank: retro SFX stored as base58 strings (design one at https://sfxr.me, press
// "serialize", paste it here). Each sound is rendered once into the game's own AudioContext (so it
// obeys the SFX volume) and cached. Ids not in the bank keep their synthesized version in
// Audio.sfx. The bank is empty until Milestone 12 designs Foldworks' sounds.
import { sfxr } from 'jsfxr';

/** id -> base58 definition. */
export const SFXR_BANK: Record<string, string> = {};

/** Loudness per sound (base58 strings carry no volume). */
export const BANK_GAIN: Record<string, number> = {};

const cache = new Map<string, AudioBuffer>();

export function hasSfxr(id: string): boolean {
  return id in SFXR_BANK;
}

/** Render (once) and return the AudioBuffer for a bank sound, or null if it is not in the bank. */
export function sfxrBuffer(ctx: AudioContext, id: string): AudioBuffer | null {
  const def = SFXR_BANK[id];
  if (!def) return null;
  let buf = cache.get(def);
  if (!buf) {
    buf = sfxr.toWebAudio(def, ctx).buffer!;
    cache.set(def, buf);
  }
  return buf;
}

/** Play a bank sound through `bus`. `vol` scales loudness; `pitch` is a playback-rate multiplier. */
export function playSfxr(ctx: AudioContext, bus: AudioNode, id: string, vol = 1, pitch = 1): boolean {
  const buf = sfxrBuffer(ctx, id);
  if (!buf) return false;
  const src = ctx.createBufferSource();
  src.buffer = buf;
  src.playbackRate.value = pitch;
  const g = ctx.createGain();
  g.gain.value = vol * (BANK_GAIN[id] ?? 1);
  src.connect(g);
  g.connect(bus);
  src.start();
  return true;
}
