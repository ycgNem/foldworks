// Screen-feel: coin pops, particles, rings, flying coins and shake. Purely presentation: the
// renderer turns the sim's events into these, and they never touch the sim. Pooled arrays, no
// allocation per frame once warm.
import { C } from '../data/palette';

export interface Particle { x: number; y: number; vx: number; vy: number; life: number; max: number; color: string; size: number; grav: number; /** drag per second (smoke slows down) */ drag?: number }
export interface Pop { x: number; y: number; text: string; color: string; life: number; max: number; value: number; key: string; icon: string | null; big: boolean }
export interface Ring { x: number; y: number; life: number; max: number; color: string; r0: number; r1: number }
/** something flying from the world (screen px) to a HUD target: a coin, or an icon (an item id,
 *  'kit' for a Machine Kit, 'module' for a folded line) */
export interface Flyer { x0: number; y0: number; x1: number; y1: number; t: number; dur: number; arc: number; icon?: string; big?: boolean }
/** a line folding into one tile on the Workshop (world px), then flying to the Factory tab */
export interface FoldAnim { x: number; y: number; w: number; h: number; img: HTMLCanvasElement | null; t: number; letter: string }

export class Fx {
  parts: Particle[] = [];
  pops: Pop[] = [];
  rings: Ring[] = [];
  flyers: Flyer[] = [];
  folds: FoldAnim[] = [];
  shake = 0;
  /** reduced motion: no shake, fewer particles */
  calm = false;

  /** Drop the effects placed on a floor (particles, pops, rings): they are in that floor's
   * coordinates, and would play over the other floor after a switch. */
  clearWorld() {
    this.parts = [];
    this.pops = [];
    this.rings = [];
  }

  burst(x: number, y: number, n: number, colors: string[], speed = 30, grav = 60, size = 1, life = 0.6) {
    if (this.calm) n = Math.ceil(n / 3);
    for (let i = 0; i < n; i++) {
      if (this.parts.length > 700) this.parts.shift();
      const a = Math.random() * Math.PI * 2, s = speed * (0.4 + Math.random() * 0.8);
      this.parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - speed * 0.5, life: life * (0.6 + Math.random() * 0.6), max: life, color: colors[i % colors.length], size, grav });
    }
  }

  /** A fountain: particles thrown upward in a cone that fall back (coins out of the Dock). */
  fountain(x: number, y: number, n: number, colors: string[], speed = 90, size = 2, life = 1.1) {
    if (this.calm) n = Math.ceil(n / 3);
    for (let i = 0; i < n; i++) {
      if (this.parts.length > 700) this.parts.shift();
      const a = -Math.PI / 2 + (Math.random() - 0.5) * 1.1, s = speed * (0.6 + Math.random() * 0.6);
      this.parts.push({ x: x + (Math.random() - 0.5) * 6, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: life * (0.7 + Math.random() * 0.5), max: life, color: colors[i % colors.length], size, grav: 160 });
    }
  }

  /** A puff of smoke rising from a chimney (world px). */
  puff(x: number, y: number, dark = false) {
    if (this.parts.length > 700) return;
    const cols = dark ? [C.hull0, C.shadow] : [C.hull1, C.hull2, C.hull0];
    for (let i = 0; i < 2; i++)
      this.parts.push({ x: x + (Math.random() - 0.5) * 2, y, vx: (Math.random() - 0.3) * 5, vy: -8 - Math.random() * 6, life: 1.2 + Math.random() * 0.6, max: 1.6, color: cols[(Math.random() * cols.length) | 0], size: i ? 1 : 2, grav: -2, drag: 0.6 });
  }

  /** A "+N" pop. Pops with the same key close together merge (a busy Dock shows one growing number). */
  pop(x: number, y: number, value: number, key: string, color: string = C.gold, icon: string | null = null, prefix = '+', big = false) {
    for (const p of this.pops) {
      if (p.key === key && p.max - p.life < 0.35) {
        p.value += value;
        p.text = prefix + fmtShort(p.value);
        p.life = p.max;
        return;
      }
    }
    if (this.pops.length > 60) this.pops.shift();
    this.pops.push({ x, y, text: prefix + fmtShort(value), color, life: big ? 1.8 : 1.1, max: big ? 1.8 : 1.1, value, key, icon, big });
  }

  text(x: number, y: number, text: string, color: string, life = 1.4, big = false, icon: string | null = null) {
    if (this.pops.length > 60) this.pops.shift();
    this.pops.push({ x, y, text, color, life, max: life, value: 0, key: '', icon, big });
  }

  ring(x: number, y: number, color: string, r1 = 12, life = 0.5, r0 = 2) {
    this.rings.push({ x, y, life, max: life, color, r0, r1 });
  }

  fly(x0: number, y0: number, x1: number, y1: number, icon?: string, big = false) {
    if (this.flyers.length > 32) return;
    this.flyers.push({ x0, y0, x1, y1, t: 0, dur: (icon ? 0.8 : 0.55) + Math.random() * 0.2, arc: 30 + Math.random() * 40, icon, big });
  }

  kick(amount: number) {
    if (!this.calm) this.shake = Math.max(this.shake, amount);
  }

  update(dt: number): number {
    for (const p of this.parts) {
      p.life -= dt;
      p.vy += p.grav * dt;
      if (p.drag) { const k = Math.max(0, 1 - p.drag * dt); p.vx *= k; p.vy *= k; }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
    this.parts = this.parts.filter((p) => p.life > 0);
    for (const p of this.pops) p.life -= dt;
    this.pops = this.pops.filter((p) => p.life > 0);
    for (const r of this.rings) r.life -= dt;
    this.rings = this.rings.filter((r) => r.life > 0);
    let landed = 0;
    for (const f of this.flyers) {
      f.t += dt;
      if (f.t >= f.dur) landed++;
    }
    this.flyers = this.flyers.filter((f) => f.t < f.dur);
    for (const f of this.folds) f.t += dt;
    this.folds = this.folds.filter((f) => f.t < FOLD_DUR);
    this.shake = Math.max(0, this.shake - dt * 30);
    return landed;
  }
}

/** seconds a fold animation lasts on the floor (the flight to the tab is a Flyer after it): the
 *  crease and the corners, the squeeze to a tile, then the flash and the module's pop */
export const FOLD_DUR = 1.3;
/** the share of FOLD_DUR at which the packet becomes a tile (the flash) */
export const FOLD_FLASH = 0.68;

export function fmtShort(v: number): string {
  if (v < 10 && v !== Math.floor(v)) return v.toFixed(1);
  if (v < 1e4) return String(Math.floor(v));
  if (v < 1e6) return (v / 1e3).toFixed(v < 1e5 ? 1 : 0) + 'K';
  return (v / 1e6).toFixed(2) + 'M';
}
