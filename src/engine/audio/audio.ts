// Procedural audio: buses with volumes, synthesized SFX from two primitives (a tone and filtered
// noise), the jsfxr bank first when it has the sound, and one ambient bed. Extracted from
// Sprocket & Sprout's engine layer by way of Trotline; the sounds are Foldworks' (placeholders
// until Milestone 12 designs the bank, but already distinct per event, because the click and the
// coin are half of an incremental game's feel). Nothing plays until unlock() runs from a user
// gesture (browsers require it).
import { playSfxr } from './sfxr';

export interface Vol { master: number; music: number; sfx: number }

type Env = { a: number; d: number; s?: number; r?: number };

/** a major pentatonic, so rapid coin chimes stay pleasant whatever order they land in */
const PENTA = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24];

export class Audio {
  ctx: AudioContext | null = null;
  master!: GainNode;
  musicBus!: GainNode;
  sfxBus!: GainNode;
  ambBus!: GainNode;
  noiseBuf!: AudioBuffer;
  vol: Vol;
  muted = false;
  private lastSfx = new Map<string, number>();
  /** pitch multiplier for the sound being synthesized (sfx's pitch argument) */
  private pm = 1;
  private hum: { src: AudioBufferSourceNode; g: GainNode; f: BiquadFilterNode; o: OscillatorNode; og: GainNode } | null = null;
  /** coin chimes climb a scale while they come quickly, then reset */
  private coinStep = 0;
  private coinAt = 0;

