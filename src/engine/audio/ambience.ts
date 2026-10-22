// The ambience bed (Milestone 12): one quiet voice per family the mixer (mix.ts) lets sound, each
// a small Web Audio chain (a loop, ticks, or both) into its own gain and stereo pan, then the
// ambience bus. Voices are built the first time their family sounds and kept (silent when their
// family is not on screen), so a busy floor costs a dozen nodes, not one per machine.
//
// What each family sounds like, by the motion STYLE.md gives it:
// - miner: the drill's faint whirr and a soft pick knock now and then
// - smelter (furnaces, Mk2): the fire's low roar breathing, a crackle
// - press: the ram's thump and the hiss after it
// - assembler: two small ratchet clicks, an arm reaching
// - kiln (kilns, mixers, refineries): a churning drone, the drum's slow wobble
// - chem (Chem Vats): bubbles, random pitches rising
// - green (Greenhouses): a mist hiss and a drip
// - power (boilers, engines, generators): the grid's 50 Hz hum and a steam chuff
// - belt: rollers, a band of noise with a light rattle
// - module (Factory, District): a low pulse, two notes a fifth apart
// - skiff (the District's routes): a rotor whirr, a buzz chopped by the blades
import type { Audio } from './audio';
import { tickGap, type Fam, type Voice } from './mix';

interface VoiceNode {
  gain: GainNode;
  pan: StereoPannerNode | null;
  /** seconds to its next tick */
  next: number;
  n: number;
  level: number;
}

/** each family's loudness at a full voice, before the ambience bus */
const GAIN: Record<Fam, number> = { miner: 0.5, smelter: 0.55, press: 0.5, assembler: 0.45, kiln: 0.4, chem: 0.45, green: 0.4, power: 0.4, belt: 0.32, module: 0.5, skiff: 0.32 };
/** seconds between ticks for the ticking families (tickGap shortens it as more work) */
const TICK: Partial<Record<Fam, number>> = { miner: 0.6, smelter: 0.55, press: 0.95, assembler: 0.5, chem: 0.3, green: 1.9, power: 1.15 };

export class Ambience {
  private v = new Map<Fam, VoiceNode>();

  constructor(private a: Audio) {}

  /** The families sounding now (from mix()); `dt` seconds since the last call. Families absent
   *  from `voices` fade out. */
  update(voices: readonly Voice[], dt: number) {
    const ctx = this.a.ctx;
    if (!ctx || ctx.state !== 'running') return;
    const t = ctx.currentTime;
    const on = new Set<Fam>();
    for (const vc of voices) {
      if (vc.level < 0.005) continue;
      on.add(vc.fam);
      let node = this.v.get(vc.fam);
      if (!node) {
        node = this.build(ctx, vc.fam);
        this.v.set(vc.fam, node);
      }
      node.n = vc.n;
      node.level = vc.level;
      node.gain.gain.setTargetAtTime(vc.level * GAIN[vc.fam], t, 0.35);
      node.pan?.pan.setTargetAtTime(vc.pan, t, 0.4);
    }
    for (const [fam, node] of this.v) {
      if (!on.has(fam)) {
        if (node.level > 0) node.gain.gain.setTargetAtTime(0, t, 0.5);
        node.level = 0;
        continue;
      }
      const base = TICK[fam];
      if (base === undefined) continue;
      node.next -= dt;
      if (node.next <= 0) {
        this.tick(fam, node.gain);
        // a little jitter so a hall of machines never ticks like a metronome
        node.next = tickGap(base, node.n) * (0.7 + Math.random() * 0.6);
      }
    }
  }

  /** Silence every voice (the title screen, a hidden tab). */
  hush() {
    const ctx = this.a.ctx;
    if (!ctx) return;
    for (const node of this.v.values()) {
      node.gain.gain.setTargetAtTime(0, ctx.currentTime, 0.3);
      node.level = 0;
    }
  }

  /** The families with a voice built (tests and the debug handle). */
  built(): Fam[] {
    return [...this.v.keys()];
  }

  private build(ctx: AudioContext, fam: Fam): VoiceNode {
    const gain = ctx.createGain();
    gain.gain.value = 0;
    let pan: StereoPannerNode | null = null;
    if (typeof ctx.createStereoPanner === 'function') {
      pan = ctx.createStereoPanner();
      gain.connect(pan);
      pan.connect(this.a.ambBus);
    } else gain.connect(this.a.ambBus);
    this.bed(ctx, fam, gain);
    return { gain, pan, next: Math.random() * 0.4, n: 1, level: 0 };
  }

  // ---------------------------------------------------------------- the loops

