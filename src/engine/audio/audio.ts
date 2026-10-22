// Procedural audio: four buses (master, and under it effects, ambience and UI; no music), sounds
// synthesized from two primitives (a tone and filtered noise), the jsfxr bank first when it has
// the sound, and the ambience bed (ambience.ts, mixed by mix.ts). Extracted from Sprocket &
// Sprout's engine layer by way of Trotline; the sounds are Foldworks' (Milestone 12): every
// chime is in C major, so whatever lands together (a coin run under a grade chime under a
// fanfare) stays in one key. Nothing is created and nothing plays until unlock() runs from a
// user gesture (browsers require it; tests/audio.test.ts checks it).
import { playSfxr } from './sfxr';
import { Ambience } from './ambience';
import type { Voice } from './mix';

/** Bus volumes, 0..1: everything, the game's effects, the machines and belts, the interface. */
export interface Vol { master: number; sfx: number; amb: number; ui: number }

export const VOL_DEFAULT: Vol = { master: 0.8, sfx: 0.8, amb: 0.6, ui: 0.7 };

type Env = { a: number; d: number; s?: number; r?: number };

/** a major pentatonic, so rapid coin chimes stay pleasant whatever order they land in */
const PENTA = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24, 26, 28];
/** the frequency `semis` semitones above middle C (every chime is in C major) */
const N = (semis: number) => 261.63 * Math.pow(2, semis / 12);
/** C6, the coin's root */
const C6 = N(24);

/** Sounds the interface makes (the UI bus): clicks, pages opening and closing, refusals. */
export const UI_SOUNDS: ReadonlySet<string> = new Set(['click', 'hover', 'open', 'close', 'tab', 'error', 'mode']);

/** Every named sound (the test plays each one through a fake context). */
export const SOUND_IDS = [
  'click', 'hover', 'open', 'close', 'error', 'mine', 'crank', 'bellows', 'place', 'belt', 'remove', 'rotate', 'coin', 'buy',
  'upgrade', 'land', 'hopper', 'research', 'order', 'jam', 'shovel', 'spark', 'sparkGet', 'foldStart', 'auditTick', 'fold',
  'gradeD', 'gradeC', 'gradeB', 'gradeA', 'gradeS', 'gradeS+', 'stamp', 'milestone', 'overdrive', 'mode', 'codex', 'kit', 'claim',
  'fanfare', 'megaStage', 'challengeWon', 'brownout', 'powerOn', 'whoosh', 'stampLand', 'tab',
] as const;

export class Audio {
  ctx: AudioContext | null = null;
  master!: GainNode;
  sfxBus!: GainNode;
  ambBus!: GainNode;
  uiBus!: GainNode;
  noiseBuf!: AudioBuffer;
  vol: Vol;
  muted = false;
  /** called when the volumes or the mute change (src/app/soundopts.ts keeps them) */
  onChange: (() => void) | null = null;
  /** the machines' and belts' voices */
  amb = new Ambience(this);
  private lastSfx = new Map<string, number>();
  /** pitch multiplier for the sound being synthesized (sfx's pitch argument) */
  private pm = 1;
  /** coin chimes climb a scale while they come quickly, then reset */
  private coinStep = 0;
  private coinAt = 0;

  constructor(settings: Vol = VOL_DEFAULT) {
    this.vol = { ...settings };
  }