  constructor(settings: Vol = { master: 0.8, music: 0.6, sfx: 0.8 }) {
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
      this.musicBus = ctx.createGain();
      this.sfxBus = ctx.createGain();
      this.ambBus = ctx.createGain();
      this.musicBus.connect(this.master);
      this.sfxBus.connect(this.master);
      this.ambBus.connect(this.master);
      const len = ctx.sampleRate * 2;
      this.noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
      this.applyVol();
    } catch {
      this.ctx = null;
    }
  }

  applySettings(s: Vol) {
    this.vol = { ...s };
    this.applyVol();
  }

  setMuted(m: boolean) {
    this.muted = m;
    this.applyVol();
  }

  private applyVol() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(this.muted ? 0 : this.vol.master, t, 0.05);
    this.musicBus.gain.setTargetAtTime(this.vol.music * 0.24, t, 0.05);
    this.sfxBus.gain.setTargetAtTime(this.vol.sfx * 0.7, t, 0.05);
    this.ambBus.gain.setTargetAtTime(this.vol.sfx * 0.5, t, 0.05);
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

  /** Play a named sound effect. `v` scales volume; `pitch` multiplies the pitch. */
  sfx(id: string, v = 1, pitch = 1) {
    const ctx = this.ctx;
    if (!ctx || v <= 0.02) return;
    const now = ctx.currentTime;
    const gap = id === 'coin' ? 0.045 : 0.03;
    if (now - (this.lastSfx.get(id) ?? 0) < gap) return;
    this.lastSfx.set(id, now);
    const B = this.sfxBus;
    const r = () => 1 + (Math.random() - 0.5) * 0.08;
    if (playSfxr(ctx, B, id, 0.35 * v, r() * pitch)) return;
    this.pm = pitch;
    switch (id) {
      case 'click': this.tone(900 * r(), 'square', { a: 0.002, d: 0.04 }, 0.05 * v, B); break;
      case 'hover': this.tone(1500, 'sine', { a: 0.002, d: 0.02 }, 0.015 * v, B); break;
      case 'open': this.noise(0.1, 0.06 * v, 'bandpass', 900, 1, 0, 2); this.tone(520, 'triangle', { a: 0.01, d: 0.08 }, 0.05 * v, B, 0, 1.3); break;
      case 'close': this.noise(0.08, 0.05 * v, 'bandpass', 1400, 1, 0, 0.5); this.tone(620, 'triangle', { a: 0.01, d: 0.07 }, 0.04 * v, B, 0, 0.7); break;
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
      // coin: two quick square blips climbing a pentatonic scale while sales come fast
      case 'coin': {
        if (now - this.coinAt > 0.6) this.coinStep = 0;
        this.coinAt = now;
        const semis = PENTA[Math.min(PENTA.length - 1, this.coinStep++ >> 1)];
        const f0 = 990 * Math.pow(2, semis / 12);
        this.tone(f0, 'square', { a: 0.002, d: 0.05 }, 0.022 * v, B);
        this.tone(f0 * 1.5, 'square', { a: 0.002, d: 0.08 }, 0.02 * v, B, 0.045);
        break;
      }
      case 'buy': for (const [i, f] of [660, 880, 1320].entries()) this.tone(f, 'square', { a: 0.002, d: 0.07 }, 0.03 * v, B, i * 0.05); break;
      case 'land': this.tone(196, 'triangle', { a: 0.02, d: 0.4 }, 0.08 * v, B); for (const [i, f] of [392, 494, 587, 784].entries()) this.tone(f, 'triangle', { a: 0.005, d: 0.25 }, 0.05 * v, B, 0.1 + i * 0.08); break;
      case 'hopper': this.tone(420 * r(), 'sine', { a: 0.004, d: 0.08 }, 0.03 * v, B, 0, 1.4); break;
      case 'research': for (const [i, f] of [523, 659, 784, 1047, 1319].entries()) this.tone(f, 'triangle', { a: 0.01, d: 0.35 }, 0.06 * v, B, i * 0.09); this.noise(0.6, 0.05 * v, 'highpass', 6000, 1, 0.3); break;
      case 'order': for (const [i, f] of [392, 523, 659, 784, 1047].entries()) this.tone(f, 'square', { a: 0.005, d: 0.2 }, 0.04 * v, B, i * 0.08); break;
      case 'jam': this.tone(110, 'sawtooth', { a: 0.01, d: 0.25 }, 0.04 * v, B, 0, 0.8); this.tone(117, 'sawtooth', { a: 0.01, d: 0.25 }, 0.03 * v, B, 0.02, 0.8); break;
      case 'shovel': this.noise(0.12, 0.14 * v, 'lowpass', 900, 1, 0, 0.5); this.noise(0.05, 0.08 * v, 'bandpass', 2600, 2, 0.08); break;
      // a Spark appears: a high glittering run
      case 'spark': for (let i = 0; i < 5; i++) this.tone(1800 + i * 260, 'sine', { a: 0.002, d: 0.12 }, 0.02 * v, B, i * 0.04); break;
      case 'sparkGet': for (const [i, f] of [784, 988, 1175, 1568].entries()) this.tone(f, 'square', { a: 0.002, d: 0.12 }, 0.035 * v, B, i * 0.06); this.noise(0.4, 0.05 * v, 'highpass', 5000, 1, 0.1); break;
      // the fold: paper creasing (a swept noise) then a deep stamp
      case 'foldStart': this.noise(0.5, 0.12 * v, 'bandpass', 600, 1.5, 0, 6); this.tone(220, 'triangle', { a: 0.05, d: 0.4 }, 0.05 * v, B, 0, 2); break;
      case 'auditTick': this.tone(1200, 'sine', { a: 0.001, d: 0.03 }, 0.015 * v, B); break;
      case 'fold': this.noise(0.35, 0.16 * v, 'bandpass', 2400, 1, 0, 0.15); this.tone(90, 'sine', { a: 0.005, d: 0.5 }, 0.2 * v, B, 0.3, 0.5); this.noise(0.2, 0.15 * v, 'lowpass', 400, 1, 0.3, 0.5); break;
      case 'gradeS': for (const [i, f] of [523, 659, 784, 1047, 1319, 1568].entries()) this.tone(f, 'square', { a: 0.004, d: 0.3 }, 0.04 * v, B, i * 0.07); this.noise(0.8, 0.06 * v, 'highpass', 7000, 1, 0.35); break;
      case 'gradeA': for (const [i, f] of [523, 659, 784, 1047].entries()) this.tone(f, 'square', { a: 0.004, d: 0.28 }, 0.04 * v, B, i * 0.08); break;
      case 'gradeB': for (const [i, f] of [440, 554, 659].entries()) this.tone(f, 'triangle', { a: 0.004, d: 0.28 }, 0.05 * v, B, i * 0.09); break;
      case 'gradeC': for (const [i, f] of [392, 440].entries()) this.tone(f, 'triangle', { a: 0.004, d: 0.3 }, 0.05 * v, B, i * 0.12); break;
      case 'gradeD': for (const [i, f] of [330, 262].entries()) this.tone(f, 'triangle', { a: 0.004, d: 0.35 }, 0.05 * v, B, i * 0.14); break;
      case 'stamp': this.tone(120, 'square', { a: 0.002, d: 0.1 }, 0.08 * v, B, 0, 0.5); this.noise(0.1, 0.1 * v, 'bandpass', 1600, 2); break;
      case 'milestone': for (const [i, f] of [392, 494, 587, 784, 988, 1175].entries()) this.tone(f, 'triangle', { a: 0.01, d: 0.6 }, 0.06 * v, B, i * 0.12); break;
      case 'overdrive': this.tone(200, 'sawtooth', { a: 0.01, d: 0.4 }, 0.05 * v, B, 0, 3); this.noise(0.3, 0.08 * v, 'bandpass', 1200, 1, 0, 3); break;
      default: this.tone(600, 'sine', { a: 0.002, d: 0.05 }, 0.03 * v, B);
    }
    this.pm = 1;
  }

  /** The ambient bed: a low factory hum and hiss that grows with the number of working machines (0..1). */
  update(busy = 0) {
    const ctx = this.ctx;
    if (!ctx || ctx.state !== 'running') return;
    if (!this.hum) {
      const src = ctx.createBufferSource();
      src.buffer = this.noiseBuf;
      src.loop = true;
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = 300;
      const g = ctx.createGain();
      g.gain.value = 0;
      src.connect(f);
      f.connect(g);
      g.connect(this.ambBus);
      src.start();
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.value = 55;
      const og = ctx.createGain();
      og.gain.value = 0;
      o.connect(og);
      og.connect(this.ambBus);
      o.start();
      this.hum = { src, g, f, o, og };
    }
    const t = ctx.currentTime;
    this.hum.g.gain.setTargetAtTime(0.015 + busy * 0.05, t, 0.8);
    this.hum.og.gain.setTargetAtTime(busy * 0.025, t, 0.8);
  }
}