  private loopNoise(ctx: AudioContext, type: BiquadFilterType, freq: number, q: number, vol: number, out: AudioNode): GainNode {
    const src = ctx.createBufferSource();
    src.buffer = this.a.noiseBuf;
    src.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    const g = ctx.createGain();
    g.gain.value = vol;
    src.connect(f);
    f.connect(g);
    g.connect(out);
    src.start(ctx.currentTime, Math.random() * 1.5);
    return g;
  }

  private osc(ctx: AudioContext, type: OscillatorType, freq: number, vol: number, out: AudioNode): GainNode {
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.value = vol;
    o.connect(g);
    g.connect(out);
    o.start();
    return g;
  }

  /** A slow wobble on a gain: base +- depth at `hz`. */
  private wobble(ctx: AudioContext, g: GainNode, hz: number, depth: number) {
    const l = ctx.createOscillator();
    l.frequency.value = hz;
    const lg = ctx.createGain();
    lg.gain.value = depth;
    l.connect(lg);
    lg.connect(g.gain);
    l.start(ctx.currentTime + Math.random());
  }

  private bed(ctx: AudioContext, fam: Fam, out: GainNode) {
    switch (fam) {
      case 'miner': this.loopNoise(ctx, 'bandpass', 1500, 3, 0.05, out); break;
      case 'smelter': { const g = this.loopNoise(ctx, 'lowpass', 320, 0.7, 0.32, out); this.wobble(ctx, g, 0.6, 0.12); break; }
      case 'kiln': {
        this.osc(ctx, 'triangle', 98, 0.07, out);
        const g = this.loopNoise(ctx, 'bandpass', 700, 2, 0.16, out);
        this.wobble(ctx, g, 1.7, 0.07);
        break;
      }
      case 'green': this.loopNoise(ctx, 'highpass', 5200, 0.7, 0.06, out); break;
      case 'power': {
        const hum = ctx.createBiquadFilter();
        hum.type = 'lowpass';
        hum.frequency.value = 170;
        hum.connect(out);
        this.osc(ctx, 'sawtooth', 50, 0.16, hum);
        this.osc(ctx, 'sine', 100, 0.05, out);
        break;
      }
      case 'belt': { const g = this.loopNoise(ctx, 'bandpass', 420, 0.8, 0.3, out); this.wobble(ctx, g, 9, 0.06); break; }
      case 'module': {
        // a pulse: two notes a fifth apart, swelling and falling at 1.2 Hz
        const p = ctx.createGain();
        p.gain.value = 0.5;
        p.connect(out);
        this.wobble(ctx, p, 1.2, 0.5);
        this.osc(ctx, 'sine', 55, 0.22, p);
        this.osc(ctx, 'sine', 82.5, 0.08, p);
        break;
      }
      case 'skiff': {
        // the rotor: a low buzz and a breath of air, chopped by the blades
        const chop = ctx.createGain();
        chop.gain.value = 0.55;
        chop.connect(out);
        this.wobble(ctx, chop, 17, 0.45);
        const bp = ctx.createBiquadFilter();
        bp.type = 'bandpass';
        bp.frequency.value = 520;
        bp.Q.value = 1.4;
        bp.connect(chop);
        this.osc(ctx, 'sawtooth', 86, 0.12, bp);
        this.loopNoise(ctx, 'highpass', 2400, 0.7, 0.05, chop);
        break;
      }
      default: break; // presses, assemblers and Chem Vats only tick
    }
  }

  // ---------------------------------------------------------------- the ticks

  private tick(fam: Fam, out: GainNode) {
    const a = this.a;
    const r = () => 1 + (Math.random() - 0.5) * 0.12;
    switch (fam) {
      case 'miner':
        a.noise(0.035, 0.22, 'bandpass', 2200 * r(), 2, 0, 0.5, out);
        a.tone(165 * r(), 'triangle', { a: 0.002, d: 0.06 }, 0.1, out, 0, 0.6);
        break;
      case 'smelter': a.noise(0.016, 0.07, 'highpass', 4200 * r(), 1, 0, 0, out); break;
      case 'press':
        a.tone(72 * r(), 'sine', { a: 0.003, d: 0.14 }, 0.32, out, 0, 0.6);
        a.noise(0.14, 0.07, 'highpass', 3000, 1, 0.07, 0.7, out);
        break;
      case 'assembler':
        a.tone(1400 * r(), 'square', { a: 0.001, d: 0.012 }, 0.035, out);
        a.tone(1750 * r(), 'square', { a: 0.001, d: 0.012 }, 0.03, out, 0.09);
        break;
      case 'chem': a.tone(280 + Math.random() * 360, 'sine', { a: 0.006, d: 0.07 }, 0.09, out, 0, 1.8); break;
      case 'green': a.tone(1300 * r(), 'sine', { a: 0.002, d: 0.09 }, 0.05, out, 0, 0.5); break;
      case 'power': a.noise(0.2, 0.1, 'bandpass', 900 * r(), 1, 0, 0.6, out); break;
      default: break;
    }
  }
}