  unlock() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    try {
      const AC = (window as any).AudioContext || (window as any).webkitAudioContext;
      if (!AC) return;
      const ctx: AudioContext = new AC();
      this.ctx = ctx;
      this.master = ctx.createGain();
      this.master.connect(ctx.destination);
      this.sfxBus = ctx.createGain();
      this.ambBus = ctx.createGain();
      this.uiBus = ctx.createGain();
      this.sfxBus.connect(this.master);
      this.ambBus.connect(this.master);
      this.uiBus.connect(this.master);
      const len = ctx.sampleRate * 2;
      this.noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
      this.applyVol();
    } catch {
      this.ctx = null;
    }
  }

  applySettings(s: Partial<Vol>) {
    this.vol = { ...this.vol, ...s };
    this.applyVol();
    this.onChange?.();
  }

  setMuted(m: boolean) {
    this.muted = m;
    this.applyVol();
    this.onChange?.();
  }

  private applyVol() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(this.muted ? 0 : this.vol.master, t, 0.05);
    this.sfxBus.gain.setTargetAtTime(this.vol.sfx * 0.7, t, 0.05);
    this.ambBus.gain.setTargetAtTime(this.vol.amb * 0.5, t, 0.05);
    this.uiBus.gain.setTargetAtTime(this.vol.ui * 0.7, t, 0.05);
  }

  /** The ambience bed: the voices mix() chose for what works on screen; `dt` seconds. */
  ambience(voices: readonly Voice[], dt: number) {
    this.amb.update(voices, dt);
  }

  // ---------------- primitives ----------------
  tone(freq: number, type: OscillatorType, env: Env, vol: number, bus: AudioNode = this.sfxBus, t0 = 0, slide = 0, detune = 0): OscillatorNode | null {
    const ctx = this.ctx;
    if (!ctx) return null;
    const t = ctx.currentTime + t0;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    freq *= this.pm;
    o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq * slide), t + env.a + env.d);
    if (detune) o.detune.value = detune;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + env.a);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0001, vol * (env.s ?? 0.001)), t + env.a + env.d);
    if (env.r) g.gain.exponentialRampToValueAtTime(0.0001, t + env.a + env.d + env.r);
    o.connect(g);
    g.connect(bus);
    o.start(t);
    o.stop(t + env.a + env.d + (env.r ?? 0) + 0.05);
    return o;
  }

  noise(dur: number, vol: number, filter: BiquadFilterType, freq: number, q = 1, t0 = 0, sweep = 0, bus?: AudioNode) {
    const ctx = this.ctx;
    if (!ctx) return;
    const t = ctx.currentTime + t0;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    src.playbackRate.value = 0.5 + Math.random();
    const f = ctx.createBiquadFilter();
    f.type = filter;
    freq *= this.pm;
    f.frequency.setValueAtTime(freq, t);
    if (sweep) f.frequency.exponentialRampToValueAtTime(Math.max(40, freq * sweep), t + dur);
    f.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f);
    f.connect(g);
    g.connect(bus ?? this.sfxBus);
    src.start(t, Math.random());
    src.stop(t + dur + 0.05);
  }

  /** An audit chime: `n` notes up the C pentatonic from step `from`, the last one held. Higher
   *  grades start higher and run longer (D two low notes; S+ six, from C5, with a bell). */
  private chime(from: number, n: number, v: number, bright: boolean, B: AudioNode) {
    const gap = 0.12 - n * 0.008;
    for (let i = 0; i < n; i++) {
      const f = N(PENTA[from + i]);
      const last = i === n - 1;
      const d = last ? 0.55 : 0.22;
      this.tone(f, 'triangle', { a: 0.004, d }, 0.05 * v, B, i * gap);
      if (bright) this.tone(f, 'square', { a: 0.004, d: d * 0.6 }, 0.016 * v, B, i * gap);
    }
    if (n >= 5) this.noise(0.7, 0.04 * v, 'highpass', 7000, 1, n * gap);
  }

  /** Play a named sound effect. `v` scales volume; `pitch` multiplies the pitch. */
  sfx(id: string, v = 1, pitch = 1) {
    const ctx = this.ctx;
    if (!ctx || v <= 0.02) return;
    const now = ctx.currentTime;
    const gap = id === 'coin' ? 0.045 : 0.03;
    if (now - (this.lastSfx.get(id) ?? 0) < gap) return;
    this.lastSfx.set(id, now);
    const B = UI_SOUNDS.has(id) ? this.uiBus : this.sfxBus;
    const r = () => 1 + (Math.random() - 0.5) * 0.08;
    if (playSfxr(ctx, B, id, 0.35 * v, r() * pitch)) return;
    this.pm = pitch;
    switch (id) {
      case 'click': this.tone(900 * r(), 'square', { a: 0.002, d: 0.04 }, 0.05 * v, B); break;
      case 'hover': this.tone(1500, 'sine', { a: 0.002, d: 0.02 }, 0.015 * v, B); break;
      case 'open': this.noise(0.1, 0.06 * v, 'bandpass', 900, 1, 0, 2, B); this.tone(520, 'triangle', { a: 0.01, d: 0.08 }, 0.05 * v, B, 0, 1.3); break;
      case 'close': this.noise(0.08, 0.05 * v, 'bandpass', 1400, 1, 0, 0.5, B); this.tone(620, 'triangle', { a: 0.01, d: 0.07 }, 0.04 * v, B, 0, 0.7); break;
      case 'error': this.tone(140, 'square', { a: 0.005, d: 0.18 }, 0.06 * v, B, 0, 0.8); break;
      // a pick on rock: a short noise crack and a low knock
      case 'mine': this.noise(0.06, 0.16 * v, 'bandpass', 2400 * r(), 2, 0, 0.5); this.tone(180 * r(), 'triangle', { a: 0.002, d: 0.07 }, 0.08 * v, B, 0, 0.6); break;
      // the crank: a ratchet tick that rises with the furnace's progress (pitch)
      case 'crank': this.noise(0.03, 0.1 * v, 'highpass', 3000, 1); this.tone(320 * r(), 'square', { a: 0.001, d: 0.03 }, 0.035 * v, B, 0, 1.2); break;
      // bellows: one breath of air
      case 'bellows': this.noise(0.5, 0.18 * v, 'bandpass', 500, 0.8, 0, 3); break;
      // building: a solid thunk and a bolt being tightened
      case 'place': this.tone(140 * r(), 'triangle', { a: 0.002, d: 0.09 }, 0.1 * v, B, 0, 0.7); this.noise(0.05, 0.08 * v, 'bandpass', 3500, 3, 0.05); break;
      case 'belt': this.noise(0.04, 0.06 * v, 'bandpass', 1800 * r(), 2); break;
      case 'remove': this.tone(260, 'triangle', { a: 0.002, d: 0.08 }, 0.06 * v, B, 0, 0.5); this.noise(0.08, 0.06 * v, 'lowpass', 1200, 1, 0, 0.4); break;
      case 'rotate': this.tone(700 * r(), 'square', { a: 0.001, d: 0.03 }, 0.03 * v, B, 0, 1.3); break;
      // coin: two quick square blips climbing the C pentatonic while sales come fast
      case 'coin': {
        if (now - this.coinAt > 0.6) this.coinStep = 0;
        this.coinAt = now;
        const semis = PENTA[Math.min(PENTA.length - 1, this.coinStep++ >> 1)];
        const f0 = C6 * Math.pow(2, semis / 12);
        this.tone(f0, 'square', { a: 0.002, d: 0.05 }, 0.022 * v, B);
        this.tone(f0 * 1.5, 'square', { a: 0.002, d: 0.08 }, 0.02 * v, B, 0.045);
        break;
      }
      case 'buy': for (const [i, f] of [N(19), N(24), N(31)].entries()) this.tone(f, 'square', { a: 0.002, d: 0.07 }, 0.03 * v, B, i * 0.05); break;
      // an upgrade (claims staked, a Patent bought): a ratchet turned twice, then the buy's chime
      case 'upgrade':
        for (const t of [0, 0.06]) this.tone(1200, 'square', { a: 0.001, d: 0.015 }, 0.03 * v, B, t);
        for (const [i, f] of [N(16), N(19), N(24), N(28)].entries()) this.tone(f, 'square', { a: 0.002, d: 0.09 }, 0.028 * v, B, 0.12 + i * 0.05);
        break;
      case 'land': this.tone(196, 'triangle', { a: 0.02, d: 0.4 }, 0.08 * v, B); for (const [i, f] of [392, 494, 587, 784].entries()) this.tone(f, 'triangle', { a: 0.005, d: 0.25 }, 0.05 * v, B, 0.1 + i * 0.08); break;
      case 'hopper': this.tone(420 * r(), 'sine', { a: 0.004, d: 0.08 }, 0.03 * v, B, 0, 1.4); break;
      // research done: a bright arpeggio up the C chord and a glitter of air (the lab's bell)
      case 'research':
        for (const [i, f] of [N(12), N(16), N(19), N(24), N(28)].entries()) this.tone(f, 'triangle', { a: 0.01, d: 0.35 }, 0.06 * v, B, i * 0.09);
        this.tone(N(36), 'sine', { a: 0.004, d: 0.6 }, 0.025 * v, B, 0.45);
        this.noise(0.6, 0.05 * v, 'highpass', 6000, 1, 0.3);
        break;
      // an order filled: the till's two-note ring, then the run up to the top C
      case 'order':
        this.tone(N(31), 'square', { a: 0.002, d: 0.06 }, 0.03 * v, B);
        this.tone(N(36), 'square', { a: 0.002, d: 0.1 }, 0.03 * v, B, 0.06);
        for (const [i, f] of [N(7), N(12), N(16), N(19), N(24)].entries()) this.tone(f, 'square', { a: 0.005, d: 0.2 }, 0.035 * v, B, 0.16 + i * 0.08);
        break;
      case 'jam': this.tone(110, 'sawtooth', { a: 0.01, d: 0.25 }, 0.04 * v, B, 0, 0.8); this.tone(117, 'sawtooth', { a: 0.01, d: 0.25 }, 0.03 * v, B, 0.02, 0.8); break;
      case 'shovel': this.noise(0.12, 0.14 * v, 'lowpass', 900, 1, 0, 0.5); this.noise(0.05, 0.08 * v, 'bandpass', 2600, 2, 0.08); break;
      // a Spark appears: a high glittering run up the pentatonic
      case 'spark': for (let i = 0; i < 5; i++) this.tone(N(PENTA[5 + i] + 12), 'sine', { a: 0.002, d: 0.12 }, 0.02 * v, B, i * 0.04); break;
      // a Spark caught: the run caught in a G chord, and a burst of glitter
      case 'sparkGet': for (const [i, f] of [784, 988, 1175, 1568].entries()) this.tone(f, 'square', { a: 0.002, d: 0.12 }, 0.035 * v, B, i * 0.06); this.noise(0.4, 0.05 * v, 'highpass', 5000, 1, 0.1); break;
      // the fold box dropped and the audit starting: paper creasing (a swept noise), a rising tone
      case 'foldStart': this.noise(0.5, 0.12 * v, 'bandpass', 600, 1.5, 0, 6); this.tone(220, 'triangle', { a: 0.05, d: 0.4 }, 0.05 * v, B, 0, 2); break;
      case 'auditTick': this.tone(1200, 'sine', { a: 0.001, d: 0.03 }, 0.015 * v, B); break;
      case 'fold': this.pm = 1; this.foldSound(true, v); break;
      // the audit chimes, rising with the grade
      case 'gradeD': this.chime(0, 2, v, false, B); break;
      case 'gradeC': this.chime(1, 3, v, false, B); break;
      case 'gradeB': this.chime(2, 3, v, false, B); break;
      case 'gradeA': this.chime(3, 4, v, true, B); break;
      // S; asked a third up (the fold card's S+ celebration) it is the S+ chime
      case 'gradeS':
        if (pitch > 1.2) { this.pm = 1; this.chime(5, 6, v, true, B); this.tone(N(36), 'sine', { a: 0.004, d: 1 }, 0.03 * v, B, 0.5); }
        else this.chime(4, 5, v, true, B);
        break;
      case 'gradeS+': this.chime(5, 6, v, true, B); this.tone(N(36), 'sine', { a: 0.004, d: 1 }, 0.03 * v, B, 0.5); break;
      case 'stamp': this.tone(120, 'square', { a: 0.002, d: 0.1 }, 0.08 * v, B, 0, 0.5); this.noise(0.1, 0.1 * v, 'bandpass', 1600, 2); break;
      case 'milestone': for (const [i, f] of [392, 494, 587, 784, 988, 1175].entries()) this.tone(f, 'triangle', { a: 0.01, d: 0.6 }, 0.06 * v, B, i * 0.12); break;
      // Overdrive: a rising turbine whine, a spark crackle and a bright top note
      case 'overdrive':
        this.tone(160, 'sawtooth', { a: 0.01, d: 0.45 }, 0.05 * v, B, 0, 4);
        this.tone(320, 'square', { a: 0.01, d: 0.3 }, 0.025 * v, B, 0.05, 3);
        this.noise(0.35, 0.09 * v, 'bandpass', 1200, 1, 0, 4);
        this.noise(0.12, 0.06 * v, 'highpass', 5000, 1, 0.3);
        this.tone(1568, 'square', { a: 0.002, d: 0.12 }, 0.025 * v, B, 0.38);
        break;
      // a mode change: a two-click dial turn
      case 'mode': this.tone(1100, 'square', { a: 0.001, d: 0.025 }, 0.03 * v, B); this.tone(1400, 'square', { a: 0.001, d: 0.03 }, 0.03 * v, B, 0.06); break;
      // the Codex pays: a cascade of coins down a scale, then a chime
      case 'codex':
        for (let i = 0; i < 8; i++) this.tone(C6 * Math.pow(2, PENTA[i] / 12), 'square', { a: 0.002, d: 0.06 }, 0.025 * v, B, i * 0.045);
        this.tone(N(36), 'triangle', { a: 0.004, d: 0.4 }, 0.04 * v, B, 0.38);
        break;
      // a Machine Kit lands in the parts bank: a wooden crate clunk and a latch
      case 'kit': this.tone(110, 'triangle', { a: 0.002, d: 0.12 }, 0.12 * v, B, 0, 0.7); this.noise(0.06, 0.1 * v, 'bandpass', 800, 2); this.tone(1800, 'square', { a: 0.001, d: 0.02 }, 0.03 * v, B, 0.09); break;
      // claims staked: a mallet on a stake, twice, then a little flourish
      case 'claim':
        for (const t of [0, 0.16]) { this.tone(150, 'triangle', { a: 0.002, d: 0.1 }, 0.12 * v, B, t, 0.6); this.noise(0.05, 0.1 * v, 'bandpass', 2000, 2, t); }
        for (const [i, f] of [659, 784, 988].entries()) this.tone(f, 'square', { a: 0.003, d: 0.12 }, 0.03 * v, B, 0.36 + i * 0.07);
        break;
      // a celebration: a drum roll and a big brass chord
      case 'fanfare':
        for (let i = 0; i < 10; i++) this.noise(0.05, (0.05 + i * 0.008) * v, 'lowpass', 600, 1, i * 0.045);
        for (const f of [262, 330, 392, 523]) this.tone(f, 'sawtooth', { a: 0.02, d: 0.9 }, 0.022 * v, B, 0.48, 1, 6);
        for (const [i, f] of [784, 1047, 1319, 1568].entries()) this.tone(f, 'square', { a: 0.004, d: 0.3 }, 0.025 * v, B, 0.5 + i * 0.1);
        this.noise(1, 0.05 * v, 'highpass', 6000, 1, 0.6);
        break;
      // a Megaproject stage built (under the fanfare): the structure locking into place, a deep
      // boom and two clanks, and a great bell tolling after the brass
      case 'megaStage':
        this.tone(55, 'sine', { a: 0.004, d: 1.1 }, 0.26 * v, B, 0, 0.55);
        this.noise(0.9, 0.14 * v, 'lowpass', 420, 1, 0, 0.4);
        for (const t of [0.02, 0.17]) { this.tone(220, 'square', { a: 0.001, d: 0.06 }, 0.04 * v, B, t, 0.7); this.noise(0.05, 0.08 * v, 'bandpass', 2200, 3, t); }
        for (const [f, vol, d] of [[N(0), 0.07, 2.2], [N(7), 0.035, 1.8], [N(12), 0.035, 1.5], [N(16) * 1.003, 0.02, 1.2]] as const)
          this.tone(f, 'triangle', { a: 0.004, d }, vol * v, B, 1.35);
        break;
      // a Challenge won: a G-chord run up in the reset's own violet register, a ta-da, glitter
      case 'challengeWon':
        for (const [i, f] of [N(7), N(11), N(14), N(19), N(23), N(26)].entries()) this.tone(f, 'triangle', { a: 0.004, d: 0.3 }, 0.05 * v, B, i * 0.07);
        this.tone(N(24), 'square', { a: 0.003, d: 0.12 }, 0.035 * v, B, 0.5);
        this.tone(N(31), 'square', { a: 0.003, d: 0.5 }, 0.035 * v, B, 0.62);
        this.noise(0.8, 0.05 * v, 'highpass', 6500, 1, 0.6);
        break;
      // a grid browns out: a sagging electric fizz
      case 'brownout': this.tone(120, 'sawtooth', { a: 0.01, d: 0.35 }, 0.035 * v, B, 0, 0.6); this.noise(0.3, 0.05 * v, 'bandpass', 3000, 4, 0, 0.3); break;
      // a Pole goes up: a rising hum and a click of contact
      case 'powerOn': this.tone(60, 'sawtooth', { a: 0.05, d: 0.25 }, 0.04 * v, B, 0, 2); this.tone(2400, 'square', { a: 0.001, d: 0.02 }, 0.02 * v, B, 0.22); break;
      // paper swishing inward (kept for callers; the fold's own sound carries its crease)
      case 'whoosh': this.noise(0.45, 0.12 * v, 'bandpass', 500, 1.2, 0, 6); break;
      // the folded module lands: a thump and a ding
      case 'stampLand': this.tone(80, 'sine', { a: 0.003, d: 0.25 }, 0.18 * v, B, 0, 0.6); this.tone(N(28) * 1.0, 'triangle', { a: 0.003, d: 0.3 }, 0.04 * v, B, 0.05); break;
      // a store tab with something new
      case 'tab': this.tone(N(24) * 1.26, 'triangle', { a: 0.002, d: 0.08 }, 0.03 * v, B); this.tone(N(31), 'triangle', { a: 0.002, d: 0.1 }, 0.03 * v, B, 0.06); break;
      default: this.tone(600, 'sine', { a: 0.002, d: 0.05 }, 0.03 * v, B);
    }
    this.pm = 1;
  }

  /** The fold, the game's signature: a line becoming one tile. Timed to the Workshop's fold
   *  animation (src/render/fx.ts: 1.3 s, the flash at 0.68 of it): the crease drawn along the
   *  paper, four corners flapping in, then two notes an octave and a fourth apart sliding
   *  together into one C (many machines becoming one tile), the snap at the flash (a deep
   *  thump and a bell), and the module's landing (stampLand, the renderer's). With
   *  `animated` false (the Factory and District folds, which burst at once) the same sound
   *  plays in a fifth of the time. */
  foldSound(animated = true, v = 1) {
    if (!this.ctx) return;
    const B = this.sfxBus;
    const k = animated ? 1 : 0.2;
    const snap = 0.884 * k;
    // the crease: noise drawn up along the fold
    this.noise(0.26 * k + 0.04, 0.1 * v, 'bandpass', 700, 1.4, 0, 4, B);
    // the corners: four paper flaps, each a little higher
    for (let i = 0; i < 4; i++) {
      const t = (0.26 + i * 0.09) * k;
      this.noise(0.05, 0.08 * v, 'bandpass', 1200 + i * 300, 2, t, 0.6, B);
      this.tone(N(PENTA[i]) * 2, 'triangle', { a: 0.002, d: 0.04 }, 0.02 * v, B, t);
    }
    // the converge: G3 rising and C5 falling into one C4, swelling toward the snap
    const glide = Math.max(0.06, 0.26 * k);
    this.tone(N(-5), 'triangle', { a: glide, d: 0.03 }, 0.07 * v, B, snap - glide, N(0) / N(-5));
    this.tone(N(12), 'triangle', { a: glide, d: 0.03 }, 0.05 * v, B, snap - glide, N(0) / N(12));
    // the snap: a deep thump, a slap of paper, and a bell on C
    this.tone(92, 'sine', { a: 0.003, d: 0.45 }, 0.22 * v, B, snap, 0.5);
    this.noise(0.15, 0.14 * v, 'lowpass', 520, 1, snap, 0.5, B);
    this.tone(N(12), 'triangle', { a: 0.003, d: 0.9 }, 0.06 * v, B, snap);
    this.tone(N(19), 'sine', { a: 0.003, d: 0.7 }, 0.03 * v, B, snap + 0.01);
    this.tone(N(24), 'sine', { a: 0.003, d: 0.5 }, 0.02 * v, B, snap + 0.02);
    this.noise(0.45, 0.03 * v, 'highpass', 6500, 1, snap + 0.05, 0, B);
  }

  /** A reset: layer 1 Reorganize, 2 Relocate, 3 the Last Fold (the Act IV and V screens call it
   *  for theirs). Each is the one before and more: what was built sweeps away (a falling
   *  sawtooth and a hiss), Relocate adds a deep boom (a whole world left), the Last Fold a long
   *  swell under it; then the new run rises, a C major-seventh arpeggio one note longer per
   *  layer, ending on a bell. */
  resetSound(layer: 1 | 2 | 3, v = 1) {
    if (!this.ctx) return;
    const B = this.sfxBus;
    this.tone(880, 'sawtooth', { a: 0.01, d: 0.55 }, 0.03 * v, B, 0, 0.25);
    this.noise(0.6, 0.08 * v, 'bandpass', 3000, 1.2, 0, 0.15, B);
    if (layer >= 2) this.tone(55, 'sine', { a: 0.01, d: 1.3 }, 0.24 * v, B, 0.45, 0.5);
    if (layer >= 3) this.tone(65.4, 'sawtooth', { a: 1.1, d: 0.5 }, 0.035 * v, B, 0, 4);
    const t0 = 0.55 + (layer - 1) * 0.3;
    const steps = [0, 4, 7, 11, 12, 16, 19, 23, 24].slice(0, 4 + layer * 2 - 1);
    steps.forEach((s, i) => this.tone(N(s), 'triangle', { a: 0.005, d: 0.4 }, 0.05 * v, B, t0 + i * 0.07));
    const end = t0 + steps.length * 0.07;
    this.tone(N(steps[steps.length - 1] + 12), 'sine', { a: 0.004, d: 1.2 }, 0.035 * v, B, end);
    this.noise(0.8, 0.04 * v, 'highpass', 6500, 1, end, 0, B);
  }
}
